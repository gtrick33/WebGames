import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import type { ChallengeSpec } from '../../platform/challenge';
import { dayKey, formatCountdown, msUntilMidnight } from '../../platform/dates';
import { SITE_URL } from '../../platform/env';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { howToSeen } from '../../components/HowTo';
import {
  checkGuess,
  dailySecret,
  describeGuess,
  feedback,
  keyState,
  letterAt,
  MAX_GUESSES,
  practiceSecret,
  puzzleNumber,
  rng,
  roundStats,
  scoreRound,
  resultGrid,
  shareText,
  windowsFor,
  WORD_LEN,
  type Mark,
  type Row,
  type Window,
} from './logic';
import { createSfx, type Sfx } from './sfx';
import { finishDaily, finishPractice, loadSave, readSave, SAVE_KEY, shownStreak, storeSave, type DayProgress, type PinchSave, type Tally } from './storage';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { GameMenuButton } from '../../components/GameMenuButton';

type Mode = 'daily' | 'practice' | 'challenge';
type Panel = 'none' | 'help' | 'stats' | 'paused';

interface Puzzle {
  mode: Mode;
  secret: string;
  /** The daily's date: the daily, and a "Today's daily" challenge (which plays that daily). */
  day?: string;
  rows: Row[];
  /** Epoch ms of the first typed letter. */
  startedAt: number | null;
  endedAt: number | null;
  /** Solve-clock time banked so far (ms). */
  activeMs: number;
  /** When the solve clock last started running; null while it is stopped. */
  since: number | null;
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const REVEAL_MS = 120 * WORD_LEN + 380;
const ARROW: Record<Mark, string> = { up: '▲', down: '▼', hit: '●' };
const MARK_TEXT: Record<Mark, string> = { up: 'later in the alphabet', down: 'earlier in the alphabet', hit: 'exact' };

function fromProgress(mode: Mode, secret: string, p: DayProgress | undefined, day?: string): Puzzle {
  const startedAt = p?.startedAt || null;
  const endedAt = p?.endedAt ?? null;
  return {
    mode,
    secret,
    ...(day ? { day } : {}),
    rows: (p?.guesses ?? []).map((guess) => ({ guess, marks: feedback(guess, secret) })),
    startedAt,
    endedAt,
    // Older saves have no clock: their time was first guess to the end.
    activeMs: p?.activeMs ?? (startedAt && endedAt ? endedAt - startedAt : 0),
    since: null,
  };
}

const dailyPuzzle = (save: PinchSave, day: string): Puzzle => fromProgress('daily', dailySecret(day), save.days[day], day);

/** The practice board left open, or a fresh random word (never today's daily). */
const practicePuzzle = (save?: PinchSave): Puzzle =>
  save?.openPractice ? fromProgress('practice', save.openPractice.secret, save.openPractice) : fromProgress('practice', practiceSecret(Math.random, dailySecret(dayKey())), undefined);

const challengeKey = (c: ChallengeSpec): string => `${c.id}:${c.round}`;
/** A "Today's daily" challenge plays that day's real daily. */
const challengeDay = (c: ChallengeSpec): string | undefined => (c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : undefined);

function challengePuzzle(save: PinchSave, c: ChallengeSpec): Puzzle {
  const day = challengeDay(c);
  if (day) return fromProgress('challenge', dailySecret(day), save.days[day], day);
  return fromProgress('challenge', practiceSecret(rng(c.seed ^ 0x9e3779b9)), save.challenges[challengeKey(c)]);
}

const isSolved = (p: Puzzle): boolean => p.rows.at(-1)?.guess === p.secret;
const isOver = (p: Puzzle): boolean => isSolved(p) || p.rows.length >= MAX_GUESSES;
/** A fresh challenge round is raced on real time: hiding the tab never stops its clock. */
const realTime = (p: Puzzle): boolean => p.mode === 'challenge' && !p.day;

function elapsedMs(p: Puzzle, now: number): number {
  if (!p.startedAt) return 0;
  if (realTime(p)) return Math.max(0, (p.endedAt ?? now) - p.startedAt);
  return p.activeMs + (p.since !== null ? Math.max(0, now - p.since) : 0);
}
const secondsOf = (p: Puzzle): number => elapsedMs(p, p.endedAt ?? Date.now()) / 1000;
/** The clock stopped, its time banked. */
const stopped = (p: Puzzle, now: number): Puzzle => (p.since === null ? p : { ...p, activeMs: elapsedMs(p, now), since: null });
/** The clock running again (only for a started, unfinished board). */
const running = (p: Puzzle, now: number): Puzzle => (p.since !== null || !p.startedAt || isOver(p) ? p : { ...p, since: now });

const progressOf = (p: Puzzle, now: number): DayProgress => ({
  guesses: p.rows.map((r) => r.guess),
  startedAt: p.startedAt ?? now,
  ...(p.endedAt ? { endedAt: p.endedAt } : {}),
  activeMs: Math.round(elapsedMs(p, now)),
});

const clockText = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Letter Pinch: each tile points the way through the alphabet to the secret letter. */
export default function Game({ host, challenge, pauseKey }: GameModuleProps) {
  const [save, setSave] = useState<PinchSave>(loadSave);
  const [mode, setMode] = useState<Mode>(() => (challenge ? 'challenge' : save.lastMode === 'practice' && save.openPractice ? 'practice' : 'daily'));
  const [today, setToday] = useState(dayKey);
  const [daily, setDaily] = useState<Puzzle>(() => dailyPuzzle(save, today));
  const [practice, setPractice] = useState<Puzzle | null>(() => (save.openPractice ? practicePuzzle(save) : null));
  // A friends' challenge round: one attempt, saved on every move so a reload resumes it.
  const [chal, setChal] = useState<Puzzle | null>(() => (challenge ? challengePuzzle(save, challenge) : null));
  const [typed, setTyped] = useState('');
  // A challenge opens on its own board, even when today's daily is already done.
  // The rules open only when asked for (the ? glows until the first time); a finished daily opens on its stats.
  const [panel, setPanel] = useState<Panel>(() => (isOver(chal ?? (mode === 'practice' && practice ? practice : daily)) ? 'stats' : 'none'));
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [said, setSaid] = useState('');
  const [shake, setShake] = useState(0);
  /** The clock's "now", moved on once a second while something on screen counts time. */
  const [now, setNow] = useState(() => Date.now());
  const [sfx] = useState<Sfx>(() => createSfx(save.muted));
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const puzzle = mode === 'challenge' && chal ? chal : mode === 'practice' && practice ? practice : daily;
  const setPuzzle = (p: Puzzle): void => (p.mode === 'challenge' ? setChal(p) : p.mode === 'practice' ? setPractice(p) : setDaily(p));
  const over = isOver(puzzle);
  const windows = windowsFor(puzzle.rows);
  const chalOpen = !!chal && !isOver(chal);

  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Read-modify-write: another tab's progress in the stored save is never overwritten by this tab's copy. */
  const commit = (mutate: (s: PinchSave) => void): PinchSave => {
    const next = readSave() ?? structuredClone(save);
    mutate(next);
    storeSave(next, dayKey());
    setSave(next);
    return next;
  };

  /** Saves a board where it belongs. A board another tab already finished is kept as it is. */
  const writeBoard = (s: PinchSave, p: Puzzle, now: number): void => {
    const rec = progressOf(p, now);
    if (p.day) {
      if (!s.days[p.day]?.endedAt) s.days[p.day] = rec;
    } else if (p.mode === 'challenge' && challenge) {
      const key = challengeKey(challenge);
      const old = s.challenges[key];
      if (!old?.endedAt) s.challenges[key] = { ...rec, ...(old?.reported ? { reported: true } : {}) };
    } else if (p.mode === 'practice') s.openPractice = isOver(p) ? null : { ...rec, secret: p.secret };
  };

  /**
   * The one place a round's end is reported to the arcade. Only today's daily counts as this game's own
   * daily round (a daily finished after midnight stays yesterday's). A challenge round is reported once.
   */
  const reportEnd = (p: Puzzle, streak?: number): void => {
    const isToday = !!p.day && p.day === dayKey();
    const { score, stats } = roundStats({ solved: isSolved(p), guesses: p.rows.length, seconds: secondsOf(p) }, p.day ? streak : undefined);
    if (p.mode === 'challenge' && challenge) {
      const key = challengeKey(challenge);
      let already = false;
      commit((s) => {
        already = !!s.challenges[key]?.reported;
        s.challenges[key] = { ...(s.challenges[key] ?? { guesses: [], startedAt: Date.now() }), reported: true };
      });
      if (already) return;
      host.report({ type: 'end', score, stats, ...(isToday ? { daily: true } : {}), challenge: { id: challenge.id, round: challenge.round } });
    } else host.report(isToday ? { type: 'end', score, stats, daily: true } : { type: 'end', score, stats });
  };

  const flash = (text: string): void => setToast({ text, id: Date.now() });

  /** The board input goes to, started (clock and 'start' report) on the first letter. */
  const startBoard = (): Puzzle => {
    let p = puzzle;
    const now = Date.now();
    // Left open past midnight and never started: today's word takes its place.
    if (p.mode === 'daily' && !p.startedAt && p.day !== dayKey()) {
      setToday(dayKey());
      p = dailyPuzzle(save, dayKey());
    }
    if (!p.startedAt) {
      host.report({ type: 'start' });
      p = { ...p, startedAt: now, since: now };
      const first = p;
      commit((s) => writeBoard(s, first, now));
    } else p = running(p, now);
    if (p !== puzzle) setPuzzle(p);
    return p;
  };

  const typeLetter = (ch: string): void => {
    if (over || panel !== 'none') return;
    startBoard();
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
    const base = startBoard();
    const marks = feedback(typed, base.secret);
    const rows = [...base.rows, { guess: typed, marks }];
    let next: Puzzle = { ...base, rows };
    const done = isOver(next);
    if (done) next = { ...stopped(next, now), endedAt: now };
    setPuzzle(next);
    setTyped('');
    setSaid(describeGuess(rows.at(-1)!, windowsFor(rows)));
    marks.forEach((m, i) => sfx.reveal(i, m));

    const solved = isSolved(next);
    const saved = commit((s) => {
      writeBoard(s, next, now);
      if (!done) return;
      if (next.day) finishDaily(s, next.day, solved, rows.length);
      else if (next.mode === 'practice') finishPractice(s, solved, rows.length);
    });

    if (done) {
      reportEnd(next, saved.stats.streak);
      if (solved) sfx.win();
      else sfx.lose();
      later(() => setPanel('stats'), REVEAL_MS + 500);
    }
  };

  const goDaily = (): void => {
    const day = dayKey();
    setToday(day);
    if (daily.day !== day) setDaily(dailyPuzzle(save, day));
    setMode('daily');
    setTyped('');
    if (save.lastMode !== 'daily') commit((s) => void (s.lastMode = 'daily'));
  };

  const newPractice = (): void => {
    setPractice(practicePuzzle());
    setMode('practice');
    setTyped('');
    setPanel('none');
    commit((s) => {
      s.openPractice = null;
      s.lastMode = 'practice';
    });
  };

  const goPractice = (): void => {
    if (!practice || isOver(practice)) setPractice(practicePuzzle());
    setMode('practice');
    setTyped('');
    if (save.lastMode !== 'practice') commit((s) => void (s.lastMode = 'practice'));
  };

  const goChallenge = (): void => {
    setMode('challenge');
    setTyped('');
    if (chal && isOver(chal)) setPanel('stats');
  };

  /** Stops the solve clock and saves the time (tab hidden, the arcade paused the game). */
  const pauseClock = (): void => {
    if (puzzle.since === null) return;
    const now = Date.now();
    const p = stopped(puzzle, now);
    setPuzzle(p);
    commit((s) => writeBoard(s, p, now));
  };

  const closePanel = (): void => {
    if (panel === 'help' && !save.seenHelp) commit((s) => void (s.seenHelp = true));
    if (panel === 'paused') setPuzzle(running(puzzle, Date.now()));
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
      challenge: puzzle.mode === 'challenge',
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
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const root = rootRef.current;
      // Another dialog on the page (the site's share sheet, menus) has the keys.
      if (t?.closest('[role="dialog"], [aria-modal="true"]') && !root?.contains(t)) return;
      for (const d of document.querySelectorAll('[aria-modal="true"]')) if (!root?.contains(d)) return;
      // A control focused from the keyboard (a link, a button, a tab) keeps its Enter and Space. One clicked
      // with the mouse keeps no say: Enter after clicking a tab or the arcade's Restart submits the guess.
      if ((e.key === 'Enter' || e.key === ' ') && t && t !== document.body && t.matches(':focus-visible') && t.matches('a[href], button, summary, [role], [tabindex]')) return;
      if (e.key === 'Escape') {
        if (panel !== 'none') closePanel();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (panel !== 'none') closePanel();
        else submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        erase();
      } else if (/^[a-zA-Z]$/.test(e.key) && !e.repeat) {
        typeLetter(e.key.toLowerCase());
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => onKeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handlers the window listeners and effects below call, refreshed every render like the key handler.
  const live = useRef({
    storage: (e: StorageEvent): void => void e,
    show: (): void => undefined,
    pause: (): void => undefined,
    day: (): void => undefined,
    opened: (): void => undefined,
  });
  useEffect(() => {
    // Another tab wrote the save: take its progress, and leave a board it already finished.
    live.current.storage = (e: StorageEvent): void => {
      if (e.key !== SAVE_KEY && e.key !== null) return;
      const fresh = loadSave();
      setSave(fresh);
      sfx.setMuted(fresh.muted);
      const newer = (p: Puzzle, rec: DayProgress | undefined): boolean => !!rec && (rec.guesses.length > p.rows.length || (!!rec.endedAt && !p.endedAt));
      if (daily.day && newer(daily, fresh.days[daily.day])) {
        const p = dailyPuzzle(fresh, daily.day);
        setDaily(p);
        if (mode === 'daily') {
          setTyped('');
          if (isOver(p)) setPanel('stats');
        }
      }
      if (chal && challenge) {
        const rec = chal.day ? fresh.days[chal.day] : fresh.challenges[challengeKey(challenge)];
        if (newer(chal, rec)) {
          const p = challengePuzzle(fresh, challenge);
          setChal(p);
          if (mode === 'challenge') {
            setTyped('');
            if (isOver(p)) setPanel('stats');
          }
        }
      }
    };
    // The day is re-read; past midnight an untouched daily board moves on to today's word.
    live.current.day = (): void => {
      const d = dayKey();
      setToday(d);
      if (daily.day !== d && !daily.startedAt) setDaily(dailyPuzzle(save, d));
    };
    // The solve clock stops while the page is hidden and runs again when it is back.
    live.current.show = (): void => {
      live.current.day();
      if (document.hidden) pauseClock();
      else if (panel === 'none' && puzzle.since === null && puzzle.startedAt && !over) setPuzzle(running(puzzle, Date.now()));
    };
    // The arcade paused the game (left full screen, scrolled away): stop the clock, show the Paused card.
    live.current.pause = (): void => {
      if (!puzzle.startedAt || over) return;
      pauseClock();
      setPanel((p) => (p === 'none' ? 'paused' : p));
    };
    // A challenge round already over on this device (a reload, or the daily it plays was already done):
    // show the result, never a replay, and send the score if it was not sent yet.
    live.current.opened = (): void => {
      if (!chal || !isOver(chal) || !challenge) return;
      if (readSave()?.challenges[challengeKey(challenge)]?.reported) return;
      flash(chal.day ? 'Your daily result counts here' : 'This round was already played');
      reportEnd(chal, save.stats.streak);
    };
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => live.current.storage(e);
    const onShow = (): void => live.current.show();
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    const t = window.setInterval(() => live.current.day(), 20_000);
    live.current.opened();
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.clearInterval(t);
    };
  }, []);

  const pauseSeen = useRef(pauseKey);
  useEffect(() => {
    if (pauseKey === pauseSeen.current) return;
    pauseSeen.current = pauseKey;
    live.current.pause();
  }, [pauseKey]);

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

  // One tick a second while the clock runs or the stats panel counts down to the next daily.
  const ticking = panel === 'stats' || (puzzle.since !== null && !over) || (realTime(puzzle) && !!puzzle.startedAt && !over);
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      live.current.day();
    }, 1000);
    return () => window.clearInterval(t);
  }, [ticking]);

  const streak = shownStreak(save.stats, today);
  const shownDay = daily.day ?? today;
  // One first-visit hint at a time: the ? glows once the arcade's own How to play has been seen.
  const helpGlow = !save.seenHelp && howToSeen('letter-pinch');

  return (
    <div className="lp" data-mode={mode} ref={rootRef}>
      <div className="lp-in">
        <header className="lp-top">
          <div className="lp-tabs" role="tablist" aria-label="Mode" data-n={chal && !chalOpen ? 3 : chal ? 1 : 2}>
            {chal && (
              <button role="tab" aria-selected={mode === 'challenge'} className="lp-tab" onMouseDown={noFocus} onClick={goChallenge}>
                ⚔️ Challenge
              </button>
            )}
            {/* While a challenge round is open, nothing leaves it by accident. */}
            {!chalOpen && (
              <>
                <button role="tab" aria-selected={mode === 'daily'} className="lp-tab" onMouseDown={noFocus} onClick={goDaily}>
                  Daily <span className="lp-tab-num">#{puzzleNumber(shownDay)}</span>
                </button>
                <button role="tab" aria-selected={mode === 'practice'} className="lp-tab" onMouseDown={noFocus} onClick={goPractice}>
                  Practice
                </button>
              </>
            )}
          </div>
          <div className="lp-tools">
            {puzzle.startedAt && (
              <span className={`lp-clock${over ? ' is-done' : ''}`} role="timer" aria-label="Solve time" title={realTime(puzzle) ? 'Solve time (a challenge runs on real time)' : 'Solve time'}>
                {clockText(elapsedMs(puzzle, puzzle.endedAt ?? now))}
              </span>
            )}
            {streak > 0 && (
              <span className="lp-streak" title="Daily streak">
                <FlameIcon /> {streak}
              </span>
            )}
            <IconButton label="How to play" onClick={() => setPanel('help')} glow={helpGlow}>
              <HelpIcon />
            </IconButton>
            <IconButton label="Statistics" onClick={() => setPanel('stats')}>
              <BarsIcon />
            </IconButton>
            <IconButton label={save.muted ? 'Turn sound on' : 'Turn sound off'} onClick={toggleSound}>
              <SoundIcon off={save.muted} />
            </IconButton>
            <GameMenuButton className="lp-icon" />
          </div>
        </header>

        {puzzle.mode === 'challenge' && <p className="lp-chal">{puzzle.day ? `⚔️ Challenge: Daily #${puzzleNumber(puzzle.day)} for everyone, one try` : '⚔️ Challenge round: the same word for everyone, one try'}</p>}
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

        <p className="lp-sr" aria-live="polite">
          {said}
        </p>
        {toast && (
          <div key={toast.id} className="lp-toast" role="status">
            {toast.text}
          </div>
        )}
        {panel === 'help' && <HelpPanel onClose={closePanel} />}
        {panel === 'paused' && (
          <Sheet title="Paused" onClose={closePanel}>
            <h2 className="lp-h">Paused</h2>
            <p>{realTime(puzzle) ? 'A challenge round runs on real time: the clock keeps going.' : 'The clock is stopped. Your board is saved.'}</p>
            <button className="lp-cta" onClick={closePanel}>
              Resume
            </button>
          </Sheet>
        )}
        {panel === 'stats' && (
          <StatsPanel puzzle={puzzle} today={today} challengeId={puzzle.mode === 'challenge' ? challenge?.id : undefined} save={save} streak={streak} onClose={closePanel} onShare={() => void share()} onPractice={newPractice} onDaily={() => {
            goDaily();
            setPanel('none');
          }} />
        )}
      </div>
    </div>
  );
}

const noFocus = (e: MouseEvent): void => e.preventDefault();

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
      <p className="lp-small">
        Score: 200 for a solve, 100 for each guess to spare, and up to 100 more for speed. The clock starts at your first letter
        and stops while the game is hidden or paused (in a challenge round it never stops).
      </p>
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

function StatsPanel(props: { puzzle: Puzzle; today: string; challengeId?: string; save: PinchSave; streak: number; onClose: () => void; onShare: () => void; onPractice: () => void; onDaily: () => void }) {
  const { puzzle, save, streak } = props;
  const over = isOver(puzzle);
  const solved = isSolved(puzzle);
  const s = save.stats;
  const isDaily = puzzle.mode === 'daily';
  const dailyDone = isOver(dailyPuzzle(save, props.today));
  return (
    <Sheet title="Statistics" onClose={props.onClose}>
      {over && (
        <div className="lp-result">
          <p className="lp-kicker">{puzzle.mode === 'challenge' ? `⚔️ Challenge round${puzzle.day ? ` · Daily #${puzzleNumber(puzzle.day)}` : ''}` : isDaily ? `Daily #${puzzleNumber(puzzle.day!)}` : 'Practice'}</p>
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
          <ResultLine line={resultGrid(puzzle.rows)} label={solved ? `Solved in ${puzzle.rows.length} of ${MAX_GUESSES} guesses` : `Not solved in ${MAX_GUESSES} guesses`} />
          <div className="lp-actions">
            <button className="lp-cta" onClick={props.onShare}>
              <ShareIcon /> Share result
            </button>
            {props.challengeId ? (
              <a className="lp-cta is-alt" href={`/c/${props.challengeId}`} onClick={openChallengeScores}>
                See the scoreboard
              </a>
            ) : isDaily ? (
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
      <Dist tally={s} highlight={puzzle.day && solved ? puzzle.rows.length : undefined} />
      <p className="lp-small">
        Practice: {save.practice.wins} solved of {save.practice.played} played.
      </p>
      {dailyDone ? (
        <p className="lp-next">
          Next daily in <b className="lp-mono">{formatCountdown(msUntilMidnight())}</b>
        </p>
      ) : (
        // Also after midnight, when the board still shows yesterday's daily.
        (!isDaily || puzzle.day !== props.today) && (
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

function IconButton({ label, onClick, children, glow = false }: { label: string; onClick: () => void; children: ReactNode; glow?: boolean }) {
  return (
    <button className={`lp-icon${glow ? ' is-new' : ''}`} onClick={onClick} aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()}>
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
