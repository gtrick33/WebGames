import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CLASSES, heroDamage, levelPower, MAX_LEVEL, xpToNext } from '../data/classes';
import { ITEM_DEFS } from '../data/items';
import { KEY_AFFIXES, KEY_DEATH, keyLevelFor, KEY_MIN, keyAffixes, keyLoot, keyParFor, keyScale, riftDungeons, weekAffixes, weekOf } from '../data/keystones';
import { NPCS, QUESTS } from '../data/quests';
import { mapColors, THEMES } from '../data/themes';
import { REGION_IDS, REGIONS } from '../data/regions';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENT_ROWS, TALENTS } from '../data/talents';
import { setOf } from '../data/riftgear';
import type { Item, ItemDef, QuestDef, RegionDef, RegionId, SkillIndex, SkillSpec, SlotId, StatKey, TalentNode } from '../data/types';
import { SLOTS } from '../data/types';
import type { PanelId, SigilEngine } from '../engine';
import { SLOT_LEVELS, slotOpen, potionCap, bagSize, cantAbandon, cantEquip, cantLearn, cantSpec, currentObjective, pickOptions, pickTaken, freePoints, learnedSkills, levelGated, pointsInTree, PERKS, questProgress, questRegion, questState, respecCost, SIGILS, specCost, talentPoints, trackedQuest, treeOpen, type Character, HOME } from '../progress/character';
import { ZOOM_MAX, ZOOM_MIN } from '../progress/save';
import { buildHero, heroUlt, typeBonus } from '../progress/build';
import { comboVsText, DMG_NAME, fmtStat, modLines, STAT_LABEL, costText } from '../progress/describe';
import { itemClass, itemMods, itemName, itemScore, itemSlot, salvageValue } from '../progress/items';
import { compareGear } from '../progress/compare';
import { npcMark, rarityColor } from '../render/renderer';
import { heldWeapon, heroDollUrl, heroLook, mountPictureUrl, talentIconUrl, wardrobePicture, watchMountPictures } from '../render/sprites';
import type { HeroLook } from '../render/art/hero';
import { MOUNTS } from '../data/mounts';
import { authoredLooks, BARE_LOOK, canRide, LOOK_SLOTS, lookFits, lookOf, lookSource, mountDef, riddenMount, ridingLocked, ridingOpen, wornId, wornLooks, type Look, type LookSlot } from '../progress/wardrobe';
import { ownedShopLooks, ownedShopMounts } from '../progress/shopGoods';
import { armorReduction } from '../sim/combat';
import { K, markerPos, parseRegion, TILE, type TileMap } from '../sim/map';
import { objectiveTarget, objectiveTargets, questCounts, questOnMap, type QuestOnMap } from '../sim/objective';
import { headingWord, npcRegion, regionLinks, roadHeading } from '../sim/routes';
import { Bar, fmt, Frame, ItemIcon, Portrait, RARITY_NAME, SkillIcon } from './common';
import { drawMapIcon, mapIconUrl, type MapIcon } from './mapIcons';
import { usePanZoom, type PanZoom } from './panZoom';
import { nameLines, placeNames, planWorld, type WorldPlan } from './worldLayout';
import { isMainQuest, questSteps, turnInNpc } from '../progress/handin';
import { questRewards } from '../progress/rewards';
import { FOG_CELL, fogSeen, loadFog, type Fog } from '../progress/fog';
import { RiftGuide } from './RiftGuide';
import { ShopPanel } from './Shop';
import { RING_LOOKS } from '../arena/rewards';
import { MUSIC_CREDITS } from '../audio/tracks';
import { allTitles, earnedTitles, RING_RECORD_TITLES, RING_TITLES, titleName, titleShown, wornTitleShown, type TitleDef } from '../progress/titles';
import { seasonOf } from '../arena/record';
import { actionLabel, CAMP_ACTIONS, RESERVED_CODES, type CampAction } from '../input/binds';
import { TitleFx } from '../../../components/TitleFx';
import { Titled } from './Titled';
import { WARDENS } from '../data/wardens';
import { compareWith, linesOnlyIn, statRows } from './compare';
import { PartyPanel } from './Party';
import { Journal } from './Journal';
import { GAME_VERSION } from '../data/version';
import { StorePanel, useStoreOpen } from './Store';
import { PRESETS } from '../progress/presets';
import { clockText, skillHaste } from '../sim/world';
import { PARA_STATS, PARAGON, paragonFree, paragonSpent, paragonXp } from '../progress/paragon';
import { ScenePreviewer } from './ScenePreviewer';

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
  if (p === 'rift') return <RiftGatePanel engine={engine} />;
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

/**
 * What the hero carries, as a row of coins and tokens (the owner, 2026-11-22: "display the currencies better and more
 * visually appealing"): gold, Sigil Marks, the potion belt and the Riftstone, each a tile of its own color with its
 * picture, its count large and what it is for under it.
 */
function Purse({ hero: h }: { hero: Character }) {
  const tiles: { id: string; icon: ReactNode; n: string; label: string; tip: string }[] = [
    { id: 'gold', icon: <CoinIcon />, n: fmt(h.gold), label: 'Gold', tip: 'Spent at the merchants: gear, potions, a talent reset.' },
    { id: 'marks', icon: <MarkIcon />, n: fmt(h.marks), label: 'Sigil Marks', tip: 'From bosses and the Riftstone: the quartermaster’s and the Riftbroker’s best gear, and wagers.' },
    { id: 'potions', icon: <FlaskIcon />, n: `${h.potions}/${potionCap(h)}`, label: 'Potions', tip: 'Your belt of healing potions, refilled at an inn.' },
    ...(h.keystone >= 1 ? [{ id: 'stone', icon: <StoneIcon />, n: `+${h.keystone}`, label: 'Riftstone', tip: 'The deepest stone you have opened: run it at the Riftgate in the Riftward.' }] : []),
  ];
  return (
    <ul className="rb-purse" aria-label="What you carry">
      {tiles.map((t) => (
        <li key={t.id} className={`rb-purse-tile is-${t.id}`} title={t.tip}>
          <span className="rb-purse-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span className="rb-purse-text">
            <b>{t.n}</b>
            <small>{t.label}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export const CoinIcon = () => (
  <svg viewBox="0 0 24 24">
    <ellipse cx="12" cy="14" rx="9" ry="7.5" fill="#a8701c" />
    <ellipse cx="12" cy="11.5" rx="9" ry="7.5" fill="#ffd257" stroke="#7a4e10" strokeWidth="1.2" />
    <ellipse cx="12" cy="11.5" rx="5.6" ry="4.4" fill="none" stroke="#c88a1e" strokeWidth="1.4" />
    <path d="M9.5 9 Q12 7.4 14.5 9" stroke="#fff3c0" strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);
export const MarkIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2 L20 12 L12 22 L4 12 Z" fill="#7b4dff" stroke="#2a1660" strokeWidth="1.3" />
    <path d="M12 5.5 L17 12 L12 18.5 L7 12 Z" fill="#c8a8ff" />
    <path d="M12 8.5 L14.5 12 L12 15.5 L9.5 12 Z" fill="#fff" opacity="0.85" />
  </svg>
);
const FlaskIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="9.5" y="2.5" width="5" height="3" rx="1" fill="#8a5a2a" />
    <path d="M10 5.5 h4 v3 l4.5 6.5 a5 5 0 0 1 -4.2 7.5 h-4.6 a5 5 0 0 1 -4.2 -7.5 L10 8.5 Z" fill="#e8ecf4" stroke="#3a3048" strokeWidth="1.2" />
    <path d="M6.7 15 h10.6 a4.6 4.6 0 0 1 -3.9 6.5 h-2.8 a4.6 4.6 0 0 1 -3.9 -6.5 Z" fill="#e8324a" />
    <circle cx="10" cy="17" r="1.2" fill="#ffb3bd" />
  </svg>
);
const StoneIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2.5 L18.5 8 L16.5 20 L7.5 20 L5.5 8 Z" fill="#5a2aa8" stroke="#1e0e40" strokeWidth="1.2" />
    <path d="M12 2.5 L14.5 8 L12 20 L9.5 8 Z" fill="#a878ff" />
    <path d="M5.5 8 H18.5" stroke="#e0ccff" strokeWidth="1" />
  </svg>
);

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
            <strong>
              <Titled name={h.name} title={wornTitleShown(h, engine.ringRating())} />
            </strong>
            <TitlePicker engine={engine} />
            <span>
              Level {h.level} {CLASSES[h.cls].name}
              {h.para.l > 0 && <b className="rb-para-name"> · Paragon {h.para.l}</b>}
            </span>
            {h.level >= MAX_LEVEL ? (
              <>
                <Bar value={h.para.x} max={paragonXp(h.para.l)} color="#c58cff" label="Paragon experience" />
                <span className="rb-dim rb-small">
                  {fmt(h.para.x)} / {fmt(paragonXp(h.para.l))} to Paragon {h.para.l + 1}
                </span>
              </>
            ) : (
              <>
                <Bar value={h.xp} max={xpToNext(h.level)} color="#ffe066" label="Experience" />
                <span className="rb-dim rb-small">
                  {fmt(h.xp)} / {fmt(xpToNext(h.level))} XP
                </span>
              </>
            )}
          </div>
        </div>
        <Purse hero={h} />
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
            const better = itemSlot(it) && !cantEquip(h, it) && isUpgrade(h, it);
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

/** "Is this better" for the upgrade arrow: weighed for how this hero plays (progress/compare.ts), as on the phone's card. */
export function isUpgrade(h: Character, it: Item): boolean {
  return compareGear(h, it).better;
}

/** Where a title comes from, for the list's headings. */
const TITLE_GROUPS = ['The story', 'The Rift', 'The Ring', 'The Vigil', 'Given to you'] as const;
const RIFT_TITLE_IDS = new Set(['riftwalker', 'riftbreaker', 'last-memory', 'exalted']);
const RING_TITLE_IDS = new Set([...RING_TITLES.map((t) => t.id), ...RING_RECORD_TITLES.map((t) => t.id)]);
function titleGroup(t: TitleDef): (typeof TITLE_GROUPS)[number] {
  if (t.given) return 'Given to you';
  if (t.id.startsWith('vigil-')) return 'The Vigil';
  if (RING_TITLE_IDS.has(t.id)) return 'The Ring';
  if (RIFT_TITLE_IDS.has(t.id)) return 'The Rift';
  return 'The story';
}

/**
 * The hero's titles: the one worn (chosen here), and every one there is with how it is earned, under where it comes
 * from. A season's champion title is listed once its season has begun (the list ran to "Season 26 Champion").
 */
function TitlePicker({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const rating = engine.ringRating();
  const mine = earnedTitles(h, rating);
  const worn = wornTitleShown(h, rating);
  const value = h.title === '' ? '' : (mine.find((t) => titleName(t, h) === worn?.text)?.id ?? '');
  // (the season when the page was opened: read once, not on every draw)
  const [season] = useState(() => seasonOf(Date.now()));
  const all = allTitles().filter((t) => {
    const n = /^ring-s(\d+)-champion$/.exec(t.id);
    return !n || Number(n[1]) <= season || mine.includes(t);
  });
  return (
    <details className="rb-titles">
      <summary>
        Titles <span className="rb-dim">{mine.length} of {all.length}</span>
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
      {TITLE_GROUPS.map((g) => {
        const list = all.filter((t) => titleGroup(t) === g);
        if (!list.length) return null;
        return (
          <section key={g} className="rb-titles-group">
            <h4>
              {g} <span className="rb-dim">{list.filter((t) => mine.includes(t)).length} of {list.length}</span>
            </h4>
            <ul>
              {list.map((t) => {
                const has = mine.includes(t);
                return (
                  <li key={t.id} className={has ? 'is-on' : ''}>
                    {/* (its light is shown on the ones earned: the rest are a promise) */}
                    <b className={t.rare ? 'rb-title-rare' : ''}>{has ? <TitleFx fx={titleShown(t, h).fx}>{titleName(t, h)}</TitleFx> : t.id === 'warden' ? WARDENS[h.cls].title : t.name}</b>
                    <span>{t.how}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
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
  if (spec.damage > 0) parts.push(`${Math.round(spec.damage * levelPower(engine.hero!.level) * typeBonus(st, spec.dmgType) * heroDamage(engine.hero!.level))} ${DMG_NAME[spec.dmgType]} damage${spec.count > 1 ? ` ×${spec.count}` : ''}${spec.cast === 'channel' || spec.tick ? ' per hit' : ''}`);
  const res = w.build.resource;
  const cost = costText(res, spec.cost, w.player.maxMana);
  if (cost) parts.push(cost);
  if (spec.extra.manaOnHit && res && w.player.maxMana > 0) parts.push(`+${Math.round((spec.extra.manaOnHit * w.player.maxMana) / 100)} ${res.name} per hit`);
  if (spec.castTime) parts.push(`${spec.castTime} s cast${spec.extra.swift ? ' (at full pace)' : ' (on the move, slowed)'}`);
  if (spec.combo) parts.push(`combo: ×${Math.round(spec.combo.mult * 100) / 100} on ${comboVsText(spec.combo.vs)}`);
  if (spec.spend) parts.push(`spends ${w.build.points?.name ?? 'points'}: +${Math.round(spec.spend.per * 100)}% each`);
  if (spec.build) parts.push(`builds ${spec.build} ${w.build.points?.name ?? (spec.build === 1 ? 'point' : 'points')}`);
  if (spec.cooldown > 0) parts.push(`${(spec.cooldown / skillHaste(st.haste)).toFixed(1)} s cooldown${spec.charges > 1 ? `, ${spec.charges} charges` : ''}`);
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
  const binds = engine.binds();
  const keys = engine.touchMode ? ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4'] : (['s1', 's2', 's3', 's4'] as const).map((a) => actionLabel(binds, a));
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
        <SkillCard engine={engine} id={heroUlt(h)} slotLabel={h.spec !== null && cls.trees[h.spec].ult && h.level >= SPEC_LEVEL ? `Ultimate · ${cls.trees[h.spec].name}` : 'Ultimate'} />
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
  // a specialization just chosen (or changed): its tree is the one shown, not the tab that was open before it
  const [seenSpec, setSeenSpec] = useState(h.spec);
  if (seenSpec !== h.spec) {
    setSeenSpec(h.spec);
    setTab(h.spec ?? 0);
    setSel(null);
  }
  const [ask, setAsk] = useState<'reset' | 'spec' | null>(null);
  // with a mouse a talent opens in the pane beside the tree (the tree stays in sight, and a rank is one click);
  // on a touch screen it is a card over the tree, as there is no room beside it
  const inline = !engine.touchMode;
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
                const other = !rank && !!pickTaken(h, n);
                return (
                  <button
                    key={n.id}
                    className={`rb-node${rank ? ' is-taken' : ''}${!why ? ' is-ready' : ''}${!rowOpen ? ' is-closed' : ''}${node?.id === n.id ? ' is-sel' : ''}${n.row === TALENT_ROWS - 1 ? ' is-cap' : ''}${rank >= n.ranks ? ' is-full' : ''}${n.pick ? ' is-pick' : ''}${other ? ' is-other' : ''}`}
                    style={{ gridRow: n.row + 1, gridColumn: n.col + 2 }}
                    onClick={() => setSel(n)}
                    aria-label={`${n.name}, rank ${rank} of ${n.ranks}${n.pick ? ', one of three' : ''}`}
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
              {inline && node && <TalentCard engine={engine} node={node} onClose={() => setSel(null)} inline />}
              <p className="rb-small">
                <b style={{ color: cls.trees[h.spec].color }}>{cls.trees[h.spec].passive.name}</b> ({cls.trees[h.spec].name}): {cls.trees[h.spec].passive.text}
              </p>
              {cls.trees[h.spec].combo && (
                <p className="rb-small rb-combo-line">
                  <b style={{ color: cls.trees[h.spec].color }}>Combo · {cls.trees[h.spec].combo!.name}:</b> {cls.trees[h.spec].combo!.text}
                </p>
              )}
              <p className="rb-dim rb-small">
                Tap a talent to read it and learn it. Each row opens after {ROW_COST} more points in its tree; the last row holds the capstones. The cut-cornered talents come in threes: take one of them, and switch to another whenever you like, for free. A tree is full at level {MAX_LEVEL}; your specialization’s comes first, and the other two open after {SPEC_FOCUS} points in it.
              </p>
        </div>
      </div>
      {node && !inline && <TalentCard engine={engine} node={node} onClose={() => setSel(null)} />}
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
export function TalentCard({ engine, node, onClose, inline }: { engine: SigilEngine; node: TalentNode; onClose: () => void; inline?: boolean }) {
  const h = engine.hero!;
  const cls = CLASSES[h.cls];
  const tree = cls.trees[node.tree];
  const rank = h.talents[node.id] ?? 0;
  const why = cantLearn(h, node.id);
  const now = rank > 0 ? modLines(node.mods.map((m) => scaleMod(m, rank))) : [];
  const chosen = !rank ? pickTaken(h, node) : undefined;
  const options = node.pick ? pickOptions(h.cls, node) : [];
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
  const card = (
      <div className={`rb-talent-pop${inline ? ' is-inline' : ''}`} role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={node.name} style={{ ['--tc' as string]: tree.color }}>
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
        {options.length > 1 && (
          <p className="rb-small rb-pick-line">
            One of three: {options.map((o, i) => (
              <span key={o.id}>
                {i ? ' · ' : ''}
                {o.id === node.id ? <b>{o.name}</b> : o.name}
              </span>
            ))}
          </p>
        )}
        <p>{node.text}</p>
        {now.length > 0 && <p className="rb-gold rb-small">Now: {now.join(' ')}</p>}
        {chosen ? (
          <button ref={learn} className="rb-btn is-gold" onClick={() => engine.swapTalent(node.id)}>
            Choose {node.name} instead of {chosen.name}
          </button>
        ) : why ? (
          <p className="rb-dim rb-small rb-talent-why">{why}</p>
        ) : (
          <button ref={learn} className="rb-btn is-gold" onClick={() => engine.learn(node.id)}>
            Learn {node.name}
          </button>
        )}
      </div>
  );
  if (inline) return card;
  return (
    <div className="rb-talent-pop-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {card}
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
          ? `At level ${SPEC_LEVEL} you choose a specialization: its ability, its ultimate, its combo and passive, and the talent tree your points go into first (one point a level from then on).`
          : h.spec === null
            ? 'Choose your specialization. It gives you its ability, its own ultimate, its combo and its passive, and its talent tree is where your points go first. You can change it later at a cost.'
            : `Changing your specialization resets your talents${cost ? ` and costs ${cost} gold` : ''}.`}
      </p>
      <div className="rb-spec-cards">
        {cls.trees.map((t, i) => {
          const sk = SKILLS[t.skill];
          const ult = SKILLS[t.ult ?? cls.ult];
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
              {ult && (
                <div className="rb-spec-skill">
                  <SkillIcon id={ult.id} size={36} />
                  <span>
                    <b>{ult.name} · ultimate</b>
                    <span className="rb-small rb-dim">{ult.blurb}</span>
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

/** The Quests page: the quests under way, or the Journal (the tale so far, the crown, the things kept). */
function QuestsPanel({ engine }: { engine: SigilEngine }) {
  const [view, setView] = useState(engine.questsView);
  const show = (v: 'quests' | 'journal'): void => {
    engine.showQuestsView(v);
    setView(v);
  };
  return (
    <>
      <div className="rb-seg rb-quests-views" role="tablist" aria-label="Quests or Journal">
        <button role="tab" aria-selected={view === 'quests'} className={`rb-btn is-small${view === 'quests' ? ' is-gold' : ''}`} onClick={() => show('quests')}>
          Quests
        </button>
        <button role="tab" aria-selected={view === 'journal'} className={`rb-btn is-small${view === 'journal' ? ' is-gold' : ''}`} onClick={() => show('journal')}>
          Journal
        </button>
      </div>
      {view === 'journal' ? <Journal engine={engine} /> : <QuestList engine={engine} />}
    </>
  );
}

function QuestList({ engine }: { engine: SigilEngine }) {
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
  // the side quest the hero asked to give up, waiting for them to say yes
  const [asking, setAsking] = useState<string | null>(null);
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
                <div className="rb-quest-foot">
                  <span className="rb-small rb-dim">Reward: {questRewards(h, q).map((x) => x.text).join(' · ')}</span>
                  {!cantAbandon(h, q.id) &&
                    (asking === q.id ? (
                      <span className="rb-quest-abandon" role="group" aria-label={`Abandon ${q.name}?`}>
                        <span className="rb-small">Abandon? Progress is lost.</span>
                        <button className="rb-btn is-small is-danger" onClick={() => {
                            setAsking(null);
                            engine.abandonQuest(q.id);
                          }}>
                          Abandon
                        </button>
                        <button className="rb-btn is-small is-ghost" onClick={() => setAsking(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button className="rb-btn is-small is-ghost" onClick={() => setAsking(q.id)} aria-label={`Abandon ${q.name}`}>
                        Abandon
                      </button>
                    ))}
                </div>
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
  const plan = worldPlan(mapLands((id) => h.unlocked.includes(id)));
  // the quest followed, and where the world map shows it: its land, or the nearest the hero has been to
  const goal = trackedQuest(h, w.region.id);
  const shown = goal ? questOnMap(h, goal, (id) => plan.cell.has(id), w.region.id) : undefined;
  const showAt = shown ? (shown.from ?? shown.land) : undefined;
  // opened for a quest (its "Map" in the log, the tracker), the map opens on its land
  const [sel, setSel] = useState<RegionId>(() => (engine.mapQuestId && engine.mapQuestId === goal?.id && showAt ? showAt : w.region.id));
  // and the world map goes to it then, and each time it is shown one after
  const [shows, setShows] = useState(engine.mapQuestId ? 1 : 0);
  const [followed, setFollowed] = useState(goal?.id);
  const showQuest = (): void => {
    if (showAt) setSel(showAt);
    setShows(shows + 1);
  };
  if (goal?.id !== followed) {
    // another quest followed (a tap on its mark on the land's map): the world map shows where that one is
    setFollowed(goal?.id);
    if (showAt) showQuest();
  }
  // (no difficulty to choose, and no Riftstone: Heroic and Mythic are gone, and the Riftstone is started only at the Rift
  // Gate in the Riftward, the owner, 2026-11-22)
  const r = REGIONS[sel];
  const open = h.unlocked.includes(sel);
  const here = w.region.id === sel;
  const ready = goal && questState(h, goal.id) === 'ready';
  const giver = goal && ready ? turnInNpc(goal) : null;
  // where it is, in words: in a land the hero knows, or past the nearest one they do, and which way
  const where = (() => {
    if (!shown || shown.land === w.region.id) return '';
    const r = REGIONS[shown.land];
    if (!shown.from) return ` · in ${r.name}`;
    const way = `the way ${shown.heading ? headingWord(shown.heading) : 'on'}`;
    const past = shown.from === w.region.id ? `from here, ${way}` : `past ${REGIONS[shown.from].name}, ${way}`;
    return ` · ${r.kind === 'town' ? `in ${r.name}` : 'in land not explored yet'}: ${past}`;
  })();
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
                {where}
              </span>
            </span>
            <span className="rb-map-quest-acts">
              {showAt && (
                <button className="rb-btn is-small" onClick={showQuest} aria-label={`Show ${goal.name} on the world map`}>
                  Show
                </button>
              )}
              <button className="rb-btn is-small" onClick={() => engine.openPanel('quests')}>
                Quest log
              </button>
            </span>
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
        <WorldMap hero={h} plan={plan} here={w.region.id} sel={sel} quest={shown} again={shows ? `${shows}` : ''} counts={questCounts(h)} onSel={setSel} />
        <div className={`rb-dest${open ? '' : ' is-locked'}${here ? ' is-here' : ''}`}>
          <div>
            <strong>
              {open || r.kind === 'town' ? r.name : 'Unknown land'}{' '}
              <span className="rb-dim rb-small">{r.kind === 'town' ? 'Town' : `${r.kind === 'dungeon' ? 'Dungeon' : 'Wilds'} · levels ${r.levels[0]}-${r.levels[1]}`}</span>
            </strong>
            <span className="rb-small rb-dim">{open ? r.blurb : sel === 'whisperwood' ? 'Finish your training with Elder Maren.' : sel === 'crypt' ? 'Defeat Grimtusk in the Whisperwood.' : 'Not discovered yet: walk there to find it.'}</span>
          </div>
          <button
            className="rb-btn is-small is-gold"
            disabled={!open || !canTravel || (here && (r.safe || (w.tier === 0 && !w.keyRun)))}
            onClick={() => engine.travel(sel, 0, [], undefined)}
          >
            {here ? 'Here' : 'Go'}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * The Riftgate, in the Riftward (opened by talking to its Keeper): the only place a Riftstone run starts (the owner,
 * 2026-11-22). The memories the hero's stone reaches, gentlest first; the level to hold it at (any it has opened), what
 * that does, the clock and the week's affixes; then Start, or a run with friends.
 */
function RiftGatePanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const pool = riftDungeons(h.keystone);
  const [sel, setSel] = useState<RegionId>(pool[0]?.id ?? 'crypt');
  // each dungeon its own stone (the owner, 2026-11-22): the one open there, or a lower one picked for it
  const top = engine.openStone(sel);
  const [picked, setPicked] = useState<Partial<Record<RegionId, number>>>({});
  const stone = Math.max(KEY_MIN, Math.min(top, picked[sel] ?? top));
  const setStone = (n: number): void => setPicked((p) => ({ ...p, [sel]: n }));
  // this week's affixes (read once: the panel isn't open across a Monday)
  const [week] = useState(() => weekOf(Date.now()));
  const r = REGIONS[sel];
  return (
    <Frame title="The Riftgate" onClose={() => engine.closePanel()} wide className="rb-panel-rift">
      {h.keystone < KEY_MIN ? (
        <p className="rb-dim">The Gate is dark to you. Finish the story, and Maren will have a stone for you.</p>
      ) : (
        <div className="rb-riftgate">
          <section className="rb-riftgate-list" aria-label="Memories the stone reaches">
            <span className="rb-kicker">
              Memories your stone reaches ({pool.length})
            </span>
            {pool.map((d) => (
              <button key={d.id} className={`rb-riftgate-row${d.id === sel ? ' is-on' : ''}`} onClick={() => setSel(d.id)}>
                <strong>{d.name}</strong>
                <span className="rb-small rb-dim">
                  Riftstone +{engine.openStone(d.id)} open
                  {h.bestKeys[d.id] ? ` · best in time +${h.bestKeys[d.id]}` : ''}
                </span>
              </button>
            ))}
          </section>
          <section className="rb-riftgate-pick">
            <span className="rb-kicker">
              {r.name} · level {keyLevelFor(h.level)}
            </span>
            <KeyPicker heroLevel={h.level} region={r} stone={stone} top={top} best={h.bestKeys[sel] ?? 0} week={week} onPick={setStone} />
            <div className="rb-riftgate-go">
              <button className="rb-btn is-gold" onClick={() => engine.travel(sel, 2, [], undefined, stone)}>
                Enter Riftstone +{stone}
              </button>
              <button
                className="rb-btn"
                onClick={() => {
                  // the party's plan starts where this picker is
                  if (!engine.party) void engine.createParty().then(() => engine.setPartyPlan(sel, stone));
                  else engine.setPartyPlan(sel, stone);
                  engine.openPanel('party');
                }}
              >
                {engine.party ? 'Party: run this' : 'Play with friends'}
              </button>
            </div>
            <RiftGuide hero={h} />
          </section>
        </div>
      )}
    </Frame>
  );
}

/** A Riftstone run's level at the Riftgate (any the stone has opened), what it does, the clock, this week's affixes. */
export function KeyPicker({ heroLevel, region, stone, top, best, week, onPick }: { heroLevel: number; region: RegionDef; stone: number; top: number; best: number; week: number; onPick: (n: number) => void }) {
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
 * The world map (ui/worldLayout.ts): the lands on a grid, each where the roads say it lies from its neighbours (a
 * land the hero reaches by the west road stands to the left, by the north road above), the roads as straight lines.
 */
/** World-map units for its names (the map is drawn at least WORLD_PX screen pixels a unit, so they stay readable). */
const NAME_SIZE = 3.1;
const LVL_SIZE = 2.7;
const WORLD_PX = 2.9;
/** How far in the world map zooms, from the whole world. */
const WORLD_ZOOM = 4;
/** Map units from one column of the grid to the next, and from one row to the next. */
const COL = 34;
const ROW = 26;
/** How far from the middle of a land's mark its name starts, and how far round the mark nothing else is written. */
const NAME_GAP = 5;
const MARK_R = 4.2;
/** Where the story starts: 0,0 on the grid. */
const WORLD_ROOT: RegionId = 'briarhollow';

/** The roads between the lands of the map (not into a land out of the story, nor through a door into a building). */
const mapLinks = (): [RegionId, RegionId][] => regionLinks().filter(([a, b]) => REGION_IDS.includes(a) && REGION_IDS.includes(b));
/** The lands with a road to another land of the map; the others (a dungeon whose land is out of the story) show only to a hero who has been there. */
function mapLands(known: (id: RegionId) => boolean): RegionId[] {
  const joined = new Set(mapLinks().flat());
  // (the Riftward has no road: it is reached by waystone, and shows once it is open)
  return REGION_IDS.filter((id) => joined.has(id) || (known(id) && (REGIONS[id].kind !== 'town' || id === 'riftward')));
}

/** The world laid out, once for each set of lands on it (the search takes a moment, and the map is opened often). */
const worldPlans = new Map<string, WorldPlan<RegionId>>();
function worldPlan(lands: RegionId[]): WorldPlan<RegionId> {
  const key = lands.join('|');
  let plan = worldPlans.get(key);
  if (!plan) {
    plan = planWorld(lands, mapLinks(), (id) => REGIONS[id].levels[0], WORLD_ROOT, { heading: roadHeading, cell: [COL, ROW] });
    worldPlans.set(key, plan);
  }
  return plan;
}

/** A land's levels as the map writes them under its name. */
const levelsText = (r: RegionDef): string => (r.levels[0] === r.levels[1] ? `level ${r.levels[0]}` : `levels ${r.levels[0]}-${r.levels[1]}`);
/** About how wide a line of the map's bold letters is, in map units. */
const textWidth = (s: string, size: number): number => s.length * size * 0.6 + 0.6;

/**
 * The world at a glance: every land where its roads say it lies, the roads between them, what is still unknown, and
 * the quest the hero follows: its land ringed in gold, or, while the hero hasn't been there, the nearest land they
 * have ringed, with an arrow on from it toward the "?" the quest is behind.
 */
function WorldMap({ hero, plan, here, sel, quest, again, counts, onSel }: { hero: Character; plan: WorldPlan<RegionId>; here: RegionId; sel: RegionId; quest?: QuestOnMap; again: string; counts: Map<RegionId, { work: number; offers: number }>; onSel: (r: RegionId) => void }) {
  const known = (id: RegionId): boolean => hero.unlocked.includes(id) || REGIONS[id].kind === 'town';
  const at = (id: RegionId): [number, number] => {
    const [c, r] = plan.cell.get(id) ?? [0, 0];
    return [c * COL, r * ROW];
  };
  /** Each known land's name: its lines, its levels, and the side of its mark they are written on. */
  const knownKey = plan.ids.filter(known).join('|');
  const names = useMemo(() => {
    const shown = new Set(knownKey.split('|'));
    const text = (id: RegionId): { lines: string[]; lvl: string | null } => {
      const r = REGIONS[id];
      return { lines: nameLines(r.name.replace(/^The /, '')), lvl: r.kind === 'town' ? null : levelsText(r) };
    };
    const sides = placeNames(
      plan,
      [COL, ROW],
      (id) => {
        if (!shown.has(id)) return null;
        const { lines, lvl } = text(id);
        return [Math.max(...lines.map((l) => textWidth(l, NAME_SIZE)), lvl ? textWidth(lvl, LVL_SIZE) : 0), lines.length * NAME_SIZE * 1.12 + (lvl ? LVL_SIZE * 1.15 : 0)];
      },
      NAME_GAP,
      MARK_R,
    );
    return new Map([...sides].map(([id, s]) => [id, { ...s, ...text(id) }]));
  }, [plan, knownKey]);
  // the box fits the lands and their names
  const box = useMemo(() => {
    let [x0, y0, x1, y1] = [plan.cols[0] * COL - 9, plan.rows[0] * ROW - 9, plan.cols[1] * COL + 9, plan.rows[1] * ROW + 9];
    for (const { box: b } of names.values()) [x0, y0, x1, y1] = [Math.min(x0, b[0] - 2), Math.min(y0, b[1] - 2), Math.max(x1, b[2] + 2), Math.max(y1, b[3] + 2)];
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  }, [plan, names]);
  /** Where the map is looking first: the quest's land (and the land the hero would set out from for it), else the hero. */
  const look = (): [number, number] => {
    if (!quest || !again) return at(here);
    const [x, y] = at(quest.land);
    if (!quest.from) return [x, y];
    const [fx, fy] = at(quest.from);
    return [(x + fx) / 2, (y + fy) / 2];
  };
  // the map opens on the whole world where that is readable; on a small screen, on the hero's own part of it, or the
  // quest's when it was opened for one (and again each time it is shown one). The wheel, a pinch or the buttons zoom,
  // a drag moves it
  const view = useRef<HTMLDivElement>(null);
  const pz = usePanZoom(
    view,
    box.w,
    box.h,
    WORLD_ZOOM,
    (fit) => {
      const [x, y] = look();
      return { k: Math.max(1, WORLD_PX / fit), cx: x - box.x0, cy: y - box.y0 };
    },
    again,
  );
  const v = pz.view;
  const vb = v ? [box.x0 + v.cx - pz.vw / 2 / pz.scale, box.y0 + v.cy - pz.vh / 2 / pz.scale, pz.vw / pz.scale, pz.vh / pz.scale] : [box.x0, box.y0, box.w, box.h];
  /** A road: a straight line from mark to mark. */
  const road = (a: RegionId, b: RegionId): string => {
    const [x0, y0] = at(a);
    const [x1, y1] = at(b);
    return `M${x0} ${y0}L${x1} ${y1}`;
  };
  /** Another road from the picked land: a low arc from mark to mark. */
  const arc = (a: RegionId, b: RegionId): string => {
    const [x0, y0] = at(a);
    const [x1, y1] = at(b);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const bow = Math.min(9, len * 0.22);
    return `M${x0} ${y0}Q${(x0 + x1) / 2 + ((y1 - y0) / len) * bow} ${(y0 + y1) / 2 - ((x1 - x0) / len) * bow} ${x1} ${y1}`;
  };
  // the quest: the land ringed, and, while it is in a land the hero hasn't been to, an arrow from the land they would
  // set out from along the roads there
  const ringed = quest ? (quest.from ?? quest.land) : undefined;
  const pointer = (() => {
    if (!quest?.from) return null;
    const pts = (quest.path ?? [quest.from, quest.land]).filter((id) => plan.cell.has(id)).map(at);
    if (pts.length < 2) return null;
    // from the edge of the one ring to the edge of the other, its head at the far end
    const toward = (p: [number, number], q: [number, number], d: number): [number, number] => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [p[0] + ((q[0] - p[0]) / len) * d, p[1] + ((q[1] - p[1]) / len) * d];
    };
    const [a, b] = [pts.at(-2)!, pts.at(-1)!];
    const tip = toward(b, a, 7);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const head = `M${tip[0]} ${tip[1]}L${tip[0] - ux * 3 - uy * 2} ${tip[1] - uy * 3 + ux * 2}L${tip[0] - ux * 3 + uy * 2} ${tip[1] - uy * 3 - ux * 2}Z`;
    const line = [toward(pts[0]!, pts[1]!, 7.5), ...pts.slice(1, -1), toward(b, a, 9)].map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
    return { line, head };
  })();
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
        {/* each land as a wash of its own ground's color behind its mark, blurred into the next (green wood, golden
            steppe, snow, purple glass...), so the map reads as places and not a chart; unknown lands lie under fog */}
        <defs>
          <filter id="rb-world-wash" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.4" />
          </filter>
        </defs>
        <g filter="url(#rb-world-wash)" className="rb-world-lands" aria-hidden="true">
          {plan.ids.map((id) => {
            const r = REGIONS[id];
            const [x, y] = at(id);
            const pal = mapColors(r.theme);
            // (darkened, so the names written over it stay white on dark)
            const fill = !known(id) ? '#151026' : shadeHex(r.kind === 'town' ? pal.cobble : r.kind === 'dungeon' ? pal.wall : pal.floor, -0.42);
            return <circle key={id} cx={x} cy={y} r={r.kind === 'dungeon' ? 8 : 12} fill={fill} opacity={known(id) ? 0.9 : 0.7} />;
          })}
        </g>
        {plan.roads.map(([a, b]) => (
          <path key={`${a}-${b}`} d={road(a, b)} className={`rb-world-road${known(a) && known(b) ? ' is-known' : ''}`} />
        ))}
        {/* the picked land's other roads (the long way round, drawn only for it) */}
        {plan.ties
          .filter(([a, b]) => (a === sel || b === sel) && known(a) && known(b))
          .map(([a, b]) => (
            <path key={`${a}~${b}`} d={arc(a, b)} className="rb-world-tie" />
          ))}
        {pointer && (
          <g className="rb-world-pointer" aria-hidden="true">
            <path d={pointer.line} className="rb-world-pointer-line" />
            <path d={pointer.head} className="rb-world-pointer-head" />
          </g>
        )}
        {plan.ids.map((id) => {
          const r = REGIONS[id];
          const [x, y] = at(id);
          const k = known(id);
          const col = k ? KIND_COLOR[r.kind] : '#6a6480';
          const name = names.get(id);
          const lines = name?.lines ?? [];
          const lvl = name?.lvl ?? null;
          // its name on the side of its mark it was given: its lines (and its levels under them) beside the mark's
          // middle, or centred under or over it
          const tall = lines.length * NAME_SIZE * 1.12 + (lvl ? LVL_SIZE * 1.15 : 0);
          const side = name?.side ?? 'e';
          const tx = side === 'e' ? x + NAME_GAP : side === 'w' ? x - NAME_GAP : x;
          const top = (side === 's' ? y + NAME_GAP : side === 'n' ? y - NAME_GAP - tall : y - tall / 2) + NAME_SIZE * 0.86;
          const anchor = side === 'e' ? 'start' : side === 'w' ? 'end' : 'middle';
          const quested = id === ringed;
          return (
            <g key={id} className={`rb-world-node${id === sel ? ' is-sel' : ''}${quested ? ' is-quest' : ''}`} onClick={() => onSel(id)} role="button" aria-label={k ? r.name : 'Unknown land'} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSel(id)}>
              {quested && <circle cx={x} cy={y} r="7" className="rb-world-focus" />}
              {quest?.from && id === quest.land && <circle cx={x} cy={y} r="6" className="rb-world-beyond" />}
              {id === here && <circle cx={x} cy={y} r="5.2" className="rb-world-here" />}
              {/* a house, a tree, a gate; a grey "?" where the hero has not been */}
              <circle cx={x} cy={y} r="3.4" className="rb-world-mark" stroke={col} />
              <image href={mapIconUrl(k ? (r.kind === 'town' ? 'town' : r.kind === 'dungeon' ? 'dungeon' : 'wild') : 'unknown', 3)} x={x - 3} y={y - 3} width="6" height="6" className="rb-world-icon" />
              {id === quest?.land && (
                <text x={x - 3.4} y={y - 2.4} className="rb-world-goal">
                  !
                </text>
              )}
              {/* how many quests have work here (a number), and quests to take here (a blue "!") */}
              {(counts.get(id)?.work ?? 0) > (id === quest?.land ? 1 : 0) && (
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
                <text key={i} x={tx} y={top + i * NAME_SIZE * 1.12} textAnchor={anchor} className="rb-world-name">
                  {line}
                </text>
              ))}
              {lvl && (
                <text x={tx} y={top + lines.length * NAME_SIZE * 1.12 - NAME_SIZE * 0.86 + LVL_SIZE} textAnchor={anchor} className="rb-world-lvl">
                  {lvl}
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

/** How many map pixels a tile is painted with (the map is drawn smooth or crisp at any zoom from these). */
export const MAP_PX = 4;

/** A color a little lighter or darker (k: -1 to 1). */
function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number): number => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** A steady noise from a tile's place, 0 to 1. */
const grain = (x: number, y: number, n = 0): number => {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * A land's ground as the map shows it: painted, a few pixels a tile, from what each tile is. Grass and floors with a
 * little grain; water with a pale shore line where it meets land; woods as round crowns, lit on top with a shadow
 * below; roofs with a ridge and a dark eave; roads and cobbles with their edges. It used to be a flat block of color
 * a tile, which read as a spreadsheet of a land rather than a place.
 */
const grounds = new WeakMap<TileMap, HTMLCanvasElement>();
export function groundOf(m: TileMap, theme: RegionDef['theme']): HTMLCanvasElement {
  const hit = grounds.get(m);
  if (hit) return hit;
  const P = MAP_PX;
  const ground = document.createElement('canvas');
  ground.width = m.w * P;
  ground.height = m.h * P;
  const gg = ground.getContext('2d')!;
  const pal = mapColors(theme);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= m.w || y >= m.h ? K.Wall : m.kind[y * m.w + x]!);
  const isWater = (t: number): boolean => t === K.Water;
  // (out of doors the land's edge and its thickets are wood too: they are walls to walk, and trees to see)
  const outdoors = !THEMES[theme].indoor;
  const isWood = (t: number): boolean => t === K.Tree || t === K.Bush || (outdoors && t === K.Wall);
  const isHouse = (t: number): boolean => t === K.House || t === K.HouseAnchor;
  const isRoad = (t: number): boolean => t === K.Path || t === K.Bridge || t === K.Cobble;
  const base = (t: number): string => {
    if (t === K.Wall || t === K.Illusion) return pal.wall;
    if (isWater(t)) return pal.water;
    if (t === K.Path || t === K.Bridge) return pal.path;
    if (t === K.Cobble) return pal.cobble;
    if (t === K.Sand) return pal.sand;
    if (isHouse(t)) return pal.house;
    if (t === K.Door) return '#8a6a3a';
    return pal.floor;
  };
  // 1: the ground under everything, grained (a wood's floor is the grass under its crowns)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = at(x, y);
      const under = isWood(t) ? K.Floor : t;
      const g = grain(x, y);
      gg.fillStyle = shadeHex(base(under), (g - 0.5) * (isWater(under) ? 0.06 : 0.12));
      gg.fillRect(x * P, y * P, P, P);
      // a road's edge, darker where it meets the grass
      if (isRoad(t)) {
        gg.fillStyle = shadeHex(base(t), -0.22);
        if (!isRoad(at(x, y - 1))) gg.fillRect(x * P, y * P, P, 1);
        if (!isRoad(at(x, y + 1))) gg.fillRect(x * P, y * P + P - 1, P, 1);
        if (!isRoad(at(x - 1, y))) gg.fillRect(x * P, y * P, 1, P);
        if (!isRoad(at(x + 1, y))) gg.fillRect(x * P + P - 1, y * P, 1, P);
      }
      // the shore: pale foam on the water where it meets land, and a darker band of deep water away from it
      if (isWater(t)) {
        const shore = !isWater(at(x, y - 1)) || !isWater(at(x, y + 1)) || !isWater(at(x - 1, y)) || !isWater(at(x + 1, y));
        if (shore) {
          gg.fillStyle = shadeHex(pal.water, 0.45);
          if (!isWater(at(x, y - 1))) gg.fillRect(x * P, y * P, P, 1);
          if (!isWater(at(x, y + 1))) gg.fillRect(x * P, y * P + P - 1, P, 1);
          if (!isWater(at(x - 1, y))) gg.fillRect(x * P, y * P, 1, P);
          if (!isWater(at(x + 1, y))) gg.fillRect(x * P + P - 1, y * P, 1, P);
        } else if (g < 0.12) {
          gg.fillStyle = shadeHex(pal.water, 0.25);
          gg.fillRect(x * P + 1, y * P + 2, 2, 1);
        }
      }
      // a wall's top lit, its foot in shadow
      if (!outdoors && t === K.Wall && at(x, y + 1) !== K.Wall) {
        gg.fillStyle = shadeHex(pal.wall, -0.35);
        gg.fillRect(x * P, y * P + P - 1, P, 1);
      }
    }
  // 2: woods as crowns: a shadow down and to the right, the crown, a lit edge up and to the left
  const crown = pal.wall;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = at(x, y);
      if (!isWood(t)) continue;
      const r = (t === K.Bush ? 0.38 : 0.66) * P + grain(x, y, 1) * 0.7;
      const cx = x * P + P / 2 + (grain(x, y, 2) - 0.5) * 1.2;
      const cy = y * P + P / 2 + (grain(x, y, 3) - 0.5) * 1.2;
      gg.fillStyle = 'rgba(0,0,0,0.28)';
      gg.beginPath();
      gg.arc(cx + 0.8, cy + 1, r, 0, Math.PI * 2);
      gg.fill();
      gg.fillStyle = shadeHex(crown, (grain(x, y, 4) - 0.5) * 0.18);
      gg.beginPath();
      gg.arc(cx, cy, r, 0, Math.PI * 2);
      gg.fill();
      gg.fillStyle = shadeHex(crown, 0.28);
      gg.beginPath();
      gg.arc(cx - r * 0.3, cy - r * 0.32, r * 0.42, 0, Math.PI * 2);
      gg.fill();
    }
  // 3: roofs: a ridge along the middle of each run of house, a dark eave at its foot
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (!isHouse(at(x, y))) continue;
      gg.fillStyle = shadeHex(pal.house, -0.32);
      if (!isHouse(at(x, y + 1))) gg.fillRect(x * P, y * P + P - 1, P, 1);
      if (!isHouse(at(x - 1, y))) gg.fillRect(x * P, y * P, 1, P);
      if (!isHouse(at(x + 1, y))) gg.fillRect(x * P + P - 1, y * P, 1, P);
      gg.fillStyle = shadeHex(pal.house, 0.22);
      if (!isHouse(at(x, y - 1))) gg.fillRect(x * P, y * P, P, 1);
      else if (isHouse(at(x, y + 1)) && !isHouse(at(x, y - 2))) gg.fillRect(x * P, y * P + 1, P, 1);
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
 * Settings › Keys: every action with the key it answers to, a click to give it another (the next key pressed; Escape
 * puts it back as it was), and a way back to the game's own keys. Walking (WASD, the arrows) and Escape aren't
 * offered: input/binds.ts RESERVED_CODES.
 */
function KeysPicker({ engine }: { engine: SigilEngine }) {
  const s = engine.settings;
  const binds = engine.binds();
  const [asking, setAsking] = useState<CampAction | null>(null);
  useEffect(() => {
    if (!asking) return;
    const key = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' || !e.code) return setAsking(null);
      if (RESERVED_CODES.has(e.code)) return;
      const own: Partial<Record<CampAction, string>> = {};
      for (const [a, c] of Object.entries(s.keys ?? {}) as [CampAction, string][]) if (c !== e.code) own[a] = c;
      own[asking] = e.code;
      engine.setSettings({ keys: own });
      setAsking(null);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [asking, engine, s.keys]);
  return (
    <div className="rb-keys" role="group" aria-label="Keys">
      <span className="rb-small rb-dim">WASD or the arrows walk, the mouse aims and the left button attacks. Click an action, then press its new key (Esc to keep the old one).</span>
      <div className="rb-keys-list">
        {CAMP_ACTIONS.map((a) => (
          <button key={a.id} className={`rb-keys-row${asking === a.id ? ' is-asking' : ''}${s.keys?.[a.id] ? ' is-own' : ''}`} onClick={() => setAsking(asking === a.id ? null : a.id)} aria-label={`${a.name}: ${actionLabel(binds, a.id) || 'none'}. Click to change`}>
            <span>{a.name}</span>
            <kbd>{asking === a.id ? 'Press a key…' : actionLabel(binds, a.id) || (a.id === 'ult' && s.ultKey === 'rmb' ? 'Right mouse' : '—')}</kbd>
          </button>
        ))}
      </div>
      {Object.keys(s.keys ?? {}).length > 0 && (
        <button className="rb-btn is-small is-ghost" onClick={() => engine.setSettings({ keys: {} })}>
          Back to the game’s keys
        </button>
      )}
    </div>
  );
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
    // (painted MAP_PX pixels a tile: crisp when zoomed in, smooth when the whole land is shown smaller than that)
    g.imageSmoothingEnabled = k < MAP_PX;
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
          <label className="rb-check">
            <input type="checkbox" checked={s.voice} onChange={(e) => set({ voice: e.target.checked })} />
            <span>Voices (your hero’s efforts and cries, your companions’ shouts)</span>
          </label>
        </section>
        <section>
          <span className="rb-kicker">Difficulty</span>
          <div className="rb-seg" role="radiogroup" aria-label="Difficulty">
            {(['story', 'normal', 'hard'] as const).map((d) => (
              <button key={d} role="radio" aria-checked={s.difficulty === d} className={s.difficulty === d ? 'is-on' : ''} onClick={() => set({ difficulty: d })}>
                {d === 'story' ? 'Story' : d === 'hard' ? 'Hard' : 'Normal'}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">
            {s.difficulty === 'story'
              ? 'For the story: foes go down sooner and hit far softer. Your runs stay off the leaderboard.'
              : s.difficulty === 'hard'
                ? 'Every fight asks more: foes have a quarter more health and hit harder.'
                : 'The campaign as it was made: hard enough to lose a fight, and to feel it won.'}{' '}
            Heroic, Mythic, the Riftstones and runs with friends keep their own measure.
          </span>
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
          <label className="rb-check">
            <input type="checkbox" checked={s.ringCloseIn} onChange={(e) => set({ ringCloseIn: e.target.checked })} />
            <span>The Ring: close in automatically (an ability used out of reach walks you to your target, then goes off)</span>
          </label>
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
              <KeysPicker engine={engine} />
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
          <div className="rb-seg" role="radiogroup" aria-label="Graphics">
            {(['auto', 'high', 'low'] as const).map((g) => (
              <button key={g} role="radio" aria-checked={s.graphics === g} className={s.graphics === g ? 'is-on' : ''} onClick={() => set({ graphics: g })}>
                Graphics: {g === 'auto' ? 'Auto' : g === 'high' ? 'Sharp' : 'Light'}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">Auto draws fewer pixels when the machine can’t keep up, and lets fire and magic glow on a computer that keeps up with ease. Sharp always draws the full picture, with the glow, on any screen; Light always draws a lighter one, with no glow, for an older phone or laptop.</span>
          <label className="rb-check">
            <input type="checkbox" checked={s.saver} onChange={(e) => set({ saver: e.target.checked })} />
            <span>Battery saver (30 frames a second: a cooler phone and a longer battery, a little less smooth)</span>
          </label>
          <div className="rb-seg" role="radiogroup" aria-label="Color of danger marks">
            {(['red', 'magenta'] as const).map((t) => (
              <button key={t} role="radio" aria-checked={s.dangerTone === t} className={s.dangerTone === t ? 'is-on' : ''} onClick={() => set({ dangerTone: t })}>
                Danger marks: {t === 'red' ? 'Red' : 'Magenta'}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">The color of a blow about to land. Magenta is easier to tell from grass with red-green color blindness.</span>
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
        {engine.reviewTools && engine.hero && <ScenePreviewer engine={engine} />}
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

/** A look's tile picture: its model, as the equipped piece beside it is drawn (render/sprites.ts wardrobePicture). */
function LookPicture({ look }: { look: Look }) {
  const pic = wardrobePicture(look);
  return <img className={pic.smooth ? 'is-smooth' : undefined} src={pic.url} alt="" width={40} height={40} draggable={false} />;
}

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
                <span className="rb-dim">{LOOK_LABEL[s]}</span> {w === 'bare' ? 'Bare' : w ? w.name : h.equip[s] ? `${itemName(h.equip[s]!)} (equipped)` : s === 'weapon' ? `${CLASSES[h.cls].name}’s plain ${heldWeapon(h.cls, undefined).kind}` : 'Nothing'}
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
                <LookPicture look={l} />
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
