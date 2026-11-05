export const VS = /* glsl */ `#version 300 es
in vec2 a_pos;
uniform float u_flipY;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  if (u_flipY > 0.5) v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** One serial node = one pass of this shader (Resolve-style corrector) */
export const GRADE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;
uniform sampler2D u_curves;
uniform sampler2D u_hueCurves;
uniform sampler3D u_lut;

uniform vec2 u_res;
uniform vec3 u_wb;
uniform float u_exposure;
uniform vec3 u_lift;
uniform vec3 u_gammaInv;
uniform vec3 u_gain;
uniform vec3 u_offset;
uniform float u_contrast;
uniform float u_pivot;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_saturation;
uniform float u_vibrance;
uniform float u_hue;
uniform float u_midDetail;
uniform float u_sharpen;
uniform float u_blur;
uniform float u_fade;
uniform vec3 u_splitShadow;
uniform vec3 u_splitHighlight;
uniform float u_splitBalance;
uniform float u_curvesOn;
uniform float u_hueCurvesOn;
uniform float u_lutOn;
uniform float u_lutAmount;
uniform float u_lutSize;
uniform float u_mix;
uniform float u_dehaze;
uniform float u_smooth;
uniform float u_texKeep;
uniform float u_hslOn;
uniform vec3 u_hsl[8];

const float HSL_C[8] = float[8](0.0, 0.083, 0.167, 0.333, 0.5, 0.611, 0.75, 0.875);

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float CS = 255.0 / 256.0;
const float CO = 0.5 / 256.0;

float luma(vec3 c) { return dot(c, LUMA); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Golden-angle disc blur, radius in fractions of image height
vec3 discBlur(vec2 uv, float radius, int taps) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float aspect = u_res.y / u_res.x;
  for (int i = 0; i < 48; i++) {
    if (i >= taps) break;
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(taps));
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a) * aspect, sin(a)) * r * radius;
    float w = 1.0 - 0.55 * r * r;
    acc += texture(u_image, uv + off).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}

void main() {
  vec3 src = texture(u_image, v_uv).rgb;
  vec3 c = src;

  // ---- Detail (spatial) ----
  if (u_blur > 0.0) {
    c = discBlur(v_uv, u_blur * 0.035, 40);
  }
  if (u_midDetail != 0.0) {
    vec3 b = discBlur(v_uv, 0.012, 24);
    float l = luma(c);
    float w = 1.0 - pow(abs(clamp(l, 0.0, 1.0) * 2.0 - 1.0), 2.0) * 0.7;
    c += (src - b) * u_midDetail * 1.6 * w;
  }
  if (u_smooth > 0.0) {
    float aspectS = u_res.y / u_res.x;
    float radS = 0.004 + u_smooth * 0.012;
    vec3 accS = vec3(0.0);
    float wsumS = 0.0;
    for (int i = 0; i < 28; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 28.0);
      float a = fi * 2.39996323;
      vec2 off = vec2(cos(a) * aspectS, sin(a)) * r * radS;
      vec3 t = texture(u_image, v_uv + off).rgb;
      vec3 dd = t - src;
      float w = exp(-dot(dd, dd) * 40.0) * (1.0 - 0.5 * r * r);
      accS += t * w;
      wsumS += w;
    }
    vec3 sm = accS / max(wsumS, 1e-4);
    vec3 smoothed = sm + (src - sm) * u_texKeep;
    c = mix(c, smoothed, min(u_smooth * 1.4, 1.0));
  }
  if (u_sharpen > 0.0) {
    vec2 t = 1.0 / u_res;
    vec3 n = texture(u_image, v_uv + vec2(t.x, 0.0)).rgb
           + texture(u_image, v_uv - vec2(t.x, 0.0)).rgb
           + texture(u_image, v_uv + vec2(0.0, t.y)).rgb
           + texture(u_image, v_uv - vec2(0.0, t.y)).rgb;
    vec3 d = texture(u_image, v_uv + t).rgb
           + texture(u_image, v_uv - t).rgb
           + texture(u_image, v_uv + vec2(t.x, -t.y)).rgb
           + texture(u_image, v_uv + vec2(-t.x, t.y)).rgb;
    vec3 avg = n * 0.15 + d * 0.1;
    c += (src - avg) * u_sharpen * 2.2;
  }

  // ---- White balance + exposure in linear light ----
  vec3 lin = pow(max(c, 0.0), vec3(2.2));
  lin *= u_wb * u_exposure;
  c = pow(lin, vec3(1.0 / 2.2));

  // ---- Primaries: Offset, Gain, Lift, Gamma ----
  c += u_offset;
  c *= u_gain;
  c += u_lift * max(1.0 - c, 0.0);
  c = sign(c) * pow(abs(c), u_gammaInv);

  // ---- Contrast around pivot ----
  c = (c - u_pivot) * u_contrast + u_pivot;

  // ---- Tonal regions ----
  if (u_highlights != 0.0 || u_shadows != 0.0 || u_whites != 0.0 || u_blacks != 0.0) {
    float l = clamp(luma(c), 0.0, 1.0);
    float il = 1.0 - l;
    float nl = l
      + u_shadows * 2.0 * l * il * il
      + u_highlights * 2.0 * l * l * il
      + u_whites * 0.4 * l * l * l
      + u_blacks * 0.25 * il * il * il;
    float ratio = nl / max(l, 1e-4);
    vec3 cm = c * ratio;
    vec3 ca = c + (nl - l);
    c = mix(ca, cm, smoothstep(0.02, 0.2, l) * 0.8);
  }

  // ---- Dehaze ----
  if (u_dehaze != 0.0) {
    if (u_dehaze > 0.0) {
      float veil = min(min(c.r, c.g), c.b) * u_dehaze * 0.7;
      c = (c - veil) / max(1.0 - veil, 0.2);
      c = (c - 0.5) * (1.0 + u_dehaze * 0.12) + 0.5;
    } else {
      c = mix(c, vec3(0.72), -u_dehaze * 0.35);
    }
  }

  // ---- Custom curves (master then RGB) ----
  if (u_curvesOn > 0.5) {
    vec3 cc = clamp(c, 0.0, 1.0);
    cc = vec3(
      texture(u_curves, vec2(cc.r * CS + CO, 0.5)).a,
      texture(u_curves, vec2(cc.g * CS + CO, 0.5)).a,
      texture(u_curves, vec2(cc.b * CS + CO, 0.5)).a);
    cc = vec3(
      texture(u_curves, vec2(cc.r * CS + CO, 0.5)).r,
      texture(u_curves, vec2(cc.g * CS + CO, 0.5)).g,
      texture(u_curves, vec2(cc.b * CS + CO, 0.5)).b);
    c = cc;
  }

  // ---- Hue vs Hue / Sat / Lum ----
  if (u_hueCurvesOn > 0.5) {
    vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
    vec3 hc = texture(u_hueCurves, vec2(hsv.x * CS + CO, 0.5)).rgb;
    float w = smoothstep(0.02, 0.2, hsv.y);
    hsv.x = fract(hsv.x + (hc.r - 0.5) * 0.5 * w + 1.0);
    hsv.y = clamp(hsv.y * mix(1.0, hc.g * 2.0, w), 0.0, 1.0);
    c = hsv2rgb(hsv) * (1.0 + (hc.b - 0.5) * 1.6 * w);
  }

  // ---- HSL mixer (8 color bands) ----
  if (u_hslOn > 0.5) {
    vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
    float sw = smoothstep(0.03, 0.25, hsv.y);
    float dh = 0.0;
    float ds = 0.0;
    float dl = 0.0;
    for (int i = 0; i < 8; i++) {
      float d = abs(hsv.x - HSL_C[i]);
      d = min(d, 1.0 - d);
      float w = 1.0 - smoothstep(0.0, 0.11, d);
      dh += w * u_hsl[i].x;
      ds += w * u_hsl[i].y;
      dl += w * u_hsl[i].z;
    }
    hsv.x = fract(hsv.x + dh * 0.08 * sw + 1.0);
    hsv.y = clamp(hsv.y * (1.0 + ds * sw), 0.0, 1.0);
    c = hsv2rgb(hsv) * (1.0 + dl * 0.6 * sw);
  }

  // ---- Hue rotation ----
  if (u_hue != 0.0) {
    const vec3 k = vec3(0.57735027);
    float ca = cos(u_hue);
    float sa = sin(u_hue);
    c = c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
  }

  // ---- Saturation & vibrance (color boost) ----
  {
    float l = luma(c);
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float s = clamp(mx - mn, 0.0, 1.0);
    float vib = u_vibrance * (1.0 - smoothstep(0.0, 0.6, s));
    c = mix(vec3(l), c, max(u_saturation * (1.0 + vib), 0.0));
  }

  // ---- Split toning ----
  {
    float l = clamp(luma(c), 0.0, 1.0);
    float il = 1.0 - l;
    c += u_splitShadow * (il * il * (1.0 - u_splitBalance));
    c += u_splitHighlight * (l * l * (1.0 + u_splitBalance));
  }

  // ---- 3D LUT (.cube) ----
  if (u_lutOn > 0.5) {
    vec3 cl = clamp(c, 0.0, 1.0);
    vec3 coord = cl * ((u_lutSize - 1.0) / u_lutSize) + 0.5 / u_lutSize;
    c = mix(c, texture(u_lut, coord).rgb, u_lutAmount);
  }

  // ---- Fade (matte) ----
  if (u_fade > 0.0) {
    c = mix(c, c * 0.8 + 0.1, u_fade);
  }

  c = mix(src, c, u_mix);
  outColor = vec4(c, 1.0);
}
`;

/** Final pass: transform/crop, global finishing, compare modes, clipping overlay */
export const FINAL_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_graded;
uniform sampler2D u_original;
uniform mat3 u_xform;
uniform int u_mode;
uniform float u_split;
uniform vec2 u_outSize;
uniform float u_vignette;
uniform float u_vigMid;
uniform float u_vigRound;
uniform float u_vigFeather;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_seed;
uniform int u_clip;
uniform float u_halation;
uniform float u_bloom;
uniform float u_leak;
uniform float u_leakHue;
uniform float u_chroma;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Blurred bright areas only (used for halation and bloom). Radius = fraction of output height.
vec3 glowHL(vec2 uv, float radius, float thr) {
  float aspect = u_outSize.x / u_outSize.y;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 28; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 28.0);
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a) / aspect, sin(a)) * r * radius;
    vec3 t = texture(u_graded, (u_xform * vec3(uv + off, 1.0)).xy).rgb;
    float w = 1.0 - 0.6 * r * r;
    acc += max(t - thr, 0.0) * w;
    wsum += w;
  }
  return acc / wsum / (1.0 - thr);
}

void main() {
  vec2 uv = v_uv;
  vec2 s = (u_xform * vec3(uv, 1.0)).xy;
  bool orig = u_mode == 1 || (u_mode == 2 && uv.x < u_split);
  vec3 c = orig ? texture(u_original, s).rgb : texture(u_graded, s).rgb;

  if (!orig && u_chroma > 0.0) {
    vec2 sh = (uv - 0.5) * u_chroma * 0.03;
    vec2 sR = (u_xform * vec3(uv + sh, 1.0)).xy;
    vec2 sB = (u_xform * vec3(uv - sh, 1.0)).xy;
    c = vec3(texture(u_graded, sR).r, c.g, texture(u_graded, sB).b);
  }

  if (!orig) {
    float aspect = u_outSize.x / u_outSize.y;
    if (u_halation > 0.0) {
      vec3 h = glowHL(uv, 0.03, 0.55);
      float hl = dot(h, LUMA);
      c += vec3(1.0, 0.3, 0.1) * hl * u_halation * 2.4;
    }
    if (u_bloom > 0.0) {
      vec3 h = glowHL(uv, 0.06, 0.4);
      c += h * u_bloom * 1.8;
    }
    if (u_leak > 0.0) {
      float g1 = exp(-pow(distance(vec2(uv.x * aspect, uv.y), vec2(0.0, 0.3)) * 1.6, 2.0));
      float g2 = exp(-pow(distance(vec2(uv.x * aspect, uv.y), vec2(aspect, 0.95)) * 2.1, 2.0));
      vec3 l1 = hsv2rgb(vec3(u_leakHue, 0.85, 1.0));
      vec3 l2 = hsv2rgb(vec3(fract(u_leakHue + 0.08), 0.75, 1.0));
      vec3 leak = l1 * g1 + l2 * g2 * 0.7;
      c = 1.0 - (1.0 - c) * (1.0 - clamp(leak * u_leak * 0.85, 0.0, 1.0));
    }
    if (u_vignette != 0.0) {
      vec2 d = (uv - 0.5) * 2.0;
      float ax = mix(1.0, aspect, u_vigRound);
      d.x *= ax;
      float dist = length(d) / length(vec2(ax, 1.0));
      float mid = 0.3 + u_vigMid * 0.6;
      float w = 0.05 + u_vigFeather * 0.7;
      float m = smoothstep(mid - w * 0.5, mid + w * 0.5, dist);
      if (u_vignette < 0.0) c *= 1.0 + u_vignette * m;
      else c = mix(c, vec3(1.0), u_vignette * m * 0.85);
    }
    if (u_grain > 0.0) {
      float cells = 15000.0 / (u_grainSize + 5.0);
      vec2 gp = vec2(uv.x * aspect, uv.y) * cells;
      float n = vnoise(gp + u_seed) * 0.62 + vnoise(gp * 2.13 + 17.3) * 0.38 - 0.5;
      float l = clamp(dot(c, LUMA), 0.0, 1.0);
      float w = 1.0 - pow(abs(l * 2.0 - 1.0), 2.0) * 0.65;
      c += n * u_grain * 0.38 * w;
    }
  }

  if (u_clip == 1) {
    float mx = max(c.r, max(c.g, c.b));
    if (mx >= 0.999) c = vec3(1.0, 0.12, 0.38);
    else if (mx <= 0.002) c = vec3(0.1, 0.45, 1.0);
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/** Layer compositing: adjust (blend graded copy through mask), fill, background, mask preview */
export const LAYER_FS = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_base;
uniform sampler2D u_top;
uniform sampler2D u_mask;
uniform int u_mode;
uniform float u_opacity;
uniform float u_hasMask;
uniform vec3 u_color;

void main() {
  vec3 b = texture(u_base, v_uv).rgb;
  float m = u_hasMask > 0.5 ? texture(u_mask, v_uv).r : 1.0;
  vec3 o = b;
  if (u_mode == 0) {
    vec3 t = texture(u_top, v_uv).rgb;
    o = mix(b, t, m * u_opacity);
  } else if (u_mode == 1) {
    o = mix(b, u_color, m * u_opacity);
  } else if (u_mode == 2) {
    o = mix(vec3(0.1), b, u_opacity);
  } else {
    o = mix(b, vec3(1.0, 0.12, 0.28), m * 0.6);
  }
  outColor = vec4(o, 1.0);
}
`;
