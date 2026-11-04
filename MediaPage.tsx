import { FolderOpen, ImagePlus, Palette, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useEditor } from '../state/editor';
import { formatBytes } from '../lib/media';
import { Button } from './ui';
import { cn } from '../utils/cn';

export function MediaPage() {
  const { media, currentId, selectMedia, removeMedia, openImport, loadSamples, setPage } = useEditor();
  const open = (id: string) => {
    selectMedia(id);
    setPage('color');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">Media Pool</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-100">Your photos</h1>
            <p className="mt-1 text-[13px] text-ink-400">
              {media.length} clip{media.length === 1 ? '' : 's'} in this session. Everything is processed locally on your GPU, so nothing is uploaded.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadSamples}>
              <Sparkles size={14} /> Load samples
            </Button>
            <Button variant="primary" onClick={openImport}>
              <FolderOpen size={14} /> Import images
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={openImport}
          className="group mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-600 bg-ink-850/60 px-6 py-10 text-center transition hover:border-accent/70 hover:bg-ink-800"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent transition group-hover:scale-110">
            <UploadCloud size={22} />
          </div>
          <div className="text-[14px] font-medium text-ink-100">Drag & drop photos anywhere</div>
          <div className="text-[12px] text-ink-400">JPG · PNG · WebP · AVIF · GIF, plus .cube LUTs and .json grades. You can also paste images (Ctrl+V).</div>
        </button>

        {media.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-10 text-center text-[13px] text-ink-400">No media yet. Import some photos or load the samples.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {media.map((m, i) => (
              <div
                key={m.id}
                className={cn(
                  'group overflow-hidden rounded-xl border bg-ink-850 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)]',
                  m.id === currentId ? 'border-accent' : 'border-ink-700 hover:border-ink-500',
                )}
              >
                <button type="button" onClick={() => open(m.id)} className="relative block aspect-[4/3] w-full overflow-hidden bg-ink-950">
                  <img src={m.graded ?? m.thumb} alt={m.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" draggable={false} />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-900">
                      <Palette size={12} /> Grade
                    </span>
                  </div>
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{String(i + 1).padStart(2, '0')}</span>
                  <div className="absolute right-2 top-2 flex gap-1">
                    {m.graded && <span className="rounded bg-accent px-1.5 py-0.5 text-[9.5px] font-semibold text-white">GRADED</span>}
                    {m.sample && <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9.5px] text-ink-200">SAMPLE</span>}
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-ink-100">{m.name}</div>
                    <div className="font-mono text-[10px] text-ink-500">
                      {m.width}×{m.height} · {formatBytes(m.bytes)}
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Remove from media pool"
                    onClick={() => removeMedia(m.id)}
                    className="rounded p-1.5 text-ink-500 transition hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={openImport}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-700 text-[12px] text-ink-400 transition hover:border-accent hover:text-accent"
            >
              <ImagePlus size={20} /> Add more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
