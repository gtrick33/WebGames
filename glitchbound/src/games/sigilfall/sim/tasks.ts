import { dist } from '../core/math';
import { THINGS } from '../data/things';
import type { Lair, Objective, QuestDef, ThingLook } from '../data/types';
import { activeQuests, currentObjective } from '../progress/character';
import { circleHitsWall, flowField, TILE, type TileMap } from './map';
import type { Enemy } from './types';
import type { World } from './world';

/**
 * Quest steps with something in the world to do (the owner, 2026-11-25: "every quest to be meaningful, not just walk
 * kill ... interactive"): things to act on, something to carry, a place to hold, a trail to follow, a foe to take
 * alive (data/types.ts Objective: use, carry, hold, trail, subdue; and a `lair` on a kill).
 *
 * Nothing here is on a land's map or in a save. While such a step is the hero's and its land is this one, its things
 * are put down near the place it names, at spots worked out from the quest's id (so they stand where they stood
 * before a reload), and how far the step has got is the quest's own count, as for a kill. In co-op each hero's
 * things are their own, as chests are; the foes a step brings (guards, an ambush, a hold's waves, a lair) come only in
 * the game that runs the enemies, and a guest's subdue counts the kill.
 */

export type ThingRole = 'use' | 'take' | 'goal' | 'mark';

export interface Thing {
  id: number;
  /** The quest and step it belongs to. */
  key: string;
  quest: string;
  /** Which of the step's things it is. */
  idx: number;
  look: ThingLook;
  role: ThingRole;
  x: number;
  y: number;
  /** What the hero does to it (the button's word). */
  verb: string;
  /** Seconds of standing at it. */
  secs: number;
  used: boolean;
  /** Seconds since it was used. */
  usedT: number;
}

export interface Tasks {
  things: Thing[];
  /** What the hero is in the middle of doing to a thing. */
  channel: { id: number; t: number; hp: number } | null;
  /** What the hero carries. */
  carrying: { key: string; look: ThingLook; total: number; sprung: number } | null;
  /** The place being held. */
  hold: { key: string; acc: number; wave: number; x: number; y: number; r: number; inside: boolean; warned: number; ready: number } | null;
  /** What has been put down already in this visit to the land (guards, lairs). */
  spawned: Set<string>;
  nextId: number;
  tick: number;
  /** Whether a subdue step is the hero's here (sim/combat.ts asks on every blow). */
  subduing: Extract<Objective, { kind: 'subdue' }> | null;
}

export const newTasks = (): Tasks => ({ things: [], channel: null, carrying: null, hold: null, spawned: new Set(), nextId: 1, tick: 0, subduing: null });

/** How close the hero stands to act on a thing, and how far they may drift while at it. */
export const THING_REACH = 26;
const MARK_REACH = 20;
const CHANNEL_DRIFT = 30;
/** Seconds the hero stands in a place before its hold begins. */
const HOLD_BREATH = 1.5;
/** A foe yields at this share of its health. */
export const YIELD_AT = 0.25;

type Step = Extract<Objective, { kind: 'use' | 'carry' | 'hold' | 'trail' | 'subdue' }>;
const isStep = (o: Objective): o is Step => o.kind === 'use' || o.kind === 'carry' || o.kind === 'hold' || o.kind === 'trail' || o.kind === 'subdue';

/** How many of a step there are to do (progress/character.ts questProgress). */
export function stepGoal(o: Objective): number | null {
  if (o.kind === 'use' || o.kind === 'subdue') return o.count;
  if (o.kind === 'hold') return o.secs;
  if (o.kind === 'trail') return o.marks;
  if (o.kind === 'carry') return 1;
  return null;
}

/** A number in [0, 1) from a string: the same every time, and nothing of the world's own dice is spent. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A place by its id: a place of the story, a sight, a shrine, or where someone stands. */
export function anchorOf(w: World, id: string): { x: number; y: number } | null {
  const place = w.places[id];
  if (place) return place;
  const spot = w.spots.find((s) => s.id === id) ?? w.shrines.find((s) => s.id === id) ?? w.npcs.find((n) => n.id === id);
  if (spot) return { x: spot.x, y: spot.y };
  // someone the story has moved away for now (a village emptied, a town under siege), or a place the land shows only in
  // one of its states (a festival's avenue): it is not here to be found, so the step is done at the land's waystone, its
  // middle. A step is never left with nowhere to be done (its test checks that the name is on the land's map at all)
  if (w.waystones[0]) return { x: w.waystones[0].x, y: w.waystones[0].y };
  return null;
}

const clearAt = (w: World, x: number, y: number, r = 7): boolean => x > TILE && y > TILE && x < (w.map.w - 1) * TILE && y < (w.map.h - 1) * TILE && !circleHitsWall(w.map, x, y, r);

/** The tiles a walker can get to from a place, by the land's own routes (kept per land and place: a land's ground does not change). */
const reaches = new WeakMap<TileMap, Map<number, Int16Array>>();
function reachFrom(w: World, ax: number, ay: number): Int16Array | null {
  const m = w.map;
  const tx = Math.floor(ax / TILE);
  const ty = Math.floor(ay / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
  let by = reaches.get(m);
  if (!by) reaches.set(m, (by = new Map()));
  const key = ty * m.w + tx;
  let f = by.get(key);
  if (!f) {
    f = flowField(m, tx, ty, 40);
    // (the place itself may be a thing's own tile, a well, a stone: then nothing is known of what can be reached)
    let any = 0;
    for (let i = 0; i < f.length && any < 12; i++) if (f[i]! > 0) any++;
    if (any < 12) f = new Int16Array(0);
    by.set(key, f);
  }
  return f.length ? f : null;
}

/**
 * Ground a quest's thing can stand on and be walked up to: clear of walls, of what stands on a tile (a tree, a cart, a
 * stall), of a wood that can't be entered, and on the land's routes from the place the step names, so that it is never
 * behind a wall, on an island or inside a house's lot.
 */
function openAt(w: World, x: number, y: number, reach: Int16Array | null): boolean {
  if (!clearAt(w, x, y)) return false;
  const m = w.map;
  const i = Math.floor(y / TILE) * m.w + Math.floor(x / TILE);
  if (m.thicket[i] || m.clogged[i] || m.bodies[i]?.length) return false;
  return !reach || reach[i]! >= 0;
}

/** Whether a spot is open ground on the land's routes from a place (what the steps' test asks of every thing). */
export const standsOpen = (w: World, at: { x: number; y: number }, x: number, y: number): boolean => openAt(w, x, y, reachFrom(w, at.x, at.y));

/** A clear spot within `spread` tiles of a place, away from what already stands there. */
function placeNear(w: World, ax: number, ay: number, rnd: () => number, spread: number, apart: { x: number; y: number }[], least = 0.3): { x: number; y: number } {
  const reach = reachFrom(w, ax, ay);
  for (let k = 0; k < 60; k++) {
    const a = rnd() * Math.PI * 2;
    const d = (least + (1 - least) * rnd()) * spread * TILE * (k < 40 ? 1 : 0.5);
    const x = ax + Math.cos(a) * d;
    const y = ay + Math.sin(a) * d;
    // (open ground on the land's routes for as long as there is some to be found; then any clear ground)
    if (k < 48 ? !openAt(w, x, y, reach) : !clearAt(w, x, y)) continue;
    if (apart.some((o) => dist(o.x, o.y, x, y) < 34)) continue;
    if (w.npcs.some((n) => dist(n.x, n.y, x, y) < 24)) continue;
    return { x, y };
  }
  for (let d = 0; d <= 60; d += 6) for (let i = 0; i < 12; i++) {
    const x = ax + Math.cos((i * Math.PI) / 6) * d;
    const y = ay + Math.sin((i * Math.PI) / 6) * d;
    if (clearAt(w, x, y)) return { x, y };
  }
  return { x: ax, y: ay };
}

/** Where each of a use step's things stands: the same for a quest and step every time. */
export function thingSpots(w: World, key: string, at: { x: number; y: number }, count: number, spread: number): { x: number; y: number }[] {
  const rnd = seeded(key);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) out.push(placeNear(w, at.x, at.y, rnd, spread, out));
  return out;
}

/** Where a trail's marks lie: along the way from its start to its end, each a little off the line. */
export function trailSpots(w: World, key: string, from: { x: number; y: number }, to: { x: number; y: number }, marks: number): { x: number; y: number }[] {
  const rnd = seeded(key);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < marks; i++) {
    const k = (i + 1) / marks;
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k;
    out.push(i === marks - 1 ? placeNear(w, x, y, rnd, 1.2, out, 0) : placeNear(w, x, y, rnd, 2.2, out, 0));
  }
  return out;
}

/**
 * Foes put down round a place by a step (never in a guest's game: the host's runs the enemies). `waiting`: they stand
 * there as a land's own packs do, until the hero comes near (a thing's guards, a lair's quarry); otherwise they rise
 * and come for the hero at once (an ambush, a hold's wave).
 */
function bring(w: World, ids: string[], x: number, y: number, key: string, ring = 34, waiting = false): Enemy[] {
  if (w.puppet || !ids.length) return [];
  const rnd = seeded(`${key}:foes`);
  const out: Enemy[] = [];
  for (const id of ids) {
    const at = placeNear(w, x, y, rnd, ring / TILE, out, 0.6);
    const e = w.addEnemy(id, at.x, at.y, w.level, { room: -1, pack: -1, ...(waiting ? {} : { spawn: true }) });
    out.push(e);
  }
  return out;
}

function lairOf(o: Objective): Lair | undefined {
  return o.kind === 'kill' || o.kind === 'subdue' ? o.lair : undefined;
}

/** The hero's steps of these kinds whose land is this one. */
function stepsHere(w: World): { q: QuestDef; o: Objective; key: string; n: number }[] {
  const out: { q: QuestDef; o: Objective; key: string; n: number }[] = [];
  for (const q of activeQuests(w.hero)) {
    const o = currentObjective(w.hero, q);
    if (!(isStep(o) || lairOf(o)) || !('region' in o) || o.region !== w.region.id) continue;
    const entry = w.hero.quests[q.id]!;
    out.push({ q, o, key: `${q.id}#${entry.step ?? 0}`, n: entry.n });
  }
  return out;
}

function addThing(w: World, t: Omit<Thing, 'id' | 'used' | 'usedT'>): Thing {
  const thing: Thing = { ...t, id: w.tasks.nextId++, used: false, usedT: 0 };
  w.tasks.things.push(thing);
  return thing;
}

/** Puts down what the hero's steps need and takes away what they no longer do. */
export function syncTasks(w: World): void {
  const T = w.tasks;
  const steps = stepsHere(w);
  const live = new Set(steps.map((s) => s.key));
  T.subduing = null;
  for (const { q, o, key, n } of steps) {
    if (o.kind === 'subdue') T.subduing = o;
    // nothing is put down over a scene: what the story stages at a place is played first, and a guard set down beside
    // the hero would break it off (a scene waits for calm, and ends when a fight begins)
    if (w.scene) continue;
    const lair = lairOf(o);
    if (lair && !T.spawned.has(`${key}:lair`)) {
      const at = anchorOf(w, lair.at);
      const wanted = new Set(lair.enemies);
      if (at && !w.enemies.some((e) => !e.dead && wanted.has(e.def.id))) {
        T.spawned.add(`${key}:lair`);
        bring(w, lair.enemies, at.x, at.y, `${key}:lair`, 40, true);
      }
    }
    if (o.kind === 'use') {
      const at = anchorOf(w, o.at);
      if (!at) continue;
      const spots = thingSpots(w, key, at, o.count, o.spread ?? 6);
      for (let i = n; i < o.count; i++) {
        if (T.things.some((t) => t.key === key && t.idx === i)) continue;
        const s = spots[i]!;
        addThing(w, { key, quest: q.id, idx: i, look: o.thing, role: 'use', x: s.x, y: s.y, verb: o.verb, secs: o.secs ?? 1.4 });
        if (o.guards && !T.spawned.has(`${key}:g${i}`)) {
          T.spawned.add(`${key}:g${i}`);
          bring(w, o.guards, s.x, s.y, `${key}:g${i}`, 30, true);
        }
      }
    } else if (o.kind === 'carry') {
      const carried = T.carrying?.key === key;
      const from = anchorOf(w, o.from);
      const to = anchorOf(w, o.to);
      if (!from || !to) continue;
      if (!carried && !T.things.some((t) => t.key === key && t.role === 'take')) {
        const s = placeNear(w, from.x, from.y, seeded(key), 1.5, [], 0);
        addThing(w, { key, quest: q.id, idx: 0, look: o.thing, role: 'take', x: s.x, y: s.y, verb: o.verb, secs: 0.6 });
      }
      if (carried && !T.things.some((t) => t.key === key && t.role === 'goal')) addThing(w, { key, quest: q.id, idx: 1, look: o.thing, role: 'goal', x: to.x, y: to.y, verb: '', secs: 0 });
    } else if (o.kind === 'hold') {
      const at = anchorOf(w, o.at);
      if (!at) continue;
      if (T.hold?.key !== key) T.hold = { key, acc: 0, wave: Math.floor((n / o.secs) * o.waves.length), x: at.x, y: at.y, r: (o.radius ?? 5) * TILE, inside: false, warned: 0, ready: 0 };
    } else if (o.kind === 'trail') {
      const from = anchorOf(w, o.from);
      const to = anchorOf(w, o.to);
      if (!from || !to || n >= o.marks) continue;
      if (!T.things.some((t) => t.key === key && t.idx === n && !t.used)) {
        const s = trailSpots(w, key, from, to, o.marks)[n]!;
        addThing(w, { key, quest: q.id, idx: n, look: o.thing ?? 'tracks', role: 'mark', x: s.x, y: s.y, verb: '', secs: 0 });
      }
    }
  }
  // what no step wants any more goes (a thing just used stays a few seconds, burning or opened)
  T.things = T.things.filter((t) => (live.has(t.key) && !(t.role === 'goal' && T.carrying?.key !== t.key)) || (t.used && t.usedT < 6));
  if (T.carrying && !live.has(T.carrying.key)) T.carrying = null;
  if (T.hold && !live.has(T.hold.key)) T.hold = null;
  if (T.channel && !T.things.some((t) => t.id === T.channel!.id && !t.used)) T.channel = null;
  // a foe that yielded to a step that is over is itself again
  if (!T.subduing) for (const e of w.enemies) if (e.yielded) release(e);
}

function release(e: Enemy): void {
  e.yielded = false;
  e.held = false;
}

const stepOf = (w: World, key: string): { q: QuestDef; o: Objective } | null => {
  const s = stepsHere(w).find((x) => x.key === key);
  return s ? { q: s.q, o: s.o } : null;
};

/** The thing the hero could act on now: the nearest within reach that is still to do. */
export function thingInReach(w: World): Thing | null {
  const p = w.player;
  let best: Thing | null = null;
  let bd = THING_REACH;
  for (const t of w.tasks.things) {
    if (t.used || (t.role !== 'use' && t.role !== 'take')) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/** The foe that has yielded and stands within reach, to be bound. */
export function yieldedInReach(w: World): Enemy | null {
  const p = w.player;
  let best: Enemy | null = null;
  let bd = THING_REACH + 6;
  for (const e of w.enemies) {
    if (!e.yielded || e.dead) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** The hero sets to work on a thing (the interact button). */
export function workOn(w: World, id: number): void {
  const T = w.tasks;
  const t = T.things.find((x) => x.id === id);
  if (!t || t.used || w.player.dead || T.channel?.id === id) return;
  if (t.secs <= 0) finish(w, t);
  else {
    T.channel = { id, t: 0, hp: w.player.hp };
    w.sfx('click');
  }
}

/** What the hero is doing to a thing, for the screen: its word and how far along (0 to 1). */
export function channelOf(w: World): { verb: string; k: number; x: number; y: number } | null {
  const c = w.tasks.channel;
  const t = c && w.tasks.things.find((x) => x.id === c.id);
  return c && t ? { verb: t.verb, k: Math.min(1, c.t / Math.max(0.01, t.secs)), x: t.x, y: t.y } : null;
}

function finish(w: World, t: Thing): void {
  const T = w.tasks;
  const step = stepOf(w, t.key);
  T.channel = null;
  if (!step) return;
  const { o } = step;
  const def = THINGS[t.look];
  if (o.kind === 'carry' && t.role === 'take') {
    const to = anchorOf(w, o.to);
    T.things = T.things.filter((x) => x !== t);
    T.carrying = { key: t.key, look: t.look, total: to ? Math.max(1, dist(t.x, t.y, to.x, to.y)) : 1, sprung: 0 };
    w.sfx('open');
    w.text(w.player.x, w.player.y - 26, o.verb, '#ffe08a', false);
    syncTasks(w);
    return;
  }
  if (o.kind !== 'use') return;
  t.used = true;
  t.usedT = 0;
  w.fxBurst(t.x, t.y - 6, def.after === 'burnt' ? '#ff8a3a' : def.glow, 16, 18);
  w.sfx(def.after === 'burnt' ? 'fire' : 'open');
  const note = o.notes?.[t.idx];
  if (note) w.emit({ t: 'toast', text: note, tone: 'info' });
  const done = (w.hero.quests[t.quest]?.n ?? 0) + 1;
  // an ambush springs at the middle one and at the last
  if (o.ambush && (done === o.count || (o.count >= 3 && done === Math.ceil(o.count / 2)))) {
    const foes = bring(w, o.ambush, t.x, t.y, `${t.key}:a${done}`, 60);
    if (foes.length) w.emit({ t: 'banner', text: 'Ambush!' });
  }
  w.questProgress((x) => x === o);
  syncTasks(w);
}

/** A foe the hero is to take alive, on a blow that would bring it low: it yields instead (sim/combat.ts). True if it did. */
export function yieldsTo(w: World, e: Enemy, dmg: number): boolean {
  const o = w.tasks.subduing;
  if (!o || w.puppet || e.boss || e.dummy || !o.enemies.includes(e.def.id)) return false;
  const floor = Math.max(1, Math.round(e.maxHp * YIELD_AT));
  if (e.hp - dmg > floor) return false;
  e.hp = Math.min(e.hp, floor);
  if (!e.yielded) {
    e.yielded = true;
    e.held = true;
    e.aggro = false;
    e.statuses = [];
    w.text(e.x, e.y - e.r - 14, 'Yields!', '#9cffd0', true);
    w.sfx('checkpoint');
  }
  return true;
}

/** The hero binds a foe that has yielded: it is taken away, and counted. */
export function bindYielded(w: World, id: number): void {
  const e = w.enemies.find((x) => x.id === id);
  const o = w.tasks.subduing;
  if (!e || !e.yielded || e.dead || !o) return;
  e.yielded = false;
  e.hp = 0;
  e.dead = true;
  e.deathT = 0;
  w.fxBurst(e.x, e.y - 6, '#9cffd0', 14, 14);
  w.sfx('open');
  w.text(e.x, e.y - e.r - 14, o.verb, '#9cffd0', false);
  w.questProgress((x) => x === o);
  syncTasks(w);
}

/** Every tick: what the hero is doing to a thing, what they carry, the place they hold, the marks they find. */
export function stepTasks(w: World, dt: number): void {
  const T = w.tasks;
  const p = w.player;
  if ((T.tick -= dt) <= 0) {
    T.tick = 0.25;
    syncTasks(w);
  }
  for (const t of T.things) if (t.used) t.usedT += dt;
  // at a thing: the work goes on while the hero stands there unhurt
  if (T.channel) {
    const c = T.channel;
    const t = T.things.find((x) => x.id === c.id);
    if (!t || p.dead || dist(p.x, p.y, t.x, t.y) > CHANNEL_DRIFT) T.channel = null;
    else if (p.hp < c.hp - 0.5) {
      T.channel = null;
      w.text(p.x, p.y - 26, 'Interrupted', '#ff8a8a', false);
    } else {
      c.hp = Math.max(c.hp, p.hp);
      c.t += dt;
      if (c.t >= t.secs) finish(w, t);
    }
  }
  // marks of a trail: read by walking onto them
  for (const t of T.things) {
    if (t.role !== 'mark' || t.used || p.dead || dist(p.x, p.y, t.x, t.y) > MARK_REACH) continue;
    const step = stepOf(w, t.key);
    if (!step || step.o.kind !== 'trail') continue;
    const o = step.o;
    t.used = true;
    t.usedT = 0;
    w.fxBurst(t.x, t.y - 4, THINGS[t.look].glow, 10, 12);
    w.sfx('discover');
    const note = o.notes[t.idx];
    if (note) w.emit({ t: 'toast', text: note, tone: 'info' });
    w.questProgress((x) => x === o);
    syncTasks(w);
    break;
  }
  // carrying: whoever wants it comes on the way, and it is set down at its place
  if (T.carrying) {
    const c = T.carrying;
    const step = stepOf(w, c.key);
    const o = step?.o;
    const to = o?.kind === 'carry' ? anchorOf(w, o.to) : null;
    if (!o || o.kind !== 'carry' || !to) T.carrying = null;
    else if (p.dead) {
      // dropped where the hero fell: it is back where it was taken from
      T.carrying = null;
      syncTasks(w);
    } else {
      const left = dist(p.x, p.y, to.x, to.y);
      const waves = o.ambush ?? [];
      const due = Math.min(waves.length, Math.floor((1 - left / c.total) * (waves.length + 1)));
      while (c.sprung < due) {
        const foes = bring(w, waves[c.sprung]!, p.x, p.y, `${c.key}:w${c.sprung}`, 90);
        for (const e of foes) e.aggro = true;
        c.sprung++;
      }
      if (left < THING_REACH) {
        T.carrying = null;
        w.fxBurst(to.x, to.y - 6, THINGS[o.thing].glow, 18, 20);
        w.sfx('checkpoint');
        w.questProgress((x) => x === o);
        syncTasks(w);
      }
    }
  }
  // holding a place: the clock runs while the hero stands in it
  if (T.hold) {
    const h = T.hold;
    const step = stepOf(w, h.key);
    const o = step?.o;
    if (!o || o.kind !== 'hold') T.hold = null;
    else {
      const there = !p.dead && dist(p.x, p.y, h.x, h.y) <= h.r;
      const done = w.hero.quests[step!.q.id]?.n ?? 0;
      // it begins a breath after the hero steps in, and never over a scene: what the story stages at the place is
      // played first (a scene waits for calm, and a wave of foes would keep it waiting for good)
      if (w.scene || !there) h.ready = 0;
      else h.ready += dt;
      const inside = there && !w.scene && (done > 0 || h.acc > 0 || h.ready >= HOLD_BREATH);
      if (inside && !h.inside && done === 0 && h.acc === 0) w.emit({ t: 'banner', text: 'Hold!', sub: o.label });
      h.inside = inside;
      if (inside) {
        h.acc += dt;
        // its waves come evenly through the time, the first at once
        const due = Math.min(o.waves.length, Math.floor(((done + h.acc) / o.secs) * o.waves.length) + 1);
        while (h.wave < due) {
          const foes = bring(w, o.waves[h.wave]!, h.x, h.y, `${h.key}:w${h.wave}`, h.r + 2 * TILE);
          for (const e of foes) e.aggro = true;
          h.wave++;
        }
        if (h.acc >= 1) {
          const whole = Math.floor(h.acc);
          h.acc -= whole;
          w.questProgress((x) => x === o, whole);
          if (!stepOf(w, h.key)) {
            T.hold = null;
            w.sfx('checkpoint');
            syncTasks(w);
          }
        }
      } else if (!there && (h.warned -= dt) <= 0 && done > 0) {
        h.warned = 4;
        w.text(p.x, p.y - 26, 'Get back!', '#ff8a8a', false);
      }
    }
  }
}
