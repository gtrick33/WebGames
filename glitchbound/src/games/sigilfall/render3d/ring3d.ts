import type * as THREE from 'three';
import { ABILITIES, type Ability } from '../arena/abilities';
import { ARENA_H, ARENA_W, ENTRY_GATES, MAPS, type Pillar, type RingMap } from '../arena/maps';
import type { Fighter, Match } from '../arena/sim';
import { THEMES, type ThemeLook } from '../data/themes';
import type { ClassId } from '../data/types';
import type { HeroLook } from '../render/art/hero';
import { K, TILE, type TileMap } from '../sim/map';
import { Motion, PERSON_H } from './cast';
import { strikeOf } from './strike';
import { Stand } from './crowd';
import type { Held } from './dress';
import { hexRgb } from './kits';
import type { Fx3D } from './fx3d';
import { buildGround, Mesher, UNIT, type LandPacks } from './land';
import { dressRing, type RingAir, type RingDress } from './ringDress';
import { disposeFloor, floorOf } from './ringFloor';
import { Stage } from './stage';
import { CROWD, LIGHT } from './toon';
import { THRALL_BLOW_T, THRALL_LUNGE, THRALL_SPRITE, thrallPose } from './thrall';
import { shieldOf, turnOf } from './worldCast';

/**
 * The Ring in 3D: a sunken arena with the map's stone standing up out of it, every fighter in their own gear and the
 * camera on the watching player, as far as the walls let it go.
 */

export interface RingFighterLook {
  look: HeroLook;
  held: Held;
}

/** The warlock's ashbound dead are the Ashen Host's skeleton soldiers (render3d/thrall.ts), a little smaller than a hero, ash-violet. */
const THRALL_H = PERSON_H * 0.86;
// (multiplied into the soldier's ash-grey, which is painted dark: brighter than plain, so the bones read under the violet)
const ASHBOUND = [1.3, 1.2, 1.6] as const;
/** Seconds one takes to sink back into the ground once it has fallen or its time is up. */
const THRALL_SINK = 1.1;
/** One of your own in the shroud: drawn see-through, gone the violet of the dusk. */
const SHADE: readonly [number, number, number] = [0.55, 0.45, 0.9];

const SKINS = {
  sands: { land: 'desert', kind: K.Sand, grade: [1, 0.72, 0.4, 0.03] },
  frost: { land: 'snow', kind: K.Floor, grade: [0.5, 0.72, 1, 0.04] },
  forge: { land: 'volcanic', kind: K.Cobble, grade: [1, 0.42, 0.14, 0.05] },
} as const;

export interface RingView {
  /** Draws from here on in world pixels flat on the ground at (x, y). */
  flat(x: number, y: number): void;
  /** Draws from here on in world pixels facing the camera, `h` world pixels over (x, y). */
  up(x: number, y: number, h?: number): void;
  /** The player asked for less motion: what would turn or bob on the ground stands still. */
  still?: boolean;
}

/** How far the camera leans toward the fight on a phone, as a share of the way to the enemy, and at most (world px). */
export const THUMBS_LEAN = 0.35;
export const THUMBS_LEAN_MAX = 64;
/** An enemy ability's aim, for asking the rules whom the hero's harm goes to. */
const AT_FOE = { aim: 'enemy' } as Ability;

/**
 * Where across the ring the camera looks on a phone, played with thumbs (the owner: "theyre lowkey covering the enemies
 * and i can barely see whats happening on the right side of the screen"): a third of the way from the hero toward whom
 * they fight (the enemy they chose, or the one their harm goes to), so that the other side stands in the open middle
 * and not under the abilities in the corner. Only across: the whole ring's height is always in the picture.
 */
export function thumbsX(m: Match, me: Fighter): number {
  const foe = m.phase === 'fight' ? m.aimOf(me, AT_FOE) : null;
  if (!foe || foe === me || foe.dead) return me.x;
  return me.x + Math.max(-THUMBS_LEAN_MAX, Math.min(THUMBS_LEAN_MAX, (foe.x - me.x) * THUMBS_LEAN));
}

/** Where up and down the ring the camera always looks: a little north of the middle (what stands up there takes more of the screen than what lies south). */
export const RING_LOOK_Y = ARENA_H / 2 - 14;

/**
 * How big a tile is drawn (device px) for a view of this size: the ring's whole height, its top edge and its bottom
 * edge, fills the view's height exactly, and the camera pans only sideways (the owner, 2026-11-15: "zoom out the camera
 * a bit so that the top edge and the bottom edge fit perfectly and canera pans only sideways"). `follow` when the ring
 * is wider than the view; `back`, how far a fallen player's camera steps back to take in all of it.
 */
export function ringFit(cssW: number, cssH: number, dpr: number): { tile: number; follow: boolean; back: number } {
  const allW = ARENA_W / TILE + 2;
  const allH = ARENA_H / TILE + RING_EDGE;
  const tall = ((cssH * dpr) / allH) * RING_TILT;
  const whole = Math.min((cssW * dpr) / allW, tall);
  return { tile: tall, follow: tall > whole * 1.02, back: Math.min(1.9, Math.max(1, tall / whole)) };
}
/** The tiles of wall over and under the floor that the height takes in, and how much the camera's lean shortens it. */
export const RING_EDGE = 2;
export const RING_TILT = 1.05;

export class RingStage implements RingView {
  readonly stage: Stage;
  private built = false;
  private readonly motions = new Map<number, { m: Motion; turn: number; swing: number; clip: string; fresh: boolean; time: number; lunge: number; hurt: number; hard: boolean }>();
  /**
   * Where each body was drawn this frame: the rules' spot, carried into a blow and back, rocked by a flinch. What is
   * worn on a fighter (the Gloamknight's gloam, a shield, a curse) is drawn here too, so it goes with the body rather
   * than staying on the spot while the body steps away from it and back.
   */
  private readonly drawn = new Map<number, { x: number; y: number }>();
  /** Blows each of the raised dead had struck when last drawn (a new one starts its swing). */
  private readonly blows = new Map<number, number>();
  /** The picture shaken by a heavy blow: how hard (world px) and for how much longer. */
  private quake = 0;
  private quakeT = 0;
  /** Off for those who asked for less motion. */
  still = false;
  /** Played with thumbs on a phone: the fight framed in the clear middle of the screen, away from the controls. */
  thumbs = false;
  private readonly gates: Stand[] = [];
  private k = 1;
  private cx = ARENA_W / 2;
  private cy = ARENA_H / 2;
  private g: CanvasRenderingContext2D;
  private cssW = 1;
  private cssH = 1;
  private follow = true;
  /** How far the camera has to step back to hold the whole ring (1: it already does). */
  private back = 1;
  private dress: RingDress | null = null;
  private floor: THREE.Mesh | null = null;
  /** What burns, smokes and glints round the arena. */
  air: RingAir = { flames: [], smokes: [], glints: [], embers: [] };

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
    const { tile, follow, back } = ringFit(this.cssW, this.cssH, dpr);
    this.follow = follow;
    this.back = back;
    this.stage.setSize(this.cssW, this.cssH, dpr, tile);
  }

  private build(packs: LandPacks): void {
    this.built = true;
    const skin = SKINS[this.map.theme];
    const look: ThemeLook = THEMES[skin.land as keyof typeof THEMES] ?? THEMES.desert;
    const W = Math.ceil(ARENA_W / TILE);
    const H = Math.ceil(ARENA_H / TILE);
    const tiles: Pick<TileMap, 'w' | 'h' | 'kind'> = { w: W, h: H, kind: new Uint8Array(W * H).fill(skin.kind) };
    this.floor = floorOf(this.map);
    this.stage.groundScene.add(buildGround(tiles as TileMap, look), this.floor);
    this.dress = dressRing(this.map, packs, this.stage.scene);
    this.air = this.dress.air;
    // the gates, whose bars rise when the match begins
    this.gates.push(new Stand(barMesh(), this.stage.scene, 2));
  }

  /** Who stands where, and the camera on the watching player. */
  frame(m: Match, looks: RingFighterLook[], myId: number | null, dt: number, time: number, spells?: (fx: Fx3D) => void): void {
    const st = this.stage;
    if (!st.ready) return;
    if (!this.built) {
      this.build(st.landPacks!);
      // (the dead's model fetched now, if anyone here can raise them, so they don't climb out of the ground unseen)
      if (m.fighters.some((f) => f.bar.some((id) => ABILITIES[id]?.effects.some((e) => e.k === 'raise')))) st.cast.preload([THRALL_SPRITE]);
    }
    LIGHT.uTime.value = time;
    LIGHT.uDark.value.set(0, 8, 0, 0);
    // nothing in the Ring thins away in front of a hero. (The campaign's see-through, which dithers a wall between the
    // camera and its hero, was left pointing at wherever that hero last stood: in the Ring that spot fell on the left
    // entry, whose wall and block tops were drawn half in a crawling dither. The owner: "the glitched wall on the
    // sand map and ... the glitched top of the column, they keep jittering".)
    LIGHT.uSee.value.set(0, 0, 0, 0);
    LIGHT.uNight.value.set(1, 1, 1, 0);
    const grade = SKINS[this.map.theme].grade;
    LIGHT.uGrade.value.set(grade[0], grade[1], grade[2], grade[3]);
    CROWD.uCheer.value = Math.max(0, CROWD.uCheer.value - dt * 0.32);
    const dress = this.dress;
    if (dress?.gearStand) {
      dress.gearStand.begin();
      for (const g of dress.gears) dress.gearStand.put(g.x, g.y, g.z, 0, g.r, g.r, g.r, 1, 1, 1, 0, 0, time * g.speed);
      dress.gearStand.end();
    }
    const me = myId === null ? null : (m.fighters[myId] ?? null);
    let cx = ARENA_W / 2;
    const cy = RING_LOOK_Y;
    // someone who has fallen while their side fights on watches the whole ring: the camera goes to its middle and steps
    // back until all of it is in the picture (the owner: "when i die but my partner is alive, the camera should center
    // and zone out a bit so i can look at everything")
    const watching = !!me && me.dead && m.phase === 'fight';
    const push = watching ? this.back : 1;
    st.push += (push - st.push) * (dt > 0 ? 1 - Math.exp(-dt * 2.4) : 1);
    // (across only: up and down, the ring's whole height is in the picture already)
    if (this.follow && me && !watching) {
      const halfW = st.spanX * TILE * 0.95;
      const at = this.thumbs ? thumbsX(m, me) : me.x;
      cx = ARENA_W <= halfW * 2 ? ARENA_W / 2 : Math.max(halfW - 24, Math.min(ARENA_W - halfW + 24, at));
    }
    const ease = 1 - Math.exp(-dt * 5);
    this.cx += (cx - this.cx) * (dt > 0 ? ease : 1);
    this.cy += (cy - this.cy) * (dt > 0 ? ease : 1);
    // (the camera glides: it is not held to whole pixels. That was tried against a shimmer that turned out to be
    // something else, the campaign's see-through and brick laid over a furnace's fire, and on a phone, whose picture is
    // drawn at 1.7 pixels to the point and not its screen's 3, a step of one screen pixel is not a whole drawn one)
    this.quakeT = Math.max(0, this.quakeT - dt);
    const jolt = this.quakeT > 0 ? this.quake * (this.quakeT / 0.22) : 0;
    if (this.quakeT <= 0) this.quake = 0;
    st.look((this.cx + (jolt ? Math.sin(time * 91) * jolt : 0)) * UNIT, (this.cy + (jolt ? Math.cos(time * 77) * jolt * 0.7 : 0)) * UNIT);
    const cast = st.cast;
    cast.begin();
    // what stands on the ring's floor throws its shadow too: every pillar and stone, as the fighters do
    for (const p of this.map.pillars) cast.shadow(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h) * 0.58);
    this.drawn.clear();
    for (const f of m.fighters) {
      if (f.pet) {
        this.thrall(m, f, dt);
        continue;
      }
      const l = looks[f.id];
      if (!l) continue;
      // (one of the other side in the shroud is not there at all; one of your own is a shade of themself)
      if (me && m.unseen(f, me) && !f.dead) continue;
      this.fighter(f, l, dt, time, m.hidden(f) && !f.dead);
    }
    cast.end();
    st.fx.begin();
    spells?.(st.fx);
    st.fx.end();
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

  private fighter(f: Fighter, l: RingFighterLook, dt: number, time: number, shade = false): void {
    const cast = this.stage.cast;
    let s = this.motions.get(f.id);
    if (!s) {
      s = { m: new Motion(), turn: turnOf(Math.atan2(f.dirY, f.dirX)), swing: 0, clip: 'chop', fresh: false, time: 0.5, lunge: 0, hurt: 0, hard: false };
      this.motions.set(f.id, s);
    }
    const moving = Math.hypot(f.vx, f.vy) > 1;
    const want = turnOf(Math.atan2(f.dirY, f.dirX));
    let d = (want - s.turn) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    s.turn += d * (1 - Math.exp(-dt * 14));
    s.swing = Math.max(0, s.swing - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const hexed = f.auras.some((a) => a.ab === 'm-toad' && a.cc === 'incap');
    const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
    const stunned = f.auras.some((a) => a.cc === 'stun' || a.cc === 'incap');
    const frozen = f.auras.some((a) => a.kind === 'immune' && a.still);
    if (f.dead) s.m.set('die', false);
    else if (f.cast) s.m.set(f.cast.channel ? 'channel' : 'cast');
    else if (s.swing > 0) {
      // (from where the blow is in its clip, not the lift before it: strike.ts)
      s.m.set(s.clip, false, 0.06, s.fresh);
      if (s.fresh) s.m.t = strikeOf(cast.wardrobe?.medium, s.clip).from;
      s.fresh = false;
    }
    else if (stunned) s.m.set('hit');
    // (struck: they flinch, unless they are in the middle of a blow or a spell of their own)
    else if (s.hurt > 0.1 && !moving) s.m.set('hit', false, 0.05);
    else if (moving) s.m.set('run');
    else s.m.set('idle');
    if (frozen) dt = 0;
    s.m.advance(dt);
    if (!shade) cast.shadow(f.x, f.y, f.dead ? 10 : 8);
    if (hexed) {
      this.drawn.set(f.id, { x: f.x, y: f.y });
      cast.creature('slime', f.x, f.y, s.turn, 16, 'idle', time, true);
      return;
    }
    const lift = gale ? (10 + Math.sin(time * 6) * 2) * UNIT : 0;
    // a blow carries its maker into it and back: a step toward whoever it is for, out at the strike and home after.
    // And whoever is struck flashes white and is rocked a little where they stand
    const u = s.swing > 0 && s.time > 0 ? 1 - s.swing / s.time : 1;
    const reach = s.lunge > 0 && !f.dead ? s.lunge * Math.sin(Math.PI * Math.min(1, u * 1.35)) : 0;
    const rock = s.hurt > 0 && !f.dead ? Math.sin(s.hurt * 60) * (s.hard ? 1.6 : 0.9) * (s.hurt / 0.26) : 0;
    const flash = s.hurt > 0 && !f.dead ? Math.min(1, s.hurt / 0.26) * (s.hard ? 0.85 : 0.6) : 0;
    const bx = f.x + f.dirX * reach + rock;
    const by = f.y + f.dirY * reach;
    this.drawn.set(f.id, { x: bx, y: by });
    cast.person(l.look, l.held, shieldOf(f.cls as ClassId), bx, by, s.turn, s.m, { lift, flash, alpha: f.dead ? 0.85 : shade ? 0.42 : 1, tint: frozen ? [0.75, 0.92, 1.25] : shade ? SHADE : undefined });
  }

  /** Where a fighter's body was drawn this frame (their spot, if it hasn't been): for what goes about on them. */
  bodyAt(f: { id: number; x: number; y: number }): { x: number; y: number } {
    return this.drawn.get(f.id) ?? f;
  }

  /**
   * One of the warlock's ashbound dead: a skeleton soldier gone the grey-violet of the gloam, clawing its way up out of
   * the ground when it is called, running at its master's foe, cutting at them with every claw the rules land (a cut,
   * then a slice back, each with a step into it), and sinking back into the ground when it falls or its time is up.
   */
  private thrall(m: Match, f: Fighter, dt: number): void {
    const pet = f.pet!;
    const cast = this.stage.cast;
    const gone = f.dead ? m.clock - (pet.end ?? m.clock) : 0;
    if (gone > THRALL_SINK) {
      this.motions.delete(f.id);
      this.blows.delete(f.id);
      return;
    }
    let s = this.motions.get(f.id);
    if (!s) {
      s = { m: new Motion(), turn: turnOf(Math.atan2(f.dirY, f.dirX)), swing: 0, clip: 'idle', fresh: false, time: 0, lunge: 0, hurt: 0, hard: false };
      this.motions.set(f.id, s);
      // (one that comes back from a saved match has struck before: only the blows from here on are drawn)
      this.blows.set(f.id, pet.hits);
    }
    let d = (turnOf(Math.atan2(f.dirY, f.dirX)) - s.turn) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    s.turn += d * (1 - Math.exp(-dt * 12));
    s.swing = Math.max(0, s.swing - dt);
    s.hurt = Math.max(0, s.hurt - dt);
    const held = f.auras.some((a) => a.cc === 'stun' || a.cc === 'incap');
    const moving = Math.hypot(f.vx, f.vy) > 1;
    const pose = thrallPose(this.blows.get(f.id) ?? 0, pet.hits, s.swing > 0, f.dead, held, moving);
    if (pose.blow && pose.clip) {
      // a new blow: from where its strike begins, not the lift before it
      s.m.set(pose.clip, false, 0.06, true);
      s.m.t = cast.strike(THRALL_SPRITE, pose.clip).from;
      s.clip = pose.clip;
      s.swing = THRALL_BLOW_T;
      s.time = THRALL_BLOW_T;
      s.lunge = THRALL_LUNGE;
    } else if (pose.clip) s.m.set(pose.clip, pose.loop, 0.14);
    this.blows.set(f.id, pet.hits);
    s.m.advance(dt);
    // up out of the ground over its first half second; back into it once it is done
    const age = pet.max - pet.life;
    const rise = f.dead ? Math.min(1, gone / THRALL_SINK) * 0.9 : Math.max(0, 1 - age / 0.5);
    const flash = s.hurt > 0 && !f.dead ? Math.min(1, s.hurt / 0.26) * 0.7 : 0;
    // a blow carries it a step toward whoever it is for, out at the strike and home after
    const u = s.swing > 0 && s.time > 0 ? 1 - s.swing / s.time : 1;
    const reach = s.swing > 0 && !f.dead ? s.lunge * Math.sin(Math.PI * Math.min(1, u * 1.35)) : 0;
    const bx = f.x + f.dirX * reach;
    const by = f.y + f.dirY * reach;
    this.drawn.set(f.id, { x: bx, y: by });
    cast.shadow(bx, by, f.dead ? 5 : 6);
    cast.creature(THRALL_SPRITE, bx, by, s.turn, THRALL_H, s.m.clip, s.m.t, false, { motion: s.m, rise, flash, tint: ASHBOUND, feet: true, alpha: f.dead ? Math.max(0, 1 - gone / THRALL_SINK) : 1 });
  }

  /** Something to shout about. */
  cheer(k = 1): void {
    CROWD.uCheer.value = Math.max(CROWD.uCheer.value, k);
  }

  /**
   * A fighter uses an ability (the 'ab' event): a move that says what it is. A plain blow is a cut, the next one a
   * slice from the other side; a burst blow comes down from overhead with a long step in; what stuns is a bash with
   * the weight behind it, what cuts a cast off a short jab, a charge ends on the point; what bleeds is drawn across;
   * a shout is thrown out from the chest, a guard is a guard, a trap is set down by hand, a thrown weapon is thrown,
   * an arrow drawn, a spell cast, and a super is the biggest thing its class can do. (`starting`: the start of a
   * cast, which its own casting pose shows instead.) Before, every blow was one of two chops for 0.4 seconds and
   * every self-cast the same flick of the hand: the owner, "attacks seem irrelevant and not meaningful".
   */
  swing(id: number, abId: string, starting = false): void {
    const ab = ABILITIES[abId];
    const s = this.motions.get(id);
    // (the trinket is no swing)
    if (!s || !ab || starting || ab.id === 'trinket') return;
    const has = (k: string): boolean => ab.effects.some((e) => e.k === k);
    const holds = (cc: string): boolean => ab.effects.some((e) => (e.k === 'cc' || e.k === 'trap') && e.cc === cc);
    const melee = ab.range > 0 && ab.range <= 40;
    const archer = ab.cls === 'ranger' && (ab.school === 'physical' || ab.school === 'nature') && ab.aim === 'enemy' && !melee;
    let clip = 'cast';
    let time = 0.5;
    let lunge = 0;
    // a Gloamknight fights two-handed, and heavily: every blow has its own shape and a long step into it
    const gloam: Record<string, [string, number, number]> = {
      'g-cleave': [s.clip === 'chop2' ? 'slice' : 'chop2', 0.62, 13],
      'g-reap': ['spin', 0.85, 10],
      'g-sever': ['stab', 0.42, 14],
      'g-lunge': ['stab', 0.55, 6],
      'g-hand': ['summon', 0.75, 0],
      'g-chain': ['throw', 0.62, 0],
      'g-ward': ['block', 0.7, 0],
      'g-mantle': ['block', 0.7, 0],
      // (and out of the dark: a quick blade, an ambush that comes down hard, a step that leaves no swing)
      'g-knife': ['stab', 0.4, 12],
      'g-ambush': ['slice', 0.6, 15],
      'g-super': ['spin', 1, 16],
      'g-super2': ['slice', 0.8, 0],
      // (the warlock's dead are called up by the hands, as his were)
      'k-raise': ['summon', 0.85, 0],
    };
    const own = gloam[ab.id];
    if (own) [clip, time, lunge] = own;
    else if (ab.super) {
      // the class's great moment: held longer than anything else it does
      if (ab.aim === 'near') [clip, time] = ['spin', 0.95];
      else if (archer) [clip, time] = ['bow', 0.8];
      else if (melee) [clip, time, lunge] = ['chop2', 0.9, 16];
      else [clip, time] = [ab.aim === 'friend' ? 'cheer' : 'cast', 0.8];
    } else if (ab.aim === 'near') {
      if (holds('fear') && !has('dmg')) [clip, time] = ['taunt', 0.7];
      else [clip, time] = ['spin', 0.7];
    } else if (has('trap')) [clip, time] = ['pickup', 0.6];
    else if (archer) [clip, time] = ['bow', 0.55];
    else if (melee && ab.aim === 'enemy') {
      if (has('charge')) [clip, time, lunge] = ['stab', 0.5, 4];
      else if (holds('stun')) [clip, time, lunge] = ['bash', 0.62, 11];
      else if (has('interrupt')) [clip, time, lunge] = ['punch', 0.42, 9];
      else if (ab.role === 'burst') [clip, time, lunge] = ['chop2', 0.72, 13];
      else if (has('dot') || has('antiheal')) [clip, time, lunge] = ['slice', 0.6, 9];
      // (blow after blow, the arm changes: a cut, then a slice back the other way)
      else [clip, time, lunge] = [s.clip === 'chop' ? 'slice' : 'chop', 0.52, 8];
    } else if (ab.school === 'physical' && ab.aim === 'enemy') [clip, time] = ['throw', 0.58];
    else if (ab.aim === 'self') {
      if (has('guard') || has('absorb') || has('immune') || has('reflect')) [clip, time] = ['block', 0.65];
      else if (has('fury') || has('speed') || has('price')) [clip, time] = ['taunt', 0.65];
      else if (has('heal') || has('hot')) [clip, time] = ['use', 0.6];
      else [clip, time] = ['cast', 0.45];
    } else if (ab.aim === 'friend') [clip, time] = [has('dispel') ? 'interact' : 'cast', 0.52];
    else if (holds('fear')) [clip, time] = ['taunt', 0.62];
    else if (ab.cast > 0) time = 0.4;
    s.clip = clip;
    s.swing = time;
    s.time = time;
    s.lunge = lunge;
    s.fresh = true;
  }

  /** A heavy blow shakes the picture a little (not for those who asked for less motion). */
  shake(amount: number): void {
    if (this.still) return;
    this.quake = Math.max(this.quake, amount);
    this.quakeT = 0.22;
  }

  /** A fighter is struck (a blow that took a real bite): they flash and flinch; harder for a heavy one. */
  hurt(id: number, hard: boolean): void {
    const s = this.motions.get(id);
    if (!s) return;
    s.hurt = 0.26;
    s.hard = hard;
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

  /** Where a spot on the ground falls on the layer being drawn, in its own pixels. */
  spot(x: number, y: number, h = 0): { x: number; y: number } {
    const a = this.stage.project(x, y, h);
    return { x: a.x * this.k, y: a.y * this.k };
  }

  up(x: number, y: number, h = 0): void {
    const st = this.stage;
    const a = st.project(x, y, h);
    const b = st.project(x + TILE, y, h);
    const s = ((b.x - a.x) / TILE) * this.k;
    this.g.setTransform(s, 0, 0, s, a.x * this.k - s * x, a.y * this.k - s * y);
  }

  dispose(): void {
    for (const s of this.gates) s.dispose();
    this.dress?.stands.forEach((s) => s.dispose());
    this.dress?.gearStand?.dispose();
    if (this.floor) disposeFloor(this.floor);
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
