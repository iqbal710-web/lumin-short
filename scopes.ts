/* Pixel analysis for the scopes (histogram / parade / waveform / vectorscope) */

export const COLS = 128;
export const ANGLE_BINS = 180;
export const RAD_BINS = 44;

export type ScopeData = {
  hist: Uint32Array; // 256*3 interleaved r,g,b
  luma: Uint32Array; // 256
  parade: Uint32Array; // COLS*256*3
  wave: Uint32Array; // COLS*256
  vectors: Uint32Array; // ANGLE_BINS*RAD_BINS
  avg: [number, number, number];
  samples: number;
  w: number;
  h: number;
};

export function createScopeData(): ScopeData {
  return {
    hist: new Uint32Array(256 * 3),
    luma: new Uint32Array(256),
    parade: new Uint32Array(COLS * 256 * 3),
    wave: new Uint32Array(COLS * 256),
    vectors: new Uint32Array(ANGLE_BINS * RAD_BINS),
    avg: [0, 0, 0],
    samples: 0,
    w: 0,
    h: 0,
  };
}

const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d", { willReadFrequently: true });

/** Reads the graded canvas into scope buffers. Returns false if unavailable. */
export function analyze(canvas: HTMLCanvasElement, out: ScopeData, width = 190): boolean {
  if (!sctx || !canvas.width || !canvas.height) return false;
  const scale = Math.min(1, width / canvas.width);
  const w = Math.max(2, Math.round(canvas.width * scale));
  const h = Math.max(2, Math.round(canvas.height * scale));
  scratch.width = w;
  scratch.height = h;
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(canvas, 0, 0, w, h);
  let img: ImageData;
  try {
    img = sctx.getImageData(0, 0, w, h);
  } catch {
    return false;
  }
  const d = img.data;

  out.hist.fill(0);
  out.luma.fill(0);
  out.parade.fill(0);
  out.wave.fill(0);
  out.vectors.fill(0);
  out.w = w;
  out.h = h;

  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  const colStep = w / COLS;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const L = (r * 0.2126 + g * 0.7152 + b * 0.0722) | 0;

      out.hist[r * 3]++;
      out.hist[g * 3 + 1]++;
      out.hist[b * 3 + 2]++;
      out.luma[L]++;

      const col = Math.min(COLS - 1, (x / colStep) | 0);
      out.parade[(col * 256 + r) * 3]++;
      out.parade[(col * 256 + g) * 3 + 1]++;
      out.parade[(col * 256 + b) * 3 + 2]++;
      out.wave[col * 256 + L]++;

      // vectorscope (Y'CbCr-ish U/V)
      const u = (b - L) * 0.565;
      const v = (r - L) * 0.713;
      const rad = Math.hypot(u, v);
      if (rad > 0.002) {
        let ang = (Math.atan2(v, u) * 180) / Math.PI; // -180..180
        ang = (ang + 360) % 360;
        const ai = Math.min(ANGLE_BINS - 1, ((ang / 360) * ANGLE_BINS) | 0);
        const ri = Math.min(RAD_BINS - 1, ((rad / 0.62) * RAD_BINS) | 0);
        out.vectors[ai * RAD_BINS + ri]++;
      }

      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  out.samples = n || 1;
  out.avg = [sr / out.samples, sg / out.samples, sb / out.samples];
  return true;
}

export function peakOf(arr: Uint32Array, stride = 1, offset = 0) {
  let m = 1;
  for (let i = 0; i < arr.length; i += stride) if (arr[i + offset] > m) m = arr[i + offset];
  return m;
}
