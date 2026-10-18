import { getGame } from '../../src/catalog/catalog';
import type { BugReportView } from '../../src/platform/apiTypes';
import { bugIssue, createIssue, DAILY_BUG_ISSUES, githubEnabled, later } from '../../server/github';
import { bad, json, readJson, sameOrigin, type Ctx, type Env } from '../../server/http';
import type { BugInput } from '../../server/reports';
import { countToday, parseBug } from '../../server/reports';
import { currentUser, requireUser } from '../../server/session';
import { browserFamily, visitorKey } from '../../server/visitor';

const MESSAGES = {
  title: 'Give the bug a short title (4+ characters).',
  description: 'Describe what happened in a sentence or two.',
  contact: 'That email address does not look right.',
};

/** POST /api/bugs: file a bug report (guests too; members see theirs on /me/bugs). */
export async function onRequestPost({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('forbidden', 403);
  const input = parseBug(await readJson(request, 12_000));
  if (typeof input === 'string') return bad(input, 400, { message: MESSAGES[input] });
  const now = Date.now();
  const [visitor, user] = await Promise.all([visitorKey(request, now), currentUser(env, request)]);
  if ((await countToday(env, 'bug_reports', visitor, user?.id ?? null, now)) >= 10) return bad('too_many', 429, { message: 'Thanks for all the reports! Please try again tomorrow.' });
  const device = `${browserFamily(request.headers.get('user-agent') ?? '')}${input.device ? ` · ${input.device}` : ''}`.slice(0, 200);
  const res = await env.DB.prepare(
    'INSERT INTO bug_reports (ts, title, description, game, category, severity, device, page, contact, visitor, user_id, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(now, input.title, input.description, input.game, input.category, input.severity, device, input.page, input.contact || user?.email || '', visitor, user?.id ?? null, 'open', now)
    .first<{ id: number }>();
  const id = res?.id ?? 0;
  if (id && githubEnabled(env)) await later(waitUntil, fileOnGithub(env, id, input, device, !!user, now));
  return json({ ok: true, id });
}

/** Mirrors a new report to the GitHub issues board with the "bug" label (issue #7). */
async function fileOnGithub(env: Env, id: number, input: BugInput, device: string, member: boolean, now: number): Promise<void> {
  const filed = await env.DB.prepare('SELECT COUNT(*) AS n FROM bug_reports WHERE github_issue IS NOT NULL AND ts > ?').bind(now - 86400_000).first<{ n: number }>();
  if ((filed?.n ?? 0) >= DAILY_BUG_ISSUES) return;
  const site = (env.SITE_URL ?? '').replace(/\/$/, '');
  const issue = bugIssue({ id, title: input.title, description: input.description, game: input.game, gameTitle: input.game ? (getGame(input.game)?.title ?? input.game) : '', category: input.category, severity: input.severity, device, page: input.page, member }, site);
  const n = await createIssue(env, issue);
  if (n) await env.DB.prepare('UPDATE bug_reports SET github_issue = ? WHERE id = ?').bind(n, id).run();
}

/** GET /api/bugs: the signed-in member's own reports, newest first. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const { results } = await env.DB.prepare(
    'SELECT id, ts, title, game, category, severity, status, admin_note, updated_at FROM bug_reports WHERE user_id = ? ORDER BY ts DESC LIMIT 50',
  )
    .bind(user.id)
    .all<{ id: number; ts: number; title: string; game: string; category: string; severity: string; status: string; admin_note: string; updated_at: number }>();
  const reports: BugReportView[] = results.map((r) => ({
    id: r.id,
    ts: r.ts,
    title: r.title,
    game: r.game,
    category: r.category,
    severity: r.severity,
    status: r.status,
    note: r.admin_note,
    updatedAt: r.updated_at,
  }));
  return json({ reports });
}
