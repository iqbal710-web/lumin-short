import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { Eye, EyeOff, Plus, RotateCcw, Trash2, Workflow, ImageIcon, MonitorPlay } from 'lucide-react';
import type { GradeNode } from '../types';
import { useEditor } from '../state/editor';
import { gradeFlags } from '../lib/grade';
import { IconBtn, PanelHeader, Select, Slider } from './ui';
import { cn } from '../utils/cn';

const BADGES: { key: 'wheels' | 'primaries' | 'curves' | 'hue' | 'fx' | 'lut'; label: string; title: string; cls: string }[] = [
  { key: 'wheels', label: 'W', title: 'Color wheels', cls: 'bg-orange-500/20 text-orange-300' },
  { key: 'primaries', label: 'P', title: 'Primaries / adjust', cls: 'bg-amber-500/20 text-amber-300' },
  { key: 'curves', label: 'C', title: 'Custom curves', cls: 'bg-sky-500/20 text-sky-300' },
  { key: 'hue', label: 'H', title: 'Hue curves', cls: 'bg-fuchsia-500/20 text-fuchsia-300' },
  { key: 'fx', label: 'FX', title: 'Detail effects', cls: 'bg-emerald-500/20 text-emerald-300' },
  { key: 'lut', label: 'LUT', title: '3D LUT', cls: 'bg-violet-500/20 text-violet-300' },
];

function NodeBox({ node, index, selected, onSelect, onToggle }: { node: GradeNode; index: number; selected: boolean; onSelect: () => void; onToggle: () => void }) {
  const f = gradeFlags(node.grade);
  const badges = BADGES.filter((b) => f[b.key]);
  return (
    <div
      data-node={node.id}
      onClick={onSelect}
      onDoubleClick={onToggle}
      title="Click = select · Double-click = enable/disable"
      className={cn(
        'relative w-[108px] shrink-0 cursor-pointer rounded-md border bg-ink-750 shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-ink-600 hover:border-ink-400',
        !node.enabled && 'opacity-45',
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-ink-650 px-1.5 py-1">
        <span className={cn('rounded px-1 font-mono text-[9px] font-semibold', node.enabled ? 'bg-ink-600 text-ink-100' : 'bg-red-500/30 text-red-300')}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="truncate text-[10px] text-ink-200">{node.label || 'Corrector'}</span>
      </div>
      <div className="flex min-h-[34px] flex-wrap content-center items-center gap-0.5 p-1.5">
        {badges.length ? (
          badges.map((b) => (
            <span key={b.key} title={b.title} className={cn('rounded px-1 font-mono text-[8.5px] font-semibold', b.cls)}>
              {b.label}
            </span>
          ))
        ) : (
          <span className="text-[9px] text-ink-500">No correction</span>
        )}
      </div>
      {node.grade.mix < 100 && (
        <div className="absolute inset-x-1.5 bottom-0.5 h-[2px] rounded bg-ink-600">
          <div className="h-full rounded bg-accent" style={{ width: `${node.grade.mix}%` }} />
        </div>
      )}
      <span className="absolute -left-[5px] top-1/2 size-2 -translate-y-1/2 rotate-45 bg-emerald-400 shadow" />
      <span className="absolute -right-[5px] top-1/2 size-2 -translate-y-1/2 rounded-[2px] bg-sky-400 shadow" />
    </div>
  );
}

const Wire = () => (
  <div className="relative h-[2px] w-6 shrink-0 bg-gradient-to-r from-sky-400/70 to-emerald-400/70">
    <span className="absolute -top-[3px] left-1/2 size-2 -translate-x-1/2 rounded-full border border-ink-500 bg-ink-800" />
  </div>
);

function IO({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex size-10 items-center justify-center rounded-full border border-ink-500 bg-ink-800 text-ink-300 shadow-inner">{icon}</div>
      <span className="text-[8.5px] uppercase tracking-wider text-ink-500">{label}</span>
    </div>
  );
}

export function NodeEditor() {
  const { edit, selectedNode, selectedIndex, selectNode, addNode, deleteNode, toggleNode, resetNode, renameNode, setGrade, luts, commit } = useEditor();
  const nodes = edit.nodes;
  const g = selectedNode.grade;
  const lutOptions = [{ value: '', label: 'None' }, ...Object.values(luts).map((l) => ({ value: l.id, label: `${l.name} (${l.size}³)` }))];
  const scrollRef = useRef<HTMLDivElement>(null);

  // keep the selected node visible in the graph
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const el = sc.querySelector<HTMLElement>(`[data-node="${selectedNode.id}"]`);
    if (!el) return;
    const l = el.offsetLeft;
    const r = l + el.offsetWidth;
    if (l < sc.scrollLeft + 16) sc.scrollTo({ left: Math.max(0, l - 70), behavior: 'smooth' });
    else if (r > sc.scrollLeft + sc.clientWidth - 16) sc.scrollTo({ left: r - sc.clientWidth + 70, behavior: 'smooth' });
  }, [selectedNode.id, nodes.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Nodes" icon={<Workflow size={13} />}>
        <IconBtn title="Add serial node (Alt+S)" onClick={() => addNode()}>
          <Plus size={14} />
        </IconBtn>
        <IconBtn title="Enable / disable node (Ctrl+D)" onClick={() => toggleNode()}>
          {selectedNode.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
        </IconBtn>
        <IconBtn title="Reset node grade" onClick={() => resetNode()}>
          <RotateCcw size={13} />
        </IconBtn>
        <IconBtn title="Delete node (Del)" disabled={nodes.length <= 1} onClick={() => deleteNode()}>
          <Trash2 size={13} />
        </IconBtn>
      </PanelHeader>

      <div ref={scrollRef} className="dot-grid relative min-h-[120px] flex-1 overflow-auto">
        <div className="flex min-h-full min-w-max items-center px-4 py-6">
          <IO label="Source" icon={<ImageIcon size={15} />} />
          {nodes.map((n, i) => (
            <Fragment key={n.id}>
              <Wire />
              <NodeBox node={n} index={i} selected={n.id === selectedNode.id} onSelect={() => selectNode(n.id)} onToggle={() => toggleNode(n.id)} />
            </Fragment>
          ))}
          <Wire />
          <IO label="Output" icon={<MonitorPlay size={15} />} />
          <button
            type="button"
            onClick={() => addNode()}
            title="Add serial node (Alt+S)"
            className="ml-4 flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-500 text-ink-400 transition hover:border-accent hover:text-accent"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-ink-700 bg-ink-800 p-2.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-ink-400">
          <span>
            Node {String(selectedIndex + 1).padStart(2, '0')} properties
          </span>
          <span className={cn('normal-case tracking-normal', selectedNode.enabled ? 'text-emerald-400' : 'text-red-400')}>
            {selectedNode.enabled ? '● Enabled' : '○ Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[70px] text-[11px] text-ink-300">Label</label>
          <input
            value={selectedNode.label}
            onChange={(e) => renameNode(selectedNode.id, e.target.value, true)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-7 min-w-0 flex-1 rounded bg-ink-900 px-2 text-[11px] text-ink-100 outline-none ring-1 ring-ink-650 focus:ring-accent/60"
          />
        </div>
        <Slider compact label="Key Output" value={g.mix} min={0} max={100} defaultValue={100} format={(v) => `${v.toFixed(0)}%`} onChange={(v, t) => setGrade('mix', v, t)} />
        <div className="flex items-center gap-2">
          <label className="w-[70px] text-[11px] text-ink-300">3D LUT</label>
          <Select value={g.lutId && luts[g.lutId] ? g.lutId : ''} onChange={(v) => setGrade('lutId', v || null)} options={lutOptions} className="min-w-0 flex-1" />
        </div>
        {g.lutId && luts[g.lutId] && (
          <Slider compact label="LUT Mix" value={g.lutAmount} min={0} max={100} defaultValue={100} format={(v) => `${v.toFixed(0)}%`} onChange={(v, t) => setGrade('lutAmount', v, t)} />
        )}
      </div>
    </div>
  );
}
