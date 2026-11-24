import { describe, expect, it } from 'vitest';
import { rng } from '../src/games/sigilfall/core/math';
import { CLASS_IDS, CLASSES } from '../src/games/sigilfall/data/classes';
import { BASES, ITEM_DEFS, ITEMS } from '../src/games/sigilfall/data/items';
import { RIFT_ITEMS, RIFT_TIERS, SETS } from '../src/games/sigilfall/data/riftgear';
import { SLOT_LEGENDS } from '../src/games/sigilfall/data/riftlegends';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import { SLOTS, type ClassId, type Effect, type ItemDef, type Mod, type SlotId, type SlotKey } from '../src/games/sigilfall/data/types';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { modLines } from '../src/games/sigilfall/progress/describe';
import { applyToHero } from '../src/games/sigilfall/progress/gm';
import { droppable, itemMat, makeItem, rollLoot } from '../src/games/sigilfall/progress/items';
import { wager, WAGER_PRICE } from '../src/games/sigilfall/progress/rift';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { brokenNumbers, newWorld, readyHero } from './sigilfall-bot';

/**
 * A Rift legendary on every place a hero wears, for every class (the owner, 2026-11-24: "every item slot should have a
 * legendary for each spec and 3 legendaries common for the class apart from the set items ... check every class and
 * fix it"): on each place, three of the class's own and one for each specialization. These hold that every place
 * has them, that what each names is its class's (and its specialization's), that they come out of the Rift as the
 * weapons do, and that what each does goes off in a fight with the specialization it is made for.
 */

type Spec = 0 | 1 | 2;
const SPECS: Spec[] = [0, 1, 2];
/** A legendary forged in the Rift (not a set piece). */
const riftLegend = (d: ItemDef): boolean => d.rarity === 'legendary' && d.rift !== undefined && !d.set;
const NEW = SLOT_LEGENDS.map((u) => ITEM_DEFS[u.id]!);
const SLOT_WORDS = new Set(['*', 'basic', 'dodge', 'ult']);

const effectsOf = (mods: Mod[]): Effect[] => mods.flatMap((m) => (m.t === 'proc' ? [m.proc.effect] : m.t === 'skill' && 'effect' in m.op ? [m.op.effect] : []));
/** Every skill a list of mods names: what it changes, what a trigger waits on, and what it echoes, readies or strengthens. */
function named(mods: Mod[]): string[] {
  const out: string[] = [];
  for (const m of mods) {
    if (m.t === 'skill') out.push(m.skill);
    if (m.t === 'proc' && m.proc.skill) out.push(m.proc.skill);
  }
  for (const e of effectsOf(mods)) {
    if ((e.kind === 'cast' || e.kind === 'resetCd') && e.skill) out.push(e.skill);
    if (e.kind === 'buff' && e.buff.empower) out.push(e.buff.empower.skill);
  }
  return out;
}
const givesPoints = (mods: Mod[]): boolean => effectsOf(mods).some((e) => e.kind === 'points') || mods.some((m) => m.t === 'skill' && (m.op.op === 'build' || m.op.op === 'spend'));

/** A specialization's own: its ability and ultimate, and every skill its passive, combo and talents name (and its shape's). */
function specCore(cls: ClassId, spec: Spec): Set<string> {
  const def = CLASSES[cls];
  const tree = def.trees[spec]!;
  const ids = new Set<string>([tree.skill, ...(tree.ult ? [tree.ult] : [])]);
  const mods = [...tree.passive.mods, ...(tree.combo?.mods ?? []), ...TALENTS[cls].filter((n) => n.tree === spec).flatMap((n) => n.mods)];
  for (const id of named(mods)) ids.add(id);
  for (const f of def.forms ?? []) if (f.specSwap?.tree === spec) for (const id of [f.skill, f.basic, ...f.skills, f.dodge, f.specSwap.skill]) ids.add(id);
  for (const w of SLOT_WORDS) ids.delete(w);
  return ids;
}
const barOf = (cls: ClassId, spec: Spec): string[] => Object.values(buildHero(readyHero(cls, 60, 'epic', 5, spec)).bar).filter((id): id is string => !!id);
/** What a class's own legendary may name: what every specialization can have on its bar, never one's own ability or ultimate. */
function classWide(cls: ClassId): Set<string> {
  const def = CLASSES[cls];
  const own = new Set(def.trees.flatMap((t) => [t.skill, ...(t.ult ? [t.ult] : [])]));
  return new Set([...SLOT_WORDS, def.basic, def.dodge, ...def.skills].filter((id) => !own.has(id)));
}

describe('Sigilfall: a legendary on every place (2026-11-24)', () => {
  it('has, for every class and every place it wears, one for each specialization and three of the class’s own', () => {
    for (const cls of CLASS_IDS) {
      // (every class has an off-hand of its own to wear: a shield, an orb, a tome or a quiver)
      expect(BASES.some((b) => b.slot === 'offhand' && b.cls === cls), cls).toBe(true);
      for (const slot of SLOTS) {
        const here = RIFT_ITEMS.filter((d) => riftLegend(d) && d.cls === cls && d.slot === slot);
        for (const spec of SPECS) expect(here.filter((d) => d.forSpec === spec).length, `${cls} ${slot} ${CLASSES[cls].trees[spec]!.name}`).toBeGreaterThanOrEqual(1);
        expect(here.filter((d) => d.forSpec === undefined).length, `${cls} ${slot}: the class’s own`).toBeGreaterThanOrEqual(3);
      }
    }
    // (the sets are as they were: six pieces, and nothing of a set is a legendary)
    for (const s of Object.values(SETS)) expect(s.pieces.every((id) => ITEM_DEFS[id]!.rarity === 'set'), s.name).toBe(true);
  });

  it('gives every one a name of its own, a line, a look for its place and something it does', () => {
    const names = ITEMS.map((i) => i.name);
    for (const d of NEW) expect(names.filter((n) => n === d.name), d.name).toHaveLength(1);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    // (a trigger keeps its own clock: no two share one)
    const procs = [...RIFT_ITEMS.flatMap((d) => d.mods), ...Object.values(SETS).flatMap((s) => s.bonuses.flatMap((b) => b.mods))].flatMap((m) => (m.t === 'proc' ? [m.proc.id] : []));
    expect(procs.length - new Set(procs).size).toBe(0);
    const offhand = (cls: ClassId) => new Set(BASES.filter((b) => b.slot === 'offhand' && b.cls === cls).map((b) => b.icon));
    for (const d of RIFT_ITEMS.filter(riftLegend)) {
      expect(d.lore.length, d.name).toBeGreaterThan(12);
      expect(d.lore, d.name).toMatch(/[.!?]$/);
      expect(d.mods.length, d.name).toBeGreaterThan(0);
      expect(d.tint, d.name).toMatch(/^#[0-9a-f]{6}$/);
      // (a cooldown op is how much sooner: the weapons' "-30" made a skill come back slower, until 2026-11-24)
      for (const m of d.mods) if (m.t === 'skill' && m.op.op === 'cooldown') expect(m.op.pct, `${d.name}: ${m.skill}`).toBeGreaterThan(0);
    }
    for (const d of NEW) {
      // something more than a stat: a skill changed, or a trigger
      expect(d.mods.some((m) => m.t !== 'stat'), d.name).toBe(true);
      const lines = modLines(d.mods);
      expect(new Set(lines).size, d.name).toBe(lines.length);
      for (const l of lines) expect(l, d.name).not.toMatch(/undefined|NaN| 0%|-\d+% faster|^(ult|basic|dodge) /);
      expect(new Set(d.stats.map((x) => x.stat)).size, d.name).toBe(2);
      for (const s of d.stats) expect(s.base > 0 && s.per > 0, `${d.name}: ${s.stat}`).toBe(true);
      if (d.slot === 'offhand') expect(offhand(d.cls!).has(d.icon), d.name).toBe(true);
      if (d.slot === 'ring' || d.slot === 'amulet' || d.slot === 'relic') expect(d.icon, d.name).toBe(d.slot);
      if (['head', 'chest', 'legs', 'hands', 'feet'].includes(d.slot)) expect(itemMat(makeItem(d.id, 70)!), d.name).toBe(Object.values(SETS).find((s) => s.cls === d.cls)!.pieces.map((id) => ITEM_DEFS[id]!.mat)[0]);
    }
  });

  it('is written in American English, in the game’s own words', () => {
    const words = NEW.flatMap((d) => [d.name, d.lore, ...modLines(d.mods)]).join(' ');
    expect(words).not.toMatch(/\b(colou?rs? of|colour|armour|grey|honour|favour|defence|centre|metre|theatre|jewellery|plough|mould|sceptre)\b/i);
  });

  it('names only its class’s skills, and a specialization’s piece only what that specialization plays with', () => {
    for (const cls of CLASS_IDS) {
      const wide = classWide(cls);
      const core = SPECS.map((spec) => specCore(cls, spec));
      const bar = SPECS.map((spec) => barOf(cls, spec));
      for (const d of RIFT_ITEMS.filter((x) => riftLegend(x) && x.cls === cls)) {
        const ids = named(d.mods);
        for (const id of ids) expect(SLOT_WORDS.has(id) || SKILLS[id]?.cls === cls, `${d.name}: ${id}`).toBe(true);
        if (d.forSpec === undefined) {
          for (const id of ids) expect(wide.has(id), `${d.name} (the class’s own) names ${id}`).toBe(true);
          continue;
        }
        const spec = d.forSpec;
        const allowed = new Set([...core[spec]!, ...bar[spec]!, ...SLOT_WORDS]);
        for (const id of ids) expect(allowed.has(id), `${d.name} (${CLASSES[cls].trees[spec]!.name}) names ${id}`).toBe(true);
        // made for it: it changes something of the specialization's own, or gives its points
        expect(ids.some((id) => core[spec]!.has(id)) || givesPoints(d.mods), `${d.name} is ${CLASSES[cls].trees[spec]!.name}’s`).toBe(true);
      }
    }
  });

  it('changes every skill it names, for the specialization it is made for', () => {
    const stale: string[] = [];
    for (const cls of CLASS_IDS) {
      for (const spec of SPECS) {
        const c = readyHero(cls, 60, 'epic', 5, spec);
        const before = buildHero(c);
        for (const d of NEW.filter((x) => x.cls === cls && (x.forSpec ?? spec) === spec)) {
          const was = c.equip[d.slot];
          c.equip[d.slot] = makeItem(d.id, 80)!;
          const now = buildHero(c);
          c.equip[d.slot] = was;
          for (const m of d.mods) {
            if (m.t !== 'skill' || m.skill === '*') continue;
            const id = m.skill === 'basic' || m.skill === 'dodge' || m.skill === 'ult' ? before.bar[m.skill]! : m.skill;
            // (a change already at its limit, a cooldown at half or a heal already there, would be a line that does nothing)
            if (JSON.stringify(now.skills[id]?.spec) === JSON.stringify(before.skills[id]?.spec)) stale.push(`${d.name}: ${id} (${m.op.op})`);
          }
          if (d.mods.some((m) => m.t === 'proc')) expect(now.procs.length, d.name).toBeGreaterThan(before.procs.length);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});

describe('Sigilfall: where a place’s legendary comes from', () => {
  it('only out of the Rift: the class’s own at its legendaries’ stone, a specialization’s with its set', () => {
    for (const cls of CLASS_IDS) {
      const mine = NEW.filter((d) => d.cls === cls);
      const at = (stone: number) => new Set(droppable(cls, 100, 'legendary', stone).map((d) => d.id));
      for (const d of mine) {
        expect(at(0).has(d.id), d.name).toBe(false);
        expect(at(RIFT_TIERS.legendary).has(d.id), d.name).toBe(RIFT_TIERS.legendary >= d.rift!);
        expect(at(RIFT_TIERS.classLegendary).has(d.id), d.name).toBe(d.forSpec === undefined);
        expect(at(RIFT_TIERS.specSet).has(d.id), d.name).toBe(true);
        expect(d.rift, d.name).toBe(d.forSpec === undefined ? RIFT_TIERS.classLegendary : RIFT_TIERS.specSet);
      }
      // never another class's
      expect([...at(99)].every((id) => !ITEM_DEFS[id]!.cls || ITEM_DEFS[id]!.cls === cls), cls).toBe(true);
    }
  });

  it('drops in a Riftstone run on every place, and the Riftbroker deals one for every place', () => {
    for (const cls of ['mage', 'gloamknight'] as const) {
      const r = rng(cls.length);
      const seen = new Set<SlotId>();
      for (let i = 0; i < 3000; i++) {
        const it = rollLoot(cls, 90, 'boss', 2, r, 6);
        const d = ITEM_DEFS[it.base];
        if (d && NEW.includes(d)) {
          expect(d.cls, d.name).toBe(cls);
          seen.add(d.slot);
        }
      }
      expect([...seen].sort(), cls).toEqual(SLOTS.filter((s) => s !== 'weapon').sort());
      const c = readyHero(cls, 60, 'epic', 5);
      c.keystone = 6;
      c.marks = WAGER_PRICE * 9 * 60;
      for (const slot of SLOTS.filter((s) => s !== 'weapon')) {
        let got = 0;
        for (let i = 0; i < 60; i++) {
          c.bag.length = 0;
          const it = wager(c, slot, r)!;
          if (NEW.some((d) => d.id === it.base)) got++;
        }
        expect(got, `${cls} ${slot}`).toBeGreaterThan(0);
      }
    }
  });

  it('can be given from the admin panel, every one', () => {
    for (const cls of CLASS_IDS) {
      // (the panel lists every item the hero's class can have)
      const listed = new Set(ITEMS.filter((i) => !i.cls || i.cls === cls).map((i) => i.id));
      const c = readyHero(cls, 60, 'epic', 5);
      for (const d of NEW.filter((x) => x.cls === cls)) {
        expect(listed.has(d.id), d.name).toBe(true);
        c.bag.length = 0;
        expect(applyToHero(c, 'item', { id: d.id, il: 80 }), d.name).toBe('');
        expect(c.bag.at(-1)?.base, d.name).toBe(d.id);
      }
    }
  });
});

describe('Sigilfall: what a place’s legendary does goes off in a fight', () => {
  /**
   * A hero of a specialization, wearing these, in a fight for a while: a few foes that stand, and a few that fall
   * (so that what a kill sets off goes off), every skill on the bar in turn, the dodge and the ultimate every so often,
   * and a blow taken now and then. Which of the hero's triggers went off.
   */
  function fight(cls: ClassId, spec: Spec, wear: ItemDef[], seconds = 14): { fired: Set<string>; w: World } {
    const c = readyHero(cls, 60, 'epic', 5, spec);
    for (const d of wear) c.equip[d.slot] = makeItem(d.id, 90)!;
    const w = newWorld('whisperwood', c, 3);
    const fired = new Set<string>();
    // (a trigger that goes off starts its own clock, `icd` from now: sim/combat.ts runProcs. A clock set otherwise, as
    // a timed one's is out of a fight, is not it going off)
    const icd = new Map(wear.flatMap((d) => d.mods.flatMap((m) => (m.t === 'proc' ? [[m.proc.id, m.proc.icd] as const] : []))));
    w.procCd = new Proxy(w.procCd, {
      set: (t, k, v: number) => {
        const id = String(k);
        if (icd.has(id) && Math.abs(v - (w.time + icd.get(id)!)) < 1e-9) fired.add(id);
        t[id] = v;
        return true;
      },
    });
    const foe = (dx: number, dy: number, hp: number): Enemy => {
      const e = w.addEnemy('skeleton', w.player.x + dx, w.player.y + dy, 60, { room: -1, pack: -1, spawn: false });
      e.hp = e.maxHp = hp;
      return e;
    };
    for (let i = 0; i < 3; i++) foe(50 + i * 12, (i - 1) * 20, 1e6);
    const tough = w.enemies.slice(-3);
    let weak: Enemy[] = [];
    const rotation = ['s1', 's2', 's3', 's4'] as const;
    let turn = 0;
    for (let t = 0; t < 60 * seconds; t++) {
      weak = weak.filter((e) => !e.dead);
      while (weak.length < 2) weak.push(foe(36 + weak.length * 20, weak.length ? 26 : -26, 500));
      const p = w.player;
      // the basic attack whenever nothing else goes; a skill in turn, the dodge and the ultimate every so often
      let slot: SlotKey = 'basic';
      if (t % 90 === 45) slot = 'dodge';
      else if (t % 120 === 60) {
        slot = 'ult';
        p.ult = 100;
      } else if (t % 15 === 0 && !p.casting && !p.channel) slot = rotation[turn++ % rotation.length]!;
      w.input = { ...w.input, casts: [{ slot, angle: null, dist: null, assist: 0 }] };
      // and a blow taken every second, whatever the foes are doing (stunned, frozen, fled)
      const by = tough.find((e) => !e.dead);
      if (t % 60 === 30 && by) hurtPlayer(w, 20, { source: by, fromX: by.x, fromY: by.y });
      p.hp = p.maxHp;
      w.step(1 / 60);
    }
    return { fired, w };
  }
  const triggers = (d: ItemDef) => d.mods.flatMap((m) => (m.t === 'proc' ? [m.proc] : []));

  it('a specialization’s nine, worn together by that specialization', () => {
    const quiet: string[] = [];
    for (const cls of CLASS_IDS) {
      for (const spec of SPECS) {
        const wear = NEW.filter((d) => d.cls === cls && d.forSpec === spec);
        expect(wear.length).toBe(9);
        const { fired, w } = fight(cls, spec, wear);
        expect(brokenNumbers(w), `${cls} ${spec}`).toBeNull();
        for (const d of wear) for (const p of triggers(d)) if (!fired.has(p.id)) quiet.push(`${cls} ${CLASSES[cls].trees[spec]!.name}, ${d.name}: ${p.text}`);
      }
    }
    expect(quiet).toEqual([]);
  }, 300_000);

  it('the class’s own, a third of them with each specialization', () => {
    const quiet: string[] = [];
    for (const cls of CLASS_IDS) {
      const own = RIFT_ITEMS.filter((d) => riftLegend(d) && d.cls === cls && d.forSpec === undefined && d.slot !== 'weapon');
      for (const spec of SPECS) {
        // (on every place, the class's first, second or third)
        const wear = SLOTS.filter((s) => s !== 'weapon').map((slot) => own.filter((d) => d.slot === slot)[spec]!);
        const { fired, w } = fight(cls, spec, wear);
        expect(brokenNumbers(w), `${cls} ${spec}`).toBeNull();
        for (const d of wear.filter((x) => NEW.includes(x))) for (const p of triggers(d)) if (!fired.has(p.id)) quiet.push(`${cls} ${CLASSES[cls].trees[spec]!.name}, ${d.name}: ${p.text}`);
      }
    }
    expect(quiet).toEqual([]);
  }, 300_000);
});
