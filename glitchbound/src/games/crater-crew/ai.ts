/**
 * The computer crews. A bot stays where it stands and searches for its shot: it flies test shells
 * through the real physics (wind, gravity, the ground as it is now) over a grid of angles and powers
 * for its rockets and grenades, checks the Zapper's line and the Mallet's reach, scores every landing
 * by the damage it would do to enemies minus to friends, refines the best, and then misses a little
 * on purpose (Easy a lot, Hard hardly).
 */
import type { Level, Match, TurnInput } from './match';
import { hasAmmo, worldFor } from './match';
import { rng } from './math';
import { aimVector, flyProj, muzzle, type Fire, type Proj, type ProjKind, type Unit, type World } from './sim';
import { BODY_H, HALF_W, isSolid } from './terrain';
import { WEAPONS, type WeaponId } from './weapons';

interface Plan {
  fire: Fire;
  score: number;
}

const NOISE: Record<Level, { aim: number; power: number; greed: number }> = {
  easy: { aim: 70, power: 12, greed: 0.5 },
  normal: { aim: 26, power: 5, greed: 0.85 },
  hard: { aim: 8, power: 2, greed: 1 },
};

const center = (u: Unit): [number, number] => [u.x, u.y - BODY_H / 2];

/** Where a test shell would go off (null: lost in the liquid or off the map). */
function landing(w: World, me: Unit, kind: ProjKind, f: Fire): [number, number] | null {
  const def = WEAPONS[kind as WeaponId];
  const [ux, uy] = aimVector(f.aim, f.dir);
  const [ox, oy] = muzzle(me, f.aim, f.dir);
  if (isSolid(w.mask, Math.round(ox), Math.round(oy))) return [ox, oy];
  const speed = (def.speed * f.power) / 100;
  const p: Proj = { kind, x: ox, y: oy, vx: ux * speed, vy: uy * speed, fuse: def.fuse > 0 ? Math.round(def.fuse * 60) : -1, owner: me.id, age: 0, rest: false };
  for (let i = 0; i < 600; i++) {
    const out = flyProj(w, p);
    if (out.k === 'burst') return [out.x, out.y];
    if (out.k === 'gone') return null;
  }
  return null;
}

/** What a blast at (x, y) is worth to `me`'s crew. */
function worth(w: World, me: Unit, x: number, y: number, r: number, dmg: number): number {
  let score = 0;
  const reach = r + 12;
  for (const u of w.units) {
    if (u.dead || u.drowned) continue;
    const [cx, cy] = center(u);
    const d = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
    if (d >= reach) continue;
    const hit = Math.min(u.hp, dmg * (1 - d / reach));
    if (u.crew === me.crew) score -= hit * 1.6 + (hit >= u.hp ? 40 : 0);
    else score += hit + (hit >= u.hp ? 30 : 0);
  }
  // a little credit for landing close to an enemy, so near misses beat wild ones while searching
  let near = Infinity;
  for (const u of w.units) if (!u.dead && !u.drowned && u.crew !== me.crew) near = Math.min(near, Math.abs(u.x - x) + Math.abs(u.y - BODY_H / 2 - y));
  return score + (near < 400 ? (400 - near) / 200 : 0);
}

function searchArc(w: World, me: Unit, kind: 'rocket' | 'grenade' | 'splitter', coarse: boolean): Plan | null {
  const def = WEAPONS[kind];
  let best: Plan | null = null;
  const tryShot = (aim: number, dir: 1 | -1, power: number): void => {
    if (aim < -850 || aim > 850 || power < 5 || power > 100) return;
    const f: Fire = { w: kind, aim, dir, power, tx: 0 };
    const at = landing(w, me, kind, f);
    if (!at) return;
    const s = worth(w, me, at[0], at[1], def.radius, def.damage) + (kind === 'splitter' ? 6 : 0);
    if (!best || s > best.score) best = { fire: f, score: s };
  };
  const aStep = coarse ? 100 : 60;
  const pStep = coarse ? 12 : 7;
  for (const dir of [1, -1] as const) for (let aim = -300; aim <= 850; aim += aStep) for (let power = 25; power <= 100; power += pStep) tryShot(aim, dir, power);
  if (!best) return null;
  const top: Plan = best;
  for (let da = -40; da <= 40; da += 10) for (let dp = -6; dp <= 6; dp += 2) tryShot(top.fire.aim + da, top.fire.dir, top.fire.power + dp);
  return best;
}

function searchZap(w: World, me: Unit): Plan | null {
  let best: Plan | null = null;
  for (const t of w.units) {
    if (t.dead || t.drowned || t.crew === me.crew) continue;
    const [tx, ty] = center(t);
    const dir: 1 | -1 = tx >= me.x ? 1 : -1;
    // the aim that points at it (atan2 is fine here: the bot's choice is sent as a number)
    const aim = Math.round((Math.atan2(me.y - 11 - ty, Math.abs(tx - me.x)) * 1800) / Math.PI);
    if (aim < -850 || aim > 850) continue;
    const [ux, uy] = aimVector(aim, dir);
    let x = me.x + ux * 10;
    let y = me.y - 11 + uy * 10;
    let first: Unit | null = null;
    for (let i = 0; i < 600 && !first; i++) {
      x += ux * 2;
      y += uy * 2;
      if (isSolid(w.mask, Math.round(x), Math.round(y))) break;
      for (const v of w.units) if (v !== me && !v.dead && !v.drowned && Math.abs(v.x - x) <= HALF_W + 1 && y <= v.y + 1 && y >= v.y - BODY_H) first = v;
    }
    if (!first || first.crew === me.crew) continue;
    const s = Math.min(first.hp, WEAPONS.zapper.damage) + (first.hp <= WEAPONS.zapper.damage ? 30 : 0) - 2;
    if (!best || s > best.score) best = { fire: { w: 'zapper', aim, dir, power: 0, tx: 0 }, score: s };
  }
  return best;
}

function searchMallet(w: World, me: Unit, m: Match): Plan | null {
  if (!hasAmmo(m, me.crew, 'mallet')) return null;
  for (const t of w.units) {
    if (t.dead || t.drowned || t.crew === me.crew) continue;
    const dx = t.x - me.x;
    if (Math.abs(dx) > 22 || Math.abs(t.y - me.y) > 16) continue;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    // swing it out over the nearest drop
    return { fire: { w: 'mallet', aim: 350, dir, power: 0, tx: 0 }, score: Math.min(t.hp, WEAPONS.mallet.damage) + 28 };
  }
  return null;
}

function searchMeteor(w: World, me: Unit, m: Match): Plan | null {
  if (!hasAmmo(m, me.crew, 'meteor')) return null;
  let best: Plan | null = null;
  for (const t of w.units) {
    if (t.dead || t.drowned || t.crew === me.crew) continue;
    // aim upwind so the drift carries the meteors onto it
    const tx = Math.round(Math.max(0, Math.min(1800, t.x - w.wind * 6)));
    let s = 0;
    for (const u of w.units) {
      if (u.dead || u.drowned || Math.abs(u.x - t.x) > 90) continue;
      s += u.crew === me.crew ? -40 : 34;
    }
    if (!best || s > best.score) best = { fire: { w: 'meteor', aim: 0, dir: 1, power: 0, tx }, score: s };
  }
  return best;
}

/** The computer's turn: no walking, one shot. Deterministic for a given `seed`. */
export function botTurn(m: Match, level: Level, seed: number): TurnInput {
  const w = worldFor(m);
  const me = w.units.find((u) => u.id === m.active);
  if (!me) return { walk: [], fire: null };
  const r = rng(seed);
  const n = NOISE[level];
  const coarse = level === 'easy';
  const plans: Plan[] = [];
  const push = (p: Plan | null): void => {
    if (p) plans.push(p);
  };
  push(searchArc(w, me, 'rocket', coarse));
  push(searchArc(w, me, 'grenade', true));
  if (hasAmmo(m, me.crew, 'splitter') && m.turn > m.crews.length * 2) push(searchArc(w, me, 'splitter', true));
  push(searchZap(w, me));
  push(searchMallet(w, me, m));
  const best = plans.reduce<Plan | null>((a, p) => (!a || p.score > a.score ? p : a), null);
  if (!best || best.score < 8) push(searchMeteor(w, me, m));
  plans.sort((a, b) => b.score - a.score);
  // easy bots don't always see the best shot
  const pick = plans.length > 1 && r() > n.greed ? plans[1]! : plans[0];
  if (!pick) {
    const target = w.units.find((u) => !u.dead && !u.drowned && u.crew !== me.crew);
    const dir: 1 | -1 = target && target.x < me.x ? -1 : 1;
    return { walk: [], fire: { w: 'rocket', aim: 450, dir, power: 60, tx: 0 } };
  }
  const f = { ...pick.fire };
  if (f.w !== 'mallet' && f.w !== 'meteor') f.aim = Math.max(-850, Math.min(850, Math.round(f.aim + (r() * 2 - 1) * n.aim)));
  if (WEAPONS[f.w].aim === 'power') f.power = Math.max(5, Math.min(100, Math.round(f.power + (r() * 2 - 1) * n.power)));
  if (f.w === 'meteor') f.tx = Math.max(0, Math.min(1800, Math.round(f.tx + (r() * 2 - 1) * n.aim)));
  return { walk: [], fire: f };
}
