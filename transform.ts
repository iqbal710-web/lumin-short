import type { CropRect, Transform } from '../types';

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export const ASPECTS: { id: string; label: string; ratio: number }[] = [
  { id: 'free', label: 'Free', ratio: 0 },
  { id: 'original', label: 'Original', ratio: -1 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '2.39:1', label: '2.39 Scope', ratio: 2.39 },
];

const norm4 = (r: number) => ((r % 4) + 4) % 4;

export function orientedSize(w: number, h: number, rot90: number): [number, number] {
  return norm4(rot90) % 2 === 1 ? [h, w] : [w, h];
}

/** Scale needed so a rotated frame still covers the whole output (no empty corners) */
export function coverScale(W: number, H: number, angleDeg: number) {
  const t = (Math.abs(angleDeg) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return Math.max(c + (H / W) * s, (W / H) * s + c);
}

export function outputSize(srcW: number, srcH: number, t: Transform, ignoreCrop = false): [number, number] {
  const [W, H] = orientedSize(srcW, srcH, t.rot90);
  const crop = ignoreCrop ? FULL_CROP : t.crop;
  return [Math.max(1, Math.round(W * crop.w)), Math.max(1, Math.round(H * crop.h))];
}

type Aff = [number, number, number, number, number, number];
const mul = (A: Aff, B: Aff): Aff => [
  A[0] * B[0] + A[1] * B[3],
  A[0] * B[1] + A[1] * B[4],
  A[0] * B[2] + A[1] * B[5] + A[2],
  A[3] * B[0] + A[4] * B[3],
  A[3] * B[1] + A[4] * B[4],
  A[3] * B[2] + A[4] * B[5] + A[5],
];

/** Column-major mat3 mapping output uv (0..1, top-left origin) to source texture uv */
export function transformMatrix(srcW: number, srcH: number, t: Transform, ignoreCrop = false): Float32Array {
  const [W, H] = orientedSize(srcW, srcH, t.rot90);
  const crop = ignoreCrop ? FULL_CROP : t.crop;
  const th = (t.angle * Math.PI) / 180;
  const s = coverScale(W, H, t.angle);
  let M: Aff = [crop.w, 0, crop.x, 0, crop.h, crop.y];
  M = mul([W, 0, -0.5 * W, 0, H, -0.5 * H], M);
  const c = Math.cos(-th) / s;
  const sn = Math.sin(-th) / s;
  M = mul([c, -sn, 0, sn, c, 0], M);
  M = mul([1 / W, 0, 0.5, 0, 1 / H, 0.5], M);
  if (t.flipH) M = mul([-1, 0, 1, 0, 1, 0], M);
  if (t.flipV) M = mul([1, 0, 0, 0, -1, 1], M);
  const k = norm4(t.rot90);
  if (k === 1) M = mul([0, 1, 0, -1, 0, 1], M);
  else if (k === 2) M = mul([-1, 0, 1, 0, -1, 1], M);
  else if (k === 3) M = mul([0, -1, 1, 1, 0, 0], M);
  return new Float32Array([M[0], M[3], 0, M[1], M[4], 0, M[2], M[5], 1]);
}

export function aspectValue(id: string, W: number, H: number): number {
  if (id === 'free') return 0;
  if (id === 'original') return W / H;
  return ASPECTS.find((a) => a.id === id)?.ratio ?? 0;
}

/** Largest centered crop with the given pixel aspect ratio */
export function cropForAspect(ratio: number, W: number, H: number): CropRect {
  if (!ratio || ratio < 0) return { ...FULL_CROP };
  let w = 1;
  let h = W / ratio / H;
  if (h > 1) {
    h = 1;
    w = (H * ratio) / W;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
