import { describe, expect, it } from 'vitest';
import { acceptAll, activeQuests, readyQuests, trackQuest } from '../src/games/sigilfall/progress/character';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { objectiveTarget, objectiveTargets, questCounts, questTarget } from '../src/games/sigilfall/sim/objective';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Owner, 2026-10: every active quest on the land map, the minimap and the world map, not only the one
 * followed (no more switching the tracked quest just to see where things are).
 */

function hearthstead() {
  const p = PRESETS.find((x) => x.id === 'hearthstead')!;
  const h = readyHero('warrior', p.level);
  applyPreset(h, p);
  // (every quest offered there taken: more than the one story beat to mark. The crypt's Heroic quest was the other
  // before Heroic went, 2026-11-22)
  acceptAll(h);
  return newWorld(p.region as RegionId, h);
}

describe('Sigilfall: every quest on the maps', () => {
  it('marks every active quest that has a place, the first being the arrow’s', () => {
    const w = hearthstead();
    const quests = [...activeQuests(w.hero), ...readyQuests(w.hero)];
    expect(quests.length).toBeGreaterThan(1);
    const marks = objectiveTargets(w);
    // one mark per quest with somewhere to go, none twice
    expect(new Set(marks.map((m) => m.quest)).size).toBe(marks.length);
    expect(marks.length).toBe(quests.filter((q) => questTarget(w, q, true) || questTarget(w, q)).length);
    expect(marks.length).toBeGreaterThan(1);
    const first = objectiveTarget(w)!;
    expect(marks[0]).toMatchObject({ x: first.x, y: first.y, quest: first.quest });
    // here or behind a way out
    for (const m of marks) expect(m.here).toBe(!m.via);
  });

  it('following another quest puts it first (the ring) and keeps the rest on the map', () => {
    const w = hearthstead();
    const before = objectiveTargets(w);
    const other = before[1]!.quest;
    trackQuest(w.hero, other);
    const after = objectiveTargets(w);
    expect(after[0]!.quest).toBe(other);
    expect(objectiveTarget(w)?.quest).toBe(other);
    expect(new Set(after.map((m) => m.quest))).toEqual(new Set(before.map((m) => m.quest)));
  });

  it('is worked out at most twice a second, not every frame', () => {
    const w = hearthstead();
    const a = objectiveTargets(w);
    expect(objectiveTargets(w)).toBe(a);
    w.time += 0.6;
    expect(objectiveTargets(w)).not.toBe(a);
  });

  it('counts the quests per land for the world map', () => {
    const w = hearthstead();
    const counts = questCounts(w.hero);
    const total = [...counts.values()].reduce((n, c) => n + c.work, 0);
    // every active quest whose land is known is counted once
    expect(total).toBeGreaterThan(1);
    expect(total).toBeLessThanOrEqual([...activeQuests(w.hero), ...readyQuests(w.hero)].length);
    expect(counts.get(w.region.id)?.work ?? 0).toBeGreaterThan(0);
  });
});
