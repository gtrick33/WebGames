import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/wing-it/Game';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey } from '../src/platform/dates';

const KEY = 'glitchbound.wing-it';
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

/** Drives the game loop by hand: animation frames and performance.now() advance only when asked. */
function clock() {
  let t = 1000;
  let id = 0;
  const q = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => t);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (q.set(++id, cb), id));
  vi.stubGlobal('cancelAnimationFrame', (n: number) => q.delete(n));
  return {
    /** Runs frames 50 ms apart for `ms`, or until `until()` holds. */
    run(ms: number, until?: () => boolean) {
      for (const end = t + ms; t < end && !until?.(); ) {
        t += 50;
        const now = [...q.values()];
        q.clear();
        act(() => now.forEach((cb) => cb(t)));
      }
    },
    wait(ms: number) {
      t += ms;
    },
    pending: () => q.size,
  };
}
const takeOff = () => fireEvent.pointerDown(screen.getByLabelText(/Tap or press Space to flap/), { button: 0 });
const crashed = () => !!screen.queryByText(/Bonk!/);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Wing It: the daily course is three flights a day, best counts', () => {
  it('backing out before the first flap keeps the flight; the first flap uses one up', () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    // Still there: nothing was flown.
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    expect(report).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByLabelText(/Tap or press Space to flap/), { button: 0 });
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    unmount();

    // Leaving mid-flight counts: the flight ends once (the day still counts for the streak), the menu
    // says it was left unfinished and offers the two flights that are left.
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true });
    render(<Game host={{ report }} restartKey={1} />);
    expect(screen.queryByRole('button', { name: 'Fly today’s course' })).toBeNull();
    expect(screen.getByText(/Last flight left unfinished/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fly again (2 flights left)' })).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('a flight left by a reload (no goodbye) is settled once when the game opens again', () => {
    localStorage.setItem('glitchbound.wing-it', JSON.stringify({ daily: { [dayKey()]: { best: 0, tries: 1, pillars: 0, feathers: 0, open: true } } }));
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true });
    unmount();
    render(<Game host={{ report }} restartKey={1} />);
    expect(report).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Last flight left unfinished/)).toBeTruthy();
  });

  it('keeps the best flight when a later one is left, and closes the course after the third', () => {
    const day = dayKey();
    localStorage.setItem('glitchbound.wing-it', JSON.stringify({ daily: { [day]: { best: 12, tries: 2, pillars: 3, feathers: 1, open: true } } }));
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    // The abandoned second flight reports its own 0; the day keeps the 12.
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true });
    expect(screen.getByText(/Today: 12 · 1 flight left/)).toBeTruthy();
    unmount();

    localStorage.setItem('glitchbound.wing-it', JSON.stringify({ daily: { [day]: { best: 12, tries: 3, pillars: 3, feathers: 1 } } }));
    render(<Game host={{ report }} restartKey={1} />);
    expect(screen.queryByRole('button', { name: /Fly again|Fly today’s course/ })).toBeNull();
    expect(screen.getByText(/Next daily in/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });
});

describe('Wing It: flights', () => {
  it('ignores taps on the result for a moment after a crash, then stops drawing once the bird has landed', () => {
    const c = clock();
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    takeOff();
    c.run(5000, crashed);
    expect(crashed()).toBe(true);
    expect(screen.getByText(/^0 gaps ·/)).toBeTruthy();
    // A tap still meant for the bird lands on Fly again: nothing happens yet.
    fireEvent.click(screen.getByRole('button', { name: 'Fly again' }));
    expect(crashed()).toBe(true);
    // The bird lands and the loop stops on a still frame.
    c.run(3000);
    expect(c.pending()).toBe(0);
    c.wait(800);
    fireEvent.click(screen.getByRole('button', { name: 'Fly again' }));
    expect(crashed()).toBe(false);
    expect(screen.getByText(/Daily course #/)).toBeTruthy();
    expect(stored().daily[dayKey()].tries).toBe(1);
  });

  it('pauses when the tab is hidden mid-flight, keeps the corner buttons above the pause, and draws nothing while paused', () => {
    const c = clock();
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly endless' }));
    takeOff();
    c.run(100);
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    hidden = false;
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    c.run(200);
    expect(c.pending()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    expect(c.pending()).toBe(1);
  });

  it('a second tab’s flights are kept: every write merges into the stored save', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    // Meanwhile another tab flew twice and set a best.
    localStorage.setItem(KEY, JSON.stringify({ best: 30, daily: { [dayKey()]: { best: 30, tries: 2, pillars: 9, feathers: 7 } } }));
    takeOff();
    expect(stored().best).toBe(30);
    expect(stored().daily[dayKey()]).toMatchObject({ best: 30, tries: 3, open: true });
  });

  it('typing in a field outside the game never flaps', () => {
    const report = vi.fn();
    const input = document.body.appendChild(document.createElement('input'));
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly endless' }));
    fireEvent.keyDown(input, { key: ' ' });
    expect(report).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    input.remove();
  });
});

describe('Wing It: friends’ challenge rounds are one flight', () => {
  const ch: ChallengeSpec = { id: 'wi1', round: 2, seed: 99, mode: 'fresh', day: '' };
  const chEnd = (score: number, pillars = 0, feathers = 0) => ({ type: 'end', score, stats: { pillars, feathers }, challenge: { id: 'wi1', round: 2 } });

  it('has no way back to the game menu before take-off; leaving mid-air ends it once and it never replays', () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={ch} />);
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    takeOff();
    unmount();
    expect(report).toHaveBeenLastCalledWith(chEnd(0));
    render(<Game host={{ report }} restartKey={1} challenge={ch} />);
    expect(screen.getByRole('link', { name: 'See the scoreboard' })).toBeTruthy();
    expect(screen.queryByText(/Tap or press Space to flap/)).toBeNull();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('a round started before a reload ends at once, reported once', () => {
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'wi1:2': { points: 0, pillars: 0, feathers: 0, open: true } } }));
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={ch} />);
    expect(report).toHaveBeenCalledWith(chEnd(0));
    expect(screen.getByText(/This round was already started/)).toBeTruthy();
    unmount();
    render(<Game host={{ report }} restartKey={1} challenge={ch} />);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('shows a finished round’s result (1 gap, singular) without reporting it again', () => {
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'wi1:2': { points: 4, pillars: 1, feathers: 1 } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={ch} />);
    expect(report).not.toHaveBeenCalled();
    expect(screen.getByText(/^1 gap · 1 feather/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '1 gap' })).toBeTruthy();
  });

  it('“Today’s daily” counts as one of that day’s flights, and a finished daily counts as the round', () => {
    const day = dayKey();
    const daily: ChallengeSpec = { ...ch, mode: 'daily', day };
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={daily} />);
    expect(screen.getByText(/one flight/)).toBeTruthy();
    takeOff();
    expect(stored().daily[day].tries).toBe(1);
    unmount();

    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { best: 19, tries: 3, pillars: 13, feathers: 2 } } }));
    report.mockClear();
    render(<Game host={{ report }} restartKey={1} challenge={{ ...daily, round: 3 }} />);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 19, stats: { pillars: 13, feathers: 2 }, challenge: { id: 'wi1', round: 3 } });
    expect(screen.getByText(/your best that day counts here/)).toBeTruthy();
  });
});
