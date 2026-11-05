import type { Layer, MaskComp, MaskType, PeoplePart } from '../types';
import { gradeFlags, uid } from './grade';

/** Masks are evaluated on the CPU at this resolution (long edge) and uploaded as a texture */
export const MASK_MAX = 1024;

export function maskDims(w: number, h: number): [number, number] {
  const s = Math.min(1, MASK_MAX / Math.max(w, h, 1));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

export interface MaskBuf {
  w: number;
  h: number;
  data: Uint8Array;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */
/* Brush buffers (snapshots make undo / redo work)                     */
/* ------------------------------------------------------------------ */
const snapshots = new Map<string, MaskBuf>();
let live: { id: string; buf: MaskBuf; commit?: number } | null = null;
let rev = 0;
const listeners = new Set<() => void>();

export const maskRevision = () => rev;
export function subscribeMaskLive(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function bump() {
  rev++;
  listeners.forEach((f) => f());
}

function resampleNearest(b: MaskBuf, w: number, h: number): Uint8Array {
  if (b.w === w && b.h === h) return b.data.slice();
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(b.h - 1, Math.floor((y / h) * b.h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(b.w - 1, Math.floor((x / w) * b.w));
      out[y * w + x] = b.data[sy * b.w + sx];
    }
  }
  return out;
}

function getBrushBuf(c: MaskComp): MaskBuf | null {
  if (live && live.id === c.id) {
    if (live.commit !== undefined && c.strokes >= live.commit) live = null;
    else return live.buf;
  }
  return snapshots.get(`${c.id}:${c.strokes}`) ?? null;
}

export function setSnapshot(c: MaskComp, strokes: number, buf: MaskBuf) {
  snapshots.set(`${c.id}:${strokes}`, buf);
  if (snapshots.size > 90) {
    const first = snapshots.keys().next().value;
    if (first !== undefined) snapshots.delete(first);
  }
  bump();
}

export function copyBrush(from: MaskComp, to: MaskComp) {
  const b = snapshots.get(`${from.id}:${from.strokes}`);
  if (b) snapshots.set(`${to.id}:${to.strokes}`, { w: b.w, h: b.h, data: b.data.slice() });
}

export function beginStroke(c: MaskComp, w: number, h: number) {
  const cur = getBrushBuf(c);
  const data = cur ? resampleNearest(cur, w, h) : new Uint8Array(w * h);
  live = { id: c.id, buf: { w, h, data } };
}

function stamp(cx: number, cy: number, r: number, hardness: number, flow: number, erase: boolean) {
  if (!live) return;
  const { w, h, data } = live.buf;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const a = d <= hardness ? 1 : 1 - (d - hardness) / Math.max(1e-3, 1 - hardness);
      const k = a * flow;
      const i = y * w + x;
      if (erase) data[i] = data[i] * (1 - k);
      else data[i] = data[i] + (255 - data[i]) * k;
    }
  }
}

export function strokeLine(x0: number, y0: number, x1: number, y1: number, r: number, hardness: number, flow: number, erase: boolean) {
  if (!live) return;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(1, r * 0.25);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, hardness, flow, erase);
  }
  bump();
}

/** Store the finished stroke as the snapshot for `strokes` (the live buffer stays until the edit catches up) */
export function commitStroke(c: MaskComp, strokes: number) {
  if (!live || live.id !== c.id) return;
  snapshots.set(`${c.id}:${strokes}`, { w: live.buf.w, h: live.buf.h, data: live.buf.data.slice() });
  live.commit = strokes;
  bump();
}

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */
const NAMES: Record<MaskType, string> = {
  brush: 'Brush Mask',
  linear: 'Linear Gradient',
  radial: 'Radial Gradient',
  luminosity: 'Luminosity Mask',
  color: 'Color Range',
  people: 'People',
};

export function makeMask(type: MaskType, part: PeoplePart = 'person'): MaskComp {
  const name = type === 'people' ? (part === 'skin' ? 'Skin (auto)' : part === 'hair' ? 'Hair (auto)' : 'People (auto)') : NAMES[type];
  return {
    id: uid(),
    type,
    name,
    op: 'add',
    invert: false,
    enabled: true,
    feather: 0,
    refine: 0,
    x1: type === 'radial' ? 0.5 : 0.5,
    y1: type === 'radial' ? 0.5 : 0.15,
    x2: type === 'radial' ? 0.3 : 0.5,
    y2: type === 'radial' ? 0.3 : 0.65,
    lumLow: 0.6,
    lumHigh: 1,
    hue: 20,
    hueRange: 30,
    satMin: 12,
    strokes: 0,
    part,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A layer only costs GPU time if it can change the picture */
export function layerActive(l: Layer): boolean {
  if (l.kind === 'filled') return true;
  return gradeFlags(l.grade).any;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */
export function layerMaskKey(l: Layer): string {
  const liveHere = live && l.masks.some((m) => m.id === live!.id);
  return JSON.stringify(l.masks) + (liveHere ? `|L${rev}` : '');
}

function boxBlurPass(src: Uint8Array, dst: Uint8Array, w: number, h: number, r: number, horizontal: boolean) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 1 : w;
  const win = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[base + Math.min(len - 1, Math.max(0, k)) * stride];
    for (let i = 0; i < len; i++) {
      dst[base + i * stride] = (acc / win) | 0;
      acc += src[base + Math.min(len - 1, i + r + 1) * stride] - src[base + Math.max(0, i - r) * stride];
    }
  }
}

function blur(m: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const r = Math.max(1, Math.round(radius / 1.7));
  let a: Uint8Array = m;
  let b: Uint8Array = new Uint8Array(m.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(a, b, w, h, r, true);
    [a, b] = [b, a];
    boxBlurPass(a, b, w, h, r, false);
    [a, b] = [b, a];
  }
  return a;
}

function compMask(c: MaskComp, w: number, h: number, pix: Uint8ClampedArray | null): Uint8Array {
  const out = new Uint8Array(w * h);
  if (c.type === 'brush' || c.type === 'people') {
    const b = getBrushBuf(c);
    return b ? resampleNearest(b, w, h) : out;
  }
  if (c.type === 'linear') {
    const dx = c.x2 - c.x1;
    const dy = c.y2 - c.y1;
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const t = ((u - c.x1) * dx + (v - c.y1) * dy) / len2;
        const s = clamp01(1 - t);
        out[y * w + x] = s * s * (3 - 2 * s) * 255;
      }
    }
    return out;
  }
  if (c.type === 'radial') {
    const rx = Math.max(1e-3, Math.abs(c.x2));
    const ry = Math.max(1e-3, Math.abs(c.y2));
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const d = Math.hypot((u - c.x1) / rx, (v - c.y1) / ry);
        out[y * w + x] = (1 - smooth(0.55, 1, d)) * 255;
      }
    }
    return out;
  }
  if (!pix) return out;
  if (c.type === 'luminosity') {
    const soft = 0.06;
    for (let i = 0; i < w * h; i++) {
      const l = (0.2126 * pix[i * 4] + 0.7152 * pix[i * 4 + 1] + 0.0722 * pix[i * 4 + 2]) / 255;
      const lo = c.lumLow <= 0.001 ? 1 : smooth(c.lumLow - soft, c.lumLow + soft, l);
      const hi = c.lumHigh >= 0.999 ? 1 : 1 - smooth(c.lumHigh - soft, c.lumHigh + soft, l);
      out[i] = lo * hi * 255;
    }
    return out;
  }
  // color range
  const range = Math.max(4, c.hueRange);
  const satMin = c.satMin / 100;
  for (let i = 0; i < w * h; i++) {
    const r = pix[i * 4] / 255;
    const g = pix[i * 4 + 1] / 255;
    const b = pix[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const d = mx - mn;
    if (mx < 0.04 || d <= 1e-5) continue;
    let hue: number;
    if (mx === r) hue = ((g - b) / d + 6) % 6;
    else if (mx === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    let dh = Math.abs(hue - c.hue);
    if (dh > 180) dh = 360 - dh;
    const wh = 1 - smooth(range * 0.55, range, dh);
    const sat = d / mx;
    const ws = smooth(satMin * 0.5, Math.max(satMin, 0.02), sat);
    out[i] = wh * ws * 255;
  }
  return out;
}

/** Combine every mask component of a layer (add / subtract / intersect) into one 8-bit mask. null = no mask (full effect) */
export function evalLayerMask(layer: Layer, w: number, h: number, pix: Uint8ClampedArray | null): Uint8Array | null {
  const comps = layer.masks.filter((c) => c.enabled);
  if (!comps.length) return null;
  let acc: Uint8Array | null = null;
  for (const c of comps) {
    let m = compMask(c, w, h, pix);
    if (c.feather > 0) m = blur(m, w, h, (c.feather / 100) * 0.05 * Math.max(w, h));
    if (c.refine !== 0) {
      const thr = 0.5 - (c.refine / 100) * 0.3;
      for (let i = 0; i < m.length; i++) m[i] = clamp01((m[i] / 255 - thr) * 2.6 + 0.5) * 255;
    }
    if (c.invert) for (let i = 0; i < m.length; i++) m[i] = 255 - m[i];
    if (!acc) {
      if (c.op === 'subtract') for (let i = 0; i < m.length; i++) m[i] = 255 - m[i];
      acc = m;
    } else if (c.op === 'add') {
      for (let i = 0; i < m.length; i++) acc[i] = Math.max(acc[i], m[i]);
    } else if (c.op === 'subtract') {
      for (let i = 0; i < m.length; i++) acc[i] = (acc[i] * (255 - m[i])) / 255;
    } else {
      for (let i = 0; i < m.length; i++) acc[i] = (acc[i] * m[i]) / 255;
    }
  }
  return acc;
}

/* ------------------------------------------------------------------ */
/* People / skin / hair detection (MediaPipe, loaded on demand)        */
/* ------------------------------------------------------------------ */
const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSegmenter(): Promise<any> {
  if (!segPromise) {
    const p = (async () => {
      const url: string = `${MP_BASE}/vision_bundle.mjs`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(/* @vite-ignore */ url);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      return mod.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })();
    p.catch(() => {
      segPromise = null;
    });
    segPromise = p;
  }
  return segPromise;
}

export async function detectPeople(img: HTMLImageElement, part: PeoplePart, mw: number, mh: number): Promise<MaskBuf> {
  const seg = await getSegmenter();
  const res = seg.segment(img);
  const masks = res.confidenceMasks as { getAsFloat32Array: () => Float32Array; width: number; height: number }[];
  const sw: number = masks[0].width;
  const sh: number = masks[0].height;
  const bg = masks[0].getAsFloat32Array();
  const src = new Float32Array(sw * sh);
  if (part === 'person') {
    for (let i = 0; i < src.length; i++) src[i] = 1 - bg[i];
  } else if (part === 'hair') {
    src.set(masks[1].getAsFloat32Array());
  } else {
    const a = masks[2].getAsFloat32Array();
    const b = masks[3].getAsFloat32Array();
    for (let i = 0; i < src.length; i++) src[i] = Math.min(1, a[i] + b[i]);
  }
  try {
    res.close?.();
  } catch {
    /* ignore */
  }
  const data = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    const fy = Math.min(sh - 1.001, (y / mh) * sh);
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < mw; x++) {
      const fx = Math.min(sw - 1.001, (x / mw) * sw);
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const a = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x0 + 1] * tx;
      const b = src[(y0 + 1) * sw + x0] * (1 - tx) + src[(y0 + 1) * sw + x0 + 1] * tx;
      data[y * mw + x] = clamp01(a * (1 - ty) + b * ty) * 255;
    }
  }
  return { w: mw, h: mh, data };
}
