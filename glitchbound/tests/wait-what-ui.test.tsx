import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Game from '../src/games/wait-what/Game';
import { dailyQuiz, QUIZ_LENGTH, timeLimit } from '../src/games/wait-what/deck';
import { dayKey } from '../src/platform/dates';

describe('Quizbelief UI', () => {
  it('a daily reloaded while its last answer was on show goes to the results, without asking that question again', () => {
    const today = dayKey();
    expect(dailyQuiz(today)).toHaveLength(QUIZ_LENGTH);
    // Ten answers saved (all timed out), but the page was closed before "See results".
    const picks = Array.from({ length: QUIZ_LENGTH }, () => -1);
    localStorage.setItem('glitchbound.wait-what', JSON.stringify({ daily: { [today]: { picks, secs: picks.map(() => 20), pts: picks.map(() => 0), done: false } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Time’s up!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See results' }));
    expect(screen.getByText(`0 right out of ${QUIZ_LENGTH}`)).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { correct: 0, streak: 0 }, daily: true });
    const saved = JSON.parse(localStorage.getItem('glitchbound.wait-what')!) as { daily: Record<string, { picks: unknown[]; done: boolean }> };
    expect(saved.daily[today]).toMatchObject({ done: true });
    expect(saved.daily[today]!.picks).toHaveLength(QUIZ_LENGTH);
  });

  it('keeps the daily as soon as the last answer is in, before "See results"', () => {
    vi.useFakeTimers();
    const today = dayKey();
    const quiz = dailyQuiz(today);
    const picks = Array.from({ length: QUIZ_LENGTH - 1 }, () => -1);
    localStorage.setItem('glitchbound.wait-what', JSON.stringify({ daily: { [today]: { picks, secs: picks.map(() => 20), pts: picks.map(() => 0), done: false } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    // Let the last question run out of time.
    act(() => {
      vi.advanceTimersByTime((timeLimit(quiz[QUIZ_LENGTH - 1]!) + 1) * 1000);
    });
    expect(screen.getByRole('button', { name: 'See results' })).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { correct: 0, streak: 0 }, daily: true });
    const saved = JSON.parse(localStorage.getItem('glitchbound.wait-what')!) as { daily: Record<string, { picks: unknown[]; done: boolean }> };
    expect(saved.daily[today]).toMatchObject({ done: true });
    fireEvent.click(screen.getByRole('button', { name: 'See results' }));
    expect(report.mock.calls.filter(([e]) => (e as { type: string }).type === 'end')).toHaveLength(1);
    vi.useRealTimers();
  });
});

const STORE = 'glitchbound.wait-what';
const stored = (): { daily: Record<string, { picks: unknown[]; done: boolean }>; runs: Record<string, { picks: unknown[]; done: boolean }> } => JSON.parse(localStorage.getItem(STORE)!);
const hide = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('Quizbelief clock and saves', () => {
  it('in the daily the clock keeps running while the tab is hidden: the question times out', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE);
    const q = dailyQuiz(dayKey())[0]!;
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s quiz' }));
    act(() => hide(true));
    expect(screen.getByText(/the clock keeps running/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime((timeLimit(q) + 1) * 1000);
    });
    act(() => hide(false));
    expect(screen.getByText('Time’s up!')).toBeTruthy();
    expect(stored().daily[dayKey()]!.picks).toEqual([-1]);
    vi.useRealTimers();
  });

  it('endless still pauses for real', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE);
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start an endless run' }));
    act(() => hide(true));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => hide(false));
    expect(screen.queryByText('Time’s up!')).toBeNull();
    expect(screen.getByText('Tap to carry on. The clock is stopped.')).toBeTruthy();
    vi.useRealTimers();
  });

  it('a reload does not give a fresh clock: time away still counts', () => {
    const today = dayKey();
    localStorage.setItem(STORE, JSON.stringify({ daily: { [today]: { picks: [], secs: [], pts: [], cur: { i: 0, secs: 1, at: Date.now() - 120_000 }, done: false } } }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Time’s up!')).toBeTruthy();
  });

  it('keeps another tab’s progress when it saves, and survives a corrupted save', () => {
    localStorage.setItem(STORE, JSON.stringify({ daily: { '2026-01-01': { picks: 'x' } }, runs: 7, seen: [1, 'a'], best: 'lots', answered: -4 }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s quiz' }));
    // Another tab finishes a different day meanwhile.
    const other = { picks: [-1], secs: [20], pts: [0], done: true };
    localStorage.setItem(STORE, JSON.stringify({ ...stored(), daily: { ...stored().daily, '2026-02-02': other } }));
    const q = dailyQuiz(dayKey())[0]!;
    if ((q.kind ?? 'choice') === 'choice') fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('ww-answer'))!);
    else fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('ww-answer') || b.className.includes('ww-order-item') || b.className.includes('ww-lock'))!);
    expect(stored().daily['2026-02-02']).toMatchObject({ done: true });
    expect(stored().daily['2026-01-01']).toBeUndefined();
  });

  it('ignores keys typed outside the game', () => {
    localStorage.removeItem(STORE);
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s quiz' }));
    const box = document.createElement('textarea');
    document.body.appendChild(box);
    fireEvent.keyDown(box, { key: '1' });
    fireEvent.keyDown(box, { key: 'Enter' });
    box.remove();
    expect(stored().daily[dayKey()]!.picks).toEqual([]);
  });
});

describe('Quizbelief challenges', () => {
  it('a finished round shows its results and is never played again', () => {
    const picks = Array.from({ length: QUIZ_LENGTH }, () => -1);
    localStorage.setItem(STORE, JSON.stringify({ runs: { 'c1:1': { picks, secs: picks.map(() => 20), pts: picks.map(() => 0), done: true } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={{ id: 'c1', round: 1, seed: 5, mode: 'fresh', day: '2026-10-30' }} />);
    expect(screen.getByText('See the scoreboard')).toBeTruthy();
    expect(report).not.toHaveBeenCalled();
  });

  it('"Today’s daily" counts the daily already played, reported once', () => {
    const today = dayKey();
    const picks = Array.from({ length: QUIZ_LENGTH }, () => -1);
    localStorage.setItem(STORE, JSON.stringify({ daily: { [today]: { picks, secs: picks.map(() => 20), pts: picks.map(() => 0), done: true } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={{ id: 'c2', round: 1, seed: 9, mode: 'daily', day: today }} />);
    expect(screen.getByText(/your result counts here|that result counts here/)).toBeTruthy();
    expect(report.mock.calls).toEqual([[{ type: 'end', score: 0, stats: { correct: 0, streak: 0 }, challenge: { id: 'c2', round: 1 } }]]);
    expect(stored().runs['c2:1']).toMatchObject({ done: true });
  });

  it('"Today’s daily" plays the real daily and records it as the daily too', () => {
    const today = dayKey();
    localStorage.removeItem(STORE);
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={{ id: 'c3', round: 1, seed: 9, mode: 'daily', day: today }} />);
    expect(document.querySelector('.ww-q')!.textContent).toBe(dailyQuiz(today)[0]!.text);
    expect(stored().daily[today]).toBeTruthy();
    expect(stored().runs['c3:1']).toBeTruthy();
  });
});

describe('Quizbelief in Bulgarian', () => {
  it('loads the Bulgarian questions and plays a whole daily in Bulgarian', async () => {
    localStorage.removeItem('glitchbound.wait-what');
    render(<Game host={{ report: vi.fn() }} restartKey={0} lang="bg" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Играй днешния куиз' }, { timeout: 5000 }));
    // The question card and its category chip are in Bulgarian.
    const chip = document.querySelector('.ww-chip')!.textContent!;
    expect(chip).toMatch(/[А-Яа-я]/);
    expect(document.querySelector('.ww-q')!.textContent).toMatch(/[А-Яа-я]/);
  });
});
