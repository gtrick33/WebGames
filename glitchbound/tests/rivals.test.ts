import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import type { LeaderRow } from '../src/platform/apiTypes';
import { boardRank, rivalCount, rivals, withRivals, wouldRank } from '../src/platform/rivals';

const member = (nickname: string, score: number, rank: number, you = false): LeaderRow => ({ rank, nickname, level: 3, score, at: 1, you });

describe('house rivals', () => {
  it('fill every board with a few hundred labeled rivals, the same for everyone, growing a little each day', () => {
    for (const g of GAMES.filter((x) => !x.partyOnly)) {
      const field = rivals(g.slug, 'all', '2026-10-27');
      expect(field.length, g.slug).toBeGreaterThanOrEqual(150);
      expect(field.length, g.slug).toBeLessThan(700);
      expect(field.every((r) => r.rival && !r.you && r.score > 0)).toBe(true);
      // best first
      expect(field.map((r) => r.score)).toEqual([...field.map((r) => r.score)].sort((a, b) => b - a));
      expect(rivals(g.slug, 'all', '2026-10-27')).toEqual(field);
    }
    expect(rivalCount('wait-what', '2026-10-28')).toBeGreaterThan(rivalCount('wait-what', '2026-10-27'));
  });

  it('keep their people as the field grows, and score within what the game allows', () => {
    const today = rivals('wait-what', 'all', '2026-10-27');
    const tomorrow = rivals('wait-what', 'all', '2026-10-28');
    // yesterday's rivals are all still there, with the same scores
    const seen = new Set(tomorrow.map((r) => `${r.nickname}:${r.score}`));
    expect(today.every((r) => seen.has(`${r.nickname}:${r.score}`))).toBe(true);
    // a daily quiz tops out at 1,500; a strong player can still beat the best rival
    expect(today[0]!.score).toBeLessThanOrEqual(1_412);
    expect(today[0]!.score).toBeGreaterThan(1_200);
    expect(Math.max(...rivals('whatsit', 'all', '2026-10-27').map((r) => r.score))).toBeLessThanOrEqual(1_000);
  });

  it('a 24-hour board is a smaller, weaker field that changes every day', () => {
    const day = rivals('gloop', '24h', '2026-10-27');
    expect(day.length).toBeLessThan(50);
    expect(day[0]!.score).toBeLessThan(rivals('gloop', 'all', '2026-10-27')[0]!.score);
    expect(rivals('gloop', '24h', '2026-10-28')).not.toEqual(day);
  });

  it('ranks members among the rivals, a member first on a tie, and keeps your row in view', () => {
    const field = rivals('wait-what', 'all', '2026-10-27');
    const top = field[0]!.score;
    const { rows } = withRivals('wait-what', 'all', '2026-10-27', [member('Aroso', top + 10, 1), member('blunt', top, 2)], null);
    expect(rows).toHaveLength(50);
    expect(rows.slice(0, 3).map((r) => [r.rank, r.nickname, !!r.rival])).toEqual([
      [1, 'Aroso', false],
      [2, 'blunt', false],
      [3, field[0]!.nickname, true],
    ]);
    // your best below the top 50 is ranked among everyone
    const low = field[200]!.score;
    const mine = withRivals('wait-what', 'all', '2026-10-27', [member('Aroso', top + 10, 1)], member('me', low, 7, true));
    expect(mine.mine).toMatchObject({ nickname: 'me', you: true, rank: boardRank('wait-what', '2026-10-27', low, 7) });
    expect(mine.mine!.rank).toBeGreaterThan(200);
    // a guest's best: where it would land
    expect(wouldRank('wait-what', '2026-10-27', top + 1)).toBe(1);
    expect(wouldRank('wait-what', '2026-10-27', 0)).toBe(field.length + 1);
  });
});
