import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/crater-crew/Game';
import { playTurn } from '../src/games/crater-crew/match';
import { botMove, resumeMatch, soloMatch } from '../src/games/crater-crew/solo';
import { TERRAIN_IDS } from '../src/games/crater-crew/terrains';
import { dayKey } from '../src/platform/dates';
import type { ChallengeSpec } from '../src/platform/challenge';

// The battle paints on canvases; jsdom has no 2D context, so it gets one that does nothing.
const noop = (): void => undefined;
const fakeCtx = new Proxy(
  {},
  {
    get: (_t, k) => {
      if (k === 'createImageData' || k === 'getImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return document.createElement('canvas');
      return noop;
    },
    set: () => true,
  },
);
const realGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx) as unknown as HTMLCanvasElement['getContext'];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = noop;
      disconnect = noop;
    },
  );
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', noop);
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.unstubAllGlobals();
});
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const KEY = 'glitchbound.crater-crew';
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const spec = (o: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'ch1', round: 1, seed: 1234, mode: 'fresh', day: '', ...o });

describe('Crater Crew: a challenge round is played once', () => {
  it('shows a finished round again instead of replaying it, and reports nothing more', () => {
    localStorage.setItem(KEY, JSON.stringify({ ch: { 'ch1:1': { day: '2026-11-01', done: { score: 420, won: true, dmg: 150, kills: 1, line: '🏆 💥💥💥💀', winner: 'You' } } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText('Victory!')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
    expect(report).not.toHaveBeenCalled();
  });

  it('picks a round up where it was after a reload, and ends a corrupted one at once', () => {
    const setup = { seed: 1234, terrain: TERRAIN_IDS[1234 % TERRAIN_IDS.length]!, foes: 2, level: 'normal', crewSize: 2, turnSecs: 30, name: 'You', char: 'frog' } as const;
    const m0 = soloMatch(setup);
    const m1 = m0.crews[m0.crewTurn]!.bot ? botMove(m0) : playTurn(m0, { walk: [], fire: null }).match;
    const saved = JSON.parse(JSON.stringify({ ...m1, last: null }));
    // the kept battle comes back as it was; anything else in its place is refused
    expect(resumeMatch(saved, m0)).toEqual({ ...m1, last: null });
    expect(resumeMatch({ ...saved, seed: 1 }, m0)).toBeNull();
    expect(resumeMatch({ ...saved, units: saved.units.map((u: object) => ({ ...u, x: 'far' })) }, m0)).toBeNull();
    expect(resumeMatch({ ...saved, crews: null }, m0)).toBeNull();
    expect(resumeMatch('nonsense', m0)).toBeNull();

    const report = vi.fn();
    localStorage.setItem(KEY, JSON.stringify({ ch: { 'ch1:1': { day: dayKey(), m: saved } } }));
    const first = render(<Game host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.queryByRole('dialog', { name: 'Result' })).toBeNull();
    expect(report).not.toHaveBeenCalled();
    first.unmount();
    // a corrupted battle in the save: the round ends with 0, reported once
    localStorage.setItem(KEY, JSON.stringify({ ch: { 'ch1:1': { day: dayKey(), m: { seed: 'x' } } } }));
    render(<Game host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText('This round was already started.')).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { damage: 0, kills: 0 }, challenge: { id: 'ch1', round: 1 } });
    expect(stored().ch['ch1:1'].done.score).toBe(0);
    cleanup();
    render(<Game host={{ report }} restartKey={0} challenge={spec()} />);
    expect(report).toHaveBeenCalledTimes(1);
  });
});

describe('Crater Crew: today’s daily challenge is the real daily', () => {
  it('counts a daily already played that day, once', () => {
    const day = '2026-11-01';
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { best: 310, tries: 2, line: '🏆 💥💥' } } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day, seed: 999 })} />);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 310, stats: { damage: 0, kills: 0 }, challenge: { id: 'ch1', round: 1 } });
    cleanup();
    render(<Game host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day, seed: 999 })} />);
    expect(report).toHaveBeenCalledTimes(1);
  });
});

describe('Crater Crew: saves and keys', () => {
  it('a write keeps what another tab saved meanwhile', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    localStorage.setItem(KEY, JSON.stringify({ runs: 5, wins: 3, best: 700 }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sound off' })[0]!);
    expect(stored()).toMatchObject({ runs: 5, wins: 3, best: 700, muted: true });
    // and the menu shows it once the other tab's write is announced
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText(/Battles 5 · Wins 3 · Best score 700/)).toBeTruthy();
  });

  it('keyboard players can use the pause sheet: Enter, Space and Tab reach its buttons', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the skirmish' }));
    // a battle key from the page still plays (and is taken)
    expect(fireEvent.keyDown(document.body, { key: 'ArrowLeft' })).toBe(false);
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    const sheet = screen.getByRole('dialog', { name: 'Paused' });
    const cont = screen.getByRole('button', { name: 'Continue' });
    // not swallowed by the battle: the browser presses the button or moves the focus
    expect(fireEvent.keyDown(cont, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(cont, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(cont, { key: 'Tab' })).toBe(true);
    expect(sheet.textContent).toContain('Quit to the menu');
    // Esc on the sheet closes it again
    act(() => {
      fireEvent.keyDown(cont, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull();
  });

  it('pauses when the tab is hidden', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the skirmish' }));
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vis.mockRestore();
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
  });

  it('hides the ways out of a challenge round in its pause sheet', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    act(() => {
      fireEvent.keyDown(document.body, { key: 'p' });
    });
    const sheet = screen.getByRole('dialog', { name: 'Paused' });
    expect(sheet.textContent).not.toContain('Quit to the menu');
    expect(sheet.textContent).not.toContain('Restart');
  });
});
