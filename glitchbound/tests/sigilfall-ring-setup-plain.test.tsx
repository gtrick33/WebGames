/**
 * The Ring after the owner's notes of 2026-11-15: "remove oaths and the extras, leave only spells, talents and ults",
 * "somewhere in nameplate add the playstyle of the class with tiny shrift, keep the styling of the nameplates the same
 * tho", and "in the mains creen of the ring, make the abilities clickable of the presets so i can see what i have and
 * how to use it". And of 2026-11-16: "fixed spells per playstyle, only talents need to be changed".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { setsOf, type ClassSets } from '../src/games/sigilfall/arena/ladder';
import { Match } from '../src/games/sigilfall/arena/sim';
import { playstyleOf } from '../src/games/sigilfall/arena/styles';
import { LOBBY_STEPS } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
import { AbilityCard, BarRow, SetupChips, SetupEditor } from '../src/games/sigilfall/ui/RingSetup';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('The Ring’s setup: a playstyle and its talents, and nothing else', () => {
  it('one page: the playstyles, the chosen one’s abilities to read, and its talents in three rows of three', () => {
    let sets: ClassSets = setsOf({ standings: {}, sets: {} }, 'mage');
    const view = render(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    const { container } = view;
    // no tabs, nothing to customize, no list of abilities to take from: the abilities are the playstyle's own
    expect(container.querySelector('.rb-rs-tabs')).toBeNull();
    expect(container.querySelector('.rb-rs-kit')).toBeNull();
    expect(container.textContent).not.toMatch(/Customize|Oath of|Unbinding|Extras|Equip/);
    expect([...container.querySelectorAll('.rb-rs-style strong')].map((x) => x.textContent)).toEqual(['Pyre', 'Rime']);
    expect(container.querySelector('.rb-rs-style.is-on strong')!.textContent).toBe('Pyre');
    // its four and its super, each to be opened and read
    expect(container.querySelectorAll('.rb-rs-barrow .rb-rs-slot')).toHaveLength(5);
    expect(container.querySelectorAll('.rb-rs-how li').length).toBeGreaterThanOrEqual(2);
    // three rows of three, one chosen in each, the first two the playstyle's own
    const rows = [...container.querySelectorAll('.rb-rs-row')];
    expect(rows.map((r) => r.querySelector('h4')!.firstChild!.textContent!.trim())).toEqual(['Combo', 'Tricks', 'Staying alive']);
    for (const r of rows) {
      expect(r.querySelectorAll('.rb-rs-option')).toHaveLength(3);
      expect(r.querySelectorAll('.rb-rs-option.is-on')).toHaveLength(1);
    }
    expect(rows[0]!.textContent).toMatch(/Cinderheart/);
    // choosing another in a row takes that row's place, and one is always chosen (the chosen one again changes nothing)
    fireEvent.click(view.getByText('Banked Embers'));
    expect(sets.list[0]!.talents).toContain('m-fire-1b');
    expect(sets.list[0]!.talents).not.toContain('m-fire-1a');
    expect(sets.list[0]!.talents).toHaveLength(3);
    view.rerender(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    fireEvent.click(view.getByText('Banked Embers'));
    expect(sets.list[0]!.talents).toHaveLength(3);
    expect(container.textContent).toMatch(/Embers: up to 3/);
    // the other playstyle: its own four and super, its own talents, and the class's row kept as it was chosen
    const kept = sets.list[0]!.talents.find((t) => t.startsWith('m-3'))!;
    fireEvent.click(view.getByText('Rime'));
    expect(sets.list[0]!.bar).toEqual(PRESETS.mage[1]!.bar);
    expect(sets.list[0]!.ult).toBe(PRESETS.mage[1]!.ult);
    expect(sets.list[0]!.talents).toEqual([PRESETS.mage[1]!.talents[0], PRESETS.mage[1]!.talents[1], kept]);
    // an ability opened from the bar is only read
    view.rerender(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    fireEvent.click(container.querySelector('.rb-rs-barrow .rb-rs-slot')!);
    expect([...container.querySelectorAll('.rb-rs-card footer button')].map((b) => b.textContent)).toEqual(['Close']);
    expect(container.querySelector('.rb-rs-card')!.textContent).toMatch(/Rime Spear/);
  });

  it('beside the bar, only the super; under it, the talents alone', () => {
    const p = PRESETS.warrior[0]!;
    const { container } = render(<BarRow bar={p.bar} cls="warrior" ult={p.ult} />);
    const titles = [...container.querySelectorAll('.rb-rs-slot.is-token')].map((b) => b.getAttribute('title'));
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatch(/^Super: /);
    expect(ABILITIES.trinket).toBeUndefined();
    const chips = render(<SetupChips cls="warrior" setup={{ bar: p.bar, talents: p.talents }} />).container;
    expect(chips.querySelectorAll('.rb-rs-chip')).toHaveLength(3);
    expect(chips.querySelector('.is-oath')).toBeNull();
  });

  it('the tutorial no longer walks through extras, and says the bar can be opened and read', () => {
    expect(LOBBY_STEPS.map((s) => s.id)).not.toContain('extras');
    for (const st of LOBBY_STEPS) expect(st.text('warrior')).not.toMatch(/oath/i);
    // (the main screen's bar is labeled as something to open and read)
    expect(LOBBY_STEPS.find((s) => s.id === 'welcome')!.labels!.find((l) => l.spot === 'loadout')!.text).toMatch(/tap to read/);
  });
});

describe('The Ring’s nameplates: the way each fights, in small letters', () => {
  it('a bar plays as its playstyle, and any other as the one it shares most with', () => {
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(playstyleOf(cls, p.bar)).toBe(p.name);
    // (a bar kept from when abilities were chosen one by one: the nearest; a tie, the first)
    expect(playstyleOf('mage', ['m-spear', 'm-steal', 'm-ring', 'm-lash'])).toBe('Rime');
    expect(playstyleOf('mage', ['m-snap'])).toBe(PRESETS.mage[0]!.name);
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
    expect(screen).toContain('{reading && <AbilityCard key={reading.id} ab={reading} cls={pick} bar={bar} talents={talents} onClose={() => setReading(null)} />}');
  });

  it('opened from there it is only read: what it does, when, how it combines, what the talents make of it, and a Close', () => {
    const p = PRESETS.mage[0]!;
    let closed = false;
    const { container, getByText } = render(<AbilityCard ab={ABILITIES['m-burn']!} cls="mage" bar={p.bar} talents={['m-fire-1a']} onClose={() => (closed = true)} />);
    const buttons = [...container.querySelectorAll('footer button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Close']);
    expect(container.textContent).toMatch(/Best used/);
    expect(container.textContent).toMatch(/Flashover/);
    expect(container.textContent).toMatch(/Set it up with.*Ember Lash/);
    // (where it stands in its playstyle's four, and the talent chosen that works on it)
    expect(container.querySelector('header em')!.textContent).toBe('Combo · Burst');
    expect(container.querySelector('.rb-rs-card-talent')!.textContent).toMatch(/Talent · Cinderheart/);
    fireEvent.click(getByText('Close'));
    expect(closed).toBe(true);
  });
});

describe('The Ring’s main screen: the hero’s class, title and name always in sight', () => {
  // the owner, 2026-11-16: "the title and the text below that, now its a scrollable window but it shouldnt be and should
  // be visible at all times"
  it('held to the stand’s width, a long title wraps, and on a phone the name stands under the figure, not over it', () => {
    const css = read('src/games/sigilfall/Game.css');
    expect(/\n\.rb-vlobby-name \{[^}]*grid-template-columns: minmax\(0, 1fr\);/.exec(css)).not.toBeNull();
    expect(/\n\.rb-vlobby-name > \* \{[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere;/.exec(css)).not.toBeNull();
    expect(/\n\.rb-vlobby-name \.tfx \{[^}]*white-space: normal;/.exec(css)).not.toBeNull();
    expect(/\.rb-ringvl \.rb-vlobby-stage \{[^}]*grid-template-rows: minmax\(0, 1fr\) auto;/.exec(css)).not.toBeNull();
    expect(/\.rb-ringvl \.rb-vlobby-name \{[^}]*position: relative;[^}]*grid-row: 2;/.exec(css)).not.toBeNull();
  });
});
