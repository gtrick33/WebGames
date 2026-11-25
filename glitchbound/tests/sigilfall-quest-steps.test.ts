/**
 * Every quest gives the hero something to do (the owner, 2026-11-25: "every quest to be meaningful, not just walk
 * kill ... interactive"): the lands gone through so far have no quest that is only a walk, a talk or a count of
 * kills; and every step with something in the world to do (sim/tasks.ts) names a place that is on its land's map,
 * foes that exist, and words short enough to be read on a phone.
 */
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { NPCS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { THINGS } from '../src/games/sigilfall/data/things';
import type { Marker, Objective, QuestDef, RegionDef } from '../src/games/sigilfall/data/types';
import { ZONES } from '../src/games/sigilfall/data/zones';

const stepsOf = (q: QuestDef): Objective[] => [q.objective, ...(q.then ?? [])];
const allMarkers = (r: RegionDef): Marker[] => [...Object.values(r.markers), ...(r.placed ?? []).map((p) => p.marker)];

/** The places a step can name in a land: its sights, its shrines, the story's places, and whoever stands in it. */
function placesOf(region: string): Set<string> {
  const out = new Set<string>();
  const r = REGIONS[region as keyof typeof REGIONS];
  if (!r) return out;
  for (const m of allMarkers(r)) {
    if (m.kind === 'spot' || m.kind === 'shrine' || m.kind === 'place') out.add(m.id);
    if (m.kind === 'npc') out.add(m.npc);
  }
  for (const n of (r as RegionDef & { npcs?: string[] }).npcs ?? []) out.add(n);
  return out;
}

/** The lands whose quests have been gone through (it grows as the pass does). */
const DONE = ['thornvale', 'brackenridge', 'amberfield', 'ashen-barrows', 'sunscorch', 'glimmerwood', 'rimeheld', 'shattered-vale', 'highwall', 'gloamhollow', 'weeping-woods', 'emberdeep', 'hollowmere', 'pale-reach', 'emberwick'];
/**
 * The story's ending, which is told and chosen, not worked at: the last fight, the memory of Vaelmoor, the choice, and
 * the Crown unmade. They are left as they were.
 */
const ENDING = new Set(['the-hollow-king', 'crownfall-vaelmoor', 'crownfall-one-hour', 'crownfall-break-it', 'crownfall-the-ash-crown']);
/** A step that is something to do, not somewhere to be or something to count. */
const DOING = new Set(['use', 'carry', 'hold', 'trail', 'subdue', 'event', 'boss', 'clear', 'tutorial']);
/** What fits on the interact button, and in a toast's two lines on a phone. */
const VERB = 22;
const NOTE = 64;

describe('Sigilfall: every quest gives the hero something to do', () => {
  for (const land of DONE) {
    const zone = ZONES.find((z) => z.region.id === land)!;
    it(`${land}: no quest is only a walk, a talk or a count`, () => {
      expect(zone.quests.length).toBeGreaterThan(5);
      for (const q of zone.quests) {
        if (ENDING.has(q.id)) continue;
        const steps = stepsOf(q);
        expect(steps.some((o) => DOING.has(o.kind)), `${q.id}: ${steps.map((o) => o.kind).join(', ')}`).toBe(true);
        // (a fight the story stages may be the whole of a quest: its ending is the story's own, and a chore after it
        // would come between the fight and what the story shows next)
        if (!(steps.length === 1 && steps[0]!.kind === 'event')) expect(steps.length, `${q.id} has one step`).toBeGreaterThan(1);
      }
    });
  }

  it('across the lands gone through, the hero burns, searches, carries, holds, tracks and takes alive: not one kind of step over and over', () => {
    const kinds = new Map<string, number>();
    for (const land of DONE) for (const q of ZONES.find((z) => z.region.id === land)!.quests) for (const o of stepsOf(q)) kinds.set(o.kind, (kinds.get(o.kind) ?? 0) + 1);
    for (const k of ['use', 'carry', 'hold', 'trail', 'subdue']) expect(kinds.get(k) ?? 0, k).toBeGreaterThanOrEqual(2);
  });
});

describe('Sigilfall: a step with something in the world to do can be done', () => {
  const steps = QUESTS.flatMap((q) => stepsOf(q).map((o) => ({ q, o })));

  it('names a place on its land’s map (or someone who stands there)', () => {
    for (const { q, o } of steps) {
      const names = o.kind === 'use' || o.kind === 'hold' ? [o.at] : o.kind === 'carry' || o.kind === 'trail' ? [o.from, o.to] : [];
      const lair = o.kind === 'kill' || o.kind === 'subdue' ? o.lair : undefined;
      if (lair) names.push(lair.at);
      if (!names.length || !('region' in o)) continue;
      const places = placesOf(o.region);
      for (const id of names) expect(places.has(id) || !!NPCS[id], `${q.id}: ${o.kind} names ${id}, which is not in ${o.region}`).toBe(true);
    }
  });

  it('brings only foes that exist, and takes alive only foes that do', () => {
    for (const { q, o } of steps) {
      const ids = [
        ...(o.kind === 'use' ? [...(o.guards ?? []), ...(o.ambush ?? [])] : []),
        ...(o.kind === 'carry' ? (o.ambush ?? []).flat() : []),
        ...(o.kind === 'hold' ? o.waves.flat() : []),
        ...(o.kind === 'subdue' ? o.enemies : []),
        ...((o.kind === 'kill' || o.kind === 'subdue') && o.lair ? o.lair.enemies : []),
      ];
      for (const id of ids) expect(ENEMIES[id], `${q.id}: ${o.kind} names the foe ${id}`).toBeTruthy();
    }
  });

  it('has a thing with a model, a word that fits the button, and notes that fit a phone’s toast, one for each thing or mark', () => {
    for (const { q, o } of steps) {
      if (o.kind === 'use' || o.kind === 'carry') {
        expect(THINGS[o.thing], `${q.id}: ${o.thing}`).toBeTruthy();
        expect(o.verb.length, `${q.id}: “${o.verb}”`).toBeLessThanOrEqual(VERB);
      }
      if (o.kind === 'subdue') expect(o.verb.length, `${q.id}: “${o.verb}”`).toBeLessThanOrEqual(VERB);
      const notes = o.kind === 'use' ? o.notes : o.kind === 'trail' ? o.notes : undefined;
      if (!notes) continue;
      expect(notes.length, `${q.id}: notes`).toBe(o.kind === 'use' ? o.count : o.kind === 'trail' ? o.marks : 0);
      for (const n of notes) expect(n.length, `${q.id}: “${n}”`).toBeLessThanOrEqual(NOTE);
    }
  });

  it('a hold lasts long enough to be a fight and not so long as to be a wait, and has waves', () => {
    for (const { q, o } of steps) {
      if (o.kind !== 'hold') continue;
      expect(o.secs, q.id).toBeGreaterThanOrEqual(15);
      expect(o.secs, q.id).toBeLessThanOrEqual(60);
      expect(o.waves.length, q.id).toBeGreaterThanOrEqual(2);
    }
  });
});
