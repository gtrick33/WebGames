import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installHow, isIos, isStandalone } from '../src/platform/install';

const as = (ua: string, touch = 0): void => {
  vi.stubGlobal('navigator', { ...navigator, userAgent: ua, maxTouchPoints: touch });
};

describe('the arcade as an app', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('spots iPhone and iPad (iPadOS says Mac but has touch points), not a Mac or Android', () => {
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1');
    expect(isIos()).toBe(true);
    as('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 5);
    expect(isIos()).toBe(true);
    as('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 0);
    expect(isIos()).toBe(false);
    as('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', 5);
    expect(isIos()).toBe(false);
  });

  it('shows the steps of the browser at hand when it gives no install dialog (Safari’s were shown everywhere)', () => {
    const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
    expect(installHow(`${IOS} Version/18.6 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-safari');
    expect(installHow(`${IOS} Version/26.0 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-safari-26');
    expect(installHow(`${IOS} CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1`, 5)).toBe('ios-browser');
    expect(installHow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 5)).toBe('ios-safari-26');
    expect(installHow('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', 5)).toBe('android');
    expect(installHow('Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0', 5)).toBe('android');
    expect(installHow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 0)).toBe('mac-safari');
    expect(installHow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', 0)).toBe('desktop');
    expect(installHow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', 0)).toBe('desktop');
    expect(installHow('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', 0)).toBe('none');
  });

  it('keeps the browser’s install offer from the first moment, so one tap installs (the settings load later)', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toMatch(/addEventListener\('beforeinstallprompt'[\s\S]*?e\.preventDefault\(\);\s*window\.__gbInstall = e;/);
    expect(head.indexOf('beforeinstallprompt')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
    expect(readFileSync(join(process.cwd(), 'src/platform/install.ts'), 'utf8')).toContain('deferred = (window as EarlyWindow).__gbInstall ?? null;');
  });

  it('knows when it runs from the Home Screen', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} }));
    expect(isStandalone()).toBe(true);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    expect(isStandalone()).toBe(false);
  });
});
