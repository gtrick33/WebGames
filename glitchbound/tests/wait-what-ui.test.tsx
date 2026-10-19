import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Game from '../src/games/wait-what/Game';
import { dailyQuiz, QUIZ_LENGTH, timeLimit } from '../src/games/wait-what/deck';
import { dayKey } from '../src/platform/dates';

describe('Wait, What? UI', () => {
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
