import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameModuleProps } from '../../platform/contract';
import type { ChallengeSpec } from '../../platform/challenge';
import { CARS, getCar, raceCoins, specFor, statBars, unlockText, type CarDef } from './cars';
import { dailyTrack, RANDOM_ID, randomTrack, todayKey } from './daily';
import { Engine, type UiKey } from './engine';
import { drawCarPreview, fmtTime, THEMES } from './render';
import { AI_PRESETS, COUNTDOWN, type RaceMode, type RaceSim, type Result } from './sim';
import { sectorTimes } from './sectors';
import { decodeReplay, encodeReplay } from './ghost';
import { clearGhost, countDay, DAILY_RACES, KEEP_DAILY, loadGhost, parseSave, pruneDailyBests, putResult, putRun, SAVE_KEY, savedText, saveGhost, writeSave, type Bests, type ChallengeRun, type SaveData } from './storage';
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
import { GameMenuButton } from '../../components/GameMenuButton';

/** 'finished': over the line, recorded, the car rolling to a stop before the result card. 'done': a challenge round already over when the game opened. */
type Screen = 'menu' | 'garage' | 'race' | 'paused' | 'finished' | 'result' | 'done';

interface Finish {
  result: Result;
  track: TrackDef;
  newRecord: boolean;
  medal: Medal;
  coins: number;
  newCars: CarDef[];
  /** The day whose daily race this was, if it was one. */
  day: string | null;
}

/** The race under way: a free race, one of a day's daily races, or a challenge round (`day`: the daily it also is). */
interface RaceKind {
  kind: 'free' | 'daily' | 'challenge';
  day: string | null;
}
const FREE: RaceKind = { kind: 'free', day: null };

const MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

const SURFACE_LABEL: Record<Surface, string> = {
  asphalt: 'Asphalt',
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
const DAILY_PREFIX = 'daily-';
/** The day of a daily track id ("daily-2026-11-02"), or null. */
const dayOfTrack = (id: string): string | null => (id.startsWith(DAILY_PREFIX) ? id.slice(DAILY_PREFIX.length) : null);
/** Where a challenge round is kept in the save. */
const runKey = (c: ChallengeSpec): string => `${c.id}:${c.round}`;
/** A "Today's daily" challenge races the game's daily track of its day; other challenges a track from their seed. */
const challengeDayOf = (c: ChallengeSpec | undefined): string | null => (c && c.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : null);
const formatCoins = (n: number): string => n.toLocaleString('en-US');

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [initial] = useState(() => {
    const text = savedText();
    return { text, save: parseSave(text) };
  });
  const [save, setSave] = useState<SaveData>(initial.save);
  const saveRef = useRef(save);
  /** The stored save as this tab last read or wrote it: a different one was written by another tab. */
  const savedRef = useRef(initial.text);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const [finish, setFinish] = useState<Finish | null>(null);
  /** The pause menu is asking whether to leave a counted race (today's daily, a challenge round; see leave). */
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [touch, setTouch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  // The day moves on at midnight: it is read again while the menu shows, when the tab comes back and at every start.
  const [today, setToday] = useState(todayKey);
  /** Today's daily races not yet started. */
  const racesLeft = Math.max(0, DAILY_RACES - countDay(save.dailyRaced, today));
  // Generated tracks come from this device's cache after their first generation (see dailyTrack).
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
  // An older day's daily track in the save stands for today's.
  const defFor = useCallback((id: string) => (dayOfTrack(id) !== null ? daily : (allDefs.find((d) => d.id === id) ?? allDefs[1]!)), [allDefs, daily]);
  const challengeDay = challengeDayOf(challenge);
  // A friends' challenge: a Time Trial against the best ghost so far, on that day's daily track ("Today's daily") or a track from the seed.
  const challengeDef = useMemo<TrackDef | null>(() => (challenge ? { ...dailyTrack(challengeDay ?? `challenge-${challenge.seed >>> 0}`), id: CHALLENGE_ID, blurb: 'A friends’ challenge track.' } : null), [challenge, challengeDay]);
  const rival = useMemo(() => {
    const r = challenge?.replays?.[0];
    const ghost = decodeReplay(r?.replay);
    return r && ghost ? { name: r.name, ghost } : null;
  }, [challenge]);
  const inChallenge = useRef(!!challenge);
  /** The challenge chip shows through the countdown and the first seconds (it would cover the road later). */
  const [challengeShown, setChallengeShown] = useState(false);
  /** The race under way, for its exits and its end. */
  const raceRef = useRef<RaceKind>(FREE);
  const [race, setRace] = useState<RaceKind>(FREE);
  /** The challenge round this mount started (React's dev double mount must not take it for a reload). */
  const startedHere = useRef<string | null>(null);
  /** A challenge round that was already over when the game opened. */
  const [doneRun, setDoneRun] = useState<ChallengeRun | null>(null);
  /** The menu's track details are unfolded (they fold away on short screens only). */
  const [info, setInfo] = useState(false);
  const selected = defFor(save.track);
  const car = getCar(save.car);

  /** The latest save: picks up what another tab (or a cloud sync) stored meanwhile. */
  const fresh = useCallback((): SaveData => {
    const text = savedText();
    if (text !== null && text !== savedRef.current) {
      savedRef.current = text;
      saveRef.current = parseSave(text);
      setSave(saveRef.current);
    }
    return saveRef.current;
  }, []);

  /** Read-modify-write: a change applies to the latest stored save, so another tab's coins, cars and bests stay. */
  const update = useCallback(
    (fn: (s: SaveData) => SaveData) => {
      const next = fn(fresh());
      saveRef.current = next;
      setSave(next);
      const text = writeSave(next);
      if (text !== null) savedRef.current = text;
    },
    [fresh],
  );

  // Another tab saved: show its coins, cars and bests. Back in the tab: the day may have changed.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === null || e.key === SAVE_KEY) fresh();
    };
    const onBack = (): void => {
      if (!document.hidden) setToday(todayKey());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [fresh]);
  // While the menu shows, the daily card follows the clock past midnight.
  useEffect(() => {
    if (screen !== 'menu') return;
    const id = window.setInterval(() => setToday(todayKey()), 1000);
    return () => window.clearInterval(id);
  }, [screen]);

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
  useEffect(() => {
    if (!challengeShown) return;
    const id = window.setTimeout(() => setChallengeShown(false), (COUNTDOWN + 3) * 1000);
    return () => window.clearTimeout(id);
  }, [challengeShown]);

  const go = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
    setConfirmLeave(false);
  }, []);

  const setRaceKind = useCallback((r: RaceKind) => {
    raceRef.current = r;
    setRace(r);
  }, []);

  /**
   * Starts a race on the selected track, or the challenge round. Today's daily track is three races a
   * day and a challenge round has one attempt: false when there is none left.
   */
  const startRace = useCallback((): boolean => {
    const engine = engineRef.current;
    if (!engine) return false;
    const s = fresh();
    const day = todayKey();
    setToday(day);
    const chal = inChallenge.current && challengeDef ? (challenge ?? null) : null;
    let kind = FREE;
    let def: TrackDef;
    if (chal && challengeDef) {
      def = challengeDef;
      const key = runKey(chal);
      const mine = s.challengeRuns.find((r) => r.key === key);
      // One attempt: a round that ended (or was started before a reload) is never raced again.
      if (mine && (mine.ended || startedHere.current !== key)) return false;
      // "Today's daily" on its day is also one of the day's daily races, while there are any left.
      const takesDaily = mine ? (mine.daily ?? null) : challengeDay === day && countDay(s.dailyRaced, day) < DAILY_RACES ? day : null;
      if (!mine) {
        update((cur) => {
          const x = putRun(cur, { key, score: 0, race: null, lap: null, ...(takesDaily ? { daily: takesDaily } : {}) });
          return takesDaily ? { ...x, dailyRaced: [...x.dailyRaced, takesDaily].slice(-KEEP_DAILY) } : x;
        });
      }
      startedHere.current = key;
      kind = { kind: 'challenge', day: takesDaily };
    } else if (dayOfTrack(s.track) !== null) {
      def = dailyTrack(day);
      if (countDay(s.dailyRaced, day) >= DAILY_RACES) return false;
      update((cur) => ({ ...cur, dailyRaced: [...cur.dailyRaced, day].slice(-KEEP_DAILY) }));
      kind = { kind: 'daily', day };
    } else def = defFor(s.track);
    engine.releaseInput();
    const b: Bests = chal ? {} : (s.bests[def.id] ?? {});
    engine.race(trackFor(def), specFor(getCar(s.car)), chal ? (rival?.ghost ?? null) : loadGhost(def.id), b.lap ?? null, {
      mode: chal ? 'trial' : s.mode,
      aiLevel: s.aiLevel,
      playerCar: s.car,
      bestSplits: b.splits ?? null,
    });
    setRaceKind(kind);
    setFinish(null);
    setChallengeShown(!!chal);
    go('race');
    host.report({ type: 'start' });
    return true;
  }, [defFor, trackFor, go, host, challenge, challengeDef, challengeDay, rival, update, fresh, setRaceKind]);

  const toMenu = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    inChallenge.current = false;
    setChallengeShown(false);
    setDoneRun(null);
    setRaceKind(FREE);
    const day = todayKey();
    setToday(day);
    const id = saveRef.current.track;
    engine.attract(trackFor(dayOfTrack(id) !== null ? dailyTrack(day) : defFor(id)));
    go('menu');
  }, [defFor, trackFor, go, setRaceKind]);

  /** The car is over the line: everything is recorded now; the result card follows a moment later (onResult). */
  const onFinish = useCallback(
    (sim: RaceSim) => {
      const result = sim.result();
      const def = sim.track.def;
      const chal = def.id === CHALLENGE_ID && challenge ? challenge : null;
      // The daily this race was, on its own day (a race started before midnight finishes as yesterday's).
      const day = chal ? raceRef.current.day : dayOfTrack(def.id);
      // Bests, ghost and coins go to the race's own track, or to the daily a challenge round also was.
      // Other challenge laps don't touch them; the best lap goes to the others as a ghost.
      const recordId = chal ? (day ? `${DAILY_PREFIX}${day}` : null) : def.id;
      const medal = raceMedal(def.par, result.raceTime);
      let newRecord = false;
      let coins = 0;
      let newCars: CarDef[] = [];
      if (recordId) {
        const stored = loadGhost(recordId);
        if (sim.newGhost && (!stored || sim.newGhost.time < stored.time)) saveGhost(recordId, sim.newGhost);
      }
      update((s0) => {
        let after = s0;
        if (recordId) {
          const prev: Bests = { ...(s0.bests[recordId] ?? {}) };
          const next: Bests = { ...prev };
          if (result.best !== null && (!prev.lap || result.best < prev.lap)) next.lap = result.best;
          // The Time Trial sector reference: the best lap that has splits.
          const bs = result.bestSplits;
          if (bs && (!prev.splits || bs[bs.length - 1]! < prev.splits[prev.splits.length - 1]!)) next.splits = bs;
          if (result.position !== null && (!prev.position || result.position < prev.position)) next.position = result.position;
          if (result.position === 1 && result.aiLevel !== null && (prev.wonLevel === undefined || result.aiLevel > prev.wonLevel)) next.wonLevel = result.aiLevel;
          if (result.raceTime !== null && (!prev.race || result.raceTime < prev.race)) {
            next.race = result.raceTime;
            newRecord = prev.race !== undefined;
          }
          const firstDaily = !!day && result.raceTime !== null && !s0.dailyPaid.includes(day);
          coins = raceCoins({ validLaps: result.laps.filter((l) => l.valid).length, medal, newBest: newRecord, firstDaily, position: result.position });
          const before = medalUnlocks(s0);
          const bests = { ...s0.bests, [recordId]: next };
          after = {
            ...s0,
            // Past days' daily tracks never come back: their bests go.
            bests: day ? pruneDailyBests(bests, [day, todayKey()]) : bests,
            coins: s0.coins + coins,
            earned: s0.earned + coins,
            dailyPaid: firstDaily && day ? [...s0.dailyPaid, day].slice(-7) : s0.dailyPaid,
            dailyEnded: day && countDay(s0.dailyEnded, day) < countDay(s0.dailyRaced, day) ? [...s0.dailyEnded, day].slice(-KEEP_DAILY) : s0.dailyEnded,
          };
          if (day) after = putResult(after, { day, score: result.score, race: result.raceTime, lap: result.best, finished: true });
          newCars = medalUnlocks(after).filter((c) => !before.includes(c));
          if (newCars.length) after = { ...after, cars: [...after.cars, ...newCars.map((c) => c.id)] };
        }
        if (chal) after = putRun(after, { key: runKey(chal), ended: 'finished', score: result.score, race: result.raceTime, lap: result.best, ...(day ? { daily: day } : {}) });
        return after;
      });

      const stats: Record<string, number> = { drift: result.drift, cleanLaps: result.cleanLaps };
      if (result.best !== null) stats.lapMs = Math.round(result.best * 1000);
      if (result.raceTime !== null) stats.raceMs = Math.round(result.raceTime * 1000);
      if (result.position !== null) stats.position = result.position;
      if (result.aiLevel !== null) stats.aiLevel = result.aiLevel;
      /**
       * The one place a finished round's end is reported. `daily` marks a race on today's generated
       * track, finished on its day: the arcade counts those as this game's own daily. `score` is the
       * leaderboard value (race points: higher is better, ~1000 per lap at gold pace, comparable across tracks).
       */
      const countsToday = !!day && day === todayKey();
      host.report({
        type: 'end',
        score: result.score,
        stats,
        ...(countsToday ? { daily: true } : {}),
        ...(chal ? { challenge: { id: chal.id, round: chal.round, replay: sim.newGhost ? encodeReplay(sim.newGhost) : undefined } } : {}),
      });
      setFinish({ result, track: def, newRecord, medal, coins, newCars, day });
      setChallengeShown(false);
      go('finished');
    },
    [update, host, go, challenge],
  );

  /** The finished race's result card, after FINISH! (any key but R shows it at once). */
  const onResult = useCallback(() => {
    if (screenRef.current === 'finished') go('result');
  }, [go]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    engineRef.current?.releaseInput();
    go('paused');
  }, [go]);

  const resume = useCallback(() => {
    engineRef.current?.resume();
    go('race');
  }, [go]);

  /**
   * A daily race that is left (or was left before a reload) can't be resumed. It still ends, once, with
   * whatever was driven so far (nothing after a reload), so the day counts for the arcade streak; the
   * menu then says it was left unfinished. A race slot held by a challenge round still open is that round's to end.
   */
  const settleDaily = useCallback(
    (day: string, sim: RaceSim | null) => {
      const s0 = fresh();
      const held = s0.challengeRuns.filter((r) => !r.ended && r.daily === day).length;
      if (countDay(s0.dailyEnded, day) + held >= countDay(s0.dailyRaced, day)) return;
      const r = sim && dayOfTrack(sim.track.def.id) === day ? sim.result() : null;
      const score = r?.score ?? 0;
      host.report({ type: 'end', score, stats: r ? { drift: r.drift, cleanLaps: r.cleanLaps } : {}, ...(day === todayKey() ? { daily: true } : {}) });
      update((cur) => putResult({ ...cur, dailyEnded: [...cur.dailyEnded, day].slice(-KEEP_DAILY), dailyLeft: [...cur.dailyLeft, day].slice(-KEEP_DAILY) }, { day, score, race: null, lap: r?.best ?? null, finished: false }));
    },
    [host, update, fresh],
  );

  /**
   * A challenge round has one attempt and a race can't be resumed: one that is left mid-race (or was
   * found started after a reload) ends here, once, with what was driven so far (nothing after a reload).
   * Returns the ended round, or null if there was nothing to end.
   */
  const settleChallenge = useCallback(
    (sim: RaceSim | null, how: 'left' | 'reload'): ChallengeRun | null => {
      if (!challenge) return null;
      const run = fresh().challengeRuns.find((r) => r.key === runKey(challenge));
      if (!run || run.ended) return null;
      const r = sim?.track.def.id === CHALLENGE_ID ? sim.result() : null;
      const ended: ChallengeRun = { ...run, ended: how, score: r?.score ?? 0, race: null, lap: r?.best ?? null };
      const day = run.daily ?? null;
      host.report({
        type: 'end',
        score: ended.score,
        stats: r ? { drift: r.drift, cleanLaps: r.cleanLaps } : {},
        ...(day && day === todayKey() ? { daily: true } : {}),
        challenge: { id: challenge.id, round: challenge.round, replay: sim?.newGhost ? encodeReplay(sim.newGhost) : undefined },
      });
      update((cur) => {
        const x = putRun(cur, ended);
        if (!day || countDay(x.dailyEnded, day) >= countDay(x.dailyRaced, day)) return x;
        return putResult({ ...x, dailyEnded: [...x.dailyEnded, day].slice(-KEEP_DAILY), dailyLeft: [...x.dailyLeft, day].slice(-KEEP_DAILY) }, { day, score: ended.score, race: null, lap: ended.lap, finished: false });
      });
      return ended;
    },
    [challenge, fresh, host, update],
  );

  /** Shows a challenge round that is over (it is never raced again), on its track. */
  const showDone = useCallback(
    (run: ChallengeRun) => {
      const engine = engineRef.current;
      if (!engine || !challengeDef) return;
      engine.attract(trackFor(challengeDef));
      setDoneRun(run);
      go('done');
    },
    [challengeDef, trackFor, go],
  );

  /** Opens the challenge round: raced once, or shown as it ended. */
  const openChallenge = useCallback(() => {
    if (!challenge) return;
    const s = fresh();
    const key = runKey(challenge);
    let run = s.challengeRuns.find((r) => r.key === key) ?? null;
    if (!run && challengeDay) {
      // "Today's daily" already raced to the line that day: that result is this round's score (one attempt for both).
      const res = s.dailyResults.find((x) => x.day === challengeDay && x.finished);
      if (res) {
        const counted: ChallengeRun = { key, ended: 'daily', score: res.score, race: res.race, lap: res.lap, daily: challengeDay };
        const stats: Record<string, number> = {};
        if (res.lap !== null) stats.lapMs = Math.round(res.lap * 1000);
        if (res.race !== null) stats.raceMs = Math.round(res.race * 1000);
        host.report({ type: 'start' });
        host.report({ type: 'end', score: res.score, stats, challenge: { id: challenge.id, round: challenge.round } });
        update((cur) => putRun(cur, counted));
        run = counted;
      }
    }
    if (run?.ended) showDone(run);
    else if (!startRace()) toMenu();
  }, [challenge, challengeDay, fresh, host, update, showDone, startRace, toMenu]);

  // Leaving a counted race (today's daily, a challenge round) from the pause menu asks first.
  const leave = (): void => {
    const kind = raceRef.current;
    if (kind.kind !== 'free' && !confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    setConfirmLeave(false);
    if (kind.kind === 'challenge') settleChallenge(engineRef.current?.sim ?? null, 'left');
    else if (kind.kind === 'daily' && kind.day) settleDaily(kind.day, engineRef.current?.sim ?? null);
    toMenu();
  };

  const handlers = useRef({ startRace, toMenu, onFinish, onResult, pause, resume, settleDaily, settleChallenge, openChallenge });
  useEffect(() => {
    handlers.current = { startRace, toMenu, onFinish, onResult, pause, resume, settleDaily, settleChallenge, openChallenge };
  });

  // Engine lifetime = component lifetime. Everything is released on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const engine = new Engine(canvas, root, {
      onFinish: (sim) => handlers.current.onFinish(sim),
      onResult: () => handlers.current.onResult(),
      onAutoPause: () => {
        if (screenRef.current === 'race') {
          engine.releaseInput();
          screenRef.current = 'paused';
          setScreen('paused');
        }
      },
      onUiKey: (key: UiKey): boolean => {
        const s = screenRef.current;
        const h = handlers.current;
        const chal = inChallenge.current;
        // Over the line: the race is already recorded. R races again (not a challenge); any other key shows the result.
        if (s === 'finished') {
          if (key === 'restart' && !chal) {
            if (!h.startRace()) h.toMenu();
          } else h.onResult();
          return true;
        }
        // A challenge round is one race: Enter and R don't race it again from the result.
        if (chal && (s === 'result' || s === 'done')) {
          if (key !== 'pause') return false;
          h.toMenu();
          return true;
        }
        if (key === 'confirm' && (s === 'menu' || s === 'result')) return h.startRace();
        if (key === 'confirm' && s === 'paused') {
          h.resume();
          return true;
        }
        // Today's daily races are counted and a challenge round has one attempt: R must not throw one
        // away halfway (there is no Restart button for them either).
        if (key === 'restart' && (s === 'race' || s === 'paused') && raceRef.current.kind !== 'free') return false;
        if (key === 'restart' && (s === 'race' || s === 'paused' || s === 'result')) {
          if (!h.startRace()) h.toMenu();
          return true;
        }
        if (key === 'pause' && s === 'race') h.pause();
        else if (key === 'pause' && s === 'paused') h.resume();
        else if (key === 'pause' && (s === 'result' || s === 'garage')) h.toMenu();
        else return false;
        return true;
      },
    });
    engineRef.current = engine;
    engine.touchMode = touch;
    engine.setMuted(saveRef.current.muted);
    engine.setCar(getCar(saveRef.current.car));
    const day = todayKey();
    // A challenge round started before a reload can't be resumed: it ends now, with nothing driven.
    if (challenge) {
      const run = saveRef.current.challengeRuns.find((r) => r.key === runKey(challenge));
      if (run && !run.ended && startedHere.current !== run.key) handlers.current.settleChallenge(null, 'reload');
    }
    // Today's daily race was left before a reload or a closed tab: it ends now, unfinished. (Saves from
    // before races were counted have no end entry for a finished race; its best lap tells.)
    const s0 = saveRef.current;
    if (countDay(s0.dailyEnded, day) > 0 || !s0.bests[`${DAILY_PREFIX}${day}`]?.lap) handlers.current.settleDaily(day, null);
    if (inChallenge.current) handlers.current.openChallenge();
    else handlers.current.toMenu();
    return () => {
      // The arcade's Restart or Exit (or leaving the page) mid-race ends a counted race here, with what
      // was driven. (React's dev double mount tears down a challenge race that hasn't moved: no goodbye.)
      const kind = raceRef.current;
      const live = screenRef.current === 'race' || screenRef.current === 'paused';
      if (live && kind.kind === 'challenge' && engine.sim && engine.sim.time > -COUNTDOWN) handlers.current.settleChallenge(engine.sim, 'left');
      else if (live && kind.kind === 'daily' && kind.day) handlers.current.settleDaily(kind.day, engine.sim);
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

  // The arcade's Restart button (a challenge round has one attempt).
  const firstRestart = useRef(restartKey);
  useEffect(() => {
    if (restartKey === firstRestart.current || inChallenge.current) return;
    if (!handlers.current.startRace()) handlers.current.toMenu();
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
      {screen === 'race' && <GameMenuButton className="mr-pause mr-pause-menu" />}

      {screen === 'menu' && (
        <div className="mr-sheet mr-menu">
          <div className="mr-menu-head">
            <h2 className="mr-logo">
              Mini <span>Racer</span>
            </h2>
            <div className="mr-head-right">
              <span className="mr-coins mono" aria-label={`${formatCoins(save.coins)} coins`}>
                <i aria-hidden="true" />
                {formatCoins(save.coins)}
              </span>
              <button
                className="mr-chip mr-sound"
                onClick={() => {
                  const m = !save.muted;
                  update((s) => ({ ...s, muted: m }));
                  engineRef.current?.setMuted(m);
                }}
                aria-pressed={!save.muted}
                aria-label="Sound"
                title={save.muted ? 'Muted' : 'Sound'}
              >
                <SoundIcon muted={save.muted} />
                <span className="mr-sound-text">{save.muted ? 'Muted' : 'Sound'}</span>
              </button>
              <GameMenuButton className="mr-chip mr-menu-chip" />
            </div>
            {gift > 0 && (
              <span className="mr-gift" role="status">
                +{formatCoins(gift)} from GlitchBound
              </span>
            )}
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
                  {isDaily && (
                    <span className="mr-badge">
                      {racesLeft === DAILY_RACES ? `Daily · ${today.slice(5).replace('-', '/')}` : racesLeft > 0 ? `Daily · ${racesLeft} left` : 'Daily · done ✓'}
                    </span>
                  )}
                  {def.id === RANDOM_ID && <span className="mr-badge">Random</span>}
                  <span className={`mr-type mr-type-${def.type}`}>{TRACK_TYPES[def.type].name}</span>
                  <span className="mr-track-name">{def.name}</span>
                  <span className="mr-track-best mono">{fmtTime(b.race ?? null)}</span>
                  {m && <span className={`mr-medal mr-medal-${m}`} title={`${MEDAL_LABEL[m]} medal`} />}
                </button>
              );
            })}
          </div>

          {/* On short screens the track's details fold into one row (Track info), so Race! needs less scrolling. */}
          <div className={`mr-info${info ? ' is-open' : ''}`}>
            <button className="mr-info-toggle" aria-expanded={info} aria-controls="mr-info-body" onClick={() => setInfo((v) => !v)}>
              <span className={`mr-type mr-type-${selected.type}`}>{TRACK_TYPES[selected.type].name}</span>
              <span className="mr-info-label">Track info</span>
              <span className="mr-info-chev" aria-hidden="true" />
            </button>
            <div className="mr-info-body" id="mr-info-body">
              <p className="mr-blurb">{selected.blurb}</p>
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
            </div>
          </div>
          {selected.id === RANDOM_ID && (
            <button className="mr-chip mr-roll" onClick={rollRandom}>
              🎲 Roll a new random track
            </button>
          )}

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

          {/* The hint sits above the sticky footer: the footer pulls itself down to the sheet's edge, so text after it was hidden. */}
          <p className="mr-keys">
            {touch ? 'Hold the left or right side of the screen to steer. Gas is automatic.' : 'Left / Right or A / D to steer · gas is automatic · R restart · Esc pause'}
          </p>

          <div className="mr-menu-foot">
            <button className="mr-carpick" onClick={() => go('garage')}>
              <CarThumb car={car} />
              <span>
                <strong>{car.name}</strong>
                <small>Garage</small>
              </span>
            </button>
            {selected.id === daily.id && racesLeft === 0 ? (
              <p className="mr-daily-done">
                Today’s three races are done · <NextDaily />
              </p>
            ) : (
              <button className="mr-go" onClick={startRace}>
                {selected.id === daily.id && racesLeft < DAILY_RACES ? `Race! (${racesLeft} left)` : 'Race!'}
              </button>
            )}
          </div>
        </div>
      )}

      {screen === 'garage' && <Garage save={save} onPick={buyOrSelect} onBack={() => go('menu')} golds={goldCount(save)} />}

      {screen === 'paused' && (
        <div className="mr-sheet mr-small">
          <h2 className="mr-title">{!confirmLeave ? 'Paused' : race.kind === 'challenge' ? 'Leave the challenge?' : 'Leave today’s daily?'}</h2>
          {confirmLeave && (
            <p className="mr-note">
              {race.kind === 'challenge'
                ? `The round has one attempt: it ends here, with what you’ve driven so far.${race.day ? ' It was one of today’s daily races too.' : ''}`
                : racesLeft > 0
                  ? `The race ends unfinished and counts as one of today’s ${DAILY_RACES}. You have ${racesLeft} more after it.`
                  : 'This is today’s last race: it ends unfinished, and the daily track opens again tomorrow.'}
            </p>
          )}
          <div className="mr-actions">
            <button
              className="mr-go"
              onClick={() => {
                setConfirmLeave(false);
                resume();
              }}
              autoFocus
            >
              {confirmLeave ? 'Keep racing' : 'Resume'}
            </button>
            {race.kind === 'free' && (
              <button className="mr-btn" onClick={startRace}>
                Restart
              </button>
            )}
            <button className="mr-btn" onClick={leave}>
              {confirmLeave ? 'Leave the race' : 'Menu'}
            </button>
          </div>
        </div>
      )}

      {screen === 'race' && challengeShown && <p className="mr-chal">⚔️ Challenge{rival ? ` · racing ${rival.name}’s ghost` : ' · you set the pace'}</p>}
      {screen === 'result' && finish && (
        <ResultCard
          finish={finish}
          bests={save.bests[finish.track.id] ?? {}}
          onAgain={startRace}
          onMenu={toMenu}
          touch={touch}
          challengeId={finish.track.id === CHALLENGE_ID ? challenge?.id : undefined}
          day={finish.day ?? undefined}
          racesLeft={racesLeft}
        />
      )}
      {screen === 'done' && doneRun && challenge && <ChallengeDone run={doneRun} challengeId={challenge.id} onMenu={toMenu} />}
    </div>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="mr-sound-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />}
    </svg>
  );
}

/** A challenge round that was over before the game opened: shown as it ended, never raced again. */
function ChallengeDone({ run, challengeId, onMenu }: { run: ChallengeRun; challengeId: string; onMenu: () => void }) {
  const note =
    run.ended === 'daily'
      ? 'Your daily result counts here: the daily track is one attempt for both.'
      : run.ended === 'reload'
        ? 'This round was already started. It has one attempt, so it ended there.'
        : run.ended === 'left'
          ? 'You left this round before the finish. It has one attempt, so it ended there.'
          : 'You’ve raced this round: it has one attempt each.';
  return (
    <div className="mr-sheet mr-result">
      <div className="mr-result-top">
        <span className="mr-kicker mono">⚔️ Challenge · Time Trial</span>
      </div>
      <div className="mr-headline">
        <div>
          <span className="mr-label mono">Race time</span>
          <strong className="mono">{run.race !== null ? fmtTime(run.race) : 'Not counted'}</strong>
        </div>
      </div>
      <p className="mr-note-soft">{note}</p>
      <div className="mr-score mono">
        <span>{run.score.toLocaleString('en-US')} race points</span>
        {run.lap !== null && <span>Best lap {fmtTime(run.lap)}</span>}
      </div>
      <div className="mr-actions">
        <a className="mr-go" href={`/c/${challengeId}`} onClick={openChallengeScores} autoFocus>
          See the scoreboard
        </a>
        <button className="mr-btn" onClick={onMenu}>
          Menu
        </button>
      </div>
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
          <span className="mr-coins mono" aria-label={`${formatCoins(save.coins)} coins`}>
            <i aria-hidden="true" />
            {formatCoins(save.coins)}
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

function ResultCard({ finish, bests, onAgain, onMenu, touch, challengeId, day, racesLeft = 0 }: { finish: Finish; bests: Bests; onAgain: () => void; onMenu: () => void; touch: boolean; challengeId?: string; day?: string; racesLeft?: number }) {
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
      {result.mode === 'race' && (
        <ol className="mr-standings mono" aria-label="Finishing order">
          {/* A race that doesn't count has no place for you: the rivals keep theirs, you come last, not ranked. */}
          {(result.position !== null ? result.standings : [...result.standings.filter((s) => !s.player), ...result.standings.filter((s) => s.player)]).map((s, i) => (
            <li key={s.name} className={s.player ? 'is-me' : ''}>
              <span className="mr-pos">{s.player && result.position === null ? '–' : ordinal(i + 1)}</span>
              <i style={{ background: s.look.body }} aria-hidden="true" />
              <span>{s.player ? 'You' : s.name}</span>
              <span>{s.player && result.position === null ? 'not ranked' : s.time !== null ? fmtTime(s.time) : 'racing'}</span>
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
          {result.score.toLocaleString('en-US')} race points{result.levelBonus > 0 ? ` (+${result.levelBonus} AI bonus)` : ''}
        </span>
        {(!challengeId || coins > 0) && (
          <span className="mr-coins">
            <i aria-hidden="true" />+{coins}
          </span>
        )}
      </div>
      {challengeId ? (
        <p className="mr-note-soft mono">
          Your best lap this round {fmtTime(result.best)}
          {day ? ' · it counts as today’s daily race too' : ''}
        </p>
      ) : (
        <p className="mr-note-soft mono">
          Best {fmtTime(bests.race ?? null)} · lap {fmtTime(bests.lap ?? null)}
        </p>
      )}
      {newCars.length > 0 && <p className="mr-unlock">Unlocked: {newCars.map((c) => c.name).join(', ')}!</p>}
      <div className="mr-actions">
        {challengeId ? (
          <a className="mr-go" href={`/c/${challengeId}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="mr-go" onClick={day && racesLeft === 0 ? onMenu : onAgain} autoFocus>
            {!day ? `Again${touch ? '' : ' (R)'}` : racesLeft > 0 ? `Race again (${racesLeft} left)` : 'Other tracks'}
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

/** Sector times of each lap, colored by the delta shown during the race (vs that lap's reference). */
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
