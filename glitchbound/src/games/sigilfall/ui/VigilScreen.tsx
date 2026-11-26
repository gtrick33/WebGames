import { usePlayedMode } from './playedMode';
import { useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASS_IDS } from '../data/classes';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { Link, type LinkState } from '../net/link';
import type { Action as RoomAction, Pick as RoomPick, View as RoomView } from '../net/vigilRoom';
import { HAIRS, newCharacter, SKINS, type Face } from '../progress/character';
import { DEFAULT_SETTINGS } from '../progress/save';
import { iconPicture } from '../render/art/gameIcons';
import { Renderer } from '../render/renderer';
import { openBattlefield } from '../render/vigil';
import { keepOnLand, trunksOf, VigilPainter, type PartyLook } from '../render/vigil';
import { TILE } from '../sim/map';
import { World } from '../sim/world';
import { FIELD_ICONS, MAX_STRENGTH, SPELLS, STRENGTHS, UNLOCK_HOLD, upgradesOf, VIGIL_MAPS, type Element, type StrengthId, type VigilMap } from '../vigil/kit';
import { REGIONS } from '../data/regions';
import type { MusicId } from '../audio/sound';
import { readRing } from '../arena/ladder';
import { CARD_SECONDS, EVOLVE_AT, topLevel, Vigil, type Card, type Fx, type Hero, type VigilInput } from '../vigil/sim';
import { applySnap, SnapWriter, type Snap } from '../vigil/snapshot';
import { ScreenGate } from './ScreenGate';
import { Stick } from './Stick';
import { wearOf } from './wear';
import { readBests, saveBest, VigilLobby } from './VigilLobby';
import { part, say } from './hudWrite';
import { addToCodex, markVigilTaught, saveClassBest, vigilTaught } from '../vigil/bests';
import { cleanKit, EVENTS, GALE, galeAngle, inPhase, nearPhase, RULES, TIDE, TRAITS, type Weekly } from '../vigil/night';
import { bankNight, deedState, kitOf, readReturns, type Banked } from '../vigil/returns';
import { deedProgress, nextDeeds } from '../vigil/deeds';

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const spellIcon = (id: string, evolved = false): string => {
  const def = SPELLS[id]!;
  return iconPicture(evolved && def.evolve ? def.evolve.icon : def.icon);
};
const strengthIcon = (id: StrengthId): string => iconPicture(STRENGTHS[id].icon);
const upgradeOf = (c: Extract<Card, { kind: 'up' }>) => upgradesOf(SPELLS[c.id]!).find((u) => u.id === c.up);

const cardName = (c: Card): string => {
  if (c.kind === 'strength') return STRENGTHS[c.id].name;
  if (c.kind === 'up') return upgradeOf(c)?.name ?? SPELLS[c.id]!.name;
  return c.evolve ? SPELLS[c.id]!.evolve!.name : SPELLS[c.id]!.name;
};
const cardText = (c: Card): string => {
  if (c.kind === 'strength') return STRENGTHS[c.id].text;
  if (c.kind === 'up') return upgradeOf(c)?.text ?? '';
  return c.evolve ? SPELLS[c.id]!.evolve!.text : SPELLS[c.id]!.text;
};
const cardIcon = (c: Card): string => (c.kind === 'strength' ? strengthIcon(c.id) : spellIcon(c.id, c.kind === 'spell' && c.evolve));
const cardTag = (c: Card, cls?: ClassId): string => {
  if (c.kind === 'up') return SPELLS[c.id]!.name;
  // (a spell carried in from another class says so: vigil/night.ts's wild spells)
  if (c.kind === 'spell') return c.evolve ? 'Evolves' : cls && SPELLS[c.id]!.cls !== cls ? 'Wild spell' : SPELLS[c.id]!.kind === 'dash' ? 'New spell · on your dash' : 'New spell';
  return c.level === 1 ? 'New relic' : `Level ${c.level}`;
};
/** A relic that a spell you hold is waiting for. */
const evolvesWith = (h: Hero, c: Card): string | null => {
  if (c.kind !== 'strength') return null;
  for (const id of Object.keys(h.spells)) {
    const def = SPELLS[id];
    if (def?.evolve?.with === c.id && !h.evolved.has(id)) return `${def.name} evolves with ${EVOLVE_AT} of these`;
  }
  return null;
};

/** What this hero holds, along the foot of the screen. */
function Loadout({ h }: { h: Hero }) {
  const spells = Object.entries(h.spells);
  const strengths = Object.entries(h.strengths) as [StrengthId, number][];
  return (
    <div className="rb-vigil-loadout" aria-label="What you hold">
      {spells.map(([id, l]) => (
        <span key={id} className={`rb-vigil-slot${h.evolved.has(id) ? ' is-evolved' : ''}`} title={h.evolved.has(id) ? SPELLS[id]!.evolve?.name : SPELLS[id]!.name}>
          <img src={spellIcon(id, h.evolved.has(id))} alt={SPELLS[id]!.name} draggable={false} />
          <small>{l >= topLevel(SPELLS[id]!) ? 'MAX' : l}</small>
        </span>
      ))}
      {strengths.length > 0 && <i className="rb-vigil-gap" />}
      {strengths.map(([id, l]) => (
        <span key={id} className="rb-vigil-slot is-small" title={STRENGTHS[id].name}>
          <img src={strengthIcon(id)} alt={STRENGTHS[id].name} draggable={false} />
          <small>{l >= (STRENGTHS[id].max ?? MAX_STRENGTH) ? 'MAX' : l}</small>
        </span>
      ))}
    </div>
  );
}

/** What each element sounds like when it goes off. */
const EL_SOUND: Record<Element, string> = { fire: 'fireball', ice: 'freeze', lightning: 'zap', arcane: 'bolt', nature: 'nature', poison: 'drain', holy: 'holy', shadow: 'shadow', water: 'nova', blood: 'clash' };
/** What falls from the sky sounds like when it is called (its landing is a burst of its own). */
const CALL_SOUND: Partial<Record<Element, string>> = { fire: 'meteorCall', holy: 'holy', lightning: 'thunder', blood: 'windup' };

/**
 * The sound of an effect, how close together it may repeat (seconds) and how loud: by what it is and what it is made
 * of, so a warrior's night is steel and a mage's is fire and frost. Every one is a recording (audio/samples.ts).
 */
export function fxSound(kind: Fx['kind'], el: Element): [string, number, number] | undefined {
  switch (kind) {
    case 'hit':
      return [el === 'blood' ? 'clash' : 'hit', 0.12, 0.3];
    case 'burst':
      return [el === 'fire' ? 'explode' : EL_SOUND[el], 0.16, 0.5];
    case 'nova':
      return [el === 'blood' ? 'slam' : el === 'water' || el === 'arcane' ? 'nova' : EL_SOUND[el], 0.2, 0.65];
    case 'chain':
      return [EL_SOUND[el], 0.14, 0.55];
    case 'strike':
      return [CALL_SOUND[el] ?? 'rift', 0.3, 0.6];
    case 'drop':
      return [el === 'nature' ? 'arrowRain' : EL_SOUND[el], 0.5, 0.4];
    case 'cone':
      return [el === 'nature' ? 'swing' : 'swingBig', 0.12, 0.6];
    case 'beam':
      return [el === 'nature' ? 'bow' : el === 'holy' ? 'holy' : 'beam', 0.2, 0.55];
    case 'sweep':
      return [el === 'blood' || el === 'shadow' ? 'swingBig' : el === 'holy' ? 'holy' : 'beam', 0.3, 0.6];
    case 'heal':
      return ['heal', 0.3, 0.6];
    case 'guard':
      return ['shield', 0.3, 0.8];
    case 'dash':
      return ['dash', 0.1, 0.8];
    case 'level':
      return ['levelup', 0.3, 0.9];
    case 'frenzy':
      return ['warhorn', 0.3, 0.9];
    case 'summon':
      return ['summon', 0.3, 0.7];
    case 'slam':
      return ['slam', 0.2, 0.9];
    case 'bomb':
      return ['explode', 0.1, 1];
    default:
      return undefined;
  }
}

type Inbox = (seat: number, d: unknown) => void;
type Role = { kind: 'solo' } | { kind: 'host' | 'client'; send: (d: unknown) => void; listen: (fn: Inbox | null) => void };

interface Keeper extends PartyLook {
  id: number;
  cls: ClassId;
  name: string;
}

const roomErrors: Record<string, string> = { full: 'That party is full.', in_run: 'That party has already begun its night.' };

const knownClass = (c: string | undefined): ClassId => (CLASS_IDS.includes(c as ClassId) ? (c as ClassId) : 'mage');
/** Someone else's looks, kept to what the game can draw. */
const faceOf = (f: RoomPick['face']): Face | undefined => (f ? { skin: Math.max(0, Math.min(SKINS.length - 1, f.skin)), hair: Math.max(0, Math.min(HAIRS.length - 1, f.hair)), style: f.style === 'pony' || f.style === 'long' ? f.style : 'short', beard: !!f.beard } : undefined);

/** The Vigil: choosing a hero and a land, alone or with friends, then the night itself. */
export function VigilScreen({ engine, face, body, cls, name, onBack }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; cls?: ClassId; name?: string; onBack: () => void }) {
  usePlayedMode(engine, 'vigil');
  const [setup, setSetup] = useState<{ cls: ClassId; map: VigilMap; weekly?: Weekly } | null>(null);
  const [from, setFrom] = useState<{ cls: ClassId; map: VigilMap } | null>(null);
  const linkRef = useRef<Link<RoomView, RoomAction> | null>(null);
  const inbox = useRef<Inbox | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [linkState, setLinkState] = useState<LinkState | 'none'>('none');
  const [roomErr, setRoomErr] = useState('');
  useEffect(
    () => () => {
      const link = linkRef.current;
      link?.send({ t: 'bye' });
      link?.close();
    },
    [],
  );
  const handlers = {
    onView: (v: RoomView) => setView(v),
    onRelay: (seat: number, d: unknown) => inbox.current?.(seat, d),
    onState: (s: LinkState, why?: string) => {
      setLinkState(s);
      if (s === 'gone') {
        setView(null);
        setRoomErr(why ? (roomErrors[why] ?? why) : 'The party has closed.');
        linkRef.current = null;
      }
    },
    onError: (msg: string) => setRoomErr(roomErrors[msg] ?? ''),
  };
  const who = name?.trim() || 'A friend';
  const openRoom = async (): Promise<void> => {
    setRoomErr('');
    setLinkState('connecting');
    try {
      linkRef.current = await Link.create<RoomView, RoomAction>(who, handlers, 'sigilfall-vigil');
    } catch (e) {
      setLinkState('none');
      setRoomErr(e instanceof Error ? e.message : 'Could not open a party.');
    }
  };
  const joinRoom = (code: string): void => {
    if (!code.trim()) return;
    setRoomErr('');
    setLinkState('connecting');
    linkRef.current = new Link<RoomView, RoomAction>(code.trim().toUpperCase(), who, handlers);
  };
  const leaveRoom = (): void => {
    linkRef.current?.send({ t: 'bye' });
    linkRef.current?.close();
    linkRef.current = null;
    setView(null);
    setLinkState('none');
  };

  if (view?.phase === 'run') {
    const party: Keeper[] = view.seats.map((s) => ({ id: s.n, cls: knownClass(s.pick?.cls), name: s.name, face: faceOf(s.pick?.face ?? null), body: s.pick?.body }));
    const land = VIGIL_MAPS.find((m) => m.id === view.map) ?? VIGIL_MAPS[0]!;
    const hosting = view.host === view.you;
    const hostName = view.seats.find((s) => s.n === view.host)?.name ?? 'The host';
    return (
      <VigilRun
        key={view.run}
        engine={engine}
        land={land}
        party={party}
        meId={view.you}
        seed={view.runSeed}
        hostName={hostName}
        role={{
          kind: hosting ? 'host' : 'client',
          send: (d) => linkRef.current?.relay(d),
          listen: (fn) => {
            inbox.current = fn;
          },
        }}
        onBack={() => {
          // the host's game is the night, so leaving it ends it for everyone
          if (hosting) linkRef.current?.send({ t: 'end' });
          else leaveRoom();
        }}
      />
    );
  }
  if (setup) {
    const me: Keeper = { id: 0, cls: setup.cls, name: name?.trim() || 'You', face, body };
    return <VigilRun engine={engine} land={setup.map} party={[me]} meId={0} seed={0} hostName="" role={{ kind: 'solo' }} weekly={setup.weekly} onBack={() => setSetup(null)} />;
  }
  return (
    <VigilLobby
      engine={engine}
      face={face}
      body={body}
      cls={from?.cls ?? cls ?? 'mage'}
      map={from?.map}
      onBack={() => {
        leaveRoom();
        onBack();
      }}
      onBegin={(c, m, weekly) => {
        // (the week's watch is in a land of its own choosing: the lobby comes back to the land chosen before it)
        setFrom({ cls: c, map: weekly ? (from?.map ?? m) : m });
        setSetup({ cls: c, map: m, weekly });
      }}
      room={{ view, state: linkState, err: roomErr, open: () => void openRoom(), join: joinRoom, leave: leaveRoom, send: (a) => linkRef.current?.send(a) }}
    />
  );
}

/**
 * Sigilfall: The Vigil. Hold the line against the Ashen Host for as long as you can. Everything is drawn by the game's
 * own renderer on the real land, thinned out for a fight: what walks behind a tree goes behind it, and neither the
 * hero nor the Host can walk through its trunk.
 */
function VigilRun({ engine, land, party, meId, seed, hostName, role, weekly, onBack }: { engine: SigilEngine; land: VigilMap; party: Keeper[]; meId: number; seed: number; hostName: string; role: Role; weekly?: Weekly; onBack: () => void }) {
  // the rules this night plays by: the land's own, and in the week's watch an omen borrowed from another land
  const rules = weekly?.rules ?? [land.rule];
  const solo = role.kind === 'solo';
  const boxRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [, tick] = useState(0);
  const [view, setView] = useState<Vigil | null>(null);
  const [best, setBest] = useState(() => readBests()[land.id] ?? 0);
  const [opened, setOpened] = useState<string | null>(null);
  const [landIn, setLandIn] = useState(false);
  // the first night on this device opens with how it is played, the night held until it is read
  const [teach, setTeach] = useState(() => solo && !vigilTaught());
  const [paused, setPaused] = useState(teach);
  const [quiet, setQuiet] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [banked, setBanked] = useState<(Banked & { champions: number; events: number; next: string[] }) | null>(null);
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const stick = useRef({ x: 0, y: 0 });
  const dashAsk = useRef(false);
  const pickRef = useRef<(i: number) => void>(() => undefined);
  const rerollRef = useRef<() => void>(() => undefined);
  const hudT = useRef<HTMLSpanElement>(null);
  const hudK = useRef<HTMLSpanElement>(null);
  const hudL = useRef<HTMLSpanElement>(null);
  const hudXp = useRef<HTMLElement>(null);
  const hudHp = useRef<HTMLElement>(null);
  const hudFz = useRef<HTMLDivElement>(null);
  const hudDash = useRef<HTMLButtonElement>(null);
  const hudParty = useRef<HTMLDivElement>(null);
  const hudWait = useRef<HTMLDivElement>(null);
  const hudCard = useRef<HTMLElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const hurtRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const bossRef = useRef<HTMLDivElement>(null);
  const evRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const weatherRef = useRef<HTMLDivElement>(null);
  const galeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current!;
    const base = baseRef.current!;
    const mine = party.find((k) => k.id === meId) ?? party[0]!;
    const hero = newCharacter(mine.cls, 'The Watch', 'vigil');
    if (mine.face) hero.face = mine.face;
    if (mine.body) hero.body = mine.body;
    // (your campaign hero's gear and Wardrobe, if you chose to keep watch in them: only how they look, not their power)
    const wear = wearOf(engine, mine.cls);
    if (wear) {
      hero.equip = structuredClone(wear.equip);
      hero.looks = structuredClone(wear.looks);
      hero.worn = structuredClone(wear.worn);
      hero.shopWorn = structuredClone(wear.shopWorn);
      hero.face = wear.face;
      hero.body = wear.body;
    } else {
      // (in plain clothes: the Ring armor chosen under Title & armor)
      const p = readRing().plain;
      if (p?.head || p?.chest) hero.shopWorn = { ...(p.head ? { head: p.head } : {}), ...(p.chest ? { chest: p.chest } : {}) };
    }
    // the land: a real region of the game, emptied of everything but the land itself
    const world = new World({ region: land.region, tier: 0, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 7, handIns: false });
    world.enemies.length = 0;
    world.npcs.length = 0;
    world.chests.length = 0;
    world.folk.length = 0;
    world.critters.length = 0;
    world.spores.length = 0;
    openBattlefield(world.map);
    const renderer = new Renderer(base);
    renderer.landOnly = true;
    renderer.setGraphics(engine.settings.graphics);
    renderer.keepObject = keepOnLand;
    renderer.setHeroWeapon(mine.cls, world);
    const map = world.map;
    // the middle of the land, with room to run every way (a region's own start can be right on its edge)
    world.player.x = (map.w / 2) * TILE;
    world.player.y = (map.h / 2) * TILE;
    // (the land's own song from the story plays through the night)
    const nightSong = REGIONS[land.region].music as MusicId;
    // (what this keeper carries from the nights before: their own game knows it, so a friend's game is told as the night begins)
    const kit = kitOf(readReturns(), mine.cls);
    const v = new Vigil(weekly ? weekly.seed : solo ? (Math.random() * 2 ** 32) >>> 0 : seed, world.player.x, world.player.y, { map: land, rules, kits: { [mine.id]: kit }, bounds: { x0: TILE, y0: TILE, x1: (map.w - 1) * TILE, y1: (map.h - 1) * TILE }, party: party.map((k) => ({ id: k.id, cls: k.cls, name: k.name })) });
    const me = v.heroOf(meId) ?? v.me;
    const painter = new VigilPainter(
      v,
      me.id,
      Object.fromEntries(party.map((k) => [k.id, { face: k.face, body: k.body }])),
    );
    renderer.layer = painter;
    let shown = false;
    let shownLand = false;
    // (never kept waiting for a land that doesn't come)
    const landTimer = window.setTimeout(() => setLandIn(true), 3500);
    let raf = 0;
    let last = performance.now();
    let phone = engine.touchMode;
    const fit = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      phone = engine.touchMode;
      // (the hero in the very middle: the Host comes from everywhere. The wide framing on every screen; on a phone,
      // a phone's count of pixels all the same: it was drawn at the full two to the point, 38% more than the world)
      renderer.resize(box.clientWidth, box.clientHeight, dpr, false, phone);
      renderer.snap(world);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    /* ------------------------------------------------------ the party's traffic */
    const inputs: Record<number, VigilInput> = {};
    const writer = new SnapWriter();
    let heardAt = performance.now();
    let picking = false;
    if (role.kind !== 'solo') {
      if (role.kind === 'host') {
        v.fxOut = [];
        role.listen((seat, raw) => {
          const d = raw as { i?: unknown; c?: unknown; rr?: unknown; k?: unknown };
          if (d.k) v.equip(seat, cleanKit(d.k));
          if (Array.isArray(d.i)) {
            const mx = Number(d.i[0]);
            const my = Number(d.i[1]);
            inputs[seat] = { mx: Number.isFinite(mx) ? Math.max(-1, Math.min(1, mx)) : 0, my: Number.isFinite(my) ? Math.max(-1, Math.min(1, my)) : 0, dash: d.i[2] === 1 || inputs[seat]?.dash };
          }
          if (typeof d.c === 'number') v.choose(d.c, seat);
          if (d.rr) v.reroll(seat);
        });
      } else {
        role.listen((_seat, raw) => {
          const d = raw as { s?: Snap };
          if (!d?.s) return;
          heardAt = performance.now();
          applySnap(v, d.s, me.id);
        });
      }
    }
    const pick = (i: number): void => {
      if (!me.cards?.[i] || picking) return;
      if (role.kind === 'client') {
        picking = true;
        role.send({ c: i });
      } else {
        v.choose(i, me.id);
        tick((x) => x + 1);
      }
    };
    const reroll = (): void => {
      if (!me.cards || me.rerolls <= 0) return;
      if (role.kind === 'client') role.send({ rr: 1 });
      else {
        v.reroll(me.id);
        tick((x) => x + 1);
      }
    };
    pickRef.current = pick;
    rerollRef.current = reroll;

    /* ------------------------------------------------------ input */
    const keys = new Set<string>();
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') setPaused((p) => !p);
      if (me.cards) {
        const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (n >= 0) pick(n);
        if (e.code === 'KeyR') reroll();
      }
      if (e.code === 'Space' && !e.repeat) dashAsk.current = true;
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keys.delete(e.code);
    };
    const blur = (): void => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);

    const inputNow = (): VigilInput => {
      let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      if (stick.current.x || stick.current.y) {
        mx = stick.current.x;
        my = stick.current.y;
      }
      return { mx, my, dash: dashAsk.current };
    };

    /* ------------------------------------------------------ sound */
    const heard = new WeakSet<Fx>();
    const soundAt = new Map<string, number>();
    const listen = (now: number): void => {
      for (const f of v.fx) {
        if (heard.has(f)) continue;
        heard.add(f);
        const s = fxSound(f.kind, f.el);
        if (!s || now - (soundAt.get(s[0]) ?? -9999) < s[1] * 1000) continue;
        soundAt.set(s[0], now);
        engine.sound.play(s[0], s[2]);
      }
    };

    /* ------------------------------------------------------ the loop */
    let cards: Card[] | null = null;
    let over = false;
    let rev = -1;
    let struck = 0;
    let wasDown = false;
    let sentAt = 0;
    let trees = false;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!shown) {
        shown = true;
        setView(v);
      }
      // (no faster than a touch screen is held to, nor than the battery saver asks: engine.frameGap)
      if (now - last < engine.frameGap) return;
      // (a first touch after the watch began: a phone's picture from here on)
      if (engine.touchMode !== phone) fit();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const time = now / 1000;
      const stopped = solo && pausedRef.current;
      const asked = inputNow();
      if (role.kind === 'client') {
        v.follow(dt, me.id, asked);
        if (now - sentAt > 66) {
          sentAt = now;
          // (what this keeper carries, said a few times as the night begins in case the first is lost)
          role.send(v.t < 6 ? { i: [Math.round(asked.mx * 100) / 100, Math.round(asked.my * 100) / 100, asked.dash ? 1 : 0], k: kit } : { i: [Math.round(asked.mx * 100) / 100, Math.round(asked.my * 100) / 100, asked.dash ? 1 : 0] });
          dashAsk.current = false;
        }
      } else if (!stopped) {
        v.step(dt, role.kind === 'host' ? { ...inputs, [me.id]: asked } : asked);
        dashAsk.current = false;
        for (const id of Object.keys(inputs)) inputs[Number(id)]!.dash = false;
      }
      if (role.kind === 'host' && now - sentAt > 166) {
        const since = sentAt ? (now - sentAt) / 1000 : 0;
        sentAt = now;
        role.send({ s: writer.write(v, since) });
      }
      painter.frame(stopped || v.choosing ? 0 : dt);
      const p = world.player;
      p.x = me.x;
      p.y = me.y;
      const still = !!me.cards || stopped;
      p.vx = still ? 0 : me.vx;
      p.vy = still ? 0 : me.vy;
      if (Math.hypot(p.vx, p.vy) > 1) {
        p.walkT += dt;
        p.dir = Math.abs(me.dirX) > Math.abs(me.dirY) ? (me.dirX < 0 ? 1 : 2) : me.dirY < 0 ? 3 : 0;
      }
      p.iframe = me.iframe;
      p.dead = me.down;
      world.shakeAmt = v.shake * 0.4;
      renderer.draw(world, still ? 0 : dt, time);
      if (!shownLand && renderer.landReady) {
        shownLand = true;
        setLandIn(true);
      }
      // the trees are known once the land has been built: from then on they stand in everyone's way
      if (!trees && renderer.objects.length) {
        trees = true;
        v.setObstacles(trunksOf(renderer.objects));
      }
      listen(now);
      engine.setModeMusic(v.foes.some((f) => f.boss) ? 'boss' : nightSong);
      if (me.struck > struck) engine.sound.play('hurt', 0.8);
      struck = me.struck;
      if (me.down && !wasDown) engine.sound.play('playerDie', 0.9);
      wasDown = me.down;

      /* -------------------------------------------------- the HUD */
      const max = v.maxHpOf(me);
      if (hurtRef.current) hurtRef.current.style.opacity = String(Math.max(me.struck * 0.75, me.hp / max < 0.25 ? 0.28 + Math.sin(now / 240) * 0.14 : 0));
      if (flashRef.current) flashRef.current.style.opacity = String(Math.round(v.levelFlash * 55) / 100);
      const boss = v.foes.find((f) => f.boss);
      if (bossRef.current) {
        bossRef.current.style.display = boss ? 'grid' : 'none';
        if (boss) {
          say(bossRef.current.querySelector('b'), boss.boss ?? '');
          bossRef.current.querySelector('i')!.style.width = part(boss.hp / boss.maxHp);
        }
      }
      // what is happening this minute, and what the land is doing
      const ev = v.event;
      if (evRef.current) {
        evRef.current.style.display = ev ? 'grid' : 'none';
        if (ev) {
          const def = EVENTS[ev.kind];
          const trait = ev.kind === 'pack' ? TRAITS[ev.trait] : undefined;
          const fills = ev.kind === 'lantern' || ev.kind === 'pack';
          say(evRef.current.querySelector('b'), trait ? `${def.name}: ${trait.name}` : def.name);
          say(evRef.current.querySelector('small'), trait ? `${trait.text} ${def.text}` : def.text);
          evRef.current.querySelector('i')!.style.width = part(fills ? ev.prog : 1 - ev.t / ev.dur);
          evRef.current.classList.toggle('is-fill', fills);
          evRef.current.classList.toggle('is-low', !!boss);
        }
      }
      say(tipRef.current, v.tip?.text ?? '');
      if (weatherRef.current) {
        const w = weatherRef.current;
        w.style.setProperty('--chill', String(Math.round(me.chill * 100) / 100));
        w.classList.toggle('is-storm', v.storming);
        w.classList.toggle('is-tide', rules.includes('tide') && inPhase(v.t, TIDE));
        w.classList.toggle('is-hour', ev?.kind === 'hour');
      }
      if (galeRef.current) {
        const blowing = rules.includes('gale') && inPhase(v.t, GALE);
        const coming = rules.includes('gale') && nearPhase(v.t, GALE);
        galeRef.current.style.display = blowing || coming ? 'grid' : 'none';
        if (blowing || coming) {
          // (the warning points the way the gust about to come will blow: the round the clock is in is its round)
          galeRef.current.style.setProperty('--a', `${Math.round(galeAngle(v.seed, v.t) * 100) / 100}rad`);
          galeRef.current.classList.toggle('is-on', blowing);
        }
      }
      hudHp.current?.classList.toggle('is-venom', me.venom > 0);
      // a ward shows over the health it guards
      hudHp.current?.parentElement?.style.setProperty('--ward', me.ward > 0 && me.wardMax > 0 ? part(me.ward / me.wardMax) : '0%');
      say(hudT.current, clock(v.t));
      say(hudK.current, String(v.kills));
      say(hudL.current, String(v.level));
      if (hudXp.current) hudXp.current.style.width = part(v.xp / v.xpNext);
      if (hudHp.current) hudHp.current.style.width = part(me.hp / max);
      if (hudFz.current) {
        const on = me.frenzyT > 0;
        hudFz.current.classList.toggle('is-on', on);
        hudFz.current.querySelector('i')!.style.width = part(on ? me.frenzyT / 6 : me.frenzy);
      }
      if (hudDash.current) {
        hudDash.current.style.setProperty('--cd', String(Math.round((me.dashCd / v.dashEvery(me)) * 200) / 200));
        hudDash.current.classList.toggle('is-ready', me.dashCd <= 0);
      }
      if (hudParty.current) {
        let i = 0;
        for (const h of v.heroes) {
          if (h === me) continue;
          const row = hudParty.current.children[i++] as HTMLElement | undefined;
          if (!row) continue;
          row.classList.toggle('is-down', h.down);
          (row.querySelector('i') as HTMLElement).style.width = part(h.hp / v.maxHpOf(h));
        }
      }
      if (hudWait.current) {
        const waiting = !me.cards && v.choosing ? v.heroes.filter((h) => h.cards).map((h) => h.name) : [];
        say(hudWait.current, waiting.length ? `Waiting for ${waiting.join(' and ')} to choose…` : me.down && !v.over ? 'You’re down. A friend can get you up.' : '');
      }
      if (hudCard.current) hudCard.current.style.width = part(me.cardT / CARD_SECONDS);
      say(banner.current, v.banner?.text ?? '');
      if (me.cards !== cards) {
        cards = me.cards;
        picking = false;
        if (cards) engine.sound.play('quest', 0.7);
        tick((x) => x + 1);
      }
      if (me.rev !== rev) {
        rev = me.rev;
        tick((x) => x + 1);
      }
      if (role.kind === 'client') setQuiet(now - heardAt > 6000);
      if (v.over && !over) {
        over = true;
        const mine = v.heroOf(meId) ?? v.me;
        // (the week's watch has an omen over it, so it keeps a best of its own and opens no land)
        if (!weekly) {
          // holding long enough opens the next land
          const before = readBests();
          const at = VIGIL_MAPS.indexOf(land);
          const next = VIGIL_MAPS[at + 1];
          if (next && (before[land.id] ?? 0) < UNLOCK_HOLD && v.t >= UNLOCK_HOLD) setOpened(next.name);
          setBest((b) => {
            const longest = Math.max(b, Math.floor(v.t));
            saveBest(land.id, longest);
            return longest;
          });
          // kept with the class it was held with
          saveClassBest(land.id, mine.cls, v.t);
        }
        // what the night earned, kept for the nights after (vigil/returns.ts), and the evolutions found added to the codex
        const bank = bankNight(v.t, v.feats, mine.cls, weekly?.week, { won: v.wonLog, felled: v.felledLog });
        // (and what is nearest done of what is still to do, this class's and this land's first: a reason for the next night)
        const state = deedState();
        const next = nextDeeds(state, readReturns().deeds, 2, [`class:${mine.cls}`, `land:${land.id}`]).map((d) => `${d.text} (${deedProgress(d, state)})`);
        setBanked({ ...bank, champions: v.feats.champions, events: v.feats.events, next });
        setFound(addToCodex(mine.evolved));
        tick((x) => x + 1);
      }
    };
    raf = requestAnimationFrame(frame);
    // review tool on the dev server: a hidden pane runs no animation frames, so frames can be stepped by hand
    if (import.meta.env.DEV) (window as unknown as { __vigil?: unknown }).__vigil = { v, me, frame, keys, painter, renderer, world, pick };
    return () => {
      engine.setModeMusic(null);
      cancelAnimationFrame(raf);
      clearTimeout(landTimer);
      ro.disconnect();
      if (role.kind !== 'solo') role.listen(null);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      renderer.layer = null;
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const v = view;
  const me = v ? (v.heroOf(meId) ?? v.me) : null;
  const newBest = v?.over && (weekly ? !!banked?.newWeekBest : Math.floor(v.t) >= best);
  const shownBest = weekly ? (banked?.weekBest ?? 0) : best;
  const others = v?.heroes.filter((h) => h !== me) ?? [];
  const hosting = role.kind === 'host';
  return (
    <ScreenGate hold={!landIn} label="Finding the land">
      <div className="rb-vigil" ref={boxRef}>
        <div className="rb-vigil-world">
          <canvas ref={baseRef} className="rb-vigil-canvas" />
        </div>
        <div className="rb-vigil-weather" ref={weatherRef} aria-hidden="true" />
        <div className="rb-vigil-hurt" ref={hurtRef} aria-hidden="true" />
        <div className="rb-vigil-flash" ref={flashRef} aria-hidden="true" />
        <div className="rb-vigil-xp">
          <i ref={hudXp} />
        </div>
        <div className="rb-vigil-hud">
          <div className="rb-vigil-stat">
            <span ref={hudT} className="rb-vigil-clock">
              0:00
            </span>
            <span className="rb-dim">
              Level <b ref={hudL}>1</b> · <b ref={hudK}>0</b> felled
            </span>
            <span className="rb-vigil-rules" aria-label="This land’s rule">
              {rules.map((r) => (
                <em key={r} title={RULES[r].text}>
                  {RULES[r].name}
                </em>
              ))}
            </span>
            <span className="rb-vigil-hp">
              <i ref={hudHp} />
            </span>
            <div className="rb-vigil-frenzy" ref={hudFz} title="Kills fill this. When it’s full you go into a frenzy.">
              <small>Frenzy</small>
              <span>
                <i />
              </span>
            </div>
            {others.length > 0 && (
              <div className="rb-vigil-party" ref={hudParty} aria-label="Your party">
                {others.map((h) => (
                  <div key={h.id} className="rb-vigil-friend">
                    <small>{h.name}</small>
                    <span>
                      <i />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rb-vigil-buttons">
            <button className="rb-iconbtn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : solo ? 'Pause' : 'Leave'}>
              {paused ? '▶' : '❚❚'}
            </button>
            <GameMenuButton className="rb-iconbtn" />
          </div>
        </div>
        <div className="rb-vigil-banner" ref={banner} role="status" />
        <div className="rb-vigil-wait" ref={hudWait} role="status" />
        <div className="rb-vigil-event" ref={evRef} style={{ display: 'none' }} role="status">
          <b />
          <small />
          <span>
            <i />
          </span>
        </div>
        <div className="rb-vigil-tip" ref={tipRef} role="status" />
        <div className="rb-vigil-gale" ref={galeRef} style={{ display: 'none' }} aria-hidden="true">
          <i>➤</i>
          <small>Gale</small>
        </div>
        <div className="rb-vigil-boss" ref={bossRef} style={{ display: 'none' }}>
          <b />
          <span>
            <i />
          </span>
        </div>
        {me && <Loadout h={me} />}
        {engine.touchMode && (
          <Stick
            settings={engine.settings}
            onMove={(x, y) => {
              stick.current = { x, y };
            }}
          />
        )}
        <button
          ref={hudDash}
          className={`rb-vigil-dash${engine.touchMode ? ' is-touch' : ''}`}
          aria-label="Dash"
          onPointerDown={(e) => {
            e.stopPropagation();
            dashAsk.current = true;
          }}
        >
          <img src={iconPicture(FIELD_ICONS.dash)} alt="" draggable={false} />
          {!engine.touchMode && <kbd>Space</kbd>}
        </button>

        {me?.cards && !v?.over && (
          <div className="rb-vigil-modal" role="dialog" aria-label="Level up">
            <h2 className="rb-vigil-levelup">Level {v?.level}</h2>
            <p className="rb-dim">{solo ? 'Choose one. The night waits.' : 'Choose one. Everyone’s night waits on you.'}</p>
            {!solo && (
              <div className="rb-vigil-cardtime" aria-hidden="true">
                <i ref={hudCard} />
              </div>
            )}
            <div className="rb-vigil-cards">
              {me.cards.map((c, i) => {
                const top = c.kind === 'up' || (c.kind === 'spell' && !c.evolve) ? topLevel(SPELLS[c.id]!) : 0;
                const hint = evolvesWith(me, c);
                return (
                  <button key={`${c.kind}-${i}`} className={`rb-vigil-card${c.kind === 'spell' && c.evolve ? ' is-evolve' : ''}${c.kind === 'strength' ? ' is-strength' : ''}${c.kind === 'up' ? ' is-up' : ''}`} style={{ ['--i' as string]: i }} onClick={() => pickRef.current(i)}>
                    <span className="rb-vigil-tag">{cardTag(c, me.cls)}</span>
                    <span className="rb-vigil-icon">
                      <img src={cardIcon(c)} alt="" draggable={false} />
                    </span>
                    <strong>{cardName(c)}</strong>
                    <span>{cardText(c)}</span>
                    {hint && <em className="rb-vigil-hint">{hint}</em>}
                    {top > 0 && c.kind !== 'strength' && (
                      <span className="rb-vigil-pips" aria-hidden="true">
                        {Array.from({ length: top }, (_, n) => (
                          <i key={n} className={n < c.level ? 'is-on' : ''} />
                        ))}
                      </span>
                    )}
                    <kbd>{i + 1}</kbd>
                  </button>
                );
              })}
            </div>
            <button className="rb-btn is-small is-ghost" disabled={me.rerolls <= 0} onClick={() => rerollRef.current()}>
              Reroll ({me.rerolls})
            </button>
          </div>
        )}

        {quiet && !v?.over && (
          <div className="rb-vigil-modal" role="dialog" aria-label="Lost the host">
            <h2>{hostName} has gone quiet</h2>
            <p className="rb-dim">Their game runs the night. It carries on if they come back.</p>
            <div className="rb-vigil-actions">
              <button className="rb-btn is-ghost" onClick={onBack}>
                Leave the party
              </button>
            </div>
          </div>
        )}

        {teach && !v?.over && (
          <div className="rb-vigil-modal rb-vigil-teach" role="dialog" aria-label="How the Vigil is played">
            <h2>Keep the watch</h2>
            <ul>
              <li>
                <b>Move</b> {engine.touchMode ? 'with the stick' : 'with WASD or the arrows'}, and keep moving: the Host comes from every side.
              </li>
              <li>
                <b>Your spells fire by themselves</b> at whatever is near. You don’t aim.
              </li>
              <li>
                <b>Each level, choose one card</b>{engine.touchMode ? '' : ' (1, 2 or 3)'}: a new spell, or a stronger one. Some spells evolve when you take the strength they name.
              </li>
              <li>
                <b>Dash</b> {engine.touchMode ? 'with its button' : 'with Space'} through a gap. Holding {clock(UNLOCK_HOLD)} opens the next land.
              </li>
              <li>
                <b>Every land has a rule of its own</b>, and about once a minute something happens: a card at the top says what, and what to do.
              </li>
            </ul>
            <div className="rb-vigil-actions">
              <button
                className="rb-btn is-gold"
                autoFocus
                onClick={() => {
                  markVigilTaught();
                  setTeach(false);
                  setPaused(false);
                }}
              >
                Begin the night
              </button>
            </div>
          </div>
        )}

        {paused && !teach && !v?.over && !me?.cards && (
          <div className="rb-vigil-modal" role="dialog" aria-label="Paused">
            <h2>{solo ? 'The night waits' : 'The night goes on'}</h2>
            {!solo && <p className="rb-dim">{hosting ? 'Your game runs this night: if you leave, it ends for everyone.' : 'Your friends are still fighting, and your hero stands where they are.'}</p>}
            <div className="rb-vigil-actions">
              <button className="rb-btn is-gold" onClick={() => setPaused(false)}>
                {solo ? 'Resume' : 'Back to it'}
              </button>
              <button className="rb-btn is-ghost" onClick={onBack}>
                {solo ? 'Leave the Vigil' : hosting ? 'End the night' : 'Leave the party'}
              </button>
            </div>
          </div>
        )}

        {v?.over && (
          <div className="rb-vend" role="dialog" aria-label="The Vigil is over">
            <div className="rb-vend-body">
              <p className="rb-vend-land">{weekly ? `The week’s watch · ${land.name}` : land.name}</p>
              <h2>The line broke</h2>
              <p className="rb-vend-time">
                <small>You held for</small>
                <b>{clock(v.t)}</b>
              </p>
              <p className={`rb-vend-best${newBest ? ' is-new' : ''}`}>{weekly ? (newBest ? 'Your best this week!' : `Your best this week is ${clock(shownBest)}`) : newBest ? 'Your longest night here!' : `Your longest night here is ${clock(shownBest)}`}</p>
              <div className="rb-vend-stats">
                <span>
                  <b>{v.kills}</b>
                  <small>felled</small>
                </span>
                <span>
                  <b>{v.level}</b>
                  <small>level</small>
                </span>
                <span>
                  <b>{me?.frenzies ?? 0}</b>
                  <small>frenzies</small>
                </span>
              </div>
              {banked && (
                <p className="rb-vigil-motes">
                  <b>+{banked.motes + banked.bounty + banked.deeds.reduce((a, d) => a + d.motes, 0)} motes</b>
                  <small>
                    {clock(v.t)} held
                    {banked.champions > 0 && ` · ${banked.champions} ${banked.champions === 1 ? 'champion' : 'champions'} felled`}
                    {banked.events > 0 && ` · ${banked.events} ${banked.events === 1 ? 'event' : 'events'} won`}
                    {banked.bounty > 0 && ' · the week’s bounty'}
                  </small>
                  {banked.deeds.map((d) => (
                    <small key={d.id} className="rb-vigil-deed">
                      Deed done: <b>{d.name}</b> · +{d.motes}
                    </small>
                  ))}
                  {banked.next.length > 0 && <small className="rb-vigil-next">Still to do: {banked.next.join(' · ')}</small>}
                </p>
              )}
              {opened && <p className="rb-vigil-opened">A new land opens: {opened}</p>}
              {found.length > 0 && (
                <p className="rb-vigil-opened">
                  {found.length === 1 ? 'A new evolution for your codex: ' : 'New evolutions for your codex: '}
                  {found.map((id) => SPELLS[id]?.evolve?.name ?? id).join(', ')}
                </p>
              )}
              <div className="rb-vend-builds">
                {v.heroes.map((h) => (
                  <div key={h.id} className="rb-vend-build">
                    {v.heroes.length > 1 && <small>{h.name}</small>}
                    <span>
                      {Object.keys(h.spells).map((id) => (
                        <img key={id} src={spellIcon(id, h.evolved.has(id))} alt={SPELLS[id]!.name} title={SPELLS[id]!.name} draggable={false} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rb-vigil-actions">
                {solo && (
                  <button
                    className="rb-btn is-gold is-big"
                    onClick={() => {
                      setPaused(false);
                      setOpened(null);
                      setFound([]);
                      setBanked(null);
                      setRun((r) => r + 1);
                    }}
                  >
                    Hold again
                  </button>
                )}
                {hosting && (
                  <button className="rb-btn is-gold is-big" onClick={onBack}>
                    Back to the party
                  </button>
                )}
                {role.kind === 'client' && <p className="rb-dim">Waiting for {hostName} to bring the party back…</p>}
                {!hosting && (
                  <button className="rb-btn is-ghost" onClick={onBack}>
                    {solo ? 'Choose again' : 'Leave the party'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenGate>
  );
}
