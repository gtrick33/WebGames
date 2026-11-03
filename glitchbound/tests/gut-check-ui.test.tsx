import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/gut-check/Game';
import { answerIsMore, chain } from '../src/games/gut-check/logic';
import { KEY, readSave } from '../src/games/gut-check/save';
import type { ChallengeSpec } from '../src/platform/challenge';
import type { GameEvent, GameHost } from '../src/platform/contract';
import { dayKey } from '../src/platform/dates';

function mount(challenge?: ChallengeSpec) {
  const events: GameEvent[] = [];
  const host = { report: (e: GameEvent) => events.push(e) } as unknown as GameHost;
  const view = render(<Game host={host} restartKey={0} challenge={challenge} />);
  return { events, view, remount: () => render(<Game host={host} restartKey={1} challenge={challenge} />) };
}
const press = (name: RegExp): void => void fireEvent.click(screen.getByRole('button', { name }));
// The two call buttons: "▲ Heavier", "▼ Lighter"…
const more = (): HTMLButtonElement => screen.getAllByRole('button').find((b) => b.textContent?.startsWith('▲')) as HTMLButtonElement;
const less = (): HTMLButtonElement => screen.getAllByRole('button').find((b) => b.textContent?.startsWith('▼')) as HTMLButtonElement;
const challenge = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'abc123', round: 1, seed: 4242, mode: 'fresh', day: '', ...over });

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Gut Check play', () => {
  it('keeps a challenge round to one attempt: no Menu button, and a reopened round carries on or shows its result', () => {
    const pairs = chain(4242, 300, 1);
    const { events, view, remount } = mount(challenge());
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(events).toEqual([{ type: 'start' }]);
    fireEvent.click(answerIsMore(pairs[0]!) ? more() : less());
    view.unmount();
    // A reload (or the toolbar Restart) carries on from the second card, 1 in a row.
    const again = remount();
    expect(document.querySelector('.gc-score b')!.textContent).toBe('1');
    fireEvent.click(answerIsMore(pairs[1]!) ? less() : more());
    const ends = events.filter((e) => e.type === 'end');
    expect(ends).toEqual([{ type: 'end', score: 1, stats: {}, challenge: { id: 'abc123', round: 1 } }]);
    again.unmount();
    // Over: the result shows, nothing is played or reported again.
    mount(challenge());
    expect(screen.getByText('You already played this round.')).toBeTruthy();
    expect(more().disabled).toBe(true);
  });

  it('counts a finished daily as a "Today’s daily" challenge, on the same cards', () => {
    const today = dayKey();
    localStorage.setItem(KEY, JSON.stringify({ best: 4, runs: 1, daily: { [today]: { best: 4, tries: 1 } } }));
    const { events } = mount(challenge({ mode: 'daily', day: today, seed: 1 }));
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', score: 4, stats: {}, challenge: { id: 'abc123', round: 1 } }]);
    expect(readSave().rounds['abc123:1']).toMatchObject({ done: 4 });
  });

  it('shows the missed pair and the call on the end card', () => {
    vi.useFakeTimers();
    const pairs = chain(4242, 300, 1);
    mount(challenge());
    fireEvent.click(answerIsMore(pairs[0]!) ? less() : more());
    act(() => void vi.advanceTimersByTime(1700));
    const miss = screen.getByLabelText('The card you missed');
    expect(miss.textContent).toMatch(/^You said (\w+)/);
    expect(miss.textContent).toMatch(/about|in \d{4}/);
    expect(document.querySelector('.gc-big')!.textContent).toBe('0');
  });

  it('ignores keys typed into the page’s text fields and with Ctrl/Cmd', () => {
    const input = document.body.appendChild(document.createElement('input'));
    mount();
    press(/Play endless/);
    fireEvent.keyDown(input, { key: 'l' });
    fireEvent.keyDown(document.body, { key: 'l', ctrlKey: true });
    expect(more().disabled).toBe(false);
    fireEvent.keyDown(document.body, { key: 'l' });
    expect(more().disabled).toBe(true);
    input.remove();
  });

  it('moves on to the new daily at midnight', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 59));
    mount();
    expect(screen.getByText('Daily #22')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByText('Daily #23')).toBeTruthy();
    // Today's cards are the new day's, filed under it.
    press(/Play today’s cards/);
    expect(readSave().progress).toEqual({ day: '2026-11-10', i: 0 });
  });
});
