import { describe, expect, it } from 'vitest';
import { addDays } from '../src/platform/dates';
import { ODD_WORDS, WORLD_WORDS } from '../src/games/wait-what/bank/lexicon';
import { EVENTS } from '../src/games/wait-what/bank/timeline';
import { EMOJI_SAYINGS, EMOJI_TITLES } from '../src/games/wait-what/bank/emoji';
import { NUMBERS } from '../src/games/wait-what/bank/numbers';
import { TUNES } from '../src/games/wait-what/bank/tunes';
import { TYPED } from '../src/games/wait-what/bank/typed';
import {
  answerText,
  bankSize,
  challengeQuiz,
  dailyQuiz,
  emojiQuestion,
  EndlessDealer,
  fairPair,
  FORMATS_SINCE,
  GENERATED,
  HAND_CATS,
  judge,
  LAUNCH,
  leverStart,
  morseQuestion,
  MORSE_WORDS,
  numberQuestion,
  oddWordQuestion,
  orderQuestion,
  points,
  QUIZ_LENGTH,
  rng,
  scorePick,
  timeQuestion,
  tuneQuestion,
  typedMatches,
  typedQuestion,
  worldWordQuestion,
  YEAR_EVENTS,
  yearQuestion,
  type Question,
} from '../src/games/wait-what/deck';
import { freq, parseNotes } from '../src/games/wait-what/sound';

function valid(q: Question): void {
  expect(q.text.length).toBeGreaterThan(5);
  expect(q.fact.length).toBeGreaterThan(10);
  const kind = q.kind ?? 'choice';
  if (kind === 'number') {
    const n = q.num!;
    expect(n.answer).toBeGreaterThanOrEqual(n.min);
    expect(n.answer).toBeLessThanOrEqual(n.max);
    expect(n.near).toBeGreaterThan(n.tol);
    // Leaving the lever where it starts never scores.
    expect(judge(q, leverStart(q))).toBe('wrong');
    return;
  }
  if (kind === 'type') {
    expect(q.answers.length).toBeGreaterThanOrEqual(1);
    for (const a of q.answers) expect(typedMatches(a, q.answers)).toBe(true);
    return;
  }
  if (kind === 'order') {
    expect(q.answers).toHaveLength(4);
    expect([...q.order!].sort()).toEqual([0, 1, 2, 3]);
    return;
  }
  expect(q.answers.length).toBeGreaterThanOrEqual(2);
  expect(q.answers.length).toBeLessThanOrEqual(4);
  expect(new Set(q.answers).size).toBe(q.answers.length);
  expect(q.correct).toBeGreaterThanOrEqual(0);
  expect(q.correct).toBeLessThan(q.answers.length);
}

describe('Wait, What? question bank', () => {
  it('has hundreds of valid questions with unique texts', () => {
    expect(bankSize()).toBeGreaterThan(650);
    const dealer = new EndlessDealer([], 1);
    const texts = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const q = dealer.next();
      valid(q);
      if (!GENERATED.test(q.id)) texts.add(`${q.text}|${q.answers.slice().sort().join('|')}`);
    }
    expect(texts.size).toBeGreaterThan(250);
  });

  it('every word question is fair: decoys never mean the same thing', () => {
    for (let i = 0; i < ODD_WORDS.length; i++) {
      for (let s = 0; s < 4; s++) {
        const q = oddWordQuestion(i, rng(i * 7 + s));
        valid(q);
        const group = ODD_WORDS[i]![2];
        if (group) {
          const others = q.answers.filter((_, j) => j !== q.correct);
          for (const o of others) expect(ODD_WORDS.find((w) => w[0] === o || w[1] === o)?.[2]).not.toBe(group);
        }
      }
    }
    for (let i = 0; i < WORLD_WORDS.length; i++) valid(worldWordQuestion(i, rng(i)));
  });

  it('only pairs timeline events that are clearly apart and close enough to be tricky', () => {
    let pairs = 0;
    for (let a = 0; a < EVENTS.length; a++)
      for (let b = a + 1; b < EVENTS.length; b++)
        if (fairPair(a, b)) {
          pairs++;
          expect(EVENTS[a]![0]).not.toBe(EVENTS[b]![0]);
        }
    expect(pairs).toBeGreaterThan(1000);
    for (let a = 0; a < EVENTS.length; a++) {
      const q = timeQuestion(a, rng(a));
      if (q) valid(q);
    }
  });
});

describe('Wait, What? decks', () => {
  it('daily quiz: same for everyone, ten different questions, a mix of categories', () => {
    const day = '2026-10-25';
    expect(dailyQuiz(day)).toEqual(dailyQuiz(day));
    const qs = dailyQuiz(day);
    expect(qs).toHaveLength(QUIZ_LENGTH);
    expect(new Set(qs.map((q) => q.id)).size).toBe(QUIZ_LENGTH);
    for (let d = 0; d < 30; d++) {
      const day2 = dailyQuiz(addDays(LAUNCH, d)).filter((q) => (HAND_CATS as string[]).includes(q.cat));
      expect(new Set(day2.map((q) => q.cat)).size).toBeGreaterThanOrEqual(d === 0 ? 6 : 5);
    }
    qs.forEach(valid);
  });

  it('daily quiz: from the new formats on, every day has a lever, a timeline and a special', () => {
    // Launch day keeps its original ten (players may be halfway through it).
    expect(dailyQuiz(LAUNCH).every((q) => (q.kind ?? 'choice') === 'choice' && !q.sound && !q.emoji)).toBe(true);
    const specials = new Set<string>();
    for (let d = 0; d < 28; d++) {
      const qs = dailyQuiz(addDays(FORMATS_SINCE, d));
      expect(qs).toHaveLength(QUIZ_LENGTH);
      expect(new Set(qs.map((q) => q.id)).size).toBe(QUIZ_LENGTH);
      qs.forEach(valid);
      expect(qs.filter((q) => q.kind === 'number')).toHaveLength(1);
      expect(qs.filter((q) => q.cat === 'time')).toHaveLength(1);
      for (const q of qs) if (q.sound || q.emoji || q.kind === 'type') specials.add(q.cat);
    }
    expect([...specials].sort()).toEqual(['emoji', 'morse', 'tune', 'type']);
    // Halloween week plays a spooky tune.
    const spooky = dailyQuiz('2026-10-27').find((q) => q.cat === 'tune');
    if (spooky) expect(spooky.sound).toMatchObject({ spooky: true });
  });

  it('daily players do not see a hand-written question twice for months', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 60; d++) {
      for (const q of dailyQuiz(addDays(LAUNCH, d))) {
        if (/^(time|near|order):/.test(q.id)) continue;
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
    }
  });

  it('challenge rounds give every player the same questions', () => {
    expect(challengeQuiz(12345, '2026-10-20')).toEqual(challengeQuiz(12345, '2026-10-20'));
    expect(challengeQuiz(12345, '2026-10-20').map((q) => q.id)).not.toEqual(challengeQuiz(54321, '2026-10-20').map((q) => q.id));
    const qs = challengeQuiz(99, '');
    expect(qs).toHaveLength(QUIZ_LENGTH);
    expect(new Set(qs.map((q) => q.id)).size).toBe(QUIZ_LENGTH);
  });

  it('endless never repeats until the bank runs out, even across sessions', () => {
    const a = new EndlessDealer([], 7);
    const ids = Array.from({ length: 300 }, () => a.next().id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every style turns up in a long run.
    const styles = new Set(ids.map((id) => id.split(':')[0]));
    for (const s of ['num', 'year', 'type', 'emoji', 'tune', 'morse', 'order', 'time', 'odd', 'world']) expect(styles.has(s)).toBe(true);
    const b = new EndlessDealer(a.seenIds(), 8);
    const later = Array.from({ length: 100 }, () => b.next().id).filter((id) => !/^(time|near|order):/.test(id));
    for (const id of later) expect(ids).not.toContain(id);
  });

  it('scores 100 for a right answer plus up to 50 for speed', () => {
    expect(points(false, 1, 20)).toBe(0);
    expect(points(true, 0, 20)).toBe(150);
    expect(points(true, 10, 20)).toBe(125);
    expect(points(true, 20, 20)).toBe(100);
  });
});

describe('Wait, What? newer question styles', () => {
  it('has valid lever, typed, emoji, tune and Morse questions', () => {
    NUMBERS.forEach((_, i) => valid(numberQuestion(i)));
    YEAR_EVENTS.forEach((i) => valid(yearQuestion(i)));
    TYPED.forEach((_, i) => valid(typedQuestion(i)));
    EMOJI_TITLES.forEach((_, i) => valid(emojiQuestion('film', i, rng(i))));
    EMOJI_SAYINGS.forEach((_, i) => valid(emojiQuestion('say', i, rng(i))));
    TUNES.forEach((_, i) => valid(tuneQuestion(i, rng(i))));
    MORSE_WORDS.forEach((w, i) => {
      const q = morseQuestion(i, rng(i));
      valid(q);
      expect(q.answers).toHaveLength(4);
      expect(q.answers.every((a) => a.length === w.length)).toBe(true);
    });
    for (let s = 0; s < 40; s++) valid(orderQuestion(rng(s)));
  });

  it('writes every tune with real notes and a sensible length', () => {
    for (const t of TUNES) {
      const notes = parseNotes(t.notes);
      expect(notes.length).toBeGreaterThanOrEqual(7);
      for (const [n, b] of notes) {
        if (n !== 'R') expect(freq(n), `${t.name}: ${n}`).not.toBeNull();
        expect(b).toBeGreaterThan(0);
      }
      const secs = (notes.reduce((s, [, b]) => s + b, 0) * 60) / t.bpm;
      expect(secs, t.name).toBeLessThan(16);
    }
    expect(freq('A4')).toBeCloseTo(440);
    expect(freq('C4')).toBeCloseTo(261.63, 1);
  });

  it('grades the lever: spot on, close (some points) or wrong', () => {
    const q = numberQuestion(NUMBERS.findIndex((n) => n.answer === 206));
    expect(judge(q, 206)).toBe('right');
    expect(judge(q, 210)).toBe('right');
    expect(judge(q, 230)).toBe('close');
    expect(judge(q, 400)).toBe('wrong');
    expect(judge(q, -1)).toBe('timeout');
    expect(scorePick(q, 206, 0, 25)).toBe(150);
    const near = scorePick(q, 215, 0, 25);
    expect(near).toBeGreaterThan(25);
    expect(near).toBeLessThan(100);
    expect(scorePick(q, 400, 0, 25)).toBe(0);
  });

  it('accepts typed answers in any case, without accents, with a small typo', () => {
    expect(typedMatches('venus', ['Venus'])).toBe(true);
    expect(typedMatches('  The Pacific Ocean! ', ['Pacific', 'Pacific Ocean'])).toBe(true);
    expect(typedMatches('Vatcan City', ['Vatican City'])).toBe(true);
    expect(typedMatches('Mars', ['Venus'])).toBe(false);
    expect(typedMatches('', ['Q'])).toBe(false);
    expect(typedMatches('R', ['Q'])).toBe(false);
    const q = typedQuestion(0);
    expect(answerText(q)).toBe('Venus');
  });

  it('grades an order: all right, one swap is close, more is wrong', () => {
    const q = orderQuestion(rng(3));
    const o = q.order!;
    expect(judge(q, o)).toBe('right');
    expect(judge(q, [o[1]!, o[0]!, o[2]!, o[3]!])).toBe('close');
    expect(judge(q, [...o].reverse())).toBe('wrong');
    expect(scorePick(q, [o[1]!, o[0]!, o[2]!, o[3]!], 0, 30)).toBe(50);
  });

  it('challenge rounds after the new formats mix in the newer styles too', () => {
    const qs = challengeQuiz(777, FORMATS_SINCE);
    expect(qs).toHaveLength(QUIZ_LENGTH);
    expect(qs.filter((q) => q.kind === 'number')).toHaveLength(1);
    expect(challengeQuiz(777, FORMATS_SINCE)).toEqual(qs);
    // Older challenges keep their questions.
    expect(challengeQuiz(777, LAUNCH).every((q) => (q.kind ?? 'choice') === 'choice')).toBe(true);
  });
});
