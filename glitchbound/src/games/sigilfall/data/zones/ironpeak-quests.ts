import type { NpcDef, QuestDef } from '../types';

/**
 * Kragholt's people and the Ironpeak Highlands' quests (see WORLD.md). The Hollow Legion has taken the
 * dwarves' Deepforge and makes bone-steel there: iron from the quarry, bones from the dwarves' own
 * tombs, and Forgemaster Grold, Kragholt's best smith, at the anvil for the Hollow King. The main
 * chain runs from the quarry to the Deepforge's heart, where the Sigil of Stone lies; Hilda and Oz
 * have troubles of their own, with rams and griffons. Main chain first.
 */
export const IRONPEAK_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-dwarves-plea',
    name: 'The Dwarves’ Plea',
    giver: 'marshal-dunmore',
    text: 'The Legion’s orders were plain: bone-steel from the Deepforge, as much as it can make. The Deepforge is the dwarves’ great forge in the Ironpeak Highlands, and Kragholt’s thane has written to Marshal Dunmore for help the marshal can’t spare. You, he can. Take the road north into the mountains and find Thane Borrik in Kragholt.',
    objective: { kind: 'talk', npc: 'thane-borrik', label: 'Talk to Thane Borrik in Kragholt' },
    after: ['orders-from-the-north'],
    level: 20,
    reward: { xp: 500, gold: 160 },
  },
  /* ------------------------------------------------------- the Deepforge */
  {
    id: 'the-hollow-quarry',
    name: 'The Hollow Quarry',
    giver: 'thane-borrik',
    text: 'Thane Borrik lost the Deepforge in a night and the iron quarry the night after. The dead dig it now, day and night, and carry the ore north to the forge. The quarry is south-west of Kragholt. Go and see how many of them there are. Count quietly.',
    objective: { kind: 'explore', spot: 'hollow-quarry', label: 'Scout the Hollow Quarry' },
    after: ['the-dwarves-plea'],
    zone: 'ironpeak',
    reward: { xp: 550, gold: 170 },
  },
  {
    id: 'the-dead-shift',
    name: 'The Dead Shift',
    giver: 'thane-borrik',
    text: 'Too many: dead miners on a shift that never ends, golems hauling the ore, and robed things keeping them at it. Break the Legion’s work gangs wherever you find them in the highlands. The thane would like his quarry back before the dead dig it flat.',
    objective: { kind: 'kill', region: 'ironpeak', count: 12, enemies: ['legion-miner', 'bone-golem', 'legion-slagthrower', 'legion-bonecaller'], label: 'Break the Legion’s work gangs' },
    after: ['the-hollow-quarry'],
    zone: 'ironpeak',
    reward: { xp: 700, gold: 180 },
  },
  {
    id: 'bone-steel',
    name: 'Bone-Steel',
    giver: 'thane-borrik',
    text: 'The bone golems haul ingots between the forge in the north-east and the quarry south-west of Kragholt, pale and faintly violet, and the slagthrowers carry the leavings. Borrik wants four on his table. He has never seen steel like it, and he would like to know what has been done to his forge.',
    objective: { kind: 'loot', region: 'ironpeak', item: 'Bone-Steel Ingot', from: ['bone-golem', 'legion-slagthrower'], chance: 0.45, count: 4, label: 'Take Bone-Steel Ingots from golems and slagthrowers' },
    after: ['the-dead-shift'],
    zone: 'ironpeak',
    reward: { xp: 700, gold: 180 },
  },
  {
    id: 'the-makers-mark',
    name: 'The Maker’s Mark',
    giver: 'thane-borrik',
    text: 'Every ingot is stamped with the same mark, a hammer in a ring, and Borrik went grey when he saw it. It belongs to Forgemaster Grold, the best smith Kragholt ever had, who went into the Deepforge the night it fell. His daughter Brenna keeps the little forge on the square. Take her the ingots. Borrik can’t.',
    objective: { kind: 'talk', npc: 'brenna', label: 'Show the ingots to Brenna' },
    after: ['bone-steel'],
    zone: 'ironpeak',
    level: 22,
    reward: { xp: 600, gold: 180 },
  },
  {
    id: 'the-ancestors-hall',
    name: 'The Hall of Ancestors',
    giver: 'brenna',
    text: 'Brenna knows what makes the steel pale: bone, beaten into the iron while it’s white-hot. The Legion’s Bonecallers are emptying the Hall of Ancestors, the dwarves’ tombs north-west of Kragholt, and raising the honored dead to dig. Put five Bonecallers down, and the ancestors back to bed.',
    objective: { kind: 'kill', region: 'ironpeak', count: 5, enemies: ['legion-bonecaller'], label: 'Defeat Legion Bonecallers' },
    after: ['the-makers-mark'],
    zone: 'ironpeak',
    reward: { xp: 750, gold: 200 },
  },
  {
    id: 'the-deepforge-gate',
    name: 'The Deepforge Gate',
    giver: 'thane-borrik',
    text: 'The way into the Deepforge is its great gate, in the mountain north-east of Kragholt. Borrik’s grandfather hung those doors. Find out whether they still stand, and what is standing in front of them.',
    objective: { kind: 'explore', spot: 'deepforge-gate', label: 'Find the Deepforge Gate' },
    after: ['the-ancestors-hall'],
    zone: 'ironpeak',
    level: 23,
    reward: { xp: 750, gold: 200 },
  },
  {
    id: 'the-slag-colossus',
    name: 'The Slag Colossus',
    giver: 'thane-borrik',
    text: 'The gate stands open and the forge’s heat pours out of it. Deep inside, the Legion has been pouring the dead of its bone-yards into the old slag pit with every scrap of iron it could find, and something has climbed out: the Slag Colossus. Go down into the Deepforge Halls and break it.',
    objective: { kind: 'boss', boss: 'slag-colossus', label: 'Defeat the Slag Colossus in the Deepforge Halls' },
    after: ['the-deepforge-gate'],
    zone: 'ironpeak',
    level: 24,
    reward: { xp: 1300, gold: 260, item: { rarity: 'rare' } },
  },
  {
    id: 'forgemaster-grold',
    name: 'Forgemaster Grold',
    giver: 'brenna',
    text: 'At the bottom of the Deepforge, at the great anvil, Forgemaster Grold still works, and the Hollow King tells him what to make. The Sigil of Stone lies in the forge’s heart, and Grold has been beating bone-steel on it. Brenna asks one thing: that it is you who stops him, not the thane’s axes.',
    objective: { kind: 'boss', boss: 'forgemaster-grold', label: 'Defeat Forgemaster Grold' },
    after: ['the-slag-colossus'],
    zone: 'ironpeak',
    level: 25,
    reward: {
      xp: 2650,
      gold: 700,
      item: 'deepforge-gauntlets',
      perk: 'sigil-stone',
      text: 'From the forge’s heart you lift the Sigil of Stone, still warm from Grold’s anvil. Brenna lights the Deepforge again, for Kragholt this time, and the first thing she makes in it is for you.',
    },
  },
  {
    id: 'the-old-watch',
    name: 'The Old Watch',
    giver: 'thane-borrik',
    text: 'The Old Dwarf Watch stands on the peaks north of Kragholt, where five wardens and a horn kept an eye on the forge road. The horn never blew the night the Deepforge fell. Borrik would like to know why, or at least what happened to the horn.',
    objective: { kind: 'explore', spot: 'old-watch', label: 'Climb to the Old Dwarf Watch' },
    after: ['the-makers-mark'],
    zone: 'ironpeak',
    level: 23,
    reward: { xp: 500, gold: 180, item: { rarity: 'rare' } },
  },
  /* ------------------------------------------------------ Hilda's barley */
  {
    id: 'rams-in-the-barley',
    name: 'Rams in the Barley',
    giver: 'hilda-stoutbrew',
    text: 'Hilda Stoutbrew brews Kragholt’s ale from frostmalt, a barley that grows only on the high terraces. The frost rams have come down off Ram Heights, south of town by the road, onto the Frostmalt Terraces south-east of it, and eaten half the crop. Hilda would like them discouraged. Eight should make the point.',
    objective: { kind: 'kill', region: 'ironpeak', count: 8, enemies: ['frost-ram'], label: 'Drive off frost rams' },
    after: ['the-dwarves-plea'],
    zone: 'ironpeak',
    reward: { xp: 600, gold: 160 },
  },
  {
    id: 'horn-tankards',
    name: 'Horn and Ale',
    giver: 'hilda-stoutbrew',
    text: 'Some dead men walked into Hilda’s inn last month looking for bones, and she broke every tankard she owned on them. Kragholt drinks from ram’s horn, and the rams on Ram Heights, south of town, have plenty. Bring her six, unchipped. She will check.',
    objective: { kind: 'loot', region: 'ironpeak', item: 'Ram Horn', from: ['frost-ram'], chance: 0.5, count: 6, label: 'Collect Ram Horns from frost rams' },
    after: ['rams-in-the-barley'],
    zone: 'ironpeak',
    reward: { xp: 650, gold: 170 },
  },
  {
    id: 'hunt-old-horn',
    name: 'Old Horn',
    giver: 'hilda-stoutbrew',
    text: 'Old Horn, king of the rams, came down last night, butted in the brewhouse door and ate the mat. He dens on Ram Heights. Hilda wants her door avenged, and she has had an idea about his horns.',
    objective: { kind: 'kill', region: 'ironpeak', count: 1, enemies: ['old-horn'], label: 'Defeat Old Horn on Ram Heights' },
    after: ['horn-tankards'],
    zone: 'ironpeak',
    level: 22,
    reward: { xp: 1000, gold: 220, item: 'ramhorn-helm', text: 'Hilda has Old Horn’s horns fitted to a helm for you.' },
  },
  /* ----------------------------------------------------- Oz's storm-glass */
  {
    id: 'the-prospectors',
    name: 'The Prospectors',
    giver: 'gemcutter-oz',
    text: 'Gemcutter Oz sent his prospectors to the Griffon Crags, east of Kragholt, for storm-glass, and they haven’t come back. Oz is worried about the glass. He is a little worried about the prospectors. Go and look for both.',
    objective: { kind: 'explore', spot: 'griffon-crags', label: 'Search the Griffon Crags' },
    after: ['the-dwarves-plea'],
    zone: 'ironpeak',
    level: 21,
    reward: { xp: 550, gold: 160 },
  },
  {
    id: 'griffon-hoard',
    name: 'Swallowed Whole',
    giver: 'gemcutter-oz',
    text: 'The prospectors are fine: they ran. The griffons took their packs, and a griffon swallows anything that glitters to grind its food. Oz’s best cut gems are inside the griffons that circle the crags east of town. He would like them back. Rinsed.',
    objective: { kind: 'loot', region: 'ironpeak', item: 'Cut Gem', from: ['griffon'], chance: 0.4, count: 6, label: 'Recover Cut Gems from griffons' },
    after: ['the-prospectors'],
    zone: 'ironpeak',
    reward: { xp: 700, gold: 180 },
  },
  {
    id: 'hunt-stormwing',
    name: 'Stormwing',
    giver: 'gemcutter-oz',
    text: 'The biggest piece of storm-glass went to Stormwing, the great griffon of the crags, grey as weather and twice as loud. She nests at the top of the Griffon Crags, east of Kragholt, and her brood comes when she screams. Bring the glass back and Oz will cut you something from it.',
    objective: { kind: 'kill', region: 'ironpeak', count: 1, enemies: ['stormwing'], label: 'Defeat Stormwing at the Griffon Crags' },
    after: ['griffon-hoard'],
    zone: 'ironpeak',
    level: 23,
    reward: { xp: 1050, gold: 240, item: 'stormeye-ring', text: 'Oz cuts a ring from the storm-glass.' },
  },
];

export const IRONPEAK_NPCS: Record<string, NpcDef> = {
  'thane-borrik': {
    id: 'thane-borrik',
    name: 'Thane Borrik',
    title: 'Thane of Kragholt',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-dwarves-plea', state: 'active' },
        lines: ['Dunmore sent you? Only you? He held the Kragholt road with my father one winter, and he still thinks one good fighter is an army. Well. You’ll have to be.', 'The Hollow Legion took the Deepforge in one night. The dead came up through the ore tunnels. We dug those tunnels. We were very proud of them.'],
      },
      {
        when: { quest: 'the-hollow-quarry', state: 'active' },
        lines: ['The quarry is south-west of town. The dead dig it night and day and carry the ore north to my forge.', 'Go and count them. I tried. I ran out of fingers before I ran out of dead.'],
      },
      {
        when: { quest: 'the-dead-shift', state: 'active' },
        lines: ['Miners, golems, robed things with lights in their eyes. They don’t sleep, they don’t eat and they don’t ask for wages. My old foremen would have loved them.', 'Break their work gangs. Wherever you find them.'],
      },
      { when: { quest: 'bone-steel', state: 'active' }, lines: ['Ingots. Four of them, on this table. The golems haul them and the slagthrowers carry the leavings.', 'I want to see what they’ve done to my forge.'] },
      {
        when: { quest: 'the-makers-mark', state: 'active' },
        lines: ['A hammer in a ring. Everyone in Kragholt knows that mark.', 'Take it to Brenna, at the forge on the square. I can’t. The thane doesn’t weep in front of the smith.'],
      },
      { when: { quest: 'the-ancestors-hall', state: 'active' }, lines: ['Our honored dead, dug up and put to work. In my day we at least let them get cold first.', 'The Hall of Ancestors is north-west of town. Lay them down again.'] },
      {
        when: { quest: 'the-deepforge-gate', state: 'active' },
        lines: ['The Deepforge Gate, north-east, in the mountain’s face. My grandfather hung those doors.', 'If they still stand, I want to know. If they don’t, I want to know who’s standing in them.'],
      },
      {
        when: { quest: 'the-slag-colossus', state: 'active' },
        lines: ['The old slag pit. The Legion has been pouring its dead into it, with every scrap of iron it could steal. Last night something climbed out.', 'My grandfather dug that pit for the slag. He’d be appalled. He was appalled by most things, but he’d be right this time.'],
      },
      {
        when: { quest: 'forgemaster-grold', state: 'active' },
        lines: ['Grold went in to bank the fires the night it fell. We thought he died in there. I wish he had.', 'The Sigil of Stone lies in the forge’s heart. Kragholt has kept it for three hundred years. Bring it home.'],
      },
      { when: { quest: 'the-old-watch', state: 'active' }, lines: ['The Old Watch, up on the peaks north of town. Five wardens and a horn.', 'The horn didn’t blow. I want to know why. I suspect I won’t like it.'] },
      {
        when: { quest: 'the-lanterns-dim', state: 'active' },
        lines: ['My lookouts on the west pass say the lamps on Lantern Hill are going out, one a night. And the Legion’s carts roll west, loaded with my steel.', 'Take the west pass to the Ashen Barrows and find the lamplighter. Find out who’s buying my forge.'],
      },
      {
        when: { quest: 'forgemaster-grold', state: 'done' },
        lines: ['The Deepforge burns again, and it burns for us. Kragholt owes you more than a thane can pay. I’ll pay it anyway. Slowly.', 'Whatever the Hollow King wanted with our sigil, he’ll have to want it.'],
      },
      { lines: ['Kragholt has stood on this mountain for nine hundred years. It will stand a while yet, if I have anything to say about it. I usually do.', 'Wipe your boots, stranger. The dead never do.'] },
    ],
  },
  'hilda-stoutbrew': {
    id: 'hilda-stoutbrew',
    name: 'Hilda Stoutbrew',
    title: 'Brewer',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Frostmalt',
    talk: [
      {
        when: { quest: 'rams-in-the-barley', state: 'active' },
        lines: ['Frostmalt barley. Grows on the high terraces, tastes of snow. The rams eat it like it’s free.', 'The terraces are south-east of town, past Ram Heights. Eight rams. Let them know the barley is spoken for.'],
      },
      {
        when: { quest: 'horn-tankards', state: 'active' },
        lines: ['Dead men walked into my inn looking for bones. I gave them bones. I gave them every tankard I owned, too, one at a time.', 'Kragholt drinks from ram’s horn. Six, if you please. No chips. I’ll know.'],
      },
      {
        when: { quest: 'hunt-old-horn', state: 'active' },
        lines: ['Old Horn. King of the rams. He butted in my brewhouse door last night and ate the mat.', 'He dens on Ram Heights. Bring him down and I’ll have his horns made into something for you. Not a tankard.'],
      },
      { when: { quest: 'hunt-old-horn', state: 'done' }, lines: ['That helm suits you. I say that about all hats. I mean it about this one.', 'The door’s mended. The mat isn’t. Some things you can’t take back.'] },
      { lines: ['Welcome to the Frostmalt. Potions on the shelf, ale in the tun. The ale is better for you, whatever the priests say.', 'Sit by the fire. You look like you’ve been fighting the dead. Everyone does, these days.'] },
    ],
  },
  'gemcutter-oz': {
    id: 'gemcutter-oz',
    name: 'Gemcutter Oz',
    title: 'Gemcutter',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Oz’s Facets',
    talk: [
      {
        when: { quest: 'the-prospectors', state: 'active' },
        lines: ['My prospectors went out to the Griffon Crags, east of town, for storm-glass. They haven’t come back.', 'Am I worried? About the glass, yes. About them, a little. Bring back whichever you find first.'],
      },
      {
        when: { quest: 'griffon-hoard', state: 'active' },
        lines: ['Griffons swallow anything that glitters. It grinds their food, they say. It grinds my gems, I say.', 'Six of my best are inside six griffons. Get them out. I’m not fussy how.'],
      },
      {
        when: { quest: 'hunt-stormwing', state: 'active' },
        lines: ['Stormwing took the storm-glass: the great griffon, grey as weather and twice as loud. She nests at the top of the crags.', 'Bring me the glass and I’ll cut you something that remembers the storm.'],
      },
      { when: { quest: 'hunt-stormwing', state: 'done' }, lines: ['Look at it catch the light. It doesn’t so much catch it as throw it at people. That’s storm-glass for you.'] },
      { lines: ['Rings, amulets and relics, all cut in Kragholt, every facet by hand. Mostly my hand.', 'Looking is free. Touching is twenty gold.'] },
    ],
  },
  brenna: {
    id: 'brenna',
    name: 'Brenna',
    title: 'Smith',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-makers-mark', state: 'active' },
        lines: ['Ingots? Let me see. …That’s his mark. My father’s. Forgemaster Grold.', 'He went in to bank the fires the night the dead came, and he didn’t come out. I thought that was the worst thing that could happen. It wasn’t.'],
      },
      {
        when: { quest: 'the-ancestors-hall', state: 'active' },
        lines: ['Bone-steel. You beat the bones of the dead into the iron while it’s white-hot. It’s an old trick, and a forbidden one. Father taught it to me so I’d know it when I saw it.', 'The bones come from the Hall of Ancestors, north-west of town. The Bonecallers dig them up, and the dead dig with them.'],
      },
      { when: { quest: 'the-deepforge-gate', state: 'active' }, lines: ['If you go to the gate, go round the slag heaps, not over them. Some are still hot. Some get up.'] },
      {
        when: { quest: 'forgemaster-grold', state: 'active' },
        lines: ['Three hundred years he kept that fire. If the Hollow King promised him it would never go out, I can guess what he said yes to.', 'It isn’t my father down there any more. Stop him. And if he says anything… no. Don’t tell me what he says.'],
      },
      {
        when: { quest: 'forgemaster-grold', state: 'done' },
        lines: ['The Deepforge is lit, and it’s mine now. I didn’t want it. I’ll keep it anyway.', 'Those gauntlets were the first thing I made in it. Look after them, and the hands in them.'],
      },
      { lines: ['I keep the little forge on the square while the big one is… occupied. Hinges, horseshoes, the odd sword.', 'My father was forgemaster of the Deepforge. He went in the night it fell.'] },
    ],
  },
};
