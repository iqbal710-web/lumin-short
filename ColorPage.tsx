import type { ReactNode } from 'react';
import { Camera, CircleDot, Crop, Images, Palette, Plus, RotateCcw, SlidersHorizontal, Sparkles, Spline, Workflow } from 'lucide-react';
import type { PaletteTab } from '../types';
import { useEditor } from '../state/editor';
import { Viewer } from './Viewer';
import { NodeEditor } from './NodeEditor';
import { LeftPanel } from './LeftPanel';
import { ScopesPanel } from './Scopes';
import { WheelsPalette } from './WheelsPalette';
import { CurvesPalette } from './CurvesPalette';
import { AdjustPalette, EffectsPalette, TransformPalette } from './SliderPalettes';
import { LayersPalette } from './LayersPalette';
import { RetouchPalette } from './RetouchPalette';
import { IconBtn } from './ui';
import { cn } from '../utils/cn';

function ClipStrip() {
  const { media, currentId, selectMedia, openImport } = useEditor();
  return (
    <div className="flex h-[76px] shrink-0 items-center gap-2 overflow-x-auto border-y border-ink-700 bg-ink-850 px-3">
      {media.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onClick={() => selectMedia(m.id)}
          title={`${m.name} · ${m.width}×${m.height}`}
          className={cn(
            'group relative h-[58px] w-[100px] shrink-0 overflow-hidden rounded border transition',
            m.id === currentId ? 'border-accent ring-1 ring-accent/50' : 'border-ink-650 opacity-80 hover:border-ink-400 hover:opacity-100',
          )}
        >
          <img src={m.graded ?? m.thumb} alt={m.name} className="h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-0.5 pt-4 text-[9.5px]">
            <span className="font-mono text-ink-300">{String(i + 1).padStart(2, '0')}</span>
            <span className="truncate text-ink-100">{m.name}</span>
          </div>
          {m.graded && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent shadow-[0_0_6px_#ff6b3d]" title="Graded" />}
        </button>
      ))}
      <button
        type="button"
        onClick={openImport}
        className="flex h-[58px] w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded border border-dashed border-ink-600 text-[10px] text-ink-400 transition hover:border-accent hover:text-accent"
      >
        <Plus size={15} />
        Import
      </button>
    </div>
  );
}

const TABS: { id: PaletteTab; label: string; icon: ReactNode; cls?: string }[] = [
  { id: 'wheels', label: 'Color Wheels', icon: <CircleDot size={13} /> },
  { id: 'curves', label: 'Curves', icon: <Spline size={13} /> },
  { id: 'adjust', label: 'Adjust', icon: <SlidersHorizontal size={13} /> },
  { id: 'effects', label: 'Effects', icon: <Sparkles size={13} /> },
  { id: 'layers', label: 'Layers & Masks', icon: <Images size={13} /> },
  { id: 'retouch', label: 'Retouch', icon: <Camera size={13} /> },
  { id: 'transform', label: 'Sizing', icon: <Crop size={13} /> },
  { id: 'looks', label: 'Looks', icon: <Palette size={13} />, cls: 'lg:hidden' },
  { id: 'nodes', label: 'Nodes', icon: <Workflow size={13} />, cls: 'xl:hidden' },
];

function PaletteBar() {
  const { palette, setPalette, selectedNode, selectedIndex, resetNode } = useEditor();
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-ink-700 bg-ink-800 px-2">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPalette(t.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition',
              palette === t.id ? 'bg-ink-650 text-ink-100 shadow-[inset_0_-2px_0_#ff6b3d]' : 'text-ink-400 hover:bg-ink-700 hover:text-ink-200',
              t.cls,
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-ink-400">
        <span className="hidden sm:inline">Editing</span>
        <span className="rounded bg-ink-650 px-1.5 py-0.5 font-mono text-[10px] text-ink-100">{String(selectedIndex + 1).padStart(2, '0')}</span>
        <span className="hidden max-w-[120px] truncate text-ink-200 sm:inline">{selectedNode.label || 'Corrector'}</span>
        <IconBtn title="Reset this node" onClick={() => resetNode()}>
          <RotateCcw size={12} />
        </IconBtn>
      </div>
    </div>
  );
}

function PaletteContent({ tab }: { tab: PaletteTab }) {
  switch (tab) {
    case 'wheels':
      return <WheelsPalette />;
    case 'curves':
      return <CurvesPalette />;
    case 'adjust':
      return <AdjustPalette />;
    case 'effects':
      return <EffectsPalette />;
    case 'layers':
      return <LayersPalette />;
    case 'retouch':
      return <RetouchPalette />;
    case 'transform':
      return <TransformPalette />;
    case 'looks':
      return <LeftPanel />;
    case 'nodes':
      return <NodeEditor />;
  }
}

export function ColorPage() {
  const { palette } = useEditor();
  return (
    <div className="flex h-full flex-col overflow-y-auto lg:overflow-hidden">
      <div className="flex h-[56vh] shrink-0 gap-px bg-ink-700 lg:h-auto lg:min-h-0 lg:flex-[1.45] lg:shrink">
        <aside className="hidden w-[252px] shrink-0 flex-col bg-ink-800 lg:flex 2xl:w-[290px]">
          <LeftPanel />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <Viewer />
        </section>
        <aside className="hidden w-[310px] shrink-0 flex-col bg-ink-800 xl:flex">
          <NodeEditor />
        </aside>
      </div>
      <ClipStrip />
      <div className="flex shrink-0 flex-col gap-px bg-ink-700 md:flex-row lg:min-h-[272px] lg:flex-1 lg:shrink">
        <section className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-ink-800 lg:min-h-0">
          <PaletteBar />
          <div className="min-h-0 flex-1 overflow-auto">
            <PaletteContent tab={palette} />
          </div>
        </section>
        <aside className="flex h-[260px] shrink-0 flex-col bg-ink-800 md:h-auto md:w-[300px] xl:w-[360px]">
          <ScopesPanel />
        </aside>
      </div>
    </div>
  );
}
