/**
 * The Ring's record (the plan the owner took up: "daily and weekly challenges, class mastery, seasons and match
 * history", and "make sure the UI on the main menu is still clear for newcomers and is not overloaded with info"):
 * challenges drawn from the date, counted from rated matches; class mastery and its titles; seasons that bring ratings
 * halfway back toward 1000 and keep the best ever; the last twenty matches; joined across devices; one link in the lobby.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RING_KEY, type Standing } from '../src/games/sigilfall/arena/ranks';
import { CHALLENGE_TITLES, DAILY, frameOf, framesOwned, trackGain, trackOf, trackPlace, TRACK_POINTS, dailyOf, dayKey, HISTORY_MAX, MASTERY_TITLES, recordMatch, seasonEnds, seasonOf, seasonReset, SEASON_LENGTH, SEASON_START, turnSeason, WEEKLY, weekKey, weeklyOf, type MatchEntry, type MatchFacts, type RingRecord } from '../src/games/sigilfall/arena/record';
import { mergeSaveText } from '../src/platform/cloudMerge';
import { earnedRecordTitles, TITLES } from '../src/games/sigilfall/progress/titles';
import { ProgressDialog, ProgressLink, SeasonTrack } from '../src/games/sigilfall/ui/RingProgress';
import { cleanPick } from '../src/games/sigilfall/net/ringRoom';
import { ArenaChoice, ArenaPicture } from '../src/games/sigilfall/ui/RingArena';
import { MAP_IDS, MAPS } from '../src/games/sigilfall/arena/maps';

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

describe('The Ring’s record on screen: one strip in the lobby, the rest a press away', () => {
  it('every challenge has a picture from the game’s icons', () => {
    const names = (JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/games/sigilfall/icons/icons.json'), 'utf8')) as { names: string[] }).names;
    for (const c of [...DAILY, ...WEEKLY]) expect(names, c.id).toContain(c.icon);
  });

  it('the arena: the one chosen as a card with its ground’s picture; the choice a picture card for each, Any first', () => {
    let picked = '';
    let opened: boolean | null = null;
    const shut = render(<ArenaChoice map="frost" open={false} onOpen={(o) => (opened = o)} onPick={() => {}} />);
    expect(shut.container.textContent).toMatch(/The Frozen Mere/);
    expect(shut.container.querySelectorAll('svg.rb-ar-pic')).toHaveLength(1);
    fireEvent.click(shut.getByRole('button'));
    expect(opened).toBe(true);
    shut.unmount();
    const open = render(<ArenaChoice map="random" open onOpen={() => {}} onPick={(id) => (picked = id)} />);
    const cards = open.getAllByRole('radio');
    expect(cards.map((c) => c.textContent)).toEqual(['?Any arena', ...MAP_IDS.map((id) => MAPS[id]!.name)]);
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true');
    // (each ground drawn with its stones)
    for (const id of MAP_IDS) expect(render(<ArenaPicture id={id} />).container.querySelectorAll('rect').length).toBeGreaterThan(MAPS[id]!.pillars.length);
    fireEvent.click(cards[2]!);
    expect(picked).toBe(MAP_IDS[1]);
  });

  it('the strip says how many of the challenges are done; the window has a tab for each part, with its count', () => {
    const rec = recordMatch(undefined, entry({ at: Date.now() }), facts({ combos: 20, kicks: 5, supers: 5, dmg: 9000, heal: 4000 }), Date.now());
    const link = render(<ProgressLink record={rec} onOpen={() => {}} />);
    // (a strip as the rewards' is: its name for a reader, today's three as pips, the next to do or "done", the way in)
    expect(link.getByRole('button').getAttribute('aria-label')).toMatch(/^Progress \d\/6 challenges$/);
    expect(link.container.querySelectorAll('.rb-pg-pips i')).toHaveLength(3);
    // (which of the two depends on the day: its three challenges are drawn by the date, and one match finishes all
    // three on some days and not on others. It asked for "Today’s challenge", which the strip says only when all are
    // done, so it failed on every day that brought a challenge one match can't finish)
    expect(link.container.textContent).toMatch(/\d\/\d+ · \+\d+ season points|Today’s challenges done/);
    expect(link.container.textContent).toMatch(/Progress$/);
    link.unmount();
    const ui = render(<ProgressDialog record={rec} onClose={() => {}} />);
    expect(ui.getByRole('tab', { name: /^Challenges/ }).getAttribute('aria-selected')).toBe('true');
    expect(ui.container.textContent).toMatch(/Today/);
    expect(ui.container.textContent).toMatch(/This week/);
    fireEvent.click(ui.getByRole('tab', { name: /^Mastery/ }));
    expect(ui.container.textContent).toMatch(/Warrior/);
    expect(ui.container.textContent).toMatch(/1\/15/);
    fireEvent.click(ui.getByRole('tab', { name: /^Season/ }));
    expect(ui.container.textContent).toMatch(/Season \d+/);
    fireEvent.click(ui.getByRole('tab', { name: /^History/ }));
    expect(ui.container.textContent).toMatch(/Win/);
    expect(ui.container.textContent).toMatch(/\+30/);
  });
});

describe('The Ring’s season track (the owner: what the challenges give)', () => {
  it('each challenge finished is worth points, a day’s 10 and a week’s 30, counted into the season', () => {
    // (a match that finishes every challenge it can: today's three and whatever of the week's it reaches)
    const rec = recordMatch(undefined, entry({ at: NOW }), facts({ combos: 99, kicks: 99, supers: 99, dmg: 99999, heal: 99999, format: 2 }), NOW);
    const d = rec.daily!.done.length;
    const w = rec.weekly!.done.length;
    expect(d).toBeGreaterThan(0);
    expect(rec.season!.points).toBe(d * TRACK_POINTS.daily + w * TRACK_POINTS.weekly);
    // (nothing more for a match that finishes nothing new)
    const again = recordMatch(rec, entry({ at: NOW + 1 }), facts({ won: false, combos: 0, kicks: 0, supers: 0, dmg: 0, heal: 0 }), NOW + 1);
    expect(again.season!.points).toBe(rec.season!.points);
    expect(trackGain(rec, again)).toBeNull();
  });

  it('ten tiers, the rewards frames and titles, the last two the season’s own; reaching a tier gives it for good', () => {
    const t = trackOf(3);
    expect(t).toHaveLength(10);
    expect(t.map((x) => x.at)).toEqual([...t.map((x) => x.at)].sort((a, b) => a - b));
    expect(t.filter((x) => x.reward.kind === 'frame')).toHaveLength(5);
    expect(t[8]!.reward.id).toBe('frame:season-3');
    expect(t[9]!.reward.id).toBe('title:ring-s3-champion');
    // (reachable: a player who finishes every day's challenges reaches the top, with weeks' to spare)
    expect(t[9]!.at).toBeLessThanOrEqual(56 * 3 * TRACK_POINTS.daily);
    const before: RingRecord = { season: { n: seasonOf(NOW), best: {}, points: 140, past: [] } };
    const after = recordMatch(before, entry(), facts({ combos: 99, kicks: 99, supers: 99, dmg: 99999, heal: 99999 }), NOW);
    expect(after.earned).toEqual(expect.arrayContaining(['frame:bronze', 'title:ring-contender']));
    const gain = trackGain(before, after)!;
    expect(gain.gained).toBe(after.season!.points! - 140);
    expect(gain.rewards.map((r) => r.id)).toContain('title:ring-contender');
    expect(trackPlace(after.season!.points!, seasonOf(NOW)).tier).toBe(gain.tier);
  });

  it('the points start again with a season; what they gave stays', () => {
    const rec: RingRecord = { season: { n: 1, best: {}, points: 600, past: [] }, earned: ['frame:bronze', 'frame:gold'] };
    const t = turnSeason(rec, {}, SEASON_START + SEASON_LENGTH + 1);
    expect(t.record.season).toMatchObject({ n: 2, points: 0 });
    expect(t.record.season!.past[0]).toMatchObject({ n: 1, points: 600 });
    expect(t.record.earned).toEqual(['frame:bronze', 'frame:gold']);
  });

  it('frames: owned ones to wear, each season’s its own colors; the titles in the title list', () => {
    expect(framesOwned({ earned: ['frame:silver', 'title:ring-contender', 'frame:season-2', 'frame:nonsense'] }).map((f) => f.id)).toEqual(['silver', 'season-2']);
    expect(frameOf('season-2')!.colors).not.toEqual(frameOf('season-3')!.colors);
    expect(frameOf('gold')!.name).toBe('Gold frame');
    expect(frameOf('nope')).toBeNull();
    for (const id of ['ring-contender', 'ring-challenger', 'ring-ringtested', 'ring-relentless', 'ring-s1-champion', 'ring-s12-champion']) expect(TITLES.some((x) => x.id === id), id).toBe(true);
    localStorage.setItem(RING_KEY, JSON.stringify({ standings: {}, sets: {}, record: { earned: ['title:ring-contender'] } }));
    expect(earnedRecordTitles().map((t) => t.id)).toEqual(['ring-contender']);
  });

  it('a frame goes into a room with the rest of a player’s choices, checked for shape', () => {
    expect(cleanPick({ team: 0, cls: 'mage', bar: ['m-lash'], talents: [], frame: 'season-4' })!.frame).toBe('season-4');
    expect(cleanPick({ team: 0, cls: 'mage', bar: ['m-lash'], talents: [], frame: '<b>gold</b>' })!.frame).toBeUndefined();
  });

  it('across devices: what either was given, and the greater points', () => {
    const day = dayKey(NOW);
    const local = { standings: {}, sets: {}, frame: 'gold', record: { earned: ['frame:bronze'], season: { n: 1, best: {}, points: 200, past: [] } } };
    const remote = { standings: {}, sets: {}, record: { earned: ['title:ring-contender'], season: { n: 1, best: {}, points: 260, past: [] } } };
    const out = JSON.parse(mergeSaveText(RING_KEY, JSON.stringify(local), JSON.stringify(remote), day, 'local')) as { frame?: string; record: RingRecord };
    expect(out.record.earned!.sort()).toEqual(['frame:bronze', 'title:ring-contender']);
    expect(out.record.season!.points).toBe(260);
    expect(out.frame).toBe('gold');
  });

  it('the Season tab is the track: its points, ten stones, the next reward and the ten rewards', () => {
    const ui = render(<SeasonTrack points={300} n={1} now={NOW} earned={['frame:bronze', 'title:ring-contender', 'frame:silver']} />);
    expect(ui.container.textContent).toMatch(/300 points · tier 3 of 10/);
    expect(ui.container.querySelectorAll('.rb-pg-road > b')).toHaveLength(10);
    expect(ui.container.querySelectorAll('.rb-pg-road > b.is-on')).toHaveLength(3);
    expect(ui.container.textContent).toMatch(/Next: Title: Challenger in 90 points/);
    expect(ui.container.querySelectorAll('.rb-pg-tiers-list li.is-on')).toHaveLength(3);
  });
});
