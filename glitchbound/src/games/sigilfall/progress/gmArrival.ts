import { addArrival, type Arrival } from '../../../platform/arrivals';
import { ITEM_DEFS } from '../data/items';
import { MOUNT_DEFS } from '../data/mounts';
import { RARITIES, type Rarity } from '../data/types';
import { heroFor, type GmOrder } from './gm';
import type { SaveFile } from './save';
import { lookOf } from './wardrobe';

/**
 * A Game Master's gift that is a thing (a mount, a Wardrobe look, an item in the bag) is said as anything else a player
 * receives is: with the card (ui/Arrival.tsx), wherever the player is, not only as a toast in the world.
 */

/** What a carried-out order gave, if it was a thing: its sort, and its name. */
export function gmThing(o: Pick<GmOrder, 'kind' | 'payload'>): { what: NonNullable<Arrival['what']>; id: string; name: string } | null {
  const id = typeof o.payload.id === 'string' ? o.payload.id : '';
  switch (o.kind) {
    case 'mount': {
      const m = MOUNT_DEFS[id];
      return m ? { what: 'mount', id, name: m.name } : null;
    }
    case 'look': {
      const l = lookOf(id);
      return l ? { what: 'look', id, name: l.name } : null;
    }
    case 'item': {
      const d = ITEM_DEFS[id];
      return d ? { what: 'item', id, name: d.name } : null;
    }
    case 'gear': {
      const r = o.payload.rarity as Rarity;
      return RARITIES.includes(r) ? { what: 'item', id: `gear-${r}`, name: `${r[0]!.toUpperCase()}${r.slice(1)} gear` } : null;
    }
    default:
      return null;
  }
}

/** Says a carried-out order's gift with the card, and the hero it went to. True when it was a thing (no toast then). */
export function announceGm(save: SaveFile, o: GmOrder): boolean {
  const thing = gmThing(o);
  if (!thing) return false;
  addArrival({ key: `gm:${o.id}`, kind: 'gm', id: thing.id, how: 'given', game: 'sigilfall', name: thing.name, what: thing.what, hero: heroFor(save, o)?.name, at: Date.now() });
  return true;
}
