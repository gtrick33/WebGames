/**
 * A simple play-bot for Sigilfall's simulation: it walks to the nearest enemy along the map, keeps a
 * class-appropriate distance, fires everything that is ready, drinks potions, and steps out of (or
 * dodges) enemy telegraphs. It is not clever, which is the point: if it can clear a region and beat
 * its boss, a person can too.
 */
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { xpToNext } from '../src/games/sigilfall/data/classes';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { SKILL_SLOTS, SLOTS, type ClassId, type RegionId, type SlotKey } from '../src/games/sigilfall/data/types';
import { chooseSpec, learnTalent, newCharacter, addXp, freePoints, type Character } from '../src/games/sigilfall/progress/character';
import { rollGear } from '../src/games/sigilfall/progress/items';
import { questSteps } from '../src/games/sigilfall/progress/handin';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { SPEC_LEVEL, TALENTS } from '../src/games/sigilfall/data/talents';
import { rng } from '../src/games/sigilfall/core/math';
import { flowField, flowStep, lineOfSight, TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy, WorldEvent } from '../src/games/sigilfall/sim/types';
import { emptyInput, inside, World } from '../src/games/sigilfall/sim/world';

/**
 * A hero of a level with a full set of gear of that level, a specialization (from level 10) and every
 * talent point spent, down its tree first; one who has met every boss before (the shot of a boss met for the
 * first time, sim/scene.ts, is tested on its own).
 */
export function readyHero(cls: ClassId, level: number, rarity: 'common' | 'uncommon' | 'rare' | 'epic' = 'uncommon', seed = 7, spec: 0 | 1 | 2 = 0): Character {
  const c = newCharacter(cls, 'Bot', 'bot', 0);
  let need = 0;
  while (c.level < level && need++ < 200) addXp(c, xpToNext(c.level));
  const r = rng(seed);
  for (const slot of SLOTS) c.equip[slot] = rollGear(cls, level, rarity, r, slot);
  if (c.level >= SPEC_LEVEL) chooseSpec(c, spec);
  for (let guard = 0; freePoints(c) > 0 && guard < 400; guard++) {
    const node = [...TALENTS[cls]].sort((a, b) => (a.tree === spec ? 0 : 1) - (b.tree === spec ? 0 : 1) || a.row - b.row).find((n) => learnTalent(c, n.id));
    if (!node) break;
  }
  for (const id of Object.keys(BOSSES)) c.opened.push(`scene:boss-${id}`);
  return c;
}

export interface BotResult {
  time: number;
  deaths: number;
  kills: number;
  bossesDown: string[];
  events: WorldEvent[];
  /** Lowest health share seen (0..1). */
  lowest: number;
  stuck: boolean;
  /** Seconds each boss fight took (start to defeat). */
  bossTimes: Record<string, number>;
}

const DT = 1 / 60;

/** Something in the world is not a finite number. */
export function brokenNumbers(w: World): string | null {
  const p = w.player;
  for (const [k, v] of Object.entries({ x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, ult: p.ult })) if (!Number.isFinite(v)) return `player.${k}=${v}`;
  for (const e of w.enemies) for (const [k, v] of Object.entries({ x: e.x, y: e.y, hp: e.hp })) if (!Number.isFinite(v)) return `${e.def.id}.${k}=${v}`;
  for (const pr of w.projectiles) if (!Number.isFinite(pr.x) || !Number.isFinite(pr.y)) return 'projectile position';
  return null;
}

/** A hero at a story event's moment: everything its quest needs done, and its quest at the event's step. */
export function heroAtEvent(event: string, cls: ClassId = 'warrior'): Character {
  const q = Object.values(QUEST_DEFS).find((d) => questSteps(d).some((o) => o.kind === 'event' && o.event === event));
  if (!q) throw new Error(`no quest plays ${event}`);
  const step = questSteps(q).findIndex((o) => o.kind === 'event' && o.event === event);
  const c = readyHero(cls, 40);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of q.after ?? []) done(a);
  c.quests[q.id] = { state: 'active', n: 0, ...(step ? { step } : {}) };
  return c;
}

/**
 * A world for the tests. Finished quests pay out at once here (`handIns` false): the story tests play the
 * story, not the walk back to the giver; the hand-in itself is tested on its own (sigilfall-guidance) and by
 * the campaign walk.
 */
export function newWorld(region: RegionId, hero: Character, seed = 1, tier = 0, from?: RegionId, handIns = false): World {
  return new World({ region, tier, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed, handIns, ...(from ? { from } : {}) });
}

/**
 * A dungeon run with retries, as a player would: the first run that clears cleanly (no more than `deaths`
 * falls) of up to three on fresh seeds (a class that loses all three still fails the test). The bot's mage is
 * a coin flip against the late bosses (SIGILFALL_QA.md, known issues): one seed proves little either way.
 */
export function clearsWithRetry(run: (seed: number) => { w: World; r: BotResult }, deaths = 2): { w: World; r: BotResult } {
  let last = run(1);
  for (let seed = 2; seed <= 3 && !(last.w.cleared && !last.r.stuck && last.r.deaths <= deaths); seed++) last = run(seed);
  return last;
}

const tileOf = (w: World, x: number, y: number): number => Math.floor(y / TILE) * w.map.w + Math.floor(x / TILE);

/**
 * Plays until `done` says so or the time runs out. `goal` picks where to go when no enemy is
 * reachable (null = stand still).
 */
export function play(w: World, o: { seconds: number; done: (w: World) => boolean; goal?: (w: World) => { x: number; y: number } | null; maxDeaths?: number; trace?: (w: World, info: string) => void }): BotResult {
  // melee classes (and a druid in a shape) close in; the others keep their distance
  const isMelee = (): boolean => w.build.skills[w.build.bar.basic ?? '']?.spec.cast === 'melee';
  const res: BotResult = { time: 0, deaths: 0, kills: 0, bossesDown: [], events: [], lowest: 1, stuck: false, bossTimes: {} };
  const bossStart: Record<string, number> = {};
  let fromHero: Int16Array = new Int16Array(w.map.w * w.map.h);
  let toTarget: Int16Array = new Int16Array(w.map.w * w.map.h);
  let target: Enemy | null = null;
  let goalPt: { x: number; y: number } | null = null;
  let think = 0;
  let deadT = 0;
  let lastMove = { x: w.player.x, y: w.player.y, t: 0 };
  let foeHp = Infinity;
  // something being healed as fast as it's hurt: leave it a while and go for what else is there, as a player would
  let watching = { id: -1, hp: 0, t: 0 };
  const leftAlone = new Map<number, number>();
  while (res.time < o.seconds && !o.done(w)) {
    const p = w.player;
    const f = emptyInput();
    if (p.dead) {
      deadT += DT;
      if (deadT > 2) {
        deadT = 0;
        w.respawn();
        if (o.maxDeaths !== undefined && res.deaths > o.maxDeaths) break;
      }
    } else {
      think -= DT;
      if (think <= 0) {
        think = 0.25;
        fromHero = flowField(w.map, Math.floor(p.x / TILE), Math.floor(p.y / TILE), 4000, fromHero);
        target = null;
        let best = Infinity;
        for (const e of w.enemies) {
          if (e.dead || e.dummy || e.hp <= 0 || (leftAlone.get(e.id) ?? 0) > res.time) continue;
          const d = fromHero[tileOf(w, e.x, e.y)] ?? -1;
          if (d < 0) continue;
          if (d < best) {
            best = d;
            target = e;
          }
        }
        if (target) {
          const left = target.hp + target.shield;
          if (watching.id !== target.id) watching = { id: target.id, hp: left, t: res.time };
          else if (res.time - watching.t > 30) {
            if (left >= watching.hp * 0.98) leftAlone.set(target.id, res.time + 25);
            watching = { id: target.id, hp: left, t: res.time };
          }
        }
        goalPt = target ? { x: target.x, y: target.y } : (o.goal?.(w) ?? null);
        if (goalPt) toTarget = flowField(w.map, Math.floor(goalPt.x / TILE), Math.floor(goalPt.y / TILE), 4000, toTarget);
      }
      // danger first: step out of anything about to land
      const danger = w.telegraphs.find((t) => t.tone !== 'player' && !t.dead && inside(t, p.x, p.y, p.r));
      let mx = 0;
      let my = 0;
      if (danger) {
        let ax = p.x - danger.x;
        let ay = p.y - danger.y;
        if (danger.shape === 'line' || danger.shape === 'cone') {
          // sideways out of a line
          ax = -Math.sin(danger.angle);
          ay = Math.cos(danger.angle);
          const side = (p.x - danger.x) * ax + (p.y - danger.y) * ay;
          if (side < 0) {
            ax = -ax;
            ay = -ay;
          }
        } else if (danger.shape === 'ring' || danger.shape === 'donut') {
          ax = -ax;
          ay = -ay;
        }
        const l = Math.hypot(ax, ay) || 1;
        mx = ax / l;
        my = ay / l;
        if (danger.dur - danger.t < 0.35 && p.cds.dodge.charges > 0) f.casts.push({ slot: 'dodge', angle: Math.atan2(my, mx), dist: null, assist: 0 });
      } else if (target) {
        const melee = isMelee();
        const keep = melee ? 10 : 62;
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        const step = flowStep(w.map, toTarget, p.x, p.y);
        // a pillar or a rock in the way: walk round it rather than shoot the stone (shots leave from
        // a little above the hero's feet)
        const blocked = !lineOfSight(w.map, p.x, p.y, target.x, target.y) || !lineOfSight(w.map, p.x, p.y - 4, target.x, target.y);
        if (d > keep + target.r + 30 || (step && d > keep + target.r) || (blocked && step)) {
          if (step) {
            mx = step.x;
            my = step.y;
          } else {
            mx = (target.x - p.x) / d;
            my = (target.y - p.y) / d;
          }
        } else if (!melee && d < keep * 0.6) {
          mx = (p.x - target.x) / d;
          my = (p.y - target.y) / d;
        }
      } else if (goalPt) {
        const step = flowStep(w.map, toTarget, p.x, p.y);
        if (step) {
          mx = step.x;
          my = step.y;
        } else {
          const d = Math.hypot(goalPt.x - p.x, goalPt.y - p.y);
          if (d > 4) {
            mx = (goalPt.x - p.x) / d;
            my = (goalPt.y - p.y) / d;
          }
        }
      }
      f.mx = mx;
      f.my = my;
      if (target) {
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        f.aim = a;
        f.aimX = target.x;
        f.aimY = target.y;
        const reach = (slot: SlotKey): boolean => {
          const id = w.build.bar[slot];
          const spec = id ? w.build.skills[id]?.spec : undefined;
          if (!spec || spec.cast === 'blink' || spec.cast === 'form') return false;
          if (spec.cast === 'buff' || spec.cast === 'summon') return d < 120;
          if (spec.cast === 'melee' || spec.cast === 'nova' || spec.aim === 'self') return d < Math.max(spec.area, 18) + target!.r + 6;
          if (spec.cast === 'dash') return d > 30 && d < spec.range;
          return d < Math.max(60, spec.range * 0.9);
        };
        if (reach('basic')) f.holdBasic = { slot: 'basic', angle: a, dist: null, assist: 0 };
        // the ultimate first: a skill that is always ready would otherwise keep it waiting
        if (p.ult >= 100 && d < 90) f.casts.push({ slot: 'ult', angle: a, dist: null, assist: 0 });
        // the big skills first (the longest cooldown), as a player would: a quick one is always ready
        // again, and would otherwise keep the specialization's skill waiting; channels (which hold
        // everything else back while they last) only when nothing else is ready
        const cd = (slot: SlotKey): number => {
          const spec = w.build.skills[w.build.bar[slot] ?? '']?.spec;
          return !spec ? 0 : spec.cast === 'channel' || spec.cast === 'drain' ? -1 : spec.cooldown;
        };
        for (const slot of [...SKILL_SLOTS].sort((x, y) => cd(y) - cd(x))) if (p.cds[slot].charges > 0 && reach(slot)) f.casts.push({ slot, angle: a, dist: null, assist: 0 });
      }
      if (p.hp < p.maxHp * 0.4 && w.hero.potions > 0) f.potion = true;
    }
    w.input = f;
    if (o.trace && Math.round(res.time * 60) % 30 === 0) o.trace(w, JSON.stringify({ t: res.time.toFixed(1), p: [(w.player.x / TILE).toFixed(1), (w.player.y / TILE).toFixed(1)], m: [f.mx.toFixed(2), f.my.toFixed(2)], tg: target ? [target.def.id, (target.x / TILE).toFixed(1), (target.y / TILE).toFixed(1)] : null, st: w.player.statuses.map((x) => x.id), busy: [!!w.player.windup, !!w.player.dash, !!w.player.channel], casts: f.casts.map((c) => c.slot) }));
    w.step(DT);
    res.time += DT;
    for (const ev of w.events) {
      if (ev.t === 'sfx' || ev.t === 'shake') continue;
      res.events.push(ev);
      if (ev.t === 'death') res.deaths += 1;
      if (ev.t === 'bossStart') bossStart[ev.boss] = res.time;
      if (ev.t === 'bossDown') {
        res.bossesDown.push(ev.boss);
        res.bossTimes[ev.boss] = Math.round(res.time - (bossStart[ev.boss] ?? res.time));
      }
    }
    w.events.length = 0;
    if (!w.player.dead) res.lowest = Math.min(res.lowest, w.player.hp / w.player.maxHp);
    const bad = brokenNumbers(w);
    if (bad) throw new Error(`not a number after ${res.time.toFixed(2)} s: ${bad}`);
    // stuck: neither moving nor hurting anything for 20 s while something is left to do
    // (a ward counts: wearing it down is progress too)
    const hpNow = w.enemies.reduce((a, e) => a + (e.dead || e.dummy ? 0 : e.hp + e.shield), 0);
    const progress = Math.hypot(w.player.x - lastMove.x, w.player.y - lastMove.y) > 24 || hpNow < foeHp - 0.5;
    foeHp = hpNow;
    if (progress) lastMove = { x: w.player.x, y: w.player.y, t: res.time };
    else if (res.time - lastMove.t > 20 && (target || goalPt)) {
      res.stuck = true;
      break;
    }
  }
  res.kills = w.run.kills;
  return res;
}
