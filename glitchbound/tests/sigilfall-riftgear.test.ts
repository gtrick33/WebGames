import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, xpToNext } from '../src/games/sigilfall/data/classes';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { keyLoot } from '../src/games/sigilfall/data/keystones';
import { PETS } from '../src/games/sigilfall/data/pets';
import { RIFT_ITEMS, RIFT_TIERS, riftPool, SETS } from '../src/games/sigilfall/data/riftgear';
import { SLOT_LEGENDS } from '../src/games/sigilfall/data/riftlegends';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId, Effect, Mod, SlotId } from '../src/games/sigilfall/data/types';
import { buildHero, collectMods, setsWorn } from '../src/games/sigilfall/progress/build';
import { addXp, chooseSpec, newCharacter, salvage, seatSpecSkill, slotOpen } from '../src/games/sigilfall/progress/character';
import { modLines } from '../src/games/sigilfall/progress/describe';
import { droppable, itemWorth, makeItem, rollLoot, salvageValue } from '../src/games/sigilfall/progress/items';
import { cantWager, riftFirsts, stoneRows, wager, WAGER_PRICE, wagerOdds } from '../src/games/sigilfall/progress/rift';
import { sellPrice, stockFor } from '../src/games/sigilfall/progress/shop';
import { tipDue, tipSteps } from '../src/games/sigilfall/progress/tips';
import { rng } from '../src/games/sigilfall/core/math';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The endgame's own gear, found only in the Rift: for every class a set of its own and one for each specialization,
 * six pieces each with bonuses at two, four and six; and legendaries, a power for all of a class's play, or anyone's
 * (the owner, 2026-11-22). These hold what a player is told about it: what each piece and bonus changes is real, the
 * Rift is the only place it comes from, every new stone gives one, and the Riftbroker's odds are what the table says.
 */

const effectsOf = (mods: Mod[]): Effect[] => mods.flatMap((m) => (m.t === 'proc' ? [m.proc.effect] : m.t === 'skill' && 'effect' in m.op ? [m.op.effect] : []));
const classSkill = (cls: ClassId, id: string): boolean => id === '*' || id === 'basic' || id === 'dodge' || id === 'ult' || SKILLS[id]?.cls === cls;
const SIX = ['head', 'chest', 'legs', 'hands', 'feet', 'ring'];
/** The weapons of 2026-11-23 (the class's three of each, by id: the legendaries of before that are weapons are not). */
/** The legendaries on every other place, of 2026-11-24 (tests/sigilfall-legend-slots.test.ts holds them). */
const SLOT_IDS = new Set(SLOT_LEGENDS.map((u) => u.id));
const slotLegends = (cls: ClassId, spec?: 'class' | 'spec'): number => SLOT_LEGENDS.filter((u) => u.cls === cls && (spec === undefined || (spec === 'class') === (u.spec === undefined))).length;
const WEAPON_IDS = new Set(RIFT_ITEMS.filter((d) => d.slot === 'weapon' && d.rarity === 'legendary' && d.cls && !['rift-red-appetite', 'rift-grievance', 'rift-thunderwrit', 'rift-long-look', 'rift-morningbell', 'rift-final-reading', 'rift-dawnhymn', 'rift-ruinspeaker', 'rift-nightpool-branch', 'rift-creditor', 'rift-graveweight'].includes(d.id)).map((d) => d.id));

describe('Sigilfall: Rift-forged gear', () => {
  it('has, for every class, its own set and one for each specialization, six pieces each, and three legendaries', () => {
    for (const cls of CLASS_IDS) {
      const sets = Object.values(SETS).filter((s) => s.cls === cls);
      expect(sets.length, cls).toBe(4);
      expect(sets.filter((s) => s.spec === undefined).length, cls).toBe(1);
      expect(sets.flatMap((s) => (s.spec === undefined ? [] : [s.spec])).sort(), cls).toEqual([0, 1, 2]);
      for (const s of sets) {
        expect(s.pieces.map((id) => ITEM_DEFS[id]!.slot), s.name).toEqual(SIX);
        expect(s.pieces.every((id) => ITEM_DEFS[id]!.rarity === 'set'), s.name).toBe(true);
        expect(s.bonuses.map((b) => b.need), s.name).toEqual([2, 4, 6]);
      }
      // three legendaries of the class's own; and its weapons, three for the class and two for each specialization (2026-11-23)
      const weapons = RIFT_ITEMS.filter((d) => d.cls === cls && d.rarity === 'legendary' && d.slot === 'weapon' && (d.forSpec !== undefined || WEAPON_IDS.has(d.id)));
      expect(weapons.filter((d) => d.forSpec === undefined).length, cls).toBe(3);
      for (const spec of [0, 1, 2]) expect(weapons.filter((d) => d.forSpec === spec).length, `${cls} ${spec}`).toBe(2);
      // (and since 2026-11-24 one on every other place for each specialization, and three of the class's own)
      expect(RIFT_ITEMS.filter((d) => d.cls === cls && d.rarity === 'legendary').length, cls).toBe(3 + 9 + slotLegends(cls));
    }
    // and anyone's legendaries, on the places a set leaves free or a ring
    const anyone = RIFT_ITEMS.filter((d) => !d.cls);
    expect(anyone.length).toBeGreaterThanOrEqual(6);
    expect(anyone.every((d) => d.rarity === 'legendary')).toBe(true);
    expect(new Set(RIFT_ITEMS.map((d) => d.id)).size).toBe(RIFT_ITEMS.length);
    expect(new Set(RIFT_ITEMS.map((d) => d.name)).size).toBe(RIFT_ITEMS.length);
  });

  it('keeps every piece saved before under its id: the old set pieces and the specialization pieces', () => {
    for (const id of ['rift-stonehewer-hands', 'rift-stonehewer-legs', 'rift-stonehewer-feet', 'rift-rimeglass-hands', 'rift-red-appetite', 'rift-thunderwrit', 'rift-shepherds-bell']) expect(ITEM_DEFS[id], id).toBeTruthy();
    // (a legendary of before is a power for the class, whatever the specialization: only the weapons, and the other
    // places' legendaries of 2026-11-24, are a specialization's)
    expect(RIFT_ITEMS.filter((d) => d.rarity === 'legendary' && d.forSpec !== undefined && d.slot !== 'weapon' && !SLOT_IDS.has(d.id))).toEqual([]);
  });

  it('changes only its own class’s skills, with effects the game has', () => {
    // (a set's pieces carry nothing by themselves: what they do is the set's)
    const all: { who: string; cls: ClassId | undefined; mods: Mod[] }[] = [...RIFT_ITEMS.filter((d) => !d.set).map((d) => ({ who: d.name, cls: d.cls, mods: d.mods })), ...Object.values(SETS).flatMap((s) => s.bonuses.map((b) => ({ who: `${s.name} (${b.need})`, cls: s.cls, mods: b.mods })))];
    for (const { who, cls, mods } of all) {
      expect(mods.length, who).toBeGreaterThan(0);
      for (const m of mods) {
        if (m.t === 'skill') expect(cls ? classSkill(cls, m.skill) : m.skill === '*' || m.skill === 'basic', `${who}: ${m.skill}`).toBe(true);
        if (m.t === 'proc' && m.proc.skill) expect(cls && classSkill(cls, m.proc.skill), `${who}: ${m.proc.skill}`).toBe(true);
      }
      for (const e of effectsOf(mods)) {
        if (e.kind === 'summon') expect(PETS[e.pet], `${who}: ${e.pet}`).toBeTruthy();
        if (e.kind === 'buff' && e.buff.empower) expect(cls && classSkill(cls, e.buff.empower.skill), `${who}: ${e.buff.empower.skill}`).toBe(true);
        // (an echo is of a skill of the class, or the basic attack of whoever wears it)
        if (e.kind === 'cast') expect(e.skill === 'basic' || (!!cls && SKILLS[e.skill]?.cls === cls), `${who}: an echo of ${e.skill}`).toBe(true);
      }
    }
  });

  it('builds a specialization’s set around that specialization’s own ability, six pieces multiplying it', () => {
    for (const s of Object.values(SETS).filter((x) => x.spec !== undefined)) {
      const own = CLASSES[s.cls].trees[s.spec!]!.skill;
      const all = s.bonuses.flatMap((b) => b.mods);
      // (Pack Law and the Pit Covenant are their companions' sets: they make the pack, not the call)
      const pets = all.some((m) => m.t === 'stat' && m.stat === 'pet');
      expect(pets || all.some((m) => m.t === 'skill' && m.skill === own), `${s.name} changes ${own}`).toBe(true);
      const six = s.bonuses.find((b) => b.need === 6)!;
      expect(pets || six.mods.some((m) => m.t === 'skill' && m.op.op === 'damage' && m.op.pct >= 200), `${s.name}: six multiplies`).toBe(true);
    }
  });

  it('says what every piece and every set bonus does, in words', () => {
    for (const d of RIFT_ITEMS.filter((x) => !x.set)) {
      const lines = modLines(d.mods);
      expect(lines.length, d.name).toBeGreaterThan(0);
      for (const l of lines) expect(l, d.name).not.toMatch(/undefined|NaN| 0%/);
    }
    for (const s of Object.values(SETS)) for (const b of s.bonuses) expect(b.text.length, s.name).toBeGreaterThan(20);
  });

  it('builds into a hero: every legendary worn changes a skill, a stat or adds a trigger', () => {
    for (const cls of CLASS_IDS) {
      for (const d of RIFT_ITEMS.filter((x) => (x.cls === cls || !x.cls) && x.rarity === 'legendary')) {
        const c = readyHero(cls, 60, 'epic', 5, d.forSpec ?? 0);
        const was = buildHero(c);
        const before = JSON.stringify(was.skills) + was.procs.length + JSON.stringify(was.stats);
        c.equip[d.slot] = makeItem(d.id, 80)!;
        const now = buildHero(c);
        expect(JSON.stringify(now.skills) + now.procs.length + JSON.stringify(now.stats), `${cls}: ${d.name}`).not.toBe(before);
      }
    }
  });
});

describe('Sigilfall: sets', () => {
  // (the owner's screenshot deck, 2026-11-23: a set piece's card offered "Salvage · NaN gold", and melting one
  // down made the hero's gold NaN, which a save keeps as nothing: every coin gone at the next load)
  it('melt down and sell for gold like a legendary, never for NaN', () => {
    for (const set of Object.values(SETS)) {
      for (const id of set.pieces) {
        const it = makeItem(id, 80)!;
        expect(Number.isFinite(salvageValue(it)) && salvageValue(it) > 0, id).toBe(true);
        expect(sellPrice(it)).toBe(salvageValue(it));
        expect(itemWorth(it)).toBe(itemWorth({ il: 80, r: 'legendary' }));
      }
    }
    const c = readyHero('priest', 60, 'epic', 5, 1);
    c.gold = 1000;
    const piece = makeItem(SETS[Object.keys(SETS)[0]!]!.pieces[0]!, 80)!;
    c.bag.push(piece);
    const got = salvage(c, piece.uid);
    expect(got).toBeGreaterThan(0);
    expect(c.gold).toBe(1000 + got);
  });

  const wearing = (cls: ClassId, n: number, spec?: 0 | 1 | 2) => {
    const c = readyHero(cls, 60, 'epic', 5, spec ?? 0);
    const set = Object.values(SETS).find((s) => s.cls === cls && s.spec === spec)!;
    for (const id of set.pieces.slice(0, n)) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 80)!;
    return { c, set };
  };

  it('counts the pieces worn and gives each bonus only from its count', () => {
    for (const cls of CLASS_IDS) {
      for (const n of [0, 1, 2, 3, 4, 5, 6]) {
        const { c, set } = wearing(cls, n);
        expect(setsWorn(c.equip)[0]?.worn ?? 0, `${cls} ${n}`).toBe(n);
        const from = collectMods(c).filter((e) => e.source.name === set.name).length;
        const want = set.bonuses.filter((b) => n >= b.need).reduce((a, b) => a + b.mods.length, 0);
        expect(from, `${cls} wearing ${n}`).toBe(want);
      }
    }
  });

  it('gives a warrior a bleeding Cleave at two, a second Heavy Strike at four, and at six a Heavy Strike three and a half times as hard that Cleave echoes', () => {
    const two = buildHero(wearing('warrior', 2).c);
    expect(two.skills.cleave!.spec.onHit.some((e) => e.kind === 'status' && e.status === 'bleed')).toBe(true);
    expect(two.skills['heavy-strike']!.spec.charges).toBe(1);
    const four = buildHero(wearing('warrior', 4).c);
    expect(four.skills['heavy-strike']!.spec.charges).toBe(2);
    expect(four.skills['heavy-strike']!.spec.onCast.some((e) => e.kind === 'shockwave')).toBe(true);
    const six = buildHero(wearing('warrior', 6).c);
    expect(six.skills['heavy-strike']!.spec.damage / four.skills['heavy-strike']!.spec.damage).toBeCloseTo(3.5, 1);
    expect(six.procs.some((p) => p.skill === 'cleave' && p.effect.kind === 'cast' && p.effect.skill === 'heavy-strike')).toBe(true);
  });

  it('four of one set and two of another: both count', () => {
    const c = readyHero('mage', 60, 'epic', 5, 2);
    const own = Object.values(SETS).find((s) => s.cls === 'mage' && s.spec === undefined)!;
    const winter = Object.values(SETS).find((s) => s.cls === 'mage' && s.spec === 2)!;
    for (const id of own.pieces.slice(0, 4)) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 80)!;
    for (const id of winter.pieces.slice(4, 6)) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 80)!;
    expect(setsWorn(c.equip).map((s) => [s.set.id, s.worn]).sort()).toEqual([[own.id, 4], [winter.id, 2]].sort());
    const b = buildHero(c);
    expect(b.skills['ice-lance']!.spec.pierce).toBeGreaterThanOrEqual(3);
    expect(b.skills['arcane-bolt']!.spec.count).toBeGreaterThanOrEqual(3);
  });
});

describe('Sigilfall: echoes, the sets’ and legendaries’ own spells', () => {
  it('an echo casts the hero’s own skill at the nearest foe, for nothing, and never echoes an echo', () => {
    const c = readyHero('mage', 60, 'epic', 5, 2);
    const w = newWorld('whisperwood', c, 3);
    const foe = w.addEnemy('skeleton', w.player.x + 60, w.player.y, 60, { room: -1, pack: -1, spawn: false })!;
    foe.hp = foe.maxHp = 1e7;
    const mana = w.player.mana;
    const before = w.projectiles.length;
    w.echo('arcane-bolt', 1);
    expect(w.projectiles.length).toBeGreaterThan(before);
    expect(w.player.mana).toBe(mana);
    // (inside an echo, another is nothing)
    w.echoing = true;
    const mid = w.projectiles.length;
    w.echo('arcane-bolt', 1);
    expect(w.projectiles.length).toBe(mid);
    w.echoing = false;
    // and with nobody near, nothing is cast
    foe.dead = true;
    const after = w.projectiles.length;
    w.echo('arcane-bolt', 1);
    expect(w.projectiles.length).toBe(after);
  });

  it('a power that goes by itself goes every so often in a fight, and not out of one', () => {
    const c = readyHero('mage', 60, 'epic', 5);
    const own = Object.values(SETS).find((s) => s.cls === 'mage' && s.spec === undefined)!;
    for (const id of own.pieces) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 80)!;
    const w = newWorld('whisperwood', c, 3);
    w.enemies.length = 0;
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60);
    const alone = w.projectiles.length;
    expect(alone).toBe(0);
    const foe = w.addEnemy('skeleton', w.player.x + 70, w.player.y, 60, { room: -1, pack: -1, spawn: false })!;
    foe.hp = foe.maxHp = 1e7;
    let fired = 0;
    for (let i = 0; i < 60 * 5; i++) {
      const n = w.projectiles.length;
      w.step(1 / 60);
      if (w.projectiles.length > n) fired++;
    }
    // (Rimeglass at six: an Arcane Bolt every 1.5 s, three to a volley)
    expect(fired).toBeGreaterThanOrEqual(2);
    expect(fired).toBeLessThanOrEqual(5);
  });
});

describe('Sigilfall: sets and weapons with every specialization’s talents (2026-11-23, "in a symbiose")', () => {
  // what a set's bonuses and a weapon change, for a hero of its specialization with all their talents
  const touched = (mods: Mod[]): string[] => mods.flatMap((m) => (m.t === 'skill' && !['*', 'basic', 'dodge', 'ult'].includes(m.skill) ? [m.skill] : []));
  const echoes = (mods: Mod[]): string[] => effectsOf(mods).flatMap((e) => (e.kind === 'cast' && e.skill !== 'basic' ? [e.skill] : []));

  it('every skill a set or a weapon changes or echoes is one its own specialization has, talents and all', () => {
    for (const cls of CLASS_IDS) {
      for (const spec of [0, 1, 2] as const) {
        const c = readyHero(cls, 60, 'epic', 5, spec);
        const b = buildHero(c);
        const mine = [...Object.values(SETS).filter((s) => s.cls === cls && (s.spec === undefined || s.spec === spec)).flatMap((s) => s.bonuses.flatMap((x) => x.mods)), ...RIFT_ITEMS.filter((d) => d.cls === cls && !d.set && (d.forSpec === undefined || d.forSpec === spec)).flatMap((d) => d.mods)];
        for (const id of [...touched(mine), ...echoes(mine)]) expect(b.skills[id], `${cls} ${CLASSES[cls].trees[spec]!.name}: ${id}`).toBeTruthy();
        // an echo is never of something it can't cast: a step, a dash, a change of shape, a held channel
        for (const id of echoes(mine)) expect(['blink', 'dash', 'form', 'channel', 'drain'].includes(b.skills[id]!.spec.cast), `${cls}: an echo of ${id} (${b.skills[id]!.spec.cast})`).toBe(false);
      }
    }
  });

  it('names every skill in its own words as the game calls it', () => {
    for (const s of Object.values(SETS)) {
      for (const b of s.bonuses) for (const id of touched(b.mods)) expect(b.text, `${s.name} (${b.need}): ${id}`).toContain(SKILLS[id]!.name);
    }
    for (const d of RIFT_ITEMS) for (const m of d.mods) if (m.t === 'proc') for (const id of echoes([m])) expect(m.proc.text, `${d.name}: ${id}`).toContain(SKILLS[id]!.name);
  });

  it('a whole set and each of its weapons fights a while with every specialization, and its echoes go off', () => {
    for (const cls of CLASS_IDS) {
      for (const spec of [0, 1, 2] as const) {
        const set = Object.values(SETS).find((s) => s.cls === cls && s.spec === spec)!;
        for (const weapon of RIFT_ITEMS.filter((d) => d.cls === cls && d.forSpec === spec && d.slot === 'weapon')) {
          const c = readyHero(cls, 60, 'epic', 5, spec);
          for (const id of set.pieces) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 90)!;
          c.equip.weapon = makeItem(weapon.id, 90)!;
          const w = newWorld('whisperwood', c, 3);
          for (let i = 0; i < 3; i++) {
            const foe = w.addEnemy('skeleton', w.player.x + 50 + i * 12, w.player.y + (i - 1) * 20, 60, { room: -1, pack: -1, spawn: false })!;
            foe.hp = foe.maxHp = 1e6;
          }
          const slots = ['basic', 's1', 's2', 's3', 's4', 'ult'] as const;
          expect(() => {
            for (let t = 0; t < 60 * 8; t++) {
              w.input = { ...w.input, casts: t % 20 === 0 ? [{ slot: slots[(t / 20) % slots.length]!, angle: null, dist: null, assist: 0 }] : [] };
              w.player.hp = w.player.maxHp;
              w.step(1 / 60);
            }
          }, `${set.name} with ${weapon.name}`).not.toThrow();
          const hurt = w.enemies.filter((e) => e.hp < e.maxHp).length;
          expect(hurt, `${cls} ${spec}: ${weapon.name}`).toBeGreaterThan(0);
        }
      }
    }
  }, 300_000);
});

describe('Sigilfall: only the Rift gives it', () => {
  it('never drops outside the Rift, and never before its stone', () => {
    for (const cls of CLASS_IDS) {
      expect(droppable(cls, 100, 'legendary').some((d) => d.rift !== undefined), cls).toBe(false);
      expect(droppable(cls, 100, 'set').length, cls).toBe(0);
      // the class's own set and anyone's legendaries at +1; its own legendaries at +2; the specializations' sets at +3
      expect(droppable(cls, 100, 'set', RIFT_TIERS.classSet).length, cls).toBe(6);
      expect(droppable(cls, 100, 'set', RIFT_TIERS.specSet).length, cls).toBe(24);
      const leg = (stone: number): number => droppable(cls, 100, 'legendary', stone).filter((d) => d.rift !== undefined).length;
      // (its three legendaries and three weapons at +2, with the class's own on every other place; its specializations'
      // six weapons and their pieces for every other place with their sets at +3)
      expect(leg(RIFT_TIERS.classLegendary) - leg(RIFT_TIERS.legendary), cls).toBe(6 + slotLegends(cls, 'class'));
      expect(leg(RIFT_TIERS.specSet) - leg(RIFT_TIERS.classLegendary), cls).toBe(6 + slotLegends(cls, 'spec'));
    }
  });

  it('drops a set piece or a legendary far more often in a Riftstone run than any legendary outside it', () => {
    const r = rng(5);
    let rift = 0;
    let plain = 0;
    for (let i = 0; i < 2000; i++) {
      const a = rollLoot('warrior', 90, 'boss', 2, r, 6);
      if (a.r === 'set' || (a.r === 'legendary' && ITEM_DEFS[a.base]?.rift !== undefined)) rift++;
      const b = rollLoot('warrior', 90, 'boss', 2, r, 0);
      if (b.r === 'set' || b.r === 'legendary') plain++;
    }
    expect(rift / 2000).toBeGreaterThan(0.4);
    expect(rift).toBeGreaterThan(plain * 1.3);
  });

  it('is not on the quartermaster’s shelf', () => {
    for (const cls of CLASS_IDS) {
      const c = readyHero(cls, 60, 'epic', 5);
      expect(stockFor(c, 'quartermaster').some((s) => ITEM_DEFS[s.item.base]?.rift !== undefined), cls).toBe(false);
    }
  });

  it('gives a piece the hero lacks for every new stone, the class’s set and the legendaries first, their own specialization’s set before the others', () => {
    const c = readyHero('mage', 60, 'epic', 5, 1);
    const first = riftFirsts(c, 1, 1);
    expect(first[0]!.rift).toBe(1);
    // three stones opened at once: three pieces, and never the one already in the bag
    c.bag.push(makeItem(first[0]!.id, 73)!);
    const next = riftFirsts(c, 5, 3);
    expect(next.length).toBe(3);
    expect(next.some((d) => d.id === first[0]!.id)).toBe(false);
    // nothing for a hero below the top level, or with no new stone
    expect(riftFirsts(readyHero('mage', 40, 'rare', 5), 5, 2)).toEqual([]);
    expect(riftFirsts(c, 5, 0)).toEqual([]);
    // (four sets of six, three of its own legendaries, its weapons, a legendary of its own on every other place, and anyone's)
    expect(riftPool('mage', 99).length).toBe(24 + 3 + 9 + slotLegends('mage') + RIFT_ITEMS.filter((d) => !d.cls).length);
    // of the specializations' sets, its own comes first: with all the rest in the bag, the next stone gives one of those
    const held = { ...c, bag: riftPool('mage', 2).map((d) => makeItem(d.id, 73)!) };
    expect(riftFirsts(held, 3, 1)[0]!.forSpec).toBe(1);
  });

  it('drops the new stone’s piece when a run in time opens one', () => {
    const c = readyHero('warrior', 60, 'epic', 5);
    c.keystone = 1;
    const w = newWorld('crypt', c, 3, 2);
    const run = (): NonNullable<World['keyRun']> => ({ key: 1, heroLevel: 60, par: 600, t: 100, deaths: 0, affixes: [], end: null }) as unknown as NonNullable<World['keyRun']>;
    w.keyRun = run();
    const before = w.drops.length;
    (w as unknown as { finishKeyRun: (t: number, up: number, x: number, y: number) => void }).finishKeyRun(100, 1, w.player.x, w.player.y);
    expect(c.keystone).toBe(2);
    const forged = w.keyRun!.end!.forged!;
    expect(forged.length).toBe(1);
    expect(w.drops.slice(before).some((d) => d.item && ITEM_DEFS[d.item.base]?.rift !== undefined)).toBe(true);
    // (a second run at the same stone opens nothing new: no piece)
    w.keyRun = run();
    c.keystone = 4;
    (w as unknown as { finishKeyRun: (t: number, up: number, x: number, y: number) => void }).finishKeyRun(100, 1, w.player.x, w.player.y);
    expect(w.keyRun!.end!.forged).toEqual([]);
  });
});

describe('Sigilfall: the Riftbroker', () => {
  it('refuses a hero below the top level, without a stone, without the marks or with a full bag', () => {
    const low = readyHero('ranger', 40, 'rare', 5);
    low.marks = 99;
    low.keystone = 3;
    expect(cantWager(low)).toMatch(/level/);
    const c = readyHero('ranger', 60, 'epic', 5);
    c.marks = 99;
    c.keystone = 0;
    expect(cantWager(c)).toMatch(/Riftstone/);
    c.keystone = 3;
    c.marks = WAGER_PRICE - 1;
    expect(cantWager(c)).toMatch(/Marks/);
    expect(wager(c, 'hands')).toBeNull();
    c.marks = WAGER_PRICE;
    expect(cantWager(c)).toBeNull();
  });

  it('takes the marks and gives one piece for the slot, at the stone’s item level', () => {
    const c = readyHero('ranger', 60, 'epic', 5);
    c.keystone = 6;
    c.marks = WAGER_PRICE * 400;
    const r = rng(11);
    const got: Record<string, number> = { rare: 0, epic: 0, legendary: 0, set: 0 };
    let forged = 0;
    for (let i = 0; i < 400; i++) {
      c.bag.length = 0;
      const slot: SlotId = i % 2 ? 'hands' : 'weapon';
      const it = wager(c, slot, r)!;
      expect(it).toBeTruthy();
      expect(ITEM_DEFS[it.base]?.slot ?? slot).toBe(slot);
      expect(it.il).toBe(keyLoot(6));
      got[it.r] = (got[it.r] ?? 0) + 1;
      if (ITEM_DEFS[it.base]?.rift !== undefined) forged++;
    }
    expect(c.marks).toBe(0);
    // the table's odds, near enough over 400 turns: a set piece on the gloves, on the weapon (no set is worn there) a
    // legendary in its place; gloves have no epic of their own (those turn rare), and since 2026-11-24 legendaries of
    // their own
    const odds = wagerOdds(6);
    expect(got.set! / 200).toBeGreaterThan(odds.set * 0.6);
    expect(got.set! / 200).toBeLessThan(odds.set * 1.6);
    // (at least the weapon's: its own and its set chance besides, and the gloves' own now as well)
    expect(got.legendary! / 200).toBeGreaterThan((odds.legendary + odds.set) * 0.75);
    expect((got.legendary! + got.set!) / 400).toBeGreaterThan(0.3);
    expect(forged).toBeGreaterThan(100);
  });

  it('never deals a Rift-forged piece the hero’s stone has not opened', () => {
    const c = readyHero('priest', 60, 'epic', 5);
    c.keystone = 1;
    c.marks = WAGER_PRICE * 300;
    const r = rng(4);
    for (let i = 0; i < 300; i++) {
      c.bag.length = 0;
      const it = wager(c, (['legs', 'weapon', 'relic', 'amulet'] as const)[i % 4]!, r)!;
      expect(ITEM_DEFS[it.base]?.rift ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('has a row in the guide for each stone that opens something', () => {
    const rows = stoneRows('druid', false);
    expect(rows[0]!.stone).toBe(1);
    expect(rows[0]!.opens.join(' ')).toMatch(/six pieces/);
    expect(rows.find((r) => r.stone === RIFT_TIERS.classLegendary)!.opens.join(' ')).toMatch(/legendaries/);
    expect(rows.find((r) => r.stone === RIFT_TIERS.specSet)!.opens.join(' ')).toMatch(/specialization/);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.il).toBeGreaterThan(rows[i - 1]!.il);
    expect(rows[rows.length - 1]!.il).toBe(100);
  });
});

describe('Sigilfall: the Rift hint', () => {
  it('is for a hero at the endgame’s door, old or new, and not for one who has climbed already', () => {
    const fresh = readyHero('warrior', 60, 'epic', 5);
    fresh.keystone = 1;
    expect(tipDue(fresh, true, 'rift')).toBe(true);
    expect(tipDue(fresh, false, 'rift')).toBe(false);
    fresh.keystone = 7;
    expect(tipDue(fresh, true, 'rift')).toBe(false);
    const steps = tipSteps('rift', { touch: true, bar: {}, resource: null, specChosen: true });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.map((s) => s.text).join(' ')).toMatch(/waystone/);
    expect(steps.map((s) => s.text).join(' ')).toMatch(/Quartermaster|Riftbroker/);
  });
});

describe('Sigilfall: a specialization’s ability is on the bar from the moment it is chosen', () => {
  it('goes in a slot that is open at level 10, not the one that opens at 15', () => {
    for (const cls of CLASS_IDS) {
      const c = newCharacter(cls, 'P', 'p', 0);
      while (c.level < 10) addXp(c, xpToNext(c.level));
      chooseSpec(c, 0);
      const tree = CLASSES[cls].trees[0]!;
      if (tree.formOnly) continue;
      const at = c.skills.indexOf(tree.skill);
      expect(at, cls).toBeGreaterThanOrEqual(0);
      expect(slotOpen(c, at as 0), `${cls}: ${tree.skill} in slot ${at + 1}`).toBe(true);
      expect(buildHero(c).skills[tree.skill], cls).toBeTruthy();
      // what it took the place of comes back when the fourth slot opens
      const before = c.skills.filter(Boolean).length;
      while (c.level < 15) addXp(c, xpToNext(c.level));
      expect(c.skills.filter(Boolean).length, cls).toBeGreaterThanOrEqual(before);
      expect(c.skills.includes(tree.skill)).toBe(true);
    }
  });

  it('puts right a hero saved with it in a slot that was not open', () => {
    const c = newCharacter('warrior', 'P', 'p', 0);
    // (level 11: the fourth slot opens at 12)
    while (c.level < 11) addXp(c, xpToNext(c.level));
    c.spec = 0;
    c.skills = ['heavy-strike', 'whirlwind', 'shield-bash', 'bloodthirst'];
    expect(seatSpecSkill(c)).toBe(true);
    expect(c.skills[2]).toBe('bloodthirst');
    expect(c.skills[3]).toBe('shield-bash');
    expect(seatSpecSkill(c)).toBe(false);
  });
});
