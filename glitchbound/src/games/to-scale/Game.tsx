import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { glyph } from './glyphs';
import { isBull, LIVES, makeShot, makeShots, mark, MAX_POINTS, MISS_POINTS, percentRight, pointsFor, ratioText, rng, SHOTS, type Shot } from './logic';
import { artBox, measured, sizeText, THINGS, type Thing } from './objects';
import { labelWidth, layoutLabels } from './layout';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.to-scale';
const EPOCH = '2026-10-19';
const TINTS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#ff4fc8', '#7b4dff', '#00c2ff'];
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  bestEndless: number;
  runs: number;
  /** `open` true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  daily: Record<string, { best: number; tries: number; line: string; open?: boolean }>;
  /** Today's shots so far, saved at every lock-in. */
  progress?: { day: string; played: Played[] };
  /** Friends' challenge rounds by `${id}:${round}`: shots so far, and the result once done. */
  challenges: Record<string, ChallengeRec>;
  muted: boolean;
}
interface ChallengeRec {
  played: Played[];
  done: boolean;
  score?: number;
  line?: string;
  /** The round was a daily challenge already played as that day's daily: its result counts. */
  fromDaily?: boolean;
}
const emptySave = (): Save => ({ best: 0, bestEndless: 0, runs: 0, daily: {}, challenges: {}, muted: false });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const okPlayed = (x: Played): boolean => !!x && Number.isInteger(x.points) && x.points >= 0 && x.points <= MAX_POINTS && typeof x.guess === 'number' && Number.isFinite(x.guess) && x.guess > 0;
const cleanPlayed = (list: Played[]): Played[] => list.map((x) => ({ points: x.points, guess: x.guess }));

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
        if (DAY.test(d) && v && typeof v === 'object')
          s.daily[d] = { best: n(v.best), tries: n(v.tries), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '', ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    if (p && typeof p.day === 'string' && Array.isArray(p.played) && p.played.length < SHOTS && p.played.every(okPlayed)) s.progress = { day: p.day, played: cleanPlayed(p.played) };
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, v] of Object.entries(o.challenges).slice(-CHALLENGES_KEPT))
        if (v && typeof v === 'object' && Array.isArray(v.played) && v.played.length <= SHOTS && v.played.every(okPlayed))
          s.challenges[k.slice(0, 80)] = {
            played: cleanPlayed(v.played),
            done: v.done === true,
            ...(v.done === true ? { score: Math.min(SHOTS * MAX_POINTS, n(v.score)), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '' } : {}),
            ...(v.fromDaily === true ? { fromDaily: true } : {}),
          };
    return s;
  } catch {
    return emptySave();
  }
}
const CHALLENGES_KEPT = 30;
const writeSave = (s: Save): void => {
  try {
    const keys = Object.keys(s.challenges);
    const challenges = keys.length > CHALLENGES_KEPT ? Object.fromEntries(keys.slice(-CHALLENGES_KEPT).map((k) => [k, s.challenges[k]!])) : s.challenges;
    localStorage.setItem(KEY, JSON.stringify({ ...s, challenges }));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const fmt = (n: number): string => n.toLocaleString('en-US');
/** "a die" → "the die". */
const the = (name: string): string => name.replace(/^(a|an) /, 'the ');
/** A word for a shot's mark, for CSS. */
const grade = (points: number, bull?: boolean): string => ({ '🎯': 'bull', '🟩': 'good', '🟨': 'ok', '🟧': 'far' })[mark(points, bull)] ?? 'off';
/** "Next shot" ignores taps this soon after the reveal (a double tap on "Lock it in"). */
const REVEAL_HOLD_MS = 500;
/** "2.4× the die", "0.7× the die", "1/3 of the die". */
const times = (r: number, name: string): string => `${ratioText(r)}${ratioText(r).startsWith('1/') ? ' of' : ''} ${the(name)}`;

export default function Game({ host, restartKey, challenge }: GameModuleProps) {
  return <ToScale key={restartKey} host={host} challenge={challenge} />;
}

interface Played {
  points: number;
  guess: number;
}

/** A day's daily shots: the same for everyone, and for that day's daily challenges. */
const dailyShots = (day: string): Shot[] => makeShots(hashString(`to-scale:${day}`));
/** The stored save, or null when nothing is stored (or storage is blocked): then the in-memory copy is the save. */
function storedSave(): Save | null {
  try {
    if (localStorage.getItem(KEY) === null) return null;
  } catch {
    return null;
  }
  return loadSave();
}
/** The day's daily went on (or ended) in another tab past this tab's `n` shots. */
const staleDaily = (s: Save, day: string, n: number): boolean => {
  const rec = s.daily[day];
  return !!rec && (!rec.open || (s.progress?.day === day && s.progress.played.length > n));
};
/** How a challenge round picks up on mount. */
type Plan = { kind: 'done'; rec: ChallengeRec } | { kind: 'daily-done'; score: number; line: string } | { kind: 'play'; played: Played[]; claimDaily: boolean };
function challengePlan(s: Save, key: string, day: string): Plan {
  const rec = s.challenges[key];
  if (rec?.done) return { kind: 'done', rec };
  const kept = rec?.played ?? [];
  if (!day) return { kind: 'play', played: kept, claimDaily: false };
  // A daily challenge is that day's daily: one attempt for both.
  const d = s.daily[day];
  const going = d?.open && s.progress?.day === day ? s.progress.played : null;
  if (going) return { kind: 'play', played: going.length >= kept.length ? going : kept, claimDaily: false };
  if (d && !kept.length) return { kind: 'daily-done', score: d.best, line: d.line };
  return { kind: 'play', played: kept, claimDaily: !d };
}

function ToScale({ host, challenge }: { host: GameHost; challenge?: ChallengeSpec }) {
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Every write starts from the stored save (another tab may have changed it), never only from memory. */
  const commit = useCallback((f: (cur: Save) => Save): Save => {
    const s = f(storedSave() ?? saveRef.current);
    saveRef.current = s;
    setSave(s);
    writeSave(s);
    return s;
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const rec = saveRef.current.daily[today];
    if (!rec?.open || saveRef.current.progress?.day === today || (challenge?.mode === 'daily' && challenge.day === today)) return;
    commit((cur) => (cur.daily[today] ? { ...cur, daily: { ...cur.daily, [today]: { ...cur.daily[today]!, open: false } } } : cur));
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const revealTune = useRef(0);
  const revealAt = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      window.clearTimeout(revealTune.current);
      sfxRef.current?.dispose();
    },
    [],
  );

  // A friends' challenge round is one attempt: it is kept at every lock-in and picks up where it was.
  const ckey = challenge ? `${challenge.id}:${challenge.round}` : '';
  const cDay = challenge?.mode === 'daily' && DAY.test(challenge.day ?? '') ? challenge.day : '';
  const [plan] = useState<Plan | null>(() => (challenge ? challengePlan(save, ckey, cDay) : null));
  const planPlayed = plan?.kind === 'play' ? plan.played : plan?.kind === 'done' ? plan.rec.played : [];
  const [screen, setScreen] = useState<'menu' | 'play' | 'result'>(plan ? (plan.kind === 'play' ? 'play' : 'result') : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [shots, setShots] = useState<Shot[]>(() => (challenge ? (cDay ? dailyShots(cDay) : makeShots(challenge.seed)) : []));
  /** The day this round belongs to: a daily started before midnight finishes as that day's. */
  const [roundDay, setRoundDay] = useState(() => cDay || today);
  const endlessRng = useRef<(() => number) | null>(null);
  const [idx, setIdx] = useState(() => Math.min(planPlayed.length, SHOTS - 1));
  const [guess, setGuess] = useState(() => (shots[Math.min(planPlayed.length, SHOTS - 1)]?.start ?? 1));
  const [phase, setPhase] = useState<'aim' | 'reveal'>('aim');
  const [played, setPlayed] = useState<Played[]>(planPlayed);
  const [lives, setLives] = useState(LIVES);
  const [newBest, setNewBest] = useState(false);
  /** A result that isn't this screen's shots: a daily challenge already played as the daily. */
  const [counted, setCounted] = useState<{ score: number; line: string } | null>(() =>
    plan?.kind === 'daily-done' ? { score: plan.score, line: plan.line } : plan?.kind === 'done' && plan.rec.fromDaily ? { score: plan.rec.score ?? 0, line: plan.rec.line ?? '' } : null,
  );
  useEffect(() => {
    if (!challenge || !plan) return;
    if (plan.kind === 'done') return;
    if (plan.kind === 'daily-done') {
      // That day's daily was already played: its result is this round's score, reported once.
      commit((cur) => ({ ...cur, challenges: { ...cur.challenges, [ckey]: { played: [], done: true, score: plan.score, line: plan.line, fromDaily: true } } }));
      host.report({ type: 'end', score: plan.score, stats: {}, challenge: { id: challenge.id, round: challenge.round } });
      return;
    }
    if (plan.claimDaily)
      commit((cur) => ({ ...cur, daily: { ...cur.daily, [cDay]: { best: 0, tries: 1, line: '', open: true } }, progress: { day: cDay, played: plan.played } }));
    host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Midnight: the menu always offers the current day's daily.
  useEffect(() => {
    const fresh = (): void => setToday(dayKey());
    const onVisible = (): void => {
      if (!document.hidden) fresh();
    };
    window.addEventListener('focus', fresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', fresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const begin = (m: Mode): void => {
    // Today's 5 shots are one try a day: starting uses it up. Leaving halfway (Restart, reload) is
    // fine, it carries on with the next shot, but locked-in shots can never be played again.
    const day = dayKey();
    setToday(day);
    const cur = storedSave() ?? saveRef.current;
    const kept = m === 'daily' && cur.daily[day]?.open && cur.progress?.day === day ? cur.progress.played : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[day]) return;
      commit((s) => ({ ...s, daily: { ...s.daily, [day]: { best: 0, tries: 1, line: '', open: true } }, progress: { day, played: [] } }));
    }
    let list: Shot[];
    if (m === 'endless') {
      const r = rng((Math.random() * 2 ** 32) >>> 0);
      endlessRng.current = r;
      list = [makeShot(r)];
    } else list = dailyShots(day);
    const at = kept?.length ?? 0;
    setMode(m);
    setRoundDay(day);
    setShots(list);
    setIdx(at);
    setGuess(list[at]!.start);
    setPhase('aim');
    setPlayed(kept ?? []);
    setLives(LIVES);
    setCounted(null);
    setScreen('play');
    host.report({ type: 'start' });
  };

  const shot = shots[idx];
  const total = counted ? counted.score : played.reduce((a, p) => a + p.points, 0);
  /** The daily this round is (or counts as): the daily itself, or a daily challenge. */
  const dailyDay = mode === 'daily' ? roundDay : mode === 'challenge' ? cDay : '';
  const markOf = (p: Played, i: number): string => mark(p.points, shots[i] ? isBull(p.guess, shots[i].ratio) : undefined);

  /** Takes over a challenge round another tab got further with. */
  const adopt = (rec: ChallengeRec): void => {
    setPlayed(rec.played);
    if (rec.done) {
      if (rec.fromDaily) setCounted({ score: rec.score ?? 0, line: rec.line ?? '' });
      setScreen('result');
      return;
    }
    const at = Math.min(rec.played.length, shots.length - 1);
    setIdx(at);
    setGuess(shots[at]!.start);
    setPhase('aim');
  };
  /** This tab's round fell behind the stored one: leave (daily) or catch up (challenge). True if it did. */
  const catchUp = (s: Save): boolean => {
    if (screen !== 'play') return false;
    if (mode === 'daily' && staleDaily(s, roundDay, played.length)) {
      setScreen('menu');
      return true;
    }
    const rec = mode === 'challenge' ? s.challenges[ckey] : undefined;
    if (rec && (rec.done || rec.played.length > played.length)) {
      adopt(rec);
      return true;
    }
    return false;
  };

  const finish = (list: Played[]): void => {
    const score = list.reduce((a, p) => a + p.points, 0);
    const bullseyes = list.filter((p, i) => isBull(p.guess, shots[i]!.ratio)).length;
    const line = list.map(markOf).join('');
    commit((cur) => {
      setNewBest(score > 0 && (dailyDay ? score > cur.best : mode === 'endless' ? score > cur.bestEndless : false));
      return {
        ...cur,
        best: dailyDay ? Math.max(cur.best, score) : cur.best,
        bestEndless: mode === 'endless' ? Math.max(cur.bestEndless, score) : cur.bestEndless,
        runs: cur.runs + 1,
        daily: dailyDay ? { ...cur.daily, [dailyDay]: { best: score, tries: 1, line } } : cur.daily,
        progress: dailyDay && cur.progress?.day === dailyDay ? undefined : cur.progress,
        challenges: mode === 'challenge' ? { ...cur.challenges, [ckey]: { played: list, done: true, score, line } } : cur.challenges,
      };
    });
    const end = { type: 'end' as const, score, stats: { bullseyes } };
    // Only today's daily counts as the arcade's daily today.
    const daily = dailyDay !== '' && dailyDay === dayKey();
    host.report(mode === 'challenge' && challenge ? { ...end, ...(daily ? { daily } : {}), challenge: { id: challenge.id, round: challenge.round } } : daily ? { ...end, daily } : end);
  };

  const lock = (): void => {
    if (!shot || phase !== 'aim') return;
    const stored = storedSave();
    if (stored && catchUp(stored)) return;
    const points = pointsFor(guess, shot.ratio);
    const list = [...played, { points, guess }];
    const left = mode === 'endless' && points < MISS_POINTS ? lives - 1 : lives;
    setPlayed(list);
    setLives(left);
    setPhase('reveal');
    revealAt.current = performance.now();
    sfx().lock();
    revealTune.current = window.setTimeout(() => sfx().reveal(points), 180);
    // The last shot decides the game: keep the result now, even if the player leaves on its reveal.
    if (mode === 'endless' ? left <= 0 : idx + 1 >= shots.length) finish(list);
    else if (mode !== 'endless')
      commit((cur) => ({
        ...cur,
        ...(dailyDay ? { progress: { day: dailyDay, played: list } } : {}),
        ...(mode === 'challenge' ? { challenges: { ...cur.challenges, [ckey]: { played: list, done: false } } } : {}),
      }));
  };

  const next = (): void => {
    if (phase !== 'reveal') return;
    // A second tap on the spot where "Lock it in" was must not skip the reveal.
    if (performance.now() - revealAt.current < REVEAL_HOLD_MS) return;
    const over = mode === 'endless' ? lives <= 0 : idx + 1 >= shots.length;
    if (over) {
      // Already kept when the last shot was locked in.
      sfx().over();
      return setScreen('result');
    }
    let list = shots;
    if (mode === 'endless' && endlessRng.current && idx + 1 >= shots.length) {
      list = [...shots, makeShot(endlessRng.current, new Set(shots.slice(-12).map((s) => s.target)))];
      setShots(list);
    }
    setIdx(idx + 1);
    setGuess(list[idx + 1]!.start);
    setPhase('aim');
  };

  // Another tab changed the save: show it, and leave or catch up a round that tab got further with.
  const onStored = useRef(catchUp);
  useEffect(() => {
    onStored.current = catchUp;
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave();
      saveRef.current = s;
      setSave(s);
      onStored.current(s);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Keyboard: arrows resize (Shift for bigger steps), Enter locks in / goes on.
  const keys = useRef({ lock, next, phase, shot });
  useEffect(() => {
    keys.current = { lock, next, phase, shot };
  });
  useEffect(() => {
    if (screen !== 'play') return;
    const onKey = (e: KeyboardEvent): void => {
      const k = keys.current;
      if (!k.shot || e.ctrlKey || e.altKey || e.metaKey) return;
      // Keys belong to the game only when meant for it: not typing, not in a dialog, not elsewhere on the page.
      const t = e.target instanceof Element ? e.target : null;
      if (t && t !== document.body) {
        if (t.closest('[role="dialog"],[aria-modal="true"]') || !rootRef.current?.contains(t)) return;
        if (t.matches('input:not([type="range"]),textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
        if ((e.key === 'Enter' || e.key === ' ') && t.matches('button:focus-visible,a:focus-visible')) return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        if (k.phase === 'aim') k.lock();
        else k.next();
        return;
      }
      if (k.phase !== 'aim') return;
      // Shift+arrow for big steps; + and − are always small (a US + carries Shift).
      const step = e.shiftKey && e.key.startsWith('Arrow') ? 1.15 : 1.03;
      const s = k.shot;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '=') setGuess((g) => Math.min(s.max, g * step));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-' || e.key === '−') setGuess((g) => Math.max(s.min, g / step));
      else return;
      e.preventDefault();
      sfx().tick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, sfx]);

  if (screen === 'menu') {
    const todays = save.daily[today];
    const going = todays?.open && save.progress?.day === today ? save.progress.played : null;
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return (
      <div className="ts ts-menu">
        <div className="ts-menu-top">
          <GameMenuButton />
        </div>
        <div className="ts-logo" aria-label="To Scale">
          <span className="ts-logo-small">TO</span>
          <span className="ts-logo-big">SCALE</span>
          <span className="ts-ruler" aria-hidden="true" />
        </div>
        <p className="ts-tag">Two things side by side. One is the wrong size. Make it real.</p>
        <section className="ts-card ts-card-daily">
          <div>
            <b>Daily #{dailyNumber(today)}</b>
            <span>
              {going
                ? `In progress · ${going.length} of ${SHOTS} shots, ${fmt(going.reduce((a, p) => a + p.points, 0))} so far`
                : todays?.open !== undefined
                  ? 'Left unfinished · one try a day'
                  : todays
                    ? `Today: ${fmt(todays.best)} ${todays.line}`
                    : `${SHOTS} shots, the same for everyone today · one try`}
            </span>
            {todays && !going && <NextDaily />}
          </div>
          {going ? (
            <button className="ts-btn ts-btn-go" onClick={() => begin('daily')} autoFocus>
              Carry on
            </button>
          ) : todays ? (
            todays.line && <ShareButton text={`To Scale #${dailyNumber(today)} 📏\n${todays.line}\n${fmt(todays.best)} / ${fmt(SHOTS * MAX_POINTS)}\n${window.location.origin}/games/to-scale`} />
          ) : (
            <button className="ts-btn ts-btn-go" onClick={() => begin('daily')} autoFocus>
              Play today’s 5
            </button>
          )}
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
          {coarse ? 'Drag the corner or the slider, then Lock it in.' : 'Drag the corner, the slider or use the arrow keys. Enter to lock in.'}
        </p>
        <button className="ts-mute" onClick={() => commit((cur) => ({ ...cur, muted: !cur.muted }))} aria-pressed={save.muted}>
          {save.muted ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
      </div>
    );
  }

  if (screen === 'result') {
    const line = counted ? counted.line : played.map(markOf).join('');
    const bullseyes = counted ? [...line].filter((c) => c === '🎯').length : played.filter((p, i) => shots[i] && isBull(p.guess, shots[i].ratio)).length;
    const shots_ = counted ? SHOTS : played.length;
    const shareText = `To Scale #${dailyNumber(roundDay)} 📏\n${line}\n${fmt(total)} / ${fmt(SHOTS * MAX_POINTS)}\n${window.location.origin}/games/to-scale`;
    return (
      <div className="ts ts-result">
        <p className="ts-kicker">{mode === 'daily' ? `Daily #${dailyNumber(roundDay)}` : mode === 'challenge' ? `Challenge · round ${challenge?.round ?? 1}` : `Endless · ${played.length} shots`}</p>
        <p className="ts-total">
          {fmt(total)}
          {mode !== 'endless' && <small> / {fmt(SHOTS * MAX_POINTS)}</small>}
        </p>
        {newBest && <p className="ts-new">New best!</p>}
        {counted && <p className="ts-muted">You played Daily #{dailyNumber(cDay)} already. Your daily result counts here.</p>}
        {line && <ResultLine line={line} label={`${bullseyes} bullseyes out of ${shots_}`} />}
        <p className="ts-muted">🎯 within 10% · 🟩 close · 🟨 not bad · 🟧 far · 🟥 way off</p>
        {mode === 'daily' && <NextDaily className="ts-muted" />}
        <div className="ts-row">
          {mode === 'challenge' && challenge ? (
            <a className="ts-btn ts-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              See the scoreboard
            </a>
          ) : (
            <button className="ts-btn ts-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
              {mode === 'daily' ? 'Play endless' : 'Play again'}
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
    <div className="ts ts-play" ref={rootRef}>
      <header className="ts-hud" aria-live="polite">
        <span>{mode === 'endless' ? Array.from({ length: LIVES }, (_, i) => (i < lives ? '❤️' : '🖤')).join('') : mode === 'daily' ? `Daily #${dailyNumber(roundDay)}` : `⚔️ Round ${challenge?.round ?? 1}`}</span>
        <span className="ts-dots">
          {mode === 'endless' ? `Shot ${idx + 1}` : shots.map((_, i) => <i key={i} className={i < played.length ? `is-${grade(played[i]!.points, isBull(played[i]!.guess, shots[i]!.ratio))}` : i === idx ? 'is-now' : ''} />)}
        </span>
        <span className="ts-hud-end">
          <b>{fmt(total)}</b>
          <GameMenuButton />
        </span>
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
              aria-valuetext={times(guess, ref.name)}
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
                {mark(last.points, isBull(last.guess, shot.ratio))} +{fmt(last.points)}
              </span>
              <span className="ts-acc">{percentRight(last.guess, shot.ratio)}% right</span>
            </p>
            <p className="ts-truth">
              Real size: <b>{sizeText(target.size)} {target.dim}</b>, {times(shot.ratio, ref.name)} ({sizeText(ref.size)} {ref.dim}). You said {ratioText(last.guess)}.
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

/** Room under the floor for the two-line labels, in pixels. */
const LABEL_ROOM = 42;

/**
 * The blueprint: the reference in color on the left, the target's silhouette on the right at the
 * guessed size, both standing on the floor. Each picture's measured side (its width for a length,
 * its height for a height) is the thing's real size. The view zooms to keep both in frame (while you
 * drag the corner handle it only zooms out, when the shape nears the edge). On reveal, the real thing
 * appears at its true size.
 */
function Stage({ shot, guess, reveal, tint, onGuess, onTick }: { shot: Shot; guess: number; reveal: boolean; tint: string; onGuess: (g: number) => void; onTick: () => void }) {
  const ref = THINGS[shot.ref]!;
  const target = THINGS[shot.target]!;
  const el = useRef<HTMLDivElement>(null);
  // Measured before the first paint; nothing is drawn until then (so nothing zooms in from a guess).
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; w: number; h: number; scale: number } | null>(null);
  const [glyphs] = useState(() => ({ ref: glyph(ref, '#ffffff'), target: glyph(target, tint) }));

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
      const g = Math.min(shot.max, Math.max(shot.min, w.guess * Math.exp(-e.deltaY * 0.0015)));
      // Kept here too, so quick wheel events build on each other before the next render.
      w.guess = g;
      w.onGuess(g);
      w.onTick();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [shot]);

  const { w: W, h: H } = dim ?? { w: 1, h: 1 };
  const unit = ref.size;
  const rb = artBox(ref, unit, glyphs.ref?.aspect ?? 1);
  const gb = artBox(target, guess * unit, glyphs.target?.aspect ?? 1);
  const tb = artBox(target, shot.ratio * unit, glyphs.target?.aspect ?? 1);
  const tw = reveal ? Math.max(gb.w, tb.w) : gb.w;
  const th = reveal ? Math.max(gb.h, tb.h) : gb.h;
  const gap = W * 0.08;
  // Room is kept on the right for the corner handle, and under the floor for the labels.
  const HANDLE = 36;
  const floor = Math.min(H * 0.8, H - LABEL_ROOM);
  const fitIn = (hRoom: number, wRoom: number): number => Math.min(hRoom / Math.max(rb.h, th), (wRoom - gap - HANDLE) / (rb.w + tw));
  const fit = fitIn(Math.min(H * 0.66, floor - 12), W * 0.9);
  // While dragging the view holds still, until the shape would leave the frame: then it zooms out.
  const scale = frozen === null ? fit : Math.min(frozen, fitIn(floor - 8, W * 0.98));
  const totalW = rb.w * scale + gap + tw * scale;
  const left = Math.max(W * 0.04, (W - HANDLE - totalW) / 2);
  const refLeft = left;
  const tLeft = left + rb.w * scale + gap;
  const place = (b: { w: number; h: number }, x: number): CSSProperties => ({ left: x, top: floor - b.h * scale, width: b.w * scale, height: b.h * scale });
  // The labels sit under each thing, laid out together so they never overlap.
  const refMid = refLeft + (rb.w * scale) / 2;
  const tMid = tLeft + (tw * scale) / 2;
  const short = (t: Thing): string => t.name.replace(/^(a|an|the) /, '');
  const refSize = sizeText(ref.size);
  const tSize = reveal ? sizeText(target.size) : '?';
  const cap = W * 0.46;
  const labels = layoutLabels(W, refMid, tMid, Math.min(cap, labelWidth(short(ref), refSize)), Math.min(cap, labelWidth(short(target), tSize)));
  const label = (b: { mid: number; width: number }): CSSProperties => ({ left: b.mid, top: floor + 6, maxWidth: b.width });

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
    const k = Math.max(4, px) / long;
    const side = (measured(target, d) * k) / d.scale;
    onGuess(Math.min(shot.max, Math.max(shot.min, side / unit)));
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
          <span className="ts-label" style={label(labels.ref)}>
            <span>{short(ref)}</span>
            <b>{refSize}</b>
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
          <span className="ts-label is-target" style={label(labels.target)}>
            <span>{short(target)}</span>
            <b>{tSize}</b>
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
