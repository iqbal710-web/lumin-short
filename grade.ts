import type {
  CurvePoint,
  Curves,
  EditState,
  Finishing,
  Grade,
  GradeNode,
  HueCurves,
  Transform,
  Wheel,
  WheelKey,
} from '../types';

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

let counter = 0;
export const uid = () =>
  Math.random().toString(36).slice(2, 8) + (counter++).toString(36) + Date.now().toString(36).slice(-3);

export const identityCurve = (): CurvePoint[] => [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];
export const flatCurve = (): CurvePoint[] => [
  { x: 0, y: 0.5 },
  { x: 1, y: 0.5 },
];
export const zeroWheel = (): Wheel => ({ x: 0, y: 0, m: 0 });

export function defaultGrade(): Grade {
  return {
    lift: zeroWheel(),
    gamma: zeroWheel(),
    gain: zeroWheel(),
    offset: zeroWheel(),
    exposure: 0,
    contrast: 0,
    pivot: 0.435,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    saturation: 0,
    vibrance: 0,
    hue: 0,
    midDetail: 0,
    sharpen: 0,
    blur: 0,
    fade: 0,
    dehaze: 0,
    smooth: 0,
    texKeep: 35,
    hslMix: new Array(24).fill(0),
    splitShadowHue: 200,
    splitShadowSat: 0,
    splitHighlightHue: 35,
    splitHighlightSat: 0,
    splitBalance: 0,
    curves: { master: identityCurve(), r: identityCurve(), g: identityCurve(), b: identityCurve() },
    hueCurves: { hueHue: flatCurve(), hueSat: flatCurve(), hueLum: flatCurve() },
    lutId: null,
    lutAmount: 100,
    mix: 100,
  };
}

export const DEFAULT_GRADE = defaultGrade();

export function defaultTransform(): Transform {
  return { rot90: 0, flipH: false, flipV: false, angle: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: 'free' };
}

export function defaultFinishing(): Finishing {
  return { vignette: 0, vignetteMid: 50, vignetteRound: 50, vignetteFeather: 50, grain: 0, grainSize: 25, halation: 0, bloom: 0, lightLeak: 0, leakHue: 25, chromatic: 0 };
}

/** Fill in any missing fields (used when loading grades / looks) */
export function normalizeGrade(g: Partial<Grade>): Grade {
  const d = defaultGrade();
  return {
    ...d,
    ...g,
    curves: { ...d.curves, ...(g.curves ?? {}) },
    hueCurves: { ...d.hueCurves, ...(g.hueCurves ?? {}) },
  };
}

export function makeNode(label: string, grade?: Partial<Grade>): GradeNode {
  return { id: uid(), label, enabled: true, grade: normalizeGrade(grade ? structuredClone(grade) : {}) };
}

export function defaultEdit(): EditState {
  return { nodes: [makeNode('Primary')], transform: defaultTransform(), finishing: defaultFinishing() };
}

export function cloneNodes(nodes: GradeNode[]): GradeNode[] {
  return nodes.map((n) => ({ ...structuredClone(n), id: uid(), grade: normalizeGrade(structuredClone(n.grade)) }));
}

/* ------------------------------------------------------------------ */
/* Curves                                                              */
/* ------------------------------------------------------------------ */

const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
export const isIdentityCurve = (p: CurvePoint[]) =>
  p.length === 2 && near(p[0].x, 0) && near(p[0].y, 0) && near(p[1].x, 1) && near(p[1].y, 1);
export const isFlatCurve = (p: CurvePoint[]) => p.every((q) => Math.abs(q.y - 0.5) < 1e-3);
export const curvesActive = (c: Curves) =>
  !(isIdentityCurve(c.master) && isIdentityCurve(c.r) && isIdentityCurve(c.g) && isIdentityCurve(c.b));
export const hueCurvesActive = (h: HueCurves) =>
  !(isFlatCurve(h.hueHue) && isFlatCurve(h.hueSat) && isFlatCurve(h.hueLum));

/** Monotone cubic (Fritsch–Carlson) interpolation sampled into a LUT */
export function evalCurve(points: CurvePoint[], samples = 256): Float32Array {
  const out = new Float32Array(samples);
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n === 0) {
    for (let i = 0; i < samples; i++) out[i] = i / (samples - 1);
    return out;
  }
  if (n === 1) {
    out.fill(clamp(pts[0].y));
    return out;
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d.push(dx > 1e-9 ? (ys[i + 1] - ys[i]) / dx : 0);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let seg = 0;
  for (let k = 0; k < samples; k++) {
    const x = k / (samples - 1);
    let y: number;
    if (x <= xs[0]) y = ys[0];
    else if (x >= xs[n - 1]) y = ys[n - 1];
    else {
      while (seg < n - 2 && x > xs[seg + 1]) seg++;
      const h = xs[seg + 1] - xs[seg];
      const t = h > 1e-9 ? (x - xs[seg]) / h : 0;
      const t2 = t * t;
      const t3 = t2 * t;
      y =
        (2 * t3 - 3 * t2 + 1) * ys[seg] +
        (t3 - 2 * t2 + t) * h * m[seg] +
        (-2 * t3 + 3 * t2) * ys[seg + 1] +
        (t3 - t2) * h * m[seg + 1];
    }
    out[k] = clamp(y);
  }
  return out;
}

const lutCache = new WeakMap<CurvePoint[], Float32Array>();
export function curveLut(points: CurvePoint[]): Float32Array {
  let v = lutCache.get(points);
  if (!v) {
    v = evalCurve(points, 256);
    lutCache.set(points, v);
  }
  return v;
}

export function curvesTexture(c: Curves): Float32Array {
  const r = curveLut(c.r);
  const g = curveLut(c.g);
  const b = curveLut(c.b);
  const m = curveLut(c.master);
  const out = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4] = r[i];
    out[i * 4 + 1] = g[i];
    out[i * 4 + 2] = b[i];
    out[i * 4 + 3] = m[i];
  }
  return out;
}

export function hueCurvesTexture(h: HueCurves): Float32Array {
  const a = curveLut(h.hueHue);
  const b = curveLut(h.hueSat);
  const c = curveLut(h.hueLum);
  const out = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4] = a[i];
    out[i * 4 + 1] = b[i];
    out[i * 4 + 2] = c[i];
    out[i * 4 + 3] = 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Color helpers                                                       */
/* ------------------------------------------------------------------ */

/** Zero-luma RGB offset for a chroma vector (Cb=u, Cr=v), matches the vectorscope axes */
export function chromaToRgb(u: number, v: number): [number, number, number] {
  return [1.402 * v, -0.344136 * u - 0.714136 * v, 1.772 * u];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

/** A zero-luma tint vector for a hue in degrees */
export function hueChroma(hueDeg: number, amount: number): number[] {
  const [r, g, b] = hsvToRgb((((hueDeg % 360) + 360) % 360) / 360, 1, 1);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(r - l) * amount, (g - l) * amount, (b - l) * amount];
}

export const WHEEL_SCALE: Record<WheelKey, { chroma: number; master: number }> = {
  lift: { chroma: 0.35, master: 0.5 },
  gamma: { chroma: 0.6, master: 1 },
  gain: { chroma: 0.8, master: 1 },
  offset: { chroma: 0.25, master: 0.5 },
};

export function wheelRgb(k: WheelKey, w: Wheel): number[] {
  const s = WHEEL_SCALE[k];
  const [r, g, b] = chromaToRgb(w.x * 0.5, w.y * 0.5);
  return [r * s.chroma + w.m * s.master, g * s.chroma + w.m * s.master, b * s.chroma + w.m * s.master];
}

/** Y R G B readout under each wheel (Resolve style) */
export function wheelReadout(k: WheelKey, w: Wheel): number[] {
  const rgb = wheelRgb(k, w);
  const vals = k === 'gain' ? rgb.map((v) => Math.pow(2, v)) : rgb;
  const y = 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  return [y, vals[0], vals[1], vals[2]];
}

/** Hue ring for the color wheels — angles match the vectorscope exactly */
export function wheelRingGradient(): string {
  const stops: string[] = [];
  for (let b = 0; b <= 360; b += 10) {
    const a = ((90 - b) * Math.PI) / 180;
    const rgb = chromaToRgb(Math.cos(a) * 0.5, Math.sin(a) * 0.5).map((v) => v + 0.5);
    const mn = Math.min(...rgb);
    const mx = Math.max(...rgb);
    const d = mx - mn || 1;
    const to = (v: number) => Math.round((0.12 + 0.88 * ((v - mn) / d)) * 255);
    stops.push(`rgb(${to(rgb[0])},${to(rgb[1])},${to(rgb[2])}) ${b}deg`);
  }
  return `conic-gradient(from 0deg, ${stops.join(',')})`;
}

export function wbGains(temp: number, tint: number): number[] {
  const t = temp / 100;
  const ti = tint / 100;
  const r = (1 + t * 0.32) * (1 + ti * 0.1);
  const g = 1 - ti * 0.24;
  const b = (1 - t * 0.32) * (1 + ti * 0.1);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / l, g / l, b / l];
}

export interface GradeUniforms {
  wb: number[];
  exposure: number;
  lift: number[];
  gammaInv: number[];
  gain: number[];
  offset: number[];
  contrast: number;
  pivot: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  saturation: number;
  vibrance: number;
  hue: number;
  midDetail: number;
  sharpen: number;
  blur: number;
  fade: number;
  splitShadow: number[];
  splitHighlight: number[];
  splitBalance: number;
  curvesOn: number;
  hueCurvesOn: number;
  dehaze: number;
  smooth: number;
  texKeep: number;
  hsl: number[];
  hslOn: number;
  mix: number;
}

export function gradeUniforms(g: Grade): GradeUniforms {
  return {
    wb: wbGains(g.temperature, g.tint),
    exposure: Math.pow(2, g.exposure),
    lift: wheelRgb('lift', g.lift),
    gammaInv: wheelRgb('gamma', g.gamma).map((v) => Math.pow(2, -v)),
    gain: wheelRgb('gain', g.gain).map((v) => Math.pow(2, v)),
    offset: wheelRgb('offset', g.offset),
    contrast: g.contrast >= 0 ? 1 + g.contrast / 100 : 1 + (g.contrast / 100) * 0.9,
    pivot: g.pivot,
    highlights: g.highlights / 100,
    shadows: g.shadows / 100,
    whites: g.whites / 100,
    blacks: g.blacks / 100,
    saturation: 1 + g.saturation / 100,
    vibrance: g.vibrance / 100,
    hue: (g.hue * Math.PI) / 180,
    midDetail: g.midDetail / 100,
    sharpen: g.sharpen / 100,
    blur: g.blur / 100,
    fade: g.fade / 100,
    splitShadow: hueChroma(g.splitShadowHue, (g.splitShadowSat / 100) * 0.3),
    splitHighlight: hueChroma(g.splitHighlightHue, (g.splitHighlightSat / 100) * 0.24),
    splitBalance: g.splitBalance / 100,
    curvesOn: curvesActive(g.curves) ? 1 : 0,
    hueCurvesOn: hueCurvesActive(g.hueCurves) ? 1 : 0,
    dehaze: (g.dehaze ?? 0) / 100,
    smooth: (g.smooth ?? 0) / 100,
    texKeep: (g.texKeep ?? 35) / 100,
    hsl: Array.from({ length: 24 }, (_, i) => (g.hslMix?.[i] ?? 0) / 100),
    hslOn: (g.hslMix ?? []).some((v) => v !== 0) ? 1 : 0,
    mix: g.mix / 100,
  };
}

export function gradeFlags(g: Grade) {
  const wheels = (['lift', 'gamma', 'gain', 'offset'] as const).some(
    (k) => g[k].x !== 0 || g[k].y !== 0 || g[k].m !== 0,
  );
  const primaries =
    g.exposure !== 0 ||
    g.contrast !== 0 ||
    Math.abs(g.pivot - 0.435) > 1e-6 ||
    g.highlights !== 0 ||
    g.shadows !== 0 ||
    g.whites !== 0 ||
    g.blacks !== 0 ||
    g.temperature !== 0 ||
    g.tint !== 0 ||
    g.saturation !== 0 ||
    g.vibrance !== 0 ||
    g.hue !== 0 ||
    g.fade !== 0 ||
    (g.dehaze ?? 0) !== 0 ||
    (g.hslMix ?? []).some((v) => v !== 0) ||
    g.splitShadowSat !== 0 ||
    g.splitHighlightSat !== 0;
  const curves = curvesActive(g.curves);
  const hue = hueCurvesActive(g.hueCurves);
  const fx = g.blur !== 0 || g.sharpen !== 0 || g.midDetail !== 0 || (g.smooth ?? 0) !== 0;
  const lut = !!g.lutId;
  return { wheels, primaries, curves, hue, fx, lut, any: wheels || primaries || curves || hue || fx || lut || g.mix !== 100 };
}

export function editHasChanges(e: EditState): boolean {
  const t = e.transform;
  const f = e.finishing;
  return (
    e.nodes.length > 1 ||
    e.nodes.some((n) => !n.enabled || gradeFlags(n.grade).any) ||
    t.rot90 % 4 !== 0 ||
    t.flipH ||
    t.flipV ||
    t.angle !== 0 ||
    t.crop.w < 0.999 ||
    t.crop.h < 0.999 ||
    f.vignette !== 0 ||
    f.grain !== 0 ||
    f.halation > 0 ||
    f.bloom > 0 ||
    f.lightLeak > 0 ||
    f.chromatic > 0
  );
}
