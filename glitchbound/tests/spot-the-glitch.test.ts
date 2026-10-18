import { describe, expect, it } from 'vitest';
import { diffAt, DIFFS, makePuzzle } from '../src/games/spot-the-glitch/diffs';
import {
  applyHint,
  dailyPuzzle,
  endStats,
  giveUp,
  LOCK_MS,
  pictureScore,
  resultOf,
  shareText,
  startPicture,
  tap,
  timePenalty,
} from '../src/games/spot-the-glitch/logic';
import { CLASSIC_THEMES, H, makeScene, THEME_IDS, W } from '../src/games/spot-the-glitch/scene';
import { emptySgSave, recordPicture, sanitizeSg, sgStats } from '../src/games/spot-the-glitch/store';
import { addDays } from '../src/platform/dates';

describe('pictures and differences', () => {
  it('generates the same picture from the same seed', () => {
    expect(makeScene(7, 'meadow')).toEqual(makeScene(7, 'meadow'));
    expect(makePuzzle(99, 1)).toEqual(makePuzzle(99, 1));
    expect(dailyPuzzle('2026-10-18', 2)).toEqual(dailyPuzzle('2026-10-18', 2));
    expect(dailyPuzzle('2026-10-18', 0)).not.toEqual(dailyPuzzle('2026-10-19', 0));
  });

  it('always has exactly five separate, in-bounds differences', () => {
    for (let seed = 1; seed < 400; seed++) {
      const p = makePuzzle(seed, seed % 3);
      expect(p.diffs.length).toBe(DIFFS);
      const spots = p.diffs.flatMap((d) => d.spots);
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(W);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(H);
        expect(s.r).toBeGreaterThanOrEqual(20);
      }
      // Different differences never overlap, so one tap can only find one.
      p.diffs.forEach((a, i) =>
        p.diffs.forEach((b, j) => {
          if (i >= j) return;
          for (const s of a.spots) for (const t of b.spots) expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeGreaterThan(s.r + t.r);
        }),
      );
    }
  });

  it('gives every theme, at every difficulty, five separate differences', () => {
    for (const th of THEME_IDS)
      for (let seed = 1; seed < 40; seed++) {
        const p = makePuzzle(seed * 7919, seed % 3, th);
        expect(p.diffs.length, th).toBe(DIFFS);
        expect(p.left.theme).toBe(th);
        const spots = p.diffs.flatMap((d) => d.spots);
        for (const s of spots) {
          expect(s.x).toBeGreaterThan(0);
          expect(s.x).toBeLessThan(W);
          expect(s.y).toBeGreaterThan(0);
          expect(s.y).toBeLessThan(H);
        }
        p.diffs.forEach((a, i) =>
          p.diffs.forEach((b, j) => {
            if (i >= j) return;
            for (const s of a.spots) for (const t of b.spots) expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeGreaterThan(s.r + t.r);
          }),
        );
      }
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(13);
  });

  it('keeps the first published dailies on the classic themes', () => {
    for (let i = 0; i < 3; i++) expect(CLASSIC_THEMES).toContain(dailyPuzzle('2026-10-18', i).left.theme);
    const later = new Set(Array.from({ length: 90 }, (_, d) => dailyPuzzle(addDays('2026-10-19', Math.floor(d / 3)), d % 3).left.theme));
    expect(later.size).toBeGreaterThan(8);
  });

  it('really changes the picture', () => {
    for (let seed = 1; seed < 50; seed++) {
      const p = makePuzzle(seed, 1);
      expect(JSON.stringify(p.left.objects)).not.toBe(JSON.stringify(p.right.objects));
      expect(p.left.theme).toBe(p.right.theme);
    }
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(5);
  });

  it('finds the difference under a tap', () => {
    const p = makePuzzle(5, 0);
    const s = p.diffs[2]!.spots[0]!;
    expect(diffAt(p, s.x, s.y)).toBe(2);
    expect(diffAt(p, s.x + s.r + 30, s.y, 0) === 2).toBe(false);
  });
});

describe('taps, hints and scoring', () => {
  const p = makePuzzle(11, 1);
  const at = (i: number) => p.diffs[i]!.spots[0]!;

  it('finds each difference once and finishes after five', () => {
    let s = startPicture(p, 0);
    for (let i = 0; i < DIFFS; i++) {
      const r = tap(s, at(i).x, at(i).y, 0, 1000 * (i + 1));
      expect(r.outcome).toBe('found');
      s = r.state;
      if (i === 0) expect(tap(s, at(0).x, at(0).y, 0, 1500).outcome).toBe('again');
    }
    expect(s.finishedAt).toBe(5000);
    expect(pictureScore(s, 5000)).toBe(1000);
    expect(tap(s, 1, 1, 0, 6000).outcome).toBe('ignored');
  });

  it('locks taps after three quick misses', () => {
    let s = startPicture(p, 0);
    const far = { x: -100, y: -100 };
    for (let i = 0; i < 3; i++) s = tap(s, far.x, far.y, 0, 100 * i).state;
    expect(s.lockedUntil).toBe(200 + LOCK_MS);
    expect(tap(s, at(0).x, at(0).y, 0, 500).outcome).toBe('locked');
    expect(tap(s, at(0).x, at(0).y, 0, 200 + LOCK_MS).outcome).toBe('found');
  });

  it('charges for misses, hints and time, and keeps a floor for a full solve', () => {
    let s = startPicture(p, 0);
    s = tap(s, -50, -50, 0, 10).state;
    s = applyHint(s);
    expect(s.hinted).toBe(0);
    expect(applyHint(s)).toBe(s);
    for (let i = 0; i < DIFFS; i++) s = tap(s, at(i).x, at(i).y, 0, 30_000).state;
    expect(pictureScore(s, 30_000)).toBe(1000 - 40 - 150 - timePenalty(30));
    expect(timePenalty(10)).toBe(0);
    expect(timePenalty(1000)).toBe(400);
    const slow = { ...s, misses: Array.from({ length: 30 }, (_, i) => ({ x: 0, y: 0, at: i })) };
    expect(pictureScore(slow, 30_000)).toBe(500);
  });

  it('scores 100 per difference when giving up', () => {
    let s = startPicture(p, 0);
    s = tap(s, at(0).x, at(0).y, 0, 10).state;
    s = giveUp(s, 20);
    expect(resultOf(s)).toMatchObject({ score: 100, found: 1 });
  });

  it('shares without giving away where the glitches are', () => {
    const r = { score: 900, found: 5, misses: 1, hints: 0, seconds: 31 };
    const text = shareText('2026-10-20', [r, r, r], 3, 'https://x.test');
    expect(text).toContain('Spot the Glitch #3');
    expect(text).toContain('2,700');
    expect(endStats([r, { ...r, misses: 0 }])).toEqual({ score: 1800, stats: { found: 10, clean: 1 } });
  });
});

describe('saves', () => {
  it('tracks dailies, streaks and fastest clean pictures', () => {
    const r = { score: 900, found: 5, misses: 0, hints: 0, seconds: 25 };
    let s = emptySgSave();
    for (let i = 0; i < 3; i++) s = recordPicture(s, r, '2026-10-18');
    expect(sgStats(s, '2026-10-19')).toMatchObject({ played: 1, streak: 1, best: 2700 });
    expect(s.fastest).toBe(25);
    expect(sanitizeSg({ v: 1, daily: { '2026-10-18': [{ score: 5000, found: 9 }] } }).daily['2026-10-18']![0]).toMatchObject({ score: 1000, found: 5 });
  });
});
