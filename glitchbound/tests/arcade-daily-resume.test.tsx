import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SquareDeal from '../src/games/square-deal/Game';
import StarGrid from '../src/games/star-grid/Game';
import OuttaHere from '../src/games/outta-here/Game';
import GutCheck from '../src/games/gut-check/Game';
import ToScale from '../src/games/to-scale/Game';
import Gloop from '../src/games/gloop/Game';
import { fromSaved, newGame, place, toSaved } from '../src/games/square-deal/logic';
import { drop, newSim, setAim, simFrom, step } from '../src/games/gloop/sim';
import { canLeave, makeLevel } from '../src/games/outta-here/logic';
import { answerIsMore, chain } from '../src/games/gut-check/logic';
import { dayKey, hashString } from '../src/platform/dates';
import type { ChallengeSpec } from '../src/platform/challenge';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const host = () => ({ report: vi.fn() });
const press = (key: string, extra: Record<string, unknown> = {}) =>
  act(() => {
    fireEvent.keyDown(window, { key, ...extra });
  });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('saved rounds come back exactly', () => {
  it('Square Deal: a saved deal rebuilds the same board, tray and score; junk is refused', () => {
    let s = newGame(42);
    for (let i = 0; i < 3; i++) {
      const slot = s.tray.findIndex((p) => p);
      s = place(s, slot, i * 3 > 5 ? 0 : i * 3, 0).state;
    }
    const back = fromSaved(JSON.parse(JSON.stringify(toSaved(s))));
    expect(back).toEqual(s);
    expect(fromSaved({ ...toSaved(s), board: [1, 2] })).toBeNull();
    expect(fromSaved({ ...toSaved(s), tray: [999, null, null] })).toBeNull();
    expect(fromSaved('nope')).toBeNull();
  });

  it('Gloop: a jar saved mid-fall plays on exactly as it would have (nothing to gain by reloading)', () => {
    const a = newSim(7);
    for (let i = 0; i < 900; i++) {
      if (i % 60 === 0) {
        setAim(a, 60 + ((i * 37) % 240));
        drop(a);
      }
      step(a);
    }
    const b = simFrom(JSON.parse(JSON.stringify(a)))!;
    expect(b).toEqual(a);
    for (let i = 0; i < 600; i++) {
      step(a);
      step(b);
    }
    expect(b).toEqual(a);
    expect(simFrom({ ...a, blobs: [{ ...a.blobs[0]!, r: 1 }] })).toBeNull();
    expect(simFrom({ ...a, over: true })).toBeNull();
  });
});

describe('a daily left halfway carries on (and is still one try)', () => {
  it('Gut Check: carries on from the same card and streak', () => {
    const pairs = chain(hashString(`gut-check:${dayKey()}`), 4);
    const call = (i: number, right: boolean) => {
      const more = answerIsMore(pairs[i]!) === right;
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${more ? '▲' : '▼'}`) }));
    };
    const first = render(<GutCheck host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s cards' }));
    call(0, true);
    wait(1200);
    call(1, true);
    first.unmount(); // a reload during the reveal

    const report = vi.fn();
    render(<GutCheck host={{ report }} restartKey={0} />);
    expect(screen.getByText('In progress · 2 in a row so far')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play today’s cards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue today’s cards' }));
    call(2, false);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 2, stats: {}, daily: true });
    wait(2000);
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]!);
    expect(screen.getByText('Today: 2 in a row')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continue/ })).toBeNull();
  });

  it('Square Deal: carries on with the same board after a reload', () => {
    const first = render(<SquareDeal host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s deal' }));
    press('1');
    for (let i = 0; i < 4; i++) {
      press('ArrowUp');
      press('ArrowLeft');
    }
    press('Enter');
    const filled = document.querySelectorAll('.sd-cell.is-filled').length;
    expect(filled).toBeGreaterThan(0);
    first.unmount();

    render(<SquareDeal host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue today’s deal' }));
    expect(document.querySelectorAll('.sd-cell.is-filled')).toHaveLength(filled);
    expect(screen.getAllByRole('button', { name: /^Piece \d|^Used$/ }).filter((b) => b.getAttribute('aria-label') === 'Used')).toHaveLength(1);
  });

  it('Star Grid: carries on with the same marks and clock', () => {
    const first = render(<StarGrid host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grids' }));
    press('ArrowDown');
    press('s');
    wait(4000);
    first.unmount();

    render(<StarGrid host={host()} restartKey={0} />);
    expect(screen.getByText('In progress · grid 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue today’s grids' }));
    expect(screen.getAllByRole('gridcell').filter((c) => c.getAttribute('aria-label')?.endsWith(': star'))).toHaveLength(1);
    wait(1000);
    expect(screen.getByText('0:05')).toBeTruthy();
  });

  it('Outta Here: carries on with the same arrows and hearts', () => {
    const level = makeLevel(hashString(`outta-here:${dayKey()}`), 1);
    const first = render(<OuttaHere host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s levels' }));
    const free = level.arrows.findIndex((a) => canLeave(level, new Set(), a));
    const stuck = level.arrows.findIndex((a) => !canLeave(level, new Set([level.arrows[free]!.id]), a));
    fireEvent.pointerDown(document.querySelectorAll('g.oh-arrow')[free]!.querySelector('rect')!);
    fireEvent.pointerDown(document.querySelectorAll('g.oh-arrow')[stuck]!.querySelector('rect')!);
    first.unmount();

    render(<OuttaHere host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue today’s levels' }));
    expect(screen.getByLabelText('2 hearts left')).toBeTruthy();
    expect(screen.getByRole('grid', { name: `Level 1: ${level.arrows.length - 1} arrows left` })).toBeTruthy();
  });

  it('To Scale: carries on with the next shot; locked-in shots stay as they were', () => {
    const first = render(<ToScale host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s 5' }));
    for (let i = 0; i < 2; i++) {
      press('Enter');
      press('Enter');
    }
    first.unmount();

    render(<ToScale host={host()} restartKey={0} />);
    expect(screen.getByText(/^In progress · 2 of 5 shots/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    const dots = [...document.querySelectorAll('.ts-dots i')].map((i) => i.className);
    expect(dots.filter((c) => c.startsWith('is-') && c !== 'is-now')).toHaveLength(2);
    expect(dots[2]).toBe('is-now');
  });

  it('Gloop: picks the jar up again, paused, with the same score', () => {
    const first = render(<Gloop host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill today’s jar' }));
    press(' ');
    wait(3000);
    first.unmount();

    render(<Gloop host={host()} restartKey={0} />);
    expect(screen.getByText(/^In progress · \d+ so far/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Carry on with today’s jar' }));
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
  });
});

describe('Outta Here speed bonus', () => {
  it('times level 1 from when it appears, like every later level', () => {
    const seed = 99;
    const challenge: ChallengeSpec = { id: 'x', round: 1, seed, mode: 'fresh', day: '2026-10-19' };
    const level = makeLevel(seed, 1);
    render(<OuttaHere host={host()} restartKey={0} challenge={challenge} />);
    wait(30_000);
    const gone = new Set<number>();
    while (gone.size < level.arrows.length) {
      const a = level.arrows.find((x) => !gone.has(x.id) && canLeave(level, gone, x))!;
      fireEvent.pointerDown(document.querySelectorAll('g.oh-arrow')[a.id]!.querySelector('rect')!);
      gone.add(a.id);
    }
    // arrows × 10 + level bonus 50 + flawless 100 + speed (60 − 30 seconds).
    expect(screen.getByText(`+${level.arrows.length * 10 + 50 + 100 + 30} · flawless`)).toBeTruthy();
  });
});

describe('a daily that cannot be picked up again', () => {
  it('is settled once at 0 (so the day still counts), shows as left unfinished and never reopens', () => {
    const today = dayKey();
    for (const [Game, key, label] of [
      [SquareDeal, 'glitchbound.square-deal', 'Play today’s deal'],
      [GutCheck, 'glitchbound.gut-check', 'Play today’s cards'],
    ] as const) {
      // Started today, but the saved round is gone (storage cleared or damaged).
      localStorage.setItem(key, JSON.stringify({ daily: { [today]: { best: 0, tries: 1, lines: 0, streak: 0, open: true } } }));
      const report = vi.fn();
      const first = render(<Game host={{ report }} restartKey={0} />);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: {}, daily: true });
      expect(screen.getByText('Left unfinished · one try a day')).toBeTruthy();
      expect(screen.queryByRole('button', { name: label })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull();
      first.unmount();
      // Opening the game again reports nothing more.
      const again = vi.fn();
      const second = render(<Game host={{ report: again }} restartKey={0} />);
      expect(again).not.toHaveBeenCalled();
      expect(screen.getByText('Left unfinished · one try a day')).toBeTruthy();
      second.unmount();
    }
  });

  it('a daily just started and reloaded at once is resumed, not settled', () => {
    const first = render(<Gloop host={host()} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill today’s jar' }));
    first.unmount();
    const report = vi.fn();
    render(<Gloop host={{ report }} restartKey={0} />);
    expect(report).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Carry on with today’s jar' })).toBeTruthy();
  });
});
