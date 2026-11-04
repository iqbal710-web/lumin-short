import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Columns2, Crop, Eye, EyeOff, ImagePlus, Maximize2, Minimize2, TriangleAlert, Check } from 'lucide-react';
import { PREVIEW_MAX, Renderer } from '../gl/Renderer';
import { useEditor } from '../state/editor';
import { useElementSize } from '../hooks';
import { previewSource } from '../lib/media';
import { scopeStore } from '../lib/scopes';
import { aspectValue } from '../lib/transform';
import { clamp } from '../lib/grade';
import type { CropRect } from '../types';
import { Button, IconBtn, Select } from './ui';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/* Crop overlay                                                        */
/* ------------------------------------------------------------------ */
function CropOverlay({ crop, ratio, W, H, onChange }: { crop: CropRect; ratio: number; W: number; H: number; onChange: (c: CropRect, transient: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; c: CropRect; last: CropRect } | null>(null);

  const start = (mode: string) => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, c: crop, last: crop };
  };

  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / r.width;
    const dy = (e.clientY - d.sy) / r.height;
    const MIN = 0.04;
    let { x, y, w, h } = d.c;
    if (d.mode === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      let l = x;
      let t = y;
      let rr = x + w;
      let b = y + h;
      const m = d.mode;
      if (m.includes('l')) l = clamp(l + dx, 0, rr - MIN);
      if (m.includes('r')) rr = clamp(rr + dx, l + MIN, 1);
      if (m.includes('t')) t = clamp(t + dy, 0, b - MIN);
      if (m.includes('b')) b = clamp(b + dy, t + MIN, 1);
      if (ratio > 0) {
        const k = W / (ratio * H); // normalized h per normalized w
        let nw = rr - l;
        let nh = nw * k;
        if (nh > 1) {
          nh = 1;
          nw = nh / k;
        }
        const apply = () => {
          if (m.includes('t')) t = b - nh;
          else b = t + nh;
          if (m.includes('l')) l = rr - nw;
          else rr = l + nw;
        };
        apply();
        if (t < 0 || b > 1) {
          nh = m.includes('t') ? b : 1 - t;
          nw = nh / k;
          apply();
        }
        if (l < 0 || rr > 1) {
          nw = m.includes('l') ? rr : 1 - l;
          nh = nw * k;
          apply();
        }
      }
      x = l;
      y = t;
      w = rr - l;
      h = b - t;
    }
    const c = { x: clamp(x), y: clamp(y), w: clamp(w, MIN, 1), h: clamp(h, MIN, 1) };
    d.last = c;
    onChange(c, true);
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d) onChange(d.last, false);
  };

  const handles = ratio > 0 ? ['tl', 'tr', 'bl', 'br'] : ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];
  const pos: Record<string, string> = {
    tl: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    tr: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    bl: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    br: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
    t: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
    b: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
    l: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
    r: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  };

  return (
    <div ref={ref} className="absolute inset-0 z-10" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div
        className="absolute cursor-move"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`,
          height: `${crop.h * 100}%`,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
          outline: '1px solid rgba(255,255,255,0.9)',
        }}
        onPointerDown={start('move')}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
        </div>
        {handles.map((hd) => (
          <div
            key={hd}
            onPointerDown={start(hd)}
            className={cn('absolute touch-none rounded-[2px] border border-black/40 bg-white shadow', hd.length === 2 ? 'size-3' : hd === 't' || hd === 'b' ? 'h-2 w-6' : 'h-6 w-2', pos[hd])}
          />
        ))}
        <div className="pointer-events-none absolute -top-6 left-0 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {Math.round(crop.w * W)} × {Math.round(crop.h * H)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */
const ZOOMS = [0.25, 0.5, 1, 2, 4];

export function Viewer() {
  const { edit, view, setView, luts, currentImage, current, setTransform, openImport, commit } = useEditor();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpu, setGpu] = useState('');
  const [out, setOut] = useState<[number, number]>([0, 0]);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [probe, setProbe] = useState<{ x: number; y: number; rgb: [number, number, number] } | null>(null);
  const latest = useRef({ edit, view, luts });
  latest.current = { edit, view, luts };
  const raf = useRef(0);
  const panDrag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const zoomState = useRef({ scale: 1, pan: { x: 0, y: 0 } });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const r = new Renderer(c, { preserve: true });
      rRef.current = r;
      setGpu(r.floatPipeline ? 'GPU · 16-bit float' : 'GPU · 8-bit');
    } catch (e) {
      setError((e as Error).message);
    }
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      rRef.current?.dispose();
      rRef.current = null;
    };
  }, []);

  const draw = useCallback(() => {
    raf.current = 0;
    const r = rRef.current;
    if (!r || !r.hasSource) return;
    const { edit, view, luts } = latest.current;
    r.setLuts(luts);
    r.render(edit, {
      mode: view.compare === 'bypass' ? 1 : view.compare === 'split' ? 2 : 0,
      split: view.split,
      clipping: view.clipping,
      ignoreCrop: view.cropMode,
    });
    const w = r.canvas.width;
    const h = r.canvas.height;
    setOut((o) => (o[0] === w && o[1] === h ? o : [w, h]));
    scopeStore.set(r.readScope(edit, 256));
  }, []);

  const schedule = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const r = rRef.current;
    if (!r) return;
    if (!currentImage) {
      scopeStore.set(null);
      return;
    }
    const p = previewSource(currentImage, Math.min(PREVIEW_MAX, r.maxTexture));
    r.setSource(p.source, p.w, p.h);
    setZoom('fit');
    setPan({ x: 0, y: 0 });
    schedule();
  }, [currentImage, schedule]);

  useEffect(() => {
    schedule();
  }, [edit, view, luts, schedule]);

  // wheel zoom around cursor (native, non-passive)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale, pan } = zoomState.current;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2 - pan.x;
      const cy = e.clientY - rect.top - rect.height / 2 - pan.y;
      const ns = clamp(scale * Math.exp(-e.deltaY * 0.0015), 0.05, 16);
      const k = ns / scale;
      setPan({ x: pan.x - cx * (k - 1), y: pan.y - cy * (k - 1) });
      setZoom(ns);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stageRef]);

  const [ow, oh] = out;
  const fit = ow && oh && stage.width ? Math.min((stage.width - 40) / ow, (stage.height - 40) / oh) : 1;
  const scale = zoom === 'fit' ? Math.max(0.02, fit) : zoom;
  const panNow = zoom === 'fit' ? { x: 0, y: 0 } : pan;
  zoomState.current = { scale, pan: panNow };
  const dw = ow * scale;
  const dh = oh * scale;
  const left = (stage.width - dw) / 2 + panNow.x;
  const top = (stage.height - dh) / 2 + panNow.y;

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (view.cropMode || (e.button !== 0 && e.button !== 1)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panDrag.current = { x: e.clientX, y: e.clientY, px: panNow.x, py: panNow.y, moved: false };
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = panDrag.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.moved) {
        d.moved = true;
        if (zoom === 'fit') setZoom(scale);
      }
      setPan({ x: d.px + dx, y: d.py + dy });
      return;
    }
    const r = rRef.current;
    const c = canvasRef.current;
    if (!r || !c || !ow) return;
    const rect = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * ow);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * oh);
    if (x < 0 || y < 0 || x >= ow || y >= oh) {
      setProbe(null);
      return;
    }
    const rgb = r.readPixel(x, oh - 1 - y);
    if (rgb) setProbe({ x, y, rgb });
  };
  const onPointerUp = () => {
    panDrag.current = null;
  };

  const wipeStart = (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const wipeMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    setView({ split: clamp((e.clientX - rect.left) / rect.width, 0, 1) });
  };

  const zoomValue = zoom === 'fit' ? 'fit' : ZOOMS.includes(zoom) ? String(zoom) : 'custom';
  const zoomOptions = [
    { value: 'fit', label: 'Fit' },
    ...ZOOMS.map((z) => ({ value: String(z), label: `${z * 100}%` })),
    ...(zoomValue === 'custom' ? [{ value: 'custom', label: `${Math.round(scale * 100)}%` }] : []),
  ];

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-ink-900', view.cinema && 'fixed inset-0 z-40')}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-ink-700 bg-ink-800 px-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px]">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span className="truncate font-medium text-ink-100">{current?.name ?? 'No clip loaded'}</span>
          {current && (
            <span className="hidden font-mono text-[10px] text-ink-400 sm:inline">
              {current.width}×{current.height}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn title="Bypass grade — show original (Shift+D)" active={view.compare === 'bypass'} onClick={() => setView({ compare: view.compare === 'bypass' ? 'off' : 'bypass' })}>
            {view.compare === 'bypass' ? <EyeOff size={14} /> : <Eye size={14} />}
          </IconBtn>
          <IconBtn title="Split wipe before / after (W)" active={view.compare === 'split'} onClick={() => setView({ compare: view.compare === 'split' ? 'off' : 'split' })}>
            <Columns2 size={14} />
          </IconBtn>
          <IconBtn title="Show clipping (H)" active={view.clipping} onClick={() => setView({ clipping: !view.clipping })}>
            <TriangleAlert size={14} />
          </IconBtn>
          <IconBtn title="Crop tool (C)" active={view.cropMode} onClick={() => setView({ cropMode: !view.cropMode })}>
            <Crop size={14} />
          </IconBtn>
          <div className="mx-1 h-4 w-px bg-ink-600" />
          <Select
            value={zoomValue}
            options={zoomOptions}
            title="Zoom (mouse wheel)"
            onChange={(v) => {
              if (v === 'custom') return;
              setPan({ x: 0, y: 0 });
              setZoom(v === 'fit' ? 'fit' : parseFloat(v));
            }}
            className="w-[74px]"
          />
          <IconBtn title="Cinema viewer (F)" active={view.cinema} onClick={() => setView({ cinema: !view.cinema })}>
            {view.cinema ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </IconBtn>
        </div>
      </div>

      <div
        ref={stageRef}
        className="checker relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setProbe(null)}
        onDoubleClick={() => {
          if (!view.cropMode) {
            setZoom('fit');
            setPan({ x: 0, y: 0 });
          }
        }}
      >
        <div className="absolute" style={{ left, top, width: dw, height: dh, visibility: currentImage && ow ? 'visible' : 'hidden' }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            style={{ imageRendering: scale >= 2 ? 'pixelated' : 'auto' }}
          />
          {view.compare === 'split' && !view.cropMode && (
            <>
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">ORIGINAL</div>
              <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">GRADED</div>
              <div
                className="absolute inset-y-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize touch-none"
                style={{ left: `${view.split * 100}%` }}
                onPointerDown={wipeStart}
                onPointerMove={wipeMove}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.7)]" />
                <div className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink-900 shadow-lg">
                  ⇆
                </div>
              </div>
            </>
          )}
          {view.cropMode && ow > 0 && (
            <CropOverlay
              crop={edit.transform.crop}
              ratio={aspectValue(edit.transform.aspect, ow, oh)}
              W={ow}
              H={oh}
              onChange={(c, t) => setTransform({ crop: c }, t)}
            />
          )}
        </div>

        {view.cropMode && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/75 p-1.5 pl-3 text-[11px] text-ink-200 shadow-xl backdrop-blur">
            Crop mode
            <Button variant="primary" className="h-7" onClick={() => { commit(); setView({ cropMode: false }); }}>
              <Check size={13} /> Done
            </Button>
          </div>
        )}

        {!currentImage && !error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-600 bg-ink-850/80 px-8 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <ImagePlus size={22} />
              </div>
              <div className="text-sm font-semibold text-ink-100">Import a photo to start grading</div>
              <p className="text-[12px] text-ink-400">Drag & drop JPG, PNG, WebP or AVIF files anywhere, or paste an image.</p>
              <Button variant="primary" onClick={openImport}>
                <ImagePlus size={14} /> Import images
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-[12px] text-red-200">
              <div className="mb-1 font-semibold">GPU acceleration unavailable</div>
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-ink-700 bg-ink-850 px-2.5 font-mono text-[10px] text-ink-400">
        <div className="flex min-w-0 items-center gap-3">
          {probe ? (
            <>
              <span className="size-3 shrink-0 rounded-sm ring-1 ring-white/25" style={{ background: `rgb(${probe.rgb.join(',')})` }} />
              <span className="hidden sm:inline">
                X {probe.x} Y {probe.y}
              </span>
              <span className="text-red-400">R {probe.rgb[0]}</span>
              <span className="text-green-400">G {probe.rgb[1]}</span>
              <span className="text-sky-400">B {probe.rgb[2]}</span>
            </>
          ) : (
            <span className="truncate">Hover = pixel values · Wheel = zoom · Drag = pan · Double-click = fit</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {ow > 0 && (
            <span className="hidden md:inline">
              {ow}×{oh}
            </span>
          )}
          <span>{Math.round(scale * 100)}%</span>
          <span className="hidden text-ink-500 lg:inline">{gpu}</span>
        </div>
      </div>
    </div>
  );
}
