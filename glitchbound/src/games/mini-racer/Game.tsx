import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { dailyTrack, todayKey } from './daily';
import { Engine, type TouchInput, type UiKey } from './engine';
import { fmtTime, PAINTS, THEMES } from './render';
import { MODES, RACE_LAPS, type Mode, type RaceSim, type Result } from './sim';
import { loadGhost, loadSave, saveGhost, writeSave, type Bests, type SaveData } from './storage';
import { buildTrack, medalTimes, type Track, type TrackDef } from './track';
import { TRACKS } from './tracks';
import './Game.css';

type Screen = 'menu' | 'race' | 'paused' | 'result';
type Medal = 'gold' | 'silver' | 'bronze' | null;

interface Finish {
  result: Result;
  track: TrackDef;
  newRecord: boolean;
  medal: Medal;
  prev: Bests;
}

const MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;
/** Drift Zone medal thresholds (points in 60 s). */
const DRIFT_MEDALS = { gold: 7000, silver: 4500, bronze: 2500 };

function lapMedal(par: number, lap: number | undefined): Medal {
  if (!lap) return null;
  const m = medalTimes(par);
  const ms = lap * 1000;
  return ms <= m.gold ? 'gold' : ms <= m.silver ? 'silver' : ms <= m.bronze ? 'bronze' : null;
}

/** A 3-lap race medal: three gold laps plus a little for the standing start. */
function raceMedal(par: number, race: number | undefined): Medal {
  if (!race) return null;
  return lapMedal(par * RACE_LAPS + 900, race);
}

function driftMedal(points: number | undefined): Medal {
  if (!points) return null;
  return points >= DRIFT_MEDALS.gold ? 'gold' : points >= DRIFT_MEDALS.silver ? 'silver' : points >= DRIFT_MEDALS.bronze ? 'bronze' : null;
}

function medalFor(mode: Mode, def: TrackDef, b: Bests): Medal {
  return mode === 'race' ? raceMedal(def.par, b.race) : mode === 'hotlap' ? lapMedal(def.par, b.lap) : driftMedal(b.drift);
}

const RANK = { gold: 3, silver: 2, bronze: 1 } as const;

/** Paint unlocks: the first three are free, the rest are earned. */
function unlocked(save: SaveData, daily: TrackDef): boolean[] {
  let best = 0;
  for (const def of TRACKS) {
    const b = save.bests[def.id] ?? {};
    for (const m of [lapMedal(def.par, b.lap), raceMedal(def.par, b.race), driftMedal(b.drift)]) if (m) best = Math.max(best, RANK[m]);
  }
  const dailyDone = save.bests[daily.id]?.lap !== undefined;
  return [true, true, true, best >= 2, best >= 3, dailyDone];
}
const UNLOCK_HINT = ['', '', '', 'Earn a silver medal', 'Earn a gold medal', "Set a lap on today's track"];

export default function Game({ host, restartKey }: GameModuleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const [finish, setFinish] = useState<Finish | null>(null);
  const [touch, setTouch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const today = useMemo(() => todayKey(), []);
  const daily = useMemo(() => dailyTrack(today), [today]);
  const allDefs = useMemo(() => [daily, ...TRACKS], [daily]);
  const built = useRef(new Map<string, Track>());
  const trackFor = useCallback((def: TrackDef): Track => {
    let t = built.current.get(def.id);
    if (!t) {
      t = buildTrack(def);
      built.current.set(def.id, t);
    }
    return t;
  }, []);
  const selected = allDefs.find((d) => d.id === save.track) ?? allDefs[1]!;
  const paints = unlocked(save, daily);
  const paintIdx = paints[save.paint] ? save.paint : 0;

  const update = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const go = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  const startRace = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = saveRef.current;
    const def = allDefs.find((d) => d.id === s.track) ?? allDefs[1]!;
    const best = s.bests[def.id]?.lap ?? null;
    engine.releaseInput();
    engine.race(trackFor(def), s.mode, s.mode === 'drift' ? null : loadGhost(def.id), best);
    setFinish(null);
    go('race');
    host.report({ type: 'start' });
  }, [allDefs, trackFor, go, host]);

  const toMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = saveRef.current;
    engine.attract(trackFor(allDefs.find((d) => d.id === s.track) ?? allDefs[1]!));
    go('menu');
  }, [allDefs, trackFor, go]);

  const onFinish = useCallback(
    (sim: RaceSim) => {
      const result = sim.result();
      const def = sim.track.def;
      const prev: Bests = { ...(saveRef.current.bests[def.id] ?? {}) };
      const next: Bests = { ...prev };
      let newRecord = false;
      if (result.best !== null && (!prev.lap || result.best < prev.lap)) {
        next.lap = result.best;
        newRecord = newRecord || sim.mode === 'hotlap' || prev.lap !== undefined;
      }
      if (result.raceTime !== null && (!prev.race || result.raceTime < prev.race)) {
        next.race = result.raceTime;
        newRecord = newRecord || sim.mode === 'race';
      }
      if (sim.mode === 'drift' && result.drift > 0 && (!prev.drift || result.drift > prev.drift)) {
        next.drift = result.drift;
        newRecord = true;
      }
      const stored = loadGhost(def.id);
      if (sim.newGhost && (!stored || sim.newGhost.time < stored.time)) saveGhost(def.id, sim.newGhost);
      update((s) => ({ ...s, bests: { ...s.bests, [def.id]: next } }));
      const stats: Record<string, number> = { drift: result.drift, cleanLaps: result.cleanLaps };
      if (result.best !== null) stats.lapMs = Math.round(result.best * 1000);
      if (result.raceTime !== null) stats.raceMs = Math.round(result.raceTime * 1000);
      /**
       * The one place a round's end is reported. `isDaily` is true for rounds on today's generated
       * track: the arcade's own-daily flag (`daily: true` on the end event) belongs here once the
       * platform contract has it.
       */
      const reportEnd = (isDaily: boolean): void => {
        void isDaily; // becomes `daily: isDaily` on the event below
        host.report({ type: 'end', score: result.score, stats });
      };
      reportEnd(def.id === daily.id);
      const medal = sim.mode === 'race' ? raceMedal(def.par, result.raceTime ?? undefined) : sim.mode === 'hotlap' ? lapMedal(def.par, result.best ?? undefined) : driftMedal(result.drift);
      setFinish({ result, track: def, newRecord: newRecord && (prev.lap !== undefined || prev.race !== undefined || prev.drift !== undefined), medal, prev });
      go('result');
    },
    [update, host, go, daily],
  );

  const pause = useCallback(() => {
    engineRef.current?.pause();
    engineRef.current?.releaseInput();
    go('paused');
  }, [go]);

  const resume = useCallback(() => {
    engineRef.current?.resume();
    go('race');
  }, [go]);

  const handlers = useRef({ startRace, toMenu, onFinish, pause, resume });
  useEffect(() => {
    handlers.current = { startRace, toMenu, onFinish, pause, resume };
  });

  // Engine lifetime = component lifetime. Everything is released on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const engine = new Engine(canvas, root, {
      onFinish: (sim) => handlers.current.onFinish(sim),
      onAutoPause: () => {
        if (screenRef.current === 'race') {
          engine.releaseInput();
          screenRef.current = 'paused';
          setScreen('paused');
        }
      },
      onUiKey: (key: UiKey) => {
        const s = screenRef.current;
        if (key === 'confirm' && (s === 'menu' || s === 'result')) handlers.current.startRace();
        else if (key === 'confirm' && s === 'paused') handlers.current.resume();
        else if (key === 'restart' && s !== 'menu') handlers.current.startRace();
        else if (key === 'pause' && s === 'race') handlers.current.pause();
        else if (key === 'pause' && s === 'paused') handlers.current.resume();
        else if (key === 'pause' && s === 'result') handlers.current.toMenu();
      },
    });
    engineRef.current = engine;
    engine.touchMode = touch;
    engine.setMuted(saveRef.current.muted);
    handlers.current.toMenu();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // The engine is created once; touch mode is synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.touchMode = touch;
  }, [touch]);

  useEffect(() => {
    engineRef.current?.setPaint(PAINTS[paintIdx]!.body);
  }, [paintIdx]);

  // The arcade's Restart button.
  const firstRestart = useRef(restartKey);
  useEffect(() => {
    if (restartKey !== firstRestart.current) handlers.current.startRace();
  }, [restartKey]);

  const selectTrack = (id: string): void => {
    update((s) => ({ ...s, track: id }));
    const def = allDefs.find((d) => d.id === id);
    if (def) engineRef.current?.attract(trackFor(def));
  };

  const setTouchKey = (key: keyof TouchInput, on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    const engine = engineRef.current;
    if (!engine) return;
    if (on) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    engine.touch[key] = on;
  };
  const touchProps = (key: keyof TouchInput) => ({
    onPointerDown: setTouchKey(key, true),
    onPointerUp: setTouchKey(key, false),
    onPointerCancel: setTouchKey(key, false),
    onLostPointerCapture: setTouchKey(key, false),
    onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
  });

  const bests = save.bests[selected.id] ?? {};
  const medals = medalTimes(selected.par);

  return (
    <div
      ref={rootRef}
      className={`mr-root mr-theme-${selected.theme}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' && !touch) setTouch(true);
      }}
    >
      <canvas ref={canvasRef} className="mr-canvas" aria-label="Mini Racer track" />

      {screen === 'race' && (
        <button className="mr-pause" onClick={pause} aria-label="Pause">
          <span />
          <span />
        </button>
      )}

      {screen === 'race' && touch && (
        <div className="mr-touch" aria-hidden="true">
          <div className="mr-touch-steer">
            <button className="mr-tbtn" {...touchProps('left')}>
              <svg viewBox="0 0 24 24" width="30" height="30"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="mr-tbtn" {...touchProps('right')}>
              <svg viewBox="0 0 24 24" width="30" height="30"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div className="mr-touch-act">
            <button className="mr-tbtn mr-tbtn-brake" {...touchProps('brake')}>
              BRAKE
            </button>
            <button className="mr-tbtn mr-tbtn-drift" {...touchProps('drift')}>
              DRIFT
            </button>
          </div>
        </div>
      )}

      {screen === 'menu' && (
        <div className="mr-sheet mr-menu">
          <div className="mr-menu-head">
            <h2 className="mr-logo">
              Mini <span>Racer</span>
            </h2>
            <button
              className="mr-chip"
              onClick={() => {
                const m = !save.muted;
                update((s) => ({ ...s, muted: m }));
                engineRef.current?.setMuted(m);
              }}
              aria-pressed={!save.muted}
            >
              {save.muted ? 'Sound off' : 'Sound on'}
            </button>
          </div>

          <div className="mr-tracks" role="radiogroup" aria-label="Track">
            {allDefs.map((def) => {
              const b = save.bests[def.id] ?? {};
              const m = medalFor(save.mode, def, b);
              const isDaily = def.id === daily.id;
              return (
                <button
                  key={def.id}
                  role="radio"
                  aria-checked={def.id === selected.id}
                  className={`mr-track${def.id === selected.id ? ' is-on' : ''}`}
                  style={{ '--tc': THEMES[def.theme].road, '--tg': THEMES[def.theme].ground } as CSSProperties}
                  onClick={() => selectTrack(def.id)}
                >
                  {isDaily && <span className="mr-badge">Daily · {today.slice(5).replace('-', '/')}</span>}
                  <span className="mr-track-name">{def.name}</span>
                  <span className="mr-track-best mono">
                    {save.mode === 'drift' ? (b.drift ? `${b.drift} pts` : 'No score yet') : fmtTime((save.mode === 'race' ? b.race : b.lap) ?? null)}
                  </span>
                  {m && <span className={`mr-medal mr-medal-${m}`} title={`${MEDAL_LABEL[m]} medal`} />}
                </button>
              );
            })}
          </div>

          <p className="mr-blurb">{selected.blurb}</p>

          <div className="mr-modes" role="radiogroup" aria-label="Mode">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button key={m} role="radio" aria-checked={save.mode === m} className={`mr-mode${save.mode === m ? ' is-on' : ''}`} onClick={() => update((s) => ({ ...s, mode: m }))}>
                <strong>{MODES[m].name}</strong>
                <span>{MODES[m].short}</span>
              </button>
            ))}
          </div>

          <div className="mr-targets mono">
            {save.mode === 'drift' ? (
              <>
                <span className="mr-medal mr-medal-gold" /> {DRIFT_MEDALS.gold}
                <span className="mr-medal mr-medal-silver" /> {DRIFT_MEDALS.silver}
                <span className="mr-medal mr-medal-bronze" /> {DRIFT_MEDALS.bronze}
              </>
            ) : (
              <>
                <span className="mr-medal mr-medal-gold" /> {fmtTime((save.mode === 'race' ? medals.gold * RACE_LAPS + 900 : medals.gold) / 1000)}
                <span className="mr-medal mr-medal-silver" /> {fmtTime((save.mode === 'race' ? (medals.gold * RACE_LAPS + 900) * 1.1 : medals.silver) / 1000)}
                <span className="mr-medal mr-medal-bronze" /> {fmtTime((save.mode === 'race' ? (medals.gold * RACE_LAPS + 900) * 1.25 : medals.bronze) / 1000)}
              </>
            )}
            {bests.lap !== undefined && save.mode !== 'drift' && <span className="mr-ghost-note">Ghost ready</span>}
          </div>

          <div className="mr-menu-foot">
            <div className="mr-paints" role="radiogroup" aria-label="Car paint">
              {PAINTS.map((p, i) => (
                <button
                  key={p.name}
                  role="radio"
                  aria-checked={i === paintIdx}
                  aria-label={paints[i] ? p.name : `${p.name} (locked: ${UNLOCK_HINT[i]})`}
                  title={paints[i] ? p.name : `Locked: ${UNLOCK_HINT[i]}`}
                  disabled={!paints[i]}
                  className={`mr-paint${i === paintIdx ? ' is-on' : ''}${paints[i] ? '' : ' is-locked'}`}
                  style={{ background: p.body }}
                  onClick={() => update((s) => ({ ...s, paint: i }))}
                />
              ))}
            </div>
            <button className="mr-go" onClick={startRace}>
              Race!
            </button>
          </div>
          <p className="mr-keys">
            {touch ? 'Gas is automatic. Hold DRIFT through bends for a turbo.' : 'Arrows / WASD to drive · Space to drift · R restart · Esc pause'}
          </p>
        </div>
      )}

      {screen === 'paused' && (
        <div className="mr-sheet mr-small">
          <h2 className="mr-title">Paused</h2>
          <div className="mr-actions">
            <button className="mr-go" onClick={resume} autoFocus>
              Resume
            </button>
            <button className="mr-btn" onClick={startRace}>
              Restart
            </button>
            <button className="mr-btn" onClick={toMenu}>
              Menu
            </button>
          </div>
        </div>
      )}

      {screen === 'result' && finish && <ResultCard finish={finish} onAgain={startRace} onMenu={toMenu} touch={touch} />}
    </div>
  );
}

function ResultCard({ finish, onAgain, onMenu, touch }: { finish: Finish; onAgain: () => void; onMenu: () => void; touch: boolean }) {
  const { result, track, medal, newRecord } = finish;
  const mode = result.mode;
  const headline =
    mode === 'race' ? (result.raceTime !== null ? fmtTime(result.raceTime) : 'Not counted') : mode === 'hotlap' ? fmtTime(result.best) : `${result.drift} pts`;
  const label = mode === 'race' ? 'Race time' : mode === 'hotlap' ? 'Best lap' : 'Drift score';
  return (
    <div className="mr-sheet mr-result">
      <div className="mr-result-top">
        <span className="mr-kicker mono">
          {track.name} · {MODES[mode].name}
        </span>
        {newRecord && <span className="mr-record">New record!</span>}
      </div>
      <div className="mr-headline">
        {medal && <span className={`mr-medal mr-medal-big mr-medal-${medal}`} aria-label={`${MEDAL_LABEL[medal]} medal`} />}
        <div>
          <span className="mr-label mono">{label}</span>
          <strong className="mono">{headline}</strong>
        </div>
      </div>
      {mode === 'race' && result.raceTime === null && <p className="mr-note">A lap missed a checkpoint, so the race time doesn&rsquo;t count. Stay on the road between the posts.</p>}
      {result.laps.length > 0 && (
        <ol className="mr-laps mono">
          {result.laps.map((l, i) => (
            <li key={i} className={l.time === result.best && l.valid ? 'is-best' : l.valid ? '' : 'is-bad'}>
              <span>Lap {i + 1}</span>
              <span>{fmtTime(l.time)}</span>
              <span>{l.valid ? (l.clean ? 'clean' : 'bumped') : 'missed'}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mr-score mono">
        <span>Score {result.score}</span>
        <span>Drift {result.drift}</span>
      </div>
      <div className="mr-actions">
        <button className="mr-go" onClick={onAgain} autoFocus>
          Again{touch ? '' : ' (R)'}
        </button>
        <button className="mr-btn" onClick={onMenu}>
          Tracks
        </button>
      </div>
    </div>
  );
}
