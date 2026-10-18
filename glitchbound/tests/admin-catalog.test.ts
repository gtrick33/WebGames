import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import {
  applySettings,
  compactSettings,
  dailyRules,
  DEFAULT_SETTINGS,
  EMPTY_CATALOG,
  orderByLayout,
  sanitizeLayout,
  sanitizeNotice,
  sanitizePatch,
  sanitizePick,
  settingsFor,
  spotlightGame,
  TILE_RHYTHM,
  tileSizeFor,
  type PublicCatalog,
} from '../src/catalog/settings';
import { challengeForDay } from '../src/platform/daily';
import { addDays } from '../src/platform/dates';

const cat = (settings: PublicCatalog['settings'], picks: PublicCatalog['picks'] = {}): PublicCatalog => ({ settings, picks, notice: null });
const dailyGames = GAMES.filter((g) => g.daily?.length);

describe('admin game settings', () => {
  it('changes nothing without settings', () => {
    expect(applySettings(GAMES, EMPTY_CATALOG, true)).toEqual(GAMES);
    expect(settingsFor(EMPTY_CATALOG, GAMES[0]!.slug)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps party-only games out of the arcade, but not off their own pages', () => {
    const party = GAMES.filter((g) => g.partyOnly).map((g) => g.slug);
    expect(party).toContain('unhinged');
    expect(applySettings(GAMES, EMPTY_CATALOG).map((g) => g.slug)).toEqual(GAMES.filter((g) => !g.partyOnly).map((g) => g.slug));
    expect(applySettings(GAMES, EMPTY_CATALOG, true).map((g) => g.slug)).toEqual(expect.arrayContaining(party));
  });

  it('hides games from players (admins still get them), pins games first and applies text', () => {
    const [a, b, c] = GAMES;
    const c1 = cat({ [a!.slug]: { hidden: true }, [c!.slug]: { pinned: true, title: 'Renamed', tagline: 'New line' } });
    const seen = applySettings(GAMES, c1);
    expect(seen.some((g) => g.slug === a!.slug)).toBe(false);
    expect(seen[0]!.slug).toBe(c!.slug);
    expect(seen[0]!.title).toBe('Renamed');
    expect(seen[0]!.tagline).toBe('New line');
    expect(seen[0]!.description).toBe(c!.description);
    expect(seen.find((g) => g.slug === b!.slug)).toBe(b);
    expect(applySettings(GAMES, c1, true).some((g) => g.slug === a!.slug)).toBe(true);
  });

  it('has one spotlight game, and never a hidden one', () => {
    const g = GAMES[2]!;
    expect(spotlightGame(applySettings(GAMES, cat({ [g.slug]: { spotlight: true } })), cat({ [g.slug]: { spotlight: true } }))?.slug).toBe(g.slug);
    const hidden = cat({ [g.slug]: { spotlight: true, hidden: true } });
    expect(spotlightGame(applySettings(GAMES, hidden), hidden)).toBeUndefined();
  });

  it('only accepts valid patches and stores just the differences', () => {
    expect(sanitizePatch({ hidden: 'yes', newBadge: 'sometimes', pinned: true, title: '  Hi\u0000  ', bogus: 1 })).toEqual({ pinned: true, title: 'Hi' });
    expect(sanitizePatch({ tagline: 'x'.repeat(500) }).tagline).toHaveLength(110);
    expect(compactSettings({ ...DEFAULT_SETTINGS, hidden: true, newBadge: 'off' })).toEqual({ hidden: true, newBadge: 'off' });
  });

  it('validates daily picks and notices', () => {
    const g = dailyGames[0]!;
    expect(sanitizePick({ slug: g.slug, template: 0, target: 1234.567 }, GAMES)).toEqual({ slug: g.slug, template: 0, target: 1234.57 });
    expect(sanitizePick({ slug: g.slug, template: 99, target: -3 }, GAMES)).toEqual({ slug: g.slug, template: null, target: null });
    expect(sanitizePick({ slug: 'no-such-game' }, GAMES)).toBeNull();
    expect(sanitizeNotice({ text: '  ', link: '/x' }, 1)).toBeNull();
    expect(sanitizeNotice({ text: 'Hello', link: 'javascript:alert(1)', tone: 'party' }, 1)).toMatchObject({ text: 'Hello', link: '', tone: 'party' });
    expect(sanitizeNotice({ text: 'Hello', link: '/games/wing-it' }, 1)?.link).toBe('/games/wing-it');
  });
});

describe('daily challenge with admin rules', () => {
  const days = Array.from({ length: 120 }, (_, i) => addDays('2026-11-01', i));

  it('is unchanged when there are no rules', () => {
    for (const d of days) expect(challengeForDay(d, GAMES, dailyRules(EMPTY_CATALOG))).toEqual(challengeForDay(d, GAMES, null));
  });

  it('skips an excluded game and only changes the days that would have used it', () => {
    const out = dailyGames[0]!.slug;
    const rules = dailyRules(cat({ [out]: { inDaily: false } }));
    for (const d of days) {
      const before = challengeForDay(d, GAMES, null)!;
      const after = challengeForDay(d, GAMES, rules)!;
      expect(after.game.slug).not.toBe(out);
      if (before.game.slug !== out) expect(after).toEqual(before);
    }
    // Hidden or paused games are skipped too.
    expect(dailyRules(cat({ a: { hidden: true }, b: { maintenance: 'Fixing' }, c: { pinned: true } })).exclude).toEqual(new Set(['a', 'b']));
  });

  it('uses a hand-picked game, goal and target for that day only', () => {
    const g = dailyGames[dailyGames.length - 1]!;
    const day = days[10]!;
    const rules = dailyRules(cat({}, { [day]: { slug: g.slug, template: 0, target: 4321 } }));
    const c = challengeForDay(day, GAMES, rules)!;
    expect(c.game.slug).toBe(g.slug);
    expect(c.metric).toBe(g.daily![0]!.metric);
    expect(c.target).toBe(4321);
    expect(c.label).toContain('4,321');
    expect(challengeForDay(days[11]!, GAMES, rules)).toEqual(challengeForDay(days[11]!, GAMES, null));
  });
});

describe('home page banner layout', () => {
  const [a, b, c] = GAMES;

  it('keeps only known games, sizes, colours and short stickers', () => {
    const l = sanitizeLayout(
      {
        order: [c!.slug, 'nope', a!.slug, c!.slug],
        sizes: { [a!.slug]: 'xl', [b!.slug]: 'huge', nope: 'md' },
        accents: { [a!.slug]: 'violet', [b!.slug]: 'gold' },
        stickers: { [c!.slug]: '  🔥 Hot  ', [a!.slug]: 'x'.repeat(40), [b!.slug]: '   ' },
      },
      GAMES,
    )!;
    expect(l.order).toEqual([c!.slug, a!.slug]);
    expect(l.sizes).toEqual({ [a!.slug]: 'xl' });
    expect(l.accents).toEqual({ [a!.slug]: 'violet' });
    expect(l.stickers[c!.slug]).toBe('🔥 Hot');
    expect(l.stickers[a!.slug]).toHaveLength(14);
    expect(l.stickers[b!.slug]).toBeUndefined();
    expect(sanitizeLayout({ order: ['nope'] }, GAMES)).toBeNull();
  });

  it('orders the arcade by the layout, unlisted games after in their usual order', () => {
    const layout = { order: [c!.slug, a!.slug], sizes: {}, accents: {}, stickers: {} };
    const out = orderByLayout(GAMES, layout).map((g) => g.slug);
    expect(out.slice(0, 2)).toEqual([c!.slug, a!.slug]);
    expect(out.slice(2)).toEqual(GAMES.map((g) => g.slug).filter((s) => s !== a!.slug && s !== c!.slug));
    expect(orderByLayout(GAMES, null)).toEqual(GAMES);
  });

  it('uses the chosen banner size, else the automatic rhythm', () => {
    const layout = { order: [], sizes: { [b!.slug]: 'wide' as const }, accents: {}, stickers: {} };
    expect(tileSizeFor(layout, b!.slug, 0)).toBe('wide');
    expect(tileSizeFor(layout, a!.slug, 1)).toBe(TILE_RHYTHM[1]);
    expect(tileSizeFor(null, a!.slug, 9)).toBe(TILE_RHYTHM[9 % TILE_RHYTHM.length]);
  });
});

describe('theme days', () => {
  it('gives every day of the week a theme, and the daily challenge follows it from THEMES_SINCE', async () => {
    const { themeOf, themeGames, THEMES_SINCE, WEEK } = await import('../src/platform/themes');
    expect(WEEK).toHaveLength(7);
    expect(themeOf('2026-10-20').name).toBe('Trivia Tuesday');
    expect(themeOf('2026-10-24').name).toBe('Full-Throttle Saturday');
    // Tuesdays: the trivia game; Wednesdays: a word game (when they have daily goals).
    const tuesday = challengeForDay('2026-10-20', GAMES, null)!;
    expect(themeGames(themeOf('2026-10-20'), GAMES).map((g) => g.slug)).toContain(tuesday.game.slug);
    const wednesday = challengeForDay('2026-10-21', GAMES, null)!;
    expect(['letter-pinch', 'crosswire']).toContain(wednesday.game.slug);
    // Before the themes started, days keep their original pick.
    expect(THEMES_SINCE > '2026-10-18').toBe(true);
  });
});

describe('holiday looks', () => {
  it('follows the calendar in automatic mode, and admins can force or switch it off', async () => {
    const { activeHoliday, autoHoliday, easterDay, isSeasonSetting } = await import('../src/platform/seasons');
    expect(easterDay(2027)).toBe('2027-03-28');
    expect(easterDay(2028)).toBe('2028-04-16');
    expect(autoHoliday('2026-10-18')).toBe('halloween');
    expect(autoHoliday('2026-11-08')).toBe('diwali');
    expect(autoHoliday('2026-12-24')).toBe('winter');
    expect(autoHoliday('2027-01-03')).toBe('winter');
    expect(autoHoliday('2027-02-08')).toBe('lunar');
    expect(autoHoliday('2027-02-14')).toBe('valentine');
    expect(autoHoliday('2027-03-27')).toBe('easter');
    expect(autoHoliday('2027-06-15')).toBeNull();
    expect(activeHoliday(undefined, '2026-10-31')?.id).toBe('halloween');
    expect(activeHoliday('off', '2026-10-31')).toBeNull();
    expect(activeHoliday('summer', '2026-10-31')?.id).toBe('summer');
    expect(isSeasonSetting('easter')).toBe(true);
    expect(isSeasonSetting('christmas')).toBe(false);
  });
});
