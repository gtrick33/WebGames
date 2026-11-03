import { applyStatus, hurtPlayer, remoteHit } from '../sim/combat';
import { circleHitsWall } from '../sim/map';
import { QUEST_DEFS } from '../data/quests';
import type { EliteAffix, StatusId } from '../data/types';
import type { Character } from '../progress/character';
import { packQuest, unpackQuest } from '../progress/save';
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
type Event = ['h', number, number, number, number, number, StatusId | '', number, number, number] | ['k', number] | ['b', number] | ['end', number, number] | ['ev', string];

/** Questing together: the leader's story (packed quests, progress/save packQuest), which the others' worlds show. */
interface StoryMsg {
  t: 'q';
  q: Record<string, string>;
}

/** In the wilds and in towns a frame holds only the enemies this near a hero (a land holds hundreds). */
const NEAR = 520;

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

/*
 * Everything that comes over the relay is checked before it touches a world: another player's game (or
 * someone typing into the socket) can send anything. Numbers must be finite and are kept in range; lists
 * are cut short; a message that fails is dropped, never thrown.
 */
const num = (v: unknown, lo: number, hi: number, or = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : or);
const str = (v: unknown, max = 40): string => (typeof v === 'string' ? v.slice(0, max) : '');
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
/** A place in a land, in pixels (the largest map is far smaller). */
const POS = 1e5;
/** The statuses a guest's game may put on the host's enemies (sim/combat SHARED_STATUS), and how long. */
const GUEST_STATUS = new Set<string>(['chill', 'freeze', 'shock', 'stun', 'root', 'armorBreak', 'mark', 'weaken', 'fear']);
const STATUS_DUR = 12;
const STATUS_POWER = 100;
/** One guest message (50 ms of hits) takes at most this share of a boss's health: never a one-shot. */
const BOSS_SHARE = 0.04;
/** A guest's falls per message (one every 50 ms is already more than a hero can die). */
const DIED_MAX = 3;
/** A host's frame: at most this many kills, and enemies of at most this level (beyond the game's own). */
const KILLS_MAX = 40;
const LEVEL_MAX = 100;
/** Riftstone levels a run's end can open (sim/world keyUp). */
const UP_MAX = 3;
/** Where heroes arrive around the party's spot, by their place in the party (never on top of each other). */
const SPREAD: [number, number][] = [
  [0, 0],
  [30, 0],
  [-30, 0],
  [0, 30],
];

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
    this.spread(w);
    this.setMembers([...this.members.values()]);
    this.storySent = '';
    // a guest shows the leader's story from the start (the last one heard, until the next comes)
    if (this.role === 'guest' && this.layerQuests) this.applyLayer(w);
  }

  /** A hero arrives beside the others: offset by their place in the party, where the ground is open. */
  private spread(w: World): void {
    const order = [this.me, ...this.members.keys()].sort((a, b) => a - b).indexOf(this.me);
    const [dx, dy] = SPREAD[order % SPREAD.length]!;
    if (!dx && !dy) return;
    const p = w.player;
    // (the spot itself when the ground beside it is a wall: a narrow way in)
    for (const k of [1, 0.5]) {
      const x = p.x + dx * k;
      const y = p.y + dy * k;
      if (circleHitsWall(w.map, x, y, p.r + 2)) continue;
      p.x = x;
      p.y = y;
      return;
    }
  }

  /** Questing together: the leader's story was sent when it last changed (packed, as JSON). */
  private storySent = '';
  private storyT = 0;
  /** A guest: the leader's quests, last heard. */
  private layerQuests: Character['quests'] | null = null;

  /** The leader: its story to the others, when it changed (checked twice a second). */
  private shareStory(w: World, dtMs: number): void {
    this.storyT -= dtMs;
    if (this.storyT > 0) return;
    this.storyT = 500;
    const q: Record<string, string> = {};
    for (const [id, e] of Object.entries(w.hero.quests)) q[id] = packQuest(e);
    const json = JSON.stringify(q);
    if (json === this.storySent) return;
    this.storySent = json;
    this.send({ t: 'q', q } satisfies StoryMsg);
  }

  private onStory(w: World, m: StoryMsg): void {
    const quests: Character['quests'] = {};
    for (const [id, packed] of Object.entries(m.q ?? {})) {
      if (!QUEST_DEFS[id] || typeof packed !== 'string') continue;
      const e = unpackQuest(packed) as Character['quests'][string] | null;
      if (e) quests[id] = e;
    }
    this.layerQuests = quests;
    this.applyLayer(w);
  }

  /** A guest's world shows the leader's story: who stands where, what is built, which foes are out. */
  private applyLayer(w: World): void {
    w.layer = { ...w.hero, quests: this.layerQuests! };
    w.refreshStoryState();
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
    if (this.role === 'host' && this.members.size) this.shareStory(w, dtMs);
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
        else if (o.t === 'event') this.events.push(['ev', o.id]);
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
    // a land's hundreds of enemies: only those near a hero (a dungeon's rooms all go)
    const open = w.region.kind !== 'dungeon';
    const heroes = [w.player, ...w.coop!.ghosts.filter((g) => !g.dead)];
    for (const x of w.enemies) {
      if (x.dead || x.dummy) continue;
      if (open && !heroes.some((h) => Math.abs(h.x - x.x) < NEAR && Math.abs(h.y - x.y) < NEAR)) continue;
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
    try {
      if (m.t === 'p') this.onHero(w, n, m as HeroMsg);
      else if (m.t === 's' && this.role === 'guest' && n === this.host) this.onFrame(w, m as FrameMsg);
      else if (m.t === 'g' && this.role === 'host' && n !== this.me) this.onHits(w, m as GuestMsg);
      else if (m.t === 'q' && this.role === 'guest' && n === this.host) this.onStory(w, m as StoryMsg);
    } catch {
      /* a malformed message: dropped (the next one carries the state again) */
    }
  }

  private onHero(w: World, n: number, m: HeroMsg): void {
    const g = w.coop!.ghosts.find((x) => x.n === n);
    if (!g) return;
    if (typeof m.x !== 'number' || typeof m.y !== 'number' || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const first = g.seen <= 0 || w.time - g.seen > LOST_S;
    g.tx = num(m.x, -POS, POS);
    g.ty = num(m.y, -POS, POS);
    // the first word from a hero (or after a long silence) puts them there at once
    if (first) {
      g.x = g.tx;
      g.y = g.ty;
    }
    g.vx = num(m.vx, -5000, 5000);
    g.vy = num(m.vy, -5000, 5000);
    g.dir = num(m.dir, -10, 10);
    g.maxHp = num(m.mh, 1, 1e9, 1);
    g.hp = num(m.hp, 0, g.maxHp);
    g.dead = m.dead === 1;
    g.untouchable = m.u === 1;
    g.shots = [];
    for (const row of list(m.sh, 24)) {
      if (!Array.isArray(row)) continue;
      const [x, y, vx, vy, r, color] = row as unknown[];
      g.shots.push({ x: num(x, -POS, POS), y: num(y, -POS, POS), vx: num(vx, -5000, 5000), vy: num(vy, -5000, 5000), r: num(r, 1, 60, 4), color: str(color, 16) || '#ffffff' });
    }
    g.seen = w.time;
  }

  /** Host: a guest's hits land on the real enemies; its falls cost the clock. */
  private onHits(w: World, m: GuestMsg): void {
    // a hit never takes more than the enemy has, and one message never more than a share of a boss
    const boss = new Map<number, number>();
    for (const row of list(m.h, 64)) {
      if (!Array.isArray(row)) continue;
      const [id, dmg, kx, ky] = row as unknown[];
      const e = typeof id === 'number' ? w.enemyById(id) : undefined;
      if (!e) continue;
      let d = num(dmg, 0, Math.max(0, e.maxHp));
      if (e.boss) {
        const left = Math.max(0, e.maxHp * BOSS_SHARE - (boss.get(e.id) ?? 0));
        d = Math.min(d, left);
        boss.set(e.id, (boss.get(e.id) ?? 0) + d);
      }
      if (d > 0) remoteHit(w, e, d, num(kx, -400, 400), num(ky, -400, 400));
    }
    for (const row of list(m.st, 16)) {
      if (!Array.isArray(row)) continue;
      const [id, status, dur, power] = row as unknown[];
      const e = typeof id === 'number' ? w.enemyById(id) : undefined;
      if (e && typeof status === 'string' && GUEST_STATUS.has(status)) applyStatus(w, e, { status: status as StatusId, dur: num(dur, 0, STATUS_DUR), power: num(power, 0, STATUS_POWER) }, 0);
    }
    const died = Math.floor(num(m.died, 0, DIED_MAX));
    for (let i = 0; i < died; i++) if (w.keyRun && !w.keyRun.end) w.keyRun.deaths += 1;
  }

  /** Guest: the host's frame. */
  private onFrame(w: World, m: FrameMsg): void {
    // what happened first (a kill needs the enemy still here), then where everything is now
    this.kills = 0;
    for (const ev of list(m.ev, 200)) if (Array.isArray(ev)) this.onEvent(w, ev as Event);
    const seen = new Set<number>();
    for (const raw of list(m.e, 600)) {
      if (!Array.isArray(raw) || typeof raw[0] !== 'number' || typeof raw[1] !== 'string') continue;
      const [id, def] = raw as [number, string];
      const x = num(raw[2], -POS, POS);
      const y = num(raw[3], -POS, POS);
      const mh = num(raw[5], 1, 1e10, 1);
      const hp = num(raw[4], 0, mh);
      const flags = num(raw[6], 0, 7);
      const level = Math.round(num(raw[7], 1, LEVEL_MAX, 1));
      const face = num(raw[8], -10, 10);
      const state = str(raw[9], 16) || 'chase';
      const name = str(raw[10], 40);
      const elite = str(raw[11], 120);
      const room = Math.round(num(raw[12], -1, 999, -1));
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
    if (Array.isArray(m.k) && w.keyRun && !w.keyRun.end) {
      w.keyRun.t = num(m.k[0], 0, 1e6, w.keyRun.t);
      w.keyRun.deaths = Math.round(num(m.k[1], 0, 1e4, w.keyRun.deaths));
    }
  }

  /** Guest: kills taken from the frame being read (a frame claiming more is not believed past it). */
  private kills = 0;

  private onEvent(w: World, ev: Event): void {
    if (ev[0] === 'h') {
      const [, n, rawDmg, fx, fy, knock, status, dur, power, src] = ev;
      if (n !== this.me) return;
      const dmg = num(rawDmg, 0, 1e9);
      if (dmg <= 0) return;
      const source = typeof src === 'number' && src >= 0 ? w.enemyById(src) : undefined;
      const st = typeof status === 'string' && STATUS_IDS.has(status) ? { status: { status: status as StatusId, dur: num(dur, 0, STATUS_DUR), power: num(power, 0, 1e6) } } : {};
      hurtPlayer(w, dmg, { ...(Number.isFinite(fx) && Number.isFinite(fy) ? { fromX: fx, fromY: fy } : {}), knock: num(knock, 0, 2000), ...st, ...(source ? { source } : {}) });
    } else if (ev[0] === 'k') {
      // only an enemy this game has seen alive, and never more kills than a frame can hold
      const e = typeof ev[1] === 'number' ? w.enemyById(ev[1]) : undefined;
      if (!e || e.dead || this.kills >= KILLS_MAX) return;
      this.kills += 1;
      // the host's kill: this hero's experience, gold and loot, rolled here
      e.hp = 0;
      if (!e.boss) {
        e.dead = true;
        e.state = 'dead';
        e.deathT = 0;
      }
      w.onKill(e);
    } else if (ev[0] === 'b') {
      const e = typeof ev[1] === 'number' ? w.enemyById(ev[1]) : undefined;
      if (e?.boss && !e.dead) w.bossFinished(e);
    } else if (ev[0] === 'end') {
      if (!Number.isFinite(ev[1]) || !Number.isInteger(ev[2]) || ev[2] < 0 || ev[2] > UP_MAX) return;
      w.applyKeyEnd(num(ev[1], 0, 1e6), ev[2]);
    }
    // a story event the party won: this hero's quest for it counts too
    else if (ev[0] === 'ev') {
      const id = ev[1];
      if (typeof id !== 'string' || id.length > 60) return;
      w.questProgress((o) => o.kind === 'event' && o.event === id);
    }
  }

  /** Guest: the host's attacks in the air, as copies that only show (remote). */
  private mirrorAttacks(w: World, m: FrameMsg): void {
    w.telegraphs = w.telegraphs.filter((t) => t.tone === 'player');
    for (const [id, shape, x, y, r, r2, angle, len, dur, t, tone, linger] of list(m.tg, 200) as FrameMsg['tg'])
      w.telegraphs.push({ id, shape, x, y, r, r2, angle, len, t, dur, dmg: 0, knock: 0, tone, owner: -1, linger, remote: true, dead: false });
    w.projectiles = w.projectiles.filter((p) => !p.hostile);
    for (const [x, y, vx, vy, r, look, color] of list(m.pr, 400) as FrameMsg['pr']) w.projectiles.push(remoteShot(x, y, vx, vy, r, look, color));
    w.fields = w.fields.filter((f) => !f.hostile);
    for (const [x, y, r, look, t, dur] of list(m.fd, 100) as FrameMsg['fd']) w.fields.push({ id: -1, x, y, r, t, dur, tick: 1, tickT: 1, dmg: 0, type: 'physical', look, hostile: true, depth: 0, spec: null, onHit: false, remote: true });
    w.waves = (list(m.wv, 50) as FrameMsg['wv']).map(([x, y, r, speed, max, width]): Wave => ({ id: -1, x, y, r, speed, max, width, dmg: 0, hitPlayer: true, remote: true, dead: false }));
  }
}

const STATUS_IDS = new Set<string>(['burn', 'poison', 'chill', 'freeze', 'shock', 'stun', 'root', 'armorBreak', 'mark', 'weaken', 'bleed', 'curse', 'fear'] satisfies StatusId[]);

function remoteShot(x: number, y: number, vx: number, vy: number, r: number, look: string, color: string): Projectile {
  return { id: -1, x, y, vx, vy, r, life: 400, hostile: true, dmg: 0, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look, color, child: false, splitDone: true, trailT: 0, homing: 0, age: 0, knock: 0, wide: false, remote: true, dead: false };
}
