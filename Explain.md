# Candid — How Everything Works (in depth)

This document explains **every feature of Candid and exactly how it works**, file by
file and flow by flow. It's written so any teammate can read their section and be able
to explain their code on the demo video.

> **One-line summary:** Candid is a no-install web app where a group starts a "session,"
> everyone's phone drops photos into one shared gallery in real time, and the app
> **automatically** removes near-duplicates, stars the sharpest shot, groups photos by
> "vibe," and can even find the photos *you're* in.

---

## 1. The big picture

Candid is **plain HTML + CSS + JavaScript** (no framework, no build step). It loads a
few libraries from a CDN and talks to **Supabase** (a hosted Postgres database + file
storage + realtime service) for the shared/multiplayer parts.

### File map

| File | Job |
|------|-----|
| `index.html` | The page: two "screens" (home, room) and the pop-up modals (QR, photo viewer, selfie). |
| `styles.css` | The whole look: dark "Deep Water" teal theme, layout, animations, responsive grid. |
| `script.js` | **The controller.** Holds app state and wires every button/flow to the other modules. |
| `curate.js` | **The automation brain.** Pure math on pixels: fingerprints, sharpness, de-dupe, vibes. No network. |
| `store.js` | **The only file that talks to Supabase.** Rooms, uploads, loading, realtime, delete. |
| `names.js` | Random friendly identities (name + colour) so nobody has to sign up. |
| `faces.js` | Optional "Photos of you" face matching (uses face-api.js, runs on-device). |
| `supabase-config.js` | The backend URL + public key + bucket name. |

### How the files load (bottom of `index.html`)

```html
<!-- Libraries (from CDN) -->
<script src="…/supabase-js@2"></script>        <!-- window.supabase -->
<script src="…/qrcodejs/qrcode.min.js"></script> <!-- QRCode -->
<script src="…/jszip@3.10.1/…"></script>          <!-- JSZip -->
<script defer src="…/face-api@1.7.15/…"></script> <!-- faceapi -->

<!-- Our code (order matters) -->
<script src="supabase-config.js"></script>  <!-- defines SUPABASE_URL etc. -->
<script src="curate.js"></script>           <!-- defines Curate -->
<script src="names.js"></script>            <!-- defines Names -->
<script src="store.js"></script>            <!-- defines Store (needs config + supabase lib) -->
<script src="faces.js"></script>            <!-- defines Faces -->
<script src="script.js"></script>           <!-- the controller, uses all of the above -->
```

Each of our modules is written as an **IIFE** (immediately-invoked function) that returns
a small object, e.g. `const Curate = (function () { … return { … }; })();`. That keeps
each file's helpers private and exposes only a few named functions (`Curate`, `Names`,
`Store`, `Faces`) that the controller calls by name.

---

## 2. The data model

### Supabase tables

- **`rooms`** — one row per session. Columns: `code` (e.g. `SUN-4821`), `name` (e.g.
  "Sunset Session"), `created_at`.
- **`photos`** — one row per photo. Columns: `id` (UUID), `room_code`, `uploader_id`,
  `uploader_name`, `color`, `storage_path`, `taken_at`, `phash`, `sharpness`, `created_at`.

There is also a **Storage bucket** called `photos` for the actual image files.

> **Important:** the "smart" fields (`isBest`, `groupId`, `scene`) are **NOT** stored in
> the database. They are computed fresh in the browser every time, by `curate.js`. The
> database only stores the raw facts (who, when, the fingerprint, the sharpness score,
> and where the image lives).

### The "photo object" used everywhere in the app

`store.js`'s `rowToPhoto()` turns a database row into this shape, and the browser adds a
few computed fields on top:

```js
{
  id, uploaderId, uploaderName, color,   // who
  storagePath, url,                      // where the image is
  takenAt, createdAt,                    // when
  phash, sharpness,                      // fingerprint + crispness (from curate)
  // --- added in the browser ---
  isBest,   // set by Curate.curate(): sharpest in its duplicate group
  groupId,  // set by Curate.curate(): which near-duplicate cluster it's in
  scene     // "warm" | "green" | "blue" | "night" | "bright" | "mono" | "vivid"
}
```

---

## 3. Identities — `names.js`

Nobody logs in. The first time you open Candid, `Names.getIdentity()` creates an identity
and saves it to `localStorage` under the key `candid_identity`:

```js
{ id: "u_ab12cd34", name: "Golden Fox", color: "#2E9BF5" }
```

- `randomName()` = a random adjective + animal (e.g. "Lunar Koala").
- `randomColor()` = one of 8 preset colours (used for your dot on your photos + your avatar).
- `reroll()` keeps your `id` but gives you a **new** name + colour (used by the "You" chip).
- `randomRoomName()` = a fun session name like "Rooftop Night" or "Beach Day" so a new room
  isn't just called "Session."

Because the `id` lives in `localStorage`, the same device keeps the same identity across
visits, which is how "your" photos and "photos of you" stay tied to you.

---

## 4. The automation brain — `curate.js`

This is the file that makes Candid an *automation* tool instead of a shared folder. It's
**pure browser math** — it never touches the network. It reuses one small offscreen
`<canvas>` to read pixels quickly.

### 4a. Fingerprint (dHash) — for finding duplicates

`analyzePhoto(img)` computes a **dHash** ("difference hash"):

1. Shrink the image to a tiny **9×8** grayscale.
2. For each row, compare each pixel to the one on its right: brighter → `1`, else `0`.
3. That's `8 rows × 8 comparisons = 64 bits`, returned as a 64-character string of `"1"`/`"0"`.

Two photos that look alike (same burst, same framing) produce **almost identical**
fingerprints, even if resized or lightly edited.

### 4b. Sharpness (variance of Laplacian) — for picking the best

`sharpness(img)` scores how crisp a photo is:

1. Shrink to **64×64** grayscale.
2. For each pixel, compute an "edge" value = `4*center − 4 neighbours`. Sharp edges give
   big values; blurry areas give small ones.
3. Return the **variance** of those edge values. Crisp photo → high score, blurry → low.

### 4c. De-dupe + best pick — `curate(photos)`

`curate()` runs on the whole list every render:

1. **Group near-duplicates** (`groupDuplicates`): greedy pass — each photo joins the first
   group whose first photo is within **`threshold = 10` bits** (Hamming distance) of it,
   otherwise it starts a new group. Everyone in a group gets the same `groupId`.
2. **Star the best** in each group: the photo with the highest `sharpness` gets `isBest = true`.
3. So the **⭐ Best** view = one sharpest photo per cluster; the `×N` badge = how many
   near-duplicates that best photo represents.

`hamming(a, b)` just counts how many of the 64 characters differ.

### 4d. Vibes / scenes — `analyzeScene(img)`

This groups photos by *look* (the "Sunset / Nature / Sky & Sea…" chips):

1. `averageColor(img)` draws the image at **16×16** and averages the RGB.
2. `sceneFromRgb(r,g,b)` converts that to **HSL** and buckets it:
   - very dark → `night`
   - very unsaturated (grey) → `bright` (if light) or `mono` (urban/roads)
   - otherwise by hue: `warm` (sunset/orange), `green` (nature), `blue` (sky/sea), `vivid` (pink/purple)

> **Honest limitation:** this is a *colour/mood* guess, not real object recognition. It's
> great for sunsets, greenery and night shots, but it can't literally tell "flowers" from
> "roses." True object tagging would need a machine-learning model (e.g. TensorFlow.js
> MobileNet) — a possible future upgrade.

### 4e. Legacy: moments

`groupMoments()` still tags photos by capture time (a >60s gap starts a new "moment"). We
**replaced the moments UI with vibes**, so `momentId` is computed but no longer shown. It's
left in the code as an easy future option.

---

## 5. The backend — `store.js`

Every Supabase call lives here. The rest of the app doesn't know or care that the backend
is Supabase. It creates one client: `window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)`.

- **`createRoom(name)`** — makes a code like `SUN-4821` and inserts a `rooms` row.
- **`getRoom(code)`** — looks up a room (returns `null` if none).
- **`loadPhotos(code, sinceIso?)`** — returns all photos in a room as photo objects. If you
  pass `sinceIso`, it only returns rows newer than that time (used by polling, see §6c).
- **`subscribe(code, onInsert)`** — opens a realtime channel and calls `onInsert` whenever a
  new `photos` row is inserted for this room.
- **`deletePhoto(id, storagePath)`** — removes the Storage file (if any) and deletes the row.

### The upload + storage fallback (important & clever)

`addPhoto(code, meta, blob)`:

1. Try to **upload the image to Supabase Storage** at `code/<uuid>.jpg`.
2. **If the upload is blocked** (the demo project doesn't have a Storage upload policy yet),
   it **falls back** to `blobToDataUrl(blob)` — a base64 `data:` string — and stores *that*
   in the `storage_path` column. So the image travels *inside the database row*.
3. Insert the `photos` row and return the saved photo.

`rowToPhoto()` handles both cases: if `storage_path` starts with `data:` it uses it directly
as the image `url`; otherwise it builds a public Storage URL. This is **self-healing** — the
app works today via the fallback, and automatically upgrades to real full-resolution Storage
the moment someone adds the Storage policy (see §10).

---

## 6. The controller — `script.js`

`script.js` is one big IIFE. It holds all app **state** and connects the UI to the modules.

### 6a. State

```js
const state = {
  identity,          // you (from Names)
  room,              // { code, name } or null
  photos: [],        // every photo object we know about
  byId: {},          // id -> photo, for fast de-dup
  members: {},       // uploaderId -> { name, color }, for avatars + filters
  view: "best",      // "best" or "all"
  filter: { type },  // "none" | "person" | "scene" | "me"
  meIds: null,       // Set of photo ids that contain your face
  lastSeen: null,    // newest created_at we've seen (for polling)
  channel: null,     // the realtime subscription (so we can unsubscribe on leave)
};
```

There are two "screens" in `index.html` (`#screen-home`, `#screen-room`) and `showScreen()`
just hides one and shows the other.

### 6b. Rooms: start / join / enter / leave

- **`startSession()`** → `Names.randomRoomName()` → `Store.createRoom()` → `enterRoom()` →
  `openInvite()` (shows the QR).
- **`joinSession(code)`** → `Store.getRoom()` → `enterRoom()`.
- **`enterRoom(code, room)`** sets `state.room`, updates the header, switches to the room
  screen, sets the URL to `?room=CODE` (so the link is shareable/refresh-safe), **subscribes**
  to realtime, **loads existing photos**, and **starts polling**.
- **`leaveRoom()`** (the `‹` button) stops polling, unsubscribes, wipes room state, restores
  the URL to `/`, and goes home.
- On page load, `init()` reads `?room=` from the URL — if present it auto-joins that room,
  otherwise it shows home.

### 6c. Live sync (two mechanisms, belt-and-suspenders)

New photos from other people appear automatically via **two** paths:

1. **Realtime** (`Store.subscribe`) — instant push, *if* realtime is enabled on the table.
2. **Polling** (`startPolling`) — every **4 seconds** it calls `loadPhotos(code, lastSeen)`
   to fetch only rows newer than the newest one we've seen. This is the reliable backup that
   makes cross-device sync work **even when realtime isn't enabled**.

Both funnel through `addToState(photo)`, which **de-duplicates by `id`** (so a photo added by
realtime won't be added again by polling), validates the row (the `phash` must be 64 chars —
a guard against junk rows since anyone with the public key can insert), records the uploader
in `members`, and returns `true` only for genuinely new photos. A new photo from someone else
also pops a toast: *"Golden Fox added a photo."*

### 6d. Adding photos (the pipeline + why it's fast)

Tapping **Add Photos** opens the hidden file input. On change we `Array.from()` the files
first (clearing the input would otherwise empty the live `FileList` mid-upload — a real bug
we fixed) and call `addPhotos()`.

`processPhoto(file)` runs the pipeline for one file:

```
fileToImage()          → decode the file into an <img>
Curate.analyzePhoto()  → phash + sharpness  (on the FULL image, for accuracy)
Curate.analyzeScene()  → the vibe
downscaleToBlob(1200)  → shrink to ~1200px JPEG q0.72 (small, fast to upload/store)
Store.addPhoto()       → upload + insert row
addToState() + render()
```

`addPhotos()` runs **up to 4 of these at once** (a small worker "pool") instead of strictly
one-by-one, so a batch of photos finishes roughly 4× faster. (The shared canvas in
`curate.js` is safe because the analysis functions are synchronous — the browser never
switches tasks in the middle of one.)

### 6e. Rendering: Best/All, tiles, stats

`render()` is the single function that redraws the room. It:

- `visiblePhotos()` = `Curate.curate(all photos)` → then filters by the current view
  (Best hides non-best) and the current filter (person / scene / me).
- Updates the **Best/All counts**, the **empty states**, the **avatars**, the **filter chips**,
  and the **stats line**.
- Rebuilds the grid: each tile is an `<img loading="lazy">` plus a ⭐ if best, a colour dot for
  the owner, and a `×N` duplicate badge in Best view. Clicking a tile opens the loupe.

The **stats line** (`renderStats`) is the automation made visible:
`✨ N pooled · B best kept · D tidied away`, where `D = N − B`.

### 6f. Filters (and how they self-heal)

`renderFilters()` builds the chip row: **Everyone**, one chip per **person** (with their
colour dot), and one chip per **vibe** present. Each chip sets `state.filter` and re-renders.

`validateFilter()` (called inside `visiblePhotos`) is the fix for *"sometimes All shows
nothing."* If the active filter no longer matches any photo (e.g. a vibe that got deleted),
it silently resets to "Everyone." And if a filter genuinely matches nothing, the empty state
shows a **"Show all photos"** button that clears everything — so you can never get stuck on a
blank screen.

### 6g. The loupe (full-screen viewer)

`openLoupe(photo, list)` remembers the list you opened from and the index. `renderLoupe()`
shows the big image, the owner, and — if there are other photos of the same **vibe** — a
**"More Sunset (3)"** button that jumps to that vibe filter.

Controls: `‹ ›` buttons, **arrow keys**, **swipe** left/right on mobile, **Esc** to close.
There's also **⬇ Save** (download this one) and **🗑 Delete**.

### 6h. Slideshow

The **▶** button plays the currently-shown photos full-screen, auto-advancing every 2.8s with
a gentle "Ken Burns" zoom (a CSS animation on the `.playing` loupe). Esc or a tap stops it.

### 6i. Download

**⬇ Download** grabs whatever is currently shown:

- 1 photo → downloads it directly.
- Many photos → if **JSZip** is available, it fetches each image and bundles them into **one
  `.zip`** (`candid-<ROOMCODE>.zip`). If JSZip is missing, it falls back to downloading files
  one at a time.

### 6j. Delete

**🗑 Delete** in the loupe asks for confirmation, calls `Store.deletePhoto()`, then removes the
photo from `state` and the loupe list and re-renders. (Note: the person who deletes sees it
vanish instantly; other people see it disappear on their next refresh, because the app only
listens for *inserts* live, not deletes.)

### 6k. Photos of you (face scan) — `captureSelfie()` + `faces.js`

1. **Open camera** (`openSelfie`) via `getUserMedia`.
2. **Load models once** (`Faces.ensureReady`) — three face-api.js models from the CDN
   (~12 MB, so the first run is a bit slow). Everything is guarded: if the library/models
   fail, the feature just says "unavailable" and the rest of the app is unaffected.
3. **Scan** (Apple-Face-ID style): grab **3 frames**, get each frame's 128-number
   "faceprint" (`Faces.describe`), and **average** them (`averageDescriptors`) into one
   steadier faceprint.
4. **Search**: for each pooled photo, detect all faces (`Faces.describeAll`) and check if any
   is within a **Euclidean distance of 0.55** of your faceprint (`Faces.containsFace`).
5. Matches go into `state.meIds`; the view switches to a **"me"** filter showing only photos
   you're in.

All of this runs **on your device** — your selfie never leaves the browser.

### 6l. Invite / QR

`openInvite()` builds a QR code (with the `qrcodejs` library) that encodes the room URL
(`…/?room=CODE`), plus a **Copy link** button. Scanning the QR or opening the link auto-joins.

### 6m. The "You" chip

Tapping your name in the header calls `Names.reroll()` to give you a fresh name + colour, then
re-renders. Handy if two people roll the same name.

---

## 7. The look — `index.html` + `styles.css`

- **Theme:** a dark **"Deep Water" teal** palette defined as CSS variables in `:root`
  (`--bg`, `--card`, `--accent` cerulean, `--best` amber, etc.), plus the **Inter** font.
  This palette came from the team's design.
- **Home:** a gradient "Candid" wordmark, drifting **aurora** glow blobs, and **scattered
  emoji photo cards** that pop and gently float in (pure CSS keyframes: `popIn`, `floaty`,
  `drift1/2/3`).
- **Room:** a glassy sticky header (`backdrop-filter: blur`), a **Best/All** segmented toggle
  where the **active button** gets the pill highlight (simple and always aligned), pill filter
  chips, and a floating glass toolbar at the bottom.
- **Responsive grid:** phones get the classic **3 columns**; on screens **≥ 640px** the grid
  switches to `repeat(auto-fill, minmax(150px, 1fr))` so photos **fill the width** with more,
  sensibly-sized columns instead of a few giant tiles or a narrow phone-shaped column.
- **Selfie:** a circular scan frame with a glowing ring for the Face-ID feel.

---

## 8. Security & privacy (be honest in the demo)

- The key in `supabase-config.js` is the **publishable (anon) key** — it is *designed* to be
  in the browser and is safe to commit. Security is meant to come from **Row Level Security
  (RLS)** policies, not from hiding the key. The secret `service_role` key is **never** in the
  client.
- **Right now it's demo-grade, not private.** The RLS policies are wide open (`for all to
  anon`) and the bucket is public, so anyone who opens the page can read/add/delete any room's
  photos. Room codes are for **sharing convenience, not access control**. This is fine for a
  hackathon demo but **not** for real personal photos.

---

## 9. Known limitations / honest caveats

- **Vibes are colour-based**, not true object detection ("flowers vs roads" needs an ML model).
- **Delete** doesn't propagate live to other devices (only inserts are live) — they see it on refresh.
- **First face scan** downloads ~12 MB of models, so it's slow the first time.
- **Images travel as data URLs** (embedded in rows) until the optional Storage step is done,
  which makes big rooms heavier to load.
- **Duplicate detection** ignores time and colour — it's purely the visual fingerprint.

---

## 10. Optional Supabase upgrade (full-res storage + instant realtime)

Paste this once into the Supabase **SQL editor** and the app upgrades itself automatically
(full-resolution images in Storage + instant push updates instead of 4s polling):

```sql
-- Let anyone with the room link upload + read photos in the 'photos' bucket
create policy "Candid anon upload" on storage.objects
  for insert to anon with check (bucket_id = 'photos');
create policy "Candid anon read" on storage.objects
  for select to anon using (bucket_id = 'photos');

-- Turn on instant live updates for the photos table
alter publication supabase_realtime add table public.photos;
```

---

## 11. Who explains what (for the ≤5-min video)

Each person should be able to explain the file(s) they own:

| Area | Files | Talking points |
|------|-------|----------------|
| The automation brain | `curate.js` | dHash duplicate fingerprint, sharpness = variance of Laplacian, greedy grouping, colour→vibe |
| Backend & realtime | `store.js`, `supabase-config.js` | rooms/photos tables, upload + data-URL fallback, realtime + polling, delete |
| App controller & UI logic | `script.js` | state, render loop, filters, add-photo pipeline, loupe/slideshow/download/delete |
| Identity & faces | `names.js`, `faces.js` | localStorage identities, on-device face matching |
| Design & layout | `index.html`, `styles.css` | screens, theme, animations, responsive grid |

**Demo flow that shows the "wow":** start a session → scan the QR on a second phone → both
add photos → watch them pool live → flip to **⭐ Best** to see duplicates collapse and the
stats line update → tap a **vibe** chip → **Photos of you** → **Download** the zip.
