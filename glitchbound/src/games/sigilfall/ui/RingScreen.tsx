import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { ABILITIES, kitOf, PRESETS, SLOTS } from '../arena/abilities';
import { afterMatch, COMPS, drawOpponents, namedApart, nameFor, ratingChange, readRing, setsOf, skillAt, standingOf, writeRing, type ClassSets, type Comp, type RingSave } from '../arena/ladder';
import { MAP_IDS, MAPS } from '../arena/maps';
import { FORMATS, nextRank, rankOf, type Format } from '../arena/ranks';
import type { FighterSetup, MatchSetup } from '../arena/sim';
import { CLASS_IDS, CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { Link, type LinkState } from '../net/link';
import type { Action as RoomAction, Pick as RoomPick, View as RoomView } from '../net/ringRoom';
import { newCharacter, type Face } from '../progress/character';
import { iconPicture } from '../render/art/gameIcons';
import { heldWeapon, heroDollUrl, heroLook } from '../render/sprites';
import { RingMatch, type MatchResult, type MatchStakes, type RingInbox } from './RingMatch';
import { RingResult, type RatingOutcome } from './RingResult';
import { BarRow, RingHelp, SetupChips, SetupEditor } from './RingSetup';
import { ScreenGate } from './ScreenGate';

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
  gloamknight: [{ cls: 'priest', preset: 0 }, { cls: 'mage', preset: 0 }],
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
  return { setup: { seed: v.runSeed, map: MAPS[v.map] ? v.map : 'sands', fighters: namedApart(fighters) }, mine: fighters.findIndex((f) => f.seat === v.you) };
}

type Page = 'play' | 'setup' | 'friends';

function ClassRow({ pick, onPick }: { pick: ClassId; onPick: (c: ClassId) => void }) {
  return (
    <div className="rb-rp-classes" role="radiogroup" aria-label="Class">
      {CLASS_IDS.map((c) => (
        <button key={c} role="radio" aria-checked={c === pick} aria-label={CLASSES[c].name} title={CLASSES[c].name} className={`rb-rp-class${c === pick ? ' is-on' : ''}`} style={{ ['--c' as string]: CLASSES[c].colors.accent }} onClick={() => onPick(c)}>
          <img src={iconPicture(kitOf(c)[0]!.icon)} alt="" draggable={false} />
        </button>
      ))}
    </div>
  );
}

/**
 * The Ring, as three plain pages: Play (who, what kind of fight, go), Setup (what you bring), and With friends. A
 * match and its result lie beyond them, and every page has one way back.
 */
export function RingScreen({ engine, face, body, cls, name, onBack }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; cls?: ClassId; name?: string; onBack: () => void }) {
  const [save, setSave] = useState<RingSave>(readRing);
  const latest = useRef(save);
  const commit = (fn: (s: RingSave) => RingSave): void => {
    const next = fn(latest.current);
    latest.current = next;
    setSave(next);
    writeRing(next);
  };
  const [page, setPage] = useState<Page>('play');
  const [setupFrom, setSetupFrom] = useState<Page>('play');
  const [format, setFormat] = useState<Format>(1);
  const [pick, setPick] = useState<ClassId>(cls ?? 'warrior');
  const [mates, setMates] = useState<Mate[]>(() => DEFAULT_MATES[cls ?? 'warrior']);
  const [map, setMap] = useState<string>('random');
  const [help, setHelp] = useState(false);
  const [fight, setFight] = useState<{ setup: MatchSetup; rival: Comp; skill: number; rivalRating: number; stakes: MatchStakes; format: Format } | null>(null);
  const [roomFight, setRoomFight] = useState<{ setup: MatchSetup; mine: number; host: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ r: MatchResult; rating: RatingOutcome | null; rival?: string; solo: boolean } | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [linkState, setLinkState] = useState<LinkState | 'none'>('none');
  const [roomErr, setRoomErr] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const linkRef = useRef<Link<RoomView, RoomAction> | null>(null);
  const inbox = useRef<RingInbox | null>(null);
  useEffect(() => () => linkRef.current?.close(), []);

  const hero = name ?? 'You';
  const standing = standingOf(save, format);
  const rank = rankOf(standing.best);
  const next = nextRank(standing.best);
  const doll = useMemo(() => heroDollUrl(heroLook(pick, newCharacter(pick, 'Ring', 'ring').equip, {}, body ?? 'm', face), 'down', 5, heldWeapon(pick, newCharacter(pick, 'Ring', 'ring').equip.weapon), pick === 'warrior' || pick === 'paladin'), [pick, body, face]);
  const sets = setsOf(save, pick);
  const setup = sets.list[sets.active]!;
  const { bar, oath, talents } = setup;
  const ready = bar.length === SLOTS;
  const choose = (c: ClassId): void => {
    setPick(c);
    setMates(DEFAULT_MATES[c]);
  };
  const putSets = (s: ClassSets): void => commit((now) => ({ ...now, sets: { ...now.sets, [pick]: s } }));
  const openSetup = (from: Page): void => {
    setSetupFrom(from);
    setPage('setup');
  };

  const enter = (): void => {
    if (!ready) {
      openSetup('play');
      return;
    }
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const { comp, fighters } = drawOpponents(format, seed);
    const team: FighterSetup[] = [{ team: 0, cls: pick, name: hero, bar, oath, talents, human: true }, ...mates.slice(0, format - 1).map((x, i) => ({ team: 0 as const, cls: x.cls, name: nameFor(x.cls, seed + i + 11), bar: PRESETS[x.cls][x.preset]!.bar, talents: PRESETS[x.cls][x.preset]!.talents, oath: 'will' }))];
    // the other side's rating lands a little either way of yours
    const rivalRating = Math.max(800, standing.rating + (seed % 121) - 60);
    setResult(null);
    setPage('play');
    setRun((r) => r + 1);
    setFight({
      setup: { seed, map: map === 'random' ? MAP_IDS[seed % MAP_IDS.length]! : map, fighters: namedApart([...team, ...fighters]) },
      rival: comp,
      skill: skillAt(rivalRating),
      rivalRating,
      format,
      stakes: { format, rating: standing.rating, rank: rankOf(standing.best).name, color: rankOf(standing.best).color, win: ratingChange(standing.rating, rivalRating, true), lose: -ratingChange(standing.rating, rivalRating, false), rival: comp.name, blurb: comp.blurb, rivalRating },
    });
  };

  /* -------------------------------------------------- the room */
  const myPick = useMemo((): RoomPick => ({ team: view?.seats.find((s) => s.you)?.pick?.team ?? 0, cls: pick, bar, oath, talents }), [view, pick, bar, oath, talents]);
  const runSeen = useRef(0);
  const handlers = {
    onView: (v: RoomView) => {
      // a code from another game's room: it can't be played here
      if (v.game !== 'sigilfall-ring') {
        linkRef.current?.close();
        linkRef.current = null;
        setView(null);
        setLinkState('none');
        setRoomErr('That code is for a different game’s room.');
        return;
      }
      setView(v);
      if (v.phase === 'lobby') {
        setRoomFight((f) => (f ? null : f));
      } else if (v.run !== runSeen.current) {
        // the host said go
        runSeen.current = v.run;
        const { setup: s, mine } = setupFromRoom(v);
        if (mine >= 0) {
          setResult(null);
          setRun((r) => r + 1);
          setRoomFight({ setup: s, mine, host: v.host === v.you });
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
    setLinkState('connecting');
    try {
      linkRef.current = await Link.create<RoomView, RoomAction>(hero, handlers, 'sigilfall-ring');
    } catch (e) {
      setLinkState('none');
      setRoomErr(e instanceof Error ? e.message : 'Could not open a room.');
    }
  };
  const joinRoom = (): void => {
    const code = codeIn.trim().toUpperCase();
    if (!code) return;
    setRoomErr('');
    setLinkState('connecting');
    linkRef.current = new Link<RoomView, RoomAction>(code, hero, handlers);
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

  /* -------------------------------------------------- back, one level at a time */
  const back = (): void => {
    if (page === 'setup') setPage(setupFrom);
    else if (page === 'friends') {
      if (view) leaveRoom();
      setRoomErr('');
      setPage('play');
    } else onBack();
  };

  if (fight) {
    const settle = (won: boolean): RatingOutcome => {
      const was = standingOf(latest.current, fight.format);
      const out = afterMatch(was, fight.rivalRating, won);
      commit((now) => ({ ...now, standings: { ...now.standings, [fight.format]: out.next } }));
      return { before: was.rating, after: out.next.rating, bestBefore: was.best, bestAfter: out.next.best, rankUp: out.rankUp, streak: out.next.streak };
    };
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
        stakes={fight.stakes}
        onSets={putSets}
        onLeave={(started) => {
          if (started) settle(false);
          setFight(null);
        }}
        onDone={(r) => {
          const was = standingOf(latest.current, fight.format);
          const rating: RatingOutcome = r.draw ? { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: 0 } : settle(r.won);
          if (rating.rankUp) engine.sound.play('levelup');
          setResult({ r, rating, rival: fight.rival.name, solo: true });
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
        stakes={null}
        onSets={putSets}
        onLeave={() => {
          if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
        onDone={(r) => {
          setResult({ r, rating: null, solo: false });
          if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
      />
    );
  }
  if (result) {
    return (
      <RingResult
        match={result.r.match}
        myId={result.r.myId}
        won={result.r.won}
        draw={result.r.draw}
        rating={result.rating}
        rival={result.rival}
        dolls={result.r.dolls}
        againLabel={result.solo ? 'Fight again' : 'Back to the room'}
        onAgain={() => {
          if (result.solo) enter();
          else {
            setResult(null);
            setPage('friends');
          }
        }}
        onSetup={() => {
          setResult(null);
          openSetup(result.solo ? 'play' : 'friends');
        }}
        onExit={() => {
          setResult(null);
          if (!result.solo) leaveRoom();
          setPage('play');
        }}
      />
    );
  }

  const title = page === 'setup' ? 'Your setup' : page === 'friends' ? 'With friends' : 'The Ring';
  const sub = page === 'setup' ? `${CLASSES[pick].name}. Saved as you go.` : page === 'friends' ? 'A private room. Friendly matches don’t change your rating.' : 'Pick your hero and your fight. Use the stone.';
  return (
    <ScreenGate label="Opening the Ring">
      <div className="rb-ringlobby" style={{ ['--cls' as string]: CLASSES[pick].colors.accent, ['--r' as string]: rank.color }}>
        <header className="rb-rp-head">
          <button className="rb-iconbtn" onClick={back} aria-label={page === 'play' ? 'Back to your heroes' : 'Back'}>
            ←
          </button>
          <div className="rb-rp-title">
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
          {page !== 'play' && (
            <button className="rb-btn is-small rb-rp-back" onClick={back}>
              {page === 'setup' ? 'Done' : view ? 'Leave room' : 'Back to the ladder'}
            </button>
          )}
          <button className="rb-iconbtn" onClick={() => setHelp(true)} aria-label="How The Ring works" title="How The Ring works">
            ?
          </button>
          <GameMenuButton className="rb-iconbtn" />
        </header>

        {page === 'play' && (
          <div className="rb-rp-play">
            <section className="rb-rp-hero" aria-label="Your hero">
              <div className="rb-rp-stage">
                <i className="rb-rp-dais" aria-hidden="true" />
                <img key={pick} className="rb-rp-doll" src={doll} alt={CLASSES[pick].name} draggable={false} />
                <div className="rb-rp-who">
                  <strong>{CLASSES[pick].name}</strong>
                  <small>{hero}</small>
                </div>
              </div>
              <ClassRow pick={pick} onPick={choose} />
              <div className="rb-rp-setup">
                <div className="rb-rp-setup-head">
                  <h3>Setup {sets.active + 1}</h3>
                  <button className="rb-btn is-small" onClick={() => openSetup('play')}>
                    Change abilities & talents
                  </button>
                </div>
                <BarRow bar={bar} />
                <SetupChips cls={pick} setup={setup} />
                {!ready && <p className="rb-rp-warn">Your bar needs {SLOTS - bar.length} more.</p>}
              </div>
            </section>

            <section className="rb-rp-fight" aria-label="Your fight">
              <div className="rb-rp-formats" role="radiogroup" aria-label="Format">
                {FORMATS.map((f) => {
                  const st = standingOf(save, f);
                  const r = rankOf(st.best);
                  return (
                    <button key={f} role="radio" aria-checked={f === format} className={`rb-rp-format${f === format ? ' is-on' : ''}`} style={{ ['--r' as string]: r.color }} onClick={() => setFormat(f)}>
                      <strong>
                        {f}v{f}
                      </strong>
                      <b>{st.rating}</b>
                      <small>{r.name}</small>
                    </button>
                  );
                })}
              </div>

              <div className="rb-rp-rank">
                <span>
                  <b>{rank.name}</b> · {standing.wins} wins, {standing.losses} losses
                  {standing.streak >= 2 ? ` · ${standing.streak} in a row` : ''}
                </span>
                {next && (
                  <span className="rb-rp-next">
                    <i style={{ width: `${Math.max(0, Math.min(100, ((standing.best - rank.at) / (next.at - rank.at)) * 100))}%` }} />
                    <small>
                      {next.name} at {next.at}
                    </small>
                  </span>
                )}
              </div>

              {format > 1 && (
                <div className="rb-rp-block">
                  <h3>Your {format === 2 ? 'teammate' : 'teammates'}</h3>
                  <div className="rb-rp-mates">
                    {mates.slice(0, format - 1).map((x, i) => (
                      <span key={i} className="rb-rp-mate" style={{ ['--c' as string]: CLASSES[x.cls].colors.accent }}>
                        <img src={iconPicture(kitOf(x.cls)[0]!.icon)} alt="" draggable={false} />
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
                          aria-label={`Teammate ${i + 1}'s build`}
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
                  {COMPS[format].some((c) => c.team.some((t) => t.cls === pick)) && (
                    <div className="rb-rp-comps">
                      <small>Teams that work:</small>
                      {COMPS[format]
                        .filter((c) => c.team.some((t) => t.cls === pick))
                        .map((c) => (
                          <button
                            key={c.name}
                            title={c.blurb}
                            className="rb-rs-build"
                            onClick={() => {
                              const rest = [...c.team];
                              rest.splice(
                                rest.findIndex((t) => t.cls === pick),
                                1,
                              );
                              setMates(rest);
                            }}
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rb-rp-block">
                <h3>Arena</h3>
                <div className="rb-rp-maps" role="radiogroup" aria-label="Arena">
                  <button role="radio" aria-checked={map === 'random'} className={`rb-rp-map${map === 'random' ? ' is-on' : ''}`} onClick={() => setMap('random')}>
                    <strong>Any</strong>
                    <small>A surprise</small>
                  </button>
                  {MAP_IDS.map((id) => (
                    <button key={id} role="radio" aria-checked={map === id} title={MAPS[id]!.blurb} className={`rb-rp-map${map === id ? ' is-on' : ''}`} style={{ ['--c' as string]: MAPS[id]!.color }} onClick={() => setMap(id)}>
                      <strong>{MAPS[id]!.name}</strong>
                      <small>{MAPS[id]!.blurb}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rb-rp-go">
                <button className="rb-btn is-gold is-big" onClick={enter}>
                  {ready ? `Find a ${format}v${format} match` : `Choose ${SLOTS - bar.length} more abilities`}
                </button>
                <button className="rb-btn" onClick={() => setPage('friends')}>
                  With friends
                </button>
              </div>
            </section>
          </div>
        )}

        {page === 'setup' && (
          <div className="rb-rp-setuppage">
            <SetupEditor key={pick} cls={pick} sets={sets} onSets={putSets} />
          </div>
        )}

        {page === 'friends' && <FriendsPage view={view} state={linkState} err={roomErr} ready={ready} codeIn={codeIn} setCodeIn={setCodeIn} onOpen={() => void openRoom()} onJoin={joinRoom} send={(a) => linkRef.current?.send(a)} myPick={myPick} pick={pick} onPick={choose} onSetup={() => openSetup('friends')} bar={bar} />}

        {help && <RingHelp onClose={() => setHelp(false)} />}
      </div>
    </ScreenGate>
  );
}

function FriendsPage({ view, state, err, ready, codeIn, setCodeIn, onOpen, onJoin, send, myPick, pick, onPick, onSetup, bar }: { view: RoomView | null; state: LinkState | 'none'; err: string; ready: boolean; codeIn: string; setCodeIn: (s: string) => void; onOpen: () => void; onJoin: () => void; send: (a: RoomAction) => void; myPick: RoomPick; pick: ClassId; onPick: (c: ClassId) => void; onSetup: () => void; bar: string[] }) {
  const [copied, setCopied] = useState(false);
  if (!view) {
    return (
      <div className="rb-rp-friends">
        <div className="rb-rp-doors">
          <section className="rb-rp-door">
            <h3>Start a room</h3>
            <p>You get a code to share. Up to six players on two teams, and the computer fills any empty place.</p>
            <button className="rb-btn is-gold is-big" onClick={onOpen} disabled={state === 'connecting'}>
              {state === 'connecting' ? 'Connecting…' : 'Open a room'}
            </button>
          </section>
          <section className="rb-rp-door">
            <h3>Join a friend</h3>
            <p>Got a code from a friend? Type it here.</p>
            <form
              className="rb-rp-join"
              onSubmit={(e) => {
                e.preventDefault();
                onJoin();
              }}
            >
              <input value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} placeholder="CODE" aria-label="Room code" maxLength={8} autoComplete="off" spellCheck={false} />
              <button type="submit" className="rb-btn" disabled={!codeIn.trim() || state === 'connecting'}>
                Join
              </button>
            </form>
          </section>
        </div>
        {err && (
          <p className="rb-rp-error" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  }
  const host = view.host === view.you;
  const team = (t: 0 | 1): RoomView['seats'] => view.seats.filter((s) => s.pick?.team === t);
  const seated = !!view.seats.find((s) => s.you)?.pick;
  return (
    <div className="rb-rp-friends is-room">
      <section className="rb-rp-roomside">
        <div className="rb-rp-code">
          <small>Share this code</small>
          <strong>{view.code}</strong>
          <button
            className="rb-btn is-small"
            onClick={() => {
              void navigator.clipboard?.writeText(view.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
        {state === 'reconnecting' && <p className="rb-rp-error">Reconnecting…</p>}
        <div className="rb-rp-block">
          <h3>You bring</h3>
          <ClassRow pick={pick} onPick={onPick} />
          <BarRow bar={bar} />
          <button className="rb-btn is-small" onClick={onSetup}>
            Change abilities & talents
          </button>
        </div>
      </section>
      <section className="rb-rp-roommain">
        {host ? (
          <div className="rb-rp-roomsetup">
            <label>
              <small>Format</small>
              <select value={view.format} onChange={(e) => send({ t: 'setup', format: Number(e.target.value), map: view.map })}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}v{f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <small>Arena</small>
              <select value={view.map} onChange={(e) => send({ t: 'setup', format: view.format, map: e.target.value })}>
                {MAP_IDS.map((id) => (
                  <option key={id} value={id}>
                    {MAPS[id]!.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="rb-rp-roomnote">
            {view.format}v{view.format} on {MAPS[view.map]?.name}. The host chooses.
          </p>
        )}
        <div className="rb-rp-sides">
          {([0, 1] as const).map((t) => (
            <div key={t} className={`rb-rp-side is-t${t}`}>
              <h4>{t === 0 ? 'Blue team' : 'Red team'}</h4>
              {team(t).map((s) => (
                <span key={s.n} className={`rb-rp-seat${s.online ? '' : ' is-away'}${s.you ? ' is-you' : ''}`}>
                  <b style={{ color: CLASSES[s.pick!.cls as ClassId]?.colors.accent }}>
                    {s.name}
                    {s.you ? ' (you)' : ''}
                  </b>
                  <small>
                    {CLASSES[s.pick!.cls as ClassId]?.name}
                    {s.host ? ' · host' : ''}
                  </small>
                </span>
              ))}
              {Array.from({ length: Math.max(0, view.format - team(t).length) }, (_, i) => (
                <span key={`e${i}`} className="rb-rp-seat is-empty">
                  <small>Computer, unless someone joins</small>
                </span>
              ))}
              {myPick.team !== t && team(t).length < view.format && (
                <button className="rb-btn is-small" onClick={() => send({ t: 'pick', pick: { ...myPick, team: t } })}>
                  Move here
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="rb-rp-go">
          {host ? (
            <button className="rb-btn is-gold is-big" disabled={!ready || !seated} onClick={() => send({ t: 'start' })}>
              {ready ? 'Start the match' : `Choose ${SLOTS - bar.length} more abilities`}
            </button>
          ) : (
            <span className="rb-rp-waiting">Waiting for the host to start</span>
          )}
        </div>
        {err && (
          <p className="rb-rp-error" role="alert">
            {err}
          </p>
        )}
      </section>
    </div>
  );
}
