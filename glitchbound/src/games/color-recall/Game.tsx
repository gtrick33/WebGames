import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, formatCountdown, msUntilMidnight, parseDayKey } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { feedback, hexToRgb, hsbToRgb, inkOn, MAX_POINTS, rgbToHex, rgbToHsb, VERDICT_TEXT, verdictFor, type Hsb, type Rgb } from './color';
import { Glyph } from './Glyph';
import {
  DAILY_DIFFICULTY,
  dailyNumber,
  dailyRounds,
  endStats,
  MAX_SCORE,
  newGame,
  PEEK_MS,
  practiceRounds,
  reduce,
  rng,
  resultLine,
  resultTarget,
  ROUNDS,
  shareText,
  totalScore,
  type Difficulty,
  type GameState,
  type RoundResult,
} from './logic';
import { createSfx, type Sfx } from './sound';
import { crStats, isComplete, loadCr, markDailySeen, recordColor, recordPracticeGame, saveCr, seenDailyRound, type CrSave } from './store';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Easy', note: '5 s peek' },
  { id: 'normal', label: 'Normal', note: '3 s peek' },
  { id: 'hard', label: 'Hard', note: '1.2 s peek' },
  { id: 'memory', label: 'Recall', note: 'No peek' },
];
const isDifficulty = (v: string): v is Difficulty => v in PEEK_MS;

export default function Game({ host, restartKey, challenge }: GameModuleProps) {
  // Restart = a fresh mount: back to the menu, all timers and sounds released.
  return <ColorRecall key={restartKey} host={host} challenge={challenge} />;
}

type Screen = 'menu' | 'play' | 'stats';

function ColorRecall({ host, challenge }: { host: GameHost; challenge?: GameModuleProps['challenge'] }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<CrSave>(loadCr);
  const [screen, setScreen] = useState<Screen>(challenge ? 'play' : 'menu');
  // A friends' challenge starts straight away: five colors from the challenge's seed, daily peek time.
  const [game, setGame] = useState<GameState | null>(() => (challenge ? newGame('challenge', practiceRounds(rng(challenge.seed)), PEEK_MS[DAILY_DIFFICULTY]) : null));
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rootRef = useRef<HTMLDivElement>(null);
  // Each new screen and color starts at the top of the (scrollable) stage.
  const view = `${screen}:${game?.mode ?? ''}:${game?.index ?? ''}:${game?.phase === 'done'}`;
  useEffect(() => {
    rootRef.current?.scrollTo?.({ top: 0 });
  }, [view]);
  const saveRef = useRef(save);
  const commit = useCallback(
    (next: CrSave) => {
      saveRef.current = next;
      setSave(next);
      saveCr(next, today);
    },
    [today],
  );

  // Sounds are created on first use (always inside a tap) and released on unmount.
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  const difficulty: Difficulty = isDifficulty(save.difficulty) ? save.difficulty : 'normal';
  const todays = save.daily[today];

  const startDaily = (): void => {
    const done = save.daily[today] ?? [];
    const g = newGame('daily', dailyRounds(today), PEEK_MS[DAILY_DIFFICULTY], done);
    // One look per daily color: a color already shown (then left mid-guess) resumes straight at mixing.
    setGame(g.phase === 'peek' && seenDailyRound(save, today) >= g.index ? { ...g, phase: 'guess' } : g);
    setScreen('play');
    if (!isComplete(done)) host.report({ type: 'start' });
  };
  const startPractice = (): void => {
    setGame(newGame('practice', practiceRounds(Math.random), PEEK_MS[difficulty]));
    setScreen('play');
    host.report({ type: 'start' });
  };

  // Remember each daily color as soon as it is shown, so leaving and resuming can't show it again.
  useEffect(() => {
    if (game?.mode === 'daily' && game.phase === 'peek' && seenDailyRound(saveRef.current, today) < game.index) {
      commit(markDailySeen(saveRef.current, today, game.index));
    }
  }, [game, today, commit]);

  const onHide = useCallback(() => setGame((g) => (g ? reduce(g, { type: 'hide' }) : g)), []);
  const onNext = useCallback(() => {
    sfx().tick();
    setGame((g) => (g ? reduce(g, { type: 'next' }) : g));
  }, [sfx]);

  const onSubmit = (guess: Rgb): void => {
    if (!game || game.phase !== 'guess') return;
    const next = reduce(game, { type: 'submit', guess });
    const result = next.results[next.results.length - 1]!;
    setGame(next);
    let s = recordColor(saveRef.current, result, game.mode === 'daily' ? today : null);
    sfx().reveal(result.points);
    if (result.points >= 900) navigator.vibrate?.(30);
    if (next.results.length >= next.rounds.length) {
      const end = reportEnd(host, next.results, game.mode === 'daily', game.mode === 'challenge' ? challenge : undefined);
      if (game.mode === 'practice') s = recordPracticeGame(s, end.score);
    }
    commit(s);
  };

  return (
    <div className="cr" data-screen={screen} ref={rootRef}>
      {screen === 'menu' && (
        <Menu
          today={today}
          todays={todays}
          save={save}
          difficulty={difficulty}
          onDifficulty={(d) => commit({ ...saveRef.current, difficulty: d })}
          onDaily={startDaily}
          onPractice={startPractice}
          onStats={() => setScreen('stats')}
          onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })}
        />
      )}
      {screen === 'stats' && <Stats save={save} today={today} onBack={() => setScreen('menu')} />}
      {screen === 'play' && game && (
        <Play
          game={game}
          today={today}
          save={save}
          onHide={onHide}
          onSubmit={onSubmit}
          onNext={onNext}
          onSliders={(m) => commit({ ...saveRef.current, sliders: m })}
          onMenu={() => {
            setGame(null);
            setScreen('menu');
          }}
          onAgain={startPractice}
          challengeId={challenge?.id}
        />
      )}
    </div>
  );
}

/**
 * The one place a finished 5-color game is reported to the arcade. `isDaily` marks today's
 * shared daily run (never practice); the arcade counts it as this game's own daily.
 */
function reportEnd(host: GameHost, results: RoundResult[], isDaily: boolean, challenge?: GameModuleProps['challenge']): ReturnType<typeof endStats> {
  const end = endStats(results);
  host.report(isDaily ? { type: 'end', ...end, daily: true } : challenge ? { type: 'end', ...end, challenge: { id: challenge.id, round: challenge.round } } : { type: 'end', ...end });
  return end;
}

/* ------------------------------------------------------------------ menu */

function Wordmark() {
  const letters = 'COLOR'.split('');
  const colors = ['#ff5a6c', '#ffb020', '#12c6b3', '#3d5bff', '#a45cff'];
  return (
    <h1 className="cr-wordmark" aria-label="Color Recall">
      <span className="cr-wordmark-chips" aria-hidden="true">
        {letters.map((l, i) => (
          <span key={i} style={{ background: colors[i], transform: `rotate(${[-6, 4, -3, 5, -4][i]}deg)` }}>
            {l}
          </span>
        ))}
      </span>
      <span className="cr-wordmark-sub" aria-hidden="true">
        Recall
      </span>
    </h1>
  );
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="cr-mono">{formatCountdown(ms)}</span>;
}

function Menu(props: {
  today: string;
  todays: RoundResult[] | undefined;
  save: CrSave;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onDaily: () => void;
  onPractice: () => void;
  onStats: () => void;
  onMute: () => void;
}) {
  const { today, todays, save } = props;
  const stats = crStats(save, today);
  const done = isComplete(todays);
  const started = !done && (todays?.length ?? 0) > 0;
  const date = parseDayKey(today).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="cr-menu">
      <div className="cr-menu-top">
        <MuteButton muted={save.muted} onClick={props.onMute} />
        {stats.streak > 0 && <span className="cr-chip cr-chip-fire">🔥 {stats.streak}-day streak</span>}
      </div>
      <Wordmark />
      <p className="cr-tagline">See a color. Hold it in your head. Mix it back.</p>

      <section className="cr-card cr-card-daily">
        <div className="cr-card-head">
          <span className="cr-kicker">Daily #{dailyNumber(today)}</span>
          <span className="cr-muted">{date}</span>
        </div>
        {done ? (
          <>
            <ResultStrip results={todays!} />
            <p className="cr-daily-score">
              <b>{fmt(totalScore(todays!))}</b> / {fmt(MAX_SCORE)}
            </p>
            <div className="cr-row">
              <ShareButton today={today} results={todays!} streak={stats.streak} />
              <button className="cr-btn cr-btn-ghost" onClick={props.onDaily}>
                Review
              </button>
            </div>
            <p className="cr-muted cr-small">
              Next daily in <Countdown />
            </p>
          </>
        ) : (
          <>
            <p className="cr-card-text">Five colors, the same for everyone today. You get one look at each.</p>
            <button className="cr-btn cr-btn-go" onClick={props.onDaily}>
              {started ? `Resume (${todays!.length}/${ROUNDS})` : 'Play today’s colors'}
            </button>
          </>
        )}
      </section>

      <section className="cr-card">
        <div className="cr-card-head">
          <span className="cr-kicker">Practice</span>
          <span className="cr-muted">Unlimited</span>
        </div>
        <div className="cr-seg" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} role="radio" aria-checked={props.difficulty === d.id} className="cr-seg-btn" onClick={() => props.onDifficulty(d.id)}>
              <b>{d.label}</b>
              <small>{d.note}</small>
            </button>
          ))}
        </div>
        <button className="cr-btn" onClick={props.onPractice}>
          Practice 5 colors
        </button>
      </section>

      <button className="cr-link" onClick={props.onStats}>
        Your stats →
      </button>
    </div>
  );
}

function MuteButton({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  return (
    <button className="cr-icon-btn" onClick={onClick} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function ResultStrip({ results }: { results: RoundResult[] }) {
  return (
    <ol className="cr-strip">
      {results.map((r, i) => {
        const t = resultTarget(r);
        return (
          <li key={i} title={`${t?.name ?? ''}: ${r.points} points`}>
            <span className="cr-strip-pair">
              <i style={{ background: t?.hex }} />
              <i style={{ background: r.guess }} />
            </span>
            <b className={`cr-v-${verdictFor(r.points)}`}>{r.points}</b>
          </li>
        );
      })}
    </ol>
  );
}

function ShareButton({ today, results, streak }: { today: string; results: RoundResult[]; streak: number }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  const share = async (): Promise<void> => {
    const url = `${window.location.origin}/games/color-recall`;
    const outcome = await shareOrCopy({ title: 'Color Recall', text: shareText(today, results, streak, url) });
    setMsg(outcome === 'copied' ? 'Copied!' : outcome === 'failed' ? 'Could not copy' : '');
  };
  return (
    <button className="cr-btn cr-btn-go" onClick={() => void share()}>
      {msg || 'Share result'}
    </button>
  );
}

/* ----------------------------------------------------------------- stats */

function Stats({ save, today, onBack }: { save: CrSave; today: string; onBack: () => void }) {
  const s = crStats(save, today);
  const max = Math.max(1, ...s.histogram);
  const tiles: [string, string][] = [
    ['Dailies played', fmt(s.dailyPlayed)],
    ['Current streak', fmt(s.streak)],
    ['Best streak', fmt(s.bestStreak)],
    ['Best daily', s.bestDaily ? fmt(s.bestDaily) : '–'],
    ['Average daily', s.avgDaily ? fmt(s.avgDaily) : '–'],
    ['Practice games', fmt(s.practiceGames)],
    ['Best practice', s.practiceBest ? fmt(s.practiceBest) : '–'],
    ['Best single color', s.bestColor ? fmt(s.bestColor) : '–'],
    ['Perfect colors', fmt(s.perfects)],
  ];
  return (
    <div className="cr-stats">
      <div className="cr-top">
        <button className="cr-icon-btn" onClick={onBack} aria-label="Back to menu">
          ←
        </button>
        <h2>Your stats</h2>
      </div>
      <div className="cr-stat-grid">
        {tiles.map(([k, v]) => (
          <div key={k} className="cr-stat">
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <h3 className="cr-kicker">Daily scores</h3>
      <div className="cr-hist">
        {s.histogram.map((n, i) => (
          <div key={i} className="cr-hist-row">
            <span className="cr-mono">{i === 4 ? '4k+' : `${i}k`}</span>
            <span className="cr-hist-bar" style={{ width: `${Math.max(4, (n / max) * 100)}%` }}>
              {n}
            </span>
          </div>
        ))}
      </div>
      <p className="cr-muted cr-small">Saved on this device only.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ play */

type SliderMode = 'hsb' | 'rgb';

interface Mix {
  hsb: Hsb;
  rgb: Rgb;
}

const mixFromHsb = (hsb: Hsb): Mix => ({ hsb, rgb: hsbToRgb(hsb) });

function Play(props: {
  game: GameState;
  today: string;
  save: CrSave;
  onHide: () => void;
  onSubmit: (guess: Rgb) => void;
  onNext: () => void;
  onSliders: (m: SliderMode) => void;
  onMenu: () => void;
  onAgain: () => void;
  challengeId?: string;
}) {
  const { game, onHide } = props;
  const round = game.rounds[game.index];
  const [mix, setMix] = useState<Mix>(() => mixFromHsb(round ? round.start : { h: 0, s: 50, b: 50 }));
  const [roundIndex, setRoundIndex] = useState(game.index);
  // New round: move the sliders to that round's (seeded) starting color.
  if (roundIndex !== game.index) {
    setRoundIndex(game.index);
    if (round) setMix(mixFromHsb(round.start));
  }

  // Peek: show the target, then hide it.
  useEffect(() => {
    if (game.phase !== 'peek') return;
    const t = window.setTimeout(onHide, game.peekMs);
    return () => window.clearTimeout(t);
  }, [game.phase, game.index, game.peekMs, onHide]);

  const { onSubmit, onNext } = props;
  const submit = useCallback(() => onSubmit(mix.rgb), [onSubmit, mix.rgb]);

  // Enter: skip the peek / lock in / next color.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'BUTTON' || el.tagName === 'A' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range'))) return;
      e.preventDefault();
      if (game.phase === 'peek') onHide();
      else if (game.phase === 'guess') submit();
      else if (game.phase === 'reveal') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.phase, onHide, submit, onNext]);

  if (game.phase === 'done' || !round) return <Summary {...props} />;

  const target = round.target;
  const targetRgb = hexToRgb(target.hex);
  const result = game.phase === 'reveal' ? game.results[game.index] : undefined;
  const mode: SliderMode = props.save.sliders;

  return (
    <div className="cr-play">
      <div className="cr-top">
        <button className="cr-icon-btn" onClick={props.onMenu} aria-label="Back to menu">
          ←
        </button>
        <span className="cr-kicker">{game.mode === 'daily' ? `Daily #${dailyNumber(props.today)}` : game.mode === 'challenge' ? '⚔️ Challenge round' : 'Practice'}</span>
        <ol className="cr-pips" aria-label={`Color ${game.index + 1} of ${game.rounds.length}`}>
          {game.rounds.map((_, i) => {
            const r = game.results[i];
            return <li key={i} className={i === game.index ? 'is-now' : ''} style={r ? { background: r.guess } : undefined} />;
          })}
        </ol>
        <span className="cr-total cr-mono">{fmt(totalScore(game.results))}</span>
      </div>

      <div className={`cr-hero cr-hero-${game.phase}`}>
        {game.phase === 'peek' && (
          <>
            <Glyph id={target.glyph} fill={target.hex} className="cr-glyph cr-pop" />
            <span className="cr-peek-bar" style={{ animationDuration: `${game.peekMs}ms` }} />
            <button className="cr-peek-skip" onClick={onHide}>
              Got it
            </button>
          </>
        )}
        {game.phase === 'guess' && (
          <>
            <Glyph id={target.glyph} fill={rgbToHex(mix.rgb)} className="cr-glyph" />
            <span className="cr-hero-label">Your mix</span>
          </>
        )}
        {game.phase === 'reveal' && result && <Reveal targetHex={target.hex} result={result} />}
      </div>

      <div className="cr-name">
        <h2>{target.name}</h2>
        <p>{game.phase === 'peek' ? 'Memorize this color!' : target.hint}</p>
      </div>

      {game.phase === 'reveal' && result ? (
        <Feedback target={targetRgb} result={result} />
      ) : (
        <div className="cr-mixer-wrap" aria-hidden={game.phase === 'peek'} inert={game.phase === 'peek'}>
          <Mixer mix={mix} mode={mode} onChange={setMix} onMode={props.onSliders} />
        </div>
      )}

      {game.phase === 'reveal' ? (
        <>
          <Mixer mix={mix} mode={mode} onChange={setMix} onMode={props.onSliders} target={targetRgb} readOnly />
          <button className="cr-btn cr-btn-go cr-btn-big" onClick={onNext} autoFocus>
            {game.index + 1 >= game.rounds.length ? 'See results' : 'Next color →'}
          </button>
        </>
      ) : (
        <button className="cr-btn cr-btn-go cr-btn-big" onClick={submit} disabled={game.phase !== 'guess'}>
          {game.phase === 'peek' ? 'Look closely…' : 'Lock it in'}
        </button>
      )}
    </div>
  );
}

function Reveal({ targetHex, result }: { targetHex: string; result: RoundResult }) {
  const shown = useCountUp(result.points);
  const v = verdictFor(result.points);
  return (
    <div className="cr-reveal">
      <div className="cr-compare">
        <span className="cr-swatch" style={{ background: targetHex, color: inkOn(hexToRgb(targetHex)) }}>
          <small>Target</small>
          <b className="cr-mono">{targetHex}</b>
        </span>
        <span className="cr-swatch" style={{ background: result.guess, color: inkOn(hexToRgb(result.guess)) }}>
          <small>Yours</small>
          <b className="cr-mono">{result.guess}</b>
        </span>
      </div>
      <div className={`cr-verdict cr-v-${v}`}>
        <b className="cr-points cr-mono">{shown}</b>
        <span>{VERDICT_TEXT[v]}</span>
      </div>
    </div>
  );
}

/** Counts up to `to` over ~0.7 s (instantly with reduced motion). The rAF loop stops on unmount. */
function useCountUp(to: number): number {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / 700);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);
  return n;
}

function Feedback({ target, result }: { target: Rgb; result: RoundResult }) {
  const tips = feedback(target, hexToRgb(result.guess));
  return (
    <div className="cr-feedback" aria-live="polite">
      <span className="cr-chip">ΔE {result.dE.toFixed(1)}</span>
      {tips.length ? tips.map((t) => <span key={t} className="cr-chip cr-chip-tip">{t}</span>) : <span className="cr-chip cr-chip-tip">Spot on</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- sliders */

interface Channel {
  key: string;
  label: string;
  name: string;
  max: number;
  value: number;
  /** Target marker shown after the reveal. */
  mark?: number;
  track: string;
  set: (v: number) => Mix;
}

function channels(mix: Mix, mode: SliderMode, target?: Rgb): Channel[] {
  const { hsb, rgb } = mix;
  const css = (c: Rgb): string => `rgb(${c.r} ${c.g} ${c.b})`;
  if (mode === 'hsb') {
    const t = target ? rgbToHsb(target, hsb.h) : undefined;
    const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => css(hsbToRgb({ h, s: Math.max(hsb.s, 55), b: Math.max(hsb.b, 70) }))).join(',');
    return [
      { key: 'h', label: 'H', name: 'Hue', max: 359, value: hsb.h, mark: t?.h, track: `linear-gradient(90deg,${hueStops})`, set: (h) => mixFromHsb({ ...hsb, h }) },
      { key: 's', label: 'S', name: 'Saturation', max: 100, value: hsb.s, mark: t?.s, track: `linear-gradient(90deg,${css(hsbToRgb({ ...hsb, s: 0 }))},${css(hsbToRgb({ ...hsb, s: 100 }))})`, set: (s) => mixFromHsb({ ...hsb, s }) },
      { key: 'b', label: 'B', name: 'Brightness', max: 100, value: hsb.b, mark: t?.b, track: `linear-gradient(90deg,#000,${css(hsbToRgb({ ...hsb, b: 100 }))})`, set: (b) => mixFromHsb({ ...hsb, b }) },
    ];
  }
  const fromRgb = (c: Rgb): Mix => ({ rgb: c, hsb: rgbToHsb(c, hsb.h) });
  return (['r', 'g', 'b'] as const).map((k) => ({
    key: k,
    label: k.toUpperCase(),
    name: { r: 'Red', g: 'Green', b: 'Blue' }[k],
    max: 255,
    value: rgb[k],
    mark: target?.[k],
    track: `linear-gradient(90deg,${css({ ...rgb, [k]: 0 })},${css({ ...rgb, [k]: 255 })})`,
    set: (v: number) => fromRgb({ ...rgb, [k]: v }),
  }));
}

function Mixer({ mix, mode, onChange, onMode, target, readOnly }: { mix: Mix; mode: SliderMode; onChange: (m: Mix) => void; onMode: (m: SliderMode) => void; target?: Rgb; readOnly?: boolean }) {
  const list = channels(mix, mode, target);
  return (
    <div className={`cr-mixer${readOnly ? ' is-readonly' : ''}`}>
      {!readOnly && (
        <div className="cr-mixer-head">
          <div className="cr-toggle" role="radiogroup" aria-label="Slider type">
            {(['hsb', 'rgb'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => onMode(m)}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="cr-hex cr-mono">
            <i style={{ background: rgbToHex(mix.rgb) }} />
            {rgbToHex(mix.rgb)}
          </span>
        </div>
      )}
      {list.map((c) => (
        <div key={c.key} className="cr-slider">
          <span className="cr-slider-label" aria-hidden="true">
            {c.label}
          </span>
          {!readOnly && (
            <button className="cr-nudge" aria-label={`Less ${c.name.toLowerCase()}`} onClick={() => onChange(c.set(Math.max(0, c.value - 1)))}>
              −
            </button>
          )}
          <div className="cr-track" style={{ background: c.track }}>
            <input
              type="range"
              min={0}
              max={c.max}
              step={1}
              value={c.value}
              aria-label={c.name}
              disabled={readOnly}
              onChange={(e) => onChange(c.set(Number(e.target.value)))}
              style={{ '--thumb': rgbToHex(mix.rgb) } as CSSProperties}
            />
            {c.mark !== undefined && <i className="cr-mark" style={{ '--at': c.mark / c.max } as CSSProperties} title={`Target ${c.name}: ${c.mark}`} />}
          </div>
          {!readOnly && (
            <button className="cr-nudge" aria-label={`More ${c.name.toLowerCase()}`} onClick={() => onChange(c.set(Math.min(c.max, c.value + 1)))}>
              +
            </button>
          )}
          <output className="cr-slider-value cr-mono">{c.mark !== undefined ? `${c.value}→${c.mark}` : c.value}</output>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- summary */

function Summary({ game, today, save, onMenu, onAgain, challengeId }: { game: GameState; today: string; save: CrSave; onMenu: () => void; onAgain: () => void; challengeId?: string }) {
  const score = totalScore(game.results);
  const streak = crStats(save, today).streak;
  const best = game.results.reduce((a, r) => Math.max(a, r.points), 0);
  return (
    <div className="cr-summary">
      <span className="cr-kicker">{game.mode === 'daily' ? `Daily #${dailyNumber(today)} complete` : game.mode === 'challenge' ? '⚔️ Challenge round complete' : 'Practice complete'}</span>
      <p className="cr-summary-score">
        <b className="cr-mono">{fmt(score)}</b>
        <span>/ {fmt(MAX_SCORE)}</span>
      </p>
      <p className="cr-muted">
        {Math.round((score / (game.results.length * MAX_POINTS)) * 100)}% accuracy · best color {fmt(best)}
        {game.mode === 'daily' && streak > 0 ? ` · 🔥 ${streak}` : ''}
      </p>
      <ResultLine line={resultLine(game.results)} label={`${game.results.filter((r) => verdictFor(r.points) === 'perfect').length} perfect of ${game.results.length} colors`} />
      <ul className="cr-summary-list">
        {game.results.map((r, i) => {
          const t = resultTarget(r);
          return (
            <li key={i}>
              {t && <Glyph id={t.glyph} fill={t.hex} className="cr-summary-glyph" />}
              <span className="cr-summary-name">{t?.name}</span>
              <span className="cr-strip-pair">
                <i style={{ background: t?.hex }} />
                <i style={{ background: r.guess }} />
              </span>
              <b className={`cr-mono cr-v-${verdictFor(r.points)}`}>{r.points}</b>
            </li>
          );
        })}
      </ul>
      <div className="cr-row">
        {game.mode === 'daily' ? (
          <ShareButton today={today} results={game.results} streak={streak} />
        ) : game.mode === 'challenge' && challengeId ? (
          <a className="cr-btn cr-btn-go" href={`/c/${challengeId}`} onClick={openChallengeScores}>
            See the scoreboard
          </a>
        ) : (
          <button className="cr-btn cr-btn-go" onClick={onAgain}>
            Play again
          </button>
        )}
        <button className="cr-btn cr-btn-ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
