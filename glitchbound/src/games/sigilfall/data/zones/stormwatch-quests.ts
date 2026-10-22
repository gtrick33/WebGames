import type { NpcDef, QuestDef } from '../types';

/**
 * Stormwatch's people and the quests of Stormwatch Cliffs. The drowned fleet that the Drowned
 * Priestess raised has found the coast: black ships off the cliffs, crews walking up the shingle, a
 * storm somebody ordered. Admiral Blackwake means to put out the great light so his fleet can land in
 * the dark; Keeper Ansel means to keep it lit. The story runs from the Landing Beach through the Storm
 * Circle, Gale Roost and the Black Camp to Lighthouse Point. Bosun Pike's old ship has come back with
 * her captain, Captain Morra wants the Old Beacon lit again, and Odile wants the storm's heart in
 * glass. The main chain comes first, so it is the quest the hero follows by default.
 */
export const STORMWATCH_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-lighthouse-calls',
    name: 'The Lighthouse Calls',
    giver: 'harbormaster-quill',
    text: 'Harbormaster Quill’s letter caught up with you: a gull flew into Gullport from Stormwatch with a note from Keeper Ansel tied to its leg. Black ships off the cliffs, closer every night, and crews that don’t breathe. The drowned fleet has found the coast east of the Amberfield. Take the east road out of the Amberfield to Stormwatch and find Keeper Ansel.',
    objective: { kind: 'talk', npc: 'keeper-ansel', label: 'Talk to Keeper Ansel in Stormwatch' },
    after: ['the-drowned-fleet'],
    level: 26,
    reward: { xp: 650, gold: 200 },
  },
  /* ---------------------------------------------------- the last light */
  {
    id: 'black-sails',
    name: 'Black Sails',
    giver: 'keeper-ansel',
    text: 'Last night a black ship ran in under the storm and put boats ashore at the Landing Beach, on the shore south-west of town. Ansel watched them from the lantern room: forty shapes walking up the shingle without a lantern between them. Go and see what they left behind. Ansel would go himself, but somebody has to keep the light.',
    objective: { kind: 'explore', spot: 'landing-beach', label: 'Search the Landing Beach' },
    after: ['the-lighthouse-calls'],
    zone: 'stormwatch',
    reward: { xp: 700, gold: 210 },
  },
  {
    id: 'hold-the-shore',
    name: 'Hold the Shore',
    giver: 'captain-morra',
    text: 'Captain Morra has eleven watchmen, a shore a day’s walk long and a drowned crew coming up it every night. She needs the shore emptied faster than the sea can refill it. Cut down the drowned wherever they climb out along the shore south of town: sailors, gunners, brutes, the lot.',
    objective: { kind: 'kill', region: 'stormwatch', count: 12, enemies: ['drowned-sailor', 'drowned-gunner', 'barnacle-brute', 'drowned-chanter'], label: 'Defeat the drowned' },
    after: ['black-sails'],
    zone: 'stormwatch',
    reward: { xp: 900, gold: 230 },
  },
  {
    id: 'sealed-in-tar',
    name: 'Sealed in Tar',
    giver: 'captain-morra',
    text: 'The drowned gunners carry orders wrapped in tarred oilskin, bone-dry after years under the sea. The dead don’t write each other letters for fun. Morra wants four. The gunners walk with the crews along the shore and around the Landing Beach, always at the back, so look behind the cutlasses.',
    objective: { kind: 'loot', region: 'stormwatch', item: 'Tarred Dispatch', from: ['drowned-gunner'], chance: 0.45, count: 4, label: 'Take Tarred Dispatches from drowned gunners' },
    after: ['hold-the-shore'],
    zone: 'stormwatch',
    reward: { xp: 850, gold: 230 },
  },
  {
    id: 'signal-flags',
    name: 'Signal Flags',
    giver: 'keeper-ansel',
    text: 'The dispatches aren’t written in words but in rows of little painted flags: the old navy’s signal code. Nobody in the Watch can read it. Bosun Pike flew those flags for thirty years and will tell you so at length. He keeps the Drowned Man, the inn on the square.',
    objective: { kind: 'talk', npc: 'bosun-pike', label: 'Bring the dispatches to Bosun Pike' },
    after: ['sealed-in-tar'],
    zone: 'stormwatch',
    reward: { xp: 750, gold: 240 },
  },
  {
    id: 'eye-of-the-storm',
    name: 'Eye of the Storm',
    giver: 'keeper-ansel',
    text: 'Pike read the flags: “Wait for the storm. When the light dies, the fleet lands.” So the storm was ordered, and Ansel thinks he knows where from. North-east of town the standing stones of the Storm Circle hum on still nights, and elementals spin out of the clouds above them. Break up what the circle has called down.',
    objective: { kind: 'kill', region: 'stormwatch', count: 8, enemies: ['storm-elemental', 'storm-wisp'], label: 'Defeat storm elementals and wisps' },
    after: ['signal-flags'],
    zone: 'stormwatch',
    level: 27,
    reward: { xp: 1000, gold: 250 },
  },
  {
    id: 'the-stolen-prisms',
    name: 'The Stolen Prisms',
    giver: 'keeper-ansel',
    text: 'With the gale down to a howl, Ansel could climb his own tower again, and found the lantern room broken open and the great lens stripped of its prisms. Storm harpies take anything that shines. They hoard it at Gale Roost on the cliffs in the far north-west, and at the Old Beacon north of town. Get the prisms back before the next storm.',
    objective: { kind: 'loot', region: 'stormwatch', item: 'Lens Prism', from: ['storm-harpy', 'galemother'], chance: 0.4, count: 5, label: 'Take back Lens Prisms from storm harpies' },
    after: ['eye-of-the-storm'],
    zone: 'stormwatch',
    level: 28,
    reward: { xp: 1000, gold: 260 },
  },
  {
    id: 'the-black-camp',
    name: 'The Choir on the Shore',
    giver: 'captain-morra',
    text: 'The fleet’s shore party has dug in at the Black Camp in the far east, and its chanters sing more drowned out of the surf every night. Every verse is another cutlass on Morra’s shore. Silence the chanters, and the Admiral lands a few crews short.',
    objective: { kind: 'kill', region: 'stormwatch', count: 5, enemies: ['drowned-chanter'], label: 'Silence drowned chanters' },
    after: ['the-stolen-prisms'],
    zone: 'stormwatch',
    level: 28,
    reward: { xp: 1100, gold: 280, item: { rarity: 'rare' } },
  },
  {
    id: 'the-last-light',
    name: 'The Last Light',
    giver: 'keeper-ansel',
    text: 'The prisms are back, the lamp is lit and the storm is coming in to meet it. Admiral Blackwake has come ashore himself at Lighthouse Point, under the light south-east of town, with his honor guard and a whistle for his crews, to put the lamp out with his own hands. Stand between him and the light. If it burns till dawn, his fleet comes in blind.',
    objective: { kind: 'kill', region: 'stormwatch', count: 1, enemies: ['admiral-blackwake'], label: 'Defeat Admiral Blackwake at Lighthouse Point' },
    after: ['the-black-camp'],
    zone: 'stormwatch',
    level: 29,
    reward: {
      xp: 3700,
      gold: 900,
      item: 'ansels-storm-lantern',
      text: 'The light burns till dawn. Blind in the storm, the black ships come on and break on the Shipbreaker Rocks one after another, and the drowned fleet goes back to the bottom. Ansel gives you his old storm lantern.',
    },
  },
  /* -------------------------------------------------- Bosun Pike's ship */
  {
    id: 'the-gloam-rises',
    name: 'The Gloam Rises',
    giver: 'bosun-pike',
    text: 'Bosun Pike sailed thirty years on the Gloam, until she went down off these cliffs with all hands but him. This week the fishermen saw her lying on the shore south-east of town as if the sea had spat her back, with her captain at the wheel. Pike would like somebody to tell him they were drunk. Go and look at the Wreck of the Gloam.',
    objective: { kind: 'explore', spot: 'wreck-of-the-gloam', label: 'Find the Wreck of the Gloam' },
    after: ['the-lighthouse-calls'],
    zone: 'stormwatch',
    level: 27,
    reward: { xp: 800, gold: 220 },
  },
  {
    id: 'pikes-whistles',
    name: 'The Bosun’s Whistles',
    giver: 'bosun-pike',
    text: 'It’s true, then. Pike sits down for that. Every hand on the Gloam carried a bone whistle he carved for them, and every one of them has come up the beach with the rest of the drowned. He wants the whistles back from the drowned sailors, wherever along the shore they have wandered. He says it’s so the crew can rest. He says it into his beer.',
    objective: { kind: 'loot', region: 'stormwatch', item: 'Bone Whistle', from: ['drowned-sailor'], chance: 0.3, count: 6, label: 'Recover Bone Whistles from drowned sailors' },
    after: ['the-gloam-rises'],
    zone: 'stormwatch',
    level: 27,
    reward: { xp: 900, gold: 240 },
  },
  {
    id: 'the-captains-bell',
    name: 'The Captain’s Bell',
    giver: 'bosun-pike',
    text: 'Captain Gloam still rings the ship’s bell, and his crew still comes when he does. Pike served under him for thirty years and would like him relieved of command. Find the captain at his wreck on the shore south-east of town, and ring his bell for the last time.',
    objective: { kind: 'kill', region: 'stormwatch', count: 1, enemies: ['captain-gloam'], label: 'Defeat Captain Gloam at his wreck' },
    after: ['pikes-whistles'],
    zone: 'stormwatch',
    level: 29,
    reward: { xp: 1600, gold: 420, item: 'bosuns-whistle', text: 'Pike threads the last of his whistles on a cord for you. “Blow it when you need all hands.”' },
  },
  /* ------------------------------------------------ Captain Morra's beacon */
  {
    id: 'the-old-beacon',
    name: 'The Old Beacon',
    giver: 'captain-morra',
    text: 'Before there was a lighthouse, the Watch kept a beacon on the cliffs north of town, and Morra wants it lit again: two lights are harder to put out than one. She sent two watchmen up with a cart of pitch. They came back without the cart, or their eyebrows. See what has moved into the Old Beacon.',
    objective: { kind: 'explore', spot: 'old-beacon', label: 'Look over the Old Beacon' },
    after: ['the-lighthouse-calls'],
    zone: 'stormwatch',
    reward: { xp: 750, gold: 220 },
  },
  {
    id: 'clear-the-cliffs',
    name: 'Clear the Cliffs',
    giver: 'captain-morra',
    text: 'Storm harpies nest in the beacon’s brazier now, and in every crack along the cliff tops. Morra’s watchmen will take the beacon back with buckets of pitch, once somebody has taken it back with something sharper. Thin out the storm harpies along the north cliffs, from the Old Beacon to Gale Roost in the far north-west.',
    objective: { kind: 'kill', region: 'stormwatch', count: 10, enemies: ['storm-harpy'], label: 'Defeat storm harpies' },
    after: ['the-old-beacon'],
    zone: 'stormwatch',
    level: 27,
    reward: { xp: 950, gold: 250 },
  },
  {
    id: 'the-galemother',
    name: 'The Galemother',
    giver: 'captain-morra',
    text: 'The harpies come back as fast as you cut them down, and they come from Gale Roost in the far north-west, where the Galemother broods in the wind. The Watch’s cobbler has promised boots of her hide to whoever brings it. Morra is passing on the cobbler’s promise, as it’s all she has.',
    objective: { kind: 'kill', region: 'stormwatch', count: 1, enemies: ['galemother'], label: 'Defeat the Galemother at Gale Roost' },
    after: ['clear-the-cliffs'],
    zone: 'stormwatch',
    level: 28,
    reward: { xp: 1600, gold: 420, item: 'galestride-boots', text: 'The cobbler keeps his promise, and the Old Beacon burns on the north cliffs again.' },
  },
  /* ------------------------------------------------------ Odile's glass */
  {
    id: 'stormglass',
    name: 'Stormglass',
    giver: 'odile',
    text: 'Odile grinds the lighthouse’s lenses, and the best glass there is comes from where lightning strikes sand. Storm elementals are full of it: when they come apart they leave shards of stormglass behind, still warm. She needs six for a new lens, and is far too sensible to fetch them herself. The elementals drift over the high ground north and east of town.',
    objective: { kind: 'loot', region: 'stormwatch', item: 'Stormglass Shard', from: ['storm-elemental', 'storm-wisp'], chance: 0.4, count: 6, label: 'Collect Stormglass Shards from storm elementals and wisps' },
    after: ['the-lighthouse-calls'],
    zone: 'stormwatch',
    level: 27,
    reward: { xp: 900, gold: 240 },
  },
  {
    id: 'a-heart-of-lightning',
    name: 'A Heart of Lightning',
    giver: 'odile',
    text: 'The bigger elementals carry a heart: a knot of lightning that never goes out. Odile has always wanted to set one in glass. She has also always wanted to keep all ten fingers, which is where you come in. Storm elementals gather thickest at the Storm Circle, north-east of town.',
    objective: { kind: 'loot', region: 'stormwatch', item: 'Storm Heart', from: ['storm-elemental'], chance: 0.25, count: 2, label: 'Take Storm Hearts from storm elementals' },
    after: ['stormglass'],
    zone: 'stormwatch',
    level: 28,
    reward: { xp: 1400, gold: 380, item: 'stormglass-ring', text: 'Odile sets a sliver of storm heart in a band of stormglass, and only swears twice.' },
  },
];

export const STORMWATCH_NPCS: Record<string, NpcDef> = {
  'keeper-ansel': {
    id: 'keeper-ansel',
    name: 'Keeper Ansel',
    title: 'Keeper of the Light',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-lighthouse-calls', state: 'active' },
        lines: ['Quill sent you? Then the gull made it. I wasn’t sure. It was a very old gull.', 'I’m Ansel. I keep the light. Forty years, and I’ve never once let it go out. I’d like to make it forty-one.'],
      },
      {
        when: { quest: 'black-sails', state: 'active' },
        lines: ['A black ship came in under the storm last night and put boats on the Landing Beach, south-west of here. I watched them walk up the shingle. Not one of them carried a lantern.', 'Go and see what they left. I’d go myself, but somebody has to keep the light.'],
      },
      { when: { quest: 'hold-the-shore', state: 'active' }, lines: ['Morra’s gone to war with the sea. Help her. The sea has more soldiers, but they’re slower.'] },
      { when: { quest: 'sealed-in-tar', state: 'active' }, lines: ['Orders, Morra says? The dead write each other orders? I suppose somebody has to tell them where to stand.'] },
      {
        when: { quest: 'signal-flags', state: 'active' },
        lines: ['Little flags in rows. That’s the old navy signal code. I never learned it. I had a lighthouse to learn.', 'Pike flew those flags for thirty years. He keeps the Drowned Man, on the square. He’ll read them for you, and then he’ll tell you about it.'],
      },
      {
        when: { quest: 'eye-of-the-storm', state: 'active' },
        lines: ['“Wait for the storm. When the light dies, the fleet lands.” So the storm was ordered. Like a pie.', 'North-east of town there’s a ring of old standing stones, the Storm Circle. On still nights it hums, and things spin out of the clouds above it. Go and break up the weather.'],
      },
      {
        when: { quest: 'the-stolen-prisms', state: 'active' },
        lines: ['I climbed the tower this morning, the first time the wind’s let me up in a week. The lantern room is smashed open and the lens is stripped bare.', 'Harpies. They take anything that shines and hoard it at Gale Roost, in the far north-west, and up at the Old Beacon. Five prisms and I can make her shine again.'],
      },
      {
        when: { quest: 'the-black-camp', state: 'active' },
        lines: ['The lens is whole. I cleaned every prism twice, and one of them three times, out of spite.', 'Morra is going after the Black Camp. Go with her. The fewer drowned on the shore when the Admiral lands, the better.'],
      },
      {
        when: { quest: 'the-last-light', state: 'active' },
        lines: ['He’s here. The Admiral. He came ashore at Lighthouse Point with his guard, right under my light, to put it out with his own hands.', 'Stand between him and the lamp. If it burns till dawn, his fleet comes in blind, and the Shipbreaker Rocks will do the rest.'],
      },
      {
        when: { quest: 'the-last-light', state: 'done' },
        lines: ['It burned all night. I watched the black ships come in and break on the rocks, one after another, until the sea was nothing but timber.', 'Forty-one years. Thank you. Go and sleep. I’ll keep the light.'],
      },
      { lines: ['This is Stormwatch, under the last light on the coast. Ships see it forty miles out. Lately, so do things that aren’t ships.', 'Mind the cliffs in the rain. Mind the sea always.'] },
    ],
  },
  'captain-morra': {
    id: 'captain-morra',
    name: 'Captain Morra',
    title: 'Captain of the Watch',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'hold-the-shore', state: 'active' },
        lines: ['Morra, captain of the Watch. Eleven watchmen, one shore, and a sea that keeps sending more.', 'They climb out of the surf every night. Cut them down wherever you find them. The sea refills them, just not as fast as you can empty them.'],
      },
      {
        when: { quest: 'sealed-in-tar', state: 'active' },
        lines: ['The gunners carry orders in tarred oilskin. Dry as a sermon after ten years under the sea.', 'Bring me four. They keep to the back of every crew, behind the cutlasses. Cowards’ habits. Death doesn’t cure them.'],
      },
      {
        when: { quest: 'the-black-camp', state: 'active' },
        lines: ['The fleet has dug in at the Black Camp, in the far east. Its chanters sing more drowned out of the surf every night.', 'Silence the singers. Every one you stop is a crew the Admiral doesn’t get.'],
      },
      {
        when: { quest: 'the-old-beacon', state: 'active' },
        lines: ['Before the lighthouse, the Watch kept a beacon on the north cliffs. Two lights are harder to put out than one.', 'I sent two lads up with a cart of pitch. They came back without the cart, or their eyebrows. Go and see what’s up there.'],
      },
      {
        when: { quest: 'clear-the-cliffs', state: 'active' },
        lines: ['Harpies. Nesting in my beacon. In the brazier, where the fire goes.', 'Thin them out along the cliffs. My lads will take it back with buckets of pitch once you’ve taken it back with something sharper.'],
      },
      {
        when: { quest: 'the-galemother', state: 'active' },
        lines: ['They come back as fast as we cut them down, and they come from Gale Roost, in the far north-west. The Galemother broods there.', 'The cobbler says he’ll make boots of her hide for whoever brings it. I’m passing on his offer. It’s all I’ve got.'],
      },
      { when: { quest: 'the-last-light', state: 'done' }, lines: ['The fleet is on the rocks and the Watch is still standing. All eleven. I counted twice.'] },
      { when: { quest: 'the-galemother', state: 'done' }, lines: ['The beacon is burning on the north cliffs. Two lights. Let them try to put out both.'] },
      { lines: ['The Watch keeps Stormwatch. Somebody has to, and the sea won’t.', 'If you hear a bell out on the water at night, don’t go and look. That’s an order. It’s also advice.'] },
    ],
  },
  'bosun-pike': {
    id: 'bosun-pike',
    name: 'Bosun Pike',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Drowned Man',
    talk: [
      {
        when: { quest: 'signal-flags', state: 'active' },
        lines: [
          'Navy signals! I haven’t read a hoist in ten years. Give it here.',
          '“Wait for the storm. When the light dies, the fleet lands. All of it.” Signed: Blackwake, Admiral. Never heard of him. Don’t want to.',
          'That’s the gist. The rest is weather and bad spelling.',
        ],
      },
      {
        when: { quest: 'the-gloam-rises', state: 'active' },
        lines: ['Thirty years I sailed on the Gloam. She went down off these cliffs in a storm, all hands but me. I was up the rigging, and the sea threw me back. It didn’t want me.', 'Now the fishermen say she’s lying on the shore south-east of town, with the captain at her wheel. Tell me they were drunk.'],
      },
      {
        when: { quest: 'pikes-whistles', state: 'active' },
        lines: ['It’s true, then. Give me a moment.', 'I carved a whistle for every hand on the Gloam. They’ll be carrying them still. Bring them home and the crew can rest. That’s what I tell myself.'],
      },
      {
        when: { quest: 'the-captains-bell', state: 'active' },
        lines: ['Captain Gloam. Thirty years under him, and he never once said thank you. He said “Pike!” a lot.', 'He rings that bell and the crew comes. Relieve him of command. Gently if you can. Firmly if you can’t.'],
      },
      { when: { quest: 'the-last-light', state: 'done' }, lines: ['Black ships on the Shipbreaker Rocks all morning! First round’s on the house. Second round too. Third round, we’ll see.'] },
      {
        when: { quest: 'the-captains-bell', state: 'done' },
        lines: ['The bell’s quiet. I slept with the window open last night, the first time in ten years.', 'I hung the whistles on the stones at the Sailors’ Rest, up the hill north-west of town. One for every hand. Keep the last one on you, and make it count.'],
      },
      { lines: ['The Drowned Man. It was called that before the drowned came, and I’m not changing it for them.', 'Potions on the shelf, rum under it. One of those is for the road.'] },
    ],
  },
  odile: {
    id: 'odile',
    name: 'Odile',
    title: 'Glasswright',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Lens & Charm',
    talk: [
      {
        when: { quest: 'stormglass', state: 'active' },
        lines: ['When lightning strikes sand it leaves glass behind. Stormglass. It makes the best lens in the world and the worst necklace.', 'The storm elementals are full of it. When they come apart they leave shards. Six, please. Still warm, if you can.'],
      },
      {
        when: { quest: 'a-heart-of-lightning', state: 'active' },
        lines: ['The big elementals carry a heart: a knot of lightning that never goes out. I have always wanted to set one in glass.', 'I have also always wanted to keep all ten fingers. Two hearts, please. The Storm Circle, north-east of town, has plenty.'],
      },
      { when: { quest: 'the-stolen-prisms', state: 'active' }, lines: ['The harpies took Ansel’s prisms? I ground those prisms. Six months each.', 'Bring them back and I’ll forgive the harpies. No I won’t.'] },
      { when: { quest: 'a-heart-of-lightning', state: 'done' }, lines: ['The ring hums before thunder. It also hums during supper, which I can’t explain. Wear it anyway.'] },
      { lines: ['Lens & Charm. Glass for the lighthouse, charms for the brave, rings for the vain. Most people are two of those.', 'Don’t tap the glass. Everyone taps the glass.'] },
    ],
  },
};
