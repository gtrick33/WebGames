import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChallengeHistoryList } from '../src/components/ChallengeHistory';
import type { ChallengeHistoryItem } from '../src/platform/challenge';

const item = (over: Partial<ChallengeHistoryItem>): ChallengeHistoryItem => ({
  id: 'abc1234',
  game: 'wing-it',
  mode: 'fresh',
  round: 1,
  createdAt: Date.UTC(2026, 9, 20),
  updatedAt: Date.UTC(2026, 9, 21),
  closed: true,
  host: true,
  left: false,
  players: [
    { name: 'Ana', you: true, wins: 1, score: 40 },
    { name: 'Bo', you: false, wins: 0, score: 30 },
  ],
  leaders: ['Ana'],
  ...over,
});

describe('challenge history', () => {
  it('shows the game, the opponents, everyone’s score and the result, and opens the scoreboard', () => {
    render(<ChallengeHistoryList items={[item({}), item({ id: 'def5678', closed: false, round: 3, leaders: ['Bo'], players: [{ name: 'Bo', you: false, wins: 2, score: 12 }, { name: 'Ana', you: true, wins: 1, score: null }] })]} />);
    const [won, open] = screen.getAllByRole('link');
    expect(won!.getAttribute('href')).toBe('/games/wing-it?challenge=abc1234');
    expect(won!.textContent).toContain('Wing It');
    expect(won!.textContent).toContain('vs Bo');
    expect(won!.textContent).toContain('Ana 40 · Bo 30');
    expect(won!.textContent).toContain('You won');
    expect(open!.getAttribute('href')).toBe('/games/wing-it?challenge=def5678');
    expect(open!.textContent).toContain('round 3');
    expect(open!.textContent).toContain('Bo 12 · Ana –');
    expect(open!.textContent).toContain('Bo leads');
  });
});
