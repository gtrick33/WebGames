import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTS } from '../src/games/sigilfall/data/acts';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { isMainQuest } from '../src/games/sigilfall/progress/handin';
import { questState } from '../src/games/sigilfall/progress/character';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { heroAtEvent, newWorld, readyHero } from './sigilfall-bot';

/**
 * The tale told like a film (the owner, 2026-10-29: "we want cinematics and epicness on every single quest"):
 * each act opens with its title, in the story's order; a boss's last blow and the last foe of a story fight
 * fall in slow motion, the camera on them; and none of it in a co-op party, whose worlds keep one pace.
 */

const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.player.hp = w.player.maxHp;
    w.step(DT);
  }
};

/** Every quest a quest comes after, all the way back. */
function before(id: string, seen = new Set<string>()): Set<string> {
  for (const a of QUEST_DEFS[id]?.after ?? []) {
    if (seen.has(a)) continue;
    seen.add(a);
    before(a, seen);
  }
  return seen;
}

describe('Sigilfall: cinematics', () => {
  it('every act opens with a main-story quest, each after the one before it', () => {
    expect(ACTS.map((a) => a.over)).toEqual(['Prologue', 'Act I', 'Act II', 'Act III', 'Act IV', 'Act V', 'Act VI', 'The Finale', 'Epilogue']);
    for (const [i, act] of ACTS.entries()) {
      expect(QUEST_DEFS[act.opens], act.id).toBeDefined();
      expect(isMainQuest(act.opens), act.id).toBe(true);
      if (i > 0) expect(before(act.opens).has(ACTS[i - 1]!.opens), `${act.id} comes after ${ACTS[i - 1]!.id}`).toBe(true);
    }
  });

  it('a boss’s last blow falls in slow motion, the camera on it; then time runs on', () => {
    const w = newWorld('crypt', readyHero('warrior', 12));
    w.enemies = w.enemies.filter((e) => e.room < 0);
    const enc = w.encounters.find((e) => e.def.boss)!;
    const room = w.map.roomTiles[enc.index]!;
    const i = room[Math.floor(room.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    run(w, 0.5);
    const boss = w.boss()!;
    expect(boss).toBeTruthy();
    hitEnemy(w, boss, 1e9, 'physical', { depth: 0 });
    expect(w.slowT).toBeGreaterThan(1);
    expect(w.slowAt).toEqual({ x: boss.x, y: boss.y });
    const t0 = w.time;
    run(w, 1);
    // (a second of the screen is well under half a second of the world)
    expect(w.time - t0).toBeLessThan(0.5);
    run(w, 1);
    expect(w.slowT).toBeLessThanOrEqual(0);
    expect(w.slowAt).toBeNull();
    const t1 = w.time;
    run(w, 1);
    expect(w.time - t1).toBeCloseTo(1, 1);
  });

  it('the last foe of a story fight falls in slow motion, once', () => {
    const ev = EVENTS['mill-the-mill']!;
    const c = heroAtEvent(ev.id);
    const w = newWorld(ev.region, c);
    w.enemies = [];
    const at = w.places[ev.at]!;
    w.player.x = at.x;
    w.player.y = at.y + 8;
    let slowed = 0;
    let was = 0;
    for (let f = 0; f < 120 / DT && questState(c, 'mill-the-bridge') === 'active' && (c.quests['mill-the-bridge']?.step ?? 0) === 0; f++) {
      if (f % 60 === 30) for (const e of w.enemies) if (!e.dead && !e.held && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
      run(w, DT);
      if (w.slowT > was) slowed++;
      was = w.slowT;
    }
    // (the fight is over when the quest goes on to its next step, the barricade to burn: the fight is what is watched here)
    expect(c.quests['mill-the-bridge']?.step ?? 0).toBeGreaterThan(0);
    expect(slowed).toBe(1);
  });

  it('never in a co-op party', () => {
    const w = newWorld('whisperwood', readyHero('mage', 8));
    w.coop = { role: 'host', ghosts: [], out: [] };
    w.slowmo(2, { x: 0, y: 0 });
    expect(w.slowT).toBe(0);
  });
});

describe('Sigilfall: a scene is a clean picture', () => {
  it("touch's marks at the hero are not drawn in a scene: the ring round a tap's enemy came out a wide yellow band", () => {
    // (a scene's camera can look far from the hero, and a mark laid on the ground near where the camera stands is
    // blown up dozens of times: the owner's iPhone, 2026-11-27)
    const src = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');
    expect(src).toContain('if (!w.scene) {\n      this.drawAim(w);\n      this.drawFacing(w, time);\n    }');
    expect(src.match(/this\.drawFacing\(/g)).toHaveLength(1);
    expect(src.match(/this\.drawAim\(/g)).toHaveLength(1);
  });
});
