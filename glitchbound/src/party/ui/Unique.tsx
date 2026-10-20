import { useState } from 'react';
import { MYSTERY_WORDS } from '../content/mystery';
import { draw, freshRng } from '../engine';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { DECK, rating, type ClueCheck } from '../unique';
import { Avatar, ModeBar, Name, Results, useSavedGame, tNodes } from './shared';
import { t } from '../../i18n';

/** Why a clue was struck out (the live room shows these). */
export const OUT_TEXT: Record<NonNullable<ClueCheck['out']>, string> = { twin: 'same as another clue', 'gives-it-away': 'gives the word away', empty: 'no clue' };

type Stage = 'setup' | 'look' | 'word' | 'clues' | 'result' | 'done';
type Outcome = 'right' | 'wrong' | 'pass';

/**
 * One of a Kind on one phone, played together against a 13-card deck. The phone only deals the
 * words: everyone but the guesser looks at the word, the clues happen out loud at the table (matching
 * clues are struck out before the guesser hears them), and the guesser gets one try. A wrong guess
 * also burns the next card. The live room version types clues on each phone instead.
 */
interface Game {
  stage: Stage;
  used: string[];
  turn: number;
  cardsLeft: number;
  score: number;
  word: string;
  outcome: Outcome | null;
  history: { word: string; outcome: Outcome }[];
}

export function UniqueMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const players = session.players;
  const [r] = useState(freshRng);
  const [game, set] = useSavedGame<Game>(session, update, 'unique', () => ({ stage: 'setup', used: session.used.unique ?? [], turn: 0, cardsLeft: DECK, score: 0, word: '', outcome: null, history: [] }), 'unique');
  const { stage, turn, cardsLeft, score, word, outcome, history } = game;
  const guesser: Player = players[turn % players.length]!;

  const newWord = (seen: string[]): Pick<Game, 'word' | 'used'> => {
    const d = draw(
      MYSTERY_WORDS.map((w) => ({ id: w })),
      seen,
      r,
    );
    return { word: d.item?.id ?? MYSTERY_WORDS[0]!, used: d.used };
  };
  // Draws happen outside the state updaters (React may run an updater twice in development).
  const start = (): void => set({ turn: 0, cardsLeft: DECK, score: 0, history: [], ...newWord(game.used), stage: 'look' });
  const judge = (o: Outcome): void =>
    set((g) => ({
      outcome: o,
      history: [...g.history, { word: g.word, outcome: o }],
      score: g.score + (o === 'right' ? 1 : 0),
      cardsLeft: Math.max(0, g.cardsLeft - (o === 'wrong' ? 2 : 1)),
      stage: 'result',
    }));
  const next = (): void => set(cardsLeft <= 0 ? { stage: 'done' } : { turn: turn + 1, ...newWord(game.used), stage: 'look' });
  const setStage = (st: Stage): void => set({ stage: st });

  if (players.length < 3) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('One of a Kind')} onExit={onExit} />
        <div className="pt-panel">
          <p className="pt-muted">{t('One of a Kind needs at least 3 players: one guesser and two or more clue givers (so clues can clash). Add a player in the party menu.')}</p>
          <button className="pt-btn pt-btn-big" onClick={onExit}>
            {t('Back to the party menu')}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'setup') {
    return (
      <div className="pt-screen">
        <ModeBar title={t('One of a Kind')} onExit={onExit} />
        <div className="pt-panel">
          <h3>{t('How it works')}</h3>
          <ol className="pt-ok-steps">
            <li>{t('Each round one player guesses. They look away while everyone else sees the secret word.')}</li>
            <li>
              {tNodes('Everyone else thinks of a {clue}. Compare them quietly first (whisper, or jot them down): {out}.', {}, { clue: <b>{t('one-word clue')}</b>, out: <b>{t('matching clues are out')}</b> })}
            </li>
            <li>{t('Say the clues that are left. The guesser gets one try.')}</li>
          </ol>
          <p className="pt-muted">
            {t('You all play together against a deck of {n} cards. Right: +1. Pass: lose that card. Wrong: lose that card and the next one too.', { n: DECK })}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            {t('Start')}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <Results title={`${t('{n} of {total}', { n: score, total: DECK })}: ${t(rating(score))}`} players={players} scores={Object.fromEntries(players.map((p) => [p.id, score]))} onAgain={() => setStage('setup')} onMenu={onExit}>
        <ul className="pt-ok-history">
          {history.map((h, i) => (
            <li key={i}>
              {h.outcome === 'right' ? '✅' : h.outcome === 'pass' ? '⏭️' : '❌'} {h.word}
            </li>
          ))}
        </ul>
      </Results>
    );
  }

  return (
    <div className="pt-screen">
      <ModeBar title={t('One of a Kind')} progress={t('🃏 {n} left · ✅ {score}', { n: cardsLeft, score })} onExit={onExit} />
      {stage === 'look' && (
        <div className="pt-panel pt-ok-look">
          <Avatar player={guesser} size={72} />
          <p className="pt-kicker">{t('This round’s guesser')}</p>
          <h2 className="pt-pass-name" style={{ color: guesser.color }}>
            {guesser.name}
          </h2>
          <p className="pt-muted">{t('{name}, look away or close your eyes. Everyone else, gather round the phone.', { name: guesser.name })}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('word')} autoFocus>
            {t('Show the word')}
          </button>
        </div>
      )}
      {stage === 'word' && (
        <div className="pt-panel">
          <p className="pt-kicker">
            {tNodes('The word for {who} is', {}, { who: <Name player={guesser} /> })}
          </p>
          <p className="pt-ok-word">{word}</p>
          <p className="pt-muted">{t('Think of a one-word clue. Matching clues will be struck out, so try to be helpful and a little original.')}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('clues')}>
            {t('Hide it · {name} can look', { name: guesser.name })}
          </button>
          <button className="pt-btn pt-btn-ghost" onClick={() => set(newWord(game.used))}>
            {t('Don’t know this word? Another one')}
          </button>
        </div>
      )}
      {stage === 'clues' && (
        <div className="pt-panel">
          <p className="pt-kicker">{t('Clue time')}</p>
          <ol className="pt-ok-steps">
            <li>{t('Clue givers: compare your clues quietly. Any that match are out.')}</li>
            <li>{t('Say the rest to {name}.', { name: guesser.name })}</li>
            <li>{t('{name} gets one guess.', { name: guesser.name })}</li>
          </ol>
          <p className="pt-muted">{t('How did it go?')}</p>
          <div className="pt-ok-judge">
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => judge('right')}>
              {t('✅ Got it')}
            </button>
            <button className="pt-btn pt-btn-big" onClick={() => judge('wrong')}>
              {t('❌ Wrong guess')}
            </button>
            <button className="pt-btn pt-btn-ghost" onClick={() => judge('pass')}>
              {t('⏭️ {name} passed', { name: guesser.name })}
            </button>
          </div>
        </div>
      )}
      {stage === 'result' && (
        <div className="pt-panel pt-ok-result">
          <p className="pt-kicker">{t('The word was')}</p>
          <p className="pt-ok-word">{word}</p>
          <p className="pt-ok-verdict">
            {outcome === 'right' ? t('✅ {name} got it! +1', { name: guesser.name }) : outcome === 'pass' ? t('⏭️ {name} passed: one card gone', { name: guesser.name }) : t('❌ Wrong: this card and the next one are gone')}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next} autoFocus>
            {cardsLeft <= 0 ? t('See the score') : t('Next card ({n} left)', { n: cardsLeft })}
          </button>
        </div>
      )}
    </div>
  );
}
