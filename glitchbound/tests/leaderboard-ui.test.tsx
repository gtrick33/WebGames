import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { MiniLeaderboard } from '../src/components/Leaderboard';

describe('leaderboard panel', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gives up on a board that never answers, then loads it on Try again', async () => {
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
    render(<MiniLeaderboard game={GAMES.find((g) => g.slug === 'gut-check')!} refreshKey={0} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText(/offline right now/)).toBeTruthy();
    answer = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Carol')).toBeTruthy();
  });
});
