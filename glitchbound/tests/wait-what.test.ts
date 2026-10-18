import { describe, expect, it } from 'vitest';
import { addDays } from '../src/platform/dates';
import { ODD_WORDS, WORLD_WORDS } from '../src/games/wait-what/bank/lexicon';
import { EVENTS } from '../src/games/wait-what/bank/timeline';
import {
  bankSize,
  challengeQuiz,
  dailyQuiz,
  EndlessDealer,
  fairPair,
  HAND_CATS,
  LAUNCH,
  oddWordQuestion,
  points,
  QUIZ_LENGTH,
  rng,
  timeQuestion,
  worldWordQuestion,
  type Question,
} from '../src/games/wait-what/deck';

function valid(q: Question): void {
  expect(q.text.length).toBeGreaterThan(5);
  expect(q.answers.length).toBeGreaterThanOrEqual(2);
  expect(q.answers.length).toBeLessThanOrEqual(4);
  expect(new Set(q.answers).size).toBe(q.answers.length);
  expect(q.correct).toBeGreaterThanOrEqual(0);
  expect(q.correct).toBeLessThan(q.answers.length);
  expect(q.fact.length).toBeGreaterThan(10);
}

describe('Wait, What? question bank', () => {
  it('has hundreds of valid questions with unique texts', () => {
    expect(bankSize()).toBeGreaterThan(650);
    const dealer = new EndlessDealer([], 1);
    const texts = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const q = dealer.next();
      valid(q);
      if (!/^(time|near|odd|world):/.test(q.id)) texts.add(`${q.text}|${q.answers.slice().sort().join('|')}`);
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
      expect(new Set(day2.map((q) => q.cat)).size).toBeGreaterThanOrEqual(6);
    }
    qs.forEach(valid);
  });

  it('daily players do not see a hand-written question twice for months', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 60; d++) {
      for (const q of dailyQuiz(addDays(LAUNCH, d))) {
        if (q.id.startsWith('time:') || q.id.startsWith('near:')) continue;
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
    const b = new EndlessDealer(a.seenIds(), 8);
    const later = Array.from({ length: 100 }, () => b.next().id).filter((id) => !/^(time|near):/.test(id));
    for (const id of later) expect(ids).not.toContain(id);
  });

  it('scores 100 for a right answer plus up to 50 for speed', () => {
    expect(points(false, 1, 20)).toBe(0);
    expect(points(true, 0, 20)).toBe(150);
    expect(points(true, 10, 20)).toBe(125);
    expect(points(true, 20, 20)).toBe(100);
  });
});
