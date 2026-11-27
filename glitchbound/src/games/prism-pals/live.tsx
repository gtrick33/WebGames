/**
 * Prism Pals live: the room's lobby (everyone picks a favorite pal; the host picks the level), the level on
 * every device (net.ts: each game runs its own pals, the host's game the world) and the level's result,
 * with the next level, a replay or the way back to the lobby.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { RoomListingBar, RoomNextStep } from '../../components/OnlinePlay';
import { useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { COLOR_IDS, PALS, type ColorId } from './critters';
import { parseLevel } from './level';
import { LEVELS } from './levels';
import { Coop } from './net';
import { PalFace } from './PalFace';
import { shareCritters, type Action, type View } from './room';
import { critters, packLevels, PACKS, resultLine } from './rules';
import type { Sfx } from './sound';
import { Stage } from './Stage';

export const inviteLink = (code: string): string => `${location.origin}/r/${code}`;

interface Props {
  code: string;
  name: string;
  color: ColorId;
  sfx: () => Sfx;
  muted: boolean;
  onMute: () => void;
  onLeave: () => void;
  onRoom: (code: string) => void;
}

export function LiveRoom({ code, name, color, sfx, muted, onMute, onLeave, onRoom }: Props) {
  const coop = useRef<Coop | null>(null);
  const { view, conn, error, clearError, gone, goneCode, send, skew, listing, setListed } = useRoom<View, Action>(code, name || 'Player', (data) => {
    const m = data as { n?: unknown; d?: unknown } | null;
    if (m && typeof m.n === 'number') coop.current?.receive(m.n, m.d);
  });
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 3500);
    return () => window.clearTimeout(id);
  }, [error, clearError]);
  // once seated, ask for the favorite pal from the menu (if nobody here has it)
  const asked = useRef(false);
  useEffect(() => {
    if (!view || asked.current) return;
    asked.current = true;
    if (view.picks[view.me] !== color && !view.players.some((p) => p.online && p.n !== view.me && view.picks[p.n] === color)) send({ t: 'color', c: color });
  }, [view, color, send]);

  if (gone || conn === 'gone')
    return (
      <div className="pri-scroll">
        <div className="pri-panel">
          <h2 className="pri-h">This room has closed</h2>
          <p className="pri-sub">{gone}</p>
          <RoomNextStep game="prism-pals" room={code} code={goneCode || 'closed'} onRoom={onRoom} />
          <button className="pri-ghost" onClick={onLeave}>
            Back to the menu
          </button>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="pri-scroll">
        <div className="pri-panel">
          <p className="pri-sub">Connecting to room {code}…</p>
          <button className="pri-ghost" onClick={onLeave}>
            Back
          </button>
        </div>
      </div>
    );
  const notice = error || (conn !== 'open' ? 'Reconnecting…' : '');
  const tools = (
    <>
      <button className="pri-icon" onClick={onMute} aria-label={muted ? 'Sound on' : 'Sound off'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <GameMenuButton className="pri-icon" />
    </>
  );
  if (view.phase === 'lobby')
    return <Lobby view={view} code={code} send={send} tools={tools} onLeave={onLeave} notice={notice} bar={<RoomListingBar listing={listing} host={view.host === view.me} players={view.players.filter((p) => p.online).length} min={2} skew={skew} onListed={setListed} />} />;
  return <LivePlay key={view.run} view={view} code={code} coopRef={coop} send={send} sfx={sfx} muted={muted} onMute={onMute} onLeave={onLeave} notice={notice} />;
}

function LivePlay({ view, code, coopRef, send, sfx, muted, onMute, onLeave, notice }: { view: View; code: string; coopRef: React.MutableRefObject<Coop | null>; send: (a: Action, o?: { resend?: boolean }) => void; sfx: () => Sfx; muted: boolean; onMute: () => void; onLeave: () => void; notice: string }) {
  const [menu, setMenu] = useState(false);
  const run = view.run;
  const isHost = view.host === view.me;
  const coop = useMemo(() => {
    const lv = parseLevel(LEVELS[view.level]!);
    return new Coop(
      lv,
      run,
      view.me,
      view.own,
      isHost,
      (d) => send({ t: 'r', d }),
      (c) => send({ t: 'clear', run, secs: c.secs, gems: c.gems, tries: c.tries }, { resend: true }),
    );
    // a new level for every run (LiveRoom keys this on it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    coopRef.current = coop;
    return () => {
      if (coopRef.current === coop) coopRef.current = null;
    };
  }, [coop, coopRef]);
  const roles = `${view.host}|${view.own.join(',')}`;
  useEffect(() => {
    coop.setRoles(view.host === view.me, view.own);
    // (roles: who hosts and who runs which critter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, coop]);
  const nameOf = (n: number): string => view.players.find((p) => p.n === n)?.name ?? 'Player';
  const labels = view.own.map(nameOf);
  const lv = coop.w.lv;
  const r = view.phase === 'result' ? view.result : null;
  const shareMine = view.own.filter((n) => n === view.me).length;
  return (
    <Stage coop={coop} title={`${lv.n} pals · ${lv.name}`} paused={false} sfx={sfx} labels={labels} roles={roles} muted={muted} onMute={onMute} onPause={() => setMenu((m) => !m)} onRestart={() => !r && coop.restart()} pauseLabel="Menu" extra={<span className="pri-code pri-mono">{code}</span>}>
      {notice && <p className="pri-notice">{notice}</p>}
      {!r && shareMine === 0 && <p className="pri-notice is-soft">You’re watching: every pal has a player.</p>}
      {menu && !r && (
        <div className="pri-sheet-wrap" role="dialog" aria-label="Room menu" onClick={() => setMenu(false)}>
          <div className="pri-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Room {code}</h2>
            <p className="pri-sub">The level keeps going while this is open.</p>
            <button className="pri-cta" onClick={() => setMenu(false)} autoFocus>
              Back to the level
            </button>
            <button
              className="pri-ghost"
              onClick={() => {
                coop.restart();
                setMenu(false);
              }}
            >
              Start the level over
            </button>
            {isHost && (
              <button className="pri-ghost" onClick={() => send({ t: 'lobby' })}>
                Back to the lobby
              </button>
            )}
            <button className="pri-link" onClick={onLeave}>
              Leave the room
            </button>
          </div>
        </div>
      )}
      {r && (
        <div className="pri-sheet-wrap" role="dialog" aria-label="Level clear">
          <div className="pri-sheet is-win">
            <h2>Level clear!</h2>
            <p className="pri-score">
              {r.score}
              <small>team points</small>
            </p>
            <p className="pri-line">{resultLine(r.secs, r.gems, lv.gems.length, r.tries)}</p>
            <div className="pri-team">
              {view.own.map((n, i) => (
                <span key={i} style={{ ['--c' as string]: PALS[i as ColorId].color }}>
                  <PalFace color={i as ColorId} size={30} />
                  {nameOf(n)}
                </span>
              ))}
            </div>
            <p className="pri-sub">
              Room total {view.total} · {view.cleared.length} {view.cleared.length === 1 ? 'level' : 'levels'} cleared together
            </p>
            {isHost ? (
              <div className="pri-actions">
                <button className="pri-cta" onClick={() => send({ t: 'next' })} autoFocus>
                  Next level
                </button>
                <button className="pri-ghost" onClick={() => send({ t: 'again' })}>
                  Replay
                </button>
                <button className="pri-ghost" onClick={() => send({ t: 'lobby' })}>
                  Change level
                </button>
              </div>
            ) : (
              <p className="pri-sub">Waiting for the host to pick the next level…</p>
            )}
            <button className="pri-link" onClick={onLeave}>
              Leave the room
            </button>
          </div>
        </div>
      )}
    </Stage>
  );
}

function Lobby({ view, code, send, tools, onLeave, notice, bar }: { view: View; code: string; send: (a: Action) => void; tools: ReactNode; onLeave: () => void; notice: string; bar: ReactNode }) {
  const [copied, setCopied] = useState('');
  const link = inviteLink(code);
  const here = view.players.filter((p) => p.online);
  const isHost = view.host === view.me;
  const mine = view.picks[view.me];
  const [pack, setPack] = useState(() => critters(view.level));
  const set = packLevels(pack);
  const plan = shareCritters(
    here.map((p) => p.n),
    view.picks,
    critters(view.level),
  );
  const nameOf = (n: number): string => view.players.find((p) => p.n === n)?.name ?? 'Player';
  return (
    <div className="pri-scroll">
      <div className="pri-panel">
        <div className="pri-toprow">
          <button className="pri-ghost is-small" onClick={onLeave}>
            ← Leave
          </button>
          <div className="pri-tools">{tools}</div>
        </div>
        <h2 className="pri-h">Room {code}</h2>
        {bar}
        {notice && <p className="pri-err">{notice}</p>}
        <section className="pri-card">
          <h3>
            The team <small>{here.length} of 4</small>
          </h3>
          <ul className="pri-teamlist">
            {view.players.map((p) => {
              const c = (view.picks[p.n] ?? 0) as ColorId;
              return (
                <li key={p.n} className={p.n === view.me ? 'is-me' : ''} style={{ ['--c' as string]: PALS[c].color }}>
                  <PalFace color={c} size={38} />
                  <b>{p.name}</b>
                  <small>
                    {PALS[c].name}
                    {p.host ? ' · host' : ''}
                    {p.you ? ' · you' : ''}
                    {!p.online ? ' · away' : ''}
                  </small>
                  {isHost && p.n !== view.me && (
                    <button className="pri-link" onClick={() => send({ t: 'kick', n: p.n })} aria-label={`Remove ${p.name}`}>
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="pri-card">
          <h3>Your favorite pal</h3>
          <div className="pri-colors" role="radiogroup" aria-label="Your favorite pal">
            {COLOR_IDS.map((c) => {
              const taken = here.some((p) => p.n !== view.me && view.picks[p.n] === c);
              return (
                <button key={c} role="radio" aria-checked={mine === c} className={`pri-color${mine === c ? ' is-on' : ''}`} disabled={taken} style={{ ['--c' as string]: PALS[c].color }} onClick={() => send({ t: 'color', c })}>
                  <PalFace color={c} size={36} />
                  <small>{PALS[c].name}</small>
                </button>
              );
            })}
          </div>
          <p className="pri-sub">You run your favorite when the level has it. With fewer players than pals, some run two and switch with Tab (or ⇄).</p>
        </section>
        <section className="pri-card">
          <h3>Level {isHost ? '' : <small>(the host picks)</small>}</h3>
          {isHost && (
            <>
              <div className="pri-seg" role="radiogroup" aria-label="Pals in the level">
                {PACKS.map((p) => (
                  <button key={p} role="radio" aria-checked={pack === p} className={pack === p ? 'is-on' : ''} disabled={p < here.length} onClick={() => setPack(p)}>
                    {p} pals
                  </button>
                ))}
              </div>
              <div className="pri-levels">
                {set.map((i, k) => (
                  <button key={i} className={`pri-level${view.level === i ? ' is-on' : ''}${view.cleared.includes(i) ? ' is-done' : ''}`} disabled={critters(i) < here.length} onClick={() => send({ t: 'level', i })} aria-pressed={view.level === i}>
                    <b>{k + 1}</b>
                    <span>{LEVELS[i]!.name}</span>
                    <small>{view.cleared.includes(i) ? 'Cleared' : `${critters(i)} pals`}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="pri-sub">
            <b>{LEVELS[view.level]!.name}</b> ({critters(view.level)} pals): {plan.map((n, i) => `${PALS[i as ColorId].name} → ${n > 0 ? nameOf(n) : '?'}`).join(' · ')}
          </p>
        </section>
        <section className="pri-card pri-invite">
          <h3>Invite friends</h3>
          <p>
            Room code <b className="pri-mono">{code}</b> · <span className="pri-mono">{link.replace(/^https?:\/\//, '')}</span>
          </p>
          <button className="pri-ghost" onClick={() => void shareOrCopy({ title: 'Prism Pals', text: `Join my Prism Pals team! Room ${code}`, url: link }).then((o) => setCopied(o === 'copied' ? 'Link copied!' : ''))}>
            {copied || 'Share the invite link'}
          </button>
        </section>
        {view.total > 0 && (
          <p className="pri-sub">
            Room total {view.total} · {view.cleared.length} cleared together
          </p>
        )}
        {isHost ? (
          <button className="pri-cta is-big" onClick={() => send({ t: 'start' })}>
            {here.length < 2 ? 'Start alone (you run every pal)' : 'Start the level'}
          </button>
        ) : (
          <p className="pri-sub">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}
