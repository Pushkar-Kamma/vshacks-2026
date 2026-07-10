# vsHacks 2026 🚀

Our team's project for **[vsHacks 2026](https://vshacks-2026.devpost.com/)** — a
global, beginner-friendly virtual hackathon (July 11–12, 2026). Built with
**React + Vite**.

- 🌐 **Live site:** https://pushkar-kamma.github.io/vshacks-2026/ (auto-deploys from `main`)
- 🏆 **Devpost:** https://vshacks-2026.devpost.com/
- 💬 **Discord:** https://discord.gg/fFagbFh45c
- 🗓️ **Theme:** _TBD — announced at the opening ceremony._ Update this README once we pick our idea!

---

## 🚀 Quick start

You need [Node.js](https://nodejs.org/) 20.19+ or 22.12+ installed.

```bash
git clone https://github.com/Pushkar-Kamma/vshacks-2026.git
cd vshacks-2026
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173/). Edit `src/App.jsx`
and the page updates instantly.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server (hot reload) |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Check the code with Oxlint |

## 📁 Project structure

```
vshacks-2026/
├─ public/            # static files served as-is
├─ src/
│  ├─ App.jsx         # main component — START HERE
│  ├─ App.css         # styles for App
│  ├─ main.jsx        # app entry point
│  └─ index.css       # global styles
├─ index.html         # HTML shell
├─ vite.config.js     # Vite config (base is './' for GitHub Pages)
└─ package.json
```

## 👥 Team & how we work

We're a team of 3 collaborating remotely. **Read [CONTRIBUTING.md](CONTRIBUTING.md)
for the full git workflow** (branches, pull requests, and how to work from your
phone).

TL;DR:
1. `git pull` to get the latest.
2. Make a branch: `git checkout -b yourname/feature`.
3. Commit + push, then open a **Pull Request** on GitHub.
4. A teammate reviews & merges into `main`. `main` auto-deploys to the live site.

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
