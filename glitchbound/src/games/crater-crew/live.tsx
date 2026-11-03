/**
 * Crater Crew live: the room's lobby (everyone picks a critter; the host picks the terrain, crew size
 * and turn time and can add computer crews), then the battle on every phone (the room referees, see
 * room.ts) and the results, with a rematch or a way back to the lobby.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RoomListingBar } from '../../components/OnlinePlay';
import { useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { Battle } from './Battle';
import { CHAR_IDS, CHARS, type CharId } from './characters';
import { Portrait, TerrainThumb } from './icons';
import { CREW_SIZES, LEVELS, MAX_CREWS, TURN_TIMES, crewScore, type Level, type Match } from './match';
import { botName, type Action, type RoomView } from './room';
import type { PosMsg, Scene } from './scene';
import type { Sfx } from './sound';
import { TERRAIN_IDS, TERRAINS } from './terrains';

export const inviteLink = (code: string): string => `${location.origin}/r/${code}`;

const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function LiveRoom({ code, name, sfx, muted, onMute, onLeave, tools }: { code: string; name: string; sfx: () => Sfx; muted: boolean; onMute: () => void; onLeave: () => void; tools: ReactNode }) {
  const scene = useRef<Scene | null>(null);
  const { view, conn, error, clearError, gone, send, skew, listing, setListed } = useRoom<RoomView, Action>(code, name || 'Player', (data) => {
    const d = data as (PosMsg & { t?: string; turn: number; unit: number }) | null;
    if (d?.t === 'pos') scene.current?.onRemote(d);
  });
  const [paused, setPaused] = useState(false);
  const [shownOver, setShownOver] = useState<number | null>(null);
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  if (gone || conn === 'gone')
    return (
      <div className="cc-scroll">
        <div className="cc-panel">
          <h2 className="cc-h">This room has closed</h2>
          <p className="cc-sub">{gone}</p>
          <button className="cc-cta" onClick={onLeave}>
            Back to the menu
          </button>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="cc-scroll">
        <div className="cc-panel">
          <p className="cc-sub">Connecting to room {code}…</p>
          <button className="cc-ghost" onClick={onLeave}>
            Back
          </button>
        </div>
      </div>
    );

  const notice = error || (conn !== 'open' ? 'Reconnecting…' : '');
  if (view.phase === 'lobby' || !view.match)
    return <Lobby view={view} code={code} send={send} tools={tools} onLeave={onLeave} notice={notice} bar={<RoomListingBar listing={listing} host={view.host} players={view.players.filter((p) => p.online).length} min={2} skew={skew} onListed={setListed} />} />;

  const m = view.match;
  const over = view.phase === 'over' && shownOver === m.seed;
  const playing = m.crews.some((c) => c.seat === view.me);
  return (
    <Battle
      match={m}
      mine={(c) => view.match?.crews[c]?.seat === view.me}
      onTurn={(turn, input) => send({ t: 'turn', turn, walk: input.walk, fire: input.fire, run: input.run })}
      onPos={(p) => send({ t: 'pos', ...p })}
      onShown={(s) => {
        if (s.over) {
          setShownOver(s.seed);
          const mine = s.crews.findIndex((c) => c.seat === view.me);
          if (mine >= 0) {
            if (s.winner === mine) sfx().win();
            else sfx().lose();
          }
        }
      }}
      clock={{ turn: m.turn, at: view.turnAt - skew }}
      botDelay={150}
      sfx={sfx}
      paused={paused}
      onPause={() => setPaused((p) => !p)}
      muted={muted}
      onMute={onMute}
      sceneRef={scene}
      tools={<span className="cc-code">{code}</span>}
    >
      {notice && <p className="cc-notice">{notice}</p>}
      {!playing && !over && <p className="cc-notice is-soft">{view.watching ? 'You’re watching.' : 'You’re watching. You’ll join the next battle.'}</p>}
      {paused && !over && (
        <div className="cc-sheet-wrap" role="dialog" aria-label="Menu">
          <div className="cc-sheet">
            <h2>Room {code}</h2>
            <p className="cc-sub">The battle keeps going while this is open.</p>
            <button className="cc-cta" onClick={() => setPaused(false)} autoFocus>
              Back to the battle
            </button>
            <button className="cc-ghost" onClick={onLeave}>
              Leave the room
            </button>
          </div>
        </div>
      )}
      {over && <Results m={m} me={view.me} host={view.host} watching={!!view.watching} onSeat={(play) => send({ t: play ? 'play' : 'watch' })} onAgain={() => send({ t: 'again' })} onLobby={() => send({ t: 'lobby' })} onLeave={onLeave} />}
    </Battle>
  );
}

function Results({ m, me, host, watching, onSeat, onAgain, onLobby, onLeave }: { m: Match; me: number; host: boolean; watching: boolean; onSeat: (play: boolean) => void; onAgain: () => void; onLobby: () => void; onLeave: () => void }) {
  const mine = m.crews.findIndex((c) => c.seat === me);
  const order = m.crews.map((_, i) => i).sort((a, b) => Number(b === m.winner) - Number(a === m.winner) || crewScore(m, b) - crewScore(m, a));
  const w = m.winner !== null && m.winner >= 0 ? m.crews[m.winner] : null;
  return (
    <div className="cc-sheet-wrap" role="dialog" aria-label="Results">
      <div className={`cc-sheet${mine >= 0 && m.winner === mine ? ' is-win' : ''}`}>
        <h2>{w ? (m.winner === mine ? 'Victory!' : `${w.name} wins!`) : 'A draw!'}</h2>
        <ol className="cc-results">
          {order.map((i) => {
            const c = m.crews[i]!;
            return (
              <li key={i} className={i === mine ? 'is-me' : ''} style={{ ['--c' as string]: CHARS[c.char].color }}>
                <Portrait char={c.char} size={36} />
                <b>{c.name}</b>
                <span>{c.dmg} dmg</span>
                <span>{c.kills} KO</span>
                <em>{i === m.winner ? '🏆' : ''}</em>
              </li>
            );
          })}
        </ol>
        {host ? (
          <div className="cc-actions">
            <button className="cc-cta" onClick={onAgain} autoFocus>
              Rematch
            </button>
            <button className="cc-ghost" onClick={onLobby}>
              Change settings
            </button>
          </div>
        ) : (
          <p className="cc-sub">Waiting for the host to start the next battle…</p>
        )}
        <p className="cc-sub cc-next">
          {watching ? 'You’ll watch the next battle.' : 'You’re in the next battle.'}{' '}
          <button className="cc-link" onClick={() => onSeat(watching)}>
            {watching ? 'Join it' : 'Just watch'}
          </button>
        </p>
        <button className="cc-link" onClick={onLeave}>
          Leave the room
        </button>
      </div>
    </div>
  );
}

function Lobby({ view, code, send, tools, onLeave, notice, bar }: { view: RoomView; code: string; send: (a: Action) => void; tools: ReactNode; onLeave: () => void; notice: string; bar: ReactNode }) {
  const [copied, setCopied] = useState('');
  const link = inviteLink(code);
  const myPick = view.picks.find((p) => p.n === view.me);
  const taken = new Set<CharId>([...view.picks.map((p) => p.char), ...view.bots.map((b) => b.char)]);
  const crews = view.picks.length + view.bots.length;
  const watchers = view.players.filter((p) => p.online && !view.picks.some((x) => x.n === p.n));
  return (
    <div className="cc-scroll">
      <div className="cc-panel is-wide">
        <div className="cc-toprow">
          <button className="cc-ghost is-small" onClick={onLeave}>
            ← Leave
          </button>
          <div className="cc-tools">{tools}</div>
        </div>
        <h2 className="cc-h">Room {code}</h2>
        {bar}
        {notice && <p className="cc-err">{notice}</p>}
        <section className="cc-card">
          <h3>Crews ({crews}/{MAX_CREWS})</h3>
          <ul className="cc-crewlist">
            {view.picks.map((p) => {
              const pl = view.players.find((x) => x.n === p.n);
              return (
                <li key={p.n} className={p.n === view.me ? 'is-me' : ''} style={{ ['--c' as string]: CHARS[p.char].color }}>
                  <Portrait char={p.char} size={40} />
                  <b>{pl?.name ?? 'Player'}</b>
                  <small>
                    {CHARS[p.char].name}
                    {pl?.host ? ' · host' : ''}
                    {p.n === view.me ? ' · you' : ''}
                    {pl && !pl.online ? ' · away' : ''}
                  </small>
                  {view.host && p.n !== view.me && (
                    <button className="cc-link" onClick={() => send({ t: 'kick', seat: p.n })} aria-label={`Remove ${pl?.name ?? 'player'}`}>
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
            {view.bots.map((b, i) => (
              <li key={`bot${i}`} style={{ ['--c' as string]: CHARS[b.char].color }}>
                <Portrait char={b.char} size={40} />
                <b>{botName(b.char)}</b>
                {view.host ? (
                  <select className="cc-select" value={b.level} onChange={(e) => send({ t: 'bot', op: 'level', i, level: e.target.value as Level })} aria-label="Computer level">
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_NAME[l]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <small>Computer · {LEVEL_NAME[b.level]}</small>
                )}
                {view.host && (
                  <button className="cc-link" onClick={() => send({ t: 'bot', op: 'remove', i })} aria-label="Remove computer crew">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="cc-actions">
            {view.host && crews < MAX_CREWS && (
              <button className="cc-ghost" onClick={() => send({ t: 'bot', op: 'add' })}>
                + Computer crew
              </button>
            )}
            {myPick ? (
              view.picks.length > 1 || view.bots.length > 0 ? (
                <button className="cc-link" onClick={() => send({ t: 'watch' })}>
                  Just watch
                </button>
              ) : null
            ) : (
              <button className="cc-ghost" onClick={() => send({ t: 'play' })} disabled={crews >= MAX_CREWS}>
                Join the battle
              </button>
            )}
          </div>
          {watchers.length > 0 && <p className="cc-sub">Watching: {watchers.map((w) => w.name).join(', ')}</p>}
        </section>
        {myPick && (
          <section className="cc-card">
            <h3>Your critter</h3>
            <div className="cc-chars" role="radiogroup" aria-label="Your critter">
              {CHAR_IDS.map((c) => (
                <button key={c} role="radio" aria-checked={myPick.char === c} className={`cc-char${myPick.char === c ? ' is-on' : ''}`} disabled={taken.has(c) && myPick.char !== c} onClick={() => send({ t: 'char', char: c })} style={{ ['--c' as string]: CHARS[c].color }}>
                  <Portrait char={c} size={44} />
                  <small>{CHARS[c].name}</small>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="cc-card">
          <h3>Terrain {view.host ? '' : <small>(the host picks)</small>}</h3>
          <div className="cc-terrains" role="radiogroup" aria-label="Terrain">
            <button role="radio" aria-checked={view.terrain === 'random'} className={`cc-terrain${view.terrain === 'random' ? ' is-on' : ''}`} disabled={!view.host} onClick={() => send({ t: 'terrain', id: 'random' })}>
              <span className="cc-random" aria-hidden="true">
                🎲
              </span>
              <b>Random</b>
            </button>
            {TERRAIN_IDS.map((id, i) => (
              <button key={id} role="radio" aria-checked={view.terrain === id} className={`cc-terrain${view.terrain === id ? ' is-on' : ''}`} disabled={!view.host} onClick={() => send({ t: 'terrain', id })}>
                <TerrainThumb id={id} delay={i * 40} />
                <b>{TERRAINS[id].name}</b>
              </button>
            ))}
          </div>
          <div className="cc-opts">
            <Seg label="Crew size" values={CREW_SIZES} value={view.crewSize} disabled={!view.host} fmt={(n) => `${n}`} onPick={(n) => send({ t: 'size', n })} />
            <Seg label="Turn time" values={TURN_TIMES} value={view.turnSecs} disabled={!view.host} fmt={(n) => `${n}s`} onPick={(n) => send({ t: 'time', n })} />
          </div>
        </section>
        <section className="cc-card cc-invite">
          <h3>Invite friends</h3>
          <p>
            Room code <b className="cc-mono">{code}</b> · <span className="cc-mono">{link.replace(/^https?:\/\//, '')}</span>
          </p>
          <button className="cc-ghost" onClick={() => void shareOrCopy({ title: 'Crater Crew', text: `Join my Crater Crew battle! Room ${code}`, url: link }).then((o) => setCopied(o === 'copied' ? 'Link copied!' : ''))}>
            {copied || 'Share the invite link'}
          </button>
        </section>
        {view.host ? (
          <>
            <button className="cc-cta is-big" onClick={() => send({ t: 'start' })} disabled={crews < 2}>
              Start the battle
            </button>
            {crews < 2 && <p className="cc-sub">Two crews are needed: invite a friend or add a computer crew.</p>}
          </>
        ) : (
          <p className="cc-sub">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

export function Seg<T extends number | string>({ label, values, value, disabled, fmt, onPick }: { label: string; values: readonly T[]; value: T; disabled?: boolean; fmt: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className="cc-seg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {values.map((v) => (
        <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''} disabled={disabled} onClick={() => onPick(v)}>
          {fmt(v)}
        </button>
      ))}
    </div>
  );
}
