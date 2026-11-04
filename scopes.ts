import type { ScopeData, ScopeType } from '../types';

/* ---------------- tiny external store so scopes never re-render React ---------------- */
type Listener = (d: ScopeData | null) => void;
let latest: ScopeData | null = null;
const listeners = new Set<Listener>();

export const scopeStore = {
  get: () => latest,
  set(d: ScopeData | null) {
    latest = d;
    listeners.forEach((l) => l(d));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

let off: HTMLCanvasElement | null = null;
function blit(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number, w: number, h: number) {
  if (!off) off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  off.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(off, x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

const MONO = '9px "JetBrains Mono", ui-monospace, monospace';

function levelGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.lineWidth = 1;
  ctx.font = MONO;
  for (let i = 0; i <= 8; i++) {
    const yy = Math.round(y + h - (i / 8) * h) + 0.5;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillText(String(Math.round((i / 8) * 1023)), 3, Math.max(9, yy + 3));
    }
  }
}

function waveImage(sd: ScopeData, channel: number, color: [number, number, number]): ImageData {
  const { data, width: w, height: h } = sd;
  const acc = new Uint16Array(w * 256);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = channel < 0 ? (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0 : data[i + channel];
      acc[(255 - v) * w + x]++;
    }
  }
  const img = new ImageData(w, 256);
  const k = 1 / Math.max(1, h * 0.045);
  for (let i = 0; i < acc.length; i++) {
    const c = acc[i];
    if (!c) continue;
    const v = Math.min(1, Math.sqrt(c * k));
    const o = i * 4;
    img.data[o] = color[0];
    img.data[o + 1] = color[1];
    img.data[o + 2] = color[2];
    img.data[o + 3] = Math.round(40 + 215 * v);
  }
  return img;
}

function drawWaveform(ctx: CanvasRenderingContext2D, sd: ScopeData, W: number, H: number, parade: boolean) {
  const padL = 30;
  const padR = 8;
  const padT = 10;
  const padB = 10;
  const aw = W - padL - padR;
  const ah = H - padT - padB;
  levelGrid(ctx, padL, padT, aw, ah);
  if (!parade) {
    blit(ctx, waveImage(sd, -1, [200, 245, 210]), padL, padT, aw, ah);
    return;
  }
  const gap = 6;
  const pw = (aw - gap * 2) / 3;
  const colors: [number, number, number][] = [
    [255, 72, 72],
    [72, 240, 110],
    [84, 146, 255],
  ];
  for (let c = 0; c < 3; c++) {
    const x = padL + c * (pw + gap);
    blit(ctx, waveImage(sd, c, colors[c]), x, padT, pw, ah);
    if (c > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x - gap / 2 - 0.5, padT, 1, ah);
    }
  }
}

function drawVectorscope(ctx: CanvasRenderingContext2D, sd: ScopeData, W: number, H: number) {
  const { data } = sd;
  const R = Math.max(10, Math.min(W, H) / 2 - 12);
  const cx = W / 2;
  const cy = H / 2;
  const G = 220;
  const half = G / 2;
  const cnt = new Uint32Array(G * G);
  const sr = new Float32Array(G * G);
  const sg = new Float32Array(G * G);
  const sb = new Float32Array(G * G);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const U = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const V = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const x = Math.round(half + U * 2 * (half - 1));
    const y = Math.round(half - V * 2 * (half - 1));
    if (x < 0 || y < 0 || x >= G || y >= G) continue;
    const k = y * G + x;
    cnt[k]++;
    sr[k] += r;
    sg[k] += g;
    sb[k] += b;
  }
  // graticule
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  // skin tone line (~123°)
  const sk = (123 * Math.PI) / 180;
  ctx.strokeStyle = 'rgba(255,190,140,0.35)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sk) * R, cy - Math.sin(sk) * R);
  ctx.stroke();
  ctx.setLineDash([]);
  // 75% targets
  const targets: [number, number, number, string][] = [
    [1, 0, 0, 'R'],
    [1, 0, 1, 'Mg'],
    [0, 0, 1, 'B'],
    [0, 1, 1, 'Cy'],
    [0, 1, 0, 'G'],
    [1, 1, 0, 'Yl'],
  ];
  ctx.font = MONO;
  for (const [r0, g0, b0, label] of targets) {
    const r = r0 * 0.75;
    const g = g0 * 0.75;
    const b = b0 * 0.75;
    const U = -0.168736 * r - 0.331264 * g + 0.5 * b;
    const V = 0.5 * r - 0.418688 * g - 0.081312 * b;
    const x = cx + U * 2 * R;
    const y = cy - V * 2 * R;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const lx = cx + U * 2 * R * 1.22;
    const ly = cy - V * 2 * R * 1.22;
    ctx.fillText(label, lx - 5, ly + 3);
  }
  // trace
  const total = data.length / 4;
  const norm = Math.log(1 + total * 0.004);
  const img = new ImageData(G, G);
  for (let k = 0; k < cnt.length; k++) {
    const c = cnt[k];
    if (!c) continue;
    const v = Math.min(1, 0.22 + Math.log(1 + c) / norm);
    let r = sr[k] / c;
    let g = sg[k] / c;
    let b = sb[k] / c;
    const mx = Math.max(r, g, b, 1e-3);
    r /= mx;
    g /= mx;
    b /= mx;
    const o = k * 4;
    img.data[o] = Math.round((0.5 + 0.5 * r) * 255);
    img.data[o + 1] = Math.round((0.5 + 0.5 * g) * 255);
    img.data[o + 2] = Math.round((0.5 + 0.5 * b) * 255);
    img.data[o + 3] = Math.round(v * 255);
  }
  blit(ctx, img, cx - R, cy - R, R * 2, R * 2);
}

function histogramBins(sd: ScopeData) {
  const { data } = sd;
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
    l[(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0]++;
  }
  return { r, g, b, l };
}

/** Normalized luma histogram for the curve editor background */
export function lumaHistogram(sd: ScopeData): Float32Array {
  const { l } = histogramBins(sd);
  let max = 1;
  for (let i = 2; i < 254; i++) max = Math.max(max, l[i]);
  const out = new Float32Array(256);
  for (let i = 0; i < 256; i++) out[i] = Math.min(1, Math.sqrt(l[i] / max));
  return out;
}

function drawHistogram(ctx: CanvasRenderingContext2D, sd: ScopeData, W: number, H: number) {
  const bins = histogramBins(sd);
  const x0 = 10;
  const y0 = 10;
  const w = W - 20;
  const h = H - 20;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 1; i < 4; i++) {
    const x = Math.round(x0 + (i / 4) * w) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + h);
    ctx.stroke();
  }
  let max = 1;
  for (const arr of [bins.r, bins.g, bins.b]) for (let i = 2; i < 254; i++) max = Math.max(max, arr[i]);
  const path = (arr: Uint32Array) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    for (let i = 0; i < 256; i++) ctx.lineTo(x0 + (i / 255) * w, y0 + h - Math.min(1, arr[i] / max) * h);
    ctx.lineTo(x0 + w, y0 + h);
    ctx.closePath();
  };
  ctx.globalCompositeOperation = 'lighter';
  const fills: [Uint32Array, string][] = [
    [bins.r, 'rgba(255,64,64,0.55)'],
    [bins.g, 'rgba(64,220,100,0.5)'],
    [bins.b, 'rgba(72,128,255,0.6)'],
  ];
  for (const [arr, col] of fills) {
    path(arr);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  path(bins.l);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('0', x0, H - 2);
  ctx.fillText('255', x0 + w - 18, H - 2);
}

export function drawScope(ctx: CanvasRenderingContext2D, type: ScopeType, sd: ScopeData | null, W: number, H: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, W, H);
  if (!sd || W < 20 || H < 20) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No signal', W / 2, H / 2);
    ctx.textAlign = 'left';
    return;
  }
  if (type === 'histogram') drawHistogram(ctx, sd, W, H);
  else if (type === 'vectorscope') drawVectorscope(ctx, sd, W, H);
  else drawWaveform(ctx, sd, W, H, type === 'parade');
}
