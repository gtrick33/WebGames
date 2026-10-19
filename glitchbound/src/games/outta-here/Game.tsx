import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { arrowAt, canLeave, DAILY_LEVELS, DC, DR, HEARTS, levelPoints, makeLevel, pathAhead, resultLine, type Arrow, type Level } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.outta-here';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  line: string;
}
interface Save {
  best: number;
  bestLevels: number;
  runs: number;
  daily: Record<string, DailyRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, bestLevels: 0, runs: 0, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.bestLevels = n(o.bestLevels);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { best: n(v.best), tries: n(v.tries), line: typeof v.line === 'string' && /^[💨🟡💥]{0,40}$/u.test(v.line) ? v.line : '' };
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
const now = (): number => performance.now();

const PALETTE = ['#ff5d73', '#ffb020', '#2fc46b', '#2f8cff', '#9b6bff', '#ff6bd0'];

interface Run {
  seed: number;
  n: number;
  level: Level;
  gone: Set<number>;
  /** Arrows flying off right now (removed from play, still drawn for the animation). */
  leaving: Set<number>;
  mistakes: number;
  hearts: number;
  /** Points banked from finished levels. */
  banked: number;
  history: { mistakes: number; cleared: boolean }[];
  phase: 'play' | 'cleared' | 'over';
  /** Points the last cleared level earned (for the banner). */
  gained: number;
}

const startRun = (seed: number): Run => ({ seed, n: 1, level: makeLevel(seed, 1), gone: new Set(), leaving: new Set(), mistakes: 0, hearts: HEARTS, banked: 0, history: [], phase: 'play', gained: 0 });
const liveScore = (r: Run): number => r.banked + (r.phase === 'play' ? r.gone.size * 10 : 0);

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <OuttaHere key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function OuttaHere({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [run, setRun] = useState<Run | null>(() => (challenge ? startRun(challenge.seed) : null));
  const runRef = useRef(run);
  const [cursor, setCursor] = useState(0);
  // The keyboard cursor only shows once someone uses the arrow keys.
  const [keys, setKeys] = useState(false);
  const [blocked, setBlocked] = useState<{ arrow: number; cell: number; key: number } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);
  const levelStart = useRef(0);
  const combo = useRef(0);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // No clock runs while nobody taps (the speed bonus is generous), so a pause request needs no work.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) setPauseSeen(pauseKey);

  const show = (r: Run | null): void => {
    runRef.current = r;
    setRun(r);
  };

  const begin = (m: Mode): void => {
    // Today's daily is one try; starting it uses the try up (even if it is abandoned).
    if (m === 'daily') {
      if (saveRef.current.daily[today]) return;
      commit({ ...saveRef.current, daily: { ...saveRef.current.daily, [today]: { best: 0, tries: 1, line: '' } } });
    }
    started.current = false;
    setMode(m);
    setNewBest(false);
    setBlocked(null);
    setCursor(0);
    show(startRun(m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`outta-here:${today}`) : randomSeed()));
  };

  const finish = (r: Run): void => {
    const score = r.banked;
    const levels = r.history.filter((h) => h.cleared).length;
    const perfect = r.history.filter((h) => h.cleared && h.mistakes === 0).length;
    const cur = saveRef.current;
    setNewBest(score > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, score),
      bestLevels: Math.max(cur.bestLevels, levels),
      runs: cur.runs + 1,
      daily: mode === 'daily' ? { ...cur.daily, [today]: { best: score, tries: 1, line: resultLine(r.history) } } : cur.daily,
    });
    const end = { type: 'end' as const, score, stats: { levels, perfect } };
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    window.setTimeout(() => sfx().over(), 200);
  };

  const tapArrow = (a: Arrow): void => {
    const r = runRef.current;
    if (!r || r.phase !== 'play' || r.gone.has(a.id)) return;
    if (!started.current) {
      started.current = true;
      levelStart.current = now();
      host.report({ type: 'start' });
    }
    if (!canLeave(r.level, r.gone, a)) {
      // Show what is in the way, and pay a heart.
      const occupied = new Set(r.level.arrows.filter((x) => !r.gone.has(x.id) && x.id !== a.id).flatMap((x) => x.cells));
      const wall = pathAhead(r.level.size, a.cells[a.cells.length - 1]!, a.dir).find((i) => occupied.has(i)) ?? -1;
      setBlocked({ arrow: a.id, cell: wall, key: (blocked?.key ?? 0) + 1 });
      sfx().bump();
      navigator.vibrate?.(50);
      combo.current = 0;
      const hearts = r.hearts - 1;
      const next: Run = { ...r, hearts, mistakes: r.mistakes + 1 };
      if (hearts <= 0) {
        const over: Run = { ...next, phase: 'over', banked: r.banked + r.gone.size * 10, history: [...r.history, { mistakes: r.mistakes + 1, cleared: false }] };
        show(over);
        finish(over);
      } else show(next);
      return;
    }
    sfx().whoosh(combo.current++);
    const gone = new Set(r.gone).add(a.id);
    const leaving = new Set(r.leaving).add(a.id);
    if (gone.size < r.level.arrows.length) return show({ ...r, gone, leaving });
    // Level cleared.
    const secs = (now() - levelStart.current) / 1000;
    const gained = levelPoints(r.level, r.n, r.mistakes, secs);
    const history = [...r.history, { mistakes: r.mistakes, cleared: true }];
    const done: Run = { ...r, gone, leaving, banked: r.banked + gained, gained, history, phase: 'cleared', hearts: mode !== 'daily' && r.mistakes === 0 ? Math.min(HEARTS, r.hearts + 1) : r.hearts };
    sfx().level();
    if (mode === 'daily' && r.n >= DAILY_LEVELS) {
      const over: Run = { ...done, phase: 'over' };
      show(over);
      finish(over);
    } else show(done);
  };

  const nextLevel = (): void => {
    const r = runRef.current;
    if (!r || r.phase !== 'cleared') return;
    levelStart.current = now();
    combo.current = 0;
    setBlocked(null);
    setCursor(0);
    show({ ...r, n: r.n + 1, level: makeLevel(r.seed, r.n + 1), gone: new Set(), leaving: new Set(), mistakes: 0, phase: 'play' });
  };

  // Flying arrows are dropped from the drawing once their animation is over.
  useEffect(() => {
    if (!run || run.leaving.size === 0) return;
    const t = window.setTimeout(() => {
      const r = runRef.current;
      if (r && r.leaving.size) show({ ...r, leaving: new Set() });
    }, 420);
    return () => window.clearTimeout(t);
  }, [run]);

  useEffect(() => {
    if (!blocked) return;
    const t = window.setTimeout(() => setBlocked(null), 600);
    return () => window.clearTimeout(t);
  }, [blocked]);

  // A cleared level moves on by itself after a moment.
  useEffect(() => {
    if (run?.phase !== 'cleared') return;
    const t = window.setTimeout(nextLevel, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.phase, run?.n]);

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent): void => {
      const r = runRef.current;
      if (!r) return;
      const size = r.level.size;
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setKeys(true);
        const d = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(e.key) as 0 | 1 | 2 | 3;
        setCursor((c) => {
          const row = Math.max(0, Math.min(size - 1, Math.floor(c / size) + DR[d]));
          const col = Math.max(0, Math.min(size - 1, (c % size) + DC[d]));
          return row * size + col;
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && r.phase !== 'over') {
        // (Once the run is over, Enter and Space are left to the focused end-screen button.)
        e.preventDefault();
        if (r.phase === 'cleared') return nextLevel();
        const a = arrowAt(r.level, r.gone, cursor);
        if (a) tapArrow(a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!run) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const { level } = run;
  const U = 10;
  const size = level.size;
  const daily = save.daily[today];
  const score = liveScore(run);
  const levels = run.history.filter((h) => h.cleared).length;

  return (
    <div className="oh">
      <div className="oh-hud" aria-live="polite">
        <button className="oh-icon" onClick={() => show(null)} aria-label="Menu">
          ☰
        </button>
        <div className="oh-mid">
          <b>{score}</b>
          <span>
            {mode === 'challenge' ? `⚔️ Round ${challenge?.round ?? 1} · ` : mode === 'daily' ? `Daily #${dailyNumber(today)} · ` : ''}Level {run.n}
            {mode === 'daily' ? `/${DAILY_LEVELS}` : ''}
          </span>
        </div>
        <div className="oh-hearts" aria-label={`${run.hearts} hearts left`}>
          {Array.from({ length: HEARTS }, (_, i) => (
            <i key={i} className={i < run.hearts ? 'is-on' : ''}>
              {i < run.hearts ? '❤️' : '🤍'}
            </i>
          ))}
        </div>
      </div>
      <div className="oh-board-wrap">
        <svg className={`oh-board${blocked ? ' is-hit' : ''}`} viewBox={`-2 -2 ${size * U + 4} ${size * U + 4}`} role="grid" aria-label={`Level ${run.n}: ${level.arrows.length - run.gone.size} arrows left`}>
          {Array.from({ length: size * size }, (_, i) => (
            <rect key={i} className={`oh-dot${keys && i === cursor ? ' is-cursor' : ''}${blocked?.cell === i ? ' is-wall' : ''}`} x={(i % size) * U + 1} y={Math.floor(i / size) * U + 1} width={U - 2} height={U - 2} rx={2.4} />
          ))}
          {level.arrows.map((a) => {
            const isGone = run.gone.has(a.id);
            if (isGone && !run.leaving.has(a.id)) return null;
            const shake = blocked?.arrow === a.id ? blocked.key : 0;
            return <ArrowShape key={`${run.n}:${a.id}:${shake}`} a={a} size={size} gone={isGone} shake={shake} onTap={() => tapArrow(a)} />;
          })}
        </svg>
        {run.phase === 'cleared' && (
          <button className="oh-banner" onClick={nextLevel}>
            <b>Level {run.n} clear!</b>
            <span>+{run.gained}{run.mistakes === 0 ? ' · flawless' : ''}</span>
          </button>
        )}
      </div>
      <p className="oh-help">Tap an arrow to send it off. Blocked arrows cost a heart.</p>
      {run.phase === 'over' && (
        <div className="oh-over">
          <h2>{mode === 'daily' && levels >= DAILY_LEVELS ? 'All clear!' : 'Out of hearts'}</h2>
          <p className="oh-big">{run.banked}</p>
          <p className="oh-muted">
            {levels} level{levels === 1 ? '' : 's'} cleared {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(run.history)} label={`${levels} levels cleared, ${run.banked} points`} />
          {mode === 'daily' && daily && (
            <p className="oh-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="oh-row">
            {mode === 'challenge' && challenge ? (
              <a className="oh-btn oh-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="oh-btn oh-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Outta Here #${dailyNumber(today)} ➡️\n${daily.line}\nScore: ${daily.best}\n${window.location.origin}/games/outta-here`} />}
            <button className="oh-btn" onClick={() => show(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One arrow: an outlined capsule from tail to head with a pointed tip, plus a tap area over its cells. */
function ArrowShape({ a, size, gone, shake, onTap }: { a: Arrow; size: number; gone: boolean; shake: number; onTap: () => void }) {
  const U = 10;
  const at = (i: number): [number, number] => [(i % size) * U + U / 2, Math.floor(i / size) * U + U / 2];
  const [tx, ty] = at(a.cells[0]!);
  const [hx, hy] = at(a.cells[a.cells.length - 1]!);
  const dx = DC[a.dir];
  const dy = DR[a.dir];
  // The tip pokes a little past the head cell's centre; the body starts a little before the tail's.
  const sx = tx - dx * 2.6;
  const sy = ty - dy * 2.6;
  const bx = hx + dx * 0.6;
  const by = hy + dy * 0.6;
  const tip = `${hx + dx * 4.4},${hy + dy * 4.4} ${hx - dy * 3.6 + dx * 0.2},${hy + dx * 3.6 + dy * 0.2} ${hx + dy * 3.6 + dx * 0.2},${hy - dx * 3.6 + dy * 0.2}`;
  const minX = Math.min(tx, hx) - U / 2;
  const minY = Math.min(ty, hy) - U / 2;
  const fly = size * U + 20;
  return (
    <g
      className={`oh-arrow${gone ? ' is-gone' : ''}${shake ? ' is-shake' : ''}`}
      style={{ ['--c' as string]: PALETTE[a.color], ...(gone ? { transform: `translate(${dx * fly}px, ${dy * fly}px)` } : {}) }}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
    >
      <rect className="oh-hit" x={minX} y={minY} width={Math.abs(hx - tx) + U} height={Math.abs(hy - ty) + U} />
      <line className="oh-ink" x1={sx} y1={sy} x2={bx} y2={by} />
      <polygon className="oh-ink-tip" points={tip} />
      <line className="oh-body" x1={sx} y1={sy} x2={bx} y2={by} />
      <polygon className="oh-tip" points={tip} />
      <line className="oh-shine" x1={sx - dy * 1.1} y1={sy + dx * 1.1} x2={bx - dy * 1.1 - dx * 1.5} y2={by + dx * 1.1 - dy * 1.5} />
    </g>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="oh-btn" onClick={() => void shareOrCopy({ title: 'Outta Here', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  return (
    <div className="oh oh-menu">
      <div className="oh-menu-top">
        <button className="oh-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="oh-logo" aria-hidden="true">
        <span>⬆</span>
        <span>➡</span>
        <span>⬅</span>
      </div>
      <h1 className="oh-title">
        Outta <span>Here</span>
      </h1>
      <p className="oh-tag">Every arrow wants out. Tap them in the right order: one in the way costs a heart.</p>
      <section className="oh-card">
        <div className="oh-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{daily ? `Today: ${daily.best}` : `${DAILY_LEVELS} levels, the same for everyone · one try a day`}</span>
        </div>
        {daily ? (
          <div className="oh-done">
            {daily.best > 0 && <ShareButton text={`Outta Here #${dailyNumber(today)} ➡️\n${daily.line}\nScore: ${daily.best}\n${window.location.origin}/games/outta-here`} />}
            <NextDaily className="oh-muted" />
          </div>
        ) : (
          <button className="oh-btn oh-btn-go oh-btn-big" onClick={() => onPlay('daily')}>
            Play today’s levels
          </button>
        )}
      </section>
      <section className="oh-card">
        <div className="oh-card-head">
          <b>Endless</b>
          <span>Bigger boards as you go · a flawless level gives a heart back</span>
        </div>
        <button className="oh-btn oh-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="oh-muted">
        Best {save.best} · most levels {save.bestLevels} · {save.runs} {save.runs === 1 ? 'game' : 'games'}
      </p>
    </div>
  );
}
