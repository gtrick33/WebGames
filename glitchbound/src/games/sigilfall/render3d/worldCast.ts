import { damp } from '../core/math';
import { mountDef, riddenMount } from '../progress/wardrobe';
import { NPCS } from '../data/quests';
import { passerbyLook, TOWNSFOLK_LOOKS } from '../render/art/townsfolk';
import type { HeroLook } from '../render/art/hero';
import { npcLookOf } from '../render/sprites';
import { bossHidden } from '../sim/boss';
import { hasStatus } from '../sim/combat';
import { TILE } from '../sim/map';
import { STORY_ARRIVE, STORY_FADE } from '../sim/pets';
import { SUMMON_TIME, type World } from '../sim/world';
import type { ClassId } from '../data/types';
import type { Enemy, Ghost, NpcActor, Pet } from '../sim/types';
import type { FolkJob } from '../sim/folk';
import type { CritterKind } from '../sim/critters';
import { heightFromRadius, Motion, PERSON_H, type Cast, type ClipFade, type Colossus } from './cast';
import type { Held } from './dress';
import { kitOf } from './kits';
import { inView } from './land';
import { shapeOf } from './mountLook';
import { chained, moveOf, type Move } from './moves';
import { strikeOf, type Strike } from './strike';
import { LIGHT, type RigAnim } from './toon';
import { dangerColor } from '../render/effects';

/** How dark the land is now: a night come over it, or a room's own dim light (0 in daylight). */
const dark = (): number => Math.max(LIGHT.uNight.value.w, LIGHT.uAmb.value.w * 0.8);

/** A facing in the rules (an angle on the map) as a turn about the vertical. */
export const turnOf = (a: number): number => Math.atan2(Math.cos(a), Math.sin(a));

/**
 * What a ward that is a thing is drawn as, how tall (world px) and how far east of where it stands (`dx`). A walled
 * town's gate (data/zonegen.ts, the 'court' town) is four tiles wide between its towers, its middle half a tile east of
 * the gate's own tile: the gate is drawn there, at its own size (2.9 tiles, its battlements level with the wall's).
 */
const WARDS: Record<string, { m: string; h: number; dx?: number }> = {
  gate: { m: 'built_town_gate', h: 2.9 * TILE, dx: TILE / 2 },
  stone: { m: 'statue_obelisk', h: 34 },
  boat: { m: 'p_boat', h: 22 },
  wagon: { m: 'wagon', h: 24 },
  // (Lantern Hill's great lamp: it was the packs' little standing lantern, no bigger than the candles round it)
  lantern: { m: 'built_great_lamp', h: 3.6 * TILE },
};
/** How far off a colossus is drawn (world pixels from the hero, past its own height). */
const COLOSSUS_SEEN = 620;
/** A hero of old in stone: the same armor everyone knows, in one gray, a sword at their side and a shield on their arm. */
const STONE = { style: 'plate', mat: 'mail', tint: '#a8a8a8', r: 'rare' } as const;
const STATUE_LOOK = {
  skin: '#b4b4b4',
  hair: '#a0a0a0',
  hairStyle: 'short',
  head: { ...STONE, style: 'helm' },
  chest: STONE,
  legs: { ...STONE, style: 'greaves' },
  hands: { ...STONE, style: 'gauntlets' },
  feet: { ...STONE, style: 'sabatons' },
  quiver: null,
  cape: '#a0a0a0',
} as unknown as HeroLook;
const STATUE_SWORD: Held = { kind: 'sword', tint: '#b0b0b0' };
/** A war camp's own soldiers (sim/folk.ts): the garrison's mail and blue cloak, a sword and shield for those on guard. */
const SOLDIER_LOOK = TOWNSFOLK_LOOKS['highwall-soldier']!;
const SOLDIER_SWORD: Held = { kind: 'sword', tint: '#c8ccd4' };
/** What the people at their posts hold and are seen doing (sim/folk.ts FolkJob; a clip of the people's rig, or their own standing). */
const WORK: Record<FolkJob, { held: Held | null; clip?: string }> = {
  guard: { held: SOLDIER_SWORD },
  vendor: { held: null },
  smith: { held: { kind: 'hammer', tint: '#8a8690' }, clip: 'chop' },
  farmer: { held: { kind: 'spear', tint: '#a8824e' }, clip: 'work' },
  woodcutter: { held: { kind: 'axe', tint: '#9a9aa4' }, clip: 'chop' },
  hunter: { held: { kind: 'bow', tint: '#8a6238' } },
  fisher: { held: { kind: 'staff', tint: '#a8824e' } },
  traveler: { held: null, clip: 'sit' },
  pilgrim: { held: null, clip: 'channel' },
  herder: { held: { kind: 'staff', tint: '#a8824e' } },
};
/** An animal of a place (sim/critters.ts): its kit, how tall it stands (world px) and its shadow. */
const CRITTER: Record<CritterKind, readonly [string, number, number]> = {
  chicken: ['chicken', 15, 5],
  sheep: ['farm-sheep', 19, 8],
  pig: ['farm-pig', 15, 8],
  dog: ['farm-dog', 17, 7],
  cat: ['cat', 11, 5],
  horse: ['farm-horse', 38, 11],
  deer: ['stag', 34, 9],
};
const ECHOES = new Set(['echo-of-ysane', 'echo-of-ysane-mere', 'echo-of-ysane-quay', 'echo-of-the-children']);
const ECHO_TINT = [0.74, 0.88, 1.3] as const;
/** A memory of summer: the Hallow King's family, coming to him in his last hour (World.kin). */
const SUMMER = [1.35, 1.15, 0.8] as const;
/** Bone-steel poured white-hot: Ossa's likenesses of the hero (sim/patterns/molten-throne.ts). */
const MOLTEN = [1.85, 0.95, 0.48] as const;
const WARD_LOOKS = new Set(['door', 'gate', 'stone', 'boat', 'wagon', 'lantern']);

const shortest = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

interface FoeAnim {
  state: string;
  since: number;
  /** Where it's drawn, a touch behind where the rules have it: a shove from the crowd is a drift, not a twitch. */
  x: number;
  y: number;
  /** Which way it faces, turning as a body turns. */
  turn: number;
  /** How fast it's really going, world pixels a second. */
  speed: number;
  /** How far through its walk: its feet keep time with the ground. */
  walk: number;
  /** The clip it's in, and the one it's coming out of. */
  clip: string;
  t: number;
  loop: boolean;
  from: ClipFade | null;
  /** Its wind-up ended in a blow: what follows shows the blow landing and its follow-through. */
  struck: boolean;
  /** A boss's pattern as last seen (which, and how far through its steps), and when its last blow began. */
  pattern: object | null;
  step: number;
  blowAt: number;
  /** When it last flinched from a hit. */
  flinchAt: number;
  hurt: boolean;
}

/** How fast a figure of a person's height covers the ground at one times its clip's own rate. */
const WALKS_AT = 34;
const RUNS_AT = 84;
/** How long one clip takes to fade into the next. */
const CLIP_FADE = 0.14;
/** Further than this in a frame is a jump (a blink, a pull), not a walk. */
const SNAP = 40;
/** The legs keep time with the ground: how fast a clip runs for how fast someone's going, and how big they are. */
const stride = (clip: string, speed: number, h: number): number => {
  const natural = (clip === 'run' ? RUNS_AT : WALKS_AT) * (h / PERSON_H);
  return Math.max(0.55, Math.min(1.7, speed / natural));
};

/** A whirlwind's blade is held where the spin clip has it widest (seconds past the start of its turn), and goes round this fast. */
const WHIRL_POSE = 0.34;
const WHIRL_RATE = 13;
/** How much of a drawing clip a wound-up shot shows (the rest is the hold at full draw). */
const WIND_SHOWN = 0.8;
/** How fast an enemy's blow plays once it lands, how long a boss takes to raise its weapon, how long a flinch is. */
const BLOW_RATE = 1.15;
const BOSS_LIFT = 0.45;
const FLINCH = 0.22;
/** The least time between two flinches, and between two of a boss's blows. */
const FLINCH_EVERY = 0.7;
/** How long a foe struck is knocked back along the blow and comes back (seconds), and how far at the hardest (world px). */
const RECOIL = 0.16;
const RECOIL_PX = 5;
const BLOW_EVERY = 0.5;
const bossDazed = (e: Enemy): boolean => !!e.boss && (e.boss.dazed > 0 || e.boss.dying > 0 || e.boss.shift > 0);
/** A druid's beast makes every blow with its one attack. */
const BEAST_BLOW: Move = { clip: 'chop', rate: 1.2, lunge: 0.2 };

/** Where the blow is in a move's clip: measured (strike.ts), unless the move says. */
function strikeFor(rig: RigAnim | null | undefined, move: Move): Strike {
  const s = strikeOf(rig, move.clip);
  if (move.from === undefined) return s;
  const to = move.to ?? s.to;
  return { lift: move.from, from: move.from, hit: Math.min(to, move.from + 0.2), to };
}

const FROZEN = [0.62, 0.86, 1.25] as const;
const CHILLED = [0.82, 0.93, 1.12] as const;


/** Everyone in the rules, told to the cast each frame. */
/** The middle of the picture and half its reach over the ground, in tiles (render3d/stage.ts spanX, spanZ). */
export interface CastView {
  x: number;
  z: number;
  spanX: number;
  spanZ: number;
}
export class WorldCast {
  private readonly foes = new Map<number, FoeAnim>();
  private readonly hero = new Motion();
  private readonly mountMotion = new Motion();
  private heroTurn = 0;
  private readonly ghosts = new Map<number, { m: Motion; turn: number; n: number; chain: number; act: { move: Move; strike: Strike; t: number; fresh: boolean } | null }>();
  private readonly pets = new Map<number, { m: Motion; turn: number; x: number; y: number; actT: number; horse?: Motion }>();
  private readonly walkers = new WeakMap<object, Motion>();
  private readonly turned = new WeakMap<object, number>();

  reset(): void {
    this.foes.clear();
    this.ghosts.clear();
    this.pets.clear();
  }

  /** A turn eased toward where someone should face. */
  /** How each of the story's people is moving: their clip, where they were a frame ago, the gesture they are on. */
  private readonly acting = new WeakMap<NpcActor, { m: Motion; x: number; y: number; heading: number; still: number; act: number; over: number }>();

  private easeTurn(who: object, want: number, rate: number, dt: number): number {
    const now = this.turned.get(who) ?? want;
    const next = damp(now, shortest(now, want), rate, dt);
    this.turned.set(who, next);
    return next;
  }

  sync(cast: Cast, w: World, dt: number, time: number, o: { look: HeroLook; weapon: Held; folk: number; landOnly: boolean; view?: CastView; statues?: readonly { x: number; y: number; h: number; lift: number; tint: readonly [number, number, number] }[]; colossi?: readonly Colossus[] }): void {
    // who the picture can show: within the view and the same margins the land keeps standing (render3d/land.ts update)
    const v = o.view;
    const shown = v ? (x: number, y: number): boolean => inView(v.x, v.z, v.spanX, v.spanZ, x / TILE, y / TILE) : (): boolean => true;
    for (const s of o.statues ?? []) cast.person(STATUE_LOOK, STATUE_SWORD, true, s.x, s.y, 0.2, { clip: 'idle', t: 0.2, loop: false }, { h: s.h, lift: s.lift, tint: s.tint });
    for (const c of o.colossi ?? []) if (Math.hypot(c.x * TILE - w.player.x, c.z * TILE - w.player.y) < COLOSSUS_SEEN + c.h * TILE) cast.colossus(c);
    this.syncHero(cast, w, dt, time, o.look, o.weapon, o);
    // what a boss fight floats in the air (Ilvane's stones), a shadow under each
    for (const f of w.floaters) {
      cast.shadow(f.x, f.y, f.h * 0.5);
      cast.prop(f.m, f.x, f.y, f.h, f.rot, f.lift / TILE, f.tint);
    }
    // what a boss fight casts of the hero (Ossa's likenesses): the hero in white-hot bone-steel, walking where they walked
    for (const [i, l] of w.likenesses.entries()) {
      cast.shadow(l.x, l.y, 8);
      cast.person(o.look, o.weapon, shieldOf(w.hero.cls), l.x, l.y, l.face, { clip: Math.hypot(l.vx, l.vy) > 8 ? 'run' : 'idle', t: time + i * 0.37, loop: true }, { alpha: 0.92, tint: MOLTEN });
    }
    // the people of a memory walking the hall (the Hallow King's queen and children, in his summer hour): echoes lit gold
    for (const k of w.kin) {
      const look = npcLookOf(k.look);
      if (!look) continue;
      cast.shadow(k.x, k.y, 7);
      cast.person(look, null, false, k.x, k.y, turnOf(k.face), { clip: 'walk', t: time + k.x * 0.1, loop: true }, { alpha: Math.min(1, (w.time - k.since) / 0.8) * 0.92, lift: 0.12 + Math.sin(time * 1.6 + k.x) * 0.04, tint: SUMMER });
    }
    // (only those: a land's whole bestiary went to the card every frame wherever it stood, six to eleven thousand
    // triangles a creature and each drawn twice for its outline. Highwall March's 173 made 2.7 million triangles a
    // frame with none of them on the screen. A boss is always drawn: the camera leans to it from a long way off)
    for (const e of w.enemies) {
      if (!e.boss && !shown(e.x, e.y)) {
        this.foes.delete(e.id);
        continue;
      }
      this.syncFoe(cast, e, w, dt, time);
    }
    for (const n of w.npcs) this.syncNpc(cast, n, w, dt, time, Math.min(1, (w.time - (n.since ?? -Infinity)) / 0.8));
    for (const n of w.leftNpcs) {
      const a = 1 - (w.time - n.left) / (NPCS[n.id]?.down ? 3.2 : 1.2);
      if (a > 0) this.syncNpc(cast, n, w, dt, time, a);
    }
    for (const c of w.critters) {
      if (c.alpha <= 0 || !shown(c.x, c.y)) continue;
      const [sprite, tall, shade] = CRITTER[c.kind];
      const speed = Math.hypot(c.vx, c.vy);
      // (it faces the way it goes: an animal running off from an attack ran sideways when it ran north or south)
      const turn = speed > 4 ? Math.atan2(c.vx, c.vy) : c.face < 0 ? -Math.PI / 2 : Math.PI / 2;
      if (c.alpha > 0.5) cast.shadow(c.x, c.y, shade);
      cast.creature(sprite, c.x, c.y, this.easeTurn(c, turn, 10, dt), tall, speed > 40 ? 'run' : speed > 4 ? 'walk' : 'idle', time + c.x * 0.1, true, { alpha: c.alpha });
    }
    if (o.folk > 0.02) {
      for (const f of w.folk) {
        if (!shown(f.x, f.y)) continue;
        cast.shadow(f.x, f.y, 7);
        let m = this.walkers.get(f);
        if (!m) {
          m = new Motion();
          m.t = f.look * 0.37;
          this.walkers.set(f, m);
        }
        m.set(f.moving ? 'walk' : 'idle', true, 0.2);
        m.advance(f.moving ? dt * stride('walk', f.speed, PERSON_H) : dt);
        if (f.soldier) cast.person(SOLDIER_LOOK, f.posted ? SOLDIER_SWORD : null, !!f.posted, f.x, f.y, turnOf(f.a), m, { alpha: o.folk });
        else if (f.posted && f.job) {
          // at their work: the tool of their trade in hand, and seen at it (a smith's hammer falls, travelers sit)
          const work = WORK[f.job];
          cast.person(passerbyLook(f.look, w.region.theme), work.held, false, f.x, f.y, turnOf(f.a), work.clip ? { clip: work.clip, t: time + f.look * 0.61, loop: true } : m, { alpha: o.folk });
        } else cast.person(passerbyLook(f.look, w.region.theme), null, false, f.x, f.y, turnOf(f.a), m, { alpha: o.folk });
      }
    }
    for (const c of w.chests) {
      const rare = c.tier === 'epic';
      cast.shadow(c.x, c.y, 8);
      cast.prop(rare ? 'chest_large_gold' : 'chest', c.x, c.y, rare ? 15 : 13, 0, 0, c.open ? [0.55, 0.5, 0.5] : undefined);
    }
    for (const s of w.spores) cast.prop('mushroom_redGroup', s.x, s.y, s.ripe ? 13 : 7, 0, 0, s.fuse > 0 && Math.floor(time * 10) % 2 === 0 ? [1.6, 1.3, 1.3] : undefined);
    for (const d of w.drops) {
      const hop = ((d.z ?? 0) + Math.sin(time * 4 + d.x) * 0.6 + 1.3) / TILE;
      if (d.kind === 'gold') cast.prop('coin', d.x, d.y, 4.5, time * 4 + d.x, hop);
      else if (d.kind === 'potion') cast.prop('w_potion_medium_red', d.x, d.y, 10, time, hop);
      else if (d.kind === 'orb') cast.prop('w_potion_small_red', d.x, d.y, 8, time, hop);
      else if (d.kind === 'shard') cast.prop('stone_tallA', d.x, d.y, 11, time * 1.5, hop, [1.2, 0.5, 1.2]);
      // a quest's thing: a small coffer of it, gold, turning (its light and its name are drawn over it: render/effects.ts)
      else if (d.kind === 'quest') cast.prop('chest_gold', d.x, d.y, 8, time * 1.6 + d.x, hop + 0.06, [1.25, 1.15, 0.8]);
    }
    for (const pet of w.pets) this.syncPet(cast, pet, w, dt, time);
    for (const gh of w.coop?.ghosts ?? []) if (gh.seen > 0) this.syncGhost(cast, gh, dt, time);
  }

  private syncHero(cast: Cast, w: World, dt: number, time: number, look: HeroLook, held: Held, o0: { landOnly: boolean }): void {
    const p = w.player;
    const m = this.hero;
    const speed = Math.hypot(p.vx, p.vy);
    const moving = speed > 10;
    const mount = p.riding ? mountDef(p.riding) : undefined;
    // carried across the ground by a skill (a charge, a leap), not rolling out of the way
    const carried = !!p.dash && !p.dash.dodge;
    const formRig = p.form ? cast.rigOf(p.form) : null;
    // a skill made since the last frame: the body starts its move (moves.ts)
    if (p.actN !== this.lastActN) {
      this.lastActN = p.actN;
      this.act = null;
      if (p.actKind && !p.dead) {
        if (chained(p.actSkill)) {
          this.chain = time - this.chainAt < 1.4 ? this.chain + 1 : 0;
          this.chainAt = time;
        }
        const move = p.form ? BEAST_BLOW : moveOf(w.hero.cls, p.actSkill, p.actKind, this.chain, p.actBig);
        // (the rules' own third swing ends the chain: the next swing starts it again)
        if (p.actBig) this.chain = -1;
        this.act = { move, strike: strikeFor(p.form ? formRig : cast.wardrobe?.medium, move), t: 0, dash: carried ? Math.max(0.05, p.dash!.t) : 0, fresh: true };
      }
    }
    // how far through it they are: held at the top of the lift or the end of the blow while a skill carries them,
    // then on; over when the follow-through is, or as soon as the blow has landed for someone already on the move
    let act = this.act;
    let at = 0;
    if (act) {
      const s = act.strike;
      if (!carried) act.t += dt * (act.move.rate ?? 1);
      // (a blade carried up comes down on arriving; one carried out, or just along, has landed and is drawn back)
      const held = act.move.carried === 'up' ? s.from : s.hit;
      at = carried ? held : (act.dash ? held : s.from) + act.t;
      if (p.dead || at >= s.to || (moving && !carried && !p.windup && at >= s.hit + 0.05)) act = this.act = null;
    }
    // which way they face: where the blow goes, else where they walk
    let want = this.heroTurn;
    if (p.casting) want = turnOf(p.casting.angle);
    else if (act || (p.actKind !== null && p.actT > 0) || p.windup) want = turnOf(p.actAngle);
    else if (moving) want = Math.atan2(p.vx, p.vy);
    // (in a scene they turn to whoever is speaking to them)
    else if (w.scene && w.scene.turns.hero !== undefined) want = w.scene.turns.hero;
    else if (!p.form) want = this.heroTurn;
    this.heroTurn = damp(this.heroTurn, shortest(this.heroTurn, want), w.scene ? 7 : 16, dt);
    const blink = p.iframe > 0 && !p.dash && dt > 0 && Math.floor(time * 20) % 2 === 0;
    // (safe for a moment: they shine rather than dissolve)
    const alpha = 1;
    const flash = p.flash > 0 ? 0.75 : blink ? 0.4 : 0;
    const inSaddle = !!mount && cast.mountReady(mount);
    // the mount they'd call is fetched ahead, so it's there the moment they're up on it
    // (the one riddenMount gives: their own, or one from the shop while it's theirs)
    const called = !mount ? mountDef(riddenMount(w.hero) ?? '') : undefined;
    if (called) cast.mountReady(called);
    // calling it: a quick summoning cast, no animal beside them (render/effects.ts draws the swirl, the rules the flash)
    const calling = !!called && p.summon > 0 && !p.dead && !p.form;
    // where in its clip the body is held this frame (unset: the clip runs on by itself)
    let pin: number | null = null;
    // the whole body turned, stepped and lifted by the move
    let spun = 0;
    let step = 0;
    let lift = 0;
    const whirling = !!p.channel && p.channel.target === undefined;
    const beast = p.form ? this.formMotion : null;
    const body = beast ?? m;
    if (p.dead) body.set('die', false);
    else if (inSaddle) m.set('ride');
    // a guard, not a step (the Gloamknight's Stand Fast): the blade and the arm up, feet planted
    else if (p.guard > 0 && !beast) m.set('block', false, 0.06);
    else if (p.dash?.dodge) body.set(beast ? 'run' : 'dodge', !!beast);
    else if (whirling && !beast) {
      // a whirlwind: the blade held out at arm's length, and all of them going round
      m.set('spin', false, 0.08);
      pin = strikeOf(cast.wardrobe?.medium, 'spin').from + WHIRL_POSE;
      spun = time * WHIRL_RATE;
    } else if (p.channel && !beast) m.set('channel');
    // a spell with a cast time: hands up, staff forward, held while the bar fills (the release is its own move)
    else if (p.casting && !beast) m.set('channel', true, 0.12);
    else if (p.windup && !beast) {
      // a wound-up blow: the lift, taking exactly as long as the rules give it, so the weapon comes down as they strike
      const mv = moveOf(w.hero.cls, p.windup.spec.id, 'heavy', 0, false);
      const u = 1 - p.windup.t / Math.max(0.01, p.windup.total);
      if (mv.wind) {
        m.set(mv.wind, false, 0.08);
        pin = u * WIND_SHOWN;
      } else {
        const s = strikeFor(cast.wardrobe?.medium, mv);
        m.set(mv.clip, false, 0.08);
        pin = s.lift + (s.from - s.lift) * (1 - (1 - u) * (1 - u));
      }
      if (mv.hop && !mv.carried) lift = mv.hop * 0.35 * u;
    } else if (act) {
      const s = act.strike;
      body.set(act.move.clip, false, 0.06, act.fresh);
      act.fresh = false;
      pin = at;
      // into the blow and back out of it; off the ground and down as it lands
      const span = Math.max(0.01, s.hit - s.from);
      const u = Math.max(0, Math.min(1, (at - s.from) / span));
      const back = Math.max(0, Math.min(1, (at - s.hit) / Math.max(0.01, s.to - s.hit)));
      if (act.move.lunge && !act.dash) step = act.move.lunge * (at < s.hit ? u * u * (3 - 2 * u) : 1 - back * back * (3 - 2 * back));
      if (act.move.hop) {
        if (carried) {
          const a = 1 - p.dash!.t / act.dash;
          lift = act.move.hop * 4 * a * (1 - a);
        } else if (!act.dash) lift = act.move.hop * 4 * u * (1 - u);
      }
    } else if (calling) m.set('cast', false, 0.08);
    else if (moving) body.set(speed > 60 ? 'run' : 'walk');
    else body.set('idle');
    body.advance(body.clip === 'walk' || body.clip === 'run' ? dt * stride(body.clip, speed, PERSON_H) : dt);
    if (pin !== null) body.t = pin;
    // (the cast runs the length of the call, so its sweep ends as they land in the saddle)
    const castClip = cast.wardrobe?.medium.clips.cast;
    if (calling && m.clip === 'cast' && castClip) m.t = (Math.min(1, p.summon / SUMMON_TIME) * castClip.n) / castClip.fps;

    // (the step into a blow is drawn, not walked: the rules have them where they stood)
    const hx = p.x + Math.cos(p.actAngle) * step * TILE;
    const hy = p.y + Math.sin(p.actAngle) * step * TILE;
    if (inSaddle) {
      // long as the animal is long
      const sh = shapeOf(mount!).shadow;
      cast.shadow(p.x + Math.sin(this.heroTurn) * sh.ahead, p.y + Math.cos(this.heroTurn) * sh.ahead, sh.r, sh.long, this.heroTurn);
    } else cast.shadow(hx, hy, lift > 0 ? 8 - Math.min(3, lift * 4) : 8);
    if (!p.dead && !o0.landOnly) cast.ring(p.x, p.y, 11, '#22e4ff', 0.75);
    if (beast) {
      cast.creature(p.form!, hx, hy, this.heroTurn, 30, beast.clip, beast.t, beast.clip !== 'chop' && beast.clip !== 'die', { alpha, flash, motion: beast, lift });
      return;
    }
    if (inSaddle) {
      const shape = shapeOf(mount!);
      const mm = this.mountMotion;
      mm.set(moving ? (speed > shape.gallop * 0.55 ? 'run' : 'walk') : 'idle', true, 0.14);
      // (its feet keep to the ground: it runs as fast as it's going)
      mm.advance(moving ? dt * Math.max(0.6, Math.min(3, speed / (mm.clip === 'run' ? shape.gallop : shape.gallop * 0.3))) : dt);
      const saddle = cast.mount(mount!, p.x, p.y, this.heroTurn, mm, { alpha, flash });
      // (weapons put up: both hands on the reins)
      if (saddle) cast.person(look, null, false, saddle.x, saddle.y, this.heroTurn, m, { alpha, flash, h: PERSON_H * shape.rider, xray: true, hipsAt: saddle.high, tip: saddle.tip * 0.55 });
      return;
    }
    // (the animal stands from the moment they're on it, not walking up)
    if (calling) this.mountMotion.set('idle', true, 0);
    // (adrift in a weightless gallery: off the floor, bobbing)
    const adrift = w.unmoored > 0 ? w.unmoored * (0.22 + Math.sin(time * 2.4) * 0.05) : 0;
    cast.person(look, held, shieldOf(w.hero.cls), hx, hy, this.heroTurn + spun, m, { alpha, flash, xray: true, lift: adrift + lift || undefined });
  }

  /** The blow the hero's body is in the middle of. */
  private act: { move: Move; strike: Strike; t: number; dash: number; fresh: boolean } | null = null;
  private lastActN = -1;
  /** Where they are in a basic swing's chain of three, and when the last swing was. */
  private chain = 0;
  private chainAt = -9;
  /** A druid's other shape: its own body, moving as the hero's does. */
  private readonly formMotion = new Motion();

  private syncFoe(cast: Cast, e: Enemy, w: World, dt: number, time: number): void {
    if (e.boss && bossHidden(e)) return;
    if (e.dummy) {
      cast.shadow(e.x, e.y, 7);
      cast.prop('scarecrow', e.x, e.y, 26);
      return;
    }
    // a thing in a boss fight (a candle, a coffin, a post): its prop, shaking and flashing when struck, fading as it breaks
    const thing = e.def.prop;
    if (thing) {
      if (e.dead && e.deathT > 0.5) return;
      const shake = e.flash > 0 ? Math.sin(time * 70) * 1.5 : 0;
      const lit: [number, number, number] | undefined = e.flash > 0 ? [1.7, 1.6, 1.5] : thing.tint;
      cast.shadow(e.x, e.y, e.r + 1);
      const lift = thing.lift ? thing.lift + Math.sin(time * 2.2 + e.id) * 0.12 : 0;
      cast.prop(thing.m, e.x + shake, e.y, thing.h * (e.dead ? Math.max(0.2, 1 - e.deathT * 1.6) : 1), thing.lift ? time * 1.8 + e.id : 0, lift, lit);
      return;
    }
    const sprite = e.boss?.def.sprite ?? e.def.sprite;
    const kit = kitOf(sprite, e.def.id);
    const h = heightFromRadius(e.r);
    let anim = this.foes.get(e.id);
    if (!anim) {
      anim = { state: e.state, since: time, x: e.x, y: e.y, turn: turnOf(e.face), speed: 0, walk: e.id * 0.37, clip: 'idle', t: 0, loop: true, from: null, struck: false, pattern: null, step: 0, blowAt: -9, flinchAt: -9, hurt: false };
      this.foes.set(e.id, anim);
    } else if (anim.state !== e.state) {
      // (out of a wind-up into its blow: a melee blow lands and they recover, a rush begins)
      anim.struck = anim.state === 'windup' && (e.state === 'recover' || e.state === 'act');
      anim.state = e.state;
      anim.since = time;
    }
    // struck this frame: a flinch (not a boss, and never out of its own attack)
    const hurtNow = e.flash > 0;
    if (hurtNow && !anim.hurt && !e.boss && time - anim.flinchAt > FLINCH_EVERY) anim.flinchAt = time;
    anim.hurt = hurtNow;
    // a boss's pattern: it winds up as the pattern opens, and strikes each time the pattern moves on a step
    const pattern = e.boss?.pattern ?? null;
    if (pattern !== anim.pattern) {
      anim.pattern = pattern;
      anim.step = pattern?.step ?? 0;
    } else if (pattern && pattern.step !== anim.step) {
      anim.step = pattern.step;
      // (a pattern that steps quickly: the blow under way is finished first)
      if (time - anim.blowAt > BLOW_EVERY) anim.blowAt = time;
    }
    const since = time - anim.since;
    // where it's drawn eases after where it is, and from that, how it's really moving
    const gapX = e.x - anim.x;
    const gapY = e.y - anim.y;
    const gap = Math.hypot(gapX, gapY);
    const follow = gap > SNAP ? 1 : 1 - Math.exp(-dt * 26);
    const stepX = gapX * follow;
    const stepY = gapY * follow;
    anim.x += stepX;
    anim.y += stepY;
    if (dt > 0) {
      const now = gap > SNAP ? 0 : Math.hypot(stepX, stepY) / dt;
      anim.speed = damp(anim.speed, now, 14, dt);
    }
    // it faces where it's going; in a fight, standing, whoever it's fighting; never knocked round by a blow
    const shoved = Math.hypot(e.vx, e.vy) > 25;
    let want = anim.turn;
    if (!e.dead && !shoved) {
      if (e.state === 'windup' || e.state === 'act') want = turnOf(e.aimA);
      else if (anim.speed > 5 && Math.hypot(stepX, stepY) > 1e-3) want = Math.atan2(stepX, stepY);
      else if (e.aggro) want = Math.atan2(w.player.x - e.x, w.player.y - e.y);
    }
    if (dt > 0) anim.turn = damp(anim.turn, shortest(anim.turn, want), e.boss ? 7 : 10, dt);
    let clip = 'idle';
    let t = time + e.id * 0.37;
    let loop = true;
    let alpha = 1;
    let rise = 0;
    let sx = 1;
    let sy = 1;
    if (e.dead) {
      clip = 'die';
      t = e.deathT;
      loop = false;
      alpha = Math.max(0, 1 - Math.max(0, e.deathT - 0.7) / 0.5);
      if (alpha <= 0) return;
    } else {
      const atk = kit.atk ?? 'chop';
      // where the blow is in its attack: the lift is shown over the wind-up, so the weapon comes down as the hit lands
      const blow = cast.strike(sprite, atk, e.def.id);
      const walking = (): void => {
        // (still, it stands; walking, its feet keep time with the ground)
        if (anim.speed > 5) {
          clip = kit.walk ?? (anim.speed > 62 ? 'run' : 'walk');
          anim.walk += dt * stride(clip, anim.speed, h);
          t = anim.walk;
        } else if (kit.rest) clip = kit.rest;
      };
      switch (e.state) {
        case 'spawn':
          rise = Math.max(0, 1 - since / 0.7);
          break;
        case 'windup': {
          const u = since / Math.max(0.05, since + e.t);
          clip = atk;
          t = blow.lift + (blow.from - blow.lift) * (1 - (1 - u) * (1 - u));
          loop = false;
          break;
        }
        case 'act':
          clip = atk;
          t = Math.min(blow.from + since, blow.to);
          loop = false;
          break;
        case 'recover':
          // the blow itself and its follow-through (it stands idle once that's done)
          if (anim.struck && blow.from + since * BLOW_RATE < blow.to) {
            clip = atk;
            t = blow.from + since * BLOW_RATE;
            loop = false;
          }
          break;
        case 'chase':
        case 'return':
        case 'idle':
          walking();
          break;
        default:
          break;
      }
      if (pattern && !bossDazed(e)) {
        // a boss: the lift held while its pattern gathers, and a blow each time the pattern moves on
        const since2 = time - anim.blowAt;
        if (blow.from + since2 * BLOW_RATE < blow.to) {
          clip = atk;
          t = blow.from + since2 * BLOW_RATE;
          loop = false;
        } else if (pattern.step === 0 && anim.speed <= 5) {
          clip = atk;
          t = blow.lift + (blow.from - blow.lift) * Math.min(1, pattern.t / BOSS_LIFT);
          loop = false;
        }
      } else if (!e.boss && (e.state === 'idle' || e.state === 'chase' || e.state === 'return') && time - anim.flinchAt < FLINCH) {
        // struck: it flinches (and walks on)
        clip = 'hit';
        t = time - anim.flinchAt;
        loop = false;
      }
      if (e.def.ai === 'hopper') {
        const k = Math.min(1, Math.hypot(e.vx, e.vy) / 90);
        sx = 1 + (e.state === 'windup' ? 0.15 : -0.1 * k);
        sy = 1 + (e.state === 'windup' ? -0.15 : 0.12 * k);
      }
      if (hasStatus(e, 'stun') || e.boss?.dazed) {
        clip = 'hit';
        t = time * 0.4;
      }
      if (hasStatus(e, 'freeze')) t = anim.since;
    }
    // one clip fades into the next, rather than the figure jumping to it
    if (clip !== anim.clip) {
      anim.from = { clip: anim.clip, t: anim.t, loop: anim.loop, k: 1 };
      anim.clip = clip;
    }
    anim.t = t;
    anim.loop = loop;
    if (anim.from) {
      anim.from.k -= dt / CLIP_FADE;
      anim.from.t += dt;
      if (anim.from.k <= 0) anim.from = null;
    }
    // struck: it is knocked back along the blow and comes back, further the harder the blow (Enemy.hitK; a boss barely
    // gives; POLISH_PLAN.md piece 5). Only the picture moves: where it stands is the rules' business
    const struck = e.dead || e.hitT === undefined ? 1 : (w.time - e.hitT) / RECOIL;
    const recoil = struck >= 0 && struck < 1 && !hasStatus(e, 'freeze') ? Math.sin(Math.PI * Math.sqrt(struck)) * (e.hitK ?? 0.3) * (e.boss ? RECOIL_PX * 0.3 : RECOIL_PX) : 0;
    const x = anim.x + Math.cos(e.hitA ?? 0) * recoil;
    const y = anim.y + Math.sin(e.hitA ?? 0) * recoil;
    const frozen = hasStatus(e, 'freeze');
    const chilled = hasStatus(e, 'chill');
    const dying = e.boss && e.boss.dying > 0;
    const windFlash = e.state === 'windup' && Math.floor(time * 14) % 2 === 0 ? 0.32 : 0;
    const flash = e.flash > 0 ? 0.8 : dying ? (Math.floor(time * 16) % 2 ? 0.5 : 0) : windFlash;
    cast.shadow(x, y, e.r + 2);
    if (e.elite.length && !e.dead) cast.ring(x, y, e.r + 4, '#ffcf5a', 0.6 + Math.sin(time * 5) * 0.2);
    // in the dark (night, a crypt) a foe that has seen the hero stands on a faint ring of the danger color: grey-blue foes
    // on grey-blue flagstones were lost in the dark, and an outline of ink is no help against a dark floor
    else if (!e.dead && e.aggro && !e.dummy && !e.boss && dark() > 0.3) cast.ring(x, y, e.r + 3, dangerColor(), 0.32 * Math.min(1, dark() * 1.4));
    cast.creature(sprite, x, y, anim.turn, h, clip, t, loop, { alpha, flash, rise, sx, sy, enemy: e.def.id, tint: frozen ? FROZEN : chilled ? CHILLED : undefined, ...(anim.from ? { from: anim.from } : {}) });
  }

  /**
   * One of the story's people. They stand as their place has them, until a scene has them do something: then they
   * walk when they are moved (their legs keeping time with the ground, turned the way they go), turn to whoever the
   * scene turns them to, and make its gestures (sim/scene.ts `turns`, `acts`). Before, someone a scene walked across
   * a square slid there standing still.
   */
  private syncNpc(cast: Cast, n: NpcActor, w: World, dt: number, time: number, alpha: number): void {
    const def = NPCS[n.ghost ?? n.id];
    const look = npcLookOf(n.ghost ?? n.id);
    const fallen = def?.down;
    let a = this.acting.get(n);
    if (!a) {
      a = { m: new Motion(), x: n.x, y: n.y, heading: 0, still: 9, act: -1, over: -1 };
      // (each their own moment of standing: a square of people doesn't breathe in step)
      a.m.t = Math.abs(n.x * 0.1 + n.y * 0.07) % 2;
      this.acting.set(n, a);
    }
    const dx = n.x - a.x;
    const dy = n.y - a.y;
    const speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
    // (a jump across the land is a cut, not a walk)
    const walking = speed > 5 && speed < 420;
    if (walking) {
      a.heading = Math.atan2(dx, dy);
      a.still = 0;
    } else a.still += dt;
    a.x = n.x;
    a.y = n.y;
    const scene = w.scene;
    const moving = walking || a.still < 0.12;
    const turn = this.easeTurn(n, moving ? a.heading : (scene?.turns[n.id] ?? (n.face < 0 ? -0.55 : 0.55)), moving ? 10 : 5, dt);
    const act = scene?.acts[n.id];
    if (moving) a.m.set(speed > 78 ? 'run' : 'walk', true, 0.16);
    else if (act && a.over !== act.at) {
      const fresh = a.act !== act.at;
      a.act = act.at;
      a.m.set(act.clip, false, 0.18, fresh);
      // a gesture made once is over when its clip is; one that is held keeps its last pose (kneeling, fallen)
      const c = cast.wardrobe?.medium.clips[act.clip];
      if (!act.hold && (!c || a.m.t >= c.n / c.fps - 0.12)) {
        a.over = act.at;
        a.m.set('idle', true, 0.22);
      }
    } else if (!act || a.m.clip === 'walk' || a.m.clip === 'run') a.m.set('idle', true, 0.2);
    a.m.advance(moving ? dt * stride(a.m.clip, speed, PERSON_H) : dt);
    cast.shadow(n.x, n.y, 7);
    // (an echo of the dead is not quite here: it hangs a little off the ground, pale and cold)
    const echo = ECHOES.has(n.id) || !!n.ghost;
    // (...but one a scene has on its knees is down on the ground, not sitting in the air)
    const down = !!act?.hold && !moving;
    if (look) cast.person(look, null, false, n.x, n.y, turn, fallen ? { clip: 'lie', t: time + n.x * 0.1, loop: true } : a.m, echo ? { alpha, lift: down ? 0.02 : 0.14 + Math.sin(time * 1.6 + n.x) * 0.04, tint: ECHO_TINT } : { alpha });
    else cast.creature(def?.sprite ?? 'villager', n.x, n.y, turn, PERSON_H, fallen ? 'die' : 'idle', fallen ? 9 : time + n.x * 0.1, !fallen, { alpha });
  }

  private syncPet(cast: Cast, pet: Pet, w: World, dt: number, time: number): void {
    const look = pet.def.look;
    if (pet.def.role === 'ward' && WARD_LOOKS.has(look ?? 'door')) {
      const ward = WARDS[look ?? 'door'];
      if (ward) {
        const shake = pet.flash > 0 ? Math.sin(time * 60) * 1 : 0;
        cast.prop(ward.m, pet.x + (ward.dx ?? 0) + shake, pet.y, ward.h);
      }
      return;
    }
    let s = this.pets.get(pet.id);
    if (!s) {
      s = { m: new Motion(), turn: 0, x: pet.x, y: pet.y, actT: 0 };
      this.pets.set(pet.id, s);
    }
    const speed = Math.hypot(pet.vx, pet.vy);
    const moving = speed > 8;
    // (drawn a touch behind where the rules have it: elbowing for room is a drift, not a twitch)
    const gap = Math.hypot(pet.x - s.x, pet.y - s.y);
    const follow = gap > SNAP ? 1 : 1 - Math.exp(-dt * 26);
    s.x += (pet.x - s.x) * follow;
    s.y += (pet.y - s.y) * follow;
    if (moving) s.turn = damp(s.turn, shortest(s.turn, Math.atan2(pet.vx, pet.vy)), 10, dt);
    else if (pet.actT > 0) s.turn = damp(s.turn, shortest(s.turn, turnOf(pet.face)), 12, dt);
    // (a companion in a scene turns to who they speak to, as the place's own people do)
    else if (w.scene && w.scene.turns[pet.def.id] !== undefined) s.turn = damp(s.turn, shortest(s.turn, w.scene.turns[pet.def.id]!), 6, dt);
    // the story's people come in as they go out, with a fade (a companion stepping up to speak, the led, the arriving)
    const arrive = pet.story && pet.born !== undefined ? Math.min(1, Math.max(0, (w.time - pet.born) / STORY_ARRIVE)) : 1;
    const fade = pet.story ? Math.min(arrive, pet.deathT > 0 ? 1 - pet.deathT / STORY_FADE : 1) : 1;
    const alpha = pet.dead ? Math.max(0, 1 - pet.deathT / 0.6) : fade;
    if (alpha <= 0) return;
    const person = look ? npcLookOf(look) : null;
    if (pet.dead) s.m.set('die', false);
    else if (pet.actT > 0) {
      // (a new blow starts where the blow is in its clip, not at the lift before it)
      const fresh = s.m.clip !== 'chop' || pet.actT > s.actT + 0.01;
      s.m.set('chop', false, 0.08, fresh);
      if (fresh) s.m.t = person ? strikeOf(cast.wardrobe?.medium, 'chop').from : cast.strike(pet.def.sprite ?? 'wolf', 'chop').from;
    } else s.m.set(moving ? 'walk' : 'idle', true, 0.18);
    s.actT = pet.actT;
    s.m.advance(s.m.clip === 'walk' ? dt * stride('walk', speed, heightFromRadius(pet.r)) : dt);
    const flash = pet.flash > 0 ? 0.7 : 0;
    // one who comes on horseback (Dunmore's riders): the horse at its own gait, the rider in the saddle
    const steed = person && pet.def.rides ? mountDef(pet.def.rides) : undefined;
    if (steed && cast.mountReady(steed)) {
      const shape = shapeOf(steed);
      const horse = (s.horse ??= new Motion());
      horse.set(moving ? (speed > shape.gallop * 0.55 ? 'run' : 'walk') : 'idle', true, 0.14);
      horse.advance(moving ? dt * Math.max(0.6, Math.min(3, speed / (horse.clip === 'run' ? shape.gallop : shape.gallop * 0.3))) : dt);
      const sh = shape.shadow;
      cast.shadow(s.x + Math.sin(s.turn) * sh.ahead, s.y + Math.cos(s.turn) * sh.ahead, sh.r, sh.long, s.turn);
      const saddle = cast.mount(steed, s.x, s.y, s.turn, horse, { alpha, flash });
      s.m.set('ride');
      if (saddle) cast.person(person!, null, false, saddle.x, saddle.y, s.turn, s.m, { alpha, flash, h: PERSON_H * shape.rider, hipsAt: saddle.high, tip: saddle.tip * 0.55 });
      return;
    }
    cast.shadow(s.x, s.y, pet.r + 1);
    if (person) {
      const small = /child/.test(look!) ? 0.72 : 1;
      cast.person(person, null, false, s.x, s.y, s.turn, s.m, { alpha, flash, h: PERSON_H * small });
    } else {
      const sprite = pet.def.sprite ?? 'wolf';
      cast.creature(sprite, s.x, s.y, s.turn, heightFromRadius(pet.r), s.m.clip, s.m.t, s.m.clip === 'walk' || s.m.clip === 'idle', { alpha, flash, motion: s.m });
    }
  }

  private syncGhost(cast: Cast, gh: Ghost, dt: number, time: number): void {
    let s = this.ghosts.get(gh.n);
    if (!s) {
      // (what they did before they were first seen is not replayed)
      s = { m: new Motion(), turn: 0, n: gh.act?.n ?? -1, chain: 0, act: null };
      this.ghosts.set(gh.n, s);
    }
    const moving = Math.hypot(gh.vx, gh.vy) > 10;
    // a skill they made since the last word of them: the same move the hero's own body makes for it
    if (gh.act && gh.act.n !== s.n) {
      s.n = gh.act.n;
      if (!gh.dead) {
        const move = moveOf(gh.cls as ClassId, gh.act.skill, gh.act.kind, chained(gh.act.skill) ? s.chain++ : 0, gh.act.big);
        if (gh.act.big) s.chain = 0;
        s.act = { move, strike: strikeFor(cast.wardrobe?.medium, move), t: 0, fresh: true };
      }
    }
    let at = 0;
    if (s.act) {
      s.act.t += dt * (s.act.move.rate ?? 1);
      at = s.act.strike.from + s.act.t;
      if (gh.dead || at >= s.act.strike.to || (moving && at >= s.act.strike.hit + 0.05)) s.act = null;
    }
    if (gh.cast && !gh.dead) s.turn = damp(s.turn, shortest(s.turn, turnOf(gh.cast.angle)), 14, dt);
    else if (s.act && gh.act) s.turn = damp(s.turn, shortest(s.turn, turnOf(gh.act.angle)), 16, dt);
    else if (moving) s.turn = damp(s.turn, shortest(s.turn, Math.atan2(gh.vx, gh.vy)), 14, dt);
    if (gh.dead) s.m.set('die', false);
    // casting a spell (their cast bar): the same raised hands as the hero's own
    else if (gh.cast) s.m.set('channel', true, 0.12);
    else if (s.act) {
      s.m.set(s.act.move.clip, false, 0.06, s.act.fresh);
      s.act.fresh = false;
    } else s.m.set(moving ? 'run' : 'idle');
    s.m.advance(dt);
    if (s.act && !gh.cast && !gh.dead) s.m.t = at;
    cast.shadow(gh.x, gh.y, 8);
    const alpha = gh.dead ? 0.55 : gh.untouchable && Math.floor(time * 20) % 2 === 0 ? 0.6 : 1;
    cast.person(gh.look as HeroLook, gh.weapon as Held, gh.cls === 'warrior' || gh.cls === 'paladin', gh.x, gh.y, s.turn, s.m, { alpha, xray: true });
  }
}

export const shieldOf = (cls: string): boolean => cls === 'warrior' || cls === 'paladin';
