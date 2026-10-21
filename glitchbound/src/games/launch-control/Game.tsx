import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NextDaily } from '../../components/NextDaily';
import { ResultLine } from '../../components/ResultLine';
import { useAccount } from '../../platform/account';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { claimCoins } from '../../platform/coins';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { CARS, getCar, TIER_NAME, type CarDef } from './cars';
import { COSMETICS, DEFAULTS, getCosmetic, KIND_NAME, type Cosmetic, type CosmeticKind } from './cosmetics';
import { addMats, avgLevel, botsFor, botSpec, crateFor, difficultyOf, DIVISIONS, forecast, hasMats, idleIncome, idleRate, LADDER, loanerFor, materialsFor, PER_DIVISION, PLAYER_SKILL, RACE_SIZE, rivalBot, settle, STAKE_SHARES, typicalEt, type Bot, type Forecast, type Opponent } from './economy';
import { ENV_DEFS } from './envs';
import { applyWear, effectsOf, FAILURE_TEXT, levelGains, MATERIAL_INFO, MATERIALS, MAX_LEVEL, PART_INFO, PART_VISUALS, PARTS, raceWear, repairCost, RISKY, upgradeCost, type Condition, type Levels, type Mats, type PartId } from './parts';
import { RaceScreen, type RacePlan } from './RaceScreen';
import { lookKey, Stage3D, type CarLook, type ShowFocus } from './scene3d';
import { decodeScript, encodeScript, forecastRun, scoreOf, specOf, type CarSpec, type Driver, type RaceResult } from './sim';
import { createSfx, type Sfx } from './sound';
import { DAILY_TRIES, emptySave, loadSave, newCar, owns, writeSave, type Save } from './storage';
import { CarThumb, Cash, DriverFace, MatsLine, Panel, Pips, posLabel, Sheet as Popup, StatBar, Sticker, useThumb } from './ui';
import { fmtCash, fmtEt, fmtShort } from './util';
import './Game.css';

const EPOCH = '2026-10-21';
const SLUG = 'launch-control';
type Screen = 'hub' | 'rivals' | 'setup' | 'race' | 'result' | 'garage' | 'parts' | 'dealer' | 'daily' | 'ladder' | 'help';
type Mode = 'ladder' | 'rematch' | 'daily' | 'challenge';
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
}

const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const diffCache = new Map<string, { label: string; tone: string }>();
/** How hard a ladder rival is for a car: their typical run against yours, the same rule everywhere. */
function rivalDifficulty(o: Opponent, me: CarSpec): { label: string; tone: string } {
  const key = `${o.rank}|${me.def.id}|${JSON.stringify(me.levels)}|${Math.round(me.grip * 100)}|${Math.round(me.peakTorque)}`;
  const hit = diffCache.get(key);
  if (hit) return hit;
  const d = difficultyOf(typicalEt(botSpec(rivalBot(o)), o.skill) - typicalEt({ ...me, risky: [] }, PLAYER_SKILL));
  diffCache.set(key, d);
  if (diffCache.size > 400) diffCache.delete(diffCache.keys().next().value!);
  return d;
}
const dailySeed = (day: string): number => hashString(`${SLUG}:${day}`);
const prefersReduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Game({ host, restartKey, pauseKey, challenge, playerName }: GameModuleProps) {
  return <LaunchControl key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />;
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
function botLook(b: Bot): CarLook {
  const h = hashString(b.name) >>> 0;
  const helmets = COSMETICS.helmet;
  const hm = helmets[h % helmets.length]!;
  return { def: b.car, levels: b.levels, paint: BOT_PAINTS[(h >>> 3) % BOT_PAINTS.length]!, livery: (h >>> 7) % 3 === 0 ? 'l-roundel' : DEFAULTS.livery, wheels: (h >>> 9) % 2 ? 'w-classic' : 'w-steel', helmet: [hm.colors[0]!, hm.colors[1]!], suit: COSMETICS.suit[(h >>> 11) % COSMETICS.suit.length]!.colors[0]! };
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

function LaunchControl({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const [screen, setScreen] = useState<Screen>(challenge ? 'setup' : 'hub');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [toast, setToast] = useState('');
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [garageTab, setGarageTab] = useState<GarageTab>('repairs');
  const [styleKind, setStyleKind] = useState<CosmeticKind>('paint');
  const [dealerTier, setDealerTier] = useState(0);
  const [previewCar, setPreviewCar] = useState<string | null>(null);
  const [rivalPick, setRivalPick] = useState<number | null>(null);
  const [partTab, setPartTab] = useState<PartId>('engine');
  /** The parts shop shows the next level of the open part on the car. */
  const [previewNext, setPreviewNext] = useState(false);
  /** A cosmetic tried on in the style shop before buying it. */
  const [styleTry, setStyleTry] = useState<string | null>(null);
  /** The open sheet's 3D view: the shared stage docks over it. */
  const [viewEl, setViewEl] = useState<HTMLDivElement | null>(null);
  const [portrait, setPortrait] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  /** The shared stage; created by the first effect below, so later effects always see the live one. */
  const stageRef = useRef<Stage3D | null>(null);
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const me = playerName || 'You';

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPortrait(el.clientHeight > el.clientWidth));
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

  // ---- building a race
  const setup = useCallback(
    (mode: Mode, rival: Opponent | null): void => {
      const s = saveRef.current;
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
        if (mode === 'challenge') {
          // Friends' ghosts race the same loaner; bots fill the empty lanes.
          const ghosts = (challenge?.replays ?? []).map((r) => ({ name: r.name, script: decodeScript(r.replay) })).filter((g) => g.script).slice(0, RACE_SIZE - 1);
          const specs: CarSpec[] = [meSpec];
          for (const gh of ghosts) {
            specs.push(meSpec);
            drivers.push({ kind: 'script', script: gh.script! });
            names.push(gh.name);
            looks.push({ ...looks[0]!, paint: BOT_PAINTS[((hashString(gh.name) >>> 0) >>> 3) % BOT_PAINTS.length]! });
          }
          const fill = bots.slice(0, RACE_SIZE - 1 - ghosts.length);
          for (const b of fill) {
            specs.push(botSpec(b));
            drivers.push({ kind: 'policy', skill: b.skill, seed: seed ^ hashString(b.name) });
            names.push(b.name);
            looks.push(botLook(b));
          }
          setPlan({ mode, me: meSpec, bots: fill, race: { specs, drivers, looks, names, env, seed }, rival: null, stake: 0, forecast: forecast(meSpec, fill), carId });
          setScreen('setup');
          return;
        }
      } else {
        const c = getCar(s.car);
        const o = s.cars[s.car] ?? newCar();
        meSpec = specOf(c, o.levels, o.cond);
        const opp = rival ?? LADDER[Math.min(s.rank, LADDER.length - 1)]!;
        bots = botsFor(meSpec, RACE_SIZE - 1, seed, opp);
        rival = opp;
        looks.push(lookOf(s, c));
      }
      const specs: CarSpec[] = [meSpec];
      for (const b of bots) {
        specs.push(botSpec(b));
        drivers.push({ kind: 'policy', skill: b.skill, seed: seed ^ hashString(b.name) });
        names.push(b.name);
        looks.push(botLook(b));
      }
      setPlan({ mode, me: meSpec, bots, race: { specs, drivers, looks, names, env, seed }, rival: mode === 'daily' ? null : rival, stake: 0, forecast: forecast(meSpec, bots), carId });
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
    setOutcome(null);
    setPaused(false);
    setConfirmLeave(false);
    sfx().click();
    host.report({ type: 'start' });
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
      let wear = raceWear({ spinTime: mine.spinTime, limiterTime: mine.limiterTime, missedShifts: mine.late + mine.early, dnf: mine.et === null });
      let rankUp = false;
      if (p.mode === 'daily') {
        const d = s0.daily[today] ?? { best: 0, tries: 1, et: 0 };
        const better = score > d.best;
        commit((s) => ({ ...s, runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), daily: { ...s.daily, [today]: { best: Math.max(d.best, score), tries: d.tries, et: better && mine.et !== null ? Math.round(mine.et * 1000) : d.et, open: false } } }));
        host.report({ type: 'end', score, stats, daily: true });
        wear = raceWear({ spinTime: 0, limiterTime: 0, missedShifts: 0, dnf: false });
      } else if (p.mode === 'challenge' && challenge) {
        commit((s) => ({ ...s, runs: s.runs + 1, wins: s.wins + (won ? 1 : 0) }));
        host.report({ type: 'end', score, stats, challenge: { id: challenge.id, round: challenge.round, replay: mine.et !== null ? encodeScript(mine.script) : undefined } });
        wear = raceWear({ spinTime: 0, limiterTime: 0, missedShifts: 0, dnf: false });
      } else {
        const opp = p.rival!;
        const firstWin = won && p.mode === 'ladder' && s0.rank === opp.rank - 1;
        const oc0 = s0.cars[p.carId!] ?? newCar();
        const fans = effectsOf(oc0.levels, oc0.cond).fansMul;
        cash = settle({ position: mine.et === null ? RACE_SIZE : position, purse: opp.purse, fansMul: fans, stake: p.stake, mult: p.forecast.mult, firstWin });
        if (won) mats = materialsFor(opp, firstWin, p.race.seed);
        rankUp = firstWin;
        const back = p.stake + cash.wager;
        commit((s) => {
          const oc = s.cars[p.carId!] ?? newCar();
          return {
            ...s,
            cash: Math.max(0, s.cash + cash.purse + Math.max(0, back) + cash.bonus),
            earned: s.earned + cash.purse + Math.max(0, cash.wager) + cash.bonus,
            mats: addMats(s.mats, mats),
            rank: rankUp ? s.rank + 1 : s.rank,
            runs: s.runs + 1,
            wins: s.wins + (won ? 1 : 0),
            cars: { ...s.cars, [p.carId!]: { ...oc, cond: applyWear(oc.cond, wear) } },
          };
        });
        host.report({ type: 'end', score, stats });
      }
      const newBest = score > s0.bestScore && score > 0;
      if (newBest || (mine.et !== null && (s0.bestEt === 0 || Math.round(mine.et * 1000) < s0.bestEt)))
        commit((s) => ({ ...s, bestScore: Math.max(s.bestScore, score), bestEt: mine.et !== null && (s.bestEt === 0 || Math.round(mine.et * 1000) < s.bestEt) ? Math.round(mine.et * 1000) : s.bestEt }));
      if (cash.purse + cash.wager + cash.bonus > 0) sfx().cash();
      setOutcome({ plan: p, result, position, score, won, cash, mats, wear, rankUp, newBest });
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
  const leaveRace = (): void => {
    if (plan?.mode === 'daily' && !confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    settleOpenDaily();
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
    sfx().cash();
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
  const repairAll = (): void => {
    const s = saveRef.current;
    const oc = s.cars[s.car] ?? newCar();
    const total = PARTS.reduce((n, p) => n + repairCost(getCar(s.car), p, oc.cond[p]), 0);
    if (total <= 0 || s.cash < total) return;
    sfx().cash();
    commit((x) => ({ ...x, cash: x.cash - total, cars: { ...x.cars, [x.car]: { ...oc, cond: newCar().cond } } }));
  };
  const buyCar = (def: CarDef): void => {
    const s = saveRef.current;
    if (s.cars[def.id]) {
      commit((x) => ({ ...x, car: def.id }));
      setPreviewCar(null);
      return;
    }
    if (s.cash < def.price) return;
    sfx().cash();
    commit((x) => ({ ...x, cash: x.cash - def.price, cars: { ...x.cars, [def.id]: newCar() }, car: def.id }));
    setPreviewCar(null);
    setToast(`${def.name} is yours. Tune it in the garage.`);
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
    setStyleTry(null);
    setScreen(s);
  };

  const rivalIdx = Math.min(rivalPick ?? save.rank, LADDER.length - 1);
  const stageLook = useMemo((): CarLook => {
    if (screen === 'rivals') {
      const o = LADDER[rivalIdx]!;
      return lookOf(emptySave(), getCar(o.car), o.levels);
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
  const focus: ShowFocus = screen === 'parts' ? partTab : 'car';
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  });
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
  const racing = screen === 'race' && !!plan;

  // One WebGL stage for the whole game: the menus' turntable and the race share it.
  useEffect(() => {
    const box = stageBoxRef.current;
    if (!box) return;
    // a fresh canvas per mount: a disposed renderer loses its context for good
    const cv = document.createElement('canvas');
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
    const framing = portrait || docked ? 'center' : 'right';
    const reduced = prefersReduced();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33 || document.hidden) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (focusRef.current === 'car') angleRef.current += dt * 0.25;
      stage.renderShowcase(angleRef.current, framing, dt * 1.5, focusRef.current, dt);
    };
    stage.renderShowcase(angleRef.current, framing, 0, focusRef.current, reduced ? 0 : 1 / 60);
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showKey, save.env, racing, portrait, docked, focus]);
  const cashPill = (
    <span className="lc-pill lc-pill-cash">
      <Cash n={save.cash} />
    </span>
  );
  const topbar = (
    <header className="lc-top">
      <button className="lc-logo" onClick={() => go('hub')} aria-label="Launch Control menu">
        LAUNCH<span>CONTROL</span>
      </button>
      <div className="lc-wallet" aria-live="polite">
        <span className="lc-pill lc-pill-cash">
          <Cash n={save.cash} />
        </span>
        <span className="lc-pill lc-pill-mats mono">
          {MATERIALS.map((m) => (
            <span key={m} title={MATERIAL_INFO[m].name}>
              {MATERIAL_INFO[m].emoji}
              {save.mats[m]}
            </span>
          ))}
        </span>
        <span className="lc-pill lc-pill-rank mono" title="Ladder rank">
          🏆 {save.rank}/{LADDER.length}
        </span>
      </div>
      <button className="lc-icon" onClick={() => commit((s) => ({ ...s, muted: !s.muted }))} aria-label={save.muted ? 'Unmute' : 'Mute'}>
        {save.muted ? '🔇' : '🔊'}
      </button>
      <button className="lc-icon" onClick={() => go('help')} aria-label="How to race">
        ?
      </button>
    </header>
  );

  return (
    <div ref={rootRef} className={`lc${portrait ? ' is-portrait' : ''}`} data-screen={racing ? 'race' : screen}>
      <div ref={stageBoxRef} className="lc-stage" data-mode={racing ? 'race' : docked ? 'dock' : portrait ? 'top' : 'full'} aria-hidden="true" />
      {racing && plan ? (
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
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
      {topbar}
      {toast && (
        <div className="lc-toast" role="status">
          {toast}
        </div>
      )}
      <main className="lc-main">
        {screen === 'hub' && (
          <div className="lc-hub">
            <nav className="lc-menu" aria-label="Game menu">
              <button className="lc-menu-btn is-race" autoFocus onClick={() => go('rivals')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  🏁
                </span>
                <span className="lc-menu-text">
                  <b>Race</b>
                  <small>{ladderDone ? 'King of the strip · rematch anyone' : `Next: ${nextOpp.name} · ${DIVISIONS[nextOpp.division]}`}</small>
                </span>
                {!ladderDone && <Sticker tone={nextDiff.tone}>{nextDiff.label}</Sticker>}
              </button>
              <button className="lc-menu-btn" onClick={() => go('daily')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  📅
                </span>
                <span className="lc-menu-text">
                  <b>Daily</b>
                  <small>Showdown #{dailyNumber(today)}{triesLeft > 0 ? ` · ${triesLeft} runs left` : ' · done'}{crateOpen ? '' : ' · crate waiting'}</small>
                </span>
                {!crateOpen && <span className="lc-badge">1</span>}
              </button>
              <button className="lc-menu-btn" onClick={() => go('garage')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  🔧
                </span>
                <span className="lc-menu-text">
                  <b>My garage</b>
                  <small>Repairs, paint and style</small>
                </span>
                {PARTS.some((p) => p !== 'looks' && owned.cond[p] < RISKY) && <Sticker tone="coral">Worn</Sticker>}
              </button>
              <button className="lc-menu-btn" onClick={() => go('parts')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  🔩
                </span>
                <span className="lc-menu-text">
                  <b>Parts shop</b>
                  <small>Six parts, see each one on your car</small>
                </span>
                {PARTS.some((p) => owned.levels[p] < MAX_LEVEL && save.cash >= upgradeCost(car, p, owned.levels[p] + 1).cash && hasMats(save.mats, upgradeCost(car, p, owned.levels[p] + 1).mats)) && <span className="lc-badge">↑</span>}
              </button>
              <button className="lc-menu-btn" onClick={() => go('dealer')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  🚗
                </span>
                <span className="lc-menu-text">
                  <b>Dealer</b>
                  <small>{CARS.length} cars · {Object.keys(save.cars).length} owned</small>
                </span>
              </button>
              <button className="lc-menu-btn" onClick={() => go('ladder')}>
                <span className="lc-menu-icon" aria-hidden="true">
                  🏆
                </span>
                <span className="lc-menu-text">
                  <b>Ladder</b>
                  <small>Rank {save.rank}/{LADDER.length}</small>
                </span>
              </button>
            </nav>
            <div className="lc-mycar lc-panel">
              <CarThumb look={look} className="lc-mycar-thumb" />
              <div className="lc-mycar-text">
                <span className="lc-eyebrow mono">My car · {TIER_NAME[car.tier]}</span>
                <b>{car.name}</b>
                <span className="mono lc-mycar-stats">
                  {mySheet.hp} hp · {mySheet.mass} kg · ¼ mile ~{fmtEt(mySheet.et)} s
                </span>
                <Pips level={Math.round(avgLevel(owned.levels))} max={MAX_LEVEL} />
              </div>
              <DriverFace helmet={look.helmet} suit={look.suit} size={56} />
            </div>
            <p className="lc-foot mono">
              {save.wins} wins / {save.runs} races · best ¼ mile {save.bestEt ? `${fmtEt(save.bestEt / 1000)} s` : '–'} · sponsor ${fmtCash(idleRate(save.rank, effectsOf(owned.levels, owned.cond).sponsorMul))}/h away
            </p>
          </div>
        )}

        {screen === 'setup' && plan && (
          <Panel eyebrow={plan.mode === 'daily' ? `Today’s Showdown #${dailyNumber(today)}` : plan.mode === 'challenge' ? 'Friends’ challenge' : plan.rival?.boss ? 'Division final' : 'Race setup'} title={plan.mode === 'daily' ? 'Same car, same rivals, for everyone' : plan.mode === 'challenge' ? 'Race your friends’ ghosts' : `vs ${plan.rival?.name ?? 'rival'}`} onBack={challenge ? undefined : () => go(plan.mode === 'daily' ? 'daily' : 'rivals')}>
            <div className="lc-versus">
              <div className="lc-vcard is-you">
                <CarThumb look={plan.race.looks[0]!} />
                <b>{me}</b>
                <span className="mono">
                  {plan.me.def.name} · ~{fmtEt(plan.forecast.myEt)} s
                </span>
              </div>
              <span className="lc-vs">VS</span>
              <div className="lc-vcard">
                <CarThumb look={plan.race.looks[1] ?? plan.race.looks[0]!} />
                <b>{plan.race.names[1]}</b>
                <span className="mono">
                  {plan.race.specs[1]?.def.name}
                  {plan.race.drivers[1]?.kind === 'script' ? ' · ghost' : plan.forecast.etList[0] !== undefined ? ` · ~${fmtEt(plan.forecast.etList[0])} s` : ''}
                </span>
              </div>
            </div>
            <div className="lc-also">
              <span className="lc-eyebrow mono">Also on the strip</span>
              <div className="lc-also-list">
                {plan.race.names.slice(2).map((n, i) => (
                  <span key={n} className="lc-chip mono">
                    {n} · {plan.race.specs[i + 2]?.def.name}
                  </span>
                ))}
              </div>
            </div>
            {plan.carId && <WornWarning cond={owned.cond} />}
            {plan.rival && (
              <div className="lc-wager">
                <div className="lc-wager-odds">
                  <span className="lc-eyebrow mono">Your odds of winning</span>
                  <b className="mono">{Math.round(plan.forecast.pWin * 100)}%</b>
                  <span>
                    A win pays <b>{plan.forecast.mult}×</b> your stake plus the <Cash n={plan.rival.purse} /> purse. Places pay less; lose and the stake is gone.
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
              {plan.mode === 'daily' ? `Run (${triesLeft} left)` : 'Confirm race'}
            </button>
          </Panel>
        )}

        {screen === 'result' && outcome && <ResultScreen o={outcome} me={me} today={today} challenge={challenge} save={save} triesLeft={triesLeft} onAgain={() => (outcome.plan.mode === 'daily' ? setup('daily', null) : setup(outcome.rankUp ? 'ladder' : outcome.plan.mode, outcome.rankUp ? null : outcome.plan.rival))} onGarage={() => go('garage')} onMenu={() => go('hub')} />}

        {screen === 'daily' && (
          <Panel eyebrow="Every day" title="Daily" onBack={() => go('hub')}>
            <div className="lc-daily">
              <div className="lc-daily-card lc-panel-inner">
                <span className="lc-eyebrow mono">Today’s Showdown #{dailyNumber(today)}</span>
                <div className="lc-daily-row">
                  <CarThumb look={{ ...lookOf(save, loaner.car, loaner.levels), paint: DEFAULTS.paint }} className="lc-daily-thumb" />
                  <div>
                    <b>{loaner.car.name}</b>
                    <span className="lc-sub">The same loaner and the same four rivals for everyone today. Three runs, best counts.</span>
                    <span className="mono lc-sub">
                      vs {loaner.bots.map((b) => b.name).join(', ')}
                    </span>
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
                  <span className="lc-crate" aria-hidden="true">
                    {crateOpen ? '📭' : '🎁'}
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
            <ol className="lc-ladder">
              {LADDER.map((o, i) => {
                const beaten = i < save.rank;
                const next = i === save.rank;
                return (
                  <li key={o.rank} className={`lc-opp${beaten ? ' is-beaten' : ''}${next ? ' is-next' : ''}${o.boss ? ' is-boss' : ''}`}>
                    {i % PER_DIVISION === 0 && <h3 className="lc-division mono">{DIVISIONS[o.division]} division</h3>}
                    <div className="lc-opp-row">
                      <span className="lc-rank mono">{o.rank}</span>
                      <div>
                        <b>
                          {o.name} {o.boss ? '👑' : ''}
                        </b>
                        <span className="mono">
                          {getCar(o.car).name} · purse ${fmtCash(o.purse)}
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
                <b>The launch.</b> Three ambers, then green. Tap the moment it turns green: launch control holds the perfect revs, your reaction does the rest. Tap during the ambers and it’s a jump start.
              </li>
              <li>
                <b>Shift.</b> Every gear has its own green zone near the top of the revs, and it moves after each shift. Tap (or press Space) while the needle is in the green for a <i>perfect</i> shift and a kick of speed. Yellow is fine, red is slow, early bogs the car, and the limiter wears the engine.
              </li>
              <li>
                <b>Five cars.</b> Every race is you against four rivals in cars tuned like yours. First across the line takes the purse and the wager; places pay less.
              </li>
              <li>
                <b>Garage.</b> Six separate parts, eight levels each. Every level moves several numbers (a bigger engine is also heavier and a touch less reliable). Parts wear with use; under {RISKY}% they can fail mid-run.
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
      {screen === 'rivals' && <RivalsSheet save={save} mySheet={mySheet} mySpec={mySpec} sel={rivalIdx} setPick={setRivalPick} onBack={() => go('hub')} onRace={(o, mode) => setup(mode, o)} viewRef={setViewEl} right={cashPill} />}

      {screen === 'parts' && (
        <Popup
          eyebrow={`Parts shop · ${car.name}`}
          title={PART_INFO[partTab].name}
          onBack={() => go('hub')}
          viewRef={setViewEl}
          className="lc-parts-sheet"
          right={
            <>
              {cashPill}
              <span className="lc-pill lc-pill-mats mono">
                {MATERIALS.map((m) => (
                  <span key={m} title={MATERIAL_INFO[m].name}>
                    {MATERIAL_INFO[m].emoji}
                    {save.mats[m]}
                  </span>
                ))}
              </span>
            </>
          }
          tabs={
            <div className="lc-ptabs" role="tablist" aria-label="Parts">
              {PARTS.map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={partTab === p}
                  className={`lc-ptab${partTab === p ? ' is-on' : ''}${p !== 'looks' && owned.cond[p] < RISKY ? ' is-worn' : ''}`}
                  onClick={() => {
                    sfx().click();
                    setPartTab(p);
                    setPreviewNext(false);
                  }}
                >
                  <span aria-hidden="true">{PART_INFO[p].emoji}</span>
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
          <PartPanel part={partTab} car={car} levels={owned.levels} cond={owned.cond} save={save} preview={previewNext} setPreview={setPreviewNext} onBuy={() => buyUpgrade(partTab)} />
          <StatSheet sheet={mySheet} def={car} />
        </Popup>
      )}

      {screen === 'garage' && (
        <Popup
          eyebrow={`My garage · ${TIER_NAME[car.tier]}`}
          title={car.name}
          onBack={() => go('hub')}
          viewRef={setViewEl}
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
                  {t === 'repairs' ? 'Repairs' : 'Style'}
                </button>
              ))}
              <button className="lc-tab" onClick={() => go('parts')}>
                Upgrades →
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
              <p className="lc-sub">Parts wear with every race. Under {RISKY}% they can fail mid-run; a fresh part never does.</p>
              <ul className="lc-parts lc-parts-compact">
                {PARTS.filter((p) => p !== 'looks').map((p) => {
                  const cond = owned.cond[p];
                  const fix = repairCost(car, p, cond);
                  return (
                    <li key={p} className={`lc-part${cond < RISKY ? ' is-worn' : ''}`}>
                      <div className="lc-part-top">
                        <span className="lc-part-icon" aria-hidden="true">
                          {PART_INFO[p].emoji}
                        </span>
                        <div className="lc-part-name">
                          <b>{PART_INFO[p].name}</b>
                          <span className="mono">{Math.round(cond)}%</span>
                        </div>
                      </div>
                      <div className="lc-cond">
                        <span className="lc-cond-bar">
                          <i style={{ width: `${cond}%` }} className={cond < RISKY ? 'is-bad' : cond < 60 ? 'is-mid' : ''} />
                        </span>
                      </div>
                      <button className={`btn btn-sm${cond < 100 && save.cash >= fix ? ' lc-cta' : ''}`} onClick={() => repair(p)} disabled={cond >= 100 || save.cash < fix}>
                        {cond >= 100 ? 'Like new' : <>Repair <Cash n={fix} /></>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {(() => {
                const total = PARTS.reduce((n, p) => n + repairCost(car, p, owned.cond[p]), 0);
                return (
                  <button className="btn lc-cta" onClick={repairAll} disabled={total <= 0 || save.cash < total}>
                    {total <= 0 ? 'Everything is like new' : <>Repair all <Cash n={total} /></>}
                  </button>
                );
              })()}
            </div>
          )}
          {garageTab === 'style' && <StyleShop save={save} kind={styleKind} setKind={setStyleKind} onPick={buyOrEquip} trying={styleTry} onTry={setStyleTry} />}
        </Popup>
      )}

      {screen === 'dealer' && (
        <Popup
          eyebrow={`${CARS.length} cars · ${Object.keys(save.cars).length} owned`}
          title="Dealer"
          onBack={() => go('hub')}
          viewRef={setViewEl}
          right={cashPill}
          tabs={
            <div className="lc-chips" role="tablist" aria-label="Tier">
              {[0, 1, 2, 3, 4, 5, 6].map((t) => (
                <button key={t} role="tab" aria-selected={dealerTier === t} className={`lc-chip${dealerTier === t ? ' is-on' : ''}`} onClick={() => setDealerTier(t)}>
                  {t === 0 ? 'All' : TIER_NAME[t as CarDef['tier']]}
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
                </div>
                <button className={`btn${mine ? '' : save.cash >= shown.price ? ' lc-cta' : ''}`} onClick={() => buyCar(shown)} disabled={(!mine && save.cash < shown.price) || shown.id === save.car}>
                  {mine ? (shown.id === save.car ? 'Your car' : 'Drive this one') : <>Buy <Cash n={shown.price} /></>}
                </button>
              </div>
            );
          })()}
          <ul className="lc-cars">
            {CARS.filter((d) => dealerTier === 0 || d.tier === dealerTier).map((d) => {
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
                    <p className="lc-blurb">{d.blurb}</p>
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

function WornWarning({ cond }: { cond: Condition }) {
  const worn = PARTS.filter((p) => p !== 'looks' && cond[p] < RISKY);
  if (!worn.length) return null;
  return (
    <p className="lc-warn" role="status">
      ⚠️ {worn.map((p) => PART_INFO[p].name).join(', ')} under {RISKY}%: could fail mid-race. Repair in the garage.
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
  const oSpec = botSpec(rivalBot(o));
  const run = forecastRun(oSpec, o.skill, 7);
  const diff = rivalDifficulty(o, mySpec);
  const beaten = sel < save.rank;
  const next = sel === save.rank;
  const oSheet = sheetOf(getCar(o.car), o.levels, newCar().cond);
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
              <CarThumb look={lookOf(emptySave(), getCar(r.car), r.levels)} />
              <b className="lc-rcard-name">
                {r.boss ? '👑 ' : ''}
                {r.name}
              </b>
              <span className="lc-rcard-car mono">{getCar(r.car).name}</span>
              <span className="lc-rcard-foot" data-tone={locked ? 'locked' : d.tone}>
                {locked ? `🔒 Beat #${r.rank - 1} first` : i < save.rank ? `✓ Beaten · ${d.label}` : d.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="lc-rival-detail lc-panel-inner">
        <div className="lc-rival-head">
          <div>
            <b>
              {o.boss ? '👑 ' : ''}
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
          <b>{getCar(o.car).name}</b>
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
        <p className="lc-foot mono">Three more racers in cars like yours join every race. First place takes the purse.</p>
      </div>
      <button className="btn btn-lg lc-cta lc-modal-cta" onClick={() => onRace(o, next ? 'ladder' : 'rematch')} disabled={!beaten && !next}>
        {next ? `Race ${o.name}` : `Rematch ${o.name}`}
      </button>
    </Popup>
  );
}

/** One part in the parts shop: what it does now and at the next level, what you see on the car, and the buy button. */
function PartPanel({ part, car, levels, cond, save, preview, setPreview, onBuy }: { part: PartId; car: CarDef; levels: Levels; cond: Condition; save: Save; preview: boolean; setPreview: (on: boolean) => void; onBuy: () => void }) {
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
    <div className={`lc-part-panel lc-panel-inner${part !== 'looks' && cond[part] < RISKY ? ' is-worn' : ''}`}>
      <div className="lc-part-top">
        <span className="lc-part-icon" aria-hidden="true">
          {info.emoji}
        </span>
        <div className="lc-part-name">
          <b>{info.name}</b>
          <span className="mono">
            Lv {level}/{MAX_LEVEL}
          </span>
        </div>
        <Pips level={level} max={MAX_LEVEL} />
      </div>
      <p className="lc-sub">{info.blurb}</p>
      {part !== 'looks' && (
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
            👀 Preview Lv {level + 1}
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
        <ul>
          {PART_VISUALS[part].map(([lv, text]) => (
            <li key={text} className={level >= lv ? 'is-have' : lv === nextVisual ? 'is-next' : ''}>
              <span className="mono">Lv {lv}</span> {text}
              {level >= lv ? ' ✓' : ''}
            </li>
          ))}
        </ul>
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
                {on ? 'Equipped' : mine ? 'Equip' : locked ? `🔒 Rank ${c.rank}` : <Cash n={c.price} />}
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

function ResultScreen({ o, me, today, challenge, save, triesLeft, onAgain, onGarage, onMenu }: { o: Outcome; me: string; today: string; challenge?: ChallengeSpec; save: Save; triesLeft: number; onAgain: () => void; onGarage: () => void; onMenu: () => void }) {
  const mine = o.result.racers[0]!;
  const p = o.plan;
  const title = mine.et === null ? 'Did not finish' : o.won ? (p.rival?.boss && o.rankUp ? 'Division champion!' : 'You won!') : `${posLabel(o.position)} place`;
  const d = save.daily[today];
  const line = resultLine(o);
  const share = `Launch Control #${dailyNumber(today)} 🏁\n${line}\nBest today: ${fmtCash(d?.best ?? 0)} (${d?.tries ?? 0} ${d?.tries === 1 ? 'run' : 'runs'})\n${window.location.origin}/games/${SLUG}`;
  return (
    <Panel eyebrow={p.mode === 'daily' ? `Today’s Showdown #${dailyNumber(today)}` : p.mode === 'challenge' ? 'Friends’ challenge' : 'Race result'} title={title} className={`lc-result${o.won ? ' is-win' : ''}`}>
      {mine.failure && <p className="lc-warn">💥 {FAILURE_TEXT[mine.failure]}</p>}
      <ol className="lc-order">
        {o.result.order.map((idx, k) => {
          const r = o.result.racers[idx]!;
          return (
            <li key={idx} className={idx === 0 ? 'is-you' : ''}>
              <span className="lc-order-pos mono">{k + 1}</span>
              <CarThumb look={p.race.looks[idx]!} className="lc-order-thumb" />
              <span className="lc-order-name">
                <b>{idx === 0 ? me : p.race.names[idx]}</b>
                <small>{p.race.specs[idx]!.def.name}</small>
              </span>
              <span className="mono lc-order-et">{r.et !== null ? `${fmtEt(r.et)} s` : 'DNF'}</span>
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
      {p.rival && (
        <ul className="lc-ledger mono">
          <li>
            <span>Purse ({posLabel(o.position)})</span>
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
          🏆 Rank {save.rank} of {LADDER.length}: {save.rank < LADDER.length ? `next up ${LADDER[save.rank]!.name}` : 'you are the King of the strip'}
        </p>
      )}
      <div className="lc-actions">
        {p.mode === 'challenge' && challenge ? (
          <a className="btn btn-lg lc-cta" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="btn btn-lg lc-cta" autoFocus onClick={onAgain} disabled={p.mode === 'daily' && triesLeft <= 0}>
            {p.mode === 'daily' ? (triesLeft > 0 ? `Run again (${triesLeft} left)` : 'No runs left today') : o.rankUp ? 'Next rival' : 'Race again'}
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

