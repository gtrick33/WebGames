import { describe, expect, it } from 'vitest';
import { ENGINES, QUICK } from '../rooms/engines';
import { parseLevel } from '../src/games/prism-pals/level';
import { LEVELS } from '../src/games/prism-pals/levels';
import { Coop, type Clear } from '../src/games/prism-pals/net';
import { act, join, leave, maxMessage, newRoom, relay, shareCritters, summary, viewFor, type State } from '../src/games/prism-pals/room';
import { levelScore, packLevels } from '../src/games/prism-pals/rules';
import { CH, CW, IN_RIGHT } from '../src/games/prism-pals/sim';

const A = 'player-key-aaaaaaaaaaaaaaaa';
const B = 'player-key-bbbbbbbbbbbbbbbb';
const C = 'player-key-cccccccccccccccc';
const D = 'player-key-dddddddddddddddd';

function lobby(n = 2): State {
  const s = newRoom('ABCDE', 0, 7);
  [A, B, C, D].slice(0, n).forEach((k, i) => join(s, k, ['Ana', 'Bo', 'Cy', 'Di'][i]!, i + 1));
  return s;
}

describe('prism pals live room', () => {
  it('is registered with the rooms worker, quick match included', () => {
    expect(ENGINES['prism-pals']).toBeDefined();
    expect(QUICK['prism-pals']).toEqual({ min: 2, full: 4, seats: 4 });
    expect(maxMessage).toBeGreaterThanOrEqual(2048);
    expect(summary(lobby())).toMatchObject({ game: 'prism-pals', players: 2, max: 4, phase: 'lobby' });
  });

  it('gives everyone a different favorite pal, and only the host picks the level and starts', () => {
    const s = lobby(2);
    expect(s.picks[1]).not.toBe(s.picks[2]);
    expect(act(s, B, { t: 'color', c: s.picks[1]! }, 3)).toMatch(/already/);
    expect(act(s, B, { t: 'color', c: 3 }, 3)).toBeNull();
    expect(s.picks[2]).toBe(3);
    act(s, B, { t: 'level', i: 5 }, 4);
    expect(s.level).toBe(0);
    act(s, A, { t: 'level', i: 5 }, 4);
    expect(s.level).toBe(5);
    act(s, A, { t: 'level', i: 99 }, 4);
    expect(s.level).toBe(5);
    act(s, B, { t: 'start' }, 5);
    expect(s.phase).toBe('lobby');
    act(s, A, { t: 'start' }, 5);
    expect([s.phase, s.run]).toEqual(['play', 1]);
    // nobody's key ever leaves the server
    expect(JSON.stringify(viewFor(s, B))).not.toContain(A);
  });

  it('shares the level’s pals among the people: favorites first, then whoever runs fewest', () => {
    expect(shareCritters([1, 2], { 1: 0, 2: 1 }, 4)).toEqual([1, 2, 1, 2]);
    expect(shareCritters([1, 2], { 1: 3, 2: 0 }, 4)).toEqual([2, 1, 2, 1]);
    expect(shareCritters([1, 2, 3], { 1: 2, 2: 2, 3: 0 }, 3)).toEqual([3, 2, 1]);
    expect(shareCritters([1], { 1: 1 }, 3)).toEqual([1, 1, 1]);
    // three people never get a two-pal level: the room moves them to the three-pal set
    const s = lobby(3);
    expect(act(s, A, { t: 'level', i: 0 }, 5)).toMatch(/fewer/);
    s.level = 0;
    act(s, A, { t: 'start' }, 6);
    expect(s.level).toBe(packLevels(3)[0]);
    expect(new Set(s.own)).toEqual(new Set([1, 2, 3]));
  });

  it('scores a clear the host reports once, then goes on, replays or returns to the lobby', () => {
    const s = lobby(2);
    act(s, A, { t: 'level', i: 2 }, 3);
    act(s, A, { t: 'start' }, 4);
    const clear = { t: 'clear' as const, run: s.run, secs: 21.5, gems: 3, tries: 1 };
    expect(act(s, B, clear, 5)).toBeNull();
    expect(s.phase).toBe('play');
    expect(act(s, A, { ...clear, run: s.run - 1 }, 5)).toBeNull();
    expect(s.phase).toBe('play');
    expect(act(s, A, { ...clear, gems: 99 }, 5)).toMatch(/sense/);
    expect(act(s, A, { ...clear, secs: Number.NaN }, 5)).toMatch(/sense/);
    expect(act(s, A, clear, 6)).toBeNull();
    const score = levelScore(LEVELS[2]!.par, 21.5, 3, 1);
    expect(s.phase).toBe('result');
    expect(s.result).toEqual({ level: 2, secs: 21.5, gems: 3, tries: 1, score });
    expect(s.total).toBe(score);
    expect(s.seats.every((x) => x.score === score * s.own.filter((n) => n === x.n).length)).toBe(true);
    // a second report of the same clear changes nothing
    act(s, A, clear, 7);
    expect(s.total).toBe(score);
    act(s, A, { t: 'again' }, 8);
    expect([s.phase, s.level, s.run]).toEqual(['play', 2, 2]);
    act(s, A, { ...clear, run: 2 }, 9);
    act(s, A, { t: 'next' }, 10);
    expect([s.phase, s.level, s.run]).toEqual(['play', 3, 3]);
    act(s, A, { t: 'lobby' }, 11);
    expect(s.phase).toBe('lobby');
    expect(s.cleared).toEqual([2]);
  });

  it('hands a leaver’s pals to those still here, keeps the host through a newcomer, and passes the host role on', () => {
    const s = lobby(2);
    act(s, A, { t: 'level', i: packLevels(4)[0]! }, 3);
    act(s, A, { t: 'start' }, 4);
    expect(s.own.filter((n) => n === 1)).toHaveLength(2);
    join(s, C, 'Cy', 5);
    expect(s.host).toBe(1);
    expect(new Set(s.own)).toEqual(new Set([1, 2, 3]));
    leave(s, B, 6);
    expect(s.own.includes(2)).toBe(false);
    leave(s, A, 7);
    expect(s.host).toBe(3);
    expect(s.own).toEqual([3, 3, 3, 3]);
    // the old host back mid-level: the role stays where the world now is
    join(s, A, 'Ana', 8);
    expect(s.host).toBe(3);
    expect(s.own.includes(1)).toBe(true);
  });

  it('relays the level’s traffic only while a level is on, tagged with the sender’s seat', () => {
    const s = lobby(2);
    expect(relay(s, B, { t: 'r', d: { k: 'c' } })).toEqual({ save: false });
    act(s, A, { t: 'start' }, 3);
    expect(relay(s, B, { t: 'r', d: { k: 'c' } })).toEqual({ others: { n: 2, d: { k: 'c' } }, save: false });
    expect(relay(s, B, { t: 'start' })).toBeNull();
    expect(relay(s, 'player-key-zzzzzzzzzzzzzzzz', { t: 'r', d: 1 })).toEqual({ save: false });
  });

  it('lets the host remove someone in the lobby, who can’t come back', () => {
    const s = lobby(2);
    expect(act(s, B, { t: 'kick', n: 1 }, 3)).toBeNull();
    expect(s.seats).toHaveLength(2);
    act(s, A, { t: 'kick', n: 2 }, 3);
    expect(s.seats).toHaveLength(1);
    expect(join(s, B, 'Bo', 4)).toBe('kicked');
    expect(join(s, C, 'Cy', 4)).toBeNull();
    expect(join(s, D, 'Di', 4)).toBeNull();
    expect(join(s, 'player-key-eeeeeeeeeeeeeeee', 'Ed', 4)).toBeNull();
    expect(join(s, 'player-key-ffffffffffffffff', 'Fi', 4)).toBe('full');
  });
});

/** Two games wired through the room's relay (a fake transport that delivers at once). */
function table(level: number) {
  const s = lobby(2);
  act(s, A, { t: 'level', i: level }, 3);
  act(s, A, { t: 'start' }, 4);
  const clears: Clear[] = [];
  const games: Record<string, Coop> = {};
  const keys = [A, B];
  const lv = parseLevel(LEVELS[s.level]!);
  for (const key of keys) {
    const me = s.seats.find((x) => x.key === key)!.n;
    games[key] = new Coop(
      lv,
      s.run,
      me,
      s.own,
      me === s.host,
      (d) => {
        const r = relay(s, key, { t: 'r', d });
        const out = r?.others as { n: number; d: unknown } | undefined;
        if (out) for (const other of keys) if (other !== key) games[other]?.receive(out.n, out.d);
      },
      (c) => {
        clears.push(c);
        const err = act(s, key, { t: 'clear', run: s.run, ...c }, 100);
        if (err) throw new Error(err);
      },
    );
  }
  const step = (n: number, input: Record<string, number[]> = {}): void => {
    for (let k = 0; k < n; k++) for (const key of keys) games[key]!.step(input[key] ?? []);
  };
  return { s, host: games[A]!, guest: games[B]!, step, clears };
}

describe('prism pals live level (host and guest through the relay)', () => {
  it('shows each game the other’s pal, and the host’s world on the guest', () => {
    const { host, guest, step } = table(0);
    // Ana (host) runs Tango, Bo runs Sprig
    expect([host.mine(0), guest.mine(1)]).toEqual([true, true]);
    step(25, { [B]: [0, IN_RIGHT] });
    const sprig = guest.w.cr[1]!;
    expect(sprig.x).toBeGreaterThan(3.5);
    expect(Math.abs(host.w.cr[1]!.x - sprig.x)).toBeLessThan(0.6);
    expect(Math.abs(guest.w.t - host.w.t)).toBeLessThanOrEqual(4);
  });

  it('takes a guest’s gem and a guest’s fall to the host, which restarts the level for both', () => {
    const { host, guest, step } = table(0);
    const lv = guest.w.lv;
    const g = lv.gems.findIndex((x) => x.color === 1);
    const gem = lv.gems[g]!;
    // Bo's Sprig, put right on its gem
    const sprig = guest.w.cr[1]!;
    sprig.x = gem.x + 0.5 - CW / 2;
    sprig.y = gem.y + 0.5 - CH / 2;
    step(12);
    expect(guest.w.gems[g]).toBe(true);
    expect(host.w.gems[g]).toBe(true);
    // now off the bottom of the map
    guest.w.cr[1]!.y = lv.h + 2;
    step(12);
    expect(host.w.tries).toBe(1);
    expect(guest.w.tries).toBe(1);
    expect(guest.w.gems[g]).toBe(false);
    expect(guest.w.cr[1]!.dead).toBe(false);
  });

  it('clears once when both pals stand in the door, and the room scores it', () => {
    const { s, host, guest, step, clears } = table(0);
    const doors = host.w.lv.exits;
    const put = (game: Coop, i: number, at: { x: number; y: number }): void => {
      const c = game.w.cr[i]!;
      c.x = at.x + 0.5 - CW / 2;
      c.y = at.y + 1 - CH;
      c.vy = 0;
    };
    put(host, 0, doors[0]!);
    put(guest, 1, doors[1]!);
    step(60);
    expect(clears).toHaveLength(1);
    expect(s.phase).toBe('result');
    expect(guest.w.cleared).toBe(true);
    expect(s.result!.score).toBeGreaterThanOrEqual(1000);
  });

  it('carries on when the host leaves mid-level: the guest’s game takes the world over', () => {
    const { s, guest, step, clears } = table(0);
    step(30);
    leave(s, A, 50);
    expect(s.host).toBe(2);
    guest.setRoles(true, s.own);
    expect(guest.host).toBe(true);
    expect([guest.mine(0), guest.mine(1)]).toEqual([true, true]);
    const t = guest.w.t;
    for (let k = 0; k < 30; k++) guest.step([IN_RIGHT, 0]);
    expect(guest.w.t).toBe(t + 30);
    expect(guest.w.cr[0]!.x).toBeGreaterThan(1.5);
    // and can finish the level alone
    for (const [i, d] of guest.w.lv.exits.slice(0, 2).entries()) {
      const c = guest.w.cr[i]!;
      c.x = d.x + 0.5 - CW / 2;
      c.y = d.y + 1 - CH;
    }
    for (let k = 0; k < 40; k++) guest.step([0, 0]);
    expect(clears).toHaveLength(1);
    expect(s.phase).toBe('result');
  });
});
