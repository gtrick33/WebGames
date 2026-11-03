import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { drawBlob, drawFrame, newView, worldX } from './render';
import { drop, newSim, nextTier, RADII, resultLine, setAim, simFrom, step, STEP, TIERS, type Sim } from './sim';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.gloop';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  biggest: number;
  /** true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  open?: boolean;
}
/** A friends' challenge round (saved under `${id}:${round}`): one attempt, like the daily. */
interface ChallengeRecord {
  score: number;
  biggest: number;
  merges: number;
  /** true: started, not finished (it resumes from `sim`, or ends as it stood when that is lost). */
  open?: boolean;
  sim?: Sim;
}
interface Save {
  best: number;
  biggest: number;
  runs: number;
  daily: Record<string, DailyRecord>;
  /** Today's jar so far, saved at every drop and every few seconds. */
  progress?: { day: string; sim: Sim };
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, biggest: 0, runs: 0, daily: {}, challenges: {}, muted: false });
const ROUNDS_KEPT = 20;

function parseSave(raw: string): Save {
  try {
    const o = JSON.parse(raw) as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.biggest = Math.min(TIERS - 1, n(o.biggest));
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { best: n(v.best), tries: n(v.tries), biggest: Math.min(TIERS - 1, n(v.biggest)), ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    const jar = p && typeof p.day === 'string' ? simFrom(p.sim) : null;
    if (p && jar) s.progress = { day: p.day, sim: jar };
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, v] of Object.entries(o.challenges).slice(-ROUNDS_KEPT))
        if (k.length <= 80 && v && typeof v === 'object') {
          const kept = v.open === true ? simFrom(v.sim) : null;
          s.challenges[k] = { score: n(v.score), biggest: Math.min(TIERS - 1, n(v.biggest)), merges: n(v.merges), ...(v.open === true ? { open: true } : {}), ...(kept ? { sim: kept } : {}) };
        }
    return s;
  } catch {
    return emptySave();
  }
}
/** The save as stored now (another tab may have changed it), or null when there is none or storage is blocked. */
function readStored(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : parseSave(raw);
  } catch {
    return null;
  }
}
const loadSave = (): Save => readStored() ?? emptySave();
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
/** The save with this challenge round's record set (the newest last, the oldest pruned). */
const withRound = (s: Save, key: string, rec: ChallengeRecord): Save => ({
  ...s,
  challenges: Object.fromEntries([...Object.entries(s.challenges).filter(([k]) => k !== key).slice(-(ROUNDS_KEPT - 1)), [key, rec]]),
});
const copySim = (s: Sim): Sim => ({ ...s, blobs: s.blobs.map((b) => ({ ...b })) });
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const dailySeed = (day: string): number => hashString(`gloop:${day}`);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
const SIZE_NAMES = ['Drip', 'Dot', 'Blip', 'Blob', 'Glob', 'Splodge', 'Wobble', 'Jellybean', 'Big Gloop', 'Mega Gloop', 'Rainbow Gloop'];

/** What the jar in play counts for: a daily (its day) and/or a challenge round (its save key). */
interface Track {
  day: string | null;
  ch: string | null;
}
interface Result {
  score: number;
  biggest: number;
  merges: number;
  newBest: boolean;
  note?: string;
}
interface Opening {
  sim: Sim;
  track: Track;
  /** A jar picked up again: it waits for a tap. */
  resumed: boolean;
  /** The round is over already: its result, and whether it still has to be reported (once). */
  done?: Result & { report: boolean };
}

/**
 * How a friends' challenge round opens. "Today's daily" plays that day's own jar (and counts as that
 * daily); a fresh round plays the challenge's seed. A round already finished shows its result; one in
 * progress carries on; one whose jar was lost ends as it stood.
 */
function openChallenge(save: Save, c: ChallengeSpec): Opening {
  const day = c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : null;
  const track = { day, ch: `${c.id}:${c.round}` };
  const seed = day ? dailySeed(day) : c.seed;
  const ended = (r: { score: number; biggest: number; merges: number }, report: boolean, note?: string): Opening => {
    const s = newSim(seed);
    s.over = true;
    return { sim: s, track, resumed: false, done: { score: r.score, biggest: r.biggest, merges: r.merges, newBest: false, report, ...(note ? { note } : {}) } };
  };
  const rec = save.challenges[track.ch];
  const d = day ? save.daily[day] : undefined;
  if (rec && !rec.open) return ended(rec, false);
  if (rec?.sim) return { sim: rec.sim, track, resumed: true };
  if (day && d?.open && save.progress?.day === day) return { sim: save.progress.sim, track, resumed: true };
  if (rec) return ended(rec, true, 'This round was already started, so it ends as it stood.');
  if (d) return ended({ score: d.best, biggest: d.biggest, merges: 0 }, true, 'You already played this daily jar: your daily result counts here.');
  return { sim: newSim(seed), track, resumed: false };
}

/** True when a key press is meant for something else on the page (a field, a dialog, the site around the game). */
function notForGame(e: KeyboardEvent, root: Element | null): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.closest('[role=dialog],[aria-modal=true]') || !root?.contains(el)) return true;
  if ((el instanceof HTMLElement && el.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  // A button reached with the keyboard keeps Enter and Space.
  try {
    return (e.key === 'Enter' || e.key === ' ') && el.matches('button:focus-visible, a:focus-visible');
  } catch {
    return false;
  }
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <Gloop key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function Gloop({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // The day is read again when the menu shows, when the tab comes back and when a round starts.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Every write re-reads the stored save first, so another open tab's progress is never overwritten. */
  const update = useCallback((fn: (cur: Save) => Save) => {
    const cur = readStored() ?? saveRef.current;
    const next = fn(cur);
    saveRef.current = next;
    setSave(next);
    if (next !== cur) writeSave(next);
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood, so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    if (!rec?.open || cur.progress?.day === today) return;
    update((c) => ({ ...c, daily: { ...c.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [opening] = useState<Opening | null>(() => (challenge ? openChallenge(save, challenge) : null));
  const [screen, setScreen] = useState<'menu' | 'play'>(challenge ? 'play' : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const modeRef = useRef<Mode>(challenge ? 'challenge' : 'daily');
  const [track, setTrack] = useState<Track>(opening?.track ?? { day: null, ch: null });
  const trackRef = useRef(track);
  const firstSim = opening?.sim ?? null;
  const sim = useRef<Sim | null>(firstSim);
  const [hud, setHud] = useState({ score: firstSim?.score ?? 0, next: firstSim ? nextTier(firstSim) : 0, after: firstSim ? nextTier(firstSim, 1) : 0, biggest: firstSim?.biggest ?? 0, over: !!opening?.done });
  const hudRef = useRef(hud);
  const [paused, setPaused] = useState(!!opening?.resumed);
  const [result, setResult] = useState<Result | null>(opening?.done ?? null);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flashes = useRef<{ x: number; y: number; r: number; age: number }[]>([]);
  const keysHeld = useRef({ left: false, right: false });
  /** Whether this mount reported the round's start yet (a jar picked up again reports it once too). */
  const reportedStart = useRef(false);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // A challenge round that is over already but was never reported (its jar was lost, or it is a daily
  // played before): its score counts now, once.
  useEffect(() => {
    const done = opening?.done;
    const key = opening?.track.ch;
    const rec = key ? saveRef.current.challenges[key] : undefined;
    if (!done?.report || !key || !challenge || (rec && !rec.open)) return;
    update((c) => withRound(c, key, { score: done.score, biggest: done.biggest, merges: done.merges }));
    host.report({ type: 'end', score: done.score, stats: { biggest: done.biggest + 1, merges: done.merges }, challenge: { id: challenge.id, round: challenge.round } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Back to the menu, showing the day it is now (an open tab carries on past midnight). */
  const toMenu = useCallback(() => {
    setToday(dayKey());
    setScreen('menu');
  }, []);

  const setRound = (t: Track): void => {
    trackRef.current = t;
    setTrack(t);
  };

  const begin = (m: Mode): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (reload, Restart) is
    // fine, the jar carries on from where it was, but it can never be started over.
    const day = dayKey();
    setToday(day);
    const cur = readStored() ?? saveRef.current;
    const kept = m === 'daily' && cur.daily[day]?.open && cur.progress?.day === day ? simFrom(cur.progress.sim) : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[day]) {
        saveRef.current = cur;
        setSave(cur);
        return;
      }
      update((c) => ({ ...c, daily: { ...c.daily, [day]: { best: 0, tries: 1, biggest: 0, open: true } }, progress: { day, sim: newSim(dailySeed(day)) } }));
    }
    modeRef.current = m;
    setMode(m);
    setRound({ day: m === 'daily' ? day : null, ch: null });
    const s = kept ?? newSim(m === 'daily' ? dailySeed(day) : randomSeed());
    sim.current = s;
    flashes.current = [];
    reportedStart.current = false;
    setResult(null);
    // A jar picked up again waits for a tap, so nothing falls before the player is back.
    setPaused(!!kept);
    const fresh = { score: s.score, next: nextTier(s), after: nextTier(s, 1), biggest: s.biggest, over: false };
    hudRef.current = fresh;
    setHud(fresh);
    setScreen('play');
  };

  const finish = useCallback(
    (s: Sim) => {
      const t = trackRef.current;
      let newBest = false;
      let countsAsDaily = false;
      update((cur) => {
        newBest = s.score > cur.best;
        let next: Save = { ...cur, best: Math.max(cur.best, s.score), biggest: Math.max(cur.biggest, s.biggest), runs: cur.runs + 1 };
        const d = t.day ? cur.daily[t.day] : undefined;
        if (t.day && (!d || d.open)) {
          countsAsDaily = t.day === dayKey();
          next = { ...next, daily: { ...cur.daily, [t.day]: { best: s.score, tries: 1, biggest: s.biggest } }, progress: cur.progress?.day === t.day ? undefined : cur.progress };
        }
        if (t.ch) next = withRound(next, t.ch, { score: s.score, biggest: s.biggest, merges: s.merges });
        return next;
      });
      // A daily started before midnight finishes as that day's: it no longer counts as today's.
      const end = { type: 'end' as const, score: s.score, stats: { biggest: s.biggest + 1, merges: s.merges } };
      host.report({ ...end, ...(countsAsDaily ? { daily: true } : {}), ...(t.ch && challenge ? { challenge: { id: challenge.id, round: challenge.round } } : {}) });
      setResult({ score: s.score, biggest: s.biggest, merges: s.merges, newBest });
    },
    [update, host, challenge],
  );

  /** Saves the jar as it goes (a daily, a challenge round), so leaving (reload, Restart) carries on from here. */
  const keep = useCallback(
    (s: Sim) => {
      const t = trackRef.current;
      if ((!t.day && !t.ch) || s.over) return;
      update((cur) => {
        let next = cur;
        const d = t.day ? cur.daily[t.day] : undefined;
        // Finished in another tab meanwhile: leave it be.
        if (t.day && (!d || d.open)) {
          next = { ...next, daily: { ...cur.daily, [t.day]: { tries: 1, ...d, best: s.score, biggest: s.biggest, open: true } }, progress: { day: t.day, sim: copySim(s) } };
        }
        const r = t.ch ? cur.challenges[t.ch] : undefined;
        if (t.ch && (!r || r.open)) next = withRound(next, t.ch, { score: s.score, biggest: s.biggest, merges: s.merges, open: true, sim: copySim(s) });
        return next;
      });
    },
    [update],
  );

  // Another tab changed the save: show it, and leave a jar that was finished over there.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const cur = loadSave();
      saveRef.current = cur;
      setSave(cur);
      const t = trackRef.current;
      const s = sim.current;
      if (!s || s.over) return;
      const dailyDone = t.day && cur.daily[t.day] && !cur.daily[t.day]!.open;
      const roundDone = t.ch && cur.challenges[t.ch] && !cur.challenges[t.ch]!.open;
      if (dailyDone || roundDone) {
        sim.current = null;
        toMenu();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [toMenu]);

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
    let kept = sim.current?.t ?? 0;
    // Which quarter of the overflow clock last ticked, so each quarter ticks once.
    let ticked = 0;
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
        const quarter = Math.floor(s.danger * 4);
        if (quarter > ticked && !s.over) sfx().tick();
        ticked = quarter;
        for (const f of flashes.current) f.age += dt;
        flashes.current = flashes.current.filter((f) => f.age < 0.5);
        if (s.t - kept >= 2) {
          kept = s.t;
          keep(s);
        }
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
  }, [screen, paused, finish, sfx, keep]);

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'play' && !hud.over) setPaused(true);
  }

  // Leaving the tab pauses a jar in play (and drops held keys); the day is read again on the way back.
  useEffect(() => {
    const away = (): void => {
      keysHeld.current = { left: false, right: false };
      if (document.hidden && sim.current?.started && !sim.current.over) setPaused(true);
    };
    const back = (): void => {
      if (!document.hidden) setToday(dayKey());
    };
    document.addEventListener('visibilitychange', away);
    document.addEventListener('visibilitychange', back);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', away);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
    };
  }, []);

  const toggleMute = (): void => update((c) => ({ ...c, muted: !c.muted }));

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
    if (!reportedStart.current) {
      reportedStart.current = true;
      host.report({ type: 'start' });
    }
    if (drop(s)) {
      sfx().drop();
      keep(s);
    }
  }, [paused, host, sfx, keep]);

  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent): void => {
      // Once the jar is full, Enter and Space are left to the focused end-screen button.
      if (sim.current?.over || notForGame(e, root.current)) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysHeld.current.left = true;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysHeld.current.right = true;
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) release();
        return;
      } else if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        if (!e.repeat && sim.current?.started && !sim.current.over) setPaused((p) => !p);
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

  if (screen === 'menu') return <Menu save={save} today={today} onPlay={begin} onMute={toggleMute} />;

  const daily = track.day ? save.daily[track.day] : undefined;
  const day = track.day ?? today;
  return (
    <div className="gl" ref={root}>
      <div className="gl-hud" aria-live="polite">
        <span className="game-menu-pair">
          <button className="gl-icon" onClick={() => (hud.over ? toMenu() : setPaused((p) => !p))} aria-label={hud.over ? 'Menu' : 'Pause'}>
            {hud.over ? '☰' : 'II'}
          </button>
          <GameMenuButton className="gl-icon" />
        </span>
        <div className="gl-score">
          <b>{hud.score}</b>
          <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily jar #${dailyNumber(day)}` : `Best ${save.best}`}</span>
        </div>
        <div className="gl-next" aria-label={`Next: ${SIZE_NAMES[hud.next]}, then ${SIZE_NAMES[hud.after]}`}>
          <span>next</span>
          <BlobIcon tier={hud.after} size={38} r={6 + hud.after * 2.8} />
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
          {result.note && <p className="gl-muted">{result.note}</p>}
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
            {mode === 'daily' && daily && <ShareButton text={`Gloop #${dailyNumber(day)} 🫧\n${resultLine(daily.biggest)}\nScore: ${daily.best}\n${window.location.origin}/games/gloop`} />}
            <button className="gl-btn" onClick={toMenu}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A small still blob, for the HUD and menu (`r`: drawn smaller, so sizes read at a glance, not by color only). */
function BlobIcon({ tier, size, r, t = 0 }: { tier: number; size: number; r?: number; t?: number }) {
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
    drawBlob(ctx, tier, r ?? size / 2 - 3, t);
  }, [tier, size, r, t]);
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
  const going = daily?.open && save.progress?.day === today ? save.progress.sim : null;
  return (
    <div className="gl gl-menu">
      <div className="gl-menu-top">
        <button className="gl-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="gl-icon" />
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
          <span>{going ? `In progress · ${going.score} so far` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best}` : 'The same blobs for everyone · one try a day'}</span>
        </div>
        {going ? (
          <button className="gl-btn gl-btn-go gl-btn-big" onClick={() => onPlay('daily')}>
            Carry on with today’s jar
          </button>
        ) : daily ? (
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
