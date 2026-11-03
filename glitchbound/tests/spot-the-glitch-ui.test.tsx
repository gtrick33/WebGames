import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/spot-the-glitch/Game';
import { makePuzzle } from '../src/games/spot-the-glitch/diffs';
import { challengeGen, dailyPuzzle } from '../src/games/spot-the-glitch/logic';
import { emptySgSave, loadSg, STORE_KEY } from '../src/games/spot-the-glitch/store';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey, hashString } from '../src/platform/dates';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // Every picture is 400 css px wide at the page's top left: scene units are css pixels.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const host = () => ({ report: vi.fn() });
const tapAt = (x: number, y: number) => {
  const pic = screen.getAllByRole('img')[1]!;
  fireEvent.pointerDown(pic, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(pic, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
};
const ends = (h: ReturnType<typeof host>) => h.report.mock.calls.map((c) => c[0]).filter((e) => e.type === 'end');
const giveUpPicture = () => {
  fireEvent.click(screen.getByText('Give up'));
  fireEvent.click(screen.getByText('Yes, reveal'));
};

describe('Spot the Glitch challenge rounds', () => {
  const spec: ChallengeSpec = { id: 'chal1', round: 2, seed: 4242, mode: 'fresh', day: '2026-12-10' };

  it('resumes a round left halfway, has no way out of it, and never replays a finished one', () => {
    const p = makePuzzle(hashString(`spot-the-glitch:challenge:${spec.seed}:0`), 0, undefined, challengeGen(spec.day));
    const h1 = host();
    const first = render(<Game restartKey={0} host={h1} challenge={spec} />);
    expect(screen.queryByLabelText('Back to menu')).toBeNull();
    const s = p.diffs[0]!.spots[0]!;
    tapAt(s.x, s.y);
    expect(screen.getByLabelText('1 of 5 glitches found')).toBeTruthy();
    first.unmount();

    // A reload picks the same picture up again with the find kept.
    const h2 = host();
    render(<Game restartKey={0} host={h2} challenge={spec} />);
    expect(screen.getByLabelText('1 of 5 glitches found')).toBeTruthy();
    giveUpPicture();
    fireEvent.click(screen.getByText('Next picture →'));
    giveUpPicture();
    fireEvent.click(screen.getByText('Next picture →'));
    giveUpPicture();
    fireEvent.click(screen.getByText('See results'));
    expect(screen.getByText('⚔️ Challenge round complete')).toBeTruthy();
    expect(ends(h2)).toEqual([{ type: 'end', score: 100, stats: { found: 1, clean: 0 }, challenge: { id: 'chal1', round: 2 } }]);
    cleanup();

    // Opening the round again shows its result: no replay, and no second end report.
    const h3 = host();
    render(<Game restartKey={0} host={h3} challenge={spec} />);
    expect(screen.getByText('⚔️ Challenge round complete')).toBeTruthy();
    expect(screen.queryByText('Give up')).toBeNull();
    expect(ends(h3)).toEqual([]);
  });

  it('plays the real daily for a daily challenge, and counts an already played daily at once', () => {
    const day = '2026-12-09';
    const daily: ChallengeSpec = { id: 'chal2', round: 1, seed: 1, mode: 'daily', day };
    // Not played yet: the round is the daily's first picture, and finding in it counts for the daily too.
    const p = dailyPuzzle(day, 0);
    render(<Game restartKey={0} host={host()} challenge={daily} />);
    const s = p.diffs[0]!.spots[0]!;
    tapAt(s.x, s.y);
    expect(screen.getByLabelText('1 of 5 glitches found')).toBeTruthy();
    expect(loadSg().progress).toMatchObject({ day, index: 0, found: [0] });
    cleanup();

    const r = { score: 800, found: 5, misses: 1, hints: 0, seconds: 30 };
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...emptySgSave(), daily: { [day]: [r, r, r] } }));
    const h = host();
    render(<Game restartKey={0} host={h} challenge={daily} />);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(ends(h)).toEqual([{ type: 'end', score: 2400, stats: { found: 15, clean: 0 }, challenge: { id: 'chal2', round: 1 } }]);
  });
});

describe('Spot the Glitch play', () => {
  it('covers the pictures while paused and ignores Hint and Give up there', () => {
    const h = host();
    const view = render(<Game restartKey={0} host={h} pauseKey={0} />);
    fireEvent.click(screen.getByText('Play today’s pictures'));
    view.rerender(<Game restartKey={0} host={h} pauseKey={1} />);
    expect(screen.getByText('Paused')).toBeTruthy();
    const hint = screen.getByText(/Hint/).closest('button')!;
    expect(hint.disabled).toBe(true);
    fireEvent.click(screen.getByText('Tap to continue'));
    expect(screen.queryByText('Paused')).toBeNull();
    // The pause button pauses too.
    fireEvent.click(screen.getByLabelText('Pause'));
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('charges Rush hints in time, says "Run ended" for an ended run and reports the Rush score apart', () => {
    vi.useFakeTimers();
    try {
      const h = host();
      render(<Game restartKey={0} host={h} />);
      fireEvent.click(screen.getByText('Start Rush'));
      expect(screen.getByLabelText('Time').textContent).toBe('60s');
      fireEvent.click(screen.getByText('💡 Hint (−5s)'));
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByLabelText('Time').textContent).toBe('55s');
      fireEvent.click(screen.getByText('End run'));
      fireEvent.click(screen.getByText('Yes, reveal'));
      expect(screen.getByText('Run ended')).toBeTruthy();
      expect(ends(h)).toEqual([{ type: 'end', score: 0, stats: { found: 0, pictures: 0, rush: 0 } }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a finished daily with its total as the daily stat', () => {
    const r = { score: 900, found: 5, misses: 0, hints: 0, seconds: 25 };
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...emptySgSave(), daily: { [dayKey()]: [r, r] } }));
    const h = host();
    render(<Game restartKey={0} host={h} />);
    fireEvent.click(screen.getByText('Resume (2/3)'));
    giveUpPicture();
    expect(ends(h)).toEqual([{ type: 'end', score: 1800, stats: { found: 10, clean: 2, daily: 1800 }, daily: true }]);
  });
});
