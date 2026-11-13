import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CLASSES, levelPower, MAX_LEVEL, xpToNext } from '../data/classes';
import { ITEM_DEFS } from '../data/items';
import { KEY_AFFIXES, KEY_DEATH, keyLevelFor, KEY_MIN, keyAffixes, keyLoot, keyParFor, keyScale, weekAffixes, weekOf } from '../data/keystones';
import { NPCS, QUESTS } from '../data/quests';
import { mapColors } from '../data/themes';
import { REGION_IDS, REGIONS, RIFT_MODS, TIERS, type RiftMod } from '../data/regions';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENT_ROWS, TALENTS } from '../data/talents';
import { setOf } from '../data/riftgear';
import type { Item, ItemDef, QuestDef, RegionDef, RegionId, SkillIndex, SkillSpec, SlotId, StatKey, TalentNode } from '../data/types';
import { SLOTS } from '../data/types';
import type { PanelId, SigilEngine } from '../engine';
import { SLOT_LEVELS, slotOpen, bagSize, cantEquip, cantLearn, cantSpec, currentObjective, freePoints, learnedSkills, levelGated, pointsInTree, PERKS, questProgress, questRegion, questState, respecCost, SIGILS, specCost, talentPoints, trackedQuest, treeOpen, type Character, HOME } from '../progress/character';
import { ZOOM_MAX, ZOOM_MIN } from '../progress/save';
import { buildHero, typeBonus } from '../progress/build';
import { DMG_NAME, fmtStat, modLines, STAT_LABEL, costText } from '../progress/describe';
import { itemClass, itemMods, itemName, itemScore, itemSlot, salvageValue } from '../progress/items';
import { npcMark, rarityColor } from '../render/renderer';
import { heldWeapon, heroDollUrl, heroLook, itemIconUrl, mountPictureUrl, talentIconUrl, watchMountPictures } from '../render/sprites';
import type { HeroLook } from '../render/art/hero';
import { MOUNTS } from '../data/mounts';
import { authoredLooks, BARE_LOOK, canRide, LOOK_SLOTS, lookFits, lookOf, lookSource, mountDef, riddenMount, ridingLocked, ridingOpen, wornId, wornLooks, type Look, type LookSlot } from '../progress/wardrobe';
import { ownedShopLooks, ownedShopMounts } from '../progress/shopGoods';
import { armorReduction } from '../sim/combat';
import { K, markerPos, parseRegion, TILE, type TileMap } from '../sim/map';
import { objectiveTarget, objectiveTargets, questCounts } from '../sim/objective';
import { npcRegion, regionLinks } from '../sim/routes';
import { Bar, fmt, Frame, ItemIcon, Portrait, RARITY_NAME, SkillIcon } from './common';
import { drawMapIcon, mapIconUrl, type MapIcon } from './mapIcons';
import { usePanZoom, type PanZoom } from './panZoom';
import { nameLines, planWorld } from './worldLayout';
import { isMainQuest, questSteps, turnInNpc } from '../progress/handin';
import { questRewards } from '../progress/rewards';
import { FOG_CELL, fogSeen, loadFog, type Fog } from '../progress/fog';
import { RiftGuide } from './RiftGuide';
import { ShopPanel } from './Shop';
import { RING_LOOKS } from '../arena/rewards';
import { MUSIC_CREDITS } from '../audio/tracks';
import { earnedTitles, titled, titleName, TITLES, wornTitle } from '../progress/titles';
import { WARDENS } from '../data/wardens';
import { compareWith, linesOnlyIn, statRows } from './compare';
import { PartyPanel } from './Party';
import { GAME_VERSION } from '../data/version';
import { StorePanel, useStoreOpen } from './Store';
import { PRESETS } from '../progress/presets';
import { clockText } from '../sim/world';
import { PARA_STATS, PARAGON, paragonFree, paragonSpent, paragonXp } from '../progress/paragon';

const TABS: { id: PanelId; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'skills', label: 'Skills' },
  { id: 'talents', label: 'Talents' },
  { id: 'quests', label: 'Quests' },
  { id: 'map', label: 'Map' },
];

export function Panels({ engine }: { engine: SigilEngine }) {
  const p = engine.ui.panel;
  if (p === 'settings') return <SettingsPanel engine={engine} onClose={() => engine.closePanel()} />;
  if (p === 'shop' && engine.ui.shop) return <ShopPanel engine={engine} shop={engine.ui.shop} />;
  if (p === 'party') return <PartyPanel engine={engine} />;
  if (p === 'store') return <StorePanel onClose={() => engine.closePanel()} />;
  const h = engine.hero!;
  const title = (
    <span className="rb-tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" data-tab={t.id} aria-selected={p === t.id} className={p === t.id ? 'is-on' : ''} onClick={() => engine.openPanel(t.id)}>
          {t.label}
          {t.id === 'talents' && freePoints(h) > 0 && <span className="rb-badge">{freePoints(h)}</span>}
          {t.id === 'hero' && h.bag.some((i) => i.fresh) && <span className="rb-badge">{h.bag.filter((i) => i.fresh).length}</span>}
        </button>
      ))}
    </span>
  );
  return (
    <Frame title={title} label={TABS.find((t) => t.id === p)?.label} onClose={() => engine.closePanel()} wide className={`rb-panel-${p}`}>
      {p === 'hero' && <HeroPanel engine={engine} />}
      {p === 'wardrobe' && <WardrobePanel engine={engine} />}
      {p === 'skills' && <SkillsPanel engine={engine} />}
      {p === 'talents' && <TalentsPanel engine={engine} />}
      {p === 'quests' && <QuestsPanel engine={engine} />}
      {p === 'map' && <MapPanel engine={engine} />}
    </Frame>
  );
}

/* --------------------------------------------------------------- hero */

export const SLOT_LABEL: Record<SlotId, string> = { weapon: 'Weapon', offhand: 'Off-hand', head: 'Head', chest: 'Chest', legs: 'Legs', hands: 'Hands', feet: 'Feet', amulet: 'Amulet', ring: 'Ring', relic: 'Relic' };
const SHOWN_STATS: StatKey[] = ['power', 'crit', 'critDmg', 'haste', 'armor', 'speed', 'regen', 'ultCharge', 'fire', 'frost', 'lightning', 'poison', 'physical', 'arcane', 'potion'];

/** Each sigil's color on the hero sheet. */
const SIGIL_COLOR: Record<(typeof SIGILS)[number], string> = {
  'sigil-embers': '#ff7a3d',
  'sigil-tides': '#4ab8ff',
  'sigil-stone': '#c8b898',
  'sigil-sun': '#ffd84d',
  'sigil-frost': '#bfe8ff',
  'sigil-thorns': '#6ad05a',
  'sigil-veil': '#c58cff',
};

function HeroPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const w = engine.world!;
  const [sel, setSel] = useState<{ where: 'bag' | 'worn'; uid: string } | null>(null);
  const [sort, setSort] = useState<'new' | 'best' | 'slot'>('new');
  const [confirm, setConfirm] = useState<string | null>(null);
  const b = w.build;
  const item = sel ? (sel.where === 'bag' ? h.bag.find((i) => i.uid === sel.uid) : Object.values(h.equip).find((i) => i?.uid === sel.uid)) : undefined;
  const bag = useMemo(() => {
    const list = [...h.bag];
    if (sort === 'best') list.sort((a, c) => itemScore(c) - itemScore(a));
    else if (sort === 'slot') list.sort((a, c) => SLOTS.indexOf(itemSlot(a)) - SLOTS.indexOf(itemSlot(c)) || itemScore(c) - itemScore(a));
    else list.reverse();
    return list;
  }, [h.bag, sort, engine.version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (item?.fresh) engine.markSeen(item.uid);
  }, [item, engine]);
  const pick = (where: 'bag' | 'worn', uid: string): void => {
    setConfirm(null);
    setSel(sel?.uid === uid ? null : { where, uid });
  };
  return (
    <div className="rb-hero">
      <section className="rb-hero-left" aria-label="Equipment and stats">
        <div className="rb-hero-id">
          <Portrait kind="hero" id={h.cls} equip={h.equip} worn={wornLooks(h)} body={h.body} face={h.face} size={48} />
          <div>
            <strong>{titled(h.name, wornTitle(h, engine.ringRating()))}</strong>
            <TitlePicker engine={engine} />
            <span>
              Level {h.level} {CLASSES[h.cls].name}
              {h.para.l > 0 && <b className="rb-para-name"> · Paragon {h.para.l}</b>}
            </span>
            {h.level >= MAX_LEVEL ? (
              <>
                <Bar value={h.para.x} max={paragonXp(h.para.l)} color="#c58cff" label="Paragon experience" />
                <span className="rb-dim rb-small">
                  {fmt(h.para.x)} / {fmt(paragonXp(h.para.l))} to Paragon {h.para.l + 1} · {fmt(h.gold)} gold
                </span>
              </>
            ) : (
              <>
                <Bar value={h.xp} max={xpToNext(h.level)} color="#ffe066" label="Experience" />
                <span className="rb-dim rb-small">
                  {fmt(h.xp)} / {fmt(xpToNext(h.level))} XP · {fmt(h.gold)} gold
                </span>
              </>
            )}
          </div>
        </div>
        <div className="rb-equip">
          {SLOTS.map((slot) => {
            const it = h.equip[slot];
            return (
              <button
                key={slot}
                className={`rb-eslot${it && sel?.uid === it.uid ? ' is-sel' : ''}`}
                style={{ gridArea: slot }}
                onClick={() => it && pick('worn', it.uid)}
                aria-label={it ? `${SLOT_LABEL[slot]}: ${itemName(it)}` : `${SLOT_LABEL[slot]}: empty`}
              >
                {it ? <ItemIcon item={it} size={40} /> : <span className="rb-eslot-empty">{SLOT_LABEL[slot]}</span>}
              </button>
            );
          })}
          <HeroDoll look={heroLook(h.cls, h.equip, wornLooks(h), h.body, h.face)} held={heldWeapon(h.cls, h.equip.weapon, wornLooks(h).weapon)} shield={h.cls === 'warrior' || h.cls === 'paladin'} />
        </div>
        <dl className="rb-stats">
          <div>
            <dt>Health</dt>
            <dd>{fmt(b.maxHp)}</dd>
          </div>
          {SHOWN_STATS.filter((k) => b.stats[k] || k === 'power' || k === 'crit' || k === 'armor').map((k) => (
            <div key={k}>
              <dt>{STAT_LABEL[k]}</dt>
              <dd>
                {k === 'armor' ? `${Math.round(b.stats.armor)} (−${Math.round(armorReduction(b.stats.armor, h.level) * 100)}% damage)` : k === 'regen' ? `${b.stats.regen.toFixed(1)}/s` : `${Math.round(b.stats[k])}%`}
              </dd>
            </div>
          ))}
        </dl>
        <div className="rb-sigils" aria-label={`Sigils: ${SIGILS.filter((id) => h.perks.includes(id)).length} of ${SIGILS.length}`}>
          {SIGILS.map((id) => (
            <span key={id} className={`rb-sigil${h.perks.includes(id) ? ' is-won' : ''}`} style={{ '--sigil': SIGIL_COLOR[id] } as React.CSSProperties} title={h.perks.includes(id) ? `${PERKS[id].name}: ${PERKS[id].text}` : 'A sigil not yet found'} />
          ))}
          <span className="rb-small rb-dim">
            Sigils {SIGILS.filter((id) => h.perks.includes(id)).length} / {SIGILS.length}
          </span>
        </div>
        {h.level >= MAX_LEVEL && <ParagonBox engine={engine} />}
      </section>
      <section className="rb-bag" aria-label="Bag">
        <div className="rb-bag-head">
          <strong>
            Bag {h.bag.length}/{bagSize(h)}
          </strong>
          <div className="rb-seg" role="group" aria-label="Sort">
            {(['new', 'best', 'slot'] as const).map((s) => (
              <button key={s} className={sort === s ? 'is-on' : ''} onClick={() => setSort(s)}>
                {s === 'new' ? 'Newest' : s === 'best' ? 'Best' : 'Slot'}
              </button>
            ))}
          </div>
        </div>
        <div className="rb-bag-grid">
          {bag.map((it) => {
            const better = itemSlot(it) && !cantEquip(h, it) && isUpgrade(h.equip[itemSlot(it)], it);
            return (
              <button key={it.uid} className={`rb-bslot${sel?.uid === it.uid ? ' is-sel' : ''}${cantEquip(h, it) ? ' is-other' : ''}`} onClick={() => pick('bag', it.uid)} aria-label={itemName(it)}>
                <ItemIcon item={it} size={46} />
                {better && <span className="rb-up" aria-label="Upgrade">▲</span>}
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, bagSize(h) - h.bag.length) }, (_, i) => (
            <span key={`e${i}`} className="rb-bslot is-empty" />
          ))}
        </div>
      </section>
      <section className={`rb-detail${item ? ' is-open' : ''}`} aria-label="Item details">
        {item ? (
          <ItemDetail
            engine={engine}
            item={item}
            worn={sel!.where === 'worn'}
            confirm={confirm === item.uid}
            onSalvage={() => {
              if (confirm !== item.uid && (item.r === 'epic' || item.r === 'legendary' || item.r === 'rare')) {
                setConfirm(item.uid);
                return;
              }
              engine.salvageItem(item.uid);
              setSel(null);
              setConfirm(null);
            }}
            onDone={() => setSel(null)}
          />
        ) : (
          <p className="rb-dim rb-detail-empty">Pick an item to see what it does. Gold lines change how your skills work.</p>
        )}
      </section>
    </div>
  );
}

/** A rough "is this better" for the upgrade arrow: more stats or new behaviour. */
export function isUpgrade(cur: Item | undefined, it: Item): boolean {
  if (!cur) return true;
  return itemScore(it) > itemScore(cur) + 5;
}

/** The hero's titles: the one worn (chosen here), and every one there is with how it is earned. */
function TitlePicker({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const rating = engine.ringRating();
  const mine = earnedTitles(h, rating);
  const worn = wornTitle(h, rating);
  const value = h.title === '' ? '' : (mine.find((t) => titleName(t, h) === worn)?.id ?? '');
  return (
    <details className="rb-titles">
      <summary>
        Titles <span className="rb-dim">{mine.length} of {TITLES.length}</span>
      </summary>
      {mine.length > 0 && (
        <label className="rb-titles-pick">
          <span>Wear</span>
          <select value={value} onChange={(e) => engine.chooseTitle(e.target.value)} aria-label="Title to wear">
            <option value="">No title</option>
            {mine.map((t) => (
              <option key={t.id} value={t.id}>
                {titleName(t, h)}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul>
        {TITLES.map((t) => {
          const has = mine.includes(t);
          return (
            <li key={t.id} className={has ? 'is-on' : ''}>
              <b className={t.rare ? 'rb-title-rare' : ''}>{t.id === 'warden' ? WARDENS[h.cls].title : t.name}</b>
              <span>{t.how}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** One item's card: header, stats (with their change against `compareTo`), what it changes, lore. */
export function ItemCard({ item, compareTo, label, compact, against, onClose, wornIds }: { item: Item; compareTo?: Item; label?: 'Equipped' | 'In your bag' | 'For sale'; compact?: boolean; against?: Item; onClose?: () => void; wornIds?: ReadonlySet<string> }) {
  const slot = itemSlot(item);
  const def = ITEM_DEFS[item.base];
  const cls = itemClass(item);
  const { rows, lost } = statRows(item, compareTo);
  const lines = modLines(itemMods(item));
  // on the worn card: the lines a swap for `against` would give up
  const gone = against ? new Set(linesOnlyIn(item, against)) : null;
  return (
    <div className={`rb-icard${compact ? ' is-compact' : ''}${label === 'Equipped' ? ' is-worn' : ''}`} style={{ ['--rc' as string]: rarityColor(item.r) }}>
      <div className="rb-item-head">
        <ItemIcon item={item} size={compact ? 40 : 52} />
        <div>
          {label && <span className="rb-icard-tag">{label}</span>}
          <strong className="rb-item-name">{itemName(item)}</strong>
          <span className="rb-dim rb-small">
            {RARITY_NAME[item.r]} {SLOT_LABEL[slot].toLowerCase()} · item level {item.il}
            {cls ? ` · ${CLASSES[cls].name} only` : ''}
          </span>
        </div>
        {onClose && (
          <button className="rb-x is-small" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        )}
      </div>
      <ul className="rb-item-stats">
        {rows.map(({ k, v, delta }) => (
          <li key={k}>
            {fmtStat(k, v)}
            {compareTo && Math.round(delta * 10) !== 0 && <span className={delta > 0 ? 'rb-up-t' : 'rb-down-t'}> ({delta > 0 ? '+' : ''}{k === 'regen' ? delta.toFixed(1) : Math.round(delta)})</span>}
          </li>
        ))}
        {lost.map(([k, v]) => (
          <li key={`lost-${k}`} className="rb-down-t">
            Loses {fmtStat(k, v)}
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <div className="rb-item-mods">
          <span className="rb-kicker">{def?.forSpec !== undefined && cls ? `Made for the ${CLASSES[cls].trees[def.forSpec]?.name ?? ''}` : 'Changes how you fight'}</span>
          {lines.map((l) => (
            <p key={l} className={gone?.has(l) ? 'rb-down-t' : 'rb-gold'}>
              {gone?.has(l) ? 'You would lose: ' : ''}
              {l}
            </p>
          ))}
        </div>
      )}
      {def?.set && !compact && <SetLines item={def} wornIds={wornIds} />}
      {def?.rift !== undefined && <p className="rb-small rb-rift-tag">Rift-forged: found only in the Rift, from Riftstone +{def.rift}.</p>}
      {def && <p className="rb-lore">“{def.lore}”</p>}
    </div>
  );
}

/** A set piece's set: its pieces (the ones worn marked) and what each count of them gives (what counts now, lit). */
function SetLines({ item, wornIds }: { item: ItemDef; wornIds?: ReadonlySet<string> }) {
  const set = setOf(item);
  if (!set) return null;
  const worn = set.pieces.filter((id) => wornIds?.has(id)).length;
  return (
    <div className="rb-item-set">
      <span className="rb-kicker">
        {set.name} ({worn}/{set.pieces.length} worn)
      </span>
      <ul className="rb-set-pieces">
        {set.pieces.map((id) => (
          <li key={id} className={wornIds?.has(id) ? 'is-on' : ''}>
            {ITEM_DEFS[id]?.name ?? id}
          </li>
        ))}
      </ul>
      {set.bonuses.map((b) => (
        <p key={b.need} className={worn >= b.need ? 'rb-gold' : 'rb-dim'}>
          <b>({b.need})</b> {b.text}
        </p>
      ))}
    </div>
  );
}

/** An item's card next to what is worn in its slot (WoW-style), the "if worn" summary, then `actions` (or Equip/Salvage). */
export function ItemDetail({ engine, item, worn, confirm, onSalvage, onDone, actions, label }: { engine: SigilEngine; item: Item; worn: boolean; confirm: boolean; onSalvage: () => void; onDone: () => void; actions?: ReactNode; label?: 'In your bag' | 'For sale' }) {
  const h = engine.hero!;
  const slot = itemSlot(item);
  const compare = compareWith(h, item, worn);
  const lines = modLines(itemMods(item));
  const reason = cantEquip(h, item);
  // the hero's health and power before and after wearing it
  const preview = useMemo(() => {
    if (worn || reason) return null;
    const before = buildHero(h);
    const clone = { ...h, equip: { ...h.equip, [slot]: item } };
    const after = buildHero(clone);
    return { hp: after.maxHp - before.maxHp, power: after.stats.power - before.stats.power };
  }, [h, item, slot, worn, reason]);
  return (
    <div className="rb-item" style={{ ['--rc' as string]: rarityColor(item.r) }}>
      {/* One card, and on it what wearing the piece changes: each of its stats with the difference from what is worn,
          the stats that would be lost, and (below) the effects of the worn piece that would go with it. The worn
          piece's own card stood beside it, and on a phone on its side the two of them squeezed the bag to a strip
          (the owner: "the item comparison may be irrelevant, you can just keep what you're gaining and what you're
          losing as stats and effects"). */}
      <div className="rb-compare">
        <ItemCard item={item} compareTo={compare} label={worn ? 'Equipped' : compare ? (label ?? 'In your bag') : label} onClose={onDone} wornIds={new Set(Object.values(h.equip).flatMap((i) => (i ? [i.base] : [])))} />
        {compare && (
          <div className="rb-swap">
            <span className="rb-kicker">Instead of {itemName(compare)}</span>
            {linesOnlyIn(compare, item).map((l) => (
              <p key={l} className="rb-down-t rb-small">
                You would lose: {l}
              </p>
            ))}
          </div>
        )}
        {!worn && !compare && !reason && <p className="rb-small rb-dim rb-icard-none">Nothing equipped in this slot.</p>}
      </div>
      {preview && (preview.hp !== 0 || preview.power !== 0) && (
        <p className="rb-small rb-item-if">
          If worn: <span className={preview.hp >= 0 ? 'rb-up-t' : 'rb-down-t'}>{preview.hp >= 0 ? '+' : ''}{preview.hp} health</span>,{' '}
          <span className={preview.power >= 0 ? 'rb-up-t' : 'rb-down-t'}>{preview.power >= 0 ? '+' : ''}{Math.round(preview.power)}% damage</span>
        </p>
      )}
      {actions ?? (
      <div className="rb-row">
        {worn ? (
          <button className="rb-btn" onClick={() => engine.unequipSlot(slot) && onDone()} disabled={h.bag.length >= bagSize(h)}>
            Take off
          </button>
        ) : (
          <>
            <button
              className="rb-btn is-gold"
              disabled={!!reason}
              title={reason ?? undefined}
              onClick={() => {
                if (engine.equipItem(item.uid)) {
                  if (lines[0]) engine.toast(`Now: ${lines[0]}`, 'good');
                  onDone();
                }
              }}
            >
              {reason ? reason : 'Equip'}
            </button>
            <button className={`rb-btn${confirm ? ' is-danger' : ''}`} onClick={onSalvage}>
              {confirm ? `Salvage ${RARITY_NAME[item.r].toLowerCase()} for ${salvageValue(item)} gold?` : `Salvage · ${salvageValue(item)} gold`}
            </button>
          </>
        )}
      </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- skills */

/** One line of numbers for a skill as it is now (after level, gear and talents). */
function specLine(engine: SigilEngine, spec: SkillSpec): string {
  const w = engine.world!;
  const st = w.build.stats;
  const parts: string[] = [];
  if (spec.damage > 0) parts.push(`${Math.round(spec.damage * levelPower(engine.hero!.level) * typeBonus(st, spec.dmgType))} ${DMG_NAME[spec.dmgType]} damage${spec.count > 1 ? ` ×${spec.count}` : ''}${spec.cast === 'channel' || spec.tick ? ' per hit' : ''}`);
  const res = w.build.resource;
  const cost = costText(res, spec.cost, w.player.maxMana);
  if (cost) parts.push(cost);
  if (spec.extra.manaOnHit && res && w.player.maxMana > 0) parts.push(`+${Math.round((spec.extra.manaOnHit * w.player.maxMana) / 100)} ${res.name} per hit`);
  if (spec.castTime) parts.push(`${spec.castTime} s cast (stand still)`);
  if (spec.cooldown > 0) parts.push(`${(spec.cooldown / (1 + st.haste / 100)).toFixed(1)} s cooldown${spec.charges > 1 ? `, ${spec.charges} charges` : ''}`);
  if (spec.cast === 'projectile' && spec.pierce > 0 && spec.pierce < 99) parts.push(`pierces ${spec.pierce}`);
  if (spec.pierce >= 99) parts.push('passes through all');
  if (spec.bounce > 0) parts.push(`bounces ${spec.bounce}`);
  if (spec.extra.jumps) parts.push(`${spec.extra.jumps} jumps`);
  if (spec.extra.maxTraps) parts.push(`${spec.extra.maxTraps} traps`);
  if (spec.area && spec.cast !== 'melee') parts.push(`${Math.round(spec.area / TILE * 10) / 10} tile radius`);
  return parts.join(' · ');
}

function SkillCard({ engine, id, slotLabel, active, onClick }: { engine: SigilEngine; id: string; slotLabel?: string; active?: boolean; onClick?: () => void }) {
  const w = engine.world!;
  const def = SKILLS[id]!;
  const res = w.build.skills[id];
  const learned = def.unlock <= engine.hero!.level;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`rb-skill${active ? ' is-on' : ''}${learned ? '' : ' is-locked'}`} onClick={onClick}>
      <SkillIcon id={id} size={36} />
      <div className="rb-skill-text">
        <strong>
          {def.name} {slotLabel && <span className="rb-dim rb-small">· {slotLabel}</span>}
          {!learned && <span className="rb-dim rb-small"> · level {def.unlock}</span>}
        </strong>
        <span className="rb-small">{def.blurb}</span>
        {res && learned && <span className="rb-small rb-dim">{specLine(engine, res.spec)}</span>}
        {res && learned && res.notes.map((n, i) => (
          <span key={i} className="rb-small rb-note" style={{ color: n.source.kind === 'item' ? rarityColor(n.source.rarity) : '#9be7ff' }}>
            {n.source.name}: <span className="rb-gold">{n.text}</span>
          </span>
        ))}
      </div>
    </Tag>
  );
}

function SkillsPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const cls = CLASSES[h.cls];
  const [slot, setSlot] = useState<SkillIndex>(0);
  const learned = learnedSkills(h);
  const keys = engine.touchMode ? ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4'] : ['Q', 'E', 'R', engine.settings.skill4Key.toUpperCase()];
  return (
    <div className="rb-skills">
      <section>
        <span className="rb-kicker">Your four skill slots: pick a slot, then a skill. You learn more skills than fit: the bar is your build.</span>
        <div className="rb-skill-slots">
          {([0, 1, 2, 3] as const).map((i) => {
            const id = h.skills[i];
            const open = slotOpen(h, i);
            return (
              <button key={i} className={`rb-skillslot${slot === i ? ' is-on' : ''}${open ? '' : ' is-locked'}`} onClick={() => setSlot(i)} disabled={!open} title={open ? undefined : `Opens at level ${SLOT_LEVELS[i]}`}>
                <span className="rb-kbd">{keys[i]}</span>
                {!open ? <span className="rb-dim">Lv {SLOT_LEVELS[i]}</span> : id ? <SkillIcon id={id} size={32} /> : <span className="rb-dim">empty</span>}
                <span className="rb-small">{id ? SKILLS[id]!.name : ''}</span>
              </button>
            );
          })}
        </div>
        <div className="rb-skill-list">
          {cls.skills.map((id) => (
            <SkillCard key={id} engine={engine} id={id} active={h.skills[slot] === id} slotLabel={h.skills.includes(id) ? keys[h.skills.indexOf(id)] : undefined} onClick={learned.includes(id) ? () => engine.assignSkill(slot, id) : undefined} />
          ))}
        </div>
      </section>
      <section>
        <span className="rb-kicker">Always with you</span>
        <SkillCard engine={engine} id={cls.basic} slotLabel={engine.touchMode ? 'Attack' : 'Left mouse'} />
        <SkillCard engine={engine} id={cls.ult} slotLabel="Ultimate" />
        <SkillCard engine={engine} id={cls.dodge} slotLabel={engine.touchMode ? 'Dodge' : 'Space'} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- talents */

function TalentsPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const cls = CLASSES[h.cls];
  const [sel, setSel] = useState<TalentNode | null>(null);
  const [tab, setTab] = useState<0 | 1 | 2>(h.spec ?? 0);
  const [ask, setAsk] = useState<'reset' | 'spec' | null>(null);
  const free = freePoints(h);
  const cost = respecCost(h);
  if (h.spec === null || ask === 'spec') return <SpecChoice engine={engine} onDone={() => setAsk(null)} />;
  const tree = cls.trees[tab];
  const open = treeOpen(h, tab);
  const node = sel && sel.tree === tab ? sel : null;
  return (
    <div className="rb-talents">
      <div className="rb-talents-head">
        <span>
          <b className={free ? 'rb-gold' : ''}>{free}</b> point{free === 1 ? '' : 's'} to spend · {talentPoints(h)} earned (one per level from {SPEC_LEVEL})
        </span>
        <span className="rb-row">
          {ask === 'reset' ? (
            <button className="rb-btn is-small is-danger" onClick={() => (engine.resetTalents(), setAsk(null))} disabled={h.gold < cost}>
              {cost ? `Reset for ${cost} gold?` : 'Reset for free?'}
            </button>
          ) : (
            <button className="rb-btn is-small is-ghost" onClick={() => setAsk('reset')} disabled={talentPoints(h) === free}>
              Reset talents{cost ? ` (${cost} gold)` : ' (free until level 20)'}
            </button>
          )}
          <button className="rb-btn is-small is-ghost" onClick={() => setAsk('spec')}>
            Change specialization
          </button>
        </span>
      </div>
      <div className="rb-seg rb-tree-tabs" role="tablist" aria-label="Talent trees">
        {cls.trees.map((t, i) => (
          <button key={t.name} role="tab" aria-selected={tab === i} className={tab === i ? 'is-on' : ''} style={{ ['--tc' as string]: t.color }} onClick={() => setTab(i as 0 | 1 | 2)}>
            {h.spec === i && <span aria-label="your specialization">★ </span>}
            {t.name} <span className="rb-dim">{pointsInTree(h, i as 0 | 1 | 2)}</span>
          </button>
        ))}
      </div>
      <div className="rb-tree-wrap">
        <section className={`rb-tree${open ? '' : ' is-locked'}`} style={{ ['--tc' as string]: tree.color }}>
          <header>
            <strong>{tree.name}</strong>
            <span className="rb-small rb-dim">{tree.blurb}</span>
            {!open && (
              <span className="rb-small rb-gold">
                Opens after {SPEC_FOCUS} points in {cls.trees[h.spec].name} ({pointsInTree(h, h.spec)} so far)
              </span>
            )}
          </header>
          <div className="rb-tree-grid">
            {Array.from({ length: TALENT_ROWS }, (_, row) => (
              <span key={`r${row}`} className="rb-row-need" style={{ gridRow: row + 1 }}>
                {row * ROW_COST}
              </span>
            ))}
            {TALENTS[h.cls]
              .filter((n) => n.tree === tab)
              .map((n) => {
                const rank = h.talents[n.id] ?? 0;
                const why = cantLearn(h, n.id);
                const rowOpen = open && pointsInTree(h, tab) >= n.row * ROW_COST && (!n.requires || (h.talents[n.requires] ?? 0) > 0);
                return (
                  <button
                    key={n.id}
                    className={`rb-node${rank ? ' is-taken' : ''}${!why ? ' is-ready' : ''}${!rowOpen ? ' is-closed' : ''}${node?.id === n.id ? ' is-sel' : ''}${n.row === TALENT_ROWS - 1 ? ' is-cap' : ''}${rank >= n.ranks ? ' is-full' : ''}`}
                    style={{ gridRow: n.row + 1, gridColumn: n.col + 2 }}
                    onClick={() => setSel(n)}
                    aria-label={`${n.name}, rank ${rank} of ${n.ranks}`}
                  >
                    <img src={talentIconUrl(h.cls, n, tree.color)} alt="" draggable={false} />
                    <span className="rb-node-rank">
                      {rank}/{n.ranks}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
        <div className="rb-talent-detail">
              <p className="rb-small">
                <b style={{ color: cls.trees[h.spec].color }}>{cls.trees[h.spec].passive.name}</b> ({cls.trees[h.spec].name}): {cls.trees[h.spec].passive.text}
              </p>
              {cls.trees[h.spec].combo && (
                <p className="rb-small rb-combo-line">
                  <b style={{ color: cls.trees[h.spec].color }}>Combo · {cls.trees[h.spec].combo!.name}:</b> {cls.trees[h.spec].combo!.text}
                </p>
              )}
              <p className="rb-dim rb-small">
                Tap a talent to read it and learn it. Each row opens after {ROW_COST} more points in its tree; the last row is the tree’s capstone. Your specialization’s tree comes first: the other two open after {SPEC_FOCUS} points in it.
              </p>
        </div>
      </div>
      {node && <TalentCard engine={engine} node={node} onClose={() => setSel(null)} />}
    </div>
  );
}

/**
 * A talent, opened: what it does, what it is doing at the hero's rank, and the button that learns it, in a card over
 * the tree where it was tapped. It was read at the foot of the panel, a scroll away from the tree on a phone, and
 * scrolled back from for every one looked at (the owner: "it would also be nice if the talents had pop up with the
 * information about them and 'learn' button instead of having to scroll down every time"). It stays up while ranks
 * are learned; a tap outside it, its cross or Escape puts it away.
 */
export function TalentCard({ engine, node, onClose }: { engine: SigilEngine; node: TalentNode; onClose: () => void }) {
  const h = engine.hero!;
  const cls = CLASSES[h.cls];
  const tree = cls.trees[node.tree];
  const rank = h.talents[node.id] ?? 0;
  const why = cantLearn(h, node.id);
  const now = rank > 0 ? modLines(node.mods.map((m) => scaleMod(m, rank))) : [];
  const learn = useRef<HTMLButtonElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (learn.current ?? shut.current)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // (the card goes, not the whole panel with it)
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [node.id, onClose]);
  return (
    <div className="rb-talent-pop-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb-talent-pop" role="dialog" aria-modal="true" aria-label={node.name} style={{ ['--tc' as string]: tree.color }}>
        <header>
          <img src={talentIconUrl(h.cls, node, tree.color)} alt="" draggable={false} />
          <div>
            <strong>{node.name}</strong>
            <span className="rb-small rb-dim">
              Rank {rank}/{node.ranks} · {tree.name}
              {node.row === TALENT_ROWS - 1 ? ' · capstone' : ''}
            </span>
          </div>
          <button ref={shut} className="rb-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p>{node.text}</p>
        {now.length > 0 && <p className="rb-gold rb-small">Now: {now.join(' ')}</p>}
        {why ? (
          <p className="rb-dim rb-small rb-talent-why">{why}</p>
        ) : (
          <button ref={learn} className="rb-btn is-gold" onClick={() => engine.learn(node.id)}>
            Learn {node.name}
          </button>
        )}
      </div>
    </div>
  );
}

/** Choosing (or changing) the specialization: what each one gives. */
function SpecChoice({ engine, onDone }: { engine: SigilEngine; onDone: () => void }) {
  const h = engine.hero!;
  const cls = CLASSES[h.cls];
  const cost = specCost(h);
  const early = h.level < SPEC_LEVEL;
  return (
    <div className="rb-specs">
      <p className="rb-small">
        {early
          ? `At level ${SPEC_LEVEL} you choose a specialization: its ability, its passive, and the talent tree your points go into first (one point a level from then on).`
          : h.spec === null
            ? 'Choose your specialization. It gives you its ability and its passive, and its talent tree is where your points go first. You can change it later at a cost.'
            : `Changing your specialization resets your talents${cost ? ` and costs ${cost} gold` : ''}.`}
      </p>
      <div className="rb-spec-cards">
        {cls.trees.map((t, i) => {
          const sk = SKILLS[t.skill];
          const why = cantSpec(h, i as 0 | 1 | 2);
          return (
            <section key={t.name} className={`rb-spec${h.spec === i ? ' is-on' : ''}`} style={{ ['--tc' as string]: t.color }}>
              <header>
                <strong>{t.name}</strong>
                <span className="rb-small rb-dim">{t.role}</span>
              </header>
              <p className="rb-small">{t.blurb}</p>
              {sk && (
                <div className="rb-spec-skill">
                  <SkillIcon id={sk.id} size={36} />
                  <span>
                    <b>{sk.name}</b>
                    <span className="rb-small rb-dim">{sk.blurb}</span>
                  </span>
                </div>
              )}
              <p className="rb-small">
                <b>{t.passive.name}:</b> {t.passive.text}
              </p>
              {t.combo && (
                <p className="rb-small rb-combo-line">
                  <b style={{ color: t.color }}>Combo · {t.combo.name}:</b> {t.combo.text}
                </p>
              )}
              <button className="rb-btn is-gold" disabled={!!why} onClick={() => engine.chooseSpec(i as 0 | 1 | 2) && onDone()}>
                {why ?? (h.spec === null ? `Become ${t.name}` : `Switch${cost ? ` · ${cost} gold` : ''}`)}
              </button>
            </section>
          );
        })}
      </div>
      {h.spec !== null && (
        <button className="rb-btn is-ghost is-small" onClick={onDone}>
          Keep {cls.trees[h.spec].name}
        </button>
      )}
    </div>
  );
}

function scaleMod(m: TalentNode['mods'][number], rank: number): TalentNode['mods'][number] {
  if (m.t === 'stat') return { ...m, v: m.v * rank };
  return m;
}

/* -------------------------------------------------------------- quests */

function QuestsPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const here = engine.world?.region.id;
  const active = QUESTS.filter((q) => questState(h, q.id) === 'active' || questState(h, q.id) === 'ready');
  const tracked = trackedQuest(h, here);
  // paths not taken aren't deeds
  const done = QUESTS.filter((q) => questState(h, q.id) === 'done' && (h.quests[q.id]?.n ?? 0) >= 0);
  // grouped by where they are done, this region first
  const groups = new Map<string, QuestDef[]>();
  for (const q of active) {
    const r = questRegion(q) ?? npcRegion(q.giver) ?? HOME;
    groups.set(r, [...(groups.get(r) ?? []), q]);
  }
  const order = [...groups.keys()].sort((a, b) => Number(b === here) - Number(a === here));
  // quests waiting only for the hero's level, the story's first
  const gated = levelGated(h).sort((a, b) => Number(isMainQuest(b.id)) - Number(isMainQuest(a.id)));
  return (
    <div className="rb-quests">
      {active.length === 0 && <p className="rb-dim">{gated.length ? `No quests right now. The next one opens at level ${Math.min(...gated.map((q) => q.level!))}.` : 'No quests right now. The Rift will stir again.'}</p>}
      {order.map((r) => (
        <section key={r} className="rb-quest-group">
          <span className="rb-kicker">
            {REGIONS[r as RegionId]?.name ?? r}
            {r === here ? ' · here' : ''}
          </span>
          {groups.get(r)!.map((q) => {
            const pr = questProgress(h, q);
            const ready = questState(h, q.id) === 'ready';
            const main = isMainQuest(q.id);
            const steps = questSteps(q);
            const at = ready ? steps.length : (h.quests[q.id]?.step ?? 0);
            const who = turnInNpc(q);
            const isTracked = tracked?.id === q.id;
            return (
              <article key={q.id} className={`rb-quest${main ? ' is-main' : ' is-side'}${isTracked ? ' is-tracked' : ''}`}>
                <div className="rb-quest-head">
                  <img src={mapIconUrl(ready ? (main ? 'handin' : 'handinSide') : main ? 'offer' : 'offerSide', 2)} alt="" />
                  <strong>{q.name}</strong>
                  <span className="rb-quest-kind">{main ? 'Story' : 'Side'}</span>
                  <button className="rb-btn is-small" onClick={() => engine.showOnMap(q.id)} aria-label={`Show ${q.name} on the map`}>
                    Map
                  </button>
                  <button className={`rb-btn is-small${isTracked ? ' is-gold' : ''}`} onClick={() => engine.trackQuest(isTracked ? null : q.id)} aria-pressed={isTracked}>
                    {isTracked ? 'Tracking' : 'Track'}
                  </button>
                </div>
                <p>{q.text}</p>
                <ol className="rb-quest-steps">
                  {steps.map((o, i) => (
                    <li key={i} className={i < at ? 'is-done' : i === at ? 'is-now' : 'is-later'}>
                      {o.label}
                      {i === at && pr.of > 1 ? `: ${pr.n} / ${pr.of}` : ''}
                    </li>
                  ))}
                  {who && <li className={ready ? 'is-now' : 'is-later'}>Return to {NPCS[who]?.name ?? who}</li>}
                </ol>
                {!ready && pr.of > 1 && <Bar value={pr.n} max={pr.of} color={main ? '#ffcf5a' : '#6cc4ff'} />}
                <span className="rb-small rb-dim">Reward: {questRewards(h, q).map((x) => x.text).join(' · ')}</span>
              </article>
            );
          })}
        </section>
      ))}
      {gated.length > 0 && (
        <section className="rb-quest-group">
          <span className="rb-kicker">Opens at a higher level</span>
          {gated.map((q) => {
            const main = isMainQuest(q.id);
            return (
              <article key={q.id} className={`rb-quest is-gated${main ? ' is-main' : ' is-side'}`}>
                <div className="rb-quest-head">
                  <img src={mapIconUrl(main ? 'offer' : 'offerSide', 2)} alt="" />
                  <strong>{q.name}</strong>
                  <span className="rb-quest-kind">{main ? 'Story' : 'Side'}</span>
                </div>
                <span className="rb-small">Opens at level {q.level}</span>
              </article>
            );
          })}
        </section>
      )}
      {done.length > 0 && (
        <details className="rb-done">
          <summary>Completed · {done.length}</summary>
          <ul>
            {done.map((q) => (
              <li key={q.id}>✔ {q.name}</li>
            ))}
          </ul>
        </details>
      )}
      {h.perks.length > 0 && (
        <p className="rb-small">
          {h.perks.map((k) => (
            <span key={k} className="rb-chip">
              {PERKS[k].name}: {PERKS[k].text}
            </span>
          ))}
        </p>
      )}
      <p className="rb-small rb-dim">
        {h.stats.kills} foes defeated · {h.stats.deaths} falls · {Math.round(h.stats.time / 60)} minutes played
      </p>
    </div>
  );
}

/** Paragon points (past level 60): four lines to put them in, and all of them back for free. */
function ParagonBox({ engine }: { engine: SigilEngine }) {
  const p = engine.hero!.para;
  const free = paragonFree(p);
  return (
    <div className="rb-paragon" aria-label="Paragon">
      <div className="rb-paragon-head">
        <strong>Paragon {p.l}</strong>
        <span className={free ? 'rb-gold' : 'rb-dim'}>{free ? `${free} point${free === 1 ? '' : 's'} to spend` : p.l ? 'Every point spent' : 'Experience past level 60 earns Paragon levels'}</span>
      </div>
      {PARA_STATS.map((s) => {
        const d = PARAGON[s];
        const full = d.cap !== undefined && p.p[s] >= d.cap;
        return (
          <div key={s} className="rb-paragon-row">
            <span className="rb-paragon-line">
              <b>{d.name}</b>
              <span className="rb-dim rb-small">{d.text} a point</span>
            </span>
            <span className="rb-paragon-n">
              {p.p[s]}
              {d.cap !== undefined && <span className="rb-dim">/{d.cap}</span>}
            </span>
            <button className="rb-btn is-small" aria-label={`A point into ${d.name}`} disabled={!free || full} onClick={() => engine.paragonPoint(s)}>
              +
            </button>
            <button className="rb-btn is-small" aria-label={`Ten points into ${d.name}`} disabled={free < 2 || full} onClick={() => engine.paragonPoint(s, 10)}>
              +10
            </button>
          </div>
        );
      })}
      {paragonSpent(p) > 0 && (
        <button className="rb-btn is-small rb-paragon-reset" onClick={() => engine.paragonReset()}>
          Take every point back
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- map */

function MapPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const w = engine.world!;
  const atStone = !!w.interactable && w.interactable.kind === 'waystone';
  const canTravel = atStone || w.safe;
  const [sel, setSel] = useState<RegionId>(w.region.id);
  const [tier, setTier] = useState(Math.min(h.tier, w.tier || h.tier, h.level >= MAX_LEVEL ? 2 : 1));
  const [mods, setMods] = useState<RiftMod[]>([]);
  // Riftstone: any level the Riftstone has opened (0: the tiers instead)
  const [stone, setStone] = useState(w.keyRun ? Math.min(w.keyRun.key, h.keystone) : 0);
  const r = REGIONS[sel];
  const open = h.unlocked.includes(sel);
  const here = w.region.id === sel;
  // (Mythic and the Riftstones are for heroes at the top level)
  const top = h.level >= MAX_LEVEL;
  const keyed = top && h.keystone >= KEY_MIN && r.kind === 'dungeon';
  const useKey = keyed && stone > 0;
  // difficulty tiers are for dungeons (and the old wood)
  const tiered = h.tier > 0 && (r.kind === 'dungeon' || sel === 'whisperwood');
  const pick = tiered && !useKey ? tier : 0;
  // this week's affixes (read once: the panel isn't open across a Monday)
  const [week] = useState(() => weekOf(Date.now()));
  const goal = trackedQuest(h, w.region.id);
  const goalAt = goal ? questRegion(goal) : undefined;
  const ready = goal && questState(h, goal.id) === 'ready';
  const giver = goal && ready ? turnInNpc(goal) : null;
  return (
    <div className="rb-map">
      <section className="rb-map-left">
        {goal && (
          <div className={`rb-map-quest${isMainQuest(goal.id) ? ' is-main' : ' is-side'}`}>
            <img src={mapIconUrl('quest', 2)} alt="" />
            <span>
              <strong>{goal.name}</strong>
              <span className="rb-small">
                {ready ? `Return to ${giver ? NPCS[giver]?.name : 'them'}` : currentObjective(h, goal).label}
                {/* (elsewhere: the map marks the way out toward it) */}
                {goalAt && goalAt !== w.region.id ? ` · in ${REGIONS[goalAt].name}: the road there is marked` : ''}
              </span>
            </span>
            <button className="rb-btn is-small" onClick={() => engine.openPanel('quests')}>
              Quest log
            </button>
          </div>
        )}
        <span className="rb-kicker">
          {here ? w.region.name : open || r.kind === 'town' ? r.name : 'Unknown land'}
          {here ? !w.fog.all && ` · ${Math.floor(w.explored() * 100)}% explored` : <Explored hero={h} region={sel} />}
          {!here && (
            <button className="rb-map-back" onClick={() => setSel(w.region.id)}>
              back to {w.region.name}
            </button>
          )}
        </span>
        <LandMap key={sel} engine={engine} region={sel} />
      </section>
      <section className="rb-map-right">
        <span className="rb-kicker">{canTravel ? 'The world · travel by waystone' : 'The world · travel from a waystone or a town'}</span>
        <WorldMap hero={h} here={w.region.id} sel={sel} goal={goal ? questRegion(goal) : undefined} counts={questCounts(h)} onSel={setSel} />
        <div className={`rb-dest${open ? '' : ' is-locked'}${here ? ' is-here' : ''}`}>
          <div>
            <strong>
              {open || r.kind === 'town' ? r.name : 'Unknown land'}{' '}
              <span className="rb-dim rb-small">{r.kind === 'town' ? 'Town' : useKey ? `Dungeon · level ${keyLevelFor(h.level)} · Riftstone +${stone}` : `${r.kind === 'dungeon' ? 'Dungeon' : 'Wilds'} · levels ${r.levels[0] + TIERS[pick]!.levels}-${r.levels[1] + TIERS[pick]!.levels}`}</span>
            </strong>
            <span className="rb-small rb-dim">{open ? r.blurb : sel === 'whisperwood' ? 'Finish your training with Elder Maren.' : sel === 'crypt' ? 'Defeat Grimtusk in the Whisperwood.' : 'Not discovered yet: walk there to find it.'}</span>
          </div>
          <button
            className="rb-btn is-small is-gold"
            disabled={!open || !canTravel || (here && !useKey && (r.safe || (pick === w.tier && !w.keyRun)))}
            onClick={() => (useKey ? engine.travel(sel, 2, [], undefined, stone) : engine.travel(sel, pick, mods, undefined))}
          >
            {useKey ? (here ? 'Start again' : 'Start') : here ? 'Here' : 'Go'}
          </button>
        </div>
        {tiered && (
          <div className="rb-tiers">
            <span className="rb-kicker">Difficulty</span>
            <div className="rb-seg">
              {TIERS.slice(0, Math.min(h.tier, top ? 2 : 1) + 1).map((t, i) => (
                <button
                  key={t.name}
                  className={tier === i && !useKey ? 'is-on' : ''}
                  style={{ color: t.color }}
                  onClick={() => {
                    setTier(i);
                    setStone(0);
                  }}
                >
                  {t.name}
                </button>
              ))}
              {keyed && (
                <button className={useKey ? 'is-on rb-mplus' : 'rb-mplus'} onClick={() => setStone(stone || h.keystone)}>
                  Riftstone
                </button>
              )}
            </div>
            {useKey ? (
              <>
                <KeyPicker heroLevel={h.level} region={r} stone={stone} top={h.keystone} best={h.bestKeys[sel] ?? 0} week={week} onPick={setStone} />
                <RiftGuide hero={h} />
                <button
                  className="rb-btn is-small"
                  onClick={() => {
                    // the party's plan starts where this picker is
                    if (!engine.party) void engine.createParty().then(() => engine.setPartyPlan(sel, stone));
                    else engine.setPartyPlan(sel, stone);
                    engine.openPanel('party');
                  }}
                >
                  {engine.party ? 'Party: run this' : 'Play with friends'}
                </button>
              </>
            ) : (
              <span className="rb-small rb-dim">
                {TIERS[tier]!.name}: enemies +{TIERS[tier]!.levels} levels, ×{TIERS[tier]!.loot} loot, ×{TIERS[tier]!.xp} XP{tier > 0 ? ', elites with more affixes' : ''}.
              </span>
            )}
            {tier > 0 && !useKey && (
              <div className="rb-mods">
                {(Object.keys(RIFT_MODS) as RiftMod[]).map((m) => (
                  <label key={m} className="rb-check">
                    <input type="checkbox" checked={mods.includes(m)} onChange={(e) => setMods(e.target.checked ? [...mods, m] : mods.filter((x) => x !== m))} />
                    <span>
                      <b>{RIFT_MODS[m].name}</b> {RIFT_MODS[m].text} <span className="rb-gold">+{Math.round(RIFT_MODS[m].bonus * 100)}% rewards</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Riftstone at a waystone: the level (any the Riftstone has opened), what it does, the clock, this week's affixes. */
function KeyPicker({ heroLevel, region, stone, top, best, week, onPick }: { heroLevel: number; region: RegionDef; stone: number; top: number; best: number; week: number; onPick: (n: number) => void }) {
  const sc = keyScale(stone, heroLevel);
  const on = keyAffixes(stone, week);
  return (
    <div className="rb-key">
      <div className="rb-key-row">
        <button className="rb-btn is-small" aria-label="One level lower" disabled={stone <= KEY_MIN} onClick={() => onPick(stone - 1)}>
          −
        </button>
        <strong className="rb-key-lvl">Riftstone +{stone}</strong>
        <button className="rb-btn is-small" aria-label="One level higher" disabled={stone >= top} onClick={() => onPick(stone + 1)}>
          +
        </button>
        {stone < top && (
          <button className="rb-btn is-small" onClick={() => onPick(top)}>
            Highest (+{top})
          </button>
        )}
      </div>
      <span className="rb-small">
        Enemies at level {keyLevelFor(heroLevel)} with ×{sc.hp.toFixed(1)} health and ×{sc.dmg.toFixed(1)} damage. The clock: <b className="rb-gold">{clockText(keyParFor(region, heroLevel))}</b> (each fall costs {KEY_DEATH} s). Beat it to
        open the next levels (up to three, by how fast); late, nothing is lost. Loot of item level {keyLoot(stone, heroLevel)}
        {best ? `; your best here is +${best}` : ''}.
      </span>
      <ul className="rb-affixes">
        {weekAffixes(week).map((a) => (
          <li key={a.at} className={on.includes(a.affix) && stone >= a.at ? '' : 'rb-dim'}>
            <b>
              +{a.at} {KEY_AFFIXES[a.affix].name}
            </b>{' '}
            {KEY_AFFIXES[a.affix].text}
          </li>
        ))}
      </ul>
    </div>
  );
}

const KIND_COLOR: Record<RegionDef['kind'], string> = { town: '#ffcf5a', wild: '#6ad06a', dungeon: '#c58cff' };

/*
 * The world map is a tree (ui/worldLayout.ts): the land the story starts in at the foot, each land a row above the
 * land its road comes from, the story's road straight up the middle and what branches off it to the sides.
 */
/** World-map units for its names (the map is drawn at least WORLD_PX screen pixels a unit, so they stay readable). */
const NAME_SIZE = 3.1;
const LVL_SIZE = 2.7;
const WORLD_PX = 2.9;
/** How far in the world map zooms, from the whole world. */
const WORLD_ZOOM = 4;
/** Map units from one column of the tree to the next (a mark and its name beside it), and from a row to the next. */
const COL = 36;
const ROW = 12.5;
/** Where the story starts: the foot of the tree. */
const WORLD_ROOT: RegionId = 'briarhollow';

/** The roads between the lands of the map (not into a land out of the story, nor through a door into a building). */
const mapLinks = (): [RegionId, RegionId][] => regionLinks().filter(([a, b]) => REGION_IDS.includes(a) && REGION_IDS.includes(b));
/** The lands with a road to another land of the map; the others (a dungeon whose land is out of the story) show only to a hero who has been there. */
function mapLands(known: (id: RegionId) => boolean): RegionId[] {
  const joined = new Set(mapLinks().flat());
  return REGION_IDS.filter((id) => joined.has(id) || (known(id) && REGIONS[id].kind !== 'town'));
}

/** The world at a glance: every land in the order the story reaches it, the roads on, what is still unknown. */
function WorldMap({ hero, here, sel, goal, counts, onSel }: { hero: Character; here: RegionId; sel: RegionId; goal?: RegionId; counts: Map<RegionId, { work: number; offers: number }>; onSel: (r: RegionId) => void }) {
  const known = (id: RegionId): boolean => hero.unlocked.includes(id) || REGIONS[id].kind === 'town';
  const lands = mapLands((id) => hero.unlocked.includes(id));
  const landKey = lands.join('|');
  const plan = useMemo(() => planWorld(landKey.split('|') as RegionId[], mapLinks(), (id) => REGIONS[id].levels[0], WORLD_ROOT), [landKey]);
  const at = (id: RegionId): [number, number] => {
    const [c, r] = plan.cell.get(id) ?? [0, 0];
    return [c * COL, -r * ROW];
  };
  // the box fits the tree, with room for the names beside the last column
  const box = useMemo(() => {
    const x0 = plan.cols[0] * COL - 9;
    const y0 = -(plan.rows - 1) * ROW - 8;
    return { x0, y0, w: plan.cols[1] * COL + 35 - x0, h: 8 - y0 };
  }, [plan]);
  // the map opens on the whole world where that is readable; on a small screen, on the hero's own part of it. The
  // wheel, a pinch or the buttons zoom, a drag moves it
  const view = useRef<HTMLDivElement>(null);
  const pz = usePanZoom(view, box.w, box.h, WORLD_ZOOM, (fit) => {
    const [x, y] = at(here);
    return { k: Math.max(1, WORLD_PX / fit), cx: x + 12 - box.x0, cy: y - box.y0 };
  });
  const v = pz.view;
  const vb = v ? [box.x0 + v.cx - pz.vw / 2 / pz.scale, box.y0 + v.cy - pz.vh / 2 / pz.scale, pz.vw / pz.scale, pz.vh / pz.scale] : [box.x0, box.y0, box.w, box.h];
  /** A branch: straight up the trunk, or up from its land, along under the next row and up into the land it leads to. */
  const branch = (a: RegionId, b: RegionId): string => {
    const [x0, y0] = at(a);
    const [x1, y1] = at(b);
    if (x0 === x1) return `M${x0} ${y0}V${y1}`;
    const ym = y0 - ROW / 2;
    const r = 1.8;
    const d = Math.sign(x1 - x0);
    return `M${x0} ${y0}V${ym}H${x1 - d * r}Q${x1} ${ym} ${x1} ${ym - r}V${y1}`;
  };
  /** Another road from the picked land: a low arc from mark to mark. */
  const arc = (a: RegionId, b: RegionId): string => {
    const [x0, y0] = at(a);
    const [x1, y1] = at(b);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const bow = Math.min(7, len * 0.22);
    return `M${x0} ${y0}Q${(x0 + x1) / 2 + ((y1 - y0) / len) * bow} ${(y0 + y1) / 2 - ((x1 - x0) / len) * bow} ${x1} ${y1}`;
  };
  return (
    <div
      className="rb-world-view"
      ref={view}
      // (a drag is not a click on the land it ends on)
      onClickCapture={(e) => {
        if (!pz.dragged()) return;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <ZoomButtons pz={pz} max={WORLD_ZOOM} />
      <svg className="rb-world" viewBox={vb.join(' ')} role="group" aria-label="World map">
        <rect x={box.x0} y={box.y0} width={box.w} height={box.h} rx="3" className="rb-world-sea" />
        {plan.roads.map(([a, b]) => (
          <path key={`${a}-${b}`} d={branch(a, b)} className={`rb-world-road${known(a) && known(b) ? ' is-known' : ''}`} />
        ))}
        {/* the picked land's other roads (a tree shows one way to each land; some have two) */}
        {plan.ties
          .filter(([a, b]) => (a === sel || b === sel) && known(a) && known(b))
          .map(([a, b]) => (
            <path key={`${a}~${b}`} d={arc(a, b)} className="rb-world-tie" />
          ))}
        {plan.ids.map((id) => {
          const r = REGIONS[id];
          const [x, y] = at(id);
          const k = known(id);
          const col = k ? KIND_COLOR[r.kind] : '#6a6480';
          const lines = k ? nameLines(r.name.replace(/^The /, '')) : [];
          const lvl = k && r.kind !== 'town';
          // its name beside its mark, its lines (and its levels under them) about the mark's middle
          const tall = lines.length * NAME_SIZE * 1.12 + (lvl ? LVL_SIZE * 1.15 : 0);
          const top = y - tall / 2 + NAME_SIZE * 0.86;
          return (
            <g key={id} className={`rb-world-node${id === sel ? ' is-sel' : ''}`} onClick={() => onSel(id)} role="button" aria-label={k ? r.name : 'Unknown land'} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSel(id)}>
              {id === here && <circle cx={x} cy={y} r="5.2" className="rb-world-here" />}
              {/* a house, a tree, a gate; a grey "?" where the hero has not been */}
              <circle cx={x} cy={y} r="3.4" className="rb-world-mark" stroke={col} />
              <image href={mapIconUrl(k ? (r.kind === 'town' ? 'town' : r.kind === 'dungeon' ? 'dungeon' : 'wild') : 'unknown', 3)} x={x - 3} y={y - 3} width="6" height="6" className="rb-world-icon" />
              {id === goal && (
                <text x={x - 3.4} y={y - 2.4} className="rb-world-goal">
                  !
                </text>
              )}
              {/* how many quests have work here (a number), and quests to take here (a blue "!") */}
              {(counts.get(id)?.work ?? 0) > (id === goal ? 1 : 0) && (
                <text x={x - 3.8} y={y + 4.6} className="rb-world-count">
                  {counts.get(id)!.work}
                </text>
              )}
              {(counts.get(id)?.offers ?? 0) > 0 && (
                <text x={x + 3.2} y={y - 2.6} className="rb-world-offer">
                  !
                </text>
              )}
              {lines.map((line, i) => (
                <text key={i} x={x + 5} y={top + i * NAME_SIZE * 1.12} className="rb-world-name">
                  {line}
                </text>
              ))}
              {lvl && (
                <text x={x + 5} y={top + lines.length * NAME_SIZE * 1.12 - NAME_SIZE * 0.86 + LVL_SIZE} className="rb-world-lvl">
                  {r.levels[0] === r.levels[1] ? `level ${r.levels[0]}` : `levels ${r.levels[0]}-${r.levels[1]}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The lands' maps, made from their layouts once (another land's, picked on the world map). */
const landMaps = new Map<RegionId, TileMap>();
function landMap(id: RegionId): TileMap {
  let m = landMaps.get(id);
  if (!m) {
    m = parseRegion(REGIONS[id]);
    landMaps.set(id, m);
  }
  return m;
}

/** A land's ground, a pixel a tile, colored by what each tile is. */
const grounds = new WeakMap<TileMap, HTMLCanvasElement>();
function groundOf(m: TileMap, theme: RegionDef['theme']): HTMLCanvasElement {
  const hit = grounds.get(m);
  if (hit) return hit;
  const ground = document.createElement('canvas');
  ground.width = m.w;
  ground.height = m.h;
  const gg = ground.getContext('2d')!;
  const pal = mapColors(theme);
  const color = (t: number): string => {
    if (t === K.Wall || t === K.Illusion) return pal.wall;
    if (t === K.Water) return pal.water;
    if (t === K.Path || t === K.Bridge) return pal.path;
    if (t === K.Cobble) return pal.cobble;
    if (t === K.Sand) return pal.sand;
    if (t === K.Tree || t === K.Bush) return pal.wall;
    if (t === K.House || t === K.HouseAnchor) return pal.house;
    if (t === K.Door) return '#8a6a3a';
    return pal.floor;
  };
  for (let i = 0; i < m.w * m.h; i++) {
    gg.fillStyle = color(m.kind[i]!);
    gg.fillRect(i % m.w, Math.floor(i / m.w), 1, 1);
  }
  grounds.set(m, ground);
  return ground;
}

/** The fog of war, a pixel a fog cell: black where the hero hasn't been (drawn smooth, so its edge is soft). */
function fogOf(fog: Fog): HTMLCanvasElement {
  const f = document.createElement('canvas');
  f.width = fog.w;
  f.height = fog.h;
  const fg = f.getContext('2d')!;
  const img = fg.createImageData(fog.w, fog.h);
  for (let i = 0; i < fog.cells.length; i++) {
    if (fog.cells[i]) continue;
    img.data[i * 4] = 7;
    img.data[i * 4 + 1] = 5;
    img.data[i * 4 + 2] = 12;
    img.data[i * 4 + 3] = 255;
  }
  fg.putImageData(img, 0, 0);
  return f;
}

/** Zoom in, out, and back to the whole map. */
function ZoomButtons({ pz, max }: { pz: PanZoom; max: number }) {
  const k = pz.view?.k ?? 1;
  return (
    <div className="rb-zoom">
      <button className="rb-btn is-small" aria-label="Zoom in" disabled={k >= max - 1e-3} onClick={() => pz.zoomBy(1.6)}>
        +
      </button>
      <button className="rb-btn is-small" aria-label="Zoom out" disabled={k <= 1 + 1e-3} onClick={() => pz.zoomBy(1 / 1.6)}>
        −
      </button>
      <button className="rb-btn is-small" aria-label="The whole map" disabled={k <= 1 + 1e-3} onClick={pz.fitAll}>
        ⤢
      </button>
    </div>
  );
}

const LAND_ZOOM = 6;

/** How much of another land the hero has explored. */
function Explored({ hero, region }: { hero: Character; region: RegionId }) {
  const m = landMap(region);
  const f = loadFog(hero, region, m.w, m.h);
  return <>{f.all ? '' : f.count ? ` · ${Math.floor((f.count / (f.w * f.h)) * 100)}% explored` : ' · not explored'}</>;
}

/**
 * A land's map: the one the hero is in, with them on it, or another picked on the world map, as far as the
 * hero has explored it (black where they haven't been: all black for a land they have never set foot in).
 * The wheel, a pinch or the buttons zoom; a drag moves it.
 */
function LandMap({ engine, region }: { engine: SigilEngine; region: RegionId }) {
  const w = engine.world!;
  const h = engine.hero!;
  const live = region === w.region.id;
  const r = REGIONS[region];
  const m = live ? w.map : landMap(region);
  const fog = useMemo(() => (live ? w.fog : loadFog(h, region, m.w, m.h)), [live, w, h, region, m]);
  const dark = !fog.all && fog.count === 0;
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  // where the quest marks were drawn (css px in the canvas), for a tap to follow one
  const hits = useRef<{ x: number; y: number; quest: string }[]>([]);
  // the land the hero is in opens round them; another, whole
  const pz = usePanZoom(box, m.w, m.h, LAND_ZOOM, () => (live ? { k: 1.6, cx: w.player.x / TILE, cy: w.player.y / TILE } : { k: 1, cx: m.w / 2, cy: m.h / 2 }));
  const v = pz.view;
  useEffect(() => {
    const c = ref.current;
    if (!c || !v) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(pz.vw * dpr);
    c.height = Math.round(pz.vh * dpr);
    const g = c.getContext('2d')!;
    g.fillStyle = '#07050c';
    g.fillRect(0, 0, c.width, c.height);
    if (dark) return;
    const k = pz.scale * dpr;
    const ox = c.width / 2 - v.cx * k;
    const oy = c.height / 2 - v.cy * k;
    g.imageSmoothingEnabled = false;
    g.drawImage(groundOf(m, r.theme), ox, oy, m.w * k, m.h * k);
    if (!fog.all) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(fogOf(fog), ox, oy, fog.w * FOG_CELL * k, fog.h * FOG_CELL * k);
    }
    const s = Math.max(1, Math.round(dpr * 1.5));
    const icon = (x: number, y: number, name: MapIcon): void => drawMapIcon(g, name, ox + (x / TILE) * k, oy + (y / TILE) * k, s);
    // what stands in the fog is not on the map yet
    const seen = (x: number, y: number): boolean => fogSeen(fog, x / TILE, y / TILE);
    if (!live) {
      // another land: where its waystones and its ways out are (who stands there is the story's business)
      for (const pm of m.markers) {
        const at = markerPos(pm);
        if (!seen(at.x, at.y)) continue;
        if (pm.marker.kind === 'waystone') icon(at.x, at.y, 'waystone');
        if (pm.marker.kind === 'exit') icon(at.x, at.y, pm.marker.door ? 'door' : 'road');
      }
      return;
    }
    for (const ws of w.waystones) if (seen(ws.x, ws.y)) icon(ws.x, ws.y, 'waystone');
    for (const c2 of w.chests) if (!c2.open && seen(c2.x, c2.y)) icon(c2.x, c2.y, 'chest');
    for (const n of w.npcs) if (seen(n.x, n.y)) icon(n.x, n.y, npcMark(w, n.id) ?? (NPCS[n.id]?.shop ? 'merchant' : 'person'));
    for (const x of w.exits) if (seen(x.x, x.y)) icon(x.x, x.y, x.door ? 'door' : 'road');
    const goal = objectiveTarget(w);
    // every other quest: a smaller mark (gold the story, blue a side quest), no ring; marks within 10 px of each
    // other (several quests at one person, or behind one way out) stack into one with a count
    const px = (x: number, y: number): [number, number] => [(ox + (x / TILE) * k) / dpr, (oy + (y / TILE) * k) / dpr];
    const stacks: { x: number; y: number; main: boolean; n: number }[] = [];
    hits.current = [];
    for (const o of objectiveTargets(w)) {
      const [cx, cy] = px(o.x, o.y);
      hits.current.push({ x: cx, y: o.quest === goal?.quest ? cy : cy - (6 * s) / dpr, quest: o.quest });
      if (o.quest === goal?.quest) continue;
      const near = stacks.find((st) => Math.hypot(st.x - o.x, st.y - o.y) * (k / dpr / TILE) < 10);
      if (near) {
        near.n++;
        near.main ||= o.main;
      } else stacks.push({ x: o.x, y: o.y, main: o.main, n: 1 });
    }
    if (goal) {
      // ringed, so it is the first thing seen
      g.strokeStyle = '#ffcf5a';
      g.lineWidth = Math.max(1.5, dpr * 1.5);
      g.beginPath();
      g.arc(ox + (goal.x / TILE) * k, oy + (goal.y / TILE) * k, s * 9, 0, Math.PI * 2);
      g.stroke();
      icon(goal.x, goal.y, 'quest');
    }
    icon(w.player.x, w.player.y, 'you');
    const small = Math.max(1, s - 1);
    for (const st of stacks) {
      // raised over its place (a waystone, a person, a way out stays readable under it)
      drawMapIcon(g, st.main ? 'quest' : 'questSide', ox + (st.x / TILE) * k, oy + (st.y / TILE) * k - 6 * s, small);
      if (st.n > 1) {
        const [cx, cy] = [ox + (st.x / TILE) * k, oy + (st.y / TILE) * k - 6 * s];
        g.font = `700 ${Math.round(10 * dpr)}px sans-serif`;
        g.lineWidth = 3 * dpr;
        g.strokeStyle = '#120c08';
        g.fillStyle = '#ffffff';
        g.strokeText(String(st.n), cx + 5 * s, cy - 3 * s);
        g.fillText(String(st.n), cx + 5 * s, cy - 3 * s);
      }
    }
  }, [w, m, r.theme, fog, dark, live, v, pz.vw, pz.vh, pz.scale, engine.version]);
  const key = (name: MapIcon, label: string) => (
    <span className="rb-map-key">
      <img src={mapIconUrl(name, 2)} alt="" /> {label}
    </span>
  );
  const ways = m.markers.filter((pm) => pm.marker.kind === 'exit');
  return (
    <div className="rb-minimap">
      <div className="rb-landmap" ref={box} style={{ aspectRatio: `${m.w} / ${m.h}` }}>
        <canvas
          ref={ref}
          aria-label={dark ? `${r.name}: not explored yet` : `Map of ${r.name}`}
          // a tap on a quest's mark follows it (the box above the map, the arrow and the tracker switch to it)
          onClick={(e) => {
            if (!live || pz.dragged()) return;
            const { offsetX: x, offsetY: y } = e.nativeEvent;
            let best: { quest: string; d: number } | null = null;
            for (const t of hits.current) {
              const d = Math.hypot(t.x - x, t.y - y);
              if (d < 18 && (!best || d < best.d)) best = { quest: t.quest, d };
            }
            if (best && best.quest !== h.tracked) engine.trackQuest(best.quest);
          }}
        />
        {dark ? <span className="rb-landmap-dark">Not explored yet</span> : <ZoomButtons pz={pz} max={LAND_ZOOM} />}
      </div>
      {!dark &&
        (live ? (
          <span className="rb-small rb-dim rb-map-keys">
            {key('you', 'you')}
            {key('quest', 'story quest')}
            {key('questSide', 'side quest (tap to follow)')}
            {w.waystones.length > 0 && key('waystone', 'waystone')}
            {key('road', 'road')}
            {w.exits.some((x) => x.door) && key('door', 'door')}
            {w.chests.length > 0 && key('chest', 'chest')}
            {w.npcs.length > 0 && key('person', 'people')}
            {w.npcs.some((n) => NPCS[n.id]?.shop) && key('merchant', 'merchant')}
          </span>
        ) : (
          <span className="rb-small rb-dim rb-map-keys">
            {m.markers.some((pm) => pm.marker.kind === 'waystone') && key('waystone', 'waystone')}
            {ways.some((pm) => pm.marker.kind === 'exit' && !pm.marker.door) && key('road', 'road')}
            {ways.some((pm) => pm.marker.kind === 'exit' && pm.marker.door) && key('door', 'door')}
          </span>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------ settings */

export function SettingsPanel({ engine, onClose }: { engine: SigilEngine; onClose: () => void }) {
  const s = engine.settings;
  const set = engine.setSettings.bind(engine);
  const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'deadzone' | 'sensitivity' | 'joystick' | 'zoom', min: number, max: number, step: number, show: (v: number) => string) => (
    <label className="rb-range">
      <span>
        {label} <b>{show(s[key])}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={s[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  );
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  return (
    <Frame title="Settings" onClose={onClose} wide>
      <div className="rb-settings">
        <section>
          <span className="rb-kicker">Sound</span>
          <label className="rb-check">
            <input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: e.target.checked })} />
            <span>Mute everything</span>
          </label>
          {slider('Volume', 'master', 0, 1, 0.05, pct)}
          {slider('Music', 'music', 0, 1, 0.05, pct)}
          {slider('Effects', 'sfx', 0, 1, 0.05, pct)}
        </section>
        <section>
          <span className="rb-kicker">Camera</span>
          {slider('Camera distance', 'zoom', ZOOM_MIN, ZOOM_MAX, 0.05, pct)}
          <span className="rb-small rb-dim">100% is the game's own view. Further out shows more of the land around you; closer shows your hero bigger.</span>
        </section>
        <section>
          <span className="rb-kicker">Touch controls</span>
          {slider('Joystick size', 'joystick', 40, 84, 2, (v) => `${v}px`)}
          {slider('Dead zone', 'deadzone', 0.04, 0.4, 0.02, pct)}
          {slider('Sensitivity', 'sensitivity', 0.6, 1.8, 0.05, (v) => `${v.toFixed(2)}×`)}
          <div className="rb-seg" role="group" aria-label="Joystick">
            <button className={s.joyMode === 'float' ? 'is-on' : ''} onClick={() => set({ joyMode: 'float' })}>
              Joystick where I touch
            </button>
            <button className={s.joyMode === 'fixed' ? 'is-on' : ''} onClick={() => set({ joyMode: 'fixed' })}>
              Fixed joystick
            </button>
          </div>
          <label className="rb-check">
            <input type="checkbox" checked={s.lefty} onChange={(e) => set({ lefty: e.target.checked })} />
            <span>Left-handed (skills on the left)</span>
          </label>
        </section>
        <section>
          <span className="rb-kicker">Aiming</span>
          <label className="rb-check">
            <input type="checkbox" checked={s.autoTarget} onChange={(e) => set({ autoTarget: e.target.checked })} />
            <span>Attack aims at the nearest enemy</span>
          </label>
          <label className="rb-check">
            <input type="checkbox" checked={s.autoAimSkills} onChange={(e) => set({ autoAimSkills: e.target.checked })} />
            <span>Skills aim at the nearest enemy when tapped</span>
          </label>
          {!engine.touchMode && (
            <label className="rb-check">
              <input type="checkbox" checked={s.quickCast} onChange={(e) => set({ quickCast: e.target.checked })} />
              <span>The Ring: quick cast (a placed spell drops at your pointer when you press its key)</span>
            </label>
          )}
          <div className="rb-seg" role="group" aria-label="Aim assist">
            {['Off', 'Light', 'Strong'].map((l, i) => (
              <button key={l} className={s.aimAssist === i ? 'is-on' : ''} onClick={() => set({ aimAssist: i })}>
                Aim assist: {l}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">Spells go where your hero faces (the small arrow) or where you drag them. Aim assist nudges a dragged aim by a few degrees toward an enemy; it never overrides where you point.</span>
          {/* (a phone has no keys to choose: the keyboard's part is for whoever is playing with one) */}
          {!engine.touchMode && (
            <>
              <span className="rb-kicker">Keyboard</span>
              <div className="rb-seg" role="group" aria-label="Ultimate key">
                {(['f', 't', 'shift', 'rmb'] as const).map((k) => (
                  <button key={k} className={s.ultKey === k ? 'is-on' : ''} onClick={() => set({ ultKey: k })}>
                    Ultimate: {k === 'rmb' ? 'Right mouse' : k === 'shift' ? 'Shift' : k.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="rb-seg" role="group" aria-label="Fourth skill key">
                {(['c', 'v', 'z', 'x'] as const).map((k) => (
                  <button key={k} className={s.skill4Key === k ? 'is-on' : ''} onClick={() => set({ skill4Key: k })}>
                    Fourth skill: {k.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="rb-small rb-dim">WASD move · mouse aim · left click attack · Q E R {s.skill4Key.toUpperCase()} skills · Space dodge · {s.ultKey === 'rmb' ? 'Right mouse' : s.ultKey === 'shift' ? 'Shift' : s.ultKey.toUpperCase()} ultimate · 1 potion · Y ride · {s.ultKey === 'f' ? 'G' : 'F'} or Enter talk/travel · I bag · K talents · U skills · J quests · M map · O play together · Esc pause</span>
            </>
          )}
        </section>
        <section>
          <span className="rb-kicker">Tutorial hints</span>
          <div className="rb-radios" role="radiogroup" aria-label="Tutorial hints">
            <label className="rb-check">
              <input type="radio" name="rb-tutorial" checked={s.tutorial} onChange={() => engine.setTutorial(true)} />
              <span>On</span>
            </label>
            <label className="rb-check">
              <input type="radio" name="rb-tutorial" checked={!s.tutorial} onChange={() => engine.setTutorial(false)} />
              <span>Off</span>
            </label>
          </div>
          <span className="rb-small rb-dim">Short hints that pause the game to show a new hero the controls, the bag, new skills and talents.</span>
        </section>
        <section>
          <span className="rb-kicker">Display</span>
          <label className="rb-check">
            <input type="checkbox" checked={s.shake} onChange={(e) => set({ shake: e.target.checked })} />
            <span>Screen shake</span>
          </label>
          <label className="rb-check">
            <input type="checkbox" checked={s.numbers} onChange={(e) => set({ numbers: e.target.checked })} />
            <span>Damage numbers</span>
          </label>
          <label className="rb-check">
            <input type="checkbox" checked={s.plates} onChange={(e) => set({ plates: e.target.checked })} />
            <span>Health bars over heads (yours, and every enemy’s)</span>
          </label>
          <label className="rb-check">
            <input type="checkbox" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} />
            <span>Reduced motion (no shake, calmer weather and effects)</span>
          </label>
          <label className="rb-check">
            <input type="checkbox" checked={s.ringPlates} onChange={(e) => set({ ringPlates: e.target.checked })} />
            <span>Nameplates in The Ring (the fighters’ names and bars along the top of a match)</span>
          </label>
          <button className="rb-btn is-small is-ghost" onClick={() => engine.resetSettings()}>
            Reset settings
          </button>
          <span className="rb-small rb-dim">
            {engine.canSave ? 'Your heroes are saved on this device. Sign in on GlitchBound and they follow you to your other devices.' : 'Saving is off on this device right now.'}
          </span>
        </section>
        <section>
          <span className="rb-kicker">Art credits</span>
          <span className="rb-small rb-dim">{ART_CREDITS.join(' · ')}. Item icons and the interface are made for the game.</span>
        </section>
        <section>
          <span className="rb-kicker">Music and sound credits</span>
          <span className="rb-small rb-dim">{SOUND_CREDITS.join(' ')}</span>
        </section>
        <p className="rb-small rb-dim rb-version">Sigilfall {GAME_VERSION}</p>
        {engine.reviewTools && engine.hero && (
          <section>
            <span className="rb-kicker">Review presets</span>
            <span className="rb-small rb-dim">Jumps this hero to a story beat. The hero then plays for review only and sends no arcade scores.</span>
            <div className="rb-presets">
              {PRESETS.map((p) => (
                <button key={p.id} className="rb-btn is-small is-ghost" onClick={() => engine.usePreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </Frame>
  );
}

/**
 * The art packs the game is built with (CREDITS_AND_LICENSES.md): credit is optional under each license but
 * none of them is required by its license, given anyway.
 */
const ART_CREDITS = [
  'Royal Keep and Royal Keep Seasons by bubbabba',
  'Magic Spells VFX and Magic Circles VFX by Willosuna',
  'Gloomvault Crypt by Certainity',
  'Skill and talent icons: Nasha’s Lumenfall, Skill & Spell Icons Vol. 1, by nanasha.',
  '3D models: KayKit by Kay Lousberg, Kenney, and Quaternius.',
];

/** Who made what is heard. The music and one sound library ask to be credited (CC BY), with their link and license. */
const SOUND_CREDITS = [
  `Music by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 (creativecommons.org/licenses/by/4.0), each piece cut to length: ${MUSIC_CREDITS.join(', ')}.`,
  'Sound effects from the Fantasy Sound Effects Library by Little Robot Sound Factory (www.littlerobotsoundfactory.com), licensed under Creative Commons: By Attribution 3.0 (creativecommons.org/licenses/by/3.0), cut and leveled.',
  'More sound effects, given to the public domain (CC0) on opengameart.org, by artisticdude, rubberduck, Vehicle, StarNinjas, Kenney, Someoneman, Ogrebane, qubodup, TinyWorlds, Kresiek The Furry and SketchMan3.',
];

/** The hero in everything they wear (and the Wardrobe looks over it); tap to turn them around. */
function HeroDoll({ look, held = null, shield = false, area = 'doll' }: { look: HeroLook; held?: { kind: string; tint?: string } | null; shield?: boolean; area?: string }) {
  const [view, setView] = useState(0);
  const views = ['down', 'side', 'up'] as const;
  return (
    <button className="rb-doll" style={{ gridArea: area }} onClick={() => setView((v) => (v + 1) % views.length)} aria-label="Your hero in their gear (tap to turn)">
      <img src={heroDollUrl(look, views[view]!, 4, held, shield)} alt="" draggable={false} />
    </button>
  );
}

/* ----------------------------------------------------------- wardrobe */

const LOOK_LABEL: Record<LookSlot, string> = { head: 'Head', chest: 'Chest', weapon: 'Weapon' };
const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };

/**
 * The Wardrobe (blueprint §6.2): the looks the hero owns for their head, chest and weapon, shown over what
 * they wear without touching its stats; the hand-made looks not found yet as silhouettes with where they
 * come from; and the mounts.
 */
function WardrobePanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const storeOpen = useStoreOpen();
  const [tab, setTab] = useState<LookSlot | 'mounts'>('head');
  // the tile picked: a look id, 'equipped', 'bare', or a mount id
  const [pick, setPick] = useState<string | null>(null);
  const worn = wornLooks(h);
  const slot = tab === 'mounts' ? null : tab;
  const tiles = useMemo(() => {
    if (!slot) return [];
    const owned = h.looks.map((id) => lookOf(id)).filter((l): l is Look => !!l && l.slot === slot && lookFits(l, h.cls));
    owned.sort((a, b) => Number(b.authored) - Number(a.authored) || RARITY_RANK[a.r]! - RARITY_RANK[b.r]! || a.name.localeCompare(b.name));
    // the shop's looks this account owns come first (any class wears them)
    owned.unshift(...ownedShopLooks().filter((l) => l.slot === slot));
    const have = new Set(owned.map((l) => l.id));
    const locked = authoredLooks(h.cls, slot).filter((l) => !have.has(l.id));
    locked.sort((a, b) => RARITY_RANK[a.r]! - RARITY_RANK[b.r]! || a.name.localeCompare(b.name));
    // (and the Ring's armor still to be earned, lowest rank first)
    locked.unshift(...RING_LOOKS.filter((l) => l.slot === slot && !have.has(l.id)));
    return [...owned.map((l) => ({ look: l, owned: true })), ...locked.map((l) => ({ look: l, owned: false }))];
  }, [h, slot, engine.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const authoredOwned = h.looks.filter((id) => lookOf(id)?.authored && lookFits(lookOf(id)!, h.cls)).length;
  const authoredAll = (['head', 'chest', 'weapon'] as const).reduce((n, s) => n + authoredLooks(h.cls, s).length, 0);
  const found = h.looks.filter((id) => lookOf(id) && !lookOf(id)!.authored && lookFits(lookOf(id)!, h.cls)).length;
  const picked = slot && pick && pick !== 'equipped' && pick !== BARE_LOOK ? tiles.find((t) => t.look.id === pick) : undefined;
  // the doll shows the picked look on its slot before it is applied
  const previewWorn = { ...worn };
  if (slot && pick === 'equipped') delete previewWorn[slot];
  else if (slot && pick === BARE_LOOK && slot !== 'weapon') previewWorn[slot] = 'bare';
  else if (slot && picked) previewWorn[slot] = picked.look;
  const look = heroLook(h.cls, h.equip, previewWorn, h.body, h.face);
  const equipped = slot ? h.equip[slot] : undefined;
  const current = slot ? wornId(h, slot) : undefined;
  const mount = tab === 'mounts' && pick ? mountDef(pick) : undefined;
  const rides = ridingOpen(h);
  const riddenId = riddenMount(h);
  const ridden = riddenId ? mountDef(riddenId) : undefined;
  // the shop's mounts this account owns, after the game's own (ridden once the story has horses in it)
  const shopMounts = ownedShopMounts();
  const allMounts = [...MOUNTS, ...shopMounts];
  const has = (id: string): boolean => h.mounts.includes(id) || shopMounts.some((m) => m.id === id);
  // (the mounts' pictures come in one at a time)
  const [, pictureCame] = useState(0);
  useEffect(() => (tab === 'mounts' ? watchMountPictures(() => pictureCame((n) => n + 1)) : undefined), [tab]);
  return (
    <div className="rb-hero rb-wardrobe">
      <section className="rb-hero-left" aria-label="Preview">
        {tab === 'mounts' ? (
          <div className="rb-mount-pic">{(mount ?? ridden) && <img src={mountPictureUrl((mount ?? ridden)!, mount && !has(mount.id) ? null : heroLook(h.cls, h.equip, worn, h.body, h.face), 6)} alt="" className={mount && !has(mount.id) ? 'is-locked' : ''} draggable={false} />}</div>
        ) : (
          <HeroDoll look={look} held={heldWeapon(h.cls, h.equip.weapon, previewWorn.weapon)} shield={h.cls === 'warrior' || h.cls === 'paladin'} area="auto" />
        )}
        <ul className="rb-worn">
          {LOOK_SLOTS.map((s) => {
            const w = worn[s];
            return (
              <li key={s}>
                <span className="rb-dim">{LOOK_LABEL[s]}</span> {w === 'bare' ? 'Bare' : w ? w.name : h.equip[s] ? `${itemName(h.equip[s]!)} (equipped)` : 'Nothing'}
              </li>
            );
          })}
          <li>
            <span className="rb-dim">Mount</span> {ridden ? ridden.name : 'None yet'}
          </li>
        </ul>
        <p className="rb-small rb-dim">Looks change only how you appear. Your stats always come from what you have equipped.</p>
        {/* (the game's own shop, for whoever wants more to wear: one quiet line under the collection) */}
        {storeOpen && (
          <button className="rb-linkbtn rb-small" onClick={() => engine.openPanel('store')}>
            More looks and mounts in the shop
          </button>
        )}
      </section>
      <section className="rb-bag" aria-label="Collection">
        <div className="rb-bag-head">
          <strong>{tab === 'mounts' ? `Mounts ${h.mounts.length + shopMounts.length}/${allMounts.length}` : `Looks ${authoredOwned}/${authoredAll} · ${found} found`}</strong>
          <div className="rb-seg" role="group" aria-label="Slot">
            {(['head', 'chest', 'weapon', 'mounts'] as const).map((t) => (
              <button
                key={t}
                data-look-tab={t}
                className={tab === t ? 'is-on' : ''}
                onClick={() => {
                  setTab(t);
                  setPick(null);
                }}
              >
                {t === 'mounts' ? 'Mounts' : LOOK_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {slot ? (
          <div className="rb-bag-grid">
            <button className={`rb-bslot rb-look-tile${pick === 'equipped' ? ' is-sel' : ''}${!current ? ' is-worn' : ''}`} onClick={() => setPick('equipped')} aria-label="Use the equipped look">
              {equipped ? <ItemIcon item={equipped} size={40} /> : <span className="rb-eslot-empty">Gear</span>}
              <span className="rb-look-tag">Equipped</span>
            </button>
            {slot !== 'weapon' && (
              <button className={`rb-bslot rb-look-tile${pick === BARE_LOOK ? ' is-sel' : ''}${current === BARE_LOOK ? ' is-worn' : ''}`} onClick={() => setPick(BARE_LOOK)} aria-label="Bare">
                <span className="rb-eslot-empty">Bare</span>
              </button>
            )}
            {tiles.map(({ look: l, owned }) => (
              <button key={l.id} className={`rb-bslot rb-look-tile${pick === l.id ? ' is-sel' : ''}${current === l.id ? ' is-worn' : ''}${owned ? '' : ' is-locked'}${l.shop ? ' is-shop' : ''}`} onClick={() => setPick(l.id)} aria-label={owned ? l.name : `Locked: ${l.name}`} style={{ ['--rc' as string]: rarityColor(l.r) }}>
                <img src={itemIconUrl({ icon: l.icon, tint: l.tint }, 4)} alt="" width={40} height={40} draggable={false} />
                {l.shop && <span className="rb-look-tag is-shop">Shop</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            {!rides && <p className="rb-small rb-mount-lock">{ridingLocked()}. Until then no mount can be earned or ridden.</p>}
            <div className="rb-mount-grid">
              {allMounts.map((m) => {
                const owned = has(m.id);
                return (
                  <button key={m.id} className={`rb-mount-tile${pick === m.id ? ' is-sel' : ''}${riddenId === m.id ? ' is-worn' : ''}${owned ? '' : ' is-locked'}`} onClick={() => setPick(m.id)} aria-label={owned ? m.name : `Locked: ${m.name}`}>
                    <img src={mountPictureUrl(m, null, 1)} alt="" draggable={false} />
                    <span>{m.name}</span>
                    <span className={`rb-look-tag is-${m.tier}`}>{m.tier === 'travel' ? 'Travel' : m.tier === 'story' ? 'Story' : m.tier === 'shop' ? 'Shop' : 'Prestige'}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
      <section className={`rb-detail${pick ? ' is-open' : ''}`} aria-label="Details">
        {slot && pick ? (
          <div className="rb-item" style={{ ['--rc' as string]: picked ? rarityColor(picked.look.r) : undefined }}>
            <div className="rb-item-head">
              <div>
                <strong className="rb-item-name">{pick === 'equipped' ? 'Equipped look' : pick === BARE_LOOK ? 'Bare' : picked!.look.name}</strong>
                <span className="rb-dim rb-small">{pick === 'equipped' ? `Show what you have equipped on your ${LOOK_LABEL[slot].toLowerCase()}.` : pick === BARE_LOOK ? `Show nothing over your ${LOOK_LABEL[slot].toLowerCase()}, whatever you wear there.` : picked!.look.shop ? `Shop ${LOOK_LABEL[slot].toLowerCase()} look · any class` : `${RARITY_NAME[picked!.look.r]} ${LOOK_LABEL[slot].toLowerCase()} look${picked!.look.cls ? ` · ${CLASSES[picked!.look.cls].name} only` : ''}`}</span>
              </div>
              <button className="rb-x is-small" onClick={() => setPick(null)} aria-label="Close details">
                ✕
              </button>
            </div>
            {picked && <p className="rb-small">{picked.owned ? (picked.look.authored ? lookSource(h, picked.look.id) : 'A piece you found. Its look is yours to keep.') : `Not found yet · ${lookSource(h, picked.look.id)}`}</p>}
            <div className="rb-row">
              {pick === 'equipped' ? (
                <button className="rb-btn" disabled={!current} onClick={() => engine.wearLook(slot, null)}>
                  {current ? 'Use equipped look' : 'Showing equipped look'}
                </button>
              ) : pick === BARE_LOOK ? (
                <button className="rb-btn" disabled={current === BARE_LOOK} onClick={() => engine.wearLook(slot, BARE_LOOK)}>
                  {current === BARE_LOOK ? 'Worn' : 'Apply look'}
                </button>
              ) : picked?.owned ? (
                <>
                  <button className="rb-btn" disabled={current === pick} onClick={() => engine.wearLook(slot, pick)}>
                    {current === pick ? 'Worn' : 'Apply look'}
                  </button>
                  {current === pick && (
                    <button className="rb-btn is-ghost" onClick={() => engine.wearLook(slot, null)}>
                      Clear look
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : mount ? (
          <div className="rb-item">
            <div className="rb-item-head">
              <div>
                <strong className="rb-item-name">{mount.name}</strong>
                <span className="rb-dim rb-small">{has(mount.id) ? mount.from : `Not earned yet · ${mount.from}`}</span>
              </div>
              <button className="rb-x is-small" onClick={() => setPick(null)} aria-label="Close details">
                ✕
              </button>
            </div>
            <p className="rb-small">{mount.lore}</p>
            <p className="rb-small rb-dim">Every mount runs at the same pace. {engine.touchMode ? 'Tap the horseshoe to ride' : 'Press Y to ride'}; you get down when you fight, and there is no riding in dungeons.</p>
            {mount.tier === 'shop' && has(mount.id) && !ridingOpen(h) && <p className="rb-small">Yours to ride once Dunmore&rsquo;s riders bring the first horses to the camp.</p>}
            <div className="rb-row">
              {has(mount.id) && (
                <button className="rb-btn" disabled={!canRide(h, mount.id) || riddenId === mount.id} onClick={() => engine.chooseMount(mount.id)}>
                  {!canRide(h, mount.id) ? 'Not yet' : riddenId === mount.id ? 'Your mount' : 'Ride this one'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="rb-dim rb-detail-empty">{tab === 'mounts' ? (rides ? 'Pick a mount to read about it and choose the one you ride.' : `${ridingLocked()}. Pick a mount to read about it.`) : 'Pick a look to try it on. Gold-edged looks are hand-made pieces; dark ones are still out there to be found.'}</p>
        )}
      </section>
    </div>
  );
}
