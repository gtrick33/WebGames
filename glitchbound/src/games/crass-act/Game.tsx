import { useEffect, useRef, useState } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { embedHost } from '../../platform/embed';
import { shareOrCopy } from '../../platform/share';
import { fill, MAX_PLAYERS, MIN_PLAYERS, TARGETS, TIMERS, type RoomView } from './engine';
import { createRoom, roomInfo, useRoom } from './net';
import './Game.css';

const ADULT = 'glitchbound.crass-act.adult';
const NAME = 'glitchbound.crass-act.name';

const read = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const write = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
};

/** The room code from an invite link (?room=ABCDE). */
const linkedRoom = (): string => {
  const c = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-HJKMNP-Z]{5}$/.test(c) ? c : '';
};

function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
}

export default function Game({ host, restartKey, playerName }: GameModuleProps) {
  return <CrassAct key={restartKey} host={host} playerName={playerName} />;
}

function CrassAct({ host, playerName }: { host: GameHost; playerName?: string }) {
  const [adult, setAdult] = useState(() => read(ADULT) === '1');
  // Inside the Discord Activity: the player's Discord name, and straight into the call's room.
  const [name, setName] = useState(() => (embedHost() && playerName) || read(NAME) || playerName || '');
  const [code, setCode] = useState<string | null>(() => (embedHost() && linkedRoom()) || null);
  const [invite] = useState(linkedRoom);

  if (!adult)
    return (
      <div className="uh uh-center">
        <Logo />
        <div className="uh-panel uh-gate">
          <p className="uh-big">This one is for adults.</p>
          <p>Crass Act is a card game full of crude, dark and offensive jokes. Play it with friends who won’t report you to HR.</p>
          <div className="uh-row">
            <button
              className="uh-btn uh-btn-go"
              onClick={() => {
                write(ADULT, '1');
                setAdult(true);
              }}
            >
              I’m 18 or older
            </button>
            <a className="uh-btn" href="/">
              Take me back
            </a>
          </div>
        </div>
      </div>
    );

  if (code)
    return (
      <Room
        code={code}
        name={name}
        host={host}
        onLeave={() => {
          setRoomInUrl(null);
          setCode(null);
        }}
      />
    );

  return (
    <Home
      name={name}
      invite={invite}
      onName={(n) => {
        setName(n);
        write(NAME, n);
      }}
      onEnter={(c) => {
        setRoomInUrl(c);
        setCode(c);
      }}
    />
  );
}

function Logo() {
  return (
    <h1 className="uh-logo" aria-label="Crass Act">
      {['CRASS', 'ACT'].map((word, w) => (
        <span key={word} className="uh-word">
          {word.split('').map((c, i) => (
            <span key={i} style={{ ['--i' as string]: i + w * 2 }}>
              {c}
            </span>
          ))}
        </span>
      ))}
      <b className="uh-18">18+</b>
    </h1>
  );
}

function Home({ name, invite, onName, onEnter }: { name: string; invite: string; onName: (n: string) => void; onEnter: (code: string) => void }) {
  const [code, setCode] = useState(invite);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ready = name.trim().length > 0;

  const join = async (c: string): Promise<void> => {
    setBusy(true);
    setMsg('');
    const info = await roomInfo(c);
    setBusy(false);
    if (!info) return setMsg(`There is no room ${c}. Check the code, or open a new room.`);
    // A Party Mode room (Impostor, Never Have I Ever…): it opens on the party page.
    if (info.game && info.game !== 'crass-act') return location.assign(`/party?room=${c}`);
    if (info.full) return setMsg(`Room ${c} is full (${MAX_PLAYERS} players).`);
    onEnter(c);
  };

  return (
    <div className="uh uh-center">
      <Logo />
      <p className="uh-tag">Bad taste, played well.</p>
      <div className="uh-panel">
        <label className="uh-field">
          <span>Your name</span>
          <input value={name} maxLength={20} placeholder="Something your mum wouldn’t call you" onChange={(e) => onName(e.target.value)} />
        </label>
        {invite && <p className="uh-invite">You’re invited to room <b>{invite}</b>.</p>}
        <div className="uh-join">
          <input
            className="uh-code"
            value={code}
            maxLength={5}
            placeholder="CODE"
            aria-label="Room code"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button className="uh-btn uh-btn-go" disabled={!ready || code.length !== 5 || busy} onClick={() => void join(code)}>
            Join room
          </button>
        </div>
        <div className="uh-or">or</div>
        <button
          className="uh-btn uh-btn-wide"
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true);
            setMsg('');
            createRoom().then(
              (c) => onEnter(c),
              (e: unknown) => {
                setBusy(false);
                setMsg(e instanceof Error ? e.message : 'Could not open a room.');
              },
            );
          }}
        >
          Open a new room
        </button>
        {!ready && <p className="uh-hint">Pick a name first.</p>}
        {msg && (
          <p className="uh-msg" role="alert">
            {msg}
          </p>
        )}
      </div>
      <details className="uh-rules">
        <summary>How to play</summary>
        <p>
          {MIN_PLAYERS} to {MAX_PLAYERS} players, each on their own phone or computer. Every round one player is the judge and reads out a prompt card. Everyone else plays the funniest (or most horrible) answer card from their hand. The judge picks a
          winner, who gets a point. First to the target wins. In vote mode there is no judge: everyone plays and votes.
        </p>
      </details>
    </div>
  );
}

function useNow(skew: number): number {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + skew), 250);
    return () => window.clearInterval(id);
  }, [skew]);
  return now;
}

function Room({ code, name, host, onLeave }: { code: string; name: string; host: GameHost; onLeave: () => void }) {
  const { view, conn, error, clearError, gone, skew, send } = useRoom(code, name);
  const now = useNow(skew);
  const reported = useRef<{ started: boolean; over: number }>({ started: false, over: -1 });
  const root = useRef<HTMLDivElement>(null);
  // Each new phase starts at the top (the prompt card).
  useEffect(() => {
    root.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view?.phase, view?.round]);

  // Tell the arcade when a game starts and ends (your points count as the score).
  useEffect(() => {
    if (!view) return;
    if (view.phase === 'picking' && !reported.current.started) {
      reported.current.started = true;
      host.report({ type: 'start' });
    }
    if (view.phase === 'over' && reported.current.over !== view.round) {
      reported.current.over = view.round;
      const me = view.players.find((p) => p.you);
      host.report({ type: 'end', score: me?.score ?? 0, stats: { wins: view.champion === view.you ? 1 : 0 } });
    }
  }, [view, host]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(t);
  }, [error, clearError]);

  if (gone)
    return (
      <div className="uh uh-center">
        <Logo />
        <div className="uh-panel">
          <p className="uh-big">{gone}</p>
          <button className="uh-btn uh-btn-go" onClick={onLeave}>
            Back
          </button>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="uh uh-center">
        <Logo />
        <p className="uh-tag">{conn === 'reconnecting' ? 'Reconnecting…' : `Joining room ${code}…`}</p>
        <button className="uh-btn" onClick={onLeave}>
          Cancel
        </button>
      </div>
    );

  // The code belongs to a Party Mode room, not a Crass Act one: send them to the party page.
  if ('game' in view && view.game !== 'crass-act')
    return (
      <div className="uh uh-center">
        <Logo />
        <div className="uh-panel">
          <p className="uh-big">Room {code} is a Party Mode room.</p>
          <a className="uh-btn uh-btn-go" href={`/party?room=${code}`}>
            Open it in Party Mode
          </a>
        </div>
      </div>
    );
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : null;
  return (
    <div className="uh uh-room" ref={root}>
      {conn !== 'open' && <div className="uh-conn">Connection lost. Reconnecting…</div>}
      {error && (
        <div className="uh-toast" role="alert">
          {error}
        </div>
      )}
      {view.phase === 'lobby' ? (
        <Lobby view={view} send={send} onLeave={onLeave} />
      ) : view.phase === 'over' ? (
        <Over view={view} send={send} onLeave={onLeave} />
      ) : (
        <Table view={view} send={send} left={left} onLeave={onLeave} />
      )}
    </div>
  );
}

type Send = ReturnType<typeof useRoom>['send'];

function invite(code: string): void {
  const app = embedHost()?.invite;
  if (app) return app();
  void shareOrCopy({ title: 'Crass Act', text: `Join my Crass Act room 😈\nRoom code: ${code}\nFill-in-the-blank cards for adults (18+)`, url: `${location.origin}/r/${code}` });
}

function Players({ view, send, compact = false }: { view: RoomView; send: Send; compact?: boolean }) {
  const amHost = view.host === view.you;
  return (
    <ul className={`uh-players${compact ? ' is-compact' : ''}`}>
      {view.players.map((p) => (
        <li key={p.n} className={`${p.online ? '' : 'is-off'}${p.you ? ' is-you' : ''}${p.judge ? ' is-judge' : ''}`}>
          <span className="uh-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
          <span className="uh-pname">
            {p.name}
            {p.host && <i title="Host"> 👑</i>}
            {p.judge && <i title="Judge"> ⚖️</i>}
          </span>
          {view.phase !== 'lobby' && <b className="uh-pts">{p.score}</b>}
          {(view.phase === 'picking' || (view.phase === 'judging' && view.settings.vote)) && !p.judge && <span className="uh-done">{p.waiting ? '⏳' : p.done ? '✅' : '…'}</span>}
          {amHost && !p.you && !compact && (
            <button className="uh-x" onClick={() => send({ t: 'kick', seat: p.n })} aria-label={`Remove ${p.name}`}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lobby({ view, send, onLeave }: { view: RoomView; send: Send; onLeave: () => void }) {
  const amHost = view.host === view.you;
  const online = view.players.filter((p) => p.online).length;
  return (
    <div className="uh-lobby">
      <Logo />
      <div className="uh-panel uh-codebox">
        <span>Room code</span>
        <b className="uh-bigcode">{view.code}</b>
        <button className="uh-btn uh-btn-go" onClick={() => invite(view.code)}>
          Invite friends
        </button>
      </div>
      <div className="uh-panel">
        <p className="uh-label">
          Players ({online}/{MAX_PLAYERS})
        </p>
        <Players view={view} send={send} />
        {online < MIN_PLAYERS && <p className="uh-hint">You need at least {MIN_PLAYERS} players. Send the link!</p>}
      </div>
      <div className="uh-panel">
        <p className="uh-label">Rules</p>
        <div className="uh-settings">
          <label>
            Points to win
            <select disabled={!amHost} value={view.settings.target} onChange={(e) => send({ t: 'settings', target: Number(e.target.value) })}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time to play
            <select disabled={!amHost} value={view.settings.seconds} onChange={(e) => send({ t: 'settings', seconds: Number(e.target.value) })}>
              {TIMERS.map((t) => (
                <option key={t} value={t}>
                  {t} s
                </option>
              ))}
            </select>
          </label>
          <label>
            Who decides
            <select disabled={!amHost} value={view.settings.vote ? 'vote' : 'judge'} onChange={(e) => send({ t: 'settings', vote: e.target.value === 'vote' })}>
              <option value="judge">A judge (takes turns)</option>
              <option value="vote">Everyone votes</option>
            </select>
          </label>
        </div>
      </div>
      {amHost ? (
        <button className="uh-btn uh-btn-go uh-btn-wide" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
          Start the game
        </button>
      ) : (
        <p className="uh-tag">Waiting for the host to start…</p>
      )}
      <button className="uh-link" onClick={onLeave}>
        Leave room
      </button>
    </div>
  );
}

function PromptCard({ text, cards, small = false }: { text: string; cards?: string[]; small?: boolean }) {
  return (
    <div className={`uh-prompt${small ? ' is-small' : ''}`}>
      <p>
        {fill(text, cards ?? []).map((part, i) =>
          part.card ? (
            <span key={i} className={cards?.length ? 'uh-filled' : 'uh-blank'}>
              {cards?.length ? part.text : '    '}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
      <small aria-hidden="true">?!</small>
    </div>
  );
}

function Table({ view, send, left, onLeave }: { view: RoomView; send: Send; left: number | null; onLeave: () => void }) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [roundSeen, setRoundSeen] = useState(view.round);
  if (roundSeen !== view.round) {
    // New round: clear choices (state reset during render, the React way).
    setRoundSeen(view.round);
    setChosen([]);
    setPick(null);
  }
  const me = view.players.find((p) => p.you)!;
  const judge = view.players.find((p) => p.judge);
  const isJudge = view.judge === view.you;
  const need = view.prompt?.pick ?? 1;
  const waitingOn = view.players.filter((p) => p.online && !p.judge && !p.waiting && !p.done);

  return (
    <div className="uh-table">
      <header className="uh-top">
        <span className="uh-chip">Round {view.round}</span>
        <span className="uh-chip">First to {view.settings.target}</span>
        {left !== null && view.phase !== 'reveal' && <span className={`uh-chip uh-timer${left <= 10 ? ' is-low' : ''}`}>{left}s</span>}
        <button className="uh-link" onClick={onLeave}>
          Leave
        </button>
      </header>
      <Players view={view} send={send} compact />

      {view.prompt && <PromptCard text={view.prompt.text} cards={view.phase === 'reveal' ? view.entries.find((e) => e.won)?.cards : undefined} />}

      {view.phase === 'picking' &&
        (view.waiting ? (
          <p className="uh-status">You joined mid-round. You’re in from the next one!</p>
        ) : isJudge ? (
          <p className="uh-status">
            You’re the judge ⚖️ Sit back while everyone plays. Waiting on {waitingOn.length ? waitingOn.map((p) => p.name).join(', ') : 'nobody'}.
          </p>
        ) : view.played ? (
          <p className="uh-status">Card played. Waiting on {waitingOn.map((p) => p.name).join(', ') || 'everyone else'}…</p>
        ) : (
          <>
            <p className="uh-status">
              {view.settings.vote ? 'Play' : `${judge?.name ?? 'The judge'} is judging. Play`} {need === 2 ? 'two cards, in order' : 'your funniest card'}.
            </p>
            <div className="uh-hand">
              {view.hand.map((c) => {
                const at = chosen.indexOf(c.id);
                return (
                  <button
                    key={c.id}
                    className={`uh-answer${at >= 0 ? ' is-chosen' : ''}`}
                    onClick={() => setChosen((list) => (at >= 0 ? list.filter((x) => x !== c.id) : need === 1 ? [c.id] : [...list, c.id].slice(-need)))}
                  >
                    {at >= 0 && need > 1 && <i className="uh-order">{at + 1}</i>}
                    {c.text}
                  </button>
                );
              })}
            </div>
            <div className="uh-actions">
              <button className="uh-btn uh-btn-go" disabled={chosen.length !== need} onClick={() => send({ t: 'play', cards: chosen })}>
                {need === 2 ? 'Play these cards' : 'Play this card'}
              </button>
              {!view.swapped && (
                <button className="uh-btn uh-btn-small" onClick={() => send({ t: 'swap' })} title="Once per game">
                  Swap my hand
                </button>
              )}
            </div>
          </>
        ))}

      {view.phase === 'judging' && (
        <>
          <p className="uh-status">
            {view.settings.vote
              ? view.myVote !== null
                ? 'Vote cast. Waiting for the others…'
                : 'Vote for the funniest one (not your own!).'
              : isJudge
                ? 'Pick the winner. No pressure.'
                : `${judge?.name ?? 'The judge'} is choosing…`}
          </p>
          <div className="uh-entries">
            {view.entries.map((e, i) => {
              const canTap = view.settings.vote ? !e.mine && view.myVote === null : isJudge;
              return (
                <button
                  key={i}
                  className={`uh-entry${pick === i || view.myVote === i ? ' is-chosen' : ''}${e.mine ? ' is-mine' : ''}`}
                  disabled={!canTap}
                  onClick={() => setPick(i)}
                >
                  {e.cards.map((c, j) => (
                    <span key={j} className="uh-answer is-flat">
                      {c}
                    </span>
                  ))}
                  {e.mine && <i className="uh-mine">yours</i>}
                </button>
              );
            })}
          </div>
          {pick !== null && (isJudge || (view.settings.vote && view.myVote === null)) && (
            <div className="uh-actions">
              <button className="uh-btn uh-btn-go" onClick={() => send(view.settings.vote ? { t: 'vote', entry: pick } : { t: 'pick', entry: pick })}>
                {view.settings.vote ? 'Vote for this' : 'This one wins'}
              </button>
            </div>
          )}
        </>
      )}

      {view.phase === 'reveal' && (
        <>
          <p className="uh-winner">
            🏆 {view.entries.filter((e) => e.won).map((e) => e.name).join(' & ')} {view.winners.length > 1 ? 'tie' : 'wins'} the round!
          </p>
          <div className="uh-entries">
            {view.entries.map((e, i) => (
              <div key={i} className={`uh-entry${e.won ? ' is-won' : ''}`}>
                {e.cards.map((c, j) => (
                  <span key={j} className="uh-answer is-flat">
                    {c}
                  </span>
                ))}
                <i className="uh-by">
                  {e.name}
                  {typeof e.votes === 'number' ? ` · ${e.votes} vote${e.votes === 1 ? '' : 's'}` : ''}
                </i>
              </div>
            ))}
          </div>
          {(view.host === view.you || isJudge || view.settings.vote) && (
            <div className="uh-actions">
              <button className="uh-btn uh-btn-go" onClick={() => send({ t: 'next' })}>
                Next round
              </button>
            </div>
          )}
        </>
      )}
      <p className="uh-me">
        You: {me.score} point{me.score === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function Over({ view, send, onLeave }: { view: RoomView; send: Send; onLeave: () => void }) {
  const champ = view.players.find((p) => p.n === view.champion);
  const ranked = [...view.players].sort((a, b) => b.score - a.score);
  return (
    <div className="uh-lobby">
      <p className="uh-crown">🏆</p>
      <h2 className="uh-champ">{champ ? `${champ.name} wins!` : 'Game over'}</h2>
      <p className="uh-tag">{champ?.you ? 'You absolute menace.' : 'Shame on all of you.'}</p>
      <div className="uh-panel">
        <ol className="uh-ranking">
          {ranked.map((p) => (
            <li key={p.n} className={p.you ? 'is-you' : ''}>
              <span>{p.name}</span>
              <b>{p.score}</b>
            </li>
          ))}
        </ol>
      </div>
      {view.history.length > 0 && (
        <div className="uh-panel">
          <p className="uh-label">Greatest hits</p>
          <div className="uh-hits">
            {view.history.slice(0, 8).map((h, i) => (
              <div key={i} className="uh-hit">
                <PromptCard text={h.prompt} cards={h.cards} small />
                <i>{h.name}</i>
              </div>
            ))}
          </div>
        </div>
      )}
      {view.host === view.you ? (
        <button className="uh-btn uh-btn-go uh-btn-wide" onClick={() => send({ t: 'start' })}>
          Play again (new cards)
        </button>
      ) : (
        <p className="uh-tag">Waiting for the host to start another game…</p>
      )}
      <button className="uh-link" onClick={onLeave}>
        Leave room
      </button>
    </div>
  );
}
