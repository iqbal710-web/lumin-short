import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, Info, Keyboard, X, Rocket, TriangleAlert } from 'lucide-react';
import type { ModalId } from '../types';
import { GithubMark, IconBtn, Kbd, Logo } from './ui';
import { cn } from '../utils/cn';

function ModalShell({ title, icon, onClose, children, wide }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cn('animate-in flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-xl')}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-100">
            {icon}
            {title}
          </h2>
          <IconBtn title="Close (Esc)" onClick={onClose}>
            <X size={16} />
          </IconBtn>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mt-2 overflow-hidden rounded-lg bg-ink-950 ring-1 ring-ink-650">
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-[11.5px] leading-relaxed text-emerald-200">{code}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-ink-700 px-2 py-1 text-[10px] text-ink-200 ring-1 ring-ink-600 transition hover:bg-ink-600"
      >
        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / Redo'],
  ['Alt + S', 'Add serial node'],
  ['Ctrl + D', 'Enable / disable selected node'],
  ['Delete', 'Delete selected node'],
  ['Shift + D', 'Bypass all grades (show original)'],
  ['W', 'Split wipe before / after'],
  ['H', 'Show highlight / shadow clipping'],
  ['C', 'Crop tool (Enter = done)'],
  ['R / Shift + R', 'Rotate 90° right / left'],
  ['F', 'Cinema viewer'],
  ['↑ / ↓', 'Previous / next clip'],
  ['1 – 5', 'Wheels · Curves · Adjust · Effects · Sizing'],
  ['Ctrl + C / Ctrl + V', 'Copy / paste grade between images'],
  ['Ctrl + Alt + G', 'Grab still to gallery'],
  ['Ctrl + O', 'Import images'],
  ['Ctrl + E', 'Quick export current image'],
  ['Mouse wheel / drag', 'Zoom / pan the viewer'],
  ['Double-click a control', 'Reset it to default'],
  ['Shift + drag', 'Fine adjustment on wheels & scrubbers'],
  ['?', 'This help'],
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Keyboard shortcuts" icon={<Keyboard size={16} className="text-accent" />} onClose={onClose}>
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-ink-700/60 py-1.5">
            <span className="text-[12px] text-ink-300">{d}</span>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              {k.split(' / ').map((part) => (
                <Kbd key={part}>{part}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

export const WORKFLOW_YAML = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build -- --base=./
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="relative flex gap-3.5 pb-5">
      <div className="flex flex-col items-center">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-accent-2 to-accent text-[12px] font-bold text-white shadow-[0_4px_12px_-3px_rgba(255,107,61,0.7)]">
          {n}
        </div>
        <div className="mt-1 w-px flex-1 bg-ink-650" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="text-[13.5px] font-semibold text-ink-100">{title}</h3>
        <div className="mt-1 space-y-1.5 text-[12.5px] leading-relaxed text-ink-300">{children}</div>
      </div>
    </div>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent-2 underline-offset-2 hover:underline">
    {children}
    <ExternalLink size={10} />
  </a>
);

function GithubGuideModal({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState('YOUR-USERNAME');
  const [repo, setRepo] = useState('chroma-studio');
  const u = user.trim() || 'YOUR-USERNAME';
  const r = repo.trim().replace(/\s+/g, '-') || 'chroma-studio';
  const site = `https://${u}.github.io/${r}/`;

  return (
    <ModalShell title="Deploy this website to GitHub Pages: step by step" icon={<GithubMark size={16} />} onClose={onClose} wide>
      <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-3.5 text-[12.5px] leading-relaxed text-ink-200">
        <b className="text-ink-100">Free hosting with GitHub Pages.</b> Ei guide follow korle 10–15 minute er moddhe apnar photo editor website live hoye jabe. Niche nijer
        GitHub username ar repository name likhun, commands gulo automatic update hobe.
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-ink-300">
            GitHub username
            <input value={user} onChange={(e) => setUser(e.target.value)} className="mt-1 h-8 w-full rounded-md bg-ink-950 px-2 font-mono text-[12px] text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent/60" />
          </label>
          <label className="text-[11px] text-ink-300">
            Repository name
            <input value={repo} onChange={(e) => setRepo(e.target.value)} className="mt-1 h-8 w-full rounded-md bg-ink-950 px-2 font-mono text-[12px] text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent/60" />
          </label>
        </div>
      </div>

      <Step n={1} title="Install the tools (one time only)">
        <p>
          Install <A href="https://nodejs.org">Node.js (LTS)</A> and <A href="https://git-scm.com/downloads">Git</A>, and create a free account at <A href="https://github.com/signup">github.com</A>. Then open a terminal (Windows: PowerShell) and check:
        </p>
        <CodeBlock code={`node -v\nnpm -v\ngit --version`} />
      </Step>

      <Step n={2} title="Get the project code on your computer">
        <p>
          Download this project as a <b>ZIP</b> from the builder (Download / Export code), extract it, and open the folder in <A href="https://code.visualstudio.com">VS Code</A>. Open the terminal <b>inside the project folder</b> (VS Code → Terminal → New Terminal).
        </p>
      </Step>

      <Step n={3} title="Test it locally">
        <CodeBlock code={`npm install\nnpm run dev`} />
        <p>
          Open <span className="font-mono text-ink-100">http://localhost:5173</span> in the browser. If the editor works, press <Kbd>Ctrl + C</Kbd> in the terminal to stop it.
        </p>
      </Step>

      <Step n={4} title="Create a new repository on GitHub">
        <p>
          On GitHub click <b>+</b> (top-right) → <b>New repository</b>. Name it <span className="font-mono text-ink-100">{r}</span>, choose <b>Public</b>, and do <b>not</b> tick "Add a README". Then click <b>Create repository</b>.
        </p>
      </Step>

      <Step n={5} title="Tell Git who you are (first time only)">
        <CodeBlock code={`git config --global user.name "Your Name"\ngit config --global user.email "you@example.com"`} />
      </Step>

      <Step n={6} title="Upload (push) the code to GitHub">
        <CodeBlock
          code={`git init\ngit add .\ngit commit -m "Initial commit: Chroma Studio photo editor"\ngit branch -M main\ngit remote add origin https://github.com/${u}/${r}.git\ngit push -u origin main`}
        />
        <p>
          If Git asks you to log in, choose <b>Sign in with your browser</b>. If it asks for a password, paste a <b>Personal Access Token</b> instead (GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → tick <span className="font-mono">repo</span>).
        </p>
      </Step>

      <Step n={7} title="Turn on GitHub Pages">
        <p>
          In your repository open <b>Settings</b> → <b>Pages</b>. Under <b>Build and deployment</b> → <b>Source</b>, select <b className="text-accent-2">GitHub Actions</b>.
        </p>
        <p>
          This project already contains <span className="font-mono text-ink-100">.github/workflows/deploy.yml</span>, so GitHub builds and publishes the site automatically. (If the file is missing, create it with <b>Add file → Create new file</b> and paste this:)
        </p>
        <details className="rounded-lg bg-ink-900 p-2 ring-1 ring-ink-650">
          <summary className="cursor-pointer text-[12px] text-ink-200">Show deploy.yml</summary>
          <CodeBlock code={WORKFLOW_YAML} />
        </details>
      </Step>

      <Step n={8} title="Wait for the green check ✓">
        <p>
          Open the <b>Actions</b> tab. The workflow "Deploy to GitHub Pages" runs for about 1–3 minutes. When it shows a green ✓ your site is live.
        </p>
      </Step>

      <Step n={9} title="Open your live website 🎉">
        <a href={site} target="_blank" rel="noreferrer" className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-ink-950 px-3 py-2.5 font-mono text-[12.5px] text-emerald-300 ring-1 ring-emerald-500/30 hover:ring-emerald-400/60">
          {site}
          <ExternalLink size={13} />
        </a>
      </Step>

      <Step n={10} title="Update the site later">
        <p>Make your changes, then run these three commands. Every push redeploys automatically.</p>
        <CodeBlock code={`git add .\ngit commit -m "Update photo editor"\ngit push`} />
      </Step>

      <div className="mt-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-200">
          <TriangleAlert size={14} /> Troubleshooting
        </div>
        <ul className="list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-ink-300">
          <li>
            <b>404 page</b>: check that Settings → Pages → Source is set to "GitHub Actions", then wait 2–5 minutes.
          </li>
          <li>
            <b>Blank page</b>: keep <span className="font-mono">npm run build -- --base=./</span> in the workflow (already set), so it works in any repo name.
          </li>
          <li>
            <b>Action failed</b>: open the failed run in the Actions tab to read the log, and make sure <span className="font-mono">package-lock.json</span> was pushed.
          </li>
          <li>
            <b>push rejected</b>: run <span className="font-mono">git pull origin main --rebase</span> and then <span className="font-mono">git push</span>.
          </li>
          <li>
            <b>No terminal?</b> On GitHub use <b>Add file → Upload files</b>, drag in every file except <span className="font-mono">node_modules</span> and <span className="font-mono">dist</span>, then do Steps 7–9.
          </li>
          <li>
            <b>Custom domain</b>: Settings → Pages → Custom domain (e.g. <span className="font-mono">photo.yourname.com</span>).
          </li>
        </ul>
      </div>
    </ModalShell>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  const features = [
    'Serial node graph like DaVinci Resolve (enable, reorder by adding, key mix)',
    'Lift / Gamma / Gain / Offset color wheels with master jog wheels',
    'Primaries: temperature, tint, contrast + pivot, mid-detail, color boost',
    'Custom Y/R/G/B curves + Hue vs Hue / Sat / Lum curves',
    'Real 3D LUT support: import .cube, export your grade as .cube',
    'Scopes: RGB parade, waveform, vectorscope, histogram',
    'Crop with aspect presets, straighten, rotate & flip',
    'Vignette, film grain, sharpen, clarity and blur',
    'Before/after wipe, bypass, clipping warnings, pixel probe',
    'Gallery stills, copy/paste grades, unlimited undo',
    'Full-resolution JPEG / PNG / WebP export + batch ZIP',
  ];
  return (
    <ModalShell title="About Chroma Studio" icon={<Info size={16} className="text-accent" />} onClose={onClose}>
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="text-[16px] font-semibold text-ink-100">Chroma Studio 1.0</div>
          <div className="text-[12px] text-ink-400">A professional color grading photo editor that runs in your browser.</div>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">
        Every pixel is processed on your GPU with WebGL2 in a 16-bit floating-point pipeline. Your photos never leave your computer. Inspired by the DaVinci Resolve color page.
      </p>
      <ul className="mt-3 grid gap-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-ink-200">
            <Check size={13} className="mt-0.5 shrink-0 text-accent" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-ink-900 p-3 text-[11.5px] text-ink-400 ring-1 ring-ink-650">
        <Rocket size={14} className="text-accent" /> Built with React, TypeScript, Tailwind CSS, Vite & WebGL2.
      </div>
    </ModalShell>
  );
}

export function Modals({ modal, onClose }: { modal: ModalId | null; onClose: () => void }) {
  if (modal === 'shortcuts') return <ShortcutsModal onClose={onClose} />;
  if (modal === 'github') return <GithubGuideModal onClose={onClose} />;
  if (modal === 'about') return <AboutModal onClose={onClose} />;
  return null;
}
