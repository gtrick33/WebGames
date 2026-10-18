import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Scores } from '../engine';
import type { Player } from '../types';

export const byId = (players: readonly Player[], id: string | null | undefined): Player | undefined => players.find((p) => p.id === id);

export function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  return (
    <span className="pt-avatar" style={{ background: player.color, width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">
      {player.emoji}
    </span>
  );
}

export function Name({ player }: { player: Player | undefined }) {
  if (!player) return null;
  return (
    <span className="pt-name" style={{ ['--pc' as string]: player.color }}>
      {player.name}
    </span>
  );
}

/** "Pass the phone to X": blocks the screen until that player taps, so the next prompt stays private. */
export function PassPhone({ player, note, onReady }: { player: Player; note?: string; onReady: () => void }) {
  return (
    <div className="pt-pass" role="dialog" aria-label={`Pass the phone to ${player.name}`}>
      <Avatar player={player} size={96} />
      <p className="pt-kicker">Pass the phone to</p>
      <h2 className="pt-pass-name" style={{ color: player.color }}>
        {player.name}
      </h2>
      {note && <p className="pt-muted">{note}</p>}
      <button className="pt-btn pt-btn-go pt-btn-big" onClick={onReady} autoFocus>
        I’m {player.name}: show me
      </button>
    </div>
  );
}

/** Seconds countdown with a draining bar. Calls onEnd once. Pauses while hidden. */
export function Timer({ seconds, running = true, onEnd, onTick }: { seconds: number; running?: boolean; onEnd: () => void; onTick?: (left: number) => void }) {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  const endRef = useRef(onEnd);
  const tickRef = useRef(onTick);
  useEffect(() => {
    endRef.current = onEnd;
    tickRef.current = onTick;
  });
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setLeft((l) => {
        const n = Math.max(0, l - 0.1);
        if (n <= 0 && !ended.current) {
          ended.current = true;
          window.setTimeout(() => endRef.current(), 0);
        }
        if (Math.ceil(n) !== Math.ceil(l)) tickRef.current?.(Math.ceil(n));
        return n;
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [running]);
  return (
    <div className={`pt-timer${left <= 5 ? ' is-low' : ''}`} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <span className="pt-timer-bar" style={{ width: `${(left / seconds) * 100}%` }} />
      <b>{Math.ceil(left)}s</b>
    </div>
  );
}

/** Tappable player chips (single or multi select). */
export function PlayerPicker({ players, selected, onToggle, label }: { players: readonly Player[]; selected: string[]; onToggle: (id: string) => void; label: string }) {
  return (
    <div className="pt-picker" role="group" aria-label={label}>
      {players.map((p) => (
        <button key={p.id} className={`pt-chip${selected.includes(p.id) ? ' is-on' : ''}`} style={{ ['--pc' as string]: p.color }} aria-pressed={selected.includes(p.id)} onClick={() => onToggle(p.id)}>
          <span aria-hidden="true">{p.emoji}</span> {p.name}
        </button>
      ))}
    </div>
  );
}

/** Scoreboard + awards + actions, shared by every mode. */
export function Results({ title, players, scores, awards, children, onAgain, onMenu }: { title: string; players: readonly Player[]; scores: Scores; awards?: { title: string; playerId: string; why: string }[]; children?: ReactNode; onAgain: () => void; onMenu: () => void }) {
  const ranked = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  return (
    <div className="pt-results">
      <p className="pt-kicker">Game over</p>
      <h2 className="pt-h2">{title}</h2>
      <ol className="pt-podium">
        {ranked.map((p, i) => (
          <li key={p.id} className={i === 0 ? 'is-first' : ''}>
            <span className="pt-rank">{i === 0 ? '👑' : i + 1}</span>
            <Avatar player={p} size={36} />
            <b>{p.name}</b>
            <span className="pt-score">{scores[p.id] ?? 0}</span>
          </li>
        ))}
      </ol>
      {children}
      {awards && awards.length > 0 && (
        <ul className="pt-awards">
          {awards.map((a) => {
            const p = byId(players, a.playerId);
            return (
              <li key={a.title}>
                <span className="pt-award-title">🏅 {a.title}</span>
                <span>
                  <Name player={p} /> · {a.why}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pt-row">
        <button className="pt-btn pt-btn-go" onClick={onAgain}>
          Play again
        </button>
        <button className="pt-btn" onClick={onMenu}>
          Other games
        </button>
      </div>
    </div>
  );
}

/** Top bar of a running mode. */
export function ModeBar({ title, progress, onExit }: { title: string; progress?: string; onExit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="pt-modebar">
      {confirm ? (
        <>
          <span className="pt-muted">Leave this game?</span>
          <button className="pt-btn pt-btn-sm" onClick={onExit}>
            Leave
          </button>
          <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => setConfirm(false)}>
            Stay
          </button>
        </>
      ) : (
        <>
          <button className="pt-icon" onClick={() => setConfirm(true)} aria-label="Back to the party menu">
            ←
          </button>
          <span className="pt-modebar-title">{title}</span>
          {progress && <span className="pt-pill">{progress}</span>}
        </>
      )}
    </div>
  );
}
