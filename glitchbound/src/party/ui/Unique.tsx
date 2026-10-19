import { useState } from 'react';
import { MYSTERY_WORDS } from '../content/mystery';
import { draw, freshRng } from '../engine';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { checkClues, cleanClue, DECK, guessIsRight, rating, type ClueCheck } from '../unique';
import { Avatar, ModeBar, Name, PassPhone, Results } from './shared';

type Stage = 'setup' | 'pass' | 'write' | 'check' | 'toGuesser' | 'guess' | 'result' | 'done';

interface Round {
  guesser: Player;
  word: string;
  /** Clue givers in order; clues[i] belongs to givers[i]. */
  givers: Player[];
  clues: string[];
  checked: ClueCheck[];
  outcome: 'right' | 'wrong' | 'pass' | null;
  guess: string;
}

export const OUT_TEXT: Record<NonNullable<ClueCheck['out']>, string> = { twin: 'same as another clue', 'gives-it-away': 'gives the word away', empty: 'no clue' };

/**
 * One of a Kind on one phone, played together against the deck: everyone but the guesser writes a
 * one-word clue in secret, matching clues cancel, and the guesser gets one try. 13 cards; a wrong
 * guess also burns the next card.
 */
export function UniqueMode({ session, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const players = session.players;
  const [r] = useState(freshRng);
  const [stage, setStage] = useState<Stage>('setup');
  const [used, setUsed] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const [cardsLeft, setCardsLeft] = useState(DECK);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [writer, setWriter] = useState(0);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<{ word: string; outcome: Round['outcome'] }[]>([]);

  const newWord = (seen: string[]): { word: string; used: string[] } => {
    const d = draw(
      MYSTERY_WORDS.map((w) => ({ id: w })),
      seen,
      r,
    );
    return { word: d.item?.id ?? MYSTERY_WORDS[0]!, used: d.used };
  };
  const deal = (t: number, seen: string[]): void => {
    const guesser = players[t % players.length]!;
    const { word, used: u } = newWord(seen);
    setUsed(u);
    setRound({ guesser, word, givers: players.filter((p) => p !== guesser), clues: [], checked: [], outcome: null, guess: '' });
    setWriter(0);
    setDraft('');
    setStage('pass');
  };
  const start = (): void => {
    setTurn(0);
    setCardsLeft(DECK);
    setScore(0);
    setHistory([]);
    deal(0, used);
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
          <p className="pt-muted">
            You all play together against a deck of {DECK} cards. Each round one player guesses. Everyone else secretly writes <b>one word</b> to help, passing the phone around. Then the twist: <b>matching clues cancel out</b>, so
            the obvious clue might vanish. The guesser gets one try.
          </p>
          <p className="pt-muted">Right: +1. Pass: lose the card. Wrong: lose the card and the next one too.</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done' || !round) {
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

  const progress = `🃏 ${cardsLeft} left · ✅ ${score}`;
  const giver = round.givers[writer]!;

  const submitClue = (): void => {
    const clue = cleanClue(draft);
    const clues = [...round.clues, clue];
    setDraft('');
    if (writer + 1 < round.givers.length) {
      setRound({ ...round, clues });
      setWriter(writer + 1);
      setStage('pass');
    } else {
      setRound({ ...round, clues, checked: checkClues(round.word, clues) });
      setStage('check');
    }
  };
  const swapWord = (): void => {
    const { word, used: u } = newWord(used);
    setUsed(u);
    setRound({ ...round, word });
  };
  const finishGuess = (outcome: 'right' | 'wrong' | 'pass', guess = ''): void => {
    setRound({ ...round, outcome, guess });
    setHistory((h) => [...h, { word: round.word, outcome }]);
    if (outcome === 'right') setScore((s) => s + 1);
    setCardsLeft((c) => Math.max(0, c - (outcome === 'wrong' ? 2 : 1)));
    setStage('result');
  };
  const next = (): void => {
    if (cardsLeft <= 0) return setStage('done');
    setTurn(turn + 1);
    deal(turn + 1, used);
  };

  return (
    <div className="pt-screen">
      <ModeBar title="One of a Kind" progress={progress} onExit={onExit} />
      {stage === 'pass' && (
        <PassPhone
          player={giver}
          note={writer === 0 ? `${round.guesser.name} is guessing this round: keep the screen away from them!` : `Write your clue without peeking at the others. ${round.guesser.name} mustn’t look.`}
          onReady={() => setStage('write')}
        />
      )}
      {stage === 'write' && (
        <div className="pt-panel">
          <p className="pt-kicker">
            The word for <Name player={round.guesser} /> is
          </p>
          <p className="pt-ok-word">{round.word}</p>
          <label className="pt-ok-label" htmlFor="ok-clue">
            Your one-word clue, {giver.name}
          </label>
          <input
            id="ok-clue"
            className="pt-input"
            value={draft}
            maxLength={24}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && draft.trim() && submitClue()}
            placeholder="One word"
          />
          <p className="pt-muted">Matching clues cancel each other out, so try to be helpful and a little original.</p>
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={!draft.trim()} onClick={submitClue}>
            {writer + 1 < round.givers.length ? `Hide it · pass to ${round.givers[writer + 1]!.name}` : 'Done · check the clues'}
          </button>
          {writer === 0 && (
            <button className="pt-btn pt-btn-ghost" onClick={swapWord}>
              Don’t know this word? Another one
            </button>
          )}
        </div>
      )}
      {stage === 'check' && (
        <div className="pt-panel">
          <p className="pt-kicker">
            Clue givers only. <Name player={round.guesser} />, look away!
          </p>
          <ul className="pt-ok-clues">
            {round.checked.map((c, i) => (
              <li key={i} className={c.out ? 'is-out' : ''}>
                <Avatar player={round.givers[i]!} size={26} /> <b>{c.clue || '–'}</b> {c.out && <small>{OUT_TEXT[c.out]}</small>}
              </li>
            ))}
          </ul>
          <p className="pt-muted">{round.checked.every((c) => c.out) ? 'Every clue cancelled out! The guesser gets nothing to go on.' : 'Crossed-out clues are hidden from the guesser.'}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('toGuesser')}>
            Hide · pass to {round.guesser.name}
          </button>
        </div>
      )}
      {stage === 'toGuesser' && <PassPhone player={round.guesser} note="Your clues are ready." onReady={() => setStage('guess')} />}
      {stage === 'guess' && <Guess round={round} onDone={finishGuess} />}
      {stage === 'result' && (
        <div className="pt-panel pt-ok-result">
          <p className="pt-kicker">The word was</p>
          <p className="pt-ok-word">{round.word}</p>
          <p className="pt-ok-verdict">
            {round.outcome === 'right' ? `✅ ${round.guesser.name} got it!` : round.outcome === 'pass' ? `⏭️ ${round.guesser.name} passed` : `❌ “${round.guess}” was wrong: two cards gone`}
          </p>
          <ul className="pt-ok-clues">
            {round.checked.map((c, i) => (
              <li key={i} className={c.out ? 'is-out' : ''}>
                <Avatar player={round.givers[i]!} size={26} /> <b>{c.clue || '–'}</b> {c.out && <small>{OUT_TEXT[c.out]}</small>}
              </li>
            ))}
          </ul>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next} autoFocus>
            {cardsLeft <= 0 ? 'See the score' : `Next card (${cardsLeft} left)`}
          </button>
        </div>
      )}
    </div>
  );
}

function Guess({ round, onDone }: { round: Round; onDone: (o: 'right' | 'wrong' | 'pass', guess?: string) => void }) {
  const [guess, setGuess] = useState('');
  const shown = round.checked.filter((c) => !c.out);
  const submit = (): void => {
    const g = guess.trim();
    if (g) onDone(guessIsRight(round.word, g) ? 'right' : 'wrong', g);
  };
  return (
    <div className="pt-panel">
      <p className="pt-kicker">
        <Name player={round.guesser} />, your clues:
      </p>
      {shown.length ? (
        <ul className="pt-ok-shown">
          {shown.map((c, i) => (
            <li key={i}>{c.clue}</li>
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
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Your guess"
        aria-label="Your guess"
      />
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={!guess.trim()} onClick={submit}>
        Guess
      </button>
      <button className="pt-btn pt-btn-ghost" onClick={() => onDone('pass')}>
        Pass (lose only this card)
      </button>
    </div>
  );
}
