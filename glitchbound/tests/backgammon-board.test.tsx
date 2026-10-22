import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, HOP_MS, ROLL_MS } from '../src/games/backgammon/Board';
import { CHECKERS, newGame, routesFrom, startPos, step, type Game, type Pos, type Step } from '../src/games/backgammon/logic';
import type { Sfx } from '../src/games/backgammon/sound';
import { WORDS } from '../src/games/backgammon/text';

/** Your move (player 0) with these dice, from a position (the start if none). */
function moving(dice: [number, number], pos: Pos = startPos()): Game {
  const left = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice];
  return { ...newGame(1), pos, turnStart: pos, turn: 0, phase: 'move', roll: dice, left, steps: [], rolls: 3 };
}
const quiet = new Proxy({}, { get: () => () => undefined }) as Sfx;

describe('backgammon: where a checker can go', () => {
  it('each number on its own and both together, through a point it may land on', () => {
    const g = moving([5, 3]);
    const to = (from: number): Record<number, number[]> => Object.fromEntries(routesFrom(g, from).map((r) => [r.to, r.steps.map((s) => s.die)]));
    // 13: 8 with the 5, 10 with the 3, 5 with both
    expect(to(13)).toEqual({ 8: [5], 10: [3], 5: [5, 3] });
    // 24: the 5 lands on their five (closed), so the 8 goes 3 first
    expect(to(24)).toEqual({ 21: [3], 16: [3, 5] });
  });

  it('a double goes one, two, three or four steps', () => {
    const g = moving([2, 2]);
    expect(routesFrom(g, 13).map((r) => [r.to, r.steps.length])).toEqual([
      [11, 1],
      [9, 2],
      [7, 3],
      [5, 4],
    ]);
  });

  it('of two equal ways it takes the one that does not hit on the way', () => {
    // your checker on 13, their blot on 8 (5 away), 10 empty (3 away): 13 → 5 goes 3 first
    const pts = Array<number>(25).fill(0);
    pts[13] = 1;
    pts[8] = -1;
    pts[1] = -14;
    const pos: Pos = { pts, bar: [0, 0], off: [CHECKERS - 1, 0] };
    const r = routesFrom(moving([5, 3], pos), 13).find((x) => x.to === 5)!;
    expect(r.steps.map((s) => s.die)).toEqual([3, 5]);
    expect(r.steps.some((s) => s.hit)).toBe(false);
  });
});

describe('backgammon: choosing a move on the board', () => {
  let steps: Step[];
  let game: Game;
  beforeEach(() => {
    vi.useFakeTimers();
    steps = [];
  });
  afterEach(() => vi.useRealTimers());

  const show = (g: Game) => {
    game = g;
    const onStep = (st: Step): void => {
      steps.push(st);
      game = step(game, st);
      view.rerender(board());
    };
    const board = () => <Board w={WORDS.en} game={game} me={0} names={['You', 'Them']} canAct onStep={onStep} sfx={() => quiet} score={[0, 0]} target={5} />;
    const view = render(board());
    return view;
  };
  const point = (d: number): Element => document.querySelector(`.tb-point[aria-label^="${d}:"]`)!;
  const lit = (): Record<string, string> => Object.fromEntries([...document.querySelectorAll('.tb-point.is-target')].map((el) => [el.getAttribute('aria-label')!.split(':')[0]!, ''])) as Record<string, string>;

  it('a tap picks a checker up and lights every place it can go with its count; nothing moves until you choose', () => {
    show(moving([5, 3]));
    fireEvent.click(point(13));
    expect(steps).toEqual([]);
    expect(Object.keys(lit()).sort()).toEqual(['10', '5', '8']);
    expect([...document.querySelectorAll('.tb-land-n')].map((el) => el.textContent).sort()).toEqual(['3', '5', '8']);
    // a checker with a single place to go is picked up too, not moved
    fireEvent.click(point(24));
    expect(steps).toEqual([]);
    // tapped again, it is put down
    fireEvent.click(point(24));
    expect(Object.keys(lit())).toEqual([]);
  });

  it('a lit point takes the checker there, both numbers hopping through the point between', () => {
    show(moving([5, 3]));
    fireEvent.click(point(13));
    fireEvent.click(point(5));
    expect(steps.map((s) => [s.from, s.to])).toEqual([[13, 8]]);
    act(() => void vi.advanceTimersByTime(HOP_MS));
    expect(steps.map((s) => [s.from, s.to])).toEqual([
      [13, 8],
      [8, 5],
    ]);
  });

  it('the dice shake before they land, and no checker moves until they have', () => {
    const view = show({ ...moving([5, 3]), rolls: 2 });
    view.rerender(<Board w={WORDS.en} game={(game = { ...game, rolls: 3 })} me={0} names={['You', 'Them']} canAct onStep={() => undefined} sfx={() => quiet} score={[0, 0]} target={5} />);
    expect(document.querySelector('.tb-dice.is-rolling')).toBeTruthy();
    expect(document.querySelectorAll('.tb-point.is-source')).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(ROLL_MS));
    expect(document.querySelector('.tb-dice.is-landed')).toBeTruthy();
    expect(document.querySelectorAll('.tb-point.is-source').length).toBeGreaterThan(0);
  });
});
