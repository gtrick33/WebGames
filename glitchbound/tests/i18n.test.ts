import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectLang, dictFrom, LANGS } from '../src/i18n';
import { KEYS } from '../src/i18n/keys';

const holes = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('languages', () => {
  it('picks the saved language, else the browser’s, else English', () => {
    expect(detectLang('de', ['fr-FR'])).toBe('de');
    expect(detectLang(null, ['pt-BR', 'en'])).toBe('pt');
    expect(detectLang('xx', ['ja-JP'])).toBe('en');
  });

  it('has no duplicate keys', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  const files = readdirSync(join(process.cwd(), 'src/i18n/locales')).map((f) => f.replace(/\.ts$/, ''));
  const mods = import.meta.glob<{ default: string[] }>('../src/i18n/locales/*.ts', { eager: true });
  it('has a file for every language but English', () => {
    expect(files.sort()).toEqual(LANGS.map((l) => l.code).filter((c) => c !== 'en').sort());
  });

  for (const code of files) {
    it(`${code}: one translation per key, keeping every {placeholder}`, () => {
      const words = mods[`../src/i18n/locales/${code}.ts`]!.default;
      expect(words.length).toBe(KEYS.length);
      KEYS.forEach((k, i) => {
        expect(words[i], `${code}[${i}] for “${k}”`).toBeTruthy();
        expect(holes(words[i]!), `${code}[${i}] for “${k}”`).toEqual(holes(k));
      });
      const d = dictFrom(KEYS, words);
      expect(d['Play']).toBeTruthy();
    });
  }
});
