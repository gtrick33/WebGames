import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, formatCountdown, hashString, msUntilMidnight } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { Coach, useCoach } from '../../components/Coach';
import { ResultLine } from '../../components/ResultLine';
import { THEMES, themeById, thingById, type Theme } from './bank';
import { Parcel, type Mood } from './art';
import { COACH_BUTTONS, coachSteps } from './coach';
import { answer, answerLine, dailyRound, EPOCH, makeRound, scoreOf, stillFitting, validRound, type Round } from './logic';
import { createSfx, type Sfx } from './sound';
import { UI, type Ui } from './words';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.whatsit';
type Mode = 'daily' | 'endless' | 'challenge';
type Phase = 'ask' | 'lineup' | 'done';

interface DailyRecord {
  score: number;
  solved: boolean;
  questions: number;
  /** The answers (🟩/🟥) for the share text. */
  line: string;
  /** true: started, not finished (it resumes from `progress`). */
  open?: boolean;
}
/** Today's daily so far, saved as you go. */
interface Progress {
  day: string;
  round: Round;
  asked: string[];
  phase: 'ask' | 'lineup';
  crossed: string[];
}
/** A friends' challenge round, saved as you go: a reload or Restart carries on, a finished one stays finished. */
interface ChallengeRecord {
  round: Round;
  asked: string[];
  phase: Phase;
  crossed: string[];
  pick: string | null;
  /** A "Today's daily" challenge whose daily was already played: that result is the round's score. */
  counted?: DailyRecord;
}
interface Save {
  best: number;
  rounds: number;
  solved: number;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  /** By `${challenge.id}:${challenge.round}`, the newest 30. */
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, rounds: 0, solved: 0, daily: {}, challenges: {}, muted: false });
const strings = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string');
const num = (v: unknown, max = 1e7): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const dailyRecord = (v: Partial<DailyRecord>): DailyRecord => ({ score: num(v.score, 1000), solved: v.solved === true, questions: num(v.questions, 99), line: typeof v.line === 'string' ? v.line.slice(0, 60) : '', ...(v.open === true ? { open: true } : {}) });
/** Asked question ids the round's theme still has (a later deploy may have changed a question). */
const knownQuestions = (round: Round, asked: string[]): string[] => {
  const qs = new Set(themeById(round.theme)!.questions.map((q) => q.id));
  return [...new Set(asked)].filter((q) => qs.has(q));
};

/** The stored save, checked field by field. `fallback` is used when storage can't be read (blocked, empty or damaged). */
function loadSave(fallback?: Save): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null && fallback) return fallback;
    const o = JSON.parse(raw ?? '{}') as Partial<Save>;
    const s = emptySave();
    s.best = num(o.best, 1000);
    s.rounds = num(o.rounds);
    s.solved = Math.min(s.rounds, num(o.solved));
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = dailyRecord(v);
    const p = o.progress;
    if (p && typeof p.day === 'string' && (p.phase === 'ask' || p.phase === 'lineup') && validRound(p.round) && strings(p.asked, 20) && strings(p.crossed, 12) && p.crossed.every((id) => p.round.lineup.includes(id)))
      s.progress = { day: p.day, round: p.round, asked: knownQuestions(p.round, p.asked), phase: p.phase, crossed: p.crossed.slice() };
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, c] of Object.entries(o.challenges).slice(-30)) {
        if (!/^[\w-]{1,64}:\d{1,4}$/.test(k) || !c || typeof c !== 'object' || !validRound(c.round)) continue;
        if ((c.phase !== 'ask' && c.phase !== 'lineup' && c.phase !== 'done') || !strings(c.asked, 20) || !strings(c.crossed, 12)) continue;
        const round = c.round;
        const pick = typeof c.pick === 'string' && round.lineup.includes(c.pick) ? c.pick : null;
        const counted = c.counted && typeof c.counted === 'object' ? { ...dailyRecord(c.counted), open: undefined } : undefined;
        // A finished round needs its pick (or the daily result it counted) to show the result.
        if (c.phase === 'done' && !pick && !counted) continue;
        s.challenges[k] = { round, asked: knownQuestions(round, c.asked), phase: c.phase, crossed: c.crossed.filter((id) => round.lineup.includes(id)), pick, ...(counted ? { counted } : {}) };
      }
    return s;
  } catch {
    return fallback ?? emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
/** Adds or replaces one challenge round, keeping the newest 30. */
const withChallenge = (all: Record<string, ChallengeRecord>, key: string, rec: ChallengeRecord): Record<string, ChallengeRecord> => {
  const rest = Object.entries(all).filter(([k]) => k !== key);
  return Object.fromEntries([...rest.slice(-29), [key, rec]]);
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

interface Play {
  mode: Mode;
  /** The daily this round counts as: today's daily, or a "Today's daily" challenge's day. */
  day: string | null;
  round: Round;
  asked: string[];
  phase: Phase;
  crossed: string[];
  pick: string | null;
  /** A practice round on a random theme: "Another one" picks a new random theme. */
  random?: boolean;
  /** Tells rounds apart, so a round carried on after another one ran reports its start again. */
  run: number;
  counted?: DailyRecord;
}

const recordOf = (p: Play): ChallengeRecord => ({ round: p.round, asked: p.asked, phase: p.phase, crossed: p.crossed, pick: p.pick, ...(p.counted ? { counted: p.counted } : {}) });

/** The challenge round to show when the game opens: a saved one carries on, otherwise a new one starts. */
function challengePlay(challenge: ChallengeSpec, s: Save): Play {
  const day = challenge.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(challenge.day) ? challenge.day : null;
  const rec = s.challenges[`${challenge.id}:${challenge.round}`];
  const base = { mode: 'challenge' as const, day, run: 1 };
  if (rec?.phase === 'done') return { ...base, ...rec };
  if (day) {
    // "Today's daily": it is that day's daily (one attempt for both). Already played: that result counts.
    const d = s.daily[day];
    if (d && !d.open) return { ...base, round: dailyRound(day, hashString), asked: [], phase: 'done', crossed: [], pick: null, counted: d };
    if (rec) return { ...base, ...rec };
    const kept = d?.open && s.progress?.day === day ? s.progress : null;
    return { ...base, round: kept?.round ?? dailyRound(day, hashString), asked: kept?.asked ?? [], phase: kept?.phase ?? 'ask', crossed: kept?.crossed ?? [], pick: null };
  }
  if (rec) return { ...base, ...rec };
  return { ...base, round: makeRound(challenge.seed), asked: [], phase: 'ask', crossed: [], pick: null };
}

/**
 * Whether a key press is meant for the game: not typed into a field, and pressed with focus inside `root`
 * (or nowhere in particular), so the site's own dialogs and fields keep their keys.
 */
function forGame(e: KeyboardEvent, root: Element | null | undefined): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t === document.body || t === document.documentElement) return true;
  if (!root?.contains(t)) return false;
  return !t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

export default function Game({ host, restartKey, challenge, lang, pauseKey }: GameModuleProps) {
  return <Whatsit key={restartKey} host={host} challenge={challenge} lang={basicLang(lang)} pauseKey={pauseKey} />;
}

function Whatsit({ host, challenge, lang, pauseKey }: { host: GameHost; challenge?: ChallengeSpec; lang: BasicLang; pauseKey?: number }) {
  const u = UI[lang];
  const ckey = challenge ? `${challenge.id}:${challenge.round}` : '';
  // The day moves on at midnight while the game is open: re-read it on a timer and when the tab comes back.
  const [today, setToday] = useState(() => dayKey());
  const [first] = useState(() => {
    const s = loadSave();
    return { save: s, play: challenge ? challengePlay(challenge, s) : null };
  });
  const [save, setSave] = useState<Save>(first.save);
  const saveRef = useRef(save);
  /** Changes the save: always on top of what is stored now (another tab may have written since). */
  const commit = useCallback((f: (s: Save) => Save) => {
    const s = f(loadSave(saveRef.current));
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [play, setPlay] = useState<Play | null>(first.play);
  const [newBest, setNewBest] = useState(false);
  // ☰ pauses the round (a sheet over it); "Main menu" parks it, and the menu offers to carry on.
  const [paused, setPaused] = useState(false);
  const [parked, setParked] = useState<Play | null>(null);
  const coach = useCoach('whatsit');
  const runs = useRef(1);
  /** The round the arcade was last told started (null once it ended). */
  const live = useRef<number | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const tick = (): void => setToday(dayKey());
    const t = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Today's daily was started but its saved round is gone (storage lost or damaged): settle it once, at 0,
  // so the arcade still counts the day. It never comes back. (A "Today's daily" challenge keeps its own copy.)
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    const secret = dailyRound(today, hashString).secret;
    if (!rec?.open || cur.progress?.day === today || Object.values(cur.challenges).some((c) => c.phase !== 'done' && c.round.secret === secret)) return;
    commit((s) => ({ ...s, daily: { ...s.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: 0, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A challenge round is saved from its first screen, so leaving and coming back never gives a second try.
  // A "Today's daily" challenge whose daily was already played reports that result at once.
  useEffect(() => {
    if (!challenge || !first.play || loadSave(saveRef.current).challenges[ckey]) return;
    const p = first.play;
    commit((s) => ({
      ...s,
      challenges: withChallenge(s.challenges, ckey, recordOf(p)),
      daily: p.day && !s.daily[p.day] ? { ...s.daily, [p.day]: { score: 0, solved: false, questions: 0, line: '', open: true } } : s.daily,
    }));
    if (p.counted) {
      const c = p.counted;
      host.report({ type: 'end', score: c.score, stats: c.solved ? { questions: c.questions } : {}, challenge: { id: challenge.id, round: challenge.round } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the arcade when a round's first screen shows (not at the first question: reading counts too).
  useEffect(() => {
    if (!play || play.phase === 'done' || live.current === play.run) return;
    live.current = play.run;
    host.report({ type: 'start' });
  }, [play, host]);

  // Another tab changed the save: take its copy. A daily finished there leaves this tab's stale round.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave(saveRef.current);
      saveRef.current = s;
      setSave(s);
      setPlay((p) => {
        if (!p || p.phase === 'done') return p;
        if (p.mode === 'challenge') {
          const rec = s.challenges[ckey];
          return rec ? { ...p, ...rec } : p;
        }
        if (!p.day) return p;
        const d = s.daily[p.day];
        if (d && !d.open) return null;
        const g = s.progress;
        return g?.day === p.day && g.round.secret === p.round.secret ? { ...p, asked: g.asked, phase: g.phase, crossed: g.crossed } : p;
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [ckey]);

  // The arcade paused the game: show the pause sheet over a round (there is no clock to stop).
  const [seenPause, setSeenPause] = useState(pauseKey);
  if (pauseKey !== seenPause) {
    setSeenPause(pauseKey);
    if (play && play.phase !== 'done') setPaused(true);
  }

  const begin = (mode: Mode, themeId?: string): void => {
    const day = dayKey();
    setToday(day);
    // A parked practice round stays on offer while the daily is played (that one lives in the save).
    if (mode !== 'daily' || parked?.mode === 'daily') setParked(null);
    const run = ++runs.current;
    if (mode === 'daily') {
      // One try: starting today's uses it up; leaving halfway (reload, menu) carries on from the save.
      const cur = loadSave(saveRef.current);
      const kept = cur.daily[day]?.open && cur.progress?.day === day ? cur.progress : null;
      if (!kept && cur.daily[day]) {
        commit((s) => s);
        return;
      }
      const round = kept?.round ?? dailyRound(day, hashString);
      if (!kept) commit((s) => ({ ...s, daily: { ...s.daily, [day]: { score: 0, solved: false, questions: 0, line: '', open: true } }, progress: { day, round, asked: [], phase: 'ask', crossed: [] } }));
      setPlay({ mode, day, round, asked: kept?.asked ?? [], phase: kept?.phase ?? 'ask', crossed: kept?.crossed ?? [], pick: null, run });
    } else {
      setPlay({ mode, day: null, round: makeRound((Math.random() * 2 ** 32) >>> 0, themeId), asked: [], phase: 'ask', crossed: [], pick: null, random: !themeId, run });
    }
    setNewBest(false);
  };

  /** Keeps a daily or challenge round as it goes, so a reload carries on. */
  const keep = (p: Play): void => {
    if (p.phase === 'done') return;
    const day = p.day;
    if (!day && p.mode !== 'challenge') return;
    const phase = p.phase;
    commit((s) => ({
      ...s,
      // Never over another day's daily that is still going.
      progress: day && (!s.progress || s.progress.day === day || !s.daily[s.progress.day]?.open) ? { day, round: p.round, asked: p.asked, phase, crossed: p.crossed } : s.progress,
      challenges: p.mode === 'challenge' ? withChallenge(s.challenges, ckey, recordOf(p)) : s.challenges,
    }));
  };
  const update = (p: Play): void => {
    setPlay(p);
    keep(p);
  };

  const ask = (q: string): boolean | null => {
    if (!play || play.phase !== 'ask' || play.asked.includes(q)) return null;
    update({ ...play, asked: [...play.asked, q] });
    return answer(thingById(play.round.secret)!, q);
  };

  const choose = (id: string): void => {
    if (!play || play.phase !== 'lineup') return;
    const solved = id === play.round.secret;
    const questions = play.asked.length;
    const score = scoreOf(questions, solved);
    const line = answerLine(play.round, play.asked);
    const day = play.day;
    const done: Play = { ...play, phase: 'done', pick: id };
    setNewBest(score > saveRef.current.best);
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      rounds: s.rounds + 1,
      solved: s.solved + (solved ? 1 : 0),
      daily: day ? { ...s.daily, [day]: { score, solved, questions, line } } : s.daily,
      progress: day && s.progress?.day === day ? undefined : s.progress,
      challenges: play.mode === 'challenge' ? withChallenge(s.challenges, ckey, recordOf(done)) : s.challenges,
    }));
    if (solved) sfx().win();
    else sfx().lose();
    // "Fewest questions" and "wrong cards crossed out" only count solved rounds.
    const crossed = play.crossed.filter((x) => x !== play.round.secret).length;
    const stats: Record<string, number> = solved ? { questions, crossed } : {};
    // A "Today's daily" challenge played on its day is today's daily too.
    const daily = play.mode === 'daily' || (!!day && day === dayKey());
    host.report({ type: 'end', score, stats, ...(daily ? { daily: true } : {}), ...(play.mode === 'challenge' && challenge ? { challenge: { id: challenge.id, round: challenge.round } } : {}) });
    live.current = null;
    setPlay(done);
  };

  const mute = (): void => commit((s) => ({ ...s, muted: !s.muted }));
  const labelOf = (p: Play): string => (p.mode === 'daily' ? u.daily(dailyNumber(p.day ?? today)) : p.mode === 'challenge' ? u.challengeRound(challenge?.round ?? 1) : u.practice);
  const toMenu = (): void => {
    if (play && play.phase !== 'done') setParked(play);
    setPaused(false);
    setToday(dayKey());
    setPlay(null);
  };
  const overlays = (
    <div className="whz-layer">
      {paused && (
        <Pause
          u={u}
          muted={save.muted}
          onResume={() => setPaused(false)}
          onHelp={() => {
            setPaused(false);
            coach.show();
          }}
          onMute={mute}
          // A challenge round is one attempt: no way out to the menu from it.
          onMenu={challenge ? undefined : toMenu}
        />
      )}
      {coach.open && <Coach steps={coachSteps(lang)} onClose={coach.close} {...COACH_BUTTONS[lang]} />}
    </div>
  );

  if (!play)
    return (
      <>
        <Menu
          save={save}
          today={today}
          u={u}
          lang={lang}
          parked={parked && parked.mode !== 'daily' ? { label: `${labelOf(parked)} · ${themeById(parked.round.theme)!.emoji}`, questions: parked.asked.length } : null}
          onResume={() => {
            setPlay(parked);
            setParked(null);
          }}
          onPlay={begin}
          onMute={mute}
          onHelp={coach.show}
        />
        {overlays}
      </>
    );

  const theme = themeById(play.round.theme)!;
  const label = labelOf(play);
  if (play.phase === 'done')
    return (
      <Result
        play={play}
        theme={theme}
        u={u}
        lang={lang}
        label={label}
        newBest={newBest}
        share={play.mode === 'daily' ? shareText(play, theme, u, lang) : null}
        challenge={challenge}
        onAgain={() => begin('endless', play.random ? undefined : theme.id)}
        onMenu={toMenu}
      />
    );
  if (play.phase === 'lineup')
    return (
      <>
        <Lineup
          play={play}
          theme={theme}
          u={u}
          lang={lang}
          label={label}
          onCross={(id) => {
            sfx().tick();
            update({ ...play, crossed: play.crossed.includes(id) ? play.crossed.filter((x) => x !== id) : [...play.crossed, id] });
          }}
          onPick={choose}
          onMenu={() => setPaused(true)}
        />
        {overlays}
      </>
    );
  return (
    <>
      <Ask play={play} theme={theme} u={u} lang={lang} label={label} sfx={sfx} onAsk={ask} onReady={() => update({ ...play, phase: 'lineup' })} onMenu={() => setPaused(true)} />
      {overlays}
    </>
  );
}

/** The share text. Its first line is the preview's title, so it says the theme and verdict in words. */
function shareText(play: Play, theme: Theme, u: Ui, lang: BasicLang): string {
  const solved = play.pick === play.round.secret;
  const line = answerLine(play.round, play.asked);
  return `Whatsit #${dailyNumber(play.day ?? dayKey())} · ${theme.name[lang]} · ${u.questions(play.asked.length)} · ${u.shareVerdict(solved)}${line ? `\n${line}` : ''}\n${window.location.origin}/games/whatsit`;
}

// ------------------------------------------------------------------ screens

function Menu({ save, today, u, lang, parked, onResume, onPlay, onMute, onHelp }: { save: Save; today: string; u: Ui; lang: BasicLang; parked: { label: string; questions: number } | null; onResume: () => void; onPlay: (m: Mode, theme?: string) => void; onMute: () => void; onHelp: () => void }) {
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today;
  const theme = themeById(dailyRound(today, hashString).theme)!;
  return (
    <div className="whz whz-menu">
      <div className="whz-menu-top">
        <button className="whz-icon" onClick={onHelp} aria-label={u.howTo}>
          ?
        </button>
        <button className="whz-icon" onClick={onMute} aria-label={save.muted ? u.soundOn : u.soundOff}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="whz-icon" />
      </div>
      <Parcel mood="idle" className="whz-parcel-big" />
      <h1 className="whz-title">
        Whatsit<span>?</span>
      </h1>
      <p className="whz-tag">{u.tag}</p>
      {parked && (
        <section className="whz-panel">
          <div className="whz-panel-head">
            <b>{u.unfinished}</b>
            <span>
              {parked.label} · {u.questions(parked.questions)}
            </span>
          </div>
          <button className="whz-btn whz-btn-go whz-btn-big" onClick={onResume} autoFocus>
            {u.carryOn}
          </button>
        </section>
      )}
      <section className="whz-panel">
        <div className="whz-panel-head">
          <b>{u.daily(dailyNumber(today))}</b>
          <span>{u.sameForEveryone}</span>
        </div>
        <p className="whz-theme-pill">
          <span>{u.todaysTheme}:</span> {theme.emoji} {theme.name[lang]}
        </p>
        {daily && !going ? (
          <div className="whz-done">
            <p className="whz-muted">{u.dailyDone(daily.solved, daily.questions)}</p>
            {daily.line && <p className="whz-line">{daily.line}</p>}
            <Countdown label={u.nextDaily} />
          </div>
        ) : (
          <button className={`whz-btn whz-btn-big${parked ? '' : ' whz-btn-go'}`} onClick={() => onPlay('daily')}>
            {going ? u.carryOn : u.playDaily}
          </button>
        )}
      </section>
      <section className="whz-panel">
        <div className="whz-panel-head">
          <b>{u.practice}</b>
          <span>{u.practiceBlurb}</span>
        </div>
        <div className="whz-themes" role="group" aria-label={u.practiceBlurb}>
          {THEMES.map((t) => (
            <button key={t.id} className="whz-theme-btn" onClick={() => onPlay('endless', t.id)} aria-label={t.name[lang]} title={t.name[lang]}>
              {t.emoji}
            </button>
          ))}
        </div>
        <button className="whz-btn" onClick={() => onPlay('endless')}>
          🎲 {u.anyTheme}
        </button>
      </section>
      {save.rounds > 0 && <p className="whz-muted">{u.totals(save.rounds, save.solved, save.best)}</p>}
    </div>
  );
}

function Hud({ u, label, questions, onMenu }: { u: Ui; label: string; questions: number; onMenu: () => void }) {
  return (
    <header className="whz-hud">
      <button className="whz-icon" onClick={onMenu} aria-label={u.menu} aria-haspopup="dialog">
        ☰
      </button>
      <span className="whz-hud-label">{label}</span>
      <span className="whz-hud-count mono" aria-live="polite">
        {u.questions(questions)}
      </span>
      <GameMenuButton className="whz-icon" />
    </header>
  );
}

/** How many of a scrolling list's items sit below its visible part (for the "↓ N more" hint). */
function useBelow(asked: number): [RefObject<HTMLUListElement | null>, number, () => void] {
  const ref = useRef<HTMLUListElement>(null);
  const [below, setBelow] = useState(0);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const bottom = el.scrollTop + el.clientHeight;
    let n = 0;
    for (const li of Array.from(el.children) as HTMLElement[]) if (li.offsetTop + li.offsetHeight - 2 > bottom) n++;
    setBelow(n);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (typeof ResizeObserver === 'undefined' || !el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, asked]);
  return [ref, below, measure];
}

function Ask({ play, theme, u, lang, label, sfx, onAsk, onReady, onMenu }: { play: Play; theme: Theme; u: Ui; lang: BasicLang; label: string; sfx: () => Sfx; onAsk: (q: string) => boolean | null; onReady: () => void; onMenu: () => void }) {
  const [say, setSay] = useState<{ mood: Mood; text: string }>({ mood: 'idle', text: u.hello });
  const [flash, setFlash] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [list, below, measure] = useBelow(play.asked.length);
  const readyRef = useRef<HTMLButtonElement>(null);
  const secret = thingById(play.round.secret)!;
  const ask = (q: string, byKey: boolean): void => {
    const yes = onAsk(q);
    if (yes === null) return;
    sfx().ask();
    if (yes) sfx().yep();
    else sfx().nope();
    setSay({ mood: yes ? 'yes' : 'no', text: yes ? u.yep : u.nope });
    setFlash((n) => n + 1);
    // An asked question turns off, which would drop focus to the page: move it to the next question to ask.
    const ids = theme.questions.map((x) => x.id);
    const from = ids.indexOf(q);
    const next = [...ids.slice(from + 1), ...ids.slice(0, from)].find((id) => !play.asked.includes(id));
    const el = next ? list.current?.querySelector<HTMLButtonElement>(`[data-q="${next}"]`) : readyRef.current;
    el?.focus({ preventScroll: true });
    if (byKey) el?.scrollIntoView?.({ block: 'nearest' });
  };
  return (
    <>
      <div className="whz whz-ask">
        <Hud u={u} label={label} questions={play.asked.length} onMenu={onMenu} />
        <p className="whz-theme-pill">
          <span>{u.theme}:</span> {theme.emoji} {theme.name[lang]}
        </p>
        <div className="whz-speak">
          <Parcel mood={say.mood} key={flash} className="whz-parcel-talk" />
          <p className="whz-bubble" role="status">
            {say.text}
          </p>
        </div>
        <div className={`whz-qs-wrap${below ? ' has-more' : ''}`}>
          <ul className="whz-qs" ref={list} onScroll={measure}>
            {theme.questions.map((q) => {
              const asked = play.asked.includes(q.id);
              const yes = answer(secret, q.id);
              return (
                <li key={q.id}>
                  <button className={`whz-q${asked ? (yes ? ' is-yes' : ' is-no') : ''}`} data-q={q.id} onClick={(e) => ask(q.id, e.detail === 0)} disabled={asked} aria-label={asked ? `${q.text[lang]} ${yes ? u.yes : u.no}` : q.text[lang]}>
                    <span>{q.text[lang]}</span>
                    {asked && <b>{yes ? `✓ ${u.yes}` : `✗ ${u.no}`}</b>}
                  </button>
                </li>
              );
            })}
          </ul>
          {below > 0 && (
            <span className="whz-more" aria-hidden="true">
              ↓ {u.more(below)}
            </span>
          )}
        </div>
        <p className="whz-muted whz-hint">{u.askHint}</p>
        <button className="whz-btn whz-btn-ready" ref={readyRef} onClick={() => setConfirm(true)}>
          {u.ready} →
        </button>
      </div>
      {confirm && (
        <Sheet labelledBy="whz-ready-title" onClose={() => setConfirm(false)}>
          <Parcel mood="think" className="whz-parcel-talk" />
          <h2 id="whz-ready-title">{u.readyTitle}</h2>
          <p className="whz-muted">{u.readyBody}</p>
          <button className="whz-btn whz-btn-go whz-btn-big" onClick={onReady} autoFocus>
            {u.readyGo}
          </button>
          <button className="whz-btn whz-btn-big" onClick={() => setConfirm(false)}>
            {u.keepAsking}
          </button>
        </Sheet>
      )}
    </>
  );
}

function Clues({ play, theme, u, lang }: { play: Play; theme: Theme; u: Ui; lang: BasicLang }) {
  const secret = thingById(play.round.secret)!;
  if (play.asked.length === 0) return <p className="whz-muted">{u.noClues}</p>;
  return (
    <ul className="whz-clues" aria-label={u.yourClues}>
      {play.asked.map((id) => {
        const q = theme.questions.find((x) => x.id === id)!;
        const yes = answer(secret, id);
        return (
          <li key={id} className={yes ? 'is-yes' : 'is-no'} title={q.text[lang]}>
            {yes ? '✓' : '✗'} {q.short[lang]}
          </li>
        );
      })}
    </ul>
  );
}

function Lineup({ play, theme, u, lang, label, onCross, onPick, onMenu }: { play: Play; theme: Theme; u: Ui; lang: BasicLang; label: string; onCross: (id: string) => void; onPick: (id: string) => void; onMenu: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  // The daily and a challenge round are one try: their pick asks once more.
  const [sure, setSure] = useState(false);
  const oneTry = play.mode !== 'endless';
  const left = play.round.lineup.filter((id) => !play.crossed.includes(id)).length;
  const card = open ? thingById(open) : undefined;
  const close = (): void => {
    setOpen(null);
    setSure(false);
  };
  return (
    <>
      <div className="whz whz-lineup">
        <Hud u={u} label={label} questions={play.asked.length} onMenu={onMenu} />
        <div className="whz-lineup-head">
          <h2>{u.lineupTitle}</h2>
          <span className="whz-left mono">{u.left(left)}</span>
        </div>
        <Clues play={play} theme={theme} u={u} lang={lang} />
        <p className="whz-muted">{u.lineupHint}</p>
        <ul className="whz-cards">
          {play.round.lineup.map((id) => {
            const t = thingById(id)!;
            const crossed = play.crossed.includes(id);
            return (
              <li key={id}>
                <button className={`whz-card${crossed ? ' is-crossed' : ''}`} onClick={() => setOpen(id)} aria-label={`${t.name[lang]}${crossed ? `, ${u.crossedOut}` : ''}. ${t.def[lang]}`}>
                  <b>{t.name[lang]}</b>
                  <span>{t.def[lang]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {card && open && !sure && (
        // The sheet opens under the finger: a double-tap on the card must not land on a button in it.
        <Sheet labelledBy="whz-card-title" onClose={close} guardMs={350}>
          <h2 id="whz-card-title" className="whz-sheet-name">
            {card.name[lang]}
          </h2>
          <p>{card.def[lang]}</p>
          <button
            className="whz-btn whz-btn-big"
            onClick={() => {
              onCross(open);
              close();
            }}
          >
            {play.crossed.includes(open) ? u.bringBack : `✕ ${u.crossOut}`}
          </button>
          <button className="whz-btn whz-btn-quiet" onClick={close} autoFocus>
            {u.close}
          </button>
          <button className="whz-btn whz-btn-go whz-btn-big whz-btn-pick" onClick={() => (oneTry ? setSure(true) : onPick(open))}>
            {u.pickThis}
          </button>
        </Sheet>
      )}
      {card && open && sure && (
        <Sheet key="sure" labelledBy="whz-sure-title" onClose={close} guardMs={350}>
          <Parcel mood="think" className="whz-parcel-talk" />
          <h2 id="whz-sure-title">{u.confirmPick(card.name[lang])}</h2>
          <p className="whz-muted">{u.confirmBody}</p>
          <button className="whz-btn whz-btn-big" onClick={() => setSure(false)} autoFocus>
            {u.back}
          </button>
          <button className="whz-btn whz-btn-go whz-btn-big whz-btn-pick" onClick={() => onPick(open)}>
            {u.confirmYes}
          </button>
        </Sheet>
      )}
    </>
  );
}

function Result({ play, theme, u, lang, label, newBest, share, challenge, onAgain, onMenu }: { play: Play; theme: Theme; u: Ui; lang: BasicLang; label: string; newBest: boolean; share: string | null; challenge?: ChallengeSpec; onAgain: () => void; onMenu: () => void }) {
  const secret = thingById(play.round.secret)!;
  const counted = play.counted;
  const solved = counted ? counted.solved : play.pick === play.round.secret;
  const score = counted ? counted.score : scoreOf(play.asked.length, solved);
  const questions = counted ? counted.questions : play.asked.length;
  const fitting = new Set(stillFitting(play.round, play.asked));
  const picked = play.pick ? thingById(play.pick) : undefined;
  const line = counted ? counted.line : answerLine(play.round, play.asked);
  return (
    <div className="whz whz-result">
      <p className="whz-eyebrow">
        {label} · {theme.emoji} {theme.name[lang]}
      </p>
      <Parcel mood={solved ? 'yes' : 'no'} className="whz-parcel-big" />
      <p className={`whz-verdict ${solved ? 'is-yes' : 'is-no'}`}>{solved ? u.solved : u.missed}</p>
      <p className="whz-big">{score}</p>
      <p className="whz-muted">
        {u.outOf(questions)}
        {newBest ? ` · ${u.newBest}` : ''}
      </p>
      {counted && <p className="whz-muted">{u.dailyCounts}</p>}
      {line && <ResultLine line={line} label={u.yourClues} />}
      <div className="whz-reveal">
        <span>{u.itWas}</span>
        <b>{secret.name[lang]}</b>
        <p>{secret.def[lang]}</p>
      </div>
      {!solved && picked && <p className="whz-muted">{u.youPicked(picked.name[lang])}</p>}
      {!counted && (
        <ul className="whz-review">
          {play.round.lineup.map((id) => {
            const t = thingById(id)!;
            return (
              <li key={id} className={id === play.round.secret ? 'is-secret' : fitting.has(id) ? 'is-fit' : ''} title={fitting.has(id) ? u.fitsClues : undefined}>
                {fitting.has(id) ? '✓ ' : ''}
                {t.name[lang]}
              </li>
            );
          })}
        </ul>
      )}
      <div className="whz-row">
        {play.mode === 'challenge' && challenge ? (
          // A challenge round is one attempt: its way on is the scoreboard, not the menu.
          <a className="whz-btn whz-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
            {u.scoreboard}
          </a>
        ) : play.mode === 'daily' ? (
          share && <ShareButton text={share} u={u} />
        ) : (
          <button className="whz-btn whz-btn-go" onClick={onAgain} autoFocus>
            {u.again}
          </button>
        )}
        {play.mode !== 'challenge' && (
          <button className="whz-btn" onClick={onMenu}>
            {u.menu}
          </button>
        )}
      </div>
      {play.mode === 'daily' && <Countdown label={u.nextDaily} />}
    </div>
  );
}

// ------------------------------------------------------------------ sheets

const FOCUSABLE = 'button:not(:disabled), a[href], input, [tabindex]:not([tabindex="-1"])';

/**
 * A dialog over the game; Escape or a tap outside closes it. Tab stays inside it, and closing it gives focus
 * back to what opened it. `guardMs`: clicks right after it opens are ignored (a double-tap's second tap).
 */
function Sheet({ labelledBy, onClose, guardMs = 0, children }: { labelledBy: string; onClose: () => void; guardMs?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [opened] = useState(() => performance.now());
  // What had focus before the sheet (read before its autoFocus button takes it).
  const [back] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = ref.current;
      if (!el || !forGame(e, el.parentElement)) return;
      if (e.key === 'Escape' && !e.repeat) {
        e.preventDefault();
        close.current();
      } else if (e.key === 'Tab') {
        const all = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!all.length) return;
        const at = all.indexOf(document.activeElement as HTMLElement);
        const to = at < 0 ? (e.shiftKey ? all.length - 1 : 0) : e.shiftKey ? (at === 0 ? all.length - 1 : -1) : at === all.length - 1 ? 0 : -1;
        if (to < 0) return;
        e.preventDefault();
        all[to]!.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [back]);
  const tooSoon = (e: ReactMouseEvent): void => {
    if (guardMs && performance.now() - opened < guardMs) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  return (
    <div className="whz-sheet" ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClickCapture={tooSoon} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="whz-sheet-card">{children}</div>
    </div>
  );
}

/** The sheet ☰ opens over a round: carry on, the walkthrough, sound, or back to the menu (the round waits there). */
function Pause({ u, muted, onResume, onHelp, onMute, onMenu }: { u: Ui; muted: boolean; onResume: () => void; onHelp: () => void; onMute: () => void; onMenu?: () => void }) {
  return (
    <Sheet labelledBy="whz-pause-title" onClose={onResume}>
      <Parcel mood="idle" className="whz-parcel-talk" />
      <h2 id="whz-pause-title">{u.paused}</h2>
      <button className="whz-btn whz-btn-go whz-btn-big" onClick={onResume} autoFocus>
        {u.resume}
      </button>
      <button className="whz-btn whz-btn-big" onClick={onHelp}>
        {u.howTo}
      </button>
      <button className="whz-btn whz-btn-big" onClick={onMute}>
        {muted ? `🔇 ${u.soundOn}` : `🔊 ${u.soundOff}`}
      </button>
      {onMenu && (
        <button className="whz-btn whz-btn-big" onClick={onMenu}>
          {u.mainMenu}
        </button>
      )}
    </Sheet>
  );
}

function ShareButton({ text, u }: { text: string; u: Ui }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="whz-btn whz-btn-go" onClick={() => void shareOrCopy({ title: 'Whatsit', text }).then((o) => setMsg(o === 'copied' ? u.copied : ''))} autoFocus>
      {msg || u.share}
    </button>
  );
}

/** "Next Whatsit in 07:12:45", ticking each second (in the game's language). */
function Countdown({ label }: { label: string }) {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p className="whz-muted">
      {label} <b className="mono">{formatCountdown(ms)}</b>
    </p>
  );
}
