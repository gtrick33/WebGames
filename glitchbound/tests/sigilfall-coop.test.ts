/**
 * Sigilfall co-op (net/room.ts, net/coop.ts): the party's room, and a Riftstone run between a host's game
 * and a guest's, wired together here as the room's relay would (in order, nothing lost). The host's game
 * runs the enemies; the guest's mirrors them, strikes them through the host, is struck through the host,
 * takes its own experience and loot from every kill, and ends the run on the host's clock.
 */
import { describe, expect, it, vi } from 'vitest';
import { MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { KEY_DEATH } from '../src/games/sigilfall/data/keystones';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { SLOTS, type ClassId, type RegionId } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';
import { newCharacter, SIGILS, type Character } from '../src/games/sigilfall/progress/character';
import { rollGear } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { CoopSession } from '../src/games/sigilfall/net/coop';
import * as room from '../src/games/sigilfall/net/room';
import { AWAY_MS, dropAway } from '../src/party/rooms/seats';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { World } from '../src/games/sigilfall/sim/world';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { readyHero } from './sigilfall-bot';

const KEY_A = 'host-key-aaaaaaaaaaaaaaaa';
const KEY_B = 'guest-key-bbbbbbbbbbbbbbbb';

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

const card = (name: string, cls: ClassId, story = 200): room.Card => ({ name, cls, level: 60, para: 0, keystone: 5, story, look: { any: true }, weapon: { kind: 'staff' } });

/** A host's and a guest's game in the same run (a Riftstone's, or questing in a land), joined by their sessions. */
function pair(region: RegionId = 'crypt', key = 2, heroes: { host?: Character; guest?: Character; tier?: number } = {}) {
  const tier = heroes.tier ?? 2;
  const run = key ? { key, affixes: [] } : {};
  const hw = new World({ region, tier, mods: [], hero: heroes.host ?? hero('warrior'), settings: { ...DEFAULT_SETTINGS }, seed: 7, ...run, handIns: false, coop: 'host' });
  const gw = new World({ region, tier, mods: [], hero: heroes.guest ?? hero('mage'), settings: { ...DEFAULT_SETTINGS }, seed: 7, ...run, handIns: false, coop: 'guest' });
  const queue: { to: CoopSession; n: number; d: unknown }[] = [];
  const to: { hs?: CoopSession; gs?: CoopSession } = {};
  const hs = new CoopSession('host', 1, 1, (d) => queue.push({ to: to.gs!, n: 1, d: JSON.parse(JSON.stringify(d)) }));
  const gs = new CoopSession('guest', 2, 1, (d) => queue.push({ to: to.hs!, n: 2, d: JSON.parse(JSON.stringify(d)) }));
  to.hs = hs;
  to.gs = gs;
  hs.setMembers([{ n: 1, card: card('Ash', 'warrior') }, { n: 2, card: card('Bea', 'mage') }]);
  gs.setMembers([{ n: 1, card: card('Ash', 'warrior') }, { n: 2, card: card('Bea', 'mage') }]);
  hs.attach(hw);
  gs.attach(gw);
  const step = (frames = 1): void => {
    for (let i = 0; i < frames; i++) {
      hw.step(1 / 60);
      gw.step(1 / 60);
      hs.frame(1000 / 60);
      gs.frame(1000 / 60);
      // the relay delivers in order
      while (queue.length) {
        const m = queue.shift()!;
        m.to.receive(m.n, m.d);
      }
    }
  };
  return { hw, gw, hs, gs, step };
}

/** The middle of a room's floor. */
function roomMiddle(w: World, index: number): { x: number; y: number } {
  const tiles = (w.map.roomTiles[index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  return { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the co-op room', () => {
  it('seats up to four, takes cards, lets only the host plan and start, and a Riftstone run needs level 60', () => {
    expect(room.COOP_LEVEL).toBe(MAX_LEVEL);
    const s = room.newRoom('ABCDE', 0, 1);
    expect(room.join(s, KEY_A, 'Ash', 0)).toBeNull();
    expect(room.join(s, KEY_B, 'Bea', 0)).toBeNull();
    for (let i = 0; i < 2; i++) room.join(s, `extra-key-${i}-cccccccccccc`, `P${i}`, 0);
    expect(room.join(s, 'extra-key-9-cccccccccccc', 'Late', 0)).toBe('full');
    for (let i = 0; i < 2; i++) room.leave(s, `extra-key-${i}-cccccccccccc`, 0);
    // their seats are held for a moment (a dropped connection), then the room's alarm lets them go
    dropAway(s, AWAY_MS);
    expect(room.act(s, KEY_A, { t: 'card', card: card('Ash', 'warrior') }, 1)).toBeNull();
    expect(room.act(s, KEY_B, { t: 'card', card: { ...card('Bea', 'mage'), look: 'x'.repeat(5000) as unknown } }, 1)).toBe('bad_card');
    expect(room.act(s, KEY_B, { t: 'card', card: { ...card('Bea', 'mage'), level: 52 } }, 1)).toBeNull();
    expect(room.act(s, KEY_B, { t: 'plan', region: 'crypt', key: 3 }, 1)).toBe('not_host');
    expect(room.act(s, KEY_A, { t: 'start', week: 4 }, 1)).toBe('no_plan');
    expect(room.act(s, KEY_A, { t: 'plan', region: 'crypt', key: 3 }, 1)).toBeNull();
    expect(room.act(s, KEY_A, { t: 'start', week: 4 }, 1)).toBe('level');
    room.act(s, KEY_B, { t: 'card', card: card('Bea', 'mage') }, 1);
    expect(room.act(s, KEY_A, { t: 'start', week: 4 }, 2)).toBeNull();
    const v = room.viewFor(s, KEY_B)!;
    expect(v.phase).toBe('run');
    expect(v.run).toBe(1);
    expect(v.week).toBe(4);
    expect(v.seats.map((x) => x.card?.name)).toEqual(['Ash', 'Bea']);
    // nobody new mid-run (said as such); the fight's traffic passes to the others, tagged, and is never stored
    expect(room.join(s, 'late-key-dddddddddddddddd', 'Late', 3)).toBe('in_run');
    expect(room.relay(s, KEY_B, { t: 'r', d: { t: 'p', x: 1 } })).toEqual({ others: { n: 2, d: { t: 'p', x: 1 } }, save: false });
    expect(room.relay(s, KEY_B, { t: 'plan', region: 'crypt', key: 1 })).toBeNull();
  });
});

describe('sigilfall: a co-op Riftstone run', () => {
  it('the guest sees the host’s enemies, strikes them through the host, and both heroes are paid for a kill', () => {
    const { hw, gw, step } = pair();
    step(30);
    // both heroes see each other
    expect(hw.coop!.ghosts.map((g) => g.n)).toEqual([2]);
    expect(gw.coop!.ghosts.map((g) => g.n)).toEqual([1]);
    expect(gw.enemies).toHaveLength(0);
    // the host walks into the first room: its doors seal, its enemies come; the guest is drawn in
    const enc = hw.encounters.findIndex((e) => !e.def.boss);
    const mid = roomMiddle(hw, enc);
    hw.player.x = mid.x;
    hw.player.y = mid.y;
    step(150);
    expect(hw.encounters[enc]!.state).toBe('active');
    expect(gw.encounters[enc]!.state).toBe('active');
    expect(gw.map.room[Math.floor(gw.player.y / TILE) * gw.map.w + Math.floor(gw.player.x / TILE)]).toBe(enc + 1);
    const live = hw.enemies.filter((e) => !e.dead);
    expect(live.length).toBeGreaterThan(0);
    expect(gw.enemies.filter((e) => !e.dead).map((e) => e.id).sort()).toEqual(live.map((e) => e.id).sort());
    // the guest's hit lands on the host's enemy, and its death pays both heroes
    const target = live[0]!;
    const xpH = hw.run.xp;
    const xpG = gw.run.xp;
    const copy = gw.enemyById(target.id)!;
    hitEnemy(gw, copy, copy.maxHp * 50, 'arcane', { depth: 0 });
    expect(copy.dead).toBe(false);
    step(10);
    expect(target.dead).toBe(true);
    expect(copy.dead).toBe(true);
    expect(hw.run.kills).toBe(1);
    expect(gw.run.kills).toBe(1);
    expect(hw.run.xp).toBeGreaterThan(xpH);
    expect(gw.run.xp).toBeGreaterThan(xpG);
  });

  it('what the host’s enemies throw at the guest reaches the guest’s hero, who takes it with their own defenses', () => {
    const { hw, gw, step } = pair();
    // past the arrival's moment of protection
    step(150);
    expect(gw.player.iframe).toBe(0);
    const before = gw.player.hp;
    hw.ghostHit(hw.coop!.ghosts[0]!, 40, { fromX: gw.player.x, fromY: gw.player.y - 10, knock: 30 });
    step(10);
    expect(gw.player.hp).toBeLessThan(before);
    // a dodging hero is not struck
    gw.player.iframe = 1;
    step(8);
    const now = gw.player.hp;
    hw.ghostHit(hw.coop!.ghosts[0]!, 40, {});
    step(8);
    // (health only climbs: it mends out of a fight)
    expect(gw.player.hp).toBeGreaterThanOrEqual(now);
    // the copies of the host's attacks never strike on the guest's side
    gw.player.iframe = 0;
    const t0 = gw.player.hp;
    gw.telegraphs.push({ id: 1, shape: 'circle', x: gw.player.x, y: gw.player.y, r: 40, r2: 0, angle: 0, len: 0, t: 1, dur: 1, dmg: 50, knock: 0, tone: 'enemy', owner: -1, linger: 0, remote: true, dead: false });
    gw.step(1 / 60);
    expect(gw.player.hp).toBeGreaterThanOrEqual(t0);
  });

  it('enemies chase the nearest hero, the guest too', () => {
    const { hw, gw, step } = pair();
    step(20);
    const enc = hw.encounters.findIndex((e) => !e.def.boss);
    const mid = roomMiddle(hw, enc);
    hw.player.x = mid.x;
    hw.player.y = mid.y;
    step(120);
    // the host steps far back in the room; the guest stands among the enemies
    const live = hw.enemies.filter((e) => !e.dead && !e.boss);
    expect(live.length).toBeGreaterThan(0);
    hw.player.iframe = 99;
    gw.player.x = live[0]!.x + 12;
    gw.player.y = live[0]!.y;
    const hp = gw.player.hp;
    for (let i = 0; i < 600 && gw.player.hp >= hp; i++) step(1);
    expect(gw.player.hp).toBeLessThan(hp);
  });

  it('the guest’s falls cost the host’s clock; the boss’s fall ends the run for both on the host’s time', () => {
    const { hw, gw, step } = pair('crypt', 2);
    step(20);
    gw.playerDies();
    step(5);
    expect(hw.keyRun!.deaths).toBe(1);
    expect(gw.keyRun!.deaths).toBe(1);
    // to the boss: every room before it cleared on the host, the boss room entered
    const boss = [...hw.encounters].reverse().find((e) => !!e.def.boss)!;
    const mid = roomMiddle(hw, boss.index);
    hw.player.x = mid.x;
    hw.player.y = mid.y;
    gw.respawn();
    for (let i = 0; i < 300 && !hw.boss(); i++) step(1);
    const b = hw.boss()!;
    expect(b).toBeTruthy();
    step(30);
    expect(gw.boss()?.id).toBe(b.id);
    hw.keyRun!.t = 30;
    for (let i = 0; i < 900 && !(hw.cleared && gw.cleared); i++) {
      const bb = hw.boss();
      if (bb && !bb.dead && !bb.boss?.dying) hitEnemy(hw, bb, bb.hp * 100, 'physical', { depth: 1 });
      hw.player.iframe = 99;
      gw.player.iframe = 99;
      step(1);
    }
    expect(hw.cleared).toBe(true);
    expect(gw.cleared).toBe(true);
    expect(hw.keyRun!.end).toBeTruthy();
    expect(gw.keyRun!.end!.time).toBeCloseTo(hw.keyRun!.end!.time, 0);
    expect(hw.keyRun!.end!.time).toBeGreaterThanOrEqual(30 + KEY_DEATH);
    expect(gw.keyRun!.end!.up).toBe(hw.keyRun!.end!.up);
    // each hero's own Riftstone opens the levels
    expect(gw.hero.keystone).toBe(Math.max(5, 2 + gw.keyRun!.end!.up));
  });

  it('a hit-stop costs the party’s clock nothing on either side, and the guest’s clock keeps reading the host’s', () => {
    const { hw, gw, step } = pair('crypt', 2);
    step(20);
    const hk = hw.keyRun!;
    const gk = gw.keyRun!;
    expect(hk.going && gk.going).toBe(true);
    let apart = 0;
    const tick = (): void => {
      step(1);
      apart = Math.max(apart, Math.abs(gk.t - hk.t));
    };
    // the host's blow holds the host's world, whose enemies are everyone's: the clock waits with it (sim/world.ts step)
    let t0 = hk.t;
    const w0 = hw.time;
    hw.hitstop(0.25);
    while (hw.hitstopT > 0) tick();
    expect(hk.t - t0).toBeCloseTo(hw.time - w0, 9);
    expect(hk.t - t0).toBeLessThan(0.05);
    // a guest's blow holds only the guest's world: the host's, and the clock, run on
    t0 = hk.t;
    let frames = 0;
    gw.hitstop(0.25);
    while (gw.hitstopT > 0) {
      tick();
      frames++;
    }
    expect(hk.t - t0).toBeCloseTo(frames / 60, 9);
    // and all the while the guest's clock read the host's: a frame of it behind at most, in tenths (net/coop.ts)
    expect(apart).toBeLessThan(0.2);
  });
});

describe('sigilfall: questing together', () => {
  it('the hero furthest behind in the story leads; only they choose the way, and the party follows', () => {
    const s = room.newRoom('QUEST', 0, 1);
    room.join(s, KEY_A, 'Ash', 0);
    room.join(s, KEY_B, 'Bea', 0);
    room.act(s, KEY_A, { t: 'mode', mode: 'party' }, 1);
    room.act(s, KEY_A, { t: 'card', card: { ...card('Ash', 'warrior', 140), level: 41 } }, 1);
    room.act(s, KEY_B, { t: 'card', card: { ...card('Bea', 'mage', 12), level: 9 } }, 1);
    // any level goes questing
    expect(room.act(s, KEY_A, { t: 'start', week: 1 }, 2)).toBeNull();
    const v = room.viewFor(s, KEY_A)!;
    expect(v.lead).toBe(2);
    expect(room.act(s, KEY_A, { t: 'go', region: 'amberfield', tier: 0 }, 3)).toBe('not_lead');
    expect(room.act(s, KEY_B, { t: 'go', region: 'amberfield', tier: 0 }, 3)).toBeNull();
    expect(room.viewFor(s, KEY_A)!.trip).toBe(1);
    expect(room.viewFor(s, KEY_A)!.plan).toEqual({ region: 'amberfield', key: 0 });
  });

  it('a hero ahead in the story is phased into the world of the one behind', () => {
    const behind = newCharacter('ranger', 'Cal', 'c', 0);
    const ahead = hero('mage');
    const { hw, gw, step } = pair('briarhollow', 0, { host: behind, guest: ahead, tier: 0 });
    // before a word from the leader, the guest's own story shows (the village rebuilt)
    const own = gw.storyState?.id;
    step(60);
    expect(hw.storyState?.id).not.toBe(own);
    expect(gw.storyState?.id).toBe(hw.storyState?.id);
    // what the guest has done stays theirs: their quests, their rewards
    expect(gw.hero.quests['briar-dusk']?.state).toBe('done');
    expect(gw.layer?.quests['briar-dusk']?.state ?? 'locked').not.toBe('done');
  });

  it('a story event the leader’s game wins counts for every hero whose quest waits on it', () => {
    const lead = hero('warrior');
    const friend = hero('priest');
    for (const h of [lead, friend]) {
      delete h.quests['hearth-the-riders-come'];
      h.quests['hearth-the-riders-come'] = { state: 'active', n: 0 };
    }
    const { hw, gw, step } = pair('amberfield', 0, { host: lead, guest: friend, tier: 0 });
    step(20);
    hw.coop!.out.push({ t: 'event', id: 'hearth-riders' });
    step(10);
    // (the fight counts for the friend too: their quest goes on to its next step, the streets to block, which is each hero's own)
    expect(gw.hero.quests['hearth-the-riders-come']).toMatchObject({ state: 'active', step: 1 });
  });

  it('in an open land a frame holds only the enemies near a hero', () => {
    const { hw, gw, step } = pair('whisperwood', 0, { tier: 0 });
    step(40);
    const near = (x: number, y: number): boolean => [hw.player, ...hw.coop!.ghosts].some((h) => Math.abs(h.x - x) < 520 && Math.abs(h.y - y) < 520);
    const hostNear = hw.enemies.filter((e) => !e.dead && !e.dummy && near(e.x, e.y)).map((e) => e.id);
    expect(hw.enemies.length).toBeGreaterThan(hostNear.length);
    expect(gw.enemies.filter((e) => !e.dead).map((e) => e.id).sort()).toEqual(hostNear.sort());
  });
});


const KEY_C = 'third-key-cccccccccccccccc';

/** A room with two seated heroes and their cards (Ash hosts). */
function party(mode: room.Mode, stories = [200, 200]) {
  const s = room.newRoom('PARTY', 0, 1);
  room.join(s, KEY_A, 'Ash', 0);
  room.join(s, KEY_B, 'Bea', 0);
  room.act(s, KEY_A, { t: 'mode', mode }, 1);
  room.act(s, KEY_A, { t: 'card', card: card('Ash', 'warrior', stories[0]) }, 1);
  room.act(s, KEY_B, { t: 'card', card: card('Bea', 'mage', stories[1]) }, 1);
  if (mode === 'rift') room.act(s, KEY_A, { t: 'plan', region: 'crypt', key: 3 }, 1);
  expect(room.act(s, KEY_A, { t: 'start', week: 1 }, 2)).toBeNull();
  return s;
}

describe('sigilfall: a party never gets stuck (SFC-01, SFC-02)', () => {
  it('a leader whose connection drops mid-run keeps the host role, and can still end the run', () => {
    const s = party('rift');
    room.leave(s, KEY_A, 3);
    expect(s.host).toBe(1);
    // someone (re)connecting while the leader is away doesn't take it either
    room.join(s, KEY_B, 'Bea', 4);
    expect(s.host).toBe(1);
    expect(s.phase).toBe('run');
    room.join(s, KEY_A, 'Ash', 5);
    expect(room.act(s, KEY_A, { t: 'end' }, 6)).toBeNull();
    expect(s.phase).toBe('lobby');
    expect(room.viewFor(s, KEY_A)!.host).toBe(1);
    // and a new run can start
    expect(room.act(s, KEY_A, { t: 'start', week: 1 }, 7)).toBeNull();
  });

  it('the run’s lead may end it even when not the host; anyone may once the lead is away for good', () => {
    const s = party('party', [200, 10]);
    expect(s.lead).toBe(2);
    expect(room.act(s, KEY_B, { t: 'end' }, 3)).toBeNull();
    expect(s.phase).toBe('lobby');
    room.act(s, KEY_A, { t: 'start', week: 1 }, 4);
    room.leave(s, KEY_B, 5);
    // the leader's connection dropped: the friends' games end the run after waiting a while
    expect(room.act(s, KEY_A, { t: 'end' }, 6)).toBeNull();
    expect(s.phase).toBe('lobby');
    // a run that is going, with its lead here, isn't ended by a friend
    room.join(s, KEY_B, 'Bea', 7);
    room.act(s, KEY_A, { t: 'start', week: 1 }, 8);
    room.join(s, KEY_C, 'Cy', 9);
    expect(room.act(s, KEY_C, { t: 'end' }, 10)).toBe('not_host');
  });

  it('questing, a friend joins under way and follows the trip; a Riftstone run still takes nobody new', () => {
    const q = party('party', [200, 10]);
    room.act(q, KEY_B, { t: 'go', region: 'amberfield', tier: 0 }, 3);
    expect(room.join(q, KEY_C, 'Cy', 4)).toBeNull();
    const v = room.viewFor(q, KEY_C)!;
    expect(v.phase).toBe('run');
    expect(v.plan).toEqual({ region: 'amberfield', key: 0 });
    expect(v.lead).toBe(2);
    const r = party('rift');
    expect(room.join(r, KEY_C, 'Cy', 4)).toBe('in_run');
    room.act(r, KEY_A, { t: 'end' }, 5);
    for (let i = 0; i < 2; i++) {
      room.join(r, `extra-key-${i}-cccccccccccc`, `P${i}`, 5);
      room.act(r, `extra-key-${i}-cccccccccccc`, { t: 'card', card: card(`P${i}`, 'mage') }, 5);
    }
    expect(room.act(r, KEY_A, { t: 'start', week: 1 }, 6)).toBeNull();
    expect(room.join(r, KEY_C, 'Cy', 7)).toBe('full');
  });

  it('a questing leader who leaves hands the lead on (no seat left behind); with nobody to lead, the run ends', () => {
    const s = party('party', [200, 10]);
    room.join(s, KEY_C, 'Cy', 3);
    room.act(s, KEY_C, { t: 'card', card: card('Cy', 'ranger', 50) }, 3);
    room.act(s, KEY_B, { t: 'go', region: 'amberfield', tier: 0 }, 4);
    expect(room.act(s, KEY_B, { t: 'bye' }, 5)).toBeNull();
    expect(s.seats.map((x) => x.n)).toEqual([1, 3]);
    expect(s.phase).toBe('run');
    // the next hero furthest behind leads; their game says where the party is
    expect(s.lead).toBe(3);
    expect(s.plan).toBeNull();
    expect(room.act(s, KEY_C, { t: 'go', region: 'amberfield', tier: 0 }, 6)).toBeNull();
    // the host removes the new leader: the lead goes to the host
    expect(room.act(s, KEY_A, { t: 'kick', n: 3 }, 7)).toBeNull();
    expect(s.lead).toBe(1);
    // a Riftstone leader who leaves ends the run, and the host role passes to someone here
    const r = party('rift');
    expect(room.act(r, KEY_A, { t: 'bye' }, 3)).toBeNull();
    expect(r.phase).toBe('lobby');
    expect(r.host).toBe(2);
  });

  it('a plan never goes above the Riftstone the host holds', () => {
    const s = room.newRoom('PLANS', 0, 1);
    room.join(s, KEY_A, 'Ash', 0);
    room.act(s, KEY_A, { t: 'card', card: card('Ash', 'warrior') }, 1);
    expect(room.act(s, KEY_A, { t: 'plan', region: 'crypt', key: 999 }, 1)).toBe('bad_plan');
    expect(room.act(s, KEY_A, { t: 'plan', region: 'crypt', key: 5 }, 1)).toBeNull();
    // a card changed after the plan (a lower hero): the start is refused
    room.act(s, KEY_A, { t: 'card', card: { ...card('Ash', 'warrior'), keystone: 2 } }, 2);
    expect(room.act(s, KEY_A, { t: 'start', week: 1 }, 2)).toBe('bad_plan');
  });
});

describe('sigilfall: co-op messages are checked (SFC-04)', () => {
  it('a crafted guest message never one-shots a boss, stalls the clock, sticks a status or throws', () => {
    const { hw, hs, step } = pair('crypt', 2);
    step(20);
    const boss = [...hw.encounters].reverse().find((e) => !!e.def.boss)!;
    const mid = roomMiddle(hw, boss.index);
    hw.player.x = mid.x;
    hw.player.y = mid.y;
    for (let i = 0; i < 300 && !hw.boss(); i++) step(1);
    const b = hw.boss()!;
    for (let i = 0; i < 200 && b.state === 'spawn'; i++) step(1);
    hw.player.iframe = 99;
    const hp = b.hp;
    const deaths = hw.keyRun!.deaths;
    const t0 = performance.now();
    hs.receive(2, { t: 'g', h: [[b.id, 1e12, 0, 0], [b.id, 1e12, 0, 0], [b.id, 'x', 0, 0]], st: [[b.id, 'burn', 1e6, 1e9], [b.id, 'stun', 1e6, 1]], died: 1e8 });
    expect(performance.now() - t0).toBeLessThan(200);
    expect(b.dead).toBe(false);
    expect(hp - b.hp).toBeLessThanOrEqual(b.maxHp * 0.04 + 1);
    expect(hw.keyRun!.deaths - deaths).toBeLessThanOrEqual(3);
    expect(b.statuses.some((x) => x.id === 'burn')).toBe(false);
    expect(b.statuses.every((x) => x.t === undefined || x.t <= 12)).toBe(true);
    // malformed: never thrown, and a hero's place stays a number
    expect(() => hs.receive(2, { t: 'p', x: 'NaN', y: 1, sh: 7 })).not.toThrow();
    expect(() => hs.receive(2, { t: 'p', x: 10, y: 10, vx: 0, vy: 0, dir: 0, hp: 1, mh: 1, sh: 7 })).not.toThrow();
    expect(() => hs.receive(2, { t: 'g', h: 5, st: null })).not.toThrow();
    const g = hw.coop!.ghosts.find((x) => x.n === 2)!;
    expect(typeof g.tx).toBe('number');
    expect(Number.isFinite(g.tx)).toBe(true);
  });

  it('a crafted leader frame can’t open Riftstone levels or pay out a flood of kills', () => {
    const { gw, gs, step } = pair('crypt', 2);
    step(20);
    const keystone = gw.hero.keystone;
    const rows = Array.from({ length: 100 }, (_, i) => [90_000 + i, 'skeleton', gw.player.x + 40, gw.player.y, 50, 50, 0, 1e6, 0, 'chase', '', '', -1]);
    gs.receive(1, { t: 's', e: rows, pr: [], tg: [], fd: [], wv: [], en: '', k: null, ev: [] });
    const made = gw.enemies.filter((e) => e.id >= 90_000);
    expect(made.every((e) => e.level <= 100)).toBe(true);
    const kills = gw.run.kills;
    gs.receive(1, { t: 's', e: [], pr: [], tg: [], fd: [], wv: [], en: '', k: null, ev: [...rows.map((r) => ['k', r[0]]), ['end', 10, 999], ['k', 'x']] });
    expect(gw.run.kills - kills).toBeLessThanOrEqual(40);
    expect(gw.keyRun!.end).toBeFalsy();
    expect(gw.hero.keystone).toBe(keystone);
    expect(() => gs.receive(1, { t: 's', e: 3, ev: 'x', tg: [1], pr: {}, wv: 2 })).not.toThrow();
  });
});

describe('sigilfall: party heroes arrive beside each other (SFC-12)', () => {
  it('a guest’s hero starts off the leader’s spot', () => {
    const { hw, gw } = pair('crypt', 2);
    expect(Math.hypot(hw.player.x - gw.player.x, hw.player.y - gw.player.y)).toBeGreaterThan(5);
  });
});

describe('sigilfall: a friend following a questing party who falls is never left dead (SFC-05)', () => {
  it('Return isn’t offered to them, and the death screen only closes when travel happened', () => {
    const following = { coop: { role: 'guest' }, party: { view: { mode: 'party', phase: 'run' } } };
    const canGoHome = (o: object): boolean => Object.getOwnPropertyDescriptor(SigilEngine.prototype, 'canGoHome')!.get!.call(o);
    expect(canGoHome(following)).toBe(false);
    expect(canGoHome({ ...following, coop: { role: 'host' } })).toBe(true);
    expect(canGoHome({ ...following, party: { view: { mode: 'rift', phase: 'run' } } })).toBe(true);
    expect(canGoHome({ coop: null, party: null })).toBe(true);
    const setUi = vi.fn();
    SigilEngine.prototype.returnHome.call({ travel: () => false, setUi } as unknown as SigilEngine);
    expect(setUi).not.toHaveBeenCalled();
    SigilEngine.prototype.returnHome.call({ travel: () => true, setUi } as unknown as SigilEngine);
    expect(setUi).toHaveBeenCalledWith({ death: false, reward: null });
  });
});
