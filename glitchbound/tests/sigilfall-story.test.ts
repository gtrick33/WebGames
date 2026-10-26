import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/games/sigilfall/data/events";
import { QUEST_DEFS } from "../src/games/sigilfall/data/quests";
import { REGIONS } from "../src/games/sigilfall/data/regions";
import {
  HOME,
  newCharacter,
  questState,
  startQuests,
  type Character,
} from "../src/games/sigilfall/progress/character";
import { migrate, SAVE_VERSION } from "../src/games/sigilfall/progress/save";
import { hitEnemy } from "../src/games/sigilfall/sim/combat";
import { regionState } from "../src/games/sigilfall/sim/story";
import { emptyInput, type World } from "../src/games/sigilfall/sim/world";
import { newWorld, readyHero } from "./sigilfall-bot";

/**
 * The story in the world (STORY_BIBLE.md §4): Briarhollow's states, the Prologue's raid, rescue and
 * defense played on the ordinary simulation, people and roads that come with the story, and old saves
 * picking up the new opening where they were.
 */

/** A hero at a point in the Prologue: everything before `quest` done, `quest` itself active. */
function heroAt(quest: string, level = 5): Character {
  const c = readyHero("mage", level);
  const order = [
    "briar-dusk",
    "first-steps",
    "first-spell",
    "first-dodge",
    "briar-the-seal",
    "into-the-wood",
    "alpha",
    "briar-nightfall",
    "briar-the-inn",
    "briar-hold-the-door",
    "briar-below",
    "the-warden",
    "close-the-rift",
    "the-empty-tomb",
  ];
  for (const id of order) {
    if (id === quest) {
      c.quests[id] = { state: "active", n: 0 };
      break;
    }
    c.quests[id] = { state: "done", n: 1 };
  }
  return c;
}

const DT = 1 / 60;

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    each?.();
    w.step(DT);
  }
}

/** Puts the hero where an event happens. */
function goTo(w: World, place: string): void {
  const at = w.places[place]!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}

/** Strikes down every living enemy (the hero is not the point of these tests). */
function smite(w: World): void {
  for (const e of w.enemies)
    if (!e.dead && e.state !== "spawn")
      hitEnemy(w, e, 1e7, "physical", { depth: 0 });
}

describe("Sigilfall: the story in the world", () => {
  it("a new hero starts at Briarhollow’s gate with the guard’s greeting", () => {
    const c = newCharacter("mage", "Test", "t", 0);
    expect(c.unlocked).toEqual([HOME]);
    expect(questState(c, "briar-dusk")).toBe("active");
    expect(QUEST_DEFS["first-steps"]!.after).toEqual(["briar-dusk"]);
  });

  it("Briarhollow burns on the night of the raid, smoulders after it, and becomes the camp at dawn", () => {
    const b = REGIONS.briarhollow;
    // the day the hero arrives is all late light
    expect(regionState(b, heroAt("briar-the-seal"))?.dusk).toBe(true);
    const raid = regionState(b, heroAt("briar-nightfall"));
    expect(raid?.id).toBe("raid");
    expect(raid?.night && raid.burning).toBe(true);
    expect(regionState(b, heroAt("the-warden"))?.id).toBe("night");
    const dawn = heroAt("the-empty-tomb");
    dawn.quests["the-empty-tomb"] = { state: "done", n: 1 };
    expect(regionState(b, dawn)?.id).toBe("camp");
    // the world shows it: night, fires on the roofs, no peace for the HUD
    const w = newWorld("briarhollow", heroAt("briar-nightfall"));
    expect(w.dark).toBe(true);
    expect(w.fires.length).toBeGreaterThan(3);
  });

  it("people and roads come with the story", () => {
    const early = newWorld("briarhollow", heroAt("first-dodge"));
    expect(early.npcs.some((n) => n.id === "oskar-fell")).toBe(false);
    expect(early.exits.some((x) => x.to === "crypt")).toBe(false);
    expect(early.exits.some((x) => x.to === "thornvale")).toBe(false);
    const courier = newWorld("briarhollow", heroAt("briar-the-seal"));
    expect(courier.npcs.some((n) => n.id === "oskar-fell")).toBe(true);
    // during the raid the villagers are hidden away; Mara fights beside you instead of standing at the gate
    const raid = newWorld("briarhollow", heroAt("briar-nightfall"));
    expect(raid.npcs.some((n) => n.id === "mara-venn")).toBe(false);
    const below = newWorld("briarhollow", heroAt("briar-below"));
    expect(below.exits.some((x) => x.to === "crypt")).toBe(true);
    // the state follows the story while the hero is there
    const w = newWorld("briarhollow", heroAt("briar-the-seal"));
    w.hero.quests["briar-the-seal"] = { state: "done", n: 1 };
    const v = w.stateVersion;
    run(w, 0.6);
    expect(w.stateVersion).toBeGreaterThan(v);
    expect(w.npcs.some((n) => n.id === "oskar-fell")).toBe(false);
  });

  it("the raid: Mara fights beside you, three waves come, and the quest moves on to the burning inn", () => {
    const w = newWorld("briarhollow", heroAt("briar-nightfall"));
    w.hero.level = 30; // a sturdy hero: the test is the event, not the fight
    goTo(w, "briar-square");
    run(w, 0.2);
    expect(w.story.run?.def.id).toBe("briar-raid");
    expect(w.safe).toBe(false);
    expect(w.pets.some((p) => p.def.id === "mara" && !p.dead)).toBe(true);
    let waves = 0;
    for (
      let i = 0;
      i < 40 && questState(w.hero, "briar-nightfall") === "active";
      i++
    ) {
      run(w, 2.5);
      if (w.enemies.some((e) => !e.dead)) waves++;
      smite(w);
    }
    expect(waves).toBeGreaterThanOrEqual(EVENTS["briar-raid"]!.waves.length);
    expect(questState(w.hero, "briar-nightfall")).toBe("done");
    expect(questState(w.hero, "briar-the-inn")).toBe("active");
    // the event's companions leave with it (once they've said their piece), and the village is the inn's fight now
    run(w, 12);
    expect(w.pets.some((p) => p.def.id === "mara" && !p.dead)).toBe(false);
    expect(w.story.run).toBeNull();
  });

  it("the inn: the children follow you and the rescue is done only when all three are safe", () => {
    const w = newWorld("briarhollow", heroAt("briar-the-inn"));
    w.hero.level = 30;
    goTo(w, "briar-inn");
    run(w, 0.3);
    const kids = w.pets.filter((p) => p.def.id === "briar-child");
    expect(kids).toHaveLength(3);
    // the waves beaten, but the children still at the inn: not done
    for (let i = 0; i < 12; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, "briar-the-inn")).toBe("active");
    // lead them to the chapel: walk there, and they follow
    const chapel = w.places["briar-chapel"]!;
    for (
      let i = 0;
      i < 600 && questState(w.hero, "briar-the-inn") === "active";
      i++
    ) {
      const dx = chapel.x - w.player.x;
      const dy = chapel.y + 6 - w.player.y;
      const d = Math.hypot(dx, dy);
      w.input = {
        ...emptyInput(),
        ...(d > 6 ? { mx: dx / d, my: dy / d } : {}),
      };
      w.step(DT);
      // the way is not straight: step past walls by putting the hero a little further each second
      if (i % 60 === 59 && d > 40) {
        w.player.x += (dx / d) * 30;
        w.player.y += (dy / d) * 30;
      }
    }
    run(w, 1);
    expect(questState(w.hero, "briar-the-inn")).toBe("done");
    expect(questState(w.hero, "briar-hold-the-door")).toBe("active");
  });

  it("the door: if it breaks the defense starts over (and pays nothing); held, it opens the crypt stair", () => {
    const w = newWorld("briarhollow", heroAt("briar-hold-the-door"));
    w.hero.level = 30;
    goTo(w, "briar-chapel");
    run(w, 0.3);
    const door = w.pets.find((p) => p.def.id === "chapel-door")!;
    expect(door).toBeTruthy();
    const gold = w.hero.gold;
    door.hp = 0;
    door.dead = true;
    run(w, 0.2);
    expect(w.story.run).toBeNull();
    expect(questState(w.hero, "briar-hold-the-door")).toBe("active");
    expect(w.hero.gold).toBe(gold);
    // after a breath it begins again, with a whole door
    run(w, 4.5);
    expect(w.story.run?.def.id).toBe("briar-door");
    for (
      let i = 0;
      i < 30 && questState(w.hero, "briar-hold-the-door") === "active";
      i++
    ) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, "briar-hold-the-door")).toBe("done");
    expect(questState(w.hero, "briar-below")).toBe("active");
    // the stair opens while the hero is still standing there
    run(w, 0.6);
    expect(w.exits.some((x) => x.to === "crypt")).toBe(true);
    expect(w.spots.some((x) => x.id === "briar-crypt-stair")).toBe(true);
  });

  it("an old save picks up the new opening where its hero was", () => {
    const fresh = (
      quests: Record<string, { state: string; n: number }>,
    ): Record<string, unknown> => ({ cls: "mage", level: 9, quests });
    const save = migrate({
      v: 2,
      heroes: [
        fresh({ "first-steps": { state: "active", n: 0 } }),
        fresh({
          "first-dodge": { state: "done", n: 1 },
          alpha: { state: "done", n: 1 },
        }),
        fresh({
          "close-the-rift": { state: "done", n: 1 },
          "the-warden": { state: "done", n: 1 },
        }),
      ],
      last: 0,
    })!;
    expect(save.v).toBe(SAVE_VERSION);
    const [a, b, c] = save.heroes as Character[];
    expect(questState(a!, "briar-dusk")).toBe("done");
    expect(questState(a!, "briar-the-seal")).toBe("locked");
    expect(questState(b!, "briar-the-seal")).toBe("done");
    // past the old opening: the raid, the inn and the door count as played
    for (const id of [
      "briar-nightfall",
      "briar-the-inn",
      "briar-hold-the-door",
      "briar-below",
    ])
      expect(questState(c!, id)).toBe("done");
    // every hero now has Briarhollow
    for (const h of [a!, b!, c!]) expect(h.unlocked).toContain(HOME);
    // and nothing the hero already finished starts again
    startQuests(c!);
    expect(questState(c!, "close-the-rift")).toBe("done");
  });
});
