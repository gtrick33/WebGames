import { useState } from 'react';
import { MYSTERY_WORDS } from '../content/mystery';
import { draw, freshRng } from '../engine';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { DECK, rating, type ClueCheck } from '../unique';
import { Avatar, ModeBar, Name, Results } from './shared';

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
export function UniqueMode({ session, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const players = session.players;
  const [r] = useState(freshRng);
  const [stage, setStage] = useState<Stage>('setup');
  const [used, setUsed] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const [cardsLeft, setCardsLeft] = useState(DECK);
  const [score, setScore] = useState(0);
  const [word, setWord] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<{ word: string; outcome: Outcome }[]>([]);
  const guesser: Player = players[turn % players.length]!;

  const newWord = (seen: string[]): void => {
    const d = draw(
      MYSTERY_WORDS.map((w) => ({ id: w })),
      seen,
      r,
    );
    setWord(d.item?.id ?? MYSTERY_WORDS[0]!);
    setUsed(d.used);
  };
  const start = (): void => {
    setTurn(0);
    setCardsLeft(DECK);
    setScore(0);
    setHistory([]);
    newWord(used);
    setStage('look');
  };
  const judge = (o: Outcome): void => {
    setOutcome(o);
    setHistory((h) => [...h, { word, outcome: o }]);
    if (o === 'right') setScore((s) => s + 1);
    setCardsLeft((c) => Math.max(0, c - (o === 'wrong' ? 2 : 1)));
    setStage('result');
  };
  const next = (): void => {
    if (cardsLeft <= 0) return setStage('done');
    setTurn(turn + 1);
    newWord(used);
    setStage('look');
  };

  if (players.length < 3) {
    return (
      <div className="pt-screen">
        <ModeBar title="One of a Kind" onExit={onExit} />
        <div className="pt-panel">
          <p className="pt-muted">One of a Kind needs at least 3 players: one guesser and two or more clue givers (so clues can clash). Add a player in the party menu.</p>
          <button className="pt-btn pt-btn-big" onClick={onExit}>
            Back to the party menu
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'setup') {
    return (
      <div className="pt-screen">
        <ModeBar title="One of a Kind" onExit={onExit} />
        <div className="pt-panel">
          <h3>How it works</h3>
          <ol className="pt-ok-steps">
            <li>Each round one player guesses. They look away while everyone else sees the secret word.</li>
            <li>
              Everyone else thinks of a <b>one-word clue</b>. Compare them quietly first (whisper, or jot them down): <b>matching clues are out</b>.
            </li>
            <li>Say the clues that are left. The guesser gets one try.</li>
          </ol>
          <p className="pt-muted">
            You all play together against a deck of {DECK} cards. Right: +1. Pass: lose that card. Wrong: lose that card and the next one too.
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <Results title={`${score} of ${DECK}: ${rating(score)}`} players={players} scores={Object.fromEntries(players.map((p) => [p.id, score]))} onAgain={() => setStage('setup')} onMenu={onExit}>
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
      <ModeBar title="One of a Kind" progress={`🃏 ${cardsLeft} left · ✅ ${score}`} onExit={onExit} />
      {stage === 'look' && (
        <div className="pt-panel pt-ok-look">
          <Avatar player={guesser} size={72} />
          <p className="pt-kicker">This round’s guesser</p>
          <h2 className="pt-pass-name" style={{ color: guesser.color }}>
            {guesser.name}
          </h2>
          <p className="pt-muted">{guesser.name}, look away or close your eyes. Everyone else, gather round the phone.</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('word')} autoFocus>
            Show the word
          </button>
        </div>
      )}
      {stage === 'word' && (
        <div className="pt-panel">
          <p className="pt-kicker">
            The word for <Name player={guesser} /> is
          </p>
          <p className="pt-ok-word">{word}</p>
          <p className="pt-muted">Think of a one-word clue. Matching clues will be struck out, so try to be helpful and a little original.</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('clues')}>
            Hide it · {guesser.name} can look
          </button>
          <button className="pt-btn pt-btn-ghost" onClick={() => newWord(used)}>
            Don’t know this word? Another one
          </button>
        </div>
      )}
      {stage === 'clues' && (
        <div className="pt-panel">
          <p className="pt-kicker">Clue time</p>
          <ol className="pt-ok-steps">
            <li>Clue givers: compare your clues quietly. Any that match are out.</li>
            <li>Say the rest to {guesser.name}.</li>
            <li>{guesser.name} gets one guess.</li>
          </ol>
          <p className="pt-muted">How did it go?</p>
          <div className="pt-ok-judge">
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => judge('right')}>
              ✅ Got it
            </button>
            <button className="pt-btn pt-btn-big" onClick={() => judge('wrong')}>
              ❌ Wrong guess
            </button>
            <button className="pt-btn pt-btn-ghost" onClick={() => judge('pass')}>
              ⏭️ {guesser.name} passed
            </button>
          </div>
        </div>
      )}
      {stage === 'result' && (
        <div className="pt-panel pt-ok-result">
          <p className="pt-kicker">The word was</p>
          <p className="pt-ok-word">{word}</p>
          <p className="pt-ok-verdict">
            {outcome === 'right' ? `✅ ${guesser.name} got it! +1` : outcome === 'pass' ? `⏭️ ${guesser.name} passed: one card gone` : '❌ Wrong: this card and the next one are gone'}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next} autoFocus>
            {cardsLeft <= 0 ? 'See the score' : `Next card (${cardsLeft} left)`}
          </button>
        </div>
      )}
    </div>
  );
}
