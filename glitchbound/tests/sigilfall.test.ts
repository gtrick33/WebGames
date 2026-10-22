import { describe, expect, it } from 'vitest';
import { rng } from '../src/games/sigilfall/core/math';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS, CLASSES, MAX_LEVEL, xpToNext } from '../src/games/sigilfall/data/classes';
import { PETS } from '../src/games/sigilfall/data/pets';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL } from '../src/games/sigilfall/data/talents';
import { ITEMS, MINOR_MODS } from '../src/games/sigilfall/data/items';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import { RARITIES, SLOTS, type ClassId, type Mod, type RegionId, type SkillOp } from '../src/games/sigilfall/data/types';
import { applyOps, buildHero, resolveSkill } from '../src/games/sigilfall/progress/build';
import {
  addItem,
  addXp,
  allItems,
  BAG_OVERFLOW,
  BAG_SIZE,
  cantLearn,
  cantSpec,
  chooseSpec,
  pointsInTree,
  equip,
  freePoints,
  learnTalent,
  learnedSkills,
  newCharacter,
  respec,
  respecCost,
  salvage,
  setSkill,
  unequip,
  type Character,
} from '../src/games/sigilfall/progress/character';
import { modLines } from '../src/games/sigilfall/progress/describe';
import { itemMods, makeItem, rollGear, rollLoot, usableBy } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS, emptySave, loadSave, migrate, SAVE_KEY, SAVE_VERSION, validateCharacter, validateSettings, writeSave } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { flowField, K, markerPos, parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const CLS: ClassId[] = CLASS_IDS;
const hero = (cls: ClassId = 'mage'): Character => newCharacter(cls, 'Test', 'hero0', 0);
const levelTo = (c: Character, level: number): void => {
  while (c.level < level) addXp(c, xpToNext(c.level));
};

describe('sigilfall content', () => {
  it('has about 20-30 hand-made items with unique ids, a description line for every effect, and real targets', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(20);
    expect(ITEMS.length).toBeLessThanOrEqual(32);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    const named = (m: Mod) => m.t === 'skill' && !['*', 'basic', 'dodge', 'ult'].includes(m.skill);
    for (const it of ITEMS) {
      expect(it.mods.length + it.stats.length, it.id).toBeGreaterThan(0);
      expect(modLines(it.mods).length, it.id).toBe(it.mods.length);
      for (const m of it.mods.filter(named)) {
        const skill = m.t === 'skill' ? SKILLS[m.skill] : undefined;
        expect(skill, `${it.id} → ${m.t === 'skill' ? m.skill : ''}`).toBeTruthy();
        // a class-locked item only changes its own class's skills
        if (it.cls) expect(skill!.cls).toBe(it.cls);
      }
    }
    // epics and legendaries do something besides numbers
    for (const it of ITEMS.filter((i) => i.rarity === 'epic' || i.rarity === 'legendary')) expect(it.mods.some((m) => m.t !== 'stat' || !!m.when), it.id).toBe(true);
  });

  it('every talent and rolled modifier points at a skill of its class', () => {
    for (const cls of CLS) {
      const ids = new Set(TALENTS[cls].map((n) => n.id));
      expect(ids.size).toBe(TALENTS[cls].length);
      for (const n of TALENTS[cls]) {
        if (n.requires) expect(ids.has(n.requires), n.id).toBe(true);
        for (const m of n.mods) if (m.t === 'skill' && !['*', 'basic', 'dodge', 'ult'].includes(m.skill)) expect(SKILLS[m.skill]?.cls, `${n.id} → ${m.skill}`).toBe(cls);
      }
      // three trees of seven rows, each ending in one capstone that 30 points below it can reach, with
      // more ranks below it than that, so the way there is a choice
      for (const tree of [0, 1, 2] as const) {
        const nodes = TALENTS[cls].filter((n) => n.tree === tree);
        const caps = nodes.filter((n) => n.row === 6);
        expect(caps, `${cls} tree ${tree}`).toHaveLength(1);
        expect(caps[0]!.ranks).toBe(1);
        expect(nodes.filter((n) => n.row < 6).reduce((a, n) => a + n.ranks, 0), `${cls} tree ${tree}`).toBeGreaterThanOrEqual(32);
        for (const n of nodes) {
          expect(n.row >= 0 && n.row <= 6 && n.col >= 0 && n.col <= 3, n.id).toBe(true);
          const below = nodes.filter((m) => m.row < n.row).reduce((a, m) => a + m.ranks, 0);
          expect(below, n.id).toBeGreaterThanOrEqual(n.row * ROW_COST);
          if (n.requires) expect(nodes.find((m) => m.id === n.requires)!.row, n.id).toBeLessThan(n.row);
          expect(modLines(n.mods).length, n.id).toBe(n.mods.length);
          for (const m of n.mods) {
            const e = m.t === 'proc' ? m.proc.effect : m.t === 'skill' && 'effect' in m.op ? m.op.effect : null;
            if (e?.kind === 'summon') expect(PETS[e.pet], n.id).toBeTruthy();
            if (m.t === 'proc' && m.proc.skill) expect(SKILLS[m.proc.skill]?.cls, n.id).toBe(cls);
          }
        }
        // no two talents in one spot
        expect(new Set(nodes.map((n) => `${n.row}:${n.col}`)).size).toBe(nodes.length);
      }
    }
    for (const m of MINOR_MODS) expect(SKILLS[m.skill]?.cls).toBe(m.cls);
  });

  it('classes have their own kits: a basic, six skills, three specializations, an ultimate and a dodge', () => {
    expect(CLS).toHaveLength(7);
    const seen = new Set<string>();
    for (const cls of CLS) {
      const d = CLASSES[cls];
      const forms = (d.forms ?? []).flatMap((f) => [f.basic, ...f.skills, f.dodge]);
      const kit = [d.basic, ...d.skills, ...d.trees.map((t) => t.skill), d.ult, d.dodge, ...forms];
      for (const id of new Set(kit)) {
        expect(SKILLS[id]?.cls, id).toBe(cls);
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
      expect(d.skills).toHaveLength(6);
      expect(d.trees).toHaveLength(3);
      expect(SKILLS[d.ult]!.kind).toBe('ultimate');
      expect(SKILLS[d.dodge]!.kind).toBe('dodge');
      // skills arrive over the levels; the specialization's at 10
      for (const t of d.trees) expect(SKILLS[t.skill]!.unlock).toBe(SPEC_LEVEL);
      expect(d.skills.map((id) => SKILLS[id]!.unlock)).toEqual([1, 2, 4, 6, 14, 22]);
      for (const f of d.forms ?? []) expect(d.skills).toContain(f.skill);
      // every skill's text exists and every resource cost makes sense for the class
      for (const id of kit) {
        const sd = SKILLS[id]!;
        expect(sd.blurb.length, id).toBeGreaterThan(10);
        if (sd.base.cost > 0) expect(d.resource, id).toBeTruthy();
        if (d.resource?.kind === 'holy') expect(sd.base.cost === 0 || sd.base.cost === 3, id).toBe(true);
      }
    }
  });

  it('bosses have at least two phases, each with patterns', () => {
    for (const b of Object.values(BOSSES)) {
      expect(b.phases.length, b.id).toBeGreaterThanOrEqual(2);
      expect(b.phases[0]!.at).toBe(1);
      for (const p of b.phases) expect(p.patterns.length, b.id).toBeGreaterThan(0);
      for (let i = 1; i < b.phases.length; i++) expect(b.phases[i]!.at).toBeLessThan(b.phases[i - 1]!.at);
    }
  });

  it('quests chain from the start and only name real regions, bosses and enemies', () => {
    const ids = new Set(QUESTS.map((q) => q.id));
    for (const q of QUESTS) {
      for (const a of q.after ?? []) expect(ids.has(a), q.id).toBe(true);
      const o = q.objective;
      if ('region' in o && o.region) expect(REGIONS[o.region as RegionId], q.id).toBeTruthy();
      if (o.kind === 'boss') expect(BOSSES[o.boss], q.id).toBeTruthy();
    }
    expect(QUESTS.some((q) => !q.after?.length)).toBe(true);
  });
});

describe('sigilfall maps', () => {
  for (const id of Object.keys(REGIONS) as RegionId[]) {
    it(`${id}: rectangular, a start, and everything reachable from it`, () => {
      const def = REGIONS[id];
      const w = def.map[0]!.length;
      for (const row of def.map) expect(row.length).toBe(w);
      const m = parseRegion(def);
      const start = m.markers.find((x) => x.marker.kind === 'start');
      expect(start).toBeTruthy();
      // cracked walls hide secrets: count them as open, as a curious player would
      const open = { ...m, solid: m.solid.map((s, i) => (m.kind[i] === K.Cracked ? 0 : s)) };
      const f = flowField(open, start!.tx, start!.ty, 30000);
      for (const pm of m.markers) {
        if (pm.marker.kind === 'prop' || pm.marker.kind === 'hazard') continue;
        // solid markers (waystones, dummies) are used from the tile next to them
        const near = [0, 1, -1, m.w, -m.w].map((d) => f[pm.ty * m.w + pm.tx + d] ?? -1);
        expect(Math.max(...near), `${pm.marker.kind} at ${pm.tx},${pm.ty}`).toBeGreaterThanOrEqual(0);
      }
      for (const pm of m.markers) if (pm.marker.kind === 'exit') expect(REGIONS[pm.marker.to], pm.marker.label).toBeTruthy();
      // every room has doors and floor; boss rooms hold their boss
      def.encounters.forEach((enc, i) => {
        expect(m.roomTiles[i]?.length, enc.id).toBeGreaterThan(0);
        expect(m.doors[i]?.length, enc.id).toBeGreaterThan(0);
        if (enc.boss) {
          const b = m.markers.find((x) => x.marker.kind === 'boss' && x.marker.boss === enc.boss);
          expect(b, enc.id).toBeTruthy();
          expect(m.room[b!.ty * m.w + b!.tx]).toBe(i + 1);
        }
      });
    });
  }
});

describe('sigilfall builds: equipment changes how skills work', () => {
  it('Ember Staff makes Fireball split on impact, and touches nothing else', () => {
    const c = hero('mage');
    levelTo(c, 6);
    const plain = buildHero(c);
    c.equip.weapon = makeItem('ember-staff', 5, rng(1))!;
    const b = buildHero(c);
    expect(plain.skills['fireball']!.spec.onImpact.some((e) => e.kind === 'split')).toBe(false);
    expect(b.skills['fireball']!.spec.onImpact).toContainEqual({ kind: 'split', count: 3, mul: 0.4 });
    for (const id of ['arcane-bolt', 'frost-nova', 'chain-lightning', 'blink', 'meteor']) {
      expect(b.skills[id]?.spec.onImpact ?? [], id).toEqual(plain.skills[id]?.spec.onImpact ?? []);
    }
    // the item says so in plain words
    const notes = resolveSkill(c, 'fireball').notes.map((n) => n.text.toLowerCase());
    expect(notes.some((t) => t.includes('split'))).toBe(true);
  });

  it('two Fireballs built differently really behave differently', () => {
    const a = hero('mage');
    levelTo(a, 8);
    a.equip.weapon = makeItem('ember-staff', 6, rng(1))!;
    const b = hero('mage');
    levelTo(b, 8);
    b.equip.offhand = makeItem('piercing-catalyst', 6, rng(2))!;
    const fa = resolveSkill(a, 'fireball').spec;
    const fb = resolveSkill(b, 'fireball').spec;
    expect(fa.onImpact.some((e) => e.kind === 'split')).toBe(true);
    expect(fa.pierce).toBe(0);
    expect(fb.pierce).toBe(2);
    expect(fb.onImpact.some((e) => e.kind === 'split')).toBe(false);
  });

  const base = SKILLS['fireball']!.base;
  const ops = (...list: SkillOp[]) => list.map((op) => ({ op, rank: 1 }));

  it('percentages of a kind add up before they apply', () => {
    const s = applyOps(base, ops({ op: 'damage', pct: 30 }, { op: 'damage', pct: 20 }));
    expect(s.damage).toBeCloseTo(base.damage * 1.5);
  });

  it('caps stop runaway stacking', () => {
    const s = applyOps(base, ops({ op: 'cooldown', pct: 60 }, { op: 'cooldown', pct: 60 }, { op: 'projectiles', n: 20 }, { op: 'bounce', n: 9 }, { op: 'charges', n: 9 }));
    expect(s.cooldown).toBeCloseTo(base.cooldown * 0.5);
    expect(s.count).toBe(11);
    expect(s.bounce).toBe(4);
    expect(s.charges).toBe(3);
  });

  it('effects of the same kind merge instead of stacking', () => {
    const s = applyOps(
      base,
      ops(
        { op: 'onImpact', effect: { kind: 'split', count: 3, mul: 0.4 } },
        { op: 'onImpact', effect: { kind: 'split', count: 2, mul: 0.5 } },
        { op: 'onImpact', effect: { kind: 'explode', radius: 20, mul: 1.5 } },
        { op: 'onImpact', effect: { kind: 'explode', radius: 30, mul: 1.5 } },
        { op: 'onHit', effect: { kind: 'status', status: 'burn', dur: 2, power: 0.5 } },
        { op: 'onHit', effect: { kind: 'status', status: 'burn', dur: 4, power: 0.2 } },
      ),
    );
    const splits = s.onImpact.filter((e) => e.kind === 'split');
    const booms = s.onImpact.filter((e) => e.kind === 'explode');
    expect(splits).toEqual([{ kind: 'split', count: 3, mul: 0.5 }]);
    expect(booms).toHaveLength(1);
    expect(booms[0]).toMatchObject({ radius: 30, mul: 1.5 + 0.25 * 1.5 });
    expect(s.onHit.filter((e) => e.kind === 'status')).toEqual([{ kind: 'status', status: 'burn', dur: 4, power: 0.5, chance: 1 }]);
    // the base spec is never changed in place
    expect(base.onImpact.some((e) => e.kind === 'split')).toBe(false);
  });

  it('slot modifiers reach only the slot they name', () => {
    const c = hero('ranger');
    levelTo(c, 6);
    const before = buildHero(c);
    c.equip.feet = makeItem('zephyr-boots', 5, rng(3))!;
    const after = buildHero(c);
    const mods = itemMods(c.equip.feet!).filter((m) => m.t === 'skill');
    const touched = new Set(mods.map((m) => (m.t === 'skill' ? (m.skill === 'dodge' ? CLASSES.ranger.dodge : m.skill) : '')));
    for (const id of Object.keys(after.skills)) {
      if (touched.has(id) || mods.some((m) => m.t === 'skill' && m.skill === '*')) continue;
      expect(after.skills[id]!.spec, id).toEqual(before.skills[id]!.spec);
    }
  });
});

describe('sigilfall character', () => {
  it('levels on a rising curve, carries extra experience over and stops at the cap', () => {
    for (let l = 1; l < MAX_LEVEL; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    const c = hero();
    expect(addXp(c, xpToNext(1) + 5)).toEqual([2]);
    expect(c.level).toBe(2);
    expect(c.xp).toBe(5);
    expect(addXp(c, xpToNext(2) + xpToNext(3))).toEqual([3, 4]);
    levelTo(c, MAX_LEVEL);
    expect(addXp(c, 1e6)).toEqual([]);
    expect(c.level).toBe(MAX_LEVEL);
    expect(c.xp).toBe(0);
  });

  it('unlocks skills by level and slots new ones by itself', () => {
    const c = hero('warrior');
    expect(learnedSkills(c)).toEqual(['heavy-strike']);
    levelTo(c, 6);
    expect(learnedSkills(c)).toHaveLength(4);
    expect(c.skills.filter(Boolean)).toHaveLength(3);
    expect(setSkill(c, 0, 'nope')).toBe(false);
    const fourth = learnedSkills(c).find((id) => !c.skills.includes(id))!;
    expect(setSkill(c, 2, fourth)).toBe(true);
    expect(c.skills[2]).toBe(fourth);
    // putting a slotted skill in another slot swaps the two
    const first = c.skills[0];
    setSkill(c, 1, first);
    expect(c.skills[1]).toBe(first);
    expect(new Set(c.skills).size).toBe(3);
  });

  it('talents open at level 10 with a specialization; rows need points, some talents need others', () => {
    const c = hero('mage');
    levelTo(c, 9);
    expect(freePoints(c)).toBe(0);
    expect(cantLearn(c, 'kindling')).toMatch(/level 10/);
    expect(cantSpec(c, 0)).toMatch(/level 10/);
    levelTo(c, 20);
    expect(freePoints(c)).toBe(11);
    expect(cantLearn(c, 'kindling')).toMatch(/specialization/);
    expect(learnedSkills(c)).not.toContain('flamestrike');
    // the first choice is free and brings the specialization's ability and passive
    expect(chooseSpec(c, 0)).toBe(true);
    expect(learnedSkills(c)).toContain('flamestrike');
    // the bar was full: the new ability takes the last slot
    expect(c.skills[2]).toBe('flamestrike');
    expect(buildHero(c).stats.fire).toBe(CLASSES.mage.base.fire + 10);
    // the other trees wait for 31 points in this one
    expect(cantLearn(c, 'conduction')).toMatch(new RegExp(`${SPEC_FOCUS} points in Pyromancer`));
    expect(cantLearn(c, 'combustion')).toMatch(/Needs 5 points/);
    for (let i = 0; i < 3; i++) expect(learnTalent(c, 'kindling')).toBe(true);
    expect(learnTalent(c, 'kindling')).toBe(false); // full rank
    learnTalent(c, 'fire-focus');
    learnTalent(c, 'fire-focus');
    expect(learnTalent(c, 'combustion')).toBe(true);
    learnTalent(c, 'smolder');
    learnTalent(c, 'smolder');
    learnTalent(c, 'pyroclasm');
    learnTalent(c, 'pyroclasm');
    // row 2 is open now (10 points), but Wildfire still needs Ignition
    expect(cantLearn(c, 'wildfire')).toMatch(/Ignition/);
    expect(learnTalent(c, 'ignition')).toBe(true);
    expect(learnTalent(c, 'wildfire')).toBe(false); // no points left
    expect(freePoints(c)).toBe(0);
    // resetting costs gold from level 15 and gives every point back
    expect(respecCost(c)).toBe(500);
    expect(respec(c)).toBe(false);
    c.gold = 600;
    expect(respec(c)).toBe(true);
    expect(c.gold).toBe(100);
    expect(freePoints(c)).toBe(11);
    // changing the specialization costs the same and resets talents; its ability leaves the bar
    learnTalent(c, 'kindling');
    c.skills = ['fireball', 'flamestrike', null];
    c.gold = 500;
    expect(chooseSpec(c, 2)).toBe(true);
    expect(c.gold).toBe(0);
    expect(c.talents).toEqual({});
    expect(c.skills).not.toContain('flamestrike');
    expect(learnedSkills(c)).toContain('blizzard');
    expect(c.skills).toContain('blizzard');
    expect(cantSpec(c, 2)).toMatch(/your specialization/);
  });

  it('51 points at the cap: 31 in the specialization, then the rest anywhere', () => {
    const c = hero('warrior');
    levelTo(c, MAX_LEVEL);
    expect(freePoints(c)).toBe(51);
    chooseSpec(c, 1);
    // fill Guardian row by row
    for (let row = 0; row <= 6; row++) for (const n of TALENTS.warrior.filter((x) => x.tree === 1 && x.row === row)) while (learnTalent(c, n.id));
    expect(pointsInTree(c, 1)).toBeGreaterThanOrEqual(SPEC_FOCUS);
    expect(c.talents.avalanche).toBe(1);
    // the other trees are open now, and the points left go there (not far enough for their capstones)
    expect(cantLearn(c, 'bloodlust')).toBeNull();
    for (const tree of [0, 2] as const) for (let row = 0; row <= 6; row++) for (const n of TALENTS.warrior.filter((x) => x.tree === tree && x.row === row)) while (learnTalent(c, n.id));
    expect(freePoints(c)).toBe(0);
    expect(c.talents.bloodstorm ?? 0).toBe(0);
    expect(c.talents.bladestorm ?? 0).toBe(0);
  });

  it('equipping and unequipping never duplicates or loses an item', () => {
    const c = hero('warrior');
    const r = rng(5);
    for (let i = 0; i < 12; i++) expect(addItem(c, rollLoot('warrior', 4, 'elite', 0, r))).toBe(true);
    const uids = () => allItems(c).map((i) => i.uid).sort();
    const start = uids();
    for (let n = 0; n < 200; n++) {
      if (r() < 0.6 && c.bag.length) equip(c, c.bag[Math.floor(r() * c.bag.length)]!.uid);
      else unequip(c, SLOTS[Math.floor(r() * SLOTS.length)]!);
      expect(uids()).toEqual(start);
    }
    // worn items sit in their own slot
    for (const slot of SLOTS) if (c.equip[slot]) expect(rollable(c.equip[slot]!.base, slot)).toBe(true);
    // the same item can't be added twice
    expect(addItem(c, c.bag[0] ?? c.equip.weapon!)).toBe(false);
  });

  it('class gear stays with its class; a full bag refuses instead of dropping things', () => {
    const c = hero('mage');
    const sword = rollGear('warrior', 3, 'common', rng(1), 'weapon');
    addItem(c, sword);
    expect(equip(c, sword.uid)).toBe(false);
    expect(c.bag).toContain(sword);
    while (c.bag.length < BAG_SIZE) addItem(c, rollGear('mage', 2, 'common', rng(c.bag.length + 9)));
    expect(addItem(c, rollGear('mage', 2, 'common', rng(99)))).toBe(false);
    c.equip.head = rollGear('mage', 2, 'common', rng(77), 'head');
    expect(unequip(c, 'head')).toBe(false);
    expect(c.equip.head).toBeTruthy();
    const gold = c.gold;
    const value = salvage(c, sword.uid);
    expect(value).toBeGreaterThan(0);
    expect(c.gold).toBe(gold + value);
    expect(c.bag.some((i) => i.uid === sword.uid)).toBe(false);
  });
});

/** Whether a base id belongs in a slot (generated bases and hand-made items). */
function rollable(base: string, slot: string): boolean {
  const def = ITEMS.find((i) => i.id === base);
  if (def) return def.slot === slot;
  return rollGear('warrior', 1, 'common', rng(1), slot as never).base !== undefined;
}

describe('sigilfall loot', () => {
  it('drops gear the hero can use, at sensible levels and rarities', () => {
    for (const cls of CLS) {
      const r = rng(42);
      for (let i = 0; i < 400; i++) {
        const tier = i % 3;
        const it = rollLoot(cls, 5 + (i % 12), i % 7 === 0 ? 'boss' : 'enemy', tier, r);
        expect(usableBy(it, cls), `${cls} ${it.base}`).toBe(true);
        expect(RARITIES).toContain(it.r);
        expect(it.il).toBeGreaterThanOrEqual(1);
        if (it.r === 'epic' || it.r === 'legendary') expect(ITEMS.some((d) => d.id === it.base)).toBe(true);
        for (const [, v] of it.st) expect(Number.isFinite(v) && v > 0).toBe(true);
      }
    }
  });

  it('is the same for the same seed', () => {
    const a = rollLoot('ranger', 9, 'boss', 1, rng(8));
    const b = rollLoot('ranger', 9, 'boss', 1, rng(8));
    expect({ ...a, uid: '' }).toEqual({ ...b, uid: '' });
  });

  it('higher rarities roll more stats', () => {
    const n = (rarity: 'common' | 'uncommon' | 'rare') => rollGear('mage', 8, rarity, rng(4), 'chest').st.length;
    expect(n('common')).toBeLessThan(n('uncommon'));
    expect(n('uncommon')).toBeLessThan(n('rare'));
  });
});

describe('sigilfall saves', () => {
  const sample = (): Character => {
    const c = readyHero('ranger', 6, 'rare', 3);
    c.gold = 321;
    c.bag.push(makeItem('viper-quiver', 5, rng(4))!);
    c.unlocked.push('whisperwood');
    c.bosses.grimtusk = 1;
    return c;
  };

  it('writes and reads back the same hero', () => {
    const save = emptySave();
    const c = sample();
    save.heroes[1] = c;
    save.last = 1;
    save.settings.joystick = 70;
    expect(writeSave(save)).toBe(true);
    const { save: back, status } = loadSave();
    expect(status).toBe('ok');
    const h = back.heroes[1]!;
    expect(h.level).toBe(6);
    expect(h.gold).toBe(321);
    expect(h.talents).toEqual(c.talents);
    expect(Object.keys(h.equip).sort()).toEqual(Object.keys(c.equip).sort());
    expect(h.bag.map((i) => i.base)).toEqual(c.bag.map((i) => i.base));
    expect(h.bosses.grimtusk).toBe(1);
    expect(h.unlocked).toContain('whisperwood');
    expect(h.quests).toEqual(c.quests);
    expect(back.settings.joystick).toBe(70);
    expect(back.last).toBe(1);
    expect(buildHero(h).maxHp).toBe(buildHero(c).maxHp);
  });

  it('falls back to the backup when the main save is damaged, and keeps the damaged copy', () => {
    const save = emptySave();
    save.heroes[0] = sample();
    writeSave(save);
    localStorage.setItem(SAVE_KEY, '{"v":1,"heroes":[{"cls":');
    const { save: back, status } = loadSave();
    expect(status).toBe('recovered');
    expect(back.heroes[0]?.gold).toBe(321);
    expect(localStorage.getItem(`${SAVE_KEY}.corrupt`)).toContain('"heroes"');
  });

  it('starts fresh, without crashing, when nothing can be read', () => {
    localStorage.setItem(SAVE_KEY, 'not json');
    expect(loadSave().status).toBe('reset');
    localStorage.clear();
    expect(loadSave().status).toBe('new');
  });

  it('picks up a save made while the game was called Riftbound, then moves it to the new key', () => {
    const save = emptySave();
    save.heroes[2] = sample();
    localStorage.setItem('glitchbound.riftbound', JSON.stringify(save));
    localStorage.setItem('glitchbound.riftbound.bak', JSON.stringify(save));
    const { save: back, status } = loadSave();
    expect(status).toBe('ok');
    expect(back.heroes[2]?.gold).toBe(321);
    expect(writeSave(back)).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toContain('"gold":321');
    expect(localStorage.getItem('glitchbound.riftbound')).toBeNull();
    expect(localStorage.getItem('glitchbound.riftbound.bak')).toBeNull();
    // the new key wins over a leftover old one
    localStorage.setItem('glitchbound.riftbound', JSON.stringify(emptySave()));
    expect(loadSave().save.heroes[2]?.gold).toBe(321);
  });

  it('never treats a save from a newer version as empty', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION + 1, heroes: [] }));
    expect(loadSave().status).toBe('newer');
    expect(migrate({ v: SAVE_VERSION + 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate({ heroes: [] })).toBeNull();
  });

  it('cleans up a tampered hero instead of trusting it', () => {
    const c = validateCharacter(
      {
        cls: 'mage',
        level: 999,
        xp: -5,
        gold: 'lots',
        spec: 0,
        talents: { kindling: 99, 'not-a-talent': 3 },
        skills: ['fireball', 'fireball', 'cleave'],
        equip: { weapon: { uid: 'a', base: 'cleaverfang', r: 'epic', il: 4, st: [] }, head: { uid: 'b', base: 'nonsense', r: 'rare', il: 2, st: [] } },
        bag: [{ uid: 'a', base: 'ember-staff', r: 'epic', il: 3, st: [] }, 42, null],
        quests: { 'no-such-quest': { state: 'done' } },
        unlocked: ['crypt', 'atlantis'],
      },
      0,
    )!;
    expect(c.level).toBe(MAX_LEVEL);
    expect(c.xp).toBe(0);
    expect(c.gold).toBe(0);
    expect(c.talents.kindling).toBe(3);
    expect(c.talents['not-a-talent']).toBeUndefined();
    expect(c.skills.filter((s) => s === 'fireball')).toHaveLength(1);
    expect(c.skills).not.toContain('cleave');
    // a warrior axe can't be worn by a mage: it goes to the bag; unknown items are dropped
    expect(c.equip.weapon).toBeUndefined();
    expect(c.bag.map((i) => i.base).sort()).toEqual(['cleaverfang', 'ember-staff']);
    expect(new Set(c.bag.map((i) => i.uid)).size).toBe(2);
    expect(c.unlocked).toEqual(['emberwick', 'crypt']);
    expect(c.spec).toBe(0);
    // talents the rules can't reach (another tree before 31 points in the specialization) are reset
    const d = validateCharacter({ cls: 'mage', level: 30, spec: 0, talents: { conduction: 3, kindling: 1 } }, 0)!;
    expect(d.talents).toEqual({});
    expect(validateCharacter({ cls: 'mage', level: 5, spec: 1 }, 0)!.spec).toBeNull();
    expect(validateCharacter({ cls: 'bard' }, 0)).toBeNull();
    expect(validateCharacter('hero', 0)).toBeNull();
  });

  it('keeps settings within their ranges', () => {
    const s = validateSettings({ joystick: 500, deadzone: -1, sensitivity: 'x', aimAssist: 7, ultKey: 'q', master: 2 });
    expect(s.joystick).toBe(84);
    expect(s.deadzone).toBe(0.04);
    expect(s.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
    expect(s.aimAssist).toBe(2);
    expect(s.ultKey).toBe('f');
    expect(s.master).toBe(1);
  });
});

describe('sigilfall combat', () => {
  it('an aimed shot goes where it was aimed, even with an enemy elsewhere', () => {
    const w = newWorld('whisperwood', readyHero('mage', 4));
    const p = w.player;
    // an enemy straight to the right, a shot aimed straight up
    w.enemies = [];
    const e = w.addEnemy('moss-slime', p.x + 40, p.y, 3, { room: -1, pack: 0 });
    e.state = 'chase';
    expect(tryCast(w, { slot: 'basic', angle: -Math.PI / 2, dist: null, assist: 0 })).toBe(true);
    for (let i = 0; i < 20 && !w.projectiles.length; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const shot = w.projectiles.find((x) => !x.hostile)!;
    expect(shot).toBeTruthy();
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('a tap with smart targeting picks the nearby enemy', () => {
    const w = newWorld('whisperwood', readyHero('mage', 4));
    const p = w.player;
    w.enemies = [];
    const e = w.addEnemy('moss-slime', p.x + 40, p.y, 3, { room: -1, pack: 0 });
    e.state = 'chase';
    p.aim = Math.PI / 2;
    expect(tryCast(w, { slot: 'basic', angle: null, dist: null, assist: 0 })).toBe(true);
    for (let i = 0; i < 20 && !w.projectiles.length; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const shot = w.projectiles.find((x) => !x.hostile)!;
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(0, 1);
  });

  it('cooldowns hold a skill back until they recover', () => {
    const w = newWorld('whisperwood', readyHero('mage', 4));
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(true);
    const cd = w.player.cds.s1;
    expect(cd.charges).toBe(cd.max - 1);
    if (cd.max === 1) expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(false);
    for (let t = 0; t < cd.cd + 1; t += 1 / 60) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(cd.charges).toBe(cd.max);
  });

  it('a boss changes phase at its threshold, is immune while it does, and pays out once', () => {
    const w = newWorld('crypt', readyHero('mage', 9));
    const enc = w.encounters.findIndex((e) => e.def.boss === 'morgrave');
    const tile = w.map.roomTiles[enc]!.find((i) => !w.map.solid[i])!;
    w.player.x = ((tile % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(tile / w.map.w) + 0.5) * TILE;
    const events: string[] = [];
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        w.input = emptyInput();
        w.player.iframe = 1;
        w.step(1 / 60);
        for (const ev of w.events) events.push(ev.t);
        w.events.length = 0;
      }
    };
    step(5);
    const boss = w.boss()!;
    expect(boss).toBeTruthy();
    expect(events).toContain('bossStart');
    const def = BOSSES.morgrave!;
    boss.hp = boss.maxHp * (def.phases[1]!.at - 0.02);
    step(3);
    expect(boss.boss!.phase).toBe(1);
    expect(events).toContain('bossPhase');
    expect(boss.boss!.shift).toBeGreaterThan(0);
    expect(hitEnemy(w, boss, 100, 'fire', { depth: 0 })).toBe(0);
    // finish it: the death plays out, then the rewards and the way home
    step(300);
    boss.hp = 1;
    hitEnemy(w, boss, 10_000, 'fire', { depth: 0 });
    step(240);
    expect(events.filter((t) => t === 'bossDown')).toHaveLength(1);
    expect(w.hero.bosses.morgrave).toBe(1);
    expect(w.cleared).toBe(true);
    expect(w.portal).not.toBeNull();
    expect(w.drops.filter((d) => d.kind === 'item').length + w.run.items.length).toBeGreaterThanOrEqual(2 + (def.first.mage?.length ?? 0) + (def.first.any?.length ?? 0));
    expect(w.encounters[enc]!.state).toBe('cleared');
  });

  it('loot left on the ground is collected, never lost, when the hero leaves', () => {
    const w = newWorld('whisperwood', readyHero('ranger', 5));
    const h = w.hero;
    h.bag = [];
    const r = rng(12);
    for (let i = 0; i < BAG_SIZE + BAG_OVERFLOW + 3; i++) w.dropItem(w.player.x + 200, w.player.y, rollLoot('ranger', 5, 'enemy', 0, r));
    w.dropGold(w.player.x + 200, w.player.y, 40);
    const gold = h.gold;
    const got = w.collectAll();
    expect(got.items).toBe(BAG_SIZE + BAG_OVERFLOW);
    expect(h.bag).toHaveLength(BAG_SIZE + BAG_OVERFLOW);
    // what didn't fit became gold, on top of the gold on the ground
    expect(got.salvaged).toBeGreaterThan(0);
    expect(h.gold).toBe(gold + 40 + got.salvaged);
    expect(w.drops.filter((d) => d.kind === 'item' || d.kind === 'gold')).toHaveLength(0);
    expect(new Set(h.bag.map((i) => i.uid)).size).toBe(h.bag.length);
  });

  it('closing doors never trap the hero inside a wall', () => {
    const w = newWorld('crypt', readyHero('warrior', 8));
    const enc = w.encounters[0]!;
    const door = w.map.doors[enc.index]![0]!;
    // stand on the door tile, half in the room
    const dx = ((door % w.map.w) + 0.5) * TILE;
    const dy = (Math.floor(door / w.map.w) + 0.5) * TILE;
    const inRoom = w.map.roomTiles[enc.index]!.map((i) => ({ x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE })).sort((a, b) => Math.hypot(a.x - dx, a.y - dy) - Math.hypot(b.x - dx, b.y - dy))[0]!;
    w.player.x = (dx + inRoom.x) / 2 + (inRoom.x - dx) * 0.05;
    w.player.y = (dy + inRoom.y) / 2 + (inRoom.y - dy) * 0.05;
    w.input = emptyInput();
    w.step(1 / 60);
    expect(enc.state).toBe('active');
    const start = { x: w.player.x, y: w.player.y };
    for (let i = 0; i < 60; i++) {
      const f = emptyInput();
      f.mx = Math.sign(inRoom.x - dx);
      f.my = Math.sign(inRoom.y - dy);
      w.input = f;
      w.step(1 / 60);
    }
    expect(Math.hypot(w.player.x - start.x, w.player.y - start.y)).toBeGreaterThan(8);
  });

  it('markers sit on walkable ground', () => {
    for (const id of Object.keys(REGIONS) as RegionId[]) {
      const m = parseRegion(REGIONS[id]);
      for (const pm of m.markers) {
        if (pm.marker.kind === 'prop' || pm.marker.kind === 'waystone' || pm.marker.kind === 'dummy') continue;
        const { x, y } = markerPos(pm);
        expect(m.solid[Math.floor(y / TILE) * m.w + Math.floor(x / TILE)], `${id} ${pm.marker.kind} ${pm.tx},${pm.ty}`).toBe(0);
      }
    }
  });
});

describe('sigilfall enemy movement', () => {
  it('a big enemy walks around a pillar instead of into it, even when it can see past it', () => {
    // the Hollow Crypt's east room: the hero and a guardian on either side of the pillar at (47, 42),
    // the line between them just clear of it, but not wide enough for the guardian's body
    const w = newWorld('crypt', readyHero('ranger', 8));
    expect(w.map.kind[42 * w.map.w + 47]).toBe(K.Pillar);
    w.enemies = [];
    const p = w.player;
    p.x = 45.4 * TILE;
    p.y = 40.4 * TILE;
    const e = w.addEnemy('crypt-guardian', 48.5 * TILE, 43.3 * TILE, 6, { room: -1, pack: 0 });
    e.state = 'chase';
    let closest = Infinity;
    for (let t = 0; t < 6; t += 1 / 60) {
      w.input = emptyInput();
      p.iframe = 99;
      p.hp = p.maxHp;
      w.step(1 / 60);
      closest = Math.min(closest, Math.hypot(e.x - p.x, e.y - p.y));
    }
    expect(closest).toBeLessThan(e.def.reach + e.r + p.r + 2);
  });
});
