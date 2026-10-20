import { useEffect, useRef, useState } from 'react';
import { tNodes } from '../shared';
import { dialVerdict, splitTeams } from '../../dial';
import { CLOCKS, CLUE_MAX, LAPS, MIN_PLAYERS, TEAM_MIN, type Action, type RoomView } from '../../rooms/dialRoom';
import { Tuner } from '../Dial';
import { Clock, Dot, RoomFrame, Scores, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';

type Ctx = RoomContext<RoomView, Action>;
const TEAM = ['🔵 Team Blue', '🟠 Team Orange'] as const;
/** Needle moves go out at most this often while dragging (the last one always goes). */
const SEND_EVERY = 150;
/** How long your own drag wins over the room's needle after you let go (the echo is on its way). */
const HOLD_MS = 700;

export function DialRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Dial It In', emoji: '📻', invite: 'Join my Dial It In room: one clue, and we all turn the needle on our own phones.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'lobby' || v.phase === 'result' ? undefined : `${v.count}/${v.total}`)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const s = view.settings;
  const here = view.players.filter((p) => p.online);
  const set = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  const teams = s.teams && here.length >= TEAM_MIN;
  return (
    <>
      <h3>{t('How it works')}</h3>
      <p className="pt-muted">
        {tNodes('Each round one player is the {reader}. Only their phone shows where the secret spot is on a scale, like {scale}. They type {clue} (“a cup of tea”), and everyone else turns the same needle on their own phone. Spot on scores 4, close scores 3 or 2.', {}, { reader: <b>{t('reader')}</b>, scale: <i>{t('Cold ↔ Hot')}</i>, clue: <b>{t('one clue')}</b> })}
      </p>
      {here.length >= TEAM_MIN && (
        <label className="pt-switch">
          <input type="checkbox" checked={s.teams} onChange={(e) => set({ teams: e.target.checked })} />
          <span>
            <b>{t('Two teams')}</b>{' '}{t('· readers take turns across teams, and the other team’s captain can steal a point by calling “left” or “right”')}
          </span>
        </label>
      )}
      {teams && (
        <div className="pt-dl-teams">
          {splitTeams(here).map((side, t) => (
            <p key={t}>
              <b>{TEAM[t]}:</b> {side.map((p) => p.name).join(', ')}
            </p>
          ))}
        </div>
      )}
      <div className="pt-picker" role="group" aria-label={t('Rounds')}>
        {LAPS.map((k) => (
          <button key={k} className={`pt-chip${s.laps === k ? ' is-on' : ''}`} aria-pressed={s.laps === k} onClick={() => set({ laps: k })}>
            {k === 1 ? t('Everyone reads once') : t('Everyone reads {n}×', { n: k })} ({t('{n} rounds', { n: here.length * k })})
          </button>
        ))}
      </div>
      <p className="pt-label">{t('Time to turn the needle')}</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={s.clock === c} onClick={() => set({ clock: c })}>
            ⏱ {c}s
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={here.length < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Start')}
      </button>
    </>
  );
}

/**
 * The shared needle on this phone: your own drag shows straight away and goes to the room a few times
 * a second; otherwise it follows whoever moved it last.
 */
function useNeedle(room: number, send: Ctx['send']): [number, (at: number) => void] {
  const [mine, setMine] = useState<number | null>(null);
  const last = useRef(0);
  const queued = useRef<number | null>(null);
  const flushT = useRef(0);
  const holdT = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(flushT.current);
      window.clearTimeout(holdT.current);
    },
    [],
  );
  const move = (at: number): void => {
    setMine(at);
    queued.current = at;
    const flush = (): void => {
      if (queued.current === null) return;
      last.current = Date.now();
      send({ t: 'needle', at: queued.current });
      queued.current = null;
    };
    window.clearTimeout(flushT.current);
    const wait = SEND_EVERY - (Date.now() - last.current);
    if (wait <= 0) flush();
    else flushT.current = window.setTimeout(flush, wait);
    window.clearTimeout(holdT.current);
    holdT.current = window.setTimeout(() => setMine(null), wait + HOLD_MS);
  };
  return [mine ?? room, move];
}

function Game({ view, send, left, me, byN }: Ctx) {
  const round = view.round;
  const [needle, move] = useNeedle(round?.needle ?? 50, send);
  const [draft, setDraft] = useState('');
  const sides = view.sides;
  const teamOf = (n: number): 0 | 1 | null => (sides ? (sides[0].includes(n) ? 0 : sides[1].includes(n) ? 1 : null) : null);

  if (view.phase === 'result' || !round) {
    const best = [...view.players].sort((a, b) => (view.points[String(b.n)] ?? 0) - (view.points[String(a.n)] ?? 0))[0];
    const bestPts = best ? (view.points[String(best.n)] ?? 0) : 0;
    const sum = Object.values(view.points).reduce((a, b) => a + b, 0);
    const [blue, orange] = view.team;
    return (
      <section className="pt-panel pt-imp-result">
        <h2>{sides ? (blue === orange ? t('A perfect tie! {n} each', { n: blue }) : t('🏆 {team} wins, {a} to {b}!', { team: t(TEAM[blue > orange ? 0 : 1]), a: Math.max(blue, orange), b: Math.min(blue, orange) })) : t('The room scored {n} of {total}', { n: sum, total: view.total * 4 })}</h2>
        {best && bestPts > 0 && (
          <p className="pt-muted pt-center">
            {tNodes('📡 Mind Reader: {who}, whose clues earned {n}', { n: bestPts }, { who: <b>{best.you ? t('you') : best.name}</b> })}
          </p>
        )}
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

  const reader = byN(round.reader);
  const isReader = round.reader === me.n;
  const iGuess = round.guessers.includes(me.n);
  const readerTeam = teamOf(round.reader);
  const captain = byN(round.captain);
  const rivalCaptain = byN(round.rivalCaptain);
  const movedBy = byN(round.movedBy);
  const name = (p: typeof captain): string => (p ? (p.n === me.n ? 'you' : p.name) : 'someone');
  const sendClue = (): void => {
    if (!draft.trim()) return;
    send({ t: 'clue', text: draft });
    setDraft('');
  };

  return (
    <>
      {sides ? (
        <p className="pt-dl-score">
          🔵 {view.team[0]} · 🟠 {view.team[1]}
          {teamOf(me.n) !== null && <small className="pt-muted"> · {t('you’re {team}', { team: t(TEAM[teamOf(me.n)!]) })}</small>}
        </p>
      ) : null}
      {reader && (
        <p className="pt-dl-reader">
          <Dot p={reader} size={30} /> {isReader ? t('You’re the reader') : t('{name} is the reader', { name: reader.name })}
          {readerTeam !== null && ` · ${t(TEAM[readerTeam])}`}
        </p>
      )}
      {round.clue && (
        <p className="pt-room-clue" aria-label={t('The clue')}>
          “{round.clue}”
        </p>
      )}
      <Tuner
        scale={round.scale}
        target={round.target ?? 50}
        guess={iGuess && view.phase === 'guess' ? needle : round.needle}
        showTarget={round.target !== null}
        showNeedle={view.phase !== 'clue'}
        movable={iGuess && view.phase === 'guess'}
        onMove={move}
      />

      {view.phase === 'clue' &&
        (isReader ? (
          <section className="pt-actions">
            <p className="pt-muted">
              {tNodes('Only you can see the spot. Type {clue} for it between {a} and {b}: a thing, a person, a saying. No numbers!', {}, { clue: <b>{t('one clue')}</b>, a: <b>{round.scale[0]}</b>, b: <b>{round.scale[1]}</b> })}
            </p>
            <input
              className="pt-input"
              value={draft}
              maxLength={CLUE_MAX}
              autoComplete="off"
              enterKeyHint="send"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendClue()}
              placeholder={t('Your clue')}
              aria-label={t('Your clue')}
            />
            <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()} onClick={sendClue}>
              {t('Send my clue')}
            </button>
          </section>
        ) : (
          <section className="pt-actions">
            <p className="pt-muted">{t('{name} is thinking of a clue…', { name: reader?.name ?? t('The reader') })}</p>
            {view.host && reader && !reader.online && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                {t('{name} has gone: skip this round', { name: reader.name })}
              </button>
            )}
          </section>
        ))}

      {view.phase === 'guess' && (
        <section className="pt-actions">
          {iGuess ? (
            <>
              <p className="pt-muted">{t('Drag the needle together: whoever moves it last decides.')} {round.captain === me.n ? t('You’re the captain: lock it in when you agree.') : t('{name} locks it in.', { name: name(captain) })}</p>
              {round.captain === me.n && (
                <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'lock' })}>
                  {t('Lock in the needle')}
                </button>
              )}
            </>
          ) : isReader ? (
            <p className="pt-muted">{sides ? t('Your team is tuning in. No hints!') : t('Everyone is tuning in. No hints!')}</p>
          ) : (
            <p className="pt-muted">{readerTeam !== null ? t('{team} is tuning in. Get ready to call left or right!', { team: t(TEAM[readerTeam]) }) : t('You joined mid-game: you’re in from the next round.')}</p>
          )}
          {movedBy && <p className="pt-dl-moved">{t('Needle last moved by {name}', { name: name(movedBy) })}</p>}
        </section>
      )}

      {view.phase === 'steal' && (
        <section className="pt-actions">
          {round.rivalCaptain === me.n ? (
            <>
              <p className="pt-muted">
                {tNodes('Steal a point: is the secret spot to the {left} or the {right} of the needle?', {}, { left: <b>{t('left')}</b>, right: <b>{t('right')}</b> })}
              </p>
              <div className="pt-row">
                <button className="pt-btn pt-btn-big" onClick={() => send({ t: 'call', side: 'left' })}>
                  {t('◀ Left')}
                </button>
                <button className="pt-btn pt-btn-big" onClick={() => send({ t: 'call', side: 'right' })}>
                  {t('Right ▶')}
                </button>
              </div>
            </>
          ) : (
            <p className="pt-muted">
              {readerTeam !== null && teamOf(me.n) === 1 - readerTeam ? t('Left or right of the needle? Tell {name}, your captain makes the call.', { name: name(rivalCaptain) }) : t('{name} is calling left or right for a steal point…', { name: name(rivalCaptain) })}
            </p>
          )}
        </section>
      )}

      {view.phase === 'reveal' && (
        <section className="pt-actions">
          <p className="pt-dl-verdict">
            {round.clue ? (
              <>
                {dialVerdict(round.points ?? 0)} <b>+{round.points ?? 0}</b>
              </>
            ) : (
              t('⏱ No clue in time: no points')
            )}
            {sides && round.call && (round.steal ? t(' · steal! +1') : t(' · no steal'))}
          </p>
          {view.host && (
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'next' })}>
              {view.count >= view.total ? t('See the results') : t('Next round')}
            </button>
          )}
        </section>
      )}
      <Clock left={left} />
    </>
  );
}
