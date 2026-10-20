import { useEffect, useMemo, useState } from 'react';
import { boardAwards, currentPlayer, makeBoard, reduceBoard, rollDie, standings, startBoard, TILE_INFO, type BoardAction, type BoardSize, type BoardState } from '../board';
import { CHALLENGES } from '../content/challenges';
import { TRIVIA } from '../content/trivia';
import { draw, filterContent, freshRng, intensityWeights, shuffle } from '../engine';
import type { PartySession } from '../session';
import type { Challenge, Player } from '../types';
import { MiniGame, MINIS, type MiniId } from './minis';
import { Avatar, byId, ModeBar, Name, PlayerPicker, Results, tNodes } from './shared';
import { t } from '../../i18n';

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
        <ModeBar title={t('Dice Adventure')} onExit={onExit} />
        <div className="pt-panel">
          <h3>{t('Board size')}</h3>
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
          <p className="pt-muted">{t('Turn order follows your player list ({order}). Land on tiles for challenges, trivia, mini-games, shortcuts and nasty slides. First to the 🏆 wins.', { order: session.players.map((p) => p.name).join(' → ') })}</p>
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            onClick={() => {
              const s = startBoard(makeBoard(size, Date.now() >>> 0), session.players.map((p) => p.id), Date.now() >>> 0);
              setShown({ ...s.pos });
              set(s);
            }}
          >
            {t('Roll out the board')}
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
        title={t('{name} wins the adventure!', { name: byId(session.players, state.winner)?.name ?? t('Someone') })}
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
      <ModeBar title={t('Dice Adventure')} progress={t('Turn {n}', { n: state.turn + 1 })} onExit={onExit} />
      <div className="pt-standings" aria-label={t('Positions')}>
        {[...players]
          .sort((a, b) => state.pos[b.id]! - state.pos[a.id]!)
          .map((p) => (
            <span key={p.id} className={`pt-stand${p.id === me.id ? ' is-now' : ''}`} style={{ ['--pc' as string]: p.color }}>
              {p.emoji} {p.name} <b>{state.pos[p.id]}</b>
            </span>
          ))}
      </div>
      <div className="pt-board" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }} role="img" aria-label={t('Board with {n} tiles', { n: state.tiles.length })}>
        {state.tiles.map((tile, i) => {
          const { row, col } = cell(i);
          const here = players.filter((p) => (shown[p.id] ?? 0) === i);
          const info = TILE_INFO[tile.kind];
          return (
            <div key={i} className={`pt-tile pt-tile-${tile.kind}${state.landed === i && state.phase === 'event' ? ' is-landed' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1, background: info.color }} title={`${i}: ${t(info.label)}`}>
              <span className="pt-tile-icon" aria-hidden="true">
                {info.icon}
              </span>
              <span className="pt-tile-n">{tile.kind === 'shortcut' || tile.kind === 'slide' ? `→${tile.value}` : i}</span>
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
            <p className="pt-kicker">{t('Your turn')}</p>
            <b className="pt-turn-name">{me.name}</b>
          </div>
          <button className={`pt-die${rolling !== null ? ' is-rolling' : ''}`} onClick={roll} disabled={state.phase !== 'roll' || moving} aria-label={t('Roll the dice')}>
            <DieFace value={rolling ?? (state.lastRoll || 6)} />
          </button>
        </div>
      ) : (
        <TileEvent key={`${state.turn}-${state.landed}`} state={state} session={session} me={me} players={players} r={r} onResolve={act} remember={(deck, used) => update((cur) => ({ ...cur, used: { ...cur.used, [deck]: used } }))} />
      )}
    </div>
  );
}

function TileEvent({ state, session, me, players, r, onResolve, remember }: { state: BoardState; session: PartySession; me: Player; players: Player[]; r: () => number; onResolve: (a: BoardAction) => void; remember: (deck: 'challenges' | 'trivia', used: string[]) => void }) {
  const tile = state.tiles[state.landed]!;
  const others = players.filter((p) => p.id !== me.id);
  // Picked once per tile: `others` is a new list every render, so a memo re-rolled the opponent mid-duel.
  const [opponent] = useState(() => others[Math.floor(r() * others.length)] ?? me);
  const info = TILE_INFO[tile.kind];
  const [mini, setMini] = useState<MiniId | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  // Drawn once per tile (the event remounts for every landing), skipping cards this session has seen.
  const [cardDraw] = useState((): { item: Challenge | null; used: string[] } | null => {
    const kinds = tile.kind === 'card' ? ['truth', 'dare', 'challenge'] : tile.kind === 'group' ? ['group', 'vote'] : tile.kind === 'duel' ? ['duel'] : [];
    if (!kinds.length) return null;
    const pool = filterContent(CHALLENGES, session.settings).filter((c) => kinds.includes(c.kind) && c.target !== 'teams');
    const w = intensityWeights(session.settings);
    return draw(pool, session.used.challenges ?? [], r, (c) => w[c.intensity]);
  });
  const card = cardDraw?.item ?? null;
  const text = card?.text.replace(/\{A\}/g, me.name).replace(/\{B\}/g, opponent.name).replace(/\{TEAM1\}|\{TEAM2\}/g, 'everyone');
  const [triviaDraw] = useState(() => (tile.kind === 'trivia' ? draw(TRIVIA, session.used.trivia ?? [], r) : null));
  const trivia = triviaDraw?.item ?? null;
  // The seen lists are saved when the tile is played, so the next landing (or game) deals something new.
  const resolve = (a: BoardAction): void => {
    if (cardDraw?.item) remember('challenges', cardDraw.used);
    if (triviaDraw?.item) remember('trivia', triviaDraw.used);
    onResolve(a);
  };
  const options = useMemo(() => (trivia ? shuffle(trivia.options, r) : []), [trivia, r]);

  if (mini) {
    const parts = MINIS.find((m) => m.id === mini)!.players;
    const who = parts === 2 ? [me, opponent] : parts === 1 ? [me] : players;
    return (
      <div className="pt-event">
        <MiniGame id={mini} players={who} onDone={(winner, loser) => resolve({ type: 'resolve', ok: winner === me.id || (!!loser && loser !== me.id) })} />
      </div>
    );
  }

  return (
    <div className="pt-event" style={{ ['--tc' as string]: info.color }}>
      <p className="pt-event-head">
        <span aria-hidden="true">{info.icon}</span> {t(info.label)}
      </p>
      {(tile.kind === 'lucky' || tile.kind === 'shortcut') && (
        <>
          <p className="pt-event-text">
            <Name player={me} /> {tile.kind === 'lucky' ? t('zooms {n} tiles ahead!', { n: tile.value ?? 0 }) : t('takes the shortcut to tile {n}!', { n: tile.value ?? 0 })}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => resolve({ type: 'resolve', ok: true })}>
            {t('Woo! 🚀')}
          </button>
        </>
      )}
      {(tile.kind === 'setback' || tile.kind === 'slide') && (
        <>
          <p className="pt-event-text">
            <Name player={me} /> {tile.kind === 'setback' ? t('slips back {n} tiles.', { n: tile.value ?? 0 }) : t('slides down to tile {n}.', { n: tile.value ?? 0 })}
          </p>
          <button className="pt-btn pt-btn-big" onClick={() => resolve({ type: 'resolve', ok: true })}>
            {t('Noooo 😩')}
          </button>
        </>
      )}
      {tile.kind === 'again' && (
        <>
          <p className="pt-event-text">
            <Name player={me} />{' '}{t('rolls again!')}
          </p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => resolve({ type: 'resolve', ok: true })}>
            {t('Roll again 🎲')}
          </button>
        </>
      )}
      {tile.kind === 'swap' && (
        <>
          <p className="pt-event-text">
            {tNodes('{who}, swap places with anyone (or nobody).', {}, { who: <Name player={me} /> })}
          </p>
          <PlayerPicker players={others} selected={[]} label={t('Swap with')} onToggle={(id) => resolve({ type: 'resolve', ok: true, swapWith: id })} />
          <button className="pt-btn pt-btn-ghost" onClick={() => resolve({ type: 'resolve', ok: true })}>
            {t('Stay put')}
          </button>
        </>
      )}
      {(tile.kind === 'card' || tile.kind === 'group') && card && (
        <>
          <p className="pt-event-text">{text}</p>
          <p className="pt-muted">{t('Done: one step forward. Skip: one step back.')}</p>
          <div className="pt-row">
            <button className="pt-btn pt-btn-go" onClick={() => resolve({ type: 'resolve', ok: true })}>
              {t('Done ✓')}
            </button>
            <button className="pt-btn" onClick={() => resolve({ type: 'resolve', ok: false })}>
              {t('Skip')}
            </button>
          </div>
        </>
      )}
      {tile.kind === 'duel' && card && (
        <>
          <p className="pt-event-text">{text}</p>
          <p className="pt-muted">{t('The winner jumps 2 tiles ahead.')}</p>
          <PlayerPicker players={[me, opponent]} selected={[]} label={t('Winner')} onToggle={(id) => resolve({ type: 'resolve', ok: id === me.id, winnerId: id })} />
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
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => resolve({ type: 'resolve', ok: answer === trivia.options[0] })}>
              {answer === trivia.options[0] ? t('Correct! +1 step') : t('Wrong: back 1 step')}
            </button>
          )}
        </>
      )}
      {tile.kind === 'mini' && (
        <>
          <p className="pt-event-text">{t('Mini-game time! Win it to step forward.')}</p>
          <div className="pt-picker">
            {MINIS.filter((m) => m.players !== 2 || others.length > 0).map((m) => (
              <button key={m.id} className="pt-chip" onClick={() => setMini(m.id)}>
                {m.emoji} {t(m.title)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
