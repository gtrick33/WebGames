/**
 * Sigilfall co-op (net/room.ts, net/coop.ts): the party's room, and a Riftstone run between a host's game
 * and a guest's, wired together here as the room's relay would (in order, nothing lost). The host's game
 * runs the enemies; the guest's mirrors them, strikes them through the host, is struck through the host,
 * takes its own experience and loot from every kill, and ends the run on the host's clock.
 */
import { describe, expect, it } from 'vitest';
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
  return { hw, gw, step };
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
    // nobody new mid-run; the fight's traffic passes to the others, tagged, and is never stored
    expect(room.join(s, 'late-key-dddddddddddddddd', 'Late', 3)).toBe('full');
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
    expect(gw.hero.quests['hearth-the-riders-come']?.state).toBe('done');
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

