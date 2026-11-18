/**
 * The Ring after the owner's notes of 2026-11-17, from a phone held sideways: "the ring overlaps the challenges", "add
 * debuffs to yours and your allies health bars", "make the pop up with the arena choosing easier to grasp, currently i
 * have to scroll which is way too annoying, make better design", and "selecting a talent covers the bottom or top row,
 * they should be better displayed, maybe add an X to close".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/games/sigilfall/arena/abilities';
import { setsOf, type ClassSets } from '../src/games/sigilfall/arena/ladder';
import { Match, type Aura } from '../src/games/sigilfall/arena/sim';
import { TALENT_BY_ID } from '../src/games/sigilfall/arena/talents';
import { overhead, OVERHEAD_MAX } from '../src/games/sigilfall/render/ring';
import { Frame } from '../src/games/sigilfall/ui/RingMatch';
import { SetupEditor } from '../src/games/sigilfall/ui/RingSetup';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('src/games/sigilfall/Game.css');
/** The body of the first rule whose selector is exactly `sel` (at any depth). */
const rule = (sel: string): string => {
  const at = css.indexOf(`${sel} {`);
  expect(at, sel).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

const aura = (ab: string, t: number, more: Partial<Aura> = {}): Aura => ({ ab, kind: 'dot', src: 0, t, dur: 9, harmful: true, magic: true, n: 1, ...more });

describe('The Ring’s head: its name never runs under the record', () => {
  it('the title keeps its room and its one line; the record gives way, its words first, then the small print', () => {
    expect(rule('.rb-ringvl .rb-vlobby-head > .rb-rp-title')).toMatch(/flex: 1 0 auto/);
    expect(rule('.rb-ringvl .rb-vlobby-head h2')).toMatch(/white-space: nowrap/);
    const bar = rule('.rb-ringvl-record');
    expect(bar).toMatch(/flex: 0 1 auto/);
    expect(bar).toMatch(/min-width: 0/);
    expect(bar).toMatch(/overflow: hidden/);
    // (a phone held sideways is about 930 wide: the pills there are icons and counts, without their names)
    const narrow = css.slice(css.indexOf('@container (max-width: 1180px)'));
    expect(narrow.slice(0, narrow.indexOf('\n}'))).toMatch(/\.rb-rec b[^{]*\{\s*display: none/);
  });
});

describe('The Ring’s nameplates: what the other side put on you and your allies', () => {
  const on = [aura('k-dart', 3, { src: 5 }), aura('p-curse', 6, { src: 0 }), aura('m-toad', 2, { src: 5, kind: 'cc', cc: 'incap' }), aura('l-regrow', 8, { src: 7, harmful: false, kind: 'hot' }), aura('w-bleed', 9, { src: 6 })];

  it('over the head of one of your own: a hold, then the foes’ harm, longest first; nothing of what helps', () => {
    const shown = overhead({ auras: on }, 0, true);
    expect(shown.length).toBe(OVERHEAD_MAX);
    expect(shown.map((a) => a.ab)).toEqual(['m-toad', 'w-bleed', 'k-dart']);
    // (over a foe's head, as it was: a hold and what the player put on them)
    expect(overhead({ auras: on }, 0).map((a) => a.ab)).toEqual(['m-toad', 'p-curse']);
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('overhead(f, myId, !!viewer && viewer.team === f.team)');
  });

  it('on the nameplate of one of your own: the harm before the help', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'Ilsa', bar: PRESETS.mage[0]!.bar }, { team: 0, cls: 'priest', name: 'Ada', bar: PRESETS.priest[0]!.bar }, { team: 1, cls: 'warlock', name: 'Nyx', bar: PRESETS.warlock[0]!.bar }] });
    const [me, ally, foe] = m.fighters as [Match['fighters'][0], Match['fighters'][0], Match['fighters'][0]];
    ally.auras = [aura('l-regrow', 8, { src: 1, harmful: false, kind: 'hot' }), aura('k-dart', 3, { src: 2 })];
    const plate = render(<Frame f={ally} m={m} me={me} doll="" tag={null} onPick={() => {}} />).container;
    expect([...plate.querySelectorAll('.rb-ring-auras i')].map((i) => i.className)).toEqual(['is-bad', 'is-good']);
    // (a foe's, as it was: in the order they came)
    foe.auras = [aura('l-regrow', 8, { src: 2, harmful: false, kind: 'hot' }), aura('k-dart', 3, { src: 0 })];
    const theirs = render(<Frame f={foe} m={m} me={me} doll="" tag={null} onPick={() => {}} flip />).container;
    expect([...theirs.querySelectorAll('.rb-ring-auras i')].map((i) => i.className)).toEqual(['is-good', 'is-bad']);
  });

  it('on a phone, where the row under the nameplates is left out, your side’s harm stands beside its nameplates', () => {
    expect(css).toMatch(/\.rb-ring\.is-touch \.rb-ring-under \{\s*display: none;/);
    const own = rule('.rb-ring.is-touch .rb-ring-team:not(.is-foes) .rb-ring-under');
    expect(own).toMatch(/position: absolute/);
    expect(own).toMatch(/left: calc\(100% \+ 4px\)/);
    expect(own).toMatch(/display: flex/);
    expect(own).toMatch(/pointer-events: none/);
    expect(rule('.rb-ring.is-touch .rb-ring-team:not(.is-foes) .rb-ring-auras i.is-good')).toMatch(/display: none/);
    // (the foes' side stays as it was: their nameplates are on the far edge, with no room beside them)
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain('<AuraIcons f={f} ours={!!me && me.team === f.team} />');
  });
});

describe('The Ring’s fight window: everything in sight at once', () => {
  const screen = read('src/games/sigilfall/ui/RingScreen.tsx');

  it('two columns, the formats, rank and partners in one, the arenas as pictures in the other; nothing to open first', () => {
    // (the layer is ui/RingPlay.tsx's since the owner's notes of 2026-11-18; the main screen opens it)
    expect(screen).toContain('<PlayLayer');
    const play = read('src/games/sigilfall/ui/RingPlay.tsx');
    const layer = play.slice(play.indexOf('export function PlayLayer('));
    const body = layer.slice(layer.indexOf('rb-ringvl-playbody'), layer.indexOf('rb-ringvl-playfoot'));
    expect(body).toContain('<section className="rb-ringvl-playfight rb-fight-left" aria-label="The fight">');
    expect(body).toContain('<ArenaChoice map={props.map} onPick={props.onMap} />');
    expect(layer).not.toMatch(/mapsOpen|RewardStrip|ProgressLink/);
    expect(rule('.rb-ringvl-playbody')).toMatch(/grid-template-columns: minmax\(0, 1\.08fr\) minmax\(0, 1fr\)/);
    // (held to the screen less the phone's insets at the top and the foot)
    expect(rule('.rb-ring-dialog.rb-ringvl-play')).toMatch(/max-height: calc\(100cqh - 20px - var\(--sa-t, 0px\) - var\(--sa-b, 0px\)\)/);
    // (a phone held upright: one column)
    const upright = css.slice(css.indexOf('@container (max-width: 600px)'));
    expect(upright.slice(0, 400)).toMatch(/\.rb-ringvl-playbody \{\s*grid-template-columns: minmax\(0, 1fr\)/);
  });
});

describe('The Ring’s setup on a narrow screen: what is tapped opens under its row, with a cross', () => {
  const editor = () => {
    let sets: ClassSets = setsOf({ standings: {}, sets: {} }, 'mage');
    const view = render(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    const again = (): void => view.rerender(<SetupEditor cls="mage" sets={sets} onSets={(s) => (sets = s)} />);
    return { view, again };
  };

  it('a talent: under its own row, before the next, and the cross or the same talent again puts it away', () => {
    const { view, again } = editor();
    const { container } = view;
    expect(container.querySelector('.rb-rs-inline')).toBeNull();
    const rows = () => [...container.querySelectorAll('.rb-rs-row')];
    const node = rows()[1]!.querySelectorAll('.rb-rs-node')[2]!;
    const name = node.getAttribute('aria-label')!;
    fireEvent.click(node);
    again();
    const panel = container.querySelector('.rb-rs-inline')!;
    expect(panel).not.toBeNull();
    // (between the row tapped and the one after it: the rows make way, nothing is covered)
    expect(panel.previousElementSibling).toBe(rows()[1]!);
    expect(panel.nextElementSibling).toBe(rows()[2]!);
    expect(panel.textContent).toContain(name);
    expect(panel.textContent).toContain(Object.values(TALENT_BY_ID).find((t) => t.name === name)!.text.slice(0, 20));
    expect(rows()[1]!.querySelector('.rb-rs-node.rb-is-pressed')!.getAttribute('aria-label')).toBe(name);
    expect(container.querySelector('.rb-rs')!.className).toMatch(/\bis-open\b/);
    // the cross
    fireEvent.click(view.getByRole('button', { name: 'Close' }));
    expect(container.querySelector('.rb-rs-inline')).toBeNull();
    // the same one twice: open, then away
    const first = rows()[0]!.querySelector('.rb-rs-node')!;
    fireEvent.click(first);
    expect(container.querySelector('.rb-rs-inline')!.previousElementSibling).toBe(rows()[0]!);
    fireEvent.click(first);
    expect(container.querySelector('.rb-rs-inline')).toBeNull();
  });

  it('an ability or a combo: under the bar, before the talents; another one pressed takes its place', () => {
    const { view } = editor();
    const { container } = view;
    const slot = container.querySelectorAll('.rb-rs-barrow .rb-rs-slot')[1]!;
    fireEvent.click(slot);
    let panel = container.querySelector('.rb-rs-inline')!;
    expect(panel.previousElementSibling!.className).toBe('rb-rs-kitrow');
    expect(panel.nextElementSibling!.className).toBe('rb-rs-talents');
    expect(panel.textContent).toContain(slot.getAttribute('aria-label')!);
    expect(slot.className).toMatch(/rb-is-pressed/);
    fireEvent.click(container.querySelector('.rb-rs-link')!);
    panel = container.querySelector('.rb-rs-inline')!;
    expect(panel.querySelector('.rb-stip.is-combo')).not.toBeNull();
    expect(container.querySelectorAll('.rb-rs-inline')).toHaveLength(1);
    // (a talent pressed moves it to under the talent's row)
    fireEvent.click(container.querySelector('.rb-rs-row .rb-rs-node')!);
    expect(container.querySelectorAll('.rb-rs-inline')).toHaveLength(1);
    expect(container.querySelector('.rb-rs-inline')!.previousElementSibling!.className).toBe('rb-rs-row');
  });

  it('a mouse pointing elsewhere changes neither what the panel reads nor brings a tooltip over it', () => {
    const { view } = editor();
    const { container } = view;
    const nodes = container.querySelectorAll('.rb-rs-row .rb-rs-node');
    fireEvent.click(nodes[0]!);
    const said = container.querySelector('.rb-rs-inline')!.textContent;
    fireEvent.mouseEnter(nodes[4]!);
    expect(container.querySelector('.rb-rs-inline')!.textContent).toBe(said);
    expect(container.querySelector('.rb-rs')!.className).not.toMatch(/\bis-tip\b/);
    // (the box beside the icons, where there is room for it, still reads what is pointed at)
    expect(container.querySelector('.rb-rs-read')!.textContent).toContain(nodes[4]!.getAttribute('aria-label')!);
  });

  it('only where the editor is narrow; beside the icons, the box that reads them is enough', () => {
    expect(css).toMatch(/\n\.rb-rs-inline \{\s*display: none;\s*\}/);
    const narrow = css.slice(css.indexOf('@container rb-build (max-width: 560px)'));
    const block = narrow.slice(0, narrow.indexOf('\n}'));
    expect(block).toMatch(/\.rb-ringvl-build \.rb-rs-inline \{[^}]*display: block;/);
    expect(rule('.rb-rs-inline-x')).toMatch(/position: absolute/);
  });
});
