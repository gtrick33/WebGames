import { describe, expect, it } from 'vitest';
import { dailyRounds, practiceRounds, rng as crRng, WILD_FROM } from '../src/games/color-recall/logic';
import { targetById, wildTarget } from '../src/games/color-recall/targets';
import { ANSWER_LIST, dailySecret } from '../src/games/letter-pinch/logic';
import { perfectSeed } from '../src/games/memory-grid/pattern';
import { RANDOM_ID, randomTrack } from '../src/games/mini-racer/daily';
import { buildTrack, validateTrack } from '../src/games/mini-racer/track';
import { addDays } from '../src/platform/dates';

describe('Color Recall stays fresh', () => {
  it('keeps the launch daily unchanged and adds a wild card from WILD_FROM', () => {
    expect(dailyRounds('2026-10-18').every((r) => !r.target.id.startsWith('wild-'))).toBe(true);
    const later = dailyRounds(WILD_FROM);
    expect(later[later.length - 1]!.target.id.startsWith('wild-')).toBe(true);
  });

  it('never repeats a curated colour within a week', () => {
    let day = WILD_FROM;
    const history: string[][] = [];
    for (let i = 0; i < 120; i++) {
      const ids = dailyRounds(day).map((r) => r.target.id).filter((id) => !id.startsWith('wild-'));
      for (const prev of history.slice(-7)) for (const id of ids) expect(prev).not.toContain(id);
      history.push(ids);
      day = addDays(day, 1);
    }
  });

  it('resolves saved wild cards back to the same named colour', () => {
    const w = wildTarget('#3A9F7C');
    expect(targetById(w.id)).toEqual(w);
    expect(w.name.split(' ').length).toBe(3);
    const practice = practiceRounds(crRng(5));
    expect(practice.filter((r) => r.target.id.startsWith('wild-')).length).toBe(2);
  });
});

describe('Letter Pinch never loops', () => {
  it('reshuffles the word list on each pass, keeping the first pass as it was', () => {
    const len = ANSWER_LIST.length;
    const start = '2026-10-18';
    const firstPass = Array.from({ length: 30 }, (_, i) => dailySecret(addDays(start, i)));
    const secondPass = Array.from({ length: 30 }, (_, i) => dailySecret(addDays(start, len + i)));
    expect(secondPass).not.toEqual(firstPass);
    const pass2 = new Set(Array.from({ length: len }, (_, i) => dailySecret(addDays(start, len + i))));
    expect(pass2.size).toBe(len);
  });
});

describe('Memory Grid Perfect Recall rotates weekly', () => {
  it('is the same Monday to Sunday and new the next week', () => {
    expect(perfectSeed('2026-10-19')).toBe(perfectSeed('2026-10-25'));
    expect(perfectSeed('2026-10-25')).not.toBe(perfectSeed('2026-10-26'));
  });
});

describe('Mini Racer random tracks', () => {
  it('generates valid, different tracks on demand', () => {
    const a = randomTrack(1);
    const b = randomTrack(2);
    expect(a.id).toBe(RANDOM_ID);
    expect(a.points).not.toEqual(b.points);
    expect(validateTrack(buildTrack(a))).toEqual([]);
    expect(a.par).toBeGreaterThan(0);
  });
});
