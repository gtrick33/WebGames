import { ABILITIES } from '../arena/abilities';
import { ARENA_H, ARENA_W, ENTRY_GATES, MAPS, type Pillar, type RingMap } from '../arena/maps';
import type { Fighter, Match } from '../arena/sim';
import { THEMES, type ThemeLook } from '../data/themes';
import type { ClassId } from '../data/types';
import type { HeroLook } from '../render/art/hero';
import { K, TILE, type TileMap } from '../sim/map';
import { Motion } from './cast';
import { Stand } from './crowd';
import type { Held } from './dress';
import { hexRgb } from './kits';
import { buildGround, Mesher, UNIT, type LandPacks } from './land';
import { Stage } from './stage';
import { LIGHT } from './toon';
import { shieldOf, turnOf } from './worldCast';

/**
 * The Ring in 3D: a sunken arena with the map's stone standing up out of it, every fighter in their own gear and the
 * camera on the watching player, as far as the walls let it go.
 */

export interface RingFighterLook {
  look: HeroLook;
  held: Held;
}

const SKINS = {
  sands: { land: 'desert', kind: K.Sand, stone: '#c0a57f', stoneTop: '#e2c9a2', stoneDark: '#7c6246', wall: '#8a6a48', wallTop: '#b7925f' },
  frost: { land: 'snow', kind: K.Floor, stone: '#9fd4f0', stoneTop: '#e3f6ff', stoneDark: '#5a92bc', wall: '#7fa4c2', wallTop: '#cfe6f6' },
  forge: { land: 'volcanic', kind: K.Cobble, stone: '#5f4f50', stoneTop: '#8a6a60', stoneDark: '#2e2024', wall: '#3a2c2e', wallTop: '#5a4442' },
} as const;

export interface RingView {
  /** Draws from here on in world pixels flat on the ground at (x, y). */
  flat(x: number, y: number): void;
  /** Draws from here on in world pixels facing the camera, `h` world pixels over (x, y). */
  up(x: number, y: number, h?: number): void;
}

export class RingStage implements RingView {
  readonly stage: Stage;
  private built = false;
  private readonly motions = new Map<number, { m: Motion; turn: number; swing: number }>();
  private readonly gates: Stand[] = [];
  private k = 1;
  private cx = ARENA_W / 2;
  private cy = ARENA_H / 2;
  private g: CanvasRenderingContext2D;
  private cssW = 1;
  private cssH = 1;
  private follow = true;
  /** Fires in their bowls round the arena (world pixels). */
  readonly flames: { x: number; y: number; h: number }[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly map: RingMap,
  ) {
    this.g = canvas.getContext('2d')!;
    this.stage = new Stage(canvas);
  }

  get ready(): boolean {
    return this.stage.ready;
  }

  fit(w: number, h: number, dpr: number): void {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    this.k = Math.min(dpr, 2);
    this.canvas.width = Math.round(this.cssW * this.k);
    this.canvas.height = Math.round(this.cssH * this.k);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.g = this.canvas.getContext('2d')!;
    // the whole ring, if the view can hold it at a size a fighter can be read at; closer in, following, if not
    const allW = ARENA_W / TILE + 2;
    const allH = ARENA_H / TILE + 2;
    const whole = Math.min((this.cssW * dpr) / allW, ((this.cssH * dpr) / allH) * 1.05);
    // (never fewer than about 24 tiles across, however small the window)
    const readable = Math.min((34 / 16) * TILE * dpr, ((this.cssW * dpr) / 24 / 16) * TILE);
    const tile = Math.max(whole, readable);
    this.follow = tile > whole * 1.02;
    this.stage.setSize(this.cssW, this.cssH, dpr, tile);
  }

  private build(packs: LandPacks): void {
    this.built = true;
    const skin = SKINS[this.map.theme];
    const look: ThemeLook = THEMES[skin.land as keyof typeof THEMES] ?? THEMES.desert;
    const W = Math.ceil(ARENA_W / TILE);
    const H = Math.ceil(ARENA_H / TILE);
    const tiles: Pick<TileMap, 'w' | 'h' | 'kind'> = { w: W, h: H, kind: new Uint8Array(W * H).fill(skin.kind) };
    const ground = buildGround(tiles as TileMap, look);
    this.stage.groundScene.add(ground);

    const m = new Mesher();
    const box = (x0: number, z0: number, x1: number, z1: number, h: number, side: readonly number[], dark: readonly number[], top: readonly number[]): void => {
      m.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], top);
      m.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], dark, side);
      m.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], dark, side);
      m.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], dark, side);
      m.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], dark, side);
    };
    const stone = hexRgb(skin.stone);
    const dark = hexRgb(skin.stoneDark);
    const top = hexRgb(skin.stoneTop);
    const wall = hexRgb(skin.wall);
    const wallTop = hexRgb(skin.wallTop);
    const u = (n: number): number => n / TILE;
    for (const p of this.map.pillars) {
      const h = p.wall ? 1.1 : 2.3;
      box(u(p.x), u(p.y), u(p.x + p.w), u(p.y + p.h), h, p.wall ? wall : stone, p.wall ? dark : dark, p.wall ? wallTop : top);
      // a rim round the top of a real pillar, so it reads as a block of cut stone
      if (!p.wall) {
        const b = 0.1;
        box(u(p.x) - b, u(p.y) - b, u(p.x + p.w) + b, u(p.y + p.h) + b, 0.32, dark, dark, stone);
      }
    }
    // the walls round the ring; the south one stays low, so nothing hides behind it
    const AW = u(ARENA_W);
    const AH = u(ARENA_H);
    const far = 50;
    box(-far, -far, AW + far, 0, 2.1, wall, dark, wallTop);
    box(-far, AH, AW + far, AH + far, 0.5, wall, dark, wallTop);
    box(-far, 0, 0, AH, 1.4, wall, dark, wallTop);
    box(AW, 0, AW + far, AH, 1.4, wall, dark, wallTop);
    this.stage.scene.add(m.build());

    // banners and fires along the far wall, each end in its team's color
    const pack = packs.town.meshes;
    const place = (id: string, x: number, z: number, y: number, h: number, tint?: readonly number[]): void => {
      const mesh = pack[id] ?? packs.indoor.meshes[id] ?? packs.nature.meshes[id];
      if (!mesh) return;
      const s = new Stand(mesh, this.stage.scene, 1);
      const k = h / Math.max(0.01, mesh.max[1] - mesh.min[1]);
      s.begin();
      s.put(x, y, z, 0, k, k, k, tint?.[0] ?? 1, tint?.[1] ?? 1, tint?.[2] ?? 1, 0);
      s.end();
    };
    for (let i = 0; i < 7; i++) {
      const x = ((i + 0.5) / 7) * AW;
      if (i % 2 === 0) {
        place('torch_lit', x, -0.8, 2.1, 1.3);
        this.flames.push({ x: x * TILE, y: -0.8 * TILE, h: 3.4 * TILE });
      } else place(i < 3 ? 'p_flag_blue' : i > 3 ? 'p_flag_red' : 'p_flag_blue', x, -0.8, 2.1, 2.2);
    }
    // the gates, whose bars rise when the match begins
    this.gates.push(new Stand(barMesh(), this.stage.scene, 2));
  }

  /** Who stands where, and the camera on the watching player. */
  frame(m: Match, looks: RingFighterLook[], myId: number | null, dt: number, time: number): void {
    const st = this.stage;
    if (!st.ready) return;
    if (!this.built) this.build(st.landPacks!);
    LIGHT.uTime.value = time;
    LIGHT.uDark.value.set(0, 8, 0, 0);
    LIGHT.uGrade.value.set(0, 0, 0, 0);
    const me = myId === null ? null : (m.fighters[myId] ?? null);
    let cx = ARENA_W / 2;
    let cy = ARENA_H / 2 + 8;
    if (this.follow && me) {
      const halfW = (st.spanX * TILE) * 0.95;
      const halfH = (st.spanZ * TILE) * 0.95;
      cx = ARENA_W <= halfW * 2 ? ARENA_W / 2 : Math.max(halfW - 24, Math.min(ARENA_W - halfW + 24, me.x));
      cy = ARENA_H <= halfH * 2 ? ARENA_H / 2 + 8 : Math.max(halfH - 24, Math.min(ARENA_H - halfH + 24, me.y));
    }
    const ease = 1 - Math.exp(-dt * 5);
    this.cx += (cx - this.cx) * (dt > 0 ? ease : 1);
    this.cy += (cy - this.cy) * (dt > 0 ? ease : 1);
    st.look(this.cx * UNIT, this.cy * UNIT);
    const cast = st.cast;
    cast.begin();
    for (const f of m.fighters) {
      const l = looks[f.id];
      if (!l) continue;
      this.fighter(f, l, dt, time);
    }
    cast.end();
    // the gates
    const lift = m.phase === 'gates' ? 0 : Math.min(1, m.clock / 0.9);
    const s = this.gates[0];
    if (s) {
      s.begin();
      if (lift < 1) {
        ENTRY_GATES.forEach((gate: Pillar, i: number) => {
          const c = i === 0 ? hexRgb('#5a9cff') : hexRgb('#ff5a5a');
          s.put((gate.x + gate.w / 2) * UNIT, 1.4 * lift, (gate.y + gate.h / 2) * UNIT, 0, (gate.w + 2) * UNIT, 1.4, gate.h * UNIT, 0.6 + c[0] * 0.4, 0.6 + c[1] * 0.4, 0.6 + c[2] * 0.4, 0);
        });
      }
      s.end();
    }
    st.render(dt);
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** The layer for what lies on the ground (cleared for this frame): draw there, then call `upperLayer`. */
  groundLayer(): CanvasRenderingContext2D {
    this.g = this.stage.beginDecals();
    return this.g;
  }

  upperLayer(): CanvasRenderingContext2D {
    this.g = this.canvas.getContext('2d')!;
    return this.g;
  }

  private fighter(f: Fighter, l: RingFighterLook, dt: number, time: number): void {
    const cast = this.stage.cast;
    let s = this.motions.get(f.id);
    if (!s) {
      s = { m: new Motion(), turn: turnOf(Math.atan2(f.dirY, f.dirX)), swing: 0 };
      this.motions.set(f.id, s);
    }
    const moving = Math.hypot(f.vx, f.vy) > 1;
    const want = turnOf(Math.atan2(f.dirY, f.dirX));
    let d = (want - s.turn) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    s.turn += d * (1 - Math.exp(-dt * 14));
    s.swing = Math.max(0, s.swing - dt);
    const hexed = f.auras.some((a) => a.ab === 'm-toad' && a.cc === 'incap');
    const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
    const stunned = f.auras.some((a) => a.cc === 'stun' || a.cc === 'incap');
    const frozen = f.auras.some((a) => a.kind === 'immune' && a.still);
    if (f.dead) s.m.set('die', false);
    else if (f.cast) s.m.set(f.cast.channel ? 'channel' : 'cast');
    else if (s.swing > 0) s.m.set('chop', false, 0.06);
    else if (stunned) s.m.set('hit');
    else if (moving) s.m.set('run');
    else s.m.set('idle');
    if (frozen) dt = 0;
    s.m.advance(dt);
    cast.shadow(f.x, f.y, f.dead ? 10 : 8);
    if (hexed) {
      cast.creature('slime', f.x, f.y, s.turn, 16, 'idle', time, true);
      return;
    }
    const lift = gale ? (10 + Math.sin(time * 6) * 2) * UNIT : 0;
    cast.person(l.look, l.held, shieldOf(f.cls as ClassId), f.x, f.y, s.turn, s.m, { lift, alpha: f.dead ? 0.85 : 1, tint: frozen ? [0.75, 0.92, 1.25] : undefined });
  }

  /** A fighter lands an instant blow (the 'ab' event): they swing. */
  swing(id: number, abId: string): void {
    const ab = ABILITIES[abId];
    const s = this.motions.get(id);
    if (s && ab && ab.cast === 0) s.swing = 0.42;
  }

  flat(x: number, y: number): void {
    const st = this.stage;
    const a = st.project(x, y);
    const b = st.project(x + TILE, y);
    const c = st.project(x, y + TILE);
    const k = this.k / TILE;
    const ax = (b.x - a.x) * k;
    const ay = (b.y - a.y) * k;
    const cx = (c.x - a.x) * k;
    const cy = (c.y - a.y) * k;
    this.g.setTransform(ax, ay, cx, cy, a.x * this.k - ax * x - cx * y, a.y * this.k - ay * x - cy * y);
  }

  up(x: number, y: number, h = 0): void {
    const st = this.stage;
    const a = st.project(x, y, h);
    const b = st.project(x + TILE, y, h);
    const s = ((b.x - a.x) / TILE) * this.k;
    this.g.setTransform(s, 0, 0, s, a.x * this.k - s * x, a.y * this.k - s * y);
  }

  /** A point on the screen (CSS px, on the canvas) to the arena's own ground. */
  toWorld(cx: number, cy: number): { x: number; y: number } {
    return this.stage.unproject(cx, cy);
  }

  dispose(): void {
    for (const s of this.gates) s.dispose();
    this.stage.dispose();
  }
}

/** Iron bars across a gate, one unit each way, standing on the ground. */
function barMesh(): import('./pack').MeshData {
  const m = new Mesher();
  const iron = hexRgb('#6a6270');
  const dark = hexRgb('#2a2430');
  const add = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): void => {
    m.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], iron);
    m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], dark, iron);
    m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], dark, iron);
    m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], dark, iron);
  };
  for (let i = 0; i < 6; i++) {
    const z = -0.5 + (i + 0.5) / 6;
    add(-0.5, z - 0.03, 0.5, z + 0.03, 0, 1);
  }
  add(-0.5, -0.5, 0.5, 0.5, 0.82, 0.92);
  add(-0.5, -0.5, 0.5, 0.5, 0.25, 0.33);
  return m.data();
}

export const ringMapOf = (id: string): RingMap => MAPS[id] ?? Object.values(MAPS)[0]!;
