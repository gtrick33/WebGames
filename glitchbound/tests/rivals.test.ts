import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import type { HallRow, LeaderRow } from '../src/platform/apiTypes';
import { boardRank, HALL_SEATS, HOUSE, houseHall, rivalCount, rivals, withHouse, withRivals, wouldRank } from '../src/platform/rivals';

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

  it('put the house team at the top of every all-time board, and give everyone else a name that reads like a person', () => {
    for (const g of GAMES.filter((x) => !x.partyOnly)) {
      const top = rivals(g.slug, 'all', '2026-10-27').slice(0, HOUSE.length);
      expect(new Set(top.map((r) => r.nickname)), g.slug).toEqual(new Set(HOUSE));
    }
    const rest = rivals('gloop', 'all', '2026-10-27').slice(HOUSE.length);
    expect(rest.some((r) => (HOUSE as readonly string[]).includes(r.nickname))).toBe(false);
    expect(rest.filter((r) => /^[A-Z][a-z]+ [A-Z]\.$/.test(r.nickname)).length).toBeGreaterThan(rest.length / 5);
  });
});

describe('house players in the Hall of Fame', () => {
  const games = GAMES.filter((x) => !x.partyOnly).map((g) => g.slug);
  const hallRow = (nickname: string, crowns: number, rank: number): HallRow => ({ rank, nickname, level: 5, crowns, podiums: crowns, records: crowns, games: crowns, you: false });

  it('fill an empty Hall with the house team, counting the boards they top', () => {
    const house = houseHall(games, '2026-10-27');
    const rows = withHouse([], house);
    expect(rows).toHaveLength(HALL_SEATS);
    expect(rows.every((r) => r.house)).toBe(true);
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
    // every board's #1 is a crown for one of them
    expect(house.reduce((n, r) => n + r.crowns, 0)).toBe(games.length);
  });

  it('give up a seat to each member, weakest first, and rank members among them', () => {
    const house = houseHall(games, '2026-10-27');
    const best = Math.max(...house.map((r) => r.crowns));
    const rows = withHouse([hallRow('Aroso', best + 1, 1), hallRow('blunt', 0, 2)], house);
    expect(rows).toHaveLength(HALL_SEATS);
    expect(rows[0]).toMatchObject({ rank: 1, nickname: 'Aroso' });
    expect(rows.filter((r) => r.house)).toHaveLength(HALL_SEATS - 2);
    const full = Array.from({ length: HALL_SEATS }, (_, i) => hallRow(`m${i}`, 0, i + 1));
    expect(withHouse(full, house)).toEqual(full);
  });
});
