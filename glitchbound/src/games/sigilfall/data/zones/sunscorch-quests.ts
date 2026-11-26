import type { NpcDef, QuestDef } from '../types';

/**
 * The Oasis of Ras and the quests of the Sunscorch Expanse: the start of Act III, "The Race for the Sigils"
 * (STORY_BIBLE.md §3). The Host needs all seven sigils to free King Vaelor; Crane sold the Pale Herald the
 * wardens' map, and the first place on it is the Sun King's tomb. The Sun King, one of the seven wardens, sealed
 * himself in it with the Sigil of the Sun three hundred years ago, and the people of Ras have kept it shut ever
 * since. The main chain follows the raiders' copies of the Fallen Obelisk's carving to the Host's dig, the raider
 * chief Khamsin and the Sunken Gate, then down into the Tomb of the Sun King, where the sigil shows Elyra the
 * plague ship coming into Vaelmoor. Old Kasim has scorpions in his well, Merchant Zahra has lost her sand-ship to
 * the wurms, and Sandscribe Ibbi wants to know which of the old kingdom's dead have risen. Main chain first.
 * Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const SUNSCORCH_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-sun-kings-tomb',
    name: 'The Oasis of Ras',
    giver: 'regent-elowen',
    text: 'The Hallow King needs all seven sigils to break out of Duskspire. Elyra carries one, and the Host has one, the Sigil of Stone that Vosk stole. The wardens’ map marks four more places, and the Host has a head start on all of them. The first is the Sun King’s tomb in the Sunscorch. Take the west road from the Crown City and find Oasis-keeper Sefu at the Oasis of Ras.',
    objective: { kind: 'talk', npc: 'oasis-keeper-sefu', label: 'Talk to Oasis-keeper Sefu at the Oasis of Ras' },
    after: ['festival-the-champion'],
    level: 30,
    reward: { xp: 850, gold: 260, text: 'Sefu will help you reach the Sun King’s tomb before the Host does. The oasis smugglers owe Nyx money. Instead of paying her, they tell her which desert roads the Host’s diggers use.' },
  },
  /* ------------------------------------------------------- the Sun King */
  {
    id: 'the-sandscribe',
    name: 'The Sandscribe',
    auto: true,
    giver: 'oasis-keeper-sefu',
    text: 'Desert raiders have been attacking the oasis, and the Host pays them in ash-gold. Each raider also carries a scrap of linen with old writing on it. Sandscribe Ibbi can read the old desert kingdom’s writing. Show her the scraps. She works in the shade by the wells.',
    objective: { kind: 'talk', npc: 'sandscribe-ibbi', label: 'Show the linen scraps to Sandscribe Ibbi' },
    find: {
      name: 'A Raider’s Linen Scrap',
      kind: 'note',
      about: 'Every raider who attacked the oasis carried one of these, with a purse of ash-gold. Ibbi says the words were copied in a hurry from the Fallen Obelisk. Only pieces of them are left.',
      body: ['…sleeps with his warm thing…', '…where the sun first…', '…his door looks to the…'],
    },
    after: ['the-sun-kings-tomb'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 900, gold: 270 },
  },
  {
    id: 'the-fallen-obelisk',
    name: 'The Fallen Obelisk',
    auto: true,
    giver: 'sandscribe-ibbi',
    text: 'The scraps were copied from the Fallen Obelisk, a toppled stone south-east of the oasis. The old kings carved the way to the Sun King’s tomb on it. The raiders are copying it for the Host, a piece at a time. Go and read the whole carving before they finish.',
    objective: { kind: 'explore', spot: 'fallen-obelisk', label: 'Read the carving on the Fallen Obelisk' },
    find: {
      name: 'The Obelisk’s Carving',
      kind: 'page',
      about: 'The old kings’ words, cut into the Fallen Obelisk south-east of the oasis. Elyra read the whole carving aloud while Nyx copied it. The raiders’ scraps were pieces of this.',
      body: ['Here is the way to the King who keeps watch.', 'He sleeps with his warm thing where the sun first touches the sand.', 'His door faces the sunrise. Let no one open it.', 'He did not lie down to rest. He lay down to guard what he holds.'],
      sign: 'Cut by the scribes of the Sun King',
    },
    after: ['the-sandscribe'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 1000, gold: 280, text: 'The carving puts the Sun King’s tomb in the east of the sands, and what he guards there is the Sigil of the Sun. From the top of the obelisk you can see dust rising east of the oasis. The Host is already digging there.' },
  },
  {
    id: 'the-hollow-dig',
    name: 'The Ashen Dig',
    auto: true,
    giver: 'oasis-keeper-sefu',
    text: 'The Host has set up a dig east of the oasis. Its dead miners shovel day and night, bonecallers drum to keep them working, and a bone golem hauls the sand away. They are digging toward the Sun King’s tomb. Break up the Ashen Dig before they get there.',
    objective: { kind: 'kill', region: 'sunscorch', count: 6, enemies: ['legion-miner', 'legion-bonecaller', 'bone-golem'], label: 'Defeat the Host’s diggers at the Ashen Dig' },
    after: ['the-fallen-obelisk'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 1200, gold: 290, text: 'The Ashen Dig is broken, and its dead miners lie still in their trenches. Their tunnel runs on east, toward the sunrise, far deeper than it looked. The Host had nearly reached the Sun King before you came.' },
  },
  {
    id: 'khamsin',
    name: 'Khamsin',
    giver: 'oasis-keeper-sefu',
    text: 'The raiders guide the Host’s diggers across the desert. Their chief, Khamsin, sold the Host the safe routes. He camps at the Raiders’ Rest, north-east of the oasis, with his best riders. Defeat him, and the Host loses its guides.',
    objective: { kind: 'kill', region: 'sunscorch', count: 1, enemies: ['khamsin'], label: 'Defeat Khamsin at the Raiders’ Rest' },
    after: ['the-hollow-dig'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 1700, gold: 450, item: { rarity: 'rare', name: 'Caravan’s Thanks' }, text: 'Khamsin’s riders scatter into the dunes. The Host has no guides left in the desert, and the caravan roads are safer.' },
  },
  {
    id: 'the-sunken-gate',
    name: 'The Sunken Gate',
    auto: true,
    giver: 'oasis-keeper-sefu',
    text: 'The Host’s tunnel ran east from the Ashen Dig, toward the sunrise, just as the carving said. Before you broke up the dig, it had already reached the Sun King’s door, the Sunken Gate. Find the Sunken Gate in the east of the sands and see what the Host found there.',
    objective: { kind: 'explore', spot: 'sunken-gate', label: 'Find the Sunken Gate in the far east' },
    find: {
      name: 'The Host’s Dig Orders',
      kind: 'orders',
      about: 'Nailed to a post at the broken Sunken Gate, for the raiders who guided the Host’s diggers. It is stamped with an empty crown, the Pale Herald’s mark. The warm iron is the Sigil of the Sun.',
      body: ['Dig east until you reach the warm iron. Do not stop for the heat. Do not stop for the dead.', 'The King grows impatient. Every day you dig is a day he waits in the dark.', 'Whatever wakes below, bring out the warm iron. Leave the rest to burn.'],
      sign: '(stamped with an empty crown)',
    },
    after: ['the-hollow-dig'],
    zone: 'sunscorch',
    level: 32,
    reward: { xp: 1150, gold: 300, text: 'The Sunken Gate stands broken open, and the Host’s tracks run away from it in a panic. Something in the tomb drove the diggers out. Ibbi warned you about what guards the Sun King’s door.' },
  },
  {
    id: 'the-sand-warden',
    name: 'The Sand Warden',
    auto: true,
    giver: 'sandscribe-ibbi',
    text: 'The Host broke the Sunken Gate open, and the Sand Warden drove it back out. Ibbi warned you about it: a guardian the old kings built to keep robbers out of the tomb. It attacks anyone who comes through the door. Go down into the Tomb of the Sun King and defeat it.',
    objective: { kind: 'boss', boss: 'the-sand-warden', label: 'Defeat the Sand Warden in the Tomb of the Sun King' },
    after: ['the-sunken-gate'],
    zone: 'sunscorch',
    level: 32,
    reward: { xp: 2200, gold: 400, item: { rarity: 'rare', name: 'Sand-Warden’s Core' }, text: 'The Sand Warden falls apart into sand and old stone. Deeper in, the tomb is warm, and getting warmer. Something in the burial chamber is awake, and it is angry.' },
  },
  {
    id: 'the-sun-king',
    name: 'The Sun King',
    auto: true,
    giver: 'oasis-keeper-sefu',
    text: 'The Sun King was one of the seven wardens. Three hundred years ago he sealed himself in his tomb with the Sigil of the Sun to guard it. The Host’s picks woke him, and now he thinks everyone who comes in is a thief. Defeat him in his burial chamber and take the sigil before the Host can.',
    objective: { kind: 'boss', boss: 'the-sun-king', label: 'Defeat the Sun King and take the Sigil of the Sun' },
    after: ['the-sand-warden'],
    zone: 'sunscorch',
    level: 32,
    reward: {
      xp: 4250,
      gold: 1100,
      item: 'oasis-heart',
      perk: 'sigil-sun',
      text: 'At the end the Sun King knew you were no thieves. He put the Sigil of the Sun into Elyra’s hands and lay back down to rest. Elyra now holds two sigils, and the Host still holds one. Sefu’s Oasis Heart is yours, and the lancers of Ras will ride when the Regent calls.',
    },
  },
  /* ----------------------------------------------------- Kasim's scorpions */
  {
    id: 'scorpions-in-the-well',
    name: 'Scorpions in the Well',
    giver: 'old-kasim',
    text: 'Old Kasim runs the Last Well, the inn at the oasis. Scorpions are climbing up his well through old shafts that lead to Scorpion Hollow, south-west of the oasis. Defeat the sand scorpions around the oasis to thin them out.',
    objective: { kind: 'kill', region: 'sunscorch', count: 10, enemies: ['sand-scorpion'], label: 'Defeat sand scorpions' },
    after: ['the-sun-kings-tomb'],
    zone: 'sunscorch',
    reward: { xp: 850, gold: 260 },
  },
  {
    id: 'venom-for-the-still',
    name: 'Venom for the Still',
    giver: 'old-kasim',
    text: 'Kasim brews antivenom from scorpion venom in his still. Every caravan that leaves Ras carries a flask of it. He needs six venom sacs, unburst, from the sand scorpions around Scorpion Hollow.',
    objective: { kind: 'loot', region: 'sunscorch', item: 'Venom Sac', from: ['sand-scorpion'], chance: 0.45, count: 6, label: 'Collect Venom Sacs from sand scorpions' },
    after: ['scorpions-in-the-well'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 950, gold: 270 },
  },
  {
    id: 'the-dune-tyrant',
    name: 'The Dune Tyrant',
    giver: 'old-kasim',
    text: 'The scorpions follow the Dune Tyrant, a black scorpion as big as a cart. It lives in Scorpion Hollow, south-west of the oasis. Kasim’s grandfather died trying to kill it. Kasim asks you to finish what his grandfather started.',
    objective: { kind: 'kill', region: 'sunscorch', count: 1, enemies: ['the-dune-tyrant'], label: 'Defeat the Dune Tyrant in Scorpion Hollow' },
    after: ['venom-for-the-still'],
    zone: 'sunscorch',
    level: 31,
    // (the side story's turn: the grandfather did not fail. The well has been safe from the Tyrant itself ever since)
    find: {
      name: 'A Spearhead with the Well-Mark',
      kind: 'relic',
      about: 'Found in the Dune Tyrant’s shell in Scorpion Hollow, under the plate over its heart, with the shell grown thick around it. It is an old iron spearhead stamped with the mark of the Last Well. Kasim’s grandfather put it there. The Tyrant has carried it ever since, and in all those years it never once climbed the shafts itself: it only sent the small ones.',
    },
    reward: { xp: 1400, gold: 450, item: 'tyrant-carapace', text: 'Kasim holds the spearhead a long time. His family has always said the old man died trying. He died having done most of it, and nobody knew. Kasim has the Tyrant’s shell made into a breastplate for you, sets the spearhead on his grandfather’s stone, and pours two drinks there.' },
  },
  /* -------------------------------------------------- Zahra's sand-ship */
  {
    id: 'the-sand-ship',
    name: 'The Sand-Ship',
    giver: 'merchant-zahra',
    text: 'Merchant Zahra sails the dunes in a sand-ship, a boat on runners pushed by the wind. A week ago it was wrecked north of the oasis with her silk aboard. Her crew walked back. Go and see what is left.',
    objective: { kind: 'explore', spot: 'sand-ship', label: 'Find the Sand-Ship, north of the oasis' },
    find: {
      name: 'The Sand-Ship’s Log',
      kind: 'note',
      about: 'Found in the wreck of Zahra’s sand-ship, north of the oasis, wedged under the tiller. Her pilot wrote in it until the crew walked home.',
      body: ['Third day out of Ras. Wind fair. Silk dry and lashed.', 'Dusk. The sand is moving under us, and it is not the wind.', 'Wurms. Two of them. The hull is holed and four bales are gone down their throats. We walk back to Ras at first light.'],
      sign: 'Rasul, Zahra’s pilot',
    },
    after: ['the-sun-kings-tomb'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 850, gold: 260 },
  },
  {
    id: 'swallowed-silk',
    name: 'Swallowed Silk',
    giver: 'merchant-zahra',
    text: 'Sand wurms wrecked Zahra’s sand-ship and swallowed her bales of sunsilk whole. Wurms can’t digest silk, so it is still inside them. Cut the bolts out of the sand wurms north of the oasis.',
    objective: { kind: 'loot', region: 'sunscorch', item: 'Bolt of Sunsilk', from: ['sand-wurm'], chance: 0.45, count: 5, label: 'Recover Bolts of Sunsilk from sand wurms' },
    after: ['the-sand-ship'],
    zone: 'sunscorch',
    level: 31,
    reward: { xp: 950, gold: 280 },
  },
  {
    id: 'the-wurm-road',
    name: 'The Wurm Road',
    giver: 'merchant-zahra',
    text: 'Zahra won’t sail again while sand wurms hunt the caravan roads. Defeat sand wurms anywhere in the Sunscorch, and she will pay you in silk.',
    objective: { kind: 'kill', region: 'sunscorch', count: 8, enemies: ['sand-wurm'], label: 'Defeat sand wurms' },
    after: ['swallowed-silk'],
    zone: 'sunscorch',
    level: 32,
    reward: { xp: 1300, gold: 420, item: 'sunsilk-wraps', text: 'Zahra has the cleanest of the recovered silk made into wraps for you.' },
  },
  /* ------------------------------------------------- Ibbi's old kingdom */
  {
    id: 'scarab-seals',
    name: 'Scarab Seals',
    giver: 'sandscribe-ibbi',
    text: 'Each of the Sun King’s courtiers was buried with a gold seal bearing their name. Tomb scarabs eat gold and can’t digest it, so many of the seals are now in their bellies. Ibbi wants six, so she can learn which of the dead have risen. Take them from the tomb scarabs east of the oasis.',
    objective: { kind: 'loot', region: 'sunscorch', item: 'Sun Seal', from: ['tomb-scarab'], chance: 0.3, count: 6, label: 'Take Sun Seals from tomb scarabs' },
    after: ['the-hollow-dig'],
    zone: 'sunscorch',
    level: 32,
    reward: { xp: 1000, gold: 300 },
  },
  {
    id: 'the-necropolis-of-ras',
    name: 'The Necropolis of Ras',
    giver: 'sandscribe-ibbi',
    text: 'Every name on the seals belongs to someone buried in the Necropolis of Ras, the old kings’ burial ground in the far south-east. Ibbi has always wanted to see its Temple of the Dawn, but she has been too afraid to go. Go and see whether the temple still stands, and whether its dead have risen.',
    objective: { kind: 'explore', spot: 'necropolis', label: 'Reach the Necropolis of Ras' },
    find: {
      name: 'The Dawn Temple’s Prayer',
      kind: 'page',
      about: 'Cut over the doors of the Temple of the Dawn, in the Necropolis of Ras. The doors stand open, and the courtiers whose seals you took walk its halls in their linen. Ibbi will want every word.',
      body: ['Sleep, children of Ras, and wake with the sun.', 'Wake with the sun, and not before.', 'If you wake in the dark, lie down again. The sun has not forgotten you.'],
      sign: 'The priests of the Dawn',
    },
    after: ['scarab-seals'],
    zone: 'sunscorch',
    level: 32,
    reward: { xp: 1150, gold: 420, item: 'sunscribe-seal', text: 'The Temple of the Dawn still stands, and the dead of Ras have risen inside it. Ibbi writes down the priests’ prayer with shaking hands. Then she gives you the seal of the Sun King’s own scribe.' },
  },
];

export const SUNSCORCH_NPCS: Record<string, NpcDef> = {
  'oasis-keeper-sefu': {
    id: 'oasis-keeper-sefu',
    name: 'Oasis-keeper Sefu',
    title: 'Keeper of the Oasis of Ras',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-sun-kings-tomb', state: 'active' },
        lines: ['The Regent sent you? Good. The Host’s dead have been digging in the sand east of my wells for a month.', 'My people have kept the Sun King’s tomb shut for three hundred years. I would rather you reach it before the Host does.'],
      },
      {
        when: { quest: 'the-sandscribe', state: 'active' },
        lines: ['The raiders who attack my oasis carry ash-gold now, and scraps of linen with old writing on them.', 'Sandscribe Ibbi can read it. She works in the shade by the wells.'],
      },
      {
        when: { quest: 'the-hollow-dig', state: 'active' },
        lines: ['The Host is digging east of here, where there was only sand last month.', 'Stop them before they reach the Sun King’s tomb.'],
      },
      {
        when: { quest: 'khamsin', state: 'active' },
        lines: ['Khamsin leads the raiders. He sold the Host the safe routes across the desert.', 'He camps at the Raiders’ Rest, north-east of the oasis. His riders are fast. Be careful.'],
      },
      {
        when: { quest: 'the-sunken-gate', state: 'active' },
        lines: ['The obelisk points east, toward the sunrise. The Host’s tunnel went the same way.', 'Find the Sunken Gate and see how far the Host got.'],
      },
      {
        when: { quest: 'the-sand-warden', state: 'active' },
        lines: ['The Sand Warden is awake, then. My grandmother said it was built to stop robbers, and it stops anyone.', 'The way down is the Sunken Gate. Go carefully.'],
      },
      {
        when: { quest: 'the-sun-king', state: 'active' },
        lines: ['The stories say the Sun King dug the first well in Ras with his own hands.', 'The Host’s picks woke him, and he won’t know you from them. Take the sigil anyway. It can’t be left for the Host.'],
      },
      {
        when: { quest: 'the-fading-lights', state: 'active' },
        lines: ['Lady Silvaine of Lumen Glade has written to me for help. A blight is killing her wood.', 'The Thorn Court is in her wood, north of here. Take the north road into the Glimmerwood and find her.'],
      },
      {
        when: { quest: 'the-sun-king', state: 'done' },
        lines: ['The Sun King is at rest again, and the Host has nothing left to dig for here. Ras thanks you.', 'When the Regent marches, my lancers will ride with her.'],
      },
      { lines: ['Welcome to the Oasis of Ras. Drink before you go out on the sand.', 'Raiders and the Host are both out there. Don’t go far with an empty waterskin.'] },
    ],
  },
  'merchant-zahra': {
    id: 'merchant-zahra',
    name: 'Merchant Zahra',
    title: 'Merchant',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Zahra’s Bazaar',
    talk: [
      {
        when: { quest: 'the-sand-ship', state: 'active' },
        lines: ['My sand-ship was wrecked north of the oasis. My crew walked back, but my silk is still out there.', 'Please go and see what is left of it.'],
      },
      {
        when: { quest: 'swallowed-silk', state: 'active' },
        lines: ['Sand wurms wrecked my ship and swallowed the silk bales whole. They can’t digest silk.', 'Cut five bolts out of them and bring them to me.'],
      },
      {
        when: { quest: 'the-wurm-road', state: 'active' },
        lines: ['I won’t sail again while the wurms hunt the caravan roads.', 'Defeat eight of them, and I’ll pay you in silk.'],
      },
      { when: { quest: 'the-wurm-road', state: 'done' }, lines: ['The roads are safe enough to sail again. Thank you. That silk suits you.'] },
      { lines: ['Welcome to Zahra’s Bazaar. I sell rings, charms and relics from all over the desert.', 'Take your time and look around.'] },
    ],
  },
  'sandscribe-ibbi': {
    id: 'sandscribe-ibbi',
    name: 'Sandscribe Ibbi',
    title: 'Scholar of the Old Kingdom',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-sandscribe', state: 'active' },
        lines: ['This is the old kingdom’s writing, copied badly by someone in a hurry.', 'It comes from the Fallen Obelisk, south-east of here. The old kings carved directions to the Sun King’s tomb on it.'],
      },
      {
        when: { quest: 'the-fallen-obelisk', state: 'active' },
        lines: ['The Fallen Obelisk is south-east of the oasis. Read the whole carving before the raiders finish copying it for the Host.', 'And if the Host breaks the King’s door, beware the Sand Warden. The old kings built it to guard him, and every book says it has never been beaten.'],
      },
      {
        when: { quest: 'the-sand-warden', state: 'active' },
        lines: ['Every old book says that nobody has ever gotten past the Sand Warden.', 'It guards the way to the Sun King’s burial chamber. Be ready when you go in.'],
      },
      {
        when: { quest: 'scarab-seals', state: 'active' },
        lines: ['Tomb scarabs eat gold and can’t digest it. Their bellies are full of the courtiers’ gold seals.', 'Each seal has a name on it. Bring me six, and I can tell you who has risen.'],
      },
      {
        when: { quest: 'the-necropolis-of-ras', state: 'active' },
        lines: ['Every name on these seals belongs to someone buried in the Necropolis of Ras, in the far south-east.', 'I have wanted to see its Temple of the Dawn all my life, but I was too afraid to go. Please see if it still stands.'],
      },
      { when: { quest: 'the-necropolis-of-ras', state: 'done' }, lines: ['The Temple of the Dawn still stands! Thank you for going. Tell me everything you saw, and I’ll write it down.'] },
      { when: { quest: 'the-sun-king', state: 'done' }, lines: ['You found the Sun King in his own tomb, with the sigil in his hands. I will write it all down.'] },
      { lines: ['I study the old desert kingdom. It wrote down everything, from its kings’ names to its taxes.', 'If you find anything with writing on it, bring it to me before you sell it.'] },
    ],
  },
  'old-kasim': {
    id: 'old-kasim',
    name: 'Old Kasim',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Last Well',
    talk: [
      {
        when: { quest: 'scorpions-in-the-well', state: 'active' },
        lines: ['Scorpions are coming up my well. They climb the old shafts from Scorpion Hollow, south-west of here.', 'Please defeat ten of them around the oasis. That should thin them out.'],
      },
      {
        when: { quest: 'venom-for-the-still', state: 'active' },
        lines: ['I make antivenom from scorpion venom. Every caravan that leaves Ras carries a flask.', 'Bring me six venom sacs from the scorpions around Scorpion Hollow. Try not to burst them.'],
      },
      {
        when: { quest: 'the-dune-tyrant', state: 'active' },
        lines: ['The scorpions follow the Dune Tyrant, a black scorpion as big as a cart. It lives in Scorpion Hollow.', 'My grandfather went in to kill it and never came back. Please finish what he started.'],
      },
      { when: { quest: 'the-dune-tyrant', state: 'done' }, lines: ['The Dune Tyrant is dead! Tonight I poured a drink at my grandfather’s stone. Thank you.', 'His spearhead sits on that stone now. I tell every caravan who it was that kept the Tyrant out of this well.'] },
      { lines: ['This is the Last Well, the last inn before the deep desert. Rest here before you go out.', 'Shake out your boots in the morning. Scorpions like to sleep in them.'] },
    ],
  },
};
