import { dist, dist2, rng, TAU } from '../core/math';
import { BOSSES } from '../data/bosses';
import { CLASSES, xpToNext } from '../data/classes';
import { ELITE_AFFIXES, ENEMIES, enemyScale } from '../data/enemies';
import { ITEM_DEFS } from '../data/items';
import { REGIONS, RIFT_MODS, TIERS, type RiftMod } from '../data/regions';
import type { ClassId, EliteAffix, Encounter, Item, Objective, QuestDef, RegionDef, RegionId, SkillSpec, SlotKey } from '../data/types';
import { ACTION_SLOTS } from '../data/types';
import { buildHero, type HeroBuild } from '../progress/build';
import { addItem, addXp, BAG_OVERFLOW, BAG_SIZE, bagFull, MAX_POTIONS, questEvent, startQuests, type Character } from '../progress/character';
import { goldDrop, itemName, makeItem, rollLoot, salvageValue, type LootSource } from '../progress/items';
import type { Settings } from '../progress/save';
import { separate, updateEnemy } from './ai';
import { updateChannel, updateDash, updateFields, updateProjectiles, updateTraps, updateWindup, tryCast, type CastRequest } from './cast';
import { healPlayer, hurtPlayer, playerSlow, playerStunned, tickPlayerStatuses } from './combat';
import { breakWall, circleHitsWall, flowField, K, markerPos, moveCircle, parseRegion, pushOut, setDoors, TILE, tileAt, type TileMap } from './map';
import type { Chest, Drop, Enemy, Field, FloatText, Fx, Interactable, NpcActor, Player, Projectile, Telegraph, Trap, Wave, WorldEvent } from './types';
import { inCone, inLine } from '../core/math';

/** What the input adapters hand the world every frame. */
export interface InputFrame {
  /** Movement, length 0..1. */
  mx: number;
  my: number;
  /** Aim angle from the mouse (desktop) or null (touch: the hero faces where they move). */
  aim: number | null;
  /** World point under the mouse (desktop ground aiming). */
  aimX: number | null;
  aimY: number | null;
  casts: CastRequest[];
  /** Basic attack held down: keeps attacking as its cooldown allows. */
  holdBasic: CastRequest | null;
  potion: boolean;
  interact: boolean;
}

export const emptyInput = (): InputFrame => ({ mx: 0, my: 0, aim: null, aimX: null, aimY: null, casts: [], holdBasic: null, potion: false, interact: false });

export interface WorldOptions {
  region: RegionId;
  tier: number;
  mods: RiftMod[];
  hero: Character;
  settings: Settings;
  seed: number;
  /** The region the hero came from (arrive at the exit that leads back there). */
  from?: RegionId;
}

interface EncounterState {
  def: Encounter;
  index: number;
  state: 'idle' | 'active' | 'cleared';
  wave: number;
  waveT: number;
}

interface Spore {
  x: number;
  y: number;
  ripe: boolean;
  t: number;
  fuse: number;
  friendly: boolean;
}

const POTION_HEAL = 40;

export class World {
  region: RegionDef;
  map: TileMap;
  tier: number;
  mods: RiftMod[];
  level: number;
  hero: Character;
  settings: Settings;
  build: HeroBuild;
  player: Player;
  input: InputFrame = emptyInput();

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  fields: Field[] = [];
  telegraphs: Telegraph[] = [];
  waves: Wave[] = [];
  traps: Trap[] = [];
  drops: Drop[] = [];
  chests: Chest[] = [];
  npcs: NpcActor[] = [];
  spores: Spore[] = [];
  texts: FloatText[] = [];
  fx: Fx[] = [];
  encounters: EncounterState[] = [];
  delayed: { t: number; fn: () => void }[] = [];
  events: WorldEvent[] = [];
  procCd: Record<string, number> = {};
  flow: Int16Array;
  private flowTile = -1;
  private flowT = 0;

  time = 0;
  nextId = 1;
  rand: () => number;
  shakeAmt = 0;
  hitstopT = 0;
  checkpoint: { x: number; y: number };
  /** The final boss is down: the exit portal is open. */
  cleared = false;
  portal: { x: number; y: number } | null = null;
  /** The boss being fought (for the health bar). */
  bossId: number | null = null;
  interactable: Interactable | null = null;
  private exitInside = -1;
  /** The hero just stepped onto an exit: the engine offers to travel. */
  pendingExit: Interactable | null = null;
  waystones: { x: number; y: number }[] = [];
  exits: { x: number; y: number; to: RegionId; label: string }[] = [];
  shrines: { x: number; y: number; id: string }[] = [];
  props: { x: number; y: number; prop: string }[] = [];
  chickens: { x: number; y: number; vx: number; vy: number; t: number; face: number }[] = [];
  /** This run's tallies (for the report and the reward screen). */
  run = { xp: 0, gold: 0, kills: 0, bosses: 0, items: [] as Item[] };
  private bramble = 0;
  private hpBefore = 0;

  constructor(o: WorldOptions) {
    this.region = REGIONS[o.region];
    this.map = parseRegion(this.region);
    this.tier = this.region.safe ? 0 : o.tier;
    this.mods = this.region.safe ? [] : o.mods;
    this.level = this.region.level + TIERS[this.tier]!.levels;
    this.hero = o.hero;
    this.settings = o.settings;
    this.rand = rng(o.seed);
    this.build = buildHero(o.hero);
    this.flow = new Int16Array(this.map.w * this.map.h);
    this.encounters = this.region.encounters.map((def, index) => ({ def, index, state: 'idle', wave: 0, waveT: 0 }));
    const start = this.map.markers.find((m) => m.marker.kind === 'start');
    let spawn = start ? markerPos(start) : { x: this.map.w * 8, y: this.map.h * 8 };
    // arriving through an exit: appear just inside the exit that leads back where we came from
    if (o.from) {
      const back = this.map.markers.find((m) => m.marker.kind === 'exit' && m.marker.to === o.from);
      if (back) spawn = this.insideOf(markerPos(back));
    }
    this.checkpoint = { ...spawn };
    this.player = this.newPlayer(spawn.x, spawn.y);
    this.spawnContent();
  }

  /* ------------------------------------------------------------- setup */

  private newPlayer(x: number, y: number): Player {
    const cds = {} as Player['cds'];
    for (const slot of ACTION_SLOTS) cds[slot] = { t: 0, charges: 1, max: 1, cd: 1 };
    const p: Player = {
      x,
      y,
      vx: 0,
      vy: 0,
      r: 5,
      aim: 0,
      dir: 0,
      hp: this.build.maxHp,
      maxHp: this.build.maxHp,
      shield: 0,
      shieldT: 0,
      iframe: 0.5,
      dash: null,
      windup: null,
      channel: null,
      cds,
      ult: 0,
      combo: 0,
      comboT: 0,
      lastDodge: -99,
      lastHurt: -99,
      calm: 99,
      statuses: [],
      potionT: 0,
      healBudget: 0,
      healBudgetT: 0,
      dead: false,
      deadT: 0,
      walkT: 0,
      actT: 0,
      actAngle: 0,
      actKind: null,
      actBig: false,
      flash: 0,
    };
    this.player = p;
    this.syncCooldowns(true);
    return p;
  }

  /** A walkable spot a tile or so in from an exit tile. */
  private insideOf(pt: { x: number; y: number }): { x: number; y: number } {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const x = pt.x + dx * TILE * 1.5;
      const y = pt.y + dy * TILE * 1.5;
      const i = tileAt(this.map, x, y);
      if (i >= 0 && !this.map.solid[i] && this.map.kind[i] !== K.Water) return { x, y };
    }
    return pt;
  }

  private spawnContent(): void {
    let pack = 0;
    for (const pm of this.map.markers) {
      const m = pm.marker;
      const pos = markerPos(pm);
      switch (m.kind) {
        case 'npc':
          this.npcs.push({ id: m.npc, x: pos.x, y: pos.y, face: 0, bob: this.rand() * TAU });
          break;
        case 'chest': {
          const key = `${this.region.id}:${m.id}:${pm.tx}:${pm.ty}`;
          const done = m.once && this.hero.opened.includes(key);
          this.chests.push({ id: m.id, key, x: pos.x, y: pos.y, tier: m.tier, once: !!m.once, open: !!done, openT: done ? 1 : 0 });
          break;
        }
        case 'pack': {
          pack += 1;
          m.enemies.forEach((id, i) => {
            const a = (TAU * i) / m.enemies.length + this.rand();
            const r = m.enemies.length > 1 ? 10 + this.rand() * 10 : 0;
            const lvl = this.level + (this.rand() < 0.3 ? 1 : 0);
            this.addEnemy(id, pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r, lvl, { elite: !!m.elite && i === 0, room: -1, pack });
          });
          break;
        }
        case 'dummy': {
          const e = this.addEnemy('moss-slime', pos.x, pos.y, 1, { room: -1, pack: -1 });
          e.dummy = m.shooter ? 2 : 1;
          e.name = m.shooter ? 'Bolt Dummy' : 'Training Dummy';
          e.hp = e.maxHp = 9999;
          e.r = 6;
          e.atkCd = 1.5;
          break;
        }
        case 'waystone':
          this.waystones.push(pos);
          break;
        case 'exit':
          this.exits.push({ ...pos, to: m.to, label: m.label });
          break;
        case 'shrine':
          this.shrines.push({ ...pos, id: m.id });
          break;
        case 'prop':
          if (m.prop === 'chickens') for (let i = 0; i < 4; i++) this.chickens.push({ x: pos.x + (this.rand() - 0.5) * 30, y: pos.y + (this.rand() - 0.5) * 20, vx: 0, vy: 0, t: this.rand() * 2, face: 1 });
          else this.props.push({ ...pos, prop: m.prop });
          break;
        case 'hazard':
          if (m.hazard === 'spore') this.spores.push({ ...pos, ripe: true, t: 0, fuse: 0, friendly: false });
          break;
        default:
          break;
      }
    }
  }

  /** Creates an enemy (scaled to its level, the difficulty tier and rift modifiers). */
  addEnemy(id: string, x: number, y: number, level: number, o: { elite?: boolean; room: number; pack: number; spawn?: boolean }): Enemy {
    const def = ENEMIES[id] ?? ENEMIES['moss-slime']!;
    const sc = enemyScale(level);
    const tier = TIERS[this.tier]!;
    const elite: EliteAffix[] = [];
    if (o.elite) {
      const pool: EliteAffix[] = ['frenzied', 'molten', 'vampiric', 'shielded', ...(this.tier > 0 ? (['volatile'] as EliteAffix[]) : [])];
      const n = this.tier >= 2 ? 3 : this.tier >= 1 ? 2 : 1;
      while (elite.length < n) {
        const a = pool[Math.floor(this.rand() * pool.length)]!;
        if (!elite.includes(a)) elite.push(a);
      }
    }
    const hasted = this.mods.includes('hasted') ? 1.2 : 1;
    const hp = Math.round(def.hp * sc.hp * tier.hp * (this.mods.includes('fortified') ? 1.4 : 1) * (o.elite ? 3.2 : 1));
    const e: Enemy = {
      id: this.nextId++,
      def,
      level,
      x,
      y,
      vx: 0,
      vy: 0,
      r: def.radius * (def.scale ?? 1) * (o.elite ? 1.25 : 1),
      hp,
      maxHp: hp,
      dmg: def.dmg * sc.dmg * tier.dmg * (o.elite ? 1.35 : 1),
      speedMul: hasted * (elite.includes('frenzied') ? 1.35 : 1),
      atkMul: hasted * (elite.includes('frenzied') ? 1.4 : 1),
      shield: elite.includes('shielded') ? hp * 0.4 : 0,
      elite,
      boss: null,
      state: o.spawn ? 'spawn' : 'idle',
      t: o.spawn ? 0.7 : this.rand() * 2,
      atkCd: 0.5,
      aimA: 0,
      aimX: 0,
      aimY: 0,
      rushLeft: 0,
      rushHit: false,
      homeX: x,
      homeY: y,
      aggro: !!o.spawn,
      lostT: 0,
      pack: o.pack,
      room: o.room,
      statuses: [],
      flash: 0,
      face: this.rand() < 0.5 ? 0 : Math.PI,
      walkT: this.rand(),
      hopT: this.rand(),
      trailT: 0,
      dummy: 0,
      dead: false,
      deathT: 0,
      scale: (def.scale ?? 1) * (o.elite ? 1.3 : 1),
      strafe: this.rand() * 2,
      name: o.elite ? `${ELITE_AFFIXES[elite[0]!].name} ${def.name}` : def.name,
    };
    // big enemies (elites, guardians) must not start overlapping a wall or a pillar (training
    // dummies stand on their own post on purpose)
    const free = this.map.kind[tileAt(this.map, x, y)] === K.Prop ? null : pushOut(this.map, x, y, e.r, o.room);
    if (free) {
      e.x = e.homeX = free.x;
      e.y = e.homeY = free.y;
    }
    this.enemies.push(e);
    if (o.spawn) this.addFx({ kind: 'rift', x: e.x, y: e.y, life: 0.7, size: e.r + 4, color: '#ff3fd2' });
    return e;
  }

  private addBoss(id: string, x: number, y: number, room: number): Enemy {
    const def = BOSSES[id]!;
    const level = this.level + 1;
    const sc = enemyScale(level);
    const tier = TIERS[this.tier]!;
    const hp = Math.round(def.hp * sc.hp * tier.hp * (this.mods.includes('fortified') ? 1.4 : 1));
    const e = this.addEnemy('skeleton', x, y, level, { room, pack: -1 });
    e.def = { ...ENEMIES.skeleton!, id: def.id, name: def.name, sprite: def.sprite, radius: def.radius, mass: 99, resist: {}, armor: 0, xp: def.xp, gold: def.gold, scale: 1 };
    e.r = def.radius;
    e.hp = e.maxHp = hp;
    e.dmg = def.dmg * sc.dmg * tier.dmg;
    e.name = def.name;
    e.scale = 1;
    e.state = 'chase';
    e.aggro = true;
    const room0 = this.map.roomTiles[room] ?? [];
    let cx = x;
    let cy = y;
    if (room0.length) {
      cx = (room0.reduce((a, i) => a + (i % this.map.w), 0) / room0.length + 0.5) * TILE;
      cy = (room0.reduce((a, i) => a + Math.floor(i / this.map.w), 0) / room0.length + 0.5) * TILE;
    }
    e.boss = { def, phase: 0, rest: 1.4, pattern: null, cds: {}, queue: [], shift: 0, dazed: 0, dying: 0, cx, cy, collapse: 0, misc: {} };
    this.bossId = e.id;
    return e;
  }

  /** Adds summoned by a boss (they appear with a short rise). */
  spawnAdd(id: string, x: number, y: number, room: number): void {
    const free = this.freeSpot(x, y, 6);
    this.addEnemy(id, free.x, free.y, this.level, { room, pack: -1, spawn: true });
  }

  private freeSpot(x: number, y: number, r: number): { x: number; y: number } {
    for (let i = 0; i < 16; i++) {
      const a = this.rand() * TAU;
      const d = i * 4;
      const nx = x + Math.cos(a) * d;
      const ny = y + Math.sin(a) * d;
      const res = moveCircle(this.map, nx, ny, r, 0, 0);
      if (!this.map.solid[tileAt(this.map, res.x, res.y)] && !wallNear(this.map, nx, ny, r)) return { x: nx, y: ny };
    }
    return { x, y };
  }

  /* ------------------------------------------------------- shared helpers */

  emit(ev: WorldEvent): void {
    this.events.push(ev);
  }
  sfx(id: string, vol?: number): void {
    this.events.push({ t: 'sfx', id, vol });
  }
  shake(amount: number): void {
    if (this.settings.shake) this.shakeAmt = Math.min(8, Math.max(this.shakeAmt, amount));
  }
  hitstop(t: number): void {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  after(t: number, fn: () => void): void {
    this.delayed.push({ t, fn });
  }
  text(x: number, y: number, text: string, color: string, big: boolean): void {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, text, color, t: 0, big, vy: -26 });
  }
  addFx(f: Partial<Fx> & Pick<Fx, 'kind' | 'x' | 'y' | 'life'>): void {
    if (this.fx.length > 420) return;
    this.fx.push({ vx: 0, vy: 0, t: 0, size: 2, color: '#fff', a: 0, a2: 0, r2: 0, x2: 0, y2: 0, ...f });
  }
  fxBurst(x: number, y: number, color: string, n: number, radius = 12): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU;
      const s = (0.4 + this.rand() * 0.8) * radius * 3;
      this.addFx({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 0.25 + this.rand() * 0.3, size: 1 + Math.floor(this.rand() * 2), color });
    }
  }
  spawnProjectile(p: Partial<Projectile> & Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'r' | 'life' | 'dmg' | 'type' | 'spec' | 'depth' | 'pierce' | 'bounce' | 'hit' | 'look' | 'color' | 'child' | 'knock'>): void {
    if (this.projectiles.length > 260) return;
    this.projectiles.push({ id: this.nextId++, hostile: false, splitDone: false, trailT: 0, homing: 0, age: 0, wide: false, dead: false, ...p });
  }
  spawnField(f: Omit<Field, 'id' | 't' | 'tickT'>): void {
    if (this.fields.length > 80) this.fields.shift();
    this.fields.push({ ...f, id: this.nextId++, t: f.dur, tickT: f.hostile ? 0.25 : 0 });
  }
  addTelegraph(t: Omit<Telegraph, 'id' | 't' | 'dead'>): void {
    this.telegraphs.push({ ...t, id: this.nextId++, t: 0, dead: false });
  }
  spawnWave(x: number, y: number, speed: number, max: number, width: number, dmg: number): void {
    this.waves.push({ id: this.nextId++, x, y, r: 8, speed, max, width, dmg, hitPlayer: false, dead: false });
  }
  /** Clears enemy attacks in flight (phase changes, respawns). */
  clearHostile(): void {
    this.projectiles = this.projectiles.filter((p) => !p.hostile);
    this.telegraphs = this.telegraphs.filter((t) => t.tone === 'player');
    this.fields = this.fields.filter((f) => !f.hostile);
    this.waves = [];
  }
  enemyById(id: number): Enemy | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  /** The pack wakes up together. */
  alertPack(e: Enemy): void {
    e.aggro = true;
    if (e.pack < 0) return;
    for (const o of this.enemies) if (o.pack === e.pack && !o.dead && !o.aggro && dist(o.x, o.y, e.x, e.y) < 120) o.aggro = true;
  }

  /** Breaks cracked walls a hit touched. */
  breakWalls(x: number, y: number, r: number): void {
    const m = this.map;
    const x0 = Math.floor((x - r - 2) / TILE);
    const x1 = Math.floor((x + r + 2) / TILE);
    const y0 = Math.floor((y - r - 2) / TILE);
    const y1 = Math.floor((y + r + 2) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        const i = ty * m.w + tx;
        if (m.kind[i] !== K.Cracked) continue;
        breakWall(m, i);
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        for (let k = 0; k < 14; k++) this.addFx({ kind: 'rubble', x: cx, y: cy, vx: (this.rand() - 0.5) * 120, vy: (this.rand() - 0.8) * 120, life: 0.6, size: 2 + Math.floor(this.rand() * 2), color: '#6a6680' });
        this.sfx('crumble');
        this.shake(3);
        this.emit({ t: 'banner', text: 'A hidden passage!', sub: 'Something glints inside' });
      }
    }
  }

  resetCooldown(skill?: string): void {
    const p = this.player;
    const slots = (['s1', 's2', 's3'] as SlotKey[]).filter((s) => this.build.bar[s] && p.cds[s].charges < p.cds[s].max);
    const pick = skill ? slots.find((s) => this.build.bar[s] === skill) : slots[Math.floor(this.rand() * slots.length)];
    if (!pick) return;
    const cd = p.cds[pick];
    cd.charges = cd.max;
    cd.t = 0;
    this.addFx({ kind: 'glow', x: p.x, y: p.y, life: 0.4, size: 10, color: '#22e4ff' });
    this.sfx('reset');
  }

  reduceCooldowns(s: number): void {
    const p = this.player;
    for (const slot of ['s1', 's2', 's3', 'dodge'] as SlotKey[]) {
      const cd = p.cds[slot];
      if (cd.charges >= cd.max) continue;
      cd.t -= s;
      while (cd.t <= 0 && cd.charges < cd.max) {
        cd.charges += 1;
        cd.t += cd.charges < cd.max ? cd.cd : 0;
      }
      if (cd.charges >= cd.max) cd.t = 0;
    }
  }

  /** Re-reads the hero after gear, talents or skills changed (keeps health as a share). */
  rebuild(): void {
    const share = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
    this.build = buildHero(this.hero);
    this.player.maxHp = this.build.maxHp;
    this.player.hp = Math.max(1, Math.min(this.build.maxHp, Math.round(this.build.maxHp * share)));
    this.syncCooldowns(false);
  }

  private syncCooldowns(fresh: boolean): void {
    const p = this.player;
    for (const slot of ACTION_SLOTS) {
      const id = this.build.bar[slot];
      const spec = id ? this.build.skills[id]?.spec : undefined;
      const cd = p.cds[slot];
      const max = spec ? spec.charges : 1;
      cd.cd = spec ? spec.cooldown : 1;
      if (fresh || cd.max !== max) {
        cd.max = max;
        cd.charges = fresh ? max : Math.min(cd.charges, max);
        if (cd.charges >= max) cd.t = 0;
        else if (cd.t <= 0) cd.t = cd.cd;
      }
    }
  }

  /* ------------------------------------------------------------- step */

  step(rawDt: number): void {
    // hit-stop: a few frames nearly frozen on heavy hits
    let dt = rawDt;
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      dt = rawDt * 0.08;
    }
    if (this.player.dead) dt *= 0.35;
    this.time += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - rawDt * 18);
    this.updatePlayer(dt);
    this.updateFlow(dt);
    for (const e of this.enemies) updateEnemy(this, e, dt);
    separate(this, dt);
    updateProjectiles(this, dt);
    updateFields(this, dt);
    updateTraps(this, dt);
    this.updateTelegraphs(dt);
    this.updateWaves(dt);
    this.updateDrops(dt);
    this.updateChests(dt);
    this.updateEncounters(dt);
    this.updateHazards(dt);
    this.updateAmbient(dt);
    // delayed actions (meteors, echoes, rift bursts)
    if (this.delayed.length) {
      const due: (() => void)[] = [];
      for (const d of this.delayed) {
        d.t -= dt;
        if (d.t <= 0) due.push(d.fn);
      }
      this.delayed = this.delayed.filter((d) => d.t > 0);
      for (const fn of due) fn();
    }
    // corpses fade, effects age
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 0.6);
    for (const t of this.texts) {
      t.t += rawDt;
      t.y += t.vy * rawDt;
      t.vy *= Math.exp(-3 * rawDt);
    }
    this.texts = this.texts.filter((t) => t.t < (t.big ? 1.1 : 0.8));
    for (const f of this.fx) {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'spark' || f.kind === 'rubble' || f.kind === 'coin') f.vy += 220 * dt;
      if (f.kind === 'smoke' || f.kind === 'ember' || f.kind === 'leaf') {
        f.vx *= Math.exp(-2 * dt);
        if (f.kind !== 'ember' || !f.sprite) f.vy *= Math.exp(-2 * dt);
      }
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
    this.updateInteractable();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const inp = this.input;
    if (p.dead) {
      p.deadT += dt / 0.35;
      return;
    }
    const stats = this.build.stats;
    p.iframe = Math.max(0, p.iframe - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.potionT = Math.max(0, p.potionT - dt);
    p.actT = Math.max(0, p.actT - dt);
    if (p.actT <= 0) {
      p.actKind = null;
      p.actBig = false;
    }
    p.comboT = Math.max(0, p.comboT - dt);
    p.calm += dt;
    p.healBudgetT -= dt;
    if (p.healBudgetT <= 0) {
      p.healBudgetT = 1;
      p.healBudget = p.maxHp * 0.1;
    }
    if (p.shieldT > 0) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) p.shield = 0;
    }
    tickPlayerStatuses(this, dt);
    if (p.dead) return;
    // regeneration: always the stat, and quickly once out of combat
    const regen = stats.regen + (p.calm > 4 ? p.maxHp * (this.region.safe ? 0.25 : 0.02) : 0);
    if (regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    // cooldowns recharge faster with haste
    const haste = 1 + stats.haste / 100;
    for (const slot of ACTION_SLOTS) {
      const cd = p.cds[slot];
      if (slot === 'ult' || cd.charges >= cd.max) continue;
      cd.t -= dt * haste;
      if (cd.t <= 0) {
        cd.charges += 1;
        cd.t = cd.charges < cd.max ? cd.t + cd.cd : 0;
      }
    }
    // a slow trickle of ultimate charge while fighting
    if (p.calm < 3 && this.build.bar.ult) p.ult = Math.min(100, p.ult + dt * 0.8);
    // aim: the mouse, or where you move (touch)
    const moving = Math.hypot(inp.mx, inp.my) > 0.15;
    if (inp.aim !== null) p.aim = inp.aim;
    else if (moving && p.actT <= 0 && !p.windup) p.aim = Math.atan2(inp.my, inp.mx);
    // skills
    for (const req of inp.casts) {
      const r = this.withMouse(req);
      if (tryCast(this, r) && req.slot !== 'basic' && req.slot !== 'dodge') this.tutorialSkillCast();
    }
    if (inp.holdBasic && p.cds.basic.charges > 0) tryCast(this, this.withMouse(inp.holdBasic));
    updateWindup(this, dt);
    updateChannel(this, dt);
    if (inp.potion) this.drinkPotion();
    // movement: quick to start, quick to stop
    if (p.dash) {
      updateDash(this, dt);
    } else {
      const stunned = playerStunned(this);
      let speed = 78 * (1 + stats.speed / 100) * playerSlow(this);
      if (p.channel) speed *= 0.8;
      if (p.windup) speed *= 0.35;
      if (stunned) speed = 0;
      const tx = inp.mx * speed;
      const ty = inp.my * speed;
      const accel = moving ? 16 : 20;
      const k = 1 - Math.exp(-accel * dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
      // never left inside a wall (moveCircle can't move a circle that already overlaps one)
      if (circleHitsWall(this.map, p.x, p.y, p.r)) {
        const to = pushOut(this.map, p.x, p.y, p.r);
        if (to) {
          p.x = to.x;
          p.y = to.y;
        }
      }
      const res = moveCircle(this.map, p.x, p.y, p.r, p.vx * dt, p.vy * dt);
      if (res.bx) p.vx = 0;
      if (res.by) p.vy = 0;
      p.x = res.x;
      p.y = res.y;
      if (Math.hypot(p.vx, p.vy) > 8) p.walkT += dt * (Math.hypot(p.vx, p.vy) / 70);
    }
    // facing for the sprite
    const fa = p.actT > 0 || inp.aim !== null ? p.aim : moving ? Math.atan2(inp.my, inp.mx) : null;
    if (fa !== null) {
      const c = Math.cos(fa);
      const s = Math.sin(fa);
      p.dir = Math.abs(c) > Math.abs(s) * 1.1 ? (c < 0 ? 1 : 2) : s < 0 ? 3 : 0;
    }
    if (p.hp < p.maxHp * 0.3 && this.hpBefore >= p.maxHp * 0.3 && this.hero.potions > 0) this.emit({ t: 'hint', id: 'potion' });
    this.hpBefore = p.hp;
  }

  /** Desktop ground skills aim at the exact mouse distance. */
  private withMouse(req: CastRequest): CastRequest {
    if (req.angle === null || this.input.aimX === null || this.input.aimY === null || req.dist !== null) return req;
    const id = this.build.bar[req.slot];
    const spec = id ? this.build.skills[id]?.spec : undefined;
    if (!spec || spec.aim !== 'ground') return req;
    const d = dist(this.player.x, this.player.y, this.input.aimX, this.input.aimY);
    return { ...req, dist: Math.min(1, d / spec.range) };
  }

  drinkPotion(): void {
    const p = this.player;
    if (p.dead || p.potionT > 0 || this.hero.potions <= 0 || p.hp >= p.maxHp) return;
    this.hero.potions -= 1;
    p.potionT = 1;
    healPlayer(this, POTION_HEAL * (1 + this.build.stats.potion / 100), false);
    this.addFx({ kind: 'glow', x: p.x, y: p.y, life: 0.5, size: 12, color: '#ff5a7a' });
    this.sfx('potion');
    this.emit({ t: 'hero' });
  }

  private updateFlow(dt: number): void {
    this.flowT -= dt;
    const i = tileAt(this.map, this.player.x, this.player.y);
    if (i === this.flowTile && this.flowT > 0) return;
    this.flowTile = i;
    this.flowT = 0.4;
    flowField(this.map, i % this.map.w, Math.floor(i / this.map.w), 34, this.flow);
  }

  private updateTelegraphs(dt: number): void {
    const p = this.player;
    for (const t of this.telegraphs) {
      t.t += dt;
      // slams follow their owner until they land
      if (t.owner >= 0 && t.shape !== 'line' && t.shape !== 'cone') {
        const o = this.enemyById(t.owner);
        if (o && !o.dead && o.boss) {
          t.x = o.x;
          t.y = o.y;
        }
      }
      if (t.t < t.dur) continue;
      if (t.tone !== 'player' && t.dmg > 0 && !p.dead && (t.t - dt < t.dur || t.linger > 0) && !t.dead) {
        if (inside(t, p.x, p.y, p.r)) {
          if (hurtPlayer(this, t.dmg, { fromX: t.x, fromY: t.y, knock: t.knock, status: t.status, source: t.owner >= 0 ? this.enemyById(t.owner) : undefined })) t.dmg = 0;
        }
        if (t.t - dt < t.dur) {
          if (t.shape === 'circle' || t.shape === 'donut' || t.shape === 'ring') this.fxBurst(t.x, t.y, t.tone === 'rift' ? '#ff3fd2' : '#ff6a4d', 10, t.r * 0.6);
        }
      }
      if (t.t >= t.dur + t.linger) t.dead = true;
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.dead);
  }

  private updateWaves(dt: number): void {
    const p = this.player;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      if (w.r > w.max) w.dead = true;
      if (w.hitPlayer || p.dead) continue;
      const d = dist(p.x, p.y, w.x, w.y);
      if (Math.abs(d - w.r) < w.width / 2 + p.r * 0.6) {
        if (hurtPlayer(this, w.dmg, { fromX: w.x, fromY: w.y, knock: 120 })) w.hitPlayer = true;
        else if (p.iframe > 0) w.hitPlayer = true;
      }
    }
    this.waves = this.waves.filter((w) => !w.dead);
  }

  /* ----------------------------------------------------------- loot */

  private dropAt(kind: Drop['kind'], x: number, y: number, amount: number, item?: Item): void {
    const a = this.rand() * TAU;
    const s = 20 + this.rand() * 40;
    this.drops.push({ id: this.nextId++, kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, z: 0, vz: 70 + this.rand() * 40, amount, item, t: 0, dead: false });
  }

  dropGold(x: number, y: number, amount: number): void {
    const coins = Math.min(5, Math.max(1, Math.round(amount / 4)));
    let left = amount;
    for (let i = 0; i < coins; i++) {
      const v = i === coins - 1 ? left : Math.max(1, Math.round(amount / coins));
      left -= v;
      if (v > 0) this.dropAt('gold', x, y, v);
    }
  }

  dropItem(x: number, y: number, item: Item): void {
    this.dropAt('item', x, y, 1, item);
    if (item.r === 'legendary') this.sfx('legendary');
    else if (item.r === 'epic') this.sfx('epic');
  }

  private rollItem(source: LootSource, level: number): Item {
    return rollLoot(this.hero.cls as ClassId, level, source, this.tier, this.rand);
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    for (const d of this.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 260 * dt;
        d.z = Math.max(0, d.z + d.vz * dt);
        if (d.z === 0 && d.vz < 0) d.vz = Math.abs(d.vz) > 40 ? -d.vz * 0.35 : 0;
        const r = moveCircle(this.map, d.x, d.y, 2, d.vx * dt, d.vy * dt);
        d.x = r.x;
        d.y = r.y;
        d.vx *= Math.exp(-3 * dt);
        d.vy *= Math.exp(-3 * dt);
      }
      if (p.dead || d.t < 0.35) continue;
      const dd = dist(d.x, d.y, p.x, p.y);
      const magnet = d.kind === 'gold' || d.kind === 'orb' || d.kind === 'shard' ? 40 : 0;
      if (dd < magnet) {
        const a = Math.atan2(p.y - d.y, p.x - d.x);
        const sp = 160 * dt;
        d.x += Math.cos(a) * sp;
        d.y += Math.sin(a) * sp;
      }
      if (dd > (d.kind === 'item' ? 13 : 8)) continue;
      this.pickUp(d);
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  /**
   * The fight is won or the hero is leaving: everything still on the ground is theirs. Items go to
   * the bag even past its size (by up to BAG_OVERFLOW); anything beyond that is salvaged into gold,
   * so loot is never lost. Returns how many items and how much salvage gold it took.
   */
  collectAll(): { items: number; salvaged: number } {
    const h = this.hero;
    let items = 0;
    let salvaged = 0;
    for (const d of this.drops) {
      if (d.dead) continue;
      if (d.kind === 'gold' || d.kind === 'shard') this.pickUp(d);
      else if (d.kind === 'item') {
        const item = d.item!;
        d.dead = true;
        if (h.bag.some((i) => i.uid === item.uid)) continue;
        if (h.bag.length < BAG_SIZE + BAG_OVERFLOW) {
          h.bag.push(item);
          this.run.items.push(item);
          items += 1;
        } else {
          const g = salvageValue(item);
          h.gold += g;
          this.run.gold += g;
          salvaged += g;
        }
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    return { items, salvaged };
  }

  private pickUp(d: Drop): void {
    const h = this.hero;
    switch (d.kind) {
      case 'gold':
        h.gold += d.amount;
        this.run.gold += d.amount;
        this.sfx('coin', 0.6);
        d.dead = true;
        break;
      case 'orb':
        healPlayer(this, 20, false);
        this.sfx('orb');
        d.dead = true;
        break;
      case 'shard': {
        h.shards += 1;
        d.dead = true;
        this.sfx('shard');
        this.emit({ t: 'toast', text: `Rift Shard (${Math.min(3, h.shards)}/3)`, tone: 'loot' });
        this.questProgress((o) => o.kind === 'collect');
        this.emit({ t: 'save' });
        break;
      }
      case 'item': {
        const item = d.item!;
        if (bagFull(h)) {
          if (!d.nagged) {
            d.nagged = true;
            this.emit({ t: 'toast', text: 'Your bag is full. Salvage something to pick this up.', tone: 'warn' });
          }
          return;
        }
        addItem(h, item);
        this.run.items.push(item);
        d.dead = true;
        this.sfx(item.r === 'legendary' || item.r === 'epic' ? 'pickupBig' : 'pickup');
        this.emit({ t: 'loot', item });
        this.emit({ t: 'save' });
        break;
      }
    }
  }

  private updateChests(dt: number): void {
    const p = this.player;
    for (const c of this.chests) {
      if (c.open) {
        c.openT = Math.min(1, c.openT + dt * 3);
        continue;
      }
      if (p.dead || dist(p.x, p.y, c.x, c.y) > 16) continue;
      c.open = true;
      this.sfx('chest');
      this.fxBurst(c.x, c.y - 4, '#ffd36b', 16, 14);
      const source: LootSource = c.tier === 'epic' ? 'chest-epic' : c.tier === 'rare' ? 'chest-rare' : 'chest-common';
      const n = c.tier === 'common' ? 1 : 2;
      for (let i = 0; i < n; i++) this.dropItem(c.x, c.y, this.rollItem(source, this.level));
      this.dropGold(c.x, c.y, goldDrop([8, 14], this.level, this.rand));
      if (this.rand() < 0.5) this.dropAt('orb', c.x, c.y, 1);
      if (c.once) {
        this.hero.opened.push(c.key);
        this.emit({ t: 'save' });
      }
    }
  }

  /* --------------------------------------------------------- dying */

  /** An enemy just died (called by combat). */
  onKill(e: Enemy): void {
    const h = this.hero;
    this.fxBurst(e.x, e.y, e.elite.length ? '#ffd36b' : '#e8e0ff', e.elite.length ? 18 : 9, e.r);
    this.sfx(e.boss ? 'bossDie' : 'die', 0.6);
    if (e.boss) {
      e.dead = false;
      e.hp = 1;
      e.state = 'chase';
      e.boss.dying = 1.8;
      e.boss.pattern = null;
      this.clearHostile();
      this.shake(6);
      this.hitstop(0.25);
      // the other enemies in the room crumble with their master
      for (const o of this.enemies) if (!o.boss && !o.dead && o.room === e.room) o.hp = 0;
      for (const o of this.enemies) if (!o.boss && o.hp <= 0) o.dead = true;
      return;
    }
    h.stats.kills += 1;
    this.run.kills += 1;
    const tier = TIERS[this.tier]!;
    const bonus = 1 + this.mods.reduce((a, m) => a + RIFT_MODS[m].bonus, 0);
    const xp = e.def.xp * enemyScale(e.level).xp * tier.xp * (e.elite.length ? 4 : 1) * bonus;
    this.giveXp(xp);
    const gold = goldDrop(e.def.gold, e.level, this.rand) * (e.elite.length ? 3 : 1);
    if (gold > 0) this.dropGold(e.x, e.y, gold);
    const chance = (e.elite.length ? 1 : 0.075) * tier.loot * bonus;
    if (this.rand() < chance) this.dropItem(e.x, e.y, this.rollItem(e.elite.length ? 'elite' : 'enemy', e.level));
    if (this.rand() < (e.elite.length ? 0.4 : 0.07)) this.dropAt('orb', e.x, e.y, 1);
    if (e.elite.length && h.quests['rift-shards']?.state === 'active' && h.shards < 3) this.dropAt('shard', e.x, e.y, 1);
    if (e.elite.includes('volatile') || this.mods.includes('volatile')) {
      const r = e.elite.includes('volatile') ? 34 : 24;
      this.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg * (e.elite.length ? 1.6 : 0.9), knock: 120, tone: 'enemy', owner: -1, linger: 0 });
    }
    this.questProgress((o) => o.kind === 'kill' && o.region === this.region.id);
  }

  giveXp(n: number): void {
    const before = this.hero.level;
    const levels = addXp(this.hero, n);
    this.run.xp += Math.round(n);
    if (!levels.length) return;
    this.rebuild();
    this.player.hp = this.player.maxHp;
    this.addFx({ kind: 'beam', x: this.player.x, y: this.player.y, life: 0.9, size: 10, color: '#ffe066' });
    this.fxBurst(this.player.x, this.player.y, '#ffe066', 24, 20);
    this.sfx('levelup');
    for (const l of levels) this.emit({ t: 'levelup', level: l });
    if (before < 2 && this.hero.level >= 2) this.emit({ t: 'hint', id: 'talent' });
    this.emit({ t: 'save' });
  }

  /** The boss's death animation finished: rewards and the way out. */
  bossFinished(e: Enemy): void {
    const def = e.boss!.def;
    const h = this.hero;
    e.dead = true;
    e.deathT = 0;
    this.bossId = null;
    this.run.bosses += 1;
    const first = !h.bosses[def.id];
    h.bosses[def.id] = (h.bosses[def.id] ?? 0) + 1;
    this.fxBurst(e.x, e.y, '#ffe066', 40, 40);
    this.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 80, color: '#ffffff' });
    this.shake(7);
    this.sfx('victory');
    const tier = TIERS[this.tier]!;
    this.giveXp(def.xp * enemyScale(e.level).xp * tier.xp);
    this.dropGold(e.x, e.y, Math.round((def.gold[0] + this.rand() * (def.gold[1] - def.gold[0])) * (1 + 0.2 * (e.level - 1))));
    const cls = h.cls as ClassId;
    const il = e.level;
    if (first) {
      for (const id of [...(def.first[cls] ?? []), ...(def.first.any ?? [])]) {
        const it = makeItem(id, il, this.rand);
        if (it) this.dropItem(e.x, e.y, it);
      }
    }
    const pool = [...(def.drops.items[cls] ?? []), ...(def.drops.items.any ?? [])];
    if (pool.length && this.rand() < (def.drops.chance[this.tier] ?? 0.3)) {
      const it = makeItem(pool[Math.floor(this.rand() * pool.length)]!, il, this.rand);
      if (it) this.dropItem(e.x, e.y, it);
    }
    for (let i = 0; i < 2 + this.tier; i++) this.dropItem(e.x, e.y, this.rollItem('boss', il));
    for (let i = 0; i < 3; i++) this.dropAt('orb', e.x, e.y, 1);
    this.emit({ t: 'bossDown', boss: def.id });
    this.questProgress((o) => o.kind === 'boss' && o.boss === def.id);
    // the room opens
    const enc = this.encounters[e.room];
    if (enc) this.clearEncounter(enc);
    // the final boss of a region: the rift closes, a portal home opens
    if (def.id === 'morgrave') {
      this.cleared = true;
      this.portal = { x: e.x, y: e.y };
      const key = `${this.region.id}:${this.tier}`;
      h.clears[key] = (h.clears[key] ?? 0) + 1;
      this.questProgress((o) => o.kind === 'clear' && o.region === this.region.id && o.tier <= this.tier);
      this.emit({ t: 'cleared' });
    }
    this.emit({ t: 'save' });
  }

  playerDies(): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deadT = 0;
    p.hp = 0;
    p.dash = null;
    p.channel = null;
    p.windup = null;
    this.hero.stats.deaths += 1;
    this.sfx('playerDie');
    this.shake(5);
    this.emit({ t: 'death' });
  }

  /** Back at the last checkpoint: the room you died in resets, potions refill. */
  respawn(): void {
    for (const enc of this.encounters) {
      if (enc.state !== 'active') continue;
      enc.state = 'idle';
      enc.wave = 0;
      setDoors(this.map, enc.index, false);
      this.enemies = this.enemies.filter((e) => e.room !== enc.index);
      if (this.bossId !== null && !this.enemies.some((e) => e.id === this.bossId)) this.bossId = null;
    }
    this.clearHostile();
    this.traps = [];
    for (const e of this.enemies) {
      if (e.aggro && e.room < 0 && !e.dummy) {
        e.state = 'return';
        e.statuses = [];
      }
    }
    const p = this.newPlayer(this.checkpoint.x, this.checkpoint.y);
    p.ult = 0;
    p.iframe = 1.5;
    this.hero.potions = MAX_POTIONS;
    this.emit({ t: 'hero' });
  }

  /* ----------------------------------------------------------- rooms */

  private updateEncounters(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    const here = this.map.room[tileAt(this.map, p.x, p.y)] ?? 0;
    for (const enc of this.encounters) {
      if (enc.state === 'idle' && here === enc.index + 1) this.startEncounter(enc);
      if (enc.state !== 'active') continue;
      if (enc.def.boss) continue;
      const alive = this.enemies.some((e) => e.room === enc.index && !e.dead);
      if (alive) continue;
      enc.waveT -= dt;
      if (enc.waveT > 0) continue;
      if (enc.wave < enc.def.waves.length) this.spawnRoomWave(enc);
      else this.clearEncounter(enc);
    }
  }

  private startEncounter(enc: EncounterState): void {
    enc.state = 'active';
    enc.wave = 0;
    enc.waveT = 0.6;
    setDoors(this.map, enc.index, true);
    // the doors may close on someone standing in the doorway: nudge them into the room
    for (const a of [this.player, ...this.enemies]) {
      if (!circleHitsWall(this.map, a.x, a.y, a.r)) continue;
      const to = pushOut(this.map, a.x, a.y, a.r, enc.index);
      if (to) {
        a.x = to.x;
        a.y = to.y;
      }
    }
    this.sfx('doorSlam');
    this.shake(2);
    if (enc.def.boss) {
      const m = this.map.markers.find((pm) => pm.marker.kind === 'boss' && pm.marker.boss === enc.def.boss);
      const pos = m ? markerPos(m) : { x: this.player.x, y: this.player.y - 60 };
      const boss = this.addBoss(enc.def.boss, pos.x, pos.y, enc.index);
      this.addFx({ kind: 'rift', x: boss.x, y: boss.y, life: 1, size: 18, color: '#ff3fd2' });
      this.emit({ t: 'bossStart', boss: enc.def.boss });
    } else if (enc.def.title) this.emit({ t: 'banner', text: enc.def.title, sub: `${enc.def.waves.length} waves` });
  }

  private spawnRoomWave(enc: EncounterState): void {
    const wave = enc.def.waves[enc.wave]!;
    enc.wave += 1;
    enc.waveT = 0.9;
    const tiles = this.map.roomTiles[enc.index] ?? [];
    const p = this.player;
    const spots = tiles.filter((i) => {
      const x = ((i % this.map.w) + 0.5) * TILE;
      const y = (Math.floor(i / this.map.w) + 0.5) * TILE;
      return !this.map.solid[i] && dist(x, y, p.x, p.y) > 70 && !wallNear(this.map, x, y, 7);
    });
    const used: { x: number; y: number }[] = [];
    wave.enemies.forEach((id, k) => {
      let pos = { x: p.x, y: p.y - 80 };
      for (let tries = 0; tries < 20 && spots.length; tries++) {
        const i = spots[Math.floor(this.rand() * spots.length)]!;
        const c = { x: ((i % this.map.w) + 0.5) * TILE, y: (Math.floor(i / this.map.w) + 0.5) * TILE };
        if (used.every((u) => dist2(u.x, u.y, c.x, c.y) > 26 * 26)) {
          pos = c;
          break;
        }
      }
      used.push(pos);
      this.addEnemy(id, pos.x, pos.y, this.level + (this.rand() < 0.3 ? 1 : 0), { elite: !!wave.elite && k === 0, room: enc.index, pack: -1, spawn: true });
    });
    this.sfx('summon', 0.5);
    if (enc.wave > 1) this.emit({ t: 'banner', text: `Wave ${enc.wave} of ${enc.def.waves.length}` });
  }

  private clearEncounter(enc: EncounterState): void {
    if (enc.state === 'cleared') return;
    enc.state = 'cleared';
    setDoors(this.map, enc.index, false);
    this.sfx('doorOpen');
    if (!enc.def.boss) this.emit({ t: 'banner', text: 'Room cleared', sub: enc.def.title });
    if (enc.def.checkpoint) {
      const tiles = this.map.roomTiles[enc.index] ?? [];
      const p = this.player;
      // the nearest free tile to the hero inside this room
      let best = { x: p.x, y: p.y };
      let bd = Infinity;
      for (const i of tiles) {
        if (this.map.solid[i]) continue;
        const x = ((i % this.map.w) + 0.5) * TILE;
        const y = (Math.floor(i / this.map.w) + 0.5) * TILE;
        const d = dist2(x, y, p.x, p.y);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
      this.checkpoint = best;
      this.hero.potions = MAX_POTIONS;
      this.emit({ t: 'checkpoint' });
      this.emit({ t: 'hero' });
    }
  }

  /** Encounter state for the UI: the active room's title and how many waves are left. */
  activeEncounter(): { title: string; wave: number; waves: number } | null {
    const e = this.encounters.find((x) => x.state === 'active' && !x.def.boss);
    return e ? { title: e.def.title ?? 'Fight!', wave: e.wave, waves: e.def.waves.length } : null;
  }

  /* --------------------------------------------------- hazards, ambience */

  private updateHazards(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    // brambles bite and slow
    const i = tileAt(this.map, p.x, p.y);
    if (i >= 0 && this.map.kind[i] === K.Bramble && !p.dash) {
      this.bramble -= dt;
      if (this.bramble <= 0) {
        this.bramble = 0.6;
        hurtPlayer(this, Math.max(2, p.maxHp * 0.035), {});
        const cur = p.statuses.find((s) => s.id === 'chill');
        if (cur) cur.t = Math.max(cur.t, 0.7);
        else p.statuses.push({ id: 'chill', t: 0.7, power: 0.35, tick: 0 });
      }
    } else this.bramble = 0;
    // spore puffs: step near and they burst; hit them first and the cloud is yours
    for (const s of this.spores) {
      if (!s.ripe) {
        s.t -= dt;
        if (s.t <= 0) s.ripe = true;
        continue;
      }
      if (s.fuse > 0) {
        s.fuse -= dt;
        if (s.fuse <= 0) this.burstSpore(s);
        continue;
      }
      if (dist(p.x, p.y, s.x, s.y) < 18) {
        s.fuse = 0.45;
        s.friendly = false;
        this.addTelegraph({ shape: 'circle', x: s.x, y: s.y, r: 26, r2: 0, angle: 0, len: 0, dur: 0.45, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        this.sfx('puff', 0.5);
        continue;
      }
      for (const pr of this.projectiles) {
        if (pr.hostile || pr.dead || dist2(pr.x, pr.y, s.x, s.y) > 64) continue;
        pr.dead = true;
        s.friendly = true;
        this.burstSpore(s);
        break;
      }
    }
    // shrines: discovered by walking up to them
    for (const s of this.shrines) {
      const key = `found:${s.id}`;
      if (this.hero.opened.includes(key) || dist(p.x, p.y, s.x, s.y) > 34) continue;
      this.hero.opened.push(key);
      this.fxBurst(s.x, s.y, '#9cffd0', 30, 30);
      this.sfx('discover');
      this.emit({ t: 'banner', text: 'The Hidden Grove', sub: 'You found a secret place' });
      this.emit({ t: 'discover', spot: s.id });
      this.questProgress((o) => o.kind === 'explore' && o.spot === s.id);
      this.emit({ t: 'save' });
    }
    // waystones: checkpoints that refill potions
    for (const ws of this.waystones) {
      if (dist(p.x, p.y, ws.x, ws.y) > 30) continue;
      if (dist(this.checkpoint.x, this.checkpoint.y, ws.x, ws.y) > 34 || this.hero.potions < MAX_POTIONS) {
        const firstTouch = dist(this.checkpoint.x, this.checkpoint.y, ws.x, ws.y) > 34;
        this.checkpoint = { x: ws.x, y: ws.y + 18 };
        if (this.hero.potions < MAX_POTIONS) {
          this.hero.potions = MAX_POTIONS;
          this.emit({ t: 'toast', text: 'Potions refilled at the waystone', tone: 'good' });
          this.emit({ t: 'hero' });
        } else if (firstTouch && !this.region.safe) this.emit({ t: 'toast', text: 'Waystone attuned: you will return here if you fall', tone: 'info' });
      }
    }
  }

  private burstSpore(s: Spore): void {
    s.ripe = false;
    s.t = 8;
    s.fuse = 0;
    this.fxBurst(s.x, s.y, '#b6e36b', 18, 20);
    this.sfx('puff');
    this.spawnField({ x: s.x, y: s.y, r: 26, dur: 3, tick: 0.5, dmg: s.friendly ? CLASSES[this.hero.cls].refDamage * 0.6 : this.level * 2 + 3, type: 'poison', status: s.friendly ? { status: 'poison', dur: 3, power: 0.3 } : { status: 'poison', dur: 2, power: this.level + 2 }, look: 'poison', hostile: !s.friendly, depth: 1, spec: null, onHit: false });
  }

  private updateAmbient(dt: number): void {
    for (const c of this.chickens) {
      c.t -= dt;
      if (c.t <= 0) {
        c.t = 1 + this.rand() * 3;
        const a = this.rand() * TAU;
        const s = this.rand() < 0.4 ? 0 : 18;
        c.vx = Math.cos(a) * s;
        c.vy = Math.sin(a) * s;
        if (c.vx) c.face = c.vx < 0 ? -1 : 1;
      }
      // they don't like heroes
      const p = this.player;
      if (dist(c.x, c.y, p.x, p.y) < 22) {
        const a = Math.atan2(c.y - p.y, c.x - p.x);
        c.vx = Math.cos(a) * 60;
        c.vy = Math.sin(a) * 60;
        c.face = c.vx < 0 ? -1 : 1;
        c.t = 0.6;
      }
      const r = moveCircle(this.map, c.x, c.y, 3, c.vx * dt, c.vy * dt);
      c.x = r.x;
      c.y = r.y;
    }
    for (const n of this.npcs) {
      n.bob += dt;
      const p = this.player;
      if (dist(n.x, n.y, p.x, p.y) < 60) n.face = p.x < n.x ? -1 : 1;
    }
    // the forest drops leaves, the crypt drifts dust
    if (this.region.theme === 'forest' && this.rand() < dt * 2.2) {
      const p = this.player;
      this.addFx({ kind: 'leaf', x: p.x + (this.rand() - 0.5) * 360, y: p.y - 130, vx: 12 + this.rand() * 10, vy: 18 + this.rand() * 10, life: 6, size: 1, color: this.rand() < 0.5 ? '#7cc45a' : '#d8b44a', a: this.rand() * TAU });
    }
  }

  /* --------------------------------------------------- interactions */

  private updateInteractable(): void {
    const p = this.player;
    let best: Interactable | null = null;
    let bd = 26;
    for (const n of this.npcs) {
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < bd) {
        bd = d;
        best = { kind: 'npc', id: n.id, x: n.x, y: n.y, label: 'Talk' };
      }
    }
    for (const w of this.waystones) {
      const d = dist(p.x, p.y, w.x, w.y);
      if (d < bd + 6) {
        bd = d;
        best = { kind: 'waystone', x: w.x, y: w.y, label: 'Travel' };
      }
    }
    let onExit = -1;
    this.exits.forEach((x, i) => {
      const d = dist(p.x, p.y, x.x, x.y);
      if (d < 20) {
        onExit = i;
        best = { kind: 'exit', to: x.to, x: x.x, y: x.y, label: x.label, locked: this.hero.unlocked.includes(x.to) ? null : x.to === 'crypt' ? 'Sealed. Defeat Grimtusk for the key.' : 'Not open yet.' };
      }
    });
    // the portal after the final boss
    if (this.portal && dist(p.x, p.y, this.portal.x, this.portal.y) < 22) best = { kind: 'exit', to: 'emberwick', x: this.portal.x, y: this.portal.y, label: 'Portal to Emberwick', locked: null };
    this.interactable = p.dead ? null : best;
    // walking onto an exit offers to travel once; stepping off and back on offers again
    if (onExit !== this.exitInside) {
      this.exitInside = onExit;
      if (onExit >= 0 && this.interactable) this.pendingExit = this.interactable;
    }
  }

  /* ----------------------------------------------------- quests */

  questProgress(match: (o: Objective) => boolean, amount = 1): void {
    const done = questEvent(this.hero, match, amount);
    this.emit({ t: 'quest' });
    if (done.length) this.completeQuests(done);
  }

  completeQuests(list: QuestDef[]): void {
    const h = this.hero;
    for (const q of list) {
      const r = q.reward;
      this.emit({ t: 'questDone', quest: q.id });
      h.gold += r.gold;
      this.run.gold += r.gold;
      if (r.unlock && !h.unlocked.includes(r.unlock)) h.unlocked.push(r.unlock);
      if (r.tier !== undefined) h.tier = Math.max(h.tier, r.tier);
      if (r.item) {
        let item: Item | null;
        if (r.item === 'class-epic') item = makeItem(h.cls === 'mage' ? 'ember-staff' : h.cls === 'warrior' ? 'cleaverfang' : 'splitwood-bow', Math.max(3, h.level), this.rand);
        else if (typeof r.item === 'string') item = makeItem(r.item, Math.max(ITEM_DEFS[r.item]?.minLevel ?? 1, h.level), this.rand);
        else item = rollLoot(h.cls as ClassId, Math.max(1, h.level), r.item.rarity === 'rare' ? 'chest-rare' : 'quest', 0, this.rand);
        if (item) {
          // quest rewards go straight to the bag (or fall at your feet if it's full)
          if (addItem(h, item)) {
            this.run.items.push(item);
            this.emit({ t: 'loot', item });
            if (h.bag.length === 1 && Object.keys(h.equip).length === 0) this.emit({ t: 'hint', id: 'equip' });
          } else this.dropItem(this.player.x, this.player.y, item);
        }
      }
      this.giveXp(r.xp);
      if (q.id === 'rift-shards') h.shards = Math.max(0, h.shards - 3);
    }
    for (const q of startQuests(h)) this.emit({ t: 'questStart', quest: q.id });
    this.emit({ t: 'save' });
  }

  /* -------------------------------------------------- tutorial hooks */

  dummyHit(spec: SkillSpec | null): void {
    if (!spec) return;
    if (spec.tags.includes('basic')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'attack');
    else if (!spec.tags.includes('dodge')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'skill');
  }

  private tutorialSkillCast(): void {
    // skills that don't hit (blink, a trap) still count when used near a dummy
    const near = this.enemies.some((e) => e.dummy && dist(e.x, e.y, this.player.x, this.player.y) < 120);
    if (near && this.hero.quests['first-spell']?.state === 'active') {
      const id = this.input.casts.find((c) => c.slot !== 'basic' && c.slot !== 'dodge')?.slot;
      const spec = id ? this.build.skills[this.build.bar[id] ?? '']?.spec : undefined;
      if (spec && (spec.cast === 'blink' || spec.cast === 'trap' || spec.cast === 'channel')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'skill');
    }
  }

  dodgedSomething(): void {
    this.text(this.player.x, this.player.y - 20, 'DODGED', '#9cf0ff', false);
    this.questProgress((o) => o.kind === 'tutorial' && o.step === 'dodge');
  }

  /** How full the experience bar is. */
  xpShare(): number {
    return this.hero.level >= 20 ? 1 : this.hero.xp / xpToNext(this.hero.level);
  }

  /** The current boss (for the health bar). */
  boss(): Enemy | null {
    return this.bossId === null ? null : (this.enemyById(this.bossId) ?? null);
  }

  /** Item name helper for events. */
  itemLabel(item: Item): string {
    return itemName(item);
  }
}

function wallNear(m: TileMap, x: number, y: number, r: number): boolean {
  for (const [dx, dy] of [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ] as const) {
    const i = tileAt(m, x + dx, y + dy);
    if (i < 0 || m.solid[i]) return true;
  }
  return false;
}

/** Whether a point (with radius) is inside a telegraph's shape. */
export function inside(t: Telegraph, x: number, y: number, r: number): boolean {
  const d = dist(x, y, t.x, t.y);
  switch (t.shape) {
    case 'circle':
      return d <= t.r + r * 0.5;
    case 'ring':
    case 'donut':
      return d >= t.r2 - r * 0.3 && d <= t.r + r * 0.5;
    case 'line':
      return inLine(x, y, r * 0.5, t.x, t.y, t.angle, t.len, t.r2);
    case 'cone':
      return inCone(x, y, t.x, t.y, t.angle, t.r2, t.r + r * 0.5);
  }
}
