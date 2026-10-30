import { describe, expect, it } from 'vitest';
import { dictFrom, LANGS } from '../src/i18n';
import { KEYS } from '../src/i18n/keys';
import { SHORT_TABS, TAB_BUDGET } from '../src/i18n/short';

const mods = import.meta.glob<{ default: string[] }>('../src/i18n/locales/*.ts', { eager: true });
const dictOf = (code: string): Record<string, string> => (code === 'en' ? {} : dictFrom(KEYS, mods[`../src/i18n/locales/${code}.ts`]!.default));

/** The phone tab bar's translated labels (src/components/Header.tsx TABS: `short ?? label`). */
const TAB_KEYS = ['Arcade', 'Party', 'Daily', 'Ranks'];

describe('length budget for translated chrome (PU-08)', () => {
  for (const { code } of LANGS)
    it(`${code}: every phone tab label fits its 47 px tab at 360 px`, () => {
      const d = dictOf(code);
      for (const k of TAB_KEYS) {
        const label = SHORT_TABS[code]?.[k] ?? d[k] ?? k;
        const max = /[Ѐ-ӿ]/.test(label) ? TAB_BUDGET.cyrillic : TAB_BUDGET.latin;
        expect(label.length, `${code} “${k}” → “${label}”`).toBeLessThanOrEqual(max);
      }
    });

  it('short labels only cover tab keys that exist', () => {
    for (const short of Object.values(SHORT_TABS)) for (const k of Object.keys(short)) expect(TAB_KEYS).toContain(k);
    for (const k of TAB_KEYS) expect(KEYS).toContain(k);
  });
});
