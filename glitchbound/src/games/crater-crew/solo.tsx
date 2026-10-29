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
import { newMatch, playTurn, type Level, type Match, type TurnInput } from './match';
import { botName } from './room';
import type { Scene } from './scene';
import type { Sfx } from './sound';
import type { TerrainId } from './terrains';

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

/** A computer crew's turn (the same for everyone on the same battle: the daily and challenges). */
export const botMove = (m: Match): Match => playTurn(m, botTurn(m, m.crews[m.crewTurn]!.bot!, hashString(`${m.seed}:${m.turn}`))).match;

export function SoloBattle({
  setup,
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
  sfx: () => Sfx;
  paused: boolean;
  onPause: () => void;
  muted: boolean;
  onMute: () => void;
  onStart: () => void;
  onOver: (m: Match) => void;
  children?: React.ReactNode;
}) {
  const [first] = useState(() => soloMatch(setup));
  const head = useRef(first);
  const scene = useRef<Scene | null>(null);
  const started = useRef(false);
  const overRef = useRef(onOver);
  useEffect(() => {
    overRef.current = onOver;
  });

  const advance = useCallback((m: Match) => {
    head.current = m;
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
