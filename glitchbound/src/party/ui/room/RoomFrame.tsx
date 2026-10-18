import { useEffect, useState, type ReactNode } from 'react';
import { setGuestName, usePlayerName } from '../../../platform/playerName';
import { roomInfo, useRoom } from '../../../platform/rooms';
import { shareOrCopy } from '../../../platform/share';
import type { SeatView } from '../../rooms/seats';
import { ModeBar } from '../shared';

const COLORS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#3d7bff', '#a45cff', '#ff7eb6', '#12c6b3', '#ff8a1f', '#8ad13b', '#5b6cff', '#e64c9a', '#00a6d6'];
export const seatColor = (n: number): string => COLORS[(n - 1) % COLORS.length]!;

/** A player's round initial in their seat colour. */
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
              {p.you ? ' (you)' : ''}
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
  me: SeatView;
  byN: (n: number | null | undefined) => SeatView | undefined;
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
  children,
}: {
  code: string;
  meta: RoomGameMeta;
  onLeave: () => void;
  kick: (n: number) => A;
  progress?: (v: V) => string | undefined;
  settings: (ctx: RoomContext<V, A>) => ReactNode;
  children: (ctx: RoomContext<V, A>) => ReactNode;
}) {
  const player = usePlayerName();
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState(player.name);
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
      <div className="pt-screen">
        <ModeBar title={`${meta.title} room`} onExit={onLeave} />
        <section className="pt-panel pt-center">
          <h2>This room has closed</h2>
          <p className="pt-muted">Rooms close after three quiet hours. Open a new one and send the link.</p>
          <button className="pt-btn pt-btn-go" onClick={onLeave}>
            Back to Party Mode
          </button>
        </section>
      </div>
    );
  if (name === null)
    return (
      <div className="pt-screen">
        <ModeBar title={`${meta.title} · room ${code}`} onExit={onLeave} />
        <form
          className="pt-panel pt-imp-join"
          onSubmit={(e) => {
            e.preventDefault();
            const n = draft.trim().slice(0, 20);
            if (!n) return;
            if (!player.member) setGuestName(n);
            setName(n);
          }}
        >
          <p className="pt-imp-badge">{meta.emoji}</p>
          <h2>Join the room</h2>
          <label className="pt-label" htmlFor="pt-room-name">
            Your name (so friends know who’s who)
          </label>
          <input id="pt-room-name" className="pt-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20} autoFocus enterKeyHint="go" />
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()}>
            Join
          </button>
        </form>
      </div>
    );
  return (
    <Connected code={code} name={name} meta={meta} onLeave={onLeave} kick={kick} progress={progress} settings={settings}>
      {children}
    </Connected>
  );
}

function Connected<V extends FrameView, A>({
  code,
  name,
  meta,
  onLeave,
  kick,
  progress,
  settings,
  children,
}: {
  code: string;
  name: string;
  meta: RoomGameMeta;
  onLeave: () => void;
  kick: (n: number) => A;
  progress?: (v: V) => string | undefined;
  settings: (ctx: RoomContext<V, A>) => ReactNode;
  children: (ctx: RoomContext<V, A>) => ReactNode;
}) {
  const { view, conn, error, clearError, gone, skew, send } = useRoom<V, A>(code, name);
  const left = useLeft(view?.deadline ?? null, skew);
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(t);
  }, [error, clearError]);
  const invite = (): void => {
    void shareOrCopy({ title: `${meta.title} room`, text: `${meta.emoji} ${meta.invite} Room ${code}:`, url: `${location.origin}/r/${code}` });
  };

  const bar = <ModeBar title={`${meta.title} · ${code}`} progress={view ? progress?.(view) : undefined} onExit={onLeave} />;
  if (gone)
    return (
      <div className="pt-screen">
        {bar}
        <section className="pt-panel pt-center">
          <h2>{gone}</h2>
          <button className="pt-btn pt-btn-go" onClick={onLeave}>
            Back to Party Mode
          </button>
        </section>
      </div>
    );
  if (!view)
    return (
      <div className="pt-screen">
        {bar}
        <p className="pt-muted pt-center">{conn === 'reconnecting' ? 'Reconnecting…' : 'Connecting to the room…'}</p>
      </div>
    );

  const me = view.players.find((p) => p.you)!;
  const ctx: RoomContext<V, A> = { view, send, left, me, byN: (n) => view.players.find((p) => p.n === n) };
  const here = view.players.filter((p) => p.online).length;
  return (
    <div className="pt-screen">
      {bar}
      {conn !== 'open' && <p className="pt-warn">Reconnecting…</p>}
      {error && <p className="pt-warn">{error}</p>}
      {view.phase === 'lobby' ? (
        <>
          <section className="pt-panel">
            <div className="pt-panel-head">
              <h2>Who’s here</h2>
              <span className="pt-pill">{here} in the room</span>
            </div>
            <ul className="pt-names">
              {view.players.map((p) => (
                <li key={p.n} className={`pt-name-chip${p.online ? '' : ' is-away'}`} style={{ ['--pc' as string]: seatColor(p.n) }}>
                  <Dot p={p} size={26} />
                  <span>
                    {p.name}
                    {p.host ? ' 👑' : ''}
                  </span>
                  {view.host && !p.you && (
                    <button onClick={() => send(kick(p.n))} aria-label={`Remove ${p.name}`}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button className="pt-btn" onClick={invite}>
              📨 Invite friends · room {code}
            </button>
            <p className="pt-muted">Everyone plays on their own phone. Be together in a room, or on a call.</p>
          </section>
          {view.host ? (
            <section className="pt-panel">
              {settings(ctx)}
              {here < meta.min && <p className="pt-muted pt-center">Waiting for {meta.min - here} more to join…</p>}
            </section>
          ) : (
            <p className="pt-muted pt-center">Waiting for the host to start…</p>
          )}
        </>
      ) : (
        children(ctx)
      )}
    </div>
  );
}
