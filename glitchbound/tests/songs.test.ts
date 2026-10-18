import { describe, expect, it } from 'vitest';
import { HOLIDAYS } from '../src/platform/seasons';
import { SONGS } from '../src/platform/songs';

describe('holiday lobby music', () => {
  it('has a loop for every holiday look: whole bars of eighth notes in a sensible range', () => {
    for (const h of HOLIDAYS) {
      const song = SONGS[h.id];
      expect(song, h.id).toBeTruthy();
      expect(song.bpm).toBeGreaterThan(60);
      expect(song.bpm).toBeLessThan(160);
      expect(song.bars.length % 4, h.id).toBe(0);
      for (const [root, chord, lead] of song.bars) {
        expect(lead, h.id).toHaveLength(8);
        expect(root).toBeGreaterThanOrEqual(30);
        expect(root).toBeLessThanOrEqual(50);
        for (const m of [...chord, ...lead]) if (m !== null) expect(m >= 48 && m <= 90, `${h.id}: ${m}`).toBe(true);
      }
    }
  });
});
