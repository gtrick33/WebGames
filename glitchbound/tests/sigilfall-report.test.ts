import { describe, expect, it, vi } from 'vitest';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { readyHero } from './sigilfall-bot';

vi.mock('../src/games/sigilfall/render/sprites', () => ({ skillIconUrl: () => '' }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));

/** The engine's arcade report, driven without a canvas: the run, the hero and the world it reads. */
function engineWith(run: Record<string, unknown>, world: Record<string, unknown> | null) {
  const reports: { type: string; score?: number; stats?: Record<string, number> }[] = [];
  const e = Object.create(SigilEngine.prototype) as Record<string, unknown>;
  Object.assign(e, { run, hero: readyHero('warrior', 30, 'rare'), world, host: { report: (r: (typeof reports)[number]) => reports.push(r) } });
  const end = (): void => (e.endRun as (toast: boolean) => void).call(e, false);
  return { reports, end };
}

const stats = (xp = 0, kills = 0) => ({ xp, gold: 0, kills, bosses: 0, items: [] });

describe('Sigilfall arcade report', () => {
  it('SFS-11: a short trip with nothing in it is not reported as a round', () => {
    const { reports, end } = engineWith({ start: performance.now() - 5000, region: 'brackenridge', tier: 0, mods: [], key: 0 }, { run: stats(), region: { id: 'briarhollow' } });
    end();
    expect(reports).toEqual([]);
    // a short one with a kill in it, and a long empty one, are rounds
    const short = engineWith({ start: performance.now() - 5000, region: 'brackenridge', tier: 0, mods: [], key: 0 }, { run: stats(40, 1), region: { id: 'briarhollow' } });
    short.end();
    expect(short.reports).toHaveLength(1);
    const long = engineWith({ start: performance.now() - 60_000, region: 'brackenridge', tier: 0, mods: [], key: 0 }, { run: stats(), region: { id: 'briarhollow' } });
    long.end();
    expect(long.reports).toHaveLength(1);
  });

  it('SFS-07: a Riftstone finished in time still counts after walking out of its dungeon', () => {
    const keyEnd = { key: 3, time: 600, par: 900, up: 1, stone: 4, best: 3, marks: 10, deaths: 0 };
    // the hero walked out into an open land: the world there has no Riftstone, the run kept its result
    const { reports, end } = engineWith({ start: performance.now() - 700_000, region: 'thornvale', tier: 2, mods: [], key: 0, keyEnd }, { run: { ...stats(500), gold: 0 }, region: { id: 'thornvale' } });
    end();
    expect(reports[0]!.score).toBe(500 + 3000);
    expect(reports[0]!.stats!.mythicPlus).toBe(3);
  });
});
