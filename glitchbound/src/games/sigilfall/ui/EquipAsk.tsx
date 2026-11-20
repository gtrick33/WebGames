import { compareGear, gearRole } from '../progress/compare';
import { fmtStat, STAT_LABEL } from '../progress/describe';
import { itemName, itemSlot } from '../progress/items';
import { rarityColor } from '../render/renderer';
import type { SigilEngine } from '../engine';
import { ItemIcon } from './common';
import { SLOT_LABEL } from './Panels';

const ROLE_WORD = { tank: 'for a tank', healer: 'for a healer', damage: 'for your damage' } as const;

/**
 * On a touch screen, a piece just picked up that this hero would be better off wearing (progress/compare.ts) asks to be
 * worn: its picture and name in its rarity's color, what it changes against what is worn (what matters to this hero's
 * specialization first, gains in green and losses in red), and two buttons, Equip and Later. Small, at the top of the
 * picture, clear of the thumbs; it goes by itself if it isn't answered (the engine's EQUIP_ASK_MS).
 */
export function EquipAsk({ engine }: { engine: SigilEngine }) {
  const ask = engine.ui.equipAsk;
  const h = engine.hero;
  const item = ask && h ? h.bag.find((i) => i.uid === ask.uid) : undefined;
  if (!ask || !h || !item) return null;
  const cmp = compareGear(h, item);
  const shown = cmp.deltas.slice(0, 4);
  const pct = Math.round(cmp.gain * 100);
  return (
    <div className="rb-equipask" key={`equip:${ask.id}`} role="dialog" aria-label={`Equip ${itemName(item)}?`} style={{ ['--rc' as string]: rarityColor(item.r) }}>
      <div className="rb-equipask-head">
        <ItemIcon item={item} size={40} />
        <div className="rb-equipask-name">
          <strong>{itemName(item)}</strong>
          <span>
            {SLOT_LABEL[itemSlot(item)]} · {!cmp.worn ? 'empty slot' : pct > 100 ? `far better ${ROLE_WORD[gearRole(h)]}` : `+${pct}% ${ROLE_WORD[gearRole(h)]}`}
          </span>
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="rb-equipask-deltas">
          {shown.map((d) => (
            <li key={d.stat} className={d.n > 0 ? 'is-up' : 'is-down'} title={STAT_LABEL[d.stat]}>
              {d.n > 0 ? fmtStat(d.stat, d.n) : fmtStat(d.stat, -d.n).replace(/^\+/, '−')}
            </li>
          ))}
        </ul>
      )}
      <div className="rb-equipask-btns">
        <button className="rb-btn is-small" onClick={() => engine.answerEquip(false)}>
          Later
        </button>
        <button className="rb-btn is-small is-gold" onClick={() => engine.answerEquip(true)}>
          Equip
        </button>
      </div>
    </div>
  );
}
