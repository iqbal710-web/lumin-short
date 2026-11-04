import { cn } from "@/utils/cn";
import {
  NODES,
  clamp,
  hsvToRgb,
  isNodeDirty,
  type Adjustments,
  type Curves,
  type NodeKind,
  type NodeState,
  type Pt,
} from "@/editor/types";
import { ProSlider, Section, Btn, Toggle } from "./ui";
import { ColorWheel } from "./ColorWheel";
import { CurvesEditor } from "./CurvesEditor";
import {
  IconCurve,
  IconPower,
  IconReset,
  IconSliders,
  IconSparkle,
  IconSplit,
  IconWheel,
} from "./Icons";

const RAIL: { id: NodeKind; icon: React.ReactNode; title: string }[] = [
  { id: "primary", icon: <IconSliders width={15} height={15} />, title: "Primary bars" },
  { id: "wheels", icon: <IconWheel width={15} height={15} />, title: "Color wheels" },
  { id: "curves", icon: <IconCurve width={15} height={15} />, title: "Custom curves" },
  { id: "split", icon: <IconSplit width={15} height={15} />, title: "Split toning" },
  { id: "fx", icon: <IconSparkle width={15} height={15} />, title: "FX & finish" },
];

const CURVE_PRESETS: { name: string; pts: Pt[] }[] = [
  {
    name: "Linear",
    pts: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: "S-Curve",
    pts: [
      { x: 0, y: 0 },
      { x: 0.28, y: 0.2 },
      { x: 0.68, y: 0.82 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: "Fade",
    pts: [
      { x: 0, y: 0.09 },
      { x: 0.5, y: 0.52 },
      { x: 1, y: 0.93 },
    ],
  },
  {
    name: "Punch",
    pts: [
      { x: 0, y: 0 },
      { x: 0.2, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.8, y: 0.9 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: "Print",
    pts: [
      { x: 0, y: 0.035 },
      { x: 0.3, y: 0.25 },
      { x: 0.74, y: 0.79 },
      { x: 1, y: 0.965 },
    ],
  },
];

function HueBar({
  hue,
  onChange,
  onCommit,
}: {
  hue: number;
  onChange: (h: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div
      className="relative h-[16px] w-full cursor-ew-resize touch-none overflow-hidden rounded-[4px] border border-line"
      style={{
        background:
          "linear-gradient(90deg,#ff4d4d,#ffd24d,#7dff4d,#4dffd2,#4d8cff,#c34dff,#ff4dc3,#ff4d4d)",
      }}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        const move = (ev: PointerEvent) => {
          const r = el.getBoundingClientRect();
          onChange(Math.round(clamp((ev.clientX - r.left) / r.width, 0, 1) * 360) % 360);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          onCommit?.();
        };
        move(e.nativeEvent);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.28),transparent_45%,rgba(0,0,0,.35))]" />
      <div
        className="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.75)]"
        style={{ left: `${(hue / 360) * 100}%` }}
      />
    </div>
  );
}

function TintSwatch({ hue, amt }: { hue: number; amt: number }) {
  const [r, g, b] = hsvToRgb(hue, 0.6, 1);
  return (
    <span
      className="h-[16px] w-[26px] shrink-0 rounded-[3px] border border-white/12 transition-all duration-200"
      style={{
        background: `rgb(${Math.round(28 + (r * 255 - 28) * amt)},${Math.round(
          28 + (g * 255 - 28) * amt,
        )},${Math.round(28 + (b * 255 - 28) * amt)})`,
        boxShadow: amt > 0.02 ? `0 0 12px -3px rgba(${r * 255},${g * 255},${b * 255},.9)` : "none",
      }}
    />
  );
}

export function ToolDock({
  adj,
  nodes,
  tab,
  onTab,
  patch,
  commit,
  onResetNode,
  onToggleNode,
  onAuto,
  lumaHist,
  lumaPeak,
}: {
  adj: Adjustments;
  nodes: NodeState;
  tab: NodeKind;
  onTab: (t: NodeKind) => void;
  patch: (p: Partial<Adjustments>) => void;
  commit: () => void;
  onResetNode: (k: NodeKind) => void;
  onToggleNode: (k: NodeKind) => void;
  onAuto?: () => void;
  lumaHist?: Uint32Array;
  lumaPeak?: number;
}) {
  const meta = NODES.find((n) => n.id === tab)!;
  const dirty = isNodeDirty(adj, tab);
  const enabled = nodes[tab];
  const s = (p: Partial<Adjustments>) => {
    patch(p);
  };
  const cur = (c: Curves) => s({ curves: c });

  return (
    <aside className="flex h-full w-[262px] shrink-0 flex-col border-l border-line bg-panel/55 panel-edge lg:w-[290px]">
      {/* tool rail */}
      <div className="flex shrink-0 items-stretch gap-0.5 border-b border-line bg-base/60 px-1.5 py-1.5">
        {RAIL.map((r) => {
          const on = tab === r.id;
          const live = isNodeDirty(adj, r.id);
          return (
            <button
              key={r.id}
              type="button"
              title={r.title}
              onClick={() => onTab(r.id)}
              className={cn(
                "group relative flex h-8 flex-1 items-center justify-center rounded-[5px] border transition-all duration-200",
                on
                  ? "border-amber/45 bg-amber/12 text-amber"
                  : "border-transparent text-faint hover:border-line2 hover:bg-raise hover:text-dim",
                !nodes[r.id] && "opacity-40",
              )}
            >
              {r.icon}
              {live && (
                <span
                  className={cn(
                    "absolute right-1 bottom-1 h-[4px] w-[4px] rounded-full",
                    on ? "bg-amber" : "bg-teal",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* node header */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-panel/80 px-2.5">
        <span className="font-mono text-[9px] text-faint">{meta.code}</span>
        <h2 className="font-display text-[11.5px] font-semibold tracking-[0.14em] text-txt uppercase">
          {meta.label}
        </h2>
        {dirty && (
          <span className="h-[5px] w-[5px] rounded-full bg-amber shadow-[0_0_7px_rgba(245,165,36,.9)]" />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Toggle on={enabled} onChange={() => onToggleNode(tab)} tone="teal" />
          <button
            type="button"
            title={enabled ? "Bypass node" : "Enable node"}
            onClick={() => onToggleNode(tab)}
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition-colors",
              enabled
                ? "border-line2 text-dim hover:text-txt"
                : "border-flame/50 bg-flame/12 text-flame",
            )}
          >
            <IconPower width={11} height={11} />
          </button>
          <button
            type="button"
            title="Reset this node"
            onClick={() => onResetNode(tab)}
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition-colors",
              dirty ? "border-line2 text-dim hover:border-amber/60 hover:text-amber" : "border-line text-faint/50",
            )}
          >
            <IconReset width={11} height={11} />
          </button>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto", !enabled && "opacity-45")}>
        {tab === "primary" && (
          <>
            <Section
              label="Tone"
              right={
                <Btn size="xs" variant="outline" onClick={onAuto} title="Analyse the source pixels and balance exposure, contrast and white point">
                  Auto
                </Btn>
              }
            >
              <ProSlider label="Exposure" value={adj.exposure} min={-2} max={2} step={0.01} unit=" EV" onChange={(v) => s({ exposure: v })} onCommit={commit} />
              <ProSlider label="Contrast" value={adj.contrast} min={-1} max={1} onChange={(v) => s({ contrast: v })} onCommit={commit} />
              <ProSlider label="Pivot" value={adj.pivot} min={0} max={1} def={0.5} bipolar={false} onChange={(v) => s({ pivot: v })} onCommit={commit} />
              <ProSlider label="Highlights" value={adj.highlights} min={-1} max={1} accent="var(--color-sky)" onChange={(v) => s({ highlights: v })} onCommit={commit} />
              <ProSlider label="Shadows" value={adj.shadows} min={-1} max={1} accent="var(--color-sky)" onChange={(v) => s({ shadows: v })} onCommit={commit} />
              <ProSlider label="Whites" value={adj.whites} min={-1} max={1} accent="var(--color-teal)" onChange={(v) => s({ whites: v })} onCommit={commit} />
              <ProSlider label="Blacks" value={adj.blacks} min={-1} max={1} accent="var(--color-teal)" onChange={(v) => s({ blacks: v })} onCommit={commit} />
            </Section>
            <Section label="White balance">
              <ProSlider label="Temp" value={adj.temperature} min={-1} max={1} accent="#f0a13c" onChange={(v) => s({ temperature: v })} onCommit={commit} />
              <ProSlider label="Tint" value={adj.tint} min={-1} max={1} accent="#8ed15a" onChange={(v) => s({ tint: v })} onCommit={commit} />
              <div className="mt-1 flex items-center gap-1">
                <Btn size="xs" variant="outline" onClick={() => { s({ temperature: -0.22 }); commit(); }}>Cool</Btn>
                <Btn size="xs" variant="outline" onClick={() => { s({ temperature: 0 }); commit(); }}>Neutral</Btn>
                <Btn size="xs" variant="outline" onClick={() => { s({ temperature: 0.24 }); commit(); }}>Warm</Btn>
              </div>
            </Section>
            <Section label="Color">
              <ProSlider label="Vibrance" value={adj.vibrance} min={-1} max={1} accent="var(--color-magenta)" onChange={(v) => s({ vibrance: v })} onCommit={commit} />
              <ProSlider label="Saturation" value={adj.saturation} min={0} max={2} def={1} bipolar={false} accent="var(--color-magenta)" onChange={(v) => s({ saturation: v })} onCommit={commit} />
              <div className="mt-1 flex items-center gap-1">
                <Btn size="xs" variant="outline" onClick={() => { s({ saturation: 0 }); commit(); }}>Mono</Btn>
                <Btn size="xs" variant="outline" onClick={() => { s({ saturation: 1, vibrance: 0.18 }); commit(); }}>Natural</Btn>
                <Btn size="xs" variant="outline" onClick={() => { s({ saturation: 1.35, vibrance: 0.3 }); commit(); }}>Punch</Btn>
              </div>
            </Section>
          </>
        )}

        {tab === "wheels" && (
          <div className="p-2">
            <div className="grid grid-cols-2 gap-2">
              <ColorWheel name="Lift" hint="shadows" accent="#4f9cf9" value={adj.lift} onChange={(w) => s({ lift: w })} onCommit={commit} />
              <ColorWheel name="Gamma" hint="mids" accent="#8ed15a" value={adj.gamma} onChange={(w) => s({ gamma: w })} onCommit={commit} />
              <ColorWheel name="Gain" hint="highlights" accent="#f5a524" value={adj.gain} onChange={(w) => s({ gain: w })} onCommit={commit} />
              <ColorWheel name="Offset" accent="#ec5f9e" hint="global" value={adj.offset} onChange={(w) => s({ offset: w })} onCommit={commit} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              <Btn size="xs" variant="outline" onClick={() => { s({ lift: { x: -0.35, y: 0.1, master: 0 }, gain: { x: 0.26, y: -0.04, master: 0 } }); commit(); }}>
                Teal / Orange
              </Btn>
              <Btn size="xs" variant="outline" onClick={() => { s({ lift: { x: 0.1, y: 0.28, master: 0 }, gain: { x: 0.14, y: -0.18, master: 0.04 } }); commit(); }}>
                Cross process
              </Btn>
              <Btn size="xs" variant="outline" onClick={() => { s({ lift: { x: 0, y: 0, master: -0.06 }, gamma: { x: 0, y: 0, master: 0.03 }, gain: { x: 0, y: 0, master: 0.06 } }); commit(); }}>
                Filmic roll
              </Btn>
              <Btn size="xs" variant="outline" onClick={() => { s({ lift: { x: 0, y: 0, master: 0 }, gamma: { x: 0, y: 0, master: 0 }, gain: { x: 0, y: 0, master: 0 }, offset: { x: 0, y: 0, master: 0 } }); commit(); }}>
                Reset wheels
              </Btn>
            </div>
            <p className="mt-2 rounded-[5px] border border-line bg-base/40 p-2 text-[9.5px] leading-relaxed text-faint">
              Drag inside a wheel to push that tonal range toward a hue. Master slider under each wheel
              moves brightness only. <span className="text-dim">Shift</span> = fine,{" "}
              <span className="text-dim">double-click</span> = reset.
            </p>
          </div>
        )}

        {tab === "curves" && (
          <div className="p-2">
            <CurvesEditor
              curves={adj.curves}
              onChange={cur}
              onCommit={commit}
              lumaHist={lumaHist}
              lumaPeak={lumaPeak}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {CURVE_PRESETS.map((cp) => (
                <Btn
                  key={cp.name}
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    cur({ ...adj.curves, master: cp.pts.map((q) => ({ ...q })) });
                    commit();
                  }}
                >
                  {cp.name}
                </Btn>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              <Btn size="xs" variant="outline" onClick={() => {
                const c = adj.curves;
                cur({
                  ...c,
                  red: [{ x: 0, y: 0.03 }, { x: 0.5, y: 0.52 }, { x: 1, y: 1 }],
                  blue: [{ x: 0, y: 0 }, { x: 0.5, y: 0.47 }, { x: 1, y: 0.97 }],
                });
                commit();
              }}>
                Warm split
              </Btn>
              <Btn size="xs" variant="outline" onClick={() => {
                cur({
                  master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                  red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                  green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                  blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                });
                commit();
              }}>
                Reset all curves
              </Btn>
            </div>
          </div>
        )}

        {tab === "split" && (
          <div className="p-2.5 space-y-3">
            <div className="rounded-[6px] border border-line bg-base/40 p-2">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-display text-[10px] font-semibold tracking-[0.16em] text-sky uppercase">
                  Shadow tint
                </span>
                <span className="ml-auto tabular font-mono text-[9px] text-faint">
                  {Math.round(adj.shadowHue)}° · {Math.round(adj.shadowAmt * 100)}%
                </span>
                <TintSwatch hue={adj.shadowHue} amt={adj.shadowAmt} />
              </div>
              <HueBar hue={adj.shadowHue} onChange={(h) => s({ shadowHue: h, shadowAmt: adj.shadowAmt || 0.25 })} onCommit={commit} />
              <div className="mt-1.5">
                <ProSlider label="Amount" value={adj.shadowAmt} min={0} max={1} bipolar={false} accent="var(--color-sky)" onChange={(v) => s({ shadowAmt: v })} onCommit={commit} />
              </div>
            </div>

            <div className="rounded-[6px] border border-line bg-base/40 p-2">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-display text-[10px] font-semibold tracking-[0.16em] text-amber uppercase">
                  Highlight tint
                </span>
                <span className="ml-auto tabular font-mono text-[9px] text-faint">
                  {Math.round(adj.highHue)}° · {Math.round(adj.highAmt * 100)}%
                </span>
                <TintSwatch hue={adj.highHue} amt={adj.highAmt} />
              </div>
              <HueBar hue={adj.highHue} onChange={(h) => s({ highHue: h, highAmt: adj.highAmt || 0.25 })} onCommit={commit} />
              <div className="mt-1.5">
                <ProSlider label="Amount" value={adj.highAmt} min={0} max={1} bipolar={false} accent="var(--color-amber)" onChange={(v) => s({ highAmt: v })} onCommit={commit} />
              </div>
            </div>

            <div className="flex gap-1">
              <Btn size="xs" variant="outline" className="flex-1" onClick={() => { s({ shadowHue: 205, shadowAmt: 0.32, highHue: 38, highAmt: 0.3 }); commit(); }}>
                Classic
              </Btn>
              <Btn size="xs" variant="outline" className="flex-1" onClick={() => { s({ shadowHue: 285, shadowAmt: 0.4, highHue: 175, highAmt: 0.35 }); commit(); }}>
                Vaporwave
              </Btn>
              <Btn size="xs" variant="outline" className="flex-1" onClick={() => { s({ shadowAmt: 0, highAmt: 0 }); commit(); }}>
                Off
              </Btn>
            </div>
          </div>
        )}

        {tab === "fx" && (
          <>
            <Section label="Optics">
              <ProSlider label="Sharpen" value={adj.sharpen} min={-1} max={1} accent="var(--color-teal)" onChange={(v) => s({ sharpen: v })} onCommit={commit} />
              <ProSlider label="Defocus" value={adj.blur} min={0} max={1} bipolar={false} accent="var(--color-teal)" onChange={(v) => s({ blur: v })} onCommit={commit} />
              <ProSlider label="Chroma shift" value={adj.chroma} min={0} max={1} bipolar={false} accent="var(--color-magenta)" onChange={(v) => s({ chroma: v })} onCommit={commit} />
              <ProSlider label="Glow" value={adj.bloom} min={0} max={1} bipolar={false} accent="var(--color-amber)" onChange={(v) => s({ bloom: v })} onCommit={commit} />
              <ProSlider label="Glow thresh" value={adj.bloomThreshold} min={0} max={1} def={0.72} bipolar={false} accent="var(--color-amber)" onChange={(v) => s({ bloomThreshold: v })} onCommit={commit} />
            </Section>
            <Section label="Vignette">
              <ProSlider label="Amount" value={adj.vignette} min={0} max={1} bipolar={false} onChange={(v) => s({ vignette: v })} onCommit={commit} />
              <ProSlider label="Softness" value={adj.vignetteSoft} min={0.05} max={1} def={0.55} bipolar={false} onChange={(v) => s({ vignetteSoft: v })} onCommit={commit} />
            </Section>
            <Section label="Film">
              <ProSlider label="Grain" value={adj.grain} min={0} max={1} bipolar={false} accent="var(--color-lime)" onChange={(v) => s({ grain: v })} onCommit={commit} />
              <div className="mt-1 flex gap-1">
                {[0, 0.16, 0.3, 0.5].map((g) => (
                  <Btn key={g} size="xs" variant="outline" className="flex-1" active={Math.abs(adj.grain - g) < 0.001} onClick={() => { s({ grain: g }); commit(); }}>
                    {g === 0 ? "Off" : `${Math.round(g * 100)}`}
                  </Btn>
                ))}
              </div>
            </Section>
            <Section label="Output">
              <ProSlider label="Grade mix" value={adj.intensity} min={0} max={1} def={1} bipolar={false} accent="var(--color-amber)" onChange={(v) => s({ intensity: v })} onCommit={commit} />
              <p className="mt-1 text-[9.5px] leading-relaxed text-faint">
                Blend the whole node chain against the source — the fastest way to dial a look back.
              </p>
            </Section>
          </>
        )}
        <div className="h-3" />
      </div>
    </aside>
  );
}
