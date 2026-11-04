import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import type { ContentLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { answerText, bankSize, leverStart, CATS, challengeQuiz, dailyNumber, dailyQuiz, EndlessDealer, judge, MAX_POINTS, numberText, pickText, QUIZ_LENGTH, scorePick, timeLimit, type Pick, type Question, type Verdict } from './deck';
import { openChallengeScores } from '../../platform/challenge';
import { EN, loadPack, type Pack } from './pack';
import { melodyLength, morseText, playMorse, playTune } from './sound';
import { UI, type Ui } from './ui';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';
import { gameUrl } from '../../catalog/urls';

const STORE = 'glitchbound.wait-what';
const STRIKES = 3;

/** One quiz in progress or finished: picks are answers (see Pick; -1 = ran out of time). */
interface Run {
  picks: Pick[];
  secs: number[];
  pts: number[];
  /**
   * The question being shown: seconds already spent on it (endless pauses for real), and in the daily
   * and challenges `at`, when it was asked (Date.now()), so hiding the tab or reloading never stops its clock.
   */
  cur?: { i: number; secs: number; at?: number };
  done: boolean;
}
interface Save {
  daily: Record<string, Run>;
  /** Challenge rounds, keyed "<id>:<round>". */
  runs: Record<string, Run>;
  seen: string[];
  best: number;
  bestStreak: number;
  bestEndless: number;
  answered: number;
  right: number;
}
const emptySave = (): Save => ({ daily: {}, runs: {}, seen: [], best: 0, bestStreak: 0, bestEndless: 0, answered: 0, right: 0 });
const emptyRun = (): Run => ({ picks: [], secs: [], pts: [], done: false });

const count = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
const isPick = (v: unknown): v is Pick => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 60) || (Array.isArray(v) && v.length <= 4 && v.every((x) => Number.isInteger(x)));

/** A stored run, checked: anything malformed is dropped (a corrupted save never crashes the game). */
function cleanRun(v: unknown): Run | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<Run>;
  if (!Array.isArray(o.picks) || !Array.isArray(o.secs) || !Array.isArray(o.pts) || !o.picks.every(isPick)) return null;
  const n = Math.min(o.picks.length, o.secs.length, o.pts.length, 500);
  const c = o.cur;
  const cur = c && typeof c === 'object' && Number.isInteger(c.i) ? { i: c.i, secs: count(c.secs, 60), ...(typeof c.at === 'number' && Number.isFinite(c.at) ? { at: c.at } : {}) } : undefined;
  return { picks: o.picks.slice(0, n), secs: o.secs.slice(0, n).map((x) => count(x, 60)), pts: o.pts.slice(0, n).map((x) => count(x, 150)), ...(cur ? { cur } : {}), done: o.done === true };
}
const cleanRuns = (v: unknown): Record<string, Run> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).flatMap(([k, r]) => (cleanRun(r) ? [[k, cleanRun(r)!]] : []))) : {};

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return emptySave();
    return {
      daily: cleanRuns(o.daily),
      runs: cleanRuns(o.runs),
      seen: Array.isArray(o.seen) ? o.seen.filter((x): x is string => typeof x === 'string') : [],
      best: count(o.best, MAX_POINTS),
      bestStreak: count(o.bestStreak, 1e6),
      bestEndless: count(o.bestEndless, 1e6),
      answered: count(o.answered),
      right: count(o.right),
    };
  } catch {
    return emptySave();
  }
}

/** The run to keep for a key: another tab's when it got further (finished, or more answers in). */
const further = (stored: Run | undefined, mine: Run): Run => (stored && ((stored.done && !mine.done) || stored.picks.length > mine.picks.length) ? stored : mine);

/**
 * Whether a key press is meant for the game: not typed into a field, a dialog or something outside
 * the game, not a held-down repeat (unless `repeats`), and not Enter or Space on a keyboard-focused button.
 */
function forGame(e: KeyboardEvent, repeats = false): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.repeat && !repeats)) return false;
  const t = e.target;
  if (!(t instanceof Element) || t === document.body || t === document.documentElement) return true;
  if (t.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"]')) return false;
  if (t instanceof HTMLInputElement && t.type !== 'range') return false;
  if (!t.closest('.ww')) return false;
  if ((e.key === 'Enter' || e.key === ' ') && t.closest('button')) {
    try {
      if (t.closest('button')!.matches(':focus-visible')) return false;
    } catch {
      /* no :focus-visible */
    }
  }
  return true;
}
function writeSave(s: Save): void {
  try {
    const days = Object.keys(s.daily).sort().slice(-60);
    const runs = Object.keys(s.runs).slice(-30);
    localStorage.setItem(STORE, JSON.stringify({ ...s, daily: Object.fromEntries(days.map((d) => [d, s.daily[d]])), runs: Object.fromEntries(runs.map((k) => [k, s.runs[k]])), seen: s.seen.slice(-3000) }));
  } catch {
    /* storage blocked */
  }
}

type Mode = 'daily' | 'endless' | 'challenge';

/** Emoji drifting around the menu: [emoji, left %, top %]. */
const FLOATERS: [string, number, number][] = [
  ['🐙', 4, 4],
  ['🚀', 86, 3],
  ['🍕', 2, 38],
  ['🏛️', 90, 30],
  ['🧪', 5, 70],
  ['🤨', 88, 62],
  ['⏳', 10, 92],
  ['🎬', 84, 90],
];
/** `day`: the day the round started on (a daily started before midnight finishes as that day's). */
type Screen = { kind: 'menu' } | { kind: 'play'; mode: Mode; key: string; day: string };

/** The language the game plays in: its questions (pack) and its own text (ui). */
const Lang = createContext<{ p: Pack; u: Ui }>({ p: EN, u: UI.en });

export default function Game({ host, restartKey, pauseKey, challenge, lang = 'en' }: GameModuleProps) {
  return (
    <LangGate lang={lang}>
      <WaitWhat key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />
    </LangGate>
  );
}

/** Loads the questions for the language (English is built in), then shows the game. */
function LangGate({ lang, children }: { lang: ContentLang; children: ReactNode }) {
  const [pack, setPack] = useState<Pack | null>(lang === 'en' ? EN : null);
  useEffect(() => {
    let live = true;
    if (lang !== 'en') void loadPack(lang).then((p) => live && setPack(p), () => live && setPack(EN));
    return () => {
      live = false;
    };
  }, [lang]);
  const value = useMemo(() => (pack ? { p: pack, u: pack.ui ?? (UI as Partial<Record<string, Ui>>)[pack.lang] ?? UI.en } : null), [pack]);
  if (!value) return <div className="ww ww-menu" aria-busy="true" />;
  return <Lang.Provider value={value}>{children}</Lang.Provider>;
}

function WaitWhat({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // Today moves on at midnight: read again whenever the menu shows or the page comes back.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  // Every write starts from what is stored now, so another tab's progress is never written over.
  const commit = useCallback((update: (s: Save) => Save) => {
    const s = update(loadSave());
    setSave(s);
    writeSave(s);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== STORE && e.key !== null) return;
      setSave(loadSave());
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
  const [screen, setScreen] = useState<Screen>(() => (challenge ? { kind: 'play', mode: 'challenge', key: `${challenge.id}:${challenge.round}`, day: today } : { kind: 'menu' }));
  const [runs, setRuns] = useState(0);
  const { p, u } = useContext(Lang);

  if (screen.kind === 'play')
    return (
      <Play
        key={`${screen.key}:${runs}`}
        mode={screen.mode}
        today={screen.day}
        challenge={challenge}
        host={host}
        pauseKey={pauseKey}
        save={save}
        commit={commit}
        onMenu={() => {
          setToday(dayKey());
          setScreen({ kind: 'menu' });
        }}
        onAgain={() => {
          setRuns((n) => n + 1);
          setScreen({ kind: 'play', mode: 'endless', key: 'endless', day: dayKey() });
        }}
      />
    );

  const todays = save.daily[today];
  const total = bankSize(today, p);
  const seen = save.seen.filter((id) => !/^(time|near):/.test(id)).length;
  return (
    <div className="ww ww-menu">
      <div className="ww-menu-top"><GameMenuButton className="ww-menu-btn" /></div>
      <div className="ww-float" aria-hidden="true">
        {FLOATERS.map(([e, x, y], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, ['--i' as string]: i }}>
            {e}
          </span>
        ))}
      </div>
      {/* The pun: disbelief, with the "dis" struck out for a quiz. */}
      <h2 className="ww-logo" aria-label="Quizbelief">
        <span className="ww-logo-a">
          <s aria-hidden="true">DIS</s>QUIZ
        </span>
        <span className="ww-logo-b">
          BELIEF<b>?!</b>
        </span>
      </h2>
      <p className="ww-tag">{u.tag}</p>

      <section className="ww-card ww-card-daily">
        <div className="ww-card-head">
          <b>{u.dailyQuiz(dailyNumber(today))}</b>
          <span>
            {todays?.done
              ? u.pointsRight(
                  todays.pts.reduce((a, b) => a + b, 0).toLocaleString(p.locale),
                  todays.pts.filter((x) => x > 0).length,
                  QUIZ_LENGTH,
                )
              : todays
                ? u.inProgress(todays.picks.length, QUIZ_LENGTH)
                : u.sameForEveryone}
          </span>
        </div>
        <button
          className="ww-btn ww-btn-go"
          onClick={() => {
            const day = dayKey();
            setToday(day);
            setScreen({ kind: 'play', mode: 'daily', key: `daily:${day}`, day });
          }}
        >
          {todays?.done ? u.seeResults : todays ? u.continue : u.playToday}
        </button>
      </section>

      <section className="ww-card">
        <div className="ww-card-head">
          <b>{u.endless}</b>
          <span>{u.endlessBlurb}</span>
        </div>
        <button className="ww-btn" onClick={() => setScreen({ kind: 'play', mode: 'endless', key: 'endless', day: dayKey() })}>
          {u.startEndless}
        </button>
      </section>

      <p className="ww-muted">
        {save.answered ? u.answeredRight(save.right.toLocaleString(p.locale), save.answered.toLocaleString(p.locale), save.bestEndless) : ''}
        {u.seenOf(seen.toLocaleString(p.locale), total.toLocaleString(p.locale))}
      </p>
      <p className="ww-muted ww-small">
        {u.help} {u.timeEach}
      </p>
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

function Play(props: {
  mode: Mode;
  today: string;
  challenge?: ChallengeSpec;
  host: GameHost;
  pauseKey?: number;
  /** The save when this quiz opened (read once, for resuming). */
  save: Save;
  commit: (update: (s: Save) => Save) => void;
  onMenu: () => void;
  onAgain: () => void;
}) {
  const { mode, challenge, host, commit } = props;
  const { p, u } = useContext(Lang);
  // "Today's daily" as a challenge plays that day's real daily, and counts as it (one attempt for both).
  const dailyChallenge = mode === 'challenge' && challenge?.mode === 'daily' && !!challenge.day ? challenge.day : null;
  const today = dailyChallenge ?? props.today;
  const dayKeyOf = mode === 'daily' || dailyChallenge ? today : null;
  const runKey = mode === 'daily' ? today : mode === 'challenge' && challenge ? `${challenge.id}:${challenge.round}` : null;
  const kept = mode === 'daily' ? props.save.daily[today] : runKey ? props.save.runs[runKey] : undefined;
  // That day's daily already finished: its result is this challenge round's score.
  const [fromDaily] = useState(() => !!dailyChallenge && !kept?.done && !!props.save.daily[dailyChallenge]?.done);
  const stored = fromDaily ? props.save.daily[dailyChallenge!] : dailyChallenge ? further(props.save.daily[dailyChallenge], kept ?? emptyRun()) : kept;
  // The daily and challenges are compared with other players: their clock is real time.
  const live = mode !== 'endless';

  const [dealer] = useState(() => (mode === 'endless' ? new EndlessDealer(props.save.seen, undefined, p) : null));
  const [qs, setQs] = useState<Question[]>(() => (mode === 'daily' || dailyChallenge ? dailyQuiz(today, p) : mode === 'challenge' && challenge ? challengeQuiz(challenge.seed, challenge.day, p) : [dealer!.next()]));
  const [run, setRun] = useState<Run>(() => stored ?? emptyRun());
  const idx = run.done ? qs.length : run.picks.length;
  // A finished round shows its results (one attempt: never played again). Reloaded while the last
  // answer was on show: show it again (then the results), never ask it twice.
  const [phase, setPhase] = useState<'ask' | 'reveal' | 'done'>(() => (stored?.done ? 'done' : mode !== 'endless' && stored && stored.picks.length >= qs.length ? 'reveal' : 'ask'));
  // When the question on show was asked (live clock), or seconds already spent on it (endless).
  const resumed = stored?.cur && stored.cur.i === stored.picks.length ? stored.cur : undefined;
  const [firstAsked] = useState(() => (resumed ? (resumed.at ?? Date.now() - resumed.secs * 1000) : Date.now()));
  const askedAt = useRef(firstAsked);
  const [elapsed, setElapsed] = useState(() => (live ? (resumed ? (Date.now() - firstAsked) / 1000 : 0) : (resumed?.secs ?? 0)));
  const [paused, setPaused] = useState(false);
  const started = useRef(false);
  // While revealing, keep showing the question just answered.
  const q = qs[Math.min(phase === 'reveal' ? idx - 1 : idx, qs.length - 1)]!;
  const limit = timeLimit(q);
  const verdicts = run.picks.map((p, i) => (qs[i] ? judge(qs[i], p) : 'wrong'));
  const strikes = verdicts.filter((v) => v === 'wrong' || v === 'timeout').length;
  const score = run.pts.reduce((a, b) => a + b, 0);

  // Keep the run saved (daily and challenge; a daily challenge also as that day's daily).
  const persist = useCallback(
    (r: Run) => {
      if (!runKey) return;
      commit((s) => {
        const daily = dayKeyOf ? { ...s.daily, [dayKeyOf]: further(s.daily[dayKeyOf], r) } : s.daily;
        return mode === 'daily' ? { ...s, daily } : { ...s, daily, runs: { ...s.runs, [runKey]: further(s.runs[runKey], r) } };
      });
    },
    [commit, mode, runKey, dayKeyOf],
  );

  // Pause when the arcade asks (left full screen, scrolled away) or the tab is hidden. In the daily and
  // challenges the question is hidden but its clock keeps running.
  const firstPause = useRef(props.pauseKey);
  useEffect(() => {
    if (props.pauseKey !== firstPause.current && phase === 'ask') setPaused(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pauseKey]);
  useEffect(() => {
    const onVis = (): void => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (phase === 'ask' && !started.current) {
      started.current = true;
      host.report({ type: 'start' });
    }
  }, [phase, host]);

  // The finished quiz, kept and reported once: as soon as the last answer is in (so leaving on its
  // reveal loses nothing), or when the player ends an endless run.
  const recorded = useRef(!!stored?.done && !fromDaily);
  const record = useCallback(
    (r: Run) => {
      if (recorded.current) return;
      recorded.current = true;
      const done: Run = { ...r, done: true, cur: undefined };
      persist(done);
      const total = done.pts.reduce((a, b) => a + b, 0);
      const marks = done.picks.map((p, i) => (qs[i] ? judge(qs[i], p) : 'wrong'));
      const correct = marks.filter((v) => v === 'right').length;
      let streak = 0;
      let best = 0;
      for (const v of marks) {
        streak = v === 'right' ? streak + 1 : 0;
        best = Math.max(best, streak);
      }
      if (!fromDaily) commit((s) => ({ ...s, best: Math.max(s.best, total), bestStreak: Math.max(s.bestStreak, best), bestEndless: mode === 'endless' ? Math.max(s.bestEndless, correct) : s.bestEndless }));
      const end = { type: 'end' as const, score: total, stats: { correct, streak: best } };
      host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    },
    [persist, commit, mode, host, challenge, qs, fromDaily],
  );
  // The day's daily was already played: report that result for this round, once.
  useEffect(() => {
    if (fromDaily && stored) record(stored);
  }, [fromDaily, stored, record]);

  // Another tab finished this daily: this screen is out of date, so leave it.
  const { onMenu } = props;
  useEffect(() => {
    if (!dayKeyOf || mode !== 'daily') return;
    const onStorage = (e: StorageEvent): void => {
      if ((e.key === STORE || e.key === null) && !recorded.current && loadSave().daily[dayKeyOf]?.done) onMenu();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [dayKeyOf, mode, onMenu]);

  const answer = useCallback(
    (choice: Pick) => {
      // Running out of time still counts while paused (the daily's clock keeps going).
      if (phase !== 'ask' || (paused && choice !== -1)) return;
      const spent = live ? (Date.now() - askedAt.current) / 1000 : elapsed;
      const secs = choice === -1 ? limit : Math.min(limit, spent);
      const verdict = judge(q, choice);
      const next: Run = { picks: [...run.picks, choice], secs: [...run.secs, Math.round(secs * 10) / 10], pts: [...run.pts, scorePick(q, choice, secs, limit)], done: false };
      setRun(next);
      setPhase('reveal');
      persist(next);
      commit((s) => ({ ...s, answered: s.answered + 1, right: s.right + (verdict === 'right' ? 1 : 0), seen: dealer ? [...new Set([...s.seen, ...dealer.seenIds()])] : s.seen.includes(q.id) ? s.seen : [...s.seen, q.id] }));
      const misses = strikes + (verdict === 'wrong' || verdict === 'timeout' ? 1 : 0);
      if (mode === 'endless' ? misses >= STRIKES : next.picks.length >= qs.length) record(next);
    },
    [phase, paused, live, limit, elapsed, q, run, persist, commit, dealer, strikes, mode, qs.length, record],
  );

  // The clock. Daily and challenge: real time since the question was asked (saved with the run, so
  // hiding the tab, pausing or reloading never stops it). Endless: a counter that stops while paused.
  const clock = useRef({ elapsed, answer });
  useEffect(() => {
    clock.current = { elapsed, answer };
  });
  useEffect(() => {
    if (phase !== 'ask' || (paused && !live)) return;
    let last = performance.now();
    let e = clock.current.elapsed;
    const tick = (): boolean => {
      const now = performance.now();
      e = live ? (Date.now() - askedAt.current) / 1000 : e + (now - last) / 1000;
      last = now;
      setElapsed(e);
      if (e < limit) return false;
      clock.current.answer(-1);
      return true;
    };
    if (live && tick()) return;
    const id = window.setInterval(() => {
      if (tick()) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, paused, live, idx, limit]);
  // Note when the question was asked, so a reload carries on with the same clock.
  useEffect(() => {
    if (phase !== 'ask' || !runKey || run.done) return;
    if (run.cur?.i === run.picks.length && run.cur.at === askedAt.current) return;
    const r = { ...run, cur: { i: run.picks.length, secs: 0, at: askedAt.current } };
    setRun(r);
    persist(r);
  }, [phase, runKey, run, persist]);

  const finish = useCallback(
    (r: Run) => {
      record(r);
      setRun({ ...r, done: true, cur: undefined });
      setPhase('done');
    },
    [record],
  );

  const next = useCallback(() => {
    if (phase !== 'reveal') return;
    const over = mode === 'endless' ? strikes >= STRIKES : run.picks.length >= qs.length;
    if (over) return finish(run);
    if (dealer && run.picks.length >= qs.length) {
      const dealt = dealer.next();
      setQs((list) => [...list, dealt]);
    }
    askedAt.current = Date.now();
    setElapsed(0);
    setPhase('ask');
  }, [phase, mode, strikes, run, qs.length, dealer, finish]);

  // Keyboard: 1-4 / A-D to answer, Enter or Space for the next question (the lever, typing and
  // ordering handle their own keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!forGame(e)) return;
      const k = e.key.toLowerCase();
      const n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (paused && (k === 'enter' || k === ' ')) {
        e.preventDefault();
        setPaused(false);
      } else if (paused) {
        return;
      } else if (phase === 'ask' && (q.kind ?? 'choice') === 'choice' && n >= 0 && n < q.answers.length) {
        e.preventDefault();
        answer(n);
      } else if (phase === 'reveal' && (k === 'enter' || k === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answer, next, paused]);

  if (phase === 'done') return <Results mode={mode} qs={qs} run={run} today={today} challenge={challenge} fromDaily={fromDaily} onMenu={props.onMenu} onAgain={props.onAgain} />;

  const cat = CATS[q.cat];
  const picked = phase === 'reveal' ? run.picks[run.picks.length - 1]! : null;
  const verdict: Verdict | null = picked === null ? null : judge(q, picked);
  const gained = phase === 'reveal' ? run.pts[run.pts.length - 1]! : 0;
  const kind = q.kind ?? 'choice';
  const left = Math.max(0, limit - elapsed);
  const lastQuestion = mode === 'endless' ? strikes >= STRIKES : run.picks.length >= qs.length;

  return (
    <div className="ww ww-play" style={{ ['--cat' as string]: cat.color }}>
      <header className="ww-top">
        <span className="ww-top-mode" title={mode === 'daily' ? u.dailyShort(dailyNumber(today)) : undefined}>{mode === 'daily' ? u.dailyShort(dailyNumber(today)) : mode === 'challenge' ? u.round(challenge?.round ?? 1) : u.endless}</span>
        {mode === 'endless' ? (
          <span className="ww-lives" aria-label={u.livesLeft(STRIKES - strikes)}>
            {Array.from({ length: STRIKES }, (_, i) => (i < STRIKES - strikes ? '❤️' : '🖤')).join('')}
          </span>
        ) : (
          <span className="ww-dots" aria-label={u.questionOf(Math.min(idx + 1, qs.length), qs.length)}>
            {qs.map((_, i) => (
              <i key={i} className={i < run.picks.length ? `is-${verdicts[i] === 'timeout' ? 'wrong' : verdicts[i]}` : i === idx ? 'is-now' : ''} />
            ))}
          </span>
        )}
        {mode !== 'endless' && (
          <span className="ww-count" aria-hidden="true">
            {Math.min(idx + 1, qs.length)}/{qs.length}
          </span>
        )}
        <span className="ww-top-end">
          <span className="ww-score">{score.toLocaleString(p.locale)}</span>
          <GameMenuButton className="ww-menu-btn" />
        </span>
      </header>
      <div className="ww-timer" aria-hidden="true">
        <i style={{ transform: `scaleX(${phase === 'ask' ? left / limit : 0})` }} className={left < 5 ? 'is-low' : ''} />
      </div>

      <main className={`ww-stage${paused ? ' is-paused' : ''}`}>
        <div className="ww-q-card" key={q.id}>
          <span className="ww-chip">
            {cat.emoji} {u.cats[q.cat]}
          </span>
          <h2 className="ww-q">{q.text}</h2>
          {q.emoji && (
            <p className="ww-emoji" aria-label={u.emojiPuzzle}>
              {q.emoji}
            </p>
          )}
          {q.sound && <SoundButton key={`s:${q.id}`} q={q} autoPlay={phase === 'ask' && !paused} />}
          {phase === 'ask' && (
            <span key={`left:${q.id}`} className="ww-left mono is-new">
              {u.secondsLeft(Math.ceil(left))}
            </span>
          )}
        </div>
        {kind === 'choice' && (
          <div className={`ww-answers${q.answers.length <= 2 ? ' is-two' : ''}`} key={`a:${q.id}`}>
            {q.answers.map((a, i) => {
              const state = picked === null ? '' : i === q.correct ? ' is-right' : i === picked ? ' is-wrong' : ' is-dim';
              return (
                <button key={i} className={`ww-answer${state}`} onClick={() => answer(i)} disabled={phase !== 'ask'}>
                  {q.answers.length > 2 && <span className="ww-letter">{LETTERS[i]}</span>}
                  <span>{a}</span>
                </button>
              );
            })}
          </div>
        )}
        {kind === 'number' && <Lever key={`l:${q.id}`} q={q} asking={phase === 'ask' && !paused} picked={picked} onLock={answer} />}
        {kind === 'type' && <TypeIt key={`t:${q.id}`} q={q} asking={phase === 'ask' && !paused} picked={picked} verdict={verdict} onLock={answer} />}
        {kind === 'order' && <OrderIt key={`o:${q.id}`} q={q} asking={phase === 'ask' && !paused} picked={picked} onLock={answer} />}
        {phase === 'reveal' && verdict && (
          <div className="ww-reveal" role="status">
            <p className={`ww-verdict is-${verdict === 'timeout' ? 'wrong' : verdict}`}>
              {verdict === 'right' ? u.correct(gained) : verdict === 'close' ? u.close(gained) : verdict === 'timeout' ? u.timeUp : u.nope}
              {kind === 'number' && picked !== -1 && picked !== null && verdict !== 'right' && <small>{u.offBy(offBy(q, Number(picked), u))}</small>}
            </p>
            {(kind === 'number' || kind === 'type') && verdict !== 'right' && (
              <p className="ww-answer-was">
                {u.answer} <b>{answerText(q)}</b>
              </p>
            )}
            <p className="ww-fact">
              <b>{u.factPrefix}</b>
              {q.fact}
            </p>
            <button className="ww-btn ww-btn-go" onClick={next} autoFocus>
              {lastQuestion ? u.results : u.nextQuestion}
            </button>
          </div>
        )}
        {mode === 'endless' && phase === 'ask' && (
          <button className="ww-btn ww-btn-quiet" onClick={() => finish(run)}>
            {u.endRun}
          </button>
        )}
      </main>
      {paused && (
        <button className="ww-paused" onClick={() => setPaused(false)}>
          <b>{u.paused}</b>
          <span>{live ? u.pausedLive : u.pausedHint}</span>
        </button>
      )}
    </div>
  );
}

const SQUARES: Record<Verdict, string> = { right: '🟩', close: '🟨', wrong: '🟥', timeout: '⬛' };

function grid(qs: Question[], run: Run): string {
  return run.picks.map((p, i) => SQUARES[qs[i] ? judge(qs[i], p) : 'wrong']).join('');
}

function Results(props: { mode: Mode; qs: Question[]; run: Run; today: string; challenge?: ChallengeSpec; fromDaily?: boolean; onMenu: () => void; onAgain: () => void }) {
  const { mode, qs, run, today, challenge } = props;
  const { p, u } = useContext(Lang);
  const total = run.pts.reduce((a, b) => a + b, 0);
  const correct = run.picks.filter((p, i) => qs[i] && judge(qs[i], p) === 'right').length;
  const strikes = run.picks.filter((p, i) => !qs[i] || ['wrong', 'timeout'].includes(judge(qs[i], p))).length;
  const [shareMsg, setShareMsg] = useState('');
  const [open, setOpen] = useState(false);
  const verdict = useMemo(() => {
    const share = correct / Math.max(1, run.picks.length);
    const [e0, e1, e2, e3] = u.verdictEndless;
    const [d0, d1, d2, d3, d4] = u.verdictDaily;
    if (mode === 'endless') return correct >= 25 ? e0 : correct >= 12 ? e1 : correct >= 6 ? e2 : e3;
    return share >= 0.9 ? d0 : share >= 0.7 ? d1 : share >= 0.5 ? d2 : share >= 0.3 ? d3 : d4;
  }, [correct, run.picks.length, mode, u]);

  const shareText = `Quizbelief #${dailyNumber(today)} 🤯\n${grid(qs, run)}\n${u.shareLine(correct, qs.length, total.toLocaleString(p.locale))}\n${window.location.origin}${gameUrl('wait-what')}`;
  return (
    <div className="ww ww-results">
      <p className="ww-eyebrow">{mode === 'daily' ? u.dailyQuiz(dailyNumber(today)) : mode === 'challenge' ? u.challengeRound(challenge?.round ?? 1) : u.endlessRun}</p>
      <h2 className="ww-verdict-big">{verdict}</h2>
      <p className="ww-total">
        {total.toLocaleString(p.locale)}
        <small>{mode === 'endless' ? u.points : ` / ${MAX_POINTS.toLocaleString(p.locale)}`}</small>
      </p>
      <p className="ww-muted">
        {mode === 'endless' ? (strikes >= STRIKES ? u.rightBefore(correct, STRIKES) : u.rightOutOf(correct, run.picks.length)) : u.rightOutOf(correct, qs.length)}
      </p>
      {mode !== 'endless' && <p className="ww-grid">{grid(qs, run)}</p>}
      {props.fromDaily && <p className="ww-muted">{u.dailyCounts}</p>}
      <div className="ww-row">
        {mode === 'challenge' && challenge ? (
          <a className="ww-btn ww-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores}>
            {u.seeScoreboard}
          </a>
        ) : mode === 'endless' ? (
          <button className="ww-btn ww-btn-go" onClick={props.onAgain}>
            {u.playAgain}
          </button>
        ) : (
          <button className="ww-btn ww-btn-go" onClick={() => void shareOrCopy({ title: 'Quizbelief', text: shareText }).then((o) => setShareMsg(o === 'copied' ? u.copied : ''))}>
            {shareMsg || u.shareResult}
          </button>
        )}
        <button className="ww-btn" onClick={props.onMenu}>
          {u.menu}
        </button>
      </div>
      <button className="ww-btn ww-btn-quiet" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? u.hideAnswers : u.showAnswers}
      </button>
      {open && (
        <ol className="ww-review">
          {qs.slice(0, run.picks.length).map((x, i) => {
            const pk = run.picks[i]!;
            const v = judge(x, pk);
            return (
              <li key={x.id} className={v === 'right' ? 'is-right' : v === 'close' ? 'is-close' : 'is-wrong'}>
                <span className="ww-chip">
                  {CATS[x.cat].emoji} {u.cats[x.cat]}
                </span>
                <b>
                  {x.text} {x.emoji}
                </b>
                <span>
                  {v === 'right' ? '✅ ' : v === 'timeout' ? `⏰ ${u.noAnswer} · ` : `${v === 'close' ? '🟨' : '❌'} ${u.youSaid(pickText(x, pk))} · `}
                  {v === 'right' ? answerText(x) : `${u.answer} ${answerText(x)}`}
                </span>
                <small>{x.fact}</small>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** How far a lever guess was from the answer, as text. */
function offBy(q: Question, guess: number, u: Ui): string {
  const n = q.num!;
  const diff = Math.round(Math.abs(guess - n.answer) / n.step) * n.step;
  return n.unit === '' ? u.years(diff) : numberText(q, diff);
}

/** Plays the question's tune or Morse code (once by itself, then on demand), with dancing bars. */
function SoundButton({ q, autoPlay }: { q: Question; autoPlay: boolean }) {
  const { u } = useContext(Lang);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const timer = useRef(0);
  const played = useRef(false);
  const s = q.sound!;
  const play = useCallback(() => {
    stop.current?.();
    window.clearTimeout(timer.current);
    stop.current = s.kind === 'tune' ? playTune(s.notes, s.bpm, s.spooky) : playMorse(s.word);
    const secs = s.kind === 'tune' ? melodyLength(s.notes, s.bpm) : morseText(s.word).length * 0.22;
    setPlaying(true);
    setHeard(true);
    timer.current = window.setTimeout(() => setPlaying(false), secs * 1000 + 200);
  }, [s]);
  useEffect(() => {
    if (autoPlay && !played.current) {
      played.current = true;
      play();
    }
  }, [autoPlay, play]);
  useEffect(
    () => () => {
      stop.current?.();
      window.clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="ww-sound-wrap">
      <button className={`ww-sound${playing ? ' is-playing' : ''}`} onClick={play} type="button">
        <span className="ww-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>{playing ? u.playing : heard ? u.playAgainSound : u.playSound}</span>
      </button>
      {s.kind === 'morse' && <p className="ww-morse mono">{morseText(s.word)}</p>}
    </div>
  );
}

/** The lever: a slider with − and + (hold to speed up), arrow keys, and Lock it in. */
function Lever({ q, asking, picked, onLock }: { q: Question; asking: boolean; picked: Pick | null; onLock: (v: number) => void }) {
  const { u } = useContext(Lang);
  const n = q.num!;
  const snap = useCallback((v: number) => Math.min(n.max, Math.max(n.min, Math.round((v - n.min) / n.step) * n.step + n.min)), [n]);
  // Starts away from the answer (see leverStart).
  const [value, setValue] = useState(() => leverStart(q));
  const hold = useRef(0);
  const nudge = useCallback((d: number) => setValue((v) => snap(Math.round((v + d * n.step) * 1000) / 1000)), [n.step, snap]);
  const stopHold = (): void => window.clearTimeout(hold.current);
  const startHold = (d: number): void => {
    nudge(d);
    let held = 0;
    const tick = (): void => {
      held++;
      // Speeds up the longer you hold: 1 step, then 5, then 25 at a time.
      nudge(d * (held > 20 ? 25 : held > 8 ? 5 : 1));
      hold.current = window.setTimeout(tick, 70);
    };
    hold.current = window.setTimeout(tick, 380);
  };
  useEffect(() => stopHold, []);
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!forGame(e, e.key !== 'Enter')) return;
      const big = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=') nudge(big);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') nudge(-big);
      else if (e.key === 'Enter') onLock(value);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking, nudge, onLock, value]);
  const shown = picked !== null && picked !== -1 ? Number(picked) : value;
  const pct = (v: number): string => `${((v - n.min) / (n.max - n.min)) * 100}%`;
  const revealed = picked !== null;
  return (
    <div className={`ww-lever${revealed ? ' is-revealed' : ''}`}>
      <output className="ww-lever-value mono">{numberText(q, shown)}</output>
      <div className="ww-lever-row">
        <button type="button" className="ww-lever-btn" aria-label={u.less} disabled={!asking} onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          −
        </button>
        <div className="ww-lever-track">
          <input type="range" min={n.min} max={n.max} step={n.step} value={shown} disabled={!asking} onChange={(e) => setValue(snap(Number(e.target.value)))} aria-label={u.yourGuess} />
          {revealed && (
            <span className="ww-lever-flag" style={{ left: pct(n.answer) }}>
              <b>▲</b>
              <span className="mono">🎯 {numberText(q, n.answer)}</span>
            </span>
          )}
        </div>
        <button type="button" className="ww-lever-btn" aria-label={u.more} disabled={!asking} onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          +
        </button>
      </div>
      <p className="ww-lever-ends mono" aria-hidden="true">
        <span>{numberText(q, n.min)}</span>
        <span>{numberText(q, n.max)}</span>
      </p>
      {!revealed && (
        <button type="button" className="ww-btn ww-btn-go ww-lock" disabled={!asking} onClick={() => onLock(value)}>
          {u.lockIn}
        </button>
      )}
    </div>
  );
}

/** Type the answer: small typos are forgiven. */
function TypeIt({ q, asking, picked, verdict, onLock }: { q: Question; asking: boolean; picked: Pick | null; verdict: Verdict | null; onLock: (v: string) => void }) {
  const { u } = useContext(Lang);
  const [text, setText] = useState('');
  const done = picked !== null;
  return (
    <form
      className={`ww-type${done ? ` is-${verdict === 'right' ? 'right' : 'wrong'}` : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (asking && text.trim()) onLock(text.trim());
      }}
    >
      <input
        className="ww-type-input"
        value={done ? (picked === -1 ? '' : String(picked)) : text}
        onChange={(e) => setText(e.target.value)}
        placeholder={done ? u.noAnswer : u.typeHere}
        maxLength={40}
        disabled={!asking}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-label={u.yourAnswer}
      />
      {!done && (
        <button className="ww-btn ww-btn-go ww-lock" disabled={!asking || !text.trim()}>
          {u.lockIn}
        </button>
      )}
      {!done && q.answers[0] && <p className="ww-muted ww-small">{u.spelling}</p>}
    </form>
  );
}

/** Tap the answers in order (tap one again to take it back), then lock it in. */
function OrderIt({ q, asking, picked, onLock }: { q: Question; asking: boolean; picked: Pick | null; onLock: (v: number[]) => void }) {
  const { u } = useContext(Lang);
  const [seq, setSeq] = useState<number[]>([]);
  const done = picked !== null;
  const mine = done ? (Array.isArray(picked) ? picked : []) : seq;
  const tap = useCallback((i: number) => setSeq((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i])), []);
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!forGame(e)) return;
      const n = '1234'.indexOf(e.key);
      if (n >= 0 && n < q.answers.length) tap(n);
      else if (e.key === 'Enter' && seq.length === q.answers.length) onLock(seq);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking, q.answers.length, seq, tap, onLock]);
  const want = q.order ?? [];
  return (
    <div className="ww-order">
      <ol className="ww-order-list">
        {q.answers.map((a, i) => {
          const at = mine.indexOf(i);
          const real = want.indexOf(i);
          const state = !done ? (at >= 0 ? ' is-set' : '') : at === real ? ' is-right' : ' is-wrong';
          return (
            <li key={i}>
              <button type="button" className={`ww-order-item${state}`} onClick={() => tap(i)} disabled={!asking}>
                <span className="ww-order-badge mono">{done ? real + 1 : at >= 0 ? at + 1 : ''}</span>
                <span>{a}</span>
                {done && at !== real && at >= 0 && <span className="ww-order-yours mono">{u.you(at + 1)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {!done && (
        <button type="button" className="ww-btn ww-btn-go ww-lock" disabled={!asking || seq.length !== q.answers.length} onClick={() => onLock(seq)}>
          {seq.length === q.answers.length ? u.lockIn : u.tapMore(q.answers.length - seq.length)}
        </button>
      )}
    </div>
  );
}
