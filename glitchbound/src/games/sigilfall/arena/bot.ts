import { ABILITIES, TOKEN, type Ability } from './abilities';
import { ARENA_H, ARENA_W } from './maps';
import { HERO_R, type Fighter, type Match, type MoveInput } from './sim';

/**
 * A computer player for The Ring. It plays by the player's rules: it sees what a player sees, and presses the same
 * buttons through Match.press. `skill` from 0 to 1 is how quickly it reacts and how much of the game it plays: a low
 * one rarely interrupts and forgets its Token; a high one chains crowd control, stays out of sight of long casts and
 * kicks heals.
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
  };
}

const HEALS = (f: Fighter): Ability[] => f.bar.map((b) => ABILITIES[b]!).filter((a) => a.role === 'heal' && a.aim === 'friend');

export const isHealer = (f: Pick<Fighter, 'bar'>): boolean => f.bar.filter((b) => ABILITIES[b]?.role === 'heal' && ABILITIES[b]?.aim === 'friend').length >= 2;

const hpShare = (f: Fighter): number => f.hp / f.maxHp;

/** One more moment of a computer player's mind. It returns where it wants to walk. */
export function botThink(m: Match, f: Fighter, b: Brain, skill: number, dt: number): MoveInput {
  if (f.dead || m.phase !== 'fight') return { mx: 0, my: 0 };
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

  spendToken(m, f, b, skill, enemies);
  if (!m.held(f)) {
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

function spendToken(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[]): void {
  const hold = m.held(f);
  if (!hold || hold.still || (f.cds.token ?? 0) > 0 || hold.t < 1.2) return;
  // a good player spends it when it matters: when low, or when a big stun lands with enemies on them
  if (b.rand() > skill * 0.9 + 0.1) return;
  if (hpShare(f) < 0.55 || (hold.cc === 'stun' && enemies.some((e) => e.target === f.id) && hpShare(f) < 0.8)) m.press(f.id, TOKEN.id);
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
    // standing still is the price of the real heals, so the walking stops for them
    const cast = pick((a) => a.cast > 0 && a.effects.some((e) => e.k === 'heal')) ?? (m.moving(f) ? heals.find((a) => a.cast > 0 && a.effects.some((e) => e.k === 'heal') && !blockedButMoving(m, f, a, low)) : undefined);
    if (cast) {
      f.vx = 0;
      f.vy = 0;
      m.press(f.id, cast.id);
    }
  }
}

const blockedButMoving = (m: Match, f: Fighter, a: Ability, t: Fighter): string | null => {
  const { vx, vy } = f;
  f.vx = 0;
  f.vy = 0;
  const why = m.blocked(f, a, t);
  f.vx = vx;
  f.vy = vy;
  return why;
};

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
    // alone with them, a hold that breaks only buys time: spend it when time is what's needed
    if (breaks && enemies.length === 1 && hpShare(f) > 0.5) continue;
    // a long hold costs the time to deal damage: use it when it wins something
    if (ab.cast > 0 && m.moving(f)) continue;
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
    if (a.aim === 'enemy' && !m.blocked(f, a, target) && !m.moving(f)) {
      m.press(f.id, a.id);
      return;
    }
  }
  // curses and poisons kept up, then the best hit on hand
  const options = near.filter((a) => a.role === 'damage' && a.aim === 'enemy');
  const fresh = options.filter((a) => a.effects.some((e) => e.k === 'dmg') || !target.auras.some((x) => x.ab === a.id && x.t > 1));
  const instant = fresh.filter((a) => a.cast === 0).sort((x, y) => worth(y) - worth(x));
  const cast = fresh.filter((a) => a.cast > 0).sort((x, y) => worth(y) - worth(x));
  // on a target held and busy, a real cast; otherwise on the move
  const wantsCast = cast.length > 0 && (skill < 0.4 || !m.enemiesOf(f).some((e) => e.target === f.id && Math.hypot(e.x - f.x, e.y - f.y) < 50));
  const order = wantsCast ? [...instant.filter((a) => a.effects.some((e) => e.k === 'dot')), ...cast, ...instant] : instant;
  for (const a of order) {
    if (blockedButMoving(m, f, a, target)) continue;
    if (a.cast > 0) {
      f.vx = 0;
      f.vy = 0;
    }
    if (!m.press(f.id, a.id)) return;
  }
  void b;
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
  // holding still for a cast is what a cast costs
  if (f.cast) {
    // a long cast at them when they can't get to you... unless it's nearly over and you're dying
    return { mx: 0, my: 0 };
  }
  const bar = f.bar.map((x) => ABILITIES[x]!);
  const melee = bar.some((a) => a.aim === 'enemy' && a.range <= 40 && a.role === 'damage');
  const near = enemies.reduce((a, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? c : a));
  const nearD = Math.hypot(near.x - f.x, near.y - f.y);
  // someone is casting something long at them, and a pillar is close: break line of sight
  const incoming = enemies.find((e) => e.cast && e.cast.target === f.id && !e.cast.channel && e.cast.dur > 1.2);
  if (incoming && skill > 0.5 && (hpShare(f) < 0.65 || (ABILITIES[incoming.cast!.ab]?.cast ?? 0) > 2.2) && b.rand() < skill) {
    const hide = hidingSpot(m, f, incoming);
    if (hide) return steer(m, f, b, hide.x, hide.y);
  }
  if (melee) {
    if (Math.hypot(target.x - f.x, target.y - f.y) > 22) return steer(m, f, b, target.x, target.y);
    return { mx: 0, my: 0 };
  }
  if (healer) {
    // stay in sight of the one who needs you, and away from what's on you
    const hurt = [...friends].sort((a, c) => hpShare(a) - hpShare(c))[0]!;
    if (hurt !== f && (!m.sees(f, hurt) || Math.hypot(hurt.x - f.x, hurt.y - f.y) > 150)) return steer(m, f, b, hurt.x, hurt.y);
    if (nearD < 60 && hpShare(f) < 0.8 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near);
    if (hpShare(hurt) < 0.9) return { mx: 0, my: 0 };
    return roam(m, f, b, near);
  }
  // a caster or an archer: in sight, at range, and away from blades (unless the blade is held: then it's time to cast)
  if (nearD < 56 && !m.held(near) && !m.rooted(near)) return flee(m, f, b, near);
  if (!m.sees(f, target) || Math.hypot(target.x - f.x, target.y - f.y) > 165) return steer(m, f, b, target.x, target.y);
  // an archer never needs to stop; a caster does
  if (!bar.some((a) => a.cast > 0 && a.role !== 'cc')) return nearD < 100 ? flee(m, f, b, near) : { mx: 0, my: 0 };
  return { mx: 0, my: 0 };
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

function roam(m: Match, f: Fighter, b: Brain, from: Fighter): MoveInput {
  if (!b.go || b.go.t < m.clock) {
    const a = b.rand() * Math.PI * 2;
    b.go = { x: Math.max(64, Math.min(ARENA_W - 64, from.x + Math.cos(a) * 105)), y: Math.max(40, Math.min(ARENA_H - 40, from.y + Math.sin(a) * 70)), t: m.clock + 3 };
  }
  return steer(m, f, b, b.go.x, b.go.y);
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
