import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { onRequestGet } from '../functions/games/unhinged/[[path]]';
import { currentSlug, getGame } from '../src/catalog/catalog';
import { sanitizeSave } from '../src/platform/save';
import { matchRoute } from '../src/router/router';
import type { Ctx } from '../server/http';

describe('Unhinged is now Crass Act', () => {
  it('has a game under the new slug and none under the old one', () => {
    expect(getGame('crass-act')?.title).toBe('Crass Act');
    expect(getGame('unhinged')).toBeUndefined();
    expect(currentSlug('unhinged')).toBe('crass-act');
    expect(currentSlug('wing-it')).toBe('wing-it');
  });

  it('opens old in-app links on the new game', () => {
    expect(matchRoute('/games/unhinged')).toEqual({ name: 'game', slug: 'crass-act' });
  });

  it('redirects old pages, art and room links, keeping the query', () => {
    const go = (url: string): string | null => onRequestGet({ request: new Request(url) } as Ctx).headers.get('location');
    expect(go('https://glitchboundstudio.com/games/unhinged')).toBe('https://glitchboundstudio.com/games/crass-act');
    expect(go('https://glitchboundstudio.com/games/unhinged?room=ABCDE')).toBe('https://glitchboundstudio.com/games/crass-act?room=ABCDE');
    expect(go('https://glitchboundstudio.com/games/unhinged/og.jpg')).toBe('https://glitchboundstudio.com/games/crass-act/og.jpg');
  });

  it('keeps a device’s plays and bests', () => {
    const save = sanitizeSave({ v: 1, games: { unhinged: { plays: 3, best: { score: 7 }, last: 5 } }, daily: {}, gameDailies: { '2026-10-19': ['unhinged'] } });
    expect(save.games['crass-act']).toEqual({ plays: 3, best: { score: 7 }, last: 5 });
    expect(save.games.unhinged).toBeUndefined();
    expect(save.gameDailies['2026-10-19']).toEqual(['crass-act']);
  });

  it('moves stored data to the new slug (migration 0011)', () => {
    const dir = join(process.cwd(), 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const db = new DatabaseSync(':memory:');
    for (const f of files.filter((f) => f < '0011')) db.exec(readFileSync(join(dir, f), 'utf8'));
    db.exec(`
      INSERT INTO favorites (user_id, game, created_at) VALUES ('u1', 'unhinged', 1);
      INSERT INTO bests (user_id, game, score, at) VALUES ('u1', 'unhinged', 9, 1);
      INSERT INTO game_settings (slug, data, updated_at) VALUES ('unhinged', '{"hidden":true,"title":"Unhinged"}', 1);
      INSERT INTO site_settings (key, value, updated_at) VALUES ('party', '{"unhinged":{"title":"Unhinged","featured":true}}', 1);
      INSERT INTO discord_instances (instance_id, game, ref, updated_at) VALUES ('call', 'unhinged', 'ABCDE', 1);
      INSERT INTO shares (code, path, title, created_at) VALUES ('s1', '/games/unhinged', 'Join my Unhinged room', 1);
    `);
    db.exec(readFileSync(join(dir, files.find((f) => f.startsWith('0011'))!), 'utf8'));
    const one = (sql: string): unknown => db.prepare(sql).get();
    expect(one("SELECT game FROM favorites WHERE user_id = 'u1'")).toEqual({ game: 'crass-act' });
    expect(one("SELECT game, score FROM bests WHERE user_id = 'u1'")).toEqual({ game: 'crass-act', score: 9 });
    expect(one('SELECT slug, data FROM game_settings')).toEqual({ slug: 'crass-act', data: '{"hidden":true}' });
    expect(JSON.parse((one("SELECT value FROM site_settings WHERE key = 'party'") as { value: string }).value)).toEqual({ 'crass-act': { title: 'Crass Act', featured: true } });
    expect(one('SELECT game FROM discord_instances')).toEqual({ game: 'crass-act' });
    expect(one('SELECT path, title FROM shares')).toEqual({ path: '/games/crass-act', title: 'Join my Crass Act room' });
  });
});
