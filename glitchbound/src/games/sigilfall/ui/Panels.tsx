import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CLASSES, levelPower, xpToNext } from '../data/classes';
import { ITEM_DEFS } from '../data/items';
import { QUESTS } from '../data/quests';
import { mapColors } from '../data/themes';
import { REGION_IDS, REGIONS, RIFT_MODS, TIERS, type RiftMod } from '../data/regions';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENT_ROWS, TALENTS } from '../data/talents';
import type { ClassId, Item, QuestDef, RegionDef, RegionId, SkillSpec, SlotId, StatKey, TalentNode } from '../data/types';
import { SLOTS } from '../data/types';
import type { PanelId, SigilEngine } from '../engine';
import { bagSize, cantEquip, cantLearn, cantSpec, freePoints, learnedSkills, pointsInTree, PERKS, questProgress, questRegion, questState, respecCost, SIGILS, specCost, talentPoints, trackedQuest, treeOpen, type Character } from '../progress/character';
import { buildHero, typeBonus } from '../progress/build';
import { DMG_NAME, fmtStat, modLines, STAT_LABEL } from '../progress/describe';
import { itemClass, itemMods, itemName, itemScore, itemSlot, itemStats, salvageValue } from '../progress/items';
import { rarityColor } from '../render/renderer';
import { glyphIconUrl, heroDollUrl, heroLook } from '../render/sprites';
import { K, TILE } from '../sim/map';
import { objectiveTarget } from '../sim/objective';
import { npcRegion, regionLinks } from '../sim/routes';
import { Bar, fmt, Frame, ItemIcon, Portrait, RARITY_NAME, SkillIcon } from './common';
import { ShopPanel } from './Shop';

const TABS: { id: PanelId; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'skills', label: 'Skills' },
  { id: 'talents', label: 'Talents' },
  { id: 'quests', label: 'Quests' },
  { id: 'map', label: 'Map' },
];

export function Panels({ engine }: { engine: SigilEngine }) {
  const p = engine.ui.panel;
  if (p === 'settings') return <SettingsPanel engine={engine} onClose={() => engine.closePanel()} />;
  if (p === 'shop' && engine.ui.shop) return <ShopPanel engine={engine} shop={engine.ui.shop} />;
  const h = engine.hero!;
  const title = (
    <span className="rb-tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={p === t.id} className={p === t.id ? 'is-on' : ''} onClick={() => engine.openPanel(t.id)}>
          {t.label}
          {t.id === 'talents' && freePoints(h) > 0 && <span className="rb-badge">{freePoints(h)}</span>}
          {t.id === 'hero' && h.bag.some((i) => i.fresh) && <span className="rb-badge">{h.bag.filter((i) => i.fresh).length}</span>}
        </button>
      ))}
    </span>
  );
  return (
    <Frame title={title} onClose={() => engine.closePanel()} wide className={`rb-panel-${p}`}>
      {p === 'hero' && <HeroPanel engine={engine} />}
      {p === 'skills' && <SkillsPanel engine={engine} />}
      {p === 'talents' && <TalentsPanel engine={engine} />}
      {p === 'quests' && <QuestsPanel engine={engine} />}
      {p === 'map' && <MapPanel engine={engine} />}
    </Frame>
  );
}

/* --------------------------------------------------------------- hero */

const SLOT_LABEL: Record<SlotId, string> = { weapon: 'Weapon', offhand: 'Off-hand', head: 'Head', chest: 'Chest', legs: 'Legs', hands: 'Hands', feet: 'Feet', amulet: 'Amulet', ring: 'Ring', relic: 'Relic' };
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
          <Portrait kind="hero" id={h.cls} equip={h.equip} size={48} />
          <div>
            <strong>{h.name}</strong>
            <span>
              Level {h.level} {CLASSES[h.cls].name}
            </span>
            <Bar value={h.xp} max={xpToNext(h.level)} color="#ffe066" label="Experience" />
            <span className="rb-dim rb-small">
              {fmt(h.xp)} / {fmt(xpToNext(h.level))} XP · {fmt(h.gold)} gold
            </span>
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
          <HeroDoll cls={h.cls} equip={h.equip} />
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
                {k === 'armor' ? `${Math.round(b.stats.armor)} (−${Math.round(Math.min(0.6, b.stats.armor / (b.stats.armor + 60)) * 100)}% damage)` : k === 'regen' ? `${b.stats.regen.toFixed(1)}/s` : `${Math.round(b.stats[k])}%`}
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
function isUpgrade(cur: Item | undefined, it: Item): boolean {
  if (!cur) return true;
  return itemScore(it) > itemScore(cur) + 5;
}

/** An item's card: stats, comparison with what is worn, what it changes; `actions` replaces the equip row. */
export function ItemDetail({ engine, item, worn, confirm, onSalvage, onDone, actions }: { engine: SigilEngine; item: Item; worn: boolean; confirm: boolean; onSalvage: () => void; onDone: () => void; actions?: ReactNode }) {
  const h = engine.hero!;
  const slot = itemSlot(item);
  const current = h.equip[slot];
  const compare = !worn && current && current.uid !== item.uid ? current : undefined;
  const lines = modLines(itemMods(item));
  const def = ITEM_DEFS[item.base];
  const reason = cantEquip(h, item);
  const stats = itemStats(item);
  const curStats = compare ? new Map(itemStats(compare)) : null;
  // the hero's health and power before and after wearing it
  const preview = useMemo(() => {
    if (worn || reason) return null;
    const before = buildHero(h);
    const clone = { ...h, equip: { ...h.equip, [slot]: item } };
    const after = buildHero(clone);
    return { hp: after.maxHp - before.maxHp, power: after.stats.power - before.stats.power };
  }, [h, item, slot, worn, reason]);
  const cls = itemClass(item);
  return (
    <div className="rb-item" style={{ ['--rc' as string]: rarityColor(item.r) }}>
      <div className="rb-item-head">
        <ItemIcon item={item} size={52} />
        <div>
          <strong className="rb-item-name">{itemName(item)}</strong>
          <span className="rb-dim rb-small">
            {RARITY_NAME[item.r]} {SLOT_LABEL[slot].toLowerCase()} · item level {item.il}
            {cls ? ` · ${CLASSES[cls].name} only` : ''}
          </span>
        </div>
        <button className="rb-x is-small" onClick={onDone} aria-label="Close details">
          ✕
        </button>
      </div>
      <ul className="rb-item-stats">
        {stats.map(([k, v]) => {
          const old = curStats?.get(k);
          const delta = curStats ? v - (old ?? 0) : 0;
          return (
            <li key={k}>
              {fmtStat(k, v)}
              {curStats && Math.round(delta * 10) !== 0 && <span className={delta > 0 ? 'rb-up-t' : 'rb-down-t'}> ({delta > 0 ? '+' : ''}{k === 'regen' ? delta.toFixed(1) : Math.round(delta)})</span>}
            </li>
          );
        })}
        {curStats &&
          [...curStats.entries()]
            .filter(([k]) => !stats.some(([s]) => s === k))
            .map(([k, v]) => (
              <li key={`lost-${k}`} className="rb-down-t">
                Loses {fmtStat(k, v)}
              </li>
            ))}
      </ul>
      {lines.length > 0 && (
        <div className="rb-item-mods">
          <span className="rb-kicker">Changes how you fight</span>
          {lines.map((l) => (
            <p key={l} className="rb-gold">
              {l}
            </p>
          ))}
        </div>
      )}
      {compare && (
        <div className="rb-item-compare">
          <span className="rb-kicker">You wear: {itemName(compare)}</span>
          {modLines(itemMods(compare)).map((l) => (
            <p key={l} className="rb-dim">
              {lines.includes(l) ? '' : 'You would lose: '}
              {l}
            </p>
          ))}
        </div>
      )}
      {preview && (preview.hp !== 0 || preview.power !== 0) && (
        <p className="rb-small">
          If worn: <span className={preview.hp >= 0 ? 'rb-up-t' : 'rb-down-t'}>{preview.hp >= 0 ? '+' : ''}{preview.hp} health</span>,{' '}
          <span className={preview.power >= 0 ? 'rb-up-t' : 'rb-down-t'}>{preview.power >= 0 ? '+' : ''}{Math.round(preview.power)}% damage</span>
        </p>
      )}
      {def && <p className="rb-lore">“{def.lore}”</p>}
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
  if (spec.cost > 0 && w.player.maxMana > 0) parts.push(`${Math.round((spec.cost * w.player.maxMana) / 100)} mana`);
  if (spec.extra.manaOnHit && w.player.maxMana > 0) parts.push(`+${Math.round((spec.extra.manaOnHit * w.player.maxMana) / 100)} mana per hit`);
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
  const [slot, setSlot] = useState<0 | 1 | 2>(0);
  const learned = learnedSkills(h);
  const keys = engine.touchMode ? ['Skill 1', 'Skill 2', 'Skill 3'] : ['Q', 'E', 'R'];
  return (
    <div className="rb-skills">
      <section>
        <span className="rb-kicker">Your three skill slots: pick a slot, then a skill</span>
        <div className="rb-skill-slots">
          {([0, 1, 2] as const).map((i) => {
            const id = h.skills[i];
            return (
              <button key={i} className={`rb-skillslot${slot === i ? ' is-on' : ''}`} onClick={() => setSlot(i)}>
                <span className="rb-kbd">{keys[i]}</span>
                {id ? <SkillIcon id={id} size={32} /> : <span className="rb-dim">empty</span>}
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
              Reset talents{cost ? ` (${cost} gold)` : ' (free until level 15)'}
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
                    <img src={glyphIconUrl(n.icon, tree.color, 4)} alt="" draggable={false} />
                    <span className="rb-node-rank">
                      {rank}/{n.ranks}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
        <div className="rb-talent-detail">
          {node ? (
            <>
              <strong>
                {node.name}{' '}
                <span className="rb-dim">
                  · rank {h.talents[node.id] ?? 0}/{node.ranks} · {cls.trees[node.tree].name}
                  {node.row === TALENT_ROWS - 1 ? ' · capstone' : ''}
                </span>
              </strong>
              <p>{node.text}</p>
              {(h.talents[node.id] ?? 0) > 0 && modLines(node.mods.map((m) => scaleMod(m, h.talents[node.id] ?? 0))).length > 0 && <p className="rb-gold rb-small">Now: {modLines(node.mods.map((m) => scaleMod(m, h.talents[node.id] ?? 0))).join(' ')}</p>}
              {cantLearn(h, node.id) ? (
                <p className="rb-dim rb-small">{cantLearn(h, node.id)}</p>
              ) : (
                <button className="rb-btn is-gold" onClick={() => engine.learn(node.id)}>
                  Learn {node.name}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="rb-small">
                <b style={{ color: cls.trees[h.spec].color }}>{cls.trees[h.spec].passive.name}</b> ({cls.trees[h.spec].name}): {cls.trees[h.spec].passive.text}
              </p>
              <p className="rb-dim rb-small">
                Pick a talent to read it. Each row opens after {ROW_COST} more points in its tree; the last row is the tree’s capstone. Your specialization’s tree comes first: the other two open after {SPEC_FOCUS} points in it.
              </p>
            </>
          )}
        </div>
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
  const active = QUESTS.filter((q) => questState(h, q.id) === 'active');
  const done = QUESTS.filter((q) => questState(h, q.id) === 'done');
  // grouped by where they are done, this region first
  const groups = new Map<string, QuestDef[]>();
  for (const q of active) {
    const r = questRegion(q) ?? npcRegion(q.giver) ?? 'emberwick';
    groups.set(r, [...(groups.get(r) ?? []), q]);
  }
  const order = [...groups.keys()].sort((a, b) => Number(b === here) - Number(a === here));
  return (
    <div className="rb-quests">
      {active.length === 0 && <p className="rb-dim">No quests right now. The Rift will stir again.</p>}
      {order.map((r) => (
        <section key={r} className="rb-quest-group">
          <span className="rb-kicker">
            {REGIONS[r as RegionId]?.name ?? r}
            {r === here ? ' · here' : ''}
          </span>
          {groups.get(r)!.map((q) => {
            const pr = questProgress(h, q);
            return (
              <article key={q.id} className="rb-quest">
                <strong>{q.name}</strong>
                <p>{q.text}</p>
                <span className="rb-small">
                  {q.objective.label}
                  {pr.of > 1 ? `: ${pr.n} / ${pr.of}` : ''}
                </span>
                {pr.of > 1 && <Bar value={pr.n} max={pr.of} color="#ffcf5a" />}
                <span className="rb-small rb-dim">
                  Reward: {q.reward.xp} XP · {q.reward.gold} gold{q.reward.item ? ' · an item' : ''}
                  {q.reward.unlock ? ` · opens ${REGIONS[q.reward.unlock].name}` : ''}
                  {q.reward.perk ? <b className="rb-gold"> · {PERKS[q.reward.perk].name}: {PERKS[q.reward.perk].text}</b> : null}
                </span>
              </article>
            );
          })}
        </section>
      ))}
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

/* ----------------------------------------------------------------- map */

function MapPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const w = engine.world!;
  const atStone = !!w.interactable && w.interactable.kind === 'waystone';
  const canTravel = atStone || w.region.safe;
  const [sel, setSel] = useState<RegionId>(w.region.id);
  const [tier, setTier] = useState(Math.min(h.tier, w.tier || h.tier));
  const [mods, setMods] = useState<RiftMod[]>([]);
  const r = REGIONS[sel];
  const open = h.unlocked.includes(sel);
  const here = w.region.id === sel;
  // difficulty tiers are for dungeons (and the old wood)
  const tiered = h.tier > 0 && (r.kind === 'dungeon' || sel === 'whisperwood');
  const pick = tiered ? tier : 0;
  const goal = trackedQuest(h, w.region.id);
  return (
    <div className="rb-map">
      <section className="rb-map-left">
        <span className="rb-kicker">{w.region.name}</span>
        <MiniMap engine={engine} />
      </section>
      <section className="rb-map-right">
        <span className="rb-kicker">{canTravel ? 'The world · travel by waystone' : 'The world · travel from a waystone or a town'}</span>
        <WorldMap hero={h} here={w.region.id} sel={sel} goal={goal ? questRegion(goal) : undefined} onSel={setSel} />
        <div className={`rb-dest${open ? '' : ' is-locked'}${here ? ' is-here' : ''}`}>
          <div>
            <strong>
              {open || r.kind === 'town' ? r.name : 'Unknown land'} <span className="rb-dim rb-small">{r.kind === 'town' ? 'Town' : `${r.kind === 'dungeon' ? 'Dungeon' : 'Wilds'} · levels ${r.levels[0] + TIERS[pick]!.levels}-${r.levels[1] + TIERS[pick]!.levels}`}</span>
            </strong>
            <span className="rb-small rb-dim">{open ? r.blurb : sel === 'whisperwood' ? 'Finish your training with Elder Maren.' : sel === 'crypt' ? 'Defeat Grimtusk in the Whisperwood.' : 'Not discovered yet: walk there to find it.'}</span>
          </div>
          <button className="rb-btn is-small is-gold" disabled={!open || !canTravel || (here && (r.safe || pick === w.tier))} onClick={() => engine.travel(sel, pick, mods, undefined)}>
            {here ? 'Here' : 'Go'}
          </button>
        </div>
        {tiered && (
          <div className="rb-tiers">
            <span className="rb-kicker">Difficulty</span>
            <div className="rb-seg">
              {TIERS.slice(0, h.tier + 1).map((t, i) => (
                <button key={t.name} className={tier === i ? 'is-on' : ''} style={{ color: t.color }} onClick={() => setTier(i)}>
                  {t.name}
                </button>
              ))}
            </div>
            <span className="rb-small rb-dim">
              {TIERS[tier]!.name}: enemies +{TIERS[tier]!.levels} levels, ×{TIERS[tier]!.loot} loot, ×{TIERS[tier]!.xp} XP{tier > 0 ? ', elites with more affixes' : ''}.
            </span>
            {tier > 0 && (
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

const KIND_COLOR: Record<RegionDef['kind'], string> = { town: '#ffcf5a', wild: '#6ad06a', dungeon: '#c58cff' };

/** The world at a glance: every region where it lies, the ways between them, what is still unknown. */
function WorldMap({ hero, here, sel, goal, onSel }: { hero: Character; here: RegionId; sel: RegionId; goal?: RegionId; onSel: (r: RegionId) => void }) {
  const links = useMemo(() => regionLinks(), []);
  // the box fits the world, with room for the names under the edge regions
  const box = useMemo(() => {
    const xs = REGION_IDS.map((id) => REGIONS[id].at[0]);
    const ys = REGION_IDS.map((id) => REGIONS[id].at[1]);
    const x0 = Math.min(...xs) - 12;
    const y0 = Math.min(...ys) - 6;
    return { x0, y0, w: Math.max(...xs) + 12 - x0, h: Math.max(...ys) + 12 - y0 };
  }, []);
  const known = (id: RegionId): boolean => hero.unlocked.includes(id) || REGIONS[id].kind === 'town';
  return (
    <svg className="rb-world" viewBox={`${box.x0} ${box.y0} ${box.w} ${box.h}`} role="group" aria-label="World map">
      <rect x={box.x0} y={box.y0} width={box.w} height={box.h} rx="3" className="rb-world-sea" />
      {links.map(([a, b]) => {
        const A = REGIONS[a].at;
        const B = REGIONS[b].at;
        return <line key={`${a}-${b}`} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} className={known(a) && known(b) ? 'is-known' : ''} />;
      })}
      {REGION_IDS.map((id) => {
        const r = REGIONS[id];
        const [x, y] = r.at;
        const k = known(id);
        const col = k ? KIND_COLOR[r.kind] : '#6a6480';
        return (
          <g key={id} className={`rb-world-node${id === sel ? ' is-sel' : ''}`} onClick={() => onSel(id)} role="button" aria-label={k ? r.name : 'Unknown land'} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSel(id)}>
            {id === here && <circle cx={x} cy={y} r="5.2" className="rb-world-here" />}
            {r.kind === 'town' ? <rect x={x - 2.6} y={y - 2.6} width="5.2" height="5.2" rx="1" fill={col} /> : r.kind === 'dungeon' ? <rect x={x - 2.2} y={y - 2.2} width="4.4" height="4.4" fill={col} transform={`rotate(45 ${x} ${y})`} /> : <circle cx={x} cy={y} r="3.1" fill={col} />}
            {!k && (
              <text x={x} y={y + 1.1} className="rb-world-q">
                ?
              </text>
            )}
            {id === goal && (
              <text x={x + 3.2} y={y - 2.6} className="rb-world-goal">
                !
              </text>
            )}
            <text x={x} y={y + 6.4} className="rb-world-name">
              {k ? r.name.replace(/^The /, '') : '???'}
            </text>
            <text x={x} y={y + 9} className="rb-world-lvl">
              {r.kind === 'town' ? 'town' : `${r.levels[0]}-${r.levels[1]}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A small overview of the current region with the hero on it. */
function MiniMap({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = engine.world!;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const m = w.map;
    c.width = m.w * 2;
    c.height = m.h * 2;
    const g = c.getContext('2d')!;
    const pal = mapColors(w.region.theme);
    const color = (k: number): string => {
      if (k === K.Wall || k === K.Illusion) return pal.wall;
      if (k === K.Water) return pal.water;
      if (k === K.Path || k === K.Bridge) return pal.path;
      if (k === K.Cobble) return pal.cobble;
      if (k === K.Sand) return pal.sand;
      if (k === K.Tree || k === K.Bush) return pal.wall;
      if (k === K.House || k === K.HouseAnchor) return pal.house;
      if (k === K.Door) return '#8a6a3a';
      return pal.floor;
    };
    for (let i = 0; i < m.w * m.h; i++) {
      g.fillStyle = color(m.kind[i]!);
      g.fillRect((i % m.w) * 2, Math.floor(i / m.w) * 2, 2, 2);
    }
    const dot = (x: number, y: number, col: string, s = 3): void => {
      g.fillStyle = '#000';
      g.fillRect(Math.round((x / TILE) * 2) - s / 2 - 1, Math.round((y / TILE) * 2) - s / 2 - 1, s + 2, s + 2);
      g.fillStyle = col;
      g.fillRect(Math.round((x / TILE) * 2) - s / 2, Math.round((y / TILE) * 2) - s / 2, s, s);
    };
    for (const ws of w.waystones) dot(ws.x, ws.y, '#22e4ff', 4);
    for (const c2 of w.chests) if (!c2.open) dot(c2.x, c2.y, '#ffcf5a', 3);
    for (const n of w.npcs) dot(n.x, n.y, '#ffffff', 3);
    for (const x of w.exits) dot(x.x, x.y, '#ff3fd2', 4);
    const goal = objectiveTarget(w);
    if (goal) dot(goal.x, goal.y, '#ffe066', 5);
    dot(w.player.x, w.player.y, '#ff4a4a', 4);
  }, [w, engine.version]);
  return (
    <div className="rb-minimap">
      <canvas ref={ref} aria-label={`Map of ${w.region.name}`} />
      <span className="rb-small rb-dim">
        <i style={{ background: '#ff4a4a' }} /> you <i style={{ background: '#22e4ff' }} /> waystone <i style={{ background: '#ffcf5a' }} /> chest <i style={{ background: '#ff3fd2' }} /> exit <i style={{ background: '#ffe066' }} /> quest{w.npcs.length > 0 && (
          <>
            {' '}
            <i style={{ background: '#ffffff' }} /> villager
          </>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ settings */

export function SettingsPanel({ engine, onClose }: { engine: SigilEngine; onClose: () => void }) {
  const s = engine.settings;
  const set = engine.setSettings.bind(engine);
  const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'deadzone' | 'sensitivity' | 'joystick', min: number, max: number, step: number, show: (v: number) => string) => (
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
          <div className="rb-seg" role="group" aria-label="Aim assist">
            {['Off', 'Light', 'Strong'].map((l, i) => (
              <button key={l} className={s.aimAssist === i ? 'is-on' : ''} onClick={() => set({ aimAssist: i })}>
                Aim assist: {l}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">Spells go where your hero faces (the small arrow) or where you drag them. Aim assist nudges a dragged aim by a few degrees toward an enemy; it never overrides where you point.</span>
          <span className="rb-kicker">Keyboard</span>
          <div className="rb-seg" role="group" aria-label="Ultimate key">
            {(['f', 't', 'shift', 'rmb'] as const).map((k) => (
              <button key={k} className={s.ultKey === k ? 'is-on' : ''} onClick={() => set({ ultKey: k })}>
                Ultimate: {k === 'rmb' ? 'Right mouse' : k === 'shift' ? 'Shift' : k.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="rb-small rb-dim">WASD move · mouse aim · left click attack · Q E R skills · Space dodge · 1 potion · {s.ultKey === 'f' ? 'G' : 'F'} talk/travel · I bag · K talents · U skills · J quests · M map · Esc pause</span>
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
          <button className="rb-btn is-small is-ghost" onClick={() => engine.resetSettings()}>
            Reset settings
          </button>
          <span className="rb-small rb-dim">
            {engine.canSave ? 'Your heroes are saved on this device. Sign in on GlitchBound and they follow you to your other devices.' : 'Saving is off on this device right now.'}
          </span>
        </section>
      </div>
    </Frame>
  );
}

/** The hero in everything they wear; tap to turn them around. */
function HeroDoll({ cls, equip }: { cls: ClassId; equip: Character['equip'] }) {
  const [view, setView] = useState(0);
  const views = ['down', 'side', 'up'] as const;
  return (
    <button className="rb-doll" style={{ gridArea: 'doll' }} onClick={() => setView((v) => (v + 1) % views.length)} aria-label="Your hero in their gear (tap to turn)">
      <img src={heroDollUrl(heroLook(cls, equip), views[view]!, 4)} alt="" draggable={false} />
    </button>
  );
}
