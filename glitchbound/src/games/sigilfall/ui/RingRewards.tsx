import { bestRating } from '../arena/ranks';
import { RING_REWARDS, type RingReward } from '../arena/rewards';
import type { RingSave } from '../arena/ladder';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import type { Character } from '../progress/character';
import { ownedShopLooks, ownsShopItem, shopLook } from '../progress/shopGoods';
import { earnedTitles, RING_TITLES, titleName, wornTitle } from '../progress/titles';
import { BARE_LOOK, lookFits, lookOf, wornId, type Look, type LookSlot } from '../progress/wardrobe';
import type { WornLooks } from '../render/sprites';

/**
 * What the Ring gives and how a fighter shows it: the ladder of rewards (a title and a suit of Ringforged armor at
 * every rank), and the choice of title and armor to fight in. A campaign hero worn in the Ring keeps the choice with
 * them (it is their Wardrobe and their title); a fighter in plain clothes keeps theirs with the Ring's own standing.
 */

/** The four colors of a suit, as a swatch. */
function Swatch({ r }: { r: RingReward }) {
  return (
    <span className="rb-rw-swatch" aria-hidden="true">
      {r.colors.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

/** The ladder, as a strip of pips in the lobby: what is earned, and what the next one is. */
export function RewardStrip({ best, onOpen }: { best: number; onOpen: () => void }) {
  const next = RING_REWARDS.find((r) => r.at > best);
  return (
    <button className="rb-rw-strip" onClick={onOpen} aria-label="Ring rewards">
      <span className="rb-rw-pips" aria-hidden="true">
        {RING_REWARDS.map((r) => (
          <i key={r.at} className={best >= r.at ? 'is-on' : ''} style={{ ['--r' as string]: r.color }} />
        ))}
      </span>
      <span className="rb-rw-next">
        {next ? (
          <>
            <b>Next reward at {next.at}</b>
            <small>
              The title {next.rank} and the {next.harness}
            </small>
          </>
        ) : (
          <>
            <b>Every reward earned</b>
            <small>The top of the ladder is yours</small>
          </>
        )}
      </span>
      <span className="rb-rw-more">Rewards</span>
    </button>
  );
}

/** Every reward, in full. */
export function RewardsDialog({ best, onClose }: { best: number; onClose: () => void }) {
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Ring rewards" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb-ring-dialog rb-rw-dialog">
        <h2>Ring rewards</h2>
        <p>Every rank gives its title and a suit of Ringforged armor, for good, for any class. Your best rating: {best}.</p>
        <ul className="rb-rw-list">
          {RING_REWARDS.map((r) => {
            const has = best >= r.at;
            return (
              <li key={r.at} className={has ? 'is-on' : ''} style={{ ['--r' as string]: r.color }}>
                <span className="rb-rw-at">
                  <b>{r.at}</b>
                  <small>{r.rank}</small>
                </span>
                <span className="rb-rw-what">
                  <span>
                    Title: <b>{r.rank}</b>
                  </span>
                  <span>
                    Armor: <b>{r.helm}</b> and <b>{r.harness}</b> <Swatch r={r} />
                  </span>
                </span>
                <em>{has ? 'Earned' : `${r.at - best} to go`}</em>
              </li>
            );
          })}
        </ul>
        <div className="rb-vigil-actions">
          <button className="rb-btn is-gold" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** What a climb has just earned, on the result screen. */
export function RewardsEarned({ rewards }: { rewards: RingReward[] }) {
  if (!rewards.length) return null;
  return (
    <div className="rb-rw-earned" role="status">
      {rewards.map((r) => (
        <p key={r.at} style={{ ['--r' as string]: r.color }}>
          <strong>Reward earned</strong>
          <span>
            The title <b>{r.rank}</b>, and the <b>{r.helm}</b> and <b>{r.harness}</b> <Swatch r={r} />
          </span>
          <small>Wear them from “Title & armor” in the lobby, or from any hero’s Wardrobe.</small>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ plain clothes */

type Plain = RingSave['plain'];

/** What a fighter in plain clothes shows over them: the Ring armor (or a shop look) they chose and still own. */
export function plainWorn(p: Plain): WornLooks {
  const out: WornLooks = {};
  for (const slot of ['head', 'chest'] as const) {
    const id = p?.[slot];
    const l = id ? shopLook(id) : undefined;
    if (l && l.slot === slot && ownsShopItem(l.id)) out[slot] = l;
  }
  return out;
}

/** The Ring title a fighter in plain clothes wears, while it is earned. */
export function plainTitle(p: Plain): string | null {
  const t = RING_TITLES.find((x) => x.id === p?.title);
  return t && bestRating() >= t.rating ? t.name : null;
}

/** The title shown for the player: their worn hero's, or their plain choice. */
export const ringTitle = (wear: Character | null, p: Plain): string | null => (wear ? wornTitle(wear) : plainTitle(p));

/* ------------------------------------------------------------------ the choice */

const SLOT_NAME: Record<LookSlot, string> = { head: 'Head', chest: 'Chest', weapon: 'Weapon' };

/** The looks a hero can wear over a slot: their own that fit, and the account's (shop and Ring). */
function looksFor(h: Character, slot: LookSlot): Look[] {
  const own = h.looks.map((id) => lookOf(id)).filter((l): l is Look => !!l && l.slot === slot && lookFits(l, h.cls));
  own.sort((a, b) => Number(b.authored) - Number(a.authored) || a.name.localeCompare(b.name));
  return [...ownedShopLooks().filter((l) => l.slot === slot), ...own];
}

/**
 * Title and armor: for a worn campaign hero, their own title and Wardrobe (kept with the hero); in plain clothes, a
 * Ring title and Ring armor (kept with the Ring's standing).
 */
export function LooksDialog({ engine, cls, wear, plain, doll, shown, onPlain, onChange, onClose }: { engine: SigilEngine; cls: ClassId; wear: Character | null; plain: Plain; doll: string; shown: string; onPlain: (p: NonNullable<Plain>) => void; onChange: () => void; onClose: () => void }) {
  const best = bestRating();
  const titles = wear ? earnedTitles(wear).map((t) => ({ id: t.id, name: titleName(t, wear) })) : RING_TITLES.filter((t) => best >= t.rating).map((t) => ({ id: t.id, name: t.name }));
  const titleNow = wear ? (wear.title === '' ? '' : (titles.find((t) => t.name === wornTitle(wear))?.id ?? '')) : plainTitle(plain) ? (plain?.title ?? '') : '';
  const slots: LookSlot[] = wear ? ['head', 'chest', 'weapon'] : ['head', 'chest'];
  const account = ownedShopLooks();
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Title and armor" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb-ring-dialog rb-rw-dialog rb-rw-looks">
        <h2>Title & armor</h2>
        <div className="rb-rw-preview">
          <img src={doll} alt="" draggable={false} />
          <strong>{shown}</strong>
        </div>
        <p>{wear ? `${wear.name}’s title and Wardrobe. What you choose here is what ${wear.name} wears everywhere.` : 'Fighting in plain clothes: wear a Ring title and any armor your account has earned or bought.'}</p>
        <label className="rb-rw-field">
          <span>Title</span>
          <select
            value={titleNow}
            onChange={(e) => {
              if (wear) engine.entitle(wear, e.target.value);
              else onPlain({ ...plain, title: e.target.value || undefined });
              onChange();
            }}
          >
            <option value="">No title</option>
            {titles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {!titles.length && <p className="rb-rw-none">No title yet. The first is {RING_REWARDS[0]?.rank}, at {RING_REWARDS[0]?.at} rating.</p>}
        {slots.map((slot) => {
          const list = wear ? looksFor(wear, slot) : account.filter((l) => l.slot === slot);
          const now = wear ? (wornId(wear, slot) ?? '') : ((slot !== 'weapon' && plainWorn(plain)[slot] && plain?.[slot]) || '');
          return (
            <label key={slot} className="rb-rw-field">
              <span>{SLOT_NAME[slot]}</span>
              <select
                value={now}
                onChange={(e) => {
                  const id = e.target.value;
                  if (wear) engine.dress(wear, slot, id || null);
                  else if (slot !== 'weapon') onPlain({ ...plain, [slot]: id || undefined });
                  onChange();
                }}
              >
                <option value="">{wear ? 'As equipped' : `The ${cls === 'gloamknight' ? 'gloamknight' : cls}’s own`}</option>
                {wear && slot !== 'weapon' && <option value={BARE_LOOK}>Bare</option>}
                {list.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {!wear && !account.length && <p className="rb-rw-none">No armor yet. The first suit is the {RING_REWARDS[0]?.harness}, at {RING_REWARDS[0]?.at} rating.</p>}
        <div className="rb-vigil-actions">
          <button className="rb-btn is-gold" onClick={onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
