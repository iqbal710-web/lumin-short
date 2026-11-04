import { zipSync } from 'fflate';
import { Renderer } from '../gl/Renderer';
import type { EditState, ExportSettings, GradeNode, LutData } from '../types';
import { buildCube } from './cube';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

/** Downscale an image to a canvas if it is larger than maxSize on the long edge */
export function previewSource(img: HTMLImageElement, maxSize: number): { source: TexImageSource; w: number; h: number } {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.min(1, maxSize / Math.max(iw, ih));
  if (s >= 1) return { source: img, w: iw, h: ih };
  const w = Math.max(1, Math.round(iw * s));
  const h = Math.max(1, Math.round(ih * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { source: c, w, h };
}

export function makeThumb(img: HTMLImageElement, max = 320): string {
  const p = previewSource(img, max);
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  c.getContext('2d')!.drawImage(p.source as CanvasImageSource, 0, 0, p.w, p.h);
  return c.toDataURL('image/jpeg', 0.82);
}

/* ---------------- shared thumbnail renderer (looks, stills, graded clip thumbs) ---------------- */
let thumbRenderer: Renderer | null | undefined;
let thumbKey = '';

export function renderGradedThumb(
  img: HTMLImageElement,
  key: string,
  edit: EditState,
  luts: Record<string, LutData>,
  max = 240,
): string | null {
  if (thumbRenderer === undefined) {
    try {
      thumbRenderer = new Renderer(document.createElement('canvas'), { preserve: true });
    } catch {
      thumbRenderer = null;
    }
  }
  const r = thumbRenderer;
  if (!r) return null;
  const k = `${key}@${max}`;
  if (thumbKey !== k) {
    const p = previewSource(img, max);
    r.setSource(p.source, p.w, p.h);
    thumbKey = k;
  }
  r.setLuts(luts);
  r.render(edit, { mode: 0, split: 0, clipping: false, ignoreCrop: false });
  return r.canvas.toDataURL('image/jpeg', 0.85);
}

/* ---------------- full resolution export ---------------- */
export const EXT: Record<ExportSettings['format'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function outputName(name: string, s: ExportSettings) {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}${s.suffix}.${EXT[s.format]}`;
}

export async function renderFull(
  img: HTMLImageElement,
  edit: EditState,
  luts: Record<string, LutData>,
  s: ExportSettings,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const pixels = iw * ih * s.scale * s.scale;
  const r = new Renderer(canvas, { preserve: true, lowPrecision: pixels > 16e6 });
  try {
    const maxSide = Math.min(r.maxTexture, 8192);
    const target = Math.min(maxSide, Math.round(Math.max(iw, ih) * s.scale));
    const p = previewSource(img, target);
    r.setSource(p.source, p.w, p.h);
    r.setLuts(luts);
    r.render(edit, { mode: 0, split: 0, clipping: false, ignoreCrop: false });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, s.format, s.quality / 100));
    if (!blob) throw new Error('The browser could not encode the image');
    return blob;
  } finally {
    r.destroy();
  }
}

export function generateLutText(nodes: GradeNode[], luts: Record<string, LutData>, title: string, size = 33): string {
  const r = new Renderer(document.createElement('canvas'));
  try {
    r.setLuts(luts);
    return buildCube(title, size, r.generateLut(nodes, size));
  } finally {
    r.destroy();
  }
}

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of files) {
    let name = f.name;
    let i = 2;
    while (entries[name]) name = f.name.replace(/(\.[^.]+)$/, `_${i++}$1`);
    entries[name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  }
  const zipped = zipSync(entries);
  return new Blob([zipped as unknown as BlobPart], { type: 'application/zip' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function formatBytes(n?: number) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
