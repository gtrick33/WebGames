import { compareGear, gearRole } from '../progress/compare';
import { fmtStat, STAT_LABEL } from '../progress/describe';
import { itemName, itemSlot } from '../progress/items';
import { rarityColor } from '../render/renderer';
import type { SigilEngine } from '../engine';
import { ItemIcon } from './common';
import { SLOT_LABEL } from './Panels';

/** A stat's words cut short for the strip ("+3% Critical chance" is "+3% Crit"; the full name is its tooltip). */
const short = (s: string): string =>
  s
    .replace('Critical chance', 'Crit')
    .replace('Critical damage', 'Crit dmg')
    .replace(' damage and health', '')
    .replace(/ damage$/, '')
    .replace(' per second', '/s')
    .replace('Ultimate charge', 'Ult charge');

const ROLE_WORD = { tank: 'for a tank', healer: 'for a healer', damage: 'for your damage' } as const;

/**
 * On a touch screen, a piece just picked up that this hero would be better off wearing (progress/compare.ts) asks to be
 * worn: one small strip with its picture and name in its rarity's color, the two changes against what is worn that
 * matter most to this hero's specialization (gains in green, losses in red), Equip and a cross for later. At the top of
 * the picture, clear of the thumbs; it goes by itself if it isn't answered (the engine's EQUIP_ASK_MS).
 */
export function EquipAsk({ engine }: { engine: SigilEngine }) {
  const ask = engine.ui.equipAsk;
  const h = engine.hero;
  const item = ask && h ? h.bag.find((i) => i.uid === ask.uid) : undefined;
  if (!ask || !h || !item) return null;
  const cmp = compareGear(h, item);
  // (the two changes that matter most to this hero: a strip, not a card. The owner, 2026-11-21: "make the item pop up
  // way smaller")
  const shown = cmp.deltas.slice(0, 2);
  const pct = Math.round(cmp.gain * 100);
  return (
    <div className="rb-equipask" key={`equip:${ask.id}`} role="dialog" aria-label={`Equip ${itemName(item)}? ${SLOT_LABEL[itemSlot(item)]}, ${!cmp.worn ? 'empty slot' : `${Math.min(pct, 999)}% better ${ROLE_WORD[gearRole(h)]}`}`} style={{ ['--rc' as string]: rarityColor(item.r) }}>
      <ItemIcon item={item} size={26} />
      <div className="rb-equipask-name">
        <strong>{itemName(item)}</strong>
        <span className="rb-equipask-deltas">
          {shown.map((d) => (
            <i key={d.stat} className={d.n > 0 ? 'is-up' : 'is-down'} title={STAT_LABEL[d.stat]}>
              {short(d.n > 0 ? fmtStat(d.stat, d.n) : fmtStat(d.stat, -d.n).replace(/^\+/, '−'))}
            </i>
          ))}
        </span>
      </div>
      {/* (answered as the finger lifts, not on the click that follows it: on a phone in a fight the click was often
          lost, and the cross, a speck, was barely hit. The owner, 2026-11-24: "i can barely click the X, make it more
          responsive". A second answer, the click after it, finds the strip gone) */}
      <button className="rb-equipask-yes" onPointerUp={(e) => e.pointerType !== 'mouse' && engine.answerEquip(true)} onClick={() => engine.answerEquip(true)}>
        Equip
      </button>
      <button className="rb-equipask-no" onPointerUp={(e) => e.pointerType !== 'mouse' && engine.answerEquip(false)} onClick={() => engine.answerEquip(false)} aria-label="Later">
        ✕
      </button>
    </div>
  );
}
