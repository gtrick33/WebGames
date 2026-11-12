/**
 * Sigilfall's game masters: what the server knows of every signed-in player's heroes, and the orders an admin files
 * for the player's game to carry out (src/games/sigilfall/progress/gm.ts). Guests' heroes never leave their device.
 * Endpoints in functions/api/admin/sigilfall and functions/api/sigilfall.
 */
import { GLOAMKNIGHT_ITEM } from '../src/catalog/shop';
import type { GmHeroRow, GmOrderView, GmOverview, GmPlayerDetail, GmPlayerRow } from '../src/platform/apiTypes';
import type { D1PreparedStatement, Env } from './http';

export const SAVE_KEY = 'glitchbound.sigilfall';
const RING_KEY = 'sigilfall.ring.v1';
const VIGIL_KEY = 'sigilfall.vigil.bests';
const SLOTS = [0, 1, 2];
const PAGE = 40;
/** A save this recent: the player is at it now. */
export const ONLINE_MS = 5 * 60_000;
const GRAVE_DAYS = 120;
const NOTE_MAX = 300;

const SORTS: Record<string, string> = {
  recent: 's.updated_at DESC',
  level: 'top_level DESC, s.updated_at DESC',
  time: 'total_time DESC, s.updated_at DESC',
  joined: 'u.created_at DESC',
};

const heroCols = SLOTS.map((i) =>
  ['name', 'cls', 'level', 'created', 'updated', 'tier', 'keystone', 'stats.time']
    .map((f) => `json_extract(s.data, '$.heroes[${i}].${f}') AS h${i}_${f.replace('.', '_')}`)
    .join(', '),
).join(', ');
const LEVELS = SLOTS.map((i) => `COALESCE(json_extract(s.data, '$.heroes[${i}].level'), 0)`);
const TIMES = SLOTS.map((i) => `COALESCE(json_extract(s.data, '$.heroes[${i}].stats.time'), 0)`);

type Row = Record<string, unknown>;

function heroesOf(row: Row): GmHeroRow[] {
  const out: GmHeroRow[] = [];
  for (const i of SLOTS) {
    if (typeof row[`h${i}_cls`] !== 'string') continue;
    out.push({
      slot: i,
      name: String(row[`h${i}_name`] ?? ''),
      cls: String(row[`h${i}_cls`]),
      level: Number(row[`h${i}_level`] ?? 1),
      created: Number(row[`h${i}_created`] ?? 0),
      updated: Number(row[`h${i}_updated`] ?? 0),
      tier: Number(row[`h${i}_tier`] ?? 0),
      keystone: Number(row[`h${i}_keystone`] ?? 0),
      time: Number(row[`h${i}_stats_time`] ?? 0),
    });
  }
  return out;
}

const likeOf = (q: string): string => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** One page of the players who have a save on the server, found by nickname, email, player id or hero name. */
export async function listPlayers(env: Env, q: string, sort: string, offset: number, now = Date.now()): Promise<{ rows: GmPlayerRow[]; total: number; page: number }> {
  const term = q.trim().slice(0, 80);
  const like = likeOf(term);
  const heroName = SLOTS.map((i) => `json_extract(s.data, '$.heroes[${i}].name') LIKE ? ESCAPE '\\'`).join(' OR ');
  const where = `s.key = ? AND (? = '' OR u.id = ? OR u.nickname LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR ${heroName})`;
  const args = [SAVE_KEY, term, term, like, like, ...SLOTS.map(() => like)];
  const [rows, count] = await Promise.all([
    env.DB.prepare(
      `SELECT u.id, u.nickname, u.email, u.created_at, u.last_seen, u.banned_at, s.updated_at AS saved_at, ${heroCols},
         MAX(${LEVELS.join(', ')}) AS top_level, (${TIMES.join(' + ')}) AS total_time
       FROM game_saves s JOIN users u ON u.id = s.user_id
       WHERE ${where} ORDER BY ${SORTS[sort] ?? SORTS.recent} LIMIT ? OFFSET ?`,
    )
      .bind(...args, PAGE, Math.max(0, Math.floor(offset)))
      .all<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM game_saves s JOIN users u ON u.id = s.user_id WHERE ${where}`)
      .bind(...args)
      .first<{ n: number }>(),
  ]);
  return {
    total: count?.n ?? 0,
    page: PAGE,
    rows: rows.results.map((r) => {
      const savedAt = Number(r.saved_at);
      return {
        id: String(r.id),
        nickname: String(r.nickname),
        email: String(r.email),
        createdAt: Number(r.created_at),
        lastSeen: Number(r.last_seen),
        savedAt,
        online: now - savedAt < ONLINE_MS,
        banned: !!r.banned_at,
        heroes: heroesOf(r),
      };
    }),
  };
}

/** The numbers at the top of the list. */
export async function overview(env: Env, now = Date.now()): Promise<GmOverview> {
  const [players, classes, waiting] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n, SUM(updated_at > ?) AS online, SUM(updated_at > ?) AS week FROM game_saves WHERE key = ?`)
      .bind(now - ONLINE_MS, now - 7 * 86400_000, SAVE_KEY)
      .first<{ n: number; online: number | null; week: number | null }>(),
    env.DB.prepare(
      `SELECT json_extract(h.value, '$.cls') AS cls, COUNT(*) AS n, AVG(json_extract(h.value, '$.level')) AS avg, MAX(json_extract(h.value, '$.level')) AS top
       FROM game_saves s, json_each(s.data, '$.heroes') h WHERE s.key = ? AND h.type = 'object' GROUP BY cls ORDER BY n DESC`,
    )
      .bind(SAVE_KEY)
      .all<{ cls: string; n: number; avg: number; top: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM sigilfall_orders WHERE applied_at IS NULL AND cancelled_at IS NULL').first<{ n: number }>(),
  ]);
  return {
    players: players?.n ?? 0,
    online: players?.online ?? 0,
    active7d: players?.week ?? 0,
    heroes: classes.results.reduce((a, c) => a + c.n, 0),
    waiting: waiting?.n ?? 0,
    classes: classes.results.map((c) => ({ cls: c.cls, heroes: c.n, avgLevel: Math.round(c.avg * 10) / 10, topLevel: c.top })),
  };
}

function orderView(r: Row): GmOrderView {
  return {
    id: String(r.id),
    slot: Number(r.slot),
    created: Number(r.created),
    heroName: String(r.hero_name ?? ''),
    kind: String(r.kind),
    summary: String(r.summary),
    note: String(r.note ?? ''),
    by: String(r.created_by),
    at: Number(r.created_at),
    appliedAt: r.applied_at === null || r.applied_at === undefined ? null : Number(r.applied_at),
    result: String(r.result ?? ''),
    cancelledAt: r.cancelled_at === null || r.cancelled_at === undefined ? null : Number(r.cancelled_at),
  };
}

const parseJson = (s: string | undefined): unknown => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** Everything the server holds of one player's Sigilfall. */
export async function playerDetail(env: Env, userId: string, now = Date.now()): Promise<GmPlayerDetail | null> {
  const u = await env.DB.prepare('SELECT id, nickname, email, created_at, last_seen, banned_at, ban_reason FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; nickname: string; email: string; created_at: number; last_seen: number; banned_at: number | null; ban_reason: string | null }>();
  if (!u) return null;
  const [saves, orders, graves, bought] = await Promise.all([
    env.DB.prepare(`SELECT key, data, updated_at FROM game_saves WHERE user_id = ? AND key IN (?, ?, ?)`).bind(userId, SAVE_KEY, RING_KEY, VIGIL_KEY).all<{ key: string; data: string; updated_at: number }>(),
    env.DB.prepare('SELECT * FROM sigilfall_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(userId).all<Row>(),
    env.DB.prepare('SELECT id, created, name, cls, level, deleted_at, restored_at FROM sigilfall_graves WHERE user_id = ? ORDER BY deleted_at DESC LIMIT 20')
      .bind(userId)
      .all<{ id: string; created: number; name: string; cls: string; level: number; deleted_at: number; restored_at: number | null }>(),
    // what they bought for the game (the pack, mounts, looks): a refunded purchase doesn't count
    env.DB.prepare("SELECT DISTINCT product FROM purchases WHERE user_id = ? AND status = 'paid' AND (product = ? OR product LIKE 'sigilfall-%') ORDER BY product")
      .bind(userId, GLOAMKNIGHT_ITEM)
      .all<{ product: string }>()
      .catch(() => ({ results: [] as { product: string }[] })),
  ]);
  const of = (key: string) => saves.results.find((s) => s.key === key);
  const save = of(SAVE_KEY);
  return {
    id: u.id,
    nickname: u.nickname,
    email: u.email,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    banned: !!u.banned_at,
    banReason: u.ban_reason ?? '',
    savedAt: save?.updated_at ?? 0,
    online: !!save && now - save.updated_at < ONLINE_MS,
    save: parseJson(save?.data),
    ring: parseJson(of(RING_KEY)?.data),
    vigil: parseJson(of(VIGIL_KEY)?.data),
    bought: bought.results.map((r) => r.product),
    orders: orders.results.map(orderView),
    graves: graves.results.map((g) => ({ id: g.id, created: g.created, name: g.name, cls: g.cls, level: g.level, deletedAt: g.deleted_at, restoredAt: g.restored_at })),
  };
}

/* ------------------------------------------------------------------ orders */

export interface OrderInput {
  kind: string;
  payload: Record<string, unknown>;
  summary: string;
  /** Orders to the player, not to one hero. */
  forPlayer: boolean;
}

const short = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** Checks an order's shape and ranges (whether its ids exist, the game checks when it carries it out). */
export function checkOrder(kind: string, raw: unknown, label: string): OrderInput | string {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const named = label || short(p.id, 60);
  const amount = (word: string, max: number): OrderInput | string => {
    const n = whole(p.amount);
    if (n === null || n === 0 || Math.abs(n) > max) return `Give or take between 1 and ${max.toLocaleString('en')} ${word}.`;
    return { kind, payload: { amount: n }, summary: n > 0 ? `Give ${n.toLocaleString('en')} ${word}` : `Take ${(-n).toLocaleString('en')} ${word}`, forPlayer: false };
  };
  const hero = (payload: Record<string, unknown>, summary: string): OrderInput => ({ kind, payload, summary, forPlayer: false });
  switch (kind) {
    case 'gold':
      return amount('gold', 1_000_000_000);
    case 'shards':
      return amount('shards', 99);
    case 'marks':
      return amount('Sigil Marks', 1_000_000);
    case 'potions':
      return amount('potions', 10);
    case 'level': {
      const n = whole(p.level);
      if (n === null || n < 1 || n > 60) return 'A level is between 1 and 60.';
      return hero({ level: n }, `Set level to ${n}`);
    }
    case 'item': {
      const id = short(p.id, 60);
      const il = whole(p.il);
      if (!id) return 'Pick an item.';
      if (il === null || il < 1 || il > 200) return 'An item level is between 1 and 200.';
      return hero({ id, il }, `Give ${named} (item level ${il})`);
    }
    case 'gear': {
      const rarity = short(p.rarity, 12);
      const slot = short(p.slot, 12);
      const il = whole(p.il);
      if (!rarity || !slot) return 'Pick a rarity and a slot.';
      if (il === null || il < 1 || il > 200) return 'An item level is between 1 and 200.';
      return hero({ rarity, slot, il }, `Give a ${rarity} ${slot} (item level ${il})`);
    }
    case 'removeItem': {
      const uid = short(p.uid, 40);
      if (!uid) return 'Pick an item.';
      return hero({ uid }, `Remove ${label || 'an item'}`);
    }
    case 'quest': {
      const id = short(p.id, 60);
      const state = short(p.state, 12);
      if (!id || !['done', 'active', 'reset'].includes(state)) return 'Pick a quest and what to do with it.';
      const verb = state === 'done' ? 'Complete' : state === 'active' ? 'Make active' : 'Reset';
      return hero({ id, state }, `${verb} quest: ${named}`);
    }
    case 'unlock': {
      const id = short(p.id, 60);
      if (!id) return 'Pick a land.';
      return hero({ id }, `Open ${named}`);
    }
    case 'tier': {
      const n = whole(p.tier);
      if (n === null || n < 0 || n > 2) return 'Pick a difficulty.';
      return hero({ tier: n }, `Set difficulty to ${['Normal', 'Heroic', 'Mythic'][n]}`);
    }
    case 'keystone': {
      const n = whole(p.level);
      if (n === null || n < 0 || n > 999) return 'A Riftstone level is between 0 and 999.';
      return hero({ level: n }, `Set Riftstone to ${n}`);
    }
    case 'respec':
      return hero({}, 'Give a free talent reset');
    case 'mount':
    case 'look':
    case 'perk': {
      const id = short(p.id, 64);
      if (!id) return 'Pick one.';
      return hero({ id }, `Give ${kind === 'mount' ? 'mount' : kind === 'look' ? 'look' : 'gift'}: ${named}`);
    }
    case 'rename': {
      const name = short(p.name, 16);
      if (!name) return 'Type a name.';
      return hero({ name }, `Rename to ${name}`);
    }
    case 'message': {
      const text = short(p.text, 240);
      if (!text) return 'Type a message.';
      return { kind, payload: { text }, summary: `Message: ${text}`, forPlayer: true };
    }
    default:
      return 'Unknown order.';
  }
}

export interface OrderTarget {
  userId: string;
  slot: number;
  created: number;
  heroName: string;
}

export async function fileOrder(env: Env, target: OrderTarget, order: OrderInput, note: string, by: string, now = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO sigilfall_orders (id, user_id, slot, created, hero_name, kind, payload, summary, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, target.userId, target.slot, target.created, target.heroName, order.kind, JSON.stringify(order.payload), order.summary, note.trim().slice(0, NOTE_MAX), by, now)
    .run();
  return id;
}

/** Calls an order back, if the game hasn't carried it out yet. */
export async function cancelOrder(env: Env, id: string, now = Date.now()): Promise<boolean> {
  const r = await env.DB.prepare('UPDATE sigilfall_orders SET cancelled_at = ? WHERE id = ? AND applied_at IS NULL AND cancelled_at IS NULL').bind(now, id).run();
  return Number((r as { meta?: { changes?: number }; changes?: number })?.meta?.changes ?? (r as { changes?: number })?.changes ?? 0) > 0;
}

/** Files the order that brings a deleted hero back into a free slot of their save. */
export async function restoreHero(env: Env, userId: string, graveId: string, note: string, by: string, now = Date.now()): Promise<string | null> {
  const g = await env.DB.prepare('SELECT * FROM sigilfall_graves WHERE id = ? AND user_id = ? AND restored_at IS NULL').bind(graveId, userId).first<{ id: string; created: number; name: string; level: number; data: string }>();
  if (!g) return null;
  const payload = { hero: JSON.parse(g.data) as unknown };
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO sigilfall_orders (id, user_id, slot, created, hero_name, kind, payload, summary, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, userId, -1, g.created, g.name, 'restore', JSON.stringify(payload), `Bring back ${g.name} (level ${g.level})`, note.trim().slice(0, NOTE_MAX), by, now),
    env.DB.prepare('UPDATE sigilfall_graves SET restored_at = ? WHERE id = ?').bind(now, g.id),
  ]);
  return id;
}

/* ------------------------------------------------------------------ the player's own game */

export interface WaitingOrder {
  id: string;
  slot: number;
  created: number;
  kind: string;
  payload: unknown;
}

export async function waitingOrders(env: Env, userId: string): Promise<WaitingOrder[]> {
  const rows = await env.DB.prepare('SELECT id, slot, created, kind, payload FROM sigilfall_orders WHERE user_id = ? AND applied_at IS NULL AND cancelled_at IS NULL ORDER BY created_at LIMIT 25')
    .bind(userId)
    .all<{ id: string; slot: number; created: number; kind: string; payload: string }>();
  return rows.results.map((r) => ({ id: r.id, slot: r.slot, created: r.created, kind: r.kind, payload: parseJson(r.payload) ?? {} }));
}

/** The game says how orders went. An order is only ever closed by the player it belongs to. */
export async function closeOrders(env: Env, userId: string, done: { id: string; result: string }[], now = Date.now()): Promise<void> {
  if (!done.length) return;
  await env.DB.batch(
    done.map((d) =>
      env.DB.prepare('UPDATE sigilfall_orders SET applied_at = ?, result = ? WHERE id = ? AND user_id = ? AND applied_at IS NULL').bind(now, d.result.slice(0, 200), d.id, userId),
    ),
  );
}

/* ------------------------------------------------------------------ deleted heroes */

interface SavedHero {
  created?: unknown;
  name?: unknown;
  cls?: unknown;
  level?: unknown;
}

const heroesIn = (data: string): SavedHero[] => {
  const v = parseJson(data) as { heroes?: unknown } | null;
  return Array.isArray(v?.heroes) ? (v.heroes.filter((h) => h && typeof h === 'object') as SavedHero[]) : [];
};

/**
 * When a new copy of the save has lost a hero the stored copy has, that hero's last copy is kept for a while (statements
 * to run with the save's own). A hero who only just started isn't worth keeping.
 */
export async function gravesFor(env: Env, userId: string, next: string | null, now = Date.now()): Promise<D1PreparedStatement[]> {
  const stored = await env.DB.prepare('SELECT data FROM game_saves WHERE user_id = ? AND key = ?').bind(userId, SAVE_KEY).first<{ data: string }>();
  if (!stored) return [];
  const staying = new Set((next === null ? [] : heroesIn(next)).map((h) => h.created));
  const out: D1PreparedStatement[] = [];
  for (const h of heroesIn(stored.data)) {
    if (staying.has(h.created) || typeof h.created !== 'number' || typeof h.cls !== 'string' || Number(h.level) < 2) continue;
    out.push(
      env.DB.prepare(
        `INSERT INTO sigilfall_graves (id, user_id, created, name, cls, level, data, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, created) DO UPDATE SET name = excluded.name, level = excluded.level, data = excluded.data, deleted_at = excluded.deleted_at, restored_at = NULL`,
      ).bind(crypto.randomUUID(), userId, h.created, String(h.name ?? 'Hero').slice(0, 20), h.cls, Number(h.level), JSON.stringify(h), now),
    );
  }
  if (out.length) out.push(env.DB.prepare('DELETE FROM sigilfall_graves WHERE deleted_at < ?').bind(now - GRAVE_DAYS * 86400_000));
  return out;
}
