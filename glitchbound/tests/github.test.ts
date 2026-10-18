import { describe, expect, it } from 'vitest';
import { bugIssue, commentIssue, crashIssue, createIssue, fenced, fingerprint, githubEnabled, issueUrl, repoOf, safeTitle } from '../server/github';
import type { Env } from '../server/http';

const env = (over: Partial<Env> = {}): Env => ({ DB: {} as Env['DB'], NR_DB: {} as Env['NR_DB'], ...over });

describe('GitHub issues for bug reports and crashes (#7)', () => {
  it('is off without a token and targets the default board', () => {
    expect(githubEnabled(env())).toBe(false);
    expect(githubEnabled(env({ GITHUB_TOKEN: 't' }))).toBe(true);
    expect(repoOf(env())).toBe('gtrick33/WebGames');
    expect(repoOf(env({ GITHUB_REPO: 'me/other' }))).toBe('me/other');
    expect(repoOf(env({ GITHUB_REPO: 'not a repo/../x' }))).toBe('gtrick33/WebGames');
    expect(issueUrl(env(), 12)).toBe('https://github.com/gtrick33/WebGames/issues/12');
  });

  it('keeps player text inert: fenced, no early fence close, no mentions in titles', () => {
    const f = fenced('hi @octocat\n```\n![x](http://evil)');
    expect(f.startsWith('```text\n')).toBe(true);
    expect(f.endsWith('\n```')).toBe(true);
    // Only the opening and closing fences remain.
    expect(f.match(/```/g)).toHaveLength(2);
    expect(safeTitle('ping @octocat now')).not.toMatch(/@o/);
    expect(safeTitle('a\nb')).toBe('a b');
    expect(safeTitle('x'.repeat(300)).length).toBeLessThanOrEqual(110);
  });

  it('groups the same crash together whatever the numbers in it', () => {
    const a = fingerprint('game_crash', 'wing-it', 'Cannot read properties of undefined (reading 3) at 120:44');
    const b = fingerprint('game_crash', 'wing-it', 'Cannot read properties of undefined (reading 7) at 121:9');
    expect(a).toBe(b);
    expect(fingerprint('game_crash', 'mini-racer', 'Cannot read properties of undefined (reading 3)')).not.toBe(a);
  });

  it('builds a bug-labelled issue without contact details', () => {
    const issue = bugIssue({ id: 4, title: 'Car stuck', description: 'It froze. Email me at me@x.com', game: 'mini-racer', gameTitle: 'Mini Racer', category: 'bug', severity: 'blocker', device: 'Safari', page: '/games/mini-racer', member: true }, 'https://site');
    expect(issue.labels).toEqual(['bug']);
    expect(issue.title).toBe('[Bug report] Mini Racer: Car stuck');
    expect(issue.body).toContain('| Severity | blocker |');
    expect(issue.body).toContain('```text\nIt froze.');
    const crash = crashIssue({ kind: 'game_crash', game: 'wing-it', gameTitle: 'Wing It', message: 'boom', stack: 'at draw (/assets/x.js:1:2)', path: '/games/wing-it', browser: 'Chrome' });
    expect(crash.labels).toEqual(['bug']);
    expect(crash.title).toBe('[Crash] Wing It: boom');
    expect(crash.body).toContain('**Stack**');
  });

  it('calls the GitHub API with the token and survives failures', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ number: 99 }), { status: 201 });
    }) as unknown as typeof fetch;
    const e = env({ GITHUB_TOKEN: 'secret' });
    expect(await createIssue(e, { title: 't', body: 'b', labels: ['bug'] }, ok)).toBe(99);
    expect(calls[0]!.url).toBe('https://api.github.com/repos/gtrick33/WebGames/issues');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer secret');
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ labels: ['bug'] });
    expect(await commentIssue(e, 99, 'again', ok)).toBe(true);
    expect(calls[1]!.url).toBe('https://api.github.com/repos/gtrick33/WebGames/issues/99/comments');

    const down = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    expect(await createIssue(e, { title: 't', body: 'b', labels: ['bug'] }, down)).toBeNull();
    const offline = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await createIssue(e, { title: 't', body: 'b', labels: ['bug'] }, offline)).toBeNull();
    // No token: no request at all.
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await createIssue(env(), { title: 't', body: 'b', labels: ['bug'] }, spy)).toBeNull();
    expect(called).toBe(false);
  });
});
