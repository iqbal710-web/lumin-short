export type CurvePoint = { x: number; y: number };
export type CurveKey = 'master' | 'r' | 'g' | 'b';
export type HueCurveKey = 'hueHue' | 'hueSat' | 'hueLum';
export type Curves = Record<CurveKey, CurvePoint[]>;
export type HueCurves = Record<HueCurveKey, CurvePoint[]>;

/** Color wheel value: x/y = color balance inside the unit disk, m = master (luminance) wheel */
export interface Wheel {
  x: number;
  y: number;
  m: number;
}
export type WheelKey = 'lift' | 'gamma' | 'gain' | 'offset';

/** Every correction a single node can hold (like a Resolve "Corrector" node) */
export interface Grade {
  lift: Wheel;
  gamma: Wheel;
  gain: Wheel;
  offset: Wheel;
  exposure: number; // -4..4 EV
  contrast: number; // -100..100
  pivot: number; // 0..1
  highlights: number; // -100..100
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number; // -100..100
  tint: number;
  saturation: number; // -100..100
  vibrance: number;
  hue: number; // -180..180 deg
  midDetail: number; // -100..100
  sharpen: number; // 0..100
  blur: number; // 0..100
  fade: number; // 0..100
  splitShadowHue: number; // 0..360
  splitShadowSat: number; // 0..100
  splitHighlightHue: number;
  splitHighlightSat: number;
  splitBalance: number; // -100..100
  curves: Curves;
  hueCurves: HueCurves;
  lutId: string | null;
  lutAmount: number; // 0..100
  mix: number; // 0..100 key output
}

export interface GradeNode {
  id: string;
  label: string;
  enabled: boolean;
  grade: Grade;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Transform {
  rot90: number;
  flipH: boolean;
  flipV: boolean;
  angle: number;
  crop: CropRect;
  aspect: string;
}

/** Global finishing applied after crop (output space) */
export interface Finishing {
  vignette: number; // -100..100
  vignetteMid: number; // 0..100
  vignetteRound: number; // 0..100
  vignetteFeather: number; // 0..100
  grain: number; // 0..100
  grainSize: number; // 1..100
  halation: number; // 0..100 red glow around highlights
  bloom: number; // 0..100 soft glow
  lightLeak: number; // 0..100
  leakHue: number; // 0..360
  chromatic: number; // 0..100 chromatic aberration
}

export interface EditState {
  nodes: GradeNode[];
  transform: Transform;
  finishing: Finishing;
}

export interface MediaItem {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes?: number;
  thumb: string;
  graded?: string;
  sample?: boolean;
}

export interface LutData {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
}

export interface Still {
  id: string;
  name: string;
  thumb: string;
  nodes: GradeNode[];
  finishing: Finishing;
  createdAt: number;
}

export interface ViewOptions {
  compare: 'off' | 'bypass' | 'split';
  split: number;
  clipping: boolean;
  cropMode: boolean;
  cinema: boolean;
}

export interface ScopeData {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface ExportSettings {
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number;
  scale: number;
  suffix: string;
}

export type ScopeType = 'waveform' | 'parade' | 'vectorscope' | 'histogram';
export type PaletteTab = 'wheels' | 'curves' | 'adjust' | 'effects' | 'transform' | 'looks' | 'nodes';
export type Page = 'media' | 'color' | 'deliver';
export type ModalId = 'shortcuts' | 'github' | 'about';
