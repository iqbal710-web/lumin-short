# LUMEN Grade — professional color & photo editor (browser based)

DaVinci Resolve অনুপ্রাণিত একটি **নোড-বেইজড কালার গ্রেডিং স্যুট**, যা সম্পূর্ণ ব্রাউজারে (WebGL2 + React) চলে।
কোনো সার্ভার, ডেটাবেস বা ইনস্টলেশন লাগে না — শুধু স্ট্যাটিক হোস্টিং।

![stack](https://img.shields.io/badge/React_19-61dafb) ![vite](https://img.shields.io/badge/Vite_7-646cff) ![tailwind](https://img.shields.io/badge/Tailwind_4-38bdf8) ![webgl2](https://img.shields.io/badge/WebGL2-F5A524)

---

## ✨ ফিচার

| অংশ | কী আছে |
| --- | --- |
| **Node pipeline** | ৫টি সিরিয়াল নোড — Primary · Wheels · Curves · Split Tone · FX। প্রতিটি নোড আলাদাভাবে bypass / reset করা যায় |
| **Primary bars** | Exposure (EV), Contrast + Pivot, Highlights, Shadows, Whites, Blacks, Temperature, Tint, Vibrance, Saturation |
| **Color wheels** | Lift / Gamma / Gain / Offset — ASC CDL স্টাইল, প্রতিটিতে master স্লাইডার |
| **Custom curves** | Monotone cubic spline, Master/R/G/B চ্যানেল, পয়েন্ট add-drag-delete, পেছনে লাইভ luma histogram |
| **Split toning** | Shadow + Highlight hue wheel ও amount |
| **FX** | Sharpen (unsharp mask), Defocus, Chromatic aberration, Glow/Bloom + threshold, Vignette, Film grain, Grade mix |
| **Scopes** | RGB Histogram, RGB Parade, Luma Waveform, Vectorscope (Cb/Cr গ্র্যাটিকিউল + skin tone line), clip warning |
| **Viewer** | Zoom 6%–1200%, pan, fit, 1:1, thirds grid, safe areas, **A/B compare wipe**, hold-to-see-original |
| **Look library** | ১০টি রেডি লুক — hover করলেই লাইভ প্রিভিউ, ক্লিক করলে tween সহ অ্যাপ্লাই |
| **Timeline** | একাধিক ক্লিপ, প্রতিটির নিজস্ব গ্রেড, থাম্বনেইল ফিল্মস্ট্রিপ |
| **Workflow** | Undo/Redo (৫০ স্টেপ), drag & drop ইমপোর্ট, প্রজেক্ট `.json` সেভ/লোড, PNG-JPEG-WebP এক্সপোর্ট (২৫%–২০০% স্কেল) |
| **Shortcuts** | `\` compare · `Y` original · `1-5` নোড · `B` bypass · `R` reset node · `0` reset all · `F` fit · `Ctrl+E` export |

---

## 🚀 লোকালে চালানো

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ তৈরি হয়
npm run preview    # বিল্ড প্রিভিউ
```

---

## 🐙 GitHub Pages-এ পাবলিশ (ধাপে ধাপে)

### ধাপ ১ — রিপোজিটরি তৈরি
GitHub → **New repository** → নাম `lumen-grade` → **Public** → Create।

### ধাপ ২ — কোড পুশ
```bash
git init
git add .
git commit -m "feat: LUMEN Grade photo editor"
git branch -M main
git remote add origin https://github.com/<username>/lumen-grade.git
git push -u origin main
```

### ধাপ ৩ — Pages সেটিংস
Repo → **Settings → Pages → Build and deployment → Source: `GitHub Actions`**

### ধাপ ৪ — অটো ডিপ্লয়
`.github/workflows/deploy.yml` আগে থেকেই যোগ করা আছে। এটি:
1. Node 20 সেটআপ করে
2. `npx vite build --base=/<repo-name>/` চালায় (সাব-পাথ ঠিক রাখতে base জরুরি)
3. `dist/` ফোল্ডার GitHub Pages-এ আপলোড করে

`main` ব্রাঞ্চে push করলেই **Actions** ট্যাবে বিল্ড চলবে, শেষে সাইট লাইভ:
```
https://<username>.github.io/lumen-grade/
```

### বিকল্প — `gh-pages` প্যাকেজ দিয়ে
```bash
npm i -D gh-pages
npx vite build --base=/lumen-grade/
npx gh-pages -d dist
```
তখন Settings → Pages → Source: **Deploy from a branch** → `gh-pages` / `/ (root)`।

### কাস্টম ডোমেইন
```bash
echo "grade.example.com" > public/CNAME
```
DNS-এ `CNAME → <username>.github.io` রেকর্ড যোগ করুন।

---

## 🗂 প্রজেক্ট স্ট্রাকচার

```
src/
├─ editor/
│  ├─ engine.ts      # WebGL2 গ্রেডিং ইঞ্জিন (শেডার + LUT + এক্সপোর্ট)
│  ├─ curves.ts      # monotone cubic spline → 256×4 LUT
│  ├─ scopes.ts      # পিক্সেল অ্যানালাইসিস (hist/parade/wave/vectorscope)
│  ├─ types.ts       # Adjustments মডেল, নোড, লুক প্রিসেট
│  └─ project.ts     # মিডিয়া লোড, থাম্বনেইল, .json সেভ
├─ components/
│  ├─ Viewer.tsx     # ক্যানভাস, zoom/pan, compare wipe, overlay
│  ├─ ToolDock.tsx   # ডান প্যানেলের সব টুল
│  ├─ LeftDock.tsx   # মিডিয়া পুল + লুক লাইব্রেরি
│  ├─ ColorWheel.tsx # ড্র্যাগেবল হুইল
│  ├─ CurvesEditor.tsx
│  ├─ Timeline.tsx   # নোড স্ট্রিপ + ফিল্মস্ট্রিপ
│  ├─ Scopes.tsx
│  ├─ Modals.tsx     # export / shortcuts / deploy guide
│  └─ ui.tsx         # স্লাইডার, ট্যাব, বাটন, টগল
└─ App.tsx           # স্টেট, হিস্ট্রি, শর্টকাট, লেআউট
```

## ⚙️ গ্রেডিং পাইপলাইন (শেডার অর্ডার)

```
source → chroma shift → defocus → unsharp
       → exposure → white balance
       → lift / gamma / gain / offset (CDL)
       → shadows·highlights·whites·blacks → contrast(pivot)
       → curves LUT (master + RGB)
       → split toning → vibrance → saturation
       → bloom → vignette → grain → grade mix → output
```

## 📝 লাইসেন্স
MIT — ইচ্ছেমতো ব্যবহার, ফর্ক ও মডিফাই করুন।
