import { getGame } from '../../src/catalog/catalog';
import { commentIssue, crashIssue, createIssue, CRASH_MILESTONES, DAILY_CRASH_ISSUES, fingerprint, githubEnabled, later } from '../../server/github';
import { json, readJson, sameOrigin, type Ctx, type Env } from '../../server/http';
import { browserFamily } from '../../server/visitor';

const KINDS = new Set(['js_error', 'unhandled_rejection', 'game_load_timeout', 'game_load_failed', 'game_crash', 'api_error']);
/** Errors that happen mid-game go to the GitHub issues board (issue #7). */
const CRASH_KINDS = new Set(['game_crash', 'js_error', 'unhandled_rejection']);

/** POST /api/errors { kind, message, game?, path?, stack? }: crash and bug reports from players' browsers. */
export async function onRequestPost({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  const body = await readJson(request, 8192);
  const kind = typeof body?.kind === 'string' && KINDS.has(body.kind) ? body.kind : null;
  if (!kind) return json({ ok: false }, 400);
  const game = typeof body?.game === 'string' && getGame(body.game) ? body.game : '';
  const message = typeof body?.message === 'string' ? body.message.slice(0, 300) : '';
  const path = typeof body?.path === 'string' ? body.path.slice(0, 120) : '';
  const stack = typeof body?.stack === 'string' ? body.stack.slice(0, 2000) : '';
  const browser = browserFamily(request.headers.get('user-agent') ?? '');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO errors (ts, kind, game, message, path, browser) VALUES (?, ?, ?, ?, ?, ?)').bind(now, kind, game, message, path, browser),
    env.DB.prepare('DELETE FROM errors WHERE ts < ?').bind(now - 90 * 86400_000),
  ]);
  if (game && CRASH_KINDS.has(kind) && githubEnabled(env)) await later(waitUntil, trackCrash(env, { kind, game, message, stack, path, browser }, now));
  return json({ ok: true });
}

/** One GitHub issue per distinct crash; repeats only bump its count (with a comment at milestones). */
async function trackCrash(env: Env, c: { kind: string; game: string; message: string; stack: string; path: string; browser: string }, now: number): Promise<void> {
  const fp = fingerprint(c.kind, c.game, c.message);
  const row = await env.DB.prepare(
    'INSERT INTO error_issues (fp, kind, game, message, count, first_ts, last_ts) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(fp) DO UPDATE SET count = count + 1, last_ts = excluded.last_ts RETURNING issue, count',
  )
    .bind(fp, c.kind, c.game, c.message, now, now)
    .first<{ issue: number | null; count: number }>();
  if (!row) return;
  if (row.issue) {
    if (CRASH_MILESTONES.includes(row.count)) await commentIssue(env, row.issue, `This error has now happened **${row.count.toLocaleString('en-US')} times** (latest: ${c.browser || 'unknown browser'}, \`${c.path.replace(/`/g, '')}\`).`);
    return;
  }
  // Only the first sighting opens an issue, and only a few new ones a day.
  if (row.count !== 1) return;
  const opened = await env.DB.prepare('SELECT COUNT(*) AS n FROM error_issues WHERE issue IS NOT NULL AND first_ts > ?').bind(now - 86400_000).first<{ n: number }>();
  if ((opened?.n ?? 0) >= DAILY_CRASH_ISSUES) return;
  const n = await createIssue(env, crashIssue({ ...c, gameTitle: getGame(c.game)?.title ?? c.game }));
  if (n) await env.DB.prepare('UPDATE error_issues SET issue = ? WHERE fp = ?').bind(n, fp).run();
}
