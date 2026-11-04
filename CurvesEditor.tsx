import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { evaluateCurve } from "@/editor/curves";
import { clamp, type Curves, type Pt } from "@/editor/types";
import { IconReset } from "./Icons";

type Chan = "master" | "red" | "green" | "blue";

const CHANS: { id: Chan; label: string; color: string }[] = [
  { id: "master", label: "Master", color: "#dfe4ea" },
  { id: "red", label: "Red", color: "#f0574f" },
  { id: "green", label: "Green", color: "#8ed15a" },
  { id: "blue", label: "Blue", color: "#4f9cf9" },
];

const LIN: Pt[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export function CurvesEditor({
  curves,
  onChange,
  onCommit,
  lumaHist,
  lumaPeak,
}: {
  curves: Curves;
  onChange: (c: Curves) => void;
  onCommit?: () => void;
  lumaHist?: Uint32Array;
  lumaPeak?: number;
}) {
  const [chan, setChan] = useState<Chan>("master");
  const [size, setSize] = useState({ w: 260, h: 190 });
  const [dragIdx, setDragIdx] = useState(-1);
  const [hoverPt, setHoverPt] = useState<Pt | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  const color = CHANS.find((c) => c.id === chan)!.color;
  const pts = curves[chan];

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(120, r.width), h: Math.max(120, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------------------------------------------------- draw */
  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = size.w;
    const H = size.h;
    cvs.width = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    const g = cvs.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const pad = 0;
    const X = (v: number) => pad + v * (W - pad * 2);
    const Y = (v: number) => H - pad - v * (H - pad * 2);

    // background
    g.fillStyle = "#0d1015";
    g.fillRect(0, 0, W, H);

    // luma histogram backdrop
    if (lumaHist && lumaPeak && lumaPeak > 0) {
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i < 256; i++) {
        const v = Math.pow(lumaHist[i] / lumaPeak, 0.55);
        g.lineTo(X(i / 255), Y(Math.min(1, v * 0.92)));
      }
      g.lineTo(W, H);
      g.closePath();
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(140,160,185,.26)");
      grad.addColorStop(1, "rgba(140,160,185,.05)");
      g.fillStyle = grad;
      g.fill();
    }

    // grid
    g.strokeStyle = "rgba(255,255,255,.055)";
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = i / 4;
      g.beginPath();
      g.moveTo(X(p), 0);
      g.lineTo(X(p), H);
      g.moveTo(0, Y(p));
      g.lineTo(W, Y(p));
      g.stroke();
    }
    // thirds highlight (quartiles like Resolve)
    g.strokeStyle = "rgba(255,255,255,.09)";
    g.beginPath();
    g.moveTo(X(1 / 3), 0);
    g.lineTo(X(1 / 3), H);
    g.moveTo(X(2 / 3), 0);
    g.lineTo(X(2 / 3), H);
    g.moveTo(0, Y(1 / 3));
    g.lineTo(W, Y(1 / 3));
    g.moveTo(0, Y(2 / 3));
    g.lineTo(W, Y(2 / 3));
    g.stroke();

    // reference diagonal
    g.strokeStyle = "rgba(255,255,255,.16)";
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(1), Y(1));
    g.stroke();
    g.setLineDash([]);

    // curve
    g.strokeStyle = color;
    g.lineWidth = 1.8;
    g.shadowColor = color;
    g.shadowBlur = 7;
    g.beginPath();
    const steps = 140;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const y = clamp(evaluateCurve(pts, x), 0, 1);
      if (i === 0) g.moveTo(X(x), Y(y));
      else g.lineTo(X(x), Y(y));
    }
    g.stroke();
    g.shadowBlur = 0;

    // points
    pts.forEach((p, i) => {
      const active = i === dragIdx;
      g.beginPath();
      g.arc(X(p.x), Y(p.y), active ? 5 : 3.6, 0, Math.PI * 2);
      g.fillStyle = active ? "#fff" : "#0d1015";
      g.fill();
      g.lineWidth = active ? 2 : 1.6;
      g.strokeStyle = color;
      g.stroke();
    });

    // hover readout crosshair
    if (hoverPt) {
      g.strokeStyle = "rgba(255,255,255,.22)";
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(X(hoverPt.x), 0);
      g.lineTo(X(hoverPt.x), H);
      g.moveTo(0, Y(hoverPt.y));
      g.lineTo(W, Y(hoverPt.y));
      g.stroke();
      g.setLineDash([]);
      const txt = `${Math.round(hoverPt.x * 100)} → ${Math.round(hoverPt.y * 100)}`;
      g.font = "500 9px 'IBM Plex Mono', monospace";
      const tw = g.measureText(txt).width;
      const bx = clamp(X(hoverPt.x) + 8, 4, W - tw - 12);
      const by = clamp(Y(hoverPt.y) - 20, 4, H - 18);
      g.fillStyle = "rgba(10,12,15,.88)";
      g.fillRect(bx, by, tw + 8, 14);
      g.fillStyle = "#dfe4ea";
      g.fillText(txt, bx + 4, by + 10);
    }
  }, [color, dragIdx, hoverPt, lumaHist, lumaPeak, pts, size.h, size.w]);

  /* ----------------------------------------------------- interaction */
  const toNorm = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const cvs = cvsRef.current!;
      const r = cvs.getBoundingClientRect();
      return {
        x: clamp((e.clientX - r.left) / r.width, 0, 1),
        y: clamp(1 - (e.clientY - r.top) / r.height, 0, 1),
      };
    },
    [],
  );

  const hit = useCallback(
    (n: Pt) => {
      const cvs = cvsRef.current!;
      const r = cvs.getBoundingClientRect();
      const px = 9 / r.width;
      const py = 9 / r.height;
      for (let i = 0; i < pts.length; i++) {
        if (Math.abs(pts[i].x - n.x) < px && Math.abs(pts[i].y - n.y) < py) return i;
      }
      return -1;
    },
    [pts],
  );

  const commitPts = (next: Pt[]) => {
    onChange({ ...curves, [chan]: next } as Curves);
  };

  const onDown = (e: React.PointerEvent) => {
    const n = toNorm(e);
    const i = hit(n);
    if (i >= 0) {
      setDragIdx(i);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    // add point
    const isFirst = pts.length === 2 && pts[0].x === 0 && pts[0].y === 0 && pts[1].x === 1 && pts[1].y === 1;
    const next = isFirst ? [pts[0], { x: n.x, y: n.y }, pts[1]] : [...pts, { x: n.x, y: n.y }].sort((a, b) => a.x - b.x);
    commitPts(next);
    setDragIdx(next.findIndex((p) => Math.abs(p.x - n.x) < 1e-6));
  };

  const onMove = (e: React.PointerEvent) => {
    const n = toNorm(e);
    if (dragIdx >= 0) {
      const p = pts[dragIdx];
      const edge = dragIdx === 0 || dragIdx === pts.length - 1;
      const nx = edge ? p.x : clamp(n.x, pts[dragIdx - 1].x + 0.01, pts[dragIdx + 1].x - 0.01);
      const ny = clamp(n.y, 0, 1);
      const next = pts.slice();
      next[dragIdx] = { x: nx, y: ny };
      commitPts(next);
      setHoverPt({ x: nx, y: ny });
    } else {
      const i = hit(n);
      setHoverPt(i >= 0 ? pts[i] : { x: n.x, y: clamp(evaluateCurve(pts, n.x), 0, 1) });
    }
  };

  const onUp = () => {
    if (dragIdx >= 0) onCommit?.();
    setDragIdx(-1);
  };

  const onDouble = (e: React.MouseEvent) => {
    const n = toNorm(e);
    const i = hit(n);
    if (i > 0 && i < pts.length - 1) {
      commitPts(pts.filter((_, k) => k !== i));
      onCommit?.();
    }
  };

  const dirty = JSON.stringify(pts) !== JSON.stringify(LIN);

  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center gap-1">
        {CHANS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChan(c.id)}
            className={cn(
              "relative h-[19px] flex-1 rounded-[4px] border text-[9px] font-medium tracking-[0.12em] uppercase transition-all duration-200",
              chan === c.id
                ? "border-transparent text-[#0b0d11]"
                : "border-line text-faint hover:border-line2 hover:text-dim",
            )}
            style={chan === c.id ? { background: c.color } : undefined}
          >
            {c.label}
            {c.id !== chan && curves[c.id].length > 2 && (
              <span
                className="absolute top-[3px] right-[3px] h-[4px] w-[4px] rounded-full"
                style={{ background: c.color }}
              />
            )}
          </button>
        ))}
        <button
          type="button"
          title="Reset channel curve"
          onClick={() => {
            commitPts(LIN);
            onCommit?.();
          }}
          className={cn(
            "flex h-[19px] w-[22px] items-center justify-center rounded-[4px] border border-line transition-colors",
            dirty ? "text-amber hover:border-amber/50" : "text-faint/60 hover:text-dim",
          )}
        >
          <IconReset width={11} height={11} />
        </button>
      </div>

      <div
        ref={boxRef}
        className="relative h-[168px] w-full overflow-hidden rounded-[6px] border border-line bg-[#0d1015]"
      >
        <canvas
          ref={cvsRef}
          className={cn("absolute inset-0", dragIdx >= 0 ? "cursor-grabbing" : "cursor-crosshair")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => {
            onUp();
            setHoverPt(null);
          }}
          onDoubleClick={onDouble}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[6px] shadow-[inset_0_0_22px_-8px_#000]" />
        <div className="pointer-events-none absolute right-1.5 bottom-1 left-1.5 flex justify-between font-mono text-[8px] text-faint/70">
          <span>SHADOWS</span>
          <span>MIDTONES</span>
          <span>HIGHLIGHTS</span>
        </div>
      </div>
      <p className="mt-1 text-[9.5px] leading-tight text-faint">
        Click to add a point · drag to shape · double-click a point to remove
      </p>
    </div>
  );
}
