/** The Gloamknight is sold in the shop: playable once bought (or by an admin, to test), every other class is free. */
import { describe, expect, it, vi } from 'vitest';

// (the class cards' portraits need a canvas, which the test page lacks)
vi.mock('../src/games/sigilfall/render/sprites', async (original) => ({ ...(await original<typeof import('../src/games/sigilfall/render/sprites')>()), heroDollUrl: () => '' }));
import { breaksRules, GLOAMKNIGHT_ITEM, isBuiltIn, PRODUCTS, productIn, sanitizeProducts, withIncluded } from '../src/catalog/shop';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { classOpen, heroSlots, PAID_CLASSES } from '../src/games/sigilfall/progress/paidClasses';

describe('the paid class', () => {
  it('is the Gloamknight alone, and every other class is free to anyone, guests too', () => {
    expect(Object.keys(PAID_CLASSES)).toEqual(['gloamknight']);
    for (const cls of CLASS_IDS.filter((c) => c !== 'gloamknight')) expect(classOpen(cls, null)).toBe(true);
  });

  it('opens with its purchase, closes when it’s refunded, and an admin can always test it', () => {
    expect(classOpen('gloamknight', null)).toBe(false);
    expect(classOpen('gloamknight', { owned: [] })).toBe(false);
    expect(classOpen('gloamknight', { owned: ['ad-free'] })).toBe(false);
    expect(classOpen('gloamknight', { owned: [GLOAMKNIGHT_ITEM] })).toBe(true);
    expect(classOpen('gloamknight', { owned: [], isAdmin: true })).toBe(true);
  });

  it('is a built-in shop item at its full price, kept in any saved list, and follows the shop’s word rules', () => {
    const p = productIn(PRODUCTS, GLOAMKNIGHT_ITEM)!;
    expect(p).toMatchObject({ name: 'Gloamknight Pack', cents: 999 });
    expect(p.later).toBeUndefined();
    expect(breaksRules(`${p.name} ${p.blurb}`)).toBe(false);
    expect(isBuiltIn(GLOAMKNIGHT_ITEM)).toBe(true);
    expect(sanitizeProducts([]).map((x) => x.id)).toContain(GLOAMKNIGHT_ITEM);
    // an admin's price and state stay; the item itself can't be dropped
    expect(productIn(sanitizeProducts([{ ...p, cents: 699, hidden: true }]), GLOAMKNIGHT_ITEM)).toMatchObject({ cents: 699, hidden: true });
  });
});

describe('the pack', () => {
  it('gives its own looks, a mount and armor, which aren’t sold on their own', () => {
    const pack = productIn(PRODUCTS, GLOAMKNIGHT_ITEM)!;
    expect(pack.includes).toEqual(['sigilfall-duskborn-helm', 'sigilfall-duskborn-plate', 'sigilfall-gloamwing-drake', 'border-gloam', 'banner-gloam']);
    for (const id of pack.includes!) {
      const part = productIn(PRODUCTS, id)!;
      expect(part.hidden, id).toBe(true);
      expect(part.look ?? part.sigil, id).toBeTruthy();
      expect(breaksRules(`${part.name} ${part.blurb}`), id).toBe(false);
    }
    expect(withIncluded([GLOAMKNIGHT_ITEM]).sort()).toEqual([GLOAMKNIGHT_ITEM, ...pack.includes!].sort());
    expect(withIncluded(['ad-free'])).toEqual(['ad-free']);
    // the pack's code says what it gives, whatever a saved list sends
    expect(productIn(sanitizeProducts([{ ...pack, includes: ['ad-free'] }]), GLOAMKNIGHT_ITEM)!.includes).toEqual(pack.includes);
  });

  it('opens two more hero slots, for its owner and an admin', () => {
    expect(heroSlots(null)).toBe(3);
    expect(heroSlots({ owned: ['ad-free'] })).toBe(3);
    expect(heroSlots({ owned: [GLOAMKNIGHT_ITEM] })).toBe(5);
    expect(heroSlots({ isAdmin: true })).toBe(5);
  });
});

describe('making a hero', () => {
  it('shows the Gloamknight with its price, and sends a guest to the shop instead of making one', async () => {
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
    const { createElement } = await import('react');
    // a canvas that draws nothing, as the other game screen tests use
    const fake: object = new Proxy({}, { get: (_t, k) => (k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) }) : k === 'createImageData' ? (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) }) : k === 'measureText' ? () => ({ width: 8 }) : () => fake), set: () => true });
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => fake) as unknown as HTMLCanvasElement['getContext'];
    const { CreateScreen } = await import('../src/games/sigilfall/ui/Title');
    const made: string[] = [];
    const engine = { ui: { createSlot: 0 }, defaultName: 'Tester', asksForTips: false, toTitle: () => undefined, createHero: (_s: number, cls: string) => made.push(cls) };
    render(createElement(CreateScreen, { engine: engine as never }));
    expect(screen.getByText('Shop · €9.99')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Gloamknight/ }));
    expect(screen.queryByRole('button', { name: /Begin as/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in to unlock it in the shop' }).getAttribute('href')).toBe('/shop');
    // a free class is made as before
    fireEvent.click(screen.getByRole('radio', { name: /Warrior/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin as Warrior' }));
    expect(made).toEqual(['warrior']);
    cleanup();
    HTMLCanvasElement.prototype.getContext = real;
  });
});
