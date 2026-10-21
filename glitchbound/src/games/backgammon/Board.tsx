/**
 * The backgammon board, shared by the single-player game and the live room: an SVG board seen from
 * `me` (your home always bottom right), checkers that keep their identity from one position to the
 * next (so moves and hits glide), dice that tumble, tap-to-move with the legal targets lit, the bar
 * and the bear-off tray, pip counts and the match score. It shows a game and reports your roll and
 * steps; it never changes the game itself.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Level } from './ai';
import { BAR, mine, nextSteps, OFF, pips, posKey, startPos, turnDone, type Game, type Pos, type Side, type Step } from './logic';
import type { Sfx } from './sound';
import type { Words } from './text';

// ---- geometry (viewBox 1000 × 760)
const X0 = 30;
const X1 = 870;
const BAR_X = 420;
const BAR_W = 60;
const PW = 65;
const Y_TOP = 30;
const Y_BOT = 730;
const TRI = 290;
const R = 29;
const TRAY_X = 890;
const TRAY_W = 90;

/** Where display point d (1-24, you at the bottom) is: its column centre and whether it hangs from the top. */
function column(d: number): { x: number; top: boolean } {
  if (d <= 6) return { x: X1 - (d - 0.5) * PW, top: false };
  if (d <= 12) return { x: BAR_X - (d - 6 - 0.5) * PW, top: false };
  if (d <= 18) return { x: X0 + (d - 12 - 0.5) * PW, top: true };
  return { x: BAR_X + BAR_W + (d - 18 - 0.5) * PW, top: true };
}
const display = (i: number, me: Side): number => (me === 0 ? i : 25 - i);

/** A checker's spot: kth of n on a point, on the bar, or off. */
function spotOf(loc: string, k: number, n: number, me: Side): { x: number; y: number; slice?: boolean } {
  const [sideS, where] = loc.split(':') as [string, string];
  const side = Number(sideS) as Side;
  const bottom = side === me;
  if (where === 'bar') return { x: BAR_X + BAR_W / 2, y: bottom ? 450 + k * (R * 1.6) : 310 - k * (R * 1.6) };
  if (where === 'off') return { x: TRAY_X + TRAY_W / 2, y: bottom ? Y_BOT - 10 - k * 15 : Y_TOP + 10 + k * 15, slice: true };
  const d = display(Number(where.slice(1)), me);
  const c = column(d);
  const sp = n <= 5 ? 2 * R : (TRI - 2 * R) / (n - 1);
  return { x: c.x, y: c.top ? Y_TOP + R + k * sp : Y_BOT - R - k * sp };
}

type Layout = Record<string, number[]>;
const locsOf = (p: Pos, s: Side): Record<string, number> => {
  const out: Record<string, number> = {};
  for (let i = 1; i <= 24; i++) if (mine(p, s, i)) out[`${s}:p${i}`] = mine(p, s, i);
  if (p.bar[s]) out[`${s}:bar`] = p.bar[s];
  if (p.off[s]) out[`${s}:off`] = p.off[s];
  return out;
};
/** How far along its way a location is for side s (bar first, off last), to pair moved checkers sensibly. */
const progress = (loc: string): number => {
  const [s, where] = loc.split(':') as [string, string];
  if (where === 'bar') return -1;
  if (where === 'off') return 30;
  const i = Number(where.slice(1));
  return s === '0' ? 25 - i : i;
};

function freshLayout(p: Pos): Layout {
  const lay: Layout = {};
  let id = 0;
  for (const s of [0, 1] as Side[]) {
    id = s * 15;
    for (const [loc, n] of Object.entries(locsOf(p, s))) lay[loc] = Array.from({ length: n }, () => id++);
  }
  return lay;
}

/** The next layout: checkers that left a spot go to the spots that gained, nearest along the way first. */
function relayout(prev: Layout, p: Pos): Layout {
  const next: Layout = {};
  for (const s of [0, 1] as Side[]) {
    const want = locsOf(p, s);
    const pool: { id: number; from: string }[] = [];
    const keep: Layout = {};
    for (const [loc, ids] of Object.entries(prev)) {
      if (!loc.startsWith(`${s}:`)) continue;
      const n = want[loc] ?? 0;
      keep[loc] = ids.slice(0, n);
      for (const id of ids.slice(n)) pool.push({ id, from: loc });
    }
    const needs: string[] = [];
    for (const [loc, n] of Object.entries(want)) for (let k = (keep[loc]?.length ?? 0); k < n; k++) needs.push(loc);
    pool.sort((a, b) => progress(a.from) - progress(b.from));
    needs.sort((a, b) => progress(a) - progress(b));
    needs.forEach((loc, i) => {
      const id = pool[i]?.id ?? 900 + i;
      (keep[loc] ??= []).push(id);
    });
    Object.assign(next, keep);
  }
  return next;
}

function Die({ n, x, y, used, tumble }: { n: number; x: number; y: number; used: boolean; tumble: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  return (
    <g className={`tb-die${used ? ' is-used' : ''}${tumble ? ' is-tumble' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <rect x="-27" y="-27" width="54" height="54" rx="12" className="tb-die-face" />
      {dots[n]!.map(([dx, dy], i) => (
        <circle key={i} cx={dx * 13} cy={dy * 13} r="5.6" className="tb-pip" />
      ))}
    </g>
  );
}

export interface BoardProps {
  w: Words;
  game: Game;
  me: Side;
  names: [string, string];
  bots?: [Level | null, Level | null];
  canAct: boolean;
  onRoll?: () => void;
  onStep?: (st: Step) => void;
  onUndo?: () => void;
  onDone?: () => void;
  sfx: () => Sfx;
  score: [number, number];
  target: number;
  tools?: ReactNode;
  overlay?: ReactNode;
  note?: string;
}

export function Board({ w, game, me, names, bots, canAct, onRoll, onStep, onUndo, onDone, sfx, score, target, tools, overlay, note }: BoardProps) {
  const them = (1 - me) as Side;
  const p = game.pos;
  // a tall box (a phone held upright) turns the board a quarter turn, so it fills the height
  const stageRef = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVertical(el.clientHeight > el.clientWidth * 1.15));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** Keeps text upright on the turned board. */
  const upright = (x: number, y: number): string | undefined => (vertical ? `rotate(-90 ${x} ${y})` : undefined);
  const key = posKey(p);
  const [lay, setLay] = useState(() => ({ key, map: relayout(freshLayout(startPos()), p) }));
  if (lay.key !== key) setLay({ key, map: relayout(lay.map, p) });
  const layout = lay.key === key ? lay.map : relayout(lay.map, p);

  const legal = canAct && game.phase === 'move' ? nextSteps(game) : [];
  const sources = [...new Set(legal.map((s) => s.from))];
  const [sel, setSel] = useState<number | null>(null);
  // the bar is the only way in: select it for the player
  const selected = sel !== null && sources.includes(sel) ? sel : sources.length === 1 ? sources[0]! : null;
  const targets = selected !== null ? legal.filter((s) => s.from === selected) : [];
  const myRoll = canAct && (game.phase === 'roll' || game.phase === 'opening');
  const done = canAct && turnDone(game);

  // ---- dice tumble and sounds, from what changed
  const prevRef = useRef<Game | null>(null);
  const [tumble, setTumble] = useState(0);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (!prev || prev === game) return;
    const s = sfx();
    if (game.rolls !== prev.rolls && game.roll) {
      s.rattle();
      window.setTimeout(() => s.dice(), 380);
      const t = window.setTimeout(() => setTumble((n) => n + 1), 0);
      void t;
    }
    // steps made since (this turn's, or a whole turn that just ended)
    const fresh = game.steps.length > prev.steps.length && game.turn === prev.turn ? game.steps.slice(prev.steps.length) : game.lastTurn && game.lastTurn !== prev.lastTurn && prev.steps.length === 0 ? game.lastTurn.steps : [];
    fresh.forEach((st, i) =>
      window.setTimeout(() => {
        if (st.hit) s.hit();
        else if (st.to === OFF[game.lastTurn?.side ?? game.turn]) s.bearOff();
        else s.clack(2);
      }, i * 140),
    );
    if (game.phase === 'over' && prev.phase !== 'over' && game.winner !== null) window.setTimeout(() => (game.winner === me ? s.win(game.points) : s.lose()), 300);
    if (game.turn === me && prev.turn !== me && game.phase === 'roll') s.turn();
  }, [game, me, sfx]);
  const [tumbleSeen, setTumbleSeen] = useState(0);
  const tumbling = tumble !== tumbleSeen;
  useEffect(() => {
    if (!tumbling) return;
    const t = window.setTimeout(() => setTumbleSeen(tumble), 650);
    return () => window.clearTimeout(t);
  }, [tumbling, tumble]);

  const tapSource = (from: number): void => {
    if (!canAct) return;
    const opts = legal.filter((s) => s.from === from);
    if (!opts.length) {
      if (selected !== null) tapTarget(from);
      else sfx().nope();
      return;
    }
    const dests = [...new Set(opts.map((s) => s.to))];
    // one place to go: go there
    if (dests.length === 1) {
      onStep?.(opts.sort((a, b) => b.die - a.die)[0]!);
      setSel(null);
      return;
    }
    setSel(from === selected ? null : from);
    sfx().click();
  };
  const tapTarget = (to: number): void => {
    const st = targets.filter((s) => s.to === to).sort((a, b) => b.die - a.die)[0];
    if (st) {
      onStep?.(st);
      setSel(null);
    } else if (sources.includes(to)) tapSource(to);
    else sfx().nope();
  };
  const tapPoint = (i: number): void => {
    if (selected !== null && targets.some((s) => s.to === i)) tapTarget(i);
    else if (sources.includes(i)) tapSource(i);
    else if (selected !== null) setSel(null);
  };

  // ---- drawing
  const tris: ReactNode[] = [];
  for (let d = 1; d <= 24; d++) {
    const c = column(d);
    const i = me === 0 ? d : 25 - d;
    const lit = targets.some((s) => s.to === i);
    const src = sources.includes(i);
    const base = c.top ? Y_TOP : Y_BOT;
    const tip = c.top ? Y_TOP + TRI : Y_BOT - TRI;
    tris.push(
      <g
        key={d}
        className={`tb-point${d % 2 ? ' is-odd' : ' is-even'}${lit ? ' is-target' : ''}${src ? ' is-source' : ''}`}
        onClick={() => tapPoint(i)}
        tabIndex={canAct && (lit || src) ? 0 : -1}
        role="button"
        aria-label={`${d}: ${mine(p, me, i) ? `${mine(p, me, i)} ${names[me]}` : mine(p, them, i) ? `${mine(p, them, i)} ${names[them]}` : '0'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            tapPoint(i);
          }
        }}
      >
        <rect x={c.x - PW / 2} y={c.top ? Y_TOP : Y_BOT - TRI - 20} width={PW} height={TRI + 20} className="tb-hit" />
        <path d={`M${c.x - PW / 2 + 3} ${base} L${c.x} ${tip} L${c.x + PW / 2 - 3} ${base} Z`} className="tb-tri" />
        {lit && <circle cx={c.x} cy={c.top ? Y_TOP + R + mine(p, game.turn, i) * 2 * R : Y_BOT - R - mine(p, game.turn, i) * 2 * R} r={R * 0.55} className="tb-land" />}
        <text x={c.x} y={c.top ? Y_TOP - 8 : Y_BOT + 22} className="tb-num" transform={upright(c.x, c.top ? Y_TOP - 13 : Y_BOT + 17)}>
          {d}
        </text>
      </g>,
    );
  }
  const checkers: ReactNode[] = [];
  for (const [loc, ids] of Object.entries(layout)) {
    const side = Number(loc[0]) as Side;
    ids.forEach((id, k) => {
      const at = spotOf(loc, k, ids.length, me);
      const where = loc.split(':')[1]!;
      const i = where === 'bar' ? BAR[side] : where === 'off' ? -1 : Number(where.slice(1));
      const isTop = k === ids.length - 1;
      const isSel = selected === i && isTop && side === game.turn;
      const isSrc = sources.includes(i) && isTop && side === game.turn && canAct;
      checkers.push(
        <g key={id} className={`tb-checker side-${side === me ? 'me' : 'them'}${at.slice ? ' is-off' : ''}${isSel ? ' is-sel' : ''}${isSrc ? ' is-src' : ''}`} style={{ transform: `translate(${at.x}px, ${at.y}px)` }} onClick={() => (where === 'off' ? undefined : tapPoint(i))}>
          {at.slice ? (
            <rect x={-TRAY_W / 2 + 8} y="-6" width={TRAY_W - 16} height="12" rx="5" className="tb-slice" />
          ) : (
            <>
              <circle r={R} className="tb-disc" />
              <circle r={R * 0.62} className="tb-ring" />
              <circle r={R * 0.26} className="tb-dot" />
            </>
          )}
        </g>,
      );
    });
  }
  const offTarget = targets.some((s) => s.to === OFF[game.turn]);
  const roll = game.roll;
  const diceSide = game.turn === me ? 1 : 0;
  const diceX = diceSide ? BAR_X + BAR_W + (X1 - BAR_X - BAR_W) / 2 : X0 + (BAR_X - X0) / 2;
  const left = [...game.left];
  const dieUsed = (idx: number): boolean => {
    if (!roll) return true;
    if (game.phase !== 'move') return false;
    if (roll[0] === roll[1]) return left.length === 0;
    return !left.includes(roll[idx]!);
  };
  // keyboard: R or Space rolls, U undoes, Enter finishes the turn
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ((k === 'r' || k === ' ') && myRoll && onRoll) {
        e.preventDefault();
        onRoll();
      } else if (k === 'u' && game.steps.length && onUndo) onUndo();
      else if (k === 'enter' && done && onDone && (e.target as Element | null)?.tagName !== 'BUTTON') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const usPips = pips(p, me);
  const themPips = pips(p, them);

  return (
    <div className="tb-wrap">
      <header className="tb-bar">
        <span className={`tb-player is-them${game.turn === them && game.phase !== 'over' ? ' is-turn' : ''}`}>
          <i className="tb-chip side-them" aria-hidden="true" />
          <b>{names[them]}</b>
          {bots?.[them] && <small className="mono">{w.level[bots[them]!]}</small>}
          <small className="mono">
            {themPips} {w.pips}
          </small>
        </span>
        <span className="tb-match mono" aria-label={`${score[me]} – ${score[them]}, ${w.to(target)}`}>
          <b>{score[me]}</b>–<b>{score[them]}</b> <small>{note ?? w.to(target)}</small>
        </span>
        <div className="tb-tools">{tools}</div>
      </header>

      <div className="tb-stage" ref={stageRef}>
        <svg className="tb-board" viewBox={vertical ? '0 0 760 1000' : '0 0 1000 760'} role="img" aria-label={w.title}>
          <defs>
            <linearGradient id="tb-wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b5733a" />
              <stop offset="1" stopColor="#7a4520" />
            </linearGradient>
            <radialGradient id="tb-felt" cx="50%" cy="50%" r="70%">
              <stop offset="0" stopColor="#1f6f6b" />
              <stop offset="1" stopColor="#123f45" />
            </radialGradient>
          </defs>
          <g transform={vertical ? 'translate(760 0) rotate(90)' : undefined}>
          <rect x="4" y="4" width="992" height="752" rx="28" className="tb-frame" />
          <rect x={X0} y={Y_TOP} width={BAR_X - X0} height={Y_BOT - Y_TOP} rx="8" className="tb-felt" />
          <rect x={BAR_X + BAR_W} y={Y_TOP} width={X1 - BAR_X - BAR_W} height={Y_BOT - Y_TOP} rx="8" className="tb-felt" />
          <rect x={BAR_X} y={Y_TOP - 12} width={BAR_W} height={Y_BOT - Y_TOP + 24} rx="10" className={`tb-barstrip${selected === BAR[game.turn] ? ' is-sel' : ''}`} onClick={() => sources.includes(BAR[game.turn]) && tapSource(BAR[game.turn])} />
          <rect x={TRAY_X} y={Y_TOP} width={TRAY_W} height={Y_BOT - Y_TOP} rx="12" className={`tb-tray${offTarget ? ' is-target' : ''}`} onClick={() => offTarget && tapTarget(OFF[game.turn])} />
          <text x={TRAY_X + TRAY_W / 2} y={Y_BOT / 2 + 20} className={`tb-tray-label${vertical ? ' is-flat' : ''}`} transform={upright(TRAY_X + TRAY_W / 2, Y_BOT / 2 + 20)}>
            {w.off}
          </text>
          {tris}
          {checkers}
          {roll && (
            <g key={tumble} className={tumbling ? 'tb-dice is-rolling' : 'tb-dice'}>
              <Die n={roll[0]} x={diceX - 36} y={380} used={dieUsed(0)} tumble={tumbling} />
              <Die n={roll[1]} x={diceX + 36} y={380} used={dieUsed(1)} tumble={tumbling} />
              {roll[0] === roll[1] && game.phase === 'move' && (
                <text x={diceX} y={436} className="tb-double" transform={upright(diceX, 430)}>
                  ×{left.length}
                </text>
              )}
            </g>
          )}
          </g>
        </svg>
        {overlay}
      </div>

      <footer className="tb-foot">
        <span className={`tb-player is-me${game.turn === me && game.phase !== 'over' ? ' is-turn' : ''}`}>
          <i className="tb-chip side-me" aria-hidden="true" />
          <b>{names[me]}</b>
          <small className="mono">
            {usPips} {w.pips}
          </small>
        </span>
        <div className="tb-actions">
          {myRoll && onRoll && (
            <button className="tb-btn is-go is-roll" onClick={onRoll} autoFocus>
              🎲 {w.roll}
            </button>
          )}
          {canAct && game.phase === 'move' && game.steps.length > 0 && onUndo && (
            <button className="tb-btn" onClick={onUndo}>
              ↶ {w.undo}
            </button>
          )}
          {done && game.steps.length > 0 && onDone && (
            <button className="tb-btn is-go" onClick={onDone} autoFocus>
              {w.done} ✓
            </button>
          )}
          {done && game.steps.length === 0 && <span className="tb-hint mono">{w.noMoves}</span>}
          {!canAct && game.phase !== 'over' && <span className="tb-hint mono">{w.theirTurn(names[game.phase === 'opening' ? me : game.turn])}</span>}
          {canAct && game.phase === 'move' && !done && <span className="tb-hint mono">{w.yourTurn}</span>}
        </div>
      </footer>
    </div>
  );
}
