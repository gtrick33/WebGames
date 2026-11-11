import { describe, expect, it } from 'vitest';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { acceptQuest, activeQuests, currentObjective, handInQuest, handInsFor, HOME, newCharacter, offeredBy, questState, readyQuests, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { flowField, flowStep, TILE } from '../src/games/sigilfall/sim/map';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';
import { nextRegion, npcRegion, spotRegion } from '../src/games/sigilfall/sim/routes';
import { World } from '../src/games/sigilfall/sim/world';

/**
 * The whole campaign from a new save, played the way a person would find it: the hero goes where the quest
 * arrow points (through the same roads and doors), takes what the "!" givers offer, and fights what the
 * story sends. The hero cannot die and strikes hard (balance is the other tests' job); what this checks is
 * that no quest of the story or the side roads leaves the hero without a way on.
 */

const DT = 1 / 60;

interface Walk {
  hero: Character;
  w: World;
  /** Quests the arrow had nothing for, with where the hero was. */
  lost: string[];
  /** Roads barred for a reason other than the story's order, and how they were passed. */
  barred: string[];
  travels: number;
  /** The last roads taken, for the report. */
  trail: string[];
  /** Beats in a row the arrow had nothing. */
  blank: number;
  /** Story that waited in a land nothing pointed to. */
  deadEnds: string[];
  /** A far point the hero roams to while a den is empty. */
  roam?: { x: number; y: number; n: number };
}

function enter(walk: Walk, to: RegionId, from?: RegionId, tier = 0): void {
  const h = walk.hero;
  // what lies on the ground goes with the hero (the engine's collectLeftovers)
  walk.w?.collectAll();
  if (!h.unlocked.includes(to)) h.unlocked.push(to);
  walk.w = new World({ region: to, tier, mods: [], hero: h, settings: { ...DEFAULT_SETTINGS }, seed: 1 + walk.travels, ...(from ? { from } : {}) });
  walk.travels++;
  walk.trail.push(`${from ?? '-'}→${to} [${activeQuests(h).map((q) => q.id).join(',')}]`);
  if (walk.trail.length > 12) walk.trail.shift();
  startQuests(h);
}

function talk(walk: Walk, npc: string): void {
  const h = walk.hero;
  // as the engine's talk: the talk itself, then the pages: Complete on every hand-in, Accept on every offer
  walk.w.questProgress((o) => o.kind === 'talk' && o.npc === npc);
  for (const q of handInsFor(h, npc)) if (handInQuest(h, q.id)) walk.w.completeQuests([q]);
  const taken = offeredBy(h, npc).flatMap((q) => acceptQuest(h, q.id) ?? []);
  if (taken.length) walk.w.creditEarly([...taken, ...startQuests(h)]);
}

/** Lands the hero onto a point, the way walking would: tile by tile down the flow field. */
function walkTo(w: World, x: number, y: number, far: number): void {
  const p = w.player;
  const f = flowField(w.map, Math.floor(x / TILE), Math.floor(y / TILE), 600);
  for (let i = 0; i < far / 8; i++) {
    if (Math.hypot(x - p.x, y - p.y) < 8) {
      p.x = x;
      p.y = y;
      return;
    }
    const s = flowStep(w.map, f, p.x, p.y);
    if (!s) {
      // no way there on foot: across the land the hero finds one, but never through a sealed room's door
      if (w.encounters.some((e) => e.state === 'active')) return;
      p.x = x;
      p.y = y;
      return;
    }
    p.x += s.x * 8;
    p.y += s.y * 8;
  }
}

/** How near a foe is for the hero to hit it. */
const REACH = 140;

function strike(w: World): void {
  const p = w.player;
  p.hp = p.maxHp;
  const near = [p, ...w.pets.filter((x) => !x.dead && x.story)];
  for (const e of w.enemies) {
    if (e.dead || e.dummy || e.state === 'spawn') continue;
    if (near.some((a) => Math.hypot(e.x - a.x, e.y - a.y) < REACH)) hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
  }
}

/** One beat of play: a quarter second, the hero moving where the game says. Returns false once nothing is left. */
function beat(walk: Walk): boolean {
  const { hero: h } = walk;
  let w = walk.w;
  // tutorials are the training yard's: their own tests play them
  for (const q of activeQuests(h)) {
    const o = currentObjective(h, q);
    if (o.kind === 'tutorial') w.questProgress((x) => x === o, o.count);
  }
  // whoever has a "!" here is talked to
  for (const n of w.npcs) if (offeredBy(h, n.id).length || handInsFor(h, n.id).length) {
    walkTo(w, n.x, n.y + 10, 4000);
    talk(walk, n.id);
  }
  const t = objectiveTarget(w);
  if (t) walk.blank = 0;
  if (!t && !w.story.run) {
    // (a quest waiting to be handed in counts: the arrow must lead to whoever takes it back)
    const active = [...activeQuests(h).filter((q) => currentObjective(h, q).kind !== 'tutorial'), ...readyQuests(h)];
    if (active.length) {
      // talk quests: standing beside the person is the objective
      const tq = active.map((q) => currentObjective(h, q)).find((o) => o.kind === 'talk' && w.npcs.some((n) => n.id === o.npc));
      if (tq && tq.kind === 'talk') {
        talk(walk, tq.npc);
        return true;
      }
      // a harder difficulty: the hero opens the map (any waystone) and picks it
      const hard = active.map((q) => currentObjective(h, q)).find((o) => o.kind === 'clear' && o.tier > w.tier && o.tier <= h.tier);
      if (hard && hard.kind === 'clear') {
        enter(walk, hard.region, undefined, hard.tier);
        return true;
      }
      // a secret the arrow never shows (the Hidden Grove): the hero goes by the giver's hint
      const secretStep = active.map((q) => currentObjective(h, q)).find((o) => o.kind === 'explore' && !spotRegion(o.spot));
      if (secretStep && secretStep.kind === 'explore') {
        const id = secretStep.spot;
        const where = REGION_IDS.find((r) => [...Object.values(REGIONS[r].markers), ...(REGIONS[r].holds ? [] : (REGIONS[r].placed ?? []).map((m) => m.marker))].some((m) => 'id' in m && m.id === id));
        if (where && where !== w.region.id) {
          enter(walk, where, undefined);
          return true;
        }
        const m = w.map.markers.find((x) => 'id' in x.marker && x.marker.id === id);
        if (m && walk.blank < 6) {
          walkTo(w, (m.tx + 0.5) * TILE, (m.ty + 0.5) * TILE, 8000);
          for (let i = 0; i < 30; i++) w.step(DT);
          walk.blank++;
          return true;
        }
      }
      // the world catches up with the story twice a second (a road that opens, a person who arrives)
      if (++walk.blank < 12) {
        for (let i = 0; i < 15; i++) w.step(DT);
        return true;
      }
      walk.lost.push(`${active.map((q) => q.id).join(',')} @${w.region.id}`);
      return false;
    }
    // nothing running: the next giver with something to offer
    const offer = QUESTS.find((q) => questState(h, q.id) === 'offered' && npcRegion(q.giver));
    if (!offer) {
      // the story waits in a land nothing points to: a dead end (noted), and the hero goes exploring
      const waiting = QUESTS.find((q) => questState(h, q.id) === 'locked' && q.zone && !h.unlocked.includes(q.zone) && (!q.level || h.level >= q.level) && (q.after ?? []).every((a) => questState(h, a) === 'done'));
      if (!waiting?.zone) return false;
      walk.deadEnds.push(`${waiting.id} waits in ${waiting.zone}, nothing leads there`);
      enter(walk, waiting.zone);
      return true;
    }
    const there = npcRegion(offer.giver)!;
    if (there === w.region.id) {
      const n = w.npcs.find((x) => x.id === offer.giver);
      if (!n) {
        walk.lost.push(`giver ${offer.giver} of ${offer.id} not standing in ${there}`);
        return false;
      }
      walkTo(w, n.x, n.y + 10, 4000);
      talk(walk, offer.giver);
      return true;
    }
    const next = nextRegion(w.region.id, there, (q) => questState(h, q) === 'done');
    const x = next ? w.exits.find((e) => e.to === next) : undefined;
    if (!x) {
      walk.lost.push(`no road from ${w.region.id} toward ${there} for ${offer.id}`);
      return false;
    }
    walkTo(w, x.x, x.y, 4000);
  } else if (t) {
    // a room fight under way: its foes, wherever in the room they are
    const fight = w.encounters.find((e) => e.state === 'active');
    const foe = fight && w.enemies.filter((e) => !e.dead && !e.dummy && e.state !== 'spawn' && (e.room === fight.index || e.aggro)).sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y))[0];
    if (foe && Math.hypot(foe.x - w.player.x, foe.y - w.player.y) > 100) walkTo(w, foe.x, foe.y, 60);
    // at a den with nothing in reach: the hero roams a while (packs come back out of sight; an archer standing
    // off past the hero's reach would otherwise keep it waiting there for good)
    if (t.soft && !w.story.run && Math.hypot(t.x - w.player.x, t.y - w.player.y) < 24 && !w.enemies.some((e) => !e.dead && Math.hypot(e.x - w.player.x, e.y - w.player.y) < REACH)) {
      walk.roam = walk.roam ?? { x: (w.rand() * w.map.w) | 0, y: (w.rand() * w.map.h) | 0, n: 40 };
    }
    if (foe) {
      // a room fight: the hero goes to its foes (above), not back to the arrow
    } else if (walk.roam && walk.roam.n-- > 0) walkTo(w, (walk.roam.x + 0.5) * TILE, (walk.roam.y + 0.5) * TILE, 60);
    else {
      walk.roam = undefined;
      walkTo(w, t.x, t.y, 60);
    }
    // at a waystone the arrow led to: the map, and the difficulty a quest wants
    const stone = w.waystones.find((s) => Math.hypot(s.x - w.player.x, s.y - w.player.y) < 30);
    const hardStep = activeQuests(h).map((q) => currentObjective(h, q)).find((o) => o.kind === 'clear' && o.tier > w.tier && o.tier <= h.tier);
    if (stone && hardStep && hardStep.kind === 'clear') {
      enter(walk, hardStep.region, undefined, hardStep.tier);
      return true;
    }
    // at the person the arrow points to: the hero talks
    const by = w.npcs.find((n) => Math.hypot(n.x - w.player.x, n.y - w.player.y) < 26 && (handInsFor(h, n.id).length > 0 || activeQuests(h).some((q) => { const o = currentObjective(h, q); return o.kind === 'talk' && o.npc === n.id; })));
    if (by) talk(walk, by.id);
  }
  // followers keep up (their own walking is the rescue tests')
  for (const f of w.pets) if (f.story && !f.dead && f.goal === undefined && Math.hypot(f.x - w.player.x, f.y - w.player.y) > 40) Object.assign(f, { x: w.player.x + 6, y: w.player.y + 4 });
  for (let i = 0; i < 15; i++) {
    strike(w);
    w.step(DT);
  }
  // the portal after a dungeon's last boss: the hero steps in (it takes the interact key)
  if (w.portal && Math.hypot(w.portal.x - w.player.x, w.portal.y - w.player.y) < 22) {
    enter(walk, HOME, w.region.id);
    return true;
  }
  if (w.pendingExit) {
    const ex = w.pendingExit;
    w.pendingExit = null;
    if (ex.kind === 'exit') {
      if (ex.locked) {
        const lv = /before level (\d+)/.exec(ex.locked);
        if (!lv) {
          // a road the arrow leads to that won't open: the hero would stand here for good
          if (objectiveTarget(w)?.x === ex.x && objectiveTarget(w)?.y === ex.y) {
            walk.lost.push(`${w.region.id}→${ex.to} is shut (${ex.locked}) but the arrow leads there for ${objectiveTarget(w)?.quest}`);
            return false;
          }
          return true;
        }
        // too young: the hero levels where they are (a person would hunt a while)
        walk.barred.push(`${w.region.id}→${ex.to} at level ${h.level} (wants ${lv[1]})`);
        while (h.level < Number(lv[1])) w.giveXp(1000);
        w.pendingExit = null;
        // (and steps back off the road's end: a road opens as you step onto it, as a person would step back on)
        const away = Math.hypot(w.map.w * TILE / 2 - w.player.x, w.map.h * TILE / 2 - w.player.y) || 1;
        w.player.x += ((w.map.w * TILE / 2 - w.player.x) / away) * TILE * 2;
        w.player.y += ((w.map.h * TILE / 2 - w.player.y) / away) * TILE * 2;
        return true;
      }
      enter(walk, ex.to as RegionId, w.region.id);
      w = walk.w;
    }
  }
  return true;
}

describe('Sigilfall: the whole campaign, by the quest arrow', () => {
  it('a new hero plays from the first night to the bell and every side road, never left without a way on', () => {
    const hero = newCharacter('warrior', 'Walker', 'walker', 0);
    const walk: Walk = { hero, w: null as unknown as World, lost: [], barred: [], travels: 0, trail: [], blank: 0, deadEnds: [] };
    enter(walk, HOME);
    let beats = 0;
    while (beat(walk) && beats < 400000 && walk.travels < 3000) beats++;
    const open = QUESTS.filter((q) => questState(hero, q.id) !== 'done').map((q) => `${q.id}:${questState(hero, q.id)}`);
    // where it stopped, for the report: the land, what the arrow says, the fight under way
    const fw = walk.w;
    const at = (x: number, y: number): string => `${Math.round(x / TILE)},${Math.round(y / TILE)}`;
    const state = {
      region: fw.region.id,
      at: at(fw.player.x, fw.player.y),
      target: objectiveTarget(fw),
      active: activeQuests(hero).map((q) => q.id),
      event: fw.story.run && { id: fw.story.run.def.id, wave: fw.story.run.wave, foes: fw.story.run.ids.map((id) => fw.enemies.find((x) => x.id === id && !x.dead)).filter((e) => !!e).map((e) => `${e.def.id}@${at(e.x, e.y)}`) },
      rooms: fw.encounters.filter((e) => e.state === 'active').map((e) => `${e.index}: wave ${e.wave}, ${fw.enemies.filter((x) => !x.dead && x.room === e.index).map((x) => `${x.def.id}@${at(x.x, x.y)}`).join(' ')}`),
    };
    const ready = QUESTS.filter((q) => questState(hero, q.id) === 'locked' && (q.after ?? []).every((a) => questState(hero, a) === 'done')).map((q) => `${q.id}: ${q.zone && !hero.unlocked.includes(q.zone) ? `zone ${q.zone} unvisited` : ''}${q.level && hero.level < q.level ? ` level ${q.level}` : ''}`);
    const msg = JSON.stringify({ lost: walk.lost, deadEnds: walk.deadEnds, state, trail: walk.trail, beats, travels: walk.travels, level: hero.level, ready: ready.slice(0, 20), open: open.slice(0, 40), openCount: open.length }, null, 1);
    expect(walk.lost, msg).toEqual([]);
    expect(walk.deadEnds, msg).toEqual([]);
    expect(open, msg).toEqual([]);
  }, 300_000);
});
