import { describe, expect, it } from 'vitest';
import { dailyScene, endlessScene } from '../src/games/wheres-the-ball/logic';
import { makePhotoScene, PHOTO_FROM as BALL_FROM } from '../src/games/wheres-the-ball/photo';
import { PHOTOS as BALL_PHOTOS, type Photo } from '../src/games/wheres-the-ball/photos';
import { H as BH, W as BW } from '../src/games/wheres-the-ball/scene';
import { addDays } from '../src/platform/dates';

/** A synthetic photo: busy spots on a jittered grid (what scripts/photos.mjs produces). */
function fakePhoto(seed: number, w: number, h: number): Omit<Photo, 'scale' | 'ground'> {
  const pts: Photo['pts'] = [];
  for (let i = 0; i < 48; i++) {
    const x = ((i % 8) + 0.5) * (w / 8) + ((seed * 13 + i * 7) % 11) - 5;
    const y = (Math.floor(i / 8) + 0.5) * (h / 6) + ((seed * 7 + i * 3) % 9) - 4;
    pts.push([Math.round(x), Math.round(y), 100 - ((i * 37 + seed) % 90), (i * 29) % 100, 20 + ((i * 17) % 70)]);
  }
  return { id: `fake${seed}`, title: 'Test photo', creator: '', license: 'cc0', source: '', pts };
}

const fakeBallPhoto = (seed: number, scale: number, ground: number) => ({ ...fakePhoto(seed, BW, BH), scale, ground });

describe("Where's the Ball? photo levels", () => {
  it('sizes the ball to the photo and zoom, keeps it inside the picture and on the ground', () => {
    for (let s = 1; s <= 80; s++) {
      for (const [scale, ground] of [[6, 0.5], [14, 0.2], [30, 0]] as const) {
        for (const zoom of [1, 0.8, 0.65]) {
          const sc = makePhotoScene(s * 31, s % 6, fakeBallPhoto(s, scale, ground), zoom);
          const b = sc.ball;
          expect(b.r).toBeCloseTo(Math.min(48, scale / zoom), 0);
          expect(b.x - b.r).toBeGreaterThanOrEqual(0);
          expect(b.x + b.r).toBeLessThanOrEqual(BW);
          expect(b.y + b.r).toBeLessThanOrEqual(BH);
          // Never above the ground line (in the zoomed window's coordinates).
          const groundY = Math.max(0, (ground * BH - sc.photo!.crop.y) / zoom);
          expect(b.y).toBeGreaterThanOrEqual(Math.min(BH - b.r - 12, groundY));
          if (sc.photo!.cover) expect(sc.photo!.cover.amt).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it('keeps the first published daily drawn, uses photos after, and never repeats a photo in an Endless run', () => {
    expect(dailyScene('2026-10-18', 0).photo).toBeUndefined();
    if (BALL_PHOTOS.length) {
      expect(dailyScene(BALL_FROM, 0).photo).toBeDefined();
      // Never the same photo at the same zoom twice in a run, and never the same photo twice in one day.
      const shots = Array.from({ length: 40 }, (_, i) => endlessScene(1234, i).photo!);
      expect(new Set(shots.map((p) => `${p.id}@${p.crop.s}`)).size).toBe(shots.length);
      const days = Array.from({ length: 10 }, (_, d) => Array.from({ length: 5 }, (_, i) => dailyScene(addDays(BALL_FROM, d), i).photo!.id));
      for (const ids of days) expect(new Set(ids).size).toBe(5);
    }
  });
});
