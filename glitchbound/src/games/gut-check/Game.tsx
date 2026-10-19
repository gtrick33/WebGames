import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { answerIsMore, categoryOf, chain, emojiOf, nameOf, resultLine, valueOf, type Card, type Pair } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.gut-check';
const EPOCH = '2026-10-19';
const CHAIN = 300;
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  runs: number;
  daily: Record<string, { best: number; tries: number }>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, runs: 0, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries) };
    return s;
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

interface Run {
  pairs: Pair[];
  i: number;
  phase: 'ask' | 'right' | 'wrong';
  /** The call the player made on the current pair. */
  call: 'more' | 'less' | null;
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <GutCheck key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function GutCheck({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [run, setRun] = useState<Run | null>(() => (challenge ? { pairs: chain(challenge.seed, CHAIN), i: 0, phase: 'ask', call: null } : null));
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // No clock: nothing to pause.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) setPauseSeen(pauseKey);

  const begin = (m: Mode): void => {
    // Today's daily is one try; starting it uses the try up (even if it is abandoned).
    if (m === 'daily') {
      if (saveRef.current.daily[today]) return;
      commit({ ...saveRef.current, daily: { ...saveRef.current.daily, [today]: { best: 0, tries: 1 } } });
    }
    started.current = false;
    setMode(m);
    setOver(false);
    setNewBest(false);
    setRun({ pairs: chain(m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`gut-check:${today}`) : randomSeed(), CHAIN), i: 0, phase: 'ask', call: null });
  };

  const finish = (streak: number): void => {
    const cur = saveRef.current;
    setNewBest(streak > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, streak),
      runs: cur.runs + 1,
      daily: mode === 'daily' ? { ...cur.daily, [today]: { best: streak, tries: 1 } } : cur.daily,
    });
    const end = { type: 'end' as const, score: streak, stats: {} };
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setOver(true);
  };

  const call = (c: 'more' | 'less'): void => {
    if (!run || run.phase !== 'ask') return;
    if (!started.current) {
      started.current = true;
      host.report({ type: 'start' });
    }
    const pair = run.pairs[run.i]!;
    const right = answerIsMore(pair) === (c === 'more');
    setRun({ ...run, phase: right ? 'right' : 'wrong', call: c });
    if (right) sfx().right(run.i + 1);
    else {
      sfx().wrong();
      navigator.vibrate?.(70);
    }
  };

  // After the reveal: the next pair, or the end of the run.
  useEffect(() => {
    if (!run || run.phase === 'ask' || over) return;
    const t = window.setTimeout(
      () => {
        if (run.phase === 'wrong') return finish(run.i);
        if (run.i + 1 >= run.pairs.length) return finish(run.i + 1);
        setRun({ ...run, i: run.i + 1, phase: 'ask', call: null });
      },
      run.phase === 'right' ? 1100 : 1600,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, over]);

  useEffect(() => {
    if (!run || over) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '1' || e.key === 'm' || e.key === 'M') call('more');
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '2' || e.key === 'l' || e.key === 'L') call('less');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!run) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const pair = run.pairs[run.i]!;
  const cat = categoryOf(pair.left);
  const streak = run.phase === 'right' ? run.i + 1 : run.i;
  const daily = save.daily[today];

  return (
    <div className="gc">
      <div className="gc-hud" aria-live="polite">
        <button className="gc-icon" onClick={() => setRun(null)} aria-label="Menu">
          ☰
        </button>
        <div className="gc-score">
          <b>{streak}</b>
          <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily #${dailyNumber(today)} · streak` : `Best ${save.best} · streak`}</span>
        </div>
        <span className="gc-topic">{cat.question}</span>
      </div>
      <div className="gc-stack">
        <CardView key={`l${run.i}`} card={pair.left} shown />
        <div className="gc-vs" aria-hidden="true">
          vs
        </div>
        <CardView key={`r${run.i}`} card={pair.right} shown={run.phase !== 'ask'} verdict={run.phase === 'ask' ? null : run.phase} />
      </div>
      <div className="gc-calls">
        <button className="gc-call is-more" onClick={() => call('more')} disabled={run.phase !== 'ask'}>
          ▲ {cat.more}
        </button>
        <button className="gc-call is-less" onClick={() => call('less')} disabled={run.phase !== 'ask'}>
          ▼ {cat.less}
        </button>
      </div>
      <p className="gc-help">
        <b>{nameOf(pair.right)}</b>: {cat.more.toLowerCase()} or {cat.less.toLowerCase()} than {nameOf(pair.left)}?
      </p>
      {over && (
        <div className="gc-over">
          <h2>{streak >= 15 ? 'Gut of steel!' : streak >= 7 ? 'Trust that gut!' : 'Gut feeling: wrong'}</h2>
          <p className="gc-big">{run.i}</p>
          <p className="gc-muted">right in a row {newBest ? '· New best!' : `· best ${save.best}`}</p>
          <ResultLine line={resultLine(run.i, run.phase === 'wrong')} label={`${run.i} right in a row`} />
          {mode === 'daily' && daily && (
            <p className="gc-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="gc-row">
            {mode === 'challenge' && challenge ? (
              <a className="gc-btn gc-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="gc-btn gc-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Gut Check #${dailyNumber(today)} 🎯\n${resultLine(daily.best, true)}\n${daily.best} in a row\n${window.location.origin}/games/gut-check`} />}
            <button className="gc-btn" onClick={() => setRun(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One card: the thing, and its number (counting up when it is revealed). */
function CardView({ card, shown, verdict = null }: { card: Card; shown: boolean; verdict?: 'right' | 'wrong' | null }) {
  const cat = categoryOf(card);
  const v = valueOf(card);
  return (
    <div className={`gc-card${verdict ? ` is-${verdict}` : ''}`}>
      <span className="gc-emoji" aria-hidden="true">
        {emojiOf(card)}
      </span>
      <b className="gc-name">{nameOf(card)}</b>
      <span className="gc-value">{shown ? <CountUp to={v} format={cat.format} instant={!verdict} years={!!cat.years} /> : '?'}</span>
    </div>
  );
}

function CountUp({ to, format, instant: still, years }: { to: number; format: (v: number) => string; instant: boolean; years: boolean }) {
  // Tiny numbers (a snail, a bee) just appear: counting up through 0.0 reads wrong.
  const instant = still || to < 10;
  const [v, setV] = useState(instant ? to : years ? to - 60 : 0);
  useEffect(() => {
    if (instant) return;
    let raf = 0;
    const t0 = performance.now();
    const from = years ? to - 60 : 0;
    const tick = (now: number): void => {
      const k = Math.min(1, (now - t0) / 650);
      const e = 1 - (1 - k) ** 3;
      setV(k >= 1 ? to : years ? Math.round(from + (to - from) * e) : from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, instant, years]);
  // Mid-count values are rounded to the same precision the final number uses.
  const shown = v === to ? v : to >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return <>{format(shown)}</>;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="gc-btn" onClick={() => void shareOrCopy({ title: 'Gut Check', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  return (
    <div className="gc gc-menu">
      <div className="gc-menu-top">
        <button className="gc-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="gc-logo" aria-hidden="true">
        <span>🐘</span>
        <i>vs</i>
        <span>🦛</span>
      </div>
      <h1 className="gc-title">
        Gut <span>Check</span>
      </h1>
      <p className="gc-tag">Two things, one number. Is the next one bigger or smaller? Trust your gut and keep the streak going.</p>
      <section className="gc-card-menu">
        <div className="gc-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{daily ? `Today: ${daily.best} in a row` : 'The same cards for everyone · one try a day'}</span>
        </div>
        {daily ? (
          <div className="gc-done">
            {daily.best > 0 && <ShareButton text={`Gut Check #${dailyNumber(today)} 🎯\n${resultLine(daily.best, true)}\n${daily.best} in a row\n${window.location.origin}/games/gut-check`} />}
            <NextDaily className="gc-muted" />
          </div>
        ) : (
          <button className="gc-btn gc-btn-go gc-btn-big" onClick={() => onPlay('daily')}>
            Play today’s cards
          </button>
        )}
      </section>
      <section className="gc-card-menu">
        <div className="gc-card-head">
          <b>Endless</b>
          <span>A fresh shuffle every run</span>
        </div>
        <button className="gc-btn gc-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="gc-muted">
        Best streak {save.best} · {save.runs} {save.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="gc-muted gc-small">People, places, animals, food and history. Every number is rounded; pairs are always far apart.</p>
    </div>
  );
}
