/**
 * The backgammon board, shared by the single-player game and the live room: an SVG board seen from
 * `me` (your home always bottom right), always the right way round (landscape first: on an upright
 * phone it fits the width), checkers that keep their identity from one position to the next (so
 * moves and hits glide), dice that shake before they land, and moves you choose: tap a checker and
 * every place it can reach lights up with its count (each number, and both together), tap one to go
 * there. The bar and the bear-off tray, pip counts and the match score. It shows a game and reports
 * your roll and steps; it never changes the game itself.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Level } from './ai';
import { applyStep, BAR, mine, nextSteps, OFF, pips, posKey, routesFrom, startPos, stepsBetween, turnDone, type Game, type Pos, type Route, type Side, type Step } from './logic';
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
/** The dice shake this long before they land (no moves until then). */
export const ROLL_MS = 650;
/** A moving checker bounces from point to point, this long each (one bounce per point it passes). */
export const PIP_MS = 115;
/** A hit checker's flight to the bar, once the mover has landed on it. */
const HIT_MS = 340;
/** A beat after a checker lands, before the next one sets off (and before a finished turn passes). */
const BEAT_MS = 120;

/** The points a step bounces on along its way, in order (not the one it lands on); in from the bar is one leap. */
function passes(side: Side, st: Step): number[] {
  if (st.from === BAR[side]) return [];
  const d = side === 0 ? -1 : 1;
  const out: number[] = [];
  for (let k = st.from + d; k !== st.to && out.length < 26; k += d) if (k >= 1 && k <= 24) out.push(k);
  return out;
}
/** Until the moving checker lands. */
const flightMs = (side: Side, st: Step): number => (st.from === BAR[side] ? 3 : passes(side, st).length + 1) * PIP_MS;
/** How long a step takes on the board: the checker's bounces, then a hit checker's flight to the bar. */
export const moveMs = (side: Side, st: Step): number => flightMs(side, st) + (st.hit ? HIT_MS : 0);

const place = (x: number, y: number, s = 1): string => `translate(${x}px, ${y}px) scale(${s})`;
/** Bounces through the points: up and over between each two, touching down on each. */
function hopFrames(pts: { x: number; y: number }[], lift = 22): Keyframe[] {
  const n = pts.length - 1;
  const frames: Keyframe[] = [];
  pts.forEach((pt, i) => {
    if (i > 0) {
      const a = pts[i - 1]!;
      frames.push({ offset: (2 * i - 1) / (2 * n), transform: place((a.x + pt.x) / 2, (a.y + pt.y) / 2 - lift, 1.16), easing: 'ease-in' });
    }
    frames.push({ offset: i / n, transform: place(pt.x, pt.y), easing: 'ease-out' });
  });
  return frames;
}

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

function Die({ n, x, y, used }: { n: number; x: number; y: number; used: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  return (
    <g className={`tb-die${used ? ' is-used' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g className="tb-die-in">
        <rect x="-27" y="-27" width="54" height="54" rx="12" className="tb-die-face" />
        {dots[n]!.map(([dx, dy], i) => (
          <circle key={i} cx={dx * 13} cy={dy * 13} r="5.6" className="tb-pip" />
        ))}
      </g>
    </g>
  );
}

/** How far a route goes, as the numbers it uses add up (what the player reads off the dice). */
const count = (r: Route): number => r.steps.reduce((a, st) => a + st.die, 0);

/** A place the picked-up checker can go: a ring where it would land, with the count to get there. */
function Landing({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g className="tb-land" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle r={R * 0.92} className="tb-land-ring" />
      <text y="9" className="tb-land-n">
        {n}
      </text>
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
  /** The turn is over (nothing left to play): the board calls it by itself, a beat after the last checker lands. */
  onDone?: () => void;
  sfx: () => Sfx;
  score: [number, number];
  target: number;
  tools?: ReactNode;
  overlay?: ReactNode;
  note?: string;
}

export function Board({ w, game, me, names, bots, canAct, onRoll, onStep, onDone, sfx, score, target, tools, overlay, note }: BoardProps) {
  const them = (1 - me) as Side;
  const sfxRef = useRef(sfx);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    sfxRef.current = sfx;
    onDoneRef.current = onDone;
  });

  // ---- what the board shows: the game's position, reached one step at a time, each step bouncing
  // through the points it passes, whoever moved (you, the computer, a friend on their phone)
  const [shown, setShown] = useState<Pos>(game.pos);
  const [moving, setMoving] = useState(false);
  const seen = useRef(game);
  const shownRef = useRef(game.pos);
  const queue = useRef<{ side: Side; st: Step }[]>([]);
  const playing = useRef(false);
  const timers = useRef<number[]>([]);
  /** The step the last change of `shown` made (for the checkers to bounce along it). */
  const current = useRef<{ key: string; side: Side; st: Step; before: Pos } | null>(null);
  const pump = (): void => {
    if (playing.current) return;
    const next = queue.current.shift();
    if (!next) {
      timers.current = [];
      setMoving(false);
      // anything the steps did not account for (not expected): straight there
      if (posKey(shownRef.current) !== posKey(seen.current.pos)) {
        current.current = null;
        shownRef.current = seen.current.pos;
        setShown(seen.current.pos);
      }
      return;
    }
    playing.current = true;
    setMoving(true);
    const before = shownRef.current;
    const after = applyStep(before, next.side, next.st);
    current.current = { key: posKey(after), side: next.side, st: next.st, before };
    shownRef.current = after;
    setShown(after);
    timers.current.push(
      // a light tap on each point it bounces on, then the landing
      ...passes(next.side, next.st).map((_, k) => window.setTimeout(() => sfxRef.current().tap(), (k + 1) * PIP_MS)),
      window.setTimeout(() => {
        const s = sfxRef.current();
        if (next.st.hit) s.hit();
        else if (next.st.to === OFF[next.side]) s.bearOff();
        else s.clack(Math.abs(after.pts[next.st.to] ?? 0));
      }, flightMs(next.side, next.st)),
      window.setTimeout(() => {
        playing.current = false;
        pump();
      }, moveMs(next.side, next.st) + BEAT_MS),
    );
  };
  useEffect(() => {
    const prev = seen.current;
    if (prev === game) return;
    seen.current = game;
    const steps = stepsBetween(prev, game);
    if (steps === null) {
      // a new game, a position from nowhere: straight there
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      queue.current = [];
      playing.current = false;
      current.current = null;
      shownRef.current = game.pos;
      setShown(game.pos);
      setMoving(false);
      return;
    }
    queue.current.push(...steps);
    pump();
    // pump only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const p = shown;
  const key = posKey(p);
  const [lay, setLay] = useState(() => ({ key, map: relayout(freshLayout(startPos()), p) }));
  if (lay.key !== key) setLay({ key, map: relayout(lay.map, p) });
  const layout = lay.key === key ? lay.map : relayout(lay.map, p);

  // ---- the checkers move: the mover bounces along its way, a checker it hits flies to the bar once it
  // lands, anything else that shifts (a stack closing up, a new game) glides
  const spots = useMemo(() => {
    const m = new Map<number, { x: number; y: number; loc: string }>();
    for (const [loc, ids] of Object.entries(layout))
      ids.forEach((id, k) => {
        const at = spotOf(loc, k, ids.length, me);
        m.set(id, { x: at.x, y: at.y, loc });
      });
    return m;
  }, [layout, me]);
  const els = useRef(new Map<number, SVGGElement>());
  const was = useRef(spots);
  useLayoutEffect(() => {
    const before = was.current;
    was.current = spots;
    if (before === spots) return;
    const mv = current.current?.key === key ? current.current : null;
    /** Where a checker passing point k touches down: on top of what is there. */
    const touch = (k: number, pos: Pos): { x: number; y: number } => {
      const c = column(display(k, me));
      const n = Math.min(4, Math.abs(pos.pts[k] ?? 0));
      return { x: c.x, y: c.top ? Y_TOP + R + n * 2 * R : Y_BOT - R - n * 2 * R };
    };
    let landsAt = 0;
    const moves = [...spots].filter(([id, to]) => {
      const from = before.get(id);
      return !!from && (from.x !== to.x || from.y !== to.y);
    });
    // the mover first: a hit waits for it
    moves.sort(([, a], [, b]) => (mv && Number(a.loc[0]) === mv.side ? -1 : 0) - (mv && Number(b.loc[0]) === mv.side ? -1 : 0));
    for (const [id, to] of moves) {
      const from = before.get(id)!;
      const el = els.current.get(id);
      if (!el || typeof el.animate !== 'function') continue;
      el.getAnimations().forEach((a) => a.cancel());
      const side = Number(to.loc[0]) as Side;
      if (mv && side === mv.side && from.loc !== to.loc) {
        const pts = [from, ...passes(mv.side, mv.st).map((k) => touch(k, mv.before)), to];
        landsAt = flightMs(mv.side, mv.st);
        el.animate(hopFrames(pts, pts.length === 2 ? 60 : 22), { duration: landsAt });
      } else if (mv?.st.hit && side !== mv.side && to.loc.endsWith(':bar')) {
        el.animate(hopFrames([from, to], 70), { duration: HIT_MS, delay: Math.max(0, landsAt - 40), fill: 'backwards' });
      } else {
        el.animate([{ transform: place(from.x, from.y) }, { transform: place(to.x, to.y) }], { duration: 240, easing: 'ease-out' });
      }
    }
  }, [spots, key, me]);

  // ---- the dice: a short shake as they roll, faces flicking, before they land (no moves until then)
  const [settled, setSettled] = useState(game.rolls);
  const rolling = !!game.roll && game.rolls !== settled;
  useEffect(() => {
    if (!rolling) return;
    const t = window.setTimeout(() => setSettled(game.rolls), ROLL_MS);
    return () => window.clearTimeout(t);
  }, [rolling, game.rolls]);
  const [faces, setFaces] = useState<[number, number]>([1, 6]);
  useEffect(() => {
    if (!rolling) return;
    const face = (): number => 1 + Math.floor(Math.random() * 6);
    const id = window.setInterval(() => setFaces([face(), face()]), 70);
    return () => window.clearInterval(id);
  }, [rolling]);

  // ---- moves: tap a checker, see where it can go (each number and both together), tap one; a move
  // is made once it is chosen (no undo), and the turn passes by itself when nothing is left to play
  const busy = moving || rolling;
  const legal = canAct && game.phase === 'move' && !busy ? nextSteps(game) : [];
  const sources = [...new Set(legal.map((s) => s.from))];
  const [sel, setSel] = useState<number | null>(null);
  // only one checker can move (one on the bar, say): it is picked up for the player; where it goes is theirs
  const selected = sel !== null && sources.includes(sel) ? sel : sources.length === 1 ? sources[0]! : null;
  const routes = useMemo(() => (selected !== null ? routesFrom(game, selected) : []), [game, selected]);
  const routeTo = (to: number): Route | undefined => routes.find((r) => r.to === to);
  const myRoll = canAct && !busy && (game.phase === 'roll' || game.phase === 'opening');
  const stuck = canAct && !busy && game.phase === 'move' && game.steps.length === 0 && turnDone(game);
  const turnOver = canAct && !busy && game.phase === 'move' && game.steps.length > 0 && turnDone(game);
  useEffect(() => {
    if (!turnOver) return;
    const t = window.setTimeout(() => onDoneRef.current?.(), BEAT_MS * 2);
    return () => window.clearTimeout(t);
  }, [turnOver]);
  /** Plays a route: all its steps at once (the board shows them one after the other). */
  const go = (r: Route): void => {
    setSel(null);
    for (const st of r.steps) onStep?.(st);
  };

  // ---- sounds, from what changed
  const prevRef = useRef<Game | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (!prev || prev === game) return;
    const s = sfx();
    if (game.rolls !== prev.rolls && game.roll) {
      s.rattle();
      window.setTimeout(() => s.dice(), ROLL_MS - 60);
    }
    if (game.phase === 'over' && prev.phase !== 'over' && game.winner !== null) window.setTimeout(() => (game.winner === me ? s.win(game.points) : s.lose()), 300);
    if (game.turn === me && prev.turn !== me && game.phase === 'roll') s.turn();
  }, [game, me, sfx]);
  const tapSource = (from: number): void => {
    if (!canAct || busy) return;
    if (!sources.includes(from)) {
      if (selected !== null) tapTarget(from);
      else sfx().nope();
      return;
    }
    // a second tap puts it down again (unless it is the only checker that can move)
    setSel(from === selected && sources.length > 1 ? null : from);
    sfx().click();
  };
  const tapTarget = (to: number): void => {
    const r = routeTo(to);
    if (r) go(r);
    else if (sources.includes(to)) tapSource(to);
    else sfx().nope();
  };
  const tapPoint = (i: number): void => {
    if (selected !== null && routeTo(i)) tapTarget(i);
    else if (sources.includes(i)) tapSource(i);
    else if (selected !== null) setSel(null);
  };

  // ---- drawing
  const tris: ReactNode[] = [];
  // the landing rings go over the checkers (a stack would hide them)
  const landings: ReactNode[] = [];
  for (let d = 1; d <= 24; d++) {
    const c = column(d);
    const i = me === 0 ? d : 25 - d;
    const route = routeTo(i);
    const lit = !!route;
    const src = sources.includes(i);
    const base = c.top ? Y_TOP : Y_BOT;
    const tip = c.top ? Y_TOP + TRI : Y_BOT - TRI;
    tris.push(
      <g
        key={d}
        className={`tb-point${d % 2 ? ' is-odd' : ' is-even'}${lit ? ' is-target' : ''}${src ? ' is-source' : ''}`}
        onClick={(e) => {
          // a tap leaves no focus ring behind (the keyboard keeps its own)
          if (e.detail) (e.currentTarget as SVGGElement).blur();
          tapPoint(i);
        }}
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
        <text x={c.x} y={c.top ? Y_TOP - 8 : Y_BOT + 22} className="tb-num">
          {d}
        </text>
      </g>,
    );
    if (route) landings.push(<Landing key={d} x={c.x} y={c.top ? Y_TOP + R + Math.min(4, mine(p, game.turn, i)) * 2 * R : Y_BOT - R - Math.min(4, mine(p, game.turn, i)) * 2 * R} n={count(route)} />);
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
        <g
          key={id}
          ref={(el) => {
            if (el) els.current.set(id, el);
            else els.current.delete(id);
          }}
          className={`tb-checker side-${side === me ? 'me' : 'them'}${at.slice ? ' is-off' : ''}${isSel ? ' is-sel' : ''}${isSrc ? ' is-src' : ''}`}
          style={{ transform: place(at.x, at.y) }}
          onClick={() => (where === 'off' ? undefined : tapPoint(i))}
        >
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
  const offRoute = routeTo(OFF[game.turn]);
  const offTarget = !!offRoute;
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
  // keyboard: R or Space rolls
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ((k === 'r' || k === ' ') && myRoll && onRoll) {
        e.preventDefault();
        onRoll();
      }
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

      <div className="tb-stage">
        <p className="tb-rotate mono" aria-hidden="true">
          ↻ {w.turnSideways}
        </p>
        <svg className="tb-board" viewBox="0 0 1000 760" role="img" aria-label={w.title}>
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
          <rect x="4" y="4" width="992" height="752" rx="28" className="tb-frame" />
          <rect x={X0} y={Y_TOP} width={BAR_X - X0} height={Y_BOT - Y_TOP} rx="8" className="tb-felt" />
          <rect x={BAR_X + BAR_W} y={Y_TOP} width={X1 - BAR_X - BAR_W} height={Y_BOT - Y_TOP} rx="8" className="tb-felt" />
          <rect x={BAR_X} y={Y_TOP - 12} width={BAR_W} height={Y_BOT - Y_TOP + 24} rx="10" className={`tb-barstrip${selected === BAR[game.turn] ? ' is-sel' : ''}`} onClick={() => sources.includes(BAR[game.turn]) && tapSource(BAR[game.turn])} />
          <rect x={TRAY_X} y={Y_TOP} width={TRAY_W} height={Y_BOT - Y_TOP} rx="12" className={`tb-tray${offTarget ? ' is-target' : ''}`} onClick={() => offTarget && tapTarget(OFF[game.turn])} />
          <text x={TRAY_X + TRAY_W / 2} y={Y_BOT / 2 + 20} className="tb-tray-label">
            {w.off}
          </text>
          {offRoute && <Landing x={TRAY_X + TRAY_W / 2} y={game.turn === me ? Y_BOT - 60 : Y_TOP + 60} n={count(offRoute)} />}
          {tris}
          {checkers}
          {landings}
          {roll && (
            <g key={game.rolls} className={rolling ? 'tb-dice is-rolling' : 'tb-dice is-landed'}>
              <Die n={rolling ? faces[0] : roll[0]} x={diceX - 36} y={380} used={!rolling && dieUsed(0)} />
              <Die n={rolling ? faces[1] : roll[1]} x={diceX + 36} y={380} used={!rolling && dieUsed(1)} />
              {!rolling && roll[0] === roll[1] && game.phase === 'move' && (
                <text x={diceX} y={436} className="tb-double">
                  ×{left.length}
                </text>
              )}
            </g>
          )}
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
          {stuck && <span className="tb-hint mono">{w.noMoves}</span>}
          {!canAct && game.phase !== 'over' && <span className="tb-hint mono">{w.theirTurn(names[game.phase === 'opening' ? me : game.turn])}</span>}
          {canAct && game.phase === 'move' && !turnDone(game) && <span className="tb-hint mono">{w.yourTurn}</span>}
        </div>
      </footer>
    </div>
  );
}
