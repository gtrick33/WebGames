import { ABILITIES, DASH, superOf, type Ability } from './abilities';
import { ARENA_H, ARENA_W } from './maps';
import { BASE_SPEED, HERO_R, type Fighter, type Match, type MoveInput, type Zone } from './sim';

/**
 * A computer player for The Ring. It plays by the player's rules: it sees what a player sees, and presses the same
 * buttons through Match.press. `skill` from 0 to 1 is how quickly it reacts and how much of the game it plays: a low
 * one stands under what is falling on it, rarely interrupts and sits on its super; a high one steps out from under it,
 * strafes while it casts, races for the sigil and the healing spheres, saves its super for the kill and kicks heals.
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
  };
}

const HEALS = (f: Fighter): Ability[] => f.bar.map((b) => ABILITIES[b]!).filter((a) => a.role === 'heal' && a.aim === 'friend');

export const isHealer = (f: Pick<Fighter, 'bar'>): boolean => f.bar.filter((b) => ABILITIES[b]?.role === 'heal' && ABILITIES[b]?.aim === 'friend').length >= 2;

const hpShare = (f: Fighter): number => f.hp / f.maxHp;

/** Aimed at an enemy: at the one, or placed on the ground under them. */
const atFoe = (a: Ability): boolean => a.aim === 'enemy' || a.aim === 'ground';

/** One more moment of a computer player's mind. It returns where it wants to walk. */
export function botThink(m: Match, f: Fighter, b: Brain, skill: number, dt: number): MoveInput {
  if (f.dead || m.phase !== 'fight') return { mx: 0, my: 0 };
  // a reflex, every frame: what is about to fall on them is stepped out from under
  const away = dodge(m, f, b, skill);
  if (away) {
    b.move = away;
    b.wait = Math.max(b.wait, 0.22);
    return away;
  }
  b.wait -= dt;
  if (b.wait > 0) return b.move;
  // a sharp player thinks several times a second; a dull one twice
  b.wait = 0.5 - skill * 0.32 + b.rand() * 0.06;
  const enemies = m.enemiesOf(f);
  if (!enemies.length) return { mx: 0, my: 0 };
  const friends = m.friendsOf(f);
  const healer = isHealer(f);
  const target = pickTarget(m, f, enemies);
  f.target = target.id;

  if (!m.held(f)) {
    unleash(m, f, b, skill, enemies, target, friends);
    defend(m, f, b, skill, enemies);
    kick(m, f, b, skill, enemies, dt);
    mobilize(m, f, b, skill, enemies, target);
    if (!f.cast) {
      if (healer) healFriends(m, f, b, skill, friends, enemies);
      dispelFriends(m, f, b, skill, friends);
      control(m, f, b, skill, enemies, target, friends);
      attack(m, f, b, skill, target);
      if (!healer) healSelf(m, f);
    }
  }
  b.move = walk(m, f, b, skill, enemies, target, friends, healer);
  return b.move;
}

/** The one to kill: a team falls on the weakest they can reach, and prefers a healer when nothing is close to dying. */
function pickTarget(m: Match, f: Fighter, enemies: Fighter[]): Fighter {
  const held = (o: Fighter): boolean => o.auras.some((a) => a.kind === 'immune' || a.cc === 'incap');
  const score = (o: Fighter): number => {
    let s = hpShare(o) * 100;
    if (held(o)) s += 200;
    if (!m.sees(f, o)) s += 25;
    s += Math.hypot(o.x - f.x, o.y - f.y) * 0.05;
    // stay on the same one: nothing wastes more than changing your mind
    if (f.target === o.id) s -= 12;
    // what a teammate is on counts for a lot
    for (const a of m.friendsOf(f)) if (a !== f && a.target === o.id) s -= 14;
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
      const ally = m.friendsOf(f).find((a) => hpShare(a) < 0.3 && !a.auras.some((x) => x.ab === ab.id));
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
    if (kinds.includes('charge')) {
      if (Math.hypot(target.x - f.x, target.y - f.y) > 60 && !m.blocked(f, ab, target)) m.press(f.id, id);
      continue;
    }
    if (ab.aim === 'friend') {
      const ally = m.friendsOf(f).find((a) => m.rooted(a) || a.auras.some((x) => x.kind === 'slow' && x.n >= 0.4));
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
    if (stuck && !m.blocked(f, ab)) m.press(f.id, id);
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

function healFriends(m: Match, f: Fighter, _b: Brain, _skill: number, friends: Fighter[], enemies: Fighter[]): void {
  const low = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0];
  if (!low) return;
  const share = hpShare(low);
  if (share > 0.92) return;
  f.friend = low.id;
  const heals = HEALS(f);
  // in danger, what's instant and big; otherwise the steady cast; a heal over time to keep up on the move
  const onMe = enemies.some((e) => e.target === f.id && Math.hypot(e.x - f.x, e.y - f.y) < 60);
  const pick = (want: (a: Ability) => boolean): Ability | undefined => heals.find((a) => want(a) && !m.blocked(f, a, low));
  const hot = (a: Ability): boolean => a.effects.some((e) => e.k === 'hot') && a.cast === 0;
  const ward = f.bar.map((x) => ABILITIES[x]!).find((a) => a.effects.some((e) => e.k === 'absorb') && a.aim === 'friend' && !m.blocked(f, a, low));
  if (share < 0.75 && ward && !low.auras.some((a) => a.ab === ward.id)) {
    m.press(f.id, ward.id);
    return;
  }
  const big = share < 0.3 ? pick((a) => a.cast === 0 && a.effects.some((e) => e.k === 'heal')) : undefined;
  if (big) {
    m.press(f.id, big.id);
    return;
  }
  if (!low.auras.some((a) => a.kind === 'hot' && a.src === f.id)) {
    const h = pick(hot);
    if (h) {
      m.press(f.id, h.id);
      return;
    }
  }
  if (!onMe || share < 0.5) {
    const cast = pick((a) => a.cast > 0 && a.effects.some((e) => e.k === 'heal'));
    if (cast) m.press(f.id, cast.id);
  }
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
    if ((on.dr[kind]?.n ?? 0) >= 2 && on.dr[kind]!.until > m.clock) continue;
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
  // a blade at your throat: no time for anything slow
  const pressed = m.enemiesOf(f).some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 50 && !m.held(e) && !m.rooted(e));
  // chance to throw burst when they're low or they have no help
  const burst = near.filter((a) => a.role === 'burst');
  for (const a of burst) {
    if (a.aim === 'self' && Math.hypot(target.x - f.x, target.y - f.y) < 60 && !m.blocked(f, a)) {
      m.press(f.id, a.id);
      return;
    }
    if (a.aim === 'near') {
      if (Math.hypot(target.x - f.x, target.y - f.y) < a.range && !m.blocked(f, a)) {
        m.press(f.id, a.id);
        return;
      }
      continue;
    }
    // (a placed spell with a cast lands where they stood when it began: only on someone who is going nowhere)
    if (a.aim === 'ground' && a.cast > 0 && !(m.held(target) || m.rooted(target) || (target.cast && !target.cast.channel && target.cast.dur - target.cast.t > 0.8))) continue;
    if (atFoe(a) && !(a.cast > 0 && pressed) && !m.blocked(f, a, target)) {
      m.press(f.id, a.id);
      return;
    }
  }
  // curses and poisons kept up, then the best hit on hand (casting slows you, so a blade close by wants instants)
  const options = near.filter((a) => a.role === 'damage' && atFoe(a));
  const fresh = options.filter((a) => a.effects.some((e) => e.k === 'dmg') || !target.auras.some((x) => x.ab === a.id && x.t > 1));
  const instant = fresh.filter((a) => a.cast === 0).sort((x, y) => worth(y) - worth(x));
  const cast = fresh.filter((a) => a.cast > 0).sort((x, y) => worth(y) - worth(x));
  const order = pressed && skill >= 0.25 ? instant : [...instant.filter((a) => a.effects.some((e) => e.k === 'dot')), ...cast, ...instant];
  for (const a of order) {
    if (m.blocked(f, a, target)) continue;
    if (!m.press(f.id, a.id)) return;
  }
  void b;
}

/** The super, when it's full: on a kill, on a crowd, or to save a friend. */
function unleash(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter, friends: Fighter[]): void {
  const sup = superOf(f.cls);
  if (f.charge < 1 || b.rand() > 0.35 + skill * 0.65) return;
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
  if (!m.blocked(f, sup, target)) m.press(f.id, sup.id);
}

/** Something placed is about to land on them: which way out is nearest (and a Swift Step when walking won't do). */
function dodge(m: Match, f: Fighter, b: Brain, skill: number): MoveInput | null {
  if (m.held(f) || m.rooted(f) || f.dash) return null;
  if (b.shots.size > 24) b.shots.clear();
  let best: { z: Zone; out: number; sx: number; sy: number } | null = null;
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
    best = { z, out, sx: d > 1 ? dx / len : f.dirX || 1, sy: d > 1 ? dy / len : f.dirY };
  }
  if (!best) return null;
  const step = keepIn(m, f, best.sx, best.sy);
  // further out than they can walk in the time left: a Swift Step, if it's ready (and not at the price of a cast nearly done)
  if (best.out > BASE_SPEED * f.mods.speed * best.z.t * 0.9 && skill > 0.35 && !(f.cast && f.cast.dur - f.cast.t < 0.6) && !m.blocked(f, DASH)) {
    f.dirX = step.mx;
    f.dirY = step.my;
    m.press(f.id, DASH.id);
  }
  return step;
}

/** A way to step that doesn't run into the wall, stone or the Gloam: turned about if it would. */
function keepIn(m: Match, f: Fighter, mx: number, my: number): MoveInput {
  const x = f.x + mx * 24;
  const y = f.y + my * 24;
  const bad = x < HERO_R + 4 || y < HERO_R + 8 || x > ARENA_W - HERO_R - 4 || y > ARENA_H - HERO_R - 4 || m.zoneAt(x, y) > 0.98 || m.pillars.some((p) => x > p.x - HERO_R && x < p.x + p.w + HERO_R && y > p.y - HERO_R && y < p.y + p.h + HERO_R);
  return bad ? { mx: -mx, my: -my } : { mx, my };
}

function worth(a: Ability): number {
  let n = 0;
  for (const e of a.effects) if (e.k === 'dmg') n += e.n;
  for (const e of a.effects) if (e.k === 'dot') n += e.n * 0.8;
  return n;
}

function healSelf(m: Match, f: Fighter): void {
  if (f.gcd > 0 || f.cast || hpShare(f) > 0.45) return;
  const ab = f.bar.map((x) => ABILITIES[x]!).find((a) => a.role === 'heal' && !m.blocked(f, a, a.aim === 'friend' ? f : undefined));
  if (ab) {
    f.friend = f.id;
    m.press(f.id, ab.id);
  }
}

/* ------------------------------------------------------------------ feet */

function walk(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter, friends: Fighter[], healer: boolean): MoveInput {
  const bar = f.bar.map((x) => ABILITIES[x]!);
  const melee = bar.some((a) => a.aim === 'enemy' && a.range <= 40 && a.role === 'damage');
  const near = enemies.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
  const nearD = Math.hypot(near.x - f.x, near.y - f.y);
  // out of the Gloam (and away from its edge) before anything else
  if (m.zoneAt(f.x, f.y) > 0.9 && m.zone < 1.4) {
    const s = m.sigilSpot();
    return steer(m, f, b, s.x, s.y);
  }
  // the sigil: worth a run when nobody's nearer to it, or when it's needed
  const sg = m.sigil;
  if (sg && b.rand() < 0.3 + skill * 0.7) {
    const mine = Math.hypot(sg.x - f.x, sg.y - f.y);
    const theirs = Math.min(...enemies.map((e) => Math.hypot(sg.x - e.x, sg.y - e.y)));
    if (mine < theirs + 20 || (hpShare(f) < 0.5 && mine < 160)) {
      if (mine > 70 && skill > 0.5 && !m.blocked(f, DASH)) {
        f.dirX = sg.x - f.x;
        f.dirY = sg.y - f.y;
        m.press(f.id, DASH.id);
      }
      return steer(m, f, b, sg.x, sg.y);
    }
  }
  // a healing sphere, when hurt and one is close and inside the Gloam's edge (a sharp one goes further for it)
  if (hpShare(f) < 0.7 && b.rand() < 0.25 + skill * 0.75) {
    let orb: { x: number; y: number } | null = null;
    let od = 60 + skill * 70 + (hpShare(f) < 0.35 ? 60 : 0);
    for (const o of m.orbs) {
      if (m.clock < o.at || m.zoneAt(o.x, o.y) > 0.95) continue;
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
  if (melee) {
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    // a Swift Step closes the gap on someone running
    if (d > 70 && d < 140 && skill > 0.45 && m.sees(f, target) && !m.blocked(f, DASH) && b.rand() < skill) {
      f.dirX = target.x - f.x;
      f.dirY = target.y - f.y;
      m.press(f.id, DASH.id);
    }
    if (d > 22) return steer(m, f, b, target.x, target.y);
    return { mx: 0, my: 0 };
  }
  if (healer) {
    // stay in sight of the one who needs you, and away from what's on you
    const hurt = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0]!;
    if (hurt !== f && (!m.sees(f, hurt) || Math.hypot(hurt.x - f.x, hurt.y - f.y) > 150)) return peek(m, f, b, hurt);
    if (nearD < 60 && hpShare(f) < 0.8 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near, skill);
    return strafe(m, f, b, near, 120);
  }
  // a caster or an archer: in sight, at range, away from blades (unless the blade is held), and never standing still
  if (nearD < 56 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near, skill);
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
      if (x < 20 || y < 16 || x > ARENA_W - 20 || y > ARENA_H - 16 || m.zoneAt(x, y) > 0.95) continue;
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

function flee(m: Match, f: Fighter, b: Brain, from: Fighter, skill = 0.5): MoveInput {
  // a Swift Step out from under a blade
  if (skill > 0.5 && !f.cast && Math.hypot(from.x - f.x, from.y - f.y) < 34 && !m.blocked(f, DASH) && b.rand() < skill * 0.5) {
    f.dirX = f.x - from.x || 1;
    f.dirY = f.y - from.y;
    m.press(f.id, DASH.id);
  }
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
  void b;
  return { mx: ux, my: uy };
}
