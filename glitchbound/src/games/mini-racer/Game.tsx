import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { CARS, getCar, raceCoins, specFor, statBars, unlockText, type CarDef } from './cars';
import { dailyTrack, todayKey } from './daily';
import { Engine, type UiKey } from './engine';
import { drawCarPreview, fmtTime, THEMES } from './render';
import { RACE_LAPS, type RaceSim, type Result } from './sim';
import { loadGhost, loadSave, saveGhost, writeSave, type Bests, type SaveData } from './storage';
import { buildTrack, medalTimes, type Surface, type Track, type TrackDef } from './track';
import { TRACKS } from './tracks';
import './Game.css';

type Screen = 'menu' | 'garage' | 'race' | 'paused' | 'result';
type Medal = 'gold' | 'silver' | 'bronze' | null;

interface Finish {
  result: Result;
  track: TrackDef;
  newRecord: boolean;
  medal: Medal;
  coins: number;
  newCars: CarDef[];
}

const MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

const SURFACE_LABEL: Record<Surface, string> = {
  asphalt: 'Tarmac',
  boost: 'Boost strips',
  dirt: 'Dirt',
  gravel: 'Gravel',
  ice: 'Ice',
  grass: 'Grass',
  sand: 'Sand',
  snow: 'Snow',
  mud: 'Mud',
};

/** Medal times for a 3-lap race: three gold laps plus a little for the standing start. */
function raceMedalTimes(par: number): { gold: number; silver: number; bronze: number } {
  return medalTimes(par * RACE_LAPS + 900);
}

function raceMedal(par: number, race: number | null | undefined): Medal {
  if (!race) return null;
  const m = raceMedalTimes(par);
  const ms = race * 1000;
  return ms <= m.gold ? 'gold' : ms <= m.silver ? 'silver' : ms <= m.bronze ? 'bronze' : null;
}

/** Gold medals on the handmade tracks (some cars unlock with these). */
function goldCount(save: SaveData): number {
  return TRACKS.filter((d) => raceMedal(d.par, save.bests[d.id]?.race) === 'gold').length;
}

/** Cars earned by medals that the player doesn't own yet. */
function medalUnlocks(save: SaveData): CarDef[] {
  const golds = goldCount(save);
  return CARS.filter((c) => c.unlock.type === 'golds' && golds >= c.unlock.count && !save.cars.includes(c.id));
}

function surfacesOf(def: TrackDef): Surface[] {
  const set = new Set<Surface>(['asphalt']);
  for (const z of def.zones ?? []) set.add(z.surface);
  if (def.shortcut) set.add(def.shortcut.surface);
  for (const p of def.patches ?? []) set.add(p.surface);
  set.add(def.offroad);
  return [...set];
}

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
  const defFor = useCallback((id: string) => allDefs.find((d) => d.id === id) ?? allDefs[1]!, [allDefs]);
  const selected = defFor(save.track);
  const car = getCar(save.car);

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
    const def = defFor(s.track);
    engine.releaseInput();
    engine.race(trackFor(def), specFor(getCar(s.car)), loadGhost(def.id), s.bests[def.id]?.lap ?? null);
    setFinish(null);
    go('race');
    host.report({ type: 'start' });
  }, [defFor, trackFor, go, host]);

  const toMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.attract(trackFor(defFor(saveRef.current.track)));
    go('menu');
  }, [defFor, trackFor, go]);

  const onFinish = useCallback(
    (sim: RaceSim) => {
      const result = sim.result();
      const def = sim.track.def;
      const s0 = saveRef.current;
      const prev: Bests = { ...(s0.bests[def.id] ?? {}) };
      const next: Bests = { ...prev };
      let newRecord = false;
      if (result.best !== null && (!prev.lap || result.best < prev.lap)) next.lap = result.best;
      if (result.raceTime !== null && (!prev.race || result.raceTime < prev.race)) {
        next.race = result.raceTime;
        newRecord = prev.race !== undefined;
      }
      const stored = loadGhost(def.id);
      if (sim.newGhost && (!stored || sim.newGhost.time < stored.time)) saveGhost(def.id, sim.newGhost);

      const isDaily = def.id === daily.id;
      const medal = raceMedal(def.par, result.raceTime);
      const firstDaily = isDaily && result.raceTime !== null && !s0.dailyPaid.includes(today);
      const coins = raceCoins({ validLaps: result.laps.filter((l) => l.valid).length, medal, newBest: newRecord, firstDaily });
      const before = medalUnlocks(s0);
      let after: SaveData = {
        ...s0,
        bests: { ...s0.bests, [def.id]: next },
        coins: s0.coins + coins,
        earned: s0.earned + coins,
        dailyPaid: firstDaily ? [...s0.dailyPaid, today].slice(-7) : s0.dailyPaid,
      };
      const newCars = medalUnlocks(after).filter((c) => !before.includes(c));
      if (newCars.length) after = { ...after, cars: [...after.cars, ...newCars.map((c) => c.id)] };
      update(() => after);

      const stats: Record<string, number> = { drift: result.drift, cleanLaps: result.cleanLaps };
      if (result.best !== null) stats.lapMs = Math.round(result.best * 1000);
      if (result.raceTime !== null) stats.raceMs = Math.round(result.raceTime * 1000);
      /**
       * The one place a round's end is reported. `isDaily` is true for rounds on today's generated
       * track; the arcade counts those as this game's own daily. `score` is the leaderboard value
       * (race points: higher is better, ~1000 per lap at gold pace, comparable across tracks).
       */
      const reportEnd = (isDailyRound: boolean): void => {
        host.report(isDailyRound ? { type: 'end', score: result.score, stats, daily: true } : { type: 'end', score: result.score, stats });
      };
      reportEnd(isDaily);
      setFinish({ result, track: def, newRecord, medal, coins, newCars });
      go('result');
    },
    [update, host, go, daily, today],
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
        else if (key === 'restart' && s !== 'menu' && s !== 'garage') handlers.current.startRace();
        else if (key === 'pause' && s === 'race') handlers.current.pause();
        else if (key === 'pause' && s === 'paused') handlers.current.resume();
        else if (key === 'pause' && (s === 'result' || s === 'garage')) handlers.current.toMenu();
      },
    });
    engineRef.current = engine;
    engine.touchMode = touch;
    engine.setMuted(saveRef.current.muted);
    engine.setCar(getCar(saveRef.current.car));
    handlers.current.toMenu();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // The engine is created once; touch mode and the car are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.touchMode = touch;
  }, [touch]);

  useEffect(() => {
    engineRef.current?.setCar(car);
  }, [car]);

  // The arcade's Restart button.
  const firstRestart = useRef(restartKey);
  useEffect(() => {
    if (restartKey !== firstRestart.current) handlers.current.startRace();
  }, [restartKey]);

  const selectTrack = (id: string): void => {
    update((s) => ({ ...s, track: id }));
    engineRef.current?.attract(trackFor(defFor(id)));
  };

  const buyOrSelect = (c: CarDef): void => {
    const s = saveRef.current;
    if (s.cars.includes(c.id)) {
      update((x) => ({ ...x, car: c.id }));
    } else if (c.unlock.type === 'coins' && s.coins >= c.unlock.price) {
      const price = c.unlock.price;
      update((x) => ({ ...x, coins: x.coins - price, cars: [...x.cars, c.id], car: c.id }));
    }
  };

  const bests = save.bests[selected.id] ?? {};
  const medals = raceMedalTimes(selected.par);

  return (
    <div
      ref={rootRef}
      className={`mr-root mr-theme-${selected.theme}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' && !touch) setTouch(true);
      }}
    >
      <canvas ref={canvasRef} className="mr-canvas" aria-label="Mini Racer track. Hold the left or right half to steer." />

      {screen === 'race' && (
        <button className="mr-pause" onClick={pause} aria-label="Pause">
          <span />
          <span />
        </button>
      )}

      {screen === 'menu' && (
        <div className="mr-sheet mr-menu">
          <div className="mr-menu-head">
            <h2 className="mr-logo">
              Mini <span>Racer</span>
            </h2>
            <div className="mr-head-right">
              <span className="mr-coins mono" aria-label={`${save.coins} coins`}>
                <i aria-hidden="true" />
                {save.coins}
              </span>
              <button
                className="mr-chip"
                onClick={() => {
                  const m = !save.muted;
                  update((s) => ({ ...s, muted: m }));
                  engineRef.current?.setMuted(m);
                }}
                aria-pressed={!save.muted}
                aria-label="Sound"
              >
                {save.muted ? 'Muted' : 'Sound'}
              </button>
            </div>
          </div>

          <div className="mr-tracks" role="radiogroup" aria-label="Track">
            {allDefs.map((def) => {
              const b = save.bests[def.id] ?? {};
              const m = raceMedal(def.par, b.race);
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
                  <span className="mr-track-best mono">{fmtTime(b.race ?? null)}</span>
                  {m && <span className={`mr-medal mr-medal-${m}`} title={`${MEDAL_LABEL[m]} medal`} />}
                </button>
              );
            })}
          </div>

          <p className="mr-blurb">{selected.blurb}</p>
          <div className="mr-surfaces">
            {surfacesOf(selected).map((s) => (
              <span key={s} className={`mr-surface mr-surface-${s}`}>
                {SURFACE_LABEL[s]}
              </span>
            ))}
          </div>

          <div className="mr-records mono">
            <div>
              <span className="mr-label">Your best race</span>
              <strong>{fmtTime(bests.race ?? null)}</strong>
            </div>
            <div>
              <span className="mr-label">Best lap</span>
              <strong>{fmtTime(bests.lap ?? null)}</strong>
            </div>
            <div className="mr-targets">
              <span>
                <span className="mr-medal mr-medal-gold" /> {fmtTime(medals.gold / 1000)}
              </span>
              <span>
                <span className="mr-medal mr-medal-silver" /> {fmtTime(medals.silver / 1000)}
              </span>
              <span>
                <span className="mr-medal mr-medal-bronze" /> {fmtTime(medals.bronze / 1000)}
              </span>
            </div>
          </div>

          <div className="mr-menu-foot">
            <button className="mr-carpick" onClick={() => go('garage')}>
              <CarThumb car={car} />
              <span>
                <strong>{car.name}</strong>
                <small>Garage</small>
              </span>
            </button>
            <button className="mr-go" onClick={startRace}>
              Race!
            </button>
          </div>
          <p className="mr-keys">
            {touch ? 'Hold the left or right side of the screen to steer. Gas is automatic.' : 'Left / Right or A / D to steer · gas is automatic · R restart · Esc pause'}
          </p>
        </div>
      )}

      {screen === 'garage' && <Garage save={save} onPick={buyOrSelect} onBack={() => go('menu')} golds={goldCount(save)} />}

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

      {screen === 'result' && finish && <ResultCard finish={finish} bests={save.bests[finish.track.id] ?? {}} onAgain={startRace} onMenu={toMenu} touch={touch} />}
    </div>
  );
}

function CarThumb({ car }: { car: CarDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawCarPreview(ref.current, car);
  }, [car]);
  return <canvas ref={ref} className="mr-thumb" aria-hidden="true" />;
}

function Garage({ save, onPick, onBack, golds }: { save: SaveData; onPick: (c: CarDef) => void; onBack: () => void; golds: number }) {
  return (
    <div className="mr-sheet mr-garage">
      <div className="mr-menu-head">
        <h2 className="mr-title">Garage</h2>
        <div className="mr-head-right">
          <span className="mr-coins mono" aria-label={`${save.coins} coins`}>
            <i aria-hidden="true" />
            {save.coins}
          </span>
          <button className="mr-btn" onClick={onBack}>
            Done
          </button>
        </div>
      </div>
      <p className="mr-note-soft">Earn coins every race, with extra for medals, records and today&rsquo;s track. Cars differ a little; none is faster everywhere.</p>
      <div className="mr-cars">
        {CARS.map((c) => {
          const owned = save.cars.includes(c.id);
          const on = save.car === c.id;
          const affordable = c.unlock.type === 'coins' && save.coins >= c.unlock.price;
          const progress = c.unlock.type === 'golds' ? ` (${Math.min(golds, c.unlock.count)}/${c.unlock.count})` : '';
          return (
            <div key={c.id} className={`mr-car${on ? ' is-on' : ''}${owned ? '' : ' is-locked'}`}>
              <CarThumb car={c} />
              <div className="mr-car-info">
                <strong>{c.name}</strong>
                <small>{c.tagline}</small>
                <div className="mr-bars">
                  {statBars(c).map((s) => (
                    <span key={s.label} title={`${s.label} ${s.value}/5`}>
                      <em>{s.label}</em>
                      <b style={{ '--v': s.value } as CSSProperties} />
                    </span>
                  ))}
                </div>
              </div>
              <button
                className={owned ? 'mr-btn' : 'mr-go mr-buy'}
                disabled={on || (!owned && !affordable)}
                onClick={() => onPick(c)}
                aria-label={owned ? (on ? `${c.name} selected` : `Drive ${c.name}`) : `Unlock ${c.name} for ${unlockText(c.unlock)}`}
              >
                {owned ? (on ? 'Driving' : 'Drive') : c.unlock.type === 'coins' ? `${c.unlock.price} coins` : `${unlockText(c.unlock)}${progress}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ finish, bests, onAgain, onMenu, touch }: { finish: Finish; bests: Bests; onAgain: () => void; onMenu: () => void; touch: boolean }) {
  const { result, track, medal, newRecord, coins, newCars } = finish;
  return (
    <div className="mr-sheet mr-result">
      <div className="mr-result-top">
        <span className="mr-kicker mono">{track.name} · 3 laps</span>
        {newRecord && <span className="mr-record">New record!</span>}
      </div>
      <div className="mr-headline">
        {medal && <span className={`mr-medal mr-medal-big mr-medal-${medal}`} aria-label={`${MEDAL_LABEL[medal]} medal`} />}
        <div>
          <span className="mr-label mono">Race time</span>
          <strong className="mono">{result.raceTime !== null ? fmtTime(result.raceTime) : 'Not counted'}</strong>
        </div>
      </div>
      {result.raceTime === null && <p className="mr-note">A lap missed a checkpoint, so the race time doesn&rsquo;t count. Stay on the road between the posts.</p>}
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
        <span>{result.score} race points</span>
        <span className="mr-coins">
          <i aria-hidden="true" />+{coins}
        </span>
      </div>
      <p className="mr-note-soft mono">
        Best {fmtTime(bests.race ?? null)} · lap {fmtTime(bests.lap ?? null)}
      </p>
      {newCars.length > 0 && <p className="mr-unlock">Unlocked: {newCars.map((c) => c.name).join(', ')}!</p>}
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
