import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/games/sigilfall/data/enemies";
import { EVENTS } from "../src/games/sigilfall/data/events";
import { PETS } from "../src/games/sigilfall/data/pets";
import { NPCS, QUEST_DEFS } from "../src/games/sigilfall/data/quests";
import { REGIONS } from "../src/games/sigilfall/data/regions";
import type { RegionId } from "../src/games/sigilfall/data/types";
import {
  questState,
  type Character,
} from "../src/games/sigilfall/progress/character";
import { migrate } from "../src/games/sigilfall/progress/save";
import { hitEnemy } from "../src/games/sigilfall/sim/combat";
import type { World } from "../src/games/sigilfall/sim/world";
import { newWorld, readyHero } from "./sigilfall-bot";

/**
 * Act I in the world (STORY_BIBLE.md §3, §4): each village of the Vale changes when it is saved, its
 * people walk into Briarhollow's camp, and the Defense of Hearthstead is played on the simulation.
 */

/** A hero with everything before `quest` done (along its `after` chain) and `quest` itself active. */
function heroAt(quest: string, level = 30): Character {
  const c = readyHero("mage", level);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: "done", n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS[quest]!.after ?? []) done(a);
  c.quests[quest] = { state: "active", n: 0 };
  for (const r of Object.keys(REGIONS) as RegionId[])
    if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

const DT = 1 / 60;
function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}
function goTo(w: World, place: string): void {
  const at = w.places[place] ?? w.spots.find((s) => s.id === place)!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}
function smite(w: World): void {
  for (const e of w.enemies)
    if (!e.dead && e.state !== "spawn")
      hitEnemy(w, e, 1e7, "physical", { depth: 0 });
}
/** Plays an event's waves to the end, striking each wave down as it comes. */
function beat(w: World, quest: string, rounds = 40): void {
  for (let i = 0; i < rounds && questState(w.hero, quest) === "active"; i++) {
    run(w, 2.5);
    smite(w);
  }
}

describe("Sigilfall: the Vale (Act I)", () => {
  it("every event names places, people and foes that exist, and a quest that plays it", () => {
    const asked = new Set(
      Object.values(QUEST_DEFS).flatMap((q) =>
        q.objective.kind === "event" ? [q.objective.event] : [],
      ),
    );
    for (const def of Object.values(EVENTS)) {
      expect(asked.has(def.id), def.id).toBe(true);
      const region = REGIONS[def.region];
      const named = new Set(
        region.placed!.flatMap((pm) =>
          pm.marker.kind === "place" || pm.marker.kind === "spot"
            ? [pm.marker.id]
            : [],
        ),
      );
      const places = [
        def.at,
        ...def.waves.flatMap((wv) => wv.from),
        def.ward?.at,
        def.rescue?.at,
        def.rescue?.to,
        def.arrive?.from,
        def.arrive?.to,
      ].filter((x): x is string => !!x);
      for (const p of places)
        expect(named.has(p), `${def.id}: ${p}`).toBe(true);
      for (const id of [
        ...(def.allies ?? []),
        def.ward?.pet,
        ...(def.rescue?.pets ?? []),
        ...(def.arrive?.pets ?? []),
      ].filter((x): x is string => !!x))
        expect(PETS[id], `${def.id}: ${id}`).toBeTruthy();
      for (const id of def.waves.flatMap((wv) => wv.enemies))
        expect(ENEMIES[id], `${def.id}: ${id}`).toBeTruthy();
      // whoever speaks is there: a companion of the event, or someone standing in the region
      const there = new Set([
        ...(def.allies ?? []),
        ...(def.rescue?.pets ?? []),
        ...(def.arrive?.pets ?? []),
        ...region.placed!.flatMap((pm) =>
          pm.marker.kind === "npc" ? [pm.marker.npc] : [],
        ),
      ]);
      for (const b of [
        ...(def.start ?? []),
        ...(def.end ?? []),
        ...(def.retry ?? []),
        ...def.waves.flatMap((wv) => wv.barks ?? []),
      ])
        expect(there.has(b.who), `${def.id}: ${b.who}`).toBe(true);
    }
    for (const q of Object.values(QUEST_DEFS))
      if (q.objective.kind === "event")
        expect(EVENTS[q.objective.event], q.id).toBeTruthy();
    // the camp's newcomers have something to say
    for (const id of [
      "ranger-cole",
      "carter-wenna",
      "healer-brisa",
      "forgewife-runa",
      "rider-alder",
      "nyx",
      "reed-agna",
      "reed-jory",
      "refugee-hale",
      "refugee-marit",
    ])
      expect(NPCS[id]?.talk.length, id).toBeGreaterThan(0);
  });

  it("Fernstead: the stones are fouled until held, then lit; the barrows go quiet after the Grey Lady", () => {
    const before = newWorld("brackenridge", heroAt("the-harvest-stones"));
    expect(before.wisps.length).toBeGreaterThan(0);
    const w = before;
    goTo(w, "fern-stones");
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe("fern-stones");
    expect(w.pets.some((p) => p.def.id === "harvest-stone")).toBe(true);
    beat(w, "the-harvest-stones");
    expect(questState(w.hero, "the-harvest-stones")).toBe("done");
    run(w, 0.6);
    expect(w.wisps).toHaveLength(0);
    expect(
      w.props.filter((p) => p.prop === "iron-torch").length,
    ).toBeGreaterThanOrEqual(2);
    // the Grey Lady at rest: nobody walks the barrows
    const quiet = heroAt("camp-scouts");
    const barrows = newWorld("brackenridge", quiet);
    const spot = barrows.spots.find((s) => s.id === "old-barrows")!;
    expect(
      barrows.enemies.filter(
        (e) => !e.dead && Math.hypot(e.x - spot.x, e.y - spot.y) < 8 * 16,
      ).length,
    ).toBe(0);
  });

  it("Millbrook: the gang holds the mill until the blockade is broken; then it burns", () => {
    const held = newWorld("thornvale", heroAt("mill-the-bridge"));
    const pond = held.spots.find((s) => s.id === "millers-pond")!;
    const near = (w: World): number =>
      w.enemies.filter(
        (e) => !e.dead && Math.hypot(e.x - pond.x, e.y - pond.y) < 7 * 16,
      ).length;
    expect(near(held)).toBeGreaterThan(0);
    goTo(held, "mill-pond");
    run(held, 0.3);
    expect(held.story.run?.def.id).toBe("mill-the-mill");
    expect(held.pets.some((p) => p.def.id === "sefa")).toBe(true);
    beat(held, "mill-the-bridge");
    expect(questState(held.hero, "mill-the-bridge")).toBe("done");
    run(held, 0.6);
    expect(held.storyState?.id).toBe("mill-burning");
    expect(held.fires.length).toBeGreaterThanOrEqual(2);
    // Nyx is in Millbrook only while she reads the cipher
    expect(
      newWorld("thornvale", heroAt("thieves-cant")).npcs.some(
        (n) => n.id === "nyx",
      ),
    ).toBe(true);
    expect(
      newWorld("thornvale", heroAt("hunt-black-bess")).npcs.some(
        (n) => n.id === "nyx",
      ),
    ).toBe(false);
  });

  it("Reedwater: the wells reek until Mire falls, and the abducted are led home across the marsh", () => {
    expect(
      newWorld("greyfen", heroAt("the-ghoul-mother")).wisps.length,
    ).toBeGreaterThan(0);
    const w = newWorld("greyfen", heroAt("reed-bring-them-home"));
    expect(w.wisps).toHaveLength(0);
    goTo(w, "reed-cage");
    run(w, 0.3);
    expect(w.pets.filter((p) => p.def.id === "reed-villager")).toHaveLength(3);
    beat(w, "reed-bring-them-home", 8);
    // home is far: walk there (the bot is not the point), and they keep up
    const home = w.places["reed-square"]!;
    for (
      let i = 0;
      i < 40 && questState(w.hero, "reed-bring-them-home") === "active";
      i++
    ) {
      const dx = home.x - w.player.x;
      const dy = home.y - w.player.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, 60);
      if (d > 4) {
        w.player.x += (dx / d) * step;
        w.player.y += (dy / d) * step;
      }
      for (const f of w.pets)
        if (f.def.id === "reed-villager")
          Object.assign(f, { x: w.player.x + 6, y: w.player.y + 4 });
      run(w, 0.5);
      smite(w);
    }
    expect(questState(w.hero, "reed-bring-them-home")).toBe("done");
    expect(questState(w.hero, "camp-healers")).toBe("active");
    run(w, 0.6);
    expect(w.npcs.some((n) => n.id === "reed-agna")).toBe(true);
  });

  it("the camp: people walk in from the road, settle, and stay", () => {
    const w = newWorld("briarhollow", heroAt("camp-scouts"));
    goTo(w, "briar-square");
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe("camp-scouts");
    // an arrival is no fight: the village stays safe
    expect(w.safe).toBe(true);
    const rangers = w.pets.filter((p) => p.def.id === "fern-ranger");
    expect(rangers).toHaveLength(3);
    const watch = w.places["briar-watchfire"]!;
    const d0 = Math.hypot(rangers[0]!.x - watch.x, rangers[0]!.y - watch.y);
    run(w, 8);
    expect(
      Math.hypot(rangers[0]!.x - watch.x, rangers[0]!.y - watch.y),
    ).toBeLessThan(d0);
    run(w, 50);
    expect(questState(w.hero, "camp-scouts")).toBe("done");
    expect(w.story.run).toBeNull();
    // they became the camp's own people, without a puff of smoke
    expect(w.pets.some((p) => p.def.id === "fern-ranger")).toBe(false);
    expect(w.npcs.some((n) => n.id === "ranger-cole")).toBe(true);
    // everyone the Vale sends, in their places
    const all = heroAt("the-dwarves-plea");
    for (const id of [
      "camp-scouts",
      "camp-grain",
      "camp-healers",
      "camp-smiths",
      "camp-riders",
    ])
      all.quests[id] = { state: "done", n: 1 };
    const camp = newWorld("briarhollow", all);
    for (const id of [
      "ranger-cole",
      "carter-wenna",
      "healer-brisa",
      "forgewife-runa",
      "rider-alder",
    ])
      expect(
        camp.npcs.some((n) => n.id === id),
        id,
      ).toBe(true);
  });

  it("the Defense of Hearthstead: the raid, the wall, the ram, and the shrine found empty", () => {
    // the picket empties the day the hero finds it
    const scout = newWorld("amberfield", heroAt("the-legion-picket"));
    const picket = scout.spots.find((s) => s.id === "legion-picket")!;
    const guards = (w: World): number =>
      w.enemies.filter(
        (e) => !e.dead && Math.hypot(e.x - picket.x, e.y - picket.y) < 10 * 16,
      ).length;
    expect(guards(scout)).toBeGreaterThan(0);
    expect(
      guards(newWorld("amberfield", heroAt("hearth-the-riders-come"))),
    ).toBe(0);

    const w = newWorld("amberfield", heroAt("hearth-the-riders-come"));
    expect(w.storyState?.id).toBe("siege");
    expect(w.dark).toBe(true);
    expect(w.fires.length).toBeGreaterThan(3);
    // nobody stands in the square on the night of the attack
    expect(w.npcs.some((n) => n.id === "marshal-dunmore")).toBe(false);
    goTo(w, "hearth-square");
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe("hearth-riders");
    beat(w, "hearth-the-riders-come");
    expect(questState(w.hero, "hearth-hold-the-wall")).toBe("active");
    run(w, 4.5);
    goTo(w, "hearth-gate");
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe("hearth-wall");
    expect(w.pets.some((p) => p.def.id === "hearth-gate")).toBe(true);
    beat(w, "hearth-hold-the-wall");
    expect(questState(w.hero, "hearth-the-ram")).toBe("active");
    run(w, 4.5);
    goTo(w, "hearth-gate");
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe("hearth-ram");
    // the ram: it wants the gate, not the hero
    for (
      let i = 0;
      i < 20 &&
      !w.enemies.some(
        (e) => e.def.id === "ashen-ram" && !e.dead && e.state !== "spawn",
      );
      i++
    ) {
      run(w, 2.5);
      if (!w.enemies.some((e) => e.def.id === "ashen-ram")) smite(w);
    }
    const ram = w.enemies.find((e) => e.def.id === "ashen-ram" && !e.dead)!;
    expect(ram).toBeTruthy();
    const gate = w.pets.find((p) => p.def.id === "hearth-gate")!;
    const before = Math.hypot(ram.x - gate.x, ram.y - gate.y);
    w.player.x = ram.x + 60;
    w.player.y = ram.y;
    run(w, 3);
    expect(Math.hypot(ram.x - gate.x, ram.y - gate.y)).toBeLessThan(before);
    beat(w, "hearth-the-ram");
    expect(questState(w.hero, "hearth-the-shrine")).toBe("active");
    // the morning after: smoke, and the shrine to find
    run(w, 0.6);
    expect(w.storyState?.id).toBe("morning-after");
    goTo(w, "hearth-shrine");
    run(w, 0.5);
    expect(questState(w.hero, "hearth-the-shrine")).toBe("done");
    expect(questState(w.hero, "orders-from-the-north")).toBe("active");
    expect(QUEST_DEFS["orders-from-the-north"]!.objective).toMatchObject({
      kind: "talk",
      npc: "old-gaius",
    });
  });

  it("an old save already past a new beat counts it as played", () => {
    const hero = (
      quests: Record<string, { state: string; n: number }>,
    ): Record<string, unknown> => ({
      cls: "mage",
      level: 22,
      quests,
      unlocked: ["thornvale", "amberfield"],
    });
    const save = migrate({
      v: 3,
      heroes: [
        hero({
          "the-bandit-king": { state: "done", n: 1 },
          "hollow-gold": { state: "active", n: 0 },
        }),
        hero({
          "the-legion-picket": { state: "done", n: 1 },
          "orders-from-the-north": { state: "active", n: 0 },
        }),
        hero({ "the-bandit-king": { state: "done", n: 1 } }),
      ],
      last: 0,
    })!;
    const [a, b, c] = save.heroes as Character[];
    expect(questState(a!, "mill-the-bridge")).toBe("done");
    for (const id of [
      "hearth-the-riders-come",
      "hearth-hold-the-wall",
      "hearth-the-ram",
      "hearth-the-shrine",
    ])
      expect(questState(b!, id), id).toBe("done");
    // a hero who had just beaten Varric plays the mill road
    expect(questState(c!, "mill-the-bridge")).not.toBe("done");
    expect(questState(c!, "mill-the-bridge")).not.toBe("locked");
  });
});
