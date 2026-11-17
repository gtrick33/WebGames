/**
 * The Ring after the owner's notes of 2026-11-17: "nightblade rogue cant hit ahyone right now unless they play with a rime
 * mage: introduce a small bleed with the basic attack, very small and also slow enemies down by 15%, make sure the range
 * they have is the same as the warrs or dks"; "for rogues the slow down could be a choice for poison actually, basic
 * attack could have 3 diff poisons - slow down, bleed or random stun sometimes"; "rangers leap should always be a dash
 * forward ... towards the direction ur facing"; and the lobby's words, "from range could be replaced with ranged, and the
 * other type should be melee, difficulty text should be one word only with its respective color".
 */
import fs from 'node:fs';
import { fireEvent, render } from '@testing-library/react';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { fullTalents, ROW_NAMES, TALENT_BY_ID, talentsFor } from '../src/games/sigilfall/arena/talents';
import { CLASS_EASE, CLASS_WAY, EASE_WORD } from '../src/games/sigilfall/arena/styles';
import { GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { cleanPick } from '../src/games/sigilfall/net/ringRoom';
import { LOBBY_STEPS } from '../src/games/sigilfall/arena/tutorial';
import type { MatchEntry } from '../src/games/sigilfall/arena/record';
import { ProgressDialog, RecordBar, type ProgressTab } from '../src/games/sigilfall/ui/RingProgress';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';

const STEP = 1 / 30;
const NIGHTBLADE = PRESETS.gloamknight[1]!;
const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

/** A Nightblade with one venom, out of the shroud, at arm's length from a warrior with health to spare. */
function blade(venom: string): { m: Match; me: Fighter; foe: Fighter } {
  const m = new Match({ seed: 7, map: 'sands', fighters: [{ team: 0, cls: 'gloamknight', name: 'n', bar: NIGHTBLADE.bar, talents: ['g-shadow-1a', 'g-shadow-2a', 'g-3a', venom], ult: NIGHTBLADE.ult }, { team: 1, cls: 'warrior', name: 'w', bar: PRESETS.warrior[0]!.bar, talents: [] }] });
  m.step(GATES + 0.01, {});
  const [me, foe] = m.fighters as [Fighter, Fighter];
  Object.assign(me, { x: 200, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(foe, { x: 220, y: 125, dirX: 1, dirY: 0 });
  foe.hp = foe.maxHp = 50000;
  me.auras = me.auras.filter((a) => a.kind !== 'veil');
  return { m, me, foe };
}
/** A Nightknife, the global cooldown waved. */
const knife = (m: Match, me: Fighter): void => {
  me.gcd = 0;
  me.fought = m.clock;
  expect(m.press(me.id, 'g-knife')).toBeNull();
};

describe('The Ring: the Nightblade reaches and carries a venom', () => {
  it('its blades reach as far as a warrior’s and a Bloodsworn’s', () => {
    for (const id of ['g-knife', 'g-cut']) {
      expect(ABILITIES[id]!.range, id).toBe(ABILITIES['w-hew']!.range);
      expect(ABILITIES[id]!.range, id).toBe(ABILITIES['g-cleave']!.range);
    }
  });

  it('a fourth row of talents, its alone: three venoms for its Nightknife, the slowing one to begin with', () => {
    expect(ROW_NAMES[3]).toBe('Venom');
    const venoms = talentsFor('gloamknight', 'shadow').filter((t) => t.row === 3);
    expect(venoms.map((t) => t.name)).toEqual(['Mire Venom', 'Weeping Venom', 'Numbing Venom']);
    for (const t of venoms) expect(t.via).toBe('g-knife');
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) if (!(cls === 'gloamknight' && p.id === 'shadow')) expect(talentsFor(cls, p.id).some((t) => t.row === 3), p.name).toBe(false);
    expect(NIGHTBLADE.talents).toContain('g-shadow-4a');
    // (a setup kept from before the venoms is given the one it comes with)
    expect(fullTalents('gloamknight', 'shadow', ['g-shadow-1a', 'g-shadow-2b', 'g-3a'], NIGHTBLADE.talents)).toEqual(['g-shadow-1a', 'g-shadow-2b', 'g-3a', 'g-shadow-4a']);
    // (the Nightknife no longer slows of itself: the venom does, or doesn't)
    expect(ABILITIES['g-knife']!.effects.some((e) => e.k === 'slow')).toBe(false);
    expect(ABILITIES['g-knife']!.text).toMatch(/venom/);
  });

  it('Mire Venom: each Nightknife slows by 15% for 4 sec', () => {
    const { m, me, foe } = blade('g-shadow-4a');
    knife(m, me);
    const slow = foe.auras.find((a) => a.kind === 'slow')!;
    expect(slow.n).toBeCloseTo(0.15, 5);
    expect(slow.dur).toBeCloseTo(4, 5);
    expect(slow.ab).toBe('g-shadow-4a');
  });

  it('Weeping Venom: a small bleed that keeps bleeding while the blades fall quicker than it ticks', () => {
    /** Six seconds of a Nightknife every 0.75 sec: what the warrior lost. */
    const run = (venom: string): { lost: number; m: Match; foe: Fighter } => {
      const { m, me, foe } = blade(venom);
      for (let i = 0; i < 6 / STEP; i++) {
        if (i % Math.round(0.75 / STEP) === 0) knife(m, me);
        m.step(STEP, {});
      }
      return { lost: 50000 - foe.hp, m, foe };
    };
    // (the same blades with the slowing venom instead: what is more is the bleed alone)
    const weep = run('g-shadow-4b');
    const blades = run('g-shadow-4a').lost;
    const bled = weep.lost - blades;
    // renewed by every blade, it still ticked once a second: about 5 a second before the class's share
    const k = ABILITIES['g-knife'] ? 0.88 : 1;
    expect(bled).toBeGreaterThan(5 * 5 * k * 0.8);
    expect(bled).toBeLessThan(6 * 5 * k * 1.25);
    expect(weep.foe.auras.find((a) => a.kind === 'dot' && a.ab === 'g-shadow-4b')).toBeDefined();
    // (very small: under a fifth of what the blades themselves dealt)
    expect(bled).toBeLessThan(blades / 5);
  });

  it('Numbing Venom: now and then a one-second stun, never twice within 8 sec', () => {
    const { m, me, foe } = blade('g-shadow-4c');
    const stunned: number[] = [];
    for (let i = 0; i < 60 / STEP; i++) {
      if (i % Math.round(0.75 / STEP) === 0) {
        foe.auras = foe.auras.filter((a) => a.cc !== 'stun');
        knife(m, me);
        if (foe.auras.some((a) => a.cc === 'stun' && a.ab === 'g-shadow-4c')) stunned.push(m.clock);
      }
      m.step(STEP, {});
      m.events.length = 0;
    }
    expect(stunned.length).toBeGreaterThanOrEqual(2);
    expect(stunned.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < stunned.length; i++) expect(stunned[i]! - stunned[i - 1]!).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(TALENT_BY_ID['g-shadow-4c']!.text).toMatch(/20% chance .* 1 sec\. At most once every 8 sec\./);
  });

  it('only the Nightknife carries it: a Closing Cut does not', () => {
    const { m, me, foe } = blade('g-shadow-4a');
    me.pts = 3;
    me.gcd = 0;
    expect(m.press(me.id, 'g-cut')).toBeNull();
    expect(foe.auras.some((a) => a.ab === 'g-shadow-4a')).toBe(false);
  });

  it('a room takes a pick with four talents, so a Nightblade brings its venom to a match with friends', () => {
    const pick = cleanPick({ team: 0, cls: 'gloamknight', bar: NIGHTBLADE.bar, talents: ['g-shadow-1a', 'g-shadow-2a', 'g-3a', 'g-shadow-4c'] });
    expect(pick?.talents).toEqual(['g-shadow-1a', 'g-shadow-2a', 'g-3a', 'g-shadow-4c']);
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain('.slice(0, 4) as string[]) : []');
  });

  it('the setup shows a row only where the playstyle has one, and a venom is read in the Nightknife’s own tooltip', () => {
    const setup = read('src/games/sigilfall/ui/RingSetup.tsx');
    expect(setup).toContain('.filter(({ row }) => options.some((t) => t.row === row))');
    expect(setup).toContain('t.via === ab.id ||');
  });
});

describe('The Ring: a ranger’s Spring Away goes the way they face', () => {
  it('forward along their facing, wherever the nearest enemy is', () => {
    for (const [fx, fy] of [[1, 0], [-1, 0], [0, 1], [0.6, -0.8]] as const) {
      const m = new Match({ seed: 2, map: 'sands', fighters: [{ team: 0, cls: 'ranger', name: 'r', bar: PRESETS.ranger[0]!.bar, talents: [] }, { team: 1, cls: 'warrior', name: 'w', bar: PRESETS.warrior[0]!.bar, talents: [] }] });
      m.step(GATES + 0.01, {});
      const [me, foe] = m.fighters as [Fighter, Fighter];
      Object.assign(me, { x: 200, y: 125, dirX: fx, dirY: fy });
      // (open ground down the middle of the sands; the warrior at their side: it used to spring away from him, whatever
      // way they faced)
      Object.assign(foe, { x: 200 - fy * 20, y: 125 + fx * 20 });
      expect(m.press(me.id, 'r-leap')).toBeNull();
      for (let i = 0; i < 20; i++) m.step(STEP, {});
      const dx = me.x - 200;
      const dy = me.y - 125;
      expect(Math.hypot(dx, dy), `${fx},${fy}`).toBeGreaterThan(40);
      expect((dx * fx + dy * fy) / Math.hypot(dx, dy), `${fx},${fy}`).toBeGreaterThan(0.9);
    }
    expect(ABILITIES['r-leap']!.effects.map((e) => e.k)).toEqual(['break', 'bound']);
    expect(ABILITIES['r-leap']!.text).toMatch(/forward, the way you are facing/);
  });
});

describe('The Ring’s lobby: melee or ranged, and how hard in one word and its color', () => {
  it('Melee and Ranged, never "up close" or "from range"; Easy, Medium or Hard, never "to learn"', () => {
    for (const cls of CLASS_IDS) expect(CLASS_WAY[cls]).toMatch(/^(Melee|Ranged)(, heals)?$/);
    expect(Object.values(EASE_WORD)).toEqual(['Easy', 'Medium', 'Hard']);
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    expect(screen).not.toMatch(/to learn/);
    expect(screen).toContain('<b className={`rb-ease-word is-${CLASS_EASE[pick]}`}>{EASE_WORD[CLASS_EASE[pick]]}</b>');
    expect(read('src/games/sigilfall/arena/tutorial.ts')).not.toMatch(/to learn/);
    expect(Object.keys(CLASS_EASE)).toHaveLength(CLASS_IDS.length);
  });

  it('green, yellow and red, the same on the class list, the playstyle cards and under the hero', () => {
    const css = read('src/games/sigilfall/Game.css');
    const color = (sel: string): string => new RegExp(`${sel.replace(/[.]/g, '\\.')}[^{]*\\{\\s*([^}]*)\\}`).exec(css)![1]!;
    expect(color('.rb-ringvl-tag.is-easy')).toMatch(/color: #7ee36a/);
    expect(color('.rb-ringvl-tag.is-medium')).toMatch(/color: #ffd257/);
    expect(color('.rb-ringvl-tag.is-hard')).toMatch(/color: #ff5a5a/);
    expect(css).toMatch(/\.rb-ease \{[^}]*background: #ffd257;/);
    expect(css).toMatch(/\.rb-ease\.is-easy \{\s*background: #7ee36a;/);
    expect(css).toMatch(/\.rb-ease\.is-hard \{[^}]*background: #e8424a;/);
  });

  it('the wardrobe stays on the main screen, under the hero', () => {
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    const main = screen.slice(screen.indexOf("{page === 'play' && ("), screen.indexOf('<footer className="rb-vlobby-foot rb-ringvl-go">'));
    expect(main).toContain('<WearPicker engine={engine} cls={pick}');
    expect(main).toContain('onClick={() => setLooksOpen(true)}');
  });
});

describe('The Ring’s main screen: the record at a glance', () => {
  // the owner, 2026-11-17: "make sure the progress, challenges, history and etc are present in the main screen as well"
  const entry = (at: number, won: boolean, draw = false): MatchEntry => ({ at, format: 1, cls: 'warrior', won, draw, change: null, rating: null, dmg: 0, heal: 0, combos: 0, kicks: 0 });

  it('challenges, mastery, the season, the last matches and the next reward, each opening its own page', () => {
    const opened: ProgressTab[] = [];
    let rewards = 0;
    const record = { history: [entry(5, true), entry(4, false), entry(3, true), entry(2, false, true), entry(1, true), entry(0, true)] };
    const { container } = render(<RecordBar record={record} best={1000} onOpen={(t) => opened.push(t)} onRewards={() => rewards++} />);
    const pills = [...container.querySelectorAll<HTMLButtonElement>('.rb-ringvl-record .rb-rec')];
    expect(pills.map((b) => b.className.replace('rb-rec is-', ''))).toEqual(['challenges', 'mastery', 'season', 'history', 'rewards']);
    for (const b of pills) fireEvent.click(b);
    expect(opened).toEqual(['challenges', 'mastery', 'season', 'history']);
    expect(rewards).toBe(1);
    // (the last five matches, newest first, as dots: won, lost, drawn)
    expect([...container.querySelectorAll('.rb-rec-dots i')].map((i) => i.className)).toEqual(['is-win', 'is-loss', 'is-win', 'is-draw', 'is-win']);
    expect(container.querySelector('.rb-rec.is-challenges small')!.textContent).toMatch(/^\d+\/\d+$/);
    expect(container.querySelector('.rb-rec.is-rewards small')!.textContent).toMatch(/^Next at \d+$/);
  });

  it('it stands in the main screen’s head; the window of the record opens on the page pressed', () => {
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    const head = screen.slice(screen.indexOf("<header className={lobby ? 'rb-vlobby-head' : 'rb-rp-head'}>"), screen.indexOf('</header>'));
    expect(head).toContain('{lobby && <RecordBar record={save.record ?? {}} best={bestRating()} onOpen={setProgressOpen} onRewards={() => setRewardsOpen(true)} />}');
    expect(screen).toContain('<ProgressDialog record={save.record ?? {}} tab={progressOpen} onClose={() => setProgressOpen(false)} />');
    const { container } = render(<ProgressDialog record={{ history: [entry(1, true)] }} tab="history" onClose={() => {}} />);
    expect(container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toMatch(/^History/);
    // (and the tutorial's first card names it)
    expect(LOBBY_STEPS[0]!.labels!.some((l) => l.spot === 'record')).toBe(true);
    expect(read('src/games/sigilfall/ui/RingProgress.tsx')).toContain('data-tut="record"');
  });
});
