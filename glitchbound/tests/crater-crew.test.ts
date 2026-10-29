import { describe, expect, it } from 'vitest';
import { botTurn } from '../src/games/crater-crew/ai';
import { CHAR_IDS } from '../src/games/crater-crew/characters';
import { canFire, cleanInput, crewScore, endTurn, newMatch, playTurn, runInputs, runSteps, worldFor, MAX_TURNS, type Match, type TurnInput } from '../src/games/crater-crew/match';
import { dcos, dsin, PI } from '../src/games/crater-crew/math';
import { fire, IN_JUMP, IN_LEFT, IN_RIGHT, MAX_SHOT_STEPS, runToRest, settled, settleUnit, stepWorld, walkStep } from '../src/games/crater-crew/sim';
import { soloMatch, botMove } from '../src/games/crater-crew/solo';
import { dailyTerrain, resultLine } from '../src/games/crater-crew/Game';
import { WEAPON_IDS, WEAPONS } from '../src/games/crater-crew/weapons';
import { GAMES } from '../src/catalog/games';
import { baseMask, bodyFree, decorSpots, findSpawns, grounded, H, maskFor, W } from '../src/games/crater-crew/terrain';
import { TERRAIN_IDS, TERRAINS, type TerrainId } from '../src/games/crater-crew/terrains';

const crews = (n: number, bot: 'easy' | 'normal' | 'hard' | null = null) =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, char: CHAR_IDS[i]!, bot, seat: null }));

/** Typed arrays this big are far too slow for toEqual. */
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && Buffer.compare(a, b) === 0;

const battle = (terrain: TerrainId, seed = 7, n = 2, size = 2): Match => newMatch({ seed, terrain, crewSize: size, turnSecs: 30, crews: crews(n) });

describe('crater crew: arithmetic', () => {
  it('sine and cosine match the real ones closely', () => {
    for (let x = -10; x <= 10; x += 0.37) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-8);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-8);
    }
    expect(dsin(PI / 2)).toBeCloseTo(1, 8);
  });
});

describe('crater crew: the ten terrains', () => {
  it('has ten distinct terrains with names', () => {
    expect(TERRAIN_IDS).toHaveLength(10);
    expect(new Set(TERRAIN_IDS.map((t) => TERRAINS[t].name)).size).toBe(10);
  });

  for (const t of TERRAIN_IDS) {
    it(`${t}: the same seed builds the same ground, a different one differs, and six crews of three fit`, () => {
      const a = baseMask(11, t);
      const b = baseMask(11, t).slice();
      expect(same(a, b)).toBe(true);
      const c = baseMask(12, t);
      let diff = 0;
      for (let i = 0; i < a.length; i += 97) diff += a[i] !== c[i] ? 1 : 0;
      expect(diff).toBeGreaterThan(50);
      let solid = 0;
      for (let i = 0; i < a.length; i += 13) solid += a[i]!;
      expect(solid / (a.length / 13)).toBeGreaterThan(0.12);
      expect(solid / (a.length / 13)).toBeLessThan(0.8);
      for (const seed of [1, 2, 3]) {
        const m = baseMask(seed, t);
        const spots = findSpawns(m, t, 18, seed);
        expect(spots).toHaveLength(18);
        for (const p of spots) {
          expect(bodyFree(m, p.x, p.y)).toBe(true);
          expect(grounded(m, p.x, p.y)).toBe(true);
          expect(p.y).toBeLessThan(TERRAINS[t].liquidY - 30);
        }
      }
      expect(decorSpots(a, t, 11).length).toBeGreaterThan(6);
    });
  }
});

describe('crater crew: a turn', () => {
  it('walking moves the unit and stays on the ground', () => {
    const m = battle('meadow');
    const w = worldFor(m);
    const u = w.units.find((x) => x.id === m.active)!;
    const x0 = u.x;
    for (let i = 0; i < 60; i++) walkStep(w, u.id, IN_RIGHT);
    expect(u.x).toBeGreaterThan(x0 + 20);
    for (let i = 0; i < 200 && !settled(w); i++) walkStep(w, u.id, 0);
    expect(grounded(w.mask, u.x, u.y) || u.drowned).toBe(true);
  });

  it('a jump leaves the ground and lands again', () => {
    const m = battle('moon');
    const w = worldFor(m);
    const u = w.units.find((x) => x.id === m.active)!;
    walkStep(w, u.id, IN_JUMP);
    expect(u.air).toBe(true);
    for (let i = 0; i < 400 && u.air; i++) walkStep(w, u.id, 0);
    expect(u.air).toBe(false);
  });

  it('a rocket straight down blows a crater and hurts the shooter', () => {
    const m = battle('meadow');
    const w = worldFor(m);
    const id = m.active;
    fire(w, id, { w: 'rocket', aim: -850, dir: 1, power: 40, tx: 0 });
    runToRest(w);
    expect(w.craters.length).toBe(3);
    expect(w.hurt[id]).toBeGreaterThan(10);
  });

  it('replays to the same result (the room and every phone agree)', () => {
    const m = battle('dunes', 99, 3, 2);
    const input: TurnInput = { walk: [[IN_RIGHT, 40], [0, 10], [IN_JUMP | IN_RIGHT, 1], [0, 50]], fire: { w: 'grenade', aim: 300, dir: 1, power: 70, tx: 0 } };
    const a = playTurn(m, input).match;
    const b = playTurn(JSON.parse(JSON.stringify(m)) as Match, JSON.parse(JSON.stringify(input)) as TurnInput).match;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.turn).toBe(1);
    expect(a.active).not.toBe(m.active);
    expect(a.crews[a.units.find((u) => u.id === m.active)!.crew]!.ammo.grenade).toBe(-1);
  });

  it('a turn played live step by step (as the phone does) ends exactly where the room’s replay does', () => {
    for (const [t, w] of [
      ['meadow', 'rocket'],
      ['atoll', 'grenade'],
      ['sugar', 'splitter'],
      ['scrap', 'dynamite'],
      ['moon', 'meteor'],
      ['graves', 'zapper'],
    ] as const) {
      const m = battle(t, 31, 3, 2);
      const bits = [...Array(50).fill(IN_RIGHT), IN_JUMP, ...Array(40).fill(0), ...Array(30).fill(IN_LEFT)] as number[];
      const f = { w, aim: 380, dir: -1 as const, power: 66, tx: 900 };
      // the phone: one walkStep per frame step, the walk recorded, then the shot played frame by frame
      const live = worldFor(m);
      for (const b of bits) walkStep(live, m.active, b);
      settleUnit(live, m.active);
      const fired = canFire(m, live, f);
      if (fired) fire(live, m.active, f);
      for (let i = 0; i < MAX_SHOT_STEPS && !settled(live); i++) stepWorld(live);
      live.projs = [];
      const walk: [number, number][] = [];
      for (const b of bits) {
        const last = walk[walk.length - 1];
        if (last && last[0] === b) last[1]++;
        else walk.push([b, 1]);
      }
      const input: TurnInput = { walk, fire: f };
      const phone = endTurn(m, live, input, fired);
      // the room: the turn from the network, cleaned and replayed
      const room = playTurn(m, cleanInput(JSON.parse(JSON.stringify(input)))!).match;
      expect(JSON.stringify(phone), t).toBe(JSON.stringify(room));
    }
  });

  it('builds the same ground from the craters as the turn left', () => {
    const m = battle('peaks', 5);
    const { match, world } = playTurn(m, { walk: [], fire: { w: 'rocket', aim: 100, dir: 1, power: 60, tx: 0 } });
    expect(same(maskFor(match.seed, match.terrain, match.craters), world.mask)).toBe(true);
  });

  it('rejects malformed turns', () => {
    expect(cleanInput(null)).toBeNull();
    expect(cleanInput({ walk: [[9, 1]], fire: null })).toBeNull();
    expect(cleanInput({ walk: [], fire: { w: 'nuke', aim: 0, dir: 1, power: 50, tx: 0 } })).toBeNull();
    expect(cleanInput({ walk: [], fire: { w: 'rocket', aim: 2000, dir: 1, power: 50, tx: 0 } })).toBeNull();
    expect(cleanInput({ walk: [[1, 5]], fire: { w: 'rocket', aim: 10, dir: -1, power: 50, tx: 3 } })).toEqual({ walk: [[1, 5]], fire: { w: 'rocket', aim: 10, dir: -1, power: 50, tx: 3 } });
  });

  it('after dropping dynamite the critter can still run: kept only for dynamite, three seconds at most', () => {
    const dyn = { w: 'dynamite' as const, aim: 0, dir: 1 as const, power: 0, tx: 0 };
    expect(runSteps('dynamite')).toBe(180);
    expect(runSteps('rocket')).toBe(0);
    expect(cleanInput({ walk: [], fire: dyn, run: [[IN_RIGHT, 500]] })).toEqual({ walk: [], fire: dyn, run: [[IN_RIGHT, 180]] });
    expect(cleanInput({ walk: [], fire: { ...dyn, w: 'rocket' }, run: [[IN_RIGHT, 50]] })).toEqual({ walk: [], fire: { ...dyn, w: 'rocket' } });
    expect(cleanInput({ walk: [], fire: null, run: [[IN_RIGHT, 50]] })).toEqual({ walk: [], fire: null });
    expect(cleanInput({ walk: [], fire: dyn, run: [[9, 5]] })).toBeNull();
    expect(cleanInput({ walk: [], fire: dyn, run: 'away' })).toBeNull();
    expect(runInputs({ walk: [], fire: dyn, run: [[IN_LEFT, 100], [IN_JUMP, 1], [IN_RIGHT, 300]] })).toHaveLength(180);
    expect(runInputs({ walk: [], fire: { ...dyn, w: 'grenade' }, run: [[IN_LEFT, 100]] })).toHaveLength(0);
    // running clear of the blast: never more hurt than standing by it, and less on every one of these maps
    let clear = 0;
    for (const t of ['meadow', 'dunes', 'scrap', 'sugar'] as const) {
      const m = battle(t, 31, 2, 1);
      const me = m.units.find((u) => u.id === m.active)!;
      const away = me.x < W / 2 ? IN_LEFT : IN_RIGHT;
      const stay = playTurn(m, { walk: [], fire: { ...dyn, dir: me.facing } });
      const run = playTurn(m, { walk: [], fire: { ...dyn, dir: me.facing }, run: [[away, 170], [away | IN_JUMP, 1], [away, 9]] });
      const hp = (r: typeof stay) => r.match.units.find((u) => u.id === m.active)!.hp;
      expect(hp(run), t).toBeGreaterThanOrEqual(hp(stay));
      if (hp(run) > hp(stay)) clear++;
    }
    expect(clear).toBe(4);
  });

  it('a dynamite run played live step by step (as the phone does) ends exactly where the room’s replay does', () => {
    for (const t of ['meadow', 'peaks', 'hollow', 'magma'] as const) {
      const m = battle(t, 77, 3, 2);
      const f = { w: 'dynamite' as const, aim: 0, dir: 1 as const, power: 0, tx: 0 };
      const live = worldFor(m);
      for (let i = 0; i < 30; i++) walkStep(live, m.active, IN_RIGHT);
      settleUnit(live, m.active);
      fire(live, m.active, f);
      // the run: the world (and the fuse) goes on while the critter walks and jumps
      const bits = [...Array(60).fill(IN_LEFT), IN_LEFT | IN_JUMP, ...Array(119).fill(IN_LEFT)] as number[];
      for (const b of bits) walkStep(live, m.active, b);
      for (let i = 0; i < MAX_SHOT_STEPS && !settled(live); i++) stepWorld(live);
      live.projs = [];
      const input: TurnInput = { walk: [[IN_RIGHT, 30]], fire: f, run: [[IN_LEFT, 60], [IN_LEFT | IN_JUMP, 1], [IN_LEFT, 119]] };
      const phone = endTurn(m, live, input, true);
      const room = playTurn(m, cleanInput(JSON.parse(JSON.stringify(input)))!).match;
      expect(JSON.stringify(phone), t).toBe(JSON.stringify(room));
    }
  });
});

describe('crater crew: computer crews', () => {
  it('a battle between bots always ends, on every terrain', () => {
    for (const t of TERRAIN_IDS) {
      let m = newMatch({ seed: 3, terrain: t, crewSize: 1, turnSecs: 30, crews: crews(3, 'hard') });
      let guard = 0;
      while (!m.over && guard++ < MAX_TURNS + 5) m = playTurn(m, botTurn(m, 'hard', m.turn + 1)).match;
      expect(m.over, t).toBe(true);
      expect(m.winner).not.toBeNull();
      for (let i = 0; i < m.crews.length; i++) expect(crewScore(m, i)).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);

  it('a hard bot usually hits', () => {
    let dealt = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const m = newMatch({ seed, terrain: 'meadow', crewSize: 1, turnSecs: 30, crews: crews(2, 'hard') });
      dealt += playTurn(m, botTurn(m, 'hard', 1)).match.crews[m.crewTurn]!.dmg;
    }
    expect(dealt).toBeGreaterThan(60);
  });

  it('the daily: the same battle for everyone, a new terrain each day, bots that play the same', () => {
    const setup = { seed: 77, terrain: dailyTerrain('2026-10-30'), foes: 2, level: 'normal' as const, crewSize: 2, turnSecs: 30, name: 'You', char: 'duck' as const };
    expect(dailyTerrain('2026-10-29')).toBe('meadow');
    expect(dailyTerrain('2026-10-30')).toBe('dunes');
    expect(dailyTerrain('2026-11-08')).toBe('meadow');
    const a = soloMatch(setup);
    const b = soloMatch(setup);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.crews.map((c) => c.char)).not.toContain(undefined);
    expect(new Set(a.crews.map((c) => c.char)).size).toBe(3);
    let m = a;
    for (let i = 0; i < 3 && !m.over; i++) m = m.crews[m.crewTurn]!.bot ? botMove(m) : playTurn(m, { walk: [], fire: null }).match;
    let n = b;
    for (let i = 0; i < 3 && !n.over; i++) n = n.crews[n.crewTurn]!.bot ? botMove(n) : playTurn(n, { walk: [], fire: null }).match;
    expect(JSON.stringify(m)).toBe(JSON.stringify(n));
  });

  it('shares a spoiler-free result line', () => {
    expect(resultLine(true, 260, 3)).toBe('🏆 💥💥💥💥💥💀💀💀');
    expect(resultLine(false, 20, 0)).toBe('🏳️');
  });

  it('every weapon is described and keyed 1 to 7', () => {
    expect(WEAPON_IDS.map((w) => WEAPONS[w].key)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    for (const w of WEAPON_IDS) expect(WEAPONS[w].hint.length).toBeLessThan(48);
  });

  it('the leaderboard limit lets through even a perfect, lightning-fast battle', () => {
    const limits = GAMES.find((g) => g.slug === 'crater-crew')!.limits!;
    // the most a skirmish gives: three crews of three knocked out, then a full-health win
    const max = 9 * 100 + 9 * 50 + 250 + 3 * 100 * 2;
    // knocking out nine critters takes at least three rounds of four crews' turns, each a few seconds
    expect(max / limits.scorePerSecond).toBeLessThanOrEqual(3 * 4 * 2.5);
    let m = newMatch({ seed: 9, terrain: 'meadow', crewSize: 1, turnSecs: 30, crews: crews(2, 'hard') });
    let guard = 0;
    while (!m.over && guard++ < 200) m = playTurn(m, botTurn(m, 'hard', m.turn)).match;
    for (let i = 0; i < 2; i++) expect(crewScore(m, i)).toBeLessThanOrEqual(100 + 50 + 250 + 200);
  });

  it('the map is W x H', () => {
    expect(W * H).toBe(baseMask(1, 'meadow').length);
  });
});
