import { FINAL_FS, GRADE_FS, LAYER_FS, VS } from './shaders';
import type { EditState, Grade, GradeNode, Layer, LutData, ScopeData } from '../types';
import { evalLayerMask, hexToRgb, layerActive, layerMaskKey, maskDims, maskRevision } from '../lib/masks';
import { curvesTexture, gradeUniforms, hueCurvesTexture } from '../lib/grade';
import { outputSize, transformMatrix } from '../lib/transform';

type ULoc = Record<string, WebGLUniformLocation | null>;
interface Program {
  prog: WebGLProgram;
  u: ULoc;
}
interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
  float: boolean;
}

export interface RenderView {
  /** 0 = graded, 1 = original (bypass), 2 = split wipe */
  mode: 0 | 1 | 2;
  split: number;
  clipping: boolean;
  ignoreCrop: boolean;
  previewLayer?: string | null;
}

export const PREVIEW_MAX = 2560;

/**
 * GPU color pipeline.
 * source → node 1 → node 2 → … (ping-pong float framebuffers) → final pass (transform + finishing) → canvas
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly maxTexture: number;
  readonly floatPipeline: boolean;
  srcW = 0;
  srcH = 0;

  private gradeProg: Program;
  private finalProg: Program;
  private layerProg: Program;
  private vao: WebGLVertexArrayObject;
  private quad: WebGLBuffer;
  private src: WebGLTexture | null = null;
  private targets: Target[] = [];
  private scopeTarget: Target | null = null;
  private curveTex: WebGLTexture[] = [];
  private curveKeys: unknown[] = [];
  private hueTex: WebGLTexture[] = [];
  private hueKeys: unknown[] = [];
  private lutTex = new Map<string, { tex: WebGLTexture; size: number }>();
  private dummy3D: WebGLTexture;
  private cachedNodes: GradeNode[] | null = null;
  private cachedTex: WebGLTexture | null = null;
  private cachedLutVersion = -1;
  private lutVersion = 0;
  private layerTargets: Target[] = [];
  private maskTex = new Map<string, { tex: WebGLTexture; key: string }>();
  private maskW = 0;
  private maskH = 0;
  private maskPix: Uint8ClampedArray | null = null;
  private composed: { nodes: GradeNode[]; lut: number; key: string; tex: WebGLTexture } | null = null;

  constructor(canvas: HTMLCanvasElement, opts: { preserve?: boolean; lowPrecision?: boolean } = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserve,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser. Please use a recent Chrome, Edge, Firefox or Safari.');
    this.gl = gl;
    this.canvas = canvas;
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const ext = gl.getExtension('EXT_color_buffer_float');
    this.floatPipeline = !!ext && !opts.lowPrecision;

    this.gradeProg = this.createProgram(GRADE_FS);
    this.finalProg = this.createProgram(FINAL_FS);
    this.layerProg = this.createProgram(LAYER_FS);

    gl.useProgram(this.gradeProg.prog);
    gl.uniform1i(this.gradeProg.u.u_image, 0);
    gl.uniform1i(this.gradeProg.u.u_curves, 1);
    gl.uniform1i(this.gradeProg.u.u_hueCurves, 2);
    gl.uniform1i(this.gradeProg.u.u_lut, 3);
    gl.useProgram(this.finalProg.prog);
    gl.uniform1i(this.finalProg.u.u_graded, 0);
    gl.uniform1i(this.finalProg.u.u_original, 1);
    gl.useProgram(this.layerProg.prog);
    gl.uniform1i(this.layerProg.u.u_base, 0);
    gl.uniform1i(this.layerProg.u.u_top, 1);
    gl.uniform1i(this.layerProg.u.u_mask, 2);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.dummy3D = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_3D, this.dummy3D);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.texParams(gl.TEXTURE_3D, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
  }

  get hasSource() {
    return !!this.src;
  }

  private createProgram(fs: string): Program {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile error: ' + log);
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, VS);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, f);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    gl.deleteShader(vs);
    gl.deleteShader(f);
    const u: ULoc = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(prog, name);
    }
    return { prog, u };
  }

  private texParams(target: number, filter: number) {
    const gl = this.gl;
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }

  private createTarget(w: number, h: number, float: boolean): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.texParams(gl.TEXTURE_2D, gl.LINEAR);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok && float) {
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      return this.createTarget(w, h, false);
    }
    return { fb, tex, w, h, float };
  }

  private deleteTarget(t: Target | null) {
    if (!t) return;
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }

  private ensureTargets(w: number, h: number) {
    if (this.targets.length === 2 && this.targets[0].w === w && this.targets[0].h === h) return;
    this.targets.forEach((t) => this.deleteTarget(t));
    this.targets = [this.createTarget(w, h, this.floatPipeline), this.createTarget(w, h, this.floatPipeline)];
    this.cachedNodes = null;
    this.composed = null;
  }

  setSource(source: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    if (this.src) gl.deleteTexture(this.src);
    this.src = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.texParams(gl.TEXTURE_2D, gl.LINEAR);
    this.srcW = w;
    this.srcH = h;
    this.ensureTargets(w, h);
    this.cachedNodes = null;
    this.prepareMaskSource(source, w, h);
  }

  setLuts(luts: Record<string, LutData>) {
    const gl = this.gl;
    let changed = false;
    for (const id of Object.keys(luts)) {
      if (this.lutTex.has(id)) continue;
      const l = luts[id];
      const tex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, l.size, l.size, l.size, 0, gl.RGB, gl.FLOAT, l.data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this.texParams(gl.TEXTURE_3D, gl.LINEAR);
      this.lutTex.set(id, { tex, size: l.size });
      changed = true;
    }
    for (const [id, v] of this.lutTex) {
      if (!(id in luts)) {
        gl.deleteTexture(v.tex);
        this.lutTex.delete(id);
        changed = true;
      }
    }
    gl.activeTexture(gl.TEXTURE0);
    if (changed) this.lutVersion++;
  }

  private lutTexture(i: number, data: () => Float32Array, key: unknown, arr: WebGLTexture[], keys: unknown[]) {
    const gl = this.gl;
    let tex = arr[i];
    if (!tex) {
      tex = gl.createTexture()!;
      arr[i] = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 256, 1, 0, gl.RGBA, gl.FLOAT, data());
      this.texParams(gl.TEXTURE_2D, gl.LINEAR);
      keys[i] = key;
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (keys[i] !== key) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.FLOAT, data());
      keys[i] = key;
    }
  }

  private gradePass(input: WebGLTexture, g: Grade, t: Target, i: number, noSpatial: boolean) {
    const gl = this.gl;
    const P = this.gradeProg;
    const u = P.u;
    gl.useProgram(P.prog);
    gl.bindVertexArray(this.vao);
    const U = gradeUniforms(g);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.uniform2f(u.u_res, this.srcW, this.srcH);
    gl.uniform3fv(u.u_wb, U.wb);
    gl.uniform1f(u.u_exposure, U.exposure);
    gl.uniform3fv(u.u_lift, U.lift);
    gl.uniform3fv(u.u_gammaInv, U.gammaInv);
    gl.uniform3fv(u.u_gain, U.gain);
    gl.uniform3fv(u.u_offset, U.offset);
    gl.uniform1f(u.u_contrast, U.contrast);
    gl.uniform1f(u.u_pivot, U.pivot);
    gl.uniform1f(u.u_highlights, U.highlights);
    gl.uniform1f(u.u_shadows, U.shadows);
    gl.uniform1f(u.u_whites, U.whites);
    gl.uniform1f(u.u_blacks, U.blacks);
    gl.uniform1f(u.u_saturation, U.saturation);
    gl.uniform1f(u.u_vibrance, U.vibrance);
    gl.uniform1f(u.u_hue, U.hue);
    gl.uniform1f(u.u_midDetail, noSpatial ? 0 : U.midDetail);
    gl.uniform1f(u.u_sharpen, noSpatial ? 0 : U.sharpen);
    gl.uniform1f(u.u_blur, noSpatial ? 0 : U.blur);
    gl.uniform1f(u.u_fade, U.fade);
    gl.uniform3fv(u.u_splitShadow, U.splitShadow);
    gl.uniform3fv(u.u_splitHighlight, U.splitHighlight);
    gl.uniform1f(u.u_splitBalance, U.splitBalance);
    gl.uniform1f(u.u_curvesOn, U.curvesOn);
    gl.uniform1f(u.u_hueCurvesOn, U.hueCurvesOn);
    gl.uniform1f(u.u_mix, U.mix);
    gl.uniform1f(u.u_dehaze, U.dehaze);
    gl.uniform1f(u.u_smooth, noSpatial ? 0 : U.smooth);
    gl.uniform1f(u.u_texKeep, U.texKeep);
    gl.uniform1f(u.u_hslOn, U.hslOn);
    gl.uniform3fv(u.u_hsl, new Float32Array(U.hsl));

    gl.activeTexture(gl.TEXTURE1);
    this.lutTexture(i, () => curvesTexture(g.curves), g.curves, this.curveTex, this.curveKeys);
    gl.activeTexture(gl.TEXTURE2);
    this.lutTexture(i, () => hueCurvesTexture(g.hueCurves), g.hueCurves, this.hueTex, this.hueKeys);
    const lut = g.lutId ? this.lutTex.get(g.lutId) : undefined;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_3D, lut ? lut.tex : this.dummy3D);
    gl.uniform1f(u.u_lutOn, lut && g.lutAmount > 0 ? 1 : 0);
    gl.uniform1f(u.u_lutSize, lut ? lut.size : 1);
    gl.uniform1f(u.u_lutAmount, g.lutAmount / 100);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }


  /* ---------------- layers + masks ---------------- */
  private prepareMaskSource(source: TexImageSource, w: number, h: number) {
    const [mw, mh] = maskDims(w, h);
    this.maskW = mw;
    this.maskH = mh;
    this.maskPix = null;
    try {
      const cv = document.createElement('canvas');
      cv.width = mw;
      cv.height = mh;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      if (cx) {
        cx.drawImage(source as unknown as CanvasImageSource, 0, 0, mw, mh);
        this.maskPix = cx.getImageData(0, 0, mw, mh).data;
      }
    } catch {
      this.maskPix = null;
    }
    this.maskTex.forEach((v) => this.gl.deleteTexture(v.tex));
    this.maskTex.clear();
    this.composed = null;
  }

  private ensureLayerTargets() {
    const w = this.srcW;
    const h = this.srcH;
    if (this.layerTargets.length === 3 && this.layerTargets[0].w === w && this.layerTargets[0].h === h) return;
    this.layerTargets.forEach((t) => this.deleteTarget(t));
    this.layerTargets = [0, 1, 2].map(() => this.createTarget(w, h, this.floatPipeline));
    this.composed = null;
  }

  private maskTexture(l: Layer): WebGLTexture | null {
    if (!this.maskW || !l.masks.some((m) => m.enabled)) return null;
    const key = layerMaskKey(l);
    const e = this.maskTex.get(l.id);
    if (e && e.key === key) return e.tex;
    const data = evalLayerMask(l, this.maskW, this.maskH, this.maskPix);
    if (!data) return null;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    let tex = e?.tex;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (!tex) {
      tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.maskW, this.maskH, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      this.texParams(gl.TEXTURE_2D, gl.LINEAR);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.maskW, this.maskH, gl.RED, gl.UNSIGNED_BYTE, data);
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.maskTex.set(l.id, { tex, key });
    return tex;
  }

  private blendPass(
    base: WebGLTexture,
    top: WebGLTexture | null,
    mask: WebGLTexture | null,
    t: Target,
    mode: number,
    opacity: number,
    color: [number, number, number],
  ): WebGLTexture {
    const gl = this.gl;
    const P = this.layerProg;
    const u = P.u;
    gl.useProgram(P.prog);
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, base);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, top ?? base);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mask ?? base);
    gl.uniform1i(u.u_mode, mode);
    gl.uniform1f(u.u_opacity, opacity);
    gl.uniform1f(u.u_hasMask, mask ? 1 : 0);
    gl.uniform3f(u.u_color, color[0], color[1], color[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return t.tex;
  }

  /** Background opacity / visibility, then every visible layer through its mask */
  private compose(graded: WebGLTexture, edit: EditState, previewId: string | null): WebGLTexture {
    const all = edit.layers ?? [];
    const layers = all.filter((l) => l.visible && l.opacity > 0 && layerActive(l));
    const bg = edit.bg ?? { name: 'Background', visible: true, opacity: 100 };
    const preview = previewId ? all.find((l) => l.id === previewId && l.masks.some((m) => m.enabled)) ?? null : null;
    const needBg = !bg.visible || bg.opacity < 100;
    if (!layers.length && !needBg && !preview) return graded;

    const key =
      JSON.stringify([layers.map((l) => [l.id, l.kind, l.opacity, l.color, l.grade, l.masks]), bg.visible, bg.opacity, preview ? preview.id : null]) +
      `|${maskRevision()}|${this.maskW}x${this.maskH}`;
    const c = this.composed;
    if (c && c.nodes === edit.nodes && c.lut === this.lutVersion && c.key === key) return c.tex;

    this.ensureLayerTargets();
    const [T0, T1, T2] = this.layerTargets;
    const pp = [T0, T1];
    let ping = 0;
    let base = graded;
    if (needBg) {
      base = this.blendPass(base, null, null, pp[ping], 2, bg.visible ? bg.opacity / 100 : 0, [0, 0, 0]);
      ping ^= 1;
    }
    layers.forEach((l, idx) => {
      const mask = this.maskTexture(l);
      if (l.kind === 'filled') {
        base = this.blendPass(base, null, mask, pp[ping], 1, l.opacity / 100, hexToRgb(l.color));
      } else {
        this.gradePass(base, l.grade, T2, 64 + idx, false);
        base = this.blendPass(base, T2.tex, mask, pp[ping], 0, l.opacity / 100, [0, 0, 0]);
      }
      ping ^= 1;
    });
    if (preview) {
      const mask = this.maskTexture(preview);
      if (mask) {
        base = this.blendPass(base, null, mask, pp[ping], 3, 1, [0, 0, 0]);
        ping ^= 1;
      }
    }
    this.composed = { nodes: edit.nodes, lut: this.lutVersion, key, tex: base };
    return base;
  }

  private runNodes(nodes: GradeNode[], noSpatial: boolean): WebGLTexture {
    const gl = this.gl;
    let input = this.src!;
    const active = nodes.filter((n) => n.enabled);
    if (!active.length) return input;
    gl.bindVertexArray(this.vao);
    let ping = 0;
    active.forEach((node, i) => {
      const t = this.targets[ping];
      ping ^= 1;
      this.gradePass(input, node.grade, t, i, noSpatial);
      input = t.tex;
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return input;
  }

  private drawFinal(target: Target | null, w: number, h: number, graded: WebGLTexture, edit: EditState, view: RenderView, seed: number) {
    const gl = this.gl;
    const P = this.finalProg;
    const u = P.u;
    const f = edit.finishing;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.prog);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, graded);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.uniformMatrix3fv(u.u_xform, false, transformMatrix(this.srcW, this.srcH, edit.transform, view.ignoreCrop));
    gl.uniform1i(u.u_mode, view.mode);
    gl.uniform1f(u.u_split, view.split);
    gl.uniform2f(u.u_outSize, w, h);
    gl.uniform1f(u.u_flipY, target ? 0 : 1);
    gl.uniform1f(u.u_vignette, f.vignette / 100);
    gl.uniform1f(u.u_vigMid, f.vignetteMid / 100);
    gl.uniform1f(u.u_vigRound, f.vignetteRound / 100);
    gl.uniform1f(u.u_vigFeather, f.vignetteFeather / 100);
    gl.uniform1f(u.u_grain, f.grain / 100);
    gl.uniform1f(u.u_grainSize, f.grainSize);
    gl.uniform1f(u.u_seed, seed);
    gl.uniform1f(u.u_halation, (f.halation ?? 0) / 100);
    gl.uniform1f(u.u_bloom, (f.bloom ?? 0) / 100);
    gl.uniform1f(u.u_leak, (f.lightLeak ?? 0) / 100);
    gl.uniform1f(u.u_leakHue, (f.leakHue ?? 25) / 360);
    gl.uniform1f(u.u_chroma, (f.chromatic ?? 0) / 100);
    gl.uniform1i(u.u_clip, view.clipping ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  private graded(edit: EditState): WebGLTexture {
    if (this.cachedNodes === edit.nodes && this.cachedTex && this.cachedLutVersion === this.lutVersion) return this.cachedTex;
    const tex = this.runNodes(edit.nodes, false);
    this.cachedNodes = edit.nodes;
    this.cachedTex = tex;
    this.cachedLutVersion = this.lutVersion;
    return tex;
  }

  /** Render the full pipeline to the canvas (canvas is resized to the output size) */
  render(edit: EditState, view: RenderView, seed = 7.31) {
    if (!this.src) return;
    const graded = this.compose(this.graded(edit), edit, view.previewLayer ?? null);
    const [w, h] = outputSize(this.srcW, this.srcH, edit.transform, view.ignoreCrop);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.drawFinal(null, w, h, graded, edit, view, seed);
  }

  /** Small graded readback used for the scopes */
  readScope(edit: EditState, maxW = 256): ScopeData | null {
    if (!this.src) return null;
    const gl = this.gl;
    const graded = this.compose(this.graded(edit), edit, null);
    const [ow, oh] = outputSize(this.srcW, this.srcH, edit.transform, false);
    const w = Math.max(1, Math.min(maxW, ow));
    const h = Math.max(1, Math.min(256, Math.round((oh * w) / ow)));
    if (!this.scopeTarget || this.scopeTarget.w !== w || this.scopeTarget.h !== h) {
      this.deleteTarget(this.scopeTarget);
      this.scopeTarget = this.createTarget(w, h, false);
    }
    this.drawFinal(this.scopeTarget, w, h, graded, edit, { mode: 0, split: 0, clipping: false, ignoreCrop: false }, 7.31);
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { data, width: w, height: h };
  }

  readPixel(x: number, y: number): [number, number, number] | null {
    const gl = this.gl;
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0], px[1], px[2]];
  }

  /** Bake the node tree (color ops only) into a N³ 3D LUT. Returns RGBA rows laid out as x = r + b*N, y = g */
  generateLut(nodes: GradeNode[], N: number): Float32Array | Uint8Array {
    const gl = this.gl;
    const w = N * N;
    const h = N;
    const data = new Float32Array(w * h * 4);
    for (let g = 0; g < N; g++)
      for (let b = 0; b < N; b++)
        for (let r = 0; r < N; r++) {
          const i = (g * w + b * N + r) * 4;
          data[i] = r / (N - 1);
          data[i + 1] = g / (N - 1);
          data[i + 2] = b / (N - 1);
          data[i + 3] = 1;
        }
    if (this.src) gl.deleteTexture(this.src);
    this.src = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    this.texParams(gl.TEXTURE_2D, gl.NEAREST);
    this.srcW = w;
    this.srcH = h;
    this.ensureTargets(w, h);
    const out = this.runNodes(nodes, true);
    const t = this.targets.find((x) => x.tex === out);
    if (!t) return data;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    let result: Float32Array | Uint8Array;
    if (t.float) {
      result = new Float32Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, result);
    } else {
      result = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, result);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return result;
  }

  dispose() {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    this.targets.forEach((t) => this.deleteTarget(t));
    this.targets = [];
    this.deleteTarget(this.scopeTarget);
    this.scopeTarget = null;
    this.layerTargets.forEach((t) => this.deleteTarget(t));
    this.layerTargets = [];
    this.maskTex.forEach((v) => gl.deleteTexture(v.tex));
    this.maskTex.clear();
    this.composed = null;
    if (this.src) gl.deleteTexture(this.src);
    this.src = null;
    [...this.curveTex, ...this.hueTex].forEach((t) => gl.deleteTexture(t));
    this.curveTex = [];
    this.hueTex = [];
    this.curveKeys = [];
    this.hueKeys = [];
    this.lutTex.forEach((v) => gl.deleteTexture(v.tex));
    this.lutTex.clear();
    gl.deleteTexture(this.dummy3D);
    gl.deleteBuffer(this.quad);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.gradeProg.prog);
    gl.deleteProgram(this.finalProg.prog);
    gl.deleteProgram(this.layerProg.prog);
    this.cachedNodes = null;
    this.cachedTex = null;
  }

  /** Dispose and release the GL context (only for renderers that own a private canvas) */
  destroy() {
    this.dispose();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
