/** The Ring (arena/): its rules, the computer players, its ladder, and playing it over a room. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, DASH, kitOf, OATHS, PRESETS, SLOTS, superOf, SUPERS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { afterMatch, COMPS, drawOpponents, namedApart, NEW_STANDING, nextRank, rankOf, ratingChange, RANKS, SET_COUNT, setsOf, skillAt } from '../src/games/sigilfall/arena/ladder';
import { ARENA_H, ARENA_W, ENTRY_W, MAP_IDS, MAPS } from '../src/games/sigilfall/arena/maps';
import { cleanTalents, ROW_NAMES, TALENTS } from '../src/games/sigilfall/arena/talents';
import { BASE_SPEED, CAST_SLOW, clearLine, CLOSE_FROM, CLOSE_TO, GATES, HERO_R, Match, MATCH_LIMIT, RANGED, RANGED_DMG, SIGIL_FIRST, ZONE_END, ZONE_START, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { act, cleanPick, join, newRoom, relay, viewFor } from '../src/games/sigilfall/net/ringRoom';
import { setupFromRoom } from '../src/games/sigilfall/ui/RingScreen';

const STEP = 1 / 30;
const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar });

/** A match with its gates already open, on open ground unless told otherwise. */
function duel(a: ClassId, abar: string[], b: ClassId, bbar: string[] = PRESETS[b][0]!.bar, map = 'sands'): Match {
  const m = new Match({ seed: 5, map, fighters: [fighter(0, a, abar), fighter(1, b, bbar)] });
  m.step(GATES + 0.01, {});
  // a clear line down the middle of the ground (between the sands' pillars), in reach of everything
  const [x, y] = [m.fighters[0]!, m.fighters[1]!];
  x.x = 200;
  x.y = 125;
  y.x = 225;
  y.y = 125;
  x.target = y.id;
  y.target = x.id;
  return m;
}
const wait = (m: Match, seconds: number, moves: Record<number, MoveInput> = {}): void => {
  for (let i = 0; i < seconds / STEP; i++) m.step(STEP, moves);
};

describe('The Ring: the rules', () => {
  it('nobody acts until the gates open', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    expect(m.press(0, 'w-hew')).toMatch(/gates/i);
    m.step(GATES + 0.01, {});
    expect(m.phase).toBe('fight');
  });

  it('a pillar blocks line of sight, and so a spell can’t start or finish through it', () => {
    const m = duel('mage', ['m-lash', 'm-burn'], 'warrior');
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    const p = m.pillars[0]!;
    me.x = p.x - 30;
    me.y = p.y + p.h / 2;
    foe.x = p.x + p.w + 30;
    foe.y = p.y + p.h / 2;
    expect(m.press(0, 'm-lash')).toBe('Out of sight');
    // they step into the clear, the cast starts, and they walk back behind the stone
    foe.y = p.y + p.h + 46;
    expect(m.press(0, 'm-lash')).toBeNull();
    expect(me.cast).toBeTruthy();
    foe.y = p.y + p.h / 2;
    wait(m, 2);
    expect(me.cast).toBeNull();
    expect(foe.hp).toBe(foe.maxHp);
    expect(me.mana).toBe(me.maxMana);
  });

  it('clearLine is right about the corners', () => {
    const p = [{ x: 100, y: 100, w: 20, h: 20 }];
    expect(clearLine(p, 90, 110, 130, 110)).toBe(false);
    expect(clearLine(p, 90, 90, 130, 90)).toBe(true);
    expect(clearLine(p, 90, 90, 130, 130)).toBe(false);
    expect(clearLine(p, 110, 90, 110, 130)).toBe(false);
    expect(clearLine(p, 95, 95, 95, 130)).toBe(true);
  });

  it('a cast goes on while you move, only slower on your feet, and one can be started on the move', () => {
    const m = duel('mage', ['m-lash'], 'warrior');
    const me = m.fighters[0]!;
    m.press(0, 'm-lash');
    wait(m, 0.3);
    const x = me.x;
    wait(m, 0.4, { 0: { mx: -1, my: 0 } });
    expect(me.cast?.ab).toBe('m-lash');
    expect(x - me.x).toBeGreaterThan(BASE_SPEED * 0.4 * CAST_SLOW * 0.8);
    expect(x - me.x).toBeLessThan(BASE_SPEED * 0.4 * CAST_SLOW * 1.2);
    wait(m, 1, { 0: { mx: -1, my: 0 } });
    expect(me.cast).toBeNull();
    expect(m.fighters[1]!.hp).toBeLessThan(m.fighters[1]!.maxHp);
    me.gcd = 0;
    expect(m.press(0, 'm-lash')).toBeNull();
  });

  it('pressing a cast again doesn’t restart it', () => {
    const m = duel('mage', ['m-lash'], 'warrior');
    const me = m.fighters[0]!;
    m.press(0, 'm-lash');
    wait(m, 0.6);
    const t = me.cast!.t;
    expect(m.press(0, 'm-lash')).toBe('Already casting');
    expect(me.cast!.t).toBe(t);
  });

  it('another ability pressed mid-cast doesn’t cut the cast short: it waits, and goes off as the cast lands if pressed at the end', () => {
    const m = duel('mage', ['m-lash', 'm-burn'], 'warrior');
    const me = m.fighters[0]!;
    m.press(0, 'm-lash');
    wait(m, 0.4);
    expect(m.press(0, 'm-burn')).toBe('Casting');
    expect(me.cast?.ab).toBe('m-lash');
    wait(m, 0.5);
    // (0.2s left: queued)
    expect(m.press(0, 'm-burn')).toBeNull();
    expect(me.cast?.ab).toBe('m-lash');
    wait(m, 0.5);
    expect(me.cast).toBeNull();
    expect(me.cds['m-burn']).toBeGreaterThan(0);
  });

  it('the global cooldown holds, a press near its end is queued, and free abilities ignore it', () => {
    const m = duel('warrior', ['w-hew', 'w-hamstring', 'w-stand'], 'mage');
    const me = m.fighters[0]!;
    const foe = m.fighters[1]!;
    expect(m.press(0, 'w-hew')).toBeNull();
    expect(me.gcd).toBeGreaterThan(0.7);
    expect(m.press(0, 'w-hamstring')).toBe('Not ready yet');
    expect(m.press(0, 'w-stand')).toBeNull();
    wait(m, 0.5);
    expect(m.press(0, 'w-hamstring')).toBeNull();
    expect(me.queued?.ab).toBe('w-hamstring');
    wait(m, 0.3);
    expect(foe.auras.some((a) => a.kind === 'slow')).toBe(true);
  });

  it('an interrupt stops a cast and locks that school, not the others', () => {
    const m = duel('warrior', ['w-crack'], 'mage', ['m-lash', 'm-spear', 'm-snap']);
    const foe = m.fighters[1]!;
    m.press(1, 'm-lash');
    wait(m, 0.5);
    expect(m.press(0, 'w-crack')).toBeNull();
    expect(foe.cast).toBeNull();
    expect(m.press(1, 'm-lash')).toMatch(/Fire is locked/);
    expect(foe.locks.fire).toBeGreaterThan(3);
    foe.gcd = 0;
    expect(m.press(1, 'm-spear')).toBeNull();
    expect(m.fighters[0]!.score.kicks).toBe(1);
  });

  it('crowd control wears off harder each time, then not at all, and the slate wipes clean with time', () => {
    const m = duel('druid', ['l-bash'], 'warrior');
    const foe = m.fighters[1]!;
    const stun = (): number => {
      m.fighters[0]!.cds = {};
      m.fighters[0]!.gcd = 0;
      foe.auras = [];
      m.press(0, 'l-bash');
      return foe.auras.find((a) => a.cc === 'stun')?.t ?? 0;
    };
    // (holds are short in a brawl: a stun is a second and a half at most)
    expect(stun()).toBeCloseTo(1.5);
    expect(stun()).toBeCloseTo(0.75);
    expect(stun()).toBeCloseTo(0.375);
    expect(stun()).toBe(0);
    wait(m, 20);
    expect(stun()).toBeCloseTo(1.5);
  });

  it('a stun holds you; a daze breaks on any hurt; a fear and a root only on enough of it', () => {
    const m = duel('warlock', ['k-dread', 'k-bolt'], 'warrior');
    const foe = m.fighters[1]!;
    m.press(0, 'k-dread');
    wait(m, 1.6);
    expect(foe.auras.some((a) => a.cc === 'fear')).toBe(true);
    (m as unknown as { damage(s: unknown, t: unknown, n: number, d: boolean): void }).damage(m.fighters[0], foe, 10, false);
    expect(foe.auras.some((a) => a.cc === 'fear')).toBe(true);
    (m as unknown as { damage(s: unknown, t: unknown, n: number, d: boolean): void }).damage(m.fighters[0], foe, foe.maxHp * 0.2, false);
    expect(foe.auras.some((a) => a.cc === 'fear')).toBe(false);

    const n = duel('mage', ['m-toad'], 'warrior');
    n.press(0, 'm-toad');
    wait(n, 1.1);
    const held = n.fighters[1]!;
    expect(held.auras.some((a) => a.cc === 'incap')).toBe(true);
    expect(n.press(1, 'w-hew')).toBe('You can’t do that now');
    (n as unknown as { damage(s: unknown, t: unknown, n: number, d: boolean): void }).damage(n.fighters[0], held, 1, false);
    expect(held.auras.some((a) => a.cc === 'incap')).toBe(false);
  });

  it('feared heroes run, and rooted ones stay put', () => {
    const m = duel('warlock', ['k-howl'], 'warrior');
    const foe = m.fighters[1]!;
    const { x, y } = foe;
    m.press(0, 'k-howl');
    wait(m, 2);
    // running blind, turning now and then, with nobody at the wheel
    expect(foe.walk).toBeGreaterThan(1.5);
    expect(Math.hypot(foe.x - x, foe.y - y)).toBeGreaterThan(0);

    const n = duel('mage', ['m-ring'], 'warrior');
    const held = n.fighters[1]!;
    const at = held.x;
    n.press(0, 'm-ring');
    wait(n, 1, { 1: { mx: 1, my: 0 } });
    expect(held.x).toBe(at);
  });

  it('a hold is short and lifts by itself, and what can be used while held still can', () => {
    const m = duel('mage', ['m-chill'], 'warrior', ['w-hew', 'w-stand']);
    const foe = m.fighters[1]!;
    m.press(0, 'm-chill');
    wait(m, 0.15);
    expect(m.held(foe)).toBeTruthy();
    expect(m.press(1, 'w-hew')).toBe('You can’t do that now');
    expect(m.press(1, DASH.id)).toBe('You can’t do that now');
    expect(m.press(1, 'w-stand')).toBeNull();
    // (no Token any more: holds are short enough to wait out)
    expect(m.press(1, 'token')).toMatch(/don’t have/);
    wait(m, 1.5);
    expect(m.held(foe)).toBeUndefined();
  });

  it('a dispel takes a hold off a friend, a blessing off an enemy, and a barbed curse bites whoever takes it', () => {
    const m = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, 'priest', ['p-cleanse', 'p-tear', 'p-ward']), fighter(0, 'warrior'), fighter(1, 'warlock', ['k-unstable', 'k-dread', 'k-pact']), fighter(1, 'mage', ['m-chill'])] });
    m.step(GATES + 0.01, {});
    const [priest, warrior, lock, mage] = m.fighters as [typeof m.fighters[0], typeof m.fighters[0], typeof m.fighters[0], typeof m.fighters[0]];
    for (const [i, f] of m.fighters.entries()) {
      f.x = 200 + i * 10;
      f.y = 125;
    }
    priest.friend = warrior.id;
    mage.target = warrior.id;
    m.press(mage.id, 'm-chill');
    wait(m, 0.15);
    expect(m.held(warrior)).toBeTruthy();
    expect(m.press(priest.id, 'p-cleanse')).toBeNull();
    expect(m.held(warrior)).toBeUndefined();

    lock.gcd = 0;
    m.press(lock.id, 'k-pact');
    expect(lock.auras.some((a) => a.kind === 'absorb')).toBe(true);
    priest.target = lock.id;
    priest.gcd = 0;
    expect(m.press(priest.id, 'p-tear')).toBeNull();
    expect(lock.auras.some((a) => a.kind === 'absorb')).toBe(false);

    // the barbed curse, on the priest's friend
    lock.target = warrior.id;
    lock.gcd = 0;
    m.press(lock.id, 'k-unstable');
    wait(m, 1.3);
    expect(warrior.auras.some((a) => a.ab === 'k-unstable')).toBe(true);
    priest.cds = {};
    priest.gcd = 0;
    expect(m.press(priest.id, 'p-cleanse')).toBeNull();
    expect(m.silenced(priest)).toBe(true);
    expect(m.press(priest.id, 'p-ward')).toBe('Silenced');
  });

  it('a mirror sends a spell back, once; a blow still lands', () => {
    const m = duel('warrior', ['w-ward'], 'mage', ['m-burn', 'm-lash']);
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    m.press(0, 'w-ward');
    expect(m.press(1, 'm-burn')).toBeNull();
    wait(m, 0.2);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(me.hp).toBe(me.maxHp);
    expect(me.auras.some((a) => a.kind === 'reflect')).toBe(false);
  });

  it('immunity stops harm; a full one lets you act, an ice prison doesn’t; a shield against blows lets spells through', () => {
    const m = duel('mage', ['m-prison', 'm-burn'], 'warrior');
    const [me] = [m.fighters[0]!];
    m.press(0, 'm-prison');
    expect(m.press(0, 'm-burn')).toBe('Sealed in ice');
    m.press(1, 'w-hew');
    expect(me.hp).toBe(me.maxHp);

    const n = duel('ranger', ['r-deter'], 'mage', ['m-burn']);
    n.press(0, 'r-deter');
    n.press(1, 'm-burn');
    wait(n, 0.2);
    expect(n.fighters[0]!.hp).toBeLessThan(n.fighters[0]!.maxHp);
  });

  it('a heal fades with the match: dampening starts late and grows, and a deep wound halves it again', () => {
    const m = duel('priest', ['p-mend'], 'warrior');
    expect(m.dampening).toBe(0);
    m.clock = 30;
    expect(m.dampening).toBe(0);
    m.clock = 70;
    expect(m.dampening).toBeGreaterThan(0.25);
    m.clock = MATCH_LIMIT;
    expect(m.dampening).toBeCloseTo(0.75);
  });

  it('a trap waits for the first enemy across it, and not a friend', () => {
    const m = duel('ranger', ['r-trap'], 'warrior');
    const foe = m.fighters[1]!;
    m.press(0, 'r-trap');
    expect(m.traps).toHaveLength(1);
    foe.x = m.traps[0]!.x + 60;
    wait(m, 1.1);
    foe.x = m.traps[0]!.x;
    foe.y = m.traps[0]!.y;
    wait(m, 0.1);
    expect(m.traps).toHaveLength(0);
    expect(m.held(foe)?.cc).toBe('incap');
  });

  it('a rush takes you to them, a flicker past a pillar stops short of being inside it', () => {
    const m = duel('warrior', ['w-rush'], 'mage');
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    me.x = 60;
    me.y = 125;
    foe.x = 200;
    foe.y = 125;
    expect(m.press(0, 'w-rush')).toBeNull();
    wait(m, 1);
    expect(Math.hypot(me.x - foe.x, me.y - foe.y)).toBeLessThan(30);

    const n = duel('mage', ['m-blink'], 'warrior');
    const mage = n.fighters[0]!;
    const p = n.pillars[0]!;
    mage.x = p.x - 40;
    mage.y = p.y + p.h / 2;
    mage.dirX = 1;
    mage.dirY = 0;
    n.press(0, 'm-blink');
    const inside = mage.x > p.x - HERO_R && mage.x < p.x + p.w + HERO_R && mage.y > p.y - HERO_R && mage.y < p.y + p.h + HERO_R;
    expect(inside).toBe(false);
  });

  it('a team with no one standing loses, and when the clock runs out the livelier team wins', () => {
    const m = duel('warrior', ['w-hew'], 'mage');
    m.fighters[1]!.hp = 1;
    m.press(0, 'w-hew');
    wait(m, 0.1);
    expect(m.phase).toBe('over');
    expect(m.winner).toBe(0);

    const n = duel('warrior', ['w-hew'], 'mage');
    n.fighters[0]!.hp = n.fighters[0]!.maxHp / 2;
    n.clock = MATCH_LIMIT - 0.01;
    wait(n, 0.1);
    expect(n.phase).toBe('over');
    expect(n.winner).toBe(1);
  });

  it('a frame stamped before its time does no harm', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    m.step(-0.1, {});
    m.step(Number.NaN, {});
    expect(m.t).toBe(0);
  });

  it('nothing lets a player use what isn’t on their bar', () => {
    const m = duel('warrior', ['w-hew'], 'mage');
    expect(m.press(0, 'w-gash')).toMatch(/don’t have/);
    expect(m.press(0, 'm-lash')).toMatch(/don’t have/);
    expect(m.press(0, 'nonsense')).toMatch(/don’t have/);
    expect(m.press(99, 'w-hew')).toMatch(/don’t have/);
  });
});

describe('The Ring: the entries and the wait', () => {
  it('thirty seconds in the entry, walking but not fighting, behind a gate nothing crosses', () => {
    expect(GATES).toBe(30);
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    expect(me.x).toBeLessThan(ENTRY_W);
    expect(foe.x).toBeGreaterThan(ARENA_W - ENTRY_W);
    const y = me.y;
    wait(m, 3, { 0: { mx: 0, my: -1 } });
    expect(me.y).toBeLessThan(y);
    wait(m, 20, { 0: { mx: 1, my: 0 } });
    expect(m.phase).toBe('gates');
    expect(me.x).toBeLessThan(ENTRY_W);
    expect(m.press(0, 'w-hew')).toMatch(/gates/i);
    wait(m, 7.1, { 0: { mx: 1, my: 0 } });
    expect(m.phase).toBe('fight');
    wait(m, 2, { 0: { mx: 1, my: 0 } });
    expect(me.x).toBeGreaterThan(ENTRY_W);
  });

  it('Ready lifts the gates in a moment', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    m.openSoon();
    wait(m, 3.1);
    expect(m.phase).toBe('fight');
  });

  it('a set up can change until the gates lift, and not after', () => {
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    const me = m.fighters[0]!;
    const base = me.maxHp;
    const next = PRESETS.warrior[1]!;
    expect(m.equip(0, { bar: next.bar, oath: 'iron', talents: ['w-3a'] })).toBe(true);
    expect(me.bar).toEqual(next.bar);
    expect(me.maxHp).toBeGreaterThan(base);
    expect(me.hp).toBe(me.maxHp);
    // nothing that isn't a full bar of their own
    expect(m.equip(0, { bar: ['m-lash'] })).toBe(false);
    expect(m.equip(0, { bar: [next.bar[0]!, next.bar[0]!, ...next.bar.slice(1, 3)] })).toBe(false);
    m.step(GATES + 0.01, {});
    expect(m.equip(0, { bar: PRESETS.warrior[0]!.bar })).toBe(false);
    expect(me.bar).toEqual(next.bar);
  });

  it('every ground’s entries open onto the fight', () => {
    for (const map of MAP_IDS) {
      const m = new Match({ seed: 2, map, fighters: [fighter(0, 'warrior'), fighter(1, 'warrior')] });
      expect(m.sees(m.fighters[0]!, m.fighters[1]!)).toBe(false);
      m.step(GATES + 0.01, {});
      const [a, b] = [m.fighters[0]!, m.fighters[1]!];
      a.x = 60;
      b.x = ARENA_W - 60;
      for (let i = 0; i < 30 * 12 && Math.hypot(a.x - b.x, a.y - b.y) > 200; i++) m.step(STEP, { 0: { mx: 1, my: 0 } });
      expect(a.x, map).toBeGreaterThan(60);
    }
  });
});

describe('The Ring: talents and set ups', () => {
  it('every class has three rows of three, each with something to choose between', () => {
    for (const cls of CLASS_IDS) {
      expect(TALENTS[cls], cls).toHaveLength(ROW_NAMES.length * 3);
      for (const row of [0, 1, 2]) expect(TALENTS[cls].filter((t) => t.row === row)).toHaveLength(3);
      for (const t of TALENTS[cls]) {
        expect(t.tune || t.hp || t.tenacity || t.regen || t.dmg || t.heal || t.speed, t.id).toBeTruthy();
        for (const id of Object.keys(t.tune ?? {})) {
          expect(ABILITIES[id]?.cls, `${t.id} sharpens ${id}`).toBe(cls);
          // the talent speaks of the ability it changes
          expect(t.text, t.id).toContain(ABILITIES[id]!.name);
        }
      }
      expect(new Set(TALENTS[cls].map((t) => t.name)).size).toBe(9);
    }
  });

  it('only one from a row counts, and only a class’s own', () => {
    expect(cleanTalents('warrior', ['w-1a', 'w-1b', 'w-2a', 'm-1a', 'junk']).map((t) => t.id)).toEqual(['w-1a', 'w-2a']);
    expect(cleanTalents('warrior', undefined)).toEqual([]);
  });

  it('a talent changes the numbers: harder hits, quicker casts, shorter clocks, longer holds', () => {
    const hit = (talents: string[]): number => {
      const m = new Match({ seed: 11, map: 'sands', fighters: [{ ...fighter(0, 'warrior', ['w-hew']), talents }, fighter(1, 'paladin')] });
      m.step(GATES + 0.01, {});
      const [a, b] = [m.fighters[0]!, m.fighters[1]!];
      a.x = 200;
      a.y = 125;
      b.x = 215;
      b.y = 125;
      const before = b.hp;
      m.press(0, 'w-hew');
      return before - b.hp;
    };
    expect(hit(['w-1a'])).toBeGreaterThan(hit([]) * 1.2);

    const m = new Match({ seed: 1, map: 'sands', fighters: [{ ...fighter(0, 'mage', ['m-lash', 'm-blink', 'm-snap', 'm-burn']), talents: ['m-1a', 'm-2c', 'm-3b'] }, fighter(1, 'warrior')] });
    m.step(GATES + 0.01, {});
    const [a, b] = [m.fighters[0]!, m.fighters[1]!];
    a.x = 200;
    a.y = 125;
    b.x = 225;
    b.y = 125;
    m.press(0, 'm-lash');
    expect(a.cast!.dur).toBeCloseTo(ABILITIES['m-lash']!.cast * (1.5 / 1.8));
    m.press(0, 'm-blink');
    expect(a.cds['m-blink']).toBeCloseTo(ABILITIES['m-blink']!.cd * 0.625);
    m.press(0, 'm-snap');
    expect(a.cds['m-snap']).toBeCloseTo(ABILITIES['m-snap']!.cd * 0.7);

    const n = new Match({ seed: 1, map: 'sands', fighters: [{ ...fighter(0, 'ranger', PRESETS.ranger[0]!.bar), talents: ['r-2b'] }, fighter(1, 'warrior')] });
    n.step(GATES + 0.01, {});
    n.fighters[0]!.x = 200;
    n.fighters[0]!.y = 125;
    n.fighters[1]!.x = 240;
    n.fighters[1]!.y = 125;
    n.press(0, 'r-hawk');
    wait(n, 0.3);
    expect(n.held(n.fighters[1]!)!.t).toBeGreaterThan(1.6);
  });

  it('every ready-made build names real talents, one a row', () => {
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) expect(cleanTalents(cls, p.talents).map((t) => t.id), `${cls} ${p.name}`).toEqual(p.talents);
    }
  });

  it('three set ups a class, starting from the ready-made ones, and a broken save falls back', () => {
    const empty = { standings: {}, sets: {} };
    const s = setsOf(empty, 'mage');
    expect(s.list).toHaveLength(SET_COUNT);
    expect(s.active).toBe(0);
    expect(s.list[1]!.bar).toEqual(PRESETS.mage[1]!.bar);
    const broken = setsOf({ standings: {}, sets: { mage: { active: 9, list: [{ bar: 'x' }] as never } } }, 'mage');
    expect(broken.active).toBe(0);
    expect(broken.list[0]!.bar).toEqual(PRESETS.mage[0]!.bar);
  });
});

describe('The Ring: the kits', () => {
  it('every class has twelve to choose from, with a way to hit, a hold, an escape or defense, and its bars are real', () => {
    for (const cls of CLASS_IDS) {
      const kit = kitOf(cls);
      expect(kit, cls).toHaveLength(12);
      const roles = new Set(kit.map((a) => a.role));
      for (const r of ['damage', 'cc', 'interrupt', 'defense'] as const) expect(roles.has(r), `${cls} has ${r}`).toBe(true);
      expect(new Set(kit.map((a) => a.name)).size, `${cls} names`).toBe(12);
      for (const p of PRESETS[cls]) {
        expect(p.bar, `${cls} ${p.name}`).toHaveLength(SLOTS);
        expect(new Set(p.bar).size).toBe(SLOTS);
        for (const id of p.bar) expect(ABILITIES[id]?.cls, id).toBe(cls);
      }
    }
    expect(OATHS.length).toBeGreaterThanOrEqual(5);
  });

  it('every class can kill with what it has, and three can heal for real', () => {
    const healers = CLASS_IDS.filter((c) => kitOf(c).filter((a) => a.role === 'heal' && a.aim === 'friend').length >= 2);
    expect(healers.sort()).toEqual(['druid', 'paladin', 'priest']);
  });

  it('the names are ours (RENAMES.md, LEGAL_REVIEW.md)', () => {
    const banned = /\b(blink|polymorph|counterspell|ice block|hammer of justice|divine shield|blessing of|psychic scream|power word|pain suppression|kidney shot|cheap shot|cyclone|barkskin|moonfire|wrath|rejuvenation|regrowth|shadow bolt|chaos bolt|unstable affliction|howl of terror|death coil|mortal strike|charge|intercept|pummel|spell reflection|bladestorm|deterrence|aimed shot|freezing trap|scatter shot|disengage|gladiator|duelist|rival|challenger|combatant|hearthstone)\b/i;
    for (const a of Object.values(ABILITIES)) expect(a.name, a.id).not.toMatch(banned);
    for (const r of RANKS) expect(r.name).not.toMatch(banned);
  });

  it('every ability’s icon is in the atlas', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/games/sigilfall/icons/icons.json'), 'utf8')) as { names: string[] };
    for (const a of Object.values(ABILITIES)) expect(index.names, a.id).toContain(a.icon);
    expect(index.names).toContain(DASH.icon);
  });

  it('a spell’s text matches its numbers', () => {
    for (const a of Object.values(ABILITIES)) {
      for (const e of a.effects) {
        if (e.k === 'dot' || e.k === 'hot') {
          const said = a.text.match(/(\d+) (more )?over/);
          // (what is said is what lands: those who fight from range deal a tenth less than their numbers)
          const lands = e.k === 'dot' && a.cls !== 'any' && RANGED.has(a.cls) ? Math.round(e.n * RANGED_DMG) : e.n;
          if (said) expect(Number(said[1]), a.id).toBe(lands);
        }
        if (e.k === 'absorb') {
          const said = a.text.match(/(\d+) damage/);
          if (said) expect(Number(said[1]), a.id).toBe(e.n);
        }
      }
    }
  });

  it('every ground has somewhere to stand and fights on it stay inside', () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id]!;
      expect(map.pillars.length).toBeGreaterThanOrEqual(3);
      for (const team of map.spawns) {
        for (const [x, y] of team) {
          expect(x > 0 && x < ARENA_W && y > 0 && y < ARENA_H).toBe(true);
          expect(map.pillars.some((p) => x > p.x - HERO_R && x < p.x + p.w + HERO_R && y > p.y - HERO_R && y < p.y + p.h + HERO_R), `${id} spawn`).toBe(false);
        }
      }
    }
  });
});

function play(setup: FighterSetup[], seed: number, map: string, skill = 0.7): Match {
  const m = new Match({ seed, map, fighters: setup });
  const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
  for (let i = 0; i < 30 * 340 && m.phase !== 'over'; i++) {
    const moves: Record<number, MoveInput> = {};
    for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, skill, STEP);
    m.step(STEP, moves);
    m.events.length = 0;
  }
  return m;
}

describe('The Ring: computer players', () => {
  it('every class fights every other on every ground, to a finish, with nothing going wrong', () => {
    let spent = 0;
    let n = 0;
    for (const a of CLASS_IDS) {
      for (const b of CLASS_IDS) {
        if (a === b) continue;
        const m = play([fighter(0, a), fighter(1, b)], a.length * b.length, MAP_IDS[(a.length + b.length) % 3]!);
        expect(m.phase, `${a} v ${b}`).toBe('over');
        for (const f of m.fighters) {
          expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.hp), `${a} v ${b}: ${f.cls}`).toBe(true);
          expect(f.x >= 0 && f.x <= ARENA_W && f.y >= 0 && f.y <= ARENA_H, `${f.cls} inside`).toBe(true);
          expect(f.score.dmg + f.score.heal, `${a} v ${b}: ${f.cls} did something`).toBeGreaterThan(0);
        }
        spent += m.clock;
        n++;
      }
    }
    // short enough to want another (a brawl, not a siege), long enough for something to happen
    expect(spent / n).toBeGreaterThan(25);
    expect(spent / n).toBeLessThan(85);
  }, 120_000);

  it('a melee fighter reaches their target past the stone on every ground', () => {
    for (const map of MAP_IDS) {
      const m = new Match({ seed: 4, map, fighters: [fighter(0, 'warrior'), { ...fighter(1, 'ranger'), bar: ['r-swift'] }] });
      const brains = [newBrain(1), newBrain(2)];
      let reached = false;
      for (let i = 0; i < 30 * 75 && !reached; i++) {
        m.step(STEP, { 0: botThink(m, m.fighters[0]!, brains[0]!, 0.7, STEP) });
        reached = m.phase === 'fight' && Math.hypot(m.fighters[0]!.x - m.fighters[1]!.x, m.fighters[0]!.y - m.fighters[1]!.y) < 30;
        m.fighters[0]!.cds = {};
        m.fighters[1]!.hp = m.fighters[1]!.maxHp;
      }
      expect(reached, map).toBe(true);
    }
  }, 30_000);

  it('a healed team outlasts one without, more often than not, and nobody is a free win', () => {
    const wins: Record<string, number> = {};
    const games: Record<string, number> = {};
    for (const a of CLASS_IDS) {
      for (const b of CLASS_IDS) {
        if (a >= b) continue;
        for (const seed of [1, 2, 3, 4]) {
          const pa = PRESETS[a].find((p) => !isHeal(p.bar)) ?? PRESETS[a][0]!;
          const pb = PRESETS[b].find((p) => !isHeal(p.bar)) ?? PRESETS[b][0]!;
          const m = play([fighter(0, a, pa.bar), fighter(1, b, pb.bar)], seed, MAP_IDS[seed % 3]!);
          games[a] = (games[a] ?? 0) + 1;
          games[b] = (games[b] ?? 0) + 1;
          if (m.winner === 0) wins[a] = (wins[a] ?? 0) + 1;
          if (m.winner === 1) wins[b] = (wins[b] ?? 0) + 1;
        }
      }
    }
    // the bots aren't people, so this is a guard against something broken, not a statement of balance
    for (const c of CLASS_IDS) {
      const share = (wins[c] ?? 0) / games[c]!;
      expect(share, `${c} wins ${Math.round(share * 100)}%`).toBeGreaterThan(0.1);
      expect(share, `${c} wins ${Math.round(share * 100)}%`).toBeLessThan(0.92);
    }
  }, 120_000);

  it('a sharp opponent beats a dull one', () => {
    let sharp = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: [fighter(0, 'mage', PRESETS.mage[1]!.bar), fighter(1, 'mage', PRESETS.mage[1]!.bar)] });
      const brains = [newBrain(seed * 3), newBrain(seed * 5)];
      for (let i = 0; i < 30 * 340 && m.phase !== 'over'; i++) {
        m.step(STEP, { 0: botThink(m, m.fighters[0]!, brains[0]!, 0.95, STEP), 1: botThink(m, m.fighters[1]!, brains[1]!, 0.12, STEP) });
      }
      if (m.winner === 0) sharp++;
    }
    expect(sharp).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it('three a side finish, and a frame of bots stays cheap', () => {
    for (const comp of COMPS[3]) {
      const m = play([...COMPS[3][0]!.team.map((t) => fighter(0, t.cls, PRESETS[t.cls][t.preset]!.bar)), ...comp.team.map((t) => fighter(1, t.cls, PRESETS[t.cls][t.preset]!.bar))], 7, 'forge');
      expect(m.phase).toBe('over');
    }
    const m = new Match({ seed: 9, map: 'frost', fighters: [...COMPS[3][1]!.team.map((t) => fighter(0, t.cls, PRESETS[t.cls][t.preset]!.bar)), ...COMPS[3][2]!.team.map((t) => fighter(1, t.cls, PRESETS[t.cls][t.preset]!.bar))] });
    const brains = m.fighters.map((_, i) => newBrain(i + 1));
    const t0 = performance.now();
    m.step(GATES + 0.01, {});
    for (let i = 0; i < 600 && m.phase !== 'over'; i++) {
      const moves: Record<number, MoveInput> = {};
      for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.9, STEP);
      m.step(STEP, moves);
      m.events.length = 0;
    }
    expect((performance.now() - t0) / 600).toBeLessThan(2);
  }, 60_000);
});

const isHeal = (bar: string[]): boolean => bar.filter((b) => ABILITIES[b]?.role === 'heal').length >= 2;

describe('The Ring: the ladder', () => {
  it('a win against equals is worth what a loss costs, and upsets are worth more', () => {
    expect(ratingChange(1000, 1000, true)).toBe(16);
    expect(ratingChange(1000, 1000, false)).toBe(-16);
    expect(ratingChange(1000, 1400, true)).toBeGreaterThan(25);
    expect(ratingChange(1400, 1000, true)).toBeLessThan(6);
  });

  it('ranks are kept once earned, the floor holds, and the record adds up', () => {
    let s = { ...NEW_STANDING, rating: 1145, best: 1145 };
    const up = afterMatch(s, 1145, true);
    expect(up.rankUp).toBe('Blooded');
    s = up.next;
    const down = afterMatch(s, s.rating, false);
    expect(down.rankUp).toBeNull();
    expect(rankOf(down.next.best).name).toBe('Blooded');
    expect(down.next.wins).toBe(1);
    expect(down.next.losses).toBe(1);
    let low = { ...NEW_STANDING, rating: 801 };
    for (let i = 0; i < 20; i++) low = afterMatch(low, low.rating, false).next;
    expect(low.rating).toBe(800);
    expect(low.streak).toBe(-20);
    expect(nextRank(99999)).toBeNull();
  });

  it('the ladder gets harder as you climb', () => {
    expect(skillAt(800)).toBeLessThan(skillAt(1200));
    expect(skillAt(1200)).toBeLessThan(skillAt(1800));
    expect(skillAt(3000)).toBe(1);
  });

  it('every format draws a full team of real bars', () => {
    for (const f of [1, 2, 3] as const) {
      for (let seed = 0; seed < 8; seed++) {
        const { fighters } = drawOpponents(f, seed);
        expect(fighters).toHaveLength(f);
        for (const x of fighters) {
          expect(x.team).toBe(1);
          expect(x.bar).toHaveLength(SLOTS);
        }
      }
    }
  });
});

describe('The Ring: over a room', () => {
  const KEYS = ['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccc'];
  const pick = (team: 0 | 1, cls: ClassId = 'warrior'): { team: 0 | 1; cls: string; bar: string[]; oath: string; talents: string[] } => ({ team, cls, bar: PRESETS[cls][0]!.bar, oath: 'iron', talents: PRESETS[cls][0]!.talents });
  const room = () => {
    const s = newRoom('ABCD', 0, 42);
    for (const [i, k] of KEYS.entries()) expect(join(s, k, `P${i}`, 0)).toBeNull();
    return s;
  };

  it('seats, sides and the host’s word', () => {
    const s = room();
    expect(act(s, KEYS[0]!, { t: 'setup', format: 1, map: 'frost' }, 1)).toBeNull();
    expect(s.format).toBe(1);
    expect(act(s, KEYS[1]!, { t: 'setup', format: 3, map: 'sands' }, 1)).toBe('not_host');
    expect(act(s, KEYS[0]!, { t: 'pick', pick: pick(0) }, 1)).toBeNull();
    // that side is full at 1v1
    expect(act(s, KEYS[1]!, { t: 'pick', pick: pick(0) }, 1)).toBe('team_full');
    expect(act(s, KEYS[1]!, { t: 'pick', pick: pick(1) }, 1)).toBeNull();
    expect(act(s, KEYS[1]!, { t: 'start' }, 1)).toBe('not_host');
    expect(act(s, KEYS[0]!, { t: 'start' }, 1)).toBeNull();
    expect(s.phase).toBe('run');
    expect(act(s, KEYS[1]!, { t: 'pick', pick: pick(1, 'mage') }, 1)).toBe('not_lobby');
    expect(act(s, KEYS[0]!, { t: 'end' }, 1)).toBeNull();
    expect(s.phase).toBe('lobby');
  });

  it('shrinking the format takes the extra ones off their side', () => {
    const s = room();
    act(s, KEYS[0]!, { t: 'setup', format: 2, map: 'sands' }, 1);
    act(s, KEYS[0]!, { t: 'pick', pick: pick(0) }, 1);
    act(s, KEYS[1]!, { t: 'pick', pick: pick(0) }, 1);
    act(s, KEYS[0]!, { t: 'setup', format: 1, map: 'sands' }, 1);
    expect(Object.values(s.picks).filter((p) => p.team === 0)).toHaveLength(1);
  });

  it('a bad pick is turned away', () => {
    expect(cleanPick(null)).toBeNull();
    expect(cleanPick({ team: 2, cls: 'mage', bar: [], oath: 'iron' })).toBeNull();
    expect(cleanPick({ team: 0, cls: 'mage<script>', bar: [], oath: 'iron' })).toBeNull();
    expect(cleanPick({ team: 0, cls: 'mage', bar: Array(7).fill('m-lash'), oath: 'iron' })).toBeNull();
    expect(cleanPick({ team: 0, cls: 'mage', bar: [1], oath: 'iron' })).toBeNull();
    expect(cleanPick(pick(0, 'mage'))).toBeTruthy();
  });

  it('relay passes the fight on only during a match, and stores nothing', () => {
    const s = room();
    expect(relay(s, KEYS[0]!, { t: 'r', d: 1 })?.others).toBeUndefined();
    act(s, KEYS[0]!, { t: 'pick', pick: pick(0) }, 1);
    act(s, KEYS[0]!, { t: 'start' }, 1);
    const r = relay(s, KEYS[1]!, { t: 'r', d: { p: 'x' } });
    expect(r?.save).toBe(false);
    expect((r?.others as { d: unknown }).d).toEqual({ p: 'x' });
    expect(relay(s, KEYS[0]!, { t: 'start' })).toBeNull();
  });

  it('both ends build the same match, the computer fills the gaps, and rubbish becomes something valid', () => {
    const s = room();
    act(s, KEYS[0]!, { t: 'setup', format: 3, map: 'forge' }, 1);
    act(s, KEYS[0]!, { t: 'pick', pick: pick(0, 'mage') }, 1);
    act(s, KEYS[1]!, { t: 'pick', pick: { team: 1, cls: 'dragon', bar: ['nonsense'], oath: 'iron', talents: ['nonsense'] } }, 1);
    act(s, KEYS[0]!, { t: 'start' }, 1);
    const a = setupFromRoom(viewFor(s, KEYS[0]!)!);
    const b = setupFromRoom(viewFor(s, KEYS[1]!)!);
    expect(a.setup).toEqual(b.setup);
    expect(a.setup.fighters).toHaveLength(6);
    expect(a.mine).not.toBe(b.mine);
    expect(a.setup.fighters[a.mine]!.cls).toBe('mage');
    expect(b.setup.fighters[b.mine]!.cls).toBe('warrior');
    expect(new Match(a.setup).fighters.every((f) => f.bar.length === SLOTS)).toBe(true);
  });

  it('a player’s copy follows the host’s, and their own feet feel their own', () => {
    const setup = { seed: 8, map: 'sands', fighters: [{ ...fighter(0, 'warrior'), seat: 1 }, { ...fighter(1, 'mage', PRESETS.mage[1]!.bar), seat: 2 }] };
    const host = new Match(setup);
    const client = new Match(setup);
    const brain = newBrain(4);
    let ms = 0;
    for (let i = 0; i < 30 * 60 && host.phase !== 'over'; i++) {
      host.step(STEP, { 0: botThink(host, host.fighters[0]!, brain, 0.7, STEP), 1: { mx: 0, my: 0 } });
      client.coast(STEP, 1, { mx: 0, my: 0 });
      if (i % 3 === 0) {
        // over a real wire: all of it as text
        const wire = JSON.stringify(host.snapshot());
        ms = Math.max(ms, wire.length);
        client.restore(JSON.parse(wire), 1);
      }
    }
    client.restore(JSON.parse(JSON.stringify(host.snapshot())), 1);
    expect(client.phase).toBe(host.phase);
    expect(client.fighters[0]!.hp).toBe(host.fighters[0]!.hp);
    expect(Math.hypot(client.fighters[0]!.x - host.fighters[0]!.x, client.fighters[0]!.y - host.fighters[0]!.y)).toBeLessThan(1);
    // comfortably inside what the room's relay will pass on
    expect(ms).toBeLessThan(6000);
    // their own hero walks at once, between the host's messages, and isn't dragged back by a small disagreement
    const c = new Match(setup);
    c.phase = 'fight';
    const x0 = c.fighters[1]!.x;
    c.coast(0.1, 1, { mx: -1, my: 0 });
    expect(c.fighters[1]!.x).toBeLessThan(x0);
    const snap = new Match(setup).snapshot();
    snap.p = 'fight';
    const before = c.fighters[1]!.x;
    c.restore(snap, 1);
    expect(c.fighters[1]!.x).toBeLessThan(x0);
    expect(c.fighters[1]!.x).toBeGreaterThanOrEqual(before);
  });
});

describe('The Ring: who is who', () => {
  const bot = (team: 0 | 1, cls: ClassId, name: string): FighterSetup => ({ team, cls, name, bar: PRESETS[cls][0]!.bar });

  it('nobody in a match shares a name, and the people keep theirs', () => {
    const fighters: FighterSetup[] = [{ ...bot(0, 'mage', 'Quill'), human: true }, bot(0, 'mage', 'Quill'), bot(1, 'mage', 'Quill'), bot(1, 'priest', 'Ione'), bot(1, 'priest', 'Ione')];
    const named = namedApart(fighters);
    expect(named[0]!.name).toBe('Quill');
    expect(new Set(named.map((f) => f.name)).size).toBe(named.length);
  });

  it('every format and seed draws a team with no two the same', () => {
    for (const format of [1, 2, 3] as const) {
      for (let seed = 0; seed < 40; seed++) {
        const { fighters } = drawOpponents(format, seed);
        const named = namedApart([...fighters, ...fighters.map((f) => ({ ...f, team: 0 as const }))]);
        expect(new Set(named.map((f) => f.name)).size).toBe(named.length);
      }
    }
  });
});

describe('The Ring: combos', () => {
  it('every ready-made build has a combo among its abilities', () => {
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) expect(p.bar.some((id) => ABILITIES[id]?.combo), `${cls} ${p.name}`).toBe(true);
    }
  });

  it('a combo needs its setup: Flashburn on a Kindled target lands harder and uses the Kindling up', () => {
    const plain = duel('mage', ['m-burn'], 'warrior');
    const hp0 = plain.fighters[1]!.hp;
    plain.press(0, 'm-burn');
    wait(plain, 0.6);
    const hitPlain = hp0 - plain.fighters[1]!.hp;

    const m = duel('mage', ['m-burn'], 'warrior');
    const foe = m.fighters[1]!;
    // (as if an Ember Lash had landed: Kindled)
    foe.auras.push({ ab: 'm-lash', kind: 'dot', src: 0, t: 6, dur: 6, harmful: true, magic: true, n: 0, next: 99 });
    const hp1 = foe.hp;
    m.events.length = 0;
    m.press(0, 'm-burn');
    wait(m, 0.6);
    const hitCombo = hp1 - foe.hp;
    // (crits aside, a 1.7x hit is well clear of a plain one)
    expect(hitCombo).toBeGreaterThan(hitPlain * 1.3);
    expect(foe.auras.some((a) => a.ab === 'm-lash')).toBe(false);
    expect(m.fighters[0]!.score.combos).toBe(1);
  });

  it('a hold sets one up too: Rime Spear shatters a rooted target', () => {
    const m = duel('mage', ['m-spear'], 'warrior');
    const foe = m.fighters[1]!;
    foe.auras.push({ ab: 'm-ring', kind: 'cc', cc: 'root', src: 0, t: 5, dur: 5, harmful: true, magic: true, n: 0 });
    const seen: string[] = [];
    m.press(0, 'm-spear');
    for (let i = 0; i < 90; i++) {
      m.step(STEP, {});
      for (const e of m.events) if (e.k === 'word' && e.combo) seen.push(e.word);
    }
    expect(seen).toContain('Shatter');
  });
});

describe('The Ring: a brawl', () => {
  it('a shot flies where they were going: it lands on someone who keeps on, and misses someone who steps aside', () => {
    const shoot = (dodge: boolean): number => {
      const m = duel('mage', ['m-burn'], 'warrior');
      const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
      // (in the open between the sands' pillars, in reach)
      me.x = 150;
      foe.x = 270;
      // walking up the ground when it's thrown
      m.step(STEP, { 1: { mx: 0, my: -1 } });
      expect(m.press(0, 'm-burn')).toBeNull();
      expect(m.bolts).toHaveLength(1);
      for (let i = 0; i < 30; i++) m.step(STEP, { 1: { mx: 0, my: dodge && i > 3 ? 1 : -1 } });
      return foe.maxHp - foe.hp;
    };
    expect(shoot(false)).toBeGreaterThan(0);
    expect(shoot(true)).toBe(0);
  });

  it('a shot hits the first enemy in its way, and stone stops it', () => {
    const m = new Match({ seed: 2, map: 'sands', fighters: [fighter(0, 'mage', ['m-burn']), fighter(1, 'warrior'), fighter(1, 'ranger')] });
    m.step(GATES + 0.01, {});
    const [me, far, near] = m.fighters as [typeof m.fighters[0], typeof m.fighters[0], typeof m.fighters[0]];
    me.x = 100;
    me.y = 125;
    far.x = 220;
    far.y = 125;
    near.x = 170;
    near.y = 126;
    me.target = far.id;
    m.press(0, 'm-burn');
    wait(m, 0.6);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);

    const n = duel('mage', ['m-burn'], 'warrior');
    const p = n.pillars[0]!;
    const [a, b] = [n.fighters[0]!, n.fighters[1]!];
    a.x = p.x - 30;
    a.y = p.y + p.h / 2;
    b.x = p.x + p.w + 30;
    b.y = p.y + p.h / 2;
    // (a shot already in the air, straight at them through the stone)
    n.bolts.push({ ab: 'm-burn', src: 0, tgt: 1, x: a.x, y: a.y - 8, vx: 300, vy: 0, left: 200 });
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      n.step(STEP, {});
      for (const e of n.events) seen.push(e.k);
    }
    expect(b.hp).toBe(b.maxHp);
    expect(seen).toContain('miss');
  });

  it('a Swift Step is quick, on its own clock, off the global one, and not while rooted', () => {
    const m = duel('warrior', ['w-hew'], 'mage');
    const me = m.fighters[0]!;
    me.dirX = -1;
    me.dirY = 0;
    const x = me.x;
    m.press(0, 'w-hew');
    expect(m.press(0, DASH.id)).toBeNull();
    wait(m, 0.3);
    expect(x - me.x).toBeGreaterThan(50);
    expect(m.press(0, DASH.id)).toBe('Not ready yet');
    wait(m, DASH.cd);
    me.auras.push({ ab: 'm-ring', kind: 'cc', cc: 'root', src: 1, t: 2, dur: 2, harmful: true, magic: true, n: 0 });
    expect(m.press(0, DASH.id)).toBe('Rooted');
  });

  it('the super fills by fighting, waits for a full meter, empties when used, and isn’t refilled by its own blow', () => {
    for (const cls of CLASS_IDS) {
      expect(superOf(cls).super, cls).toBe(true);
      expect(superOf(cls).cls).toBe(cls);
    }
    expect(Object.keys(SUPERS).sort()).toEqual([...CLASS_IDS].sort());
    const m = duel('warrior', ['w-hew'], 'mage');
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    expect(m.press(0, 'w-super')).toMatch(/isn’t charged/);
    // nobody else's super, and none on a bar
    expect(m.press(0, 'm-super')).toMatch(/don’t have/);
    expect(new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior', ['w-super', 'w-hew'])] }).fighters[0]!.bar).toEqual(['w-hew']);
    m.press(0, 'w-hew');
    expect(me.charge).toBeGreaterThan(0);
    expect(foe.charge).toBeGreaterThan(0);
    expect(foe.charge).toBeLessThan(me.charge);
    me.charge = 1;
    const hp = foe.hp;
    expect(m.press(0, 'w-super')).toBeNull();
    expect(foe.hp).toBeLessThan(hp - 100);
    expect(me.charge).toBe(0);
    expect(me.score.supers).toBe(1);
    // thrown back
    wait(m, 0.3);
    expect(Math.hypot(foe.x - me.x, foe.y - me.y)).toBeGreaterThan(60);
  });

  it('a knock throws them back and cuts off what they were casting', () => {
    const m = duel('paladin', ['d-wrath'], 'mage', ['m-lash']);
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    m.press(1, 'm-lash');
    wait(m, 0.2);
    expect(foe.cast).not.toBeNull();
    const d = Math.hypot(foe.x - me.x, foe.y - me.y);
    m.press(0, 'd-wrath');
    expect(foe.cast).toBeNull();
    wait(m, 0.3);
    expect(Math.hypot(foe.x - me.x, foe.y - me.y)).toBeGreaterThan(d + 30);
  });

  it('the sigil rises in the middle, and whoever reaches it first is healed, charged and quickened', () => {
    for (const id of MAP_IDS) {
      const m = new Match({ seed: 1, map: id, fighters: [fighter(0, 'warrior')] });
      const s = m.sigilSpot();
      expect(m.pillars.some((p) => s.x > p.x - HERO_R && s.x < p.x + p.w + HERO_R && s.y > p.y - HERO_R && s.y < p.y + p.h + HERO_R), id).toBe(false);
    }
    const m = duel('warrior', ['w-hew'], 'mage');
    const me = m.fighters[0]!;
    m.fighters[1]!.x = 40;
    me.x = 60;
    wait(m, SIGIL_FIRST - 0.5);
    expect(m.sigil).toBeNull();
    wait(m, 1);
    expect(m.sigil).not.toBeNull();
    me.hp = me.maxHp / 2;
    me.x = m.sigil!.x;
    me.y = m.sigil!.y;
    wait(m, 0.1);
    expect(m.sigil).toBeNull();
    expect(me.hp).toBeGreaterThan(me.maxHp * 0.65);
    expect(me.charge).toBeGreaterThan(0.3);
    expect(me.auras.some((a) => a.kind === 'speed')).toBe(true);
  });

  it('the Gloam closes from past the corners to the middle and then to nothing, burning whoever is out in it', () => {
    const m = duel('warrior', ['w-hew'], 'mage');
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    // to begin with, the whole ground is safe, corners and entries too
    expect(m.zone).toBe(ZONE_START);
    for (const [x, y] of [[0, 0], [ARENA_W, ARENA_H], [10, ARENA_H / 2]] as const) expect(m.zoneAt(x, y)).toBeLessThan(1);
    m.clock = (CLOSE_FROM + CLOSE_TO) / 2;
    expect(m.zone).toBeLessThan(ZONE_START);
    expect(m.zone).toBeGreaterThan(ZONE_END);
    m.clock = CLOSE_TO;
    expect(m.zone).toBeCloseTo(ZONE_END);
    me.x = 30;
    me.y = 30;
    foe.x = ARENA_W / 2;
    foe.y = ARENA_H / 2;
    expect(m.inGloam(me)).toBe(true);
    expect(m.inGloam(foe)).toBe(false);
    wait(m, 2);
    expect(me.hp).toBeLessThan(me.maxHp * 0.92);
    expect(foe.hp).toBe(foe.maxHp);
    // sudden death: nowhere is safe in the end (but the very middle), so nothing lasts to the clock
    m.clock = MATCH_LIMIT - 5;
    foe.x += 8;
    expect(m.inGloam(foe)).toBe(true);
  });

  it('holds are short and cooldowns quick: nobody stands helpless or waits long', () => {
    for (const a of Object.values(ABILITIES)) {
      for (const e of a.effects) if (e.k === 'cc' || e.k === 'trap') expect(e.dur, a.id).toBeLessThanOrEqual(3);
      expect(a.cd, a.id).toBeLessThanOrEqual(45);
      expect(a.cast, a.id).toBeLessThanOrEqual(1.5);
    }
  });
});
