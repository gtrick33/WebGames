import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Millbrook's people and Thornvale's quests (Act I, STORY_BIBLE.md §3). The Gallows Gang under Harlan
 * Blackglove is bleeding Millbrook dry with its "rope tax" (pay in silver or hang on Gallows Hill) and
 * holds the mill on Miller's Pond so that no grain leaves the vale. Harlan is paid in ash-gold: the
 * Ashen Host wants the Vale hungry. The story runs from the Burnt Farm through Redcap Camp and the Old
 * Watchtower down into Gallows Keep, then back to break the blockade at the mill; Nyx turns up to read
 * the gang's cipher for Pim, and goes up Gallows Hill ahead of the hero. Tobin and Hanna have side errands, and the gang's powder trail
 * points east to Gullport. Millbrook's grain goes north to Briarhollow's camp. Order matters: the main
 * chain comes first, so it is the quest the hero follows by default.
 */
export const THORNVALE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'south-road',
    name: 'The South Road',
    giver: 'maren',
    text: 'Briarhollow’s camp is full, and it needs grain for the winter. Millbrook, south in Thornvale, grows the Vale’s grain. But a gang called the Gallows Gang has taken its mill, and no grain can leave. Take the south road and find Reeve Aldous in Millbrook.',
    offer: ['Fernstead’s rangers are watching our roads now. Thank you.', 'Next we need food. The camp is full of people, and winter is coming.', 'Millbrook grows the Vale’s grain, but a gang has taken its mill. Take the south road and find Reeve Aldous.'],
    objective: { kind: 'talk', npc: 'reeve-aldous', label: 'Talk to Reeve Aldous in Millbrook' },
    // Act I goes village by village: Fernstead first, then Millbrook
    after: ['camp-scouts'],
    level: 7,
    reward: { xp: 110, gold: 40 },
  },
  /* ---------------------------------------------------- the Gallows Gang */
  {
    id: 'kettle-farm',
    name: 'The Burnt Farm',
    giver: 'reeve-aldous',
    auto: true,
    text: 'The Kettle family refused to pay the Gallows Gang’s rope tax. Two nights later, their farm burned down. Reeve Aldous wants to know who did it. The Burnt Farm is north-east of Millbrook.',
    objective: { kind: 'explore', spot: 'east-farm', label: 'Look around the Burnt Farm' },
    after: ['south-road'],
    zone: 'thornvale',
    reward: { xp: 160, gold: 64, text: 'A dead gang member in a red cap lies by the well. In his coat are written orders in a secret code that nobody in Millbrook can read.' },
  },
  {
    id: 'thieves-cant',
    name: 'Thieves’ Cant',
    giver: 'reeve-aldous',
    auto: true,
    text: 'Nobody in Millbrook can read the orders from the Burnt Farm. Pim the peddler says his friend Nyx can read any code, for a fee. She is somewhere near the well in Millbrook. Find Nyx and have her read the orders.',
    objective: { kind: 'talk', npc: 'nyx', label: 'Have Nyx read the gang’s orders' },
    after: ['kettle-farm'],
    zone: 'thornvale',
    reward: { xp: 240, gold: 60, text: 'The “warm iron” is a sigil, like the one hidden under Briarhollow’s chapel bell. Someone is paying the Gallows Gang to hunt for sigils. Nyx won’t take your silver. She wants to know who wrote the orders.' },
  },
  {
    id: 'the-bandit-king',
    name: 'The Bandit King',
    giver: 'reeve-aldous',
    auto: true,
    text: 'The orders were sent to Harlan Blackglove, the leader of the Gallows Gang. He rules from Gallows Keep, a fort dug into Gallows Hill, south-east of Millbrook. Defeat him. That ends the rope tax and the gang’s hunt for sigils.',
    objective: { kind: 'boss', boss: 'varric', label: 'Defeat Harlan Blackglove in Gallows Keep' },
    after: ['thieves-cant'],
    zone: 'thornvale',
    level: 11,
    reward: { xp: 900, gold: 320, item: 'blackhand-coat', perk: 'satchel', text: 'As he dies, Harlan says he was paid in gold that weighs nothing. Behind his throne is a strongbox full of cold grey coins. Millbrook thanks you with his coat and a satchel that holds six more items. Nyx picks up a coin and says she is coming with you to find out who pays in them.' },
  },
  {
    id: 'mill-the-bridge',
    name: 'The Mill Road',
    auto: true,
    giver: 'reeve-aldous',
    text: 'Harlan is dead, but his hired fighters still hold the mill on Miller’s Pond behind a barricade of carts. No grain can leave Millbrook. Sefa, Millbrook’s warden, has gathered the village lads. Break the blockade with them and burn the barricade.',
    objective: { kind: 'event', event: 'mill-the-mill', label: 'Break the blockade at the mill on Miller’s Pond' },
    after: ['the-bandit-king'],
    zone: 'thornvale',
    level: 12,
    reward: { xp: 600, gold: 180, text: 'The barricade burns all night. In the morning the mill wheel turns, and the first grain carts head north to Briarhollow.' },
  },
  /* ------------------------------------------------------- Tobin's farm */
  {
    id: 'tobins-fields',
    name: 'Tobin’s Farm',
    giver: 'tobin',
    text: 'Wolves came down from the hills and killed Tobin’s sheep. He hasn’t been home since. His farm is west of Millbrook. Go and see if anything is left.',
    objective: { kind: 'explore', spot: 'tobins-farm', label: 'Check on Tobin’s Farm' },
    after: ['south-road'],
    zone: 'thornvale',
    reward: { xp: 130, gold: 60 },
  },
  {
    id: 'wolf-pelts',
    name: 'Pelts for Winter',
    giver: 'tobin',
    text: 'Tobin wants six pelts from the hill wolves that killed his flock. He will use them to keep his new lambs warm next spring.',
    objective: { kind: 'loot', region: 'thornvale', item: 'Wolf Pelt', from: ['hill-wolf'], chance: 0.5, count: 6, label: 'Collect Wolf Pelts from hill wolves' },
    after: ['tobins-fields'],
    zone: 'thornvale',
    reward: { xp: 170, gold: 75 },
  },
  {
    id: 'hunt-old-greymane',
    name: 'Old Greymane',
    giver: 'tobin',
    text: 'The wolves follow Old Greymane, the oldest wolf in the hills. He dens in the Wolfrun Hills, south of Tobin’s farm. Kill him, and the hills will be safe. Tobin will reward you.',
    objective: { kind: 'kill', region: 'thornvale', count: 1, enemies: ['old-greymane'], label: 'Defeat Old Greymane in the Wolfrun Hills' },
    after: ['wolf-pelts'],
    zone: 'thornvale',
    level: 11,
    reward: { xp: 360, gold: 110, perk: 'flask', text: 'Tobin gives you his grandfather’s flask: you can carry one more potion.' },
  },
  /* ------------------------------------------------------ Hanna's tonic */
  /* ------------------------------------------------------------ errands */
  {
    id: 'tobins-letter',
    name: 'A Letter for Hanna',
    giver: 'tobin',
    text: 'Tobin has written a letter to Hanna, who runs Millbrook’s inn. He rewrote it six times. Take it to her before he loses his nerve.',
    objective: { kind: 'talk', npc: 'hanna', label: 'Deliver Tobin’s letter to Hanna' },
    after: ['south-road'],
    zone: 'thornvale',
    level: 9,
    reward: { xp: 140, gold: 40 },
  },
];

export const THORNVALE_NPCS: Record<string, NpcDef> = {
  'reeve-aldous': {
    id: 'reeve-aldous',
    name: 'Reeve Aldous',
    title: 'Reeve of Millbrook',
    sprite: 'villager',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['The mill is turning and the bridge is ours. Our carts came home from Briarhollow empty, and I’m glad they did.', 'Tobin’s hens came home too.'] },
      {
        when: { quest: 'south-road', state: 'active' },
        lines: [
          'Maren sent you? Thank you for coming. I’m Aldous, the reeve of Millbrook.',
          'The Gallows Gang makes us pay a “rope tax.” We pay in silver, or they hang one of us on Gallows Hill.',
          'They’ve also taken our mill. They don’t grind any grain. They just stop it from leaving.',
          'Someone must be paying them to keep the Vale hungry. I want to know who.'
        ],
      },
      {
        when: { quest: 'kettle-farm', state: 'active' },
        lines: ['The Kettles refused to pay the rope tax. Two nights later, their farm burned down.', 'It’s north-east of the village. Go and find out who did it.'],
      },
      {
        when: { quest: 'thieves-cant', state: 'active' },
        lines: ['These orders are in a secret code. Nobody in Millbrook can read it.', 'Ask Pim, the peddler by the well. He knows people who can.'],
      },
      {
        when: { quest: 'the-bandit-king', state: 'active' },
        lines: ['Harlan Blackglove rules the gang from Gallows Keep. His executioner and his war-hound guard the way in.', 'Defeat him, and I’ll give you Millbrook’s finest satchel. It holds more than you’d think.'],
      },
      { when: { quest: 'mill-the-bridge', state: 'active' }, lines: ['Harlan’s strongbox was full of grey coins that weigh nothing. Somebody paid him to keep us hungry.', 'His fighters still hold the mill. Sefa has gathered the lads. Go with them and burn that barricade.'] },
      { when: { quest: 'mill-the-bridge', state: 'done' }, lines: ['The mill is free, and Millbrook can sleep at night again.', 'Our grain is going north to Elder Maren’s camp. Show her those grey coins. She may know what they are.'] },
      { lines: ['Welcome to Millbrook. We grow the Vale’s grain.', 'Watch out for the Gallows Gang if you go out. They wear red caps.'] },
    ],
  },
  hanna: {
    id: 'hanna',
    name: 'Hanna',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Wayfarer’s Rest',
    talk: [
      {
        when: { quest: 'tobins-letter', state: 'active' },
        lines: ['A letter from Tobin? Let me read it.', 'Oh. He’s asking me to dinner. Tell him yes. Tuesday, here at the inn.'],
      },
      { lines: ['Welcome to the Wayfarer’s Rest. Potions on the shelf, stew in the pot.', 'Catch your breath between fights. Save potions for when something is still hitting you.'] },
    ],
  },
  tobin: {
    id: 'tobin',
    name: 'Tobin',
    title: 'Farmer',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'tobins-fields', state: 'active' },
        lines: ['Wolves came down from the hills and killed all my sheep.', 'My farm is west of the village. Will you go and see what’s left? I can’t face it.'],
      },
      {
        when: { quest: 'wolf-pelts', state: 'active' },
        lines: ['Bring me six wolf pelts. They’ll keep my new lambs warm.', 'The pack’s leader is an old wolf called Greymane. We’ll deal with him next.'],
      },
      {
        when: { quest: 'hunt-old-greymane', state: 'active' },
        lines: ['The pack follows Old Greymane, the oldest wolf in the hills.', 'He dens in the Wolfrun Hills, south of my farm. Kill him, and I’ll give you my granddad’s flask.'],
      },
      { when: { quest: 'tobins-letter', state: 'active' }, lines: ['Will you take this letter to Hanna at the inn? Please don’t read it.', 'I wrote it six times. I think this one is good enough.'] },
      { when: { quest: 'hunt-old-greymane', state: 'done' }, lines: ['The hills are quiet. I slept through the night for the first time in weeks.', 'Use that flask well. My granddad carried it for forty years.'] },
      { when: { quest: 'tobins-letter', state: 'done' }, lines: ['She said yes! Dinner on Tuesday!'] },
      { lines: ['Thornvale is good farmland. The gang and the wolves make it hard to live here.'] },
    ],
  },
  sefa: {
    id: 'sefa',
    name: 'Sefa',
    title: 'Warden',
    sprite: 'villager',
    talk: [
      { when: { quest: 'mill-the-bridge', state: 'active' }, lines: ['The lads are ready. There are six of them, and me.', 'Harlan’s fighters are still holding the mill. Let’s take it back.'] },
      { when: { quest: 'mill-the-bridge', state: 'done' }, lines: ['Thornvale is quiet now. It’s been a long time since it was.'] },
      { lines: ['I’m Millbrook’s warden. One warden with one bow can’t fight a whole gang. I’m glad you’re here.'] },
    ],
  },
  pim: {
    id: 'pim',
    name: 'Pim',
    title: 'Peddler',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Pim’s Peddlery',
    talk: [
      {
        when: { quest: 'thieves-cant', state: 'active' },
        lines: [
          'Let me see. It’s thieves’ cant, with a second code hidden under it. The gang didn’t make that up. Someone paid for it.',
          'My friend Nyx can read any code. She’s by the well, in the dark coat.',
          'She’ll want paying. She always does.',
        ],
      },
      { when: { quest: 'the-bandit-king', state: 'done' }, lines: ['No more gang means no more tolls. I can lower my prices a little.'] },
      { when: { quest: 'thieves-cant', state: 'done' }, lines: ['Nyx went up Gallows Hill ahead of you. She wants to know who is paying the gang.'] },
      { lines: ['Rings, charms and amulets. Have a look.', 'The gang takes a cut of everything I sell.'] },
    ],
  },
  // Act I cameo: the scout and thief who joins in Act II (STORY_BIBLE.md §2)
  nyx: {
    id: 'nyx',
    name: 'Nyx',
    title: 'Reads everything, for a fee',
    sprite: 'villager',
    talk: [
      {
        lines: [
          'I’m Nyx, by the way. Pim’s friend.',
          'These orders were sent to Harlan Blackglove. He leads the Gallows Gang from Gallows Keep.',
          'My fee is two silver. Keep it. I want to know who’s paying them.',
        ],
      },
    ],
  },
};

/** The mill road freed, and Millbrook's grain reaching the camp. */
export const THORNVALE_EVENTS: Record<string, StoryEventDef> = {
  'mill-the-mill': {
    id: 'mill-the-mill',
    region: 'thornvale',
    kind: 'raid',
    at: 'mill-pond',
    radius: 10,
    level: 12,
    allies: ['sefa', 'mill-militia', 'mill-militia'],
    start: [
      { who: 'sefa', text: 'Harlan is dead! Give up the mill!' },
      { who: 'mill-militia', text: 'For Millbrook!' },
    ],
    waves: [
      { enemies: ['bandit-cutthroat', 'bandit-cutthroat', 'bandit-archer'], from: ['mill-north', 'mill-east'] },
      { enemies: ['bandit-enforcer', 'hedge-witch', 'bandit-cutthroat', 'bandit-archer'], from: ['mill-west', 'mill-north'], barks: [{ who: 'sefa', text: 'Get the witch first! She heals them!' }] },
      { enemies: ['bandit-enforcer', 'bandit-enforcer', 'bandit-cutthroat', 'bandit-cutthroat', 'bandit-archer'], from: ['mill-north', 'mill-east', 'mill-west'], barks: [{ who: 'mill-militia', text: 'That’s their last! That’s all of them!' }] },
    ],
    end: [
      { who: 'sefa', text: 'Burn the barricade! Let the whole Vale see that the mill is free!' },
      { who: 'mill-militia', text: 'The road is open! The grain can go north!' },
    ],
    retry: [{ who: 'sefa', text: 'Fall back to the road! We go again on my word!' }],
  },
  'camp-grain': {
    id: 'camp-grain',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-square',
    radius: 18,
    arrive: { pets: ['mill-carter', 'mill-carter', 'mill-militia'], from: 'briar-south', to: 'briar-granary' },
    banner: 'Millbrook’s grain',
    // (what is said as they come in is said in the shot of it, data/scenes.ts)
    start: [],
    waves: [],
    end: [],
  },
};
