import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { drawBlob, drawFrame, newView, worldX } from './render';
import { drop, newSim, nextTier, RADII, resultLine, setAim, step, STEP, TIERS, type Sim } from './sim';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.gloop';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  biggest: number;
}
interface Save {
  best: number;
  biggest: number;
  runs: number;
  daily: Record<string, DailyRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, biggest: 0, runs: 0, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.biggest = Math.min(TIERS - 1, n(o.biggest));
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), biggest: Math.min(TIERS - 1, n(v.biggest)) };
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
const SIZE_NAMES = ['Drip', 'Dot', 'Blip', 'Blob', 'Glob', 'Splodge', 'Wobble', 'Jellybean', 'Big Gloop', 'Mega Gloop', 'Rainbow Gloop'];

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <Gloop key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function Gloop({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
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
  const modeRef = useRef<Mode>(challenge ? 'challenge' : 'daily');
  const [firstSim] = useState(() => (challenge ? newSim(challenge.seed) : null));
  const sim = useRef<Sim | null>(firstSim);
  const [hud, setHud] = useState({ score: 0, next: firstSim ? nextTier(firstSim) : 0, after: firstSim ? nextTier(firstSim, 1) : 0, biggest: 0, over: false });
  const hudRef = useRef(hud);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; biggest: number; merges: number; newBest: boolean } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flashes = useRef<{ x: number; y: number; r: number; age: number }[]>([]);
  const keysHeld = useRef({ left: false, right: false });
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  const begin = (m: Mode): void => {
    // Today's daily is one try; starting it uses the try up (even if it is abandoned).
    if (m === 'daily') {
      if (saveRef.current.daily[today]) return;
      commit({ ...saveRef.current, daily: { ...saveRef.current.daily, [today]: { best: 0, tries: 1, biggest: 0 } } });
    }
    modeRef.current = m;
    setMode(m);
    const s = newSim(m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`gloop:${today}`) : randomSeed());
    sim.current = s;
    flashes.current = [];
    setResult(null);
    setPaused(false);
    const fresh = { score: 0, next: nextTier(s), after: nextTier(s, 1), biggest: 0, over: false };
    hudRef.current = fresh;
    setHud(fresh);
    setScreen('play');
  };

  const finish = useCallback(
    (s: Sim) => {
      const m = modeRef.current;
      const cur = saveRef.current;
      const newBest = s.score > cur.best;
      commit({
        ...cur,
        best: Math.max(cur.best, s.score),
        biggest: Math.max(cur.biggest, s.biggest),
        runs: cur.runs + 1,
        daily: m === 'daily' ? { ...cur.daily, [today]: { best: s.score, tries: 1, biggest: s.biggest } } : cur.daily,
      });
      const end = { type: 'end' as const, score: s.score, stats: { biggest: s.biggest + 1, merges: s.merges } };
      host.report(m === 'daily' ? { ...end, daily: true } : m === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
      setResult({ score: s.score, biggest: s.biggest, merges: s.merges, newBest });
    },
    [commit, host, today, challenge],
  );

  // Game loop: fixed physics steps, drawn every frame.
  useEffect(() => {
    if (screen !== 'play') return;
    const c0 = canvas.current;
    if (!c0) return;
    const view = newView();
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
        const held = keysHeld.current;
        if (held.left !== held.right) setAim(s, s.aim + (held.right ? 1 : -1) * 320 * dt);
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps++ < 24) {
          acc -= STEP;
          for (const e of step(s)) {
            if (e.type === 'merge') {
              sfx().merge(e.tier);
              flashes.current.push({ x: e.x, y: e.y, r: RADII[e.tier]!, age: 0 });
            } else if (e.type === 'top') {
              sfx().top();
              flashes.current.push({ x: e.x, y: e.y, r: RADII[TIERS - 1]!, age: 0 });
            } else if (e.type === 'over') {
              sfx().over();
              navigator.vibrate?.(80);
              finish(s);
            }
          }
        }
        for (const f of flashes.current) f.age += dt;
        flashes.current = flashes.current.filter((f) => f.age < 0.5);
      }
      if (acc > STEP) acc %= STEP;
      drawFrame(c, view, s, now / 1000, flashes.current);
      const h = hudRef.current;
      const next = nextTier(s);
      if (h.score !== s.score || h.next !== next || h.biggest !== s.biggest || h.over !== s.over) {
        const fresh = { score: s.score, next, after: nextTier(s, 1), biggest: s.biggest, over: s.over };
        hudRef.current = fresh;
        setHud(fresh);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [screen, paused, finish, sfx]);

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'play' && !hud.over) setPaused(true);
  }

  const aimAt = (clientX: number): void => {
    const s = sim.current;
    const c = canvas.current;
    if (!s || !c || s.over) return;
    setAim(s, worldX(c.getBoundingClientRect(), clientX));
  };
  const release = useCallback(() => {
    const s = sim.current;
    if (!s || s.over) return;
    if (paused) return setPaused(false);
    if (!s.started) host.report({ type: 'start' });
    if (drop(s)) sfx().drop();
  }, [paused, host, sfx]);

  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent): void => {
      // Once the jar is full, Enter and Space are left to the focused end-screen button.
      if (sim.current?.over) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysHeld.current.left = true;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysHeld.current.right = true;
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) release();
        return;
      } else if (e.key === 'p' || e.key === 'Escape') {
        if (sim.current?.started && !sim.current.over) setPaused((p) => !p);
        return;
      } else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysHeld.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysHeld.current.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [screen, release]);

  if (screen === 'menu') return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const daily = save.daily[today];
  return (
    <div className="gl">
      <div className="gl-hud" aria-live="polite">
        <button className="gl-icon" onClick={() => (hud.over ? setScreen('menu') : setPaused((p) => !p))} aria-label={hud.over ? 'Menu' : 'Pause'}>
          {hud.over ? '☰' : 'II'}
        </button>
        <div className="gl-score">
          <b>{hud.score}</b>
          <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily jar #${dailyNumber(today)}` : `Best ${save.best}`}</span>
        </div>
        <div className="gl-next" aria-label={`Next: ${SIZE_NAMES[hud.next]}, then ${SIZE_NAMES[hud.after]}`}>
          <span>next</span>
          <BlobIcon tier={hud.after} size={30} />
        </div>
      </div>
      <canvas
        ref={canvas}
        className="gl-canvas"
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* capture is a nicety: aiming still works over the jar */
          }
          aimAt(e.clientX);
        }}
        onPointerMove={(e) => aimAt(e.clientX)}
        onPointerUp={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          aimAt(e.clientX);
          release();
        }}
        aria-label="The jar. Move to aim, tap or press Space to drop."
      />
      {paused && (
        <button className="gl-overlay" onClick={() => setPaused(false)}>
          Paused · tap to continue
        </button>
      )}
      {hud.over && result && (
        <div className="gl-over">
          <h2>{result.biggest >= 8 ? 'Gloriously gloopy!' : 'The jar’s full!'}</h2>
          <p className="gl-big">{result.score}</p>
          <p className="gl-muted">
            Biggest: {SIZE_NAMES[result.biggest]} · {result.merges} merges {result.newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(result.biggest)} label={`Biggest blob: ${SIZE_NAMES[result.biggest]}`} />
          {mode === 'daily' && daily && (
            <p className="gl-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="gl-row">
            {mode === 'challenge' && challenge ? (
              <a className="gl-btn gl-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="gl-btn gl-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Gloop #${dailyNumber(today)} 🫧\n${resultLine(daily.biggest)}\nScore: ${daily.best}\n${window.location.origin}/games/gloop`} />}
            <button className="gl-btn" onClick={() => setScreen('menu')}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A small still blob, for the HUD and menu. */
function BlobIcon({ tier, size, t = 0 }: { tier: number; size: number; t?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    drawBlob(ctx, tier, size / 2 - 3, t);
  }, [tier, size, t]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="gl-btn" onClick={() => void shareOrCopy({ title: 'Gloop', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  return (
    <div className="gl gl-menu">
      <div className="gl-menu-top">
        <button className="gl-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="gl-family" aria-hidden="true">
        {[1, 3, 5, 7].map((t) => (
          <BlobIcon key={t} tier={t} size={26 + t * 6} />
        ))}
      </div>
      <h1 className="gl-title">Gloop</h1>
      <p className="gl-tag">Drop the jelly blobs. Two of a kind squish into a bigger one. Don’t let the jar overflow.</p>
      <section className="gl-card">
        <div className="gl-card-head">
          <b>Daily jar #{dailyNumber(today)}</b>
          <span>{daily ? `Today: ${daily.best}` : 'The same blobs for everyone · one try a day'}</span>
        </div>
        {daily ? (
          <div className="gl-done">
            {daily.best > 0 && <ShareButton text={`Gloop #${dailyNumber(today)} 🫧\n${resultLine(daily.biggest)}\nScore: ${daily.best}\n${window.location.origin}/games/gloop`} />}
            <NextDaily className="gl-muted" />
          </div>
        ) : (
          <button className="gl-btn gl-btn-go gl-btn-big" onClick={() => onPlay('daily')}>
            Fill today’s jar
          </button>
        )}
      </section>
      <section className="gl-card">
        <div className="gl-card-head">
          <b>Endless</b>
          <span>A new mix of blobs every jar</span>
        </div>
        <button className="gl-btn gl-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="gl-muted">
        Best {save.best} · biggest {SIZE_NAMES[save.biggest]} · {save.runs} {save.runs === 1 ? 'jar' : 'jars'}
      </p>
      <p className="gl-muted gl-small">Two Rainbow Gloops pop for 100 bonus points.</p>
    </div>
  );
}
