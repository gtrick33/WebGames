/**
 * A battle against computer crews on this device: the daily battle, a friends' challenge round, or a
 * skirmish set up in the menu. Your turns come from the battle screen; the computer's turns are
 * worked out at once (the screen shows each in turn, with a moment to "think").
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { hashString } from '../../platform/dates';
import { botTurn } from './ai';
import { Battle } from './Battle';
import { freeChar, type CharId } from './characters';
import { MAX_TURNS, newMatch, playTurn, UNIT_HP, type Level, type Match, type TurnInput } from './match';
import { botName } from './room';
import type { Scene } from './scene';
import type { Sfx } from './sound';
import type { TerrainId } from './terrains';
import { WEAPON_IDS } from './weapons';

export interface SoloSetup {
  seed: number;
  terrain: TerrainId;
  foes: number;
  level: Level;
  crewSize: number;
  turnSecs: number;
  name: string;
  char: CharId;
}

export function soloMatch(o: SoloSetup): Match {
  const taken: CharId[] = [o.char];
  const crews = [{ name: o.name, char: o.char, bot: null, seat: null }];
  for (let i = 0; i < o.foes; i++) {
    const c = freeChar(taken, (['robot', 'owl', 'duck', 'fox', 'slime'] as const)[i % 5]);
    taken.push(c);
    crews.push({ name: botName(c), char: c, bot: o.level as never, seat: null });
  }
  return newMatch({ seed: o.seed, terrain: o.terrain, crewSize: o.crewSize, turnSecs: o.turnSecs, crews: crews as Parameters<typeof newMatch>[0]['crews'] });
}

/**
 * A battle kept in a save (a challenge round to pick up again), checked against the battle it must be
 * a later turn of: anything else (an older format, a corrupted save) is null.
 */
export function resumeMatch(raw: unknown, first: Match): Match | null {
  try {
    const m = raw as Match;
    const int = (v: unknown, lo: number, hi: number): boolean => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
    const fin = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
    if (!m || typeof m !== 'object' || m.seed !== first.seed || m.terrain !== first.terrain || m.crewSize !== first.crewSize || m.turnSecs !== first.turnSecs) return null;
    if (!int(m.turn, 1, MAX_TURNS) || !int(m.crewTurn, 0, first.crews.length - 1) || !fin(m.wind) || !fin(m.liquidY) || typeof m.over !== 'boolean') return null;
    if (!(m.winner === null || int(m.winner, -1, first.crews.length - 1)) || !Array.isArray(m.craters) || m.craters.length % 3 || !m.craters.every(fin)) return null;
    if (!Array.isArray(m.crews) || m.crews.length !== first.crews.length || !Array.isArray(m.units) || m.units.length !== first.units.length) return null;
    const crewsOk = m.crews.every((c, i) => {
      const f = first.crews[i]!;
      return c && typeof c.name === 'string' && c.char === f.char && c.bot === f.bot && c.seat === null && int(c.next, 0, first.crewSize) && int(c.dmg, 0, 1e6) && int(c.kills, 0, 1e3) && c.ammo && WEAPON_IDS.every((w) => int(c.ammo[w], -1, 99));
    });
    const unitsOk = m.units.every((u, i) => {
      const f = first.units[i]!;
      return u && u.id === f.id && u.crew === f.crew && fin(u.x) && fin(u.y) && fin(u.hp) && u.hp <= UNIT_HP && (u.facing === 1 || u.facing === -1) && typeof u.dead === 'boolean' && typeof u.gone === 'boolean';
    });
    if (!crewsOk || !unitsOk || !m.units.some((u) => u.id === m.active)) return null;
    return { ...m, last: null };
  } catch {
    return null;
  }
}

/** A computer crew's turn (the same for everyone on the same battle: the daily and challenges). */
export const botMove = (m: Match): Match => playTurn(m, botTurn(m, m.crews[m.crewTurn]!.bot!, hashString(`${m.seed}:${m.turn}`))).match;

export function SoloBattle({
  setup,
  resume,
  onAdvance,
  sfx,
  paused,
  onPause,
  muted,
  onMute,
  onStart,
  onOver,
  children,
}: {
  setup: SoloSetup;
  /** A later turn of this battle to pick up from (a challenge round left halfway). */
  resume?: Match | null;
  /** Every new state of the battle (a challenge round keeps it). */
  onAdvance?: (m: Match) => void;
  sfx: () => Sfx;
  paused: boolean;
  onPause: () => void;
  muted: boolean;
  onMute: () => void;
  onStart: () => void;
  onOver: (m: Match) => void;
  children?: React.ReactNode;
}) {
  const [first] = useState(() => resume ?? soloMatch(setup));
  const head = useRef(first);
  const scene = useRef<Scene | null>(null);
  const started = useRef(false);
  const overRef = useRef(onOver);
  const advanceRef = useRef(onAdvance);
  useEffect(() => {
    overRef.current = onOver;
    advanceRef.current = onAdvance;
  });

  const advance = useCallback((m: Match) => {
    head.current = m;
    advanceRef.current?.(m);
    scene.current?.push(m);
  }, []);

  const onTurn = useCallback(
    (turn: number, input: TurnInput) => {
      if (turn !== head.current.turn) return;
      if (!started.current) {
        started.current = true;
        onStart();
      }
      advance(playTurn(head.current, input).match);
    },
    [advance, onStart],
  );

  // a computer crew's turn is worked out as the screen starts showing it (while it "thinks")
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onShown = useCallback(
    (m: Match) => {
      if (m.over) return overRef.current(m);
      if (!m.crews[m.crewTurn]?.bot) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (head.current.turn === m.turn && !head.current.over) advance(botMove(head.current));
      }, 60);
    },
    [advance],
  );

  return (
    <Battle
      match={first}
      mine={(c) => c === 0}
      onTurn={onTurn}
      onShown={onShown}
      botDelay={1000}
      sfx={sfx}
      paused={paused}
      onPause={onPause}
      muted={muted}
      onMute={onMute}
      sceneRef={scene}
    >
      {children}
    </Battle>
  );
}
