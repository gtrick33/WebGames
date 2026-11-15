/**
 * The Ring after the owner's later notes of 2026-11-15: "please add diminishing return tracker on the enemies on the
 * nameplates, should be small but visible - e.g mage's hex", and "can we make sure the cast bar + hp/mana bar dont
 * cover any part of the actual characters".
 */
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { DR_RESET, GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { BAR_CLEAR, barRows, barTop, castsAny } from '../src/games/sigilfall/render/ring';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';

const STEP = 1 / 30;
const ROOT = path.resolve(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'src/games/sigilfall/Game.css'), 'utf8');
/** The body of the one CSS rule with exactly this selector. */
const rule = (selector: string): string => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]!);
  expect(all, selector).toHaveLength(1);
  return all[0]!;
};

/** A mage with her Toad Hex and a warrior, the gates open, a little apart on open ground. */
function hexing(): { m: Match; mage: Fighter; foe: Fighter } {
  const m = new Match({ seed: 4, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: ['m-toad', 'm-spear'] }, { team: 1, cls: 'warrior', name: 'Brom', bar: ['w-hew'] }] });
  m.step(GATES + 0.01, {});
  const [mage, foe] = m.fighters as [Fighter, Fighter];
  Object.assign(mage, { x: 160, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(foe, { x: 230, y: 125 });
  return { m, mage, foe };
}

/** Hexes the warrior and waits for it to land. */
function hex(m: Match, foe: Fighter): void {
  expect(m.press(0, 'm-toad')).toBeNull();
  for (let i = 0; i < 90 && !foe.auras.some((a) => a.cc === 'incap'); i++) {
    m.step(STEP, {});
    m.events.length = 0;
  }
  expect(foe.auras.some((a) => a.cc === 'incap')).toBe(true);
}

describe('The Ring: diminishing returns on the nameplates', () => {
  it('a hold remembers what put it on them, and since when: the mage’s Toad Hex', () => {
    const { m, foe } = hexing();
    hex(m, foe);
    const d = foe.dr.incap!;
    expect(d.n).toBe(1);
    expect(d.ab).toBe('m-toad');
    expect(d.at).toBeLessThanOrEqual(m.clock);
    // (it counts for as long as the hex holds, and DR_RESET after)
    const held = foe.auras.find((a) => a.cc === 'incap')!.dur;
    expect(d.until - d.at!).toBeCloseTo(held + DR_RESET, 5);
  });

  it('a player’s own copy is told them by the host; a host from before says nothing, and the copy keeps its own', () => {
    const { m, foe } = hexing();
    hex(m, foe);
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const copy = hexing().m;
    copy.restore(snap, 0);
    expect(copy.fighters[1]!.dr.incap).toEqual(foe.dr.incap);
    // (an older host's message: no `r`)
    const old = JSON.parse(JSON.stringify(snap));
    for (const f of old.f) delete f.r;
    const before = JSON.stringify(copy.fighters[1]!.dr);
    copy.restore(old, 0);
    expect(JSON.stringify(copy.fighters[1]!.dr)).toBe(before);
  });

  it('on an enemy’s nameplate: a round chip for each kind, the picture of what put it on, the rim by what the next does', () => {
    const { m, mage, foe } = hexing();
    const c = m.clock;
    foe.dr = {
      incap: { n: 1, until: c + 10, at: c - 5, ab: 'm-toad' },
      stun: { n: 2, until: c + 4, at: c - 12, ab: 'w-hurl' },
      root: { n: 3, until: c + 19, at: c - 1, ab: 'l-roots' },
      // (forgotten already: not shown)
      fear: { n: 1, until: c - 0.5, at: c - 20, ab: 'w-shout' },
    };
    const { container } = render(<Frame f={foe} m={m} me={mage} doll="" tag={null} onPick={() => {}} flip />);
    const chips = [...container.querySelectorAll<HTMLElement>('.rb-ring-under .rb-ring-drs > i')];
    expect(chips.map((i) => i.className)).toEqual(['is-dr1', 'is-dr2', 'is-dr3']);
    expect(chips.map((i) => i.dataset.ab)).toEqual(['m-toad', 'w-hurl', 'l-roots']);
    expect(chips.every((i) => i.querySelector('img'))).toBe(true);
    expect(chips.map((i) => i.querySelector('em')!.textContent)).toEqual(['½', '¼', '✕']);
    expect(chips[0]!.title).toMatch(/^Dazed \(Toad Hex\): the next lasts half as long, for 10s$/);
    expect(chips[2]!.title).toMatch(/immune to the next/);
    // the rim runs down: two thirds of the hex's window left
    expect(Number(chips[0]!.style.getPropertyValue('--left'))).toBeCloseTo(10 / 15, 2);
    // (from a host that didn't say what put it on: the picture of that kind of hold)
    foe.dr = { incap: { n: 1, until: c + 10 } };
    const { container: plain } = render(<Frame f={foe} m={m} me={mage} doll="" tag={null} onPick={() => {}} flip />);
    expect(plain.querySelector<HTMLElement>('.rb-ring-drs > i')!.dataset.ab).toBe('m-toad');
    // a fighter with nothing diminished has no chips at all
    const { container: none } = render(<Frame f={mage} m={m} me={mage} doll="" tag={null} onPick={() => {}} />);
    expect(none.querySelector('.rb-ring-drs')).toBeNull();
  });

  it('small but plain: the rim’s color says what the next does, and its share sits in the corner', () => {
    expect(rule('.rb-ring-drs i')).toMatch(/width:\s*19px/);
    expect(rule('.rb-ring-drs i')).toMatch(/--dr:\s*#ffd257/);
    expect(rule('.rb-ring-drs i.is-dr2')).toMatch(/--dr:\s*#ff9a3d/);
    expect(rule('.rb-ring-drs i.is-dr3')).toMatch(/--dr:\s*#ff4a5a/);
    expect(rule('.rb-ring-drs i')).toMatch(/conic-gradient\(var\(--dr\) calc\(var\(--left, 1\) \* 360deg\)/);
  });

  it('on a phone, where the row under a nameplate is put away, an enemy’s chips stay in sight beside their nameplate', () => {
    expect(rule('.rb-ring.is-touch .rb-ring-under')).toMatch(/display:\s*none/);
    const foes = rule('.rb-ring.is-touch .is-foes .rb-ring-under');
    expect(foes).toMatch(/display:\s*flex/);
    expect(foes).toMatch(/position:\s*absolute/);
    expect(foes).toMatch(/right:\s*calc\(100% \+ \d+px\)/);
    expect(foes).toMatch(/pointer-events:\s*none/);
    // (only the chips: the effects on them stay put away)
    expect(rule('.rb-ring.is-touch .is-foes .rb-ring-under .rb-ring-auras')).toMatch(/display:\s*none/);
  });
});

describe('The Ring: the bar over a fighter never covers them', () => {
  const fighters = (): Fighter[] =>
    CLASS_IDS.flatMap((cls) =>
      PRESETS[cls].map((p) => new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls, name: p.name, bar: p.bar, talents: p.talents, ult: p.ult }, { team: 1, cls: 'warrior', name: 'b', bar: ['w-hew'] }] }).fighters[0]!),
    );

  it('for every ready-made setup, the lowest of the bar, its cast’s row and all, stays clear over the head', () => {
    for (const f of fighters()) {
      const top = barTop(f);
      // (the head where the bar hangs from at 0, up the screen negative)
      const rows = barRows(f, -top);
      expect(-top + rows.low, f.name).toBeLessThanOrEqual(-BAR_CLEAR);
      if (castsAny(f)) expect(rows.cast, f.name).toBeLessThan(-top + rows.low);
      // and nobody's bar comes lower than it stood before
      expect(top, f.name).toBeGreaterThanOrEqual(6);
    }
  });

  it('a bar stays where it is when a cast begins: the cast’s row is kept for whoever can cast', () => {
    for (const f of fighters().filter((x) => castsAny(x))) {
      const before = barTop(f);
      const cast = f.bar.find((id) => ABILITIES[id]!.cast > 0 || ABILITIES[id]!.channel)!;
      f.cast = { ab: cast, target: 1, t: 0.2, dur: 1, channel: false, next: 0, pushed: 0 };
      expect(barTop(f), f.name).toBe(before);
    }
  });

  it('the cast’s name is written in its bar, not under it across their face; the title over the bar stands on it', () => {
    const ring = fs.readFileSync(path.join(ROOT, 'src/games/sigilfall/render/ring.ts'), 'utf8');
    expect(ring).not.toContain('strokeText(ab.name, f.x, cy + 9)');
    expect(ring).toContain("g.textBaseline = 'middle';");
    const match = fs.readFileSync(path.join(ROOT, 'src/games/sigilfall/ui/RingMatch.tsx'), 'utf8');
    expect(match).toContain('(barTop(f) + 1.2) * s');
  });
});
