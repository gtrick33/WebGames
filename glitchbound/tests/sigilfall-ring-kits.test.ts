/**
 * The Ring after the owner's notes of 2026-11-16: "1 base spell 1 ult 3 other spells (like before)", "fixed spells per
 * playstyle, only talents need to be changed", "1 utility spell (deffensive, mobility, dmg), 1 cc spell". A playstyle's
 * four abilities and its super are its own; a setup is a playstyle and three talents. (Before, a bar was five chosen
 * from twelve and a trinket: tests/sigilfall-ring-fifth.test.tsx had that, and is gone with it.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, fullBar, kitOf, PRESETS, SLOTS, styleOfBar, ultFor, ultsOf } from '../src/games/sigilfall/arena/abilities';
import { botThink, isHealer, newBrain } from '../src/games/sigilfall/arena/bot';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { cleanTalents, talentsFor, TALENTS } from '../src/games/sigilfall/arena/talents';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { DEFAULT_KEYS, RING_ACTIONS } from '../src/games/sigilfall/ui/ringKeys';

const STEP = 1 / 30;
const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = read('src/games/sigilfall/Game.css');
/** The body of the one CSS rule with exactly this selector. */
const rule = (selector: string): string => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]!);
  expect(all, selector).toHaveLength(1);
  return all[0]!;
};
const px = (body: string, prop: string): number => Number(new RegExp(`(?:^|[\\s;])${prop}:\\s*(-?[\\d.]+)px`).exec(body)?.[1] ?? NaN);
const preset = (cls: ClassId, name: string) => PRESETS[cls].find((p) => p.name === name)!;

describe('The Ring: a playstyle’s abilities are its own', () => {
  it('two playstyles a class, each a basic ability, the one its combo is made with, a utility and a hold, and a super', () => {
    expect(SLOTS).toBe(4);
    for (const cls of CLASS_IDS) {
      expect(PRESETS[cls], cls).toHaveLength(2);
      for (const p of PRESETS[cls]) {
        expect(p.bar, `${cls} ${p.name}`).toHaveLength(4);
        expect(new Set(p.bar).size).toBe(4);
        const [basic, combo, utility, hold] = p.bar.map((id) => ABILITIES[id]!);
        for (const ab of [basic, combo, utility, hold]) {
          expect(ab!.cls, `${p.name}: ${ab!.id}`).toBe(cls);
          expect(ab!.super, ab!.id).toBeFalsy();
        }
        // the basic one: no cooldown, quick, and it hurts or heals
        expect(basic!.cd, `${p.name}'s ${basic!.name}`).toBe(0);
        expect(basic!.cast, basic!.name).toBeLessThanOrEqual(1);
        expect(['damage', 'heal'], basic!.name).toContain(basic!.role);
        // the utility: a way in or out, a defense, a heal, or more damage
        expect(['mobility', 'defense', 'damage', 'heal', 'stealth'], `${p.name}'s ${utility!.name}`).toContain(utility!.role);
        // the hold: something that holds
        expect(hold!.role, `${p.name}'s ${hold!.name}`).toBe('cc');
        expect(hold!.effects.some((e) => e.k === 'cc' || e.k === 'trap'), hold!.name).toBe(true);
        // its super is one of the class's two, and the class's other playstyle has the other
        expect(ultsOf(cls).map((u) => u.id)).toContain(p.ult);
        expect(ultFor(cls, p.bar)).toBe(p.ult);
      }
      expect(PRESETS[cls][0]!.ult).not.toBe(PRESETS[cls][1]!.ult);
      // (the two share at most what is the class's own way of doing a thing: a rush, a hammer, a hold)
      const shared = PRESETS[cls][0]!.bar.filter((id) => PRESETS[cls][1]!.bar.includes(id));
      expect(shared.length, cls).toBeLessThanOrEqual(2);
      expect(shared, cls).not.toContain(PRESETS[cls][0]!.bar[0]);
      // and there is nothing in a class's kit to choose from besides: no trinket, nothing left over
      expect(kitOf(cls).map((a) => a.id).sort()).toEqual([...new Set(PRESETS[cls].flatMap((p) => p.bar))].sort());
    }
    expect(ABILITIES.trinket).toBeUndefined();
    // three healers, by their basic ability
    expect(CLASS_IDS.flatMap((c) => PRESETS[c].filter((p) => isHealer(p)).map((p) => p.name)).sort()).toEqual(['Grovekeeper', 'Lifegiver', 'Oathkeeper']);
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(!!p.healer, p.name).toBe(isHealer(p));
  });

  it('a fighter fights with their playstyle’s four and its super, whatever was sent', () => {
    const hound = preset('warrior', 'Hound');
    const make = (bar: string[], ult?: string) => new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar, ult }, { team: 1, cls: 'mage', name: 'b', bar: ['m-lash'] }] }).fighters;
    // out of order, short, or with another class's among them: the playstyle it is nearest
    expect(make([...hound.bar].reverse())[0]!.bar).toEqual(hound.bar);
    expect(make(['w-bleed', 'm-lash'])[0]!.bar).toEqual(hound.bar);
    expect(make(['w-bleed'])[0]!.ult).toBe(hound.ult);
    // (a super sent that isn't the playstyle's is not taken: the Reaper's Quakebreaker stays the Reaper's)
    expect(make(hound.bar, 'w-super')[0]!.ult).toBe('w-super2');
    expect(make(['m-lash'])[1]!.bar).toEqual(preset('mage', 'Pyre').bar);
    expect(make([])[0]!.bar).toEqual(PRESETS.warrior[0]!.bar);
    // pressing what isn't theirs is refused
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: hound.bar }, { team: 1, cls: 'mage', name: 'b', bar: ['m-lash'] }] });
    expect(m.press(0, 'w-hew')).toBe('You don’t have that');
    expect(m.press(0, 'w-super')).toBe('You don’t have that');
    // in the entry: another playstyle, and its talents
    expect(m.equip(0, { bar: PRESETS.warrior[0]!.bar, talents: ['w-arms-1b', 'w-pin-2a', 'w-3b'] })).toBe(true);
    expect(m.fighters[0]!.bar).toEqual(PRESETS.warrior[0]!.bar);
    expect(m.fighters[0]!.ult).toBe('w-super');
    // (the Hound's talent isn't the Reaper's to take: it is left out)
    expect(m.fighters[0]!.talents).toEqual(['w-arms-1b', 'w-3b']);
  });

  it('a key for each of the four, 1 to 4 unless its player sets another', () => {
    expect(RING_ACTIONS.filter((a) => a.group === 'Abilities').map((a) => a.id)).toEqual(['ab1', 'ab2', 'ab3', 'ab4', 'dash', 'super']);
    expect(DEFAULT_KEYS.ab4).toBe('Digit4');
    expect('ab5' in DEFAULT_KEYS).toBe(false);
    expect(new Set(Object.values(DEFAULT_KEYS)).size).toBe(Object.values(DEFAULT_KEYS).length);
  });

  it('on a phone: the basic one in the corner, the other three on its arc and the super outside, each clear of every other', () => {
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain("const TOUCH_SLOTS = ['basic', 's1', 's2', 's3', 'ult'] as const;");
    const box = rule('.rb-ring-thumbs .rb-cluster');
    const W = px(box, 'width');
    const H = px(box, 'height');
    // (wider than it is tall: a phone on its side has height to spare least, and the fight is on the right of it too)
    expect(W).toBeGreaterThan(H);
    expect(H).toBeLessThanOrEqual(176);
    const buttons = ['basic', 's1', 's2', 's3', 'ult'].map((k) => {
      const r = rule(`.rb-ring-thumbs .rb-cluster .rb-sb-${k}`);
      const d = px(r, 'width');
      expect(px(r, 'height'), k).toBe(d);
      return { k, r: d / 2, x: px(r, 'right') + d / 2, y: px(r, 'bottom') + d / 2 };
    });
    for (const b of buttons) {
      expect(b.x + b.r, `${b.k} inside`).toBeLessThanOrEqual(W);
      expect(b.y + b.r, `${b.k} inside`).toBeLessThanOrEqual(H);
    }
    // (a thumb-width apart is too much to ask on a phone; a few points of gold rim between every two is not)
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const p = buttons[i]!;
        const q = buttons[j]!;
        expect(Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r, `${p.k} and ${q.k}`).toBeGreaterThanOrEqual(4);
      }
    // (with three on the arc where there were four, each is a little bigger)
    expect(buttons[1]!.r * 2).toBeGreaterThanOrEqual(50);
  });
});

describe('The Ring: talents are the playstyle’s to choose', () => {
  it('three rows of three: two of the playstyle’s own, and the class’s; and the Nightblade’s fourth, its venom', () => {
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const list = talentsFor(cls, p.id);
        // (the Nightblade alone has a fourth row: the venom its Nightknife carries, 2026-11-17)
        const rows = cls === 'gloamknight' && p.id === 'shadow' ? ([0, 1, 2, 3] as const) : ([0, 1, 2] as const);
        expect(list, `${cls} ${p.name}`).toHaveLength(rows.length * 3);
        for (const row of rows) {
          const of = list.filter((t) => t.row === row);
          expect(of, `${p.name} row ${row}`).toHaveLength(3);
          for (const t of of) expect(t.spec, t.name).toBe(row === 2 ? undefined : p.id);
        }
        // what a talent changes by name is one of the playstyle's own abilities, or its super
        for (const t of list) for (const id of [...Object.keys(t.tune ?? {}), ...(t.via ? [t.via] : [])]) expect([...p.bar, p.ult, 'super'], `${t.name} names ${id}`).toContain(id);
        // the talents it comes with: one from each row, all its own to take
        expect(cleanTalents(cls, p.talents, p.id).map((t) => t.row).sort()).toEqual([...rows]);
      }
      const n = cls === 'gloamknight' ? 18 : 15;
      expect(TALENTS[cls]).toHaveLength(n);
      expect(new Set(TALENTS[cls].map((t) => t.id)).size).toBe(n);
      expect(new Set(TALENTS[cls].map((t) => t.name)).size).toBe(n);
    }
  });

  it('a setup kept from before is read as the playstyle its bar is nearest, with that playstyle’s talents where the kept ones are gone', () => {
    const hound = preset('warrior', 'Hound');
    const reaper = preset('warrior', 'Reaper');
    const old = (bar: string[], talents: string[] = []) => setsOf({ standings: {}, sets: { warrior: { active: 0, list: [{ bar, talents }] } } }, 'warrior').list[0]!;
    // (five chosen one by one, as bars were until 2026-11-16)
    expect(old(['w-hew', 'w-bleed', 'w-hamstring', 'w-rush', 'w-free']).bar).toEqual(hound.bar);
    expect(old(['w-hew', 'w-gash', 'w-rush', 'w-hurl', 'w-crack']).bar).toEqual(reaper.bar);
    expect(old(['w-hew', 'w-gash', 'w-rush', 'w-hurl', 'w-crack']).ult).toBe(reaper.ult);
    // the old talents' ids: the first two rows are gone, the third is the class's still
    expect(old(reaper.bar, ['w-1b', 'w-2c', 'w-3a']).talents).toEqual([reaper.talents[0], reaper.talents[1], 'w-3a']);
    // one of today's is kept as it is
    expect(old(hound.bar, ['w-pin-1c', 'w-pin-2b', 'w-3b']).talents).toEqual(['w-pin-1c', 'w-pin-2b', 'w-3b']);
    // nothing kept at all: the playstyles themselves
    expect(setsOf({ standings: {}, sets: {} }, 'mage').list.map((s) => styleOfBar('mage', s.bar).name)).toEqual(['Pyre', 'Rime', 'Pyre']);
    // a pick from a room, from a game from before, is read the same way at both ends
    expect(fullBar('warrior', ['w-hew', 'w-bleed', 'w-hamstring', 'w-rush'])).toEqual(hound.bar);
  });
});

describe('The Ring: the computer plays every playstyle', () => {
  it('it uses every ability of every playstyle, and every super', () => {
    const used = new Set<string>();
    const all = new Set(CLASS_IDS.flatMap((c) => PRESETS[c].flatMap((p) => [...p.bar, p.ult])));
    const specs = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    for (let g = 0; g < 64 && used.size < all.size; g++) {
      // each playstyle in turn, in a 3v3 with others of every kind
      const pick = (k: number) => specs[(g * 3 + k) % specs.length]!;
      const fighters: FighterSetup[] = [0, 1, 2, 3, 4, 5].map((k) => {
        const s = pick(k * 5 + (k % 2));
        return { team: (k % 2) as 0 | 1, cls: s.cls, name: `${s.cls}${k}`, bar: s.p.bar, talents: s.p.talents, ult: s.p.ult };
      });
      const m = new Match({ seed: g + 1, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
      const brains = m.fighters.map((_, i) => newBrain(g * 17 + i));
      for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.85, STEP);
        m.step(STEP, moves);
        for (const e of m.events) if (e.k === 'ab' && all.has(e.ab)) used.add(e.ab);
        m.events.length = 0;
      }
    }
    expect([...all].filter((id) => !used.has(id)).map((id) => ABILITIES[id]!.name)).toEqual([]);
  }, 180_000);
});
