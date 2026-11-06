import { Copy, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import type { BgLayer, Grade, Layer, LayerKind, MaskComp, MaskOp, MaskType, PeoplePart } from '../types';
import { useEditor } from '../state/editor';
import { defaultGrade, uid } from '../lib/grade';
import { copyBrush, detectPeople, makeMask, maskDims, setSnapshot } from '../lib/masks';
import { Button, IconBtn, RAINBOW, Section, Select, Slider } from './ui';
import { cn } from '../utils/cn';

type NumKey = { [K in keyof Grade]: Grade[K] extends number ? K : never }[keyof Grade];

const DEFAULT_BG: BgLayer = { name: 'Background', visible: true, opacity: 100 };
const DEFAULT_G = defaultGrade();
const pct = (v: number) => `${Math.round(v)}%`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`;

function newLayer(kind: LayerKind, name: string, grade?: Partial<Grade>, masks: MaskComp[] = []): Layer {
  return { id: uid(), name, kind, visible: true, opacity: 100, color: '#ff6b3d', grade: { ...defaultGrade(), ...(grade ?? {}) }, masks };
}

const skinMask = (op: MaskOp = 'add'): MaskComp => ({ ...makeMask('color'), name: 'Skin Range', op, hue: 20, hueRange: 32, satMin: 12, feather: 15 });

const PRESETS: { id: string; label: string; make: () => Layer }[] = [
  { id: 'skintone', label: 'Skin Tone', make: () => newLayer('empty', 'Skin Tone Correction', { temperature: 5, tint: 3, vibrance: 8, saturation: -4 }, [skinMask()]) },
  { id: 'smooth', label: 'Skin Smoothing', make: () => newLayer('empty', 'Skin Smoothing', { smooth: 70, texKeep: 35 }, [skinMask()]) },
  { id: 'face', label: 'Face Retouch', make: () => newLayer('empty', 'Face Retouching', { smooth: 55, texKeep: 45, exposure: 0.05 }, [makeMask('brush'), skinMask('intersect')]) },
  { id: 'eyes', label: 'Eye Enhance', make: () => newLayer('empty', 'Eye Enhancement', { exposure: 0.25, contrast: 12, sharpen: 35, vibrance: 15 }, [makeMask('brush')]) },
  {
    id: 'teeth',
    label: 'Teeth Whiten',
    make: () =>
      newLayer('empty', 'Teeth Enhancement', { saturation: -35, exposure: 0.2, temperature: -6 }, [
        makeMask('brush'),
        { ...makeMask('color'), name: 'Yellow Range', op: 'intersect', hue: 48, hueRange: 36, satMin: 8 },
      ]),
  },
  { id: 'neck', label: 'Neck Retouch', make: () => newLayer('empty', 'Neck Retouching', { smooth: 40, texKeep: 55, exposure: -0.05 }, [makeMask('brush'), skinMask('intersect')]) },
  { id: 'body', label: 'Body Skin', make: () => newLayer('empty', 'Body Skin Retouching', { smooth: 50, texKeep: 50, vibrance: 6 }, [makeMask('brush'), skinMask('intersect')]) },
];

const toolFor = (m: MaskComp | undefined | null): 'paint' | 'shape' | null =>
  !m ? null : m.type === 'brush' || m.type === 'people' ? 'paint' : m.type === 'linear' || m.type === 'radial' ? 'shape' : null;

export function LayersPalette() {
  const { edit, updateEdit, commit, view, setView, current, currentImage, toast } = useEditor();
  const layers = edit.layers ?? [];
  const bg = edit.bg ?? DEFAULT_BG;
  const selId = view.activeLayerId ?? null;
  const sel = layers.find((l) => l.id === selId) ?? null;
  const bgSel = selId === 'bg';
  const comp = sel?.masks.find((m) => m.id === view.activeMaskId) ?? null;
  const isPaintComp = !!comp && (comp.type === 'brush' || comp.type === 'people');

  const setLayers = (fn: (ls: Layer[]) => Layer[], t = false) => updateEdit((e) => ({ ...e, layers: fn(e.layers ?? []), bg: e.bg ?? DEFAULT_BG }), t);
  const patchLayer = (id: string, patch: Partial<Layer>, t = false) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)), t);
  const patchGrade = (id: string, patch: Partial<Grade>, t = false) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, grade: { ...l.grade, ...patch } } : l)), t);
  const patchMask = (lid: string, mid: string, patch: Partial<MaskComp>, t = false) =>
    setLayers((ls) => ls.map((l) => (l.id === lid ? { ...l, masks: l.masks.map((m) => (m.id === mid ? { ...m, ...patch } : m)) } : l)), t);
  const patchBg = (patch: Partial<BgLayer>, t = false) => updateEdit((e) => ({ ...e, layers: e.layers ?? [], bg: { ...(e.bg ?? DEFAULT_BG), ...patch } }), t);

  const pickLayer = (l: Layer) => {
    const m = l.masks[0];
    setView({ activeLayerId: l.id, activeMaskId: m ? m.id : null, retouchTool: null, maskTool: toolFor(m), maskPreview: false });
  };
  const addLayer = (l: Layer) => {
    setLayers((ls) => [...ls, l]);
    const m = l.masks.find((x) => x.type === 'brush') ?? l.masks[0];
    setView({ activeLayerId: l.id, activeMaskId: m ? m.id : null, retouchTool: null, maskTool: toolFor(m), maskPreview: false });
  };
  const addEmpty = () => addLayer(newLayer('empty', `Layer ${layers.length + 1}`));
  const addFilled = () => addLayer(newLayer('filled', `Filled Layer ${layers.length + 1}`));

  const duplicate = () => {
    if (!sel) return;
    const masks = sel.masks.map((m) => {
      const n = { ...m, id: uid() };
      copyBrush(m, n);
      return n;
    });
    const l: Layer = { ...structuredClone(sel), id: uid(), name: `${sel.name} copy`, masks };
    setLayers((ls) => {
      const i = ls.findIndex((x) => x.id === sel.id);
      const c = ls.slice();
      c.splice(i + 1, 0, l);
      return c;
    });
    setView({ activeLayerId: l.id, activeMaskId: null, maskTool: null, maskPreview: false });
  };
  const remove = () => {
    if (!sel) return;
    setLayers((ls) => ls.filter((l) => l.id !== sel.id));
    setView({ activeLayerId: null, activeMaskId: null, maskTool: null, maskPreview: false });
  };
  const move = (dir: 1 | -1) => {
    if (!sel) return;
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === sel.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const c = ls.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  };

  const addMask = (type: MaskType) => {
    if (!sel) return;
    const m = makeMask(type);
    setLayers((ls) => ls.map((l) => (l.id === sel.id ? { ...l, masks: [...l.masks, m] } : l)));
    setView({ activeMaskId: m.id, retouchTool: null, maskTool: toolFor(m) });
  };
  const addPeople = async (part: PeoplePart) => {
    if (!sel || !current || !currentImage) {
      toast('Open a photo and select a layer first');
      return;
    }
    const lid = sel.id;
    const m = makeMask('people', part);
    setLayers((ls) => ls.map((l) => (l.id === lid ? { ...l, masks: [...l.masks, m] } : l)));
    setView({ activeMaskId: m.id, retouchTool: null, maskTool: 'paint' });
    toast('Detecting… the first time downloads an AI model');
    try {
      const [mw, mh] = maskDims(current.width, current.height);
      const buf = await detectPeople(currentImage, part, mw, mh);
      setSnapshot(m, 1, buf);
      patchMask(lid, m.id, { strokes: 1 });
      toast('Detected. Refine it with the Brush / Eraser');
    } catch {
      toast('Auto detect needs internet and a modern browser');
    }
  };
  const removeMask = (id: string) => {
    if (!sel) return;
    setLayers((ls) => ls.map((l) => (l.id === sel.id ? { ...l, masks: l.masks.filter((m) => m.id !== id) } : l)));
    if (view.activeMaskId === id) setView({ activeMaskId: null, maskTool: null, maskPreview: false });
  };

  const G = (key: NumKey, label: string, min: number, max: number, step = 1, format?: (v: number) => string) =>
    sel ? (
      <Slider
        key={key}
        label={label}
        value={sel.grade[key]}
        min={min}
        max={max}
        step={step}
        defaultValue={DEFAULT_G[key]}
        format={format ?? ((v) => (step < 1 ? `${v > 0 ? '+' : ''}${v.toFixed(2)}` : signed(v)))}
        onChange={(v, t) => patchGrade(sel.id, { [key]: v } as unknown as Partial<Grade>, t)}
      />
    ) : null;

  const M = (key: 'feather' | 'refine' | 'hue' | 'hueRange' | 'satMin', label: string, min: number, max: number, format?: (v: number) => string, gradient?: string) =>
    sel && comp ? (
      <Slider
        key={key}
        label={label}
        value={comp[key]}
        min={min}
        max={max}
        defaultValue={key === 'hueRange' ? 30 : key === 'satMin' ? 12 : key === 'hue' ? 20 : 0}
        format={format ?? signed}
        gradient={gradient}
        onChange={(v, t) => patchMask(sel.id, comp.id, { [key]: v } as unknown as Partial<MaskComp>, t)}
      />
    ) : null;

  const ToolBtn = ({ id, label }: { id: 'paint' | 'erase' | 'shape'; label: string }) => (
    <Button variant={view.maskTool === id ? 'primary' : 'default'} className="h-7 flex-1 px-2" onClick={() => setView({ retouchTool: null, maskTool: view.maskTool === id ? null : id })}>
      {label}
    </Button>
  );

  const rows = [...layers].reverse();

  return (
    <div className="grid gap-x-8 p-3 md:grid-cols-2 xl:grid-cols-3">
      {/* ------------------------------ layers ------------------------------ */}
      <div>
        <Section
          title="Layers"
          note="top = front"
          right={
            <div className="flex items-center gap-0.5">
              <IconBtn title="Duplicate layer" disabled={!sel} onClick={duplicate}>
                <Copy size={13} />
              </IconBtn>
              <IconBtn title="Move layer up" disabled={!sel} onClick={() => move(1)}>
                <span className="text-[12px] leading-none">↑</span>
              </IconBtn>
              <IconBtn title="Move layer down" disabled={!sel} onClick={() => move(-1)}>
                <span className="text-[12px] leading-none">↓</span>
              </IconBtn>
              <IconBtn title="Delete layer" disabled={!sel} onClick={remove}>
                <Trash2 size={13} />
              </IconBtn>
            </div>
          }
        >
          <div className="mb-2 flex gap-1.5">
            <Button className="h-7 flex-1 px-2" onClick={addEmpty}>
              <Plus size={13} /> Empty Layer
            </Button>
            <Button className="h-7 flex-1 px-2" onClick={addFilled}>
              <Plus size={13} /> Filled Layer
            </Button>
          </div>
          <div className="flex flex-col gap-0.5">
            {rows.map((l) => (
              <div
                key={l.id}
                onClick={() => pickLayer(l)}
                className={cn('flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11.5px]', selId === l.id ? 'bg-ink-650 text-ink-100' : 'text-ink-300 hover:bg-ink-700')}
              >
                <IconBtn title={l.visible ? 'Hide layer' : 'Show layer'} onClick={() => patchLayer(l.id, { visible: !l.visible })}>
                  {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconBtn>
                {l.kind === 'filled' && <span className="size-3 shrink-0 rounded-sm ring-1 ring-white/25" style={{ background: l.color }} />}
                <span className={cn('min-w-0 flex-1 truncate', !l.visible && 'opacity-50')}>{l.name}</span>
                <span className="shrink-0 text-[9.5px] text-ink-500">{l.masks.length ? `${l.masks.length} mask` : ''}</span>
                <span className="shrink-0 font-mono text-[10px] text-ink-500">{Math.round(l.opacity)}%</span>
              </div>
            ))}
            <div
              onClick={() => setView({ activeLayerId: 'bg', activeMaskId: null, maskTool: null, maskPreview: false })}
              className={cn('flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11.5px]', bgSel ? 'bg-ink-650 text-ink-100' : 'text-ink-300 hover:bg-ink-700')}
            >
              <IconBtn title={bg.visible ? 'Hide background' : 'Show background'} onClick={() => patchBg({ visible: !bg.visible })}>
                {bg.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </IconBtn>
              <span className={cn('min-w-0 flex-1 truncate', !bg.visible && 'opacity-50')}>{bg.name}</span>
              <span className="shrink-0 text-[9.5px] text-ink-500">photo</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-500">{Math.round(bg.opacity)}%</span>
            </div>
          </div>
        </Section>

        <Section title="Retouch Presets" note="adds a masked layer">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.id} className="h-7 px-2 text-[11px]" onClick={() => addLayer(p.make())}>
                {p.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
            Brush presets start empty: paint on the photo where the effect should show. Skin range limits it to skin colors.
          </p>
        </Section>
      </div>

      {/* ------------------------------ settings ------------------------------ */}
      <div>
        {bgSel && (
          <Section title="Background Layer" note="your photo + color nodes">
            <input
              value={bg.name}
              onChange={(e) => patchBg({ name: e.target.value }, true)}
              onBlur={() => commit()}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="mb-2 h-7 w-full rounded bg-ink-900 px-2 text-[11.5px] text-ink-100 outline-none ring-1 ring-ink-650 focus:ring-accent/60"
            />
            <Slider label="Opacity" value={bg.opacity} min={0} max={100} defaultValue={100} format={pct} onChange={(v, t) => patchBg({ opacity: v }, t)} />
          </Section>
        )}
        {sel && (
          <>
            <Section title={sel.kind === 'filled' ? 'Filled Layer' : 'Layer Adjustments'} note={sel.kind === 'filled' ? 'solid color' : 'applied through the mask'}>
              <input
                value={sel.name}
                onChange={(e) => patchLayer(sel.id, { name: e.target.value }, true)}
                onBlur={() => commit()}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                title="Rename layer"
                className="mb-2 h-7 w-full rounded bg-ink-900 px-2 text-[11.5px] text-ink-100 outline-none ring-1 ring-ink-650 focus:ring-accent/60"
              />
              <Slider label="Layer Opacity" value={sel.opacity} min={0} max={100} defaultValue={100} format={pct} onChange={(v, t) => patchLayer(sel.id, { opacity: v }, t)} />
              {sel.kind === 'filled' && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-300">
                  Fill color
                  <input
                    type="color"
                    value={sel.color}
                    onChange={(e) => patchLayer(sel.id, { color: e.target.value }, true)}
                    onBlur={() => commit()}
                    className="h-7 w-12 cursor-pointer rounded bg-transparent"
                  />
                </label>
              )}
            </Section>
            {sel.kind === 'empty' && (
              <Section title="Local Adjustments">
                {G('exposure', 'Exposure', -4, 4, 0.01)}
                {G('contrast', 'Contrast', -100, 100)}
                {G('highlights', 'Highlights', -100, 100)}
                {G('shadows', 'Shadows', -100, 100)}
                {G('temperature', 'Temperature', -100, 100)}
                {G('tint', 'Tint', -100, 100)}
                {G('vibrance', 'Vibrance', -100, 100)}
                {G('saturation', 'Saturation', -100, 100)}
                {G('midDetail', 'Clarity', -100, 100)}
                {G('sharpen', 'Sharpen', 0, 100, 1, (v) => v.toFixed(0))}
                {G('dehaze', 'Dehaze', -100, 100)}
                {G('smooth', 'Skin Smoothing', 0, 100, 1, (v) => v.toFixed(0))}
                {G('texKeep', 'Texture Preservation', 0, 100, 1, (v) => v.toFixed(0))}
              </Section>
            )}
          </>
        )}
        {!sel && !bgSel && <p className="text-[11.5px] leading-relaxed text-ink-400">Add or select a layer. Presets create a ready layer with a mask for skin, eyes, teeth, neck and body.</p>}
      </div>

      {/* ------------------------------ masks ------------------------------ */}
      <div>
        {sel ? (
          <>
            <Section title="Masks" note={sel.masks.length ? 'combine with add / subtract / intersect' : 'no mask: affects the whole photo'}>
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addMask('brush')}>
                  Brush
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addMask('linear')}>
                  Linear
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addMask('radial')}>
                  Radial
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addMask('luminosity')}>
                  Luminosity
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addMask('color')}>
                  Color Range
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addPeople('person')} title="AI: finds people">
                  People
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addPeople('skin')} title="AI: finds face and body skin">
                  Skin (AI)
                </Button>
                <Button className="h-7 px-1.5 text-[11px]" onClick={() => addPeople('hair')} title="AI: finds hair">
                  Hair (AI)
                </Button>
              </div>
              <div className="flex flex-col gap-0.5">
                {sel.masks.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setView({ activeMaskId: m.id, retouchTool: null, maskTool: toolFor(m) })}
                    className={cn('flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11.5px]', view.activeMaskId === m.id ? 'bg-ink-650 text-ink-100' : 'text-ink-300 hover:bg-ink-700')}
                  >
                    <IconBtn title={m.enabled ? 'Disable mask' : 'Enable mask'} onClick={() => patchMask(sel.id, m.id, { enabled: !m.enabled })}>
                      {m.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                    </IconBtn>
                    <span className={cn('min-w-0 flex-1 truncate', !m.enabled && 'opacity-50')}>{m.name}</span>
                    <span className="shrink-0 text-[9.5px] uppercase text-ink-500">{m.invert ? 'inv · ' : ''}{m.op}</span>
                    <IconBtn title="Remove mask" onClick={() => removeMask(m.id)}>
                      <X size={12} />
                    </IconBtn>
                  </div>
                ))}
              </div>
            </Section>

            {comp && (
              <Section title={comp.name} note="mask settings">
                <div className="mb-2 flex items-center gap-1.5">
                  <Select
                    value={comp.op}
                    title="How this mask combines with the ones above"
                    onChange={(v) => patchMask(sel.id, comp.id, { op: v as MaskOp })}
                    options={[
                      { value: 'add', label: 'Add' },
                      { value: 'subtract', label: 'Subtract' },
                      { value: 'intersect', label: 'Intersect' },
                    ]}
                    className="w-[96px]"
                  />
                  <Button variant={comp.invert ? 'primary' : 'default'} className="h-7 px-2" onClick={() => patchMask(sel.id, comp.id, { invert: !comp.invert })}>
                    Invert
                  </Button>
                  <Button variant={view.maskPreview ? 'primary' : 'default'} className="h-7 flex-1 px-2" onClick={() => setView({ maskPreview: !view.maskPreview })} title="Show the mask as a red overlay">
                    Mask Preview
                  </Button>
                </div>

                {isPaintComp && (
                  <>
                    <div className="mb-2 flex gap-1.5">
                      <ToolBtn id="paint" label="Brush" />
                      <ToolBtn id="erase" label="Eraser" />
                    </div>
                    <Slider label="Brush Size" value={view.brushSize ?? 0.06} min={0.01} max={0.4} step={0.005} defaultValue={0.06} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setView({ brushSize: v })} />
                    <Slider label="Hardness" value={view.brushHardness ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setView({ brushHardness: v })} />
                    <Slider label="Flow" value={view.brushFlow ?? 0.5} min={0.05} max={1} step={0.01} defaultValue={0.5} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setView({ brushFlow: v })} />
                  </>
                )}
                {(comp.type === 'linear' || comp.type === 'radial') && (
                  <>
                    <div className="mb-1 flex gap-1.5">
                      <ToolBtn id="shape" label={comp.type === 'linear' ? 'Draw gradient' : 'Draw ellipse'} />
                    </div>
                    <p className="mb-2 text-[10.5px] leading-relaxed text-ink-500">
                      {comp.type === 'linear' ? 'Drag on the photo from where the effect is full to where it fades out.' : 'Drag from the center outwards to size the ellipse.'}
                    </p>
                  </>
                )}
                {comp.type === 'luminosity' && (
                  <>
                    <Slider label="From (shadows)" value={comp.lumLow * 100} min={0} max={100} defaultValue={60} format={pct} onChange={(v, t) => patchMask(sel.id, comp.id, { lumLow: v / 100 }, t)} />
                    <Slider label="To (highlights)" value={comp.lumHigh * 100} min={0} max={100} defaultValue={100} format={pct} onChange={(v, t) => patchMask(sel.id, comp.id, { lumHigh: v / 100 }, t)} />
                  </>
                )}
                {comp.type === 'color' && (
                  <>
                    {M('hue', 'Hue', 0, 360, (v) => `${v.toFixed(0)}°`, RAINBOW)}
                    {M('hueRange', 'Range', 4, 90, (v) => `±${v.toFixed(0)}°`)}
                    {M('satMin', 'Min Saturation', 0, 100, (v) => v.toFixed(0))}
                  </>
                )}
                {M('feather', 'Feather Mask', 0, 100, (v) => v.toFixed(0))}
                {M('refine', 'Refine Edge', -100, 100)}
              </Section>
            )}
          </>
        ) : (
          <p className="text-[11.5px] leading-relaxed text-ink-400">Select a layer to add masks: brush, eraser, gradients, luminosity, color range and AI people / skin / hair.</p>
        )}
      </div>
    </div>
  );
}
