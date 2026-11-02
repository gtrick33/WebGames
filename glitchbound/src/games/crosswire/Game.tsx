import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { Coach, useCoach } from '../../components/Coach';
import { ResultLine } from '../../components/ResultLine';
import { COACH } from './coach';
import { ARROW, editionFor, makePuzzle, wordCells, type Puzzle, type Size } from './grid';
import {
  backspace,
  dailyNumber,
  dailyPuzzle,
  isRight,
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
  wordsAt,
  wrongCells,
  type Cursor,
  type Entries,
  type Tally,
} from './logic';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

const STORE = 'glitchbound.crosswire';
/** One grid's progress: a daily (by day) or a friends' challenge round (by `${id}:${round}`). */
interface Round {
  entries: Entries;
  tally: Tally;
  done: boolean;
  score: number;
}
interface Save {
  daily: Record<string, Round>;
  rounds: Record<string, Round>;
  solved: number;
  best: number;
  muted: boolean;
}
const emptySave = (): Save => ({ daily: {}, rounds: {}, solved: 0, best: 0, muted: false });

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 1e7) : 0);
const ids = (v: unknown): number[] | undefined => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 200) : undefined);

function cleanTally(v: unknown): Tally | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  const out: Tally = { seconds: count(t.seconds), checks: count(t.checks), letterHints: count(t.letterHints), wordHints: count(t.wordHints), mystery: t.mystery === true };
  const hinted = ids(t.hinted);
  const revealed = ids(t.revealed);
  if (hinted) out.hinted = hinted;
  if (revealed) out.revealed = revealed;
  return out;
}

/** A stored round, or null when it is damaged (it is then dropped and the grid starts fresh). */
function cleanRound(v: unknown): Round | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const tally = cleanTally(o.tally);
  if (!tally || !o.entries || typeof o.entries !== 'object') return null;
  const entries: Entries = {};
  for (const [k, ch] of Object.entries(o.entries as Record<string, unknown>)) if (/^\d{1,2},\d{1,2}$/.test(k) && typeof ch === 'string' && /^[A-Z]$/.test(ch)) entries[k] = ch;
  const done = o.done === true;
  return { entries, tally, done, score: done ? (typeof o.score === 'number' && Number.isFinite(o.score) ? count(o.score) : score(tally)) : 0 };
}
function cleanRounds(v: unknown): Record<string, Round> {
  const out: Record<string, Round> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
    const c = cleanRound(r);
    if (c) out[k] = c;
  }
  return out;
}

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return emptySave();
    return { daily: cleanRounds(o.daily), rounds: cleanRounds(o.rounds), solved: count(o.solved), best: count(o.best), muted: o.muted === true };
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    const days = Object.keys(s.daily).sort().slice(-60);
    // Challenge rounds in the order they were played: the last 40 are plenty.
    const rounds = Object.keys(s.rounds).slice(-40);
    localStorage.setItem(STORE, JSON.stringify({ ...s, daily: Object.fromEntries(days.map((d) => [d, s.daily[d]])), rounds: Object.fromEntries(rounds.map((k) => [k, s.rounds[k]])) }));
  } catch {
    /* blocked */
  }
};

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <Crosswire key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

type Screen = { kind: 'menu' } | { kind: 'play'; puzzle: Puzzle; day: string; daily: boolean; challenge?: { id: string; round: number } };

/** A friends' challenge round: "Today's daily" plays that day's real daily; a fresh round a medium grid from its seed. */
function challengeScreen(c: NonNullable<GameModuleProps['challenge']>): Screen {
  const round = { id: c.id, round: c.round };
  if (c.mode === 'daily' && c.day) return { kind: 'play', puzzle: dailyPuzzle(c.day), day: c.day, daily: true, challenge: round };
  return { kind: 'play', puzzle: makePuzzle(c.seed, 'medium', editionFor(c.day)), day: dayKey(), daily: false, challenge: round };
}

function Crosswire({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: GameModuleProps['challenge'] }) {
  // Re-read on the menu, when the tab comes back and when a round starts: a page left open past midnight moves on.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const [screen, setScreen] = useState<Screen>(() => (challenge ? challengeScreen(challenge) : { kind: 'menu' }));
  /** Every write re-reads the stored save, so a second tab's progress is never overwritten. */
  const update = useCallback((fn: (latest: Save) => Save) => {
    const next = fn(loadSave());
    writeSave(next);
    setSave(next);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === STORE || e.key === null) setSave(loadSave());
    };
    const onBack = (): void => {
      if (!document.hidden) setToday(dayKey());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, []);
  const toMenu = useCallback((): void => {
    setToday(dayKey());
    setScreen({ kind: 'menu' });
  }, []);
  // First time on the menu: a three-step walkthrough (arrowwords are new to most players).
  const coach = useCoach('crosswire');

  if (screen.kind === 'play')
    return (
      <Play
        key={`${screen.puzzle.seed}:${screen.day}`}
        puzzle={screen.puzzle}
        day={screen.day}
        daily={screen.daily}
        challenge={screen.challenge}
        save={save}
        host={host}
        pauseKey={pauseKey}
        update={update}
        onMenu={toMenu}
        onAgain={(size) => setScreen({ kind: 'play', daily: false, day: dayKey(), puzzle: practicePuzzle(size) })}
      />
    );

  const todays = save.daily[today];
  return (
    <div className="xw xw-menu">
      <div className="xw-menu-top"><GameMenuButton className="xw-icon" /></div>
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
        <button
          className="xw-btn xw-btn-go"
          onClick={() => {
            const day = dayKey();
            setToday(day);
            setScreen({ kind: 'play', daily: true, day, puzzle: dailyPuzzle(day) });
          }}
        >
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
            <button key={s} className="xw-btn" onClick={() => setScreen({ kind: 'play', daily: false, day: dayKey(), puzzle: practicePuzzle(s) })}>
              {s === 'small' ? 'Small 7×7' : s === 'medium' ? 'Medium 9×9' : 'Large 10×11'}
            </button>
          ))}
        </div>
      </section>
      <p className="xw-muted">
        {plural(save.solved, 'grid')} solved · best {save.best}
      </p>
      <button className="xw-btn" onClick={coach.show}>
        How to play
      </button>
      {coach.open && <Coach steps={COACH} onClose={coach.close} />}
    </div>
  );
}

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

function Play(props: {
  puzzle: Puzzle;
  day: string;
  daily: boolean;
  challenge?: { id: string; round: number };
  save: Save;
  host: GameHost;
  pauseKey?: number;
  update: (fn: (latest: Save) => Save) => void;
  onMenu: () => void;
  onAgain: (s: Size) => void;
}) {
  const { puzzle: p, daily, day, save, host, update, onMenu } = props;
  const rk = props.challenge ? `${props.challenge.id}:${props.challenge.round}` : null;
  /** This grid's stored record: the daily's, else the challenge round's. */
  const recordOf = useCallback((s: Save): Round | undefined => (daily ? s.daily[day] : rk ? s.rounds[rk] : undefined), [daily, day, rk]);
  const [stored] = useState(() => recordOf(save));
  const [entries, setEntries] = useState<Entries>(stored?.entries ?? {});
  const [cursor, setCursor] = useState<Cursor>({ word: 0, pos: 0 });
  const [tally, setTally] = useState<Tally>(stored?.tally ?? { seconds: 0, checks: 0, letterHints: 0, wordHints: 0, mystery: false });
  /** Squares Check marked wrong, with the letter they had: a mark clears as soon as the letter changes. */
  const [shownWrong, setShownWrong] = useState<Record<string, string>>({});
  // A grid filled in before a reload goes straight on to the mystery word (or the result).
  const [phase, setPhase] = useState<'grid' | 'mystery' | 'done'>(() => (stored?.done ? 'done' : stored && solved(p, stored.entries) ? (p.mystery ? 'mystery' : 'done') : 'grid'));
  const [guess, setGuess] = useState('');
  const [msg, setMsg] = useState('');
  const [paused, setPaused] = useState(false);
  const [pauseSeen, setPauseSeen] = useState(props.pauseKey);
  if (pauseSeen !== props.pauseKey) {
    setPauseSeen(props.pauseKey);
    if (phase === 'grid') setPaused(true);
  }
  const started = useRef(false);
  const tallyRef = useRef(tally);
  const entriesRef = useRef(entries);
  useLayoutEffect(() => {
    tallyRef.current = tally;
    entriesRef.current = entries;
  });
  const saveTimer = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLButtonElement>(null);
  const [cell, setCell] = useState(32);

  // The clock runs while the grid is being solved, the tab is visible and the arcade hasn't paused the game.
  useEffect(() => {
    if (phase !== 'grid' || paused) return;
    const t = window.setInterval(() => {
      if (!document.hidden) setTally((x) => ({ ...x, seconds: x.seconds + 1 }));
    }, 1000);
    const onHide = (): void => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [phase, paused]);

  // A daily or challenge round already finished elsewhere (another tab): this screen is stale.
  useEffect(() => {
    if (phase !== 'done' && recordOf(save)?.done) onMenu();
  }, [save, phase, recordOf, onMenu]);

  // "Today's daily" challenge on a daily this device already finished: that result counts, once.
  const reported = useRef(false);
  useEffect(() => {
    if (!rk || !daily || !stored?.done || reported.current) return;
    reported.current = true;
    let fresh = false;
    update((s) => {
      if (s.rounds[rk]?.done || !s.daily[day]?.done) return s;
      fresh = true;
      return { ...s, rounds: { ...s.rounds, [rk]: s.daily[day]! } };
    });
    if (!fresh) return;
    const t = stored.tally;
    host.report({ type: 'end', score: stored.score, stats: { seconds: Math.max(1, t.seconds), clean: t.letterHints + t.wordHints === 0 ? 1 : 0 }, challenge: props.challenge });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save progress as you go, the clock too (every second), so leaving, reloading or Restart never winds it back.
  useEffect(() => {
    if (!daily && !rk) return;
    if (phase === 'done' || stored?.done) return;
    saveTimer.current = window.setTimeout(
      () =>
        update((s) => {
          if (recordOf(s)?.done) return s;
          const rec: Round = { entries: entriesRef.current, tally: tallyRef.current, done: false, score: 0 };
          return daily ? { ...s, daily: { ...s.daily, [day]: rec } } : { ...s, rounds: { ...s.rounds, [rk!]: rec } };
        }),
      400,
    );
    return () => window.clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, tally.seconds, tally.checks, tally.letterHints, tally.wordHints]);

  const finish = (mystery: boolean): void => {
    window.clearTimeout(saveTimer.current);
    const t = { ...tallyRef.current, mystery };
    const pts = score(t);
    setTally(t);
    setPhase('done');
    setMsg(''); // a wrong mystery guess's message must not end up on the Share button
    let already = false;
    update((s) => {
      if (recordOf(s)?.done) {
        already = true;
        return s;
      }
      const rec: Round = { entries: entriesRef.current, tally: t, done: true, score: pts };
      const next: Save = { ...s, solved: s.solved + 1, best: Math.max(s.best, pts) };
      if (daily) next.daily = { ...s.daily, [day]: rec };
      if (rk) next.rounds = { ...s.rounds, [rk]: rec };
      return next;
    });
    if (already) return;
    const end = { type: 'end' as const, score: pts, stats: { seconds: Math.max(1, t.seconds), clean: t.letterHints + t.wordHints === 0 ? 1 : 0 } };
    // A daily started before midnight finishes as that day's grid, not as today's daily.
    host.report({ ...end, ...(daily && day === dayKey() ? { daily: true } : {}), ...(props.challenge ? { challenge: props.challenge } : {}) });
  };

  const keepMarks = (e: Entries): void => setShownWrong((w) => Object.fromEntries(Object.entries(w).filter(([k, ch]) => e[k] === ch)));
  const after = (e: Entries): void => {
    setEntries(e);
    keepMarks(e);
    if (solved(p, e)) setPhase(p.mystery ? 'mystery' : 'done');
  };
  useEffect(() => {
    if (phase === 'done' && !stored?.done && !tally.mystery && !p.mystery) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const type = useCallback(
    (ch: string) => {
      if (phase !== 'grid' || paused) return;
      if (!started.current) {
        started.current = true;
        host.report({ type: 'start' });
      }
      const r = typeLetter(p, entries, cursor, ch);
      setCursor(r.cursor);
      after(r.entries);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, paused, entries, cursor, p, host],
  );
  const back = useCallback(() => {
    if (phase !== 'grid' || paused) return;
    const r = backspace(p, entries, cursor);
    setCursor(r.cursor);
    setEntries(r.entries);
    keepMarks(r.entries);
  }, [phase, paused, entries, cursor, p]);

  const w = p.words[cursor.word]!;
  const [cr, cc] = wordCells(w)[cursor.pos] ?? [w.row, w.col];

  /** Arrow keys: across the grid's letter squares, turning to that direction first when the square has a crossing word. */
  const move = useCallback(
    (dr: number, dc: number) => {
      const dir = dc ? 'across' : 'down';
      if (w.dir !== dir) {
        const t = toggleDir(p, cursor);
        if (t.word !== cursor.word) return setCursor(t);
      }
      for (let r = cr + dr, c = cc + dc; r >= 0 && c >= 0 && r < p.rows && c < p.cols; r += dr, c += dc) {
        if (p.cells[r]![c]!.kind !== 'letter') continue;
        const wi = wordFor(p, r, c, dir);
        return setCursor({ word: wi, pos: wordCells(p.words[wi]!).findIndex(([a, b]) => a === r && b === c) });
      }
    },
    [p, w, cursor, cr, cc],
  );

  useEffect(() => {
    // Only the grid takes keys: on the result and mystery panels Tab and Space work as usual.
    if (phase !== 'grid') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
        if (t.closest('[role=dialog],[aria-modal=true]') || !rootRef.current?.contains(t)) return;
      }
      if (paused) {
        if (!e.repeat && (e.key === 'Enter' || e.key === ' ' || /^[a-zA-Z]$/.test(e.key))) {
          e.preventDefault();
          setPaused(false);
        }
        return;
      }
      const inGrid = !!t && !!gridRef.current?.contains(t);
      // A focused button outside the grid (Check, a hint, a key) keeps Enter and Space.
      const onButton = !inGrid && t?.tagName === 'BUTTON';
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        if (!e.repeat) type(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        back();
      } else if (ARROWS[e.key]) {
        e.preventDefault();
        move(...ARROWS[e.key]!);
      } else if (e.key === ' ' && !onButton) {
        e.preventDefault();
        if (!e.repeat) setCursor((c) => toggleDir(p, c));
      } else if (e.key === 'Tab' && inGrid) {
        // Tab walks the clues inside the grid, and leaves it after the last one (Shift+Tab before the first).
        const nextWord = cursor.word + (e.shiftKey ? -1 : 1);
        if (nextWord < 0 || nextWord >= p.words.length) return;
        e.preventDefault();
        setCursor({ word: nextWord, pos: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, paused, type, back, move, p, cursor.word]);

  // Focus follows the cursor while the keyboard is in the grid.
  useEffect(() => {
    if (gridRef.current?.contains(document.activeElement) && document.activeElement !== curRef.current) curRef.current?.focus();
  }, [cr, cc]);

  // Clue squares are laid out from their own size: text only where it fits.
  useLayoutEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    const measure = (): void => setCell(Math.max(10, (g.clientWidth - 4 - 2 * (p.cols - 1)) / p.cols));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => ro.disconnect();
  }, [p.cols, paused]);

  const tapCell = (r: number, c: number): void => {
    const cl = p.cells[r]![c]!;
    if (cl.kind === 'clue') {
      const i = cl.clues.length > 1 && cl.clues[0] === cursor.word ? cl.clues[1]! : cl.clues[0]!;
      setCursor({ word: i, pos: 0 });
      return;
    }
    if (cl.kind !== 'letter') return;
    if (r === cr && c === cc) {
      setCursor((cur) => toggleDir(p, cur));
      return;
    }
    const wi = wordFor(p, r, c, w.dir);
    setCursor({ word: wi, pos: wordCells(p.words[wi]!).findIndex(([a, b]) => a === r && b === c) });
  };

  const wordDone = isRight(p, entries, cursor.word);
  const hintLetter = (): void => {
    const cells = wordCells(w);
    const i = cells.findIndex(([a, b], k) => entries[key(a, b)] !== w.word[k]);
    if (i < 0) return;
    setTally((t) => withHint(t, cursor.word, 'letter'));
    after({ ...entries, [key(...cells[i]!)]: w.word[i]! });
  };
  const hintWord = (): void => {
    if (wordDone) return;
    const e = { ...entries };
    wordCells(w).forEach(([a, b], k) => (e[key(a, b)] = w.word[k]!));
    setTally((t) => withHint(t, cursor.word, 'word'));
    after(e);
  };
  const check = (): void => {
    setShownWrong(Object.fromEntries(wrongCells(p, entries).map((k) => [k, entries[k]!])));
    setTally((t) => ({ ...t, checks: t.checks + 1 }));
  };

  const filled = Object.keys(entries).length;
  const total = p.cells.flat().filter((c) => c.kind === 'letter').length;
  const result = recordOf(save);
  const active = new Set(wordCells(w).map(([r, c]) => key(r, c)));
  const hints = tally.letterHints + tally.wordHints;
  // In-cell clue text needs a roomy square: the number and arrow on one line, then as many lines as fit.
  const roomy = cell >= 52;
  const textPx = Math.max(9, cell * 0.16);
  const lines = Math.max(1, Math.floor((cell - 8 - cell * 0.26 - 2) / (textPx * 1.1)));
  const inChallenge = !!props.challenge && phase !== 'done';
  // A "Today's daily" challenge on a daily finished before: that result is the round's score.
  const note = rk && daily && stored?.done ? 'Your daily result counts here.' : '';

  const cellLabel = (r: number, c: number, v: string | undefined): string => {
    const ws = wordsAt(p, r, c).sort((a, b) => (p.words[a]!.dir === w.dir ? -1 : 0) - (p.words[b]!.dir === w.dir ? -1 : 0));
    const parts = ws.map((i) => {
      const x = p.words[i]!;
      const at = wordCells(x).findIndex(([a, b]) => a === r && b === c);
      return `${x.n} ${x.dir}: ${x.clue}, letter ${at + 1} of ${x.word.length}`;
    });
    return `Row ${r + 1}, column ${c + 1}. ${parts.join('. ')}. ${v ?? 'Empty'}`;
  };

  return (
    <div className="xw xw-play" ref={rootRef} style={{ '--cols': p.cols, '--rows': p.rows } as CSSProperties}>
      <div className="xw-play-in">
        <div className="xw-top">
          {/* A challenge round is one attempt: no way out that would drop it unscored. */}
          {!inChallenge && (
            <button className="xw-icon" onClick={onMenu} aria-label="Back to menu">
              ←
            </button>
          )}
          <span className="xw-kicker">{daily ? `Daily #${dailyNumber(day)}` : props.challenge ? '⚔️ Challenge grid' : 'Practice'}</span>
          <span className="xw-time">{clock(tally.seconds)}</span>
          <GameMenuButton className="xw-icon" />
        </div>

        {paused ? (
          <div className="xw-paused">
            <h2>Paused</h2>
            <p className="xw-muted">The clock is stopped. The grid is hidden until you come back.</p>
            <button className="xw-btn xw-btn-go" onClick={() => setPaused(false)} autoFocus>
              Resume
            </button>
          </div>
        ) : (
          <>
            <div className="xw-board">
              <div
                ref={gridRef}
                className={`xw-grid${roomy ? ' is-roomy' : ''}`}
                style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)`, '--cell': `${cell}px`, '--lines': lines } as CSSProperties}
                role="grid"
                aria-label="Crossword grid"
              >
                {p.cells.map((row, r) => (
                  <div key={r} role="row" className="xw-gridrow">
                    {row.map((cl, c) => {
                      const k = key(r, c);
                      if (cl.kind === 'block') return <span key={k} className="xw-block" aria-hidden="true" />;
                      if (cl.kind === 'clue') {
                        return (
                          <button
                            key={k}
                            role="gridcell"
                            tabIndex={-1}
                            className={`xw-clue${cl.clues.includes(cursor.word) ? ' is-on' : ''}${cl.clues.length > 1 ? ' is-two' : ''}`}
                            onClick={() => tapCell(r, c)}
                            aria-label={`Row ${r + 1}, column ${c + 1}. ${cl.clues.map((i) => `Clue ${p.words[i]!.n} ${p.words[i]!.dir}: ${p.words[i]!.clue}`).join('. ')}`}
                          >
                            {cl.clues.map((i) => (
                              <span key={i} className="xw-clue-part">
                                <span className="xw-clue-head">
                                  <b>{p.words[i]!.n}</b>
                                  <i>{ARROW[p.words[i]!.spot]}</i>
                                </span>
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
                          ref={isCur ? curRef : undefined}
                          role="gridcell"
                          tabIndex={isCur ? 0 : -1}
                          aria-selected={isCur}
                          className={`xw-cell${active.has(k) ? ' is-word' : ''}${isCur ? ' is-cur' : ''}${shownWrong[k] ? ' is-wrong' : ''}${phase !== 'grid' && cl.mystery !== undefined ? ' is-mystery-done' : ''}`}
                          onClick={() => tapCell(r, c)}
                          aria-label={cellLabel(r, c, v)}
                        >
                          {cl.mystery !== undefined && <span className="xw-ring" aria-hidden="true" />}
                          {v}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="xw-side">
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
                  {filled === total && (
                    <p className="xw-almost" role="status">
                      Almost! Every square is filled, but some letters are wrong.
                    </p>
                  )}
                  <div className="xw-tools">
                    <span className="xw-muted">
                      {filled}/{total}
                    </span>
                    <button className="xw-btn xw-btn-sm" onClick={check}>
                      Check
                    </button>
                    <button className="xw-btn xw-btn-sm" onClick={hintLetter} disabled={wordDone} aria-label={`Reveal a letter, minus ${LETTER_HINT} points`}>
                      Letter −{LETTER_HINT}
                    </button>
                    <button className="xw-btn xw-btn-sm" onClick={hintWord} disabled={wordDone} aria-label={`Reveal the word, minus ${WORD_HINT} points`}>
                      Word −{WORD_HINT}
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
                  {note && <p className="xw-muted">{note}</p>}
                  <p className="xw-big">{result?.done ? result.score : score(tally)}</p>
                  <p className="xw-muted">
                    {Math.floor(tally.seconds / 60)}m {tally.seconds % 60}s · {plural(hints, 'hint')} · {plural(tally.checks, 'check')}
                    {p.mystery ? ` · mystery: ${tally.mystery ? p.mystery.word : 'skipped'}` : ''}
                  </p>
                  <ResultLine line={resultLine(p, tally)} label={`${p.words.length - (tally.revealed?.length ?? 0)} of ${p.words.length} words solved without a reveal`} />
                  <div className="xw-row">
                    {props.challenge ? (
                      <a className="xw-btn xw-btn-go" href={`/c/${props.challenge.id}`} onClick={openChallengeScores}>
                        See the scoreboard
                      </a>
                    ) : daily ? (
                      <button
                        className="xw-btn xw-btn-go"
                        onClick={() =>
                          void shareOrCopy({
                            title: 'Crosswire',
                            text: `Crosswire #${dailyNumber(day)} ✏️\n${resultLine(p, tally)}\n${Math.floor(tally.seconds / 60)}m ${tally.seconds % 60}s · ${hints === 0 ? 'no hints 🧠' : plural(hints, 'hint')}${tally.mystery ? ' · mystery word solved' : ''}\n${score(tally)} points\n${window.location.origin}/games/crosswire`,
                          }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))
                        }
                      >
                        {msg || 'Share'}
                      </button>
                    ) : (
                      <button className="xw-btn xw-btn-go" onClick={() => props.onAgain(p.rows <= 7 ? 'small' : p.rows <= 9 ? 'medium' : 'large')}>
                        Next grid
                      </button>
                    )}
                    <button className="xw-btn" onClick={onMenu}>
                      Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
