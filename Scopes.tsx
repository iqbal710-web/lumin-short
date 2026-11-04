import { useEffect, useMemo, useRef, useState } from "react";
import { ANGLE_BINS, COLS, RAD_BINS, type ScopeData } from "@/editor/scopes";
import { SegTabs } from "./ui";
import { IconChart, IconScope, IconSliders, IconWave } from "./Icons";

type Mode = "hist" | "parade" | "wave" | "vector";

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "hist", label: "Hist", icon: <IconChart width={11} height={11} /> },
  { id: "parade", label: "Parade", icon: <IconSliders width={11} height={11} /> },
  { id: "wave", label: "Wave", icon: <IconWave width={11} height={11} /> },
  { id: "vector", label: "Vector", icon: <IconScope width={11} height={11} /> },
];

const LEVELS = 128;

export function Scopes({ data, tick }: { data: ScopeData | null; tick: number }) {
  const [mode, setMode] = useState<Mode>("hist");
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 300, h: 150 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.max(80, r.width), h: Math.max(80, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const off = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = COLS * 3;
    c.height = LEVELS;
    return c;
  }, []);

  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = box.w;
    const H = box.h;
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    const g = cvs.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#0a0c10";
    g.fillRect(0, 0, W, H);

    if (!data || !data.samples) {
      g.fillStyle = "#3b434e";
      g.font = "500 10px 'IBM Plex Mono', monospace";
      g.fillText("NO SIGNAL", 10, H / 2);
      return;
    }

    const pad = 6;
    const iw = W - pad * 2;
    const ih = H - pad * 2 - 8;
    const ox = pad;
    const oy = pad;

    // frame grid
    g.strokeStyle = "rgba(255,255,255,.05)";
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = oy + (ih * i) / 4;
      g.beginPath();
      g.moveTo(ox, y);
      g.lineTo(ox + iw, y);
      g.stroke();
    }

    if (mode === "hist") {
      const peak = Math.max(1, peakOf(data.hist, 3, 0), peakOf(data.hist, 3, 1), peakOf(data.hist, 3, 2));
      const chans: [number, string][] = [
        [0, "#ff5b52"],
        [1, "#7ce07c"],
        [2, "#5aa9ff"],
      ];
      g.globalCompositeOperation = "lighter";
      for (const [off2, col] of chans) {
        g.beginPath();
        g.moveTo(ox, oy + ih);
        for (let i = 0; i < 256; i++) {
          const v = Math.pow(data.hist[i * 3 + off2] / peak, 0.5);
          g.lineTo(ox + (i / 255) * iw, oy + ih - v * ih);
        }
        g.lineTo(ox + iw, oy + ih);
        g.closePath();
        const grad = g.createLinearGradient(0, oy, 0, oy + ih);
        grad.addColorStop(0, col);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.42;
        g.fillStyle = grad;
        g.fill();
        g.globalAlpha = 0.95;
        g.strokeStyle = col;
        g.lineWidth = 1;
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      // luma overlay
      const lp = Math.max(1, peakOf(data.luma));
      g.beginPath();
      for (let i = 0; i < 256; i++) {
        const v = Math.pow(data.luma[i] / lp, 0.5);
        const x = ox + (i / 255) * iw;
        const y = oy + ih - v * ih;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.setLineDash([2, 3]);
      g.stroke();
      g.setLineDash([]);
    } else if (mode === "parade" || mode === "wave") {
      const lanes = mode === "parade" ? 3 : 1;
      const img = off.getContext("2d")!.createImageData(COLS * lanes, LEVELS);
      const px = img.data;
      let maxc = 1;
      for (let c = 0; c < COLS; c++) {
        for (let l = 0; l < 256; l++) {
          if (mode === "parade") {
            for (let k = 0; k < 3; k++) {
              const v = data.parade[(c * 256 + l) * 3 + k];
              if (v > maxc) maxc = v;
            }
          } else {
            const v = data.wave[c * 256 + l];
            if (v > maxc) maxc = v;
          }
        }
      }
      const norm = Math.log(1 + maxc);
      for (let c = 0; c < COLS; c++) {
        for (let l = 0; l < 256; l++) {
          const row = LEVELS - 1 - Math.round((l / 255) * (LEVELS - 1));
          if (mode === "parade") {
            for (let k = 0; k < 3; k++) {
              const v = data.parade[(c * 256 + l) * 3 + k];
              const a = Math.log(1 + v) / norm;
              if (a <= 0.002) continue;
              const idx = ((row * COLS * 3) + k * COLS + c) * 4;
              const col = k === 0 ? [255, 70, 62] : k === 1 ? [110, 230, 120] : [86, 168, 255];
              px[idx] = col[0];
              px[idx + 1] = col[1];
              px[idx + 2] = col[2];
              px[idx + 3] = Math.min(255, a * 300);
            }
          } else {
            const v = data.wave[c * 256 + l];
            const a = Math.log(1 + v) / norm;
            if (a <= 0.002) continue;
            const idx = (row * COLS + c) * 4;
            px[idx] = 120;
            px[idx + 1] = 226;
            px[idx + 2] = 200;
            px[idx + 3] = Math.min(255, a * 320);
          }
        }
      }
      const octx = off.getContext("2d")!;
      octx.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.globalCompositeOperation = "lighter";
      g.drawImage(off, 0, 0, COLS * lanes, LEVELS, ox, oy, iw, ih);
      g.globalCompositeOperation = "source-over";
      if (mode === "parade") {
        g.strokeStyle = "rgba(255,255,255,.14)";
        for (let k = 1; k < 3; k++) {
          const x = ox + (iw * k) / 3;
          g.beginPath();
          g.moveTo(x, oy);
          g.lineTo(x, oy + ih);
          g.stroke();
        }
      }
      // IRE marks
      g.font = "500 8px 'IBM Plex Mono', monospace";
      g.fillStyle = "rgba(255,255,255,.35)";
      g.fillText("100", ox + 1, oy + 7);
      g.fillText("0", ox + 1, oy + ih);
    } else {
      // vectorscope
      const cx = ox + iw / 2;
      const cy = oy + ih / 2;
      const R = Math.min(iw, ih) / 2 - 2;
      const k = R / 0.62;
      g.strokeStyle = "rgba(255,255,255,.09)";
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R * 0.66, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R * 0.33, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(cx - R, cy);
      g.lineTo(cx + R, cy);
      g.moveTo(cx, cy - R);
      g.lineTo(cx, cy + R);
      g.stroke();

      // hue targets
      const targets: [string, number, number, string][] = [
        ["R", -0.169, 0.5, "#ff5b52"],
        ["Yl", -0.506, 0.073, "#e8d44a"],
        ["G", -0.331, -0.419, "#7ce07c"],
        ["Cy", 0.169, -0.5, "#4ad9d0"],
        ["B", 0.5, -0.081, "#5aa9ff"],
        ["Mg", 0.331, 0.419, "#ec5f9e"],
      ];
      g.font = "600 8px 'IBM Plex Mono', monospace";
      for (const [label, cb, cr, col] of targets) {
        const x = cx + cb * k;
        const y = cy - cr * k;
        g.strokeStyle = col;
        g.globalAlpha = 0.5;
        g.strokeRect(x - 4, y - 4, 8, 8);
        g.globalAlpha = 0.75;
        g.fillStyle = col;
        g.fillText(label, x - 4, y - 6);
        g.globalAlpha = 1;
        g.strokeStyle = "rgba(255,255,255,.06)";
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(x, y);
        g.stroke();
      }
      // skin tone line
      const skinCb = -0.1;
      const skinCr = 0.28;
      g.strokeStyle = "rgba(245,165,36,.35)";
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + skinCb * k * 1.05, cy - skinCr * k * 1.05);
      g.stroke();
      g.setLineDash([]);

      // plot
      g.globalCompositeOperation = "lighter";
      let vmax = 1;
      for (let i = 0; i < data.vectors.length; i++) if (data.vectors[i] > vmax) vmax = data.vectors[i];
      const ln = Math.log(1 + vmax);
      for (let ai = 0; ai < ANGLE_BINS; ai++) {
        const ang = ((ai + 0.5) / ANGLE_BINS) * Math.PI * 2;
        for (let ri = 0; ri < RAD_BINS; ri++) {
          const c = data.vectors[ai * RAD_BINS + ri];
          if (!c) continue;
          const rad = ((ri + 0.5) / RAD_BINS) * 0.62;
          const a = Math.log(1 + c) / ln;
          const x = cx + Math.cos(ang) * rad * k;
          const y = cy - Math.sin(ang) * rad * k;
          g.fillStyle = `rgba(120,220,255,${Math.min(0.85, a * 1.4)})`;
          g.fillRect(x, y, 1.5, 1.5);
        }
      }
      g.globalCompositeOperation = "source-over";
    }

    // baseline + labels
    g.strokeStyle = "rgba(255,255,255,.16)";
    g.beginPath();
    g.moveTo(ox, oy + ih + 0.5);
    g.lineTo(ox + iw, oy + ih + 0.5);
    g.stroke();
    g.font = "500 8px 'IBM Plex Mono', monospace";
    g.fillStyle = "rgba(255,255,255,.28)";
    g.fillText(mode === "vector" ? "SATURATION →" : "0", ox, oy + ih + 9);
    const right = mode === "vector" ? "Cb / Cr" : "255";
    g.fillText(right, ox + iw - g.measureText(right).width, oy + ih + 9);
  }, [box.h, box.w, data, mode, off, tick]);

  const avg = data?.avg;
  const clip = data
    ? {
        hi: data.hist[255 * 3] + data.hist[255 * 3 + 1] + data.hist[255 * 3 + 2],
        lo: data.hist[0] + data.hist[1] + data.hist[2],
      }
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-panel/70 px-2 py-1.5">
        <span className="font-display text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">
          Scopes
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {clip && clip.hi > data!.samples * 0.004 && (
            <span className="rounded-[3px] border border-flame/40 bg-flame/10 px-1 font-mono text-[8px] text-flame">
              CLIP HI
            </span>
          )}
          {clip && clip.lo > data!.samples * 0.008 && (
            <span className="rounded-[3px] border border-sky/40 bg-sky/10 px-1 font-mono text-[8px] text-sky">
              CLIP LO
            </span>
          )}
          {avg && (
            <span className="tabular font-mono text-[8.5px] text-faint">
              <span className="text-[#ff8b84]">{avg[0].toFixed(0)}</span>{" "}
              <span className="text-[#8ee08e]">{avg[1].toFixed(0)}</span>{" "}
              <span className="text-[#7fb6ff]">{avg[2].toFixed(0)}</span>
            </span>
          )}
        </div>
      </div>
      <div className="px-2 pt-2">
        <SegTabs items={MODES} value={mode} onChange={setMode} />
      </div>
      <div ref={wrapRef} className="relative m-2 min-h-0 flex-1 overflow-hidden rounded-[5px] border border-line">
        <canvas ref={cvsRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 rounded-[5px] shadow-[inset_0_0_28px_-10px_#000]" />
      </div>
    </div>
  );
}

function peakOf(arr: Uint32Array, stride = 1, offset = 0) {
  let m = 1;
  for (let i = 0; i < arr.length; i += stride) if (arr[i + offset] > m) m = arr[i + offset];
  return m;
}
