import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { TILE } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';
import { exposed, fighting, onFloor, wound } from './arena';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Crown City's catacombs: ids start with 'crown:'. Two who stand between the hero and Maelis Crane.
 *
 * Silas Vey, the Herald's last hand (the Ossuary of Ash-Gold), pays for everything with the Chancellor's ash-gold, and
 * he scatters it about the ossuary for anyone to take (`scatter`). Take it and it weighs on you, cold and heavy, a
 * while (the more you carry, the slower you go). Leave it lying and he spends it: a hired blade for every few coins
 * still on the floor when he comes to pay. Take every coin and he has nothing to pay with: he is left open.
 *
 * The Royal Auditor (the Counting Hall), who kept the old kings' accounts and keeps them still, writes down every blow
 * the hero strikes him (`settle`): the tally hangs over him. Then he settles the account: a ward of the ledger is
 * marked on the floor, and whoever stands outside it when it closes pays a share of the tally back in their own
 * blood. Inside it, the ledger's ink burns him instead. Strike hard, but be in the ward when he settles.
 *
 * What lasts beyond a pattern (the coins and their weight, the tally) is kept per boss here and run by a small ticker
 * (World.after, once a step) for as long as the fight lasts.
 */

const GOLD = '#e8d07a';
const INK = '#f0e0a0';
const BLADE = 'hired-knife';

/* ------------------------------------------------------------ Silas Vey's ash-gold */

interface Coin {
  f: World['floaters'][number];
}
interface Purse {
  last: number;
  coins: Coin[];
  /** When he comes to pay with what is left, and how many coins buy a blade. */
  spendAt: number;
  per: number;
  /** When each coin the hero carries stops weighing on them, and how much each one weighs. */
  carried: number[];
  weight: number;
  carry: number;
  fxT: number;
}

const PURSES = new WeakMap<Enemy, Purse>();

function purseOf(w: World, e: Enemy): Purse {
  let s = PURSES.get(e);
  if (!s) {
    s = { last: w.time, coins: [], spendAt: 0, per: 3, carried: [], weight: 0.07, carry: 6, fxT: 0 };
    PURSES.set(e, s);
    w.after(0, () => purseTick(w, e));
  }
  return s;
}

function dropCoins(w: World, s: Purse): void {
  const mine = new Set(s.coins.map((c) => c.f));
  w.floaters = w.floaters.filter((f) => !mine.has(f));
  s.coins = [];
}

function purseTick(w: World, e: Enemy): void {
  const s = PURSES.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    dropCoins(w, s);
    PURSES.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const p = w.player;
  // the coins turn and glint where they lie; the hero picks up what they walk over
  for (const c of s.coins) c.f.rot += dt * 3;
  if (!p.dead) {
    const took = s.coins.filter((c) => dist(c.f.x, c.f.y, p.x, p.y) < p.r + 9);
    if (took.length) {
      const gone = new Set(took.map((c) => c.f));
      w.floaters = w.floaters.filter((f) => !gone.has(f));
      s.coins = s.coins.filter((c) => !gone.has(c.f));
      for (const c of took) {
        s.carried.push(w.time + s.carry);
        w.addFx({ kind: 'coin', x: c.f.x, y: c.f.y - 6, vx: 0, vy: -40, life: 0.4, size: 3, color: GOLD });
      }
      w.text(p.x, p.y - 26, s.coins.length ? `Ash-gold: heavy and cold (${s.coins.length} left)` : 'Every coin taken!', GOLD, false);
      w.sfx('coin', 0.5);
    }
  }
  // the weight of what the hero carries: slower the more they hold
  s.carried = s.carried.filter((t) => t > w.time);
  if (s.carried.length && !p.dead) {
    const power = Math.min(0.5, s.carried.length * s.weight);
    const chill = p.statuses.find((x) => x.id === 'chill');
    if (chill) {
      chill.power = Math.max(chill.power, power);
      chill.t = Math.max(chill.t, 0.2);
    } else p.statuses.push({ id: 'chill', t: 0.2, power, tick: 0 });
    s.fxT -= dt;
    if (s.fxT <= 0) {
      s.fxT = 0.4;
      w.addFx({ kind: 'spark', x: p.x + (w.rand() - 0.5) * 10, y: p.y - 6, vx: 0, vy: 14, life: 0.4, size: 2, color: GOLD });
    }
  }
  // he comes to pay: a hired blade for every few coins still on the floor, or nothing to pay with at all
  if (s.spendAt > 0 && w.time >= s.spendAt) {
    s.spendAt = 0;
    if (s.coins.length) {
      const blades = Math.floor(s.coins.length / s.per);
      for (let i = 0; i < blades; i++) {
        const c = s.coins[(i * s.per) % s.coins.length]!;
        w.spawnAdd(BLADE, c.f.x, c.f.y, e.room);
      }
      for (const c of s.coins) w.fxBurst(c.f.x, c.f.y, GOLD, 6, 8);
      w.text(e.x, e.y - e.r - 18, blades ? 'You left it lying. I never do.' : 'Small change. Keep it.', GOLD, true);
      dropCoins(w, s);
    } else exposed(w, e, 2.4, 'My purse... you have emptied my purse!', GOLD);
  }
  w.after(0, () => purseTick(w, e));
}

/**
 * The scatter: `coins` coins of ash-gold thrown about the ossuary; `spend` s later he pays a hired blade for every
 * `per` coins left lying. A coin the hero picks up weighs `weight` (of their speed) for `carry` s.
 */
const scatter: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = purseOf(w, e);
  if (pt.step === 0) {
    if (s.spendAt > 0) {
      k.end();
      return;
    }
    s.per = k.num('per', 3);
    s.weight = k.num('weight', 0.07);
    s.carry = k.num('carry', 6);
    s.spendAt = w.time + k.num('spend', 7);
    const tiles = w.map.roomTiles[e.room] ?? [];
    const n = k.num('coins', 10);
    for (let tries = 0; tries < n * 10 && s.coins.length < n && tiles.length; tries++) {
      const t = tiles[Math.floor(w.rand() * tiles.length)]!;
      const x = ((t % w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 10;
      const y = (Math.floor(t / w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 10;
      if (!onFloor(w, e, x, y, 4) || dist(x, y, w.player.x, w.player.y) < 30 || s.coins.some((c) => dist(c.f.x, c.f.y, x, y) < 24)) continue;
      const f = { m: 'coin', x, y, lift: 3, h: 6, rot: w.rand() * TAU, tint: [1.25, 1.1, 0.75] as const };
      s.coins.push({ f });
      w.floaters.push(f);
      w.addFx({ kind: 'beam', x: e.x, y: e.y - 16, x2: x, y2: y, life: 0.3, size: 1, color: GOLD });
    }
    w.text(e.x, e.y - e.r - 18, 'Take it. Everyone else did.', GOLD, true);
    w.text(w.player.x, w.player.y - 30, 'Pick up the ash-gold before he spends it (it is heavy)', '#fff0c0', false);
    w.sfx('coin', 0.7);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.6) k.end();
};

/** Silas's coins on the floor and how many the hero carries (for tests). */
export const purseOfSilas = (w: World, e: Enemy): { coins: { x: number; y: number }[]; carried: number; paying: boolean } | null => {
  const s = PURSES.get(e);
  return s ? { coins: s.coins.map((c) => ({ x: c.f.x, y: c.f.y })), carried: s.carried.filter((t) => t > w.time).length, paying: s.spendAt > 0 } : null;
};

/* ------------------------------------------------------------ the Royal Auditor's ledger */

interface Ledger {
  last: number;
  hp: number;
  tally: number;
  said: number;
  /** The ward of the ledger while an account is being settled. */
  ward: { x: number; y: number; r: number; at: number; share: number; cap: number } | null;
  fxT: number;
}

const LEDGERS = new WeakMap<Enemy, Ledger>();

function ledgerOf(w: World, e: Enemy): Ledger {
  let s = LEDGERS.get(e);
  if (!s) {
    s = { last: w.time, hp: e.hp, tally: 0, said: 0, ward: null, fxT: 0 };
    LEDGERS.set(e, s);
    w.after(0, () => ledgerTick(w, e));
  }
  return s;
}

function ledgerTick(w: World, e: Enemy): void {
  const s = LEDGERS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    LEDGERS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  // every blow written down
  if (e.hp < s.hp) s.tally += s.hp - e.hp;
  s.hp = e.hp;
  if (s.tally > 0 && w.time - s.said > 1.5) {
    s.said = w.time;
    w.text(e.x, e.y - e.r - 30, `Owed: ${Math.round(s.tally)}`, INK, false);
  }
  const p = w.player;
  const wd = s.ward;
  if (wd) {
    s.fxT -= dt;
    if (s.fxT <= 0) {
      s.fxT = 0.2;
      w.addFx({ kind: 'ring', x: wd.x, y: wd.y, life: 0.3, size: wd.r, color: INK });
      w.addFx({ kind: 'glow', x: wd.x, y: wd.y, life: 0.3, size: 10, color: INK });
    }
    if (w.time >= wd.at) {
      s.ward = null;
      const inside = !p.dead && dist(p.x, p.y, wd.x, wd.y) <= wd.r + p.r * 0.5;
      if (inside) {
        // the ledger's ink turns on its keeper
        wound(w, e, 0.02, INK);
        w.text(p.x, p.y - 30, 'Paid in full, by the ledger!', INK, true);
        w.text(e.x, e.y - e.r - 18, 'Irregular. Most irregular.', INK, true);
      } else if (!p.dead) {
        const owed = Math.min(p.maxHp * wd.cap, s.tally * wd.share);
        if (owed > 0 && hurtPlayer(w, owed, { pierce: true, source: e })) w.text(p.x, p.y - 30, `The account is settled: -${Math.round(owed)}`, '#ff9a9a', true);
        w.addFx({ kind: 'beam', x: e.x, y: e.y - 16, x2: p.x, y2: p.y - 8, life: 0.35, size: 2, color: INK });
      }
      s.tally = 0;
      w.sfx('coin', 0.6);
      w.shake(3);
    }
  }
  w.after(0, () => ledgerTick(w, e));
}

/**
 * Settling the account: a ward of the ledger (`rr` across) marked `near`-`far` px from the hero for `warn` s; whoever
 * stands outside it when it closes pays `share` of the tally of blows (at most `cap` of their health).
 */
const settle: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = ledgerOf(w, e);
  const p = w.player;
  if (pt.step === 0) {
    if (s.ward) {
      k.end();
      return;
    }
    const r = k.num('rr', 34);
    const warn = k.num('warn', 2.4);
    let at: { x: number; y: number } | null = null;
    for (let i = 0; i < 20 && !at; i++) {
      const a = w.rand() * TAU;
      const d = k.num('near', 60) + w.rand() * (k.num('far', 150) - k.num('near', 60));
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d * 0.8;
      if (onFloor(w, e, x, y, r * 0.6)) at = { x, y };
    }
    at ??= { x: p.x, y: p.y };
    s.ward = { x: at.x, y: at.y, r, at: w.time + warn, share: k.num('share', 0.35), cap: k.num('cap', 0.4) };
    // the whole hall marked, but for the ward
    w.addTelegraph({ shape: 'donut', x: at.x, y: at.y, r: 900, r2: r, angle: 0, len: 0, dur: warn, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    w.text(e.x, e.y - e.r - 18, 'And now, the reckoning.', INK, true);
    w.text(p.x, p.y - 30, 'Into the ward before the account is settled!', '#fff0c0', false);
    w.sfx('bell-toll', 0.5);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.7) k.end();
};

/** He opens his book as the fight begins: from now on every blow is written down. */
const ledger: PatternFn = (w, e, _dt, k) => {
  ledgerOf(w, e);
  w.text(e.x, e.y - e.r - 18, 'Name, and business? Never mind. I shall write it all down.', INK, true);
  k.end();
};

/** The Auditor's tally and his ward (for tests). */
export const ledgerOfAuditor = (e: Enemy): { tally: number; ward: { x: number; y: number; r: number } | null } | null => {
  const s = LEDGERS.get(e);
  return s ? { tally: s.tally, ward: s.ward ? { x: s.ward.x, y: s.ward.y, r: s.ward.r } : null } : null;
};

export const CROWN_CATACOMBS_PATTERNS: Record<string, PatternFn> = { 'crown:scatter': scatter, 'crown:ledger': ledger, 'crown:settle': settle };
