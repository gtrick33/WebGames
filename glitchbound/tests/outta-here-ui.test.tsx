import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OuttaHere from '../src/games/outta-here/Game';
import { arrowAt, canLeave, DC, DR, makeLevel, pathAhead, type Level } from '../src/games/outta-here/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey, hashString } from '../src/platform/dates';

const KEY = 'glitchbound.outta-here';
beforeEach(() => {
  vi.useFakeTimers();
  // The first-visit walkthrough is seen (a test below opens it on purpose).
  localStorage.setItem('glitchbound.coach.outta-here', '1');
});
afterEach(() => {
  vi.useRealTimers();
});

const host = () => ({ report: vi.fn() });
const key = (target: Window | Element, k: string, extra: Record<string, unknown> = {}): boolean => {
  let ok = true;
  act(() => {
    ok = fireEvent.keyDown(target, { key: k, ...extra });
  });
  return ok;
};
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const tap = (id: number) => fireEvent.pointerDown(document.querySelectorAll('g.oh-arrow')[id]!.querySelector('rect')!);
const hearts = (): string => screen.getByLabelText(/hearts? left$/).getAttribute('aria-label')!;
const todays = (): Level => makeLevel(hashString(`outta-here:${dayKey()}`), 1);
const stuck = (level: Level): number => level.arrows.findIndex((a) => !canLeave(level, new Set(), a));
/** Where an arrow key takes the cursor: the next arrow that way, or one step when there is none. */
function jump(level: Level, gone: Set<number>, c: number, d: 0 | 1 | 2 | 3): number {
  const here = arrowAt(level, gone, c)?.id;
  const next = pathAhead(level.size, c, d).find((i) => {
    const a = arrowAt(level, gone, i);
    return a && a.id !== here;
  });
  if (next !== undefined) return next;
  const row = Math.max(0, Math.min(level.size - 1, Math.floor(c / level.size) + DR[d]));
  const col = Math.max(0, Math.min(level.size - 1, (c % level.size) + DC[d]));
  return row * level.size + col;
}
/** Moves the keyboard cursor from the top-left cell to `cell` (the shortest run of arrow keys). */
function cursorTo(level: Level, cell: number): void {
  const names = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  const goal = new Set(arrowAt(level, new Set(), cell)?.cells ?? [cell]);
  const prev = new Map<number, [number, number]>([[0, [-1, -1]]]);
  const queue = [0];
  let end = goal.has(0) ? 0 : -1;
  while (queue.length && end < 0) {
    const c = queue.shift()!;
    for (const d of [0, 1, 2, 3] as const) {
      const n = jump(level, new Set(), c, d);
      if (!prev.has(n)) {
        prev.set(n, [c, d]);
        queue.push(n);
        if (goal.has(n) && end < 0) end = n;
      }
    }
  }
  const keys: string[] = [];
  for (let c = end; c !== 0; c = prev.get(c)![0]) keys.unshift(names[prev.get(c)![1]]!);
  for (const k of keys) key(window, k);
}
const chal = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'abc', round: 1, seed: 4242, mode: 'fresh', day: '2026-10-19', ...over });

function playDaily(report = vi.fn()) {
  const view = render(
    <>
      <input aria-label="Search" />
      <div role="dialog">
        <textarea aria-label="Feedback" />
      </div>
      <OuttaHere host={{ report }} restartKey={0} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play today’s levels' }));
  return { view, report };
}

describe('Outta Here keyboard', () => {
  it('leaves typing in the page’s fields and dialogs alone (OH-05)', () => {
    playDaily();
    const level = todays();
    cursorTo(level, level.arrows[stuck(level)]!.cells[0]!);
    const search = screen.getByLabelText('Search');
    const feedback = screen.getByLabelText('Feedback');
    search.focus();
    expect(key(search, ' ')).toBe(true);
    expect(key(search, 'Enter')).toBe(true);
    expect(key(search, 'ArrowLeft')).toBe(true);
    expect(key(feedback, ' ')).toBe(true);
    // Modifier combos are the browser's.
    expect(key(window, 'Enter', { ctrlKey: true })).toBe(true);
    expect(hearts()).toBe('3 hearts left');
    // The game's own keys still work.
    expect(key(window, 'Enter')).toBe(false);
    expect(hearts()).toBe('2 hearts left');
  });

  it('does not take the focus from a field when the run ends (OH-05)', () => {
    playDaily();
    const level = todays();
    const k = stuck(level);
    const search = screen.getByLabelText('Search');
    search.focus();
    for (let i = 0; i < 3; i++) {
      tap(k);
      wait(700);
    }
    expect(screen.getByText('Out of hearts')).toBeTruthy();
    expect(document.activeElement).toBe(search);
  });

  it('focuses the end screen’s button when the focus was in the game', () => {
    playDaily();
    const k = stuck(todays());
    for (let i = 0; i < 3; i++) {
      tap(k);
      wait(700);
    }
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Play endless' }));
  });

  it('Enter on a focused HUD button presses the button (OH-06)', () => {
    playDaily();
    const level = todays();
    cursorTo(level, level.arrows[stuck(level)]!.cells[0]!);
    const menu = screen.getByRole('button', { name: 'Menu' });
    menu.focus();
    expect(key(menu, 'Enter')).toBe(true);
    expect(key(menu, ' ')).toBe(true);
    expect(hearts()).toBe('3 hearts left');
  });

  it('a held Enter sends once (OH-07)', () => {
    playDaily();
    const level = todays();
    cursorTo(level, level.arrows[stuck(level)]!.cells[0]!);
    key(window, 'Enter');
    wait(700);
    key(window, 'Enter', { repeat: true });
    key(window, 'Enter', { repeat: true });
    expect(hearts()).toBe('2 hearts left');
  });

  it('the first Enter shows the cursor instead of sending a hidden one (OH-08)', () => {
    playDaily();
    const level = todays();
    expect(document.querySelector('.oh-cursor')).toBeNull();
    key(window, 'Enter');
    expect(document.querySelector('.oh-cursor')).not.toBeNull();
    expect(screen.getByRole('grid', { name: `Level 1: ${level.arrows.length} arrows left` })).toBeTruthy();
  });

  it('draws the cursor over the arrows and marks the arrow under it (OH-09)', () => {
    playDaily();
    const level = todays();
    const a = level.arrows[0]!;
    cursorTo(level, a.cells[0]!);
    const svg = screen.getByRole('grid');
    expect(svg.lastElementChild?.classList.contains('oh-cursor')).toBe(true);
    expect(document.querySelectorAll('g.oh-arrow')[a.id]!.classList.contains('is-target')).toBe(true);
  });
});

describe('Outta Here taps', () => {
  it('a double tap on a blocked arrow costs one heart (OH-10)', () => {
    playDaily();
    const k = stuck(todays());
    tap(k);
    tap(k);
    expect(hearts()).toBe('2 hearts left');
    wait(700);
    tap(k);
    expect(hearts()).toBe('1 heart left');
  });
});

describe('Outta Here daily', () => {
  it('picking the daily up again from the menu keeps the arcade’s start (OH-01)', () => {
    const { report } = playDaily();
    const level = todays();
    const free = level.arrows.findIndex((a) => canLeave(level, new Set(), a));
    tap(free);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue today’s levels' }));
    tap(stuck(level));
    expect(report.mock.calls.filter(([e]) => e.type === 'start')).toHaveLength(1);
  });

  it('a tab that is behind leaves the daily another tab moved on', () => {
    playDaily();
    const level = todays();
    const save = JSON.parse(localStorage.getItem(KEY)!);
    tap(stuck(level));
    // The other tab finishes the daily.
    localStorage.setItem(KEY, JSON.stringify({ ...save, daily: { [dayKey()]: { best: 900, tries: 1, line: '💨💨💨💨💨' } }, progress: undefined }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText('Today: 900')).toBeTruthy();
    // and this tab doesn't write its stale round back
    expect(JSON.parse(localStorage.getItem(KEY)!).progress).toBeUndefined();
  });
});

describe('Outta Here challenge rounds', () => {
  it('a first-time player gets the walkthrough first, and no menu drops the round (OH-14)', () => {
    localStorage.clear();
    const { report } = host();
    render(<OuttaHere host={{ report }} restartKey={0} challenge={chal()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it('a reload carries on where the round was; a finished round shows its result and is never replayed', () => {
    const spec = chal();
    const level = makeLevel(spec.seed, 1);
    const first = host();
    const a = render(<OuttaHere host={first} restartKey={0} challenge={spec} />);
    tap(stuck(level));
    a.unmount();

    const second = host();
    const b = render(<OuttaHere host={second} restartKey={0} challenge={spec} />);
    expect(hearts()).toBe('2 hearts left');
    for (let i = 0; i < 2; i++) {
      wait(700);
      tap(stuck(level));
    }
    expect(second.report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { levels: 0, perfect: 0 }, challenge: { id: 'abc', round: 1 } });
    b.unmount();

    const third = host();
    render(<OuttaHere host={third} restartKey={0} challenge={spec} />);
    expect(screen.getByText('This round is already played.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the scoreboard' })).toBeTruthy();
    expect(third.report).not.toHaveBeenCalled();
  });

  it('a “Today’s daily” challenge plays the day’s own daily', () => {
    const day = dayKey();
    const level = makeLevel(hashString(`outta-here:${day}`), 1);
    const { report } = host();
    render(<OuttaHere host={{ report }} restartKey={0} challenge={chal({ mode: 'daily', day, seed: 1 })} />);
    expect(screen.getByRole('grid', { name: `Level 1: ${level.arrows.length} arrows left` })).toBeTruthy();
    expect(screen.getByText(/Level 1\/5/)).toBeTruthy();
    tap(stuck(level));
    // That tap used the day's one try: the game's own daily carries on from it.
    expect(JSON.parse(localStorage.getItem(KEY)!).daily[day]).toMatchObject({ open: true });
  });

  it('a daily already played counts as the challenge score, reported once', () => {
    const day = dayKey();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { best: 1234, tries: 1, line: '💨💨🟡💨💨' } } }));
    const spec = chal({ mode: 'daily', day });
    const first = host();
    const a = render(<OuttaHere host={first} restartKey={0} challenge={spec} />);
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(first.report).toHaveBeenCalledTimes(1);
    expect(first.report).toHaveBeenCalledWith({ type: 'end', score: 1234, stats: { levels: 5, perfect: 4 }, challenge: { id: 'abc', round: 1 } });
    a.unmount();
    const second = host();
    render(<OuttaHere host={second} restartKey={0} challenge={spec} />);
    expect(document.querySelector('.oh-big')?.textContent).toBe('1234');
    expect(second.report).not.toHaveBeenCalled();
  });
});

describe('Outta Here challenge length', () => {
  it('a challenge round is 8 levels with no heart back, then All clear!', () => {
    const spec = chal({ seed: 777 });
    const { report } = host();
    render(<OuttaHere host={{ report }} restartKey={0} challenge={spec} />);
    for (let n = 1; n <= 8; n++) {
      const level = makeLevel(spec.seed, n);
      // one mistake on level 1, flawless after that
      if (n === 1) {
        tap(stuck(level));
        wait(700);
      }
      const gone = new Set<number>();
      while (gone.size < level.arrows.length) {
        const a = level.arrows.find((x) => !gone.has(x.id) && canLeave(level, gone, x))!;
        tap(a.id);
        gone.add(a.id);
      }
      if (n < 8) {
        expect(screen.getByText(new RegExp(`Level ${n}/8`))).toBeTruthy();
        expect(hearts()).toBe('2 hearts left');
        wait(1500);
      }
    }
    expect(screen.getByRole('heading', { name: 'All clear!' })).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'end', stats: { levels: 8, perfect: 7 }, challenge: { id: 'abc', round: 1 } }));
  });
});

describe('Outta Here blocked taps', () => {
  it('marks the arrow in the way and draws the blocked path', () => {
    playDaily();
    const level = todays();
    const k = stuck(level);
    tap(k);
    const blockers = document.querySelectorAll('g.oh-arrow.is-blocker');
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).not.toBe(document.querySelectorAll('g.oh-arrow')[k]);
    expect(document.querySelector('.oh-block-path')).not.toBeNull();
    wait(700);
    expect(document.querySelector('g.oh-arrow.is-blocker')).toBeNull();
  });
});

describe('Outta Here keyboard cursor', () => {
  it('arrow keys jump to the next arrow that way, and the cursor keeps its place on the next level', () => {
    const spec = chal({ seed: 99 });
    render(<OuttaHere host={host()} restartKey={0} challenge={spec} />);
    const level = makeLevel(spec.seed, 1);
    const at = (): [number, number] => {
      const r = document.querySelector('.oh-cursor rect')!;
      return [Number(r.getAttribute('y')) / 10, Number(r.getAttribute('x')) / 10];
    };
    key(window, 'ArrowRight');
    const [row, col] = at();
    expect(jump(level, new Set(), 0, 1)).toBe(row * level.size + col);
    const gone = new Set<number>();
    while (gone.size < level.arrows.length) {
      const a = level.arrows.find((x) => !gone.has(x.id) && canLeave(level, gone, x))!;
      tap(a.id);
      gone.add(a.id);
    }
    wait(1500);
    expect(at()).toEqual([row, col]);
  });
});
