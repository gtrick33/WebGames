import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/crosswire/Game';
import { makePuzzle, wordCells } from '../src/games/crosswire/grid';
import { allLetters, dailyPuzzle, deleteForward, key, nextOpenWord, score, scoreParts, typeLetter, type Entries } from '../src/games/crosswire/logic';
import { dayKey } from '../src/platform/dates';

const STORE = 'glitchbound.crosswire';

describe('Crosswire keyboard rules', () => {
  const p = makePuzzle(5, 'small', 1);
  const w = p.words[0]!;
  const cells = wordCells(w);
  it('typing the last letter of a word with a gap goes back to the gap', () => {
    const e: Entries = Object.fromEntries(cells.slice(1).map(([r, c], i) => [key(r, c), w.word[i + 1]!]));
    delete e[key(...cells[1]!)];
    e[key(...cells[0]!)] = w.word[0]!;
    const r = typeLetter(p, e, { word: 0, pos: cells.length - 1 }, w.word[cells.length - 1]!);
    expect(r.cursor).toEqual({ word: 0, pos: 1 });
  });
  it('Delete clears forward; Tab finds the next unfinished clue', () => {
    const e: Entries = Object.fromEntries(cells.map(([r, c], i) => [key(r, c), w.word[i]!]));
    const r = deleteForward(p, e, { word: 0, pos: 0 });
    expect(r.entries[key(...cells[0]!)]).toBeUndefined();
    expect(r.cursor).toEqual({ word: 0, pos: 1 });
    expect(nextOpenWord(p, e, -1, 1)).not.toBe(0);
    expect(nextOpenWord(p, {}, p.words.length - 1, 1)).toBe(-1);
  });
  it('breaks the score down into parts that add up', () => {
    for (const t of [
      { seconds: 60, checks: 0, letterHints: 0, wordHints: 0, mystery: false },
      { seconds: 360, checks: 2, letterHints: 2, wordHints: 1, mystery: true },
      { seconds: 99999, checks: 9, letterHints: 0, wordHints: 9, mystery: true },
    ]) {
      const s = scoreParts(t);
      expect(1000 - s.time - s.checks - s.hints + s.floor + s.mystery).toBe(score(t));
    }
    expect(score({ seconds: 99999, checks: 0, letterHints: 0, wordHints: 0, mystery: false })).toBe(100);
  });
  it('keeps grids reasonably full (fill floor for the generator)', () => {
    for (const size of ['small', 'medium'] as const) {
      const q = makePuzzle(11, size);
      const all = q.cells.flat();
      expect(all.filter((c) => c.kind === 'letter').length / all.length, size).toBeGreaterThan(0.45);
    }
  });
});

describe('Crosswire design', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('glitchbound.coach.crosswire', '1');
    vi.useFakeTimers({ now: new Date(2026, 9, 19, 12) });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the Word reveal asks once before it charges', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    fireEvent.click(screen.getByRole('button', { name: /Reveal the word/ }));
    expect(screen.getByRole('button', { name: /Sure\? Reveal the word/ })).toBeTruthy();
    expect(screen.getByText('0/' + allLetters(dailyPuzzle(dayKey())).length)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sure\? Reveal the word/ }));
    expect(screen.queryByText('0/' + allLetters(dailyPuzzle(dayKey())).length)).toBeNull();
  });

  it('All clues lists every clue and jumps to the one picked', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'All clues' }));
    const p = dailyPuzzle(dayKey());
    const sheet = screen.getByRole('dialog', { name: 'All clues' });
    expect(sheet.querySelectorAll('.xw-sheet-clue').length).toBe(p.words.length);
    const last = p.words[p.words.length - 1]!;
    fireEvent.click([...sheet.querySelectorAll('.xw-sheet-clue')].find((b) => b.textContent!.includes(last.clue))!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.xw-cluebar p')!.textContent).toContain(last.clue);
  });

  it('a first challenge round starts with the walkthrough, and the clock waits for it', async () => {
    localStorage.removeItem('glitchbound.coach.crosswire');
    render(<Game host={{ report: vi.fn() }} restartKey={0} challenge={{ id: 'x', round: 1, seed: 9, mode: 'fresh', day: '2026-10-19' }} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(screen.getByText('0:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText('0:02')).toBeTruthy();
  });

  it('the result shows the score breakdown', () => {
    const today = dayKey();
    const p = dailyPuzzle(today);
    const entries = Object.fromEntries(allLetters(p).map(([r, c, ch]) => [key(r, c), ch]));
    const tally = { seconds: 120, checks: 1, letterHints: 1, wordHints: 0, mystery: false };
    localStorage.setItem(STORE, JSON.stringify({ daily: { [today]: { entries, tally, done: true, score: score(tally) } }, solved: 1, best: 0 }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Review today’s grid/ }));
    expect(screen.getByLabelText('Score breakdown').textContent).toBe('1000 − 20 time − 10 checks − 30 hints');
  });
});
