import { useState } from 'react';
import { cellHex, cueBonus, explainHues } from '../../hues';
import { CLOCKS, LAPS, MIN_PLAYERS, type Action, type RoomView } from '../../rooms/huesRoom';
import { Board, HueLegend, type BoardMark } from '../Hues';
import { Clock, Dot, RoomFrame, Scores, seatColor, Waiting, type RoomContext } from './RoomFrame';

type Ctx = RoomContext<RoomView, Action>;
type Round = NonNullable<RoomView['round']>;

export function HuesRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Hue Knew?', emoji: '🎨', invite: 'Join my Hue Knew? room: one-word colour clues, and everyone taps their guess on their own phone.', min: MIN_PLAYERS }}
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
  const here = view.players.filter((p) => p.online).length;
  const set = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  return (
    <>
      <h3>How it works</h3>
      <p className="pt-muted">
        Each round one player is the <b>cue giver</b>. They secretly pick one of four colours and describe it in <b>one word</b> (no colour names like “red” or “blue”: try “ketchup”). Everyone taps their guess on their own phone, and the
        guesses show together. The closer the colour looks, the more points; the cue giver scores for every close guess.
      </p>
      <label className="pt-switch">
        <input type="checkbox" checked={s.second} onChange={(e) => set({ second: e.target.checked })} />
        <span>
          <b>Second clue</b> · after the first guesses, the cue giver adds up to two more words and everyone guesses again
        </span>
      </label>
      <div className="pt-picker" role="group" aria-label="Rounds">
        {LAPS.map((k) => (
          <button key={k} className={`pt-chip${s.laps === k ? ' is-on' : ''}`} aria-pressed={s.laps === k} onClick={() => set({ laps: k })}>
            {k === 1 ? 'Everyone cues once' : `Everyone cues ${k}×`} ({here * k} rounds)
          </button>
        ))}
      </div>
      <p className="pt-label">Time to guess</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={s.clock === c} onClick={() => set({ clock: c })}>
            ⏱ {c}s
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={here < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        Start
      </button>
    </>
  );
}

function Game(ctx: Ctx) {
  const { view, send, left, me, byN } = ctx;
  const round = view.round;
  const toMarks = (marks: Record<string, number> | null): BoardMark[] =>
    Object.entries(marks ?? {}).map(([n, cell]) => ({ cell, glyph: (byN(Number(n))?.name ?? '?').slice(0, 1).toUpperCase(), color: seatColor(Number(n)) }));

  if (view.phase === 'result' || !round) {
    const ranked = [...view.players].filter((p) => view.playing.includes(p.n)).sort((a, b) => (view.points[String(b.n)] ?? 0) - (view.points[String(a.n)] ?? 0));
    const top = view.points[String(ranked[0]?.n)] ?? 0;
    const winners = ranked.filter((p) => (view.points[String(p.n)] ?? 0) === top);
    return (
      <section className="pt-panel pt-imp-result">
        <h2>{winners.length === 1 ? (winners[0]!.you ? '🏆 You have the best eye!' : `🏆 ${winners[0]!.name} has the best eye!`) : `🏆 A tie: ${winners.map((p) => p.name).join(' & ')}`}</h2>
        <Scores players={view.players} gained={view.points} />
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

  const cue = byN(round.cue);
  const isCue = round.cue === me.n;
  const iGuess = round.guessers.includes(me.n);
  const guessers = view.players.filter((p) => round.guessers.includes(p.n) && p.online);
  const who = cue && (
    <p className="pt-dl-reader">
      <Dot p={cue} size={30} /> {isCue ? 'You’re the cue giver' : `${cue.name} is the cue giver`}
    </p>
  );
  const clues = round.clue && (
    <p className="pt-room-clue" aria-label="The clue">
      “{round.clue}”{round.clue2 && <> + “{round.clue2}”</>}
    </p>
  );

  if (view.phase === 'pick') {
    return (
      <>
        {who}
        {isCue ? (
          <PickColour key={view.count} {...ctx} round={round} />
        ) : (
          <section className="pt-panel">
            <p className="pt-kicker">{cue?.name ?? 'The cue giver'} is picking a secret colour…</p>
            <Board target={null} marks={[]} />
            {view.host && cue && !cue.online && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                {cue.name} has gone: skip this round
              </button>
            )}
          </section>
        )}
        <Clock left={left} />
      </>
    );
  }

  if (view.phase === 'guess') {
    return (
      <>
        {who}
        {clues}
        {iGuess ? (
          <PlaceGuess key={`${view.count}:${round.pass}`} {...ctx} round={round} earlier={toMarks(round.marks)} />
        ) : (
          <section className="pt-panel">
            <p className="pt-kicker">{isCue ? 'Everyone is guessing. Guesses show when all are in.' : 'You joined mid-game: you guess from the next round.'}</p>
            <Board target={round.target} marks={toMarks(round.marks)} />
          </section>
        )}
        <Clock left={left} />
        <Waiting players={guessers} label="Guessed" />
        {view.host && (
          <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
            Show the guesses now
          </button>
        )}
      </>
    );
  }

  if (view.phase === 'clue2') {
    return (
      <>
        {who}
        {clues}
        {isCue ? (
          <SecondClue key={view.count} {...ctx} round={round} marks={toMarks(round.marks)} />
        ) : (
          <section className="pt-panel">
            <p className="pt-kicker">First guesses are in! {cue?.name ?? 'The cue giver'} may add a second clue (up to two words)…</p>
            <Board target={null} marks={toMarks(round.marks)} />
            {view.host && cue && !cue.online && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                {cue.name} has gone: show the colour
              </button>
            )}
          </section>
        )}
        <Clock left={left} />
      </>
    );
  }

  // reveal
  const players = view.players.filter((p) => view.playing.includes(p.n));
  return (
    <>
      {who}
      {clues}
      <section className="pt-panel">
        <p className="pt-kicker">{round.clue ? 'The colour was…' : '⏱ No clue in time: no points this round'}</p>
        <Board target={round.target} marks={[...toMarks(round.marks), ...toMarks(round.marks2)]} highlight />
        {round.clue && round.target !== null && <HueLegend />}
        <ul className="pt-hk-gains">
          {players.map((p) => {
            const cells = [round.marks?.[String(p.n)], round.marks2?.[String(p.n)]].filter((c): c is number => c !== undefined);
            const all = [...Object.values(round.marks ?? {}), ...Object.values(round.marks2 ?? {})];
            return (
              <li key={p.n}>
                <span className="pt-hk-who">
                  <Dot p={p} size={24} /> {p.name} <b>+{round.gained?.[String(p.n)] ?? 0}</b>
                  {p.n === round.cue ? ' (cue giver)' : ''}
                </span>
                {round.clue && round.target !== null && <small>{explainHues(round.target, cells, p.n === round.cue ? cueBonus(round.target, all) : null)}</small>}
              </li>
            );
          })}
        </ul>
        {view.host && (
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'next' })}>
            {view.count >= view.total ? 'See the results' : 'Next round'}
          </button>
        )}
      </section>
      <Clock left={left} />
    </>
  );
}

function PickColour({ send, round }: Ctx & { round: Round }) {
  const [draft, setDraft] = useState('');
  const offer = round.offer ?? [];
  const submit = (): void => {
    if (round.target !== null && draft.trim()) send({ t: 'clue', text: draft });
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">Pick your secret colour</p>
      <div className="pt-hk-offer">
        {offer.map((i, k) => (
          <button key={i} className={`pt-hk-swatch${round.target === i ? ' is-on' : ''}`} style={{ background: cellHex(i) }} onClick={() => send({ t: 'pick', cell: i })} aria-pressed={round.target === i} aria-label={`Colour ${k + 1}`} />
        ))}
      </div>
      {round.target !== null && (
        <>
          <Board target={round.target} marks={[]} highlight />
          <input
            className="pt-input"
            value={draft}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="send"
            onChange={(e) => setDraft(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="One word, no colour names"
            aria-label="Your one-word clue"
          />
        </>
      )}
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={round.target === null || !draft.trim()} onClick={submit}>
        {round.target === null ? 'Tap a colour' : 'Send my clue'}
      </button>
    </section>
  );
}

function PlaceGuess({ send, me, round, earlier }: Ctx & { round: Round; earlier: BoardMark[] }) {
  const [tap, setTap] = useState<number | null>(null);
  const mine = tap ?? round.myMark;
  return (
    <section className="pt-panel">
      <p className="pt-kicker">{round.pass === 2 ? 'Second clue: guess again!' : mine === null ? 'Tap your guess on the board' : 'Locked in. Tap again to change it until everyone is in.'}</p>
      <Board
        target={null}
        marks={earlier}
        pending={mine}
        pendingGlyph={me.name.slice(0, 1).toUpperCase()}
        pendingColor={seatColor(me.n)}
        onPick={(cell) => {
          setTap(cell);
          send({ t: 'mark', cell });
        }}
      />
    </section>
  );
}

function SecondClue({ send, round, marks }: Ctx & { round: Round; marks: BoardMark[] }) {
  const [draft, setDraft] = useState('');
  const submit = (): void => {
    if (draft.trim()) send({ t: 'clue', text: draft });
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">Here are the first guesses. Add a second clue?</p>
      <Board target={round.target} marks={marks} highlight />
      <input
        className="pt-input"
        value={draft}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="send"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Up to two words"
        aria-label="Your second clue"
      />
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()} onClick={submit}>
        Send my second clue
      </button>
      <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'done' })}>
        No second clue · show the colour
      </button>
    </section>
  );
}
