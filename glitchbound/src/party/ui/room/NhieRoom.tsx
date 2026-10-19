import { NHIE_CATEGORIES } from '../../content/nhie';
import { FINGERS, LENGTHS, MIN_PLAYERS, type Action, type RoomView } from '../../rooms/nhieRoom';
import { Clock, Dot, RoomFrame, Scores, seatColor, Waiting, type RoomContext } from './RoomFrame';

type Ctx = RoomContext<RoomView, Action>;

export function NhieRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Never Have I Ever', emoji: '🙊', invite: 'Join my Never Have I Ever room: answer in secret, reveal together.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'lobby' ? undefined : `${v.count}/${v.settings.length}`)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const s = view.settings;
  const set = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  const online = view.players.filter((p) => p.online).length;
  return (
    <>
      <h3>Categories</h3>
      <div className="pt-picker">
        {NHIE_CATEGORIES.filter((c) => !c.adult || s.adult).map((c) => {
          const on = s.categories.includes(c.id);
          return (
            <button key={c.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set({ categories: on ? s.categories.filter((x) => x !== c.id) : [...s.categories, c.id] })}>
              {c.emoji} {c.label}
            </button>
          );
        })}
      </div>
      <label className="pt-switch">
        <input type="checkbox" checked={s.adult} onChange={(e) => set({ adult: e.target.checked })} />
        <span>
          <b>Everyone here is 18+</b> · unlocks the adults-only statements
        </span>
      </label>
      <p className="pt-label">Fingers each</p>
      <div className="pt-seg" role="radiogroup">
        {FINGERS.map((f) => (
          <button key={f} role="radio" aria-checked={s.fingers === f} onClick={() => set({ fingers: f })}>
            ✋ {f}
          </button>
        ))}
      </div>
      <p className="pt-label">Statements, at most</p>
      <div className="pt-seg" role="radiogroup">
        {LENGTHS.map((n) => (
          <button key={n} role="radio" aria-checked={s.length === n} onClick={() => set({ length: n })}>
            {n}
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        Start
      </button>
    </>
  );
}

function Fingers({ view }: { view: RoomView }) {
  return (
    <div className="pt-fingers">
      {view.players
        .filter((p) => view.playing.includes(p.n))
        .map((p) => {
          const n = view.fingers[String(p.n)] ?? 0;
          return (
            <span key={p.n} className={`pt-finger${n === 0 ? ' is-out' : ''}${p.you ? ' is-you' : ''}`} title={`${p.name}: ${n} fingers`}>
              <Dot p={p} size={28} />✋{n}
            </span>
          );
        })}
    </div>
  );
}

function Game({ view, send, left, me, byN }: Ctx) {
  const cat = view.statement ? NHIE_CATEGORIES.find((c) => c.id === view.statement!.category) : undefined;
  const playing = view.players.filter((p) => view.playing.includes(p.n));
  const mineLeft = view.fingers[String(me.n)] ?? 0;

  if (view.phase === 'result' && view.result) {
    const winners = view.result.winners.map((n) => byN(n)).filter((p) => !!p);
    const most = Math.max(0, ...Object.values(view.result.have));
    const wildest = Object.entries(view.result.have)
      .filter(([, n]) => most > 0 && n === most)
      .map(([n]) => byN(Number(n))?.name)
      .filter((name) => !!name);
    return (
      <section className="pt-panel pt-imp-result">
        <h2>{winners.length === 1 ? (winners[0]!.you ? '🏆 You win: the most innocent!' : `🏆 ${winners[0]!.name} has done the least!`) : `🏆 A tie: ${winners.map((p) => p.name).join(' & ')}`}</h2>
        {wildest.length > 0 && (
          <p className="pt-muted pt-center">
            🏅 Most experienced: <b>{wildest.join(' & ')}</b> ({most} × “I have”)
          </p>
        )}
        <Scores players={view.players} />
        {view.host ? (
          <div className="pt-row">
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'start' })}>
              Play again
            </button>
            <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
              Settings
            </button>
          </div>
        ) : (
          <p className="pt-muted pt-center">The host starts the next game.</p>
        )}
      </section>
    );
  }

  return (
    <>
      <Fingers view={view} />
      {view.statement && (
        <article className="pt-card pt-card-nhie" key={view.statement.text}>
          <span className="pt-kind">{cat?.emoji} Never have I ever…</span>
          <p className="pt-card-text">…{view.statement.text}.</p>
        </article>
      )}
      {view.phase === 'answer' &&
        (view.playing.includes(me.n) ? (
          <section className="pt-actions">
            <p className="pt-muted">{mineLeft > 0 ? 'Answer in secret. Everyone sees the answers together.' : 'You’re out of fingers, but you can still answer for fun.'}</p>
            <div className="pt-room-answer">
              <button className={`pt-btn pt-btn-big${view.myAnswer === true ? ' is-on' : ''}`} aria-pressed={view.myAnswer === true} onClick={() => send({ t: 'answer', have: true })}>
                🙋 I have
              </button>
              <button className={`pt-btn pt-btn-big${view.myAnswer === false ? ' is-on' : ''}`} aria-pressed={view.myAnswer === false} onClick={() => send({ t: 'answer', have: false })}>
                🙅 Never
              </button>
            </div>
            <Clock left={left} />
            <Waiting players={playing.filter((p) => (view.fingers[String(p.n)] ?? 0) > 0)} label="Answered" />
            {view.host && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                Reveal now
              </button>
            )}
          </section>
        ) : (
          <p className="pt-panel pt-center">You joined mid-game: you’re in from the next one. Watch the answers come in!</p>
        ))}
      {view.phase === 'reveal' && view.haves && (
        <section className="pt-panel pt-center pt-room-reveal">
          <h2>{view.haves.length === 0 ? '😇 Nobody has!' : view.haves.length === playing.length ? '😈 Everyone has!' : `${view.haves.length} ${view.haves.length === 1 ? 'has' : 'have'} done it`}</h2>
          <div className="pt-imp-reveal">
            {view.haves.map((n) => {
              const p = byN(n);
              return p ? (
                <span key={n} className="pt-name-chip" style={{ ['--pc' as string]: seatColor(n) }}>
                  <Dot p={p} size={26} /> {p.name} 🙋
                </span>
              ) : null;
            })}
          </div>
          {view.myAnswer === true && <p className="pt-muted">{mineLeft > 0 ? `One finger down: ${mineLeft} left.` : 'That was your last finger!'}</p>}
          <Clock left={left} />
          {view.host && (
            <button className="pt-btn pt-btn-go" onClick={() => send({ t: 'next' })}>
              Next statement →
            </button>
          )}
        </section>
      )}
    </>
  );
}
