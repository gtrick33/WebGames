import { describe, expect, it } from 'vitest';
import { dailyVariant, DAILY_BUCKETS, PHOTO_REST_DAYS } from '../src/games/wheres-the-ball/photo';

describe("Where's the Ball: daily photos rest before they come back", () => {
  it('never shows a photo twice in a day, and almost never again within three weeks', () => {
    const last = new Map<string, number>();
    const gaps: number[] = [];
    for (let d = 0; d < 365; d++) {
      const ids = DAILY_BUCKETS.map((_, i) => dailyVariant(d, i)!.photo.id);
      expect(new Set(ids).size, `day ${d}`).toBe(ids.length);
      for (const id of ids) {
        if (last.has(id)) gaps.push(d - last.get(id)!);
        last.set(id, d);
      }
    }
    const early = gaps.filter((g) => g < PHOTO_REST_DAYS).length;
    expect(early / gaps.length).toBeLessThan(0.01);
  });

  it('is the same schedule however it is asked for (any day first)', () => {
    const late = dailyVariant(200, 4)!;
    expect(dailyVariant(200, 4)).toEqual(late);
    expect(dailyVariant(3, 0)).toBeTruthy();
  });
});
