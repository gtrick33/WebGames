/**
 * Backgammon live: a match between two phones (or a phone and the computer). The lobby seats two,
 * the host picks the length and can seat the computer; then the shared Board runs on the room's view
 * (room.ts on the rooms worker), with each game's result and a rematch at the end.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { LEVELS, type Level } from './ai';
import { Board } from './Board';
import { TARGETS, type Side } from './logic';
import type { Action, RoomView } from './room';
import type { Sfx } from './sound';
import type { Words } from './text';

export const inviteLink = (code: string): string => `${location.origin}/r/${code}`;

export function LiveBoard({ w, code, name, sfx, tools, onLeave }: { w: Words; code: string; name: string; sfx: () => Sfx; tools: ReactNode; onLeave: () => void }) {
  const { view, conn, error, clearError, gone, send } = useRoom<RoomView, Action>(code, name || w.you);
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 3000);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  if (gone || conn === 'gone')
    return (
      <div className="tb-scroll">
        <div className="tb-menu">
          <h2 className="tb-h">{w.roomClosed}</h2>
          <p className="tb-tagline">{gone}</p>
          <button className="tb-btn is-go" onClick={onLeave}>
            {w.back}
          </button>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="tb-scroll">
        <div className="tb-menu">
          <p className="tb-tagline">{w.connecting}</p>
          <button className="tb-btn" onClick={onLeave}>
            {w.back}
          </button>
        </div>
      </div>
    );

  const names = view.places.map((p) => p.player?.name ?? (p.bot ? `${w.computer} · ${w.level[p.bot]}` : w.empty)) as [string, string];
  const notice = error || (conn !== 'open' ? w.connecting : '');
  if (view.phase === 'lobby' || !view.match) return <Lobby w={w} view={view} code={code} send={send} tools={tools} onLeave={onLeave} notice={notice} names={names} />;

  const me = (view.you >= 0 ? view.you : 0) as Side;
  const g = view.match.game;
  const canAct = view.phase === 'play' && view.you >= 0 && g.phase !== 'over' && (g.phase === 'opening' || g.turn === view.you);
  const humans = view.places.filter((p) => p.player?.online).length;
  const last = view.match.results[view.match.results.length - 1];
  return (
    <Board
      w={w}
      game={g}
      me={me}
      names={names}
      bots={[null, view.places[1]?.bot ?? null]}
      canAct={canAct}
      onRoll={() => send({ t: 'roll' })}
      onStep={(st) => send({ t: 'step', from: st.from, to: st.to, die: st.die })}
      onUndo={() => send({ t: 'undo' })}
      onDone={() => send({ t: 'done' })}
      sfx={sfx}
      score={view.match.score}
      target={view.match.target}
      tools={
        <>
          <span className="tb-roomcode mono">{w.room(code)}</span>
          {tools}
        </>
      }
      overlay={
        <>
          {notice && <p className="tb-toast">{notice}</p>}
          {view.you < 0 && <p className="tb-toast is-soft">{w.watching}</p>}
          {g.phase === 'opening' && canAct && <p className="tb-toast">{w.rollFirst}</p>}
          {view.phase === 'gameEnd' && last && (
            <div className="tb-sheet-wrap" role="dialog">
              <div className={`tb-sheet${last.winner === me ? ' is-win' : ''}`}>
                <h2>{last.winner === me ? w.youWonGame(w.win[last.points as 1 | 2 | 3], last.points) : w.theyWonGame(names[last.winner], w.win[last.points as 1 | 2 | 3], last.points)}</h2>
                <p className="tb-sheet-score mono">
                  <b>{view.match.score[me]}</b> – <b>{view.match.score[(1 - me) as Side]}</b> · {w.to(view.match.target)}
                </p>
                {view.you >= 0 && (
                  <button className="tb-btn is-go" onClick={() => send({ t: 'next' })} disabled={view.players.find((p) => p.you)?.done} autoFocus>
                    {w.nextGame}
                  </button>
                )}
                <span className="tb-ready mono">{w.readyFor(view.ready.length, humans)}</span>
              </div>
            </div>
          )}
          {view.phase === 'over' && view.match.winner !== null && (
            <div className="tb-sheet-wrap" role="dialog">
              <div className={`tb-sheet${view.match.winner === me ? ' is-win' : ''}`}>
                <h2>{view.match.winner === me && view.you >= 0 ? w.matchWon : w.matchLost}</h2>
                <p className="tb-sheet-score mono">
                  <b>{view.match.score[me]}</b> – {view.match.score[(1 - me) as Side]}
                </p>
                <div className="tb-sheet-actions">
                  {view.host ? (
                    <button className="tb-btn is-go" onClick={() => send({ t: 'again' })} autoFocus>
                      {w.rematch}
                    </button>
                  ) : (
                    <span className="tb-ready mono">{w.waitingHost}</span>
                  )}
                  <button className="tb-btn is-ghost" onClick={onLeave}>
                    {w.menu}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}

function Lobby({ w, view, code, send, tools, onLeave, notice, names }: { w: Words; view: RoomView; code: string; send: (a: Action) => void; tools: ReactNode; onLeave: () => void; notice: string; names: [string, string] }) {
  const [copied, setCopied] = useState('');
  const link = inviteLink(code);
  const ready = view.places[0]?.player && (view.places[1]?.player || view.places[1]?.bot);
  return (
    <div className="tb-scroll">
      <div className="tb-menu">
        <div className="tb-top-row">
          <button className="tb-btn is-small" onClick={onLeave}>
            ← {w.back}
          </button>
          <div className="tb-tools">{tools}</div>
        </div>
        <h2 className="tb-h">{w.room(code)}</h2>
        {notice && <p className="tb-err">{notice}</p>}
        <div className="tb-lobby">
          {[0, 1].map((place) => {
            const p = view.places[place]!;
            const mine = place === view.you;
            return (
              <div key={place} className={`tb-place${mine ? ' is-mine' : ''}`}>
                <i className={`tb-chip big side-${place === 0 ? 'me' : 'them'}`} aria-hidden="true" />
                {p.player ? (
                  <>
                    <b>{p.player.name}</b>
                    <small className="mono">{mine ? w.you : !p.player.online ? w.away : p.player.host ? w.host : ''}</small>
                    {mine && (
                      <button className="tb-link" onClick={() => send({ t: 'stand' })}>
                        ✕
                      </button>
                    )}
                  </>
                ) : p.bot ? (
                  <>
                    {view.host ? (
                      <select className="tb-select" value={p.bot} onChange={(e) => send({ t: 'bot', level: e.target.value as Level })} aria-label={w.addBot}>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {w.computer} · {w.level[l]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <b>{names[1]}</b>
                    )}
                    {view.host && (
                      <button className="tb-link" onClick={() => send({ t: 'bot', level: null })}>
                        {w.removeBot}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <small>{w.empty}</small>
                    <button className="tb-btn is-small" onClick={() => send({ t: 'sit', place })}>
                      {w.sitHere}
                    </button>
                    {view.host && place === 1 && (
                      <button className="tb-link" onClick={() => send({ t: 'bot', level: 'hard' })}>
                        + {w.addBot}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="tb-lengths" role="radiogroup" aria-label={w.length}>
          <span className="tb-label">{w.length}</span>
          {TARGETS.map((n) => (
            <button key={n} role="radio" aria-checked={view.target === n} className={`tb-chip-btn${view.target === n ? ' is-on' : ''}`} disabled={!view.host} onClick={() => send({ t: 'target', n })}>
              {n}
            </button>
          ))}
        </div>
        <div className="tb-invite">
          <small>{w.invite}</small>
          <b className="mono">{code}</b>
          <span className="mono tb-link-text">{link.replace(/^https?:\/\//, '')}</span>
          <button className="tb-btn" onClick={() => void shareOrCopy({ title: 'Backgammon', text: w.inviteText(code), url: link }).then((o) => setCopied(o === 'copied' ? w.copied : ''))}>
            {copied || w.shareLink}
          </button>
        </div>
        {view.host ? (
          <>
            <button className="tb-btn is-go is-big" onClick={() => send({ t: 'start' })} disabled={!ready}>
              {w.startMatch}
            </button>
            {!ready && <p className="tb-hint">{w.needTwo}</p>}
          </>
        ) : (
          <p className="tb-hint">{w.waitingHost}</p>
        )}
      </div>
    </div>
  );
}
