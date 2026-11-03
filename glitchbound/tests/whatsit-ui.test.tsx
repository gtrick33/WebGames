import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/whatsit/Game';
import { themeById, thingById } from '../src/games/whatsit/bank';
import { dailyRound, makeRound } from '../src/games/whatsit/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey, hashString } from '../src/platform/dates';

const KEY = 'glitchbound.whatsit';
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const fresh: ChallengeSpec = { id: 'abc123', round: 1, seed: 4242, mode: 'fresh', day: '' };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('glitchbound.coach.whatsit', '1');
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const questions = () => screen.getAllByRole('button').filter((b) => b.classList.contains('whz-q'));
const toLineup = () => {
  fireEvent.click(screen.getByRole('button', { name: /I know it/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
};
const openCard = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}[.,]`) }));
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Whatsit challenge rounds', () => {
  it('keep one attempt: no way to the menu, a remount carries on, a finished round stays finished', () => {
    const report = vi.fn();
    const view = render(<Game host={{ report }} restartKey={0} challenge={fresh} />);
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    fireEvent.click(questions()[0]!);
    expect(screen.getByRole('status').textContent).toMatch(/\d+ of 12 cards still fit\./);
    fireEvent.click(questions()[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Main menu' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    // A reload (or Restart) carries on with the questions already asked.
    view.unmount();
    render(<Game host={{ report }} restartKey={1} challenge={fresh} />);
    expect(screen.getByText('2 questions')).toBeTruthy();
    toLineup();
    const round = makeRound(fresh.seed);
    openCard(thingById(round.secret)!.name.en);
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'This is my Whatsit!' }));
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pick it' }));
    const ends = report.mock.calls.filter(([e]) => e.type === 'end');
    expect(ends).toHaveLength(1);
    // A fresh challenge counts every question: 2 questions cost 100.
    expect(ends[0]![0]).toMatchObject({ score: 900, challenge: { id: 'abc123', round: 1 } });
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();

    cleanup();
    render(<Game host={{ report }} restartKey={2} challenge={fresh} />);
    expect(screen.getByText('Got it!')).toBeTruthy();
    expect(report.mock.calls.filter(([e]) => e.type === 'end')).toHaveLength(1);
    // The result lists the secret's answers to the two questions asked, with a way to dispute one.
    const answers = screen.getByRole('heading', { name: 'Its answers' }).parentElement!;
    expect(answers.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Disagree with an answer?' }).getAttribute('href')).toMatch(/^\/me\/bugs\?game=whatsit&category=bug&title=/);
  });

  it('a "Today’s daily" challenge plays the real daily, or counts the daily already played', () => {
    const day = dayKey();
    const daily: ChallengeSpec = { id: 'd1', round: 1, seed: 1, mode: 'daily', day };
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={daily} />);
    toLineup();
    expect(screen.getByRole('button', { name: new RegExp(`^${thingById(dailyRound(day, hashString).secret)!.name.en}\\.`) })).toBeTruthy();
    expect(stored().daily[day]).toMatchObject({ open: true });

    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { score: 850, solved: true, questions: 5, line: '🟩🟥🟩🟥🟩' } } }));
    const again = vi.fn();
    render(<Game host={{ report: again }} restartKey={0} challenge={{ ...daily, id: 'd2' }} />);
    expect(again).toHaveBeenCalledWith({ type: 'end', score: 850, stats: { questions: 5 }, challenge: { id: 'd2', round: 1 } });
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
  });
});

describe('Whatsit line-up', () => {
  it('ignores a double-tap on a card, puts the pick last, says crossed-out cards, and asks before the daily pick', () => {
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Whatsit' }));
    toLineup();
    const secret = thingById(dailyRound(dayKey(), hashString).secret)!.name.en;
    openCard(secret);
    const buttons = Array.from(screen.getByRole('dialog').querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons.at(-1)).toBe('This is my Whatsit!');
    // The second tap of a double-tap lands at once: ignored.
    fireEvent.click(screen.getByRole('button', { name: 'This is my Whatsit!' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '✕ Cross it out' }));
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: '✕ Cross it out' }));
    expect(screen.getByRole('button', { name: new RegExp(`^${secret}, crossed out\\.`) })).toBeTruthy();

    openCard(secret);
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'This is my Whatsit!' }));
    expect(screen.getByRole('heading', { name: `Pick ${secret}?` })).toBeTruthy();
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pick it' }));
    expect(screen.getByText('Got it!')).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'end', score: 1000, daily: true }));
    // No questions asked: no answers list. The disagree link only shows with answers.
    expect(screen.queryByRole('heading', { name: 'Its answers' })).toBeNull();
  });
});

describe('Whatsit keyboard', () => {
  it('keeps Tab inside a sheet, gives focus back on Escape, and moves on to the next question after asking', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Any theme/ }));
    const qs = questions();
    qs[0]!.focus();
    fireEvent.click(qs[0]!);
    expect(document.activeElement).toBe(qs[1]);
    toLineup();
    const card = screen.getAllByRole('button').find((x) => x.classList.contains('whz-card'))!;
    card.focus();
    fireEvent.click(card);
    const dialog = screen.getByRole('dialog');
    const inside = Array.from(dialog.querySelectorAll('button'));
    inside.at(-1)!.focus();
    fireEvent.keyDown(inside.at(-1)!, { key: 'Tab' });
    expect(document.activeElement).toBe(inside[0]);
    fireEvent.keyDown(inside[0]!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(inside.at(-1));
    fireEvent.keyDown(inside[0]!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(card);
  });

  it('number keys ask the first nine questions, but not while typing in the site or with a sheet open', () => {
    render(
      <>
        <input aria-label="site search" />
        <Game host={{ report: vi.fn() }} restartKey={0} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Any theme/ }));
    fireEvent.keyDown(screen.getByLabelText('site search'), { key: '2' });
    expect(screen.getByText('0 questions')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: '3' });
    expect(screen.getByText('1 question')).toBeTruthy();
    expect(questions()[2]!.className).toMatch(/is-(yes|no)/);
    fireEvent.keyDown(document.body, { key: '4', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.keyDown(document.body, { key: '1' });
    expect(screen.getByText('1 question')).toBeTruthy();
  });
});

describe('Whatsit saves', () => {
  it('writes on top of what another tab stored, and "Another one" after Any theme stays random', () => {
    const report = vi.fn();
    const seedOf = (r: number) => (r * 2 ** 32) >>> 0;
    // Two random draws whose rounds land on different themes.
    const a = 0.11;
    const b = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].find((r) => makeRound(seedOf(r)).theme !== makeRound(seedOf(a)).theme)!;
    const draws = [a, b];
    vi.spyOn(Math, 'random').mockImplementation(() => draws.shift() ?? 0.5);
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Any theme/ }));
    // Another tab finishes today's daily meanwhile.
    const day = dayKey();
    localStorage.setItem(KEY, JSON.stringify({ rounds: 1, solved: 1, best: 925, daily: { [day]: { score: 925, solved: true, questions: 4, line: '🟩🟩🟩🟩' } } }));
    toLineup();
    fireEvent.click(screen.getAllByRole('button').find((x) => x.classList.contains('whz-card'))!);
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'This is my Whatsit!' }));
    expect(stored().daily[day]).toMatchObject({ score: 925, solved: true });
    expect(stored().rounds).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Another one' }));
    const theme = screen.getByText(/^Theme:/).parentElement!.textContent!;
    expect(theme).toContain(themeById(makeRound(seedOf(b)).theme)!.name.en);
    vi.restoreAllMocks();
  });

  it('a practice round carried on after the daily reports its start again', () => {
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Any theme/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Whatsit' }));
    toLineup();
    openCard(thingById(dailyRound(dayKey(), hashString).secret)!.name.en);
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'This is my Whatsit!' }));
    wait(400);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pick it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    expect(report.mock.calls.map(([e]) => e.type)).toEqual(['start', 'start', 'end', 'start']);
  });
});
