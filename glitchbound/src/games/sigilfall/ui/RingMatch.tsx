import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TitleShown } from '../progress/titles';
import { useGameMenu } from '../../../components/GameMenuButton';
import { ABILITIES, BOONS, SLOTS, type Ability, type CcKind } from '../arena/abilities';
import { botThink, newBrain, steerTo } from '../arena/bot';
import { LEAVER_K, type ClassSets } from '../arena/ladder';
import { hintNow, keepLog, lessonOf, newLog, type HintKeys } from '../arena/lessons';
import { TutorialRun, type TutorialKeys } from '../arena/tutorial';
import { lookOf } from '../arena/look';
import { MAPS } from '../arena/maps';
import { HERO_R, Match, MATCH_LIMIT, PACE, type Aura, type DrState, type Fighter, type MatchSetup, type MoveInput, type Snapshot } from '../arena/sim';
import { playstyleOf } from '../arena/styles';
import { CLASSES } from '../data/classes';
import type { SigilEngine } from '../engine';
import type { Character, Face } from '../progress/character';
import { iconPicture } from '../render/art/gameIcons';
import { barTop, drawRing, headHeight, RingFx, ringLooks, ringSpells, type RingAim } from '../render/ring';
import { RingStage, ringMapOf } from '../render3d/ring3d';
import { heroDollUrl, type WornLooks } from '../render/sprites';
import { BoonChips, BoonFlares, Pips } from './RingBoons';
import { RingHelp, SetupEditor, SpellTip } from './RingSetup';
import { ScreenGate } from './ScreenGate';
import { Stick } from './Stick';
import { autoPoint as pointFor, isOut, plainWhy } from './ringAim';
import { actionOf, keyName, readKeys, saveKeys, type RingKeys } from './ringKeys';
import { KeysDialog } from './RingKeysDialog';
import { TitleFx } from '../../../components/TitleFx';
import { classEmblem } from './classEmblem';
import { Coach, useLabels, useSpot } from './RingCoach';
import { frameOf } from '../arena/record';

/** `skill`: how sharp the computer plays (arena/ladder.ts skillAt); `mates`, in solo: the player's own side's, when not the same. */
export type Role = { kind: 'solo'; skill: number; mates?: number } | { kind: 'host'; skill: number; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void } | { kind: 'client'; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void };

/** What the room's traffic is handed to (one per match). */
export type RingInbox = (seat: number, d: unknown) => void;

/** Where the player stands on the ladder going into a match, and what's on the line. */
export interface MatchStakes {
  format: number;
  rating: number;
  rank: string;
  color: string;
  win: number;
  lose: number;
  rival: string;
  blurb: string;
  rivalRating: number;
}

// (a step per frame on a 60 Hz screen: at 30 a second, everyone moved on every other frame and the fight looked choppy)
const STEP = 1 / 60;
/** The longest piece of time the fight is moved by at once. */
const MAX_STEP = 1 / 45;
/** A host speaks ten times a second: plenty for frames that coast between. */
const SEND_EVERY = 0.1;
/** The thumb cluster's places (Game.css .rb-ring-thumbs .rb-cluster): the bar's first, the basic ability, in the corner,
 * its other three on one arc round it, then the super outside it. (Four on the arc while a bar held five, until
 * 2026-11-16; a Swift Step had its own place, low on the left, until 2026-11-15.) */
const TOUCH_SLOTS = ['basic', 's1', 's2', 's3', 'ult'] as const;

const clock = (t: number): string => {
  const left = Math.max(0, MATCH_LIMIT - t);
  return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
};

const CC_WORD: Record<string, string> = { stun: 'Stunned', fear: 'Feared', incap: 'Dazed', root: 'Rooted', silence: 'Silenced' };
const DR_MARK = ['', '½', '¼', '✕'];
/** What the next hold of a kind does, by how many have landed: half as long, a quarter, or nothing at all. */
const DR_NEXT = ['', 'the next lasts half as long', 'the next lasts a quarter as long', 'immune to the next'];
/** Each kind of hold's picture, for diminishing returns from a host that didn't say what put them on. */
const DR_ICON: Record<CcKind, string> = { stun: 'd-hammer', fear: 'p-wail', incap: 'm-toad', root: 'l-roots', silence: 'p-hush' };

/**
 * Diminishing returns, one round chip for each kind of hold that wears off faster on them now (the owner: "add
 * diminishing return tracker on the enemies on the nameplates, should be small but visible - e.g mage's hex"): the
 * picture of what put the last on them (a Toad Hex for a daze), rimmed yellow when the next lasts half as long, orange
 * a quarter, red when they can't be held that way at all, with the rim running down until it is forgotten.
 */
function DrChips({ f, m }: { f: Fighter; m: Match }) {
  const now = (Object.entries(f.dr) as [CcKind, DrState | undefined][]).filter((e): e is [CcKind, DrState] => !!e[1] && e[1].until > m.clock && e[1].n > 0);
  if (!now.length) return null;
  return (
    <span className="rb-ring-drs">
      {now.map(([k, d]) => {
        const stage = Math.min(d.n, DR_MARK.length - 1);
        const left = d.until - m.clock;
        const share = d.at !== undefined && d.until > d.at ? Math.max(0, Math.min(1, left / (d.until - d.at))) : 1;
        const shown = d.ab && lookOf(d.ab) ? d.ab : DR_ICON[k];
        const look = lookOf(shown)!;
        return (
          <i key={k} className={`is-dr${stage}`} data-ab={shown} style={{ ['--left' as string]: share.toFixed(3) }} title={`${CC_WORD[k]} (${look.name}): ${DR_NEXT[stage]}, for ${Math.ceil(left)}s`}>
            <img src={iconPicture(look.icon)} alt="" draggable={false} />
            <em>{DR_MARK[stage]}</em>
          </i>
        );
      })}
    </span>
  );
}

/** What an effect does to whoever carries it, in a word or two. */
const auraWord = (a: Aura): string => {
  const pct = `${Math.round(a.n * 100)}%`;
  switch (a.kind) {
    case 'cc':
      return CC_WORD[a.cc ?? ''] ?? 'Held';
    case 'dot':
      return 'Burning';
    case 'hot':
      return 'Mending';
    case 'slow':
      return `Slowed ${pct}`;
    case 'antiheal':
      return `Healing −${pct}`;
    case 'absorb':
      return 'Shielded';
    case 'guard':
      return `Guarded ${pct}`;
    case 'fury':
      return `Damage +${pct}`;
    case 'speed':
      return `Faster ${pct}`;
    case 'immune':
      return a.still ? 'Frozen safe' : 'Immune';
    case 'free':
      return 'Unbound';
    case 'reflect':
      return 'Reflecting';
    case 'lastgrace':
      return 'Death-warded';
    case 'mark':
      return `Hunted +${pct}`;
    case 'weak':
      return `Damage −${pct}`;
    case 'oak':
      return 'Rooted as an oak';
    case 'spirit':
      return 'Lingering';
    case 'revenant':
      return 'Revenant';
    case 'aloft':
      return 'Up in the dark';
    default:
      return '';
  }
};

function AuraIcons({ f }: { f: Fighter }) {
  // what holds them first, then what's left
  const shown = [...f.auras].sort((a, b) => Number(!!b.cc) - Number(!!a.cc)).slice(0, 6);
  return (
    <span className="rb-ring-auras">
      {shown.map((a: Aura, i) => (
        <i key={`${a.ab}-${a.kind}-${i}`} className={`${a.harmful ? 'is-bad' : 'is-good'}${a.cc ? ' is-cc' : ''}`} title={`${lookOf(a.ab)?.name ?? ''}: ${auraWord(a)}`}>
          <img src={iconPicture(lookOf(a.ab)?.icon ?? '')} alt="" draggable={false} />
          <b>{Math.max(1, Math.ceil(a.t))}s</b>
        </i>
      ))}
    </span>
  );
}

/** How far along a cast is (a channel runs down). */
const castShare = (c: { t: number; dur: number; channel: boolean }): number => Math.max(0, Math.min(1, c.channel ? 1 - c.t / c.dur : c.t / c.dur));

export function Frame({ f, m, me, doll, tag, onPick, flip, title, frame }: { f: Fighter; m: Match; me: Fighter | null; doll: string; tag: string | null; onPick: () => void; flip?: boolean; title?: { text: string } | null; frame?: string | null }) {
  // (the frame they wear round their nameplate, one the season track gave: arena/record.ts)
  const fr = frameOf(frame);
  const hold = f.auras.find((a) => a.cc);
  const c = f.cast;
  const ab = c ? ABILITIES[c.ab] : null;
  // (one of the other side in the shroud: their place is kept, but nothing of how they are)
  const veiled = !!me && m.unseen(f, me) && !f.dead;
  const sees = !veiled && (!me || me === f || m.phase !== 'fight' || m.sees(me, f));
  const share = f.hp / f.maxHp;
  return (
    <button className={`rb-ring-frame${flip ? ' is-flip' : ''}${tag ? ' is-on' : ''}${f.dead ? ' is-dead' : ''}${sees ? '' : ' is-unseen'}${fr ? ' has-frame' : ''}`} style={{ ['--c' as string]: CLASSES[f.cls].colors.accent, ...(fr ? { ['--f1' as string]: fr.colors[0], ['--f2' as string]: fr.colors[1] } : {}) }} 
      onPointerDown={(e) => {
        // (at the press, not on a tap: a phone sends no tap while the other thumb is on the stick)
        e.preventDefault();
        onPick();
      }}
      onClick={onPick}
      aria-label={`${f.name}${title ? `, ${title.text}` : ''}, ${CLASSES[f.cls].name}, ${Math.round(share * 100)}% health`}>
      {/* (their class's emblem: the class at a glance, where two of the dolls' faces could be taken for each other) */}
      <span className="rb-ring-face is-emblem">
        <img src={doll} alt="" draggable={false} />
      </span>
      <span className="rb-ring-bars">
        {/* (their name, then in small letters the way they fight: arena/styles.ts playstyleOf) */}
        <span className="rb-ring-name">
          <b>{f.id === me?.id ? 'You' : f.name}</b>
          <small className="rb-ring-style">{playstyleOf(f.cls, f.bar)}</small>
          {tag && <em>{tag}</em>}
        </span>
        <span className={`rb-ring-bar${share < 0.3 ? ' is-low' : ''}`}>
          <i style={{ width: `${share * 100}%` }} />
          <b>{f.dead ? 'Fallen' : veiled ? 'Hidden' : `${Math.round(share * 100)}%`}</b>
        </span>
        {/* what they are casting (or what holds them) on the row under the health. (A mana row stood between them; the
            Ring has no mana now: the owner, 2026-11-15, "remove the mana completely") */}
        <span className="rb-ring-tail">
          {c && ab ? (
            <span className="rb-ring-cast" style={{ ['--a' as string]: ab.color }}>
              <i data-cast={f.id} style={{ width: `${castShare(c) * 100}%` }} />
              <b>{ab.name}</b>
            </span>
          ) : hold ? (
            <span className="rb-ring-held">
              {CC_WORD[hold.cc!]} {Math.ceil(hold.t)}s
            </span>
          ) : !sees && !f.dead ? (
            <span className="rb-ring-unseen">Out of sight</span>
          ) : null}
        </span>
        <span className="rb-ring-under">
          <AuraIcons f={f} />
          {!veiled && <DrChips f={f} m={m} />}
        </span>
      </span>
    </button>
  );
}

/**
 * A press on a column of nameplates that falls between two of them (they are 2 px apart, and on a phone a press with
 * the other thumb on the stick is never nudged onto a button as a tap would be) goes to the nearest one.
 */
function nearestPlate(e: ReactPointerEvent<HTMLDivElement>, list: Fighter[], pick: (id: number) => void): void {
  if (e.target !== e.currentTarget) return;
  const plates = [...e.currentTarget.querySelectorAll<HTMLElement>(':scope > .rb-ring-frame')];
  let best = -1;
  let bd = e.pointerType === 'mouse' ? PLATE_SLACK : PLATE_SLACK_TOUCH;
  plates.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  const f = list[best];
  if (!f) return;
  e.preventDefault();
  pick(f.id);
}
/** How far from a nameplate a press still counts as on it, in CSS px. */
const PLATE_SLACK = 8;
/**
 * And a thumb's: further, for the strip of the team's column round its nameplates (above the top one too, which a
 * phone's own top edge could take: the owner, "if i try to select the enemy thats on most top side of the nameplates
 * on my phone, its not working").
 */
const PLATE_SLACK_TOUCH = 16;

/**
 * Whether the target is in reach of the bar's first attack (its base spell), in a word: a distance in the ring's own
 * units meant nothing to a player ("14 away" while standing on them).
 */
export function reachWord(me: Pick<Fighter, 'x' | 'y' | 'bar'>, foe: Pick<Fighter, 'x' | 'y'>): 'In reach' | 'Too far' {
  const first = me.bar.map((id) => ABILITIES[id]).find((ab) => !!ab && ab.aim === 'enemy');
  const range = first?.range ?? 0;
  return Math.hypot(foe.x - me.x, foe.y - me.y) <= range + HERO_R ? 'In reach' : 'Too far';
}

/** Who an ability will land on, and whether it can right now. */
function AimCard({ label, f, note, bad, doll, kind }: { label: string; f: Fighter | null; note: string; bad: boolean; doll: string; kind: 'foe' | 'friend' }) {
  return (
    <div className={`rb-ring-aim is-${kind}${f ? '' : ' is-none'}${bad ? ' is-bad' : ''}`} data-tut={kind === 'foe' ? 'target' : undefined}>
      <small>{label}</small>
      {f ? (
        <span className="rb-ring-aim-who">
          <span className="rb-ring-face is-small is-emblem" style={{ ['--c' as string]: CLASSES[f.cls].colors.accent }}>
            <img src={doll} alt="" draggable={false} />
          </span>
          <span>
            <b>{f.name}</b>
            <em>{note}</em>
          </span>
        </span>
      ) : (
        <em>{note}</em>
      )}
    </div>
  );
}

export interface MatchResult {
  won: boolean;
  draw: boolean;
  match: Match;
  myId: number;
  dolls: string[];
  /** After a match that wasn't won: one thing to try next time (arena/lessons.ts). */
  lesson?: string | null;
}

/** The one-time hints of a real match (arena/lessons.ts): which have been shown on this device, and word of a new one. */
export interface MatchHints {
  seen: readonly string[];
  onSeen: (id: string) => void;
}

/** How long a hint stays up, in ms. */
const HINT_MS = 7000;
/** How long "Close in automatically" walks before it gives up, in ms: long enough to cross the ground. */
const CHASE_MS = 10000;

/** What an ability's button does with a touch: a placed one is aimed with it, any other goes off at the press. */
interface AimApi {
  down: (e: ReactPointerEvent<HTMLButtonElement>, ab: Ability) => void;
  move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  up: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  cancel: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}
const NO_AIM: AimApi = { down: () => {}, move: () => {}, up: () => {}, cancel: () => {} };
/** How far a thumb pushes a placed ability's circle to its full reach, in screen points; and how little is no push at all. */
const AIM_THROW = 78;
const AIM_SLACK = 8;

/** A match: The Ring's ground, its frames and a bar of abilities. Solo, the computer plays everyone else. */
export function RingMatch({ engine, setup, myId, face, body, role, sets, stakes, onSets, onDone, onLeave, resume, onSnap, wear, worn, title, tutorial, hints }: { engine: SigilEngine; setup: MatchSetup; myId: number; face?: Face; body?: 'm' | 'f'; wear?: Character | null; worn?: WornLooks; title?: TitleShown | null; role: Role; sets: ClassSets; stakes: MatchStakes | null; onSets: (s: ClassSets) => void; onDone: (r: MatchResult) => void; onLeave: (started: boolean) => void; resume?: Snapshot; onSnap?: (s: Snapshot) => void; tutorial?: boolean; hints?: MatchHints }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ringKeys, setRingKeys] = useState<RingKeys>(readKeys);
  const keysRef = useRef(ringKeys);
  const binding = useRef(false);
  const [keysOpen, setKeysOpen] = useState(false);
  // the nameplates along the top can be put away (the owner: "add as an option to remove the nameplates on the screen
  // during a fight in the ring"); kept with the game's settings, so the next match starts the same way
  const [plates, setPlates] = useState(() => engine.settings.ringPlates);
  const [, tick] = useState(0);
  const [m] = useState(() => {
    const out = new Match(setup);
    // (coming back to a match left while it was going: where it stood)
    if (resume) out.restore(resume, null);
    return out;
  });
  // the tutorial's lessons over this match (arena/tutorial.ts): the player against the first of the other side
  const [tut] = useState(() => (tutorial ? new TutorialRun(m, myId, m.fighters.find((f) => f.team !== m.fighters[myId]?.team)?.id ?? 1 - myId) : null));
  const [err, setErr] = useState('');
  const [errNote, setErrNote] = useState(false);
  const [hint, setHint] = useState('');
  const hintAt = useRef(0);
  const seenRef = useRef(new Set<string>(hints?.seen ?? []));
  // how the match goes for the player, for the one thing to try next time (arena/lessons.ts)
  const log = useRef(newLog());
  /** "Close in automatically": the ability pressed out of reach, walked toward until it can go off. */
  const chase = useRef<{ ab: string; until: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  // the match's own buttons, folded behind one small one beside the clock (the owner: "maybe you can hide the middle
  // buttons a bit more since theyre right in the middle of the screen, id like them to be somewhere subtle")
  const [menuOpen, setMenuOpen] = useState(false);
  const gameMenu = useGameMenu();
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [tip, setTip] = useState<Ability | null>(null);
  const errAt = useRef(0);
  const stick = useRef<MoveInput>({ mx: 0, my: 0 });
  // the titles over the fighters' heads (the owner: "the titles in the banner that are rolling up and down are cut off
  // ... i was thinking of adding the titles above the hp bar on the actual characters with the respective shader"):
  // the player's own, and each other one's from the match's setup (a person's, or a computer rival's rank)
  const titles = useMemo(() => m.fighters.map((f) => (f.pet ? null : f.id === myId ? (title ?? null) : (setup.fighters[f.id]?.title ?? null))), [m, myId, title, setup]);
  const titleEls = useRef<(HTMLSpanElement | null)[]>([]);
  /** The signs of the player's boons: a box moved to their hero each frame (ui/RingBoons.tsx). */
  const flaresEl = useRef<HTMLDivElement | null>(null);

  const me = m.fighters[myId] ?? null;
  const touch = engine.touchMode;
  const say = (why: string | null, ab?: Ability, note = false): void => {
    if (!why || why === 'Already casting' || why === 'Casting') return;
    if (why === 'Out of sight') log.current.outOfSight++;
    setErr(note ? why : plainWhy(m, me, why, ab));
    setErrNote(note);
    errAt.current = performance.now();
  };
  /** "Close in automatically" (Settings): an ability aimed at someone out of reach or out of sight walks there first. */
  const closeIn = (ab: Ability | undefined, why: string | null): boolean => {
    if (!ab || !engine.settings.ringCloseIn || (why !== 'Too far away' && why !== 'Out of sight') || (ab.aim !== 'enemy' && ab.aim !== 'friend')) return false;
    chase.current = { ab: ab.id, until: performance.now() + CHASE_MS };
    say('Closing in…', ab, true);
    return true;
  };
  const press = (id: string, at?: { x: number; y: number }): void => {
    if (!me) return;
    chase.current = null;
    const ab = ABILITIES[id];
    if (role.kind === 'client') {
      const why = ab ? m.blocked(me, ab, undefined, ab.aim === 'ground' ? at : undefined) : null;
      if (closeIn(ab, why)) return;
      if (why && why !== 'Not ready yet') say(why, ab);
      else role.send(at ? { p: id, at: [Math.round(at.x), Math.round(at.y)] } : { p: id });
      return;
    }
    const why = m.press(myId, id, at);
    if (closeIn(ab, why)) return;
    say(why, ab);
  };
  /*
   * A placed ability (a comet, a volley, a pyre) goes where its user puts it (the owner: "by targeted i mean not
   * auto aimed, like me aiming the circle"). On a touch screen, holding its button shows the circle at the hero's
   * feet and the thumb pushes it out, any way, to the ability's full reach; letting go drops it, and a plain tap
   * drops it on the target ("you can add auto aim yes"). With a mouse it is as in the old arenas ("for desktop it
   * should be similar to wow where u place it with mouse"): the key brings the circle up under the pointer, a click
   * drops it, Escape or the other button puts it away, and the key a second time drops it on the target. The
   * match's own loop keeps the circle, so these only pass the touches on.
   */
  const aimApi = useRef<AimApi>(NO_AIM);
  const [placing, setPlacing] = useState(false);
  // changing what you brought, while the gates are down
  const changeSets = (next: ClassSets): void => {
    onSets(next);
    const cur = next.list[next.active]!;
    if (m.equip(myId, cur) && role.kind === 'client') role.send({ eq: cur });
    tick((x) => x + 1);
  };
  const ready = (): void => {
    if (role.kind === 'client') return;
    m.openSoon();
    setEditing(false);
    tick((x) => x + 1);
  };
  const target = (id: number): void => {
    if (m.fighters[id]?.dead) return;
    if (role.kind === 'client') role.send({ tg: id });
    m.setTarget(myId, id);
    tut?.onTarget(id);
    tick((x) => x + 1);
  };
  /**
   * The next enemy, as Tab chooses: a phone's ◎ button over the top-right ability, the easiest way there is to
   * switch target.
   */
  /** The enemy that lies the way a thumb slides from the ◎ button, as seen on the screen (set where the view is). */
  const towardFoe = useRef<(dx: number, dy: number) => Fighter | null>(() => null);
  /** The ◎ button's slide: where it began, and whether it has gone far enough to be a slide rather than a tap. */
  const slide = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const nextFoe = (): void => {
    if (!me) return;
    const list = m.enemiesOf(me).filter((o) => !o.pet && !m.unseen(o, me));
    if (!list.length) return;
    const at = list.findIndex((f) => f.id === me.target);
    target(list[(at + 1) % list.length]!.id);
  };

  // the Ring's own music while a match is up (the title's comes back with the lobby)
  useEffect(() => {
    engine.setModeMusic('siege');
    return () => engine.setModeMusic(null);
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const looks = ringLooks(m, { face, body, wear, worn }, myId);
    const fx = new RingFx();
    const view = new RingStage(canvas, ringMapOf(m.map));
    view.still = !!engine.settings.reducedMotion;
    fx.still = view.still;
    const fit = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const host = canvas.parentElement!;
      view.fit(host.clientWidth, host.clientHeight, dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas.parentElement!);

    /* --------------------------------------------------- input */
    // where a point of the screen falls on the ground. The camera has depth to it, so there is no one rule for the
    // whole picture: from a first guess under the hero, the ground point is walked to the one that draws at that spot
    const toWorld = (cx: number, cy: number): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      const px = cx - r.left;
      const py = cy - r.top;
      let gx = me?.x ?? 0;
      let gy = me?.y ?? 0;
      for (let i = 0; i < 6; i++) {
        const a = view.stage.project(gx, gy);
        const b = view.stage.project(gx + 20, gy);
        const c = view.stage.project(gx, gy + 20);
        const ux = (b.x - a.x) / 20;
        const uy = (b.y - a.y) / 20;
        const vx = (c.x - a.x) / 20;
        const vy = (c.y - a.y) / 20;
        const det = ux * vy - vx * uy;
        if (Math.abs(det) < 1e-9) break;
        const dx = px - a.x;
        const dy = py - a.y;
        const sx = (dx * vy - vx * dy) / det;
        const sy = (ux * dy - dx * uy) / det;
        gx += sx;
        gy += sy;
        if (Math.abs(sx) + Math.abs(sy) < 0.05) break;
      }
      return { x: gx, y: gy };
    };
    // a placed ability being aimed. On a touch screen its button is held (`pid`) and the thumb pushes the circle
    // `ox, oy` out from the hero; with a mouse (`point`) the circle is under the pointer until a click drops it.
    let aim: (RingAim & { pid: number | null; point: boolean; pushed: boolean; sx: number; sy: number; ox: number; oy: number }) | null = null;
    const mouse = { x: 0, y: 0, seen: false };
    /** Where the circle is this moment: it goes with the hero, or with the pointer. */
    const placeAim = (): void => {
      if (!aim || !me) return;
      const w = aim.point && mouse.seen ? toWorld(mouse.x, mouse.y) : { x: me.x + aim.ox, y: me.y + aim.oy };
      aim.x = w.x;
      aim.y = w.y;
    };
    const startAim = (ab: Ability, sx: number, sy: number, pid: number | null, point: boolean): void => {
      if (!me) return;
      // (not ready, held: said at once, with nothing to place)
      const why = m.blocked(me, ab, undefined, { x: me.x, y: me.y });
      if (why) {
        aim = null;
        setPlacing(false);
        say(why);
        return;
      }
      aim = { ab: ab.id, x: me.x, y: me.y, pid, point, pushed: false, sx, sy, ox: 0, oy: 0 };
      setPlacing(point);
      placeAim();
    };
    /** Where a placed ability goes when it is simply sent (ringAim.ts). */
    const autoPoint = (id: string): { x: number; y: number } | undefined => pointFor(m, me, ABILITIES[id]);
    /** The circle is let go: dropped where it is, dropped on the target (`auto`), or put away. */
    const endAim = (how: 'place' | 'auto' | 'cancel'): void => {
      placeAim();
      const a = aim;
      aim = null;
      setPlacing(false);
      if (!a || how === 'cancel') return;
      press(a.ab, how === 'place' ? { x: a.x, y: a.y } : autoPoint(a.ab));
    };
    aimApi.current = {
      down: (e, ab) => {
        e.preventDefault();
        if (ab.aim !== 'ground') {
          if (aim) endAim('cancel');
          press(ab.id);
          return;
        }
        // with a mouse, as with its key: the circle comes up, and a click on the ground drops it
        if (e.pointerType === 'mouse') {
          placedKey(ab);
          return;
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* (no capture: the drag still works while the finger stays on the button) */
        }
        startAim(ab, e.clientX, e.clientY, e.pointerId, false);
      },
      move: (e) => {
        if (!aim || aim.pid !== e.pointerId) return;
        const ab = ABILITIES[aim.ab];
        const dx = e.clientX - aim.sx;
        const dy = e.clientY - aim.sy;
        const len = Math.hypot(dx, dy);
        if (!ab || len < AIM_SLACK) {
          aim.ox = 0;
          aim.oy = 0;
          return;
        }
        aim.pushed = true;
        // the way the thumb went, on the ground; as far as the thumb went, of the ability's reach
        const w0 = toWorld(aim.sx, aim.sy);
        const w1 = toWorld(e.clientX, e.clientY);
        const wl = Math.hypot(w1.x - w0.x, w1.y - w0.y) || 1;
        const far = ab.range * Math.min(1, len / AIM_THROW);
        aim.ox = ((w1.x - w0.x) / wl) * far;
        aim.oy = ((w1.y - w0.y) / wl) * far;
      },
      up: (e) => {
        // (a tap, the thumb never having pushed it anywhere: it goes on the target, as everything else does)
        if (aim?.pid === e.pointerId) endAim(aim.pushed ? 'place' : 'auto');
      },
      cancel: (e) => {
        if (aim?.pid === e.pointerId) endAim('cancel');
      },
    };
    const mouseMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = true;
    };
    window.addEventListener('pointermove', mouseMove);
    /** A placed ability is called for with a mouse to hand: its circle comes up; called for again, it goes on the target. */
    const placedKey = (ab: Ability): void => {
      if (aim?.point && aim.ab === ab.id) endAim('auto');
      else startAim(ab, mouse.x, mouse.y, null, true);
    };
    /**
     * Quick cast (Settings; the owner: "in the ring targeted spells could be quick cast"): a placed ability's key
     * drops it at once where the pointer is, as far as it reaches, with no circle to click. With no pointer seen yet
     * it goes on the target.
     */
    const quickKey = (ab: Ability): void => {
      if (aim) endAim('cancel');
      press(ab.id, me && mouse.seen ? m.reach(me, ab, toWorld(mouse.x, mouse.y)) : autoPoint(ab.id));
    };
    /** An ability's key goes down: a placed one shows its circle for a click to drop, anything else goes at once. */
    const keyPress = (id: string, e: KeyboardEvent): void => {
      const ab = ABILITIES[id];
      if (ab?.aim !== 'ground') {
        // (as in the old arenas: calling for something else puts the circle away)
        if (aim) endAim('cancel');
        press(id);
        return;
      }
      if (e.repeat) return;
      if (engine.settings.quickCast) quickKey(ab);
      else placedKey(ab);
    };
    const keys = new Set<string>();
    const cycle = (list: Fighter[], cur: number | null): number | null => {
      if (!list.length) return null;
      const at = list.findIndex((f) => f.id === cur);
      return list[(at + 1) % list.length]!.id;
    };
    const down = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return;
      // (while a key is being set, the keys are the dialog's)
      if (binding.current) return;
      const act = actionOf(keysRef.current, e.code);
      const n = act && act.startsWith('ab') ? Number(act.slice(2)) - 1 : -1;
      const foes = me ? m.heroes.filter((f) => f.team !== me.team) : [];
      const pals = me ? m.heroes.filter((f) => f.team === me.team && f.id !== me.id) : [];
      if (act && act !== 'up' && act !== 'down' && act !== 'left' && act !== 'right') e.preventDefault();
      if (n >= 0 && me?.bar[n]) keyPress(me.bar[n]!, e);
      // (behind the gates, the ready key says "ready")
      else if (act === 'dash' && m.phase === 'gates' && role.kind !== 'client') {
        if (m.gateAt - m.t > 5) ready();
      } else if (act === 'super' && me) keyPress(m.extras(me)[0]!.id, e);
      else if (act === 'nextFoe' && me) {
        const next = cycle(m.enemiesOf(me).filter((o) => !m.unseen(o, me)), me.target);
        if (next !== null) target(next);
      } else if (act === 'nextFriend' && me) {
        const next = cycle(m.friendsOf(me), me.friend ?? me.id);
        if (next !== null) target(next);
      } else if (act === 'self' && me) target(me.id);
      else if ((act === 'foe1' || act === 'foe2' || act === 'foe3') && me) {
        const f = foes[Number(act.slice(3)) - 1];
        if (f && !f.dead) target(f.id);
      } else if ((act === 'friend1' || act === 'friend2') && me) {
        const f = pals[Number(act.slice(6)) - 1];
        if (f && !f.dead) target(f.id);
      } else if (e.code === 'Escape' && aim) {
        // (a circle up: Escape puts it away, and nothing else)
        endAim('cancel');
      } else if (e.code === 'Escape') {
        setEditing(false);
        setHelp(false);
        setMenuOpen(false);
        setLeaving((x) => !x);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keys.delete(e.code);
    };
    const blur = (): void => {
      keys.clear();
      if (aim) endAim('cancel');
    };
    // a click or a tap on a fighter in the ring chooses them (an enemy to hit, an ally to help). Only on the ground
    // itself: a thumb coming down on the stick, or on the entry's words over it, chose whoever was drawn under it, and on
    // a phone the left thumb lands there all the time. A nameplate tapped to change target was undone the next time it
    // did, back to the enemy beside you (the owner: "sometimes i have to click 3-4 times on my phone in order to swap
    // the target")
    const pick = (e: PointerEvent): void => {
      if (e.target !== canvas) return;
      // a circle under the mouse: the click drops it there (the other button puts it away), and chooses nobody
      if (aim?.point) {
        e.preventDefault();
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.seen = true;
        endAim(e.button === 0 ? 'place' : 'cancel');
        return;
      }
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      let best: Fighter | null = null;
      let bd = e.pointerType === 'touch' ? 44 : 30;
      for (const f of m.fighters) {
        const viewer = m.fighters[myId];
        if (f.dead || (viewer && m.unseen(f, viewer))) continue;
        // (anywhere on them, feet to head)
        for (const h of [4, 16, 28]) {
          const s = view.stage.project(f.x, f.y, h);
          const d = Math.hypot(s.x - px, s.y - py);
          if (d < bd) {
            bd = d;
            best = f;
          }
        }
      }
      if (best) target(best.id);
    };
    // the ◎ button's slide: the enemy on the screen nearest the way the thumb went, from the hero
    towardFoe.current = (dx, dy) => {
      if (!me) return null;
      const from = view.stage.project(me.x, me.y, 16);
      const len = Math.hypot(dx, dy) || 1;
      let best: Fighter | null = null;
      let bestCos = 0.35;
      for (const o of m.enemiesOf(me)) {
        if (o.pet || m.unseen(o, me)) continue;
        const at = view.stage.project(o.x, o.y, 16);
        const ox = at.x - from.x;
        const oy = at.y - from.y;
        const cos = (ox * dx + oy * dy) / ((Math.hypot(ox, oy) || 1) * len);
        if (cos > bestCos) {
          bestCos = cos;
          best = o;
        }
      }
      return best;
    };
    const host = canvas.parentElement!;
    host.addEventListener('pointerdown', pick, true);
    // (the other mouse button puts a circle away: no menu over the ground for it)
    const noMenu = (e: MouseEvent): void => {
      if (!(e.target as HTMLElement | null)?.closest('button, [role="dialog"]')) e.preventDefault();
    };
    host.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const moveNow = (): MoveInput => {
      const k = keysRef.current;
      const mx = (keys.has(k.right) || keys.has('ArrowRight') ? 1 : 0) - (keys.has(k.left) || keys.has('ArrowLeft') ? 1 : 0);
      const my = (keys.has(k.down) || keys.has('ArrowDown') ? 1 : 0) - (keys.has(k.up) || keys.has('ArrowUp') ? 1 : 0);
      // (moving by hand stops a walk the game was taking toward a target)
      if (mx || my) {
        chase.current = null;
        return { mx, my };
      }
      const st = stick.current;
      if (Math.hypot(st.mx, st.my) > 0.2) {
        chase.current = null;
        return st;
      }
      return chaseMove() ?? st;
    };
    /** "Close in automatically": a step toward whoever the pressed ability goes to, and the ability itself once it can go. */
    const chaseMove = (): MoveInput | null => {
      const c = chase.current;
      if (!c || !me) return null;
      const ab = ABILITIES[c.ab];
      const t = ab ? m.aimOf(me, ab) : null;
      if (!ab || !t || t.dead || t === me || m.phase !== 'fight' || me.dead || performance.now() > c.until) {
        chase.current = null;
        return null;
      }
      const why = m.blocked(me, ab);
      if (why !== 'Too far away' && why !== 'Out of sight') {
        chase.current = null;
        press(c.ab);
        return { mx: 0, my: 0 };
      }
      return steerTo(m, me, t.x, t.y);
    };

    /* --------------------------------------------------- the room's traffic */
    const others: Record<number, MoveInput> = {};
    if (role.kind === 'host') {
      role.listen((seat, d) => {
        const f = m.fighters.find((x) => x.seat === seat);
        if (!f || !d || typeof d !== 'object') return;
        const q = d as { mx?: unknown; my?: unknown; p?: unknown; at?: unknown; tg?: unknown; eq?: { bar?: unknown; talents?: unknown; ult?: unknown } };
        const eq = q.eq;
        if (eq && Array.isArray(eq.bar) && eq.bar.length <= 12 && eq.bar.every((b) => typeof b === 'string')) m.equip(f.id, { bar: eq.bar as string[], talents: Array.isArray(eq.talents) ? (eq.talents.filter((b) => typeof b === 'string').slice(0, 3) as string[]) : [], ult: typeof eq.ult === 'string' ? eq.ult : undefined });
        if (typeof q.mx === 'number' && typeof q.my === 'number' && Number.isFinite(q.mx) && Number.isFinite(q.my)) others[f.id] = { mx: Math.max(-1, Math.min(1, q.mx)), my: Math.max(-1, Math.min(1, q.my)) };
        // (press checks it's on their bar, and the rules, as for anyone)
        // (a placed ability comes with where: two plain numbers, which the rules bring into reach and sight)
        const at = Array.isArray(q.at) && q.at.length === 2 && q.at.every((n) => typeof n === 'number' && Number.isFinite(n)) ? { x: q.at[0] as number, y: q.at[1] as number } : undefined;
        if (typeof q.p === 'string') m.press(f.id, q.p, at);
        if (typeof q.tg === 'number' && Number.isInteger(q.tg)) m.setTarget(f.id, q.tg);
      });
    } else if (role.kind === 'client') {
      role.listen((_seat, d) => {
        const q = d as { s?: Snapshot; e?: Match['events'] };
        if (!q?.s || !Array.isArray(q.s.f)) return;
        m.restore(q.s, myId);
        if (Array.isArray(q.e)) m.events.push(...q.e);
      });
    }

    /* --------------------------------------------------- the loop */
    const hintKeys = (): HintKeys => ({ touch, dash: keyName(keysRef.current.dash), super: keyName(keysRef.current.super) });
    // (the match's own record of whose falling circles are whose, for the log)
    const circles = new Map<string, boolean>();
    let logged = 0;
    const brains = m.fighters.map((_, i) => newBrain(setup.seed + i * 97));
    const skill = role.kind === 'client' ? 0 : role.skill;
    const myTeam0 = m.fighters[myId]?.team;
    const sharpOf = (f: Fighter): number => (role.kind === 'solo' && role.mates !== undefined && f.team === myTeam0 ? role.mates : skill);
    let last = performance.now();
    let sendT = 0;
    let lastSent = '';
    let hudT = 0;
    let snapT = 0;
    let done = false;
    let raf = 0;
    let wasPhase = m.phase;
    const sound = (id: string, vol?: number): void => engine.sound.play(id, vol);
    let lastPaint = 0;
    let wasShown = m.phase;
    /**
     * The bodies answer what happened: a blow's own move, a flinch, the picture shaken, the crowd. Once for each event,
     * as it comes. (This was read in the painting, after the effects had taken the events and cleared them: alone or
     * as a guest nobody's blows were ever drawn, and a host, whose events wait to go out ten times a second, started
     * each blow over on every frame until they went, then let it lunge, while what goes about a body stayed on its
     * spot: the Gloamknight's gloam jumped about him in a match against a player.)
     */
    let reacted = 0;
    const react = (): void => {
      for (let i = reacted; i < m.events.length; i++) {
        const e = m.events[i]!;
        if (e.k === 'ab') view.swing(e.id, e.ab, m.fighters[e.id]?.cast?.ab === e.ab);
        // (a blow that took a real bite, not a curse's tick)
        else if (e.k === 'num' && e.kind === 'dmg' && e.n >= 26) {
          view.hurt(e.id, e.crit || e.n >= 110);
          // (a heavy one is felt: harder when it is you who took it)
          if (e.n >= 80) view.shake(e.id === myId ? 2.6 : 1.5);
        } else if (e.k === 'super') view.shake(2.2);
        // (what was placed comes down)
        else if (e.k === 'zone') view.shake(ABILITIES[e.ab]?.super ? 3 : 1.2);
        // (somebody's down: the crowd is on its feet; not for the raised dead going back into the ground)
        else if (e.k === 'death' && !m.fighters[e.id]?.pet) view.cheer();
      }
      reacted = m.events.length;
    };
    const paint = (time: number): void => {
      const dt = lastPaint ? Math.min(0.1, Math.max(0, time - lastPaint)) : 0;
      lastPaint = time;
      if (m.phase !== wasShown) {
        wasShown = m.phase;
        view.cheer(m.phase === 'fight' ? 0.7 : m.phase === 'over' ? 1 : 0);
      }
      // (with thumbs on a phone, the camera frames the fight in the open middle, away from the controls: ring3d.ts)
      view.thumbs = engine.touchMode;
      view.frame(m, looks, myId, dt, time, (q) => ringSpells(q, m, fx, myId, time, view.air, (f) => view.bodyAt(f)));
      placeAim();
      // each title over its fighter's bar, in its own light, where the bar is drawn this frame; what's on them goes up
      // over it to make room
      const raise: number[] = [];
      for (let i = 0; i < titleEls.current.length; i++) {
        const el = titleEls.current[i];
        const f = m.fighters[i];
        if (!el) continue;
        const viewer = m.fighters[myId];
        if (!f || f.dead || (viewer && m.unseen(f, viewer))) {
          el.style.visibility = 'hidden';
          continue;
        }
        const h = headHeight(f, time);
        const a = view.stage.project(f.x, f.y, h);
        const b = view.stage.project(f.x + 10, f.y, h);
        const s = Math.max(0.2, (b.x - a.x) / 10);
        el.style.visibility = 'visible';
        el.style.transform = `translate(${a.x.toFixed(1)}px, ${(a.y - (barTop(f) + 1.2) * s).toFixed(1)}px) translate(-50%, -100%)`;
        raise[i] = (el.offsetHeight + 1) / s;
      }
      // the signs of the player's boons, about their own hero: at the middle of the body, in the ground's units
      const flares = flaresEl.current;
      const hero = m.fighters[myId];
      if (flares && hero) {
        const mid = headHeight(hero, time) * 0.55;
        const a = view.stage.project(hero.x, hero.y, mid);
        const b = view.stage.project(hero.x + 10, hero.y, mid);
        flares.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) scale(${Math.max(0.2, (b.x - a.x) / 10).toFixed(3)})`;
        flares.style.visibility = 'visible';
      }
      drawRing(m, fx, myId, time, view, aim, (f) => raise[f.id] ?? 0);
    };
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      // (a phone's screen may run at 120: the fight looks no better for it, and the heat slows it down)
      if (engine.touchMode && now - last < 1000 / 66) return;
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      const mine = moveNow();
      let sent: Match['events'] | null = null;
      if (role.kind !== 'client') {
        // the fight moves by the frame's own length (in pieces no longer than MAX_STEP when a frame ran long): fixed
        // steps against a screen that is never quite regular made everyone stutter, a step missed here, two there
        const pieces = Math.max(1, Math.ceil(dt / MAX_STEP));
        // (the tutorial slows the match while a red circle falls on a newcomer)
        const h = (dt * PACE * (tut?.pace() ?? 1)) / pieces;
        for (let i = 0; i < pieces && h > 0; i++) {
          const moves: Record<number, MoveInput> = { [myId]: mine };
          for (const f of m.fighters) {
            if (f.id === myId) continue;
            if (f.seat !== null) moves[f.id] = others[f.id] ?? { mx: 0, my: 0 };
            // (while the tutorial teaches, its sparring partner only does what the lesson needs)
            else if (tut && !tut.free) moves[f.id] = f.id === tut.foeId ? tut.foeMove() : { mx: 0, my: 0 };
            else moves[f.id] = botThink(m, f, brains[f.id]!, sharpOf(f), h);
          }
          m.step(h, moves);
        }
        tut?.after(h * pieces);
        // (in the tutorial only its last, real fight is kept: the lessons before it are no measure of anything)
        if (!tut || tut.free) keepLog(log.current, m, me, h * pieces, circles, m.events.slice(logged));
        logged = m.events.length;
        if (role.kind === 'host') {
          sendT += dt;
          if (sendT >= SEND_EVERY) {
            sendT = 0;
            sent = [...m.events];
            role.send({ s: m.snapshot(), e: sent });
          }
        }
      } else {
        // (by the host's clock: it runs the fight at PACE, and a guest's copy that ran at the wall's ran everyone a
        // little ahead between its words, to be pulled back at each)
        m.coast(dt * PACE, myId, mine);
        keepLog(log.current, m, me, dt * PACE, circles, m.events.slice(logged));
        logged = m.events.length;
        sendT += dt;
        const said = `${mine.mx.toFixed(2)},${mine.my.toFixed(2)}`;
        if (sendT >= 1 / 15 && said !== lastSent) {
          sendT = 0;
          lastSent = said;
          role.send({ mx: mine.mx, my: mine.my });
        }
      }
      react();
      // (a host's events go out only as often as it speaks: the ones between wait to be drawn with them)
      if (role.kind !== 'host' || sent) {
        fx.take(m, sound, myId);
        reacted = 0;
        logged = 0;
      }
      fx.age(dt);
      if (m.phase !== wasPhase) {
        if (m.phase === 'fight') {
          sound('checkpoint');
          setEditing(false);
        }
        wasPhase = m.phase;
      }
      paint(now / 1000);
      // the cast bars move every frame, not with the rest of the HUD
      for (const el of document.querySelectorAll<HTMLElement>('[data-cast]')) {
        const c = m.fighters[Number(el.dataset.cast)]?.cast;
        if (c) el.style.width = `${castShare(c) * 100}%`;
      }
      hudT += dt;
      snapT += dt;
      if (onSnap && snapT > 2 && m.phase !== 'over') {
        snapT = 0;
        onSnap(m.snapshot());
      }
      if (hudT > 0.066) {
        hudT = 0;
        if (errAt.current && now - errAt.current > 1400) {
          errAt.current = 0;
          setErr('');
        }
        // a hint the first time something happens (arena/lessons.ts): one at a time, each once on this device
        if (hintAt.current && now - hintAt.current > HINT_MS) {
          hintAt.current = 0;
          setHint('');
        }
        if (hints && !tut && !hintAt.current) {
          const next = hintNow(m, me, [...seenRef.current], hintKeys());
          if (next) {
            seenRef.current.add(next.id);
            hints.onSeen(next.id);
            hintAt.current = now;
            setHint(next.text);
          }
        }
        tick((x) => x + 1);
      }
      if (m.phase === 'over' && !done) {
        done = true;
        const myTeam = m.fighters[myId]?.team;
        sound(m.winner === myTeam ? 'victory' : 'playerDie');
        // the last word goes out at once, then a moment to see the last blow land
        if (role.kind === 'host') role.send({ s: m.snapshot(), e: [] });
        const won = m.winner === myTeam;
        const lesson = !won && me ? lessonOf(log.current, me, hintKeys()) : null;
        window.setTimeout(() => onDone({ won, draw: m.draw, match: m, myId, dolls: m.fighters.map((f) => heroDollUrl(looks[f.id]!.look, 'down', 3, looks[f.id]!.held)), lesson }), 1300);
      }
    };
    // the ground on the first frame, before the veil lifts
    paint(performance.now() / 1000);
    raf = requestAnimationFrame(frame);
    // review tool on the dev server: a hidden pane runs no animation frames, so a match can be fast-forwarded by hand
    if (import.meta.env.DEV) {
      const run = (seconds: number): void => {
        for (let i = 0; i < seconds / STEP && m.phase !== 'over'; i++) {
          const moves: Record<number, MoveInput> = {};
          for (const f of m.fighters) moves[f.id] = f.id === myId ? moveNow() : botThink(m, f, brains[f.id]!, sharpOf(f), STEP);
          m.step(STEP, moves);
        }
        react();
        paint(performance.now() / 1000);
        tick((x) => x + 1);
      };
      (window as unknown as { __ring?: unknown }).__ring = { m, keys, press, run, brains, botThink, paint, view, fx, tut };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('pointermove', mouseMove);
      aimApi.current = NO_AIM;
      host.removeEventListener('pointerdown', pick, true);
      host.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
        if (role.kind !== 'solo') role.listen(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const teamOf = (t: 0 | 1): Fighter[] => m.heroes.filter((f) => f.team === t);
  // (one of the raised dead wears its master's face on a card)
  const dollOf = (f: Fighter): string => classEmblem(m.masterOf(f).cls);
  const mine = me?.team ?? 0;
  const left = teamOf(mine);
  const right = teamOf(mine === 0 ? 1 : 0);
  const bar = me ? [...me.bar.map((id) => ABILITIES[id]!), ...m.extras(me)] : [];
  const keyOf = (i: number): string => keyName(i < SLOTS ? ringKeys[`ab${i + 1}` as 'ab1'] : ringKeys.super);
  const charge = me?.charge ?? 0;
  const count = Math.ceil(m.gateAt - m.t);
  const cast = me?.cast;
  const castAb = cast ? ABILITIES[cast.ab] : null;
  const damp = Math.round(m.dampening * 100);
  const foe = me && me.target !== null ? (m.fighters[me.target] ?? null) : null;
  const foeAlive = foe && !foe.dead ? foe : null;
  const friendId = me?.friend ?? me?.id ?? 0;
  const friend = m.fighters[friendId] ?? null;
  const helps = bar.some((a) => a.aim === 'friend');
  const held = me && m.held(me);
  /**
   * Why an ability's button glows, in a word or two: a boon it would use, as many points as can be held for it to
   * spend, or the combo it would land now on whoever it would go to (arena/sim.ts lit).
   */
  // (on whoever the ability would really go to: the chosen enemy, else the nearest, as the rules pick; a burst round
  // the hero, on anyone it would reach)
  const comboOf = (ab: Ability): string | null => {
    if (!me || m.phase !== 'fight') return null;
    if (ab.aim === 'near') return m.lit(me, ab, null) ?? (ab.combo && m.enemiesOf(me).some((o) => Math.hypot(o.x - me.x, o.y - me.y) <= ab.range && m.comboReady(me, ab, o)) ? ab.combo.name : null);
    return m.lit(me, ab, m.aimOf(me, ab));
  };
  /** Lit by a boon that works for as long as it lasts (the Rime's globe on its spear), which has a chip of its own. */
  const quietLit = (ab: Ability): boolean => !!me && !!BOONS[m.boonFor(me, ab)?.boon ?? '']?.quiet;
  /** With a boon that makes it ready at once, an ability's cooldown is nothing to wait for. */
  const cdOf = (ab: Ability): number => (me && !m.boonFor(me, ab)?.nocd ? (me.cds[ab.id] ?? 0) : 0);
  const foeNote = !foeAlive ? (m.phase === 'fight' ? `Click someone or press ${keyName(ringKeys.nextFoe)}. Nearest is used if you don’t.` : `Click someone or press ${keyName(ringKeys.nextFoe)}`) : !me || m.phase !== 'fight' ? `${Math.round((foeAlive.hp / foeAlive.maxHp) * 100)}%` : !m.sees(me, foeAlive) ? 'Out of sight' : `${Math.round((foeAlive.hp / foeAlive.maxHp) * 100)}% · ${reachWord(me, foeAlive)}`;
  const foeBad = !!foeAlive && !!me && m.phase === 'fight' && !m.sees(me, foeAlive);
  const tutKeys: TutorialKeys = { touch, ab: [ringKeys.ab1, ringKeys.ab2, ringKeys.ab3, ringKeys.ab4].map(keyName), dash: keyName(ringKeys.dash), super: keyName(ringKeys.super), nextFoe: keyName(ringKeys.nextFoe), nextFriend: keyName(ringKeys.nextFriend), closeIn: engine.settings.ringCloseIn };
  const tv = tut?.view(tutKeys) ?? null;
  useSpot(tv?.spot ?? null);
  useLabels(tv?.labels);
  return (
    <ScreenGate label="Entering the Ring">
      <div className={`rb-ring${touch ? ' is-touch' : ''}${engine.settings.reducedMotion ? ' is-still' : ''}`}>
        <div className="rb-ring-stage">
          <canvas ref={canvasRef} className="rb-ring-canvas" />
          <div className="rb-ring-titles" aria-hidden="true">
            {titles.map(
              (t, i) =>
                t?.text && (
                  <span
                    key={i}
                    ref={(el) => {
                      titleEls.current[i] = el;
                    }}
                    className="rb-ring-overhead"
                  >
                    <TitleFx fx={t.fx}>{t.text}</TitleFx>
                  </span>
                ),
            )}
          </div>
          <div className="rb-ring-top">
            {/* (with the nameplates put away their places stay, empty, so the clock keeps to the middle) */}
            <div className="rb-ring-team" onPointerDown={(e) => nearestPlate(e, left, target)} data-tut="plates">
              {plates && left.map((f) => (
                <Frame key={f.id} f={f} m={m} me={me} doll={classEmblem(f.cls)} title={f.id === myId ? (title ?? null) : null} frame={setup.fighters[f.id]?.frame ?? null} tag={helps && f.id === friendId && m.phase === 'fight' ? 'Helping' : null} onPick={() => target(f.id)} />
              ))}
            </div>
            {/* the middle, between the nameplates: the clock, the match's buttons (out of the corner, where a phone's own
                edge took the taps meant for the top enemy's nameplate), a hint, and the tutorial's words, all as wide as
                the room between the nameplates and no wider (the owner: "the tutorial is overlapping with the ui") */}
            <div className="rb-ring-mid">
              <div className="rb-ring-clock" data-tut="clock">
                <button type="button" className={`rb-ring-more${menuOpen ? ' is-on' : ''}`} aria-label="Match menu" aria-haspopup="menu" aria-expanded={menuOpen} title="Nameplates, keys, help, leave" onClick={() => setMenuOpen((o) => !o)}>
                  ⋯
                </button>
                {menuOpen && (
                  <div className="rb-ring-menu" role="menu" aria-label="Match menu">
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={plates}
                      onClick={() => {
                        engine.setSettings({ ringPlates: !plates });
                        // (written now: the game's own saving waits for its world to tick, and none does during a match)
                        engine.persist();
                        setPlates(!plates);
                        setMenuOpen(false);
                      }}
                    >
                      {plates ? 'Hide the nameplates' : 'Show the nameplates'}
                    </button>
                    {!touch && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setKeysOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Keys
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHelp(true);
                        setMenuOpen(false);
                      }}
                    >
                      How the Ring works
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLeaving(true);
                        setMenuOpen(false);
                      }}
                    >
                      {tut ? 'Leave the tutorial' : 'Leave the match'}
                    </button>
                    {gameMenu && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          gameMenu();
                        }}
                      >
                        Game menu
                      </button>
                    )}
                  </div>
                )}
                <b>{clock(m.clock)}</b>
                {stakes ? (
                  <span className="rb-ring-rating" style={{ ['--r' as string]: stakes.color }} title={`${stakes.rank}. ${stakes.format}v${stakes.format} rating`}>
                    <i aria-hidden="true">◆</i>
                    {stakes.rating}
                    <small>{stakes.rank}</small>
                  </span>
                ) : (
                  <span className="rb-ring-rating is-friendly">{tut ? 'Tutorial' : 'Friendly'}</span>
                )}
                {damp > 0 && <small className={`rb-ring-damp${damp >= 100 ? ' is-gone' : ''}`} title="Healing and shields fade the longer a match goes, until none is left">{damp >= 100 ? 'No healing' : `Healing weaker: −${damp}%`}</small>}
              </div>
              {hint && !err && (
                <div className="rb-ring-hint" role="status">
                  <b>Tip</b> {hint}
                </div>
              )}
              {tv && tv.id !== 'gates' && (
                <Coach
                  key={tv.id}
                  inline
                  n={tv.n}
                  of={tv.of}
                  title={tv.title}
                  text={tv.text}
                  short={tv.short}
                  note={tv.note}
                  small={tv.id === 'fight' && (tut?.fightT ?? 0) > 6}
                  onNext={
                    tv.next
                      ? () => {
                          tut?.next();
                          tick((x) => x + 1);
                        }
                      : undefined
                  }
                  onSkip={() => setLeaving(true)}
                />
              )}
            </div>
            <div className="rb-ring-team is-foes" onPointerDown={(e) => nearestPlate(e, right, target)} data-tut="foes">
              {plates && right.map((f) => (
                <Frame key={f.id} flip f={f} m={m} me={me} doll={classEmblem(f.cls)} title={titles[f.id] ?? null} frame={setup.fighters[f.id]?.frame ?? null} tag={f === foeAlive ? 'Target' : null} onPick={() => target(f.id)} />
              ))}
            </div>
          </div>
          {/* (a fallen fighter has nothing to press: the stick and the abilities step aside and leave the whole ring to watch) */}
          {touch && !(me?.dead && m.phase === 'fight') && (
            <div className="rb-ui rb-ring-thumbs">
              <Stick
                settings={engine.settings}
                onMove={(mx, my) => {
                  stick.current = { mx, my };
                }}
              />
              <div className="rb-cluster" data-tut="bar">
              {/* with two or more on the other side: a button to switch between them, over the top-right ability, out of the
                  arc (the owner, 2026-11-16: "move the target button to be right above the spells on top of the normal
                  righterst one, currently its below the nameplates"; before that it was beside a spell in the arc) */}
              {touch && right.length > 1 && (
                <button
                  type="button"
                  className="rb-ring-cycle"
                  disabled={right.filter((f) => !f.dead).length < 2}
                  aria-label={`Switch target${foeAlive ? `, now ${foeAlive.name}` : ''}. Tap for the next enemy, or slide toward one`}
                  // (a tap: the next enemy, as Tab. A slide: the enemy the way the thumb goes, chosen as it goes)
                  onPointerDown={(e) => {
                    e.preventDefault();
                    // (not the column's own press, which chooses whichever nameplate is nearest)
                    e.stopPropagation();
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* (no capture: the slide still works while the thumb stays on the button) */
                    }
                    slide.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
                  }}
                  onPointerMove={(e) => {
                    const sl = slide.current;
                    if (!sl || sl.id !== e.pointerId) return;
                    const dx = e.clientX - sl.x;
                    const dy = e.clientY - sl.y;
                    if (Math.hypot(dx, dy) < 14) return;
                    sl.moved = true;
                    const o = towardFoe.current(dx, dy);
                    if (o && o.id !== me?.target) target(o.id);
                  }}
                  onPointerUp={(e) => {
                    const sl = slide.current;
                    slide.current = null;
                    if (sl?.id === e.pointerId && !sl.moved) nextFoe();
                  }}
                  onPointerCancel={() => {
                    slide.current = null;
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* a crosshair: what it is for, at a glance */}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  </svg>
                </button>
              )}
                {/* over the cluster: the points held and the boons carried (ui/RingBoons.tsx) */}
                {me && m.phase === 'fight' && (me.points || me.boons.length > 0) && (
                  <span className="rb-ring-combo-strip">
                    {me.points && <Pips points={me.points} n={me.pts} />}
                    <BoonChips boons={me.boons} />
                  </span>
                )}
                {bar.map((ab, i) => {
                  const cd = cdOf(ab);
                  const gcd = !ab.free ? (me?.gcd ?? 0) : 0;
                  const wait = Math.max(cd, gcd);
                  const full = cd > gcd ? ab.cd : 1;
                  const sup = !!ab.super;
                  return (
                    <button
                      key={ab.id}
                      data-tut={sup ? 'super' : undefined}
                      className={`rb-sb rb-sb-${sup ? 'ult' : TOUCH_SLOTS[i]}${sup ? ` is-super${charge >= 1 ? ' is-ready' : ''}` : ''}${isOut(m, me, ab) ? ' is-nomana' : ''}${wait > 0 ? ' is-cooling' : ''}${held && ab.anyState ? ' is-free-now' : ''}${comboOf(ab) && wait <= 0 && (!sup || charge >= 1) ? ' is-combo' : ''}`}
                      style={sup ? { ['--fill' as string]: `${Math.round(charge * 100)}%` } : undefined}
                      aria-label={sup ? `${ab.name} (super, ${Math.round(charge * 100)}% charged): ${ab.text}` : `${ab.name}: ${ab.text}`}
                      onPointerDown={(e) => aimApi.current.down(e, ab)}
                      onPointerMove={(e) => aimApi.current.move(e)}
                      onPointerUp={(e) => aimApi.current.up(e)}
                      onPointerCancel={(e) => aimApi.current.cancel(e)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <img className="is-disc" src={iconPicture(ab.icon)} alt="" draggable={false} />
                      <span className="rb-sb-cd" style={{ background: wait > 0 ? `conic-gradient(rgba(10,6,20,0.72) ${Math.min(1, wait / (full || 1)) * 100}%, transparent 0)` : 'transparent' }} />
                      <span className="rb-sb-num">{cd > 0.95 ? Math.ceil(cd) : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {m.phase === 'gates' && count <= 5 && (
            <div className="rb-ring-gates">
              <b key={count}>{count > 0 ? count : 'Fight!'}</b>
            </div>
          )}
          {m.phase === 'gates' && count > 5 && !editing && (
            <div className="rb-ring-prep" role="status" data-tut="prep">
              <small>{MAPS[m.map]?.name}</small>
              <strong>The gates lift in {count}</strong>
              {stakes ? (
                <>
                  <span className="rb-ring-prep-rival">
                    Against <b>{stakes.rival}</b> · rated about {stakes.rivalRating}
                  </span>
                  <span className="rb-ring-prep-stakes" style={{ ['--r' as string]: stakes.color }}>
                    <span>
                      Your rating <b>{stakes.rating}</b> {stakes.rank}
                    </span>
                    <em className="is-up">Win +{stakes.win}</em>
                    <em className="is-down">Lose −{stakes.lose}</em>
                  </span>
                </>
              ) : (
                <span className="rb-ring-prep-rival">{tut ? 'A tutorial match against a sparring partner: your rating doesn’t change.' : 'A friendly match: no rating changes hands.'}</span>
              )}
              {tv?.id === 'gates' && (
                <span className="rb-ring-prep-tut">
                  <b>
                    Tutorial · {tv.n} of {tv.of}: {tv.title}.
                  </b>{' '}
                  {tv.text}
                </span>
              )}
              {m.healK > 1 && <span className="rb-ring-prep-rival">Healing is {Math.round((m.healK - 1) * 100)}% stronger in a fight this size.</span>}
              <span className="rb-ring-prep-actions">
                {role.kind !== 'client' && (
                  <button className="rb-btn is-gold" onClick={ready} autoFocus>
                    I’m ready{touch ? '' : ` (${keyName(ringKeys.dash)})`}
                  </button>
                )}
                <button className={`rb-btn${role.kind === 'client' ? ' is-gold' : ''}`} onClick={() => setEditing(true)}>
                  Change my setup
                </button>
              </span>
              <span className="rb-ring-prep-keys">{touch ? 'Left thumb to move, right thumb for abilities. The gold button is your super, once it’s full. Walk out of a red circle before it lands. A placed ability: tap it to drop it on your target, or hold it and push the circle where you want it.' : `${[ringKeys.up, ringKeys.left, ringKeys.down, ringKeys.right].map(keyName).join('')} to move · ${keyName(ringKeys.ab1)} to ${keyName(ringKeys.ab4)} for abilities · ${keyName(ringKeys.super)} for your super · Walk out of a red circle before it lands · A placed ability: press its key, then click where it should land`}</span>
            </div>
          )}
          {err && (
            <div className={`rb-ring-err${errNote ? ' is-note' : ''}`} role="status">
              {err}
            </div>
          )}
          {menuOpen && <div className="rb-ring-menu-away" onPointerDown={() => setMenuOpen(false)} aria-hidden="true" />}
          {placing && !err && (
            <div className="rb-ring-err is-note" role="status">
              Click where it should land · Esc to put it away
            </div>
          )}
          {cast && castAb && (
            <div className="rb-ring-mycast" style={{ ['--a' as string]: castAb.color }}>
              <i data-cast={myId} style={{ width: `${castShare(cast) * 100}%` }} />
              <b>{castAb.name}</b>
            </div>
          )}
          {tip && !touch && me && (
            <div className="rb-ring-tip" role="tooltip">
              <SpellTip ab={tip} cls={me.cls} bar={me.bar} talents={me.talents} />
            </div>
          )}
          {/* a boon that lights an ability up: its sign either side of the hero until it is used (ui/RingBoons.tsx) */}
          {me && !me.dead && m.phase === 'fight' && <BoonFlares boons={me.boons} at={flaresEl} />}
          {m.phase === 'over' && (
            <div className="rb-ring-gates is-end">
              <b>{m.draw ? 'Draw' : m.winner === me?.team ? 'Victory' : 'Defeat'}</b>
            </div>
          )}
        </div>
        {!touch && (
          <div className="rb-ring-dock">
            <AimCard label="Target" kind="foe" f={foeAlive} note={foeNote} bad={foeBad} doll={foeAlive ? dollOf(foeAlive) : ''} />
            <div className="rb-ring-actions" role="toolbar" aria-label="Abilities" data-tut="bar">
              {/* over the bar: the points held and the boons carried (ui/RingBoons.tsx) */}
              {me && m.phase === 'fight' && (me.points || me.boons.length > 0) && (
                <span className="rb-ring-combo-strip">
                  {me.points && <Pips points={me.points} n={me.pts} />}
                  <BoonChips boons={me.boons} />
                </span>
              )}
              {bar.map((ab, i) => {
                const cd = cdOf(ab);
                const gcd = !ab.free ? (me?.gcd ?? 0) : 0;
                const wait = Math.max(cd, gcd);
                const full = cd > gcd ? ab.cd : 1;
                const sup = !!ab.super;
                // (a super is lit only once it can be used)
                const lit = !sup || charge >= 1 ? comboOf(ab) : null;
                return (
                  <button key={ab.id} data-tut={sup ? 'super' : undefined} className={`rb-ring-ab${isOut(m, me, ab) ? ' is-out' : ''}${sup ? ` is-super${charge >= 1 ? ' is-full' : ''}` : ''}${held && ab.anyState ? ' is-ready' : ''}${lit ? ' is-combo' : ''}`} style={sup ? { ['--fill' as string]: `${Math.round(charge * 100)}%` } : undefined} onPointerDown={(e) => aimApi.current.down(e, ab)} onPointerMove={(e) => aimApi.current.move(e)} onPointerUp={(e) => aimApi.current.up(e)} onPointerCancel={(e) => aimApi.current.cancel(e)} onMouseEnter={() => setTip(ab)} onMouseLeave={() => setTip(null)} aria-label={sup ? `${ab.name} (super, ${Math.round(charge * 100)}% charged): ${ab.text}` : `${ab.name}: ${ab.text}`}>
                    <img src={iconPicture(ab.icon)} alt="" draggable={false} />
                    {sup && charge < 1 && <i className="rb-ring-charge" />}
                    {wait > 0 && <i className="rb-ring-cool" style={{ ['--p' as string]: `${Math.min(1, wait / (full || 1)) * 100}%` }} />}
                    {cd > 0.05 && <b>{cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)}</b>}
                    {sup && charge < 1 && <b className="is-charge">{Math.floor(charge * 100)}%</b>}
                    <kbd>{keyOf(i)}</kbd>
                    {/* (named over its button, but for a spell's own quiet while: that is on its chip, and two long names side by side ran into each other) */}
                    {lit && !quietLit(ab) && <span className="rb-ring-combo-tag">{lit}</span>}
                  </button>
                );
              })}
            </div>
            {helps ? <AimCard label="Helping" kind="friend" f={friend} note={friend ? `${Math.round((friend.hp / friend.maxHp) * 100)}%` : ''} bad={false} doll={friend ? dollOf(friend) : ''} /> : <span className="rb-ring-aim is-blank" />}
          </div>
        )}
        {editing && m.phase === 'gates' && me && (
          <div className="rb-ring-editing" role="dialog" aria-label="Change my setup">
            <header>
              <strong>Your setup</strong>
              <span>
                Gates lift in <b>{count}</b>
              </span>
              <button className="rb-btn is-small is-gold" onClick={() => setEditing(false)}>
                Done
              </button>
            </header>
            <SetupEditor cls={me.cls} sets={sets} onSets={changeSets} />
          </div>
        )}
        {help && <RingHelp onClose={() => setHelp(false)} touch={touch} engine={engine} />}
        {keysOpen && (
          <KeysDialog
            keys={ringKeys}
            onKeys={(k) => {
              keysRef.current = k;
              setRingKeys(k);
              saveKeys(k);
            }}
            onBinding={(b) => {
              binding.current = b;
            }}
            onClose={() => setKeysOpen(false)}
          />
        )}
        {leaving && m.phase !== 'over' && (
          <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Leave the match">
            <div className="rb-ring-dialog">
              <h2>{tut ? 'Leave the tutorial?' : 'Leave the Ring?'}</h2>
              <p>{tut ? 'Nothing is lost: you can start it again from the Tutorial button in the lobby.' : m.phase === 'gates' ? 'The gates haven’t lifted yet, so this costs you nothing.' : role.kind === 'solo' || stakes ? `Walking out counts as a leaver’s loss${stakes ? `: −${Math.round(stakes.lose * LEAVER_K)} rating, half again a loss` : ''}.${role.kind === 'solo' ? '' : ' The match ends for the others, and their rating stays as it was.'}` : role.kind === 'host' ? 'You’re running this match, so leaving ends it for everyone.' : 'Your hero stands where they are until the match ends.'}</p>
              <div className="rb-vigil-actions">
                <button className="rb-btn is-gold" onClick={() => setLeaving(false)} autoFocus>
                  Stay
                </button>
                <button className="rb-btn is-danger" onClick={() => onLeave(m.phase !== 'gates')}>
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenGate>
  );
}
