import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { colorName, deltaE, feedback, hexToRgb, hsbToRgb, MAX_POINTS, pointsFor, rgbToHex, rgbToHsb, verdictFor, verdictText } from '../src/games/color-recall/color';
import { BALANCED_FROM, dailyNumber, dailyRounds, endStats, newGame, pickRounds, practiceRounds, reduce, rng, ROUNDS, scoreGuess, shareText, toneOf, totalScore } from '../src/games/color-recall/logic';
import { crStats, emptyCrSave, mergeCr, recordColor, sanitizeCr, STORE_KEY } from '../src/games/color-recall/store';
import { ACTIVE_TARGETS, RETIRED, TARGETS, wildTarget } from '../src/games/color-recall/targets';
import { addDays, dayKey, hashString } from '../src/platform/dates';
import Game from '../src/games/color-recall/Game';
import type { GameEvent } from '../src/platform/contract';

describe('color conversions', () => {
  it('round-trips hex, RGB and HSB', () => {
    expect(rgbToHex(hexToRgb('#c8102e'))).toBe('#C8102E');
    expect(hsbToRgb({ h: 0, s: 100, b: 100 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsbToRgb({ h: 240, s: 100, b: 50 })).toEqual({ r: 0, g: 0, b: 128 });
    expect(rgbToHsb({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, b: 100 });
    // Grey has no hue: keep the caller's hue so the slider doesn't jump.
    expect(rgbToHsb({ r: 128, g: 128, b: 128 }, 200).h).toBe(200);
    for (const t of TARGETS) {
      const rgb = hexToRgb(t.hex);
      expect(deltaE(rgb, hsbToRgb(rgbToHsb(rgb)))).toBeLessThan(1.5);
    }
  });
});

describe('color distance scoring', () => {
  it('matches CIEDE2000 reference pairs (Sharma et al.)', () => {
    // Known sRGB pairs: identical colours are 0, black vs white is 100.
    expect(deltaE({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(100, 0);
    expect(deltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0);
    // Symmetric.
    const a = hexToRgb('#FF7900');
    const b = hexToRgb('#3D5BFF');
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 6);
  });

  it('awards more points to closer colours, with perfect for invisible differences', () => {
    expect(pointsFor(0)).toBe(MAX_POINTS);
    expect(pointsFor(0.9)).toBe(MAX_POINTS);
    let prev = MAX_POINTS;
    for (const dE of [2, 5, 10, 20, 40, 80]) {
      const p = pointsFor(dE);
      expect(p).toBeLessThan(prev);
      expect(p).toBeGreaterThanOrEqual(0);
      prev = p;
    }
    expect(pointsFor(5)).toBeGreaterThan(800);
    expect(pointsFor(40)).toBeLessThan(100);
    expect(verdictFor(1000)).toBe('perfect');
    expect(verdictFor(100)).toBe('off');
  });

  it('scores a guess against its target', () => {
    const target = TARGETS.find((t) => t.id === 'stop-sign')!;
    expect(scoreGuess(target, hexToRgb(target.hex)).points).toBe(MAX_POINTS);
    const far = scoreGuess(target, { r: 0, g: 160, b: 255 });
    expect(far.points).toBeLessThan(50);
    expect(far.guess).toBe('#00A0FF');
  });

  it('explains the biggest differences in plain words', () => {
    const red = hexToRgb('#C8102E');
    expect(feedback(red, red)).toEqual([]);
    expect(feedback(red, hsbToRgb({ ...rgbToHsb(red), b: 40 }))[0]).toMatch(/too dark/);
    expect(feedback(red, hsbToRgb({ ...rgbToHsb(red), s: 40 })).join(' ')).toMatch(/muted|washed/);
    expect(feedback(red, hsbToRgb({ ...rgbToHsb(red), h: 25 })).join(' ')).toMatch(/orange/);
  });
});

describe('the curated colours', () => {
  it('has unique ids and valid hex values', () => {
    expect(new Set(TARGETS.map((t) => t.id)).size).toBe(TARGETS.length);
    for (const t of TARGETS) expect(t.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(TARGETS.length).toBeGreaterThanOrEqual(50);
  });
});

describe('daily seeding', () => {
  it('gives everyone the same five colours on the same day', () => {
    const a = dailyRounds('2026-10-20');
    const b = dailyRounds('2026-10-20');
    expect(a).toHaveLength(ROUNDS);
    expect(a.map((r) => r.target.id)).toEqual(b.map((r) => r.target.id));
    expect(a.map((r) => r.start)).toEqual(b.map((r) => r.start));
  });

  it('changes from day to day', () => {
    const days = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((d) => dailyRounds(d).map((r) => r.target.id).join());
    expect(new Set(days).size).toBe(days.length);
  });

  it('picks distinct, clearly different colours with different shapes', () => {
    for (let i = 0; i < 60; i++) {
      const rounds = dailyRounds(`2027-01-${String((i % 28) + 1).padStart(2, '0')}`);
      const ids = rounds.map((r) => r.target.id);
      expect(new Set(ids).size).toBe(ROUNDS);
      expect(new Set(rounds.map((r) => r.target.glyph)).size).toBe(ROUNDS);
    }
  });

  it('numbers the dailies from launch and seeds deterministically', () => {
    expect(dailyNumber('2026-10-18')).toBe(1);
    expect(dailyNumber('2026-10-27')).toBe(10);
    const r1 = rng(42);
    const r2 = rng(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
    expect(pickRounds(rng(1), 3, TARGETS.slice(0, 3))).toHaveLength(3);
  });
});

describe('round flow', () => {
  const rounds = pickRounds(rng(7));
  const target = (i: number) => hexToRgb(rounds[i]!.target.hex);

  it('goes peek -> guess -> reveal -> next ... -> done', () => {
    let s = newGame('daily', rounds, 3000);
    expect(s.phase).toBe('peek');
    // Submitting during the peek does nothing.
    expect(reduce(s, { type: 'submit', guess: target(0) })).toBe(s);
    s = reduce(s, { type: 'hide' });
    expect(s.phase).toBe('guess');
    s = reduce(s, { type: 'submit', guess: target(0) });
    expect(s.phase).toBe('reveal');
    expect(s.results[0]!.points).toBe(MAX_POINTS);
    // Double submit is ignored.
    expect(reduce(s, { type: 'submit', guess: target(0) })).toBe(s);
    for (let i = 1; i < ROUNDS; i++) {
      s = reduce(s, { type: 'next' });
      expect(s.index).toBe(i);
      expect(s.phase).toBe('peek');
      s = reduce(reduce(s, { type: 'hide' }), { type: 'submit', guess: { r: 128, g: 128, b: 128 } });
    }
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('done');
    expect(s.results).toHaveLength(ROUNDS);
    expect(totalScore(s.results)).toBe(s.results.reduce((n, r) => n + r.points, 0));
  });

  it('skips the peek in recall mode and resumes an unfinished daily', () => {
    expect(newGame('practice', rounds, 0).phase).toBe('guess');
    const partial = [scoreGuess(rounds[0]!.target, target(0)), scoreGuess(rounds[1]!.target, target(1))];
    const resumed = newGame('daily', rounds, 3000, partial);
    expect(resumed.index).toBe(2);
    expect(newGame('daily', rounds, 3000, [...partial, ...partial, partial[0]!]).phase).toBe('done');
  });

  it('reports declared stats and spoiler-free share text', () => {
    const results = rounds.map((r, i) => scoreGuess(r.target, i === 0 ? target(0) : { r: 0, g: 0, b: 0 }));
    const end = endStats(results);
    expect(end.score).toBe(totalScore(results));
    expect(Object.keys(end.stats).sort()).toEqual(['accuracy', 'bestColor', 'perfects']);
    expect(end.stats.bestColor).toBe(MAX_POINTS);
    expect(end.stats.perfects).toBeGreaterThanOrEqual(1);
    const text = shareText('2026-10-18', results, 3, 'https://example.test/games/color-recall');
    expect(text).toContain('Color Recall #1');
    expect(text).toContain('🟪');
    expect(text).toContain('3-day streak');
    for (const r of rounds) {
      expect(text).not.toContain(r.target.name);
      expect(text).not.toContain(r.target.hex);
    }
  });
});

describe('save and stats', () => {
  it('repairs malformed saves and computes streaks', () => {
    expect(sanitizeCr({ v: 2 })).toEqual(emptyCrSave());
    const r = { targetId: 'lemon', guess: '#FFFF00', dE: 3, points: 900 };
    const full = Array.from({ length: ROUNDS }, () => r);
    const save = sanitizeCr({ v: 1, daily: { '2026-10-16': full, '2026-10-17': full, '2026-10-18': [r], bad: full, '2026-10-10': [{ nope: 1 }] }, practice: { games: -3 } });
    expect(Object.keys(save.daily).sort()).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    expect(save.practice.games).toBe(0);
    const stats = crStats(save, '2026-10-18');
    expect(stats.dailyPlayed).toBe(2);
    expect(stats.streak).toBe(2); // today not finished yet, streak still alive
    expect(stats.bestStreak).toBe(2);
    expect(stats.bestDaily).toBe(4500);
    expect(stats.histogram[4]).toBe(2);
    const next = recordColor(save, { ...r, points: 1000 }, '2026-10-18');
    expect(next.daily['2026-10-18']).toHaveLength(2);
    expect(next.perfects).toBe(1);
    expect(save.daily['2026-10-18']).toHaveLength(1); // not mutated
  });
});

describe('<Game />', () => {
  it('plays a full daily, reports start and end, and saves the result', () => {
    vi.useFakeTimers();
    try {
      const events: GameEvent[] = [];
      render(<Game host={{ report: (e) => events.push(e) }} restartKey={0} />);
      fireEvent.click(screen.getByRole('button', { name: /play today/i }));
      expect(events).toEqual([{ type: 'start' }]);
      for (let i = 0; i < ROUNDS; i++) {
        expect((screen.getByRole('button', { name: /look closely/i }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
        act(() => {
          vi.advanceTimersByTime(3100);
        });
        fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
        expect(screen.getByText(/ΔE/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: i === ROUNDS - 1 ? /see results/i : /next color/i }));
      }
      const end = events.find((e) => e.type === 'end');
      expect(end && end.type === 'end' && end.stats && Object.keys(end.stats)).toBeTruthy();
      expect(screen.getByText(/complete/i)).toBeTruthy();
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
      expect(saved.daily[dayKey()]).toHaveLength(ROUNDS);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows each daily colour only once, even after leaving and resuming', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE_KEY);
    try {
      const events: GameEvent[] = [];
      const first = render(<Game host={{ report: (e) => events.push(e) }} restartKey={0} />);
      fireEvent.click(screen.getByRole('button', { name: /play today/i }));
      expect(screen.getByRole('button', { name: /look closely/i })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
      // Leave during the peek and come back: straight to mixing, no second look.
      fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
      fireEvent.click(screen.getByRole('button', { name: /resume|play today/i }));
      expect(screen.queryByRole('button', { name: /look closely/i })).toBeNull();
      expect(screen.getByRole('button', { name: /lock it in/i })).toBeTruthy();
      // Same after closing the game entirely.
      first.unmount();
      render(<Game host={{ report: (e) => events.push(e) }} restartKey={1} />);
      fireEvent.click(screen.getByRole('button', { name: /resume|play today/i }));
      expect(screen.queryByRole('button', { name: /look closely/i })).toBeNull();
      // The next colour still gets its one look.
      fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
      fireEvent.click(screen.getByRole('button', { name: /next color/i }));
      expect(screen.getByRole('button', { name: /look closely/i })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('tips and names', () => {
  it('always names what to fix when the score is below Brilliant-close (ΔE ≥ 2.5)', () => {
    const random = rng(99);
    const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
    for (let i = 0; i < 4000; i++) {
      const t = { r: ch(random() * 255), g: ch(random() * 255), b: ch(random() * 255) };
      const g = { r: ch(t.r + random() * 50 - 25), g: ch(t.g + random() * 50 - 25), b: ch(t.b + random() * 50 - 25) };
      if (deltaE(t, g) >= 2.5) expect(feedback(t, g).length).toBeGreaterThan(0);
    }
    // The QA cases that used to say "Spot on".
    expect(feedback(hexToRgb('#808000'), hexToRgb('#736903')).length).toBeGreaterThan(0);
    expect(feedback(hexToRgb('#E5E4E2'), hexToRgb('#D9C7D9')).join(' ')).toMatch(/tint/);
    expect(feedback(hexToRgb('#4169E1'), hexToRgb('#5588ED')).length).toBeGreaterThan(0);
  });

  it('calls pinks pink and points hue tips the right way', () => {
    for (const id of ['flamingo', 'watermelon', 'strawberry', 'bubblegum', 'cherry-blossom', 'baby-pink', 'hot-pink', 'cotton-candy']) {
      expect(colorName(hexToRgb(TARGETS.find((t) => t.id === id)!.hex))).toBe('pink');
    }
    const hot = hexToRgb('#FF69B4');
    expect(feedback(hot, hsbToRgb({ ...rgbToHsb(hot), h: 310 })).join(' ')).toMatch(/magenta|purple/);
    expect(feedback(hot, hsbToRgb({ ...rgbToHsb(hot), h: 345 })).join(' ')).toMatch(/red/);
    expect(feedback(hot, hsbToRgb({ ...rgbToHsb(hot), h: 345 })).join(' ')).not.toMatch(/yellow/);
    expect(feedback(hexToRgb('#FC8EAC'), hexToRgb('#E88DFC')).join(' ')).not.toMatch(/not red/);
    expect(wildTarget('#F279AC').name).toMatch(/Pink/);
    expect(wildTarget('#FAA2B8').name).toMatch(/Pink/);
    expect(wildTarget('#9B24B3').name).toMatch(/Purple/);
    expect(wildTarget('#705373').name).toMatch(/Purple/);
  });

  it('never reads hue 360 on the 0-359 slider', () => {
    expect(rgbToHsb({ r: 120, g: 0, b: 1 }).h).toBe(0);
    for (let b = 0; b < 256; b += 3) expect(rgbToHsb({ r: 255, g: 0, b }).h).toBeLessThan(360);
  });

  it('keeps "Perfect!" for a full 1,000', () => {
    expect(verdictText(1000)).toBe('Perfect!');
    expect(verdictText(983)).toBe('Near perfect');
  });
});

describe('the color list', () => {
  it('has no near-twins among the colors still picked', () => {
    for (let i = 0; i < ACTIVE_TARGETS.length; i++) {
      for (let j = i + 1; j < ACTIVE_TARGETS.length; j++) {
        expect(deltaE(hexToRgb(ACTIVE_TARGETS[i]!.hex), hexToRgb(ACTIVE_TARGETS[j]!.hex)), `${ACTIVE_TARGETS[i]!.name} ~ ${ACTIVE_TARGETS[j]!.name}`).toBeGreaterThanOrEqual(2);
      }
    }
    for (const id of RETIRED) expect(TARGETS.some((t) => t.id === id)).toBe(true); // old results still resolve
  });

  it('keeps every published daily and every challenge round exactly as it was', () => {
    // Hashes of the rounds built by the code before the color list changed.
    const parts: string[] = [];
    for (let d = '2026-10-18'; d <= '2026-11-15'; d = addDays(d, 1)) parts.push(`${d}:${dailyRounds(d).map((r) => `${r.target.id}/${r.target.hex}/${r.start.h},${r.start.s},${r.start.b}`).join(';')}`);
    expect(hashString(parts.join('|'))).toBe(1756574134);
    const seeds: string[] = [];
    for (let s = 1; s <= 300; s++) seeds.push(practiceRounds(rng(s)).map((r) => `${r.target.id}/${r.start.h},${r.start.s},${r.start.b}`).join(';'));
    expect(hashString(seeds.join('|'))).toBe(3589488442);
  });

  it('builds even dailies from BALANCED_FROM: no retired colors, at most one pale and one dark', () => {
    for (let i = 0; i < 120; i++) {
      const rounds = dailyRounds(addDays(BALANCED_FROM, i));
      expect(rounds.some((r) => RETIRED.has(r.target.id))).toBe(false);
      const tones = rounds.map((r) => toneOf(r.target.hex));
      expect(tones.filter((t) => t === 'pale').length).toBeLessThanOrEqual(1);
      expect(tones.filter((t) => t === 'dark').length).toBeLessThanOrEqual(1);
      expect(new Set(rounds.map((r) => r.target.glyph)).size).toBe(ROUNDS);
    }
  });
});

describe('two tabs', () => {
  it('merges saves without losing either tab’s progress', () => {
    const r = { targetId: 'lemon', guess: '#FFFF00', dE: 3, points: 900 };
    const a = { ...emptyCrSave(), daily: { '2026-10-29': [r, r] }, dailySeen: { day: '2026-10-29', round: 1 }, bestColor: 900 };
    const b = { ...emptyCrSave(), daily: { '2026-10-29': [r] }, dailySeen: { day: '2026-10-29', round: 0 }, runs: { 'x:1': { results: [r], seen: 1 } }, muted: true };
    const m = mergeCr(b, a);
    expect(m.daily['2026-10-29']).toHaveLength(2);
    expect(m.dailySeen).toEqual({ day: '2026-10-29', round: 1 });
    expect(m.runs['x:1']!.seen).toBe(1);
    expect(m.muted).toBe(true);
    expect(m.bestColor).toBe(900);
  });

  it('a stale tab neither shows a color again nor erases newer results', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE_KEY);
    try {
      render(<Game host={{ report: () => {} }} restartKey={0} />);
      // Another tab plays colors 1 and 2 of today's daily.
      const rounds = dailyRounds(dayKey());
      const done = rounds.slice(0, 2).map((r) => scoreGuess(r.target, hexToRgb(r.target.hex)));
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...emptyCrSave(), daily: { [dayKey()]: done }, dailySeen: { day: dayKey(), round: 1 } }));
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY }));
      });
      fireEvent.click(screen.getByRole('button', { name: /resume \(2\/5\)/i }));
      fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
      expect(JSON.parse(localStorage.getItem(STORE_KEY)!).daily[dayKey()]).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the one look', () => {
  const show = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
  };

  it('pauses the peek under the arcade menu and How to play, without losing the look', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE_KEY);
    try {
      const host = { report: () => {} };
      const view = render(<Game host={host} restartKey={0} pauseKey={0} />);
      fireEvent.click(screen.getByRole('button', { name: /play today/i }));
      show();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      view.rerender(<Game host={host} restartKey={0} pauseKey={1} />);
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      // Still in the peek, color hidden, the time left kept.
      expect(screen.getByRole('button', { name: /look closely/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /paused/i }));
      expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(screen.getByRole('button', { name: /lock it in/i })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a quick double Enter on a reveal does not skip the next look', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE_KEY);
    try {
      render(<Game host={{ report: () => {} }} restartKey={0} />);
      fireEvent.click(screen.getByRole('button', { name: /play today/i }));
      show();
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.keyDown(document.body, { key: 'Enter' });
      fireEvent.keyDown(document.body, { key: 'Enter' });
      fireEvent.keyDown(document.body, { key: 'Enter' });
      expect(screen.getByRole('button', { name: /ready\? color 2/i })).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(STORE_KEY)!).dailySeen.round).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('friends’ challenge rounds', () => {
  const challenge = { id: 'abc', round: 1, seed: 1234, mode: 'fresh' as const, day: '2026-10-29' };

  it('resumes after a reload without a second look and reports the end once', () => {
    vi.useFakeTimers();
    localStorage.removeItem(STORE_KEY);
    try {
      const events: GameEvent[] = [];
      const host = { report: (e: GameEvent) => events.push(e) };
      const first = render(<Game host={host} restartKey={0} challenge={challenge} />);
      expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull(); // one attempt: no way out
      fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
      first.unmount();
      const second = render(<Game host={host} restartKey={0} challenge={challenge} />);
      expect(screen.queryByRole('button', { name: /look closely/i })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
      second.unmount();
      const third = render(<Game host={host} restartKey={0} challenge={challenge} />);
      expect(screen.getByRole('button', { name: /ready\? color 2/i })).toBeTruthy();
      for (let i = 1; i < ROUNDS; i++) {
        if (i > 1) fireEvent.click(screen.getByRole('button', { name: /next color/i }));
        fireEvent.click(screen.getByRole('button', { name: /ready\?/i }));
        act(() => {
          vi.advanceTimersByTime(3100);
        });
        fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
      }
      third.unmount();
      render(<Game host={host} restartKey={0} challenge={challenge} />);
      expect(screen.getByText(/challenge round complete/i)).toBeTruthy();
      expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('“Today’s daily” plays the real daily, and a finished daily counts at once', () => {
    localStorage.removeItem(STORE_KEY);
    const day = '2026-10-29';
    const rounds = dailyRounds(day);
    const done = rounds.map((r) => scoreGuess(r.target, hexToRgb(r.target.hex)));
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...emptyCrSave(), daily: { [day]: done } }));
    const events: GameEvent[] = [];
    render(<Game host={{ report: (e) => events.push(e) }} restartKey={0} challenge={{ ...challenge, id: 'dly', mode: 'daily', day }} />);
    expect(screen.getByText(/your daily result counts here/i)).toBeTruthy();
    const end = events.find((e) => e.type === 'end');
    expect(end && end.type === 'end' && end.score).toBe(totalScore(done));
    expect(end && end.type === 'end' && end.challenge).toEqual({ id: 'dly', round: 1 });
  });
});
