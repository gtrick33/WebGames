import type { BugReportView } from '../../src/platform/apiTypes';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { countToday, parseBug } from '../../server/reports';
import { currentUser, requireUser } from '../../server/session';
import { browserFamily, visitorKey } from '../../server/visitor';

const MESSAGES = {
  title: 'Give the bug a short title (4+ characters).',
  description: 'Describe what happened in a sentence or two.',
  contact: 'That email address does not look right.',
};

/** POST /api/bugs: file a bug report (guests too; members see theirs on /me/bugs). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
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
  return json({ ok: true, id: res?.id ?? 0 });
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
