# Contributing & Team Workflow 🤝

We're 3 people in different places building over ~2 days. This keeps us from
stepping on each other's work.

## 🌳 Branch + Pull Request workflow

**Don't commit straight to `main`** for anything non-trivial. `main` is our
"always working" branch and it **auto-deploys to the live site**.

1. **Get the latest:**
   ```bash
   git checkout main
   git pull
   ```
2. **Make a branch** named `yourname/what-youre-doing`:
   ```bash
   git checkout -b alex/login-page
   ```
3. **Work, then save + upload your changes:**
   ```bash
   git add .
   git commit -m "Add login page layout"
   git push -u origin alex/login-page
   ```
4. **Open a Pull Request (PR)** on GitHub (a "Compare & pull request" button
   appears). Write a sentence about what you did.
5. **A teammate reviews and clicks Merge.** Done — the live site updates on its own.

### Keeping your branch fresh
If `main` changed while you were working:
```bash
git checkout main
git pull
git checkout your-branch
git merge main
```
Fix anything VS Code highlights as a conflict, then commit.

## 📱 Working from your phone (during work hours)

You can contribute **legitimately** without a laptop:

- **GitHub mobile app** — review and **merge Pull Requests**, comment, manage
  Issues, and make small file edits. Best for keeping teammates unblocked.
- **github.dev** — open the repo in a browser and press <kbd>.</kbd> (or change
  `github.com` → `github.dev` in the URL) for a lightweight VS Code editor.
  Great for small edits + commit.
- **GitHub Codespaces** — a full VS Code in the browser (works on a phone too).
  Tap **Code ▸ Codespaces ▸ Create codespace**, then open `index.html` with the
  Live Server extension and use the forwarded port.

**A split that works well:** the two teammates on laptops write most of the code;
the phone person reviews PRs, writes the README / Devpost text, tracks the
submission checklist, and makes small fixes. That split also keeps us inside the
hackathon's AI rules (see below).

## 🤖 AI usage — stay eligible!

vsHacks **disqualifies** projects where AI generated the *entire* project or *all*
the code. AI (Copilot, etc.) is allowed **only** for bug-fixing and small
snippet-level help — "like how you would use Stack Overflow." **We** design and
write the project, and each of us must be able to explain our code, because the
≤5-minute demo video is the biggest part of our score.

## 💬 Communication
- Keep the team chat open (Discord DMs / group chat).
- Say what you're working on so two people don't build the same thing.
- Small, frequent PRs beat one giant PR at the end.

## 🎨 Style
- Keep it simple and readable — we each have to explain our code on video.
- Before pushing, open the page and check the browser console (F12) has no errors.
