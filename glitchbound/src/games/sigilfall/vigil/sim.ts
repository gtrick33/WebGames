import { BOSS_EVERY, BOSSES, FOES, MAX_SPELL, MAX_STRENGTH, SPELL_SLOTS, SPELLS, STRENGTH_SLOTS, STRENGTHS, type FoeDef, type SpellId, type StrengthId } from './kit';

/**
 * The Vigil's simulation, apart from all drawing so it can be tested and run fast: hundreds of foes walk straight at
 * the hero (a grid keeps them from piling up and finds targets), spells fire by themselves, sparks give experience,
 * and every level offers three cards. Seeded, so a run replays the same given the same input.
 */

export const MAX_FOES = 320;
const CELL = 24;
const HERO_R = 7;

export interface Foe {
  id: number;
  def: FoeDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  r: number;
  xp: number;
  face: number;
  walk: number;
  flash: number;
  slow: number;
  frozen: number;
  boss: string | null;
  dead: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  burst: number;
  hit: Set<number>;
  dead: boolean;
}

export interface Spark {
  x: number;
  y: number;
  xp: number;
  pulled: boolean;
  dead: boolean;
}

export interface Field {
  x: number;
  y: number;
  r: number;
  dps: number;
  life: number;
  max: number;
}

/** Something to draw for a moment: a ring, a bolt of lightning, a falling star, a number. */
export type Fx =
  | { kind: 'ring'; x: number; y: number; r: number; t: number; dur: number; cold: boolean }
  | { kind: 'bolt'; pts: [number, number][]; t: number; dur: number }
  | { kind: 'star'; x: number; y: number; r: number; t: number; dur: number }
  | { kind: 'burst'; x: number; y: number; r: number; t: number; dur: number };

export type Card = { kind: 'spell'; id: SpellId; level: number; evolve?: boolean } | { kind: 'strength'; id: StrengthId; level: number } | { kind: 'heal' };

export interface VigilInput {
  mx: number;
  my: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const xpForLevel = (level: number): number => Math.round(3 + level * 2.4 + level ** 1.5 * 0.7);

export class Vigil {
  t = 0;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  dirX = 0;
  dirY = 1;
  hp = 120;
  level = 1;
  xp = 0;
  kills = 0;
  iframe = 0;
  over = false;
  rerolls = 3;
  spells: Partial<Record<SpellId, number>> = { 'ember-bolt': 1 };
  evolved = new Set<SpellId>();
  strengths: Partial<Record<StrengthId, number>> = {};
  foes: Foe[] = [];
  shots: Shot[] = [];
  sparks: Spark[] = [];
  fields: Field[] = [];
  fx: Fx[] = [];
  /** Waiting for the player's pick. */
  cards: Card[] | null = null;
  /** Level-ups still owed (a burst of sparks can give more than one). */
  owed = 0;
  /** The name of the champion that just came, for a banner. */
  banner: { text: string; t: number } | null = null;
  orbit = 0;
  /** For the drawing to take as they happen: numbers, deaths and how hard the screen should kick. */
  pops: { x: number; y: number; n: number; big: boolean }[] = [];
  falls: { x: number; y: number; boss: boolean }[] = [];
  shake = 0;
  /** Set for a moment when the hero is struck, or levels up. */
  struck = 0;
  levelFlash = 0;

  private rand: () => number;
  private nextId = 1;
  private spawnT = 0;
  private bossesDone = 0;
  private cool: Partial<Record<SpellId, number>> = {};
  private grid = new Map<number, Foe[]>();
  private gem = 0;

  constructor(
    seed: number,
    x: number,
    y: number,
    private readonly solid: (x: number, y: number) => boolean = () => false,
    private readonly bounds = { x0: 0, y0: 0, x1: 4000, y1: 4000 },
  ) {
    this.rand = rng(seed);
    this.x = x;
    this.y = y;
  }

  /* -------------------------------------------------------------- what it all adds up to */

  private str(id: StrengthId): number {
    return this.strengths[id] ?? 0;
  }
  get maxHp(): number {
    return 120 * (1 + this.str('vigor') * 0.2);
  }
  get power(): number {
    return 1 + this.str('might') * 0.15;
  }
  private get pace(): number {
    return 1 - this.str('haste') * 0.1;
  }
  private get area(): number {
    return 1 + this.str('reach') * 0.12;
  }
  get speed(): number {
    return 78 * (1 + this.str('swift') * 0.08);
  }
  get pickup(): number {
    return 46 + this.str('magnet') * 18;
  }
  get xpNext(): number {
    return xpForLevel(this.level);
  }
  /** The Host grows with time and never stops growing: that is the Vigil. */
  private get toughness(): number {
    const m = this.t / 60;
    return 1 + m * 0.14 + (m * m) / 70;
  }

  /* -------------------------------------------------------------- the frame */

  step(dt: number, input: VigilInput): void {
    if (this.over || this.cards) return;
    // a browser's first frame can be stamped before the run began: time only goes forward
    if (!(dt > 0)) return;
    this.t += dt;
    this.moveHero(dt, input);
    this.iframe = Math.max(0, this.iframe - dt);
    const mend = this.str('mend');
    if (mend) this.hp = Math.min(this.maxHp, this.hp + mend * dt);
    this.spawn(dt);
    this.buildGrid();
    this.moveFoes(dt);
    this.castSpells(dt);
    this.moveShots(dt);
    this.burnFields(dt);
    this.moveSparks(dt);
    this.fx = this.fx.filter((f) => (f.t += dt) < f.dur);
    this.shake = Math.max(0, this.shake - dt * 32);
    this.struck = Math.max(0, this.struck - dt * 2.6);
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.2);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.foes.some((f) => f.dead)) this.foes = this.foes.filter((f) => !f.dead);
    if (this.shots.some((s) => s.dead)) this.shots = this.shots.filter((s) => !s.dead);
    if (this.sparks.some((s) => s.dead)) this.sparks = this.sparks.filter((s) => !s.dead);
    if (this.owed > 0 && !this.cards) this.offerCards();
    if (this.hp <= 0) {
      this.hp = 0;
      this.over = true;
    }
  }

  private moveHero(dt: number, i: VigilInput): void {
    const len = Math.hypot(i.mx, i.my);
    const k = len > 1 ? 1 / len : 1;
    this.vx = i.mx * k * this.speed;
    this.vy = i.my * k * this.speed;
    if (len > 0.05) {
      this.dirX = i.mx;
      this.dirY = i.my;
    }
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (!this.solid(nx, this.y)) this.x = nx;
    if (!this.solid(this.x, ny)) this.y = ny;
    this.x = Math.max(this.bounds.x0, Math.min(this.bounds.x1, this.x));
    this.y = Math.max(this.bounds.y0, Math.min(this.bounds.y1, this.y));
  }

  private inSeason(): FoeDef[] {
    return Object.values(FOES).filter((f) => this.t >= f.from && this.t < f.to);
  }

  private spawn(dt: number): void {
    // a champion on the hour
    const due = Math.floor(this.t / BOSS_EVERY);
    if (due > this.bossesDone) {
      this.bossesDone = due;
      const b = BOSSES[(due - 1) % BOSSES.length]!;
      const def = Object.values(FOES).find((f) => f.sprite === b.sprite)!;
      this.addFoe(def, b.name);
      this.banner = { text: `${b.name} comes`, t: 3 };
    }
    // the tide: slow at first, then a flood
    const rate = Math.min(22, 0.8 + this.t * 0.016 + (this.t / 60) ** 1.7 * 0.32);
    this.spawnT += dt * rate;
    const pool = this.inSeason();
    const total = pool.reduce((a, f) => a + f.weight, 0);
    while (this.spawnT >= 1 && this.foes.length < MAX_FOES) {
      this.spawnT -= 1;
      let n = this.rand() * total;
      const def = pool.find((f) => (n -= f.weight) < 0) ?? pool[0]!;
      this.addFoe(def, null);
    }
    if (this.spawnT > 1) this.spawnT = 1;
  }

  private addFoe(def: FoeDef, boss: string | null): void {
    const a = this.rand() * Math.PI * 2;
    const d = 210 + this.rand() * 50;
    const tough = this.toughness;
    const hp = def.hp * tough * (boss ? 38 : 1);
    this.foes.push({
      id: this.nextId++,
      def,
      x: this.x + Math.cos(a) * d,
      y: this.y + Math.sin(a) * d,
      hp,
      maxHp: hp,
      dmg: def.dmg * (1 + (tough - 1) * 0.45) * (boss ? 1.8 : 1),
      speed: def.speed * (boss ? 0.8 : 1),
      r: def.r * (boss ? 2 : 1),
      xp: def.xp * (boss ? 25 : 1),
      face: 0,
      walk: 0,
      flash: 0,
      slow: 0,
      frozen: 0,
      boss,
      dead: false,
    });
  }

  private buildGrid(): void {
    this.grid.clear();
    for (const f of this.foes) {
      if (f.dead) continue;
      const k = this.key(f.x, f.y);
      const cell = this.grid.get(k);
      if (cell) cell.push(f);
      else this.grid.set(k, [f]);
    }
  }

  private key(x: number, y: number): number {
    return (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(y / CELL) + 32768);
  }

  /** Every foe near a point (within r plus their own size is the caller's check). */
  private around(x: number, y: number, r: number, visit: (f: Foe) => void): void {
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.grid.get((cx + 32768) * 65536 + (cy + 32768));
        if (cell) for (const f of cell) if (!f.dead) visit(f);
      }
    }
  }

  private moveFoes(dt: number): void {
    for (const f of this.foes) {
      if (f.dead) continue;
      f.flash = Math.max(0, f.flash - dt);
      f.slow = Math.max(0, f.slow - dt);
      if (f.frozen > 0) {
        f.frozen -= dt;
        continue;
      }
      const dx = this.x - f.x;
      const dy = this.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = f.speed * (f.slow > 0 ? 0.55 : 1);
      let mx = (dx / d) * sp;
      let my = (dy / d) * sp;
      // shoulder apart from neighbors, so the Host spreads into a crowd rather than a stack
      this.around(f.x, f.y, f.r + 10, (o) => {
        if (o === f) return;
        const ox = f.x - o.x;
        const oy = f.y - o.y;
        const od = Math.hypot(ox, oy);
        const reach = f.r + o.r;
        if (od > 0.01 && od < reach) {
          const push = ((reach - od) / reach) * 60;
          mx += (ox / od) * push;
          my += (oy / od) * push;
        }
      });
      f.x += mx * dt;
      f.y += my * dt;
      f.face = Math.atan2(my, mx);
      f.walk += dt;
      // the hero far outrun: it comes around again on the near side instead of trailing forever
      if (d > 430 && !f.boss) {
        const a = this.rand() * Math.PI * 2;
        f.x = this.x + Math.cos(a) * 240;
        f.y = this.y + Math.sin(a) * 240;
      }
      if (d < f.r + HERO_R && this.iframe <= 0) {
        this.hp -= f.dmg;
        this.iframe = 0.6;
        this.struck = 1;
        this.shake = Math.max(this.shake, 4);
      }
    }
  }

  private hurt(f: Foe, dmg: number): void {
    if (f.dead) return;
    f.hp -= dmg;
    f.flash = 0.08;
    // the numbers that matter: not the trickle from burning ground and motes
    if (dmg >= 6 && this.pops.length < 60) this.pops.push({ x: f.x, y: f.y - f.r - 6, n: Math.round(dmg), big: dmg >= 40 });
    if (f.hp <= 0) {
      f.dead = true;
      this.kills++;
      if (this.falls.length < 60) this.falls.push({ x: f.x, y: f.y - f.r * 0.6, boss: !!f.boss });
      if (f.boss) this.shake = Math.max(this.shake, 14);
      this.sparks.push({ x: f.x, y: f.y, xp: f.xp, pulled: false, dead: false });
      // a champion's fall is a free choice
      if (f.boss) this.owed++;
    }
  }

  private nearest(range: number, skip?: Set<number>): Foe | null {
    let best: Foe | null = null;
    let bd = range * range;
    for (const f of this.foes) {
      if (f.dead || skip?.has(f.id)) continue;
      const d = (f.x - this.x) ** 2 + (f.y - this.y) ** 2;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------- spells */

  private ready(id: SpellId, dt: number, every: number): boolean {
    const left = (this.cool[id] ?? 0) - dt;
    if (left > 0) {
      this.cool[id] = left;
      return false;
    }
    this.cool[id] = every * this.pace;
    return true;
  }

  private castSpells(dt: number): void {
    const s = this.spells;
    const p = this.power;
    const a = this.area;
    if (s['ember-bolt']) this.emberBolt(dt, s['ember-bolt'], p, a);
    if (s['frost-ring']) this.frostRing(dt, s['frost-ring'], p, a);
    if (s['chain-spark']) this.chainSpark(dt, s['chain-spark'], p);
    if (s['orbit-motes']) this.motes(dt, s['orbit-motes'], p, a);
    if (s.meteor) this.star(dt, s.meteor, p, a);
    if (s['ash-field']) this.burningGround(dt, s['ash-field'], p, a);
  }

  private emberBolt(dt: number, l: number, p: number, a: number): void {
    const phoenix = this.evolved.has('ember-bolt');
    if (!this.ready('ember-bolt', dt, Math.max(0.42, 1.05 - l * 0.09))) return;
    const n = 1 + Math.floor((l - 1) / 2) + (phoenix ? 2 : 0);
    const dmg = (11 + l * 4) * p * (phoenix ? 1.5 : 1);
    const taken = new Set<number>();
    for (let i = 0; i < n; i++) {
      const t = this.nearest(240, taken) ?? this.nearest(240);
      if (!t) return;
      taken.add(t.id);
      const ang = Math.atan2(t.y - this.y, t.x - this.x) + (i ? (this.rand() - 0.5) * 0.25 : 0);
      this.shots.push({ x: this.x, y: this.y - 6, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, r: 4 * a, dmg, life: 1.5, pierce: phoenix ? 99 : Math.floor(l / 3), burst: phoenix ? 22 * a : 0, hit: new Set(), dead: false });
    }
  }

  private frostRing(dt: number, l: number, p: number, a: number): void {
    if (!this.ready('frost-ring', dt, Math.max(1.8, 4.2 - l * 0.4))) return;
    const zero = this.evolved.has('frost-ring');
    const r = (46 + l * 9) * a * (zero ? 1.3 : 1);
    this.fx.push({ kind: 'ring', x: this.x, y: this.y, r, t: 0, dur: 0.42, cold: true });
    this.around(this.x, this.y, r + 12, (f) => {
      if (Math.hypot(f.x - this.x, f.y - this.y) > r + f.r) return;
      this.hurt(f, (9 + l * 4) * p);
      f.slow = 2.2;
      if (zero && !f.boss) f.frozen = 1.6;
    });
  }

  private chainSpark(dt: number, l: number, p: number): void {
    if (!this.ready('chain-spark', dt, Math.max(0.8, 1.9 - l * 0.2))) return;
    const hops = 2 + l;
    const seen = new Set<number>();
    const pts: [number, number][] = [[this.x, this.y - 8]];
    let from = { x: this.x, y: this.y };
    for (let i = 0; i < hops; i++) {
      let next: Foe | null = null;
      let bd = (i === 0 ? 200 : 90) ** 2;
      this.around(from.x, from.y, i === 0 ? 200 : 90, (f) => {
        if (seen.has(f.id)) return;
        const d = (f.x - from.x) ** 2 + (f.y - from.y) ** 2;
        if (d < bd) {
          bd = d;
          next = f;
        }
      });
      if (!next) break;
      const f = next as Foe;
      seen.add(f.id);
      pts.push([f.x, f.y - 6]);
      this.hurt(f, (12 + l * 5) * p);
      from = f;
    }
    if (pts.length > 1) this.fx.push({ kind: 'bolt', pts, t: 0, dur: 0.16 });
  }

  /** Where each mote is now (the drawing asks too). */
  motePoints(): [number, number][] {
    const l = this.spells['orbit-motes'] ?? 0;
    if (!l) return [];
    const n = 1 + l;
    const R = 34 * this.area;
    return Array.from({ length: n }, (_, i) => {
      const a = this.orbit + (i / n) * Math.PI * 2;
      return [this.x + Math.cos(a) * R, this.y - 4 + Math.sin(a) * R * 0.8] as [number, number];
    });
  }

  private motes(dt: number, l: number, p: number, a: number): void {
    this.orbit += dt * (2.2 + l * 0.25);
    const r = 7 * a;
    for (const [x, y] of this.motePoints()) {
      this.around(x, y, r + 10, (f) => {
        if (Math.hypot(f.x - x, f.y - y) < r + f.r) this.hurt(f, (26 + l * 10) * p * dt);
      });
    }
  }

  private star(dt: number, l: number, p: number, a: number): void {
    if (!this.ready('meteor', dt, Math.max(2.2, 5.2 - l * 0.5))) return;
    // where the Host is thickest of a few places near the hero
    let best = { x: this.x, y: this.y, n: -1 };
    for (let i = 0; i < 6; i++) {
      const f = this.foes[Math.floor(this.rand() * this.foes.length)];
      if (!f) continue;
      let n = 0;
      this.around(f.x, f.y, 40, () => n++);
      if (n > best.n && Math.hypot(f.x - this.x, f.y - this.y) < 220) best = { x: f.x, y: f.y, n };
    }
    if (best.n < 0) return;
    const r = (34 + l * 6) * a;
    this.fx.push({ kind: 'star', x: best.x, y: best.y, r, t: 0, dur: 0.55 });
    this.shake = Math.max(this.shake, 6);
    this.around(best.x, best.y, r + 12, (f) => {
      if (Math.hypot(f.x - best.x, f.y - best.y) < r + f.r) this.hurt(f, (42 + l * 18) * p);
    });
  }

  private burningGround(dt: number, l: number, p: number, a: number): void {
    if (this.ready('ash-field', dt, Math.max(1.4, 3 - l * 0.28))) {
      const max = 2.4 + l * 0.4;
      this.fields.push({ x: this.x, y: this.y, r: (22 + l * 4) * a, dps: (12 + l * 7) * p, life: max, max });
    }
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) {
        s.dead = true;
        continue;
      }
      this.around(s.x, s.y, s.r + 12, (f) => {
        if (s.dead || s.hit.has(f.id) || Math.hypot(f.x - s.x, f.y - s.y) > s.r + f.r) return;
        s.hit.add(f.id);
        this.hurt(f, s.dmg);
        if (s.burst) {
          this.fx.push({ kind: 'burst', x: f.x, y: f.y, r: s.burst, t: 0, dur: 0.22 });
          this.around(f.x, f.y, s.burst + 12, (o) => {
            if (o !== f && Math.hypot(o.x - f.x, o.y - f.y) < s.burst + o.r) this.hurt(o, s.dmg * 0.5);
          });
        }
        if (s.pierce-- <= 0) s.dead = true;
      });
    }
  }

  private burnFields(dt: number): void {
    for (const b of this.fields) {
      b.life -= dt;
      this.around(b.x, b.y, b.r + 12, (f) => {
        if (Math.hypot(f.x - b.x, f.y - b.y) < b.r + f.r) this.hurt(f, b.dps * dt);
      });
    }
    this.fields = this.fields.filter((b) => b.life > 0);
  }

  private moveSparks(dt: number): void {
    const reach = this.pickup;
    for (const g of this.sparks) {
      const d = Math.hypot(this.x - g.x, this.y - g.y) || 1;
      if (d < reach) g.pulled = true;
      if (g.pulled) {
        const sp = 220 * dt;
        g.x += ((this.x - g.x) / d) * sp;
        g.y += ((this.y - g.y) / d) * sp;
      }
      if (d < 12) {
        g.dead = true;
        this.gain(g.xp);
      }
    }
    // a long night leaves a lot lying around: only the nearest stay, and what falls away isn't lost
    if (this.sparks.length > 260) {
      const extra = this.sparks.slice(0, this.sparks.length - 260);
      for (const g of extra) {
        this.gem += g.xp;
        g.dead = true;
      }
      if (this.gem > 0) {
        this.gain(this.gem);
        this.gem = 0;
      }
    }
  }

  private gain(xp: number): void {
    this.xp += xp * (1 + this.str('fortune') * 0.1);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.owed++;
      this.levelFlash = 1;
    }
  }

  /* -------------------------------------------------------------- level-ups */

  /** What could be offered now. */
  private pool(): Card[] {
    const out: Card[] = [];
    const held = Object.keys(this.spells).length;
    for (const def of Object.values(SPELLS)) {
      const l = this.spells[def.id] ?? 0;
      if (this.evolved.has(def.id)) continue;
      if (l >= MAX_SPELL) {
        if (def.evolve && this.str(def.evolve.with) >= 3) out.push({ kind: 'spell', id: def.id, level: l, evolve: true });
        continue;
      }
      if (l === 0 && held >= SPELL_SLOTS) continue;
      out.push({ kind: 'spell', id: def.id, level: l + 1 });
    }
    const heldStr = Object.keys(this.strengths).length;
    for (const def of Object.values(STRENGTHS)) {
      const l = this.strengths[def.id] ?? 0;
      if (l >= MAX_STRENGTH || (l === 0 && heldStr >= STRENGTH_SLOTS)) continue;
      out.push({ kind: 'strength', id: def.id, level: l + 1 });
    }
    return out;
  }

  private offerCards(): void {
    const pool = this.pool();
    const picks: Card[] = [];
    // an evolution ready to take is always on the table
    const evolve = pool.find((c) => c.kind === 'spell' && c.evolve);
    if (evolve) picks.push(evolve);
    // early on there is always a new spell to take: a run of nothing but strengths isn't a run
    if (Object.keys(this.spells).length < 3) {
      const fresh = pool.filter((c) => c.kind === 'spell' && c.level === 1);
      const c = fresh[Math.floor(this.rand() * fresh.length)];
      if (c) {
        picks.push(c);
        pool.splice(pool.indexOf(c), 1);
      }
    }
    while (picks.length < 3 && pool.length) {
      const c = pool.splice(Math.floor(this.rand() * pool.length), 1)[0]!;
      if (!picks.includes(c)) picks.push(c);
    }
    this.cards = picks.length ? picks : [{ kind: 'heal' }];
  }

  reroll(): void {
    if (!this.cards || this.rerolls <= 0) return;
    this.rerolls--;
    this.offerCards();
  }

  choose(i: number): void {
    const c = this.cards?.[i];
    if (!c) return;
    if (c.kind === 'spell') {
      if (c.evolve) this.evolved.add(c.id);
      else this.spells[c.id] = c.level;
    } else if (c.kind === 'strength') {
      const before = this.maxHp;
      this.strengths[c.id] = c.level;
      // new health comes filled
      this.hp += Math.max(0, this.maxHp - before);
    } else {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
    }
    this.cards = null;
    this.owed = Math.max(0, this.owed - 1);
    if (this.owed > 0) this.offerCards();
  }
}
