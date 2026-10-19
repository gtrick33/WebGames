import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { drawBird, drawFrame, newView } from './render';
import { biomeFor, flap, flightLine, MEDAL_ICON, medalFor, newSim, runPoints, step, STEP, type Medal, type Sim } from './sim';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';

const KEY = 'glitchbound.wing-it';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  bestPillars: number;
  feathers: number;
  runs: number;
  /** Today's best flight (its gaps and feathers draw the share line) and how many tries. */
  daily: Record<string, { best: number; tries: number; pillars?: number; feathers?: number }>;
  medals: Record<string, number>;
  muted: boolean;
}

const emptySave = (): Save => ({ best: 0, bestPillars: 0, feathers: 0, runs: 0, daily: {}, medals: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.bestPillars = n(o.bestPillars);
    s.feathers = n(o.feathers);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object') {
      for (const [d, v] of Object.entries(o.daily).slice(-60)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== 'object') continue;
        const e = v as { best?: number; tries?: number; pillars?: number; feathers?: number };
        s.daily[d] = { best: n(e.best), tries: n(e.tries), ...(e.pillars !== undefined ? { pillars: n(e.pillars), feathers: n(e.feathers) } : {}) };
      }
    }
    if (o.medals && typeof o.medals === 'object') for (const [m, v] of Object.entries(o.medals)) s.medals[m] = n(v);
    return s;
  } catch {
    return emptySave();
  }
}

const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage */
  }
};

const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

/** The share line of today's best flight (older saves only kept its points). */
const dailyLine = (d: Save['daily'][string]): string => flightLine(d.pillars ?? d.best, d.feathers ?? 0);

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <WingIt key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function WingIt({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [screen, setScreen] = useState<'menu' | 'play'>(challenge ? 'play' : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [hud, setHud] = useState({ score: 0, feathers: 0, dead: false, started: false, biome: 'meadow' });
  const hudRef = useRef(hud);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ points: number; pillars: number; feathers: number; medal: Medal; newBest: boolean } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // A friends' challenge starts straight away: one flight on the challenge's seed.
  const [firstSim] = useState(() => (challenge ? newSim(challenge.seed) : null));
  const sim = useRef<Sim | null>(firstSim);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const deadAt = useRef(0);
  const modeRef = useRef<Mode>(challenge ? 'challenge' : 'daily');
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  const begin = (m: Mode): void => {
    // The daily course is one flight a day; taking off uses it up (even if the flight is abandoned).
    if (m === 'daily') {
      if (saveRef.current.daily[today]) return;
      commit({ ...saveRef.current, daily: { ...saveRef.current.daily, [today]: { best: 0, tries: 1, pillars: 0, feathers: 0 } } });
    }
    modeRef.current = m;
    setMode(m);
    sim.current = newSim(m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`wing-it:${today}`) : (Math.random() * 2 ** 32) >>> 0);
    setResult(null);
    setPaused(false);
    const fresh = { score: 0, feathers: 0, dead: false, started: false, biome: 'meadow' };
    hudRef.current = fresh;
    setHud(fresh);
    setScreen('play');
  };

  const finish = useCallback(
    (s: Sim) => {
      const points = runPoints(s);
      const m = modeRef.current;
      const cur = saveRef.current;
      const medal = medalFor(s.score);
      const newBest = points > cur.best;
      const next: Save = {
        ...cur,
        best: Math.max(cur.best, points),
        bestPillars: Math.max(cur.bestPillars, s.score),
        feathers: cur.feathers + s.feathers,
        runs: cur.runs + 1,
        medals: medal ? { ...cur.medals, [medal]: (cur.medals[medal] ?? 0) + 1 } : cur.medals,
        daily: m === 'daily' ? { ...cur.daily, [today]: { best: points, tries: 1, pillars: s.score, feathers: s.feathers } } : cur.daily,
      };
      commit(next);
      const end = { type: 'end' as const, score: points, stats: { pillars: s.score, feathers: s.feathers } };
      host.report(m === 'daily' ? { ...end, daily: true } : m === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
      setResult({ points, pillars: s.score, feathers: s.feathers, medal, newBest });
    },
    [commit, host, today, challenge],
  );

  // Game loop: fixed steps, drawn every frame between the last two steps.
  useEffect(() => {
    if (screen !== 'play') return;
    const c0 = canvas.current;
    if (!c0) return;
    const view = newView();
    // Size from a ResizeObserver: reading clientWidth in the loop would force a layout every frame.
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      view.cw = entry.contentRect.width;
      view.ch = entry.contentRect.height;
    });
    ro.observe(c0);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number): void => {
      const s = sim.current;
      const c = canvas.current;
      if (!s || !c) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!paused && !document.hidden) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps++ < 24) {
          acc -= STEP;
          const wasDead = s.dead;
          for (const e of step(s)) {
            if (e === 'score') sfx().point();
            else if (e === 'feather') sfx().feather();
            else if (e === 'crash') sfx().crash();
          }
          if (!wasDead && s.dead) {
            deadAt.current = now;
            navigator.vibrate?.(60);
            finish(s);
          }
        }
      }
      if (acc > STEP) acc %= STEP;
      drawFrame(c, view, s, now / 1000, paused ? 1 : acc / STEP);
      // React only hears about the HUD when it changes (a score), never once per frame.
      const h = hudRef.current;
      if (h.score !== s.score || h.feathers !== s.feathers || h.dead !== s.dead || h.started !== s.started) {
        const next = { score: s.score, feathers: s.feathers, dead: s.dead, started: s.started, biome: biomeFor(s.score) };
        hudRef.current = next;
        setHud(next);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [screen, paused, finish, sfx]);

  // The arcade asks for a pause (left full screen / scrolled away).
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'play' && hud.started && !hud.dead) setPaused(true);
  }

  const tap = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    if (paused) {
      setPaused(false);
      return;
    }
    if (s.dead) return;
    if (!s.started) host.report({ type: 'start' });
    flap(s);
    sfx().flap();
  }, [paused, host, sfx]);

  useEffect(() => {
    if (screen !== 'play') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (sim.current?.dead) {
          // A challenge is one flight; outside one, Space flies again.
          if (performance.now() - deadAt.current > 700 && modeRef.current !== 'challenge') begin(modeRef.current === 'daily' ? 'endless' : modeRef.current);
        } else tap();
      } else if (e.key === 'p' || e.key === 'Escape') {
        if (sim.current?.started && !sim.current.dead) setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tap]);

  if (screen === 'menu') return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const daily = save.daily[today];
  return (
    <div className="wi">
      <canvas ref={canvas} className="wi-canvas" onPointerDown={(e) => (e.button === 0 || e.pointerType !== 'mouse') && tap()} aria-label="Wing It. Tap or press Space to flap." />
      <div className="wi-hud" aria-live="polite">
        <span className="wi-score">{hud.score}</span>
        {hud.feathers > 0 && <span className="wi-feathers">🪶 {hud.feathers}</span>}
      </div>
      <button className="wi-pause" onClick={() => (sim.current?.started && !sim.current.dead ? setPaused((p) => !p) : setScreen('menu'))} aria-label={hud.started && !hud.dead ? 'Pause' : 'Menu'}>
        {hud.started && !hud.dead ? 'II' : '☰'}
      </button>
      {!hud.started && !hud.dead && (
        <div className="wi-hint" aria-hidden="true">
          <b>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1} · one flight` : mode === 'daily' ? `Daily course #${dailyNumber(today)}` : 'Endless'}</b>
          <span>Tap or press Space to flap</span>
        </div>
      )}
      {paused && (
        <button className="wi-overlay" onClick={() => setPaused(false)}>
          Paused · tap to continue
        </button>
      )}
      {hud.dead && result && (
        <div className="wi-over">
          <h2>{result.medal ? `${MEDAL_ICON[result.medal]} ${result.medal[0]!.toUpperCase()}${result.medal.slice(1)}!` : 'Bonk!'}</h2>
          <p className="wi-big">{result.points}</p>
          <p className="wi-muted">
            {result.pillars} gaps · {result.feathers} feather{result.feathers === 1 ? '' : 's'} (+{result.feathers * 3}) {result.newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={flightLine(result.pillars, result.feathers)} label={`${result.pillars} gaps${result.medal ? `, ${result.medal} medal` : ''}`} />
          {mode === 'daily' && (
            <p className="wi-muted">
              That was today’s flight. <NextDaily />
            </p>
          )}
          <div className="wi-row">
            {mode === 'challenge' && challenge ? (
              <a className="wi-btn wi-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="wi-btn wi-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Fly endless' : 'Fly again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Wing It #${dailyNumber(today)} 🐤\n${dailyLine(daily)}\nScore: ${daily.best}\n${window.location.origin}/games/wing-it`} />}
            <button className="wi-btn" onClick={() => setScreen('menu')}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="wi-btn" onClick={() => void shareOrCopy({ title: 'Wing It', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Mascot() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = (now: number): void => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== 140 * dpr) {
        c.width = 140 * dpr;
        c.height = 110 * dpr;
      }
      ctx.setTransform(dpr * 2, 0, 0, dpr * 2, 0, 0);
      ctx.clearRect(0, 0, 70, 55);
      const t = now / 1000;
      drawBird(ctx, 33, 28 + Math.sin(t * 3) * 4, Math.sin(t * 3) * -120, Math.sin(t * 6) > 0.6 ? 0.1 : 0, t, false);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="wi-mascot" width={140} height={110} aria-hidden="true" />;
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  return (
    <div className="wi wi-menu">
      <div className="wi-menu-top">
        <button className="wi-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <Mascot />
      <h1 className="wi-title">
        Wing <span>It</span>
      </h1>
      <p className="wi-tag">One tap to flap. Thread the gaps. Grab the golden feathers.</p>
      <section className="wi-card">
        <div className="wi-card-head">
          <b>Daily course #{dailyNumber(today)}</b>
          <span>{daily ? `Today: ${daily.best} · ${dailyLine(daily)}` : 'Same course for everyone · one flight a day'}</span>
        </div>
        {daily ? (
          <div className="wi-done">
            {daily.best > 0 && <ShareButton text={`Wing It #${dailyNumber(today)} 🐤\n${dailyLine(daily)}\nScore: ${daily.best}\n${window.location.origin}/games/wing-it`} />}
            <NextDaily className="wi-muted" />
          </div>
        ) : (
          <button className="wi-btn wi-btn-go wi-btn-big" onClick={() => onPlay('daily')}>
            Fly today’s course
          </button>
        )}
      </section>
      <section className="wi-card">
        <div className="wi-card-head">
          <b>Endless</b>
          <span>A new random sky every flight</span>
        </div>
        <button className="wi-btn wi-btn-big" onClick={() => onPlay('endless')}>
          Fly endless
        </button>
      </section>
      <p className="wi-muted">
        Best {save.best} · {save.runs} flights · 🪶 {save.feathers} · {(['platinum', 'gold', 'silver', 'bronze'] as const).map((m) => `${MEDAL_ICON[m]}${save.medals[m] ?? 0}`).join(' ')}
      </p>
      <p className="wi-muted wi-small">Medals at 10, 25, 50 and 100 gaps. The world changes every 15.</p>
    </div>
  );
}
