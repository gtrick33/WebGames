/** Minimal Cloudflare Pages Functions + D1 types and HTTP helpers (avoids a large types dependency). */

export interface D1Result<T> {
  results: T[];
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface Env {
  DB: D1Database;
  /** NEON RUSH's own leaderboard database (served under /play/neon-rush/api). */
  NR_DB: D1Database;
  SITE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  ADMIN_EMAILS?: string;
  MAIL_FROM?: string;
  /** Where replies to site emails go (a real inbox). */
  MAIL_REPLY_TO?: string;
  /** Secret. */
  RESEND_API_KEY?: string;
  /** Secret: enables POST /api/admin/test-email (admin addresses only). */
  ADMIN_TEST_TOKEN?: string;
  /** Secrets for the admin usage panel: an API token with Account Analytics Read, and the account id. */
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  /** Secret: a GitHub token with Issues read/write, so bug reports and crashes open issues (#7). */
  GITHUB_TOKEN?: string;
  /** owner/name of the issues board (default gtrick33/WebGames). */
  GITHUB_REPO?: string;
  /** Local development only (set in .dev.vars). */
  DEV_LOGIN?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  params?: Record<string, string | string[]>;
  waitUntil?: (p: Promise<unknown>) => void;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const bad = (error: string, status = 400, extra: Record<string, unknown> = {}): Response => json({ error, ...extra }, status);

export async function readJson(request: Request, maxBytes = 8192): Promise<Record<string, unknown> | null> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const body: unknown = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** State-changing requests must come from our own pages (CSRF protection on top of SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export function isLocal(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function siteUrl(env: Env, request: Request): string {
  return isLocal(request) ? new URL(request.url).origin : (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function utcDay(ms = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function int(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : Number.NaN;
}
