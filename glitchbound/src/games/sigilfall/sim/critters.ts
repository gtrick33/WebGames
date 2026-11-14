import { moveCircle, TILE, type TileMap } from './map';

/**
 * The animals of a place: hens scratching in a yard, sheep in their pen, pigs by the trough, a dog about the square,
 * a cat on the quay, a horse tied at the inn, deer at the edge of the wood. They are decoration, as the people of a
 * village are (sim/folk.ts): nothing fights them or talks to them, and they keep their own random numbers, so nothing
 * they do changes a fight or a co-op game.
 *
 * Each is let out by a rule on the map (a prop with nothing to draw: `chickens`, `sheep`, `pigs`, `dog`, `cat`,
 * `horse`, `deer`) and keeps near where it was let out. The shy ones run from a hero who comes close.
 *
 * When the place is attacked (a story fight going on, or roofs burning near its home) every animal bolts, away from
 * the trouble, and is gone; it is back at home when the trouble is over. A horse tied at the inn stood and twitched
 * through the Defense of Hearthstead (the owner: "a horse that's stuck a bit ... let it run away and disappear when the
 * attack starts").
 */
export type CritterKind = 'chicken' | 'sheep' | 'pig' | 'dog' | 'cat' | 'horse' | 'deer';

export interface Critter {
  kind: CritterKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds until it thinks again. */
  t: number;
  /** -1 looking west, 1 east. */
  face: number;
  /** Where it was let out. */
  hx: number;
  hy: number;
  /** Seconds since it bolted from an attack (0: it hasn't). */
  fled: number;
  /** How much of it is seen (it fades as it runs off, and back in at home after). */
  alpha: number;
}

interface Ways {
  /** How many a rule lets out, and how far apart (px). */
  n: number;
  spread: number;
  /** Its amble (px a second) and how far it strays from home (px). */
  speed: number;
  roam: number;
  /** Its body, for walls. */
  r: number;
  /** How near a hero may come before it runs (0: it doesn't mind), and how fast it runs. */
  shy: number;
  flee: number;
  /** How often it stands still rather than walks on (0-1). */
  rest: number;
  /** How fast it bolts from an attack (px a second). */
  bolt: number;
}

const WAYS: Record<CritterKind, Ways> = {
  chicken: { n: 4, spread: 30, speed: 18, roam: 3 * TILE, r: 3, shy: 22, flee: 60, rest: 0.4, bolt: 70 },
  sheep: { n: 3, spread: 34, speed: 9, roam: 1.6 * TILE, r: 5, shy: 0, flee: 0, rest: 0.6, bolt: 60 },
  pig: { n: 2, spread: 26, speed: 9, roam: 1.4 * TILE, r: 5, shy: 0, flee: 0, rest: 0.65, bolt: 55 },
  dog: { n: 1, spread: 0, speed: 30, roam: 5 * TILE, r: 4, shy: 0, flee: 0, rest: 0.45, bolt: 95 },
  cat: { n: 1, spread: 0, speed: 22, roam: 4 * TILE, r: 3, shy: 18, flee: 70, rest: 0.6, bolt: 90 },
  // (it ambles about its yard, and now and then breaks into a trot: it stood in one spot and twitched)
  horse: { n: 1, spread: 0, speed: 14, roam: 2.4 * TILE, r: 6, shy: 0, flee: 0, rest: 0.5, bolt: 125 },
  deer: { n: 3, spread: 46, speed: 14, roam: 4 * TILE, r: 5, shy: 76, flee: 96, rest: 0.55, bolt: 110 },
};

/** How near trouble (px from its home) an animal bolts from it, how long it runs before it's gone, and how long it fades out over at the end of that. */
const ALARM = 14 * TILE;
const FLED_FOR = 2.6;
const FADE_OUT = 1.2;
/** How long it takes to fade back in at home once the trouble is over. */
const FADE_IN = 1.2;
/** How often a horse breaks into a trot when it moves, and how much faster. */
const TROT = 0.3;
const TROT_K = 3.2;

/** The rules that let animals out, by the prop's name. */
const HERDS: Record<string, CritterKind> = { chickens: 'chicken', sheep: 'sheep', pigs: 'pig', dog: 'dog', cat: 'cat', horse: 'horse', deer: 'deer' };

/** The animal a prop lets out; null if it isn't such a rule. */
export const herdOf = (prop: string): CritterKind | null => HERDS[prop] ?? null;

/** The animals a rule lets out, about its spot. */
export function letOut(kind: CritterKind, x: number, y: number, rand: () => number): Critter[] {
  const w = WAYS[kind];
  const out: Critter[] = [];
  for (let i = 0; i < w.n; i++) out.push({ kind, x: x + (rand() - 0.5) * w.spread, y: y + (rand() - 0.5) * w.spread * 0.7, vx: 0, vy: 0, t: rand() * 2, face: rand() < 0.5 ? -1 : 1, hx: x, hy: y, fled: 0, alpha: 1 });
  return out;
}

/**
 * Moves the animals on. `trouble`: where the place is under attack (a burning roof, the hero in a story fight); an
 * animal whose home is near any of it bolts away from the nearest and is gone until there is none.
 */
export function updateCritters(list: Critter[], map: TileMap, hero: { x: number; y: number }, rand: () => number, dt: number, trouble: readonly { x: number; y: number }[] = []): void {
  for (const c of list) {
    const w = WAYS[c.kind];
    let near: { x: number; y: number } | null = null;
    let best = ALARM * ALARM;
    for (const d of trouble) {
      const dd = (d.x - c.hx) ** 2 + (d.y - c.hy) ** 2;
      if (dd < best) {
        best = dd;
        near = d;
      }
    }
    if (near) {
      if (c.fled >= FLED_FOR) continue;
      if (c.fled === 0) {
        // it bolts away from the trouble, never toward it (off at an angle if it is standing on it)
        const dx = c.x - near.x;
        const dy = c.y - near.y;
        const a = (dx || dy ? Math.atan2(dy, dx) : rand() * Math.PI * 2) + (rand() - 0.5) * 0.7;
        c.vx = Math.cos(a) * w.bolt;
        c.vy = Math.sin(a) * w.bolt;
        c.face = c.vx < 0 ? -1 : 1;
      }
      c.fled += dt;
      c.alpha = Math.max(0, Math.min(1, (FLED_FOR - c.fled) / FADE_OUT));
      const r = moveCircle(map, c.x, c.y, w.r, c.vx * dt, c.vy * dt);
      // (into a wall: it swerves and runs on)
      if (r.bx || r.by) {
        const a = Math.atan2(c.vy, c.vx) + (rand() < 0.5 ? 1 : -1) * (0.9 + rand() * 0.9);
        c.vx = Math.cos(a) * w.bolt;
        c.vy = Math.sin(a) * w.bolt;
        c.face = c.vx < 0 ? -1 : 1;
      }
      c.x = r.x;
      c.y = r.y;
      continue;
    }
    if (c.fled > 0) {
      // the trouble is over: home again, and seen again little by little
      if (c.fled >= FLED_FOR) {
        c.x = c.hx;
        c.y = c.hy;
        c.alpha = 0;
      }
      c.fled = 0;
      c.vx = 0;
      c.vy = 0;
      c.t = 1 + rand() * 2;
    }
    if (c.alpha < 1) c.alpha = Math.min(1, c.alpha + dt / FADE_IN);
    c.t -= dt;
    if (c.t <= 0) {
      c.t = 1 + rand() * 3;
      // home again when it has strayed, else wherever it likes
      const far = Math.hypot(c.x - c.hx, c.y - c.hy) > w.roam;
      const a = far ? Math.atan2(c.hy - c.y, c.hx - c.x) + (rand() - 0.5) * 0.8 : rand() * Math.PI * 2;
      let s = !far && rand() < w.rest ? 0 : w.speed;
      // (a horse trots a short way now and then, rather than always ambling)
      if (s && c.kind === 'horse' && rand() < TROT) {
        s *= TROT_K;
        c.t = 0.7 + rand() * 0.8;
      }
      c.vx = Math.cos(a) * s;
      c.vy = Math.sin(a) * s;
      if (c.vx) c.face = c.vx < 0 ? -1 : 1;
    }
    if (w.shy) {
      const dx = c.x - hero.x;
      const dy = c.y - hero.y;
      if (dx * dx + dy * dy < w.shy * w.shy) {
        const a = Math.atan2(dy, dx);
        c.vx = Math.cos(a) * w.flee;
        c.vy = Math.sin(a) * w.flee;
        c.face = c.vx < 0 ? -1 : 1;
        c.t = 0.6;
      }
    }
    if (!c.vx && !c.vy) continue;
    const r = moveCircle(map, c.x, c.y, w.r, c.vx * dt, c.vy * dt);
    // (a wall, a fence: it stops and thinks again soon)
    if (r.bx || r.by) {
      c.vx = 0;
      c.vy = 0;
      c.t = Math.min(c.t, 0.5);
    }
    c.x = r.x;
    c.y = r.y;
  }
}
