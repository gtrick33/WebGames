import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { ContentLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, formatCountdown, hashString, msUntilMidnight } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { cardId, cardOf, correctOf, dailyRound, EXAM_SIZE, likes, makeRound, MAX_TESTS, resultLine, scoreOf, type Attr, type Card, type Level, type Round } from './logic';
import { Coach, useCoach } from '../../components/Coach';
import { CardArt, COLOURS, Robot, Symbol, type Mood } from './art';
import { COACH_BUTTONS, coachSteps } from './coach';
import { createSfx, type Sfx } from './sound';
import { describe, UI, valueName, type Ui } from './words';
import './Game.css';

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
interface Save {
  best: number;
  rounds: number;
  level: Level;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, rounds: 0, level: 2, daily: {}, muted: false });

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
    if (
      p &&
      typeof p.day === 'string' &&
      (p.phase === 'lab' || p.phase === 'exam') &&
      Array.isArray(p.tests) &&
      p.tests.length <= MAX_TESTS &&
      p.tests.every((t) => Number.isInteger(t) && t >= 0 && t < 81) &&
      Array.isArray(p.marks) &&
      p.marks.length === EXAM_SIZE &&
      p.marks.every((m) => m === null || typeof m === 'boolean')
    )
      s.progress = { day: p.day, phase: p.phase, tests: p.tests.slice(), marks: p.marks.slice() };
    return s;
  } catch {
    return emptySave();
  }
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

interface Play {
  mode: Mode;
  round: Round;
  tests: number[];
  phase: Phase;
  marks: Mark[];
}

export default function Game({ host, restartKey, challenge, lang = 'en' }: GameModuleProps) {
  return <Fussbox key={restartKey} host={host} challenge={challenge} lang={lang} />;
}

function Fussbox({ host, challenge, lang }: { host: GameHost; challenge?: ChallengeSpec; lang: ContentLang }) {
  const u = UI[lang];
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [play, setPlay] = useState<Play | null>(() => (challenge ? { mode: 'challenge', round: makeRound(challenge.seed, 3), tests: [], phase: 'lab', marks: noMarks() } : null));
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);
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
    commit({ ...cur, daily: { ...cur.daily, [today]: { ...rec, open: false } } });
    host.report({ type: 'end', score: 0, stats: { correct: 0, tests: rec.tests }, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = (mode: Mode, level: Level = saveRef.current.level): void => {
    const cur = saveRef.current;
    if (mode === 'daily') {
      // One try: starting today's uses it up; leaving halfway (reload, menu) carries on from the save.
      const kept = cur.daily[today]?.open && cur.progress?.day === today ? cur.progress : null;
      if (!kept && cur.daily[today]) return;
      if (!kept) commit({ ...cur, daily: { ...cur.daily, [today]: { score: 0, correct: 0, tests: 0, line: '', open: true } }, progress: { day: today, tests: [], phase: 'lab', marks: noMarks() } });
      setPlay({ mode, round: dailyRound(today, hashString), tests: kept?.tests ?? [], phase: kept?.phase ?? 'lab', marks: kept?.marks ?? noMarks() });
    } else {
      if (level !== cur.level) commit({ ...cur, level });
      setPlay({ mode, round: makeRound((Math.random() * 2 ** 32) >>> 0, level), tests: [], phase: 'lab', marks: noMarks() });
    }
    started.current = false;
    setNewBest(false);
  };

  /** Keeps today's daily as it goes, so a reload carries on. */
  const keep = (p: Play): void => {
    if (p.mode !== 'daily' || p.phase === 'done') return;
    commit({ ...saveRef.current, progress: { day: today, tests: p.tests, phase: p.phase, marks: p.marks } });
  };
  const update = (p: Play): void => {
    setPlay(p);
    keep(p);
  };
  const start = (): void => {
    if (started.current) return;
    started.current = true;
    host.report({ type: 'start' });
  };

  const feed = (id: number): 'new' | 'known' | 'full' => {
    if (!play || play.phase !== 'lab') return 'full';
    if (play.round.liked.includes(id) || play.round.hated.includes(id) || play.tests.includes(id)) return 'known';
    if (play.tests.length >= MAX_TESTS) return 'full';
    start();
    update({ ...play, tests: [...play.tests, id] });
    return 'new';
  };

  const handIn = (): void => {
    if (!play || play.phase !== 'exam' || play.marks.some((m) => m === null)) return;
    const correct = correctOf(play.round, play.marks);
    const tests = play.tests.length;
    const score = scoreOf(correct, tests);
    const line = resultLine(play.round, play.marks);
    const cur = saveRef.current;
    setNewBest(score > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, score),
      rounds: cur.rounds + 1,
      daily: play.mode === 'daily' ? { ...cur.daily, [today]: { score, correct, tests, line } } : cur.daily,
      progress: play.mode === 'daily' ? undefined : cur.progress,
    });
    if (correct === EXAM_SIZE) sfx().fanfare();
    else sfx().meh();
    const end = { type: 'end' as const, score, stats: { correct, tests } };
    host.report(play.mode === 'daily' ? { ...end, daily: true } : play.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setPlay({ ...play, phase: 'done' });
  };

  if (!play) return <Menu save={save} today={today} u={u} lang={lang} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const label = play.mode === 'daily' ? u.daily(dailyNumber(today)) : play.mode === 'challenge' ? u.challengeRound(challenge?.round ?? 1) : `${u.practice} · ${u.levels[play.round.level - 1]}`;
  if (play.phase === 'done')
    return (
      <Result
        play={play}
        u={u}
        lang={lang}
        label={label}
        newBest={newBest}
        share={play.mode === 'daily' ? `🤖 Fussbox #${dailyNumber(today)} · ${correctOf(play.round, play.marks)}/8 · ${u.tests(play.tests.length)}\n${resultLine(play.round, play.marks)}\n${window.location.origin}/games/fussbox` : null}
        challenge={challenge}
        onAgain={() => begin('endless')}
        onMenu={() => setPlay(null)}
      />
    );
  if (play.phase === 'exam')
    return (
      <Exam
        play={play}
        u={u}
        lang={lang}
        label={label}
        onMark={(i, m) => {
          start();
          sfx().mark();
          const marks = play.marks.slice();
          marks[i] = marks[i] === m ? null : m;
          update({ ...play, marks });
        }}
        onHandIn={handIn}
        onMenu={() => setPlay(null)}
      />
    );
  return (
    <Lab
      play={play}
      u={u}
      lang={lang}
      label={label}
      sfx={sfx}
      onFeed={feed}
      onExam={() => update({ ...play, phase: 'exam' })}
      onMenu={() => setPlay(null)}
    />
  );
}

// ------------------------------------------------------------------ pictures

const cardName = (id: number, lang: ContentLang): string => {
  const c = cardOf(id);
  return (['count', 'colour', 'fill', 'shape'] as const).map((a) => valueName(a, c[a], lang)).join(', ');
};

// ------------------------------------------------------------------ screens

function Menu({ save, today, u, lang, onPlay, onMute }: { save: Save; today: string; u: Ui; lang: ContentLang; onPlay: (m: Mode, level?: Level) => void; onMute: () => void }) {
  const coach = useCoach('fussbox');
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today;
  const level = dailyRound(today, hashString).level;
  return (
    <div className="fbx fbx-menu">
      <div className="fbx-menu-top">
        <button className="fbx-icon" onClick={coach.show} aria-label={u.howTo}>
          ?
        </button>
        <button className="fbx-icon" onClick={onMute} aria-label={save.muted ? u.soundOn : u.soundOff}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <Robot mood="idle" className="fbx-robot-big" />
      <h1 className="fbx-title">
        Fuss<span>box</span>
      </h1>
      <p className="fbx-tag">{u.tag}</p>
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
            <button className="fbx-btn fbx-btn-go fbx-btn-big" onClick={() => onPlay('daily')}>
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
      {coach.open && <Coach steps={coachSteps(lang)} onClose={coach.close} {...COACH_BUTTONS[lang]} />}
    </div>
  );
}

const PICKERS: { attr: Attr; key: 'count' | 'shape' | 'colour' | 'fill' }[] = [
  { attr: 'count', key: 'count' },
  { attr: 'shape', key: 'shape' },
  { attr: 'colour', key: 'colour' },
  { attr: 'fill', key: 'fill' },
];

function Lab({ play, u, lang, label, sfx, onFeed, onExam, onMenu }: { play: Play; u: Ui; lang: ContentLang; label: string; sfx: () => Sfx; onFeed: (id: number) => 'new' | 'known' | 'full'; onExam: () => void; onMenu: () => void }) {
  const [card, setCard] = useState<Card>({ count: 0, shape: 0, colour: 0, fill: 0 });
  const [say, setSay] = useState<{ mood: Mood; text: string }>({ mood: 'idle', text: u.hello });
  const [flash, setFlash] = useState(0);
  const id = cardId(card);
  const { round, tests } = play;
  const liked = [...round.liked.map((x) => ({ id: x, ex: true })), ...tests.filter((x) => likes(round.rule, cardOf(x))).map((x) => ({ id: x, ex: false }))];
  const hated = [...round.hated.map((x) => ({ id: x, ex: true })), ...tests.filter((x) => !likes(round.rule, cardOf(x))).map((x) => ({ id: x, ex: false }))];

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

  // Keyboard: Enter feeds the card, R builds a random one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // Enter feeds the card, also right after clicking a picker (other buttons keep their own Enter).
      const onPicker = e.target instanceof HTMLElement && e.target.closest('.fbx-pick') !== null;
      if (e.key === 'Enter' && (onPicker || !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault();
        feed();
      } else if (e.key === 'r' || e.key === 'R') random();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fbx fbx-lab">
      <header className="fbx-hud">
        <button className="fbx-icon" onClick={onMenu} aria-label={u.menu}>
          ☰
        </button>
        <span className="fbx-hud-label">{label}</span>
        <span className="fbx-hud-tests mono" aria-live="polite">
          {u.tests(tests.length)}
        </span>
      </header>
      <div className="fbx-speak">
        <Robot mood={say.mood} key={flash} className="fbx-robot-talk" />
        <p className="fbx-bubble" role="status">
          {say.text}
        </p>
      </div>
      <div className="fbx-trays">
        <Tray title={u.likes} tone="yes" items={liked} u={u} lang={lang} />
        <Tray title={u.hates} tone="no" items={hated} u={u} lang={lang} />
      </div>
      <section className="fbx-builder" aria-label={u.build}>
        <CardArt id={id} className="fbx-preview" title={cardName(id, lang)} />
        <div className="fbx-pickers">
          {PICKERS.map(({ attr, key }) => (
            <div key={attr} className="fbx-picker" role="radiogroup" aria-label={u[key]}>
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
                  <PickIcon attr={attr} v={v} card={card} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
      <div className="fbx-row">
        <button className="fbx-btn" onClick={random} aria-label={u.random}>
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
  );
}

/** The little picture on a picker button: the card being built, with this one choice changed. */
function PickIcon({ attr, v, card }: { attr: Attr; v: number; card: Card }) {
  const pat = `fbx-${useId().replace(/:/g, '')}`;
  if (attr === 'count') return <b className="fbx-pick-num">{v + 1}</b>;
  const c = { ...card, [attr]: v };
  return (
    <svg className="fbx-pick-sym" viewBox="15 26 30 28" aria-hidden="true">
      <defs>
        <pattern id={pat} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.2" height="5" fill={COLOURS[c.colour]} />
        </pattern>
      </defs>
      <Symbol shape={c.shape} colour={c.colour} fill={c.fill} y={40} pat={pat} />
    </svg>
  );
}

function Tray({ title, tone, items, u, lang }: { title: string; tone: 'yes' | 'no'; items: { id: number; ex: boolean }[]; u: Ui; lang: ContentLang }) {
  return (
    <section className={`fbx-tray is-${tone}`} aria-label={title}>
      <h2>
        {tone === 'yes' ? '✓' : '✗'} {title}
      </h2>
      <div className="fbx-tray-cards">
        {[...items].reverse().map((x) => (
          <span key={x.id} className={`fbx-tray-card${x.ex ? ' is-example' : ''}`} title={x.ex ? u.example : undefined}>
            <CardArt id={x.id} title={cardName(x.id, lang)} />
          </span>
        ))}
      </div>
    </section>
  );
}

function Exam({ play, u, lang, label, onMark, onHandIn, onMenu }: { play: Play; u: Ui; lang: ContentLang; label: string; onMark: (i: number, m: boolean) => void; onHandIn: () => void; onMenu: () => void }) {
  const left = play.marks.filter((m) => m === null).length;
  return (
    <div className="fbx fbx-exam">
      <header className="fbx-hud">
        <button className="fbx-icon" onClick={onMenu} aria-label={u.menu}>
          ☰
        </button>
        <span className="fbx-hud-label">{label}</span>
        <span className="fbx-hud-tests mono">{u.tests(play.tests.length)}</span>
      </header>
      <h2 className="fbx-exam-title">{u.examTitle}</h2>
      <p className="fbx-muted">{u.examHint}</p>
      <ol className="fbx-exam-grid">
        {play.round.exam.map((id, i) => (
          <li key={id} className={play.marks[i] === true ? 'is-yes' : play.marks[i] === false ? 'is-no' : ''}>
            <CardArt id={id} title={cardName(id, lang)} />
            <div className="fbx-yn">
              <button className={`fbx-y${play.marks[i] === true ? ' is-on' : ''}`} onClick={() => onMark(i, true)} aria-label={`${i + 1}: ${u.yes}`} aria-pressed={play.marks[i] === true}>
                ✓
              </button>
              <button className={`fbx-n${play.marks[i] === false ? ' is-on' : ''}`} onClick={() => onMark(i, false)} aria-label={`${i + 1}: ${u.no}`} aria-pressed={play.marks[i] === false}>
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

function Result({ play, u, lang, label, newBest, share, challenge, onAgain, onMenu }: { play: Play; u: Ui; lang: ContentLang; label: string; newBest: boolean; share: string | null; challenge?: ChallengeSpec; onAgain: () => void; onMenu: () => void }) {
  const correct = correctOf(play.round, play.marks);
  const score = scoreOf(correct, play.tests.length);
  const line = resultLine(play.round, play.marks);
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
              <CardArt id={id} title={cardName(id, lang)} />
              <span>{yes ? '✓' : '✗'}</span>
            </li>
          );
        })}
      </ol>
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
