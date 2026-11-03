import { dist } from '../core/math';
import { EVENTS } from '../data/events';
import { QUESTS } from '../data/quests';
import type { QuestDef, RegionId } from '../data/types';
import { activeQuests, currentObjective, questRegion, questState, readyQuests, HOME } from '../progress/character';
import { isMainQuest, turnInNpc } from '../progress/handin';
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
  /** The quest it is for. */
  quest?: string;
  /** In another land: the land the way out it points at leads to. */
  via?: RegionId;
}

/** Every quest on the maps (objectiveTargets): which quest, a story one or not, and whether its work is here. */
export interface QuestMark extends Objective {
  quest: string;
  main: boolean;
  here: boolean;
}

/**
 * The land a quest's work is in now: a boss in its dungeon, a person where they stand, the story where it
 * happens; a finished quest, where it is handed in.
 */
export function questWhere(h: World['hero'], q: QuestDef): RegionId | undefined {
  if (questState(h, q.id) === 'ready') {
    const who = turnInNpc(q);
    return who ? npcRegion(who, h) : undefined;
  }
  const o = currentObjective(h, q);
  if (o.kind === 'boss') return bossRegion(o.boss) ?? questRegion(q);
  if (o.kind === 'talk') return npcRegion(o.npc, h) ?? questRegion(q);
  if (o.kind === 'explore') return spotRegion(o.spot) ?? questRegion(q);
  if (o.kind === 'event') return EVENTS[o.event]?.region ?? questRegion(q);
  return questRegion(q);
}

/** Per land: the active quests whose work is there, and the quests waiting to be taken from someone there. */
export function questCounts(h: World['hero']): Map<RegionId, { work: number; offers: number }> {
  const out = new Map<RegionId, { work: number; offers: number }>();
  const at = (id: RegionId | undefined) => {
    if (!id) return null;
    let c = out.get(id);
    if (!c) out.set(id, (c = { work: 0, offers: 0 }));
    return c;
  };
  for (const q of QUESTS) {
    const st = questState(h, q.id);
    if (st === 'active' || st === 'ready') {
      const c = at(questWhere(h, q));
      if (c) c.work++;
    } else if (st === 'offered' && q.giver) {
      const c = at(npcRegion(q.giver, h));
      if (c) c.offers++;
    }
  }
  return out;
}

/** The hero's active and finished quests in the tracker's order: the followed one, then those done here, then the story's. */
export function rankedQuests(w: World): QuestDef[] {
  const h = w.hero;
  const here = w.region.id;
  const active = [...activeQuests(h), ...readyQuests(h)];
  const rank = (q: QuestDef): number => (q.id === h.tracked ? 2 : 0) + (questWhere(h, q) === here ? 1 : 0);
  return active.sort((a, b) => rank(b) - rank(a));
}

/** Where the quest followed first wants the hero (the arrow, the tracker's ring); the open portal when none does. */
export function objectiveTarget(w: World): Objective | null {
  for (const q of rankedQuests(w)) {
    const t = questTarget(w, q);
    if (t) return t;
  }
  if (w.portal) return { x: w.portal.x, y: w.portal.y, soft: false };
  return null;
}

/** Each world's quest marks, worked out at most twice a second (or when the followed quest or the land changes). */
const marks = new WeakMap<World, { at: number; key: string; list: QuestMark[] }>();

/**
 * Every quest's place for the maps, in the tracker's order (the first is objectiveTarget's). Quests other than
 * the first use places that hold still (a hunt's den rather than the nearest moving foe).
 */
export function objectiveTargets(w: World): QuestMark[] {
  const key = `${w.region.id}|${w.hero.tracked ?? ''}`;
  const c = marks.get(w);
  if (c && c.key === key && w.time >= c.at && w.time - c.at < 0.5) return c.list;
  const list: QuestMark[] = [];
  for (const q of rankedQuests(w)) {
    const t = questTarget(w, q, list.length > 0);
    if (t) list.push({ ...t, quest: q.id, main: isMainQuest(q.id), here: !t.via });
  }
  marks.set(w, { at: w.time, key, list });
  return list;
}

/** Where one quest wants the hero (`steady`: a den, not the nearest foe of a moving hunt). */
export function questTarget(w: World, q: QuestDef, steady = false): Objective | null {
  const h = w.hero;
  const here = w.region.id;
  const place = (x: number, y: number): Objective => ({ x, y, soft: false });
  const markerOf = (pred: (m: (typeof w.map.markers)[number]) => boolean): Objective | null => {
    const m = w.map.markers.find(pred);
    return m ? place((m.tx + 0.5) * TILE, (m.ty + 0.5) * TILE) : null;
  };
  const nearest = (pred: (e: World['enemies'][number]) => boolean): Objective | null => {
    if (steady) return null;
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
  /** Where a foe the hero hunts camps while none of its kind are about (they come back there; the minimap shows the place). */
  const den = (ids: string[]): Objective | null => {
    const st = w.packs.find((s) => !s.gone && s.enemies.some((id) => ids.includes(id)));
    return st ? { x: st.x, y: st.y, soft: true } : null;
  };
  /** In the quest's region: what `inside` finds; elsewhere: the exit toward it. */
  const goTo = (region: RegionId | undefined, inside: () => Objective | null): Objective | null => {
    if (!region) return null;
    if (region === here) return inside();
    const next = nextRegion(here, region, (q) => questState(h, q) === 'done');
    const x = next ? w.exits.find((e) => e.to === next) : undefined;
    return x ? { ...place(x.x, x.y), via: x.to as RegionId } : null;
  };

  // handed in: to the one who takes it back
  if (questState(h, q.id) === 'ready') {
    const who = turnInNpc(q);
    const t = who
      ? goTo(npcRegion(who, h), () => {
          const n = w.npcs.find((x) => x.id === who);
          return n ? place(n.x, n.y) : null;
        })
      : null;
    return t ? { ...t, quest: q.id } : null;
  }
  const o = currentObjective(h, q);
  let t: Objective | null = null;
  switch (o.kind) {
    case 'tutorial':
      if (here === HOME) {
        const d = w.enemies.find((e) => e.dummy === (o.step === 'dodge' ? 2 : 1));
        if (d) t = place(d.x, d.y);
      }
      break;
    case 'kill':
      t = goTo(o.region, () => nearest((e) => !o.enemies || o.enemies.includes(e.def.id)) ?? (o.enemies ? den(o.enemies) : null));
      break;
    case 'loot':
      t = goTo(o.region, () => nearest((e) => o.from.includes(e.def.id)) ?? den(o.from));
      break;
    case 'collect':
      // Rift Shards: the glowing elites of the Whisperwood
      t = goTo('whisperwood', () => nearest((e) => e.elite.length > 0));
      break;
    case 'talk':
      t = goTo(npcRegion(o.npc, h), () => {
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
      // a harder difficulty is chosen at a waystone's map: walking in by the road is always Normal
      if (o.tier > 0 && w.tier !== o.tier) {
        let best: Objective | null = null;
        for (const s of w.waystones) if (!best || dist(s.x, s.y, w.player.x, w.player.y) < dist(best.x, best.y, w.player.x, w.player.y)) best = place(s.x, s.y);
        t = here === o.region ? null : best;
        break;
      }
      t = goTo(o.region, () => {
        // the next room still to fight, then the last
        const enc = w.encounters.find((e) => e.state !== 'cleared');
        // its floor, not its doorways (a door shuts on whoever stands in it)
        const doors = new Set(enc ? (w.map.doors[enc.index] ?? []) : []);
        const tiles = enc ? (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i] && !doors.has(i)) : [];
        const i = tiles[Math.floor(tiles.length / 2)];
        return i !== undefined ? place(((i % w.map.w) + 0.5) * TILE, (Math.floor(i / w.map.w) + 0.5) * TILE) : null;
      });
      break;
    case 'event': {
      // where the story happens; once it does, the fight (on the minimap) or the way to safety
      const def = EVENTS[o.event];
      t = goTo(def?.region, () => {
        if (!def) return null;
        const spot = (id: string): Objective | null => {
          const s = w.places[id] ?? w.spots.find((x) => x.id === id);
          return s ? place(s.x, s.y) : null;
        };
        if (w.story.run?.def.id !== def.id) return spot(def.at);
        const run = w.story.run;
        if (def.rescue && run.safe.size < run.followers.length) return spot(def.rescue.to);
        // between waves the fight is still here: its place stays on the minimap, the arrow never leads off
        const hold = spot(def.escort ? def.escort.to : def.at);
        return nearest((e) => run.ids.includes(e.id)) ?? (hold && { ...hold, soft: true });
      });
      break;
    }
  }
  return t ? { ...t, quest: q.id } : null;
}

