import { describe, expect, it } from 'vitest';
import { dailyScene, endlessScene } from '../src/games/wheres-the-ball/logic';
import { creatorName, dailyVariant, DAILY_BUCKETS, photoCredit, photoTitle } from '../src/games/wheres-the-ball/photo';
import { blendBall, type Pixels } from '../src/games/wheres-the-ball/photoPaint';
import { PHOTOS } from '../src/games/wheres-the-ball/photos';
import { H, W } from '../src/games/wheres-the-ball/scene';
import { closeRound, emptyWbSave, recordLevel, recordRound, sanitizeWb, saveWb } from '../src/games/wheres-the-ball/store';
import { addDays, hashString } from '../src/platform/dates';

const ids = (seed: number, n: number) => Array.from({ length: n }, (_, i) => endlessScene(seed, i).photo!.id);

describe("Where's the Ball? photo order", () => {
  it('never shows a photo twice in a challenge, nor in an Endless run while the library has new ones', () => {
    for (let s = 1; s <= 3000; s++) {
      const seed = (s * 2654435761) >>> 0;
      expect(new Set(ids(seed, 5)).size, `seed ${seed}`).toBe(5);
    }
    for (let s = 1; s <= 50; s++) expect(new Set(ids(s * 7919, 30)).size).toBe(30);
  });

  it('keeps the published dailies (to 2026-11-30) exactly as they were', () => {
    const s = Array.from({ length: 43 }, (_, d) => DAILY_BUCKETS.map((_, i) => `${dailyVariant(d, i)!.photo.id}@${dailyVariant(d, i)!.zoom}`).join(',')).join(';');
    expect(hashString(s)).toBe(1341675032);
  });

  it('rests a daily photo at least two weeks from 2026-12-01 on', () => {
    const last = new Map<string, number>();
    for (let d = 0; d < 400; d++)
      for (let i = 0; i < DAILY_BUCKETS.length; i++) {
        const id = dailyVariant(d, i)!.photo.id;
        if (d >= 43 && last.has(id)) expect(d - last.get(id)!, `${id} on day ${d}`).toBeGreaterThanOrEqual(14);
        last.set(id, d);
      }
  });
});

describe("Where's the Ball? names and credits", () => {
  it('shows short English place names and whole credits', () => {
    expect(photoTitle('58790422', 'Bad Pyrmont, Deutschland')).toBe('Misty forest path');
    expect(photoTitle('41097144', 'Park grass')).toBe('Park grass');
    expect(creatorName('Steve Sellers, East Carolina University. Credit: Collection of Frank Cantelas, N')).toBe('Steve Sellers, East Carolina University');
    expect(creatorName('Dave Kuehn/USFWS.')).toBe('Dave Kuehn/USFWS');
    expect(creatorName('Sebastian Unrau sebastian_unrau')).toBe('Sebastian Unrau');
    expect(creatorName('Unknown photographer')).toBe('');
    for (const p of PHOTOS) {
      const c = photoCredit(p.id)!.text;
      expect(c).not.toMatch(/\.\s·| [a-z0-9]+_[a-z0-9_]+ ·/);
      expect(photoTitle(p.id, p.title)).not.toMatch(/\d{2,}$|Deutschland|\bvan de\b|\buit de\b/);
    }
  });
});

/** A random "photo" and a ball sprite: an opaque disc of the ball's size plus a soft shadow, transparent elsewhere. */
function fixture(r: number, seed: number): { patch: Pixels; sprite: Pixels; orig: Uint8ClampedArray } {
  const size = Math.round(r * 4.4);
  const data = new Uint8ClampedArray(size * size * 4);
  let s = seed;
  for (let i = 0; i < data.length; i++) data[i] = (s = (s * 16807) % 2147483647) & 255;
  const sprite = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2, y - size / 2);
      const a = d <= r ? 255 : d <= r * 1.5 ? Math.round(80 * (1.5 - d / r)) : 0;
      sprite.set([210, 226, 60, a], (y * size + x) * 4);
    }
  return { patch: { data, width: size, height: size }, sprite: { data: sprite, width: size, height: size }, orig: data.slice() };
}

describe("Where's the Ball? render check of shots", () => {
  // The next 30 dailies and 100 challenge shots, with the ball at their real size in photo pixels.
  const shots = [
    ...Array.from({ length: 30 * 5 }, (_, n) => dailyScene(addDays('2026-11-03', Math.floor(n / 5)), n % 5)),
    ...Array.from({ length: 100 }, (_, n) => endlessScene(n * 104729, n % 5)),
  ];

  it('leaves the photo around the ball untouched (no tinted square or grain box)', () => {
    for (const sc of shots) {
      const r = Math.max(3, sc.ball.r * (1440 / W));
      const { patch, sprite, orig } = fixture(r, sc.seed % 2147483646 + 1);
      blendBall(patch, sprite, [40, 90, 30], sc.seed);
      const c = patch.width / 2;
      let ring = 0;
      let inside = 0;
      for (let y = 0; y < patch.height; y++)
        for (let x = 0; x < patch.width; x++) {
          const d = Math.hypot(x - c, y - c);
          const i = (y * patch.width + x) * 4;
          if (d > r * 1.6) ring += Math.abs(patch.data[i]! - orig[i]!) + Math.abs(patch.data[i + 1]! - orig[i + 1]!) + Math.abs(patch.data[i + 2]! - orig[i + 2]!);
          else if (d < r * 0.8) inside += Math.abs(patch.data[i + 1]! - orig[i + 1]!);
        }
      expect(ring, `seed ${sc.seed}`).toBe(0);
      expect(inside).toBeGreaterThan(0);
    }
  });

  it('keeps every ball inside the picture and below its photo ground line', () => {
    for (const sc of shots) {
      const b = sc.ball;
      const p = PHOTOS.find((x) => x.id === sc.photo!.id)!;
      expect(b.x - b.r).toBeGreaterThanOrEqual(0);
      expect(b.x + b.r).toBeLessThanOrEqual(W);
      expect(b.y + b.r).toBeLessThanOrEqual(H);
      const groundY = Math.max(0, (p.ground * H - sc.photo!.crop.y) / sc.photo!.crop.s);
      expect(b.y).toBeGreaterThanOrEqual(Math.min(H - b.r - 12, groundY));
    }
  });
});

describe("Where's the Ball? challenge rounds in the save", () => {
  const r = { found: true, score: 800, seconds: 9, wrong: 0, hints: 0 };

  it('records a round shot by shot and closes it', () => {
    let s = recordRound(emptyWbSave(), 'x:1', '2026-11-03', r, 0);
    s = recordRound(s, 'x:1', '2026-11-03', r, 0); // the same shot again (another tab): ignored
    expect(s.challenges['x:1']!.results).toHaveLength(1);
    s = closeRound(s, 'x:1', '2026-11-03', [r, r]);
    expect(recordRound(s, 'x:1', '2026-11-03', r, 2)).toBe(s);
    expect(s.challenges['x:1']!.done).toBe(true);
  });

  it('never records a daily shot twice', () => {
    const s = recordLevel(emptyWbSave(), r, '2026-11-03', 0);
    expect(recordLevel(s, r, '2026-11-03', 0)).toBe(s);
    expect(recordLevel(s, r, '2026-11-03', 1).daily['2026-11-03']).toHaveLength(2);
  });

  it('repairs bad rounds and drops ones older than a month', () => {
    const s = sanitizeWb({
      v: 1,
      challenges: {
        'a:1': { day: '2026-11-01', results: [r, { found: 'x' }], progress: { index: 1, wrong: [], hints: 9, ms: -5 } },
        'b:1': { day: 'nope', results: [] },
        'c:1': { day: '2026-09-01', results: [], progress: null },
        'd:1': null,
      },
    });
    expect(Object.keys(s.challenges)).toEqual(['a:1', 'c:1']);
    expect(s.challenges['a:1']).toMatchObject({ results: [r], progress: { index: 1, hints: 9, ms: 0 }, done: false });
    saveWb(s, '2026-11-03');
    expect(Object.keys(s.challenges)).toEqual(['a:1']);
    expect(sanitizeWb({ v: 1 }).challenges).toEqual({});
  });
});
