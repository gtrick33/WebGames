import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Lantern Hill's people and the Ashen Barrows' quests (Act II, STORY_BIBLE.md §4, "Lantern Hill"). Vosk carried
 * the Sigil of Stone north through the downs on the King's Road, guarded by "the knight of the barrows". The lamps
 * that keep the barrow dead in their mounds are going out one a night. Brother Orren, last priest of the Lantern
 * order, tells the hero what the Ashen Host is and what it wants (King Vaelor, the Ash Crown, the seven sigils),
 * and his vigil relights the great lamp. The dead wore the black rose of Sir Corvane, who commanded the Ninefold
 * Watch ten years ago; Cael Varrow, his surviving captain, drinks in Lantern Hill as "Wat" and comes along. At the
 * bottom of the Barrow of Kings Corvane dies asking Cael's forgiveness and gives him the proof: the order that
 * called off the Watch's relief, signed by Lord Chancellor Crane. Kell has his own dead to lay. Main chain first.
 * Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const ASHEN_BARROWS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-lanterns-dim',
    name: 'The Lamps Go Out',
    giver: 'maren',
    text: 'Vosk is carrying the Sigil of Stone north on the King’s Road, through the Ashen Barrows. His orders say “the knight of the barrows” will guard him there. Travelers say the lamps of Lantern Hill, the village on the downs, are going out one a night. Take the north road out of the Amberfield and find Lamplighter Ivo.',
    offer: [
      'Hearthstead held. But Vosk got away with its hearthstone, and Elyra says it was a sigil.',
      'The Host is gathering the sigils. Elyra carries one. Now Vosk has another, and he’s taking it north.',
      'His orders say a “knight of the barrows” will guard him through the Ashen Barrows. Go north and find out who that is.',
    ],
    objective: { kind: 'talk', npc: 'lamplighter-ivo', label: 'Talk to Lamplighter Ivo on Lantern Hill' },
    // Act II opens once Act I is done: Hearthstead held, its riders in the camp
    after: ['camp-riders'],
    level: 22,
    reward: { xp: 650, gold: 200, text: 'Four nights ago the whole King’s Road went dark, and riders went north through the downs without stopping. Vosk and the sigil are already gone. Someone is leading the dead, and Ivo says Brother Orren knows what is waking them.' },
  },
  {
    id: 'orren-the-last-chapel',
    name: 'The Last Chapel',
    auto: true,
    giver: 'lamplighter-ivo',
    text: 'One lamp on the downs has never gone out: the one in Brother Orren’s chapel, at the top of Lantern Hill. Orren is the last priest of the Lantern order, which buried Aster’s kings. Ivo thinks Orren knows what is waking the dead. Go up the hill and ask him.',
    objective: { kind: 'talk', npc: 'brother-orren', label: 'Talk to Brother Orren at the top of Lantern Hill' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 23,
    reward: { xp: 500, gold: 150, text: 'Now you know who the Ashen Host serves: King Vaelor, whom the dead call the Hallow King, locked in his citadel in the far north. The seven sigils are the keys to his gate. Elyra carries one, and Vosk is taking another to him.' },
  },

  /* ----------------------------------------------------- the black rose */
  {
    id: 'the-last-lamp',
    name: 'The Vigil',
    giver: 'brother-orren',
    auto: true,
    text: 'The dead are putting out the lamps so the Host’s riders can use the King’s Road unseen. If the great lamp at the top of the hill burns until dawn, every lamp on the downs will light again. Orren will light it and pray beside it. Keep the dead away from the lamp.',
    objective: { kind: 'event', event: 'lantern-vigil', label: 'Keep the dead away from the great lamp' },
    after: ['orren-the-last-chapel'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 1100, gold: 260, text: 'The great lamp burns until dawn, and every lamp on the downs lights again. The dead who attacked it carried shields painted with a black rose. Orren knows whose badge that is.' },
  },

  {
    id: 'cael-the-hostel',
    name: 'A Man Called Wat',
    giver: 'brother-orren',
    auto: true,
    text: 'The black rose was the badge of Sir Corvane, who commanded the Ninefold Watch, the knights who guarded these downs. Ten years ago the Watch was wiped out and Corvane vanished. Orren thinks Corvane is the knight of the barrows. His one surviving captain, Cael Varrow, drinks in Lantern Hill under the name Wat.',
    objective: { kind: 'talk', npc: 'cael-varrow', label: 'Talk to “Wat” in Lantern Hill' },
    after: ['the-last-lamp'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 800, gold: 200, text: 'Cael puts down his cup and fetches his sword. He tells you Corvane rode alone into the Kings’ Mound the winter the Watch fell. He is coming with you.' },
  },

  {
    id: 'the-kings-mound',
    name: 'The Kings’ Mound',
    auto: true,
    giver: 'brother-orren',
    text: 'The Kings’ Mound is the oldest barrow on the downs, at their far western end. Corvane rode into it alone after the Watch fell, and the dead have been coming out of it ever since. Go there with Cael.',
    objective: { kind: 'explore', spot: 'kings-mound', label: 'Find the Kings’ Mound, west of Lantern Hill' },
    after: ['cael-the-hostel'],
    zone: 'ashen-barrows',
    level: 26,
    reward: { xp: 900, gold: 240 },
  },
  {
    id: 'the-barrow-king',
    name: 'The Barrow King',
    auto: true,
    giver: 'lamplighter-ivo',
    text: 'The Kings’ Mound stands open. Inside, Corvane has woken King Hrodric, the first king buried on the downs, to guard the way down to him. Go into the Barrow of Kings and defeat Hrodric.',
    objective: { kind: 'boss', boss: 'king-hrodric', label: 'Defeat King Hrodric in the Barrow of Kings' },
    after: ['the-kings-mound'],
    zone: 'ashen-barrows',
    level: 27,
    reward: { xp: 1600, gold: 300, item: { rarity: 'rare' } },
  },
  {
    id: 'sir-corvane',
    name: 'Sir Corvane the Fallen',
    auto: true,
    giver: 'sister-maud',
    text: 'Sir Corvane waits at the bottom of the Barrow of Kings, past Hrodric’s hall. He once commanded the Ninefold Watch and taught Cael to fight. Now he is the Ashen Host’s first knight. Defeat him.',
    objective: { kind: 'boss', boss: 'sir-corvane', label: 'Defeat Sir Corvane in the Barrow of Kings' },
    after: ['the-barrow-king'],
    zone: 'ashen-barrows',
    level: 28,
    reward: {
      xp: 3300,
      gold: 900,
      item: 'corvanes-broken-sigil',
      unlock: 'emberwick',
      text: 'Corvane dies asking Cael to forgive him. He gives Cael a paper he kept for ten years: the order that called off the Watch’s relief, signed by Lord Chancellor Maelis Crane. Cael hands you Corvane’s broken Watch badge. The King’s Road west to the Crown City is safe now.',
    },
  },
  /* ------------------------------------------------------ Kell's graves */
  {
    id: 'houndsmound',
    name: 'Dug Up',
    giver: 'gravedigger-kell',
    text: 'Kell digs Lantern Hill’s graves. Every night something digs them up again. The tracks lead south-east, past the Ninefold Barrows, to Houndsmound, where the old kings buried their hounds. Go and see if the hounds are still in their graves.',
    objective: { kind: 'explore', spot: 'houndsmound', label: 'Follow the tracks to Houndsmound' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 700, gold: 210 },
  },
  {
    id: 'hounds-of-the-barrow',
    name: 'Hounds of the Barrow',
    giver: 'gravedigger-kell',
    text: 'The old kings’ hounds are out of Houndsmound and roaming the downs, and they keep digging in Kell’s graveyard. Put down ten of them, so Kell can fill in his graves for good.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 10, enemies: ['barrow-hound'], label: 'Put down barrow hounds' },
    after: ['houndsmound'],
    zone: 'ashen-barrows',
    reward: { xp: 800, gold: 220 },
  },
  {
    id: 'hunt-headless-lord',
    name: 'The Headless Lord',
    giver: 'gravedigger-kell',
    text: 'The hounds were digging for their master, the Headless Lord. He rides around the Ninefold Barrows every night, looking for his head. Kell found the lord’s helm years ago and kept it. Defeat the Headless Lord, and Kell will give you the helm.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 1, enemies: ['the-headless-lord'], label: 'Defeat the Headless Lord at the Ninefold Barrows' },
    after: ['hounds-of-the-barrow'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 1550, gold: 260, item: 'headless-lords-helm', text: 'Kell gives you the Headless Lord’s helm, washed clean.' },
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
          'Maren sent you? Good. Stay in the light while you’re here.',
          'For three hundred years, these lamps kept the barrow dead in their mounds. Now they aren’t enough.',
          'The dead come out every night and put out another lamp.',
          'Four nights ago the whole King’s Road was dark. Riders went north through it without stopping.',
        ],
      },
      {
        when: { quest: 'the-barrow-king', state: 'active' },
        lines: ['King Hrodric was the first king buried on the downs. My grandmother told stories about him to scare me.', 'Now he’s awake. Be careful down there.'],
      },
      {
        when: { quest: 'sir-corvane', state: 'active' },
        lines: ['Corvane was a hero once. He held the Ninefold Watch for a night and a day after the help failed to come.', 'My lamps can’t reach the bottom of that barrow. You’ll have to finish this.'],
      },
      { when: { quest: 'orren-the-last-chapel', state: 'active' }, lines: ['Brother Orren keeps the chapel at the top of the hill. His lamp is the only one that has never gone out.', 'He knows something about the dead that he won’t tell me. Maybe he’ll tell you.'] },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['The downs are quiet now. The dead are back in their mounds.', 'Cael is going to the city with you. Look after him. He’s been alone a long time.'] },
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
      {
        when: { quest: 'cael-the-hostel', state: 'active' },
        lines: ['Cael Varrow was a captain of the Ninefold Watch. People say he ran away when the Watch fell. He didn’t.', 'Corvane sent him for help, and no help came. He drinks here now and calls himself Wat. Be gentle with him.'],
      },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound is at the far western end of the downs. Corvane went in ten years ago and never came out.', 'Be careful. Whatever he found in there changed him.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['Corvane was a good knight once, and Cael’s teacher. Something down there made him break his oath.', 'End it, for his sake as much as ours.'] },
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
      {
        when: { quest: 'houndsmound', state: 'active' },
        lines: ['Every morning I fill in a grave. Every night something digs it up again.', 'The tracks go south-east, past the Ninefold Barrows, to Houndsmound.', 'The old kings buried their hounds there. Go and see if they’re still buried.'],
      },
      { when: { quest: 'hounds-of-the-barrow', state: 'active' }, lines: ['They’re out, aren’t they? I can see it on your face.', 'Put down ten of them, and I can finally fill my graves for good.'] },
      {
        when: { quest: 'hunt-headless-lord', state: 'active' },
        lines: ['The hounds were digging for their master, the Headless Lord. He rides the Ninefold Barrows at night, looking for his head.', 'I’ve kept his old helm in my shed for years. Put him to rest, and it’s yours.'],
      },
      { when: { quest: 'hunt-headless-lord', state: 'done' }, lines: ['The helm suits you. Wear it well.'] },
      { lines: ['I sell grave goods: weapons and armor buried with the old dead.', 'Their owners don’t need them anymore.'] },
    ],
  },
  // the companions of Lantern Hill (STORY_BIBLE.md §3)
  'brother-orren': {
    id: 'brother-orren',
    name: 'Brother Orren',
    title: 'Last of the royal chaplains',
    sprite: 'elder',
    talk: [
      {
        when: { quest: 'orren-the-last-chapel', state: 'active' },
        lines: [
          'Three hundred years ago, King Vaelor of Vaelmoor lost his wife and children to plague.',
          'He broke his crown to bring them back. It worked for one night. Then the crown turned to ash.',
          'The Ash Crown feeds on grief and raises the dead as soldiers. That army is the Ashen Host.',
          'The Sigil-wardens locked Vaelor in his citadel in the far north, behind a gate with seven locks.',
          'The seven sigils open it. If the Host gathers all seven, Vaelor walks free and marches on Aster.',
          'His servant, the Pale Herald, gathers the sigils for him and pays traitors in ash-gold.',
        ],
      },
      { when: { quest: 'the-last-lamp', state: 'active' }, lines: ['Stand by the great lamp at the top of the hill, where I can see you.', 'Some of the dead will call out names. Don’t answer them. Just keep them off the lamp.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['When Corvane falls, I’ll say the prayers for the dead over him.', 'Wherever you go after that, I’m coming with you.'] },
      { lines: ['My order buried Aster’s kings for six hundred years. We believe the dead must stay dead.', 'The Ash Crown breaks that rule. I’ll help you stop it.'] },
    ],
  },
  'cael-varrow': {
    id: 'cael-varrow',
    name: 'Cael Varrow',
    title: 'Calls himself Wat',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'cael-the-hostel', state: 'active' },
        lines: [
          'All right. I’m Cael Varrow. I was a captain of the Ninefold Watch, the knights who guarded these downs.',
          'Ten years ago the dead came out of the barrows and attacked us. We held for nine days, waiting for help.',
          'Corvane, our commander, sent me to hurry the relief. I found the road empty. Nobody was coming.',
          'When I got back, the Watch was dead and Corvane was gone. Everyone says I ran away.',
          'If Corvane leads the dead now, I need to know why. I’m coming with you.',
        ],
      },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound. That’s where Corvane went after the Watch fell. I always knew, and I never went to look.', 'I’m coming with you. I know how he fights.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['Corvane taught me to fight in a shield line. If he’s down there, he’ll fight the same way.', 'Let me speak to him before the fight, if there’s anything of him left.'] },
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
      { who: 'orren', text: 'It’s lit. Now it has to burn until dawn, and the dead will try to put it out.' },
      { who: 'orren', text: 'Here they come, from the north and the west. Keep them off the lamp!' },
    ],
    waves: [
      { enemies: ['corpse-candle', 'corpse-candle', 'barrow-wight', 'barrow-wight'], from: ['lantern-n', 'lantern-w'] },
      { enemies: ['banshee', 'wight-archer', 'barrow-wight', 'corpse-candle'], from: ['lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'That banshee is calling out names. Don’t listen. Cut it down!' }] },
      { enemies: ['wight-knight', 'barrow-wight', 'barrow-wight', 'wight-archer', 'banshee'], from: ['lantern-w', 'lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'The other lamps are lighting! Hold them a little longer!' }] },
    ],
    end: [{ who: 'orren', text: 'Look down the hill. Every lamp on the downs is lit again. The dead will stay in their mounds tonight.' }],
    retry: [{ who: 'orren', text: 'They put it out. Light it again. We start over.' }],
  },
};
