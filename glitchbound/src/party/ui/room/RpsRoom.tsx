import { useEffect, useState } from 'react';
import { HANDS, MIN_PLAYERS, TARGETS, THROW_SECONDS, type Action, type RoomView } from '../../rooms/rpsRoom';
import { RpsHand } from '../RpsHand';
import { Dot, RoomFrame, Scores, seatColor, Waiting, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';

type Ctx = RoomContext<RoomView, Action>;
const CHANT = ['Rock…', 'Paper…', 'Scissors…', 'Shoot!'];

/** How long everyone has been waiting this throw (m:ss), counting up: no countdown to rush anyone. */
function WaitTimer({ left, waitingFor }: { left: number | null; waitingFor: string[] }) {
  if (left === null) return null;
  const s = Math.max(0, THROW_SECONDS - left);
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <p className="pt-rps-wait" role="timer">
      ⏱ <b>{time}</b>
      {waitingFor.length > 0 && <span> · {t('waiting for {names}', { names: waitingFor.join(', ') })}</span>}
    </p>
  );
}

export function RpsRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Rock Paper Scissors', emoji: '✊', invite: 'Rock Paper Scissors on our own phones: everyone throws at once. Last hand standing wins.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.round && v.phase !== 'lobby' ? t('Throw {n}', { n: v.round }) : undefined)}
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
      <div className="pt-seg" role="radiogroup" aria-label={t('Mode')}>
        <button role="radio" aria-checked={s.mode === 'knockout'} onClick={() => send({ t: 'settings', settings: { mode: 'knockout' } })}>
          {t('🥊 Last hand standing')}
          <small>{t('The losing hand is out')}</small>
        </button>
        <button role="radio" aria-checked={s.mode === 'points'} onClick={() => send({ t: 'settings', settings: { mode: 'points' } })}>
          {t('🏁 Points race')}
          <small>{t('A point per player you beat')}</small>
        </button>
      </div>
      {s.mode === 'points' && (
        <>
          <p className="pt-label">{t('Points to win')}</p>
          <div className="pt-seg" role="radiogroup">
            {TARGETS.map((t) => (
              <button key={t} role="radio" aria-checked={s.target === t} onClick={() => send({ t: 'settings', settings: { target: t } })}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="pt-muted">{t('Everyone throws in secret on their own phone, then all hands are revealed together. No rush: a timer shows how long everyone has waited. After a minute, or if your phone dropped out, a random hand is thrown for you (away for more than 30 seconds counts as leaving).')}</p>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Start')}
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
          <span key={p.n} className={`pt-finger${out ? ' is-out' : ''}${p.you ? ' is-you' : ''}`} title={!p.online && !out ? t('{name} dropped out: a random hand is thrown for them', { name: p.name }) : undefined}>
            <Dot p={p} size={28} />
            {view.settings.mode === 'points' ? `${view.points[String(p.n)] ?? 0}/${view.settings.target}` : out ? '💥' : <RpsHand hand="rock" size={22} bare />}
            {!p.online && !out && ' 💤'}
          </span>
        );
      })}
    </div>
  );

  if (view.phase === 'result') {
    const winners = view.winners.map((n) => byN(n)).filter((p) => !!p);
    return (
      <section className="pt-panel pt-imp-result">
        <h2>{winners.length === 1 ? (winners[0]!.you ? t('🏆 You win!') : t('🏆 {name} wins!', { name: winners[0]!.name })) : winners.length ? t('🏆 {names} share it!', { names: winners.map((p) => p.name).join(' & ') }) : t('Game over')}</h2>
        {view.settings.mode === 'points' && strip}
        {view.last && <Hands view={view} byN={byN} />}
        <Scores players={view.players} />
        {view.host ? (
          <div className="pt-row">
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'start' })}>
              {t('Play again')}
            </button>
            <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
              {t('Settings')}
            </button>
          </div>
        ) : (
          <p className="pt-muted pt-center">{t('The host starts the next game.')}</p>
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
            <h2>{view.myThrow ? t('Locked in. Change your mind?') : t('Throw in secret')}</h2>
            <div className="pt-rps-hands">
              {HANDS.map((h) => (
                <button key={h} className={`pt-rps-hand${view.myThrow === h ? ' is-on' : ''}`} aria-pressed={view.myThrow === h} onClick={() => send({ t: 'throw', hand: h })}>
                  <RpsHand hand={h} size={76} />
                </button>
              ))}
            </div>
            <WaitTimer left={left} waitingFor={throwers.filter((p) => !p.done && !p.you).map((p) => p.name)} />
          </section>
        ) : (
          <section className="pt-panel pt-center">
            <p>{view.playing.includes(me.n) ? t('💥 You’re out. Watch who’s left!') : t('You joined mid-game: you’re in from the next one.')}</p>
            <WaitTimer left={left} waitingFor={throwers.filter((p) => !p.done).map((p) => p.name)} />
          </section>
        )}
        <Waiting players={throwers} label={t('Thrown')} />
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
            <RpsHand hand="rock" size={52} /> {CHANT[step]}
          </p>
        ) : (
          last && (
            <>
              <Hands view={view} byN={byN} />
              <h2>
                {last.draw
                  ? t('🤝 Draw! Throw again')
                  : view.settings.mode === 'knockout'
                    ? t('💥 Out: {names}', { names: last.out.map((n) => (byN(n)?.you ? t('you') : byN(n)?.name)).join(', ') })
                    : Object.values(last.gained).some((g) => g > 0)
                      ? t('Points!')
                      : t('No points this time')}
              </h2>
              {view.auto.length > 0 && <p className="pt-muted">{t('🎲 Took over a minute (or 💤 dropped out): a random hand was thrown')}</p>}
            </>
          )
        )}
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
            <b>
              <RpsHand hand={h} size={56} />
            </b>
            <small>
              {p.you ? t('You') : p.name}
              {view.auto.includes(p.n) ? ' 🎲' : ''}
              {last.gained[n] ? ` +${last.gained[n]}` : ''}
            </small>
          </span>
        );
      })}
    </div>
  );
}
