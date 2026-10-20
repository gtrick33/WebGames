import { getGame } from '../src/catalog/catalog';
import type { Env } from './http';

/** Shared validation for player feedback and bug reports (pure, unit tested). */

export const BUG_CATEGORIES = ['bug', 'visual', 'performance', 'scores', 'account', 'idea', 'question'] as const;
export const BUG_SEVERITIES = ['blocker', 'annoying', 'minor'] as const;
export const BUG_STATUSES = ['open', 'fixed', 'wontfix'] as const;
export const FEEDBACK_WISHES = ['more_games', 'harder', 'easier', 'multiplayer', 'more_dailies', 'better_mobile', 'nothing'] as const;

export type BugCategory = (typeof BUG_CATEGORIES)[number];
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
export type BugStatus = (typeof BUG_STATUSES)[number];

/** Keeps tabs and newlines, drops other control characters. */
const clean = (v: string): string =>
  [...v]
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
    })
    .join('');

const text = (v: unknown, max: number): string => (typeof v === 'string' ? clean(v).trim().slice(0, max) : '');

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);

export interface FeedbackInput {
  stars: number;
  message: string;
  game: string;
  wish: string;
}

export function parseFeedback(body: Record<string, unknown> | null): FeedbackInput | null {
  if (!body) return null;
  const stars = typeof body.stars === 'number' ? Math.round(body.stars) : NaN;
  if (!(stars >= 1 && stars <= 5)) return null;
  const game = typeof body.game === 'string' && getGame(body.game) ? body.game : '';
  const wish = typeof body.wish === 'string' && (FEEDBACK_WISHES as readonly string[]).includes(body.wish) ? body.wish : '';
  return { stars, message: text(body.message, 1000), game, wish };
}

export interface BugInput {
  title: string;
  description: string;
  game: string;
  category: BugCategory;
  severity: BugSeverity;
  device: string;
  page: string;
  contact: string;
}

export type BugError = 'title' | 'description' | 'contact';

export function parseBug(body: Record<string, unknown> | null): BugInput | BugError {
  const title = text(body?.title, 120);
  const description = text(body?.description, 4000);
  if (title.length < 4) return 'title';
  if (description.length < 10) return 'description';
  const contact = text(body?.contact, 120);
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return 'contact';
  return {
    title,
    description,
    game: typeof body?.game === 'string' && getGame(body.game) ? body.game : '',
    category: oneOf(body?.category, BUG_CATEGORIES, 'bug'),
    severity: oneOf(body?.severity, BUG_SEVERITIES, 'annoying'),
    device: text(body?.device, 200),
    page: text(body?.page, 200),
    contact,
  };
}

/** How many rows this visitor (or member) added to a table today. */
export async function countToday(env: Env, table: 'feedback' | 'bug_reports', visitor: string, userId: string | null, now: number): Promise<number> {
  const since = now - 86400_000;
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ts > ? AND (visitor = ? OR (user_id IS NOT NULL AND user_id = ?))`)
    .bind(since, visitor, userId ?? '')
    .first<{ n: number }>();
  return row?.n ?? 0;
}
