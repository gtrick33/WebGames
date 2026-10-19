import { useEffect, useState } from 'react';
import { IMPOSTOR_THEMES } from '../content/impostor';
import { MIN_PLAYERS, TALK_TIMES, type Action, type PlayerView, type RoomView } from '../impostorRoom';
import { setGuestName, usePlayerName } from '../../platform/playerName';
import { createRoom, roomInfo, useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { navigate } from '../../router/router';
import { ModeBar } from './shared';
import { SecretCard } from './Impostor';
import { RoomNotice, useTopOnPhase } from './room/RoomFrame';

const COLORS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#3d7bff', '#a45cff', '#ff7eb6', '#12c6b3', '#ff8a1f', '#8ad13b', '#5b6cff', '#e64c9a', '#00a6d6'];
const color = (n: number): string => COLORS[(n - 1) % COLORS.length]!;

function Dot({ p, size = 34 }: { p: Pick<PlayerView, 'n' | 'name'>; size?: number }) {
  return (
    <span className="pt-avatar pt-imp-dot" style={{ background: color(p.n), width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Seconds left until a server deadline (corrected for the clock difference). */
function useLeft(deadline: number | null, skew: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - (now + skew)) / 1000)) : null;
}

/** /party?room=CODE: asks for a name once, then connects. */
export function ImpostorRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
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
        <ModeBar title="Impostor room" onExit={onLeave} />
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
        <ModeBar title={`Impostor · room ${code}`} onExit={onLeave} />
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
          <p className="pt-imp-badge">🕵️</p>
          <h2>Join the room</h2>
          <label className="pt-label" htmlFor="pt-imp-name">
            Your name (so friends know who’s who)
          </label>
          <input id="pt-imp-name" className="pt-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20} autoFocus enterKeyHint="go" />
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()}>
            Join
          </button>
        </form>
      </div>
    );
  return <Room code={code} name={name} onLeave={onLeave} />;
}

function Room({ code, name, onLeave }: { code: string; name: string; onLeave: () => void }) {
  const { view, conn, error, clearError, gone, skew, send } = useRoom<RoomView, Action>(code, name);
  const left = useLeft(view?.deadline ?? null, skew);
  const screen = useTopOnPhase(view?.phase);
  const invite = (): void => {
    void shareOrCopy({ title: 'Impostor room', text: `🕵️ Join my Impostor room (code ${code}): one of us gets a different card. Find them!`, url: `${location.origin}/r/${code}` });
  };
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(t);
  }, [error, clearError]);

  const bar = <ModeBar title={`Impostor · ${code}`} progress={view?.round ? `Round ${view.round}` : undefined} onExit={onLeave} />;
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
  const inRound = view.players.filter((p) => !p.waiting);
  const byN = (n: number | null) => view.players.find((p) => p.n === n);
  const starter = byN(view.starter);

  return (
    <div className="pt-screen" ref={screen}>
      {bar}
      <RoomNotice error={error} conn={conn} />

      {view.phase === 'lobby' && (
        <>
          <section className="pt-panel">
            <div className="pt-panel-head">
              <h2>Who’s here</h2>
              <span className="pt-pill">{view.players.filter((p) => p.online).length} in the room</span>
            </div>
            <ul className="pt-names">
              {view.players.map((p) => (
                <li key={p.n} className={`pt-name-chip${p.online ? '' : ' is-away'}`} style={{ ['--pc' as string]: color(p.n) }}>
                  <Dot p={p} size={26} />
                  <span>
                    {p.name}
                    {p.host ? ' 👑' : ''}
                    {p.you ? ' (you)' : ''}
                  </span>
                  {view.host && !p.you && (
                    <button onClick={() => send({ t: 'kick', seat: p.n })} aria-label={`Remove ${p.name}`}>
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
            <HostSettings view={view} send={send} />
          ) : (
            <p className="pt-muted pt-center">Waiting for the host to start…</p>
          )}
        </>
      )}

      {view.phase === 'reveal' && (
        <>
          {view.card ? <SecretCard impostor={view.card.impostor} theme={view.card.theme} word={view.card.word} hint={view.card.hint} /> : <p className="pt-panel">You joined mid-round: you’re in from the next one.</p>}
          {view.card && !me.done && (
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'seen' })}>
              Got it
            </button>
          )}
          <Waiting players={inRound} label="Ready" />
          {view.host && (
            <button className="pt-btn pt-btn-sm" onClick={() => send({ t: 'vote_now' })}>
              Skip waiting
            </button>
          )}
        </>
      )}

      {view.phase === 'talk' && (
        <section className="pt-panel pt-imp-talk">
          <p className="pt-kicker">Theme</p>
          <h2 className="pt-imp-theme">{view.card?.theme ?? '…'}</h2>
          {starter && (
            <p className="pt-imp-starter">
              <Dot p={starter} />
              <span>
                <b>{starter.you ? 'You start' : `${starter.name} starts`}</b>. Go round, one word each. Never say the word!
              </span>
            </p>
          )}
          {view.card && (
            <details className="pt-imp-peek">
              <summary>Peek at my card</summary>
              <SecretCard impostor={view.card.impostor} theme={view.card.theme} word={view.card.word} hint={view.card.hint} />
            </details>
          )}
          {left !== null && <p className="pt-imp-clock">⏱ {left}s</p>}
          {view.card ? (
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'vote_now' })}>
              🗳️ Start the vote
            </button>
          ) : (
            <p className="pt-muted">You joined mid-round: you’re in from the next one.</p>
          )}
        </section>
      )}

      {view.phase === 'vote' && (
        <section className="pt-panel">
          <h2>Who’s the impostor?</h2>
          {left !== null && <p className="pt-imp-clock">⏱ {left}s</p>}
          {view.card ? (
            <div className="pt-imp-vote">
              {inRound
                .filter((p) => !p.you)
                .map((p) => (
                  <button key={p.n} className={`pt-imp-suspect${view.myVote === p.n ? ' is-on' : ''}`} style={{ ['--pc' as string]: color(p.n) }} onClick={() => send({ t: 'vote', seat: p.n })}>
                    <Dot p={p} size={44} />
                    <span>{p.name}</span>
                  </button>
                ))}
            </div>
          ) : (
            <p className="pt-muted">You’re in from the next round.</p>
          )}
          <Waiting players={inRound} label="Voted" />
        </section>
      )}

      {view.phase === 'guess' && (
        <section className="pt-panel pt-imp-guess">
          <p className="pt-imp-badge">🚨</p>
          <h2>{byN(view.voted)?.you ? 'You were caught!' : `${byN(view.voted)?.name} was the impostor!`}</h2>
          {left !== null && <p className="pt-imp-clock">⏱ {left}s</p>}
          {byN(view.voted)?.you ? (
            <>
              <p>One guess at the word steals the round:</p>
              <div className="pt-imp-options">
                {view.options?.map((w) => (
                  <button key={w} className="pt-btn" onClick={() => send({ t: 'guess', word: w })}>
                    {w}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="pt-muted">They get one guess at the word to steal the round…</p>
          )}
        </section>
      )}

      {view.phase === 'result' && view.result && (
        <section className="pt-panel pt-imp-result">
          <h2>{view.result.outcome === 'escaped' ? '🕵️ The impostor got away!' : view.result.outcome === 'stole' ? '😈 Caught, but they guessed the word!' : '🎉 Impostor caught!'}</h2>
          {view.result.outcome === 'escaped' && (
            <p className="pt-muted">
              {view.voted !== null
                ? `${byN(view.voted)?.name ?? 'Someone'} was voted out, but they were innocent.`
                : Object.keys(view.result.votes).length
                  ? 'The vote was a tie, so nobody was voted out.'
                  : 'Nobody voted in time.'}
            </p>
          )}
          <p className="pt-imp-word">
            The word was <b>{view.result.word}</b>
          </p>
          <div className="pt-imp-reveal">
            {view.result.impostors.map((n) => {
              const p = byN(n);
              return p ? (
                <span key={n} className="pt-name-chip" style={{ ['--pc' as string]: color(n) }}>
                  <Dot p={p} size={26} /> {p.name} 🕵️
                </span>
              ) : null;
            })}
          </div>
          <ul className="pt-imp-votes">
            {Object.entries(view.result.votes).map(([from, to]) => (
              <li key={from}>
                {byN(Number(from))?.name} → {byN(to)?.name}
              </li>
            ))}
          </ul>
          <ol className="pt-imp-scores">
            {[...view.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <li key={p.n}>
                  <Dot p={p} size={26} />
                  <span>{p.name}</span>
                  {view.result!.gained[String(p.n)] ? <em>+{view.result!.gained[String(p.n)]}</em> : null}
                  <b>{p.score}</b>
                </li>
              ))}
          </ol>
          {view.host ? (
            <div className="pt-row">
              <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'next' })}>
                Next round
              </button>
              <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
                Settings
              </button>
            </div>
          ) : (
            <p className="pt-muted pt-center">The host starts the next round.</p>
          )}
        </section>
      )}
    </div>
  );
}

function Waiting({ players, label }: { players: PlayerView[]; label: string }) {
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

function HostSettings({ view, send }: { view: RoomView; send: (a: Action) => void }) {
  const s = view.settings;
  const setS = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  const all = s.themes.length === 0;
  const online = view.players.filter((p) => p.online).length;
  return (
    <section className="pt-panel">
      <h3>Themes</h3>
      <div className="pt-picker">
        <button className={`pt-chip${all ? ' is-on' : ''}`} onClick={() => setS({ themes: [] })}>
          🎲 Mix them all
        </button>
        {IMPOSTOR_THEMES.map((t) => {
          const on = s.themes.includes(t.id);
          return (
            <button key={t.id} className={`pt-chip${on ? ' is-on' : ''}`} onClick={() => setS({ themes: on ? s.themes.filter((x) => x !== t.id) : [...s.themes, t.id] })}>
              {t.emoji} {t.name}
            </button>
          );
        })}
      </div>
      <p className="pt-label">Impostors</p>
      <div className="pt-seg" role="radiogroup">
        <button role="radio" aria-checked={s.impostors === 1} onClick={() => setS({ impostors: 1 })}>
          One
        </button>
        <button role="radio" aria-checked={s.impostors === 2} onClick={() => setS({ impostors: 2 })}>
          Two <small>7+ players</small>
        </button>
      </div>
      <p className="pt-label">The impostor gets</p>
      <div className="pt-seg" role="radiogroup">
        <button role="radio" aria-checked={s.hint} onClick={() => setS({ hint: true })}>
          A hint word
        </button>
        <button role="radio" aria-checked={!s.hint} onClick={() => setS({ hint: false })}>
          Only the theme
        </button>
      </div>
      <p className="pt-label">Talking time</p>
      <div className="pt-seg" role="radiogroup">
        {TALK_TIMES.map((secs) => (
          <button key={secs} role="radio" aria-checked={s.talk === secs} onClick={() => setS({ talk: secs })}>
            {secs ? `${secs / 60} min` : 'No timer'}
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {online < MIN_PLAYERS ? `Waiting for ${MIN_PLAYERS - online} more` : 'Start the round'}
      </button>
    </section>
  );
}

/** Opens a new Impostor room and goes into it. */
export async function openImpostorRoom(): Promise<void> {
  const code = await createRoom('impostor');
  navigate(`/party?room=${code}`);
}
