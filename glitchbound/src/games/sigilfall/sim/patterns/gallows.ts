import { dist, TAU } from '../../core/math';
import { healPlayer, hurtPlayer } from '../combat';
import { castRay, moveCircle, tileAt } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';
import { exposed, fighting, inLine, onFloor, removeThing, ringSpots, roomBox, spawnThing, up } from './arena';
import type { PatternFn } from './kit';

/**
 * Boss attacks of Gallows Keep: ids start with 'gallows:'. The gang's three, each harder than the last.
 *
 * The Hangman works the gallows floor: he drops its trapdoors, half the boards and then the other half, a
 * checkerboard to step across (`trapdoors`); and once he has his second axe he throws his hook, drags whoever it
 * catches onto a trapdoor in front of him and drops it (`hook-drop`).
 *
 * Gnasher, the gang's war-hound, digs under the kennels and comes up under the hero (`burrow`): the mound runs after
 * them under the floor and bursts up where it ends. But the kennels are strewn with bone heaps, and a hound is a
 * hound: lead the mound over one and he comes up there to gnaw it, open to every blow. A heap picked clean is no use
 * for a while.
 *
 * Harlan Blackglove rules by fear (`hostages`): he hangs captives in iron cages over the fire pits by the walls and
 * starts the fires. Break a cage open before its fire takes it and the captive's thanks steadies the hero (health,
 * and the ultimate nearer); let one burn and the gang's roar quickens their king and mends him a little.
 *
 * What lasts beyond a pattern (the cages and their fires, the heaps picked clean) is kept per boss here and run by a
 * small ticker (World.after, once a step) for as long as the fight lasts.
 */

const CAGE = 'gang-cage';
const ROPE = '#c9b89a';
const DIRT = '#8a6a48';
const EMBER = '#ffb04d';
const GOLD = '#ffe066';

interface Gallows {
  last: number;
  /** Gnasher: when each bone heap (by its place in the world's props) may be gnawed again. */
  gnawed: Map<number, number>;
  /** Harlan's captives: each cage, when its fire takes it, and the last second counted over it. */
  cages: { c: Enemy; burnAt: number; tick: number; fireT: number }[];
}

const FIGHTS = new WeakMap<Enemy, Gallows>();

function fight(w: World, e: Enemy): Gallows {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, gnawed: new Map(), cages: [] };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    for (const h of s.cages) removeThing(w, h.c);
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickCages(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------ the Hangman */

/**
 * The trapdoors: the floor is boards in a checkerboard (`gap` px apart); `waves` times, one color of them is shown
 * for `wind` s and drops, then the other. Standing on a board that drops hurts (`mul` of his blow) and stuns a moment.
 */
const trapdoors: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const waves = Math.round(k.num('waves', 2));
  const wind = k.num('wind', 1.5);
  if (pt.step === 0) {
    w.callout('Drop the boards!', ROPE);
    w.sfx('doorSlam', 0.6);
    pt.data.wave = 0;
    pt.data.next = pt.t + 0.3;
    pt.data.par = Math.floor(w.rand() * 2);
    pt.step = 1;
  }
  if (pt.step === 1 && pt.t >= pt.data.next!) {
    const box = roomBox(w, e);
    const gap = k.num('gap', 52);
    const r = gap * 0.58;
    const par = (pt.data.par! + pt.data.wave!) % 2;
    let i = 0;
    for (let y = box.y0 + gap / 2; y < box.y1; y += gap) {
      let j = 0;
      for (let x = box.x0 + gap / 2; x < box.x1; x += gap) {
        if ((i + j) % 2 === par && onFloor(w, e, x, y, 2)) {
          w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.3), status: { status: 'stun', dur: 0.5, power: 1 }, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        }
        j++;
      }
      i++;
    }
    w.sfx('windup', 0.5);
    pt.data.wave! += 1;
    pt.data.next = pt.t + wind + k.num('gapT', 0.15);
    if (pt.data.wave! >= waves) pt.step = 2;
  }
  if (pt.step === 2 && pt.t >= pt.data.next!) k.end();
};

/**
 * The hook and the drop: a hook thrown along a line (`len`, `width`) shown for `wind` s. Caught, the hero is
 * dragged to the boards in front of him, and they drop `drop` s later (`mul` of his blow): dodge out.
 */
const hookDrop: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const wind = k.num('wind', 0.8);
  const width = k.num('width', 13);
  const drop = k.num('drop', 0.9);
  if (pt.step === 0) {
    const a = k.aimAt();
    const end = castRay(w.map, e.x, e.y, 3, a, k.num('len', 170));
    pt.data.a = a;
    pt.data.len = Math.max(20, dist(e.x, e.y, end.x, end.y));
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: width, angle: a, len: pt.data.len, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    e.face = Math.cos(a) < 0 ? Math.PI : 0;
    w.callout('Your turn on the boards!', ROPE);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    const a = pt.data.a!;
    const len = pt.data.len!;
    w.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: e.x + Math.cos(a) * len, y2: e.y + Math.sin(a) * len, life: 0.15, size: 1, color: ROPE });
    w.sfx('whirl', 0.6);
    pt.data.t1 = pt.t;
    const caught = !p.dead && inLine(p.x, p.y, p.r * 0.5, e.x, e.y, a, len, width) && hurtPlayer(w, e.dmg * 0.4, { source: e });
    if (!caught) {
      pt.step = 9;
      return;
    }
    w.text(p.x, p.y - 22, 'HOOKED!', '#ffb0a0', true);
    pt.data.tx = e.x + Math.cos(a) * (e.r + 28);
    pt.data.ty = e.y + Math.sin(a) * (e.r + 28);
    pt.step = 2;
  } else if (pt.step === 2) {
    // dragged onto the boards in front of him (walls still stop the hero)
    const tx = pt.data.tx!;
    const ty = pt.data.ty!;
    const d = dist(p.x, p.y, tx, ty);
    if (!p.dead && d > 4 && pt.t < pt.data.t1! + 0.45) {
      const s = Math.min(d, 440 * dt);
      const m = moveCircle(w.map, p.x, p.y, p.r, ((tx - p.x) / d) * s, ((ty - p.y) / d) * s);
      p.x = m.x;
      p.y = m.y;
      p.vx = 0;
      p.vy = 0;
      w.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: p.x, y2: p.y - 4, life: dt * 2, size: 1, color: ROPE });
    } else {
      w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 30, r2: 0, angle: 0, len: 0, dur: drop, dmg: e.dmg * k.num('mul', 1.8), status: { status: 'stun', dur: 0.8, power: 1 }, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      w.text(p.x, p.y - 30, 'THE DROP!', ROPE, true);
      w.sfx('doorSlam', 0.5);
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + drop) {
    pt.data.t1 = pt.t;
    pt.step = 9;
  } else if (pt.step === 9 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/* ------------------------------------------------------------ Gnasher */

/** The bone heap within reach of the mound (in the boss's room, not picked clean), if any. */
function heapNear(w: World, e: Enemy, s: Gallows, reach: number): { i: number; x: number; y: number } | null {
  for (const [i, pr] of w.props.entries()) {
    if (pr.prop !== 'bone-heap') continue;
    if ((s.gnawed.get(i) ?? 0) > w.time) continue;
    const x = pr.x;
    const y = pr.y;
    if (w.map.room[tileAt(w.map, x, y)] !== e.room + 1) continue;
    if (dist(x, y, e.x, e.y) < reach) return { i, x, y };
  }
  return null;
}

/**
 * The burrow: he digs in (out of reach) and the mound runs after the hero at `speed` for `time` s, then bursts up
 * where it is (`r`, shown for `erupt` s, `mul` of his blow). Over a bone heap he comes up at once to gnaw it, stunned
 * for `daze` s; the heap is picked clean for `regrow` s.
 */
const burrow: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const s = fight(w, e);
  const erupt = k.num('erupt', 0.65);
  if (pt.step === 0) {
    w.callout('Gnasher digs in!', DIRT);
    w.sfx('crumble', 0.7);
    w.shake(3);
    w.fxBurst(e.x, e.y, DIRT, 24, 18);
    pt.data.hide = 1;
    pt.data.end = pt.t + k.num('time', 5);
    pt.data.mark = 0;
    pt.step = 1;
    return;
  }
  if (pt.step === 1) {
    // the mound runs after the hero under the floor (and the hound with it)
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > 2 && !p.dead) {
      const sp = Math.min(d, k.num('speed', 82) * dt);
      const m = moveCircle(w.map, e.x, e.y, 6, ((p.x - e.x) / d) * sp, ((p.y - e.y) / d) * sp);
      e.x = m.x;
      e.y = m.y;
    }
    if (pt.t >= pt.data.mark!) {
      pt.data.mark = pt.t + 0.2;
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 22, r2: 0, angle: 0, len: 0, dur: 0.24, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      w.addFx({ kind: 'smoke', x: e.x, y: e.y, vx: 0, vy: -8, life: 0.5, size: 5, color: DIRT });
    }
    // a bone heap on the way: a hound is a hound
    const heap = heapNear(w, e, s, 18);
    if (heap) {
      s.gnawed.set(heap.i, w.time + k.num('regrow', 22));
      e.x = heap.x;
      e.y = heap.y + 4;
      pt.data.hide = 0;
      k.end();
      w.fxBurst(e.x, e.y, DIRT, 26, 20);
      exposed(w, e, k.num('daze', 3.2), 'Gnasher can’t resist the bones!', GOLD);
      return;
    }
    if (pt.t >= pt.data.end!) {
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: k.num('r', 40), r2: 0, angle: 0, len: 0, dur: erupt, dmg: e.dmg * k.num('mul', 1.8), knock: 170, tone: 'enemy', owner: -1, linger: 0 });
      w.sfx('windup', 0.7);
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
    return;
  }
  if (pt.step === 2 && pt.t >= pt.data.t1! + erupt) {
    pt.data.hide = 0;
    w.fxBurst(e.x, e.y, DIRT, 30, 24);
    w.shake(5);
    w.sfx('slam');
    pt.data.t1 = pt.t;
    pt.step = 3;
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.5) k.end();
};

/* ------------------------------------------------------------ Harlan Blackglove */

/**
 * Hostages: `n` captives hung in cages by the walls (the ones farthest from the hero first), their fires lit; each
 * burns `time` s later unless broken open first.
 */
const hostages: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const p = w.player;
  const s = fight(w, e);
  if (pt.step === 0) {
    const n = Math.round(k.num('n', 1));
    const box = roomBox(w, e);
    const spots = ringSpots(w, e, 8, Math.min(190, (box.x1 - box.x0) * 0.42), w.rand() * TAU).sort((a, b) => dist(b.x, b.y, p.x, p.y) - dist(a.x, a.y, p.x, p.y));
    let made = 0;
    for (const sp of spots) {
      if (made >= n) break;
      if (s.cages.some((h) => dist(h.c.x, h.c.y, sp.x, sp.y) < 44) || dist(sp.x, sp.y, e.x, e.y) < 40) continue;
      const c = spawnThing(w, e, CAGE, sp.x, sp.y);
      if (!c) continue;
      s.cages.push({ c, burnAt: w.time + k.num('time', 9), tick: 0, fireT: 0 });
      made++;
    }
    w.text(e.x, e.y - e.r - 16, made > 1 ? 'Into the fire with them!' : 'Into the fire with this one!', EMBER, true);
    if (made) w.text(p.x, p.y - 30, made > 1 ? 'Break the cages open!' : 'Break the cage open!', '#c8ffb0', false);
    w.sfx('roar', 0.5);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + 0.6) k.end();
};

/** The cages: their fires, the count over the last seconds, a captive freed or lost. */
function tickCages(w: World, e: Enemy, s: Gallows, dt: number): void {
  for (const h of [...s.cages]) {
    const c = h.c;
    if (!up(w, c)) {
      s.cages.splice(s.cages.indexOf(h), 1);
      // broken open: the captive goes free, and thanks the hero
      w.text(c.x, c.y - 28, 'Bless you! Give him one from me!', '#c8ffb0', true);
      w.fxBurst(c.x, c.y - 12, GOLD, 16, 14);
      healPlayer(w, 12, false);
      w.player.ult = Math.min(100, w.player.ult + 20);
      continue;
    }
    const left = h.burnAt - w.time;
    // the fire under it, higher as it nears
    h.fireT -= dt;
    if (h.fireT <= 0) {
      h.fireT = left < 3 ? 0.08 : 0.18;
      w.addFx({ kind: 'glow', x: c.x, y: c.y + 2, life: 0.3, size: left < 3 ? 16 : 12, color: EMBER });
      w.addFx({ kind: 'spark', x: c.x + (((w.time * 37) % 1) - 0.5) * 18, y: c.y + 2, vx: 0, vy: -40 - (left < 3 ? 30 : 0), life: 0.5, size: 2, color: EMBER });
    }
    if (left > 0 && left <= 5 && Math.ceil(left) !== h.tick) {
      h.tick = Math.ceil(left);
      w.text(c.x, c.y - 34, String(h.tick), EMBER, true);
      if (h.tick === 5) w.text(c.x, c.y - 46, 'Help! Get me out!', '#ffd0c0', false);
    }
    if (left <= 0) {
      // the fire takes it: the gang roars for their king
      s.cages.splice(s.cages.indexOf(h), 1);
      w.fxBurst(c.x, c.y - 10, EMBER, 26, 20);
      w.addFx({ kind: 'ring', x: c.x, y: c.y, life: 0.5, size: 40, color: EMBER });
      removeThing(w, c);
      e.atkMul *= 1.1;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04);
      w.callout('The gang roars for their king!', '#ff8a8a');
      w.sfx('roar', 0.6);
    }
  }
}

export const GALLOWS_PATTERNS: Record<string, PatternFn> = {
  'gallows:trapdoors': trapdoors,
  'gallows:hook-drop': hookDrop,
  'gallows:burrow': burrow,
  'gallows:hostages': hostages,
};
