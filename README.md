# 📸 Candid

**Everyone's photos from the moment — pooled, cleaned, and instantly yours.**

Our team's project for **[vsHacks 2026](https://vshacks-2026.devpost.com/)** (theme: **Automation**).
Candid is a zero-install group photo app: start a session, friends scan a QR to join,
everyone's photos pool into one live gallery, and the app **automatically** groups
near-duplicates, stars the sharpest, and can even find the photos *you're* in.

- 🌐 **Live app:** https://pushkar-kamma.github.io/vshacks-2026/ (auto-deploys from `main`)
- 🏆 **Devpost:** https://vshacks-2026.devpost.com/
- 💬 **Discord:** https://discord.gg/fFagbFh45c
- 🛠️ **Stack:** plain HTML/CSS/JS (no build step) + **Supabase** (rooms, storage, realtime) + face-api.js for "Photos of You".

---

## 🚀 Run it locally

No build step. Use the **Live Server** VS Code extension (right-click `index.html` →
**"Open with Live Server"**) — a local server is needed for the camera + Supabase.
Supabase is already configured in `supabase-config.js` (publishable key — safe to commit).

```bash
git clone https://github.com/Pushkar-Kamma/vshacks-2026.git
cd vshacks-2026
```

**Try it:** Start a session → open the same room on a second device via the QR/link →
tap **Add** on each → watch photos pool live → toggle **⭐ Best** to see the auto-curated set.

## 📁 Project structure

```
index.html          # screens (home, room) + modals (QR, loupe, selfie)
styles.css          # Lightroom-style dark theme
script.js           # app controller (wires everything together)
curate.js           # the automation: dHash de-dupe + sharpness "best" + moments
names.js            # random friendly identities (no sign-up)
store.js            # the ONLY file that talks to Supabase (rooms, storage, realtime)
faces.js            # optional "Photos of You" (face-api.js, on-device)
supabase-config.js  # backend URL + publishable key
```

## 🧠 How the automation works (for the video)
- **De-dupe:** each photo → a 64-bit "fingerprint" (dHash). Similar photos have close fingerprints, so we group them.
- **Best shot:** we score sharpness (edge strength) and star the sharpest in each group.
- **Moments:** photos are grouped by capture time; "Other angles" shows one moment from everyone's phones.
- **Photos of You:** an optional on-device face match against a selfie (deleted after).

## ✨ Nice touches
- **Auto-clean stat line** — "N pooled · B best kept · D tidied away" updates live (the automation, made visible).
- **Slideshow** (▶) — plays the current photos fullscreen with a gentle zoom; a perfect demo closer.
- **One-file ZIP download** — grabs everything on screen as a single `.zip`.
- **Live sync on every phone** — new photos appear for everyone within a few seconds, with a little "so-and-so added a photo" nudge.
- **Tap "You"** to reroll your color + name; sessions get fun auto names ("Rooftop Night").

## 🔓 Optional: unlock full-res Storage + instant realtime
The app **works out of the box** — if photo uploads to Supabase Storage are blocked,
it automatically embeds a smaller copy of the image in the database row instead, and
phones stay in sync by polling every few seconds. To get **full-resolution originals**
and **instant** push updates, paste this once into the Supabase **SQL editor**
(Dashboard → SQL) — the app upgrades itself automatically:

```sql
-- Let anyone with the room link upload + read photos in the 'photos' bucket
create policy "Candid anon upload" on storage.objects
  for insert to anon with check (bucket_id = 'photos');
create policy "Candid anon read" on storage.objects
  for select to anon using (bucket_id = 'photos');

-- Turn on instant live updates for the photos table
alter publication supabase_realtime add table public.photos;
```

## 👥 Team & workflow
We're 4 (2 UI, 2 code). See [CONTRIBUTING.md](CONTRIBUTING.md). Branch → PR → teammate merges → `main` auto-deploys.

## ⚠️ Known limitations / TODO (be honest in the demo)
- **Moments use file timestamps** (can be off for exported/imported photos) — test with the real demo phones.
- **Face matching** downloads ~12 MB of models and runs per-photo — use a small, tested photo set in the demo.
- **Security:** the demo Supabase policies are permissive (anyone with the key can read/write). Before real use, tighten them, add storage size/type limits, and reset the project. Room codes are for sharing, not privacy.
- **Without the SQL above**, shared images are a bit smaller (embedded in the row) and cross-phone sync is every ~4s instead of instant.

## ⚠️ AI usage rules (important!)

vsHacks **disqualifies** projects where AI generated the _entire_ project or _all_
the code. AI (Copilot, etc.) is allowed **only** for bug-fixing and small
snippet-level help — "like how you would use Stack Overflow." **We** design and
write the project, and each of us must be able to explain our code (the ≤5-minute
demo video is the biggest part of our score).

## ✅ Submission checklist

- [x] Public repo (this one) — code is open source
- [ ] Live website link works
- [ ] ≤5 min demo video (YouTube/Drive) that **explains the code**
- [ ] Paragraph describing the project (what it does + background)
- [ ] Paragraph on challenges & successes
- [ ] Submit on Devpost before the deadline (July 12)
