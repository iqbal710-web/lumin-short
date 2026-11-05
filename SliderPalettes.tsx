import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Crop, Check } from 'lucide-react';
import type { Finishing, Grade } from '../types';
import { useEditor } from '../state/editor';
import { DEFAULT_GRADE, defaultFinishing, defaultTransform } from '../lib/grade';
import { ASPECTS, aspectValue, cropForAspect, orientedSize } from '../lib/transform';
import { Button, RAINBOW, Section, Slider } from './ui';
import { cn } from '../utils/cn';

type NumKey = { [K in keyof Grade]: Grade[K] extends number ? K : never }[keyof Grade];
type FinKey = keyof Finishing;
const FIN_DEFAULT = defaultFinishing();

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`;

function useGradeSlider() {
  const { selectedNode, setGrade } = useEditor();
  const g = selectedNode.grade;
  return (key: NumKey, label: string, min: number, max: number, extra: { step?: number; format?: (v: number) => string; gradient?: string; hint?: string } = {}) => (
    <Slider
      key={key}
      label={label}
      value={g[key]}
      min={min}
      max={max}
      step={extra.step ?? 1}
      defaultValue={DEFAULT_GRADE[key]}
      format={extra.format ?? signed}
      gradient={extra.gradient}
      hint={extra.hint}
      onChange={(v, t) => setGrade(key, v, t)}
    />
  );
}

function useFinishSlider() {
  const { edit, setFinishing } = useEditor();
  const f = edit.finishing;
  return (key: FinKey, label: string, min: number, max: number, format?: (v: number) => string) => (
    <Slider key={key} label={label} value={f[key]} min={min} max={max} defaultValue={FIN_DEFAULT[key]} format={format ?? signed} onChange={(v, t) => setFinishing(key, v, t)} />
  );
}

export function AdjustPalette() {
  const S = useGradeSlider();
  const { selectedNode } = useEditor();
  const g = selectedNode.grade;
  return (
    <div className="grid gap-x-8 p-3 md:grid-cols-2 2xl:grid-cols-3">
      <div>
        <Section title="Light" note="node">
          {S('exposure', 'Exposure', -4, 4, { step: 0.01, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV` })}
          {S('contrast', 'Contrast', -100, 100)}
          {S('highlights', 'Highlights', -100, 100)}
          {S('shadows', 'Shadows', -100, 100)}
          {S('whites', 'Whites', -100, 100)}
          {S('blacks', 'Blacks', -100, 100)}
        </Section>
      </div>
      <div>
        <Section title="Color" note="node">
          {S('temperature', 'Temperature', -100, 100, { gradient: 'linear-gradient(90deg,#3b82f6,#8a8a8a,#f59e0b)' })}
          {S('tint', 'Tint', -100, 100, { gradient: 'linear-gradient(90deg,#22c55e,#8a8a8a,#d946ef)' })}
          {S('vibrance', 'Vibrance', -100, 100)}
          {S('saturation', 'Saturation', -100, 100, { gradient: 'linear-gradient(90deg,#6b6b6b,#c084fc,#f43f5e)' })}
          {S('hue', 'Hue Rotate', -180, 180, { gradient: RAINBOW, format: (v) => `${v.toFixed(0)}°` })}
          {S('fade', 'Fade / Matte', 0, 100, { format: (v) => v.toFixed(0) })}
        </Section>
      </div>
      <div>
        <Section title="Split Toning" note="node">
          {S('splitShadowHue', 'Shadow Hue', 0, 360, { gradient: RAINBOW, format: (v) => `${v.toFixed(0)}°` })}
          {S('splitShadowSat', 'Shadow Sat', 0, 100, { format: (v) => v.toFixed(0) })}
          {S('splitHighlightHue', 'Highlight Hue', 0, 360, { gradient: RAINBOW, format: (v) => `${v.toFixed(0)}°` })}
          {S('splitHighlightSat', 'Highlight Sat', 0, 100, { format: (v) => v.toFixed(0) })}
          {S('splitBalance', 'Balance', -100, 100)}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
            <span className="h-3 w-10 rounded-sm" style={{ background: `hsl(${g.splitShadowHue} ${g.splitShadowSat}% 45%)` }} />
            Shadows
            <span className="ml-2 h-3 w-10 rounded-sm" style={{ background: `hsl(${g.splitHighlightHue} ${g.splitHighlightSat}% 60%)` }} />
            Highlights
          </div>
        </Section>
      </div>
    </div>
  );
}

export function EffectsPalette() {
  const S = useGradeSlider();
  const F = useFinishSlider();
  return (
    <div className="grid gap-x-8 p-3 md:grid-cols-2 2xl:grid-cols-3">
      <div>
        <Section title="Detail" note="node">
          {S('sharpen', 'Sharpen', 0, 100, { format: (v) => v.toFixed(0) })}
          {S('midDetail', 'Mid Detail', -100, 100, { hint: 'Local contrast / clarity' })}
          {S('blur', 'Blur', 0, 100, { format: (v) => v.toFixed(0) })}
        </Section>
        <Section title="Key Output" note="node opacity">
          {S('mix', 'Node Mix', 0, 100, { format: (v) => `${v.toFixed(0)}%` })}
        </Section>
      </div>
      <div>
        <Section title="Vignette" note="global · after crop">
          {F('vignette', 'Amount', -100, 100)}
          {F('vignetteMid', 'Midpoint', 0, 100, (v) => v.toFixed(0))}
          {F('vignetteRound', 'Roundness', 0, 100, (v) => v.toFixed(0))}
          {F('vignetteFeather', 'Feather', 0, 100, (v) => v.toFixed(0))}
        </Section>
      </div>
      <div>
        <Section title="Film Grain" note="global">
          {F('grain', 'Amount', 0, 100, (v) => v.toFixed(0))}
          {F('grainSize', 'Size', 1, 100, (v) => v.toFixed(0))}
        </Section>
        <p className="text-[10.5px] leading-relaxed text-ink-500">
          Node effects live inside the selected node. Vignette, grain and film look are global finishing, so they follow your crop.
        </p>
      </div>
      <div>
        <Section title="Film Look" note="global">
          {F('halation', 'Halation', 0, 100, (v) => v.toFixed(0))}
          {F('bloom', 'Bloom / Glow', 0, 100, (v) => v.toFixed(0))}
          {F('chromatic', 'Chromatic Aberration', 0, 100, (v) => v.toFixed(0))}
        </Section>
        <Section title="Light Leak" note="global">
          {F('lightLeak', 'Amount', 0, 100, (v) => v.toFixed(0))}
          {F('leakHue', 'Hue', 0, 360, (v) => `${v.toFixed(0)}°`)}
        </Section>
      </div>
    </div>
  );
}

export function TransformPalette() {
  const { edit, setTransform, rotate, view, setView, current, updateEdit } = useEditor();
  const t = edit.transform;
  const [W, H] = current ? orientedSize(current.width, current.height, t.rot90) : [1, 1];
  const outW = Math.round(W * t.crop.w);
  const outH = Math.round(H * t.crop.h);
  const tile = (active: boolean) =>
    cn(
      'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] ring-1 transition',
      active ? 'bg-accent/15 text-accent ring-accent/50' : 'bg-ink-750 text-ink-200 ring-ink-650 hover:bg-ink-700',
    );

  return (
    <div className="grid gap-x-8 p-3 md:grid-cols-2">
      <div>
        <Section title="Orientation">
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" className={tile(false)} onClick={() => rotate(-1)} title="Rotate left (Shift+R)">
              <RotateCcw size={13} /> 90°
            </button>
            <button type="button" className={tile(false)} onClick={() => rotate(1)} title="Rotate right (R)">
              <RotateCw size={13} /> 90°
            </button>
            <button type="button" className={tile(t.flipH)} onClick={() => setTransform({ flipH: !t.flipH })} title="Flip horizontal">
              <FlipHorizontal2 size={13} /> Flip H
            </button>
            <button type="button" className={tile(t.flipV)} onClick={() => setTransform({ flipV: !t.flipV })} title="Flip vertical">
              <FlipVertical2 size={13} /> Flip V
            </button>
          </div>
        </Section>
        <Section title="Straighten">
          <Slider label="Angle" value={t.angle} min={-45} max={45} step={0.1} format={(v) => `${v.toFixed(1)}°`} onChange={(v, tr) => setTransform({ angle: v }, tr)} />
          <p className="mt-1 text-[10.5px] text-ink-500">The image auto-scales so rotated corners never show empty space.</p>
        </Section>
        <Section title="Output">
          <div className="flex items-center justify-between rounded-md bg-ink-900 px-3 py-2 font-mono text-[11px] ring-1 ring-ink-650">
            <span className="text-ink-400">Final size</span>
            <span className="text-ink-100">
              {outW} × {outH} px
            </span>
          </div>
        </Section>
      </div>
      <div>
        <Section
          title="Crop"
          right={
            <button
              type="button"
              className="text-[10.5px] text-ink-400 hover:text-ink-100"
              onClick={() => updateEdit((e) => ({ ...e, transform: { ...defaultTransform() } }))}
            >
              Reset all sizing
            </button>
          }
        >
          <Button variant={view.cropMode ? 'primary' : 'default'} className="mb-2 w-full" onClick={() => setView({ cropMode: !view.cropMode })}>
            {view.cropMode ? (
              <>
                <Check size={14} /> Done cropping (Enter)
              </>
            ) : (
              <>
                <Crop size={14} /> Open crop tool (C)
              </>
            )}
          </Button>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={tile(t.aspect === a.id)}
                onClick={() => {
                  setTransform({ aspect: a.id, crop: cropForAspect(aspectValue(a.id, W, H), W, H) });
                  if (!view.cropMode) setView({ cropMode: true });
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
            Drag the frame to move it, drag the handles to resize. Choose an aspect ratio to lock proportions. Press <b className="text-ink-300">Enter</b> to finish.
          </p>
        </Section>
      </div>
    </div>
  );
}
