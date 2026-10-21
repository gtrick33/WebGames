/**
 * The aero kit, one step per level, built from real shapes: wings are cambered airfoils extruded
 * across the car (trailing edge up, for downforce), with shaped end plates, tapered pedestals or
 * swan-neck mounts that hang the wing from above, a carbon weave, and a gurney flap at the top
 * level. Every level adds or upgrades something you can see:
 * 1 roof spoiler, 2 ducktail and front splitter, 3 pedestal wing, 4 diffuser and side skirts,
 * 5 carbon wing with end plates, 6 canards and a carbon roof spoiler, 7 swan-neck double-element
 * GT wing, 8 the time-attack wing with a gurney flap, red accents and roof vortex generators.
 */
import * as THREE from 'three';
import { box, mesh, std } from './mats';

/** The body's surface, in car space (metres, nose toward +x, ground at y 0). */
export interface BodySurface {
  /** Highest point of the body at (x, z), or null off the body. */
  topAt(x: number, z?: number): number | null;
  /** Rearmost / foremost body point at height y (and z). */
  backAt(y: number, z?: number): number | null;
  frontAt(y: number, z?: number): number | null;
  /** The body's half width at (x, y). */
  sideAt(x: number, y: number): number | null;
  xMin: number;
  xMax: number;
  bottom: number;
  top: number;
  halfW: number;
  /** Axle x positions. */
  frontAxle: number;
  rearAxle: number;
  wheelR: number;
}

// ---------------------------------------------------------------- materials
let carbonTex: THREE.CanvasTexture | null = null;
/** A 2 x 2 twill weave, tiled at about 2.5 cm. */
function carbonTexture(): THREE.CanvasTexture {
  if (carbonTex) return carbonTex;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#121216';
  ctx.fillRect(0, 0, S, S);
  const n = 8;
  const c = S / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const along = (i + j) % 4 < 2;
      const g = along ? ctx.createLinearGradient(i * c, j * c, (i + 1) * c, j * c) : ctx.createLinearGradient(i * c, j * c, i * c, (j + 1) * c);
      g.addColorStop(0, '#1b1b21');
      g.addColorStop(0.5, along ? '#3a3a44' : '#2c2c35');
      g.addColorStop(1, '#141418');
      ctx.fillStyle = g;
      ctx.fillRect(i * c + 0.5, j * c + 0.5, c - 1, c - 1);
    }
  carbonTex = new THREE.CanvasTexture(cv);
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  carbonTex.repeat.set(16, 16);
  carbonTex.anisotropy = 4;
  return carbonTex;
}

let carbonMat: THREE.MeshStandardMaterial | null = null;
export function CARBON(): THREE.MeshStandardMaterial {
  if (!carbonMat) carbonMat = new THREE.MeshStandardMaterial({ map: carbonTexture(), color: '#ffffff', metalness: 0.35, roughness: 0.26, envMapIntensity: 1.2 });
  return carbonMat;
}
const ANODIZED = (): THREE.MeshStandardMaterial => std('#2a2a31', { metal: 0.7, rough: 0.32 });
const ACCENT = (): THREE.MeshStandardMaterial => std('#e8141c', { metal: 0.2, rough: 0.35 });

// ---------------------------------------------------------------- shapes
/**
 * A cambered airfoil (NACA 4-digit style, camber flipped for downforce) as a shape in the x-y
 * plane: leading edge at +chord/2, trailing edge at -chord/2.
 */
function airfoil(chord: number, thick: number, camber = 0.05): THREE.Shape {
  const n = 18;
  const up: THREE.Vector2[] = [];
  const lo: THREE.Vector2[] = [];
  const p = 0.4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - Math.cos(t * Math.PI)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = -(x < p ? (camber / (p * p)) * (2 * p * x - x * x) : (camber / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x));
    up.push(new THREE.Vector2((0.5 - x) * chord, (yc + yt) * chord));
    lo.push(new THREE.Vector2((0.5 - x) * chord, (yc - yt) * chord));
  }
  return new THREE.Shape([...up, ...lo.reverse().slice(1, -1)]);
}

/** A shape extruded `depth` along z, centred on z 0. */
function extrude(shape: THREE.Shape, depth: number, bevel = 0): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A wing element: an airfoil across the car, its trailing edge raised by `aoa` radians. */
function wingElement(chord: number, span: number, thick: number, aoa: number, mat: THREE.Material, x: number, y: number): THREE.Mesh {
  const g = extrude(airfoil(chord, thick), span, 0.004);
  g.rotateZ(-aoa);
  return mesh(g, mat, x, y, 0);
}

/** A rounded polygon (corner radius r) in the x-y plane. */
function rounded(pts: [number, number][], r: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i + n - 1) % n]!;
    const [cx, cy] = pts[i]!;
    const [nx, ny] = pts[(i + 1) % n]!;
    const d0 = Math.hypot(cx - px, cy - py);
    const d1 = Math.hypot(nx - cx, ny - cy);
    const k0 = Math.min(r, d0 / 2) / d0;
    const k1 = Math.min(r, d1 / 2) / d1;
    const a: [number, number] = [cx + (px - cx) * k0, cy + (py - cy) * k0];
    const b: [number, number] = [cx + (nx - cx) * k1, cy + (ny - cy) * k1];
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(cx, cy, b[0], b[1]);
  }
  s.closePath();
  return s;
}

/** A flat plate from a side-view outline (x-y), `thick` across z, at z. */
function plate(pts: [number, number][], thick: number, mat: THREE.Material, z: number, r = 0.012): THREE.Mesh {
  return mesh(extrude(rounded(pts, r), thick), mat, 0, 0, z);
}

/** A swan-neck mount: rises from the deck, curls back over the wing and holds it from above. */
function swanNeck(x0: number, y0: number, x1: number, y1: number, w: number, thick: number, mat: THREE.Material, z: number): THREE.Mesh {
  const curve = new THREE.CubicBezierCurve(new THREE.Vector2(x0, y0), new THREE.Vector2(x0 + 0.02, y1 + 0.1), new THREE.Vector2(x1 + 0.12, y1 + 0.1), new THREE.Vector2(x1, y1));
  const pts = curve.getPoints(16);
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)]!;
    const o = pts[Math.max(i - 1, 0)]!;
    const t = new THREE.Vector2(q.x - o.x, q.y - o.y).normalize();
    const nrm = new THREE.Vector2(-t.y, t.x);
    const ww = w * (1 - 0.35 * (i / (pts.length - 1)));
    left.push(p.clone().addScaledVector(nrm, ww / 2));
    right.push(p.clone().addScaledVector(nrm, -ww / 2));
  });
  return mesh(extrude(new THREE.Shape([...left, ...right.reverse()]), thick, 0.002), mat, 0, 0, z);
}

// ---------------------------------------------------------------- the kit
export interface AeroOpts {
  level: number;
  /** Body-colour material for painted pieces. */
  paint: THREE.Material;
}

export function buildAero(s: BodySurface, o: AeroOpts): THREE.Group {
  const g = new THREE.Group();
  const lv = o.level;
  if (lv <= 0) return g;
  const carbon = CARBON();
  const L = s.xMax - s.xMin;

  // the roof: its highest point and its rear edge
  let roofY = 0;
  let roofX = 0;
  for (let u = 0.25; u <= 0.75; u += 0.025) {
    const x = s.xMin + u * L;
    const y = s.topAt(x) ?? 0;
    if (y > roofY) [roofY, roofX] = [y, x];
  }
  let roofRear = roofX;
  for (let x = roofX; x > s.xMin; x -= 0.02) {
    const y = s.topAt(x) ?? 0;
    if (y < roofY - 0.05) break;
    roofRear = x;
  }
  const roofHalf = s.sideAt(roofRear + 0.06, roofY - 0.04) ?? s.halfW * 0.7;

  // the rear deck (or, on hatches and vans, the top of the tailgate)
  const wingX = s.xMin + Math.max(0.2, L * 0.07);
  const deckY = s.topAt(wingX) ?? s.top * 0.7;
  const tall = deckY > roofY - 0.22;
  const deckHalf = s.sideAt(wingX, deckY - 0.06) ?? s.halfW * 0.9;
  // the highest point across the deck (fins and flares at its sides): the wing clears it; an open
  // bed (a pickup) is much lower in the middle, and its wing stands on the bed's side walls
  const sides = [-0.85, -0.45, 0.45, 0.85].map((k) => s.topAt(wingX, k * deckHalf) ?? 0);
  const deckTop = Math.max(deckY, ...sides);
  const bed = deckTop - deckY > 0.15;

  // 1: roof spoiler (carbon from 6)
  {
    const span = roofHalf * 2 * 0.96;
    const visor = wingElement(0.16, span, 0.09, 0.2, lv >= 6 ? carbon : o.paint, roofRear - 0.05, roofY - 0.01);
    g.add(visor);
    if (lv >= 6) for (const z of [-1, 1]) g.add(plate([[roofRear + 0.02, roofY - 0.03], [roofRear - 0.12, roofY - 0.05], [roofRear - 0.12, roofY + 0.025], [roofRear - 0.02, roofY + 0.02]], 0.012, carbon, z * span * 0.5, 0.008));
  }

  // 2: ducktail on the deck's trailing edge (until a wing replaces it) and a front splitter
  if (lv >= 2) {
    if (lv === 2 && !tall) {
      const tx = (s.backAt(deckY - 0.03) ?? s.xMin + 0.04) + 0.03;
      const ty = s.topAt(tx + 0.05) ?? deckY;
      const span = (s.sideAt(tx + 0.06, ty - 0.05) ?? deckHalf) * 2 * 0.94;
      const lip = new THREE.Shape([new THREE.Vector2(0.16, 0), new THREE.Vector2(0.0, 0), new THREE.Vector2(-0.035, 0.075), new THREE.Vector2(0.0, 0.07), new THREE.Vector2(0.1, 0.022)]);
      g.add(mesh(extrude(lip, span, 0.006), o.paint, tx, ty - 0.012, 0));
    }
    const fy = s.bottom + 0.035;
    const fx = s.frontAt(fy + 0.04) ?? s.xMax;
    const fHalf = (s.sideAt(fx - 0.15, fy + 0.04) ?? s.halfW) * 0.96;
    const sp = new THREE.Mesh(extrude(rounded([[fx + 0.07, -fHalf * 0.86], [fx + 0.07, fHalf * 0.86], [fx + 0.02, fHalf], [fx - 0.28, fHalf], [fx - 0.28, -fHalf], [fx + 0.02, -fHalf]], 0.03), 0.022), carbon);
    sp.rotation.x = -Math.PI / 2;
    sp.position.y = fy - 0.045;
    g.add(sp);
  }

  // 4: diffuser strakes under the rear bumper and side skirts
  if (lv >= 4) {
    const by = s.bottom + 0.05;
    const bx = s.backAt(by + 0.03) ?? s.xMin;
    const bHalf = (s.sideAt(bx + 0.2, by + 0.03) ?? s.halfW) * 0.8;
    g.add(box(0.4, 0.025, bHalf * 2, carbon, bx + 0.08, s.bottom - 0.005, 0));
    for (let i = -3; i <= 3; i++) g.add(plate([[bx + 0.3, s.bottom + 0.01], [bx - 0.13, s.bottom + 0.06], [bx - 0.13, s.bottom - 0.08], [bx + 0.04, s.bottom - 0.14]], 0.014, carbon, (i / 3) * bHalf * 0.9, 0.012));
    const x0 = s.rearAxle + s.wheelR * 1.1;
    const x1 = s.frontAxle - s.wheelR * 1.1;
    if (x1 > x0 + 0.3) {
      const sy = s.bottom + 0.04;
      const sh = s.sideAt((x0 + x1) / 2, sy + 0.04) ?? s.halfW;
      for (const z of [-1, 1]) g.add(plate([[x1, sy + 0.05], [x0, sy + 0.05], [x0 - 0.03, sy - 0.06], [x1 + 0.05, sy - 0.06]], 0.06, carbon, z * (sh + 0.012), 0.02));
    }
  }

  // 3, 5, 7, 8: the wing (the factory wing goes from 3)
  if (lv >= 3) {
    const big = lv >= 7;
    const chord = lv >= 8 ? 0.36 : big ? 0.32 : lv >= 5 ? 0.26 : 0.21;
    const span = Math.min(s.halfW * 2 * 0.98, deckHalf * 2 * (big ? 1.06 : lv >= 5 ? 0.98 : 0.88));
    const base = tall ? roofY : deckTop;
    const mountX = tall ? roofRear - 0.05 : wingX;
    // height over the deck, kept around the roof line (higher for the GT wings)
    const want = lv >= 8 ? 0.46 : big ? 0.42 : lv >= 5 ? 0.3 : 0.2;
    const cap = big ? roofY + 0.08 : roofY - 0.02;
    const wy = Math.max(base + (tall ? 0.09 : 0.07), Math.min(base + want, cap));
    const wx = mountX - (tall ? chord * 0.6 : 0.02);
    const mat = lv >= 5 ? carbon : o.paint;
    g.add(wingElement(chord, span, lv >= 5 ? 0.11 : 0.13, big ? 0.16 : 0.12, mat, wx, wy));
    if (big) {
      // the upper flap, behind and above the main plane
      const fc = lv >= 8 ? 0.17 : 0.15;
      const fx = wx - chord * 0.42;
      const fy = wy + chord * 0.16;
      g.add(wingElement(fc, span, 0.1, 0.42, carbon, fx, fy));
      if (lv >= 8) {
        // gurney flap: a little lip up on the flap's trailing edge, in red
        const gx = fx - fc * 0.46;
        const gy = fy + fc * 0.22;
        g.add(box(0.008, 0.03, span * 0.98, ACCENT(), gx, gy + 0.012, 0));
      }
    }
    // mounts
    const zs = [-1, 1].map((k) => (bed ? k * deckHalf * 0.85 : k * span * (big ? 0.27 : 0.3)));
    for (const z of zs) {
      const foot = s.topAt(mountX, z) ?? base;
      if (big) g.add(swanNeck(mountX + 0.06, foot - 0.01, wx + 0.02, wy + chord * 0.03, 0.065, 0.018, ANODIZED(), z));
      else {
        const top = wy - 0.01;
        g.add(plate([[mountX + 0.07, foot - 0.02], [mountX - 0.07, foot - 0.02], [wx - 0.03, top], [wx + 0.06, top]], 0.016, lv >= 5 ? ANODIZED() : o.paint, z, 0.01));
      }
    }
    // end plates
    if (lv >= 5) {
      const h = big ? (lv >= 8 ? 0.3 : 0.26) : 0.16;
      const front = wx + chord * 0.55;
      const back = wx - chord * (big ? 1.05 : 0.6);
      const lo = wy - h * 0.42;
      const hi = wy + h * 0.58;
      for (const k of [-1, 1]) {
        const z = k * (span / 2 + 0.008);
        g.add(plate([[front, lo + 0.03], [front - 0.03, hi - 0.04], [back + 0.04, hi], [back, hi - 0.02], [back, lo], [front - 0.06, lo - 0.01]], 0.012, carbon, z, 0.02));
        if (lv >= 8) g.add(plate([[front - 0.005, lo + 0.035], [front - 0.035, hi - 0.045], [front - 0.06, hi - 0.045], [front - 0.03, lo + 0.035]], 0.004, ACCENT(), z + k * 0.008, 0.004));
      }
    }
  }

  // 6: canards on the front bumper corners
  if (lv >= 6) {
    const cy = s.bottom + 0.12;
    const cx = (s.frontAt(cy) ?? s.xMax) - 0.06;
    const ch = s.sideAt(cx, cy) ?? s.halfW;
    for (const k of [-1, 1])
      for (const [dy, len] of [
        [0, 0.12],
        [0.07, 0.09],
      ] as const) {
        const c = new THREE.Mesh(extrude(rounded([[0.05, 0], [-0.05, 0], [-0.05, 0.012], [0.03, 0.012]], 0.004), len), carbon);
        c.rotation.x = Math.PI / 2;
        c.rotation.z = 0.22;
        c.position.set(cx, cy + dy, k * (ch + len / 2 - 0.02));
        g.add(c);
      }
  }

  // 8: vortex generators along the roof's trailing edge
  if (lv >= 8) {
    const vx = roofRear + 0.14;
    const vy = s.topAt(vx) ?? roofY;
    for (let i = -3; i <= 3; i++) {
      const z = (i / 3) * roofHalf * 0.78;
      const v = plate([[0.05, 0], [-0.05, 0], [-0.05, 0.04]], 0.006, carbon, 0, 0.003);
      v.position.set(vx, vy - 0.005, z);
      v.rotation.y = i % 2 ? 0.25 : -0.25;
      g.add(v);
    }
  }
  return g;
}
