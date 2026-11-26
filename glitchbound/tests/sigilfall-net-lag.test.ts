/**
 * Sigilfall's party fights between faraway friends (from Bulgaria to Portugal and back is 100 ms and more, through the
 * room): a guest is struck only where their hero really was (net/coop.ts HitShape, struckAt), the bars of the host's
 * enemies never climb back between a guest's hits, and the party's ping is the round trip between the two games.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { SLOTS, type ClassId } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';
import { SIGILS } from '../src/games/sigilfall/progress/character';
import { rollGear } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { CoopSession, struckAt } from '../src/games/sigilfall/net/coop';
import type * as room from '../src/games/sigilfall/net/room';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { World } from '../src/games/sigilfall/sim/world';
import { pingTone } from '../src/games/sigilfall/net/ping';
import { ackFor, LATE_MOST, LatePresses, SeatInputs, SelfSync } from '../src/games/sigilfall/net/selfSync';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { Match, PACE, type FighterSetup, type MoveInput, type Snapshot } from '../src/games/sigilfall/arena/sim';
import { Vigil, type VigilInput } from '../src/games/sigilfall/vigil/sim';
import { applySnap, SnapWriter } from '../src/games/sigilfall/vigil/snapshot';
import { readyHero } from './sigilfall-bot';

function hero(cls: ClassId) {
  const h = readyHero(cls, 60, 'epic');
  const r = rng(11);
  for (const s of SLOTS) h.equip[s] = rollGear(cls, 72, 'epic', r, s);
  for (const s of SIGILS) if (!h.perks.includes(s)) h.perks.push(s);
  for (const id of Object.keys(QUEST_DEFS)) h.quests[id] = { state: 'done', n: 0 };
  h.keystone = 5;
  h.potions = 5;
  return h;
}

const card = (name: string, cls: ClassId): room.Card => ({ name, cls, level: 60, para: 0, keystone: 5, story: 200, look: { any: true }, weapon: { kind: 'staff' } });

/** A host's and a guest's game in one Riftstone run, joined through a room that holds every message `lag` frames each way (in order). */
function farPair(lag: number) {
  const hw = new World({ region: 'crypt', tier: 2, mods: [], hero: hero('warrior'), settings: { ...DEFAULT_SETTINGS }, seed: 7, key: 2, affixes: [], handIns: false, coop: 'host' });
  const gw = new World({ region: 'crypt', tier: 2, mods: [], hero: hero('mage'), settings: { ...DEFAULT_SETTINGS }, seed: 7, key: 2, affixes: [], handIns: false, coop: 'guest' });
  let frame = 0;
  const queue: { at: number; to: CoopSession; n: number; d: unknown }[] = [];
  const to: { hs?: CoopSession; gs?: CoopSession } = {};
  const hs = new CoopSession('host', 1, 1, (d) => queue.push({ at: frame + lag, to: to.gs!, n: 1, d: JSON.parse(JSON.stringify(d)) }));
  const gs = new CoopSession('guest', 2, 1, (d) => queue.push({ at: frame + lag, to: to.hs!, n: 2, d: JSON.parse(JSON.stringify(d)) }));
  to.hs = hs;
  to.gs = gs;
  const members = [{ n: 1, card: card('Ash', 'warrior') }, { n: 2, card: card('Bea', 'mage') }];
  hs.setMembers(members);
  gs.setMembers(members);
  hs.attach(hw);
  gs.attach(gw);
  const step = (frames = 1, each?: () => void): void => {
    for (let i = 0; i < frames; i++) {
      frame += 1;
      each?.();
      hw.step(1 / 60);
      gw.step(1 / 60);
      hs.frame(1000 / 60);
      gs.frame(1000 / 60);
      while (queue.length && queue[0]!.at <= frame) {
        const m = queue.shift()!;
        m.to.receive(m.n, m.d);
      }
    }
  };
  return { hw, gw, hs, gs, step };
}

/** A circle that lands where the host's game last saw the guest, `dur` seconds from now. */
function circleOnGuest(hw: World, dur: number): void {
  const g = hw.coop!.ghosts[0]!;
  hw.addTelegraph({ shape: 'circle', x: g.x, y: g.y, r: 30, r2: 0, angle: 0, len: 0, dur, dmg: 400, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
}

/** 100 ms each way: six frames. */
const FAR = 6;

describe('sigilfall: a faraway guest is struck where they really are', () => {
  it('a guest who stepped out of a circle on their own screen is not struck by it', () => {
    const { hw, gw, step } = farPair(FAR);
    step(180);
    expect(gw.player.iframe).toBe(0);
    expect(hw.coop!.ghosts[0]!.confirms).toBe(true);
    const hp = gw.player.hp;
    circleOnGuest(hw, 0.8);
    // the guest sees it come (later than the host) and walks out of it a quarter of a second before it lands on their
    // screen: the host's copy of them, a round trip behind, is still standing in it when it lands there
    step(42);
    gw.player.x += 90;
    step(60);
    expect(gw.player.hp).toBeGreaterThanOrEqual(hp);
  });

  it('a guest who stays in the circle is struck, through their own defenses', () => {
    const { hw, gw, step } = farPair(FAR);
    step(180);
    const hp = gw.player.hp;
    circleOnGuest(hw, 0.8);
    step(90);
    expect(gw.player.hp).toBeLessThan(hp);
  });

  it('the host still sends a blow the guest walked into at the last moment (its copy of them is behind)', () => {
    const { hw, gw, step } = farPair(FAR);
    step(180);
    const g = hw.coop!.ghosts[0]!;
    // the circle lands just beside where the host's copy stands; the guest steps into it on their own screen
    hw.addTelegraph({ shape: 'circle', x: g.x + 40, y: g.y, r: 22, r2: 0, angle: 0, len: 0, dur: 0.5, dmg: 400, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    const hp = gw.player.hp;
    step(12);
    gw.player.x += 40;
    step(60);
    expect(gw.player.hp).toBeLessThan(hp);
  });

  it('a guest who rolled through a blow a moment ago is not struck by it', () => {
    const { hw, gw, step } = farPair(FAR);
    step(180);
    const hp = gw.player.hp;
    circleOnGuest(hw, 0.6);
    // the guest rolls as it lands on their screen; the roll is over by the time the host's word arrives
    step(32);
    gw.player.iframe = 0.1;
    step(40);
    expect(gw.player.hp).toBeGreaterThanOrEqual(hp);
  });

  it('a host enemy’s bar never climbs back between the guest’s hits while the host catches up', () => {
    const { hw, gw, step } = farPair(FAR);
    step(20);
    const enc = hw.encounters.findIndex((e) => !e.def.boss);
    const tiles = (hw.map.roomTiles[enc] ?? []).filter((i) => !hw.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    hw.player.x = ((i % hw.map.w) + 0.5) * TILE;
    hw.player.y = (Math.floor(i / hw.map.w) + 0.5) * TILE;
    hw.player.iframe = 99;
    gw.player.iframe = 99;
    step(160);
    const target = hw.enemies.find((e) => !e.dead && !e.boss)!;
    expect(target).toBeTruthy();
    const copy = gw.enemyById(target.id)!;
    const start = copy.hp;
    // a light hit every few frames: on the guest's screen the bar dips at once and never climbs back between them
    let climbed = 0;
    for (let k = 0; k < 20 && !copy.dead && !target.dead; k++) {
      hitEnemy(gw, copy, 2, 'arcane', { depth: 0 });
      let last = copy.hp;
      for (let f = 0; f < 4; f++) {
        step(1);
        if (copy.hp > last + 0.5) climbed += 1;
        last = copy.hp;
      }
    }
    expect(copy.hp).toBeLessThan(start);
    expect(climbed).toBe(0);
    // and once the host has every hit, both bars agree
    step(40);
    expect(Math.abs(copy.hp - target.hp)).toBeLessThan(target.maxHp * 0.02);
  });

  it('the party’s ping is the round trip between the two games: each player’s own leg to the room, added', () => {
    const { hs, gs, step } = farPair(1);
    expect(gs.ping).toBe(0);
    hs.setRtt(40);
    gs.setRtt(70);
    step(10);
    expect(gs.ping).toBe(110);
    expect(hs.ping).toBe(110);
    expect(pingTone(80)).toBe('good');
    expect(pingTone(180)).toBe('fair');
    expect(pingTone(300)).toBe('poor');
  });
});

describe('sigilfall: what struck, checked on the guest’s side (struckAt)', () => {
  it('reads every shape the host sends, by the host’s own measure', () => {
    // a circle on the ground counts half the hero's size
    expect(struckAt(['t', 'circle', 0, 0, 30, 0, 0, 0], 34, 0, 10)).toBe(true);
    expect(struckAt(['t', 'circle', 0, 0, 30, 0, 0, 0], 36, 0, 10)).toBe(false);
    // a ring: not in its hole
    expect(struckAt(['t', 'donut', 0, 0, 60, 30, 0, 0], 10, 0, 10)).toBe(false);
    expect(struckAt(['t', 'donut', 0, 0, 60, 30, 0, 0], 45, 0, 10)).toBe(true);
    // a line, and a cone
    expect(struckAt(['t', 'line', 0, 0, 0, 20, 0, 100], 50, 8, 10)).toBe(true);
    expect(struckAt(['t', 'line', 0, 0, 0, 20, 0, 100], 50, 30, 10)).toBe(false);
    expect(struckAt(['t', 'cone', 0, 0, 80, 0.5, 0, 0], 40, 5, 10)).toBe(true);
    expect(struckAt(['t', 'cone', 0, 0, 80, 0.5, 0, 0], -40, 0, 10)).toBe(false);
    // a shot: along its way, a little either side of where it was seen
    expect(struckAt(['s', 0, 0, 300, 0, 5], 60, 4, 10)).toBe(true);
    expect(struckAt(['s', 0, 0, 300, 0, 5], 60, 30, 10)).toBe(false);
    // a shockwave passing over where the hero is, close in time
    expect(struckAt(['w', 0, 0, 100, 16, 200], 130, 0, 10)).toBe(true);
    expect(struckAt(['w', 0, 0, 100, 16, 200], 300, 0, 10)).toBe(false);
    // burning ground
    expect(struckAt(['f', 0, 0, 40], 44, 0, 10)).toBe(true);
    expect(struckAt(['f', 0, 0, 40], 60, 0, 10)).toBe(false);
    // a swing in front of a foe, and a slam all round it
    expect(struckAt(['m', 0, 0, 30, 0, 1.1, 1], 35, 0, 10)).toBe(true);
    expect(struckAt(['m', 0, 0, 30, 0, 1.1, 1], -35, 0, 10)).toBe(false);
    expect(struckAt(['m', 0, 0, 30, 0, 0, 0.5], 0, -33, 10)).toBe(true);
    expect(struckAt(['m', 0, 0, 30, 0, 0, 0.5], 0, -40, 10)).toBe(false);
  });

  it('a shape it can’t read leaves the host’s word standing', () => {
    expect(struckAt(0, 0, 0, 10)).toBeNull();
    expect(struckAt(['t', 'circle', 'x', 0, 30, 0, 0, 0], 0, 0, 10)).toBeNull();
    expect(struckAt(['q', 1, 2], 0, 0, 10)).toBeNull();
    expect(struckAt(['m', 0, 0, Infinity, 0, 0, 1], 0, 0, 10)).toBeNull();
  });
});

/**
 * A Ring match between a host's game and a guest's, through a room that holds every message `lag` frames each way, as
 * ui/RingMatch.tsx runs it: the guest runs back and forth, and `drift` is how far its own hero ever is from where its
 * own moves alone would have it (a third copy that only ever coasts). `sync: false` plays it as before 2026-11-26.
 */
function ringRun(lag: number, sync: boolean, jitter = 0) {
  const r = rng(5);
  // (each message held a little longer at random, in order still, as the room keeps them)
  let lastHost = 0;
  let lastGuest = 0;
  const later = (prev: number): number => Math.max(prev, frame + lag + Math.floor(r() * (jitter + 1)));
  const f = (team: 0 | 1, cls: 'warrior' | 'mage', seat: number): FighterSetup => ({ team, cls, name: cls, bar: PRESETS[cls][0]!.bar, seat });
  const setup = { seed: 1, map: 'sands', gates: 0.05, fighters: [f(0, 'warrior', 1), f(1, 'mage', 2)] };
  const host = new Match(setup);
  const guest = new Match(setup);
  const alone = new Match(setup);
  const ME = 1;
  const self = sync ? new SelfSync() : null;
  const heard = new SeatInputs();
  let frame = 0;
  const toHost: { at: number; d: { mx: number; my: number; q?: number } }[] = [];
  const toGuest: { at: number; d: { s: Snapshot; ak?: unknown } }[] = [];
  let hostMove: MoveInput = { mx: 0, my: 0 };
  let sendT = 0;
  let hostT = 0;
  let lastSent = '';
  const dt = 1 / 60;
  let drift = 0;
  const tick = (input: MoveInput, measure: boolean): void => {
    frame += 1;
    const now = frame * 1000 * dt;
    // the host's game
    while (toHost.length && toHost[0]!.at <= frame) {
      const d = toHost.shift()!.d;
      hostMove = { mx: d.mx, my: d.my };
      heard.heard(ME, d.q, now);
    }
    host.step(dt * PACE, { 0: { mx: 0, my: 0 }, [ME]: hostMove });
    hostT += dt;
    if (hostT >= 0.05) {
      hostT = 0;
      lastGuest = later(lastGuest);
      toGuest.push({ at: lastGuest, d: JSON.parse(JSON.stringify({ s: host.snapshot(), ...(sync ? { ak: heard.acks(now) } : {}) })) });
    }
    // the guest's game
    while (toGuest.length && toGuest[0]!.at <= frame) {
      const d = toGuest.shift()!.d;
      const ack = self ? ackFor(d.ak, ME) : null;
      guest.restore(d.s, ME, !!ack);
      if (ack) self!.correct(ack[1], ack[2], d.s.f[ME]!.x, d.s.f[ME]!.y, guest.fighters[ME]!);
    }
    guest.coast(dt * PACE, ME, input);
    if (self) self.frame(now, dt, guest.fighters[ME]!);
    alone.coast(dt * PACE, ME, input);
    sendT += dt;
    const said = `${input.mx},${input.my}`;
    if (sync ? (sendT >= 1 / 30 && said !== lastSent) || sendT >= 0.5 : sendT >= 1 / 15 && said !== lastSent) {
      sendT = 0;
      lastSent = said;
      lastHost = later(lastHost);
      toHost.push({ at: lastHost, d: { mx: input.mx, my: input.my, ...(self ? { q: self.stamp(now) } : {}) } });
    }
    if (measure) drift = Math.max(drift, Math.hypot(guest.fighters[ME]!.x - alone.fighters[ME]!.x, guest.fighters[ME]!.y - alone.fighters[ME]!.y));
  };
  // the gates open, and everyone settles
  for (let i = 0; i < 60; i++) tick({ mx: 0, my: 0 }, false);
  alone.fighters[ME]!.x = guest.fighters[ME]!.x;
  alone.fighters[ME]!.y = guest.fighters[ME]!.y;
  // back and forth, with stops
  for (let rep = 0; rep < 4; rep++) {
    for (let i = 0; i < 48; i++) tick({ mx: 0, my: rep % 2 ? -1 : 1 }, true);
    for (let i = 0; i < 18; i++) tick({ mx: 0, my: 0 }, true);
  }
  // still, until the last word is in
  for (let i = 0; i < 60; i++) tick({ mx: 0, my: 0 }, false);
  const gap = Math.hypot(guest.fighters[ME]!.x - host.fighters[ME]!.x, guest.fighters[ME]!.y - host.fighters[ME]!.y);
  return { drift, gap, phase: host.phase };
}

describe('sigilfall: a faraway guest’s own hero in the Ring isn’t dragged back', () => {
  it('running and stopping, it stays where the guest’s own moves put it, and ends where the host’s game has it', () => {
    const now = ringRun(FAR, true);
    const before = ringRun(FAR, false);
    expect(now.phase).toBe('fight');
    // before: pulled toward the host's old place for it all the time (several strides' worth, from this far)
    expect(before.drift).toBeGreaterThan(8);
    // now: within a few points of its own moves, the little the host's game takes later to hear a change
    expect(now.drift).toBeLessThan(before.drift / 2);
    expect(now.drift).toBeLessThan(5);
    expect(now.gap).toBeLessThan(1);
    // and on a connection that wavers by up to 50 ms
    const shaky = ringRun(FAR, true, 3);
    expect(shaky.drift).toBeLessThan(ringRun(FAR, false, 3).drift / 2);
    expect(shaky.gap).toBeLessThan(1);
  });

  it('a large difference the host’s game made (a knock, a pull) is made good at once; a small one eased in', () => {
    const s = new SelfSync();
    const hero = { x: 0, y: 0 };
    let t = 0;
    const q = s.stamp(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      hero.x += 1;
      s.frame(t, 0.016, hero);
    }
    // the host says: at the moment it had move q for 100 ms the hero was 3 points further on than here (eased in)
    const at = s.correct(q, 100, 6.25 + 3, 0, hero)!;
    expect(at.x).toBeCloseTo(3, 0);
    const x0 = hero.x;
    s.frame(t + 16, 0.016, hero);
    expect(hero.x - x0).toBeGreaterThan(0);
    expect(hero.x - x0).toBeLessThan(3);
    // and later, thrown 100 points aside: at once
    const big = s.correct(q, 300, 400, 0, hero)!;
    expect(big.x).toBeGreaterThan(64);
    expect(hero.x).toBeGreaterThan(100);
    // an input it never stamped: nothing
    expect(s.correct(999, 0, 0, 0, hero)).toBeNull();
  });

  it('the host’s word says only the latest input from each seat and how long it has had it', () => {
    const h = new SeatInputs();
    h.heard(2, 5, 1000);
    h.heard(2, 4, 1100);
    h.heard(3, 'x', 1100);
    expect(h.acks(1250)).toEqual([[2, 5, 250]]);
    expect(ackFor([[2, 5, 250]], 2)).toEqual([2, 5, 250]);
    expect(ackFor([[2, 5, 250]], 3)).toBeNull();
    expect(ackFor(undefined, 2)).toBeNull();
  });
});

/**
 * A Vigil night between a host's game and a guest's, as ui/VigilScreen.tsx runs it (the host's word six times a second),
 * through a room holding every message `lag` frames each way: the guest's keeper runs back and forth, and `drift` is how
 * far it ever is from where its own moves alone would have it. The Host's crowd is kept off, so only the moving counts.
 */
function vigilRun(lag: number, sync: boolean, jitter = 0) {
  const party = [{ id: 1, cls: 'mage' as const, name: 'A' }, { id: 2, cls: 'warrior' as const, name: 'B' }];
  const host = new Vigil(8, 2000, 2000, { party });
  host.fxOut = [];
  const guest = new Vigil(8, 2000, 2000, { party });
  const alone = new Vigil(8, 2000, 2000, { party });
  const ME = 2;
  const r = rng(9);
  const self = sync ? new SelfSync() : null;
  const heard = new SeatInputs();
  const writer = new SnapWriter();
  const toHost: { at: number; i: number[]; q?: number }[] = [];
  const toGuest: { at: number; d: { s: unknown; ak?: unknown } }[] = [];
  const inputs: Record<number, VigilInput> = { 1: { mx: 0, my: 0, dash: false }, 2: { mx: 0, my: 0, dash: false } };
  let frame = 0;
  let lastHost = 0;
  let lastGuest = 0;
  let sentAt = -1e9;
  let snapAt = -1e9;
  let lastSaid = '';
  let drift = 0;
  let synced = false;
  const dt = 1 / 60;
  const later = (prev: number): number => Math.max(prev, frame + lag + Math.floor(r() * (jitter + 1)));
  const me = (v: Vigil) => v.heroOf(ME)!;
  const tick = (input: VigilInput, measure: boolean): void => {
    frame += 1;
    const now = frame * 1000 * dt;
    for (const v of [host, guest, alone]) for (const h of v.heroes) h.hp = 1e9;
    host.foes = [];
    while (toHost.length && toHost[0]!.at <= frame) {
      const m = toHost.shift()!;
      inputs[ME] = { mx: m.i[0]!, my: m.i[1]!, dash: false };
      heard.heard(ME, m.q, now);
    }
    for (const h of host.heroes) if (h.cards) host.choose(0, h.id);
    host.step(dt, inputs);
    if (now - snapAt > 166) {
      snapAt = now;
      lastGuest = later(lastGuest);
      toGuest.push({ at: lastGuest, d: JSON.parse(JSON.stringify({ s: writer.write(host, 0.166), ...(sync ? { ak: heard.acks(now) } : {}) })) });
    }
    while (toGuest.length && toGuest[0]!.at <= frame) {
      const d = toGuest.shift()!.d;
      applySnap(guest, d.s as Parameters<typeof applySnap>[1], ME);
      const ack = self ? ackFor(d.ak, ME) : null;
      synced = !!ack;
      if (ack) self!.correct(ack[1], ack[2], me(guest).tx, me(guest).ty, me(guest));
    }
    for (const h of guest.heroes) h.cards = null;
    guest.follow(dt, ME, input, synced);
    if (self) self.frame(now, dt, me(guest));
    for (const h of alone.heroes) h.cards = null;
    alone.follow(dt, ME, input, true);
    const i = [input.mx, input.my, 0];
    const said = i.join(',');
    if (sync ? (now - sentAt > 33 && said !== lastSaid) || now - sentAt > 66 : now - sentAt > 66) {
      sentAt = now;
      lastSaid = said;
      lastHost = later(lastHost);
      toHost.push({ at: lastHost, i, ...(self ? { q: self.stamp(now) } : {}) });
    }
    if (measure) drift = Math.max(drift, Math.hypot(me(guest).x - me(alone).x, me(guest).y - me(alone).y));
  };
  for (let k = 0; k < 60; k++) tick({ mx: 0, my: 0, dash: false }, false);
  me(alone).x = me(guest).x;
  me(alone).y = me(guest).y;
  for (let rep = 0; rep < 4; rep++) {
    for (let k = 0; k < 48; k++) tick({ mx: rep % 2 ? -1 : 1, my: 0, dash: false }, true);
    for (let k = 0; k < 18; k++) tick({ mx: 0, my: 0, dash: false }, true);
  }
  for (let k = 0; k < 60; k++) tick({ mx: 0, my: 0, dash: false }, false);
  return { drift, gap: Math.hypot(me(guest).x - me(host).x, me(guest).y - me(host).y) };
}

describe('sigilfall: a faraway guest’s keeper in the Vigil isn’t dragged back', () => {
  it('running and stopping, it stays where the guest’s own moves put it, and ends where the host’s game has it', () => {
    const before = vigilRun(FAR, false);
    const now = vigilRun(FAR, true);
    expect(before.drift).toBeGreaterThan(8);
    expect(now.drift).toBeLessThan(before.drift / 2);
    expect(now.gap).toBeLessThan(1);
    const shaky = vigilRun(FAR, true, 3);
    expect(shaky.drift).toBeLessThan(vigilRun(FAR, false, 3).drift / 2);
    expect(shaky.gap).toBeLessThan(1);
  });
});

describe('sigilfall: a faraway guest’s press in the Ring shows at once', () => {
  const opened = () => {
    const f = (team: 0 | 1, cls: 'warrior' | 'mage', seat: number): FighterSetup => ({ team, cls, name: cls, bar: PRESETS[cls][0]!.bar, seat });
    const setup = { seed: 1, map: 'sands', gates: 0.05, fighters: [f(0, 'warrior', 1), f(1, 'mage', 2)] };
    const host = new Match(setup);
    const guest = new Match(setup);
    for (let i = 0; i < 20; i++) host.step((1 / 60) * PACE, {});
    // face to face, in reach of anything
    host.fighters[0]!.x = host.fighters[1]!.x + 40;
    host.fighters[0]!.y = host.fighters[1]!.y;
    host.setTarget(1, 0);
    guest.restore(JSON.parse(JSON.stringify(host.snapshot())), 1, true);
    const me = guest.fighters[1]!;
    const slow = me.bar.map((id) => ABILITIES[id]!).find((ab) => guest.castOf(me, ab) > 0 && !ab.free && ab.aim !== 'ground')!;
    return { host, guest, me, slow };
  };

  it('the cast bar and the global cooldown start on the guest’s screen, and stand until the host’s word has the press', () => {
    const { host, guest, me, slow } = opened();
    expect(host.phase).toBe('fight');
    expect(slow).toBeTruthy();
    guest.foretell(1, slow.id, undefined, 0.6);
    expect(me.cast?.ab).toBe(slow.id);
    expect(me.gcd).toBeGreaterThan(0);
    // a word from before the host heard it leaves it be
    guest.coast(0.05, 1, null);
    guest.restore(JSON.parse(JSON.stringify(host.snapshot())), 1, true);
    expect(me.cast?.ab).toBe(slow.id);
    // the host has it: from then on its word stands
    expect(host.press(1, slow.id)).toBeNull();
    host.step((1 / 60) * PACE, {});
    guest.restore(JSON.parse(JSON.stringify(host.snapshot())), 1, true);
    expect(me.cast).toEqual(host.fighters[1]!.cast);
  });

  it('a press the host never takes lapses, and the host’s word is shown again', () => {
    const { host, guest, me, slow } = opened();
    guest.foretell(1, slow.id, undefined, 0.3);
    for (let i = 0; i < 24; i++) guest.coast(1 / 60, 1, null);
    guest.restore(JSON.parse(JSON.stringify(host.snapshot())), 1, true);
    expect(me.cast).toBeNull();
    expect(me.gcd).toBe(host.fighters[1]!.gcd);
  });
});

describe('sigilfall: the room link measures its round trip (net/link.ts)', () => {
  /** A stand-in socket the test opens and answers by hand. */
  class FakeSocket {
    static all: FakeSocket[] = [];
    static OPEN = 1;
    readyState = 0;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { reason: string }) => void) | null = null;
    constructor(public url: string) {
      FakeSocket.all.push(this);
    }
    send(m: string): void {
      this.sent.push(m);
    }
    close(): void {
      this.readyState = 3;
      this.onclose?.({ reason: '' });
    }
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pings the room as it opens and every few seconds, and keeps an eased round trip from the answers', async () => {
    vi.useFakeTimers();
    FakeSocket.all = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    let clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const { Link } = await import('../src/games/sigilfall/net/link');
    const relayed: unknown[] = [];
    const link = new Link('ABCDE', 'Bea', { onView: () => undefined, onRelay: (_n, d) => relayed.push(d), onState: () => undefined });
    const ws = FakeSocket.all[0]!;
    ws.readyState = 1;
    ws.onopen?.();
    expect(ws.sent).toEqual(['ping']);
    expect(link.rtt).toBe(0);
    clock += 80;
    ws.onmessage?.({ data: 'pong' });
    expect(link.rtt).toBe(80);
    // the next, three seconds on, answered more slowly: the kept one moves part of the way
    clock += 3000;
    vi.advanceTimersByTime(3000);
    expect(ws.sent.filter((m) => m === 'ping')).toHaveLength(2);
    clock += 120;
    ws.onmessage?.({ data: 'pong' });
    expect(link.rtt).toBeCloseTo(92, 5);
    // the fight's traffic still reaches the game; a pong never does
    ws.onmessage?.({ data: JSON.stringify({ t: 'relay', data: { n: 1, d: { t: 'p' } } }) });
    expect(relayed).toEqual([{ t: 'p' }]);
    link.close();
  });
});

describe('sigilfall: a faraway guest’s press at the edge of reach isn’t dropped by the host', () => {
  it('is tried again for a moment while the host’s copy of them catches up, and goes off once it is there', () => {
    const late = new LatePresses();
    let reach = false;
    const pressed: string[] = [];
    const press = (id: number, ab: string): string | null => {
      if (!reach) return 'Too far away';
      pressed.push(`${id}:${ab}`);
      return null;
    };
    late.pressed(3, 'w-gash', undefined, press(3, 'w-gash'), 1000, 300);
    expect(late.size).toBe(1);
    late.retry(1100, press);
    expect(pressed).toEqual([]);
    reach = true;
    late.retry(1200, press);
    expect(pressed).toEqual(['3:w-gash']);
    expect(late.size).toBe(0);
  });

  it('gives up after its moment, on any other answer, and never waits past LATE_MOST', () => {
    const late = new LatePresses();
    const far = (): string => 'Too far away';
    late.pressed(1, 'a', undefined, 'Too far away', 0, 200);
    late.retry(150, far);
    expect(late.size).toBe(1);
    late.retry(250, far);
    expect(late.size).toBe(0);
    late.pressed(1, 'a', undefined, 'Out of sight', 0, 99_999);
    late.retry(LATE_MOST + 1, far);
    expect(late.size).toBe(0);
    late.pressed(1, 'a', undefined, 'Too far away', 0, 300);
    late.retry(10, () => 'Not enough rage');
    expect(late.size).toBe(0);
    // a press that went off, or was turned away for its own reasons, isn't kept at all
    late.pressed(2, 'b', undefined, null, 0, 300);
    late.pressed(2, 'b', undefined, 'Not ready yet', 0, 300);
    expect(late.size).toBe(0);
  });
});
