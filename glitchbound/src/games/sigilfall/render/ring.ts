import { RING_SOUNDS } from '../audio/samples';
import { drawReticle } from './reticle';
import { drawIcon } from './art/gameIcons';
import { ABILITIES, BOONS, type Ability } from '../arena/abilities';
import { lookOf } from '../arena/look';
import { ARENA_H, ARENA_W, MAPS } from '../arena/maps';
import { HERO_R, type Fighter, type Match } from '../arena/sim';
import type { RingAir } from '../render3d/ringDress';
import { shot, TONES } from './effects';
import { CLASSES } from '../data/classes';
import { heroLook, heldWeapon, type WornLooks } from './sprites';
import type { Held } from '../render3d/dress';
import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import { THRALL_EYES } from '../render3d/thrall';
import { drawBoon, drawFade, drawFlight, drawGlobe, drawPoints, drawShatter, drawSign, hasSign, SHATTER_T, signAlone, signTime, type Sign } from './ringSigns';
import type { RingStage, RingView } from '../render3d/ring3d';
import { newCharacter, type Character, type Face } from '../progress/character';
import { wornLooks } from '../progress/wardrobe';

/**
 * The Ring's top layer: the arena and the fighters are in 3D underneath (render3d/ring3d.ts); here are the rings under
 * their feet, their bars and numbers. The spells, and what's afoot on people, are the shaders' (`ringSpells`).
 */

type Ctx = CanvasRenderingContext2D;



export interface RingLook {
  look: ReturnType<typeof heroLook>;
  held: Held;
}

/** Every fighter's picture, made once. */
export function ringLooks(m: Match, mine: { face?: Face; body?: 'm' | 'f'; wear?: Character | null; worn?: WornLooks }, myId: number | null): RingLook[] {
  return m.fighters.map((f) => {
    const hero = newCharacter(f.cls, f.name, 'ring');
    const isMe = f.id === myId;
    // (your own campaign hero's gear and Wardrobe, if you chose to fight in them)
    const w = isMe && mine.wear && mine.wear.cls === f.cls ? mine.wear : null;
    if (w) return { look: heroLook(f.cls, w.equip, wornLooks(w), w.body, w.face), held: heldWeapon(f.cls, w.equip.weapon, wornLooks(w).weapon) };
    const body: 'm' | 'f' = isMe ? (mine.body ?? 'm') : f.id % 2 ? 'f' : 'm';
    // (in plain clothes, the Ring armor they chose goes over them)
    const look = heroLook(f.cls, hero.equip, isMe ? (mine.worn ?? {}) : {}, body, isMe ? mine.face : undefined);
    return { look, held: heldWeapon(f.cls, hero.equip.weapon) };
  });
}

interface Flash {
  x: number;
  y: number;
  t: number;
  dur: number;
  r: number;
  color: string;
  ring: boolean;
}

interface Pop {
  x: number;
  y: number;
  t: number;
  text: string;
  color: string;
  big: boolean;
  /** A word (not a number): words stack. */
  word?: boolean;
  /** How far up the screen it starts, when the one it is about wears effect pictures over the bar. */
  lift?: number;
  /** A number's fighter, kind and sum, so that hits close together are added into one (RingFx MERGE_T). */
  of?: number;
  kind?: string;
  n?: number;
  /** A Shatter's: bigger, icy, thrown up hard and never added to another. */
  punch?: boolean;
}

/**
 * Numbers on one fighter of one kind within this long of each other are one number (a burst of ticks and blows read
 * as a single sum, not a spray: the plan's "merged damage numbers"). A critical hit stands on its own.
 */
export const MERGE_T = 0.35;

/**
 * The effects drawn over a fighter's bar: those that run out and belong to an ability with a picture, one picture to
 * an ability (a curse that both burns and cuts healing is one curse to the eye, shown with its longest part).
 */
export function worn(f: Pick<Fighter, 'auras'>): Fighter['auras'] {
  const out: Fighter['auras'] = [];
  for (const a of f.auras) {
    if (!(a.dur > 0 && a.t > 0 && lookOf(a.ab))) continue;
    const i = out.findIndex((o) => o.ab === a.ab && o.harmful === a.harmful);
    if (i < 0) out.push(a);
    else if (a.t > out[i]!.t) out[i] = a;
  }
  return out;
}
const wears = (f: Fighter): boolean => worn(f).length > 0;

/** How many pictures stand over one fighter at most. */
export const OVERHEAD_MAX = 3;

/**
 * What of it stands over a fighter's head, where the fight is (the plan the owner took up: "over heads: only holds and
 * your own effects; everything else on the nameplates"): any hold on them, whoever's, then what the player put on them,
 * longest-held first, three at most. Over the player's own head and their allies' (`ours`), the other side's debuffs
 * too, between the two (the owner, 2026-11-17: "add debuffs to yours and your allies health bars"). Nothing is hidden:
 * every effect is still on the fighter's nameplate (RingMatch Frame). With no player (a replay, a test), the holds alone.
 */
export function overhead(f: Pick<Fighter, 'auras'>, myId: number | null, ours = false): Fighter['auras'] {
  const holds = worn(f).filter((a) => !!a.cc);
  const harm = ours && myId !== null ? worn(f).filter((a) => !a.cc && a.harmful && a.src !== myId) : [];
  const mine = myId === null ? [] : worn(f).filter((a) => !a.cc && a.src === myId);
  return [...holds.sort((a, b) => b.t - a.t), ...harm.sort((a, b) => b.t - a.t), ...mine.sort((a, b) => b.t - a.t)].slice(0, OVERHEAD_MAX);
}

/** What an ability sounds like as it leaves the hand, and as it lands, by its school. */
const LEAVES: Record<string, string> = { physical: 'swing', fire: 'fireball', frost: 'freeze', arcane: 'bolt', holy: 'holy', shadow: 'shadow', nature: 'nature' };
const LANDS: Record<string, string> = { physical: 'clash', fire: 'explode', frost: 'freeze', arcane: 'zap', holy: 'holy', shadow: 'shadow', nature: 'nature' };
const SUPER_SOUND: Record<string, string> = { physical: 'quake', fire: 'meteor', frost: 'freeze', arcane: 'thunder', holy: 'nova', shadow: 'rift', nature: 'thunder' };
/** An ability with a sound of its own as it leaves the hand (Frostfang is thrown, with a whistle, not cast). */
const LEAVES_OWN: Record<string, string> = { 'm-fang': 'spear' };
/**
 * The Ring's own sound for a sound asked for by its usual name (audio/samples.ts RING_SOUNDS): its warm, cartoony one
 * where it has one, else the usual.
 */
export const ringSound = (id: string): string => ((RING_SOUNDS as readonly string[]).includes(id) ? `ring-${id}` : id);

/** Every sound those tables name (a test holds them to the sounds there are). */
export const ringSchoolSounds = (): string[] => [...Object.values(LEAVES), ...Object.values(LANDS), ...Object.values(SUPER_SOUND), ...Object.values(LEAVES_OWN), 'shatter'];

/** What's on screen for a moment: kept here, out of the simulation. */
/** A spell landing: a burst in its school's own manner, bigger for a burst ability. */
interface Burst {
  x: number;
  y: number;
  t: number;
  dur: number;
  school: string;
  color: string;
  big: boolean;
  heal: boolean;
  seed: number;
}

/**
 * A combo called out over whoever it landed on: its name alone (a host from before Momentum went may still add its
 * chain, "Gloomfire ×3", which is not shown).
 */
export const comboWord = (word: string): string => word.replace(/\s*×\d+$/, '');

export class RingFx {
  flashes: Flash[] = [];
  pops: Pop[] = [];
  bursts: Burst[] = [];
  /** The path of a blade through the air, in front of whoever swung it: where, which way, how wide, how heavy. */
  arcs: { x: number; y: number; a: number; t: number; dur: number; color: string; edge?: string; arc: number; r: number; heavy: boolean }[] = [];
  /** Who last used each ability: when it lands, what it drinks goes back to them. */
  private readonly by = new Map<string, number>();
  /**
   * Sparks thrown out of a combo as it lands and out of whoever unleashes a super (the owner: "for the combo impact,
   * just do particles and short sound, dont nudge camera and etc"): each flies out, rises a little, falls and fades.
   * Only drawn on this screen, so nothing about the match changes for anyone. None for those who asked for less motion.
   */
  sparks: { x: number; y: number; vx: number; vy: number; up: number; vu: number; t: number; dur: number; color: string; w: number }[] = [];
  /** Asked for less motion: no sparks. */
  still = false;
  /** Life drunk: motes that leave whoever was struck and fly to whoever struck them. */
  drains: { x: number; y: number; to: number; t: number; dur: number; n: number }[] = [];
  /** A hand of shadow come up out of the ground under someone. */
  hands: { x: number; y: number; t: number; dur: number }[] = [];
  /** Where each Gloamknight has just been: the dark they leave behind them as they go (by fighter: trailWake). */
  readonly wakes = new Map<number, Wake>();
  /** A toll of dusk rolling out from someone: rings of dark, one after another. */
  tolls: { x: number; y: number; t: number; dur: number; r: number }[] = [];
  /** What lands at once but is thrown (an arrow, a hammer): a streak from the hand to whoever it hit. */
  zips: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; ab: string; to?: number }[] = [];
  /** A placed ability that has just come down: its patch, lit. */
  falls: { x: number; y: number; r: number; t: number; dur: number; ab: string }[] = [];
  /** Who just let a super go: a column of light on them for a moment. */
  supers: { id: number; t: number }[] = [];
  /** Each ability's own look as it is used, as it lands and as its patch comes down (render/ringSigns.ts). */
  signs: Sign[] = [];
  /** Someone faded from sight (a mage's vanishing point): the puff they left where they stood. */
  fades: { x: number; y: number; t: number; dur: number; seed: number }[] = [];
  /** A Shatter going off on someone (render/ringSigns.ts drawShatter): on whom, the way the fang came, how far along. */
  shatters: { on: number; x: number; y: number; a: number; t: number; dur: number; seed: number }[] = [];
  /** A chain thrown or a life being drunk: a line from one fighter to another, for as long as it lasts. */
  lines: { ab: string; from: number; to: number; t: number; dur: number }[] = [];
  private sign(ab: string, k: Sign['k'], x: number, y: number, a: number, on?: number, r?: number): void {
    this.signs.push({ ab, k, on, x, y, a, t: 0, dur: signTime(ab, k), seed: ((x * 7 + y * 3 + this.signs.length * 1.7) % 6.28) + 0.1, r });
    if (this.signs.length > 28) this.signs.shift();
  }
  private spread = 0;

  /** Takes the match's events. Returns what's worth a sound. */
  take(m: Match, sound: (id: string, vol?: number) => void, myId: number | null): void {
    const viewer = myId === null ? null : (m.fighters[myId] ?? null);
    // (whoever a Shatter has just gone off on: the number that follows it is the Shatter's own)
    const shattered = new Set<number>();
    for (const e of m.events) {
      // (what happens to one of the other side in the shroud is neither seen nor heard, but for their slipping into it)
      const who = 'id' in e ? m.fighters[e.id] : undefined;
      if (who && viewer && m.unseen(who, viewer) && e.k !== 'fade' && !(e.k === 'ab' && ABILITIES[e.ab]?.effects.some((x) => x.k === 'veil'))) continue;
      if (e.k === 'num') {
        const f = m.fighters[e.id];
        if (!f) continue;
        // (always a whole number, whatever the rules hand over: a long tail of decimals once hung over a fighter's head)
        const say = (v: number): string => {
          const n = Math.round(v);
          return e.kind === 'dmg' ? `${n}` : e.kind === 'heal' ? `+${n}` : `(${n})`;
        };
        const punch = e.kind === 'dmg' && shattered.has(f.id);
        if (punch) shattered.delete(f.id);
        const near = e.crit || punch ? undefined : this.pops.find((p) => p.of === f.id && p.kind === e.kind && p.t < MERGE_T && p.color !== '#ffd257' && !p.punch);
        if (near) {
          near.n = (near.n ?? 0) + e.n;
          near.text = say(near.n);
          near.big = near.big || near.n > 120;
        } else {
          this.spread = (this.spread + 1) % 5;
          const x = f.x + (this.spread - 2) * 7;
          // (over the effect pictures when they wear any, so a wound that ticks each second doesn't hide its own timer)
          const lift = wears(f) ? 16 : 0;
          if (punch) this.pops.push({ x: f.x, y: f.y - 30, lift, t: 0, text: say(e.n), color: '#bff0ff', big: true, of: f.id, kind: e.kind, n: e.n, punch: true });
          else this.pops.push({ x, y: f.y - 30, lift, t: 0, text: say(e.n), color: e.kind === 'dmg' ? (e.crit ? '#ffd257' : '#fff6e0') : e.kind === 'heal' ? '#7fe06a' : '#9fdcff', big: e.crit || e.n > 120, of: f.id, kind: e.kind, n: e.n });
        }
        if (e.kind === 'dmg' && e.id === myId) sound('hurt', e.crit ? 0.7 : 0.45);
      } else if (e.k === 'word') {
        const f = m.fighters[e.id];
        if (!f) continue;
        // (a combo is called out big, in gold, with a burst of light on them; words said close together stand one over
        // the other, never on top of each other)
        const above = this.pops.filter((p) => p.word && p.t < 0.5 && Math.abs(p.x - f.x) < 40 && Math.abs(p.y - f.y) < 110).length;
        this.pops.push({ x: f.x, y: f.y - (e.combo ? 50 : 42) - above * 13, lift: wears(f) ? 12 : 0, t: 0, text: e.combo ? `${comboWord(e.word)}!` : e.word, color: e.combo ? '#ffd257' : e.bad ? '#ff9ab0' : '#e0d0ff', big: !!e.combo, word: true });
        if (e.combo && e.word === 'Shatter') {
          // Frostfang's Shatter: the ice they are held in breaks, and is heard breaking (render/ringSigns.ts drawShatter)
          const from = this.by.get('m-fang');
          const src = from === undefined ? undefined : m.fighters[from];
          const a = src && src !== f ? Math.atan2(f.y - src.y, f.x - src.x) : Math.atan2(f.dirY, f.dirX) + Math.PI;
          this.shatters.push({ on: f.id, x: f.x, y: f.y, a, t: 0, dur: SHATTER_T, seed: ((f.x * 0.37 + f.y * 0.11) % 6.28) + 0.2 });
          // (in place of the plain bite it would have been: the one is the other, bigger, not both at once)
          this.signs = this.signs.filter((s) => !(s.ab === 'm-fang' && s.k === 'land' && s.on === f.id && s.t === 0));
          if (this.shatters.length > 6) this.shatters.shift();
          this.burstSparks(f.x, f.y, 16, ['#e0f8ff', '#9fdcff', '#ffffff'], 1.3);
          shattered.add(f.id);
          const mine = src?.id === myId || f.id === myId;
          sound('shatter', mine ? 0.85 : 0.55);
          sound('shard', mine ? 0.6 : 0.4);
        } else if (e.combo) {
          this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 26, color: '#ffd257', ring: true });
          this.burstSparks(f.x, f.y, 14, ['#ffd257', '#fff2c0', '#ffb45c'], 1);
          // (a short bright note of its own)
          sound('shard', 0.7);
        } else if (e.word === 'Interrupted' || e.word === 'Reflected') sound('shieldBreak', 0.6);
      } else if (e.k === 'ab') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        this.by.set(ab.id, f.id);
        if (ab.zip) {
          const to = m.aimOf(f, ab);
          if (to && to !== f) {
            const d = Math.hypot(to.x - f.x, to.y - f.y);
            // (they cross in a blink, going after their target: one to be watched is a bolt, Ability.flight)
            this.zips.push({ x0: f.x, y0: f.y, x1: to.x, y1: to.y, t: 0, dur: Math.max(0.07, Math.min(0.16, d / 1100)), ab: ab.id, to: to.id });
            if (this.zips.length > 12) this.zips.shift();
          }
        }
        // (its own look as it leaves the hand, if it has one: render/ringSigns.ts)
        if (hasSign(ab.id, 'cast')) this.sign(ab.id, 'cast', f.x, f.y, Math.atan2(f.dirY, f.dirX), f.id);
        // (a chain thrown: its links out to whoever it is for, drawn taut for a moment)
        if (ab.id === 'g-chain') {
          const to = m.aimOf(f, ab);
          if (to && to !== f) this.lines.push({ ab: ab.id, from: f.id, to: to.id, t: 0, dur: 0.45 });
        }
        if (ab.cls === 'gloamknight') this.gloam(ab, f);
        else if (ab.effects.some((x) => x.k === 'raise')) {
          // the ground opens round the warlock: a ring of rot rolling out, and the dark welling up where the dead will climb
          for (let i = 0; i < 2; i++) this.tolls.push({ x: f.x, y: f.y, t: -i * 0.16, dur: 0.6, r: 30 });
          this.bursts.push({ x: f.x, y: f.y, t: 0, dur: 0.6, school: 'shadow', color: '#9ae85a', big: true, heal: false, seed: f.x % 97 });
        }
        else if (ab.allies) {
          // (a blessing on the whole side: a ring of its light on every friend it reaches)
          for (const o of m.friendsOf(f)) if (!o.pet && Math.hypot(o.x - f.x, o.y - f.y) <= ab.range + HERO_R) this.flashes.push({ x: o.x, y: o.y, t: 0, dur: 0.8, r: 30, color: ab.color, ring: true });
        } else if (ab.aim === 'near' && !hasSign(ab.id, 'cast')) this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.42, r: ab.range + HERO_R, color: ab.color, ring: true });
        else if (ab.cast === 0 && ab.range <= 40 && ab.aim === 'enemy') {
          // a blow leaves its arc in the air: wide for a cut, wider and heavier for a great one, narrow for a thrust
          const heavy = ab.role === 'burst' || !!ab.super;
          const thrust = ab.effects.some((x) => x.k === 'charge' || x.k === 'interrupt');
          this.arcs.push({ x: f.x + f.dirX * 6, y: f.y + f.dirY * 6, a: Math.atan2(f.dirY, f.dirX), t: 0, dur: heavy ? 0.34 : 0.26, color: ab.school === 'physical' ? '#fff4e0' : ab.color, arc: thrust ? 0.7 : heavy ? 2.6 : 2, r: heavy ? 34 : 28, heavy });
          if (this.arcs.length > 16) this.arcs.shift();
        }
        // (what it is made of, as it leaves the hand: your own a little louder than the rest)
        const vol = e.id === myId ? 0.7 : 0.4;
        const melee = ab.range > 0 && ab.range <= 40;
        if (ab.super) sound(SUPER_SOUND[ab.school] ?? 'nova', 0.9);
        else if (ab.role === 'heal' || ab.aim === 'friend') sound('buff', vol * 0.8);
        // (the ground torn open for the dead)
        else if (ab.role === 'summon') sound('rift', vol);
        else if (ab.aim === 'self') sound(ab.role === 'defense' ? 'shield' : ab.role === 'mobility' ? 'blink' : 'buff', vol);
        else if (ab.school === 'physical') sound(melee ? (ab.role === 'burst' ? 'swingBig' : 'swing') : ab.cls === 'ranger' ? 'bow' : 'swingBig', vol);
        else sound(LEAVES_OWN[ab.id] ?? LEAVES[ab.school] ?? 'bolt', vol);
      } else if (e.k === 'land') {
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        // (a knock of light as it lands: a small one under an ability's own sign, which is the thing to look at)
        if (hasSign(ab.id, 'land')) this.flashes.push({ x: f.x, y: f.y - 12, t: 0, dur: 0.2, r: 11, color: ab.color, ring: false });
        else this.flashes.push({ x: f.x, y: f.y - 12, t: 0, dur: 0.32, r: ab.role === 'burst' ? 30 : 22, color: ab.color, ring: false });
        if (ab.role === 'heal') this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 18, color: ab.color, ring: true });
        // (and as it lands: steel for a blow, the school's own for a spell, a soft chime for a heal)
        const mine = e.id === myId;
        if (ab.role === 'heal' || ab.aim === 'friend') sound('heal', mine ? 0.6 : 0.35);
        else if (ab.aim === 'enemy' || ab.aim === 'near' || ab.aim === 'ground') sound(ab.school === 'physical' ? (ab.role === 'burst' ? 'critBlade' : 'clash') : ab.role === 'burst' && ab.school !== 'frost' ? 'explode' : (LANDS[ab.school] ?? 'hit'), mine ? 0.75 : 0.5);
        // (its own look as it lands, in place of its school's burst; with it, for the few that keep both)
        const from0 = this.by.get(ab.id);
        const src = from0 === undefined ? undefined : m.fighters[from0];
        if (hasSign(ab.id, 'land')) this.sign(ab.id, 'land', f.x, f.y, src && src !== f ? Math.atan2(f.y - src.y, f.x - src.x) : Math.atan2(f.dirY, f.dirX) + Math.PI, f.id);
        if (!signAlone(ab.id)) this.bursts.push({ x: f.x, y: f.y, t: 0, dur: ab.role === 'burst' ? 0.75 : 0.55, school: ab.school, color: ab.color, big: ab.role === 'burst', heal: ab.role === 'heal' || ab.aim === 'friend', seed: (f.x * 7 + f.y * 3 + this.bursts.length) % 97 });
        if (this.bursts.length > 24) this.bursts.shift();
        // a blow that drinks: what it took streams back to whoever struck it
        const drunk = ab.effects.find((x) => x.k === 'heal');
        const from = this.by.get(ab.id);
        if (drunk && drunk.k === 'heal' && ab.effects.some((x) => x.k === 'dmg') && from !== undefined && from !== f.id) {
          this.drains.push({ x: f.x, y: f.y, to: from, t: 0, dur: 0.5, n: drunk.n >= 60 ? 9 : drunk.n >= 25 ? 6 : 4 });
          if (this.drains.length > 8) this.drains.shift();
        }
        if (ab.id === 'g-hand') this.hands.push({ x: f.x, y: f.y, t: 0, dur: 1.1 });
      } else if (e.k === 'fade') {
        // (gone from sight where they stood: both sides see the puff, and hear it)
        this.fades.push({ x: e.x, y: e.y, t: 0, dur: 0.9, seed: (e.x * 0.37 + e.y * 0.11) % 6.28 });
        if (this.fades.length > 6) this.fades.shift();
        sound('blink', e.id === myId ? 0.7 : 0.4);
      } else if (e.k === 'streak') {
        // something a talent throws (an imp's spit, a hammer leaping on, light called down): seen crossing, and lighting where it lands
        const f = m.fighters[e.id];
        const to = m.fighters[e.to];
        const look = lookOf(e.ab);
        if (!f || !to || !look) continue;
        const d = Math.hypot(to.x - f.x, to.y - f.y);
        this.zips.push({ x0: f.x, y0: f.y, x1: to.x, y1: to.y, t: 0, dur: Math.max(0.08, Math.min(0.2, d / 900)), ab: e.ab });
        if (this.zips.length > 12) this.zips.shift();
        this.flashes.push({ x: to.x, y: to.y - 12, t: 0, dur: 0.3, r: 18, color: look.color, ring: false });
        sound(LANDS[look.school] ?? 'hit', e.id === myId || e.to === myId ? 0.45 : 0.25);
      } else if (e.k === 'claw') {
        // one of the raised dead strikes: a short violet rake in front of it, and a dull knock
        const f = m.fighters[e.id];
        const to = m.fighters[e.to];
        if (!f || !to) continue;
        const a = Math.atan2(to.y - f.y, to.x - f.x);
        this.arcs.push({ x: f.x + Math.cos(a) * 6, y: f.y + Math.sin(a) * 6, a, t: 0, dur: 0.24, color: '#4a1f9e', edge: '#d8bcff', arc: 1.6, r: 20, heavy: false });
        if (this.arcs.length > 18) this.arcs.shift();
        sound('swing', e.to === myId ? 0.4 : 0.2);
      } else if (e.k === 'death' && m.fighters[e.id]?.pet) {
        // one of the raised dead goes back into the ground: a puff of the gloam, no more
        const f = m.fighters[e.id]!;
        this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 18, color: '#8a5cff', ring: true });
        this.bursts.push({ x: f.x, y: f.y, t: 0, dur: 0.55, school: 'shadow', color: '#9a6ae0', big: false, heal: false, seed: (f.x * 7 + f.y * 3) % 97 });
        sound('shadow', 0.3);
      } else if (e.k === 'death') {
        const f = m.fighters[e.id];
        if (!f) continue;
        this.flashes.push({ x: f.x, y: f.y - 10, t: 0, dur: 0.8, r: 60, color: '#ff5a5a', ring: true });
        // (a fighter down: a body falling and the crowd's drum; the match's own end has its jingle)
        sound('die', 0.9);
        sound('slam', 0.6);
      } else if (e.k === 'miss') {
        // a shot whose target fell before it got there: a puff where it went out
        const ab = ABILITIES[e.ab];
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.22, r: 9, color: ab?.color ?? '#ffffff', ring: false });
      } else if (e.k === 'zone') {
        // what was placed comes down: its whole patch lit, a ring racing out to its edge, and the ground hit hard
        const ab = ABILITIES[e.ab];
        if (!ab) continue;
        this.falls.push({ x: e.x, y: e.y, r: e.r, t: 0, dur: 0.55, ab: ab.id });
        if (hasSign(ab.id, 'zone')) this.sign(ab.id, 'zone', e.x, e.y, 0, undefined, e.r);
        if (this.falls.length > 8) this.falls.shift();
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.45, r: e.r, color: ab.color, ring: true });
        if (!hasSign(ab.id, 'zone')) this.bursts.push({ x: e.x, y: e.y, t: 0, dur: 0.75, school: ab.school, color: ab.color, big: true, heal: false, seed: (e.x * 7 + e.y * 3) % 97 });
        sound(ab.super ? 'slam' : (LANDS[ab.school] ?? 'hit'), ab.super ? 0.9 : 0.55);
      } else if (e.k === 'orb') {
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.5, r: 26, color: '#7fe06a', ring: true });
        sound('heal', e.id === myId ? 0.7 : 0.4);
      } else if (e.k === 'super') {
        // a super: a great ring of its color, a crowd that roars, and its name called out
        const ab = ABILITIES[e.ab];
        const f = m.fighters[e.id];
        if (!ab || !f) continue;
        this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.7, r: Math.max(46, ab.aim === 'near' ? ab.range + HERO_R : 46), color: ab.color, ring: true });
        this.flashes.push({ x: f.x, y: f.y - 14, t: 0, dur: 0.45, r: 34, color: '#fff6d8', ring: false });
        this.pops.push({ x: f.x, y: f.y - 54, t: 0, text: ab.name, color: '#ffd257', big: true });
        this.supers.push({ id: f.id, t: 0 });
        this.burstSparks(f.x, f.y, 22, [ab.color, '#fff6d8', ab.color], 1.35);
        sound('roar', 0.5);
        sound('epic', 0.55);
      } else if (e.k === 'sigil') {
        this.flashes.push({ x: e.x, y: e.y, t: 0, dur: 0.6, r: e.id < 0 ? 22 : 34, color: '#ffe27a', ring: true });
        sound(e.id >= 0 ? 'pickupBig' : 'orb', e.id >= 0 ? 0.7 : 0.4);
      } else if (e.k === 'boon') {
        // a boon given: a ring of its light on whoever has it and a few sparks, so the other side can see it too; and
        // for the one who has it, a bright note (the light at the edges of their screen is ui/RingBoons.tsx)
        const f = m.fighters[e.id];
        const def = BOONS[e.boon];
        if (!f || !def || def.quiet) continue;
        this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.45, r: 20, color: def.color, ring: true });
        this.burstSparks(f.x, f.y, 8, [def.color, '#ffffff', def.color], 0.7);
        if (e.id === myId) sound('talent', 0.55);
      }
    }
    m.events.length = 0;
    if (this.pops.length > 40) this.pops.splice(0, this.pops.length - 40);
  }

  /**
   * The Gloamknight's own way of doing things (the owner, after playing one: "the class feels lame and boring, static
   * and not dynamic - animations wise ... make it better looking"): a two-handed blade that leaves a wide violet arc,
   * a reaping that goes all the way round, a rend that crosses itself, a toll that rolls out in rings of dusk.
   */
  private gloam(ab: Ability, f: Fighter): void {
    const a = Math.atan2(f.dirY, f.dirX);
    const at = { x: f.x + f.dirX * 7, y: f.y + f.dirY * 7 };
    const arc = (da: number, sweep: number, r: number, delay: number, heavy: boolean, color = '#4a1f9e', dur = 0.34): void => {
      this.arcs.push({ ...at, a: a + da, t: -delay, dur, color, edge: '#d8bcff', arc: sweep, r, heavy });
    };
    switch (ab.id) {
      case 'g-cleave':
        arc(0, 2.5, 38, 0, true);
        arc(0, 2.1, 30, 0.05, false, '#9a6cff', 0.26);
        break;
      case 'g-reap':
        // all the way round, front then back
        arc(0, 3, 44, 0, true);
        arc(Math.PI, 3, 44, 0.1, true);
        arc(0, 2.4, 34, 0.06, false, '#c02a7a', 0.3);
        break;
      case 'g-knife':
        // a short thrust, low
        arc(0, 0.5, 30, 0, false, '#b48cff', 0.18);
        break;
      case 'g-ambush':
        // two cuts that cross, out of nowhere
        arc(-0.55, 1.5, 34, 0, true);
        arc(0.55, 1.5, 34, 0.11, true, '#8a4ae0');
        break;
      case 'g-veil':
      case 'g-walk':
        // a puff of dusk where they were
        this.bursts.push({ x: f.x, y: f.y, t: 0, dur: 0.45, school: 'shadow', color: '#6a4aa0', big: false, heal: false, seed: f.x % 89 });
        break;
      case 'g-sever':
        arc(0, 0.6, 40, 0, true, '#9a6cff', 0.2);
        break;
      case 'g-super':
        arc(0, 3, 50, 0.12, true);
        arc(Math.PI, 3, 50, 0.2, true);
        arc(Math.PI / 2, 3, 40, 0.28, true, '#c02a7a');
        break;
      case 'g-super2':
        // out of the dark: a cross of cuts at their back, and the dusk closing over
        arc(-0.7, 1.6, 40, 0, true);
        arc(0.7, 1.6, 40, 0.08, true, '#8a4ae0');
        arc(0, 2.6, 46, 0.16, true, '#c02a7a');
        this.bursts.push({ x: f.x, y: f.y, t: 0, dur: 0.6, school: 'shadow', color: '#6a4aa0', big: true, heal: false, seed: f.x % 83 });
        break;
      case 'g-ward':
      case 'g-mantle':
        this.flashes.push({ x: f.x, y: f.y, t: 0, dur: 0.5, r: 24, color: '#8a5cff', ring: true });
        break;
      default:
        break;
    }
    while (this.arcs.length > 18) this.arcs.shift();
    while (this.tolls.length > 9) this.tolls.shift();
  }

  /** A ring of sparks thrown out from a spot, in these colors, `k` times as far and as many as a combo's. */
  private burstSparks(x: number, y: number, n: number, colors: string[], k: number): void {
    if (this.still) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ((x * 13 + y * 7 + i * 37) % 10) * 0.06;
      const v = (52 + ((i * 29) % 7) * 9) * k;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, up: 12, vu: 38 + ((i * 17) % 5) * 9, t: 0, dur: 0.42 + ((i * 11) % 4) * 0.06, color: colors[i % colors.length]!, w: (5.5 + (i % 3)) * (k > 1 ? 1.15 : 1) });
    }
    if (this.sparks.length > 120) this.sparks.splice(0, this.sparks.length - 120);
  }

  age(dt: number): void {
    for (const p of this.sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 3.2);
      p.vy *= 1 - Math.min(1, dt * 3.2);
      p.up = Math.max(0, p.up + p.vu * dt);
      p.vu -= 150 * dt;
    }
    this.sparks = this.sparks.filter((p) => p.t < p.dur);
    for (const f of this.flashes) f.t += dt;
    for (const d of this.drains) d.t += dt;
    this.drains = this.drains.filter((d) => d.t < d.dur);
    for (const z of this.zips) z.t += dt;
    this.zips = this.zips.filter((z) => z.t < z.dur);
    for (const z of this.falls) z.t += dt;
    this.falls = this.falls.filter((z) => z.t < z.dur);
    for (const h of this.hands) h.t += dt;
    this.hands = this.hands.filter((h) => h.t < h.dur);
    for (const o of this.tolls) o.t += dt;
    this.tolls = this.tolls.filter((o) => o.t < o.dur);
    for (const p of this.pops) p.t += dt;
    for (const b of this.bursts) b.t += dt;
    for (const a of this.arcs) a.t += dt;
    this.arcs = this.arcs.filter((a) => a.t < a.dur);
    for (const s of this.signs) s.t += dt;
    this.signs = this.signs.filter((s) => s.t < s.dur);
    for (const l of this.lines) l.t += dt;
    this.lines = this.lines.filter((l) => l.t < l.dur);
    for (const f of this.fades) f.t += dt;
    this.fades = this.fades.filter((f) => f.t < f.dur);
    for (const x of this.shatters) x.t += dt;
    this.shatters = this.shatters.filter((x) => x.t < x.dur);
    for (const s of this.supers) s.t += dt;
    this.supers = this.supers.filter((s) => s.t < 0.8);
    this.bursts = this.bursts.filter((b) => b.t < b.dur);
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    this.pops = this.pops.filter((p) => p.t < 0.9);
  }
}

function ring(g: Ctx, x: number, y: number, r: number, color: string, width = 1.4): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
  g.stroke();
}

/**
 * Who the player has chosen (the owner: "can you make the highlight marker a bit more stylish and visible, u need to
 * know who uve targeted super easily"): the enemy their harm goes to in red, the friend their help goes to in green,
 * and, with no enemy chosen, the one their harm goes to all the same (the nearest) in a quieter red.
 */
export type Chosen = 'foe' | 'friend' | 'auto';
export const PICK_COLOR: Record<Chosen, string> = { foe: '#ff4a5a', friend: '#6ee07a', auto: '#ff4a5a' };

/** An enemy ability's aim, for asking the rules whom the player's harm goes to when they have chosen nobody. */
const AT_FOE = { aim: 'enemy' } as Ability;

/** Whom the player has chosen, by fighter: their target, their friend, or the enemy their harm goes to unchosen. */
export function picksOf(m: Match, me: Fighter | null): Map<number, Chosen> {
  const out = new Map<number, Chosen>();
  if (!me || me.dead || m.phase === 'over') return out;
  const foe = me.target === null ? null : (m.fighters[me.target] ?? null);
  if (foe && !foe.dead && foe.team !== me.team && !m.unseen(foe, me)) out.set(foe.id, 'foe');
  else if (m.phase === 'fight') {
    const near = m.aimOf(me, AT_FOE);
    if (near && near !== me && !near.dead) out.set(near.id, 'auto');
  }
  const pal = me.friend === null ? null : (m.fighters[me.friend] ?? null);
  if (pal && pal !== me && !pal.dead && pal.team === me.team) out.set(pal.id, 'friend');
  return out;
}

/** A color of the form #rrggbb at this opacity. */
const tint = (hex: string, a: number): string => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

/**
 * The mark on the ground under whoever the player has chosen, in its flat frame (RingView.flat): a glow, four
 * brackets turning round them, each over a dark edge so it reads on sand and on ice alike, and four arrowheads
 * breathing in toward them. One the player's harm only falls to (`auto`) is quieter: no arrowheads, nothing turning.
 */
export function pickMark(g: Ctx, x: number, y: number, pick: Chosen, time: number, still = false): void {
  const color = PICK_COLOR[pick];
  const quiet = pick === 'auto';
  const R = 15;
  const glow = g.createRadialGradient(x, y, 2, x, y, R + 7);
  glow.addColorStop(0, tint(color, quiet ? 0.16 : 0.4));
  glow.addColorStop(1, tint(color, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.ellipse(x, y, R + 7, R + 7, 0, 0, Math.PI * 2);
  g.fill();
  const spin = still || quiet ? 0 : time * (pick === 'foe' ? 1.3 : -0.9);
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a0 = spin + (i * Math.PI) / 2 + 0.24;
    const a1 = a0 + Math.PI / 2 - 0.48;
    for (const [w, c] of [
      [quiet ? 3 : 4.2, 'rgba(10,4,18,0.7)'],
      [quiet ? 1.5 : 2.4, quiet ? tint(color, 0.7) : color],
    ] as const) {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.beginPath();
      g.ellipse(x, y, R, R, 0, a0, a1);
      g.stroke();
    }
  }
  g.lineCap = 'butt';
  if (quiet) return;
  // (long and narrow, so that each reads as pointing in at them and not as a corner)
  const out = R + 8 + (still ? 0 : Math.sin(time * 5) * 1.3);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4 - spin * 0.5;
    const cx = x + Math.cos(a) * out;
    const cy = y + Math.sin(a) * out;
    const nx = -Math.cos(a);
    const ny = -Math.sin(a);
    g.beginPath();
    g.moveTo(cx + nx * 4.6, cy + ny * 4.6);
    g.lineTo(cx - ny * 1.9, cy + nx * 1.9);
    g.lineTo(cx + ny * 1.9, cy - nx * 1.9);
    g.closePath();
    g.fillStyle = color;
    g.strokeStyle = 'rgba(10,4,18,0.75)';
    g.lineWidth = 1;
    g.stroke();
    g.fill();
  }
}

/**
 * The arrow over the head of whoever the player has chosen, its tip at `tip` (facing the camera, RingView.up): bobbing,
 * dark-edged with a light along one side; the friend's a little smaller; harm's unchosen target's an outline only.
 */
function pickArrow(g: Ctx, x: number, tip: number, pick: Chosen, time: number, still = false): void {
  const color = PICK_COLOR[pick];
  const k = pick === 'foe' ? 1 : 0.8;
  const y = tip - (still || pick === 'auto' ? 0 : Math.abs(Math.sin(time * 4)) * 1.6);
  const w = 4.2 * k;
  const h = 5.4 * k;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - w, y - h);
  g.lineTo(x - w * 0.35, y - h);
  g.lineTo(x - w * 0.35, y - h - 2.4 * k);
  g.lineTo(x + w * 0.35, y - h - 2.4 * k);
  g.lineTo(x + w * 0.35, y - h);
  g.lineTo(x + w, y - h);
  g.closePath();
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(10,4,18,0.85)';
  g.lineWidth = 1.3;
  g.stroke();
  if (pick === 'auto') {
    g.strokeStyle = tint(color, 0.8);
    g.lineWidth = 0.7;
    g.stroke();
    return;
  }
  g.fillStyle = color;
  g.fill();
  // (a light down its left edge)
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(x - w * 0.8, y - h + 0.5);
  g.lineTo(x - 0.4, y - 0.9);
  g.stroke();
}

/**
 * How high over the ground a fighter's head is drawn, and their bar over it: one of the raised dead stands lower, and
 * one caught up in a gale is lifted, bobbing. (The match screen sets a fighter's title over the same spot: RingMatch.)
 */
export function headHeight(f: Fighter, time: number): number {
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  return (f.pet ? HEAD * 0.8 : HEAD) + (gale ? 10 + Math.sin(time * 6) * 2 : 0);
}
/**
 * The least a fighter's bar stands over their head, in the ground's own units (headHeight's spot, drawn up): where it
 * stood for everyone before it made room under itself for a cast.
 */
const BAR_TOP_MIN = 6;
/** The clear air left between the lowest of a fighter's bar and their head. */
export const BAR_CLEAR = 1;
const HP_H = 2.4;
/** The cast under them, its name written in it, and the dark round it. */
const CAST_H = 4.8;
const CAST_W = 36;
const CAST_PAD = 0.6;

/** Whether a fighter can be seen casting: something on their bar has a cast or a channel (or a cast is under way). */
export const castsAny = (f: Pick<Fighter, 'bar' | 'cast'>): boolean =>
  !!f.cast ||
  f.bar.some((id) => {
    const ab = ABILITIES[id];
    return !!ab && (ab.cast > 0 || !!ab.channel);
  });

/**
 * Where each part of a fighter's overhead bar goes, down from the bar's top (`by`): the health, then the cast they are
 * holding with its name written in it, under it and not over it; how tall the dark backing behind the health is; and
 * how far down from `by` the lowest of it all comes (the cast's row is counted for whoever can cast at all, whether they
 * are casting now or not). (There was a mana strip under the health; the Ring has no mana now.)
 */
export function barRows(f: Pick<Fighter, 'bar' | 'cast'>, by: number): { hp: number; cast: number; back: number; low: number } {
  const back = 3.8;
  const cast = by + back + 0.4;
  return { hp: by, cast, back, low: castsAny(f) ? cast - by + CAST_H + CAST_PAD : back - 0.7 };
}

/**
 * How far over a fighter's head the top of their bar stands: high enough that the lowest of it (their cast, for whoever
 * casts) clears their head, so that nothing of it is ever drawn over them (the owner: "make sure the cast bar + hp/mana
 * bar dont cover any part of the actual characters"). It is the same whether they are casting or not, so the bar never
 * jumps when a cast begins. The title over the bar (RingMatch) stands on it too.
 */
export const barTop = (f: Pick<Fighter, 'bar' | 'cast'>): number => Math.max(BAR_TOP_MIN, barRows(f, 0).low + BAR_CLEAR);

/**
 * What is on a fighter: the rings at their feet, what's afoot on them, their bar and their cast. `raise`: how much
 * higher, in the ground's units, the pictures of what's on them go, to leave room for a title over the bar.
 */
function markFighter(g: Ctx, m: Match, f: Fighter, myId: number | null, time: number, seeable: boolean, view: RingView, raise = 0, pick: Chosen | null = null): void {
  if (f.dead) return;
  // what's on them that's a word: `head` is their head's height on the screen, drawn as if on their own spot (one of
  // the raised dead stands lower, and carries a smaller bar and no pictures)
  view.up(f.x, f.y, headHeight(f, time));
  const head = f.y;
  for (const a of f.auras) {
    if (a.cc === 'fear') {
      g.fillStyle = '#c88aff';
      g.font = '700 9px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('!', f.x, head - 1 + Math.sin(time * 9) * 1.5);
    } else if (a.cc === 'silence') {
      g.fillStyle = '#cfe0ff';
      g.font = '700 8px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('✕', f.x, head - 1);
    } else if (a.cc === 'incap' && a.ab !== 'm-toad' && a.ab !== 'l-gale') {
      g.fillStyle = '#fff2c0';
      g.font = '700 8px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('z', f.x + 5, head - 1 + Math.sin(time * 3) * 1.5);
    }
  }
  // a bar over the head, in their team's color
  const barW = f.pet ? 16 : 26;
  const by = head - barTop(f);
  const rows = barRows(f, by);
  g.fillStyle = 'rgba(6,2,14,0.85)';
  g.beginPath();
  g.roundRect(f.x - barW / 2 - 0.7, by - 0.7, barW + 1.4, rows.back, 1.2);
  g.fill();
  // (whoever the player has chosen: their bar ringed in the same color as the mark under them)
  if (pick && pick !== 'auto') {
    g.strokeStyle = PICK_COLOR[pick];
    g.lineWidth = 0.8;
    g.stroke();
  }
  const share = Math.max(0, f.hp / f.maxHp);
  g.fillStyle = f.team === m.fighters[myId ?? 0]?.team ? (share < 0.3 ? '#ff7a5a' : '#57d36a') : share < 0.3 ? '#ffb45c' : '#ff5a6a';
  g.beginPath();
  g.roundRect(f.x - barW / 2, rows.hp, barW * share, HP_H, 1);
  g.fill();
  // out of your sight: a small eye-shut mark over them
  if (!seeable) {
    g.strokeStyle = '#a8a0b8';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(f.x - 4, by - 3);
    g.lineTo(f.x + 4, by - 3);
    g.stroke();
  }
  // what's on them, over the bar: each effect as its own spell's picture, edged red for harm and green for help, with
  // the seconds it has left written on it. (They were plain squares of the spell's color, darkening as they wore
  // off: the owner, "the debuffs are just squares and i dont understand anything from them ... make the square with
  // the spells icon image and add a 7s 6s timer on it".) Only the holds and the player's own, three at most: the rest
  // are on the nameplates (overhead).
  const viewer = myId === null ? null : (m.fighters[myId] ?? null);
  const shown = f.pet ? [] : overhead(f, myId, !!viewer && viewer.team === f.team);
  const pip = 10.6;
  const gap = 1.4;
  let px = f.x - (shown.length * (pip + gap) - gap) / 2;
  const py = by - pip - 2.6 - raise;
  g.textAlign = 'center';
  g.lineJoin = 'round';
  for (const a of shown) {
    const ab = lookOf(a.ab)!;
    g.fillStyle = 'rgba(6,2,14,0.92)';
    g.fillRect(px - 0.7, py - 0.7, pip + 1.4, pip + 1.4);
    const smooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    if (!drawIcon(g, ab.icon, px, py, pip)) {
      g.fillStyle = ab.color;
      g.fillRect(px, py, pip, pip);
    }
    g.imageSmoothingEnabled = smooth;
    g.strokeStyle = a.harmful ? '#ff4a5a' : '#6ee07a';
    g.lineWidth = 0.8;
    g.strokeRect(px - 0.4, py - 0.4, pip + 0.8, pip + 0.8);
    // (the seconds, on its lower half where a thumb-sized picture can still be told by its top: whole ones, the last
    // of them as "1s")
    const left = `${Math.max(1, Math.ceil(a.t))}s`;
    g.font = '800 6px "Bricolage Grotesque Variable", system-ui, sans-serif';
    g.lineWidth = 1.9;
    g.strokeStyle = '#0a0612';
    g.strokeText(left, px + pip / 2, py + pip - 0.9);
    g.fillStyle = '#ffffff';
    g.fillText(left, px + pip / 2, py + pip - 0.9);
    px += pip + gap;
  }
  // whoever the player has chosen: an arrow over all of it (the bar, a title, what's on them), pointing down at them
  if (pick) pickArrow(g, f.x, (shown.length ? py - 0.7 : by - 1.2 - raise) - 1.2, pick, time, view.still);
  // the cast they're holding: a bar of its own under the life, its name written in it, so a cast to stop can be seen
  // and read, all of it over their head (the name was under the bar, across their face)
  const c = f.cast;
  if (c) {
    const ab = ABILITIES[c.ab];
    const k = Math.min(1, c.t / c.dur);
    const cw = CAST_W;
    const cy = rows.cast;
    g.fillStyle = 'rgba(6,2,14,0.88)';
    g.beginPath();
    g.roundRect(f.x - cw / 2 - CAST_PAD, cy - CAST_PAD, cw + CAST_PAD * 2, CAST_H + CAST_PAD * 2, 1.2);
    g.fill();
    g.fillStyle = ab?.color ?? '#fff';
    g.fillRect(f.x - cw / 2, cy, cw * (c.channel ? 1 - k : k), CAST_H);
    if (ab) {
      // (a long name is set a little smaller rather than run out of its bar)
      let size = 3.8;
      g.font = `700 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
      const wide = g.measureText(ab.name).width;
      if (wide > cw - 2) {
        size *= (cw - 2) / wide;
        g.font = `700 ${size.toFixed(2)}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 1.1;
      g.lineJoin = 'round';
      g.strokeStyle = '#120a20';
      g.strokeText(ab.name, f.x, cy + CAST_H / 2 + 0.2);
      g.fillStyle = '#fff6e0';
      g.fillText(ab.name, f.x, cy + CAST_H / 2 + 0.2);
      g.textBaseline = 'alphabetic';
    }
  }
}

/** How high a fighter's head stands, in world pixels. */
const HEAD = 30;

/** How far along its way a bolt thrown to be watched is drawn at `u` of its time: off the hand gently, then faster and faster. */
export const flyEase = (u: number): number => 0.15 * u + 0.85 * u * u;

/**
 * The spells in flight and what's afoot on the fighters: handed to the shaders before the frame is drawn. `at` is where
 * each body was drawn (RingStage.bodyAt): what goes about on a fighter is drawn there, with the body.
 */
export function ringSpells(q: Fx3D, m: Match, fx: RingFx, myId: number | null, time: number, air: RingAir, at: (f: Fighter) => { x: number; y: number } = (f) => f): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  for (const tr of m.traps) {
    const enemy = me && tr.team !== me.team;
    // an enemy's trap is hard to see, but not impossible
    q.put({ kind: FX.trap, x: tr.x, y: tr.y, flat: true, w: 26, a: tr.arm > 0 ? '#a8a0b8' : '#e8c070', t: tr.arm > 0 ? 0 : 1, alpha: enemy ? 0.42 : 1 });
  }
  for (const f of air.flames) {
    const k = f.size ?? 1;
    q.put({ kind: FX.glow, x: f.x, y: f.y, up: f.h + 5 * k, w: 44 * k, a: '#ff7a2d', alpha: 0.5 });
    q.put({ kind: FX.flame, x: f.x, y: f.y, up: f.h - 2, base: true, w: 15 * k, h: 22 * k, a: '#f4561f', b: '#ffb02e', seed: f.x * 0.37 });
  }
  for (const s of air.smokes) {
    const k = s.size ?? 1;
    for (let i = 0; i < 3; i++) {
      const u = (time * 0.22 + i / 3 + s.x * 0.013) % 1;
      q.put({ kind: FX.smoke, x: s.x + Math.sin(time * 0.6 + i * 2) * 4 * u + u * 8, y: s.y, up: s.h + u * 44 * k, w: (12 + u * 26) * k, a: s.tone, alpha: 0.44 * Math.sin(u * Math.PI), t: 0.3, seed: s.x + i });
    }
  }
  for (const g of air.glints) {
    const u = (time * 0.17 + g.x * 0.131 + g.h * 0.37) % 1;
    if (u < 0.1) q.put({ kind: FX.spark, x: g.x, y: g.y, up: g.h, w: 3 + Math.sin((u / 0.1) * Math.PI) * 11, a: '#ffffff', t: 0.2, alpha: 0.95 });
  }
  if (air.embers.length) {
    for (let i = 0; i < 34; i++) {
      const e = air.embers[i % air.embers.length]!;
      const u = (time * (0.16 + (i % 5) * 0.03) + i * 0.137) % 1;
      q.put({ kind: FX.spark, x: e.x + Math.sin(time * 1.1 + i) * (5 + u * 14) + ((i * 13) % 18) - 9, y: e.y + ((i * 7) % 12) - 6, up: 2 + u * 62, w: 3.4 - u * 1.8, a: u < 0.5 ? '#ffd27a' : '#ff6a2a', t: 0.2, alpha: 1 - u });
    }
  }
  // (nothing goes about on one of the other side in the shroud: they are not there to be seen)
  // (one of the other side in the shroud; and anyone at all up in the dark before they come down)
  const unseen = (f: Fighter): boolean => (!!me && m.unseen(f, me)) || m.aloft(f);
  for (const f of m.fighters) {
    if (unseen(f)) continue;
    const p = at(f);
    ringMarks(q, p.x === f.x && p.y === f.y ? f : { ...f, x: p.x, y: p.y }, time);
    if (f.dead || f.pet) continue;
    // what they carry of their combo, for both sides to read: the points they hold, each kind in its own shape, and a
    // boon waiting to be used (render/ringSigns.ts)
    if (f.points && f.pts > 0) drawPoints(q, p.x, p.y, f.points.name, f.pts, f.points.max, f.points.color, time, f.id * 1.9);
    for (const b of f.boons) {
      const def = BOONS[b.id];
      if (def && !def.quiet && b.n > 0) drawBoon(q, p.x, p.y, def.color, b.n, time, f.id * 2.3 + def.dur);
    }
  }
  // a life being drunk: for as long as the channel lasts, a stream of it from whoever is drunk from to the drinker,
  // swaying, thicker toward the mouth
  for (const f of m.fighters) {
    if (!f.cast?.channel || f.dead || unseen(f)) continue;
    const ab = ABILITIES[f.cast.ab];
    const to = m.fighters[f.cast.target];
    if (!ab || !to || to === f || to.dead || unseen(to) || !ab.effects.some((x) => x.k === 'dmg') || !ab.effects.some((x) => x.k === 'heal')) continue;
    const a0 = at(to);
    const a1 = at(f);
    const dx = a1.x - a0.x;
    const dy = a1.y - a0.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(6, Math.min(16, Math.round(len / 9)));
    for (let i = 0; i < n; i++) {
      const u = (i / n + time * 1.3) % 1;
      const sway = Math.sin(u * Math.PI * 3 + time * 5) * 5 * Math.sin(u * Math.PI);
      // (dark motes with a bright rim between the bright ones: the stream is seen on snow and on stone alike)
      const mote = { x: a0.x + dx * u + (-dy / len) * sway, y: a0.y + dy * u + (dx / len) * sway, up: 14 + Math.sin(u * Math.PI) * 5 };
      if (i % 2) q.put({ kind: FX.shadow, ...mote, w: 8 + u * 6, a: ab.color, b: '#120a20', seed: i });
      else q.put({ kind: FX.spark, ...mote, w: 7 + u * 6, a: i % 4 ? ab.color : '#ff5a8a', t: 0.25, alpha: 0.95 });
    }
    q.put({ kind: FX.rift, x: a0.x, y: a0.y, up: 15, w: 18, a: ab.color, b: '#ff5a8a', t: (time * 0.8) % 1, alpha: 0.8, seed: f.id });
    q.put({ kind: FX.glow, x: a1.x, y: a1.y, up: 14, w: 30, a: ab.color, alpha: 0.45 + Math.sin(time * 8) * 0.12 });
  }
  // a chain thrown: its links out along the line to whoever it has, flung out and then drawn taut
  for (const l of fx.lines) {
    const from = m.fighters[l.from];
    const to = m.fighters[l.to];
    if (!from || !to) continue;
    const a0 = at(from);
    const a1 = at(to);
    const u = l.t / l.dur;
    const out = Math.min(1, u * 3);
    const n = Math.max(5, Math.min(14, Math.round(Math.hypot(a1.x - a0.x, a1.y - a0.y) / 9)));
    for (let i = 1; i <= n; i++) {
      const k = (i / n) * out;
      const sag = Math.sin(k * Math.PI) * 6 * (1 - u);
      q.put({ kind: FX.chip, x: a0.x + (a1.x - a0.x) * k, y: a0.y + (a1.y - a0.y) * k, up: 13 + sag, w: 5.5, rot: i * 0.9 + time * 3, a: '#b8b0c8', b: '#6a5a8a', alpha: 1 - Math.max(0, u - 0.7) / 0.3 });
    }
  }
  // someone up in the dark (Night's Ruin): where they left the ground, the dark going up; over whoever it is for, a
  // shadow that grows on the ground and the night coming down, faster and faster
  for (const f of m.fighters) {
    if (!f.dive) continue;
    const ab = ABILITIES[f.dive.ab];
    const dur = ab?.dive ?? 1;
    const u = 1 - Math.max(0, f.dive.t) / dur;
    q.put({ kind: FX.column, x: f.x, y: f.y, base: true, w: 16, h: 150, a: '#4a1f9e', b: '#d8bcff', t: Math.min(1, u * 1.6), seed: f.id });
    for (let i = 0; i < 4; i++) q.put({ kind: FX.smoke, x: f.x + Math.cos(i * 1.6 + time) * 8, y: f.y + Math.sin(i * 1.6 + time) * 4, up: 6 + u * 30 + i * 6, w: 18, a: '#3a1460', alpha: 0.6 * (1 - u), t: 0.3, seed: i });
    const to = m.fighters[f.dive.target];
    if (!to || to.dead || (me && m.unseen(to, me))) continue;
    const p = at(to);
    q.put({ kind: FX.shadow, x: p.x, y: p.y, up: 2, flat: true, w: 20 + u * 44, a: '#0a0314', b: '#c02a7a', t: u, alpha: 0.35 + u * 0.55, seed: f.id });
    q.put({ kind: FX.ring, x: p.x, y: p.y, flat: true, w: (20 + u * 44) * (1.6 - u * 0.6), a: '#c02a7a', t: 0.5, alpha: 0.4 + u * 0.6, seed: f.id });
    const h = (1 - u * u) * 170 + 16;
    q.put({ kind: FX.shadow, x: p.x, y: p.y, up: h, w: 20 + u * 10, a: '#b48cff', b: '#120a20', seed: f.id + 1 });
    for (let i = 1; i <= 3; i++) q.put({ kind: FX.shadow, x: p.x, y: p.y, up: h + i * 13, w: 15 - i * 3, a: '#8a5cff', b: '#120a20', alpha: 0.8 - i * 0.2, seed: f.id + i });
  }
  for (const b of m.bolts) {
    const ab = ABILITIES[b.ab];
    const c = ab?.color ?? '#ffffff';
    const a = Math.atan2(b.vy, b.vx);
    const el = SCHOOL_EL[ab?.school ?? ''] ?? 'arcane';
    const tone = el === 'trail' ? { a: c, b: '#ffffff' } : (TONES[el] ?? { a: c, b: '#ffffff' });
    const k = ab?.super ? 1.7 : 1;
    const strong = !!b.p?.combo || (b.p?.k ?? 1) > 1.3;
    if (b.dur !== undefined && b.x0 !== undefined && b.y0 !== undefined) {
      // one thrown to be watched: from where it left the hand to where its target's body is drawn now, slow to come
      // off the hand and quicker and quicker into them (flyEase), so that it lands as it is seen to
      const to = m.fighters[b.tgt];
      const end = to && !to.dead ? at(to) : { x: b.x, y: b.y + 8 };
      const u = Math.min(1, b.age / b.dur);
      const e = flyEase(u);
      const dx = end.x - b.x0;
      const dy = end.y - 8 - b.y0;
      const d = Math.hypot(dx, dy) || 1;
      if (drawFlight(q, b.ab, b.x0 + dx * e, b.y0 + dy * e, dx / d, dy / d, time, b.src * 1.7 + b.tgt, d * e, strong, u)) continue;
    }
    // (in its own shape, if it has one: render/ringSigns.ts; a seed that stays with it, so nothing about it flickers)
    if (drawFlight(q, b.ab, b.x, b.y, Math.cos(a), Math.sin(a), time, b.src * 1.7 + b.tgt, 0, strong)) continue;
    shot(q, el === 'trail' ? 'orb' : el, b.x, b.y, Math.cos(a) * 100, Math.sin(a) * 100, 14 * k, 3.4 * k, b.x * 0.03 + b.y * 0.05, tone);
  }
  // what is thrown and lands at once: seen crossing, all the same
  for (const z of fx.zips) {
    const ab = lookOf(z.ab);
    const c = ab?.color ?? '#ffffff';
    const el = SCHOOL_EL[ab?.school ?? ''] ?? 'arcane';
    const tone = el === 'trail' ? { a: c, b: '#ffffff' } : (TONES[el] ?? { a: c, b: '#ffffff' });
    // (it goes to where they are now, not where they stood as it left the hand)
    const aim = z.to === undefined ? undefined : m.fighters[z.to];
    const end = aim && !aim.dead ? at(aim) : { x: z.x1, y: z.y1 };
    const a = Math.atan2(end.y - z.y0, end.x - z.x0);
    const zu = Math.min(1, z.t / z.dur);
    if (drawFlight(q, z.ab, z.x0 + (end.x - z.x0) * zu, z.y0 - 8 + (end.y - z.y0) * zu, Math.cos(a), Math.sin(a), time, z.x0 * 0.03, Math.hypot(end.x - z.x0, end.y - z.y0) * zu, false, zu)) continue;
    for (let i = 0; i < 3; i++) {
      const u = Math.min(1, Math.max(0, z.t / z.dur - i * 0.14));
      shot(q, el === 'trail' ? 'orb' : el, z.x0 + (z.x1 - z.x0) * u, z.y0 - 8 + (z.y1 - z.y0) * u, Math.cos(a) * 100, Math.sin(a) * 100, 13 - i * 3, 3.2 - i * 0.7, z.x0 * 0.03 + i, tone);
    }
  }
  // what was placed, on its way down: it falls out of the sky onto the middle of its patch
  for (const z of m.zones) {
    const ab = ABILITIES[z.ab];
    if (!ab) continue;
    const u = 1 - Math.max(0, z.t) / z.dur;
    const el = SCHOOL_EL[ab.school] ?? 'arcane';
    const tone = el === 'trail' ? { a: ab.color, b: '#ffffff' } : (TONES[el] ?? { a: ab.color, b: '#ffffff' });
    const big = ab.super ? 1.8 : 1;
    if (ab.school === 'shadow') {
      // (a rift does not fall: it opens)
      q.put({ kind: FX.shadow, x: z.x, y: z.y, up: 3, flat: true, w: z.r * 2 * (0.3 + u * 0.7), a: '#0a0314', b: '#7a3cff', t: u, alpha: 0.5 + u * 0.4, seed: z.x });
      for (let i = 0; i < 6; i++) {
        const ang = time * 2.4 + (i / 6) * Math.PI * 2;
        q.put({ kind: FX.smoke, x: z.x + Math.cos(ang) * z.r * 0.6 * u, y: z.y + Math.sin(ang) * z.r * 0.6 * u, up: 6 + u * 10, w: 16, a: '#3a1460', alpha: 0.6 * u, t: 0.3, seed: i });
      }
    } else if (ab.school === 'nature' || ab.school === 'physical') {
      // (a volley: many small things coming down all over it; thorns: the same, coming up)
      for (let i = 0; i < 12; i++) {
        const ang = i * 2.4;
        const rr = z.r * Math.sqrt(((i * 37) % 100) / 100) * 0.9;
        const v = Math.min(1, Math.max(0, u * 1.25 - (i % 4) * 0.08));
        q.put({ kind: FX.spark, x: z.x + Math.cos(ang) * rr + (1 - v) * 26, y: z.y + Math.sin(ang) * rr, up: (1 - v) * 130 + 2, w: 6, a: tone.a, b: tone.b, t: 0.2, alpha: 0.4 + v * 0.6 });
      }
    } else {
      // (a comet, a lance of sun: one thing, from high up and a little to one side)
      const h = (1 - u) * (1 - u) * 190;
      shot(q, el === 'trail' ? 'orb' : el, z.x + (1 - u) * 46, z.y - h, -60, 100, 15 * big, 3.6 * big, z.x * 0.03, tone);
      q.put({ kind: FX.glow, x: z.x, y: z.y, up: 4, w: z.r * (0.6 + u), a: tone.a, alpha: 0.2 + u * 0.45 });
    }
  }
  for (const z of fx.falls) {
    const ab = ABILITIES[z.ab];
    const u = z.t / z.dur;
    q.put({ kind: FX.glow, x: z.x, y: z.y, up: 6, w: z.r * 2.2, a: ab?.color ?? '#ffffff', alpha: 0.8 * (1 - u) });
    q.put({ kind: FX.ring, x: z.x, y: z.y, flat: true, w: z.r * 2 * (0.5 + u * 0.5), a: ab?.color ?? '#ffffff', t: u, alpha: 1 - u, seed: 2 });
    if (ab?.school === 'fire') for (let i = 0; i < 7; i++) q.put({ kind: FX.flame, x: z.x + Math.cos(i * 0.9) * z.r * 0.55, y: z.y + Math.sin(i * 0.9) * z.r * 0.55, up: -2, base: true, w: 13, h: 26 * (1 - u), a: '#f4561f', b: '#ffb02e', seed: i * 0.7 });
    if (ab?.school === 'holy') q.put({ kind: FX.shaft, x: z.x, y: z.y, base: true, w: z.r * 0.9, h: 120, a: ab.color, b: '#ffffff', t: u, alpha: 1 - u });
  }
  // the healing spheres: green, bobbing, there for whoever is hurt
  for (const o of m.orbs) {
    if (m.phase !== 'fight' || m.clock < o.at) continue;
    const bob = Math.sin(time * 2.6 + o.x) * 2;
    q.put({ kind: FX.glow, x: o.x, y: o.y, up: 10 + bob, w: 34, a: '#58e07a', alpha: 0.6 });
    q.put({ kind: FX.orb, x: o.x, y: o.y, up: 10 + bob, w: 10, a: '#7dff9a', b: '#eafff0', t: 0.3, seed: time + o.x });
    for (let i = 0; i < 3; i++) {
      const u = (time * 0.5 + i / 3 + o.y * 0.01) % 1;
      q.put({ kind: FX.spark, x: o.x + Math.sin(i * 2.1 + o.x) * 6, y: o.y, up: 8 + u * 22, w: 4 - u * 2.4, a: '#c8ffd4', t: 0.2, alpha: 1 - u });
    }
  }
  // a leap or a rush: a streak of light behind
  for (const f of m.fighters) {
    if (!f.dash || f.dead || unseen(f)) continue;
    for (let i = 1; i <= 4; i++) {
      const dx = f.dash.x - f.x;
      const dy = f.dash.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      q.put({ kind: FX.spark, x: f.x - (dx / d) * i * 5, y: f.y - (dy / d) * i * 5, up: 10 + i, w: 7 - i, a: '#bff4ff', t: 0.2, alpha: 1 - i * 0.2 });
    }
  }
  // a super: a column of light on whoever let it go
  for (const s of fx.supers) {
    const f = m.fighters[s.id];
    if (!f) continue;
    const u = s.t / 0.8;
    q.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: 34, h: 90, a: classColor(f.cls), b: '#ffffff', t: u, alpha: 1 - u });
  }
  // the sigil in the middle, turning and shining, worth the run
  if (m.sigil) {
    const s = m.sigil;
    const bob = Math.sin(time * 3) * 2;
    q.put({ kind: FX.glow, x: s.x, y: s.y, up: 12 + bob, w: 50, a: '#ffd76a', alpha: 0.75 });
    q.put({ kind: FX.ring, x: s.x, y: s.y, flat: true, w: 30, a: '#ffe27a', t: (time * 0.6) % 1, seed: 3 });
    q.put({ kind: FX.orb, x: s.x, y: s.y, up: 12 + bob, w: 13, a: '#ffe27a', b: '#ffffff', t: 0.3, seed: time });
    for (let i = 0; i < 5; i++) {
      const ang = time * 1.8 + (i / 5) * Math.PI * 2;
      q.put({ kind: FX.spark, x: s.x + Math.cos(ang) * 11, y: s.y + Math.sin(ang) * 5, up: 12 + bob + Math.sin(ang * 2) * 3, w: 4, a: '#fff6c8', t: 0.2, alpha: 0.9 });
    }
  }
  // what was left on the ground (a globe of rime drifting on): a ball of its own stuff over the middle of its patch,
  // motes turning round it, and a mist to its edge, fading as its time runs out
  for (const fd of m.fields) {
    const ab = ABILITIES[fd.ab];
    if (!ab) continue;
    const el = SCHOOL_EL[ab.school] ?? 'arcane';
    const tone = el === 'trail' ? { a: ab.color, b: '#ffffff' } : (TONES[el] ?? { a: ab.color, b: '#ffffff' });
    const left = Math.min(1, fd.t / 0.6);
    // (one that hunts has a look of its own: render/ringSigns.ts)
    if (ab.field?.seek) {
      drawGlobe(q, fd.x, fd.y, fd.r, fd.vx, fd.vy, ab.field.tick - Math.max(0, fd.next), left, time);
      continue;
    }
    const bob = Math.sin(time * 3 + fd.x) * 2;
    q.put({ kind: FX.glow, x: fd.x, y: fd.y, up: 4, w: fd.r * 2.1, a: tone.a, alpha: 0.3 * left });
    q.put({ kind: FX.glow, x: fd.x, y: fd.y, up: 14 + bob, w: 30, a: tone.a, alpha: 0.75 * left });
    q.put({ kind: FX.orb, x: fd.x, y: fd.y, up: 14 + bob, w: 12, a: tone.a, b: tone.b, t: 0.3, seed: time + fd.x, alpha: left });
    for (let i = 0; i < 6; i++) {
      const ang = time * 2.2 + (i / 6) * Math.PI * 2;
      const rr = fd.r * (0.45 + 0.4 * ((i * 37) % 10) * 0.1);
      q.put({ kind: FX.spark, x: fd.x + Math.cos(ang) * rr, y: fd.y + Math.sin(ang) * rr * 0.9, up: 6 + ((i * 13) % 7), w: 5, a: tone.b, t: 0.2, alpha: 0.8 * left });
    }
  }
  for (const f of fx.flashes) {
    const u = f.t / f.dur;
    if (f.ring) q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: f.r * 2, a: f.color, t: u, seed: f.r });
    else q.put({ kind: FX.impact, x: f.x, y: f.y, up: 12, w: f.r * 2.4, a: f.color, b: '#fffdf0', t: u, seed: f.x * 0.2 });
  }
  for (const b of fx.bursts) landing(q, b);
  for (const f of fx.fades) drawFade(q, f.x, f.y, f.t / f.dur, f.seed);
  // (a Shatter goes with whoever it broke on, where their body is drawn)
  for (const x of fx.shatters) {
    const on = m.fighters[x.on];
    const p = on && !on.dead ? at(on) : x;
    drawShatter(q, p.x, p.y, Math.min(1, x.t / x.dur), x.a, x.seed);
  }
  // each ability's own sign: on its user as it is used, on whoever it lands on (and going with them), on its patch
  for (const s of fx.signs) {
    const on = s.on === undefined ? undefined : m.fighters[s.on];
    const p = on && !on.dead ? at(on) : s;
    drawSign(q, s, p.x, p.y, time);
  }
  // (an arc may wait its turn: the second cut of a rend, the back half of a reaping)
  for (const a of fx.arcs) if (a.t >= 0) q.put({ kind: FX.slash, x: a.x, y: a.y, up: 13, flat: true, w: (a.r * 2) / 0.82, rot: a.a, a: a.color, b: a.edge, t: a.t / a.dur, p1: a.arc, p2: a.heavy ? 1 : 0 });
  // a combo's and a super's sparks
  for (const p of fx.sparks) {
    const u = p.t / p.dur;
    q.put({ kind: FX.spark, x: p.x, y: p.y, up: p.up, w: p.w * (1 - u * 0.5), a: p.color, t: 0.25, alpha: 1 - u * u, seed: p.w });
  }
  // life drunk: motes that leave the one struck, swing wide and home on the one who struck
  for (const d of fx.drains) {
    const to = m.fighters[d.to];
    if (!to || to.dead) continue;
    for (let i = 0; i < d.n; i++) {
      const u = Math.min(1, Math.max(0, (d.t / d.dur) * 1.25 - i * 0.045));
      if (u <= 0 || u >= 1) continue;
      const e = u * u * (3 - 2 * u);
      const side = (i % 2 ? 1 : -1) * (6 + (i % 3) * 4) * Math.sin(u * Math.PI);
      const dx = to.x - d.x;
      const dy = to.y - d.y;
      const l = Math.hypot(dx, dy) || 1;
      q.put({ kind: FX.spark, x: d.x + dx * e + (-dy / l) * side, y: d.y + dy * e + (dx / l) * side, up: 12 + Math.sin(u * Math.PI) * 9, w: 7.5 - u * 3, a: i % 3 ? '#d05aff' : '#ff5a8a', t: 0.25, alpha: 0.95, seed: i });
    }
  }
  // a hand of shadow: five fingers come up round them and close, in a pool of dark
  for (const h of fx.hands) {
    const u = h.t / h.dur;
    const up = Math.min(1, u * 4);
    const close = Math.min(1, Math.max(0, (u - 0.2) * 3));
    const fade = Math.max(0, 1 - Math.max(0, u - 0.75) * 4);
    q.put({ kind: FX.ring, x: h.x, y: h.y, flat: true, w: 40 - close * 10, a: '#7a3cff', t: 0.35, alpha: fade, seed: 5 });
    q.put({ kind: FX.shaft, x: h.x, y: h.y, base: true, w: 20, h: 40 * up, a: '#4a1a8a', b: '#c8a8ff', t: 0.4, alpha: 0.6 * fade });
    for (let i = 0; i < 5; i++) {
      const ang = -0.2 + (i / 4) * (Math.PI + 0.4);
      const r = 15 - close * 8;
      q.put({ kind: FX.shadow, x: h.x + Math.cos(ang) * r, y: h.y + Math.sin(ang) * r * 0.55 + 2, up: 4 + up * (20 + (i % 2) * 5) - close * 4, w: 11, a: '#b48cff', b: '#120a20', alpha: fade, seed: i * 3.1 });
      q.put({ kind: FX.shadow, x: h.x + Math.cos(ang) * (r + 2), y: h.y + Math.sin(ang) * (r + 2) * 0.55 + 2, up: 2 + up * 9, w: 9, a: '#8a5cff', b: '#120a20', alpha: fade * 0.9, seed: i * 1.7 });
    }
  }
  // a toll of dusk: rings rolling out one after another, the dark thrown ahead of them
  for (const o of fx.tolls) {
    if (o.t < 0) continue;
    const u = o.t / o.dur;
    q.put({ kind: FX.ring, x: o.x, y: o.y, flat: true, w: o.r * 2 * (0.25 + u * 0.75), a: '#8a5cff', t: u, alpha: 1 - u * 0.6, seed: o.r });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + o.r;
      q.put({ kind: FX.shadow, x: o.x + Math.cos(ang) * o.r * u, y: o.y + Math.sin(ang) * o.r * u * 0.7, up: 8 + Math.sin(u * Math.PI) * 8, w: 12 * (1 - u * 0.5), a: '#b48cff', b: '#120a20', alpha: 1 - u, seed: i });
    }
  }
  // the gloam that goes about with a Gloamknight: dark rising off them, a violet light at their feet, and when they
  // lunge, the dark they came through. All of it where the body is drawn, which a blow carries forward and a flinch
  // rocks: on the rules' spot it stood still while the body stepped away from it and back, and the dark about him
  // jumped at every blow (the owner: "gloamknight's orb effect around the character jitters when moving vs another
  // player")
  for (const f of m.fighters) {
    // (and the gloam about him goes with him into the shroud: his own side sees him by his shape alone)
    if (f.cls !== 'gloamknight' || f.dead || f.pet || m.hidden(f)) continue;
    const p = at(f);
    q.put({ kind: FX.glow, x: p.x, y: p.y, up: 3, w: 34, a: '#7a3cff', alpha: 0.2 + Math.sin(time * 2.2 + f.id) * 0.05 });
    // their wake: a trail of soft dark where they have just been, long in a lunge and short at a walk. (Not a faded
    // copy of the figure: a figure can only be thinned by a stipple here, and a stippled ghost reads as a fault.) Laid
    // along the way they went (the rules' spot: a blow's step forward and back is not a way gone), each puff its own
    // for as long as it lasts: render/ring.ts trailWake
    let wake = fx.wakes.get(f.id);
    if (!wake) fx.wakes.set(f.id, (wake = newWake(f.x, f.y)));
    trailWake(wake, f.x, f.y, time, f.dash ? 0.5 : 0.32);
    for (const b of wakeBlobs(wake, time)) q.put({ kind: FX.shadow, x: b.x, y: b.y, up: b.up, w: b.w, a: b.high ? '#b48cff' : '#8a5cff', b: '#120a20', alpha: b.alpha, seed: b.seed + f.id });
    for (let i = 0; i < 4; i++) {
      const u = (time * 0.55 + i / 4 + f.id * 0.31) % 1;
      const ang = i * 1.9 + f.id + time * 0.7;
      q.put({ kind: FX.shadow, x: p.x + Math.cos(ang) * 8, y: p.y + Math.sin(ang) * 4.5, up: 2 + u * 26, w: 9 - u * 5, a: '#9a6ae0', b: '#120a20', alpha: 0.75 * Math.sin(u * Math.PI), seed: i + f.id });
    }
    if (f.dash) {
      const dx = f.dash.x - f.x;
      const dy = f.dash.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 1; i <= 6; i++) q.put({ kind: FX.shadow, x: f.x - (dx / d) * i * 7, y: f.y - (dy / d) * i * 7, up: 12, w: 16 - i * 1.6, a: '#b48cff', b: '#120a20', alpha: 1 - i * 0.14, seed: i });
    }
  }
  // the ashbound dead: a pool of the gloam they climb out of, a cold light in their skulls, the dark smoking off them,
  // and as their time runs out they thin
  // (where the body is drawn, which a blow carries a step forward: on the rules' spot they stayed behind it)
  for (const f of m.fighters) {
    if (!f.pet || f.dead) continue;
    const age = f.pet.max - f.pet.life;
    const fade = Math.min(1, f.pet.life / 2);
    const p = at(f);
    if (age < 0.9) {
      const u = age / 0.9;
      q.put({ kind: FX.shadow, x: f.x, y: f.y, up: 2, flat: true, w: 26 * (0.5 + u * 0.5), a: '#0a0314', b: '#7a3cff', t: u, alpha: 0.9 * (1 - u), seed: f.id });
    }
    q.put({ kind: FX.glow, x: p.x, y: p.y, up: 2, w: 22, a: '#7a3cff', alpha: 0.18 * fade });
    q.put({ kind: FX.spark, x: p.x, y: p.y, up: THRALL_EYES, w: 4.5, a: '#d8bcff', t: 0.1, alpha: 0.8 * fade });
    const u = (time * 0.7 + f.id * 0.37) % 1;
    q.put({ kind: FX.shadow, x: p.x + Math.sin(time * 1.3 + f.id) * 3, y: p.y, up: 4 + u * 20, w: 7 - u * 3, a: '#9a6ae0', b: '#120a20', alpha: 0.6 * Math.sin(u * Math.PI) * fade, seed: f.id });
  }
  const map = MAPS[m.map] ?? Object.values(MAPS)[0]!;
  // sand on the wind, low over the ground
  if (map.theme === 'sands') {
    for (let i = 0; i < 9; i++) {
      const u = (time * (0.05 + (i % 3) * 0.018) + i * 0.117) % 1;
      q.put({ kind: FX.smoke, x: u * (ARENA_W + 80) - 40, y: ((i * 67) % ARENA_H) + Math.sin(time * 0.3 + i) * 8, up: 4, w: 44 + (i % 4) * 12, a: '#f2deb2', alpha: 0.13 * Math.sin(u * Math.PI), t: 0.3, seed: i * 3.1 });
    }
  }
  // snow coming down over the frozen ground, and blown along it
  if (map.theme === 'frost') {
    for (let i = 0; i < 46; i++) {
      const speed = 12 + (i % 6) * 5;
      const x = (((i * 83 + Math.sin(time * 0.7 + i) * 14 + time * (5 + (i % 3) * 4)) % ARENA_W) + ARENA_W) % ARENA_W;
      const y = (i * 53 + time * speed * 0.3) % ARENA_H;
      const up = 60 - ((time * speed + i * 17) % 60);
      q.put({ kind: FX.spark, x, y, up, w: 4 + (i % 3) * 1.5, a: '#ffffff', alpha: 0.5 + (i % 4) * 0.12, t: 0.3 });
    }
    for (let i = 0; i < 7; i++) {
      const u = (time * (0.07 + (i % 3) * 0.02) + i * 0.143) % 1;
      q.put({ kind: FX.smoke, x: u * (ARENA_W + 80) - 40, y: ((i * 83) % ARENA_H) + Math.sin(time * 0.4 + i) * 7, up: 3, w: 40 + (i % 4) * 10, a: '#ffffff', alpha: 0.2 * Math.sin(u * Math.PI), t: 0.3, seed: i * 2.3 });
    }
  }
}

/** One puff of the dark a Gloamknight leaves behind: where, when, for how long, and which it is (`n`, for its shape). */
export interface WakePuff {
  x: number;
  y: number;
  at: number;
  life: number;
  n: number;
}

/** A Gloamknight's wake: its puffs, oldest first, how many it has laid, and where the last was laid from. */
export interface Wake {
  puffs: WakePuff[];
  n: number;
  x: number;
  y: number;
}

/** How far apart a wake's puffs are laid (world pixels), how long one takes to come up, and a step too far to be walked. */
export const WAKE_GAP = 5;
export const WAKE_IN = 0.09;
const WAKE_JUMP = 48;

export const newWake = (x: number, y: number): Wake => ({ puffs: [], n: 0, x, y });

/**
 * Lays a wake's puffs along the way its Gloamknight has gone, one every WAKE_GAP of it, and lets go of those whose
 * time is up. Each puff keeps its spot, its shape (`n`) and its own length of life from the moment it is laid to the
 * moment it is gone. (They were counted by their place in the list: as the oldest went, every other puff took the
 * shape of the one before it and the high dark ones hopped from puff to puff, a flicker about him on every step. The
 * owner: "gloamknight nightblade spec - theres a jittering orbs around the character when theyre moving, fix it".)
 * A step farther than anyone walks in a moment (out of the dark at someone's back) starts the wake again where they
 * are, with nothing laid across the gap.
 */
export function trailWake(w: Wake, x: number, y: number, time: number, life: number): void {
  const d = Math.hypot(x - w.x, y - w.y);
  if (d > WAKE_JUMP) {
    w.x = x;
    w.y = y;
  } else if (d >= WAKE_GAP) {
    const ux = (x - w.x) / d;
    const uy = (y - w.y) / d;
    const steps = Math.floor(d / WAKE_GAP);
    for (let i = 0; i < steps; i++) {
      w.x += ux * WAKE_GAP;
      w.y += uy * WAKE_GAP;
      w.puffs.push({ x: w.x, y: w.y, at: time, life, n: w.n++ });
    }
  }
  while (w.puffs.length && (time - w.puffs[0]!.at >= w.puffs[0]!.life || w.puffs.length > 18)) w.puffs.shift();
}

/**
 * A wake's puffs as they are drawn now: each comes up over WAKE_IN (none appears whole in a frame), shrinks and fades
 * over its life, and every other one, by its own count, has a smaller and paler one over it at head height.
 */
export function wakeBlobs(w: Wake, time: number): { x: number; y: number; up: number; w: number; alpha: number; seed: number; n: number; high: boolean }[] {
  const out: ReturnType<typeof wakeBlobs> = [];
  for (const p of w.puffs) {
    const age = time - p.at;
    const k = 1 - age / p.life;
    if (k <= 0) continue;
    const born = Math.max(0, Math.min(1, age / WAKE_IN));
    const ease = born * born * (3 - 2 * born);
    out.push({ x: p.x, y: p.y, up: 9, w: (9 + k * 9) * (0.6 + 0.4 * ease), alpha: 0.7 * k * ease, seed: p.n * 1.3, n: p.n, high: false });
    if (p.n % 2 === 0) out.push({ x: p.x, y: p.y, up: 20, w: (7 + k * 7) * (0.6 + 0.4 * ease), alpha: 0.55 * k * ease, seed: p.n * 2.1, n: p.n, high: true });
  }
  return out;
}

/** A spell landing, in its school's manner. */
function landing(q: Fx3D, b: Burst): void {
  const u = b.t / b.dur;
  const k = b.big ? 1.5 : 1;
  const out = 1 - (1 - u) * (1 - u);
  const fade = Math.max(0, 1 - u * 1.1);
  const c = b.color;
  const spray = (kind: number, count: number, reach: number, w: number, extra: Partial<Parameters<Fx3D['put']>[0]> = {}): void => {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + b.seed;
      q.put({ kind: kind as Parameters<Fx3D['put']>[0]['kind'], x: b.x + Math.cos(ang) * reach * out * k, y: b.y + Math.sin(ang) * reach * 0.6 * out * k, up: 10 + Math.sin(u * Math.PI) * 12 * k, w: w * k, a: c, b: '#ffffff', alpha: fade, t: u, seed: b.seed + i, ...extra });
    }
  };
  if (b.heal) {
    // rising light
    q.put({ kind: FX.shaft, x: b.x, y: b.y, base: true, w: 22 * k, h: 60 * k, a: c, b: '#ffffff', t: u, alpha: fade });
    spray(FX.spark, 6, 14, 6, { up: 6 + u * 30 });
    return;
  }
  switch (b.school) {
    case 'fire':
      q.put({ kind: FX.blast, x: b.x, y: b.y, up: 10, w: 40 * k * (0.5 + out), a: c, b: '#ffe08a', t: u, seed: b.seed });
      spray(FX.spark, b.big ? 12 : 8, 26, 6);
      break;
    case 'frost':
      spray(FX.frost, b.big ? 10 : 7, 24, 10, { h: 5, rot: b.seed });
      q.put({ kind: FX.ring, x: b.x, y: b.y, flat: true, w: 44 * k * out, a: '#d8f4ff', t: u, seed: b.seed });
      break;
    case 'shadow':
      // a knot of shadow that swells and thins, a ring of its color running out along the ground under it, and wisps
      // thrown off. (This drew the closing Gloam's own effect, which is dark everywhere outside a radius it was never
      // given: a dark square over whoever a shadow spell hit. The owner, of the Gloamknight: "theres some black
      // square as an effect on the enemy ... this one just seems as the game is broken".)
      q.put({ kind: FX.shadow, x: b.x, y: b.y, up: 13, w: 30 * k * (0.55 + out * 0.75), a: c, b: '#120a20', alpha: fade, seed: b.seed });
      q.put({ kind: FX.ring, x: b.x, y: b.y, flat: true, w: 46 * k * out, a: c, t: u, seed: b.seed });
      spray(FX.shadow, b.big ? 9 : 6, 20, 11);
      break;
    case 'holy':
      q.put({ kind: FX.shaft, x: b.x, y: b.y, base: true, w: 20 * k, h: 70 * k, a: c, b: '#ffffff', t: u, alpha: fade });
      spray(FX.holy, 6, 20, 10);
      break;
    case 'nature':
      spray(FX.leaf, b.big ? 12 : 8, 26, 7, { h: 4, rot: b.seed + u * 6 });
      q.put({ kind: FX.poison, x: b.x, y: b.y, up: 8, w: 26 * k, a: c, b: '#e8ffb0', seed: b.seed });
      break;
    case 'arcane':
      q.put({ kind: FX.rune, x: b.x, y: b.y, flat: true, w: 40 * k, a: c, b: '#ffffff', t: u, seed: b.seed });
      spray(FX.spark, b.big ? 12 : 8, 24, 7);
      break;
    default:
      // a blow: a slash across them, and chips flying
      q.put({ kind: FX.slash, x: b.x, y: b.y, up: 14, flat: true, w: 40 * k, rot: b.seed, a: '#fff4e0', t: u, p1: 1.2, p2: 0 });
      spray(FX.chip, 6, 22, 5);
  }
  if (b.big) q.put({ kind: FX.shock, x: b.x, y: b.y, flat: true, w: 70 * out, a: c, t: u, seed: b.seed });
}

const SCHOOL_EL: Record<string, string> = { fire: 'fire', frost: 'frost', arcane: 'arcane', shadow: 'shadow', holy: 'holy', nature: 'nature', physical: 'trail' };

/** What's afoot on a fighter. */
function ringMarks(q: Fx3D, f: Fighter, time: number): void {
  if (f.dead) return;
  const gale = f.auras.some((a) => a.ab === 'l-gale' && a.cc === 'incap');
  const lift = gale ? 10 + Math.sin(time * 6) * 2 : 0;
  const seed = f.id * 1.7;
  for (const a of f.auras) {
    if (a.cc === 'stun') {
      for (let i = 0; i < 3; i++) {
        const an = time * 5 + (i * Math.PI * 2) / 3;
        q.put({ kind: FX.spark, x: f.x + Math.cos(an) * 9, y: f.y + Math.sin(an) * 3, up: HEAD + lift, w: 11, a: '#ffe39a', t: 0.1 });
      }
    } else if (a.cc === 'root' || a.kind === 'oak') {
      q.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: a.kind === 'oak' ? 34 : 26, a: '#4a9a3a', b: '#b8ff8a', t: 1, seed, p1: FIELD.nature });
    } else if (a.kind === 'mark') {
      // a ranger's quarry: a red ring at their feet for the whole side to see
      q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: 30, a: '#ff6a5a', t: (time * 0.8) % 1, seed });
    } else if (a.kind === 'revenant') {
      // a revenant: the grave's dark rising off them
      for (let i = 0; i < 5; i++) {
        const an = time * 1.8 + (i / 5) * Math.PI * 2;
        q.put({ kind: FX.smoke, x: f.x + Math.cos(an) * 9, y: f.y + Math.sin(an) * 5, up: 6 + (i % 3) * 8 + lift, w: 15, a: '#1e5a52', alpha: 0.55, t: 0.3, seed: i + seed });
      }
    } else if (a.ab === 'l-gale' && a.cc) {
      q.put({ kind: FX.smoke, x: f.x, y: f.y, up: 6, w: 34, a: '#e8e8f4', alpha: 0.55, t: 0.2, seed: time * 2 });
      q.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: 34, a: '#e8e8f4', t: (time * 1.6) % 1, seed });
    } else if (a.kind === 'absorb') {
      q.put({ kind: FX.bubble, x: f.x, y: f.y, up: 15, w: 44, a: a.ab === 'g-ward' ? '#a070ff' : '#7fd8ff' });
    } else if (a.kind === 'immune') {
      q.put({ kind: FX.bubble, x: f.x, y: f.y, up: 15, w: 50 + Math.sin(time * 5) * 2, a: a.still ? '#a8e4ff' : '#ffe39a' });
      if (a.still) q.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: 34, a: '#7fd4ff', b: '#ffffff', t: 1, seed, p1: FIELD.frost });
    } else if (a.kind === 'reflect') {
      q.put({ kind: FX.slash, x: f.x, y: f.y, up: 14, flat: true, w: 36, rot: time * 3, a: '#bee8ff', t: 0.3, p1: 1.4, p2: 0 });
    } else if (a.kind === 'guard' && a.ab === 'g-mantle') {
      // a mantle of night: dark turning about them
      for (let i = 0; i < 6; i++) {
        const an = time * 2.4 + (i / 6) * Math.PI * 2;
        q.put({ kind: FX.smoke, x: f.x + Math.cos(an) * 11, y: f.y + Math.sin(an) * 6, up: 8 + (i % 3) * 7 + lift, w: 17, a: '#3a1460', alpha: 0.62, t: 0.3, seed: i + seed });
      }
      q.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: 28, a: '#8a5cff' });
    } else if (a.kind === 'guard') {
      q.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: 26, a: '#d8dce6' });
    } else if (a.kind === 'fury') {
      q.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: 28, h: 40, a: '#ff465a', t: -1, seed });
    } else if (a.kind === 'dot' || a.kind === 'hot') {
      lingering(q, f, a, time, lift);
    }
  }
  if (f.cast) {
    const ab = ABILITIES[f.cast.ab];
    const k = Math.min(1, f.cast.t / f.cast.dur);
    const c = ab?.color ?? '#ffffff';
    q.put({ kind: FX.gather, x: f.x, y: f.y, up: 18, w: 38, a: c, b: '#fffdf0', t: k, seed });
    q.put({ kind: FX.rune, x: f.x, y: f.y, flat: true, w: 34, a: c, b: '#ffffff', t: 0.5, seed });
  }
}

/**
 * What lingers on someone, burning or mending, in its own spell's color: a poison bubbles, a curse wisps black, fire
 * licks and throws embers, a bleed drips, light and growth rise in motes. Several at once, each on its own clock.
 */
function lingering(q: Fx3D, f: Fighter, a: Fighter['auras'][number], time: number, lift: number): void {
  const ab = lookOf(a.ab);
  if (!ab) return;
  const c = ab.color;
  const seed = f.id * 3.1 + a.ab.length;
  const n = 5;
  for (let i = 0; i < n; i++) {
    // each mote rises and fades on its own phase, round the body
    const ph = (time * (a.kind === 'hot' ? 0.55 : 0.8) + i / n + seed * 0.13) % 1;
    const ang = i * 2.39 + seed + time * 0.6;
    const r = 6 + (i % 3) * 2;
    const x = f.x + Math.cos(ang) * r;
    const y = f.y + Math.sin(ang) * r * 0.5;
    const up = 4 + ph * 26 + lift;
    const fade = Math.max(0, Math.min(1, (1 - ph) * 1.6));
    if (a.kind === 'hot') {
      if (ab.school === 'nature') q.put({ kind: FX.leaf, x, y, up, w: 7, h: 4, rot: ph * 7 + i, a: i % 2 ? c : '#d8ffb0', alpha: fade });
      else q.put({ kind: FX.spark, x, y, up, w: 7 + (1 - ph) * 5, a: i % 2 ? c : '#fff6d0', t: ph * 0.6, seed: seed + i });
      continue;
    }
    switch (ab.school) {
      case 'fire':
        q.put({ kind: FX.flame, x, y, up: up * 0.5, base: true, w: 9, h: 12 + (1 - ph) * 6, rot: Math.PI / 2, a: c, b: '#ffe08a', seed: seed + i });
        if (i % 2) q.put({ kind: FX.spark, x, y, up: up + 6, w: 5, a: '#ffd36a', t: ph, seed: seed + i });
        break;
      case 'shadow':
        // (a curse is wisps about someone, not a cloud over them: each was up to sixteen pixels across, five of them
        // round a fighter twenty tall, and a cursed fighter couldn't be seen for the curse. The owner: "warlock and
        // gloamknight curses on enemies are too big on the characters, scale them down a bit". Smaller, closer in,
        // and not rising as far)
        q.put({ kind: FX.shadow, x: f.x + (x - f.x) * 0.8, y: f.y + (y - f.y) * 0.8, up: 4 + ph * 19 + lift, w: 6 + (1 - ph) * 3.5, a: c, b: '#120a20', seed: seed + i });
        break;
      case 'nature':
        q.put({ kind: FX.poison, x, y, up: up * 0.7, w: 8 + (1 - ph) * 4, a: c, b: '#e8ffb0', seed: seed + i });
        break;
      case 'holy':
        q.put({ kind: FX.holy, x, y, up, w: 10, a: c, b: '#ffffff', seed: seed + i });
        break;
      case 'frost':
        q.put({ kind: FX.frost, x, y, up, w: 8, h: 4, rot: ang, a: c, b: '#ffffff', alpha: fade });
        break;
      case 'physical':
        // a bleed: drops falling from the wound
        q.put({ kind: FX.spark, x, y, up: 22 - ph * 18 + lift, w: 5, a: '#d0283c', t: ph * 0.5, seed: seed + i });
        break;
      default:
        q.put({ kind: FX.spark, x, y, up, w: 8, a: c, t: ph * 0.6, seed: seed + i });
    }
  }
}

/** The top layer of one frame. */
/** A placed ability being aimed by hand: which, and where its user has it now. */
export interface RingAim {
  ab: string;
  x: number;
  y: number;
}

export function drawRing(m: Match, fx: RingFx, myId: number | null, time: number, view: RingStage, aim: RingAim | null = null, raiseOf: (f: Fighter) => number = () => 0): void {
  const me = myId === null ? null : (m.fighters[myId] ?? null);
  let g = view.groundLayer();
  // what was left on the ground: its patch, ringed (red when it is the other side's, as a patch coming down is), the
  // ring breathing so that it reads as something that stays
  for (const fd of m.fields) {
    const ab = ABILITIES[fd.ab];
    const hostile = !!me && fd.team !== me.team;
    const c = hostile ? '#ff4a5a' : (ab?.color ?? '#ffe39a');
    const left = Math.min(1, fd.t / 0.6);
    view.flat(fd.x, fd.y);
    g.globalAlpha = (hostile ? 0.2 : 0.14) * left;
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(fd.x, fd.y, fd.r, fd.r, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = left;
    ring(g, fd.x, fd.y, fd.r - 1 + Math.sin(time * 4) * 0.8, c, hostile ? 2.4 : 2);
    g.globalAlpha = 1;
  }
  // what is placed is seen before it lands: its patch on the ground, filling from the middle as it comes (red when it
  // is the other side's, so there is no doubt about which to step out of)
  for (const z of m.zones) {
    const ab = ABILITIES[z.ab];
    const hostile = !!me && z.team !== me.team;
    const c = hostile ? '#ff4a5a' : (ab?.color ?? '#ffe39a');
    const u = 1 - Math.max(0, z.t) / z.dur;
    view.flat(z.x, z.y);
    g.globalAlpha = hostile ? 0.22 : 0.16;
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(z.x, z.y, z.r, z.r, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = hostile ? 0.44 : 0.32;
    g.beginPath();
    g.ellipse(z.x, z.y, z.r * u, z.r * u, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    ring(g, z.x, z.y, z.r, c, hostile ? 2.6 : 2.2);
  }
  // a placed spell still being cast: its caster sees where it will come down (nobody else does, until it falls)
  const casting = me && !me.dead && me.cast?.at ? ABILITIES[me.cast.ab] : null;
  if (me && casting?.aim === 'ground') {
    const p = m.reach(me, casting, me.cast!.at!);
    view.flat(p.x, p.y);
    g.globalAlpha = 0.12;
    g.fillStyle = casting.color;
    g.beginPath();
    g.ellipse(p.x, p.y, casting.area ?? 40, casting.area ?? 40, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.setLineDash([6, 5]);
    ring(g, p.x, p.y, casting.area ?? 40, casting.color, 2);
    g.setLineDash([]);
  }
  // placing one: how far it reaches, and the patch where it will go (grey where it can't be seen from here)
  if (aim && me && !me.dead) {
    const ab = ABILITIES[aim.ab];
    if (ab) {
      const p = m.reach(me, ab, aim);
      const ok = m.sees(me, { x: p.x, y: p.y + 4 });
      view.flat(me.x, me.y);
      g.setLineDash([5, 5]);
      ring(g, me.x, me.y, ab.range, 'rgba(255,255,255,0.35)', 1.2);
      g.setLineDash([]);
      view.flat(p.x, p.y);
      // (the spell's own mark, turning: render/reticle.ts)
      drawReticle(g, p.x, p.y, ab.area ?? 40, ab.color, time, !ok);
    }
  }
  // under each fighter: your own thin gold ring, and the marks of whom you have chosen (picksOf)
  const picks = picksOf(m, me);
  for (const f of m.fighters) {
    // (the raised dead, once back in the ground, are nobody's to choose; one of the other side in the shroud is nobody's to see)
    if ((f.pet && f.dead) || (me && m.unseen(f, me)) || m.aloft(f)) continue;
    view.flat(f.x, f.y);
    if (f.id === myId) ring(g, f.x, f.y, 11, '#ffe39a', 1.4);
    const pick = picks.get(f.id);
    if (pick && !f.dead) pickMark(g, f.x, f.y, pick, time, view.still);
  }
  g = view.upperLayer();
  for (const f of m.fighters) if ((!me || !m.unseen(f, me)) && !m.aloft(f)) markFighter(g, m, f, myId, time, !me || f === me || m.sees(me, f), view, raiseOf(f), picks.get(f.id) ?? null);
  g.textAlign = 'center';
  for (const p of fx.pops) {
    const u = p.t / 0.9;
    // (a Shatter's comes up larger, thrown out hard and settling back: the hit is felt in the number too)
    const size = p.punch ? 13 * (u < 0.2 ? 1 + Math.sin((u / 0.2) * Math.PI) * 0.55 : 1) : (p.big ? 11 : 8) * (u < 0.15 ? 1 + (0.15 - u) * 2.4 : 1);
    view.up(p.x, p.y + 30, HEAD);
    g.font = `800 ${size}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    g.globalAlpha = Math.max(0, 1 - u * u);
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.strokeStyle = '#120a20';
    const ty = p.y + 30 - u * 14 - (p.lift ?? 0);
    g.strokeText(p.text, p.x, ty);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, ty);
  }
  g.globalAlpha = 1;
}

export const classColor = (cls: Fighter['cls']): string => CLASSES[cls].colors.accent;
