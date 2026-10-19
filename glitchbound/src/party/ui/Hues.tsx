import { useState } from 'react';
import { freshRng } from '../engine';
import { cellHex, COLS, cueBonus, explainHues, HUE_GRADES, huePoints, offerColours, ROWS } from '../hues';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { Avatar, ModeBar, Name, PassPhone, Results } from './shared';

type Stage = 'setup' | 'pass' | 'pick' | 'clue' | 'guess' | 'clue2' | 'reveal' | 'done';

interface Mark {
  player: Player;
  cell: number;
  /** 1 for the first clue, 2 for the second. */
  pass: 1 | 2;
}

/**
 * Hue Knew? on one phone: the cue giver secretly picks one of four colours and describes it in one
 * word (then two more, if the table wants a second clue). Everyone taps where they think it is on
 * the colour board. Points go by how alike the colours look, and the cue giver earns a point for
 * every close guess.
 */
export function HuesMode({ session, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const players = session.players;
  const [r] = useState(freshRng);
  const [stage, setStage] = useState<Stage>('setup');
  const [laps, setLaps] = useState(players.length <= 4 ? 2 : 1);
  const [second, setSecond] = useState(true);
  const [n, setN] = useState(0);
  const [offer, setOffer] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [who, setWho] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [gained, setGained] = useState<Record<string, number>>({});
  const total = players.length * laps;
  const cue = players[n % players.length]!;
  const guessers = players.filter((p) => p !== cue);

  const newRound = (): void => {
    setOffer(offerColours(r));
    setTarget(null);
    setMarks([]);
    setWho(0);
    setPending(null);
    setStage('pass');
  };
  const start = (): void => {
    setN(0);
    setScores({});
    newRound();
  };
  const place = (): void => {
    if (pending === null) return;
    const pass: 1 | 2 = stage === 'guess' && marks.length >= guessers.length ? 2 : 1;
    const next = [...marks, { player: guessers[who]!, cell: pending, pass }];
    setMarks(next);
    setPending(null);
    if (who + 1 < guessers.length) return setWho(who + 1);
    setWho(0);
    if (pass === 1 && second) return setStage('clue2');
    // Everyone has guessed: score the round.
    const g: Record<string, number> = {};
    let cuePts = 0;
    for (const m of next) {
      const p = huePoints(target!, m.cell);
      g[m.player.id] = (g[m.player.id] ?? 0) + p;
      if (p >= 2) cuePts++;
    }
    g[cue.id] = (g[cue.id] ?? 0) + cuePts;
    setGained(g);
    setScores((s) => Object.fromEntries(players.map((p) => [p.id, (s[p.id] ?? 0) + (g[p.id] ?? 0)])));
    setStage('reveal');
  };
  const next = (): void => {
    if (n + 1 >= total) return setStage('done');
    setN(n + 1);
    newRound();
  };

  if (stage === 'setup') {
    return (
      <div className="pt-screen">
        <ModeBar title="Hue Knew?" onExit={onExit} />
        <div className="pt-panel">
          <h3>How it works</h3>
          <p className="pt-muted">
            Each round one player is the <b>cue giver</b>. They secretly pick one of four colours and describe it in <b>one word</b> (no colour names like “red” or “blue”: try “ketchup”). Everyone else taps where they think it
            is on the board. The closer the colour looks, the more points; the cue giver scores for every close guess.
          </p>
          <label className="pt-switch">
            <input type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} />
            <span>
              <b>Second clue</b> · after the first guesses, the cue giver adds up to two more words and everyone guesses again
            </span>
          </label>
          <div className="pt-picker" role="group" aria-label="Rounds">
            {[1, 2, 3].map((k) => (
              <button key={k} className={`pt-chip${laps === k ? ' is-on' : ''}`} aria-pressed={laps === k} onClick={() => setLaps(k)}>
                {k === 1 ? 'Everyone cues once' : `Everyone cues ${k}×`} ({players.length * k} rounds)
              </button>
            ))}
          </div>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    return <Results title={`${sorted[0]!.name} has the best eye!`} players={players} scores={scores} onAgain={() => setStage('setup')} onMenu={onExit} />;
  }

  const progress = `${n + 1}/${total}`;
  const guesser = guessers[who]!;

  if (stage === 'pass') {
    return (
      <div className="pt-screen">
        <ModeBar title="Hue Knew?" progress={progress} onExit={onExit} />
        <PassPhone player={cue} note="You’re the cue giver. Only you look at the next screen." onReady={() => setStage('pick')} />
      </div>
    );
  }

  if (stage === 'pick') {
    return (
      <div className="pt-screen">
        <ModeBar title="Hue Knew?" progress={progress} onExit={onExit} />
        <div className="pt-panel">
          <p className="pt-kicker">
            <Name player={cue} />, pick your secret colour
          </p>
          <div className="pt-hk-offer">
            {offer.map((i) => (
              <button key={i} className={`pt-hk-swatch${target === i ? ' is-on' : ''}`} style={{ background: cellHex(i) }} onClick={() => setTarget(i)} aria-pressed={target === i} aria-label={`Colour ${offer.indexOf(i) + 1}`} />
            ))}
          </div>
          {target !== null && <Board target={target} marks={[]} highlight />}
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={target === null} onClick={() => setStage('clue')}>
            {target === null ? 'Tap a colour' : 'Hide it · I’ve got a one-word clue'}
          </button>
        </div>
      </div>
    );
  }

  const roundTwo = stage === 'clue2' || (stage === 'guess' && marks.length >= guessers.length);
  return (
    <div className="pt-screen">
      <ModeBar title="Hue Knew?" progress={progress} onExit={onExit} />
      {(stage === 'clue' || stage === 'clue2') && (
        <div className="pt-panel">
          <p className="pt-kicker">
            <Avatar player={cue} size={26} /> <Name player={cue} />, say your {stage === 'clue' ? 'one-word' : 'second (up to two words)'} clue out loud!
          </p>
          <p className="pt-muted">No colour names, please. Then pass the phone round: everyone taps their guess.</p>
          {stage === 'clue2' && <Board target={null} marks={marks.map(toMark)} />}
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('guess')}>
            Start guessing · {guessers[0]!.name} first
          </button>
        </div>
      )}
      {stage === 'guess' && (
        <div className="pt-panel">
          <p className="pt-kicker">
            <Avatar player={guesser} size={26} /> <Name player={guesser} />
            {roundTwo ? ', your second guess' : ', tap your guess'}
          </p>
          <Board target={null} marks={marks.map(toMark)} pending={pending} pendingGlyph={guesser.emoji} onPick={setPending} />
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={pending === null} onClick={place}>
            {pending === null ? 'Tap a colour on the board' : who + 1 < guessers.length ? `Lock it in · pass to ${guessers[who + 1]!.name}` : 'Lock it in'}
          </button>
        </div>
      )}
      {stage === 'reveal' && target !== null && (
        <div className="pt-panel">
          <p className="pt-kicker">The colour was…</p>
          <Board target={target} marks={marks.map(toMark)} highlight />
          <HueLegend />
          <ul className="pt-hk-gains">
            {players.map((p) => (
              <li key={p.id}>
                <span className="pt-hk-who">
                  <Avatar player={p} size={24} /> {p.name} <b>+{gained[p.id] ?? 0}</b>
                  {p === cue ? ' (cue giver)' : ''}
                </span>
                <small>
                  {explainHues(
                    target,
                    marks.filter((m) => m.player === p).map((m) => m.cell),
                    p === cue ? cueBonus(target, marks.map((m) => m.cell)) : null,
                  )}
                </small>
              </li>
            ))}
          </ul>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next} autoFocus>
            {n + 1 >= total ? 'See the results' : 'Next round'}
          </button>
        </div>
      )}
    </div>
  );
}

/** The scoring key, shown with every reveal. */
export function HueLegend() {
  return (
    <p className="pt-hk-legend">
      {HUE_GRADES.filter((g) => g.points > 0).map((g) => `${g.label[0]!.toUpperCase()}${g.label.slice(1)} +${g.points}`).join(' · ')} · Cue giver: +1 for each guess worth 2 or 3
    </p>
  );
}

const toMark = (m: Mark): BoardMark => ({ cell: m.cell, glyph: m.player.emoji });

/** A guess on the board: an emoji, or a player's initial on their colour (live rooms). */
export interface BoardMark {
  cell: number;
  glyph: string;
  color?: string;
}

function MarkGlyph({ m, fresh = false }: { m: BoardMark; fresh?: boolean }) {
  return (
    <span className={`pt-hk-mark${m.color ? ' is-dot' : ''}${fresh ? ' is-new' : ''}`} style={m.color ? { background: m.color } : undefined}>
      {m.glyph}
    </span>
  );
}

/** The colour board: hues across, pale to deep down, with the players' marks on it (live rooms use it too). */
export function Board({ target, marks, highlight = false, pending = null, pendingGlyph, pendingColor, onPick }: { target: number | null; marks: BoardMark[]; highlight?: boolean; pending?: number | null; pendingGlyph?: string; pendingColor?: string; onPick?: (i: number) => void }) {
  const at = new Map<number, BoardMark[]>();
  for (const m of marks) at.set(m.cell, [...(at.get(m.cell) ?? []), m]);
  return (
    <div className={`pt-hk-board${highlight ? ' is-reveal' : ''}`} style={{ ['--cols' as string]: COLS }} role="grid" aria-label="Colour board">
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const here = at.get(i);
        return (
          <button key={i} className={`pt-hk-cell${i === target ? ' is-target' : ''}${i === pending ? ' is-pending' : ''}`} style={{ background: cellHex(i) }} onClick={() => onPick?.(i)} disabled={!onPick} aria-label={`Colour ${i + 1}`}>
            {here && <MarkGlyph m={here[here.length - 1]!} />}
            {i === pending && pendingGlyph && <MarkGlyph m={{ cell: i, glyph: pendingGlyph, color: pendingColor }} fresh />}
          </button>
        );
      })}
    </div>
  );
}
