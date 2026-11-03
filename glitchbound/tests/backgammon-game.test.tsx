import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choosePlay } from '../src/games/backgammon/ai';
import Game from '../src/games/backgammon/Game';
import { newMatch, nextSteps, roll, rng, type Pos, type Step } from '../src/games/backgammon/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey, hashString } from '../src/platform/dates';

const KEY = 'glitchbound.backgammon';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '{}').current?.match?.match?.game as { turn: 0 | 1; phase: string; rolls: number } | undefined;
const same = (a: Step, b: Step): boolean => a.from === b.from && a.to === b.to && a.die === b.die;

/** A match seed whose first game the computer opens, with its planned first play (as Game.tsx plans it, at Medium). */
function computerOpens(from: number): { seed: number; rolls: number; first: Step[] } {
  for (let seed = from; ; seed++) {
    const g = roll(newMatch(seed, 5).game);
    if (g.turn !== 1) continue;
    const dice = g.roll![0] === g.roll![1] ? [g.roll![0], g.roll![0], g.roll![0], g.roll![0]] : [g.roll![0], g.roll![1]];
    return { seed, rolls: g.rolls, first: choosePlay(g.turnStart, 1, dice, 'medium', rng(hashString(`${g.seed}:${g.rolls}`))) };
  }
}

describe('backgammon against the computer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a turn with a checker on the bar and the board closed passes without a roll (#25)', () => {
    const pts = Array<number>(25).fill(0);
    pts[6] = 14;
    for (const i of [19, 20, 21, 22, 23, 24]) pts[i] = -2;
    pts[1] = -3;
    const closed: Pos = { pts, bar: [1, 0], off: [0, 0] };
    const match = newMatch(5, 5);
    const game = { ...match.game, pos: closed, turnStart: closed, turn: 0, phase: 'roll', roll: [3, 1], rolls: 8, lastTurn: { side: 1, roll: [3, 1], steps: [] } };
    localStorage.setItem(KEY, JSON.stringify({ current: { mode: 'match', level: 'medium', match: { ...match, game }, started: true, sheet: null } }));
    vi.useFakeTimers();
    render(<Game host={{ report: () => undefined }} restartKey={0} pauseKey={0} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue your match' }));
    expect(screen.getByText('Board closed: your turn passes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Roll/ })).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    // the computer's turn to roll; the pass used up its roll, so each roll number stays the same side's
    expect(saved()).toMatchObject({ turn: 1, phase: 'roll', rolls: 9 });
  });
});

describe('backgammon: leaving for the menu and playing again (#26)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('the computer never replays an old game’s plan: its turn always finishes', () => {
    // two matches the computer opens on the same roll count, the first one's opening play impossible in the second
    const a = computerOpens(1);
    let b = computerOpens(a.seed + 1);
    while (b.rolls !== a.rolls || nextSteps(roll(newMatch(b.seed, 5).game)).some((st) => same(st, a.first[0]!))) b = computerOpens(b.seed + 1);
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random');
    render(<Game host={{ report: () => undefined }} restartKey={0} pauseKey={0} lang="en" />);
    const play = (seed: number): void => {
      random.mockReturnValue(seed / 2 ** 32);
      fireEvent.click(screen.getByRole('button', { name: /· to 5/ }));
      // a match is still going: the game asks before it replaces it
      const replace = screen.queryByRole('button', { name: 'Start a new one' });
      if (replace) fireEvent.click(replace);
      fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
      // a beat at a time, so each timer the game sets after a render runs too
      for (let i = 0; i < 100; i++) act(() => vi.advanceTimersByTime(200));
    };
    play(a.seed);
    expect(saved()).toMatchObject({ turn: 0, phase: 'roll' });
    // to the game's menu, and a new match
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));
    play(b.seed);
    expect(saved()).toMatchObject({ turn: 0, phase: 'roll' });
  });
});

describe('backgammon: saved runs (BG-03, BG-04, BG-07, BG-10)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });
  const store = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
  const today = dayKey();

  it('a resumed match reports start again on its first move, and never saves "started"', () => {
    const match = newMatch(77, 5);
    localStorage.setItem(KEY, JSON.stringify({ current: { mode: 'match', level: 'easy', match, started: true, sheet: null } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue your match' }));
    fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    expect(store().current.match.started).toBe(false);
  });

  it('today’s game and a match keep their own runs; today’s game is only ever continued; a new match asks first', () => {
    render(<Game host={{ report: () => undefined }} restartKey={0} pauseKey={0} lang="en" />);
    // a match at Medium, one roll, back to the menu
    fireEvent.click(screen.getByRole('button', { name: /Play · Medium · to 5/ }));
    fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));
    const matchSeed = store().current.match.match.seed;
    // today's game: a roll, back to the menu
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
    const rolls = store().current.daily.match.game.rolls;
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));
    // both are still there; the daily did not change the match level
    expect(store().current.match.match.seed).toBe(matchSeed);
    expect(store().current.daily).toMatchObject({ day: today, mode: 'daily' });
    expect(store().level).toBe('medium');
    expect(screen.getByRole('button', { name: 'Continue your match' })).toBeTruthy();
    // the daily only continues (no fresh start with known dice)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(store().current.daily.match.game.rolls).toBe(rolls);
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));
    // a new match asks before it replaces the one going
    fireEvent.click(screen.getByRole('button', { name: /Play · Medium · to 5/ }));
    expect(screen.getByText(/will be lost/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my match' }));
    expect(store().current.match.match.seed).toBe(matchSeed);
  });

  it('a damaged saved run is dropped: the menu works and offers no Continue', () => {
    localStorage.setItem(KEY, JSON.stringify({ best: 5, current: { mode: 'match', level: 'easy', match: { game: { pos: {} } } } }));
    render(<Game host={{ report: () => undefined }} restartKey={0} pauseKey={0} lang="en" />);
    expect(screen.queryByRole('button', { name: 'Continue your match' })).toBeNull();
    expect(screen.getByText(/Best 5/)).toBeTruthy();
    localStorage.setItem(KEY, JSON.stringify({ current: { match: { mode: 'match', level: 'easy', started: false, sheet: null, match: { ...newMatch(3, 5), game: { ...newMatch(3, 5).game, pos: { pts: [], bar: [0, 0], off: [0, 0] } } } } } }));
    cleanup();
    render(<Game host={{ report: () => undefined }} restartKey={0} pauseKey={0} lang="en" />);
    expect(screen.queryByRole('button', { name: 'Continue your match' })).toBeNull();
  });
});

describe('backgammon: friends’ challenge rounds', () => {
  afterEach(() => {
    localStorage.clear();
    cleanup();
  });
  const spec = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'ch1', round: 1, seed: 1234, mode: 'fresh', day: '', ...over });

  it('a round in progress resumes after a reload, has no Quit, and a finished one shows its result without reporting again', () => {
    const report = vi.fn();
    const view = render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" challenge={spec()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
    const rolls = JSON.parse(localStorage.getItem(KEY)!).challenges['ch1:1'].run.match.game.rolls;
    expect(rolls).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    expect(screen.queryByRole('button', { name: 'Quit to menu' })).toBeNull();
    view.unmount();
    render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" challenge={spec()} />);
    expect(screen.queryByRole('button', { name: /Roll to see/ })).toBeNull();
    cleanup();
    // a finished round
    const s = JSON.parse(localStorage.getItem(KEY)!);
    s.challenges['ch1:1'].result = { mode: 'challenge', score: 212, won: true, mine: 0, theirs: 0, line: 'x', best: false, kind: 1 };
    localStorage.setItem(KEY, JSON.stringify(s));
    report.mockClear();
    render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" challenge={spec()} />);
    expect(screen.getByText('212')).toBeTruthy();
    expect(report).not.toHaveBeenCalled();
  });

  it('a "Today’s daily" challenge plays the game’s own daily, and a daily already played counts at once', () => {
    const day = '2026-10-30';
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" challenge={spec({ mode: 'daily', day, seed: 999 })} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll/ }));
    const st = JSON.parse(localStorage.getItem(KEY)!);
    expect(st.current.daily).toMatchObject({ day, mode: 'challenge', match: { seed: hashString(`backgammon:${day}`) } });
    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { score: 140, line: '🟢 Single', points: 1 } } }));
    report.mockClear();
    render(<Game host={{ report }} restartKey={0} pauseKey={0} lang="en" challenge={spec({ id: 'ch2', mode: 'daily', day })} />);
    expect(screen.getByText(/counts here/)).toBeTruthy();
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 140, stats: { points: 1 }, challenge: { id: 'ch2', round: 1 } });
    expect(report.mock.calls.filter(([e]) => e.type === 'end')).toHaveLength(1);
  });
});
