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

/** How deep in the hall they hang: just in front of the fire bowls (z -0.9), whose light falls on their backs and edges. */
const DEPTH = -0.3;
/** Where they hang when the nave is too narrow on the screen for them there: in front of the nearest columns (z 1). */
const DEPTH_NEAR = 1.9;
/**
 * Where on the screen they hang: two either side, the front fire bowl's flame between the two of a side (each frame,
 * wherever that flame falls on this screen), with this much room either side of it, and no nearer the screen's edge
 * than this. (Hung across a flame, it burned on the cloth.)
 */
const FLAME_GAP = 0.045;
const EDGE = 0.985;
/** The gap between the two of a side when they hang together inside the flame. */
const PAIR_GAP = 0.025;
/** The inner face of the nearest of the nave's great columns (hallDress.ts: x 5.7, z 1, about 0.75 round). */
const NEAR_COLUMN = { x: 4.95, z: 1.0 };
/** How high its rod is on the screen (-1 to 1), and how much of the screen's width a banner takes at most. */
const ROD_Y = 0.56;
const WIDTH_SHARE = 0.095;
/** The cloth's shape: as tall as this many widths, the swallowtail cut this far up. */
const TALL = 1.95;
const NOTCH = 0.17;
const COLS = 10;
const ROWS = 18;
const TEX_W = 320;

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
uniform float uTime;
uniform float uHover;
uniform float uLocked;
uniform vec4 uFires[4];
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vFold;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // the rose window's cold light, from in front and above, and the dim of the hall
  vec3 moonDir = normalize(vec3(0.0, 0.55, 0.85));
  float moon = max(dot(n, moonDir), 0.0);
  vec3 lit = tex.rgb * (vec3(0.36, 0.38, 0.52) + vec3(0.62, 0.66, 0.86) * moon);
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
  lit *= 0.8 + vFold * 0.4;
  // the gold of its border and emblem (the painted gold is the brightest warm in it) glows under the pointer
  float gold = smoothstep(0.55, 0.85, tex.r) * smoothstep(0.35, 0.6, tex.g) * (1.0 - smoothstep(0.35, 0.6, tex.b));
  lit *= 1.0 + uHover * 0.28;
  lit += tex.rgb * gold * (0.18 + uHover * 0.55);
  // a locked banner hangs grey and dim
  float grey = dot(lit, vec3(0.3, 0.55, 0.15));
  lit = mix(lit, vec3(grey) * 0.75, uLocked * 0.75);
  // the hall's dark closing in toward the foot of the cloth, as the light from above thins
  lit *= 1.0 - 0.2 * clamp(1.0 - vUv.y, 0.0, 1.0);
  gl_FragColor = vec4(lit, tex.a);
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

/** Paints a banner's face: cloth of its color, woven, a gold border, the emblem in a gold ring, its name and its line. */
function paint(c: HTMLCanvasElement, spec: BannerSpec, img: HTMLImageElement | null): void {
  const W = c.width;
  const H = c.height;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const col = hexOf(spec.color);
  const css = (k: number, l = 0): string => {
    const r = Math.min(255, Math.round((col.r * k + l) * 255));
    const gg = Math.min(255, Math.round((col.g * k + l) * 255));
    const b = Math.min(255, Math.round((col.b * k + l) * 255));
    return `rgb(${r},${gg},${b})`;
  };
  // the cloth: its color, deeper toward the foot, a sheen across the top
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, css(0.95, 0.04));
  grad.addColorStop(0.55, css(0.72));
  grad.addColorStop(1, css(0.42));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // the weave: fine threads either way
  g.globalAlpha = 0.07;
  g.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.fillStyle = '#fff';
  for (let x = 0; x < W; x += 5) g.fillRect(x, 0, 1, H);
  g.globalAlpha = 1;
  // the gold border, inset, following the swallowtail
  const notch = H * NOTCH;
  const edge = (inset: number): void => {
    g.beginPath();
    g.moveTo(inset, inset);
    g.lineTo(W - inset, inset);
    g.lineTo(W - inset, H - inset * 1.4);
    g.lineTo(W / 2, H - notch - inset * 0.6);
    g.lineTo(inset, H - inset * 1.4);
    g.closePath();
  };
  g.lineJoin = 'round';
  edge(14);
  g.strokeStyle = '#3a2208';
  g.lineWidth = 9;
  g.stroke();
  edge(14);
  g.strokeStyle = '#e8bd5a';
  g.lineWidth = 5;
  g.stroke();
  edge(24);
  g.strokeStyle = 'rgba(255,214,120,0.55)';
  g.lineWidth = 1.5;
  g.stroke();
  // the emblem, in a gold ring
  const cx = W / 2;
  const cy = H * 0.24;
  const r = W * 0.27;
  g.beginPath();
  g.arc(cx, cy, r + 7, 0, Math.PI * 2);
  g.fillStyle = '#3a2208';
  g.fill();
  const ring = g.createLinearGradient(0, cy - r, 0, cy + r);
  ring.addColorStop(0, '#ffe7a8');
  ring.addColorStop(0.5, '#e8bd5a');
  ring.addColorStop(1, '#9a6a1c');
  g.beginPath();
  g.arc(cx, cy, r + 4, 0, Math.PI * 2);
  g.fillStyle = ring;
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
  // its name, in gold with a dark edge, broken onto two lines if it must be
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const words = spec.name.split(' ');
  const lines: string[] = [];
  let fs = 46;
  g.font = `800 ${fs}px Georgia, 'Times New Roman', serif`;
  if (g.measureText(spec.name).width > W * 0.82 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    lines.push(words.slice(0, mid).join(' '), words.slice(mid).join(' '));
  } else lines.push(spec.name);
  while (fs > 26 && Math.max(...lines.map((l) => g.measureText(l).width)) > W * 0.84) {
    fs -= 2;
    g.font = `800 ${fs}px Georgia, 'Times New Roman', serif`;
  }
  let y = H * 0.5;
  for (const l of lines) {
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(20,10,4,0.92)';
    g.strokeText(l, cx, y);
    const tg = g.createLinearGradient(0, y - fs, 0, y);
    tg.addColorStop(0, '#fff2c8');
    tg.addColorStop(1, '#f0c25a');
    g.fillStyle = tg;
    g.fillText(l, cx, y);
    y += fs * 1.08;
  }
  // a rule, and its line
  g.fillStyle = 'rgba(255,214,120,0.75)';
  g.fillRect(cx - W * 0.2, y - fs * 0.55, W * 0.4, 2);
  g.font = `600 22px system-ui, sans-serif`;
  const sub = spec.sub;
  const subLines: string[] = [];
  let cur = '';
  for (const wd of sub.split(' ')) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (g.measureText(t).width > W * 0.78 && cur) {
      subLines.push(cur);
      cur = wd;
    } else cur = t;
  }
  if (cur) subLines.push(cur);
  let sy = y + 6;
  for (const l of subLines.slice(0, 2)) {
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(10,6,4,0.85)';
    g.strokeText(l, cx, sy);
    g.fillStyle = '#f4ead4';
    g.fillText(l, cx, sy);
    sy += 27;
  }
  // a lock over it, if it isn't open yet
  if (spec.locked) {
    g.font = `700 34px system-ui, sans-serif`;
    g.fillStyle = '#e8dccb';
    g.fillText('🔒', cx, H * 0.78);
  }
}

interface Hung {
  spec: BannerSpec;
  group: THREE.Group;
  cloth: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
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
          paint(h.canvas, spec, img);
          h.tex.needsUpdate = true;
        };
        img.src = spec.icon;
      } else h.img = null;
      paint(h.canvas, spec, h.img && spec.icon ? h.img : null);
      h.tex.needsUpdate = true;
    });
  }

  private make(spec: BannerSpec, i: number): Hung {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = Math.round(TEX_W * TALL);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: tex },
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
    return { spec, group, cloth, canvas, tex, img: null, hover: 0, swing: 0, swingV: 0, key: '' };
  }

  /** Each frame: hung where the screen wants them, moving in the air, lit by the fires. */
  frame(camera: THREE.PerspectiveCamera, dt: number, time: number): void {
    if (!this.root.visible) return;
    // where the front fire bowl's flame is on the screen (the bowls are mirrored: the right one's), and the inner face
    // of the nearest great column, which stands in front of them: nothing hangs past it
    const front = this.fires.reduce((a, f) => (f.x > 0 && (!a || f.z > a.z) ? f : a), null as BannerFire | null);
    const flame = front ? new THREE.Vector3(front.x, front.y + 0.4, front.z).project(camera).x : 0.7;
    const limit = Math.min(EDGE, new THREE.Vector3(NEAR_COLUMN.x, 3, NEAR_COLUMN.z).project(camera).x - 0.01);
    // the flame between the two of a side where there's room past it for a banner; else both inside it, clear of the
    // hero (whose ring of others reaches about a third of the way out)
    let half: number;
    let inner: number;
    let outer: number;
    const past = (limit - flame - FLAME_GAP) / 2;
    if (past >= 0.065) {
      half = Math.min(WIDTH_SHARE, past, (flame - FLAME_GAP - 0.3) / 2);
      inner = flame - FLAME_GAP - half;
      outer = flame + FLAME_GAP + half;
    } else {
      const right = Math.min(flame - FLAME_GAP, limit);
      half = Math.min(WIDTH_SHARE, (right - 0.32 - PAIR_GAP) / 4);
      outer = right - half;
      inner = outer - 2 * half - PAIR_GAP;
    }
    // too cramped to read there (a phone on its side, where the nave is narrow on the screen): they hang nearer, in
    // front of the great columns, the outer at the screen's edge
    let depth = DEPTH;
    let rodY = ROD_Y;
    if (half < 0.075) {
      // (and a little lower: their rods came over the mark in the corner)
      rodY = ROD_Y - 0.1;
      depth = DEPTH_NEAR;
      half = WIDTH_SHARE * 1.1;
      outer = EDGE - half;
      inner = Math.max(0.22 + half, outer - 2 * half - PAIR_GAP);
    }
    const across = [-outer, -inner, inner, outer];
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
      h.cloth.geometry.dispose();
      h.cloth.material.dispose();
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
