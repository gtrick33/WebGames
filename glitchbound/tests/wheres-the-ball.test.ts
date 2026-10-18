import { describe, expect, it } from 'vitest';
import { aim, confirm, dailyScene, endStats, giveUp, hint, levelScore, MAX_HINTS, resultOf, shareText, squareFor, startLevel, TRIES } from '../src/games/wheres-the-ball/logic';
import { ballRadius, ENV_IDS, H, hintBox, isHit, ITEM_R, makeScene, rng, W, warmth } from '../src/games/wheres-the-ball/scene';
import { emptyWbSave, recordLevel, sanitizeWb, wbStats } from '../src/games/wheres-the-ball/store';

describe('scenes', () => {
  it('is deterministic per seed and per daily', () => {
    expect(makeScene(12, 2)).toEqual(makeScene(12, 2));
    expect(dailyScene('2026-10-18', 3)).toEqual(dailyScene('2026-10-18', 3));
    expect(dailyScene('2026-10-18', 3).ball).not.toEqual(dailyScene('2026-10-19', 3).ball);
  });

  it('keeps the ball inside the picture and never under a decoy', () => {
    for (let seed = 1; seed < 300; seed++) {
      const s = makeScene(seed, seed % 6);
      expect(s.ball.x).toBeGreaterThanOrEqual(50);
      expect(s.ball.x).toBeLessThanOrEqual(W - 50);
      expect(s.ball.y).toBeGreaterThanOrEqual(50);
      expect(s.ball.y).toBeLessThanOrEqual(H - 50);
      // Only one deliberate partial cover may overlap the ball, and its centre stays off the ball.
      const covering = s.over.filter((it) => Math.hypot(it.x - s.ball.x, it.y - s.ball.y) < ITEM_R[it.kind] * it.s + s.ball.r);
      expect(covering.length).toBeLessThanOrEqual(1);
      for (const c of covering) expect(Math.hypot(c.x - s.ball.x, c.y - s.ball.y)).toBeGreaterThan(s.ball.r * 0.3);
    }
  });

  it('gets harder: smaller balls and more clutter', () => {
    expect(ballRadius(0)).toBeGreaterThan(ballRadius(4));
    expect(ballRadius(40)).toBeGreaterThanOrEqual(5.5);
    const easy = makeScene(3, 0);
    const hard = makeScene(3, 4);
    expect(hard.under.length + hard.over.length).toBeGreaterThan(easy.under.length + easy.over.length);
    expect(ENV_IDS.length).toBe(6);
  });

  it('hits within the ball (with finger slop), says hot or cold otherwise', () => {
    const s = makeScene(8, 2);
    expect(isHit(s, s.ball.x, s.ball.y)).toBe(true);
    expect(isHit(s, s.ball.x + s.ball.r * 1.4, s.ball.y)).toBe(true);
    expect(isHit(s, s.ball.x + s.ball.r * 3, s.ball.y)).toBe(false);
    expect(isHit(s, s.ball.x + s.ball.r * 3, s.ball.y, s.ball.r * 2)).toBe(true);
    expect(warmth(s, s.ball.x + 40, s.ball.y)).toBe('hot');
    expect(warmth(s, s.ball.x + 400, s.ball.y > 300 ? 0 : H)).toBe('cold');
  });

  it('puts the ball inside every hint box', () => {
    for (let seed = 1; seed < 100; seed++) {
      const s = makeScene(seed, 3);
      for (const lvl of [1, 2]) {
        const box = hintBox(s, lvl, rng(seed));
        expect(s.ball.x).toBeGreaterThanOrEqual(box.x);
        expect(s.ball.x).toBeLessThanOrEqual(box.x + box.w);
        expect(s.ball.y).toBeGreaterThanOrEqual(box.y);
        expect(s.ball.y).toBeLessThanOrEqual(box.y + box.h);
      }
    }
  });
});

describe('aiming and confirming', () => {
  const scene = makeScene(21, 1);

  it('a tap only aims; nothing counts until it is confirmed', () => {
    let s = startLevel(scene, 0);
    s = aim(s, 5, 5);
    expect(s.wrong.length).toBe(0);
    s = aim(s, scene.ball.x, scene.ball.y);
    s = confirm(s, 0, 4000);
    expect(s.outcome).toBe('found');
    expect(levelScore(s)).toBe(960);
    expect(confirm(s, 0, 5000)).toBe(s);
  });

  it('allows three tries, then reveals', () => {
    let s = startLevel(scene, 0);
    expect(confirm(s, 0, 10)).toBe(s); // nothing aimed
    for (let i = 0; i < TRIES; i++) s = confirm(aim(s, scene.ball.x > 400 ? 20 : 780, 20 + i), 0, 100);
    expect(s.outcome).toBe('missed');
    expect(levelScore(s)).toBe(0);
  });

  it('charges for wrong guesses and hints, with a floor for a find', () => {
    let s = startLevel(scene, 0);
    s = confirm(aim(s, scene.ball.x > 400 ? 20 : 780, 20), 0, 10);
    s = hint(hint(hint(s)));
    expect(s.hints).toBe(MAX_HINTS);
    s = confirm(aim(s, scene.ball.x, scene.ball.y), 0, 1000);
    expect(levelScore(s)).toBe(400 + 590 - 150 - 400);
    const slow = confirm(aim(startLevel(scene, 0), scene.ball.x, scene.ball.y), 0, 600_000);
    expect(levelScore(slow)).toBe(400);
    expect(resultOf(giveUp(startLevel(scene, 0), 5))).toMatchObject({ found: false, score: 0 });
  });

  it('shares only emoji squares and totals', () => {
    const quick = { found: true, score: 950, seconds: 5, wrong: 0, hints: 0 };
    const helped = { found: true, score: 500, seconds: 30, wrong: 1, hints: 0 };
    const miss = { found: false, score: 0, seconds: 60, wrong: 3, hints: 0 };
    expect([quick, helped, miss].map(squareFor).join('')).toBe('🎾🟨🟥');
    expect(shareText('2026-10-18', [quick, helped, miss], 0, 'https://x.test')).toContain('2/5 found');
    expect(endStats([quick, miss])).toEqual({ score: 950, stats: { found: 1, fastest: 5 } });
  });
});

describe('saves', () => {
  it('records dailies and repairs bad data', () => {
    const r = { found: true, score: 800, seconds: 12.5, wrong: 0, hints: 0 };
    let s = emptyWbSave();
    for (let i = 0; i < 5; i++) s = recordLevel(s, r, '2026-10-18');
    expect(wbStats(s, '2026-10-18')).toMatchObject({ played: 1, streak: 1, best: 4000, perfect: 1 });
    expect(s.fastest).toBe(12.5);
    expect(sanitizeWb({ v: 1, daily: { '2026-10-18': [{ found: 'yes' }, { found: true, score: 99999 }] } }).daily['2026-10-18']).toEqual([
      { found: true, score: 1000, seconds: 0, wrong: 0, hints: 0 },
    ]);
  });
});
