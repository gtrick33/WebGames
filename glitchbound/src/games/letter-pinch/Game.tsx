import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight } from '../../platform/dates';
import { SITE_URL } from '../../platform/env';
import { shareOrCopy } from '../../platform/share';
import {
  checkGuess,
  dailySecret,
  feedback,
  keyState,
  letterAt,
  MAX_GUESSES,
  practiceSecret,
  puzzleNumber,
  roundStats,
  scoreRound,
  shareText,
  windowsFor,
  WORD_LEN,
  type Mark,
  type Row,
  type Window,
} from './logic';
import { createSfx, type Sfx } from './sfx';
import { finishDaily, finishPractice, loadSave, shownStreak, storeSave, type PinchSave, type Tally } from './storage';
import './Game.css';

type Mode = 'daily' | 'practice';
type Panel = 'none' | 'help' | 'stats';

interface Puzzle {
  mode: Mode;
  secret: string;
  /** Daily only. */
  day?: string;
  rows: Row[];
  startedAt: number | null;
  endedAt: number | null;
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const REVEAL_MS = 120 * WORD_LEN + 380;
const ARROW: Record<Mark, string> = { up: '▲', down: '▼', hit: '●' };
const MARK_TEXT: Record<Mark, string> = { up: 'later in the alphabet', down: 'earlier in the alphabet', hit: 'exact' };

function dailyPuzzle(save: PinchSave, day: string): Puzzle {
  const secret = dailySecret(day);
  const p = save.days[day];
  return {
    mode: 'daily',
    secret,
    day,
    rows: (p?.guesses ?? []).map((guess) => ({ guess, marks: feedback(guess, secret) })),
    startedAt: p?.startedAt || null,
    endedAt: p?.endedAt ?? null,
  };
}

function practicePuzzle(): Puzzle {
  return { mode: 'practice', secret: practiceSecret(Math.random, dailySecret(dayKey())), rows: [], startedAt: null, endedAt: null };
}

const isSolved = (p: Puzzle): boolean => p.rows.at(-1)?.guess === p.secret;
const isOver = (p: Puzzle): boolean => isSolved(p) || p.rows.length >= MAX_GUESSES;
const secondsOf = (p: Puzzle): number => (p.startedAt && p.endedAt ? (p.endedAt - p.startedAt) / 1000 : 0);

/** Letter Pinch: each tile points the way through the alphabet to the secret letter. */
export default function Game({ host }: GameModuleProps) {
  const [save, setSave] = useState<PinchSave>(loadSave);
  const [mode, setMode] = useState<Mode>('daily');
  const [daily, setDaily] = useState<Puzzle>(() => dailyPuzzle(save, dayKey()));
  const [practice, setPractice] = useState<Puzzle | null>(null);
  const [typed, setTyped] = useState('');
  const [panel, setPanel] = useState<Panel>(() => (!save.seenHelp ? 'help' : isOver(daily) ? 'stats' : 'none'));
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [, setTick] = useState(0);
  const [sfx] = useState<Sfx>(() => createSfx(save.muted));
  const startedHere = useRef<Puzzle | null>(null);
  const timers = useRef<number[]>([]);

  const puzzle = mode === 'daily' || !practice ? daily : practice;
  const setPuzzle = mode === 'daily' || !practice ? setDaily : setPractice;
  const over = isOver(puzzle);
  const windows = windowsFor(puzzle.rows);

  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const commit = (mutate: (s: PinchSave) => void): PinchSave => {
    const next = structuredClone(save);
    mutate(next);
    storeSave(next, dayKey());
    setSave(next);
    return next;
  };

  const flash = (text: string): void => setToast({ text, id: Date.now() });

  const typeLetter = (ch: string): void => {
    if (over || panel !== 'none') return;
    if (typed.length < WORD_LEN) {
      setTyped(typed + ch);
      sfx.key();
    }
  };

  const erase = (): void => {
    if (over || panel !== 'none') return;
    setTyped(typed.slice(0, -1));
  };

  const submit = (): void => {
    if (over || panel !== 'none') return;
    const err = checkGuess(typed);
    if (err) {
      setShake((s) => s + 1);
      sfx.bump();
      flash(err === 'short' ? `${WORD_LEN} letters, please` : 'Not in the word list');
      return;
    }
    const now = Date.now();
    if (startedHere.current !== puzzle) host.report({ type: 'start' });
    const marks = feedback(typed, puzzle.secret);
    const rows = [...puzzle.rows, { guess: typed, marks }];
    const next: Puzzle = { ...puzzle, rows, startedAt: puzzle.startedAt ?? now };
    const done = isOver(next);
    if (done) next.endedAt = now;
    startedHere.current = next;
    setPuzzle(next);
    setTyped('');
    marks.forEach((m, i) => sfx.reveal(i, m));

    const solved = isSolved(next);
    let streak: number | undefined;
    if (next.mode === 'daily' && next.day) {
      const day = next.day;
      const saved = commit((s) => {
        s.days[day] = { guesses: rows.map((r) => r.guess), startedAt: next.startedAt!, ...(done ? { endedAt: now } : {}) };
        if (done) finishDaily(s, day, solved, rows.length);
      });
      streak = saved.stats.streak;
    } else if (done) commit((s) => finishPractice(s, solved, rows.length));

    if (done) {
      host.report({ type: 'end', ...roundStats({ solved, guesses: rows.length, seconds: secondsOf(next) }, streak) });
      if (solved) sfx.win();
      else sfx.lose();
      later(() => setPanel('stats'), REVEAL_MS + 500);
    }
  };

  const goDaily = (): void => {
    const today = dayKey();
    if (daily.day !== today) setDaily(dailyPuzzle(save, today));
    setMode('daily');
    setTyped('');
  };

  const newPractice = (): void => {
    setPractice(practicePuzzle());
    setMode('practice');
    setTyped('');
    setPanel('none');
  };

  const goPractice = (): void => {
    if (!practice || isOver(practice)) setPractice(practicePuzzle());
    setMode('practice');
    setTyped('');
  };

  const closePanel = (): void => {
    if (panel === 'help' && !save.seenHelp) commit((s) => void (s.seenHelp = true));
    setPanel('none');
  };

  const toggleSound = (): void => {
    const muted = !save.muted;
    sfx.setMuted(muted);
    commit((s) => void (s.muted = muted));
  };

  const share = async (): Promise<void> => {
    const text = shareText({
      rows: puzzle.rows,
      solved: isSolved(puzzle),
      daily: puzzle.day ? puzzleNumber(puzzle.day) : undefined,
      url: `${SITE_URL}/games/letter-pinch`,
    });
    const outcome = await shareOrCopy({ title: 'Letter Pinch', text });
    if (outcome === 'copied') flash('Result copied');
    else if (outcome === 'failed') flash('Could not share from this browser');
  };

  // Physical keyboard. The handler is refreshed every render so it always sees the current state.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    onKeyRef.current = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape' && panel !== 'none') {
        closePanel();
        return;
      }
      // Let a focused button handle its own Enter/Space.
      if (t?.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (panel !== 'none') closePanel();
        else submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        erase();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key.toLowerCase());
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => onKeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Release everything when the game unmounts (issue #11).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      sfx.close();
    };
  }, [sfx]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Countdown to the next daily, only while the stats panel is open.
  useEffect(() => {
    if (panel !== 'stats') return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [panel]);

  const today = dayKey();
  const streak = shownStreak(save.stats, today);

  return (
    <div className="lp" data-mode={mode}>
      <header className="lp-top">
        <div className="lp-tabs" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === 'daily'} className="lp-tab" onClick={goDaily}>
            Daily <span className="lp-tab-num">#{puzzleNumber(today)}</span>
          </button>
          <button role="tab" aria-selected={mode === 'practice'} className="lp-tab" onClick={goPractice}>
            Practice
          </button>
        </div>
        <div className="lp-tools">
          {streak > 0 && (
            <span className="lp-streak" title="Daily streak">
              <FlameIcon /> {streak}
            </span>
          )}
          <IconButton label="How to play" onClick={() => setPanel('help')}>
            <HelpIcon />
          </IconButton>
          <IconButton label="Statistics" onClick={() => setPanel('stats')}>
            <BarsIcon />
          </IconButton>
          <IconButton label={save.muted ? 'Turn sound on' : 'Turn sound off'} onClick={toggleSound}>
            <SoundIcon off={save.muted} />
          </IconButton>
        </div>
      </header>

      <main className="lp-board" aria-label="Guesses">
        <Windows windows={windows} />
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const row = puzzle.rows[r];
          const current = r === puzzle.rows.length && !over;
          return (
            <div key={`${puzzle.secret}-${r}`} className={`lp-row${current ? ' is-current' : ''}`} data-shake={current ? shake % 2 : undefined}>
              {Array.from({ length: WORD_LEN }, (_, i) => {
                if (row) {
                  const m = row.marks[i]!;
                  return (
                    <div key={i} className={`lp-tile is-${m}`} style={{ animationDelay: `${i * 120}ms` }} aria-label={`${row.guess[i]!.toUpperCase()}, ${MARK_TEXT[m]}`}>
                      <span className="lp-letter">{row.guess[i]}</span>
                      <span className="lp-arrow" aria-hidden="true">
                        {ARROW[m]}
                      </span>
                    </div>
                  );
                }
                const ch = current ? typed[i] : undefined;
                return (
                  <div key={i} className={`lp-tile${ch ? ' is-typed' : ''}${current && i === typed.length ? ' is-cursor' : ''}`}>
                    <span className="lp-letter">{ch ?? ''}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </main>

      {over ? (
        <div className="lp-done">
          <button className="lp-cta" onClick={() => setPanel('stats')}>
            {isSolved(puzzle) ? 'See your result' : `The word was ${puzzle.secret.toUpperCase()}`}
          </button>
        </div>
      ) : (
        <Keyboard windows={windows} onLetter={typeLetter} onEnter={submit} onErase={erase} />
      )}

      {toast && (
        <div key={toast.id} className="lp-toast" role="status">
          {toast.text}
        </div>
      )}
      {panel === 'help' && <HelpPanel onClose={closePanel} />}
      {panel === 'stats' && (
        <StatsPanel puzzle={puzzle} save={save} streak={streak} onClose={closePanel} onShare={() => void share()} onPractice={newPractice} onDaily={() => {
          goDaily();
          setPanel('none');
        }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Windows({ windows }: { windows: Window[] }) {
  return (
    <div className="lp-windows" aria-label="Where each letter can still be">
      {windows.map((w, i) => {
        const pinned = w.lo === w.hi;
        return (
          <div key={i} className={`lp-win${pinned ? ' is-pinned' : ''}`} aria-label={pinned ? `Letter ${i + 1}: ${letterAt(w.lo).toUpperCase()}` : `Letter ${i + 1}: ${letterAt(w.lo).toUpperCase()} to ${letterAt(w.hi).toUpperCase()}`}>
            <span className="lp-win-label">{pinned ? letterAt(w.lo) : `${letterAt(w.lo)}–${letterAt(w.hi)}`}</span>
            <span className="lp-win-track">
              <span className="lp-win-fill" style={{ left: `${(w.lo / 26) * 100}%`, width: `${((w.hi - w.lo + 1) / 26) * 100}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Keyboard({ windows, onLetter, onEnter, onErase }: { windows: Window[]; onLetter: (c: string) => void; onEnter: () => void; onErase: () => void }) {
  const noFocus = (e: MouseEvent): void => e.preventDefault();
  return (
    <div className="lp-keys" aria-label="Keyboard">
      {KEY_ROWS.map((row, r) => (
        <div key={row} className="lp-keyrow">
          {r === 2 && (
            <button className="lp-key lp-key-wide" onMouseDown={noFocus} onClick={onEnter}>
              Enter
            </button>
          )}
          {[...row].map((ch) => (
            <button key={ch} className={`lp-key is-${keyState(ch, windows)}`} onMouseDown={noFocus} onClick={() => onLetter(ch)}>
              {ch}
            </button>
          ))}
          {r === 2 && (
            <button className="lp-key lp-key-wide" onMouseDown={noFocus} onClick={onErase} aria-label="Delete letter">
              <EraseIcon />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="lp-scrim" onClick={onClose}>
      <section className="lp-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="lp-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

function ExampleRow({ word, marks }: { word: string; marks: Mark[] }) {
  return (
    <div className="lp-row lp-example">
      {[...word].map((ch, i) => (
        <div key={i} className={`lp-tile is-${marks[i]}`}>
          <span className="lp-letter">{ch}</span>
          <span className="lp-arrow" aria-hidden="true">
            {ARROW[marks[i]!]}
          </span>
        </div>
      ))}
    </div>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="How to play" onClose={onClose}>
      <h2 className="lp-h">Pinch the word</h2>
      <p>Find the secret 5-letter word in {MAX_GUESSES} guesses. Each tile points toward the secret letter in its column.</p>
      <ExampleRow word="mouse" marks={feedback('mouse', 'grape')} />
      <ul className="lp-legend">
        <li>
          <span className="lp-chip is-up">▲</span> the secret letter is <b>later</b> in the alphabet
        </li>
        <li>
          <span className="lp-chip is-down">▼</span> it is <b>earlier</b>
        </li>
        <li>
          <span className="lp-chip is-hit">●</span> exact
        </li>
      </ul>
      <p>The bars above the board squeeze in to show where each letter can still be. Every guess must be a real word.</p>
      <p className="lp-small">Daily: one word a day, the same for everyone. Practice: as many as you like.</p>
      <button className="lp-cta" onClick={onClose}>
        Let&rsquo;s play
      </button>
    </Sheet>
  );
}

function Dist({ tally, highlight }: { tally: Tally; highlight?: number }) {
  const max = Math.max(1, ...tally.dist);
  return (
    <ol className="lp-dist" aria-label="Guess distribution">
      {tally.dist.map((n, i) => (
        <li key={i}>
          <span className="lp-dist-n">{i + 1}</span>
          <span className={`lp-dist-bar${highlight === i + 1 ? ' is-now' : ''}`} style={{ width: `${Math.max(8, (n / max) * 100)}%` }}>
            {n}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StatsPanel(props: { puzzle: Puzzle; save: PinchSave; streak: number; onClose: () => void; onShare: () => void; onPractice: () => void; onDaily: () => void }) {
  const { puzzle, save, streak } = props;
  const over = isOver(puzzle);
  const solved = isSolved(puzzle);
  const s = save.stats;
  const isDaily = puzzle.mode === 'daily';
  const dailyDone = isOver(dailyPuzzle(save, dayKey()));
  return (
    <Sheet title="Statistics" onClose={props.onClose}>
      {over && (
        <div className="lp-result">
          <p className="lp-kicker">{isDaily ? `Daily #${puzzleNumber(puzzle.day!)}` : 'Practice'}</p>
          <h2 className="lp-h">{solved ? (puzzle.rows.length <= 2 ? 'Unreal!' : puzzle.rows.length <= 4 ? 'Pinched it!' : 'Got there!') : 'So close'}</h2>
          <div className="lp-row lp-answer" aria-label={`The word was ${puzzle.secret}`}>
            {[...puzzle.secret].map((ch, i) => (
              <div key={i} className={`lp-tile ${solved ? 'is-hit' : 'is-reveal'}`} style={{ animationDelay: `${i * 70}ms` }}>
                <span className="lp-letter">{ch}</span>
              </div>
            ))}
          </div>
          <p className="lp-score">
            <b>{scoreRound({ solved, guesses: puzzle.rows.length, seconds: secondsOf(puzzle) })}</b> points
            {solved && (
              <span>
                {' '}· {puzzle.rows.length}/{MAX_GUESSES} · {Math.max(1, Math.round(secondsOf(puzzle)))}s
              </span>
            )}
          </p>
          <div className="lp-actions">
            <button className="lp-cta" onClick={props.onShare}>
              <ShareIcon /> Share result
            </button>
            {isDaily ? (
              <button className="lp-cta is-alt" onClick={props.onPractice}>
                Practice puzzle
              </button>
            ) : (
              <button className="lp-cta is-alt" onClick={props.onPractice}>
                Next puzzle
              </button>
            )}
          </div>
        </div>
      )}
      <h3 className="lp-h3">Daily stats</h3>
      <div className="lp-nums">
        <Num n={s.played} label="Played" />
        <Num n={s.played ? Math.round((s.wins / s.played) * 100) : 0} label="Win %" />
        <Num n={streak} label="Streak" />
        <Num n={s.maxStreak} label="Best" />
      </div>
      <Dist tally={s} highlight={isDaily && solved ? puzzle.rows.length : undefined} />
      <p className="lp-small">
        Practice: {save.practice.wins} solved of {save.practice.played} played.
      </p>
      {dailyDone ? (
        <p className="lp-next">
          Next daily in <b className="lp-mono">{formatCountdown(msUntilMidnight())}</b>
        </p>
      ) : (
        !isDaily && (
          <button className="lp-cta is-alt" onClick={props.onDaily}>
            Play today&rsquo;s daily
          </button>
        )
      )}
    </Sheet>
  );
}

const Num = ({ n, label }: { n: number; label: string }) => (
  <div className="lp-num">
    <b>{n}</b>
    <span>{label}</span>
  </div>
);

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="lp-icon" onClick={onClick} aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ icons */

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const HelpIcon = () => (
  <svg {...svg} aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.9" />
    <circle cx="12" cy="17.4" r="0.6" fill="currentColor" />
  </svg>
);
const BarsIcon = () => (
  <svg {...svg} aria-hidden="true">
    <path d="M5 20V12M12 20V5M19 20v-9" />
  </svg>
);
const SoundIcon = ({ off }: { off: boolean }) => (
  <svg {...svg} aria-hidden="true">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.6 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
const EraseIcon = () => (
  <svg {...svg} aria-hidden="true">
    <path d="M9 5h11v14H9l-6-7z" />
    <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
  </svg>
);
const ShareIcon = () => (
  <svg {...svg} width={18} height={18} aria-hidden="true">
    <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />
  </svg>
);
const FlameIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="currentColor" />
  </svg>
);
