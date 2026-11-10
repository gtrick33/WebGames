/**
 * Vaelmoor Remembered (level 60), the finale's last stage: the Crown's memory of Vaelmoor whole. Nothing is fought here
 * (the Hallow King was the last fight): the square where Elyra's choice is made, and the palace garden where the Ash
 * Crown hangs until she unmakes it. Every class walks from the way in to the garden without getting stuck, the Crown
 * hangs there until its quest is done, and when it is, the way home opens.
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import type { Character } from '../src/games/sigilfall/progress/character';
import { questState } from '../src/games/sigilfall/progress/character';
import { newWorld, play, readyHero } from './sigilfall-bot';
import { gearAt } from './sigilfall-bot';

const REGION = 'vaelmoor-remembered';
const LEVEL = Math.min(MAX_LEVEL, REGIONS[REGION].level + 1);

/** A hero whose answer is given and who has come up into the memory to see the Crown unmade. */
function atTheEnd(cls: ClassId): Character {
  const c = readyHero(cls, LEVEL, gearAt(LEVEL));
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) if (a !== 'crownfall-one-hour') done(a);
  };
  done('crownfall-break-it');
  c.quests['crownfall-one-hour'] = { state: 'done', n: -1 };
  c.quests['crownfall-the-ash-crown'] = { state: 'active', n: 0 };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

describe('sigilfall: Vaelmoor Remembered', () => {
  it('has no fight in it: the King was the last, and the way home opens with the Crown unmade', () => {
    expect(REGIONS[REGION].encounters.filter((e) => e.boss)).toEqual([]);
    expect(REGIONS[REGION].homeAfter).toBe('crownfall-the-ash-crown');
    expect(QUEST_DEFS['crownfall-the-ash-crown']!.objective).toMatchObject({ kind: 'explore', spot: 'memory-garden' });
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: walks up from the square to the garden, and the Crown is unmade`, { timeout: 120_000 }, () => {
      const w = newWorld(REGION, atTheEnd(cls as ClassId));
      expect(w.props.some((p) => p.prop === 'great:ash-crown')).toBe(true);
      const garden = w.spots.find((s) => s.id === 'memory-garden')!;
      expect(garden).toBeTruthy();
      const r = play(w, {
        seconds: 240,
        done: (x) => questState(x.hero, 'crownfall-the-ash-crown') === 'done',
        goal: () => ({ x: garden.x, y: garden.y }),
      });
      expect(r.stuck).toBe(false);
      expect(questState(w.hero, 'crownfall-the-ash-crown')).toBe('done');
      expect(w.portal).not.toBeNull();
      expect(r.deaths).toBe(0);
    });
  }
});
