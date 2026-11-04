/* ------------------------------------------------------------------
   LUMEN Grade — grading data model
------------------------------------------------------------------ */

export type Wheel = { x: number; y: number; master: number };
export type Pt = { x: number; y: number };

export type Curves = {
  master: Pt[];
  red: Pt[];
  green: Pt[];
  blue: Pt[];
};

export type Adjustments = {
  // primary
  exposure: number; // EV  -2 .. 2
  contrast: number; // -1 .. 1
  pivot: number; // 0 .. 1
  highlights: number; // -1 .. 1
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number; // -1 .. 1
  tint: number; // -1 .. 1
  vibrance: number; // -1 .. 1
  saturation: number; // 0 .. 2
  // wheels
  lift: Wheel;
  gamma: Wheel;
  gain: Wheel;
  offset: Wheel;
  // curves
  curves: Curves;
  // split tone
  shadowHue: number; // 0..360
  shadowAmt: number; // 0..1
  highHue: number;
  highAmt: number;
  // fx
  sharpen: number; // -1 .. 1
  blur: number; // 0 .. 1
  bloom: number; // 0 .. 1
  bloomThreshold: number; // 0 .. 1
  vignette: number; // 0 .. 1
  vignetteSoft: number; // 0.05 .. 1
  grain: number; // 0 .. 1
  chroma: number; // 0 .. 1
  intensity: number; // 0 .. 1 (grade blend)
};

export type NodeKind = "primary" | "wheels" | "curves" | "split" | "fx";

export const NODES: { id: NodeKind; label: string; code: string }[] = [
  { id: "primary", label: "Primary", code: "01" },
  { id: "wheels", label: "Wheels", code: "02" },
  { id: "curves", label: "Curves", code: "03" },
  { id: "split", label: "Split Tone", code: "04" },
  { id: "fx", label: "FX / Finish", code: "05" },
];

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const EPS = 1e-9;
export const near = (a: number, b: number) => Math.abs(a - b) < EPS;

export function defaultAdjustments(): Adjustments {
  return {
    exposure: 0,
    contrast: 0,
    pivot: 0.5,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 1,
    lift: { x: 0, y: 0, master: 0 },
    gamma: { x: 0, y: 0, master: 0 },
    gain: { x: 0, y: 0, master: 0 },
    offset: { x: 0, y: 0, master: 0 },
    curves: {
      master: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      red: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      green: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      blue: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    shadowHue: 205,
    shadowAmt: 0,
    highHue: 40,
    highAmt: 0,
    sharpen: 0,
    blur: 0,
    bloom: 0,
    bloomThreshold: 0.72,
    vignette: 0,
    vignetteSoft: 0.55,
    grain: 0,
    chroma: 0,
    intensity: 1,
  };
}

/* ---------------- color helpers ---------------- */

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * Wheel x/y → signed chroma offset only (master is added separately, see addMaster).
 * Neutral (no drag) always returns 0,0,0.
 */
export function wheelToRgb(w: Wheel, strength = 1): [number, number, number] {
  const rad = Math.min(1, Math.hypot(w.x, w.y));
  if (rad < 1e-4) return [0, 0, 0];
  const hue = (Math.atan2(-w.y, w.x) * 180) / Math.PI;
  const [r, g, b] = hsvToRgb(hue, 1, 1);
  const l = (r + g + b) / 3;
  const k = rad * strength;
  return [(r - l) * 2 * k, (g - l) * 2 * k, (b - l) * 2 * k];
}

/** full wheel contribution including the master slider */
export function wheelFull(w: Wheel, strength = 1): [number, number, number] {
  return addMaster(wheelToRgb(w, strength), w.master * strength);
}

export function addMaster(v: [number, number, number], m: number): [number, number, number] {
  return [v[0] + m, v[1] + m, v[2] + m];
}

/** temperature / tint → per-channel multiplier */
export function whiteBalance(temp: number, tint: number): [number, number, number] {
  const t = clamp(temp, -1, 1);
  const g = clamp(tint, -1, 1);
  return [1 + t * 0.28, 1 - Math.abs(t) * 0.06 - g * 0.16, 1 - t * 0.28 + g * 0.16];
}

/* ---------------- node bypass ---------------- */

export type NodeState = Record<NodeKind, boolean>;

export const allNodesOn = (): NodeState => ({
  primary: true,
  wheels: true,
  curves: true,
  split: true,
  fx: true,
});

const W0: Wheel = { x: 0, y: 0, master: 0 };
const LIN: Pt[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

/** produces the effective adjustments after node bypass flags */
export function effectiveAdjustments(a: Adjustments, nodes: NodeState): Adjustments {
  const out: Adjustments = {
    ...a,
    curves: { master: LIN, red: LIN, green: LIN, blue: LIN },
  };
  if (!nodes.primary) {
    out.exposure = 0;
    out.contrast = 0;
    out.pivot = 0.5;
    out.highlights = 0;
    out.shadows = 0;
    out.whites = 0;
    out.blacks = 0;
    out.temperature = 0;
    out.tint = 0;
    out.vibrance = 0;
    out.saturation = 1;
  }
  if (!nodes.wheels) {
    out.lift = W0;
    out.gamma = W0;
    out.gain = W0;
    out.offset = W0;
  }
  if (nodes.curves) out.curves = a.curves;
  if (!nodes.split) {
    out.shadowAmt = 0;
    out.highAmt = 0;
  }
  if (!nodes.fx) {
    out.sharpen = 0;
    out.blur = 0;
    out.bloom = 0;
    out.vignette = 0;
    out.grain = 0;
    out.chroma = 0;
  }
  return out;
}

export function isNodeDirty(a: Adjustments, kind: NodeKind): boolean {
  const d = defaultAdjustments();
  const w = (x: Wheel) => x.x !== 0 || x.y !== 0 || x.master !== 0;
  switch (kind) {
    case "primary":
      return (
        a.exposure !== d.exposure ||
        a.contrast !== d.contrast ||
        a.highlights !== 0 ||
        a.shadows !== 0 ||
        a.whites !== 0 ||
        a.blacks !== 0 ||
        a.temperature !== 0 ||
        a.tint !== 0 ||
        a.vibrance !== 0 ||
        a.saturation !== 1
      );
    case "wheels":
      return w(a.lift) || w(a.gamma) || w(a.gain) || w(a.offset);
    case "curves":
      return (
        a.curves.master.length > 2 ||
        a.curves.red.length > 2 ||
        a.curves.green.length > 2 ||
        a.curves.blue.length > 2 ||
        !near(a.curves.master[0].y, 0) ||
        !near(a.curves.master[a.curves.master.length - 1].y, 1)
      );
    case "split":
      return a.shadowAmt !== 0 || a.highAmt !== 0;
    case "fx":
      return (
        a.sharpen !== 0 ||
        a.blur !== 0 ||
        a.bloom !== 0 ||
        a.vignette !== 0 ||
        a.grain !== 0 ||
        a.chroma !== 0 ||
        a.intensity !== 1
      );
  }
}

/* ---------------- looks / presets ---------------- */

export type Look = {
  id: string;
  name: string;
  family: string;
  swatch: [string, string];
  patch: Partial<Adjustments>;
};

export const LOOKS: Look[] = [
  {
    id: "neutral",
    name: "Neutral / Reset",
    family: "Utility",
    swatch: ["#8d97a5", "#dfe4ea"],
    patch: {},
  },
  {
    id: "teal-orange",
    name: "Teal & Orange",
    family: "Blockbuster",
    swatch: ["#1f7d8c", "#f0a13c"],
    patch: {
      temperature: 0.14,
      contrast: 0.18,
      saturation: 1.12,
      vibrance: 0.22,
      shadows: -0.08,
      highlights: 0.06,
      lift: { x: -0.42, y: 0.16, master: -0.02 },
      gain: { x: 0.3, y: -0.05, master: 0.03 },
      shadowHue: 192,
      shadowAmt: 0.3,
      highHue: 34,
      highAmt: 0.26,
      vignette: 0.22,
    },
  },
  {
    id: "bleach",
    name: "Bleach Bypass",
    family: "Film",
    swatch: ["#6b7280", "#e5e7eb"],
    patch: {
      contrast: 0.42,
      saturation: 0.52,
      exposure: 0.08,
      blacks: 0.1,
      highlights: -0.14,
      sharpen: 0.35,
      grain: 0.18,
      vignette: 0.18,
    },
  },
  {
    id: "kodak-warm",
    name: "Print 2383",
    family: "Film",
    swatch: ["#c98a3c", "#f2d9a7"],
    patch: {
      temperature: 0.2,
      tint: 0.05,
      contrast: 0.12,
      saturation: 1.08,
      lift: { x: 0.08, y: 0.12, master: 0.03 },
      gamma: { x: 0.14, y: -0.02, master: 0.01 },
      bloom: 0.16,
      grain: 0.24,
      vignette: 0.2,
      curves: {
        master: [
          { x: 0, y: 0.03 },
          { x: 0.28, y: 0.24 },
          { x: 0.72, y: 0.78 },
          { x: 1, y: 0.97 },
        ],
        red: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        green: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        blue: [
          { x: 0, y: 0.015 },
          { x: 1, y: 0.965 },
        ],
      },
    },
  },
  {
    id: "noir",
    name: "Noir Contrast",
    family: "Mono",
    swatch: ["#111318", "#e8e8e8"],
    patch: {
      saturation: 0,
      contrast: 0.5,
      exposure: -0.05,
      blacks: 0.16,
      highlights: -0.08,
      sharpen: 0.3,
      grain: 0.3,
      vignette: 0.42,
      curves: {
        master: [
          { x: 0, y: 0 },
          { x: 0.35, y: 0.2 },
          { x: 0.68, y: 0.86 },
          { x: 1, y: 1 },
        ],
        red: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        green: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        blue: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    },
  },
  {
    id: "faded",
    name: "Faded Matte",
    family: "Editorial",
    swatch: ["#9fb0a8", "#e6ded2"],
    patch: {
      contrast: -0.16,
      blacks: -0.22,
      saturation: 0.86,
      temperature: 0.06,
      lift: { x: 0, y: 0.1, master: 0.04 },
      grain: 0.14,
      bloom: 0.1,
      curves: {
        master: [
          { x: 0, y: 0.09 },
          { x: 0.5, y: 0.52 },
          { x: 1, y: 0.94 },
        ],
        red: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        green: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        blue: [
          { x: 0, y: 0.02 },
          { x: 1, y: 1 },
        ],
      },
    },
  },
  {
    id: "neon",
    name: "Neon Rain",
    family: "Cyber",
    swatch: ["#ec5f9e", "#4f9cf9"],
    patch: {
      contrast: 0.28,
      saturation: 1.32,
      vibrance: 0.3,
      temperature: -0.18,
      tint: 0.14,
      lift: { x: -0.3, y: 0.28, master: -0.03 },
      gain: { x: 0.22, y: -0.2, master: 0.04 },
      shadowHue: 268,
      shadowAmt: 0.4,
      highHue: 186,
      highAmt: 0.34,
      bloom: 0.42,
      bloomThreshold: 0.6,
      chroma: 0.35,
      grain: 0.12,
      vignette: 0.34,
    },
  },
  {
    id: "golden",
    name: "Golden Hour",
    family: "Natural",
    swatch: ["#f0a13c", "#ffe6b0"],
    patch: {
      temperature: 0.3,
      tint: 0.06,
      exposure: 0.12,
      contrast: 0.1,
      highlights: -0.16,
      shadows: 0.14,
      vibrance: 0.24,
      bloom: 0.26,
      bloomThreshold: 0.66,
      highHue: 42,
      highAmt: 0.3,
      vignette: 0.16,
    },
  },
  {
    id: "arctic",
    name: "Arctic Clean",
    family: "Natural",
    swatch: ["#7fb2d9", "#eaf4ff"],
    patch: {
      temperature: -0.24,
      tint: -0.06,
      contrast: 0.14,
      highlights: -0.1,
      saturation: 0.92,
      vibrance: 0.14,
      gain: { x: -0.16, y: 0.06, master: 0.02 },
      sharpen: 0.22,
      vignette: 0.12,
    },
  },
  {
    id: "sepia",
    name: "Archive Sepia",
    family: "Mono",
    swatch: ["#7a5c36", "#e8d9bd"],
    patch: {
      saturation: 0.28,
      temperature: 0.34,
      contrast: 0.16,
      shadowHue: 30,
      shadowAmt: 0.42,
      highHue: 46,
      highAmt: 0.4,
      grain: 0.34,
      vignette: 0.3,
    },
  },
];

export function applyLook(look: Look): Adjustments {
  const base = defaultAdjustments();
  return { ...base, ...look.patch, curves: look.patch.curves ?? base.curves };
}

/** merge a look on top of an existing grade (used for "stack look") */
export function mergeLook(a: Adjustments, look: Look): Adjustments {
  return { ...a, ...look.patch, curves: look.patch.curves ?? a.curves };
}

/* ---------------- misc ---------------- */

export function fmt(v: number, digits = 2) {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}

export function adjustmentsEqual(a: Adjustments, b: Adjustments) {
  return JSON.stringify(a) === JSON.stringify(b);
}
