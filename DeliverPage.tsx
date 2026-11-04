import { useEffect, useMemo, useState } from 'react';
import { Box, CheckSquare, Download, FileJson, LoaderCircle, Package, Square } from 'lucide-react';
import type { ExportSettings } from '../types';
import { useEditor } from '../state/editor';
import { EXT, outputName, renderGradedThumb } from '../lib/media';
import { orientedSize } from '../lib/transform';
import { editHasChanges } from '../lib/grade';
import { Button, Section, Slider } from './ui';
import { cn } from '../utils/cn';

const FORMATS: { id: ExportSettings['format']; label: string; note: string }[] = [
  { id: 'image/jpeg', label: 'JPEG', note: 'Best for sharing' },
  { id: 'image/png', label: 'PNG', note: 'Lossless' },
  { id: 'image/webp', label: 'WebP', note: 'Small & sharp' },
];
const SCALES = [1, 0.75, 0.5, 0.25];

export function DeliverPage() {
  const { media, currentId, currentImage, current, edit, luts, exportItems, exportSettings: s, setExportSettings, editFor, exportLut, saveGrade, setPage } = useEditor();
  const [queue, setQueue] = useState<string[]>(() => (currentId ? [currentId] : []));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!currentImage || !currentId) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => setPreview(renderGradedThumb(currentImage, currentId, edit, luts, 1280)), 30);
    return () => clearTimeout(t);
  }, [currentImage, currentId, edit, luts]);

  const set = (patch: Partial<ExportSettings>) => setExportSettings({ ...s, ...patch });
  const dims = useMemo(() => {
    if (!current) return null;
    const t = edit.transform;
    const [W, H] = orientedSize(current.width, current.height, t.rot90);
    const k = Math.min(1, 8192 / Math.max(current.width * s.scale, current.height * s.scale));
    return [Math.round(W * t.crop.w * s.scale * k), Math.round(H * t.crop.h * s.scale * k)];
  }, [current, edit.transform, s.scale]);

  const run = async (ids: string[]) => {
    if (!ids.length || progress) return;
    setProgress({ done: 0, total: ids.length });
    try {
      await exportItems(ids, (done, total) => setProgress({ done, total }));
    } finally {
      setProgress(null);
    }
  };
  const toggle = (id: string) => setQueue((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  const allQueued = media.length > 0 && media.every((m) => queue.includes(m.id));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[320px_1fr_320px]">
        {/* settings */}
        <div className="order-2 rounded-xl border border-ink-700 bg-ink-850 p-4 lg:order-1">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">Render Settings</div>
          <Section title="Format">
            <div className="grid grid-cols-3 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set({ format: f.id })}
                  className={cn(
                    'rounded-md px-2 py-2 text-left ring-1 transition',
                    s.format === f.id ? 'bg-accent/15 ring-accent/60' : 'bg-ink-800 ring-ink-650 hover:bg-ink-750',
                  )}
                >
                  <div className={cn('text-[12px] font-semibold', s.format === f.id ? 'text-accent' : 'text-ink-100')}>{f.label}</div>
                  <div className="text-[9.5px] text-ink-400">{f.note}</div>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Quality">
            <Slider
              label="Quality"
              value={s.quality}
              min={40}
              max={100}
              defaultValue={92}
              format={(v) => `${v.toFixed(0)}%`}
              disabled={s.format === 'image/png'}
              onChange={(v) => set({ quality: v })}
            />
          </Section>
          <Section title="Resolution">
            <div className="grid grid-cols-4 gap-1.5">
              {SCALES.map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => set({ scale: sc })}
                  className={cn('h-8 rounded-md text-[11.5px] ring-1 transition', s.scale === sc ? 'bg-accent/15 text-accent ring-accent/60' : 'bg-ink-800 text-ink-200 ring-ink-650 hover:bg-ink-750')}
                >
                  {sc * 100}%
                </button>
              ))}
            </div>
            {dims && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-ink-900 px-3 py-2 font-mono text-[11px] ring-1 ring-ink-650">
                <span className="text-ink-400">Output</span>
                <span className="text-ink-100">
                  {dims[0]} × {dims[1]} px
                </span>
              </div>
            )}
          </Section>
          <Section title="File name">
            <div className="flex items-center gap-1 rounded-md bg-ink-900 px-2 ring-1 ring-ink-650 focus-within:ring-accent/60">
              <span className="truncate font-mono text-[11px] text-ink-500">name</span>
              <input
                value={s.suffix}
                onChange={(e) => set({ suffix: e.target.value.replace(/[\\/:*?"<>|]/g, '') })}
                className="h-8 min-w-0 flex-1 bg-transparent font-mono text-[11px] text-ink-100 outline-none"
              />
              <span className="font-mono text-[11px] text-ink-500">.{EXT[s.format]}</span>
            </div>
            {current && <div className="mt-1.5 truncate font-mono text-[10px] text-ink-500">→ {outputName(current.name, s)}</div>}
          </Section>
          <div className="mt-4 grid gap-2">
            <Button variant="primary" className="h-10 text-[13px]" disabled={!currentId || !!progress} onClick={() => currentId && run([currentId])}>
              {progress ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />} Export current image
            </Button>
          </div>
        </div>

        {/* preview */}
        <div className="order-1 flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900 lg:order-2">
          <div className="flex items-center justify-between border-b border-ink-700 bg-ink-850 px-4 py-2.5">
            <div className="text-[12px] font-medium text-ink-100">{current?.name ?? 'Nothing selected'}</div>
            <button type="button" onClick={() => setPage('color')} className="text-[11px] text-ink-400 hover:text-accent">
              ← Back to Color
            </button>
          </div>
          <div className="checker flex min-h-0 flex-1 items-center justify-center p-6">
            {preview ? (
              <img src={preview} alt="Graded preview" className="max-h-[62vh] max-w-full rounded shadow-[0_20px_60px_rgba(0,0,0,0.7)]" />
            ) : (
              <div className="text-[12px] text-ink-500">Import an image to preview the render.</div>
            )}
          </div>
          {progress && (
            <div className="border-t border-ink-700 bg-ink-850 px-4 py-3">
              <div className="mb-1.5 flex justify-between text-[11px] text-ink-300">
                <span>Rendering at full resolution…</span>
                <span className="font-mono">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* queue */}
        <div className="order-3 flex flex-col gap-4">
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">Render Queue</div>
              <button
                type="button"
                className="text-[11px] text-ink-400 hover:text-ink-100"
                onClick={() => setQueue(allQueued ? [] : media.map((m) => m.id))}
              >
                {allQueued ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
              {media.map((m) => {
                const on = queue.includes(m.id);
                const graded = m.id === currentId ? editHasChanges(edit) : editHasChanges(editFor(m.id));
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={cn('flex w-full items-center gap-2.5 rounded-md p-1.5 text-left ring-1 transition', on ? 'bg-ink-750 ring-ink-500' : 'ring-transparent hover:bg-ink-800')}
                  >
                    {on ? <CheckSquare size={14} className="shrink-0 text-accent" /> : <Square size={14} className="shrink-0 text-ink-500" />}
                    <img src={m.graded ?? m.thumb} alt="" className="h-9 w-14 shrink-0 rounded object-cover" draggable={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] text-ink-100">{m.name}</span>
                      <span className={cn('text-[10px]', graded ? 'text-accent-2' : 'text-ink-500')}>{graded ? 'Graded' : 'Ungraded'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button className="mt-3 w-full" disabled={!queue.length || !!progress} onClick={() => run(queue)}>
              <Package size={14} /> Render {queue.length} {queue.length === 1 ? 'image' : 'images'}
              {queue.length > 1 ? ' (ZIP)' : ''}
            </Button>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">Other outputs</div>
            <div className="grid gap-2">
              <Button onClick={exportLut} disabled={!currentId}>
                <Box size={14} /> Export grade as LUT (.cube)
              </Button>
              <Button onClick={saveGrade} disabled={!currentId}>
                <FileJson size={14} /> Save grade preset (.json)
              </Button>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">The LUT can be loaded in DaVinci Resolve, Premiere Pro, Photoshop or OBS.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
