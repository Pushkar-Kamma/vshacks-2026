# Copilot instructions — vsHacks 2026 project

## What this project is
- A **plain HTML, CSS, and JavaScript** website (no framework, no build step) for the vsHacks 2026 hackathon.
- Theme: **Automation** — solve a real, repetitive problem the team actually has.
- A team of 3 high-school students collaborating remotely. Keep everything approachable.

## The hackathon rule that shapes ALL AI use (important)
- vsHacks **disqualifies** projects whose code was entirely AI-generated, and every teammate must be able to explain their own code on a ≤5-minute demo video.
- So act as an **assistant / pair-programmer, not the sole author.** Prefer explaining and generating small, focused pieces the team can understand and modify. Do not dump large, opaque, or over-engineered solutions.

## Coding conventions
- Use **plain HTML, CSS, and vanilla JavaScript**. No frameworks, no build tools, no TypeScript.
- Structure: `index.html` (markup), `styles.css` (looks), `script.js` (behavior). Add more small files only when a page clearly needs them.
- Favor **simple and readable over clever** — the team has to explain it on video. Prefer plain `for` loops, `function` declarations, and clear names over dense one-liners.
- Use built-in browser APIs (`fetch`, `localStorage`, DOM methods). Avoid adding libraries unless clearly needed; explain any new one in the pull request.
- Match the existing file's style. Do not reformat or refactor unrelated code.
- After changing code, open `index.html` with the Live Server extension and check the browser console (F12) for errors before pushing.

## Security
- **Never hardcode secrets or API keys.** This is a static site with no backend, so ANY key in the JavaScript is public to anyone who views the page. For a real secret, put it behind a small backend/proxy instead of calling the API directly from the browser.
- Validate user input, and never insert untrusted text with `innerHTML` (use `textContent` or create elements) to avoid XSS.

## Git / collaboration
- Work on a branch, open a small pull request, and have a teammate review + merge to `main` (which auto-deploys to GitHub Pages). See `CONTRIBUTING.md`.
- Make small, frequent commits with clear messages.

## Great things to ask Copilot for
- Scaffolding an HTML section, wiring a `fetch` call, fixing a specific bug, explaining code, writing the README / Devpost text, or reviewing a diff.
