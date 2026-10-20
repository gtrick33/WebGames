import { describe, expect, it } from 'vitest';
import { challengeQuiz, dailyQuiz, EndlessDealer, FORMATS_SINCE, GENERATED, HAND_CATS, QUIZ_LENGTH, type Question } from '../src/games/wait-what/deck';
import { EN, type Pack } from '../src/games/wait-what/pack';
import { UI } from '../src/games/wait-what/ui';

/** Every language folder in bank/ (each exports PACK), checked against English the same way. */
const FOLDERS = import.meta.glob<{ PACK: Pack }>('../src/games/wait-what/bank/*/index.ts', { eager: true });
const PACKS = Object.entries(FOLDERS).map(([path, mod]) => ({ folder: path.split('/').at(-2)!, p: mod.PACK }));

/** Longest answer allowed on a button (longer ones wrap badly on phones). */
const MAX_ANSWER = 72;

describe('Quizbelief language packs', () => {
  it('finds the language folders', () => {
    expect(PACKS.map((x) => x.folder)).toContain('bg');
  });

  for (const { folder, p } of PACKS) {
    describe(folder, () => {
      it('is the language its folder says, with a sentence for every generated question', () => {
        expect(p.lang).toBe(folder);
        expect(p.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
        for (const [key, value] of Object.entries(p.text)) expect(value, key).toBeTruthy();
        // English and Bulgarian keep their on-screen text in ui.ts; every other language brings its own.
        const ui = p.ui ?? (UI as Partial<Record<string, unknown>>)[p.lang];
        expect(ui, 'on-screen text (Pack.ui)').toBeTruthy();
        if (p.ui) for (const key of Object.keys(UI.en)) expect((p.ui as unknown as Record<string, unknown>)[key], `ui.${key}`).toBeTruthy();
      });

      it('translates every hand-written question in the same order, with the same number of answers', () => {
        const fixed = (pack: Pack, answers: string): boolean => {
          const list = answers.split('|');
          return pack.fixedOrder.some((o) => o.length === list.length && o.every((x) => list.includes(x)));
        };
        expect(p.fixedOrder.length).toBe(EN.fixedOrder.length);
        expect(p.batches.map((b) => b.since)).toEqual(EN.batches.map((b) => b.since));
        EN.batches.forEach((b, k) => {
          for (const cat of HAND_CATS) {
            const en = b.items[cat];
            const tr = p.batches[k]!.items[cat];
            expect(tr.length, `batch ${k} ${cat}`).toBe(en.length);
            en.forEach((raw, i) => {
              const t = tr[i]!;
              const where = `batch ${k} ${cat}:${i} (${raw[0].slice(0, 40)})`;
              expect(t[0] && t[2], where).toBeTruthy();
              const answers = t[1].split('|');
              expect(answers.length, `${where} answers`).toBe(raw[1].split('|').length);
              expect(new Set(answers).size, `${where} unique answers`).toBe(answers.length);
              expect(Math.max(...answers.map((a) => a.length)), `${where} answer too long`).toBeLessThanOrEqual(MAX_ANSWER);
              // True/False and friends keep their set order in every language (so the daily stays in step).
              expect(fixed(p, t[1]), `${where} fixed order`).toBe(fixed(EN, raw[1]));
            });
          }
        });
      });

      it('has every generated list: events, lever, tunes and words of the world line up with English', () => {
        expect(p.events.length).toBe(EN.events.length);
        expect(p.events.every((e, i) => e[0] === EN.events[i]![0] && typeof e[1] === 'string' && e[1].length > 3)).toBe(true);
        expect(p.numbers.length).toBe(EN.numbers.length);
        expect(p.numbers.every((n, i) => n.answer === EN.numbers[i]!.answer && n.q && n.fact && (EN.numbers[i]!.unit === undefined) === (n.unit === undefined))).toBe(true);
        expect(p.tunes.length).toBe(EN.tunes.length);
        expect(new Set(p.tunes.map((t) => t.name)).size).toBe(EN.tunes.length);
        expect(p.world.length).toBe(EN.world.length);
        expect(p.world.every((w) => w[1] && w[2])).toBe(true);
        expect(new Set(p.odd.map((w) => w[0])).size).toBe(p.odd.length);
        expect(p.odd.length).toBeGreaterThanOrEqual(40);
        expect(p.typed.length).toBeGreaterThanOrEqual(20);
        expect(p.emojiTitles.length + p.emojiSayings.length).toBeGreaterThanOrEqual(30);
        for (const [emoji, answers, fact] of [...p.emojiTitles, ...p.emojiSayings]) {
          expect(emoji && fact).toBeTruthy();
          expect(new Set(answers.split('|')).size).toBe(4);
        }
        for (const [q, accepted, fact] of p.typed) expect(q && accepted && fact).toBeTruthy();
      });

      it('picks the same hand-written questions as English for the daily and for challenges, and plays endless', () => {
        const hand = (qs: Question[]): string[] => qs.filter((q) => !GENERATED.test(q.id)).map((q) => q.id).sort();
        for (const day of ['2026-10-18', FORMATS_SINCE, '2026-10-22', '2026-11-02', '2027-03-01']) {
          expect(hand(dailyQuiz(day, p))).toEqual(hand(dailyQuiz(day)));
          expect(dailyQuiz(day, p)).toHaveLength(QUIZ_LENGTH);
        }
        expect(hand(challengeQuiz(12345, '2026-11-02', p))).toEqual(hand(challengeQuiz(12345, '2026-11-02')));
        const dealer = new EndlessDealer([], 7, p);
        for (let i = 0; i < 150; i++) {
          const q = dealer.next();
          expect(q.text, q.id).toBeTruthy();
          if ((q.kind ?? 'choice') === 'choice') expect(q.correct, q.id).toBeGreaterThanOrEqual(0);
        }
      });
    });
  }
});
