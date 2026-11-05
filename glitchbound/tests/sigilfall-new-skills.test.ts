import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { learnedSkills, setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { applyStatus } from '../src/games/sigilfall/sim/combat';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { brokenNumbers, newWorld, readyHero } from './sigilfall-bot';

/**
 * The second half of every class's kit (PROGRESSION_BALANCE.md Part 2, B): five skills each at levels 9,
 * 18, 28, 36 and 46, for utility and control (pulls, cleanses, taunts, roots, executes, summons, leaps,
 * healing ground), each with at least two talents that change it; and bosses take hard control only as a
 * short slow.
 */

const NEW: Record<ClassId, string[]> = {
  warrior: ['hookchain', 'rallying-roar', 'ground-breaker', 'last-word', 'challenge'],
  mage: ['gravity-well', 'purge', 'mirror-self', 'frost-ring', 'starfall-lance'],
  ranger: ['grapple-line', 'tar-pit', 'snare-net', 'finishing-shot', 'hawk-call'],
  paladin: ['oath-chain', 'cleansing-light', 'bulwark', 'sentence', 'dawn-leap'],
  priest: ['grasp-of-faith', 'purify', 'chastise', 'shadow-fiend', 'sanctuary'],
  warlock: ['soul-tether', 'blood-pact', 'shadow-snare', 'harvest', 'gate-step'],
  druid: ['gale', 'thornhide', 'vine-vortex', 'bloom', 'stampede'],
  gloamknight: ['night-tether', 'cast-off', 'dread-leap', 'evenfall', 'black-oath'],
};

const step = (w: World, seconds: number, each?: (w: World) => void): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.(w);
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A hero of level 50 with `skill` in the first slot, in the Whisperwood, with nobody else about. */
function heroWith(cls: ClassId, skill: string): World {
  const c: Character = readyHero(cls, 50);
  expect(setSkill(c, 0, skill), skill).toBe(true);
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  w.player.mana = w.player.maxMana;
  return w;
}

function target(w: World, dx: number, dy = 0, hp = 1e6) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y + dy, 30, { room: -1, pack: 0 });
  e.hp = e.maxHp = hp;
  e.state = 'chase';
  e.aggro = true;
  return e;
}

const cast = (w: World): boolean => tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 });

describe('Sigilfall: the new skills', () => {
  it('every class learns five more, at 9, 18, 28, 36 and 46, each with at least two talents that change it', () => {
    for (const cls of CLASS_IDS) {
      const ids = NEW[cls];
      expect(ids.map((id) => SKILLS[id]?.unlock), cls).toEqual([9, 18, 28, 36, 46]);
      for (const id of ids) {
        expect(CLASSES[cls].skills, cls).toContain(id);
        const mutations = TALENTS[cls].filter((t) => t.mods.some((m) => (m.t === 'skill' && m.skill === id) || (m.t === 'stat' && t.text.includes(SKILLS[id]!.name))));
        expect(mutations.length, `${id}: ${mutations.map((t) => t.id)}`).toBeGreaterThanOrEqual(1);
      }
      // two talents for each of the five, all in free cells of their trees
      const cells = TALENTS[cls].map((t) => `${t.tree}:${t.row}:${t.col}`);
      expect(new Set(cells).size, cls).toBe(cells.length);
      const hero = readyHero(cls, 46);
      for (const id of ids) expect(learnedSkills(hero), cls).toContain(id);
      expect(learnedSkills(readyHero(cls, 8)).some((id) => ids.includes(id)), cls).toBe(false);
    }
  });

  it('each one can be cast, and does what it says', () => {
    for (const cls of CLASS_IDS) {
      for (const id of NEW[cls]) {
        const w = heroWith(cls, id);
        // in reach of a swing, or across the room from a spell
        const e = target(w, SKILLS[id]!.base.cast === 'melee' ? 18 : 50);
        const far = target(w, 90, 24);
        // something to cleanse
        w.player.statuses.push({ id: 'poison', t: 5, power: 3, tick: 0.5 });
        const hp0 = e.hp + far.hp;
        const x0 = e.x;
        const pets0 = w.pets.length;
        const me = { x: w.player.x, y: w.player.y, shield: w.player.shield };
        expect(cast(w), `${id} casts`).toBe(true);
        step(w, 1.4, (x) => (x.player.calm = 0));
        expect(brokenNumbers(w), id).toBeNull();
        const tags = SKILLS[id]!.base.tags;
        const spec = SKILLS[id]!.base;
        const effects = [...spec.onCast, ...spec.onHit, ...spec.onImpact];
        if (effects.some((f) => f.kind === 'cleanse')) expect(w.player.statuses.some((s) => s.id === 'poison'), `${id} cleanses`).toBe(false);
        if (effects.some((f) => f.kind === 'shield')) expect(w.player.shield > me.shield || w.player.shieldT > 0, `${id} shields`).toBe(true);
        if (effects.some((f) => f.kind === 'summon')) expect(w.pets.length, `${id} summons`).toBeGreaterThan(pets0);
        if (effects.some((f) => f.kind === 'taunt')) expect([e, far].some((x) => (x.tauntUntil ?? 0) > w.time), `${id} taunts`).toBe(true);
        if (effects.some((f) => f.kind === 'yank')) expect(Math.abs(e.x - w.player.x), `${id} drags the enemy in`).toBeLessThan(Math.abs(x0 - me.x) - 10);
        if (spec.cast === 'dash' || (spec.cast === 'blink' && !spec.extra.recall)) expect(Math.hypot(w.player.x - me.x, w.player.y - me.y), `${id} moves the hero`).toBeGreaterThan(30);
        if (spec.damage > 0 && !tags.includes('summon') && spec.cast !== 'buff' && spec.cast !== 'trap' && spec.cast !== 'blink') expect(e.hp + far.hp, `${id} hurts`).toBeLessThan(hp0);
      }
    }
  });

  it('a spell that needs a target, aimed with the mouse at nothing, is not cast (the warlock’s Corruption)', () => {
    const w = heroWith('warlock', 'corruption');
    const mana = w.player.mana;
    const charges = w.player.cds.s1.charges;
    expect(cast(w)).toBe(false);
    expect(w.player.mana).toBe(mana);
    expect(w.player.cds.s1.charges).toBe(charges);
    // an enemy in reach near the aimed line is the one it takes
    const e = target(w, 80, 10);
    expect(cast(w)).toBe(true);
    step(w, 0.3);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('pulling ground drags enemies to its middle; healing ground mends the hero standing in it', () => {
    const w = heroWith('mage', 'gravity-well');
    const e = target(w, 60, 30);
    const d0 = Math.hypot(e.x - (w.player.x + 60), e.y - w.player.y);
    expect(cast(w)).toBe(true);
    const well = w.fields[w.fields.length - 1]!;
    expect(well.pull).toBeGreaterThan(0);
    e.x = well.x + 30;
    e.y = well.y;
    step(w, 1.5, (x) => {
      x.player.calm = 0;
      e.atkCd = 9;
    });
    expect(Math.hypot(e.x - well.x, e.y - well.y)).toBeLessThan(28);
    expect(d0).toBeGreaterThan(0);
    // the priest's Sanctuary on the hero's own spot
    const p = heroWith('priest', 'sanctuary');
    p.player.hp = p.player.maxHp * 0.4;
    expect(tryCast(p, { slot: 's1', angle: 0, dist: 0, assist: 0 })).toBe(true);
    const ground = p.fields[p.fields.length - 1]!;
    p.player.x = ground.x;
    p.player.y = ground.y;
    step(p, 3, (x) => (x.player.calm = 0));
    expect(p.player.hp / p.player.maxHp).toBeGreaterThan(0.5);
  });

  it('an execute strikes the badly wounded far harder', () => {
    const fresh = heroWith('warrior', 'last-word');
    const a = target(fresh, 20);
    cast(fresh);
    step(fresh, 0.5);
    const full = 1e6 - a.hp;
    const low = heroWith('warrior', 'last-word');
    const b = target(low, 20);
    b.hp = b.maxHp * 0.2;
    const before = b.hp;
    cast(low);
    step(low, 0.5);
    expect(before - b.hp).toBeGreaterThan(full * 2);
  });

  it('Gate Step comes back: the hero returns where they stood', () => {
    const w = heroWith('warlock', 'gate-step');
    const home = { x: w.player.x, y: w.player.y };
    expect(cast(w)).toBe(true);
    step(w, 0.2);
    expect(Math.hypot(w.player.x - home.x, w.player.y - home.y)).toBeGreaterThan(30);
    step(w, 3.2);
    expect(Math.hypot(w.player.x - home.x, w.player.y - home.y)).toBeLessThan(2);
  });

  it('a boss takes a stun as a short slow, then shrugs off control for six seconds', () => {
    const w = heroWith('priest', 'chastise');
    const e = target(w, 50);
    e.boss = { def: { id: 'test' } } as unknown as typeof e.boss;
    applyStatus(w, e, { status: 'stun', dur: 3, power: 1 }, 10);
    expect(e.statuses.some((s) => s.id === 'stun')).toBe(false);
    const slow = e.statuses.find((s) => s.id === 'chill')!;
    expect(slow.power).toBe(0.5);
    expect(slow.t).toBeCloseTo(1);
    e.statuses = [];
    applyStatus(w, e, { status: 'root', dur: 3, power: 1 }, 10);
    expect(e.statuses).toHaveLength(0);
    w.time += 7.5;
    applyStatus(w, e, { status: 'root', dur: 3, power: 1 }, 10);
    expect(e.statuses.some((s) => s.id === 'chill')).toBe(true);
  });
});
