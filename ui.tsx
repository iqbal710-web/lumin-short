import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const snap = (v: number, step: number) => Math.round(v / step) * step;
export const decimalsFor = (step: number) => (step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)));

export const RAINBOW =
  'linear-gradient(90deg,hsl(0 85% 55%),hsl(60 85% 55%),hsl(120 75% 45%),hsl(180 80% 45%),hsl(240 80% 60%),hsl(300 80% 55%),hsl(360 85% 55%))';

/* ------------------------------------------------------------------ */
export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (v: number, transient: boolean) => void;
  format?: (v: number) => string;
  gradient?: string;
  disabled?: boolean;
  hint?: string;
  compact?: boolean;
}

export function Slider({ label, value, min, max, step = 1, defaultValue = 0, onChange, format, gradient, disabled, hint, compact }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const done = useRef(false);
  const [editing, setEditing] = useState(false);
  const dec = decimalsFor(step);
  const fmt = format ?? ((v: number) => v.toFixed(dec));
  const fromX = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const t = clampN((clientX - r.left) / r.width, 0, 1);
    return clampN(snap(min + t * (max - min), step), min, max);
  };
  const end = () => {
    if (drag.current === null) return;
    const v = drag.current;
    drag.current = null;
    onChange(v, false);
  };
  const nudge = (dir: number, big: boolean) => onChange(clampN(snap(value + dir * step * (big ? 10 : 1), step), min, max), false);
  const commitText = (text: string) => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    const v = parseFloat(text);
    if (Number.isFinite(v)) onChange(clampN(snap(v, step), min, max), false);
  };
  const pct = ((clampN(value, min, max) - min) / (max - min)) * 100;
  const zero = ((clampN(defaultValue, min, max) - min) / (max - min)) * 100;
  const changed = Math.abs(value - defaultValue) > step * 0.5;

  return (
    <div
      className={cn(
        'group grid items-center gap-2 py-[3px]',
        compact ? 'grid-cols-[74px_1fr_44px]' : 'grid-cols-[96px_1fr_52px]',
        disabled && 'pointer-events-none opacity-35',
      )}
      title={hint}
    >
      <span
        onDoubleClick={() => onChange(defaultValue, false)}
        className={cn('cursor-default truncate select-none text-[11px]', changed ? 'text-ink-100' : 'text-ink-300')}
      >
        {label}
      </span>
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        className="relative h-5 cursor-pointer touch-none rounded outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const v = fromX(e.clientX);
          drag.current = v;
          onChange(v, true);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const v = fromX(e.clientX);
          if (v !== drag.current) {
            drag.current = v;
            onChange(v, true);
          }
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => onChange(defaultValue, false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            nudge(-1, e.shiftKey);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            nudge(1, e.shiftKey);
          }
        }}
      >
        <div
          className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink-650"
          style={gradient ? { background: gradient, height: 4, opacity: 0.85 } : undefined}
        />
        {!gradient && (
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-accent"
            style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%` }}
          />
        )}
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/50 bg-ink-100 shadow-md transition-transform group-hover:scale-110"
          style={{ left: `${pct}%` }}
        />
      </div>
      {editing ? (
        <input
          autoFocus
          defaultValue={String(+value.toFixed(dec))}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') {
              done.current = true;
              setEditing(false);
            }
          }}
          className="h-5 w-full rounded bg-ink-950 px-1 text-right font-mono text-[11px] text-ink-100 outline-none ring-1 ring-accent/70"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            done.current = false;
            setEditing(true);
          }}
          title="Click to type a value"
          className={cn('truncate text-right font-mono text-[11px] tabular-nums hover:text-white', changed ? 'text-accent-2' : 'text-ink-300')}
        >
          {fmt(value)}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export interface ScrubProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (v: number, transient: boolean) => void;
  format?: (v: number) => string;
}

/** Resolve-style numeric field: drag left/right to change */
export function Scrub({ label, value, min, max, step = 1, defaultValue = 0, onChange, format }: ScrubProps) {
  const st = useRef<{ x: number; v: number; last: number; moved: boolean } | null>(null);
  const fmt = format ?? ((v: number) => v.toFixed(decimalsFor(step)));
  const changed = Math.abs(value - defaultValue) > step * 0.5;
  const pct = ((clampN(value, min, max) - min) / (max - min)) * 100;
  const zero = ((clampN(defaultValue, min, max) - min) / (max - min)) * 100;
  return (
    <div className="flex w-[68px] select-none flex-col items-center gap-0.5">
      <span className={cn('max-w-full truncate text-[10px]', changed ? 'text-ink-200' : 'text-ink-400')}>{label}</span>
      <div
        title={`${label}: drag left/right · Shift = fine · double-click = reset`}
        className={cn(
          'relative h-[22px] w-full cursor-ew-resize touch-none overflow-hidden rounded bg-ink-950 ring-1 transition-colors',
          changed ? 'ring-accent/50' : 'ring-ink-650 hover:ring-ink-500',
        )}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          st.current = { x: e.clientX, v: value, last: value, moved: false };
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (!s.moved && Math.abs(dx) < 2) return;
          s.moved = true;
          const v = clampN(snap(s.v + (dx * (max - min)) / (e.shiftKey ? 2400 : 380), step), min, max);
          if (v !== s.last) {
            s.last = v;
            onChange(v, true);
          }
        }}
        onPointerUp={() => {
          const s = st.current;
          st.current = null;
          if (s?.moved && s.last !== s.v) onChange(s.last, false);
        }}
        onDoubleClick={() => onChange(defaultValue, false)}
      >
        <div className="absolute bottom-0 h-[2px] bg-accent/80" style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%` }} />
        <span className={cn('absolute inset-0 flex items-center justify-center font-mono text-[11px] tabular-nums', changed ? 'text-white' : 'text-ink-200')}>
          {fmt(value)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function PanelHeader({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-ink-700 bg-ink-800 px-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-300">
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export function IconBtn({
  title,
  onClick,
  active,
  disabled,
  children,
  className,
}: {
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-ink-300 transition hover:bg-ink-650 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30',
        active && 'bg-accent/15 text-accent hover:bg-accent/25 hover:text-accent',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-gradient-to-b from-accent-2 to-accent text-white shadow-[0_4px_14px_-4px_rgba(255,107,61,0.6)] hover:brightness-110',
        variant === 'default' && 'bg-ink-700 text-ink-100 ring-1 ring-ink-600 hover:bg-ink-650',
        variant === 'ghost' && 'text-ink-300 hover:bg-ink-700 hover:text-ink-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition',
            value === it.id ? 'bg-ink-650 text-ink-100' : 'text-ink-400 hover:bg-ink-700 hover:text-ink-200',
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, right, note }: { title: string; children: ReactNode; right?: ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          {title}
          {note && <span className="ml-1.5 normal-case tracking-normal text-ink-500">· {note}</span>}
        </h4>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  title?: string;
}) {
  return (
    <select
      value={value}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-7 cursor-pointer rounded bg-ink-900 px-2 text-[11px] text-ink-100 outline-none ring-1 ring-ink-650 hover:ring-ink-500 focus:ring-accent/60',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-200 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
      {children}
    </kbd>
  );
}

export function GithubMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="12" r="7.5" fill="#ff6b3d" fillOpacity="0.92" />
      <circle cx="11.2" cy="19.6" r="7.5" fill="#3dd6ff" fillOpacity="0.8" style={{ mixBlendMode: 'screen' }} />
      <circle cx="20.8" cy="19.6" r="7.5" fill="#a3e635" fillOpacity="0.75" style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
}
