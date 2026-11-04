import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { BANNER_MAX, sanitizeBanner } from '../src/catalog/settings';
import { tileImg, tileSmall } from '../src/platform/cardImg';
import { pageSpecs, renderPage } from '../scripts/seo';

const PUBLIC = join(process.cwd(), 'public');
const inPublic = (path: string): string => join(PUBLIC, path.replace(/^\//, ''));

describe('card pictures', () => {
  it('every game with a square picture has its small copies', () => {
    for (const g of GAMES) {
      if (!g.art.tile.endsWith('/tile.webp')) continue;
      for (const size of [160, 400]) {
        const copy = inPublic(g.art.tile.replace('/tile.webp', `/tile-${size}.webp`));
        expect(existsSync(copy), copy).toBe(true);
        expect(statSync(copy).size).toBeLessThan(statSync(inPublic(g.art.tile)).size + 1);
      }
    }
  });

  it('asks for a small copy, and leaves other pictures alone', () => {
    const img = tileImg('/games/belot/tile.webp', 84);
    expect(img.src).toBe('/games/belot/tile.webp');
    expect(img.srcSet).toContain('/games/belot/tile-160.webp 160w');
    expect(img.sizes).toBe('84px');
    expect(tileImg('/photos/x.webp', 84)).toEqual({ src: '/photos/x.webp' });
    expect(tileSmall('/games/belot/tile.webp')).toBe('/games/belot/tile-400.webp');
  });
});

describe('the home page asks for the banner at once', () => {
  const home = pageSpecs('https://example.test')[0]!;
  const template = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

  it('preloads the pictures the banner shows, by the same rule, and they exist', () => {
    const html = renderPage(template, home, 'https://example.test');
    const banner = readFileSync(join(process.cwd(), 'src/components/SigilfallHero.tsx'), 'utf8');
    const tall = /const TALL = '([^']+)'/.exec(banner)![1]!;
    expect(html).toContain(`media="${tall}"`);
    for (const file of ['key-art-phone.avif', 'key-art-1600.avif', 'key-art-2400.avif', 'logo.svg']) {
      expect(html).toContain(`/games/sigilfall/${file}`);
      expect(existsSync(inPublic(`/games/sigilfall/${file}`)), file).toBe(true);
    }
    for (const file of ['key-art-phone.webp', 'key-art-1600.webp', 'key-art-2400.webp']) expect(existsSync(inPublic(`/games/sigilfall/${file}`)), file).toBe(true);
  });

  it('keeps the banner picture light enough to be the first thing to paint', () => {
    expect(statSync(inPublic('/games/sigilfall/key-art-phone.avif')).size).toBeLessThan(60_000);
    expect(statSync(inPublic('/games/sigilfall/key-art-1600.avif')).size).toBeLessThan(60_000);
  });

  it('other pages do not fetch the banner', () => {
    const daily = pageSpecs('https://example.test').find((p) => p.path === '/daily')!;
    expect(renderPage(template, daily, 'https://example.test')).not.toContain('key-art');
  });
});

describe('a game page holds still as it loads', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/GamePage.tsx'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'src/pages/GamePage.css'), 'utf8');

  it('has the board and the pins in its own code, not arriving after the first paint', () => {
    expect(page).toMatch(/import \{ MiniLeaderboard \} from '\.\.\/components\/Leaderboard'/);
    expect(page).toMatch(/import \{ GamePins, PinToast \} from '\.\.\/components\/Pins'/);
    expect(page).not.toMatch(/lazy\w*\(.*components\/(Leaderboard|Pins)/);
  });

  it('keeps the board’s panel as tall as a full board from the start', () => {
    const rule = css.slice(css.indexOf('.gi-panels {'));
    const height = Number(/min-height: (\d+)px/.exec(rule.slice(0, rule.indexOf('}')))?.[1]);
    // five rows of 50px, four gaps of 6px, the 12px gap and the 26px link
    expect(height).toBeGreaterThanOrEqual(5 * 50 + 4 * 6 + 12 + 26);
  });
});

describe('the online controls on a game’s own panel', () => {
  it('keep dark words on Backgammon’s and Belot’s cream panels in the dark theme', () => {
    for (const [file, cls] of [['backgammon', 'tb-online'], ['belot', 'bl-online']] as const) {
      const css = readFileSync(join(process.cwd(), `src/games/${file}/Game.css`), 'utf8');
      const rule = css.slice(css.indexOf(`.${cls} {`));
      expect(rule.slice(0, rule.indexOf('}'))).toMatch(/--fg: var\(--\w+-ink\)/);
      expect(readFileSync(join(process.cwd(), `src/games/${file}/Game.tsx`), 'utf8')).toContain(`className="${cls}"`);
    }
  });
});

describe('the banner’s words from the admin', () => {
  it('keeps only real lines of the right length', () => {
    expect(sanitizeBanner(null)).toEqual({});
    expect(sanitizeBanner({ kicker: '   ', hook: 7, other: 'x' })).toEqual({});
    expect(sanitizeBanner({ kicker: '  A  free   game ' })).toEqual({ kicker: 'A free game' });
    expect(sanitizeBanner({ cta: 'x'.repeat(100) }).cta).toHaveLength(BANNER_MAX.cta);
  });
});
