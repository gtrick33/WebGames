import type { NpcDef, QuestDef, StoryEventDef } from "../types";

/**
 * Millbrook's people and Thornvale's quests (Act I, STORY_BIBLE.md §3). The Gallows Gang under Varric
 * Blackhand is bleeding Millbrook dry with its "rope tax" (pay in silver or hang on Gallows Hill) and
 * holds the mill on Miller's Pond so that no grain leaves the vale. Varric is paid in ash-gold: the
 * Ashen Host wants the Vale hungry. The story runs from the Burnt Farm through Redcap Camp and the Old
 * Watchtower down into Gallows Keep, then back to break the blockade at the mill; Nyx turns up to read
 * the gang's cipher for Pim, and is gone. Tobin and Hanna have side errands, and the gang's powder trail
 * points east to Gullport. Millbrook's grain goes north to Briarhollow's camp. Order matters: the main
 * chain comes first, so it is the quest the hero follows by default.
 */
export const THORNVALE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: "south-road",
    name: "The South Road",
    giver: "maren",
    text: "A carter from Millbrook brought a letter to the camp: a gang holds the mill and taxes every cart, the village is being bled dry, and its reeve has run out of ideas. Briarhollow will starve this winter without Millbrook’s grain. Take the south road and find Reeve Aldous.",
    objective: {
      kind: "talk",
      npc: "reeve-aldous",
      label: "Talk to Reeve Aldous in Millbrook",
    },
    after: ["the-empty-tomb"],
    level: 7,
    reward: { xp: 110, gold: 40 },
  },
  /* ---------------------------------------------------- the Gallows Gang */
  {
    id: "kettle-farm",
    name: "Ashes at Kettle Farm",
    giver: "reeve-aldous",
    text: "The Kettles wouldn’t pay the Gallows Gang’s rope tax. Two nights later their farm burned. Reeve Aldous wants someone to go and look, and he would rather it wasn’t him. The Burnt Farm is north-east of Millbrook.",
    objective: {
      kind: "explore",
      spot: "east-farm",
      label: "Look around the Burnt Farm",
    },
    after: ["south-road"],
    zone: "thornvale",
    reward: { xp: 125, gold: 64 },
  },
  {
    id: "redcap-camp",
    name: "Red Caps",
    giver: "sefa",
    text: "Sefa, Millbrook’s warden, found the gang’s tracks at the Kettles’ gate. They lead to Redcap Camp, south-east of the village. She can’t take it alone. With you, she thinks she can at least make it smaller.",
    objective: {
      kind: "kill",
      region: "thornvale",
      count: 12,
      enemies: [
        "bandit-cutthroat",
        "bandit-archer",
        "bandit-enforcer",
        "hedge-witch",
      ],
      label: "Defeat Gallows Gang bandits",
    },
    after: ["kettle-farm"],
    zone: "thornvale",
    reward: { xp: 250, gold: 80 },
  },
  {
    id: "blackhand-orders",
    name: "Orders in Black",
    giver: "sefa",
    text: "The enforcers carry sealed orders, stamped with a black hand. Sefa wants to know what Varric Blackhand is telling his gang. Take the orders off the enforcers, and off the hedge witches who pass them around like gossip.",
    objective: {
      kind: "loot",
      region: "thornvale",
      item: "Sealed Order",
      from: ["bandit-enforcer", "hedge-witch"],
      chance: 0.5,
      count: 3,
      label: "Take Sealed Orders from enforcers and hedge witches",
    },
    after: ["redcap-camp"],
    zone: "thornvale",
    reward: { xp: 190, gold: 80 },
  },
  {
    id: "thieves-cant",
    name: "Thieves’ Cant",
    giver: "reeve-aldous",
    text: "The orders are written in thieves’ cant, with a cipher under the cant, and nobody in Millbrook can read it. Nobody honest, says the Reeve, looking hard at Pim the peddler. Pim says he has a friend in town who reads everything. Take the orders to Pim.",
    objective: { kind: "talk", npc: "pim", label: "Bring the orders to Pim" },
    after: ["blackhand-orders"],
    zone: "thornvale",
    reward: { xp: 200, gold: 88 },
  },
  {
    id: "hunt-black-bess",
    name: "Black Bess",
    giver: "sefa",
    text: "Pim read the orders: the gang’s takings go to Black Bess at the Old Watchtower, in the south of the vale. Bess robbed the Millbrook road for ten years and was never caught. Sefa would like that to change.",
    objective: {
      kind: "kill",
      region: "thornvale",
      count: 1,
      enemies: ["black-bess"],
      label: "Defeat Black Bess at the Old Watchtower",
    },
    after: ["thieves-cant"],
    zone: "thornvale",
    level: 11,
    reward: { xp: 340, gold: 110, item: { rarity: "rare" } },
  },
  {
    id: "the-hangman",
    name: "The Hangman",
    giver: "sefa",
    text: "With Bess gone, the gang has crawled back into Gallows Keep, the cellars under Gallows Hill in the south-east. The Hangman keeps its gate, and its rope. Sefa says to keep moving when he swings it.",
    objective: {
      kind: "boss",
      boss: "hangman",
      label: "Defeat the Hangman in Gallows Keep",
    },
    after: ["hunt-black-bess"],
    zone: "thornvale",
    level: 12,
    reward: { xp: 430, gold: 120, item: { rarity: "rare" } },
  },
  {
    id: "the-bandit-king",
    name: "The Bandit King",
    giver: "reeve-aldous",
    text: "Varric Blackhand waits at the bottom of Gallows Keep, on a throne built from Millbrook’s savings. End him and the rope tax ends with him. The Reeve has promised you something for it. He has promised it twice, which for Aldous is a vow.",
    objective: {
      kind: "boss",
      boss: "varric",
      label: "Defeat Varric Blackhand",
    },
    after: ["the-hangman"],
    zone: "thornvale",
    reward: {
      xp: 900,
      gold: 320,
      item: "blackhand-coat",
      perk: "satchel",
      text: "Millbrook’s thanks: Varric’s coat, and a satchel with room for six more things. Behind his throne, a strongbox of grey coins that weigh nothing and are cold as a well.",
    },
  },
  {
    id: "mill-the-bridge",
    name: "The Mill Road",
    giver: "reeve-aldous",
    text: "Varric is dead, but nobody has told the blades he hired. They still hold the mill on Miller’s Pond behind a barricade of carts, and no grain moves. Sefa has gathered the Millbrook lads. Break the blockade with them, and burn the barricade so everyone can see it from the road.",
    objective: {
      kind: "event",
      event: "mill-the-mill",
      label: "Break the blockade at the mill on Miller’s Pond",
    },
    after: ["the-bandit-king"],
    zone: "thornvale",
    level: 12,
    reward: {
      xp: 600,
      gold: 180,
      text: "The barricade burns all night. In the morning the mill wheel turns, and the first carts go north.",
    },
  },
  {
    id: "east-to-gullport",
    name: "Powder from the Coast",
    giver: "reeve-aldous",
    text: "Varric’s orders mention powder kegs, bought on the coast and paid for in Millbrook silver. Gullport should know who is selling. Take the coast road east and tell Harbormaster Quill.",
    objective: {
      kind: "talk",
      npc: "harbormaster-quill",
      label: "Talk to Harbormaster Quill in Gullport",
    },
    after: ["hunt-black-bess"],
    zone: "thornvale",
    level: 13,
    reward: { xp: 260, gold: 100 },
  },
  /* ------------------------------------------------------- Tobin's farm */
  {
    id: "tobins-fields",
    name: "Tobin’s Farm",
    giver: "tobin",
    text: "Tobin hasn’t been home since the wolves came down from the hills and ate his sheep, his dog’s dinner and, he swears, a gate. His farm is west of Millbrook. Go and see if there’s anything left.",
    objective: {
      kind: "explore",
      spot: "tobins-farm",
      label: "Check on Tobin’s Farm",
    },
    after: ["south-road"],
    zone: "thornvale",
    reward: { xp: 130, gold: 60 },
  },
  {
    id: "wolf-pelts",
    name: "Pelts for Winter",
    giver: "tobin",
    text: "The wolves owe Tobin a flock. He’ll settle for their coats: six good pelts will keep his new lambs warm, once he has new lambs.",
    objective: {
      kind: "loot",
      region: "thornvale",
      item: "Wolf Pelt",
      from: ["hill-wolf"],
      chance: 0.5,
      count: 6,
      label: "Collect Wolf Pelts from hill wolves",
    },
    after: ["tobins-fields"],
    zone: "thornvale",
    reward: { xp: 170, gold: 75 },
  },
  {
    id: "hunt-old-greymane",
    name: "Old Greymane",
    giver: "tobin",
    text: "The pack answers to Old Greymane, a wolf older than Tobin’s farm and twice as stubborn. It dens in the Wolfrun Hills, south of the farm. Put it down and the hills go quiet. Tobin has something for you if you do.",
    objective: {
      kind: "kill",
      region: "thornvale",
      count: 1,
      enemies: ["old-greymane"],
      label: "Defeat Old Greymane in the Wolfrun Hills",
    },
    after: ["wolf-pelts"],
    zone: "thornvale",
    level: 11,
    reward: {
      xp: 360,
      gold: 110,
      perk: "flask",
      text: "Tobin gives you his grandfather’s flask: you can carry one more potion.",
    },
  },
  /* ------------------------------------------------------ Hanna's tonic */
  {
    id: "silk-strainers",
    name: "Silk for the Still",
    giver: "hanna",
    text: "Hanna brews the best tonic in Thornvale and strains it through spider silk. Her strainers have worn through. The thornback spiders of Webwood Hollow, in the far east of the vale, have plenty. They won’t hand it over nicely.",
    objective: {
      kind: "loot",
      region: "thornvale",
      item: "Spider Silk",
      from: ["thornback-spider"],
      chance: 0.5,
      count: 6,
      label: "Collect Spider Silk from thornback spiders",
    },
    after: ["south-road"],
    zone: "thornvale",
    level: 9,
    reward: { xp: 175, gold: 72 },
  },
  {
    id: "pond-water",
    name: "Still Waters",
    giver: "hanna",
    text: "Good tonic needs clean water, and the cleanest in the vale bubbles up at Miller’s Pond, south of the village. Hanna would go herself, if she could leave the inn for an hour without it burning down.",
    objective: {
      kind: "explore",
      spot: "millers-pond",
      label: "Fetch water from Miller’s Pond",
    },
    after: ["silk-strainers"],
    zone: "thornvale",
    reward: { xp: 170, gold: 72 },
  },
  {
    id: "witch-herbs",
    name: "Hedge Magic",
    giver: "hanna",
    text: "The last thing Hanna needs grows where the hedge witches walk: knots of thornberry and bitterwort. The witches carry them in bundles. Hanna wants them more than the witches do.",
    objective: {
      kind: "loot",
      region: "thornvale",
      item: "Herb Bundle",
      from: ["hedge-witch"],
      chance: 0.5,
      count: 4,
      label: "Take Herb Bundles from hedge witches",
    },
    after: ["pond-water"],
    zone: "thornvale",
    level: 11,
    reward: {
      xp: 330,
      gold: 100,
      item: "thornberry-charm",
      text: "Hanna ties you a charm from what is left over.",
    },
  },
  /* ------------------------------------------------------------ errands */
  {
    id: "tobins-letter",
    name: "A Letter for Hanna",
    giver: "tobin",
    text: "Tobin has written Hanna a letter. He has written it six times. Take the seventh to the inn before he starts an eighth, and don’t read it. It’s about her pies. Mostly.",
    objective: {
      kind: "talk",
      npc: "hanna",
      label: "Deliver Tobin’s letter to Hanna",
    },
    after: ["south-road"],
    zone: "thornvale",
    level: 9,
    reward: { xp: 140, gold: 40 },
  },
  {
    id: "wanted-posters",
    name: "Wanted",
    giver: "sefa",
    text: "Every wanted poster Sefa nails up, the gang tears down and keeps as a joke. Sefa doesn’t find it funny, and the drawings were good. Take the posters back from the cutthroats and archers who carry them.",
    objective: {
      kind: "loot",
      region: "thornvale",
      item: "Wanted Poster",
      from: ["bandit-cutthroat", "bandit-archer"],
      chance: 0.4,
      count: 6,
      label: "Recover Wanted Posters from bandits",
    },
    after: ["redcap-camp"],
    zone: "thornvale",
    level: 10,
    reward: { xp: 210, gold: 88 },
  },
];

export const THORNVALE_NPCS: Record<string, NpcDef> = {
  "reeve-aldous": {
    id: "reeve-aldous",
    name: "Reeve Aldous",
    title: "Reeve of Millbrook",
    sprite: "villager",
    talk: [
      {
        when: { quest: "south-road", state: "active" },
        lines: [
          "From Briarhollow? Maren sent you? Thank the light, and her. Sit, sit. Not that chair. That’s the reeve’s chair. I’m the reeve.",
          "The Gallows Gang taxes us: our silver, or one of us on Gallows Hill. They call it the rope tax. We’ve been paying in silver. We’re running out.",
          "And they hold the mill. Not to grind anything. Just to hold it. Who pays a gang to keep flour from moving?",
        ],
      },
      {
        when: { quest: "kettle-farm", state: "active" },
        lines: [
          "The Kettles said no to the rope tax. Two nights later their farm burned. We call it the Burnt Farm now. We’re not imaginative people.",
          "It’s north-east of the village. Go and look. Tell me it was an accident. Then tell me the truth.",
        ],
      },
      {
        when: { quest: "thieves-cant", state: "active" },
        lines: [
          "These orders are in thieves’ cant. Nobody in Millbrook can read it. Nobody honest.",
          "Pim. The peddler, by the well. Don’t buy anything while you’re there.",
        ],
      },
      {
        when: { quest: "the-bandit-king", state: "active" },
        lines: [
          "The Hangman is dead? Then only Varric is left. Varric Blackhand, the bandit king. Never beaten. Never tried.",
          "End him, and I’ll give you the best thing Millbrook has. It’s a satchel. You’d be amazed what fits in it.",
        ],
      },
      {
        when: { quest: "east-to-gullport", state: "active" },
        lines: [
          "Varric has been buying powder from the coast. Gullport’s harbormaster ought to know who’s selling it.",
          "Take the coast road east. Quill’s the name. Sharp woman. Don’t let her charge you a toll.",
        ],
      },
      {
        when: { quest: "redcap-camp", state: "active" },
        lines: [
          "Sefa’s going after the camp. Help her. I’d help too, but someone has to stay here and be nervous.",
        ],
      },
      {
        when: { quest: "hunt-black-bess", state: "active" },
        lines: [
          "Black Bess! She stopped my cart on the Millbrook road, years ago. Very polite about it. She took my hat.",
          "It was a good hat. Bring it back if you see it. No? No.",
        ],
      },
      {
        when: { quest: "the-hangman", state: "active" },
        lines: [
          "Gallows Keep. I can see the hill from my window. I’ve moved my bed.",
        ],
      },
      {
        when: { quest: "mill-the-bridge", state: "active" },
        lines: [
          "Varric’s strongbox was full of coins no mint ever struck. Grey. Cold. They weigh nothing. Somebody was paying him to keep us hungry.",
          "His blades still hold the mill. Sefa has the lads. Go with them, and burn that barricade high.",
        ],
      },
      {
        when: { quest: "mill-the-bridge", state: "done" },
        lines: [
          "Millbrook sleeps with its doors unlocked again. Well, most doors. I’ve kept a lock on the treasury. Old habits.",
          "The grain goes north to Maren’s camp. Show her those grey coins. She’ll know what they are. I don’t want to.",
        ],
      },
      {
        lines: [
          "Welcome to Millbrook. We grow wheat, barley and worry.",
          "Mind the Gallows Gang if you go out. Red caps. You’ll hear them before you see them, because they sing.",
        ],
      },
    ],
  },
  hanna: {
    id: "hanna",
    name: "Hanna",
    title: "Innkeeper",
    sprite: "villager",
    shop: "inn",
    shopName: "The Wayfarer’s Rest",
    talk: [
      {
        when: { quest: "tobins-letter", state: "active" },
        lines: [
          "A letter? From Tobin? Is it about my pies? It’s about my pies.",
          "…It isn’t only about my pies. Oh. Tell him… No. I’ll tell him myself. Tell him there are pies on Tuesday.",
        ],
      },
      {
        when: { quest: "witch-herbs", state: "active" },
        lines: [
          "The hedge witches pick the best herbs in Thornvale. They pick them, and then they hit people with them.",
          "Four bundles. I’ll make you something that keeps you on your feet.",
        ],
      },
      {
        when: { quest: "pond-water", state: "active" },
        lines: [
          "The spring at Miller’s Pond, south of the village. Clean water makes clean tonic.",
          "Dirty water makes the Reeve’s speeches.",
        ],
      },
      {
        when: { quest: "silk-strainers", state: "active" },
        lines: [
          "My strainers are worn through. Spider silk is best: fine, strong, and it comes with spiders.",
          "Webwood Hollow, out in the far east of the vale. Six lengths, please. No spiders.",
        ],
      },
      {
        when: { quest: "witch-herbs", state: "done" },
        lines: [
          "Keep that charm on you. It mends you when you’re hurt and smells of thornberry.",
          "The smell doesn’t wash out. I call that a feature.",
        ],
      },
      {
        lines: [
          "Welcome to the Millwheel. Potions on the shelf, stew in the pot.",
          "Catch your breath between fights out there. Potions are for when something is still hitting you.",
        ],
      },
    ],
  },
  tobin: {
    id: "tobin",
    name: "Tobin",
    title: "Farmer",
    sprite: "villager",
    talk: [
      {
        when: { quest: "tobins-fields", state: "active" },
        lines: [
          "Wolves. Came down from the hills like a bad winter. Took my sheep, my dog’s dinner and the gate.",
          "The gate! What does a wolf want with a gate? My farm’s west of the village. Go and look. I can’t.",
        ],
      },
      {
        when: { quest: "wolf-pelts", state: "active" },
        lines: [
          "Six pelts. The wolves owe me a flock. They can pay me in coats.",
          "If you see one with a grey mane and a worse temper, that’s Greymane. Leave him to me. Well. To you. Later.",
        ],
      },
      {
        when: { quest: "hunt-old-greymane", state: "active" },
        lines: [
          "Old Greymane. Older than my farm and smarter than me. Don’t tell anyone that last part.",
          "He dens in the Wolfrun Hills, south of the farm. Bring him down and you can have Granddad’s flask. It holds more than it looks. So did Granddad.",
        ],
      },
      {
        when: { quest: "tobins-letter", state: "active" },
        lines: [
          "You’ll take it? Don’t read it. Don’t read it! It’s about pies.",
          "Hanna. At the inn. Give it to her and run.",
        ],
      },
      {
        when: { quest: "hunt-old-greymane", state: "done" },
        lines: [
          "The hills are quiet. I slept a whole night and dreamt of sheep. Ordinary sheep.",
          "Use that flask. Granddad would want it to see some trouble.",
        ],
      },
      {
        when: { quest: "tobins-letter", state: "done" },
        lines: ["Tuesday! She said Tuesday!"],
      },
      {
        lines: [
          "Thornvale’s good land. Good soil, good rain, terrible neighbors.",
        ],
      },
    ],
  },
  sefa: {
    id: "sefa",
    name: "Sefa",
    title: "Warden",
    sprite: "villager",
    talk: [
      {
        when: { quest: "redcap-camp", state: "active" },
        lines: [
          "Tracks at the Kettles’ gate. Red caps, heavy boots, no shame. They lead to Redcap Camp, south-east of here.",
          "Hit the hedge witches first. They patch the others up faster than I can knock them down.",
        ],
      },
      {
        when: { quest: "blackhand-orders", state: "active" },
        lines: [
          "The enforcers carry Varric’s orders, sealed with a black hand. Subtle man.",
          "Bring me three. The hedge witches carry them too. They pass them round like gossip.",
        ],
      },
      {
        when: { quest: "hunt-black-bess", state: "active" },
        lines: [
          "Black Bess. Ten years on the Millbrook road and never caught. I tried. Twice.",
          "The Old Watchtower, in the south. She shoots from the walls. Don’t stand still.",
        ],
      },
      {
        when: { quest: "the-hangman", state: "active" },
        lines: [
          "The gang’s gone to ground in Gallows Keep, under the hill in the south-east. The Hangman keeps its gate.",
          "When he swings that rope, move. When he stops swinging it, move faster.",
        ],
      },
      {
        when: { quest: "wanted-posters", state: "active" },
        lines: [
          "I nail up wanted posters. They tear them down and keep them, like trophies.",
          "Get them back. The cutthroats and archers carry them. And yes, I drew them myself.",
        ],
      },
      {
        when: { quest: "mill-the-bridge", state: "active" },
        lines: [
          "The lads are ready. Six of them, two pitchforks, one sword between them, and me.",
          "Their blades don’t know Varric’s dead. Let’s tell them.",
        ],
      },
      {
        when: { quest: "mill-the-bridge", state: "done" },
        lines: [
          "Thornvale is quiet. I don’t know what to do with quiet. I’ll learn.",
        ],
      },
      {
        lines: [
          "I’m the warden. One warden, one bow, one very large gang. I’ve done the sums.",
        ],
      },
    ],
  },
  pim: {
    id: "pim",
    name: "Pim",
    title: "Peddler",
    sprite: "villager",
    shop: "curios",
    shopName: "Pim’s Peddlery",
    talk: [
      {
        when: { quest: "thieves-cant", state: "active" },
        lines: [
          "Thieves’ cant? Me? I’m a humble peddler. …Give it here. Hm. No. There’s a cipher under the cant. That’s not gang work. That’s somebody paying for secrecy.",
          "My friend reads everything. She’s by the well, in the dark coat. She’ll want paying. She always wants paying.",
          "…She read it standing up. “Takings to Bess at the old tower. Powder from the coast. Hold the mill till the grey man says. Paid in the cold coin.” The rest is rude about the Reeve.",
        ],
      },
      {
        when: { quest: "hunt-black-bess", state: "active" },
        lines: [
          "Bess keeps the gang’s takings at the Old Watchtower. That’s what the orders said. Also that the Reeve has a face like a wet loaf.",
          "I didn’t write it. I only read it. Aloud. Twice.",
        ],
      },
      {
        when: { quest: "the-bandit-king", state: "done" },
        lines: [
          "No gang, no tolls. My prices are coming down. Not far. A little.",
        ],
      },
      {
        when: { quest: "thieves-cant", state: "done" },
        lines: [
          "My friend? Gone already. She does that. She left a note: “Tell your hero they owe me a drink. Two drinks.”",
        ],
      },
      {
        lines: [
          "Rings, charms, amulets, and a spoon that might be silver. Have a look.",
          "I pay the gang’s toll like everyone else. I just pay it in gossip.",
        ],
      },
    ],
  },
  // Act I cameo: the scout and thief who joins in Act II (STORY_BIBLE.md §2)
  nyx: {
    id: "nyx",
    name: "Nyx",
    title: "Reads everything, for a fee",
    sprite: "villager",
    talk: [
      {
        lines: [
          "You’re Pim’s hero? Huh. Taller in the story. Give it here.",
          "That’s not the gang’s cipher. The Gallows Gang can barely spell “gallows”. Somebody taught them this, and paid them in something cold. Pim has the rest.",
          "Fee’s three silver. Or one favor, later. I’ll know when I need it.",
        ],
      },
    ],
  },
};

/** The mill road freed, and Millbrook's grain reaching the camp. */
export const THORNVALE_EVENTS: Record<string, StoryEventDef> = {
  "mill-the-mill": {
    id: "mill-the-mill",
    region: "thornvale",
    kind: "raid",
    at: "mill-pond",
    radius: 10,
    level: 12,
    allies: ["sefa", "mill-militia", "mill-militia"],
    start: [
      {
        who: "sefa",
        text: "Varric’s dead! Did nobody tell you? Then we’ll tell you!",
      },
      { who: "mill-militia", text: "For Millbrook! Er — for the mill!" },
    ],
    waves: [
      {
        enemies: ["bandit-cutthroat", "bandit-cutthroat", "bandit-archer"],
        from: ["mill-north", "mill-east"],
      },
      {
        enemies: [
          "bandit-enforcer",
          "hedge-witch",
          "bandit-cutthroat",
          "bandit-archer",
        ],
        from: ["mill-west", "mill-north"],
        barks: [
          {
            who: "sefa",
            text: "Witch first! She’ll patch them faster than we cut them!",
          },
        ],
      },
      {
        enemies: [
          "bandit-enforcer",
          "bandit-enforcer",
          "bandit-cutthroat",
          "bandit-cutthroat",
          "bandit-archer",
        ],
        from: ["mill-north", "mill-east", "mill-west"],
        barks: [
          {
            who: "mill-militia",
            text: "That’s their last! That’s all of them!",
          },
        ],
      },
    ],
    end: [
      {
        who: "sefa",
        text: "Burn it. Burn the barricade. I want them to see it from Briarhollow.",
      },
      { who: "mill-militia", text: "Can we keep one cart? It’s a good cart." },
    ],
    retry: [
      {
        who: "sefa",
        text: "Back! Fall back to the road! We go again on my word!",
      },
    ],
  },
  "camp-grain": {
    id: "camp-grain",
    region: "briarhollow",
    kind: "arrival",
    at: "briar-square",
    radius: 18,
    arrive: {
      pets: ["mill-carter", "mill-carter", "mill-militia"],
      from: "briar-south",
      to: "briar-granary",
    },
    banner: "Millbrook’s grain",
    start: [
      {
        who: "mill-carter",
        text: "Grain from Millbrook! Twelve carts! And hens. Tobin sent hens.",
      },
    ],
    waves: [],
    end: [
      {
        who: "briar-oda",
        text: "Twelve carts! I haven’t seen twelve of anything since spring!",
      },
    ],
  },
};
