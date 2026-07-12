// script.js — Candid app controller.
// Wires the UI to the brain (Curate), identities (Names), backend (Store),
// and the optional face helper (Faces).

(function () {
  // ---------- tiny helpers ----------
  function $(id) { return document.getElementById(id); }
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    show(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { hide(t); }, 2600);
  }

  function showScreen(name) {
    hide($("screen-home"));
    hide($("screen-room"));
    show($("screen-" + name));
  }

  function initials(name) {
    const parts = name.split(" ");
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function fileToImage(file) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function urlToImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Shrink an image and return a JPEG Blob (keeps uploads fast).
  function downscaleToBlob(img, maxDim, quality) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, "image/jpeg", quality);
    });
  }

  // ---------- state ----------
  const state = {
    identity: Names.getIdentity(),
    room: null,
    photos: [],
    byId: {},
    members: {},
    view: "best",
    filter: { type: "none" },
    meIds: null,
    lastSeen: null,
  };

  // ---------- rooms ----------
  async function startSession() {
    try {
      const name = Names.randomRoomName();
      const code = await Store.createRoom(name);
      await enterRoom(code, { name: name });
      openInvite();
    } catch (e) { console.error(e); toast("Couldn't start session"); }
  }

  async function joinSession(code) {
    code = (code || "").trim().toUpperCase();
    if (!code) return;
    try {
      const room = await Store.getRoom(code);
      if (!room) { toast("No session with that code"); return; }
      await enterRoom(code, room);
    } catch (e) { console.error(e); toast("Couldn't join"); }
  }

  async function enterRoom(code, room) {
    state.room = { code: code, name: (room && room.name) || code };
    $("room-name").textContent = state.room.name;
    $("room-code").textContent = code;
    renderMe();
    showScreen("room");
    history.replaceState(null, "", "?room=" + code);
    Store.subscribe(code, onInsert);
    const existing = await Store.loadPhotos(code);
    existing.forEach(addToState);
    trackSeen(existing);
    render();
    startPolling();
  }

  function onInsert(photo) {
    if (addToState(photo)) {
      trackSeen([photo]);
      render();
      if (photo.uploaderId !== state.identity.id) {
        toast(photo.uploaderName + " added a photo");
      }
    }
  }

  // Remember the newest photo time we've seen, so polling only asks for newer ones.
  function trackSeen(photos) {
    photos.forEach(function (p) {
      if (p.createdAt && (!state.lastSeen || p.createdAt > state.lastSeen)) {
        state.lastSeen = p.createdAt;
      }
    });
  }

  // Live updates use Supabase realtime when it's enabled; this polling backup
  // keeps everyone in sync either way by checking for new photos every few seconds.
  let pollTimer = null;
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async function () {
      if (!state.room) return;
      try {
        const news = await Store.loadPhotos(state.room.code, state.lastSeen);
        let changed = false;
        news.forEach(function (p) {
          if (addToState(p)) {
            changed = true;
            if (p.uploaderId !== state.identity.id) toast(p.uploaderName + " added a photo");
          }
        });
        trackSeen(news);
        if (changed) render();
      } catch (e) { console.error(e); }
    }, 4000);
  }

  function addToState(photo) {
    if (!photo || !photo.id || state.byId[photo.id]) return false;
    // Guard against malformed rows (anyone can insert with the public key).
    if (typeof photo.phash !== "string" || photo.phash.length !== 64) return false;
    if (!photo.uploaderName) photo.uploaderName = "Someone";
    if (!photo.color) photo.color = "#2E9BF5";
    if (!isFinite(photo.sharpness)) photo.sharpness = 0;
    if (!isFinite(photo.takenAt)) photo.takenAt = Date.now();
    state.byId[photo.id] = photo;
    state.photos.push(photo);
    state.members[photo.uploaderId] = { name: photo.uploaderName, color: photo.color };
    return true;
  }

  // ---------- adding photos ----------
  async function addPhotos(files) {
    if (!files || !files.length) return;
    toast("Adding " + files.length + " photo(s)…");
    let added = 0;
    let failed = 0;
    for (const file of files) {
      if (!file.type || file.type.indexOf("image/") !== 0) continue;
      try {
        const img = await fileToImage(file);
        const features = Curate.analyzePhoto(img);
        const blob = await downscaleToBlob(img, 1200, 0.72);
        URL.revokeObjectURL(img.src);
        const saved = await Store.addPhoto(state.room.code, {
          uploaderId: state.identity.id,
          uploaderName: state.identity.name,
          color: state.identity.color,
          takenAt: file.lastModified || Date.now(),
          phash: features.phash,
          sharpness: features.sharpness,
        }, blob);
        if (addToState(saved)) { trackSeen([saved]); render(); }
        added++;
      } catch (e) {
        console.error(e);
        failed++;
      }
    }
    toast("Added " + added + (failed ? ", " + failed + " skipped (try JPEG)" : ""));
  }

  // ---------- rendering ----------
  function visiblePhotos() {
    Curate.curate(state.photos);
    let list = state.photos.slice();
    if (state.view === "best") list = list.filter(function (p) { return p.isBest; });
    const f = state.filter;
    if (f.type === "person") list = list.filter(function (p) { return p.uploaderId === f.id; });
    if (f.type === "moment") list = list.filter(function (p) { return p.momentId === f.id; });
    if (f.type === "me" && state.meIds) list = list.filter(function (p) { return state.meIds.has(p.id); });
    return list;
  }

  function groupSize(groupId) {
    let n = 0;
    for (const p of state.photos) if (p.groupId === groupId) n++;
    return n;
  }

  function render() {
    const grid = $("grid");
    const list = visiblePhotos();

    $("count-best").textContent = state.photos.filter(function (p) { return p.isBest; }).length;
    $("count-all").textContent = state.photos.length;
    const empty = $("empty");
    if (state.photos.length === 0) {
      empty.innerHTML = "<div class='empty-icon'>📷</div><p>No photos yet.</p><p class='muted'>Tap “Add Photos” to start the pool.</p>";
      show(empty);
    } else if (list.length === 0) {
      empty.innerHTML = "<div class='empty-icon'>🔍</div><p>Nothing here.</p><p class='muted'>Try a different filter or the All tab.</p>";
      show(empty);
    } else {
      hide(empty);
    }

    renderAvatars();
    renderFilters();
    renderStats();

    grid.innerHTML = "";
    list.forEach(function (photo) {
      const tile = document.createElement("div");
      tile.className = "tile";
      const img = document.createElement("img");
      img.src = photo.url;
      img.loading = "lazy";
      tile.appendChild(img);
      if (photo.isBest) {
        const star = document.createElement("span");
        star.className = "star";
        star.textContent = "⭐";
        tile.appendChild(star);
      }
      const dot = document.createElement("span");
      dot.className = "owner-dot";
      dot.style.background = photo.color;
      tile.appendChild(dot);
      const size = groupSize(photo.groupId);
      if (state.view === "best" && size > 1) {
        const dup = document.createElement("span");
        dup.className = "dup";
        dup.textContent = "×" + size;
        tile.appendChild(dup);
      }
      tile.addEventListener("click", function () { openLoupe(photo, list); });
      grid.appendChild(tile);
    });
  }

  function renderAvatars() {
    const wrap = $("member-avatars");
    wrap.innerHTML = "";
    Object.keys(state.members).forEach(function (id) {
      const m = state.members[id];
      const a = document.createElement("span");
      a.className = "avatar";
      a.style.background = m.color;
      a.textContent = initials(m.name);
      a.title = m.name;
      wrap.appendChild(a);
    });
  }

  // Show who "you" are in the room bar (tap the chip to reroll).
  function renderMe() {
    $("me-dot").style.background = state.identity.color;
    $("me-name").textContent = state.identity.name.split(" ")[0];
    $("me-chip").title = "You're " + state.identity.name + " — tap to change";
  }

  // The "automation" headline: how many photos we pooled, kept, and tidied.
  function renderStats() {
    const el = $("stats");
    const total = state.photos.length;
    if (!total) { hide(el); return; }
    let best = 0;
    for (const p of state.photos) if (p.isBest) best++;
    const dupes = total - best;
    el.innerHTML = "";
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.textContent = "✨ ";
    el.appendChild(spark);
    el.appendChild(strong(total));
    el.appendChild(document.createTextNode(" pooled · "));
    el.appendChild(strong(best));
    el.appendChild(document.createTextNode(" best kept · "));
    el.appendChild(strong(dupes));
    el.appendChild(document.createTextNode(" tidied away"));
    show(el);
  }
  function strong(n) {
    const b = document.createElement("b");
    b.textContent = String(n);
    return b;
  }

  function renderFilters() {
    const row = $("filter-row");
    row.innerHTML = "";
    row.appendChild(makeChip("Everyone", state.filter.type === "none", null, function () {
      state.filter = { type: "none" }; render();
    }));
    Object.keys(state.members).forEach(function (id) {
      const m = state.members[id];
      const active = state.filter.type === "person" && state.filter.id === id;
      row.appendChild(makeChip(m.name, active, m.color, function () {
        state.filter = { type: "person", id: id }; render();
      }));
    });
    const moments = {};
    state.photos.forEach(function (p) { moments[p.momentId] = true; });
    Object.keys(moments).forEach(function (mid) {
      const idNum = Number(mid);
      const active = state.filter.type === "moment" && state.filter.id === idNum;
      row.appendChild(makeChip("🕒 Moment " + (idNum + 1), active, null, function () {
        state.filter = { type: "moment", id: idNum }; render();
      }));
    });
  }

  function makeChip(label, active, color, onClick) {
    const chip = document.createElement("button");
    chip.className = "chip" + (active ? " active" : "");
    if (color) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;
      chip.appendChild(dot);
    }
    chip.appendChild(document.createTextNode(label));
    chip.addEventListener("click", onClick);
    return chip;
  }

  // ---------- loupe ----------
  let loupeList = [];
  let loupeIndex = 0;
  function openLoupe(photo, list) {
    loupeList = list;
    loupeIndex = list.indexOf(photo);
    renderLoupe();
    show($("modal-loupe"));
  }
  function renderLoupe() {
    const photo = loupeList[loupeIndex];
    if (!photo) return;
    $("loupe-img").src = photo.url;
    const owner = $("loupe-owner");
    owner.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "avatar";
    dot.style.background = photo.color;
    dot.textContent = initials(photo.uploaderName);
    owner.appendChild(dot);
    owner.appendChild(document.createTextNode(" " + photo.uploaderName));
    const sameMoment = state.photos.filter(function (p) { return p.momentId === photo.momentId; });
    const anglesBtn = $("loupe-angles");
    if (sameMoment.length > 1) {
      anglesBtn.textContent = "Other angles (" + sameMoment.length + ")";
      show(anglesBtn);
      anglesBtn.onclick = function () {
        hide($("modal-loupe"));
        state.view = "all";
        state.filter = { type: "moment", id: photo.momentId };
        syncToggle();
        render();
      };
    } else { hide(anglesBtn); }
  }
  function loupeStep(delta) {
    if (!loupeList.length) return;
    loupeIndex = (loupeIndex + delta + loupeList.length) % loupeList.length;
    renderLoupe();
  }

  // ---------- slideshow ----------
  // Play the photos currently on screen fullscreen, auto-advancing (a highlight reel).
  let slideTimer = null;
  function startSlideshow() {
    const list = visiblePhotos();
    if (!list.length) { toast("Add photos first"); return; }
    openLoupe(list[0], list);
    $("modal-loupe").classList.add("playing");
    clearInterval(slideTimer);
    slideTimer = setInterval(function () { loupeStep(1); }, 2800);
  }
  function stopSlideshow() {
    clearInterval(slideTimer);
    slideTimer = null;
    $("modal-loupe").classList.remove("playing");
  }

  // ---------- download ----------
  // Download a single photo as a file.
  async function downloadOne(photo) {
    const res = await fetch(photo.url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "candid-" + photo.id + ".jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  // Download everything currently shown. If JSZip loaded, bundle it into ONE .zip
  // (much nicer than dozens of separate browser downloads).
  async function downloadVisible() {
    const list = visiblePhotos();
    if (!list.length) { toast("Nothing to download"); return; }
    if (list.length === 1) {
      try { await downloadOne(list[0]); }
      catch (e) { console.error(e); window.open(list[0].url, "_blank"); }
      return;
    }
    if (typeof JSZip !== "undefined") {
      toast("Zipping " + list.length + " photo(s)…");
      try {
        const zip = new JSZip();
        let n = 0;
        for (const photo of list) {
          const res = await fetch(photo.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          n++;
          const who = photo.uploaderName.replace(/[^a-z0-9]+/gi, "");
          zip.file("candid-" + n + "-" + who + ".jpg", blob);
        }
        const bundle = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(bundle);
        a.download = "candid-" + (state.room ? state.room.code : "photos") + ".zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        toast("Saved " + n + " photo(s) as a zip");
        return;
      } catch (e) { console.error(e); }
    }
    // Fallback: one file at a time.
    toast("Downloading " + list.length + " photo(s)…");
    for (const photo of list) {
      try { await downloadOne(photo); }
      catch (e) { console.error(e); window.open(photo.url, "_blank"); }
    }
  }

  // ---------- photos of you ----------
  let selfieStream = null;
  async function openSelfie() {
    show($("modal-selfie"));
    $("selfie-status").textContent = "";
    try {
      selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      $("selfie-video").srcObject = selfieStream;
    } catch (e) {
      $("selfie-status").textContent = "Camera unavailable.";
    }
  }
  function closeSelfie() {
    if (selfieStream) {
      selfieStream.getTracks().forEach(function (t) { t.stop(); });
      selfieStream = null;
    }
    hide($("modal-selfie"));
  }
  async function captureSelfie() {
    const status = $("selfie-status");
    const btn = $("btn-capture");
    btn.disabled = true;
    try {
      status.textContent = "Loading face models…";
      const okReady = await Faces.ensureReady();
      if (!okReady) { status.textContent = "Face matching unavailable right now."; return; }
      const video = $("selfie-video");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      status.textContent = "Finding your face…";
      const myFace = await Faces.describe(canvas);
      if (!myFace) { status.textContent = "No face found — try again."; return; }
      const matches = new Set();
      let i = 0;
      for (const photo of state.photos) {
        i++;
        status.textContent = "Searching " + i + " of " + state.photos.length + "…";
        try {
          const img = await urlToImage(photo.url);
          const faces = await Faces.describeAll(img);
          if (Faces.containsFace(faces, myFace)) matches.add(photo.id);
        } catch (e) { console.error(e); }
      }
      state.meIds = matches;
      state.view = "all";
      state.filter = { type: "me" };
      syncToggle();
      closeSelfie();
      render();
      toast("Found " + matches.size + " photo(s) of you");
    } catch (e) {
      console.error(e);
      status.textContent = "Something went wrong — try again.";
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- invite / qr ----------
  function roomUrl() {
    return location.origin + location.pathname + "?room=" + state.room.code;
  }
  function openInvite() {
    $("qr-code").textContent = state.room.code;
    const qr = $("qr");
    qr.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qr, { text: roomUrl(), width: 200, height: 200 });
    }
    show($("modal-qr"));
  }

  function syncToggle() {
    $("tab-best").classList.toggle("active", state.view === "best");
    $("tab-all").classList.toggle("active", state.view === "all");
    const toggle = document.querySelector(".toggle");
    if (toggle) toggle.classList.toggle("on-all", state.view === "all");
  }

  // ---------- wire up ----------
  function bind() {
    $("btn-start").addEventListener("click", startSession);
    $("btn-join").addEventListener("click", function () { joinSession($("join-code").value); });
    $("join-code").addEventListener("keydown", function (e) { if (e.key === "Enter") joinSession(e.target.value); });

    $("tab-best").addEventListener("click", function () { state.view = "best"; syncToggle(); render(); });
    $("tab-all").addEventListener("click", function () { state.view = "all"; syncToggle(); render(); });

    $("btn-add").addEventListener("click", function () { $("file-input").click(); });
    $("file-input").addEventListener("change", function (e) {
      // Copy the list first: clearing the input's value empties its FileList,
      // which would otherwise cut off the rest of a multi-photo upload.
      const files = Array.from(e.target.files);
      e.target.value = "";
      addPhotos(files);
    });

    $("btn-download").addEventListener("click", downloadVisible);
    $("btn-me").addEventListener("click", openSelfie);
    $("btn-capture").addEventListener("click", captureSelfie);

    $("btn-invite").addEventListener("click", openInvite);
    $("btn-copy").addEventListener("click", function () {
      navigator.clipboard.writeText(roomUrl()).then(function () { toast("Link copied"); });
    });

    $("loupe-prev").addEventListener("click", function () { loupeStep(-1); });
    $("loupe-next").addEventListener("click", function () { loupeStep(1); });
    $("loupe-download").addEventListener("click", function () {
      const photo = loupeList[loupeIndex];
      if (photo) downloadOne(photo).catch(function () { window.open(photo.url, "_blank"); });
    });

    $("btn-slideshow").addEventListener("click", startSlideshow);
    $("me-chip").addEventListener("click", function () {
      state.identity = Names.reroll();
      renderMe();
      toast("You're now " + state.identity.name);
    });

    // Keyboard: arrows to move, Esc to close (also stops a running slideshow).
    document.addEventListener("keydown", function (e) {
      if ($("modal-loupe").classList.contains("hidden")) return;
      if (e.key === "ArrowLeft") loupeStep(-1);
      else if (e.key === "ArrowRight") loupeStep(1);
      else if (e.key === "Escape") { stopSlideshow(); hide($("modal-loupe")); }
    });

    // Swipe left/right on the big photo (mobile). A tap stops a running slideshow.
    let touchX = null;
    const limg = $("loupe-img");
    limg.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    limg.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) loupeStep(dx < 0 ? 1 : -1);
      touchX = null;
    });
    limg.addEventListener("click", function () { if (slideTimer) stopSlideshow(); });

    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const modal = btn.closest(".modal");
        if (modal.id === "modal-selfie") closeSelfie();
        else { stopSlideshow(); hide(modal); }
      });
    });
  }

  function init() {
    bind();
    const room = new URLSearchParams(location.search).get("room");
    if (room) joinSession(room); else showScreen("home");
  }

  init();
})();
