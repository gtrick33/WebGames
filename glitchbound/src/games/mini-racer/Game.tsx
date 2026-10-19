import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import { CARS, getCar, raceCoins, specFor, statBars, unlockText, type CarDef } from './cars';
import { dailyTrack, RANDOM_ID, randomTrack, todayKey } from './daily';
import { Engine, type UiKey } from './engine';
import { drawCarPreview, fmtTime, THEMES } from './render';
import { AI_PRESETS, type RaceMode, type RaceSim, type Result } from './sim';
import { sectorTimes } from './sectors';
import { decodeReplay, encodeReplay } from './ghost';
import { clearGhost, loadGhost, loadSave, saveGhost, writeSave, type Bests, type SaveData } from './storage';
import { lapLine, raceMedal, raceMedalTimes, shareText, type Medal } from './medals';
import { buildTrack, TRACK_TYPES, type Surface, type Track, type TrackDef } from './track';
import { TRACKS } from './tracks';
import { NextDaily } from '../../components/NextDaily';
import './Game.css';
import { openChallengeScores } from '../../platform/challenge';
import { useAccount } from '../../platform/account';
import { claimCoins } from '../../platform/coins';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';

type Screen = 'menu' | 'garage' | 'race' | 'paused' | 'result';

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

const CHALLENGE_ID = 'challenge';

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
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
  const random = useMemo(() => randomTrack(save.randomSeed), [save.randomSeed]);
  const allDefs = useMemo(() => [daily, ...TRACKS, random], [daily, random]);
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
  // A friends' challenge: a Time Trial on a track from the challenge's seed, against the best ghost so far.
  const challengeDef = useMemo<TrackDef | null>(() => (challenge ? { ...dailyTrack(`challenge-${challenge.seed >>> 0}`), id: CHALLENGE_ID, blurb: 'A friends’ challenge track.' } : null), [challenge]);
  const rival = useMemo(() => {
    const r = challenge?.replays?.[0];
    const ghost = decodeReplay(r?.replay);
    return r && ghost ? { name: r.name, ghost } : null;
  }, [challenge]);
  const inChallenge = useRef(!!challenge);
  const [challengeShown, setChallengeShown] = useState(!!challenge);
  const selected = defFor(save.track);
  const car = getCar(save.car);

  const update = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  // Coins from GlitchBound (QA or an admin) land in the wallet when a signed-in player opens the game.
  const signedIn = useAccount().status === 'member';
  const [gift, setGift] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    void claimCoins('mini-racer').then(({ amount }) => {
      if (amount <= 0) return;
      update((s) => ({ ...s, coins: s.coins + amount }));
      setGift(amount);
    });
  }, [signedIn, update]);
  useEffect(() => {
    if (!gift) return;
    const id = window.setTimeout(() => setGift(0), 8000);
    return () => window.clearTimeout(id);
  }, [gift]);

  const go = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  /** Starts a race on the selected track. Today's daily track is one race a day: false when it is used up. */
  const startRace = useCallback((): boolean => {
    const engine = engineRef.current;
    if (!engine) return false;
    const s = saveRef.current;
    const chal = inChallenge.current && challengeDef;
    const def = chal ? challengeDef : defFor(s.track);
    if (!chal && def.id === daily.id) {
      if (s.dailyRaced.includes(today)) return false;
      update((cur) => ({ ...cur, dailyRaced: [...cur.dailyRaced, today].slice(-7) }));
    }
    engine.releaseInput();
    const b: Bests = chal ? {} : (s.bests[def.id] ?? {});
    engine.race(trackFor(def), specFor(getCar(s.car)), chal ? (rival?.ghost ?? null) : loadGhost(def.id), b.lap ?? null, {
      mode: chal ? 'trial' : s.mode,
      aiLevel: s.aiLevel,
      playerCar: s.car,
      bestSplits: b.splits ?? null,
    });
    setFinish(null);
    go('race');
    host.report({ type: 'start' });
    return true;
  }, [defFor, trackFor, go, host, challengeDef, rival, daily, today, update]);

  const toMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    inChallenge.current = false;
    setChallengeShown(false);
    engine.attract(trackFor(defFor(saveRef.current.track)));
    go('menu');
  }, [defFor, trackFor, go]);

  const onFinish = useCallback(
    (sim: RaceSim) => {
      const result = sim.result();
      const def = sim.track.def;
      const s0 = saveRef.current;
      if (def.id === CHALLENGE_ID && challenge) {
        // Challenge laps don't touch your bests, ghosts or coins; the best lap goes to the others as a ghost.
        const stats: Record<string, number> = { drift: result.drift, cleanLaps: result.cleanLaps };
        if (result.best !== null) stats.lapMs = Math.round(result.best * 1000);
        if (result.raceTime !== null) stats.raceMs = Math.round(result.raceTime * 1000);
        host.report({ type: 'end', score: result.score, stats, challenge: { id: challenge.id, round: challenge.round, replay: sim.newGhost ? encodeReplay(sim.newGhost) : undefined } });
        setFinish({ result, track: def, newRecord: false, medal: raceMedal(def.par, result.raceTime), coins: 0, newCars: [] });
        go('result');
        return;
      }
      const prev: Bests = { ...(s0.bests[def.id] ?? {}) };
      const next: Bests = { ...prev };
      let newRecord = false;
      if (result.best !== null && (!prev.lap || result.best < prev.lap)) next.lap = result.best;
      // The Time Trial sector reference: the best lap that has splits.
      const bs = result.bestSplits;
      if (bs && (!prev.splits || bs[bs.length - 1]! < prev.splits[prev.splits.length - 1]!)) next.splits = bs;
      if (result.position !== null && result.raceTime !== null && (!prev.position || result.position < prev.position)) next.position = result.position;
      if (result.position === 1 && result.raceTime !== null && result.aiLevel !== null && (prev.wonLevel === undefined || result.aiLevel > prev.wonLevel)) next.wonLevel = result.aiLevel;
      if (result.raceTime !== null && (!prev.race || result.raceTime < prev.race)) {
        next.race = result.raceTime;
        newRecord = prev.race !== undefined;
      }
      const stored = loadGhost(def.id);
      if (sim.newGhost && (!stored || sim.newGhost.time < stored.time)) saveGhost(def.id, sim.newGhost);

      const isDaily = def.id === daily.id;
      const medal = raceMedal(def.par, result.raceTime);
      const firstDaily = isDaily && result.raceTime !== null && !s0.dailyPaid.includes(today);
      const coins = raceCoins({ validLaps: result.laps.filter((l) => l.valid).length, medal, newBest: newRecord, firstDaily, position: result.raceTime !== null ? result.position : null });
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
      if (result.position !== null) stats.position = result.position;
      if (result.aiLevel !== null) stats.aiLevel = result.aiLevel;
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
    [update, host, go, daily, today, challenge],
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
        // A challenge is one race: Enter and R don't race it again from the result screen.
        if (s === 'result' && inChallenge.current && key !== 'pause') return;
        if (key === 'confirm' && (s === 'menu' || s === 'result')) handlers.current.startRace();
        else if (key === 'confirm' && s === 'paused') handlers.current.resume();
        else if (key === 'restart' && s !== 'menu' && s !== 'garage' && !handlers.current.startRace()) handlers.current.toMenu();
        else if (key === 'pause' && s === 'race') handlers.current.pause();
        else if (key === 'pause' && s === 'paused') handlers.current.resume();
        else if (key === 'pause' && (s === 'result' || s === 'garage')) handlers.current.toMenu();
      },
    });
    engineRef.current = engine;
    engine.touchMode = touch;
    engine.setMuted(saveRef.current.muted);
    engine.setCar(getCar(saveRef.current.car));
    if (inChallenge.current) handlers.current.startRace();
    else handlers.current.toMenu();
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
    if (restartKey !== firstRestart.current && !handlers.current.startRace()) handlers.current.toMenu();
  }, [restartKey]);

  // The arcade asks for a pause (left full screen with Escape, which the browser swallows, or
  // scrolled away). A race pauses exactly like P/Esc; on any other screen the music fades out.
  const firstPause = useRef(pauseKey);
  useEffect(() => {
    if (pauseKey === firstPause.current) return;
    firstPause.current = pauseKey;
    if (screenRef.current === 'race') handlers.current.pause();
    else engineRef.current?.quiet();
  }, [pauseKey]);

  /** Rolls a brand-new random track; its old bests and ghost go with the old track. */
  const rollRandom = (): void => {
    const seed = Math.floor(Math.random() * 2 ** 32);
    clearGhost(RANDOM_ID);
    built.current.delete(RANDOM_ID);
    update((s) => {
      const bests = { ...s.bests };
      delete bests[RANDOM_ID];
      return { ...s, randomSeed: seed, track: RANDOM_ID, bests };
    });
    engineRef.current?.attract(trackFor(randomTrack(seed)));
  };

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
              {gift > 0 && (
                <span className="mr-gift" role="status">
                  +{gift} from GlitchBound
                </span>
              )}
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
                  {isDaily && <span className="mr-badge">{save.dailyRaced.includes(today) ? 'Daily · done ✓' : `Daily · ${today.slice(5).replace('-', '/')}`}</span>}
                  {def.id === RANDOM_ID && <span className="mr-badge">Random</span>}
                  <span className={`mr-type mr-type-${def.type}`}>{TRACK_TYPES[def.type].name}</span>
                  <span className="mr-track-name">{def.name}</span>
                  <span className="mr-track-best mono">{fmtTime(b.race ?? null)}</span>
                  {m && <span className={`mr-medal mr-medal-${m}`} title={`${MEDAL_LABEL[m]} medal`} />}
                </button>
              );
            })}
          </div>

          <p className="mr-blurb">{selected.blurb}</p>
          {selected.id === RANDOM_ID && (
            <button className="mr-chip mr-roll" onClick={rollRandom}>
              🎲 Roll a new random track
            </button>
          )}
          <p className="mr-typehint">
            <span className={`mr-type mr-type-${selected.type}`}>{TRACK_TYPES[selected.type].name}</span> {TRACK_TYPES[selected.type].hint}
          </p>
          <div className="mr-surfaces">
            {surfacesOf(selected).map((s) => (
              <span key={s} className={`mr-surface mr-surface-${s}`}>
                {SURFACE_LABEL[s]}
              </span>
            ))}
          </div>

          <div className="mr-modes" role="radiogroup" aria-label="Mode">
            {(['trial', 'race'] as RaceMode[]).map((m) => (
              <button key={m} role="radio" aria-checked={save.mode === m} className={`mr-mode${save.mode === m ? ' is-on' : ''}`} onClick={() => update((s) => ({ ...s, mode: m }))}>
                <strong>{m === 'trial' ? 'Time Trial' : 'Race'}</strong>
                <span>{m === 'trial' ? 'You vs the clock and your ghost' : '3 AI rivals, start from the back'}</span>
              </button>
            ))}
          </div>
          {save.mode === 'race' && (
            <div className="mr-ai">
              <label className="mr-ai-row">
                <span className="mr-label mono">AI level</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={save.aiLevel}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    update((s) => ({ ...s, aiLevel: v }));
                  }}
                  aria-valuetext={`AI level ${save.aiLevel} of 100`}
                />
                <strong className="mono mr-ai-value">{save.aiLevel}</strong>
              </label>
              <div className="mr-diffs">
                {AI_PRESETS.map((p) => (
                  <button key={p.level} className={`mr-diff${save.aiLevel === p.level ? ' is-on' : ''}`} onClick={() => update((s) => ({ ...s, aiLevel: p.level }))}>
                    {p.name} {p.level}
                  </button>
                ))}
              </div>
              {(bests.position !== undefined || bests.wonLevel !== undefined) && (
                <span className="mr-note-soft mono">
                  {bests.position !== undefined && `Best finish P${bests.position}`}
                  {bests.wonLevel !== undefined && ` · won at AI ${bests.wonLevel}`}
                </span>
              )}
            </div>
          )}

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
            {selected.id === daily.id && save.dailyRaced.includes(today) ? (
              <p className="mr-daily-done">
                Today’s daily is raced · <NextDaily />
              </p>
            ) : (
              <button className="mr-go" onClick={startRace}>
                Race!
              </button>
            )}
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
            {(finish?.track.id ?? save.track) !== daily.id && (
              <button className="mr-btn" onClick={startRace}>
                Restart
              </button>
            )}
            <button className="mr-btn" onClick={toMenu}>
              Menu
            </button>
          </div>
        </div>
      )}

      {screen === 'race' && finish === null && challengeShown && (
        <p className="mr-chal">⚔️ Challenge{rival ? ` · racing ${rival.name}’s ghost` : ' · you set the pace'}</p>
      )}
      {screen === 'result' && finish && (
        <ResultCard finish={finish} bests={save.bests[finish.track.id] ?? {}} onAgain={startRace} onMenu={toMenu} touch={touch} challengeId={finish.track.id === CHALLENGE_ID ? challenge?.id : undefined} day={finish.track.id === daily.id ? today : undefined} />
      )}
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

function ResultCard({ finish, bests, onAgain, onMenu, touch, challengeId, day }: { finish: Finish; bests: Bests; onAgain: () => void; onMenu: () => void; touch: boolean; challengeId?: string; day?: string }) {
  const { result, track, medal, newRecord, coins, newCars } = finish;
  const [shareMsg, setShareMsg] = useState('');
  const share = async (): Promise<void> => {
    const text = shareText({ result, par: track.par, trackName: track.name, day, time: fmtTime, url: `${window.location.origin}/games/mini-racer` });
    const outcome = await shareOrCopy({ title: 'Mini Racer', text });
    setShareMsg(outcome === 'copied' ? 'Copied!' : outcome === 'failed' ? 'Could not copy' : '');
  };
  return (
    <div className="mr-sheet mr-result">
      <div className="mr-result-top">
        <span className="mr-kicker mono">
          {challengeId ? '⚔️ Challenge' : track.name} · {result.mode === 'race' ? `Race vs AI ${result.aiLevel}` : 'Time Trial'}
        </span>
        {newRecord && <span className="mr-record">New record!</span>}
      </div>
      <div className="mr-headline">
        {medal && <span className={`mr-medal mr-medal-big mr-medal-${medal}`} aria-label={`${MEDAL_LABEL[medal]} medal`} />}
        <div>
          <span className="mr-label mono">Race time</span>
          <strong className="mono">{result.raceTime !== null ? fmtTime(result.raceTime) : 'Not counted'}</strong>
        </div>
      </div>
      {result.laps.length > 0 && <ResultLine line={lapLine(track.par, result.laps)} label={`Lap medals: ${result.laps.map((l, i) => (l.valid ? `lap ${i + 1} ${fmtTime(l.time)}` : `lap ${i + 1} missed`)).join(', ')}`} />}
      {result.position !== null && (
        <ol className="mr-standings mono" aria-label="Finishing order">
          {result.standings.map((s, i) => (
            <li key={s.name} className={s.player ? 'is-me' : ''}>
              <span className="mr-pos">{ordinal(i + 1)}</span>
              <i style={{ background: s.look.body }} aria-hidden="true" />
              <span>{s.player ? 'You' : s.name}</span>
              <span>{s.time !== null ? fmtTime(s.time) : 'racing'}</span>
            </li>
          ))}
        </ol>
      )}
      {result.raceTime === null && <p className="mr-note">A lap missed a checkpoint, so the race time doesn&rsquo;t count. Stay on the road between the posts.</p>}
      <SectorSummary result={result} />
      {result.laps.length > 0 && result.splitLog.length === 0 && (
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
        <span>
          {result.score} race points{result.levelBonus > 0 ? ` (+${result.levelBonus} AI bonus)` : ''}
        </span>
        <span className="mr-coins">
          <i aria-hidden="true" />+{coins}
        </span>
      </div>
      <p className="mr-note-soft mono">
        Best {fmtTime(bests.race ?? null)} · lap {fmtTime(bests.lap ?? null)}
      </p>
      {newCars.length > 0 && <p className="mr-unlock">Unlocked: {newCars.map((c) => c.name).join(', ')}!</p>}
      <div className="mr-actions">
        {challengeId ? (
          <a className="mr-go" href={`/c/${challengeId}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="mr-go" onClick={day ? onMenu : onAgain} autoFocus>
            {day ? 'Other tracks' : `Again${touch ? '' : ' (R)'}`}
          </button>
        )}
        {!challengeId && result.laps.length > 0 && (
          <button className="mr-btn" onClick={() => void share()}>
            {shareMsg || 'Share'}
          </button>
        )}
        <button className="mr-btn" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** Sector times of each lap, coloured by the delta shown during the race (vs that lap's reference). */
function SectorSummary({ result }: { result: Result }) {
  if (result.splitLog.length === 0) return null;
  const best = result.splits.length ? result.splits.map(sectorTimes) : [];
  const bestPer = best.length ? best[0]!.map((_, i) => Math.min(...best.map((b) => b[i]!))) : [];
  return (
    <table className="mr-sectors mono" aria-label="Sector times">
      <thead>
        <tr>
          <th scope="col">{result.mode === 'trial' ? 'vs best' : 'vs prev lap'}</th>
          <th scope="col">S1</th>
          <th scope="col">S2</th>
          <th scope="col">S3</th>
          <th scope="col">Lap</th>
        </tr>
      </thead>
      <tbody>
        {result.laps.map((_, li) => li + 1).map((lap) => (
          <tr key={lap} className={result.laps[lap - 1]?.valid ? '' : 'is-bad'}>
            <th scope="row">Lap {lap}</th>
            {[0, 1, 2].map((s) => {
              const e = result.splitLog.find((x) => x.lap === lap && x.sector === s);
              if (!e) return <td key={s}>–</td>;
              const cls = e.delta === null ? '' : e.delta <= 0 ? 'is-green' : 'is-red';
              return (
                <td key={s} className={`${cls}${bestPer[s] !== undefined && Math.abs(e.sectorTime - bestPer[s]!) < 1e-6 ? ' is-best' : ''}`}>
                  {e.sectorTime.toFixed(2)}
                  {e.delta !== null && <small>{`${e.delta <= 0 ? '−' : '+'}${Math.abs(e.delta).toFixed(2)}`}</small>}
                </td>
              );
            })}
            <td className={result.laps[lap - 1]?.time === result.best ? 'is-best' : ''}>
              {fmtTime(result.laps[lap - 1]?.time ?? null)}
              <small>{result.laps[lap - 1]?.valid ? (result.laps[lap - 1]?.clean ? 'clean' : 'bumped') : 'missed'}</small>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
