/**
 * Whatsit's word bank format. A theme has its own yes/no questions and 16 things; each thing lists the
 * questions whose answer is "yes" for it (every other question is "no"). Answers must be beyond argument:
 * tests/whatsit.test.ts checks that every thing in a theme gives a different set of answers, so asking all of
 * a theme's questions always singles the secret out.
 */
import type { ContentLang } from '../../../platform/contentLang';

/** [id, question in English, in Bulgarian, short clue in English, in Bulgarian] */
export type QuestionRow = [id: string, en: string, bg: string, shortEn: string, shortBg: string];
/** [id, name in English, in Bulgarian, one-line definition in English, in Bulgarian, ids of the "yes" questions] */
export type ThingRow = [id: string, en: string, bg: string, defEn: string, defBg: string, yes: string];

export interface ThemeRow {
  id: string;
  emoji: string;
  name: [en: string, bg: string];
  questions: QuestionRow[];
  things: ThingRow[];
}

export interface Question {
  id: string;
  text: Record<ContentLang, string>;
  short: Record<ContentLang, string>;
}
export interface Thing {
  /** "<theme>:<thing>", unique across the bank. */
  id: string;
  name: Record<ContentLang, string>;
  def: Record<ContentLang, string>;
  yes: ReadonlySet<string>;
}
export interface Theme {
  id: string;
  emoji: string;
  name: Record<ContentLang, string>;
  questions: Question[];
  things: Thing[];
}

export const toTheme = (t: ThemeRow): Theme => ({
  id: t.id,
  emoji: t.emoji,
  name: { en: t.name[0], bg: t.name[1] },
  questions: t.questions.map(([id, en, bg, se, sb]) => ({ id, text: { en, bg }, short: { en: se, bg: sb } })),
  things: t.things.map(([id, en, bg, de, db, yes]) => ({
    id: `${t.id}:${id}`,
    name: { en, bg },
    def: { en: de, bg: db },
    yes: new Set(yes.split(' ').filter(Boolean)),
  })),
});
