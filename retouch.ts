import type { RetouchOp } from '../types';

export type Rect = [number, number, number, number]; // x0, y0, x1, y1 (exclusive)

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

const clampI = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function px(work: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  return (clampI(Math.round(y), 0, h - 1) * w + clampI(Math.round(x), 0, w - 1)) * 4;
}

/** Looks for a nearby patch whose surroundings match the surroundings of the spot (texture + color) */
function autoSource(work: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number): [number, number] | null {
  const ring = r * 1.3;
  const N = 16;
  let best: [number, number] | null = null;
  let bestScore = Infinity;
  for (const dm of [2.4, 3.4]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const ox = Math.cos(ang) * r * dm;
      const oy = Math.sin(ang) * r * dm;
      const tx = cx + ox;
      const ty = cy + oy;
      if (tx - ring < 0 || ty - ring < 0 || tx + ring > w - 1 || ty + ring > h - 1) continue;
      let score = 0;
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2;
        const ax = Math.cos(a) * ring;
        const ay = Math.sin(a) * ring;
        const i = px(work, w, h, cx + ax, cy + ay);
        const m = px(work, w, h, tx + ax, ty + ay);
        score += Math.abs(work[i] - work[m]) + Math.abs(work[i + 1] - work[m + 1]) + Math.abs(work[i + 2] - work[m + 2]);
      }
      if (score < bestScore) {
        bestScore = score;
        best = [ox, oy];
      }
    }
  }
  return best;
}

function stamp(work: Uint8ClampedArray, w: number, h: number, op: RetouchOp, cx: number, cy: number, r: number): Rect | null {
  let sx = op.dx * w;
  let sy = op.dy * h;
  if (op.tool === 'spot' || op.tool === 'blemish' || op.tool === 'hair') {
    const a = autoSource(work, w, h, cx, cy, r);
    if (!a) return null;
    sx = a[0];
    sy = a[1];
  }
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  if (x1 < x0 || y1 < y0) return null;

  // healing: shift the copied pixels so their edge color matches the area around the brush
  let d0 = 0;
  let d1 = 0;
  let d2 = 0;
  if (op.tool !== 'clone') {
    const N = 20;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const rx = cx + Math.cos(a) * r * 0.92;
      const ry = cy + Math.sin(a) * r * 0.92;
      const i = px(work, w, h, rx, ry);
      const j = px(work, w, h, rx + sx, ry + sy);
      d0 += work[i] - work[j];
      d1 += work[i + 1] - work[j + 1];
      d2 += work[i + 2] - work[j + 2];
    }
    d0 /= N;
    d1 /= N;
    d2 /= N;
  }

  const hard = op.hardness;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const a = (d <= hard ? 1 : 1 - (d - hard) / Math.max(1e-3, 1 - hard)) * op.opacity;
      const i = (y * w + x) * 4;
      const j = px(work, w, h, x + sx, y + sy);
      work[i] += (work[j] + d0 - work[i]) * a;
      work[i + 1] += (work[j + 1] + d1 - work[i + 1]) * a;
      work[i + 2] += (work[j + 2] + d2 - work[i + 2]) * a;
    }
  }
  return [x0, y0, x1 + 1, y1 + 1];
}

/** Applies the points of a stroke from index `from` on. Returns the changed rectangle (or null) */
export function applyRetouchOp(work: Uint8ClampedArray, w: number, h: number, op: RetouchOp, from: number): Rect | null {
  const r = Math.max(2, op.r * Math.max(w, h));
  const n = op.pts.length / 2;
  const spacing = Math.max(1, r * 0.3);
  let dirty: Rect | null = null;
  if (from === 0 && n > 0) dirty = unionRect(dirty, stamp(work, w, h, op, op.pts[0] * w, op.pts[1] * h, r));
  for (let i = Math.max(0, from - 1); i < n - 1; i++) {
    const x0 = op.pts[i * 2] * w;
    const y0 = op.pts[i * 2 + 1] * h;
    const x1 = op.pts[i * 2 + 2] * w;
    const y1 = op.pts[i * 2 + 3] * h;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / spacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      dirty = unionRect(dirty, stamp(work, w, h, op, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r));
    }
  }
  return dirty;
}
