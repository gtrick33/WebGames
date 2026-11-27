import { useState } from 'react';
import type { SigilEngine } from '../engine';
import { bagWorth, cantEquip, type Character } from '../progress/character';
import { compareGear } from '../progress/compare';
import { itemSlot } from '../progress/items';
import { fmt, RARITY_NAME } from './common';

/** The finer pieces in a bag, named before they are sold with the rest: "1 legendary, 2 epic and 3 upgrades". */
export function sellAllNote(h: Character): string {
  const parts: string[] = [];
  for (const r of ['set', 'legendary', 'epic', 'rare'] as const) {
    const n = h.bag.filter((it) => it.r === r).length;
    if (n) parts.push(r === 'set' ? `${n} set piece${n === 1 ? '' : 's'}` : `${n} ${RARITY_NAME[r].toLowerCase()}`);
  }
  // (the bag's own upgrade arrow: a piece this hero can wear that beats what is worn)
  const up = h.bag.filter((it) => itemSlot(it) && !cantEquip(h, it) && compareGear(h, it).better).length;
  if (up) parts.push(`${up} upgrade${up === 1 ? '' : 's'}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

/**
 * Sell all (the owner, 2026-11-27): the whole bag sold at once, each piece for what it fetches alone, in the bag's own
 * tab and at every vendor who buys. The first tap asks, with the gold it comes to and the finer pieces that would go
 * with it; the second sells. Nothing shown with an empty bag.
 */
export function SellAll({ engine, onSold }: { engine: SigilEngine; onSold?: (got: { n: number; gold: number }) => void }) {
  const h = engine.hero!;
  // (the bag the question was asked about: one that has changed under it is asked about afresh)
  const [askedOf, setAskedOf] = useState<string | null>(null);
  const n = h.bag.length;
  const these = h.bag.map((it) => it.uid).join(' ');
  const asking = askedOf === these;
  const setAsking = (on: boolean): void => setAskedOf(on ? these : null);
  if (!n) return null;
  const gold = bagWorth(h);
  if (!asking)
    return (
      <button className="rb-btn is-small rb-sellall" onClick={() => setAsking(true)} aria-label={`Sell all ${n} item${n === 1 ? '' : 's'} in your bag for ${fmt(gold)} gold`}>
        Sell all · {fmt(gold)} g
      </button>
    );
  const note = sellAllNote(h);
  return (
    <div className="rb-sellall-ask" role="group" aria-label="Sell all?">
      <button
        className="rb-btn is-small is-danger"
        onClick={() => {
          setAsking(false);
          const got = engine.salvageAll();
          if (got.n) onSold?.(got);
        }}
      >
        {n === 1 ? `Sell 1 item for ${fmt(gold)} gold?` : `Sell all ${n} items for ${fmt(gold)} gold?`}
      </button>
      <button className="rb-btn is-small" onClick={() => setAsking(false)}>
        Cancel
      </button>
      {note && <p className="rb-warn rb-small">Includes {note}.</p>}
    </div>
  );
}
