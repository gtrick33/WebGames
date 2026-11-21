import * as THREE from 'three';

/**
 * The ways into the game, hung in the Wardens' Sanctum as four great banners (the owner, 2026-11-21: "they still feel
 * like button and not part of the environment, also make 4 banners ... i want the banners to have the same 'weight' of
 * importance, but truly make them part of the environment, shadows, shaders, whatever you can think off").
 *
 * Each is cloth in the hall itself: hung from a gilt rod on two iron chains that run up into the dark of the vault,
 * cut in a swallowtail, painted with its mode's color, a gold border, its emblem and its name (a canvas, repainted
 * when what it says changes). Its shader moves it in the hall's air, a slow sway from the rod and ripples that grow
 * toward its foot, and shades the folds that makes; it is lit by what lights the hall, the cold of the rose window
 * from in front and above and the warmth of the fire bowls nearest it, flickering as they do. Under the pointer it
 * swings out, catches more of the light and its gold glows. All four hang at the same depth and the same size, at the
 * same height on the screen, two either side of the hero.
 */

export interface BannerSpec {
  id: string;
  name: string;
  sub: string;
  /** Its cloth's color. */
  color: string;
  /** Its emblem: a picture's address (the icon atlas), or a glyph drawn in gold. */
  icon?: string;
  glyph?: string;
  locked?: boolean;
}

/** A fire's light for the banners: where it stands, and how strong. */
export interface BannerFire {
  x: number;
  y: number;
  z: number;
  size: number;
}

/** How deep in the hall they hang: in front of the nearest of the great columns (z 1), the fire bowls behind them. */
const DEPTH_NEAR = 2.4;
/** No nearer the screen's edge than this; the gap between the two of a side. */
const EDGE = 0.985;
const PAIR_GAP = 0.025;
/** How high its rod is on the screen (-1 to 1), and how much of the screen's width a banner takes at most. */
const ROD_Y = 0.62;
const WIDTH_SHARE = 0.122;
/** The cloth's shape: as tall as this many widths, the swallowtail cut this far up. */
const TALL = 1.95;
const NOTCH = 0.17;
const COLS = 10;
const ROWS = 18;
const TEX_W = 512;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uSwing;
uniform float uH;
uniform float uLift;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vFold;
void main() {
  vUv = uv;
  vec3 p = position;
  float hang = clamp(-p.y / uH, 0.0, 1.0);
  // ripples that grow toward the foot, and a breath across it
  float a = p.y * 2.4 - uTime * 1.5 + uPhase;
  float b = p.x * 3.1 + uTime * 1.05 + uPhase * 1.7;
  float wave = (sin(a) * 0.055 + sin(b) * 0.03) * hang * (1.0 + uLift * 0.8);
  p.z += wave + hang * hang * uLift * 0.25;
  float dzdy = (cos(a) * 2.4 * 0.055) * hang;
  float dzdx = (cos(b) * 3.1 * 0.03) * hang;
  vFold = clamp(0.5 + (dzdy * 0.9 + dzdx * 0.6), 0.0, 1.0);
  // the sway from the rod, and the swing when the pointer comes to it
  float ang = sin(uTime * 0.62 + uPhase) * 0.02 + uSwing;
  float c = cos(ang), s = sin(ang);
  p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));
  n.xy = vec2(c * n.x - s * n.y, s * n.x + c * n.y);
  vN = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uGlow;
uniform float uTime;
uniform float uHover;
uniform float uLocked;
uniform float uPhase;
uniform vec3 uColor;
uniform vec4 uFires[4];
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vFold;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  vec4 glow = texture2D(uGlow, vUv);
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // the rose window's cold light, from in front and above, and the dim of the hall
  vec3 moonDir = normalize(vec3(0.0, 0.55, 0.85));
  float moon = max(dot(n, moonDir), 0.0);
  vec3 lit = tex.rgb * (vec3(0.62, 0.62, 0.72) + vec3(0.62, 0.66, 0.82) * moon);
  // the fire bowls, flickering
  for (int k = 0; k < 4; k++) {
    vec3 d = uFires[k].xyz - vWorld;
    float dist2 = dot(d, d);
    float flick = 1.0 + sin(uTime * 7.0 + uFires[k].x * 3.0 + uFires[k].z) * 0.08 + sin(uTime * 13.0 + uFires[k].z) * 0.05;
    float f = uFires[k].w * flick / (1.0 + dist2 * 0.42);
    float facing = max(dot(n, normalize(d)) * 0.6 + 0.4, 0.0);
    lit += tex.rgb * vec3(1.0, 0.56, 0.24) * f * facing * 1.25;
  }
  // the folds: the troughs of the ripples darker, their crests catching the light
  lit *= 0.82 + vFold * 0.36;
  // the hall's dark closing in toward the foot of the cloth, as the light from above thins
  lit *= 1.0 - 0.16 * clamp(1.0 - vUv.y, 0.0, 1.0);
  // a light of its own color along its edges, as if lit from behind: it stands out of the dark of the hall
  float ex = min(vUv.x, 1.0 - vUv.x);
  float edge = 1.0 - smoothstep(0.0, 0.09, ex);
  // (and a slow pulse of it, every banner alike, so each reads as something to press)
  float pulse = 0.5 + 0.5 * sin(uTime * 2.2 + uPhase);
  lit += uColor * edge * (0.6 + pulse * 0.35 + uHover * 0.6);
  lit += uColor * 0.12 * (0.6 + pulse * 0.4);
  lit *= 1.0 + uHover * 0.25;
  // what's stitched in gold (its name, its line, the border, the emblem's ring) shines by itself, so it reads in any
  // light; a glint runs down it now and then, and under the pointer it blazes
  float sweep = smoothstep(0.12, 0.0, abs(fract(uTime * 0.11 + uPhase * 0.17) * 1.6 - 0.3 - (1.0 - vUv.y)));
  vec3 gold = glow.rgb * glow.a * (1.0 + sweep * 0.9 + uHover * 0.45);
  // a locked banner hangs grey and dim, its gold too
  float grey = dot(lit, vec3(0.3, 0.55, 0.15));
  lit = mix(lit, vec3(grey) * 0.85, uLocked * 0.35);
  gold *= 1.0 - uLocked * 0.2;
  gl_FragColor = vec4(lit * (1.0 - glow.a * 0.85) + gold, tex.a);
}`;

/**
 * The light a banner gives off into the dark round it: a sheet just behind the cloth, its color falling away from the
 * middle, added to what's behind it. The cloth hides its middle, so it shows as a glow about the banner's edges, and
 * it never lies over the words (the hall's own glow is drawn over everything: there, it washed them out).
 */
const HALO_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAG = `
uniform vec3 uColor;
uniform float uHover;
uniform float uTime;
uniform float uPhase;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) * vec2(2.0, 2.0);
  // (falling to nothing at every edge of its sheet: a sheet that ended still lit drew a line across the hall)
  float a = (1.0 - smoothstep(0.35, 1.0, abs(d.x))) * (1.0 - smoothstep(0.3, 1.0, abs(d.y)));
  float breathe = 0.85 + 0.15 * sin(uTime * 1.3 + uPhase);
  gl_FragColor = vec4(uColor * a * (1.25 + uHover * 0.8) * breathe, 1.0);
}`;

/** The cloth: a grid hung from its top edge's middle, cut in a swallowtail at its foot. */
function clothGeometry(w: number, h: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ROWS; j++) {
    for (let i = 0; i <= COLS; i++) {
      const u = i / COLS;
      const v = j / ROWS;
      // the foot rises toward the middle: the swallowtail's cut
      const foot = h * (1 - NOTCH * (1 - Math.abs(2 * u - 1)));
      const y = -v * foot;
      pos.push((u - 0.5) * w, y, 0);
      uv.push(u, 1 + y / h);
    }
  }
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i;
      const b = a + 1;
      const c = a + COLS + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const hexOf = (s: string): THREE.Color => new THREE.Color(s);

/**
 * Paints a banner's two faces. `c`: the cloth, lit by the hall (its color, woven, deeper toward the foot, the emblem's
 * disc and picture, and a dark edge under every letter so the gold stands off it). `e`: what's stitched in gold, which
 * shines by itself (the border, the emblem's ring, the name and its line), on nothing.
 */
function paint(c: HTMLCanvasElement, e: HTMLCanvasElement, spec: BannerSpec, img: HTMLImageElement | null): void {
  const W = c.width;
  const H = c.height;
  const g = c.getContext('2d')!;
  const x = e.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  x.clearRect(0, 0, W, H);
  const col = hexOf(spec.color);
  const css = (k: number, l = 0): string => {
    const r = Math.min(255, Math.round((col.r * k + l) * 255));
    const gg = Math.min(255, Math.round((col.g * k + l) * 255));
    const b = Math.min(255, Math.round((col.b * k + l) * 255));
    return `rgb(${r},${gg},${b})`;
  };
  // the cloth: its color, deeper toward the foot, a sheen across the top
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, css(1.0, 0.05));
  grad.addColorStop(0.55, css(0.78));
  grad.addColorStop(1, css(0.48));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // the weave: fine threads either way
  g.globalAlpha = 0.07;
  g.fillStyle = '#000';
  for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1.5);
  g.fillStyle = '#fff';
  for (let xx = 0; xx < W; xx += 6) g.fillRect(xx, 0, 1.5, H);
  g.globalAlpha = 1;
  // a darker field behind the words, so they stand off the cloth
  const field = g.createLinearGradient(0, H * 0.4, 0, H * 0.78);
  field.addColorStop(0, 'rgba(0,0,0,0)');
  field.addColorStop(0.25, 'rgba(8,4,14,0.42)');
  field.addColorStop(0.8, 'rgba(8,4,14,0.42)');
  field.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = field;
  g.fillRect(0, H * 0.4, W, H * 0.38);
  // the gold border, inset, following the swallowtail
  const notch = H * NOTCH;
  const edge = (ctx: CanvasRenderingContext2D, inset: number): void => {
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    ctx.lineTo(W - inset, inset);
    ctx.lineTo(W - inset, H - inset * 1.4);
    ctx.lineTo(W / 2, H - notch - inset * 0.6);
    ctx.lineTo(inset, H - inset * 1.4);
    ctx.closePath();
  };
  g.lineJoin = 'round';
  x.lineJoin = 'round';
  edge(g, 22);
  g.strokeStyle = '#2a1604';
  g.lineWidth = 14;
  g.stroke();
  edge(x, 22);
  x.strokeStyle = '#ffcf66';
  x.lineWidth = 7;
  x.stroke();
  edge(x, 37);
  x.strokeStyle = 'rgba(255,214,120,0.55)';
  x.lineWidth = 2.5;
  x.stroke();
  // the emblem, in a gold ring
  const cx = W / 2;
  const cy = H * 0.235;
  const r = W * 0.24;
  g.beginPath();
  g.arc(cx, cy, r + 10, 0, Math.PI * 2);
  g.fillStyle = '#2a1604';
  g.fill();
  g.save();
  g.beginPath();
  g.arc(cx, cy, r - 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = css(0.35);
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) g.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else if (spec.glyph) {
    g.fillStyle = '#ffe7a8';
    g.font = `700 ${Math.round(r * 1.1)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(spec.glyph, cx, cy + r * 0.05);
  }
  g.restore();
  const ring = x.createLinearGradient(0, cy - r, 0, cy + r);
  ring.addColorStop(0, '#fff0c0');
  ring.addColorStop(0.5, '#f2c45a');
  ring.addColorStop(1, '#b07a22');
  x.beginPath();
  x.arc(cx, cy, r + 3, 0, Math.PI * 2);
  x.strokeStyle = ring;
  x.lineWidth = 9;
  x.stroke();
  // its name, large, in gold, a dark edge under it, broken onto two lines if it must be
  for (const ctx of [g, x]) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
  }
  const words = spec.name.split(' ');
  let lines = [spec.name];
  let fs = Math.round(W * 0.19);
  const font = (n: number): string => `800 ${n}px Georgia, 'Times New Roman', serif`;
  x.font = font(fs);
  if (x.measureText(spec.name).width > W * 0.8 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  while (fs > W * 0.11 && Math.max(...lines.map((l) => x.measureText(l).width)) > W * 0.8) {
    fs -= 2;
    x.font = font(fs);
  }
  g.font = font(fs);
  let y = H * 0.5 + (lines.length > 1 ? 0 : fs * 0.15);
  for (const l of lines) {
    g.lineWidth = fs * 0.24;
    g.strokeStyle = 'rgba(14,6,2,0.95)';
    g.strokeText(l, cx, y);
    const tg = x.createLinearGradient(0, y - fs, 0, y);
    tg.addColorStop(0, '#fff6d8');
    tg.addColorStop(1, '#f6c65e');
    x.fillStyle = tg;
    x.fillText(l, cx, y);
    y += fs * 1.06;
  }
  // a rule, and its line: up to two lines, white-gold, a dark edge under them too
  x.fillStyle = 'rgba(255,214,120,0.85)';
  x.fillRect(cx - W * 0.22, y - fs * 0.55, W * 0.44, 3);
  const sfs = Math.round(W * 0.085);
  const subFont = `700 ${sfs}px system-ui, 'Segoe UI', sans-serif`;
  x.font = subFont;
  g.font = subFont;
  const subLines: string[] = [];
  let cur = '';
  for (const wd of spec.sub.split(' ')) {
    const tt = cur ? `${cur} ${wd}` : wd;
    if (x.measureText(tt).width > W * 0.8 && cur) {
      subLines.push(cur);
      cur = wd;
    } else cur = tt;
  }
  if (cur) subLines.push(cur);
  let sy = y + sfs * 0.45;
  for (const l of subLines.slice(0, 3)) {
    g.lineWidth = sfs * 0.36;
    g.strokeStyle = 'rgba(8,4,2,0.9)';
    g.strokeText(l, cx, sy);
    x.fillStyle = '#fff3dc';
    x.fillText(l, cx, sy);
    sy += sfs * 1.2;
  }
  // a lock under its words, if it isn't open yet
  if (spec.locked) {
    x.font = `700 ${Math.round(W * 0.1)}px system-ui, sans-serif`;
    x.fillStyle = '#e8dccb';
    x.fillText('🔒', cx, Math.min(H - notch - W * 0.02, sy + W * 0.1));
  }
}

interface Hung {
  spec: BannerSpec;
  group: THREE.Group;
  cloth: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  halo: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  glowCanvas: HTMLCanvasElement;
  glow: THREE.CanvasTexture;
  img: HTMLImageElement | null;
  hover: number;
  swing: number;
  swingV: number;
  key: string;
}

export class HallBanners {
  private readonly root = new THREE.Group();
  private readonly hung: Hung[] = [];
  private readonly rodMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.66, 0.32) });
  private readonly knobMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.84, 0.48) });
  private readonly chainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.14, 0.2) });
  private readonly ray = new THREE.Raycaster();
  private hovered = -1;
  /** What the screen keeps for itself at each side, as a share of half its width (0 to 1 across: a phone's island). */
  private safeL = 0;
  private safeR = 0;
  /** Where each banner hangs this frame, in the hall: for the shadows under them. */
  readonly feet: { x: number; z: number; w: number }[] = [];
  private w = 1;

  constructor(
    scene: THREE.Scene,
    private readonly fires: readonly BannerFire[],
  ) {
    this.root.visible = false;
    scene.add(this.root);
  }

  /** What the four say (in order, left to right). Repaints only what changed. */
  set(specs: readonly BannerSpec[]): void {
    this.root.visible = specs.length > 0;
    specs.slice(0, 4).forEach((spec, i) => {
      const key = JSON.stringify(spec);
      let h = this.hung[i];
      if (!h) h = this.hung[i] = this.make(spec, i);
      if (h.key === key) return;
      h.key = key;
      h.spec = spec;
      h.cloth.material.uniforms.uLocked!.value = spec.locked ? 1 : 0;
      if (spec.icon) {
        const img = new Image();
        img.onload = () => {
          if (h.spec !== spec) return;
          h.img = img;
          paint(h.canvas, h.glowCanvas, spec, img);
          h.tex.needsUpdate = true;
          h.glow.needsUpdate = true;
        };
        img.src = spec.icon;
      } else h.img = null;
      paint(h.canvas, h.glowCanvas, spec, h.img && spec.icon ? h.img : null);
      h.tex.needsUpdate = true;
      h.glow.needsUpdate = true;
      (h.cloth.material.uniforms.uColor!.value as THREE.Color).set(spec.color);
      (h.halo.material.uniforms.uColor!.value as THREE.Color).set(spec.color).lerp(new THREE.Color(1, 0.9, 0.75), 0.4);
    });
  }

  private make(spec: BannerSpec, i: number): Hung {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = Math.round(TEX_W * TALL);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = canvas.width;
    glowCanvas.height = canvas.height;
    const glow = new THREE.CanvasTexture(glowCanvas);
    glow.anisotropy = 8;
    glow.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: tex },
        uGlow: { value: glow },
        uColor: { value: new THREE.Color(spec.color) },
        uTime: { value: 0 },
        uPhase: { value: i * 1.9 + 0.4 },
        uSwing: { value: 0 },
        uH: { value: TALL },
        uLift: { value: 0 },
        uHover: { value: 0 },
        uLocked: { value: 0 },
        uFires: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
      },
    });
    const group = new THREE.Group();
    // (unit size: the group is scaled to the banner's width each frame)
    const cloth = new THREE.Mesh(clothGeometry(1, TALL), mat);
    cloth.position.y = -0.04;
    group.add(cloth);
    // its light, behind it
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(spec.color).lerp(new THREE.Color(1, 0.9, 0.75), 0.4) }, uHover: { value: 0 }, uTime: { value: 0 }, uPhase: { value: i * 1.9 } },
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, TALL * 1.55), haloMat);
    halo.position.set(0, -TALL * 0.48, -0.22);
    group.add(halo);
    // the rod, wider than the cloth, a knob at each end
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.14, 10), this.rodMat);
    rod.rotation.z = Math.PI / 2;
    group.add(rod);
    for (const s of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), this.knobMat);
      knob.position.x = s * 0.59;
      group.add(knob);
      // the chain up into the dark of the vault
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 8, 5), this.chainMat);
      chain.position.set(s * 0.46, 4, 0);
      group.add(chain);
    }
    this.root.add(group);
    return { spec, group, cloth, halo, canvas, tex, glowCanvas, glow, img: null, hover: 0, swing: 0, swingV: 0, key: '' };
  }

  /** Each frame: hung where the screen wants them, moving in the air, lit by the fires. */
  frame(camera: THREE.PerspectiveCamera, dt: number, time: number): void {
    if (!this.root.visible) return;
    // all four in front of the great columns, large: the outer at the screen's edge, its pair beside it, clear of the
    // hero (the owner, 2026-11-21: "make the banners bigger and readable"). On a tall narrow screen a little narrower,
    // so the pair still clears the hero.
    const depth = DEPTH_NEAR;
    // (a phone on its side: a little lower, clear of the mark in the corner)
    const rodY = camera.aspect > 1.95 ? ROD_Y - 0.1 : ROD_Y;
    // Each side's outer edge kept inside what the screen keeps for itself there (a phone's island or notch on its
    // side: the owner, 2026-11-21, "my phone island just fucks the ring banner up"), the pair a little narrower if
    // that leaves too little room to clear the hero.
    const edgeL = EDGE - this.safeL;
    const edgeR = EDGE - this.safeR;
    const half = Math.min(camera.aspect > 1.5 ? WIDTH_SHARE : WIDTH_SHARE * 0.9, (Math.min(edgeL, edgeR) - PAIR_GAP - 0.3) / 4);
    const outerL = edgeL - half;
    const outerR = edgeR - half;
    const across = [-outerL, -(outerL - 2 * half - PAIR_GAP), outerR - 2 * half - PAIR_GAP, outerR];
    const dist = camera.position.z - depth;
    const viewW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const w = viewW * half;
    this.w = w;
    const p = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.feet.length = 0;
    this.hung.forEach((h, i) => {
      // where the ray through its place on the screen meets its depth
      p.set(across[i]!, rodY, 0.5).unproject(camera);
      dir.copy(p).sub(camera.position).normalize();
      const t = (depth - camera.position.z) / dir.z;
      const at = camera.position.clone().addScaledVector(dir, t);
      h.group.position.copy(at);
      h.group.scale.setScalar(w);
      this.feet.push({ x: at.x, z: at.z, w });
      // the pointer: it swings out (a spring), and the light comes up on it
      const want = i === this.hovered && !h.spec.locked ? 1 : 0;
      h.hover += (want - h.hover) * Math.min(1, dt * 8);
      const target = h.hover * 0.06 * (i < 2 ? 1 : -1);
      h.swingV += ((target - h.swing) * 40 - h.swingV * 5.5) * dt;
      h.swing += h.swingV * dt;
      const u = h.cloth.material.uniforms;
      u.uTime!.value = time;
      u.uSwing!.value = h.swing;
      u.uHover!.value = h.hover;
      u.uLift!.value = h.hover;
      h.halo.material.uniforms.uHover!.value = h.hover;
      h.halo.material.uniforms.uTime!.value = time;
      // (the halo swings with the cloth)
      h.halo.rotation.z = h.swing;
      const fires = u.uFires!.value as THREE.Vector4[];
      // the fires nearest it, in the cloth's own space (the group is only moved and scaled)
      const near = [...this.fires].sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
      for (let k = 0; k < 4; k++) {
        const f = near[k];
        if (!f) {
          fires[k]!.set(0, 0, 0, 0);
          continue;
        }
        fires[k]!.set(f.x, f.y + 0.4, f.z, f.size * 1.6);
      }
    });
  }

  /** Which banner is under a point of the screen (pixels from the canvas's corner), or -1. */
  pick(camera: THREE.PerspectiveCamera, x: number, y: number, w: number, h: number): number {
    if (!this.root.visible) return -1;
    this.ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), camera);
    const hits = this.ray.intersectObjects(this.hung.map((b) => b.cloth), false);
    const hit = hits[0];
    return hit ? this.hung.findIndex((b) => b.cloth === hit.object) : -1;
  }

  /** What each side of the screen keeps for itself (a phone's island, its rounded corners), in CSS pixels. */
  safe(left: number, right: number, width: number): void {
    this.safeL = (Math.max(0, left) / Math.max(1, width)) * 2;
    this.safeR = (Math.max(0, right) / Math.max(1, width)) * 2;
  }

  /** Lights one up (the pointer over it, or the keyboard on its button); -1 for none. */
  hover(i: number): void {
    this.hovered = i;
  }

  /** A banner's place on the screen (0 to 1 across and down): for the keyboard's buttons laid over them. */
  boxOf(camera: THREE.PerspectiveCamera, i: number): { x: number; y: number; w: number; h: number } | null {
    const h = this.hung[i];
    if (!h) return null;
    const a = h.group.position.clone().project(camera);
    const b = h.group.position.clone().add(new THREE.Vector3(this.w / 2, -this.w * TALL, 0)).project(camera);
    const x0 = (a.x - (b.x - a.x) + 1) / 2;
    const x1 = (b.x + 1) / 2;
    return { x: x0, y: (1 - a.y) / 2, w: x1 - x0, h: (a.y - b.y) / 2 };
  }

  dispose(): void {
    for (const h of this.hung) {
      h.tex.dispose();
      h.glow.dispose();
      h.cloth.geometry.dispose();
      h.cloth.material.dispose();
      h.halo.material.dispose();
      h.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o !== h.cloth) o.geometry.dispose();
      });
    }
    this.rodMat.dispose();
    this.knobMat.dispose();
    this.chainMat.dispose();
    this.root.removeFromParent();
  }
}
