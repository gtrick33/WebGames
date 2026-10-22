import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import { basicLang, type BasicLang } from '../../platform/contentLang';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { createRoom, roomInfo } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { choosePlay, LEVELS, type Level } from './ai';
import { Board, moveMs } from './Board';
import { LiveBoard } from './live';
import { bookGame, endTurn, newMatch, nextGame, pips, rng, roll, step, TARGETS, turnDone, type Match, type Step } from './logic';
import { createSfx, type Sfx } from './sound';
import { WORDS, type Words } from './text';
import './Game.css';

const KEY = 'glitchbound.backgammon';
const EPOCH = '2026-10-21';
const SLUG = 'backgammon';

type Mode = 'match' | 'daily' | 'challenge';

interface Run {
  mode: Mode;
  level: Level;
  match: Match;
  started: boolean;
  /** The game just finished (kept with the run so a resumed run shows it, never books it twice). */
  sheet: { winner: 0 | 1; points: number } | null;
}

interface Save {
  best: number;
  runs: number;
  wins: number;
  daily: Record<string, { score: number; line: string }>;
  level: Level;
  target: number;
  muted: boolean;
  musicOff: boolean;
  current: Run | null;
}

const emptySave = (): Save => ({ best: 0, runs: 0, wins: 0, daily: {}, level: 'medium', target: 5, muted: false, musicOff: false, current: null });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.wins = n(o.wins);
    s.level = LEVELS.includes(o.level as Level) ? (o.level as Level) : 'medium';
    s.target = (TARGETS as readonly number[]).includes(o.target as number) ? (o.target as number) : 5;
    s.muted = o.muted === true;
    s.musicOff = o.musicOff === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { score: n(v.score), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '' };
    const c = o.current;
    if (c && typeof c === 'object' && (c.mode === 'match' || c.mode === 'daily') && c.match?.game?.pos && LEVELS.includes(c.level)) s.current = { ...c, sheet: c.sheet ?? null };
    return s;
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage */
  }
};
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);

const Lang = createContext<{ w: Words; lang: BasicLang }>({ w: WORDS.en, lang: 'en' });
const useWords = (): Words => useContext(Lang).w;

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
      <Backgammon key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />
    </Lang.Provider>
  );
}

/** Today's (and a challenge's) score: 100 a point won plus their pips left; a loss, 4 a checker borne off. */
export function setScore(m: Match): number {
  const g = m.game;
  if (g.winner === 0) return g.points * 100 + pips(g.pos, 1);
  return g.pos.off[0] * 4;
}

function Backgammon({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
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
  const [run, setRun] = useState<Run | null>(() => (challenge ? { mode: 'challenge', level: 'hard', match: newMatch(challenge.seed, 1), started: false, sheet: null } : null));
  const [result, setResult] = useState<{ mode: Mode; score: number; won: boolean; mine: number; theirs: number; line: string; best: boolean; kind: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'rules'>('menu');
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }
  const atBoard = !!run || !!room;
  useEffect(() => {
    sfx().music(atBoard && !paused);
  }, [atBoard, paused, sfx]);

  const keep = useCallback((r: Run | null) => commit((s) => ({ ...s, current: r && r.mode !== 'challenge' ? r : null })), [commit]);
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

  const begin = (mode: Mode, level: Level, target: number): void => {
    sfx().unlock();
    const seed = mode === 'daily' ? hashString(`${SLUG}:${today}`) : (Math.random() * 2 ** 32) >>> 0;
    const r: Run = { mode, level, match: newMatch(seed, mode === 'match' ? target : 1), started: false, sheet: null };
    setResult(null);
    setPaused(false);
    runRef.current = r;
    setRun(r);
    keep(r);
    commit((s) => ({ ...s, level, target: mode === 'match' ? target : s.target }));
  };

  const withGame = (r: Run, fn: (g: Match['game']) => Match['game']): Run => {
    let next = r;
    if (!r.started) {
      host.report({ type: 'start' });
      next = { ...r, started: true };
    }
    return { ...next, match: { ...next.match, game: fn(next.match.game) } };
  };
  const onRoll = (): void => update((r) => withGame(r, roll));
  const onStep = (st: Step): void => update((r) => withGame(r, (g) => step(g, st)));
  const onDone = (): void => update((r) => withGame(r, endTurn));

  // the computer's turns (one checker at a time), a roll you cannot play, and the end of a game
  const plan = useRef<{ key: string; steps: Step[] } | null>(null);
  useEffect(() => {
    if (!run || run.sheet || paused || result) return;
    const g = run.match.game;
    if (g.phase === 'over') {
      const t = window.setTimeout(() => {
        const r = runRef.current!;
        const booked = bookGame(r.match);
        update(() => ({ ...r, match: booked, sheet: { winner: r.match.game.winner!, points: r.match.game.points } }));
      }, 1300);
      return () => window.clearTimeout(t);
    }
    if (g.turn === 0 && g.phase === 'move' && !g.steps.length && turnDone(g)) {
      const t = window.setTimeout(() => update((r) => ({ ...r, match: { ...r.match, game: endTurn(r.match.game) } })), 1600);
      return () => window.clearTimeout(t);
    }
    if (g.turn !== 1 || g.phase === 'opening') return;
    const level = run.mode === 'match' ? run.level : 'hard';
    if (g.phase === 'roll') {
      const t = window.setTimeout(() => update((r) => ({ ...r, match: { ...r.match, game: roll(r.match.game) } })), 700);
      return () => window.clearTimeout(t);
    }
    // a move: plan the whole play once, then make it step by step
    const k = `${run.match.games}:${g.rolls}`;
    if (plan.current?.key !== k) plan.current = { key: k, steps: choosePlay(g.turnStart, 1, g.roll![0] === g.roll![1] ? [g.roll![0], g.roll![0], g.roll![0], g.roll![0]] : [g.roll![0], g.roll![1]], level, rng(hashString(`${g.seed}:${g.rolls}`))) };
    const next = plan.current.steps[g.steps.length];
    const t = window.setTimeout(
      () =>
        update((r) => {
          const cur = r.match.game;
          const ng = next ? step(cur, next) : endTurn(cur);
          // a plan that no longer fits (never expected): end the turn
          return { ...r, match: { ...r.match, game: next && ng === cur ? endTurn(cur) : ng } };
        }),
      // each step once the one before has bounced its way there
      g.steps.length === 0 ? 900 : moveMs(1, g.steps[g.steps.length - 1]!) + 260,
    );
    return () => window.clearTimeout(t);
  }, [run, paused, result, update]);

  const finish = (r: Run): void => {
    const m = r.match;
    const won = m.winner === 0 || (r.mode !== 'match' && m.game.winner === 0);
    const score = r.mode === 'match' ? m.score[0] * 100 + (won ? 50 : 0) : setScore(m);
    const isBest = score > saveRef.current.best;
    const g = m.game;
    const line = r.mode === 'match' ? m.results.map((x) => (x.winner === 0 ? ['', '🟢', '⭐', '🏆'][x.points] : '🔴')).join('') : won ? `${['', '🟢', '⭐', '🏆'][g.points]} ${w.win[g.points as 1 | 2 | 3]}` : `🔴 ${g.pos.off[0]}/15`;
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      runs: s.runs + 1,
      wins: s.wins + (r.mode === 'match' && won ? 1 : 0),
      daily: r.mode === 'daily' ? { ...s.daily, [today]: { score, line } } : s.daily,
      current: null,
    }));
    const end = { type: 'end' as const, score, stats: { points: won ? (r.mode === 'match' ? m.score[0] : g.points) : 0 } };
    host.report(r.mode === 'daily' ? { ...end, daily: true } : r.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setResult({ mode: r.mode, score, won, mine: m.score[0], theirs: m.score[1], line, best: isBest, kind: g.points });
  };

  const afterSheet = (): void => {
    const r = runRef.current;
    if (!r) return;
    sfx().click();
    if (r.match.winner !== null || r.mode !== 'match') {
      update((x) => ({ ...x, sheet: null }));
      return finish(r);
    }
    update((x) => ({ ...x, sheet: null, match: nextGame(x.match) }));
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
      const code = await createRoom('backgammon');
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
    if (!info || info.game !== 'backgammon') return w.noRoom;
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  useEffect(() => {
    if (!run || result) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, result]);

  const tools = (
    <>
      <SoundMenu save={save} commit={commit} sfx={sfx} />
      {run && !result && (
        <button className="tb-icon" onClick={() => setPaused(true)} aria-label={w.paused}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      <GameMenuButton className="tb-icon" />
    </>
  );

  if (room)
    return (
      <div className="tb" onPointerDown={() => sfx().unlock()}>
        <LiveBoard
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
    const g = r.match.game;
    const canAct = !paused && !r.sheet && !result && g.phase !== 'over' && (g.phase === 'opening' || g.turn === 0);
    const opp = r.mode === 'match' ? r.level : 'hard';
    const oppName = `${w.computer} · ${w.level[opp]}`;
    return (
      <div className="tb" onPointerDown={() => sfx().unlock()}>
        <Board
          w={w}
          game={g}
          me={0}
          names={[playerName || w.you, oppName]}
          canAct={canAct}
          onRoll={onRoll}
          onStep={onStep}
          onDone={onDone}
          sfx={sfx}
          score={r.match.score}
          target={r.match.target}
          note={r.mode === 'match' ? undefined : r.mode === 'daily' ? `#${dailyNumber(today)}` : ''}
          tools={tools}
          overlay={
            <>
              {g.phase === 'opening' && !paused && <p className="tb-toast">{w.rollFirst}</p>}
              {g.phase === 'move' && g.steps.length === 0 && r.match.game.rolls > 0 && g.roll && r.match.game.lastTurn === null && <p className="tb-toast is-soft">{w.opening(g.roll[0], g.roll[1], g.turn === 0)}</p>}
              {r.sheet && (
                <div className="tb-sheet-wrap" role="dialog">
                  <div className={`tb-sheet${r.sheet.winner === 0 ? ' is-win' : ''}`}>
                    <h2>{r.sheet.winner === 0 ? w.youWonGame(w.win[r.sheet.points as 1 | 2 | 3], r.sheet.points) : w.theyWonGame(oppName, w.win[r.sheet.points as 1 | 2 | 3], r.sheet.points)}</h2>
                    {r.mode === 'match' && (
                      <p className="tb-sheet-score mono">
                        <b>{r.match.score[0]}</b> – <b>{r.match.score[1]}</b> · {w.to(r.match.target)}
                      </p>
                    )}
                    <button className="tb-btn is-go" onClick={afterSheet} autoFocus>
                      {r.match.winner !== null || r.mode !== 'match' ? w.menu : w.nextGame}
                    </button>
                  </div>
                </div>
              )}
              {result && <ResultScreen w={w} res={result} day={dailyNumber(today)} challenge={challenge} onAgain={() => begin('match', r.level, saveRef.current.target)} onMenu={quit} />}
              {paused && !result && (
                <div className="tb-sheet-wrap" role="dialog" aria-label={w.paused} onClick={() => setPaused(false)}>
                  <div className="tb-sheet" onClick={(e) => e.stopPropagation()}>
                    <h2>{w.paused}</h2>
                    <button className="tb-btn is-go" autoFocus onClick={() => setPaused(false)}>
                      {w.resumeBtn}
                    </button>
                    <button className="tb-btn" onClick={quit}>
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
      <div className="tb tb-scroll">
        <div className="tb-menu">
          <div className="tb-top-row">
            <button className="tb-btn is-small" onClick={() => setScreen('menu')}>
              ← {w.back}
            </button>
            <div className="tb-tools">{tools}</div>
          </div>
          <h2 className="tb-h">{w.howTo}</h2>
          <ol className="tb-rules">
            {w.rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    );

  return (
    <Menu
      w={w}
      save={save}
      today={today}
      tools={tools}
      onBegin={begin}
      onResume={() => {
        if (!save.current) return;
        runRef.current = save.current;
        setRun(save.current);
      }}
      onRules={() => setScreen('rules')}
      onOpenRoom={openRoom}
      onJoinRoom={joinRoom}
    />
  );
}

function SoundMenu({ save, commit, sfx }: { save: Save; commit: (fn: (s: Save) => Save) => void; sfx: () => Sfx }) {
  const w = useWords();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent): void => {
      if (!(e.target as Element | null)?.closest('.tb-sound')) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="tb-sound">
      <button className="tb-icon" onClick={() => setOpen((o) => !o)} aria-label={w.sound} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {!(save.muted && save.musicOff) && <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div className="tb-sound-menu" role="group" aria-label={w.sound}>
          {(
            [
              ['music', w.music, !save.musicOff],
              ['fx', w.sound, !save.muted],
            ] as const
          ).map(([k, label, on]) => (
            <button
              key={k}
              className="tb-switch"
              role="switch"
              aria-checked={on}
              onClick={() => {
                commit((s) => (k === 'music' ? { ...s, musicOff: !s.musicOff } : { ...s, muted: !s.muted }));
                sfx().refresh();
              }}
            >
              {label} <span className="tb-knob" aria-hidden="true" />
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
  onBegin: (m: Mode, l: Level, target: number) => void;
  onResume: () => void;
  onRules: () => void;
  onOpenRoom: () => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [level, setLevel] = useState<Level>(save.level);
  const [target, setTarget] = useState(save.target);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const daily = save.daily[today];
  const resumeDaily = save.current?.mode === 'daily' && save.current.match.seed === hashString(`${SLUG}:${today}`);
  const resumeMatch = save.current?.mode === 'match';
  return (
    <div className="tb tb-scroll">
      <div className="tb-menu">
        <div className="tb-top-row">
          <span />
          <div className="tb-tools">{tools}</div>
        </div>
        <div className="tb-hero" aria-hidden="true">
          <span className="tb-hero-die">⚄</span>
          <span className="tb-hero-checker side-me" />
          <span className="tb-hero-checker side-them" />
          <span className="tb-hero-die is-b">⚂</span>
        </div>
        <h1 className="tb-title">{w.title}</h1>
        <p className="tb-tagline">{w.tagline}</p>

        <section className="tb-mode is-daily">
          <div>
            <b>{w.daily}</b>
            <small>{w.dailySub(dailyNumber(today))}</small>
            {daily && (
              <span className="tb-done mono">
                {w.dailyDone} · {daily.score} · {daily.line}
              </span>
            )}
          </div>
          {!daily && (
            <button className="tb-btn is-go" onClick={() => (resumeDaily ? onResume() : onBegin('daily', 'hard', 1))}>
              {resumeDaily ? w.resumeBtn : w.start}
            </button>
          )}
        </section>

        <section className="tb-mode">
          <div>
            <b>{w.match}</b>
            <small>{w.matchSub}</small>
          </div>
          {resumeMatch && (
            <button className="tb-btn is-go" onClick={onResume}>
              {w.resume}
            </button>
          )}
          <div className="tb-levels" role="radiogroup" aria-label={w.match}>
            {LEVELS.map((l) => (
              <button key={l} role="radio" aria-checked={level === l} className={`tb-level${level === l ? ' is-on' : ''}`} onClick={() => setLevel(l)}>
                <b>{w.level[l]}</b>
                <small>{w.levelHint[l]}</small>
              </button>
            ))}
          </div>
          <div className="tb-lengths" role="radiogroup" aria-label={w.length}>
            <span className="tb-label">{w.length}</span>
            {TARGETS.map((n) => (
              <button key={n} role="radio" aria-checked={target === n} className={`tb-chip-btn${target === n ? ' is-on' : ''}`} onClick={() => setTarget(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className={`tb-btn${resumeMatch ? '' : ' is-go'}`} onClick={() => onBegin('match', level, target)}>
            {w.start} · {w.level[level]} · {w.to(target)}
          </button>
        </section>

        <section className="tb-mode">
          <div>
            <b>{w.friends}</b>
            <small>{w.friendsSub}</small>
          </div>
          <button
            className="tb-btn is-go"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr((await onOpenRoom()) ?? '');
              setBusy(false);
            }}
          >
            {busy ? w.opening2 : w.openRoom}
          </button>
          <form
            className="tb-join"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^[A-HJKMNP-Z]{5}$/.test(code)) return setErr(w.noRoom);
              setBusy(true);
              setErr((await onJoinRoom(code)) ?? '');
              setBusy(false);
            }}
          >
            <input className="tb-input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder={w.joinCode} aria-label={w.joinCode} autoComplete="off" />
            <button className="tb-btn" disabled={busy || code.length !== 5}>
              {w.join}
            </button>
          </form>
          {err && <p className="tb-err">{err}</p>}
        </section>

        <button className="tb-btn is-ghost" onClick={onRules}>
          {w.howTo}
        </button>
        <p className="tb-stats mono">
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
  res: { mode: Mode; score: number; won: boolean; mine: number; theirs: number; line: string; best: boolean; kind: number };
  day: number;
  challenge?: ChallengeSpec;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const [msg, setMsg] = useState('');
  const share =
    res.mode === 'daily'
      ? `🎲 Backgammon #${day}\n${res.line}\n${res.score} points\n${window.location.origin}/games/backgammon`
      : `🎲 Backgammon ${res.mine}–${res.theirs}\n${res.line}\n${window.location.origin}/games/backgammon`;
  return (
    <div className="tb-sheet-wrap" role="dialog" aria-label={res.won ? w.matchWon : w.matchLost}>
      <div className={`tb-sheet${res.won ? ' is-win' : ''}`}>
        <h2>{res.mode === 'match' ? (res.won ? w.matchWon : w.matchLost) : w.dailyScore}</h2>
        <p className="tb-sheet-score mono">
          {res.mode === 'match' ? (
            <>
              <b>{res.mine}</b> – {res.theirs}
            </>
          ) : (
            <b>{res.score}</b>
          )}
        </p>
        {res.best && <p className="tb-newbest">{w.newBest}</p>}
        <ResultLine line={res.line || '🎲'} label={`${res.mine} to ${res.theirs}`} />
        <div className="tb-sheet-actions">
          {res.mode === 'challenge' && challenge ? (
            <a className="tb-btn is-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
              See the scoreboard
            </a>
          ) : (
            <>
              <button className="tb-btn is-go" onClick={onAgain} autoFocus>
                {w.playAgain}
              </button>
              <button className="tb-btn" onClick={() => void shareOrCopy({ title: 'Backgammon', text: share }).then((o) => setMsg(o === 'copied' ? w.copied : ''))}>
                {msg || w.share}
              </button>
            </>
          )}
          <button className="tb-btn is-ghost" onClick={onMenu}>
            {w.menu}
          </button>
        </div>
      </div>
    </div>
  );
}
