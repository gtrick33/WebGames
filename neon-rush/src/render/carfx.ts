import { Filter, GlProgram, UniformGroup } from 'pixi.js';
import type { ShaderFx } from '../cosmetics/skins';

/**
 * Animated paint shaders for the player's car (WebGL). One filter, switched by a mode uniform,
 * applied to a single sprite, so the cost is one extra small render pass per frame.
 */

// Same vertex stage as Pixi's built-in filters.
const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// Shared with the vertex stage, so the precision must match (highp) or the program fails to link.
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uTime;
uniform float uMode;
uniform vec3 uTint;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a < 0.01) { finalColor = c; return; }
  vec3 rgb = c.rgb / c.a;
  // 0..1 across the filtered area (the car sprite).
  vec2 toUv = uInputSize.xy / uOutputFrame.zw;
  vec2 uv = vTextureCoord * toUv;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  vec3 o = rgb;
  int m = int(uMode + 0.5);

  if (m == 1) {
    // Holographic: iridescent bands that slide over the body.
    vec3 h = hsv2rgb(vec3(fract(uv.y * 1.3 + uv.x * 0.7 + uTime * 0.22 + lum * 0.6), 0.65, 1.0));
    o = mix(rgb, h * (0.45 + lum * 0.8), 0.62);
  } else if (m == 2) {
    // Chrome: a bright diagonal sheen sweeping across.
    float d = abs(fract(uv.x * 0.6 + uv.y * 0.9 - uTime * 0.35) - 0.5);
    float band = 1.0 - smoothstep(0.0, 0.06, d);
    float soft = 1.0 - smoothstep(0.0, 0.2, d);
    o = rgb * 0.92 + band * 0.75 + soft * 0.12;
  } else if (m == 3) {
    // Plasma: flowing interference pattern tinted by the car glow.
    float v = sin(uv.x * 9.0 + uTime * 2.1) + sin(uv.y * 13.0 - uTime * 1.6) + sin((uv.x + uv.y) * 7.0 + uTime * 1.2);
    vec3 p = 0.5 + 0.5 * cos(v + vec3(0.0, 2.1, 4.2));
    o = mix(rgb, p * uTint * 1.35, 0.55 * (0.35 + lum));
  } else if (m == 4) {
    // Glitch: chromatic split on random scanline bands plus CRT lines.
    float row = floor(uv.y * 24.0);
    float t = floor(uTime * 10.0);
    float jump = step(0.86, hash(vec2(row, t)));
    vec2 off = vec2((0.006 + jump * 0.05) / toUv.x, 0.0);
    float r = texture(uTexture, vTextureCoord + off).r;
    float b = texture(uTexture, vTextureCoord - off).b;
    o = vec3(r, rgb.g, b) / max(c.a, 0.001);
    o = clamp(o, 0.0, 1.5) * (0.82 + 0.18 * sin(uv.y * 220.0));
    o += jump * uTint * 0.35;
  } else if (m == 5) {
    // Molten: glowing cracks flowing backwards.
    vec2 q = uv * vec2(4.0, 7.0) + vec2(0.0, -uTime * 0.7);
    float n = noise(q) + 0.5 * noise(q * 2.3 + vec2(uTime * 0.4, 0.0));
    vec3 hot = mix(vec3(0.25, 0.02, 0.0), vec3(1.0, 0.55, 0.05), smoothstep(0.55, 1.2, n));
    o = mix(rgb * 0.55, hot, 0.72) + pow(max(n - 0.6, 0.0), 2.0) * vec3(1.0, 0.85, 0.4) * 1.6;
  } else if (m == 6) {
    // Galaxy: drifting nebula with twinkling stars.
    float n = noise(uv * vec2(3.0, 6.0) + vec2(uTime * 0.05, -uTime * 0.08));
    vec3 neb = mix(uTint * 0.35, vec3(0.75, 0.25, 1.0), n) * (0.35 + n);
    vec2 cell = floor(uv * vec2(42.0, 76.0));
    float star = step(0.975, hash(cell));
    float tw = 0.4 + 0.6 * sin(uTime * 4.0 + hash(cell + 7.0) * 40.0);
    o = mix(rgb, neb + star * tw, 0.75);
  } else if (m == 7) {
    // Pearlescent: soft color shift that follows the light.
    vec3 h = hsv2rgb(vec3(fract(uv.y * 0.9 - uv.x * 0.4 + uTime * 0.07), 0.35, 1.0));
    o = rgb * 0.88 + h * 0.3 * (0.4 + lum);
  }
  // Keep dark details (glass, wheels, panel lines) readable: the effect only paints the bodywork.
  float paint = m == 4 ? 1.0 : smoothstep(0.07, 0.3, lum);
  o = mix(rgb, o, paint);
  finalColor = vec4(clamp(o, 0.0, 1.6) * c.a, c.a);
}
`;

const MODES: Record<ShaderFx, number> = { none: 0, holo: 1, chrome: 2, plasma: 3, glitch: 4, lava: 5, galaxy: 6, pearl: 7 };

export class CarFxFilter extends Filter {
  private readonly u: UniformGroup<{ uTime: { value: number; type: 'f32' }; uMode: { value: number; type: 'f32' }; uTint: { value: Float32Array; type: 'vec3<f32>' } }>;

  constructor() {
    const u = new UniformGroup({
      uTime: { value: 0, type: 'f32' as const },
      uMode: { value: 0, type: 'f32' as const },
      uTint: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' as const },
    });
    super({ glProgram: GlProgram.from({ vertex, fragment, name: 'neon-car-fx' }), resources: { fxUniforms: u } });
    this.u = u;
    this.padding = 0;
  }

  setFx(fx: ShaderFx, tint: number): void {
    this.u.uniforms.uMode = MODES[fx];
    const t = this.u.uniforms.uTint;
    t[0] = ((tint >> 16) & 255) / 255;
    t[1] = ((tint >> 8) & 255) / 255;
    t[2] = (tint & 255) / 255;
  }

  tick(time: number): void {
    this.u.uniforms.uTime = time % 1000;
  }
}
