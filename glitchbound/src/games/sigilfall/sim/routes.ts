import { REGION_IDS, REGIONS } from '../data/regions';
import type { RegionId } from '../data/types';

/**
 * How the regions join up, and where people, places and bosses are: enough to lead the hero across
 * the world to a quest. Read from the hand-laid maps' markers, and from generated zones' specs (so a
 * zone is never generated just to find a route through it).
 */
interface Links {
  exits: Map<RegionId, RegionId[]>;
  npc: Map<string, RegionId>;
  spot: Map<string, RegionId>;
  boss: Map<string, RegionId>;
}

let links: Links | null = null;

function build(): Links {
  const L: Links = { exits: new Map(), npc: new Map(), spot: new Map(), boss: new Map() };
  for (const id of REGION_IDS) {
    const r = REGIONS[id];
    const out: RegionId[] = [];
    if (r.holds) {
      out.push(...r.holds.exits);
      for (const n of r.holds.npcs) L.npc.set(n, id);
      for (const s of r.holds.spots) L.spot.set(s, id);
    } else {
      const used = new Set(r.map.join(''));
      const all = [...Object.entries(r.markers).flatMap(([ch, m]) => (used.has(ch) ? [m] : [])), ...(r.placed ?? []).map((p) => p.marker)];
      for (const m of all) {
        if (m.kind === 'exit') out.push(m.to);
        else if (m.kind === 'npc') L.npc.set(m.npc, id);
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

/** The region an NPC, a place or a boss is in. */
export const npcRegion = (npc: string): RegionId | undefined => get().npc.get(npc);
export const spotRegion = (spot: string): RegionId | undefined => get().spot.get(spot);
export const bossRegion = (boss: string): RegionId | undefined => get().boss.get(boss);

/** The next region on the shortest walk from one region to another (null when already there or no way). */
export function nextRegion(from: RegionId, to: RegionId): RegionId | null {
  if (from === to) return null;
  const L = get();
  const prev = new Map<RegionId, RegionId>([[from, from]]);
  const q: RegionId[] = [from];
  while (q.length) {
    const r = q.shift()!;
    if (r === to) break;
    for (const n of L.exits.get(r) ?? []) {
      if (prev.has(n)) continue;
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
