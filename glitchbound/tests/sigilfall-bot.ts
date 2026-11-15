/**
 * A simple play-bot for Sigilfall's simulation: it walks to the nearest enemy along the map, keeps a
 * class-appropriate distance, fires everything that is ready, drinks potions, and steps out of (or
 * dodges) enemy telegraphs, and in melee out of the ground that hurts. It is not clever, which is the point: if it can clear a region and beat
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
import { bossHidden } from '../src/games/sigilfall/sim/boss';
import { empowerFull, empowerOf } from '../src/games/sigilfall/sim/combat';
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
/**
 * How many falls a dungeon may cost and still count as cleared: the campaign is meant to be hard (sim/world.ts
 * challenge), and a player dies and goes again from the last checkpoint; what must hold is that it can be done. Twelve
 * since the owner asked for a game that is "hard af" (2026-11-15: "adjust your tests, we want a challenging game not a
 * breezy one"): a boss's blow takes a third of a hero's health now, and this bot steps out of what it sees coming but
 * plays a caster badly (it walks out of its own long casts), so its mage and druid fall in the last dungeons where a
 * player would not. Before that change it cleared nearly every dungeon without a fall.
 */
export const HARD_DEATHS = 12;

/**
 * The gear a player has on by a dungeon's level, on a hard campaign: what drops in the lands before it (blue past
 * the middle of the story, purple at its end), not the green of a hero who skipped them.
 */
export const gearAt = (level: number): 'uncommon' | 'rare' | 'epic' => (level >= 52 ? 'epic' : level >= 28 ? 'rare' : 'uncommon');

export function clearsWithRetry(run: (seed: number) => { w: World; r: BotResult }, deaths = HARD_DEATHS): { w: World; r: BotResult } {
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
  // walking to a goal into something the map's paths don't know (a prop's body): a second of that, and it
  // slides along it for a moment, one way and then the other
  let blockedT = 0;
  let nowhere = { x: w.player.x, y: w.player.y, t: 0, foes: Infinity, x0: w.player.x, y0: w.player.y, len: 1.2 };
  let slideT = 0;
  let slide = 1;
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
          // (a boss gone from sight, hiding in a coffin or torn into shards, is no target: a player goes for what is there)
          if (e.dead || e.dummy || e.hp <= 0 || bossHidden(e) || (leftAlone.get(e.id) ?? 0) > res.time) continue;
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
      // (of two at once, the one about to land: a player steps out of the blow that's coming, then the next)
      let danger: (typeof w.telegraphs)[number] | undefined;
      for (const t of w.telegraphs) if (t.tone !== 'player' && (t.kind ?? 'danger') === 'danger' && !t.dead && inside(t, p.x, p.y, p.r) && (!danger || t.dur - t.t < danger.dur - danger.t)) danger = t;
      // and, in melee, out of ground that hurts (a pool of bile under the boss, a patch of fire), as a player would, rather
      // than trade blows in it (a caster keeps its distance anyway, and walking breaks its casts)
      const burning = danger || !isMelee() ? undefined : w.fields.find((fd) => fd.hostile && fd.dmg > 0 && fd.t > 0 && Math.hypot(p.x - fd.x, p.y - fd.y) < fd.r + p.r * 0.5);
      let mx = 0;
      let my = 0;
      if (burning) {
        const ax = p.x - burning.x;
        const ay = p.y - burning.y;
        const l = Math.hypot(ax, ay) || 1;
        mx = ax / l;
        my = ay / l;
      } else if (danger) {
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
          // (walking dead-on into a trunk on the way to a foe, the hero stands against it: a step to the side, as on
          // the way to a room)
          if (slideT > 0) {
            slideT -= DT;
            const ax = mx;
            mx = -my * slide;
            my = ax * slide;
          }
        } else if (!melee && d < keep * 0.6) {
          mx = (p.x - target.x) / d;
          my = (p.y - target.y) / d;
        }
      } else if (goalPt) {
        let step = flowStep(w.map, toTarget, p.x, p.y);
        // standing on a tile the map counts as taken (beside a crate, inside its tile but clear of its body): no path
        // starts there, so first a step onto the nearest open tile, as a player would just walk off
        const here = tileOf(w, p.x, p.y);
        if (!step && w.map.solid[here]) {
          const tx = here % w.map.w;
          const ty = Math.floor(here / w.map.w);
          let best: { x: number; y: number } | null = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
            const i = (ty + dy) * w.map.w + tx + dx;
            if (w.map.solid[i] || (toTarget[i] ?? -1) < 0) continue;
            const x = (tx + dx + 0.5) * TILE;
            const y = (ty + dy + 0.5) * TILE;
            if (!best || Math.hypot(x - p.x, y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = { x, y };
          }
          if (best) {
            const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
            step = { x: (best.x - p.x) / d, y: (best.y - p.y) / d };
          }
        }
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
        if (slideT > 0) {
          slideT -= DT;
          const ax = mx;
          mx = -my * slide;
          my = ax * slide;
        }
      }
      // a spell being cast: stand still for it, as a player would (unless something is about to land)
      if (p.casting && !danger) {
        mx = 0;
        my = 0;
      }
      f.mx = mx;
      f.my = my;
      if (target && !p.casting) {
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
        // a spell with a cast time means standing still: not while badly hurt (a player would get clear first)
        // (a spell a proc has made instant has no cast to stand through: a player casts it hurt or not)
        const castTime = (slot: SlotKey): number => {
          const id = w.build.bar[slot] ?? '';
          const emp = empowerOf(w, id);
          return emp?.def.empower?.instant && empowerFull(emp) ? 0 : (w.build.skills[id]?.spec.castTime ?? 0);
        };
        const standOk = (slot: SlotKey): boolean => castTime(slot) <= 0 || p.hp > p.maxHp * 0.5;
        // the ultimate first: a skill that is always ready would otherwise keep it waiting
        if (p.ult >= 100 && d < 90 && standOk('ult')) f.casts.push({ slot: 'ult', angle: a, dist: null, assist: 0 });
        // the big skills first (the longest cooldown), as a player would: a quick one is always ready
        // again, and would otherwise keep the specialization's skill waiting; channels (which hold
        // everything else back while they last) only when nothing else is ready
        const cd = (slot: SlotKey): number => {
          const spec = w.build.skills[w.build.bar[slot] ?? '']?.spec;
          return !spec ? 0 : spec.cast === 'channel' || spec.cast === 'drain' ? -1 : spec.cooldown;
        };
        for (const slot of [...SKILL_SLOTS].sort((x, y) => cd(y) - cd(x))) if (p.cds[slot].charges > 0 && reach(slot) && standOk(slot)) f.casts.push({ slot, angle: a, dist: null, assist: 0 });
        // a spell with a cast time is cast standing: the bot stops for it (moving would stop the cast)
        if (!danger && f.casts.some((c) => castTime(c.slot) > 0)) {
          f.mx = 0;
          f.my = 0;
        }
      }
      // a boss's order to the hero (Hallvor's watch), read off the screen as a player would: told to hold, not a
      // step (no dodge, no dash, no blink); told to walk the round, never still (and no spell that needs standing)
      const order = w.order;
      if (order && w.time >= order.from - 0.05 && w.time < order.until) {
        const spec = (slot: SlotKey) => w.build.skills[w.build.bar[slot] ?? '']?.spec;
        if (order.kind === 'hold') {
          f.mx = 0;
          f.my = 0;
          f.casts = f.casts.filter((c) => c.slot !== 'dodge' && spec(c.slot)?.cast !== 'dash' && spec(c.slot)?.cast !== 'blink');
        } else {
          f.casts = f.casts.filter((c) => (spec(c.slot)?.castTime ?? 0) <= 0);
          if (Math.hypot(f.mx, f.my) < 0.5) {
            // round and round what it fights
            const a = Math.atan2(p.y - (target?.y ?? p.y), p.x - (target?.x ?? p.x - 1)) + Math.PI / 2;
            f.mx = Math.cos(a);
            f.my = Math.sin(a);
          }
        }
      }
      // turned around by grief (it says so over the hero): the bot steers the other way, as a player learns to
      if (w.inverted > 0) {
        f.mx = -f.mx;
        f.my = -f.my;
      }
      if (p.hp < p.maxHp * 0.4 && w.hero.potions > 0) f.potion = true;
    }
    w.input = f;
    if (o.trace && Math.round(res.time * 60) % 30 === 0) o.trace(w, JSON.stringify({ t: res.time.toFixed(1), p: [(w.player.x / TILE).toFixed(1), (w.player.y / TILE).toFixed(1)], m: [f.mx.toFixed(2), f.my.toFixed(2)], tg: target ? [target.def.id, (target.x / TILE).toFixed(1), (target.y / TILE).toFixed(1)] : null, st: w.player.statuses.map((x) => x.id), busy: [!!w.player.windup, !!w.player.dash, !!w.player.channel, !!w.player.casting], casts: f.casts.map((c) => c.slot) }));
    const was = { x: w.player.x, y: w.player.y };
    w.step(DT);
    if (!w.player.dead && Math.hypot(f.mx, f.my) > 0.5 && Math.hypot(w.player.x - was.x, w.player.y - was.y) < 0.05) blockedT += DT;
    else blockedT = 0;
    if (blockedT > 1) {
      blockedT = 0;
      slideT = 0.6;
      slide = -slide;
    }
    // going nowhere and hurting nothing, though not stopped dead: stepping to and fro at a gap in the undergrowth that
    // the way to a far foe runs through and a hero's shoulders don't fit (the check above, for a hero stopped still,
    // never sees it). A player gives that foe up and goes round; so does the bot: that foe is left alone a while, or,
    // with none, it walks round the other way.
    const foesNow = w.enemies.reduce((a, e) => a + (e.dead || e.dummy ? 0 : e.hp + e.shield), 0);
    if (Math.hypot(w.player.x - nowhere.x0, w.player.y - nowhere.y0) > 70) nowhere = { ...nowhere, x0: w.player.x, y0: w.player.y, len: 1.2 };
    if (w.player.dead || w.scene || foesNow < nowhere.foes - 0.5 || Math.hypot(w.player.x - nowhere.x, w.player.y - nowhere.y) > 20) nowhere = { ...nowhere, x: w.player.x, y: w.player.y, t: res.time, foes: foesNow };
    else if (res.time - nowhere.t > 5 && Math.hypot(f.mx, f.my) > 0.5 && slideT <= 0) {
      // (the way the map gives can run between two bushes that stand too close for a hero's shoulders: so round, the
      // other way each time and further, until it is somewhere else; and a foe that way is left for later)
      nowhere.t = res.time;
      slideT = nowhere.len;
      slide = -slide;
      nowhere.len = Math.min(5, nowhere.len * 1.6);
      if (target) {
        leftAlone.set(target.id, res.time + 6);
        target = null;
        think = 0;
      }
    }
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
    // (nor is watching a scene being stuck: the hero stands still for as long as it plays, and a scene left unread
    // takes its time)
    if (progress || w.scene) lastMove = { x: w.player.x, y: w.player.y, t: res.time };
    else if (res.time - lastMove.t > 20 && (target || goalPt)) {
      res.stuck = true;
      break;
    }
  }
  res.kills = w.run.kills;
  return res;
}
