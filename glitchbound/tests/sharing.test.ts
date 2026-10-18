import { describe, expect, it } from 'vitest';
import { newCode, sharePath, shareText } from '../server/shares';
import { cardLines, lineWidth } from '../src/platform/shareCard';

describe('share links', () => {
  it('only points at pages of this site', () => {
    expect(sharePath('/games/wing-it')).toBe('/games/wing-it');
    expect(sharePath('/games/wing-it?beat=40')).toBe('/games/wing-it?beat=40');
    expect(sharePath('/daily')).toBe('/daily');
    expect(sharePath('/')).toBe('/');
    expect(sharePath('/games/not-a-game')).toBeNull();
    expect(sharePath('https://evil.example/games/wing-it')).toBeNull();
    expect(sharePath('//evil.example')).toBeNull();
    expect(sharePath('/admin')).toBeNull();
  });

  it('keeps preview text short and clean', () => {
    expect(shareText('', 'x')).toBeNull();
    const t = shareText(`Wing It #2 \n 🐤 ${'x'.repeat(200)}`, 'line one\nline two');
    expect(t!.title.length).toBeLessThanOrEqual(100);
    expect(t!.title.startsWith('Wing It #2 🐤')).toBe(true);
    expect(t!.description).toBe('line one line two');
  });

  it('makes short, readable codes', () => {
    const codes = new Set(Array.from({ length: 500 }, () => newCode()));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{7}$/);
  });

  it('puts the shared text, minus links, on the picture card', () => {
    expect(cardLines('Wing It #2 🐤\n\nBest today: 34\nhttps://glitchboundstudio.com/games/wing-it')).toEqual(['Wing It #2 🐤', 'Best today: 34']);
  });
});

describe('picture card text', () => {
  // A canvas that measures 10 px per character, and (like many phones) emoji far too narrow.
  const ctx = { font: '800 50px Bricolage', measureText: (t: string) => ({ width: t.replace(/\p{Extended_Pictographic}|\ufe0f/gu, '').length * 10 }) } as unknown as CanvasRenderingContext2D;

  it('gives every emoji a full box, so centred lines stay on the card', () => {
    expect(lineWidth(ctx, 'abc')).toBe(30);
    expect(lineWidth(ctx, '⚔️ abc')).toBe(60 + 40);
    expect(lineWidth(ctx, '🟩🟩🟥')).toBe(180);
  });
});

