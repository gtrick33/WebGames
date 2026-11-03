import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoom, listRooms, quickMatch, roomInfo, seatedName, type GoneCode, type ListedRoom, type RoomGame, type RoomListing } from '../platform/rooms';
import { t } from '../i18n';
import './OnlinePlay.css';

/**
 * Every live-room game's way online, in one place: Quick match (straight into a public room that is
 * about to start, or a new one others are sent to), Create a room (public, so it shows in the room
 * list, or private, for those with the link or code) and Browse rooms (the public ones with a free
 * seat, in a window of their own). The game says how it opens and joins its rooms.
 */

/**
 * Quick match sends players straight in under the name they play by, and a reload (or a dropped phone
 * coming back) of a room you were just in takes you back to your seat under the name you had there:
 * the name to join with, or null to ask.
 */
export function matchedName(name: string): string | null {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search);
  const room = q.get('room');
  const back = room ? seatedName(room) : null;
  if (back) return back.slice(0, 20);
  return q.get('match') === '1' && name.trim() ? name.trim().slice(0, 20) : null;
}

/** The games' names and faces in the room list. */
export const ROOM_GAME_INFO: Record<RoomGame, { title: string; emoji: string }> = {
  impostor: { title: 'Impostor', emoji: '🕵️' },
  'crass-act': { title: 'Crass Act', emoji: '😈' },
  nhie: { title: 'Never Have I Ever', emoji: '🙊' },
  auction: { title: 'Name Your Price', emoji: '🔨' },
  board: { title: 'Dice Adventure', emoji: '🎲' },
  rps: { title: 'Rock Paper Scissors', emoji: '✊' },
  dial: { title: 'Dial It In', emoji: '📻' },
  unique: { title: 'One of a Kind', emoji: '🦄' },
  hues: { title: 'Hue Knew?', emoji: '🎨' },
  scribble: { title: 'Scribble Scramble', emoji: '🖍️' },
  drag: { title: 'Launch Control', emoji: '🏁' },
  belot: { title: 'Belot', emoji: '🃏' },
  backgammon: { title: 'Backgammon', emoji: '🎲' },
  sigilfall: { title: 'Sigilfall', emoji: '⚔️' },
  'sigilfall-ring': { title: 'Sigilfall: The Ring', emoji: '⚔️' },
  'sigilfall-vigil': { title: 'Sigilfall: The Vigil', emoji: '🔥' },
  'crater-crew': { title: 'Crater Crew', emoji: '💥' },
};

const OPEN = new Set(['lobby', 'waiting', 'over', 'result']);
/** How often an open room list refreshes. */
const LIST_EVERY_MS = 5000;
/** The search shows for at least this long, so a quick find doesn't flash by. */
const SEARCH_MIN_MS = 1100;

export function OnlinePlay({
  game,
  onCreate,
  onJoin,
  className = '',
  inlineList = false,
  busyLabel,
  disabled = false,
}: {
  game: RoomGame;
  /** Opens a room (public when `listed`) and goes into it; returns an error to show, or null. */
  onCreate: (listed: boolean) => Promise<string | null>;
  /** Goes into a room (from the list or quick match); `matched` when quick match chose it. */
  onJoin: (code: string, matched: boolean) => void | Promise<string | null | void>;
  className?: string;
  /** Show this game's public rooms right here (a game's own sheet) instead of in a window. */
  inlineList?: boolean;
  busyLabel?: string;
  /** Not yet (e.g. the player has to pick a name first). */
  disabled?: boolean;
}) {
  const [listed, setListed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState<null | { stage: 'looking' | 'found' | 'new'; code?: string }>(null);
  const cancelled = useRef(false);

  const create = async (): Promise<void> => {
    setBusy(true);
    setErr((await onCreate(listed)) ?? '');
    setBusy(false);
  };

  const join = async (code: string, matched: boolean): Promise<void> => {
    const out = await onJoin(code, matched);
    if (typeof out === 'string' && out) setErr(out);
  };

  const quick = async (): Promise<void> => {
    cancelled.current = false;
    setErr('');
    setSearch({ stage: 'looking' });
    const started = Date.now();
    try {
      // the room it picked may have filled up meanwhile: ask again, skipping it (a few times at most)
      const skip: string[] = [];
      let found = await quickMatch(game);
      while (!found.created && skip.length < 3) {
        const info = await roomInfo(found.code);
        if (info && !info.full) break;
        skip.push(found.code);
        found = await quickMatch(game, skip);
      }
      await new Promise((r) => setTimeout(r, Math.max(0, SEARCH_MIN_MS - (Date.now() - started))));
      if (cancelled.current) return;
      setSearch({ stage: found.created ? 'new' : 'found', code: found.code });
      await new Promise((r) => setTimeout(r, 700));
      if (cancelled.current) return;
      setSearch(null);
      await join(found.code, true);
    } catch (e) {
      setSearch(null);
      if (!cancelled.current) setErr(e instanceof Error ? t(e.message) : t('Matchmaking is not available right now. Try again in a minute.'));
    }
  };

  return (
    <div className={`op ${className}`}>
      <button className="op-btn op-quick" onClick={() => void quick()} disabled={disabled || busy || !!search}>
        <span aria-hidden="true">⚡️</span> {t('Quick match')}
        <small>{t('Join players looking for a game')}</small>
      </button>
      <div className="op-create">
        <div className="op-seg" role="radiogroup" aria-label={t('Who can join')}>
          <button role="radio" aria-checked={listed} className={listed ? 'is-on' : ''} onClick={() => setListed(true)}>
            🌍 {t('Public')}
          </button>
          <button role="radio" aria-checked={!listed} className={!listed ? 'is-on' : ''} onClick={() => setListed(false)}>
            🔒 {t('Private')}
          </button>
        </div>
        <button className="op-btn op-make" onClick={() => void create()} disabled={disabled || busy || !!search}>
          {busy ? (busyLabel ?? t('Opening…')) : t('Create a room')}
        </button>
        <p className="op-note">{listed ? t('Anyone can find it in the room list, or join with the code.') : t('Only people with the link or code can join.')}</p>
      </div>
      {inlineList ? (
        <RoomList game={game} onJoin={(code) => !disabled && void join(code, false)} />
      ) : (
        <button className="op-btn op-browse" onClick={() => setBrowse(true)} disabled={disabled || !!search}>
          <span aria-hidden="true">🔎</span> {t('Browse public rooms')}
        </button>
      )}
      {err && (
        <p className="op-err" role="alert">
          {err}
        </p>
      )}
      {browse && (
        <RoomBrowser
          game={game}
          onClose={() => setBrowse(false)}
          onJoin={(code) => {
            setBrowse(false);
            void join(code, false);
          }}
        />
      )}
      {search && (
        <Searching
          game={game}
          stage={search.stage}
          onCancel={() => {
            cancelled.current = true;
            setSearch(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * The dimmed layer under a window: a modal <dialog>, so it shows in the browser's top layer, over the
 * game stage and in full screen too.
 */
function Veil({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => d?.close?.();
  }, []);
  return (
    <dialog
      ref={ref}
      className="op-veil"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => onClose && e.target === e.currentTarget && onClose()}
    >
      {children}
    </dialog>
  );
}

/** A window over the page (Escape or a tap outside closes it). */
export function OnlineWindow({ label, title, sub, onClose, children }: { label: string; title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      before?.focus?.();
    };
  }, []);
  return (
    <Veil onClose={onClose}>
      <div className="op-window" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={box}>
        <div className="op-window-head">
          <h2>
            {title}
            {sub && <small>{sub}</small>}
          </h2>
          <button className="op-x" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </Veil>
  );
}

/** A window of its own: the public rooms (one game's, or every game's), refreshed while it is open. */
export function RoomBrowser({ game, onJoin, onClose }: { game?: RoomGame; onJoin: (code: string, room: ListedRoom) => void; onClose: () => void }) {
  return (
    <OnlineWindow label={t('Public rooms')} title={<>🌐 {t('Public rooms')}</>} sub={game && t(ROOM_GAME_INFO[game].title)} onClose={onClose}>
      <RoomList game={game} onJoin={onJoin} />
    </OnlineWindow>
  );
}

/** The public rooms with a free seat, open lobbies first. `empty`: what to say when there are none (a page without Create and Quick match says its own). */
export function RoomList({ game, onJoin, empty }: { game?: RoomGame; onJoin: (code: string, room: ListedRoom) => void; empty?: string }) {
  const [rooms, setRooms] = useState<ListedRoom[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    const load = (): void => {
      listRooms(game).then(
        (list) => {
          if (!live) return;
          setRooms(list);
          setErr('');
        },
        (e: unknown) => live && setErr(e instanceof Error ? t(e.message) : ''),
      );
    };
    load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), LIST_EVERY_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [game]);
  if (err && !rooms) return <p className="op-empty">{err}</p>;
  if (!rooms) return <p className="op-empty">{t('Looking for rooms…')}</p>;
  if (!rooms.length)
    return (
      <div className="op-empty">
        <span aria-hidden="true">🦗</span>
        <p>{empty ?? t('No public rooms right now. Create one, or try Quick match: others searching will land in yours.')}</p>
      </div>
    );
  return (
    <ul className="op-rooms" aria-live="polite">
      {rooms.map((r) => {
        const info = ROOM_GAME_INFO[r.game] ?? { title: r.game, emoji: '🎮' };
        const open = OPEN.has(r.phase);
        return (
          <li key={r.code} className="op-room">
            <span className="op-room-face" aria-hidden="true">
              {info.emoji}
            </span>
            <span className="op-room-text">
              <b>{r.host ? t('{name}’s room', { name: r.host }) : t('Room {code}', { code: r.code })}</b>
              <small>
                {!game && <>{t(info.title)} · </>}
                <span className="op-mono">{r.code}</span>
                {r.matched && <> · ⚡️ {t('Quick match')}</>}
              </small>
            </span>
            <span className={`op-chip${open ? ' is-open' : ''}`}>{open ? t('In the lobby') : t('Playing')}</span>
            <span className="op-count op-mono" aria-label={t('{n} of {max} players', { n: r.players, max: r.max })}>
              👥 {r.players}/{r.max}
            </span>
            <button className="op-btn op-join" onClick={() => onJoin(r.code, r)}>
              {t('Join')}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Searching({ game, stage, onCancel }: { game: RoomGame; stage: 'looking' | 'found' | 'new'; onCancel: () => void }) {
  const info = ROOM_GAME_INFO[game];
  return (
    <Veil>
      <div className="op-window op-search" role="dialog" aria-modal="true" aria-label={t('Quick match')}>
        <div className={`op-radar${stage === 'looking' ? '' : ' is-done'}`} aria-hidden="true">
          <span>{info.emoji}</span>
        </div>
        <p className="op-search-line" role="status">
          {stage === 'looking' ? t('Looking for players…') : stage === 'found' ? t('Found a room! Joining…') : t('No one waiting yet: opening a room others will join…')}
        </p>
        <small className="op-note">{t(info.title)}</small>
        {stage === 'looking' && (
          <button className="op-btn" onClick={onCancel} autoFocus>
            {t('Cancel')}
          </button>
        )}
      </div>
    </Veil>
  );
}

/**
 * Inside a room's lobby: whether it is public or private (the host can switch), and for a quick-match
 * room, how many it still needs and when it starts by itself.
 */
export function RoomListingBar({ listing, host, players, min, skew = 0, onListed }: { listing: RoomListing | null; host: boolean; players: number; min: number; skew?: number; onListed: (listed: boolean) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const startAt = listing?.startAt ?? null;
  useEffect(() => {
    if (!startAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startAt]);
  if (!listing) return null;
  if (listing.matched) {
    const left = startAt ? Math.max(0, Math.ceil((startAt - (now + skew)) / 1000)) : null;
    return (
      <div className="op-bar is-matched" role="status">
        <span aria-hidden="true">⚡️</span>
        <span>
          <b>{t('Quick match room')}</b>
          <small>{left !== null ? t('Starting in {n}s…', { n: left }) : t('Waiting for players: {n} more to start', { n: Math.max(1, min - players) })}</small>
        </span>
        {left === null && <span className="op-dots" aria-hidden="true" />}
      </div>
    );
  }
  return (
    <div className="op-bar">
      <span aria-hidden="true">{listing.listed ? '🌍' : '🔒'}</span>
      <span>
        <b>{listing.listed ? t('Public room') : t('Private room')}</b>
        <small>{listing.listed ? t('Listed in Browse public rooms') : t('Only people with the link or code can join.')}</small>
      </span>
      {host && (
        <button className="op-btn op-mini" onClick={() => onListed(!listing.listed)}>
          {listing.listed ? t('Make private') : t('Make public')}
        </button>
      )}
    </div>
  );
}

/**
 * A next step on a room's closed, not-found or full screen, so a player is never left with only Back:
 * Quick match (into another room, skipping this one) and Open a new room (public). `onRoom` goes into the
 * room it found or opened, as the game does it. `code`: why the room sent them away ('kicked' offers only a
 * new room of their own; 'replaced' nothing, as they are playing in another tab).
 */
export function RoomNextStep({ game, room, code = 'closed', onRoom, className = '' }: { game: RoomGame; room?: string; code?: GoneCode | ''; onRoom: (code: string, matched: boolean) => void; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (code === 'replaced') return null;
  const go = async (how: 'match' | 'new'): Promise<void> => {
    setBusy(true);
    setErr('');
    try {
      if (how === 'match') {
        const found = await quickMatch(game, room ? [room] : []);
        onRoom(found.code, true);
      } else onRoom(await createRoom(game, true), false);
    } catch (e) {
      setErr(e instanceof Error ? t(e.message) : t('Could not open a room. Try again.'));
    }
    setBusy(false);
  };
  return (
    <div className={`op-next ${className}`} style={{ display: 'grid', gap: 10 }}>
      {code !== 'kicked' && game !== 'sigilfall' && (
        <button className="op-btn op-quick" onClick={() => void go('match')} disabled={busy}>
          <span aria-hidden="true">⚡️</span> {t('Quick match')}
          <small>{t('Join players looking for a game')}</small>
        </button>
      )}
      <button className="op-btn op-make" onClick={() => void go('new')} disabled={busy}>
        {busy ? t('Opening…') : t('Open a new room')}
      </button>
      {err && (
        <p className="op-err" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
