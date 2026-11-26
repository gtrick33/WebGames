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
    text: 'The camp that guards Elyra and her sigil is growing, and it needs grain before winter. Millbrook, south in Thornvale, grows the Vale’s grain. But a gang called the Gallows Gang has taken its mill, and no grain can leave. The gang nails its notices to every post in the village: tear them down as you go in, and find Reeve Aldous.',
    offer: ['Fernstead’s rangers are watching our roads now. Thank you.', 'Next we need food. Sixty mouths in the camp, more every week, and winter is coming.', 'Millbrook grows the Vale’s grain, but a gang has taken its mill. Take the south road and find Reeve Aldous.'],
    // (it was a walk and a talk. The gang's notices are the first thing a stranger sees of Millbrook, and tearing them
    // down is the first thing Millbrook sees of the stranger)
    objective: {
      kind: 'use', region: 'thornvale', at: 'reeve-aldous', count: 3, thing: 'notice', verb: 'Tear down', label: 'Tear down the gang’s notices in Millbrook', secs: 0.8, spread: 9,
      notes: ['“ROPE TAX. Three silver a head, or the hill.”', 'Millbrook’s names under a drawn noose. Four are crossed out.', '“NO GRAIN LEAVES THE VALE. By order of H. Blackglove.”'],
    },
    then: [{ kind: 'talk', npc: 'reeve-aldous', label: 'Talk to Reeve Aldous' }],
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
    text: 'The Kettle family refused to pay the Gallows Gang’s rope tax. Two nights later, their farm burned down. Reeve Aldous wants to know who did it. The Burnt Farm is north-east of Millbrook. Red Caps were seen on the road there again this morning.',
    objective: { kind: 'explore', spot: 'east-farm', label: 'Look around the Burnt Farm' },
    // (it was a walk to a spot: the gang's men stood at the farm and nothing asked the hero to deal with them. Now
    // they have come back for what their dead man carries, and the orders are won from them)
    then: [
      // what happened here is read from what is left; the gang's men come back while the hero is at it
      {
        kind: 'use', region: 'thornvale', at: 'east-farm', count: 3, thing: 'crate', verb: 'Search', label: 'Search what is left of the farm', spread: 5, ambush: ['bandit-cutthroat'],
        notes: ['The barn door was barred from outside before it was lit.', 'A pitchfork in the ash, bloody to the tines.', 'A dead Red Cap by the well. There are papers in his coat.'],
      },
      { kind: 'kill', region: 'thornvale', count: 2, enemies: ['bandit-cutthroat'], label: 'Drive off the Red Caps who came back for the papers', lair: { at: 'east-farm', enemies: ['bandit-cutthroat', 'bandit-cutthroat'] } },
    ],
    after: ['south-road'],
    zone: 'thornvale',
    find: {
      name: 'The Gang’s Orders',
      kind: 'orders',
      about: 'Folded papers from the coat of a dead Red Cap by the well at the Burnt Farm. His own gang came back to take them off him, and didn’t get to. They are written in thieves’ cant, with a code of numbers under it, and nobody in Millbrook can read them. Pim the peddler, by Millbrook’s well, has a friend named Nyx who can.',
      body: ['Blackglove. Skelp the dinger-kens of the Vale, high and low, and grub under every one.', 'Tote the warm smit to the grey cove at the four-ways. He drops full.', 'Keep the grist-wheel dumb till the white falls.', '7 14 2 · 9 9 21 · 3 18 4 11'],
    },
    reward: { xp: 160, gold: 64, text: 'The Kettles got out alive, with nothing. One of the men who burned them out lies dead by the well, a Red Cap with a pitchfork wound in his side. Old Kettle fought back, and the gang left their own man where he fell.' },
  },
  {
    id: 'thieves-cant',
    name: 'Thieves’ Cant',
    giver: 'reeve-aldous',
    auto: true,
    text: 'Nobody in Millbrook can read the orders from the Burnt Farm. Pim the peddler says his friend Nyx can read any code, for a fee. She is somewhere near the well in Millbrook. The code under the cant needs the gang’s own count-word: a Red Cap taken alive can be made to give it.',
    // (it was one talk. Nyx reads the cant at a glance, but the numbers under it turn on a word only the gang's own men
    // carry: one of them is taken alive and asked)
    objective: {
      kind: 'talk', npc: 'nyx', label: 'Show Nyx the gang’s orders',
      lines: ['I’m Nyx, Pim’s friend. Thieves’ cant on top: that part I can read standing on my head.', 'The numbers under it are another matter. They turn on a count-word, and every Red Cap carries it in his head.', 'Their camp is east of here. Beat one of them down and ask him. He has to be able to answer, so don’t kill him first.'],
    },
    then: [
      { kind: 'subdue', region: 'thornvale', enemies: ['bandit-cutthroat'], count: 1, verb: 'Question', label: 'Beat a Red Cap down and make him give the count-word', lair: { at: 'bandit-camp', enemies: ['bandit-cutthroat', 'bandit-archer'] } },
      {
        kind: 'talk', npc: 'nyx', label: 'Give Nyx the count-word',
        lines: ['“Hemp.” Of course it’s hemp. Hold the page still.', 'These went to Harlan Blackglove. He runs the Gallows Gang from Gallows Keep, dug into Gallows Hill.', 'My fee is two silver. Keep it. I want to know who pays in grey wax and grey coin.', 'I’ve been asking that since last winter. Men who paid in grey took my little brother, and nobody will tell me where he is.'],
      },
    ],
    after: ['kettle-farm'],
    zone: 'thornvale',
    find: {
      name: 'The Orders, as Nyx Reads Them',
      kind: 'orders',
      about: 'The Burnt Farm’s orders, as Nyx read them out by Millbrook’s well. The “warm iron” is a sigil. Someone is paying the Gallows Gang to dig under the Vale’s bell-chapels for one.',
      body: ['To Harlan Blackglove.', 'Hunt the bell-chapels of the Vale, high and low, and dig under every one.', 'Bring the warm iron to the grey man at the crossroads. He pays in full.', 'Keep Millbrook’s mill shut until the snow.'],
      sign: 'No name. Stamped with an empty crown in grey wax.',
    },
    reward: { xp: 240, gold: 60, text: 'The “warm iron” is a sigil, like the one that lay under Briarhollow’s chapel. The Pale Herald is not only sending raiders. He is paying the Vale’s own thieves to dig. Nyx won’t take your silver. She wants to know who pays in grey.' },
  },
  {
    id: 'the-bandit-king',
    name: 'The Bandit King',
    giver: 'reeve-aldous',
    auto: true,
    text: 'The orders were sent to Harlan Blackglove, the leader of the Gallows Gang. He rules from Gallows Keep, a fort dug into Gallows Hill, south-east of Millbrook. Those who could not pay still hang on the hill above it: cut them down, then go in and defeat him. That ends the rope tax and the gang’s hunt for sigils.',
    // (the rope tax is seen before its master is: the hill's dead are cut down on the way in, and Nyx has been here)
    objective: {
      kind: 'use', region: 'thornvale', at: 'thornvale-gallows-hill', count: 3, thing: 'gibbet', verb: 'Cut down', label: 'Cut down the rope-tax dead on Gallows Hill', spread: 5, guards: ['bandit-archer'],
      notes: ['A farmhand. “Three silver” is chalked on the post.', 'A tinker. His pack still lies at the foot of the post.', 'This rope is cut already, and fresh. Nyx was here first.'],
    },
    then: [{ kind: 'boss', boss: 'varric', label: 'Defeat Harlan Blackglove in Gallows Keep' }],
    after: ['thieves-cant'],
    zone: 'thornvale',
    level: 11,
    find: {
      name: 'A Coin of Ash-Gold',
      kind: 'token',
      about: 'One of the grey coins from the strongbox behind Harlan Blackglove’s throne in Gallows Keep. It weighs nothing and is always cold, like the coin the Pale Herald paid Morgrave with. One face is stamped with an empty crown. Elder Maren should see it.',
    },
    reward: { xp: 900, gold: 320, item: 'blackhand-coat', perk: 'satchel', text: 'As he dies, Harlan says the grey man at the crossroads paid him in gold that weighs nothing, and promised him the whole Vale. His strongbox is full of that cold grey coin. Millbrook thanks you with his coat and a satchel that holds six more items. Nyx pockets one coin and says she is coming with you to find out who makes them.' },
  },
  {
    id: 'mill-the-bridge',
    name: 'The Mill Road',
    auto: true,
    giver: 'reeve-aldous',
    text: 'Harlan is dead, but his hired fighters still hold the mill on Miller’s Pond behind a barricade of carts. No grain can leave Millbrook. Sefa, Millbrook’s warden, has gathered the village lads. Break the blockade with them, burn the barricade, and carry the mill’s first flour home to the Reeve.',
    objective: { kind: 'event', event: 'mill-the-mill', label: 'Break the blockade at the mill on Miller’s Pond' },
    // (the fight was the whole of it. Sefa's last word is to burn the barricade, and the hero does; then the mill's first
    // flour since spring goes up the road on the hero's shoulder, with what is left of the gang after it)
    then: [
      { kind: 'use', region: 'thornvale', at: 'mill-pond', count: 3, thing: 'cart', verb: 'Burn', label: 'Burn the gang’s barricade', secs: 1.2, spread: 5 },
      { kind: 'carry', region: 'thornvale', from: 'mill-pond', to: 'reeve-aldous', thing: 'sack', verb: 'Shoulder the flour', label: 'Carry the mill’s first flour to Reeve Aldous', ambush: [['bandit-cutthroat', 'bandit-archer']] },
    ],
    after: ['the-bandit-king'],
    zone: 'thornvale',
    level: 12,
    reward: { xp: 600, gold: 180, text: 'The barricade burns all night, and two of Sefa’s lads are buried by the pond in the morning. Then the mill wheel turns for the first time since spring, and the first grain carts head north to Briarhollow.' },
  },
  /* ------------------------------------------------------- Tobin's farm */
  {
    id: 'tobins-fields',
    name: 'Tobin’s Farm',
    giver: 'tobin',
    text: 'Wolves came down from the hills and killed Tobin’s sheep. He hasn’t been home since. His farm is west of Millbrook. Go and see if anything is left, and where the pack went.',
    objective: { kind: 'explore', spot: 'tobins-farm', label: 'Check on Tobin’s Farm' },
    // (it was a walk to the farm. What happened is read there, and the pack's tracks are followed to where they den:
    // the first sign that these wolves had company)
    then: [
      {
        kind: 'use', region: 'thornvale', at: 'tobins-farm', count: 3, thing: 'bones', verb: 'Look closer', label: 'Search what is left of the fold', spread: 5,
        notes: ['The gate was lifted off its pins. Wolves don’t do that.', 'Every ewe killed, and hardly one eaten.', 'The lead ewe’s bell, its strap bitten through.'],
      },
      {
        kind: 'trail', region: 'thornvale', from: 'tobins-farm', to: 'wolfrun', marks: 3, label: 'Follow the pack’s tracks south',
        notes: ['Wolf tracks, dozens of them, all going south.', 'Among the paw prints: boots, walking with the pack.', 'The tracks run up into the Wolfrun Hills.'],
      },
    ],
    after: ['south-road'],
    zone: 'thornvale',
    find: {
      step: 1,
      name: 'The Flock’s Bell',
      kind: 'token',
      about: 'The bell from the lead ewe’s collar, found in the trampled grass at Tobin’s Farm with its strap bitten through. Nothing in the fold is left alive. The tracks are wolf, dozens of them, and they lead south into the hills.',
    },
    reward: { xp: 130, gold: 60 },
  },
  {
    id: 'wolf-pelts',
    name: 'Pelts for Winter',
    giver: 'tobin',
    text: 'Tobin wants four pelts from the hill wolves that killed his flock, to keep his new lambs warm next spring. And he wants a fold he can bring lambs home to: light its watch-fires, and stand there when the pack comes down at the light.',
    objective: { kind: 'loot', region: 'thornvale', item: 'Wolf Pelt', from: ['hill-wolf'], chance: 0.5, count: 4, label: 'Collect Wolf Pelts from hill wolves' },
    // (it was six pelts and no more. Tobin means to bring lambs home, so the fold is made safe: its watch-fires lit, and
    // held when the pack comes down at the light)
    then: [
      { kind: 'use', region: 'thornvale', at: 'tobins-farm', count: 3, thing: 'brazier', verb: 'Light', label: 'Light the watch-fires round Tobin’s fold', secs: 1, spread: 5 },
      { kind: 'hold', region: 'thornvale', at: 'tobins-farm', secs: 30, waves: [['hill-wolf', 'hill-wolf'], ['hill-wolf', 'hill-wolf', 'hill-wolf'], ['hill-wolf', 'hill-wolf', 'hill-wolf']], label: 'Hold the fold until the pack breaks off' },
    ],
    after: ['tobins-fields'],
    zone: 'thornvale',
    reward: { xp: 170, gold: 75 },
  },
  {
    id: 'hunt-old-greymane',
    name: 'Old Greymane',
    giver: 'tobin',
    text: 'The wolves follow Old Greymane, the oldest wolf in the hills. He dens in the Wolfrun Hills, south of Tobin’s farm. Tobin has a sack of mutton to draw him out: lay it, kill him, and see what is in that den.',
    // (it was one kill. The old wolf is drawn out with bait, fought, and his den searched: the whistle is found by
    // looking, not handed over)
    objective: { kind: 'use', region: 'thornvale', at: 'wolfrun', count: 1, thing: 'sack', verb: 'Lay the bait', label: 'Lay Tobin’s bait in the Wolfrun Hills', secs: 1.2, spread: 3, notes: ['The bait is down. Something big moves in the rocks.'] },
    then: [
      { kind: 'kill', region: 'thornvale', count: 1, enemies: ['old-greymane'], label: 'Defeat Old Greymane', lair: { at: 'wolfrun', enemies: ['old-greymane'] } },
      { kind: 'use', region: 'thornvale', at: 'wolfrun', count: 1, thing: 'bones', verb: 'Search', label: 'Search Old Greymane’s den', secs: 1.2, spread: 3, notes: ['Butcher’s scraps no wolf killed. And a red cord.'] },
    ],
    after: ['wolf-pelts'],
    zone: 'thornvale',
    level: 11,
    // (the side story's turn: the wolves were not hunger. Tobin's fold and the Kettles' farm were the same lesson)
    find: {
      name: 'A Bone Whistle on a Red Cord',
      kind: 'token',
      about: 'Found in Old Greymane’s den in the Wolfrun Hills, among the bones of Tobin’s sheep and a heap of butcher’s scraps no wolf killed. It is a drover’s whistle, the kind that calls dogs off a flock, on the red cord the Gallows Gang’s men wear. Someone fed these wolves, and called them down onto the farms.',
    },
    reward: { xp: 360, gold: 110, perk: 'flask', text: 'Tobin turns the whistle over twice. He never paid the rope tax. The Kettles, who didn’t pay either, got fire, and he got wolves, and he had thought it was only a bad winter coming. He gives you his grandfather’s old flask, which lets you carry one more potion, and goes to tell the Reeve what the gang does to farms that say no.' },
  },
  /* ------------------------------------------------------ Hanna's tonic */
  /* ------------------------------------------------------------ errands */
  {
    id: 'tobins-letter',
    name: 'A Letter for Hanna',
    giver: 'tobin',
    text: 'Tobin has written a letter to Hanna, who runs Millbrook’s inn. He rewrote it six times, and he won’t send it without flowers. Pick some from the meadow round the village, and take them and the letter to her before he loses his nerve.',
    // (it was a letter carried across a square. Tobin's nerve needs flowers first)
    objective: { kind: 'use', region: 'thornvale', at: 'tobin', count: 3, thing: 'herb', verb: 'Pick', label: 'Pick meadow flowers to go with Tobin’s letter', secs: 0.5, spread: 10 },
    then: [{ kind: 'talk', npc: 'hanna', label: 'Deliver Tobin’s letter and the flowers to Hanna' }],
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
        lines: ['Harlan Blackglove rules the gang from Gallows Keep. His executioner and his war-hound guard the way in.', 'Bring him down, and Millbrook will give you the best satchel in the Vale. It’s all we have left to give.'],
      },
      { when: { quest: 'mill-the-bridge', state: 'active' }, lines: ['Harlan’s strongbox was full of grey coins that weigh nothing. Somebody paid him to keep us hungry.', 'His fighters still hold the mill. Sefa has gathered the lads. Go with them and burn that barricade.'] },
      { when: { quest: 'mill-the-bridge', state: 'done' }, lines: ['The mill is free, and Millbrook can sleep at night again. We buried two of Sefa’s lads by the pond.', 'Our grain is going north to Elder Maren’s camp. Take her one of Harlan’s grey coins. Whoever paid him, she should know their money is in Millbrook.'] },
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
        lines: ['A letter from Tobin? And flowers. Let me read it.', 'Oh. He’s asking me to dinner. Tell him yes. Tuesday, here at the inn.'],
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
        lines: ['Bring me four wolf pelts. They’ll keep my new lambs warm.', 'Then light the watch-fires round my fold, and stay by them. The pack will come down at the light, once. If they’re beaten off, they won’t try a lit fold again.', 'The pack’s leader is an old wolf called Greymane. We’ll deal with him next.'],
      },
      {
        when: { quest: 'hunt-old-greymane', state: 'active' },
        lines: ['The pack follows Old Greymane, the oldest wolf in the hills.', 'He dens in the Wolfrun Hills, south of my farm. Kill him, and I’ll give you my granddad’s flask.'],
      },
      { when: { quest: 'tobins-letter', state: 'active' }, lines: ['Will you take this letter to Hanna at the inn? Please don’t read it.', 'I wrote it six times. I think this one is good enough.', 'Flowers. It needs flowers. The meadow round the village is full of them, and my hands are shaking too much to pick any.'] },
      { when: { quest: 'hunt-old-greymane', state: 'done' }, lines: ['The hills are quiet. I slept through the night for the first time in weeks.', 'The Reeve is taking that whistle round every farm. Nobody is calling it a bad winter now.', 'Use that flask well. My granddad carried it for forty years.'] },
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
          'She charges two silver a page. Have it ready.',
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
      // (in the Crown City, Act II)
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['I’ve copied the wardens’ map twice. One copy is sewn into my coat, in case.', 'The Host’s diggers keep prisoners to work for them. Maybe one of them has seen my brother.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['Gallows Gang boots under festival masks. Crane paid what was left of Harlan’s gang with the Herald’s coin.', 'Grey coin again. Every trail of it I’ve followed ends at the Pale Herald.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['Crane’s cellar door? I can open it. It’s what is waiting behind it that worries me.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['I’ve been watching the Chancellor’s House. His men come and go by the cellar door after dark, carrying things.'] },
      {
        lines: [
          'I’m Nyx, Pim’s friend. Thieves’ cant on top, and a number code under it. The gang didn’t write this. Somebody sent it to them.',
          'These went to Harlan Blackglove. He runs the Gallows Gang from Gallows Keep, dug into Gallows Hill.',
          'My fee is two silver. Keep it. I want to know who pays in grey wax and grey coin.',
          'I’ve been asking that since last winter. Men who paid in grey took my little brother, and nobody will tell me where he is.',
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
