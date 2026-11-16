/**
 * The Ring after the owner's note of 2026-11-15: "remove the mana completely". An ability waits only on its cooldown
 * (and the moment after any other); nothing on a nameplate or over a head shows mana; the three talents that ran on it
 * run on health instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, BODY, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { Match } from '../src/games/sigilfall/arena/sim';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { barRows } from '../src/games/sigilfall/render/ring';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
import { AbilityCard } from '../src/games/sigilfall/ui/RingSetup';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** A mage halfway through casting Ember Lash at a warrior. */
function casting(): { m: Match; mage: Match['fighters'][0]; warrior: Match['fighters'][0] } {
  const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: PRESETS.mage[0]!.bar }, { team: 1, cls: 'warrior', name: 'Brom', bar: PRESETS.warrior[0]!.bar }] });
  const [mage, warrior] = m.fighters as [Match['fighters'][0], Match['fighters'][0]];
  mage.cast = { ab: 'm-lash', target: 1, t: 0.4, dur: 0.8, channel: false, next: 0, pushed: 0 };
  return { m, mage, warrior };
}

describe('The Ring without mana: in the rules', () => {
  it('no ability costs anything, no class carries any, no fighter has any', () => {
    for (const ab of Object.values(ABILITIES)) expect('mana' in ab, ab.name).toBe(false);
    for (const cls of CLASS_IDS) expect(Object.keys(BODY[cls])).toEqual(['hp']);
    const { mage } = casting();
    expect('mana' in mage).toBe(false);
    expect('maxMana' in mage).toBe(false);
    expect(read('src/games/sigilfall/arena/sim.ts')).not.toContain('Not enough mana');
  });

  it('a steady spell can be cast back to back for as long as anyone likes', () => {
    const m = new Match({ seed: 2, map: 'sands', fighters: [{ team: 0, cls: 'priest', name: 'a', bar: ['p-mend'] }, { team: 1, cls: 'warrior', name: 'b', bar: ['w-hew'] }] });
    m.step(6, {});
    const me = m.fighters[0]!;
    let cast = 0;
    for (let i = 0; i < 30 * 120; i++) {
      me.hp = me.maxHp / 2;
      if (!me.cast && me.gcd <= 0 && m.press(0, 'p-mend') === null) cast++;
      m.step(1 / 30, {});
      m.events.length = 0;
    }
    expect(cast).toBeGreaterThan(60);
  });

  it('no talent speaks of mana; the two left of those that ran on it run on health', () => {
    const all = Object.values(TALENTS).flat();
    for (const t of all) expect(t.text, t.name).not.toMatch(/mana/i);
    const by = (name: string) => all.find((t) => t.name === name)!;
    // (Brimming Power, the third, went when the talents became each playstyle's own, 2026-11-16)
    expect(by('Arcane Skin').text).toBe('Take 20% less damage while above 50% health.');
    expect(by('Hollow Pact').text).toBe('Falling below 35% health heals you for 25% of your health. 45 sec cooldown.');
    expect(all.some((t) => t.name === 'Mana Skin')).toBe(false);
  });
});

describe('The Ring without mana: on the screen', () => {
  it('a nameplate is the name, the health and the cast’s row under it, and no mana row', () => {
    const { m, mage } = casting();
    const { container } = render(<Frame f={mage} m={m} me={mage} doll="" tag={null} onPick={() => {}} />);
    expect(container.querySelector('.rb-ring-mana')).toBeNull();
    const bar = container.querySelector('.rb-ring-bar')!;
    const tail = container.querySelector('.rb-ring-tail')!;
    expect(bar.nextElementSibling).toBe(tail);
    expect(tail.querySelector('.rb-ring-cast')?.textContent).toBe('Ember Lash');
    expect(read('src/games/sigilfall/Game.css')).not.toContain('rb-ring-mana');
  });

  it('over a head, the health and the cast under it, with no strip between', () => {
    const { mage, warrior } = casting();
    const c = barRows(mage, 100);
    expect(Object.keys(c).sort()).toEqual(['back', 'cast', 'hp', 'low']);
    expect(c.cast).toBeGreaterThanOrEqual(c.hp + 2.4);
    expect(barRows(warrior, 100).low).toBeCloseTo(3.1, 5);
    expect(read('src/games/sigilfall/render/ring.ts')).not.toContain('#5ab0ff');
  });

  it('an ability’s card names no cost', () => {
    const { container } = render(<AbilityCard ab={ABILITIES['m-lash']!} cls="mage" bar={PRESETS.mage[0]!.bar} onClose={() => {}} />);
    expect(container.textContent).not.toMatch(/mana/i);
  });

  it('a host from before, still sending mana, is read without it', () => {
    const { m } = casting();
    const snap = m.snapshot();
    expect('m' in snap.f[0]!).toBe(false);
    // (an older host's snapshot, with its mana, applies all the same)
    const old = { ...snap, f: snap.f.map((x) => ({ ...x, m: 40 })) };
    const copy = casting().m;
    copy.restore(old);
    expect(copy.fighters[0]!.hp).toBe(m.fighters[0]!.hp);
    expect('mana' in copy.fighters[0]!).toBe(false);
  });
});
