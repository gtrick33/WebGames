import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { ABILITIES, kitOf, PRESETS, SLOTS } from '../arena/abilities';
import { afterMatch, COMPS, drawOpponents, FORMATS, nameFor, nextRank, rankOf, readRing, setsOf, skillAt, standingOf, writeRing, type ClassSets, type Comp, type Format, type RingSave } from '../arena/ladder';
import { MAP_IDS, MAPS } from '../arena/maps';
import type { FighterSetup, MatchSetup } from '../arena/sim';
import { CLASS_IDS, CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { Link, type LinkState } from '../net/link';
import type { Action as RoomAction, Pick as RoomPick, View as RoomView } from '../net/ringRoom';
import { newCharacter, type Face } from '../progress/character';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { heroDollUrl, heroLook } from '../render/sprites';
import { RingMatch, type MatchResult, type RingInbox } from './RingMatch';
import { SetupEditor } from './RingSetup';

/** The computer's teammates: who they are and which of their bars they bring. */
interface Mate {
  cls: ClassId;
  preset: number;
}

const DEFAULT_MATES: Record<ClassId, Mate[]> = {
  warrior: [{ cls: 'priest', preset: 0 }, { cls: 'mage', preset: 1 }],
  mage: [{ cls: 'druid', preset: 0 }, { cls: 'warrior', preset: 0 }],
  ranger: [{ cls: 'priest', preset: 0 }, { cls: 'warlock', preset: 0 }],
  priest: [{ cls: 'warrior', preset: 0 }, { cls: 'mage', preset: 1 }],
  paladin: [{ cls: 'ranger', preset: 0 }, { cls: 'warlock', preset: 1 }],
  warlock: [{ cls: 'druid', preset: 0 }, { cls: 'ranger', preset: 0 }],
  druid: [{ cls: 'warlock', preset: 0 }, { cls: 'warrior', preset: 0 }],
};

const roomErrors: Record<string, string> = { full: 'That room is full.', in_run: 'That room is already in a match.' };

/** Both ends of a room build the same match from the room's own word. Empty places go to the computer. */
export function setupFromRoom(v: RoomView): { setup: MatchSetup; mine: number } {
  const fighters: FighterSetup[] = [];
  for (const team of [0, 1] as const) {
    const on = v.seats.filter((s) => s.pick?.team === team).slice(0, v.format);
    for (const s of on) {
      const known = CLASS_IDS.includes(s.pick!.cls as ClassId);
      const cls = (known ? s.pick!.cls : 'warrior') as ClassId;
      const bar = s.pick!.bar.filter((id) => ABILITIES[id]?.cls === cls);
      fighters.push({ team, cls, name: s.name, bar: bar.length === SLOTS ? bar : PRESETS[cls][0]!.bar, oath: s.pick!.oath, talents: s.pick!.talents, seat: s.n });
    }
    const list = COMPS[v.format];
    const comp = list[(v.runSeed + team) % list.length]!;
    for (let i = on.length; i < v.format; i++) {
      const t = comp.team[i % comp.team.length]!;
      fighters.push({ team, cls: t.cls, name: nameFor(t.cls, v.runSeed + i + team * 7), bar: PRESETS[t.cls][t.preset]!.bar, talents: PRESETS[t.cls][t.preset]!.talents });
    }
  }
  return { setup: { seed: v.runSeed, map: MAPS[v.map] ? v.map : 'sands', fighters }, mine: fighters.findIndex((f) => f.seat === v.you) };
}

/** The Ring: choose a bar and a team, then fight the computer up a ladder, or friends in a private room. */
export function RingScreen({ engine, face, body, cls, name, onBack }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; cls?: ClassId; name?: string; onBack: () => void }) {
  const [save, setSave] = useState<RingSave>(readRing);
  const [format, setFormat] = useState<Format>(1);
  const [pick, setPick] = useState<ClassId>(cls ?? 'warrior');
  const [mates, setMates] = useState<Mate[]>(() => DEFAULT_MATES[cls ?? 'warrior']);
  const [map, setMap] = useState<string>('random');
  const [fight, setFight] = useState<{ setup: MatchSetup; rival: Comp; skill: number; myRating: number } | null>(null);
  const [roomFight, setRoomFight] = useState<{ setup: MatchSetup; mine: number; host: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ r: MatchResult; change: number; rankUp: string | null; solo: boolean } | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [view, setView] = useState<RoomView | null>(null);
  const [linkState, setLinkState] = useState<LinkState | 'none'>('none');
  const [roomErr, setRoomErr] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const linkRef = useRef<Link<RoomView, RoomAction> | null>(null);
  const inbox = useRef<RingInbox | null>(null);
  const [, setIcons] = useState(false);
  useEffect(() => {
    void iconsReady.then(setIcons);
    return () => linkRef.current?.close();
  }, []);

  const hero = name ?? 'You';
  const standing = standingOf(save, format);
  const rank = rankOf(standing.best);
  const next = nextRank(standing.best);
  const doll = useMemo(() => heroDollUrl(heroLook(pick, newCharacter(pick, 'Ring', 'ring').equip, {}, body ?? 'm', face), 'down', 5), [pick, body, face]);

  const sets = setsOf(save, pick);
  const setup = sets.list[sets.active]!;
  const { bar, oath, talents } = setup;
  const ready = bar.length === SLOTS;
  const choose = (c: ClassId): void => {
    setPick(c);
    setMates(DEFAULT_MATES[c]);
  };
  const putSets = (next: ClassSets): void => {
    setSave((now) => {
      const saved = { ...now, sets: { ...now.sets, [pick]: next } };
      writeRing(saved);
      return saved;
    });
  };

  const enter = (): void => {
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const { comp, fighters } = drawOpponents(format, seed);
    const team: FighterSetup[] = [{ team: 0, cls: pick, name: hero, bar, oath, talents, human: true }, ...mates.slice(0, format - 1).map((x, i) => ({ team: 0 as const, cls: x.cls, name: nameFor(x.cls, seed + i + 11), bar: PRESETS[x.cls][x.preset]!.bar, talents: PRESETS[x.cls][x.preset]!.talents, oath: 'will' }))];
    setResult(null);
    setRun((r) => r + 1);
    setFight({ setup: { seed, map: map === 'random' ? MAP_IDS[seed % MAP_IDS.length]! : map, fighters: [...team, ...fighters] }, rival: comp, skill: skillAt(standing.rating), myRating: standing.rating });
  };

  /* -------------------------------------------------- the room */
  const myPick = useMemo((): RoomPick => ({ team: view?.seats.find((s) => s.you)?.pick?.team ?? 0, cls: pick, bar, oath, talents }), [view, pick, bar, oath, talents]);
  const runSeen = useRef(0);
  const handlers = {
    onView: (v: RoomView) => {
      setView(v);
      if (v.phase === 'lobby') {
        setRoomFight((f) => (f ? null : f));
      } else if (v.run !== runSeen.current) {
        // the host said go
        runSeen.current = v.run;
        const { setup, mine } = setupFromRoom(v);
        if (mine >= 0) {
          setResult(null);
          setRun((r) => r + 1);
          setRoomFight({ setup, mine, host: v.host === v.you });
        }
      }
    },
    onRelay: (_n: number, d: unknown) => inbox.current?.(_n, d),
    onState: (s: LinkState, why?: string) => {
      setLinkState(s);
      if (s === 'gone') {
        setView(null);
        setRoomFight(null);
        setRoomErr(why ? (roomErrors[why] ?? why) : 'The room has closed.');
        linkRef.current = null;
      }
    },
    onError: (msg: string) => setRoomErr(roomErrors[msg] ?? ''),
  };
  const openRoom = async (): Promise<void> => {
    setRoomErr('');
    try {
      linkRef.current = await Link.create<RoomView, RoomAction>(hero, handlers, 'sigilfall-ring');
      setLinkState('connecting');
    } catch (e) {
      setRoomErr(e instanceof Error ? e.message : 'Could not open a room.');
    }
  };
  const joinRoom = (): void => {
    const code = codeIn.trim().toUpperCase();
    if (!code) return;
    setRoomErr('');
    linkRef.current = new Link<RoomView, RoomAction>(code, hero, handlers);
    setLinkState('connecting');
  };
  const leaveRoom = (): void => {
    linkRef.current?.send({ t: 'bye' });
    linkRef.current?.close();
    linkRef.current = null;
    setView(null);
    setLinkState('none');
    setRoomFight(null);
  };
  // our choices go to the room as they change (a player without a side takes the first one with room)
  const sentPick = useRef('');
  useEffect(() => {
    if (!view || view.phase !== 'lobby' || !ready || !linkRef.current) return;
    const seated = view.seats.find((s) => s.you)?.pick;
    const team = seated ? seated.team : view.seats.filter((s) => s.pick?.team === 0).length < view.format ? 0 : 1;
    const say = JSON.stringify({ ...myPick, team });
    if (say !== sentPick.current) {
      sentPick.current = say;
      linkRef.current.send({ t: 'pick', pick: { ...myPick, team } });
    }
  }, [view, myPick, ready]);

  if (fight) {
    return (
      <RingMatch
        key={run}
        engine={engine}
        setup={fight.setup}
        myId={0}
        face={face}
        body={body}
        role={{ kind: 'solo', skill: fight.skill }}
        sets={sets}
        onSets={putSets}
        onLeave={() => {
          const out = afterMatch(standing, fight.myRating, false);
          const nextSave = { ...save, standings: { ...save.standings, [format]: out.next } };
          setSave(nextSave);
          writeRing(nextSave);
          setFight(null);
        }}
        onDone={(r) => {
          if (r.draw) {
            setResult({ r, change: 0, rankUp: null, solo: true });
          } else {
            const out = afterMatch(standing, fight.myRating, r.won);
            const nextSave = { ...save, standings: { ...save.standings, [format]: out.next } };
            setSave(nextSave);
            writeRing(nextSave);
            setResult({ r, change: out.change, rankUp: out.rankUp, solo: true });
          }
          setFight(null);
        }}
      />
    );
  }
  if (roomFight) {
    const relay = (d: unknown): void => linkRef.current?.relay(d);
    const listen = (fn: RingInbox | null): void => {
      inbox.current = fn;
    };
    return (
      <RingMatch
        key={run}
        engine={engine}
        setup={roomFight.setup}
        myId={roomFight.mine}
        face={face}
        body={body}
        role={roomFight.host ? { kind: 'host', skill: 0.6, send: relay, listen } : { kind: 'client', send: relay, listen }}
        sets={sets}
        onSets={putSets}
        onLeave={() => {
          if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
        onDone={(r) => {
          setResult({ r, change: 0, rankUp: null, solo: false });
          if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
      />
    );
  }

  return (
    <div className="rb-ringlobby" style={{ ['--cls' as string]: CLASSES[pick].colors.accent }}>
      <header className="rb-vlobby-head">
        <button className="rb-iconbtn" onClick={() => (roomOpen ? setRoomOpen(false) : onBack())} aria-label="Back">
          ←
        </button>
        <div>
          <h1>The Ring</h1>
          <p>Six abilities, an oath, and whoever stands across from you. Use the stone.</p>
        </div>
        <GameMenuButton className="rb-iconbtn" />
      </header>

      <section className="rb-rl-left">
        <div className="rb-rl-formats" role="tablist" aria-label="Format">
          {FORMATS.map((f) => {
            const st = standingOf(save, f);
            return (
              <button key={f} role="tab" aria-selected={f === format} className={`rb-rl-format${f === format ? ' is-on' : ''}`} onClick={() => setFormat(f)}>
                <strong>
                  {f}v{f}
                </strong>
                <small>{st.rating}</small>
              </button>
            );
          })}
        </div>
        <div className="rb-rl-rank" style={{ ['--r' as string]: rank.color }}>
          <b>{rank.name}</b>
          <span>
            {standing.rating} rating · {standing.wins}–{standing.losses}
          </span>
          {next && (
            <span className="rb-rl-next">
              <i style={{ width: `${Math.max(0, Math.min(100, ((standing.best - rank.at) / (next.at - rank.at)) * 100))}%` }} />
              <small>
                {next.name} at {next.at}
              </small>
            </span>
          )}
        </div>
        <div className="rb-rl-classes" role="radiogroup" aria-label="Class">
          {CLASS_IDS.map((c) => (
            <button key={c} role="radio" aria-checked={c === pick} className={`rb-vlobby-class${c === pick ? ' is-on' : ''}`} style={{ ['--c' as string]: CLASSES[c].colors.accent }} onClick={() => choose(c)}>
              <img src={iconPicture(kitOf(c)[0]!.icon)} alt="" draggable={false} />
              <span>{CLASSES[c].name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rb-rl-mid" aria-label="Your set up">
        <img className="rb-rl-doll" src={doll} alt={CLASSES[pick].name} draggable={false} />
        <SetupEditor key={pick} cls={pick} sets={sets} onSets={putSets} />
      </section>

      <section className="rb-rl-right">
        {roomOpen ? (
          <RoomPanel view={view} state={linkState} err={roomErr} ready={ready} codeIn={codeIn} setCodeIn={setCodeIn} onOpen={() => void openRoom()} onJoin={joinRoom} onLeave={leaveRoom} send={(a) => linkRef.current?.send(a)} myPick={myPick} />
        ) : (
          <>
            {format > 1 && (
              <>
                <h3>At your side</h3>
                <div className="rb-rl-mates">
                  {mates.slice(0, format - 1).map((x, i) => (
                    <span key={i} className="rb-rl-mate">
                      <select
                        aria-label={`Teammate ${i + 1}`}
                        value={x.cls}
                        onChange={(e) => {
                          const list = [...mates];
                          list[i] = { cls: e.target.value as ClassId, preset: 0 };
                          setMates(list);
                        }}
                      >
                        {CLASS_IDS.map((c) => (
                          <option key={c} value={c}>
                            {CLASSES[c].name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Teammate ${i + 1}'s bar`}
                        value={x.preset}
                        onChange={(e) => {
                          const list = [...mates];
                          list[i] = { cls: x.cls, preset: Number(e.target.value) };
                          setMates(list);
                        }}
                      >
                        {PRESETS[x.cls].map((p, n) => (
                          <option key={p.id} value={n}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  ))}
                </div>
                <div className="rb-rl-comps">
                  {COMPS[format]
                    .filter((c) => c.team.some((t) => t.cls === pick))
                    .map((c) => (
                      <button
                        key={c.name}
                        title={c.blurb}
                        className="rb-rl-comp"
                        onClick={() => {
                          const rest = [...c.team];
                          rest.splice(
                            rest.findIndex((t) => t.cls === pick),
                            1,
                          );
                          setMates(rest);
                        }}
                      >
                        <b>{c.name}</b>
                        <small>{c.blurb}</small>
                      </button>
                    ))}
                </div>
              </>
            )}
            <h3>The ground</h3>
            <div className="rb-rl-maps">
              <button className={`rb-rl-map${map === 'random' ? ' is-on' : ''}`} onClick={() => setMap('random')}>
                Any
              </button>
              {MAP_IDS.map((id) => (
                <button key={id} title={MAPS[id]!.blurb} className={`rb-rl-map${map === id ? ' is-on' : ''}`} style={{ ['--c' as string]: MAPS[id]!.color }} onClick={() => setMap(id)}>
                  {MAPS[id]!.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="rb-rl-foot">
        {roomOpen ? (
          <span className="rb-dim">Friendly: no rating changes hands.</span>
        ) : (
          <>
            <button className="rb-btn is-big is-gold" disabled={!ready} onClick={enter}>
              {ready ? `Enter the Ring (${format}v${format})` : `Choose ${SLOTS - bar.length} more`}
            </button>
            <button className="rb-btn is-ghost" onClick={() => setRoomOpen(true)}>
              With friends
            </button>
          </>
        )}
      </footer>

      {result && (
        <div className="rb-vigil-modal is-over" role="dialog" aria-label="Match result">
          <h2 className={result.r.won ? '' : 'is-defeat'}>{result.r.draw ? 'A draw' : result.r.won ? 'Victory' : 'Defeat'}</h2>
          {result.solo && !result.r.draw && (
            <p className={`rb-rl-change ${result.change >= 0 ? 'is-up' : 'is-down'}`}>
              {result.change >= 0 ? '+' : ''}
              {result.change} rating
            </p>
          )}
          {result.rankUp && <p className="rb-vigil-opened">You are now {result.rankUp}</p>}
          <table className="rb-rl-score">
            <thead>
              <tr>
                <th />
                <th>Damage</th>
                <th>Healing</th>
                <th>Held</th>
                <th>Cut off</th>
              </tr>
            </thead>
            <tbody>
              {result.r.match.fighters.map((f) => (
                <tr key={f.id} className={f.team === result.r.match.fighters[result.solo ? 0 : Math.max(0, result.r.match.fighters.findIndex((x) => x.seat === view?.you))]?.team ? 'is-mine' : 'is-foe'}>
                  <td style={{ color: CLASSES[f.cls].colors.accent }}>{f.name}</td>
                  <td>{f.score.dmg}</td>
                  <td>{f.score.heal}</td>
                  <td>{Math.round(f.score.cc)}s</td>
                  <td>{f.score.kicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rb-vigil-actions">
            {result.solo ? (
              <button className="rb-btn is-gold is-big" onClick={enter}>
                Again
              </button>
            ) : (
              <button className="rb-btn is-gold is-big" onClick={() => setResult(null)}>
                Back to the room
              </button>
            )}
            <button className="rb-btn is-ghost" onClick={() => setResult(null)}>
              Change my bar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomPanel({ view, state, err, ready, codeIn, setCodeIn, onOpen, onJoin, onLeave, send, myPick }: { view: RoomView | null; state: LinkState | 'none'; err: string; ready: boolean; codeIn: string; setCodeIn: (s: string) => void; onOpen: () => void; onJoin: () => void; onLeave: () => void; send: (a: RoomAction) => void; myPick: RoomPick }) {
  if (!view) {
    return (
      <div className="rb-rl-room">
        <h3>With friends</h3>
        <p className="rb-dim">Open a private room and share the code. Up to six of you, on two sides. The computer takes any place left empty.</p>
        <button className="rb-btn is-gold" onClick={onOpen} disabled={state === 'connecting'}>
          {state === 'connecting' ? 'Connecting…' : 'Open a room'}
        </button>
        <div className="rb-rl-join">
          <input value={codeIn} onChange={(e) => setCodeIn(e.target.value)} placeholder="Room code" aria-label="Room code" maxLength={8} />
          <button className="rb-btn is-ghost" onClick={onJoin} disabled={!codeIn.trim()}>
            Join
          </button>
        </div>
        {err && <p className="rb-notice">{err}</p>}
      </div>
    );
  }
  const host = view.host === view.you;
  const team = (t: 0 | 1): RoomView['seats'] => view.seats.filter((s) => s.pick?.team === t);
  return (
    <div className="rb-rl-room">
      <h3>
        Room <b className="rb-rl-code">{view.code}</b>
      </h3>
      {state === 'reconnecting' && <p className="rb-notice">Reconnecting…</p>}
      {host ? (
        <div className="rb-rl-roomsetup">
          <select aria-label="Format" value={view.format} onChange={(e) => send({ t: 'setup', format: Number(e.target.value), map: view.map })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}v{f}
              </option>
            ))}
          </select>
          <select aria-label="Ground" value={view.map} onChange={(e) => send({ t: 'setup', format: view.format, map: e.target.value })}>
            {MAP_IDS.map((id) => (
              <option key={id} value={id}>
                {MAPS[id]!.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="rb-dim">
          {view.format}v{view.format} on {MAPS[view.map]?.name}
        </p>
      )}
      <div className="rb-rl-sides">
        {([0, 1] as const).map((t) => (
          <div key={t} className={`rb-rl-side is-t${t}`}>
            <h4>{t === 0 ? 'Blue' : 'Red'}</h4>
            {team(t).map((s) => (
              <span key={s.n} className={s.online ? '' : 'is-away'}>
                <b style={{ color: CLASSES[s.pick!.cls as ClassId]?.colors.accent }}>{s.name}</b>
                <small>{CLASSES[s.pick!.cls as ClassId]?.name}</small>
              </span>
            ))}
            {Array.from({ length: Math.max(0, view.format - team(t).length) }, (_, i) => (
              <span key={`e${i}`} className="is-empty">
                <small>Computer</small>
              </span>
            ))}
            {myPick.team !== t && team(t).length < view.format && (
              <button className="rb-btn is-small is-ghost" onClick={() => send({ t: 'pick', pick: { ...myPick, team: t } })}>
                Switch here
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="rb-vigil-actions">
        {host && (
          <button className="rb-btn is-gold" disabled={!ready || !view.seats.find((s) => s.you)?.pick} onClick={() => send({ t: 'start' })}>
            Open the gates
          </button>
        )}
        <button className="rb-btn is-ghost" onClick={onLeave}>
          Leave the room
        </button>
      </div>
      {err && <p className="rb-notice">{err}</p>}
    </div>
  );
}
