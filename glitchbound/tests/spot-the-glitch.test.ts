import { describe, expect, it } from 'vitest';
import { deltaE, hexToRgb } from '../src/games/color-recall/color';
import { COLORLESS, diffAt, DIFFS, makePuzzle, type Puzzle } from '../src/games/spot-the-glitch/diffs';
import { backdropAt } from '../src/games/spot-the-glitch/draw';
import {
  applyHint,
  challengeGen,
  dailyPuzzle,
  endStats,
  FAIR_FROM,
  rushEnd,
  giveUp,
  LOCK_MS,
  pictureScore,
  progressOf,
  resultOf,
  resumePicture,
  shareText,
  startPicture,
  tap,
  timePenalty,
} from '../src/games/spot-the-glitch/logic';
import { CLASSIC_THEMES, H, makeScene, THEME_IDS, W, type Obj } from '../src/games/spot-the-glitch/scene';
import { emptySgSave, loadSg, recordChallenge, recordPicture, sanitizeSg, saveSg, sgStats, STORE_KEY, updateSg } from '../src/games/spot-the-glitch/store';
import { bodyOf, changedOps, contrastWith, traceObj, type Box } from '../src/games/spot-the-glitch/trace';
import { addDays, hashString } from '../src/platform/dates';

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

/** The objects a puzzle changed, by id: [left, right] (one side is missing for a removed or added one). */
function changed(p: Puzzle): [Obj | undefined, Obj | undefined][] {
  const L = new Map(p.left.objects.map((o) => [o.id, o]));
  const R = new Map(p.right.objects.map((o) => [o.id, o]));
  return [...new Set([...L.keys(), ...R.keys()])].map((id) => [L.get(id), R.get(id)] as [Obj | undefined, Obj | undefined]).filter(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
}

const fairDailies = (days: number): Puzzle[] => Array.from({ length: days * 3 }, (_, i) => dailyPuzzle(addDays(FAIR_FROM, Math.floor(i / 3)), i % 3));
const inside = (s: { x: number; y: number; r: number }, x: number, y: number): boolean => Math.hypot(s.x - x, s.y - y) <= s.r + 0.5;

describe('fair differences (checked against what is drawn)', () => {
  it('keeps every daily before the fair generator picture for picture', () => {
    let all = '';
    for (let day = '2026-10-18'; day < FAIR_FROM; day = addDays(day, 1))
      all += [0, 1, 2].map((i) => {
        const p = dailyPuzzle(day, i);
        return JSON.stringify([p.left, p.right, p.diffs.map((d) => d.type)]);
      }).join('|');
    // The pictures as published (and played) before this generator; only their hit circles were refitted.
    expect(hashString(all).toString(16)).toBe('b555c561');
   }, 60_000);

  it('never puts a color difference on a kind that does not draw its color (bubbles)', () => {
    const puzzles = [...Array.from({ length: 2000 }, (_, s) => makePuzzle(s + 1, s % 3, undefined)), ...fairDailies(365)];
    let bubbles = 0;
    for (const p of puzzles)
      for (const [a, b] of changed(p)) {
        if (a?.kind === 'bubbles' || b?.kind === 'bubbles') bubbles++;
        if (a && b && a.c !== b.c) expect(COLORLESS.has(a.kind), `${p.seed} ${a.kind}`).toBe(false);
      }
    // Bubbles still take part in other differences (scale, move, missing, extra).
    expect(bubbles).toBeGreaterThan(0);
    // The old reef picture of 2026-12-08 (an invisible bubbles color change) is now fair.
    expect(changed(dailyPuzzle('2026-12-08', 0)).some(([a, b]) => a && b && a.kind === 'bubbles' && a.c !== b.c)).toBe(false);
  }, 60_000);

  it('makes every difference change the drawing, with a hit circle over the change', () => {
    for (const p of [...fairDailies(60), ...Array.from({ length: 300 }, (_, s) => makePuzzle((s * 2654435761) >>> 0, s % 3))]) {
      expect(p.diffs.length).toBe(DIFFS);
      const spots = p.diffs.flatMap((d) => d.spots);
      for (const [a, b] of changed(p)) {
        const ch = changedOps(a ? traceObj(a) : [], b ? traceObj(b) : []).filter((op) => !op.faint);
        expect(ch.length, `${p.seed} ${(a ?? b)!.kind}`).toBeGreaterThan(0);
        if (a && b && a.x !== b.x) continue; // a move: one circle on each place (below)
        const box = bodyOf(ch)!;
        const cx = (box.x0 + box.x1) / 2;
        const cy = (box.y0 + box.y1) / 2;
        // The whole change is within a finger's reach of one hit circle.
        expect(spots.some((s) => inside(s, cx, cy) && s.r >= Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2), `${p.seed} ${(a ?? b)!.kind}`).toBe(true);
      }
    }
  }, 60_000);

  it('never hides a difference behind something drawn on top of it (stars behind buildings)', () => {
    const cover = (objects: Obj[], o: Obj, box: Box): number => {
      const later = objects.slice(objects.indexOf(o) + 1).map((f) => bodyOf(traceObj(f))!);
      let hidden = 0;
      for (let i = 0; i < 10; i++)
        for (let j = 0; j < 10; j++) {
          const x = box.x0 + ((i + 0.5) / 10) * (box.x1 - box.x0);
          const y = box.y0 + ((j + 0.5) / 10) * (box.y1 - box.y0);
          if (later.some((b) => x > b.x0 + 3 && x < b.x1 - 3 && y > b.y0 + 3 && y < b.y1 - 3)) hidden++;
        }
      return hidden / 100;
    };
    let stars = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makePuzzle(seed * 7919, seed % 3, 'night');
      for (const [a, b] of changed(p)) {
        if ((a ?? b)!.kind === 'star') stars++;
        if (a) expect(cover(p.left.objects, a, bodyOf(traceObj(a))!), `${seed} ${a.kind}`).toBeLessThan(0.5);
        if (b) expect(cover(p.right.objects, b, bodyOf(traceObj(b))!), `${seed} ${b.kind}`).toBeLessThan(0.5);
      }
    }
    expect(stars).toBeGreaterThan(50);
  }, 60_000);

  it('gives jungle weeds colors that stand out from the ground', () => {
    let weeds = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const scene = makeScene(seed, 'jungle', (seed % 3) / 2, true);
      for (const o of scene.objects.filter((x) => x.kind === 'weed')) {
        weeds++;
        expect(deltaE(hexToRgb(o.c), backdropAt(scene, o.y))).toBeGreaterThan(25);
      }
      const p = makePuzzle(seed * 104729, seed % 3, 'jungle');
      // Any changed object's shape stands out from what is behind it.
      for (const [a, b] of changed(p)) {
        const o = (a ?? b)!;
        if (a && b && a.c !== b.c) continue;
        expect(contrastWith(traceObj(o), backdropAt(p.left, o.y)), `${seed} ${o.kind}`).toBeGreaterThanOrEqual(15);
      }
    }
    expect(weeds).toBeGreaterThan(500);
  }, 60_000);

  it('refits older pictures\' hit circles to tall and offset drawings (building tops)', () => {
    // 2026-11-04 #1: a recolored building; its circle used to sit on the building's base.
    const p = dailyPuzzle('2026-11-04', 0);
    const [a] = changed(p).find(([x, y]) => x?.kind === 'building' && y && x.c !== y.c)!;
    const body = bodyOf(traceObj(a!))!;
    const s = p.diffs.flatMap((d) => d.spots).find((t) => inside(t, a!.x, (body.y0 + body.y1) / 2))!;
    const top = body.y0;
    expect(s.y).toBeLessThan(a!.y - 10);
    expect(inside({ ...s, r: s.r + 4 }, a!.x, top + 4)).toBe(true);
    // Refitted circles still never overlap, in every old daily.
    for (let day = '2026-10-18'; day < FAIR_FROM; day = addDays(day, 1))
      for (let i = 0; i < 3; i++) {
        const q = dailyPuzzle(day, i);
        q.diffs.forEach((d, j) =>
          q.diffs.forEach((e, k) => {
            if (j >= k) return;
            for (const s1 of d.spots) for (const s2 of e.spots) expect(Math.hypot(s1.x - s2.x, s1.y - s2.y)).toBeGreaterThan(s1.r + s2.r);
          }),
        );
      }
   }, 60_000);

  it('builds challenges started from the fair day with the fair generator, older ones as before', () => {
    expect(challengeGen('')).toBe('v1');
    expect(challengeGen('2026-11-20')).toBe('v1');
    expect(challengeGen(FAIR_FROM)).toBe('fair');
  });

  it('reports a Rush run apart from the daily (its own rush stat)', () => {
    const r = { score: 0, found: 5, misses: 0, hints: 0, seconds: 25 };
    expect(rushEnd([r, r, { ...r, found: 2 }], 2, 12)).toEqual({ score: 1700, stats: { found: 12, pictures: 2, rush: 1700 } });
  });

  it('keeps easy pictures to bold changes', () => {
    for (let seed = 1; seed <= 300; seed++) for (const d of makePuzzle(seed, 0).diffs) expect(['color', 'remove', 'add', 'scale']).toContain(d.type);
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
    // The time penalty uses the same rounded seconds the breakdown shows (22.6 s reads 23 s: −12).
    const quick = { ...startPicture(p, 0), found: [0, 1, 2, 3, 4], finishedAt: 22_600 };
    expect(resultOf(quick)).toMatchObject({ seconds: 23, score: 1000 - timePenalty(23) });
    const slow = { ...s, misses: Array.from({ length: 30 }, (_, i) => ({ x: 0, y: 0, at: i })) };
    expect(pictureScore(slow, 30_000)).toBe(500);
  });

  it('resumes an unfinished picture with its finds, misses, hints and clock (no fresh start)', () => {
    let s = startPicture(p, 1000);
    s = tap(s, at(0).x, at(0).y, 0, 3000).state;
    for (let i = 0; i < 2; i++) s = tap(s, -50, -50, 0, 4000 + i).state;
    s = applyHint(s);
    const saved = progressOf(s, 9000);
    expect(saved).toMatchObject({ found: [0], hints: 1, hinted: 1, ms: 8000 });

    const back = resumePicture(p, 50_000, saved);
    expect(back).toMatchObject({ found: [0], hints: 1, hinted: 1, startedAt: 42_000, finishedAt: null });
    expect(back.misses.length).toBe(2);
    // Old misses still cost points but don't count toward the tap-spam lock.
    expect(tap(back, -50, -50, 0, 50_001).state.lockedUntil).toBe(0);
    let done = back;
    for (let i = 1; i < DIFFS; i++) done = tap(done, at(i).x, at(i).y, 0, 52_000).state;
    expect(resultOf(done)).toMatchObject({ found: DIFFS, misses: 2, hints: 1, seconds: 10 });
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

  it('keeps an unfinished daily picture until it is recorded', () => {
    const progress = { day: '2026-10-18', index: 1, found: [2, 9, 'x'], misses: [{ x: 1, y: 2 }, { x: 'a' }], hints: 1, hinted: 3, ms: 12_345.6 };
    const s = sanitizeSg({ v: 1, progress });
    expect(s.progress).toEqual({ day: '2026-10-18', index: 1, found: [2], misses: [{ x: 1, y: 2 }], hints: 1, hinted: 3, ms: 12_345 });
    expect(sanitizeSg({ v: 1, progress: { day: 'soon', found: [], misses: [] } }).progress).toBeNull();
    const r = { score: 900, found: 5, misses: 0, hints: 0, seconds: 25 };
    expect(recordPicture(s, r, '2026-10-18').progress).toBeNull();
    // Relax pictures leave it alone.
    expect(recordPicture(s, r, null, true).progress).toEqual(s.progress);
  });

  it('keeps challenge rounds (cleaned, pruned like dailies) and never records a daily picture twice', () => {
    const r = { score: 900, found: 5, misses: 0, hints: 0, seconds: 25 };
    const s = sanitizeSg({
      v: 1,
      challenges: {
        'a:1': { day: '2026-12-01', results: [r, { score: 'x' }], progress: { found: [1, 7], misses: [], hints: 2, hinted: null, ms: 4000 }, reported: 'yes' },
        'b:1': { day: 'later', results: [] },
        'c:2': 'junk',
      },
    });
    expect(s.challenges).toEqual({ 'a:1': { day: '2026-12-01', results: [r], progress: { found: [1], misses: [], hints: 2, hinted: null, ms: 4000 }, reported: false } });
    expect(sanitizeSg({ v: 1, challenges: 7 }).challenges).toEqual({});
    const next = recordChallenge(s, 'a:1', '2026-12-02', { reported: true });
    expect(next.challenges['a:1']).toMatchObject({ day: '2026-12-01', reported: true });
    saveSg(recordChallenge(next, 'old:1', '2025-01-01', {}), '2026-12-02');
    expect(Object.keys(loadSg().challenges)).toEqual(['a:1']);

    // Picture 1 of a day recorded in another tab: recording it again (as picture 1) changes nothing.
    const once = recordPicture(emptySgSave(), r, '2026-12-01', false, 0);
    expect(recordPicture(once, r, '2026-12-01', false, 0)).toBe(once);
    expect(recordPicture(once, r, '2026-12-01', false, 1).daily['2026-12-01']).toHaveLength(2);
  });

  it('writes on top of what another tab stored, not over it', () => {
    localStorage.removeItem(STORE_KEY);
    const r = { score: 900, found: 5, misses: 0, hints: 0, seconds: 25 };
    // This tab loaded an empty save; another tab then finished a daily picture.
    const stale = loadSg();
    saveSg(recordPicture(emptySgSave(), r, '2026-12-01'), '2026-12-01');
    updateSg((s) => ({ ...s, muted: !stale.muted }), '2026-12-01');
    expect(loadSg()).toMatchObject({ muted: true, daily: { '2026-12-01': [r] } });
    localStorage.setItem(STORE_KEY, '{nope');
    expect(loadSg()).toEqual(emptySgSave());
  });
});
