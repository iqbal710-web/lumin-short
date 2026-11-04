import { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryApi<T> {
  get: () => HistoryState<T>;
  /** transient = live drag update (no undo step until commit / next non-transient update) */
  update: (fn: (t: T) => T, transient?: boolean) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  reset: (s: HistoryState<T>) => void;
  snapshot: () => HistoryState<T>;
}

const LIMIT = 100;

/** Ref-based undo/redo history (StrictMode safe, no side effects inside state updaters) */
export function useHistory<T>(initial: () => T): HistoryApi<T> {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const ref = useRef<HistoryState<T> | null>(null);
  if (ref.current === null) ref.current = { past: [], present: initial(), future: [] };
  const base = useRef<T | null>(null);

  return useMemo<HistoryApi<T>>(() => {
    const flush = () => {
      const b = base.current;
      if (b === null) return;
      base.current = null;
      const h = ref.current!;
      if (b !== h.present) ref.current = { past: [...h.past, b].slice(-LIMIT), present: h.present, future: [] };
    };
    return {
      get: () => ref.current!,
      update(fn, transient = false) {
        const h = ref.current!;
        const next = fn(h.present);
        if (next === h.present) {
          if (!transient) flush();
          force();
          return;
        }
        if (transient) {
          if (base.current === null) base.current = h.present;
          ref.current = { ...h, present: next };
        } else {
          const b = base.current ?? h.present;
          base.current = null;
          ref.current = { past: [...h.past, b].slice(-LIMIT), present: next, future: [] };
        }
        force();
      },
      commit() {
        flush();
        force();
      },
      undo() {
        flush();
        const h = ref.current!;
        if (!h.past.length) return;
        ref.current = { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
        force();
      },
      redo() {
        flush();
        const h = ref.current!;
        if (!h.future.length) return;
        ref.current = { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
        force();
      },
      reset(s) {
        base.current = null;
        ref.current = s;
        force();
      },
      snapshot() {
        flush();
        return ref.current!;
      },
    };
  }, []);
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
