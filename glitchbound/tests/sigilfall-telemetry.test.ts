/**
 * Playtest numbers (POLISH_PLAN.md piece 28): where heroes fall and where players stop, sent through the arcade's own
 * first-party, cookieless analytics with nothing that says who.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { counted, fallProps, stopProps } from '../src/games/sigilfall/progress/telemetry';
import { readyHero } from './sigilfall-bot';

/** What /api/events keeps of an event's props (functions/api/events.ts): the rest is dropped there. */
const keeps = (props: Record<string, unknown>): boolean =>
  Object.keys(props).length <= 8 && Object.entries(props).every(([k, v]) => /^[a-z_]{1,20}$/.test(k) && (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean' || (typeof v === 'string' && v.length <= 60)));

describe('Sigilfall: playtest numbers', () => {
  it('a fall says where, on which quest, at what level and to which boss, and nothing of who', () => {
    const h = readyHero('warrior', 6);
    h.name = 'Lady Somebody';
    h.quests['the-warden'] = { state: 'active', n: 0 };
    const p = fallProps(h, 'crypt', 'coffin-matron');
    expect(p).toEqual({ game: 'sigilfall', region: 'crypt', quest: 'the-warden', level: 6, boss: 'coffin-matron' });
    expect(keeps(p)).toBe(true);
    expect(JSON.stringify(p)).not.toContain('Somebody');
    expect(fallProps(h, 'whisperwood', null).boss).toBe('');
  });

  it('a stop says where and after how long', () => {
    const h = readyHero('mage', 12);
    const p = stopProps(h, 'whisperwood', 23.6);
    expect(p).toMatchObject({ game: 'sigilfall', region: 'whisperwood', level: 12, minutes: 24 });
    expect(keeps(p)).toBe(true);
    expect(stopProps(h, null, -3)).toMatchObject({ region: '', minutes: 0 });
  });

  it('a review hero and a Trial are test play: nothing is sent for them', () => {
    const h = readyHero('warrior', 6);
    expect(counted(h, false)).toBe(true);
    expect(counted(h, true)).toBe(false);
    expect(counted({ ...h, review: true }, false)).toBe(false);
    expect(counted(null, false)).toBe(false);
  });

  it('the arcade keeps the two events: the client may send them and the server stores them', () => {
    const client = readFileSync('src/platform/analytics.ts', 'utf8');
    const server = readFileSync('functions/api/events.ts', 'utf8');
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    for (const name of ['game_fall', 'game_stop']) {
      expect(client).toContain(`'${name}'`);
      expect(server).toContain(`'${name}'`);
      expect(engine).toContain(`track('${name}'`);
    }
  });
});
