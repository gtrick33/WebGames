/**
 * Reusable mini-games. Each one takes the players taking part and reports a winner (or null for a
 * draw / group result), so any mode can launch them without knowing how they work.
 */
import { useEffect, useRef, useState } from 'react';
import { randomOf } from '../engine';
import type { Player } from '../types';
import { RpsHand } from './RpsHand';
import { Avatar, PassPhone } from './shared';

export interface MiniProps {
  players: Player[];
  /** Winner (null for none), plus the loser when a game picks one (Hot Potato). */
  onDone: (winnerId: string | null, loserId?: string) => void;
}

export type MiniId = 'reaction' | 'rps' | 'potato';

export const MINIS: { id: MiniId; title: string; emoji: string; blurb: string; players: 1 | 2 | 'all' }[] = [
  { id: 'reaction', title: 'Reaction Duel', emoji: '⚡', blurb: 'Two thumbs, one phone. Tap the moment it turns green.', players: 2 },
  { id: 'rps', title: 'Rock Paper Scissors', emoji: '✊', blurb: 'Secret picks, dramatic reveal. Best of three.', players: 2 },
  { id: 'potato', title: 'Hot Potato', emoji: '🥔', blurb: 'Name one, pass the phone. Don’t hold it when it pops.', players: 'all' },
];

export function MiniGame({ id, players, onDone }: MiniProps & { id: MiniId }) {
  switch (id) {
    case 'reaction':
      return <ReactionDuel players={players} onDone={onDone} />;
    case 'rps':
      return <Rps players={players} onDone={onDone} />;
    case 'potato':
    default:
      return <HotPotato players={players} onDone={onDone} />;
  }
}

/* ------------------------------------------------------------ reaction duel */

function ReactionDuel({ players, onDone }: MiniProps) {
  const [a, b] = players as [Player, Player];
  const [phase, setPhase] = useState<'ready' | 'wait' | 'go' | 'over'>('ready');
  const [result, setResult] = useState<{ winner: Player; why: string } | null>(null);
  const goAt = useRef(0);
  useEffect(() => {
    if (phase !== 'wait') return;
    const t = window.setTimeout(
      () => {
        goAt.current = performance.now();
        setPhase('go');
      },
      1500 + Math.random() * 3000,
    );
    return () => window.clearTimeout(t);
  }, [phase]);
  const tap = (who: Player, other: Player): void => {
    if (phase === 'wait') {
      setResult({ winner: other, why: `${who.name} jumped the gun!` });
      setPhase('over');
    } else if (phase === 'go') {
      setResult({ winner: who, why: `${Math.round(performance.now() - goAt.current)} ms` });
      setPhase('over');
    }
  };
  if (phase === 'over' && result)
    return (
      <div className="pt-mini-result">
        <Avatar player={result.winner} size={72} />
        <h3>{result.winner.name} wins!</h3>
        <p className="pt-muted">{result.why}</p>
        <button className="pt-btn pt-btn-go" onClick={() => onDone(result.winner.id)}>
          Continue
        </button>
      </div>
    );
  return (
    <div className={`pt-duel is-${phase}`}>
      <button className="pt-duel-half is-top" style={{ ['--pc' as string]: b.color }} onPointerDown={() => tap(b, a)} aria-label={`${b.name}: tap`}>
        <span>{b.emoji} {b.name}</span>
      </button>
      <div className="pt-duel-mid">
        {phase === 'ready' ? (
          <button className="pt-btn pt-btn-go" onClick={() => setPhase('wait')}>
            Ready? Hold the phone between you
          </button>
        ) : (
          <b>{phase === 'go' ? 'TAP!' : 'Wait for green…'}</b>
        )}
      </div>
      <button className="pt-duel-half" style={{ ['--pc' as string]: a.color }} onPointerDown={() => tap(a, b)} aria-label={`${a.name}: tap`}>
        <span>{a.emoji} {a.name}</span>
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------- RPS */

const HANDS = [
  { id: 'rock', beats: 'scissors' },
  { id: 'paper', beats: 'rock' },
  { id: 'scissors', beats: 'paper' },
] as const;

function Rps({ players, onDone }: MiniProps) {
  const [a, b] = players as [Player, Player];
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [picks, setPicks] = useState<[string | null, string | null]>([null, null]);
  const [stage, setStage] = useState<'passA' | 'pickA' | 'passB' | 'pickB' | 'reveal'>('passA');
  const pick = (i: 0 | 1, h: string): void => {
    const next: [string | null, string | null] = [...picks];
    next[i] = h;
    setPicks(next);
    setStage(i === 0 ? 'passB' : 'reveal');
  };
  if (stage === 'passA') return <PassPhone player={a} note="Pick in secret." onReady={() => setStage('pickA')} />;
  if (stage === 'passB') return <PassPhone player={b} note="Pick in secret." onReady={() => setStage('pickB')} />;
  if (stage === 'pickA' || stage === 'pickB') {
    const i = stage === 'pickA' ? 0 : 1;
    return (
      <div className="pt-rps">
        <h3>{(i === 0 ? a : b).name}, pick one</h3>
        <div className="pt-rps-hands">
          {HANDS.map((h) => (
            <button key={h.id} className="pt-rps-hand" onClick={() => pick(i, h.id)}>
              <RpsHand hand={h.id} size={76} />
            </button>
          ))}
        </div>
      </div>
    );
  }
  const [pa, pb] = picks;
  const ha = HANDS.find((h) => h.id === pa)!;
  const hb = HANDS.find((h) => h.id === pb)!;
  const roundWinner = pa === pb ? null : ha.beats === pb ? 0 : 1;
  const nextWins: [number, number] = [wins[0] + (roundWinner === 0 ? 1 : 0), wins[1] + (roundWinner === 1 ? 1 : 0)];
  const champion = nextWins[0] >= 2 ? a : nextWins[1] >= 2 ? b : null;
  return (
    <div className="pt-rps">
      <div className="pt-rps-reveal">
        <span>
          <RpsHand hand={ha.id} size={84} />
          <small>{a.name}</small>
        </span>
        <b>vs</b>
        <span>
          <RpsHand hand={hb.id} size={84} />
          <small>{b.name}</small>
        </span>
      </div>
      <h3>{roundWinner === null ? 'Draw!' : `${(roundWinner === 0 ? a : b).name} takes the round`}</h3>
      <p className="pt-muted">
        {a.name} {nextWins[0]} – {nextWins[1]} {b.name}
      </p>
      {champion ? (
        <button className="pt-btn pt-btn-go" onClick={() => onDone(champion.id)}>
          {champion.name} wins! Continue
        </button>
      ) : (
        <button
          className="pt-btn pt-btn-go"
          onClick={() => {
            setWins(nextWins);
            setPicks([null, null]);
            setStage('passA');
          }}
        >
          Next round
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- hot potato */

const POTATO_TOPICS = ['fruits', 'countries', 'animals', 'pizza toppings', 'superheroes', 'colors', 'football clubs', 'things in a kitchen', 'board games', 'car brands', 'cartoon characters', 'cities', 'sports', 'breakfast foods', 'musical instruments'];

function HotPotato({ players, onDone }: MiniProps) {
  const [topic] = useState(() => randomOf(POTATO_TOPICS));
  const [phase, setPhase] = useState<'ready' | 'live' | 'boom'>('ready');
  const [passes, setPasses] = useState(0);
  useEffect(() => {
    if (phase !== 'live') return;
    const t = window.setTimeout(() => {
      setPhase('boom');
      navigator.vibrate?.([200, 80, 200]);
    }, 8000 + Math.random() * 14000);
    return () => window.clearTimeout(t);
  }, [phase]);
  if (phase === 'boom')
    return (
      <div className="pt-mini-result">
        <p className="pt-boom">💥</p>
        <h3>POP! Who was holding it?</h3>
        <div className="pt-picker">
          {players.map((p) => (
            <button key={p.id} className="pt-chip" style={{ ['--pc' as string]: p.color }} onClick={() => onDone(null, p.id)}>
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
        <p className="pt-muted">They lose this one ({passes} passes).</p>
      </div>
    );
  return (
    <div className="pt-potato">
      <p className="pt-kicker">Topic</p>
      <h3 className="pt-potato-topic">{topic}</h3>
      {phase === 'ready' ? (
        <>
          <p className="pt-muted">Say one, then pass the phone on. No repeats, no pauses. It pops at a random moment.</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setPhase('live')}>
            Start the potato
          </button>
        </>
      ) : (
        <button className="pt-potato-btn" onClick={() => setPasses((n) => n + 1)}>
          🥔
          <small>Tap, say one, pass!</small>
        </button>
      )}
    </div>
  );
}
