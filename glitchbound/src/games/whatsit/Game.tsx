import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { ContentLang } from '../../platform/contentLang';
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
interface Save {
  best: number;
  rounds: number;
  solved: number;
  daily: Record<string, DailyRecord>;
  progress?: Progress;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, rounds: 0, solved: 0, daily: {}, muted: false });
const strings = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string');

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.rounds = n(o.rounds);
    s.solved = Math.min(s.rounds, n(o.solved));
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object')
          s.daily[d] = { score: n(v.score), solved: v.solved === true, questions: n(v.questions), line: typeof v.line === 'string' ? v.line.slice(0, 60) : '', ...(v.open === true ? { open: true } : {}) };
    const p = o.progress;
    if (p && typeof p.day === 'string' && (p.phase === 'ask' || p.phase === 'lineup') && validRound(p.round) && strings(p.asked, 20) && strings(p.crossed, 12)) {
      const qs = new Set(themeById(p.round.theme)!.questions.map((q) => q.id));
      if (p.asked.every((q) => qs.has(q)) && p.crossed.every((id) => p.round.lineup.includes(id)))
        s.progress = { day: p.day, round: p.round, asked: p.asked.slice(), phase: p.phase, crossed: p.crossed.slice() };
    }
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

interface Play {
  mode: Mode;
  round: Round;
  asked: string[];
  phase: Phase;
  crossed: string[];
  pick: string | null;
}

export default function Game({ host, restartKey, challenge, lang = 'en' }: GameModuleProps) {
  return <Whatsit key={restartKey} host={host} challenge={challenge} lang={lang} />;
}

function Whatsit({ host, challenge, lang }: { host: GameHost; challenge?: ChallengeSpec; lang: ContentLang }) {
  const u = UI[lang];
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  const [play, setPlay] = useState<Play | null>(() => (challenge ? { mode: 'challenge', round: makeRound(challenge.seed), asked: [], phase: 'ask', crossed: [], pick: null } : null));
  const [newBest, setNewBest] = useState(false);
  // ☰ pauses the round (a sheet over it); "Main menu" parks it, and the menu offers to carry on.
  const [paused, setPaused] = useState(false);
  const [parked, setParked] = useState<Play | null>(null);
  const coach = useCoach('whatsit');
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
    host.report({ type: 'end', score: 0, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = (mode: Mode, themeId?: string): void => {
    const cur = saveRef.current;
    // A parked practice or challenge round stays on offer while the daily is played (that one lives in the save).
    if (mode !== 'daily' || parked?.mode === 'daily') setParked(null);
    if (mode === 'daily') {
      // One try: starting today's uses it up; leaving halfway (reload, menu) carries on from the save.
      const kept = cur.daily[today]?.open && cur.progress?.day === today ? cur.progress : null;
      if (!kept && cur.daily[today]) return;
      const round = kept?.round ?? dailyRound(today, hashString);
      if (!kept) commit({ ...cur, daily: { ...cur.daily, [today]: { score: 0, solved: false, questions: 0, line: '', open: true } }, progress: { day: today, round, asked: [], phase: 'ask', crossed: [] } });
      setPlay({ mode, round, asked: kept?.asked ?? [], phase: kept?.phase ?? 'ask', crossed: kept?.crossed ?? [], pick: null });
    } else {
      setPlay({ mode, round: makeRound((Math.random() * 2 ** 32) >>> 0, themeId), asked: [], phase: 'ask', crossed: [], pick: null });
    }
    started.current = false;
    setNewBest(false);
  };

  /** Keeps today's daily as it goes, so a reload carries on. */
  const keep = (p: Play): void => {
    if (p.mode !== 'daily' || p.phase === 'done') return;
    commit({ ...saveRef.current, progress: { day: today, round: p.round, asked: p.asked, phase: p.phase, crossed: p.crossed } });
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

  const ask = (q: string): boolean | null => {
    if (!play || play.phase !== 'ask' || play.asked.includes(q)) return null;
    start();
    update({ ...play, asked: [...play.asked, q] });
    return answer(thingById(play.round.secret)!, q);
  };

  const choose = (id: string): void => {
    if (!play || play.phase !== 'lineup') return;
    start();
    const solved = id === play.round.secret;
    const questions = play.asked.length;
    const score = scoreOf(questions, solved);
    const line = answerLine(play.round, play.asked);
    const cur = saveRef.current;
    setNewBest(score > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, score),
      rounds: cur.rounds + 1,
      solved: cur.solved + (solved ? 1 : 0),
      daily: play.mode === 'daily' ? { ...cur.daily, [today]: { score, solved, questions, line } } : cur.daily,
      progress: play.mode === 'daily' ? undefined : cur.progress,
    });
    if (solved) sfx().win();
    else sfx().lose();
    // "Fewest questions" and "wrong cards crossed out" only count solved rounds.
    const crossed = play.crossed.filter((x) => x !== play.round.secret).length;
    const stats: Record<string, number> = solved ? { questions, crossed } : {};
    const end = { type: 'end' as const, score, stats };
    host.report(play.mode === 'daily' ? { ...end, daily: true } : play.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setPlay({ ...play, phase: 'done', pick: id });
  };

  const mute = (): void => commit({ ...saveRef.current, muted: !saveRef.current.muted });
  const labelOf = (p: Play): string => (p.mode === 'daily' ? u.daily(dailyNumber(today)) : p.mode === 'challenge' ? u.challengeRound(challenge?.round ?? 1) : u.practice);
  const toMenu = (): void => {
    if (play && play.phase !== 'done') setParked(play);
    setPaused(false);
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
          onMenu={toMenu}
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
        share={play.mode === 'daily' ? shareText(play, theme, today, u) : null}
        challenge={challenge}
        onAgain={() => begin('endless', theme.id)}
        onMenu={() => setPlay(null)}
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
      <Ask
        play={play}
        theme={theme}
        u={u}
        lang={lang}
        label={label}
        sfx={sfx}
        onAsk={ask}
        onReady={() => {
          start();
          update({ ...play, phase: 'lineup' });
        }}
        onMenu={() => setPaused(true)}
      />
      {overlays}
    </>
  );
}

function shareText(play: Play, theme: Theme, today: string, u: Ui): string {
  const solved = play.pick === play.round.secret;
  const line = answerLine(play.round, play.asked);
  return `📦 Whatsit #${dailyNumber(today)} · ${theme.emoji} · ${u.questions(play.asked.length)} · ${solved ? '✅' : '❌'}${line ? `\n${line}` : ''}\n${window.location.origin}/games/whatsit`;
}

// ------------------------------------------------------------------ screens

function Menu({ save, today, u, lang, parked, onResume, onPlay, onMute, onHelp }: { save: Save; today: string; u: Ui; lang: ContentLang; parked: { label: string; questions: number } | null; onResume: () => void; onPlay: (m: Mode, theme?: string) => void; onMute: () => void; onHelp: () => void }) {
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
    </header>
  );
}

function Ask({ play, theme, u, lang, label, sfx, onAsk, onReady, onMenu }: { play: Play; theme: Theme; u: Ui; lang: ContentLang; label: string; sfx: () => Sfx; onAsk: (q: string) => boolean | null; onReady: () => void; onMenu: () => void }) {
  const [say, setSay] = useState<{ mood: Mood; text: string }>({ mood: 'idle', text: u.hello });
  const [flash, setFlash] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const secret = thingById(play.round.secret)!;
  const ask = (q: string): void => {
    const yes = onAsk(q);
    if (yes === null) return;
    sfx().ask();
    if (yes) sfx().yep();
    else sfx().nope();
    setSay({ mood: yes ? 'yes' : 'no', text: yes ? u.yep : u.nope });
    setFlash((n) => n + 1);
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
        <ul className="whz-qs">
          {theme.questions.map((q) => {
            const asked = play.asked.includes(q.id);
            const yes = answer(secret, q.id);
            return (
              <li key={q.id}>
                <button className={`whz-q${asked ? (yes ? ' is-yes' : ' is-no') : ''}`} onClick={() => ask(q.id)} disabled={asked} aria-label={asked ? `${q.text[lang]} ${yes ? u.yes : u.no}` : q.text[lang]}>
                  <span>{q.text[lang]}</span>
                  {asked && <b>{yes ? `✓ ${u.yes}` : `✗ ${u.no}`}</b>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="whz-muted whz-hint">{u.askHint}</p>
        <button className="whz-btn whz-btn-ready" onClick={() => setConfirm(true)}>
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

function Clues({ play, theme, u, lang }: { play: Play; theme: Theme; u: Ui; lang: ContentLang }) {
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

function Lineup({ play, theme, u, lang, label, onCross, onPick, onMenu }: { play: Play; theme: Theme; u: Ui; lang: ContentLang; label: string; onCross: (id: string) => void; onPick: (id: string) => void; onMenu: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const left = play.round.lineup.filter((id) => !play.crossed.includes(id)).length;
  const card = open ? thingById(open) : undefined;
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
                <button className={`whz-card${crossed ? ' is-crossed' : ''}`} onClick={() => setOpen(id)} aria-label={`${t.name[lang]}. ${t.def[lang]}`}>
                  <b>{t.name[lang]}</b>
                  <span>{t.def[lang]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {card && open && (
        <Sheet labelledBy="whz-card-title" onClose={() => setOpen(null)}>
          <h2 id="whz-card-title" className="whz-sheet-name">
            {card.name[lang]}
          </h2>
          <p>{card.def[lang]}</p>
          <button className="whz-btn whz-btn-go whz-btn-big" onClick={() => onPick(open)}>
            {u.pickThis}
          </button>
          <button
            className="whz-btn whz-btn-big"
            onClick={() => {
              onCross(open);
              setOpen(null);
            }}
          >
            {play.crossed.includes(open) ? u.bringBack : `✕ ${u.crossOut}`}
          </button>
          <button className="whz-btn whz-btn-quiet" onClick={() => setOpen(null)} autoFocus>
            {u.close}
          </button>
        </Sheet>
      )}
    </>
  );
}

function Result({ play, theme, u, lang, label, newBest, share, challenge, onAgain, onMenu }: { play: Play; theme: Theme; u: Ui; lang: ContentLang; label: string; newBest: boolean; share: string | null; challenge?: ChallengeSpec; onAgain: () => void; onMenu: () => void }) {
  const secret = thingById(play.round.secret)!;
  const solved = play.pick === play.round.secret;
  const score = scoreOf(play.asked.length, solved);
  const fitting = new Set(stillFitting(play.round, play.asked));
  const picked = play.pick ? thingById(play.pick) : undefined;
  const line = answerLine(play.round, play.asked);
  return (
    <div className="whz whz-result">
      <p className="whz-eyebrow">
        {label} · {theme.emoji} {theme.name[lang]}
      </p>
      <Parcel mood={solved ? 'yes' : 'no'} className="whz-parcel-big" />
      <p className={`whz-verdict ${solved ? 'is-yes' : 'is-no'}`}>{solved ? u.solved : u.missed}</p>
      <p className="whz-big">{score}</p>
      <p className="whz-muted">
        {u.outOf(play.asked.length)}
        {newBest ? ` · ${u.newBest}` : ''}
      </p>
      {line && <ResultLine line={line} label={u.yourClues} />}
      <div className="whz-reveal">
        <span>{u.itWas}</span>
        <b>{secret.name[lang]}</b>
        <p>{secret.def[lang]}</p>
      </div>
      {!solved && picked && <p className="whz-muted">{u.youPicked(picked.name[lang])}</p>}
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
      <div className="whz-row">
        {play.mode === 'challenge' && challenge ? (
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
        <button className="whz-btn" onClick={onMenu}>
          {u.menu}
        </button>
      </div>
      {play.mode === 'daily' && <Countdown label={u.nextDaily} />}
    </div>
  );
}

// ------------------------------------------------------------------ sheets

/** A dialog over the game; Escape or a tap outside closes it. */
function Sheet({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="whz-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="whz-sheet-card">{children}</div>
    </div>
  );
}

/** The sheet ☰ opens over a round: carry on, the walkthrough, sound, or back to the menu (the round waits there). */
function Pause({ u, muted, onResume, onHelp, onMute, onMenu }: { u: Ui; muted: boolean; onResume: () => void; onHelp: () => void; onMute: () => void; onMenu: () => void }) {
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
      <button className="whz-btn whz-btn-big" onClick={onMenu}>
        {u.mainMenu}
      </button>
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
