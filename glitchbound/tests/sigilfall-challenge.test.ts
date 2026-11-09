/** The campaign is hard: foes grow tougher than their level from level 4, the opening night stays as it was. */
import { describe, expect, it } from 'vitest';
import { challenge } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

describe('sigilfall: a hard campaign', () => {
  it('leaves the first levels as they were, and is at full strength by level 7', () => {
    for (const l of [1, 2, 3]) expect(challenge(l, false)).toEqual({ hp: 1, dmg: 1 });
    expect(challenge(7, false)).toEqual({ hp: 1.3, dmg: 1.4 });
    expect(challenge(40, true)).toEqual({ hp: 1.4, dmg: 1.45 });
    const mid = challenge(5, false);
    expect(mid.hp).toBeGreaterThan(1);
    expect(mid.hp).toBeLessThan(1.3);
  });

  it('a foe in the campaign is tougher than the same foe on Heroic would be without it (Heroic keeps its own measure)', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const heroic = newWorld('thornvale', readyHero('warrior', 12), 1, 1);
    const a = w.addEnemy('tusk-boar', 0, 0, 12, { room: -1, pack: -1 });
    const b = heroic.addEnemy('tusk-boar', 0, 0, 12, { room: -1, pack: -1 });
    expect(a.maxHp).toBeGreaterThan(Math.round(b.maxHp / 1.9) * 1.25);
    expect(a.dmg).toBeGreaterThan((b.dmg / 1.4) * 1.35);
  });
});
