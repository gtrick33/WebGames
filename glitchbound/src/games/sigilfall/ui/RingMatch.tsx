import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { ABILITIES, DASH, SLOTS, superOf, type Ability } from '../arena/abilities';
import { botThink, newBrain } from '../arena/bot';
import { LEAVER_K, type ClassSets } from '../arena/ladder';
import { MAPS } from '../arena/maps';
import { CLOSE_FROM, Match, MATCH_LIMIT, MOMENTUM_HOLD, MOMENTUM_MAX, type Aura, type Fighter, type MatchSetup, type MoveInput, type Snapshot } from '../arena/sim';
import { CLASSES } from '../data/classes';
import type { SigilEngine } from '../engine';
import type { Character, Face } from '../progress/character';
import { iconPicture } from '../render/art/gameIcons';
import { drawRing, RingFx, ringLooks, ringSpells } from '../render/ring';
import { RingStage, ringMapOf } from '../render3d/ring3d';
import { heroDollUrl, type WornLooks } from '../render/sprites';
import { RingHelp, SetupEditor, timing } from './RingSetup';
import { ScreenGate } from './ScreenGate';
import { Stick } from './Stick';
import { actionOf, keyName, readKeys, saveKeys, type RingKeys } from './ringKeys';
import { KeysDialog } from './RingKeysDialog';

export type Role = { kind: 'solo'; skill: number } | { kind: 'host'; skill: number; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void } | { kind: 'client'; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void };

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
/** The campaign's thumb cluster: the same places, so a phone player's hands already know them (the four abilities,
 * then the Swift Step where the dodge is, and the super where the ultimate is). */
const TOUCH_SLOTS = ['basic', 's1', 's2', 's3', 'dodge', 'ult'] as const;

const clock = (t: number): string => {
  const left = Math.max(0, MATCH_LIMIT - t);
  return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
};

const CC_WORD: Record<string, string> = { stun: 'Stunned', fear: 'Feared', incap: 'Dazed', root: 'Rooted', silence: 'Silenced' };
const DR_MARK = ['', '½', '¼', '✕'];

function AuraIcons({ f }: { f: Fighter }) {
  // what holds them first, then what's left
  const shown = [...f.auras].sort((a, b) => Number(!!b.cc) - Number(!!a.cc)).slice(0, 6);
  return (
    <span className="rb-ring-auras">
      {shown.map((a: Aura, i) => (
        <i key={`${a.ab}-${a.kind}-${i}`} className={`${a.harmful ? 'is-bad' : 'is-good'}${a.cc ? ' is-cc' : ''}`} title={ABILITIES[a.ab]?.name}>
          <img src={iconPicture(ABILITIES[a.ab]?.icon ?? '')} alt="" draggable={false} />
          {a.cc && <b>{Math.ceil(a.t)}</b>}
        </i>
      ))}
    </span>
  );
}

/** How far along a cast is (a channel runs down). */
const castShare = (c: { t: number; dur: number; channel: boolean }): number => Math.max(0, Math.min(1, c.channel ? 1 - c.t / c.dur : c.t / c.dur));

function Frame({ f, m, me, doll, tag, onPick, flip, title }: { f: Fighter; m: Match; me: Fighter | null; doll: string; tag: string | null; onPick: () => void; flip?: boolean; title?: string | null }) {
  const hold = f.auras.find((a) => a.cc);
  const c = f.cast;
  const ab = c ? ABILITIES[c.ab] : null;
  const sees = !me || me === f || m.phase !== 'fight' || m.sees(me, f);
  const dr = Object.entries(f.dr).filter(([, d]) => d && d.until > m.clock && d.n > 0);
  const share = f.hp / f.maxHp;
  return (
    <button className={`rb-ring-frame${flip ? ' is-flip' : ''}${tag ? ' is-on' : ''}${f.dead ? ' is-dead' : ''}${sees ? '' : ' is-unseen'}`} style={{ ['--c' as string]: CLASSES[f.cls].colors.accent }} 
      onPointerDown={(e) => {
        // (at the press, not on a tap: a phone sends no tap while the other thumb is on the stick)
        e.preventDefault();
        onPick();
      }}
      onClick={onPick}
      aria-label={`${f.name}, ${CLASSES[f.cls].name}, ${Math.round(share * 100)}% health`}>
      <span className="rb-ring-face">
        <img src={doll} alt="" draggable={false} />
      </span>
      <span className="rb-ring-bars">
        <span className="rb-ring-name">
          <b>{f.id === me?.id ? 'You' : f.name}</b>
          {title && <small className="rb-ring-title">{title}</small>}
          {tag && <em>{tag}</em>}
        </span>
        <span className={`rb-ring-bar${share < 0.3 ? ' is-low' : ''}`}>
          <i style={{ width: `${share * 100}%` }} />
          <b>{f.dead ? 'Fallen' : `${Math.round(share * 100)}%`}</b>
        </span>
        <span className="rb-ring-tail">
          {f.maxMana > 0 && (
            <span className="rb-ring-mana">
              <i style={{ width: `${(f.mana / f.maxMana) * 100}%` }} />
            </span>
          )}
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
          {dr.map(([k, d]) => (
            <small key={k} className="rb-ring-dr" title={`${CC_WORD[k]} wears off faster now`}>
              {k[0]!.toUpperCase()}
              {DR_MARK[d!.n]}
            </small>
          ))}
        </span>
      </span>
    </button>
  );
}

/** Who an ability will land on, and whether it can right now. */
function AimCard({ label, f, note, bad, doll, kind }: { label: string; f: Fighter | null; note: string; bad: boolean; doll: string; kind: 'foe' | 'friend' }) {
  return (
    <div className={`rb-ring-aim is-${kind}${f ? '' : ' is-none'}${bad ? ' is-bad' : ''}`}>
      <small>{label}</small>
      {f ? (
        <span className="rb-ring-aim-who">
          <span className="rb-ring-face is-small" style={{ ['--c' as string]: CLASSES[f.cls].colors.accent }}>
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
}

/** Why an ability can't go right now, if that's something to show on its button. */
function isOut(m: Match, me: Fighter | null, ab: Ability): boolean {
  if (!me || m.phase !== 'fight') return false;
  const why = m.blocked(me, ab);
  return why === 'Out of sight' || why === 'Too far away' || why === 'Not enough mana' || why === 'Silenced' || (why?.endsWith('is locked') ?? false) || why === 'You can’t do that now' || why === 'Nobody to aim at';
}

/** A match: The Ring's ground, its frames and a bar of abilities. Solo, the computer plays everyone else. */
export function RingMatch({ engine, setup, myId, face, body, role, sets, stakes, onSets, onDone, onLeave, resume, onSnap, wear, worn, title }: { engine: SigilEngine; setup: MatchSetup; myId: number; face?: Face; body?: 'm' | 'f'; wear?: Character | null; worn?: WornLooks; title?: string | null; role: Role; sets: ClassSets; stakes: MatchStakes | null; onSets: (s: ClassSets) => void; onDone: (r: MatchResult) => void; onLeave: (started: boolean) => void; resume?: Snapshot; onSnap?: (s: Snapshot) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ringKeys, setRingKeys] = useState<RingKeys>(readKeys);
  const keysRef = useRef(ringKeys);
  const binding = useRef(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [, tick] = useState(0);
  const [m] = useState(() => {
    const out = new Match(setup);
    // (coming back to a match left while it was going: where it stood)
    if (resume) out.restore(resume, null);
    return out;
  });
  const [err, setErr] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [tip, setTip] = useState<Ability | null>(null);
  const errAt = useRef(0);
  const stick = useRef<MoveInput>({ mx: 0, my: 0 });
  const dolls = useMemo(() => ringLooks(m, { face, body, wear, worn }, myId).map((l) => heroDollUrl(l.look, 'down', 2, l.held)), [m, face, body, myId, wear, worn]);

  const me = m.fighters[myId] ?? null;
  const touch = engine.touchMode;
  const say = (why: string | null): void => {
    if (!why || why === 'Already casting' || why === 'Casting') return;
    setErr(why);
    errAt.current = performance.now();
  };
  const press = (id: string): void => {
    if (!me) return;
    if (role.kind === 'client') {
      const ab = ABILITIES[id];
      const why = ab ? m.blocked(me, ab) : null;
      if (why && why !== 'Not ready yet') say(why);
      else role.send({ p: id });
      return;
    }
    say(m.press(myId, id));
  };
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
    tick((x) => x + 1);
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
    const fit = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const host = canvas.parentElement!;
      view.fit(host.clientWidth, host.clientHeight, dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas.parentElement!);

    /* --------------------------------------------------- input */
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
      const foes = me ? m.fighters.filter((f) => f.team !== me.team) : [];
      const pals = me ? m.fighters.filter((f) => f.team === me.team && f.id !== me.id) : [];
      if (act && act !== 'up' && act !== 'down' && act !== 'left' && act !== 'right') e.preventDefault();
      if (n >= 0 && me?.bar[n]) press(me.bar[n]!);
      // (behind the gates, the step key says "ready")
      else if (act === 'dash' && m.phase === 'gates' && role.kind !== 'client') {
        if (m.gateAt - m.t > 5) ready();
      } else if (act === 'dash') press(DASH.id);
      else if (act === 'super' && me) press(superOf(me.cls).id);
      else if (act === 'nextFoe' && me) {
        const next = cycle(m.enemiesOf(me), me.target);
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
      } else if (e.code === 'Escape') {
        setEditing(false);
        setHelp(false);
        setLeaving((x) => !x);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keys.delete(e.code);
    };
    const blur = (): void => keys.clear();
    // a click or a tap on a fighter in the ring chooses them (an enemy to hit, an ally to help)
    const pick = (e: PointerEvent): void => {
      const el = e.target as HTMLElement | null;
      if (!el || el.closest('button, .rb-ring-top, .rb-ring-bar, .rb-cluster, [role="dialog"]')) return;
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      let best: Fighter | null = null;
      let bd = e.pointerType === 'touch' ? 44 : 30;
      for (const f of m.fighters) {
        if (f.dead) continue;
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
    const host = canvas.parentElement!;
    host.addEventListener('pointerdown', pick, true);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const moveNow = (): MoveInput => {
      const k = keysRef.current;
      const mx = (keys.has(k.right) || keys.has('ArrowRight') ? 1 : 0) - (keys.has(k.left) || keys.has('ArrowLeft') ? 1 : 0);
      const my = (keys.has(k.down) || keys.has('ArrowDown') ? 1 : 0) - (keys.has(k.up) || keys.has('ArrowUp') ? 1 : 0);
      return mx || my ? { mx, my } : stick.current;
    };

    /* --------------------------------------------------- the room's traffic */
    const others: Record<number, MoveInput> = {};
    if (role.kind === 'host') {
      role.listen((seat, d) => {
        const f = m.fighters.find((x) => x.seat === seat);
        if (!f || !d || typeof d !== 'object') return;
        const q = d as { mx?: unknown; my?: unknown; p?: unknown; tg?: unknown; eq?: { bar?: unknown; oath?: unknown; talents?: unknown } };
        const eq = q.eq;
        if (eq && Array.isArray(eq.bar) && eq.bar.length <= 12 && eq.bar.every((b) => typeof b === 'string')) m.equip(f.id, { bar: eq.bar as string[], oath: typeof eq.oath === 'string' ? eq.oath : undefined, talents: Array.isArray(eq.talents) ? (eq.talents.filter((b) => typeof b === 'string').slice(0, 3) as string[]) : [] });
        if (typeof q.mx === 'number' && typeof q.my === 'number' && Number.isFinite(q.mx) && Number.isFinite(q.my)) others[f.id] = { mx: Math.max(-1, Math.min(1, q.mx)), my: Math.max(-1, Math.min(1, q.my)) };
        // (press checks it's on their bar, and the rules, as for anyone)
        if (typeof q.p === 'string') m.press(f.id, q.p);
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
    const brains = m.fighters.map((_, i) => newBrain(setup.seed + i * 97));
    const skill = role.kind === 'client' ? 0 : role.skill;
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
    const paint = (time: number): void => {
      const dt = lastPaint ? Math.min(0.1, Math.max(0, time - lastPaint)) : 0;
      lastPaint = time;
      for (const e of m.events) {
        if (e.k === 'ab') view.swing(e.id, e.ab, m.fighters[e.id]?.cast?.ab === e.ab);
        // (somebody's down: the crowd is on its feet)
        else if (e.k === 'death') view.cheer();
      }
      if (m.phase !== wasShown) {
        wasShown = m.phase;
        view.cheer(m.phase === 'fight' ? 0.7 : m.phase === 'over' ? 1 : 0);
      }
      view.frame(m, looks, myId, dt, time, (q) => ringSpells(q, m, fx, myId, time, view.air));
      drawRing(m, fx, myId, time, view);
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
        const h = dt / pieces;
        for (let i = 0; i < pieces && h > 0; i++) {
          const moves: Record<number, MoveInput> = { [myId]: mine };
          for (const f of m.fighters) {
            if (f.id === myId) continue;
            if (f.seat !== null) moves[f.id] = others[f.id] ?? { mx: 0, my: 0 };
            else moves[f.id] = botThink(m, f, brains[f.id]!, skill, h);
          }
          m.step(h, moves);
        }
        if (role.kind === 'host') {
          sendT += dt;
          if (sendT >= SEND_EVERY) {
            sendT = 0;
            sent = [...m.events];
            role.send({ s: m.snapshot(), e: sent });
          }
        }
      } else {
        m.coast(dt, myId, mine);
        sendT += dt;
        const said = `${mine.mx.toFixed(2)},${mine.my.toFixed(2)}`;
        if (sendT >= 1 / 15 && said !== lastSent) {
          sendT = 0;
          lastSent = said;
          role.send({ mx: mine.mx, my: mine.my });
        }
      }
      // (a host's events go out only as often as it speaks: the ones between wait to be drawn with them)
      if (role.kind !== 'host' || sent) fx.take(m, sound, myId);
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
        tick((x) => x + 1);
      }
      if (m.phase === 'over' && !done) {
        done = true;
        const myTeam = m.fighters[myId]?.team;
        sound(m.winner === myTeam ? 'victory' : 'playerDie');
        // the last word goes out at once, then a moment to see the last blow land
        if (role.kind === 'host') role.send({ s: m.snapshot(), e: [] });
        window.setTimeout(() => onDone({ won: m.winner === myTeam, draw: m.draw, match: m, myId, dolls: m.fighters.map((f) => heroDollUrl(looks[f.id]!.look, 'down', 3, looks[f.id]!.held)) }), 1300);
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
          for (const f of m.fighters) moves[f.id] = f.id === myId ? moveNow() : botThink(m, f, brains[f.id]!, skill, STEP);
          m.step(STEP, moves);
        }
        paint(performance.now() / 1000);
        tick((x) => x + 1);
      };
      (window as unknown as { __ring?: unknown }).__ring = { m, keys, press, run, brains, botThink, paint, view };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      host.removeEventListener('pointerdown', pick, true);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
        if (role.kind !== 'solo') role.listen(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const teamOf = (t: 0 | 1): Fighter[] => m.fighters.filter((f) => f.team === t);
  const mine = me?.team ?? 0;
  const left = teamOf(mine);
  const right = teamOf(mine === 0 ? 1 : 0);
  const bar = me ? [...me.bar.map((id) => ABILITIES[id]!), DASH, superOf(me.cls)] : [];
  const keyOf = (i: number): string => keyName(i < SLOTS ? ringKeys[`ab${i + 1}` as 'ab1'] : i === SLOTS ? ringKeys.dash : ringKeys.super);
  const charge = me?.charge ?? 0;
  const gloamIn = Math.ceil(CLOSE_FROM - m.clock);
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
  const foeNote = !foeAlive ? (m.phase === 'fight' ? `Click someone or press ${keyName(ringKeys.nextFoe)}. Nearest is used if you don’t.` : `Click someone or press ${keyName(ringKeys.nextFoe)}`) : !me || m.phase !== 'fight' ? `${Math.round((foeAlive.hp / foeAlive.maxHp) * 100)}%` : !m.sees(me, foeAlive) ? 'Out of sight' : `${Math.round((foeAlive.hp / foeAlive.maxHp) * 100)}% · ${Math.round(Math.hypot(foeAlive.x - me.x, foeAlive.y - me.y))} away`;
  const foeBad = !!foeAlive && !!me && m.phase === 'fight' && !m.sees(me, foeAlive);
  return (
    <ScreenGate label="Entering the Ring">
      <div className={`rb-ring${touch ? ' is-touch' : ''}`}>
        <div className="rb-ring-stage">
          <canvas ref={canvasRef} className="rb-ring-canvas" />
          <div className="rb-ring-top">
            <div className="rb-ring-team">
              {left.map((f) => (
                <Frame key={f.id} f={f} m={m} me={me} doll={dolls[f.id]!} title={f.id === myId ? (title ?? null) : null} tag={helps && f.id === friendId && m.phase === 'fight' ? 'Helping' : null} onPick={() => target(f.id)} />
              ))}
            </div>
            <div className="rb-ring-clock">
              <b>{clock(m.clock)}</b>
              {stakes ? (
                <span className="rb-ring-rating" style={{ ['--r' as string]: stakes.color }} title={`${stakes.rank}. ${stakes.format}v${stakes.format} rating`}>
                  <i aria-hidden="true">◆</i>
                  {stakes.rating}
                  <small>{stakes.rank}</small>
                </span>
              ) : (
                <span className="rb-ring-rating is-friendly">Friendly</span>
              )}
              {m.phase === 'fight' && (gloamIn > 0 ? gloamIn <= 15 && <small className="rb-ring-gloam">The Gloam in {gloamIn}</small> : <small className="rb-ring-gloam is-on">The Gloam is closing</small>)}
              {damp > 0 && <small className="rb-ring-damp" title="Healing fades the longer a match goes">Healing −{damp}%</small>}
            </div>
            <div className="rb-ring-team is-foes">
              {right.map((f) => (
                <Frame key={f.id} flip f={f} m={m} me={me} doll={dolls[f.id]!} tag={f === foeAlive ? 'Target' : null} onPick={() => target(f.id)} />
              ))}
            </div>
            <div className="rb-ring-menu">
              {!touch && (
                <button className="rb-iconbtn" onClick={() => setKeysOpen(true)} aria-label="Keys" title="Keys">
                  ⌨
                </button>
              )}
              <button className="rb-iconbtn" onClick={() => setHelp(true)} aria-label="How The Ring works" title="How The Ring works">
                ?
              </button>
              <button className="rb-iconbtn" onClick={() => setLeaving(true)} aria-label="Leave the match" title="Leave the match">
                ⚑
              </button>
              <GameMenuButton className="rb-iconbtn" />
            </div>
          </div>
          {touch && (
            <div className="rb-ui rb-ring-thumbs">
              <Stick
                settings={engine.settings}
                onMove={(mx, my) => {
                  stick.current = { mx, my };
                }}
              />
              <div className="rb-cluster">
                {bar.map((ab, i) => {
                  const cd = me?.cds[ab.id] ?? 0;
                  const gcd = !ab.free ? (me?.gcd ?? 0) : 0;
                  const wait = Math.max(cd, gcd);
                  const full = cd > gcd ? ab.cd : 1;
                  const sup = !!ab.super;
                  return (
                    <button
                      key={ab.id}
                      className={`rb-sb rb-sb-${TOUCH_SLOTS[i]}${sup ? ` is-super${charge >= 1 ? ' is-ready' : ''}` : ''}${isOut(m, me, ab) ? ' is-nomana' : ''}${wait > 0 ? ' is-cooling' : ''}${held && ab.anyState ? ' is-free-now' : ''}`}
                      style={sup ? { ['--fill' as string]: `${Math.round(charge * 100)}%` } : undefined}
                      aria-label={sup ? `${ab.name} (super, ${Math.round(charge * 100)}% charged): ${ab.text}` : `${ab.name}: ${ab.text}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        press(ab.id);
                      }}
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
            <div className="rb-ring-prep" role="status">
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
                <span className="rb-ring-prep-rival">A friendly match: no rating changes hands.</span>
              )}
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
              <span className="rb-ring-prep-keys">{touch ? 'Left thumb to move, right thumb for abilities. The blue button steps aside; the gold one is your super, once it’s full. Keep moving: shots can be dodged.' : `${[ringKeys.up, ringKeys.left, ringKeys.down, ringKeys.right].map(keyName).join('')} to move · ${keyName(ringKeys.ab1)} to ${keyName(ringKeys.ab4)} for abilities · ${keyName(ringKeys.dash)} to step aside · ${keyName(ringKeys.super)} for your super · Keep moving: shots can be dodged`}</span>
            </div>
          )}
          {err && (
            <div className="rb-ring-err" role="status">
              {err}
            </div>
          )}
          {me && me.streak > 0 && m.phase === 'fight' && (
            <div className={`rb-ring-momentum is-x${me.streak}`} role="status" aria-label={`Momentum ${me.streak}`}>
              <b>×{me.streak}</b>
              <span>
                <strong>Momentum</strong>
                <small>{me.streak >= MOMENTUM_MAX ? 'Every combo at its hardest' : 'Land a different combo to build it'}</small>
              </span>
              <i style={{ width: `${Math.max(0, Math.min(1, me.streakT / MOMENTUM_HOLD)) * 100}%` }} />
            </div>
          )}
          {cast && castAb && (
            <div className="rb-ring-mycast" style={{ ['--a' as string]: castAb.color }}>
              <i data-cast={myId} style={{ width: `${castShare(cast) * 100}%` }} />
              <b>{castAb.name}</b>
            </div>
          )}
          {tip && !touch && (
            <div className="rb-ring-tip" role="tooltip">
              <strong>{tip.name}</strong>
              <small>{timing(tip)}</small>
              <p>{tip.text}</p>
              {tip.combo && (
                <p className="rb-rs-combo">
                  <b>Combo · {tip.combo.name}:</b> {tip.combo.text}
                </p>
              )}
            </div>
          )}
          {m.phase === 'over' && (
            <div className="rb-ring-gates is-end">
              <b>{m.draw ? 'Draw' : m.winner === me?.team ? 'Victory' : 'Defeat'}</b>
            </div>
          )}
        </div>
        {!touch && (
          <div className="rb-ring-dock">
            <AimCard label="Target" kind="foe" f={foeAlive} note={foeNote} bad={foeBad} doll={foeAlive ? dolls[foeAlive.id]! : ''} />
            <div className="rb-ring-actions" role="toolbar" aria-label="Abilities">
              {bar.map((ab, i) => {
                const cd = me?.cds[ab.id] ?? 0;
                const gcd = !ab.free ? (me?.gcd ?? 0) : 0;
                const wait = Math.max(cd, gcd);
                const full = cd > gcd ? ab.cd : 1;
                const sup = !!ab.super;
                return (
                  <button key={ab.id} className={`rb-ring-ab${isOut(m, me, ab) ? ' is-out' : ''}${ab.id === 'dash' ? ' is-step' : ''}${sup ? ` is-super${charge >= 1 ? ' is-full' : ''}` : ''}${held && ab.anyState ? ' is-ready' : ''}`} style={sup ? { ['--fill' as string]: `${Math.round(charge * 100)}%` } : undefined} onPointerDown={(e) => { e.preventDefault(); press(ab.id); }} onMouseEnter={() => setTip(ab)} onMouseLeave={() => setTip(null)} aria-label={sup ? `${ab.name} (super, ${Math.round(charge * 100)}% charged): ${ab.text}` : `${ab.name}: ${ab.text}`}>
                    <img src={iconPicture(ab.icon)} alt="" draggable={false} />
                    {sup && charge < 1 && <i className="rb-ring-charge" />}
                    {wait > 0 && <i className="rb-ring-cool" style={{ ['--p' as string]: `${Math.min(1, wait / (full || 1)) * 100}%` }} />}
                    {cd > 0.05 && <b>{cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)}</b>}
                    {sup && charge < 1 && <b className="is-charge">{Math.floor(charge * 100)}%</b>}
                    <kbd>{keyOf(i)}</kbd>
                  </button>
                );
              })}
            </div>
            {helps ? <AimCard label="Helping" kind="friend" f={friend} note={friend ? `${Math.round((friend.hp / friend.maxHp) * 100)}%` : ''} bad={false} doll={friend ? dolls[friend.id]! : ''} /> : <span className="rb-ring-aim is-blank" />}
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
        {help && <RingHelp onClose={() => setHelp(false)} />}
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
              <h2>Leave the Ring?</h2>
              <p>{m.phase === 'gates' ? 'The gates haven’t lifted yet, so this costs you nothing.' : role.kind === 'solo' ? `Walking out counts as a leaver’s loss${stakes ? `: −${Math.round(stakes.lose * LEAVER_K)} rating, half again a loss` : ''}.` : role.kind === 'host' ? 'You’re running this match, so leaving ends it for everyone.' : 'Your hero stands where they are until the match ends.'}</p>
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
