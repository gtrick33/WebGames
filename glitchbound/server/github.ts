import type { Env } from './http';

/**
 * Mirrors bug reports and in-game crashes to the GitHub issues board, labelled "bug" (issue #7).
 *
 * Needs the GITHUB_TOKEN secret: a fine-grained token for the repository with Issues read and
 * write. Without it nothing is sent and reports simply stay in D1 (the admin page still shows them).
 * Player text is untrusted: it goes inside a code fence, so it can't @mention anyone, embed images
 * or reference other issues, and contact details are never sent.
 */

export const DEFAULT_REPO = 'gtrick33/WebGames';
/** Issues filed per day, at most (each source), so a flood of reports can't flood the board. */
export const DAILY_BUG_ISSUES = 25;
export const DAILY_CRASH_ISSUES = 10;
/** A crash issue gets a comment when its count reaches one of these. */
export const CRASH_MILESTONES = [10, 100, 1000, 10000];

export const githubEnabled = (env: Env): boolean => !!env.GITHUB_TOKEN;
export const repoOf = (env: Env): string => (env.GITHUB_REPO && /^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO) ? env.GITHUB_REPO : DEFAULT_REPO);
export const issueUrl = (env: Env, n: number): string => `https://github.com/${repoOf(env)}/issues/${n}`;

/** Player text inside a fence: backtick runs are broken up so the fence can't be closed early. */
export function fenced(text: string): string {
  const safe = text.replace(/`{3,}/g, (m) => m.split('').join('​'));
  return `\`\`\`text\n${safe.trim() || '(empty)'}\n\`\`\``;
}

/** A one-line title: no @mentions (they would notify people), no line breaks. */
export function safeTitle(text: string, max = 110): string {
  const one = text.replace(/\s+/g, ' ').replace(/@(?=\w)/g, '@​').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/** Same crash, same fingerprint: numbers, hex ids and URLs are blurred so variants group together. */
export function fingerprint(kind: string, game: string, message: string): string {
  const norm = message
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, 'URL')
    .replace(/\b[0-9a-f]{8,}\b/g, 'HEX')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return `${kind}|${game}|${norm}`;
}

export interface BugIssueInput {
  id: number;
  title: string;
  description: string;
  game: string;
  gameTitle: string;
  category: string;
  severity: string;
  device: string;
  page: string;
  member: boolean;
}

export function bugIssue(b: BugIssueInput, siteUrl: string): { title: string; body: string; labels: string[] } {
  const rows = [
    ['Report', `#${b.id} (admin: ${siteUrl}/admin)`],
    ['Game', b.gameTitle || 'The arcade'],
    ['Category', b.category],
    ['Severity', b.severity],
    ['Device', b.device || 'unknown'],
    ['Page', b.page ? `\`${b.page.replace(/`/g, '')}\`` : 'unknown'],
    ['From', b.member ? 'a signed-in member' : 'a guest'],
  ];
  return {
    title: safeTitle(`[Bug report] ${b.gameTitle ? `${b.gameTitle}: ` : ''}${b.title}`),
    body: [`A player filed this from the site's bug report form.`, '', '| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`), '', '**What happened**', '', fenced(b.description), '', '_Filed automatically by GlitchBound. Close this issue when it is fixed._'].join('\n'),
    labels: ['bug'],
  };
}

export interface CrashIssueInput {
  kind: string;
  game: string;
  gameTitle: string;
  message: string;
  stack: string;
  path: string;
  browser: string;
}

const KIND_NAMES: Record<string, string> = {
  game_crash: 'Game crashed',
  js_error: 'Script error during a game',
  unhandled_rejection: 'Unhandled promise rejection during a game',
};

export function crashIssue(c: CrashIssueInput): { title: string; body: string; labels: string[] } {
  return {
    title: safeTitle(`[Crash] ${c.gameTitle || c.game}: ${c.message || c.kind}`),
    body: [
      `${KIND_NAMES[c.kind] ?? c.kind} while a player was in **${c.gameTitle || c.game}**.`,
      '',
      `- Page: \`${c.path.replace(/`/g, '') || '/'}\``,
      `- Browser: ${c.browser || 'unknown'}`,
      '',
      '**Error**',
      '',
      fenced(c.message),
      ...(c.stack ? ['', '**Stack**', '', fenced(c.stack)] : []),
      '',
      '_Filed automatically by GlitchBound. Repeats of the same error are counted here instead of opening new issues._',
    ].join('\n'),
    labels: ['bug'],
  };
}

async function call(env: Env, path: string, body: unknown, fetcher: typeof fetch): Promise<Record<string, unknown> | null> {
  if (!env.GITHUB_TOKEN) return null;
  try {
    const res = await fetcher(`https://api.github.com/repos/${repoOf(env)}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'glitchbound-site',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[github] request failed', path, res.status);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.warn('[github] request failed', path, e);
    return null;
  }
}

/** Opens an issue; returns its number, or null when GitHub is off or the call failed. */
export async function createIssue(env: Env, issue: { title: string; body: string; labels: string[] }, fetcher: typeof fetch = fetch): Promise<number | null> {
  const out = await call(env, '/issues', issue, fetcher);
  return typeof out?.number === 'number' ? out.number : null;
}

export async function commentIssue(env: Env, n: number, body: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  return (await call(env, `/issues/${n}/comments`, { body }, fetcher)) !== null;
}

/** Runs work after the response when the platform allows it, else waits for it. */
export async function later(waitUntil: ((p: Promise<unknown>) => void) | undefined, work: Promise<unknown>): Promise<void> {
  const safe = work.catch((e: unknown) => console.warn('[github] background work failed', e));
  if (waitUntil) waitUntil(safe);
  else await safe;
}
