/**
 * The Vigil's return (the owner, 2026-11-25: "add more diversity to the vigil game mode ... now it feels repetitive"):
 * things happen during a night, the Host has kinds that ask for different play, every land plays by a rule of its own,
 * a champion has an attack of its own, and something earned each night lasts (vigil/night.ts, vigil/returns.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { maxMessage } from '../src/games/sigilfall/net/vigilRoom';
import { BOSS_EVERY, firstSpell, FOE_KINDS, foesOf, PLAIN_AI, smallOf, SPELLS, spellsOf, VIGIL_MAPS, type ChampMove, type FoeAi, type FoeDef, type RuleId } from '../src/games/sigilfall/vigil/kit';
import { BOON_COST, BOON_IDS, BOON_MAX, cleanKit, EVENT_KINDS, EVENTS, GALE, GALE_PUSH, galeAngle, LANE_WARN, LANTERN_HOLD, motesFor, RULE_IDS, RULES, spotsNear, STORM, TIDE, TRAIT, VENT_EVERY, VENT_QUIET, ventClock, weekEnds, WEEKLY_BOUNTY, WEEKLY_HOLD, weeklyOf, weekOf, WILD_COST, WILD_SPELLS, wildsFor, type EventKind } from '../src/games/sigilfall/vigil/night';
import { bankNight, buyBoon, buyWild, carryWild, cleanReturns, kitOf, readReturns } from '../src/games/sigilfall/vigil/returns';
import { Vigil, type Foe, type Hero, type SpellStats, type VigilInput, type VigilOptions } from '../src/games/sigilfall/vigil/sim';
import { applySnap, SnapWriter } from '../src/games/sigilfall/vigil/snapshot';

const STILL: VigilInput = { mx: 0, my: 0 };
const DT = 1 / 30;

/** The night's insides, for a test to set a scene with. */
interface Inside {
  bag: EventKind[];
  nextEvent: number;
  spawnT: number;
  packLeft: number;
  addFoe(def: FoeDef, boss: string | null, sprite: string | null, at?: { x: number; y: number }, elite?: boolean, trait?: number, pack?: boolean): void;
  hurt(f: Foe, dmg: number, by?: Hero): void;
  land(h: Hero, f: Foe, st: SpellStats, dmg: number, fromX: number, fromY: number): void;
  pickupOf(h: Hero): number;
}
const inside = (v: Vigil): Inside => v as unknown as Inside;

/** A night with nobody in it but the hero, who can't fall and casts nothing: only what the test puts there. */
function quiet(o: VigilOptions = {}, seed = 7): Vigil {
  const v = new Vigil(seed, 2000, 2000, { rules: [], ...o });
  for (const h of v.heroes) {
    h.hp = 1e9;
    h.spells = {};
  }
  inside(v).spawnT = -1e9;
  inside(v).nextEvent = 1e9;
  return v;
}
function steps(v: Vigil, seconds: number, input: VigilInput = STILL): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    for (const h of v.heroes) if (h.cards) v.choose(0, h.id);
    v.step(DT, input);
  }
}
function put(v: Vigil, ai: FoeAi, x: number, y: number, elite = false, trait = 0): Foe {
  const def = v.waves.find((w) => w.ai === ai)!;
  inside(v).addFoe(def, null, null, { x, y }, elite, trait);
  return v.foes[v.foes.length - 1]!;
}
/** The next event is this one, now. */
function begin(v: Vigil, kind: EventKind): void {
  inside(v).bag = [kind];
  inside(v).nextEvent = 0;
  v.step(DT, STILL);
  inside(v).nextEvent = 1e9;
  expect(v.eventLog[v.eventLog.length - 1]).toBe(kind);
}
/** A bot that runs from what is near and takes the first card. */
function bot(v: Vigil, t: number): VigilInput {
  if (v.cards) v.choose(0);
  let ax = 0;
  let ay = 0;
  for (const f of v.foes) {
    const d = Math.hypot(v.x - f.x, v.y - f.y) || 1;
    if (d < 70) {
      ax += (v.x - f.x) / d / d;
      ay += (v.y - f.y) / d / d;
    }
  }
  return { mx: ax * 40 + Math.cos(t * 0.5) * 0.3, my: ay * 40 + Math.sin(t * 0.5) * 0.3 };
}

describe('The Vigil’s return: things happen during a night', () => {
  it('every kind of event comes once before any comes again, each with its own name and what to do', () => {
    expect(EVENT_KINDS.length).toBeGreaterThanOrEqual(6);
    const names = EVENT_KINDS.map((k) => EVENTS[k].name);
    expect(new Set(names).size).toBe(names.length);
    for (const k of EVENT_KINDS) expect(EVENTS[k].text.length, k).toBeGreaterThan(12);
    const v = new Vigil(11, 2000, 2000);
    for (let t = 0; t < 10 * 60 && v.eventLog.length < EVENT_KINDS.length; t += 1 / 10) {
      v.me.hp = 1e9;
      if (v.cards) v.choose(0);
      v.step(1 / 10, STILL);
    }
    expect([...v.eventLog].sort()).toEqual([...EVENT_KINDS].sort());
    // about one a minute: all of them inside ten minutes, the first near the first minute's end
    expect(v.t).toBeLessThan(10 * 60);
  });

  it('the first comes around a minute in, and none begins on top of a champion’s coming', () => {
    const v = new Vigil(12, 2000, 2000);
    const began: number[] = [];
    for (let t = 0; t < 8 * 60; t += 1 / 10) {
      v.me.hp = 1e9;
      if (v.cards) v.choose(0);
      const n = v.eventLog.length;
      v.step(1 / 10, STILL);
      if (v.eventLog.length > n) began.push(v.t);
    }
    expect(began[0]).toBeGreaterThan(45);
    expect(began[0]).toBeLessThan(75);
    expect(began.length).toBeGreaterThanOrEqual(5);
    for (const at of began) {
      const into = at % BOSS_EVERY;
      expect(BOSS_EVERY - into, `event at ${at}`).toBeGreaterThan(8);
      if (at > BOSS_EVERY) expect(into, `event at ${at}`).toBeGreaterThan(18);
    }
  });

  it('the same seed holds the same events in the same order, however the night is played', () => {
    const order = (input: (v: Vigil, t: number) => VigilInput): EventKind[] => {
      const v = new Vigil(99, 2000, 2000);
      for (let t = 0; t < 5 * 60; t += 1 / 10) {
        v.me.hp = 1e9;
        if (v.cards) v.choose(0);
        v.step(1 / 10, input(v, t));
      }
      return v.eventLog;
    };
    const a = order(() => STILL);
    const b = order(bot);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(b.slice(0, 3)).toEqual(a.slice(0, 3));
    expect(order(() => STILL)).toEqual(a);
  });

  it('an Ashsworn pack is marked, has a trait, and the last of it to fall leaves a chest', () => {
    const v = quiet();
    begin(v, 'pack');
    const pack = v.foes.filter((f) => f.pack);
    expect(pack.length).toBe(3);
    expect(pack.every((f) => f.elite && f.trait === v.event!.trait)).toBe(true);
    expect([TRAIT.swift, TRAIT.stone, TRAIT.venom]).toContain(v.event!.trait);
    expect(v.banner?.text).toContain(EVENTS.pack.name);
    for (const f of pack.slice(0, 2)) inside(v).hurt(f, f.hp + 1);
    expect(v.pickups.some((p) => p.kind === 'chest')).toBe(false);
    expect(v.event?.kind).toBe('pack');
    inside(v).hurt(pack[2]!, pack[2]!.hp + 1);
    expect(v.pickups.some((p) => p.kind === 'chest')).toBe(true);
    expect(v.event).toBeNull();
    expect(v.feats.events).toBe(1);
  });

  it('a stoneskin pack can’t be stopped or thrown, and a swift one is fast', () => {
    const v = quiet();
    const plain = put(v, 'walk', 2100, 2000, true);
    const stone = put(v, 'walk', 2100, 2050, true, TRAIT.stone);
    const swift = put(v, 'walk', 2100, 2100, true, TRAIT.swift);
    expect(swift.speed).toBeGreaterThan(plain.speed * 1.3);
    expect(stone.maxHp).toBeGreaterThan(plain.maxHp);
    const st = { ...v.statsOf(v.me, firstSpell('mage')), stun: 2, freeze: true, knock: 200, crit: 0 };
    inside(v).land(v.me, stone, st, 1, v.x, v.y);
    inside(v).land(v.me, plain, st, 1, v.x, v.y);
    expect(stone.frozen + stone.stun).toBe(0);
    expect(Math.abs(stone.kx) + Math.abs(stone.ky)).toBe(0);
    expect(plain.frozen + plain.stun).toBeGreaterThan(0);
  });

  it('the Wild Run marks its paths first, then tramples whoever is on them: hero and Host alike', () => {
    const v = quiet();
    v.me.hp = 1000;
    begin(v, 'run');
    expect(v.lanes.length).toBe(3);
    const first = v.lanes[0]!;
    // one of the Host standing on the first path
    const on = put(v, 'walk', first.x + Math.cos(first.a) * 60, first.y + Math.sin(first.a) * 60);
    on.speed = 0;
    v.me.x = first.x;
    v.me.y = first.y;
    steps(v, LANE_WARN - 0.2);
    // marked, and nothing has landed yet
    expect(v.me.hp).toBe(1000);
    expect(on.hp).toBe(on.maxHp);
    v.me.x = first.x;
    v.me.y = first.y;
    steps(v, 0.4);
    expect(v.me.hp).toBeLessThan(1000);
    expect(on.hp).toBeLessThan(on.maxHp * 0.5);
    // and one who steps off the paths is untouched
    const w = quiet();
    w.me.hp = 1000;
    begin(w, 'run');
    w.me.x += 3000;
    steps(w, EVENTS.run.secs + 0.5);
    expect(w.me.hp).toBe(1000);
    expect(w.lanes.length).toBe(0);
    expect(w.event).toBeNull();
    expect(w.feats.events).toBe(1);
  });

  it('the Closing Ring comes from every side, and a Night Swarm from one', () => {
    const ring = quiet();
    ring.t = 120;
    begin(ring, 'ring');
    const angles = ring.foes.map((f) => Math.atan2(f.y - ring.y, f.x - ring.x));
    expect(ring.foes.length).toBeGreaterThan(10);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(5);
    const swarm = quiet();
    swarm.t = 120;
    begin(swarm, 'swarm');
    expect(swarm.foes.length).toBeGreaterThan(10);
    const cx = swarm.foes.reduce((a, f) => a + f.x - swarm.x, 0) / swarm.foes.length;
    const cy = swarm.foes.reduce((a, f) => a + f.y - swarm.y, 0) / swarm.foes.length;
    expect(Math.hypot(cx, cy)).toBeGreaterThan(150);
    // neither is made of the kinds that would make it unfair: a ring of Cinderbloats, say
    expect([...ring.foes, ...swarm.foes].every((f) => PLAIN_AI.includes(f.def.ai))).toBe(true);
  });

  it('a Dawn Lantern is lit by standing in its light, and gives everyone a choice and mending', () => {
    const v = quiet();
    begin(v, 'lantern');
    const e = v.event!;
    expect(Math.hypot(e.x - v.x, e.y - v.y)).toBeGreaterThan(60);
    steps(v, 3);
    expect(e.prog).toBe(0);
    v.me.x = e.x;
    v.me.y = e.y;
    v.me.hp = 10;
    const owed = v.me.owed;
    steps(v, LANTERN_HOLD / 2);
    expect(e.prog).toBeGreaterThan(0.4);
    expect(v.event).toBe(e);
    v.step(DT * 0 + LANTERN_HOLD / 2 + 0.1, STILL);
    expect(v.event).toBeNull();
    expect(v.me.hp).toBeGreaterThan(10);
    expect(v.me.owed + (v.me.cards ? 1 : 0)).toBeGreaterThan(owed);
    expect(v.feats.events).toBe(1);
    // left alone, it gutters out and gives nothing
    const w = quiet();
    begin(w, 'lantern');
    steps(w, EVENTS.lantern.secs + 0.5);
    expect(w.event).toBeNull();
    expect(w.feats.events).toBe(0);
    expect(w.banner?.text).toContain('gutters');
  });

  it('a Spark Thief runs, never bites, spills sparks when struck, and leaves a chest if caught', () => {
    const v = quiet();
    v.me.hp = 1000;
    begin(v, 'thief');
    const thief = v.foes.find((f) => f.trait === TRAIT.thief)!;
    expect(thief).toBeTruthy();
    const d0 = Math.hypot(thief.x - v.x, thief.y - v.y);
    v.me.x = thief.x - 20;
    v.me.y = thief.y;
    steps(v, 1.5);
    expect(Math.hypot(thief.x - v.x, thief.y - v.y)).toBeGreaterThan(40);
    // right on top of it, it still does no harm
    v.me.x = thief.x;
    v.me.y = thief.y;
    v.step(DT, STILL);
    expect(v.me.hp).toBe(1000);
    expect(d0).toBeGreaterThan(100);
    const sparks = v.sparks.length;
    inside(v).hurt(thief, 1);
    expect(v.sparks.length).toBe(sparks + 1);
    inside(v).hurt(thief, thief.hp + 1);
    expect(v.pickups.some((p) => p.kind === 'chest')).toBe(true);
    expect(v.event).toBeNull();
    expect(v.feats.events).toBe(1);
    // not caught in time, it is gone, with its chest
    const w = quiet();
    begin(w, 'thief');
    steps(w, EVENTS.thief.secs + 0.5);
    expect(w.foes.some((f) => f.trait === TRAIT.thief)).toBe(false);
    expect(w.pickups.length).toBe(0);
    expect(w.feats.events).toBe(0);
  });

  it('the Ember Hour brings twice the Host and twice the sparks, for a while', () => {
    const came = (hour: boolean): { foes: number; xp: number } => {
      const v = new Vigil(21, 2000, 2000, { rules: [] });
      v.me.hp = 1e9;
      v.me.spells = {};
      inside(v).nextEvent = 1e9;
      v.t = 30;
      if (hour) begin(v, 'hour');
      for (let i = 0; i < 30 * 8; i++) {
        v.me.spells = {};
        v.step(DT, STILL);
      }
      const foes = v.foes.length;
      (v as unknown as { gain(xp: number, h: Hero): void }).gain(3, v.me);
      return { foes, xp: v.xp };
    };
    const plain = came(false);
    const hour = came(true);
    expect(hour.foes).toBeGreaterThan(plain.foes * 1.6);
    expect(hour.xp).toBe(plain.xp * 2);
    const v = quiet();
    begin(v, 'hour');
    steps(v, EVENTS.hour.secs + 0.5);
    expect(v.event).toBeNull();
  });
});

describe('The Vigil’s return: foes that ask for different play', () => {
  it('four kinds beyond the plain Host, each named, each in the waves early and late, each with a real face', () => {
    const waves = foesOf(VIGIL_MAPS[0]!);
    expect(waves.length).toBeLessThanOrEqual(16);
    for (const ai of ['split', 'burst', 'guard', 'rally'] as FoeAi[]) {
      const rows = waves.filter((w) => w.ai === ai);
      expect(rows.length, ai).toBeGreaterThanOrEqual(1);
      expect(FOE_KINDS[ai]?.name, ai).toBeTruthy();
      expect(FOE_KINDS[ai]!.text.length, ai).toBeGreaterThan(15);
      // (there is always one of the kind in season from when it first comes)
      const first = Math.min(...rows.map((r) => r.from));
      expect(first, ai).toBeLessThan(300);
      expect(Math.max(...rows.map((r) => r.to)), ai).toBeGreaterThan(700);
    }
    const sprites = new Set(Object.values(ENEMIES).map((e) => e.sprite));
    for (const m of VIGIL_MAPS) for (const w of foesOf(m)) expect(sprites.has(w.sprite), `${m.id} ${w.sprite}`).toBe(true);
    // the plain waves are as they were: the same eight, in the same order, with the same faces
    expect(waves.slice(0, 8).map((w) => w.ai)).toEqual(['walk', 'walk', 'rush', 'shoot', 'charge', 'walk', 'shoot', 'charge']);
    expect(waves.slice(0, 7).map((w) => w.sprite)).toEqual(VIGIL_MAPS[0]!.foes);
  });

  it('the first of a kind a keeper meets is named, once', () => {
    const v = new Vigil(3, 2000, 2000, { rules: [] });
    const said: string[] = [];
    for (let t = 0; t < 130; t += 1 / 10) {
      v.me.hp = 1e9;
      if (v.cards) v.choose(0);
      v.step(1 / 10, STILL);
      if (v.tip && said[said.length - 1] !== v.tip.text) said.push(v.tip.text);
    }
    expect(said.filter((s) => s.startsWith(FOE_KINDS.split!.name)).length).toBe(1);
    expect(said.filter((s) => s.startsWith(FOE_KINDS.burst!.name)).length).toBe(1);
  });

  it('a Twinhusk breaks into two small quick ones, which don’t break again', () => {
    const v = quiet();
    const husk = put(v, 'split', 2200, 2000);
    inside(v).hurt(husk, husk.hp + 1);
    const small = v.foes.filter((f) => !f.dead);
    expect(small.length).toBe(2);
    for (const s of small) {
      expect(s.def.base).toBe(husk.def);
      expect(s.maxHp).toBeLessThan(husk.maxHp * 0.5);
      expect(s.speed).toBeGreaterThan(husk.speed);
      expect(s.r).toBeLessThan(husk.r);
    }
    inside(v).hurt(small[0]!, small[0]!.hp + 1);
    expect(v.foes.filter((f) => !f.dead).length).toBe(1);
    expect(smallOf(small[0]!.def)).toBe(small[0]!.def);
  });

  it('a Cinderbloat never bites: it goes off where it dies, a moment later, on the Host around it too', () => {
    const v = quiet();
    v.me.hp = 1000;
    const bloat = put(v, 'burst', v.x + 60, v.y);
    const near = put(v, 'walk', v.x + 60, v.y + 10);
    near.speed = 0;
    // felled at arm's length: the mark shows, and stepping back is enough
    inside(v).hurt(bloat, bloat.hp + 1);
    expect(v.slams.length).toBe(1);
    expect(v.slams[0]!.dur).toBeGreaterThan(0.5);
    steps(v, 1);
    expect(v.me.hp).toBe(1000);
    expect(near.hp).toBeLessThan(near.maxHp);
    // one that reaches the hero goes off on them, if they stay
    const w = quiet();
    w.me.hp = 1000;
    put(w, 'burst', w.x + 30, w.y);
    steps(w, 0.4);
    expect(w.me.hp).toBe(1000);
    steps(w, 2);
    expect(w.me.hp).toBeLessThan(1000);
    expect(w.foes.length).toBe(0);
    // and a keeper who dashes clear of the mark is unhurt
    const z = quiet();
    z.me.hp = 1000;
    put(z, 'burst', z.x + 30, z.y);
    for (let i = 0; i < 90; i++) {
      z.step(DT, z.slams.length ? { mx: -1, my: 0 } : STILL);
    }
    expect(z.me.hp).toBe(1000);
  });

  it('a Wallbearer turns most of what comes at its front, and nothing from behind or while it is stopped', () => {
    const v = quiet();
    const wall = put(v, 'guard', 2100, 2000);
    wall.face = Math.PI;
    const st = { ...v.statsOf(v.me, firstSpell('mage')), crit: 0 };
    const hit = (fromX: number): number => {
      const before = wall.hp;
      inside(v).land(v.me, wall, st, 10, fromX, wall.y);
      return before - wall.hp;
    };
    // it faces the hero, at 2000: a blow from there is turned, one from behind it lands whole
    expect(hit(2000)).toBeCloseTo(4, 5);
    expect(hit(2200)).toBeCloseTo(10, 5);
    wall.stun = 1;
    expect(hit(2000)).toBeCloseTo(10, 5);
  });

  it('a Hostcaller hangs back and heartens those near it: faster, and a third tougher', () => {
    const v = quiet();
    const caller = put(v, 'rally', v.x + 100, v.y);
    const near = put(v, 'walk', v.x + 130, v.y + 20);
    const far = put(v, 'walk', v.x - 260, v.y);
    const x0 = caller.x;
    steps(v, 1);
    expect(near.rally).toBeGreaterThan(0);
    expect(far.rally).toBe(0);
    expect(caller.rally).toBe(0);
    // it keeps its distance rather than walking in
    expect(Math.abs(caller.x - x0)).toBeLessThan(12);
    const st = { ...v.statsOf(v.me, firstSpell('mage')), crit: 0 };
    const before = near.hp;
    inside(v).land(v.me, near, st, 10, near.x, near.y - 50);
    expect(before - near.hp).toBeCloseTo(6.5, 5);
    // felled, its voice fades
    inside(v).hurt(caller, caller.hp + 1);
    steps(v, 1);
    expect(near.rally).toBe(0);
  });
});

describe('The Vigil’s return: every land plays by a rule of its own', () => {
  it('twelve lands, twelve different rules, each told in a line', () => {
    const rules = VIGIL_MAPS.map((m) => m.rule);
    expect(VIGIL_MAPS.length).toBe(12);
    expect(new Set(rules).size).toBe(12);
    expect([...rules].sort()).toEqual([...RULE_IDS].sort());
    for (const r of RULE_IDS) {
      expect(RULES[r].name.length, r).toBeGreaterThan(3);
      expect(RULES[r].text.length, r).toBeGreaterThan(20);
      expect(RULES[r].text.length, r).toBeLessThan(120);
    }
    // a night says its land's rule as it begins
    const v = new Vigil(1, 2000, 2000, { map: VIGIL_MAPS[8]! });
    v.me.hp = 1e9;
    v.step(DT, STILL);
    expect(v.rules).toEqual(['cold']);
    expect(v.tip?.text).toContain(RULES.cold.name);
  });

  const only = (rule: RuleId, seed = 7): Vigil => quiet({ rules: [rule] }, seed);

  it('Whispering Glade: a glade opens now and then, and standing in it mends', () => {
    const v = only('glade');
    v.t = 9.9;
    steps(v, 0.3);
    const z = v.zones.find((x) => x.kind === 'glade')!;
    expect(z).toBeTruthy();
    v.me.hp = 20;
    steps(v, 2);
    expect(v.me.hp).toBe(20);
    v.me.x = z.x;
    v.me.y = z.y;
    steps(v, 2);
    expect(v.me.hp).toBeGreaterThan(30);
    steps(v, 14);
    expect(v.zones.length).toBe(0);
  });

  it('Creeping Bramble: thorns show where they will sprout, then cut and slow whoever stands in them', () => {
    const v = only('bramble');
    v.t = 5.9;
    steps(v, 0.3);
    const z = v.zones.find((x) => x.kind === 'bramble')!;
    expect(z).toBeTruthy();
    expect(z.t).toBeLessThan(0);
    v.me.hp = 1000;
    v.me.x = z.x;
    v.me.y = z.y;
    steps(v, 1);
    expect(v.me.hp).toBe(1000);
    steps(v, 1.5);
    expect(v.me.hp).toBeLessThan(1000);
    // slowed: a second of walking in it covers less ground than a second on open land
    const x0 = v.me.x;
    v.step(0.2, { mx: 0, my: 1 });
    const inIt = Math.hypot(v.me.x - x0, v.me.y - z.y);
    const open = quiet();
    const y0 = open.me.y;
    open.step(0.2, { mx: 0, my: 1 });
    expect(inIt).toBeLessThan((open.me.y - y0) * 0.8);
    const foe = put(v, 'walk', z.x + 5, z.y);
    steps(v, 0.2);
    expect(foe.slow).toBeGreaterThan(0);
  });

  it('Loose Stone: rocks fall where the ground is marked, on the Host as surely as the hero', () => {
    const v = only('rockfall');
    v.t = 6.9;
    v.me.hp = 1000;
    steps(v, 0.3);
    expect(v.slams.length).toBe(3);
    const s = v.slams[0]!;
    expect(s.dur).toBeGreaterThan(1);
    // (one of the Host under it too, out of arm's reach of the hero)
    const foe = put(v, 'walk', s.x + 22, s.y);
    foe.speed = 0;
    v.me.x = s.x;
    v.me.y = s.y;
    steps(v, 1);
    expect(v.me.hp).toBe(1000);
    steps(v, 0.6);
    expect(v.me.hp).toBeLessThan(1000);
    expect(foe.hp).toBeLessThan(foe.maxHp * 0.5);
  });

  it('Sucking Mire: bog pools slow whoever wades in, and a dash gets out', () => {
    const v = only('mire');
    const pool = spotsNear(v.seed, 'mire', v.x, v.y, 500)[0]!;
    expect(pool).toBeTruthy();
    expect(v.inMire(pool.x, pool.y)).toBe(true);
    expect(v.inMire(pool.x + pool.r + 4, pool.y)).toBe(false);
    v.me.x = pool.x;
    v.me.y = pool.y;
    v.step(0.1, { mx: 1, my: 0 });
    const waded = v.me.x - pool.x;
    const open = quiet();
    const x0 = open.me.x;
    open.step(0.1, { mx: 1, my: 0 });
    expect(waded).toBeCloseTo((open.me.x - x0) * 0.55, 1);
    v.me.x = pool.x;
    v.step(0.1, { mx: 1, my: 0, dash: true });
    expect(v.me.x - pool.x).toBeGreaterThan(waded * 4);
    // the same pools for the same night, whoever asks
    expect(spotsNear(v.seed, 'mire', v.x, v.y, 500)).toEqual(spotsNear(v.seed, 'mire', v.x, v.y, 500));
    expect(spotsNear(v.seed + 1, 'mire', v.x, v.y, 500)).not.toEqual(spotsNear(v.seed, 'mire', v.x, v.y, 500));
  });

  it('The Tide: far more of the Host while it is in, and it carries the sparks to you as it goes out', () => {
    const came = (rules: RuleId[]): number => {
      const v = new Vigil(31, 2000, 2000, { rules });
      v.me.hp = 1e9;
      inside(v).nextEvent = 1e9;
      v.t = TIDE.from;
      for (let i = 0; i < 30 * 8; i++) {
        v.me.spells = {};
        v.step(DT, STILL);
      }
      return v.foes.length;
    };
    expect(came(['tide'])).toBeGreaterThan(came([]) * 1.4);
    const v = only('tide');
    v.sparks.push({ x: v.x + 900, y: v.y, xp: 1, age: 0, pulled: false, dead: false });
    v.t = TIDE.to - 0.1;
    steps(v, 0.3);
    expect(v.sparks[0]!.pulled).toBe(true);
  });

  it('Mountain Gale: gusts shove a hero the way the arrow says, and not through a dash', () => {
    const v = only('gale');
    v.t = GALE.from + 0.5;
    const a = galeAngle(v.seed, v.t);
    const x0 = v.me.x;
    const y0 = v.me.y;
    steps(v, 1);
    expect(v.me.x - x0).toBeCloseTo(Math.cos(a) * GALE_PUSH, 0);
    expect(v.me.y - y0).toBeCloseTo(Math.sin(a) * GALE_PUSH, 0);
    // between gusts the air is still
    const w = only('gale');
    w.t = 1;
    steps(w, 1);
    expect(w.me.x).toBe(2000);
    expect(w.gale()).toBeNull();
  });

  it('Restless Graves: some of the fallen get up again where they fell, small, and only once', () => {
    const v = only('graves');
    for (let i = 0; i < 200; i++) {
      const f = put(v, 'walk', 2300 + (i % 20) * 12, 2300 + Math.floor(i / 20) * 12);
      f.speed = 0;
      inside(v).hurt(f, f.hp + 1);
    }
    const graves = v.fx.filter((f) => f.kind === 'grave').length;
    expect(graves).toBeGreaterThan(10);
    expect(graves).toBeLessThan(60);
    steps(v, 0.5);
    expect(v.foes.length).toBe(0);
    steps(v, 2.2);
    expect(v.foes.length).toBe(graves);
    expect(v.foes.every((f) => !!f.def.base)).toBe(true);
    for (const f of [...v.foes]) inside(v).hurt(f, f.hp + 1);
    steps(v, 3);
    expect(v.foes.length).toBe(0);
  });

  it('Scouring Wind: in a sandstorm the Host runs faster and sparks have to be walked to', () => {
    const v = only('storm');
    const calm = inside(v).pickupOf(v.me);
    const foe = put(v, 'walk', v.x + 300, v.y);
    const x0 = foe.x;
    steps(v, 1);
    const walked = x0 - foe.x;
    expect(v.storming).toBe(false);
    v.t = STORM.from + 0.5;
    expect(v.storming).toBe(true);
    expect(inside(v).pickupOf(v.me)).toBe(calm / 2);
    const x1 = foe.x;
    steps(v, 1);
    expect(x1 - foe.x).toBeCloseTo(walked * 1.25, 0);
  });

  it('Biting Cold: standing still lets the cold in, and moving shakes it off', () => {
    const v = only('cold');
    v.me.hp = 100;
    steps(v, 2);
    expect(v.me.chill).toBeGreaterThan(0.6);
    expect(v.me.hp).toBe(100);
    steps(v, 2);
    expect(v.me.chill).toBe(1);
    expect(v.me.hp).toBeLessThan(100);
    const hp = v.me.hp;
    steps(v, 1.3, { mx: 1, my: 0 });
    expect(v.me.chill).toBe(0);
    steps(v, 2, { mx: 0, my: 1 });
    expect(v.me.hp).toBeGreaterThan(hp - 2);
  });

  it('Jungle Venom: a wound keeps biting for a few seconds, and meat cures it', () => {
    const v = only('venom');
    v.me.hp = 100;
    v.slams.push({ x: v.x, y: v.y, r: 30, dmg: 20, t: 0.99, dur: 1 });
    v.step(DT, STILL);
    expect(v.me.hp).toBe(80);
    expect(v.me.venom).toBeGreaterThan(3);
    steps(v, 2);
    expect(v.me.hp).toBeLessThan(77);
    expect(v.me.hp).toBeGreaterThan(70);
    v.pickups.push({ kind: 'meat', x: v.x, y: v.y, t: 0, dead: false });
    v.step(DT, STILL);
    expect(v.me.venom).toBe(0);
    // and a venomous pack carries it to any land
    const w = quiet();
    w.me.hp = 1000;
    put(w, 'walk', w.x + 4, w.y, true, TRAIT.venom);
    steps(w, 0.2);
    expect(w.me.venom).toBeGreaterThan(0);
  });

  it('Fire Vents: they warn, erupt on a rhythm, and burn the Host worse than the hero', () => {
    const v = only('vents');
    const vent = spotsNear(v.seed, 'vents', v.x, v.y, 300)[0]!;
    expect(vent).toBeTruthy();
    v.me.hp = 1000;
    v.me.x = vent.x;
    v.me.y = vent.y;
    v.t = VENT_QUIET + 0.1;
    const foe = put(v, 'walk', vent.x + 22, vent.y);
    foe.speed = 0;
    // up to the moment before it goes off, nothing
    const wait = VENT_EVERY - ventClock(vent, v.t);
    steps(v, wait - 0.2);
    expect(v.me.hp).toBe(1000);
    steps(v, 0.4);
    expect(v.me.hp).toBeLessThan(1000);
    expect(foe.hp).toBeLessThanOrEqual(foe.maxHp * 0.5 + 0.01);
    // and nothing erupts in a night's first seconds
    const w = only('vents');
    w.me.hp = 1000;
    const first = spotsNear(w.seed, 'vents', w.x, w.y, 300)[0]!;
    w.me.x = first.x;
    w.me.y = first.y;
    steps(w, VENT_QUIET - 0.2);
    expect(w.me.hp).toBe(1000);
  });

  it('Hollow Light: sparks left lying fade, and only there', () => {
    const v = only('fade');
    v.sparks.push({ x: v.x + 300, y: v.y, xp: 1, age: 0, pulled: false, dead: false });
    steps(v, 8);
    expect(v.sparks.length).toBe(1);
    steps(v, 1.5);
    expect(v.sparks.length).toBe(0);
    const w = quiet();
    w.sparks.push({ x: w.x + 300, y: w.y, xp: 1, age: 0, pulled: false, dead: false });
    steps(w, 12);
    expect(w.sparks.length).toBe(1);
  });

  it('the bot still gets a while in every land: no rule makes a land hopeless', () => {
    for (const map of VIGIL_MAPS) {
      const v = new Vigil(2, 2000, 2000, { map });
      for (let t = 0; t < 6 * 60 && !v.over; t += DT) v.step(DT, bot(v, t));
      expect(v.t, map.id).toBeGreaterThan(45);
    }
  }, 120_000);
});

describe('The Vigil’s return: champions that are fights', () => {
  it('every champion has an attack of its own, and every kind of attack is used somewhere', () => {
    const used = new Set<ChampMove>();
    for (const m of VIGIL_MAPS) {
      for (const c of m.champions) {
        expect(c.move, c.name).toBeTruthy();
        used.add(c.move);
      }
    }
    expect([...used].sort()).toEqual(['call', 'charge', 'rake', 'ring', 'volley']);
  });

  /** A champion of this land beside the hero, having just slammed: its own attack is next. */
  function champion(move: ChampMove): { v: Vigil; boss: Foe } {
    const map = VIGIL_MAPS.find((m) => m.champions.some((c) => c.move === move))!;
    const c = map.champions.find((x) => x.move === move)!;
    const v = quiet({ map });
    v.me.hp = 1000;
    inside(v).addFoe(v.waves[0]!, c.name, c.sprite, { x: v.x + 120, y: v.y });
    const boss = v.foes[0]!;
    boss.cast = 1;
    boss.fireT = 0;
    boss.speed = 0;
    return { v, boss };
  }

  it('a charge is marked for most of a second before it comes, and a step aside is enough', () => {
    const { v, boss } = champion('charge');
    v.step(DT, STILL);
    expect(boss.mode).toBe(1);
    boss.speed = 60;
    steps(v, 0.8);
    expect(boss.mode).toBe(1);
    v.me.y += 80;
    const x0 = boss.x;
    steps(v, 0.7);
    expect(x0 - boss.x).toBeGreaterThan(80);
    expect(v.me.hp).toBe(1000);
  });

  it('a ring blast is safe close in and far out, and lands between', () => {
    const { v, boss } = champion('ring');
    v.step(DT, STILL);
    const s = v.slams[0]!;
    expect(s.inner).toBeGreaterThan(boss.r);
    expect(s.dur).toBeGreaterThan(1);
    expect(v.inSlam(s, boss.x + 5, boss.y)).toBe(false);
    expect(v.inSlam(s, boss.x + 90, boss.y)).toBe(true);
    expect(v.inSlam(s, boss.x + 200, boss.y)).toBe(false);
    // the hero, 120 away, stays: struck
    steps(v, 1.7);
    expect(v.me.hp).toBeLessThan(1000);
  });

  it('a rake is three marked lines from the champion, with room between them', () => {
    const { v, boss } = champion('rake');
    v.step(DT, STILL);
    expect(v.slams.length).toBe(3);
    expect(v.slams.every((s) => (s.len ?? 0) > 150 && s.dur >= 1)).toBe(true);
    const mid = v.slams.find((s) => v.inSlam(s, v.x, v.y))!;
    expect(mid).toBeTruthy();
    // between two of the lines, at the hero's distance
    const between = (v.slams[0]!.a! + v.slams[1]!.a!) / 2;
    expect(v.slams.some((s) => v.inSlam(s, boss.x + Math.cos(between) * 120, boss.y + Math.sin(between) * 120))).toBe(false);
    steps(v, 1.2);
    expect(v.me.hp).toBeLessThan(1000);
  });

  it('a volley is gathered for first, then a ring of shots slow enough to step between', () => {
    const { v, boss } = champion('volley');
    v.step(DT, STILL);
    expect(boss.mode).toBe(4);
    expect(v.foeShots.length).toBe(0);
    steps(v, 1);
    expect(v.foeShots.length).toBe(12);
    expect(Math.hypot(v.foeShots[0]!.vx, v.foeShots[0]!.vy)).toBeLessThan(80);
  });

  it('a call is gathered for first, then small ones run in to its side', () => {
    const { v, boss } = champion('call');
    v.step(DT, STILL);
    expect(boss.mode).toBe(4);
    steps(v, 1);
    const came = v.foes.filter((f) => !f.boss);
    expect(came.length).toBeGreaterThanOrEqual(4);
    expect(came.every((f) => !!f.def.base)).toBe(true);
  });

  it('it takes its slam and its own attack in turn, and felling it counts toward the night’s motes', () => {
    const { v, boss } = champion('ring');
    boss.cast = 0;
    v.step(DT, STILL);
    expect(v.slams.length).toBe(1);
    expect(v.slams[0]!.inner).toBeUndefined();
    steps(v, 4.5);
    expect(v.slams.some((s) => !!s.inner)).toBe(true);
    inside(v).hurt(boss, boss.hp + 1);
    expect(v.feats.champions).toBe(1);
  });
});

describe('The Vigil’s return: what lasts between nights', () => {
  beforeEach(() => localStorage.clear());

  it('a night earns motes for the time held, each champion felled and each event won', () => {
    expect(motesFor(0, { champions: 0, events: 0 })).toBe(0);
    expect(motesFor(29, { champions: 0, events: 0 })).toBe(0);
    expect(motesFor(300, { champions: 1, events: 3 })).toBe(10 + 3 + 6);
    const b = bankNight(300, { champions: 1, events: 3 }, 'mage');
    expect(b.motes).toBe(19);
    expect(readReturns()).toMatchObject({ motes: 19, earned: 19, nights: 1 });
    bankNight(60, { champions: 0, events: 0 }, 'mage');
    expect(readReturns()).toMatchObject({ motes: 21, earned: 21, nights: 2 });
  });

  it('a device from before any of this reads as nothing earned, and broken keeping does no harm', () => {
    // only what the Vigil kept before: its longest nights
    localStorage.setItem('sigilfall.vigil.bests', JSON.stringify({ whisperwood: 400 }));
    expect(readReturns()).toMatchObject({ motes: 0, earned: 0, nights: 0, boons: {}, wilds: [], wild: null, weekly: {} });
    localStorage.setItem('sigilfall.vigil.return', '{not json');
    expect(readReturns().motes).toBe(0);
    expect(cleanReturns({ motes: -5, boons: { hearth: 99, nonsense: 3 }, wilds: ['wolf-pack', 'not-a-spell', 'ember-bolt'], wild: 'ember-bolt', weekly: { 2970: { best: 'x' }, bad: 1 } })).toMatchObject({ motes: 0, earned: 0, nights: 0, boons: { hearth: BOON_MAX }, wilds: ['wolf-pack'], wild: null, weekly: { 2970: { best: 0, cls: '', paid: false } } });
    expect(cleanReturns([1, 2])).toMatchObject({ motes: 0 });
    // and the nights kept before are untouched by it
    expect(JSON.parse(localStorage.getItem('sigilfall.vigil.bests')!)).toEqual({ whisperwood: 400 });
  });

  it('motes buy boons, a rank at a time, each rank dearer, and no further than its top', () => {
    bankNight(30 * 100, { champions: 0, events: 0 }, 'mage');
    expect(readReturns().motes).toBe(100);
    expect(buyBoon('hearth').boons.hearth).toBe(1);
    expect(readReturns().motes).toBe(100 - BOON_COST[0]!);
    buyBoon('hearth');
    buyBoon('hearth');
    expect(readReturns()).toMatchObject({ motes: 100 - 68, boons: { hearth: 3 } });
    expect(buyBoon('hearth').motes).toBe(32);
    // and nothing is sold on credit
    buyBoon('edge');
    buyBoon('edge');
    expect(readReturns().motes).toBe(4);
    expect(buyBoon('stride').boons.stride).toBeUndefined();
    expect(BOON_COST.length).toBe(BOON_MAX);
  });

  it('boons are small, and do what they say in the night', () => {
    const plain = new Vigil(1, 2000, 2000, { cls: 'mage' });
    const kit = cleanKit({ boons: { hearth: 3, edge: 3, stride: 3, lode: 3, rethink: 2 }, wild: null });
    const v = new Vigil(1, 2000, 2000, { cls: 'mage', kits: { 0: kit } });
    expect(v.maxHp).toBeCloseTo(plain.maxHp * 1.12, 5);
    expect(v.hp).toBeCloseTo(v.maxHp, 5);
    expect(v.rerolls).toBe(plain.rerolls + 2);
    const def = firstSpell('mage');
    expect(v.statsOf(v.me, def).dmg).toBeCloseTo(plain.statsOf(plain.me, def).dmg * 1.09, 5);
    expect(inside(v).pickupOf(v.me)).toBe(inside(plain).pickupOf(plain.me) + 24);
    plain.step(0.1, { mx: 1, my: 0 });
    v.step(0.1, { mx: 1, my: 0 });
    expect(v.x - 2000).toBeCloseTo((plain.x - 2000) * 1.06, 3);
    for (const id of BOON_IDS) expect(kit.boons[id]).toBeLessThanOrEqual(BOON_MAX);
    // a kit from anywhere is kept to what the game allows
    expect(cleanKit({ boons: { hearth: 50 }, wild: 'duskblade' })).toEqual({ boons: { hearth: BOON_MAX }, wild: null });
    expect(cleanKit('nonsense')).toEqual({ boons: {}, wild: null });
  });

  it('a wild spell is one from another class, learned once, carried one at a time, and then offered by the cards', () => {
    for (const id of WILD_SPELLS) {
      expect(SPELLS[id], id).toBeTruthy();
      // (none from the class sold in the shop, and never a class's first spell)
      expect(SPELLS[id]!.cls, id).not.toBe('gloamknight');
      expect(firstSpell(SPELLS[id]!.cls).id, id).not.toBe(id);
    }
    expect(new Set(WILD_SPELLS.map((id) => SPELLS[id]!.cls)).size).toBe(WILD_SPELLS.length);
    expect(wildsFor('mage')).not.toContain('chain-spark');
    expect(wildsFor('mage').length).toBe(WILD_SPELLS.length - 1);
    bankNight(30 * (WILD_COST * 2), { champions: 0, events: 0 }, 'mage');
    expect(buyWild('not-a-spell').wilds).toEqual([]);
    expect(buyWild('wolf-pack')).toMatchObject({ wilds: ['wolf-pack'], wild: 'wolf-pack', motes: WILD_COST });
    expect(buyWild('wolf-pack').motes).toBe(WILD_COST);
    expect(buyWild('chain-spark')).toMatchObject({ wild: 'wolf-pack', motes: 0 });
    expect(carryWild('chain-spark').wild).toBe('chain-spark');
    expect(carryWild('moonbeams').wild).toBe('chain-spark');
    // a mage leaves a mage's spell at home; a warrior carries it
    expect(kitOf(readReturns(), 'mage').wild).toBeNull();
    expect(kitOf(readReturns(), 'warrior').wild).toBe('chain-spark');
    expect(carryWild(null).wild).toBeNull();

    // in the night: among a warrior's cards sooner or later, and it fights once taken
    const v = new Vigil(4, 2000, 2000, { cls: 'warrior', kits: { 0: { boons: {}, wild: 'chain-spark' } } });
    const own = new Set(spellsOf('warrior').map((s) => s.id));
    let offered = false;
    for (let i = 0; i < 60 && !offered; i++) {
      v.owed = 1;
      v.me.cards = null;
      v.step(DT, STILL);
      const at = v.cards?.findIndex((c) => c.kind === 'spell' && c.id === 'chain-spark') ?? -1;
      // (everything else offered is the warrior's own)
      for (const c of v.cards ?? []) if (c.kind !== 'strength') expect(own.has(c.id) || c.id === 'chain-spark').toBe(true);
      if (at >= 0) {
        offered = true;
        v.choose(at);
      } else v.reroll();
      v.me.rerolls = 9;
    }
    expect(offered).toBe(true);
    expect(v.spells['chain-spark']).toBe(1);
    v.me.hp = 1e9;
    v.me.cards = null;
    v.owed = 0;
    v.me.spells = { 'chain-spark': 1 };
    for (let i = 0; i < 30 * 12; i++) {
      if (v.cards) v.choose(0);
      v.step(DT, STILL);
    }
    expect(v.kills).toBeGreaterThan(0);
    // without one, nothing but the class's own is ever offered
    const w = new Vigil(4, 2000, 2000, { cls: 'warrior' });
    for (let i = 0; i < 30; i++) {
      w.owed = 1;
      w.me.cards = null;
      w.step(DT, STILL);
      for (const c of w.cards ?? []) if (c.kind !== 'strength') expect(own.has(c.id)).toBe(true);
    }
  });
});

describe('The Vigil’s return: the week’s watch', () => {
  beforeEach(() => localStorage.clear());

  it('weeks begin on Monday at midnight UTC, and each has one seed, one land and one omen for everyone', () => {
    const monday = Date.UTC(2026, 10, 23);
    expect(new Date(monday).getUTCDay()).toBe(1);
    const week = weekOf(monday);
    expect(weekOf(monday - 1)).toBe(week - 1);
    expect(weekOf(monday + 6 * 86_400_000 + 86_399_999)).toBe(week);
    expect(weekOf(monday + 7 * 86_400_000)).toBe(week + 1);
    expect(weekEnds(week)).toBe(monday + 7 * 86_400_000);
    const a = weeklyOf(week);
    expect(weeklyOf(week)).toEqual(a);
    expect(VIGIL_MAPS).toContain(a.map);
    expect(a.omen).not.toBe(a.map.rule);
    expect(a.rules).toEqual([a.map.rule, a.omen]);
    expect(a.seed).toBeGreaterThan(0);
    // over a year of weeks: every land has its turn, and the seeds don't repeat
    const year = Array.from({ length: 52 }, (_, i) => weeklyOf(week + i));
    expect(new Set(year.map((w) => w.seed)).size).toBe(52);
    expect(new Set(year.map((w) => w.map.id)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(year.map((w) => w.omen)).size).toBeGreaterThanOrEqual(8);
  });

  it('the week’s night is the same night for everyone: both its rules, and the same events in the same order', () => {
    const w = weeklyOf(weekOf(Date.UTC(2026, 10, 25)));
    const night = (): Vigil => {
      const v = new Vigil(w.seed, 2000, 2000, { map: w.map, rules: w.rules });
      for (let t = 0; t < 200; t += 1 / 10) {
        v.me.hp = 1e9;
        if (v.cards) v.choose(0);
        v.step(1 / 10, STILL);
      }
      return v;
    };
    const a = night();
    const b = night();
    expect(a.rules).toEqual(w.rules);
    expect(a.eventLog.length).toBeGreaterThanOrEqual(2);
    expect(b.eventLog).toEqual(a.eventLog);
    expect(b.kills).toBe(a.kills);
  });

  it('keeps the best of each week, pays its bounty once, and forgets weeks long gone', () => {
    const week = 2970;
    let b = bankNight(100, { champions: 0, events: 0 }, 'mage', week);
    expect(b).toMatchObject({ motes: 3, bounty: 0, weekBest: 100, newWeekBest: true });
    b = bankNight(WEEKLY_HOLD + 20, { champions: 1, events: 0 }, 'ranger', week);
    expect(b).toMatchObject({ bounty: WEEKLY_BOUNTY, weekBest: WEEKLY_HOLD + 20, newWeekBest: true });
    expect(readReturns().weekly[week]).toEqual({ best: WEEKLY_HOLD + 20, cls: 'ranger', paid: true });
    b = bankNight(WEEKLY_HOLD + 5, { champions: 0, events: 0 }, 'mage', week);
    expect(b).toMatchObject({ bounty: 0, weekBest: WEEKLY_HOLD + 20, newWeekBest: false });
    expect(readReturns().weekly[week]!.cls).toBe('ranger');
    // a night that isn't the week's leaves the week alone
    bankNight(999, { champions: 0, events: 0 }, 'mage');
    expect(readReturns().weekly[week]!.best).toBe(WEEKLY_HOLD + 20);
    bankNight(50, { champions: 0, events: 0 }, 'mage', week + 8);
    expect(Object.keys(readReturns().weekly)).toEqual([String(week + 8)]);
  });
});

describe('The Vigil’s return: a party sees all of it', () => {
  const party = [
    { id: 1, cls: 'mage' as const, name: 'A' },
    { id: 2, cls: 'warrior' as const, name: 'B' },
  ];
  const pair = (o: VigilOptions = {}): { host: Vigil; friend: Vigil; say: () => void } => {
    const host = new Vigil(8, 2000, 2000, { party, ...o });
    host.fxOut = [];
    const friend = new Vigil(8, 2000, 2000, { party, ...o });
    const w = new SnapWriter();
    for (const h of host.heroes) h.hp = 1e9;
    return { host, friend, say: () => applySnap(friend, JSON.parse(JSON.stringify(w.write(host, 1))), 2) };
  };

  it('a friend’s game shows the event, the marked paths, the land’s patches and the blows on their way', () => {
    const { host, friend, say } = pair({ rules: ['bramble', 'cold'] });
    host.t = 5.9;
    inside(host).spawnT = -1e9;
    begin(host, 'run');
    host.slams.push({ x: 2100, y: 2000, r: 150, inner: 40, dmg: 1, t: 0.2, dur: 1.4 }, { x: 2100, y: 2000, r: 0, a: 1.25, len: 230, w: 14, dmg: 1, t: 0, dur: 1, tone: 1 });
    steps(host, 0.5);
    say();
    expect(friend.rules).toEqual(host.rules);
    expect(friend.event).toMatchObject({ kind: 'run' });
    expect(friend.event!.t).toBeCloseTo(host.event!.t, 1);
    expect(friend.lanes.map((l) => [l.x, l.y])).toEqual(host.lanes.map((l) => [Math.round(l.x), Math.round(l.y)]));
    expect(friend.lanes[0]!.a).toBeCloseTo(host.lanes[0]!.a, 1);
    expect(friend.zones.length).toBe(host.zones.length);
    expect(friend.zones[0]).toMatchObject({ kind: 'bramble', r: 30 });
    expect(friend.slams.length).toBe(2);
    expect(friend.slams[0]).toMatchObject({ r: 150, inner: 40 });
    expect(friend.slams[1]).toMatchObject({ len: 230, w: 14, tone: 1 });
    expect(friend.slams[1]!.a).toBeCloseTo(1.25, 2);
    expect(friend.tip?.text).toBe(host.tip?.text);
    // the cold in each hero, and between reports the friend's clocks run on
    expect(friend.heroes[0]!.chill).toBeCloseTo(host.heroes[0]!.chill, 1);
    const t = friend.lanes[0]!.t;
    friend.follow(0.2, 2, STILL);
    expect(friend.lanes[0]!.t).toBeCloseTo(t + 0.2, 5);
  });

  it('and the marked foes: a pack’s trait, a thief, small ones, the heartened, a champion gathering itself', () => {
    const { host, friend, say } = pair({ rules: [] });
    inside(host).spawnT = -1e9;
    inside(host).nextEvent = 1e9;
    for (const h of host.heroes) h.spells = {};
    const husk = put(host, 'split', 2300, 2000);
    put(host, 'rally', 2300, 2100);
    put(host, 'walk', 2310, 2110);
    put(host, 'walk', 2300, 2200, true, TRAIT.stone);
    put(host, 'rush', 2300, 2300, true, TRAIT.thief);
    inside(host).hurt(husk, husk.hp + 1);
    const c = host.map.champions.find((x) => x.move === 'call')!;
    inside(host).addFoe(host.waves[0]!, c.name, c.sprite, { x: 2100, y: 2000 });
    const boss = host.foes[host.foes.length - 1]!;
    boss.cast = 1;
    boss.fireT = 0;
    steps(host, 0.2);
    say();
    expect(friend.foes.length).toBe(host.foes.length);
    const seen = (id: number): Foe => friend.foes.find((f) => f.id === id)!;
    for (const f of host.foes) {
      const o = seen(f.id);
      expect(o.trait, `trait of ${f.id}`).toBe(f.trait);
      expect(!!o.def.base, `small ${f.id}`).toBe(!!f.def.base);
      expect(o.def.ai, `kind of ${f.id}`).toBe(f.def.ai);
      expect(o.rally > 0, `heartened ${f.id}`).toBe(f.rally > 0);
      expect(o.r).toBeCloseTo(f.r, 5);
    }
    expect(friend.foes.filter((f) => !!f.def.base).length).toBe(2);
    expect(friend.foes.some((f) => f.rally > 0)).toBe(true);
    expect(seen(boss.id).mode).toBe(4);
  });

  it('what each keeper carries reaches the host from their own game, once, and shows on everyone’s', () => {
    const { host, friend, say } = pair();
    const kit = cleanKit({ boons: { hearth: 3, rethink: 1 }, wild: 'wolf-pack' });
    const two = host.heroOf(2)!;
    two.hp = host.maxHpOf(two);
    const before = host.maxHpOf(two);
    host.equip(2, kit);
    expect(host.maxHpOf(two)).toBeCloseTo(before * 1.12, 5);
    expect(two.hp).toBeCloseTo(before * 1.12, 5);
    expect(two.rerolls).toBe(4);
    expect(two.wild).toBe('wolf-pack');
    // (said again, as it is in a night's first seconds: nothing more happens)
    host.equip(2, kit);
    expect(two.rerolls).toBe(4);
    say();
    expect(friend.heroOf(2)!.boons).toEqual(kit.boons);
    expect(friend.maxHpOf(friend.heroOf(2)!)).toBeCloseTo(before * 1.12, 5);
    // and not once the night is well under way
    const late = pair().host;
    late.t = 60;
    late.equip(1, kit);
    expect(late.heroOf(1)!.boons).toEqual({});
  });

  it('a party’s reports still fit through the room, in a land full of marks', () => {
    const map = VIGIL_MAPS.find((m) => m.id === 'thornvale')!;
    const four = [1, 2, 3, 4].map((id) => ({ id, cls: 'mage' as const, name: `P${id}` }));
    const v = new Vigil(7, 2000, 2000, { party: four, map, rules: ['bramble', 'rockfall', 'cold'] });
    v.fxOut = [];
    const w = new SnapWriter();
    for (const h of v.heroes) {
      h.hp = 1e12;
      h.spells = { 'ember-bolt': 6, 'frost-ring': 6, meteor: 6 };
    }
    let longest = 0;
    const input = Object.fromEntries(v.heroes.map((h) => [h.id, { mx: 0.3, my: 0.1 }]));
    for (let t = 0; t < 600; t += 1 / 10) {
      for (const h of v.heroes) {
        h.hp = 1e12;
        if (h.cards) v.choose(0, h.id);
      }
      v.step(1 / 10, input);
      if (Math.floor(t * 10) % 20 === 0) longest = Math.max(longest, JSON.stringify(w.write(v, 2)).length);
    }
    expect(v.eventLog.length).toBeGreaterThan(5);
    expect(longest).toBeLessThan(maxMessage);
  }, 60_000);
});
