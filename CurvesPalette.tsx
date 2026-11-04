import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { CurveKey, CurvePoint, HueCurveKey } from '../types';
import { useEditor } from '../state/editor';
import { clamp, evalCurve, flatCurve, identityCurve, isFlatCurve, isIdentityCurve } from '../lib/grade';
import { lumaHistogram, scopeStore } from '../lib/scopes';
import { useElementSize } from '../hooks';
import { cn } from '../utils/cn';

type Mode = 'custom' | HueCurveKey;

const CH_COLOR: Record<CurveKey, string> = { master: '#ececf0', r: '#ff5c5c', g: '#4ade80', b: '#60a5fa' };
const CH_LABEL: Record<CurveKey, string> = { master: 'Y', r: 'R', g: 'G', b: 'B' };
const MODES: { id: Mode; label: string }[] = [
  { id: 'custom', label: 'Custom' },
  { id: 'hueHue', label: 'Hue vs Hue' },
  { id: 'hueSat', label: 'Hue vs Sat' },
  { id: 'hueLum', label: 'Hue vs Lum' },
];

function useLumaHistogram() {
  const [hist, setHist] = useState<Float32Array | null>(null);
  useEffect(() => {
    let last = 0;
    let timer = 0;
    const update = () => {
      const sd = scopeStore.get();
      setHist(sd ? lumaHistogram(sd) : null);
      last = performance.now();
    };
    update();
    const unsub = scopeStore.subscribe(() => {
      window.clearTimeout(timer);
      if (performance.now() - last > 180) update();
      else timer = window.setTimeout(update, 180);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  return hist;
}

interface CurveEditorProps {
  points: CurvePoint[];
  onChange: (p: CurvePoint[], transient: boolean) => void;
  mode: 'rgb' | 'hue';
  color: string;
  ghosts?: { points: CurvePoint[]; color: string }[];
  histogram?: Float32Array | null;
}

export function CurveEditor({ points, onChange, mode, color, ghosts = [], histogram }: CurveEditorProps) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const drag = useRef<{ idx: number; pts: CurvePoint[] } | null>(null);
  const [hover, setHover] = useState(-1);
  const pad = 10;
  const W = Math.max(40, width);
  const H = Math.max(40, height);
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  const X = (x: number) => pad + x * iw;
  const Y = (y: number) => pad + (1 - y) * ih;

  const pathFor = (pts: CurvePoint[]) => {
    const lut = evalCurve(pts, 160);
    let d = '';
    for (let i = 0; i < lut.length; i++) d += `${i ? 'L' : 'M'}${X(i / (lut.length - 1)).toFixed(1)},${Y(lut[i]).toFixed(1)}`;
    return d;
  };
  const mainPath = useMemo(() => pathFor(points), [points, W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  const histPath = useMemo(() => {
    if (!histogram || mode !== 'rgb') return '';
    let d = `M${X(0)},${Y(0)}`;
    for (let i = 0; i < 256; i++) d += `L${X(i / 255).toFixed(1)},${Y(histogram[i] * 0.85).toFixed(1)}`;
    return d + `L${X(1)},${Y(0)}Z`;
  }, [histogram, mode, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const toNorm = (cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((cx - r.left - pad) / iw), y: clamp(1 - (cy - r.top - pad) / ih) };
  };
  const hit = (cx: number, cy: number) => {
    const r = ref.current!.getBoundingClientRect();
    let best = -1;
    let bd = 10;
    points.forEach((p, i) => {
      const d = Math.hypot(X(p.x) + r.left - cx, Y(p.y) + r.top - cy);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const removeAt = (i: number) => {
    if (i > 0 && i < points.length - 1) onChange(points.filter((_, j) => j !== i), false);
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-ink-950 ring-1 ring-ink-650"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        let idx = hit(e.clientX, e.clientY);
        const pts = points.map((p) => ({ ...p }));
        if (idx < 0) {
          const n = toNorm(e.clientX, e.clientY);
          let ins = pts.findIndex((p) => p.x > n.x);
          if (ins < 0) ins = pts.length;
          if (ins === 0) ins = 1;
          const prev = pts[ins - 1];
          const next = pts[ins];
          if ((prev && n.x - prev.x < 0.015) || (next && next.x - n.x < 0.015)) return;
          pts.splice(ins, 0, n);
          idx = ins;
          onChange(pts, true);
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { idx, pts };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) {
          setHover(hit(e.clientX, e.clientY));
          return;
        }
        const n = toNorm(e.clientX, e.clientY);
        const pts = d.pts.map((p) => ({ ...p }));
        const i = d.idx;
        const last = pts.length - 1;
        const minX = i === 0 ? 0 : pts[i - 1].x + 0.012;
        const maxX = i === last ? 1 : pts[i + 1].x - 0.012;
        let x = clamp(n.x, minX, Math.max(minX, maxX));
        const endpoint = i === 0 || i === last;
        if (mode === 'hue' && endpoint) x = i === 0 ? 0 : 1;
        pts[i] = { x, y: n.y };
        if (mode === 'hue' && endpoint) {
          pts[0] = { x: 0, y: n.y };
          pts[last] = { x: 1, y: n.y };
        }
        d.pts = pts;
        onChange(pts, true);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d) onChange(d.pts, false);
      }}
      onPointerLeave={() => setHover(-1)}
      onDoubleClick={(e) => removeAt(hit(e.clientX, e.clientY))}
      onContextMenu={(e) => {
        e.preventDefault();
        removeAt(hit(e.clientX, e.clientY));
      }}
    >
      <svg width={W} height={H} className="absolute inset-0">
        <defs>
          <linearGradient id="hueGrad" x1="0" x2="1" y1="0" y2="0">
            {[0, 60, 120, 180, 240, 300, 360].map((h) => (
              <stop key={h} offset={h / 360} stopColor={`hsl(${h} 85% 55%)`} />
            ))}
          </linearGradient>
        </defs>
        {mode === 'hue' && <rect x={pad} y={pad} width={iw} height={ih} fill="url(#hueGrad)" opacity={0.07} />}
        {histPath && <path d={histPath} fill="rgba(255,255,255,0.06)" />}
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} stroke="rgba(255,255,255,0.06)">
            <line x1={X(t)} x2={X(t)} y1={pad} y2={pad + ih} />
            <line x1={pad} x2={pad + iw} y1={Y(t)} y2={Y(t)} />
          </g>
        ))}
        <rect x={pad} y={pad} width={iw} height={ih} fill="none" stroke="rgba(255,255,255,0.1)" />
        {mode === 'rgb' ? (
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        ) : (
          <>
            <line x1={X(0)} y1={Y(0.5)} x2={X(1)} y2={Y(0.5)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
            <rect x={pad} y={pad + ih - 5} width={iw} height={5} fill="url(#hueGrad)" opacity={0.9} />
          </>
        )}
        {ghosts.map((g, i) => (
          <path key={i} d={pathFor(g.points)} fill="none" stroke={g.color} strokeOpacity={0.3} strokeWidth={1} />
        ))}
        <path d={mainPath} fill="none" stroke={color} strokeWidth={1.8} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={X(p.x)}
            cy={Y(p.y)}
            r={hover === i || drag.current?.idx === i ? 5.5 : 4.2}
            fill="#0d0d0f"
            stroke={color}
            strokeWidth={1.6}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute right-3 top-2.5 font-mono text-[9.5px] text-ink-500">
        {mode === 'rgb' ? 'click: add · drag: move · dbl/right-click: delete' : 'top = more · bottom = less'}
      </div>
    </div>
  );
}

export function CurvesPalette() {
  const { selectedNode, updateGrade } = useEditor();
  const [mode, setMode] = useState<Mode>('custom');
  const [ch, setCh] = useState<CurveKey>('master');
  const histogram = useLumaHistogram();
  const g = selectedNode.grade;
  const points = mode === 'custom' ? g.curves[ch] : g.hueCurves[mode];

  const onChange = (pts: CurvePoint[], transient: boolean) => {
    if (mode === 'custom') updateGrade((gr) => ({ ...gr, curves: { ...gr.curves, [ch]: pts } }), transient);
    else {
      const key = mode;
      updateGrade((gr) => ({ ...gr, hueCurves: { ...gr.hueCurves, [key]: pts } }), transient);
    }
  };
  const resetCurrent = () => onChange(mode === 'custom' ? identityCurve() : flatCurve(), false);
  const resetAll = () =>
    updateGrade((gr) =>
      mode === 'custom'
        ? { ...gr, curves: { master: identityCurve(), r: identityCurve(), g: identityCurve(), b: identityCurve() } }
        : { ...gr, hueCurves: { hueHue: flatCurve(), hueSat: flatCurve(), hueLum: flatCurve() } },
    );

  const ghosts =
    mode === 'custom'
      ? (Object.keys(g.curves) as CurveKey[]).filter((k) => k !== ch && !isIdentityCurve(g.curves[k])).map((k) => ({ points: g.curves[k], color: CH_COLOR[k] }))
      : [];

  return (
    <div className="flex h-full min-h-[240px] gap-3 p-2.5">
      <div className="flex w-[124px] shrink-0 flex-col gap-1">
        {MODES.map((m) => {
          const active = m.id === 'custom' ? Object.values(g.curves).some((c) => !isIdentityCurve(c)) : !isFlatCurve(g.hueCurves[m.id as HueCurveKey]);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1.5 text-left text-[11px] transition',
                mode === m.id ? 'bg-ink-650 text-ink-100' : 'text-ink-400 hover:bg-ink-700 hover:text-ink-200',
              )}
            >
              {m.label}
              {active && <span className="size-1.5 rounded-full bg-accent" />}
            </button>
          );
        })}
        {mode === 'custom' && (
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(Object.keys(CH_LABEL) as CurveKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCh(k)}
                className={cn('h-7 rounded font-mono text-[11px] font-semibold ring-1 transition', ch === k ? 'bg-ink-650 ring-ink-400' : 'ring-ink-650 hover:bg-ink-700')}
                style={{ color: CH_COLOR[k] }}
                title={k === 'master' ? 'Luma (all channels)' : `${k.toUpperCase()} channel`}
              >
                {CH_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-1">
          <button type="button" onClick={resetCurrent} className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-ink-400 hover:bg-ink-700 hover:text-ink-100">
            <RotateCcw size={11} /> Reset curve
          </button>
          <button type="button" onClick={resetAll} className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-ink-400 hover:bg-ink-700 hover:text-ink-100">
            <RotateCcw size={11} /> Reset all
          </button>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <CurveEditor
          points={points}
          onChange={onChange}
          mode={mode === 'custom' ? 'rgb' : 'hue'}
          color={mode === 'custom' ? CH_COLOR[ch] : '#fbbf24'}
          ghosts={ghosts}
          histogram={histogram}
        />
      </div>
    </div>
  );
}
