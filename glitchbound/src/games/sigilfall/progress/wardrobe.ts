import { BOSSES } from '../data/bosses';
import { BASE_DEFS, ITEM_DEFS, ITEMS } from '../data/items';
import { MOUNT_DEFS, MOUNTS, type MountDef } from '../data/mounts';
import { QUESTS } from '../data/quests';
import type { ClassId, Item, ItemIcon, Material, Rarity } from '../data/types';
import type { Character } from './character';
import { itemMat, itemTint } from './items';

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
  /** A hand-made item's look (with a source), or a found piece's. */
  authored: boolean;
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
  return `gen:${base.id}:${trimOf(item.r)}:${itemTint(item).slice(1).toLowerCase()}`;
}

/** Found gear shows two trims only: plain, or rare (gold trim is for hand-made pieces). */
const trimOf = (r: Rarity): 'common' | 'rare' => (r === 'common' || r === 'uncommon' ? 'common' : 'rare');

const cache = new Map<string, Look | null>();

/** What a look id stands for, or null when it isn't one (a save from elsewhere, a removed item). */
export function lookOf(id: string): Look | null {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  let look: Look | null = null;
  const def = ITEM_DEFS[id];
  if (def && isLookSlot(def.slot)) {
    look = { id, slot: def.slot, name: def.name, icon: def.icon, mat: itemMat({ uid: id, base: id, r: def.rarity, il: 1, st: [] }), tint: def.tint, r: def.rarity, cls: def.cls, authored: true };
  } else if (id.startsWith('gen:')) {
    const [, baseId, trim, dye] = id.split(':');
    const base = baseId ? BASE_DEFS[baseId] : undefined;
    if (base && isLookSlot(base.slot) && (trim === 'common' || trim === 'rare') && dye && HEX.test(dye)) {
      const mat = itemMat({ uid: id, base: base.id, r: trim, il: 1, st: [] });
      const tint = `#${dye}`;
      const dyed = base.slot !== 'weapon';
      look = { id, slot: base.slot, name: `${trim === 'rare' ? 'Trimmed ' : ''}${dyed ? `${colorName(tint, mat)} ` : ''}${base.name}`, icon: base.icon, mat, tint, r: trim, cls: base.cls, authored: false };
    }
  }
  cache.set(id, look);
  return look;
}

/** Whether a hero of this class can wear the look (class-only pieces stay with their class). */
export const lookFits = (look: Look, cls: ClassId): boolean => !look.cls || look.cls === cls;

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
  if (id === null) {
    delete c.worn[slot];
    return true;
  }
  if (id === BARE_LOOK) {
    if (slot === 'weapon') return false;
    c.worn[slot] = BARE_LOOK;
    return true;
  }
  const look = lookOf(id);
  if (!look || look.slot !== slot || !c.looks.includes(id) || !lookFits(look, c.cls)) return false;
  c.worn[slot] = id;
  return true;
}

/** The looks a hero shows over their gear right now: owned, fitting and of the right slot only. */
export function wornLooks(c: Pick<Character, 'cls' | 'looks' | 'worn'>): Partial<Record<LookSlot, Look | 'bare'>> {
  const out: Partial<Record<LookSlot, Look | 'bare'>> = {};
  for (const slot of LOOK_SLOTS) {
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

/** Drops what a save can't back up: unknown looks, and worn looks the hero doesn't own or can't wear. */
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
  if (!def) return 'Found gear';
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

/** Whether the hero has met a mount's source. */
export function mountEarned(c: Pick<Character, 'quests' | 'perks' | 'clears'>, m: MountDef): boolean {
  const s = m.source;
  if (s.kind === 'quest') return c.quests[s.quest]?.state === 'done';
  if (s.kind === 'perk') return c.perks.includes(s.perk);
  return s.regions.every((r) => Object.entries(c.clears).some(([k, n]) => n > 0 && k.startsWith(`${r}:`) && Number(k.slice(r.length + 1)) >= s.tier));
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
  // the first mount is the one ridden
  if (!c.mount && c.mounts.length) c.mount = c.mounts[0]!;
  return added;
}

/** Chooses the mount the mount key summons. */
export function chooseMount(c: Character, id: string): boolean {
  if (!c.mounts.includes(id) || !MOUNT_DEFS[id]) return false;
  c.mount = id;
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
