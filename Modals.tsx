import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Btn, Kbd, ProSlider, SegTabs, Tag } from "./ui";
import { IconCheck, IconDownload, IconGithub, IconKeyboard, IconSave, IconX } from "./Icons";

/* --------------------------------------------------------------- shell */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = 620,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fade-in absolute inset-0 backdrop-blur-[3px]" onClick={onClose} style={{ background: "rgba(4,5,7,.84)" }} />
      <div
        className="pop-in relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[10px] border border-line bg-panel shadow-[0_50px_120px_-40px_#000]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center gap-2.5 border-b border-line bg-base/60 px-4 py-3">
          {icon && <span className="text-amber">{icon}</span>}
          <div className="min-w-0">
            <h3 className="font-display text-[13px] font-semibold tracking-[0.06em] text-txt">{title}</h3>
            {subtitle && <p className="truncate text-[10.5px] text-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-[5px] border border-line text-dim transition-colors hover:border-flame/50 hover:text-flame"
          >
            <IconX width={12} height={12} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- export */

export type ExportOpts = {
  format: "image/png" | "image/jpeg" | "image/webp";
  quality: number;
  scale: number;
  filename: string;
};

export function ExportModal({
  open,
  onClose,
  name,
  imgW,
  imgH,
  onExport,
  onSaveProject,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  imgW: number;
  imgH: number;
  onExport: (o: ExportOpts) => void;
  onSaveProject: () => void;
  busy: boolean;
}) {
  const [format, setFormat] = useState<ExportOpts["format"]>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [filename, setFilename] = useState(`${name}-graded`);

  useEffect(() => {
    if (open) setFilename(`${name}-graded`);
  }, [name, open]);

  const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  const ow = Math.round(imgW * scale);
  const oh = Math.round(imgH * scale);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deliver / Export"
      subtitle="Render the full node chain at output resolution"
      icon={<IconDownload width={15} height={15} />}
      width={560}
    >
      <div className="space-y-4 p-4">
        <div>
          <Label>Format</Label>
          <SegTabs
            items={[
              { id: "image/png", label: "PNG · lossless" },
              { id: "image/jpeg", label: "JPEG" },
              { id: "image/webp", label: "WebP" },
            ]}
            value={format}
            onChange={(v) => setFormat(v as ExportOpts["format"])}
          />
        </div>

        {format !== "image/png" && (
          <div>
            <Label>Compression quality</Label>
            <ProSlider
              label="Quality"
              value={quality}
              min={0.4}
              max={1}
              step={0.01}
              def={0.92}
              digits={2}
              bipolar={false}
              onChange={setQuality}
            />
          </div>
        )}

        <div>
          <Label>Output size</Label>
          <div className="flex flex-wrap gap-1">
            {[0.25, 0.5, 1, 1.5, 2].map((s) => (
              <Btn key={s} size="sm" variant="outline" active={scale === s} onClick={() => setScale(s)}>
                {s === 1 ? "100%" : `${Math.round(s * 100)}%`}
              </Btn>
            ))}
          </div>
          <p className="mt-1.5 tabular font-mono text-[10px] text-dim">
            {ow} × {oh} px <span className="text-faint">· from {imgW}×{imgH}</span>
            {ow * oh > 24_000_000 && <span className="ml-2 text-flame">large render</span>}
          </p>
        </div>

        <div>
          <Label>File name</Label>
          <div className="flex items-center gap-2 rounded-[6px] border border-line bg-base/60 px-2.5 py-1.5 focus-within:border-amber/60">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-txt outline-none"
              spellCheck={false}
            />
            <span className="font-mono text-[11px] text-faint">.{ext}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Btn
            variant="solid"
            size="md"
            disabled={busy}
            onClick={() => onExport({ format, quality, scale, filename: `${filename.replace(/\.[^.]+$/, "")}.${ext}` })}
            icon={<IconDownload width={14} height={14} />}
            className={cn(busy && "sweep relative overflow-hidden")}
          >
            {busy ? "Rendering…" : "Render & download"}
          </Btn>
          <Btn variant="outline" size="md" onClick={onSaveProject} icon={<IconSave width={14} height={14} />}>
            Save project .json
          </Btn>
          <span className="ml-auto">
            <Tag tone="teal">GPU render</Tag>
          </span>
        </div>
      </div>
    </Modal>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 font-display text-[10px] font-semibold tracking-[0.16em] text-dim uppercase">
      {children}
    </p>
  );
}

/* ----------------------------------------------------------- shortcuts */

const KEYS: [string, string][] = [
  ["\\", "Toggle A/B compare wipe"],
  ["Y", "Hold / show original"],
  ["1 … 5", "Jump to tool node"],
  ["B", "Bypass current node"],
  ["R", "Reset current node"],
  ["0", "Reset entire grade"],
  ["F", "Fit image to viewer"],
  ["+ / −", "Zoom in / out"],
  ["Alt + drag", "Pan the viewer"],
  ["Ctrl/⌘ + Z", "Undo"],
  ["Ctrl/⌘ + ⇧ + Z", "Redo"],
  ["Ctrl/⌘ + E", "Export render"],
  ["Ctrl/⌘ + O", "Import images"],
  ["G / S", "Thirds grid / safe areas"],
  ["?", "This panel"],
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard & mouse"
      subtitle="Built for two-hand grading"
      icon={<IconKeyboard width={15} height={15} />}
      width={560}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-0 p-4 sm:grid-cols-2">
        {KEYS.map(([k, d], i) => (
          <div
            key={k}
            className={cn(
              "flex items-center gap-2.5 border-b border-line/60 py-[7px]",
              i < 2 && "border-t border-line/60 sm:border-t-0",
            )}
          >
            <span className="flex shrink-0 gap-1">
              {k.split(" ").map((part, j) =>
                part === "+" || part === "/" || part === "…" ? (
                  <span key={j} className="text-[10px] text-faint">
                    {part}
                  </span>
                ) : (
                  <Kbd key={j}>{part}</Kbd>
                ),
              )}
            </span>
            <span className="text-[11px] text-dim">{d}</span>
          </div>
        ))}
      </div>
      <p className="px-4 pb-4 text-[10.5px] text-faint">
        Sliders &amp; wheels: drag to adjust, <span className="text-dim">Shift</span> for fine steps,
        double-click to reset a single control.
      </p>
    </Modal>
  );
}

/* --------------------------------------------------------------- deploy */

type Step = { title: string; body: string; code?: string; note?: string };

const STEPS: Step[] = [
  {
    title: "লোকাল প্রজেক্ট রেডি করুন",
    body: "টার্মিনাল খুলে প্রজেক্ট ফোল্ডারে ঢুকে ডিপেন্ডেন্সি ইনস্টল করুন, তারপর একবার বিল্ড চালিয়ে নিশ্চিত হোন সবকিছু ঠিক আছে।",
    code: "npm install\nnpm run build\nnpm run preview",
    note: "preview চললে http://localhost:4173 এ অ্যাপ দেখা যাবে।",
  },
  {
    title: "GitHub-এ নতুন রিপোজিটরি",
    body: "github.com → New repository → নাম দিন (যেমন lumen-grade) → Public → Create। এরপর লোকাল ফোল্ডারকে গিট রিপো বানিয়ে পুশ করুন।",
    code: 'git init\ngit add .\ngit commit -m "feat: LUMEN Grade photo editor"\ngit branch -M main\ngit remote add origin https://github.com/<username>/lumen-grade.git\ngit push -u origin main',
  },
  {
    title: "GitHub Actions দিয়ে অটো ডিপ্লয়",
    body: "এই প্রজেক্টে .github/workflows/deploy.yml আগে থেকেই যোগ করা আছে — push করলেই GitHub Pages-এ বিল্ড পাবলিশ হয়ে যাবে। শুধু রিপো সেটিংস ঠিক করুন:",
    code: "Repo → Settings → Pages → Build and deployment → Source: GitHub Actions",
    note: "ব্যস! এরপর main ব্রাঞ্চে push করলেই Actions ট্যাবে বিল্ড চলবে।",
  },
  {
    title: "বেস পাথ (খুব জরুরি)",
    body: "রিপো নাম অনুযায়ী অ্যাপ সাব-পাথে সার্ভ হয়, তাই বিল্ডের সময় base ঠিক করে দিতে হয়। এটি vite.config.ts এডিট না করেই CLI দিয়ে করা যায়:",
    code: "npx vite build --base=/lumen-grade/",
    note: "workflow ফাইলে এই কমান্ডটিই সেট করা আছে — <REPO> জায়গায় আপনার রিপো নাম বসবে।",
  },
  {
    title: "ঘরোয়া বিকল্প: gh-pages প্যাকেজ",
    body: "Actions ব্যবহার না করতে চাইলে এক লাইনেই ডিপ্লয় করা যায়:",
    code: "npm i -D gh-pages\nnpx vite build --base=/lumen-grade/\nnpx gh-pages -d dist",
    note: "তখন Settings → Pages → Source: Deploy from a branch → gh-pages / root।",
  },
  {
    title: "লাইভ URL ও কাস্টম ডোমেইন",
    body: "ডিপ্লয় শেষ হলে সাইট লাইভ হবে এই ঠিকানায়। নিজের ডোমেইন যুক্ত করতে চাইলে repo-তে CNAME ফাইল দিন।",
    code: "https://<username>.github.io/lumen-grade/\n# custom domain:\necho grade.example.com > public/CNAME",
  },
  {
    title: "পরবর্তী আপডেট",
    body: "কোড বদলালে শুধু কমিট ও পুশ — বাকিটা Actions নিজেই করে দেবে।",
    code: 'git add .\ngit commit -m "update: new look pack"\ngit push',
  },
];

export function DeployModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(-1);
  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(-1), 1600);
    } catch {
      setCopied(-1);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="GitHub Pages-এ পাবলিশ — ধাপে ধাপে"
      subtitle="LUMEN Grade deploy guide · zero backend needed"
      icon={<IconGithub width={16} height={16} />}
      width={680}
    >
      <div className="space-y-2.5 p-4">
        {STEPS.map((st, i) => (
          <div
            key={i}
            className="rise-in overflow-hidden rounded-[8px] border border-line bg-base/45"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div className="flex items-start gap-2.5 px-3 pt-2.5">
              <span className="mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] border border-amber/40 bg-amber/10 font-mono text-[10px] text-amber">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-display text-[12px] font-semibold tracking-wide text-txt">{st.title}</h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-dim">{st.body}</p>
              </div>
            </div>
            {st.code && (
              <div className="group relative mx-3 mt-2 overflow-hidden rounded-[6px] border border-line bg-[#080a0d]">
                <pre className="overflow-x-auto px-3 py-2 font-mono text-[10.5px] leading-[1.65] text-teal/90">
                  {st.code}
                </pre>
                <button
                  type="button"
                  onClick={() => copy(st.code!, i)}
                  className={cn(
                    "absolute top-1.5 right-1.5 flex h-[20px] items-center gap-1 rounded-[4px] border px-1.5 font-mono text-[9px] tracking-wider uppercase transition-all",
                    copied === i
                      ? "border-lime/50 bg-lime/12 text-lime"
                      : "border-line2 bg-panel text-faint opacity-0 group-hover:opacity-100 hover:text-txt",
                  )}
                >
                  {copied === i ? <IconCheck width={10} height={10} /> : null}
                  {copied === i ? "copied" : "copy"}
                </button>
              </div>
            )}
            {st.note && (
              <p className="px-3 pt-1.5 pb-2.5 text-[10px] text-faint">
                <span className="mr-1 text-amber">›</span>
                {st.note}
              </p>
            )}
          </div>
        ))}
        <div className="rounded-[8px] border border-teal/25 bg-teal/6 p-3">
          <p className="font-display text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">
            কেন এটি স্ট্যাটিক সাইট?
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-dim">
            সম্পূর্ণ এডিটর ব্রাউজারের WebGL-এ চলে — কোনো সার্ভার বা ডেটাবেস লাগে না। তাই GitHub Pages,
            Netlify, Cloudflare Pages, Vercel — যেকোনো স্ট্যাটিক হোস্টেই হুবহু একইভাবে কাজ করবে।
          </p>
        </div>
      </div>
    </Modal>
  );
}
