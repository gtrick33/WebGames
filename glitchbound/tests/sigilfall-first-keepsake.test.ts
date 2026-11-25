import { describe, expect, it } from 'vitest';
import { rng } from '../src/games/sigilfall/core/math';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASSES, xpToNext } from '../src/games/sigilfall/data/classes';
import { FIRST_KEEPSAKE, ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { addXp, cantEquip, chooseSpec, equip, newCharacter } from '../src/games/sigilfall/progress/character';
import { modLines } from '../src/games/sigilfall/progress/describe';
import { makeItem } from '../src/games/sigilfall/progress/items';

/**
 * The signature system in the first twenty minutes (NINE_PLAN.md, piece 3): the first boss most heroes meet, the Coffin
 * Matron, gives every hero a hand-made piece the first time she falls, and that piece changes a skill. One piece for
 * every class, on the basic attack: every hero has one whatever they specialize in, so the piece never goes dead (a
 * piece on each class's first skill did, for the specializations that drop that skill: the owner, 2026-11-24).
 */

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const def = ITEM_DEFS[FIRST_KEEPSAKE]!;

function hero(cls: ClassId, level: number, spec?: 0 | 1 | 2) {
  const h = newCharacter(cls, 'Test', 'hero0', 0);
  while (h.level < level) addXp(h, xpToNext(h.level));
  if (spec !== undefined) chooseSpec(h, spec);
  return h;
}

describe('Sigilfall: the Coffin Matron’s keepsake', () => {
  it('is her first-clear drop for every class, a hand-made epic anyone can wear by the level they meet her at', () => {
    expect(def, FIRST_KEEPSAKE).toBeTruthy();
    expect(BOSSES['coffin-matron']!.first).toEqual({ any: [FIRST_KEEPSAKE] });
    expect(def.rarity).toBe('epic');
    expect(def.cls).toBeUndefined();
    expect(def.minLevel ?? 1).toBeLessThanOrEqual(4);
    for (const cls of CLASS_IDS) {
      const h = hero(cls, 4);
      const item = makeItem(def.id, 5, rng(3))!;
      h.bag.push(item);
      expect(cantEquip(h, item), cls).toBeNull();
    }
  });

  it('Static Band is still in the game, among what she may drop every time', () => {
    expect(ITEM_DEFS['static-band']).toBeTruthy();
    expect(BOSSES['coffin-matron']!.drops.items.any).toContain('static-band');
  });

  it('changes the basic attack, by a gold line that says how, and not only by a number', () => {
    const mods = def.mods.filter((m) => m.t === 'skill');
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) expect(m.t === 'skill' && m.skill).toBe('basic');
    expect(mods.some((m) => m.t === 'skill' && !['damage', 'cooldown', 'cost', 'gen'].includes(m.op.op))).toBe(true);
    expect(modLines(def.mods)[0]).toContain('Your basic attack');
    // unlike Static Band, on every blow: it is no proc on a critical hit
    expect(def.mods.some((m) => m.t === 'proc')).toBe(false);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: the basic attack the game runs is a different one with it worn, at the Matron and in every specialization`, () => {
      for (const [level, spec] of [[4, undefined], [12, 0], [12, 1], [12, 2]] as const) {
        const bare = hero(cls, level, spec);
        const worn = hero(cls, level, spec);
        const item = makeItem(def.id, 5, rng(3))!;
        worn.bag.push(item);
        expect(equip(worn, item.uid)).toBe(true);
        const a = buildHero(bare);
        const b = buildHero(worn);
        const basic = a.bar.basic!;
        expect(basic, `${cls} ${spec}: no basic attack`).toBeTruthy();
        expect(JSON.stringify(b.skills[basic]!.spec), `${cls} spec ${spec}`).not.toBe(JSON.stringify(a.skills[basic]!.spec));
        // and nothing else of what the hero's skills do (its stats may make them hit harder)
        const strip = (s: (typeof a.skills)[string]): string => JSON.stringify({ ...s.spec, damage: 0, cooldown: 0 });
        // (a druid's shapes have basic attacks of their own, a claw and a maul: they take it too, as they should)
        for (const id of Object.keys(a.skills)) if (SKILLS[id]?.kind !== 'basic') expect(strip(b.skills[id]!), `${cls}: ${id} changed too`).toBe(strip(a.skills[id]!));
      }
    });
  }

  it('what it adds is in keeping with a first piece: one leap, for half the blow', () => {
    for (const m of def.mods) {
      if (m.t !== 'skill' || m.op.op !== 'onHit' || m.op.effect.kind !== 'chain') continue;
      expect(m.op.effect.jumps).toBe(1);
      expect(m.op.effect.mul).toBeLessThanOrEqual(0.5);
    }
  });
});
