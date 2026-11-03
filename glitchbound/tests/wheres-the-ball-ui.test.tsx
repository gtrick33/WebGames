import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey } from '../src/platform/dates';
import { STORE_KEY } from '../src/games/wheres-the-ball/store';

// No photo files in jsdom: every photo "loads" at once and paints nothing.
vi.mock('../src/games/wheres-the-ball/photoPaint', () => ({
  loadPhoto: () => Promise.resolve({}),
  buildComposite: () => document.createElement('canvas'),
  paintComposite: () => undefined,
}));
const { default: Game } = await import('../src/games/wheres-the-ball/Game');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = () => act(async () => undefined);
const giveUp = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, show me' }));
  await flush();
};
const fresh = (id = 'abc', round = 1): ChallengeSpec => ({ id, round, seed: 4242, mode: 'fresh', day: '' });

describe("Where's the Ball? play screen", () => {
  it('starts every shot clean: give-up not armed, and it disarms itself after 3 s', async () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Find today/ }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));
    act(() => void vi.advanceTimersByTime(3100));
    expect(screen.getByRole('button', { name: 'Give up' })).toBeTruthy();
    await giveUp();
    expect(screen.getByText('There it was!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next shot/ }));
    await flush();
    expect(screen.getByRole('button', { name: 'Give up' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yes, show me' })).toBeNull();
    expect(screen.getByText('1×')).toBeTruthy();
  });

  it('aims with the arrow keys, locks in with Enter and announces hot/warm/cold', async () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Find today/ }));
    await flush();
    expect(screen.getByRole('button', { name: 'Tap where the ball is' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Lock it in' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Enter' });
    const live = document.querySelector('[aria-live="polite"]')!;
    // Either a find (the result card) or a wrong guess, which is announced.
    expect(screen.queryByText('Found it!') || screen.queryByText('Ace! 🎾') || /Hot|Warm|Cold/.test(live.textContent ?? '')).toBeTruthy();
  });

  it('ignores keys typed in a field', async () => {
    render(
      <>
        <input aria-label="search" />
        <Game host={{ report: vi.fn() }} restartKey={0} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Find today/ }));
    await flush();
    fireEvent.keyDown(screen.getByLabelText('search'), { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: 'Tap where the ball is' })).toBeTruthy();
  });
});

describe("Where's the Ball? challenge rounds are one attempt", () => {
  it('has no way out mid-round, resumes after a reload and never replays a finished round', async () => {
    const report = vi.fn();
    const first = render(<Game host={{ report }} restartKey={0} challenge={fresh()} />);
    await flush();
    expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
    await giveUp();
    first.unmount();

    render(<Game host={{ report }} restartKey={1} challenge={fresh()} />);
    await flush();
    expect(screen.getByText(/Challenge · 2\/5/)).toBeTruthy();
    for (let i = 1; i < 5; i++) {
      await giveUp();
      fireEvent.click(screen.getByRole('button', { name: i < 4 ? /Next shot/ : 'See results' }));
      await flush();
    }
    expect(report.mock.calls.filter(([e]) => e.type === 'end')).toEqual([[{ type: 'end', score: 0, stats: { found: 0 }, challenge: { id: 'abc', round: 1 } }]]);
    expect(screen.getByText('⚔️ Challenge round complete')).toBeTruthy();
  });

  it('shows a finished round again without playing or reporting it', async () => {
    const results = Array.from({ length: 5 }, () => ({ found: true, score: 800, seconds: 9, wrong: 0, hints: 0 }));
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, daily: {}, challenges: { 'abc:1': { day: dayKey(), results, progress: null, done: true } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={fresh()} />);
    await flush();
    expect(screen.getByText('You already played this round.')).toBeTruthy();
    expect(screen.getByText('4,000')).toBeTruthy();
    expect(report).not.toHaveBeenCalled();
  });

  it("counts today's finished daily as a daily challenge's score, once", async () => {
    const today = dayKey();
    const results = Array.from({ length: 5 }, () => ({ found: true, score: 700, seconds: 12, wrong: 0, hints: 0 }));
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, daily: { [today]: results } }));
    const report = vi.fn();
    const spec: ChallengeSpec = { id: 'day', round: 1, seed: 1, mode: 'daily', day: today };
    const first = render(<Game host={{ report }} restartKey={0} challenge={spec} />);
    await flush();
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 3500, stats: { found: 5, fastest: 12 }, challenge: { id: 'day', round: 1 } });
    first.unmount();
    report.mockClear();
    render(<Game host={{ report }} restartKey={1} challenge={spec} />);
    await flush();
    expect(report).not.toHaveBeenCalled();
  });

  it("plays today's daily for a daily challenge and records it as the daily", async () => {
    const today = dayKey();
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={{ id: 'd2', round: 1, seed: 99, mode: 'daily', day: today }} />);
    await flush();
    await giveUp();
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.daily[today]).toHaveLength(1);
  });
});
