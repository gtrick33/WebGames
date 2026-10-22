import { dist } from '../core/math';
import { QUEST_DEFS } from '../data/quests';
import type { QuestDef, RegionId } from '../data/types';
import { questRegion } from '../progress/character';
import { TILE } from './map';
import { bossRegion, nextRegion, npcRegion, spotRegion } from './routes';
import type { World } from './world';

/**
 * Where the hero's quests want them to go: in this region, a place (a person, a sight, a boss, the next
 * sealed room) or, for hunting and gathering, the nearest fitting enemy (`soft`: shown on the minimap,
 * not pointed at from the edge of the screen); in another region, the way out that leads toward it.
 * Quests done where the hero is come first.
 */
export interface Objective {
  x: number;
  y: number;
  soft: boolean;
}

export function objectiveTarget(w: World): Objective | null {
  const h = w.hero;
  const here = w.region.id;
  const place = (x: number, y: number): Objective => ({ x, y, soft: false });
  const markerOf = (pred: (m: (typeof w.map.markers)[number]) => boolean): Objective | null => {
    const m = w.map.markers.find(pred);
    return m ? place((m.tx + 0.5) * TILE, (m.ty + 0.5) * TILE) : null;
  };
  const nearest = (pred: (e: World['enemies'][number]) => boolean): Objective | null => {
    let best: Objective | null = null;
    let bd = Infinity;
    for (const e of w.enemies) {
      if (e.dead || e.dummy || !pred(e)) continue;
      const d = dist(e.x, e.y, w.player.x, w.player.y);
      if (d < bd) {
        bd = d;
        best = { x: e.x, y: e.y, soft: true };
      }
    }
    return best;
  };
  /** In the quest's region: what `inside` finds; elsewhere: the exit toward it. */
  const goTo = (region: RegionId | undefined, inside: () => Objective | null): Objective | null => {
    if (!region) return null;
    if (region === here) return inside();
    const next = nextRegion(here, region);
    const x = next ? w.exits.find((e) => e.to === next) : undefined;
    return x ? place(x.x, x.y) : null;
  };

  const active = Object.entries(h.quests)
    .filter(([, s]) => s.state === 'active')
    .map(([id]) => QUEST_DEFS[id])
    .filter((q): q is QuestDef => !!q);
  // the ones done here first, the story order otherwise
  active.sort((a, b) => Number(questRegion(b) === here) - Number(questRegion(a) === here));
  for (const q of active) {
    const o = q.objective;
    let t: Objective | null = null;
    switch (o.kind) {
      case 'tutorial':
        if (here === 'emberwick') {
          const d = w.enemies.find((e) => e.dummy === (o.step === 'dodge' ? 2 : 1));
          if (d) t = place(d.x, d.y);
        }
        break;
      case 'kill':
        t = goTo(o.region, () => nearest((e) => !o.enemies || o.enemies.includes(e.def.id)));
        break;
      case 'loot':
        t = goTo(o.region, () => nearest((e) => o.from.includes(e.def.id)));
        break;
      case 'collect':
        // Rift Shards: the glowing elites of the Whisperwood
        t = goTo('whisperwood', () => nearest((e) => e.elite.length > 0));
        break;
      case 'talk':
        t = goTo(npcRegion(o.npc), () => {
          const n = w.npcs.find((x) => x.id === o.npc);
          return n ? place(n.x, n.y) : null;
        });
        break;
      case 'explore':
        t = goTo(spotRegion(o.spot), () => {
          const sp = w.spots.find((s) => s.id === o.spot);
          return sp ? place(sp.x, sp.y) : null;
        });
        break;
      case 'boss':
        t = goTo(bossRegion(o.boss), () => markerOf((pm) => pm.marker.kind === 'boss' && pm.marker.boss === o.boss));
        break;
      case 'clear':
        t = goTo(o.region, () => {
          // the next room still to fight, then the last
          const enc = w.encounters.find((e) => e.state !== 'cleared');
          const tiles = enc ? (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]) : [];
          const i = tiles[Math.floor(tiles.length / 2)];
          return i !== undefined ? place(((i % w.map.w) + 0.5) * TILE, (Math.floor(i / w.map.w) + 0.5) * TILE) : null;
        });
        break;
    }
    if (t) return t;
  }
  if (w.portal) return place(w.portal.x, w.portal.y);
  return null;
}

