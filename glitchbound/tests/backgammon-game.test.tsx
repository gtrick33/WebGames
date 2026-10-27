import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choosePlay } from '../src/games/backgammon/ai';
import Game from '../src/games/backgammon/Game';
import { newMatch, nextSteps, roll, rng, type Step } from '../src/games/backgammon/logic';
import { hashString } from '../src/platform/dates';

const KEY = 'glitchbound.backgammon';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '{}').current?.match?.game as { turn: 0 | 1; phase: string; rolls: number } | undefined;
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
