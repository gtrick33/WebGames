/**
 * The QA audit trail (table qa_audit, append-only): kept for legal purposes, it records every API
 * request a QA tester makes (the API middleware), every QA tool they use and their sign-ins. Admins
 * are never written here. Secrets in request bodies (codes, tokens) are blanked before storing.
 */
import type { Env } from './http';
import type { UserRow } from './session';

export type AuditKind = 'request' | 'action' | 'auth';

export interface AuditEntry {
  kind: AuditKind;
  /** 'coins.grant', 'player.ban', 'email.send', 'tool.reset'... or 'POST /api/runs/end' for requests. */
  action: string;
  target?: { id: string; email: string } | null;
  detail?: unknown;
  status?: number | null;
}

const SECRET_KEYS = /^(code|credential|accesstoken|token|password|secret|key)$/i;
const MAX_DETAIL = 6000;

/** Any value as stored in the trail: secrets (codes, tokens) blanked at any depth, long text cut. */
export function scrub(v: unknown, depth = 0): unknown {
  if (depth > 8) return '…';
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => scrub(x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET_KEYS.test(k) ? '[redacted]' : scrub(x, depth + 1)]));
  return typeof v === 'string' && v.length > 2000 ? `${v.slice(0, 2000)}…` : v;
}

/** A request body as stored in the trail: JSON with secrets blanked, cut to a sane length. */
export function redactBody(text: string): unknown {
  if (!text) return null;
  try {
    return scrub(JSON.parse(text));
  } catch {
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  }
}

/** A query string as stored in the trail, with secret parameters (sign-in links, invitations) blanked. */
export function redactQuery(search: string): string | undefined {
  if (!search) return undefined;
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) if (SECRET_KEYS.test(key)) params.set(key, '[redacted]');
  return `?${params.toString()}`;
}

function detailText(detail: unknown): string {
  const text = JSON.stringify(detail ?? {}) ?? '{}';
  return text.length > MAX_DETAIL ? JSON.stringify({ truncated: text.slice(0, MAX_DETAIL) }) : text;
}

/** Writes one row. Never throws: an audit failure is reported to the logs, not to the tester. */
export async function audit(env: Env, request: Request, actor: Pick<UserRow, 'id' | 'email'>, entry: AuditEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO qa_audit (ts, actor_id, actor_email, kind, action, target_id, target_email, detail, status, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        Date.now(),
        actor.id,
        actor.email.toLowerCase(),
        entry.kind,
        entry.action.slice(0, 120),
        entry.target?.id ?? null,
        entry.target?.email.toLowerCase() ?? null,
        detailText(scrub(entry.detail)),
        entry.status ?? null,
        (request.headers.get('cf-connecting-ip') ?? '').slice(0, 64),
        (request.headers.get('user-agent') ?? '').slice(0, 300),
      )
      .run();
  } catch (err) {
    console.error('qa_audit write failed', err);
  }
}

export interface AuditRowDb {
  id: number;
  ts: number;
  actor_id: string;
  actor_email: string;
  kind: AuditKind;
  action: string;
  target_id: string | null;
  target_email: string | null;
  detail: string;
  status: number | null;
  ip: string;
  user_agent: string;
}

/** A QA tool was used: written for QA testers only (admins are not logged). */
export async function auditAction(env: Env, request: Request, staff: { user: Pick<UserRow, 'id' | 'email'>; role: 'admin' | 'qa' }, entry: Omit<AuditEntry, 'kind'>): Promise<void> {
  if (staff.role === 'qa') await audit(env, request, staff.user, { kind: 'action', ...entry });
}
