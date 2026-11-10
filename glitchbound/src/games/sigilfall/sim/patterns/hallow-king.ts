import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, moveCircle, TILE } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';
import { exposed, fighting, onFloor, removeThing, ringSpots, roomBox, spawnThing, standing, wound } from './arena';
import type { PatternFn, PatternKit } from './kit';

/**
 * The Hallow King's last fight, in the throne room at the top of Duskspire: the end of the story. Ids start with
 * 'king:'. Vaelor is the last holder of the last sigil: Vosk brought him the Sigil of Stone from Hearthstead, and he
 * wears it set in the Ash Crown, the first star of the Crown of Ash and Starlight. The hero comes with Elyra and the
 * other six; the Crown wants them.
 *
 * - The court (`court`, `rise`): his dead kneel in two ranks below the throne, and rise when he bids them. A kneeling
 *   courtier is struck down easily; a risen one fights.
 * - The Crown's call (`call`): it tears sigils out of Elyra at the door, and they drift up the hall to him. Strike one
 *   and it flies home to her; one that reaches him is set in the Crown, and he has its power. Hurt him enough and the
 *   newest he took breaks loose again.
 * - The sigils' powers (`sigil`), one of those his Crown holds (Stone always), every one its own trial:
 *   Stone, the hall's floor falling in a checkerboard, one half and then the other; Embers, charges that leave the
 *   floor burning behind him; Sun, a glare from his Crown that burns everything but his own shadow; Thorns, hedges
 *   of briar across the hall with one way through each; Frost, a pen of ice round the hero that freezes inside
 *   (break a block to get out); Veil, the hero and the King trading places, and his blade falling where he stood;
 *   Tides, this fight's dead rising again where they fell.
 * - The remembered (`remembered`): the Crown makes memories into soldiers, and it remembers the hero's own fights:
 *   ash-grey echoes of the foes the hero has already beaten come back to stand for him a while.
 * - One summer's hour (`summer`): his queen and children, as the Crown remembers them, walk up the hall to him; the
 *   Host comes to stop them, and they stop while anything stands near them. Each that reaches him lays a hand on him,
 *   and he lets go a little: open to every blow, wounded, and a sigil loose.
 *
 * What outlives a pattern (the court, the drifting sigils, the Crown's hold, the walkers, the fight's dead) is kept
 * per boss here and run by a small ticker (World.after, once a step) for as long as the fight lasts.
 */

const VIOLET = '#b07aff';
const FROST = '#bfe6ff';
const GOLD = '#ffe2a0';
const ASH = '#c8c4d0';

type SigilId = 'stone' | 'embers' | 'sun' | 'thorns' | 'frost' | 'veil' | 'tides';
/** Each sigil's name and color (as the hero's own sigils are shown: ui/Panels.tsx). */
const SIGIL: Record<SigilId, { name: string; full: string; color: string }> = {
  stone: { name: 'Stone', full: 'Sigil of Stone', color: '#c8b898' },
  embers: { name: 'Embers', full: 'Sigil of Embers', color: '#ff7a3d' },
  sun: { name: 'Sun', full: 'Sigil of the Sun', color: '#ffd84d' },
  thorns: { name: 'Thorns', full: 'Sigil of Thorns', color: '#6ad05a' },
  frost: { name: 'Frost', full: 'Sigil of Frost', color: '#bfe8ff' },
  veil: { name: 'Veil', full: 'Sigil of the Veil', color: '#c58cff' },
  tides: { name: 'Tides', full: 'Sigil of Tides', color: '#4ab8ff' },
};
/** The six Elyra carries in: what the Crown would have (the Stone it has). */
const ELYRAS: SigilId[] = ['embers', 'sun', 'thorns', 'frost', 'veil', 'tides'];
/** The kneeling court, a torn-loose sigil, a block of the rime pen: the fight's own things (data/dungeons/duskspire.ts). */
const COURTIER = 'court-of-the-dead';
const sigilFoe = (s: SigilId): string => `sigil-of-${s}`;
const RIME = 'rime-block';
/** The foes the hero has beaten, as the Crown remembers them. */
const REMEMBERED = ['echo-of-corvane', 'echo-of-morvain', 'echo-of-the-gatewarden', 'echo-of-the-weeping-lord', 'echo-of-ashkar', 'echo-of-vosk'];
const OWN = new Set<string>([COURTIER, RIME, ...ELYRAS.map(sigilFoe)]);

interface Adrift {
  sigil: SigilId;
  foe: Enemy;
  speed: number;
}
interface Walker {
  k: World['kin'][number];
  /** What the one who reaches him says. */
  line: string;
  speed: number;
  heldT: number;
}
interface Reign {
  last: number;
  /** The sigils the Crown has taken from Elyra (the Stone is always his, and not counted here). */
  crown: SigilId[];
  adrift: Adrift[];
  /** His health when the Crown last changed: losing `loose` of his whole health more knocks the newest sigil free. */
  mark: number;
  loose: number;
  court: Enemy[];
  /** The fight's dead, once each, and where they fell (for the tide). */
  counted: Set<number>;
  graves: { x: number; y: number }[];
  walkers: Walker[];
  /** His blow before the Crown took anything: each sigil it holds makes him hit harder. */
  baseDmg: number;
  /** The Crown's own casting, apart from his (from his second phase): what it is casting, and when it next does. */
  own: { id: SigilId; pt: PatternKit['pt']; done: boolean } | null;
  ownAt: number;
  /** The Host sent after the walkers (by id), and where each stood last: they go for the memory, not the hero. */
  hunters: Map<number, { x: number; y: number }>;
  fxT: number;
}

const REIGNS = new WeakMap<Enemy, Reign>();

function reignOf(w: World, e: Enemy): Reign {
  let s = REIGNS.get(e);
  if (!s) {
    s = { last: w.time, crown: [], adrift: [], mark: e.hp, loose: 0.06, court: [], counted: new Set(), graves: [], walkers: [], hunters: new Map(), fxT: 0, baseDmg: e.dmg, own: null, ownAt: w.time + 12 };
    REIGNS.set(e, s);
    w.crown = ['stone'];
    w.after(0, () => reignTick(w, e));
  }
  return s;
}

/** Where Elyra stands, at the throne room's door (the middle of its south edge). */
function door(w: World, e: Enemy): { x: number; y: number } {
  const box = roomBox(w, e);
  for (let y = box.y1 - 14; y > box.cy; y -= 6) if (onFloor(w, e, box.cx, y, 8)) return { x: box.cx, y };
  return { x: box.cx, y: box.cy };
}

/** The Crown as the bar shows it; and what it holds makes his blows heavier (a tenth more for each sigil taken). */
function showCrown(w: World, s: Reign, e: Enemy): void {
  w.crown = ['stone', ...s.crown];
  e.dmg = s.baseDmg * (1 + DMG_PER_SIGIL * s.crown.length);
}
/** How much harder he hits for each sigil the Crown has taken. */
const DMG_PER_SIGIL = 0.1;
/** The powers the Crown casts by itself, over his own fighting (none of them moves him). */
const CROWN_OWN: SigilId[] = ['stone', 'thorns', 'frost', 'tides'];

/**
 * The Crown casting on its own, from his second phase: one of the powers it holds that leave him where he is, every
 * so often, and the more sigils it holds the more often. Run once a step from the ticker, with a kit of its own.
 */
function crownCasts(w: World, e: Enemy, s: Reign, dt: number): void {
  if (s.own) {
    const own = s.own;
    own.pt.t += dt;
    const kit: PatternKit = {
      use: { id: 'king:sigil', w: 1, cd: 0 },
      pt: own.pt,
      aimAt: () => Math.atan2(w.player.y - e.y, w.player.x - e.x),
      num: (_key, d) => d,
      str: (_key, d) => d,
      end: () => {
        own.done = true;
      },
    };
    POWERS[own.id](w, e, kit);
    if (own.done || own.pt.t > 12) s.own = null;
    return;
  }
  if ((e.boss?.phase ?? 0) < 1 || w.time < s.ownAt || w.player.dead) return;
  const held = CROWN_OWN.filter((id) => id === 'stone' || s.crown.includes(id));
  const id = held[Math.floor(w.rand() * held.length)]!;
  s.own = { id, pt: { t: 0, step: 0, data: {} }, done: false };
  s.ownAt = w.time + Math.max(6, 13 - 1.6 * s.crown.length);
  w.addFx({ kind: 'ring', x: e.x, y: e.y - 30, life: 0.6, size: 36, color: SIGIL[id].color });
  w.text(e.x, e.y - e.r - 34, 'The Crown moves on its own', SIGIL[id].color, false);
}

/** The newest sigil in the Crown breaks loose and flies home to Elyra. */
function loosen(w: World, e: Enemy, s: Reign, why: string): void {
  const sig = s.crown.pop();
  if (!sig) return;
  s.mark = e.hp;
  showCrown(w, s, e);
  const to = door(w, e);
  const c = SIGIL[sig].color;
  w.addFx({ kind: 'beam', x: e.x, y: e.y - 22, x2: to.x, y2: to.y - 10, life: 0.5, size: 2, color: c });
  w.fxBurst(e.x, e.y - 22, c, 18, 16);
  w.fxBurst(to.x, to.y - 10, c, 10, 10);
  w.text(e.x, e.y - e.r - 24, `${why}: the ${SIGIL[sig].full} breaks free`, c, true);
  w.sfx('shieldBreak', 0.7);
}

function reignTick(w: World, e: Enemy): void {
  const s = REIGNS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    // won, or the room reset after a defeat: what is adrift goes home, the court and the memory go with him
    for (const a of s.adrift) removeThing(w, a.foe);
    for (const c of s.court) removeThing(w, c);
    const mine = new Set(s.walkers.map((x) => x.k));
    w.kin = w.kin.filter((k) => !mine.has(k));
    w.crown = null;
    e.dmg = s.baseDmg;
    REIGNS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const p = w.player;
  // the sigils adrift: struck, one flies home; reaching him, it is set in the Crown
  s.adrift = s.adrift.filter((a) => {
    const f = a.foe;
    const c = SIGIL[a.sigil].color;
    if (f.dead || f.hp < f.maxHp || !w.enemies.includes(f)) {
      removeThing(w, f);
      const to = door(w, e);
      w.addFx({ kind: 'beam', x: f.x, y: f.y - 16, x2: to.x, y2: to.y - 10, life: 0.4, size: 1.6, color: c });
      w.text(f.x, f.y - 26, `The ${SIGIL[a.sigil].full}: home to Elyra`, c, false);
      w.sfx('heal', 0.45);
      return false;
    }
    const d = dist(f.x, f.y, e.x, e.y);
    if (d < e.r + f.r + 4) {
      removeThing(w, f);
      s.crown.push(a.sigil);
      s.mark = e.hp;
      showCrown(w, s, e);
      w.text(e.x, e.y - e.r - 24, `THE CROWN TAKES THE ${SIGIL[a.sigil].name.toUpperCase()}`, c, true);
      w.fxBurst(e.x, e.y - 22, c, 24, 20);
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.7, size: 60, color: c });
      w.shake(4);
      w.sfx('summon', 0.7);
      return false;
    }
    // (they float: over the court and the hero alike, straight to him)
    f.x += ((e.x - f.x) / d) * a.speed * dt;
    f.y += ((e.y - f.y) / d) * a.speed * dt;
    f.vx = 0;
    f.vy = 0;
    if (Math.floor(w.time * 6) !== Math.floor((w.time - dt) * 6)) w.addFx({ kind: 'spark', x: f.x + (w.rand() - 0.5) * 8, y: f.y - 18, vx: 0, vy: -16, life: 0.5, size: 2, color: c });
    return true;
  });
  // hurt him enough and the newest sigil he took breaks loose
  if (!s.crown.length) s.mark = e.hp;
  else if (e.hp <= s.mark - e.maxHp * s.loose) loosen(w, e, s, 'The Crown shudders');
  // the Crown casts on its own, over his fighting
  crownCasts(w, e, s, dt);
  // this fight's dead, and where they fell (the Tides' power raises them)
  for (const x of w.enemies) {
    if (!x.dead || x === e || x.boss || x.def.prop || x.room !== e.room || s.counted.has(x.id) || OWN.has(x.def.id)) continue;
    s.counted.add(x.id);
    s.graves.push({ x: x.x, y: x.y });
    if (s.graves.length > 10) s.graves.shift();
  }
  s.court = s.court.filter((c) => standing(w, c));
  // the Host sent after the summer's walkers goes for them, not the hero, until the hero comes to stop it
  for (const [id, last] of s.hunters) {
    const h = w.enemies.find((x) => x.id === id);
    if (!h || h.dead) {
      s.hunters.delete(id);
      continue;
    }
    const target = s.walkers.map((x) => x.k).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
    if (!target || dist(h.x, h.y, p.x, p.y) < 60 || h.state === 'spawn') {
      s.hunters.set(id, { x: h.x, y: h.y });
      continue;
    }
    // (where its own wits took it this step is undone: it has one errand)
    h.x = last.x;
    h.y = last.y;
    const d = dist(h.x, h.y, target.x, target.y);
    if (d > 22) {
      const res = moveCircle(w.map, h.x, h.y, h.r, ((target.x - h.x) / d) * h.def.speed * 0.9 * dt, ((target.y - h.y) / d) * h.def.speed * 0.9 * dt);
      h.x = res.x;
      h.y = res.y;
    }
    h.vx = 0;
    h.vy = 0;
    h.face = Math.atan2(target.y - h.y, target.x - h.x);
    s.hunters.set(id, { x: h.x, y: h.y });
  }
  // the summer's walkers: on up the hall to him, held while anything of the Host stands near them
  for (const wk of [...s.walkers]) {
    const k = wk.k;
    const d = dist(k.x, k.y, e.x, e.y);
    if (d < e.r + 14) {
      s.walkers = s.walkers.filter((x) => x !== wk);
      w.kin = w.kin.filter((x) => x !== k);
      w.fxBurst(k.x, k.y - 12, GOLD, 24, 16);
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 70, color: GOLD });
      exposed(w, e, 4.5, wk.line, GOLD);
      wound(w, e, 0.03, GOLD);
      loosen(w, e, s, 'He lets go a little');
      continue;
    }
    const held = w.enemies.some((x) => !x.dead && x !== e && !x.def.prop && x.def.id !== COURTIER && x.room === e.room && dist(x.x, x.y, k.x, k.y) < 36);
    k.face = Math.atan2(e.y - k.y, e.x - k.x);
    if (held) {
      wk.heldT -= dt;
      if (wk.heldT <= 0) {
        wk.heldT = 3;
        w.text(k.x, k.y - 30, 'The Host holds them back', '#e8d8b0', false);
      }
      continue;
    }
    const res = moveCircle(w.map, k.x, k.y, 6, ((e.x - k.x) / d) * wk.speed * dt, ((e.y - k.y) / d) * wk.speed * dt);
    // (a pillar in the way: they walk round it, as people do)
    if (res.bx || res.by) {
      const side = Math.sign(Math.sin(w.time * 0.7 + k.x)) || 1;
      const a = Math.atan2(e.y - k.y, e.x - k.x) + (side * Math.PI) / 2;
      const round = moveCircle(w.map, k.x, k.y, 6, Math.cos(a) * wk.speed * dt, Math.sin(a) * wk.speed * dt);
      k.x = round.x;
      k.y = round.y;
    } else {
      k.x = res.x;
      k.y = res.y;
    }
    s.fxT -= dt;
    if (s.fxT <= 0) {
      s.fxT = 0.25;
      w.addFx({ kind: 'spark', x: k.x + (w.rand() - 0.5) * 12, y: k.y - 10, vx: 0, vy: -12, life: 0.7, size: 2, color: GOLD });
    }
  }
  void p;
  w.after(0, () => reignTick(w, e));
}

/* ------------------------------------------------------------ the court */

/** His court kneels in two ranks below the throne. Knobs: count. */
const court: PatternFn = (w, e, _dt, k) => {
  const s = reignOf(w, e);
  if (k.pt.step === 0) {
    const want = k.num('count', 8) - s.court.length;
    const box = roomBox(w, e);
    let made = 0;
    for (let i = 0; made < want && i < 16; i++) {
      const side = i % 2 ? -1 : 1;
      const row = Math.floor(i / 2);
      const x = e.x + side * k.num('apart', 88);
      const y = e.y + 70 + row * 46;
      if (y > box.y1 - 40 || !onFloor(w, e, x, y, 9) || s.court.some((c) => dist(c.x, c.y, x, y) < 20)) continue;
      const c = spawnThing(w, e, COURTIER, x, y);
      if (!c) continue;
      c.face = side > 0 ? Math.PI : 0;
      s.court.push(c);
      made++;
    }
    if (made) {
      w.callout('Kneel, all of you. We have a guest.', ASH);
      w.sfx('summon', 0.5);
    }
    k.pt.step = 1;
  } else if (k.pt.t >= 0.8) k.end();
};

/** The kneeling courtiers nearest the hero rise to fight (`count`, as `enemy`); none left, the dead climb out of the walls. */
const rise: PatternFn = (w, e, _dt, k) => {
  const s = reignOf(w, e);
  if (k.pt.step === 0) {
    const p = w.player;
    const n = k.num('count', 2);
    const id = k.str('enemy', 'kneeling-dead');
    const near = [...s.court].sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y)).slice(0, n);
    for (const c of near) {
      w.addTelegraph({ shape: 'circle', x: c.x, y: c.y, r: 16, r2: 0, angle: 0, len: 0, dur: 0.7, dmg: e.dmg * 0.6, knock: 50, tone: 'enemy', owner: -1, linger: 0 });
      w.after(0.7, () => {
        if (!fighting(w, e) || !standing(w, c)) return;
        const at = { x: c.x, y: c.y };
        removeThing(w, c);
        w.spawnAdd(id, at.x, at.y, e.room);
      });
    }
    // (a court struck down: the walls give up their dead instead)
    for (let i = near.length; i < n; i++) {
      const a = w.rand() * TAU;
      const at = castRay(w.map, p.x, p.y, 8, a, 90);
      w.spawnAdd(k.str('instead', 'hollow-ghoul'), at.x, at.y, e.room);
    }
    w.callout('Rise.', VIOLET);
    w.sfx('summon', 0.6);
    k.pt.step = 1;
  } else if (k.pt.t >= 1) k.end();
};

/* ------------------------------------------------------------ the Crown's call */

/** The Crown tears `count` sigils out of Elyra at the door; they drift up the hall to him at `speed`. */
const call: PatternFn = (w, e, _dt, k) => {
  const s = reignOf(w, e);
  if (k.pt.step === 0) {
    const free = ELYRAS.filter((x) => !s.crown.includes(x) && !s.adrift.some((a) => a.sigil === x));
    const n = Math.min(k.num('count', 2), free.length);
    if (!n) {
      k.end();
      return;
    }
    const at = door(w, e);
    for (let i = 0; i < n; i++) {
      const sig = free.splice(Math.floor(w.rand() * free.length), 1)[0]!;
      const x = at.x + (i - (n - 1) / 2) * 34;
      const f = spawnThing(w, e, sigilFoe(sig), x, at.y - 12);
      if (!f) continue;
      s.adrift.push({ sigil: sig, foe: f, speed: k.num('speed', 40) });
      w.addFx({ kind: 'beam', x: e.x, y: e.y - 22, x2: f.x, y2: f.y - 16, life: 0.5, size: 1.4, color: SIGIL[sig].color });
    }
    w.callout('Six. She carries six. Bring them to me.', VIOLET);
    w.text(at.x, at.y - 34, 'The Crown is pulling the sigils out of Elyra: strike them back to her', '#fff0d0', false);
    w.shake(3);
    w.sfx('summon', 0.7);
    k.pt.step = 1;
  } else if (k.pt.t >= 1.2) k.end();
};

/* ------------------------------------------------------------ the sigils' powers */

type Power = (w: World, e: Enemy, k: PatternKit) => void;

/** Stone: the hall's floor falls in a checkerboard of squares, one half and then the other. */
const stone: Power = (w, e, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const box = roomBox(w, e);
    const S = k.num('square', 3) * TILE;
    const mul = k.num('mul', 1.35);
    const strike = (half: number, dur: number): void => {
      let iy = 0;
      for (let y = box.y0; y < box.y1; y += S, iy++) {
        let ix = 0;
        for (let x = box.x0; x < box.x1; x += S, ix++) {
          if ((ix + iy) % 2 !== half || !onFloor(w, e, x + S / 2, y + S / 2, 6)) continue;
          w.addTelegraph({ shape: 'line', x, y: y + S / 2, angle: 0, len: S, r: 0, r2: S - 4, dur, dmg: e.dmg * mul, knock: 30, tone: 'enemy', owner: -1, linger: 0 });
        }
      }
      w.after(dur, () => {
        if (!fighting(w, e)) return;
        w.shake(4);
        w.sfx('slam', 0.6);
      });
    };
    const first = w.rand() < 0.5 ? 0 : 1;
    strike(first, k.num('wind', 1.2));
    w.after(k.num('wind', 1.2), () => {
      if (fighting(w, e)) strike(1 - first, k.num('then', 1.1));
    });
    w.callout('THE WEIGHT OF STONE', SIGIL.stone.color);
    w.sfx('enemyWindup', 0.6);
    pt.data.end = k.num('wind', 1.2) + k.num('then', 1.1) + 0.3;
    pt.step = 1;
  } else if (pt.t >= pt.data.end!) k.end();
};

/** Embers: `count` charges at the hero, each leaving the floor it crossed burning a while. */
const embers: Power = (w, e, k) => {
  const { pt } = k;
  const p = w.player;
  const n = k.num('count', 3);
  if (pt.step === 0) {
    pt.data.n = 0;
    pt.step = 1;
    w.callout('THE EMBERS WAKE', SIGIL.embers.color);
  }
  if (pt.step === 1) {
    // aim: a line at the hero
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const to = castRay(w.map, e.x, e.y, e.r, a, Math.min(dist(e.x, e.y, p.x, p.y) + 50, k.num('len', 260)));
    const len = dist(e.x, e.y, to.x, to.y);
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, angle: a, len, r: 0, r2: 28, dur: k.num('wind', 0.6), dmg: e.dmg * k.num('mul', 1.1), knock: 90, tone: 'enemy', owner: -1, linger: 0 });
    pt.data.a = a;
    pt.data.len = len;
    pt.data.t0 = pt.t;
    pt.data.went = 0;
    pt.data.drop = 0;
    e.aimA = a;
    w.sfx('enemyWindup', 0.5);
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t0! + k.num('wind', 0.6)) {
    // the charge: he goes the length of it, the floor burning behind him
    const speed = k.num('speed', 420);
    const step = Math.min(pt.data.len! - pt.data.went!, speed * (1 / 60));
    const a = pt.data.a!;
    const res = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
    e.x = res.x;
    e.y = res.y;
    e.vx = 0;
    e.vy = 0;
    pt.data.went! += step;
    pt.data.drop! += step;
    if (pt.data.drop! >= 22) {
      pt.data.drop = 0;
      w.spawnField({ x: e.x, y: e.y, r: 13, dur: k.num('burn', 6), tick: 0.5, dmg: e.dmg * k.num('fire', 0.25), type: 'fire', status: { status: 'burn', dur: 1.5, power: 0.3 }, look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
    }
    if (step <= 0.5 || res.bx || res.by || pt.data.went! >= pt.data.len!) {
      w.fxBurst(e.x, e.y, SIGIL.embers.color, 14, 16);
      w.shake(3);
      pt.data.n! += 1;
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) {
    if (pt.data.n! >= n) k.end();
    else pt.step = 1;
  }
};

/** Sun: a glare from the Crown fills the hall; only the King's own shadow, behind him from the throne, is out of it. */
const sun: Power = (w, e, k) => {
  const { pt } = k;
  const p = w.player;
  const W = k.num('shadow', 44);
  const wind = k.num('wind', 2.4);
  if (pt.step === 0) {
    const box = roomBox(w, e);
    const tall = box.y1 - box.y0;
    // (the light comes down from the great window over the throne: his shadow runs south down the hall)
    const left = e.x - W / 2 - box.x0;
    const right = box.x1 - (e.x + W / 2);
    const glare = { r: 0, dmg: 0, knock: 0, tone: 'enemy' as const, owner: -1, linger: 0, dur: wind };
    if (left > 4) w.addTelegraph({ ...glare, shape: 'line', x: box.x0 + left / 2, y: box.y0, angle: Math.PI / 2, len: tall, r2: left });
    if (right > 4) w.addTelegraph({ ...glare, shape: 'line', x: box.x1 - right / 2, y: box.y0, angle: Math.PI / 2, len: tall, r2: right });
    if (e.y - box.y0 > 4) w.addTelegraph({ ...glare, shape: 'line', x: e.x, y: box.y0, angle: Math.PI / 2, len: e.y - box.y0 - e.r, r2: W });
    // his shadow, down the hall from him: the one place the glare doesn't reach, drawn as the safe place it is
    if (box.y1 - e.y > e.r) w.addTelegraph({ ...glare, kind: 'safe', shape: 'line', x: e.x, y: e.y + e.r * 0.5, angle: Math.PI / 2, len: box.y1 - e.y - e.r * 0.5, r2: W });
    w.callout('THE SUN SIGIL BLAZES', SIGIL.sun.color, 'Stand in his shadow');
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 30, life: wind, size: 40, color: SIGIL.sun.color });
    w.sfx('enemyWindup', 0.7);
    pt.data.x = e.x;
    pt.data.y = e.y;
    pt.step = 1;
  } else if (pt.step === 1) {
    // he holds still while it builds: his shadow must not move under the hero's feet
    e.x = pt.data.x!;
    e.y = pt.data.y!;
    e.vx = 0;
    e.vy = 0;
    if (pt.t >= wind) {
      const shaded = Math.abs(p.x - e.x) <= W / 2 + p.r * 0.5 && p.y >= e.y + e.r * 0.5;
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.6, size: 200, color: SIGIL.sun.color });
      w.fxBurst(e.x, e.y - 30, SIGIL.sun.color, 30, 60);
      w.shake(6);
      w.sfx('slam', 0.8);
      if (!shaded && !p.dead) hurtPlayer(w, e.dmg * k.num('mul', 1.9), { status: { status: 'burn', dur: 2, power: 0.4 }, source: e });
      else if (!p.dead) w.text(p.x, p.y - 26, 'IN HIS SHADOW', '#d8d0c0', false);
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= wind + 0.5) k.end();
};

/** Thorns: hedges of briar rise across the hall, `rows` of them, each with one way through, and stand a while. */
const thorns: Power = (w, e, k) => {
  const { pt } = k;
  const wind = k.num('wind', 1);
  if (pt.step === 0) {
    const box = roomBox(w, e);
    const rows = k.num('rows', 3);
    const gap = k.num('gap', 70);
    for (let i = 0; i < rows; i++) {
      const y = box.y0 + ((box.y1 - box.y0) * (i + 1)) / (rows + 1);
      const gx = box.x0 + gap + w.rand() * (box.x1 - box.x0 - gap * 2);
      for (const [x0, x1] of [
        [box.x0, gx - gap / 2],
        [gx + gap / 2, box.x1],
      ] as const) {
        if (x1 - x0 < 10) continue;
        w.addTelegraph({ shape: 'line', x: x0, y, angle: 0, len: x1 - x0, r: 0, r2: 24, dur: wind, dmg: e.dmg * k.num('mul', 0.9), status: { status: 'root', dur: 0.8, power: 1 }, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        w.after(wind, () => {
          if (!fighting(w, e)) return;
          for (let x = x0 + 10; x < x1; x += 20) {
            if (!onFloor(w, e, x, y, 4)) continue;
            w.spawnField({ x, y, r: 11, dur: k.num('stand', 7), tick: 0.5, dmg: e.dmg * k.num('prick', 0.22), type: 'nature', status: { status: 'root', dur: 0.5, power: 1 }, look: 'nature', hostile: true, depth: 0, spec: null, onHit: false });
          }
        });
      }
    }
    w.callout('THE BRIARS RISE', SIGIL.thorns.color);
    w.sfx('enemyWindup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind + 0.4) k.end();
};

/** Frost: a pen of ice round the hero, `blocks` of it, freezing inside after `wind`; break a block to get out. */
const frost: Power = (w, e, k) => {
  const { pt } = k;
  const p = w.player;
  const wind = k.num('wind', 2.8);
  if (pt.step === 0) {
    const n = k.num('blocks', 8);
    const r = k.num('r', 40);
    const made: Enemy[] = [];
    const turn = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const a = turn + (TAU * i) / n;
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      if (!onFloor(w, e, x, y, 6)) continue;
      const b = w.addEnemy(RIME, x, y, e.level, { room: e.room, pack: -1, post: true });
      b.aggro = true;
      made.push(b);
    }
    w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: r - 4, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 2), status: { status: 'freeze', dur: 1.2, power: 1 }, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    w.after(wind + k.num('melt', 3), () => {
      for (const b of made) if (standing(w, b)) removeThing(w, b);
    });
    w.callout('THE RIME CLOSES', FROST, 'Break the ice and get out');
    w.sfx('freeze', 0.7);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind + 0.4) k.end();
};

/** Veil: the hero and the King trade places through the Veil, and his blade falls where he stood. */
const veil: Power = (w, e, k) => {
  const { pt } = k;
  const p = w.player;
  const wind = k.num('wind', 1.2);
  const fall = k.num('fall', 0.8);
  if (pt.step === 0) {
    w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: e.r + 6, r2: 0, angle: 0, len: 0, dur: wind, dmg: 0, knock: 0, tone: 'rift', owner: e.id, linger: 0 });
    w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: p.r + 6, r2: 0, angle: 0, len: 0, dur: wind, dmg: 0, knock: 0, tone: 'rift', owner: -1, linger: 0 });
    w.callout('THE VEIL TURNS', SIGIL.veil.color);
    w.sfx('enemyWindup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    if (!p.dead) {
      const hx = p.x;
      const hy = p.y;
      w.fxBurst(e.x, e.y - 10, SIGIL.veil.color, 16, 14);
      w.fxBurst(hx, hy - 10, SIGIL.veil.color, 16, 14);
      w.addFx({ kind: 'beam', x: e.x, y: e.y - 14, x2: hx, y2: hy - 14, life: 0.3, size: 2, color: SIGIL.veil.color });
      p.x = e.x;
      p.y = e.y + e.r + p.r + 2;
      const back = moveCircle(w.map, p.x, p.y, p.r, 0, 0);
      p.x = back.x;
      p.y = back.y;
      e.x = hx;
      e.y = hy;
      e.vx = 0;
      e.vy = 0;
      // where he stood a moment ago (where the hero is now), his blade comes down
      w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: k.num('r', 44), r2: 0, angle: 0, len: 0, dur: fall, dmg: e.dmg * k.num('mul', 1.6), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
      w.sfx('blink', 0.7);
    }
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= wind + fall + 0.3) k.end();
};

/** Tides: what fell in this fight rises again where it fell (`count` of them, as `enemy`), and a wave rolls out. */
const tides: Power = (w, e, k) => {
  const s = reignOf(w, e);
  const { pt } = k;
  if (pt.step === 0) {
    const n = k.num('count', 5);
    const at = s.graves.splice(Math.max(0, s.graves.length - n));
    const id = k.str('enemy', 'hollow-ghoul');
    for (const g of [...at, ...ringSpots(w, e, Math.max(0, n - at.length), 130, w.rand() * TAU)]) {
      w.addTelegraph({ shape: 'circle', x: g.x, y: g.y, r: 14, r2: 0, angle: 0, len: 0, dur: 0.8, dmg: e.dmg * 0.5, knock: 40, tone: 'enemy', owner: -1, linger: 0 });
      w.after(0.8, () => {
        if (fighting(w, e)) w.spawnAdd(id, g.x, g.y, e.room);
      });
    }
    w.spawnWave(e.x, e.y, k.num('wave', 95), 300, 10, e.dmg * 0.7);
    w.callout('THE TIDE BRINGS THEM BACK', SIGIL.tides.color);
    w.sfx('summon', 0.7);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= 1.2) k.end();
};

const POWERS: Record<SigilId, Power> = { stone, embers, sun, thorns, frost, veil, tides };
const ORDER = Object.keys(POWERS) as SigilId[];

/**
 * One of the powers the Crown holds (the Stone's, or one it took from Elyra), the newest likeliest; each power's own
 * knobs are given under its name (`p.sun = { wind: 2 }`... as `sun.wind`).
 */
const sigil: PatternFn = (w, e, dt, k) => {
  const s = reignOf(w, e);
  if (k.pt.step === 0 && k.pt.data.pw === undefined) {
    const held: SigilId[] = ['stone', ...s.crown];
    // (the newest weighs twice: what he has just taken, he wants to use)
    const pool = [...held, ...(s.crown.length ? [s.crown[s.crown.length - 1]!] : [])];
    const pick = k.str('force', '') as SigilId | '';
    const id = pick && POWERS[pick] ? pick : pool[Math.floor(w.rand() * pool.length)]!;
    k.pt.data.pw = ORDER.indexOf(id);
  }
  const id = ORDER[k.pt.data.pw!]!;
  const sub: PatternKit = {
    ...k,
    num: (key, d) => k.num(`${id}.${key}`, k.num(key, d)),
    str: (key, d) => k.str(`${id}.${key}`, k.str(key, d)),
  };
  POWERS[id](w, e, sub);
  void dt;
};

/* ------------------------------------------------------------ the remembered */

/** The Crown makes the hero's own beaten foes into soldiers again: `count` of them, crumbling after `life` s. */
const remembered: PatternFn = (w, e, _dt, k) => {
  if (k.pt.step === 0) {
    const up = new Set(w.enemies.filter((x) => !x.dead && x.room === e.room).map((x) => x.def.id));
    const pool = REMEMBERED.filter((id) => !up.has(id));
    const n = Math.min(k.num('count', 2), pool.length);
    const spots = ringSpots(w, e, n, k.num('r', 120), w.rand() * TAU);
    const names: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = pool.splice(Math.floor(w.rand() * pool.length), 1)[0]!;
      const at = spots[i]!;
      w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r: 20, r2: 0, angle: 0, len: 0, dur: 0.9, dmg: e.dmg * 0.6, knock: 60, tone: 'enemy', owner: -1, linger: 0 });
      w.addFx({ kind: 'beam', x: e.x, y: e.y - 22, x2: at.x, y2: at.y - 10, life: 0.6, size: 1.5, color: ASH });
      w.after(0.9, () => {
        if (!fighting(w, e)) return;
        const m = spawnThing(w, e, id, at.x, at.y);
        if (!m) return;
        w.fxBurst(at.x, at.y - 10, ASH, 18, 16);
        w.after(k.num('life', 24), () => {
          if (standing(w, m)) {
            w.text(m.x, m.y - 26, 'The memory fades', ASH, false);
            removeThing(w, m);
          }
        });
      });
      names.push(id);
    }
    w.callout('You remember them? So do I. I remember everything.', ASH);
    w.sfx('summon', 0.7);
    k.pt.step = 1;
  } else if (k.pt.t >= 1.3) k.end();
};

/* ------------------------------------------------------------ one summer's hour */

/** His queen and children walk up the hall to him (at `speed`), and the Host comes to stop them (`hunters` of `enemy`). */
const summer: PatternFn = (w, e, _dt, k) => {
  const s = reignOf(w, e);
  if (k.pt.step === 0) {
    if (s.walkers.length) {
      k.end();
      return;
    }
    const at = door(w, e);
    const speed = k.num('speed', 17);
    const who: [string, number, string][] = [
      ['echo-of-ysane-whole', 0, 'Ysane: “Let us go now, love. Please.”'],
      ['echo-of-the-children', 34, 'The children: “Papa, come home. Come home.”'],
    ];
    for (const [look, dx, line] of who) {
      const kk = { look, x: at.x + dx - 17, y: at.y - 4, face: -Math.PI / 2, since: w.time };
      w.kin.push(kk);
      s.walkers.push({ k: kk, line, speed, heldT: 0 });
    }
    // the Host comes out of the walls for them
    for (let i = 0; i < k.num('hunters', 3); i++) {
      const a = -Math.PI / 2 + (w.rand() - 0.5) * 2.4;
      const to = castRay(w.map, at.x, at.y, 8, a, 90 + w.rand() * 60);
      const h = spawnThing(w, e, k.str('enemy', 'hollow-ghoul'), to.x, to.y);
      if (h) s.hunters.set(h.id, { x: h.x, y: h.y });
    }
    w.emit({ t: 'banner', text: 'One Summer’s Hour', sub: 'His queen and children are coming to him: clear their way' });
    w.callout('Ysane? …No. Not now. Not like this.', GOLD);
    for (let i = 0; i < 14; i++) w.addFx({ kind: 'spark', x: at.x + (w.rand() - 0.5) * 120, y: at.y - w.rand() * 80, vx: 0, vy: -10, life: 1.4, size: 2.5, color: GOLD });
    w.sfx('bell', 0.6);
    k.pt.step = 1;
  } else if (k.pt.t >= 1.4) k.end();
};

/** What the Hallow King's Crown holds (for tests: the Stone and whatever it has taken). */
export const crownOf = (e: Enemy): string[] => ['stone', ...(REIGNS.get(e)?.crown ?? [])];
/** The sigils adrift in his fight, and his kneeling court (for tests). */
export const adriftOf = (e: Enemy): Enemy[] => (REIGNS.get(e)?.adrift ?? []).map((a) => a.foe);
export const courtOf = (e: Enemy): Enemy[] => REIGNS.get(e)?.court ?? [];
export const walkersOf = (e: Enemy): World['kin'] => (REIGNS.get(e)?.walkers ?? []).map((x) => x.k);

export const HALLOW_KING_PATTERNS: Record<string, PatternFn> = {
  'king:court': court,
  'king:rise': rise,
  'king:call': call,
  'king:sigil': sigil,
  'king:remembered': remembered,
  'king:summer': summer,
};
