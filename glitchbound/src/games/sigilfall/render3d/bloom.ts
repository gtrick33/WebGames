import * as THREE from 'three';

/**
 * The glow of fire and magic (POLISH_PLAN.md piece 14): what gives light in the effects layer (render3d/fx3d.ts: a
 * flame, a bolt, an orb, holy light, a rift, a blast) spills a soft halo onto what is round it, as a light seen
 * through air does. Only the effects glow: the world, its people and its warnings stay crisp.
 *
 * The effects are drawn a second time, a quarter the picture's size, with only their light (fx3d's glow pass); that
 * is blurred twice each way and laid back over the picture as added light. A quarter of the pixels and five small
 * passes: about what one more figure on the screen costs. With the graphics setting on light, on a touch screen
 * unless it is set to full, or on a machine that has had to draw fewer pixels to keep up, there is none (stage.ts).
 */

/** The share of the full picture below which, on its own setting, fire and magic stop glowing (the machine is pressed). */
export const GLOW_QUALITY = 0.85;

/**
 * Whether fire and magic glow: with the graphics setting on full (Sharp), on any screen; on its own setting (Auto), on a
 * mouse and keyboard while the machine draws the whole picture, never on a touch screen (a phone keeps its frames);
 * never with the setting on light.
 */
export function glowWanted(mode: 'auto' | 'high' | 'low', touch: boolean, quality: number): boolean {
  return mode === 'high' || (mode === 'auto' && !touch && quality >= GLOW_QUALITY);
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

/** A Gaussian along one direction in five taps, the four off the middle read between texels (nine texels' worth). */
const BLUR = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uTex, vUv) * 0.2270270270;
    c += texture2D(uTex, vUv + uStep * 1.3846153846) * 0.3162162162;
    c += texture2D(uTex, vUv - uStep * 1.3846153846) * 0.3162162162;
    c += texture2D(uTex, vUv + uStep * 3.2307692308) * 0.0702702703;
    c += texture2D(uTex, vUv - uStep * 3.2307692308) * 0.0702702703;
    gl_FragColor = c;
  }`;

/** The halo laid over the picture as light: added, never covering (no alpha: the effects' own premultiplied way). */
const ADD = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uTex, vUv).rgb * uStrength;
    gl_FragColor = vec4(c, 0.0);
  }`;

export class Bloom {
  private readonly a: THREE.WebGLRenderTarget;
  private readonly b: THREE.WebGLRenderTarget;
  private readonly blur: THREE.ShaderMaterial;
  private readonly add: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly flat = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();
  private readonly clear = new THREE.Color();
  /** How bright the halo is laid on. */
  strength = 0.85;

  constructor() {
    const opts = { depthBuffer: true, stencilBuffer: false, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter } as const;
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.blur = new THREE.ShaderMaterial({ uniforms: { uTex: { value: null }, uStep: { value: new THREE.Vector2() } }, vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false });
    this.add = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uStrength: { value: this.strength } },
      vertexShader: VERT,
      fragmentShader: ADD,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    // one triangle over the whole picture
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, this.blur);
    this.quad.frustumCulled = false;
    this.flat.add(this.quad);
  }

  /**
   * Draws the effects' light small (`light`: the effects alone, with their glow pass on), blurs it and lays it over
   * what `gl` has just drawn. Leaves the renderer as it found it (its target, its clearing, its clear color).
   */
  render(gl: THREE.WebGLRenderer, light: () => void): void {
    gl.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.round(this.size.x / 4));
    const h = Math.max(1, Math.round(this.size.y / 4));
    if (this.a.width !== w || this.a.height !== h) {
      this.a.setSize(w, h);
      this.b.setSize(w, h);
    }
    const was = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    gl.getClearColor(this.clear);
    const clearA = gl.getClearAlpha();
    try {
      gl.setClearColor(0x000000, 0);
      gl.setRenderTarget(this.a);
      gl.clear(true, true, false);
      gl.autoClear = false;
      light();
      // blurred twice each way: a wide soft halo from a quarter of the pixels
      for (let i = 0; i < 2; i++) {
        this.pass(gl, this.a, this.b, 1 / w, 0);
        this.pass(gl, this.b, this.a, 0, 1 / h);
      }
      gl.setRenderTarget(was);
      this.add.uniforms.uTex!.value = this.a.texture;
      this.add.uniforms.uStrength!.value = this.strength;
      this.quad.material = this.add;
      gl.render(this.flat, this.cam);
    } finally {
      gl.autoClear = autoClear;
      gl.setRenderTarget(was);
      gl.setClearColor(this.clear, clearA);
    }
  }

  private pass(gl: THREE.WebGLRenderer, from: THREE.WebGLRenderTarget, to: THREE.WebGLRenderTarget, dx: number, dy: number): void {
    this.blur.uniforms.uTex!.value = from.texture;
    (this.blur.uniforms.uStep!.value as THREE.Vector2).set(dx, dy);
    this.quad.material = this.blur;
    gl.setRenderTarget(to);
    gl.clear(true, false, false);
    gl.render(this.flat, this.cam);
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
    this.blur.dispose();
    this.add.dispose();
    this.quad.geometry.dispose();
  }
}
