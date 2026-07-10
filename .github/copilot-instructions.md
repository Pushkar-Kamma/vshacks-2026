# Copilot instructions — vsHacks 2026 project

## What this project is
- A **React 19 + Vite** web app in **plain JavaScript** (no TypeScript) for the vsHacks 2026 hackathon.
- A team of 3 high-school students collaborating remotely. Keep everything approachable.

## The hackathon rule that shapes ALL AI use (important)
- vsHacks **disqualifies** projects whose code was entirely AI-generated, and every teammate must be able to explain their own code on a ≤5-minute demo video.
- So act as an **assistant / pair-programmer, not the sole author.** Prefer explaining and generating small, focused pieces the team can understand and modify. Do not dump large, opaque, or over-engineered solutions.

## Coding conventions
- Use **plain JavaScript** and **basic React** (function components + hooks). No TypeScript, no class components.
- Favor **simple and readable over clever** — the team has to explain it on video. Prefer plain loops and clear names over dense one-liners.
- Keep components small. Put shared styles in `src/App.css` / `src/index.css`.
- Avoid adding dependencies unless clearly needed; prefer built-in `fetch` and the standard library. Explain any new dependency in the pull request.
- Match the existing file's style. Do not reformat or refactor unrelated code.
- After changing code, run `npm run lint` and `npm run build` to catch errors before pushing.

## Security
- **Never hardcode secrets or API keys.** Anything prefixed `VITE_` is compiled into the public browser bundle, so it is NOT secret. Use `.env` only for non-secret client config (it just keeps values out of Git). For a real secret, call it from a small backend/proxy — never directly from the React app.
- Validate user input and never inject untrusted HTML.

## Git / collaboration
- Work on a branch, open a small pull request, and have a teammate review + merge to `main` (which auto-deploys to GitHub Pages). See `CONTRIBUTING.md`.
- Make small, frequent commits with clear messages.

## Great things to ask Copilot for
- Scaffolding a component, wiring an API call, fixing a specific bug, explaining code, writing the README / Devpost text, or reviewing a diff.
