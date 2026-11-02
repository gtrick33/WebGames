import { describe, expect, it } from 'vitest';
import { angleDiff, dist } from '../src/games/sigilfall/core/math';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { SkillSpec } from '../src/games/sigilfall/data/types';
import { resolveAim, tapAutoAims, type CastRequest } from '../src/games/sigilfall/sim/cast';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Owner, 2026-10: on a phone a tapped skill should aim like the basic attack does (at the nearest enemy);
 * a drag still aims by hand. Blinks and dashes keep the stick's direction unless they are gap-closers.
 */

const spec = (id: string): SkillSpec => SKILLS[id]!.base;
const tap = (slot: CastRequest['slot'] = 's1'): CastRequest => ({ slot, angle: null, dist: null, assist: 0 });

/** A mage in an empty field facing right (angle 0), one enemy straight below at `d` px (90 degrees off the facing). */
function field(d = 90): { w: World; ex: number; ey: number } {
  const w = newWorld('whisperwood', readyHero('mage', 20), 3);
  w.enemies = [];
  const p = w.player;
  p.aim = 0;
  const e = w.addEnemy('moss-slime', p.x, p.y + d, 12, { room: -1, pack: 0, elite: false });
  e.state = 'chase';
  return { w, ex: e.x, ey: e.y };
}

describe('Sigilfall auto-aim for tapped skills', () => {
  it('picks which skills turn at the enemy when tapped', () => {
    expect(tapAutoAims(spec('fireball'))).toBe(true);
    expect(tapAutoAims(spec('gravity-well'))).toBe(true);
    expect(tapAutoAims(spec('blink'))).toBe(false);
    expect(tapAutoAims(spec('frost-nova'))).toBe(false);
    expect(tapAutoAims(spec('arcane-barrier'))).toBe(false);
    expect(tapAutoAims(spec('grapple-line'))).toBe(false);
    // a gap-closer marked in its kit
    expect(tapAutoAims(spec('charge'))).toBe(true);
  });

  it('a tapped Fireball flies at the enemy, not along the facing', () => {
    const { w, ex, ey } = field();
    const a = resolveAim(w, spec('fireball'), tap())!;
    expect(Math.abs(angleDiff(a.angle, Math.atan2(ey - w.player.y, ex - w.player.x)))).toBeLessThan(0.01);
    expect(a.target).not.toBeNull();
  });

  it('a tapped ground spell lands on the enemy', () => {
    const { w, ex, ey } = field();
    const s = spec('gravity-well');
    const a = resolveAim(w, s, tap())!;
    expect(dist(a.tx, a.ty, ex, ey)).toBeLessThan(s.area);
  });

  it('Blink keeps the facing', () => {
    const { w } = field(60);
    const a = resolveAim(w, spec('blink'), tap())!;
    expect(a.angle).toBe(0);
  });

  it('with no enemy in reach, or the setting off, a tap goes along the facing', () => {
    const far = field(600);
    expect(resolveAim(far.w, spec('fireball'), tap())!.angle).toBe(0);
    const off = field();
    off.w.settings = { ...off.w.settings, autoAimSkills: false };
    expect(resolveAim(off.w, spec('fireball'), tap())!.angle).toBe(0);
  });

  it('a drag still goes where it was dragged', () => {
    const { w } = field();
    const a = resolveAim(w, spec('fireball'), { slot: 's1', angle: Math.PI, dist: null, assist: 0 })!;
    expect(a.angle).toBe(Math.PI);
  });

  it('the ultimate uses the same rule by its own spec', () => {
    const { w, ex, ey } = field();
    const a = resolveAim(w, spec('fireball'), tap('ult'))!;
    expect(Math.abs(angleDiff(a.angle, Math.atan2(ey - w.player.y, ex - w.player.x)))).toBeLessThan(0.01);
  });

  it('is deterministic: the same world and the same tap give the same aim', () => {
    const a = field();
    const b = field();
    const x = resolveAim(a.w, spec('gravity-well'), tap())!;
    const y = resolveAim(b.w, spec('gravity-well'), tap())!;
    expect([x.angle, x.tx, x.ty]).toEqual([y.angle, y.tx, y.ty]);
  });
});
