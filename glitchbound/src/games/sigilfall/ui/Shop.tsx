import { useState } from 'react';
import { NPCS } from '../data/quests';
import { QM_LEVEL, SHOPS, type ShopId } from '../data/vendors';
import type { SigilEngine } from '../engine';
import { bagSize, potionCap } from '../progress/character';
import { itemName, salvageValue } from '../progress/items';
import { cantBuy, potionPrice, stockFor, type ShopItem } from '../progress/shop';
import { fmt, Frame, ItemIcon, Portrait } from './common';
import { ItemDetail } from './Panels';
import { uiIcon } from './uiIcons';

/** A vendor: buy their stock (or potions at the inn), sell what is in your bag. */
export function ShopPanel({ engine, shop }: { engine: SigilEngine; shop: ShopId }) {
  const h = engine.hero!;
  const def = SHOPS[shop];
  // the vendor you are trading with (else the first who keeps this kind of shop)
  const npc = (engine.ui.shopNpc ? NPCS[engine.ui.shopNpc] : undefined) ?? Object.values(NPCS).find((n) => n.shop === shop);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  // cheap to roll, and the hero changes in place, so it is simply rolled again each render
  const stock = stockFor(h, shop);
  const chosen: ShopItem | undefined = tab === 'buy' ? stock.find((s) => s.item.uid === sel) : undefined;
  const sellItem = tab === 'sell' ? h.bag.find((i) => i.uid === sel) : undefined;
  const title = (
    <span className="rb-shop-title">
      {npc && <Portrait kind="npc" id={npc.id} size={30} />}
      <span>{npc?.shopName ?? def.name}</span>
    </span>
  );
  return (
    <Frame title={title} onClose={() => engine.closePanel()} wide className="rb-panel-shop">
      <div className="rb-shop">
        <div className="rb-shop-top">
          <span className="rb-dim rb-small">{def.blurb}</span>
          <span className="rb-purse">
            <b className="rb-gold">{fmt(h.gold)}</b> gold
            {(shop === 'quartermaster' || h.marks > 0) && (
              <>
                {' · '}
                <b className="rb-marks">{fmt(h.marks)}</b> Sigil Marks
              </>
            )}
          </span>
        </div>
        {shop !== 'inn' && (
          <div className="rb-seg" role="tablist" aria-label="Buy or sell">
            {(['buy', 'sell'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'is-on' : ''}
                onClick={() => {
                  setTab(t);
                  setSel(null);
                  setConfirm(null);
                }}
              >
                {t === 'buy' ? 'Buy' : `Sell (${h.bag.length}/${bagSize(h)})`}
              </button>
            ))}
          </div>
        )}
        <div className="rb-shop-body">
          <section className="rb-shop-list" aria-label={tab === 'buy' ? 'For sale' : 'Your bag'}>
            {shop === 'inn' ? (
              <PotionCounter engine={engine} />
            ) : tab === 'buy' ? (
              stock.length ? (
                <div className="rb-shop-grid">
                  {stock.map((s) => {
                    const why = cantBuy(h, shop, s);
                    return (
                      <button key={s.item.uid} className={`rb-ware${sel === s.item.uid ? ' is-sel' : ''}${why ? ' is-dim' : ''}`} onClick={() => setSel(s.item.uid)} aria-label={`${itemName(s.item)}, ${priceText(s)}`}>
                        <ItemIcon item={s.item} size={42} />
                        <span className="rb-ware-name">{itemName(s.item)}</span>
                        <span className="rb-ware-price">{priceText(s)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rb-dim">Sold out. New stock arrives after your next expedition.</p>
              )
            ) : h.bag.length ? (
              <div className="rb-shop-grid">
                {h.bag.map((it) => (
                  <button key={it.uid} className={`rb-ware${sel === it.uid ? ' is-sel' : ''}`} onClick={() => setSel(it.uid)} aria-label={`${itemName(it)}, sells for ${salvageValue(it)} gold`}>
                    <ItemIcon item={it} size={42} />
                    <span className="rb-ware-name">{itemName(it)}</span>
                    <span className="rb-ware-price">{fmt(salvageValue(it))} g</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rb-dim">Your bag is empty. Worn gear isn’t for sale.</p>
            )}
            {shop === 'quartermaster' && h.level < QM_LEVEL && <p className="rb-small rb-dim">This gear is made for the top level: the quartermaster sells it from level {QM_LEVEL}.</p>}
          </section>
          {shop !== 'inn' && (
            <section className={`rb-detail${chosen || sellItem ? ' is-open' : ''}`} aria-label="Item details">
              {chosen ? (
                <ItemDetail
                  engine={engine}
                  item={chosen.item}
                  worn={false}
                  confirm={false}
                  onSalvage={() => undefined}
                  onDone={() => setSel(null)}
                  actions={
                    <div className="rb-row">
                      <button
                        className="rb-btn is-gold"
                        disabled={!!cantBuy(h, shop, chosen)}
                        onClick={() => {
                          const got = engine.buy(shop, chosen.item.uid);
                          if (got) {
                            engine.toast(`Bought ${itemName(got)}`, 'loot', got);
                            setSel(null);
                          }
                        }}
                      >
                        {cantBuy(h, shop, chosen) ?? `Buy · ${priceText(chosen)}`}
                      </button>
                    </div>
                  }
                />
              ) : sellItem ? (
                <ItemDetail
                  engine={engine}
                  item={sellItem}
                  worn={false}
                  confirm={false}
                  onSalvage={() => undefined}
                  onDone={() => setSel(null)}
                  actions={
                    <div className="rb-row">
                      <button
                        className={`rb-btn${confirm === sellItem.uid ? ' is-danger' : ' is-gold'}`}
                        onClick={() => {
                          // anything rare or better asks twice
                          if (confirm !== sellItem.uid && sellItem.r !== 'common' && sellItem.r !== 'uncommon') {
                            setConfirm(sellItem.uid);
                            return;
                          }
                          engine.salvageItem(sellItem.uid);
                          setSel(null);
                          setConfirm(null);
                        }}
                      >
                        {confirm === sellItem.uid ? `Sell it for ${salvageValue(sellItem)} gold?` : `Sell · ${salvageValue(sellItem)} gold`}
                      </button>
                    </div>
                  }
                />
              ) : (
                <p className="rb-dim rb-detail-empty">Pick an item to compare it with what you wear.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </Frame>
  );
}

function priceText(s: ShopItem): string {
  return s.price.marks ? `${s.price.marks} marks + ${fmt(s.price.gold)} g` : `${fmt(s.price.gold)} g`;
}

/** The inn: potions, one or a handful. */
function PotionCounter({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const price = potionPrice(h.level);
  const room = potionCap(h) - h.potions;
  const afford = Math.floor(h.gold / price);
  return (
    <div className="rb-inn">
      <div className="rb-inn-row">
        <img src={uiIcon('potion', 4)} alt="" className="rb-inn-icon" />
        <div>
          <strong>Healing Potion</strong>
          <span className="rb-dim rb-small">Restores 40% of your health at once. You carry {h.potions} of {potionCap(h)}.</span>
          <span className="rb-gold">{price} gold each</span>
        </div>
      </div>
      <div className="rb-row">
        <button className="rb-btn is-gold" disabled={room <= 0 || afford < 1} onClick={() => engine.buyPotions(1)}>
          {room <= 0 ? 'Your belt is full' : afford < 1 ? 'Not enough gold' : `Buy one · ${price} g`}
        </button>
        {room > 1 && afford > 1 && (
          <button className="rb-btn" onClick={() => engine.buyPotions(room)}>
            Fill up ({Math.min(room, afford)}) · {fmt(Math.min(room, afford) * price)} g
          </button>
        )}
      </div>
    </div>
  );
}
