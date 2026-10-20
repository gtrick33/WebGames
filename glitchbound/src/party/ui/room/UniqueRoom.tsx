import { useState } from 'react';
import { tNodes } from '../shared';
import { CLOCKS, MIN_PLAYERS, type Action, type Clue, type RoomView } from '../../rooms/uniqueRoom';
import { rating } from '../../unique';
import { OUT_TEXT } from '../Unique';
import { Clock, Dot, RoomFrame, Scores, Waiting, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';

type Ctx = RoomContext<RoomView, Action>;

export function UniqueRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'One of a Kind', emoji: '🦄', invite: 'Join my One of a Kind room: one-word clues on our own phones, and matching clues cancel out.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'lobby' ? undefined : t('🃏 {n} left · ✅ {score}', { n: v.cardsLeft, score: v.score }))}
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
      <h3>{t('How it works')}</h3>
      <p className="pt-muted">
        {tNodes(
          'You all play together against a deck of {n} cards. Each round one player guesses, and everyone else secretly types {word} on their own phone. {cancel} before the guesser sees them. Right: +1. Pass: lose the card. Wrong: lose the card and the next one too.',
          { n: view.deck },
          { word: <b>{t('one word')}</b>, cancel: <b>{t('Matching clues cancel out')}</b> },
        )}
      </p>
      <p className="pt-label">{t('Time to write a clue')}</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={view.settings.clock === c} onClick={() => send({ t: 'settings', settings: { clock: c } })}>
            ⏱ {c}s
          </button>
        ))}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Start')}
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
          {t('{n} of {total}', { n: view.score, total: view.deck })}: {t(rating(view.score))}
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

  const who = guesser && (
    <p className="pt-dl-reader">
      <Dot p={guesser} size={30} /> {iGuess ? t('You’re guessing') : t('{name} is guessing', { name: guesser.name })}
    </p>
  );

  if (view.phase === 'write') {
    return (
      <>
        {who}
        {iGuess ? (
          <section className="pt-panel pt-center">
            <h2>{t('Your friends are writing clues')}</h2>
            <p className="pt-muted">{t('Matching clues cancel out, so you only see the ones nobody else thought of.')}</p>
          </section>
        ) : (
          <WriteClue key={`${view.card}:${view.word}`} {...ctx} />
        )}
        <Clock left={left} />
        <Waiting players={givers} label={t('Clues in')} />
        {view.host && (
          <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
            {t('Check the clues now')}
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
            <p className="pt-kicker">{t('The word is')}</p>
            <p className="pt-ok-word">{view.word}</p>
            {view.clues && <ClueList clues={view.clues} byN={byN} />}
            <p className="pt-muted">{view.clues?.every((c) => c.out) ? t('Every clue cancelled out! {name} gets nothing to go on.', { name: guesser?.name ?? t('The guesser') }) : t('Crossed-out clues are hidden from {name}. No hints out loud!', { name: guesser?.name ?? t('the guesser') })}</p>
            {view.host && guesser && !guesser.online && (
              <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
                {t('{name} has gone: skip this card', { name: guesser.name })}
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
      <p className="pt-kicker">{t('The word was')}</p>
      <p className="pt-ok-word">{view.word}</p>
      <p className="pt-ok-verdict">
        {view.outcome === 'right'
          ? iGuess
            ? t('✅ You got it!')
            : t('✅ {name} got it!', { name: guesser?.name ?? '' })
          : view.outcome === 'pass'
            ? iGuess
              ? t('⏭️ You passed')
              : t('⏭️ {name} passed', { name: guesser?.name ?? t('The guesser') })
            : t('❌ “{guess}” was wrong: two cards gone', { guess: view.guess ?? '' })}
      </p>
      {view.clues && <ClueList clues={view.clues} byN={byN} />}
      <Clock left={left} />
      {view.host && (
        <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'next' })}>
          {view.cardsLeft <= 0 ? t('See the score') : t('Next card ({n} left)', { n: view.cardsLeft })}
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
        <p className="pt-kicker">{t('The word is')}</p>
        <p className="pt-ok-word">{view.word}</p>
        <p className="pt-muted">{t('You joined mid-game: you write clues from the next card.')}</p>
      </section>
    );
  const submit = (): void => {
    if (!draft.trim()) return;
    send({ t: 'clue', text: draft });
    setDraft('');
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">{t('The word for {name} is', { name: guesser?.name ?? t('the guesser') })}</p>
      <p className="pt-ok-word">{view.word}</p>
      {view.myClue ? (
        <p className="pt-ok-verdict">
          {t('Your clue:')}{' '}<b>{view.myClue}</b> ✓
        </p>
      ) : null}
      <label className="pt-ok-label" htmlFor="ok-room-clue">
        {view.myClue ? t('Change your mind?') : t('Your one-word clue')}
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
        placeholder={t('One word')}
      />
      <p className="pt-muted">{t('Matching clues cancel each other out, so be helpful and a little original. Keep it secret!')}</p>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()} onClick={submit}>
        {view.myClue ? t('Swap my clue') : t('Lock in my clue')}
      </button>
      {view.canSwap && (
        <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'swap' })}>
          {t('Don’t know this word? Another one')}
        </button>
      )}
    </section>
  );
}

function MakeGuess({ view, send }: Ctx) {
  const [guess, setGuess] = useState('');
  const shown = view.clues ?? [];
  const twins = view.cancelled?.twins ?? 0;
  const other = view.cancelled?.other ?? 0;
  const submit = (): void => {
    if (guess.trim()) send({ t: 'guess', text: guess });
  };
  return (
    <section className="pt-panel">
      <p className="pt-kicker">{t('Your clues:')}</p>
      {shown.length ? (
        <ul className="pt-ok-shown">
          {shown.map((c) => (
            <li key={c.n}>{c.clue}</li>
          ))}
        </ul>
      ) : (
        <p className="pt-muted">{t('No clues survived. Take a wild guess, or pass.')}</p>
      )}
      {(twins > 0 || other > 0) && (
        <p className="pt-muted">
          {twins > 0 && (twins === 1 ? t('1 matching clue cancelled out.') : t('{n} matching clues cancelled out.', { n: twins }))}
          {twins > 0 && other > 0 && ' '}
          {other > 0 && (other === 1 ? t('1 was removed (empty, or too close to the word).') : t('{n} were removed (empty, or too close to the word).', { n: other }))}
        </p>
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
        placeholder={t('Your guess')}
        aria-label={t('Your guess')}
      />
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!guess.trim()} onClick={submit}>
        {t('Guess')}
      </button>
      <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'pass' })}>
        {t('Pass (lose only this card)')}
      </button>
    </section>
  );
}
