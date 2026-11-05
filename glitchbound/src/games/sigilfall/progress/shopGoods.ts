import { sigilColors, type SigilLookSpec, type SigilMountSpec, type SigilSet, type SigilSpec } from '../../../catalog/sigilItems';
import type { MountDef, MountExtra } from '../data/mounts';
import type { ItemIcon, Material } from '../data/types';
import type { Look } from './wardrobe';

/**
 * Sigilfall's items from the site's shop (src/catalog/sigilItems.ts): mounts and Wardrobe looks, made from the live
 * shop list, so an item an admin makes is in the game as soon as it's saved. Who owns what comes from the account
 * (`owned`, the purchases that stand) each time it's asked: none of it is ever written into a save, so a refund takes
 * it away and a save brought from another device can't keep it. Every hero on the account has them alike.
 */

/** What a shop item is, once the game has made it up. */
export interface Goods {
  mounts: readonly MountDef[];
  looks: readonly Look[];
  owned: ReadonlySet<string>;
}

/** The built-in mounts' lore, for the collection (an admin's mount reads its shop text). */
const LORE: Record<string, string> = {
  'sigilfall-crownforged-wyrm': 'Forged, the smiths swear, not hatched: plate by plate, in a furnace under a mountain, for a king who never came back for it. It has decided you will do.',
  'sigilfall-galecrest-drake': 'It was born in the eye of a storm and has been chasing the next one ever since. The crystals on its back hum before the thunder does.',
  'sigilfall-runetusk-boar': 'The runes on its tusks are old dwarven words for “keep going”. It has never needed reminding.',
  'sigilfall-cinderhorn-hart': 'Its antlers caught fire in the first forest it ever ran through, and it liked the light too much to put them out.',
  'sigilfall-moonglass-hart': 'Nobody has seen it drink, or sleep, or leave tracks in the snow. Its antlers ring softly when the moon is up.',
};

/** Where a shop mount comes from, as the collection says it. */
export const SHOP_FROM = 'From the shop: yours on every hero of your account';

/** A shop mount as a mount (its id is the shop item's). */
export function shopMountOf(id: string, name: string, blurb: string, spec: SigilMountSpec): MountDef {
  const extras = spec.extras as MountExtra[];
  const plated = extras.includes('plates');
  return {
    id,
    name,
    lore: LORE[id] ?? blurb,
    from: SHOP_FROM,
    source: { kind: 'shop', item: id },
    body: spec.body,
    coat: spec.coat,
    mane: spec.mane,
    tack: spec.tack,
    plate: spec.plate,
    extras,
    // (what the painted pictures and the older pieces of the 3D kit know it by)
    ...(plated && spec.body !== 'drake' ? { barding: spec.plate } : {}),
    ...(spec.body === 'deer' ? { antlers: extras.includes('elk') ? ('elk' as const) : ('hart' as const) } : {}),
    ...(spec.body === 'boar' ? { tusks: true } : {}),
    ...(spec.glow ? { glow: { ...spec.glow } } : {}),
    tier: 'shop',
  };
}

/** How each set's pieces show in the Wardrobe's tiles and in the painted pictures. */
const SET_SHOWN: Record<SigilSet, Record<'head' | 'chest', { icon: ItemIcon; mat: Material }>> = {
  crownforged: { head: { icon: 'helm', mat: 'plate' }, chest: { icon: 'plate', mat: 'plate' } },
  celestine: { head: { icon: 'crown', mat: 'gold' }, chest: { icon: 'robe', mat: 'cloth' } },
  gloamquill: { head: { icon: 'hood', mat: 'leather' }, chest: { icon: 'jerkin', mat: 'leather' } },
};

/** A shop look as a Wardrobe look (its id is the shop item's): any class wears it. */
export function shopLookOf(id: string, name: string, spec: SigilLookSpec): Look {
  const colors = sigilColors(spec);
  const shown = SET_SHOWN[spec.set][spec.slot];
  // (a pale set shows its trim in the tile, so it isn't a white blank)
  const tint = spec.set === 'celestine' ? colors[2]! : colors[0]!;
  return { id, slot: spec.slot, name, icon: shown.icon, mat: shown.mat, tint, r: 'legendary', set: spec.set, colors, authored: true, shop: true };
}

/** The game's view of a list of shop items and what this account owns of them. */
export function goodsFrom(items: readonly { id: string; name: string; blurb: string; sigil?: SigilSpec }[], owned: readonly string[]): Goods {
  const mounts: MountDef[] = [];
  const looks: Look[] = [];
  for (const p of items) {
    if (p.sigil?.kind === 'mount') mounts.push(shopMountOf(p.id, p.name, p.blurb, p.sigil));
    else if (p.sigil?.kind === 'look') looks.push(shopLookOf(p.id, p.name, p.sigil));
  }
  return { mounts, looks, owned: new Set(owned) };
}

let now: Goods = goodsFrom([], []);

/** What the shop sells and what this account owns, as last heard (nothing for a guest, or before the site answers). */
export function setShopGoods(items: readonly { id: string; name: string; blurb: string; sigil?: SigilSpec }[], owned: readonly string[]): void {
  now = goodsFrom(items, owned);
}

export const ownsShopItem = (id: string): boolean => now.owned.has(id);

/** A shop mount by its id (owned or not), or undefined. */
export const shopMount = (id: string): MountDef | undefined => now.mounts.find((m) => m.id === id);

/** A shop look by its id (owned or not), or undefined. */
export const shopLook = (id: string): Look | undefined => now.looks.find((l) => l.id === id);

/** The shop's mounts this account owns now. */
export const ownedShopMounts = (): MountDef[] => now.mounts.filter((m) => now.owned.has(m.id));

/** The shop's looks this account owns now. */
export const ownedShopLooks = (): Look[] => now.looks.filter((l) => now.owned.has(l.id));
