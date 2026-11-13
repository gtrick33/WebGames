import { useEffect, useMemo, useRef, useState } from 'react';
import type { SigilEngine } from '../engine';
import { wornLooks } from '../progress/wardrobe';
import { Doll } from './Doll';
import { classEmblem } from './classEmblem';
import { wearOf, WearPicker } from './wear';
import { LooksDialog, plainWorn, ringTitle } from './RingRewards';
import { readRing, writeRing } from '../arena/ladder';
import { Titled } from './Titled';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASSES, CLASS_IDS } from '../data/classes';
import { useAccount } from '../../../platform/account';
import { classOpen } from '../progress/paidClasses';
import type { ClassId } from '../data/types';
import type { LinkState } from '../net/link';
import type { Action as RoomAction, View as RoomView } from '../net/vigilRoom';
import { newCharacter, type Face } from '../progress/character';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { heldWeapon, heroDollUrl, heroLook, portraitUrl } from '../render/sprites';
import { readBests } from '../vigil/bests';
import { CLASS_BODY, mapOpen, partyScale, spellsOf, UNLOCK_HOLD, VIGIL_MAPS, type VigilMap } from '../vigil/kit';
import { ScreenGate } from './ScreenGate';

export { readBests, saveBest } from '../vigil/bests';

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** A land's champion, as a picture for its card. */
function championUrl(sprite: string): string {
  return portraitUrl('creature', sprite, 4);
}

export interface VigilRoomControls {
  view: RoomView | null;
  state: LinkState | 'none';
  err: string;
  open: () => void;
  join: (code: string) => void;
  leave: () => void;
  send: (a: RoomAction) => void;
}

const SEATS = 4;
const times = (n: number): string => `×${(Math.round(n * 10) / 10).toFixed(1)}`;

/** Who is in the party, how hard that makes the night, and where it will be. */
function PartyPanel({ room, pick, body, face, land, lands, onLand }: { room: VigilRoomControls; pick: ClassId; body?: 'm' | 'f'; face?: Face; land: VigilMap; lands: VigilMap[]; onLand: (m: VigilMap) => void }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const { view, state, err, send } = room;
  // our choices go to the room as they change
  const said = useRef('');
  useEffect(() => {
    if (!view || view.phase !== 'lobby') return;
    const line = JSON.stringify({ cls: pick, body: body ?? 'm', face: face ?? null });
    if (line === said.current) return;
    said.current = line;
    send({ t: 'pick', pick: { cls: pick, body: body ?? 'm', face: face ?? null } });
  }, [view, pick, body, face, send]);
  // a new room starts in the land its host had chosen
  const hostSaid = useRef(false);
  useEffect(() => {
    if (!view || view.host !== view.you || hostSaid.current) return;
    hostSaid.current = true;
    if (view.map !== land.id) send({ t: 'land', map: land.id });
  }, [view, land, send]);

  if (!view) {
    return (
      <section className="rb-vparty" aria-label="With friends">
        <div className="rb-vparty-door">
          <h3>Start a party</h3>
          <p>You get a code to share. Up to four heroes keep the watch together, and the night gets harder with each one.</p>
          <button className="rb-btn is-gold" onClick={room.open} disabled={state === 'connecting'}>
            {state === 'connecting' ? 'Connecting…' : 'Open a party'}
          </button>
        </div>
        <div className="rb-vparty-door">
          <h3>Join a friend</h3>
          <p>Got a code from a friend? Type it here.</p>
          <form
            className="rb-rp-join"
            onSubmit={(e) => {
              e.preventDefault();
              room.join(code);
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" aria-label="Party code" maxLength={8} autoComplete="off" spellCheck={false} />
            <button type="submit" className="rb-btn" disabled={!code.trim() || state === 'connecting'}>
              Join
            </button>
          </form>
        </div>
        {err && (
          <p className="rb-rp-error" role="alert">
            {err}
          </p>
        )}
      </section>
    );
  }
  const host = view.host === view.you;
  const n = view.seats.length;
  const scale = partyScale(n);
  const shownLand = VIGIL_MAPS.find((m) => m.id === view.map) ?? VIGIL_MAPS[0]!;
  return (
    <section className="rb-vparty is-room" aria-label="Your party">
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
      <ul className="rb-vparty-seats">
        {Array.from({ length: SEATS }, (_, i) => {
          const s = view.seats[i];
          if (!s) {
            return (
              <li key={`open-${i}`} className="rb-vparty-seat is-open">
                <i aria-hidden="true">+</i>
                <span>Open seat</span>
              </li>
            );
          }
          const known = CLASS_IDS.includes(s.pick?.cls as ClassId) ? (s.pick!.cls as ClassId) : null;
          return (
            <li key={s.n} className={`rb-vparty-seat${s.you ? ' is-you' : ''}${s.online ? '' : ' is-away'}`} style={{ ['--c' as string]: known ? CLASSES[known].colors.accent : '#8a8a94' }}>
              {known ? <img src={classEmblem(known)} alt="" draggable={false} /> : <i aria-hidden="true">?</i>}
              <span>
                <b>{s.name}</b>
                <small>
                  {known ? CLASSES[known].name : 'Choosing…'}
                  {s.n === view.host ? ' · host' : ''}
                  {s.you ? ' · you' : ''}
                  {s.online ? '' : ' · away'}
                </small>
              </span>
              {host && !s.you && (
                <button className="rb-vparty-kick" onClick={() => send({ t: 'kick', n: s.n })} aria-label={`Remove ${s.name}`}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="rb-vparty-hard">
        {n > 1 ? (
          <p>
            <b>{n} heroes:</b> {times(scale.count)} the foes, each {times(scale.hp)} as tough and hitting {times(scale.dmg)} as hard.
          </p>
        ) : (
          <p>Every hero who joins brings more foes, and tougher ones.</p>
        )}
        <i className="rb-vparty-meter" aria-hidden="true">
          {Array.from({ length: SEATS }, (_, i) => (
            <u key={i} className={i < n ? 'is-on' : ''} />
          ))}
        </i>
      </div>
      <label className="rb-vparty-land">
        <small>Where</small>
        {host ? (
          <select
            value={view.map}
            onChange={(e) => {
              const m = lands.find((x) => x.id === e.target.value);
              if (!m) return;
              onLand(m);
              send({ t: 'land', map: m.id });
            }}
          >
            {lands.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <b>{shownLand.name}</b>
        )}
      </label>
    </section>
  );
}

/** Choosing who keeps the watch, and where: alone, or with friends. */
export function VigilLobby({ engine, face, body, cls, map, room, onBack, onBegin }: { engine?: SigilEngine; face?: Face; body?: 'm' | 'f'; cls: ClassId; map?: VigilMap; room: VigilRoomControls; onBack: () => void; onBegin: (cls: ClassId, map: VigilMap) => void }) {
  const { me } = useAccount();
  // a class from the shop can be played here once it's bought (progress/paidClasses.ts)
  const [pick, setPick] = useState<ClassId>(classOpen(cls, me) ? cls : 'warrior');
  const bests = useMemo(() => readBests(), []);
  const [land, setLand] = useState<VigilMap>(() => {
    if (map) return map;
    // the furthest land open
    let at = 0;
    VIGIL_MAPS.forEach((_, i) => {
      if (mapOpen(i, bests)) at = i;
    });
    return VIGIL_MAPS[at]!;
  });
  const [spell, setSpell] = useState(0);
  const [, setIcons] = useState(false);
  const [friends, setFriends] = useState(!!room.view);
  useEffect(() => {
    void iconsReady.then(setIcons);
  }, []);
  // (a campaign hero of the class, worn: their gear and their Wardrobe)
  const [wearN, setWearN] = useState(0);
  // (asked again whenever the game changes: a copy of the save from the account puts new heroes in place)
  const saved = engine?.getVersion() ?? 0;
  const wear = useMemo(() => (engine && wearN >= 0 && saved >= 0 ? wearOf(engine, pick) : null), [engine, pick, wearN, saved]);
  // (in plain clothes: the title and the armor earned in the Ring, kept with its standing)
  const [plain, setPlain] = useState(() => readRing().plain);
  const [looksOpen, setLooksOpen] = useState(false);
  const myTitle = ringTitle(wear, plain);
  const doll = useMemo(() => {
    const hero = newCharacter(pick, 'The Watch', 'vigil');
    if (wear) return heroDollUrl(heroLook(pick, wear.equip, wornLooks(wear), wear.body, wear.face), 'down', 6, heldWeapon(pick, wear.equip.weapon, wornLooks(wear).weapon), pick === 'warrior' || pick === 'paladin');
    return heroDollUrl(heroLook(pick, hero.equip, plainWorn(plain), body ?? 'm', face), 'down', 6, heldWeapon(pick, hero.equip.weapon), pick === 'warrior' || pick === 'paladin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, body, face, wear, plain, wearN]);
  const kit = spellsOf(pick);
  const shown = kit[spell] ?? kit[0]!;
  const c = CLASSES[pick];
  const stats = CLASS_BODY[pick];
  const openLands = VIGIL_MAPS.filter((_, i) => mapOpen(i, bests));
  const inRoom = room.view;
  const hosting = !!inRoom && inRoom.host === inRoom.you;
  const hostName = inRoom?.seats.find((s) => s.n === inRoom.host)?.name ?? 'the host';
  const shownLand = inRoom ? (VIGIL_MAPS.find((m) => m.id === inRoom.map) ?? land) : land;
  const closeFriends = (): void => {
    if (inRoom) room.leave();
    setFriends(false);
  };
  return (
    <ScreenGate label="Opening the Vigil">
      <div className="rb-vlobby" style={{ ['--land' as string]: shownLand.color, ['--cls' as string]: c.colors.accent }}>
        <header className="rb-vlobby-head">
          <button className="rb-iconbtn" onClick={friends ? closeFriends : onBack} aria-label="Back">
            ←
          </button>
          <div>
            <h2>The Vigil</h2>
            <p>{friends ? 'Up to four heroes, one night. More friends, more foes.' : 'Hold the line. It always breaks in the end. How long is up to you.'}</p>
          </div>
          {friends && (
            <button className="rb-btn is-small rb-rp-back" onClick={closeFriends}>
              {inRoom ? 'Leave party' : 'Back to the lands'}
            </button>
          )}
          <GameMenuButton className="rb-iconbtn" />
        </header>

        <section className="rb-vlobby-hero" aria-label="Your hero">
          <div className="rb-vlobby-classes" role="radiogroup" aria-label="Class">
            {CLASS_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={id === pick}
                className={`rb-vlobby-class${id === pick ? ' is-on' : ''}${classOpen(id, me) ? '' : ' is-locked'}`}
                style={{ ['--c' as string]: CLASSES[id].colors.accent }}
                aria-disabled={!classOpen(id, me)}
                title={classOpen(id, me) ? undefined : `${CLASSES[id].name}: unlock it in the shop`}
                onClick={() => {
                  if (!classOpen(id, me)) return;
                  setPick(id);
                  setSpell(0);
                }}
              >
                <img src={classEmblem(id)} alt="" draggable={false} />
                <span>{CLASSES[id].name}</span>
              </button>
            ))}
          </div>
          <div className="rb-vlobby-stage">
            <i className="rb-vlobby-dais" aria-hidden="true" />
            <Doll key={pick} className="rb-vlobby-doll" src={doll} alt={c.name} />
            <div className="rb-vlobby-name">
              <strong>{c.name}</strong>
              {(wear || myTitle) && <Titled className="rb-wear-who" name={wear ? wear.name : 'You'} title={myTitle} />}
              <small>
                {stats.hp} health · {stats.speed >= 84 ? 'quick on their feet' : stats.speed <= 74 ? 'heavy but sturdy' : 'steady'}
              </small>
            </div>
          </div>
          <div className="rb-vlobby-kit">
            {engine && (
              <div className="rb-rp-looks">
                <WearPicker engine={engine} cls={pick} onChange={() => setWearN((n) => n + 1)} />
                <button className="rb-btn is-small" onClick={() => setLooksOpen(true)}>
                  Title & armor
                </button>
              </div>
            )}
            <div className="rb-vlobby-spells">
              {kit.map((s, i) => (
                <button key={s.id} className={`rb-vlobby-spell${i === spell ? ' is-on' : ''}`} onClick={() => setSpell(i)} onMouseEnter={() => setSpell(i)} aria-label={s.name}>
                  <img src={iconPicture(s.icon)} alt="" draggable={false} />
                  {i === 0 && <em>First</em>}
                </button>
              ))}
            </div>
            <p className="rb-vlobby-about">
              <strong>{shown.name}</strong>
              {shown.text}
              {shown.evolve && (
                <span className="rb-vlobby-evolve">
                  <img src={iconPicture(shown.evolve.icon)} alt="" draggable={false} />
                  <span>
                    Evolves into <b>{shown.evolve.name}</b>. {shown.evolve.text}
                  </span>
                </span>
              )}
            </p>
          </div>
        </section>

        {friends ? (
          <PartyPanel room={room} pick={pick} body={body} face={face} land={land} lands={openLands} onLand={setLand} />
        ) : (
          <section className="rb-vlobby-lands" aria-label="Land">
            {VIGIL_MAPS.map((m, i) => {
              const open = mapOpen(i, bests);
              const best = bests[m.id] ?? 0;
              return (
                <button key={m.id} className={`rb-vlobby-land${m === land ? ' is-on' : ''}${open ? '' : ' is-locked'}`} style={{ ['--c' as string]: m.color }} disabled={!open} onClick={() => setLand(m)}>
                  <img src={championUrl(m.champions[0]!.sprite)} alt="" draggable={false} />
                  <span className="rb-vlobby-land-text">
                    <strong>{m.name}</strong>
                    {open ? (
                      <small>{m.blurb}</small>
                    ) : (
                      <small>
                        Hold {clock(UNLOCK_HOLD)} in {VIGIL_MAPS[i - 1]!.name} to open
                      </small>
                    )}
                  </span>
                  {open && best > 0 && <b className="rb-vlobby-best">{clock(best)}</b>}
                  {!open && (
                    <b className="rb-vlobby-lock" aria-hidden="true">
                      ⛓
                    </b>
                  )}
                </button>
              );
            })}
          </section>
        )}

        <footer className="rb-vlobby-foot">
          {!friends && (
            <>
              <button className="rb-btn is-gold is-big" onClick={() => onBegin(pick, land)} autoFocus>
                Keep the watch in {land.name}
              </button>
              <button className="rb-btn is-big" onClick={() => setFriends(true)}>
                With friends
              </button>
            </>
          )}
          {friends && hosting && (
            <button className="rb-btn is-gold is-big" onClick={() => room.send({ t: 'start' })}>
              {inRoom!.seats.length > 1 ? `Begin the night, ${inRoom!.seats.length} heroes` : 'Begin the night'}
            </button>
          )}
          {friends && inRoom && !hosting && <p className="rb-vparty-waiting">Waiting for {hostName} to begin the night…</p>}
        </footer>
        {looksOpen && engine && (
          <LooksDialog
            engine={engine}
            cls={pick}
            wear={wear}
            plain={plain}
            doll={doll}
            shown={<Titled name={wear ? wear.name : 'You'} title={myTitle} />}
            onPlain={(p) => {
              setPlain(p);
              writeRing({ ...readRing(), plain: p });
            }}
            onChange={() => setWearN((n) => n + 1)}
            onClose={() => setLooksOpen(false)}
          />
        )}
      </div>
    </ScreenGate>
  );
}
