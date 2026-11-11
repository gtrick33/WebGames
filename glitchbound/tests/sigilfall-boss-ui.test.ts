/**
 * How a boss fight reads (the UI plan's first three steps): marks on the ground say what they ask of the hero and only
 * an attack ever strikes; a boss's mechanics are called out in one slot under its bar and no longer shouted over its
 * head; and the bar itself shows where its phases turn, what it is winding up and what state it is in.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { mechanicDue, mechanicShown } from '../src/games/sigilfall/progress/tips';
import { KIND_COLOR, telegraphKind } from '../src/games/sigilfall/render/effects';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { bossPips, phaseTicks, sixWords, windingUp } from '../src/games/sigilfall/ui/bossbar';
import { newWorld, readyHero } from './sigilfall-bot';

const PATTERNS = join(__dirname, '../src/games/sigilfall/sim/patterns');
const sources = (): [string, string][] => readdirSync(PATTERNS).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(PATTERNS, f), 'utf8')]);

describe('Sigilfall: a boss fight’s marks on the ground', () => {
  it('a mark is an attack unless it says otherwise, and each other kind has its own color', () => {
    expect(telegraphKind({})).toBe('danger');
    expect(telegraphKind({ kind: 'safe' })).toBe('safe');
    const colors = Object.values(KIND_COLOR);
    expect(new Set(colors).size).toBe(colors.length);
    // (none of them the red of an attack or the rift's magenta)
    for (const c of colors) expect(['#ff3b3b', '#ff3fd2']).not.toContain(c);
  });

  it('only an attack strikes: a safe place, a place to stand and a warning never hurt whoever is in them', () => {
    for (const kind of ['safe', 'stand', 'warn'] as const) {
      const w = newWorld('duskspire', readyHero('warrior', 60, 'epic'));
      const p = w.player;
      for (let i = 0; i < 60; i++) w.step(1 / 60);
      const hp = p.hp;
      w.addTelegraph({ shape: 'circle', kind, x: p.x, y: p.y, r: 60, r2: 0, angle: 0, len: 0, dur: 0.2, dmg: 9999, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      for (let i = 0; i < 30; i++) w.step(1 / 60);
      expect(p.hp, kind).toBe(hp);
    }
    const w = newWorld('duskspire', readyHero('warrior', 60, 'epic'));
    const p = w.player;
    // (past the moment's grace a hero has on arriving)
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    const hp = p.hp;
    w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 60, r2: 0, angle: 0, len: 0, dur: 0.2, dmg: 400, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    for (let i = 0; i < 30; i++) w.step(1 / 60);
    expect(p.hp).toBeLessThan(hp);
  });

  it('the Hallow King’s Sun and Highwall’s volley mark the ground they spare as safe', () => {
    const src = Object.fromEntries(sources());
    expect(src['hallow-king.ts']).toMatch(/kind: 'safe'/);
    expect(src['siege-of-highwall.ts']).toMatch(/kind: 'safe'/);
  });
});

describe('Sigilfall: a boss’s mechanics called out', () => {
  it('no boss shouts over its own head any more: every one goes to the callout', () => {
    const left: string[] = [];
    let calls = 0;
    for (const [f, s] of sources()) {
      for (const m of s.matchAll(/w\.text\(e\.x, e\.y - e\.r - \d+, '[^']*', [^,]+, true\)/g)) left.push(`${f}: ${m[0]}`);
      calls += [...s.matchAll(/w\.callout\(/g)].length;
    }
    expect(left).toEqual([]);
    expect(calls).toBeGreaterThan(100);
  });

  it('a callout holds for its time and then clears, and a newer one replaces it', () => {
    const w = newWorld('duskspire', readyHero('warrior', 60, 'epic'));
    w.callout('THE SUN SIGIL BLAZES', '#ffd24a', 'Stand in his shadow', 1);
    expect(w.shout?.hint).toBe('Stand in his shadow');
    w.callout('Rise.', '#a48bdc', undefined, 1);
    expect(w.shout?.text).toBe('Rise.');
    for (let i = 0; i < 90; i++) w.step(1 / 60);
    expect(w.shout).toBeNull();
  });

  it('what to do about a mechanic is shown the first time a hero meets it, and not again', () => {
    const h = readyHero('mage', 30);
    expect(mechanicDue(h, true, 'THE SUN SIGIL BLAZES')).toBe(true);
    expect(mechanicDue(h, false, 'THE SUN SIGIL BLAZES')).toBe(false);
    mechanicShown(h, 'THE SUN SIGIL BLAZES');
    mechanicShown(h, 'THE SUN SIGIL BLAZES');
    expect(mechanicDue(h, true, 'THE SUN SIGIL BLAZES')).toBe(false);
    expect(h.opened.filter((k) => k.startsWith('hint:'))).toHaveLength(1);
    expect(mechanicDue(h, true, 'THE WEIGHT OF STONE')).toBe(true);
  });

  it('a mechanic’s name is cut to six words; what a boss says is left whole', () => {
    expect(sixWords('Rise.')).toBe('Rise.');
    expect(sixWords('THE DOOM FALLS ON ALL WHO STAND HERE')).toBe('THE DOOM FALLS ON ALL WHO…');
    expect(sixWords('Six. She carries six. Bring them to me.')).toBe('Six. She carries six. Bring them to me.');
  });
});

describe('Sigilfall: the boss’s bar', () => {
  it('marks where each later phase begins, for every boss', () => {
    for (const b of Object.values(BOSSES)) {
      const ticks = phaseTicks(b);
      expect(ticks.length, b.id).toBe(b.phases.filter((p) => p.at < 1 && p.at > 0).length);
      for (const at of ticks) expect(at).toBeGreaterThan(0);
    }
    expect(phaseTicks(BOSSES.vaelor!).length).toBeGreaterThanOrEqual(2);
  });

  it('shows a wind-up of a second or more, the soonest of several, and never a safe place or a short jab', () => {
    const w = newWorld('duskspire', readyHero('warrior', 60, 'epic'));
    const base = { shape: 'circle' as const, x: 0, y: 0, r: 20, r2: 0, angle: 0, len: 0, dmg: 1, knock: 0, tone: 'enemy' as const, owner: -1, linger: 0 };
    expect(windingUp(w)).toBeNull();
    w.addTelegraph({ ...base, dur: 0.5 });
    w.addTelegraph({ ...base, dur: 3, kind: 'safe' });
    expect(windingUp(w)).toBeNull();
    w.addTelegraph({ ...base, dur: 4 });
    w.addTelegraph({ ...base, dur: 2 });
    const now = windingUp(w)!;
    expect(now.left).toBeCloseTo(2);
    expect(now.k).toBe(0);
  });

  it('says its phase, a ward, a daze and what afflicts it, each once', () => {
    const w = newWorld('duskspire', readyHero('warrior', 60, 'epic'));
    const def = BOSSES.vaelor!;
    const e = { shield: 10, statuses: [{ id: 'burn', t: 1, power: 1, tick: 0 }, { id: 'burn', t: 1, power: 1, tick: 0 }, { id: 'stun', t: 1, power: 0, tick: 0 }], boss: { def, phase: 1, dazed: 1 } } as unknown as Enemy;
    void w;
    const pips = bossPips(e);
    expect(pips.map((p) => p.label)).toEqual([`Phase 2 of ${def.phases.length}`, 'Warded', 'Dazed', 'Burning', 'Stunned']);
    expect(pips.find((p) => p.id === 'ward')!.tone).toBe('bad');
    expect(pips.find((p) => p.id === 'stun')!.tone).toBe('good');
  });
});
