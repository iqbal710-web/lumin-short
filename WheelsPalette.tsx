import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Wheel, WheelKey } from '../types';
import { useEditor } from '../state/editor';
import { clamp, wheelReadout, wheelRingGradient, zeroWheel } from '../lib/grade';
import { useElementSize } from '../hooks';
import { Scrub } from './ui';
import { cn } from '../utils/cn';

const RING = wheelRingGradient();
const RING_MASK = 'radial-gradient(circle closest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))';
const LABELS: Record<WheelKey, string> = { lift: 'Lift', gamma: 'Gamma', gain: 'Gain', offset: 'Offset' };
const KEYS: WheelKey[] = ['lift', 'gamma', 'gain', 'offset'];
const CH = ['Y', 'R', 'G', 'B'];
const CH_COLORS = ['text-ink-100', 'text-red-400', 'text-green-400', 'text-sky-400'];

function ColorWheel({ k, wheel, size, onChange }: { k: WheelKey; wheel: Wheel; size: number; onChange: (w: Wheel, transient: boolean) => void }) {
  const drag = useRef<{ x: number; y: number; start: Wheel; last: Wheel } | null>(null);
  const jog = useRef<{ x: number; start: Wheel; last: Wheel } | null>(null);
  const R = size / 2;
  const travel = R - 16;
  const px = R + wheel.x * travel;
  const py = R - wheel.y * travel;
  const vals = wheelReadout(k, wheel);
  const active = wheel.x !== 0 || wheel.y !== 0 || wheel.m !== 0;

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: Math.max(size, 118) }}>
      <div className="flex w-full items-center justify-between px-0.5">
        <span className={cn('text-[11px] font-medium', active ? 'text-ink-100' : 'text-ink-300')}>{LABELS[k]}</span>
        <button
          type="button"
          title={`Reset ${LABELS[k]}`}
          onClick={() => onChange(zeroWheel(), false)}
          className={cn('rounded p-0.5 transition hover:bg-ink-650', active ? 'text-accent' : 'text-ink-500')}
        >
          <RotateCcw size={11} />
        </button>
      </div>

      <div
        className="relative cursor-crosshair touch-none rounded-full"
        style={{ width: size, height: size }}
        title="Drag to balance color · Shift = fine · Double-click = reset"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: wheel, last: wheel };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const sens = (e.shiftKey ? 0.12 : 0.55) / Math.max(20, travel);
          let nx = d.start.x + (e.clientX - d.x) * sens;
          let ny = d.start.y - (e.clientY - d.y) * sens;
          const len = Math.hypot(nx, ny);
          if (len > 1) {
            nx /= len;
            ny /= len;
          }
          d.last = { ...d.start, x: nx, y: ny };
          onChange(d.last, true);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d && d.last !== d.start) onChange(d.last, false);
        }}
        onDoubleClick={() => onChange({ ...wheel, x: 0, y: 0 }, false)}
      >
        <div className="absolute inset-0 rounded-full opacity-90" style={{ background: RING, WebkitMask: RING_MASK, mask: RING_MASK }} />
        <div className="absolute inset-[7px] rounded-full bg-[radial-gradient(circle_at_50%_35%,#2b2b31,#111114_72%)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.75)] ring-1 ring-black/60" />
        <div className="absolute inset-y-[18px] left-1/2 w-px -translate-x-1/2 bg-white/[0.07]" />
        <div className="absolute inset-x-[18px] top-1/2 h-px -translate-y-1/2 bg-white/[0.07]" />
        <div className="absolute inset-[30%] rounded-full border border-white/[0.04]" />
        <svg className="pointer-events-none absolute inset-0" width={size} height={size}>
          {(wheel.x !== 0 || wheel.y !== 0) && <line x1={R} y1={R} x2={px} y2={py} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />}
        </svg>
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/40 shadow-[0_0_6px_rgba(0,0,0,0.9)]"
          style={{ left: px, top: py }}
        />
      </div>

      <div className="grid w-full grid-cols-4 gap-x-0.5 text-center font-mono text-[9px] leading-tight tabular-nums">
        {vals.map((v, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[8px] text-ink-500">{CH[i]}</div>
            <div className={cn('truncate', CH_COLORS[i])}>{v.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div
        title="Master wheel (luminance): drag left/right · double-click = reset"
        className="jog relative h-[14px] w-full cursor-ew-resize touch-none overflow-hidden rounded-sm bg-ink-950 ring-1 ring-ink-650 hover:ring-ink-500"
        style={{ backgroundPositionX: `${wheel.m * 180}px` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          jog.current = { x: e.clientX, start: wheel, last: wheel };
        }}
        onPointerMove={(e) => {
          const j = jog.current;
          if (!j) return;
          const m = clamp(j.start.m + (e.clientX - j.x) / (e.shiftKey ? 1600 : 260), -1, 1);
          j.last = { ...j.start, m };
          onChange(j.last, true);
        }}
        onPointerUp={() => {
          const j = jog.current;
          jog.current = null;
          if (j && j.last !== j.start) onChange(j.last, false);
        }}
        onDoubleClick={() => onChange({ ...wheel, m: 0 }, false)}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-accent/80" />
        {wheel.m !== 0 && (
          <div
            className="absolute inset-y-[3px] bg-accent/40"
            style={{ left: wheel.m > 0 ? '50%' : `${50 + wheel.m * 50}%`, width: `${Math.abs(wheel.m) * 50}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function WheelsPalette() {
  const { selectedNode, setGrade } = useEditor();
  const g = selectedNode.grade;
  const [rootRef, root] = useElementSize<HTMLDivElement>();
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const pct = (v: number) => v.toFixed(0);

  // Layout modes: phone (2×2 wheels) · compact (short screens, one control row) · full (Resolve-style rows above & below)
  const narrow = root.width > 0 && root.width < 560;
  const compact = !narrow && root.height > 0 && root.height < 310;
  const size = narrow
    ? Math.round(clamp((root.width - 48) / 2 - 36, 72, 140))
    : Math.round(clamp(Math.min((width - 60) / 4 - 22, height - 78), 72, 150));

  const topRow = (
    <>
      <Scrub label="Temp" value={g.temperature} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('temperature', v, t)} />
      <Scrub label="Tint" value={g.tint} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('tint', v, t)} />
      <Scrub label="Contrast" value={g.contrast} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('contrast', v, t)} />
      <Scrub label="Pivot" value={g.pivot} min={0} max={1} step={0.005} defaultValue={0.435} format={(v) => v.toFixed(3)} onChange={(v, t) => setGrade('pivot', v, t)} />
      <Scrub label="Mid/Detail" value={g.midDetail} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('midDetail', v, t)} />
      <Scrub label="Exposure" value={g.exposure} min={-4} max={4} step={0.01} format={(v) => v.toFixed(2)} onChange={(v, t) => setGrade('exposure', v, t)} />
    </>
  );
  const bottomRow = (
    <>
      <Scrub label="Color Boost" value={g.vibrance} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('vibrance', v, t)} />
      <Scrub label="Shadows" value={g.shadows} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('shadows', v, t)} />
      <Scrub label="Highlights" value={g.highlights} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('highlights', v, t)} />
      <Scrub label="Saturation" value={g.saturation} min={-100} max={100} format={pct} onChange={(v, t) => setGrade('saturation', v, t)} />
      <Scrub label="Hue" value={g.hue} min={-180} max={180} format={pct} onChange={(v, t) => setGrade('hue', v, t)} />
      <Scrub label="Fade" value={g.fade} min={0} max={100} format={pct} onChange={(v, t) => setGrade('fade', v, t)} />
    </>
  );

  return (
    <div ref={rootRef} className="h-full">
      <div className={cn('flex flex-col', !narrow && 'h-full', compact ? 'min-h-[214px]' : 'min-h-[258px]')}>
        <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1.5 px-3 pt-2">
          {topRow}
          {(compact || narrow) && bottomRow}
        </div>
        <div
          ref={ref}
          className={
            narrow
              ? 'grid grid-cols-2 justify-items-center gap-x-2 gap-y-4 px-3 py-3'
              : 'flex min-h-0 flex-1 items-center justify-evenly gap-2 overflow-hidden px-3 py-1'
          }
        >
          {KEYS.map((k) => (
            <ColorWheel key={k} k={k} wheel={g[k]} size={size} onChange={(w, t) => setGrade(k, w, t)} />
          ))}
        </div>
        {!compact && !narrow && <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1.5 px-3 pb-2.5">{bottomRow}</div>}
      </div>
    </div>
  );
}
