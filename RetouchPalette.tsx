import type { RetouchTool } from '../types';
import { useEditor } from '../state/editor';
import { Button, Section, Slider } from './ui';

const TOOLS: { id: RetouchTool; label: string; tip: string }[] = [
  { id: 'clone', label: 'Clone Brush', tip: 'Copies pixels from the source point. Set the source, then paint.' },
  { id: 'heal', label: 'Heal Brush', tip: 'Like clone, but matches the color and light around the brush.' },
  { id: 'spot', label: 'Spot Removal', tip: 'Click a spot. A clean nearby patch is found and blended in automatically.' },
  { id: 'blemish', label: 'Blemish Removal', tip: 'Use a small brush and click each blemish on skin.' },
  { id: 'hair', label: 'Stray Hair Removal', tip: 'Paint along a stray hair. The brush fills it from the sides.' },
];

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

export function RetouchPalette() {
  const { edit, updateEdit, view, setView } = useEditor();
  const tool = view.retouchTool ?? null;
  const info = TOOLS.find((t) => t.id === tool);
  const strokes = edit.retouch?.length ?? 0;
  const needsSource = tool === 'clone' || tool === 'heal';

  const pick = (id: RetouchTool) => {
    const off = tool === id;
    setView({ retouchTool: off ? null : id, maskTool: null, maskPreview: false, settingSource: false });
  };

  return (
    <div className="grid gap-x-8 p-3 md:grid-cols-2">
      <div>
        <Section title="Retouch Tools" note="paints on the photo itself, before color grading">
          <div className="grid grid-cols-2 gap-1.5">
            {TOOLS.map((t) => (
              <Button key={t.id} variant={tool === t.id ? 'primary' : 'default'} className="h-8 px-2 text-[11.5px]" onClick={() => pick(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">{info ? info.tip : 'Pick a tool, then paint on the photo. Undo works for every stroke.'}</p>
        </Section>

        {needsSource && (
          <Section title="Source Point">
            <div className="flex items-center gap-2">
              <Button variant={view.settingSource ? 'primary' : 'default'} className="h-7 px-2" onClick={() => setView({ settingSource: !view.settingSource })}>
                {view.settingSource ? 'Click the photo…' : view.cloneSource ? 'Set new source' : 'Set source'}
              </Button>
              <span className="text-[10.5px] text-ink-400">
                {view.cloneSource ? `Source set (${Math.round(view.cloneSource[0] * 100)}%, ${Math.round(view.cloneSource[1] * 100)}%)` : 'Click on the photo to choose where to copy from'}
              </span>
            </div>
          </Section>
        )}
      </div>

      <div>
        <Section title="Brush">
          <Slider label="Size" value={view.retouchSize ?? 0.04} min={0.005} max={0.2} step={0.001} defaultValue={0.04} format={pct} onChange={(v) => setView({ retouchSize: v })} />
          <Slider label="Hardness" value={view.retouchHardness ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} format={pct} onChange={(v) => setView({ retouchHardness: v })} />
          <Slider label="Opacity" value={view.retouchOpacity ?? 1} min={0.05} max={1} step={0.01} defaultValue={1} format={pct} onChange={(v) => setView({ retouchOpacity: v })} />
        </Section>
        <Section title="History" note={`${strokes} stroke${strokes === 1 ? '' : 's'}`}>
          <Button className="h-7 px-2" disabled={!strokes} onClick={() => updateEdit((e) => ({ ...e, retouch: [] }))}>
            Remove all retouching
          </Button>
        </Section>
      </div>
    </div>
  );
}
