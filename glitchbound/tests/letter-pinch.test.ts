import { describe, expect, it } from 'vitest';
import {
  ANSWER_LIST,
  checkGuess,
  dailySecret,
  EPOCH,
  feedback,
  fits,
  isAllowed,
  keyState,
  MAX_GUESSES,
  practiceSecret,
  puzzleNumber,
  rng,
  roundStats,
  scoreRound,
  shareText,
  windowsFor,
  type Row,
  type Window,
} from '../src/games/letter-pinch/logic';
import { ALLOWED_PACKED } from '../src/games/letter-pinch/words';
import { emptyPinchSave, finishDaily, finishPractice, shownStreak } from '../src/games/letter-pinch/storage';
import { addDays } from '../src/platform/dates';

const row = (guess: string, secret: string): Row => ({ guess, marks: feedback(guess, secret) });

/** Every accepted word, unpacked. */
const ALLOWED: string[] = [];
for (let i = 0; i < ALLOWED_PACKED.length; i += 5) ALLOWED.push(ALLOWED_PACKED.slice(i, i + 5));

/** Guesses the accepted word that sits closest to the middle of every window: a fair, simple player. */
function solve(secret: string): Row[] {
  const rows: Row[] = [];
  let pool = ALLOWED;
  while (rows.length < 12) {
    const w = windowsFor(rows);
    pool = pool.filter((x) => fits(x, w));
    let best = pool[0]!;
    let bestCost = Infinity;
    for (const x of pool) {
      let cost = 0;
      for (let i = 0; i < 5; i++) cost += Math.abs(x.charCodeAt(i) - 97 - (w[i]!.lo + w[i]!.hi) / 2);
      if (cost < bestCost) [best, bestCost] = [x, cost];
    }
    rows.push(row(best, secret));
    if (best === secret) break;
  }
  return rows;
}

describe('word lists', () => {
  it('answers are unique, lowercase five-letter words that are also accepted guesses', () => {
    expect(ANSWER_LIST.length).toBeGreaterThan(500);
    expect(new Set(ANSWER_LIST).size).toBe(ANSWER_LIST.length);
    for (const w of ANSWER_LIST) {
      expect(w).toMatch(/^[a-z]{5}$/);
      expect(isAllowed(w)).toBe(true);
    }
  });

  it('accepted guesses are packed five letters at a time', () => {
    expect(ALLOWED_PACKED.length % 5).toBe(0);
    expect(ALLOWED_PACKED).toMatch(/^[a-z]+$/);
    expect(isAllowed('birds')).toBe(true);
    expect(isAllowed('zzzzz')).toBe(false);
  });

  it('rejects short and unknown guesses', () => {
    expect(checkGuess('cat')).toBe('short');
    expect(checkGuess('qxzvb')).toBe('unknown');
    expect(checkGuess('crane')).toBeNull();
  });
});

describe('feedback', () => {
  it('says whether each secret letter is later, earlier or exact', () => {
    expect(feedback('mouse', 'house')).toEqual(['down', 'hit', 'hit', 'hit', 'hit']);
    expect(feedback('apple', 'zebra')).toEqual(['up', 'down', 'down', 'up', 'down']);
    expect(feedback('house', 'house')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
  });

  it('handles repeated letters per column independently', () => {
    expect(feedback('llama', 'allow')).toEqual(['down', 'hit', 'up', 'up', 'up']);
  });

  it('windows squeeze and always contain the secret', () => {
    const secret = 'grape';
    const rows = [row('mouse', secret), row('candy', secret)];
    const w = windowsFor(rows);
    expect(w[0]).toEqual({ lo: 3, hi: 11 }); // d..l
    for (let i = 0; i < 5; i++) {
      const c = secret.charCodeAt(i) - 97;
      expect(c).toBeGreaterThanOrEqual(w[i]!.lo);
      expect(c).toBeLessThanOrEqual(w[i]!.hi);
    }
    expect(fits(secret, w)).toBe(true);
    expect(fits('mouse', w)).toBe(false);
  });

  it('a hit pins the column and colours keys', () => {
    const w: Window[] = windowsFor([row('house', 'horse')]);
    expect(w[0]).toEqual({ lo: 7, hi: 7 });
    expect(keyState('q', w)).toBe('open');
    const shut = windowsFor([row('house', 'house')]);
    expect(keyState('h', shut)).toBe('hit');
    expect(keyState('a', shut)).toBe('out');
  });
});

describe('daily puzzle', () => {
  it('is the same for a date, numbered from the epoch', () => {
    expect(puzzleNumber(EPOCH)).toBe(1);
    expect(puzzleNumber(addDays(EPOCH, 9))).toBe(10);
    expect(dailySecret('2026-11-05')).toBe(dailySecret('2026-11-05'));
    // Pinned so a change to the list or shuffle (which would change everyone's daily) is deliberate.
    expect(dailySecret(EPOCH)).toMatchInlineSnapshot(`"aware"`);
  });

  it('does not repeat a word until every answer has been used', () => {
    const seen = new Set<string>();
    for (let d = 0; d < ANSWER_LIST.length; d++) seen.add(dailySecret(addDays(EPOCH, d)));
    expect(seen.size).toBe(ANSWER_LIST.length);
  });

  it('practice never serves the word it must avoid', () => {
    const r = rng(42);
    for (let i = 0; i < 500; i++) expect(practiceSecret(r, 'about')).not.toBe('about');
  });

  it('every daily for the next two years is solvable in six guesses by a consistent player', () => {
    const counts: number[] = [];
    for (let d = 0; d < 730; d++) {
      const secret = dailySecret(addDays(EPOCH, d));
      const rows = solve(secret);
      expect(rows.at(-1)!.guess, secret).toBe(secret);
      counts.push(rows.length);
    }
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_GUESSES);
  });
});

describe('scoring and sharing', () => {
  it('rewards spare guesses and speed; a miss scores 0', () => {
    expect(scoreRound({ solved: true, guesses: 6, seconds: 600 })).toBe(200);
    expect(scoreRound({ solved: true, guesses: 3, seconds: 30 })).toBe(200 + 300 + 90);
    expect(scoreRound({ solved: false, guesses: 6, seconds: 10 })).toBe(0);
  });

  it('only reports best-able stats for solves', () => {
    expect(roundStats({ solved: false, guesses: 6, seconds: 40 })).toEqual({ score: 0, stats: { spare: 0 } });
    expect(roundStats({ solved: true, guesses: 4, seconds: 61.4 }, 3)).toEqual({
      score: 200 + 200 + 80,
      stats: { spare: 2, guesses: 4, seconds: 61, streak: 3 },
    });
  });

  it('share text is spoiler-free', () => {
    const rows = [row('mouse', 'grape'), row('grape', 'grape')];
    const text = shareText({ rows, solved: true, daily: 7, url: 'https://example.com/games/letter-pinch' });
    expect(text).toBe('Letter Pinch #7 2/6\n🔽🔼🔽🔽🟩\n🟩🟩🟩🟩🟩\nhttps://example.com/games/letter-pinch');
    expect(text).not.toMatch(/grape|mouse/i);
    expect(shareText({ rows, solved: false, url: 'u' })).toMatch(/^Letter Pinch practice X\/6/);
  });
});

describe('streaks and stats', () => {
  it('counts consecutive daily solves and resets on a miss or a gap', () => {
    const s = emptyPinchSave();
    finishDaily(s, '2026-10-20', true, 3);
    finishDaily(s, '2026-10-21', true, 4);
    expect(s.stats.streak).toBe(2);
    expect(shownStreak(s.stats, '2026-10-22')).toBe(2);
    expect(shownStreak(s.stats, '2026-10-23')).toBe(0);
    finishDaily(s, '2026-10-23', true, 5);
    expect(s.stats.streak).toBe(1);
    expect(s.stats.maxStreak).toBe(2);
    finishDaily(s, '2026-10-24', false, 6);
    expect(s.stats).toMatchObject({ streak: 0, played: 4, wins: 3, dist: [0, 0, 1, 1, 1, 0] });
  });

  it('a day only counts once', () => {
    const s = emptyPinchSave();
    finishDaily(s, '2026-10-20', true, 3);
    finishDaily(s, '2026-10-20', true, 3);
    expect(s.stats.played).toBe(1);
  });

  it('practice has its own counters', () => {
    const s = emptyPinchSave();
    finishPractice(s, true, 2);
    finishPractice(s, false, 6);
    expect(s.practice).toEqual({ played: 2, wins: 1, dist: [0, 1, 0, 0, 0, 0] });
    expect(s.stats.played).toBe(0);
  });
});
