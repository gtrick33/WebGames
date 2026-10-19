import { describe, expect, it } from 'vitest';
import { parseGameMessage } from '../src/platform/contract';
import { visitInfo } from '../src/platform/visit';
import { parseBeatParam } from '../src/platform/share';
import { matchRoute } from '../src/router/router';
import { pageSpecs, renderPage, robots, sitemap } from '../scripts/seo';
import { readFileSync } from 'node:fs';

describe('game messages (untrusted postMessage input)', () => {
  const base = { source: 'glitchbound-game', version: 1 };
  it('accepts start and end events', () => {
    expect(parseGameMessage({ ...base, type: 'start' })).toEqual({ type: 'start' });
    expect(parseGameMessage({ ...base, type: 'end', score: 3, daily: true })).toEqual({ type: 'end', score: 3, stats: {}, daily: true });
    expect(parseGameMessage({ ...base, type: 'end', score: 3, daily: 'yes' })).toEqual({ type: 'end', score: 3, stats: {} });
    expect(parseGameMessage({ ...base, type: 'end', score: 12.7, stats: { meters: 300.9, coins: 4 } })).toEqual({
      type: 'end',
      score: 12,
      stats: { meters: 300, coins: 4 },
    });
  });
  it('rejects foreign, wrong-version and malformed messages', () => {
    expect(parseGameMessage(null)).toBeNull();
    expect(parseGameMessage('end')).toBeNull();
    expect(parseGameMessage({ ...base, source: 'other', type: 'start' })).toBeNull();
    expect(parseGameMessage({ ...base, version: 2, type: 'start' })).toBeNull();
    expect(parseGameMessage({ ...base, type: 'end', score: 'lots' })).toBeNull();
    expect(parseGameMessage({ ...base, type: 'end', score: Infinity })).toBeNull();
    expect(parseGameMessage({ ...base, type: 'explode' })).toBeNull();
  });
  it('clamps values and drops bad stat keys', () => {
    const ev = parseGameMessage({ ...base, type: 'end', score: -5, stats: { ok: 1e12, 'bad key': 3, __proto__x: 1, n: NaN } });
    expect(ev).toEqual({ type: 'end', score: 0, stats: { ok: 1e9 } });
  });
});

describe('routing', () => {
  it('matches every route, with or without a trailing slash', () => {
    expect(matchRoute('/')).toEqual({ name: 'home' });
    expect(matchRoute('/games/neon-rush')).toEqual({ name: 'game', slug: 'neon-rush' });
    expect(matchRoute('/games/neon-rush/')).toEqual({ name: 'game', slug: 'neon-rush' });
    expect(matchRoute('/daily')).toEqual({ name: 'daily' });
    expect(matchRoute('/privacy')).toEqual({ name: 'privacy' });
    expect(matchRoute('/games/')).toEqual({ name: 'notfound' });
    expect(matchRoute('/games/NEON')).toEqual({ name: 'notfound' });
    expect(matchRoute('/nope')).toEqual({ name: 'notfound' });
  });
});

describe('friend challenge links', () => {
  it('only accepts a positive whole number', () => {
    expect(parseBeatParam('?beat=2431')).toBe(2431);
    expect(parseBeatParam('?beat=0')).toBeNull();
    expect(parseBeatParam('?beat=12abc')).toBeNull();
    expect(parseBeatParam('?beat=<script>')).toBeNull();
    expect(parseBeatParam('')).toBeNull();
  });
});

describe('build-time SEO', () => {
  const site = 'https://example.test';
  const template = readFileSync('index.html', 'utf8');

  it('creates a page for every game plus home, daily, privacy and 404', () => {
    const files = pageSpecs(site).map((p) => p.file);
    expect(files).toEqual(expect.arrayContaining(['index.html', 'games/neon-rush.html', 'daily.html', 'privacy.html', '404.html']));
  });

  it('injects title, canonical, Open Graph and readable content', () => {
    const page = pageSpecs(site).find((p) => p.path === '/games/neon-rush')!;
    const html = renderPage(template, page, site);
    expect(html).toContain('<title>Play NEON RUSH · GlitchBound</title>');
    expect(html).toContain('<link rel="canonical" href="https://example.test/games/neon-rush" />');
    expect(html).toContain('<meta property="og:image" content="https://example.test/games/neon-rush/og.jpg" />');
    expect(html).toContain('"@type":"VideoGame"');
    expect(html).toMatch(/<div id="root"><article class="ssr">[\s\S]*<h1>NEON RUSH<\/h1>/);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('marks the 404 page noindex and leaves it out of the sitemap', () => {
    const page = pageSpecs(site).find((p) => p.file === '404.html')!;
    expect(renderPage(template, page, site)).toContain('<meta name="robots" content="noindex" />');
    expect(sitemap(site)).not.toContain('404');
    expect(sitemap(site)).toContain('<loc>https://example.test/games/neon-rush</loc>');
    expect(sitemap(site)).toContain('<loc>https://example.test/party</loc>');
    expect(sitemap(site)).toContain('<loc>https://example.test/terms</loc>');
    expect(robots(site)).toContain('Sitemap: https://example.test/sitemap.xml');
  });
});

describe('visitInfo', () => {
  const mem = (): Storage => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } };
  };
  it('reports new, then returning with the day gap, once per tab session', () => {
    const local = mem();
    expect(visitInfo(new Date(2026, 9, 18, 10), local, mem())).toEqual({ visit: 'new', gap_days: 0 });
    const session = mem();
    expect(visitInfo(new Date(2026, 9, 21, 10), local, session)).toEqual({ visit: 'returning', gap_days: 3 });
    expect(visitInfo(new Date(2026, 9, 21, 11), local, session)).toBeNull();
  });
});
