/**
 * The Ring after the owner's notes of 2026-11-15: "lets add one more spell slot for each class and spec", "mana seems
 * to be running out a bit too fast for certain casters like mages and healers, maybe make mana not such issue as it is
 * now", "casting on the nameplates covers the mana bar and this shouldnt happen, casting could be below the mana bar",
 * "add mana bar to the hp bar thats above the character", and "test balancing changes and balance classes based on the
 * new change" (what was measured is written at the top of tests/sigilfall-ring-balance.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, fullBar, PRESETS, SLOTS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
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

describe('The Ring: five abilities on every bar', () => {
  it('every ready-made setup brings five, the fifth its own: its class’s, and not on the class’s other setup', () => {
    expect(SLOTS).toBe(5);
    for (const cls of CLASS_IDS) {
      const [a, b] = PRESETS[cls];
      for (const p of PRESETS[cls]) {
        expect(p.bar, `${cls} ${p.name}`).toHaveLength(5);
        const fifth = ABILITIES[p.bar[4]!]!;
        expect(fifth.cls, p.name).toBe(cls);
        expect(fifth.super, p.name).toBeFalsy();
        expect((p === a ? b : a)!.bar, `${p.name}'s ${fifth.name}`).not.toContain(fifth.id);
      }
    }
  });

  it('the fifth has a key of its own, 5 unless its player sets another', () => {
    expect(RING_ACTIONS.filter((a) => a.group === 'Abilities').map((a) => a.id)).toEqual(['ab1', 'ab2', 'ab3', 'ab4', 'ab5', 'dash', 'super']);
    expect(DEFAULT_KEYS.ab5).toBe('Digit5');
    expect(new Set(Object.values(DEFAULT_KEYS)).size).toBe(Object.values(DEFAULT_KEYS).length);
  });

  it('on a phone the fifth is a button of its own in the thumb cluster, clear of every other, and inside the cluster', () => {
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain("const TOUCH_SLOTS = ['basic', 's1', 's2', 's3', 's4', 'ult'] as const;");
    const box = rule('.rb-ring-thumbs .rb-cluster');
    const W = px(box, 'width');
    const H = px(box, 'height');
    // (wider than it is tall: a phone on its side has height to spare least, and the fight is on the right of it too)
    expect(W).toBeGreaterThan(H);
    expect(H).toBeLessThanOrEqual(176);
    const buttons = ['basic', 's1', 's2', 's3', 's4', 'ult'].map((k) => {
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
  });

  it('a bar of four kept from before is filled up to five from the setup it is closest to; one being filled now is left be', () => {
    const hound = preset('warrior', 'Hound');
    const reaper = preset('warrior', 'Reaper');
    const old = (bar: string[], n?: number) => setsOf({ standings: {}, sets: { warrior: { active: 0, list: [{ bar, talents: [] }], ...(n ? { n } : {}) } } }, 'warrior').list[0]!.bar;
    expect(old(hound.bar.slice(0, 4))).toEqual(hound.bar);
    expect(old(reaper.bar.slice(0, 4))).toEqual(reaper.bar);
    // a bar of one's own keeps its four, in their order, and gets one more of the class's own
    const own = ['w-shout', 'w-stand', 'w-ward', 'w-rage'];
    const grown = old(own);
    expect(grown.slice(0, 4)).toEqual(own);
    expect(grown).toHaveLength(5);
    expect(ABILITIES[grown[4]!]!.cls).toBe('warrior');
    // (written since bars held five: four is a bar its player hasn't finished, and nothing is added to it)
    expect(old(own, 5)).toEqual(own);
    // a pick from a room, from a game from before, is filled the same way at both ends
    expect(fullBar('warrior', hound.bar.slice(0, 4))).toEqual(hound.bar);
    expect(new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: fullBar('warrior', hound.bar.slice(0, 4)) }, { team: 1, cls: 'mage', name: 'b', bar: ['m-lash'] }] }).fighters[0]!.bar).toEqual(hound.bar);
  });

  it('the computer uses every setup’s fifth', () => {
    const used = new Set<string>();
    const fifths = new Set(CLASS_IDS.flatMap((c) => PRESETS[c].map((p) => p.bar[4]!)));
    const specs = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    for (let g = 0; g < 48 && used.size < fifths.size; g++) {
      // each setup in turn, in a 3v3 with others of every kind
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
        for (const e of m.events) if (e.k === 'ab' && fifths.has(e.ab)) used.add(e.ab);
        m.events.length = 0;
      }
    }
    expect([...fifths].filter((id) => !used.has(id)).map((id) => ABILITIES[id]!.name)).toEqual([]);
  }, 120_000);
});

// (the mana that was here, how fast it came back and where it showed, is gone with the mana itself: the owner,
// 2026-11-15, "remove the mana completely". tests/sigilfall-ring-nomana.test.tsx has what stands in its place.)
