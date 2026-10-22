import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { onRequestGet as oldGamePath } from '../functions/games/riftbound/[[path]]';
import { onRequestGet as oldSection } from '../functions/riftbound';
import { currentSlug, getGame, sectionGame } from '../src/catalog/catalog';
import { sanitizeSave } from '../src/platform/save';
import { matchRoute } from '../src/router/router';
import type { Ctx } from '../server/http';

describe('Riftbound is now Sigilfall', () => {
  it('has a game under the new slug and none under the old one', () => {
    expect(getGame('sigilfall')?.title).toBe('Sigilfall');
    expect(getGame('riftbound')).toBeUndefined();
    expect(currentSlug('riftbound')).toBe('sigilfall');
    expect(sectionGame('/riftbound')?.slug).toBe('sigilfall');
    expect(sectionGame('/unhinged')).toBeUndefined();
  });

  it('opens old in-app links on the new game', () => {
    expect(matchRoute('/riftbound')).toEqual({ name: 'section', slug: 'sigilfall' });
    expect(matchRoute('/games/riftbound')).toEqual({ name: 'section', slug: 'sigilfall' });
  });

  it('redirects the old page, the old tab and the old art, keeping the query', () => {
    const go = (fn: typeof oldSection, url: string): string | null => fn({ request: new Request(url) } as Ctx).headers.get('location');
    expect(go(oldSection, 'https://glitchboundstudio.com/riftbound')).toBe('https://glitchboundstudio.com/sigilfall');
    expect(go(oldSection, 'https://glitchboundstudio.com/riftbound?ref=x')).toBe('https://glitchboundstudio.com/sigilfall?ref=x');
    expect(go(oldGamePath, 'https://glitchboundstudio.com/games/riftbound')).toBe('https://glitchboundstudio.com/sigilfall');
    expect(go(oldGamePath, 'https://glitchboundstudio.com/games/riftbound/og.jpg')).toBe('https://glitchboundstudio.com/games/sigilfall/og.jpg');
  });

  it('keeps a device’s plays and bests', () => {
    const save = sanitizeSave({ v: 1, games: { riftbound: { plays: 2, best: { score: 900 }, last: 5 } }, daily: {}, gameDailies: {} });
    expect(save.games.sigilfall).toEqual({ plays: 2, best: { score: 900 }, last: 5 });
    expect(save.games.riftbound).toBeUndefined();
  });

  it('moves stored data to the new slug (migration 0013)', () => {
    const dir = join(process.cwd(), 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const db = new DatabaseSync(':memory:');
    for (const f of files.filter((f) => f < '0013')) db.exec(readFileSync(join(dir, f), 'utf8'));
    db.exec(`
      INSERT INTO favorites (user_id, game, created_at) VALUES ('u1', 'riftbound', 1);
      INSERT INTO bests (user_id, game, score, at) VALUES ('u1', 'riftbound', 1200, 1);
      INSERT INTO game_settings (slug, data, updated_at) VALUES ('riftbound', '{"hidden":true,"tagline":"Riftbound!"}', 1);
      INSERT INTO site_settings (key, value, updated_at) VALUES ('notice', '{"text":"Play Riftbound","link":"/riftbound"}', 1);
      INSERT INTO shares (code, path, title, created_at) VALUES ('s1', '/riftbound', 'My Riftbound hero', 1);
      INSERT INTO game_saves (user_id, key, data, updated_at) VALUES ('u1', 'glitchbound.riftbound', '{"v":1}', 1);
    `);
    db.exec(readFileSync(join(dir, files.find((f) => f.startsWith('0013'))!), 'utf8'));
    const one = (sql: string): unknown => db.prepare(sql).get();
    expect(one("SELECT game FROM favorites WHERE user_id = 'u1'")).toEqual({ game: 'sigilfall' });
    expect(one("SELECT game, score FROM bests WHERE user_id = 'u1'")).toEqual({ game: 'sigilfall', score: 1200 });
    expect(one('SELECT slug, data FROM game_settings')).toEqual({ slug: 'sigilfall', data: '{"hidden":true}' });
    expect(JSON.parse((one("SELECT value FROM site_settings WHERE key = 'notice'") as { value: string }).value)).toEqual({ text: 'Play Sigilfall', link: '/sigilfall' });
    expect(one('SELECT path, title FROM shares')).toEqual({ path: '/sigilfall', title: 'My Sigilfall hero' });
    expect(one('SELECT key, data FROM game_saves')).toEqual({ key: 'glitchbound.sigilfall', data: '{"v":1}' });
  });
});
