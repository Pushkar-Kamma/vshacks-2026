const Store = (function () {
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function makeRoomCode() {
    const words = ["SUN", "SEA", "SKY", "FOX", "OAK", "JOY", "RAY", "ZEN"];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(1000 + Math.random() * 9000);
    return word + "-" + number;
  }

  function publicUrl(path) {
    const result = client.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return result.data.publicUrl;
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function rowToPhoto(row) {
    const path = row.storage_path || "";
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

  async function createRoom(name) {
    const code = makeRoomCode();
    const result = await client.from("rooms").insert({ code: code, name: name || "Untitled" });
    if (result.error) throw result.error;
    return code;
  }

  async function getRoom(code) {
    const result = await client.from("rooms").select("*").eq("code", code).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

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

  async function addPhoto(code, meta, blob) {
    const id = crypto.randomUUID();
    const path = code + "/" + id + ".jpg";

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
      if (uploadedToStorage) await client.storage.from(SUPABASE_BUCKET).remove([path]);
      throw result.error;
    }
    return rowToPhoto(result.data);
  }

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

  async function deletePhoto(id, storagePath) {
    if (storagePath && storagePath.indexOf("data:") !== 0) {
      try { await client.storage.from(SUPABASE_BUCKET).remove([storagePath]); }
      catch (e) { console.warn("storage remove failed", e); }
    }
    const result = await client.from("photos").delete().eq("id", id);
    if (result.error) throw result.error;
  }

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
