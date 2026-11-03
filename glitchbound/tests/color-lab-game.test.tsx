import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Game from '../src/games/color-lab/Game';
import { dailyLevel, ladderLevel, levelOf, type Level } from '../src/games/color-lab/levels';
import { loadCl, STORE_KEY } from '../src/games/color-lab/store';
import type { GameEvent, GameHost } from '../src/platform/contract';

/** Math.random is fixed, so a run's seed (and its levels) are known. */
const SEED = Math.floor(0.5 * 2 ** 32);

function setup(props: Partial<Parameters<typeof Game>[0]> = {}) {
  const events: GameEvent[] = [];
  const host: GameHost = { report: (e) => events.push(e) };
  const view = render(<Game host={host} restartKey={0} {...props} />);
  return { events, view, host };
}

const tubes = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.cl-tube')];
const moves = (): string => document.querySelector('.cl-moves b')!.textContent!;
const ends = (events: GameEvent[]) => events.filter((e) => e.type === 'end');

/** Plays `lv`'s par route by tapping the tubes. */
function solveByTaps(lv: Level): void {
  for (const m of lv.solution!) {
    fireEvent.click(tubes()[m.from]!);
    fireEvent.click(tubes()[m.to]!);
  }
}

/** Lets the solver's promises (sync without workers) settle. */
const settle = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  // Reduced motion: pours apply at once.
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Color Lab: Endless and Par Challenge runs are reported (CL-01)', () => {
  it('End run reports the run once and records the best', async () => {
    const { events } = setup();
    fireEvent.click(screen.getByText('Start Endless'));
    expect(events).toEqual([{ type: 'start' }]);
    solveByTaps(ladderLevel(SEED, 0));
    fireEvent.click(screen.getByRole('button', { name: 'End run' }));
    expect(screen.getByText('Endless run over')).toBeTruthy();
    expect(ends(events)).toEqual([{ type: 'end', score: 1, stats: { stars: 3, underPar: 1, levels: 1 } }]);
    expect(loadCl().endless).toMatchObject({ runs: 1, bestLevels: 1 });
    cleanup();
    expect(ends(events)).toHaveLength(1);
  });

  it('the back arrow and closing the game end the run too', async () => {
    const a = setup();
    fireEvent.click(screen.getByText('Start challenge'));
    solveByTaps(ladderLevel(SEED, 0));
    fireEvent.click(screen.getByRole('button', { name: 'End the run and go back to the menu' }));
    expect(ends(a.events)).toEqual([{ type: 'end', score: 1, stats: { stars: 3, underPar: 1, parLevels: 1 } }]);
    expect(screen.getByText('Best: 1 levels')).toBeTruthy();
    cleanup();

    const b = setup();
    fireEvent.click(screen.getByText('Start Endless'));
    solveByTaps(ladderLevel(SEED, 0));
    b.view.unmount();
    expect(ends(b.events)).toHaveLength(1);
    expect(loadCl().endless.runs).toBe(1);
  });

  it('a run left before any level is solved reports nothing', () => {
    const { events, view } = setup();
    fireEvent.click(screen.getByText('Start Endless'));
    view.unmount();
    expect(ends(events)).toHaveLength(0);
  });
});

describe('Color Lab play screen', () => {
  const practice = () => levelOf({ kind: 'practice', seed: SEED, size: 3 });

  it('CL-03: a hint disappears once the board changes (undo, spare tube)', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    const lv = practice();
    fireEvent.click(tubes()[lv.solution![0]!.from]!);
    fireEvent.click(tubes()[lv.solution![0]!.to]!);
    fireEvent.click(screen.getByRole('button', { name: /^Hint/ }));
    await settle();
    expect(document.querySelectorAll('.is-hint-from, .is-hint-to')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(document.querySelectorAll('.is-hint-from, .is-hint-to')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /^Hint/ }));
    await settle();
    expect(document.querySelectorAll('.is-hint-from')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /spare tube/ }));
    expect(document.querySelectorAll('.is-hint-from')).toHaveLength(0);
  });

  it('CL-05 / CL-12: shows tube keys; Caps Lock keys work and only Shift+R restarts', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    const lv = practice();
    expect([...document.querySelectorAll('.cl-key')].map((k) => k.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7'].slice(0, lv.board.length));
    const key = (k: string, o: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: k, ...o });
    const m = lv.solution![0]!;
    key(String(m.from + 1));
    key(String(m.to + 1));
    expect(moves()).toBe('1');
    key('R'); // Caps Lock, no Shift: not a restart
    expect(moves()).toBe('1');
    key('U'); // Caps Lock undo
    expect(moves()).toBe('0');
    key(String(m.from + 1));
    key(String(m.to + 1));
    key('R', { shiftKey: true });
    expect(moves()).toBe('0');
  });

  it('(e) keys typed into a field outside the game are not moves', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    const m = practice().solution![0]!;
    fireEvent.click(tubes()[m.from]!);
    fireEvent.click(tubes()[m.to]!);
    const input = document.body.appendChild(document.createElement('input'));
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(moves()).toBe('1');
    input.remove();
  });
});

describe('Color Lab friends’ challenges (checklist a, b; CL-09)', () => {
  const spec = { id: 'abc', round: 1, seed: 7, mode: 'fresh' as const, day: '2026-11-03' };

  it('hides the way out, resumes after a reload, and reports the end exactly once', async () => {
    let t = setup({ challenge: spec });
    expect(t.events).toEqual([{ type: 'start' }]);
    expect(screen.queryByRole('button', { name: /Back to menu|End the run/ })).toBeNull();
    solveByTaps(dailyLevel('challenge-7', 0));
    t.view.unmount();

    // Reloaded: still puzzle 2, the first one is not replayed.
    t = setup({ challenge: spec });
    expect(screen.getByText('⚔️ Challenge · 2/5')).toBeTruthy();
    for (let i = 1; i < 5; i++) {
      solveByTaps(dailyLevel('challenge-7', i));
      if (i < 4) {
        fireEvent.click(screen.getByRole('button', { name: 'Next level →' }));
        await settle();
      }
    }
    expect(ends(t.events)).toEqual([{ type: 'end', score: 50, stats: { stars: 15, underPar: 5 }, challenge: { id: 'abc', round: 1 } }]);
    t.view.unmount();

    // Finished: the result shows, nothing is played or reported again.
    t = setup({ challenge: spec });
    expect(screen.getByText('⚔️ Challenge round complete')).toBeTruthy();
    expect(t.events).toEqual([]);
  }, 60_000);

  it('a "Today’s daily" round uses the daily already played as its score', () => {
    const r = { solved: true, moves: 6, par: 6, hints: 0, spare: false, points: 10, stars: 3 };
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 2, daily: { '2026-11-03': [r, r, r, r, { ...r, points: 8, stars: 2, moves: 9 }] } }));
    const { events } = setup({ challenge: { ...spec, mode: 'daily' } });
    expect(events).toEqual([{ type: 'end', score: 48, stats: { stars: 14, underPar: 4 }, challenge: { id: 'abc', round: 1 } }]);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(loadCl().challenges['abc:1']?.done).toBe(true);
  });
});
