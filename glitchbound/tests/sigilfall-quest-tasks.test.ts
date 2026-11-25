import { afterEach, describe, expect, it } from 'vitest';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { THINGS } from '../src/games/sigilfall/data/things';
import type { Objective, QuestDef, RegionId } from '../src/games/sigilfall/data/types';
import { questProgress } from '../src/games/sigilfall/progress/character';
import { remoteHit } from '../src/games/sigilfall/sim/combat';
import { circleHitsWall, TILE } from '../src/games/sigilfall/sim/map';
import { questTarget } from '../src/games/sigilfall/sim/objective';
import { anchorOf, bindYielded, channelOf, syncTasks, thingSpots, workOn, YIELD_AT } from '../src/games/sigilfall/sim/tasks';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Quest steps with something in the world to do (sim/tasks.ts): things to act on, something to carry, a place to
 * hold, a trail to follow, a foe to take alive. Each is tried here on a quest made for the test, in a real land.
 */

const LAND: RegionId = 'thornvale';
const FOE = 'bandit-cutthroat';
const made: string[] = [];
/** What each world has told the player (its events are taken off as they are read, as the engine does). */
const seen = new WeakMap<World, string[]>();

afterEach(() => {
  for (const id of made.splice(0)) {
    delete QUEST_DEFS[id];
    const i = QUESTS.findIndex((q) => q.id === id);
    if (i >= 0) QUESTS.splice(i, 1);
  }
});

/** A hero in the land on a quest whose steps `steps` makes from two of the land's places. */
function onQuest(steps: (a: string, b: string) => Objective[], n = 0): { w: World; q: QuestDef; a: string; b: string } {
  const c = readyHero('warrior', 30);
  if (!c.unlocked.includes(LAND)) c.unlocked.push(LAND);
  const probe = newWorld(LAND, c);
  const [a, b] = [probe.spots[0]!.id, probe.spots[1]!.id];
  const list = steps(a, b);
  const q: QuestDef = { id: `test-task-${made.length}-${list[0]!.kind}`, name: 'Test', giver: 'nobody', text: 'A test.', objective: list[0]!, then: list.slice(1), turnIn: false, reward: { xp: 1, gold: 1 } } as QuestDef;
  QUESTS.push(q);
  QUEST_DEFS[q.id] = q;
  made.push(q.id);
  c.quests[q.id] = { state: 'active', n };
  const w = newWorld(LAND, c);
  w.enemies.length = 0;
  syncTasks(w);
  return { w, q, a, b };
}

/** The world goes on for a while; the hero stands where they are, unhurt unless `hurt` says when. */
function run(w: World, seconds: number, hurtAt = -1): void {
  let t = 0;
  for (; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    if (hurtAt >= 0 && t >= hurtAt && t < hurtAt + 1 / 60) w.player.hp -= 20;
    else if (hurtAt < 0) w.player.hp = w.player.maxHp;
    w.player.iframe = 9;
    w.step(1 / 60);
    const list = seen.get(w) ?? [];
    for (const ev of w.events.splice(0)) if (ev.t === 'toast') list.push(ev.text);
    seen.set(w, list);
  }
}

const toasts = (w: World): string[] => seen.get(w) ?? [];

const goTo = (w: World, x: number, y: number): void => {
  w.player.x = x;
  w.player.y = y;
};

const state = (w: World, q: QuestDef): { step: number; n: number; state: string } => ({ step: w.hero.quests[q.id]!.step ?? 0, n: w.hero.quests[q.id]!.n, state: w.hero.quests[q.id]!.state });

describe('Sigilfall: a quest’s things to act on (use)', () => {
  const use = (a: string): Objective[] => [{ kind: 'use', region: LAND, at: a, count: 3, thing: 'nest', verb: 'Burn', label: 'Burn the nests', secs: 1, notes: ['One.', 'Two.', 'Three.'] }, { kind: 'explore', spot: 'nowhere', label: 'Then' }];

  it('stand near the place it names, on clear ground, apart from each other, and in the same spots every time', () => {
    const { w, a } = onQuest(use);
    const at = anchorOf(w, a)!;
    const things = w.tasks.things;
    expect(things).toHaveLength(3);
    for (const t of things) {
      expect(Math.hypot(t.x - at.x, t.y - at.y)).toBeLessThanOrEqual(6 * TILE + 1);
      expect(circleHitsWall(w.map, t.x, t.y, 7)).toBe(false);
      expect(THINGS[t.look].model.length).toBeGreaterThan(2);
    }
    expect(Math.hypot(things[0]!.x - things[1]!.x, things[0]!.y - things[1]!.y)).toBeGreaterThan(30);
    const key = things[0]!.key;
    expect(thingSpots(w, key, at, 3, 6)).toEqual(thingSpots(w, key, at, 3, 6));
    expect(thingSpots(w, key, at, 3, 6).map((t) => [Math.round(t.x), Math.round(t.y)])).toEqual(things.map((t) => [Math.round(t.x), Math.round(t.y)]));
  });

  it('are what the interact button offers, by their own word, and where the quest’s arrow points', () => {
    const { w, q } = onQuest(use);
    const t = w.tasks.things[0]!;
    goTo(w, t.x + 10, t.y);
    run(w, 0.1);
    expect(w.interactable).toMatchObject({ kind: 'thing', id: t.id, label: 'Burn' });
    goTo(w, t.x + 400, t.y);
    const target = questTarget(w, q)!;
    expect(w.tasks.things.some((x) => Math.abs(x.x - target.x) < 1 && Math.abs(x.y - target.y) < 1)).toBe(true);
  });

  it('take a moment of standing there: done, it counts, tells what was found, and stays as the hero left it', () => {
    const { w, q } = onQuest(use);
    const t = w.tasks.things[0]!;
    goTo(w, t.x + 10, t.y);
    workOn(w, t.id);
    run(w, 0.5);
    expect(channelOf(w)?.k).toBeGreaterThan(0.3);
    expect(state(w, q).n).toBe(0);
    run(w, 0.7);
    expect(state(w, q).n).toBe(1);
    expect(t.used).toBe(true);
    expect(toasts(w)).toContain('One.');
    expect(w.tasks.things.filter((x) => !x.used)).toHaveLength(2);
  });

  it('a blow taken breaks it off, and so does walking away', () => {
    const { w, q } = onQuest(use);
    const t = w.tasks.things[0]!;
    goTo(w, t.x + 10, t.y);
    workOn(w, t.id);
    run(w, 0.9, 0.4);
    expect(channelOf(w)).toBeNull();
    expect(state(w, q).n).toBe(0);
    w.player.hp = w.player.maxHp;
    workOn(w, t.id);
    run(w, 0.3);
    goTo(w, t.x + 200, t.y);
    run(w, 1);
    expect(state(w, q).n).toBe(0);
  });

  it('all of them done, the quest goes on to its next step; a hero who comes back part-way finds only what is left', () => {
    const { w, q } = onQuest(use);
    for (let i = 0; i < 3; i++) {
      const t = w.tasks.things.find((x) => !x.used)!;
      goTo(w, t.x + 8, t.y);
      workOn(w, t.id);
      run(w, 1.2);
    }
    expect(state(w, q)).toMatchObject({ step: 1, n: 0 });
    expect(w.tasks.things.filter((x) => !x.used)).toHaveLength(0);
    const back = onQuest(use, 2).w.tasks.things;
    expect(back).toHaveLength(1);
    expect(back[0]!.idx).toBe(2);
  });

  it('may be guarded, and may spring an ambush at the middle one and the last', () => {
    const { w } = onQuest((a) => [{ kind: 'use', region: LAND, at: a, count: 3, thing: 'crate', verb: 'Search', label: 'Search', secs: 0.2, guards: [FOE], ambush: [FOE, FOE] }]);
    expect(w.enemies.filter((e) => !e.dead)).toHaveLength(3);
    const before = w.enemies.length;
    const t = w.tasks.things[0]!;
    goTo(w, t.x + 8, t.y);
    workOn(w, t.id);
    run(w, 0.4);
    expect(w.enemies.length).toBe(before);
    const t2 = w.tasks.things.find((x) => !x.used)!;
    goTo(w, t2.x + 8, t2.y);
    workOn(w, t2.id);
    run(w, 0.4);
    expect(w.enemies.length).toBe(before + 2);
  });
});

describe('Sigilfall: something carried from one place to another (carry)', () => {
  const carry = (a: string, b: string): Objective[] => [{ kind: 'carry', region: LAND, from: a, to: b, thing: 'sack', verb: 'Take the grain', label: 'Carry the grain', ambush: [[FOE], [FOE]] }];

  it('is taken up where it lies, the arrow then leads to where it goes, and whoever wants it comes on the way', () => {
    const { w, q, b } = onQuest(carry);
    const t = w.tasks.things[0]!;
    expect(t.role).toBe('take');
    goTo(w, t.x + 8, t.y);
    workOn(w, t.id);
    run(w, 0.8);
    expect(w.tasks.carrying?.look).toBe('sack');
    const to = anchorOf(w, b)!;
    const target = questTarget(w, q)!;
    expect(Math.hypot(target.x - to.x, target.y - to.y)).toBeLessThan(2);
    goTo(w, (t.x + to.x) / 2, (t.y + to.y) / 2);
    run(w, 0.1);
    expect(w.enemies.filter((e) => !e.dead).length).toBeGreaterThanOrEqual(1);
    goTo(w, to.x + 6, to.y);
    run(w, 0.1);
    expect(state(w, q).state).toBe('done');
    expect(w.tasks.carrying).toBeNull();
  });

  it('is back where it was if the hero falls with it', () => {
    const { w, q } = onQuest(carry);
    const t = w.tasks.things[0]!;
    goTo(w, t.x + 8, t.y);
    workOn(w, t.id);
    run(w, 0.8);
    w.player.dead = true;
    w.step(1 / 60);
    expect(w.tasks.carrying).toBeNull();
    expect(w.tasks.things.some((x) => x.role === 'take' && !x.used)).toBe(true);
    expect(state(w, q).state).toBe('active');
  });
});

describe('Sigilfall: a place held (hold)', () => {
  const hold = (a: string): Objective[] => [{ kind: 'hold', region: LAND, at: a, secs: 6, waves: [[FOE], [FOE, FOE]], label: 'Hold the well' }];

  it('counts its seconds only while the hero stands in it, brings its waves through the time, and is then done', () => {
    const { w, q, a } = onQuest(hold);
    const at = anchorOf(w, a)!;
    goTo(w, at.x + 400, at.y);
    run(w, 2);
    expect(state(w, q).n).toBe(0);
    expect(w.enemies).toHaveLength(0);
    goTo(w, at.x + 10, at.y);
    run(w, 2.2);
    expect(state(w, q).n).toBe(2);
    expect(questProgress(w.hero, q).of).toBe(6);
    expect(w.enemies.length).toBe(1);
    // (the wolves are let be: this is the clock's test)
    w.enemies.length = 0;
    goTo(w, at.x + 10, at.y);
    run(w, 4.2);
    expect(state(w, q).state).toBe('done');
    expect(w.tasks.hold).toBeNull();
  });
});

describe('Sigilfall: a trail followed (trail)', () => {
  const trail = (a: string, b: string): Objective[] => [{ kind: 'trail', region: LAND, from: a, to: b, marks: 3, notes: ['Blood on the grass.', 'A torn strap.', 'The den.'], label: 'Follow the tracks' }, { kind: 'kill', region: LAND, count: 1, enemies: [FOE], label: 'Kill it', lair: { at: b, enemies: [FOE] } }];

  it('shows one mark at a time, each read by walking onto it, toward where it ends; the quarry waits there', () => {
    const { w, q, a, b } = onQuest(trail);
    const from = anchorOf(w, a)!;
    const to = anchorOf(w, b)!;
    let last = Math.hypot(from.x - to.x, from.y - to.y) + 4 * TILE;
    for (let i = 0; i < 3; i++) {
      const marks = w.tasks.things.filter((t) => t.role === 'mark' && !t.used);
      expect(marks).toHaveLength(1);
      const m = marks[0]!;
      const left = Math.hypot(m.x - to.x, m.y - to.y);
      expect(left).toBeLessThan(last);
      last = left;
      expect(w.enemies).toHaveLength(0);
      goTo(w, m.x + 4, m.y);
      run(w, 0.1);
    }
    expect(toasts(w)).toEqual(['Blood on the grass.', 'A torn strap.', 'The den.']);
    expect(state(w, q)).toMatchObject({ step: 1 });
    run(w, 0.4);
    expect(w.enemies.filter((e) => e.def.id === FOE)).toHaveLength(1);
    expect(Math.hypot(w.enemies[0]!.x - to.x, w.enemies[0]!.y - to.y)).toBeLessThan(4 * TILE);
  });
});

describe('Sigilfall: a foe taken alive (subdue)', () => {
  const subdue = (): Objective[] => [{ kind: 'subdue', region: LAND, enemies: [FOE], count: 1, verb: 'Bind', label: 'Take a wolf alive' }];

  it('yields when beaten low instead of dying, takes no more harm, and is bound by the hero: that is what counts', () => {
    const { w, q } = onQuest(subdue);
    const e = w.addEnemy(FOE, w.player.x + 20, w.player.y, 10, { room: -1, pack: -1, post: true });
    const other = w.addEnemy(FOE, w.player.x + 300, w.player.y, 10, { room: -1, pack: -1, post: true });
    remoteHit(w, e, e.maxHp * 5, 0, 0);
    remoteHit(w, other, other.maxHp * 5, 0, 0);
    expect(e.dead).toBe(false);
    expect(e.yielded).toBe(true);
    expect(e.hp).toBeLessThanOrEqual(Math.max(1, Math.round(e.maxHp * YIELD_AT)));
    const hp = e.hp;
    remoteHit(w, e, e.maxHp, 0, 0);
    expect(e.hp).toBe(hp);
    run(w, 0.1);
    expect(w.interactable).toMatchObject({ kind: 'yield', id: e.id, label: 'Bind' });
    expect(state(w, q).n).toBe(0);
    bindYielded(w, e.id);
    expect(e.dead).toBe(true);
    expect(state(w, q).state).toBe('done');
    // the step over, the other that yielded is itself again
    expect(other.yielded).toBe(false);
    expect(other.held).toBe(false);
  });

  it('a foe the quest does not name dies as it always did', () => {
    const { w } = onQuest(subdue);
    const e = w.addEnemy('moss-slime', w.player.x + 20, w.player.y, 10, { room: -1, pack: -1, post: true });
    remoteHit(w, e, e.maxHp * 5, 0, 0);
    expect(e.yielded).toBeFalsy();
    expect(e.hp).toBeLessThanOrEqual(0);
  });
});
