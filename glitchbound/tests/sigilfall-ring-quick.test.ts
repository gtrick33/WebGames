/**
 * The Ring after the owner's notes of 2026-11-13: "in the ring targeted spells could be quick cast", and "targeted
 * spells ... should be available to cast regardless of where the targeted enemy is, currently it feels like that
 * they are grey whenever the enemy [is out of] line of sight which is not correct behaviour".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, DASH, PRESETS, type Ability } from '../src/games/sigilfall/arena/abilities';
import { ARENA_H } from '../src/games/sigilfall/arena/maps';
import { GATES, Match, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { DEFAULT_SETTINGS, validateSettings } from '../src/games/sigilfall/progress/save';
import { autoPoint, isOut } from '../src/games/sigilfall/ui/ringAim';

const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar });
const EVERY: Ability[] = [...Object.values(ABILITIES), DASH];

/** A match in its fight, the foe either in plain sight 70 off or straight behind the nearest stone. */
function match(cls: ClassId, hidden: boolean): Match {
  const m = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, cls), fighter(1, 'warrior')] });
  m.step(GATES + 0.01, {});
  const me = m.fighters[0]!;
  const foe = m.fighters[1]!;
  me.charge = 1;
  me.target = 1;
  if (!hidden) {
    me.x = 70;
    me.y = ARENA_H / 2;
    foe.x = 140;
    foe.y = ARENA_H / 2;
    return m;
  }
  const p = m.pillars.find((o) => !o.wall)!;
  me.x = p.x - 46;
  me.y = p.y + p.h / 2 + 4;
  foe.x = p.x + p.w + 22;
  foe.y = me.y;
  expect(m.sees(me, foe), 'the stone is between them').toBe(false);
  return m;
}

describe('the Ring: a placed spell and where its target stands', () => {
  it('a placed spell’s button isn’t greyed because the target stepped out of sight; a spell that goes on them still is', () => {
    let placed = 0;
    let aimed = 0;
    for (const cls of CLASS_IDS) {
      const m = match(cls, true);
      const me = m.fighters[0]!;
      for (const ab of EVERY.filter((a) => a.cls === cls && !a.super)) {
        if (ab.aim === 'ground') {
          placed++;
          expect(isOut(m, me, ab), ab.id).toBe(false);
        } else if (ab.aim === 'enemy' && ab.range >= Math.hypot(m.fighters[1]!.x - me.x, m.fighters[1]!.y - me.y)) {
          aimed++;
          expect(m.blocked(me, ab), ab.id).toBe('Out of sight');
          expect(isOut(m, me, ab), ab.id).toBe(true);
        }
      }
    }
    expect(placed).toBeGreaterThanOrEqual(3);
    expect(aimed).toBeGreaterThan(3);
  });

  it('it is still greyed for what is its own: a school locked by a kick', () => {
    const ab = EVERY.find((a) => a.aim === 'ground' && !a.super && a.school !== 'physical')!;
    const m = match(ab.cls as ClassId, true);
    const me = m.fighters[0]!;
    expect(isOut(m, me, ab)).toBe(false);
    me.locks[ab.school] = 3;
    expect(isOut(m, me, ab)).toBe(true);
  });

  it('sent without being placed, it goes on a target in sight, and toward one out of sight as far as its user sees', () => {
    for (const ab of EVERY.filter((a) => a.aim === 'ground' && !a.super)) {
      const cls = ab.cls as ClassId;
      const seen = match(cls, false);
      expect(autoPoint(seen, seen.fighters[0]!, ab), `${ab.id}: on the target`).toBeUndefined();

      const m = match(cls, true);
      const me = m.fighters[0]!;
      const foe = m.fighters[1]!;
      const p = autoPoint(m, me, ab);
      expect(p, ab.id).toBeTruthy();
      expect(m.sees(me, { x: p!.x, y: p!.y + 4 }), `${ab.id}: seen`).toBe(true);
      // (toward them, not away, and no farther than it reaches)
      expect(p!.x, ab.id).toBeGreaterThanOrEqual(me.x);
      expect(p!.x, ab.id).toBeLessThan(foe.x);
      expect(m.blocked(me, ab, undefined, p), `${ab.id}: can be cast there`).toBeNull();
      me.bar = [ab.id, ...me.bar.filter((b) => b !== ab.id)].slice(0, me.bar.length);
      expect(m.press(0, ab.id, p), `${ab.id}: goes`).toBeNull();
    }
  });

  it('with nobody left to aim at it drops at its user’s feet; anything not placed has no point at all', () => {
    const ab = EVERY.find((a) => a.aim === 'ground' && !a.super)!;
    const m = match(ab.cls as ClassId, false);
    const me = m.fighters[0]!;
    m.fighters[1]!.dead = true;
    expect(autoPoint(m, me, ab)).toEqual({ x: me.x, y: me.y });
    const shot = EVERY.find((a) => a.aim === 'enemy')!;
    expect(autoPoint(m, me, shot)).toBeUndefined();
    expect(autoPoint(m, null, ab)).toBeUndefined();
  });
});

describe('the Ring: quick cast', () => {
  it('is on unless the player turns it off, and a save from before it has it on', () => {
    expect(DEFAULT_SETTINGS.quickCast).toBe(true);
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete old.quickCast;
    expect(validateSettings(old).quickCast).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, quickCast: false }).quickCast).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, quickCast: 'yes' }).quickCast).toBe(true);
  });
});
