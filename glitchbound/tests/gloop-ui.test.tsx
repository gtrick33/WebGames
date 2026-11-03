import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Gloop from '../src/games/gloop/Game';
import { newSim, RADII, type Sim } from '../src/games/gloop/sim';
import { dayKey, hashString } from '../src/platform/dates';
import type { ChallengeSpec } from '../src/platform/challenge';

const KEY = 'glitchbound.gloop';
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const press = (key: string, extra: Record<string, unknown> = {}, target: EventTarget = window) =>
  act(() => {
    fireEvent.keyDown(target, { key, bubbles: true, ...extra });
  });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const types = (report: ReturnType<typeof vi.fn>) => report.mock.calls.map(([e]) => (e as { type: string }).type);
/** A started jar a moment from overflowing: one Drip resting high above the line, its clock nearly run out. */
const nearlyFull = (seed: number): Sim => {
  const s = newSim(seed);
  s.blobs.push({ id: 1, tier: 0, x: 100, y: 40, vx: 0, vy: 0, r: RADII[0]!, age: 5, high: 1.59, pop: 0 });
  s.nextId = 2;
  s.dealt = 1;
  s.started = true;
  s.score = 42;
  return JSON.parse(JSON.stringify(s)) as Sim;
};
const spec = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'abc', round: 1, seed: 777, mode: 'fresh', day: '2026-10-29', ...over });

describe('Gloop in the page', () => {
  it('reports the start again for a jar picked up after a reload (GL-03)', () => {
    const first = render(<Gloop host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill today’s jar' }));
    press(' ');
    wait(1000);
    first.unmount();
    const report = vi.fn();
    render(<Gloop host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Carry on with today’s jar' }));
    press(' '); // continue
    press(' '); // the first drop of this visit
    wait(600);
    press(' ');
    expect(types(report)).toEqual(['start']);
  });

  it('leaves typing in fields, dialogs and the page around the game alone (GL-04)', () => {
    const report = vi.fn();
    render(
      <>
        <input aria-label="name" />
        <div role="dialog">
          <button>ok</button>
        </div>
        <Gloop host={{ report }} restartKey={0} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    const field = screen.getByLabelText('name');
    for (const key of [' ', 'Enter', 'p', 'a', 'ArrowLeft']) press(key, {}, field);
    press(' ', {}, screen.getByRole('button', { name: 'ok' }));
    press(' ', { ctrlKey: true });
    expect(report).not.toHaveBeenCalled();
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    press(' ');
    expect(types(report)).toEqual(['start']);
  });

  it('turns the sound off and on from the top row during play', () => {
    render(<Gloop host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }));
    expect(stored().muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }));
    expect(stored().muted).toBe(false);
  });

  it('pauses on Shift+P and when the tab is hidden (GL-11, GL-14)', () => {
    render(<Gloop host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    press(' ');
    press('P', { shiftKey: true });
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    fireEvent.click(screen.getByText('Paused · tap to continue'));
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
  });
});

describe('Gloop challenge rounds: one attempt', () => {
  it('a Restart or reload carries on with the same jar, and a finished round only shows its result', () => {
    const first = render(<Gloop host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    press(' ');
    wait(1000);
    first.unmount();
    const rec = stored().challenges['abc:1'];
    expect(rec).toMatchObject({ open: true });
    expect(rec.sim.seed).toBe(777);
    expect(rec.sim.dealt).toBe(1);

    // Picked up again (paused), it overflows and ends once.
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), challenges: { 'abc:1': { ...rec, sim: nearlyFull(777) } } }));
    const report = vi.fn();
    const second = render(<Gloop host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    press(' ');
    wait(200);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 42, stats: { biggest: 1, merges: 0 }, challenge: { id: 'abc', round: 1 } });
    second.unmount();

    const again = vi.fn();
    render(<Gloop host={{ report: again }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the scoreboard' })).toBeTruthy();
    press(' ');
    wait(1000);
    expect(again).not.toHaveBeenCalled();
  });

  it('a started round whose jar was lost ends at once with the score it had, reported once', () => {
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'abc:1': { score: 31, biggest: 2, merges: 4, open: true } } }));
    const report = vi.fn();
    const first = render(<Gloop host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText(/This round was already started/)).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 31, stats: { biggest: 3, merges: 4 }, challenge: { id: 'abc', round: 1 } });
    first.unmount();
    const again = vi.fn();
    render(<Gloop host={{ report: again }} restartKey={0} challenge={spec()} />);
    expect(again).not.toHaveBeenCalled();
  });

  it('"Today’s daily" deals the day’s own jar and counts as that daily', () => {
    const today = dayKey();
    const report = vi.fn();
    render(<Gloop host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day: today, seed: 5 })} />);
    press(' ');
    const s = stored();
    expect(s.challenges['abc:1'].sim.seed).toBe(hashString(`gloop:${today}`));
    expect(s.progress.day).toBe(today);
    expect(s.daily[today]).toMatchObject({ open: true });
  });

  it('"Today’s daily" after the daily was played: the daily result counts at once', () => {
    const today = dayKey();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [today]: { best: 900, tries: 1, biggest: 6 } } }));
    const report = vi.fn();
    render(<Gloop host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day: today })} />);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 900, stats: { biggest: 7, merges: 0 }, challenge: { id: 'abc', round: 1 } });
  });
});

describe('Gloop saves across tabs and midnight', () => {
  it('a jar finished in another tab is left, and never reopened by this one', () => {
    const today = dayKey();
    render(<Gloop host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill today’s jar' }));
    press(' ');
    // The other tab finishes today's jar.
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), daily: { [today]: { best: 500, tries: 1, biggest: 4 } }, progress: undefined }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText('Today: 500')).toBeTruthy();
    wait(3000);
    expect(stored().daily[today]).toEqual({ best: 500, tries: 1, biggest: 4 });
    expect(stored().progress).toBeUndefined();
  });

  it('a daily started before midnight finishes as that day’s, and the menu moves on to the new jar', () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 50));
    const day = dayKey();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { best: 0, tries: 1, biggest: 0, open: true } }, progress: { day, sim: nearlyFull(1) } }));
    const report = vi.fn();
    render(<Gloop host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Carry on with today’s jar' }));
    vi.setSystemTime(new Date(2026, 10, 4, 0, 0, 5));
    press(' ');
    wait(200);
    expect(report.mock.calls.at(-1)![0]).toEqual({ type: 'end', score: 42, stats: { biggest: 1, merges: 0 } });
    expect(stored().daily[day]).toEqual({ best: 42, tries: 1, biggest: 0 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' }).at(-1)!);
    expect(screen.getByRole('button', { name: 'Fill today’s jar' })).toBeTruthy();
  });
});
