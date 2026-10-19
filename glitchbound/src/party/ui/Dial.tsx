import { useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { SPECTRUMS } from '../content/spectrums';
import { dialPoints, dialVerdict, randomTarget, splitTeams, stealRight, ZONES } from '../dial';
import { draw, freshRng, teamTurns } from '../engine';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { Avatar, ModeBar, Name, PassPhone, Results, useSavedGame } from './shared';

type Stage = 'setup' | 'pass' | 'peek' | 'guess' | 'steal' | 'reveal' | 'done';

interface Round {
  scale: [string, string];
  target: number;
  guess: number;
  call: 'left' | 'right' | null;
}

interface Game {
  stage: Stage;
  teams: boolean;
  laps: number;
  used: string[];
  /** The round number (0-based); the reader is `readers[n]`. */
  n: number;
  round: Round | null;
  scores: Record<string, number>;
  team: [number, number];
}

/**
 * Dial It In on one phone: the reader peeks at the secret spot on a radio-style tuner, hides it and
 * gives one clue out loud; the rest slide the needle. Co-op scores one total; with teams (4+ players)
 * the other side can steal a point by calling left or right.
 */
export function DialMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const players = session.players;
  const [r] = useState(freshRng);
  const [game, set] = useSavedGame<Game>(session, update, 'dial', () => ({
    stage: 'setup',
    teams: players.length >= 4,
    laps: players.length <= 3 ? 3 : players.length <= 6 ? 2 : 1,
    used: [],
    n: 0,
    round: null,
    scores: {},
    team: [0, 0],
  }));
  const { stage, teams, laps, n, scores, team } = game;
  // The needle moves with every drag event: it is saved when the guess is locked in.
  const [needle, setNeedle] = useState<number | null>(null);
  const round = game.round && { ...game.round, guess: needle ?? game.round.guess };
  const setStage = (st: Stage): void => set({ stage: st });
  const sides = splitTeams(players);
  // Who reads each round. With teams they alternate, and both teams read equally often.
  const readersFor = (k: number): Player[] => (teams ? teamTurns(sides, k) : Array.from({ length: k }, () => players).flat());
  const readers = readersFor(laps);
  const total = readers.length;
  const reader = readers[Math.min(n, total - 1)]!;
  const teamOf = (p: Player): 0 | 1 => (sides[0].includes(p) ? 0 : 1);

  const deal = (seen: string[]): Pick<Game, 'used' | 'round' | 'stage'> => {
    const pool = SPECTRUMS.map(([a, b], i) => ({ id: `s${i}`, a, b }));
    const d = draw(pool, seen, r);
    const card = d.item ?? pool[0]!;
    setNeedle(null);
    return { used: d.used, round: { scale: [card.a, card.b], target: randomTarget(r), guess: 50, call: null }, stage: 'pass' };
  };
  const start = (): void => set({ n: 0, scores: {}, team: [0, 0], ...deal(game.used) });
  const lock = (): void => {
    if (round) set({ round, stage: teams ? 'steal' : 'reveal' });
  };
  const reveal = (call: 'left' | 'right' | null): void => {
    if (!round) return;
    const pts = dialPoints(round.target, round.guess);
    const t = teamOf(reader);
    const steal = call && stealRight(round.target, round.guess, call) ? 1 : 0;
    set((g) => ({
      round: { ...round, call },
      scores: { ...g.scores, [reader.id]: (g.scores[reader.id] ?? 0) + pts },
      team: teams ? (t === 0 ? [g.team[0] + pts, g.team[1] + steal] : [g.team[0] + steal, g.team[1] + pts]) : g.team,
      stage: 'reveal',
    }));
  };
  const next = (): void => set(n + 1 >= total ? { stage: 'done' } : { n: n + 1, ...deal(game.used) });

  if (stage === 'setup') {
    return (
      <div className="pt-screen">
        <ModeBar title="Dial It In" onExit={onExit} />
        <div className="pt-panel">
          <h3>How it works</h3>
          <p className="pt-muted">
            Each round one player is the <b>reader</b>. Only they see where the secret spot is on a scale, like <i>Cold ↔ Hot</i>. They give <b>one clue</b> out loud (“a cup of tea”), and everyone else slides the needle to where they think the
            spot is. Spot on scores 4, close scores 3 or 2.
          </p>
          {players.length >= 4 && (
            <label className="pt-switch">
              <input type="checkbox" checked={teams} onChange={(e) => set({ teams: e.target.checked })} />
              <span>
                <b>Two teams</b> · readers take turns across teams, and the other team can steal a point by calling “left” or “right”
              </span>
            </label>
          )}
          <div className="pt-picker" role="group" aria-label="Rounds">
            {[1, 2, 3].map((k) => (
              <button key={k} className={`pt-chip${laps === k ? ' is-on' : ''}`} aria-pressed={laps === k} onClick={() => set({ laps: k })}>
                {k === 1 ? 'Everyone reads once' : `Everyone reads ${k}×`} ({readersFor(k).length} rounds)
              </button>
            ))}
          </div>
          {teams && players.length >= 4 && (
            <div className="pt-dl-teams">
              {sides.map((side, t) => (
                <p key={t}>
                  <b>{t === 0 ? '🔵 Team Blue' : '🟠 Team Orange'}:</b> {side.map((p) => p.name).join(', ')}
                </p>
              ))}
            </div>
          )}
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done' || !round) {
    const teamScores: Record<string, number> = teams ? Object.fromEntries(players.map((p) => [p.id, team[teamOf(p)]])) : scores;
    const best = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))[0];
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    return (
      <Results
        title={teams ? (team[0] === team[1] ? 'A perfect tie!' : `Team ${team[0] > team[1] ? 'Blue' : 'Orange'} wins!`) : `The table scored ${sum} of ${total * 4}`}
        players={players}
        scores={teamScores}
        awards={best && (scores[best.id] ?? 0) > 0 ? [{ title: 'Mind Reader', playerId: best.id, why: `their clues earned ${scores[best.id]} points` }] : []}
        onAgain={() => setStage('setup')}
        onMenu={onExit}
      />
    );
  }

  const progress = `${n + 1}/${total}`;
  const others = teams ? sides[teamOf(reader)].filter((p) => p !== reader) : players.filter((p) => p !== reader);
  const rivals = teams ? sides[1 - teamOf(reader)]! : [];

  if (stage === 'pass') {
    return (
      <div className="pt-screen">
        <ModeBar title="Dial It In" progress={progress} onExit={onExit} />
        <PassPhone player={reader} note="You’re the reader. Only you look at the next screen." onReady={() => setStage('peek')} />
      </div>
    );
  }

  const pts = dialPoints(round.target, round.guess);
  return (
    <div className="pt-screen">
      <ModeBar title="Dial It In" progress={progress} onExit={onExit} />
      {teams && (
        <p className="pt-dl-score">
          🔵 {team[0]} · 🟠 {team[1]}
        </p>
      )}
      <div className="pt-dl-reader">
        <Avatar player={reader} size={30} /> <Name player={reader} /> {stage === 'peek' ? 'is the reader' : 'is reading'}
      </div>
      <Tuner scale={round.scale} target={round.target} guess={round.guess} showTarget={stage === 'peek' || stage === 'reveal'} showNeedle={stage !== 'peek'} movable={stage === 'guess'} onMove={setNeedle} />
      {stage === 'peek' && (
        <div className="pt-actions">
          <p className="pt-muted">
            Think of <b>one clue</b> for this spot between <b>{round.scale[0]}</b> and <b>{round.scale[1]}</b>. Got it? Hide the spot, then say your clue out loud.
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('guess')}>
            Hide it · I’ve got my clue
          </button>
        </div>
      )}
      {stage === 'guess' && (
        <div className="pt-actions">
          <p className="pt-muted">
            {reader.name}, say your clue! {others.length ? `${others.map((p) => p.name).join(', ')}: ` : ''}drag the needle to where you think the spot is.
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={lock}>
            Lock in the needle
          </button>
        </div>
      )}
      {stage === 'steal' && (
        <div className="pt-actions">
          <p className="pt-muted">
            {rivals.map((p) => p.name).join(', ')}: is the secret spot to the <b>left</b> or the <b>right</b> of the needle? Right call: 1 point.
          </p>
          <div className="pt-row">
            <button className="pt-btn pt-btn-big" onClick={() => reveal('left')}>
              ◀ Left
            </button>
            <button className="pt-btn pt-btn-big" onClick={() => reveal('right')}>
              Right ▶
            </button>
          </div>
        </div>
      )}
      {stage === 'reveal' && (
        <div className="pt-actions">
          <p className="pt-dl-verdict">
            {dialVerdict(pts)} <b>+{pts}</b>
            {teams && round.call && (stealRight(round.target, round.guess, round.call) ? ' · steal! +1' : ' · no steal')}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next} autoFocus>
            {n + 1 >= total ? 'See the results' : 'Next round'}
          </button>
        </div>
      )}
    </div>
  );
}

/** The scoring stripes side by side, 2-3-4-3-2, clipped to the band. */
function segments(target: number): { from: number; to: number; points: number }[] {
  const edges = [...ZONES].reverse(); // widest (2 points) first
  const out: { from: number; to: number; points: number }[] = [];
  edges.forEach((z, k) => {
    const inner = edges[k + 1]?.within ?? 0;
    out.push({ from: target - z.within, to: target - inner, points: z.points });
    if (inner) out.push({ from: target + inner, to: target + z.within, points: z.points });
  });
  // The middle stripe spans both sides of the target.
  const mid = out.find((g) => g.points === ZONES[0]!.points)!;
  mid.to = target + ZONES[0]!.within;
  return out.map((g) => ({ ...g, from: Math.max(0, g.from), to: Math.min(100, g.to) })).filter((g) => g.to > g.from);
}

/** The radio-style tuner: a band of ticks between two ends, scoring stripes and a needle (live rooms use it too). */
export function Tuner({ scale, target, guess, showTarget, showNeedle, movable, onMove }: { scale: [string, string]; target: number; guess: number; showTarget: boolean; showNeedle: boolean; movable: boolean; onMove: (v: number) => void }) {
  const band = useRef<HTMLDivElement>(null);
  const valueAt = (clientX: number): number => {
    const b = band.current?.getBoundingClientRect();
    if (!b) return guess;
    return Math.round(Math.max(0, Math.min(100, ((clientX - b.left) / b.width) * 100)));
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>): void => {
    if (!movable) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety: dragging still works over the band */
    }
    onMove(valueAt(e.clientX));
  };
  const onDrag = (e: RPointerEvent<HTMLDivElement>): void => {
    if (movable && e.buttons) onMove(valueAt(e.clientX));
  };
  const onKey = (e: RKeyboardEvent<HTMLDivElement>): void => {
    if (!movable) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') onMove(Math.max(0, guess - step));
    else if (e.key === 'ArrowRight') onMove(Math.min(100, guess + step));
    else return;
    e.preventDefault();
  };
  return (
    <div className="pt-dl">
      <div
        ref={band}
        className={`pt-dl-band${movable ? ' is-movable' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onDrag}
        onKeyDown={onKey}
        role={movable ? 'slider' : 'img'}
        tabIndex={movable ? 0 : -1}
        aria-label={movable ? `Needle between ${scale[0]} and ${scale[1]}` : `Scale from ${scale[0]} to ${scale[1]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={guess}
      >
        {Array.from({ length: 21 }, (_, i) => (
          <i key={i} className={`pt-dl-tick${i % 5 === 0 ? ' is-major' : ''}`} style={{ left: `${i * 5}%` }} />
        ))}
        {showTarget &&
          segments(target).map((g) => (
            <span key={g.from} className={`pt-dl-zone is-z${g.points}`} style={{ left: `${g.from}%`, width: `${g.to - g.from}%` }}>
              {g.to - g.from >= 4 && <b>{g.points}</b>}
            </span>
          ))}
        {showNeedle && <span className="pt-dl-needle" style={{ left: `${guess}%` }} />}
      </div>
      <div className="pt-dl-ends">
        <span>◀ {scale[0]}</span>
        <span>{scale[1]} ▶</span>
      </div>
    </div>
  );
}
