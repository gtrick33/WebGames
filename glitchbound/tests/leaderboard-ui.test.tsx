import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { MiniLeaderboard } from '../src/components/Leaderboard';

describe('leaderboard panel', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows only real members: loading, gives up on scores that never come, then loads them on Try again', async () => {
    vi.useFakeTimers();
    let answer = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) =>
        answer && String(path).startsWith('/api/leaderboard')
          ? Promise.resolve(new Response(JSON.stringify({ rows: [{ rank: 1, nickname: 'Carol', level: 2, score: 50, at: 1, you: false }], mine: null })))
          : new Promise<Response>(() => undefined),
      ),
    );
    const view = render(<MiniLeaderboard game={GAMES.find((g) => g.slug === 'gut-check')!} refreshKey={0} />);
    const rows = (): number => view.container.querySelectorAll('.board-row').length;
    // nobody made up fills the board while the scores load
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(rows()).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText(/offline right now/)).toBeTruthy();
    expect(rows()).toBe(0);
    answer = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(rows()).toBe(1);
    expect(view.container.textContent).not.toMatch(/House|🤖/);
  });

  it('an empty board says so instead of filling up with computer players', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ rows: [], mine: null })))));
    const view = render(<MiniLeaderboard game={GAMES.find((g) => g.slug === 'gut-check')!} refreshKey={0} />);
    expect(await screen.findByText(/No ranked scores yet/)).toBeTruthy();
    expect(view.container.querySelectorAll('.board-row').length).toBe(0);
  });
});
