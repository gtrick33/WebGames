import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/square-deal/Game';
import { newGame, pieceAt, toSaved } from '../src/games/square-deal/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey, hashString } from '../src/platform/dates';

const KEY = 'glitchbound.square-deal';
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const score = () => document.querySelector('.sd-score b')!.textContent;
const pieceLabel = (seed: number, n: number) => {
  const p = pieceAt(seed, n);
  return `Piece ${(n % 3) + 1}: ${p.cells.length} squares, ${p.w} wide, ${p.h} tall`;
};
/** Picks piece 1 with the key and places it at the cursor (the board's middle, empty at the start). */
const placeFirst = () => {
  fireEvent.keyDown(document.body, { key: '1' });
  fireEvent.keyDown(document.body, { key: 'Enter' });
};
const spec = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'abc', round: 1, seed: 777, mode: 'fresh', day: dayKey(), ...over });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Square Deal UI', () => {
  it('keeps an endless game through the menu and offers to continue it', () => {
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    placeFirst();
    const after = score();
    expect(Number(after)).toBeGreaterThan(0);
    expect(stored().endless.score).toBe(Number(after));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText(`In progress · ${after} so far`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue endless' }));
    expect(score()).toBe(after);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(score()).toBe('0');
    expect(stored().endless).toBeUndefined();
  });

  it('asks before leaving a challenge round, and resumes it after a reload', () => {
    const report = vi.fn();
    const ch = spec();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={ch} />);
    placeFirst();
    const after = score();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('dialog', { name: 'Leave the challenge?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(score()).toBe(after);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the challenge' }));
    expect(score()).toBe(after);
    unmount();
    render(<Game host={{ report }} restartKey={0} challenge={ch} />);
    expect(score()).toBe(after);
    expect(report.mock.calls.filter(([e]) => e.type === 'end')).toHaveLength(0);
  });

  it('shows a finished challenge round as its result and never reports it again', () => {
    const report = vi.fn();
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'abc:1': { day: dayKey(), result: { score: 321, lines: 4, streak: 2 } } } }));
    render(<Game host={{ report }} restartKey={0} challenge={spec()} />);
    expect(document.querySelector('.sd-big')!.textContent).toBe('321');
    expect(screen.getAllByText(/best streak 2 \(×1\.5\)/).length).toBeGreaterThan(0);
    expect(report).not.toHaveBeenCalled();
  });

  it("plays today's daily challenge on the daily's own pieces", () => {
    const day = dayKey();
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={spec({ mode: 'daily', day })} />);
    const seed = hashString(`square-deal:${day}`);
    expect(screen.getByRole('button', { name: pieceLabel(seed, 0) })).toBeTruthy();
    placeFirst();
    // Its first move uses the daily's one try, and the daily resumes from the same round.
    expect(stored().daily[day].open).toBe(true);
    expect(stored().progress.day).toBe(day);
  });

  it("counts an already played daily as the daily challenge's score, once", () => {
    const day = dayKey();
    const report = vi.fn();
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { best: 250, tries: 1, lines: 3, streak: 1 } } }));
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day })} />);
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 250, stats: { lines: 3, streak: 1 }, challenge: { id: 'abc', round: 1 } });
    unmount();
    render(<Game host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day })} />);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('selects a piece by click (keyboard, screen reader) and exposes the board cells', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getByRole('gridcell', { name: 'Row 3, column 5, empty' })).toBeTruthy();
    const piece = screen.getAllByRole('button', { name: /^Piece 1/ })[0]!;
    fireEvent.click(piece);
    expect(piece.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement?.getAttribute('role')).toBe('gridcell');
    expect(screen.getByText('Arrows aim · Enter places · Esc drops it')).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(Number(score())).toBeGreaterThan(0);
  });

  it('leaves keys typed into a field outside the game alone', () => {
    render(
      <>
        <input aria-label="Search" />
        <Game host={{ report: vi.fn() }} restartKey={0} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play endless' }));
    const input = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.querySelector('.sd-slot.is-selected')).toBeNull();
    expect(score()).toBe('0');
    fireEvent.keyDown(document.body, { key: '2', ctrlKey: true });
    expect(document.querySelector('.sd-slot.is-selected')).toBeNull();
  });

  it('leaves a daily that another tab finished', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s deal' }));
    const day = dayKey();
    const s = stored();
    localStorage.setItem(KEY, JSON.stringify({ ...s, daily: { [day]: { best: 99, tries: 1, lines: 1, streak: 1 } }, progress: undefined }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText('Today: 99')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play today’s deal' })).toBeNull();
  });

  it('survives a damaged save, and drops damaged rounds from it', () => {
    localStorage.setItem(KEY, JSON.stringify({ best: -5, endless: { seed: 'x' }, challenges: { 'abc:1': { day: 'nope' }, 'abc:2': { day: dayKey(), game: { ...toSaved(newGame(1)), board: [1] } } } }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={spec({ round: 2 })} />);
    expect(score()).toBe('0');
    localStorage.setItem(KEY, '{not json');
    render(<Game host={{ report: vi.fn() }} restartKey={1} />);
    expect(screen.getAllByRole('button', { name: 'Play endless' }).length).toBeGreaterThan(0);
  });
});
