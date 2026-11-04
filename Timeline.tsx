import { useRef } from "react";
import { cn } from "@/utils/cn";
import { NODES, isNodeDirty, type NodeKind, type NodeState } from "@/editor/types";
import type { MediaItem } from "@/editor/project";
import { IconPlus } from "./Icons";

export function NodeStrip({
  nodes,
  adj,
  selected,
  onSelect,
  onToggle,
}: {
  nodes: NodeState;
  adj: MediaItem["adjustments"];
  selected: NodeKind;
  onSelect: (k: NodeKind) => void;
  onToggle: (k: NodeKind) => void;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto px-3 py-2">
      <span className="mr-3 shrink-0 font-display text-[9.5px] font-semibold tracking-[0.2em] text-faint uppercase">
        Node&nbsp;graph
      </span>
      {NODES.map((n, i) => {
        const on = nodes[n.id];
        const live = isNodeDirty(adj, n.id);
        const sel = selected === n.id;
        return (
          <div key={n.id} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              onDoubleClick={() => onToggle(n.id)}
              title={`${on ? "Bypass" : "Enable"} node (double-click)`}
              className={cn(
                "group relative flex h-[34px] w-[104px] flex-col justify-center rounded-[6px] border px-2 text-left transition-all duration-200",
                sel
                  ? on
                    ? "border-amber/60 bg-amber/10 shadow-[0_0_0_1px_rgba(245,165,36,.18),0_8px_22px_-14px_rgba(245,165,36,.9)]"
                    : "border-flame/50 bg-flame/8"
                  : "border-line bg-base/60 hover:border-line2 hover:bg-raise",
                !on && "opacity-55",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn("font-mono text-[8.5px]", sel && on ? "text-amber" : "text-faint")}>
                  {n.code}
                </span>
                <span
                  className={cn(
                    "font-display text-[10.5px] font-medium tracking-wide",
                    sel ? (on ? "text-amber" : "text-flame") : "text-txt/85",
                    !on && "line-through decoration-flame/70",
                  )}
                >
                  {n.label}
                </span>
              </span>
              <span className="mt-[3px] flex items-center gap-1">
                <span
                  className={cn(
                    "h-[3px] w-[3px] rounded-full",
                    on ? (live ? "bg-teal shadow-[0_0_6px_rgba(47,214,195,.9)]" : "bg-line2") : "bg-flame",
                  )}
                />
                <span className="font-mono text-[8px] tracking-wider text-faint uppercase">
                  {on ? (live ? "active" : "neutral") : "bypass"}
                </span>
              </span>
            </button>
            {i < NODES.length - 1 && (
              <svg width="18" height="12" viewBox="0 0 18 12" className="shrink-0">
                <path
                  d="M0 6h13"
                  stroke={on && nodes[NODES[i + 1].id] ? "#3d4653" : "#2a3038"}
                  strokeWidth="1.2"
                  strokeDasharray={on && nodes[NODES[i + 1].id] ? "0" : "2 2"}
                />
                <path d="M12 3l4 3-4 3z" fill={on && nodes[NODES[i + 1].id] ? "#3d4653" : "#2a3038"} />
              </svg>
            )}
          </div>
        );
      })}
      <div className="ml-3 flex shrink-0 items-center gap-2 pl-3">
        <span className="h-6 w-px bg-line" />
        <div className="flex items-center gap-1.5 rounded-[6px] border border-line bg-base/50 px-2 py-1">
          <span className="h-[7px] w-[7px] rounded-full bg-teal shadow-[0_0_8px_rgba(47,214,195,.8)]" />
          <span className="font-mono text-[9px] tracking-wider text-dim uppercase">
            serial · sRGB · 32f float
          </span>
        </div>
      </div>
    </div>
  );
}

export function Timeline({
  items,
  activeId,
  onSelect,
  onAdd,
}: {
  items: MediaItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-1 overflow-x-auto px-3 pt-0.5 pb-2" ref={scrollRef}>
      {items.map((m, i) => {
        const active = m.id === activeId;
        const graded = NODES.some((n) => isNodeDirty(m.adjustments, n.id));
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-[5px] border transition-all duration-200",
              active
                ? "border-amber/70 shadow-[0_0_0_1px_rgba(245,165,36,.22)]"
                : "border-line/80 hover:border-line2",
            )}
            title={m.name}
          >
            <div className="relative h-[52px] w-[92px] bg-[#0d1015]">
              <img
                src={m.thumb}
                alt={m.name}
                draggable={false}
                className={cn(
                  "h-full w-full object-cover transition-all duration-300",
                  active ? "saturate-100" : "saturate-[.6] brightness-[.82] group-hover:brightness-100 group-hover:saturate-90",
                )}
              />
              <span
                className={cn(
                  "absolute top-0 left-0 h-full w-[2px] transition-colors",
                  active ? "bg-amber" : "bg-transparent",
                )}
              />
              <span className="absolute bottom-0.5 left-1 rounded-[2px] bg-[#07080a]/80 px-1 font-mono text-[8px] text-dim">
                {String(i + 1).padStart(2, "0")}
              </span>
              {graded && (
                <span className="absolute top-1 right-1 flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#07080a]/85">
                  <span className="h-[5px] w-[5px] rounded-full bg-teal" />
                </span>
              )}
            </div>
            <div
              className={cn(
                "max-w-[92px] truncate px-1 py-[3px] text-left text-[9px] transition-colors",
                active ? "bg-amber/12 text-amber" : "bg-base/70 text-faint group-hover:text-dim",
              )}
            >
              {m.name}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-[69px] w-[62px] shrink-0 flex-col items-center justify-center gap-1 rounded-[5px] border border-dashed border-line2 text-faint transition-colors hover:border-teal/60 hover:bg-teal/5 hover:text-teal"
      >
        <IconPlus width={14} height={14} />
        <span className="text-[8.5px] tracking-wider uppercase">Add</span>
      </button>
    </div>
  );
}
