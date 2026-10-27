import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/games/sigilfall/data/themes';
import type { Theme } from '../src/games/sigilfall/data/types';
import { moodOf } from '../src/games/sigilfall/render/atmosphere';

/** Every land has an air of its own (VISUAL_BIBLE.md §1); indoors there is no sun or sky. */
describe('Sigilfall: every land has a mood', () => {
  it('outdoors gets light and weather, indoors only the grade and the vignette', () => {
    for (const [theme, look] of Object.entries(THEMES) as [Theme, (typeof THEMES)[Theme]][]) {
      const m = moodOf(theme, look.indoor);
      expect(m.vignette, theme).toBeGreaterThan(0);
      expect(m.desat, theme).toBeLessThan(0.4);
      if (look.indoor) {
        expect(m.sun, theme).toBeNull();
        expect(m.clouds, theme).toBe(0);
      }
    }
    expect(moodOf('village', false).sun).toBeTruthy();
    expect(moodOf('barrow', false).sun).toBeNull();
  });
});
