import { angleDiff, dist, TAU } from '../../core/math';
import { hitEnemy, hurtPlayer } from '../combat';
import { castRay, moveCircle } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';
import { exposed, fighting, ringSpots, roomBox, wound } from './arena';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Smugglers' Grotto: ids start with 'grotto:'. Three below the cove, each harder than the last.
 *
 * The Drowned Priestess floods her shrine (`flood`): the sea comes in over the floor and the hero is under it, their
 * breath running out, while she goes on casting. Air rises in bubbles from a few vents in the floor: stand in one
 * to breathe. Out of breath, the hero drowns a little every moment until they find air or the water drains.
 *
 * Mother Clatterclaw (new, the Powder Store), the shore crabs' matriarch, wears a shell nothing gets through from
 * the front (`shell`): blows that land on her face mostly glance off. She turns slowly, so get round her: from
 * behind or beside, every blow lands. Her pincers snap where she faces (`pincers`), she scuttles sideways as crabs do
 * (`scuttle`) and spits froth (`froth`). At half health she molts (`molt`): no shell, but soft, quick and furious.
 *
 * Captain Saltbeard gives the hero the Black Spot (`black-spot`): a curse that bursts when its time is up. It passes
 * with a blow: strike one of his crew and it's theirs (it takes them), strike the captain himself and it staggers
 * him; let it burst on you and it hurts badly.
 *
 * What lasts beyond a pattern (the flood and the breath, the shell and its turning, the Spot) is kept per boss here
 * and run by a small ticker (World.after, once a step) for as long as the fight lasts.
 */

const SEA = '#7ad8ff';
const FOAM = '#d8f6ff';
const SHELL = '#ffd27a';
const SPOT = '#2a1a2a';
/** The Black Spot as it shows on whoever carries it (pale on the dark floor of the caves). */
const CURSE = '#e0d0f0';
const BONE = '#e8e0cc';

interface Grotto {
  last: number;
  /** The Priestess's flood: when it drains, the hero's breath (1 full, 0 drowning) and the air vents. */
  flood: { until: number; air: number; breath: number; vents: { x: number; y: number }[]; drown: number; fxT: number; sayT: number } | null;
  /** Clatterclaw: her shell (what share of a blow to her face it turns), how fast she turns, where she faces. */
  shell: number;
  turn: number;
  heading: number;
  lock: boolean;
  lastHp: number;
  clangT: number;
  /** The Black Spot: who carries it (the hero, or an enemy it is taking), when it bursts. */
  spot: { on: Enemy | null; at: number; grace: number; tick: number; fxT: number; mul: number } | null;
  flashes: Map<Enemy, number>;
}

const FIGHTS = new WeakMap<Enemy, Grotto>();

function fight(w: World, e: Enemy): Grotto {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, flood: null, shell: 0, turn: 0, heading: e.face, lock: false, lastHp: e.hp, clangT: 0, spot: null, flashes: new Map() };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    w.flooded = 0;
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickFlood(w, e, s, dt);
  tickShell(w, e, s, dt);
  tickSpot(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------ the Drowned Priestess */

/** The flood: for `time` s the shrine is under the sea; `air` s of breath; `vents` vents of air; drowning `drown` of health a second. */
const flood: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    const box = roomBox(w, e);
    const n = Math.round(k.num('vents', 3));
    s.flood = {
      until: w.time + k.num('time', 9),
      air: 1,
      breath: k.num('air', 6),
      vents: ringSpots(w, e, n, Math.min(140, (box.x1 - box.x0) * 0.36), w.rand() * TAU),
      drown: k.num('drown', 0.1),
      fxT: 0,
      sayT: 0,
    };
    w.callout('Come down to the deep with me!', SEA);
    w.text(w.player.x, w.player.y - 30, 'Find the air!', FOAM, false);
    w.sfx('rift', 0.6);
    w.shake(3);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + 0.8) k.end();
};

function tickFlood(w: World, e: Enemy, s: Grotto, dt: number): void {
  const f = s.flood;
  const p = w.player;
  if (!f) {
    w.flooded = Math.max(0, w.flooded - dt * 1.5);
    return;
  }
  w.flooded = Math.min(1, w.flooded + dt * 1.5);
  const atVent = f.vents.some((v) => dist(v.x, v.y, p.x, p.y) < 24);
  f.air = Math.max(0, Math.min(1, f.air + (atVent ? dt * 0.6 : -dt / f.breath)));
  // the vents' bubbles, and the sea moving over the floor
  f.fxT -= dt;
  if (f.fxT <= 0) {
    f.fxT = 0.18;
    for (const v of f.vents) {
      w.addFx({ kind: 'spark', x: v.x + (((w.time * 53) % 1) - 0.5) * 14, y: v.y, vx: 0, vy: -30, life: 0.8, size: 2, color: FOAM });
      w.addFx({ kind: 'glow', x: v.x, y: v.y, life: 0.25, size: 14, color: SEA });
    }
    w.addFx({ kind: 'ring', x: p.x + (((w.time * 31) % 1) - 0.5) * 120, y: p.y + (((w.time * 17) % 1) - 0.5) * 90, life: 0.8, size: 18, color: SEA });
  }
  // the hero's breath, said when it runs low
  f.sayT -= dt;
  if (!p.dead && f.sayT <= 0 && f.air < 0.6) {
    f.sayT = f.air > 0 ? 1 : 0.5;
    if (f.air > 0) w.text(p.x, p.y - 30, `Air ${Math.round(f.air * 100)}%`, FOAM, false);
    else if (hurtPlayer(w, p.maxHp * f.drown * 0.5, { pierce: true })) w.text(p.x, p.y - 30, 'Drowning!', '#ff8a8a', false);
  }
  if (w.time >= f.until) {
    s.flood = null;
    w.text(e.x, e.y - e.r - 16, 'The sea goes back out...', SEA, false);
  }
}

/* ------------------------------------------------------------ Mother Clatterclaw */

/** The shell: `cut` of a blow to her face glances off; she turns toward the hero at `turn` radians a second. */
const shell: PatternFn = (w, e, _dt, k) => {
  const s = fight(w, e);
  s.shell = k.num('cut', 0.7);
  s.turn = k.num('turn', 1.4);
  s.heading = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  s.lastHp = e.hp;
  k.end();
};

/** The molt: the shell comes off (no cut); she turns `turn` fast and is quicker for it. */
const molt: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    s.shell = 0;
    s.turn = k.num('turn', 3.2);
    w.callout('She sheds her shell!', SHELL);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      w.addFx({ kind: 'spark', x: e.x, y: e.y - 6, vx: Math.cos(a) * 80, vy: Math.sin(a) * 50 - 30, life: 0.6, size: 3, color: SHELL });
    }
    w.sfx('crumble', 0.8);
    w.shake(5);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + 0.8) k.end();
};

function tickShell(w: World, e: Enemy, s: Grotto, dt: number): void {
  if (!s.turn) {
    s.lastHp = e.hp;
    return;
  }
  const p = w.player;
  // (a snap or a scuttle cut short by a phase change leaves her free to turn)
  if (!e.boss!.pattern) s.lock = false;
  // she turns toward the hero, slowly (not while she snaps or scuttles, or reels)
  if (!s.lock && e.boss!.dazed <= 0 && !p.dead) {
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    const d = angleDiff(s.heading, want);
    const step = s.turn * dt;
    s.heading += Math.abs(d) <= step ? d : Math.sign(d) * step;
  }
  e.face = s.heading;
  // a blow to her face glances off the shell
  s.clangT -= dt;
  const lost = s.lastHp - e.hp;
  if (s.shell > 0 && lost > 0 && e.boss!.dying <= 0 && e.hp > 0) {
    const front = Math.abs(angleDiff(s.heading, Math.atan2(p.y - e.y, p.x - e.x))) < 1.15;
    if (front) {
      e.hp = Math.min(e.maxHp, e.hp + lost * s.shell);
      if (s.clangT <= 0) {
        s.clangT = 0.5;
        w.text(e.x, e.y - e.r - 12, 'CLANG! Get behind her!', SHELL, false);
        w.addFx({ kind: 'spark', x: e.x + Math.cos(s.heading) * e.r, y: e.y - 6, vx: 0, vy: -40, life: 0.3, size: 2, color: SHELL });
      }
    }
  }
  s.lastHp = e.hp;
}

/** Pincers: `snaps` snaps in a cone (`r`, half-angle `arc`) where she faces, each shown for `wind` s. */
const pincers: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  const wind = k.num('wind', 0.6);
  const snaps = Math.round(k.num('snaps', 2));
  if (pt.step === 0) {
    s.lock = true;
    pt.data.n = 0;
    pt.data.next = pt.t;
    pt.step = 1;
  }
  if (pt.step === 1 && pt.t >= pt.data.next!) {
    if (pt.data.n! >= snaps) {
      s.lock = false;
      k.end();
      return;
    }
    const side = pt.data.n! % 2 ? 0.3 : -0.3;
    w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: k.num('r', 50), r2: k.num('arc', 0.7), angle: s.heading + side, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.3), knock: 120, tone: 'enemy', owner: e.id, linger: 0 });
    w.sfx('windup', 0.5);
    pt.data.n! += 1;
    pt.data.next = pt.t + wind + 0.12;
  }
};

/** Scuttle: a dash sideways (to the side the hero is on), `len` long, shown for `wind` s, hurting on contact. */
const scuttle: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const s = fight(w, e);
  if (pt.step === 0) {
    s.lock = true;
    const toHero = Math.atan2(p.y - e.y, p.x - e.x);
    const a = s.heading + (angleDiff(s.heading, toHero) >= 0 ? Math.PI / 2 : -Math.PI / 2);
    const end = castRay(w.map, e.x, e.y, e.r, a, k.num('len', 150));
    pt.data.a = a;
    pt.data.left = Math.max(20, dist(e.x, e.y, end.x, end.y));
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: (e.r + p.r) * 2, angle: a, len: pt.data.left, dur: k.num('wind', 0.7), dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    w.sfx('windup', 0.6);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + k.num('wind', 0.7)) {
    pt.step = 2;
    pt.data.hit = 0;
  } else if (pt.step === 2) {
    const a = pt.data.a!;
    const step = k.num('speed', 280) * dt;
    const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
    e.x = m.x;
    e.y = m.y;
    e.walkT += dt * 3;
    pt.data.left! -= step;
    if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
      pt.data.hit = 1;
      hurtPlayer(w, e.dmg * k.num('mul', 1.4), { fromX: e.x, fromY: e.y, knock: 200, source: e });
    }
    if (m.bx || m.by || pt.data.left! <= 0) {
      s.lock = false;
      k.end();
    }
  }
};

/** Froth: a fan of `count` bubbles spat where she faces. */
const froth: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: 70, r2: 0.6, angle: s.heading, len: 0, dur: k.num('wind', 0.5), dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + k.num('wind', 0.5)) {
    const n = Math.round(k.num('count', 5));
    for (let i = 0; i < n; i++) {
      const a = s.heading + (i / Math.max(1, n - 1) - 0.5) * 1.1;
      w.spawnProjectile({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 4, life: 260, dmg: e.dmg * k.num('mul', 0.7), type: 'frost', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: FOAM, hostile: true, homing: 0, child: false, knock: 0 });
    }
    w.sfx('squish', 0.5);
    k.end();
  }
};

/* ------------------------------------------------------------ Captain Saltbeard */

/** The Black Spot: pressed on the hero; it bursts in `time` s (`mul` of the hero's health) unless passed on. */
const blackSpot: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  const p = w.player;
  if (pt.step === 0) {
    if (s.spot || p.dead) {
      k.end();
      return;
    }
    s.spot = { on: null, at: w.time + k.num('time', 8), grace: w.time + 0.8, tick: 0, fxT: 0, mul: k.num('mul', 0.4) };
    s.flashes.clear();
    for (const o of w.enemies) s.flashes.set(o, o.flash);
    w.callout('The Black Spot! You’re a dead man walking!', '#ff8a8a', 'Pass it on: strike someone!');
    w.addFx({ kind: 'beam', x: e.x, y: e.y - 8, x2: p.x, y2: p.y - 8, life: 0.4, size: 2, color: SPOT });
    w.sfx('shadow', 0.7);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + 0.6) k.end();
};

function tickSpot(w: World, e: Enemy, s: Grotto, dt: number): void {
  const sp = s.spot;
  if (!sp) return;
  const p = w.player;
  if (sp.on) {
    // a crewman carries it: it takes him
    const o = sp.on;
    if (!o.dead && w.enemies.includes(o) && w.time < sp.at) {
      sp.fxT -= dt;
      if (sp.fxT <= 0) {
        sp.fxT = 0.25;
        w.addFx({ kind: 'ring', x: o.x, y: o.y, life: 0.3, size: 18, color: CURSE });
      }
      return;
    }
    if (!o.dead && w.enemies.includes(o)) {
      w.fxBurst(o.x, o.y - 6, SPOT, 18, 16);
      w.text(o.x, o.y - 24, 'The Spot takes him!', BONE, false);
      hitEnemy(w, o, o.hp + o.shield + 1, 'shadow', { depth: 1 });
    }
    s.spot = null;
    return;
  }
  // on the hero: its mark, and its count
  sp.fxT -= dt;
  if (sp.fxT <= 0) {
    sp.fxT = 0.25;
    w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.3, size: 20, color: CURSE });
    w.addFx({ kind: 'glow', x: p.x, y: p.y - 8, life: 0.3, size: 14, color: '#8a4ab8' });
  }
  const left = sp.at - w.time;
  if (left > 0 && left <= 5 && Math.ceil(left) !== sp.tick) {
    sp.tick = Math.ceil(left);
    w.text(p.x, p.y - 34, String(sp.tick), BONE, true);
  }
  // a blow passes it on: whoever was just struck takes it
  if (w.time >= sp.grace && !p.dead) {
    for (const o of w.enemies) {
      const was = s.flashes.get(o) ?? 0;
      s.flashes.set(o, o.flash);
      if (o.dead || o.def.prop || o.flash <= was + 0.01 || o.room !== e.room) continue;
      w.addFx({ kind: 'beam', x: p.x, y: p.y - 8, x2: o.x, y2: o.y - 8, life: 0.4, size: 2, color: SPOT });
      if (o === e) {
        s.spot = null;
        wound(w, e, 0.04, BONE);
        exposed(w, e, 2.8, 'Not the Spot! Not me!', BONE);
      } else {
        s.spot = { ...sp, on: o, at: w.time + 1.6 };
        w.text(o.x, o.y - 24, 'Yours now!', BONE, false);
      }
      return;
    }
  } else for (const o of w.enemies) s.flashes.set(o, o.flash);
  if (left <= 0) {
    s.spot = null;
    w.fxBurst(p.x, p.y - 6, SPOT, 26, 20);
    w.shake(6);
    if (!p.dead && hurtPlayer(w, p.maxHp * sp.mul, { pierce: true, status: { status: 'stun', dur: 1, power: 1 } })) w.text(p.x, p.y - 30, 'The Black Spot claims you!', '#ff8a8a', true);
  }
}

/** The Priestess's air vents while her shrine is flooded (for tests). */
export const floodVents = (e: Enemy): readonly { x: number; y: number }[] => FIGHTS.get(e)?.flood?.vents ?? [];

export const GROTTO_PATTERNS: Record<string, PatternFn> = {
  'grotto:flood': flood,
  'grotto:shell': shell,
  'grotto:molt': molt,
  'grotto:pincers': pincers,
  'grotto:scuttle': scuttle,
  'grotto:froth': froth,
  'grotto:black-spot': blackSpot,
};
