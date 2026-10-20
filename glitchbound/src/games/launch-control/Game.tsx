import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { addMats, DIVISIONS, forecast, hasMats, idleIncome, idleRate, LADDER, loanerFor, materialsFor, opponentSpec, PER_DIVISION, settle, STAKE_SHARES, type Forecast, type Opponent } from './economy';
import { applyWear, effectsOf, FAILURE_TEXT, MATERIAL_INFO, MATERIALS, MAX_LEVEL, PART_INFO, PARTS, raceWear, repairCost, RISKY, upgradeCost, type Mats, type PartId } from './parts';
import { ENV_DEFS } from './envs';
import { drawDriver, drawHud, type Hud } from './hud';
import { Stage3D, thumbnail, type CarLook, type CarState } from './scene3d';
import { decodeScript, DISTANCE, DT, encodeScript, launchWindow, PERFECT_FROM, Race, scoreOf, specOf, type CarSpec, type Driver, type RaceResult } from './sim';
import { createSfx, type Sfx } from './sound';
import { DAILY_TRIES, emptySave, loadSave, newCar, owns, writeSave, type Save } from './storage';
import { clamp, fmtCash, fmtEt, fmtShort } from './util';
import './Game.css';

const EPOCH = '2026-10-21';
const SLUG = 'launch-control';
type Screen = 'hub' | 'garage' | 'dealer' | 'shop' | 'ladder' | 'setup' | 'race' | 'result' | 'help';
type Mode = 'ladder' | 'rematch' | 'daily' | 'challenge';

/** Everything a race needs, decided on the setup screen. */
interface Plan {
  mode: Mode;
  me: CarSpec;
  opp: CarSpec;
  oppName: string;
  oppDriver: Driver;
  opponent: Opponent | null;
  stake: number;
  forecast: Forecast;
  env: string;
  seed: number;
  /** The owned car raced (null for loaners). */
  carId: string | null;
}

interface Outcome {
  plan: Plan;
  result: RaceResult;
  score: number;
  won: boolean;
  cash: { purse: number; wager: number; bonus: number };
  mats: Mats;
  wear: Record<PartId, number>;
  rankUp: boolean;
  newBest: boolean;
  failures: PartId[];
}

const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const dailySeed = (day: string): number => hashString(`${SLUG}:${day}`);
const prefersReduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Game({ host, restartKey, pauseKey, challenge, playerName }: GameModuleProps) {
  return <LaunchControl key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />;
}

function lookOf(save: Save, def: CarDef, levels = save.cars[def.id]?.levels): CarLook {
  const owned = save.cars[def.id];
  const helmet = getCosmetic(save.helmet)?.colors ?? ['#fff', '#1d1238'];
  return {
    def,
    levels: levels ?? newCar().levels,
    paint: owned?.paint ?? DEFAULTS.paint,
    livery: owned?.livery ?? DEFAULTS.livery,
    wheels: owned?.wheels ?? DEFAULTS.wheels,
    helmet: [helmet[0] ?? '#fff', helmet[1] ?? '#1d1238'],
    suit: getCosmetic(save.suit)?.colors[0] ?? '#1d3557',
  };
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
  const [toast, setToast] = useState<string>('');
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const me = playerName || 'You';

  // Toasts fade by themselves.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

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
      const pay = idleIncome(s0.rank, now - s0.paidAt);
      commit((s) => ({ ...s, cash: s.cash + pay, earned: s.earned + pay, paidAt: now }));
      if (pay > 0) setToast(`Your sponsor paid $${fmtCash(pay)} while you were away`);
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
  const mySpec = useMemo(() => specOf(car, owned.levels, owned.cond), [car, owned]);
  const nextOpp = LADDER[Math.min(save.rank, LADDER.length - 1)]!;
  const ladderDone = save.rank >= LADDER.length;
  const dailyRec = save.daily[today];
  const triesLeft = DAILY_TRIES - (dailyRec?.tries ?? 0);

  // ---- building a race
  const setup = useCallback(
    (mode: Mode, opponent: Opponent | null): void => {
      const s = saveRef.current;
      const c = getCar(s.car);
      const o = s.cars[s.car] ?? newCar();
      if (mode === 'daily' || mode === 'challenge') {
        const seed = mode === 'challenge' && challenge ? challenge.seed : dailySeed(today);
        const loan = loanerFor(seed);
        const meSpec = specOf(loan.car, loan.levels, { engine: 100, transmission: 100, suspension: 100, tyres: 100, aero: 100, looks: 100 }, false);
        const oppSpec = specOf(loan.opponent.car, loan.opponent.levels, { engine: 100, transmission: 100, suspension: 100, tyres: 100, aero: 100, looks: 100 }, false);
        const ghost = mode === 'challenge' ? challenge?.replays?.[0] : undefined;
        const script = decodeScript(ghost?.replay);
        const oppDriver: Driver = script ? { kind: 'script', script } : { kind: 'policy', skill: loan.opponent.skill, seed: seed ^ 0x5151 };
        const rival = script && ghost ? ghost.name : loan.opponent.name;
        setPlan({ mode, me: meSpec, opp: script ? meSpec : oppSpec, oppName: rival, oppDriver, opponent: null, stake: 0, forecast: forecast(meSpec, script ? meSpec : oppSpec, loan.opponent.skill), env: loan.env, seed, carId: null });
      } else {
        const opp = opponent ?? LADDER[Math.min(s.rank, LADDER.length - 1)]!;
        const meSpec = specOf(c, o.levels, o.cond);
        const oppSpec = opponentSpec(opp);
        setPlan({ mode, me: meSpec, opp: oppSpec, oppName: opp.name, oppDriver: { kind: 'policy', skill: opp.skill, seed: (Math.random() * 2 ** 32) >>> 0 }, opponent: opp, stake: 0, forecast: forecast(meSpec, oppSpec, opp.skill), env: s.env, seed: (Math.random() * 2 ** 32) >>> 0, carId: s.car });
      }
      setScreen('setup');
    },
    [challenge, today],
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
    host.report({ type: 'start' });
    setScreen('race');
  };

  const finishRace = useCallback(
    (p: Plan, result: RaceResult): void => {
      const mine = result.racers[0];
      const won = result.winner === 0;
      const score = scoreOf(mine);
      const s0 = saveRef.current;
      const stats: Record<string, number> = { perfect: mine.perfect };
      if (mine.et !== null) {
        stats.etMs = Math.round(mine.et * 1000);
        stats.trapKmh = Math.round(mine.trap);
        stats.reactionMs = Math.round(Math.max(0, mine.reaction) * 1000);
      }
      let cash = { purse: 0, wager: 0, bonus: 0 };
      let mats: Mats = {};
      let wear = raceWear({ spinTime: mine.spinTime, limiterTime: mine.limiterTime, missedShifts: mine.late + mine.early, dnf: mine.et === null });
      let rankUp = false;
      const failures: PartId[] = mine.failure ? [mine.failure] : [];
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
        const opp = p.opponent!;
        const firstWin = won && p.mode === 'ladder' && s0.rank === opp.rank - 1;
        const fans = effectsOf(s0.cars[p.carId!]?.levels ?? newCar().levels, s0.cars[p.carId!]?.cond ?? newCar().cond).fansMul;
        cash = settle({ won, purse: opp.purse, fansMul: fans, stake: p.stake, mult: p.forecast.mult, firstWin });
        if (won) mats = materialsFor(opp, firstWin, p.seed);
        rankUp = firstWin;
        const back = p.stake + cash.wager; // the stake was taken at the start
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
      setOutcome({ plan: p, result, score, won, cash, mats, wear, rankUp, newBest, failures });
      setScreen('result');
    },
    [commit, host, challenge, today, sfx],
  );

  /** Leaving a daily run mid-race settles it as 0 (one of the day's tries is gone). */
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

  // The arcade asks for a pause (left full screen, scrolled away): derived during render, no effect needed.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'race') setPaused(true);
  }
  // Unmount during a daily run (the arcade's Restart or Exit): settle it.
  const settleRef = useRef(settleOpenDaily);
  useEffect(() => {
    settleRef.current = settleOpenDaily;
  });
  useEffect(() => () => settleRef.current(), []);

  // ---- garage actions
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
  const buyCar = (def: CarDef): void => {
    const s = saveRef.current;
    if (s.cars[def.id]) {
      commit((x) => ({ ...x, car: def.id }));
      return;
    }
    if (s.cash < def.price) return;
    sfx().cash();
    commit((x) => ({ ...x, cash: x.cash - def.price, cars: { ...x.cars, [def.id]: newCar() }, car: def.id }));
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

  // Stable identity: the 3D stage rebuilds the car only when the look really changes.
  const look = useMemo(() => lookOf(save, car), [save, car]);
  const header = (
    <header className="lc-head">
      <button className="lc-logo" onClick={() => setScreen('hub')} aria-label="Launch Control menu">
        Launch <span>Control</span>
      </button>
      <div className="lc-wallet mono" aria-live="polite">
        <span className="lc-cash">${fmtCash(save.cash)}</span>
        <span className="lc-mats">
          {MATERIALS.map((m) => (
            <span key={m} title={MATERIAL_INFO[m].name}>
              {MATERIAL_INFO[m].emoji}
              {save.mats[m]}
            </span>
          ))}
        </span>
      </div>
      <button className="lc-icon" onClick={() => commit((s) => ({ ...s, muted: !s.muted }))} aria-label={save.muted ? 'Unmute' : 'Mute'}>
        {save.muted ? '🔇' : '🔊'}
      </button>
      <button className="lc-icon" onClick={() => setScreen('help')} aria-label="How to race">
        ?
      </button>
    </header>
  );

  if (screen === 'race' && plan) {
    return (
      <div className="lc">
        <RaceScreen plan={plan} look={plan.carId ? lookOf(save, plan.me.def) : { ...lookOf(save, plan.me.def, plan.me.levels), paint: DEFAULTS.paint, livery: DEFAULTS.livery, wheels: DEFAULTS.wheels }} oppLook={{ ...lookOf(emptySave(), plan.opp.def, plan.opp.levels) }} myName={me} paused={paused} setPaused={setPaused} onFinish={(r) => finishRace(plan, r)} sfx={sfx} />
        {paused && (
          <div className="lc-overlay" role="dialog" aria-label="Paused">
            <div className="lc-sheet lc-small">
              <h2>Paused</h2>
              {confirmLeave ? (
                <>
                  <p>Leaving counts as one of today’s {DAILY_TRIES} runs, scored 0.</p>
                  <button className="lc-btn lc-primary" onClick={() => setConfirmLeave(false)}>
                    Keep racing
                  </button>
                  <button className="lc-btn" onClick={leaveRace}>
                    Leave anyway
                  </button>
                </>
              ) : (
                <>
                  <button className="lc-btn lc-primary" autoFocus onClick={() => setPaused(false)}>
                    Resume
                  </button>
                  <button className="lc-btn" onClick={leaveRace}>
                    Leave the race
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="lc">
      <CarStage look={look} env={save.env} big={screen === 'hub'} />
      {header}
      {toast && (
        <div className="lc-toast" role="status">
          {toast}
        </div>
      )}

      {screen === 'hub' && (
        <main className="lc-sheet lc-hub">
          <div className="lc-hub-car">
            <div>
              <p className="lc-eyebrow mono">
                {car.maker} · {car.year} · {TIER_NAME[car.tier]}
              </p>
              <h2 className="lc-title">{car.name}</h2>
              <p className="lc-sub">
                {car.hp} hp · {car.mass} kg · {car.drive.toUpperCase()} · forecast {fmtEt(plan?.carId === car.id && plan.forecast ? plan.forecast.myEt : forecast(mySpec, mySpec, 0.75).myEt)} s
              </p>
            </div>
            <DriverCard helmet={look.helmet} suit={look.suit} name={me} />
          </div>
          <WornWarning cond={owned.cond} />
          <div className="lc-actions">
            <button className="lc-btn lc-primary lc-big" autoFocus onClick={() => setup('ladder', null)} disabled={ladderDone}>
              <b>{ladderDone ? 'Ladder complete: King of the strip' : `Race ${nextOpp.name}`}</b>
              <small>{ladderDone ? 'Rematch anyone for purses' : `${DIVISIONS[nextOpp.division]} · rank ${nextOpp.rank}/${LADDER.length} · purse $${fmtCash(nextOpp.purse)}`}</small>
            </button>
            <button className="lc-btn lc-daily" onClick={() => setup('daily', null)} disabled={triesLeft <= 0}>
              <b>Today’s Showdown #{dailyNumber(today)}</b>
              <small>
                {triesLeft > 0 ? `Same loaner car for everyone · ${triesLeft} of ${DAILY_TRIES} runs left` : <NextDaily />}
                {dailyRec?.best ? ` · best ${fmtCash(dailyRec.best)}` : ''}
              </small>
            </button>
            <div className="lc-row">
              <button className="lc-btn" onClick={() => setScreen('garage')}>
                🔧 Garage
              </button>
              <button className="lc-btn" onClick={() => setScreen('dealer')}>
                🚗 Dealer
              </button>
              <button className="lc-btn" onClick={() => setScreen('shop')}>
                ✨ Style
              </button>
              <button className="lc-btn" onClick={() => setScreen('ladder')}>
                🏆 Ladder
              </button>
            </div>
          </div>
          <p className="lc-foot mono">
            {save.wins} wins / {save.runs} races · best ET {save.bestEt ? `${fmtEt(save.bestEt / 1000)} s` : '–'} · sponsor ${fmtCash(idleRate(save.rank))}/h while away
          </p>
        </main>
      )}

      {screen === 'garage' && (
        <main className="lc-sheet lc-panel">
          <PanelHead title="Garage" sub={`${car.name} · ${Object.keys(save.cars).length} cars owned`} onBack={() => setScreen('hub')} />
          <p className="lc-matsline mono" aria-label="Materials">
            {MATERIALS.map((m) => (
              <span key={m} title={MATERIAL_INFO[m].blurb}>
                {MATERIAL_INFO[m].emoji} {MATERIAL_INFO[m].name} {save.mats[m]}
              </span>
            ))}
          </p>
          <div className="lc-chips" role="tablist" aria-label="Your cars">
            {Object.keys(save.cars).map((id) => (
              <button key={id} className={`lc-chip${id === save.car ? ' is-on' : ''}`} onClick={() => commit((s) => ({ ...s, car: id }))}>
                {getCar(id).name}
              </button>
            ))}
          </div>
          <ul className="lc-parts">
            {PARTS.map((p) => {
              const info = PART_INFO[p];
              const level = owned.levels[p];
              const cond = owned.cond[p];
              const next = level < MAX_LEVEL ? upgradeCost(car, p, level + 1) : null;
              const can = next ? save.cash >= next.cash && hasMats(save.mats, next.mats) : false;
              const fix = repairCost(car, p, cond);
              return (
                <li key={p} className={`lc-part${cond < RISKY ? ' is-worn' : ''}`}>
                  <div className="lc-part-head">
                    <span className="lc-part-emoji" aria-hidden="true">
                      {info.emoji}
                    </span>
                    <div>
                      <b>{info.name}</b> <span className="mono">Lv {level}/{MAX_LEVEL}</span>
                      <p>{info.effect}</p>
                    </div>
                  </div>
                  <div className="lc-pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
                    {Array.from({ length: MAX_LEVEL }, (_, i) => (
                      <i key={i} className={i < level ? 'is-on' : ''} />
                    ))}
                  </div>
                  {p !== 'looks' && (
                    <div className="lc-cond">
                      <div className="lc-cond-bar">
                        <i style={{ width: `${cond}%` }} className={cond < RISKY ? 'is-bad' : cond < 60 ? 'is-mid' : ''} />
                      </div>
                      <span className="mono">{Math.round(cond)}%</span>
                      {cond < 100 && (
                        <button className="lc-mini" onClick={() => repair(p)} disabled={save.cash < fix}>
                          Repair ${fmtCash(fix)}
                        </button>
                      )}
                    </div>
                  )}
                  {next ? (
                    <button className={`lc-btn lc-upgrade${can ? ' lc-primary' : ''}`} onClick={() => buyUpgrade(p)} disabled={!can}>
                      Upgrade · ${fmtCash(next.cash)} <MatsLine mats={next.mats} have={save.mats} />
                    </button>
                  ) : (
                    <span className="lc-maxed mono">MAXED</span>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
      )}

      {screen === 'dealer' && (
        <main className="lc-sheet lc-panel">
          <PanelHead title="Dealer" sub="33 cars, six divisions. Owned cars are kept forever." onBack={() => setScreen('hub')} />
          <ul className="lc-cars">
            {CARS.map((d) => {
              const mine = !!save.cars[d.id];
              const spec = specOf(d, newCar().levels, newCar().cond, false);
              return (
                <li key={d.id} className={`lc-car${mine ? ' is-owned' : ''}${d.id === save.car ? ' is-on' : ''}`}>
                  <CarThumb look={lookOf(save, d)} />
                  <div className="lc-car-info">
                    <p className="lc-eyebrow mono">
                      {d.maker} {d.year} · {TIER_NAME[d.tier]}
                    </p>
                    <b>{d.name}</b>
                    <p className="lc-blurb">{d.blurb}</p>
                    <StatBars def={d} spec={spec} />
                  </div>
                  <button className={`lc-btn${mine ? '' : save.cash >= d.price ? ' lc-primary' : ''}`} onClick={() => buyCar(d)} disabled={!mine && save.cash < d.price}>
                    {mine ? (d.id === save.car ? 'Selected' : 'Select') : `Buy $${fmtShort(d.price)}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </main>
      )}

      {screen === 'shop' && <Shop save={save} onPick={buyOrEquip} onBack={() => setScreen('hub')} />}

      {screen === 'ladder' && (
        <main className="lc-sheet lc-panel">
          <PanelHead title="The ladder" sub={`${save.rank} of ${LADDER.length} beaten. Rematch anyone you beat for the base purse.`} onBack={() => setScreen('hub')} />
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
                      <p>
                        {getCar(o.car).name} · purse ${fmtCash(o.purse)}
                      </p>
                    </div>
                    {(beaten || next) && (
                      <button className={`lc-btn${next ? ' lc-primary' : ''}`} onClick={() => setup(next ? 'ladder' : 'rematch', o)}>
                        {next ? 'Race' : 'Rematch'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </main>
      )}

      {screen === 'setup' && plan && (
        <main className="lc-sheet lc-panel">
          <PanelHead title={plan.mode === 'daily' ? `Today’s Showdown #${dailyNumber(today)}` : plan.mode === 'challenge' ? 'Friends’ challenge' : plan.opponent?.boss ? 'Division final' : 'Next race'} sub={plan.mode === 'daily' ? `Everyone gets this loaner today · ${triesLeft} of ${DAILY_TRIES} runs left` : plan.mode === 'challenge' ? 'One run on the same loaner. Your run becomes a ghost for the others.' : plan.opponent?.blurb ?? ''} onBack={challenge ? undefined : () => setScreen('hub')} />
          <div className="lc-versus">
            <VersusCard title={me} spec={plan.me} look={plan.carId ? lookOf(save, plan.me.def) : { ...lookOf(save, plan.me.def, plan.me.levels), paint: DEFAULTS.paint }} et={plan.forecast.myEt} />
            <span className="lc-vs">VS</span>
            <VersusCard title={plan.oppName} spec={plan.opp} look={lookOf(emptySave(), plan.opp.def, plan.opp.levels)} et={plan.oppDriver.kind === 'script' ? null : plan.forecast.oppEt} ghost={plan.oppDriver.kind === 'script'} />
          </div>
          {plan.carId && <WornWarning cond={owned.cond} />}
          {plan.opponent && (
            <div className="lc-wager">
              <p>
                <b>Your odds: {Math.round(plan.forecast.pWin * 100)}%</b> · a win pays <b>{plan.forecast.mult}×</b> your stake, plus the ${fmtCash(plan.opponent.purse)} purse. Lose and the stake is gone.
              </p>
              <div className="lc-stakes" role="radiogroup" aria-label="Stake">
                {STAKE_SHARES.map((sh) => {
                  const amt = Math.floor(save.cash * sh);
                  return (
                    <button key={sh} role="radio" aria-checked={plan.stake === amt} className={`lc-chip${plan.stake === amt ? ' is-on' : ''}`} onClick={() => setPlan({ ...plan, stake: amt })} disabled={save.cash === 0 && sh > 0}>
                      {sh === 0 ? 'No bet' : sh === 1 ? 'All in' : `${sh * 100}%`}
                      {sh > 0 && <small>${fmtShort(amt)}</small>}
                    </button>
                  );
                })}
              </div>
              <p className="lc-foot mono">Stake ${fmtCash(plan.stake)} → win ${fmtCash(Math.round(plan.stake * plan.forecast.mult))} back</p>
            </div>
          )}
          <button className="lc-btn lc-primary lc-big" autoFocus onClick={() => startRace(plan)}>
            <b>Race!</b>
            <small>Hold to rev · let go at green · tap to shift</small>
          </button>
        </main>
      )}

      {screen === 'result' && outcome && <ResultScreen o={outcome} today={today} challenge={challenge} save={save} onAgain={() => (outcome.plan.mode === 'daily' ? setup('daily', null) : outcome.plan.mode === 'rematch' || outcome.plan.mode === 'ladder' ? setup(outcome.rankUp ? 'ladder' : outcome.plan.mode, outcome.rankUp ? null : outcome.plan.opponent) : undefined)} onGarage={() => setScreen('garage')} onMenu={() => setScreen('hub')} triesLeft={triesLeft} />}

      {screen === 'help' && (
        <main className="lc-sheet lc-panel">
          <PanelHead title="How to race" onBack={() => setScreen('hub')} />
          <ol className="lc-help">
            <li>
              <b>Stage.</b> The tree lights three ambers. Hold the pedal (Space, or the big button) to build revs. The green band on the tacho is your car’s launch window: too many revs spin the tyres, too few bog it down.
            </li>
            <li>
              <b>Launch.</b> Let go the moment the light turns green. Let go early and it’s a red light: disqualified, stake lost.
            </li>
            <li>
              <b>Shift.</b> Tap when the needle is in the green zone just under the redline for a <i>perfect</i> shift. Early loses pull; bouncing off the limiter loses time and wears the engine.
            </li>
            <li>
              <b>Garage.</b> Six separate parts, eight levels each: engine, transmission, suspension, tyres, aerodynamics and looks. Parts wear with every race; under {RISKY}% they can fail mid-run. Repairs cost cash.
            </li>
            <li>
              <b>Money.</b> Purses, wagers and your sponsor (paid by the hour while you’re away) are the only money there is. Nothing here is ever bought with real money.
            </li>
          </ol>
          <button className="lc-btn lc-primary" onClick={() => setScreen('hub')}>
            Got it
          </button>
        </main>
      )}
    </div>
  );
}

// ---- pieces

function PanelHead({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <div className="lc-panel-head">
      {onBack && (
        <button className="lc-back" onClick={onBack} aria-label="Back">
          ←
        </button>
      )}
      <div>
        <h2 className="lc-title">{title}</h2>
        {sub && <p className="lc-sub">{sub}</p>}
      </div>
    </div>
  );
}

function MatsLine({ mats, have }: { mats: Mats; have: Record<string, number> }) {
  const parts = MATERIALS.filter((m) => mats[m]);
  if (!parts.length) return null;
  return (
    <span className="lc-matline">
      {parts.map((m) => (
        <span key={m} className={have[m]! < mats[m]! ? 'is-short' : ''}>
          {MATERIAL_INFO[m].emoji}
          {mats[m]}
        </span>
      ))}
    </span>
  );
}

function WornWarning({ cond }: { cond: Record<PartId, number> }) {
  const worn = PARTS.filter((p) => p !== 'looks' && cond[p] < RISKY);
  if (!worn.length) return null;
  return (
    <p className="lc-warn" role="status">
      ⚠️ {worn.map((p) => PART_INFO[p].name).join(', ')} under {RISKY}%: could fail mid-race. Repair in the garage.
    </p>
  );
}

function StatBars({ def, spec }: { def: CarDef; spec: CarSpec }) {
  const rows: [string, number][] = [
    ['Power', clamp(Math.log(def.hp / 50) / Math.log(60), 0, 1)],
    ['Grip', clamp((def.grip - 0.8) / 2.2, 0, 1)],
    ['Lightness', clamp(1 - (def.mass - 700) / 1700, 0, 1)],
    ['Reliability', def.reliability],
  ];
  void spec;
  return (
    <div className="lc-bars">
      {rows.map(([k, v]) => (
        <div key={k} className="lc-bar">
          <span>{k}</span>
          <i>
            <b style={{ width: `${Math.round(v * 100)}%` }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function VersusCard({ title, spec, look, et, ghost }: { title: string; spec: CarSpec; look: CarLook; et: number | null; ghost?: boolean }) {
  return (
    <div className="lc-vcard">
      <CarThumb look={look} />
      <b>{title}</b>
      <p>
        {spec.def.name} · {spec.def.hp} hp{Object.values(spec.levels).some((l) => l > 0) ? ` · tuned Lv ${Math.round(Object.values(spec.levels).reduce((a, b) => a + b, 0) / 6)}` : ''}
      </p>
      <p className="mono">{ghost ? 'ghost run' : et !== null ? `~${fmtEt(et)} s` : ''}</p>
    </div>
  );
}

function Shop({ save, onPick, onBack }: { save: Save; onPick: (c: Cosmetic) => void; onBack: () => void }) {
  const [kind, setKind] = useState<CosmeticKind>('helmet');
  const equipped = (c: Cosmetic): boolean => (c.kind === 'helmet' ? save.helmet === c.id : c.kind === 'suit' ? save.suit === c.id : c.kind === 'env' ? save.env === c.id : (save.cars[save.car]?.[c.kind] ?? DEFAULTS[c.kind]) === c.id);
  return (
    <main className="lc-sheet lc-panel">
      <PanelHead title="Style" sub="Helmets, suits, paint, liveries, wheels and strips. Cash only, earned on the strip." onBack={onBack} />
      <div className="lc-chips" role="tablist">
        {(Object.keys(COSMETICS) as CosmeticKind[]).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`lc-chip${kind === k ? ' is-on' : ''}`} onClick={() => setKind(k)}>
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
            <li key={c.id} className={`lc-item${on ? ' is-on' : ''}`}>
              <Swatch c={c} save={save} />
              <b>{c.name}</b>
              <button className={`lc-btn${!mine && !locked && save.cash >= c.price ? ' lc-primary' : ''}`} onClick={() => onPick(c)} disabled={locked || (!mine && save.cash < c.price) || on}>
                {on ? 'Equipped' : mine ? 'Equip' : locked ? `Rank ${c.rank}` : `$${fmtShort(c.price)}`}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function Swatch({ c, save }: { c: Cosmetic; save: Save }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const isCar = c.kind === 'paint' || c.kind === 'livery' || c.kind === 'wheels';
  const url = useMemo(() => (isCar ? thumbnail({ ...lookOf(save, getCar(save.car)), [c.kind]: c.id }) : ''), [isCar, c, save]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || isCar) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);
    if (c.kind === 'helmet') drawDriver(ctx, [c.colors[0]!, c.colors[1]!], getCosmetic(save.suit)?.colors[0] ?? '#1d3557', w / 2, h * 0.45, h * 0.9);
    else if (c.kind === 'suit') drawDriver(ctx, [getCosmetic(save.helmet)?.colors[0] ?? '#fff', getCosmetic(save.helmet)?.colors[1] ?? '#1d1238'], c.colors[0]!, w / 2, h * 0.45, h * 0.9);
    else if (c.kind === 'env') {
      const e = ENV_DEFS[c.id]!;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, e.sky[0]);
      g.addColorStop(0.6, e.sky[1]);
      g.addColorStop(0.61, e.ground);
      g.addColorStop(1, e.track);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }, [c, save, isCar]);
  if (isCar) return url ? <img src={url} width={120} height={55} className="lc-swatch" alt="" /> : <span className="lc-swatch" />;
  return <canvas ref={ref} width={120} height={64} className="lc-swatch" aria-hidden="true" />;
}

function DriverCard({ helmet, suit, name }: { helmet: [string, string]; suit: string; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawDriver(ctx, helmet, suit, cv.width / 2, cv.height * 0.42, cv.height * 0.95);
  }, [helmet, suit]);
  return (
    <div className="lc-driver">
      <canvas ref={ref} width={72} height={72} aria-hidden="true" />
      <span className="mono">{name}</span>
    </div>
  );
}

/** A small 3D picture of a car (lists). */
function CarThumb({ look }: { look: CarLook }) {
  const url = useMemo(() => thumbnail(look), [look]);
  return url ? <img src={url} width={160} height={73} className="lc-thumb" alt="" /> : <span className="lc-thumb" />;
}

/** The background: the chosen strip with the selected car on a slow turntable. */
function CarStage({ look, env, big }: { look: CarLook; env: string; big: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const root = rootRef.current;
    if (!cv || !root) return;
    let stage: Stage3D;
    try {
      stage = new Stage3D(cv);
    } catch {
      return;
    }
    stageRef.current = stage;
    const size = (): void => stage.resize(root.clientWidth, root.clientHeight, Math.min(2, window.devicePixelRatio || 1));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(root);
    return () => {
      ro.disconnect();
      stage.dispose();
      stageRef.current = null;
    };
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setEnv(env);
    stage.setCar(0, look);
    const reduced = prefersReduced();
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33 || document.hidden) return;
      t += (now - last) / 1000;
      last = now;
      stage.renderShowcase(t, big ? t * 0.3 - 0.9 : -0.9);
    };
    if (reduced || !big) stage.renderShowcase(0, -0.9);
    else raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [look, env, big]);
  return (
    <div ref={rootRef} className="lc-stage" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

function ResultScreen({ o, today, challenge, save, onAgain, onGarage, onMenu, triesLeft }: { o: Outcome; today: string; challenge?: ChallengeSpec; save: Save; onAgain: () => void; onGarage: () => void; onMenu: () => void; triesLeft: number }) {
  const mine = o.result.racers[0];
  const theirs = o.result.racers[1];
  const p = o.plan;
  const title = mine.fault === 'red' ? 'Red light!' : mine.fault === 'dnf' ? 'Did not finish' : o.won ? (p.opponent?.boss && o.rankUp ? 'Division champion!' : 'You win!') : 'Beaten';
  const d = save.daily[today];
  const line = resultLine(o);
  const share = `Launch Control #${dailyNumber(today)} 🏁\n${line}\nBest today: ${fmtCash(d?.best ?? 0)} (${d?.tries ?? 0} ${d?.tries === 1 ? 'run' : 'runs'})\n${window.location.origin}/games/${SLUG}`;
  return (
    <main className="lc-sheet lc-panel lc-result">
      <h2 className={`lc-title lc-verdict${o.won ? ' is-win' : ''}`}>{title}</h2>
      {o.failures.length > 0 && <p className="lc-warn">💥 {FAILURE_TEXT[o.failures[0]!]}</p>}
      <div className="lc-times mono">
        <div>
          <span>ET</span>
          <b>{mine.et !== null ? `${fmtEt(mine.et)} s` : '–'}</b>
        </div>
        <div>
          <span>Reaction</span>
          <b>{mine.fault === 'red' ? 'red' : `${Math.round(mine.reaction * 1000)} ms`}</b>
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
      </div>
      <p className="lc-sub">
        {p.oppName}: {theirs.et !== null ? `${fmtEt(theirs.et)} s, ${Math.round(theirs.reaction * 1000)} ms reaction` : theirs.fault === 'red' ? 'red light' : 'did not finish'}
        {o.result.winner !== null && o.result.margin > 0 ? ` · margin ${fmtEt(o.result.margin)} s` : ''}
      </p>
      <p className="lc-score mono">
        Score {fmtCash(o.score)}
        {o.newBest ? ' · New best!' : ''}
      </p>
      {(p.mode === 'daily' || p.mode === 'challenge') && <ResultLine line={line} label={`${title}. ${mine.et !== null ? `${fmtEt(mine.et)} seconds` : 'no time'}.`} />}
      {p.opponent && (
        <ul className="lc-ledger mono">
          <li>
            <span>Purse</span>
            <b>+${fmtCash(o.cash.purse)}</b>
          </li>
          {p.stake > 0 && (
            <li>
              <span>Wager</span>
              <b className={o.cash.wager < 0 ? 'is-bad' : ''}>
                {o.cash.wager < 0 ? '−' : '+'}${fmtCash(Math.abs(o.cash.wager))}
              </b>
            </li>
          )}
          {o.cash.bonus > 0 && (
            <li>
              <span>First-win bonus</span>
              <b>+${fmtCash(o.cash.bonus)}</b>
            </li>
          )}
          {MATERIALS.filter((m) => o.mats[m]).length > 0 && (
            <li>
              <span>Materials</span>
              <b>
                {MATERIALS.filter((m) => o.mats[m]).map((m) => (
                  <span key={m}>
                    {MATERIAL_INFO[m].emoji}
                    {o.mats[m]}{' '}
                  </span>
                ))}
              </b>
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
      {o.rankUp && <p className="lc-rankup">🏆 Rank {save.rank} of {LADDER.length}: {save.rank < LADDER.length ? `next up ${LADDER[save.rank]!.name}` : 'you are the King of the strip'}</p>}
      <div className="lc-actions">
        {p.mode === 'challenge' && challenge ? (
          <a className="lc-btn lc-primary" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
            See the scoreboard
          </a>
        ) : (
          <button className="lc-btn lc-primary" autoFocus onClick={onAgain} disabled={p.mode === 'daily' && triesLeft <= 0}>
            {p.mode === 'daily' ? (triesLeft > 0 ? `Run again (${triesLeft} left)` : 'No runs left today') : o.rankUp ? 'Next opponent' : 'Race again'}
          </button>
        )}
        {p.mode === 'daily' && <ShareButton text={share} />}
        {p.mode !== 'challenge' && (
          <button className="lc-btn" onClick={onGarage}>
            Garage
          </button>
        )}
        {p.mode !== 'challenge' && (
          <button className="lc-btn" onClick={onMenu}>
            Menu
          </button>
        )}
      </div>
    </main>
  );
}

function resultLine(o: Outcome): string {
  const m = o.result.racers[0];
  if (m.fault === 'red') return '🔴💨';
  if (m.et === null) return '💥🚗';
  const shifts = '🟢'.repeat(m.perfect) + '🟡'.repeat(Math.max(0, m.shifts - m.perfect));
  return `${o.won ? '🏆' : '🥈'} ${shifts || '⚡'} ${fmtEt(m.et)}s`;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="lc-btn" onClick={() => void shareOrCopy({ title: 'Launch Control', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

// ---- the race itself

function RaceScreen({ plan, look, oppLook, myName, paused, setPaused, onFinish, sfx }: { plan: Plan; look: CarLook; oppLook: CarLook; myName: string; paused: boolean; setPaused: (p: boolean) => void; onFinish: (r: RaceResult) => void; sfx: () => Sfx }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const [hint, setHint] = useState('Hold to rev');
  const onFinishRef = useRef(onFinish);
  const setPausedRef = useRef(setPaused);
  useEffect(() => {
    pausedRef.current = paused;
    onFinishRef.current = onFinish;
    setPausedRef.current = setPaused;
  });

  useEffect(() => {
    const gl = glRef.current;
    const hudCanvas = hudRef.current;
    const root = rootRef.current;
    if (!gl || !hudCanvas || !root) return;
    let stage: Stage3D | null = null;
    try {
      stage = new Stage3D(gl);
    } catch {
      stage = null;
    }
    stage?.setEnv(plan.env);
    stage?.setCar(0, look);
    stage?.setCar(1, oppLook);
    const hctx = hudCanvas.getContext('2d')!;
    const race = new Race([plan.me, plan.opp], [{ kind: 'live' }, plan.oppDriver], plan.seed);
    const popups: Hud['popups'] = [];
    let banner: Hud['banner'] = { text: 'GET READY', color: '#ffd23f' };
    let bannerUntil = 1.0;
    let clock = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let finishedAt = -1;
    let lastHint = '';
    let audioAt = 0;
    let w = 1;
    let h = 1;
    let dpr = 1;
    const window0 = launchWindow(plan.me);
    const size = (): void => {
      w = root.clientWidth;
      h = root.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      stage?.resize(w, h, dpr);
      hudCanvas.width = Math.floor(w * dpr);
      hudCanvas.height = Math.floor(h * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(root);
    const s = sfx();

    const onEvents = (evs: ReturnType<Race['step']>): void => {
      for (const e of evs) {
        switch (e.type) {
          case 'amber':
            s.amber();
            break;
          case 'green':
            s.green();
            banner = null;
            break;
          case 'launch':
            if (e.i === 0) {
              const r = race.racers[0];
              const rt = Math.round(r.reaction * 1000);
              popups.push({ text: rt < 120 ? `${rt} ms · LASER` : rt < 250 ? `${rt} ms` : `${rt} ms · slow`, at: clock, color: rt < 120 ? '#06d6a0' : rt < 250 ? '#fff' : '#ffb703' });
            }
            break;
          case 'spin':
            if (e.i === 0) {
              s.squeal();
              popups.push({ text: 'WHEELSPIN', at: clock, color: '#ffb703' });
            }
            break;
          case 'shift':
            if (e.i === 0) {
              s.shift();
              if (e.quality === 'perfect') {
                s.perfect();
                popups.push({ text: 'PERFECT', at: clock, color: '#06d6a0' });
              } else if (e.quality === 'early') popups.push({ text: 'EARLY', at: clock, color: '#ffb703' });
              else if (e.quality === 'late') popups.push({ text: 'LATE', at: clock, color: '#e63946' });
            }
            break;
          case 'limiter':
            if (e.i === 0) s.limiter();
            break;
          case 'red':
            if (e.i === 0) {
              s.red();
              banner = { text: 'RED LIGHT', sub: 'You left before green', color: '#e63946' };
              bannerUntil = 99;
            }
            break;
          case 'fail':
            if (e.i === 0) {
              s.fail();
              banner = { text: 'BREAKDOWN', sub: FAILURE_TEXT[e.part], color: '#e63946' };
              bannerUntil = clock + 2;
            }
            break;
          case 'finish': {
            const r = race.racers[e.i];
            if (e.i === 0) {
              const other = race.racers[1];
              const won = other.phase !== 'done' || other.fault !== null || r.reaction + r.et <= other.reaction + other.et;
              s.finish(won);
              banner = { text: won ? 'YOU WIN' : 'BEATEN', sub: `${fmtEt(r.et)} s · ${Math.round(r.trap * 3.6)} km/h`, color: won ? '#06d6a0' : '#ffb703' };
              bannerUntil = 99;
            }
            break;
          }
        }
      }
    };

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (pausedRef.current || document.hidden) {
        s.quiet();
        return;
      }
      dt = Math.min(dt, 0.1);
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 24) {
        acc -= DT;
        steps++;
        clock += DT;
        if (race.done) {
          if (finishedAt < 0) finishedAt = clock;
          else if (clock - finishedAt > 1.8) {
            cancelAnimationFrame(raf);
            raf = 0;
            s.quiet();
            onFinishRef.current(race.result());
            return;
          }
          continue;
        }
        onEvents(race.step());
      }
      const me = race.racers[0];
      const opp = race.racers[1];
      if (clock >= bannerUntil && banner && bannerUntil < 99) banner = null;
      const hh = me.phase === 'staging' ? (race.green ? 'LET GO!' : me.pedal ? 'Hold… let go at green' : 'Hold to rev') : me.phase === 'done' ? '' : me.gear >= plan.me.gears ? 'Top gear: flat out' : 'Tap to shift';
      if (hh !== lastHint) {
        lastHint = hh;
        setHint(hh);
      }
      if (clock - audioAt > 0.05) {
        audioAt = clock;
        const frac = me.phase === 'done' && me.fault ? 0 : me.dead ? 0 : me.rpm / plan.me.redline;
        s.engine(frac, me.phase === 'running' ? 1 : 0.3);
      }
      const state = (r: typeof me): CarState => ({ x: r.x, v: r.v, rpm: r.rpm, redline: r.spec.redline, spinning: r.spinLeft > 0, dead: r.dead, red: r.fault === 'red' });
      stage?.renderRace([state(me), state(opp)], race.ambersLit, race.green, clock, dt);
      hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHud(hctx, w, h, {
        t: clock,
        tacho: { rpm: me.rpm, redline: plan.me.redline, gear: me.gear, gears: plan.me.gears, v: me.v, window: me.phase === 'staging' ? window0 : null, staging: me.phase === 'staging', perfectFrom: PERFECT_FROM },
        progress: [me.x / DISTANCE, opp.x / DISTANCE],
        names: [myName, plan.oppName],
        banner,
        popups,
      });
      while (popups.length && clock - popups[0]!.at > 1.2) popups.shift();
    };
    raf = requestAnimationFrame(frame);

    const down = (): void => {
      const r = race.racers[0];
      if (r.phase === 'staging') race.pedal(0, true);
      else race.tap(0);
    };
    const up = (): void => race.pedal(0, false);
    const key = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setPausedRef.current(!pausedRef.current);
        return;
      }
      if (pausedRef.current) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
        e.preventDefault();
        if (e.type === 'keydown' && !e.repeat) down();
        if (e.type === 'keyup') up();
      }
    };
    const pdown = (e: PointerEvent): void => {
      if (pausedRef.current || (e.target as HTMLElement).closest('.lc-pause')) return;
      e.preventDefault();
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
      down();
    };
    const pup = (): void => up();
    const blur = (): void => up();
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    root.addEventListener('pointerdown', pdown);
    root.addEventListener('pointerup', pup);
    root.addEventListener('pointercancel', pup);
    window.addEventListener('blur', blur);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      root.removeEventListener('pointerdown', pdown);
      root.removeEventListener('pointerup', pup);
      root.removeEventListener('pointercancel', pup);
      window.removeEventListener('blur', blur);
      s.quiet();
      stage?.dispose();
    };
    // One race per mount: the plan and looks are fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = hint === 'Tap to shift' ? 'SHIFT' : hint === 'LET GO!' ? 'GO' : hint === 'Top gear: flat out' ? 'FLAT OUT' : 'REV';
  return (
    <div ref={rootRef} className="lc-race">
      <canvas ref={glRef} className="lc-canvas" aria-label="Drag strip. Hold to rev, let go at green, tap to shift." />
      <canvas ref={hudRef} className="lc-canvas lc-hud" aria-hidden="true" />
      <button className="lc-pause" onClick={() => setPaused(true)} aria-label="Pause">
        <span />
        <span />
      </button>
      <div className="lc-hint mono" aria-live="polite">
        {hint}
      </div>
      <div className="lc-pedal" aria-hidden="true">
        <span>{label}</span>
      </div>
    </div>
  );
}
