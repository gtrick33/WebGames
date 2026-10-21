import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { createRoom, roomInfo } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { applyBot, LEVELS, type Level } from './ai';
import { CardDefs, CardFace, SuitIcon } from './cards';
import { LiveTable } from './live';
import { applyCall, bookDeal, cardOf, newMatch, nextDeal, playCard, rng, type Call, type Card, type DealScore, type Match } from './logic';
import { createSfx, type Sfx } from './sound';
import { DealSheet, Table, TRICK_HOLD_MS, TRICK_SLIDE_MS } from './Table';
import { WORDS, type Words } from './text';
import './Game.css';

const KEY = 'glitchbound.belot';
const EPOCH = '2026-10-21';
const SLUG = 'belot';
/** Deals in today's set and in a friends' challenge. */
export const SET_DEALS = 4;

type Mode = 'match' | 'daily' | 'challenge';

interface Run {
  mode: Mode;
  level: Level;
  match: Match;
  /** Deals scored so far (thrown-in ones do not count). */
  booked: number;
  /** One emoji per scored deal, for the share line. */
  line: string;
  started: boolean;
  /** The score sheet of the deal just booked (kept with the run, so a resumed run shows it, never books twice). */
  sheet: { score: DealScore; taken: number } | null;
}

interface Save {
  best: number;
  runs: number;
  wins: number;
  daily: Record<string, { score: number; line: string; done: boolean }>;
  level: Level;
  muted: boolean;
  musicOff: boolean;
  /** A match or today's set left unfinished, to pick up again. */
  current: Run | null;
}

const emptySave = (): Save => ({ best: 0, runs: 0, wins: 0, daily: {}, level: 'medium', muted: false, musicOff: false, current: null });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.wins = n(o.wins);
    s.level = LEVELS.includes(o.level as Level) ? (o.level as Level) : 'medium';
    s.muted = o.muted === true;
    s.musicOff = o.musicOff === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { score: n(v.score), line: typeof v.line === 'string' ? v.line.slice(0, 20) : '', done: v.done === true };
    const c = o.current;
    // a saved run is checked lightly: the rules refuse anything inconsistent anyway
    if (c && typeof c === 'object' && (c.mode === 'match' || c.mode === 'daily') && c.match && Array.isArray(c.match.deal?.hands) && LEVELS.includes(c.level)) s.current = { ...c, sheet: c.sheet ?? null };
    return s;
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const Lang = createContext<{ w: Words; lang: BasicLang }>({ w: WORDS.en, lang: 'en' });
const useWords = (): Words => useContext(Lang).w;

/** The room code from an invite link (?room=ABCDE). */
const linkedRoom = (): string | null => {
  const c = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-HJKMNP-Z]{5}$/.test(c) ? c : null;
};
function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
}

export default function Game({ host, restartKey, pauseKey, challenge, playerName, lang: site }: GameModuleProps) {
  const lang = basicLang(site);
  return (
    <Lang.Provider value={{ w: WORDS[lang], lang }}>
      <Belot key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />
    </Lang.Provider>
  );
}

/** The emoji for a scored deal: won it, lost it, hanging; a star on a valat. */
const dealEmoji = (s: DealScore, us: 0 | 1): string => (s.valat === us ? '⭐' : s.winner === null ? '🟡' : s.winner === us ? '🟢' : '🔴');

function Belot({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const w = useWords();
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted, () => saveRef.current.musicOff)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);

  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const [run, setRun] = useState<Run | null>(() => (challenge ? { mode: 'challenge', level: 'hard', match: newMatch(challenge.seed), booked: 0, line: '', started: false, sheet: null } : null));
  const sheet = run?.sheet ?? null;
  const [result, setResult] = useState<{ mode: Mode; score: number; ours: number; theirs: number; won: boolean; line: string; best: boolean } | null>(null);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'rules'>('menu');
  const [thrown, setThrown] = useState(false);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // the arcade asks for a pause (left full screen, scrolled away)
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }

  // music while a table is open (a match, today's set, a live table)
  const atTable = !!run || !!room;
  useEffect(() => {
    sfx().music(atTable && !paused);
  }, [atTable, paused, sfx]);

  // the computer players' names: friendly, short, and the same in every language
  const names = [playerName || w.you, 'Niko', 'Mila', 'Tom'];

  /** Keeps an unfinished match or today's set in the save (a challenge is played in one go). */
  const keep = useCallback(
    (r: Run | null) => {
      commit((s) => ({ ...s, current: r && r.mode !== 'challenge' ? r : null }));
    },
    [commit],
  );

  const update = useCallback(
    (fn: (r: Run) => Run) => {
      const r = runRef.current;
      if (!r) return;
      const next = fn(r);
      runRef.current = next;
      setRun(next);
      keep(next);
    },
    [keep],
  );

  const begin = (mode: Mode, level: Level): void => {
    sfx().unlock();
    const seed = mode === 'daily' ? hashString(`${SLUG}:${today}`) : (Math.random() * 2 ** 32) >>> 0;
    const r: Run = { mode, level, match: newMatch(seed), booked: 0, line: '', started: false, sheet: null };
    setResult(null);
    setPaused(false);
    runRef.current = r;
    setRun(r);
    keep(r);
    commit((s) => ({ ...s, level }));
  };

  const markStart = (r: Run): Run => {
    if (r.started) return r;
    host.report({ type: 'start' });
    return { ...r, started: true };
  };
  const onCall = (c: Call): void => update((r) => ({ ...markStart(r), match: { ...r.match, deal: applyCall(r.match.deal, c) } }));
  const onPlay = (card: Card, declare: boolean): void => update((r) => ({ ...markStart(r), match: { ...r.match, deal: playCard(r.match.deal, card, declare ? undefined : []) } }));

  // the computer players, a thrown-in deal, and a finished deal's score sheet
  useEffect(() => {
    if (!run || sheet || paused || result) return;
    const d = run.match.deal;
    if (d.phase === 'thrown') {
      const a = window.setTimeout(() => setThrown(true), 0);
      const b = window.setTimeout(() => {
        setThrown(false);
        update((r) => ({ ...r, match: nextDeal(r.match) }));
      }, 1700);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
      };
    }
    if (d.phase === 'done' && !run.sheet) {
      const t = window.setTimeout(() => {
        const r = runRef.current!;
        const { match, score, taken } = bookDeal(r.match);
        const s = sfx();
        if (score.valat !== null) s.valat();
        else s.tally(Math.max(score.game[0], score.game[1]));
        update(() => ({ ...r, match, booked: r.booked + 1, line: r.line + dealEmoji(score, 0), sheet: { score, taken } }));
      }, TRICK_HOLD_MS + TRICK_SLIDE_MS + 150);
      return () => window.clearTimeout(t);
    }
    if (d.turn === 0) return;
    const delay = d.phase === 'bidding' ? (d.calls.length === 0 ? 1500 : 750) : d.trick.length === 0 && d.tricks.length > 0 ? TRICK_HOLD_MS + TRICK_SLIDE_MS : 650;
    const t = window.setTimeout(() => {
      const r = runRef.current!;
      const md = r.match.deal;
      // the computer's choices are seeded by the position, so today's deals play the same for everyone
      const seed = hashString(`${r.match.seed}:${r.match.dealNo}:${md.calls.length}:${md.tricks.length}:${md.trick.length}`);
      update(() => ({ ...r, match: { ...r.match, deal: applyBot(md, r.mode === 'match' ? r.level : 'hard', rng(seed)) } }));
    }, delay);
    return () => window.clearTimeout(t);
  }, [run, sheet, paused, result, update, sfx]);

  const finish = (r: Run): void => {
    const [ours, theirs] = r.match.scores;
    const won = ours > theirs;
    const score = ours;
    const margin = Math.max(0, ours - theirs);
    const cur = saveRef.current;
    const isBest = score > cur.best;
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      runs: s.runs + 1,
      wins: s.wins + (r.mode === 'match' && won ? 1 : 0),
      daily: r.mode === 'daily' ? { ...s.daily, [today]: { score, line: r.line, done: true } } : s.daily,
      current: null,
    }));
    const end = { type: 'end' as const, score, stats: { margin } };
    host.report(r.mode === 'daily' ? { ...end, daily: true } : r.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    if (won) sfx().win();
    else sfx().lose();
    setResult({ mode: r.mode, score, ours, theirs, won, line: r.line, best: isBest });
  };

  const afterSheet = (): void => {
    const r = runRef.current;
    if (!r) return;
    sfx().click();
    const set = r.mode !== 'match';
    if ((set && r.booked >= SET_DEALS) || (!set && r.match.winner !== null)) {
      update((x) => ({ ...x, sheet: null }));
      return finish(r);
    }
    update((x) => ({ ...x, sheet: null, match: nextDeal(x.match) }));
  };

  const quit = (): void => {
    setRun(null);
    runRef.current = null;
    setResult(null);
    setPaused(false);
    sfx().click();
  };

  const openRoom = async (): Promise<string | null> => {
    sfx().unlock();
    try {
      const code = await createRoom('belot');
      setRoomInUrl(code);
      setRoom(code);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : w.noRoom;
    }
  };
  const joinRoom = async (code: string): Promise<string | null> => {
    sfx().unlock();
    const info = await roomInfo(code);
    if (!info || info.game !== 'belot') return w.noRoom;
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  const tools = (
    <>
      <SoundMenu save={save} commit={commit} sfx={sfx} />
      {run && !result && (
        <button className="bl-icon" onClick={() => setPaused(true)} aria-label={w.paused}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      <GameMenuButton className="bl-icon" />
    </>
  );

  // Escape pauses
  useEffect(() => {
    if (!run || result) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, result]);

  if (room)
    return (
      <div className="bl" onPointerDown={() => sfx().unlock()}>
        <LiveTable
          w={w}
          code={room}
          name={playerName || ''}
          sfx={sfx}
          tools={tools}
          onLeave={() => {
            setRoomInUrl(null);
            setRoom(null);
          }}
        />
      </div>
    );

  if (run) {
    const r = run;
    const setMode = r.mode !== 'match';
    const note = setMode ? w.dailyDeal(Math.min(SET_DEALS, r.booked + (sheet ? 0 : 1))) : undefined;
    return (
      <div className="bl" onPointerDown={() => sfx().unlock()}>
        <Table
          w={w}
          match={r.match}
          me={0}
          names={names}
          bots={[null, r.mode === 'match' ? r.level : 'hard', r.mode === 'match' ? r.level : 'hard', r.mode === 'match' ? r.level : 'hard']}
          onCall={onCall}
          onPlay={onPlay}
          sfx={sfx}
          locked={paused || !!sheet || !!result}
          tools={tools}
          note={note}
          overlay={
            <>
              {thrown && <p className="bl-toast">{w.thrown}</p>}
              {sheet && (
                <DealSheet w={w} score={sheet.score} taken={sheet.taken} scores={r.match.scores} me={0} names={names}>
                  <button className="bl-btn is-go" onClick={afterSheet} autoFocus>
                    {(setMode && r.booked >= SET_DEALS) || (!setMode && r.match.winner !== null) ? w.total : w.nextDeal}
                  </button>
                </DealSheet>
              )}
              {result && <ResultScreen w={w} res={result} day={dailyNumber(today)} challenge={challenge} onAgain={() => begin(result.mode === 'challenge' ? 'match' : 'match', r.level)} onMenu={quit} />}
              {paused && !result && (
                <div className="bl-pause" role="dialog" aria-label={w.paused} onClick={() => setPaused(false)}>
                  <div className="bl-panel" onClick={(e) => e.stopPropagation()}>
                    <h2>{w.paused}</h2>
                    <button className="bl-btn is-go" autoFocus onClick={() => setPaused(false)}>
                      {w.resumeBtn}
                    </button>
                    <button className="bl-btn" onClick={quit}>
                      {w.quit}
                    </button>
                  </div>
                </div>
              )}
            </>
          }
        />
      </div>
    );
  }

  if (screen === 'rules')
    return (
      <div className="bl bl-scroll">
        <div className="bl-menu">
          <div className="bl-top-row">
            <button className="bl-btn is-small" onClick={() => setScreen('menu')}>
              ← {w.back}
            </button>
            <div className="bl-tools">{tools}</div>
          </div>
          <h2 className="bl-h">{w.howTo}</h2>
          <ol className="bl-rules">
            {w.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    );

  return <Menu w={w} save={save} today={today} tools={tools} onBegin={begin} onResume={() => save.current && (setRun(save.current), (runRef.current = save.current))} onRules={() => setScreen('rules')} onOpenRoom={openRoom} onJoinRoom={joinRoom} />;
}

function SoundMenu({ save, commit, sfx }: { save: Save; commit: (fn: (s: Save) => Save) => void; sfx: () => Sfx }) {
  const w = useWords();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent): void => {
      if (!(e.target as Element | null)?.closest('.bl-sound')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="bl-sound">
      <button className="bl-icon" onClick={() => setOpen((o) => !o)} aria-label={w.sound} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {!(save.muted && save.musicOff) && <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div className="bl-sound-menu" role="group" aria-label={w.sound}>
          {(
            [
              ['music', w.music, !save.musicOff],
              ['fx', w.sound, !save.muted],
            ] as const
          ).map(([k, label, on]) => (
            <button
              key={k}
              className="bl-switch"
              role="switch"
              aria-checked={on}
              onClick={() => {
                commit((s) => (k === 'music' ? { ...s, musicOff: !s.musicOff } : { ...s, muted: !s.muted }));
                sfx().refresh();
                if (k === 'fx' && on === false) window.setTimeout(() => sfx().click(), 0);
              }}
            >
              {label} <span className="bl-knob" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Menu({
  w,
  save,
  today,
  tools,
  onBegin,
  onResume,
  onRules,
  onOpenRoom,
  onJoinRoom,
}: {
  w: Words;
  save: Save;
  today: string;
  tools: React.ReactNode;
  onBegin: (m: Mode, l: Level) => void;
  onResume: () => void;
  onRules: () => void;
  onOpenRoom: () => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [level, setLevel] = useState<Level>(save.level);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const daily = save.daily[today];
  const resumeDaily = save.current?.mode === 'daily' && save.current.match.seed === hashString(`${SLUG}:${today}`);
  const resumeMatch = save.current?.mode === 'match';
  return (
    <div className="bl bl-scroll">
      <CardDefs />
      <div className="bl-menu">
        <div className="bl-top-row">
          <span />
          <div className="bl-tools">{tools}</div>
        </div>
        <div className="bl-hero" aria-hidden="true">
          {[cardOf(2, 6), cardOf(3, 4), cardOf(1, 7), cardOf(0, 5)].map((c, i) => (
            <span key={c} className="bl-hero-card" style={{ '--i': i } as React.CSSProperties}>
              <CardFace card={c} />
            </span>
          ))}
        </div>
        <h1 className="bl-title">{w.title}</h1>
        <p className="bl-tagline">{w.tagline}</p>

        <section className="bl-mode is-daily">
          <div>
            <b>{w.daily}</b>
            <small>{w.dailySub(dailyNumber(today))}</small>
            {daily?.done && (
              <span className="bl-done mono">
                {w.dailyDone} · {daily.score} · {daily.line}
              </span>
            )}
          </div>
          {!daily?.done && (
            <button className="bl-btn is-go" onClick={() => (resumeDaily ? onResume() : onBegin('daily', 'hard'))}>
              {resumeDaily ? w.resumeBtn : w.start}
            </button>
          )}
        </section>

        <section className="bl-mode">
          <div>
            <b>{w.match}</b>
            <small>{w.matchSub}</small>
          </div>
          {resumeMatch && (
            <button className="bl-btn is-go" onClick={onResume}>
              {w.resume}
            </button>
          )}
          <div className="bl-levels" role="radiogroup" aria-label={w.pickLevel}>
            {LEVELS.map((l) => (
              <button key={l} role="radio" aria-checked={level === l} className={`bl-level${level === l ? ' is-on' : ''}`} onClick={() => setLevel(l)}>
                <b>{w.level[l]}</b>
                <small>{w.levelHint[l]}</small>
              </button>
            ))}
          </div>
          <button className={`bl-btn${resumeMatch ? '' : ' is-go'}`} onClick={() => onBegin('match', level)}>
            {w.start} · {w.level[level]}
          </button>
        </section>

        <section className="bl-mode">
          <div>
            <b>{w.friends}</b>
            <small>{w.friendsSub}</small>
          </div>
          <button
            className="bl-btn is-go"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr((await onOpenRoom()) ?? '');
              setBusy(false);
            }}
          >
            {busy ? w.opening : w.openRoom}
          </button>
          <form
            className="bl-join"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^[A-HJKMNP-Z]{5}$/.test(code)) return setErr(w.noRoom);
              setBusy(true);
              setErr((await onJoinRoom(code)) ?? '');
              setBusy(false);
            }}
          >
            <input className="bl-input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder={w.joinCode} aria-label={w.joinCode} autoComplete="off" />
            <button className="bl-btn" disabled={busy || code.length !== 5}>
              {w.join}
            </button>
          </form>
          {err && <p className="bl-err">{err}</p>}
        </section>

        <button className="bl-btn is-ghost" onClick={onRules}>
          <SuitIcon suit={2} size={16} /> {w.howTo}
        </button>
        <p className="bl-stats mono">
          {w.best} {save.best} · {w.wins} {save.wins}
        </p>
      </div>
    </div>
  );
}

function ResultScreen({
  w,
  res,
  day,
  challenge,
  onAgain,
  onMenu,
}: {
  w: Words;
  res: { mode: Mode; score: number; ours: number; theirs: number; won: boolean; line: string; best: boolean };
  day: number;
  challenge?: ChallengeSpec;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const [msg, setMsg] = useState('');
  const share =
    res.mode === 'daily'
      ? `🃏 Belot #${day}\n${res.line}\n${res.ours}–${res.theirs}\n${window.location.origin}/games/belot`
      : `🃏 Belot ${res.ours}–${res.theirs}\n${res.line}\n${window.location.origin}/games/belot`;
  return (
    <div className="bl-sheet-wrap" role="dialog" aria-label={res.won ? w.matchWon : w.matchLost}>
      <div className={`bl-sheet bl-result${res.won ? ' is-win' : ''}`}>
        {res.won && <Confetti />}
        <h2 className="bl-result-title">{res.mode === 'match' ? (res.won ? w.matchWon : w.matchLost) : w.dailyScore}</h2>
        <p className="bl-result-score mono">
          <b>{res.ours}</b> – {res.theirs}
        </p>
        {res.best && <p className="bl-newbest">{w.newBest}</p>}
        <ResultLine line={res.line || '🃏'} label={`${res.ours} to ${res.theirs}`} />
        <div className="bl-sheet-actions">
          {res.mode === 'challenge' && challenge ? (
            <a className="bl-btn is-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              See the scoreboard
            </a>
          ) : (
            <>
              <button className="bl-btn is-go" onClick={onAgain} autoFocus>
                {w.playAgain}
              </button>
              <button className="bl-btn" onClick={() => void shareOrCopy({ title: 'Belot', text: share }).then((o) => setMsg(o === 'copied' ? w.copied : ''))}>
                {msg || w.share}
              </button>
            </>
          )}
          <button className="bl-btn is-ghost" onClick={onMenu}>
            {w.menu}
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="bl-confetti" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--c': ['#ffd12e', '#ff4fa3', '#22e4ff', '#c4f034'][i % 4] } as React.CSSProperties} />
      ))}
    </div>
  );
}

