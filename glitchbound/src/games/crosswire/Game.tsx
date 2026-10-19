import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { ARROW, makePuzzle, wordCells, type Puzzle, type Size } from './grid';
import {
  backspace,
  dailyNumber,
  dailyPuzzle,
  key,
  LETTER_HINT,
  mysteryTiles,
  MYSTERY_BONUS,
  practicePuzzle,
  resultLine,
  score,
  solved,
  toggleDir,
  typeLetter,
  WORD_HINT,
  withHint,
  wordFor,
  wrongCells,
  type Cursor,
  type Entries,
  type Tally,
} from './logic';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

const STORE = 'glitchbound.crosswire';
interface Save {
  daily: Record<string, { entries: Entries; tally: Tally; done: boolean; score: number }>;
  solved: number;
  best: number;
  muted: boolean;
}
const emptySave = (): Save => ({ daily: {}, solved: 0, best: 0, muted: false });
function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Save>;
    return { ...emptySave(), ...o, daily: o.daily && typeof o.daily === 'object' ? o.daily : {} };
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    const days = Object.keys(s.daily).sort().slice(-60);
    localStorage.setItem(STORE, JSON.stringify({ ...s, daily: Object.fromEntries(days.map((d) => [d, s.daily[d]])) }));
  } catch {
    /* blocked */
  }
};

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export default function Game({ host, restartKey, challenge }: GameModuleProps) {
  return <Crosswire key={restartKey} host={host} challenge={challenge} />;
}

type Screen = { kind: 'menu' } | { kind: 'play'; daily: boolean; puzzle: Puzzle; challenge?: { id: string; round: number } };

function Crosswire({ host, challenge }: { host: GameHost; challenge?: GameModuleProps['challenge'] }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  // A friends' challenge is a medium grid from the challenge's seed.
  const [screen, setScreen] = useState<Screen>(() =>
    challenge ? { kind: 'play', daily: false, puzzle: makePuzzle(challenge.seed, 'medium'), challenge: { id: challenge.id, round: challenge.round } } : { kind: 'menu' },
  );
  const commit = useCallback((s: Save) => {
    setSave(s);
    writeSave(s);
  }, []);

  if (screen.kind === 'play')
    return (
      <Play
        key={screen.puzzle.seed}
        puzzle={screen.puzzle}
        daily={screen.daily}
        challenge={screen.challenge}
        today={today}
        save={save}
        host={host}
        commit={commit}
        onMenu={() => setScreen({ kind: 'menu' })}
        onAgain={(size) => setScreen({ kind: 'play', daily: false, puzzle: practicePuzzle(size) })}
      />
    );

  const todays = save.daily[today];
  return (
    <div className="xw xw-menu">
      <h1 className="xw-title" aria-label="Crosswire">
        {/* Two halves that wrap as a whole, never in the middle of WIRE. */}
        <span className="xw-title-word">
          {'CROSS'.split('').map((c, i) => (
            <span key={i} className="xw-title-cell">
              {c}
            </span>
          ))}
        </span>
        <span className="xw-title-word">
          <span className="xw-title-clue" aria-hidden="true">
            →
          </span>
          {'WIRE'.split('').map((c, i) => (
            <span key={i} className="xw-title-cell is-alt">
              {c}
            </span>
          ))}
        </span>
      </h1>
      <p className="xw-tag">The crossword where clues live inside the grid. Follow the arrows, crack the mystery word.</p>
      <section className="xw-card">
        <div className="xw-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{todays?.done ? `Solved · ${todays.score} points` : todays ? 'In progress' : 'Same grid for everyone'}</span>
        </div>
        <button className="xw-btn xw-btn-go" onClick={() => setScreen({ kind: 'play', daily: true, puzzle: dailyPuzzle(today) })}>
          {todays?.done ? 'Review today’s grid' : todays ? 'Continue' : 'Play today’s grid'}
        </button>
      </section>
      <section className="xw-card">
        <div className="xw-card-head">
          <b>Practice</b>
          <span>A brand-new grid every time</span>
        </div>
        <div className="xw-row">
          {(['small', 'medium', 'large'] as const).map((s) => (
            <button key={s} className="xw-btn" onClick={() => setScreen({ kind: 'play', daily: false, puzzle: practicePuzzle(s) })}>
              {s === 'small' ? 'Small 7×7' : s === 'medium' ? 'Medium 9×9' : 'Large 10×11'}
            </button>
          ))}
        </div>
      </section>
      <p className="xw-muted">
        {save.solved} grids solved · best {save.best}
      </p>
      <p className="xw-muted xw-small">How to play: tap a clue square or a letter square, type the answer. The arrow shows where the answer goes (→ right, ↓ down, ↳ / ↴ around the corner). Circled letters spell a bonus mystery word.</p>
    </div>
  );
}

function Play(props: {
  puzzle: Puzzle;
  daily: boolean;
  challenge?: { id: string; round: number };
  today: string;
  save: Save;
  host: GameHost;
  commit: (s: Save) => void;
  onMenu: () => void;
  onAgain: (s: Size) => void;
}) {
  const { puzzle: p, daily, today, save, host, commit } = props;
  const stored = daily ? save.daily[today] : undefined;
  const [entries, setEntries] = useState<Entries>(stored?.entries ?? {});
  const [cursor, setCursor] = useState<Cursor>({ word: 0, pos: 0 });
  const [tally, setTally] = useState<Tally>(stored?.tally ?? { seconds: 0, checks: 0, letterHints: 0, wordHints: 0, mystery: false });
  const [shownWrong, setShownWrong] = useState<string[]>([]);
  // A daily grid filled in before a reload goes straight on to the mystery word (or the result).
  const [phase, setPhase] = useState<'grid' | 'mystery' | 'done'>(() => (stored?.done ? 'done' : stored && solved(p, stored.entries) ? (p.mystery ? 'mystery' : 'done') : 'grid'));
  const [guess, setGuess] = useState('');
  const [msg, setMsg] = useState('');
  const started = useRef(false);
  const tallyRef = useRef(tally);
  useLayoutEffect(() => {
    tallyRef.current = tally;
  });

  // Timer runs while the grid is being solved and the tab is visible.
  useEffect(() => {
    if (phase !== 'grid') return;
    const t = window.setInterval(() => {
      if (!document.hidden) setTally((x) => ({ ...x, seconds: x.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // Save daily progress as you go, the clock too (every second), so leaving or reloading never winds it back.
  useEffect(() => {
    if (!daily) return;
    const cur = save.daily[today];
    if (cur?.done) return;
    const id = window.setTimeout(() => commit({ ...save, daily: { ...save.daily, [today]: { entries, tally, done: false, score: 0 } } }), 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, tally.seconds, tally.checks, tally.letterHints, tally.wordHints]);

  const finish = (mystery: boolean): void => {
    const t = { ...tallyRef.current, mystery };
    const pts = score(t);
    setTally(t);
    setPhase('done');
    setMsg(''); // a wrong mystery guess's message must not end up on the Share button
    const next: Save = { ...save, solved: save.solved + 1, best: Math.max(save.best, pts) };
    if (daily) next.daily = { ...save.daily, [today]: { entries, tally: t, done: true, score: pts } };
    commit(next);
    const end = { type: 'end' as const, score: pts, stats: { seconds: Math.max(1, t.seconds), clean: t.letterHints + t.wordHints === 0 ? 1 : 0 } };
    host.report(daily ? { ...end, daily: true } : props.challenge ? { ...end, challenge: props.challenge } : end);
  };

  const after = (e: Entries): void => {
    setEntries(e);
    setShownWrong((w) => w.filter((k) => !!e[k] && e[k] !== undefined));
    if (solved(p, e)) setPhase(p.mystery ? 'mystery' : 'done');
  };
  useEffect(() => {
    if (phase === 'done' && !stored?.done && !tally.mystery && !p.mystery) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const type = useCallback(
    (ch: string) => {
      if (phase !== 'grid') return;
      if (!started.current) {
        started.current = true;
        host.report({ type: 'start' });
      }
      const r = typeLetter(p, entries, cursor, ch);
      setCursor(r.cursor);
      after(r.entries);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, entries, cursor, p, host],
  );
  const back = useCallback(() => {
    if (phase !== 'grid') return;
    const r = backspace(p, entries, cursor);
    setCursor(r.cursor);
    setEntries(r.entries);
  }, [phase, entries, cursor, p]);

  useEffect(() => {
    // Only the grid takes keys: on the result and mystery panels Tab and Space work as usual.
    if (phase !== 'grid') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        type(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        back();
      } else if (e.key === ' ' || e.key === 'Tab') {
        e.preventDefault();
        setCursor((c) => (e.key === ' ' ? toggleDir(p, c) : { word: (c.word + (e.shiftKey ? p.words.length - 1 : 1)) % p.words.length, pos: 0 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, type, back, p]);

  const w = p.words[cursor.word]!;
  const active = new Set(wordCells(w).map(([r, c]) => key(r, c)));
  const [cr, cc] = wordCells(w)[cursor.pos] ?? [w.row, w.col];

  const tapCell = (r: number, c: number): void => {
    const cell = p.cells[r]![c]!;
    if (cell.kind === 'clue') {
      const i = cell.clues.length > 1 && cell.clues[0] === cursor.word ? cell.clues[1]! : cell.clues[0]!;
      setCursor({ word: i, pos: 0 });
      return;
    }
    if (cell.kind !== 'letter') return;
    if (r === cr && c === cc) {
      setCursor((cur) => toggleDir(p, cur));
      return;
    }
    const wi = wordFor(p, r, c, w.dir);
    setCursor({ word: wi, pos: wordCells(p.words[wi]!).findIndex(([a, b]) => a === r && b === c) });
  };

  const hintLetter = (): void => {
    const cells = wordCells(w);
    const i = cells.findIndex(([a, b], k) => entries[key(a, b)] !== w.word[k]);
    if (i < 0) return;
    setTally((t) => withHint(t, cursor.word, 'letter'));
    after({ ...entries, [key(...cells[i]!)]: w.word[i]! });
  };
  const hintWord = (): void => {
    const e = { ...entries };
    wordCells(w).forEach(([a, b], k) => (e[key(a, b)] = w.word[k]!));
    setTally((t) => withHint(t, cursor.word, 'word'));
    after(e);
  };
  const check = (): void => {
    setShownWrong(wrongCells(p, entries));
    setTally((t) => ({ ...t, checks: t.checks + 1 }));
  };

  const filled = Object.keys(entries).length;
  const total = p.cells.flat().filter((c) => c.kind === 'letter').length;
  const result = save.daily[today];

  return (
    <div className="xw xw-play">
      <div className="xw-top">
        <button className="xw-icon" onClick={props.onMenu} aria-label="Back to menu">
          ←
        </button>
        <span className="xw-kicker">{daily ? `Daily #${dailyNumber(today)}` : props.challenge ? '⚔️ Challenge grid' : 'Practice'}</span>
        <span className="xw-time">
          {Math.floor(tally.seconds / 60)}:{String(tally.seconds % 60).padStart(2, '0')}
        </span>
      </div>

      <div className="xw-grid" style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }} role="grid" aria-label="Crossword grid">
        {p.cells.map((row, r) =>
          row.map((cell, c) => {
            const k = key(r, c);
            if (cell.kind === 'block') return <span key={k} className="xw-block" aria-hidden="true" />;
            if (cell.kind === 'clue') {
              return (
                <button key={k} className={`xw-clue${cell.clues.includes(cursor.word) ? ' is-on' : ''}${cell.clues.length > 1 ? ' is-two' : ''}`} onClick={() => tapCell(r, c)} aria-label={cell.clues.map((i) => `Clue ${p.words[i]!.n}: ${p.words[i]!.clue}`).join('. ')}>
                  {cell.clues.map((i) => (
                    <span key={i} className="xw-clue-part">
                      <b>{p.words[i]!.n}</b>
                      <i>{ARROW[p.words[i]!.spot]}</i>
                      <small>{p.words[i]!.clue}</small>
                    </span>
                  ))}
                </button>
              );
            }
            const v = entries[k];
            const isCur = r === cr && c === cc;
            return (
              <button
                key={k}
                className={`xw-cell${active.has(k) ? ' is-word' : ''}${isCur ? ' is-cur' : ''}${shownWrong.includes(k) ? ' is-wrong' : ''}${phase !== 'grid' && cell.mystery !== undefined ? ' is-mystery-done' : ''}`}
                onClick={() => tapCell(r, c)}
                aria-label={`Square, ${v ?? 'empty'}`}
              >
                {cell.mystery !== undefined && <span className="xw-ring" aria-hidden="true" />}
                {v}
              </button>
            );
          }),
        )}
      </div>

      {phase === 'grid' && (
        <>
          <div className="xw-cluebar" aria-live="polite">
            <button className="xw-icon" onClick={() => setCursor((c) => ({ word: (c.word + p.words.length - 1) % p.words.length, pos: 0 }))} aria-label="Previous clue">
              ‹
            </button>
            <p>
              <b>
                {w.n} {ARROW[w.spot]}
              </b>{' '}
              {w.clue} <span className="xw-muted">({w.word.length})</span>
            </p>
            <button className="xw-icon" onClick={() => setCursor((c) => ({ word: (c.word + 1) % p.words.length, pos: 0 }))} aria-label="Next clue">
              ›
            </button>
          </div>
          <div className="xw-tools">
            <span className="xw-muted">
              {filled}/{total}
            </span>
            <button className="xw-btn xw-btn-sm" onClick={check}>
              Check
            </button>
            <button className="xw-btn xw-btn-sm" onClick={hintLetter}>
              Letter (−{LETTER_HINT})
            </button>
            <button className="xw-btn xw-btn-sm" onClick={hintWord}>
              Word (−{WORD_HINT})
            </button>
          </div>
          <div className="xw-keys" aria-label="Keyboard">
            {ROWS.map((row, i) => (
              <div key={row} className="xw-keyrow">
                {row.split('').map((ch) => (
                  <button key={ch} className="xw-key" onClick={() => type(ch)}>
                    {ch}
                  </button>
                ))}
                {i === 2 && (
                  <button className="xw-key xw-key-wide" onClick={back} aria-label="Delete">
                    ⌫
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'mystery' && p.mystery && (
        <div className="xw-panel">
          <h2>Grid solved! 🎉 Now the mystery word</h2>
          <p className="xw-muted">The circled letters unscramble into one more word. Clue: “{p.mystery.clue}”</p>
          <div className="xw-tiles">
            {mysteryTiles(p).map((ch, i) => (
              <span key={i} className="xw-tile">
                {ch}
              </span>
            ))}
          </div>
          <form
            className="xw-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess.trim().toUpperCase() === p.mystery!.word) finish(true);
              else setMsg('Not quite. Try again, or skip the bonus.');
            }}
          >
            <input className="xw-input" value={guess} onChange={(e) => setGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} maxLength={p.mystery.word.length} placeholder={'?'.repeat(p.mystery.word.length)} aria-label="Mystery word" autoFocus />
            <button className="xw-btn xw-btn-go">Solve (+{MYSTERY_BONUS})</button>
          </form>
          {msg && <p className="xw-wrong">{msg}</p>}
          <button className="xw-btn xw-btn-ghost" onClick={() => finish(false)}>
            Skip the bonus
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="xw-panel">
          <h2>{tally.mystery ? 'Grid and mystery word solved!' : 'Grid solved!'}</h2>
          <p className="xw-big">{daily && result?.done ? result.score : score(tally)}</p>
          <p className="xw-muted">
            {Math.floor(tally.seconds / 60)}m {tally.seconds % 60}s · {tally.letterHints + tally.wordHints} hints · {tally.checks} checks
            {p.mystery ? ` · mystery: ${tally.mystery ? p.mystery.word : 'skipped'}` : ''}
          </p>
          <ResultLine line={resultLine(p, tally)} label={`${p.words.length - (tally.revealed?.length ?? 0)} of ${p.words.length} words solved without a reveal`} />
          <div className="xw-row">
            {daily ? (
              <button
                className="xw-btn xw-btn-go"
                onClick={() =>
                  void shareOrCopy({
                    title: 'Crosswire',
                    text: `Crosswire #${dailyNumber(today)} ✏️\n${resultLine(p, tally)}\n${Math.floor(tally.seconds / 60)}m ${tally.seconds % 60}s · ${tally.letterHints + tally.wordHints === 0 ? 'no hints 🧠' : `${tally.letterHints + tally.wordHints} hints`}${tally.mystery ? ' · mystery ⭐' : ''}\n${score(tally)} points\n${window.location.origin}/games/crosswire`,
                  }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))
                }
              >
                {msg || 'Share'}
              </button>
            ) : props.challenge ? (
              <a className="xw-btn xw-btn-go" href={`/c/${props.challenge.id}`} onClick={openChallengeScores}>
                See the scoreboard
              </a>
            ) : (
              <button className="xw-btn xw-btn-go" onClick={() => props.onAgain(p.rows <= 7 ? 'small' : p.rows <= 9 ? 'medium' : 'large')}>
                Next grid
              </button>
            )}
            <button className="xw-btn" onClick={props.onMenu}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
