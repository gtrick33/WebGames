import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Game from '../src/games/letter-pinch/Game';
import { dailySecret, practiceSecret, rng } from '../src/games/letter-pinch/logic';
import { emptyPinchSave, finishDaily, loadSave, sanitize, SAVE_KEY } from '../src/games/letter-pinch/storage';
import type { ChallengeSpec } from '../src/platform/challenge';
import type { GameEvent } from '../src/platform/contract';
import { dayKey } from '../src/platform/dates';

const fresh: ChallengeSpec = { id: 'abc123', round: 1, seed: 4242, mode: 'fresh', day: '' };
const freshSecret = practiceSecret(rng(fresh.seed ^ 0x9e3779b9));

function mount(props: { challenge?: ChallengeSpec; pauseKey?: number } = {}) {
  const events: GameEvent[] = [];
  const host = { report: (e: GameEvent) => events.push(e) };
  const view = render(<Game host={host} restartKey={0} {...props} />);
  return { events, view, host };
}

const press = (key: string, target: EventTarget = window): void => {
  fireEvent.keyDown(target, { key });
};
const typeWord = (word: string): void => {
  for (const ch of word) press(ch);
  press('Enter');
};
/** A valid guess that is not the secret. */
const wrong = (secret: string): string => (secret === 'crane' ? 'moist' : 'crane');
const stored = () => loadSave();

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Letter Pinch challenge rounds', () => {
  it('lays the banner out in its own row, under the header', () => {
    mount({ challenge: fresh });
    const banner = screen.getByText(/Challenge round: the same word for everyone/);
    expect(banner.parentElement!.className).toBe('lp-in');
    // The banner sits between the header and the board (the board keeps the flexible grid row).
    expect(banner.previousElementSibling!.tagName).toBe('HEADER');
    expect(banner.nextElementSibling!.className).toBe('lp-board');
  });

  it('resumes the same board after a reload instead of starting over', () => {
    const first = mount({ challenge: fresh });
    typeWord(wrong(freshSecret));
    expect(first.events.filter((e) => e.type === 'start')).toHaveLength(1);
    first.view.unmount();

    mount({ challenge: fresh });
    expect(document.querySelectorAll('.lp-row:not(.lp-example) .lp-tile.is-up, .lp-row .lp-tile.is-down, .lp-row .lp-tile.is-hit').length).toBe(5);
    expect(stored().challenges[`${fresh.id}:1`]!.guesses).toEqual([wrong(freshSecret)]);
  });

  it('a finished round shows its result on reload and reports its end exactly once', () => {
    const first = mount({ challenge: fresh });
    typeWord(freshSecret);
    const ends = first.events.filter((e) => e.type === 'end');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ challenge: { id: fresh.id, round: 1 } });
    first.view.unmount();

    const again = mount({ challenge: fresh });
    expect(again.events.filter((e) => e.type === 'end')).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Statistics' })).toBeTruthy();
    expect(screen.queryByText('Enter')).toBeNull(); // no keyboard: nothing to replay
  });

  it('hides the Daily and Practice tabs while the round is open', () => {
    mount({ challenge: fresh });
    expect(screen.getByRole('tab', { name: /Challenge/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: /Daily/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Practice/ })).toBeNull();
  });

  it("a Today's daily challenge plays the real daily, and a finished daily counts at once", () => {
    const day = dayKey();
    const daily: ChallengeSpec = { id: 'dly999', round: 1, seed: 1, mode: 'daily', day };
    const a = mount({ challenge: daily });
    typeWord(dailySecret(day));
    expect(stored().days[day]!.endedAt).toBeGreaterThan(0);
    expect(a.events.filter((e) => e.type === 'end')[0]).toMatchObject({ daily: true, challenge: { id: 'dly999' } });
    a.view.unmount();

    // Another group's challenge of the same daily: the result already counts, no replay.
    const b = mount({ challenge: { ...daily, id: 'dly000' } });
    expect(b.events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(b.events.some((e) => e.type === 'start')).toBe(false);
  });
});

describe('Letter Pinch saves', () => {
  it('a second, stale tab never wipes the daily another tab finished', () => {
    const day = dayKey();
    mount();
    // Tab 2 finishes today's daily meanwhile.
    const other = emptyPinchSave();
    other.days[day] = { guesses: [dailySecret(day)], startedAt: Date.now() - 5000, endedAt: Date.now(), activeMs: 5000 };
    finishDaily(other, day, true, 1);
    localStorage.setItem(SAVE_KEY, JSON.stringify(other));
    // Tab 1 toggles the sound (a write) before it hears about it.
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }));
    const s = stored();
    expect(s.days[day]!.endedAt).toBeGreaterThan(0);
    expect(s.stats).toMatchObject({ played: 1, streak: 1 });
    expect(s.muted).toBe(true);
  });

  it('follows another tab: a board it finished is shown as finished', () => {
    const day = dayKey();
    mount();
    const other = emptyPinchSave();
    other.days[day] = { guesses: [dailySecret(day)], startedAt: 1, endedAt: 2 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(other));
    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY })));
    expect(screen.getByRole('dialog', { name: 'Statistics' })).toBeTruthy();
  });

  it('keeps an open practice board through a reload', () => {
    const a = mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));
    const secret = stored().openPractice?.secret;
    typeWord('crane');
    a.view.unmount();
    const s = stored();
    expect(s.lastMode).toBe('practice');
    expect(s.openPractice?.guesses).toEqual(secret === 'crane' ? [] : ['crane']);
    mount();
    expect(screen.getByRole('tab', { name: 'Practice' }).getAttribute('aria-selected')).toBe('true');
  });

  it('clamps tampered numbers and survives garbage', () => {
    const s = sanitize({ v: 1, stats: { played: 1e15, wins: -3, dist: [1e12, 'x'] }, days: { '2026-10-20': { guesses: 'no' } }, challenges: { 'bad key!': {} } });
    expect(s.stats.played).toBe(999_999);
    expect(s.stats.wins).toBe(0);
    expect(s.stats.dist[0]).toBe(999_999);
    expect(s.days).toEqual({});
    expect(s.challenges).toEqual({});
    expect(sanitize('junk')).toEqual(emptyPinchSave());
  });

  it('an older daily finished late never rewinds the streak', () => {
    const s = emptyPinchSave();
    finishDaily(s, '2026-10-21', true, 3);
    finishDaily(s, '2026-10-22', true, 3);
    finishDaily(s, '2026-10-20', false, 6);
    expect(s.stats).toMatchObject({ streak: 2, played: 2, lastPlayed: '2026-10-22' });
  });
});

describe('Letter Pinch keys', () => {
  it('Enter after clicking a mode tab submits the guess', () => {
    mount();
    const tab = screen.getByRole('tab', { name: 'Practice' });
    // A click never moves focus to the tab (so it cannot take Enter back from the board).
    expect(fireEvent.mouseDown(tab)).toBe(false);
    fireEvent.click(tab);
    for (const ch of 'crane') press(ch, document.body);
    press('Enter', document.body);
    expect(document.querySelectorAll('.lp-tile.is-up, .lp-tile.is-down, .lp-tile.is-hit').length).toBe(5);
  });

  it('keys go to a page dialog, not the board behind it', () => {
    mount();
    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    document.body.append(sheet);
    for (const ch of 'grape') press(ch);
    expect(document.querySelectorAll('.lp-tile.is-typed').length).toBe(0);
    sheet.remove();
    press('g');
    expect(document.querySelectorAll('.lp-tile.is-typed').length).toBe(1);
  });

  it('the arcade pausing the game stops the clock and shows a Paused card', () => {
    const a = mount({ pauseKey: 0 });
    press('c');
    a.view.rerender(<Game host={a.host} restartKey={0} pauseKey={1} />);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
    press('r'); // blocked while paused
    expect(document.querySelectorAll('.lp-tile.is-typed').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull();
  });
});

describe('Letter Pinch at midnight', () => {
  afterEach(() => vi.useRealTimers());

  it('a daily started before midnight finishes as its own day, not as the new day’s daily', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 30));
    const day = dayKey();
    const a = mount();
    typeWord(wrong(dailySecret(day)));
    vi.setSystemTime(new Date(2026, 10, 21, 0, 0, 30));
    for (let i = 0; i < 5; i++) typeWord(wrong(dailySecret(day)));
    const end = a.events.find((e) => e.type === 'end');
    expect(end).toBeTruthy();
    expect(end).not.toHaveProperty('daily');
    expect(stored().days[day]!.endedAt).toBeGreaterThan(0);
    expect(stored().stats.lastPlayed).toBe(day);
  });
});
