import { useEffect, useState } from 'react';
import { TILE_INFO } from '../../board';
import { MIN_PLAYERS, SIZES, VIBES, type Action, type RoomView } from '../../rooms/boardRoom';
import { cell, COLS, DieFace } from '../Board';
import { Clock, Dot, RoomFrame, Scores, seatColor, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';

type Ctx = RoomContext<RoomView, Action>;
const SIZE_LABEL: Record<string, [string, string]> = { short: ['Short', '~10 min'], medium: ['Medium', '~20 min'], long: ['Long', '~35 min'] };

export function BoardRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Dice Adventure', emoji: '🎲', invite: 'Join my Dice Adventure: roll, race and dodge the slides.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.board && v.phase === 'play' ? `Turn ${v.board.turn + 1}` : undefined)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const s = view.settings;
  const online = view.players.filter((p) => p.online).length;
  return (
    <>
      <h3>{t('Board size')}</h3>
      <div className="pt-seg" role="radiogroup">
        {SIZES.map((id) => (
          <button key={id} role="radio" aria-checked={s.size === id} onClick={() => send({ t: 'settings', settings: { size: id } })}>
            {SIZE_LABEL[id]![0]}
            <small>{SIZE_LABEL[id]![1]}</small>
          </button>
        ))}
      </div>
      <p className="pt-label">{t('Challenge cards')}</p>
      <div className="pt-seg" role="radiogroup">
        {VIBES.map((v) => (
          <button key={v} role="radio" aria-checked={s.vibe === v} onClick={() => send({ t: 'settings', settings: { vibe: v } })}>
            {v === 'casual' ? t('😊 Casual') : t('🌶️ Spicy')}
          </button>
        ))}
      </div>
      <p className="pt-muted">{t('Turn order is shuffled. Land on tiles for challenges, duels, trivia, shortcuts and nasty slides. First to the 🏆 wins.')}</p>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Roll out the board')}
      </button>
    </>
  );
}

/** Tokens walk one tile at a time to where the room puts them. */
function useWalk(pos: Record<string, number> | undefined): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...pos }));
  useEffect(() => {
    if (!pos) return;
    const behind = Object.keys(pos).filter((id) => (shown[id] ?? 0) !== pos[id]);
    if (!behind.length) return;
    const t = window.setTimeout(() => {
      setShown((sh) => {
        const next = { ...sh };
        for (const id of behind) {
          const from = next[id] ?? 0;
          const to = pos[id]!;
          next[id] = Math.abs(to - from) > 10 ? to : from + Math.sign(to - from);
        }
        return next;
      });
    }, 190);
    return () => window.clearTimeout(t);
  }, [pos, shown]);
  return shown;
}

function Game({ view, send, left, me, byN }: Ctx) {
  const b = view.board;
  const shown = useWalk(b?.pos);
  const [spin, setSpin] = useState<number | null>(null);
  const rolls = b?.rolls ?? 0;
  // The die tumbles for a moment whenever anyone rolls.
  useEffect(() => {
    if (!rolls) return;
    let n = 0;
    const t = window.setInterval(() => {
      setSpin(++n >= 7 ? null : 1 + Math.floor(Math.random() * 6));
      if (n >= 7) window.clearInterval(t);
    }, 70);
    return () => window.clearInterval(t);
  }, [rolls]);
  if (!b) return null;

  if (view.phase === 'result' && view.result) {
    const winner = byN(view.result.winner);
    return (
      <section className="pt-panel pt-imp-result">
        <h2>🏆 {winner?.you ? t('You win the adventure!') : t('{name} wins the adventure!', { name: winner?.name ?? t('Someone') })}</h2>
        <ol className="pt-imp-votes">
          {view.result.standings.map((n, i) => (
            <li key={n}>
              {i + 1}. {byN(n)?.name} · {t('tile {n}', { n: b.pos[String(n)] ?? 0 })}
            </li>
          ))}
        </ol>
        {view.result.awards.length > 0 && (
          <ul className="pt-awards">
            {view.result.awards.map((a) => (
              <li key={a.title}>
                <span className="pt-award-title">🏅 {t(a.title)}</span>
                <span>
                  {byN(a.n)?.name} · {a.why}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Scores players={view.players} />
        {view.host ? (
          <div className="pt-row">
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'start' })}>
              {t('New board')}
            </button>
            <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
              {t('Settings')}
            </button>
          </div>
        ) : (
          <p className="pt-muted pt-center">{t('The host starts the next game.')}</p>
        )}
      </section>
    );
  }

  const cur = byN(b.current);
  const mine = b.current === me.n;
  const moving = b.order.some((n) => (shown[String(n)] ?? 0) !== b.pos[String(n)]);
  const ev = view.event;
  const rows = Math.ceil(b.tiles.length / COLS);
  const players = b.order.map((n) => byN(n)).filter((p) => !!p);

  return (
    <div className="pt-board-screen pt-room-board">
      <div className="pt-standings" aria-label={t('Positions')}>
        {[...players]
          .sort((x, y) => (b.pos[String(y.n)] ?? 0) - (b.pos[String(x.n)] ?? 0))
          .map((p) => (
            <span key={p.n} className={`pt-stand${p.n === b.current ? ' is-now' : ''}`} style={{ ['--pc' as string]: seatColor(p.n) }}>
              {p.name}
              {p.you ? t(' (you)') : ''} <b>{b.pos[String(p.n)]}</b>
            </span>
          ))}
      </div>
      <div className="pt-board" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }} role="img" aria-label={t('Board with {n} tiles', { n: b.tiles.length })}>
        {b.tiles.map((tile, i) => {
          const { row, col } = cell(i);
          const here = players.filter((p) => (shown[String(p.n)] ?? 0) === i);
          const info = TILE_INFO[tile.kind];
          return (
            <div key={i} className={`pt-tile pt-tile-${tile.kind}${b.landed === i && b.step === 'event' ? ' is-landed' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1, background: info.color }} title={`${i}: ${t(info.label)}`}>
              <span className="pt-tile-icon" aria-hidden="true">
                {info.icon}
              </span>
              <span className="pt-tile-n">{tile.kind === 'shortcut' || tile.kind === 'slide' ? `→${tile.value}` : i}</span>
              {here.length > 0 && (
                <span className="pt-tokens">
                  {here.map((p) => (
                    <span key={p.n} className="pt-token" style={{ background: seatColor(p.n) }} title={p.name}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {b.step === 'roll' || moving || !ev ? (
        <div className="pt-turn">
          {cur && <Dot p={cur} size={44} />}
          <div>
            <p className="pt-kicker">{mine ? t('Your turn') : t('Their turn')}</p>
            <b className="pt-turn-name">{mine ? t('Roll the dice!') : t('{name} is rolling', { name: cur?.name ?? '…' })}</b>
            {b.step === 'roll' && <Clock left={left} />}
          </div>
          <button className={`pt-die${spin !== null ? ' is-rolling' : ''}`} onClick={() => send({ t: 'roll' })} disabled={!mine || b.step !== 'roll' || moving || spin !== null} aria-label={t('Roll the dice')}>
            <DieFace value={spin ?? (b.lastRoll || 6)} />
          </button>
        </div>
      ) : (
        <Event view={view} send={send} left={left} mine={mine} curName={cur?.name ?? t('Someone')} byN={byN} />
      )}
    </div>
  );
}

function Event({ view, send, left, mine, curName, byN }: { view: RoomView; send: (a: Action) => void; left: number | null; mine: boolean; curName: string; byN: Ctx['byN'] }) {
  const ev = view.event!;
  const b = view.board!;
  const tile = b.tiles[b.landed]!;
  const info = TILE_INFO[ev.kind === 'trivia' ? 'trivia' : tile.kind];
  const opponent = byN(ev.opponent);
  const wait = <p className="pt-muted">{t('{name} decides on their phone…', { name: curName })}</p>;
  return (
    <div className="pt-event" style={{ ['--tc' as string]: info.color }}>
      <p className="pt-event-head">
        <span aria-hidden="true">{info.icon}</span> {t(info.label)}
      </p>
      {(ev.kind === 'lucky' || ev.kind === 'shortcut' || ev.kind === 'setback' || ev.kind === 'slide' || ev.kind === 'again') && (
        <>
          <p className="pt-event-text">
            {ev.kind === 'lucky' && (mine ? t('You zoom {n} tiles ahead!', { n: tile.value ?? 0 }) : t('{name} zooms {n} tiles ahead!', { name: curName, n: tile.value ?? 0 }))}
            {ev.kind === 'shortcut' && (mine ? t('You take the shortcut to tile {n}!', { n: tile.value ?? 0 }) : t('{name} takes the shortcut to tile {n}!', { name: curName, n: tile.value ?? 0 }))}
            {ev.kind === 'setback' && (mine ? t('You slip back {n} tiles.', { n: tile.value ?? 0 }) : t('{name} slips back {n} tiles.', { name: curName, n: tile.value ?? 0 }))}
            {ev.kind === 'slide' && (mine ? t('You slide down to tile {n}.', { n: tile.value ?? 0 }) : t('{name} slides down to tile {n}.', { name: curName, n: tile.value ?? 0 }))}
            {ev.kind === 'again' && (mine ? t('You roll again!') : t('{name} rolls again!', { name: curName }))}
          </p>
          {mine && (
            <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'ok' })}>
              {ev.kind === 'setback' || ev.kind === 'slide' ? t('Noooo 😩') : ev.kind === 'again' ? t('Roll again 🎲') : t('Woo! 🚀')}
            </button>
          )}
        </>
      )}
      {ev.kind === 'swap' && (
        <>
          <p className="pt-event-text">{mine ? t('Swap places with anyone (or nobody).') : t('{name} can swap places with anyone…', { name: curName })}</p>
          {mine ? (
            <>
              <div className="pt-picker">
                {b.order
                  .filter((n) => n !== view.you)
                  .map((n) => {
                    const p = byN(n);
                    return p ? (
                      <button key={n} className="pt-chip" style={{ ['--pc' as string]: seatColor(n) }} onClick={() => send({ t: 'swap', seat: n })}>
                        {p.name} · {t('tile {n}', { n: b.pos[String(n)] ?? 0 })}
                      </button>
                    ) : null;
                  })}
              </div>
              <button className="pt-btn pt-btn-ghost" onClick={() => send({ t: 'ok' })}>
                {t('Stay put')}
              </button>
            </>
          ) : (
            wait
          )}
        </>
      )}
      {(ev.kind === 'card' || ev.kind === 'group') && (
        <>
          <p className="pt-event-text">{ev.text ?? t('Make up a challenge for them!')}</p>
          {ev.note && <p className="pt-muted">{ev.note}</p>}
          <p className="pt-muted">{t('Done: one step forward. Skip: one step back.')}</p>
          {mine ? (
            <div className="pt-row">
              <button className="pt-btn pt-btn-go" onClick={() => send({ t: 'done', ok: true })}>
                {t('Done ✓')}
              </button>
              <button className="pt-btn" onClick={() => send({ t: 'done', ok: false })}>
                {t('Skip')}
              </button>
            </div>
          ) : (
            wait
          )}
        </>
      )}
      {ev.kind === 'duel' && (
        <>
          <p className="pt-event-text">{ev.text ?? t('Duel with {name}!', { name: opponent?.name ?? t('someone') })}</p>
          <p className="pt-muted">{t('The winner jumps 2 tiles ahead.')}</p>
          {mine ? (
            <div className="pt-row">
              <button className="pt-btn pt-btn-go" onClick={() => send({ t: 'winner', seat: view.you })}>
                {t('I won')}
              </button>
              {opponent && (
                <button className="pt-btn" onClick={() => send({ t: 'winner', seat: opponent.n })}>
                  {t('{name} won', { name: opponent.name })}
                </button>
              )}
            </div>
          ) : (
            wait
          )}
        </>
      )}
      {ev.kind === 'trivia' && ev.trivia && (
        <>
          <p className="pt-event-text">{ev.trivia.q}</p>
          <div className="pt-trivia-opts">
            {ev.trivia.options.map((o, i) => (
              <button
                key={o}
                className={`pt-trivia-opt${ev.trivia!.right !== null ? (i === ev.trivia!.right ? ' is-right' : i === ev.picked ? ' is-wrong' : '') : ''}`}
                disabled={!mine || ev.picked !== null}
                onClick={() => send({ t: 'answer', i })}
              >
                {o}
              </button>
            ))}
          </div>
          {ev.picked !== null ? <p className="pt-event-text">{ev.picked === ev.trivia.right ? t('Correct! +1 step') : t('Wrong: back 1 step')}</p> : !mine && <p className="pt-muted">{t('{name} is answering…', { name: curName })}</p>}
        </>
      )}
      <Clock left={left} />
    </div>
  );
}
