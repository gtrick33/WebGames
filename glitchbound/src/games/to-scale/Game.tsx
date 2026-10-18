import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { glyph } from './glyphs';
import { accuracy, LIVES, makeShot, makeShots, mark, MAX_POINTS, MISS_POINTS, pointsFor, ratioText, rng, SHOTS, type Shot } from './logic';
import { sizeText, THINGS } from './objects';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.to-scale';
const EPOCH = '2026-10-19';
const TINTS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#ff4fc8', '#7b4dff', '#00c2ff'];
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  bestEndless: number;
  runs: number;
  daily: Record<string, { best: number; tries: number; line: string }>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, bestEndless: 0, runs: 0, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.bestEndless = n(o.bestEndless);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '' };
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
const fmt = (n: number): string => n.toLocaleString('en-US');
/** "a die" → "the die". */
const the = (name: string): string => name.replace(/^(a|an) /, 'the ');
/** A word for a shot's mark, for CSS. */
const grade = (points: number): string => ({ '🎯': 'bull', '🟩': 'good', '🟨': 'ok', '🟧': 'far' })[mark(points)] ?? 'off';
/** "2.4× the die", "0.7× the die", "1/3 of the die". */
const times = (r: number, name: string): string => `${ratioText(r)}${ratioText(r).startsWith('1/') ? ' of' : ''} ${the(name)}`;

export default function Game({ host, restartKey, challenge }: GameModuleProps) {
  return <ToScale key={restartKey} host={host} challenge={challenge} />;
}

interface Played {
  points: number;
  guess: number;
}

function ToScale({ host, challenge }: { host: GameHost; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);

  const [screen, setScreen] = useState<'menu' | 'play' | 'result'>(challenge ? 'play' : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [shots, setShots] = useState<Shot[]>(() => (challenge ? makeShots(challenge.seed) : []));
  const endlessRng = useRef<(() => number) | null>(null);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState(() => (challenge ? makeShots(challenge.seed)[0]!.start : 1));
  const [phase, setPhase] = useState<'aim' | 'reveal'>('aim');
  const [played, setPlayed] = useState<Played[]>([]);
  const [lives, setLives] = useState(LIVES);
  const [newBest, setNewBest] = useState(false);
  useEffect(() => {
    if (challenge) host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = (m: Mode): void => {
    let list: Shot[];
    if (m === 'endless') {
      const r = rng((Math.random() * 2 ** 32) >>> 0);
      endlessRng.current = r;
      list = [makeShot(r)];
    } else list = makeShots(m === 'challenge' && challenge ? challenge.seed : hashString(`to-scale:${today}`));
    setMode(m);
    setShots(list);
    setIdx(0);
    setGuess(list[0]!.start);
    setPhase('aim');
    setPlayed([]);
    setLives(LIVES);
    setScreen('play');
    host.report({ type: 'start' });
  };

  const shot = shots[idx];
  const total = played.reduce((a, p) => a + p.points, 0);

  const lock = (): void => {
    if (!shot || phase !== 'aim') return;
    const points = pointsFor(guess, shot.ratio);
    setPlayed((p) => [...p, { points, guess }]);
    if (mode === 'endless' && points < MISS_POINTS) setLives((l) => l - 1);
    setPhase('reveal');
    sfx().lock();
    window.setTimeout(() => sfx().reveal(points), 180);
  };

  const finish = (list: Played[]): void => {
    const score = list.reduce((a, p) => a + p.points, 0);
    const bullseyes = list.filter((p) => p.points >= 900).length;
    const line = list.map((p) => mark(p.points)).join('');
    const cur = saveRef.current;
    setNewBest(score > 0 && (mode === 'daily' ? score > cur.best : mode === 'endless' ? score > cur.bestEndless : false));
    commit({
      ...cur,
      best: mode === 'daily' ? Math.max(cur.best, score) : cur.best,
      bestEndless: mode === 'endless' ? Math.max(cur.bestEndless, score) : cur.bestEndless,
      runs: cur.runs + 1,
      daily: mode === 'daily' ? { ...cur.daily, [today]: { best: Math.max(cur.daily[today]?.best ?? 0, score), tries: (cur.daily[today]?.tries ?? 0) + 1, line: score >= (cur.daily[today]?.best ?? 0) ? line : (cur.daily[today]?.line ?? line) } } : cur.daily,
    });
    const end = { type: 'end' as const, score, stats: { bullseyes } };
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    sfx().over();
    setScreen('result');
  };

  const next = (): void => {
    if (phase !== 'reveal') return;
    const over = mode === 'endless' ? lives <= 0 : idx + 1 >= shots.length;
    if (over) return finish(played);
    let list = shots;
    if (mode === 'endless' && endlessRng.current && idx + 1 >= shots.length) {
      list = [...shots, makeShot(endlessRng.current, new Set(shots.slice(-12).map((s) => s.target)))];
      setShots(list);
    }
    setIdx(idx + 1);
    setGuess(list[idx + 1]!.start);
    setPhase('aim');
  };

  // Keyboard: arrows resize (Shift for bigger steps), Enter locks in / goes on.
  const keys = useRef({ lock, next, phase, shot });
  useEffect(() => {
    keys.current = { lock, next, phase, shot };
  });
  useEffect(() => {
    if (screen !== 'play') return;
    const onKey = (e: KeyboardEvent): void => {
      const k = keys.current;
      if (!k.shot) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        if (k.phase === 'aim') k.lock();
        else k.next();
        return;
      }
      if (k.phase !== 'aim') return;
      const step = e.shiftKey ? 1.15 : 1.03;
      const s = k.shot;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '=') setGuess((g) => Math.min(s.max, g * step));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') setGuess((g) => Math.max(s.min, g / step));
      else return;
      e.preventDefault();
      sfx().tick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, sfx]);

  if (screen === 'menu') {
    const todays = save.daily[today];
    return (
      <div className="ts ts-menu">
        <div className="ts-logo" aria-label="To Scale">
          <span className="ts-logo-small">TO</span>
          <span className="ts-logo-big">SCALE</span>
          <span className="ts-ruler" aria-hidden="true" />
        </div>
        <p className="ts-tag">Two things side by side. One is the wrong size. Make it real.</p>
        <section className="ts-card ts-card-daily">
          <div>
            <b>Daily #{dailyNumber(today)}</b>
            <span>{todays ? `Best ${fmt(todays.best)} · ${todays.tries} ${todays.tries === 1 ? 'try' : 'tries'} · ${todays.line}` : `${SHOTS} shots, the same for everyone today`}</span>
          </div>
          <button className="ts-btn ts-btn-go" onClick={() => begin('daily')} autoFocus>
            {todays ? 'Play again' : 'Play today’s 5'}
          </button>
        </section>
        <section className="ts-card">
          <div>
            <b>Endless</b>
            <span>Shot after shot. {LIVES} way-off guesses and you’re out.</span>
          </div>
          <button className="ts-btn" onClick={() => begin('endless')}>
            Start
          </button>
        </section>
        <p className="ts-muted">
          {save.runs ? `Best daily ${fmt(save.best)} / ${fmt(SHOTS * MAX_POINTS)} · best endless ${fmt(save.bestEndless)} · ` : ''}
          Drag the corner, the slider or use the arrow keys. Enter to lock in.
        </p>
        <button className="ts-mute" onClick={() => commit({ ...save, muted: !save.muted })} aria-pressed={save.muted}>
          {save.muted ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
      </div>
    );
  }

  if (screen === 'result') {
    const line = played.map((p) => mark(p.points)).join('');
    const bullseyes = played.filter((p) => p.points >= 900).length;
    const shareText = `To Scale #${dailyNumber(today)} 📏\n${line}\n${fmt(total)} / ${fmt(SHOTS * MAX_POINTS)}\n${window.location.origin}/games/to-scale`;
    return (
      <div className="ts ts-result">
        <p className="ts-kicker">{mode === 'daily' ? `Daily #${dailyNumber(today)}` : mode === 'challenge' ? `Challenge · round ${challenge?.round ?? 1}` : `Endless · ${played.length} shots`}</p>
        <p className="ts-total">
          {fmt(total)}
          {mode !== 'endless' && <small> / {fmt(SHOTS * MAX_POINTS)}</small>}
        </p>
        {newBest && <p className="ts-new">New best!</p>}
        <ResultLine line={line} label={`${bullseyes} bullseyes out of ${played.length}`} />
        <p className="ts-muted">🎯 within 10% · 🟩 close · 🟨 not bad · 🟧 far · 🟥 way off</p>
        <div className="ts-row">
          {mode === 'challenge' && challenge ? (
            <a className="ts-btn ts-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              See the scoreboard
            </a>
          ) : (
            <button className="ts-btn ts-btn-go" onClick={() => begin(mode)} autoFocus>
              Play again
            </button>
          )}
          {mode === 'daily' && <ShareButton text={shareText} />}
          {mode !== 'challenge' && (
            <button className="ts-btn" onClick={() => setScreen('menu')}>
              Menu
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!shot) return null;
  const ref = THINGS[shot.ref]!;
  const target = THINGS[shot.target]!;
  const last = played[played.length - 1];
  const tint = TINTS[(shot.target + idx) % TINTS.length]!;
  return (
    <div className="ts ts-play">
      <header className="ts-hud" aria-live="polite">
        <span>{mode === 'endless' ? Array.from({ length: LIVES }, (_, i) => (i < lives ? '❤️' : '🖤')).join('') : mode === 'daily' ? `Daily #${dailyNumber(today)}` : `⚔️ Round ${challenge?.round ?? 1}`}</span>
        <span className="ts-dots">
          {mode === 'endless' ? `Shot ${idx + 1}` : shots.map((_, i) => <i key={i} className={i < played.length ? `is-${grade(played[i]!.points)}` : i === idx ? 'is-now' : ''} />)}
        </span>
        <b>{fmt(total)}</b>
      </header>
      <p className="ts-question">
        How big is <b>{target.name}</b> next to <b>{ref.name}</b>?
      </p>
      <Stage key={`${idx}:${shot.target}`} shot={shot} guess={guess} reveal={phase === 'reveal'} tint={tint} onGuess={setGuess} onTick={() => sfx().tick()} />
      {phase === 'aim' ? (
        <div className="ts-controls">
          <div className="ts-readout">
            <b>{ratioText(guess)}</b>
            {ratioText(guess).startsWith('1/') ? ' of' : ''} {the(ref.name)}
          </div>
          <div className="ts-slider">
            <button className="ts-round" aria-label="Smaller" onClick={() => setGuess((g) => Math.max(shot.min, g / 1.05))}>
              −
            </button>
            <input
              type="range"
              min={Math.log(shot.min)}
              max={Math.log(shot.max)}
              step={(Math.log(shot.max) - Math.log(shot.min)) / 500}
              value={Math.log(guess)}
              onChange={(e) => {
                setGuess(Math.exp(Number(e.target.value)));
                sfx().tick();
              }}
              aria-label={`Size of ${target.name}`}
            />
            <button className="ts-round" aria-label="Bigger" onClick={() => setGuess((g) => Math.min(shot.max, g * 1.05))}>
              +
            </button>
          </div>
          <button className="ts-btn ts-btn-go ts-lock" onClick={lock}>
            📏 Lock it in
          </button>
        </div>
      ) : (
        last && (
          <div className="ts-reveal" role="status">
            <p className="ts-verdict">
              <span className={`ts-points ${last.points >= 700 ? 'is-good' : last.points >= MISS_POINTS ? 'is-ok' : 'is-bad'}`}>
                {mark(last.points)} +{fmt(last.points)}
              </span>
              <span className="ts-acc">{Math.round(accuracy(last.guess, shot.ratio) * 100)}% right</span>
            </p>
            <p className="ts-truth">
              Real size: <b>{sizeText(target.size)}</b>, {times(shot.ratio, ref.name)} ({sizeText(ref.size)}). You said {ratioText(last.guess)}.
            </p>
            <p className="ts-fact">{target.fact}</p>
            <button className="ts-btn ts-btn-go ts-lock" onClick={next} autoFocus>
              {mode === 'endless' ? (lives <= 0 ? 'See your score' : 'Next shot') : idx + 1 >= shots.length ? 'See your score' : 'Next shot'}
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** Real-world sizes of a thing's box, in metres, from its longest side and the picture's shape. */
function box(size: number, aspect: number): { w: number; h: number } {
  return aspect >= 1 ? { w: size, h: size / aspect } : { w: size * aspect, h: size };
}

/**
 * The blueprint: the reference in colour on the left, the target's silhouette on the right at the
 * guessed size, both standing on the floor. The view zooms to keep both in frame (it holds still
 * while you drag the corner handle). On reveal, the real thing appears at its true size.
 */
function Stage({ shot, guess, reveal, tint, onGuess, onTick }: { shot: Shot; guess: number; reveal: boolean; tint: string; onGuess: (g: number) => void; onTick: () => void }) {
  const ref = THINGS[shot.ref]!;
  const target = THINGS[shot.target]!;
  const el = useRef<HTMLDivElement>(null);
  // Measured before the first paint; nothing is drawn until then (so nothing zooms in from a guess).
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; w: number; h: number; scale: number } | null>(null);
  const [glyphs] = useState(() => ({ ref: glyph(ref.emoji, '#ffffff'), target: glyph(target.emoji, tint) }));

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    setDim({ w: node.clientWidth, h: node.clientHeight });
    const ro = new ResizeObserver(([e]) => {
      if (e) setDim({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // The wheel resizes (a native listener, so the page doesn't scroll at the same time).
  const wheel = useRef({ guess, reveal, onGuess, onTick });
  useEffect(() => {
    wheel.current = { guess, reveal, onGuess, onTick };
  });
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onWheel = (e: WheelEvent): void => {
      const w = wheel.current;
      if (w.reveal) return;
      e.preventDefault();
      w.onGuess(Math.min(shot.max, Math.max(shot.min, w.guess * Math.exp(-e.deltaY * 0.0015))));
      w.onTick();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [shot]);

  const { w: W, h: H } = dim ?? { w: 1, h: 1 };
  const unit = ref.size;
  const rb = box(unit, glyphs.ref?.aspect ?? 1);
  const gb = box(guess * unit, glyphs.target?.aspect ?? 1);
  const tb = box(shot.ratio * unit, glyphs.target?.aspect ?? 1);
  const tw = reveal ? Math.max(gb.w, tb.w) : gb.w;
  const th = reveal ? Math.max(gb.h, tb.h) : gb.h;
  const gap = W * 0.08;
  // Room is kept on the right for the corner handle.
  const HANDLE = 36;
  const fit = Math.min((H * 0.66) / Math.max(rb.h, th), (W * 0.9 - gap - HANDLE) / (rb.w + tw));
  const scale = frozen ?? fit;
  const floor = H * 0.8;
  const totalW = rb.w * scale + gap + tw * scale;
  const left = Math.max(W * 0.04, (W - HANDLE - totalW) / 2);
  const refLeft = left;
  const tLeft = left + rb.w * scale + gap;
  const place = (b: { w: number; h: number }, x: number): CSSProperties => ({ left: x, top: floor - b.h * scale, width: b.w * scale, height: b.h * scale });
  // Labels sit centred under each thing, never wider than the space between the two centres.
  const shownW = (reveal ? Math.max(gb.w, tb.w) : gb.w) * scale;
  const refMid = refLeft + (rb.w * scale) / 2;
  const tMid = tLeft + shownW / 2;
  const labelW = Math.max(64, Math.min(W * 0.46, tMid - refMid - 8));
  const label = (mid: number): CSSProperties => ({ left: Math.min(W - labelW / 2 - 4, Math.max(labelW / 2 + 4, mid)), top: floor + 6, maxWidth: labelW });

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (reveal) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // The size follows the pointer's movement from here (the handle sits a little off the corner).
    drag.current = { x: e.clientX, y: e.clientY, w: gb.w * scale, h: gb.h * scale, scale };
    setFrozen(scale);
  };
  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const d = drag.current;
    if (!d) return;
    // Proportional resize: the movement along the shape's diagonal (up-right grows it) sets the size.
    const long = Math.max(d.w, d.h);
    const px = long + (((e.clientX - d.x) * d.w - (e.clientY - d.y) * d.h) * long) / (d.w * d.w + d.h * d.h);
    const longest = Math.max(4, px) / d.scale;
    const g = Math.min(shot.max, Math.max(shot.min, longest / unit));
    onGuess(g);
    onTick();
  };
  const endDrag = (): void => {
    drag.current = null;
    setFrozen(null);
  };

  return (
    <div ref={el} className={`ts-stage${frozen ? ' is-dragging' : ''}`}>
      {dim && (
        <>
          <div className="ts-floor" style={{ top: floor }} aria-hidden="true" />
          {glyphs.ref && <img className="ts-thing ts-ref" src={glyphs.ref.color} alt={ref.name} style={place(rb, refLeft)} draggable={false} />}
          <span className="ts-label" style={label(refMid)}>
            <span>{ref.name.replace(/^(a|an|the) /, '')}</span>
            <b>{sizeText(ref.size)}</b>
          </span>
          {reveal && glyphs.target && <img className="ts-thing ts-real" src={glyphs.target.color} alt={`${target.name}, real size`} style={place(tb, tLeft)} draggable={false} />}
          {glyphs.target && <img className={`ts-thing ts-target${reveal ? ' is-ghost' : ''}`} src={glyphs.target.silhouette} alt={`${target.name}, your guess`} style={place(gb, tLeft)} draggable={false} />}
          {reveal && <span className="ts-outline" style={place(tb, tLeft)} aria-hidden="true" />}
          {!reveal && (
            <button
              className="ts-handle"
              style={{ left: Math.min(W - 44, tLeft + gb.w * scale - 6), top: Math.max(8, floor - gb.h * scale - 38) }}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-label="Drag to resize"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 18 18 6M11 6h7v7M6 11v7h7" />
              </svg>
            </button>
          )}
          <span className="ts-label is-target" style={label(tMid)}>
            <span>{target.name.replace(/^(a|an|the) /, '')}</span>
            <b>{reveal ? sizeText(target.size) : '?'}</b>
          </span>
        </>
      )}
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="ts-btn" onClick={() => void shareOrCopy({ title: 'To Scale', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}
