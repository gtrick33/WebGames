import type { ClassId } from '../data/types';
import { BOSS_EVERY, CLASS_BODY, firstSpell, foesOf, landTough, MAX_SPELL, MAX_STRENGTH, SPELL_SLOTS, SPELLS, spellsOf, STRENGTH_SLOTS, STRENGTHS, VIGIL_MAPS, type FoeDef, type SpellDef, type StrengthId, type VigilMap } from './kit';

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
  bossSprite: string | null;
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
  color: string;
  /** Comes back to the hero (an axe, a hammer). */
  back: boolean;
  spin: number;
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
  color: string;
  slow: boolean;
}

export interface Pet {
  spell: string;
  sprite: string;
  x: number;
  y: number;
  face: number;
  walk: number;
}

/** Something to draw for a moment. */
export type Fx =
  | { kind: 'ring'; x: number; y: number; r: number; t: number; dur: number; color: string }
  | { kind: 'bolt'; pts: [number, number][]; t: number; dur: number; color: string }
  | { kind: 'star'; x: number; y: number; r: number; t: number; dur: number; color: string }
  | { kind: 'burst'; x: number; y: number; r: number; t: number; dur: number; color: string }
  | { kind: 'cone'; x: number; y: number; a: number; r: number; arc: number; t: number; dur: number; color: string }
  | { kind: 'beam'; x: number; y: number; a: number; len: number; w: number; t: number; dur: number; color: string }
  | { kind: 'heal'; x: number; y: number; r: number; t: number; dur: number; color: string };

export type Card = { kind: 'spell'; id: string; level: number; evolve?: boolean } | { kind: 'strength'; id: StrengthId; level: number } | { kind: 'heal' };

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

export interface VigilOptions {
  cls?: ClassId;
  map?: VigilMap;
  solid?: (x: number, y: number) => boolean;
  bounds?: { x0: number; y0: number; x1: number; y1: number };
}

export class Vigil {
  readonly cls: ClassId;
  readonly map: VigilMap;
  t = 0;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  dirX = 0;
  dirY = 1;
  hp: number;
  level = 1;
  xp = 0;
  kills = 0;
  iframe = 0;
  over = false;
  rerolls = 3;
  spells: Record<string, number> = {};
  evolved = new Set<string>();
  strengths: Partial<Record<StrengthId, number>> = {};
  foes: Foe[] = [];
  shots: Shot[] = [];
  sparks: Spark[] = [];
  fields: Field[] = [];
  pets: Pet[] = [];
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
  private cool: Record<string, number> = {};
  private grid = new Map<number, Foe[]>();
  private beamHit = new Set<number>();
  private readonly waves: FoeDef[];
  private readonly solid: (x: number, y: number) => boolean;
  private readonly bounds: { x0: number; y0: number; x1: number; y1: number };

  constructor(seed: number, x: number, y: number, o: VigilOptions = {}) {
    this.rand = rng(seed);
    this.x = x;
    this.y = y;
    this.cls = o.cls ?? 'mage';
    this.map = o.map ?? VIGIL_MAPS[0]!;
    this.solid = o.solid ?? (() => false);
    this.bounds = o.bounds ?? { x0: 0, y0: 0, x1: 4000, y1: 4000 };
    this.waves = foesOf(this.map);
    this.hp = CLASS_BODY[this.cls].hp;
    this.spells[firstSpell(this.cls).id] = 1;
  }

  /* -------------------------------------------------------------- what it all adds up to */

  private str(id: StrengthId): number {
    return this.strengths[id] ?? 0;
  }
  get maxHp(): number {
    return CLASS_BODY[this.cls].hp * (1 + this.str('vigor') * 0.2);
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
    return CLASS_BODY[this.cls].speed * (1 + this.str('swift') * 0.08);
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
    return (1 + m * 0.14 + (m * m) / 70) * landTough(this.map);
  }

  /** A spell's numbers at its level, with its evolution in. */
  private stats(def: SpellDef): SpellStats {
    const l = this.spells[def.id] ?? 1;
    const evo = this.evolved.has(def.id) ? def.evolve : undefined;
    const every = def.every ? Math.max(def.every[2], def.every[0] - l * def.every[1]) : 0;
    const n = def.n ? def.n[0] + Math.floor((l - 1) / def.n[1]) : 1;
    const size = def.size ? def.size[0] + l * def.size[1] : 0;
    return {
      l,
      dmg: (def.dmg[0] + l * def.dmg[1]) * (evo?.dmg ?? 1) * this.power,
      every: every * (evo?.every ?? 1) * this.pace,
      n: n + (evo?.more ?? 0),
      size: size * (evo?.size ?? 1) * this.area,
      pierce: evo?.pierce ?? def.pierce ?? Math.floor(l / 3),
      burst: (evo?.burst ?? 0) * this.area,
      freeze: !!evo?.freeze,
      heal: def.heal ? (def.heal[0] + l * def.heal[1]) / 100 : 0,
      evo: !!evo,
    };
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
    this.movePets(dt);
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
    return this.waves.filter((f) => this.t >= f.from && this.t < f.to);
  }

  private spawn(dt: number): void {
    // a champion on the hour
    const due = Math.floor(this.t / BOSS_EVERY);
    if (due > this.bossesDone) {
      this.bossesDone = due;
      const list = this.map.champions;
      const b = list[(due - 1) % list.length]!;
      const season = this.inSeason();
      this.addFoe(season[season.length - 1] ?? this.waves[0]!, b.name, b.sprite);
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
      this.addFoe(def, null, null);
    }
    if (this.spawnT > 1) this.spawnT = 1;
  }

  private addFoe(def: FoeDef, boss: string | null, bossSprite: string | null): void {
    const a = this.rand() * Math.PI * 2;
    const d = 210 + this.rand() * 50;
    const tough = this.toughness;
    // a champion is worth a fight whatever wave it comes with
    const hp = boss ? Math.max(def.hp, 90) * tough * 38 : def.hp * tough;
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
      bossSprite,
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

  /** Where the Host is thickest, of a few places within reach. */
  private thickest(): { x: number; y: number } | null {
    let best: { x: number; y: number; n: number } | null = null;
    for (let i = 0; i < 6; i++) {
      const f = this.foes[Math.floor(this.rand() * this.foes.length)];
      if (!f || Math.hypot(f.x - this.x, f.y - this.y) > 220) continue;
      let n = 0;
      this.around(f.x, f.y, 40, () => n++);
      if (!best || n > best.n) best = { x: f.x, y: f.y, n };
    }
    return best;
  }

  /* -------------------------------------------------------------- spells */

  private ready(id: string, dt: number, every: number): boolean {
    const left = (this.cool[id] ?? 0) - dt;
    if (left > 0) {
      this.cool[id] = left;
      return false;
    }
    this.cool[id] = every;
    return true;
  }

  private castSpells(dt: number): void {
    for (const id of Object.keys(this.spells)) {
      const def = SPELLS[id];
      if (!def) continue;
      const s = this.stats(def);
      if (def.kind === 'orbit') this.castOrbit(def, s, dt);
      else if (def.kind === 'aura') this.castAura(s, dt);
      else if (def.kind === 'pet') this.syncPets(def, s.n);
      // the rest come round on a clock
      else if (this.ready(id, dt, s.every)) this.cast(def, s);
    }
  }

  private cast(def: SpellDef, s: SpellStats): void {
    switch (def.kind) {
      case 'bolt':
        return this.castBolt(def, s);
      case 'nova':
        return this.castNova(def, s);
      case 'chain':
        return this.castChain(def, s);
      case 'strike':
        return this.castStrike(def, s);
      case 'field':
        return this.castField(def, s);
      case 'cone':
        return this.castCone(def, s);
      case 'lance':
        return this.castLance(def, s);
      case 'rain':
        return this.castRain(def, s);
      case 'pulse':
        return this.castPulse(def, s);
      case 'boomerang':
        return this.castBoomerang(def, s);
    }
  }

  private castBolt(def: SpellDef, s: SpellStats): void {
    const taken = new Set<number>();
    for (let i = 0; i < s.n; i++) {
      const t = this.nearest(240, taken) ?? this.nearest(240);
      if (!t) return;
      taken.add(t.id);
      const ang = Math.atan2(t.y - this.y, t.x - this.x) + (i ? (this.rand() - 0.5) * 0.25 : 0);
      this.shots.push({ x: this.x, y: this.y - 6, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, r: 4 * this.area, dmg: s.dmg, life: 1.5, pierce: s.pierce, burst: s.burst, color: def.color, back: false, spin: 0, hit: new Set(), dead: false });
    }
  }

  private castNova(def: SpellDef, s: SpellStats): void {
    this.fx.push({ kind: 'ring', x: this.x, y: this.y, r: s.size, t: 0, dur: 0.42, color: def.color });
    if (s.heal) this.healBy(s.heal, def.color);
    this.around(this.x, this.y, s.size + 12, (f) => {
      if (Math.hypot(f.x - this.x, f.y - this.y) > s.size + f.r) return;
      this.hurt(f, s.dmg);
      if (def.slow) f.slow = 2.2;
      if (s.freeze && !f.boss) f.frozen = 1.6;
    });
  }

  private castChain(def: SpellDef, s: SpellStats): void {
    const seen = new Set<number>();
    const pts: [number, number][] = [[this.x, this.y - 8]];
    let from = { x: this.x, y: this.y };
    for (let i = 0; i < s.n; i++) {
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
      this.hurt(f, s.dmg);
      from = f;
    }
    if (pts.length > 1) this.fx.push({ kind: 'bolt', pts, t: 0, dur: 0.16, color: def.color });
  }

  /** Where each circling thing is now (the drawing asks too). */
  orbitPoints(): { x: number; y: number; color: string; spell: string }[] {
    const out: { x: number; y: number; color: string; spell: string }[] = [];
    let at = 0;
    for (const id of Object.keys(this.spells)) {
      const def = SPELLS[id];
      if (def?.kind !== 'orbit') continue;
      const { n } = this.stats(def);
      const R = (34 + at * 14) * this.area;
      for (let i = 0; i < n; i++) {
        const a = this.orbit + (i / n) * Math.PI * 2;
        out.push({ x: this.x + Math.cos(a) * R, y: this.y - 4 + Math.sin(a) * R * 0.8, color: def.color, spell: id });
      }
      at++;
    }
    return out;
  }

  private castOrbit(def: SpellDef, s: SpellStats, dt: number): void {
    this.orbit += dt * (2.2 + s.l * 0.25);
    const r = 7 * this.area;
    for (const p of this.orbitPoints()) {
      if (p.spell !== def.id) continue;
      this.around(p.x, p.y, r + 10, (f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < r + f.r) this.hurt(f, s.dmg * dt);
      });
    }
  }

  private castStrike(def: SpellDef, s: SpellStats): void {
    const at = this.thickest();
    if (!at) return;
    this.fx.push({ kind: 'star', x: at.x, y: at.y, r: s.size, t: 0, dur: 0.55, color: def.color });
    this.shake = Math.max(this.shake, 6);
    this.around(at.x, at.y, s.size + 12, (f) => {
      if (Math.hypot(f.x - at.x, f.y - at.y) < s.size + f.r) this.hurt(f, s.dmg);
    });
  }

  private castField(def: SpellDef, s: SpellStats): void {
    const max = 2.4 + s.l * 0.4;
    this.fields.push({ x: this.x, y: this.y, r: s.size, dps: s.dmg, life: max, max, color: def.color, slow: !!def.slow });
  }

  /** The way to swing: at the nearest foe, or the way the hero faces. */
  private aimAngle(range: number): number {
    const t = this.nearest(range);
    return t ? Math.atan2(t.y - this.y, t.x - this.x) : Math.atan2(this.dirY, this.dirX);
  }

  private castCone(def: SpellDef, s: SpellStats): void {
    const a = this.aimAngle(s.size * 1.5);
    // an evolved swing with `more` goes all the way round
    const arc = s.n > 1 ? Math.PI * 2 : 1.9;
    this.fx.push({ kind: 'cone', x: this.x, y: this.y - 4, a, r: s.size, arc, t: 0, dur: 0.2, color: def.color });
    this.around(this.x, this.y, s.size + 12, (f) => {
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d > s.size + f.r) return;
      let da = Math.atan2(f.y - this.y, f.x - this.x) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= arc / 2 || d < f.r + 6) this.hurt(f, s.dmg);
    });
  }

  private castLance(def: SpellDef, s: SpellStats): void {
    const a = this.aimAngle(220);
    const len = 230;
    this.fx.push({ kind: 'beam', x: this.x, y: this.y - 6, a, len, w: s.size, t: 0, dur: 0.22, color: def.color });
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    this.beamHit.clear();
    for (let d = 0; d < len; d += CELL) {
      this.around(this.x + cx * d, this.y + cy * d, CELL + s.size, (f) => {
        if (this.beamHit.has(f.id)) return;
        const px = f.x - this.x;
        const py = f.y - this.y;
        const along = px * cx + py * cy;
        const off = Math.abs(px * cy - py * cx);
        if (along > 0 && along < len && off < s.size + f.r) {
          this.beamHit.add(f.id);
          this.hurt(f, s.dmg);
        }
      });
    }
  }

  private castRain(def: SpellDef, s: SpellStats): void {
    for (let i = 0; i < s.n; i++) {
      const f = this.foes[Math.floor(this.rand() * this.foes.length)];
      const near = f && Math.hypot(f.x - this.x, f.y - this.y) < 200;
      const a = this.rand() * Math.PI * 2;
      const d = 30 + this.rand() * 110;
      const x = near ? f.x : this.x + Math.cos(a) * d;
      const y = near ? f.y : this.y + Math.sin(a) * d;
      this.fx.push({ kind: 'star', x, y, r: s.size, t: 0, dur: 0.34, color: def.color });
      this.around(x, y, s.size + 12, (o) => {
        if (Math.hypot(o.x - x, o.y - y) < s.size + o.r) {
          this.hurt(o, s.dmg);
          if (def.slow) o.slow = 1.6;
        }
      });
    }
  }

  private castAura(s: SpellStats, dt: number): void {
    this.around(this.x, this.y, s.size + 12, (f) => {
      if (Math.hypot(f.x - this.x, f.y - this.y) < s.size + f.r) this.hurt(f, s.dmg * dt);
    });
  }

  /** What burns around the hero all the time, for the drawing. */
  auras(): { r: number; color: string }[] {
    return Object.keys(this.spells).flatMap((id) => {
      const def = SPELLS[id];
      return def?.kind === 'aura' ? [{ r: this.stats(def).size, color: def.color }] : [];
    });
  }

  private healBy(share: number, color: string): void {
    if (this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * share);
    this.fx.push({ kind: 'heal', x: this.x, y: this.y, r: 24, t: 0, dur: 0.5, color });
  }

  private castPulse(def: SpellDef, s: SpellStats): void {
    this.healBy(s.heal, def.color);
    // an evolved mend also burns what is near
    if (s.evo) {
      const r = 70 * this.area;
      const dmg = (18 + s.l * 9) * this.power;
      this.fx.push({ kind: 'ring', x: this.x, y: this.y, r, t: 0, dur: 0.42, color: def.color });
      this.around(this.x, this.y, r + 12, (f) => {
        if (Math.hypot(f.x - this.x, f.y - this.y) < r + f.r) this.hurt(f, dmg);
      });
    }
  }

  private castBoomerang(def: SpellDef, s: SpellStats): void {
    const a0 = this.aimAngle(220);
    for (let i = 0; i < s.n; i++) {
      const a = a0 + (i / s.n) * Math.PI * 2;
      this.shots.push({ x: this.x, y: this.y - 6, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: s.size, dmg: s.dmg, life: 1.5, pierce: 99, burst: s.burst, color: def.color, back: true, spin: 0, hit: new Set(), dead: false });
    }
  }

  private syncPets(def: SpellDef, n: number): void {
    const have = this.pets.filter((p) => p.spell === def.id).length;
    for (let i = have; i < n; i++) this.pets.push({ spell: def.id, sprite: def.sprite ?? 'wolf', x: this.x + (i - n / 2) * 12, y: this.y + 10, face: 0, walk: 0 });
  }

  private movePets(dt: number): void {
    const many = Math.max(1, this.pets.length);
    this.pets.forEach((p, i) => {
      const def = SPELLS[p.spell];
      if (!def) return;
      // each goes for a different foe where it can
      let target: Foe | null = null;
      let best = 200 ** 2;
      for (const f of this.foes) {
        if (f.dead || f.id % many !== i % many) continue;
        const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
        if (d < best) {
          best = d;
          target = f;
        }
      }
      const tx = target ? (target as Foe).x : this.x + Math.cos(this.t + i * 2) * 26;
      const ty = target ? (target as Foe).y : this.y + Math.sin(this.t + i * 2) * 18;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 8) {
        p.x += (dx / d) * 130 * dt;
        p.y += (dy / d) * 130 * dt;
        p.walk += dt;
        p.face = Math.atan2(dy, dx);
      }
      const s = this.stats(def);
      this.around(p.x, p.y, 22, (f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < 11 + f.r) this.hurt(f, s.dmg * dt);
      });
    });
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      if (s.back) {
        // out, slowing, then home to the hero's hand
        s.spin += dt * 16;
        const dx = this.x - s.x;
        const dy = this.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.vx += (dx / d) * 300 * dt;
        s.vy += (dy / d) * 300 * dt;
        if (s.life < 1.1 && d < 14) s.dead = true;
      }
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
          this.fx.push({ kind: 'burst', x: f.x, y: f.y, r: s.burst, t: 0, dur: 0.22, color: s.color });
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
        if (Math.hypot(f.x - b.x, f.y - b.y) < b.r + f.r) {
          this.hurt(f, b.dps * dt);
          if (b.slow) f.slow = Math.max(f.slow, 0.5);
        }
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
    // a long night leaves a lot lying around: the oldest go to the hero rather than being lost
    if (this.sparks.length > 260) {
      for (const g of this.sparks.slice(0, this.sparks.length - 260)) {
        if (g.dead) continue;
        g.dead = true;
        this.gain(g.xp);
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
    for (const def of spellsOf(this.cls)) {
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
    if (evolve) {
      picks.push(evolve);
      pool.splice(pool.indexOf(evolve), 1);
    }
    // early on there is always a new spell to take: a run of nothing but strengths isn't a run
    if (Object.keys(this.spells).length < 3) {
      const fresh = pool.filter((c) => c.kind === 'spell' && c.level === 1);
      const c = fresh[Math.floor(this.rand() * fresh.length)];
      if (c) {
        picks.push(c);
        pool.splice(pool.indexOf(c), 1);
      }
    }
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(this.rand() * pool.length), 1)[0]!);
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

interface SpellStats {
  l: number;
  dmg: number;
  every: number;
  n: number;
  size: number;
  pierce: number;
  burst: number;
  freeze: boolean;
  heal: number;
  evo: boolean;
}
