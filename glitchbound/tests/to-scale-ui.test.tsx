import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToScale from '../src/games/to-scale/Game';
import type { ChallengeSpec } from '../src/platform/challenge';

const KEY = 'glitchbound.to-scale';
let now = 1000;
beforeEach(() => {
  localStorage.clear();
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fresh: ChallengeSpec = { id: 'abc', round: 1, seed: 2171579901, mode: 'fresh', day: '2026-10-30' };
const stored = (): { challenges: Record<string, { played: unknown[]; done: boolean }>; daily: Record<string, { best: number; open?: boolean }> } => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const lockAndGoOn = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Lock it in/ }));
  now += 1000;
  fireEvent.click(screen.getByRole('button', { name: /Next shot|See your score/ }));
};

describe('To Scale UI', () => {
  it('a double tap on “Lock it in” keeps the reveal on screen (TS-03)', () => {
    render(<ToScale host={{ report: vi.fn() }} restartKey={0} challenge={fresh} />);
    fireEvent.click(screen.getByRole('button', { name: /Lock it in/ }));
    now += 90;
    fireEvent.click(screen.getByRole('button', { name: 'Next shot' }));
    expect(screen.getByText(/Real size:/)).toBeTruthy();
    now += 600;
    fireEvent.click(screen.getByRole('button', { name: 'Next shot' }));
    expect(screen.queryByText(/Real size:/)).toBeNull();
  });

  it('the slider reads as a size, and the reveal says which dimension (TS-07, TS-01)', () => {
    render(<ToScale host={{ report: vi.fn() }} restartKey={0} challenge={fresh} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toMatch(/^(1\/)?[\d.]+×?( of)? the /);
    fireEvent.click(screen.getByRole('button', { name: /Lock it in/ }));
    expect(screen.getByText(/Real size:/).textContent).toMatch(/ (long|tall|wide|across)[,.]/);
  });

  it('a challenge round picks up where it was and is never replayed', () => {
    const report = vi.fn();
    const view = render(<ToScale host={{ report }} restartKey={0} challenge={fresh} />);
    lockAndGoOn();
    lockAndGoOn();
    expect(stored().challenges['abc:1']).toMatchObject({ done: false });
    expect(stored().challenges['abc:1']!.played).toHaveLength(2);
    view.unmount();
    render(<ToScale host={{ report }} restartKey={1} challenge={fresh} />);
    // Shots 1 and 2 are kept: three to go.
    expect(document.querySelectorAll('.ts-dots i[class^="is-"]:not(.is-now)')).toHaveLength(2);
    for (let i = 0; i < 3; i++) lockAndGoOn();
    expect(screen.getByText('See the scoreboard')).toBeTruthy();
    cleanup();
    render(<ToScale host={{ report }} restartKey={2} challenge={fresh} />);
    expect(screen.getByText('See the scoreboard')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lock it in/ })).toBeNull();
    expect(report.mock.calls.filter(([e]) => e.type === 'end')).toHaveLength(1);
  });

  it('a daily challenge for a day already played counts that daily’s result', () => {
    localStorage.setItem(KEY, JSON.stringify({ best: 4100, runs: 1, daily: { '2026-10-30': { best: 4100, tries: 1, line: '🎯🎯🟩🟩🟨' } } }));
    const report = vi.fn();
    render(<ToScale host={{ report }} restartKey={0} challenge={{ ...fresh, mode: 'daily', seed: 1, day: '2026-10-30' }} />);
    expect(screen.getByText(/Your daily result counts here/)).toBeTruthy();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ type: 'end', score: 4100, challenge: { id: 'abc', round: 1 } }));
    expect(screen.queryByRole('button', { name: /Lock it in/ })).toBeNull();
  });

  it('a daily challenge not played yet uses up that day’s daily too', () => {
    render(<ToScale host={{ report: vi.fn() }} restartKey={0} challenge={{ ...fresh, mode: 'daily', seed: 1, day: '2026-10-30' }} />);
    expect(stored().daily['2026-10-30']).toMatchObject({ open: true });
    for (let i = 0; i < 5; i++) lockAndGoOn();
    expect(stored().daily['2026-10-30']!.open).toBeUndefined();
  });

  it('keys typed outside the game, or in a dialog, are left alone', () => {
    render(<ToScale host={{ report: vi.fn() }} restartKey={0} challenge={fresh} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: ' ' });
    });
    expect(screen.queryByText(/Real size:/)).toBeNull();
    const before = screen.getByRole('slider').getAttribute('value');
    fireEvent.keyDown(window, { key: '+', shiftKey: true });
    const after = Number(screen.getByRole('slider').getAttribute('value'));
    // + is the small 3% step even with Shift held (TS-09).
    expect(after - Number(before)).toBeCloseTo(Math.log(1.03), 6);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText(/Real size:/)).toBeTruthy();
    input.remove();
  });

  it('another tab’s saves are merged, not overwritten', () => {
    render(<ToScale host={{ report: vi.fn() }} restartKey={0} />);
    // Another tab finishes a challenge round while this one sits on the menu.
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'zzz:1': { played: [], done: true, score: 10, line: '🟥' } } }));
    fireEvent.click(screen.getByRole('button', { name: /Sound/ }));
    expect(stored().challenges['zzz:1']).toMatchObject({ done: true });
  });
});
