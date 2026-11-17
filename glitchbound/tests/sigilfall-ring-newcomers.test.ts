import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { hintNow, keepLog, lessonOf, newLog, type HintKeys } from '../src/games/sigilfall/arena/lessons';
import { CLASS_EASE, CLASS_WAY, presetOfBar, STYLES, styleOf } from '../src/games/sigilfall/arena/styles';
import { CLASS_DMG, DAMP_FROM, GATES, Match, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { LOBBY_STEPS, SPAR_DMG, SPAR_DMG_LOW, TutorialRun, tutorialSetup } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { plainWhy } from '../src/games/sigilfall/ui/ringAim';

const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const STEP = 1 / 30;
const KEYS: HintKeys = { touch: false, dash: 'Space', super: 'Q' };
const TUT_KEYS = { touch: false, ab: ['1', '2', '3', '4'], dash: 'Space', super: 'Q', nextFoe: 'Tab', nextFriend: 'F', closeIn: true };

/** Frames of a tutorial match as the screen runs them: a step, the lesson's look at it, and the frame's events taken away. */
function run(m: Match, tut: TutorialRun, seconds: number, mine: MoveInput = { mx: 0, my: 0 }): void {
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, { 0: mine, 1: tut.free ? { mx: 0, my: 0 } : tut.foeMove() });
    tut.after(STEP);
    m.events = [];
  }
}

function tutorialMatch(cls: ClassId, style = 0): { m: Match; tut: TutorialRun } {
  const p = PRESETS[cls][style]!;
  const m = new Match(tutorialSetup({ team: 0, cls, name: 'You', bar: [...p.bar], talents: [...p.talents], ult: p.ult }, 7));
  return { m, tut: new TutorialRun(m, 0, 1) };
}

describe('The Ring for newcomers: playstyles and how hard each class is', () => {
  it('every class has a difficulty and a way of fighting, and every ready-made build a playstyle line', () => {
    for (const cls of CLASS_IDS) {
      expect(CLASS_EASE[cls]).toMatch(/^(easy|medium|hard)$/);
      expect(CLASS_WAY[cls].length).toBeGreaterThan(3);
      for (const p of PRESETS[cls]) {
        expect(STYLES[cls][p.id], `${cls} ${p.id}`).toBeDefined();
        expect(styleOf(cls, p.id).line.length).toBeGreaterThan(10);
      }
    }
  });

  it('a bar is known as its playstyle whatever order its four are in; any other is read as the nearest', () => {
    const p = PRESETS.warrior[1]!;
    expect(presetOfBar('warrior', [...p.bar].reverse())).toBe(1);
    // (a bar kept from when abilities were chosen one by one: the playstyle it shares most with, the first on a tie)
    expect(presetOfBar('warrior', ['w-hew', 'w-crack', 'w-stand', 'w-free'])).toBe(0);
    expect(presetOfBar('warrior', ['w-bleed', 'w-crack', 'w-stand', 'w-free'])).toBe(1);
  });
});

describe('The Ring for newcomers: plain words', () => {
  it('says what holds you, how near to go, and what is in the way', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'a', bar: PRESETS.mage[0]!.bar }, { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar }] });
    m.step(GATES + 0.01, {});
    const foe = m.fighters[1]!;
    foe.auras.push({ ab: 'd-hammer', kind: 'cc', cc: 'stun', src: 0, t: 2, dur: 2, harmful: true, magic: true, n: 0 });
    // (a hold is waited out, unless something of theirs works while held and is ready: then it says which)
    expect(plainWhy(m, foe, 'You can’t do that now', ABILITIES['w-hew'])).toBe('You’re stunned and can’t act yet');
    const me = m.fighters[0]!;
    me.auras.push({ ab: 'd-hammer', kind: 'cc', cc: 'stun', src: 1, t: 2, dur: 2, harmful: true, magic: true, n: 0 });
    expect(plainWhy(m, me, 'You can’t do that now', ABILITIES['m-lash'])).toBe('You’re stunned: Flicker still works');
    me.cds['m-blink'] = 6;
    expect(plainWhy(m, me, 'You can’t do that now', ABILITIES['m-lash'])).toBe('You’re stunned and can’t act yet');
    expect(plainWhy(m, foe, 'Too far away', ABILITIES['w-hew'])).toMatch(/walk up/);
    expect(plainWhy(m, foe, 'Too far away', ABILITIES['m-lash'])).toMatch(/get closer/);
    expect(plainWhy(m, foe, 'Out of sight', undefined)).toMatch(/pillar/);
  });
});

describe('The Ring for newcomers: hints and lessons', () => {
  it('hints at a red circle under you first, then a full super, each only until it is seen', () => {
    const m = new Match({ seed: 2, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: PRESETS.warrior[0]!.bar }, { team: 1, cls: 'mage', name: 'b', bar: PRESETS.mage[0]!.bar }] });
    m.step(GATES + 0.01, {});
    const me = m.fighters[0]!;
    expect(hintNow(m, me, [], KEYS)).toBeNull();
    me.charge = 1;
    m.zones.push({ ab: 'm-super', src: 1, team: 1, x: me.x, y: me.y, r: 60, t: 0.8, dur: 0.8 });
    expect(hintNow(m, me, [], KEYS)?.id).toBe('circle');
    expect(hintNow(m, me, [], KEYS)?.text).toMatch(/Walk out of it/);
    expect(hintNow(m, me, ['circle'], KEYS)?.id).toBe('super');
    expect(hintNow(m, me, ['circle', 'super'], { ...KEYS, touch: true })).toBeNull();
  });

  it('counts a circle that lands on you while you were free to walk out, and not one you left', () => {
    const m = new Match({ seed: 3, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: PRESETS.warrior[0]!.bar }, { team: 1, cls: 'mage', name: 'b', bar: PRESETS.mage[0]!.bar }] });
    m.step(GATES + 0.01, {});
    const me = m.fighters[0]!;
    const foe = m.fighters[1]!;
    foe.x = me.x + 60;
    foe.y = me.y;
    foe.target = me.id;
    const log = newLog();
    const circles = new Map<string, boolean>();
    const land = (): void => {
      foe.charge = 1;
      expect(m.press(1, 'm-super', { x: me.x, y: me.y })).toBeNull();
      for (let i = 0; i < 1.2 / STEP; i++) {
        m.step(STEP, {});
        keepLog(log, m, me, STEP, circles);
        m.events = [];
      }
    };
    land();
    expect(log.circlesTaken).toBe(1);
    me.x -= 100;
    foe.charge = 1;
    expect(m.press(1, 'm-super', { x: me.x + 100, y: me.y })).toBeNull();
    for (let i = 0; i < 1.2 / STEP; i++) {
      m.step(STEP, {});
      keepLog(log, m, me, STEP, circles);
      m.events = [];
    }
    expect(log.circlesTaken).toBe(1);
  });

  it('picks the biggest slip as the one thing to try, in order', () => {
    const m = new Match({ seed: 4, map: 'sands', fighters: [{ team: 0, cls: 'warrior', name: 'a', bar: PRESETS.warrior[0]!.bar }, { team: 1, cls: 'mage', name: 'b', bar: PRESETS.mage[0]!.bar }] });
    const me = m.fighters[0]!;
    expect(lessonOf({ ...newLog(), fought: 60, circlesTaken: 3, outOfReach: 40 }, me, KEYS)).toMatch(/3 red circles/);
    expect(lessonOf({ ...newLog(), fought: 60, outOfReach: 40 }, me, KEYS)).toMatch(/up close.*Bull Rush/);
    expect(lessonOf({ ...newLog(), fought: 60, superIdle: 20 }, me, KEYS)).toMatch(/press Q/i);
    expect(lessonOf({ ...newLog(), fought: 60, hurtBySphere: 12 }, me, KEYS)).toMatch(/sphere/);
    expect(lessonOf({ ...newLog(), fought: 20 }, me, KEYS)).toMatch(/combo/);
    me.score.combos = 2;
    me.score.supers = 1;
    expect(lessonOf({ ...newLog(), fought: 60 }, me, KEYS)).toBeNull();
  });
});

describe('The Ring for newcomers: the tutorial', () => {
  it('shows the lobby in three cards, each screen with every part of it labeled at once', () => {
    // (the owner, 2026-11-15: shorter, and "show everything initially, i dont want stage by stage unlocking")
    const ids = LOBBY_STEPS.map((s) => s.id);
    expect(ids).toEqual(['welcome', 'styles', 'kit']);
    const spots = LOBBY_STEPS.flatMap((s) => (s.labels ?? []).map((l) => l.spot));
    for (const want of ['classes', 'formats', 'rank', 'arena', 'loadout', 'bar', 'combos', 'talents']) expect(spots).toContain(want);
    for (const s of LOBBY_STEPS) for (const l of s.labels ?? []) expect(l.text.length, l.spot).toBeLessThan(40);
    // (the setup page is one page: the playstyles, then the rest of it, labeled)
    expect(LOBBY_STEPS.filter((s) => s.page === 'setup').map((s) => s.id)).toEqual(['styles', 'kit']);
    expect(LOBBY_STEPS.find((s) => s.id === 'kit')!.text('mage')).toMatch(/talents/);
    for (const s of LOBBY_STEPS) for (const cls of CLASS_IDS) expect(s.text(cls).length).toBeGreaterThan(20);
    expect(LOBBY_STEPS.some((s) => /momentum|extras|oath/i.test(s.text('warrior')))).toBe(false);
  });

  // the owner, 2026-11-16: "during the tutorial, i suggest you block the buttons unless what the tutorial points you
  // to press, i could open different tabs and the tutorial keeps the text and theres bugs"
  it('while a lobby step is read, only the parts it is about can be used', () => {
    const allow = Object.fromEntries(LOBBY_STEPS.map((s) => [s.id, [...s.allow]]));
    // (a class and a fight on the main screen: not the setup, not friends, not the tutorial's own button again)
    expect(allow.welcome).toEqual(['classes', 'formats']);
    expect(allow.styles).toEqual(['styles']);
    expect(allow.kit).toEqual(['styles', 'bar', 'combos', 'talents']);
    // every part allowed is a part of that step's own page, marked in it
    const pages = { play: read('src/games/sigilfall/ui/RingScreen.tsx'), setup: read('src/games/sigilfall/ui/RingSetup.tsx') };
    for (const s of LOBBY_STEPS) for (const spot of s.allow) expect(pages[s.page], `${s.id}: ${spot}`).toContain(`data-tut="${spot}"`);
    // the lock is on for as long as a step is read, and a step is read only over its own page
    const screen = pages.play;
    expect(screen).toContain('useTutLock(!!tutStep, tutStep?.allow);');
    expect(screen).toContain('const tutStep = tutAt && tutAt.page === page ? tutAt : null;');
  });

  it('in the practice match a step takes only the buttons it is about, and the setup can’t be changed', () => {
    const { m, tut } = tutorialMatch('mage', 1);
    const me = m.fighters[0]!;
    const takes = (): boolean[] => [...me.bar, me.ult].map((id) => tut.allows(id));
    const at = (id: string): void => {
      tut.i = tut.steps.indexOf(id as (typeof tut.steps)[number]);
      expect(tut.id).toBe(id);
    };
    for (const id of ['gates', 'screen', 'move', 'target']) {
      at(id);
      expect(takes(), id).toEqual([false, false, false, false, false]);
    }
    for (const id of ['ability', 'combo', 'circle', 'place']) {
      at(id);
      expect(takes(), id).toEqual([true, true, true, true, false]);
    }
    at('super');
    expect(takes()).toEqual([false, false, false, false, true]);
    expect(tut.shutWhy()).toMatch(/super/);
    at('fight');
    expect(takes()).toEqual([true, true, true, true, true]);
    // the screen asks before every press, says why a shut one is shut, dims it, and offers no setup change
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).toMatch(/if \(tut && !tut\.allows\(id\)\) \{\s*say\(tut\.shutWhy\(\), undefined, true\);\s*return;/);
    expect(match.match(/tut && !tut\.allows\(ab\.id\) \? ' is-tut-off' : ''/g)).toHaveLength(2);
    expect(match).toMatch(/\{!tut && \(\s*<button[^>]*onClick=\{\(\) => setEditing\(true\)\}>\s*Change my setup/);
    expect(tutorialMatch('warrior').tut.view(TUT_KEYS).text).not.toMatch(/\(Change my setup\)/);
  });

  it('is not rated, holds the clock, against a sparring mage', () => {
    const { m, tut } = tutorialMatch('warrior');
    expect(m.hold).toBe(true);
    expect(m.fighters[1]!.cls).toBe('mage');
    expect(tut.steps[0]).toBe('gates');
    expect(tut.steps.at(-1)).toBe('fight');
    expect(tut.steps).not.toContain('place');
    // (a playstyle with a placed ability, the Rime's globe, gets its own lesson in placing it)
    expect(tutorialMatch('mage').tut.steps).not.toContain('place');
    expect(tutorialMatch('mage', 1).tut.steps).toContain('place');
  });

  it('shows the fight’s screen labeled at once, then teaches by hand only what is done by hand, then a real fight', () => {
    const { m, tut } = tutorialMatch('warrior');
    const me = m.fighters[0]!;
    const foe = m.fighters[1]!;
    const view = () => tut.view(TUT_KEYS);
    expect(tut.steps).toEqual(['gates', 'screen', 'move', 'target', 'ability', 'combo', 'circle', 'super', 'fight']);
    expect(view().title).toBe('The entry');
    m.openSoon();
    run(m, tut, 3.2);
    expect(m.phase).toBe('fight');
    // every part of the screen named together, and the arena's rules beside it
    expect(tut.id).toBe('screen');
    expect(view().next).toBe(true);
    expect(view().labels!.map((l) => l.spot)).toEqual(expect.arrayContaining(['plates', 'foes', 'clock', 'target', 'bar', 'super']));
    expect(view().text).toMatch(/red circle/);
    expect(view().text).toMatch(/spheres/);
    expect(view().text).toMatch(/sigil/);
    expect(view().text).toMatch(/Pillars/);
    expect(view().text).toMatch(/Healing weakens/);
    expect(view().text).not.toMatch(/Gloam/);
    expect(view().text).not.toMatch(/Momentum/);
    tut.next();

    expect(tut.id).toBe('move');
    run(m, tut, 1.5, { mx: 1, my: 0 });
    expect(tut.id).toBe('target');
    // (nothing moves on until the enemy is chosen by hand)
    run(m, tut, 0.5);
    expect(tut.id).toBe('target');
    m.setTarget(0, 1);
    tut.onTarget(1);
    run(m, tut, STEP);

    expect(tut.id).toBe('ability');
    me.x = foe.x - 20;
    me.y = foe.y;
    expect(m.press(0, 'w-hew')).toBeNull();
    run(m, tut, 1);
    expect(m.press(0, 'w-hurl')).toBeNull();
    run(m, tut, 1);

    // the Reaper's combo: a Festering Gash, then Hew
    expect(tut.id).toBe('combo');
    expect(view().text).toMatch(/Festering Gash.*Hew/);
    expect(m.press(0, 'w-gash')).toBeNull();
    run(m, tut, 0.3);
    // (a Red Mist on the Gash, if a Hew brought one on, is a combo landed already)
    if (tut.id === 'combo') {
      expect(m.press(0, 'w-hew')).toBeNull();
      run(m, tut, 0.3);
    }

    // the red circle: slowed while it falls, and passed by walking out of it
    expect(tut.id).toBe('circle');
    run(m, tut, 0.8);
    expect(m.zones.some((z) => z.team === 1)).toBe(true);
    expect(tut.pace()).toBeLessThan(1);
    run(m, tut, 1.2, { mx: -1, my: 0 });
    expect(view().note).toMatch(/dodged/);

    expect(tut.id).toBe('super');
    expect(me.charge).toBe(1);
    me.x = foe.x - 20;
    me.y = foe.y;
    expect(m.press(0, me.ult)).toBeNull();
    run(m, tut, 0.2);

    // the clock stood still through every lesson, and the last fight starts it from the start
    expect(tut.id).toBe('fight');
    expect(m.clock).toBeLessThan(1);
    expect(m.hold).toBe(false);
    expect(tut.free).toBe(true);
    expect(me.hp).toBe(me.maxHp);
    expect(foe.hp).toBe(foe.maxHp);
    run(m, tut, 2);
    expect(m.clock).toBeGreaterThan(1.5);
    expect(m.clock).toBeLessThan(DAMP_FROM);
  });

  it('the last fight is one a newcomer wins: the partner hits gently, and gentler while they are hurt', () => {
    // (a newcomer here is the computer at its clumsiest on the player's side, against the partner at its clumsiest)
    let won = 0;
    let fought = 0;
    for (const cls of CLASS_IDS) {
      if (cls === 'gloamknight') continue;
      for (let seed = 1; seed <= 5; seed++) {
        const p = PRESETS[cls].find((x) => !x.healer) ?? PRESETS[cls][0]!;
        const m = new Match(tutorialSetup({ team: 0, cls, name: 'You', bar: [...p.bar], talents: [...p.talents], ult: p.ult }, seed));
        const tut = new TutorialRun(m, 0, 1);
        m.openSoon();
        while (tut.id !== 'fight') {
          tut.i = tut.steps.indexOf('super');
          (tut as unknown as { advance: () => void }).advance();
        }
        const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
        for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
          const moves: Record<number, MoveInput> = {};
          for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0, STEP);
          m.step(STEP, moves);
          tut.after(STEP);
          m.events.length = 0;
          if (m.phase === 'fight') {
            // (eased off while the newcomer is under half)
            const k = m.fighters[1]!.mods.dmg / CLASS_DMG.mage;
            expect(k).toBeCloseTo(m.fighters[0]!.hp < m.fighters[0]!.maxHp * 0.5 ? SPAR_DMG_LOW : SPAR_DMG, 5);
          }
        }
        fought++;
        if (m.winner === 0) won++;
      }
    }
    expect(won / fought).toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  it('says what to do in a line on every step done by doing it, the whole of it a press away', () => {
    for (const cls of ['warrior', 'mage', 'priest'] as const) {
      const { tut } = tutorialMatch(cls);
      for (let i = 0; i < tut.steps.length; i++) {
        tut.i = i;
        for (const touch of [false, true]) {
          const v = tut.view({ ...TUT_KEYS, touch });
          if (v.next || v.id === 'gates') expect(v.short).toBe('');
          else {
            expect(v.short.length, `${cls} ${v.id}`).toBeGreaterThan(10);
            expect(v.short.length, `${cls} ${v.id}`).toBeLessThan(v.text.length);
          }
        }
      }
    }
  });

  it('lets nobody fall while it teaches', () => {
    const { m, tut } = tutorialMatch('mage');
    m.openSoon();
    run(m, tut, 3.2);
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    foe.hp = 1;
    me.hp = 1;
    run(m, tut, STEP);
    expect(foe.hp).toBeGreaterThanOrEqual(foe.maxHp * 0.5 - 1);
    expect(me.hp).toBeGreaterThanOrEqual(me.maxHp * 0.3 - 1);
    expect(m.phase).toBe('fight');
  });
});
