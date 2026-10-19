import { useState } from 'react';
import { CLOCKS, MIN_PLAYERS, type Action, type Clue, type RoomView } from '../../rooms/uniqueRoom';
import { rating } from '../../unique';
import { OUT_TEXT } from '../Unique';
import { Clock, Dot, RoomFrame, Scores, Waiting, type RoomContext } from './RoomFrame';

type Ctx = RoomContext<RoomView, Action>;

export function UniqueRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'One of a Kind', emoji: '🦄', invite: 'Join my One of a Kind room: one-word clues on our own phones, and matching clues cancel out.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'lobby' ? undefined : `🃏 ${v.cardsLeft} left · ✅ ${v.score}`)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const online = view.players.filter((p) => p.online).length;
  return (
    <>
      <h3>How it works</h3>
      <p className="pt-muted">
        You all play together against a deck of {view.deck} cards. Each round one player guesses, and everyone else secretly types <b>one word</b> on their own phone. <b>Matching clues cancel out</b> before the guesser sees them. Right: +1. Pass: lose the
        card. Wrong: lose the card and the next one too.
      </p>
      <p className="pt-label">Time to write a clue</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={view.settings.clock === c} onClick={() => send({ t: 'settings', settings: { clock: c } })}>
            ⏱ {c}s
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        Start
      </button>
    </>
  );
}

function ClueList({ clues, byN }: { clues: Clue[]; byN: Ctx['byN'] }) {
  return (
    <ul className="pt-ok-clues">
      {clues.map((c) => {
        const p = byN(c.n);
        return (
          <li key={c.n} className={c.out ? 'is-out' : ''}>
            {p && <Dot p={p} size={26} />} <b>{c.clue || '–'}</b> {c.out && <small>{OUT_TEXT[c.out]}</small>}
          </li>
        );
      })}
    </ul>
  );
}

function Game(ctx: Ctx) {
  const { view, send, left, me, byN } = ctx;
  const guesser = byN(view.guesser);
  const givers = view.players.filter((p) => view.playing.includes(p.n) && p.n !== view.guesser && p.online);
  const iGuess = view.guesser === me.n;

  if (view.phase === 'result') {
    return (
      <section className="pt-panel pt-imp-result">
        <h2>
          {view.score} of {view.deck}: {rating(view.score)}
        </h2>
        <ul className="pt-ok-history">
          {view.history.map((h, i) => (
            <li key={i}>
              {h.outcome === 'right' ? '✅' : h.outcome === 'pass' ? '⏭️' : '❌'} {h.word}
            </li>
          ))}
        </ul>
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

  const who = guesser && (
    <p className="pt-dl-reader">
      <Dot p={guesser} size={30} /> {iGuess ? 'You’re guessing' : `${guesser.name} is guessing`}
    </p>
  );

  if (view.phase === 'write') {
    return (
      <>
        {who}
        {iGuess ? (
          <section className="pt-panel pt-center">
            <h2>Your friends are writing clues</h2>
            <p className="pt-muted">Matching clues cancel out, so you only see the ones nobody else thought of.</p>
          </section>
        ) : (
          <WriteClue key={`${view.card}:${view.word}`} {...ctx} />
        )}
        <Clock left={left} />
        <Waiting players={givers} label="Clues in" />
        {view.host && (
          <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
            Check the clues now
          </button>
        )}
      </>
    );
  }

  if (view.phase === 'guess') {
    return (
      <>
        {who}
        {iGuess ? (
          <MakeGuess key={view.card} {...ctx} />
        ) : (
          <section className="pt-panel">
            <p className="pt-kicker">The word is</p>
            <p className="pt-ok-word">{view.word}</p>
            {view.clues && <ClueList clues={view.clues} byN={byN} />}
            <p className="pt-muted">{view.clues?.every((c) => c.out) ? `Every clue cancelled out! ${guesser?.name ?? 'The guesser'} gets nothing to go on.` : `Crossed-out clues are hidden from ${guesser?.name ?? 'the guesser'}. No hints out loud!`}</p>
            {view.host && guesser && !guesser.online && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                {guesser.name} has gone: skip this card
              </button>
            )}
          </section>
        )}
        <Clock left={left} />
      </>
    );
  }

  // verdict
  return (
    <section className="pt-panel pt-ok-result">
      <p className="pt-kicker">The word was</p>
      <p className="pt-ok-word">{view.word}</p>
      <p className="pt-ok-verdict">
        {view.outcome === 'right'
          ? `✅ ${iGuess ? 'You' : guesser?.name} got it!`
          : view.outcome === 'pass'
            ? `⏭️ ${iGuess ? 'You' : (guesser?.name ?? 'The guesser')} passed`
            : `❌ “${view.guess}” was wrong: two cards gone`}
      </p>
      {view.clues && <ClueList clues={view.clues} byN={byN} />}
      <Clock left={left} />
      {view.host && (
        <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'next' })}>
          {view.cardsLeft <= 0 ? 'See the score' : `Next card (${view.cardsLeft} left)`}
        </button>
      )}
    </section>
  );
}

function WriteClue({ view, send, byN }: Ctx) {
  const [draft, setDraft] = useState('');
  const guesser = byN(view.guesser);
  if (!view.playing.includes(view.you))
    return (
      <section className="pt-panel pt-center">
        <p className="pt-kicker">The word is</p>
        <p className="pt-ok-word">{view.word}</p>
        <p className="pt-muted">You joined mid-game: you write clues from the next card.</p>
      </section>
    );
  const submit = (): void => {
    if (!draft.trim()) return;
    send({ t: 'clue', text: draft });
    setDraft('');
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">The word for {guesser?.name ?? 'the guesser'} is</p>
      <p className="pt-ok-word">{view.word}</p>
      {view.myClue ? (
        <p className="pt-ok-verdict">
          Your clue: <b>{view.myClue}</b> ✓
        </p>
      ) : null}
      <label className="pt-ok-label" htmlFor="ok-room-clue">
        {view.myClue ? 'Change your mind?' : 'Your one-word clue'}
      </label>
      <input
        id="ok-room-clue"
        className="pt-input"
        value={draft}
        maxLength={24}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="send"
        onChange={(e) => setDraft(e.target.value.replace(/\s/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="One word"
      />
      <p className="pt-muted">Matching clues cancel each other out, so be helpful and a little original. Keep it secret!</p>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()} onClick={submit}>
        {view.myClue ? 'Swap my clue' : 'Lock in my clue'}
      </button>
      {view.canSwap && (
        <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'swap' })}>
          Don’t know this word? Another one
        </button>
      )}
    </section>
  );
}

function MakeGuess({ view, send }: Ctx) {
  const [guess, setGuess] = useState('');
  const shown = view.clues ?? [];
  const submit = (): void => {
    if (guess.trim()) send({ t: 'guess', text: guess });
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">Your clues:</p>
      {shown.length ? (
        <ul className="pt-ok-shown">
          {shown.map((c) => (
            <li key={c.n}>{c.clue}</li>
          ))}
        </ul>
      ) : (
        <p className="pt-muted">No clues survived. Take a wild guess, or pass.</p>
      )}
      <input
        className="pt-input"
        value={guess}
        maxLength={30}
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Your guess"
        aria-label="Your guess"
      />
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!guess.trim()} onClick={submit}>
        Guess
      </button>
      <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'pass' })}>
        Pass (lose only this card)
      </button>
    </section>
  );
}
