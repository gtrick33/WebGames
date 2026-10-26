import type { Theme } from "../../data/types";
import type { Grade } from "./atlas";

/**
 * Every outdoor land's recipe in the approved hierarchy (ASSET_AUDIT.md, VISUAL_BIBLE.md §3, blueprint §3.4
 * and §7): CraftPix ground and props lead (`cps` summer, `cpw` swamp, `cpt` towers); Worlds-bundle pieces
 * fill only what CraftPix lacks (`gv` Greenvale, `mf` Mirefen, `sr` Sylvanreach, `gc` Gloomvault; overlays for
 * water, cobbles, soil, planks); Royal Keep is architecture (keeps, walls, chapels), drawn later in its own
 * layer. Variety comes from CraftPix recolors (`tree-medium~teal`) before any second pack.
 *
 * A prop is named `<atlas>:<key>`.
 */

export interface Recipe {
  /** The CraftPix ground set and how each map ground is drawn with it. */
  ground: {
    set: "cp-summer" | "cp-swamp";
    /** Whole tiles for open land: the set's outside (grass, bog) or inside (sand, moss) ground. */
    base: string;
    /** Blob set for roads (Path tiles). */
    path: string;
    /** Blob set for Sand tiles (beaches, dunes). */
    sand: string;
    /** Low-noise patches of a blob set over the base. */
    patches?: { set: string; share: number };
    /** Overlays (Worlds-bundle, normalized) by map ground; cobble 'rk' is Royal Keep's own set (the capital). */
    water: string;
    cobble: string;
    bridge: string;
    /** Farm fields (Deco inside a fence) as tilled soil. */
    field?: string;
  };
  /** The land's palette treatment on its ground and props (never on people). */
  grade: Grade;
  /** On water only (murk, toxic, lava, ice). */
  water?: Grade;
  trees: string[];
  bushes: string[];
  rocks: string[];
  /** Small, never-solid plants about the open land. */
  flora: string[];
  /** Map edges and woods: a forest of trees, or a field of boulders (bare lands). */
  edge: "forest" | "rocks";
  houses: string[];
}

const TREES = [
  "cps:tree-medium",
  "cps:tree-small",
  "cps:tree-medium~dark",
  "cps:tree-small~dark",
  "cps:tree-medium~mint",
];
const BUSHES = ["cps:bushes-large", "cps:bushes-medium", "cps:bushes-small"];
const ROCKS = [
  "cps:rock-01",
  "cps:rock-02",
  "cps:rock-03",
  "cps:rock-04",
  "cps:rock-05",
];
const BOULDERS = [
  "cpw:boulder-1",
  "cpw:boulder-2",
  "cpw:boulder-3",
  "cps:rock-01",
];
const FLORA = [
  "gv:grass_tuft",
  "gv:sunflowers",
  "gv:mushroom_cluster",
  "cps:bushes-small",
];
/** The CraftPix house with roof recolors, and the Greenvale cottage and smithy filling the missing CraftPix village pack. */
const HOUSES = [
  "cps:house",
  "cps:house",
  "gv:cosy_cottage",
  "cps:house",
  "gv:blacksmith_hut",
];

const vale = (
  over: Partial<Recipe> = {},
  ground: Partial<Recipe["ground"]> = {},
): Recipe => ({
  ground: {
    set: "cp-summer",
    base: "grass",
    path: "sand",
    sand: "sand",
    water: "water",
    cobble: "cobble",
    bridge: "planks",
    ...ground,
  },
  grade: {},
  trees: TREES,
  bushes: BUSHES,
  rocks: ROCKS,
  flora: FLORA,
  edge: "forest",
  houses: HOUSES,
  ...over,
});

const swamp = (over: Partial<Recipe> = {}): Recipe => ({
  ground: {
    set: "cp-swamp",
    base: "bog",
    path: "moss",
    sand: "moss",
    patches: { set: "moss", share: 0.22 },
    water: "swampwater",
    cobble: "cobble",
    bridge: "boardwalk",
  },
  grade: {},
  trees: [
    "cpw:tree-tower-short",
    "cps:tree-medium~dark",
    "cps:tree-small~dead",
    "cps:tree-medium~dead",
  ],
  bushes: [
    "cpw:shrub-swamp-1",
    "cpw:shrub-swamp-2",
    "cpw:shrub-swamp-3",
    "cpw:bushes-1",
  ],
  rocks: ["cpw:rock-1", "cpw:rock-2", "cpw:rock-3", "cpw:boulder-3"],
  flora: [
    "cpw:water-plant-1",
    "cpw:water-plant-2",
    "cpw:sticks-3",
    "cpw:sticks-4",
    "cpw:rafflesia",
    "mf:cattail_reeds",
  ],
  edge: "forest",
  houses: ["cpw:house", "mf:stilt_hut", "cpw:house"],
  ...over,
});

const bare = (over: Partial<Recipe> = {}): Recipe =>
  vale(
    {
      edge: "rocks",
      trees: ["cps:tree-small~dead", "cps:tree-medium~dead"],
      bushes: ["cps:bushes-small~dead"],
      rocks: [...ROCKS, ...BOULDERS],
      flora: ["gv:grass_tuft"],
      ...over,
    },
    { base: "sand", path: "sand", sand: "sand" },
  );

export const RECIPES: Partial<Record<Theme, Recipe>> = {
  // Emberwick, the Crown City: Royal Keep's yards and buildings (architecture authority), CraftPix dressing
  village: vale({}, { cobble: "rk" }),
  farm: vale(
    { grade: { tint: ["#ffe080", 0.06] }, flora: [...FLORA, "gv:hay_bale"] },
    { field: "soil" },
  ),
  plains: vale(
    {
      grade: { tint: ["#f0d860", 0.12], sat: 1.02 },
      flora: [...FLORA, "gv:hay_bale"],
    },
    { patches: { set: "sand", share: 0.12 }, field: "soil" },
  ),
  forest: vale({
    trees: [
      "cps:tree-medium~dark",
      "cps:tree-medium",
      "cps:tree-small~dark",
      "cps:tree-medium~teal",
      "cps:tree-small~teal",
    ],
    bushes: [
      "cps:bushes-large~dark",
      "cps:bushes-medium~teal",
      "cps:bushes-small",
    ],
    grade: { bright: -0.03 },
  }),
  coast: vale(
    {
      grade: { tint: ["#d8f0e0", 0.06] },
      trees: ["cps:tree-small~mint", "cps:tree-medium~mint"],
      flora: ["gv:grass_tuft", "mf:cattail_reeds"],
    },
    { patches: { set: "sand", share: 0.3 } },
  ),
  autumn: vale({
    trees: [
      "cps:tree-medium~amber",
      "cps:tree-medium~coral",
      "cps:tree-small~amber",
      "cps:tree-small~coral",
      "cps:tree-medium",
    ],
    bushes: [
      "cps:bushes-large~amber",
      "cps:bushes-medium~coral",
      "cps:bushes-small~amber",
    ],
    grade: { tint: ["#e8b060", 0.08] },
  }),
  fey: vale(
    {
      trees: [
        "cps:tree-medium~blossom",
        "cps:tree-medium~mint",
        "cps:tree-small~blossom",
        "cps:tree-medium~teal",
      ],
      bushes: ["cps:bushes-large~blossom", "cps:bushes-medium~mint"],
      flora: [
        "sr:toadstools",
        "sr:blue_bellflowers",
        "sr:mushroom_cluster",
        "sr:fern",
      ],
      grade: { hue: -10, sat: 1.08 },
    },
    { water: "stream", cobble: "moonstone" },
  ),
  jungle: vale({
    trees: [
      "cps:tree-medium~dark",
      "cps:tree-medium~teal",
      "cps:tree-small~dark",
    ],
    bushes: ["cps:bushes-large~dark", "cps:bushes-medium~teal"],
    grade: { sat: 1.1, bright: -0.05 },
  }),
  mountain: bare({
    grade: { sat: 0.85, tint: ["#9ab0c0", 0.1] },
    trees: ["cps:tree-small~dark", "cps:tree-medium~dark"],
  }),
  storm: bare({
    grade: { sat: 0.75, bright: -0.12, tint: ["#5a7aa0", 0.16] },
    water: { tint: ["#2a4a7a", 0.4], bright: -0.1 },
  }),
  desert: bare({ grade: { tint: ["#f0c070", 0.14] } }),
  barrow: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead", "cps:tree-small~dead"],
    bushes: ["cps:bushes-small~dead"],
    rocks: [...ROCKS, ...BOULDERS],
    grade: { sat: 0.5, bright: -0.1, tint: ["#8a8a9a", 0.14] },
  }),
  moor: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead", "cps:tree-small~dark"],
    rocks: [...ROCKS, ...BOULDERS],
    grade: { sat: 0.6, bright: -0.1, tint: ["#8a6a9a", 0.18] },
  }),
  rift: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead", "cps:tree-small~coral"],
    rocks: BOULDERS,
    grade: { hue: 60, sat: 0.8, bright: -0.08, tint: ["#7a4ab0", 0.22] },
  }),
  warfront: vale(
    {
      edge: "rocks",
      trees: [
        "cps:tree-medium~dead",
        "cps:tree-small~dead",
        "cps:tree-medium~amber",
      ],
      rocks: [...ROCKS, ...BOULDERS],
      grade: { sat: 0.65, bright: -0.06, tint: ["#9a7a5a", 0.14] },
    },
    { patches: { set: "sand", share: 0.25 } },
  ),
  snow: vale({
    trees: [
      "cps:tree-medium~snow",
      "cps:tree-small~snow",
      "cps:tree-medium~dark",
    ],
    bushes: ["cps:bushes-medium~snow", "cps:bushes-small~snow"],
    flora: [],
    grade: { sat: 0.25, bright: 0.18, tint: ["#e8f4ff", 0.55] },
    water: { tint: ["#a8d8f0", 0.5], bright: 0.1 },
  }),
  marsh: swamp(),
  plague: swamp({
    grade: { tint: ["#a8b040", 0.14], sat: 0.9 },
    water: { tint: ["#8ad04a", 0.4] },
  }),
  blight: swamp({
    grade: { sat: 0.5, bright: -0.12, tint: ["#6a4a7a", 0.18] },
  }),
  sunken: swamp({
    grade: { sat: 0.75, bright: -0.08, tint: ["#3a8a8a", 0.2] },
  }),
  gloam: swamp({ grade: { sat: 0.6, bright: -0.2, tint: ["#2a6a5a", 0.26] } }),
  haunted: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead"],
    grade: { sat: 0.4, bright: -0.16, tint: ["#4a6a8a", 0.22] },
  }),
  volcanic: bare({
    grade: { sat: 0.5, bright: -0.2, tint: ["#5a3a30", 0.3] },
    water: { hue: 150, tint: ["#ff7a2a", 0.7], bright: 0.06, sat: 1.4 },
  }),
  deadlake: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead"],
    grade: { sat: 0.35, bright: -0.16, tint: ["#5a6a7a", 0.2] },
  }),
  peaks: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~snow", "cps:tree-small~snow"],
    rocks: BOULDERS,
    flora: [],
    grade: { sat: 0.25, bright: 0.2, tint: ["#e8f4ff", 0.6] },
  }),
  bonefield: bare({ grade: { sat: 0.4, tint: ["#c0b08a", 0.2] }, flora: [] }),
  pale: vale({
    edge: "rocks",
    trees: ["cps:tree-medium~dead", "cps:tree-small~snow"],
    flora: [],
    grade: { sat: 0.3, bright: 0.05, tint: ["#9a9ac0", 0.25] },
  }),
};

/** The prop atlases a recipe draws from. */
export function atlasesOf(r: Recipe): string[] {
  // gc for the story's dressing (rubble, cages, altars) anywhere
  const ids = new Set<string>(["cps", "cpw", "cpt", "gv", "gc"]);
  for (const ref of [
    ...r.trees,
    ...r.bushes,
    ...r.rocks,
    ...r.flora,
    ...r.houses,
  ])
    ids.add(ref.split(":")[0]!);
  return [...ids];
}
