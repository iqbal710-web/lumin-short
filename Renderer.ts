import { FINAL_FS, GRADE_FS, VS } from './shaders';
import type { EditState, GradeNode, LutData, ScopeData } from '../types';
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

    gl.useProgram(this.gradeProg.prog);
    gl.uniform1i(this.gradeProg.u.u_image, 0);
    gl.uniform1i(this.gradeProg.u.u_curves, 1);
    gl.uniform1i(this.gradeProg.u.u_hueCurves, 2);
    gl.uniform1i(this.gradeProg.u.u_lut, 3);
    gl.useProgram(this.finalProg.prog);
    gl.uniform1i(this.finalProg.u.u_graded, 0);
    gl.uniform1i(this.finalProg.u.u_original, 1);

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

  private runNodes(nodes: GradeNode[], noSpatial: boolean): WebGLTexture {
    const gl = this.gl;
    let input = this.src!;
    const active = nodes.filter((n) => n.enabled);
    if (!active.length) return input;
    const P = this.gradeProg;
    const u = P.u;
    gl.useProgram(P.prog);
    gl.bindVertexArray(this.vao);
    let ping = 0;
    active.forEach((node, i) => {
      const t = this.targets[ping];
      ping ^= 1;
      const g = node.grade;
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
    const graded = this.graded(edit);
    const [w, h] = outputSize(this.srcW, this.srcH, edit.transform, view.ignoreCrop);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.drawFinal(null, w, h, graded, edit, view, seed);
  }

  /** Small graded readback used for the scopes */
  readScope(edit: EditState, maxW = 256): ScopeData | null {
    if (!this.src) return null;
    const gl = this.gl;
    const graded = this.graded(edit);
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
    this.cachedNodes = null;
    this.cachedTex = null;
  }

  /** Dispose and release the GL context (only for renderers that own a private canvas) */
  destroy() {
    this.dispose();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
