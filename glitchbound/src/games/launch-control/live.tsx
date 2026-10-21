/**
 * Launch Control live: race a friend on their own phone. A room (room.ts on the rooms worker) seats
 * the two of you; this screen shows the invite, both cars and the ready buttons, runs the race on
 * the room's clock (RaceScreen's live mode) and shows the result and the running score.
 */
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useRoom } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { getCar } from './cars';
import { Icon } from './icons';
import { RaceScreen, type RacePlan } from './RaceScreen';
import { levelsOf, liveRace, type Action, type LiveCar, type PlayerView, type RoomView } from './room';
import type { CarLook, Stage3D } from './scene3d';
import type { Sfx } from './sound';
import { CarThumb, Panel } from './ui';
import { fmtEt } from './util';

export const lookOfLive = (c: LiveCar): CarLook => ({
  def: getCar(c.id),
  levels: levelsOf(c),
  paint: c.paint,
  livery: c.livery,
  wheels: c.wheels,
  helmet: c.helmet,
  suit: c.suit,
});

export const inviteLink = (code: string): string => `${location.origin}/games/launch-control?room=${code}`;

export function LiveRoom({
  code,
  name,
  env,
  owned,
  carFor,
  defaultCar,
  stageRef,
  sfx,
  onRacing,
  onLeave,
}: {
  code: string;
  name: string;
  env: string;
  owned: string[];
  carFor: (id: string) => LiveCar;
  defaultCar: string;
  stageRef: RefObject<Stage3D | null>;
  sfx: () => Sfx;
  onRacing: (on: boolean) => void;
  onLeave: () => void;
}) {
  const { view, conn, error, clearError, gone, skew, send } = useRoom<RoomView, Action>(code, name);
  const [carId, setCarId] = useState(defaultCar);
  const [shownRound, setShownRound] = useState(0);
  const [copied, setCopied] = useState('');
  const me = view?.players.find((p) => p.you);
  const friend = view?.players.find((p) => !p.you);
  const myCar = useMemo(() => carFor(carId), [carFor, carId]);
  const myCarKey = JSON.stringify(myCar);

  // tell the room which car you race (again after a reconnect, when the room forgot it)
  useEffect(() => {
    if (conn === 'open' && view && JSON.stringify(me?.car ?? null) !== myCarKey) send({ t: 'car', car: myCar });
  }, [conn, view, me?.car, myCarKey, myCar, send]);

  // the race stays on screen until your own car is done, even when the room has settled it already
  const planRound = view && (view.phase === 'race' || view.phase === 'result') && view.startAt !== null && view.lanes.includes(view.you) ? view.round : 0;
  const racing = planRound > shownRound;
  useEffect(() => {
    onRacing(!!racing);
  }, [racing, onRacing]);
  useEffect(() => () => onRacing(false), [onRacing]);
  useEffect(() => {
    if (error) {
      const id = window.setTimeout(clearError, 3000);
      return () => window.clearTimeout(id);
    }
  }, [error, clearError]);

  // the friend's taps so far (the race screen replays them every frame); the plan itself is fixed per round
  const otherN = view?.lanes.find((n) => n !== view.you) ?? 0;
  const remoteTaps = view?.taps[otherN];
  const plan = useMemo((): RacePlan | null => {
    if (!view || !planRound || view.startAt === null) return null;
    const mine = view.players.find((p) => p.n === view.you);
    const other = view.players.find((p) => view.lanes.includes(p.n) && p.n !== view.you);
    if (!mine?.car || !other?.car) return null;
    // you are always car 0 on your phone (the race doesn't depend on the order)
    const cars = [mine.car, other.car];
    const race = liveRace(cars, view.raceSeed);
    return {
      specs: race.racers.map((r) => r.spec),
      drivers: race.drivers,
      looks: cars.map(lookOfLive),
      names: [mine.name, other.name],
      env,
      seed: view.raceSeed,
      tagline: 'LIVE',
      live: { startAt: view.startAt, skew, send: (step) => send({ t: 'tap', step }), finish: (taps) => send({ t: 'finish', taps }) },
    };
    // one plan per round: later views only move the friend's taps (passed on their own)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRound]);

  if (gone || conn === 'gone')
    return (
      <div className="lc-main">
        <Panel eyebrow={`Room ${code}`} title="Room closed" onBack={onLeave}>
          <p className="lc-sub">{gone || 'This room has closed.'} Rooms close after three quiet hours; open a new one from the menu.</p>
          <button className="btn btn-lg lc-cta" onClick={onLeave}>
            Back to the menu
          </button>
        </Panel>
      </div>
    );

  if (racing && plan)
    return (
      <>
        <RaceScreen key={view!.round} plan={plan} remoteTaps={remoteTaps} stageRef={stageRef} paused={false} setPaused={() => undefined} onFinish={() => setShownRound(view!.round)} sfx={sfx} nudge={false} onStart={() => undefined} />
        {conn !== 'open' && <p className="lc-live-net mono">Reconnecting…</p>}
      </>
    );

  const result = view?.phase === 'result' && view.last && view.round > 0 && shownRound >= view.round ? view.last : null;
  const waiting = view?.phase === 'race' && shownRound >= view.round;
  const iWon = result && result.winner === view?.you;
  const mineT = result && view ? result.times[view.you] : null;
  const theirT = result && friend ? result.times[friend.n] : null;
  const link = inviteLink(code);

  return (
    <div className="lc-main">
      <Panel
        eyebrow={`Live race · room ${code}`}
        title={result ? (iWon ? 'You won!' : result.winner === null ? (Object.values(result.times).every((x) => x.crossed !== null) ? 'Dead heat!' : 'No winner') : `${friend?.name ?? 'Your friend'} won`) : waiting ? 'Waiting for the finish…' : 'Race a friend'}
        onBack={onLeave}
        className={`lc-live${iWon ? ' is-win' : ''}`}
      >
        {conn !== 'open' && <p className="lc-warn">{conn === 'connecting' ? 'Connecting to the room…' : 'Reconnecting…'}</p>}
        {error && <p className="lc-warn">{error}</p>}
        {result && mineT && (
          <div className="lc-live-score">
            <div>
              <span className="lc-eyebrow mono">{me?.name ?? 'You'}</span>
              <b className="mono">{mineT.et !== null ? `${fmtEt(mineT.et)} s` : 'DNF'}</b>
              <small className="mono">
                {mineT.perfect}/{mineT.shifts} perfect · {mineT.trap} km/h
              </small>
            </div>
            <div>
              <span className="lc-eyebrow mono">{friend?.name ?? 'Friend'}</span>
              <b className="mono">{theirT && theirT.et !== null ? `${fmtEt(theirT.et)} s` : 'DNF'}</b>
              <small className="mono">{theirT ? `${theirT.perfect}/${theirT.shifts} perfect · ${theirT.trap} km/h` : ''}</small>
            </div>
            {result.margin > 0 && <p className="lc-live-margin mono">by {result.margin.toFixed(3)} s across the line</p>}
          </div>
        )}
        <div className="lc-live-seats">
          <Seat p={me} car={me?.car ?? myCar} label="You" />
          <span className="lc-live-tally mono" aria-label="Score">
            {me?.score ?? 0}
            <i>–</i>
            {friend?.score ?? 0}
          </span>
          <Seat p={friend} car={friend?.car ?? null} label="Friend" />
        </div>
        {!friend && (
          <div className="lc-live-invite lc-panel-inner">
            <span className="lc-eyebrow mono">Send this to a friend</span>
            <b className="lc-live-code mono">{code}</b>
            <span className="lc-live-link mono">{link.replace(/^https?:\/\//, '')}</span>
            <button
              className="btn"
              onClick={() =>
                void shareOrCopy({
                  title: 'Race me in Launch Control',
                  text: `Race me in Launch Control! Room ${code}`,
                  url: link,
                }).then((o) => setCopied(o === 'copied' ? 'Link copied' : ''))
              }
            >
              <Icon name="share" size={18} />
              {copied || 'Share the link'}
            </button>
          </div>
        )}
        {owned.length > 1 && view?.phase !== 'race' && (
          <div className="lc-chips" role="tablist" aria-label="Your car">
            {owned.map((id) => (
              <button key={id} role="tab" aria-selected={id === carId} className={`lc-chip${id === carId ? ' is-on' : ''}`} onClick={() => setCarId(id)} disabled={!!me?.ready}>
                {getCar(id).name}
              </button>
            ))}
          </div>
        )}
        {view?.phase !== 'race' && (
          <button className={`btn btn-lg${me?.ready ? '' : ' lc-cta'}`} onClick={() => send({ t: 'ready', ready: !me?.ready })} disabled={conn !== 'open' || !me}>
            {me?.ready ? (friend ? `Waiting for ${friend.name}…` : 'Waiting for your friend…') : result ? 'Rematch' : 'Ready'}
          </button>
        )}
        <p className="lc-foot mono">{friend?.ready && !me?.ready ? `${friend.name} is ready. ` : ''}Same tree, same start, live. Friendly: no wear, no money.</p>
      </Panel>
    </div>
  );
}

function Seat({ p, car, label }: { p: PlayerView | undefined; car: LiveCar | null; label: string }) {
  return (
    <div className={`lc-live-seat${p?.you ? ' is-you' : ' is-rival'}${p?.ready ? ' is-ready' : ''}`}>
      {car ? (
        <CarThumb look={lookOfLive(car)} />
      ) : (
        <span className="lc-live-empty" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <b>{p?.name ?? (label === 'Friend' ? 'Waiting…' : label)}</b>
      <span className="mono">{car ? getCar(car.id).name : 'not here yet'}</span>
      <span className="lc-live-state mono">{!p ? '' : !p.online ? 'away' : p.ready ? 'ready' : 'in the room'}</span>
    </div>
  );
}
