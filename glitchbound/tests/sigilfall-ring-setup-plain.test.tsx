/**
 * The Ring after the owner's notes of 2026-11-15: "remove oaths and the extras, leave only spells, talents and ults",
 * "somewhere in nameplate add the playstyle of the class with tiny shrift, keep the styling of the nameplates the same
 * tho", and "in the mains creen of the ring, make the abilities clickable of the presets so i can see what i have and
 * how to use it".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS, TRINKET } from '../src/games/sigilfall/arena/abilities';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { Match } from '../src/games/sigilfall/arena/sim';
import { playstyleOf } from '../src/games/sigilfall/arena/styles';
import { LOBBY_STEPS } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
import { AbilityCard, BarRow, SetupChips, SetupEditor } from '../src/games/sigilfall/ui/RingSetup';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('The Ring’s setup: abilities, talents and a super, and nothing else', () => {
  it('the setup page’s tabs are the abilities, the talents and the super: no extras, no oath', () => {
    const sets = setsOf({ standings: {}, sets: {} }, 'mage');
    const { container, getByText } = render(<SetupEditor cls="mage" sets={sets} onSets={() => {}} guide={{ mode: 'custom' }} />);
    const tabs = [...container.querySelectorAll('.rb-rs-tabs [role="tab"]')].map((t) => t.textContent!.replace(/\d+\/\d+/, '').trim());
    expect(tabs).toEqual(['Abilities', 'Talents', 'Super']);
    expect(container.textContent).not.toMatch(/Oath of|Unbinding Charm|Extras/);
    expect(getByText('← Playstyles')).toBeTruthy();
  });

  it('beside the bar, everyone’s trinket and their super; under it, the talents alone', () => {
    const p = PRESETS.warrior[0]!;
    const { container } = render(<BarRow bar={p.bar} cls="warrior" ult={p.ult} />);
    const titles = [...container.querySelectorAll('.rb-rs-slot.is-token')].map((b) => b.getAttribute('title'));
    expect(titles[0]).toBe(`Unbinding Trinket: ${TRINKET.text}`);
    expect(titles[1]).toMatch(/^Super: /);
    const chips = render(<SetupChips cls="warrior" setup={{ bar: p.bar, talents: p.talents }} />).container;
    expect(chips.querySelectorAll('.rb-rs-chip')).toHaveLength(3);
    expect(chips.querySelector('.is-oath')).toBeNull();
  });

  it('the tutorial no longer walks through extras, and says the bar can be opened and read', () => {
    expect(LOBBY_STEPS.map((s) => s.id)).not.toContain('extras');
    const loadout = LOBBY_STEPS.find((s) => s.id === 'loadout')!.text('warrior');
    expect(loadout).not.toMatch(/oath/i);
    expect(loadout).toMatch(/open any of them to read what it does/);
  });
});

describe('The Ring’s nameplates: the way each fights, in small letters', () => {
  it('a bar plays as the ready-made build it shares most with', () => {
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(playstyleOf(cls, p.bar)).toBe(p.name);
    // (a bar of one's own: the nearest; a tie, the first)
    expect(playstyleOf('mage', ['m-spear', 'm-steal', 'm-ring', 'm-lash', 'm-toad'])).toBe('Rime');
    expect(playstyleOf('mage', ['m-toad', 'm-snap'])).toBe(PRESETS.mage[0]!.name);
  });

  it('beside the name on the nameplate, the nameplate otherwise as it was', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: PRESETS.mage[1]!.bar }, { team: 1, cls: 'warlock', name: 'Nyx', bar: PRESETS.warlock[0]!.bar }] });
    const [me, foe] = m.fighters as [Match['fighters'][0], Match['fighters'][0]];
    const mine = render(<Frame f={me} m={m} me={me} doll="" tag={null} onPick={() => {}} />).container;
    expect(mine.querySelector('.rb-ring-name .rb-ring-style')?.textContent).toBe('Rime');
    const theirs = render(<Frame f={foe} m={m} me={me} doll="" tag="Target" onPick={() => {}} flip />).container;
    const row = theirs.querySelector('.rb-ring-name')!;
    expect([...row.children].map((c) => c.className || c.tagName)).toEqual(['B', 'rb-ring-style', 'EM']);
    expect(row.querySelector('.rb-ring-style')?.textContent).toBe('Hexer');
    // (in the name's own row: no row of its own, so no nameplate is taller for it)
    const css = read('src/games/sigilfall/Game.css');
    const rule = /\n\.rb-ring-name \.rb-ring-style \{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toMatch(/font: 700 7\.5px\/13px/);
    expect(rule).toMatch(/flex: none/);
    // (a phone's nameplate is too narrow for a name, a tag and the playstyle in one row: there the playstyle lies over
    // the cast's row, under the health, the way the name lies over the health; 15px = the health's 14 and the 1px gap)
    const phone = /\n {2}\.rb-ring\.is-touch \.rb-ring-name \.rb-ring-style \{([^}]*)\}/.exec(css)![1]!;
    expect(phone).toMatch(/position: absolute;\s*top: 15px;/);
    expect(css).toMatch(/\.rb-ring\.is-touch \.rb-ring-bar \{\s*height: 14px;/);
    expect(css).toMatch(/\.rb-ring\.is-touch \.rb-ring-tail \{\s*height: 7px;/);
  });
});

describe('The Ring’s main screen: what you bring, each one to be read', () => {
  it('the bar on the main screen and in a room of friends opens each ability', () => {
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    expect(screen).toContain('<BarRow bar={bar} cls={pick} ult={ult} onPick={setReading} />');
    expect(screen).toContain('<BarRow bar={bar} cls={pick} ult={myPick.ult} onPick={onRead} />');
    expect(screen).toContain('{reading && <AbilityCard key={reading.id} ab={reading} cls={pick} bar={bar} onClose={() => setReading(null)} />}');
  });

  it('opened from there it is only read: what it does, when, how it combines, and a Close', () => {
    const p = PRESETS.mage[0]!;
    let closed = false;
    const { container, getByText } = render(<AbilityCard ab={ABILITIES['m-burn']!} cls="mage" bar={p.bar} onClose={() => (closed = true)} />);
    const buttons = [...container.querySelectorAll('footer button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Close']);
    expect(container.textContent).toMatch(/Best used/);
    expect(container.textContent).toMatch(/Flashover/);
    fireEvent.click(getByText('Close'));
    expect(closed).toBe(true);
  });
});
