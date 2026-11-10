import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setGuestName, usePlayerName } from '../../../platform/playerName';
import { GAME_ROOM_PAGE, roomInfo, seatedName, useRoom, type GoneCode, type RoomGame } from '../../../platform/rooms';
import { navigate } from '../../../router/router';
import { shareOrCopy } from '../../../platform/share';
import type { SeatView } from '../../rooms/seats';
import { ModeBar } from '../shared';
import { matchedName, RoomListingBar, RoomNextStep } from '../../../components/OnlinePlay';
import { t } from '../../../i18n';
import { cleanRoomName, forgetRoom, lastRoomName, rememberRoomName, ROOM_NAME_MAX, roomNameFor } from './roomName';

const COLORS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#3d7bff', '#a45cff', '#ff7eb6', '#12c6b3', '#ff8a1f', '#8ad13b', '#5b6cff', '#e64c9a', '#00a6d6'];
export const seatColor = (n: number): string => COLORS[(n - 1) % COLORS.length]!;

/** A player's round initial in their seat color. */
export function Dot({ p, size = 34 }: { p: Pick<SeatView, 'n' | 'name'>; size?: number }) {
  return (
    <span className="pt-avatar pt-imp-dot" style={{ background: seatColor(p.n), width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Seconds left until a server deadline (corrected for the clock difference). */
export function useLeft(deadline: number | null, skew: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - (now + skew)) / 1000)) : null;
}

export function Clock({ left }: { left: number | null }) {
  return left === null ? null : <p className={`pt-imp-clock${left <= 5 ? ' is-low' : ''}`}>⏱ {left}s</p>;
}

/**
 * Each new step of a room game starts at the top of the screen (the host often presses Start at the
 * bottom of a long settings list). Returns the ref for the screen.
 */
export function useTopOnPhase(phase: string | undefined) {
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase && window.scrollY > 0) screen.current?.scrollIntoView({ block: 'start' });
  }, [phase]);
  return screen;
}

/** Room errors and connection trouble, floating where they are seen even when scrolled down. */
export function RoomNotice({ error, conn }: { error: string; conn: string }) {
  const text = error || (conn !== 'open' ? 'Reconnecting…' : '');
  return text ? (
    <p className="pt-room-toast" role={error ? 'alert' : 'status'}>
      {text}
    </p>
  ) : null;
}

/** Who has done their part (answered, voted…). */
export function Waiting({ players, label }: { players: SeatView[]; label: string }) {
  return (
    <ul className="pt-imp-waiting" aria-label={label}>
      {players.map((p) => (
        <li key={p.n} className={p.done ? 'is-done' : ''}>
          <Dot p={p} size={28} />
          <span>{p.name}</span>
          <b>{p.done ? '✓' : '…'}</b>
        </li>
      ))}
    </ul>
  );
}

/**
 * The host's “Real life” switch, in every live party game where players type clues for the others:
 * when everyone is in the same room, the clue giver says the clue out loud and taps a button instead.
 */
export function RealLifeSwitch({ on, set }: { on: boolean; set: (on: boolean) => void }) {
  return (
    <label className="pt-switch">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        <b>{t('Real life')}</b>{' '}{t('· all in the same room? Skip typing clues: say them out loud instead, then tap a button to carry on')}
      </span>
    </label>
  );
}

/** Room scores, best first, with what each player just gained. */
export function Scores({ players, gained }: { players: SeatView[]; gained?: Record<string, number> }) {
  return (
    <ol className="pt-imp-scores">
      {[...players]
        .sort((a, b) => b.score - a.score)
        .map((p) => (
          <li key={p.n}>
            <Dot p={p} size={26} />
            <span>
              {p.name}
              {p.you ? t(' (you)') : ''}
            </span>
            {gained?.[String(p.n)] ? <em>+{gained[String(p.n)]}</em> : null}
            <b>{p.score}</b>
          </li>
        ))}
    </ol>
  );
}

export interface FrameView {
  phase: string;
  code: string;
  players: SeatView[];
  host: boolean;
  deadline: number | null;
}

export interface RoomGameMeta {
  game: RoomGame;
  title: string;
  emoji: string;
  /** The invite message (the link is added). */
  invite: string;
  /** How many players it needs to start. */
  min: number;
}

export interface RoomContext<V, A> {
  view: V;
  send: (a: A) => void;
  /** Seconds left on the current clock. */
  left: number | null;
  /** The room's clock minus this phone's (for clocks of its own). */
  skew: number;
  me: SeatView;
  byN: (n: number | null | undefined) => SeatView | undefined;
}

/**
 * A room you can't play in (closed, full, removed): a next step right here (quick match, or a new public room
 * of the same game; see RoomNextStep), or back to Party Mode. `code`: why the room sent you away.
 */
export function DeadEnd({ game, room, code = 'closed', title, heading, text, onLeave }: { game: RoomGame; room: string; code?: GoneCode | ''; title: string; heading: string; text?: string; onLeave: () => void }) {
  return (
    <div className="pt-screen">
      <ModeBar title={title} onExit={onLeave} />
      <section className="pt-panel pt-center">
        <h2>{heading}</h2>
        {text && <p className="pt-muted">{text}</p>}
        <RoomNextStep game={game} room={room} code={code || 'closed'} onRoom={(next, matched) => navigate(`${GAME_ROOM_PAGE[game] ?? '/party'}?room=${next}${matched ? '&match=1' : ''}`)} />
        <button className="pt-btn" onClick={onLeave}>
          {t('Back to Party Mode')}
        </button>
      </section>
    </div>
  );
}

/**
 * The name to join room `code` under: quick match's, or the one this browser joined the room under
 * before, so a reload goes straight back to the seat. `note` is a save problem to show in the room.
 */
export function useJoinName(code: string) {
  const player = usePlayerName();
  const [name, setName] = useState<string | null>(() => matchedName(player.name) ?? roomNameFor(code));
  // Straight back in after a reload (not a quick-match arrival): say hello again.
  const [back] = useState(() => !matchedName(player.name) && roomNameFor(code) !== null);
  const [note, setNote] = useState('');
  const join = (raw: string): void => {
    const n = cleanRoomName(raw);
    if (!n) return;
    // The arcade nickname follows when it fits the arcade's rule (3-14 plain characters); the room keeps the name either way.
    if (!player.member) setGuestName(n);
    const error = rememberRoomName(code, n);
    setNote(error ? t(error) : '');
    setName(n);
  };
  return { name, back, join, note, prefill: seatedName(code) ?? lastRoomName() ?? player.name, forget: () => forgetRoom(code) };
}

/** "Welcome back" for a few seconds after a reload put you straight back in your seat. */
export function WelcomeBack({ name, extra = '' }: { name: string; extra?: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(false), 4000);
    return () => window.clearTimeout(id);
  }, []);
  return shown ? (
    <p className="pt-room-toast" role="status">
      {t('Welcome back, {name}!', { name })}
      {extra && ` ${extra}`}
    </p>
  ) : null;
}

/** The one-time "Join the room" form. */
export function JoinForm({ title, emoji, prefill, onJoin, onLeave }: { title: string; emoji: string; prefill: string; onJoin: (name: string) => void; onLeave: () => void }) {
  const [draft, setDraft] = useState(prefill);
  return (
    <div className="pt-screen">
      <ModeBar title={title} onExit={onLeave} />
      <form
        className="pt-panel pt-imp-join"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(draft);
        }}
      >
        <p className="pt-imp-badge">{emoji}</p>
        <h2>{t('Join the room')}</h2>
        <label className="pt-label" htmlFor="pt-room-name">
          {t('Your name (so friends know who’s who)')}
        </label>
        <input id="pt-room-name" className="pt-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={ROOM_NAME_MAX} autoFocus enterKeyHint="go" />
        <button className="pt-btn pt-btn-go pt-btn-big" disabled={!cleanRoomName(draft)}>
          {t('Join')}
        </button>
      </form>
    </div>
  );
}

/**
 * The shared shell of a Party Mode live room: asks for a name once, connects, and shows the lobby
 * (who's here, invite, the host's settings) and connection problems. Each game renders its own
 * settings and its game screens.
 */
export function RoomFrame<V extends FrameView, A>({
  code,
  meta,
  onLeave,
  kick,
  progress,
  settings,
  onRelay,
  children,
}: {
  code: string;
  meta: RoomGameMeta;
  onLeave: () => void;
  kick: (n: number) => A;
  progress?: (v: V) => string | undefined;
  settings: (ctx: RoomContext<V, A>) => ReactNode;
  /** Streamed messages from the room (Scribble Scramble's strokes). */
  onRelay?: (data: unknown) => void;
  children: (ctx: RoomContext<V, A>) => ReactNode;
}) {
  const { name, back, join, note, prefill, forget } = useJoinName(code);
  const leave = (): void => {
    forget();
    onLeave();
  };
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    void roomInfo(code).then((r) => live && setMissing(!r));
    return () => {
      live = false;
    };
  }, [code]);
  if (missing)
    return (
      <DeadEnd game={meta.game} room={code} title={t('{game} room', { game: t(meta.title) })} heading={t('This room has closed')} text={t('Rooms close after three quiet hours. Open a new one and send the link.')} onLeave={onLeave} />
    );
  if (name === null) return <JoinForm title={`${t(meta.title)} · ${t('room {code}', { code })}`} emoji={meta.emoji} prefill={prefill} onJoin={join} onLeave={onLeave} />;
  return (
    <Connected code={code} name={name} back={back} note={note} meta={meta} onLeave={leave} kick={kick} progress={progress} settings={settings} onRelay={onRelay}>
      {children}
    </Connected>
  );
}

function Connected<V extends FrameView, A>({
  code,
  name,
  back,
  note,
  meta,
  onLeave,
  kick,
  progress,
  settings,
  onRelay,
  children,
}: {
  code: string;
  name: string;
  back: boolean;
  note: string;
  meta: RoomGameMeta;
  onLeave: () => void;
  kick: (n: number) => A;
  progress?: (v: V) => string | undefined;
  settings: (ctx: RoomContext<V, A>) => ReactNode;
  onRelay?: (data: unknown) => void;
  children: (ctx: RoomContext<V, A>) => ReactNode;
}) {
  const { view, conn, error, clearError, gone, goneCode, skew, send, listing, setListed } = useRoom<V, A>(code, name, onRelay);
  const left = useLeft(view?.deadline ?? null, skew);
  const screen = useTopOnPhase(view?.phase);
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(t);
  }, [error, clearError]);
  const invite = (): void => {
    void shareOrCopy({ title: t('{game} room', { game: t(meta.title) }), text: `${t(meta.invite)}\n${t('Room code')} ${code}`, url: `${location.origin}/r/${code}` });
  };

  const bar = <ModeBar title={`${t(meta.title)} · ${code}`} progress={view && !gone ? progress?.(view) : undefined} onExit={onLeave} />;
  if (gone) return <DeadEnd game={meta.game} room={code} code={goneCode} title={`${t(meta.title)} · ${code}`} heading={gone} onLeave={onLeave} />;
  if (!view)
    return (
      <div className="pt-screen">
        {bar}
        <p className="pt-muted pt-center">{conn === 'reconnecting' ? t('Reconnecting…') : t('Connecting to the room…')}</p>
      </div>
    );

  const me = view.players.find((p) => p.you)!;
  const ctx: RoomContext<V, A> = { view, send, left, skew, me, byN: (n) => view.players.find((p) => p.n === n) };
  const here = view.players.filter((p) => p.online).length;
  return (
    <div className="pt-screen" ref={screen}>
      {bar}
      <RoomNotice error={error} conn={conn} />
      {back && !error && conn === 'open' && <WelcomeBack name={me.name} />}
      {note && (
        <p className="pt-muted pt-center" role="status">
          {note}
        </p>
      )}
      {view.phase === 'lobby' ? (
        <>
          <RoomListingBar listing={listing} host={view.host} players={here} min={meta.min} skew={skew} onListed={setListed} />
          <section className="pt-panel">
            <div className="pt-panel-head">
              <h2>{t('Who’s here')}</h2>
              <span className="pt-pill">{t('{n} in the room', { n: here })}</span>
            </div>
            <ul className="pt-names">
              {view.players.map((p) => (
                <li key={p.n} className={`pt-name-chip${p.online ? '' : ' is-away'}`} style={{ ['--pc' as string]: seatColor(p.n) }}>
                  <Dot p={p} size={26} />
                  <span>
                    {p.name}
                    {p.host ? ' 👑' : ''}
                    {p.you ? t(' (you)') : ''}
                  </span>
                  {view.host && !p.you && (
                    <button onClick={() => send(kick(p.n))} aria-label={t('Remove {name}', { name: p.name })}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button className="pt-btn" onClick={invite}>
              {t('📨 Invite friends · room {code}', { code })}
            </button>
            <p className="pt-muted">{t('Everyone plays on their own phone. Be together in a room, or on a call.')}</p>
          </section>
          {view.host ? (
            <section className="pt-panel">
              {settings(ctx)}
              {here < meta.min && <p className="pt-muted pt-center">{t('Waiting for {n} more to join…', { n: meta.min - here })}</p>}
            </section>
          ) : listing?.matched ? null : (
            <p className="pt-muted pt-center">{t('Waiting for the host to start…')}</p>
          )}
        </>
      ) : (
        children(ctx)
      )}
    </div>
  );
}
