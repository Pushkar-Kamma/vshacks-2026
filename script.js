(function () {
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
    document.body.classList.toggle("in-room", name === "room");
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
    channel: null,
  };

  const SCENES = {
    warm:   { label: "Sunset", emoji: "🌅" },
    green:  { label: "Nature", emoji: "🌿" },
    blue:   { label: "Sky & Sea", emoji: "💧" },
    night:  { label: "Night", emoji: "🌃" },
    bright: { label: "Bright", emoji: "☀️" },
    mono:   { label: "Urban", emoji: "🏙️" },
    vivid:  { label: "Vivid", emoji: "🌸" },
  };

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
    state.channel = Store.subscribe(code, onInsert, onRemove);
    const existing = await Store.loadPhotos(code);
    existing.forEach(addToState);
    trackSeen(existing);
    render();
    startPolling();
  }

  function leaveRoom() {
    clearInterval(pollTimer);
    pollTimer = null;
    if (state.channel) { try { state.channel.unsubscribe(); } catch (e) {} state.channel = null; }
    state.room = null;
    state.photos = [];
    state.byId = {};
    state.members = {};
    state.filter = { type: "none" };
    state.view = "best";
    state.meIds = null;
    state.lastSeen = null;
    syncToggle();
    history.replaceState(null, "", location.pathname);
    showScreen("home");
    $("join-code").value = "";
  }

  function onInsert(photo) {
    if (!state.room) return;
    if (addToState(photo)) {
      trackSeen([photo]);
      render();
      if (photo.uploaderId !== state.identity.id) {
        toast(photo.uploaderName + " added a photo");
      }
    }
  }

  function onRemove(id) {
    if (!state.byId[id]) return;
    delete state.byId[id];
    state.photos = state.photos.filter(function (p) { return p.id !== id; });
    const wasInLoupe = loupeList.some(function (p) { return p.id === id; });
    loupeList = loupeList.filter(function (p) { return p.id !== id; });
    if (wasInLoupe) {
      if (loupeList.length === 0) { stopSlideshow(); hide($("modal-loupe")); }
      else { if (loupeIndex >= loupeList.length) loupeIndex = loupeList.length - 1; renderLoupe(); }
    }
    render();
  }

  function trackSeen(photos) {
    photos.forEach(function (p) {
      if (p.createdAt && (!state.lastSeen || p.createdAt > state.lastSeen)) {
        state.lastSeen = p.createdAt;
      }
    });
  }

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

  async function processPhoto(file) {
    const img = await fileToImage(file);
    const features = Curate.analyzePhoto(img);
    const scene = Curate.analyzeScene(img);
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
    saved.scene = scene;
    if (addToState(saved)) { trackSeen([saved]); render(); }
  }

  async function addPhotos(files) {
    const images = Array.from(files).filter(function (f) { return f.type && f.type.indexOf("image/") === 0; });
    if (!images.length) return;
    toast("Adding " + images.length + " photo(s)…");
    let added = 0;
    let failed = 0;
    let index = 0;

    async function worker() {
      while (index < images.length) {
        const file = images[index++];
        try { await processPhoto(file); added++; }
        catch (e) { console.error(e); failed++; }
      }
    }
    const pool = [];
    const concurrency = Math.min(4, images.length);
    for (let i = 0; i < concurrency; i++) pool.push(worker());
    await Promise.all(pool);

    toast("Added " + added + (failed ? ", " + failed + " skipped (try JPEG)" : ""));
  }

  function visiblePhotos() {
    Curate.curate(state.photos);
    validateFilter();
    let list = state.photos.slice();
    if (state.view === "best") list = list.filter(function (p) { return p.isBest; });
    const f = state.filter;
    if (f.type === "person") list = list.filter(function (p) { return p.uploaderId === f.id; });
    if (f.type === "scene") list = list.filter(function (p) { return p.scene === f.id; });
    if (f.type === "me" && state.meIds) list = list.filter(function (p) { return state.meIds.has(p.id); });
    return list;
  }

  function validateFilter() {
    const f = state.filter;
    if (f.type === "person" && !state.photos.some(function (p) { return p.uploaderId === f.id; })) {
      state.filter = { type: "none" };
    }
    if (f.type === "scene" && !state.photos.some(function (p) { return p.scene === f.id; })) {
      state.filter = { type: "none" };
    }
  }

  function groupSize(groupId) {
    let n = 0;
    for (const p of state.photos) if (p.groupId === groupId) n++;
    return n;
  }

  function render() {
    const grid = $("grid");
    const list = visiblePhotos();

    const total = state.photos.length;
    $("count-best").textContent = state.photos.filter(function (p) { return p.isBest; }).length;
    $("count-all").textContent = total;
    if (state.room) $("room-code").textContent = state.room.code + " · " + total + (total === 1 ? " photo" : " photos");
    const controlsEl = document.querySelector(".controls");
    if (controlsEl) controlsEl.style.display = total ? "" : "none";
    $("filter-row").style.display = total ? "" : "none";
    const empty = $("empty");
    if (state.photos.length === 0) {
      empty.innerHTML = "<div class='empty-icon'>📷</div><p>No photos yet.</p><p class='muted'>Tap “Add Photos” to start the pool.</p>";
      show(empty);
    } else if (list.length === 0) {
      empty.innerHTML = "<div class='empty-icon'>🔍</div><p>Nothing here.</p><p class='muted'>No photos match this filter.</p>";
      const clearBtn = document.createElement("button");
      clearBtn.className = "btn btn-ghost";
      clearBtn.textContent = "Show all photos";
      clearBtn.style.marginTop = "14px";
      clearBtn.addEventListener("click", function () {
        state.filter = { type: "none" };
        state.view = "all";
        state.meIds = null;
        syncToggle();
        render();
      });
      empty.appendChild(clearBtn);
      show(empty);
    } else {
      hide(empty);
    }

    renderAvatars();
    renderFilters();
    classifyScenes();

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
      if (id === state.identity.id) return;
      const m = state.members[id];
      const a = document.createElement("span");
      a.className = "avatar";
      a.style.background = m.color;
      a.textContent = initials(m.name);
      a.title = m.name;
      wrap.appendChild(a);
    });
  }

  function renderMe() {
    $("me-dot").style.background = state.identity.color;
    $("me-name").textContent = state.identity.name;
    $("me-chip").title = "You're " + state.identity.name + " — click to rename";
  }

  function applyMyName(newName) {
    const myId = state.identity.id;
    if (state.members[myId]) state.members[myId].name = newName;
    state.photos.forEach(function (p) {
      if (p.uploaderId === myId) p.uploaderName = newName;
    });
    renderMe();
    render();
    if (state.room) {
      Store.renameUploader(state.room.code, myId, newName).catch(function (e) {
        console.warn("couldn't save name to server", e);
      });
    }
  }

  function startRename() {
    const chip = $("me-chip");
    const nameSpan = $("me-name");
    if (chip.querySelector(".me-rename")) return;
    chip.classList.add("editing");
    nameSpan.style.display = "none";
    const input = document.createElement("input");
    input.className = "me-rename";
    input.type = "text";
    input.maxLength = 22;
    input.value = state.identity.name;
    chip.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    function finish(save) {
      if (done) return;
      done = true;
      const value = input.value.trim();
      input.remove();
      nameSpan.style.display = "";
      chip.classList.remove("editing");
      if (save && value) {
        state.identity = Names.setName(value);
        applyMyName(value);
        toast("You're now " + state.identity.name);
      }
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", function () { finish(true); });
  }

  let sceneRunning = false;
  function classifyScenes() {
    if (sceneRunning) return;
    const todo = state.photos.filter(function (p) { return !p.scene && !p.sceneFailed; });
    if (!todo.length) return;
    sceneRunning = true;
    Promise.all(todo.map(function (p) {
      return urlToImage(p.url).then(function (img) {
        p.scene = Curate.analyzeScene(img);
      }).catch(function () {
        p.sceneFailed = true;
      });
    })).then(function () {
      sceneRunning = false;
      render();
    });
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
    const scenes = {};
    state.photos.forEach(function (p) { if (p.scene) scenes[p.scene] = true; });
    Object.keys(scenes).forEach(function (key) {
      const meta = SCENES[key] || { label: key, emoji: "🖼" };
      const active = state.filter.type === "scene" && state.filter.id === key;
      row.appendChild(makeChip(meta.emoji + " " + meta.label, active, null, function () {
        state.filter = { type: "scene", id: key }; render();
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
    const sameScene = state.photos.filter(function (p) { return p.scene && p.scene === photo.scene; });
    const anglesBtn = $("loupe-angles");
    if (photo.scene && sameScene.length > 1) {
      const meta = SCENES[photo.scene] || { label: "like this", emoji: "" };
      anglesBtn.textContent = "More " + meta.label + " (" + sameScene.length + ")";
      show(anglesBtn);
      anglesBtn.onclick = function () {
        hide($("modal-loupe"));
        state.view = "all";
        state.filter = { type: "scene", id: photo.scene };
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

  async function deleteCurrent() {
    const photo = loupeList[loupeIndex];
    if (!photo) return;
    if (!confirm("Delete this photo for everyone? This can't be undone.")) return;
    try {
      await Store.deletePhoto(photo.id, photo.storagePath);
      delete state.byId[photo.id];
      state.photos = state.photos.filter(function (p) { return p.id !== photo.id; });
      loupeList = loupeList.filter(function (p) { return p.id !== photo.id; });
      toast("Photo deleted");
      if (loupeList.length === 0) {
        stopSlideshow();
        hide($("modal-loupe"));
      } else {
        if (loupeIndex >= loupeList.length) loupeIndex = loupeList.length - 1;
        renderLoupe();
      }
      render();
    } catch (e) {
      console.error(e);
      toast("Couldn't delete — try again");
    }
  }

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
    toast("Downloading " + list.length + " photo(s)…");
    for (const photo of list) {
      try { await downloadOne(photo); }
      catch (e) { console.error(e); window.open(photo.url, "_blank"); }
    }
  }

  let selfieStream = null;
  async function openSelfie() {
    show($("modal-selfie"));
    $("selfie-status").textContent = "";
    Faces.ensureReady();
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
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function averageDescriptors(list) {
    const out = new Float32Array(list[0].length);
    for (const d of list) {
      for (let i = 0; i < out.length; i++) out[i] += d[i];
    }
    for (let i = 0; i < out.length; i++) out[i] /= list.length;
    return out;
  }

  async function captureSelfie() {
    const status = $("selfie-status");
    const btn = $("btn-capture");
    btn.disabled = true;
    try {
      status.textContent = "Loading face models…";
      const okReady = await Faces.ensureReady();
      if (!okReady) { status.textContent = "Couldn’t load face matching — check your connection and try again."; return; }
      const video = $("selfie-video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const shots = [];
      for (let k = 0; k < 3; k++) {
        status.textContent = "Scanning your face — hold still (" + (k + 1) + "/3)";
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const d = await Faces.describe(canvas);
        if (d) shots.push(d);
        await sleep(300);
      }
      if (!shots.length) { status.textContent = "No face found — try again in better light."; return; }
      const myFace = shots.length > 1 ? averageDescriptors(shots) : shots[0];
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
      toast(matches.size ? "Found " + matches.size + " photo(s) of you" : "No photos of you found yet");
    } catch (e) {
      console.error(e);
      status.textContent = "Something went wrong — try again.";
    } finally {
      btn.disabled = false;
    }
  }

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
  }

  function bind() {
    $("btn-start").addEventListener("click", startSession);
    $("btn-join").addEventListener("click", function () { joinSession($("join-code").value); });
    $("join-code").addEventListener("keydown", function (e) { if (e.key === "Enter") joinSession(e.target.value); });

    $("tab-best").addEventListener("click", function () { state.view = "best"; syncToggle(); render(); });
    $("tab-all").addEventListener("click", function () { state.view = "all"; syncToggle(); render(); });

    $("btn-add").addEventListener("click", function () { $("file-input").click(); });
    $("file-input").addEventListener("change", function (e) {
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
    $("loupe-delete").addEventListener("click", deleteCurrent);

    $("btn-leave").addEventListener("click", leaveRoom);
    $("btn-slideshow").addEventListener("click", startSlideshow);
    $("me-chip").addEventListener("click", startRename);
    $("me-chip").addEventListener("keydown", function (e) {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startRename(); }
    });

    document.addEventListener("keydown", function (e) {
      if ($("modal-loupe").classList.contains("hidden")) return;
      if (e.key === "ArrowLeft") loupeStep(-1);
      else if (e.key === "ArrowRight") loupeStep(1);
      else if (e.key === "Escape") { stopSlideshow(); hide($("modal-loupe")); }
    });

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

  function initHero() {
    buildPhotoStream();
    shuffleWordmark();
  }

  function buildPhotoStream() {
    const stream = $("photo-stream");
    if (!stream) return;
    const lanes = window.innerWidth > 700 ? 8 : 4;
    const perLane = 2;
    let n = 0;
    for (let lane = 0; lane < lanes; lane++) {
      for (let k = 0; k < perLane; k++) {
        const card = document.createElement("div");
        card.className = "float-card";
        const laneCenter = ((lane + 0.5) / lanes) * 100;
        const jitter = (Math.random() - 0.5) * (100 / lanes) * 0.6;
        const x = Math.max(1, Math.min(90, laneCenter + jitter));
        const w = 80 + Math.floor(Math.random() * 60);
        const dur = 20 + Math.floor(Math.random() * 8);
        const delay = -(k / perLane) * dur - Math.random() * (dur / perLane);
        const rot = Math.floor(Math.random() * 14) - 7;
        const op = 0.38 + Math.random() * 0.22;
        card.style.left = x.toFixed(1) + "%";
        card.style.setProperty("--w", w + "px");
        card.style.setProperty("--dur", dur + "s");
        card.style.setProperty("--rot", rot + "deg");
        card.style.setProperty("--op", op.toFixed(2));
        card.style.animationDelay = delay.toFixed(1) + "s";
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = "";
        img.src = "https://picsum.photos/seed/candid" + n + "/240/320";
        card.appendChild(img);
        stream.appendChild(card);
        n++;
      }
    }
  }

  function shuffleWordmark() {
    const el = document.querySelector(".brandmark");
    if (!el) return;
    const fonts = [
      "Georgia, serif", "'Courier New', monospace", "Impact, sans-serif",
      "'Comic Sans MS', cursive", "'Times New Roman', serif",
      "Verdana, sans-serif", "'Trebuchet MS', sans-serif",
    ];
    let ticks = 0;
    const timer = setInterval(function () {
      el.style.fontFamily = fonts[Math.floor(Math.random() * fonts.length)];
      ticks++;
      if (ticks >= 16) {
        clearInterval(timer);
        el.style.fontFamily = "";
      }
    }, 65);
  }

  function init() {
    bind();
    initHero();
    const room = new URLSearchParams(location.search).get("room");
    if (room) joinSession(room); else showScreen("home");
  }

  init();
})();
