import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/utils/cn";
import { clamp } from "@/editor/types";
import { Btn, Tag } from "./ui";
import {
  IconCompare,
  IconEye,
  IconFit,
  IconLock,
  IconUpload,
  IconZoomIn,
  IconZoomOut,
} from "./Icons";

export type Layout = { baseW: number; baseH: number; bufW: number; bufH: number };

export function computeLayout(
  cw: number,
  ch: number,
  iw: number,
  ih: number,
  zoom: number,
  dpr: number,
): Layout {
  const pad = 34;
  const s = Math.min((Math.max(40, cw) - pad) / iw, (Math.max(40, ch) - pad) / ih);
  const baseW = Math.max(8, iw * s);
  const baseH = Math.max(8, ih * s);
  const dispW = baseW * zoom;
  const target = Math.min(iw, Math.max(64, dispW * dpr));
  const bufW = Math.round(target);
  const bufH = Math.round((target * ih) / iw);
  return { baseW, baseH, bufW, bufH };
}

export type ViewerProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  imgW: number;
  imgH: number;
  name: string;
  empty?: boolean;
  layout: Layout;
  zoom: number;
  pan: { x: number; y: number };
  split: number;
  original: boolean;
  showGrid: boolean;
  showSafe: boolean;
  dirty: boolean;
  onZoom: (z: number, anchor?: { x: number; y: number }) => void;
  onPan: (p: { x: number; y: number }) => void;
  onSplit: (v: number) => void;
  onOriginal: (v: boolean) => void;
  onGrid: () => void;
  onSafe: () => void;
  onFit: () => void;
  onFiles: (files: FileList | File[]) => void;
  onOpenPicker: () => void;
};

export function Viewer(p: ViewerProps) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [hoverUI, setHoverUI] = useState(true);
  const dragState = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  const dispW = p.layout.baseW * p.zoom;
  const dispH = p.layout.baseH * p.zoom;

  /* ---------- wheel zoom (props kept in a ref so the listener is stable) ---------- */
  const propsRef = useRef(p);
  propsRef.current = p;
  useEffect(() => {
    const el = p.containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const q = propsRef.current;
      if (e.shiftKey) {
        q.onPan({ x: q.pan.x - e.deltaY, y: q.pan.y });
        return;
      }
      q.onZoom(clamp(q.zoom * Math.exp(-e.deltaY * 0.0016), 0.06, 12));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [p.containerRef]);

  /* ---------- drag & drop ---------- */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer?.files?.length) p.onFiles(e.dataTransfer.files);
  };

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (!e.altKey && e.button === 0) return;
    dragState.current = { x: e.clientX, y: e.clientY, px: p.pan.x, py: p.pan.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const movePan = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    p.onPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };

  const endPan = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const splitFromEvent = (clientX: number) => {
    const wrap = splitRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    p.onSplit(clamp((clientX - r.left) / Math.max(1, r.width), 0, 1));
  };

  return (
    <div
      ref={p.containerRef}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden",
        dragging ? "cursor-grabbing" : "cursor-default",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onMouseEnter={() => setHoverUI(true)}
      title="Alt + drag to pan · scroll to zoom · double-click to fit"
    >
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0 checker opacity-[.35]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.05), transparent 62%)" }}
      />

      {/* empty state */}
      {p.empty && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
          <button
            type="button"
            onClick={p.onOpenPicker}
            className="pop-in group flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[12px] border border-dashed border-line2 bg-panel/70 px-8 py-10 text-center backdrop-blur-md transition-all duration-300 hover:border-amber/60 hover:bg-amber/[.04]"
          >
            <span className="relative flex h-12 w-12 items-center justify-center rounded-[10px] border border-amber/30 bg-[#14110b] text-amber">
              <IconUpload width={20} height={20} />
              <span className="spin-slow absolute inset-[-4px] rounded-[13px] border border-dashed border-amber/20" />
            </span>
            <span className="font-display text-[14px] font-semibold tracking-wide text-txt">
              No media in the pool
            </span>
            <span className="max-w-[300px] text-[11.5px] leading-relaxed text-dim">
              Drop images anywhere in this viewer, or browse your device. Everything is graded
              locally on the GPU — nothing is uploaded.
            </span>
            <span className="mt-1 rounded-[5px] border border-line2 bg-raise px-3 py-1 font-mono text-[10px] tracking-wider text-dim uppercase transition-colors group-hover:border-amber/50 group-hover:text-amber">
              import images
            </span>
          </button>
        </div>
      )}

      {/* image stack */}
      <div
        className={cn("relative", p.empty && "invisible")}
        style={{
          width: dispW,
          height: dispH,
          transform: `translate3d(${p.pan.x}px, ${p.pan.y}px, 0)`,
        }}
      >
        <div
          className="absolute -inset-[1px] rounded-[2px]"
          style={{ boxShadow: "0 30px 80px -30px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.07)" }}
        />
        <canvas
          ref={p.canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: p.zoom > 2.4 ? "pixelated" : "auto" }}
          onDoubleClick={() => p.onFit()}
        />

        {/* overlays */}
        {p.showGrid && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <g stroke="rgba(255,255,255,.28)" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <line x1="33.33%" y1="0" x2="33.33%" y2="100%" />
              <line x1="66.66%" y1="0" x2="66.66%" y2="100%" />
              <line x1="0" y1="33.33%" x2="100%" y2="33.33%" />
              <line x1="0" y1="66.66%" x2="100%" y2="66.66%" />
            </g>
          </svg>
        )}
        {p.showSafe && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <rect
              x="5%"
              y="5%"
              width="90%"
              height="90%"
              fill="none"
              stroke="rgba(47,214,195,.55)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x="10%"
              y="10%"
              width="80%"
              height="80%"
              fill="none"
              stroke="rgba(236,95,158,.5)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* compare wipe */}
        {p.split >= 0 && (
          <div ref={splitRef} className="absolute inset-0">
            <div
              className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 cursor-ew-resize bg-white/85 shadow-[0_0_12px_rgba(255,255,255,.6)]"
              style={{ left: `${p.split * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const move = (ev: PointerEvent) => splitFromEvent(ev.clientX);
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                move(e.nativeEvent);
              }}
            >
              <div className="absolute top-1/2 left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0b0d11]/85 text-white backdrop-blur-sm">
                <IconCompare width={12} height={12} />
              </div>
            </div>
            <span
              className="absolute top-2 -translate-x-full pr-2 font-mono text-[9px] tracking-widest text-white/70 uppercase"
              style={{ left: `${p.split * 100}%` }}
            >
              Original
            </span>
            <span
              className="absolute top-2 pl-2 font-mono text-[9px] tracking-widest text-amber uppercase"
              style={{ left: `${p.split * 100}%` }}
            >
              Graded
            </span>
          </div>
        )}
      </div>

      {/* ---------- HUD ---------- */}
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5", p.empty && "hidden")}>
        <div className="flex flex-col gap-1">
          <div className="pointer-events-auto flex items-center gap-2 rounded-[5px] border border-line/80 bg-[#0b0d11]/78 px-2 py-1 backdrop-blur-md">
            <span className="max-w-[190px] truncate font-display text-[11px] font-medium text-txt">
              {p.name}
            </span>
            <span className="tabular font-mono text-[9.5px] text-faint">
              {p.imgW}×{p.imgH}
            </span>
            {p.dirty && <Tag tone="amber">graded</Tag>}
          </div>
          {p.original && (
            <div className="w-fit rounded-[4px] border border-sky/40 bg-sky/12 px-1.5 py-[2px] font-mono text-[9px] tracking-widest text-sky uppercase">
              showing original
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-[5px] border border-line/80 bg-[#0b0d11]/78 px-2 py-1 backdrop-blur-md">
          <span className="tabular font-mono text-[9.5px] text-teal">{Math.round(p.zoom * 100)}%</span>
          <span className="h-3 w-px bg-line2" />
          <span className="font-mono text-[9px] tracking-wider text-faint uppercase">sRGB · GPU</span>
        </div>
      </div>

      {/* ---------- transport bar ---------- */}
      <div
        className={cn(
          "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[8px] border border-line bg-[#0c0f14]/92 px-1.5 py-1.5 shadow-[0_18px_40px_-24px_#000] backdrop-blur-md transition-opacity duration-300",
          hoverUI ? "opacity-100" : "opacity-35",
          p.empty && "hidden",
        )}
      >
        <Btn size="xs" title="Zoom out (−)" onClick={() => p.onZoom(clamp(p.zoom / 1.25, 0.06, 12))} icon={<IconZoomOut width={13} height={13} />} />
        <span className="tabular w-[42px] text-center font-mono text-[10px] text-dim">
          {Math.round(p.zoom * 100)}%
        </span>
        <Btn size="xs" title="Zoom in (+)" onClick={() => p.onZoom(clamp(p.zoom * 1.25, 0.06, 12))} icon={<IconZoomIn width={13} height={13} />} />
        <Btn size="xs" title="1:1 pixels" onClick={() => p.onZoom(1)}>
          1:1
        </Btn>
        <Btn size="xs" title="Fit to view (F)" onClick={p.onFit} icon={<IconFit width={13} height={13} />} />
        <span className="mx-0.5 h-4 w-px bg-line2" />
        <Btn
          size="xs"
          title="Compare wipe (\)"
          active={p.split >= 0}
          onClick={() => p.onSplit(p.split >= 0 ? -1 : 0.5)}
          icon={<IconCompare width={13} height={13} />}
        />
        <Btn
          size="xs"
          title="Hold to view original (Y)"
          active={p.original}
          onClick={() => p.onOriginal(!p.original)}
          icon={<IconEye width={13} height={13} />}
        />
        <span className="mx-0.5 h-4 w-px bg-line2" />
        <Btn size="xs" title="Rule of thirds (G)" active={p.showGrid} onClick={p.onGrid}>
          Grid
        </Btn>
        <Btn size="xs" title="Safe areas (S)" active={p.showSafe} onClick={p.onSafe} icon={<IconLock width={13} height={13} />} />
        <span className="mx-0.5 h-4 w-px bg-line2" />
        <Btn size="xs" title="Import media" onClick={p.onOpenPicker} icon={<IconUpload width={13} height={13} />}>
          Import
        </Btn>
      </div>

      {/* drop curtain */}
      {over && (
        <div className="fade-in pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-[10px] border-2 border-dashed border-amber/70 bg-[#0b0d11]/85">
          <div className="text-center">
            <IconUpload width={26} height={26} className="mx-auto mb-2 text-amber" />
            <p className="font-display text-[13px] font-semibold tracking-wide text-txt">Drop images to grade</p>
            <p className="mt-0.5 font-mono text-[10px] text-dim">JPG · PNG · WEBP · AVIF</p>
          </div>
        </div>
      )}
    </div>
  );
}
