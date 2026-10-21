import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIos, isStandalone } from '../src/platform/install';

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

  it('knows when it runs from the Home Screen', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} }));
    expect(isStandalone()).toBe(true);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    expect(isStandalone()).toBe(false);
  });
});
