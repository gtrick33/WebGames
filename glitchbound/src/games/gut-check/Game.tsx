import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { answerIsMore, categoryOf, chain, emojiOf, nameOf, resultLine, valueOf, type Card, type Pair } from './logic';
import { formatIn, formatValue, unitOf } from './bank';
import { CHAIN, KEY, pruneRounds, readSave, writeSave, type Save } from './save';
import { createSfx, type Sfx } from './sound';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const EPOCH = '2026-10-19';
/** Dailies and challenges from this day on use the chain that never repeats a pairing; earlier ones keep their cards. */
const NO_REPEATS_FROM = '2026-11-10';
type Mode = 'daily' | 'endless' | 'challenge';

/** A run's cards: endless runs (`day` null) always get the new chain, dated ones by their day. */
const cardsFor = (seed: number, day: string | null): Pair[] => chain(seed, CHAIN, day !== null && (day === '' || day < NO_REPEATS_FROM) ? 1 : 2);
const dailyCards = (day: string): Pair[] => cardsFor(hashString(`gut-check:${day}`), day);
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

interface Run {
  pairs: Pair[];
  i: number;
  phase: 'ask' | 'right' | 'wrong';
  /** The call the player made on the current pair. */
  call: 'more' | 'less' | null;
  /** The daily this run is (a daily, or a "Today's daily" challenge played as the day's one try): filed under that day. */
  day?: string;
}

/** Keys typed into the page (search, a name field, a dialog) or outside the game are not calls. */
function keyForGame(e: KeyboardEvent, root: HTMLElement | null): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target;
  if (!(t instanceof Element) || t === document.body || t === document.documentElement) return true;
  if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"]')) return false;
  return !root || root.contains(t);
}

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <GutCheck key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

/** How a challenge round opens: where it stands in the save (new, under way, or already over). */
function openRound(save: Save, challenge: ChallengeSpec, today: string): { run: Run; over: boolean; note: string; link: boolean } {
  const key = `${challenge.id}:${challenge.round}`;
  const cday = challenge.mode === 'daily' && challenge.day ? challenge.day : null;
  const pairs = cday ? dailyCards(cday) : cardsFor(challenge.seed, challenge.day ?? '');
  const ended = (done: number, missed: boolean, note: string): { run: Run; over: boolean; note: string; link: boolean } => {
    const miss = missed || done < 1;
    return { run: { pairs, i: Math.min(pairs.length - 1, miss ? done : done - 1), phase: miss ? 'wrong' : 'right', call: null }, over: true, note, link: false };
  };
  const rec = save.rounds[key];
  if (rec?.done !== undefined) return ended(rec.done, rec.missed ?? true, 'You already played this round.');
  // "Today's daily": the day's own cards, and one try for both.
  const daily = cday ? save.daily[cday] : undefined;
  const resumable = cday !== null && daily?.open === true && save.progress?.day === cday;
  if (daily && !resumable && !rec) return ended(daily.best, true, 'Your daily result counts here.');
  const link = cday !== null && cday === today && (resumable || !daily);
  const i = resumable ? save.progress!.i : (rec?.i ?? 0);
  return { run: { pairs, i, phase: 'ask', call: null, ...(link ? { day: cday } : {}) }, over: false, note: '', link };
}

function GutCheck({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  // The day is read on use: a tab left open over midnight moves on to the new daily.
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const check = (): void => setToday(dayKey());
    const t = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  const [save, setSave] = useState<Save>(readSave);
  const saveRef = useRef(save);
  /** Every write starts from the stored save, so a second tab's changes are kept. */
  const commit = useCallback((change: (s: Save) => Save): Save => {
    const s = change(readSave());
    saveRef.current = s;
    setSave(s);
    writeSave(s);
    return s;
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const rec = saveRef.current.daily[today];
    if (!rec?.open || saveRef.current.progress?.day === today) return;
    commit((cur) => ({ ...cur, daily: { ...cur.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const roundKey = challenge ? `${challenge.id}:${challenge.round}` : '';
  const [opened] = useState(() => (challenge ? openRound(save, challenge, today) : null));
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [run, setRun] = useState<Run | null>(opened?.run ?? null);
  const [over, setOver] = useState(opened?.over ?? false);
  const [note, setNote] = useState(opened?.note ?? '');
  const [newBest, setNewBest] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // No clock: nothing to pause.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) setPauseSeen(pauseKey);

  // A challenge round starts when its first card shows (once per round; a reopened round that is
  // under way carries on from the card it reached, one that is over just shows its result).
  useEffect(() => {
    if (!opened || !challenge) return;
    const r = opened.run;
    if (opened.note === 'Your daily result counts here.') {
      const done = saveRef.current.daily[challenge.day]?.best ?? 0;
      commit((cur) => ({ ...cur, rounds: pruneRounds({ ...cur.rounds, [roundKey]: { i: r.i, done, missed: true } }) }));
      host.report({ type: 'start' });
      host.report({ type: 'end', score: done, stats: {}, challenge: { id: challenge.id, round: challenge.round } });
      return;
    }
    if (opened.over) return;
    commit((cur) => ({
      ...cur,
      rounds: pruneRounds({ ...cur.rounds, [roundKey]: { i: r.i } }),
      ...(opened.link && r.day && !cur.daily[r.day] ? { daily: { ...cur.daily, [r.day]: { best: 0, tries: 1, open: true } }, progress: { day: r.day, i: r.i } } : {}),
    }));
    host.report({ type: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another tab changed the save: show it, and leave a daily that tab finished or moved past.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY) return;
      const s = readSave();
      saveRef.current = s;
      setSave(s);
      if (!run || over || !run.day || mode === 'challenge') return;
      const rec = s.daily[run.day];
      if (!rec?.open || (s.progress?.day === run.day && s.progress.i > run.i)) setRun(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [run, over, mode]);

  const begin = (m: Mode): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (menu, reload) is
    // fine, it carries on from the same card, but it can never be started over.
    const day = dayKey();
    setToday(day);
    const cur = readSave();
    const kept = m === 'daily' && cur.daily[day]?.open && cur.progress?.day === day ? cur.progress.i : null;
    if (m === 'daily' && kept === null) {
      if (cur.daily[day]) {
        saveRef.current = cur;
        return setSave(cur);
      }
      commit((s) => ({ ...s, daily: { ...s.daily, [day]: { best: 0, tries: 1, open: true } }, progress: { day, i: 0 } }));
    }
    setMode(m);
    setOver(false);
    setNote('');
    setNewBest(false);
    const pairs = m === 'challenge' && challenge ? cardsFor(challenge.seed, challenge.day ?? '') : m === 'daily' ? dailyCards(day) : cardsFor(randomSeed(), null);
    setRun({ pairs, i: kept ?? 0, phase: 'ask', call: null, ...(m === 'daily' ? { day } : {}) });
    host.report({ type: 'start' });
  };

  const finish = (r: Run, streak: number, missed: boolean): void => {
    let before = 0;
    commit((cur) => {
      before = cur.best;
      return {
        ...cur,
        best: Math.max(cur.best, streak),
        runs: cur.runs + 1,
        daily: r.day ? { ...cur.daily, [r.day]: { best: streak, tries: 1 } } : cur.daily,
        progress: r.day && cur.progress?.day === r.day ? undefined : cur.progress,
        rounds: mode === 'challenge' ? pruneRounds({ ...cur.rounds, [roundKey]: { i: r.i, done: streak, missed } }) : cur.rounds,
      };
    });
    setNewBest(streak > before);
    const end = { type: 'end' as const, score: streak, stats: {} };
    // A daily started before midnight is kept as its own day's, but it doesn't tick today's daily.
    const daily = r.day !== undefined && r.day === dayKey();
    host.report({ ...end, ...(daily ? { daily: true } : {}), ...(mode === 'challenge' && challenge ? { challenge: { id: challenge.id, round: challenge.round } } : {}) });
  };

  const call = (c: 'more' | 'less'): void => {
    if (!run || run.phase !== 'ask') return;
    const pair = run.pairs[run.i]!;
    const right = answerIsMore(pair) === (c === 'more');
    setRun({ ...run, phase: right ? 'right' : 'wrong', call: c });
    if (right) sfx().right(run.i + 1);
    else {
      sfx().wrong();
      navigator.vibrate?.(70);
    }
    // A miss (or the last card) ends the run: keep the result now, even if the player leaves during the reveal.
    if (!right) finish(run, run.i, true);
    else if (run.i + 1 >= run.pairs.length) finish(run, run.i + 1, false);
    else if (run.day || mode === 'challenge')
      commit((cur) => ({
        ...cur,
        ...(run.day ? { progress: { day: run.day, i: run.i + 1 } } : {}),
        ...(mode === 'challenge' ? { rounds: pruneRounds({ ...cur.rounds, [roundKey]: { i: run.i + 1 } }) } : {}),
      }));
  };

  // After the reveal: the next pair, or the end-of-run screen.
  useEffect(() => {
    if (!run || run.phase === 'ask' || over) return;
    const t = window.setTimeout(
      () => {
        if (run.phase === 'wrong' || run.i + 1 >= run.pairs.length) return setOver(true);
        setRun({ ...run, i: run.i + 1, phase: 'ask', call: null });
      },
      run.phase === 'right' ? 1100 : 1600,
    );
    return () => window.clearTimeout(t);
  }, [run, over]);

  useEffect(() => {
    if (!run || over) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!keyForGame(e, rootRef.current)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '1' || e.key === 'm' || e.key === 'M') call('more');
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '2' || e.key === 'l' || e.key === 'L') call('less');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!run) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit((cur) => ({ ...cur, muted: !cur.muted }))} />;

  const pair = run.pairs[run.i]!;
  const cat = categoryOf(pair.left);
  const streak = run.phase === 'right' ? run.i + 1 : run.i;
  const cleared = run.phase === 'right' && run.i + 1 >= run.pairs.length;
  const daily = run.day ? save.daily[run.day] : undefined;
  const shareDay = run.day ?? today;

  return (
    <div className="gc" ref={rootRef}>
      <div className="gc-hud" aria-live="polite">
        <span className="game-menu-pair">
          {/* A challenge round is one attempt: no way out to the game's own menu mid-round. */}
          {mode !== 'challenge' && (
            <button className="gc-icon" onClick={() => setRun(null)} aria-label="Menu">
              ☰
            </button>
          )}
          <GameMenuButton className="gc-icon" />
        </span>
        <div className="gc-score">
          <b>{streak}</b>
          <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : run.day ? `Daily #${dailyNumber(run.day)} · streak` : `Best ${save.best} · streak`}</span>
        </div>
        <span className="gc-topic">{cat.question}</span>
      </div>
      <div className="gc-stack">
        <CardView key={`l${run.i}`} card={pair.left} shown />
        <div className="gc-vs" aria-hidden="true">
          vs
        </div>
        <CardView key={`r${run.i}`} card={pair.right} shown={run.phase !== 'ask'} verdict={run.phase === 'ask' ? null : run.phase} />
      </div>
      <div className="gc-calls">
        <button className="gc-call is-more" onClick={() => call('more')} disabled={run.phase !== 'ask'}>
          ▲ {cat.more}
        </button>
        <button className="gc-call is-less" onClick={() => call('less')} disabled={run.phase !== 'ask'}>
          ▼ {cat.less}
        </button>
      </div>
      <p className="gc-help">
        <b>{nameOf(pair.right)}</b>: {cat.more.toLowerCase()} or {cat.less.toLowerCase()} than {nameOf(pair.left)}?
      </p>
      {over && (
        <div className="gc-over">
          <h2>{cleared ? 'You cleared all 300 cards!' : streak >= 15 ? 'Gut of steel!' : streak >= 7 ? 'Trust that gut!' : 'Gut feeling: wrong'}</h2>
          <p className="gc-big">{streak}</p>
          <p className="gc-muted">right in a row {newBest ? '· New best!' : `· best ${save.best}`}</p>
          {run.phase === 'wrong' && (
            // The missed pair stays readable: the end card covers the two cards.
            <div className="gc-miss" aria-label="The card you missed">
              {run.call && (
                <span className="gc-miss-call">
                  You said <b>{run.call === 'more' ? cat.more : cat.less}</b>
                </span>
              )}
              <span>
                {emojiOf(pair.right)} <b>{nameOf(pair.right)}</b> {formatValue(cat, valueOf(pair.right))}
              </span>
              <span>
                {emojiOf(pair.left)} <b>{nameOf(pair.left)}</b> {formatValue(cat, valueOf(pair.left))}
              </span>
            </div>
          )}
          <ResultLine line={resultLine(streak, run.phase === 'wrong')} label={`${streak} right in a row`} />
          {note && <p className="gc-muted">{note}</p>}
          {run.day && daily && (
            <p className="gc-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="gc-row">
            {mode === 'challenge' && challenge ? (
              <a className="gc-btn gc-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="gc-btn gc-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Gut Check #${dailyNumber(shareDay)} 🎯\n${resultLine(daily.best, true)}\n${daily.best} in a row\n${window.location.origin}/games/gut-check`} />}
            <button className="gc-btn" onClick={() => setRun(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One card: the thing, and its number (counting up when it is revealed). */
function CardView({ card, shown, verdict = null }: { card: Card; shown: boolean; verdict?: 'right' | 'wrong' | null }) {
  const cat = categoryOf(card);
  const v = valueOf(card);
  return (
    <div className={`gc-card${verdict ? ` is-${verdict}` : ''}`}>
      <span className="gc-emoji" aria-hidden="true">
        {emojiOf(card)}
      </span>
      <b className="gc-name">{nameOf(card)}</b>
      <span className="gc-value">{shown ? <CountUp to={v} format={(x) => formatIn(cat, unitOf(cat, v), x)} instant={!verdict} years={!!cat.years} /> : '?'}</span>
    </div>
  );
}

function CountUp({ to, format, instant: still, years }: { to: number; format: (v: number) => string; instant: boolean; years: boolean }) {
  // Tiny numbers (a snail, a bee) just appear: counting up through 0.0 reads wrong.
  const instant = still || to < 10;
  // The count runs in the final number's unit (see CardView), from a fifth of it: never "about 0 g".
  const [v, setV] = useState(instant ? to : years ? to - 60 : to * 0.2);
  useEffect(() => {
    if (instant) return;
    let raf = 0;
    const t0 = performance.now();
    const from = years ? to - 60 : to * 0.2;
    const tick = (now: number): void => {
      const k = Math.min(1, (now - t0) / 650);
      const e = 1 - (1 - k) ** 3;
      setV(k >= 1 ? to : years ? Math.round(from + (to - from) * e) : from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, instant, years]);
  // Mid-count values are rounded by the format, in the final number's unit.
  return <>{format(v)}</>;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="gc-btn" onClick={() => void shareOrCopy({ title: 'Gut Check', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress : null;
  return (
    <div className="gc gc-menu">
      <div className="gc-menu-top">
        <button className="gc-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="gc-icon" />
      </div>
      <div className="gc-logo" aria-hidden="true">
        <span>🐘</span>
        <i>vs</i>
        <span>🦛</span>
      </div>
      <h1 className="gc-title">
        Gut <span>Check</span>
      </h1>
      <p className="gc-tag">Two things, one number. Is the next one bigger or smaller? Trust your gut and keep the streak going.</p>
      <section className="gc-card-menu">
        <div className="gc-card-head">
          <b>Daily #{dailyNumber(today)}</b>
          <span>{going ? `In progress · ${going.i} in a row so far` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best} in a row` : 'The same cards for everyone · one try a day'}</span>
        </div>
        {going ? (
          <button className="gc-btn gc-btn-go gc-btn-big" onClick={() => onPlay('daily')}>
            Continue today’s cards
          </button>
        ) : daily ? (
          <div className="gc-done">
            {daily.best > 0 && <ShareButton text={`Gut Check #${dailyNumber(today)} 🎯\n${resultLine(daily.best, true)}\n${daily.best} in a row\n${window.location.origin}/games/gut-check`} />}
            <NextDaily className="gc-muted" />
          </div>
        ) : (
          <button className="gc-btn gc-btn-go gc-btn-big" onClick={() => onPlay('daily')}>
            Play today’s cards
          </button>
        )}
      </section>
      <section className="gc-card-menu">
        <div className="gc-card-head">
          <b>Endless</b>
          <span>A fresh shuffle every run</span>
        </div>
        <button className="gc-btn gc-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="gc-muted">
        Best streak {save.best} · {save.runs} {save.runs === 1 ? 'run' : 'runs'}
      </p>
      <p className="gc-muted gc-small">People, places, animals, food and history. Every number is rounded; pairs are always far apart.</p>
    </div>
  );
}
