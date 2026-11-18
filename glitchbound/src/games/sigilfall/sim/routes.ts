import { REGION_IDS, REGIONS } from '../data/regions';
import type { Marker, RegionDef, RegionId, StoryCond } from '../data/types';
import type { Character } from '../progress/character';
import { holds as condHolds } from './story';

/**
 * How the regions join up, and where people, places and bosses are: enough to lead the hero across
 * the world to a quest. Read from the hand-laid maps' markers, and from generated zones' specs (so a
 * zone is never generated just to find a route through it).
 */
interface Links {
  exits: Map<RegionId, RegionId[]>;
  /** The quest a road needs done before it opens, by `from>to`. */
  needs: Map<string, string>;
  /** The last region the maps list each person in (where quests are handed in: progress/handin.ts). */
  npc: Map<string, RegionId>;
  /** Every place each person stands, with the story condition they stand there under. */
  stands: Map<string, { region: RegionId; when?: StoryCond }[]>;
  spot: Map<string, RegionId>;
  boss: Map<string, RegionId>;
  /** Where each land's ways out are (0-1 across, 0-1 down), what their signs say, and whether each is a door. */
  ways: Map<RegionId, Way[]>;
}

interface Way {
  to: RegionId;
  at: [number, number];
  label: string;
  door: boolean;
}

let links: Links | null = null;
/** The roads both ways round (a road out of one region is a road into the other). */
let both: Map<RegionId, Set<RegionId>> | null = null;

function build(): Links {
  const L: Links = { exits: new Map(), needs: new Map(), npc: new Map(), stands: new Map(), spot: new Map(), boss: new Map(), ways: new Map() };
  const stands = (npc: string, region: RegionId, when?: StoryCond): void => {
    const list = L.stands.get(npc) ?? [];
    list.push({ region, ...(when ? { when } : {}) });
    L.stands.set(npc, list);
  };
  for (const id of REGION_IDS) {
    const r = REGIONS[id];
    const out: RegionId[] = [];
    if (r.holds) {
      out.push(...r.holds.exits);
      for (const n of r.holds.npcs) L.npc.set(n, id);
      // a built town knows its people's places already (with their conditions); a generated zone's spec says
      // who stands only while the story says so
      const placed = Object.getOwnPropertyDescriptor(r, 'placed')?.value as RegionDef['placed'];
      if (placed) {
        for (const p of placed) if (p.marker.kind === 'npc') stands(p.marker.npc, id, p.when);
      } else for (const n of r.holds.npcs) stands(n, id, r.holds.npcWhen?.[n]);
      for (const s of r.holds.spots) L.spot.set(s, id);
      for (const [to, q] of Object.entries(r.holds.needs ?? {})) L.needs.set(`${id}>${to}`, q!);
    } else {
      const used = new Set(r.map.join(''));
      const all = [...Object.entries(r.markers).flatMap(([ch, m]) => (used.has(ch) ? [{ m, when: r.when?.[ch] }] : [])), ...(r.placed ?? []).map((p) => ({ m: p.marker, when: p.when }))];
      for (const { m, when } of all) {
        if (m.kind === 'exit') {
          out.push(m.to);
          if (m.needs) L.needs.set(`${id}>${m.to}`, m.needs);
        } else if (m.kind === 'npc') {
          L.npc.set(m.npc, id);
          stands(m.npc, id, when);
        }
        // secrets (shrines) are left out on purpose: nothing points at them
        else if (m.kind === 'spot') L.spot.set(m.id, id);
        else if (m.kind === 'boss') L.boss.set(m.boss, id);
      }
    }
    L.exits.set(id, [...new Set(out)]);
    L.ways.set(id, waysOf(r));
  }
  return L;
}

/**
 * A land's ways out, where they are on it: a generated land's from its spec (it is never generated for this); a
 * built one's from its map, as long as the map is there without building anything.
 */
function waysOf(r: RegionDef): Way[] {
  if (r.holds?.ways) return r.holds.ways.map((w) => ({ ...w, door: inside(w.at) }));
  const map = Object.getOwnPropertyDescriptor(r, 'map')?.value as string[] | undefined;
  if (!map?.length) return [];
  const h = map.length;
  const w = map[0]!.length;
  const out: Way[] = [];
  const add = (tx: number, ty: number, m: Marker): void => {
    const at: [number, number] = [(tx + 0.5) / w, (ty + 0.5) / h];
    if (m.kind === 'exit') out.push({ to: m.to, at, label: m.label, door: !!m.door || inside(at) });
  };
  for (const [ch, m] of Object.entries(r.markers)) {
    if (m.kind !== 'exit') continue;
    for (let y = 0; y < h; y++) for (let x = map[y]!.indexOf(ch); x >= 0; x = map[y]!.indexOf(ch, x + 1)) add(x, y, m);
  }
  const placed = Object.getOwnPropertyDescriptor(r, 'placed')?.value as RegionDef['placed'];
  for (const p of placed ?? []) add(p.tx, p.ty, p.marker);
  return out;
}

/** A way out well inside its land (a stair down, a cave's mouth), not a road off its edge (a built map has a border of wall). */
const inside = ([x, y]: readonly [number, number]): boolean => Math.min(x, 1 - x, y, 1 - y) > 0.15;

/** A compass word on a road's sign ("North road", "the long road south-east"), as a way to go: x east, y south. */
export function signHeading(label: string): [number, number] | undefined {
  const m = /\b(north|south|east|west)(?:[- ]?(east|west))?\b/i.exec(label);
  if (!m) return undefined;
  const v: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  const a = v[m[1]!.toLowerCase()]!;
  const b: [number, number] = m[2] ? v[m[2].toLowerCase()]! : [0, 0];
  return unit([a[0] + b[0], a[1] + b[1]]);
}

function unit([x, y]: readonly [number, number]): [number, number] | undefined {
  const d = Math.hypot(x, y);
  return d > 1e-6 ? [x / d, y / d] : undefined;
}

/**
 * Which way the road from one land to another leaves it (x east, y south, a unit long): the side of the land it goes
 * out by (a road's sign often says, and counts as much), or for a door into a dungeon, where the door stands in it.
 */
export function wayHeading(from: RegionId, to: RegionId): [number, number] | undefined {
  const list = (get().ways.get(from) ?? []).filter((w) => w.to === to);
  if (!list.length) return undefined;
  const at: [number, number] = [list.reduce((s, w) => s + w.at[0], 0) / list.length, list.reduce((s, w) => s + w.at[1], 0) / list.length];
  // (a road out leaves by the side it is nearest; a door is where it stands, from the land's middle)
  const near = Math.min(at[0], 1 - at[0], at[1], 1 - at[1]);
  const where: [number, number] | undefined = list[0]!.door ? unit([at[0] - 0.5, at[1] - 0.5]) : near === at[1] ? [0, -1] : near === 1 - at[1] ? [0, 1] : near === at[0] ? [-1, 0] : [1, 0];
  const sign = signHeading(list[0]!.label);
  // (where the two say opposite things, neither is to be trusted)
  return unit([(where?.[0] ?? 0) + (sign?.[0] ?? 0), (where?.[1] ?? 0) + (sign?.[1] ?? 0)]);
}

/**
 * Which way one land lies from another, as the hero finds it on the ground: the way the road leaves the first, and
 * the way it comes into the second, together (a dungeon's way back out, always at its foot, says nothing). Where the
 * two disagree, where the lands lie on the old world map settles it.
 */
export function roadHeading(a: RegionId, b: RegionId): [number, number] | undefined {
  const fwd = REGIONS[a].kind === 'dungeon' ? undefined : wayHeading(a, b);
  const back = REGIONS[b].kind === 'dungeon' ? undefined : wayHeading(b, a);
  const [ax, ay] = REGIONS[a].at;
  const [bx, by] = REGIONS[b].at;
  const far = unit([bx - ax, by - ay]) ?? [0, 0];
  return unit([(fwd?.[0] ?? 0) - (back?.[0] ?? 0) + 0.3 * far[0], (fwd?.[1] ?? 0) - (back?.[1] ?? 0) + 0.3 * far[1]]);
}

const get = (): Links => (links ??= build());

/**
 * The region an NPC stands in. With a hero: where they stand for that hero's story now (a person the story
 * moves, or one who stands nowhere at the moment: undefined); without, the last place the maps list them.
 */
export function npcRegion(npc: string, c?: Character): RegionId | undefined {
  if (!c) return get().npc.get(npc);
  return get().stands.get(npc)?.find((x) => !x.when || condHolds(c, x.when))?.region;
}
/** The region a place or a boss is in. */
export const spotRegion = (spot: string): RegionId | undefined => get().spot.get(spot);
export const bossRegion = (boss: string): RegionId | undefined => get().boss.get(boss);
/** The regions a region has roads (or doors, or a dungeon's way in) to. */
export const roadsFrom = (r: RegionId): RegionId[] => get().exits.get(r) ?? [];

/**
 * The next region on the shortest walk from one region to another (null when already there or no way);
 * `done` says which quests are finished, so roads the story still keeps shut are walked round.
 */
export function nextRegion(from: RegionId, to: RegionId, done?: (quest: string) => boolean): RegionId | null {
  if (from === to) return null;
  const L = get();
  const prev = new Map<RegionId, RegionId>([[from, from]]);
  const q: RegionId[] = [from];
  while (q.length) {
    const r = q.shift()!;
    if (r === to) break;
    for (const n of L.exits.get(r) ?? []) {
      if (prev.has(n)) continue;
      const needs = done && L.needs.get(`${r}>${n}`);
      if (needs && !done(needs)) continue;
      prev.set(n, r);
      q.push(n);
    }
  }
  if (!prev.has(to)) return null;
  let step = to;
  while (prev.get(step) !== from) step = prev.get(step)!;
  return step;
}

/** How many roads from one region to every other it reaches, either way along each road (no story gates). */
export function roadHops(from: RegionId): Map<RegionId, number> {
  if (!both) {
    both = new Map();
    for (const [a, list] of get().exits) {
      for (const b of list) {
        for (const [x, y] of [[a, b], [b, a]] as const) {
          if (!both.has(x)) both.set(x, new Set());
          both.get(x)!.add(y);
        }
      }
    }
  }
  const out = new Map<RegionId, number>([[from, 0]]);
  const q: RegionId[] = [from];
  while (q.length) {
    const r = q.shift()!;
    for (const n of both.get(r) ?? []) {
      if (out.has(n)) continue;
      out.set(n, out.get(r)! + 1);
      q.push(n);
    }
  }
  return out;
}

/** The regions nearest `from` by road that `ok` takes (all of those as near; none: empty). */
export function nearestRegions(from: RegionId, ok: (id: RegionId) => boolean): RegionId[] {
  const hops = [...roadHops(from)].filter(([id]) => ok(id));
  const least = Math.min(...hops.map(([, n]) => n));
  return hops.filter(([, n]) => n === least).map(([id]) => id);
}

/** A way to go in words ("north", "south-east"), from a heading (x east, y south). */
export function headingWord([x, y]: readonly [number, number]): string {
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return names[(((Math.round(Math.atan2(-y, x) / (Math.PI / 4)) % 8) + 8) % 8)]!;
}

/** Every pair of regions joined by a way through, once each (for the world map). */
export function regionLinks(): [RegionId, RegionId][] {
  const out: [RegionId, RegionId][] = [];
  for (const [a, list] of get().exits) for (const b of list) if (a < b || !get().exits.get(b)?.includes(a)) out.push([a, b]);
  return out;
}
