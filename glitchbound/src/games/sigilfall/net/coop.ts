import { applyStatus, hurtPlayer, remoteHit } from '../sim/combat';
import type { EliteAffix, StatusId } from '../data/types';
import type { CoopOut, Enemy, Field, Ghost, Projectile, Telegraph, Wave } from '../sim/types';
import type { World } from '../sim/world';
import type { Card } from './room';

/**
 * A co-op run on one player's device (net/room.ts holds the party; this is the fight).
 *
 * The host's game runs the enemies as it always does: their thinking, their attacks, the rooms, the
 * bosses and the Riftstone clock. Ten times a second it sends a frame: every enemy (where it is, its
 * health, what it is doing), the attacks in the air (wind-ups, shots, burning ground, shockwaves), the
 * rooms, the clock, and what happened since (kills, a boss's fall, an attack that struck someone).
 *
 * Every player's game runs its own hero, so moving and casting answer at once. It sends where the hero
 * is ten times a second, and its hits on the host's enemies (worked out in full on its side: crit, armor,
 * resistances) twenty times a second; the host's game takes them off the real enemy. A guest's world
 * holds copies of the host's enemies and attacks: drawn, struck at, never striking (World.puppet). What
 * strikes a guest's hero comes from the host's game and is taken by the guest's: its own armor, dodge and
 * health. Every kill gives every hero its experience and its own loot, rolled on its own game.
 *
 * Messages go through the room's relay (rooms/worker.ts), which keeps their order, so a kill, a boss's
 * fall or the clock stopping is never lost. `send` is that relay (a test wires two worlds together).
 */

/** Frames and hero places per second; hits go out twice as often. */
const FRAME_MS = 100;
const HIT_MS = 50;
/** A hero not heard from in this long has left the fight (the enemies forget them). */
const LOST_S = 6;
/** How fast drawn places catch up with the last one sent (per second). */
const EASE = 14;

export type Role = 'host' | 'guest';

/** Their seat, their card (name, class, look). */
export interface Member {
  n: number;
  card: Card;
}

/** A hero's place, as every player sends it. */
interface HeroMsg {
  t: 'p';
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  hp: number;
  mh: number;
  dead: 0 | 1;
  u: 0 | 1;
  sh: [number, number, number, number, number, string][];
}

/** A guest's hits, control and falls since its last message. */
interface GuestMsg {
  t: 'g';
  h: [number, number, number, number][];
  st: [number, StatusId, number, number][];
  died: number;
}

type EnemyRow = [id: number, def: string, x: number, y: number, hp: number, mh: number, flags: number, level: number, face: number, state: string, name: string, elite: string, room: number];
type ShotRow = [x: number, y: number, vx: number, vy: number, r: number, look: string, color: string];
type TeleRow = [id: number, shape: Telegraph['shape'], x: number, y: number, r: number, r2: number, angle: number, len: number, dur: number, t: number, tone: Telegraph['tone'], linger: number];
type FieldRow = [x: number, y: number, r: number, look: Field['look'], t: number, dur: number];
type WaveRow = [x: number, y: number, r: number, speed: number, max: number, width: number];
type Event = ['h', number, number, number, number, number, StatusId | '', number, number, number] | ['k', number] | ['b', number] | ['end', number, number];

/** The host's frame. */
interface FrameMsg {
  t: 's';
  e: EnemyRow[];
  pr: ShotRow[];
  tg: TeleRow[];
  fd: FieldRow[];
  wv: WaveRow[];
  en: string;
  k: [number, number] | null;
  ev: Event[];
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

export class CoopSession {
  private world: World | null = null;
  private frameT = 0;
  private hitT = 0;
  /** Host: what happened since the last frame (sent with it, in order). */
  private events: Event[] = [];
  /** Guest: the hits not sent yet. */
  private hits: GuestMsg = { t: 'g', h: [], st: [], died: 0 };
  /** Guest: where each of the host's enemies was last put (the drawn copy eases there). */
  private targets = new Map<number, { x: number; y: number }>();
  /** Members by seat: their ghosts are made when a world is attached. */
  private members = new Map<number, Member>();

  constructor(
    readonly role: Role,
    readonly me: number,
    /** The host's seat (a guest only listens to the host's frames). */
    readonly host: number,
    private readonly send: (d: unknown) => void,
  ) {}

  /** The party's other heroes (from the room's cards). */
  setMembers(list: Member[]): void {
    this.members = new Map(list.filter((m) => m.n !== this.me).map((m) => [m.n, m]));
    const w = this.world;
    if (!w?.coop) return;
    // a newcomer gets a ghost; one who left loses theirs
    w.coop.ghosts = w.coop.ghosts.filter((g) => this.members.has(g.n));
    for (const m of this.members.values()) if (!w.coop.ghosts.some((g) => g.n === m.n)) w.coop.ghosts.push(this.ghostFor(m, w));
    // the host first: a guest drawn into a room is put beside the host
    w.coop.ghosts.sort((a, b) => (a.n === this.host ? -1 : b.n === this.host ? 1 : a.n - b.n));
  }

  /** The world this run is in (made with `coop: role`). */
  attach(w: World): void {
    this.world = w;
    this.targets.clear();
    this.events = [];
    this.hits = { t: 'g', h: [], st: [], died: 0 };
    this.setMembers([...this.members.values()]);
  }

  private ghostFor(m: Member, w: World): Ghost {
    const p = w.player;
    return { n: m.n, name: m.card.name, cls: m.card.cls, x: p.x, y: p.y, tx: p.x, ty: p.y, vx: 0, vy: 0, dir: 0, walkT: 0, r: p.r, hp: 1, maxHp: 1, dead: false, untouchable: true, look: m.card.look, weapon: m.card.weapon, shots: [], seen: w.time };
  }

  /** After each step of the world: the drawn places ease, and what is due goes out. */
  frame(dtMs: number): void {
    const w = this.world;
    if (!w?.coop) return;
    const dt = dtMs / 1000;
    const k = 1 - Math.exp(-EASE * dt);
    for (const g of w.coop.ghosts) {
      const moved = Math.hypot(g.tx - g.x, g.ty - g.y);
      g.x += (g.tx - g.x) * k;
      g.y += (g.ty - g.y) * k;
      if (moved > 0.5) g.walkT += dt;
      for (const s of g.shots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      // a hero who has gone quiet leaves the fight (they come back with their next message)
      if (w.time - g.seen > LOST_S) g.dead = true;
    }
    if (this.role === 'guest')
      for (const e of w.enemies) {
        const t = this.targets.get(e.id);
        if (!t || e.dead) continue;
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        // far off (a blink, a charge): there at once
        if (d > 60) {
          e.x = t.x;
          e.y = t.y;
        } else {
          if (d > 0.5) e.walkT += dt;
          e.x += (t.x - e.x) * k;
          e.y += (t.y - e.y) * k;
        }
      }
    this.drain(w);
    this.frameT -= dtMs;
    this.hitT -= dtMs;
    if (this.frameT <= 0) {
      this.frameT += FRAME_MS;
      if (this.frameT < 0) this.frameT = FRAME_MS;
      this.send(this.heroMsg(w));
      if (this.role === 'host') this.sendFrame(w);
    }
    if (this.role === 'guest' && this.hitT <= 0) {
      this.hitT = HIT_MS;
      if (this.hits.h.length || this.hits.st.length || this.hits.died) {
        this.send(this.hits);
        this.hits = { t: 'g', h: [], st: [], died: 0 };
      }
    }
  }

  /** The world's outbox: the host's into the next frame's events, a guest's into its next hits. */
  private drain(w: World): void {
    const out: CoopOut[] = w.coop!.out;
    if (!out.length) return;
    for (const o of out) {
      if (this.role === 'host') {
        if (o.t === 'hit') this.events.push(['h', o.n, o.dmg, r1(o.fromX ?? NaN), r1(o.fromY ?? NaN), o.knock ?? 0, o.status?.status ?? '', o.status?.dur ?? 0, o.status?.power ?? 0, o.src ?? -1]);
        else if (o.t === 'kill') this.events.push(['k', o.id]);
        else if (o.t === 'bossDone') this.events.push(['b', o.id]);
        else if (o.t === 'end') this.events.push(['end', r1(o.time), o.up]);
      } else if (o.t === 'dmg') this.hits.h.push([o.id, o.dmg, o.kx, o.ky]);
      else if (o.t === 'st') this.hits.st.push([o.id, o.status, r1(o.dur), r1(o.power)]);
      else if (o.t === 'died') this.hits.died += 1;
    }
    out.length = 0;
  }

  private heroMsg(w: World): HeroMsg {
    const p = w.player;
    const sh: HeroMsg['sh'] = [];
    for (const pr of w.projectiles) if (!pr.hostile && !pr.dead && sh.length < 24) sh.push([Math.round(pr.x), Math.round(pr.y), Math.round(pr.vx), Math.round(pr.vy), pr.r, pr.color]);
    return { t: 'p', x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), dir: p.dir, hp: Math.round(p.hp), mh: Math.round(p.maxHp), dead: p.dead ? 1 : 0, u: p.iframe > 0 || !!p.dash ? 1 : 0, sh };
  }

  private sendFrame(w: World): void {
    const e: EnemyRow[] = [];
    for (const x of w.enemies) {
      if (x.dead || x.dummy) continue;
      const flags = (x.boss ? 2 : 0) | (x.elite.length ? 1 : 0) | (x.state === 'spawn' ? 4 : 0);
      e.push([x.id, x.boss ? x.boss.def.id : x.def.id, r1(x.x), r1(x.y), Math.round(x.hp), Math.round(x.maxHp), flags, x.level, r1(x.face), x.state, x.elite.length || x.def.named ? x.name : '', x.elite.join(','), x.room]);
    }
    const pr: ShotRow[] = [];
    for (const p of w.projectiles) if (p.hostile && !p.dead) pr.push([Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), p.r, p.look, p.color]);
    const tg: TeleRow[] = [];
    for (const t of w.telegraphs) if (t.tone !== 'player' && !t.dead) tg.push([t.id, t.shape, r1(t.x), r1(t.y), r1(t.r), r1(t.r2), r1(t.angle), r1(t.len), r1(t.dur), r1(t.t), t.tone, r1(t.linger)]);
    const fd: FieldRow[] = [];
    for (const f of w.fields) if (f.hostile && f.t > 0) fd.push([r1(f.x), r1(f.y), r1(f.r), f.look, r1(f.t), r1(f.dur)]);
    const wv: WaveRow[] = [];
    for (const v of w.waves) if (!v.dead) wv.push([r1(v.x), r1(v.y), r1(v.r), v.speed, v.max, v.width]);
    const k = w.keyRun ? ([r1(w.keyRun.t), w.keyRun.deaths] as [number, number]) : null;
    const msg: FrameMsg = { t: 's', e, pr, tg, fd, wv, en: w.encounterCode(), k, ev: this.events };
    this.events = [];
    this.send(msg);
  }

  /** Traffic from another seat. */
  receive(n: number, d: unknown): void {
    const w = this.world;
    if (!w?.coop || !d || typeof d !== 'object') return;
    const m = d as { t?: string };
    if (m.t === 'p') this.onHero(w, n, m as HeroMsg);
    else if (m.t === 's' && this.role === 'guest' && n === this.host) this.onFrame(w, m as FrameMsg);
    else if (m.t === 'g' && this.role === 'host') this.onHits(w, m as GuestMsg);
  }

  private onHero(w: World, n: number, m: HeroMsg): void {
    const g = w.coop!.ghosts.find((x) => x.n === n);
    if (!g) return;
    const first = g.seen <= 0 || w.time - g.seen > LOST_S;
    g.tx = m.x;
    g.ty = m.y;
    // the first word from a hero (or after a long silence) puts them there at once
    if (first) {
      g.x = m.x;
      g.y = m.y;
    }
    g.vx = m.vx;
    g.vy = m.vy;
    g.dir = m.dir;
    g.hp = m.hp;
    g.maxHp = Math.max(1, m.mh);
    g.dead = m.dead === 1;
    g.untouchable = m.u === 1;
    g.shots = (m.sh ?? []).map(([x, y, vx, vy, r, color]) => ({ x, y, vx, vy, r, color }));
    g.seen = w.time;
  }

  /** Host: a guest's hits land on the real enemies; its falls cost the clock. */
  private onHits(w: World, m: GuestMsg): void {
    for (const [id, dmg, kx, ky] of m.h ?? []) {
      const e = w.enemyById(id);
      if (e) remoteHit(w, e, dmg, kx, ky);
    }
    for (const [id, status, dur, power] of m.st ?? []) {
      const e = w.enemyById(id);
      if (e) applyStatus(w, e, { status, dur, power }, 0);
    }
    for (let i = 0; i < (m.died ?? 0); i++) if (w.keyRun && !w.keyRun.end) w.keyRun.deaths += 1;
  }

  /** Guest: the host's frame. */
  private onFrame(w: World, m: FrameMsg): void {
    // what happened first (a kill needs the enemy still here), then where everything is now
    for (const ev of m.ev ?? []) this.onEvent(w, ev);
    const seen = new Set<number>();
    for (const row of m.e ?? []) {
      const [id, def, x, y, hp, mh, flags, level, face, state, name, elite, room] = row;
      seen.add(id);
      let e: Enemy | undefined | null = w.enemyById(id);
      if (!e) {
        e = w.puppetEnemy(id, def, (flags & 2) !== 0, x, y, level, room);
        if (!e) continue;
        if (name) e.name = name;
        if (elite) e.elite = elite.split(',') as EliteAffix[];
      }
      if (e.dead) continue;
      this.targets.set(id, { x, y });
      e.maxHp = mh;
      e.hp = Math.max(1, hp);
      e.face = face;
      e.state = state as Enemy['state'];
      e.room = room;
    }
    // gone without dying here (a pack walked off, a room reset): taken away
    w.enemies = w.enemies.filter((e) => e.dead || seen.has(e.id));
    for (const id of [...this.targets.keys()]) if (!seen.has(id)) this.targets.delete(id);
    this.mirrorAttacks(w, m);
    const codes = m.en ?? '';
    for (let i = 0; i < codes.length; i++) w.mirrorEncounter(i, codes[i] === 'a' ? 'active' : codes[i] === 'c' ? 'cleared' : 'idle');
    if (m.k && w.keyRun && !w.keyRun.end) {
      w.keyRun.t = m.k[0];
      w.keyRun.deaths = m.k[1];
    }
  }

  private onEvent(w: World, ev: Event): void {
    if (ev[0] === 'h') {
      const [, n, dmg, fx, fy, knock, status, dur, power, src] = ev;
      if (n !== this.me) return;
      const source = src >= 0 ? w.enemyById(src) : undefined;
      hurtPlayer(w, dmg, { ...(Number.isFinite(fx) && Number.isFinite(fy) ? { fromX: fx, fromY: fy } : {}), knock, ...(status ? { status: { status, dur, power } } : {}), ...(source ? { source } : {}) });
    } else if (ev[0] === 'k') {
      const e = w.enemyById(ev[1]);
      if (!e || e.dead) return;
      // the host's kill: this hero's experience, gold and loot, rolled here
      e.hp = 0;
      if (!e.boss) {
        e.dead = true;
        e.state = 'dead';
        e.deathT = 0;
      }
      w.onKill(e);
    } else if (ev[0] === 'b') {
      const e = w.enemyById(ev[1]);
      if (e?.boss) w.bossFinished(e);
    } else if (ev[0] === 'end') w.applyKeyEnd(ev[1], ev[2]);
  }

  /** Guest: the host's attacks in the air, as copies that only show (remote). */
  private mirrorAttacks(w: World, m: FrameMsg): void {
    w.telegraphs = w.telegraphs.filter((t) => t.tone === 'player');
    for (const [id, shape, x, y, r, r2, angle, len, dur, t, tone, linger] of m.tg ?? [])
      w.telegraphs.push({ id, shape, x, y, r, r2, angle, len, t, dur, dmg: 0, knock: 0, tone, owner: -1, linger, remote: true, dead: false });
    w.projectiles = w.projectiles.filter((p) => !p.hostile);
    for (const [x, y, vx, vy, r, look, color] of m.pr ?? []) w.projectiles.push(remoteShot(x, y, vx, vy, r, look, color));
    w.fields = w.fields.filter((f) => !f.hostile);
    for (const [x, y, r, look, t, dur] of m.fd ?? []) w.fields.push({ id: -1, x, y, r, t, dur, tick: 1, tickT: 1, dmg: 0, type: 'physical', look, hostile: true, depth: 0, spec: null, onHit: false, remote: true });
    w.waves = (m.wv ?? []).map(([x, y, r, speed, max, width]): Wave => ({ id: -1, x, y, r, speed, max, width, dmg: 0, hitPlayer: true, remote: true, dead: false }));
  }
}

function remoteShot(x: number, y: number, vx: number, vy: number, r: number, look: string, color: string): Projectile {
  return { id: -1, x, y, vx, vy, r, life: 400, hostile: true, dmg: 0, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look, color, child: false, splitDone: true, trailT: 0, homing: 0, age: 0, knock: 0, wide: false, remote: true, dead: false };
}
