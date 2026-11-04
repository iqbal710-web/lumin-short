import { useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { LOOKS, isNodeDirty, type Look } from "@/editor/types";
import { formatBytes, type MediaItem } from "@/editor/project";
import { PanelHead, SegTabs, Tag } from "./ui";
import { IconFolder, IconImage, IconPlus, IconTrash, IconLayers } from "./Icons";

type Tab = "media" | "looks";

export function LeftDock({
  items,
  activeId,
  onSelect,
  onRemove,
  onFiles,
  onOpenPicker,
  onApplyLook,
  onPreviewLook,
  activeLookId,
}: {
  items: MediaItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onFiles: (files: FileList | File[]) => void;
  onOpenPicker: () => void;
  onApplyLook: (look: Look) => void;
  onPreviewLook: (look: Look | null) => void;
  activeLookId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("media");
  const [dropOn, setDropOn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="hidden h-full w-[236px] shrink-0 flex-col border-r border-line bg-panel/55 panel-edge xl:flex">
      <PanelHead
        title={tab === "media" ? "Media Pool" : "Look Library"}
        code={tab === "media" ? `${items.length} clips` : `${LOOKS.length} looks`}
        accent={tab === "media" ? "teal" : "magenta"}
        right={
          tab === "media" ? (
            <button
              type="button"
              title="Import media"
              onClick={onOpenPicker}
              className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-line2 text-dim transition-colors hover:border-teal/60 hover:text-teal"
            >
              <IconPlus width={11} height={11} />
            </button>
          ) : undefined
        }
      />
      <div className="px-2 pt-2">
        <SegTabs
          items={[
            { id: "media", label: "Media", icon: <IconImage width={11} height={11} /> },
            { id: "looks", label: "Looks", icon: <IconLayers width={11} height={11} /> },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={cn("min-h-0 flex-1 overflow-y-auto p-2", dropOn && "bg-teal/5")}
        onDragOver={(e) => {
          e.preventDefault();
          setDropOn(true);
        }}
        onDragLeave={() => setDropOn(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropOn(false);
          if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
        }}
      >
        {tab === "media" ? (
          <div className="grid grid-cols-2 gap-2">
            {items.map((m, i) => {
              const active = m.id === activeId;
              const graded = isNodeDirty(m.adjustments, "primary") ||
                isNodeDirty(m.adjustments, "wheels") ||
                isNodeDirty(m.adjustments, "curves") ||
                isNodeDirty(m.adjustments, "split") ||
                isNodeDirty(m.adjustments, "fx");
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[6px] border text-left transition-all duration-200",
                    active
                      ? "border-amber/70 shadow-[0_0_0_1px_rgba(245,165,36,.25),0_10px_26px_-16px_rgba(245,165,36,.8)]"
                      : "border-line hover:border-line2 hover:-translate-y-[1px]",
                  )}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-[#0d1015]">
                    <img
                      src={m.thumb}
                      alt={m.name}
                      className={cn(
                        "h-full w-full object-cover transition-all duration-300",
                        active ? "scale-100 saturate-100" : "saturate-[.72] group-hover:scale-[1.04] group-hover:saturate-100",
                      )}
                      draggable={false}
                    />
                    <span className="absolute top-1 left-1 rounded-[3px] bg-[#07080a]/80 px-1 font-mono text-[8.5px] text-dim">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {graded && (
                      <span className="absolute top-1 right-1 h-[6px] w-[6px] rounded-full bg-amber shadow-[0_0_8px_rgba(245,165,36,.9)]" />
                    )}
                    {m.origin === "sample" && (
                      <span className="absolute bottom-1 left-1 rounded-[3px] bg-[#07080a]/75 px-1 font-mono text-[8px] tracking-wider text-teal/90 uppercase">
                        demo
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={-1}
                      title="Remove clip"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(m.id);
                      }}
                      className="absolute right-1 bottom-1 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-[4px] bg-[#07080a]/85 text-faint opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-flame"
                    >
                      <IconTrash width={11} height={11} />
                    </span>
                  </div>
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[10px] leading-tight text-txt/85">{m.name}</p>
                    <p className="tabular truncate font-mono text-[8.5px] text-faint">
                      {m.w}×{m.h} · {formatBytes(m.bytes)}
                    </p>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[3/4.1] flex-col items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-line2 text-faint transition-colors hover:border-teal/60 hover:bg-teal/5 hover:text-teal"
            >
              <IconFolder width={16} height={16} />
              <span className="px-2 text-center text-[9.5px] leading-tight">
                Import
                <br />
                images
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="mb-0.5 flex items-center gap-1.5 text-[9.5px] leading-tight text-faint">
              <span className="h-px flex-1 bg-line" />
              hover to preview · click to apply
              <span className="h-px flex-1 bg-line" />
            </p>
            {LOOKS.map((look) => {
              const on = activeLookId === look.id;
              return (
                <button
                  key={look.id}
                  type="button"
                  onMouseEnter={() => onPreviewLook(look)}
                  onMouseLeave={() => onPreviewLook(null)}
                  onFocus={() => onPreviewLook(look)}
                  onBlur={() => onPreviewLook(null)}
                  onClick={() => onApplyLook(look)}
                  className={cn(
                    "group relative flex items-center gap-2 overflow-hidden rounded-[6px] border px-2 py-1.5 text-left transition-all duration-200",
                    on
                      ? "border-amber/60 bg-amber/8"
                      : "border-line bg-base/40 hover:border-line2 hover:bg-raise/70 hover:translate-x-[2px]",
                  )}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-[4px] border border-white/10"
                    style={{
                      background: `linear-gradient(140deg, ${look.swatch[0]} 0%, ${look.swatch[1]} 100%)`,
                      boxShadow: on ? `0 0 14px -3px ${look.swatch[1]}` : "none",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-display text-[11px] font-medium transition-colors",
                        on ? "text-amber" : "text-txt/85 group-hover:text-txt",
                      )}
                    >
                      {look.name}
                    </span>
                    <span className="block truncate font-mono text-[8.5px] tracking-wider text-faint uppercase">
                      {look.family}
                    </span>
                  </span>
                  {on && <Tag tone="amber">on</Tag>}
                </button>
              );
            })}
            <div className="mt-1 rounded-[6px] border border-line bg-base/40 p-2">
              <p className="font-display text-[10px] font-semibold tracking-[0.14em] text-dim uppercase">
                Look stack
              </p>
              <p className="mt-1 text-[9.5px] leading-relaxed text-faint">
                Looks replace the current grade. Fine-tune afterwards with the wheels &amp; curves — the
                node pipeline stays fully editable.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
