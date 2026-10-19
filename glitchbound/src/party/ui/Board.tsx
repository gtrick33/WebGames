import { useEffect, useMemo, useState } from 'react';
import { boardAwards, currentPlayer, makeBoard, reduceBoard, rollDie, standings, startBoard, TILE_INFO, type BoardAction, type BoardSize, type BoardState } from '../board';
import { CHALLENGES } from '../content/challenges';
import { TRIVIA } from '../content/trivia';
import { draw, filterContent, freshRng, intensityWeights, shuffle } from '../engine';
import type { PartySession } from '../session';
import type { Challenge, Player } from '../types';
import { MiniGame, MINIS, type MiniId } from './minis';
import { Avatar, byId, ModeBar, Name, PlayerPicker, Results } from './shared';

export const COLS = 6;
/** Pip positions (3x3 grid cells) for faces 1-6. */
const PIPS: number[][] = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

export function DieFace({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 30 30" width="100%" height="100%" aria-hidden="true">
      {PIPS[value - 1]!.map((c) => (
        <circle key={c} cx={6 + (c % 3) * 9} cy={6 + Math.floor(c / 3) * 9} r={3.1} fill="#1d1238" />
      ))}
    </svg>
  );
}

/** Grid cell of tile i on a snaking board (left-to-right, then right-to-left). */
export function cell(i: number): { row: number; col: number } {
  const row = Math.floor(i / COLS);
  const k = i % COLS;
  return { row, col: row % 2 === 0 ? k : COLS - 1 - k };
}

export function BoardMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const [r] = useState(freshRng);
  const state = session.active?.mode === 'board' ? session.active.state : null;
  const [size, setSize] = useState<BoardSize>('medium');
  const [rolling, setRolling] = useState<number | null>(null);
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...(state?.pos ?? {}) }));

  const set = (s: BoardState): void => update((cur) => ({ ...cur, active: { mode: 'board', state: s } }));
  const act = (a: BoardAction): void => {
    if (state) set(reduceBoard(state, a));
  };

  // Tokens walk one tile at a time towards where the rules put them.
  useEffect(() => {
    if (!state) return;
    const behind = state.order.filter((id) => (shown[id] ?? 0) !== state.pos[id]);
    if (!behind.length) return;
    const t = window.setTimeout(() => {
      setShown((sh) => {
        const next = { ...sh };
        for (const id of behind) {
          const from = next[id] ?? 0;
          const to = state.pos[id]!;
          next[id] = Math.abs(to - from) > 10 ? to : from + Math.sign(to - from);
        }
        return next;
      });
    }, 190);
    return () => window.clearTimeout(t);
  }, [state, shown]);

  if (!state) {
    return (
      <div className="pt-screen">
        <ModeBar title="Dice Adventure" onExit={onExit} />
        <div className="pt-panel">
          <h3>Board size</h3>
          <div className="pt-seg" role="radiogroup">
            {(
              [
                ['short', 'Short', '~10 min'],
                ['medium', 'Medium', '~20 min'],
                ['long', 'Long', '~35 min'],
              ] as const
            ).map(([id, label, time]) => (
              <button key={id} role="radio" aria-checked={size === id} onClick={() => setSize(id)}>
                {label}
                <small>{time}</small>
              </button>
            ))}
          </div>
          <p className="pt-muted">Turn order follows your player list ({session.players.map((p) => p.name).join(' → ')}). Land on tiles for challenges, trivia, mini-games, shortcuts and nasty slides. First to the 🏆 wins.</p>
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            onClick={() => {
              const s = startBoard(makeBoard(size, Date.now() >>> 0), session.players.map((p) => p.id), Date.now() >>> 0);
              setShown({ ...s.pos });
              set(s);
            }}
          >
            Roll out the board
          </button>
        </div>
      </div>
    );
  }

  const players = state.order.map((id) => byId(session.players, id)).filter((p): p is Player => !!p);
  if (state.phase === 'done' && (shown[state.winner!] ?? 0) === state.pos[state.winner!]) {
    // The number next to each player is the tile they reached (the winner is on the 🏆).
    const scores = Object.fromEntries(standings(state).map((id) => [id, state.pos[id] ?? 0]));
    return (
      <Results
        title={`${byId(session.players, state.winner)?.name ?? 'Someone'} wins the adventure!`}
        players={players}
        scores={scores}
        awards={boardAwards(state)}
        onAgain={() => update((s) => ({ ...s, active: null }))}
        onMenu={onExit}
      />
    );
  }

  const me = byId(session.players, currentPlayer(state))!;
  const moving = state.order.some((id) => (shown[id] ?? 0) !== state.pos[id]);
  const roll = (): void => {
    if (rolling !== null || state.phase !== 'roll' || moving) return;
    let n = 0;
    const spin = window.setInterval(() => {
      setRolling(1 + Math.floor(Math.random() * 6));
      if (++n >= 8) {
        window.clearInterval(spin);
        const value = rollDie(r);
        setRolling(value);
        window.setTimeout(() => {
          setRolling(null);
          act({ type: 'roll', value });
        }, 350);
      }
    }, 70);
  };
  const rows = Math.ceil(state.tiles.length / COLS);

  return (
    <div className="pt-screen pt-board-screen">
      <ModeBar title="Dice Adventure" progress={`Turn ${state.turn + 1}`} onExit={onExit} />
      <div className="pt-standings" aria-label="Positions">
        {[...players]
          .sort((a, b) => state.pos[b.id]! - state.pos[a.id]!)
          .map((p) => (
            <span key={p.id} className={`pt-stand${p.id === me.id ? ' is-now' : ''}`} style={{ ['--pc' as string]: p.color }}>
              {p.emoji} {p.name} <b>{state.pos[p.id]}</b>
            </span>
          ))}
      </div>
      <div className="pt-board" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }} role="img" aria-label={`Board with ${state.tiles.length} tiles`}>
        {state.tiles.map((t, i) => {
          const { row, col } = cell(i);
          const here = players.filter((p) => (shown[p.id] ?? 0) === i);
          const info = TILE_INFO[t.kind];
          return (
            <div key={i} className={`pt-tile pt-tile-${t.kind}${state.landed === i && state.phase === 'event' ? ' is-landed' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1, background: info.color }} title={`${i}: ${info.label}`}>
              <span className="pt-tile-icon" aria-hidden="true">
                {info.icon}
              </span>
              <span className="pt-tile-n">{t.kind === 'shortcut' || t.kind === 'slide' ? `→${t.value}` : i}</span>
              {here.length > 0 && (
                <span className="pt-tokens">
                  {/* A crowded tile (everyone on Start in a big group) shows three tokens and a count. */}
                  {(here.length > 4 ? here.slice(0, 3) : here).map((p) => (
                    <span key={p.id} className="pt-token" style={{ background: p.color }} title={p.name}>
                      {p.emoji}
                    </span>
                  ))}
                  {here.length > 4 && (
                    <span className="pt-token pt-token-more" title={here.slice(3).map((p) => p.name).join(', ')}>
                      +{here.length - 3}
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {state.phase === 'roll' || moving ? (
        <div className="pt-turn">
          <Avatar player={me} size={44} />
          <div>
            <p className="pt-kicker">Your turn</p>
            <b className="pt-turn-name">{me.name}</b>
          </div>
          <button className={`pt-die${rolling !== null ? ' is-rolling' : ''}`} onClick={roll} disabled={state.phase !== 'roll' || moving} aria-label="Roll the dice">
            <DieFace value={rolling ?? (state.lastRoll || 6)} />
          </button>
        </div>
      ) : (
        <TileEvent key={`${state.turn}-${state.landed}`} state={state} session={session} me={me} players={players} r={r} onResolve={act} />
      )}
    </div>
  );
}

function TileEvent({ state, session, me, players, r, onResolve }: { state: BoardState; session: PartySession; me: Player; players: Player[]; r: () => number; onResolve: (a: BoardAction) => void }) {
  const tile = state.tiles[state.landed]!;
  const others = players.filter((p) => p.id !== me.id);
  // Picked once per tile: `others` is a new list every render, so a memo re-rolled the opponent mid-duel.
  const [opponent] = useState(() => others[Math.floor(r() * others.length)] ?? me);
  const info = TILE_INFO[tile.kind];
  const [mini, setMini] = useState<MiniId | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const card = useMemo((): Challenge | null => {
    const kinds = tile.kind === 'card' ? ['truth', 'dare', 'challenge'] : tile.kind === 'group' ? ['group', 'vote'] : tile.kind === 'duel' ? ['duel'] : [];
    if (!kinds.length) return null;
    const pool = filterContent(CHALLENGES, session.settings).filter((c) => kinds.includes(c.kind) && c.target !== 'teams');
    const w = intensityWeights(session.settings);
    return draw(pool, [], r, (c) => w[c.intensity]).item;
  }, [tile.kind, session.settings, r]);
  const text = card?.text.replace(/\{A\}/g, me.name).replace(/\{B\}/g, opponent.name).replace(/\{TEAM1\}|\{TEAM2\}/g, 'everyone');
  const trivia = useMemo(() => (tile.kind === 'trivia' ? TRIVIA[Math.floor(r() * TRIVIA.length)]! : null), [tile.kind, r]);
  const options = useMemo(() => (trivia ? shuffle(trivia.options, r) : []), [trivia, r]);

  if (mini) {
    const parts = MINIS.find((m) => m.id === mini)!.players;
    const who = parts === 2 ? [me, opponent] : parts === 1 ? [me] : players;
    return (
      <div className="pt-event">
        <MiniGame id={mini} players={who} onDone={(winner, loser) => onResolve({ type: 'resolve', ok: winner === me.id || (!!loser && loser !== me.id) })} />
      </div>
    );
  }

  return (
    <div className="pt-event" style={{ ['--tc' as string]: info.color }}>
      <p className="pt-event-head">
        <span aria-hidden="true">{info.icon}</span> {info.label}
      </p>
      {(tile.kind === 'lucky' || tile.kind === 'shortcut') && (
        <>
          <p className="pt-event-text">
            <Name player={me} /> {tile.kind === 'lucky' ? `zooms ${tile.value} tiles ahead!` : `takes the shortcut to tile ${tile.value}!`}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => onResolve({ type: 'resolve', ok: true })}>
            Woo! 🚀
          </button>
        </>
      )}
      {(tile.kind === 'setback' || tile.kind === 'slide') && (
        <>
          <p className="pt-event-text">
            <Name player={me} /> {tile.kind === 'setback' ? `slips back ${tile.value} tiles.` : `slides down to tile ${tile.value}.`}
          </p>
          <button className="pt-btn pt-btn-big" onClick={() => onResolve({ type: 'resolve', ok: true })}>
            Noooo 😩
          </button>
        </>
      )}
      {tile.kind === 'again' && (
        <>
          <p className="pt-event-text">
            <Name player={me} /> rolls again!
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => onResolve({ type: 'resolve', ok: true })}>
            Roll again 🎲
          </button>
        </>
      )}
      {tile.kind === 'swap' && (
        <>
          <p className="pt-event-text">
            <Name player={me} />, swap places with anyone (or nobody).
          </p>
          <PlayerPicker players={others} selected={[]} label="Swap with" onToggle={(id) => onResolve({ type: 'resolve', ok: true, swapWith: id })} />
          <button className="pt-btn pt-btn-ghost" onClick={() => onResolve({ type: 'resolve', ok: true })}>
            Stay put
          </button>
        </>
      )}
      {(tile.kind === 'card' || tile.kind === 'group') && card && (
        <>
          <p className="pt-event-text">{text}</p>
          <p className="pt-muted">Done: one step forward. Skip: one step back.</p>
          <div className="pt-row">
            <button className="pt-btn pt-btn-go" onClick={() => onResolve({ type: 'resolve', ok: true })}>
              Done ✓
            </button>
            <button className="pt-btn" onClick={() => onResolve({ type: 'resolve', ok: false })}>
              Skip
            </button>
          </div>
        </>
      )}
      {tile.kind === 'duel' && card && (
        <>
          <p className="pt-event-text">{text}</p>
          <p className="pt-muted">The winner jumps 2 tiles ahead.</p>
          <PlayerPicker players={[me, opponent]} selected={[]} label="Winner" onToggle={(id) => onResolve({ type: 'resolve', ok: id === me.id, winnerId: id })} />
        </>
      )}
      {tile.kind === 'trivia' && trivia && (
        <>
          <p className="pt-event-text">{trivia.q}</p>
          <div className="pt-trivia-opts">
            {options.map((o) => (
              <button key={o} className={`pt-trivia-opt${answer ? (o === trivia.options[0] ? ' is-right' : o === answer ? ' is-wrong' : '') : ''}`} disabled={!!answer} onClick={() => setAnswer(o)}>
                {o}
              </button>
            ))}
          </div>
          {answer && (
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => onResolve({ type: 'resolve', ok: answer === trivia.options[0] })}>
              {answer === trivia.options[0] ? 'Correct! +1 step' : 'Wrong: back 1 step'}
            </button>
          )}
        </>
      )}
      {tile.kind === 'mini' && (
        <>
          <p className="pt-event-text">Mini-game time! Win it to step forward.</p>
          <div className="pt-picker">
            {MINIS.filter((m) => m.players !== 2 || others.length > 0).map((m) => (
              <button key={m.id} className="pt-chip" onClick={() => setMini(m.id)}>
                {m.emoji} {m.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
