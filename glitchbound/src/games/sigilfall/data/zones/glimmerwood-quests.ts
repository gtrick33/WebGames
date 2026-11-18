import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Lumen Glade's people and the Glimmerwood's quests (Act III, STORY_BIBLE.md §3). The second place on the
 * wardens' map is the Thorn Court, where the first Thistlemourn hid the Sigil of Thorns three hundred years ago. A
 * blight with the Host's violet light in it is killing the wood, and Lady Silvaine of Lumen Glade has sent for
 * help. The main chain runs from the Withered Ring, where the blight began, to the Pale Pavilion, where the Pale
 * Herald's letter offers Prince Thistlemourn, Silvaine's brother, the blight lifted in exchange for the sigil. He
 * has signed it, and the hero must choose: Old Root says end him (`the-thorn-court`); Silvaine asks for the
 * chance to sing him back while the hero holds his knights off her (`silvaines-song`). Taking one closes the
 * other; either way the prince gives up the sigil, the clans decide (`the-clans-decide`), and the choice changes
 * who rides in the Last March. Pip wants the moths' dust back, Old Root his old friend the Pale Hart, and
 * Silvaine her Moonwell. Main chain first. Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const GLIMMERWOOD_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-fading-lights',
    name: 'The Fading Lights',
    giver: 'oasis-keeper-sefu',
    auto: true,
    text: 'Elyra now carries two sigils, Embers and the Sun, and the Host still has one. The second place on the wardens’ map is the Thorn Court, in the Glimmerwood, north of the Sunscorch. Lady Silvaine of Lumen Glade has written to Sefu for help, because a blight is killing her wood. Take the north road into the Glimmerwood and find Silvaine in Lumen Glade.',
    objective: { kind: 'talk', npc: 'lady-silvaine', label: 'Talk to Lady Silvaine in Lumen Glade' },
    after: ['the-sun-king'],
    level: 31,
    reward: { xp: 800, gold: 260 },
  },
  /* ------------------------------------------------------ the Thorn Court */
  {
    id: 'the-withered-ring',
    name: 'The Withered Ring',
    auto: true,
    giver: 'lady-silvaine',
    text: 'The blight began at the Withered Ring, south-west of Lumen Glade, where the Summer Court used to dance. The Summer Court is the court of Silvaine’s brother, Prince Thistlemourn. One night in spring, the music at the ring stopped. Silvaine’s scouts won’t go near it. Go and find out what happened.',
    objective: { kind: 'explore', spot: 'withered-ring', label: 'Find the Withered Ring' },
    find: {
      name: 'A Silent Reed-Pipe',
      kind: 'relic',
      about: 'A reed-pipe of the Summer Court, found in the thorns at the Withered Ring. One of the prince’s musicians dropped it the night the music stopped. Violet light runs in the cracks of the reed, and it will not play.',
      body: ['For the Summer Court, to play until the moths go home.'],
    },
    after: ['the-fading-lights'],
    zone: 'glimmerwood',
    reward: { xp: 1000, gold: 270, text: 'The Summer Court stopped in the middle of a dance. Thorns full of the Host’s violet light grew up under the dancers’ feet. The blight did not come to the Glimmerwood by itself. The Host brought it.' },
  },
  {
    id: 'the-pale-pavilion',
    name: 'The Pale Pavilion',
    auto: true,
    giver: 'lady-silvaine',
    text: 'The blight is the Host’s doing. Now Silvaine’s own knights are leaving her, a few at a time, for the Pale Pavilion, a camp of grey tents in the far south-west of the wood. Find out who they are joining before you go to the Thorn Court.',
    objective: { kind: 'explore', spot: 'pale-pavilion', label: 'Scout the Pale Pavilion' },
    find: {
      name: 'The Herald’s Bargain',
      kind: 'letter',
      about: 'Found on the table in the prince’s tent at the Pale Pavilion. It is written in grey ink and sealed with the empty crown. Prince Thistlemourn has signed it.',
      body: ['Prince Thistlemourn,', 'The blight on your court is mine to give and mine to lift. I will lift it the night you put the Sigil of Thorns in my hand.', 'Your people will dance at the Ring again. Nobody need ever know what it cost.', 'Send your knights to the Pale Pavilion, and wait for me there.'],
      sign: 'The Pale Herald, for the Hallow King. Below, in green ink: Thistlemourn',
    },
    after: ['the-withered-ring'],
    zone: 'glimmerwood',
    level: 33,
    reward: { xp: 1100, gold: 300, text: 'The Pale Pavilion is Prince Thistlemourn’s camp, and the knights who left Silvaine are waiting there for the Herald. The prince has sold his family’s sigil to save his court. Silvaine and Old Root are waiting in Lumen Glade to hear what you found, and they will not agree on what to do next.' },
  },
  {
    id: 'the-thorn-court',
    name: 'The Thorn Court',
    giver: 'old-root',
    choice: 'thistlemourn',
    offer: ['The prince is gone. The Host’s thorns have grown into him, and they will not let him go.', 'Silvaine will ask you to try to save him. I say end it quickly, for his sake. (Taking this path closes Silvaine’s.)'],
    text: 'Prince Thistlemourn has agreed to give the Sigil of Thorns to the Pale Herald. He rules from the Thorn Court, north-west of Lumen Glade, and his knights now serve the Host. Old Root, the treant who keeps the inn, believes the prince is lost. Defeat Thistlemourn at the Thorn Court before he hands over the sigil.',
    objective: { kind: 'kill', region: 'glimmerwood', count: 1, enemies: ['prince-thistlemourn'], label: 'Defeat Prince Thistlemourn at the Thorn Court' },
    thanks: ['I felt the thorns let go of the wood when he fell. It was quick, then. Good.', 'Silvaine came in an hour ago. She took the circlet off her own head and left it on my bar for you.'],
    after: ['the-pale-pavilion'],
    zone: 'glimmerwood',
    level: 34,
    reward: {
      xp: 4400,
      gold: 1050,
      item: 'lumen-circlet',
      perk: 'sigil-thorns',
      text: 'As Thistlemourn fell, the thorns let go of him, and for a moment he knew his sister’s name. He gave you the Sigil of Thorns, which his family had guarded in the Thorn Court for three hundred years. Elyra carries three sigils now. Silvaine left you the circlet of Lumen Glade without a word.',
    },
  },
  {
    id: 'silvaines-song',
    name: 'Silvaine’s Song',
    giver: 'lady-silvaine',
    choice: 'thistlemourn',
    offer: ['Old Root thinks my brother is lost. I don’t believe it.', 'Our mother sang him a song when he was small. If I sing it to him in the Thorn Court, he may remember who he is. His knights will try to stop me. Will you hold them off? (Taking this path closes Old Root’s.)'],
    text: 'Silvaine will go to the Thorn Court and sing her brother the song their mother sang to him. She hopes it will make him remember who he is. His knights will attack her while she sings. Hold them off until the song is done.',
    objective: { kind: 'event', event: 'thorn-song', label: 'Protect Silvaine at the Thorn Court while she sings' },
    thanks: ['He knew me. He sat down on the floor of his own court and cried like a child, and he knew me.', 'He wants to make it right. He gave up the sigil himself, and I want you to have our mother’s circlet.'],
    after: ['the-pale-pavilion'],
    zone: 'glimmerwood',
    level: 34,
    reward: {
      xp: 4400,
      gold: 1050,
      item: 'lumen-circlet',
      perk: 'sigil-thorns',
      text: 'At the last note, the thorns fell from the prince’s crown, and he sat down on the floor and wept. Then he brought the Sigil of Thorns from the heart of the Thorn Court, where his family had guarded it for three hundred years, and put it into Elyra’s hands. She carries three sigils now. Silvaine gives you the circlet of Lumen Glade.',
    },
  },
  {
    id: 'the-clans-decide',
    name: 'The Clans Decide',
    giver: 'lady-silvaine',
    auto: true,
    text: 'The forest clans have seen what the Herald’s bargain cost the prince and his court. Silvaine has called them to Lumen Glade to decide whether they will march with the Regent against the Host. She wants you there when they answer.',
    objective: { kind: 'talk', npc: 'lady-silvaine', label: 'Talk to Lady Silvaine in Lumen Glade' },
    after: ['the-thorn-court', 'silvaines-song'],
    zone: 'glimmerwood',
    level: 35,
    // (the sigil is given at the Thorn Court now; the perk stays here too for saves from before, and is granted once)
    reward: { xp: 1600, gold: 400, perk: 'sigil-thorns', text: 'The clans agree. Their thorn archers and dryads will march when the Regent calls. With the Sigil of Thorns safe in Elyra’s keeping, two places are left on the wardens’ map. The next is the Rimeheld Vault, under the ice of Rimeheld, west of the Glimmerwood.' },
  },
  /* ------------------------------------------------------ Silvaine's well */
  {
    id: 'the-moonwell',
    name: 'The Moonwell',
    giver: 'lady-silvaine',
    text: 'Every fey court draws its light from a well. Lumen Glade’s is the Moonwell, in the old stones north-east of the glade, and it grows dimmer every night. Silvaine can’t leave the glade unguarded. Go and look into the Moonwell for her.',
    objective: { kind: 'explore', spot: 'moonwell', label: 'Look into the Moonwell' },
    find: {
      name: 'A Blighted Thorn',
      kind: 'relic',
      about: 'It was growing out of the Moonwell’s stone lip, as long as a finger, with the Host’s violet light inside it. Its roots go down into the water. Silvaine will want to see it.',
    },
    after: ['the-fading-lights'],
    zone: 'glimmerwood',
    level: 32,
    reward: { xp: 1000, gold: 280 },
  },
  {
    id: 'moonwater',
    name: 'Moonwater',
    giver: 'lady-silvaine',
    text: 'The blight is choking the Moonwell, and the creatures near it keep making it worse. Blighted dryads grow roots into the water, and glimmer moths shake sick dust over it. Defeat eight of them so Silvaine’s handmaids can clean the well.',
    objective: { kind: 'kill', region: 'glimmerwood', count: 8, enemies: ['blighted-dryad', 'glimmer-moth'], label: 'Defeat blighted dryads and glimmer moths' },
    after: ['the-moonwell'],
    zone: 'glimmerwood',
    level: 33,
    reward: { xp: 1300, gold: 300, item: { rarity: 'rare' }, text: 'The Moonwell shines a little brighter. Silvaine opens the court’s treasury to thank you.' },
  },
  /* --------------------------------------------------------- Pip's moths */
  {
    id: 'the-moth-glade',
    name: 'The Moth Glade',
    giver: 'pip-thistledown',
    text: 'Pip Thistledown sells lamps lit with dust from the moths of Moth Glade, north of Lumen Glade. The moths used to come to the glade at dusk so Pip could collect their dust. Now they attack anyone who comes near. Go and find out what is wrong in Moth Glade.',
    objective: { kind: 'explore', spot: 'moth-glade', label: 'Go to Moth Glade' },
    find: {
      name: 'A Grey Moth Wing',
      kind: 'relic',
      about: 'Found on the moss in Moth Glade. Pip’s moths used to shed silver dust. This wing sheds grey dust that stings the fingers. The blight has reached the moths.',
    },
    after: ['the-fading-lights'],
    zone: 'glimmerwood',
    level: 32,
    reward: { xp: 1000, gold: 280 },
  },
  {
    id: 'glimmerdust',
    name: 'Glimmerdust',
    giver: 'pip-thistledown',
    text: 'Every moth in Moth Glade has turned wild. Pip still needs their dust, because it keeps half the lamps in Lumen Glade burning. Collect six pinches of glimmerdust from glimmer moths anywhere in the wood.',
    objective: { kind: 'loot', region: 'glimmerwood', item: 'Pinch of Glimmerdust', from: ['glimmer-moth', 'mother-of-moths'], chance: 0.45, count: 6, label: 'Collect Glimmerdust from glimmer moths' },
    after: ['the-moth-glade'],
    zone: 'glimmerwood',
    level: 33,
    reward: { xp: 1300, gold: 300 },
  },
  {
    id: 'the-mother-of-moths',
    name: 'The Mother of Moths',
    giver: 'pip-thistledown',
    text: 'The glimmerdust is turning grey. Pip saw this once before, a hundred years ago, when the Mother of Moths fell sick. She is the oldest moth in the wood, as big as a cart, and every moth hatched from her. Now the blight has made her sick. Defeat her in Moth Glade, so the next brood can hatch healthy.',
    objective: { kind: 'kill', region: 'glimmerwood', count: 1, enemies: ['mother-of-moths'], label: 'Defeat the Mother of Moths in Moth Glade' },
    after: ['glimmerdust'],
    zone: 'glimmerwood',
    level: 34,
    reward: { xp: 2200, gold: 520, item: 'glimmerdust-locket', text: 'Pip seals the Mother’s last bright dust in a locket for you. It bursts into glimmerdust when you land a critical hit.' },
  },
  /* ------------------------------------------------------ Old Root's hart */
  {
    id: 'bloomrot',
    name: 'Bloomrot',
    giver: 'old-root',
    text: 'Old Root is a treant, a living tree, and his roots run under half the wood. The blight-blooms of Bloomrot Hollow, south-east of Lumen Glade, are chewing on them. Blight-blooms are walking flowers full of spores that burst when they die. Pull up eight of them.',
    objective: { kind: 'kill', region: 'glimmerwood', count: 8, enemies: ['blight-bloom'], label: 'Defeat blight-blooms' },
    after: ['the-fading-lights'],
    zone: 'glimmerwood',
    level: 32,
    reward: { xp: 1200, gold: 280 },
  },
  {
    id: 'the-harts-trail',
    name: 'The Hart’s Trail',
    giver: 'old-root',
    text: 'Old Root is worried about an old friend, the Pale Hart. The Hart is a white stag who comes to drink at Old Root’s pool every midsummer, but he didn’t come this year. He lives in the Hart’s Dell, in the far north-west of the wood past Moth Glade. Find him.',
    objective: { kind: 'explore', spot: 'harts-dell', label: 'Find the Hart’s Dell' },
    find: {
      name: 'A Tuft of White Hair',
      kind: 'relic',
      about: 'Caught on the thorns at the mouth of the Hart’s Dell. It is the Pale Hart’s, and it is stained violet where the thorns went in. Old Root will know it.',
    },
    after: ['bloomrot'],
    zone: 'glimmerwood',
    level: 34,
    reward: { xp: 1100, gold: 300 },
  },
  {
    id: 'rest-for-the-hart',
    name: 'Rest for the Hart',
    giver: 'old-root',
    text: 'The blight has grown thorns on the Pale Hart where his antlers were, and he attacked you on sight. Old Root is too old to walk to the Hart’s Dell. He asks you to go back and put his friend to rest.',
    objective: { kind: 'kill', region: 'glimmerwood', count: 1, enemies: ['the-pale-hart'], label: 'Put the Pale Hart to rest in the Hart’s Dell' },
    after: ['the-harts-trail'],
    zone: 'glimmerwood',
    level: 34,
    reward: { xp: 2300, gold: 540, item: 'harts-antler', text: 'Old Root gives you an antler the Hart shed at his pool long ago, before the blight. He says the Hart would want it carried by someone fast.' },
  },
];

export const GLIMMERWOOD_NPCS: Record<string, NpcDef> = {
  'lady-silvaine': {
    id: 'lady-silvaine',
    name: 'Lady Silvaine',
    title: 'Lady of Lumen Glade',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-fading-lights', state: 'active' },
        lines: ['Thank you for coming. I am Silvaine, Lady of Lumen Glade.', 'The fey don’t often ask for help. I asked because my wood is dying, and my brother has stopped answering my letters.'],
      },
      {
        when: { quest: 'the-withered-ring', state: 'active' },
        lines: ['My brother’s court, the Summer Court, used to dance at the Withered Ring, south-west of here.', 'One night in spring the music stopped. My scouts won’t go near it. Please find out why.'],
      },
      {
        when: { quest: 'the-pale-pavilion', state: 'active' },
        lines: ['So the Host brought the blight. I was afraid of that.', 'Now my knights are leaving me for the Pale Pavilion, a camp of grey tents in the far south-west of the wood. Find out who they are joining.'],
      },
      {
        when: { quest: 'the-thorn-court', state: 'active' },
        lines: ['You chose Old Root’s way. I asked you not to, but I understand.', 'Go quickly. Don’t let him suffer.'],
      },
      { when: { quest: 'silvaines-song', state: 'active' }, lines: ['Meet me at the Thorn Court. I will sing, and I won’t stop, whatever comes through the doors.', 'Keep his knights away from me until the song is done.'] },
      {
        when: { quest: 'the-clans-decide', state: 'active' },
        lines: ['Every clan in the wood has come to the glade.', 'Tell them what the Host offered my brother, and what it cost him.'],
      },
      { when: { quest: 'the-moonwell', state: 'active' }, lines: ['My court’s light comes from the Moonwell, north-east of the glade. It grows dimmer every night.', 'I can’t leave the glade unguarded. Please go and look at it for me.'] },
      { when: { quest: 'moonwater', state: 'active' }, lines: ['The blight is choking the Moonwell. My handmaids can clean it once nothing is fouling it.', 'Defeat the dryads and moths that keep spoiling the water.'] },
      { when: { quest: 'silvaines-song', state: 'taken' }, lines: ['My brother sleeps through the night now, for the first time since spring. He talks about our mother in his sleep.', 'You held the doors while I sang. Lumen Glade will not forget it.'] },
      {
        when: { quest: 'the-thorn-court', state: 'taken' },
        lines: ['They tell me he said my name at the end. Thank you for that.', 'I know why you did it, but I can’t forgive you yet.'],
      },
      { lines: ['Welcome to Lumen Glade. The glowing mushrooms are our lamps. Please don’t step on them.', 'The whole wood looked like this once. I want it to again.'] },
    ],
  },
  'pip-thistledown': {
    id: 'pip-thistledown',
    name: 'Pip Thistledown',
    title: 'Sprite Trader',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Pip’s Pocketful',
    talk: [
      {
        when: { quest: 'the-moth-glade', state: 'active' },
        lines: ['All my lamps burn dust from the moths of Moth Glade, north of here.', 'The moths used to come to me every evening. Now they attack me. Please find out why.'],
      },
      { when: { quest: 'glimmerdust', state: 'active' }, lines: ['The moths have all gone wild, but I still need their dust for my lamps.', 'Bring me six pinches from glimmer moths. Let them dive at you, then shake the dust off their wings.'] },
      {
        when: { quest: 'the-mother-of-moths', state: 'active' },
        lines: ['The dust is going grey. I saw that once before, a hundred years ago, when the Mother of Moths fell sick.', 'Every moth in the wood hatched from her. Put her to rest in Moth Glade, so the next brood hatches healthy.'],
      },
      { when: { quest: 'the-mother-of-moths', state: 'done' }, lines: ['The new moths came to the glade last night, bright and healthy. One landed on my hand and didn’t bite. Thank you.'] },
      { lines: ['Welcome to Pip’s Pocketful! Rings, charms and amulets, all lit with real glimmerdust.', 'Have a look around.'] },
    ],
  },
  'old-root': {
    id: 'old-root',
    name: 'Old Root',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Dew & Honey',
    talk: [
      {
        when: { quest: 'the-thorn-court', state: 'active' },
        lines: ['The Thorn Court is north-west of the glade. The prince holds it with his knights.', 'End it quickly. He has suffered enough, and so has the wood.'],
      },
      {
        when: { quest: 'bloomrot', state: 'active' },
        lines: ['Something is chewing on my roots. It’s the blight-blooms in Bloomrot Hollow, south-east of the glade.', 'Please pull up eight of them. I can’t do it myself.'],
      },
      {
        when: { quest: 'the-harts-trail', state: 'active' },
        lines: ['The Pale Hart didn’t come to my pool this midsummer. He has come every year for longer than I can remember.', 'He lives in the Hart’s Dell, in the far north-west past Moth Glade. Please find him.'],
      },
      { when: { quest: 'rest-for-the-hart', state: 'active' }, lines: ['That is his hair, and those are the blight’s thorns growing out of him. The blight got him too.', 'He would want it to end. I can’t walk that far anymore. Please go back and put him to rest.'] },
      { when: { quest: 'rest-for-the-hart', state: 'done' }, lines: ['The Hart is at rest. I will keep his pool clear in his memory.'] },
      { lines: ['Welcome to the Dew & Honey. Sit down and rest. I’m in no hurry.', 'I have stood here so long that the glade grew up around me.'] },
    ],
  },
  // the prince, if his sister's song brought him back (silvaines-song)
  thistlemourn: {
    id: 'thistlemourn',
    name: 'Prince Thistlemourn',
    title: 'Heir of the Summer Court, himself again',
    sprite: 'villager',
    talk: [
      {
        lines: [
          'The Pale Herald promised to lift the blight from my court if I gave him the Sigil of Thorns. I believed him.',
          'I led my knights into the Host’s service. When the Regent marches, I will ride with them and try to make it right.',
        ],
      },
    ],
  },
};

/** Silvaine sings her brother back in the Thorn Court (one answer to the Thistlemourn choice). */
export const GLIMMERWOOD_EVENTS: Record<string, StoryEventDef> = {
  'thorn-song': {
    id: 'thorn-song',
    region: 'glimmerwood',
    kind: 'defend',
    at: 'thorn-hall',
    radius: 10,
    level: 36,
    allies: ['orren'],
    ward: { pet: 'silvaine-singing', at: 'thorn-hall', name: 'Lady Silvaine' },
    banner: 'The Song',
    start: [
      { who: 'silvaine-singing', text: 'Thistle, do you remember this song? Mother sang it to us by the river.' },
      { who: 'orren', text: 'Keep singing, my lady. We’ll hold the doors.' },
    ],
    waves: [
      { enemies: ['fey-knight', 'thornling', 'thornling', 'thorn-archer'], from: ['thorn-hall-n', 'thorn-hall-w'] },
      { enemies: ['fey-knight', 'fey-knight', 'blighted-dryad', 'thorn-archer'], from: ['thorn-hall-e', 'thorn-hall-n'], barks: [{ who: 'silvaine-singing', text: 'She sang it by the river when the moths came out. Please remember, Thistle.' }] },
      { enemies: ['fey-knight', 'fey-knight', 'thorn-archer', 'thorn-archer', 'blighted-dryad', 'thornling'], from: ['thorn-hall-w', 'thorn-hall-e', 'thorn-hall-n'], barks: [{ who: 'orren', text: 'The thorns are falling out of his crown! Keep them off her!' }] },
    ],
    end: [{ who: 'silvaine-singing', text: 'Thistle? It’s you. You’re back.' }],
    retry: [{ who: 'orren', text: 'They got to her! Get her up, and she’ll start the song again!' }],
  },
};
