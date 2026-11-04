import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { clamp, wheelFull, type Wheel } from "@/editor/types";

const R = 0.44; // puck travel radius as fraction of wheel box

export function ColorWheel({
  name,
  hint,
  value,
  onChange,
  onCommit,
  accent,
}: {
  name: string;
  hint: string;
  value: Wheel;
  onChange: (w: Wheel) => void;
  onCommit?: () => void;
  accent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);

  const rgb = wheelFull(value);
  const puckColor = `rgb(${Math.round(clamp(128 + rgb[0] * 210, 0, 255))},${Math.round(
    clamp(128 + rgb[1] * 210, 0, 255),
  )},${Math.round(clamp(128 + rgb[2] * 210, 0, 255))})`;

  const setFrom = useCallback(
    (clientX: number, clientY: number, fine: boolean) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let nx = (clientX - (r.left + r.width / 2)) / (r.width * R);
      let ny = (clientY - (r.top + r.height / 2)) / (r.height * R);
      const len = Math.hypot(nx, ny);
      if (len > 1) {
        nx /= len;
        ny /= len;
      }
      if (fine) {
        nx = value.x + (nx - value.x) * 0.2;
        ny = value.y + (ny - value.y) * 0.2;
      }
      onChange({ ...value, x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) });
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setFrom(e.clientX, e.clientY, e.shiftKey);
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
  }, [drag, onCommit, setFrom]);

  const dirty = value.x !== 0 || value.y !== 0 || value.master !== 0;

  return (
    <div
      className="group/w rounded-[7px] border border-line/80 bg-panel/60 p-2 transition-colors duration-200"
      style={hover ? { borderColor: `${accent}44` } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span
          className="font-display text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: dirty ? accent : "#8d97a5" }}
        >
          {name}
        </span>
        <span className="font-mono text-[8.5px] tracking-wider text-faint uppercase">{hint}</span>
      </div>

      <div
        ref={ref}
        className="relative aspect-square w-full cursor-crosshair touch-none rounded-full"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).focus?.();
          setDrag(true);
          setFrom(e.clientX, e.clientY, e.shiftKey);
        }}
        onDoubleClick={() => {
          onChange({ x: 0, y: 0, master: 0 });
          onCommit?.();
        }}
        role="application"
        aria-label={`${name} color wheel`}
        tabIndex={0}
        onKeyDown={(e) => {
          const s = e.shiftKey ? 0.02 : 0.08;
          const map: Record<string, [number, number]> = {
            ArrowLeft: [-s, 0],
            ArrowRight: [s, 0],
            ArrowUp: [0, -s],
            ArrowDown: [0, s],
          };
          if (map[e.key]) {
            const [dx, dy] = map[e.key];
            const nx = clamp(value.x + dx, -1, 1);
            const ny = clamp(value.y + dy, -1, 1);
            const l = Math.hypot(nx, ny) || 1;
            onChange({ ...value, x: l > 1 ? nx / l : nx, y: l > 1 ? ny / l : ny });
            e.preventDefault();
          } else if (e.key === "Backspace" || e.key === "Escape") {
            onChange({ x: 0, y: 0, master: 0 });
            e.preventDefault();
          }
        }}
      >
        {/* colour field */}
        <div className="wheel-face absolute inset-0 rounded-full opacity-80 saturate-[.62]" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(17,20,26,.98) 0 13%, rgba(17,20,26,.8) 30%, rgba(17,20,26,.28) 52%, rgba(17,20,26,0) 66%)",
          }}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-shadow duration-200",
            drag ? "shadow-[0_0_0_1px_rgba(255,255,255,.18),0_0_26px_-6px_rgba(245,165,36,.6)]" : "",
          )}
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07), inset 0 6px 18px -10px #000" }}
        />
        {/* crosshair + rings */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="0.5" />
          <path d="M50 4v10M50 86v10M4 50h10M86 50h10" stroke="rgba(255,255,255,.16)" strokeWidth="0.6" />
          <line
            x1="50"
            y1="50"
            x2={50 + value.x * 44}
            y2={50 + value.y * 44}
            stroke={dirty ? accent : "rgba(255,255,255,.25)"}
            strokeWidth="0.9"
            opacity={dirty ? 0.85 : 0.5}
          />
        </svg>
        {/* puck */}
        <div
          className={cn(
            "pointer-events-none absolute h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform duration-100",
            drag ? "scale-110" : "",
          )}
          style={{
            left: `${50 + value.x * R * 100}%`,
            top: `${50 + value.y * R * 100}%`,
            background: puckColor,
            borderColor: "#0a0c0f",
            boxShadow: `0 0 0 1.5px rgba(255,255,255,.75), 0 2px 8px rgba(0,0,0,.8)${
              drag ? `, 0 0 16px ${accent}` : ""
            }`,
          }}
        />
      </div>

      {/* master */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="w-[26px] font-mono text-[8.5px] tracking-wider text-faint uppercase">Mstr</span>
        <div
          className="relative h-[14px] flex-1 cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            const el = e.currentTarget;
            const move = (ev: PointerEvent) => {
              const r = el.getBoundingClientRect();
              const p = clamp((ev.clientX - r.left) / r.width, 0, 1);
              onChange({ ...value, master: Math.round((p * 2 - 1) * 100) / 100 });
            };
            move(e.nativeEvent);
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              onCommit?.();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
          onDoubleClick={() => onChange({ ...value, master: 0 })}
        >
          <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#20252d]" />
          <div className="absolute top-1/2 left-1/2 h-[7px] w-px -translate-y-1/2 bg-line2" />
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            style={{
              left: `${Math.min(50, 50 + value.master * 50)}%`,
              width: `${Math.abs(value.master) * 50}%`,
              background: value.master !== 0 ? accent : "#39414d",
            }}
          />
          <div
            className="absolute top-1/2 h-[11px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#0a0c0f]"
            style={{
              left: `${50 + value.master * 50}%`,
              background: value.master !== 0 ? "#f2f5f9" : "#8b95a3",
            }}
          />
        </div>
        <span
          className={cn(
            "tabular w-[30px] text-right font-mono text-[9px]",
            value.master !== 0 ? "text-txt" : "text-faint",
          )}
        >
          {value.master > 0 ? "+" : ""}
          {value.master.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
