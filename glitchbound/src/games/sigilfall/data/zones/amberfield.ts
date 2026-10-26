import { after, all, during, is, not, until } from "../cond";
import { wildRegion } from "../zonegen";

/**
 * The Amberfield Steppes (levels 16-22): rolling grass north of the Saltmarsh, all the way to the sky.
 * Hearthstead, a walled camp town of refugees fleeing the east, sits by the south road. The centaur
 * clans hold the Clan Stones to the east, lions hunt the long grass, and the Ashen Host's riders scout
 * the roads from a picket on the north road, where it climbs toward Ironpeak.
 *
 * The Act I finale happens here (STORY_BIBLE.md §3, "The Defense of Hearthstead"): the picket empties,
 * Rider-Captain Vosk's riders strike the town at nightfall, the gate is held and the ram broken, and in
 * the smoke Vosk rides north with the second Crown fragment from the shrine by the well. Hearthstead
 * burns that night, smoulders the next morning, and flies new banners after.
 */

/** The night of the attack: the raid in the streets, the wall, the ram. */
const SIEGE = during(
  "hearth-the-riders-come",
  "hearth-hold-the-wall",
  "hearth-the-ram",
);
/** The morning after: the shrine found empty, the orders read. */
const MORNING = during("hearth-the-shrine", "orders-from-the-north");
/** Refugees camp by the road from the day the hero comes until the town has been held. */
const REFUGEES = all(
  is("refugees-on-the-road", "started"),
  until("hearth-the-shrine"),
);
/** Hearthstead's people go about their business, except on the night of the attack. */
const AT_HOME = not(SIEGE);
export const AMBERFIELD = wildRegion(
  {
    id: "amberfield",
    name: "The Amberfield Steppes",
    subtitle: "Grass to the sky, and refugees on every road",
    theme: "plains",
    levels: [16, 22],
    at: [72, 66],
    dark: false,
    safe: false,
    music: "plains",
    blurb:
      "Rolling plains, centaur clans, lions in the long grass, and the first riders of the Ashen Host.",
    states: [
      { id: "siege", when: SIEGE, night: true, burning: true, music: "crypt" },
      { id: "morning-after", when: MORNING, smoke: true },
    ],
  },
  {
    w: 170,
    h: 104,
    seed: 61129,
    levels: [16, 22],
    from: [0.5, 0.96],
    forest: 0.07,
    scatter: { trees: 0.6, bushes: 1.1, rocks: 0.9, flowers: 7 },
    water: { kind: "river", from: "n", to: "e" },
    hubs: [
      {
        at: [0.4, 0.7],
        npcs: ["marshal-dunmore", "tess-hearthkeeper", "old-gaius", "wynn"],
        houses: 7,
        wall: true,
        when: {
          "marshal-dunmore": AT_HOME,
          "tess-hearthkeeper": AT_HOME,
          "old-gaius": AT_HOME,
          wynn: AT_HOME,
        },
      },
    ],
    exits: [
      {
        side: "s",
        at: 0.5,
        to: "saltmarsh",
        label: "South road to the Saltmarsh",
      },
      {
        side: "n",
        at: 0.4,
        to: "ironpeak",
        label: "North road to Ironpeak",
        minLevel: 19,
      },
      {
        side: "e",
        at: 0.55,
        to: "stormwatch",
        label: "East road to Stormwatch",
        minLevel: 25,
      },
      {
        side: "w",
        at: 0.35,
        to: "emberwick",
        label: "The refugee road to the Crown City",
        needs: "sir-corvane",
      },
    ],
    pois: [
      // a refugee wagon train the Host caught on the east road
      {
        at: [0.62, 0.82],
        r: 10,
        kind: "camp",
        packs: [
          ["legion-scout", "grave-hound"],
          ["grave-hound", "grave-hound"],
        ],
        chest: "common",
        spot: { id: "broken-caravan", name: "The Broken Caravan" },
      },
      // the centaurs' war camp, where the clans meet and their war-chief holds the circle
      {
        at: [0.8, 0.52],
        r: 12,
        kind: "camp",
        packs: [
          ["centaur-outrider", "centaur-warbringer", "centaur-outrider"],
          ["centaur-warbringer", "centaur-outrider"],
          ["centaur-outrider", "centaur-outrider"],
        ],
        elite: true,
        rare: "stormhoof",
        chest: "common",
        spot: { id: "clan-stones", name: "The Clan Stones" },
      },
      // the Host's picket on the north road: its riders leave for Hearthstead the day the hero finds it
      {
        at: [0.52, 0.14],
        r: 12,
        kind: "camp",
        packs: [
          ["legion-scout", "legion-scout", "grave-hound"],
          ["legion-scout", "grave-hound", "grave-hound"],
          ["legion-scout", "legion-scout"],
        ],
        elite: true,
        chest: "rare",
        spot: { id: "legion-picket", name: "The Ashen Picket" },
        when: until("the-legion-picket"),
      },
      // the pride's rocks
      {
        at: [0.12, 0.6],
        r: 10,
        kind: "den",
        packs: [["plains-lion", "plains-lion"], ["plains-lion"]],
        rare: "goldmane",
        spot: { id: "lion-rocks", name: "Lion Rocks" },
      },
      // Wil Ashby's farm, out where nobody else would farm
      {
        at: [0.26, 0.86],
        r: 9,
        kind: "farm",
        packs: [
          ["plains-lion", "plains-lion"],
          ["hill-wolf", "hill-wolf", "hill-wolf"],
        ],
        spot: { id: "ashby-farm", name: "Ashby Farm" },
      },
      // the old graves of the Amber Lancers, dug open from below
      {
        at: [0.36, 0.3],
        r: 10,
        kind: "ruin",
        packs: [
          ["legion-scout", "legion-scout"],
          ["grave-hound", "grave-hound", "legion-scout"],
        ],
        chest: "rare",
        spot: { id: "lancers-rest", name: "Lancers’ Rest" },
      },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ["plains-lion", "plains-lion"],
          ["centaur-outrider", "centaur-outrider"],
          ["hill-wolf", "hill-wolf", "hill-wolf"],
          ["legion-scout", "grave-hound"],
        ],
      },
      {
        band: [0.35, 1],
        packs: [
          ["centaur-warbringer", "centaur-outrider"],
          ["legion-scout", "legion-scout", "grave-hound"],
          ["plains-lion", "plains-lion", "plains-lion"],
          ["centaur-outrider", "centaur-outrider", "centaur-outrider"],
          ["grave-hound", "grave-hound", "grave-hound"],
        ],
      },
    ],
    wildCount: 58,
    story: [
      // where the defense happens: the square, the north gate, and the roads the riders come down
      { near: "hub", marker: { kind: "place", id: "hearth-square" } },
      { near: "gate", marker: { kind: "place", id: "hearth-gate" } },
      { near: "gate", dy: -8, marker: { kind: "place", id: "hearth-north" } },
      {
        near: "gate",
        dx: -9,
        dy: -6,
        marker: { kind: "place", id: "hearth-northwest" },
      },
      {
        near: "gate",
        dx: 10,
        dy: -6,
        marker: { kind: "place", id: "hearth-northeast" },
      },
      { near: "hub", dx: 22, marker: { kind: "place", id: "hearth-east" } },
      { near: "hub", dx: -22, marker: { kind: "place", id: "hearth-west" } },
      // the shrine by the well, where Hearthstead kept its "hearthstone" (a Crown fragment, as it turns out)
      {
        near: "hub",
        dx: 4,
        dy: 3,
        marker: { kind: "prop", prop: "altar", solid: true },
      },
      {
        near: "hub",
        dx: 3,
        dy: 3,
        marker: { kind: "prop", prop: "iron-torch" },
        when: until("hearth-the-ram"),
      },
      {
        near: "hub",
        dx: 6,
        dy: 3,
        marker: { kind: "prop", prop: "iron-torch" },
        when: until("hearth-the-ram"),
      },
      {
        near: "hub",
        dx: 5,
        dy: 4,
        marker: {
          kind: "spot",
          id: "hearth-shrine",
          name: "The Hearth Shrine",
          r: 2,
        },
        when: is("hearth-the-shrine", "started"),
      },
      {
        near: "hub",
        dx: 5,
        dy: 2,
        marker: { kind: "prop", prop: "rubble" },
        when: after("hearth-the-ram"),
      },
      // the refugees' tents along the west road
      {
        near: "hub",
        dx: -10,
        dy: 6,
        marker: { kind: "prop", prop: "tent", solid: true },
        when: REFUGEES,
      },
      {
        near: "hub",
        dx: -13,
        dy: 9,
        marker: { kind: "prop", prop: "tent", solid: true },
        when: REFUGEES,
      },
      {
        near: "hub",
        dx: -7,
        dy: 9,
        marker: { kind: "prop", prop: "tent", solid: true },
        when: REFUGEES,
      },
      {
        near: "hub",
        dx: -10,
        dy: 8,
        marker: { kind: "prop", prop: "campfire", solid: true },
        when: REFUGEES,
      },
      {
        near: "hub",
        dx: -12,
        dy: 7,
        marker: { kind: "prop", prop: "cart", solid: true },
        when: REFUGEES,
      },
      {
        near: "hub",
        dx: -8,
        dy: 7,
        marker: { kind: "npc", npc: "refugee-hale" },
        when: all(REFUGEES, AT_HOME),
      },
      {
        near: "hub",
        dx: -12,
        dy: 10,
        marker: { kind: "npc", npc: "refugee-marit" },
        when: all(REFUGEES, AT_HOME),
      },
      // the night of the attack: the roofs burn
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        near: `house:${i}`,
        marker: { kind: "fire" as const, size: 2 + (i % 2) },
      })),
      // after it: new banners at the gate, and Dunmore's word on the gatepost
      {
        near: "gate",
        dx: -2,
        dy: 1,
        marker: { kind: "prop", prop: "blue-banner" },
        when: after("hearth-the-ram"),
      },
      {
        near: "gate",
        dx: 2,
        dy: 1,
        marker: { kind: "prop", prop: "blue-banner" },
        when: after("hearth-the-ram"),
      },
      {
        near: "gate",
        dx: -3,
        dy: 3,
        marker: { kind: "prop", prop: "debris" },
        when: MORNING,
      },
      {
        near: "gate",
        dx: 3,
        dy: 4,
        marker: { kind: "prop", prop: "debris" },
        when: MORNING,
      },
      // the empty picket: cold fires and cut horse lines
      {
        near: "legion-picket",
        dx: 2,
        marker: { kind: "prop", prop: "skull-banner" },
        when: until("the-legion-picket"),
      },
      {
        near: "legion-picket",
        dx: -2,
        dy: 2,
        marker: { kind: "prop", prop: "debris" },
        when: after("the-legion-picket"),
      },
    ],
  },
);
