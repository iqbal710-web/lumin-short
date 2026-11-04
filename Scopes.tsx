import { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import type { ScopeType } from '../types';
import { useEditor } from '../state/editor';
import { drawScope, scopeStore } from '../lib/scopes';
import { useElementSize } from '../hooks';
import { PanelHeader, Select } from './ui';

const OPTIONS: { value: ScopeType; label: string }[] = [
  { value: 'parade', label: 'RGB Parade' },
  { value: 'waveform', label: 'Waveform' },
  { value: 'vectorscope', label: 'Vectorscope' },
  { value: 'histogram', label: 'Histogram' },
];

export function ScopesPanel() {
  const { scopeType, setScopeType } = useEditor();
  const [ref, size] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = 0;
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(size.width));
      const h = Math.max(1, Math.floor(size.height));
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScope(ctx, scopeType, scopeStore.get(), w, h);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    schedule();
    const unsub = scopeStore.subscribe(schedule);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [scopeType, size.width, size.height]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Scopes" icon={<Activity size={13} />}>
        <Select value={scopeType} onChange={(v) => setScopeType(v as ScopeType)} options={OPTIONS} title="Scope type" />
      </PanelHeader>
      <div ref={ref} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
