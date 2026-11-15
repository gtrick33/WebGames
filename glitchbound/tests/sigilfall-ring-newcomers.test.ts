import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { hintNow, keepLog, lessonOf, newLog, type HintKeys } from '../src/games/sigilfall/arena/lessons';
import { CLASS_EASE, CLASS_WAY, presetOfBar, STYLES, styleOf } from '../src/games/sigilfall/arena/styles';
import { CLOSE_FROM, GATES, Match, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { LOBBY_STEPS, TutorialRun, tutorialSetup } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { plainWhy } from '../src/games/sigilfall/ui/ringAim';

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

function tutorialMatch(cls: ClassId): { m: Match; tut: TutorialRun } {
  const p = PRESETS[cls][0]!;
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

  it('a bar is known as its playstyle whatever order its four are in, and a bar of your own is none', () => {
    const p = PRESETS.warrior[1]!;
    expect(presetOfBar('warrior', [...p.bar].reverse())).toBe(1);
    expect(presetOfBar('warrior', ['w-hew', 'w-crack', 'w-stand', 'w-free'])).toBe(-1);
  });
});

describe('The Ring for newcomers: plain words', () => {
  it('says what holds you, how near to go, and what is in the way', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'a', bar: PRESETS.mage[0]!.bar }, { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar }] });
    m.step(GATES + 0.01, {});
    const foe = m.fighters[1]!;
    foe.bar = [...foe.bar.slice(0, 4), 'trinket'];
    foe.auras.push({ ab: 'm-chill', kind: 'cc', cc: 'stun', src: 0, t: 2, dur: 2, harmful: true, magic: true, n: 0 });
    // (the trinket breaks it while it is on the bar and ready, and says so; once spent, the hold is waited out)
    expect(plainWhy(m, foe, 'You can’t do that now', ABILITIES['w-hew'])).toBe('You’re stunned: your trinket breaks you free');
    foe.cds.trinket = 30;
    expect(plainWhy(m, foe, 'You can’t do that now', ABILITIES['w-hew'])).toBe('You’re stunned and can’t act yet');
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
    expect(lessonOf({ ...newLog(), fought: 60, inGloam: 9 }, me, KEYS)).toMatch(/Gloam/);
    expect(lessonOf({ ...newLog(), fought: 60, hurtBySphere: 12 }, me, KEYS)).toMatch(/sphere/);
    expect(lessonOf({ ...newLog(), fought: 20 }, me, KEYS)).toMatch(/combo/);
    me.score.combos = 2;
    me.score.supers = 1;
    expect(lessonOf({ ...newLog(), fought: 60 }, me, KEYS)).toBeNull();
  });
});

describe('The Ring for newcomers: the tutorial', () => {
  it('walks the lobby from the classes to the setup page’s every tab', () => {
    const ids = LOBBY_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of ['classes', 'formats', 'styles', 'kit', 'combos', 'talents', 'super']) expect(ids).toContain(want);
    // (the extras, an oath and the charm, were taken out on 2026-11-15)
    expect(ids).not.toContain('extras');
    expect(LOBBY_STEPS.filter((s) => s.page === 'setup').map((s) => s.tab ?? s.mode)).toEqual(expect.arrayContaining(['styles', 'abilities', 'talents', 'super']));
    for (const s of LOBBY_STEPS) for (const cls of CLASS_IDS) expect(s.text(cls).length).toBeGreaterThan(20);
  });

  it('is not rated, holds the clock, against a sparring mage', () => {
    const { m, tut } = tutorialMatch('warrior');
    expect(m.hold).toBe(true);
    expect(m.fighters[1]!.cls).toBe('mage');
    expect(tut.steps[0]).toBe('gates');
    expect(tut.steps.at(-1)).toBe('fight');
    expect(tut.steps).not.toContain('place');
    // (a bar with a placed ability gets its own lesson in placing it)
    expect(tutorialMatch('mage').tut.steps).toContain('place');
  });

  it('teaches one thing at a time, each done for real, from the entry to the last fight', () => {
    const { m, tut } = tutorialMatch('warrior');
    const me = m.fighters[0]!;
    const foe = m.fighters[1]!;
    const view = () => tut.view(TUT_KEYS);
    expect(view().title).toBe('The entry');
    m.openSoon();
    run(m, tut, 3.2);
    expect(m.phase).toBe('fight');
    expect(tut.id).toBe('plates');
    expect(view().next).toBe(true);
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
    run(m, tut, 1);
    expect(m.press(0, 'w-hew')).toBeNull();
    run(m, tut, 0.5);
    expect(tut.id).toBe('momentum');
    tut.next();

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

    expect(tut.id).toBe('sphere');
    expect(me.hp).toBeLessThan(me.maxHp * 0.5);
    const orb = m.orbs[0]!;
    me.x = orb.x;
    me.y = orb.y;
    run(m, tut, 0.2);

    expect(tut.id).toBe('sigil');
    run(m, tut, STEP);
    expect(m.sigil).not.toBeNull();
    me.x = m.sigil!.x;
    me.y = m.sigil!.y;
    run(m, tut, 0.2);

    expect(tut.id).toBe('pillar');
    // somewhere the sparring partner can't see
    hide: for (let x = 20; x < 480; x += 6) {
      for (let y = 20; y < 300; y += 6) {
        me.x = x;
        me.y = y;
        if (!m.sees(me, foe) && !m.sees(foe, me)) break hide;
      }
    }
    run(m, tut, 0.6);
    expect(tut.id).toBe('holds');
    expect(m.clock).toBe(0);
    // (its fire, cast to be watched)
    run(m, tut, 1);
    tut.next();
    expect(tut.id).toBe('friends');
    tut.next();

    // (the clock stood still through every lesson, and is let go where the Gloam begins)
    expect(tut.id).toBe('gloam');
    expect(m.clock).toBeGreaterThanOrEqual(CLOSE_FROM - 1);
    expect(m.hold).toBe(false);
    tut.next();
    expect(tut.id).toBe('fight');
    expect(tut.free).toBe(true);
    expect(me.hp).toBe(me.maxHp);
    expect(foe.hp).toBe(foe.maxHp);
  });

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
