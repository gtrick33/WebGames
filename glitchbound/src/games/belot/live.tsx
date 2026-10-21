/**
 * Belot live: the table on everyone's own phone. The lobby seats four (partners opposite), the host
 * fills empty places with computer players and starts; then the shared Table runs on the room's
 * view (room.ts on the rooms worker), with the room's score sheet between deals and a rematch at the end.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { LEVELS, type Level } from './ai';
import { teamOf, type Seat } from './logic';
import type { Action, RoomView } from './room';
import type { Sfx } from './sound';
import { DealSheet, Table } from './Table';
import type { Words } from './text';

export const inviteLink = (code: string): string => `${location.origin}/r/${code}`;
/** Computer players' names by table place (their level shows under the name). */
const BOT_NAMES = ['Ivo', 'Niko', 'Mila', 'Tom'];

export function LiveTable({ w, code, name, sfx, tools, onLeave }: { w: Words; code: string; name: string; sfx: () => Sfx; tools: ReactNode; onLeave: () => void }) {
  const { view, conn, error, clearError, gone, send } = useRoom<RoomView, Action>(code, name || w.you);
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 3000);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  // the end of a deal and of the match get their sounds here (the table does the rest)
  const phase = view?.phase;
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (!view || lastPhase.current === phase) return;
    lastPhase.current = phase;
    const s = sfx();
    if (phase === 'dealEnd' && view.last) {
      if (view.last.score.valat !== null) s.valat();
      else s.tally(Math.max(...view.last.score.game));
    }
    if (phase === 'over' && view.match?.winner !== null && view.match) {
      if (view.you >= 0 && view.match.winner === teamOf(view.you as Seat)) s.win();
      else s.lose();
    }
  }, [phase, view, sfx]);

  if (gone || conn === 'gone')
    return (
      <div className="bl-scroll">
        <div className="bl-menu">
          <h2 className="bl-h">{w.roomClosed}</h2>
          <p className="bl-tagline">{gone}</p>
          <button className="bl-btn is-go" onClick={onLeave}>
            {w.back}
          </button>
        </div>
      </div>
    );

  if (!view)
    return (
      <div className="bl-scroll">
        <div className="bl-menu">
          <p className="bl-tagline">{w.connecting}</p>
          <button className="bl-btn" onClick={onLeave}>
            {w.back}
          </button>
        </div>
      </div>
    );

  const names = view.places.map((p, i) => p.player?.name ?? (p.bot ? BOT_NAMES[i]! : w.empty));
  const bots = view.places.map((p) => p.bot);
  const away = view.places.map((p) => !!p.player && !p.player.online);
  const notice = error || (conn !== 'open' ? w.connecting : '');

  if (view.phase === 'lobby' || !view.match) return <Lobby w={w} view={view} code={code} send={send} tools={tools} onLeave={onLeave} notice={notice} />;

  const humans = view.places.filter((p) => p.player?.online).length;
  return (
    <Table
      w={w}
      match={view.match}
      me={view.you}
      names={names}
      bots={bots}
      away={away}
      onCall={(call) => send({ t: 'call', call })}
      onPlay={(card, declare) => send({ t: 'play', card, declare })}
      sfx={sfx}
      locked={view.phase !== 'deal'}
      tools={
        <>
          <span className="bl-roomcode mono">{w.room(code)}</span>
          {tools}
        </>
      }
      overlay={
        <>
          {notice && <p className="bl-toast">{notice}</p>}
          {view.you < 0 && <p className="bl-toast is-soft">{w.watching}</p>}
          {view.phase === 'dealEnd' && view.last && (
            <DealSheet w={w} score={view.last.score} taken={view.last.taken} scores={view.match.scores} me={view.you} names={names}>
              {view.you >= 0 && (
                <button className="bl-btn is-go" onClick={() => send({ t: 'next' })} disabled={view.players.find((p) => p.you)?.done} autoFocus>
                  {w.next}
                </button>
              )}
              <span className="bl-ready mono">{w.readyFor(view.ready.length, humans)}</span>
            </DealSheet>
          )}
          {view.phase === 'over' && (
            <div className="bl-sheet-wrap" role="dialog">
              <div className={`bl-sheet bl-result${view.you >= 0 && view.match.winner === teamOf(view.you as Seat) ? ' is-win' : ''}`}>
                <h2 className="bl-result-title">{view.you >= 0 && view.match.winner === teamOf(view.you as Seat) ? w.matchWon : w.matchLost}</h2>
                <p className="bl-result-score mono">
                  <b>{view.match.scores[view.you >= 0 ? teamOf(view.you as Seat) : 0]}</b> – {view.match.scores[view.you >= 0 ? 1 - teamOf(view.you as Seat) : 1]}
                </p>
                <div className="bl-sheet-actions">
                  {view.host ? (
                    <button className="bl-btn is-go" onClick={() => send({ t: 'again' })} autoFocus>
                      {w.rematch}
                    </button>
                  ) : (
                    <span className="bl-ready mono">{w.waitingHost}</span>
                  )}
                  <button className="bl-btn is-ghost" onClick={onLeave}>
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

function Lobby({ w, view, code, send, tools, onLeave, notice }: { w: Words; view: RoomView; code: string; send: (a: Action) => void; tools: ReactNode; onLeave: () => void; notice: string }) {
  const [copied, setCopied] = useState('');
  const link = inviteLink(code);
  const filled = view.places.filter((p) => p.player || p.bot).length;
  // places on screen: you (or place 0) at the bottom, counter-clockwise
  const base = view.you >= 0 ? view.you : 0;
  const order = [2, 3, 1, 0].map((sp) => (base + sp) % 4);
  const spotClass = ['is-top', 'is-left', 'is-right', 'is-bottom'];
  return (
    <div className="bl-scroll">
      <div className="bl-menu bl-lobby">
        <div className="bl-top-row">
          <button className="bl-btn is-small" onClick={onLeave}>
            ← {w.back}
          </button>
          <div className="bl-tools">{tools}</div>
        </div>
        <h2 className="bl-h">{w.room(code)}</h2>
        {notice && <p className="bl-err">{notice}</p>}
        <div className="bl-lobby-table">
          <div className="bl-lobby-felt" aria-hidden="true" />
          {order.map((place, i) => {
            const p = view.places[place]!;
            const mine = place === view.you;
            const team = teamOf(place as Seat) === teamOf(base as Seat) ? 'us' : 'them';
            return (
              <div key={place} className={`bl-place ${spotClass[i]} team-${team}${mine ? ' is-mine' : ''}`}>
                {p.player ? (
                  <>
                    <span className={`bl-avatar team-${team}`}>{p.player.name.slice(0, 1).toUpperCase()}</span>
                    <b>{p.player.name}</b>
                    <small className="mono">{mine ? w.you : !p.player.online ? w.away : p.player.host ? 'host' : ''}</small>
                    {mine && (
                      <button className="bl-link" onClick={() => send({ t: 'stand' })}>
                        ✕
                      </button>
                    )}
                  </>
                ) : p.bot ? (
                  <>
                    <span className={`bl-avatar team-${team}`}>🤖</span>
                    {view.host ? (
                      <select className="bl-select" value={p.bot} onChange={(e) => send({ t: 'bot', place, level: e.target.value as Level })} aria-label={w.addBot}>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {w.level[l]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <b>{w.bot(w.level[p.bot])}</b>
                    )}
                    {view.host && (
                      <button className="bl-link" onClick={() => send({ t: 'bot', place, level: null })}>
                        {w.removeBot}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="bl-avatar is-empty">?</span>
                    <small>{w.empty}</small>
                    <button className="bl-btn is-small" onClick={() => send({ t: 'sit', place })}>
                      {w.sitHere}
                    </button>
                    {view.host && (
                      <button className="bl-link" onClick={() => send({ t: 'bot', place, level: 'hard' })}>
                        + {w.addBot}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="bl-invite">
          <small>{w.invite}</small>
          <b className="mono">{code}</b>
          <span className="mono bl-link-text">{link.replace(/^https?:\/\//, '')}</span>
          <button className="bl-btn" onClick={() => void shareOrCopy({ title: 'Belot', text: w.inviteText(code), url: link }).then((o) => setCopied(o === 'copied' ? w.copied : ''))}>
            {copied || w.shareLink}
          </button>
        </div>
        {view.host ? (
          <>
            <button className="bl-btn is-go is-big" onClick={() => send({ t: 'start' })}>
              {w.startMatch}
            </button>
            {filled < 4 && <p className="bl-hint">{w.needFour}</p>}
          </>
        ) : (
          <p className="bl-hint">{w.waitingHost}</p>
        )}
      </div>
    </div>
  );
}
