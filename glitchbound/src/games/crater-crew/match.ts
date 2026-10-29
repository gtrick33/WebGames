/**
 * A Crater Crew battle as plain JSON: the map (seed, landform and every crater so far), the crews and
 * their units, whose turn it is and the wind. A turn is the active unit's walk (one input per sim step,
 * run-length coded) and at most one shot; playTurn() replays it through the physics and moves the
 * battle on. The room server and the single-player game both use it, and every phone replays the same
 * turn to animate it.
 */
import type { CharId } from './characters';
import { hash01, rng } from './math';
import { IN_JUMP, IN_LEFT, IN_RIGHT, fire, makeWorld, runToRest, settleUnit, walkStep, type Fire, type Unit, type World } from './sim';
import { baseMask, findSpawns, maskFor, W } from './terrain';
import { TERRAINS, type TerrainId } from './terrains';
import { isWeaponId, startAmmo, type WeaponId } from './weapons';

export const LEVELS = ['easy', 'normal', 'hard'] as const;
export type Level = (typeof LEVELS)[number];
export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);

export const MAX_CREWS = 6;
export const UNIT_HP = 100;
export const CREW_SIZES = [1, 2, 3] as const;
export const TURN_TIMES = [20, 30, 45] as const;
/** After this many turns per crew the liquid starts to rise each turn. */
export const SUDDEN_ROUNDS = 10;
const RISE = 18;
/** A battle that somehow never ends is called after this many turns. */
export const MAX_TURNS = 240;
/** The most walking (sim steps) one turn can hold: the longest turn plus some grace. */
export const MAX_WALK = 60 * 50;

export interface Crew {
  name: string;
  char: CharId;
  /** A computer crew's level, or null for a person. */
  bot: Level | null;
  /** The room seat playing this crew (null offline). */
  seat: number | null;
  ammo: Record<WeaponId, number>;
  /** Which of its units goes next. */
  next: number;
  /** Damage dealt to other crews, and their units knocked out. */
  dmg: number;
  kills: number;
}

export interface UnitState {
  id: number;
  crew: number;
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  dead: boolean;
  /** Lost in the liquid (gone from the map). */
  gone: boolean;
}

export interface TurnInput {
  /** [input bits, steps] runs: IN_LEFT | IN_RIGHT | IN_JUMP. */
  walk: [number, number][];
  fire: Fire | null;
}

export interface LastTurn {
  turn: number;
  unit: number;
  input: TurnInput;
}

export interface Match {
  seed: number;
  terrain: TerrainId;
  crewSize: number;
  turnSecs: number;
  craters: number[];
  crews: Crew[];
  units: UnitState[];
  turn: number;
  /** The crew whose turn it is, and its unit. */
  crewTurn: number;
  active: number;
  wind: number;
  liquidY: number;
  /** The turn just played (phones replay it to animate). */
  last: LastTurn | null;
  over: boolean;
  /** The winning crew, -1 for a draw, null while playing. */
  winner: number | null;
}

export interface CrewSpec {
  name: string;
  char: CharId;
  bot: Level | null;
  seat: number | null;
}

export const windFor = (seed: number, terrain: TerrainId, turn: number): number => Math.round((hash01(seed ^ 0x77d1, turn) * 2 - 1) * TERRAINS[terrain].windMax);

export function newMatch(o: { seed: number; terrain: TerrainId; crewSize: number; turnSecs: number; crews: CrewSpec[] }): Match {
  const n = o.crews.length;
  const spots = findSpawns(baseMask(o.seed, o.terrain), o.terrain, n * o.crewSize, o.seed);
  const units: UnitState[] = spots.map((p, i) => ({ id: i, crew: i % n, x: p.x, y: p.y, hp: UNIT_HP, facing: p.x < W / 2 ? 1 : -1, dead: false, gone: false }));
  const crews: Crew[] = o.crews.map((c) => ({ name: c.name, char: c.char, bot: c.bot, seat: c.seat, ammo: startAmmo(), next: 0, dmg: 0, kills: 0 }));
  const m: Match = {
    seed: o.seed >>> 0,
    terrain: o.terrain,
    crewSize: o.crewSize,
    turnSecs: o.turnSecs,
    craters: [],
    crews,
    units,
    turn: 0,
    crewTurn: Math.floor(rng(o.seed ^ 0xc4e7)() * n),
    active: -1,
    wind: windFor(o.seed, o.terrain, 0),
    liquidY: TERRAINS[o.terrain].liquidY,
    last: null,
    over: false,
    winner: null,
  };
  m.active = pickUnit(m, m.crewTurn);
  return m;
}

const living = (m: Match, crew: number): UnitState[] => m.units.filter((u) => u.crew === crew && !u.dead);

/** The next unit of a crew to play (and moves its pointer on). */
function pickUnit(m: Match, crew: number): number {
  const mine = m.units.filter((u) => u.crew === crew);
  const c = m.crews[crew]!;
  for (let j = 0; j < mine.length; j++) {
    const idx = (c.next + j) % mine.length;
    if (!mine[idx]!.dead) {
      c.next = idx + 1;
      return mine[idx]!.id;
    }
  }
  return -1;
}

/** The physics world at the start of the current turn. */
export function worldFor(m: Match): World {
  const units: Unit[] = m.units.filter((u) => !u.gone).map((u) => ({ id: u.id, crew: u.crew, x: u.x, y: u.y, vx: 0, vy: 0, air: false, hp: u.hp, dead: u.dead, drowned: false, facing: u.facing, wa: 0, jc: 0 }));
  const def = TERRAINS[m.terrain];
  return makeWorld(maskFor(m.seed, m.terrain, m.craters), units, m.wind, def.gravity, m.liquidY);
}

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** A turn from the network, checked (null: not a turn). Walks are clipped to the longest allowed. */
export function cleanInput(raw: unknown): TurnInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { walk?: unknown; fire?: unknown };
  if (!Array.isArray(r.walk) || r.walk.length > 800) return null;
  const walk: [number, number][] = [];
  let total = 0;
  for (const seg of r.walk) {
    if (!Array.isArray(seg) || !int(seg[0], 0, IN_LEFT | IN_RIGHT | IN_JUMP) || !int(seg[1], 1, MAX_WALK)) return null;
    const n = Math.min(seg[1], MAX_WALK - total);
    if (n <= 0) break;
    walk.push([seg[0], n]);
    total += n;
  }
  let f: Fire | null = null;
  if (r.fire !== null && r.fire !== undefined) {
    const x = r.fire as Partial<Fire>;
    if (!isWeaponId(x.w) || !int(x.aim, -850, 850) || (x.dir !== 1 && x.dir !== -1) || !int(x.power, 0, 100) || !int(x.tx, 0, W)) return null;
    f = { w: x.w, aim: x.aim, dir: x.dir, power: x.power, tx: x.tx };
  }
  return { walk, fire: f };
}

/** Whether a crew may fire this weapon now. */
export const hasAmmo = (m: Match, crew: number, w: WeaponId): boolean => (m.crews[crew]?.ammo[w] ?? 0) !== 0;

/** Plays the walk part of a turn into a world (the same calls the phone makes live). */
export function playWalk(w: World, unit: number, walk: readonly [number, number][]): void {
  for (const [bits, n] of walk) for (let i = 0; i < n; i++) walkStep(w, unit, bits);
  settleUnit(w, unit);
}

/** Whether the turn's shot goes off: the unit is still standing and the crew has the ammo. */
export function canFire(m: Match, w: World, f: Fire | null): f is Fire {
  const u = w.units.find((x) => x.id === m.active);
  return !!f && !!u && !u.drowned && !u.dead && u.hp > 0 && hasAmmo(m, u.crew, f.w);
}

/**
 * Plays the current turn and returns the battle after it, the world as it ended, and how many steps
 * the walk and the shot took (the room waits for the phones to show it).
 */
export function playTurn(m: Match, input: TurnInput): { match: Match; world: World; walkSteps: number; shotSteps: number } {
  const w = worldFor(m);
  playWalk(w, m.active, input.walk);
  const walkSteps = w.steps;
  const fired = canFire(m, w, input.fire);
  if (fired) fire(w, m.active, input.fire!);
  runToRest(w);
  return { match: endTurn(m, w, input, fired), world: w, walkSteps, shotSteps: w.steps - walkSteps };
}

/** Books a finished turn (damage, knockouts, craters, ammo) and hands the next one out. */
export function endTurn(m: Match, w: World, input: TurnInput, fired: boolean): Match {
  const next: Match = structuredClone(m);
  const shooter = m.units.find((u) => u.id === m.active)?.crew ?? -1;
  const crew = next.crews[shooter];
  if (crew && fired && input.fire && crew.ammo[input.fire.w] > 0) crew.ammo[input.fire.w]--;
  for (const s of next.units) {
    if (s.gone) continue;
    const u = w.units.find((x) => x.id === s.id);
    if (!u) continue;
    const before = s.hp;
    const wasAlive = !s.dead;
    s.x = u.x;
    s.y = u.y;
    s.facing = u.facing;
    s.hp = Math.max(0, Math.round(u.hp));
    s.gone = u.drowned;
    s.dead = s.dead || s.hp <= 0 || u.drowned;
    if (crew && s.crew !== shooter) {
      crew.dmg += Math.max(0, Math.min(before, w.hurt[s.id] ?? 0));
      if (wasAlive && s.dead) crew.kills++;
    }
  }
  next.craters = m.craters.concat(w.craters);
  next.last = { turn: m.turn, unit: m.active, input };
  next.turn = m.turn + 1;
  if (next.turn >= next.crews.length * SUDDEN_ROUNDS) {
    next.liquidY = Math.max(240, next.liquidY - RISE);
    for (const s of next.units) if (!s.gone && s.y - 8 > next.liquidY) Object.assign(s, { gone: true, dead: true, hp: 0 });
  }
  const standing = next.crews.map((_, i) => i).filter((i) => living(next, i).length > 0);
  if (standing.length <= 1 || next.turn >= MAX_TURNS) {
    next.over = true;
    next.active = -1;
    if (standing.length === 1) next.winner = standing[0]!;
    else if (standing.length === 0) next.winner = -1;
    else {
      const hp = standing.map((i) => living(next, i).reduce((a, u) => a + u.hp, 0));
      const top = Math.max(...hp);
      next.winner = hp.filter((h) => h === top).length > 1 ? -1 : standing[hp.indexOf(top)]!;
    }
    return next;
  }
  for (let k = 1; k <= next.crews.length; k++) {
    const c = (m.crewTurn + k) % next.crews.length;
    if (living(next, c).length) {
      next.crewTurn = c;
      next.active = pickUnit(next, c);
      break;
    }
  }
  next.wind = windFor(next.seed, next.terrain, next.turn);
  return next;
}

/** A crew's score: damage dealt, 50 a knockout, and 250 plus twice its health left for winning. */
export function crewScore(m: Match, crew: number): number {
  const c = m.crews[crew];
  if (!c) return 0;
  const hp = living(m, crew).reduce((a, u) => a + u.hp, 0);
  return c.dmg + c.kills * 50 + (m.winner === crew ? 250 + hp * 2 : 0);
}

/** Health left per crew (for the bars at the top). */
export const crewHealth = (m: Match): number[] => m.crews.map((_, i) => living(m, i).reduce((a, u) => a + u.hp, 0));

/** Whether this turn sinks the liquid: the HUD warns a turn ahead. */
export const suddenDeath = (m: Match): boolean => m.turn >= m.crews.length * SUDDEN_ROUNDS - 1;

