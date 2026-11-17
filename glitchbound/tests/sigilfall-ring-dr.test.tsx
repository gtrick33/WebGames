/**
 * The Ring's holds after the owner, 2026-11-17: "remove diminishing returns completely, since most cc are not spammable
 * and have cds, if we have a spammable cc then give it a cd". Every hold lands in full however often it lands, so the
 * nameplates no longer carry the round chips that tracked them (asked for on 2026-11-15, "add diminishing return
 * tracker on the enemies on the nameplates"). And the owner's other note of that day, still held to: "can we make sure
 * the cast bar + hp/mana bar dont cover any part of the actual characters".
 */
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { BAR_CLEAR, barRows, barTop, castsAny } from '../src/games/sigilfall/render/ring';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';

const STEP = 1 / 30;
const ROOT = path.resolve(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'src/games/sigilfall/Game.css'), 'utf8');

/** A mage with her Toad Hex and a warrior, the gates open, a little apart on open ground. */
function hexing(): { m: Match; mage: Fighter; foe: Fighter } {
  const m = new Match({ seed: 4, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: ['m-toad', 'm-spear'] }, { team: 1, cls: 'warrior', name: 'Brom', bar: ['w-hew'] }] });
  m.step(GATES + 0.01, {});
  const [mage, foe] = m.fighters as [Fighter, Fighter];
  Object.assign(mage, { x: 160, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(foe, { x: 230, y: 125 });
  return { m, mage, foe };
}

/** Hexes the warrior (its cooldown waved) and waits for it to land: how long it holds them. */
function hex(m: Match, mage: Fighter, foe: Fighter): number {
  mage.cds = {};
  mage.gcd = 0;
  foe.auras = foe.auras.filter((a) => !a.cc);
  expect(m.press(0, 'm-toad')).toBeNull();
  for (let i = 0; i < 90 && !foe.auras.some((a) => a.cc === 'incap'); i++) {
    m.step(STEP, {});
    m.events.length = 0;
  }
  return foe.auras.find((a) => a.cc === 'incap')?.dur ?? 0;
}

describe('The Ring: no diminishing returns', () => {
  it('the mage’s Toad Hex holds for its full three seconds every time, however many have landed before it', () => {
    const { m, mage, foe } = hexing();
    for (let i = 0; i < 5; i++) expect(hex(m, mage, foe)).toBeCloseTo(3, 5);
    // (and nothing on the fighter keeps count of them)
    expect('dr' in foe).toBe(false);
  });

  it('a host’s word about a match carries no count of holds; one from before that still sends it is read all the same', () => {
    const { m, mage, foe } = hexing();
    hex(m, mage, foe);
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    expect(snap.f.every((f: Record<string, unknown>) => !('r' in f))).toBe(true);
    // (an older host's message, with its counts: nothing of it is taken in)
    for (const f of snap.f) f.r = { incap: { n: 2, until: 999, at: 0, ab: 'm-toad' } };
    const copy = hexing().m;
    copy.restore(snap, 0);
    expect('dr' in copy.fighters[1]!).toBe(false);
  });

  it('an enemy’s nameplate shows what is on them, and no chips counting holds', () => {
    const { m, mage, foe } = hexing();
    hex(m, mage, foe);
    const { container } = render(<Frame f={foe} m={m} me={mage} doll="" tag={null} onPick={() => {}} flip />);
    expect(container.querySelector('.rb-ring-drs')).toBeNull();
    expect(container.querySelector('.rb-ring-under .rb-ring-auras')).not.toBeNull();
    // (the chips' styles went with them, and a phone no longer lifts the row under an enemy's nameplate out for them)
    expect(CSS).not.toContain('.rb-ring-drs');
    expect(CSS).not.toMatch(/\.rb-ring\.is-touch \.is-foes \.rb-ring-under\s*\{/);
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
