import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChallengeDock, ChallengeIntro, ChallengeScores, ChallengeScoresChip, rankOf } from '../src/components/Challenge';
import type { ChallengeView } from '../src/platform/challenge';
import type { ChallengeRun, ChallengeRunState } from '../src/platform/useChallengeRun';
import { scoreboardOnStatus } from '../src/pages/GamePage';
import { fakeGame } from './fixtures';

const game = fakeGame({ challenge: { label: 'One run each.' } });
const timed = fakeGame({ challenge: { label: 'Fastest wins.', lowerIsBetter: true } });

const score = (name: string, s: number, you = false) => ({ name, score: s, stats: {}, you, at: 0 });
const view = (over: Partial<ChallengeView> = {}): ChallengeView => ({
  id: 'abc1234',
  game: game.slug,
  mode: 'fresh',
  day: '',
  round: 1,
  seed: 1,
  createdAt: 0,
  updatedAt: 0,
  players: [
    { name: 'Ana', you: false, wins: 0, total: 431, played: true },
    { name: 'Bo', you: true, wins: 0, total: 431, played: true },
    { name: 'Cy', you: false, wins: 0, total: 100, played: true },
  ],
  rounds: [{ round: 1, scores: [score('Ana', 431), score('Bo', 431, true), score('Cy', 100)] }],
  joined: true,
  yourTurn: false,
  full: false,
  host: false,
  closed: false,
  closesAt: 0,
  ...over,
});
const spec = { id: 'abc1234', round: 2, seed: 2, mode: 'fresh' as const, day: '' };
const runOf = (state: ChallengeRunState): ChallengeRun => ({ state, news: null, busy: false, begin: vi.fn(), finish: vi.fn(), rematch: vi.fn(async () => {}), close: vi.fn(async () => 'left' as const) });
const ranks = () => screen.getAllByRole('listitem').map((li) => li.textContent);

describe('challenge ranks', () => {
  it('ties share a place (1, 1, 3), lower first when lower is better', () => {
    expect([431, 431, 100].map((_, i, a) => rankOf(a, i))).toEqual([1, 1, 3]);
    expect([12, 9, 9, 30].map((_, i, a) => rankOf(a, i, true))).toEqual([3, 1, 1, 4]);
  });

  it('gives tied scores the same medal on the board and says "tied for #1" in the dock', () => {
    const run = runOf({ status: 'sent', view: view(), score: 431, spec: { ...spec, round: 1 } });
    render(<ChallengeScores run={run} game={game} onClose={() => {}} />);
    expect(ranks()).toEqual(['🥇Ana431', '🥇Bo431', '🥉Cy100']);
    render(<ChallengeDock run={run} game={game} stageRound={1} onPlayRound={() => {}} onScores={() => {}} scoresOpen />);
    expect(screen.getByRole('region', { name: 'Challenge' }).textContent).toContain('you’re tied for #1 of 3 so far');
  });

  it('orders by the fastest time when lower is better, in this round and earlier ones', () => {
    const rounds = [
      { round: 1, scores: [score('Ana', 30), score('Bo', 12, true), score('Cy', 12)] },
      { round: 2, scores: [score('Cy', 40), score('Ana', 20)] },
    ];
    render(<ChallengeScores run={runOf({ status: 'played', view: view({ round: 2, rounds, players: view().players.map((p) => ({ ...p, played: p.name !== 'Bo' })) }) })} game={timed} onClose={() => {}} />);
    expect(ranks().slice(0, 2)).toEqual(['🥇Ana20', '🥈Cy40']);
    expect(screen.getByText(/round 1/).parentElement!.textContent).toContain('🥇 Bo 12 · 🥇 Cy 12 · 🥉 Ana 30');
  });

  it('final standings share a medal for equal round wins', () => {
    const players = [
      { name: 'Ana', you: false, wins: 2, total: 900, played: true },
      { name: 'Bo', you: true, wins: 2, total: 800, played: true },
      { name: 'Cy', you: false, wins: 1, total: 100, played: true },
    ];
    render(<ChallengeScores run={runOf({ status: 'closed', view: view({ closed: true, players }) })} game={game} onClose={() => {}} />);
    expect(ranks().map((r) => r!.slice(0, 2))).toEqual(['🥇', '🥇', '🥉']);
  });
});

describe('challenge scoreboard on the stage', () => {
  it('offers "Play round N" when a new round started while the stage plays the last one', () => {
    const onPlayRound = vi.fn();
    const run = runOf({ status: 'ready', view: view({ round: 2, yourTurn: true }), spec });
    const { rerender } = render(<ChallengeScores run={run} game={game} onClose={() => {}} stageRound={1} onPlayRound={onPlayRound} />);
    fireEvent.click(screen.getByRole('button', { name: /Play round 2/ }));
    expect(onPlayRound).toHaveBeenCalledOnce();
    // Already on that round (or not playing): no button.
    rerender(<ChallengeScores run={run} game={game} onClose={() => {}} stageRound={2} onPlayRound={onPlayRound} />);
    expect(screen.queryByRole('button', { name: /Play round/ })).toBeNull();
  });

  it('waits for the game: a sent score is a chip while the game still shows its result', () => {
    expect(scoreboardOnStatus('sent', { open: false, playing: true, stageOld: false })).toEqual({ open: false, chip: true });
    expect(scoreboardOnStatus('sent', { open: false, playing: false, stageOld: false })).toEqual({ open: true, chip: false });
    expect(scoreboardOnStatus('closed', { open: false, playing: true, stageOld: false })).toEqual({ open: true, chip: false });
    // Next round pressed on the board: it stays open with Play round N; a round on the stage closes it.
    expect(scoreboardOnStatus('ready', { open: true, playing: true, stageOld: true })).toEqual({ open: true, chip: false });
    expect(scoreboardOnStatus('ready', { open: true, playing: false, stageOld: false })).toEqual({ open: false, chip: false });
    expect(scoreboardOnStatus('ready', { open: false, playing: true, stageOld: true })).toEqual({ open: false, chip: false });
  });

  it('the chip opens the scoreboard or goes away', () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(<ChallengeScoresChip score={4205} onOpen={onOpen} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /Score sent: 4,205 · See the scoreboard/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('challenge intro', () => {
  it('says this run counts and leads with How to play before a first round', () => {
    const onPlay = vi.fn();
    const onHowTo = vi.fn();
    const fresh = view({ rounds: [], yourTurn: true, players: [{ name: 'Ana', you: false, wins: 0, total: 0, played: false }, { name: 'Bo', you: true, wins: 0, total: 0, played: false }] });
    const { rerender } = render(<ChallengeIntro run={runOf({ status: 'ready', view: fresh, spec: { ...spec, round: 1 } })} game={game} onPlay={onPlay} onHowTo={onHowTo} />);
    const intro = screen.getByRole('region', { name: 'Challenge' });
    expect(intro.textContent).toContain('Ana’s challenge · round 1');
    expect(intro.textContent).toContain('This run counts');
    expect(intro.textContent).toContain('One attempt: your first finished score goes on the board. One run each.');
    fireEvent.click(screen.getByRole('button', { name: /How to play/ }));
    fireEvent.click(screen.getByRole('button', { name: /Play round 1/ }));
    expect(onHowTo).toHaveBeenCalledOnce();
    expect(onPlay).toHaveBeenCalledOnce();
    // A later round, after you played one: straight to Play.
    rerender(<ChallengeIntro run={runOf({ status: 'ready', view: view({ round: 2, yourTurn: true }), spec })} game={game} onPlay={onPlay} onHowTo={onHowTo} />);
    expect(screen.queryByRole('button', { name: /How to play/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Play round 2/ }).className).toContain('btn-primary');
    // Not your turn: no intro.
    rerender(<ChallengeIntro run={runOf({ status: 'played', view: view() })} game={game} onPlay={onPlay} />);
    expect(screen.queryByRole('region', { name: 'Challenge' })).toBeNull();
  });
});
