import { BOSSES } from '../data/bosses';
import { BASE_DEFS, ITEM_DEFS, ITEMS } from '../data/items';
import { MOUNT_DEFS, MOUNTS, type MountDef } from '../data/mounts';
import { CAMPAIGN_END, WARDENS, wardenLookId } from '../data/wardens';
import { QUESTS } from '../data/quests';
import { REGIONS } from '../data/regions';
import type { ClassId, Item, ItemIcon, Material, RegionId, Rarity } from '../data/types';
import type { Character } from './character';
import { itemMat, itemTint } from './items';
import { ownedShopMounts, ownsShopItem, shopLook, shopMount } from './shopGoods';

/**
 * The Wardrobe and the mount collection (blueprint §6, COLLECTION_SYSTEM_DESIGN.md). A look is the
 * appearance of a head, chest or weapon item, kept for good once the hero has owned one; wearing a look
 * changes only what is drawn for that slot (the build never sees it). Mounts are owned for good once their
 * source is met. Pure functions over a Character.
 */

export type LookSlot = 'head' | 'chest' | 'weapon';
export const LOOK_SLOTS: LookSlot[] = ['head', 'chest', 'weapon'];

/** Worn over a slot: show the class's own bare look there (no helm, say) whatever is equipped. */
export const BARE_LOOK = 'bare';

export interface Look {
  id: string;
  slot: LookSlot;
  name: string;
  icon: ItemIcon;
  mat: Material;
  tint: string;
  /** Descriptive only: decides the trim, the gem and (on a chest) the cape, never a stat. */
  r: Rarity;
  /** The class that can wear it (class-only items), or anyone. */
  cls?: ClassId;
  /** Part of a set with models of its own: a Sigil-warden's armor (the class it was made for) or a shop set's id. */
  set?: string;
  /** A shop set's colors (main, trim, cloth, glow). */
  colors?: string[];
  /** A hand-made item's look (with a source), or a found piece's. */
  authored: boolean;
  /** From the site's shop (progress/shopGoods.ts): any class wears it, while the account owns it. */
  shop?: boolean;
}

const HEX = /^[0-9a-f]{6}$/;
const isLookSlot = (s: string): s is LookSlot => s === 'head' || s === 'chest' || s === 'weapon';

/**
 * A look's id for an item, or null for items that have none (rings, boots...). Hand-made items use their
 * id; found gear its base, its trim (rare or plain) and its dye, since that is all that shows.
 */
export function lookId(item: Item): string | null {
  const def = ITEM_DEFS[item.base];
  if (def) return isLookSlot(def.slot) ? def.id : null;
  const base = BASE_DEFS[item.base];
  if (!base || !isLookSlot(base.slot)) return null;
  return `gen:${base.id}:${item.r}:${itemTint(item).slice(1).toLowerCase()}`;
}

/** What found gear of each rarity is called in the Wardrobe (it looks different at each). */
const TRIM_NAME: Record<Rarity, string> = { common: '', uncommon: 'Fine ', rare: 'Trimmed ', epic: 'Royal ', legendary: 'Gilded ' };

const cache = new Map<string, Look | null>();

/** What a look id stands for, or null when it isn't one (a save from elsewhere, a removed item). */
export function lookOf(id: string): Look | null {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  let look: Look | null = null;
  const def = ITEM_DEFS[id];
  if (def && isLookSlot(def.slot)) {
    look = { id, slot: def.slot, name: def.name, icon: def.icon, mat: itemMat({ uid: id, base: id, r: def.rarity, il: 1, st: [] }), tint: def.tint, r: def.rarity, cls: def.cls, set: id.startsWith('warden-') ? def.cls : undefined, authored: true };
  } else if (id.startsWith('gen:')) {
    const [, baseId, trim, dye] = id.split(':');
    const base = baseId ? BASE_DEFS[baseId] : undefined;
    if (base && isLookSlot(base.slot) && trim && trim in TRIM_NAME && dye && HEX.test(dye)) {
      const rarity = trim as Rarity;
      const mat = itemMat({ uid: id, base: base.id, r: rarity, il: 1, st: [] });
      const tint = `#${dye}`;
      const dyed = base.slot !== 'weapon';
      look = { id, slot: base.slot, name: `${TRIM_NAME[rarity]}${dyed ? `${colorName(tint, mat)} ` : ''}${base.name}`, icon: base.icon, mat, tint, r: rarity, cls: base.cls, authored: false };
    }
  }
  cache.set(id, look);
  return look;
}

/** Whether a hero of this class can wear the look (class-only pieces stay with their class). */
export const lookFits = (look: Look, cls: ClassId): boolean => !look.cls || look.cls === cls;

/** A look the shop sells (and no hero can earn), or null. */
const shopOnly = (id: string): Look | null => (lookOf(id) ? null : (shopLook(id) ?? null));

/** Whether the look is the hero's to wear: earned for good, or the shop's while the account owns it. */
export const hasLook = (c: Pick<Character, 'looks'>, id: string): boolean => c.looks.includes(id) || (!!shopOnly(id) && ownsShopItem(id));

/** A shop look worn over a slot, while it's still owned. */
function shopWorn(c: Pick<Character, 'shopWorn'>, slot: LookSlot): Look | null {
  const id = c.shopWorn?.[slot];
  const look = id ? shopOnly(id) : null;
  return look && look.slot === slot && ownsShopItem(look.id) ? look : null;
}

/** The look worn over a slot right now, by its id (a shop look while it's owned, else the hero's own choice). */
export const wornId = (c: Pick<Character, 'worn' | 'shopWorn'>, slot: LookSlot): string | undefined => shopWorn(c, slot)?.id ?? c.worn[slot];

/** Adds the looks of these items to the hero's Wardrobe; returns the new ones. */
export function learnLooks(c: Character, items: Iterable<Item>): string[] {
  const added: string[] = [];
  for (const it of items) {
    const id = lookId(it);
    if (id && !c.looks.includes(id) && lookOf(id)) {
      c.looks.push(id);
      added.push(id);
    }
  }
  return added;
}

/**
 * Wears a look over a slot (or the bare look, or null for the equipped item's own). Refused for a look the
 * hero doesn't own, for another slot's look and for another class's.
 */
export function wearLook(c: Character, slot: LookSlot, id: string | null): boolean {
  // a shop look is kept apart from the hero's own choice: whatever happens to the purchase, that choice is still there
  const shop = id && id !== BARE_LOOK ? shopOnly(id) : null;
  if (shop) {
    if (shop.slot !== slot || !ownsShopItem(id!)) return false;
    c.shopWorn = { ...c.shopWorn, [slot]: id! };
    return true;
  }
  const dropShop = (): void => {
    if (!c.shopWorn?.[slot]) return;
    const rest = { ...c.shopWorn };
    delete rest[slot];
    if (Object.keys(rest).length) c.shopWorn = rest;
    else delete c.shopWorn;
  };
  if (id === null) {
    delete c.worn[slot];
    dropShop();
    return true;
  }
  if (id === BARE_LOOK) {
    if (slot === 'weapon') return false;
    c.worn[slot] = BARE_LOOK;
    dropShop();
    return true;
  }
  const look = lookOf(id);
  if (!look || look.slot !== slot || !c.looks.includes(id) || !lookFits(look, c.cls)) return false;
  c.worn[slot] = id;
  dropShop();
  return true;
}

/** The looks a hero shows over their gear right now: owned, fitting and of the right slot only. */
export function wornLooks(c: Pick<Character, 'cls' | 'looks' | 'worn' | 'shopWorn'>): Partial<Record<LookSlot, Look | 'bare'>> {
  const out: Partial<Record<LookSlot, Look | 'bare'>> = {};
  for (const slot of LOOK_SLOTS) {
    const shop = shopWorn(c, slot);
    if (shop) {
      out[slot] = shop;
      continue;
    }
    const id = c.worn[slot];
    if (!id) continue;
    if (id === BARE_LOOK) {
      if (slot !== 'weapon') out[slot] = 'bare';
      continue;
    }
    const look = lookOf(id);
    if (look && look.slot === slot && c.looks.includes(id) && lookFits(look, c.cls)) out[slot] = look;
  }
  return out;
}

/**
 * Drops what a save can't back up: unknown looks, and worn looks the hero doesn't own or can't wear. (A shop look is
 * never among the hero's own: its purchase is on the account, asked each time, and a save can't say it was bought.)
 */
export function tidyWardrobe(c: Character): void {
  c.looks = [...new Set(c.looks.filter((id) => !!lookOf(id)))];
  for (const slot of LOOK_SLOTS) {
    const id = c.worn[slot];
    if (id === undefined) continue;
    if (id === BARE_LOOK ? slot === 'weapon' : !wornLooks({ cls: c.cls, looks: c.looks, worn: { [slot]: id } })[slot]) delete c.worn[slot];
  }
}

/* --------------------------------------------------------- where looks come from */

let sources: Map<string, { quest?: string; boss?: string }> | null = null;

/** Which quest rewards an item, and which boss drops it (first found wins). */
function sourceIndex(): Map<string, { quest?: string; boss?: string }> {
  if (sources) return sources;
  const m = new Map<string, { quest?: string; boss?: string }>();
  for (const q of QUESTS) {
    const it = q.reward.item;
    if (typeof it === 'string' && !m.get(it)?.quest) m.set(it, { ...m.get(it), quest: q.id });
  }
  for (const b of Object.values(BOSSES)) {
    for (const list of [...Object.values(b.first), ...Object.values(b.drops.items)]) {
      for (const it of list ?? []) if (!m.get(it)?.boss) m.set(it, { ...m.get(it), boss: b.id });
    }
  }
  sources = m;
  return m;
}

/**
 * Where a hand-made look comes from, said without spoiling the story: a quest is named once the hero has
 * been given it, a boss always (bosses are met in the open).
 */
export function lookSource(c: Pick<Character, 'quests'>, id: string): string {
  const def = ITEM_DEFS[id];
  if (!def && shopOnly(id)) return 'From the shop: yours on every hero of your account, for any class';
  if (!def) return 'Found gear';
  if (id.startsWith('warden-')) return 'Finish the story with this class';
  const src = sourceIndex().get(id);
  if (src?.boss) {
    const b = BOSSES[src.boss]!;
    return `Dropped by ${b.name}, ${b.title}`;
  }
  if (src?.quest) {
    const q = QUESTS.find((x) => x.id === src.quest)!;
    return c.quests[q.id] ? `Reward: ${q.name}` : 'A quest’s reward, later in the story';
  }
  return def.special ? 'A rare find' : `A rare drop from level ${def.minLevel}`;
}

/** Every hand-made look a class could own, for the Wardrobe's locked silhouettes. */
export function authoredLooks(cls: ClassId, slot: LookSlot): Look[] {
  return ITEMS.filter((d) => d.slot === slot && (!d.cls || d.cls === cls))
    .map((d) => lookOf(d.id))
    .filter((l): l is Look => !!l);
}

/* ------------------------------------------------------------------ mounts */

/** Nobody rides before this: Dunmore's riders bring the first horses to the camp (Act I, level 20). */
export const FIRST_RIDE = 'camp-riders';

/** Whether the hero rides at all yet: no mount of any source is earned, chosen or called before the riders come. */
export const ridingOpen = (c: Pick<Character, 'quests'>): boolean => c.quests[FIRST_RIDE]?.state === 'done';

/** Why riding is still shut, in the player's words ("Riding opens with Riders for Briarhollow (level 20)"). */
export function ridingLocked(): string {
  const q = QUESTS.find((x) => x.id === FIRST_RIDE);
  return q ? `Riding opens with ${q.name}${q.level ? ` (level ${q.level})` : ''}` : 'Riding opens later in the story';
}

/** Whether the hero can call a mount at all: riding is open and they have one, earned or the shop's (the mount key and button). */
export const hasMount = (c: Pick<Character, 'quests' | 'mounts'>): boolean => ridingOpen(c) && (c.mounts.length > 0 || ownedShopMounts().length > 0);

/**
 * Whether the hero has met a mount's source. Every source waits for the first ride: a hero still on foot in
 * the story earns nothing yet, and gets what they have met the moment the riders come.
 */
export function mountEarned(c: Pick<Character, 'quests' | 'perks' | 'clears' | 'cls'>, m: MountDef): boolean {
  if (!ridingOpen(c)) return false;
  const s = m.source;
  // (bought, not earned: progress/shopGoods.ts says while the purchase stands, and it never joins the hero's own)
  if (s.kind === 'shop') return false;
  if (s.kind === 'campaign') return s.cls === c.cls && c.quests[CAMPAIGN_END]?.state === 'done';
  if (s.kind === 'shelf') return shelfPoints >= s.points;
  if (s.kind === 'quest') return c.quests[s.quest]?.state === 'done';
  if (s.kind === 'perk') return c.perks.includes(s.perk);
  return s.regions.every((r) => Object.entries(c.clears).some(([k, n]) => n > 0 && k.startsWith(`${r}:`) && Number(k.slice(r.length + 1)) >= s.tier));
}

/** The player's points on the site's Trophy Shelf, as last heard (0 for a guest or offline). */
let shelfPoints = 0;
export const setShelfPoints = (n: number): void => {
  shelfPoints = n;
};

/** Whether this hero has seen the whole story through. */
export const campaignDone = (c: Pick<Character, 'quests'>): boolean => c.quests[CAMPAIGN_END]?.state === 'done';

/** The title a hero carries: a warden's, once the story is done. */
export const heroTitle = (c: Pick<Character, 'quests' | 'cls'>): string | null => (campaignDone(c) ? WARDENS[c.cls].title : null);

/** The level that opens the Rift Trials for a hero who hasn't cleared a dungeon yet. */
export const RIFT_LEVEL = 20;

/** A hero's first Riftstone comes with the first dungeon they clear, or at level 20, whichever is sooner. */
export function syncRift(c: Character): boolean {
  if (c.keystone >= 1) return false;
  const earned = c.level >= RIFT_LEVEL || Object.entries(c.clears).some(([k, n]) => n > 0 && REGIONS[k.split(':')[0] as RegionId]?.kind === 'dungeon');
  if (earned) c.keystone = 1;
  return earned;
}

/** A hero who has finished the story wears their sigil's armor when they choose to; returns true when it just came. */
export function grantWarden(c: Character): boolean {
  if (!campaignDone(c)) return false;
  let added = false;
  for (const slot of ['head', 'chest'] as const) {
    const id = wardenLookId(c.cls, slot);
    if (!c.looks.includes(id)) {
      c.looks.push(id);
      added = true;
    }
  }
  return added;
}

/** Gives the hero every mount they have earned and don't own yet; returns the new ones. */
export function grantMounts(c: Character): MountDef[] {
  const added: MountDef[] = [];
  for (const m of MOUNTS) {
    if (!c.mounts.includes(m.id) && mountEarned(c, m)) {
      c.mounts.push(m.id);
      added.push(m);
    }
  }
  // the first mount is the one ridden (once there is riding: a mount kept from before waits unchosen)
  if (!c.mount && c.mounts.length && ridingOpen(c)) c.mount = c.mounts[0]!;
  return added;
}

/** A mount by its id: one of the game's, or one the shop sells. */
export const mountDef = (id: string): MountDef | undefined => MOUNT_DEFS[id] ?? shopMount(id);

/** The shop's mounts this hero can ride now: owned by the account, once the story has horses in it. */
export const shopMountsFor = (c: Pick<Character, 'quests'>): MountDef[] => (ridingOpen(c) ? ownedShopMounts() : []);

/** Whether the hero can ride this mount now: riding is open, and it's earned for good or the shop's while the account owns it. */
export function canRide(c: Pick<Character, 'quests' | 'mounts'>, id: string): boolean {
  if (!ridingOpen(c)) return false;
  if (MOUNT_DEFS[id]) return c.mounts.includes(id);
  return !!shopMount(id) && ownsShopItem(id);
}

/** The mount the mount key calls: a shop mount chosen while it's owned, else the hero's own choice (none before the first ride). */
export function riddenMount(c: Pick<Character, 'quests' | 'mounts' | 'mount' | 'shopMount'>): string | null {
  if (c.shopMount && canRide(c, c.shopMount)) return c.shopMount;
  return c.mount && canRide(c, c.mount) ? c.mount : null;
}

/** Chooses the mount the mount key summons (refused before the first ride). A shop mount is kept apart, so the hero's own choice outlasts a refund. */
export function chooseMount(c: Character, id: string): boolean {
  if (!canRide(c, id)) return false;
  if (!MOUNT_DEFS[id]) {
    c.shopMount = id;
    return true;
  }
  c.mount = id;
  delete c.shopMount;
  return true;
}

/* ------------------------------------------------------------------ colors */

/** A plain word for a dye (generated pieces are named by it: "Teal Robe"). */
export function colorName(hex: string, mat?: Material): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.18) {
    if (mat === 'mail' || mat === 'plate') return l > 0.62 ? 'Bright' : l > 0.5 ? 'Steel' : 'Dark';
    return l > 0.75 ? 'Undyed' : l > 0.35 ? 'Grey' : 'Charcoal';
  }
  const sector = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  const h = (sector * 60 + 360) % 360;
  if (h < 15 || h >= 345) return l < 0.35 ? 'Oxblood' : 'Crimson';
  if (h < 45) return s < 0.5 || l < 0.4 ? 'Brown' : 'Amber';
  if (h < 65) return 'Gold';
  if (h < 160) return l < 0.3 ? 'Moss' : 'Green';
  if (h < 200) return 'Teal';
  if (h < 250) return 'Blue';
  if (h < 290) return 'Violet';
  return l < 0.35 ? 'Wine' : 'Plum';
}
