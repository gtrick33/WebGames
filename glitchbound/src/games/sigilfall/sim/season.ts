import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { keyLoot } from '../data/keystones';
import {
  BOON_BY_ID,
  BOONS,
  ECHO_EVERY,
  HUNTER_AFTER,
  HUNTER_DMG,
  HUNTER_HP,
  seasonDef,
  SHRINE_IDS,
  SHRINE_TIME,
  SHRINES,
  SHRINES_PER_RUN,
  STREAK_DMG,
  STREAK_MAX,
  STREAK_SPEED,
  STREAK_TIME,
  STREAK_TIME_EVERY,
  STREAK_WINDOW,
  THIEF_TIME,
  type SeasonMechanic,
  type ShrineId,
} from '../data/seasons';
import type { BuffDef, Mod } from '../data/types';
import { setsWorn } from '../progress/build';
import { ensureSeason } from '../progress/season';
import { addBuff, damageArea } from './combat';
import { TILE } from './map';
import type { Enemy } from './types';
import type { World } from './world';

/**
 * A Rift season in a Riftstone run (data/seasons.ts): what the season does while the run goes on, as opposed to what it
 * makes of the hero going in (progress/season.ts seasonBuild). Shrines standing in the rooms, a streak of kills, boons
 * after the bosses, the hunter, the echo of every fifth skill. sim/world.ts calls in at each turn of the run: as it
 * starts, every step, every kill, every skill cast, every boss down, and when the hero would fall.
 */

/** A shrine standing in a room of the run (the Season of Shrines). */
export interface Shrine {
  id: number;
  kind: ShrineId;
  x: number;
  y: number;
  taken: boolean;
  /** Seconds since it was taken (it goes out in a flash), or since it rose. */
  t: number;
}

export interface SeasonRun {
  mechanic: SeasonMechanic;
  shrines: Shrine[];
  /** The kill streak (the Season of Bloodlust): its length, the last kill's time, and the time it has bought back. */
  streak: { n: number; last: number; bought: number };
  /** The hunter (the Season of the Hunter): when it comes, the enemy it is, and how it went. */
  hunter: { at: number; id: number; state: 'waiting' | 'out' | 'down' } | null;
  /** Skills cast this run (the Season of Echoes: every fifth comes again). */
  casts: number;
  /** Boons taken this run, and those on the table after a boss (the run waits for the choice). */
  boons: string[];
  offer: string[] | null;
  /** Second Wind, waiting for the fall it undoes. */
  revive: boolean;
  /** When the Shrine of Thunder's lightning next leaps. */
  thunderT: number;
}

/** The Season of Shrines' powers, as buffs (Thunder's lightning is the run's own: seasonTick). */
const SHRINE_BUFF: Record<ShrineId, BuffDef> = {
  might: { id: 'shrine-might', name: 'Shrine of Might', dur: SHRINE_TIME, dmg: 100, color: SHRINES.might.color },
  haste: { id: 'shrine-haste', name: 'Shrine of Haste', dur: SHRINE_TIME, stats: { speed: 40, haste: 40 }, color: SHRINES.haste.color },
  ward: { id: 'shrine-ward', name: 'Shrine of the Ward', dur: SHRINE_TIME, dr: 60, color: SHRINES.ward.color },
  thunder: { id: 'shrine-thunder', name: 'Shrine of Thunder', dur: SHRINE_TIME, color: SHRINES.thunder.color },
};

const BLOODLUST: BuffDef = { id: 'bloodlust', name: 'Bloodlust', dur: STREAK_WINDOW, max: STREAK_MAX, dmg: STREAK_DMG, stats: { speed: STREAK_SPEED }, color: '#ff3a4a' };
const BULWARK: BuffDef = { id: 'boon-bulwark', name: 'Bulwark', dur: 99999, dr: 20, color: '#b8b8c8' };

/** The middle of a room's floor, as the bot walks to it. */
function roomMiddle(w: World, index: number): { x: number; y: number } | null {
  const tiles = (w.map.roomTiles[index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** The run's season, as it starts: its shrines in their rooms, its hunter's hour. */
export function startSeasonRun(w: World): SeasonRun {
  const mechanic = seasonDef(w.season).mechanic;
  const run: SeasonRun = { mechanic, shrines: [], streak: { n: 0, last: -99, bought: 0 }, hunter: null, casts: 0, boons: [], offer: null, revive: false, thunderT: 0 };
  if (mechanic === 'shrines') {
    // one early in the run and one late: never the first room (taken before a blow is struck) nor the last (the run's
    // end), and a boss's room may hold one (walked through on the way in, a power for the fight)
    const all = [...w.encounters].sort((a, b) => a.index - b.index).map((e) => e.index);
    const rooms = all.length > 3 ? all.slice(1, -1) : all.slice(0, -1);
    const picks = [...new Set([rooms[0], rooms[rooms.length - 1]])].filter((x): x is number => x !== undefined);
    const kinds = [...SHRINE_IDS].sort(() => w.rand() - 0.5);
    picks.slice(0, SHRINES_PER_RUN).forEach((room, i) => {
      const at = roomMiddle(w, room);
      if (at) run.shrines.push({ id: i + 1, kind: kinds[i % kinds.length]!, x: at.x, y: at.y, taken: false, t: 0 });
    });
  }
  if (mechanic === 'nemesis') run.hunter = { at: HUNTER_AFTER, id: -1, state: 'waiting' };
  // the Season of Kinship is felt the moment a set is made whole by it
  if (mechanic === 'kinship' && setsWorn(w.hero.equip).some((s) => s.worn >= 2 && s.worn < 6)) used(w);
  return run;
}

/** The hero has felt the season's power (the Journey's first chapter asks for it). */
function used(w: World): void {
  ensureSeason(w.hero, w.season).used = true;
}

/** The season's part of a run's step: shrines touched and glowing, Thunder's lightning, the hunter coming. */
export function seasonTick(w: World, dt: number): void {
  const run = w.seasonRun!;
  const p = w.player;
  for (const s of run.shrines) {
    s.t += dt;
    if (s.taken || p.dead) continue;
    if ((s.x - p.x) ** 2 + (s.y - p.y) ** 2 > 24 * 24) continue;
    // walked through: its power, a pillar of its light going up, its name over the hero
    s.taken = true;
    s.t = 0;
    addBuff(w, SHRINE_BUFF[s.kind]);
    const d = SHRINES[s.kind];
    w.addFx({ kind: 'ring', x: s.x, y: s.y, life: 0.6, size: 60, color: d.color });
    w.fxBurst(s.x, s.y, d.color, 26, 18);
    w.text(p.x, p.y - 34, d.name, d.color, true);
    w.sfx('pickupBig');
    const st = ensureSeason(w.hero, w.season);
    st.shrines = (st.shrines ?? 0) + 1;
    used(w);
  }
  // the Shrine of Thunder: lightning out of the hero into everything near, twice a second
  if (p.buffs.some((b) => b.def.id === 'shrine-thunder')) {
    run.thunderT -= dt;
    if (run.thunderT <= 0) {
      run.thunderT = 0.5;
      const near = w.enemies.filter((e) => !e.dead && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 96 * 96).slice(0, 5);
      for (const e of near) w.addFx({ kind: 'zap', x: p.x, y: p.y - 12, x2: e.x, y2: e.y - 8, life: 0.18, size: 2, color: SHRINES.thunder.core });
      if (near.length) damageArea(w, p.x, p.y, 96, CLASSES[w.hero.cls].refDamage * 5, 'lightning', 1, null, [{ status: 'shock', dur: 2, power: 10 }]);
    }
  }
  // the streak ends when the kills do
  if (run.streak.n > 0 && w.time - run.streak.last > STREAK_WINDOW) run.streak.n = 0;
  // the hunter finds the hero: once into the run, out of a boss's room, in a fight's lull or not
  const h = run.hunter;
  if (h?.state === 'waiting' && w.keyRun && !w.keyRun.end && w.keyRun.t >= h.at && !p.dead && !w.enemies.some((e) => e.boss && !e.dead)) spawnHunter(w, h);
}

/** The strongest foe of the dungeon (a boss's not), made the hunter: many times as hard, and marked. */
function spawnHunter(w: World, h: NonNullable<SeasonRun['hunter']>): void {
  const p = w.player;
  const ids = [...new Set(w.region.encounters.flatMap((e) => (e.boss ? [] : e.waves.flatMap((wv) => wv.enemies))))].filter((id) => ENEMIES[id] && !ENEMIES[id]!.prop);
  const id = ids.sort((a, b) => (ENEMIES[b]!.hp ?? 0) - (ENEMIES[a]!.hp ?? 0))[0];
  if (!id) {
    h.state = 'down';
    return;
  }
  // a few steps off, where the floor is
  const a = w.rand() * Math.PI * 2;
  const e = w.addEnemy(id, p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80, w.level, { elite: true, room: -1, pack: 0, spawn: true });
  e.hp = e.maxHp = e.maxHp * HUNTER_HP;
  e.dmg *= HUNTER_DMG;
  e.aggro = true;
  e.name = 'The Hunter';
  e.hunter = true;
  e.scale *= 1.45;
  h.id = e.id;
  h.state = 'out';
  w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.9, size: 70, color: '#ff3a3a' });
  w.emit({ t: 'banner', text: 'The Hunter has found you', sub: 'Beat it for a trophy that lasts the season' });
  w.sfx('rift', 0.9);
}

/** A kill, as the season counts it: the streak, a Time Thief's seconds, the hunter brought down. */
export function seasonKill(w: World, e: Enemy): void {
  const run = w.seasonRun!;
  const k = w.keyRun;
  if (!k || k.end) return;
  if (run.mechanic === 'bloodlust') {
    const s = run.streak;
    s.n = w.time - s.last <= STREAK_WINDOW ? s.n + 1 : 1;
    s.last = w.time;
    addBuff(w, BLOODLUST);
    const st = ensureSeason(w.hero, w.season);
    st.streak = Math.max(st.streak ?? 0, s.n);
    if (s.n >= 10) used(w);
    // a long streak buys the clock back a little
    if (s.n % STREAK_TIME_EVERY === 0) {
      k.t = Math.max(0, k.t - STREAK_TIME);
      s.bought += STREAK_TIME;
      w.text(w.player.x, w.player.y - 40, `Streak ${s.n}! −${STREAK_TIME} s`, '#ff5a6a', true);
    } else if (s.n === 10 || s.n === 25) w.text(w.player.x, w.player.y - 34, `Streak ${s.n}`, '#ff5a6a', false);
  }
  if (run.boons.includes('time-thief')) k.t = Math.max(0, k.t - THIEF_TIME);
  if (e.hunter && run.hunter?.state === 'out') {
    run.hunter.state = 'down';
    const st = ensureSeason(w.hero, w.season);
    st.hunted = (st.hunted ?? 0) + 1;
    used(w);
    for (let i = 0; i < 2; i++) w.dropItem(e.x, e.y, w.rollItem('boss', keyLoot(k.key, k.heroLevel)));
    w.emit({ t: 'banner', text: 'The Hunter falls', sub: `${st.hunted} this season · +${Math.min(30, st.hunted)}% damage in the Riftstones` });
    w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 80, color: '#ffd84a' });
    w.rebuild();
  }
}

/** A skill cast, as the season counts it: the Season of Echoes sends every fifth one again. */
export function seasonCast(w: World, slot: string): void {
  const run = w.seasonRun!;
  if (run.mechanic !== 'echoes' || !w.keyRun || w.keyRun.end) return;
  run.casts += 1;
  if (run.casts % ECHO_EVERY !== 0) return;
  const id = w.build.bar[slot as 's1'];
  if (!id) return;
  w.after(0.2, () => {
    const p = w.player;
    if (p.dead) return;
    w.echo(id, 1);
    // (said twice: a ring of its light goes out from the hero as the skill comes again)
    w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.45, size: 46, color: '#8ae0ff' });
    w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.6, size: 30, color: '#d8f6ff' });
    w.text(p.x, p.y - 30, 'Echo', '#8ae0ff', false);
    w.sfx('blink', 0.35);
  });
  const st = ensureSeason(w.hero, w.season);
  st.echoes = (st.echoes ?? 0) + 1;
  used(w);
}

/** A boss down in a run of the Season of Boons: three boons on the table, and the run waits for the choice. */
export function seasonBossDown(w: World): void {
  const run = w.seasonRun!;
  if (run.mechanic !== 'boons' || !w.keyRun || w.keyRun.end) return;
  const left = BOONS.filter((b) => !run.boons.includes(b.id));
  const pick: string[] = [];
  while (pick.length < 3 && left.length) pick.push(left.splice(Math.floor(w.rand() * left.length), 1)[0]!.id);
  if (!pick.length) return;
  run.offer = pick;
  // (a run with no one to choose, the play-bot's, takes the first)
  if (w.autoBoons) takeBoon(w, 0);
}

/** The boons a run has taken, as modifiers (the rest is the run's own: a revive, a ward, the clock, the cache). */
export function boonMods(w: World): Mod[] {
  const run = w.seasonRun;
  if (!run) return [];
  const out: Mod[] = [];
  for (const id of run.boons) {
    const b = BOON_BY_ID[id];
    if (!b) continue;
    out.push(...(b.mods ?? []));
    if (b.special === 'echo') {
      const spec = w.hero.spec !== null ? CLASSES[w.hero.cls].trees[w.hero.spec] : null;
      if (spec) out.push({ t: 'proc', proc: { id: 'boon-echo', on: 'tick', chance: 1, icd: 6, effect: { kind: 'cast', skill: spec.skill, mul: 1 }, text: 'Every 6 s in a fight: an echo of your specialization’s skill.' } });
    }
  }
  return out;
}

/** Takes one of the boons on the table. */
export function takeBoon(w: World, i: number): boolean {
  const run = w.seasonRun;
  const id = run?.offer?.[i];
  if (!run || !id) return false;
  run.offer = null;
  run.boons.push(id);
  const b = BOON_BY_ID[id]!;
  if (b.special === 'revive') run.revive = true;
  if (b.special === 'bulwark') addBuff(w, BULWARK);
  const p = w.player;
  w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.7, size: 64, color: b.color });
  w.fxBurst(p.x, p.y, b.color, 22, 16);
  w.text(p.x, p.y - 34, b.name, b.color, true);
  w.sfx('levelup', 0.7);
  const st = ensureSeason(w.hero, w.season);
  st.boons = (st.boons ?? 0) + 1;
  used(w);
  w.rebuild();
  return true;
}

/** The hero would fall: Second Wind undoes it once. True when it did. */
export function seasonFall(w: World): boolean {
  const run = w.seasonRun;
  if (!run?.revive) return false;
  run.revive = false;
  const p = w.player;
  p.hp = Math.round(p.maxHp / 2);
  p.iframe = Math.max(p.iframe, 1.5);
  w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.9, size: 80, color: '#ffe066' });
  w.fxBurst(p.x, p.y, '#ffe066', 30, 20);
  w.text(p.x, p.y - 36, 'Second Wind', '#ffe066', true);
  w.sfx('levelup', 0.8);
  return true;
}

/** What the run's boons add to its end: items in the cache, and a share more Sigil Marks. */
export function boonRunEnd(w: World): { cache: number; marks: number } {
  const fortune = w.seasonRun?.boons.includes('fortune');
  return { cache: fortune ? 2 : 0, marks: fortune ? 25 : 0 };
}
