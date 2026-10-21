import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NextDaily } from '../../components/NextDaily';
import { ResultLine } from '../../components/ResultLine';
import { useAccount } from '../../platform/account';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { createRoom } from '../../platform/rooms';
import { claimCoins } from '../../platform/coins';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { CARS, getCar, TIER_NAME, TRAIT_INFO, type CarDef } from './cars';
import { COSMETICS, DEFAULTS, getCosmetic, KIND_NAME, type Cosmetic, type CosmeticKind } from './cosmetics';
import { addMats, avgLevel, botsFor, botSpec, crateFor, difficultyOf, DIVISIONS, forecast, GAUNTLET_UNLOCK, gauntletPrize, gauntletRival, hasMats, idleIncome, idleRate, LADDER, loanerFor, materialsFor, PER_DIVISION, PINK_SLIP, pinkSlipCash, PLAYER_SKILL, RACE_SIZE, rivalBot, rivalCarId, settle, STAKE_SHARES, typicalEt, type Bot, type Forecast, type Opponent } from './economy';
import { ENV_DEFS } from './envs';
import { applyWear, effectsOf, FAILURE_TEXT, freshCondition, levelGains, MATERIALS, MAX_LEVEL, PART_INFO, PART_VISUALS, PARTS, raceWear, repairCost, RISKY, stockLevels, upgradeCost, wears, type Condition, type Levels, type Mats, type PartId } from './parts';
import { RaceScreen, type RacePlan } from './RaceScreen';
import { lookKey, NO_ORBIT, Stage3D, type CarLook, type Orbit, type ShowFocus } from './scene3d';
import { decodeScript, encodeScript, forecastRun, scoreOf, simulate, specOf, type CarSpec, type Driver, type RaceResult } from './sim';
import { createSfx, type Sfx } from './sound';
import { Intro, introNeeded } from './intro';
import { warmCars } from './models';
import { DAILY_TRIES, emptySave, loadSave, newCar, owns, writeSave, type OwnedCar, type Save } from './storage';
import { GameMenuButton } from '../../components/GameMenuButton';
import { Icon, PART_ICON } from './icons';
import { LiveRoom } from './live';
import type { LiveCar } from './room';
import { CarThumb, Cash, DriverFace, MatsLine, MatsPill, Panel, Sheet as Popup, StatBar, Sticker, TraitBadge, useThumb } from './ui';
import { clamp, fmtCash, fmtEt, fmtShort } from './util';
import './Game.css';

const EPOCH = '2026-10-21';
/** The dealer's order: cheapest first (tiers follow, since their price ranges never overlap). */
const BY_PRICE: readonly CarDef[] = [...CARS].sort((a, b) => a.price - b.price || a.tier - b.tier || a.name.localeCompare(b.name));
const SLUG = 'launch-control';
type Screen = 'hub' | 'rivals' | 'setup' | 'race' | 'result' | 'garage' | 'parts' | 'dealer' | 'daily' | 'ladder' | 'help' | 'live';
/** `test`: the dealer's free test drive (one a day, no prize, no wear). */
type Mode = 'ladder' | 'rematch' | 'daily' | 'challenge' | 'gauntlet' | 'test';
type GarageTab = 'repairs' | 'style';

interface Plan {
  mode: Mode;
  me: CarSpec;
  bots: Bot[];
  race: RacePlan;
  rival: Opponent | null;
  stake: number;
  forecast: Forecast;
  carId: string | null;
  /** King's Gauntlet round (1, 2, ...). */
  round?: number;
}

interface Outcome {
  plan: Plan;
  result: RaceResult;
  position: number;
  score: number;
  won: boolean;
  cash: { purse: number; wager: number; bonus: number };
  mats: Mats;
  wear: Condition;
  rankUp: boolean;
  newBest: boolean;
  /** A gauntlet round: the streak so far, the run's total and whether it ended here. */
  gauntlet?: { round: number; wins: number; total: number; over: boolean; prize: number };
  /** A boss beaten for the first time: their car is yours (or, owned already, sold on for cash). */
  pinkSlip?: { car: string; owned: boolean; cash: number };
}

const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const diffCache = new Map<string, { label: string; tone: string }>();
/** How hard a ladder rival is for a car: their typical run against yours, the same rule everywhere. */
function rivalDifficulty(o: Opponent, me: CarSpec): { label: string; tone: string } {
  const key = `${o.rank}|${me.def.id}|${JSON.stringify(me.levels)}|${Math.round(me.grip * 100)}|${Math.round(me.peakTorque)}`;
  const hit = diffCache.get(key);
  if (hit) return hit;
  const d = difficultyOf(typicalEt(botSpec(rivalBot(o, me.def.id)), o.skill) - typicalEt({ ...me, risky: [] }, PLAYER_SKILL));
  diffCache.set(key, d);
  if (diffCache.size > 400) diffCache.delete(diffCache.keys().next().value!);
  return d;
}
const dailySeed = (day: string): number => hashString(`${SLUG}:${day}`);
const prefersReduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Game({ host, restartKey, pauseKey, challenge, playerName, openMenu }: GameModuleProps) {
  return <LaunchControl key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} openMenu={openMenu} />;
}

function lookOf(save: Save, def: CarDef, levels?: Levels): CarLook {
  const owned = save.cars[def.id];
  const helmet = getCosmetic(save.helmet)?.colors ?? ['#fff', '#1d1238'];
  return {
    def,
    levels: levels ?? owned?.levels ?? newCar().levels,
    paint: owned?.paint ?? DEFAULTS.paint,
    livery: owned?.livery ?? DEFAULTS.livery,
    wheels: owned?.wheels ?? DEFAULTS.wheels,
    helmet: [helmet[0] ?? '#fff', helmet[1] ?? '#1d1238'],
    suit: getCosmetic(save.suit)?.colors[0] ?? '#1d3557',
  };
}

const BOT_PAINTS = ['p-stock', 'p-white', 'p-red', 'p-blue', 'p-yellow', 'p-lime', 'p-pink', 'p-orange', 'p-teal', 'p-violet', 'p-black'];
/** A rival's helmet and suit, picked from their name (the same in every race and on every list). */
function botDriver(name: string): { helmet: [string, string]; suit: string } {
  const h = hashString(name) >>> 0;
  const hm = COSMETICS.helmet[h % COSMETICS.helmet.length]!;
  return { helmet: [hm.colors[0]!, hm.colors[1]!], suit: COSMETICS.suit[(h >>> 11) % COSMETICS.suit.length]!.colors[0]! };
}

function botLook(b: Bot): CarLook {
  const h = hashString(b.name) >>> 0;
  return { def: b.car, levels: b.levels, paint: BOT_PAINTS[(h >>> 3) % BOT_PAINTS.length]!, livery: (h >>> 7) % 3 === 0 ? 'l-roundel' : DEFAULTS.livery, wheels: (h >>> 9) % 2 ? 'w-classic' : 'w-steel', ...botDriver(b.name) };
}

/** The numbers the garage shows for a car with its parts. */
interface Sheet {
  hp: number;
  torque: number;
  mass: number;
  grip: number;
  shiftMs: number;
  reliability: number;
  et: number;
  trap: number;
  t100: number;
}
const sheetCache = new Map<string, Sheet>();
/** The room code from an invite link (?room=ABCDE). */
function linkedRoom(): string | null {
  const c = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-HJKMNP-Z]{5}$/.test(c) ? c : null;
}

/** Keeps the room in the address bar, so a reload goes back into it. */
function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
}

function sheetOf(def: CarDef, levels: Levels, cond: Condition): Sheet {
  const key = `${def.id}|${JSON.stringify(levels)}|${PARTS.map((p) => Math.round(cond[p])).join()}`;
  const hit = sheetCache.get(key);
  if (hit) return hit;
  const e = effectsOf(levels, cond);
  const spec = specOf(def, levels, cond, false);
  const run = forecastRun(spec, 0.9, 5);
  const sheet: Sheet = { hp: Math.round(def.hp * e.torqueMul), torque: Math.round(def.torque * e.torqueMul), mass: Math.round(spec.mass), grip: Math.round(spec.grip * 100) / 100, shiftMs: Math.round(e.shiftTime * 1000), reliability: Math.round(spec.reliability * 100), et: run.et, trap: run.trap, t100: run.t100 };
  sheetCache.set(key, sheet);
  if (sheetCache.size > 300) sheetCache.delete(sheetCache.keys().next().value!);
  return sheet;
}

function LaunchControl({ host, pauseKey, challenge, playerName, openMenu }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string; openMenu?: () => void }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  /** A live room with a friend: its code (from an invite link, or one you opened). */
  const [liveCode, setLiveCode] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const [liveRacing, setLiveRacing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [screen, setScreen] = useState<Screen>(challenge ? 'setup' : liveCode ? 'live' : 'hub');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [toast, setToast] = useState('');
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [garageTab, setGarageTab] = useState<GarageTab>('repairs');
  const [styleKind, setStyleKind] = useState<CosmeticKind>('paint');
  const [dealerTier, setDealerTier] = useState(0);
  const [previewCar, setPreviewCar] = useState<string | null>(null);
  /** A new car being shown off (bought or won): the garage-door reveal over the hub. */
  const [reveal, setReveal] = useState<string | null>(null);
  const [rivalPick, setRivalPick] = useState<number | null>(null);
  /** A King's Gauntlet run in progress: wins so far and their total score. */
  const gauntletRef = useRef<{ wins: number; total: number } | null>(null);
  const [partTab, setPartTab] = useState<PartId>('engine');
  /** The parts shop shows the next level of the open part on the car. */
  const [previewNext, setPreviewNext] = useState(false);
  /** A part being inspected: the 3D view fills the pop-up, the camera on the part, its spot marked. */
  const [inspect, setInspect] = useState<PartId | null>(null);
  /** The player's own turn of the 3D view (drag, pinch, scroll); reset when the focus changes. */
  const orbitRef = useRef<Orbit>({ ...NO_ORBIT });
  /** When the player last touched the 3D view (the turntable waits before turning on its own). */
  const touchAt = useRef(0);
  /** A cosmetic tried on in the style shop before buying it. */
  const [styleTry, setStyleTry] = useState<string | null>(null);
  /** The open sheet's 3D view: the shared stage docks over it. */
  const [viewEl, setViewEl] = useState<HTMLDivElement | null>(null);
  const [portrait, setPortrait] = useState(false);
  /** Taller than wide by a good margin (a phone held upright), not just squarish (a desktop column). */
  const [tall, setTall] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  /** The shared stage; created by the first effect below, so later effects always see the live one. */
  const stageRef = useRef<Stage3D | null>(null);
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted, () => saveRef.current.musicOff)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  /** The cars the first screen shows: yours, the rest of your garage, and your next rival's. */
  const [introDefs] = useState<CarDef[]>(() => {
    const ids = [save.car, ...Object.keys(save.cars).slice(0, 8), LADDER[Math.min(save.rank, LADDER.length - 1)]!.car];
    return [...new Set(ids)].map(getCar);
  });
  /** The opening title card plays while those load (not at all when they are already in memory). */
  const [intro, setIntro] = useState(() => typeof window !== 'undefined' && introNeeded(introDefs));
  const [soundOpen, setSoundOpen] = useState(false);
  // After the opening, every other body loads quietly, cheapest first (the dealer's order).
  useEffect(() => {
    if (intro) return;
    let stop = false;
    const id = window.setTimeout(() => void warmCars(BY_PRICE, () => stop, 3), 1500);
    return () => {
      stop = true;
      window.clearTimeout(id);
    };
  }, [intro]);
  const me = playerName || 'You';
  /** Your car for a live race, as the room needs it. */
  const liveCarFor = useCallback((id: string): LiveCar => {
    const s = saveRef.current;
    const l = lookOf(s, getCar(id));
    return { id, levels: PARTS.map((p) => l.levels[p]), paint: l.paint, livery: l.livery, wheels: l.wheels, helmet: l.helmet, suit: l.suit };
  }, []);
  const openLive = async (): Promise<void> => {
    if (opening) return;
    sfx().click();
    setOpening(true);
    try {
      const code = await createRoom('drag');
      setRoomInUrl(code);
      setLiveCode(code);
      setScreen('live');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not open a room. Try again.');
    } finally {
      setOpening(false);
    }
  };
  const leaveLive = (): void => {
    setRoomInUrl(null);
    setLiveCode(null);
    setLiveRacing(false);
    go('hub');
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPortrait(el.clientHeight > el.clientWidth);
      setTall(el.clientHeight > el.clientWidth * 1.25);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sponsor income while away, a daily left mid-run, and coins from GlitchBound.
  const signedIn = useAccount().status === 'member';
  useEffect(() => {
    const s0 = saveRef.current;
    const now = Date.now();
    const d = s0.daily[today];
    if (d?.open) {
      host.report({ type: 'end', score: 0, stats: {}, daily: true });
      commit((s) => ({ ...s, daily: { ...s.daily, [today]: { ...d, open: false, left: true } } }));
    }
    if (s0.paidAt > 0 && now - s0.paidAt > 60_000) {
      const fx = effectsOf(s0.cars[s0.car]?.levels ?? newCar().levels, s0.cars[s0.car]?.cond ?? newCar().cond);
      const pay = idleIncome(s0.rank, now - s0.paidAt, fx.sponsorMul);
      commit((s) => ({ ...s, cash: s.cash + pay, earned: s.earned + pay, paidAt: now }));
      if (pay >= 25) setToast(`Your sponsor paid $${fmtCash(pay)} while you were away`);
    } else if (s0.paidAt === 0) commit((s) => ({ ...s, paidAt: now }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    void claimCoins(SLUG).then(({ amount }) => {
      if (amount <= 0) return;
      commit((s) => ({ ...s, cash: s.cash + amount }));
      setToast(`+$${fmtCash(amount)} from GlitchBound`);
    });
  }, [signedIn, commit]);

  const car = getCar(save.car);
  const owned = save.cars[save.car] ?? newCar();
  const mySheet = useMemo(() => sheetOf(car, owned.levels, owned.cond), [car, owned]);
  const mySpec = useMemo(() => specOf(car, owned.levels, owned.cond), [car, owned]);
  const nextDiff = useMemo(() => rivalDifficulty(LADDER[Math.min(save.rank, LADDER.length - 1)]!, mySpec), [save.rank, mySpec]);
  const look = useMemo(() => lookOf(save, car), [save, car]);
  const nextOpp = LADDER[Math.min(save.rank, LADDER.length - 1)]!;
  const ladderDone = save.rank >= LADDER.length;
  const dailyRec = save.daily[today];
  const triesLeft = DAILY_TRIES - (dailyRec?.tries ?? 0);
  const loaner = useMemo(() => loanerFor(dailySeed(today)), [today]);
  const crateOpen = save.crateDay === today;
  // the hub's goal: the next car up from yours you don't have yet (or any you don't), and its pink slip
  const nextCar = BY_PRICE.find((d) => !save.cars[d.id] && d.price > car.price) ?? BY_PRICE.find((d) => !save.cars[d.id]);
  const nextSlip = nextCar ? PINK_SLIP[nextCar.id] : undefined;

  // ---- building a race
  const setup = useCallback(
    (mode: Mode, rival: Opponent | null, round = 1, testId?: string): void => {
      const s = saveRef.current;
      let tagline: string | undefined;
      const seed = mode === 'challenge' && challenge ? challenge.seed : mode === 'daily' ? dailySeed(today) : (Math.random() * 2 ** 32) >>> 0;
      let meSpec: CarSpec;
      let bots: Bot[];
      let env = s.env;
      let carId: string | null = s.car;
      const names: string[] = [me];
      const drivers: Driver[] = [{ kind: 'live' }];
      const looks: CarLook[] = [];
      if (mode === 'daily' || mode === 'challenge') {
        const loan = loanerFor(seed);
        meSpec = specOf(loan.car, loan.levels, newCar().cond, false);
        bots = loan.bots;
        env = loan.env;
        carId = null;
        looks.push({ ...lookOf(s, loan.car, loan.levels), paint: DEFAULTS.paint });
        tagline = mode === 'daily' ? 'TODAY’S OPPONENT' : 'RIVAL';
        if (mode === 'challenge') {
          // Head to head with the fastest friend's ghost so far; the day's bot when nobody has raced yet.
          const ghosts = (challenge?.replays ?? [])
            .map((r) => ({ name: r.name, script: decodeScript(r.replay) }))
            .filter((g) => g.script)
            .map((g) => {
              const run = simulate([meSpec], [{ kind: 'script', script: g.script! }], seed).racers[0]!;
              return { ...g, crossed: run.crossed ?? Infinity };
            })
            .sort((a, b) => a.crossed - b.crossed)
            .slice(0, RACE_SIZE - 1);
          const specs: CarSpec[] = [meSpec];
          for (const gh of ghosts) {
            specs.push(meSpec);
            drivers.push({ kind: 'script', script: gh.script! });
            names.push(gh.name);
            looks.push({ ...looks[0]!, paint: BOT_PAINTS[((hashString(gh.name) >>> 0) >>> 3) % BOT_PAINTS.length]! });
          }
          tagline = ghosts.length ? 'FASTEST GHOST' : 'RIVAL';
          const fill = bots.slice(0, RACE_SIZE - 1 - ghosts.length);
          for (const b of fill) {
            specs.push(botSpec(b));
            drivers.push({ kind: 'policy', skill: b.skill, seed: seed ^ hashString(b.name) });
            names.push(b.name);
            looks.push(botLook(b));
          }
          setPlan({ mode, me: meSpec, bots: fill, race: { specs, drivers, looks, names, env, seed, tagline }, rival: null, stake: 0, forecast: forecast(meSpec, fill), carId });
          setScreen('setup');
          return;
        }
      } else if (mode === 'test') {
        // the dealer's test drive: the car stock, against a car like it
        const c = getCar(testId ?? s.car);
        meSpec = specOf(c, stockLevels(), freshCondition(), false);
        bots = botsFor(meSpec, RACE_SIZE - 1, seed);
        rival = null;
        carId = null;
        tagline = 'TEST DRIVE';
        looks.push({ ...lookOf(s, c, stockLevels()), paint: DEFAULTS.paint, livery: DEFAULTS.livery, wheels: DEFAULTS.wheels });
      } else if (mode === 'gauntlet') {
        const c = getCar(s.car);
        const o = s.cars[s.car] ?? newCar();
        meSpec = specOf(c, o.levels, o.cond);
        bots = [gauntletRival(meSpec, round, seed)];
        rival = null;
        tagline = `GAUNTLET · ROUND ${round}`;
        looks.push(lookOf(s, c));
      } else {
        const c = getCar(s.car);
        const o = s.cars[s.car] ?? newCar();
        meSpec = specOf(c, o.levels, o.cond);
        const opp = rival ?? LADDER[Math.min(s.rank, LADDER.length - 1)]!;
        bots = botsFor(meSpec, RACE_SIZE - 1, seed, opp);
        rival = opp;
        tagline = `${rivalDifficulty(opp, meSpec).label.toUpperCase()} · #${opp.rank}${opp.boss ? ' · FINAL' : ''}`;
        looks.push(lookOf(s, c));
      }
      const specs: CarSpec[] = [meSpec];
      for (const b of bots) {
        specs.push(botSpec(b));
        drivers.push({ kind: 'policy', skill: b.skill, seed: seed ^ hashString(b.name) });
        names.push(b.name);
        looks.push(botLook(b));
      }
      setPlan({ mode, me: meSpec, bots, race: { specs, drivers, looks, names, env, seed, tagline }, rival: mode === 'daily' || mode === 'gauntlet' || mode === 'test' ? null : rival, stake: 0, forecast: forecast(meSpec, bots), carId, round: mode === 'gauntlet' ? round : undefined });
      setScreen('setup');
    },
    [challenge, today, me],
  );
  const firstSetup = useRef(false);
  useEffect(() => {
    if (challenge && !firstSetup.current) {
      firstSetup.current = true;
      setup('challenge', null);
    }
  }, [challenge, setup]);

  const startRace = (p: Plan): void => {
    if (p.mode === 'daily') {
      const d = saveRef.current.daily[today] ?? { best: 0, tries: 0, et: 0 };
      if (d.tries >= DAILY_TRIES) return;
      commit((s) => ({ ...s, daily: { ...s.daily, [today]: { ...d, tries: d.tries + 1, open: true, left: false } } }));
    }
    if (p.stake > 0) commit((s) => ({ ...s, cash: s.cash - p.stake }));
    if (p.mode === 'test') commit((s) => ({ ...s, testDay: today }));
    setOutcome(null);
    setPaused(false);
    setConfirmLeave(false);
    sfx().click();
    if (p.mode !== 'test' && (p.mode !== 'gauntlet' || (p.round ?? 1) === 1)) host.report({ type: 'start' });
    if (p.mode === 'gauntlet' && (p.round ?? 1) === 1) gauntletRef.current = { wins: 0, total: 0 };
    setScreen('race');
  };

  const finishRace = useCallback(
    (p: Plan, result: RaceResult): void => {
      const mine = result.racers[0]!;
      const position = result.order.indexOf(0) + 1;
      const won = position === 1 && mine.et !== null;
      const score = scoreOf(mine);
      const s0 = saveRef.current;
      const stats: Record<string, number> = { perfect: mine.perfect, position };
      if (mine.et !== null) {
        stats.etMs = Math.round(mine.et * 1000);
        stats.trapKmh = Math.round(mine.trap);
      }
      let cash = { purse: 0, wager: 0, bonus: 0 };
      let mats: Mats = {};
      let wear = raceWear({ spinTime: mine.spinTime });
      let rankUp = false;
      let gauntletInfo: Outcome['gauntlet'];
      let pinkSlip: Outcome['pinkSlip'];
      if (p.mode === 'test') {
        // a test drive: nothing won, nothing worn, nothing on the leaderboard
        wear = raceWear({ spinTime: 0 });
      } else if (p.mode === 'daily') {
        const d = s0.daily[today] ?? { best: 0, tries: 1, et: 0 };
        const better = score > d.best;
        commit((s) => ({ ...s, runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), daily: { ...s.daily, [today]: { best: Math.max(d.best, score), tries: d.tries, et: better && mine.et !== null ? Math.round(mine.et * 1000) : d.et, open: false } } }));
        host.report({ type: 'end', score, stats, daily: true });
        wear = raceWear({ spinTime: 0 });
      } else if (p.mode === 'gauntlet') {
        const run = gauntletRef.current ?? { wins: 0, total: 0 };
        const round = p.round ?? 1;
        let prize = 0;
        if (won) {
          const pz = gauntletPrize(round, s0.rank, p.race.seed);
          prize = pz.cash;
          mats = pz.mats;
          run.wins++;
          run.total += score;
          cash = { purse: pz.cash, wager: 0, bonus: 0 };
        }
        gauntletRef.current = won ? run : null;
        commit((s) => {
          const oc = s.cars[p.carId!] ?? newCar();
          return { ...s, cash: s.cash + prize, earned: s.earned + prize, mats: addMats(s.mats, mats), runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), gauntletBest: Math.max(s.gauntletBest, run.wins), cars: { ...s.cars, [p.carId!]: { ...oc, cond: applyWear(oc.cond, wear) } } };
        });
        // the whole streak is one run on the leaderboard: its total score, and the streak itself
        if (!won) host.report({ type: 'end', score: run.total, stats: { ...stats, streak: run.wins } });
        gauntletInfo = { round, wins: run.wins, total: run.total, over: !won, prize };
      } else if (p.mode === 'challenge' && challenge) {
        commit((s) => ({ ...s, runs: s.runs + 1, wins: s.wins + (won ? 1 : 0) }));
        host.report({ type: 'end', score, stats, challenge: { id: challenge.id, round: challenge.round, replay: mine.et !== null ? encodeScript(mine.script) : undefined } });
        wear = raceWear({ spinTime: 0 });
      } else {
        const opp = p.rival!;
        const firstWin = won && p.mode === 'ladder' && s0.rank === opp.rank - 1;
        const oc0 = s0.cars[p.carId!] ?? newCar();
        const fans = effectsOf(oc0.levels, oc0.cond).fansMul;
        cash = settle({ position: mine.et === null ? RACE_SIZE : position, purse: opp.purse, fansMul: fans, stake: p.stake, mult: p.forecast.mult, firstWin });
        if (won) mats = materialsFor(opp, firstWin, p.race.seed);
        rankUp = firstWin;
        // a division final won for the first time: the boss hands over the keys, tuning and all
        if (firstWin && opp.boss) {
          const owned = !!s0.cars[opp.car];
          pinkSlip = { car: opp.car, owned, cash: owned ? pinkSlipCash(getCar(opp.car)) : 0 };
        }
        const slip = pinkSlip;
        const back = p.stake + cash.wager;
        commit((s) => {
          const oc = s.cars[p.carId!] ?? newCar();
          const cars = { ...s.cars, [p.carId!]: { ...oc, cond: applyWear(oc.cond, wear) } };
          if (slip && !slip.owned && !cars[slip.car]) cars[slip.car] = { ...newCar(), levels: { ...opp.levels } };
          return {
            ...s,
            cash: Math.max(0, s.cash + cash.purse + Math.max(0, back) + cash.bonus + (slip?.cash ?? 0)),
            earned: s.earned + cash.purse + Math.max(0, cash.wager) + cash.bonus + (slip?.cash ?? 0),
            mats: addMats(s.mats, mats),
            rank: rankUp ? s.rank + 1 : s.rank,
            runs: s.runs + 1,
            wins: s.wins + (won ? 1 : 0),
            cars,
          };
        });
        host.report({ type: 'end', score, stats });
      }
      const newBest = p.mode !== 'test' && score > s0.bestScore && score > 0;
      if (p.mode !== 'test' && (newBest || (mine.et !== null && (s0.bestEt === 0 || Math.round(mine.et * 1000) < s0.bestEt))))
        commit((s) => ({ ...s, bestScore: Math.max(s.bestScore, score), bestEt: mine.et !== null && (s.bestEt === 0 || Math.round(mine.et * 1000) < s.bestEt) ? Math.round(mine.et * 1000) : s.bestEt }));
      if (cash.purse + cash.wager + cash.bonus > 0) sfx().cash();
      setOutcome({ plan: p, result, position, score, won, cash, mats, wear, rankUp, newBest, gauntlet: gauntletInfo, pinkSlip });
      setScreen('result');
    },
    [commit, host, challenge, today, sfx],
  );

  const settleOpenDaily = useCallback((): void => {
    const d = saveRef.current.daily[today];
    if (!d?.open) return;
    host.report({ type: 'end', score: 0, stats: {}, daily: true });
    commit((s) => ({ ...s, daily: { ...s.daily, [today]: { ...d, open: false, left: true } } }));
  }, [commit, host, today]);
  /** Ends a gauntlet run that is still going (the player left): the streak so far is the run. */
  const endGauntlet = (): void => {
    const run = gauntletRef.current;
    if (!run) return;
    gauntletRef.current = null;
    host.report({ type: 'end', score: run.total, stats: { streak: run.wins } });
  };
  const leaveRace = (): void => {
    if (plan?.mode === 'daily' && !confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    settleOpenDaily();
    if (plan?.mode === 'gauntlet') endGauntlet();
    sfx().quiet();
    setScreen(plan?.mode === 'challenge' ? 'setup' : 'hub');
  };
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'race') setPaused(true);
  }
  const settleRef = useRef(settleOpenDaily);
  useEffect(() => {
    settleRef.current = settleOpenDaily;
  });
  useEffect(() => () => settleRef.current(), []);

  // ---- garage, dealer, style actions
  const buyUpgrade = (part: PartId): void => {
    const s = saveRef.current;
    const oc = s.cars[s.car] ?? newCar();
    const level = oc.levels[part] + 1;
    if (level > MAX_LEVEL) return;
    const cost = upgradeCost(getCar(s.car), part, level);
    if (s.cash < cost.cash || !hasMats(s.mats, cost.mats)) return;
    sfx().upgrade();
    commit((x) => ({ ...x, cash: x.cash - cost.cash, mats: addMats(x.mats, cost.mats, -1), cars: { ...x.cars, [x.car]: { ...oc, levels: { ...oc.levels, [part]: level }, cond: { ...oc.cond, [part]: 100 } } } }));
  };
  const repair = (part: PartId): void => {
    const s = saveRef.current;
    const oc = s.cars[s.car] ?? newCar();
    const cost = repairCost(getCar(s.car), part, oc.cond[part]);
    if (s.cash < cost) return;
    sfx().click();
    commit((x) => ({ ...x, cash: x.cash - cost, cars: { ...x.cars, [x.car]: { ...oc, cond: { ...oc.cond, [part]: 100 } } } }));
  };
  const buyCar = (def: CarDef): void => {
    const s = saveRef.current;
    if (s.cars[def.id]) {
      commit((x) => ({ ...x, car: def.id }));
      setPreviewCar(null);
      return;
    }
    if (s.cash < def.price) return;
    sfx().buy(def);
    // the new car is already on the turntable: no second rev on top of the start-up
    revFrom.current = def.id;
    commit((x) => ({ ...x, cash: x.cash - def.price, cars: { ...x.cars, [def.id]: newCar() }, car: def.id }));
    showOff(def.id);
  };
  /** The garage-door reveal for a new car, over the hub (where the car has the whole screen). */
  const showOff = (id: string): void => {
    setPreviewCar(null);
    setInspect(null);
    setReveal(id);
    setScreen('hub');
  };
  /** Claims a pink slip from the result screen: the won car is the one you drive now. */
  const claimSlip = (id: string): void => {
    revFrom.current = id;
    sfx().buy(getCar(id));
    commit((x) => (x.cars[id] ? { ...x, car: id } : x));
    showOff(id);
  };
  const buyOrEquip = (c: Cosmetic): void => {
    const s = saveRef.current;
    const mine = owns(s, c.id);
    if (!mine && (s.cash < c.price || (c.rank ?? 0) > s.rank)) return;
    if (!mine) sfx().cash();
    else sfx().click();
    commit((x) => {
      const next = { ...x, owned: mine ? x.owned : [...x.owned, c.id] };
      if (c.kind === 'helmet') next.helmet = c.id;
      else if (c.kind === 'suit') next.suit = c.id;
      else if (c.kind === 'env') next.env = c.id;
      else {
        const oc = next.cars[next.car] ?? newCar();
        next.cars = { ...next.cars, [next.car]: { ...oc, [c.kind]: c.id } };
      }
      return next;
    });
  };
  const openCrate = (): void => {
    const s = saveRef.current;
    if (s.crateDay === today) return;
    const crate = crateFor(s.rank, dailySeed(today) ^ 0xc8a7e);
    sfx().cash();
    commit((x) => ({ ...x, crateDay: today, cash: x.cash + crate.cash, earned: x.earned + crate.cash, mats: addMats(x.mats, crate.mats) }));
    setToast(`Crate opened: $${fmtCash(crate.cash)} and materials`);
  };

  const go = (s: Screen): void => {
    sfx().click();
    setPreviewCar(null);
    setPreviewNext(false);
    setInspect(null);
    setStyleTry(null);
    setScreen(s);
  };

  const rivalIdx = Math.min(rivalPick ?? save.rank, LADDER.length - 1);
  const stageLook = useMemo((): CarLook => {
    if (screen === 'rivals') {
      const o = LADDER[rivalIdx]!;
      return lookOf(emptySave(), getCar(rivalCarId(o, save.car)), o.levels);
    }
    if (screen === 'parts' && previewNext && owned.levels[partTab] < MAX_LEVEL) return lookOf(save, car, { ...owned.levels, [partTab]: owned.levels[partTab] + 1 });
    if (screen === 'garage' && styleTry) {
      const c = getCosmetic(styleTry);
      if (c && (c.kind === 'paint' || c.kind === 'livery' || c.kind === 'wheels')) return { ...look, [c.kind]: c.id };
      if (c && c.kind === 'helmet') return { ...look, helmet: [c.colors[0] ?? '#fff', c.colors[1] ?? '#1d1238'] };
      if (c && c.kind === 'suit') return { ...look, suit: c.colors[0] ?? look.suit };
    }
    return previewCar ? lookOf(save, getCar(previewCar)) : look;
  }, [screen, rivalIdx, previewNext, partTab, styleTry, previewCar, save, look, car, owned]);
  const focus: ShowFocus = inspect ?? (screen === 'parts' ? partTab : 'car');
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  });
  // a new focus starts from its own camera, not wherever the player had turned the last one
  useEffect(() => {
    orbitRef.current = { ...NO_ORBIT };
  }, [focus, screen]);
  // the marker on the car: the part on show in the parts shop, or the one being inspected
  const marker = screen === 'parts' ? (inspect ?? partTab) : screen === 'garage' ? inspect : null;
  useEffect(() => {
    stageRef.current?.setMarker(marker);
  }, [marker]);
  const angleRef = useRef(-0.8);
  const docked = !!viewEl;
  // A sheet's 3D view: the shared stage is moved over it (and follows it when the layout changes).
  useLayoutEffect(() => {
    const box = stageBoxRef.current;
    const root = rootRef.current;
    if (!box || !root || !viewEl) return;
    const place = (): void => {
      const r = root.getBoundingClientRect();
      const v = viewEl.getBoundingClientRect();
      Object.assign(box.style, { left: `${v.left - r.left}px`, top: `${v.top - r.top}px`, width: `${v.width}px`, height: `${v.height}px`, right: 'auto', bottom: 'auto' });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(viewEl);
    ro.observe(root);
    return () => {
      ro.disconnect();
      box.removeAttribute('style');
    };
  }, [viewEl]);
  const racing = (screen === 'race' && !!plan) || (screen === 'live' && liveRacing);
  // Music: the menu theme everywhere, the tension loop from the start of a race (it cuts at lights out).
  useEffect(() => {
    if (intro) return;
    sfx().music(racing ? 'race' : 'menu');
  }, [racing, intro, sfx]);
  // A throttle blip when the car on the turntable changes (picking, buying, previewing).
  const shownCar = stageLook.def.id;
  const revFrom = useRef(shownCar);
  useEffect(() => {
    if (revFrom.current === shownCar) return;
    revFrom.current = shownCar;
    if (!racing && !intro) sfx().rev(getCar(shownCar));
  }, [shownCar, racing, intro, sfx]);
  // The dealer's pictures need every body: load them now, six at a time, cheapest (the top of the list) first.
  useEffect(() => {
    if (screen !== 'dealer') return;
    let stop = false;
    void warmCars(BY_PRICE, () => stop, 6);
    return () => {
      stop = true;
    };
  }, [screen]);
  // The sound menu closes on any tap outside it.
  useEffect(() => {
    if (!soundOpen) return;
    const close = (e: PointerEvent): void => {
      if (!(e.target as Element | null)?.closest('.lc-sound')) setSoundOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [soundOpen]);

  // One WebGL stage for the whole game: the menus' turntable and the race share it.
  useEffect(() => {
    const box = stageBoxRef.current;
    if (!box) return;
    // a fresh canvas per mount: a disposed renderer loses its context for good
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    box.appendChild(cv);
    let stage: Stage3D;
    try {
      stage = new Stage3D(cv);
    } catch {
      cv.remove();
      return;
    }
    stageRef.current = stage;
    const size = (): void => stage.resize(box.clientWidth, box.clientHeight, Math.min(2, window.devicePixelRatio || 1));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(box);
    return () => {
      ro.disconnect();
      stage.dispose();
      cv.remove();
      stageRef.current = null;
    };
  }, []);
  // The turntable: the selected (or previewed) car on the chosen strip, outside races.
  const showKey = lookKey(stageLook);
  const stageLookRef = useRef(stageLook);
  useEffect(() => {
    stageLookRef.current = stageLook;
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || racing) return;
    stage.setEnv(save.env);
    stage.setCar(0, stageLookRef.current);
    // inspecting: the car sits high in the view, clear of the caption at the bottom
    const framing = docked ? (inspect ? 'high' : 'center') : tall ? 'high' : portrait ? 'center' : 'right';
    const reduced = prefersReduced();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      // about 60 frames a second (a 30 fps turntable looks steppy); nothing while hidden
      if (now - last < 14 || document.hidden) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // the turntable turns on its own, but not while (or just after) the player turns it
      if (focusRef.current === 'car' && !reduced && now - touchAt.current > 4000) angleRef.current += dt * 0.25;
      stage.renderShowcase(angleRef.current, framing, reduced ? 0 : dt * 1.5, focusRef.current, dt, orbitRef.current);
    };
    stage.setMarker(marker);
    stage.renderShowcase(angleRef.current, framing, 0, focusRef.current, reduced ? 0 : 1 / 60, orbitRef.current);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // the marker is set by its own effect; this one only needs it at the start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKey, save.env, racing, portrait, tall, docked, focus, inspect]);
  // a docked 3D view can be turned: drag to orbit, pinch or scroll to zoom
  useEffect(() => {
    const box = stageBoxRef.current;
    if (!box || !docked) return;
    const pts = new Map<number, { x: number; y: number }>();
    let span = 0;
    const gap = (): number => {
      const [a, b] = [...pts.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent): void => {
      if ((e.target as HTMLElement).closest('button')) return;
      box.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      span = gap();
      touchAt.current = performance.now();
    };
    const move = (e: PointerEvent): void => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const o = orbitRef.current;
      if (pts.size === 1) {
        o.yaw -= (e.clientX - p.x) * 0.012;
        o.pitch = clamp(o.pitch + (e.clientY - p.y) * 0.005, -0.3, 0.9);
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 2) {
        const g = gap();
        if (span > 0 && g > 0) o.zoom = clamp((o.zoom * span) / g, 0.5, 1.7);
        span = g;
      }
      touchAt.current = performance.now();
    };
    const up = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
      span = gap();
    };
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      orbitRef.current.zoom = clamp(orbitRef.current.zoom * Math.exp(e.deltaY * 0.0012), 0.5, 1.7);
      touchAt.current = performance.now();
    };
    box.addEventListener('pointerdown', down);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', wheel, { passive: false });
    return () => {
      box.removeEventListener('pointerdown', down);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', up);
      box.removeEventListener('wheel', wheel);
    };
  }, [docked]);
  const zoomBy = (k: number): void => {
    orbitRef.current.zoom = clamp(orbitRef.current.zoom * k, 0.5, 1.7);
    touchAt.current = performance.now();
  };
  const resetView = (): void => {
    orbitRef.current = { ...NO_ORBIT };
  };
  const cashPill = (
    <span className="lc-pill lc-pill-cash">
      <Cash n={save.cash} />
    </span>
  );
  const topbar = (
    <header className="lc-top">
      <button className="lc-logo" onClick={() => go('hub')} aria-label="Launch Control menu">
        <span className="lc-logo-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="lc-logo-word">
          Launch<b>Control</b>
        </span>
      </button>
      <div className="lc-wallet" aria-live="polite">
        <span className="lc-pill lc-pill-cash">
          <Cash n={save.cash} />
        </span>
        <MatsPill mats={save.mats} />
        <span className="lc-pill lc-pill-rank mono" title="Ladder rank">
          <Icon name="trophy" size={15} />
          {save.rank}/{LADDER.length}
        </span>
      </div>
      <div className="lc-sound">
        <button className="lc-icon" onClick={() => setSoundOpen((o) => !o)} aria-label="Sound" aria-expanded={soundOpen} aria-haspopup="true">
          <Icon name={save.muted && save.musicOff ? 'mute' : 'sound'} size={19} />
        </button>
        {soundOpen && (
          <div className="lc-sound-menu" role="group" aria-label="Sound">
            <button
              className="lc-sound-row"
              role="switch"
              aria-checked={!save.musicOff}
              onClick={() => {
                commit((s) => ({ ...s, musicOff: !s.musicOff }));
                sfx().refresh();
              }}
            >
              Music <span className="lc-knob" aria-hidden="true" />
            </button>
            <button
              className="lc-sound-row"
              role="switch"
              aria-checked={!save.muted}
              onClick={() => {
                commit((s) => ({ ...s, muted: !s.muted }));
                sfx().refresh();
                if (!saveRef.current.muted) sfx().click();
              }}
            >
              Sound effects <span className="lc-knob" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <button className="lc-icon" onClick={() => go('help')} aria-label="How to race">
        <Icon name="help" size={19} />
      </button>
      <GameMenuButton className="lc-icon" />
    </header>
  );

  return (
    <div ref={rootRef} className={`lc${portrait ? ' is-portrait' : ''}`} data-screen={racing ? 'race' : screen} onPointerDown={() => sfx().unlock()} onKeyDown={() => sfx().unlock()}>
      {intro && <Intro defs={introDefs} sfx={sfx} onDone={() => setIntro(false)} />}
      <div ref={stageBoxRef} className="lc-stage" data-mode={racing ? 'race' : docked ? 'dock' : 'full'}>
        {docked && !racing && (
          <div className="lc-view-ui">
            {!inspect && (
              <span className="lc-view-hint mono">
                <Icon name="rotate" size={14} />
                Drag to turn · pinch to zoom
              </span>
            )}
            <div className="lc-view-tools">
              <button className="lc-view-btn" onClick={() => zoomBy(0.85)} aria-label="Zoom in">
                <Icon name="plus" size={18} />
              </button>
              <button className="lc-view-btn" onClick={() => zoomBy(1 / 0.85)} aria-label="Zoom out">
                <Icon name="minus" size={18} />
              </button>
              <button className="lc-view-btn" onClick={resetView} aria-label="Reset the view">
                <Icon name="reset" size={18} />
              </button>
            </div>
            {screen === 'parts' && !inspect && (
              <button className="lc-view-inspect" onClick={() => setInspect(partTab)}>
                <Icon name="eye" size={18} />
                Inspect the {PART_INFO[partTab].name.toLowerCase()}
              </button>
            )}
            {inspect && (screen === 'parts' || screen === 'garage') && (
              <InspectCard
                part={inspect}
                mode={screen === 'parts' ? 'upgrade' : 'repair'}
                car={car}
                levels={owned.levels}
                cond={owned.cond}
                save={save}
                preview={previewNext}
                setPreview={setPreviewNext}
                onUpgrade={() => buyUpgrade(inspect)}
                onRepair={() => repair(inspect)}
                onDone={() => setInspect(null)}
              />
            )}
          </div>
        )}
      </div>
      {screen === 'race' && plan ? (
        <>
          <RaceScreen plan={plan.race} stageRef={stageRef} paused={paused} setPaused={setPaused} onFinish={(r) => finishRace(plan, r)} sfx={sfx} nudge={portrait && touch} onStart={() => undefined} />
          {paused && (
            <div className="lc-overlay" role="dialog" aria-label="Paused">
              <div className="lc-panel lc-dialog">
                <h2 className="lc-h">Paused</h2>
                {confirmLeave ? (
                  <>
                    <p>Leaving counts as one of today’s {DAILY_TRIES} runs, scored 0.</p>
                    <button className="btn btn-lime" onClick={() => setConfirmLeave(false)}>
                      Keep racing
                    </button>
                    <button className="btn" onClick={leaveRace}>
                      Leave anyway
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-lime" autoFocus onClick={() => setPaused(false)}>
                      Resume
                    </button>
                    <button className="btn" onClick={leaveRace}>
                      Leave the race
                    </button>
                    {openMenu && (
                      <button className="btn btn-ghost" onClick={openMenu}>
                        Game menu
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
      {!liveRacing && topbar}
      {toast && (
        <div className="lc-toast" role="status">
          {toast}
        </div>
      )}
      <main className="lc-main">
        {screen === 'hub' && reveal && <CarReveal def={getCar(reveal)} owned={save.cars[reveal]} slip={!!PINK_SLIP[reveal] && outcome?.pinkSlip?.car === reveal} onDone={() => setReveal(null)} />}
        {screen === 'hub' && !reveal && (
          <div className="lc-hub">
            <div className="lc-hero">
              <span className="lc-hero-tags">
                <span className="lc-hero-tier" data-tier={car.tier}>
                  {TIER_NAME[car.tier]} · Lv {Math.round(avgLevel(owned.levels))}
                </span>
                <TraitBadge trait={car.trait} />
              </span>
              <span className="lc-hero-driver">
                <DriverFace helmet={look.helmet} suit={look.suit} size={34} badge />
                <span>{me}</span>
              </span>
              <h2 className="lc-hero-name">{car.name}</h2>
              <dl className="lc-specs">
                <div>
                  <dt>Power</dt>
                  <dd>
                    {mySheet.hp}
                    <small>hp</small>
                  </dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd>
                    {mySheet.mass}
                    <small>kg</small>
                  </dd>
                </div>
                <div>
                  <dt>¼ mile</dt>
                  <dd>
                    {fmtEt(mySheet.et)}
                    <small>s</small>
                  </dd>
                </div>
              </dl>
              <div className="lc-division-bar" aria-label={`${DIVISIONS[nextOpp.division]} division: ${Math.min(PER_DIVISION, save.rank - nextOpp.division * PER_DIVISION)} of ${PER_DIVISION} beaten`}>
                <span className="lc-division-name">{ladderDone ? 'King of the strip' : `${DIVISIONS[nextOpp.division]} division`}</span>
                <span className="lc-division-steps" aria-hidden="true">
                  {Array.from({ length: PER_DIVISION }, (_, k) => {
                    const i = nextOpp.division * PER_DIVISION + k;
                    return <i key={k} className={i < save.rank ? 'is-done' : i === save.rank ? 'is-next' : ''} data-boss={k === PER_DIVISION - 1 ? '1' : undefined} />;
                  })}
                </span>
              </div>
            </div>
            {nextCar && (
              <button
                className="lc-next-car"
                onClick={() => {
                  go('dealer');
                  setPreviewCar(nextCar.id);
                }}
              >
                <span className="lc-next-car-text">
                  <small className="mono">{save.cash >= nextCar.price ? 'Ready to buy' : 'Next car'}</small>
                  <b>
                    <span aria-hidden="true">{TRAIT_INFO[nextCar.trait].icon}</span> {nextCar.name}
                  </b>
                  <small className="mono">{save.cash >= nextCar.price ? `$${fmtShort(nextCar.price)} at the dealer` : nextSlip && nextSlip.division === nextOpp.division ? `$${fmtShort(nextCar.price)} · or beat ${nextSlip.name}` : `$${fmtShort(nextCar.price - save.cash)} to go`}</small>
                </span>
                <span className="lc-next-car-bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${Math.min(1, save.cash / Math.max(1, nextCar.price)).toFixed(3)})` }} />
                </span>
              </button>
            )}
            <div className="lc-modes">
              <button className="lc-mode" data-tone="cyan" onClick={() => go('daily')}>
                <Icon name="calendar" />
                <span className="lc-mode-text">
                  <b>Daily</b>
                  <small>
                    Showdown #{dailyNumber(today)}
                    {triesLeft > 0 ? ` · ${triesLeft} runs left` : ' · done'}
                    {crateOpen ? '' : ' · crate'}
                  </small>
                </span>
                {!crateOpen && <span className="lc-badge">1</span>}
              </button>
              <button className="lc-mode" data-tone="magenta" onClick={() => setup('gauntlet', null, 1)} disabled={save.rank < GAUNTLET_UNLOCK}>
                <Icon name="crown" />
                <span className="lc-mode-text">
                  <b>King’s Gauntlet</b>
                  <small>{save.rank < GAUNTLET_UNLOCK ? 'Beat the Street final' : save.gauntletBest ? `Best streak ${save.gauntletBest}` : 'Endless streak'}</small>
                </span>
                {save.rank < GAUNTLET_UNLOCK && <Icon name="lock" size={18} className="lc-mode-lock" />}
              </button>
              <button className="lc-mode is-wide" data-tone="lime" onClick={() => void openLive()} disabled={opening}>
                <Icon name="users" />
                <span className="lc-mode-text">
                  <b>Race a friend</b>
                  <small>{opening ? 'Opening a room…' : 'Live, head to head, on their phone'}</small>
                </span>
              </button>
            </div>
            <nav className="lc-rail" aria-label="Garage and shops">
              <button className="lc-tile" onClick={() => go('garage')} aria-label="My garage">
                <Icon name="wrench" />
                <span>Garage</span>
                {PARTS.some((p) => wears(p) && owned.cond[p] < RISKY) && <span className="lc-badge is-warn">!</span>}
              </button>
              <button className="lc-tile" onClick={() => go('parts')} aria-label="Parts shop">
                <Icon name="engine" />
                <span>Parts</span>
                {PARTS.some((p) => owned.levels[p] < MAX_LEVEL && save.cash >= upgradeCost(car, p, owned.levels[p] + 1).cash && hasMats(save.mats, upgradeCost(car, p, owned.levels[p] + 1).mats)) && <span className="lc-badge">↑</span>}
              </button>
              <button className="lc-tile" onClick={() => go('dealer')} aria-label="Dealer">
                <Icon name="car" />
                <span>Dealer</span>
              </button>
              <button className="lc-tile" onClick={() => go('ladder')} aria-label="Ladder">
                <Icon name="trophy" />
                <span>Ladder</span>
              </button>
            </nav>
            <button className="lc-go" autoFocus onClick={() => go('rivals')}>
              <b className="lc-go-label">Race</b>
              <span className="lc-go-sub">{ladderDone ? 'King of the strip · rematch anyone' : `Next: ${nextOpp.name} · ${DIVISIONS[nextOpp.division]}`}</span>
              {!ladderDone && (
                <span className="lc-go-diff" data-tone={nextDiff.tone}>
                  {nextDiff.label}
                </span>
              )}
              <Icon name="play" size={26} className="lc-go-arrow" />
            </button>
          </div>
        )}

        {screen === 'setup' && plan && (
          <Panel
            eyebrow={plan.mode === 'daily' ? `Today’s Showdown #${dailyNumber(today)}` : plan.mode === 'challenge' ? 'Friends’ challenge' : plan.mode === 'gauntlet' ? `King’s Gauntlet · round ${plan.round ?? 1}` : plan.mode === 'test' ? 'Free test drive' : plan.rival?.boss ? 'Division final · pink slip' : 'Head to head'}
            title={plan.mode === 'daily' ? 'Same car, same opponent, for everyone' : plan.mode === 'challenge' ? 'Beat the fastest ghost' : `vs ${plan.race.names[1] ?? 'rival'}`}
            className="lc-setup"
            onBack={challenge ? undefined : () => {
              if (plan.mode === 'gauntlet') endGauntlet();
              if (plan.mode === 'test') {
                go('dealer');
                setPreviewCar(plan.me.def.id);
                return;
              }
              go(plan.mode === 'daily' ? 'daily' : plan.mode === 'gauntlet' ? 'hub' : 'rivals');
            }}
          >
            <div className="lc-versus">
              <div className="lc-vcard is-you">
                <span className="lc-pic">
                  <CarThumb look={plan.race.looks[0]!} />
                  <DriverFace helmet={plan.race.looks[0]!.helmet} suit={plan.race.looks[0]!.suit} size={42} badge />
                </span>
                <b>{me}</b>
                <span className="mono">
                  {plan.me.def.name} · ~{fmtEt(plan.forecast.myEt)} s
                </span>
                <TraitBadge trait={plan.me.def.trait} />
              </div>
              <span className="lc-versus-mark" aria-label="versus">
                VS
              </span>
              <div className="lc-vcard is-rival">
                <span className="lc-pic">
                  <CarThumb look={plan.race.looks[1] ?? plan.race.looks[0]!} />
                  <DriverFace helmet={(plan.race.looks[1] ?? plan.race.looks[0]!).helmet} suit={(plan.race.looks[1] ?? plan.race.looks[0]!).suit} size={42} badge />
                </span>
                <b>{plan.race.names[1]}</b>
                <span className="mono">
                  {plan.race.specs[1]?.def.name}
                  {plan.race.drivers[1]?.kind === 'script' ? ' · ghost' : plan.forecast.etList[0] !== undefined ? ` · ~${fmtEt(plan.forecast.etList[0])} s` : ''}
                </span>
                {plan.race.specs[1] && <TraitBadge trait={plan.race.specs[1].def.trait} />}
              </div>
            </div>
            {plan.rival?.boss && (
              <p className="lc-slip-note">
                <Sticker tone="magenta" flat>
                  Pink slip
                </Sticker>
                <span>{save.rank === plan.rival.rank - 1 ? (save.cars[plan.rival.car] ? `Beat ${plan.rival.name} and their ${getCar(plan.rival.car).name} is sold on for you: +$${fmtCash(pinkSlipCash(getCar(plan.rival.car)))}.` : `Beat ${plan.rival.name} and their ${getCar(plan.rival.car).name} is yours, tuning and all.`) : 'You already won this one.'}</span>
              </p>
            )}
            {plan.mode === 'test' && <p className="lc-sub">The car as it leaves the factory, against a car like it. No prize, no wear, one a day.</p>}
            {plan.mode === 'gauntlet' && (
              <p className="lc-sub">
                {(plan.round ?? 1) === 1 ? 'Win and the next opponent is quicker. Lose once and the run is over: your streak goes on the leaderboard.' : `Streak ${(plan.round ?? 1) - 1}. Every round the opponent gets quicker.`}
              </p>
            )}
            {plan.carId && <WornWarning cond={owned.cond} />}
            {plan.rival && (
              <div className="lc-wager">
                <div className="lc-wager-odds">
                  <span className="lc-eyebrow mono">Your odds of winning</span>
                  <b className="mono">{Math.round(plan.forecast.pWin * 100)}%</b>
                  <span>
                    A win pays <b>{plan.forecast.mult}×</b> your stake plus the <Cash n={plan.rival.purse} /> purse. Lose and the stake is gone (second still gets a small consolation).
                  </span>
                </div>
                <div className="lc-stakes" role="radiogroup" aria-label="Stake">
                  {STAKE_SHARES.map((sh) => {
                    const amt = Math.floor(save.cash * sh);
                    return (
                      <button key={sh} role="radio" aria-checked={plan.stake === amt} className={`lc-stake${plan.stake === amt ? ' is-on' : ''}`} onClick={() => setPlan({ ...plan, stake: amt })} disabled={save.cash === 0 && sh > 0}>
                        <b>{sh === 0 ? 'No bet' : sh === 1 ? 'All in' : `${sh * 100}%`}</b>
                        {sh > 0 && <small className="mono">${fmtShort(amt)}</small>}
                      </button>
                    );
                  })}
                </div>
                <p className="lc-foot mono">
                  Stake ${fmtCash(plan.stake)} → ${fmtCash(Math.round(plan.stake * plan.forecast.mult))} back on a win
                </p>
              </div>
            )}
            <button className="btn btn-lg lc-cta" autoFocus onClick={() => startRace(plan)}>
              {plan.mode === 'daily' ? `Run (${triesLeft} left)` : plan.mode === 'gauntlet' ? `Race round ${plan.round ?? 1}` : plan.mode === 'test' ? 'Start the test drive' : 'Confirm race'}
            </button>
          </Panel>
        )}

        {screen === 'result' && outcome && (
          <ResultScreen
            o={outcome}
            me={me}
            today={today}
            challenge={challenge}
            save={save}
            triesLeft={triesLeft}
            onAgain={() => {
              if (outcome.plan.mode === 'test') {
                go('dealer');
                setPreviewCar(outcome.plan.me.def.id);
                return;
              }
              if (outcome.plan.mode === 'daily') setup('daily', null);
              else if (outcome.gauntlet) setup('gauntlet', null, outcome.gauntlet.over ? 1 : outcome.gauntlet.round + 1);
              else setup(outcome.rankUp ? 'ladder' : outcome.plan.mode, outcome.rankUp ? null : outcome.plan.rival);
            }}
            onClaim={claimSlip}
            onGarage={() => {
              endGauntlet();
              go('garage');
            }}
            onMenu={() => {
              endGauntlet();
              go('hub');
            }}
          />
        )}

        {screen === 'daily' && (
          <Panel eyebrow="Every day" title="Daily" onBack={() => go('hub')}>
            <div className="lc-daily">
              <div className="lc-daily-card lc-panel-inner">
                <span className="lc-eyebrow mono">Today’s Showdown #{dailyNumber(today)}</span>
                <div className="lc-daily-row">
                  <CarThumb look={{ ...lookOf(save, loaner.car, loaner.levels), paint: DEFAULTS.paint }} className="lc-daily-thumb" />
                  <div>
                    <b>{loaner.car.name}</b>
                    <span className="lc-sub">The same loaner and the same opponent for everyone today. Three runs, best counts.</span>
                    <span className="mono lc-sub">vs {loaner.bots.map((b) => b.name).join(', ')}</span>
                  </div>
                </div>
                <div className="lc-daily-foot">
                  <span className="mono">{dailyRec?.best ? `Best today: ${fmtCash(dailyRec.best)}${dailyRec.et ? ` · ${fmtEt(dailyRec.et / 1000)} s` : ''}` : 'No run yet'}</span>
                  {triesLeft > 0 ? (
                    <button className="btn btn-sm lc-cta" onClick={() => setup('daily', null)}>
                      Run ({triesLeft} left)
                    </button>
                  ) : (
                    <span className="lc-sub">
                      <NextDaily />
                    </span>
                  )}
                </div>
              </div>
              <div className="lc-daily-card lc-panel-inner">
                <span className="lc-eyebrow mono">Daily crate</span>
                <div className="lc-daily-row">
                  <span className={`lc-crate${crateOpen ? ' is-open' : ''}`} aria-hidden="true">
                    <Icon name={crateOpen ? 'check' : 'gift'} size={34} />
                  </span>
                  <div>
                    <b>{crateOpen ? 'Opened today' : 'A free crate is waiting'}</b>
                    <span className="lc-sub">Cash and materials, more the higher you climb.</span>
                  </div>
                </div>
                <div className="lc-daily-foot">
                  {crateOpen ? (
                    <span className="lc-sub">
                      <NextDaily />
                    </span>
                  ) : (
                    <button className="btn btn-sm lc-cta" onClick={openCrate}>
                      Open crate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {screen === 'ladder' && (
          <Panel eyebrow={`${save.rank} of ${LADDER.length} beaten`} title="The ladder" onBack={() => go('hub')}>
            <p className="lc-foot mono">
              {save.wins} wins · {save.runs} races · best ¼ mile {save.bestEt ? `${fmtEt(save.bestEt / 1000)} s` : '–'} · sponsor ${fmtCash(idleRate(save.rank, effectsOf(owned.levels, owned.cond).sponsorMul))}/h while you’re away
            </p>
            <ol className="lc-ladder">
              {LADDER.map((o, i) => {
                const beaten = i < save.rank;
                const next = i === save.rank;
                return (
                  <li key={o.rank} className={`lc-opp${beaten ? ' is-beaten' : ''}${next ? ' is-next' : ''}${o.boss ? ' is-boss' : ''}`}>
                    {i % PER_DIVISION === 0 && <h3 className="lc-division mono">{DIVISIONS[o.division]} division</h3>}
                    <div className="lc-opp-row">
                      <span className="lc-rank mono">{beaten ? <Icon name="check" size={16} /> : o.rank}</span>
                      <DriverFace {...botDriver(o.name)} size={40} badge />
                      <div>
                        <b>
                          {o.name}
                          {o.boss && <Icon name="crown" size={15} className="lc-boss" />}
                        </b>
                        <span className="mono">
                          {getCar(rivalCarId(o, save.car)).name} · purse ${fmtCash(o.purse)}
                        </span>
                      </div>
                      {(beaten || next) && (
                        <button className={`btn btn-sm${next ? ' lc-cta' : ''}`} onClick={() => setup(next ? 'ladder' : 'rematch', o)}>
                          {next ? 'Race' : 'Rematch'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}

        {screen === 'help' && (
          <Panel eyebrow="One button" title="How to race" onBack={() => go('hub')}>
            <ol className="lc-help">
              <li>
                <b>The start.</b> Both cars burn out and stage. Then the start lights, as in Formula 1: five reds come on one a second, and with all five lit they go out after anything from no wait to three seconds. Launch the moment they go out; tap while they’re on and it’s a jump start.
              </li>
              <li>
                <b>Shift.</b> Every gear has its own green zone on the tach ring, and it moves after each shift. Tap (or press Space) while the needle is in the green for a <i>perfect</i> shift and a kick of speed. Yellow is fine, red is slow, and early bogs the car.
              </li>
              <li>
                <b>Every car is different.</b> Each has one trait. Turbos hit late, big torque pulls hard and spins easily, rev monsters kick harder on a perfect shift, featherweights snap through one, police cars forgive a slow start and all-wheel drive never spins. An electric has no gears: tap <i>Boost</i> each time its charge meter peaks. Cars with nitrous get one shot a run: from second gear on, hold the button down to fire it.
              </li>
              <li>
                <b>Pink slips.</b> Every division final is raced for the boss’s car. Beat a boss the first time and the car is yours, tuning and all. The dealer gives you one free test drive a day in any car you don’t own yet.
              </li>
              <li>
                <b>Head to head.</b> Every race is you against one rival. Win and you take the purse and the wager; second pays a small consolation.
              </li>
              <li>
                <b>King’s Gauntlet.</b> After the Street final: back-to-back races, each opponent quicker than the last. One loss ends the run; the streak goes on the leaderboard.
              </li>
              <li>
                <b>Garage.</b> Six separate parts, eight levels each. Every level moves several numbers (a bigger engine is also heavier and a touch less reliable). Tyres wear with use and need replacing; under {RISKY}% they can blow out mid-run. Nothing else wears.
              </li>
              <li>
                <b>Money.</b> Purses, wagers, the daily crate and your sponsor (paid by the hour while you’re away) are the only money there is. Nothing here is ever bought with real money.
              </li>
            </ol>
            <button className="btn lc-cta" onClick={() => go('hub')}>
              Got it
            </button>
          </Panel>
        )}
      </main>
      {screen === 'live' && liveCode && <LiveRoom code={liveCode} name={playerName || 'Racer'} env={save.env} owned={Object.keys(save.cars)} carFor={liveCarFor} defaultCar={save.car} stageRef={stageRef} sfx={sfx} onRacing={setLiveRacing} onLeave={leaveLive} />}
      {screen === 'rivals' && <RivalsSheet save={save} mySheet={mySheet} mySpec={mySpec} sel={rivalIdx} setPick={setRivalPick} onBack={() => go('hub')} onRace={(o, mode) => setup(mode, o)} viewRef={setViewEl} right={cashPill} />}

      {screen === 'parts' && (
        <Popup
          eyebrow={`Parts shop · ${car.name}`}
          title={PART_INFO[partTab].name}
          onBack={() => go('hub')}
          viewRef={setViewEl}
          className={`lc-parts-sheet${inspect ? ' is-inspect' : ''}`}
          right={
            <>
              {cashPill}
              <MatsPill mats={save.mats} />
            </>
          }
          tabs={
            <div className="lc-ptabs" role="tablist" aria-label="Parts">
              {PARTS.map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={partTab === p}
                  className={`lc-ptab${partTab === p ? ' is-on' : ''}${wears(p) && owned.cond[p] < RISKY ? ' is-worn' : ''}`}
                  onClick={() => {
                    sfx().click();
                    setPartTab(p);
                    setPreviewNext(false);
                    if (inspect) setInspect(p);
                  }}
                >
                  <Icon name={PART_ICON[p]} />
                  <b>{PART_INFO[p].name}</b>
                  <small className="mono">Lv {owned.levels[p]}</small>
                </button>
              ))}
            </div>
          }
        >
          {Object.keys(save.cars).length > 1 && (
            <div className="lc-chips" role="tablist" aria-label="Your cars">
              {Object.keys(save.cars).map((id) => (
                <button key={id} className={`lc-chip${id === save.car ? ' is-on' : ''}`} onClick={() => commit((x) => ({ ...x, car: id }))}>
                  {getCar(id).name}
                </button>
              ))}
            </div>
          )}
          <PartPanel part={partTab} car={car} levels={owned.levels} cond={owned.cond} save={save} preview={previewNext} setPreview={setPreviewNext} onBuy={() => buyUpgrade(partTab)} onInspect={() => setInspect(partTab)} />
          <StatSheet sheet={mySheet} def={car} />
        </Popup>
      )}

      {screen === 'garage' && (
        <Popup
          eyebrow={`My garage · ${TIER_NAME[car.tier]}`}
          title={car.name}
          onBack={() => go('hub')}
          viewRef={setViewEl}
          className={inspect ? 'is-inspect' : ''}
          right={cashPill}
          tabs={
            <div className="lc-tabs" role="tablist">
              {(['repairs', 'style'] as GarageTab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={garageTab === t}
                  className={`lc-tab${garageTab === t ? ' is-on' : ''}`}
                  onClick={() => {
                    setGarageTab(t);
                    setStyleTry(null);
                  }}
                >
                  {t === 'repairs' ? 'Tyres' : 'Style'}
                </button>
              ))}
              <button className="lc-tab" onClick={() => go('parts')}>
                Upgrades <Icon name="next" size={16} />
              </button>
            </div>
          }
        >
          {Object.keys(save.cars).length > 1 && (
            <div className="lc-chips" role="tablist" aria-label="Your cars">
              {Object.keys(save.cars).map((id) => (
                <button key={id} className={`lc-chip${id === save.car ? ' is-on' : ''}`} onClick={() => commit((x) => ({ ...x, car: id }))}>
                  {getCar(id).name}
                </button>
              ))}
            </div>
          )}
          {garageTab === 'repairs' && (
            <div className="lc-repairs">
              <p className="lc-sub">Tyres wear with every race, more when they spin. Under {RISKY}% they can blow out mid-run; new tyres never do. Nothing else wears.</p>
              <ul className="lc-parts lc-parts-compact">
                {PARTS.filter(wears).map((p) => {
                  const cond = owned.cond[p];
                  const fix = repairCost(car, p, cond);
                  return (
                    <li key={p} className={`lc-part${cond < RISKY ? ' is-worn' : ''}`}>
                      <div className="lc-part-top">
                        <span className="lc-part-icon" aria-hidden="true">
                          <Icon name={PART_ICON[p]} />
                        </span>
                        <div className="lc-part-name">
                          <b>{PART_INFO[p].name}</b>
                          <span className="mono">
                            Lv {owned.levels[p]} · {cond < RISKY ? 'could blow' : cond < 60 ? 'worn' : cond < 100 ? 'fine' : 'like new'}
                          </span>
                        </div>
                        <span className="lc-ring mono" data-tone={cond < RISKY ? 'bad' : cond < 60 ? 'mid' : 'good'} style={{ '--p': `${cond}%` } as CSSProperties} aria-label={`${Math.round(cond)}% condition`}>
                          {Math.round(cond)}
                        </span>
                      </div>
                      <div className="lc-part-actions">
                        <button className="btn btn-sm" onClick={() => setInspect(p)} aria-label={`Inspect the ${PART_INFO[p].name.toLowerCase()}`}>
                          <Icon name="eye" size={16} />
                          Inspect
                        </button>
                        <button className={`btn btn-sm${cond < 100 && save.cash >= fix ? ' lc-cta' : ''}`} onClick={() => repair(p)} disabled={cond >= 100 || save.cash < fix}>
                          {cond >= 100 ? 'Like new' : fix <= 0 ? 'New tyres · free' : <>New tyres <Cash n={fix} /></>}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {garageTab === 'style' && <StyleShop save={save} kind={styleKind} setKind={setStyleKind} onPick={buyOrEquip} trying={styleTry} onTry={setStyleTry} />}
        </Popup>
      )}

      {screen === 'dealer' && (
        <Popup
          eyebrow={`${Object.keys(save.cars).length} of ${CARS.length} collected`}
          title="Dealer"
          onBack={() => go('hub')}
          viewRef={setViewEl}
          right={cashPill}
          tabs={
            <div className="lc-chips" role="tablist" aria-label="Tier">
              {[-1, 0, 1, 2, 3, 4, 5, 6].map((t) => (
                <button key={t} role="tab" aria-selected={dealerTier === t} className={`lc-chip${dealerTier === t ? ' is-on' : ''}`} onClick={() => setDealerTier(t)}>
                  {t === -1 ? 'Collection' : t === 0 ? 'All' : TIER_NAME[t as CarDef['tier']]}
                </button>
              ))}
            </div>
          }
        >
          {(() => {
            const shown = previewCar ? getCar(previewCar) : car;
            const sh = sheetOf(shown, newCar().levels, newCar().cond);
            const mine = !!save.cars[shown.id];
            return (
              <div className="lc-dealer-hero lc-panel-inner">
                <div>
                  <span className="lc-eyebrow mono">
                    {shown.maker} {shown.year} · {shown.kind} · {TIER_NAME[shown.tier]}
                  </span>
                  <b className="lc-dealer-name">{shown.name}</b>
                  <span className="mono lc-sub">
                    {shown.hp} hp · {shown.mass} kg · {shown.drive.toUpperCase()} · {shown.gears === 1 ? 'single speed' : `${shown.gears} gears`} · ¼ mi ~{fmtEt(sh.et)} s
                  </span>
                  <TraitBadge trait={shown.trait} full />
                </div>
                <div className="lc-dealer-buttons">
                  <button className={`btn${mine ? '' : save.cash >= shown.price ? ' lc-cta' : ''}`} onClick={() => buyCar(shown)} disabled={(!mine && save.cash < shown.price) || shown.id === save.car}>
                    {mine ? (shown.id === save.car ? 'Your car' : 'Drive this one') : <>Buy <Cash n={shown.price} /></>}
                  </button>
                  {!mine && (
                    <button className="btn btn-sm" onClick={() => setup('test', null, 1, shown.id)} disabled={save.testDay === today} title={save.testDay === today ? 'One free test drive a day: come back tomorrow' : undefined}>
                      {save.testDay === today ? 'Test drive used today' : 'Free test drive'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          {dealerTier === -1 && (
            <ul className="lc-book">
              {BY_PRICE.map((d) => {
                const mine = !!save.cars[d.id];
                const slip = PINK_SLIP[d.id];
                return (
                  <li key={d.id} className={`${mine ? 'is-owned' : ''}${(previewCar ?? save.car) === d.id ? ' is-sel' : ''}`}>
                    <button onClick={() => setPreviewCar(d.id)} aria-label={`${d.name}${mine ? ', collected' : ''}`}>
                      <CarThumb look={lookOf(save, d)} />
                      <b>{d.name}</b>
                      <small className="mono">{mine ? `${TRAIT_INFO[d.trait].icon} ${TRAIT_INFO[d.trait].name}` : slip ? `Pink slip: beat ${slip.name}` : `$${fmtShort(d.price)}`}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="lc-cars" hidden={dealerTier === -1}>
            {BY_PRICE.filter((d) => dealerTier <= 0 || d.tier === dealerTier).map((d) => {
              const mine = !!save.cars[d.id];
              const sh = sheetOf(d, newCar().levels, newCar().cond);
              const sel = (previewCar ?? save.car) === d.id;
              return (
                <li key={d.id} className={`lc-car${mine ? ' is-owned' : ''}${d.id === save.car ? ' is-on' : ''}${sel ? ' is-sel' : ''}`}>
                  <button className="lc-car-pick" onClick={() => setPreviewCar(d.id)} aria-label={`Preview ${d.name}`}>
                    <CarThumb look={lookOf(save, d)} />
                  </button>
                  <div className="lc-car-info">
                    <span className="lc-eyebrow mono">
                      {d.maker} {d.year} · {d.kind}
                    </span>
                    <b>{d.name}</b>
                    <span className="lc-car-nums mono">
                      {d.hp} hp · {d.mass} kg · {d.drive.toUpperCase()} · ¼ mi ~{fmtEt(sh.et)} s
                    </span>
                    <TraitBadge trait={d.trait} />
                    <p className="lc-blurb">{d.blurb}</p>
                    {!mine && PINK_SLIP[d.id] && <p className="lc-blurb lc-slip-line">Or win it: beat {PINK_SLIP[d.id]!.name}, the {DIVISIONS[PINK_SLIP[d.id]!.division]} final.</p>}
                  </div>
                  <div className="lc-car-side">
                    <Sticker tone={['lime', 'cyan', 'yellow', 'orange', 'coral', 'magenta'][d.tier - 1]} flat>
                      {TIER_NAME[d.tier]}
                    </Sticker>
                    <button className={`btn btn-sm${mine ? '' : save.cash >= d.price ? ' lc-cta' : ''}`} onClick={() => buyCar(d)} disabled={!mine && save.cash < d.price}>
                      {mine ? (d.id === save.car ? 'Selected' : 'Select') : <>Buy <Cash n={d.price} /></>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Popup>
      )}
        </>
      )}
    </div>
  );
}

// ---- screens and pieces

/**
 * A new car's moment: the garage door rolls up on it (the car itself is the hub's showcase behind),
 * then its name, its trait and what it does.
 */
function CarReveal({ def, owned, slip, onDone }: { def: CarDef; owned?: OwnedCar; slip: boolean; onDone: () => void }) {
  const sh = sheetOf(def, owned?.levels ?? stockLevels(), owned?.cond ?? freshCondition());
  const t = TRAIT_INFO[def.trait];
  return (
    <div className="lc-reveal" role="dialog" aria-label={`New car: ${def.name}`}>
      <div className="lc-reveal-door" aria-hidden="true" />
      <div className="lc-reveal-top">
        <Sticker tone={slip ? 'magenta' : 'lime'}>{slip ? 'Won on a pink slip' : 'New car'}</Sticker>
        <span className="lc-eyebrow mono">
          {def.maker} {def.year} · {def.kind} · {TIER_NAME[def.tier]}
        </span>
        <h2 className="lc-reveal-name">{def.name}</h2>
      </div>
      <div className="lc-reveal-card">
        <div className="lc-reveal-trait">
          <span className="lc-reveal-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span>
            <b>{t.name}</b>
            <small>{t.blurb}</small>
          </span>
        </div>
        <div className="lc-reveal-stats">
          <StatBar label="Power" value={sh.hp} max={2600} text={`${sh.hp} hp`} tone="coral" />
          <StatBar label="Weight" value={2600 - sh.mass} max={2200} text={`${sh.mass} kg`} tone="cyan" />
          <StatBar label="¼ mile" value={16 - sh.et} max={11} text={`${fmtEt(sh.et)} s`} tone="lime" />
        </div>
        <button className="btn btn-lg lc-cta" autoFocus onClick={onDone}>
          Let’s race
        </button>
      </div>
    </div>
  );
}

function WornWarning({ cond }: { cond: Condition }) {
  const worn = PARTS.filter((p) => wears(p) && cond[p] < RISKY);
  if (!worn.length) return null;
  return (
    <p className="lc-warn" role="status">
      <Icon name="warn" size={18} />
      <span>
        {worn.map((p) => PART_INFO[p].name).join(', ')} under {RISKY}%: could blow out mid-race. Fit new ones in the garage.
      </span>
    </p>
  );
}

function StatSheet({ sheet, def }: { sheet: Sheet; def: CarDef }) {
  return (
    <div className="lc-sheet">
      <StatBar label="Power" value={Math.log(sheet.hp / 50)} max={Math.log(80)} text={`${sheet.hp} hp`} tone="coral" />
      <StatBar label="Torque" value={Math.log(sheet.torque / 80)} max={Math.log(60)} text={`${sheet.torque} Nm`} tone="orange" />
      <StatBar label="Weight" value={2500 - sheet.mass} max={1900} text={`${sheet.mass} kg`} tone="cyan" />
      <StatBar label="Grip" value={sheet.grip - 0.7} max={2.6} text={`${sheet.grip.toFixed(2)}`} tone="lime" />
      <StatBar label="Shift" value={500 - sheet.shiftMs} max={400} text={`${sheet.shiftMs} ms`} tone="yellow" />
      <StatBar label="Reliability" value={sheet.reliability} max={100} text={`${sheet.reliability}%`} tone="magenta" />
      <div className="lc-sheet-times mono">
        <span>
          0–100 <b>{sheet.t100 > 0 ? `${sheet.t100.toFixed(1)} s` : '–'}</b>
        </span>
        <span>
          ¼ mile <b>{fmtEt(sheet.et)} s</b>
        </span>
        <span>
          Trap <b>{Math.round(sheet.trap)} km/h</b>
        </span>
        <span>
          {def.drive.toUpperCase()} <b>{def.gears === 1 ? '1 speed' : `${def.gears} gears`}</b>
        </span>
      </div>
    </div>
  );
}

function RivalsSheet({ save, mySheet, mySpec, sel, setPick, onBack, onRace, viewRef, right }: { save: Save; mySheet: Sheet; mySpec: CarSpec; sel: number; setPick: (i: number) => void; onBack: () => void; onRace: (o: Opponent, mode: Mode) => void; viewRef: (el: HTMLDivElement | null) => void; right: ReactNode }) {
  // the rivals around you: a few you have beaten (rematches), the next one, and a few locked ahead
  const lo = Math.max(0, Math.min(save.rank - 3, LADDER.length - 8));
  const list = LADDER.slice(lo, Math.min(LADDER.length, lo + 8));
  const o = LADDER[sel]!;
  const oSpec = botSpec(rivalBot(o, save.car));
  const run = forecastRun(oSpec, o.skill, 7);
  const diff = rivalDifficulty(o, mySpec);
  const beaten = sel < save.rank;
  const next = sel === save.rank;
  const oSheet = sheetOf(getCar(rivalCarId(o, save.car)), o.levels, newCar().cond);
  return (
    <Popup eyebrow={`${DIVISIONS[o.division]} division · ${save.rank}/${LADDER.length} beaten`} title="Pick your rival" onBack={onBack} viewRef={viewRef} right={right} className="lc-rivals-sheet">
      <div className="lc-rgrid" role="listbox" aria-label="Rivals">
        {list.map((r, k) => {
          const i = lo + k;
          const locked = i > save.rank;
          const d = rivalDifficulty(r, mySpec);
          const on = i === sel;
          return (
            <button key={r.rank} role="option" aria-selected={on} className={`lc-rcard${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}${i < save.rank ? ' is-beaten' : ''}`} onClick={() => !locked && setPick(i)} disabled={locked}>
              <span className="lc-rcard-rank mono">#{r.rank}</span>
              {on && <span className="lc-rcard-sel mono">Selected</span>}
              <CarThumb look={lookOf(emptySave(), getCar(rivalCarId(r, save.car)), r.levels)} />
              <b className="lc-rcard-name">
                {r.boss && <Icon name="crown" size={15} className="lc-boss" />}
                {r.name}
              </b>
              <span className="lc-rcard-car mono">{getCar(rivalCarId(r, save.car)).name}</span>
              <span className="lc-rcard-foot" data-tone={locked ? 'locked' : d.tone}>
                {locked ? (
                  <>
                    <Icon name="lock" size={13} /> Beat #{r.rank - 1} first
                  </>
                ) : i < save.rank ? (
                  <>
                    <Icon name="check" size={13} /> Beaten · {d.label}
                  </>
                ) : (
                  d.label
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="lc-rival-detail lc-panel-inner">
        <div className="lc-rival-head">
          <DriverFace {...botDriver(o.name)} size={52} badge />
          <div className="lc-rival-who">
            <b>
              {o.boss && <Icon name="crown" size={16} className="lc-boss" />}
              {o.name} · #{o.rank}
            </b>
            <span className="lc-sub">{o.blurb}</span>
          </div>
          <Sticker tone={diff.tone}>{diff.label}</Sticker>
        </div>
        <div className="lc-compare mono">
          <span>Their run</span>
          <b>~{fmtEt(run.et)} s</b>
          <i>yours ~{fmtEt(mySheet.et)} s</i>
          <span>Car</span>
          <b>{getCar(rivalCarId(o, save.car)).name}</b>
          <i>you {getCar(save.car).name}</i>
          <span>Power</span>
          <b>{oSheet.hp} hp</b>
          <i>you {mySheet.hp} hp</i>
          <span>Weight</span>
          <b>{oSheet.mass} kg</b>
          <i>you {mySheet.mass} kg</i>
          <span>Purse</span>
          <b>${fmtCash(o.purse)}</b>
          <i>{next ? 'first win ×3' : 'rematch'}</i>
        </div>
        <p className="lc-foot mono">Head to head: the winner takes the purse, second gets a small consolation.</p>
      </div>
      <button className="btn btn-lg lc-cta lc-modal-cta" onClick={() => onRace(o, next ? 'ladder' : 'rematch')} disabled={!beaten && !next}>
        {next ? `Race ${o.name}` : `Rematch ${o.name}`}
      </button>
    </Popup>
  );
}

/** A part's eight levels as a track; the levels that change the car's look are marked. */
function LevelTrack({ level, marks }: { level: number; marks: number[] }) {
  return (
    <span className="lc-ltrack" role="img" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <i key={i} className={i < level ? 'is-on' : i === level ? 'is-next' : ''} data-mark={marks.includes(i + 1) ? '1' : undefined} />
      ))}
    </span>
  );
}

/**
 * The caption over the 3D view while a part is inspected: what it is and what shows on the car,
 * with the upgrade (parts shop) or the repair (garage) right there.
 */
function InspectCard({ part, mode, car, levels, cond, save, preview, setPreview, onUpgrade, onRepair, onDone }: { part: PartId; mode: 'upgrade' | 'repair'; car: CarDef; levels: Levels; cond: Condition; save: Save; preview: boolean; setPreview: (on: boolean) => void; onUpgrade: () => void; onRepair: () => void; onDone: () => void }) {
  const info = PART_INFO[part];
  const level = levels[part];
  const maxed = level >= MAX_LEVEL;
  const next = maxed ? null : upgradeCost(car, part, level + 1);
  const can = next ? save.cash >= next.cash && hasMats(save.mats, next.mats) : false;
  const nextLook = PART_VISUALS[part].find(([lv]) => lv > level);
  const fix = repairCost(car, part, cond[part]);
  return (
    <div className="lc-inspect" role="region" aria-label={`Inspecting the ${info.name.toLowerCase()}`}>
      <div className="lc-part-top">
        <span className="lc-part-icon" aria-hidden="true">
          <Icon name={PART_ICON[part]} />
        </span>
        <div className="lc-part-name">
          <b>{info.name}</b>
          <span className="mono">
            Lv {level}/{MAX_LEVEL} · {info.look}
          </span>
        </div>
        <button className="btn btn-sm" onClick={onDone}>
          Done
        </button>
      </div>
      {mode === 'upgrade' ? (
        <>
          <LevelTrack level={level} marks={PART_VISUALS[part].map(([lv]) => lv)} />
          {nextLook && <p className="lc-sub">Next on the car: {nextLook[1]} (Lv {nextLook[0]})</p>}
          {!maxed && (
            <div className="lc-seg" role="radiogroup" aria-label="Show on the car">
              <button role="radio" aria-checked={!preview} className={`lc-seg-btn${!preview ? ' is-on' : ''}`} onClick={() => setPreview(false)}>
                Now · Lv {level}
              </button>
              <button role="radio" aria-checked={preview} className={`lc-seg-btn${preview ? ' is-on' : ''}`} onClick={() => setPreview(true)}>
                Lv {level + 1}
              </button>
            </div>
          )}
          {next ? (
            <button className={`btn lc-upgrade${can ? ' lc-cta' : ''}`} onClick={onUpgrade} disabled={!can}>
              <span>Upgrade to Lv {level + 1}</span>
              <Cash n={next.cash} />
              <MatsLine mats={next.mats} have={save.mats} />
            </button>
          ) : (
            <Sticker tone="lime" flat>
              Maxed
            </Sticker>
          )}
        </>
      ) : (
        wears(part) ? (
          <>
            <div className="lc-cond">
              <span className="lc-cond-bar">
                <i style={{ width: `${cond[part]}%` }} className={cond[part] < RISKY ? 'is-bad' : cond[part] < 60 ? 'is-mid' : ''} />
              </span>
              <span className="mono">{Math.round(cond[part])}% condition</span>
            </div>
            <button className={`btn lc-upgrade${cond[part] < 100 && save.cash >= fix ? ' lc-cta' : ''}`} onClick={onRepair} disabled={cond[part] >= 100 || save.cash < fix}>
              {cond[part] >= 100 ? 'Like new' : fix <= 0 ? 'New tyres · free' : <>New tyres <Cash n={fix} /></>}
            </button>
          </>
        ) : (
          <Sticker tone="lime" flat>
            Never wears
          </Sticker>
        )
      )}
    </div>
  );
}

/** One part in the parts shop: what it does now and at the next level, what you see on the car, and the buy button. */
function PartPanel({ part, car, levels, cond, save, preview, setPreview, onBuy, onInspect }: { part: PartId; car: CarDef; levels: Levels; cond: Condition; save: Save; preview: boolean; setPreview: (on: boolean) => void; onBuy: () => void; onInspect: () => void }) {
  const info = PART_INFO[part];
  const level = levels[part];
  const maxed = level >= MAX_LEVEL;
  const next = maxed ? null : upgradeCost(car, part, level + 1);
  const can = next ? save.cash >= next.cash && hasMats(save.mats, next.mats) : false;
  const now = sheetOf(car, levels, cond);
  const after = maxed ? now : sheetOf(car, { ...levels, [part]: level + 1 }, { ...cond, [part]: 100 });
  const nextVisual = PART_VISUALS[part].find(([lv]) => lv > level)?.[0];
  const rows: { label: string; a: number; b: number; fmt: (n: number) => string; lowerBetter?: boolean }[] = [
    { label: '¼ mile', a: now.et, b: after.et, fmt: (n) => `${fmtEt(n)} s`, lowerBetter: true },
    { label: 'Power', a: now.hp, b: after.hp, fmt: (n) => `${n} hp` },
    { label: 'Weight', a: now.mass, b: after.mass, fmt: (n) => `${n} kg`, lowerBetter: true },
    { label: 'Grip', a: now.grip, b: after.grip, fmt: (n) => n.toFixed(2) },
    { label: 'Shift', a: now.shiftMs, b: after.shiftMs, fmt: (n) => `${n} ms`, lowerBetter: true },
    { label: 'Reliability', a: now.reliability, b: after.reliability, fmt: (n) => `${n}%` },
    { label: 'Top speed', a: now.trap, b: after.trap, fmt: (n) => `${Math.round(n)} km/h` },
  ];
  return (
    <div className={`lc-part-panel lc-panel-inner${wears(part) && cond[part] < RISKY ? ' is-worn' : ''}`}>
      <div className="lc-part-top">
        <span className="lc-part-icon" aria-hidden="true">
          <Icon name={PART_ICON[part]} />
        </span>
        <div className="lc-part-name">
          <b>{info.name}</b>
          <span className="mono">
            Lv {level}/{MAX_LEVEL}
          </span>
        </div>
        <button className="btn btn-sm" onClick={onInspect}>
          <Icon name="eye" size={16} />
          Inspect
        </button>
      </div>
      <LevelTrack level={level} marks={PART_VISUALS[part].map(([lv]) => lv)} />
      <p className="lc-sub">{info.blurb}</p>
      {wears(part) && (
        <div className="lc-cond">
          <span className="lc-cond-bar">
            <i style={{ width: `${cond[part]}%` }} className={cond[part] < RISKY ? 'is-bad' : cond[part] < 60 ? 'is-mid' : ''} />
          </span>
          <span className="mono">{Math.round(cond[part])}% condition</span>
        </div>
      )}
      {!maxed && (
        <div className="lc-seg" role="radiogroup" aria-label="Show on the car">
          <button role="radio" aria-checked={!preview} className={`lc-seg-btn${!preview ? ' is-on' : ''}`} onClick={() => setPreview(false)}>
            Now · Lv {level}
          </button>
          <button role="radio" aria-checked={preview} className={`lc-seg-btn${preview ? ' is-on' : ''}`} onClick={() => setPreview(true)}>
            Preview Lv {level + 1}
          </button>
        </div>
      )}
      <div className="lc-delta mono" role="table" aria-label="Now and after the upgrade">
        {rows.map((r) => {
          const d = r.b - r.a;
          const better = r.lowerBetter ? d < 0 : d > 0;
          const changed = Math.abs(d) > 1e-6 && r.fmt(r.a) !== r.fmt(r.b);
          return (
            <div key={r.label} role="row" className="lc-delta-row">
              <span role="cell">{r.label}</span>
              <b role="cell">{r.fmt(r.a)}</b>
              <i role="cell" className={changed ? (better ? 'is-good' : 'is-bad') : ''}>{maxed ? '' : changed ? `→ ${r.fmt(r.b)}` : '·'}</i>
            </div>
          );
        })}
      </div>
      <ul className="lc-gains">
        {levelGains(part).map((g) => (
          <li key={g} className={g.startsWith('−') && !g.includes('ms') && !g.includes('drag') && !g.includes('kg') ? 'is-bad' : g.startsWith('+') && g.includes('kg') ? 'is-bad' : ''}>
            {g}
          </li>
        ))}
      </ul>
      <div className="lc-visuals">
        <span className="lc-eyebrow mono">On the car</span>
        {PART_VISUALS[part].length ? (
          <ul>
            {PART_VISUALS[part].map(([lv, text]) => (
              <li key={text} className={level >= lv ? 'is-have' : lv === nextVisual ? 'is-next' : ''}>
                <span className="mono">Lv {lv}</span> {text}
                {level >= lv && <Icon name="check" size={14} className="lc-have" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lc-sub">Nothing you can see: it all happens {part === 'engine' ? 'under the hood' : 'inside the car'}.</p>
        )}
      </div>
      {next ? (
        <button className={`btn lc-upgrade${can ? ' lc-cta' : ''}`} onClick={onBuy} disabled={!can}>
          <span>Upgrade to Lv {level + 1}</span>
          <Cash n={next.cash} />
          <MatsLine mats={next.mats} have={save.mats} />
        </button>
      ) : (
        <Sticker tone="lime" flat>
          Maxed
        </Sticker>
      )}
    </div>
  );
}

function StyleShop({ save, kind, setKind, onPick, trying, onTry }: { save: Save; kind: CosmeticKind; setKind: (k: CosmeticKind) => void; onPick: (c: Cosmetic) => void; trying: string | null; onTry: (id: string | null) => void }) {
  const equipped = (c: Cosmetic): boolean => (c.kind === 'helmet' ? save.helmet === c.id : c.kind === 'suit' ? save.suit === c.id : c.kind === 'env' ? save.env === c.id : (save.cars[save.car]?.[c.kind] ?? DEFAULTS[c.kind]) === c.id);
  return (
    <div className="lc-style">
      <div className="lc-chips" role="tablist">
        {(Object.keys(COSMETICS) as CosmeticKind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={`lc-chip${kind === k ? ' is-on' : ''}`}
            onClick={() => {
              setKind(k);
              onTry(null);
            }}
          >
            {KIND_NAME[k]}
          </button>
        ))}
      </div>
      <ul className="lc-shop">
        {COSMETICS[kind].map((c) => {
          const mine = owns(save, c.id);
          const locked = (c.rank ?? 0) > save.rank;
          const on = equipped(c);
          return (
            <li key={c.id} className={`lc-item${on ? ' is-on' : ''}${trying === c.id ? ' is-try' : ''}`}>
              <button className="lc-item-try" onClick={() => onTry(trying === c.id ? null : c.id)} aria-label={`Try ${c.name} on`} aria-pressed={trying === c.id}>
                <Swatch c={c} save={save} />
              </button>
              <b>{c.name}</b>
              <button className={`btn btn-sm${!mine && !locked && save.cash >= c.price ? ' lc-cta' : ''}`} onClick={() => onPick(c)} disabled={locked || (!mine && save.cash < c.price) || on}>
                {on ? 'Equipped' : mine ? 'Equip' : locked ? (
                  <>
                    <Icon name="lock" size={14} /> Rank {c.rank}
                  </>
                ) : <Cash n={c.price} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Swatch({ c, save }: { c: Cosmetic; save: Save }) {
  const isCar = c.kind === 'paint' || c.kind === 'livery' || c.kind === 'wheels';
  const base = lookOf(save, getCar(save.car));
  const url = useThumb(isCar ? { ...base, [c.kind]: c.id } : base);
  if (isCar) return url ? <img src={url} width={360} height={200} className="lc-swatch" alt="" /> : <span className="lc-swatch is-loading" />;
  if (c.kind === 'env') {
    const e = ENV_DEFS[c.id];
    return <span className="lc-swatch lc-swatch-env" style={{ background: e ? `linear-gradient(${e.sky[0]} 0 55%, ${e.ground} 55% 75%, ${e.track} 75%)` : c.colors[0] }} />;
  }
  return (
    <span className="lc-swatch lc-swatch-face">
      <DriverFace helmet={c.kind === 'helmet' ? [c.colors[0]!, c.colors[1]!] : [getCosmetic(save.helmet)?.colors[0] ?? '#fff', getCosmetic(save.helmet)?.colors[1] ?? '#1d1238']} suit={c.kind === 'suit' ? c.colors[0]! : (getCosmetic(save.suit)?.colors[0] ?? '#1d3557')} size={72} />
    </span>
  );
}

function ResultScreen({ o, me, today, challenge, save, triesLeft, onAgain, onClaim, onGarage, onMenu }: { o: Outcome; me: string; today: string; challenge?: ChallengeSpec; save: Save; triesLeft: number; onAgain: () => void; onClaim: (car: string) => void; onGarage: () => void; onMenu: () => void }) {
  const mine = o.result.racers[0]!;
  const p = o.plan;
  const g = o.gauntlet;
  const title = g ? (g.over ? `Streak over: ${g.wins} ${g.wins === 1 ? 'win' : 'wins'}` : `Round ${g.round} won!`) : mine.et === null ? 'Did not finish' : o.won ? (p.rival?.boss && o.rankUp ? 'Division champion!' : 'You won!') : 'Beaten';
  const d = save.daily[today];
  const line = resultLine(o);
  const share = `Launch Control #${dailyNumber(today)} 🏁\n${line}\nBest today: ${fmtCash(d?.best ?? 0)} (${d?.tries ?? 0} ${d?.tries === 1 ? 'run' : 'runs'})\n${window.location.origin}/games/${SLUG}`;
  return (
    <Panel eyebrow={p.mode === 'daily' ? `Today’s Showdown #${dailyNumber(today)}` : p.mode === 'challenge' ? 'Friends’ challenge' : g ? 'King’s Gauntlet' : p.mode === 'test' ? `Test drive · ${p.me.def.name}` : 'Race result'} title={title} className={`lc-result${o.won ? ' is-win' : ''}`}>
      {o.pinkSlip && (
        <div className="lc-slip">
          <CarThumb look={lookOf(save, getCar(o.pinkSlip.car))} />
          <div>
            <Sticker tone="magenta">Pink slip!</Sticker>
            <b>{o.pinkSlip.owned ? `${getCar(o.pinkSlip.car).name}: sold on` : `${p.race.names[1]} hands you the keys`}</b>
            <span>{o.pinkSlip.owned ? <>You already have one, so the slip goes for <Cash n={o.pinkSlip.cash} />.</> : <>Their {getCar(o.pinkSlip.car).name} is yours, tuning and all.</>}</span>
            {!o.pinkSlip.owned && (
              <button className="btn lc-cta" onClick={() => onClaim(o.pinkSlip!.car)}>
                Drive it now
              </button>
            )}
          </div>
        </div>
      )}
      {p.mode === 'test' && (
        <p className="lc-sub">
          {save.cars[p.me.def.id] ? 'It is yours now.' : save.cash >= p.me.def.price ? <>Like it? It is <Cash n={p.me.def.price} /> at the dealer, and you can afford it.</> : <>Like it? It is <Cash n={p.me.def.price} /> at the dealer.</>}
        </p>
      )}
      {g && (
        <div className="lc-streak">
          <span className="lc-eyebrow mono">Streak</span>
          <b className="mono">{g.wins}</b>
          <span className="mono">run score {fmtCash(g.total)}{save.gauntletBest ? ` · best ${save.gauntletBest}` : ''}</span>
        </div>
      )}
      {mine.failure && (
        <p className="lc-warn">
          <Icon name="warn" size={18} />
          <span>{FAILURE_TEXT[mine.failure]}</span>
        </p>
      )}
      <ol className="lc-order">
        {o.result.order.map((idx, k) => {
          const r = o.result.racers[idx]!;
          const other = o.result.racers[idx === 0 ? 1 : 0];
          // behind by: who crossed the line first decides (the start counts), not the quarter-mile time alone
          const gap = r.crossed !== null && other && other.crossed !== null ? r.crossed - other.crossed : null;
          return (
            <li key={idx} className={`${idx === 0 ? 'is-you' : 'is-rival'}${k === 0 ? ' is-winner' : ''}`}>
              <span className="lc-order-pos">{k === 0 ? <Icon name="trophy" size={18} /> : k + 1}</span>
              <span className="lc-pic lc-order-pic">
                <CarThumb look={p.race.looks[idx]!} className="lc-order-thumb" />
                <DriverFace helmet={p.race.looks[idx]!.helmet} suit={p.race.looks[idx]!.suit} size={30} badge />
              </span>
              <span className="lc-order-name">
                <b>{idx === 0 ? me : p.race.names[idx]}</b>
                <small>{p.race.specs[idx]!.def.name}</small>
              </span>
              <span className="lc-order-et mono">
                {r.et !== null ? `${fmtEt(r.et)} s` : 'DNF'}
                {gap !== null && gap > 0 && <small>+{gap.toFixed(3)}</small>}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="lc-times mono">
        <div>
          <span>¼ mile</span>
          <b>{mine.et !== null ? `${fmtEt(mine.et)} s` : '–'}</b>
        </div>
        <div>
          <span>Trap</span>
          <b>{mine.et !== null ? `${Math.round(mine.trap)} km/h` : '–'}</b>
        </div>
        <div>
          <span>Shifts</span>
          <b>
            {mine.perfect}/{mine.shifts} perfect
          </b>
        </div>
        <div>
          <span>Score</span>
          <b>{fmtCash(o.score)}</b>
        </div>
      </div>
      {o.newBest && <Sticker tone="lime">New best!</Sticker>}
      {(p.mode === 'daily' || p.mode === 'challenge') && <ResultLine line={line} label={`${title}. ${mine.et !== null ? `${fmtEt(mine.et)} seconds` : 'no time'}.`} />}
      {g && g.prize > 0 && (
        <ul className="lc-ledger mono">
          <li>
            <span>Round prize</span>
            <Cash n={g.prize} sign />
          </li>
          {MATERIALS.some((m) => o.mats[m]) && (
            <li>
              <span>Materials</span>
              <MatsLine mats={o.mats} />
            </li>
          )}
        </ul>
      )}
      {p.rival && (
        <ul className="lc-ledger mono">
          <li>
            <span>{o.position === 1 ? 'Purse' : 'Consolation'}</span>
            <Cash n={o.cash.purse} sign />
          </li>
          {p.stake > 0 && (
            <li>
              <span>Wager</span>
              <Cash n={o.cash.wager} sign />
            </li>
          )}
          {o.cash.bonus > 0 && (
            <li>
              <span>First-win bonus</span>
              <Cash n={o.cash.bonus} sign />
            </li>
          )}
          {MATERIALS.some((m) => o.mats[m]) && (
            <li>
              <span>Materials</span>
              <MatsLine mats={o.mats} />
            </li>
          )}
          <li>
            <span>Wear</span>
            <b>
              {PARTS.filter((x) => o.wear[x] > 0)
                .map((x) => `${PART_INFO[x].name} −${Math.round(o.wear[x])}%`)
                .join(', ')}
            </b>
          </li>
        </ul>
      )}
      {o.rankUp && (
        <p className="lc-rankup">
          <Icon name="trophy" size={18} />
          Rank {save.rank} of {LADDER.length}: {save.rank < LADDER.length ? `next up ${LADDER[save.rank]!.name}` : 'you are the King of the strip'}
        </p>
      )}
      <div className="lc-actions">
        {p.mode === 'challenge' && challenge ? (
          <a className="btn btn-lg lc-cta" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="btn btn-lg lc-cta" autoFocus onClick={onAgain} disabled={p.mode === 'daily' && triesLeft <= 0}>
            {p.mode === 'daily' ? (triesLeft > 0 ? `Run again (${triesLeft} left)` : 'No runs left today') : p.mode === 'test' ? 'Back to the dealer' : g ? (g.over ? 'New gauntlet run' : `Next round (${g.round + 1})`) : o.rankUp ? 'Next rival' : 'Race again'}
          </button>
        )}
        {p.mode === 'daily' && <ShareButton text={share} />}
        {p.mode !== 'challenge' && (
          <button className="btn" onClick={onGarage}>
            Garage
          </button>
        )}
        {p.mode !== 'challenge' && (
          <button className="btn" onClick={onMenu}>
            Menu
          </button>
        )}
      </div>
    </Panel>
  );
}

function resultLine(o: Outcome): string {
  const m = o.result.racers[0]!;
  if (m.et === null) return '💥🚗';
  const medal = o.position === 1 ? '🏆' : o.position === 2 ? '🥈' : o.position === 3 ? '🥉' : '🏁';
  const shifts = '🟢'.repeat(m.perfect) + '🟡'.repeat(Math.max(0, m.shifts - m.perfect));
  return `${medal} ${shifts || '⚡'} ${fmtEt(m.et)}s`;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="btn" onClick={() => void shareOrCopy({ title: 'Launch Control', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

