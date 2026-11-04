import type { CurvePoint, Grade, Wheel } from '../types';
import { defaultFinishing, defaultTransform, makeNode } from './grade';
import type { EditState } from '../types';

export interface Look {
  id: string;
  name: string;
  category: 'Cinematic' | 'Film' | 'Stylized' | 'Retro' | 'Black & White';
  grade: Partial<Grade>;
}

/** Wheel pushed toward a vectorscope angle (deg). R≈109°, Yl≈171°, G≈232°, Cy≈289°, B≈351°, Mg≈52° */
const dir = (angle: number, amount: number, m = 0): Wheel => {
  const a = (angle * Math.PI) / 180;
  return { x: +(Math.cos(a) * amount).toFixed(4), y: +(Math.sin(a) * amount).toFixed(4), m };
};
const pts = (...v: number[]): CurvePoint[] => {
  const out: CurvePoint[] = [];
  for (let i = 0; i < v.length; i += 2) out.push({ x: v[i], y: v[i + 1] });
  return out;
};
const I = () => pts(0, 0, 1, 1);
const F = () => pts(0, 0.5, 1, 0.5);

export const LOOKS: Look[] = [
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    category: 'Cinematic',
    grade: { lift: dir(305, 0.45), gamma: dir(305, 0.1), gain: dir(140, 0.32), contrast: 14, saturation: 8, highlights: -10 },
  },
  {
    id: 'blockbuster',
    name: 'Blockbuster',
    category: 'Cinematic',
    grade: {
      lift: dir(300, 0.5, -0.04),
      gain: dir(150, 0.25, 0.04),
      contrast: 24,
      saturation: -6,
      midDetail: 15,
      curves: { master: pts(0, 0, 0.25, 0.2, 0.75, 0.82, 1, 1), r: I(), g: I(), b: I() },
    },
  },
  {
    id: 'bleach',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    grade: {
      saturation: -55,
      contrast: 36,
      midDetail: 25,
      highlights: -8,
      curves: { master: pts(0, 0, 0.3, 0.24, 0.7, 0.8, 1, 1), r: I(), g: I(), b: I() },
    },
  },
  {
    id: 'clean',
    name: 'Clean Commercial',
    category: 'Cinematic',
    grade: { vibrance: 22, contrast: 10, shadows: 14, highlights: -14, midDetail: 10, exposure: 0.1, gain: dir(150, 0.05) },
  },
  {
    id: 'print-2383',
    name: 'Film Print 2383',
    category: 'Film',
    grade: {
      temperature: 6,
      saturation: -6,
      contrast: 8,
      curves: {
        master: pts(0, 0.03, 0.22, 0.17, 0.7, 0.78, 1, 0.96),
        r: pts(0, 0, 0.5, 0.52, 1, 1),
        g: I(),
        b: pts(0, 0.05, 0.5, 0.48, 1, 0.95),
      },
    },
  },
  {
    id: 'kodachrome',
    name: 'Kodachrome',
    category: 'Film',
    grade: { saturation: 26, contrast: 18, vibrance: 14, temperature: 6, gain: dir(160, 0.12), lift: dir(351, 0.1) },
  },
  {
    id: 'portra',
    name: 'Portra Soft',
    category: 'Film',
    grade: {
      fade: 12,
      saturation: -10,
      vibrance: 10,
      temperature: 10,
      highlights: -15,
      shadows: 10,
      gain: dir(145, 0.12),
      curves: { master: pts(0, 0.04, 0.5, 0.52, 1, 0.97), r: I(), g: I(), b: I() },
    },
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    category: 'Stylized',
    grade: { temperature: 38, tint: 6, gain: dir(150, 0.15), highlights: -10, shadows: 8, vibrance: 18 },
  },
  {
    id: 'arctic',
    name: 'Arctic Blue',
    category: 'Stylized',
    grade: { temperature: -40, saturation: -15, gain: dir(300, 0.12), lift: dir(340, 0.15), contrast: 10, exposure: 0.1 },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'Stylized',
    grade: { lift: dir(351, 0.5), gain: dir(52, 0.4), tint: 15, saturation: 25, contrast: 18, hue: -6 },
  },
  {
    id: 'forest',
    name: 'Moody Forest',
    category: 'Stylized',
    grade: {
      exposure: -0.25,
      contrast: 12,
      lift: dir(289, 0.25),
      shadows: -10,
      saturation: -10,
      hueCurves: {
        hueHue: pts(0, 0.5, 0.2, 0.5, 0.33, 0.6, 0.45, 0.5, 1, 0.5),
        hueSat: pts(0, 0.5, 0.15, 0.5, 0.33, 0.32, 0.5, 0.5, 1, 0.5),
        hueLum: F(),
      },
    },
  },
  {
    id: 'night',
    name: 'Day for Night',
    category: 'Stylized',
    grade: { exposure: -1.5, temperature: -50, saturation: -45, contrast: 15, lift: dir(351, 0.3), gain: dir(330, 0.15) },
  },
  {
    id: 'vintage',
    name: 'Vintage Fade',
    category: 'Retro',
    grade: {
      fade: 35,
      temperature: 14,
      saturation: -22,
      contrast: -8,
      splitShadowHue: 190,
      splitShadowSat: 25,
      splitHighlightHue: 40,
      splitHighlightSat: 30,
    },
  },
  {
    id: 'cross',
    name: 'Cross Process',
    category: 'Retro',
    grade: {
      saturation: 12,
      contrast: 10,
      curves: {
        master: I(),
        r: pts(0, 0, 0.25, 0.18, 0.75, 0.85, 1, 1),
        g: pts(0, 0, 0.3, 0.25, 0.7, 0.78, 1, 1),
        b: pts(0, 0.12, 0.5, 0.5, 1, 0.85),
      },
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'Black & White',
    grade: {
      saturation: -100,
      contrast: 35,
      midDetail: 20,
      curves: { master: pts(0, 0, 0.25, 0.16, 0.75, 0.86, 1, 1), r: I(), g: I(), b: I() },
    },
  },
  {
    id: 'sepia',
    name: 'Sepia Tone',
    category: 'Black & White',
    grade: {
      saturation: -100,
      contrast: 8,
      fade: 8,
      splitShadowHue: 30,
      splitShadowSat: 45,
      splitHighlightHue: 42,
      splitHighlightSat: 35,
    },
  },
];

export function lookEdit(look: Look): EditState {
  return { nodes: [makeNode(look.name, look.grade)], transform: defaultTransform(), finishing: defaultFinishing() };
}
