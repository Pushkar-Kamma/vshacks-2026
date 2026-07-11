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

  // Convert a database row into the photo object the rest of the app uses.
  function rowToPhoto(row) {
    return {
      id: row.id,
      uploaderId: row.uploader_id,
      uploaderName: row.uploader_name,
      color: row.color,
      storagePath: row.storage_path,
      url: publicUrl(row.storage_path),
      takenAt: Number(row.taken_at),
      phash: row.phash,
      sharpness: row.sharpness,
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

  // Load all photos already in a room.
  async function loadPhotos(code) {
    const result = await client
      .from("photos")
      .select("*")
      .eq("room_code", code)
      .order("created_at", { ascending: true });
    if (result.error) throw result.error;
    return result.data.map(rowToPhoto);
  }

  // Upload one photo's image to Storage, then save its info to the database.
  // `meta` has: uploaderId, uploaderName, color, takenAt, phash, sharpness.
  async function addPhoto(code, meta, blob) {
    const id = crypto.randomUUID();
    const path = code + "/" + id + ".jpg";

    const upload = await client.storage
      .from(SUPABASE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg" });
    if (upload.error) throw upload.error;

    const row = {
      id: id,
      room_code: code,
      uploader_id: meta.uploaderId,
      uploader_name: meta.uploaderName,
      color: meta.color,
      storage_path: path,
      taken_at: meta.takenAt,
      phash: meta.phash,
      sharpness: meta.sharpness,
    };
    const result = await client.from("photos").insert(row);
    if (result.error) throw result.error;
    return rowToPhoto(row);
  }

  // Listen for new photos added to a room by anyone (live updates).
  function subscribe(code, onInsert) {
    return client
      .channel("room-" + code)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: "room_code=eq." + code },
        function (payload) {
          onInsert(rowToPhoto(payload.new));
        }
      )
      .subscribe();
  }

  return {
    createRoom: createRoom,
    getRoom: getRoom,
    loadPhotos: loadPhotos,
    addPhoto: addPhoto,
    subscribe: subscribe,
  };
})();
