/**
 * Every talent tree made again (2026-11-19, the owner: "make enough options that a tree is filled completely only at lvl
 * 60, however, last talent should be obtainable around the 40lvl mark", "give many more options for the talents -
 * similar to the ring's"): fifty-one points deep, so pouring every point a hero earns into one tree fills it at level 60
 * and not before; the capstones in its last row open at 30 points, which a hero has at level 39 and spends the 31st of
 * at level 40; and four rows hold a choice of three, the Ring's talent rows (one of each taken, and changed for free).
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENT_ROWS, TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId, TalentNode } from '../src/games/sigilfall/data/types';
import { addXp, cantLearn, chooseSpec, freePoints, learnTalent, newCharacter, pickTaken, pointsInTree, swapPick, talentPoints } from '../src/games/sigilfall/progress/character';
import { xpToNext } from '../src/games/sigilfall/data/classes';
import { migrate } from '../src/games/sigilfall/progress/save';

/** A tree's capacity: every rank of its talents, a choice counted once. */
function capacity(nodes: TalentNode[]): number {
  const picks = new Set<string>();
  let n = 0;
  for (const t of nodes) {
    if (t.pick) picks.add(t.pick);
    else n += t.ranks;
  }
  return n + picks.size;
}

const tree = (cls: ClassId, t: 0 | 1 | 2): TalentNode[] => TALENTS[cls].filter((n) => n.tree === t);
const PICK_ROWS: Record<string, number> = { core: 1, arsenal: 3, ult: 5, capstone: 6 };

function heroAt(cls: ClassId, level: number, spec: 0 | 1 | 2 = 0) {
  const c = newCharacter(cls, 'T', 't', 0);
  while (c.level < level) addXp(c, xpToNext(c.level));
  chooseSpec(c, spec);
  return c;
}

/** Spends every point a hero has down one tree, row by row (choices: the first of each), a capstone as soon as one opens. */
function pour(c: ReturnType<typeof heroAt>, t: 0 | 1 | 2): void {
  for (let guard = 0; freePoints(c) > 0 && guard < 400; guard++) {
    const node = tree(c.cls, t)
      .sort((a, b) => (b.pick === 'capstone' ? 1 : 0) - (a.pick === 'capstone' ? 1 : 0) || a.row - b.row || a.col - b.col)
      .find((n) => !cantLearn(c, n.id));
    if (!node) break;
    learnTalent(c, node.id);
  }
}

describe('Sigilfall: the talent trees', () => {
  it('a hero earns 51 points by level 60, one a level from the specialization', () => {
    expect(talentPoints(heroAt('warrior', MAX_LEVEL))).toBe(51);
    expect(ROW_COST * (TALENT_ROWS - 1)).toBe(30);
    expect(SPEC_FOCUS).toBe(31);
    expect(SPEC_LEVEL).toBe(10);
  });

  for (const cls of CLASS_IDS) {
    describe(cls, () => {
      for (const t of [0, 1, 2] as const) {
        const name = CLASSES[cls].trees[t].name;
        it(`${name}: seven rows of five, fifty-one points, a choice of three in rows 1, 3, 5 and 6`, () => {
          const nodes = tree(cls, t);
          expect(capacity(nodes), name).toBe(51);
          const cells = new Set<string>();
          for (const n of nodes) {
            expect(n.row, n.id).toBeGreaterThanOrEqual(0);
            expect(n.row, n.id).toBeLessThan(TALENT_ROWS);
            expect(n.col, n.id).toBeGreaterThanOrEqual(0);
            expect(n.col, n.id).toBeLessThan(5);
            const cell = `${n.row}:${n.col}`;
            expect(cells.has(cell), `${n.id} shares ${cell}`).toBe(false);
            cells.add(cell);
            expect(n.ranks, n.id).toBeGreaterThanOrEqual(1);
            expect(n.ranks, n.id).toBeLessThanOrEqual(3);
            expect(n.mods.length, n.id).toBeGreaterThan(0);
            // no talent leans on another (a choice's three stand alone)
            expect(n.requires, n.id).toBeUndefined();
          }
          for (const [pick, row] of Object.entries(PICK_ROWS)) {
            const three = nodes.filter((n) => n.pick === pick);
            expect(three.length, `${name} ${pick}`).toBe(3);
            for (const n of three) {
              expect(n.row, n.id).toBe(row);
              expect(n.ranks, n.id).toBe(1);
            }
          }
          expect(nodes.filter((n) => n.pick).length).toBe(12);
          // every row but the capstones' can be reached: what the rows below hold is at least what it needs
          for (let row = 1; row < TALENT_ROWS; row++) expect(capacity(nodes.filter((n) => n.row < row)), `${name} row ${row}`).toBeGreaterThanOrEqual(row * ROW_COST);
          // the last row holds the capstones
          expect(nodes.filter((n) => n.row === TALENT_ROWS - 1 && n.pick === 'capstone').length).toBe(3);
        });

        it(`${name}: every talent names only skills its class has`, () => {
          const def = CLASSES[cls];
          const own = new Set([def.basic, ...def.skills, ...def.trees.map((x) => x.skill), def.ult, ...def.trees.flatMap((x) => (x.ult ? [x.ult] : [])), def.dodge, ...(def.forms ?? []).flatMap((f) => [f.basic, ...f.skills, f.dodge, ...(f.specSwap ? [f.specSwap.skill] : [])])]);
          for (const n of tree(cls, t)) {
            for (const m of n.mods) {
              if (m.t === 'skill' && !['*', 'basic', 'dodge', 'ult'].includes(m.skill)) expect(own.has(m.skill), `${n.id} names ${m.skill}`).toBe(true);
              if (m.t === 'proc' && m.proc.skill) expect(own.has(m.proc.skill), `${n.id} names ${m.proc.skill}`).toBe(true);
            }
          }
        });
      }

      it('every specialization has an ultimate of its own, with a combo or points of its own', () => {
        const def = CLASSES[cls];
        const ults = def.trees.map((x) => x.ult ?? def.ult);
        for (const u of ults) expect(SKILLS[u]?.kind, u).toBe('ultimate');
        // no two specializations share one, but one may keep the class's
        expect(new Set(ults).size).toBe(3);
        for (const x of def.trees) {
          const u = SKILLS[x.ult ?? def.ult]!.base;
          expect(!!u.combo || !!u.spend || (x.combo?.mods.length ?? 0) > 0, x.name).toBe(true);
        }
      });

      it('every class has two skills more than before (the pool of thirteen), and the combos are combo blows', () => {
        const def = CLASSES[cls];
        expect(def.skills.length).toBeGreaterThanOrEqual(13);
        for (const x of def.trees) {
          const blows = x.combo!.mods.some((m) => m.t === 'skill' && (m.op.op === 'combo' || m.op.op === 'spend' || m.op.op === 'build'));
          const own = [def.basic, ...def.skills, x.skill, x.ult ?? def.ult].some((id) => SKILLS[id]?.base.combo || SKILLS[id]?.base.spend);
          expect(blows || own, `${x.name}: a combo blow or points`).toBe(true);
        }
      });
    });
  }

  it('pouring every point into one tree fills it at level 60 and not before; its capstones open at level 40', () => {
    for (const cls of CLASS_IDS) {
      for (const t of [0, 1, 2] as const) {
        const at59 = heroAt(cls, 59, t);
        pour(at59, t);
        expect(pointsInTree(at59, t), `${cls} ${t} at 59`).toBe(50);
        const at60 = heroAt(cls, 60, t);
        pour(at60, t);
        expect(pointsInTree(at60, t), `${cls} ${t} at 60`).toBe(51);
        const caps = tree(cls, t).filter((n) => n.pick === 'capstone');
        const at39 = heroAt(cls, 39, t);
        pour(at39, t);
        expect(caps.some((n) => (at39.talents[n.id] ?? 0) > 0), `${cls} ${t}: no capstone at 39`).toBe(false);
        const at40 = heroAt(cls, 40, t);
        pour(at40, t);
        expect(caps.some((n) => (at40.talents[n.id] ?? 0) > 0), `${cls} ${t}: a capstone at 40`).toBe(true);
      }
    }
  });

  it('a choice takes one of its three, and another can be chosen instead for free', () => {
    const c = heroAt('warrior', 30, 0);
    pour(c, 0);
    const core = tree('warrior', 0).filter((n) => n.pick === 'core');
    const taken = core.find((n) => (c.talents[n.id] ?? 0) > 0)!;
    const other = core.find((n) => n !== taken)!;
    expect(cantLearn(c, other.id)).toMatch(/You chose/);
    expect(pickTaken(c, other)?.id).toBe(taken.id);
    const spent = Object.values(c.talents).reduce((a, b) => a + b, 0);
    expect(swapPick(c, other.id)).toBe(true);
    expect(c.talents[taken.id] ?? 0).toBe(0);
    expect(c.talents[other.id]).toBe(1);
    expect(Object.values(c.talents).reduce((a, b) => a + b, 0)).toBe(spent);
    // (one already taken can't be swapped for itself, and a save with two of one choice loads with none)
    expect(swapPick(c, other.id)).toBe(false);
    const bad = { ...c, talents: { ...c.talents, [taken.id]: 1 } };
    const back = migrate(JSON.parse(JSON.stringify({ v: 15, heroes: [bad], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(back.talents).toEqual({});
  });

  it('a save from before the trees were made again gets its points back to spend', () => {
    const c = heroAt('mage', 30, 0);
    const old = { ...c, talents: { kindling: 3, 'fire-focus': 2 } };
    const back = migrate(JSON.parse(JSON.stringify({ v: 14, heroes: [old], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(back.talents).toEqual({});
    expect(freePoints(back)).toBe(talentPoints(back));
  });
});
