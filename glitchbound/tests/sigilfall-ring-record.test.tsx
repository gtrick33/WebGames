/**
 * The Ring's record (the plan the owner took up: "daily and weekly challenges, class mastery, seasons and match
 * history", and "make sure the UI on the main menu is still clear for newcomers and is not overloaded with info"):
 * challenges drawn from the date, counted from rated matches; class mastery and its titles; seasons that bring ratings
 * halfway back toward 1000 and keep the best ever; the last twenty matches; joined across devices; one link in the lobby.
 */
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RING_KEY, type Standing } from '../src/games/sigilfall/arena/ranks';
import { CHALLENGE_TITLES, DAILY, dailyOf, dayKey, HISTORY_MAX, MASTERY_TITLES, recordMatch, seasonEnds, seasonOf, seasonReset, SEASON_LENGTH, SEASON_START, turnSeason, WEEKLY, weekKey, weeklyOf, type MatchEntry, type MatchFacts, type RingRecord } from '../src/games/sigilfall/arena/record';
import { mergeSaveText } from '../src/platform/cloudMerge';
import { earnedRecordTitles, TITLES } from '../src/games/sigilfall/progress/titles';
import { ProgressDialog, ProgressLink } from '../src/games/sigilfall/ui/RingProgress';

const NOW = Date.UTC(2026, 10, 18, 15, 0);
const entry = (more: Partial<MatchEntry> = {}): MatchEntry => ({ at: NOW, format: 1, cls: 'warrior', won: true, draw: false, change: 30, rating: 1030, dmg: 2000, heal: 100, combos: 6, kicks: 1, ...more });
const facts = (more: Partial<MatchFacts> = {}): MatchFacts => ({ won: true, format: 1, cls: 'warrior', dmg: 2000, heal: 100, combos: 6, kicks: 1, supers: 1, ...more });

beforeEach(() => localStorage.clear());

describe('The Ring’s record: challenges', () => {
  it('three a day and three a week, the same for everyone on the same day, new the next', () => {
    const today = dailyOf(NOW).map((c) => c.id);
    expect(today).toHaveLength(3);
    expect(new Set(today).size).toBe(3);
    expect(dailyOf(NOW + 3_600_000).map((c) => c.id)).toEqual(today);
    const days = new Set(Array.from({ length: 7 }, (_, i) => dailyOf(NOW + i * 86_400_000).map((c) => c.id).join()));
    expect(days.size).toBeGreaterThan(1);
    expect(weeklyOf(NOW)).toHaveLength(3);
    expect(weekKey(NOW)).toBe('2026-11-16');
    expect(weekKey(Date.UTC(2026, 10, 22, 23))).toBe('2026-11-16');
    expect(weekKey(Date.UTC(2026, 10, 23, 1))).toBe('2026-11-23');
    for (const c of [...DAILY, ...WEEKLY]) expect(c.text.length, c.id).toBeLessThan(40);
  });

  it('rated matches count toward them; a friendly one only goes into the history', () => {
    const friendly = recordMatch(undefined, entry({ change: null, rating: null }), facts(), NOW);
    expect(friendly.history).toHaveLength(1);
    expect(friendly.daily).toBeUndefined();
    expect(friendly.mastery).toBeUndefined();
    let rec: RingRecord | undefined;
    for (let i = 0; i < 3; i++) rec = recordMatch(rec, entry({ at: NOW + i }), facts({ combos: 6, kicks: 2, supers: 2, dmg: 2500, heal: 1200 }), NOW + i);
    expect(rec!.daily!.key).toBe(dayKey(NOW));
    // every one of today's is done after three such matches (each is within three matches' reach of these numbers)
    for (const c of dailyOf(NOW)) expect(rec!.daily!.done, c.id).toContain(c.id);
    expect(rec!.finished).toBeGreaterThanOrEqual(3);
    // a new day starts afresh
    const next = recordMatch(rec, entry({ at: NOW + 86_400_000 }), facts({ won: false, combos: 0, kicks: 0, supers: 0, dmg: 0, heal: 0 }), NOW + 86_400_000);
    expect(next.daily!.key).toBe(dayKey(NOW + 86_400_000));
    expect(next.daily!.done).toEqual(dailyOf(NOW + 86_400_000).filter((c) => c.id === 'd-play' && c.goal <= 1).map((c) => c.id));
  });

  it('“with three classes” and “every format” count what is different, not how many', () => {
    const week = Date.UTC(2026, 10, 16);
    // (find a week that draws both)
    let at = week;
    for (let i = 0; i < 400 && !(weeklyOf(at).some((c) => c.id === 'w-classes') && weeklyOf(at).some((c) => c.id === 'w-formats')); i++) at += 7 * 86_400_000;
    let rec: RingRecord | undefined;
    rec = recordMatch(rec, entry({ at }), facts({ cls: 'mage', format: 1 }), at);
    rec = recordMatch(rec, entry({ at: at + 1 }), facts({ cls: 'mage', format: 1 }), at + 1);
    expect(rec.weekly!.got['w-classes']).toBe(1);
    expect(rec.weekly!.got['w-formats']).toBe(1);
    rec = recordMatch(rec, entry({ at: at + 2 }), facts({ cls: 'priest', format: 2 }), at + 2);
    rec = recordMatch(rec, entry({ at: at + 3 }), facts({ cls: 'druid', format: 3 }), at + 3);
    expect(rec.weekly!.done).toEqual(expect.arrayContaining(['w-classes', 'w-formats']));
  });
});

describe('The Ring’s record: mastery, history, titles', () => {
  it('counts rated wins with each class, keeps the last twenty matches', () => {
    let rec: RingRecord | undefined;
    for (let i = 0; i < 25; i++) rec = recordMatch(rec, entry({ at: NOW + i, won: i % 5 !== 0 }), facts({ won: i % 5 !== 0 }), NOW + i);
    expect(rec!.mastery!.warrior).toEqual({ wins: 20, played: 25 });
    expect(rec!.history).toHaveLength(HISTORY_MAX);
    expect(rec!.history![0]!.at).toBe(NOW + 24);
  });

  it('15 and 50 wins with a class give its titles, 10 and 50 challenges theirs, as titles any hero can wear', () => {
    expect(MASTERY_TITLES.find((t) => t.id === 'ring-adept-warrior')!.name).toBe('Warrior Adept');
    for (const t of [...MASTERY_TITLES, ...CHALLENGE_TITLES]) expect(TITLES.some((x) => x.id === t.id), t.id).toBe(true);
    expect(earnedRecordTitles()).toEqual([]);
    localStorage.setItem(RING_KEY, JSON.stringify({ standings: {}, sets: {}, record: { mastery: { warrior: { wins: 15, played: 20 } }, finished: 10 } }));
    expect(earnedRecordTitles().map((t) => t.id).sort()).toEqual(['ring-adept-warrior', 'ring-diligent']);
  });
});

describe('The Ring’s record: seasons', () => {
  const standings: Record<string, Standing> = { 1: { rating: 1400, best: 1550, wins: 30, losses: 20, streak: 3, mmr: 1420 }, 2: { rating: 900, best: 1010, wins: 2, losses: 6, streak: -2 } };

  it('eight weeks each, the first from the day they came', () => {
    expect(seasonOf(SEASON_START)).toBe(1);
    expect(seasonOf(SEASON_START + SEASON_LENGTH - 1)).toBe(1);
    expect(seasonOf(SEASON_START + SEASON_LENGTH)).toBe(2);
    expect(seasonEnds(1)).toBe(SEASON_START + 56 * 86_400_000);
  });

  it('a record that never saw one starts in this one, with nothing changed; within a season nothing changes', () => {
    const a = turnSeason(undefined, standings, NOW);
    expect(a.turned).toBe(false);
    expect(a.standings).toBe(standings);
    expect(a.record.season!.n).toBe(1);
    const b = turnSeason(a.record, standings, NOW + 86_400_000);
    expect(b.turned).toBe(false);
    expect(b.record).toBe(a.record);
  });

  it('when one turns: ratings halfway back toward 1000, the best ever and the counts kept, the old bests put by', () => {
    let rec = turnSeason(undefined, standings, NOW).record;
    rec = recordMatch(rec, entry({ format: 1, rating: 1400 }), facts(), NOW);
    expect(rec.season!.best['1']).toBe(1400);
    const later = SEASON_START + SEASON_LENGTH + 86_400_000;
    const t = turnSeason(rec, standings, later);
    expect(t.turned).toBe(true);
    expect(t.standings['1']).toMatchObject({ rating: 1200, best: 1550, wins: 30, losses: 20, streak: 0, mmr: 1210 });
    expect(t.standings['2']!.rating).toBe(950);
    expect(t.record.season).toMatchObject({ n: 2, best: {} });
    expect(t.record.season!.past[0]).toEqual({ n: 1, best: { 1: 1400 } });
    expect(seasonReset(1000)).toBe(1000);
  });
});

describe('The Ring’s record across devices', () => {
  it('both copies’ matches, the further along of each challenge, the later season', () => {
    const day = dayKey(NOW);
    const local = { standings: {}, sets: {}, record: { history: [entry({ at: 3 }), entry({ at: 1 })], daily: { key: day, got: { a: 2, b: 0 }, done: ['c'] }, finished: 4, mastery: { warrior: { wins: 3, played: 5 } }, season: { n: 1, best: { 1: 1100 }, past: [] } } };
    const remote = { standings: {}, sets: {}, record: { history: [entry({ at: 2 })], daily: { key: day, got: { a: 1, b: 5 }, done: ['d'] }, finished: 6, mastery: { warrior: { wins: 9, played: 12 } }, season: { n: 1, best: { 1: 1050, 2: 1200 }, past: [] } } };
    const out = JSON.parse(mergeSaveText(RING_KEY, JSON.stringify(local), JSON.stringify(remote), day, 'local')) as { record: RingRecord };
    expect(out.record.history!.map((h) => h.at)).toEqual([3, 2, 1]);
    expect(out.record.daily).toMatchObject({ key: day, got: { a: 2, b: 5 } });
    expect(out.record.daily!.done.sort()).toEqual(['c', 'd']);
    expect(out.record.finished).toBe(6);
    expect(out.record.mastery!.warrior).toEqual({ wins: 9, played: 12 });
    expect(out.record.season!.best).toEqual({ 1: 1100, 2: 1200 });
  });
});

describe('The Ring’s record on screen: one link in the lobby, the rest a press away', () => {
  it('the link says how many of the challenges are done; the window has a tab for each part', () => {
    const rec = recordMatch(undefined, entry({ at: Date.now() }), facts({ combos: 20, kicks: 5, supers: 5, dmg: 9000, heal: 4000 }), Date.now());
    const link = render(<ProgressLink record={rec} onOpen={() => {}} />);
    expect(link.container.textContent).toMatch(/^Progress \d\/6 challenges$/);
    link.unmount();
    const ui = render(<ProgressDialog record={rec} onClose={() => {}} />);
    expect(ui.getByRole('tab', { name: 'Challenges' }).getAttribute('aria-selected')).toBe('true');
    expect(ui.container.textContent).toMatch(/Today/);
    expect(ui.container.textContent).toMatch(/This week/);
    fireEvent.click(ui.getByRole('tab', { name: 'Mastery' }));
    expect(ui.container.textContent).toMatch(/Warrior/);
    expect(ui.container.textContent).toMatch(/1\/15/);
    fireEvent.click(ui.getByRole('tab', { name: 'Season' }));
    expect(ui.container.textContent).toMatch(/Season \d+/);
    fireEvent.click(ui.getByRole('tab', { name: 'History' }));
    expect(ui.container.textContent).toMatch(/Win/);
    expect(ui.container.textContent).toMatch(/\+30/);
  });
});
