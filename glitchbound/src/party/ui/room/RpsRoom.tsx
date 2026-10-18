import { useEffect, useState } from 'react';
import { HANDS, MIN_PLAYERS, TARGETS, type Action, type Hand, type RoomView } from '../../rooms/rpsRoom';
import { Clock, Dot, RoomFrame, Scores, seatColor, Waiting, type RoomContext } from './RoomFrame';

type Ctx = RoomContext<RoomView, Action>;
const EMOJI: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const CHANT = ['Rock…', 'Paper…', 'Scissors…', 'Shoot!'];

export function RpsRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Rock Paper Scissors', emoji: '✊', invite: 'Rock Paper Scissors on our own phones: everyone throws at once. Last hand standing wins.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.round && v.phase !== 'lobby' ? `Throw ${v.round}` : undefined)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const s = view.settings;
  const online = view.players.filter((p) => p.online).length;
  return (
    <>
      <div className="pt-seg" role="radiogroup" aria-label="Mode">
        <button role="radio" aria-checked={s.mode === 'knockout'} onClick={() => send({ t: 'settings', settings: { mode: 'knockout' } })}>
          🥊 Last hand standing
          <small>The losing hand is out</small>
        </button>
        <button role="radio" aria-checked={s.mode === 'points'} onClick={() => send({ t: 'settings', settings: { mode: 'points' } })}>
          🏁 Points race
          <small>A point per player you beat</small>
        </button>
      </div>
      {s.mode === 'points' && (
        <>
          <p className="pt-label">Points to win</p>
          <div className="pt-seg" role="radiogroup">
            {TARGETS.map((t) => (
              <button key={t} role="radio" aria-checked={s.target === t} onClick={() => send({ t: 'settings', settings: { target: t } })}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="pt-muted">Everyone throws in secret on their own phone, then all hands are revealed together. Too slow? A random hand is thrown for you.</p>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        Start
      </button>
    </>
  );
}

/** "Rock… Paper… Scissors… Shoot!" before the hands show (starts over for every throw). */
function useChant(key: string, on: boolean): number {
  const [chant, setChant] = useState({ key: '', step: CHANT.length });
  useEffect(() => {
    if (!on) return;
    let i = 0;
    const t = window.setInterval(() => {
      setChant({ key, step: ++i });
      if (i >= CHANT.length) window.clearInterval(t);
    }, 320);
    return () => window.clearInterval(t);
  }, [key, on]);
  if (!on) return CHANT.length;
  return chant.key === key ? chant.step : 0;
}

function Game({ view, send, left, me, byN }: Ctx) {
  const step = useChant(`${view.round}:${view.phase}`, view.phase === 'reveal');
  const playing = view.players.filter((p) => view.playing.includes(p.n));
  const throwers = view.settings.mode === 'knockout' ? playing.filter((p) => view.alive.includes(p.n)) : playing;

  const strip = (
    <div className="pt-fingers">
      {playing.map((p) => {
        const out = view.settings.mode === 'knockout' && !view.alive.includes(p.n);
        return (
          <span key={p.n} className={`pt-finger${out ? ' is-out' : ''}${p.you ? ' is-you' : ''}`}>
            <Dot p={p} size={28} />
            {view.settings.mode === 'points' ? `${view.points[String(p.n)] ?? 0}/${view.settings.target}` : out ? '💥' : '✊'}
          </span>
        );
      })}
    </div>
  );

  if (view.phase === 'result') {
    const winners = view.winners.map((n) => byN(n)).filter((p) => !!p);
    return (
      <section className="pt-panel pt-imp-result">
        <h2>{winners.length === 1 ? (winners[0]!.you ? '🏆 You win!' : `🏆 ${winners[0]!.name} wins!`) : winners.length ? `🏆 ${winners.map((p) => p.name).join(' & ')} share it!` : 'Game over'}</h2>
        {view.last && <Hands view={view} byN={byN} />}
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

  if (view.phase === 'throw') {
    return (
      <>
        {strip}
        {view.throwing ? (
          <section className="pt-panel pt-center pt-rps">
            <h2>{view.myThrow ? 'Locked in. Change your mind?' : 'Throw in secret'}</h2>
            <div className="pt-rps-hands">
              {HANDS.map((h) => (
                <button key={h} className={`pt-rps-hand${view.myThrow === h ? ' is-on' : ''}`} aria-pressed={view.myThrow === h} aria-label={h} onClick={() => send({ t: 'throw', hand: h })}>
                  {EMOJI[h]}
                </button>
              ))}
            </div>
            <Clock left={left} />
          </section>
        ) : (
          <p className="pt-panel pt-center">{view.playing.includes(me.n) ? '💥 You’re out. Watch who’s left!' : 'You joined mid-game: you’re in from the next one.'}</p>
        )}
        <Waiting players={throwers} label="Thrown" />
      </>
    );
  }

  // reveal
  const last = view.last;
  return (
    <>
      {strip}
      <section className="pt-panel pt-center pt-rps">
        {step < CHANT.length ? (
          <p key={step} className="pt-rps-chant">
            ✊ {CHANT[step]}
          </p>
        ) : (
          last && (
            <>
              <Hands view={view} byN={byN} />
              <h2>
                {last.draw
                  ? '🤝 Draw! Throw again'
                  : view.settings.mode === 'knockout'
                    ? `💥 Out: ${last.out.map((n) => (byN(n)?.you ? 'you' : byN(n)?.name)).join(', ')}`
                    : `${Object.values(last.gained).some((g) => g > 0) ? 'Points!' : 'No points this time'}`}
              </h2>
            </>
          )
        )}
        <Clock left={left} />
      </section>
    </>
  );
}

function Hands({ view, byN }: { view: RoomView; byN: Ctx['byN'] }) {
  const last = view.last!;
  return (
    <div className="pt-rps-all">
      {Object.entries(last.throws).map(([n, h]) => {
        const p = byN(Number(n));
        if (!p) return null;
        const out = last.out.includes(p.n);
        return (
          <span key={n} className={`pt-rps-throw${out ? ' is-out' : ''}`} style={{ ['--pc' as string]: seatColor(p.n) }}>
            <b aria-label={h}>{EMOJI[h]}</b>
            <small>
              {p.you ? 'You' : p.name}
              {view.auto.includes(p.n) ? ' 🎲' : ''}
              {last.gained[n] ? ` +${last.gained[n]}` : ''}
            </small>
          </span>
        );
      })}
    </div>
  );
}
