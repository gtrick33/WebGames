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
import { ABILITIES, PRESETS, SUPERS, SUPERS2 } from '../src/games/sigilfall/arena/abilities';
import { setsOf, type ClassSets } from '../src/games/sigilfall/arena/ladder';
import { Match } from '../src/games/sigilfall/arena/sim';
import { playstyleOf, styleOf } from '../src/games/sigilfall/arena/styles';
import { TALENT_BY_ID } from '../src/games/sigilfall/arena/talents';
import { LOBBY_STEPS } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
import { AbilityCard, BarRow, SetupChips, SetupEditor } from '../src/games/sigilfall/ui/RingSetup';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('The Ring’s setup: a playstyle and its talents, and nothing else', () => {
  it('one page of pictures: the playstyles, the bar and its combos, a tree of talents, and one tooltip that reads them', () => {
    let sets: ClassSets = setsOf({ standings: {}, sets: {} }, 'mage');
    const view = render(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    const { container } = view;
    const again = (): void => view.rerender(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    const read = (): string => container.querySelector('.rb-rs-read')!.textContent!;
    // no tabs, nothing to customize, no list of abilities to take from: the abilities are the playstyle's own
    expect(container.querySelector('.rb-rs-tabs')).toBeNull();
    expect(container.querySelector('.rb-rs-kit')).toBeNull();
    expect(container.textContent).not.toMatch(/Customize|Oath of|Unbinding|Extras|Equip/);
    expect([...container.querySelectorAll('.rb-rs-style strong')].map((x) => x.textContent)).toEqual(['Pyre', 'Rime']);
    expect(container.querySelector('.rb-rs-style.is-on strong')!.textContent).toBe('Pyre');
    // its four and its super as icons, and the combos they make as chips: what sets it up, what lands it, how much more
    expect(container.querySelectorAll('.rb-rs-barrow .rb-rs-slot')).toHaveLength(5);
    const links = [...container.querySelectorAll('.rb-rs-link')];
    expect(links.map((l) => l.querySelector('b')!.textContent)).toEqual(['+60%', '+30%']);
    for (const l of links) expect(l.querySelectorAll('img')).toHaveLength(2);
    // a tree of talents: three rows of three, an icon and a name each, one taken in each, the first two the playstyle's own
    const rows = [...container.querySelectorAll('.rb-rs-row')];
    expect(rows.map((r) => r.querySelector('h4')!.textContent)).toEqual(['Core', 'Utility', 'Defensive']);
    for (const r of rows) {
      expect(r.querySelectorAll('.rb-rs-node')).toHaveLength(3);
      expect(r.querySelectorAll('.rb-rs-node.is-on')).toHaveLength(1);
      for (const n of r.querySelectorAll('.rb-rs-node')) expect(n.querySelector('img')).not.toBeNull();
    }
    expect(rows[0]!.textContent).toBe('CoreCinderheartBanked EmbersWildfire');
    // (the owner, 2026-11-16: "i really dislike the fact that ui is 90% texts": what a talent or an ability does is
    // written once, in the one tooltip, and never beside every icon)
    const words = [...ABILITIES['m-lash']!.text.split(' '), ...TALENT_BY_ID['m-fire-1b']!.text.split(' ')].filter((w) => w.length > 7);
    expect(container.querySelectorAll('.rb-rs-read')).toHaveLength(1);
    expect(container.querySelector('.rb-rs-pick')!.textContent).not.toMatch(new RegExp(words.join('|')));
    // it opens on the basic ability, read as a tooltip: its name and place, how it is used, what it does
    expect(read()).toMatch(/^Ember LashBasic0\.8 sec cast · Ranged/);
    expect(read()).toContain(ABILITIES['m-lash']!.text);
    // pointing at an ability reads it, with its combo; at a combo's chip, the combo
    fireEvent.mouseEnter(container.querySelectorAll('.rb-rs-barrow .rb-rs-slot')[1]!);
    expect(read()).toMatch(/^FlashburnComboInstant · Ranged5 sec cooldown/);
    expect(container.querySelector('.rb-rs-read .rb-stip-combo')!.textContent).toMatch(/^Flashover Deals 60% more damage/);
    fireEvent.click(links[0]!);
    expect(read()).toMatch(/^FlashoverEmber Lash › Flashburn/);
    // choosing another talent in a row takes that row's place and reads it; one is always chosen
    fireEvent.click(view.getByRole('radio', { name: 'Banked Embers' }));
    expect(sets.list[0]!.talents).toContain('m-fire-1b');
    expect(sets.list[0]!.talents).not.toContain('m-fire-1a');
    expect(sets.list[0]!.talents).toHaveLength(3);
    again();
    expect(read()).toMatch(/^Banked EmbersTalent · Core/);
    expect(read()).toContain(TALENT_BY_ID['m-fire-1b']!.text);
    fireEvent.click(view.getByRole('radio', { name: 'Banked Embers' }));
    expect(sets.list[0]!.talents).toHaveLength(3);
    // (and the ability it works on says so in its own tooltip)
    fireEvent.mouseEnter(container.querySelectorAll('.rb-rs-barrow .rb-rs-slot')[1]!);
    expect(container.querySelector('.rb-rs-read .rb-stip-talent')!.textContent).toMatch(/^Banked Embers /);
    // the other playstyle: its own four and super, its own talents, and the class's row kept as it was chosen
    const kept = sets.list[0]!.talents.find((t) => t.startsWith('m-3'))!;
    fireEvent.click(view.getByRole('radio', { name: /^Rime/ }));
    expect(sets.list[0]!.bar).toEqual(PRESETS.mage[1]!.bar);
    expect(sets.list[0]!.ult).toBe(PRESETS.mage[1]!.ult);
    expect(sets.list[0]!.talents).toEqual([PRESETS.mage[1]!.talents[0], PRESETS.mage[1]!.talents[1], kept]);
    again();
    expect(read()).toMatch(/^Rime SpearBasic/);
    expect([...container.querySelectorAll('.rb-rs-link b')].map((x) => x.textContent)).toEqual(['×2', '×3']);
    // nothing here opens a window over the page
    fireEvent.click(container.querySelector('.rb-rs-barrow .rb-rs-slot')!);
    expect(container.querySelector('.rb-rs-card')).toBeNull();
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

  it('opened from there it is a tooltip and a Close: what it does, its combo, and what the talents chosen make of it', () => {
    const p = PRESETS.mage[0]!;
    let closed = false;
    const { container, getByText } = render(<AbilityCard ab={ABILITIES['m-burn']!} cls="mage" bar={p.bar} talents={['m-fire-1a']} onClose={() => (closed = true)} />);
    const buttons = [...container.querySelectorAll('footer button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Close']);
    // (where it stands in its playstyle's four, how it is used and how soon again)
    expect(container.querySelector('.rb-stip header em')!.textContent).toBe('Combo');
    expect([...container.querySelectorAll('.rb-stip-meta span')].map((x) => x.textContent)).toEqual(['Instant · Ranged', '5 sec cooldown']);
    expect(container.querySelector('.rb-stip-text')!.textContent).toBe(ABILITIES['m-burn']!.text);
    expect(container.querySelector('.rb-stip-combo')!.textContent).toMatch(/^Flashover .*Ember Lash/);
    expect(container.querySelector('.rb-stip-talent')!.textContent).toMatch(/^Cinderheart /);
    // (and nothing besides: no advice, nothing said twice)
    expect(container.textContent).not.toMatch(/Best used|Set it up with|It sets up/);
    expect(container.querySelectorAll('.rb-stip p')).toHaveLength(4);
    fireEvent.click(getByText('Close'));
    expect(closed).toBe(true);
  });

  it('a spell reads as a tooltip does: short, what it does and by how much, in the same words everywhere', () => {
    // the owner, 2026-11-16: "summarize everything in clear terms, remove the redundant text and make it similar to
    // wow's description of the spells please, i want to know whats happening"
    const all = [...Object.values(ABILITIES), ...Object.values(SUPERS), ...Object.values(SUPERS2)].filter((a) => a.cls !== 'any' && a.text);
    expect(all.length).toBeGreaterThan(70);
    for (const a of all) {
      expect(a.text, a.id).toMatch(/^[A-Z0-9].*\.$/);
      expect(a.text.length, `${a.id}: ${a.text}`).toBeLessThanOrEqual(a.id === 'g-veil' ? 250 : 215);
      // (time in a tooltip's own short form, and never the old turns of phrase)
      expect(a.text, a.id).not.toMatch(/\bseconds?\b|The bread and butter|on the move:|\bsoaks?\b/);
      if (a.effects.some((e) => e.k === 'dmg')) expect(a.text, a.id).toMatch(/\d+ damage/);
      if (a.combo) expect(a.combo.text, a.id).toMatch(/^(Deals|Heals) .*\.$/);
    }
    for (const t of Object.values(TALENT_BY_ID)) {
      expect(t.text, t.id).toMatch(/^[A-Z0-9].*\.$/);
      expect(t.text.length, `${t.id}: ${t.text}`).toBeLessThanOrEqual(215);
      expect(t.text, t.id).not.toMatch(/\bseconds?\b/);
    }
    // (a playstyle in a few words)
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(styleOf(cls, p.id).line.length, p.name).toBeLessThanOrEqual(52);
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
