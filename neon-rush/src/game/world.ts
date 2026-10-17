import { Rng } from '../core/rng';
import { clamp, easeInOutQuad } from '../core/math';
import {
  APPROACH_FACTOR,
  COIN_RADIUS,
  HAZARD_SIZES,
  LANES,
  LANE_WIDTH,
  MAGNET_RADIUS,
  PICKUP_RADIUS,
  PLAYER,
  POWERUPS,
  SCORE,
  UNITS_PER_METER,
  difficultyAt,
  laneCenter,
  type HazardKind,
  type PowerUpKind,
} from './config';

/**
 * Pure gameplay simulation. Knows nothing about rendering, DOM or audio.
 * Coordinates: x = 0 is the road center, y grows downward, y = 0 is the top of the view.
 * All hazards and pickups move in one shared "traffic frame", so hazard rows never drift into each other,
 * which lets the spawner guarantee that every run is always passable.
 */

export interface Hazard {
  active: boolean;
  kind: HazardKind;
  lane: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hitW: number;
  hitH: number;
  variant: number;
  /** True while the player was on a collision course and close: a later clean pass is a near miss. */
  danger: boolean;
  passed: boolean;
  row: Row | null;
  /** Lane change state for "lane changer" traffic. */
  changeTo: number;
  changeT: number;
  /** Seconds of blinker before the change starts. */
  telegraph: number;
  phase: number;
}

export interface Coin {
  active: boolean;
  x: number;
  y: number;
  phase: number;
  magnetized: boolean;
}

export interface PowerUp {
  active: boolean;
  kind: PowerUpKind;
  x: number;
  y: number;
  phase: number;
}

export interface Row {
  top: number;
  len: number;
  /** Bitmask of blocked lanes. */
  mask: number;
  /** Bitmask of free lanes the player can actually reach given every previous row. Never empty. */
  reach: number;
  /** How many lanes the player can shift while approaching this row from the previous one. */
  shift: number;
  alive: boolean;
}

export type WorldEventType =
  | 'coin'
  | 'nearMiss'
  | 'crash'
  | 'shieldHit'
  | 'powerup'
  | 'laneChange'
  | 'blinker';

export interface WorldEvent {
  type: WorldEventType;
  x: number;
  y: number;
  value: number;
  kind?: PowerUpKind;
}

export interface RunStats {
  meters: number;
  coins: number;
  score: number;
  nearMisses: number;
  bestCombo: number;
  powerups: number;
  shieldSaves: number;
  laneChanges: number;
  time: number;
}

export interface WorldOptions {
  seed: number;
  viewHeight: number;
}

const ALL_LANES_MASK = (1 << LANES) - 1;

export class World {
  readonly rng: Rng;
  readonly hazards: Hazard[] = [];
  readonly coins: Coin[] = [];
  readonly powerups: PowerUp[] = [];
  readonly rows: Row[] = [];
  readonly events: WorldEvent[] = [];

  viewHeight: number;
  /** Player state. */
  player = {
    lane: 1,
    fromLane: 1,
    x: laneCenter(1),
    y: 0,
    changeT: 1,
    tilt: 0,
    invuln: 0,
  };
  readonly active: Record<PowerUpKind, number> = { magnet: 0, shield: 0, double: 0 };

  speed = 0;
  distanceUnits = 0;
  bonusScore = 0;
  combo = 0;
  private comboTimer = 0;
  crashed = false;
  readonly stats: RunStats = {
    meters: 0,
    coins: 0,
    score: 0,
    nearMisses: 0,
    bestCombo: 0,
    powerups: 0,
    shieldSaves: 0,
    laneChanges: 0,
    time: 0,
  };

  private lastRow: Row | null = null;
  private nextRowTop = 0;
  private powerupTimer: number;
  private queuedSteer = 0;

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.viewHeight = opts.viewHeight;
    this.player.y = this.playerY();
    this.speed = difficultyAt(0).speed;
    // Grace period: the first row appears a moment after the start.
    this.nextRowTop = -260 - this.speed * APPROACH_FACTOR * 1.2;
    this.powerupTimer = 14;
  }

  playerY(): number {
    return this.viewHeight - PLAYER.bottomOffset;
  }

  setViewHeight(h: number): void {
    const dy = h - this.viewHeight;
    this.viewHeight = h;
    this.player.y = this.playerY();
    // Keep entities at the same distance from the player so a resize never causes an unfair hit.
    for (const hz of this.hazards) if (hz.active) hz.y += dy;
    for (const c of this.coins) if (c.active) c.y += dy;
    for (const p of this.powerups) if (p.active) p.y += dy;
    for (const r of this.rows) r.top += dy;
    this.nextRowTop += dy;
  }

  get meters(): number {
    return this.distanceUnits / UNITS_PER_METER;
  }

  get score(): number {
    return Math.floor(this.meters) * SCORE.perMeter + this.stats.coins * SCORE.perCoin + this.bonusScore;
  }

  /** Request a lane change. Chained taps while changing are queued, so quick double taps feel right. */
  steer(dir: -1 | 1): void {
    if (this.crashed) return;
    const p = this.player;
    if (p.changeT < 0.6) {
      this.queuedSteer = dir;
      return;
    }
    this.startLaneChange(dir);
  }

  private startLaneChange(dir: -1 | 1): void {
    const p = this.player;
    const target = clamp(p.lane + dir, 0, LANES - 1);
    if (target === p.lane) return;
    p.fromLane = p.lane;
    // If we are still mid-change, start from the current visual position.
    p.lane = target;
    p.changeT = 0;
    this.stats.laneChanges++;
    this.events.push({ type: 'laneChange', x: p.x, y: p.y, value: dir });
  }

  update(dt: number): void {
    if (this.crashed) return;
    this.events.length = 0;
    const diff = difficultyAt(this.meters);
    this.speed = diff.speed;
    const approach = this.speed * APPROACH_FACTOR;
    const move = approach * dt;
    this.distanceUnits += this.speed * dt;
    this.stats.time += dt;

    this.updatePlayer(dt);
    this.updateTimers(dt);

    // Move the traffic frame.
    for (const r of this.rows) r.top += move;
    this.nextRowTop += move;

    this.spawnRows(diff, approach);
    this.updateHazards(dt, move, approach);
    if (this.crashed) {
      this.syncStats();
      return;
    }
    this.updateCoins(dt, move);
    this.updatePowerups(dt, move);
    this.spawnPowerups(dt);
    this.pruneRows();
    this.syncStats();
  }

  private syncStats(): void {
    this.stats.meters = this.meters;
    this.stats.score = this.score;
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.changeT < 1) {
      p.changeT = Math.min(1, p.changeT + dt / PLAYER.laneChangeTime);
      const t = easeInOutQuad(p.changeT);
      const from = laneCenter(p.fromLane);
      const to = laneCenter(p.lane);
      p.x = from + (to - from) * t;
      p.tilt = Math.sin(p.changeT * Math.PI) * 0.22 * Math.sign(to - from);
    } else {
      p.x = laneCenter(p.lane);
      p.tilt = 0;
    }
    if (this.queuedSteer !== 0 && p.changeT >= 0.6) {
      const dir = this.queuedSteer as -1 | 1;
      this.queuedSteer = 0;
      this.startLaneChange(dir);
    }
    p.y = this.playerY();
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  }

  private updateTimers(dt: number): void {
    for (const k of Object.keys(this.active) as PowerUpKind[]) {
      if (this.active[k] > 0) this.active[k] = Math.max(0, this.active[k] - dt);
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  // ---------------------------------------------------------------- spawning

  private spawnRows(diff: ReturnType<typeof difficultyAt>, approach: number): void {
    // Spawn rows just above the visible area.
    while (this.nextRowTop > -260) {
      this.spawnRow(diff, approach);
    }
  }

  private spawnRow(diff: ReturnType<typeof difficultyAt>, approach: number): void {
    const rng = this.rng;
    const gapUnits = Math.max(approach * diff.rowGapTime, 300);
    const roll = rng.next() * (diff.blockWeights[0] + diff.blockWeights[1] + diff.blockWeights[2]);
    let blockCount = roll < diff.blockWeights[0] ? 1 : roll < diff.blockWeights[0] + diff.blockWeights[1] ? 2 : 3;
    blockCount = Math.min(blockCount, LANES - 1);

    const prev = this.lastRow;
    // Pick a lane mask that leaves the player a reachable free lane.
    let mask = 0;
    let len = 0;
    let reach = 0;
    let kinds: HazardKind[] = [];
    for (let attempt = 0; attempt < 24; attempt++) {
      mask = randomMask(rng, blockCount);
      kinds = [];
      len = 0;
      for (let lane = 0; lane < LANES; lane++) {
        if (!(mask & (1 << lane))) continue;
        let kind: HazardKind = 'car';
        const r = rng.next();
        if (r < diff.truckChance) kind = 'truck';
        else if (r < diff.truckChance + diff.droneChance) kind = 'drone';
        else if (rng.chance(0.35)) kind = 'sport';
        kinds.push(kind);
        len = Math.max(len, HAZARD_SIZES[kind].h);
      }
      len += 24; // room for jitter
      reach = prev ? reachMask(prev.reach, mask, (gapUnits - len - PLAYER.hitH) / approach) : ALL_LANES_MASK & ~mask;
      if (reach !== 0) break;
      if (attempt === 23) {
        // Fall back to a breather: an empty row (coins only) keeps every lane open.
        mask = 0;
        kinds = [];
        len = 60;
        reach = ALL_LANES_MASK;
      }
    }

    const top = this.nextRowTop - len;
    const shift = maxShiftFor((gapUnits - len - PLAYER.hitH) / approach);
    const row: Row = { top, len, mask, reach, shift, alive: true };
    this.rows.push(row);

    let k = 0;
    for (let lane = 0; lane < LANES; lane++) {
      if (!(mask & (1 << lane))) continue;
      const kind = kinds[k++] ?? 'car';
      const size = HAZARD_SIZES[kind];
      const jitter = rng.range(0, len - size.h);
      const hz = this.allocHazard();
      hz.kind = kind;
      hz.lane = lane;
      hz.x = laneCenter(lane);
      hz.y = top + jitter + size.h / 2;
      hz.w = size.w;
      hz.h = size.h;
      hz.hitW = size.hitW;
      hz.hitH = size.hitH;
      hz.variant = rng.int(0, 5);
      hz.danger = false;
      hz.passed = false;
      hz.row = row;
      hz.changeTo = -1;
      hz.changeT = 0;
      hz.telegraph = 0;
      hz.phase = rng.next() * Math.PI * 2;
    }

    // Occasionally make one car a lane changer, only if the row stays fair.
    if (kinds.length > 0 && rng.chance(diff.laneChangerChance)) this.tryLaneChanger(row, prev, approach, gapUnits);

    this.spawnCoinsForRow(row, prev, gapUnits);

    this.lastRow = row;
    this.nextRowTop = top - (gapUnits - len);
  }

  private tryLaneChanger(row: Row, prev: Row | null, approach: number, gapUnits: number): void {
    const candidates = this.hazards.filter((h) => h.active && h.row === row && h.kind !== 'truck' && h.kind !== 'drone');
    if (candidates.length === 0) return;
    const hz = this.rng.pick(candidates);
    const dir = this.rng.chance(0.5) ? -1 : 1;
    const to = hz.lane + dir;
    if (to < 0 || to >= LANES || row.mask & (1 << to)) return;
    // During the change both lanes count as blocked.
    const during = row.mask | (1 << to);
    if (popcount(during) > LANES - 1) return;
    const corridor = (gapUnits - row.len - PLAYER.hitH) / approach;
    const reach = prev ? reachMask(prev.reach, during, corridor) : ALL_LANES_MASK & ~during;
    if (reach === 0) return;
    row.mask = during;
    row.reach = reach;
    hz.changeTo = to;
    hz.telegraph = 0.55;
    hz.changeT = 0;
  }

  private spawnCoinsForRow(row: Row, prev: Row | null, gapUnits: number): void {
    const rng = this.rng;
    if (!rng.chance(0.62)) return;
    const freeLanes: number[] = [];
    for (let l = 0; l < LANES; l++) if (!(row.mask & (1 << l))) freeLanes.push(l);
    if (freeLanes.length === 0) return;
    const spacing = 46;
    const style = rng.next();
    if (style < 0.55 || !prev) {
      // A straight line through a free lane of the row, threading the gap.
      const lane = rng.pick(freeLanes);
      const count = rng.int(4, 7);
      const startY = row.top + row.len / 2 + ((count - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) this.placeCoin(laneCenter(lane), startY - i * spacing);
    } else {
      // A guiding arc from a free lane of the previous row to a free lane of this row.
      const prevFree: number[] = [];
      for (let l = 0; l < LANES; l++) if (prev.reach & (1 << l)) prevFree.push(l);
      if (prevFree.length === 0) return;
      const fromLane = rng.pick(prevFree);
      let toLane = freeLanes[0] ?? fromLane;
      for (const l of freeLanes) if (Math.abs(l - fromLane) < Math.abs(toLane - fromLane)) toLane = l;
      const yStart = row.top + gapUnits - PLAYER.hitH * 0.5;
      const yEnd = row.top + row.len * 0.5;
      const count = Math.max(4, Math.min(9, Math.floor((yStart - yEnd) / spacing)));
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = laneCenter(fromLane) + (laneCenter(toLane) - laneCenter(fromLane)) * easeInOutQuad(clamp(t * 1.4 - 0.2, 0, 1));
        this.placeCoin(x, yStart + (yEnd - yStart) * t);
      }
    }
  }

  private placeCoin(x: number, y: number): void {
    // Never place a coin overlapping a hazard.
    for (const h of this.hazards) {
      if (!h.active) continue;
      const lanesX = h.changeTo >= 0 ? Math.abs(x - (laneCenter(h.lane) + laneCenter(h.changeTo)) / 2) < LANE_WIDTH : Math.abs(x - h.x) < h.w / 2 + COIN_RADIUS + 6;
      if (lanesX && Math.abs(y - h.y) < h.h / 2 + COIN_RADIUS + 10) return;
    }
    const c = this.allocCoin();
    c.x = x;
    c.y = y;
    c.phase = this.rng.next() * Math.PI * 2;
    c.magnetized = false;
  }

  private spawnPowerups(dt: number): void {
    this.powerupTimer -= dt;
    if (this.powerupTimer > 0) return;
    const row = this.lastRow;
    if (!row || row.top > -100) return;
    const free: number[] = [];
    for (let l = 0; l < LANES; l++) if (!(row.mask & (1 << l))) free.push(l);
    if (free.length === 0) return;
    const lane = this.rng.pick(free);
    const x = laneCenter(lane);
    const y = row.top + row.len / 2;
    // Remove coins that would overlap the pickup.
    for (const c of this.coins) if (c.active && Math.abs(c.x - x) < 30 && Math.abs(c.y - y) < 40) c.active = false;
    const p = this.allocPowerup();
    const kinds: PowerUpKind[] = ['magnet', 'shield', 'double'];
    p.kind = this.rng.pick(kinds);
    p.x = x;
    p.y = y;
    p.phase = 0;
    this.powerupTimer = this.rng.range(18, 30);
  }

  // ---------------------------------------------------------------- updates

  private updateHazards(dt: number, move: number, approach: number): void {
    const p = this.player;
    const pTop = p.y - PLAYER.hitH / 2;
    const pBottom = p.y + PLAYER.hitH / 2;
    const dangerRange = approach * 0.32;

    for (const h of this.hazards) {
      if (!h.active) continue;
      h.y += move;
      h.phase += dt;

      if (h.changeTo >= 0) {
        if (h.telegraph > 0) {
          // Blink once visible, then move. Both lanes are already counted as blocked for fairness.
          if (h.y > 30) {
            if (h.telegraph === 0.55) this.events.push({ type: 'blinker', x: h.x, y: h.y, value: h.changeTo - h.lane });
            h.telegraph -= dt;
          }
        } else if (h.changeT < 1) {
          h.changeT = Math.min(1, h.changeT + dt / 0.7);
          const from = laneCenter(h.lane);
          const to = laneCenter(h.changeTo);
          h.x = from + (to - from) * easeInOutQuad(h.changeT);
          if (h.changeT >= 1) {
            h.lane = h.changeTo;
            h.changeTo = -1;
          }
        }
      }

      if (h.y - h.h / 2 > this.viewHeight + 80) {
        h.active = false;
        continue;
      }

      const hTop = h.y - h.hitH / 2;
      const hBottom = h.y + h.hitH / 2;
      const overlapX = Math.abs(h.x - p.x) < (h.hitW + PLAYER.hitW) / 2;

      if (overlapX && hBottom < pTop && pTop - hBottom < dangerRange) h.danger = true;

      if (overlapX && hBottom > pTop && hTop < pBottom) {
        if (p.invuln > 0) continue;
        if (this.active.shield > 0) {
          this.active.shield = 0;
          p.invuln = 1;
          h.active = false;
          this.stats.shieldSaves++;
          this.events.push({ type: 'shieldHit', x: h.x, y: h.y, value: 0 });
          continue;
        }
        this.crashed = true;
        this.events.push({ type: 'crash', x: (h.x + p.x) / 2, y: (hBottom + pTop) / 2, value: 0 });
        return;
      }

      if (!h.passed && hTop > pBottom) {
        h.passed = true;
        if (h.danger) this.awardNearMiss(h);
      }
    }
  }

  private awardNearMiss(h: Hazard): void {
    this.combo = this.comboTimer > 0 ? Math.min(SCORE.maxCombo, this.combo + 1) : 1;
    this.comboTimer = SCORE.comboWindow;
    const points = SCORE.nearMissBase * this.combo;
    this.bonusScore += points;
    this.stats.nearMisses++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.events.push({ type: 'nearMiss', x: (h.x + this.player.x) / 2, y: this.player.y, value: points });
  }

  private updateCoins(dt: number, move: number): void {
    const p = this.player;
    const magnet = this.active.magnet > 0;
    const reach = PICKUP_RADIUS + COIN_RADIUS;
    for (const c of this.coins) {
      if (!c.active) continue;
      c.y += move;
      c.phase += dt * 5;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      if (magnet && (c.magnetized || dx * dx + dy * dy < MAGNET_RADIUS * MAGNET_RADIUS)) {
        c.magnetized = true;
        const pull = Math.min(1, dt * 14);
        c.x += dx * pull;
        c.y += dy * pull;
      }
      if (Math.abs(p.x - c.x) < PLAYER.hitW / 2 + reach - PICKUP_RADIUS && Math.abs(p.y - c.y) < PLAYER.hitH / 2 + COIN_RADIUS) {
        c.active = false;
        const value = this.active.double > 0 ? 2 : 1;
        this.stats.coins += value;
        this.events.push({ type: 'coin', x: c.x, y: c.y, value });
        continue;
      }
      if (c.y > this.viewHeight + 60) c.active = false;
    }
  }

  private updatePowerups(dt: number, move: number): void {
    const p = this.player;
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.y += move;
      pu.phase += dt;
      if (Math.abs(p.x - pu.x) < PLAYER.hitW / 2 + PICKUP_RADIUS && Math.abs(p.y - pu.y) < PLAYER.hitH / 2 + PICKUP_RADIUS) {
        pu.active = false;
        this.active[pu.kind] = POWERUPS[pu.kind].duration;
        this.stats.powerups++;
        this.events.push({ type: 'powerup', x: pu.x, y: pu.y, value: 0, kind: pu.kind });
        continue;
      }
      if (pu.y > this.viewHeight + 60) pu.active = false;
    }
  }

  private pruneRows(): void {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      const r = this.rows[i];
      if (r && r.top > this.viewHeight + 200 && r !== this.lastRow) {
        r.alive = false;
        this.rows.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- pools

  private allocHazard(): Hazard {
    for (const h of this.hazards) if (!h.active) return activate(h);
    const h: Hazard = {
      active: true, kind: 'car', lane: 0, x: 0, y: 0, w: 0, h: 0, hitW: 0, hitH: 0, variant: 0,
      danger: false, passed: false, row: null, changeTo: -1, changeT: 0, telegraph: 0, phase: 0,
    };
    this.hazards.push(h);
    return h;
  }

  private allocCoin(): Coin {
    for (const c of this.coins) if (!c.active) return activate(c);
    const c: Coin = { active: true, x: 0, y: 0, phase: 0, magnetized: false };
    this.coins.push(c);
    return c;
  }

  private allocPowerup(): PowerUp {
    for (const p of this.powerups) if (!p.active) return activate(p);
    const p: PowerUp = { active: true, kind: 'magnet', x: 0, y: 0, phase: 0 };
    this.powerups.push(p);
    return p;
  }
}

function activate<T extends { active: boolean }>(o: T): T {
  o.active = true;
  return o;
}

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

function randomMask(rng: Rng, count: number): number {
  const lanes = [0, 1, 2, 3].slice(0, LANES);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const a = lanes[i] as number;
    lanes[i] = lanes[j] as number;
    lanes[j] = a;
  }
  let mask = 0;
  for (let i = 0; i < count; i++) mask |= 1 << (lanes[i] as number);
  return mask & ALL_LANES_MASK;
}

/**
 * Given every lane the player could legitimately be in (`fromReach`), which free lanes of the next row
 * (`toMask` = blocked lanes) can they reach in `seconds`, allowing for reaction and lane change time?
 * Returns 0 (an unfair row) if ANY possible player position would be trapped. Because the result again
 * contains only positions with a way forward, every run is passable no matter which lanes the player chose,
 * even though they can only see a couple of rows ahead.
 */
export function maxShiftFor(seconds: number): number {
  const perLane = PLAYER.laneChangeTime + 0.08;
  return seconds <= 0 ? 0 : Math.floor(seconds / perLane);
}

export function reachMask(fromReach: number, toMask: number, seconds: number): number {
  const maxShift = maxShiftFor(seconds);
  let out = 0;
  for (let a = 0; a < LANES; a++) {
    if (!(fromReach & (1 << a))) continue;
    let escape = 0;
    for (let b = 0; b < LANES; b++) {
      if (!(toMask & (1 << b)) && Math.abs(a - b) <= maxShift) escape |= 1 << b;
    }
    if (escape === 0) return 0;
    out |= escape;
  }
  return out;
}
