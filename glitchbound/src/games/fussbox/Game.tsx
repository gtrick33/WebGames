import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { EndEvent, GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, formatCountdown, hashString, msUntilMidnight } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { cardId, cardOf, correctOf, dailyRound, EXAM_SIZE, likes, makeRound, MAX_TESTS, NEAR_MISS_FROM, resultLine, scoreOf, testCost, type Attr, type Card, type Level, type Round } from './logic';
import { Coach, useCoach } from '../../components/Coach';
import { CardArt, Robot, SymbolIcon, type Mood } from './art';
import { COACH_BUTTONS, coachSteps } from './coach';
import { createSfx, type Sfx } from './sound';
import { cardPhrase, describe, explain, UI, valueName, type Ui } from './words';
import './Game.css';
import { GameMenuButton } from '../../components/GameMenuButton';

const KEY = 'glitchbound.fussbox';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';
type Phase = 'lab' | 'exam' | 'done';
type Mark = boolean | null;

interface DailyRecord {
  score: number;
  correct: number;
  tests: number;
  /** The exam line (🟩/🟥) for the share text. */
  line: string;
  /** true: started, not handed in (it resumes from `progress`). */
  open?: boolean;
}
/** Today's daily so far, saved as you go. */
interface Progress {
  day: string;
  tests: number[];
  phase: 'lab' | 'exam';
  marks: Mark[];
}
/** A friends' challenge round so far, by `${id}:${round}`: a reload carries on, a finished one shows its result. */
interface ChallengeRecord {
  tests: number[];
  phase: Phase;
  marks: Mark[];
  /** Settled by that day's finished daily ("Your daily result counts here"). */
  daily?: true;
}
interface Save {
  best: number;
  rounds: number;
  level: Level;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  challenges: Record<string, ChallengeRecord>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, rounds: 0, level: 2, daily: {}, challenges: {}, muted: false });
const validTests = (t: unknown): t is number[] => Array.isArray(t) && t.length <= MAX_TESTS && t.every((x) => Number.isInteger(x) && x >= 0 && x < 81);
const validMarks = (m: unknown): m is Mark[] => Array.isArray(m) && m.length === EXAM_SIZE && m.every((x) => x === null || typeof x === 'boolean');

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.rounds = n(o.rounds);
    s.level = ([1, 2, 3, 4] as const).find((l) => l === o.level) ?? 2;
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { score: n(v.score), correct: Math.min(EXAM_SIZE, n(v.correct)), tests: n(v.tests), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '', ...(v.open === true ? { open: true } : {}) };
    const p = o.progress;
    if (p && typeof p.day === 'string' && (p.phase === 'lab' || p.phase === 'exam') && validTests(p.tests) && validMarks(p.marks)) s.progress = { day: p.day, phase: p.phase, tests: p.tests.slice(), marks: p.marks.slice() };
    if (o.challenges && typeof o.challenges === 'object')
      for (const [k, c] of Object.entries(o.challenges).slice(-30))
        if (/^[\w-]{1,64}:\d{1,3}$/.test(k) && c && typeof c === 'object' && (c.phase === 'lab' || c.phase === 'exam' || c.phase === 'done') && validTests(c.tests) && validMarks(c.marks))
          s.challenges[k] = { tests: c.tests.slice(), phase: c.phase, marks: c.marks.slice(), ...(c.daily === true ? { daily: true as const } : {}) };
    return s;
  } catch {
    return emptySave();
  }
}
/** The stored save as it is now (another tab may have changed it), or `fallback` when storage holds none. */
function freshSave(fallback: Save): Save {
  try {
    if (localStorage.getItem(KEY) === null) return fallback;
  } catch {
    return fallback;
  }
  return loadSave();
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
const noMarks = (): Mark[] => new Array<Mark>(EXAM_SIZE).fill(null);
const openDaily = (): DailyRecord => ({ score: 0, correct: 0, tests: 0, line: '', open: true });
/** "Fewest tests" only counts an exam aced (a skipped lab with a half-right exam would hold it at 0 for good). */
const statsOf = (correct: number, tests: number): Record<string, number> => (correct === EXAM_SIZE ? { correct, tests } : { correct });

/**
 * Whether a key press is meant for the game: not typed into a field, not in a dialog over the page, and
 * not on the page around the game.
 */
export function keyIsOurs(e: KeyboardEvent, root: Element | null): boolean {
  const t = e.target;
  if (!(t instanceof Element) || t === document.body || t === document.documentElement) return true;
  if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"]')) return false;
  return root?.contains(t) ?? false;
}
const focusVisible = (el: Element): boolean => {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
};

interface Play {
  mode: Mode;
  round: Round;
  tests: number[];
  phase: Phase;
  marks: Mark[];
  /** The daily's day, when this round is that day's daily (a daily, or a Today's daily challenge played today). */
  day?: string;
  /** A Today's daily challenge settled by the finished daily: nothing to play. */
  counted?: boolean;
}

const challengeKey = (c: ChallengeSpec): string => `${c.id}:${c.round}`;

/** A friends' challenge round: carried on from the save, or new (Today's daily challenges play the real daily). */
function challengePlay(save: Save, c: ChallengeSpec, today: string): Play {
  const daily = c.mode === 'daily' && c.day ? c.day : '';
  const round = daily ? dailyRound(daily, hashString) : makeRound(c.seed, 3, c.day >= NEAR_MISS_FROM);
  // Played today, it is today's daily too: one attempt for both.
  const day = daily && daily === today ? daily : undefined;
  const rec = save.challenges[challengeKey(c)];
  if (rec) return { mode: 'challenge', round, tests: rec.tests, phase: rec.phase, marks: rec.marks, day, counted: rec.daily };
  const done = daily ? save.daily[daily] : undefined;
  if (done && !done.open) return { mode: 'challenge', round, tests: [], phase: 'done', marks: noMarks(), counted: true };
  const kept = day && done?.open && save.progress?.day === day ? save.progress : null;
  return { mode: 'challenge', round, tests: kept?.tests ?? [], phase: kept?.phase ?? 'lab', marks: kept?.marks ?? noMarks(), day };
}

/** Which round a start was reported for: resuming the same round never reports a second start. */
const roundKey = (p: Play): string => (p.day ? `daily:${p.day}` : `${p.mode}:${p.round.seed}`);

export default function Game({ host, restartKey, challenge, lang }: GameModuleProps) {
  return <Fussbox key={restartKey} host={host} challenge={challenge} lang={basicLang(lang)} />;
}

function Fussbox({ host, challenge, lang }: { host: GameHost; challenge?: ChallengeSpec; lang: BasicLang }) {
  const u = UI[lang];
  // The day moves on at midnight: re-read when the menu shows, the tab comes back, or a round starts.
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  /** Saves a change made to the stored save as it is now, so a second tab's progress is never overwritten. */
  const commit = useCallback((f: (s: Save) => Save) => {
    const s = f(freshSave(saveRef.current));
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [play, setPlay] = useState<Play | null>(() => (challenge ? challengePlay(save, challenge, today) : null));
  const [newBest, setNewBest] = useState(false);
  // ☰ pauses the round (a sheet over it); "Main menu" parks it, and the menu offers to carry on.
  const [paused, setPaused] = useState(false);
  const [parked, setParked] = useState<Play | null>(null);
  const coach = useCoach('fussbox');
  const started = useRef('');
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(
    () => () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );

  // Today's daily was started but its saved round is gone (storage lost or damaged): settle it once, at 0,
  // so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    if (!rec?.open || cur.progress?.day === today) return;
    commit((c) => ({ ...c, daily: { ...c.daily, [today]: { ...rec, open: false } } }));
    host.report({ type: 'end', score: 0, stats: { correct: 0 }, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A Today's daily challenge when that daily is already done: its result is the challenge score, sent once.
  useEffect(() => {
    if (!challenge || !play?.counted) return;
    const k = challengeKey(challenge);
    const rec = saveRef.current.daily[challenge.day];
    if (saveRef.current.challenges[k] || !rec) return;
    commit((c) => ({ ...c, challenges: { ...c.challenges, [k]: { tests: [], phase: 'done', marks: noMarks(), daily: true } } }));
    host.report({ type: 'end', score: rec.score, stats: statsOf(rec.correct, rec.tests), challenge: { id: challenge.id, round: challenge.round } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another tab changed the save: take it, carry on from its progress, and leave a daily it finished.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = loadSave();
      saveRef.current = s;
      setSave(s);
      setPlay((p) => {
        if (!p || p.phase === 'done') return p;
        const rec = p.mode === 'challenge' && challenge ? s.challenges[challengeKey(challenge)] : undefined;
        if (rec) return { ...p, tests: rec.tests, phase: rec.phase, marks: rec.marks, counted: rec.daily };
        if (!p.day) return p;
        const d = s.daily[p.day];
        if (d && !d.open) return p.mode === 'daily' ? null : p;
        return s.progress?.day === p.day ? { ...p, tests: s.progress.tests, phase: s.progress.phase, marks: s.progress.marks } : p;
      });
    };
    const onBack = (): void => {
      if (document.visibilityState !== 'hidden') setToday(dayKey());
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [challenge]);
  // On the menu, the day (and today's daily) turns over at midnight.
  useEffect(() => {
    if (play) return;
    const t = window.setInterval(() => setToday(dayKey()), 15_000);
    return () => window.clearInterval(t);
  }, [play]);

  const begin = (mode: Mode, level: Level = saveRef.current.level): void => {
    const day = dayKey();
    setToday(day);
    const cur = freshSave(saveRef.current);
    // A parked practice or challenge round stays on offer while the daily is played (that one lives in the save).
    if (mode !== 'daily' || parked?.mode === 'daily') setParked(null);
    if (mode === 'daily') {
      // One try: starting today's uses it up; leaving halfway (reload, menu) carries on from the save.
      const kept = cur.daily[day]?.open && cur.progress?.day === day ? cur.progress : null;
      if (!kept && cur.daily[day]) return commit((c) => c);
      if (!kept) commit((c) => ({ ...c, daily: { ...c.daily, [day]: openDaily() }, progress: { day, tests: [], phase: 'lab', marks: noMarks() } }));
      // A daily carried on in this visit keeps the start it reported (the leaderboard times the whole round).
      setPlay({ mode, round: dailyRound(day, hashString), tests: kept?.tests ?? [], phase: kept?.phase ?? 'lab', marks: kept?.marks ?? noMarks(), day });
    } else {
      if (level !== cur.level) commit((c) => ({ ...c, level }));
      setPlay({ mode, round: makeRound((Math.random() * 2 ** 32) >>> 0, level), tests: [], phase: 'lab', marks: noMarks() });
    }
    setNewBest(false);
  };

  /** Keeps a daily or challenge round as it goes, so a reload carries on (an opened exam stays open). */
  const keep = (p: Play): void => {
    const phase = p.phase;
    if (phase === 'done' || (!p.day && p.mode !== 'challenge')) return;
    commit((cur) => {
      let s = cur;
      const rec = p.day ? s.daily[p.day] : undefined;
      if (p.day && !(rec && !rec.open)) s = { ...s, daily: rec ? s.daily : { ...s.daily, [p.day]: openDaily() }, progress: { day: p.day, tests: p.tests, phase, marks: p.marks } };
      if (p.mode === 'challenge' && challenge) s = { ...s, challenges: { ...s.challenges, [challengeKey(challenge)]: { tests: p.tests, phase: p.phase, marks: p.marks } } };
      return s;
    });
  };
  const update = (p: Play): void => {
    setPlay(p);
    keep(p);
  };
  const start = (p: Play): void => {
    const k = roundKey(p);
    if (started.current === k) return;
    started.current = k;
    host.report({ type: 'start' });
  };

  const feed = (id: number): 'new' | 'known' | 'full' => {
    if (!play || play.phase !== 'lab') return 'full';
    if (play.round.liked.includes(id) || play.round.hated.includes(id) || play.tests.includes(id)) return 'known';
    if (play.tests.length >= MAX_TESTS) return 'full';
    start(play);
    update({ ...play, tests: [...play.tests, id] });
    return 'new';
  };

  const handIn = (): void => {
    if (!play || play.phase !== 'exam' || play.marks.some((m) => m === null)) return;
    const correct = correctOf(play.round, play.marks);
    const tests = play.tests.length;
    const score = scoreOf(correct, tests);
    const line = resultLine(play.round, play.marks);
    const day = play.day;
    setNewBest(score > freshSave(saveRef.current).best);
    // A daily started before midnight is recorded as that day's.
    commit((cur) => ({
      ...cur,
      best: Math.max(cur.best, score),
      rounds: cur.rounds + 1,
      daily: day ? { ...cur.daily, [day]: { score, correct, tests, line } } : cur.daily,
      progress: day && cur.progress?.day === day ? undefined : cur.progress,
      challenges: play.mode === 'challenge' && challenge ? { ...cur.challenges, [challengeKey(challenge)]: { tests: play.tests, phase: 'done', marks: play.marks } } : cur.challenges,
    }));
    if (correct === EXAM_SIZE) sfx().fanfare();
    else sfx().meh();
    const end: EndEvent = { type: 'end', score, stats: statsOf(correct, tests) };
    if (day && day === dayKey()) end.daily = true;
    if (play.mode === 'challenge' && challenge) end.challenge = { id: challenge.id, round: challenge.round };
    host.report(end);
    setPlay({ ...play, phase: 'done' });
  };

  const mute = (): void => commit((cur) => ({ ...cur, muted: !cur.muted }));
  const labelOf = (p: Play): string => (p.mode === 'daily' ? u.daily(dailyNumber(p.day ?? today)) : p.mode === 'challenge' ? u.challengeRound(challenge?.round ?? 1) : `${u.practice} · ${u.levels[p.round.level - 1]}`);
  const showMenu = (): void => {
    setPlay(null);
    setToday(dayKey());
  };
  const toMenu = (): void => {
    if (play && play.phase !== 'done') setParked(play);
    setPaused(false);
    showMenu();
  };
  const overlays = (
    <div className="fbx-layer">
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
          // A challenge round has one attempt: no way out of it from here.
          onMenu={play?.mode === 'challenge' ? undefined : toMenu}
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
          parked={parked && parked.mode !== 'daily' ? { label: labelOf(parked), tests: parked.tests.length } : null}
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

  const label = labelOf(play);
  if (play.phase === 'done' && play.counted && challenge)
    return <Counted rec={save.daily[challenge.day]} u={u} label={label} challenge={challenge} onMenu={showMenu} />;
  if (play.phase === 'done')
    return (
      <Result
        play={play}
        u={u}
        lang={lang}
        label={label}
        newBest={newBest}
        share={play.mode === 'daily' ? `🤖 Fussbox #${dailyNumber(play.day ?? today)} · ${correctOf(play.round, play.marks)}/8 · ${u.tests(play.tests.length)}\n${resultLine(play.round, play.marks)}\n${window.location.origin}/games/fussbox` : null}
        challenge={challenge}
        onAgain={() => begin('endless')}
        onMenu={showMenu}
      />
    );
  if (play.phase === 'exam')
    return (
      <>
        <Exam
          play={play}
          u={u}
          lang={lang}
          label={label}
          onMark={(i, m) => {
            start(play);
            sfx().mark();
            const marks = play.marks.slice();
            marks[i] = marks[i] === m ? null : m;
            update({ ...play, marks });
          }}
          onHandIn={handIn}
          onMenu={() => setPaused(true)}
        />
        {overlays}
      </>
    );
  return (
    <>
      <Lab
        play={play}
        u={u}
        lang={lang}
        label={label}
        sfx={sfx}
        active={!paused && !coach.open}
        onFeed={feed}
        onExam={() => update({ ...play, phase: 'exam' })}
        onMenu={() => setPaused(true)}
      />
      {overlays}
    </>
  );
}

// ------------------------------------------------------------------ pictures

/** "2 pink striped circles": what screen readers hear, and what hovering a card shows. */
const cardName = (id: number, lang: BasicLang): string => cardPhrase(cardOf(id), lang);

// ------------------------------------------------------------------ screens

function Menu({ save, today, u, parked, onResume, onPlay, onMute, onHelp }: { save: Save; today: string; u: Ui; parked: { label: string; tests: number } | null; onResume: () => void; onPlay: (m: Mode, level?: Level) => void; onMute: () => void; onHelp: () => void }) {
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today;
  const level = dailyRound(today, hashString).level;
  return (
    <div className="fbx fbx-menu">
      <div className="fbx-menu-top">
        <button className="fbx-icon" onClick={onHelp} aria-label={u.howTo}>
          ?
        </button>
        <button className="fbx-icon" onClick={onMute} aria-label={save.muted ? u.soundOn : u.soundOff}>
          {save.muted ? '🔇' : '🔊'}
        </button>
        <GameMenuButton className="fbx-icon" />
      </div>
      <Robot mood="idle" className="fbx-robot-big" />
      <h1 className="fbx-title">
        Fuss<span>box</span>
      </h1>
      <p className="fbx-tag">{u.tag}</p>
      {parked && (
        <section className="fbx-panel fbx-panel-resume">
          <div className="fbx-panel-head">
            <b>{u.unfinished}</b>
            <span>
              {parked.label} · {u.tests(parked.tests)}
            </span>
          </div>
          <button className="fbx-btn fbx-btn-go fbx-btn-big" onClick={onResume} autoFocus>
            {u.continueDaily}
          </button>
        </section>
      )}
      <section className="fbx-panel">
        <div className="fbx-panel-head">
          <b>{u.daily(dailyNumber(today))}</b>
          <span>{u.level(level)}</span>
        </div>
        {daily && !going ? (
          <div className="fbx-done">
            <p className="fbx-muted">{u.dailyDone(daily.correct, daily.tests)}</p>
            {daily.line && <p className="fbx-line">{daily.line}</p>}
            <Countdown label={u.nextDaily} />
          </div>
        ) : (
          <>
            <p className="fbx-muted">{u.sameForEveryone}</p>
            <button className={`fbx-btn fbx-btn-big${parked ? '' : ' fbx-btn-go'}`} onClick={() => onPlay('daily')}>
              {going ? u.continueDaily : u.playDaily}
            </button>
          </>
        )}
      </section>
      <section className="fbx-panel">
        <div className="fbx-panel-head">
          <b>{u.practice}</b>
          <span>{u.practiceBlurb}</span>
        </div>
        <div className="fbx-levels" role="group" aria-label={u.practice}>
          {u.levels.map((name, i) => (
            <button key={name} className={`fbx-btn${save.level === i + 1 ? ' is-on' : ''}`} onClick={() => onPlay('endless', (i + 1) as Level)}>
              {name}
            </button>
          ))}
        </div>
      </section>
      {save.rounds > 0 && <p className="fbx-muted">{u.totals(save.rounds, save.best)}</p>}
    </div>
  );
}

/** The sheet ☰ opens over a round: carry on, the walkthrough, sound, or back to the menu (the round waits there). */
function Pause({ u, muted, onResume, onHelp, onMute, onMenu }: { u: Ui; muted: boolean; onResume: () => void; onHelp: () => void; onMute: () => void; onMenu?: () => void }) {
  useEscape(onResume);
  return (
    <div className="fbx-sheet" role="dialog" aria-modal="true" aria-labelledby="fbx-pause-title" onClick={(e) => e.target === e.currentTarget && onResume()}>
      <div className="fbx-sheet-card fbx-pause">
        <Robot mood="idle" className="fbx-robot-talk" />
        <h2 id="fbx-pause-title">{u.paused}</h2>
        <button className="fbx-btn fbx-btn-go fbx-btn-big" onClick={onResume} autoFocus>
          {u.resume}
        </button>
        <button className="fbx-btn fbx-btn-big" onClick={onHelp}>
          {u.howTo}
        </button>
        <button className="fbx-btn fbx-btn-big" onClick={onMute}>
          {muted ? `🔇 ${u.soundOn}` : `🔊 ${u.soundOff}`}
        </button>
        {onMenu && (
          <button className="fbx-btn fbx-btn-big" onClick={onMenu}>
            {u.mainMenu}
          </button>
        )}
      </div>
    </div>
  );
}

/** Escape closes the sheet that calls this. */
function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}

const PICKERS: { attr: Attr; key: 'count' | 'shape' | 'colour' | 'fill' }[] = [
  { attr: 'count', key: 'count' },
  { attr: 'shape', key: 'shape' },
  { attr: 'colour', key: 'colour' },
  { attr: 'fill', key: 'fill' },
];

type Item = { id: number; ex: boolean };

function Lab({ play, u, lang, label, sfx, active, onFeed, onExam, onMenu }: { play: Play; u: Ui; lang: BasicLang; label: string; sfx: () => Sfx; active: boolean; onFeed: (id: number) => 'new' | 'known' | 'full'; onExam: () => void; onMenu: () => void }) {
  const [card, setCard] = useState<Card>({ count: 0, shape: 0, colour: 0, fill: 0 });
  const [say, setSay] = useState<{ mood: Mood; text: string }>({ mood: 'idle', text: u.hello });
  const [flash, setFlash] = useState(0);
  const [all, setAll] = useState(false);
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const id = cardId(card);
  const { round, tests } = play;
  const liked: Item[] = [...round.liked.map((x) => ({ id: x, ex: true })), ...tests.filter((x) => likes(round.rule, cardOf(x))).map((x) => ({ id: x, ex: false }))];
  const hated: Item[] = [...round.hated.map((x) => ({ id: x, ex: true })), ...tests.filter((x) => !likes(round.rule, cardOf(x))).map((x) => ({ id: x, ex: false }))];
  const latest = tests[tests.length - 1];

  const feed = (): void => {
    const got = onFeed(id);
    if (got === 'full') return setSay({ mood: 'think', text: u.tired });
    const yes = likes(round.rule, card);
    if (got === 'new') {
      if (yes) sfx().ding();
      else sfx().buzz();
    }
    setSay({ mood: yes ? 'yes' : 'no', text: got === 'known' ? `${yes ? '✓' : '✗'} ${yes ? u.ding : u.bzzt}` : yes ? u.ding : u.bzzt });
    setFlash((n) => n + 1);
  };
  const random = (): void => {
    sfx().click();
    setCard(cardOf(Math.floor(Math.random() * 81)));
  };
  /** A card from the trays goes back on the bench, and the robot says what it is. */
  const pick = (x: number): void => {
    sfx().click();
    setCard(cardOf(x));
    setAll(false);
    setSay({ mood: 'think', text: u.inspect(likes(round.rule, cardOf(x)), cardName(x, lang)) });
  };

  // Keyboard: Enter feeds the card, R builds a random one (not while a sheet is open over the bench).
  useEffect(() => {
    if (!active || all) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !keyIsOurs(e, rootRef.current)) return;
      // Enter feeds the card, also right after clicking a picker (other buttons, and a picker reached with
      // the keyboard, keep their own Enter).
      const button = e.target instanceof HTMLButtonElement ? e.target : null;
      if (e.key === 'Enter' && (!button || (button.closest('.fbx-pick') !== null && !focusVisible(button)))) {
        e.preventDefault();
        feed();
      } else if (e.key === 'r' || e.key === 'R') random();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="fbx fbx-lab" ref={rootRef}>
        <header className="fbx-hud">
          <button className="fbx-icon" onClick={onMenu} aria-label={u.menu} aria-haspopup="dialog">
            ☰
          </button>
          <span className="fbx-hud-label">{label}</span>
          <span className="fbx-hud-tests mono" aria-live="polite" aria-label={u.tests(tests.length)}>
            {u.testsPill(tests.length, testCost(tests.length))}
          </span>
          <GameMenuButton className="fbx-icon" />
        </header>
        <div className="fbx-speak">
          <Robot mood={say.mood} key={flash} className="fbx-robot-talk" />
          <p className="fbx-bubble" role="status">
            {say.text}
          </p>
        </div>
        <div className="fbx-trays">
          <Tray title={u.likes} tone="yes" items={liked} latest={latest} u={u} lang={lang} onPick={pick} onAll={() => setAll(true)} />
          <Tray title={u.hates} tone="no" items={hated} latest={latest} u={u} lang={lang} onPick={pick} onAll={() => setAll(true)} />
        </div>
        <section className="fbx-builder" aria-label={u.build}>
          <div className="fbx-preview-wrap">
            <CardArt id={id} className="fbx-preview" />
            <p className="fbx-caption">{cardPhrase(card, lang)}</p>
          </div>
          <div className="fbx-pickers">
            {PICKERS.map(({ attr, key }) => (
              <div key={attr} className="fbx-picker" role="radiogroup" aria-labelledby={`${uid}${attr}`}>
                <span className="fbx-picker-name" id={`${uid}${attr}`}>
                  {u[key]}
                </span>
                {[0, 1, 2].map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={card[attr] === v}
                    aria-label={valueName(attr, v, lang)}
                    className={`fbx-pick${card[attr] === v ? ' is-on' : ''}`}
                    onClick={() => {
                      sfx().click();
                      setCard({ ...card, [attr]: v });
                    }}
                  >
                    {attr === 'count' ? <b className="fbx-pick-num">{v + 1}</b> : <SymbolIcon card={{ ...card, [attr]: v }} className="fbx-pick-sym" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
        <div className="fbx-row">
          <button className="fbx-btn" onClick={random} aria-label={u.random} title={u.random}>
            🎲
          </button>
          <button className="fbx-btn fbx-btn-go fbx-btn-feed" onClick={feed} disabled={tests.length >= MAX_TESTS}>
            {u.feed}
          </button>
        </div>
        <button className="fbx-btn fbx-btn-exam" onClick={onExam}>
          {u.ready} →
        </button>
      </div>
      {all && <AllCards liked={liked} hated={hated} latest={latest} u={u} lang={lang} onPick={pick} onClose={() => setAll(false)} />}
    </>
  );
}

const TRAY_CARD = 34;
const TRAY_GAP = 5;

/**
 * One tray (likes or hates): the newest cards first, as many as fit in one row. When there are more, the
 * last spot becomes "+N", which opens every card. Tapping a card puts it back on the bench.
 */
function Tray({ title, tone, items, latest, u, lang, onPick, onAll }: { title: string; tone: 'yes' | 'no'; items: Item[]; latest?: number; u: Ui; lang: BasicLang; onPick: (id: number) => void; onAll: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(Infinity);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => setFit(Math.max(2, Math.floor((el.clientWidth - 4 + TRAY_GAP) / (TRAY_CARD + TRAY_GAP))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const newest = [...items].reverse();
  const more = newest.length > fit;
  const shown = more ? newest.slice(0, fit - 1) : newest;
  return (
    <section className={`fbx-tray is-${tone}`} aria-label={title}>
      <h2>
        {tone === 'yes' ? '✓' : '✗'} {title} <small>{items.length}</small>
      </h2>
      <div className="fbx-tray-cards" ref={ref}>
        {shown.map((x) => (
          <TrayCard key={x.id} item={x} isNew={x.id === latest} u={u} lang={lang} onPick={onPick} />
        ))}
        {more && (
          <button className="fbx-more" onClick={onAll} aria-label={u.seeAll(items.length)} title={u.seeAll(items.length)}>
            +{newest.length - shown.length}
          </button>
        )}
      </div>
    </section>
  );
}

function TrayCard({ item, isNew, u, lang, onPick }: { item: Item; isNew: boolean; u: Ui; lang: BasicLang; onPick: (id: number) => void }) {
  const name = cardName(item.id, lang);
  return (
    <button className={`fbx-tray-card${item.ex ? ' is-example' : ''}${isNew ? ' is-new' : ''}`} onClick={() => onPick(item.id)} aria-label={name} title={item.ex ? `${name} (${u.example})` : name}>
      <CardArt id={item.id} />
    </button>
  );
}

/** Every card so far, liked and hated, big enough to compare: in the order they came, or alike ones together. */
function AllCards({ liked, hated, latest, u, lang, onPick, onClose }: { liked: Item[]; hated: Item[]; latest?: number; u: Ui; lang: BasicLang; onPick: (id: number) => void; onClose: () => void }) {
  const [grouped, setGrouped] = useState(false);
  useEscape(onClose);
  const order = (xs: Item[]): Item[] => (grouped ? [...xs].sort((a, b) => a.id - b.id) : xs);
  const sides: ['yes' | 'no', string, Item[]][] = [
    ['yes', u.likes, liked],
    ['no', u.hates, hated],
  ];
  return (
    <div className="fbx-sheet" role="dialog" aria-modal="true" aria-labelledby="fbx-all-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fbx-sheet-card fbx-all">
        <header className="fbx-all-head">
          <h2 id="fbx-all-title">{u.allCards}</h2>
          <button className="fbx-icon" onClick={onClose} aria-label={u.close} autoFocus>
            ✕
          </button>
        </header>
        <div className="fbx-seg" role="group">
          <button className={grouped ? '' : 'is-on'} aria-pressed={!grouped} onClick={() => setGrouped(false)}>
            {u.inOrder}
          </button>
          <button className={grouped ? 'is-on' : ''} aria-pressed={grouped} onClick={() => setGrouped(true)}>
            {u.grouped}
          </button>
        </div>
        <p className="fbx-muted">{u.allHint}</p>
        {sides.map(([tone, title, xs]) => (
          <section key={tone} className={`fbx-all-side is-${tone}`} aria-label={title}>
            <h3>
              {tone === 'yes' ? '✓' : '✗'} {title} <small>{xs.length}</small>
            </h3>
            <div className="fbx-all-grid">
              {order(xs).map((x) => (
                <TrayCard key={x.id} item={x} isNew={x.id === latest} u={u} lang={lang} onPick={onPick} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Exam({ play, u, lang, label, onMark, onHandIn, onMenu }: { play: Play; u: Ui; lang: BasicLang; label: string; onMark: (i: number, m: boolean) => void; onHandIn: () => void; onMenu: () => void }) {
  const left = play.marks.filter((m) => m === null).length;
  // The last card touched, by name: color has a second cue on touch screens (no hover there).
  const [said, setSaid] = useState<string | null>(null);
  const mark = (i: number, m: boolean): void => {
    setSaid(`${i + 1}: ${cardName(play.round.exam[i]!, lang)}`);
    onMark(i, m);
  };
  return (
    <div className="fbx fbx-exam">
      <header className="fbx-hud">
        <button className="fbx-icon" onClick={onMenu} aria-label={u.menu}>
          ☰
        </button>
        <span className="fbx-hud-label">{label}</span>
        <span className="fbx-hud-tests mono" aria-label={u.tests(play.tests.length)}>
          {u.testsPill(play.tests.length, testCost(play.tests.length))}
        </span>
        <GameMenuButton className="fbx-icon" />
      </header>
      <h2 className="fbx-exam-title">{u.examTitle}</h2>
      <p className="fbx-muted fbx-said" role="status">
        {said ?? u.examHint}
      </p>
      <ol className="fbx-exam-grid">
        {play.round.exam.map((id, i) => (
          <li key={id} className={play.marks[i] === true ? 'is-yes' : play.marks[i] === false ? 'is-no' : ''}>
            {/* The whole card is a target too: it cycles unmarked → ✓ → ✗ → unmarked. */}
            <button className="fbx-exam-card" onClick={() => mark(i, play.marks[i] === null ? true : false)} aria-label={`${i + 1}: ${cardName(id, lang)}`} title={cardName(id, lang)}>
              <CardArt id={id} />
            </button>
            <div className="fbx-yn">
              <button className={`fbx-y${play.marks[i] === true ? ' is-on' : ''}`} onClick={() => mark(i, true)} aria-label={`${i + 1}: ${u.yes}`} aria-pressed={play.marks[i] === true}>
                ✓
              </button>
              <button className={`fbx-n${play.marks[i] === false ? ' is-on' : ''}`} onClick={() => mark(i, false)} aria-label={`${i + 1}: ${u.no}`} aria-pressed={play.marks[i] === false}>
                ✗
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button className="fbx-btn fbx-btn-go fbx-btn-big" onClick={onHandIn} disabled={left > 0}>
        {left > 0 ? u.markAll(left) : u.submit}
      </button>
    </div>
  );
}

function Result({ play, u, lang, label, newBest, share, challenge, onAgain, onMenu }: { play: Play; u: Ui; lang: BasicLang; label: string; newBest: boolean; share: string | null; challenge?: ChallengeSpec; onAgain: () => void; onMenu: () => void }) {
  const correct = correctOf(play.round, play.marks);
  const score = scoreOf(correct, play.tests.length);
  const line = resultLine(play.round, play.marks);
  const [why, setWhy] = useState<{ say: string; parts: string } | null>(null);
  return (
    <div className="fbx fbx-result">
      <p className="fbx-eyebrow">{label}</p>
      <Robot mood={correct === EXAM_SIZE ? 'yes' : correct >= 6 ? 'think' : 'no'} className="fbx-robot-big" />
      <p className="fbx-big">{score}</p>
      <p className="fbx-muted">
        {u.outOf(correct)} · {u.tests(play.tests.length)}
        {newBest ? ` · ${u.newBest}` : ''}
      </p>
      <ResultLine line={line} label={u.outOf(correct)} />
      <div className="fbx-rule">
        <span>{u.ruleWas}</span>
        <b>{describe(play.round.rule, lang)}</b>
      </div>
      <ol className="fbx-review">
        {play.round.exam.map((id, i) => {
          const yes = likes(play.round.rule, cardOf(id));
          return (
            <li key={id} className={play.marks[i] === yes ? 'is-right' : 'is-wrong'}>
              <button onClick={() => setWhy({ say: u.reviewSay(cardName(id, lang), yes, play.marks[i] === yes), parts: explain(play.round.rule, cardOf(id), lang) })} aria-label={cardName(id, lang)} title={cardName(id, lang)}>
                <CardArt id={id} />
                <span>{yes ? '✓' : '✗'}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="fbx-muted fbx-why" role="status">
        {why ? (
          <>
            {why.say}
            <br />
            <b>{why.parts}</b>
          </>
        ) : (
          u.reviewHint
        )}
      </p>
      <div className="fbx-row">
        {play.mode === 'challenge' && challenge ? (
          <a className="fbx-btn fbx-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
            {u.scoreboard}
          </a>
        ) : play.mode === 'daily' ? (
          share && <ShareButton text={share} u={u} />
        ) : (
          <button className="fbx-btn fbx-btn-go" onClick={onAgain} autoFocus>
            {u.again}
          </button>
        )}
        <button className="fbx-btn" onClick={onMenu}>
          {u.menu}
        </button>
      </div>
      {play.mode === 'daily' && <Countdown label={u.nextDaily} />}
    </div>
  );
}

/** A Today's daily challenge whose daily was already played: that result is the score here. */
function Counted({ rec, u, label, challenge, onMenu }: { rec?: DailyRecord; u: Ui; label: string; challenge: ChallengeSpec; onMenu: () => void }) {
  return (
    <div className="fbx fbx-result">
      <p className="fbx-eyebrow">{label}</p>
      <Robot mood={rec?.correct === EXAM_SIZE ? 'yes' : 'think'} className="fbx-robot-big" />
      <p className="fbx-big">{rec?.score ?? 0}</p>
      <p className="fbx-muted">{u.dailyCounts}</p>
      {rec?.line && <p className="fbx-line">{rec.line}</p>}
      <div className="fbx-row">
        <a className="fbx-btn fbx-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
          {u.scoreboard}
        </a>
        <button className="fbx-btn" onClick={onMenu}>
          {u.menu}
        </button>
      </div>
    </div>
  );
}

function ShareButton({ text, u }: { text: string; u: Ui }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="fbx-btn fbx-btn-go" onClick={() => void shareOrCopy({ title: 'Fussbox', text }).then((o) => setMsg(o === 'copied' ? u.copied : ''))} autoFocus>
      {msg || u.share}
    </button>
  );
}

/** "Next Fussbox in 07:12:45", ticking each second (in the game's language). */
function Countdown({ label }: { label: string }) {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p className="fbx-muted">
      {label} <b className="mono">{formatCountdown(ms)}</b>
    </p>
  );
}
