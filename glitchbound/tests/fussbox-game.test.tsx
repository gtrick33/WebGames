import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fussbox from '../src/games/fussbox/Game';
import { cardOf, dailyRound, likes, makeRound, NEAR_MISS_FROM } from '../src/games/fussbox/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import type { GameEvent } from '../src/platform/contract';
import { dayKey, hashString } from '../src/platform/dates';

const KEY = 'glitchbound.fussbox';
const host = () => ({ report: vi.fn<(e: GameEvent) => void>() });
const events = (h: ReturnType<typeof host>, type: string) => h.report.mock.calls.map((c) => c[0]).filter((e) => e.type === type);
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const play = (h = host(), challenge?: ChallengeSpec) => render(<Fussbox host={h} restartKey={0} challenge={challenge} lang="en" />);
const fresh: ChallengeSpec = { id: 'chal1', round: 1, seed: 4242, mode: 'fresh', day: '2026-11-02' };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('glitchbound.coach.fussbox', '1');
});
afterEach(cleanup);

describe('Fussbox keys', () => {
  it('keys typed into the page’s own fields never drive the Lab (FB-01)', () => {
    const h = host();
    const field = document.createElement('input');
    document.body.appendChild(field);
    play(h);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Fussbox' }));
    field.focus();
    fireEvent.keyDown(field, { key: 'r' });
    const enter = fireEvent.keyDown(field, { key: 'Enter' });
    expect(enter).toBe(true); // not prevented: the field's form still gets its Enter
    expect(screen.getByText('0 / 3 free')).toBeTruthy();
    expect(events(h, 'start')).toHaveLength(0);
    // On the game itself, Enter still feeds the card.
    field.blur();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByText('1 / 3 free')).toBeTruthy();
    field.remove();
  });
});

describe('Fussbox daily', () => {
  it('a daily carried on in the same visit reports its start once (FB-07)', () => {
    const h = host();
    play(h);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Fussbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Feed it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    fireEvent.click(screen.getByRole('button', { name: 'Random card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Feed it' }));
    expect(events(h, 'start')).toHaveLength(1);
  });

  it('“Fewest tests” is only reported for an aced exam (FB-09)', () => {
    const h = host();
    play(h);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Fussbox' }));
    fireEvent.click(screen.getByRole('button', { name: /take the exam/ }));
    for (let i = 1; i <= 8; i++) fireEvent.click(screen.getByRole('button', { name: `${i}: Likes it` }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand it in' }));
    const [end] = events(h, 'end');
    const r = dailyRound(dayKey(), hashString);
    const right = r.exam.filter((id) => likes(r.rule, cardOf(id))).length;
    expect(end).toMatchObject({ daily: true, stats: { correct: right } });
    expect((end as { stats: Record<string, number> }).stats.tests).toBeUndefined();
  });

  it('a second tab finishing the daily sends this tab’s stale round back to the menu', () => {
    play();
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Fussbox' }));
    const s = stored();
    s.daily[dayKey()] = { score: 900, correct: 8, tests: 1, line: '🟩🟩🟩🟩🟩🟩🟩🟩' };
    delete s.progress;
    localStorage.setItem(KEY, JSON.stringify(s));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText('Today: 8/8 · 1 test')).toBeTruthy();
  });

  it('a save write keeps what another tab wrote meanwhile', () => {
    play();
    const s = stored();
    localStorage.setItem(KEY, JSON.stringify({ ...s, daily: { '2026-10-30': { score: 700, correct: 7, tests: 2, line: '' } } }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }));
    expect(stored().daily['2026-10-30'].score).toBe(700);
    expect(stored().muted).toBe(true);
  });
});

describe('Fussbox challenges keep one attempt (FB-08)', () => {
  it('a reload after opening the exam goes back to the exam, not the lab', () => {
    const h = host();
    const view = play(h, fresh);
    fireEvent.click(screen.getByRole('button', { name: 'Feed it' }));
    fireEvent.click(screen.getByRole('button', { name: /take the exam/ }));
    fireEvent.click(screen.getByRole('button', { name: '1: Likes it' }));
    view.unmount();
    play(host(), fresh);
    expect(screen.getByRole('heading', { name: 'The exam' })).toBeTruthy();
    expect(screen.getByText('1 / 3 free')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1: Likes it' }).getAttribute('aria-pressed')).toBe('true');
    // No way out of the round from the pause sheet.
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('button', { name: 'Main menu' })).toBeNull();
  });

  it('a finished round shows its result after a reload and is reported once', () => {
    const h = host();
    const view = play(h, fresh);
    fireEvent.click(screen.getByRole('button', { name: /take the exam/ }));
    for (let i = 1; i <= 8; i++) fireEvent.click(screen.getByRole('button', { name: `${i}: Hates it` }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand it in' }));
    expect(events(h, 'end')).toHaveLength(1);
    expect(events(h, 'end')[0]).toMatchObject({ challenge: { id: 'chal1', round: 1 } });
    view.unmount();
    const again = host();
    play(again, fresh);
    expect(screen.getByText('The rule was:')).toBeTruthy();
    expect(again.report).not.toHaveBeenCalled();
  });

  it('a Today’s daily challenge plays the real daily, and a finished daily counts at once', () => {
    const day = dayKey();
    const daily: ChallengeSpec = { id: 'dly1', round: 1, seed: 1, mode: 'daily', day };
    localStorage.setItem(KEY, JSON.stringify({ daily: { [day]: { score: 850, correct: 8, tests: 6, line: '🟩🟩🟩🟩🟩🟩🟩🟩' } } }));
    const h = host();
    const view = play(h, daily);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(events(h, 'end')).toEqual([{ type: 'end', score: 850, stats: { correct: 8, tests: 6 }, challenge: { id: 'dly1', round: 1 } }]);
    view.unmount();
    const again = host();
    play(again, daily);
    expect(again.report).not.toHaveBeenCalled();

    // Not played yet: the challenge is the daily itself, and finishing it records the day's daily too.
    localStorage.removeItem(KEY);
    cleanup();
    const h2 = host();
    play(h2, { ...daily, id: 'dly2' });
    const r = dailyRound(day, hashString);
    fireEvent.click(screen.getByRole('button', { name: /take the exam/ }));
    r.exam.forEach((id, i) => fireEvent.click(screen.getByRole('button', { name: `${i + 1}: ${likes(r.rule, cardOf(id)) ? 'Likes' : 'Hates'} it` })));
    fireEvent.click(screen.getByRole('button', { name: 'Hand it in' }));
    expect(events(h2, 'end')[0]).toMatchObject({ score: 1000, daily: true, challenge: { id: 'dly2' } });
    expect(stored().daily[day]).toMatchObject({ score: 1000, correct: 8 });
  });
});

describe('Fussbox design: free tests, card taps, names and reasons', () => {
  it('the HUD says the first 3 tests are free, then what the extra ones cost', async () => {
    const { testCost } = await import('../src/games/fussbox/logic');
    expect([0, 3, 4, 8, 13, 40].map(testCost)).toEqual([0, 0, 20, 100, 200, 200]);
    play();
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s Fussbox' }));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Random card' }));
      fireEvent.click(screen.getByRole('button', { name: 'Feed it' }));
    }
    expect(screen.getByLabelText(/^\d tests?$/).textContent).toMatch(/^(\d \/ 3 free|4 tests · −20)$/);
  });

  it('tapping an exam card cycles its mark and says its name; the result says why', async () => {
    const { describe: say, explain } = await import('../src/games/fussbox/words');
    play(host(), fresh);
    fireEvent.click(screen.getByRole('button', { name: /take the exam/ }));
    const r = makeRoundFor(fresh);
    const card = screen.getByRole('button', { name: new RegExp(`^1: \\d `) });
    fireEvent.click(card);
    expect(screen.getByRole('button', { name: '1: Likes it' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/^1: \d (pink|blue|yellow)/);
    fireEvent.click(card);
    expect(screen.getByRole('button', { name: '1: Hates it' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(card);
    expect(screen.getByRole('button', { name: '1: Hates it' }).getAttribute('aria-pressed')).toBe('false');
    for (let i = 1; i <= 8; i++) fireEvent.click(screen.getByRole('button', { name: `${i}: Likes it` }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand it in' }));
    const first = r.exam[0]!;
    fireEvent.click(screen.getAllByRole('button').find((b) => b.closest('.fbx-review'))!);
    const why = document.querySelector('.fbx-why')!.textContent!;
    expect(why).toContain(explain(r.rule, cardOf(first), 'en'));
    expect(why).toContain(likes(r.rule, cardOf(first)) ? 'it likes it.' : 'it hates it (you said it likes it).');
    expect(explain({ t: 'and', l: { t: 'is', a: 'count', v: 1 }, r: { t: 'not', r: { t: 'is', a: 'fill', v: 0 } } }, { count: 1, shape: 0, colour: 0, fill: 0 }, 'en')).toBe('two symbols ✓ · not solid ✗');
    expect(say(r.rule, 'en').length).toBeGreaterThan(0);
  });
});

const makeRoundFor = (c: ChallengeSpec) => makeRound(c.seed, 3, c.day >= NEAR_MISS_FROM);
