/**
 * The Ring after the owner's notes of 2026-11-15: "lets add one more spell slot for each class and spec", "mana seems
 * to be running out a bit too fast for certain casters like mages and healers, maybe make mana not such issue as it is
 * now", "casting on the nameplates covers the mana bar and this shouldnt happen, casting could be below the mana bar",
 * "add mana bar to the hp bar thats above the character", and "test balancing changes and balance classes based on the
 * new change" (what was measured is written at the top of tests/sigilfall-ring-balance.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, fullBar, kitOf, PRESETS, SLOTS, type Ability } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { GATES, MANA_REGEN, Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { barRows, MANA_H } from '../src/games/sigilfall/render/ring';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
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
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain("const TOUCH_SLOTS = ['basic', 's1', 's2', 's3', 's4', 'dodge', 'ult'] as const;");
    const box = rule('.rb-ring-thumbs .rb-cluster');
    const W = px(box, 'width');
    const H = px(box, 'height');
    // (wider than it is tall: a phone on its side has height to spare least, and the fight is on the right of it too)
    expect(W).toBeGreaterThan(H);
    expect(H).toBeLessThanOrEqual(176);
    const buttons = ['basic', 's1', 's2', 's3', 's4', 'dodge', 'ult'].map((k) => {
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
    const old = (bar: string[], n?: number) => setsOf({ standings: {}, sets: { warrior: { active: 0, list: [{ bar, oath: 'iron', talents: [] }], ...(n ? { n } : {}) } } }, 'warrior').list[0]!.bar;
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

describe('The Ring: mana is no longer what a fight is about', () => {
  it('comes back at 5 a second (it was 1.5)', () => {
    expect(MANA_REGEN).toBe(5);
  });

  /** How long a hero can cast `ab` back to back, from full, before there isn't the mana for it. */
  function lasts(cls: ClassId, ab: Ability): number {
    const m = new Match({ seed: 2, map: 'sands', fighters: [{ team: 0, cls, name: 'a', bar: [ab.id] }, { team: 1, cls: 'warrior', name: 'b', bar: ['w-hew'] }] });
    m.step(GATES + 0.01, {});
    const [me, foe] = m.fighters as [(typeof m.fighters)[0], (typeof m.fighters)[0]];
    Object.assign(me, { x: 160, y: 125, dirX: 1, dirY: 0, target: 1, friend: 0, maxHp: 1e9, hp: 1e9 });
    Object.assign(foe, { x: 230, y: 125, maxHp: 1e9, hp: 1e9 });
    const start = m.t;
    for (let i = 0; i < 30 * 150; i++) {
      // (kept alive and in reach, whatever the closing ring does)
      me.hp = foe.hp = 1e9;
      Object.assign(me, { x: 160, y: 125 });
      Object.assign(foe, { x: 230, y: 125 });
      if (!me.cast && me.gcd <= 0 && !me.cds[ab.id] && m.press(0, ab.id) === 'Not enough mana') return m.t - start;
      m.step(STEP, {});
      m.events.length = 0;
    }
    return Infinity;
  }

  it('a caster or a healer casting their steady spell back to back, and nothing else, lasts most of a minute or more', () => {
    // (at 1.5 a second these ran short in 20 to 31 seconds; at 5 the dearest, Green Mending, lasts a minute)
    const steady = CLASS_IDS.flatMap((cls) => kitOf(cls).filter((a) => a.cd === 0 && a.mana > 0 && a.cast > 0 && (a.role === 'damage' || a.role === 'heal')).map((a) => [cls, a] as const));
    expect(steady.map(([, a]) => a.id).sort()).toEqual(['d-flash', 'k-bolt', 'l-lash', 'l-regrow', 'm-lash', 'm-spear', 'p-mend', 'p-smite']);
    for (const [cls, ab] of steady) expect(lasts(cls, ab), ab.name).toBeGreaterThan(50);
  }, 60_000);

  it('the computer’s casters and healers never stand there with nothing they can pay for', () => {
    let dry = 0;
    let time = 0;
    const casters = CLASS_IDS.filter((c) => c !== 'warrior' && c !== 'ranger' && c !== 'gloamknight').flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    for (let g = 0; g < 16; g++) {
      const side = (t: 0 | 1): FighterSetup[] =>
        [0, 1, 2].map((k) => {
          const s = casters[(g + k * 4 + t * 7) % casters.length]!;
          // (Hollow Pact empties the mana on purpose: a warlock low on health trades it for life)
          return { team: t, cls: s.cls, name: `${s.cls}${t}${k}`, bar: s.p.bar, talents: s.p.talents.filter((x) => x !== 'k-3a'), ult: s.p.ult };
        });
      const m = new Match({ seed: g + 5, map: MAP_IDS[g % MAP_IDS.length]!, fighters: [...side(0), ...side(1)] });
      const brains = m.fighters.map((_, i) => newBrain(g * 13 + i));
      const cheapest = m.fighters.map((f) => Math.min(...f.bar.map((id) => ABILITIES[id]!.mana).filter((x) => x > 0)));
      for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.9, STEP);
        m.step(STEP, moves);
        m.events.length = 0;
        if (m.phase !== 'fight') continue;
        m.fighters.slice(0, 6).forEach((f, k) => {
          if (f.dead) return;
          time += STEP;
          if (f.mana < cheapest[k]!) dry += STEP;
        });
      }
    }
    expect(time).toBeGreaterThan(600);
    expect(dry / time).toBeLessThan(0.005);
  }, 60_000);
});

describe('The Ring: the mana shows, cast or no cast', () => {
  /** A mage, half her mana gone, halfway through casting Ember Lash at a warrior. */
  function casting(): { m: Match; mage: Match['fighters'][0]; warrior: Match['fighters'][0] } {
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: preset('mage', 'Pyre').bar }, { team: 1, cls: 'warrior', name: 'Brom', bar: preset('warrior', 'Reaper').bar }] });
    const [mage, warrior] = m.fighters as [Match['fighters'][0], Match['fighters'][0]];
    mage.mana = mage.maxMana / 2;
    mage.cast = { ab: 'm-lash', target: 1, t: 0.4, dur: 0.8, channel: false, next: 0, pushed: 0 };
    return { m, mage, warrior };
  }

  it('on a nameplate the mana has a row of its own, and the cast goes on the row under it, not over it', () => {
    const { m, mage } = casting();
    const { container } = render(<Frame f={mage} m={m} me={mage} doll="" tag={null} onPick={() => {}} />);
    const mana = container.querySelector('.rb-ring-mana')!;
    const tail = container.querySelector('.rb-ring-tail')!;
    expect(mana).not.toBeNull();
    expect(tail.contains(mana)).toBe(false);
    expect(tail.querySelector('.rb-ring-cast')?.textContent).toBe('Ember Lash');
    // the mana first, then the cast
    expect(mana.compareDocumentPosition(tail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((mana.querySelector('i') as HTMLElement).style.width).toBe('50%');
    // (the cast is laid over its own row only)
    expect(rule('.rb-ring-tail > .rb-ring-cast,\n.rb-ring-tail > .rb-ring-held,\n.rb-ring-tail > .rb-ring-unseen')).toMatch(/position:\s*absolute/);
  });

  it('a nameplate without mana keeps the row, empty, so every nameplate is as tall as the rest', () => {
    const { m, mage, warrior } = casting();
    const { container } = render(<Frame f={warrior} m={m} me={mage} doll="" tag={null} onPick={() => {}} />);
    const mana = container.querySelector('.rb-ring-mana')!;
    expect(mana.classList.contains('is-none')).toBe(true);
    expect(mana.querySelector('i')).toBeNull();
    expect(rule('.rb-ring-mana.is-none')).toMatch(/visibility:\s*hidden/);
  });

  it('over a caster’s head: the health, the mana under it, the cast under that, none over another', () => {
    const { mage, warrior } = casting();
    const by = 100;
    const c = barRows(mage, by);
    expect(c.hp).toBe(by);
    expect(c.mana).not.toBeNull();
    expect(c.mana!).toBeGreaterThanOrEqual(c.hp + 2.4);
    expect(c.cast).toBeGreaterThanOrEqual(c.mana! + MANA_H);
    // the dark behind the bar takes the mana in
    expect(by - 0.7 + c.back).toBeGreaterThanOrEqual(c.mana! + MANA_H);
    // one with neither mana nor anything to cast: no mana under the health, and no room kept for a cast
    const w = barRows(warrior, by);
    expect(w.mana).toBeNull();
    expect(w.back).toBe(3.8);
    expect(w.low).toBeCloseTo(3.1, 5);
  });
});
