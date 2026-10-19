import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ContentLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { embedHost } from '../../platform/embed';
import { shareOrCopy } from '../../platform/share';
import { fill, MAX_PLAYERS, MIN_PLAYERS, TARGETS, TIMERS, type Deck, type RoomView } from './engine';
import { createRoom, roomInfo, useRoom } from './net';
import { UI, type Ui } from './ui';
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

/** The player's language: the game's own text, and the deck a room they open starts with. */
const Lang = createContext<{ u: Ui; lang: ContentLang }>({ u: UI.en, lang: 'en' });
const useUi = (): Ui => useContext(Lang).u;

export default function Game({ host, restartKey, playerName, lang = 'en' }: GameModuleProps) {
  return (
    <Lang.Provider value={{ u: UI[lang], lang }}>
      <CrassAct key={restartKey} host={host} playerName={playerName} />
    </Lang.Provider>
  );
}

function CrassAct({ host, playerName }: { host: GameHost; playerName?: string }) {
  const [adult, setAdult] = useState(() => read(ADULT) === '1');
  // Inside the Discord Activity: the player's Discord name, and straight into the call's room.
  const [name, setName] = useState(() => (embedHost() && playerName) || read(NAME) || playerName || '');
  const [code, setCode] = useState<string | null>(() => (embedHost() && linkedRoom()) || null);
  const [invite] = useState(linkedRoom);
  const u = useUi();

  if (!adult)
    return (
      <div className="uh uh-center">
        <Logo />
        <div className="uh-panel uh-gate">
          <p className="uh-big">{u.adultsTitle}</p>
          <p>{u.adultsBody}</p>
          <div className="uh-row">
            <button
              className="uh-btn uh-btn-go"
              onClick={() => {
                write(ADULT, '1');
                setAdult(true);
              }}
            >
              {u.adultYes}
            </button>
            <a className="uh-btn" href="/">
              {u.takeMeBack}
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
  const u = useUi();

  const join = async (c: string): Promise<void> => {
    setBusy(true);
    setMsg('');
    const info = await roomInfo(c);
    setBusy(false);
    if (!info) return setMsg(u.noRoom(c));
    // A Party Mode room (Impostor, Never Have I Ever…): it opens on the party page.
    if (info.game && info.game !== 'crass-act') return location.assign(`/party?room=${c}`);
    if (info.full) return setMsg(u.roomFull(c, MAX_PLAYERS));
    onEnter(c);
  };

  return (
    <div className="uh uh-center">
      <Logo />
      <p className="uh-tag">{u.tag}</p>
      <div className="uh-panel">
        <label className="uh-field">
          <span>{u.yourName}</span>
          <input value={name} maxLength={20} placeholder={u.namePlaceholder} onChange={(e) => onName(e.target.value)} />
        </label>
        {invite && (
          <p className="uh-invite">
            {u.invited} <b>{invite}</b>.
          </p>
        )}
        <div className="uh-join">
          <input
            className="uh-code"
            value={code}
            maxLength={5}
            placeholder={u.code}
            aria-label={u.roomCode}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button className="uh-btn uh-btn-go" disabled={!ready || code.length !== 5 || busy} onClick={() => void join(code)}>
            {u.joinRoom}
          </button>
        </div>
        <div className="uh-or">{u.or}</div>
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
                setMsg(e instanceof Error ? e.message : u.cannotOpen);
              },
            );
          }}
        >
          {u.openRoom}
        </button>
        {!ready && <p className="uh-hint">{u.pickName}</p>}
        {msg && (
          <p className="uh-msg" role="alert">
            {msg}
          </p>
        )}
      </div>
      <details className="uh-rules">
        <summary>{u.howToPlay}</summary>
        <p>{u.rules(MIN_PLAYERS, MAX_PLAYERS)}</p>
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
  const u = useUi();
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
            {u.back}
          </button>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="uh uh-center">
        <Logo />
        <p className="uh-tag">{conn === 'reconnecting' ? u.reconnecting : u.joining(code)}</p>
        <button className="uh-btn" onClick={onLeave}>
          {u.cancel}
        </button>
      </div>
    );

  // The code belongs to a Party Mode room, not a Crass Act one: send them to the party page.
  if ('game' in view && view.game !== 'crass-act')
    return (
      <div className="uh uh-center">
        <Logo />
        <div className="uh-panel">
          <p className="uh-big">{u.partyRoom(code)}</p>
          <a className="uh-btn uh-btn-go" href={`/party?room=${code}`}>
            {u.openInParty}
          </a>
        </div>
      </div>
    );
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : null;
  return (
    <div className="uh uh-room" ref={root}>
      {conn !== 'open' && <div className="uh-conn">{u.connectionLost}</div>}
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

function invite(code: string, u: Ui): void {
  const app = embedHost()?.invite;
  if (app) return app();
  void shareOrCopy({ title: 'Crass Act', text: u.inviteText(code), url: `${location.origin}/r/${code}` });
}

function Players({ view, send, compact = false }: { view: RoomView; send: Send; compact?: boolean }) {
  const amHost = view.host === view.you;
  const u = useUi();
  return (
    <ul className={`uh-players${compact ? ' is-compact' : ''}`}>
      {view.players.map((p) => (
        <li key={p.n} className={`${p.online ? '' : 'is-off'}${p.you ? ' is-you' : ''}${p.judge ? ' is-judge' : ''}`}>
          <span className="uh-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
          <span className="uh-pname">
            {p.name}
            {p.host && <i title={u.host}> 👑</i>}
            {p.judge && <i title={u.judge}> ⚖️</i>}
          </span>
          {view.phase !== 'lobby' && <b className="uh-pts">{p.score}</b>}
          {(view.phase === 'picking' || (view.phase === 'judging' && view.settings.vote)) && !p.judge && <span className="uh-done">{p.waiting ? '⏳' : p.done ? '✅' : '…'}</span>}
          {amHost && !p.you && !compact && (
            <button className="uh-x" onClick={() => send({ t: 'kick', seat: p.n })} aria-label={u.remove(p.name)}>
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
  const { u, lang } = useContext(Lang);
  const deck: Deck = view.settings.deck ?? 'en';
  // A room a Bulgarian host just opened starts with the Bulgarian cards (once: the host can switch back).
  const autoDeck = useRef(false);
  useEffect(() => {
    if (autoDeck.current || !amHost || view.round !== 0) return;
    autoDeck.current = true;
    if (lang !== deck) send({ t: 'settings', deck: lang });
  }, [amHost, view.round, lang, deck, send]);
  return (
    <div className="uh-lobby">
      <Logo />
      <div className="uh-panel uh-codebox">
        <span>{u.roomCode}</span>
        <b className="uh-bigcode">{view.code}</b>
        <button className="uh-btn uh-btn-go" onClick={() => invite(view.code, u)}>
          {u.inviteFriends}
        </button>
      </div>
      <div className="uh-panel">
        <p className="uh-label">{u.players(online, MAX_PLAYERS)}</p>
        <Players view={view} send={send} />
        {online < MIN_PLAYERS && <p className="uh-hint">{u.needPlayers(MIN_PLAYERS)}</p>}
      </div>
      <div className="uh-panel">
        <p className="uh-label">{u.rulesTitle}</p>
        <div className="uh-settings">
          <label>
            {u.cards}
            <select disabled={!amHost} value={deck} onChange={(e) => send({ t: 'settings', deck: e.target.value as Deck })}>
              <option value="en">English</option>
              <option value="bg">Български</option>
            </select>
          </label>
          <label>
            {u.pointsToWin}
            <select disabled={!amHost} value={view.settings.target} onChange={(e) => send({ t: 'settings', target: Number(e.target.value) })}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            {u.timeToPlay}
            <select disabled={!amHost} value={view.settings.seconds} onChange={(e) => send({ t: 'settings', seconds: Number(e.target.value) })}>
              {TIMERS.map((t) => (
                <option key={t} value={t}>
                  {t} s
                </option>
              ))}
            </select>
          </label>
          <label>
            {u.whoDecides}
            <select disabled={!amHost} value={view.settings.vote ? 'vote' : 'judge'} onChange={(e) => send({ t: 'settings', vote: e.target.value === 'vote' })}>
              <option value="judge">{u.judgeTakesTurns}</option>
              <option value="vote">{u.everyoneVotes}</option>
            </select>
          </label>
        </div>
      </div>
      {amHost ? (
        <button className="uh-btn uh-btn-go uh-btn-wide" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
          {u.start}
        </button>
      ) : (
        <p className="uh-tag">{u.waitingHost}</p>
      )}
      <button className="uh-link" onClick={onLeave}>
        {u.leaveRoom}
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
  const u = useUi();
  const judgeName = judge?.name ?? u.theJudge;

  return (
    <div className="uh-table">
      <header className="uh-top">
        <span className="uh-chip">{u.round(view.round)}</span>
        <span className="uh-chip">{view.tiebreak ? u.tieBreaker : u.firstTo(view.settings.target)}</span>
        {left !== null && view.phase !== 'reveal' && <span className={`uh-chip uh-timer${left <= 10 ? ' is-low' : ''}`}>{left}s</span>}
        <button className="uh-link" onClick={onLeave}>
          {u.leave}
        </button>
      </header>
      <Players view={view} send={send} compact />
      {view.tiebreak && view.phase !== 'reveal' && <p className="uh-status">{u.tieBreakerNote}</p>}

      {view.prompt && <PromptCard text={view.prompt.text} cards={view.phase === 'reveal' ? view.entries.find((e) => e.won)?.cards : undefined} />}

      {view.phase === 'picking' &&
        (view.waiting ? (
          <p className="uh-status">{u.joinedMid}</p>
        ) : isJudge ? (
          <p className="uh-status">{u.youJudge(waitingOn.length ? waitingOn.map((p) => p.name).join(', ') : u.nobody)}</p>
        ) : view.played ? (
          <p className="uh-status">{u.cardPlayed(waitingOn.map((p) => p.name).join(', ') || u.everyoneElse)}</p>
        ) : (
          <>
            <p className="uh-status">{u.playPrompt(view.settings.vote, judgeName, need === 2)}</p>
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
                {need === 2 ? u.playThese : u.playThis}
              </button>
              {!view.swapped && (
                <button className="uh-btn uh-btn-small" onClick={() => send({ t: 'swap' })} title={u.oncePerGame}>
                  {u.swapHand}
                </button>
              )}
            </div>
          </>
        ))}

      {view.phase === 'judging' && (
        <>
          <p className="uh-status">
            {view.waiting ? u.joinedMid : view.settings.vote ? (view.myVote !== null ? u.voteCast : u.voteFunniest) : isJudge ? u.pickWinner : u.choosing(judgeName)}
          </p>
          <div className="uh-entries">
            {view.entries.map((e, i) => {
              const canTap = view.settings.vote ? !e.mine && view.myVote === null && !view.waiting : isJudge;
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
                  {e.mine && <i className="uh-mine">{u.yours}</i>}
                </button>
              );
            })}
          </div>
          {pick !== null && (isJudge || (view.settings.vote && view.myVote === null && !view.waiting)) && (
            <div className="uh-actions">
              <button className="uh-btn uh-btn-go" onClick={() => send(view.settings.vote ? { t: 'vote', entry: pick } : { t: 'pick', entry: pick })}>
                {view.settings.vote ? u.voteThis : u.thisWins}
              </button>
            </div>
          )}
        </>
      )}

      {view.phase === 'reveal' && (
        <>
          <p className="uh-winner">
            {u.roundWinner(
              view.entries
                .filter((e) => e.won)
                .map((e) => e.name)
                .join(' & '),
              view.winners.length > 1,
            )}
          </p>
          {view.tiebreak && <p className="uh-status">{u.tiedLead}</p>}
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
                  {typeof e.votes === 'number' ? u.votes(e.votes) : ''}
                </i>
              </div>
            ))}
          </div>
          {(view.host === view.you || isJudge || view.settings.vote) && (
            <div className="uh-actions">
              <button className="uh-btn uh-btn-go" onClick={() => send({ t: 'next' })}>
                {u.nextRound}
              </button>
            </div>
          )}
        </>
      )}
      <p className="uh-me">{u.yourPoints(me.score)}</p>
    </div>
  );
}

function Over({ view, send, onLeave }: { view: RoomView; send: Send; onLeave: () => void }) {
  const champ = view.players.find((p) => p.n === view.champion);
  const ranked = [...view.players].sort((a, b) => b.score - a.score);
  const u = useUi();
  return (
    <div className="uh-lobby">
      <p className="uh-crown">🏆</p>
      <h2 className="uh-champ">{champ ? u.wins(champ.name) : u.gameOver}</h2>
      <p className="uh-tag">{champ?.you ? u.menace : u.shame}</p>
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
          <p className="uh-label">{u.greatestHits}</p>
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
          {u.playAgain}
        </button>
      ) : (
        <p className="uh-tag">{u.waitingAnother}</p>
      )}
      <button className="uh-link" onClick={onLeave}>
        {u.leaveRoom}
      </button>
    </div>
  );
}
