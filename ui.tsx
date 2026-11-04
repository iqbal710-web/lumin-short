import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";
import { IconChevron, IconReset } from "./Icons";
import { clamp } from "@/editor/types";

/* ---------------------------------------------------------------- Btn */

type BtnProps = {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost" | "outline" | "danger";
  size?: "xs" | "sm" | "md";
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
  icon?: ReactNode;
};

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "sm",
  active,
  disabled,
  title,
  className,
  icon,
}: BtnProps) {
  const sizes = {
    xs: "h-6 px-2 text-[10px] gap-1",
    sm: "h-7 px-2.5 text-[11px] gap-1.5",
    md: "h-9 px-4 text-[12px] gap-2",
  }[size];
  const variants = {
    solid:
      "bg-amber text-[#1a1206] font-semibold hover:bg-[#ffb93d] shadow-[0_6px_18px_-8px_rgba(245,165,36,.9)]",
    outline: "border border-line2 text-txt hover:border-amber/70 hover:text-amber bg-raise/60",
    ghost: "text-dim hover:text-txt hover:bg-raise2",
    danger: "text-flame/90 hover:bg-flame/12 hover:text-flame",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "no-select inline-flex items-center justify-center rounded-[5px] tracking-wide uppercase transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber/70",
        sizes,
        variants,
        active && variant !== "solid" && "bg-amber/14 text-amber shadow-[inset_0_0_0_1px_rgba(245,165,36,.32)]",
        disabled && "pointer-events-none opacity-35",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------- PanelHeader */

export function PanelHead({
  title,
  code,
  right,
  accent = "amber",
}: {
  title: string;
  code?: string;
  right?: ReactNode;
  accent?: "amber" | "teal" | "magenta" | "sky";
}) {
  const c = {
    amber: "bg-amber",
    teal: "bg-teal",
    magenta: "bg-magenta",
    sky: "bg-sky",
  }[accent];
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-panel/80 px-2.5">
      <span className={cn("h-3 w-[2px] rounded-full", c)} />
      <h2 className="font-display text-[11px] font-semibold tracking-[0.16em] text-txt/90 uppercase">
        {title}
      </h2>
      {code && <span className="font-mono text-[9px] text-faint">{code}</span>}
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </div>
  );
}

/* ----------------------------------------------------------- Section */

export function Section({
  label,
  children,
  defaultOpen = true,
  right,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line/70">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex h-7 flex-1 items-center gap-1.5 px-2.5 text-left"
        >
          <IconChevron
            width={11}
            height={11}
            className={cn("text-faint transition-transform duration-200", open ? "rotate-90" : "")}
          />
          <span
            className={cn(
              "font-display text-[10px] font-medium tracking-[0.18em] uppercase transition-colors",
              open ? "text-dim" : "text-faint group-hover:text-dim",
            )}
          >
            {label}
          </span>
        </button>
        <div className="pr-2">{right}</div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-250 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2.5 pt-0.5 pb-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- ProSlider */

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  def?: number;
  step?: number;
  bipolar?: boolean;
  digits?: number;
  unit?: string;
  accent?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  onCommit?: () => void;
};

export function ProSlider({
  label,
  value,
  min,
  max,
  def = 0,
  step = 0.01,
  bipolar,
  digits = 2,
  unit = "",
  accent = "var(--color-amber)",
  disabled,
  onChange,
  onCommit,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);
  const bp = bipolar ?? (min < 0 && max > 0);
  const id = useId();

  const bi = bp ? clamp(def, min, max) : min;
  const zeroT = ((bi - min) / (max - min)) * 100;
  const t = ((value - min) / (max - min)) * 100;
  const left = Math.min(zeroT, t);
  const width = Math.abs(t - zeroT);
  const dirty = Math.abs(value - def) > step / 2;

  const setFromClient = useCallback(
    (clientX: number, fine: boolean) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
      let v = min + p * (max - min);
      if (fine) v = value + (v - value) * 0.18;
      v = Math.round(v / step) * step;
      onChange(clamp(v, min, max));
    },
    [max, min, onChange, step, value],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setFromClient(e.clientX, e.shiftKey);
    const up = () => {
      setDrag(false);
      onCommit?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, onCommit, setFromClient]);

  const shown = value.toFixed(digits) + unit;

  return (
    <div
      className={cn(
        "group/sl relative flex h-[22px] items-center gap-2 rounded-[4px] pr-1 transition-colors",
        hover && "bg-raise/70",
        disabled && "pointer-events-none opacity-40",
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <label
        htmlFor={id}
        className="w-[74px] shrink-0 cursor-default truncate text-[10.5px] tracking-wide text-dim group-hover/sl:text-txt/85"
      >
        {label}
      </label>
      <div
        id={id}
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="relative h-[18px] flex-1 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          (e.target as HTMLElement).focus?.();
          setDrag(true);
          setFromClient(e.clientX, e.shiftKey);
        }}
        onDoubleClick={() => {
          onChange(def);
          onCommit?.();
        }}
        onWheel={(e) => {
          const d = Math.sign(e.deltaY) * -step * (e.shiftKey ? 1 : 4);
          onChange(clamp(Math.round((value + d) / step) * step, min, max));
        }}
        onKeyDown={(e) => {
          const mult = e.shiftKey ? 1 : 4;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            onChange(clamp(value - step * mult, min, max));
            e.preventDefault();
          } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            onChange(clamp(value + step * mult, min, max));
            e.preventDefault();
          } else if (e.key === "Home") {
            onChange(min);
            e.preventDefault();
          } else if (e.key === "End") {
            onChange(max);
            e.preventDefault();
          } else if (e.key === "Backspace") {
            onChange(def);
            e.preventDefault();
          }
        }}
      >
        {/* rail */}
        <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#20252d]" />
        {bp && (
          <div
            className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-line2"
            style={{ left: `${zeroT}%` }}
          />
        )}
        {/* fill */}
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-[background] duration-150"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: dirty ? accent : "#39414d",
            boxShadow: dirty && drag ? `0 0 10px ${accent}` : "none",
          }}
        />
        {/* knob */}
        <div
          className={cn(
            "absolute top-1/2 h-[13px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border transition-all duration-100",
            drag ? "h-[16px] w-[7px]" : "",
          )}
          style={{
            left: `${t}%`,
            background: dirty ? "#f2f5f9" : "#8b95a3",
            borderColor: "#0a0c0f",
            boxShadow: drag ? `0 0 0 3px ${accent}22` : "0 1px 3px rgba(0,0,0,.6)",
          }}
        />
      </div>
      <div className="flex w-[52px] shrink-0 items-center justify-end gap-1">
        {dirty && (
          <button
            type="button"
            title="Reset"
            onClick={() => {
              onChange(def);
              onCommit?.();
            }}
            className="text-faint opacity-0 transition-opacity group-hover/sl:opacity-100 hover:text-amber"
          >
            <IconReset width={11} height={11} />
          </button>
        )}
        <span
          className={cn(
            "tabular font-mono text-[10px] leading-none",
            dirty ? "text-txt" : "text-faint",
          )}
        >
          {shown}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Tabs */

export function SegTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(0, items.findIndex((i) => i.id === value));
  return (
    <div className={cn("relative flex rounded-[6px] border border-line bg-base/70 p-[3px]", className)}>
      <div
        className="pointer-events-none absolute top-[3px] bottom-[3px] rounded-[4px] bg-raise2 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition-all duration-300 ease-[cubic-bezier(.2,.9,.3,1)]"
        style={{
          left: `calc(3px + ${(idx / items.length) * 100}% - ${(idx / items.length) * 6}px)`,
          width: `calc(${100 / items.length}% - ${6 / items.length}px)`,
        }}
      />
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            "relative z-[1] flex-1 whitespace-nowrap px-2 py-1 text-[10px] font-medium tracking-[0.1em] uppercase transition-colors duration-200",
            it.id === value ? "text-amber" : "text-faint hover:text-dim",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {it.icon}
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- misc */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line2 bg-raise px-1 font-mono text-[9.5px] text-dim shadow-[0_1px_0_#0a0c0f]">
      {children}
    </kbd>
  );
}

export function Tag({
  children,
  tone = "dim",
  className,
}: {
  children: ReactNode;
  tone?: "dim" | "amber" | "teal" | "magenta" | "flame" | "lime";
  className?: string;
}) {
  const tones = {
    dim: "border-line2 text-faint",
    amber: "border-amber/40 text-amber bg-amber/10",
    teal: "border-teal/40 text-teal bg-teal/10",
    magenta: "border-magenta/40 text-magenta bg-magenta/10",
    flame: "border-flame/40 text-flame bg-flame/10",
    lime: "border-lime/40 text-lime bg-lime/10",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] border px-1.5 py-[1px] font-mono text-[9px] tracking-wider uppercase",
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  tone = "amber",
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  tone?: "amber" | "teal";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="group flex items-center gap-1.5"
      title={label}
    >
      <span
        className={cn(
          "relative h-[13px] w-[24px] rounded-full border transition-colors duration-200",
          on
            ? tone === "amber"
              ? "border-amber/60 bg-amber/25"
              : "border-teal/60 bg-teal/25"
            : "border-line2 bg-[#151a20]",
        )}
      >
        <span
          className={cn(
            "absolute top-[1.5px] h-[8px] w-[8px] rounded-full transition-all duration-200",
            on ? (tone === "amber" ? "left-[13px] bg-amber" : "left-[13px] bg-teal") : "left-[2px] bg-[#4b5563]",
          )}
        />
      </span>
      {label && (
        <span className={cn("text-[10px] tracking-wide transition-colors", on ? "text-txt/80" : "text-faint")}>
          {label}
        </span>
      )}
    </button>
  );
}
