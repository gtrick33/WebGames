/**
 * A level played together in a live room (room.ts keeps the party; this is the level on one device).
 *
 * Every game runs the critters its player controls, so their moves answer at once, and sends where they
 * are twenty times a second (with any crate it is pushing). Critters run by others are eased toward the
 * places they send. The host's game owns the shared world: crates, levers, gems, deaths and the exit. It
 * sends a world frame twelve times a second and its events (a restart after a death, the level cleared);
 * a guest's game tells it about a death, a gem or a lever pulled. If the host changes mid-level, the new
 * host's game carries on from its own copy of the world (the last frame it had). Solo play is the same
 * game with no network: one device, every critter, the host.
 *
 * Messages travel inside the room's relay (`{ t: 'r', d }`), which keeps their order. `send` is that relay
 * (a test wires two games together without it).
 */
import { cellAt, Cell, type Level } from './level';
import { CH, CW, gemsTaken, newWorld, resetWorld, seconds, stepWorld, type SimEvent, type World } from './sim';

const CRITTER_EVERY = 3;
const FRAME_EVERY = 5;
/** Per step, how much of the way a drawn critter closes to where it was last heard (≈ 20 per second). */
const EASE = 0.3;
/** A critter not heard from directly in this many steps is placed from the host's frames. */
const QUIET = 30;
/** A guest keeps a crate it pushed this many steps after the last push (its fall included). */
const CLAIM = 24;

export interface Clear {
  secs: number;
  gems: number;
  tries: number;
}

interface Heard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  at: number;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** The first `n` entries of a relayed array, when they all are numbers (else null). */
function nums(v: unknown, n: number): number[] | null {
  if (!Array.isArray(v) || v.length < n) return null;
  const out = v.slice(0, n).map(num);
  return out.every((x) => x !== null) ? (out as number[]) : null;
}
const r2 = (v: number): number => Math.round(v * 100);

export class Coop {
  readonly w: World;
  readonly run: number;
  me: number;
  host: boolean;
  /** Who runs each critter (a seat number). */
  own: number[];
  /** What happened this step that the player should hear or see (sim events, others' gems). */
  fx: SimEvent[] = [];
  private heard: (Heard | null)[];
  private ticks = 0;
  /** Guest: crates this game pushed lately (steps left). Host: crates a guest is pushing (until tick). */
  private claims = new Map<number, number>();
  private mineGems = new Set<number>();
  private clearSent = false;

  constructor(
    lv: Level,
    run: number,
    me: number,
    own: number[],
    host: boolean,
    private send: (d: unknown) => void,
    private onClear: (c: Clear) => void,
  ) {
    this.w = newWorld(lv);
    this.run = run;
    this.me = me;
    this.own = own;
    this.host = host;
    this.heard = lv.spawns.map(() => null);
  }

  mine(i: number): boolean {
    return this.own[i] === this.me;
  }

  /** The room changed who hosts or who runs which critter. */
  setRoles(host: boolean, own: number[]): void {
    const was = this.own;
    const becameHost = host && !this.host;
    this.own = own;
    this.host = host;
    this.w.cr.forEach((c, i) => {
      const now = own[i] === this.me;
      const before = was[i] === this.me;
      // taken over: it carries on from where it was last seen
      if (now && !before) {
        const h = this.heard[i];
        if (h) [c.vx, c.vy] = [h.vx, h.vy];
        c.held = 0;
      } else if (!now && before) this.heard[i] = { x: c.x, y: c.y, vx: c.vx, vy: c.vy, at: this.ticks };
    });
    if (becameHost) {
      this.claims.clear();
      for (const k of this.w.crates) k.ext = false;
      // a death the old host never answered, or a clear it never reported
      if (this.w.cr.some((c) => c.dead)) this.restart();
      if (this.w.cleared) {
        this.clearSent = false;
        this.reportClear();
      }
      this.sendFrame();
    }
  }

  /** The host's game starts the level over (a death, or someone asked). */
  restart(): void {
    if (!this.host) {
      this.send({ k: 'e', run: this.run, tr: this.w.tries, e: 'reset', i: 0 });
      return;
    }
    resetWorld(this.w);
    this.respawnOthers();
    this.fx.push({ k: 'reset', i: 0 });
    this.send({ k: 'x', run: this.run, tr: this.w.tries, e: 'reset' });
    this.sendFrame();
  }

  private respawnOthers(): void {
    this.heard = this.heard.map(() => null);
    this.claims.clear();
    this.mineGems.clear();
  }

  /** A guest's game catches up with a restart the host made. */
  private takeReset(tr: number): void {
    resetWorld(this.w);
    this.w.tries = tr;
    this.respawnOthers();
    this.fx.push({ k: 'reset', i: 0 });
  }

  private reportClear(): void {
    if (this.clearSent) return;
    this.clearSent = true;
    this.send({ k: 'x', run: this.run, tr: this.w.tries, e: 'clear' });
    this.onClear({ secs: Math.round(seconds(this.w) * 10) / 10, gems: gemsTaken(this.w), tries: this.w.tries });
  }

  /** One step: my critters move with `input` (per critter), the others are eased to where they were heard. */
  step(input: readonly number[]): SimEvent[] {
    const w = this.w;
    this.ticks++;
    const local = w.cr.map((_, i) => this.mine(i));
    w.cr.forEach((c, i) => {
      if (local[i]) return;
      const h = this.heard[i];
      const x0 = c.x;
      const y0 = c.y;
      if (h) {
        const far = Math.abs(h.x - c.x) + Math.abs(h.y - c.y) > 3;
        c.x = far ? h.x : c.x + (h.x - c.x) * EASE;
        c.y = far ? h.y : c.y + (h.y - c.y) * EASE;
        c.vx = h.vx;
        c.vy = h.vy;
      }
      c.dx = c.x - x0;
      c.dy = c.y - y0;
    });
    w.crates.forEach((k, j) => {
      const claimed = this.claims.get(j);
      k.ext = this.host ? claimed !== undefined && claimed > this.ticks : !(claimed !== undefined && claimed > 0);
    });
    const ev = stepWorld(w, input, local, this.host);
    for (const e of ev) {
      if (e.k === 'push' && !this.host) this.claims.set(e.i, CLAIM);
      else if (e.k === 'die') {
        if (this.host) this.restart();
        else this.send({ k: 'e', run: this.run, tr: w.tries, e: 'die', i: e.i });
      } else if (e.k === 'gem' && !this.host) {
        this.mineGems.add(e.i);
        this.send({ k: 'e', run: this.run, tr: w.tries, e: 'gem', i: e.i });
      } else if (e.k === 'lever' && !this.host) this.send({ k: 'e', run: this.run, tr: w.tries, e: 'lever', i: e.i });
      else if (e.k === 'clear') this.reportClear();
    }
    if (!this.host)
      for (const [j, left] of this.claims) {
        const k = w.crates[j];
        // a crate still falling stays ours until it lands
        if (k && k.vy !== 0) this.claims.set(j, CLAIM);
        else if (left <= 1) this.claims.delete(j);
        else this.claims.set(j, left - 1);
      }
    if (this.ticks % CRITTER_EVERY === 0) this.sendCritters();
    if (this.host && this.ticks % FRAME_EVERY === 0) this.sendFrame();
    const out = [...this.fx, ...ev];
    this.fx = [];
    return out;
  }

  private sendCritters(): void {
    const c = this.w.cr.flatMap((q, i) => (this.mine(i) ? [[i, r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), (q.ground ? 1 : 0) | (q.dead ? 2 : 0) | (q.face < 0 ? 4 : 0)]] : []));
    if (!c.length) return;
    const b = this.host ? [] : [...this.claims.keys()].map((j) => [j, r2(this.w.crates[j]!.x), r2(this.w.crates[j]!.y)]);
    this.send(b.length ? { k: 'c', run: this.run, tr: this.w.tries, c, b } : { k: 'c', run: this.run, tr: this.w.tries, c });
  }

  private sendFrame(): void {
    const w = this.w;
    const bits = (a: boolean[]): number => a.reduce((n, v, i) => (v ? n | (1 << i) : n), 0);
    this.send({
      k: 'w',
      run: this.run,
      tr: w.tries,
      t: w.t,
      c: w.cr.map((q) => [r2(q.x), r2(q.y), (q.ground ? 1 : 0) | (q.dead ? 2 : 0) | (q.face < 0 ? 4 : 0)]),
      b: w.crates.map((k) => [r2(k.x), r2(k.y), k.gone ? 1 : 0]),
      l: bits(w.levers),
      g: bits(w.gems),
    });
  }

  /** A message relayed from seat `n`. */
  receive(n: number, d: unknown): void {
    if (!d || typeof d !== 'object') return;
    const m = d as Record<string, unknown>;
    const w = this.w;
    if (m.run !== this.run || typeof m.tr !== 'number') return;
    if (m.k === 'c') {
      if (m.tr !== w.tries || !Array.isArray(m.c)) return;
      for (const e of m.c as unknown[]) {
        const v = nums(e, 6);
        if (!v) continue;
        const [i, x, y, vx, vy, fl] = v as [number, number, number, number, number, number];
        if (!Number.isInteger(i) || i < 0 || i >= w.cr.length) continue;
        if (this.own[i] !== n || this.mine(i)) continue;
        this.heard[i] = { x: x / 100, y: y / 100, vx: vx / 100, vy: vy / 100, at: this.ticks };
        const c = w.cr[i]!;
        c.ground = (fl & 1) !== 0;
        if (fl & 2 && !c.dead) this.fx.push({ k: 'die', i, x: x / 100 + CW / 2, y: y / 100 + CH / 2 });
        c.dead = (fl & 2) !== 0;
        c.face = fl & 4 ? -1 : 1;
      }
      if (Array.isArray(m.b))
        for (const e of m.b as unknown[]) {
          const v = nums(e, 3);
          if (!v) continue;
          const [j, x, y] = v as [number, number, number];
          const k = Number.isInteger(j) ? w.crates[j] : undefined;
          if (!k || (!this.host && this.claims.has(j))) continue;
          k.x = x / 100;
          k.y = y / 100;
          k.vy = 0;
          if (this.host) this.claims.set(j, this.ticks + CLAIM);
        }
    } else if (m.k === 'w' && !this.host) {
      if (m.tr > w.tries) this.takeReset(m.tr);
      if (m.tr !== w.tries) return;
      const t = num(m.t);
      // the platforms move with the host's clock: catch up by a step at a time, jump if far off
      if (t !== null) w.t = Math.abs(t + 3 - w.t) > 30 ? t + 3 : w.t + Math.sign(t + 3 - w.t);
      if (Array.isArray(m.b))
        (m.b as unknown[]).forEach((e, j) => {
          const k = w.crates[j];
          const v = nums(e, 3);
          if (!k || !v || this.claims.has(j)) return;
          const [x, y, gone] = v as [number, number, number];
          k.x = x / 100;
          k.y = y / 100;
          k.gone = gone === 1;
        });
      const l = num(m.l) ?? 0;
      w.levers = w.levers.map((_, i) => (l & (1 << i)) !== 0);
      const g = num(m.g) ?? 0;
      w.gems = w.gems.map((was, i) => {
        const now = (g & (1 << i)) !== 0 || this.mineGems.has(i);
        if (now && !was) this.fx.push({ k: 'gem', i });
        return now;
      });
      // critters not heard from lately (a reload, a new owner): where the host last saw them
      if (Array.isArray(m.c))
        (m.c as unknown[]).forEach((e, i) => {
          const v = nums(e, 2);
          if (!v || this.mine(i) || !w.cr[i]) return;
          const h = this.heard[i];
          if (h && this.ticks - h.at < QUIET) return;
          this.heard[i] = { x: v[0]! / 100, y: v[1]! / 100, vx: 0, vy: 0, at: this.ticks - QUIET };
        });
    } else if (m.k === 'e' && this.host) {
      const i = num(m.i);
      if (m.tr !== w.tries || i === null || !Number.isInteger(i)) return;
      if (m.e === 'die' || m.e === 'reset') this.restart();
      else if (m.e === 'gem' && i >= 0 && i < w.gems.length && !w.gems[i]) {
        w.gems[i] = true;
        this.fx.push({ k: 'gem', i });
      } else if (m.e === 'lever' && i >= 0 && i < w.levers.length) {
        w.levers[i] = !w.levers[i];
        this.fx.push({ k: 'lever', i });
      }
    } else if (m.k === 'x' && !this.host) {
      if (m.e === 'reset' && m.tr > w.tries) this.takeReset(m.tr);
      else if (m.e === 'clear' && m.tr === w.tries) w.cleared = true;
    }
  }

  /** Whether critter i stands in the exit now (drawn). */
  home(i: number): boolean {
    const c = this.w.cr[i];
    return !!c && !c.dead && cellAt(this.w.lv, Math.floor(c.x + CW / 2), Math.floor(c.y + CH / 2)) === Cell.Exit;
  }
}
