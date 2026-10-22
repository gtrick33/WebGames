import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board, moveMs, ROLL_MS } from '../src/games/backgammon/Board';
import { CHECKERS, endTurn, newGame, routesFrom, startPos, step, stepsBetween, type Game, type Pos, type Step } from '../src/games/backgammon/logic';
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

describe('backgammon: the steps from one position to the next (for the board to show them one by one)', () => {
  const at = (g: Game, from: number, die: number): Game => step(g, { from, to: from - die, die });
  it('steps made this turn, and a turn that has just ended', () => {
    const a = moving([5, 3]);
    const b = at(at(a, 13, 5), 8, 3);
    expect(stepsBetween(a, b)?.map(({ side, st }) => [side, st.from, st.to])).toEqual([
      [0, 13, 8],
      [0, 8, 5],
    ]);
    const c = endTurn(b);
    expect(stepsBetween(a, c)?.map(({ st }) => [st.from, st.to])).toEqual([
      [13, 8],
      [8, 5],
    ]);
    expect(stepsBetween(at(a, 13, 5), c)?.map(({ st }) => [st.from, st.to])).toEqual([[8, 5]]);
    expect(stepsBetween(c, c)).toEqual([]);
  });
  it('nothing to show step by step: a new game, or a position the steps do not reach', () => {
    const a = moving([5, 3]);
    expect(stepsBetween(at(a, 13, 5), a)).toBeNull();
    expect(stepsBetween(at(a, 13, 5), at(a, 13, 3))).toBeNull();
    expect(stepsBetween(at(a, 13, 5), newGame(2))).toBeNull();
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

  let ended: number;
  const show = (g: Game) => {
    game = g;
    ended = 0;
    const onStep = (st: Step): void => {
      steps.push(st);
      game = step(game, st);
      view.rerender(board());
    };
    const board = () => <Board w={WORDS.en} game={game} me={0} names={['You', 'Them']} canAct onStep={onStep} onDone={() => ended++} sfx={() => quiet} score={[0, 0]} target={5} />;
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

  const on = (d: number): string => point(d).getAttribute('aria-label')!.split(': ')[1]!;

  it('a lit point takes the checker there; the board shows it step by step, and the turn passes by itself', () => {
    show(moving([5, 3]));
    fireEvent.click(point(13));
    fireEvent.click(point(5));
    expect(steps.map((s) => [s.from, s.to])).toEqual([
      [13, 8],
      [8, 5],
    ]);
    // the 5 first: onto the 8 (with the three there), then on to the 5
    expect([on(13), on(8), on(5)]).toEqual(['4 You', '4 You', '0']);
    // nothing else can be picked up while it moves
    expect(document.querySelectorAll('.tb-point.is-source')).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(moveMs(0, steps[0]!) + 200));
    expect([on(13), on(8), on(5)]).toEqual(['4 You', '3 You', '1 You']);
    expect(ended).toBe(0);
    act(() => void vi.advanceTimersByTime(moveMs(0, steps[1]!) + 200));
    expect(ended).toBe(0);
    act(() => void vi.advanceTimersByTime(400));
    expect(ended).toBe(1);
  });

  it('no Undo and no Done: a move is made once it is chosen', () => {
    show(moving([5, 3]));
    expect([...document.querySelectorAll('button')].map((b) => b.textContent)).not.toEqual(expect.arrayContaining([expect.stringMatching(/Undo|Done/)]));
    fireEvent.click(point(13));
    fireEvent.click(point(8));
    expect([...document.querySelectorAll('button')].map((b) => b.textContent ?? '').filter((t) => /Undo|Done/.test(t))).toEqual([]);
  });

  it("someone else's whole turn arrives at once and is shown a step at a time", () => {
    const g = moving([5, 3]);
    const view = render(<Board w={WORDS.en} game={g} me={1} names={['Them', 'You']} canAct={false} sfx={() => quiet} score={[0, 0]} target={5} />);
    const label = (d: number): string => document.querySelector(`.tb-point[aria-label^="${d}:"]`)!.getAttribute('aria-label')!.split(': ')[1]!;
    // player 0's 13 and 8 are your 12 and 17 (you are player 1)
    const after = endTurn(step(step(g, { from: 13, to: 8, die: 5 }), { from: 8, to: 5, die: 3 }));
    view.rerender(<Board w={WORDS.en} game={after} me={1} names={['Them', 'You']} canAct={false} sfx={() => quiet} score={[0, 0]} target={5} />);
    expect([label(12), label(17), label(20)]).toEqual(['4 Them', '4 Them', '0']);
    act(() => void vi.advanceTimersByTime(moveMs(0, { from: 13, to: 8, die: 5 }) + 200));
    expect([label(12), label(17), label(20)]).toEqual(['4 Them', '3 Them', '1 Them']);
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
