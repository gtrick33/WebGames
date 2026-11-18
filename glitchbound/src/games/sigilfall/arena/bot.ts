import { ABILITIES, GCD, healerBar, type Ability } from './abilities';
import { ARENA_H, ARENA_W } from './maps';
import { CRIT_K, HERO_R, RANGED, type Fighter, type Match, type MoveInput } from './sim';
import { armored, brace, chainHealer, focusBias, fumble, guard, holdSuper, knows, lapse, lateKick, nextLook, peel, SHARP_FROM } from './tactics';

/**
 * A computer player for The Ring. It plays by the player's rules: it sees what a player sees, and presses the same
 * buttons through Match.press. `skill` from 0 to 1 is how quickly it reacts and how much of the game it plays: a low
 * one stands under what is falling on it, rarely interrupts and sits on its super; a high one steps out from under it,
 * strafes while it casts, races for the sigil and the healing spheres, saves its super for the kill and kicks heals.
 * What a practised player does beyond that, and a newcomer's slips, are arena/tactics.ts: the ladder's rating sets
 * the skill (arena/ladder.ts `skillAt`).
 */
export interface Brain {
  /** Time to the next thought. */
  wait: number;
  move: MoveInput;
  /** Where it's going, while walking round a pillar. */
  go: { x: number; y: number; t: number } | null;
  /** Reaction: how long a cast must have been seen before it moves on it. */
  seen: Map<number, number>;
  rand: () => number;
  /** Which way it circles its target, and when it turns the other way. */
  side: number;
  turnAt: number;
  /** What is falling that it has already made up its mind about (to step out or not), by where and whose. */
  shots: Map<string, boolean>;
  /** Where its feet are actually going: they follow its mind over a moment, as a person's thumb on a stick does. */
  vel: MoveInput;
  /** How long its feet still answer at once (a reflex: stepping out from under something). */
  urgent: number;
  /** The slow side-to-side of a walk that is never quite straight. */
  sway: number;
}

export function newBrain(seed: number): Brain {
  let s = seed >>> 0 || 1;
  return {
    wait: 0,
    move: { mx: 0, my: 0 },
    go: null,
    seen: new Map(),
    rand: () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
    side: seed % 2 ? 1 : -1,
    turnAt: 0,
    shots: new Map(),
    vel: { mx: 0, my: 0 },
    urgent: 0,
    sway: (seed % 628) / 100,
  };
}

/**
 * Feet as a person's are: a computer player's mind changes its course several times a second, and its feet used to
 * snap to each new course in a frame, which no thumb on a stick or finger on a key does. They follow it over about a
 * tenth of a second now (a sharp player turns a little quicker), a walk drifts a little from side to side, and only a
 * reflex (stepping out from under what is falling) answers at once, so the computer dodges as well as it did. The
 * owner, 2026-11-18: "make the bots act a bit more like humans, smoother movements".
 */
export function smoothFeet(b: Brain, want: MoveInput, dt: number, skill: number): MoveInput {
  const quick = b.urgent > 0;
  b.urgent = Math.max(0, b.urgent - dt);
  const tau = quick ? 0.035 : 0.14 - skill * 0.05;
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  let tx = want.mx;
  let ty = want.my;
  const len = Math.hypot(tx, ty);
  if (len > 0.5 && !quick) {
    // (never quite straight: a slow drift across the way it is going)
    b.sway += dt * 1.6;
    const s = Math.sin(b.sway) * 0.14;
    tx += (-want.my / len) * s;
    ty += (want.mx / len) * s;
  }
  b.vel = { mx: b.vel.mx + (tx - b.vel.mx) * k, my: b.vel.my + (ty - b.vel.my) * k };
  const v = Math.hypot(b.vel.mx, b.vel.my);
  if (v > 1) b.vel = { mx: b.vel.mx / v, my: b.vel.my / v };
  else if (v < 0.04 && len === 0) b.vel = { mx: 0, my: 0 };
  return b.vel;
}

const HEALS = (f: Fighter): Ability[] => f.bar.map((b) => ABILITIES[b]!).filter((a) => a.role === 'heal' && a.aim === 'friend');

/** A healer's playstyle: its basic ability, the first on its bar, is a heal for a friend. */
export const isHealer = (f: Pick<Fighter, 'bar'>): boolean => healerBar(f.bar);

const hpShare = (f: Fighter): number => f.hp / f.maxHp;

/** Aimed at an enemy: at the one, or placed on the ground under them. */
const atFoe = (a: Ability): boolean => a.aim === 'enemy' || a.aim === 'ground';

/** One more moment of a computer player's mind. It returns where its feet go (smoothFeet: as a person's would). */
export function botThink(m: Match, f: Fighter, b: Brain, skill: number, dt: number): MoveInput {
  // (the raised dead have minds of their own, in the rules: Match.tickPet. Nobody gives them a brain)
  if (f.pet || !b) return { mx: 0, my: 0 };
  if (f.dead || m.phase !== 'fight') {
    b.vel = { mx: 0, my: 0 };
    return b.vel;
  }
  return smoothFeet(b, think(m, f, b, skill, dt), dt, skill);
}

/** What a computer player wants: where to walk, and (pressed through Match.press) what to use. */
function think(m: Match, f: Fighter, b: Brain, skill: number, dt: number): MoveInput {
  // (the raised dead have minds of their own, in the rules: Match.tickPet. Nobody gives them a brain)
  // a sharp player watches the cast bars all the time, and kicks late in the cast (tactics.ts)
  if (skill >= SHARP_FROM) lateKick(m, f, b, skill, dt);
  // a reflex, every frame: what is about to fall on them is stepped out from under
  const away = dodge(m, f, b, skill);
  if (away) {
    b.move = away;
    b.wait = Math.max(b.wait, 0.22);
    b.urgent = 0.3;
    return away;
  }
  b.wait -= dt;
  if (b.wait > 0) return b.move;
  // a sharp player thinks several times a second; a dull one twice
  b.wait = 0.5 - skill * 0.32 + b.rand() * 0.06;
  // (the heroes on each side: who holds, kicks, heals and is fled from. Somebody's raised dead are only a target when
  // they are worth one: pickTarget. Whoever is in the shroud isn't there to it, as to a player)
  const seen = m.enemiesOf(f).filter((o) => !m.unseen(o, f));
  const enemies = seen.filter((o) => !o.pet);
  const friends = m.friendsOf(f).filter((o) => !o.pet);
  if (!enemies.length) {
    // nobody to be seen: into the middle, near the rest of the side, where whoever is hiding has to come
    b.move = m.enemiesOf(f).some((o) => !o.pet) ? lookOut(m, f, b, friends) : { mx: 0, my: 0 };
    return b.move;
  }
  const healer = isHealer(f);
  const target = pickTarget(m, f, seen, focusBias(skill));
  // (with one of the dead in the way, what is kept for a hero, a super, a hold, a rush, is kept for the one who raised it)
  const hero = target.pet ? (enemies.find((e) => e.id === m.masterOf(target).id) ?? enemies[0]!) : target;
  f.target = hero.id;

  // faded from sight with nothing to strike out of it (a mage's vanishing point): they use the breath it buys, walking
  // as they would and pressing nothing until it is nearly over
  const lurks = f.bar.some((id) => ABILITIES[id]?.veiled);
  if (m.hidden(f) && !lurks && !m.held(f)) {
    if ((f.auras.find((a) => a.kind === 'veil')?.t ?? 0) > 0.7) {
      b.move = walk(m, f, b, skill, enemies, hero, friends, healer);
      return b.move;
    }
  }
  // in the shroud: nothing that would bring them out of it but the blow it was taken for
  else if (m.hidden(f) && !m.held(f)) {
    f.target = hero.id;
    prowl(m, f, b, skill, hero);
    b.move = m.hidden(f) ? stalk(m, f, b, hero) : walk(m, f, b, skill, enemies, hero, friends, healer);
    return b.move;
  }
  // (a newcomer stands about now and then, looking at their bar: tactics.ts)
  if (!m.held(f) && !lapse(b, skill)) {
    shroud(m, f, b, skill, enemies);
    if (!holdSuper(m, f, b, skill, enemies, hero)) unleash(m, f, b, skill, enemies, hero, friends);
    // (a sharp player's defensives are its own: with none on the bar, there's nothing to weigh)
    if (f.bar.some((x) => ABILITIES[x]?.role === 'defense') && knows(b, skill)) guard(m, f, b, skill, enemies);
    else defend(m, f, b, skill, enemies);
    if (skill < SHARP_FROM) kick(m, f, b, skill, enemies, dt);
    mobilize(m, f, b, skill, enemies, hero);
    if (!f.cast) {
      if (healer) healFriends(m, f, b, skill, friends, enemies);
      dispelFriends(m, f, b, skill, friends);
      if (!peel(m, f, b, skill, enemies, friends) && !chainHealer(m, f, b, skill, enemies, hero)) control(m, f, b, skill, enemies, hero, friends);
      f.target = target.id;
      attack(m, f, b, skill, target);
      if (!healer) healSelf(m, f);
    }
    fumble(m, f, b, skill);
  } else if (m.held(f)) brace(m, f, b, skill, enemies);
  f.target = target.id;
  b.move = walk(m, f, b, skill, enemies, target, friends, healer);
  // (and looks back at the bar as the global cooldown comes up: tactics.ts)
  b.wait = nextLook(f, b.wait, skill, b.rand());
  return b.move;
}

/**
 * The one to kill: a team falls on the weakest they can reach, and prefers a healer when nothing is close to dying.
 * Somebody's raised dead count for less than a hero (they crumble on their own soon enough), unless one is clawing at
 * this fighter and has been worn down: then it is put out of the way first.
 */
function pickTarget(m: Match, f: Fighter, enemies: Fighter[], extra?: (o: Fighter) => number): Fighter {
  const held = (o: Fighter): boolean => o.auras.some((a) => a.kind === 'immune' || a.cc === 'incap');
  const score = (o: Fighter): number => {
    let s = hpShare(o) * 100;
    if (held(o)) s += 200;
    if (!m.sees(f, o)) s += 25;
    s += Math.hypot(o.x - f.x, o.y - f.y) * 0.05;
    if (o.pet) s += 70 - (o.target === f.id && Math.hypot(o.x - f.x, o.y - f.y) < 40 ? 50 : 0);
    // stay on the same one: nothing wastes more than changing your mind
    if (f.target === o.id) s -= 12;
    // what a teammate is on counts for a lot
    for (const a of m.friendsOf(f)) if (a !== f && !a.pet && a.target === o.id) s -= 14;
    // (and what a sharp team weighs besides: tactics.ts)
    if (extra) s += extra(o);
    return s;
  };
  return enemies.reduce((a, c) => (score(c) < score(a) ? c : a));
}

function defend(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[]): void {
  const threatened = enemies.some((e) => e.target === f.id);
  for (const id of f.bar) {
    const ab = ABILITIES[id]!;
    if (ab.role !== 'defense') continue;
    if (ab.aim === 'friend') {
      const ally = m.friendsOf(f).find((a) => !a.pet && hpShare(a) < 0.3 && !a.auras.some((x) => x.ab === ab.id));
      if (ally && !m.blocked(f, ab, ally)) {
        f.friend = ally.id;
        m.press(f.id, id);
        return;
      }
      continue;
    }
    if (ab.effects.some((e) => e.k === 'reflect')) {
      // a spell coming at them: turn it back
      const casting = enemies.find((e) => e.cast && e.cast.target === f.id && e.cast.dur - e.cast.t < 0.7);
      if (casting && b.rand() < skill && !m.blocked(f, ab)) m.press(f.id, id);
      continue;
    }
    const line = ab.cd > 60 ? 0.3 : 0.55;
    if (threatened && hpShare(f) < line && !m.blocked(f, ab)) {
      m.press(f.id, id);
      return;
    }
  }
}

/** Feet in a tight spot: rush at the target, spring from a blade, shake off a hold. */
function mobilize(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter): void {
  if (b.rand() > 0.2 + skill * 0.8) return;
  // a flicker or a leap throws away the cast in hand: not unless it's life or death
  if (f.cast && hpShare(f) > 0.35) return;
  const blades = enemies.some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 44 && !m.held(e) && !m.rooted(e));
  const stuck = m.rooted(f) || f.auras.some((a) => a.kind === 'slow' && a.n >= 0.4);
  for (const id of f.bar) {
    const ab = ABILITIES[id]!;
    if (ab.role !== 'mobility') continue;
    const kinds = ab.effects.map((e) => e.k);
    if (kinds.includes('charge') || kinds.includes('behind') || kinds.includes('pull')) {
      if (Math.hypot(target.x - f.x, target.y - f.y) > 60 && !m.blocked(f, ab, target)) m.press(f.id, id);
      continue;
    }
    if (ab.aim === 'friend') {
      const ally = m.friendsOf(f).find((a) => !a.pet && (m.rooted(a) || a.auras.some((x) => x.kind === 'slow' && x.n >= 0.4)));
      if (ally && !m.blocked(f, ab, ally)) {
        f.friend = ally.id;
        m.press(f.id, id);
      }
      continue;
    }
    if (kinds.includes('blink')) {
      // turn to face the way out first: it goes where you're looking
      if (!blades || m.blocked(f, ab)) continue;
      const near = enemies.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
      f.dirX = f.x - near.x || 1;
      f.dirY = f.y - near.y;
      m.press(f.id, id);
      return;
    }
    if (kinds.includes('leap')) {
      if (blades && !m.blocked(f, ab)) m.press(f.id, id);
      continue;
    }
    if (kinds.includes('bound')) {
      // (it goes the way they face: away from the nearest blade, then)
      if (!blades || m.blocked(f, ab)) continue;
      const near = enemies.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
      f.dirX = f.x - near.x || 1;
      f.dirY = f.y - near.y;
      m.press(f.id, id);
      return;
    }
    // (what quickens: to close in, for one who fights at arm's length; to get away, for one who doesn't)
    const far = !RANGED.has(f.cls) && Math.hypot(target.x - f.x, target.y - f.y) > 70;
    if ((stuck || (kinds.includes('speed') && (far || (RANGED.has(f.cls) && blades)))) && !m.blocked(f, ab)) m.press(f.id, id);
  }
}

/** Interrupting: on a heal first, on a long damaging cast next. */
function kick(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], dt: number): void {
  for (const id of f.bar) {
    const ab = ABILITIES[id]!;
    if (ab.role !== 'interrupt') continue;
    for (const e of enemies) {
      const c = e.cast;
      if (!c) {
        b.seen.delete(e.id);
        continue;
      }
      b.seen.set(e.id, (b.seen.get(e.id) ?? 0) + Math.max(dt, 0.1));
      const react = 1.1 - skill * 0.95;
      const left = c.dur - c.t;
      if ((b.seen.get(e.id) ?? 0) < react || left > 1.2) continue;
      if (b.rand() > 0.25 + skill * 0.75) continue;
      if (!m.blocked(f, ab, e)) {
        const before = f.target;
        f.target = e.id;
        m.press(f.id, id);
        f.target = before;
        return;
      }
    }
  }
}

function healFriends(m: Match, f: Fighter, b: Brain, skill: number, friends: Fighter[], enemies: Fighter[]): void {
  const low = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0];
  if (!low) return;
  const share = hpShare(low);
  if (share > 0.92) return;
  // healing that has faded buys little: the more of it is gone, the more of a healer's time goes into bringing them
  // down first (and with none left, all of it)
  const fade = m.dampening;
  if (fade >= 1 || (fade > 0.5 && b.rand() < (fade - 0.5) * 1.6)) return;
  f.friend = low.id;
  const heals = HEALS(f);
  const onMe = enemies.some((e) => e.target === f.id && Math.hypot(e.x - f.x, e.y - f.y) < 60);
  const pick = (want: (a: Ability) => boolean): Ability | undefined => heals.find((a) => want(a) && !m.blocked(f, a, low));
  // a ward before the hurt lands (and it is what makes the mending under it stronger)
  const ward = f.bar.map((x) => ABILITIES[x]!).find((a) => a.effects.some((e) => e.k === 'absorb') && a.aim === 'friend' && !m.blocked(f, a, low));
  if (share < 0.8 && ward && !low.auras.some((a) => a.ab === ward.id)) {
    m.press(f.id, ward.id);
    return;
  }
  // in danger, what's instant and big; a heal that is lit (a boon, its combo, points to spend) as soon as it is worth it
  const big = pick((a) => a.cd > 0 && m.castOf(f, a) === 0 && a.effects.some((e) => e.k === 'heal') && (share < (a.cd > 20 ? 0.3 : 0.55) || (share < 0.75 && !!m.lit(f, a, low))));
  if (big) {
    m.press(f.id, big.id);
    return;
  }
  // a blow between heals while nobody is in danger: it is what a healer's combo is made with
  const weave = f.bar.map((x) => ABILITIES[x]!).find((a) => a.aim === 'enemy' && a.role === 'damage' && a.cast === 0 && !m.blocked(f, a));
  if (weave && share > 0.6 && b.rand() < 0.5 + skill * 0.4) return;
  // the steady one: always when it costs no standing still, otherwise when nobody is on them or it can't wait
  const basic = pick((a) => a.cd === 0 && a.effects.some((e) => e.k === 'heal'));
  if (basic && (m.castOf(f, basic) === 0 || !onMe || share < 0.5)) m.press(f.id, basic.id);
}

function dispelFriends(m: Match, f: Fighter, b: Brain, skill: number, friends: Fighter[]): void {
  const ab = f.bar.map((x) => ABILITIES[x]!).find((a) => a.role === 'dispel' && a.aim === 'friend');
  if (!ab || b.rand() > 0.2 + skill * 0.8) return;
  const ally = friends.find((a) => a.auras.some((x) => x.magic && x.harmful && x.cc && x.t > 1.5));
  if (ally && !m.blocked(f, ab, ally)) {
    f.friend = ally.id;
    m.press(f.id, ab.id);
  }
}

/** Crowd control: on the healer while the kill is on, or on whoever is on them when they're in trouble. */
function control(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter, friends: Fighter[]): void {
  if (b.rand() > 0.1 + skill * 0.75) return;
  const ccs = f.bar.map((x) => ABILITIES[x]!).filter((a) => a.role === 'cc');
  if (!ccs.length) return;
  const healer = enemies.find((e) => isHealer(e) && e !== target);
  const onUs = enemies.filter((e) => friends.some((a) => e.target === a.id) && e !== target);
  const dps = healer ?? onUs[0] ?? (enemies.length === 1 ? target : null);
  for (const ab of ccs) {
    const kinds = ab.effects.filter((e) => e.k === 'cc');
    const kind = kinds[0]?.k === 'cc' ? kinds[0].cc : null;
    if (!kind) continue;
    // an easily broken hold goes on what you aren't hurting; the main target gets stuns
    const breaks = kind === 'incap' || kind === 'fear';
    const on = breaks ? dps : kind === 'stun' ? (healer && hpShare(target) < 0.6 ? healer : target) : target;
    if (!on || on.auras.some((x) => x.kind === 'immune' || (x.cc && x.t > 0.6))) continue;
    if (ab.aim === 'near') {
      if (Math.hypot(on.x - f.x, on.y - f.y) > ab.range) continue;
    } else if (m.blocked(f, ab, on)) continue;
    if (breaks && on.auras.some((x) => x.kind === 'dot')) continue;
    // alone with them, a hold that breaks only buys time: spend it when time is what's needed (a blade at your
    // throat, or your life running out)
    if (breaks && enemies.length === 1 && hpShare(f) > 0.5 && Math.hypot(on.x - f.x, on.y - f.y) > 60) continue;
    if (ab.aim === 'self') continue;
    const before = f.target;
    f.target = on.id;
    const why = m.press(f.id, ab.id);
    f.target = before;
    if (!why) return;
  }
  // a trap at their feet when they're coming at you
  const trap = f.bar.map((x) => ABILITIES[x]!).find((a) => a.effects.some((e) => e.k === 'trap'));
  if (trap && enemies.some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 70) && !m.blocked(f, trap)) m.press(f.id, trap.id);
}

function attack(m: Match, f: Fighter, b: Brain, skill: number, target: Fighter): void {
  if (f.gcd > 0 || f.cast) return;
  const near = f.bar.map((x) => ABILITIES[x]!);
  // the dead called up as the fight is joined, close enough to go for whoever is being fought, and not while some stand
  const raise = near.find((a) => a.role === 'summon');
  // (from a caster's distance too: the warlock who calls them keeps hers)
  if (raise && !target.pet && Math.hypot(target.x - f.x, target.y - f.y) < 170 && m.sees(f, target) && !m.fighters.some((o) => o.pet?.owner === f.id && !o.dead) && !m.blocked(f, raise)) {
    m.press(f.id, raise.id);
    return;
  }
  // the dead roused once they are at it
  const rouse = near.find((a) => a.effects.some((e) => e.k === 'frenzy'));
  if (rouse && !m.blocked(f, rouse) && m.fighters.some((o) => o.pet?.owner === f.id && !o.dead && o.target !== null && Math.hypot((m.fighters[o.target]?.x ?? 1e9) - o.x, (m.fighters[o.target]?.y ?? 1e9) - o.y) < 30)) m.press(f.id, rouse.id);
  // a blade at your throat: no time for anything slow
  const pressed = m.enemiesOf(f).some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 50 && !m.held(e) && !m.rooted(e));
  // whatever is worth most right now: what is lit (a boon, a combo, points to spend) before what isn't
  let best: Ability | null = null;
  let most = 0;
  for (const a of near) {
    if (a.role === 'cc' || a.role === 'summon' || a.role === 'stealth' || a.role === 'mobility' || a.role === 'defense') continue;
    if (!atFoe(a) && a.aim !== 'near') continue;
    if (a.aim === 'near' ? Math.hypot(target.x - f.x, target.y - f.y) > a.range || !!m.blocked(f, a) : !!m.blocked(f, a, target)) continue;
    const v = worthNow(m, f, a, target, skill, pressed);
    if (v > most) {
      most = v;
      best = a;
    }
  }
  if (best) m.press(f.id, best.id);
  void b;
}

/**
 * What an ability is worth on this target right now, for each second it takes: its numbers, with whatever would make it
 * land harder counted in (its combo ready on them, a boon it would use, the points it would spend), nothing for a burn
 * that is on them already, and little for points spent too soon. The same things light its button for a player.
 */
function worthNow(m: Match, f: Fighter, a: Ability, target: Fighter, skill: number, pressed: boolean): number {
  const how = m.how(f, a);
  const burning = target.auras.some((x) => x.ab === a.id && x.kind === 'dot' && x.src === f.id && x.t > 1.5);
  let v = 0;
  for (const e of a.effects) {
    if (e.k === 'dmg') v += e.n;
    else if (e.k === 'dot' && !burning && !target.pet) v += e.n * 0.8;
  }
  if (a.field) v = v * (a.field.dur / a.field.tick) * (a.field.seek ? 0.85 : 0.6);
  if (a.channel) v *= a.channel / (a.tick ?? 1);
  if (a.role === 'burst') v *= 1.25;
  if (v <= 0) return 0;
  const sharp = skill >= SHARP_FROM;
  // (not into immunity or a big ward, for a sharp one, with anything that waits on a cooldown)
  if (sharp && a.cd > 0 && !target.pet && armored(target)) return 0;
  const combo = a.combo && m.comboReady(f, a, target) ? a.combo.mult : 1;
  const use = m.boonFor(f, a);
  v *= use?.asCombo && a.combo ? Math.max(combo, a.combo.mult) : combo;
  if (use) v *= (use.mult ?? 1) * (use.crit ? CRIT_K : 1) * 1.4;
  // (what gives a boon as it goes is worth the boon)
  if (how.gives.some((g) => g.on === 'cast')) v += 40;
  if (how.spend && f.points) {
    // points are spent when there are plenty: all of them for a sharp hand, most for a dull one, any to finish someone
    const want = sharp ? f.points.max : Math.max(2, f.points.max - 2);
    const finishing = target.hp < target.maxHp * 0.2;
    v *= 1 + how.spend.per * f.pts;
    if (f.pts < want && !finishing && !use) v *= a.cd > 0 ? 0.6 : 0.15;
  }
  if (how.build && f.points && f.pts < f.points.max) v *= 1.1;
  // (somebody's raised dead get nothing that waits long)
  if (target.pet && a.cd > 6) return 0;
  const time = Math.max(GCD, a.channel ?? m.castOf(f, a));
  v /= time;
  // casting slows you, so a blade close by wants instants
  if (pressed && skill >= 0.25 && (a.channel || m.castOf(f, a) > 0)) v *= 0.5;
  // (what is placed can be walked out of: best on someone going nowhere fast)
  if (a.aim === 'ground' && !a.field && !(m.held(target) || m.rooted(target) || target.auras.some((x) => x.kind === 'slow' && x.n >= 0.3))) v *= 0.7;
  return v;
}

/** The super, when it's full: on a kill, on a crowd, or to save a friend. */
function unleash(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter, friends: Fighter[]): void {
  const sup = m.extras(f)[0]!;
  if (f.charge < 1 || b.rand() > 0.35 + skill * 0.65) return;
  // (one that calls up the dead, or works on its user alone: once the fight is close)
  if (sup.aim === 'self') {
    if (Math.hypot(target.x - f.x, target.y - f.y) < 150 && m.sees(f, target) && !m.blocked(f, sup)) m.press(f.id, sup.id);
    return;
  }
  if (sup.aim === 'friend') {
    const low = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0];
    if (!low || hpShare(low) > 0.6) return;
    f.friend = low.id;
    if (!m.blocked(f, sup, low)) m.press(f.id, sup.id);
    return;
  }
  if (sup.aim === 'near') {
    const caught = enemies.filter((e) => Math.hypot(e.x - f.x, e.y - f.y) <= sup.range + HERO_R - 6);
    if (caught.length && !m.blocked(f, sup)) m.press(f.id, sup.id);
    return;
  }
  if (sup.aim === 'ground') {
    // placed: where it catches the most of them, among the spots under each one it can reach
    let best: Fighter | null = null;
    let most = 0;
    for (const e of enemies) {
      if (m.blocked(f, sup, e)) continue;
      const caught = enemies.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) <= (sup.area ?? 40) - 8).length + (e === target ? 0.5 : 0);
      if (caught > most) {
        most = caught;
        best = e;
      }
    }
    if (best) m.press(f.id, sup.id, { x: best.x, y: best.y });
    return;
  }
  // (one that spends points: a sharp hand wants some to spend, unless it would finish them)
  if (m.how(f, sup).spend && f.points && f.pts < 3 && skill >= SHARP_FROM && target.hp > target.maxHp * 0.3) return;
  if (!m.blocked(f, sup, target)) m.press(f.id, sup.id);
}

/** Something placed is about to land on them, or lies burning under them: which way out is nearest. */
function dodge(m: Match, f: Fighter, b: Brain, skill: number): MoveInput | null {
  if (m.held(f) || m.rooted(f) || f.dash) return null;
  if (b.shots.size > 24) b.shots.clear();
  let best: { out: number; sx: number; sy: number } | null = null;
  // (what was left on the ground: out of it, for whoever has the wits; a dull one stands in it a while)
  for (const z of m.fields) {
    // (nobody walks out of one that comes after them nearly as fast as they walk: it is fought through; a slow one is walked away from)
    if (z.team === f.team || (ABILITIES[z.ab]?.field?.seek ?? 0) > 0.7) continue;
    const dx = f.x - z.x;
    const dy = f.y - z.y;
    const d = Math.hypot(dx, dy);
    if (d > z.r + 6 || z.dur - z.t < 0.9 - skill * 0.7) continue;
    const key = `f${z.src}:${z.ab}:${Math.round(z.dur * 10)}`;
    let will = b.shots.get(key);
    if (will === undefined) {
      will = b.rand() < 0.15 + skill * 0.8;
      b.shots.set(key, will);
    }
    if (!will) continue;
    const len = d || 1;
    // (away from the way it drifts, if it is coming at them)
    best = { out: z.r + 6 - d, sx: d > 1 ? dx / len : f.dirX || 1, sy: d > 1 ? dy / len : f.dirY };
  }
  for (const z of m.zones) {
    if (z.team === f.team) continue;
    const dx = f.x - z.x;
    const dy = f.y - z.y;
    const d = Math.hypot(dx, dy);
    if (d > z.r + 4) continue;
    // a sharp eye sees it placed sooner
    if (z.dur - z.t < 0.34 - skill * 0.28) continue;
    const key = `${z.src}:${z.ab}:${Math.round(z.x)}:${Math.round(z.y)}`;
    let will = b.shots.get(key);
    if (will === undefined) {
      will = b.rand() < 0.04 + skill * skill * 0.66;
      b.shots.set(key, will);
    }
    if (!will) continue;
    const out = z.r + 5 - d;
    if (best && out < best.out) continue;
    // straight out from its middle (from the dead middle, the way they were going)
    const len = d || 1;
    best = { out, sx: d > 1 ? dx / len : f.dirX || 1, sy: d > 1 ? dy / len : f.dirY };
  }
  if (!best) return null;
  return keepIn(m, f, best.sx, best.sy);
}

/** A way to step that doesn't run into the wall or stone: turned about if it would. */
function keepIn(m: Match, f: Fighter, mx: number, my: number): MoveInput {
  const x = f.x + mx * 24;
  const y = f.y + my * 24;
  const bad = x < HERO_R + 4 || y < HERO_R + 8 || x > ARENA_W - HERO_R - 4 || y > ARENA_H - HERO_R - 4 || m.pillars.some((p) => x > p.x - HERO_R && x < p.x + p.w + HERO_R && y > p.y - HERO_R && y < p.y + p.h + HERO_R);
  return bad ? { mx: -mx, my: -my } : { mx, my };
}

function healSelf(m: Match, f: Fighter): void {
  if (f.gcd > 0 || f.cast || hpShare(f) > 0.45) return;
  const ab = f.bar.map((x) => ABILITIES[x]!).find((a) => a.role === 'heal' && !m.blocked(f, a, a.aim === 'friend' ? f : undefined));
  if (ab) {
    f.friend = f.id;
    m.press(f.id, ab.id);
  }
}

/* ------------------------------------------------------------------ the shroud */

const veilOf = (f: Fighter): Ability | undefined => f.bar.map((x) => ABILITIES[x]!).find((a) => a.effects.some((e) => e.k === 'veil'));

/**
 * Into the shroud: out of a fight whenever it can (it is back in moments), and in one when the fight is going badly and
 * someone is on them (the long way out, to come back on their own terms).
 */
function shroud(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[]): void {
  const ab = veilOf(f);
  if (!ab || m.blocked(f, ab)) return;
  const near = enemies.some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 60);
  if (m.calm(f) && !near) {
    m.press(f.id, ab.id);
    return;
  }
  const hunted = enemies.some((e) => e.target === f.id);
  if (hunted && hpShare(f) < 0.35 && b.rand() < 0.3 + skill * 0.7) m.press(f.id, ab.id);
}

/** Hidden, and close enough: the opener (a step to their back first, from a little way off). */
function prowl(m: Match, f: Fighter, b: Brain, skill: number, target: Fighter): void {
  const bar = f.bar.map((x) => ABILITIES[x]!);
  const d = Math.hypot(target.x - f.x, target.y - f.y);
  const walk = bar.find((a) => a.quiet && !a.super && a.effects.some((e) => e.k === 'behind'));
  if (walk && d > 44 && b.rand() < 0.4 + skill * 0.6 && !m.blocked(f, walk, target)) m.press(f.id, walk.id);
  const opener = bar.find((a) => a.veiled && !m.blocked(f, a, target)) ?? (bar.some((a) => a.veiled) ? undefined : bar.find((a) => atFoe(a) && a.role !== 'mobility' && !m.blocked(f, a, target)));
  // (a sharp one waits until it's at their back, unless it has been creeping a long while)
  if (opener && (m.behind(f, target) || skill < 0.5 || b.rand() < 0.15)) m.press(f.id, opener.id);
}

/** Creeping up on them: round to their back, out of their way. */
function stalk(m: Match, f: Fighter, b: Brain, t: Fighter): MoveInput {
  const back = backOf(t, 14);
  const d = Math.hypot(back.x - f.x, back.y - f.y);
  if (d < 4) return { mx: 0, my: 0 };
  // (not through the front of them: wide round their side when coming from ahead)
  if (!m.behind(f, t) && Math.hypot(t.x - f.x, t.y - f.y) < 50) {
    const side = backOf(t, 26, b.side * 1.6);
    return steer(m, f, b, side.x, side.y);
  }
  return steer(m, f, b, back.x, back.y);
}

/** A point at a fighter's back (or turned `turn` round from it), `r` out. */
function backOf(t: Fighter, r: number, turn = 0): { x: number; y: number } {
  const fd = Math.hypot(t.dirX, t.dirY) || 1;
  const a = Math.atan2(-t.dirY / fd, -t.dirX / fd) + turn;
  return { x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r };
}

/** Nobody to be seen: the middle of the ground, beside a friend if there is one, looking about. */
function lookOut(m: Match, f: Fighter, b: Brain, friends: Fighter[]): MoveInput {
  const pal = friends.find((o) => o !== f && !o.dead);
  const s = pal ?? m.sigilSpot();
  if (Math.hypot(s.x - f.x, s.y - f.y) < (pal ? 30 : 20)) return { mx: 0, my: 0 };
  return steer(m, f, b, s.x, s.y);
}

/* ------------------------------------------------------------------ feet */

function walk(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter, friends: Fighter[], healer: boolean): MoveInput {
  const bar = f.bar.map((x) => ABILITIES[x]!);
  const melee = bar.some((a) => a.aim === 'enemy' && a.range <= 40 && a.role === 'damage');
  const near = enemies.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
  const nearD = Math.hypot(near.x - f.x, near.y - f.y);
  // the sigil: worth a run when nobody's nearer to it, or when it's needed
  const sg = m.sigil;
  if (sg && b.rand() < 0.3 + skill * 0.7) {
    const mine = Math.hypot(sg.x - f.x, sg.y - f.y);
    const theirs = Math.min(...enemies.map((e) => Math.hypot(sg.x - e.x, sg.y - e.y)));
    if (mine < theirs + 20 || (hpShare(f) < 0.5 && mine < 160)) {
      return steer(m, f, b, sg.x, sg.y);
    }
  }
  // a healing sphere, when hurt and one is close (a sharp one goes further for it)
  if (hpShare(f) < 0.7 && b.rand() < 0.25 + skill * 0.75) {
    let orb: { x: number; y: number } | null = null;
    let od = 60 + skill * 70 + (hpShare(f) < 0.35 ? 60 : 0);
    for (const o of m.orbs) {
      if (m.clock < o.at) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < od) {
        od = d;
        orb = o;
      }
    }
    if (orb) return steer(m, f, b, orb.x, orb.y);
  }
  if (m.clock >= b.turnAt) {
    b.side = b.rand() < 0.5 ? 1 : -1;
    b.turnAt = m.clock + 1.3 + b.rand() * 1.8;
  }
  // someone is casting something long at them, and a pillar is close: break line of sight
  const incoming = enemies.find((e) => e.cast && e.cast.target === f.id && !e.cast.channel && e.cast.dur > 1.2);
  if (incoming && skill > 0.5 && (hpShare(f) < 0.65 || (ABILITIES[incoming.cast!.ab]?.cast ?? 0) > 2.2) && b.rand() < skill) {
    const hide = hidingSpot(m, f, incoming);
    if (hide) return steer(m, f, b, hide.x, hide.y);
  }
  // pillar play, as people do it: hurt, with a caster or an archer free to shoot, a sharp player puts stone between
  // them and waits for a heal, a sphere or the other's cooldowns (curses and poisons keep burning behind it, which is
  // what a curse is for). Not a healer's game: they stand where they can be seen by those they keep alive.
  if (!healer && skill >= 0.7 && hpShare(f) < 0.4) {
    const shooter = enemies.find((e) => RANGED.has(e.cls) && !m.held(e) && m.sees(e, f) && Math.hypot(e.x - f.x, e.y - f.y) < 200);
    if (shooter && b.rand() < skill * 0.8) {
      const hide = hidingSpot(m, f, shooter);
      if (hide) return steer(m, f, b, hide.x, hide.y);
    }
  }
  if (melee) {
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    // (a blade that cuts deeper from behind works round to their back once close)
    if (d < 40 && bar.some((a) => a.combo?.behind) && !m.behind(f, target) && !m.held(target)) {
      const back = backOf(target, 14);
      return steer(m, f, b, back.x, back.y);
    }
    if (d > 22) return steer(m, f, b, target.x, target.y);
    return { mx: 0, my: 0 };
  }
  if (healer) {
    // stay in sight of the one who needs you, and away from what's on you
    const hurt = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0]!;
    if (hurt !== f && (!m.sees(f, hurt) || Math.hypot(hurt.x - f.x, hurt.y - f.y) > 150)) return peek(m, f, b, hurt);
    if (nearD < 60 && hpShare(f) < 0.8 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near);
    return strafe(m, f, b, near, 120);
  }
  // a caster or an archer: in sight, at range, away from blades (unless the blade is held), and never standing still
  if (nearD < 56 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near);
  if (!m.sees(f, target) || Math.hypot(target.x - f.x, target.y - f.y) > 165) return peek(m, f, b, target);
  return strafe(m, f, b, target, 125);
}

/** Out of sight or reach: the nearest step that sees them (round the stone), rather than walking at them. */
function peek(m: Match, f: Fighter, b: Brain, t: Fighter): MoveInput {
  const d = Math.hypot(t.x - f.x, t.y - f.y);
  if (d > 165) return steer(m, f, b, t.x, t.y);
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const reach of [26, 48, 72]) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = f.x + Math.cos(a) * reach;
      const y = f.y + Math.sin(a) * reach;
      if (x < 20 || y < 16 || x > ARENA_W - 20 || y > ARENA_H - 16) continue;
      if (m.pillars.some((p) => x > p.x - HERO_R - 2 && x < p.x + p.w + HERO_R + 2 && y > p.y - HERO_R - 2 && y < p.y + p.h + HERO_R + 2)) continue;
      if (!m.sees({ x, y }, t)) continue;
      // nearer is better, and so is not too close to them
      const cost = reach + Math.max(0, 70 - Math.hypot(t.x - x, t.y - y));
      if (cost < bd) {
        bd = cost;
        best = { x, y };
      }
    }
    if (best) break;
  }
  return best ? steer(m, f, b, best.x, best.y) : steer(m, f, b, t.x, t.y);
}

/** Circling a foe at a distance, turning now and then, so that a shot at them has to be a good one. */
function strafe(m: Match, f: Fighter, b: Brain, from: Fighter, want: number): MoveInput {
  const dx = f.x - from.x;
  const dy = f.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const rx = dx / d;
  const ry = dy / d;
  // round them, drifting in or out to the distance wanted
  const out = Math.max(-0.7, Math.min(0.7, (want - d) / 50));
  let mx = -ry * b.side + rx * out;
  let my = rx * b.side + ry * out;
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;
  const step = keepIn(m, f, mx, my);
  if (step.mx !== mx) b.side = -b.side;
  return step;
}

function flee(m: Match, f: Fighter, b: Brain, from: Fighter): MoveInput {
  // away, unless that's into a wall: then round along it
  const dx = f.x - from.x;
  const dy = f.y - from.y;
  const tx = Math.max(60, Math.min(ARENA_W - 60, f.x + dx * 2));
  const ty = Math.max(24, Math.min(ARENA_H - 24, f.y + dy * 2));
  if (Math.hypot(tx - f.x, ty - f.y) < 26) {
    // cornered: slip past toward the middle
    return steer(m, f, b, ARENA_W / 2, ARENA_H / 2);
  }
  return steer(m, f, b, tx, ty);
}

/** The nearest spot behind stone from someone. */
function hidingSpot(m: Match, f: Fighter, from: Fighter): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bd = 90;
  for (const p of m.pillars) {
    if (p.wall) continue;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const dx = cx - from.x;
    const dy = cy - from.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.max(p.w, p.h) * 0.75 + HERO_R + 4;
    const x = cx + (dx / d) * reach;
    const y = cy + (dy / d) * reach;
    const dist = Math.hypot(x - f.x, y - f.y);
    if (dist < bd) {
      bd = dist;
      best = { x, y };
    }
  }
  return best;
}

/** Walk toward a point, turning aside for stone. */
function steer(m: Match, f: Fighter, b: Brain, tx: number, ty: number): MoveInput {
  void b;
  return steerTo(m, f, tx, ty);
}

/** Walk toward a point, turning aside for stone: the computer's way, and a player's "close in automatically" (RingMatch). */
export function steerTo(m: Match, f: Fighter, tx: number, ty: number): MoveInput {
  const dx = tx - f.x;
  const dy = ty - f.y;
  const d = Math.hypot(dx, dy);
  if (d < 3) return { mx: 0, my: 0 };
  const ux = dx / d;
  const uy = dy / d;
  const blocked = (a: number, reach: number): boolean => {
    const x = f.x + Math.cos(a) * reach;
    const y = f.y + Math.sin(a) * reach;
    return x < HERO_R || y < HERO_R + 4 || x > ARENA_W - HERO_R || y > ARENA_H - HERO_R || m.pillars.some((p) => x > p.x - HERO_R - 1 && x < p.x + p.w + HERO_R + 1 && y > p.y - HERO_R - 1 && y < p.y + p.h + HERO_R + 1);
  };
  const a0 = Math.atan2(uy, ux);
  const reach = Math.min(22, d);
  for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
    if (!blocked(a0 + off, reach) && !blocked(a0 + off, reach / 2)) return { mx: Math.cos(a0 + off), my: Math.sin(a0 + off) };
  }
  return { mx: ux, my: uy };
}
