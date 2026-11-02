import { REGION_IDS, REGIONS } from '../data/regions';
import type { RegionDef, RegionId, StoryCond } from '../data/types';
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
}

let links: Links | null = null;

function build(): Links {
  const L: Links = { exits: new Map(), needs: new Map(), npc: new Map(), stands: new Map(), spot: new Map(), boss: new Map() };
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
  }
  return L;
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

/** Every pair of regions joined by a way through, once each (for the world map). */
export function regionLinks(): [RegionId, RegionId][] {
  const out: [RegionId, RegionId][] = [];
  for (const [a, list] of get().exits) for (const b of list) if (a < b || !get().exits.get(b)?.includes(a)) out.push([a, b]);
  return out;
}
