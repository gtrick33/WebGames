import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Lantern Hill's people and the Ashen Barrows' quests (Act II, STORY_BIBLE.md §4, "Lantern Hill"). Vosk carried
 * the Sigil of Stone north through the downs on the King's Road, guarded by "the knight of the barrows". The lamps
 * that keep the barrow dead in their mounds are going out one a night. The hero already knows the Hallow King's name
 * (Morgrave's journal, the Prologue); Brother Orren, last priest of the Lantern order, deepens it: what the Ash Crown
 * is, why Vaelor wants the seven sigils (the Crown of Ash and Starlight), and his order's rule that the dead stay
 * dead. His vigil relights the great lamp. The dead who came for it are the Ninefold Watch's own knights, under Sir
 * Corvane's black rose; Cael Varrow, the captain who lived, drinks in Lantern Hill as "Wat" and comes along. At the
 * Kings' Mound he finds the Watch's roll; at the bottom of the Barrow of Kings Corvane dies and gives him the proof:
 * the order that called off the Watch's relief, signed by Lord Chancellor Crane (v4: the Countermanded Order goes
 * straight on from the barrow to the Crown City). Kell has his own dead to lay. Main chain first.
 * Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const ASHEN_BARROWS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-lanterns-dim',
    name: 'The Lamps Go Out',
    giver: 'maren',
    text: 'Vosk stole the Sigil of Stone from Hearthstead, so the Host now holds one sigil and Elyra holds one. He is carrying it north on the King’s Road to the Hallow King. His orders said “the knight of the barrows” would guard him across the Ashen Barrows, and that someone in Aster had paid for the roads. Take the north road out of the Amberfield to Lantern Hill, the village on the downs, and find Lamplighter Ivo.',
    offer: [
      'Dunmore’s riders are settling in. Twenty horses, and I’ve found a stall for every one. Hearthstead held.',
      'But Vosk got away with its hearthstone, and it was a sigil. That makes one for the Host and one for Elyra.',
      'Morgrave’s journal said the Hallow King wants all seven. Vosk is carrying his first one north to him now.',
      'And his orders say someone in Aster paid for the roads. Somebody in our own kingdom is selling us.',
      'Follow him north into the Ashen Barrows. Find Lamplighter Ivo on Lantern Hill. Travelers say its lamps are going out.',
    ],
    objective: { kind: 'talk', npc: 'lamplighter-ivo', label: 'Talk to Lamplighter Ivo on Lantern Hill, in the Ashen Barrows' },
    // Act II opens once Act I is done: Hearthstead held, its riders in the camp
    after: ['camp-riders'],
    level: 22,
    reward: { xp: 650, gold: 200, text: 'The grey riders who crossed the dark downs four nights ago were Vosk’s, and the Sigil of Stone went north with them. You are days behind. Someone on the downs is putting the lamps out to give the Host a dark road, and Ivo says the last Lantern priest has been waiting for someone to come and ask him why.' },
  },
  {
    id: 'orren-the-last-chapel',
    name: 'The Last Chapel',
    auto: true,
    giver: 'lamplighter-ivo',
    text: 'Only one lamp on the downs has never gone out. It burns in Brother Orren’s chapel, at the top of Lantern Hill. Orren is the last priest of the Lantern order, which buried Aster’s kings for six hundred years. You know the Hallow King’s name. Ask Orren what the Host’s crown is, and what the Hallow King wants with the sigils.',
    objective: { kind: 'talk', npc: 'brother-orren', label: 'Talk to Brother Orren at the top of Lantern Hill' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 23,
    reward: { xp: 500, gold: 150, text: 'Now you know what the Hallow King is reaching for. With all seven sigils set in the Ash Crown, he could break out of Duskspire and raise his dead kingdom again out of Aster’s grief. The Host holds one sigil, and Elyra holds one. Orren takes down his oldest lamp and climbs to the top of the hill.' },
  },

  /* ----------------------------------------------------- the black rose */
  {
    id: 'the-last-lamp',
    name: 'The Vigil',
    giver: 'brother-orren',
    auto: true,
    text: 'The dead are putting out the lamps so the Host’s riders can cross the downs unseen. Tonight Orren will light the great lamp at the top of Lantern Hill and keep vigil beside it. If it burns until dawn, every lamp on the downs will light again. Keep the dead off the lamp until morning.',
    find: {
      name: 'A Black-Rose Shield-Boss',
      kind: 'relic',
      about: 'The iron boss of a shield, torn from one of the dead who came for the great lamp. A black rose is painted on it, fresh paint over old scratches. A name is scratched small inside the rim.',
      body: ['B. Hollin. Ninefold Watch.'],
    },
    objective: { kind: 'event', event: 'lantern-vigil', label: 'Keep the dead away from the great lamp' },
    after: ['orren-the-last-chapel'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 1100, gold: 260, text: 'The great lamp burns until dawn, and one by one every lamp on the downs lights again. The dead who came for it fought in a shield line, under a black rose. They were not barrow kings. They were knights, and somebody still gives them orders.' },
  },

  {
    id: 'cael-the-hostel',
    name: 'A Man Called Wat',
    giver: 'brother-orren',
    auto: true,
    text: 'The black rose was the badge of Sir Corvane, who commanded the Ninefold Watch, the knights who kept these downs. Ten years ago the Watch died here and Corvane vanished. Orren thinks Corvane is the knight of the barrows in Vosk’s orders. One of his captains lived. Cael Varrow drinks at the bottom of Lantern Hill, on its south-west side, and calls himself Wat.',
    objective: { kind: 'talk', npc: 'cael-varrow', label: 'Talk to “Wat” at the bottom of Lantern Hill' },
    after: ['the-last-lamp'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 800, gold: 200, text: 'Cael pours his cup out on the ground and fetches his sword from under Sister Maud’s counter, where it has lain for ten years. Corvane rode alone into the Kings’ Mound the night the Watch fell, and nobody followed him. In ten years Cael has never gone to look. Now he will.' },
  },

  {
    id: 'the-kings-mound',
    name: 'The Kings’ Mound',
    auto: true,
    giver: 'brother-orren',
    text: 'The Kings’ Mound is the oldest barrow on the downs, at their far western end, south-west of Lantern Hill. Corvane rode into it alone the night the Watch fell, and the black-rose dead come out of it now. Go there with Cael and find its door.',
    find: {
      name: 'The Roll of the Ninefold Watch',
      kind: 'page',
      about: 'A page of the Watch’s roll, left under a stone on the threshold of the Kings’ Mound ten winters ago. Every name is struck through with one hard line, Corvane’s own among them. Only Cael’s is left, and the last line is in Corvane’s hand.',
      body: [
        'The Ninefold Watch, keepers of the Kings’ Downs. The roll of its knights.',
        'Sir Corvane, Commander. Sir Bram Hollin. Dame Wynn Asher. Sir Garret Mull. Dame Elske Rowan. Sir Pieter Lusk. Sir Hamon Vell. Sir Jory Stane.',
        'Cael Varrow, Captain.',
        'He went south for the relief on the sixth day. He did not run. Leave his name.',
      ],
    },
    objective: { kind: 'explore', spot: 'kings-mound', label: 'Find the Kings’ Mound, south-west of Lantern Hill' },
    after: ['cael-the-hostel'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 900, gold: 240, text: 'The door of the Kings’ Mound stands open, and cold violet grieflight breathes out of it. Hoofprints ten years old go in through the door, and none come out. Cael reads the roll twice and puts it inside his coat, against his chest.' },
  },
  {
    id: 'the-barrow-king',
    name: 'The Barrow King',
    auto: true,
    giver: 'lamplighter-ivo',
    text: 'The Kings’ Mound stands open, and the dead inside are kneeling. Corvane has woken King Hrodric, the first king buried on the downs, to guard the way down to him. Go into the Barrow of Kings, down the Processional Way and through the Treasury, and defeat Hrodric in the Court of the Kings.',
    objective: { kind: 'boss', boss: 'king-hrodric', label: 'Defeat King Hrodric in the Barrow of Kings' },
    after: ['the-kings-mound'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 1600, gold: 300, item: { rarity: 'rare' }, text: 'King Hrodric sinks back onto his throne, and his court lies down around him. Below the Court of the Kings a stair goes on down into the dark. From the bottom comes a voice, counting slowly, the way a knight counts before a charge.' },
  },
  {
    id: 'sir-corvane',
    name: 'Sir Corvane the Fallen',
    auto: true,
    giver: 'sister-maud',
    text: 'Sir Corvane waits at the bottom of the Barrow of Kings, in the Chapel of Black Candles, past the Ossuary and the gallery where Gloomwing eats the lamps. He commanded the Ninefold Watch and taught Cael to hold a shield line. Now he is the Ashen Host’s first knight, the knight of the barrows who saw Vosk safely north. Defeat him.',
    find: {
      name: 'The Countermanded Order',
      kind: 'orders',
      about: 'The order that called off the relief of the Ninefold Watch, ten years ago this winter. A rider brought it to Corvane after Cael had gone south for help. Corvane kept it inside his armor for ten years and gave it to Cael as he died.',
      body: [
        'To Sir Corvane, Commander of the Ninefold Watch, at the Kings’ Downs.',
        'The relief column marching to you is recalled to the Crown City. No other will be sent this winter.',
        'Hold the downs with what you have.',
        'Given at the Ember Keep, in the King’s name, on the last day of winter.',
      ],
      sign: 'Maelis Crane, Lord Chancellor of Aster',
    },
    objective: { kind: 'boss', boss: 'sir-corvane', label: 'Defeat Sir Corvane in the Barrow of Kings' },
    after: ['the-barrow-king'],
    zone: 'ashen-barrows',
    level: 26,
    reward: {
      xp: 3300,
      gold: 900,
      item: 'corvanes-broken-sigil',
      unlock: 'emberwick',
      text: 'Sir Corvane goes down on his knees among the black candles, and the cold goes out of his armor. He is dying, and he is asking for Cael. His Watch badge lies broken on the floor where it fell.',
    },
  },
  /* ------------------------------------------------------ Kell's graves */
  {
    id: 'houndsmound',
    name: 'Dug Up',
    giver: 'gravedigger-kell',
    text: 'Gravedigger Kell digs Lantern Hill’s graves, and every night something digs them up again. The tracks lead south-east, past the Ninefold Barrows, to Houndsmound, where the old kings buried their hounds. Go and see whether the hounds are still in their graves.',
    find: {
      name: 'A Hound’s Collar',
      kind: 'relic',
      about: 'A bronze collar, green with age, dropped beside an empty grave at Houndsmound. Every grave there has been dug open from the inside. The hounds are out, and they are looking for someone.',
      body: ['Tally. She belongs to the Lord of the Downs. If she strays, she will go home to him.'],
    },
    objective: { kind: 'explore', spot: 'houndsmound', label: 'Follow the tracks to Houndsmound' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 24,
    thanks: ['Empty? All of them, dug out from the inside?', 'Give me that collar. I can read the old letters.'],
    reward: { xp: 700, gold: 210, text: 'Kell turns the collar over in his earth-black hands. The old kings were buried with their hounds so the hounds could wait for them. These hounds have stopped waiting.' },
  },
  {
    id: 'hounds-of-the-barrow',
    name: 'Hounds of the Barrow',
    giver: 'gravedigger-kell',
    text: 'The old kings’ hounds are out of Houndsmound and roaming the downs, and every night they dig in Kell’s graveyard on Lantern Hill. Put down ten of them, so Kell can fill in his graves for good.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 10, enemies: ['barrow-hound'], label: 'Put down barrow hounds' },
    after: ['houndsmound'],
    zone: 'ashen-barrows',
    reward: { xp: 800, gold: 220, text: 'Kell fills in his graves, and for the first night in a month they stay filled. The hounds were never digging for bones. They were digging for their master.' },
  },
  {
    id: 'hunt-headless-lord',
    name: 'The Headless Lord',
    giver: 'gravedigger-kell',
    text: 'The hounds’ master is the Headless Lord. He rides around the Ninefold Barrows every night, south-east of Lantern Hill, looking for his head. Kell found the lord’s helm years ago and kept it. Put the Headless Lord down, and Kell will give you the helm.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 1, enemies: ['the-headless-lord'], label: 'Defeat the Headless Lord at the Ninefold Barrows' },
    after: ['hounds-of-the-barrow'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 1550, gold: 260, item: 'headless-lords-helm', text: 'Kell gives you the Headless Lord’s helm, washed clean. He buries the lord at Houndsmound with his hounds around him, and fills that grave in himself.' },
  },
  /* ----------------------------------------------------- Maud's sisters */
];

export const ASHEN_BARROWS_NPCS: Record<string, NpcDef> = {
  'lamplighter-ivo': {
    id: 'lamplighter-ivo',
    name: 'Lamplighter Ivo',
    title: 'Lamplighter of Lantern Hill',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-lanterns-dim', state: 'active' },
        lines: [
          'Maren sent you? Then come into the light, and stay in it while you’re on the downs.',
          'For three hundred years these lamps kept the barrow dead asleep in their mounds. My family has lit them for five generations.',
          'Now the dead come up every night and put out one more lamp, each a little closer to the village.',
          'Four nights ago every lamp on the King’s Road was out. A column of grey riders went north through the dark without stopping.',
        ],
      },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['I raised the Watch’s old flag over the hill this morning. It’s been folded in my chest for ten years.', 'Cael is going to the city with you. Look after him. He’s been alone a long time.'] },
      {
        when: { quest: 'sir-corvane', state: 'active' },
        lines: ['Corvane was a hero once. He held the Watch-house three more days after Cael rode south, waiting for help.', 'My lamps can’t reach the bottom of that barrow. You’ll have to finish it down there.'],
      },
      {
        when: { quest: 'the-barrow-king', state: 'active' },
        lines: ['King Hrodric was the first king buried on the downs. My grandmother told stories about him to frighten me.', 'Now he’s awake, with his whole court. Be careful down there.'],
      },
      { when: { quest: 'orren-the-last-chapel', state: 'active' }, lines: ['Brother Orren keeps the chapel at the top of the hill. His lamp is the only one on the downs that has never gone out.', 'He’s the last of the Lantern priests. If anyone knows why the dead are walking, he does.'] },
      { when: { quest: 'the-last-lamp', state: 'done' }, lines: ['Every lamp on the downs is lit again, and the great one too. I sat down in the road and cried. Kell sat with me.'] },
      { lines: ['I light every lamp on this hill at dusk and put them out at dawn. I’ve done it for forty years.', 'Watch out for corpse-candles on the downs. They look like lamps, but they follow you.'] },
    ],
  },
  'sister-maud': {
    id: 'sister-maud',
    name: 'Sister Maud',
    title: 'Sigil-warden',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Wardens’ Rest',
    talk: [
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['Cael told me what Corvane gave him. The city let the Watch die, and let the hill call Cael a coward for it.', 'When it’s done, bring him back here. We’ll cut the Watch’s names into the chapel wall, all nine.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['Corvane was a good knight once, and Cael’s teacher. Something down there made him break his oath.', 'End it, for his sake as much as ours.'] },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound is at the far western end of the downs. Corvane went in ten years ago and never came out.', 'Cael has carried that for ten years. Stay close to him when you get there.'] },
      {
        when: { quest: 'cael-the-hostel', state: 'active' },
        lines: ['Cael Varrow was a captain of the Ninefold Watch. The hill says he ran away when the Watch fell. He didn’t.', 'Corvane sent him for help, and no help came. He drinks at the bottom of the village and calls himself Wat. Be gentle with him.'],
      },
      { lines: ['This is the Wardens’ Rest. I have potions, beds and prayers.', 'I’m the last sister of the Sigil-wardens’ order on the downs. Now I keep the inn.'] },
    ],
  },
  'gravedigger-kell': {
    id: 'gravedigger-kell',
    name: 'Gravedigger Kell',
    title: 'Gravedigger',
    sprite: 'villager',
    shop: 'weapons',
    shopName: 'Kell’s Grave Goods',
    talk: [
      { when: { quest: 'hunt-headless-lord', state: 'done' }, lines: ['The lord is in the ground at Houndsmound with his hounds around him. They can wait together now.', 'The helm suits you. Wear it well.'] },
      {
        when: { quest: 'hunt-headless-lord', state: 'active' },
        lines: ['The hounds were digging for their master, the Headless Lord. He rides round the Ninefold Barrows at night, looking for his head.', 'I’ve kept his old helm in my shed for years. Put him to rest, and it’s yours.'],
      },
      { when: { quest: 'hounds-of-the-barrow', state: 'active' }, lines: ['They’re out, all of them. I can see it on your face.', 'Put down ten of them, and I can finally fill my graves for good.'] },
      {
        when: { quest: 'houndsmound', state: 'active' },
        lines: ['Every morning I fill in a grave. Every night something digs it up again.', 'The tracks go south-east, past the Ninefold Barrows, to Houndsmound.', 'The old kings buried their hounds there. Go and see if they’re still buried.'],
      },
      { lines: ['I sell grave goods: weapons and armor buried with the old dead.', 'Their owners don’t need them anymore.'] },
    ],
  },
  // the companions of Lantern Hill (STORY_BIBLE.md §3)
  'brother-orren': {
    id: 'brother-orren',
    name: 'Brother Orren',
    title: 'Last of the Lantern priests',
    sprite: 'elder',
    talk: [
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Four places on that map, and the Host is digging at every one of them.', 'I’ll walk to each of them with you. Somebody has to say the prayers over what we find.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['The grey ones in the square were the Host’s, sent by the Pale Herald. They died like smoke.', 'Crane let them into the city. A Lord Chancellor of Aster opened the door for the dead.'] },
      { when: { quest: 'festival-the-lanterns', state: 'active' }, lines: ['Every child in the city has a paper star tonight. A whole city glad for one night. I’d forgotten what that looks like.', 'Keep your eyes on the crowd, all the same.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['The Sigil-wardens’ temple still keeps a lamp lit for each of the seven. I’ll pray here while you follow the money.', 'If you need me, I’m at the temple, in the north-east of the city.'] },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['I said the prayers over Corvane. He went quietly, at the end.', 'Now let’s see the living answer for what was done to him.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['When Corvane falls, I’ll say the prayers for the dead over him.', 'Wherever you go after that, I’m coming with you.'] },
      { when: { quest: 'the-last-lamp', state: 'active' }, lines: ['Stand by the great lamp at the top of the hill, where I can see you.', 'Some of the dead will call out names. Don’t answer them. Just keep them off the lamp.'] },
      {
        when: { quest: 'orren-the-last-chapel', state: 'active' },
        lines: [
          'The Hallow King is sealed in Duskspire, in the frozen north, behind a gate with seven locks.',
          'The seven sigils are Aster’s Starlight Crown, broken. With all seven he can open that gate from the inside.',
          'Then he means to set them in the Ash Crown and light it again. He calls it the Crown of Ash and Starlight.',
          'With that crown he would raise Vaelmoor again, out of Aster’s grief. Every mourner in Aster would feed his kingdom.',
          'My order buried Aster’s kings for six hundred years, and we kept one rule. The dead must stay dead.',
          'We lit the dead home. We never woke them. I won’t sit on this hill while he wakes them all.',
        ],
      },
      { lines: ['My order buried Aster’s kings for six hundred years. We believe the dead must stay dead.', 'The Ash Crown breaks that rule every night. I’ll help you stop it.'] },
    ],
  },
  'cael-varrow': {
    id: 'cael-varrow',
    name: 'Cael Varrow',
    title: 'Captain of the Ninefold Watch',
    sprite: 'villager',
    talk: [
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['The Ninefold Watch is one knight now. He goes where you go.', 'Corvane held the downs nine days with what he had. I mean to do as well with that map.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['I held the keep stair. Nobody came up it. Crane sent them all into the square, at her.', 'He knew we were coming for him at dawn. Somebody in the keep told him, or he guessed.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['Crane’s cellar. If I were Crane, I’d leave men in it, and I’d leave the door unlocked.', 'Let me go down the steps first. I’ll take the first blow on my shield.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['Crane looked straight at me in the courtyard. He knows my face. He knows what I carried here.', 'Ten years he’s sat in that keep. Let’s find the rest of it.'] },
      { when: { quest: 'the-kings-design', state: 'active' }, lines: ['Put the order in the Regent’s hand yourself. If I give it to her, Crane will say a deserter wrote it.', 'I’ll stand where he can see me. I want him to know the Watch has one knight left.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['Corvane taught me to fight in a shield line. If he’s down there, he’ll fight the same way.', 'Let me speak to him before the fight, if there’s anything of him left.'] },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound. That’s where Corvane went after the Watch fell. I always knew, and I never went to look.', 'I’m coming with you. I know how he fights.'] },
      {
        when: { quest: 'cael-the-hostel', state: 'active' },
        lines: [
          'All right. I’m Cael Varrow. I was a captain of the Ninefold Watch, nine knights who kept these downs.',
          'Ten winters ago the barrows opened under us. We held the Watch-house for nine days and waited for the relief.',
          'On the sixth day Corvane sent me south to hurry them. I rode two days. The road was empty all the way.',
          'When I got back, the Watch-house was burned and the others were dead. Corvane was gone. The city said I ran.',
          'I couldn’t tell them why nobody came. So I let them say it, and I drank, and I called myself Wat.',
          'If Corvane is pulling my brothers out of their graves, I have to see it with my own eyes. I’m coming with you.',
        ],
      },
      { lines: ['I’ve stopped drinking. I need a clear head for this.', 'The Ninefold Watch deserved better than me. I mean to do better now.'] },
    ],
  },
};

/** Orren's vigil at the great lamp of Lantern Hill. */
export const ASHEN_BARROWS_EVENTS: Record<string, StoryEventDef> = {
  'lantern-vigil': {
    id: 'lantern-vigil',
    region: 'ashen-barrows',
    kind: 'defend',
    at: 'lantern-hill',
    radius: 9,
    level: 24,
    allies: ['orren'],
    ward: { pet: 'great-lamp', at: 'lantern-hill', name: 'The Great Lamp' },
    banner: 'The Vigil',
    start: [
      { who: 'orren', text: 'It’s lit. Now it has to burn until dawn, and the dead will come up the hill to put it out.' },
      { who: 'orren', text: 'Here they come, from the north and the west. Keep them off the lamp!' },
    ],
    waves: [
      { enemies: ['corpse-candle', 'corpse-candle', 'barrow-wight', 'barrow-wight'], from: ['lantern-n', 'lantern-w'] },
      { enemies: ['banshee', 'wight-archer', 'barrow-wight', 'corpse-candle'], from: ['lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'That banshee is calling out names. Don’t answer. Cut it down!' }] },
      { enemies: ['wight-knight', 'barrow-wight', 'barrow-wight', 'wight-archer', 'banshee'], from: ['lantern-w', 'lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'Knights in a shield line, with black roses on their shields! Break the line before it reaches the lamp!' }] },
    ],
    end: [{ who: 'orren', text: 'Look down the hill. The lamps are lighting again, one after another. The dead will stay in their mounds tonight.' }],
    retry: [{ who: 'orren', text: 'They put it out. Light it again. We start over.' }],
  },
};
