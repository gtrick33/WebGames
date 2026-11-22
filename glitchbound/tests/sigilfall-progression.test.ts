import { describe, expect, it } from 'vitest';
import { CLASS_IDS, MAX_LEVEL, xpToNext } from '../src/games/sigilfall/data/classes';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { mainStory, outlevelled, questBand, SIDE_XP } from '../src/games/sigilfall/data/progression';
import { QUESTS, QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { QuestDef, RegionId } from '../src/games/sigilfall/data/types';
import { ZONES } from '../src/games/sigilfall/data/zones';
import { addXp, levelGated, newCharacter, respecCost, startQuests, trackedQuest } from '../src/games/sigilfall/progress/character';
import { meanwhile } from '../src/games/sigilfall/progress/waiting';
import { objectiveRegion, questSteps } from '../src/games/sigilfall/progress/handin';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { migrate } from '../src/games/sigilfall/progress/save';
import { ultFloor } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';

/**
 * The progression rebalance (PROGRESSION_BALANCE.md Part 2): the campaign model for XP (a main-story-only
 * hero enters every region at its floor; a completionist stays inside each region's band), the ultimate's
 * pace in sustained combat, and the respec price.
 */

const NPC_REGION: Record<string, RegionId> = Object.fromEntries(ZONES.flatMap((z) => Object.keys(z.npcs).map((id) => [id, z.region.id] as const)));
const band = (q: QuestDef): RegionId => questBand(q, QUEST_DEFS, REGIONS, NPC_REGION, EVENTS);
const floor = (r: RegionId): number => REGIONS[r]!.levels[0];

/**
 * Plays the campaign on paper: quests in the order they open (lowest band first), about six kills on the
 * way to each (or what its objective asks), XP as the game pays it (rewards already rebalanced, falloff
 * for content the hero has out-grown). Returns the hero's level on first reaching each band.
 */
function campaign(full: boolean, stalls?: { quest: string; at: number; needs: number }[]): Record<string, number> {
  const main = mainStory(QUEST_DEFS);
  const list = QUESTS.filter((q) => full || main.has(q.id));
  const ids = new Set(list.map((q) => q.id));
  const done = new Set<string>();
  let level = 1;
  let xp = 0;
  const add = (n: number): void => {
    xp += n;
    // the level cap holds in the game, so it holds here
    while (level < MAX_LEVEL && xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level++;
    }
  };
  const entry: Record<string, number> = {};
  while (done.size < list.length) {
    const open = list.filter((q) => !done.has(q.id) && (q.after ?? []).every((a) => done.has(a) || !ids.has(a)));
    // what the hero is level for (a quest with a level waits for it, and nobody goes to a land far above
    // them while there is something nearer to do), lowest band first
    const fit = open.filter((q) => (!q.level || q.level <= level) && floor(band(q)) <= level + 1);
    // nothing the hero is level for: they wait on the lowest gate (and the model takes it all the same)
    if (!fit.length && stalls) {
      const g = open.filter((x) => x.level && x.level > level).sort((a, b) => a.level! - b.level!)[0];
      if (g) stalls.push({ quest: g.id, at: level + xp / xpToNext(level), needs: g.level! });
    }
    const ready = (fit.length ? fit : open).sort((a, b) => floor(band(a)) - floor(band(b)) || (a.level ?? 0) - (b.level ?? 0));
    const q = ready[0];
    if (!q) break;
    done.add(q.id);
    const b = band(q);
    const R = REGIONS[b]!;
    // a gate quest with its own level (Heroic, Mythic) doesn't mark the hero arriving in the band
    if (!(q.level && q.level > R.levels[1])) entry[b] ??= level >= MAX_LEVEL ? MAX_LEVEL : level + xp / xpToNext(level);
    const mid = Math.round((R.levels[0] + R.levels[1]) / 2);
    const o = q.objective;
    const kills = o.kind === 'kill' ? o.count : o.kind === 'loot' ? Math.ceil(o.count / o.chance) : 6;
    add(kills * 11 * (1 + 0.15 * (mid - 1)) * 0.5 * outlevelled(level, mid, 2));
    add(q.reward.xp * outlevelled(level, q.xpLevel ?? level, 1));
  }
  return entry;
}

describe('Sigilfall: progression', () => {
  it('a hero who plays only the main story enters every region at its floor (±1)', () => {
    const entry = campaign(false);
    const bands = Object.keys(entry).filter((b) => b !== 'whisperwood');
    expect(bands.length).toBeGreaterThan(12);
    for (const b of bands) expect(Math.abs(entry[b]! - floor(b as RegionId) - 0.5), `${b}: L${entry[b]!.toFixed(1)} for floor ${floor(b as RegionId)}`).toBeLessThanOrEqual(1.5);
  });

  it('a hero who does everything stays inside each region’s band', () => {
    const entry = campaign(true);
    for (const [b, lv] of Object.entries(entry)) {
      if (b === 'whisperwood') continue;
      const [lo, hi] = REGIONS[b as RegionId]!.levels;
      expect(lv, `${b}: L${lv.toFixed(1)} for ${lo}-${hi}`).toBeLessThanOrEqual(hi);
    }
  });

  it('a hero who does everything never has to wait on a quest’s level with nothing else to do', () => {
    // (the gates of the Barrows, the Sunscorch, the Glimmerwood and Rimeheld were up to two levels above what every
    // quest there pays: the only way on was to hunt. A quarter of a level is a few packs on the way.)
    const stalls: { quest: string; at: number; needs: number }[] = [];
    campaign(true, stalls);
    for (const s of stalls) expect(s.needs - s.at, `${s.quest} waits for ${s.needs} at L${s.at.toFixed(2)}`).toBeLessThanOrEqual(0.3);
  });

  it('side quests pay less than they used to; out-grown content pays less still', () => {
    expect(SIDE_XP).toBeLessThan(1);
    expect(outlevelled(30, 30, 1)).toBe(1);
    expect(outlevelled(30, 20, 1)).toBeCloseTo(0.2);
    expect(outlevelled(30, 27, 2)).toBeCloseTo(0.8);
  });

  it('the ultimate takes 40 s a bar at level 3, 60 s at 30 and 70 s from 50', () => {
    // (two thirds slower since the combat rebalance, the owner: "it seems the ultimate fills fast as heck")
    expect(ultFloor(3)).toBeCloseTo(40);
    expect(ultFloor(30)).toBeCloseTo(60);
    expect(ultFloor(50)).toBeCloseTo(70);
    expect(ultFloor(60)).toBeCloseTo(70);
  });

  it('two minutes of hard fighting earn every class one to three ultimates', { timeout: 30_000 }, () => {
    const counts: Record<string, number> = {};
    for (const cls of CLASS_IDS) {
      const w = newWorld('whisperwood', readyHero(cls, 30));
      // a crowd of tough foes around the hero, who is kept on their feet
      for (const e of w.enemies) e.dead = true;
      for (let i = 0; i < 6; i++) {
        const e = w.addEnemy('moss-slime', w.player.x + Math.cos(i) * 40, w.player.y + Math.sin(i) * 40, 30, { room: -1, pack: -1 });
        e.hp = e.maxHp = 1e8;
        e.aggro = true;
      }
      let casts = 0;
      let prev = w.player.ult;
      for (let i = 0; i < 240; i++) {
        play(w, { seconds: 0.5, done: () => false });
        w.player.hp = w.player.maxHp;
        w.player.dead = false;
        // a cast empties the bar (the fill may cross 100 and fire within the same half second)
        if (w.player.ult < prev - 40) casts++;
        prev = w.player.ult;
      }
      counts[cls] = casts;
    }
    for (const [cls, casts] of Object.entries(counts)) {
      expect(casts, `${cls}: ${JSON.stringify(counts)}`).toBeGreaterThanOrEqual(1);
      expect(casts, `${cls}: ${JSON.stringify(counts)}`).toBeLessThanOrEqual(3);
    }
  });

  it('respec is free below 20, then level × 10 gold up to 400, and owed once after the rebalance', () => {
    const c = readyHero('mage', 15);
    expect(respecCost(c)).toBe(0);
    c.level = 30;
    expect(respecCost(c)).toBe(300);
    c.level = 55;
    expect(respecCost(c)).toBe(400);
    const save = migrate({ v: 6, heroes: [{ cls: 'mage', level: 30, quests: {}, talents: { 'mage-a1': 1 } }], last: 0 })!;
    expect((save.heroes[0] as { freeRespec?: boolean }).freeRespec).toBe(true);
  });
});

describe('Sigilfall: while the story waits for a level', () => {
  it('the tracker suggests a side quest, never the first crypt again on Heroic', () => {
    // a hero whose story waits on Hearthstead's riders: every main quest before it done, a side quest on offer
    const c = newCharacter('mage', 'W', 'w', 0);
    const main = mainStory(QUEST_DEFS);
    const gate = QUEST_DEFS['hearth-the-riders-come']!;
    const before = new Set<string>();
    const walk = (id: string): void => {
      if (before.has(id)) return;
      before.add(id);
      for (const a of QUEST_DEFS[id]?.after ?? []) walk(a);
    };
    for (const a of gate.after ?? []) walk(a);
    for (const id of before) c.quests[id] = { state: 'done', n: 1 };
    while (c.level < gate.level! - 1) addXp(c, xpToNext(c.level));
    for (const id of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(id)) c.unlocked.push(id);
    startQuests(c);
    expect(levelGated(c).some((q) => main.has(q.id))).toBe(true);
    const m = meanwhile(c);
    expect(m, 'something to do').not.toBeNull();
    expect(main.has(m!.q.id)).toBe(false);
    // taken, it is what the tracker follows, before the replay
    c.quests[m!.q.id] = { state: 'active', n: 0 };
    expect(trackedQuest(c)?.id).toBe(m!.q.id);
  });
});

describe('Sigilfall: a quest never sends a hero to a door they can’t open', () => {
  it('every land a quest sends a hero into lets them in at the quest’s level', () => {
    // the least level of each way into a land (the roads and dungeon doors that say "Too dangerous before level N")
    const door = new Map<string, number>();
    for (const r of Object.values(REGIONS)) {
      let m;
      try {
        m = parseRegion(r);
      } catch {
        continue;
      }
      for (const pm of m.markers) {
        const k = pm.marker as { kind: string; to?: string; minLevel?: number };
        if (k.kind === 'exit' && k.to && k.minLevel) door.set(k.to, Math.min(door.get(k.to) ?? Infinity, k.minLevel));
      }
    }
    for (const q of QUESTS) {
      if (!q.level) continue;
      for (const o of questSteps(q)) {
        const where = objectiveRegion(q, o);
        const min = where ? door.get(where) : undefined;
        if (min !== undefined) expect(min, `${q.id} opens at ${q.level}, but ${where} is shut before ${min}`).toBeLessThanOrEqual(q.level);
      }
    }
  });
});

describe('Sigilfall: inside the dungeon a quest sent the hero to clear', () => {
  it('the arrow leads through its rooms, not back out to the story', () => {
    // (a quest whose work is in the crypt, its boss: the crypt's Heroic clear was the one, gone with Heroic, 2026-11-22)
    const inside = QUESTS.find((q) => q.objective.kind === 'boss' && objectiveRegion(q, q.objective) === 'crypt')!;
    expect(inside, 'a quest at the crypt').toBeDefined();
    const h = readyHero('warrior', 30);
    h.quests[inside.id] = { state: 'active', n: 0 };
    // a story quest elsewhere, which would otherwise come first
    const story = QUESTS.find((q) => mainStory(QUEST_DEFS).has(q.id) && q.objective.kind === 'talk' && q.id !== inside.id)!;
    h.quests[story.id] = { state: 'active', n: 0 };
    const w = newWorld('crypt', h, 1, 0);
    expect(objectiveTarget(w)?.quest).toBe(inside.id);
  });
});
