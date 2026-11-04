import { useEffect, useState } from 'react';
import { Camera, Download, Plus, Trash2, Upload, Palette, Box, GalleryHorizontalEnd, Check } from 'lucide-react';
import { useEditor } from '../state/editor';
import { LOOKS, lookEdit } from '../lib/looks';
import { renderGradedThumb } from '../lib/media';
import { Button, Tabs } from './ui';
import { cn } from '../utils/cn';

type Tab = 'looks' | 'luts' | 'gallery';

export function LooksGrid() {
  const { currentImage, currentId, applyLook, selectedNode } = useEditor();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentImage || !currentId) {
      setThumbs({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (let i = 0; i < LOOKS.length; i++) {
        if (cancelled) return;
        const look = LOOKS[i];
        const url = renderGradedThumb(currentImage, currentId, lookEdit(look), {}, 220);
        if (url) next[look.id] = url;
        if (i % 4 === 3) {
          setThumbs({ ...next });
          await new Promise((r) => setTimeout(r, 16));
        }
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentImage, currentId]);

  const categories = Array.from(new Set(LOOKS.map((l) => l.category)));
  return (
    <div className="space-y-3">
      <p className="text-[10.5px] leading-relaxed text-ink-400">
        Click a look to apply it to the selected node, or <Plus size={10} className="inline" /> to stack it as a new node.
      </p>
      {categories.map((cat) => (
        <div key={cat}>
          <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-500">{cat}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {LOOKS.filter((l) => l.category === cat).map((look) => {
              const active = selectedNode.label === look.name;
              return (
                <div
                  key={look.id}
                  className={cn('group relative overflow-hidden rounded-md border bg-ink-900 transition', active ? 'border-accent' : 'border-ink-650 hover:border-ink-400')}
                >
                  <button type="button" onClick={() => applyLook(look)} className="block w-full text-left" disabled={!currentImage}>
                    <div className="aspect-[3/2] w-full overflow-hidden bg-ink-950">
                      {thumbs[look.id] ? (
                        <img src={thumbs[look.id]} alt={look.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" draggable={false} />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-ink-800" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 truncate px-1.5 py-1 text-[10.5px] text-ink-200">
                      {active && <Check size={10} className="shrink-0 text-accent" />}
                      <span className="truncate">{look.name}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Add as new serial node"
                    onClick={() => applyLook(look, true)}
                    className="absolute right-1 top-1 hidden rounded bg-black/75 p-1 text-white hover:bg-accent group-hover:block"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LutList() {
  const { luts, selectedNode, setGrade, removeLut, openLutImport, exportLut } = useEditor();
  const list = Object.values(luts);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Button onClick={openLutImport} className="px-2">
          <Upload size={13} /> Import .cube
        </Button>
        <Button onClick={exportLut} className="px-2" title="Bake the current grade into a 33³ .cube LUT">
          <Download size={13} /> Export LUT
        </Button>
      </div>
      <p className="text-[10.5px] leading-relaxed text-ink-400">
        Load 3D LUTs (.cube) from DaVinci Resolve, Premiere, Final Cut or any LUT pack. <b className="text-ink-300">Export LUT</b> bakes your node tree into a .cube you can
        use in Resolve.
      </p>
      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink-600 p-4 text-center text-[11px] text-ink-500">No LUTs loaded yet. Drop a .cube file anywhere.</div>
      ) : (
        <div className="space-y-1">
          {list.map((l) => {
            const active = selectedNode.grade.lutId === l.id;
            return (
              <div
                key={l.id}
                className={cn('group flex items-center gap-2 rounded-md px-2 py-1.5 ring-1 transition', active ? 'bg-accent/10 ring-accent/50' : 'bg-ink-850 ring-ink-650 hover:ring-ink-500')}
              >
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setGrade('lutId', active ? null : l.id)}>
                  <Box size={13} className={active ? 'text-accent' : 'text-ink-400'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-ink-100">{l.name}</span>
                    <span className="font-mono text-[9.5px] text-ink-500">
                      {l.size}³ · {active ? 'on selected node' : 'click to apply'}
                    </span>
                  </span>
                </button>
                <button type="button" title="Remove LUT" onClick={() => removeLut(l.id)} className="rounded p-1 text-ink-500 opacity-0 hover:text-red-400 group-hover:opacity-100">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Gallery() {
  const { stills, grabStill, applyStill, deleteStill, currentImage } = useEditor();
  return (
    <div className="space-y-2.5">
      <Button className="w-full" onClick={grabStill} disabled={!currentImage}>
        <Camera size={13} /> Grab Still
        <span className="ml-1 font-mono text-[9.5px] text-ink-400">Ctrl+Alt+G</span>
      </Button>
      {stills.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink-600 p-4 text-center text-[11px] leading-relaxed text-ink-500">
          Grab stills to save the current grade, then click a still to apply that grade to any other image.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {stills.map((s) => (
            <div key={s.id} className="group relative overflow-hidden rounded-md border border-ink-650 bg-ink-900 hover:border-ink-400">
              <button type="button" onClick={() => applyStill(s.id)} className="block w-full text-left" title="Apply this grade">
                <div className="aspect-[3/2] w-full overflow-hidden bg-ink-950">
                  {s.thumb && <img src={s.thumb} alt={s.name} className="h-full w-full object-cover" draggable={false} />}
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 text-[10.5px]">
                  <span className="truncate text-ink-200">{s.name}</span>
                  <span className="font-mono text-[9px] text-ink-500">{s.nodes.length}n</span>
                </div>
              </button>
              <button
                type="button"
                title="Delete still"
                onClick={() => deleteStill(s.id)}
                className="absolute right-1 top-1 hidden rounded bg-black/75 p-1 text-white hover:bg-red-500 group-hover:block"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('looks');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-ink-700 bg-ink-800 px-1.5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: 'looks', label: 'Looks', icon: <Palette size={12} /> },
            { id: 'luts', label: 'LUTs', icon: <Box size={12} /> },
            { id: 'gallery', label: 'Gallery', icon: <GalleryHorizontalEnd size={12} /> },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{tab === 'looks' ? <LooksGrid /> : tab === 'luts' ? <LutList /> : <Gallery />}</div>
    </div>
  );
}
