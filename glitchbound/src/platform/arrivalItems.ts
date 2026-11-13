import { AD_FREE_ID, GLOAMKNIGHT_ITEM, PRODUCTS, productIn, type Product } from '../catalog/shop';
import type { Me } from './apiTypes';
import type { Arrival, Seen } from './arrivals';

/**
 * What arrived (platform/arrivals.ts), and how it is said: the shop's items looked up in the live list (an item an
 * admin made, or renamed, reads as they saved it), the built-in list when the admins haven't saved one.
 */

/** A shop item by its id: in the live list, or one of the built-in ones. */
export const shopItem = (items: readonly Product[] | null | undefined, id: string): Product | undefined => (items ? productIn(items, id) : undefined) ?? productIn(PRODUCTS, id);

/** Sigilfall's items: its mounts and Wardrobe looks, and the Gloamknight Pack (the game shows those itself). */
export const isSigilfallItem = (p: Product): boolean => !!p.sigil || p.id === GLOAMKNIGHT_ITEM;

/**
 * What is new since `before` (null: the first look at this account, as the page loads or someone signs in, when only a
 * purchase this browser went to the checkout for counts). A pack's pieces come with it as one; an item that isn't in
 * the shop's lists, or was shown already, says nothing. An item is `given` when the account only has it as a gift.
 */
export function arrivalsBetween(before: Seen | null, me: Me, ctx: { items?: readonly Product[] | null; expected: ReadonlySet<string>; shown: ReadonlySet<string>; now?: number }): Arrival[] {
  const at = ctx.now ?? Date.now();
  const had = before && before.id === me.id ? before : null;
  const owned = me.owned ?? [];
  const fresh = owned.filter((id) => (had ? !had.owned.includes(id) : ctx.expected.has(id)));
  const inPacks = new Set(fresh.flatMap((id) => shopItem(ctx.items, id)?.includes ?? []));
  const out: Arrival[] = [];
  for (const id of fresh) {
    const p = shopItem(ctx.items, id);
    if (!p || inPacks.has(id) || ctx.shown.has(`item:${id}`)) continue;
    const given = !ctx.expected.has(id) && !!me.gifts?.includes(id);
    out.push({ key: `item:${id}`, kind: 'item', id, how: given ? 'given' : 'bought', game: isSigilfallItem(p) ? 'sigilfall' : null, at });
  }
  if (!had) return out;
  for (const t of me.sigilTitles ?? []) {
    if (had.titles.includes(t.id) || ctx.shown.has(`title:${t.id}`)) continue;
    out.push({ key: `title:${t.id}`, kind: 'title', id: t.id, how: 'given', game: 'sigilfall', name: t.name, fx: t.fx, at });
  }
  return out;
}

export type ArrivalSort = 'pack' | 'mount' | 'look' | 'border' | 'banner' | 'icon' | 'ad-free' | 'item' | 'title' | 'gm-mount' | 'gm-look' | 'gm-item';

/** An arrival in words. */
export interface ArrivalInfo {
  /** "It's yours!" */
  head: string;
  name: string;
  /** Thanks for a purchase, or who it's from. */
  line: string;
  /** Where to find it, as the site or the game says it ('' when there's nothing to find). */
  where: string;
  sort: ArrivalSort;
  product?: Product;
}

function sortOf(a: Arrival, p: Product | undefined): ArrivalSort {
  if (a.kind === 'title') return 'title';
  if (a.kind === 'gm') return a.what === 'mount' ? 'gm-mount' : a.what === 'look' ? 'gm-look' : 'gm-item';
  if (!p) return 'item';
  if (p.id === GLOAMKNIGHT_ITEM || p.includes) return 'pack';
  if (p.sigil) return p.sigil.kind;
  if (p.look) return p.look.kind;
  return p.id === AD_FREE_ID ? 'ad-free' : 'item';
}

/** Where it is, in the game's own words (`game`) or the site's. */
function whereOf(sort: ArrivalSort, hero: string, game: boolean): string {
  const inGame = game ? '' : ' in Sigilfall';
  switch (sort) {
    case 'mount':
      return `In every hero’s stable${inGame}.`;
    case 'look':
      return `In every hero’s Wardrobe${inGame}.`;
    case 'pack':
      return `Make a Gloamknight from the hero screen${inGame}.`;
    case 'title':
      return `Choose it under your name on the Hero page${inGame}.`;
    case 'gm-mount':
      return `In ${hero}’s stable${inGame}.`;
    case 'gm-look':
      return `In ${hero}’s Wardrobe${inGame}.`;
    case 'gm-item':
      return `In ${hero}’s bag${inGame}.`;
    case 'border':
    case 'banner':
    case 'icon':
      return game ? 'Wear it from your GlitchBound profile.' : 'Wear it from your profile.';
    case 'ad-free':
      return 'No more ad banners, on every device you sign in on.';
    default:
      return '';
  }
}

/** What to say about an arrival, on the site or in the game; null for an item no list has any more. */
export function arrivalInfo(a: Arrival, items: readonly Product[] | null | undefined, place: 'site' | 'game'): ArrivalInfo | null {
  const product = a.kind === 'item' ? shopItem(items, a.id) : undefined;
  if (a.kind === 'item' && !product) return null;
  const sort = sortOf(a, product);
  const name = product?.name ?? a.name ?? '';
  const head = a.kind === 'title' ? 'You’ve been given a title' : a.how === 'bought' ? 'It’s yours!' : 'A gift for you!';
  const line = a.kind === 'gm' ? 'From a Game Master.' : a.how === 'bought' ? 'Thanks for supporting GlitchBound.' : 'A gift from the GlitchBound team.';
  return { head, name, line, where: whereOf(sort, a.hero || 'your hero', place === 'game'), sort, product };
}
