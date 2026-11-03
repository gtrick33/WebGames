import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { ABILITIES, TOKEN } from '../arena/abilities';
import { botThink, newBrain } from '../arena/bot';
import { MAPS } from '../arena/maps';
import { Match, MATCH_LIMIT, type Aura, type Fighter, type MatchSetup, type MoveInput, type Snapshot } from '../arena/sim';
import { CLASSES } from '../data/classes';
import type { SigilEngine } from '../engine';
import type { ClassSets } from '../arena/ladder';
import type { Face } from '../progress/character';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { drawRing, fighterAt, paintGround, RING_VIEW_H, RING_VIEW_W, RingFx, ringLooks } from '../render/ring';
import { heroDollUrl } from '../render/sprites';
import { toLocal } from './turn';
import { SetupEditor } from './RingSetup';

export type Role = { kind: 'solo'; skill: number } | { kind: 'host'; skill: number; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void } | { kind: 'client'; send: (d: unknown) => void; listen: (fn: RingInbox | null) => void };

/** What the room's traffic is handed to (one per match). */
export type RingInbox = (seat: number, d: unknown) => void;

const STEP = 1 / 30;
/** A host speaks ten times a second: plenty for frames that coast between. */
const SEND_EVERY = 0.1;

const clock = (t: number): string => {
  const left = Math.max(0, MATCH_LIMIT - t);
  return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
};

const CC_WORD: Record<string, string> = { stun: 'Stunned', fear: 'Feared', incap: 'Dazed', root: 'Rooted', silence: 'Silenced' };
const DR_MARK = ['', '½', '¼', '✕'];

function AuraIcons({ f }: { f: Fighter }) {
  // what holds them first, then what's left, big ones first
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

function Frame({ f, m, me, doll, selected, onPick, flip }: { f: Fighter; m: Match; me: Fighter | null; doll: string; selected: boolean; onPick: () => void; flip?: boolean }) {
  const hold = f.auras.find((a) => a.cc);
  const c = f.cast;
  const ab = c ? ABILITIES[c.ab] : null;
  const sees = !me || me === f || m.sees(me, f);
  const dr = Object.entries(f.dr).filter(([, d]) => d && d.until > m.clock && d.n > 0);
  return (
    <button className={`rb-ring-frame${flip ? ' is-flip' : ''}${selected ? ' is-on' : ''}${f.dead ? ' is-dead' : ''}${sees ? '' : ' is-unseen'}`} style={{ ['--c' as string]: CLASSES[f.cls].colors.accent }} onClick={onPick} aria-label={`${f.name}, ${CLASSES[f.cls].name}, ${Math.round((f.hp / f.maxHp) * 100)}% health`}>
      <span className="rb-ring-face">
        <img src={doll} alt="" draggable={false} />
        {hold && (
          <em>
            {CC_WORD[hold.cc!]} {Math.ceil(hold.t)}
          </em>
        )}
      </span>
      <span className="rb-ring-bars">
        <span className="rb-ring-name">
          {f.name}
          {!sees && !f.dead && m.phase === 'fight' && <small>out of sight</small>}
        </span>
        <span className="rb-ring-bar">
          <i style={{ width: `${(f.hp / f.maxHp) * 100}%` }} />
          <b>{f.dead ? 'Fallen' : `${Math.round((f.hp / f.maxHp) * 100)}%`}</b>
        </span>
        {f.maxMana > 0 && (
          <span className="rb-ring-mana">
            <i style={{ width: `${(f.mana / f.maxMana) * 100}%` }} />
          </span>
        )}
        {c && ab && (
          <span className="rb-ring-cast" style={{ ['--a' as string]: ab.color }}>
            <i style={{ width: `${(c.channel ? 1 - c.t / c.dur : c.t / c.dur) * 100}%` }} />
            <b>{ab.name}</b>
          </span>
        )}
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

export interface MatchResult {
  won: boolean;
  draw: boolean;
  match: Match;
}

/** A match: The Ring's ground, its frames and a bar of abilities. Solo, the computer plays everyone else. */
export function RingMatch({ engine, setup, myId, face, body, role, sets, onSets, onDone, onLeave }: { engine: SigilEngine; setup: MatchSetup; myId: number; face?: Face; body?: 'm' | 'f'; role: Role; sets: ClassSets; onSets: (s: ClassSets) => void; onDone: (r: MatchResult) => void; onLeave: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, tick] = useState(0);
  const [m] = useState(() => new Match(setup));
  const [err, setErr] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const errAt = useRef(0);
  const [, setIcons] = useState(false);
  const dolls = useMemo(() => {
    const looks = ringLooks(m, { face, body }, myId);
    return looks.map((l) => heroDollUrl(l.look, 'down', 2));
  }, [m, face, body, myId]);

  const me = m.fighters[myId] ?? null;
  const say = (why: string | null): void => {
    if (!why || why === 'Already casting') return;
    setErr(why);
    errAt.current = performance.now();
  };
  const press = (id: string): void => {
    if (!me) return;
    if (role.kind === 'client') {
      const ab = id === 'token' ? TOKEN : ABILITIES[id];
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
    if (role.kind === 'client') role.send({ tg: id });
    m.setTarget(myId, id);
    tick((x) => x + 1);
  };

  useEffect(() => {
    void iconsReady.then(setIcons);
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    const looks = ringLooks(m, { face, body }, myId);
    const fx = new RingFx();
    const ground = document.createElement('canvas');
    ground.width = RING_VIEW_W * 2;
    ground.height = RING_VIEW_H * 2;
    const gg = ground.getContext('2d')!;
    gg.scale(2, 2);
    paintGround(gg, MAPS[m.map] ?? Object.values(MAPS)[0]!);
    let scale = 1;
    let ox = 0;
    let oy = 0;
    const fit = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const host = canvas.parentElement!;
      const w = host.clientWidth;
      const h = host.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      scale = Math.min(w / RING_VIEW_W, h / RING_VIEW_H) * dpr;
      ox = (canvas.width - RING_VIEW_W * scale) / 2;
      oy = (canvas.height - RING_VIEW_H * scale) / 2;
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
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
      if (n >= 0 && me?.bar[n]) press(me.bar[n]!);
      else if (e.code === 'Digit7' || e.code === 'KeyT') press(TOKEN.id);
      else if (e.code === 'Tab' && me) {
        e.preventDefault();
        const next = cycle(m.enemiesOf(me), me.target);
        if (next !== null) target(next);
      } else if (e.code === 'KeyF' && me) {
        const next = cycle(m.friendsOf(me), me.friend ?? me.id);
        if (next !== null) target(next);
      } else if (e.code === 'Escape') {
        setEditing(false);
        setLeaving((x) => !x);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keys.delete(e.code);
    };
    const blur = (): void => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    // a finger on the ground: a tap chooses who's there, a drag walks
    let touch: { id: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null = null;
    const toView = (cx: number, cy: number): { x: number; y: number } => {
      const p = toLocal(canvas, cx, cy);
      const dpr = canvas.width / (canvas.clientWidth || 1);
      return { x: (p.x * dpr - ox) / scale, y: (p.y * dpr - oy) / scale };
    };
    const pdown = (e: PointerEvent): void => {
      const v = toView(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        const f = fighterAt(m, v.x, v.y);
        if (f) target(f.id);
        return;
      }
      if (touch) return;
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false };
    };
    const pmove = (e: PointerEvent): void => {
      if (!touch || e.pointerId !== touch.id) return;
      touch.dx = e.clientX - touch.x;
      touch.dy = e.clientY - touch.y;
      if (Math.hypot(touch.dx, touch.dy) > 9) touch.moved = true;
    };
    const pup = (e: PointerEvent): void => {
      if (touch?.id !== e.pointerId) return;
      if (!touch.moved) {
        const v = toView(e.clientX, e.clientY);
        const f = fighterAt(m, v.x, v.y);
        if (f) target(f.id);
      }
      touch = null;
    };
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('pointermove', pmove);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    const moveNow = (): MoveInput => {
      let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      if (touch) {
        const len = Math.hypot(touch.dx, touch.dy);
        if (len > 9) {
          const k = Math.min(1, len / 40) / len;
          mx = touch.dx * k;
          my = touch.dy * k;
        }
      }
      return { mx, my };
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
    let acc = 0;
    let sendT = 0;
    let lastSent = '';
    let hudT = 0;
    let done = false;
    let raf = 0;
    let wasPhase = m.phase;
    const sound = (id: string, vol?: number): void => engine.sound.play(id, vol);
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      const mine = moveNow();
      let sent: Match['events'] | null = null;
      if (role.kind !== 'client') {
        acc += dt;
        // catching up, but never so far behind that a stall turns into a jump
        for (let i = 0; i < 4 && acc >= STEP; i++) {
          acc -= STEP;
          const moves: Record<number, MoveInput> = { [myId]: mine };
          for (const f of m.fighters) {
            if (f.id === myId) continue;
            if (f.seat !== null) moves[f.id] = others[f.id] ?? { mx: 0, my: 0 };
            else moves[f.id] = botThink(m, f, brains[f.id]!, skill, STEP);
          }
          m.step(STEP, moves);
        }
        if (acc > STEP * 4) acc = 0;
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
        const say = `${mine.mx.toFixed(2)},${mine.my.toFixed(2)}`;
        if (sendT >= 1 / 15 && say !== lastSent) {
          sendT = 0;
          lastSent = say;
          role.send({ mx: mine.mx, my: mine.my });
        }
      }
      // (a host's events go out only as often as it speaks: the ones between wait to be drawn with them)
      if (role.kind !== 'host' || sent) fx.take(m, sound, myId);
      fx.age(dt);
      if (m.phase !== wasPhase) {
        if (m.phase === 'fight') sound('checkpoint');
        wasPhase = m.phase;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#05030d';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.setTransform(scale, 0, 0, scale, ox, oy);
      drawRing(g, ground, m, looks, fx, myId, now / 1000);
      hudT += dt;
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
        window.setTimeout(() => onDone({ won: m.winner === myTeam, draw: m.draw, match: m }), 1300);
      }
    };
    raf = requestAnimationFrame(frame);
    // review tool on the dev server: a hidden pane runs no animation frames, so a match can be fast-forwarded by hand
    if (import.meta.env.DEV) {
      const run = (seconds: number): void => {
        for (let i = 0; i < seconds / STEP && m.phase !== 'over'; i++) {
          const moves: Record<number, MoveInput> = {};
          for (const f of m.fighters) moves[f.id] = f.id === myId ? moveNow() : botThink(m, f, brains[f.id]!, skill, STEP);
          m.step(STEP, moves);
        }
      };
      (window as unknown as { __ring?: unknown }).__ring = { m, keys, press, run, brains, botThink };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', pup);
      canvas.removeEventListener('pointerdown', pdown);
      canvas.removeEventListener('pointermove', pmove);
      if (role.kind !== 'solo') role.listen(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const teamOf = (t: 0 | 1): Fighter[] => m.fighters.filter((f) => f.team === t);
  const mine = me?.team ?? 0;
  const left = teamOf(mine);
  const right = teamOf(mine === 0 ? 1 : 0);
  const bar = me ? [...me.bar.map((id) => ABILITIES[id]!), TOKEN] : [];
  const count = Math.ceil(m.gateAt - m.t);
  const cast = me?.cast;
  const castAb = cast ? ABILITIES[cast.ab] : null;
  const damp = Math.round(m.dampening * 100);
  const aimAt = me && me.target !== null ? m.fighters[me.target] : null;
  const held = me && m.held(me);
  return (
    <div className="rb-ring" ref={boxRef}>
      <div className="rb-ring-stage">
        <canvas ref={canvasRef} className="rb-ring-canvas" />
        <div className="rb-ring-top">
          <div className="rb-ring-team">
            {left.map((f) => (
              <Frame key={f.id} f={f} m={m} me={me} doll={dolls[f.id]!} selected={f.id === (me?.friend ?? me?.id)} onPick={() => target(f.id)} />
            ))}
          </div>
          <div className="rb-ring-clock">
            <b>{clock(m.clock)}</b>
            {damp > 0 && <small title="Healing fades the longer a match goes">Healing −{damp}%</small>}
          </div>
          <div className="rb-ring-team is-foes">
            {right.map((f) => (
              <Frame key={f.id} flip f={f} m={m} me={me} doll={dolls[f.id]!} selected={f === aimAt} onPick={() => target(f.id)} />
            ))}
          </div>
          <div className="rb-ring-menu">
            <button className="rb-iconbtn" onClick={() => setLeaving(true)} aria-label="Leave the match">
              ⚑
            </button>
            <GameMenuButton className="rb-iconbtn" />
          </div>
        </div>
        {m.phase === 'gates' && count <= 5 && (
          <div className="rb-ring-gates">
            <b key={count}>{count > 0 ? count : 'Fight!'}</b>
          </div>
        )}
        {m.phase === 'gates' && count > 5 && !editing && (
          <div className="rb-ring-prep" role="status">
            <small>{MAPS[m.map]?.name}</small>
            <strong>The gates lift in {count}</strong>
            <span>Walk your entry and get ready.</span>
            <span className="rb-ring-prep-actions">
              <button className="rb-btn is-gold" onClick={() => setEditing(true)}>
                Change my set up
              </button>
              {role.kind !== 'client' && (
                <button className="rb-btn is-ghost" onClick={ready}>
                  Ready
                </button>
              )}
            </span>
          </div>
        )}
        {err && (
          <div className="rb-ring-err" role="status">
            {err}
          </div>
        )}
        {cast && castAb && (
          <div className="rb-ring-mycast" style={{ ['--a' as string]: castAb.color }}>
            <i style={{ width: `${(cast.channel ? 1 - cast.t / cast.dur : cast.t / cast.dur) * 100}%` }} />
            <b>{castAb.name}</b>
          </div>
        )}
        {m.phase === 'over' && <div className="rb-ring-gates is-end"><b>{m.draw ? 'Draw' : m.winner === me?.team ? 'Victory' : 'Defeat'}</b></div>}
      </div>
      <div className="rb-ring-actions" role="toolbar" aria-label="Abilities">
        {bar.map((ab, i) => {
          const cd = me?.cds[ab.id] ?? 0;
          const gcd = !ab.free ? (me?.gcd ?? 0) : 0;
          const wait = Math.max(cd, gcd);
          const full = cd > gcd ? ab.cd : 1;
          const why = me ? m.blocked(me, ab) : null;
          const out = why === 'Out of sight' || why === 'Too far away' || why === 'Not enough mana' || why === 'Silenced' || (why?.endsWith('is locked') ?? false) || why === 'You can’t do that now' || why === 'Nobody to aim at';
          return (
            <button key={ab.id} className={`rb-ring-ab${out ? ' is-out' : ''}${ab.id === 'token' ? ' is-token' : ''}${held && ab.anyState ? ' is-ready' : ''}`} onPointerDown={(e) => { e.preventDefault(); press(ab.id); }} title={`${ab.name}: ${ab.text}`} aria-label={ab.name}>
              <img src={iconPicture(ab.icon)} alt="" draggable={false} />
              {wait > 0 && <i className="rb-ring-cool" style={{ ['--p' as string]: `${Math.min(1, wait / (full || 1)) * 100}%` }} />}
              {cd > 0.05 && <b>{cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)}</b>}
              <kbd>{i === 6 ? 'T' : i + 1}</kbd>
            </button>
          );
        })}
      </div>
      {editing && m.phase === 'gates' && me && (
        <div className="rb-ring-editing" role="dialog" aria-label="Change my set up">
          <header>
            <strong>Your set up</strong>
            <b>{count}</b>
            <button className="rb-btn is-small is-gold" onClick={() => setEditing(false)}>
              Done
            </button>
          </header>
          <SetupEditor cls={me.cls} sets={sets} onSets={changeSets} />
        </div>
      )}
      {leaving && m.phase !== 'over' && (
        <div className="rb-vigil-modal" role="dialog" aria-label="Leave the match">
          <h2>Leave the Ring?</h2>
          <p className="rb-dim">{role.kind === 'solo' ? 'Walking out counts as a loss.' : role.kind === 'host' ? 'You’re running this match: leaving ends it for everyone.' : 'Your hero stands where they are until the match ends.'}</p>
          <div className="rb-vigil-actions">
            <button className="rb-btn is-gold" onClick={() => setLeaving(false)}>
              Stay and fight
            </button>
            <button className="rb-btn is-ghost" onClick={onLeave}>
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
