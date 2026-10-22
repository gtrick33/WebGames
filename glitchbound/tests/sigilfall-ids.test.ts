/**
 * Every zone and dungeon brings its own enemies, items, people and quests, and the game merges them into
 * one table each: a repeated id would quietly replace another (a quest that never shows, an enemy with
 * the wrong sprite). Here every id is checked to be used once.
 */
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../src/games/sigilfall/data/dungeons';
import { ITEMS } from '../src/games/sigilfall/data/items';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { ZONES } from '../src/games/sigilfall/data/zones';

function once(ids: [string, string][]): void {
  const seen = new Map<string, string>();
  for (const [id, from] of ids) {
    expect(seen.has(id), `${id} is defined in ${seen.get(id)} and in ${from}`).toBe(false);
    seen.set(id, from);
  }
}

describe('sigilfall ids', () => {
  const modules = [...ZONES.map((z) => ({ name: z.region.id, foes: z.foes ?? {}, npcs: z.npcs, bosses: {} })), ...DUNGEONS.map((d) => ({ name: d.region.id, foes: d.foes ?? {}, npcs: {}, bosses: d.bosses }))];

  it('quests and items are each defined once', () => {
    once(QUESTS.map((q) => [q.id, q.zone ?? 'a story or first quest']));
    once(ITEMS.map((i) => [i.id, i.slot]));
  });

  it('no two zones or dungeons define the same enemy, boss or person', () => {
    once(modules.flatMap((m) => [...Object.keys(m.foes), ...Object.keys(m.bosses)].map((id): [string, string] => [id, m.name])));
    once(modules.flatMap((m) => Object.keys(m.npcs).map((id): [string, string] => [id, m.name])));
  });
});
