import { describe, expect, it } from 'vitest';
import { hashString } from '../src/platform/dates';
import { THEMES, thingById } from '../src/games/whatsit/bank';
import { answerLine, dailyRound, dayOf, fits, LINEUP, makeRound, scoreOf, stillFitting, validRound } from '../src/games/whatsit/logic';

describe('Whatsit bank', () => {
  it('has 14 themes of 16 things with unique ids', () => {
    expect(THEMES.length).toBe(14);
    const ids = THEMES.flatMap((t) => t.things.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) expect(t.things.length, t.id).toBe(16);
  });

  it('every thing in a theme has its own set of answers, so asking everything always finds it', () => {
    for (const t of THEMES) {
      const keys = t.things.map((x) => t.questions.map((q) => (x.yes.has(q.id) ? 1 : 0)).join(''));
      const dupes = t.things.filter((_, i) => keys.indexOf(keys[i]!) !== i).map((x) => x.id);
      expect(dupes, t.id).toEqual([]);
    }
  });

  it('only uses the theme’s own questions, and every question is a yes for something and a no for most', () => {
    for (const t of THEMES) {
      const qs = new Set(t.questions.map((q) => q.id));
      expect(qs.size, t.id).toBe(t.questions.length);
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(8);
      for (const x of t.things) for (const y of x.yes) expect(qs.has(y), `${x.id}: ${y}`).toBe(true);
      for (const q of t.questions) {
        const n = t.things.filter((x) => x.yes.has(q.id)).length;
        expect(n, `${t.id}/${q.id}`).toBeGreaterThanOrEqual(1);
        expect(n, `${t.id}/${q.id}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('has every text in English and Bulgarian, short enough for the cards', () => {
    const british = /\b(colou?r(?<=colour)|favourite|centre|metres?\b|jewellery|grey|practise)/i;
    for (const t of THEMES) {
      expect(t.name.bg, t.id).toMatch(/[а-я]/i);
      for (const q of t.questions) {
        expect(q.text.en, q.id).toMatch(/\?$/);
        expect(q.text.bg, q.id).toMatch(/[а-я].*\?$/i);
        expect(q.short.en.length + q.short.bg.length, q.id).toBeGreaterThan(2);
        expect(q.text.en).not.toMatch(british);
      }
      for (const x of t.things) {
        expect(x.name.bg, x.id).toMatch(/[а-я]/i);
        expect(x.def.bg, x.id).toMatch(/[а-я]/i);
        expect(x.name.en.length, x.id).toBeLessThanOrEqual(28);
        expect(x.name.bg.length, x.id).toBeLessThanOrEqual(34);
        expect(x.def.en.length, x.id).toBeLessThanOrEqual(110);
        expect(x.def.bg.length, x.id).toBeLessThanOrEqual(120);
        expect(x.def.en, x.id).not.toMatch(british);
      }
    }
  });
});

describe('Whatsit rounds', () => {
  it('the daily is the same for everyone and changes theme every day', () => {
    expect(dailyRound('2026-10-25', hashString)).toEqual(dailyRound('2026-10-25', hashString));
    for (let d = 0; d < 60; d++) expect(dailyRound(dayOf(d), hashString).theme).not.toBe(dailyRound(dayOf(d + 1), hashString).theme);
  });

  it('every thing is the daily secret once before any comes back', () => {
    const n = THEMES.length * 16;
    const secrets = Array.from({ length: n }, (_, d) => dailyRound(dayOf(d), hashString).secret);
    expect(new Set(secrets).size).toBe(n);
    expect(dailyRound(dayOf(n), hashString).secret).toBe(secrets[0]);
  });

  it('every line-up has 12 different things from the theme, the secret among them', () => {
    for (let s = 1; s <= 400; s++) {
      const r = s % 2 ? makeRound(s * 7919) : dailyRound(dayOf(s), hashString);
      expect(validRound(r), `seed ${s}`).toBe(true);
      expect(r.lineup.length).toBe(LINEUP);
      expect(r.lineup).toContain(r.secret);
    }
    expect(makeRound(5, 'space').theme).toBe('space');
    expect(validRound({ theme: 'space', secret: 'space:sun', lineup: ['space:sun'] })).toBe(false);
  });

  it('asking every question leaves only the secret; asking none leaves all 12', () => {
    for (let s = 1; s <= 200; s++) {
      const r = makeRound(s);
      const t = THEMES.find((x) => x.id === r.theme)!;
      expect(stillFitting(r, t.questions.map((q) => q.id))).toEqual([r.secret]);
      expect(stillFitting(r, []).length).toBe(LINEUP);
      expect(fits(thingById(r.secret)!, thingById(r.secret)!, t.questions.map((q) => q.id))).toBe(true);
    }
  });

  it('scores 1000 for a quick solve, less per question, at least 200 for any solve, 0 for a miss', () => {
    expect(scoreOf(0, true)).toBe(1000);
    expect(scoreOf(3, true)).toBe(1000);
    expect(scoreOf(5, true)).toBe(850);
    expect(scoreOf(14, true)).toBe(200);
    expect(scoreOf(2, false)).toBe(0);
  });

  it('writes the answers as a spoiler-free line', () => {
    const r = { theme: 'space', secret: 'space:sun', lineup: [] };
    expect(answerLine(r, ['star', 'made', 'hot'])).toBe('🟩🟥🟩');
  });
});
