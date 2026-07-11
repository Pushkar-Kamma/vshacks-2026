# Copilot instructions — vsHacks 2026 project

## What this project is
- **Candid** — a group photo app for the vsHacks 2026 hackathon (theme: **Automation**).
- **Plain HTML, CSS, and JavaScript** (no framework, no build step) + **Supabase** (rooms, storage, realtime) loaded via CDN.
- Automation core: auto-pool everyone's photos, auto-group near-duplicates, star the sharpest, find "photos of you".
- A team of 4 high-school students (2 UI, 2 code) collaborating remotely. Keep everything approachable.

## The hackathon rule that shapes ALL AI use (important)
- vsHacks **disqualifies** projects whose code was entirely AI-generated, and every teammate must be able to explain their own code on a ≤5-minute demo video.
- So act as an **assistant / pair-programmer, not the sole author.** Prefer explaining and generating small, focused pieces the team can understand and modify. Do not dump large, opaque, or over-engineered solutions.

## Coding conventions
- Use **plain HTML, CSS, and vanilla JavaScript**. No frameworks, no build tools, no TypeScript.
- Files: `index.html` (screens), `styles.css` (dark theme), `script.js` (controller), `curate.js` (de-dupe/best/moments brain), `store.js` (all Supabase calls), `names.js` (identities), `faces.js` (optional face match), `supabase-config.js` (keys).
- Favor **simple and readable over clever** — the team has to explain it on video. Prefer plain `for` loops, `function` declarations, and clear names over dense one-liners.
- Use built-in browser APIs (`fetch`, `localStorage`, DOM methods). Avoid adding libraries unless clearly needed; explain any new one in the pull request.
- Match the existing file's style. Do not reformat or refactor unrelated code.
- After changing code, open `index.html` with the Live Server extension and check the browser console (F12) for errors before pushing.

## Security
- The Supabase key in `supabase-config.js` is the **publishable** key — safe to commit; it's protected by Row Level Security, not secrecy. **Never** put the secret `service_role` key in the client.
- RLS is **permissive for the demo** (anyone with the key can read/write). Keep policies to `SELECT`/`INSERT` and add storage limits before any real use.
- Validate/guard untrusted data (rows come from a public key), and never insert untrusted text with `innerHTML` — use `textContent` or create elements (avoid XSS).

## Git / collaboration
- Work on a branch, open a small pull request, and have a teammate review + merge to `main` (which auto-deploys to GitHub Pages). See `CONTRIBUTING.md`.
- Make small, frequent commits with clear messages.

## Great things to ask Copilot for
- Scaffolding an HTML section, wiring a `fetch` call, fixing a specific bug, explaining code, writing the README / Devpost text, or reviewing a diff.
