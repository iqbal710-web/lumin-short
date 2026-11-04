# 🎨 Chroma Studio: Professional Photo Color Grading in the Browser

A **DaVinci Resolve-inspired** photo editor built with **React + TypeScript + Tailwind CSS + WebGL2**.
Every pixel is processed on your GPU in a 16-bit floating-point pipeline. Photos never leave your computer.

![Made with React](https://img.shields.io/badge/React-19-61dafb) ![WebGL2](https://img.shields.io/badge/WebGL-2.0-ff6b3d) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

| Area | What you get |
| --- | --- |
| **Node graph** | Serial nodes like Resolve: add (Alt+S), enable/disable (Ctrl+D), delete, rename, key-output mix, per-node LUT |
| **Color wheels** | Lift · Gamma · Gain · Offset with master jog wheels and YRGB readouts |
| **Primaries** | Temperature, tint, exposure, contrast + pivot, mid-detail, color boost, shadows, highlights, whites, blacks, saturation, hue, fade |
| **Curves** | Custom Y / R / G / B curves + Hue vs Hue, Hue vs Sat, Hue vs Lum |
| **LUTs** | Import real 3D `.cube` LUTs; export your whole grade as a 33³ `.cube` for Resolve / Premiere |
| **Looks** | 16 built-in looks (Teal & Orange, Film Print 2383, Bleach Bypass, Noir, Cyberpunk…) with live previews |
| **Scopes** | RGB Parade, Waveform, Vectorscope (with skin-tone line), Histogram, all live |
| **Sizing** | Crop with aspect presets (1:1, 4:5, 16:9, 2.39 Scope…), straighten, rotate, flip |
| **Effects** | Sharpen, clarity, blur, vignette, film grain, split toning |
| **Viewer** | Before/after wipe, bypass, clipping warnings, pixel probe, zoom & pan, cinema mode |
| **Workflow** | Unlimited undo/redo, gallery stills, copy/paste grades between photos, save/load `.json` grades |
| **Deliver** | Full-resolution JPEG / PNG / WebP export, resolution scaling, batch render to ZIP |

## 🚀 Run locally

```bash
npm install
npm run dev        # open http://localhost:5173
npm run build      # production build → dist/index.html
```

---

## 🌍 Deploy to GitHub Pages (step by step)

> A copy of this guide is also inside the app: **Help → Deploy to GitHub** (or the **Deploy guide** button at the top).

### Step 1: Install the tools (one time)
- [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com/downloads), and a free [GitHub account](https://github.com/signup)
- Check them in a terminal:
  ```bash
  node -v
  npm -v
  git --version
  ```

### Step 2: Open the project folder
Download / extract the project, open the folder in VS Code, then open **Terminal → New Terminal**.

### Step 3: Test locally
```bash
npm install
npm run dev
```
Open http://localhost:5173. If it works, stop it with `Ctrl + C`.

### Step 4: Create a repository on GitHub
GitHub → **+** → **New repository** → name: `chroma-studio` → **Public** → do **not** add a README → **Create repository**.

### Step 5: Tell Git who you are (first time only)
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Step 6: Push the code
```bash
git init
git add .
git commit -m "Initial commit: Chroma Studio photo editor"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/chroma-studio.git
git push -u origin main
```
If Git asks for a password, use **Sign in with browser** or a **Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → `repo`).

### Step 7: Enable GitHub Pages
Repository → **Settings** → **Pages** → *Build and deployment* → **Source: GitHub Actions**.

The workflow file [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is already included.
It installs, builds (`npm run build -- --base=./`) and publishes the site on every push to `main`.

### Step 8: Wait for the green ✓
Open the **Actions** tab. The workflow "Deploy to GitHub Pages" takes about 1–3 minutes.

### Step 9: Visit your website 🎉
```
https://YOUR-USERNAME.github.io/chroma-studio/
```

### Step 10: Update later
```bash
git add .
git commit -m "Update photo editor"
git push
```
Every push redeploys automatically.

### 🛠 Troubleshooting
| Problem | Fix |
| --- | --- |
| 404 page | Settings → Pages → Source must be **GitHub Actions**; wait 2–5 minutes |
| Blank page | Keep `--base=./` in the build step of the workflow |
| Action failed | Open the run in the **Actions** tab to read the log; make sure `package-lock.json` is committed |
| `git push` rejected | `git pull origin main --rebase` then `git push` |
| No terminal | GitHub → **Add file → Upload files** (everything except `node_modules` and `dist`), then do Steps 7–9 |

---

### 🇧🇩 Bangla quick guide (সংক্ষেপে)
1. Node.js, Git install korun, GitHub account khulun.
2. Project folder e terminal open kore `npm install` → `npm run dev` diye test korun.
3. GitHub e **New repository** banan (Public, README chara).
4. Upore **Step 6** er command gulo diye code push korun.
5. Repository → **Settings → Pages → Source: GitHub Actions** select korun.
6. **Actions** tab e green ✓ asha porjonto wait korun (1-3 minute).
7. Apnar website: `https://YOUR-USERNAME.github.io/chroma-studio/` 🎉
8. Pore change korle: `git add .` → `git commit -m "update"` → `git push`. Automatic update hoye jabe!

---

## ⌨️ Keyboard shortcuts
`Alt+S` add node · `Ctrl+D` toggle node · `Shift+D` bypass · `W` wipe · `H` clipping · `C` crop · `R` rotate ·
`F` cinema · `↑/↓` clips · `1–5` palettes · `Ctrl+C / Ctrl+V` copy/paste grade · `Ctrl+Alt+G` grab still ·
`Ctrl+E` export · `Ctrl+Z / Ctrl+Shift+Z` undo/redo

## 🧱 Project structure
```
src/
  gl/            WebGL2 renderer + GLSL shaders (node pass, finishing pass)
  lib/           grading math, curves, transforms, scopes, LUT (.cube) parser, export
  components/    Viewer, NodeEditor, Wheels, Curves, Scopes, Media / Color / Deliver pages
  state/         editor context
  App.tsx        app state, history, shortcuts, file import/export
.github/workflows/deploy.yml   GitHub Pages deployment
```

## 📄 License
MIT. Use it, change it, ship it.
