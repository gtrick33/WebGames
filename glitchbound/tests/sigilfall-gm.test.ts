import { beforeEach, describe, expect, it } from 'vitest';
import { applyOrder, applyToHero, heroFor, orderToast, type GmOrder } from '../src/games/sigilfall/progress/gm';
import { MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { ITEMS } from '../src/games/sigilfall/data/items';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { newCharacter, type Character } from '../src/games/sigilfall/progress/character';
import { emptySave, validateCharacter, type SaveFile } from '../src/games/sigilfall/progress/save';
import { checkOrder, closeOrders, fileOrder, gravesFor, listPlayers, overview, playerDetail, restoreHero, SAVE_KEY, waitingOrders, cancelOrder } from '../server/sigilfallGm';
import type { Env } from '../server/http';
import { isSyncedKey, slugOfKey } from '../src/platform/syncKeys';
import { memoryD1 } from './d1';

const hero = (cls: Character['cls'] = 'warrior', created = 1000): Character => {
  const c = newCharacter(cls, 'Tester', 'hero0', created);
  c.created = created;
  return c;
};
const order = (kind: string, payload: Record<string, unknown>, id = 'o1', slot = 0, created = 1000): GmOrder => ({ id, slot, created, kind, payload });

describe('orders on a hero', () => {
  it('gives and takes within the game’s limits', () => {
    const c = hero();
    expect(applyToHero(c, 'gold', { amount: 500 })).toBe('');
    expect(c.gold).toBe(500);
    expect(applyToHero(c, 'gold', { amount: -9000 })).toBe('');
    expect(c.gold).toBe(0);
    applyToHero(c, 'shards', { amount: 9999 });
    expect(c.shards).toBe(99);
    applyToHero(c, 'potions', { amount: 99 });
    expect(c.potions).toBeLessThanOrEqual(6);
  });

  it('sets a level up and down, giving back talents that no longer fit', () => {
    const c = hero();
    applyToHero(c, 'level', { level: 30 });
    expect(c.level).toBe(30);
    c.spec = 0;
    c.talents = { made_up: 21 };
    applyToHero(c, 'level', { level: 5 });
    expect(c.level).toBe(5);
    expect(c.spec).toBeNull();
    expect(c.talents).toEqual({});
    expect(c.freeRespec).toBe(true);
    applyToHero(c, 'level', { level: 9999 });
    expect(c.level).toBe(MAX_LEVEL);
    expect(validateCharacter(JSON.parse(JSON.stringify(c)), 0)?.level).toBe(MAX_LEVEL);
  });

  it('gives items and rolled gear, and refuses what doesn’t exist', () => {
    const c = hero();
    const def = ITEMS.find((i) => !i.cls)!;
    expect(applyToHero(c, 'item', { id: def.id, il: 20 })).toBe('');
    expect(c.bag.at(-1)?.base).toBe(def.id);
    expect(applyToHero(c, 'gear', { rarity: 'rare', slot: 'chest', il: 22 })).toBe('');
    expect(c.bag).toHaveLength(2);
    expect(c.bag[1]!.il).toBe(22);
    expect(applyToHero(c, 'item', { id: 'nope' })).not.toBe('');
    expect(applyToHero(c, 'gear', { rarity: 'mythical', slot: 'chest' })).not.toBe('');
    const uid = c.bag[0]!.uid;
    expect(applyToHero(c, 'removeItem', { uid })).toBe('');
    expect(c.bag.some((i) => i.uid === uid)).toBe(false);
    expect(applyToHero(c, 'removeItem', { uid })).not.toBe('');
  });

  it('completes a quest with what it comes after, and resets one', () => {
    const c = hero();
    const q = Object.values(QUEST_DEFS).find((d) => (d.after?.length ?? 0) > 0)!;
    expect(applyToHero(c, 'quest', { id: q.id, state: 'done' })).toBe('');
    expect(c.quests[q.id]?.state).toBe('done');
    for (const a of q.after!) expect(c.quests[a]?.state).toBe('done');
    expect(applyToHero(c, 'quest', { id: q.id, state: 'reset' })).toBe('');
    expect(c.quests[q.id]).toBeUndefined();
    expect(applyToHero(c, 'quest', { id: 'nope', state: 'done' })).not.toBe('');
  });

  it('opens lands, gives mounts and renames, cleanly', () => {
    const c = hero();
    const region = Object.keys(REGIONS).find((r) => !c.unlocked.includes(r as never))!;
    applyToHero(c, 'unlock', { id: region });
    applyToHero(c, 'unlock', { id: region });
    expect(c.unlocked.filter((r) => r === region)).toHaveLength(1);
    expect(applyToHero(c, 'unlock', { id: 'nowhere' })).not.toBe('');
    const mount = Object.keys(MOUNT_DEFS)[0]!;
    applyToHero(c, 'mount', { id: mount });
    expect(c.mounts).toContain(mount);
    applyToHero(c, 'rename', { name: 'Newname' });
    expect(c.name).toBe('Newname');
    expect(applyToHero(c, 'rename', { name: '   ' })).not.toBe('');
    applyToHero(c, 'respec', {});
    expect(c.freeRespec).toBe(true);
  });

  it('leaves a hero that the game’s own loader still accepts', () => {
    const c = hero('mage');
    for (const [kind, p] of [
      ['gold', { amount: 12 }],
      ['level', { level: 22 }],
      ['gear', { rarity: 'uncommon', slot: 'ring', il: 9 }],
      ['tier', { tier: 2 }],
      ['keystone', { level: 4 }],
    ] as [string, Record<string, unknown>][])
      expect(applyToHero(c, kind, p)).toBe('');
    const back = validateCharacter(JSON.parse(JSON.stringify(c)), 0)!;
    expect(back.level).toBe(22);
    expect(back.tier).toBe(2);
    expect(back.keystone).toBe(4);
    expect(back.gold).toBe(12);
    expect(back.bag).toHaveLength(1);
  });
});

describe('orders on a save', () => {
  const save = (): SaveFile => {
    const s = emptySave();
    s.heroes[0] = hero('warrior', 1000);
    s.heroes[1] = hero('mage', 2000);
    return s;
  };

  it('finds the hero by when it was made, wherever it is now', () => {
    const s = save();
    expect(heroFor(s, { slot: 0, created: 1000 })?.cls).toBe('warrior');
    expect(heroFor(s, { slot: 0, created: 2000 })?.cls).toBe('mage');
    expect(heroFor(s, { slot: 0, created: 3000 })).toBeNull();
  });

  it('is carried out once, even when asked twice', () => {
    const s = save();
    expect(applyOrder(s, order('gold', { amount: 10 }))).toBe('');
    expect(applyOrder(s, order('gold', { amount: 10 }))).toBe('');
    expect(s.heroes[0]!.gold).toBe(10);
    expect(s.heroes[0]!.gm).toEqual(['o1']);
    // the memory of orders survives a load
    expect(validateCharacter(JSON.parse(JSON.stringify(s.heroes[0])), 0)?.gm).toEqual(['o1']);
  });

  it('changes the hero being played, not a stale copy', () => {
    const s = save();
    const live = JSON.parse(JSON.stringify(s.heroes[0])) as Character;
    applyOrder(s, order('gold', { amount: 7 }), live);
    expect(live.gold).toBe(7);
    expect(s.heroes[0]!.gold).toBe(0);
  });

  it('says so when the hero has gone', () => {
    expect(applyOrder(save(), order('gold', { amount: 7 }, 'o2', 2, 5))).not.toBe('');
  });

  it('brings a deleted hero back into a free slot, or says there’s no room', () => {
    const s = save();
    const gone = JSON.parse(JSON.stringify(hero('druid', 3000))) as Character;
    expect(applyOrder(s, order('restore', { hero: gone }, 'r1', -1, 3000))).toBe('');
    expect(s.heroes[2]?.cls).toBe('druid');
    expect(s.heroes[2]?.created).toBe(3000);
    // once only
    expect(applyOrder(s, order('restore', { hero: gone }, 'r1', -1, 3000))).toBe('');
    expect(s.heroes.filter(Boolean)).toHaveLength(3);
    const other = JSON.parse(JSON.stringify(hero('ranger', 4000))) as Character;
    expect(applyOrder(s, order('restore', { hero: other }, 'r2', -1, 4000))).not.toBe('');
  });

  it('tells the player in a line', () => {
    expect(orderToast(order('gold', { amount: 1500 }))).toContain('1,500 gold');
    expect(orderToast(order('gold', { amount: -3 }))).toContain('took 3 gold');
    expect(orderToast(order('tier', { tier: 1 }))).toBe('');
  });
});

describe('what the admin may file', () => {
  it('checks shapes and ranges', () => {
    expect(checkOrder('gold', { amount: 0 }, '')).toBeTypeOf('string');
    expect(checkOrder('gold', { amount: 1.5 }, '')).toBeTypeOf('string');
    expect(checkOrder('gold', { amount: 250 }, '')).toMatchObject({ kind: 'gold', summary: 'Give 250 gold' });
    expect(checkOrder('gold', { amount: -250 }, '')).toMatchObject({ summary: 'Take 250 gold' });
    expect(checkOrder('level', { level: 61 }, '')).toBeTypeOf('string');
    expect(checkOrder('item', { id: 'x', il: 500 }, '')).toBeTypeOf('string');
    expect(checkOrder('quest', { id: 'x', state: 'explode' }, '')).toBeTypeOf('string');
    expect(checkOrder('nonsense', {}, '')).toBeTypeOf('string');
    expect(checkOrder('message', { text: 'Hello' }, '')).toMatchObject({ forPlayer: true });
    expect(checkOrder('item', { id: 'blade', il: 10 }, 'Old Blade')).toMatchObject({ summary: 'Give Old Blade (item level 10)' });
  });
});

describe('the server’s side', () => {
  let db: ReturnType<typeof memoryD1>;
  let env: Env;
  const now = 1_800_000_000_000;

  const addPlayer = (id: string, nickname: string, heroes: unknown[], savedAt = now): void => {
    db.sqlite.prepare('INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(id, id, `${id}@example.test`, nickname, now - 1000, savedAt);
    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run(id, SAVE_KEY, JSON.stringify({ v: 12, heroes, last: 0 }), savedAt);
  };

  beforeEach(() => {
    db = memoryD1();
    env = { DB: db } as unknown as Env;
    addPlayer('u1', 'Ada', [JSON.parse(JSON.stringify({ ...hero('warrior', 1000), name: 'Grom', level: 40 })), null, JSON.parse(JSON.stringify({ ...hero('mage', 2000), name: 'Lina', level: 12 }))], now - 1000);
    addPlayer('u2', 'Bo', [JSON.parse(JSON.stringify({ ...hero('druid', 3000), name: 'Fern', level: 55 })), null, null], now - 9 * 86400_000);
  });

  it('lists players with their heroes, found by name, email or hero', async () => {
    const all = await listPlayers(env, '', 'recent', 0, now);
    expect(all.total).toBe(2);
    expect(all.rows[0]!.nickname).toBe('Ada');
    expect(all.rows[0]!.online).toBe(true);
    expect(all.rows[0]!.heroes.map((h) => [h.slot, h.name, h.level])).toEqual([
      [0, 'Grom', 40],
      [2, 'Lina', 12],
    ]);
    expect((await listPlayers(env, '', 'level', 0, now)).rows[0]!.nickname).toBe('Bo');
    expect((await listPlayers(env, 'fern', 'recent', 0, now)).rows.map((r) => r.id)).toEqual(['u2']);
    expect((await listPlayers(env, 'u1@example', 'recent', 0, now)).rows.map((r) => r.id)).toEqual(['u1']);
    expect((await listPlayers(env, '%', 'recent', 0, now)).total).toBe(0);
  });

  it('counts players, heroes and classes', async () => {
    const o = await overview(env, now);
    expect(o.players).toBe(2);
    expect(o.online).toBe(1);
    expect(o.active7d).toBe(1);
    expect(o.heroes).toBe(3);
    expect(o.classes.find((c) => c.cls === 'druid')).toMatchObject({ heroes: 1, topLevel: 55 });
  });

  it('files an order only the player can collect and close', async () => {
    const id = await fileOrder(env, { userId: 'u1', slot: 0, created: 1000, heroName: 'Grom' }, { kind: 'gold', payload: { amount: 5 }, summary: 'Give 5 gold', forPlayer: false }, 'ticket 7', 'admin@example.test', now);
    expect((await waitingOrders(env, 'u1')).map((o) => o.id)).toEqual([id]);
    expect(await waitingOrders(env, 'u2')).toEqual([]);
    // someone else's report changes nothing
    await closeOrders(env, 'u2', [{ id, result: '' }], now);
    expect(await waitingOrders(env, 'u1')).toHaveLength(1);
    await closeOrders(env, 'u1', [{ id, result: '' }], now + 5);
    expect(await waitingOrders(env, 'u1')).toEqual([]);
    const seen = await playerDetail(env, 'u1', now);
    expect(seen?.orders[0]).toMatchObject({ summary: 'Give 5 gold', note: 'ticket 7', appliedAt: now + 5, result: '' });
    // too late to call back
    expect(await cancelOrder(env, id, now + 9)).toBe(false);
  });

  it('calls back an order that is still waiting', async () => {
    const id = await fileOrder(env, { userId: 'u1', slot: 0, created: 1000, heroName: 'Grom' }, { kind: 'gold', payload: { amount: 5 }, summary: 'Give 5 gold', forPlayer: false }, '', 'a', now);
    expect(await cancelOrder(env, id, now)).toBe(true);
    expect(await waitingOrders(env, 'u1')).toEqual([]);
  });

  it('keeps the last copy of a hero who leaves the save, and can file their return', async () => {
    const next = JSON.stringify({ heroes: [{ created: 1000, cls: 'warrior', level: 40 }, null, null] });
    const statements = await gravesFor(env, 'u1', next, now);
    await db.batch(statements);
    const graves = (await playerDetail(env, 'u1', now))!.graves;
    expect(graves.map((g) => [g.name, g.cls, g.level])).toEqual([['Lina', 'mage', 12]]);
    const order = await restoreHero(env, 'u1', graves[0]!.id, 'asked by ticket', 'a', now);
    expect(order).toBeTruthy();
    const waiting = await waitingOrders(env, 'u1');
    expect(waiting[0]).toMatchObject({ kind: 'restore', created: 2000 });
    expect((waiting[0]!.payload as { hero: { name: string } }).hero.name).toBe('Lina');
    expect(await restoreHero(env, 'u1', graves[0]!.id, '', 'a', now)).toBeNull();
    // nobody else's hero can be asked for
    expect(await restoreHero(env, 'u2', graves[0]!.id, '', 'a', now)).toBeNull();
  });

  it('does not keep a hero who only just started, or one who stayed', async () => {
    db.sqlite.prepare('UPDATE game_saves SET data = ? WHERE user_id = ?').run(JSON.stringify({ heroes: [{ created: 7, cls: 'mage', level: 1, name: 'New' }] }), 'u2');
    expect(await gravesFor(env, 'u2', JSON.stringify({ heroes: [] }), now)).toEqual([]);
    const same = await gravesFor(env, 'u1', (db.sqlite.prepare('SELECT data FROM game_saves WHERE user_id = ?').get('u1') as { data: string }).data, now);
    expect(same).toEqual([]);
  });
});

describe('what follows the account', () => {
  it('includes the Ring and the Vigil, as Sigilfall’s', () => {
    expect(isSyncedKey('sigilfall.ring.v1')).toBe(true);
    expect(isSyncedKey('sigilfall.vigil.bests')).toBe(true);
    expect(slugOfKey('sigilfall.ring.v1')).toBe('sigilfall');
    expect(isSyncedKey('sigilfall.something.else')).toBe(false);
  });
});
