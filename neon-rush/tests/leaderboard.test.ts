import { describe, expect, it } from 'vitest';
import { checkClaim, validateName, utcDay } from '../src/backend/leaderboard-rules';
import { World } from '../src/game/world';
import { Autopilot } from '../src/game/autopilot';
import { SIM_DT } from '../src/game/config';

function claimFrom(w: World) {
  return {
    score: w.stats.score,
    meters: Math.floor(w.stats.meters),
    coins: w.stats.coins,
    nearMisses: w.stats.nearMisses,
    durationMs: Math.round(w.stats.time * 1000),
  };
}

describe('leaderboard names', () => {
  it('accepts normal names and rejects bad ones', () => {
    expect(validateName('NeonDriver')).toBeNull();
    expect(validateName('Sava H.')).toBeNull();
    expect(validateName('ab')).not.toBeNull();
    expect(validateName('x'.repeat(15))).not.toBeNull();
    expect(validateName('<script>')).not.toBeNull();
    expect(validateName('5h1t_head')).not.toBeNull();
    expect(validateName(42)).not.toBeNull();
  });
});

describe('score plausibility', () => {
  it('never rejects genuine runs, including power-up heavy ones', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = new World({ seed: seed * 31, viewHeight: 800 });
      const p = new Autopilot(0.05);
      for (let i = 0; i < 60 / SIM_DT && !w.crashed; i++) {
        if (seed % 2) {
          w.active.magnet = 5;
          w.active.double = 5;
        }
        p.update(w, SIM_DT);
        w.update(SIM_DT);
      }
      const c = claimFrom(w);
      // Wall time is at least the simulated time (pauses only add to it).
      expect(checkClaim(c, c.durationMs), `seed ${seed}`).toBeNull();
    }
  });

  it('rejects impossible claims', () => {
    const ok = { score: 1300, meters: 1000, coins: 30, nearMisses: 0, durationMs: 30_000 };
    expect(checkClaim(ok, 31_000)).toBeNull();
    expect(checkClaim({ ...ok, durationMs: 30_000 }, 10_000)).toBe('too_fast');
    expect(checkClaim({ ...ok, meters: 5000, score: 5300 }, 31_000)).toBe('distance_high');
    expect(checkClaim({ ...ok, meters: 100, score: 400 }, 31_000)).toBe('distance_low');
    expect(checkClaim({ ...ok, coins: 900, score: 10_000 }, 31_000)).toBe('coins');
    expect(checkClaim({ ...ok, score: 999_999 }, 31_000)).toBe('score');
    expect(checkClaim({ ...ok, score: 1.5 }, 31_000)).toBe('malformed');
    expect(checkClaim({ ...ok, durationMs: 500 }, 31_000)).toBe('duration');
  });

  it('uses UTC days for the daily board', () => {
    expect(utcDay(Date.UTC(2026, 9, 17, 23, 59))).toBe('2026-10-17');
  });
});
