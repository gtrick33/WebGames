import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { NextDaily } from '../../components/NextDaily';
import { fits, fromSaved, linesAfter, newGame, place, resultLine, SIZE, streakMultiplier, toSaved, type Piece, type Saved, type State } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.square-deal';
const EPOCH = '2026-10-19';
type Mode = 'daily' | 'endless' | 'challenge';

interface DailyRecord {
  best: number;
  tries: number;
  lines: number;
  streak: number;
  /** true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  open?: boolean;
}
interface Save {
  best: number;
  runs: number;
  lines: number;
  daily: Record<string, DailyRecord>;
  /** Today's deal so far, saved after every move. */
  progress?: { day: string; game: Saved };
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, runs: 0, lines: 0, daily: {}, muted: false });

function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.lines = n(o.lines);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), lines: n(v.lines), streak: n(v.streak), ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    const game = p && typeof p.day === 'string' ? fromSaved(p.game) : null;
    if (p && game) s.progress = { day: p.day, game: toSaved(game) };
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

/** Where a dragged or selected piece would land, and whether it fits there. */
interface Aim {
  slot: number;
  row: number;
  col: number;
  ok: boolean;
}
interface Drag {
  slot: number;
  x: number;
  y: number;
  /** Pointer offset inside the piece, in cells, and how far the piece floats above a finger. */
  gx: number;
  gy: number;
  lift: number;
  cell: number;
  moved: boolean;
  aim: Aim | null;
}

const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <SquareDeal key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function SquareDeal({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  // Today's daily was started but its saved round can't be picked up again (storage lost or damaged):
  // settle it once, as it stood (0), so the arcade still counts the day. It never comes back.
  useEffect(() => {
    const cur = saveRef.current;
    const rec = cur.daily[today];
    if (!rec?.open || cur.progress?.day === today) return;
    commit({ ...cur, daily: { ...cur.daily, [today]: { ...rec, open: false } } });
    host.report({ type: 'end', score: rec.best, stats: {}, daily: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  // A friends' challenge skips the menu: one game on the challenge's seed. null = the menu.
  const [game, setGame] = useState<State | null>(() => (challenge ? newGame(challenge.seed) : null));
  const gameRef = useRef(game);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState({ row: 3, col: 3 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fx, setFx] = useState<{ cells: Set<number>; text: string; key: number } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  const overTune = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(overTune.current);
      sfxRef.current?.dispose();
      sfxRef.current = null;
    },
    [],
  );
  // Nothing runs on a clock, so the arcade's pause request only needs to drop a drag in progress.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (drag) setDrag(null);
  }

  const show = (g: State | null): void => {
    gameRef.current = g;
    setGame(g);
  };

  const begin = (m: Mode): void => {
    // Today's daily is one try: starting it uses the try up. Leaving it halfway (menu, reload) is
    // fine, it carries on from the last move, but it can never be started over.
    const cur = saveRef.current;
    const kept = m === 'daily' && cur.daily[today]?.open && cur.progress?.day === today ? fromSaved(cur.progress.game) : null;
    if (m === 'daily' && !kept) {
      if (cur.daily[today]) return;
      commit({ ...cur, daily: { ...cur.daily, [today]: { best: 0, tries: 1, lines: 0, streak: 0, open: true } }, progress: { day: today, game: toSaved(newGame(hashString(`square-deal:${today}`))) } });
    }
    const seed = m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`square-deal:${today}`) : randomSeed();
    started.current = false;
    setMode(m);
    setSelected(null);
    setDrag(null);
    setFx(null);
    setNewBest(false);
    show(kept ?? newGame(seed));
  };

  const finish = (s: State): void => {
    const cur = saveRef.current;
    setNewBest(s.score > cur.best);
    commit({
      ...cur,
      best: Math.max(cur.best, s.score),
      runs: cur.runs + 1,
      lines: cur.lines + s.lines,
      daily:
        mode === 'daily'
          ? { ...cur.daily, [today]: { best: s.score, tries: 1, lines: s.lines, streak: s.bestStreak } } : cur.daily,
      progress: mode === 'daily' ? undefined : cur.progress,
    });
    const end = { type: 'end' as const, score: s.score, stats: { lines: s.lines, streak: s.bestStreak } };
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    overTune.current = window.setTimeout(() => sfx().over(), 250);
  };

  const tryPlace = (slot: number, row: number, col: number): boolean => {
    const s = gameRef.current;
    if (!s || s.over) return false;
    const { state, result } = place(s, slot, row, col);
    if (!result.ok) {
      sfx().nope();
      return false;
    }
    if (!started.current) {
      started.current = true;
      host.report({ type: 'start' });
    }
    sfx().place();
    if (result.lines) {
      sfx().clear(result.lines, state.streak);
      navigator.vibrate?.(20);
      setFx({ cells: new Set(result.cleared), text: `+${result.points}${state.streak > 1 ? ` · 🔥×${streakMultiplier(state.streak)}` : ''}`, key: state.moves });
    }
    setSelected(null);
    show(state);
    if (state.over) finish(state);
    else if (mode === 'daily') commit({ ...saveRef.current, progress: { day: today, game: toSaved(state) } });
    return true;
  };

  // Board cell under a dragged piece: snap its top-left to the nearest cell.
  const aimFor = (d: Omit<Drag, 'aim'>): Aim | null => {
    const s = gameRef.current;
    const b = boardRef.current?.getBoundingClientRect();
    const piece = s?.tray[d.slot];
    if (!s || !b || !piece) return null;
    const cell = (b.width - 12) / SIZE;
    const left = d.x - d.gx * d.cell;
    const top = d.y - d.gy * d.cell - d.lift;
    const col = Math.round((left - b.left - 6) / cell);
    const row = Math.round((top - b.top - 6) / cell);
    if (row < -1 || col < -1 || row > SIZE || col > SIZE) return null;
    return { slot: d.slot, row, col, ok: fits(s.board, piece, row, col) };
  };

  // Drag state lives in a ref for the window listeners; React state only mirrors it for drawing.
  const dragRef = useRef<Drag | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const onTrayDown = (e: RPointerEvent<HTMLButtonElement>, slot: number): void => {
    const s = gameRef.current;
    const piece = s?.tray[slot];
    const b = boardRef.current?.getBoundingClientRect();
    if (!s || s.over || !piece || !b) return;
    e.preventDefault();
    sfx().pick();
    const cell = (b.width - 12) / SIZE;
    dragStart.current = { x: e.clientX, y: e.clientY };
    // Hold the piece by its middle; on a phone it floats above the finger so it stays visible.
    dragRef.current = { slot, x: e.clientX, y: e.clientY, gx: piece.w / 2, gy: piece.h / 2, lift: e.pointerType === 'touch' ? cell * 1.6 : 0, cell, moved: false, aim: null };
    setDrag(dragRef.current);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 6;
      const next = { ...d, x: e.clientX, y: e.clientY, moved };
      dragRef.current = { ...next, aim: moved ? aimFor(next) : null };
      setDrag(dragRef.current);
    };
    const up = (e: PointerEvent): void => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (d.moved) {
        const aim = aimFor({ ...d, x: e.clientX, y: e.clientY });
        if (aim?.ok) tryPlace(aim.slot, aim.row, aim.col);
      } else setSelected((cur) => (cur === d.slot ? null : d.slot)); // a tap selects (then tap a cell, or use the keys)
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // A selected piece goes where the player taps, centred on the tapped cell.
  const onCellTap = (i: number): void => {
    const s = gameRef.current;
    if (selected === null || !s) return;
    const piece = s.tray[selected];
    if (!piece) return;
    tryPlace(selected, Math.floor(i / SIZE) - Math.floor((piece.h - 1) / 2), (i % SIZE) - Math.floor((piece.w - 1) / 2));
  };

  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent): void => {
      const s = gameRef.current;
      if (!s || s.over) return;
      if (e.key >= '1' && e.key <= '3') {
        const slot = Number(e.key) - 1;
        if (s.tray[slot]) setSelected((cur) => (cur === slot ? null : slot));
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        setCursor((c) => ({ row: Math.max(0, Math.min(SIZE - 1, c.row + dr)), col: Math.max(0, Math.min(SIZE - 1, c.col + dc)) }));
      } else if ((e.key === 'Enter' || e.key === ' ') && selected !== null) {
        e.preventDefault();
        tryPlace(selected, cursor.row, cursor.col);
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => setFx(null), 900);
    return () => window.clearTimeout(t);
  }, [fx]);

  if (!game) return <Menu save={save} today={today} onPlay={begin} onMute={() => commit({ ...saveRef.current, muted: !saveRef.current.muted })} />;

  const s = game;
  // The aim: from a drag, else from the keyboard cursor while a piece is selected.
  const selPiece = selected !== null ? s.tray[selected] : null;
  const aim: Aim | null = drag ? drag.aim : selected !== null && selPiece ? { slot: selected, row: cursor.row, col: cursor.col, ok: fits(s.board, selPiece, cursor.row, cursor.col) } : null;
  const aimPiece = aim ? s.tray[aim.slot] : null;
  const ghost = new Set<number>();
  const willClear = new Set<number>();
  if (aim && aimPiece && aim.ok) {
    for (const [y, x] of aimPiece.cells) ghost.add((aim.row + y) * SIZE + aim.col + x);
    const { rows, cols } = linesAfter(s.board, aimPiece, aim.row, aim.col);
    for (const r of rows) for (let c = 0; c < SIZE; c++) willClear.add(r * SIZE + c);
    for (const c of cols) for (let r = 0; r < SIZE; r++) willClear.add(r * SIZE + c);
  }
  const daily = save.daily[today];
  const dragPiece = drag ? s.tray[drag.slot] : null;

  return (
    <div className="sd">
      <div className="sd-hud" aria-live="polite">
        <button className="sd-icon" onClick={() => show(null)} aria-label="Menu">
          ☰
        </button>
        <div className="sd-score">
          <b>{s.score}</b>
          <span>{mode === 'challenge' ? `⚔️ Challenge · round ${challenge?.round ?? 1}` : mode === 'daily' ? `Daily #${dailyNumber(today)}` : `Best ${save.best}`}</span>
        </div>
        <div className={`sd-streak${s.streak > 1 ? ' is-on' : ''}`} aria-label={`Streak ${s.streak}: line points ×${streakMultiplier(s.streak)}`}>
          🔥 ×{streakMultiplier(s.streak)}
        </div>
      </div>
      <div className="sd-board" ref={boardRef} role="grid" aria-label="Board, 8 by 8">
        {s.board.map((v, i) => {
          const isCursor = !drag && selected !== null && Math.floor(i / SIZE) === cursor.row && i % SIZE === cursor.col;
          const cls = ['sd-cell', v >= 0 ? `is-filled is-c${v}` : '', ghost.has(i) && aimPiece ? `is-ghost is-g${aimPiece.color}` : '', willClear.has(i) ? 'is-clear' : '', fx?.cells.has(i) ? 'is-burst' : '', isCursor ? 'is-cursor' : ''].filter(Boolean).join(' ');
          return <div key={fx?.cells.has(i) ? `${i}:${fx.key}` : i} className={cls} onPointerUp={() => !drag && onCellTap(i)} />;
        })}
        {fx && (
          <span key={fx.key} className="sd-pop">
            {fx.text}
          </span>
        )}
      </div>
      <div className="sd-tray">
        {s.tray.map((p, slot) => (
          <button
            key={p ? p.id : `empty${slot}`}
            className={`sd-slot${selected === slot ? ' is-selected' : ''}${drag?.slot === slot ? ' is-dragging' : ''}`}
            onPointerDown={(e) => p && onTrayDown(e, slot)}
            disabled={!p || s.over}
            aria-label={p ? `Piece ${slot + 1}: ${p.cells.length} squares${selected === slot ? ', selected' : ''}` : 'Used'}
          >
            {p && <Shape piece={p} unit="var(--sd-mini)" />}
          </button>
        ))}
      </div>
      <p className="sd-help">{selected !== null ? 'Tap a square to place it, or drag it on' : 'Drag a piece onto the board'}</p>
      {drag && dragPiece && drag.moved && (
        <div className="sd-float" style={{ left: drag.x - drag.gx * drag.cell, top: drag.y - drag.gy * drag.cell - drag.lift, ['--sd-unit' as string]: `${drag.cell - 3}px` }}>
          <Shape piece={dragPiece} unit="var(--sd-unit)" />
        </div>
      )}
      {s.over && (
        <div className="sd-over">
          <h2>{s.score >= 1500 ? 'What a deal!' : 'No room left'}</h2>
          <p className="sd-big">{s.score}</p>
          <p className="sd-muted">
            {s.lines} {s.lines === 1 ? 'line' : 'lines'} · best streak ×{streakMultiplier(s.bestStreak)} {newBest ? '· New best!' : `· best ${save.best}`}
          </p>
          <ResultLine line={resultLine(s.score, s.lines, s.bestStreak)} label={`${s.score} points, ${s.lines} lines`} />
          {mode === 'daily' && daily && (
            <p className="sd-muted">
              That was today’s one try. <NextDaily />
            </p>
          )}
          <div className="sd-row">
            {mode === 'challenge' && challenge ? (
              <a className="sd-btn sd-btn-go" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                See the scoreboard
              </a>
            ) : (
              <button className="sd-btn sd-btn-go" onClick={() => begin(mode === 'daily' ? 'endless' : mode)} autoFocus>
                {mode === 'daily' ? 'Play endless' : 'Play again'}
              </button>
            )}
            {mode === 'daily' && daily && <ShareButton text={`Square Deal #${dailyNumber(today)} 🟧\n${resultLine(daily.best, daily.lines, daily.streak)}\nScore: ${daily.best}\n${window.location.origin}/games/square-deal`} />}
            <button className="sd-btn" onClick={() => show(null)}>
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Shape({ piece, unit }: { piece: Piece; unit: string }) {
  return (
    <span className="sd-shape" style={{ gridTemplateColumns: `repeat(${piece.w}, ${unit})`, gridTemplateRows: `repeat(${piece.h}, ${unit})` }}>
      {piece.cells.map(([y, x]) => (
        <i key={`${y}:${x}`} className={`is-c${piece.color}`} style={{ gridRow: y + 1, gridColumn: x + 1 }} />
      ))}
    </span>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="sd-btn" onClick={() => void shareOrCopy({ title: 'Square Deal', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}

function Menu({ save, today, onPlay, onMute }: { save: Save; today: string; onPlay: (m: Mode) => void; onMute: () => void }) {
  const daily = save.daily[today];
  const going = daily?.open && save.progress?.day === today ? save.progress.game : null;
  return (
    <div className="sd sd-menu">
      <div className="sd-menu-top">
        <button className="sd-icon" onClick={onMute} aria-label={save.muted ? 'Turn sound on' : 'Turn sound off'}>
          {save.muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="sd-logo" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <i key={i} className={`is-c${[3, 3, 1, 3, 5, 1, 0, 0, 1][i]}`} />
        ))}
      </div>
      <h1 className="sd-title">
        Square <span>Deal</span>
      </h1>
      <p className="sd-tag">Drop the blocks, fill a row or a column, watch it clear. Chain clears for a streak.</p>
      <section className="sd-card">
        <div className="sd-card-head">
          <b>Daily deal #{dailyNumber(today)}</b>
          <span>{going ? `In progress · ${going.score} so far` : daily?.open !== undefined ? 'Left unfinished · one try a day' : daily ? `Today: ${daily.best}` : 'The same pieces for everyone · one try a day'}</span>
        </div>
        {going ? (
          <button className="sd-btn sd-btn-go sd-btn-big" onClick={() => onPlay('daily')}>
            Continue today’s deal
          </button>
        ) : daily ? (
          <div className="sd-done">
            {daily.best > 0 && <ShareButton text={`Square Deal #${dailyNumber(today)} 🟧\n${resultLine(daily.best, daily.lines, daily.streak)}\nScore: ${daily.best}\n${window.location.origin}/games/square-deal`} />}
            <NextDaily className="sd-muted" />
          </div>
        ) : (
          <button className="sd-btn sd-btn-go sd-btn-big" onClick={() => onPlay('daily')}>
            Play today’s deal
          </button>
        )}
      </section>
      <section className="sd-card">
        <div className="sd-card-head">
          <b>Endless</b>
          <span>A fresh shuffle every game</span>
        </div>
        <button className="sd-btn sd-btn-big" onClick={() => onPlay('endless')}>
          Play endless
        </button>
      </section>
      <p className="sd-muted">
        Best {save.best} · {save.runs} {save.runs === 1 ? 'game' : 'games'} · {save.lines} {save.lines === 1 ? 'line' : 'lines'} cleared
      </p>
    </div>
  );
}
