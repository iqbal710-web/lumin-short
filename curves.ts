import type { Curves, Pt } from "./types";

/**
 * Monotone cubic (Fritsch–Carlson) interpolation through control points.
 * Used to build a 256 entry lookup table for the GPU.
 */
export function evaluateCurve(points: Pt[], x: number): number {
  const pts = points.length >= 2 ? points : [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1].x) i++;
  const p0 = pts[i];
  const p1 = pts[i + 1];
  const h = p1.x - p0.x || 1e-6;
  const t = (x - p0.x) / h;

  // tangents (clamped, monotone-ish)
  const m0 = i === 0 ? (p1.y - p0.y) / h : slopeAt(pts, i);
  const m1 = i === pts.length - 2 ? (p1.y - p0.y) / h : slopeAt(pts, i + 1);

  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * p0.y + h10 * h * m0 + h01 * p1.y + h11 * h * m1;
}

function slopeAt(pts: Pt[], i: number): number {
  const prev = pts[i - 1];
  const cur = pts[i];
  const next = pts[i + 1];
  const d1 = (cur.y - prev.y) / (cur.x - prev.x || 1e-6);
  const d2 = (next.y - cur.y) / (next.x - cur.x || 1e-6);
  if (d1 * d2 <= 0) return 0;
  return (d1 + d2) / 2;
}

/** Build a 256x4 RGBA LUT (rows: master, red, green, blue) */
export function buildLut(curves: Curves): Uint8Array {
  const data = new Uint8Array(256 * 4);
  const chans: Pt[][] = [curves.master, curves.red, curves.green, curves.blue];
  for (let row = 0; row < 4; row++) {
    const pts = chans[row];
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      const y = Math.min(1, Math.max(0, evaluateCurve(pts, x)));
      data[row * 256 + i] = Math.round(y * 255);
    }
  }
  return data;
}

export function sampleCurvePath(points: Pt[], steps = 96): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    out.push({ x, y: Math.min(1, Math.max(0, evaluateCurve(points, x))) });
  }
  return out;
}

export function sortedWith(points: Pt[], p: Pt, index: number): Pt[] {
  const next = points.slice();
  next[index] = p;
  return next.sort((a, b) => a.x - b.x);
}
