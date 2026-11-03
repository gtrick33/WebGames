/**
 * Short labels for chrome with a fixed width: the phone tab bar gives each tab about 47 px at 360 px
 * (six tabs with the settings button), so long translations of "Leaderboards" or "Daily" would end
 * in "…". Keyed by the English label; a language or label not listed uses the normal translation.
 * tests/i18n-budget.test.ts holds every language to the length budget (TAB_BUDGET).
 */
import { getLang, t, type Lang } from '.';

/** Most characters a tab label may have: Cyrillic letters are wider than Latin ones. */
export const TAB_BUDGET = { latin: 8, cyrillic: 6 };

export const SHORT_TABS: Partial<Record<Lang, Record<string, string>>> = {
  bg: { Ranks: 'Топ' },
  de: { Arcade: 'Spiele' },
  fr: { Daily: 'Du jour', Ranks: 'Scores' },
  it: { Arcade: 'Giochi', Daily: 'Oggi', Ranks: 'Ranking' },
  nl: { Daily: 'Vandaag' },
  pt: { Ranks: 'Ranking' },
  ro: { Party: 'Party', Ranks: 'Top' },
  tr: { Ranks: 'Skorlar' },
  uk: { Party: 'Паті', Daily: 'Щодня', Ranks: 'Топ' },
};

/** A tab bar label in the current language: the short form when there is one. */
export function tTab(english: string, lang: Lang = getLang()): string {
  return SHORT_TABS[lang]?.[english] ?? t(english);
}
