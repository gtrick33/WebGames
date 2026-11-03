import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { ARCADE, earnedPins, PIN_BY_ID, pinsOf, RARITY_MIN_PLAYERS, TIER_POINTS, type PinDef, type PinFacts } from '../catalog/pins';
import { getGame } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import { api, useAccount } from '../platform/account';
import type { PinsView } from '../platform/apiTypes';
import { longestStreak } from '../platform/daily';
import type { Save } from '../platform/save';
import { useSave } from '../platform/store';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './Pins.css';

/** The picture in a pin: its game's art, or the arcade's mark. */
function PinFace({ board }: { board: string }) {
  const game = board === ARCADE ? undefined : getGame(board);
  if (!game) return <span className="pin-mark" aria-hidden="true" />;
  return <img src={game.art.tile} alt="" width={96} height={96} loading="lazy" decoding="async" style={{ background: game.art.bg }} />;
}

/** One enamel pin: struck in its tier's metal when earned, only its pressed outline in the felt until then. */
export function Pin({ pin, earned, rarity, small = false }: { pin: PinDef; earned: boolean; rarity?: string | null; small?: boolean }) {
  const t = useT();
  return (
    <li className={`pin${earned ? ' is-earned' : ''}${small ? ' is-small' : ''}`} data-tier={pin.tier}>
      <span className="pin-body" aria-hidden="true">
        <span className="pin-metal">
          <span className="pin-face">
            <PinFace board={pin.board} />
          </span>
        </span>
      </span>
      <span className="pin-text">
        <strong className="pin-name">{pin.name}</strong>
        <span className="pin-hint">{pin.hint}</span>
        {!small && (
          <span className="pin-meta mono">
            {earned ? t('Earned') : t('{n} points', { n: TIER_POINTS[pin.tier] })}
            {rarity && ` · ${rarity}`}
          </span>
        )}
      </span>
    </li>
  );
}

export function usePins(friend?: string | null, refreshKey = 0): { view: PinsView | null; failed: boolean } {
  const { me } = useAccount();
  const [state, setState] = useState<{ view: PinsView | null; failed: boolean }>({ view: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    api<PinsView>(`/api/pins${friend ? `?friend=${encodeURIComponent(friend)}` : ''}`)
      .then((view) => !cancelled && setState({ view, failed: false }))
      .catch(() => !cancelled && setState({ view: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [friend, refreshKey, me?.id]);
  return state;
}

export function rarityLabel(view: PinsView | null, id: string, t: (s: string, v?: Record<string, string | number>) => string): string | null {
  if (!view || view.rarity.players < RARITY_MIN_PLAYERS) return null;
  const held = view.rarity.held[id] ?? 0;
  if (!held) return null;
  const pct = (held / view.rarity.players) * 100;
  return pct < 1 ? t('held by under 1%') : t('held by {n}%', { n: Math.round(pct) });
}

/** What this browser's own record would have earned: a guest's reason to sign in. Nothing here is awarded. */
export function guestFacts(save: Save, streakDays: Iterable<string>): PinFacts {
  const games: PinFacts['games'] = {};
  let totalRounds = 0;
  for (const [slug, g] of Object.entries(save.games)) {
    if (!g.plays) continue;
    totalRounds += g.plays;
    games[slug] = { rounds: g.plays, score: g.best.score ?? 0, stats: g.best };
  }
  return { games, totalRounds, gamesPlayed: Object.keys(games).length, streak: longestStreak(streakDays), level: 0, friends: 0, podium: false, crown: false };
}

export const guestEarned = (save: Save, streakDays: Iterable<string>): PinDef[] => earnedPins(guestFacts(save, streakDays));

/** A game's own four pins, on its page. A guest sees them too, with the way to start collecting. */
export function GamePins({ game, refreshKey }: { game: GameEntry; refreshKey: number }) {
  const t = useT();
  const { me } = useAccount();
  const { view } = usePins(null, refreshKey);
  const save = useSave();
  const pins = pinsOf(game.slug);
  if (!pins.length) return null;
  const held = new Set(view?.pins.map((p) => p.id));
  const count = pins.filter((p) => held.has(p.id)).length;
  const here = me ? 0 : earnedPins(guestFacts(save, [])).filter((p) => p.board === game.slug).length;
  return (
    <section className="panel game-pins" aria-labelledby="game-pins-title">
      <div className="game-pins-head">
        <h2 id="game-pins-title" className="side-title">
          <Icon name="star" /> {t('Pins to earn')}
        </h2>
        {me && <span className="mono game-pins-count">{count} / {pins.length}</span>}
      </div>
      <ul className="pin-row felt">
        {pins.map((p) => (
          <Pin key={p.id} pin={p} earned={held.has(p.id)} small />
        ))}
      </ul>
      {!me && (
        <button className="board-claim" onClick={() => openSignIn(t('Sign in to collect pins on your Trophy Shelf.'))}>
          <Icon name="star" size={16} /> {here > 0 ? t('You’d hold {n} of these by now. Sign in and your next rounds count.', { n: here }) : t('Sign in and your next rounds count.')}
        </button>
      )}
      <Link href="/trophies" className="quests-link">
        {t('Trophy Shelf')} <Icon name="arrowRight" size={16} />
      </Link>
    </section>
  );
}

/** "New pin!" over a finished round. */
export function PinToast({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const t = useT();
  useEffect(() => {
    const id = window.setTimeout(onDone, 5200);
    return () => window.clearTimeout(id);
  }, [ids, onDone]);
  const pins = ids.flatMap((id) => PIN_BY_ID.get(id) ?? []).slice(0, 3);
  if (!pins.length) return null;
  return (
    <Link href="/trophies" className="pin-toast" role="status">
      <span className="pin-toast-kicker mono">{pins.length > 1 ? t('New pins!') : t('New pin!')}</span>
      <ul className="pin-toast-list">
        {pins.map((p) => (
          <Pin key={p.id} pin={p} earned small />
        ))}
      </ul>
    </Link>
  );
}
