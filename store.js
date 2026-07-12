// store.js — the ONLY file that talks to the backend (Supabase).
// Keeping all backend calls here means the rest of the app doesn't care where
// photos live, and we could swap Supabase for something else by editing just this file.
//
// Needs (loaded before this file in index.html):
//   - the Supabase JS library (window.supabase, from the CDN)
//   - supabase-config.js (SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET)

const Store = (function () {
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Make a short, readable room code like "SUN-4821".
  function makeRoomCode() {
    const words = ["SUN", "SEA", "SKY", "FOX", "OAK", "JOY", "RAY", "ZEN"];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(1000 + Math.random() * 9000);
    return word + "-" + number;
  }

  // Turn a public URL out of a stored file path.
  function publicUrl(path) {
    const result = client.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return result.data.publicUrl;
  }

  // Read a Blob as a base64 data URL. Used as a fallback when Storage uploads
  // aren't enabled yet, so we can embed the image right in the database row.
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert a database row into the photo object the rest of the app uses.
  function rowToPhoto(row) {
    const path = row.storage_path || "";
    // Images normally live in Storage (a short path). If uploads aren't enabled,
    // the image is embedded in the row as a data URL instead — handle both.
    const url = path.indexOf("data:") === 0 ? path : publicUrl(path);
    return {
      id: row.id,
      uploaderId: row.uploader_id,
      uploaderName: row.uploader_name,
      color: row.color,
      storagePath: path,
      url: url,
      takenAt: Number(row.taken_at),
      phash: row.phash,
      sharpness: row.sharpness,
      createdAt: row.created_at,
    };
  }

  // Create a new room and return its code.
  async function createRoom(name) {
    const code = makeRoomCode();
    const result = await client.from("rooms").insert({ code: code, name: name || "Untitled" });
    if (result.error) throw result.error;
    return code;
  }

  // Look up a room by code (returns null if it doesn't exist).
  async function getRoom(code) {
    const result = await client.from("rooms").select("*").eq("code", code).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  // Load photos in a room. Pass `sinceIso` to fetch only ones added after a time
  // (used by the polling backup so we don't re-download everything each check).
  async function loadPhotos(code, sinceIso) {
    let query = client
      .from("photos")
      .select("*")
      .eq("room_code", code)
      .order("created_at", { ascending: true });
    if (sinceIso) query = query.gt("created_at", sinceIso);
    const result = await query;
    if (result.error) throw result.error;
    return result.data.map(rowToPhoto);
  }

  // Upload one photo's image to Storage, then save its info to the database.
  // `meta` has: uploaderId, uploaderName, color, takenAt, phash, sharpness.
  async function addPhoto(code, meta, blob) {
    const id = crypto.randomUUID();
    const path = code + "/" + id + ".jpg";

    // Preferred: upload the image to Storage and save just its short path.
    // Fallback: if Storage uploads are blocked (no policy yet), embed the image
    // in the row as a data URL so the app still works end to end.
    let storagePath;
    let uploadedToStorage = false;
    const upload = await client.storage
      .from(SUPABASE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg" });
    if (upload.error) {
      console.warn("Storage upload unavailable; embedding image in the row instead.", upload.error.message);
      storagePath = await blobToDataUrl(blob);
    } else {
      storagePath = path;
      uploadedToStorage = true;
    }

    const row = {
      id: id,
      room_code: code,
      uploader_id: meta.uploaderId,
      uploader_name: meta.uploaderName,
      color: meta.color,
      storage_path: storagePath,
      taken_at: meta.takenAt,
      phash: meta.phash,
      sharpness: meta.sharpness,
    };
    const result = await client.from("photos").insert(row).select().single();
    if (result.error) {
      // Don't leave an uploaded file orphaned if saving its info failed.
      if (uploadedToStorage) await client.storage.from(SUPABASE_BUCKET).remove([path]);
      throw result.error;
    }
    return rowToPhoto(result.data);
  }

  // Listen for photos added or removed in a room by anyone (live updates).
  // INSERTs are filtered to this room. DELETEs can't be filtered (the delete
  // payload only carries the id), so we forward every delete and the caller
  // ignores ids it doesn't have.
  function subscribe(code, onInsert, onDelete) {
    return client
      .channel("room-" + code)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: "room_code=eq." + code },
        function (payload) {
          onInsert(rowToPhoto(payload.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "photos" },
        function (payload) {
          if (onDelete && payload.old && payload.old.id) onDelete(payload.old.id);
        }
      )
      .subscribe();
  }

  // Delete one photo everywhere: its image (if in Storage) and its database row.
  async function deletePhoto(id, storagePath) {
    if (storagePath && storagePath.indexOf("data:") !== 0) {
      try { await client.storage.from(SUPABASE_BUCKET).remove([storagePath]); }
      catch (e) { console.warn("storage remove failed", e); }
    }
    const result = await client.from("photos").delete().eq("id", id);
    if (result.error) throw result.error;
  }

  // Rename all of one person's photos in a room, so a name change shows up for
  // everyone after they refresh. Best-effort; a failure here doesn't block the UI.
  async function renameUploader(code, uploaderId, newName) {
    const result = await client
      .from("photos")
      .update({ uploader_name: newName })
      .eq("room_code", code)
      .eq("uploader_id", uploaderId);
    if (result.error) throw result.error;
  }

  return {
    createRoom: createRoom,
    getRoom: getRoom,
    loadPhotos: loadPhotos,
    addPhoto: addPhoto,
    subscribe: subscribe,
    deletePhoto: deletePhoto,
    renameUploader: renameUploader,
  };
})();
