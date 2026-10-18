import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { answerText, bankSize, leverStart, CATS, challengeQuiz, dailyNumber, dailyQuiz, EndlessDealer, judge, MAX_POINTS, numberText, pickText, QUIZ_LENGTH, scorePick, timeLimit, type Pick, type Question, type Verdict } from './deck';
import { openChallengeScores } from '../../platform/challenge';
import { melodyLength, morseText, playMorse, playTune } from './sound';
import './Game.css';

const STORE = 'glitchbound.wait-what';
const STRIKES = 3;

/** One quiz in progress or finished: picks are answers (see Pick; -1 = ran out of time). */
interface Run {
  picks: Pick[];
  secs: number[];
  pts: number[];
  /** Seconds already spent on the question being shown (so reloading does not reset the clock). */
  cur?: { i: number; secs: number };
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

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Save>;
    const s = { ...emptySave(), ...o };
    if (!s.daily || typeof s.daily !== 'object') s.daily = {};
    if (!s.runs || typeof s.runs !== 'object') s.runs = {};
    if (!Array.isArray(s.seen)) s.seen = [];
    return s;
  } catch {
    return emptySave();
  }
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
type Screen = { kind: 'menu' } | { kind: 'play'; mode: Mode; key: string };

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <WaitWhat key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function WaitWhat({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [screen, setScreen] = useState<Screen>(() => (challenge ? { kind: 'play', mode: 'challenge', key: `${challenge.id}:${challenge.round}` } : { kind: 'menu' }));
  const [runs, setRuns] = useState(0);

  if (screen.kind === 'play')
    return (
      <Play
        key={`${screen.key}:${runs}`}
        mode={screen.mode}
        today={today}
        challenge={challenge}
        host={host}
        pauseKey={pauseKey}
        save={save}
        saveRef={saveRef}
        commit={commit}
        onMenu={() => setScreen({ kind: 'menu' })}
        onAgain={() => {
          setRuns((n) => n + 1);
          setScreen({ kind: 'play', mode: 'endless', key: 'endless' });
        }}
      />
    );

  const todays = save.daily[today];
  const total = bankSize(today);
  const seen = save.seen.filter((id) => !/^(time|near):/.test(id)).length;
  return (
    <div className="ww ww-menu">
      <div className="ww-float" aria-hidden="true">
        {FLOATERS.map(([e, x, y], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, ['--i' as string]: i }}>
            {e}
          </span>
        ))}
      </div>
      <h1 className="ww-logo" aria-label="Wait, What?">
        <span className="ww-logo-a">WAIT,</span>
        <span className="ww-logo-b">
          WHAT<b>?!</b>
        </span>
      </h1>
      <p className="ww-tag">Trivia that sounds made up but isn’t.</p>

      <section className="ww-card ww-card-daily">
        <div className="ww-card-head">
          <b>Daily quiz #{dailyNumber(today)}</b>
          <span>{todays?.done ? `${todays.pts.reduce((a, b) => a + b, 0)} points · ${todays.pts.filter((p) => p > 0).length}/${QUIZ_LENGTH} right` : todays ? `In progress · ${todays.picks.length}/${QUIZ_LENGTH}` : '10 questions · same for everyone today'}</span>
        </div>
        <button className="ww-btn ww-btn-go" onClick={() => setScreen({ kind: 'play', mode: 'daily', key: `daily:${today}` })}>
          {todays?.done ? 'See today’s results' : todays ? 'Continue' : 'Play today’s quiz'}
        </button>
      </section>

      <section className="ww-card">
        <div className="ww-card-head">
          <b>Endless</b>
          <span>Three strikes and you’re out · no repeats</span>
        </div>
        <button className="ww-btn" onClick={() => setScreen({ kind: 'play', mode: 'endless', key: 'endless' })}>
          Start an endless run
        </button>
      </section>

      <p className="ww-muted">
        {save.answered ? `${save.right.toLocaleString('en-US')} of ${save.answered.toLocaleString('en-US')} answered right · best run ${save.bestEndless} · ` : ''}
        {seen.toLocaleString('en-US')} of {total.toLocaleString('en-US')}+ questions seen
      </p>
      <p className="ww-muted ww-small">
        Pick an answer, pull the lever to guess a number, type it, put things in order, decode emoji or name a tune. Right answers score 100, plus up to 50 for speed; near misses still score. Keys: 1–4 or A–D to answer, arrows for the lever, Enter for the next question.
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
  saveRef: RefObject<Save>;
  commit: (s: Save) => void;
  onMenu: () => void;
  onAgain: () => void;
}) {
  const { mode, today, challenge, host, saveRef, commit } = props;
  const runKey = mode === 'daily' ? today : mode === 'challenge' && challenge ? `${challenge.id}:${challenge.round}` : null;
  const kept = runKey ? (mode === 'daily' ? props.save.daily[runKey] : props.save.runs[runKey]) : undefined;
  // A finished challenge round is not resumed: when its score never reached the scoreboard (lost on the
  // way, or another player on this device), the round is played again instead of sitting on its results.
  const stored = mode === 'challenge' && kept?.done ? undefined : kept;

  const [dealer] = useState(() => (mode === 'endless' ? new EndlessDealer(props.save.seen) : null));
  const [qs, setQs] = useState<Question[]>(() => (mode === 'daily' ? dailyQuiz(today) : mode === 'challenge' && challenge ? challengeQuiz(challenge.seed, challenge.day) : [dealer!.next()]));
  const [run, setRun] = useState<Run>(() => stored ?? emptyRun());
  const idx = run.done ? qs.length : run.picks.length;
  const [phase, setPhase] = useState<'ask' | 'reveal' | 'done'>(() => (stored?.done ? 'done' : 'ask'));
  const [elapsed, setElapsed] = useState(() => (stored?.cur && stored.cur.i === stored.picks.length ? stored.cur.secs : 0));
  const [paused, setPaused] = useState(false);
  const started = useRef(false);
  // While revealing, keep showing the question just answered.
  const q = qs[Math.min(phase === 'reveal' ? idx - 1 : idx, qs.length - 1)]!;
  const limit = timeLimit(q);
  const verdicts = run.picks.map((p, i) => (qs[i] ? judge(qs[i], p) : 'wrong'));
  const strikes = verdicts.filter((v) => v === 'wrong' || v === 'timeout').length;
  const score = run.pts.reduce((a, b) => a + b, 0);

  // Keep the run saved (daily and challenge), including time already spent on the current question.
  const persist = useCallback(
    (r: Run) => {
      if (!runKey) return;
      const s = saveRef.current;
      commit(mode === 'daily' ? { ...s, daily: { ...s.daily, [runKey]: r } } : { ...s, runs: { ...s.runs, [runKey]: r } });
    },
    [commit, mode, runKey, saveRef],
  );

  // Pause when the arcade asks (left full screen, scrolled away) or the tab is hidden.
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

  const answer = useCallback(
    (choice: Pick) => {
      if (phase !== 'ask' || paused) return;
      const secs = choice === -1 ? limit : Math.min(limit, elapsed);
      const right = judge(q, choice) === 'right';
      const next: Run = { picks: [...run.picks, choice], secs: [...run.secs, Math.round(secs * 10) / 10], pts: [...run.pts, scorePick(q, choice, secs, limit)], done: false };
      setRun(next);
      setPhase('reveal');
      persist(next);
      const s = saveRef.current;
      commit({ ...s, answered: s.answered + 1, right: s.right + (right ? 1 : 0), seen: dealer ? dealer.seenIds() : s.seen.includes(q.id) ? s.seen : [...s.seen, q.id] });
    },
    [phase, paused, limit, elapsed, q, run, persist, saveRef, commit, dealer],
  );

  // The clock runs while a question is being asked; daily and challenge runs save it every second,
  // so reloading the page does not give you a fresh clock.
  const clock = useRef({ run, elapsed, answer });
  useEffect(() => {
    clock.current = { run, elapsed, answer };
  });
  useEffect(() => {
    if (phase !== 'ask' || paused) return;
    let last = performance.now();
    let e = clock.current.elapsed;
    let sinceSave = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      e += dt;
      setElapsed(e);
      if (e >= limit) {
        window.clearInterval(id);
        clock.current.answer(-1);
        return;
      }
      sinceSave += dt;
      if (runKey && sinceSave >= 1) {
        sinceSave = 0;
        const r = clock.current.run;
        persist({ ...r, cur: { i: r.picks.length, secs: Math.round(e * 10) / 10 } });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, paused, idx, limit, runKey, persist]);

  const finish = useCallback(
    (r: Run) => {
      const done: Run = { ...r, done: true, cur: undefined };
      setRun(done);
      setPhase('done');
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
      const s = saveRef.current;
      commit({ ...s, best: Math.max(s.best, total), bestStreak: Math.max(s.bestStreak, best), bestEndless: mode === 'endless' ? Math.max(s.bestEndless, correct) : s.bestEndless });
      const end = { type: 'end' as const, score: total, stats: { correct, streak: best } };
      host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    },
    [persist, saveRef, commit, mode, host, challenge, qs],
  );

  const next = useCallback(() => {
    if (phase !== 'reveal') return;
    const over = mode === 'endless' ? strikes >= STRIKES : run.picks.length >= qs.length;
    if (over) return finish(run);
    if (dealer && run.picks.length >= qs.length) {
      const dealt = dealer.next();
      setQs((list) => [...list, dealt]);
    }
    setElapsed(0);
    setPhase('ask');
    const r = { ...run, cur: { i: run.picks.length, secs: 0 } };
    setRun(r);
    persist(r);
  }, [phase, mode, strikes, run, qs.length, dealer, finish, persist]);

  // Keyboard: 1-4 / A-D to answer, Enter or Space for the next question (the lever, typing and
  // ordering handle their own keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (phase === 'ask' && (q.kind ?? 'choice') === 'choice' && n >= 0 && n < q.answers.length) {
        e.preventDefault();
        answer(n);
      } else if (phase === 'reveal' && (k === 'enter' || k === ' ')) {
        e.preventDefault();
        next();
      } else if (paused && (k === 'enter' || k === ' ')) {
        e.preventDefault();
        setPaused(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answer, next, paused]);

  if (phase === 'done') return <Results mode={mode} qs={qs} run={run} today={today} challenge={challenge} onMenu={props.onMenu} onAgain={props.onAgain} />;

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
        <span className="ww-top-mode">{mode === 'daily' ? `Daily #${dailyNumber(today)}` : mode === 'challenge' ? `⚔️ Round ${challenge?.round ?? 1}` : 'Endless'}</span>
        {mode === 'endless' ? (
          <span className="ww-lives" aria-label={`${STRIKES - strikes} lives left`}>
            {Array.from({ length: STRIKES }, (_, i) => (i < STRIKES - strikes ? '❤️' : '🖤')).join('')}
          </span>
        ) : (
          <span className="ww-dots" aria-label={`Question ${Math.min(idx + 1, qs.length)} of ${qs.length}`}>
            {qs.map((_, i) => (
              <i key={i} className={i < run.picks.length ? `is-${verdicts[i] === 'timeout' ? 'wrong' : verdicts[i]}` : i === idx ? 'is-now' : ''} />
            ))}
          </span>
        )}
        <span className="ww-score">{score.toLocaleString('en-US')}</span>
      </header>
      <div className="ww-timer" aria-hidden="true">
        <i style={{ transform: `scaleX(${phase === 'ask' ? left / limit : 0})` }} className={left < 5 ? 'is-low' : ''} />
      </div>

      <main className={`ww-stage${paused ? ' is-paused' : ''}`}>
        <div className="ww-q-card" key={q.id}>
          <span className="ww-chip">
            {cat.emoji} {cat.label}
          </span>
          <h2 className="ww-q">{q.text}</h2>
          {q.emoji && (
            <p className="ww-emoji" aria-label="Emoji puzzle">
              {q.emoji}
            </p>
          )}
          {q.sound && <SoundButton key={`s:${q.id}`} q={q} autoPlay={phase === 'ask' && !paused} />}
          {phase === 'ask' && <span className="ww-left mono">{Math.ceil(left)}s</span>}
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
              {verdict === 'right' ? `Correct! +${gained}` : verdict === 'close' ? `So close! +${gained}` : verdict === 'timeout' ? 'Time’s up!' : 'Nope!'}
              {kind === 'number' && picked !== -1 && picked !== null && verdict !== 'right' && <small> Off by {offBy(q, Number(picked))}</small>}
            </p>
            {(kind === 'number' || kind === 'type') && verdict !== 'right' && (
              <p className="ww-answer-was">
                Answer: <b>{answerText(q)}</b>
              </p>
            )}
            <p className="ww-fact">
              <b>Wait, what? </b>
              {q.fact}
            </p>
            <button className="ww-btn ww-btn-go" onClick={next} autoFocus>
              {lastQuestion ? 'See results' : 'Next question'}
            </button>
          </div>
        )}
        {mode === 'endless' && phase === 'ask' && (
          <button className="ww-btn ww-btn-quiet" onClick={() => finish(run)}>
            End run
          </button>
        )}
      </main>
      {paused && (
        <button className="ww-paused" onClick={() => setPaused(false)}>
          <b>Paused</b>
          <span>Tap to carry on. The clock is stopped.</span>
        </button>
      )}
    </div>
  );
}

const SQUARES: Record<Verdict, string> = { right: '🟩', close: '🟨', wrong: '🟥', timeout: '⬛' };

function grid(qs: Question[], run: Run): string {
  return run.picks.map((p, i) => SQUARES[qs[i] ? judge(qs[i], p) : 'wrong']).join('');
}

function Results(props: { mode: Mode; qs: Question[]; run: Run; today: string; challenge?: ChallengeSpec; onMenu: () => void; onAgain: () => void }) {
  const { mode, qs, run, today, challenge } = props;
  const total = run.pts.reduce((a, b) => a + b, 0);
  const correct = run.picks.filter((p, i) => qs[i] && judge(qs[i], p) === 'right').length;
  const [shareMsg, setShareMsg] = useState('');
  const [open, setOpen] = useState(false);
  const verdict = useMemo(() => {
    const share = correct / Math.max(1, run.picks.length);
    if (mode === 'endless') return correct >= 25 ? 'Walking encyclopedia' : correct >= 12 ? 'Seriously impressive' : correct >= 6 ? 'Not bad at all' : 'The facts fought back';
    return share >= 0.9 ? 'Genius. Suspiciously so.' : share >= 0.7 ? 'Big brain energy' : share >= 0.5 ? 'Respectable' : share >= 0.3 ? 'Wait, what?' : 'The facts won today';
  }, [correct, run.picks.length, mode]);

  const shareText = `Wait, What? #${dailyNumber(today)} 🤯\n${grid(qs, run)}\n${correct}/${qs.length} right · ${total.toLocaleString('en-US')} points\n${window.location.origin}/games/wait-what`;
  return (
    <div className="ww ww-results">
      <p className="ww-eyebrow">{mode === 'daily' ? `Daily quiz #${dailyNumber(today)}` : mode === 'challenge' ? `Challenge · round ${challenge?.round ?? 1}` : 'Endless run'}</p>
      <h2 className="ww-verdict-big">{verdict}</h2>
      <p className="ww-total">
        {total.toLocaleString('en-US')}
        <small>{mode === 'endless' ? ' points' : ` / ${MAX_POINTS.toLocaleString('en-US')}`}</small>
      </p>
      <p className="ww-muted">
        {correct} right{mode === 'endless' ? ` before ${STRIKES} strikes` : ` out of ${qs.length}`}
      </p>
      {mode !== 'endless' && <p className="ww-grid">{grid(qs, run)}</p>}
      <div className="ww-row">
        {mode === 'challenge' && challenge ? (
          <a className="ww-btn ww-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : mode === 'endless' ? (
          <button className="ww-btn ww-btn-go" onClick={props.onAgain}>
            Play again
          </button>
        ) : (
          <button className="ww-btn ww-btn-go" onClick={() => void shareOrCopy({ title: 'Wait, What?', text: shareText }).then((o) => setShareMsg(o === 'copied' ? 'Copied!' : ''))}>
            {shareMsg || 'Share result'}
          </button>
        )}
        <button className="ww-btn" onClick={props.onMenu}>
          Menu
        </button>
      </div>
      <button className="ww-btn ww-btn-quiet" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide the answers' : 'Show all the answers'}
      </button>
      {open && (
        <ol className="ww-review">
          {qs.slice(0, run.picks.length).map((x, i) => {
            const p = run.picks[i]!;
            const v = judge(x, p);
            return (
              <li key={x.id} className={v === 'right' ? 'is-right' : v === 'close' ? 'is-close' : 'is-wrong'}>
                <span className="ww-chip">
                  {CATS[x.cat].emoji} {CATS[x.cat].label}
                </span>
                <b>
                  {x.text} {x.emoji}
                </b>
                <span>
                  {v === 'right' ? '✅ ' : v === 'timeout' ? '⏰ No answer · ' : `${v === 'close' ? '🟨' : '❌'} You said ${pickText(x, p)} · `}
                  {v === 'right' ? answerText(x) : `Answer: ${answerText(x)}`}
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
function offBy(q: Question, guess: number): string {
  const n = q.num!;
  const diff = Math.round(Math.abs(guess - n.answer) / n.step) * n.step;
  return n.unit === '' ? `${diff} year${diff === 1 ? '' : 's'}` : numberText(q, diff);
}

/** Plays the question's tune or Morse code (once by itself, then on demand), with dancing bars. */
function SoundButton({ q, autoPlay }: { q: Question; autoPlay: boolean }) {
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
        <span>{playing ? 'Playing…' : heard ? 'Play it again' : 'Play the sound'}</span>
      </button>
      {s.kind === 'morse' && <p className="ww-morse mono">{morseText(s.word)}</p>}
    </div>
  );
}

/** The lever: a slider with − and + (hold to speed up), arrow keys, and Lock it in. */
function Lever({ q, asking, picked, onLock }: { q: Question; asking: boolean; picked: Pick | null; onLock: (v: number) => void }) {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
        <button type="button" className="ww-lever-btn" aria-label="Less" disabled={!asking} onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          −
        </button>
        <div className="ww-lever-track">
          <input type="range" min={n.min} max={n.max} step={n.step} value={shown} disabled={!asking} onChange={(e) => setValue(snap(Number(e.target.value)))} aria-label="Your guess" />
          {revealed && (
            <span className="ww-lever-flag" style={{ left: pct(n.answer) }}>
              <b>▲</b>
              <span className="mono">🎯 {numberText(q, n.answer)}</span>
            </span>
          )}
        </div>
        <button type="button" className="ww-lever-btn" aria-label="More" disabled={!asking} onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}>
          +
        </button>
      </div>
      <p className="ww-lever-ends mono" aria-hidden="true">
        <span>{numberText(q, n.min)}</span>
        <span>{numberText(q, n.max)}</span>
      </p>
      {!revealed && (
        <button type="button" className="ww-btn ww-btn-go ww-lock" disabled={!asking} onClick={() => onLock(value)}>
          🔒 Lock it in
        </button>
      )}
    </div>
  );
}

/** Type the answer: small typos are forgiven. */
function TypeIt({ q, asking, picked, verdict, onLock }: { q: Question; asking: boolean; picked: Pick | null; verdict: Verdict | null; onLock: (v: string) => void }) {
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
        placeholder={done ? 'No answer' : 'Type your answer…'}
        maxLength={40}
        disabled={!asking}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-label="Your answer"
      />
      {!done && (
        <button className="ww-btn ww-btn-go ww-lock" disabled={!asking || !text.trim()}>
          🔒 Lock it in
        </button>
      )}
      {!done && q.answers[0] && <p className="ww-muted ww-small">Spelling doesn’t have to be perfect.</p>}
    </form>
  );
}

/** Tap the answers in order (tap one again to take it back), then lock it in. */
function OrderIt({ q, asking, picked, onLock }: { q: Question; asking: boolean; picked: Pick | null; onLock: (v: number[]) => void }) {
  const [seq, setSeq] = useState<number[]>([]);
  const done = picked !== null;
  const mine = done ? (Array.isArray(picked) ? picked : []) : seq;
  const tap = useCallback((i: number) => setSeq((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i])), []);
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent): void => {
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
                {done && at !== real && at >= 0 && <span className="ww-order-yours mono">you: {at + 1}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {!done && (
        <button type="button" className="ww-btn ww-btn-go ww-lock" disabled={!asking || seq.length !== q.answers.length} onClick={() => onLock(seq)}>
          {seq.length === q.answers.length ? '🔒 Lock it in' : `Tap ${q.answers.length - seq.length} more`}
        </button>
      )}
    </div>
  );
}
