import { describe, expect, it } from 'vitest';
import { cardInk } from '../src/components/PartyCards';
import { PARTY_GAMES } from '../src/party/catalog';

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
};
const ratio = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('party cards text color (PU-13)', () => {
  it('white on the Impostor violet, dark ink on the bright fills', () => {
    expect(cardInk('#7b4dff')).toBe('#ffffff');
    expect(cardInk('#ff8a1f')).toBe('#1d1238');
    expect(cardInk('nope')).toBe('#1d1238');
  });

  it('every party game card reads at 4.5:1 or better', () => {
    for (const g of PARTY_GAMES) expect(ratio(g.color, cardInk(g.color)), g.id).toBeGreaterThanOrEqual(4.5);
  });
});
