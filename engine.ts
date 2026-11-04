import { buildLut } from "./curves";
import {
  addMaster,
  clamp,
  defaultAdjustments,
  effectiveAdjustments,
  hsvToRgb,
  wheelToRgb,
  whiteBalance,
  type Adjustments,
  type NodeState,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTex;
uniform sampler2D uLut;

uniform vec2  uTexel;      // 1 / source size
uniform vec2  uCanvas;     // output size in px
uniform float uAspect;

uniform float uExposure, uContrast, uPivot;
uniform float uHighlights, uShadows, uWhites, uBlacks;
uniform vec3  uWb;
uniform float uVibrance, uSaturation;

uniform vec3 uLift, uGamma, uGain, uOffset;

uniform vec3  uShadowTint, uHighTint;
uniform float uShadowAmt, uHighAmt;

uniform float uSharpen, uBlur, uBloom, uBloomThresh;
uniform float uVignette, uVigSoft, uGrain, uGrainScale;
uniform float uChroma, uIntensity, uSplit, uEnable;

vec3 fetch(vec2 uv) {
  return texture(uTex, clamp(uv, vec2(0.0008), vec2(0.9992))).rgb;
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float lutVal(float v, float row) {
  v = clamp(v, 0.0, 1.0);
  return texture(uLut, vec2((v * 255.0 + 0.5) / 256.0, (row + 0.5) / 4.0)).r;
}

vec3 disc(vec2 uv, float radius, int taps) {
  vec3 acc = fetch(uv);
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    float a = float(i) * 2.39996323;
    float r = radius * sqrt((float(i) + 0.6) / float(taps));
    acc += fetch(uv + vec2(cos(a), sin(a)) * r * uTexel);
  }
  return acc / float(taps + 1);
}

float hash21(vec2 p) {
  p = mod(p, 289.0);
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 uv = vUv;
  vec3 raw = fetch(uv);

  // ---- A/B compare wipe -------------------------------------------
  if (uSplit >= 0.0) {
    float w = 1.0 / max(uCanvas.x, 1.0);
    if (uv.x < uSplit - w * 1.2) { outColor = vec4(raw, 1.0); return; }
    if (uv.x < uSplit + w * 1.2) { outColor = vec4(vec3(0.92), 1.0); return; }
  }

  vec3 c = raw;

  // ---- lens / optics ----------------------------------------------
  if (uChroma > 0.002) {
    vec2 d = (uv - 0.5) * uChroma * 0.02;
    c = vec3(fetch(uv + d).r, c.g, fetch(uv - d).b);
  }
  if (uBlur > 0.002) {
    vec3 b = disc(uv, uBlur * 11.0, 14);
    c = mix(c, b, clamp(uBlur * 1.6, 0.0, 1.0));
  }
  if (abs(uSharpen) > 0.002) {
    vec3 sm = disc(uv, 1.7, 8);
    c += uSharpen * (c - sm) * 1.7;
  }
  c = clamp(c, 0.0, 4.0);

  // ---- primary ----------------------------------------------------
  c *= pow(2.0, uExposure);
  c *= uWb;

  // ---- lift / gamma / gain / offset (CDL style) -------------------
  c = clamp(c * (vec3(1.0) + uGain) + uLift * 0.55, 0.0, 1.0);
  c = pow(max(c, vec3(0.0)), clamp(vec3(1.0) / (vec3(1.0) + uGamma), vec3(0.08), vec3(12.0)));
  c = clamp(c + uOffset * 0.4, 0.0, 1.0);

  // ---- tonal ranges -----------------------------------------------
  float l = lum(c);
  float shW = 1.0 - smoothstep(0.0, 0.55, l);
  float hiW = smoothstep(0.45, 1.0, l);
  c += uShadows * 0.45 * shW;
  c += uHighlights * 0.45 * hiW;
  c *= 1.0 + uWhites * hiW * 0.85;
  c *= 1.0 - uBlacks * shW * 0.85;
  c = clamp(c, 0.0, 1.0);

  // ---- contrast around pivot --------------------------------------
  c = clamp((c - uPivot) * (1.0 + uContrast) + uPivot, 0.0, 1.0);

  // ---- custom curves ----------------------------------------------
  l = lum(c);
  float lm = lutVal(l, 0.0);
  c *= (l > 0.0008) ? (lm / l) : 0.0;
  c = clamp(c, 0.0, 1.0);
  c.r = lutVal(c.r, 1.0);
  c.g = lutVal(c.g, 2.0);
  c.b = lutVal(c.b, 3.0);

  // ---- split toning ------------------------------------------------
  l = lum(c);
  c = mix(c, c * uShadowTint, uShadowAmt * (1.0 - smoothstep(0.0, 0.62, l)) * 0.8);
  c = mix(c, c * uHighTint, uHighAmt * smoothstep(0.38, 1.0, l) * 0.8);

  // ---- vibrance / saturation ---------------------------------------
  l = lum(c);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float s = (mx - mn) / max(mx, 1e-4);
  c = mix(vec3(l), c, 1.0 + uVibrance * (1.0 - s));
  c = mix(vec3(l), c, uSaturation);
  c = clamp(c, 0.0, 1.0);

  // ---- glow / bloom -------------------------------------------------
  if (uBloom > 0.002) {
    vec3 bl = disc(uv, 17.0, 16);
    float m = smoothstep(uBloomThresh, uBloomThresh + 0.28, lum(bl));
    c += bl * m * uBloom * 0.95;
  }

  // ---- vignette ------------------------------------------------------
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
  float d = length(q) * 1.44;
  float v = 1.0 - smoothstep(1.02 - uVigSoft * 1.15, 1.02, d);
  c *= mix(1.0, v, uVignette);

  // ---- film grain ------------------------------------------------------
  if (uGrain > 0.001) {
    float n = hash21(floor(uv * uCanvas / max(uGrainScale, 0.5)));
    float mid = max(1.0 - abs(lum(c) - 0.5) * 1.7, 0.12);
    c += (n - 0.5) * uGrain * 0.5 * mid;
  }

  c = clamp(c, 0.0, 1.0);
  c = mix(raw, c, clamp(uIntensity * uEnable, 0.0, 1.0));
  outColor = vec4(c, 1.0);
}`;

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

export type View = {
  split: number; // -1 = off, 0..1 = wipe position
  original: boolean; // hold-to-see-original
};

type TexRec = { tex: WebGLTexture; w: number; h: number };

export class GradeEngine {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private lutTex: WebGLTexture;
  private textures = new Map<string, TexRec>();
  private u: Record<string, WebGLUniformLocation | null> = {};
  private currentLutKey = "";
  ok = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;

    this.program = this.build(VS, FS);
    gl.useProgram(this.program);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    // LUT texture (256 x 4)
    this.lutTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(this.loc("uLut"), 1);
    gl.uniform1i(this.loc("uTex"), 0);

    for (const n of UNIFORM_NAMES) this.u[n] = gl.getUniformLocation(this.program, n);
  }

  private loc(n: string) {
    return this.gl.getUniformLocation(this.program, n);
  }

  private build(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || "shader error");
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link error");
    return p;
  }

  /* ---------- media ---------- */

  addImage(id: string, source: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    this.removeImage(id);
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.textures.set(id, { tex, w, h });
  }

  removeImage(id: string) {
    const rec = this.textures.get(id);
    if (rec) {
      this.gl.deleteTexture(rec.tex);
      this.textures.delete(id);
    }
  }

  has(id: string) {
    return this.textures.has(id);
  }

  /** GPU / context description shown in the status bar */
  info(): string {
    const gl = this.gl;
    try {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const r = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (r) return String(r).replace(/\(.*?\)/g, "").trim().slice(0, 46);
      }
    } catch {
      /* blocked by the browser */
    }
    return "WebGL2 rasteriser";
  }

  dispose() {
    [...this.textures.keys()].forEach((k) => this.removeImage(k));
    this.gl.deleteTexture(this.lutTex);
    this.gl.deleteProgram(this.program);
    this.ok = false;
  }

  /* ---------- frame ---------- */

  resize(w: number, h: number) {
    const cw = Math.max(1, Math.round(w));
    const ch = Math.max(1, Math.round(h));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.gl.viewport(0, 0, cw, ch);
  }

  draw(
    id: string,
    adjustments: Adjustments,
    nodes: NodeState,
    view: View = { split: -1, original: false },
  ) {
    const gl = this.gl;
    const rec = this.textures.get(id);
    if (!rec || !this.ok) return false;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const a = view.original ? defaultAdjustments() : effectiveAdjustments(adjustments, nodes);

    // curves LUT
    const lut = buildLut(a.curves);
    const key = view.original ? "lin" : lutKey(a);
    if (key !== this.currentLutKey) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 4, gl.RGBA, gl.UNSIGNED_BYTE, lut);
      this.currentLutKey = key;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rec.tex);

    const cw = this.canvas.width;
    const ch = this.canvas.height;

    const lift = addMaster(wheelToRgb(a.lift), a.lift.master * 0.55);
    const gamma = addMaster(wheelToRgb(a.gamma), a.gamma.master * 0.5);
    const gain = addMaster(wheelToRgb(a.gain), a.gain.master * 0.5);
    const offset = addMaster(wheelToRgb(a.offset), a.offset.master * 0.5);
    const wb = whiteBalance(a.temperature, a.tint);
    const st = hsvToRgb(a.shadowHue, 0.55, 1.02);
    const ht = hsvToRgb(a.highHue, 0.45, 1.25);

    const set1 = (n: string, v: number) => gl.uniform1f(this.u[n], v);
    const set3 = (n: string, v: number[]) => gl.uniform3f(this.u[n], v[0], v[1], v[2]);

    gl.uniform2f(this.u.uTexel, 1 / rec.w, 1 / rec.h);
    gl.uniform2f(this.u.uCanvas, cw, ch);
    set1("uAspect", cw / Math.max(1, ch));
    set1("uExposure", a.exposure);
    set1("uContrast", a.contrast);
    set1("uPivot", a.pivot);
    set1("uHighlights", a.highlights);
    set1("uShadows", a.shadows);
    set1("uWhites", a.whites);
    set1("uBlacks", a.blacks);
    set3("uWb", wb);
    set1("uVibrance", a.vibrance);
    set1("uSaturation", a.saturation);
    set3("uLift", lift);
    set3("uGamma", gamma);
    set3("uGain", gain);
    set3("uOffset", offset);
    set3("uShadowTint", st);
    set3("uHighTint", ht);
    set1("uShadowAmt", a.shadowAmt);
    set1("uHighAmt", a.highAmt);
    set1("uSharpen", a.sharpen);
    set1("uBlur", a.blur);
    set1("uBloom", a.bloom);
    set1("uBloomThresh", a.bloomThreshold);
    set1("uVignette", a.vignette);
    set1("uVigSoft", a.vignetteSoft);
    set1("uGrain", a.grain);
    set1("uGrainScale", 1 + (cw / 900) * 1.4);
    set1("uChroma", a.chroma);
    set1("uIntensity", a.intensity);
    set1("uSplit", view.original ? -1 : view.split);
    set1("uEnable", view.original ? 0 : 1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  /* ---------- export ---------- */

  exportCanvas(
    id: string,
    adjustments: Adjustments,
    nodes: NodeState,
    scale = 1,
    longEdge = 0,
  ): HTMLCanvasElement | null {
    const rec = this.textures.get(id);
    if (!rec) return null;
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;

    let w = rec.w * scale;
    let h = rec.h * scale;
    if (longEdge > 0) {
      const k = longEdge / Math.max(rec.w, rec.h);
      w = rec.w * k;
      h = rec.h * k;
    }
    w = clamp(Math.round(w), 16, 8000);
    h = clamp(Math.round(h), 16, 8000);

    this.resize(w, h);
    this.draw(id, adjustments, nodes, { split: -1, original: false });

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(this.canvas, 0, 0, w, h);

    this.resize(prevW, prevH);
    return out;
  }
}

const UNIFORM_NAMES = [
  "uTex",
  "uLut",
  "uTexel",
  "uCanvas",
  "uAspect",
  "uExposure",
  "uContrast",
  "uPivot",
  "uHighlights",
  "uShadows",
  "uWhites",
  "uBlacks",
  "uWb",
  "uVibrance",
  "uSaturation",
  "uLift",
  "uGamma",
  "uGain",
  "uOffset",
  "uShadowTint",
  "uHighTint",
  "uShadowAmt",
  "uHighAmt",
  "uSharpen",
  "uBlur",
  "uBloom",
  "uBloomThresh",
  "uVignette",
  "uVigSoft",
  "uGrain",
  "uGrainScale",
  "uChroma",
  "uIntensity",
  "uSplit",
  "uEnable",
];

function lutKey(a: Adjustments) {
  const c = a.curves;
  return JSON.stringify([c.master, c.red, c.green, c.blue]);
}
