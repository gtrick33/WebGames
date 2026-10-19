import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { partyHref, siteSearch, type SearchContext, type SearchGroup } from '../src/platform/siteSearch';

const guest: SearchContext = { member: false, role: null, games: GAMES };
const member: SearchContext = { ...guest, member: true };

const ids = (g: SearchGroup): string[] => g.items.map((x) => ('slug' in x ? x.slug : x.id));
const top = (q: string, ctx = guest): { kind: string; first: string } => {
  const [g] = siteSearch(q, ctx);
  return { kind: g!.kind, first: ids(g!)[0]! };
};
const found = (q: string, ctx = guest): string[] => siteSearch(q, ctx).flatMap((g) => ids(g).map((id) => `${g.kind}:${id}`));

describe('site search', () => {
  it('finds pages and features by what people type', () => {
    expect(top('my profile')).toEqual({ kind: 'pages', first: 'profile' });
    expect(top('profile')).toEqual({ kind: 'pages', first: 'profile' });
    expect(top('quests')).toEqual({ kind: 'pages', first: 'profile' });
    expect(top('leaderboard')).toEqual({ kind: 'pages', first: 'leaderboards' });
    expect(top('hall of fame')).toEqual({ kind: 'pages', first: 'leaderboards' });
    expect(top('dark mode')).toEqual({ kind: 'pages', first: 'night' });
    expect(top('favourites')).toEqual({ kind: 'pages', first: 'favorites' });
    expect(top('room code')).toEqual({ kind: 'pages', first: 'room' });
    expect(top('party')).toEqual({ kind: 'pages', first: 'party' });
  });

  it('finds party games, by name or by what they are like', () => {
    expect(top('impostor')).toEqual({ kind: 'party', first: 'impostor' });
    expect(top('truth or dare')).toEqual({ kind: 'party', first: 'prompts' });
    expect(top('never have i ever')).toEqual({ kind: 'party', first: 'nhie' });
    expect(top('forehead')).toEqual({ kind: 'party', first: 'charades' });
    expect(top('rock paper scissors')).toEqual({ kind: 'party', first: 'rps' });
    expect(found('party')).toEqual(expect.arrayContaining(['party:impostor', 'party:charades', 'party:board']));
    expect(partyHref({ id: 'rps' })).toBe('/party?play=rps');
  });

  it('still finds arcade games first by their names, and Crass Act only once', () => {
    expect(top('wing')).toEqual({ kind: 'games', first: 'wing-it' });
    expect(top('racing')).toMatchObject({ kind: 'games' });
    expect(found('crass act').filter((x) => x.endsWith(':crass-act'))).toEqual(['games:crass-act']);
  });

  it('only offers what fits the player', () => {
    expect(found('sign in')).toContain('pages:signin');
    expect(found('sign in', member)).not.toContain('pages:signin');
    expect(found('log out', member)).toContain('pages:signout');
    expect(found('log out')).not.toContain('pages:signout');
    expect(found('qa', member)).not.toContain('pages:qa');
    expect(found('qa', { ...member, role: 'qa' })).toContain('pages:qa');
    expect(found('qa team', { ...member, role: 'qa' })).not.toContain('pages:qa-team');
    expect(found('admin', { ...member, role: 'admin' })).toContain('pages:admin');
  });

  it('matches page names in the player’s language too', () => {
    const bg = (s: string): string => (s === 'Profile & quests' ? 'Профил и мисии' : s);
    expect(top('профил', { ...guest, translate: bg })).toEqual({ kind: 'pages', first: 'profile' });
  });

  it('shows games, then party games, then the main pages before anything is typed', () => {
    const groups = siteSearch('', guest);
    expect(groups.map((g) => g.kind)).toEqual(['games', 'party', 'pages']);
    expect(ids(groups[2]!)).toEqual(['profile', 'daily', 'party', 'leaderboards']);
    expect(siteSearch('zzzzqx', guest)).toEqual([]);
  });
});
