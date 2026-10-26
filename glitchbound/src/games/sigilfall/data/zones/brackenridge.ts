import { after, until } from "../cond";
import { wildRegion } from "../zonegen";

/**
 * Brackenridge Hills (5-10): golden autumn hills west of Briarhollow, where the barrow ghosts first
 * walk. Fernstead keeps watch from the east, near the road to the camp; kobolds dig on the ridge to the
 * north-west, boars root in the gullies to the south, and the Old Barrows lie in the south-west,
 * deepest in, where the Grey Lady sings.
 *
 * What changes (STORY_BIBLE.md §4): the Harvest Stones, Fernstead's shrine, are fouled with grieflight
 * and the dead gather there until the hero holds the stones while Alsa's candles burn; then they are lit
 * and warm. Once the Grey Lady is laid to rest the barrows are quiet, with lanterns on the mounds.
 */
export const BRACKENRIDGE = wildRegion(
  {
    id: "brackenridge",
    name: "Brackenridge Hills",
    subtitle: "Where the old barrows wake",
    theme: "autumn",
    levels: [5, 10],
    at: [31, 62],
    dark: false,
    safe: false,
    music: "plains",
    blurb:
      "Golden hills, kobold diggings and barrows that should have stayed shut. Fernstead keeps watch.",
  },
  {
    w: 140,
    h: 104,
    seed: 30517,
    levels: [5, 10],
    // the hills grow wilder with distance from Fernstead, near the road home
    from: [0.72, 0.42],
    forest: 0.3,
    scatter: { trees: 2.2, bushes: 1.4, rocks: 1, flowers: 5 },
    water: { kind: "river", from: "n", to: "s" },
    hubs: [
      {
        at: [0.72, 0.42],
        npcs: ["warden-hollis", "mother-alsa", "pip-tanner"],
        houses: 5,
      },
    ],
    exits: [
      {
        side: "e",
        at: 0.45,
        to: "briarhollow",
        label: "East road to Briarhollow",
      },
      {
        side: "s",
        at: 0.4,
        to: "greyfen",
        label: "South path to Greyfen",
        minLevel: 11,
      },
    ],
    pois: [
      {
        at: [0.58, 0.22],
        r: 10,
        kind: "cave",
        packs: [
          ["ridge-kobold", "ridge-kobold", "kobold-candler"],
          ["ridge-kobold", "ridge-kobold"],
          ["ridge-kobold", "ridge-kobold"],
        ],
        rare: "king-snagtooth",
        chest: "common",
        spot: { id: "kobold-diggings", name: "The Kobold Diggings" },
      },
      {
        at: [0.26, 0.6],
        r: 11,
        kind: "ruin",
        packs: [
          ["restless-shade", "barrow-skeleton"],
          ["barrow-skeleton", "barrow-skeleton", "restless-shade"],
          ["restless-shade", "restless-shade"],
        ],
        rare: "the-grey-lady",
        chest: "rare",
        spot: { id: "old-barrows", name: "The Old Barrows" },
        when: until("lay-the-grey-lady"),
      },
      {
        at: [0.6, 0.78],
        r: 9,
        kind: "den",
        packs: [["russet-boar", "russet-boar"], ["russet-boar"]],
        rare: "old-rustback",
        spot: { id: "tusker-gully", name: "Tusker Gully" },
      },
      {
        at: [0.86, 0.63],
        r: 8,
        kind: "farm",
        packs: [["ridge-kobold", "ridge-kobold"]],
        spot: { id: "appleby-orchard", name: "Appleby Orchard" },
      },
      {
        at: [0.8, 0.14],
        r: 8,
        kind: "grove",
        packs: [["restless-shade", "restless-shade"]],
        spot: { id: "harvest-stones", name: "The Harvest Stones" },
        when: until("the-harvest-stones"),
      },
      {
        at: [0.42, 0.4],
        r: 8,
        kind: "den",
        packs: [["hill-wolf", "hill-wolf", "hill-wolf"]],
        spot: { id: "wolfback-tor", name: "Wolfback Tor" },
      },
      {
        at: [0.12, 0.3],
        r: 8,
        kind: "ruin",
        packs: [
          ["barrow-skeleton", "barrow-skeleton"],
          ["restless-shade", "barrow-skeleton"],
        ],
        chest: "common",
        spot: { id: "wardens-cairn", name: "The Warden’s Cairn" },
      },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ["russet-boar", "russet-boar"],
          ["hill-wolf", "hill-wolf"],
          ["ridge-kobold", "ridge-kobold"],
          ["ridge-kobold", "kobold-candler"],
          ["russet-boar"],
        ],
      },
      {
        band: [0.3, 0.7],
        packs: [
          ["ridge-kobold", "ridge-kobold", "kobold-candler"],
          ["restless-shade", "barrow-skeleton"],
          ["russet-boar", "hill-wolf"],
          ["hill-wolf", "hill-wolf", "hill-wolf"],
        ],
      },
      {
        band: [0.6, 1],
        packs: [
          ["barrow-skeleton", "barrow-skeleton", "restless-shade"],
          ["restless-shade", "restless-shade"],
          ["barrow-skeleton", "barrow-skeleton"],
          ["hill-wolf", "hill-wolf", "hill-wolf"],
        ],
      },
    ],
    wildCount: 48,
    story: [
      // the Harvest Stones: grieflight in the cracks and bones in the grass, until they are held and lit
      { near: "harvest-stones", marker: { kind: "place", id: "fern-stones" } },
      // the stones themselves, in their ring
      {
        near: "harvest-stones",
        dx: -3,
        dy: -2,
        marker: { kind: "prop", prop: "standing-stone", solid: true },
      },
      {
        near: "harvest-stones",
        dx: 3,
        dy: -2,
        marker: { kind: "prop", prop: "standing-stone", solid: true },
      },
      {
        near: "harvest-stones",
        dx: -4,
        dy: 2,
        marker: { kind: "prop", prop: "standing-stone", solid: true },
      },
      {
        near: "harvest-stones",
        dx: 4,
        dy: 2,
        marker: { kind: "prop", prop: "standing-stone", solid: true },
      },
      {
        near: "harvest-stones",
        dx: 0,
        dy: -7,
        marker: { kind: "place", id: "fern-stones-n" },
      },
      {
        near: "harvest-stones",
        dx: -8,
        dy: 2,
        marker: { kind: "place", id: "fern-stones-w" },
      },
      {
        near: "harvest-stones",
        dx: 7,
        dy: 4,
        marker: { kind: "place", id: "fern-stones-e" },
      },
      {
        near: "harvest-stones",
        dx: 0,
        dy: -1,
        marker: { kind: "wisp", color: "#b58aff", size: 2 },
        when: until("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: -3,
        dy: 1,
        marker: { kind: "wisp", color: "#9a6aee", size: 1 },
        when: until("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: 2,
        dy: 2,
        marker: { kind: "prop", prop: "bone-heap" },
        when: until("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: -2,
        dy: -2,
        marker: { kind: "prop", prop: "skulls" },
        when: until("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: -2,
        dy: 0,
        marker: { kind: "prop", prop: "iron-torch" },
        when: after("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: 2,
        dy: 0,
        marker: { kind: "prop", prop: "iron-torch" },
        when: after("the-harvest-stones"),
      },
      {
        near: "harvest-stones",
        dx: 0,
        dy: 2,
        marker: { kind: "prop", prop: "hay" },
        when: after("the-harvest-stones"),
      },
      // the barrows after the Grey Lady: quiet, with lanterns on the mounds
      {
        near: "old-barrows",
        dx: -3,
        dy: 1,
        marker: { kind: "prop", prop: "lantern" },
        when: after("lay-the-grey-lady"),
      },
      {
        near: "old-barrows",
        dx: 3,
        dy: -1,
        marker: { kind: "prop", prop: "lantern" },
        when: after("lay-the-grey-lady"),
      },
      {
        near: "old-barrows",
        dx: 0,
        dy: 3,
        marker: { kind: "prop", prop: "lantern" },
        when: after("lay-the-grey-lady"),
      },
    ],
  },
);
