import type { NpcDef, QuestDef } from '../types';

/**
 * Last Leaf's people and the quests of the Blightwood, the wood on the Dead Kingdom's western border
 * (STORY_BIBLE.md §3, Act V: the first of the three sigil dungeons). The Withered Queen was the guardian of
 * the wood once, the Green Lady, whom the elves sang to sleep every autumn and awake every spring, and the
 * Sigil-wardens left the Sigil of Thorns in her keeping. She was always afraid that one spring nobody would
 * sing her awake: a grief before it happens, which is the kind the Ash Crown likes best. When it woke it
 * promised her she would never have to sleep again; she took the promise, and a wood that never gets
 * its winter rots. The main chain follows the rot from Spore Hollow to her old shrine, reads it with
 * Rowan's waking-song, and goes down the Heartroot into Blightheart, past the Rotwood Colossus to the
 * Queen and the sigil. Warden Faelan wants to call Old Rotbark back, or failing that to let him rest;
 * Thornsmith Edda wants the Host's woodcamp shut before it builds Vaelor an army of engines; and
 * Rowan wants her mother's orchard back from the wolves. Main chain first.
 */
export const BLIGHTWOOD_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-withering',
    name: 'The Withering',
    giver: 'lady-silvaine',
    text: 'With the Three Gates taken, two Crown Sigils are still out in the Dead Kingdom’s country, and Silvaine knows where one of them is: the Blightwood, north of the Glimmerwood, where Thistlemourn’s thorns grew from and where the Withered Queen keeps her court and the Sigil of Thorns. The wood was green once, and full of elves. The last of them hold out in Last Leaf, in the south of it, under their elder Thessaly, who has written to Lumen Glade every week for a year and stopped last month. Take the north road into the Blightwood and find Elder Thessaly in Last Leaf.',
    objective: { kind: 'talk', npc: 'elder-thessaly', label: 'Talk to Elder Thessaly in Last Leaf' },
    after: ['the-clans-decide', 'the-third-gate'],
    level: 50,
    reward: { xp: 1200, gold: 440 },
  },
  /* ------------------------------------------------------ the Withered Queen */
  {
    id: 'the-grey-wind',
    name: 'The Grey Wind',
    giver: 'elder-thessaly',
    text: 'Every morning the wind brings a grey dust into Last Leaf, and every morning a little more of the village’s last green goes grey under it. Thessaly has stopped writing letters because the ink went grey too. The wind blows from Spore Hollow, north-west of the village, where the deer used to drink. Go and see what is breathing out the dust.',
    objective: { kind: 'explore', spot: 'spore-hollow', label: 'Find what blows from Spore Hollow' },
    after: ['the-withering'],
    zone: 'blightwood',
    reward: { xp: 1300, gold: 450, text: 'Not dust: spores, puffing out of things that were deer, and elves, before they lay down in the hollow and the fungus got up instead.' },
  },
  {
    id: 'rot-on-the-wind',
    name: 'Rot on the Wind',
    giver: 'elder-thessaly',
    text: 'The spores come out of shamblers: the dead of the wood, deer and elves both, walking about full of fungus and bursting when they find someone. Thessaly knew some of them. She asks you to put them down from as far away as you can manage, and not to stand in what they leave. They wander out of Spore Hollow, north-west of Last Leaf, and across the south of the wood.',
    objective: { kind: 'kill', region: 'blightwood', count: 8, enemies: ['rotspore-shambler'], label: 'Put down rotspore shamblers' },
    after: ['the-grey-wind'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 1500, gold: 470 },
  },
  {
    id: 'the-thorn-shrine',
    name: 'The Thorn Shrine',
    giver: 'elder-thessaly',
    text: 'The Queen was not always the Withered Queen. She was the Green Lady, the guardian of this wood, and every spring the elves sang her awake at her shrine north of Last Leaf, and every autumn they sang her to sleep again. Thessaly sang at it for four hundred years. Nobody has sung there since the thorns came. Go to the shrine, north of the village, and tell her what grows there now.',
    objective: { kind: 'explore', spot: 'thorn-shrine', label: 'Visit the Thorn Shrine' },
    after: ['rot-on-the-wind'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 1400, gold: 470 },
  },
  {
    id: 'the-queens-ladies',
    name: 'The Queen’s Ladies',
    giver: 'elder-thessaly',
    text: 'Thorns, and the Queen’s court keeping them: her ladies, who sang beside Thessaly once and hex now, and the dryads who heal for them. Thessaly would like her shrine back. Drive off the blight-witches and blighted dryads around the Thorn Shrine, north of Last Leaf, and anywhere else they hold court in the wood. Mind the pink hexes: while one is on you, nothing heals you properly.',
    objective: { kind: 'kill', region: 'blightwood', count: 10, enemies: ['blight-witch', 'blighted-dryad'], label: 'Drive off the Queen’s witches and dryads' },
    after: ['the-thorn-shrine'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 1700, gold: 500 },
  },
  {
    id: 'black-sap',
    name: 'Black Sap',
    giver: 'elder-thessaly',
    text: 'The rot-treants that walk the wood weep a black sap that the trees around Last Leaf never did. Thessaly wants to know where it comes from: sap remembers the root it rose from, and she can read it, if she has enough. Bring her four flasks of it from the rot-treants, wherever they walk in the wood. Fire helps. So does patience: they knit back together if you let them.',
    objective: { kind: 'loot', region: 'blightwood', item: 'Flask of Black Sap', from: ['blight-treant'], chance: 0.4, count: 4, label: 'Take Black Sap from rot-treants' },
    after: ['the-queens-ladies'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 1700, gold: 500, item: { rarity: 'rare' } },
  },
  {
    id: 'the-waking-song',
    name: 'The Waking Song',
    giver: 'elder-thessaly',
    text: 'The sap all rose from one root: the Heartroot, the oldest tree in the wood, where the Green Lady sleeps each winter. Except she hasn’t, Thessaly says. Not this winter, not last. The waking-song says why, and Thessaly can no longer sing it without weeping. Hearthwife Rowan, at the inn on the square, learned it from her mother. Ask her for the words.',
    objective: { kind: 'talk', npc: 'hearthwife-rowan', label: 'Ask Hearthwife Rowan for the waking-song' },
    after: ['black-sap'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 1400, gold: 500, text: '“Sleep, Lady, sleep; the leaf must fall; the wood must rest; we wake you all.” The Lady was always afraid of the last line: that one spring nobody would sing it. The Hallow King promised her she would never have to sleep again. A wood that never gets its winter rots.' },
  },
  {
    id: 'the-heartroot',
    name: 'The Heartroot',
    giver: 'elder-thessaly',
    text: 'The Lady did not fade, and the wood paid for it. She keeps the Sigil of Thorns, the one the Sigil-wardens trusted her with, down in the roots of the oldest tree, and that is where the Hallow King’s promise lives too. The way down is the Heartroot, a hollow in that tree, far north-west of Last Leaf. Find it, and see who stands at the door.',
    objective: { kind: 'explore', spot: 'the-heartroot', label: 'Find the Heartroot' },
    after: ['the-waking-song'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 1500, gold: 520 },
  },
  {
    id: 'the-rotwood-colossus',
    name: 'The Rotwood Colossus',
    giver: 'elder-thessaly',
    text: 'Below the Heartroot the oldest tree has rotted into halls, and the Lady has set a warden at the bottom of the stair: the Rotwood Colossus, a hill of dead wood and root that walks. Thessaly says it was a hill once, a green one, where the elves held their midsummer. Go down the Heartroot, in the far north-west of the wood, into Blightheart, and break it.',
    objective: { kind: 'boss', boss: 'rotwood-colossus', label: 'Defeat the Rotwood Colossus in Blightheart' },
    after: ['the-heartroot'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 2600, gold: 800, item: { rarity: 'rare' } },
  },
  {
    id: 'the-withered-queen',
    name: 'The Withered Queen',
    giver: 'elder-thessaly',
    text: 'The Colossus is kindling and the way to the Lady’s throne is open. She sits at the heart of Blightheart with the Sigil of Thorns grown into the throne beneath her, and she will not sleep. Thessaly cannot sing her down. She asks you to do it the other way: go to the bottom of Blightheart, below the Heartroot, and give the Withered Queen the winter she was promised she would never have.',
    objective: { kind: 'boss', boss: 'the-withered-queen', label: 'Defeat the Withered Queen in Blightheart' },
    after: ['the-rotwood-colossus'],
    zone: 'blightwood',
    level: 53,
    reward: {
      xp: 6400,
      gold: 1700,
      item: 'mantle-of-the-green-lady',
      perk: 'sigil-thorns',
      text: 'The Queen sinks back into her throne and closes her eyes, and for the first time in two years she sleeps. The Sigil of Thorns comes free of the roots in your hand. That night it snows on the Blightwood, and in Last Leaf they sing her the autumn song. Thessaly gives you the mantle the elves wove for the Green Lady, and says the wood will be green when it wakes. The last sigil, the Veil, is with the Pale Herald in the Riftscar, north of the wood.',
    },
  },
  /* ------------------------------------------------- Warden Faelan's treant */
  {
    id: 'the-withered-grove',
    name: 'The Withered Grove',
    giver: 'warden-faelan',
    text: 'Warden Faelan is the last of Last Leaf’s tree-wardens, who tended the treants the way shepherds tend sheep, only slower. The eldest of them, Old Rotbark, taught the elves the names of the trees; he stands in the Withered Grove, north-east of the village, and has not answered Faelan’s call since spring. Go and see whether he still knows his own name.',
    objective: { kind: 'explore', spot: 'withered-grove', label: 'Look for Old Rotbark in the Withered Grove' },
    after: ['the-withering'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 600, gold: 480, text: 'He is there, grey to the heartwood and ringed with the Queen’s court. Thornlings shake out of his branches when he stirs. He does not know you, and he is not glad to see you.' },
  },
  {
    id: 'the-wardens-stones',
    name: 'The Wardens’ Stones',
    giver: 'warden-faelan',
    text: 'Faelan has one hope left. The tree-wardens called the treants with rune-stones, each cut with a treant’s true name, and Rotbark’s are still in the grove, or they were, until the thornlings carried them off: thornlings take anything that shines. Take back five rune-stones from the thornlings in the wood, and Faelan will try to call his old teacher home.',
    objective: { kind: 'loot', region: 'blightwood', item: 'Warden’s Rune-Stone', from: ['thornling'], chance: 0.35, count: 5, label: 'Take back the wardens’ rune-stones from thornlings' },
    after: ['the-withered-grove'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 700, gold: 500 },
  },
  {
    id: 'old-rotbark',
    name: 'Old Rotbark',
    giver: 'warden-faelan',
    text: 'Faelan laid the stones in a ring and called, and Rotbark heard. He turned his face toward Last Leaf, and the roots in the grove came up like spears. There is nothing left of the old treant to call home. Faelan asks you to go back to the Withered Grove, north-east of the village, and let Old Rotbark rest. He asks you to do it before he can change his mind.',
    objective: { kind: 'kill', region: 'blightwood', count: 1, enemies: ['old-rotbark'], label: 'Let Old Rotbark rest' },
    after: ['the-wardens-stones'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 1100, gold: 820, item: 'rotbark-heartwood', text: 'Faelan cuts the last sound wood out of the old treant’s heart and gives it to you. “He’d have wanted it to keep fighting,” he says. “He was very stubborn. For a tree.”' },
  },
  /* ----------------------------------------------- Thornsmith Edda's woodcamp */
  {
    id: 'the-woodcamp',
    name: 'The Woodcamp',
    giver: 'thornsmith-edda',
    text: 'Thornsmith Edda hears axes in the north at night, which is wrong, because nobody in Last Leaf is fool enough to cut blight-wood. Somebody is: there is a camp in the far north-east of the wood, and the trees around it are coming down by the hundred. Find the woodcamp and tell Edda whose axes they are.',
    objective: { kind: 'explore', spot: 'legion-woodcamp', label: 'Find the woodcamp in the north-east' },
    after: ['the-withering'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 600, gold: 500, text: 'The Host’s. Dead foresters in grey felling the blight-wood, and dead carpenters shaping it into beams and wheels and throwing-arms. Vaelor is building engines out of the Queen’s wood.' },
  },
  {
    id: 'axes-in-the-wood',
    name: 'Axes in the Wood',
    giver: 'thornsmith-edda',
    text: 'Blight-wood is hard as iron and it doesn’t burn until you want it to, which makes it the best siege timber in the world and the worst thing to let the Host have. Edda wants the felling stopped. Cut down the Host’s woodsmen at the woodcamp in the far north-east and wherever they work the wood; they throw their hatchets, so keep moving.',
    objective: { kind: 'kill', region: 'blightwood', count: 10, enemies: ['legion-woodsman', 'legion-soldier'], label: 'Cut down the Host’s woodsmen and their guards' },
    after: ['the-woodcamp'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 700, gold: 520 },
  },
  {
    id: 'engines-of-blight',
    name: 'Engines of Blight',
    giver: 'thornsmith-edda',
    text: 'The first engines are already built: bone catapults with blight-wood arms, squatting in the woodcamp waiting for the rest of their army. Edda says blight-wood burns beautifully once it has been cut and dried, and she would know, because she has been burning her own mistakes for thirty years. Break four of the catapults at the woodcamp in the far north-east, and anywhere else they have been rolled out into the wood.',
    objective: { kind: 'kill', region: 'blightwood', count: 4, enemies: ['bone-catapult'], label: 'Break the Host’s blight-wood catapults' },
    after: ['axes-in-the-wood'],
    zone: 'blightwood',
    level: 52,
    reward: { xp: 1000, gold: 760, item: 'thornsteel-gauntlets', text: 'Edda melts down the Host’s axe-heads and forges you a pair of gauntlets out of them, quenched in blight-sap. The knuckles grow thorns. She says to file them down on Sundays.' },
  },
  /* ------------------------------------------------- Hearthwife Rowan's orchard */
  {
    id: 'greenhallow',
    name: 'Greenhallow',
    giver: 'hearthwife-rowan',
    text: 'Rowan grew up at Greenhallow, the farmstead east of Last Leaf, where her mother kept the last apple orchard in the wood. Her mother would not leave it when the blight came, and Rowan has not heard from her since the wolves started howling out that way. Go east to Greenhallow and see whether the orchard, and its keeper, are still standing.',
    objective: { kind: 'explore', spot: 'greenhallow', label: 'Look in on Greenhallow, east of Last Leaf' },
    after: ['the-withering'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 500, gold: 460, text: 'The farmhouse is shut tight, and from behind the door an old woman with a pitchfork tells you to clear off, unless you are going to do something about the wolves.' },
  },
  {
    id: 'wolves-at-the-orchard',
    name: 'Wolves at the Orchard',
    giver: 'hearthwife-rowan',
    text: 'Rowan’s mother is alive, furious and out of firewood, and the rot-wolves have been circling Greenhallow for a month, waiting for her to come out. She has no intention of coming out. Rowan would like the wolves gone before her mother runs out of patience, which is the only thing she has more of than apples. Hunt ten rot-wolves around Greenhallow, east of Last Leaf, and across the wood.',
    objective: { kind: 'kill', region: 'blightwood', count: 10, enemies: ['blight-wolf'], label: 'Hunt rot-wolves' },
    after: ['greenhallow'],
    zone: 'blightwood',
    level: 51,
    reward: { xp: 700, gold: 520, item: 'ring-of-the-last-leaf', text: 'Rowan’s mother comes into Last Leaf for the first time in a year, with a sack of apples and opinions. She gives you her ring: a green leaf from the orchard, pressed in amber forty years ago and still green.' },
  },
];

export const BLIGHTWOOD_NPCS: Record<string, NpcDef> = {
  'elder-thessaly': {
    id: 'elder-thessaly',
    name: 'Elder Thessaly',
    title: 'Elder of Last Leaf',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-withering', state: 'active' },
        lines: ['Silvaine sent you. She has someone to spare, then, and I have someone to spend. I am glad on both counts.', 'I am Thessaly. This is Last Leaf: the last green in the Blightwood, and the last elves. Sit. The tea is grey, but it is still tea.'],
      },
      {
        when: { quest: 'the-grey-wind', state: 'active' },
        lines: ['Every morning the wind brings the grey in, and every morning a little more of us goes grey under it.', 'It blows from Spore Hollow, north-west of the village. The deer drank there once. Go and see what breathes it out.'],
      },
      {
        when: { quest: 'rot-on-the-wind', state: 'active' },
        lines: ['Shamblers. The wood’s dead, walking about full of fungus. I knew some of them. One of them owed me a song.', 'Put them down from as far off as you can, and don’t stand in what they leave. I would like you to come back the same color you went out.'],
      },
      {
        when: { quest: 'the-thorn-shrine', state: 'active' },
        lines: ['She was the Green Lady before she was the Withered Queen. Every spring we sang her awake at her shrine, north of here. Every autumn we sang her to sleep.', 'I sang at it four hundred years. Go and tell me what grows there now. I think I know. I would like to be wrong.'],
      },
      {
        when: { quest: 'the-queens-ladies', state: 'active' },
        lines: ['Her ladies. Gwenna and Sorrel and the rest. They stood beside me at the shrine, and sang the high parts, badly.', 'They hex now, and they hex well. Drive them off the shrine. And the dryads with them: the dryads heal whoever is nearest, and that is never us.'],
      },
      {
        when: { quest: 'black-sap', state: 'active' },
        lines: ['Black sap. Our trees never wept black. Sap remembers the root it rose from, and I can read it, if I have enough.', 'The rot-treants carry it. Four flasks. Fire helps, and so does not letting them rest.'],
      },
      {
        when: { quest: 'the-waking-song', state: 'active' },
        lines: ['It all rose from one root: the Heartroot, where she sleeps each winter. Except she has not slept. Not this winter. Not the last.', 'The waking-song says why, and I cannot sing it any more without weeping. Rowan knows the words. Ask her. I will be over here. Not weeping.'],
      },
      {
        when: { quest: 'the-heartroot', state: 'active' },
        lines: ['She was afraid of the last line. That one spring nobody would sing it. And the Hallow King came and promised her she would never have to sleep again.', 'She keeps the Sigil of Thorns down in the roots of the oldest tree. The way down is the Heartroot, far north-west of here. Find it.'],
      },
      {
        when: { quest: 'the-rotwood-colossus', state: 'active' },
        lines: ['The Rotwood Colossus. It was a hill once, a green one. We held midsummer on it, and somebody always fell off.', 'Go down the Heartroot into Blightheart and break it. It will not mind. There is nothing left in it to mind.'],
      },
      {
        when: { quest: 'the-withered-queen', state: 'active' },
        lines: ['The way to her throne is open. She will not sleep, and I cannot sing her down any more.', 'Give her the winter she was promised she would never have. Be gentle if she lets you. She was kind, once. She was kind for a thousand years.'],
      },
      {
        when: { quest: 'the-withered-queen', state: 'done' },
        lines: ['It snowed last night. The first snow in two years. Listen: you can hear the wood breathing out.', 'She is asleep, and in the spring we will sing her awake, and she will be green. Go north for the last sigil. And come back in the spring. We will need someone to sing the high parts.'],
      },
      { when: { quest: 'silvaines-song', state: 'taken' }, lines: ['Silvaine sang her brother back from the thorns. I did not think it could be done. I sang for the Lady four hundred years and could not do it.', 'He writes to me now. He asks how to be forgiven by a wood. I have told him: slowly, and with your hands in the dirt.'] },
      { when: { quest: 'the-thorn-court', state: 'taken' }, lines: ['Silvaine’s brother is at rest. She does not speak of it and I do not ask. The thorns he grew are still coming up in the south of the wood. We pull them every morning.'] },
      { lines: ['Last Leaf. The last green, the last elves, and the last of the good tea.', 'The grey comes in on the wind. We sweep it out every morning. It is something to do.'] },
    ],
  },
  'hearthwife-rowan': {
    id: 'hearthwife-rowan',
    name: 'Hearthwife Rowan',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Last Hearth',
    talk: [
      {
        when: { quest: 'the-waking-song', state: 'active' },
        lines: [
          'The waking-song? Mother taught it me. It goes: “Sleep, Lady, sleep; the leaf must fall; the wood must rest; we wake you all.”',
          'That last line was the one she was afraid of, Mother said. That one spring nobody would sing it, and she’d sleep for good.',
          'So she stopped sleeping. And a wood that never gets its winter rots. Tell Thessaly. Gently. She wrote that line.',
        ],
      },
      {
        when: { quest: 'greenhallow', state: 'active' },
        lines: ['I grew up at Greenhallow, east of here. Mother kept the last apple orchard in the wood, and she wouldn’t leave it for the blight or anyone.', 'The wolves have been howling out that way for a month. Go and see if she’s still there. She will be. She’ll be cross about it.'],
      },
      {
        when: { quest: 'wolves-at-the-orchard', state: 'active' },
        lines: ['Alive! And furious, and out of firewood, and she told you to clear off. That’s Mother.', 'The rot-wolves are waiting for her to come out. She won’t. Please get rid of them before she decides to go out after them with the pitchfork.'],
      },
      { when: { quest: 'wolves-at-the-orchard', state: 'done' }, lines: ['Mother’s in the kitchen, telling me how to make soup. I have made soup for thirty years. Thank you. I mean it. Mostly.'] },
      { lines: ['The Last Hearth. A fire, a bed, potions on the shelf, and apple cake when Mother sends apples.', 'Shake the grey off before you come in. It gets in the cake.'] },
    ],
  },
  'thornsmith-edda': {
    id: 'thornsmith-edda',
    name: 'Thornsmith Edda',
    title: 'Smith',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Edda’s Thornsteel',
    talk: [
      {
        when: { quest: 'the-woodcamp', state: 'active' },
        lines: ['Axes in the north. At night. Nobody in Last Leaf is fool enough to cut blight-wood. Somebody is.', 'Far north-east of the village, by the sound of it. Find out whose axes they are.'],
      },
      {
        when: { quest: 'axes-in-the-wood', state: 'active' },
        lines: ['The Host. Of course it is the Host. Blight-wood is hard as iron and burns only when you want it to: the best siege timber in the world.', 'Stop the felling. Their woodsmen throw hatchets, so don’t stand still and admire their technique.'],
      },
      {
        when: { quest: 'engines-of-blight', state: 'active' },
        lines: ['Catapults. Already built, already waiting. Vaelor means to throw the Queen’s wood at somebody’s walls.', 'Break four. Blight-wood burns beautifully once it’s cut and dried. I know. I’ve been burning my mistakes in it for thirty years.'],
      },
      { when: { quest: 'engines-of-blight', state: 'done' }, lines: ['No more axes at night. I sleep now. I’d forgotten how. It’s very dull. I love it.'] },
      { lines: ['Edda’s Thornsteel. Armor for the wood: it bends where it should, and grows thorns where it shouldn’t.', 'Don’t lean on the rack. It bites.'] },
    ],
  },
  'warden-faelan': {
    id: 'warden-faelan',
    name: 'Warden Faelan',
    title: 'Tree-Warden',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-withered-grove', state: 'active' },
        lines: ['I am the last tree-warden. We tended the treants the way shepherds tend sheep, only much slower and with more apologizing.', 'Old Rotbark taught us the names of the trees. He stands in the Withered Grove, north-east of here, and he has not answered me since spring.'],
      },
      {
        when: { quest: 'the-wardens-stones', state: 'active' },
        lines: ['Grey to the heartwood. But a treant’s true name is cut in stone, and the stones can call him home, if anything is left to call.', 'The thornlings took them. They take anything that shines. Bring me five, and I will try.'],
      },
      {
        when: { quest: 'old-rotbark', state: 'active' },
        lines: ['He heard me. He turned his face toward the village, and the roots came up like spears.', 'There is nothing to call home. Go and let him rest, in the Withered Grove. Before I change my mind. Please.'],
      },
      { when: { quest: 'old-rotbark', state: 'done' }, lines: ['I planted an acorn from the grove beside the village gate. In four hundred years it will be very rude to me. I look forward to it.'] },
      { lines: ['The trees are quiet. They are never quiet. I don’t like it.', 'If a tree looks at you, walk away. Slowly. They notice running.'] },
    ],
  },
};
