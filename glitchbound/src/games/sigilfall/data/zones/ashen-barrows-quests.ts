import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Lantern Hill's people and the Ashen Barrows' quests (Act II, STORY_BIBLE.md §3, "Lantern Hill" and "The
 * first knight"). The dead won't cross the light of a warden's lamp, and Lantern Hill has kept its lamps
 * lit for three hundred years; now they go out one a night and a cold gloom lies over the downs, and the
 * barrow dead are rising in ranks, armed with Ironpeak's stolen bone-steel, under the black rose of Sir
 * Corvane, the Sigil-warden who became the Ashen Host's first knight. Two companions are met here: Brother
 * Orren, last of the old royal chaplains, who keeps the last lit chapel; and Cael Varrow, the disgraced
 * captain of the Ninefold Watch, drinking in the hostel under a false name. Orren's vigil relights the great
 * lamp and the gloom lifts. At the bottom of the Barrow of Kings, Corvane dies asking Cael's forgiveness
 * and gives him the proof: the Watch's relief order, countermanded in the Chancellor's hand. Kell and
 * Sister Maud have their own dead to lay. Main chain first.
 */
export const ASHEN_BARROWS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-lanterns-dim',
    name: 'The Lanterns Dim',
    giver: 'thane-borrik',
    text: 'Kragholt’s lookouts on the west pass say the lamps on Lantern Hill are going out, one a night, and that the Host’s carts of bone-steel are rolling west toward the barrows. Thane Borrik wants to know who is buying his forge. Take the west pass into the Ashen Barrows and find Lamplighter Ivo on Lantern Hill.',
    objective: { kind: 'talk', npc: 'lamplighter-ivo', label: 'Talk to Lamplighter Ivo on Lantern Hill' },
    after: ['the-dwarves-plea'],
    level: 23,
    reward: { xp: 650, gold: 200 },
  },  {
    id: 'orren-the-last-chapel',
    name: 'The Last Chapel',
    giver: 'lamplighter-ivo',
    text: 'One lamp on the downs has not gone out once: Brother Orren’s, in the chapel at the top of Lantern Hill. Orren is the last of the old royal chaplains, the death-priests of the Lantern order. Ivo says Orren knows what is putting the lamps out, and won’t tell a lamplighter. Go and ask him.',
    objective: { kind: 'talk', npc: 'brother-orren', label: 'Talk to Brother Orren at the top of Lantern Hill' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 23,
    reward: { xp: 500, gold: 150, text: 'Orren lets you in, and gives you tea, and tells you about the Ash Crown as though you were a child he is fond of and expects to lose.' },
  },

  /* ----------------------------------------------------- the black rose */
  {
    id: 'candle-thieves',
    name: 'Candle Thieves',
    giver: 'lamplighter-ivo',
    text: 'Lantern Hill’s lamps burn wardens’ oil, and the dead won’t cross their light. Something is stealing the flames: corpse-candles, the cold lights of Candle Fen east of the hill, that drift in at night and drink them. Ivo wants his flames back. Catch them, and don’t follow them anywhere.',
    objective: { kind: 'loot', region: 'ashen-barrows', item: 'Stolen Flame', from: ['corpse-candle'], chance: 0.5, count: 5, label: 'Take back Stolen Flames from corpse-candles' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    reward: { xp: 700, gold: 200 },
  },  {
    id: 'the-last-lamp',
    name: 'The Vigil',
    giver: 'brother-orren',
    text: 'The lamps go out because the dead lean on them: a lamp holds the dead back by burning against their grief, and there is more grief on the downs every night. The great lamp at the top of the hill holds all the others. Orren will relight it with the flames you took back and keep the vigil till it takes. The dead will come to put it out. They must not.',
    objective: { kind: 'event', event: 'lantern-vigil', label: 'Keep the dead off the great lamp through Orren’s vigil' },
    after: ['candle-thieves', 'orren-the-last-chapel'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 1100, gold: 260, text: 'The great lamp takes, and one by one, down every road on the downs, the others come back. The gloom lifts like a lid.' },
  },

  {
    id: 'the-risen-ranks',
    name: 'The Risen Ranks',
    giver: 'lamplighter-ivo',
    text: 'With the lamps lit again Ivo can see the downs, and wishes he couldn’t: the barrow dead are climbing out of the Ninefold Barrows, south-east of the hill, in ranks, armed and in step. Somebody is drilling them. Break the ranks before they learn to march.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 12, enemies: ['barrow-wight', 'wight-archer', 'wight-knight'], label: 'Defeat the barrow dead' },
    after: ['candle-thieves'],
    zone: 'ashen-barrows',
    reward: { xp: 750, gold: 210 },
  },
  {
    id: 'bone-steel-blades',
    name: 'New Swords for Old Bones',
    giver: 'lamplighter-ivo',
    text: 'The wight knights marching out of the Ninefold Barrows and across the downs carry new blades among their rotten bronze, pale and faintly violet. Ivo has heard about Kragholt’s forge. Bring him four of the blades so he can send word to the thane: his steel has found its buyer.',
    objective: { kind: 'loot', region: 'ashen-barrows', item: 'Bone-Steel Blade', from: ['wight-knight'], chance: 0.5, count: 4, label: 'Take Bone-Steel Blades from wight knights' },
    after: ['the-risen-ranks'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 800, gold: 220 },
  },
  {
    id: 'the-broken-chapel',
    name: 'The Broken Chapel',
    giver: 'lamplighter-ivo',
    text: 'The dead march under a banner: a black rose over a broken sigil. Sister Maud swears she has seen it in the rolls her order kept at the Broken Chapel, south-west of the hill, before the dead drove the sisters out. Find what is left of the rolls.',
    objective: { kind: 'explore', spot: 'broken-chapel', label: 'Search the Broken Chapel for its rolls' },
    after: ['bone-steel-blades'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 800, gold: 220 },
  },
  {
    id: 'the-fallen-knight',
    name: 'The Fallen Knight',
    giver: 'lamplighter-ivo',
    text: 'The rolls are half burned, but the black rose is on every page that’s left: the arms of Sir Corvane, the greatest of the Sigil-wardens who broke the Starlight Crown and sealed the Hallow King in the Duskspire. Bring the rolls to Sister Maud at the Wardens’ Rest. She will want to sit down.',
    objective: { kind: 'talk', npc: 'sister-maud', label: 'Bring the rolls to Sister Maud' },
    after: ['the-broken-chapel'],
    zone: 'ashen-barrows',
    reward: { xp: 700, gold: 220 },
  },  {
    id: 'cael-the-hostel',
    name: 'A Man Called Wat',
    giver: 'sister-maud',
    text: 'The Ninefold Watch’s captain under Corvane was Cael Varrow, the knight the kingdom blames for the Watch’s fall. He has been drinking in the hostel at the foot of Lantern Hill for a year under the name of Wat. Sister Maud says he should see the rolls. She says it like she has wanted to for a long time.',
    objective: { kind: 'talk', npc: 'cael-varrow', label: 'Bring the rolls to “Wat” at the hostel' },
    after: ['the-fallen-knight'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 800, gold: 200, text: 'Cael reads the rolls twice, puts down his cup, and goes to find his sword. He hasn’t sold it. He says he meant to, every morning, for a year.' },
  },

  {
    id: 'the-kings-mound',
    name: 'The Kings’ Mound',
    giver: 'sister-maud',
    text: 'The last line in the rolls about Sir Corvane says where he was seen last: riding alone into the Kings’ Mound, at the far western end of the downs, the winter after the old war. Whatever walks the downs under his rose came out of there. Go and look at the mound.',
    objective: { kind: 'explore', spot: 'kings-mound', label: 'Find the Kings’ Mound' },
    after: ['cael-the-hostel'],
    zone: 'ashen-barrows',
    level: 26,
    reward: { xp: 900, gold: 240 },
  },
  {
    id: 'the-barrow-king',
    name: 'The Barrow King',
    giver: 'lamplighter-ivo',
    text: 'The Kings’ Mound stands open. The first and greatest of the barrow kings, Hrodric, has woken and taken back his crown, and Corvane’s dead kneel to him in his hall. Go down into the Barrow of Kings and put the old king back in his grave.',
    objective: { kind: 'boss', boss: 'king-hrodric', label: 'Defeat King Hrodric in the Barrow of Kings' },
    after: ['the-kings-mound'],
    zone: 'ashen-barrows',
    level: 27,
    reward: { xp: 1600, gold: 300, item: { rarity: 'rare' } },
  },
  {
    id: 'sir-corvane',
    name: 'Sir Corvane the Fallen',
    giver: 'sister-maud',
    text: 'Below Hrodric’s hall, at the bottom of the barrow, Sir Corvane waits: the Ashen Host’s first knight, who taught Cael Varrow to hold a line, and who held the Ninefold Watch for a night and a day before it fell. Lantern Hill’s lamps can’t reach that far down. You will have to.',
    objective: { kind: 'boss', boss: 'sir-corvane', label: 'Defeat Sir Corvane the Fallen' },
    after: ['the-barrow-king'],
    zone: 'ashen-barrows',
    level: 28,
    reward: {
      xp: 3300,
      gold: 900,
      item: 'corvanes-broken-sigil',
      unlock: 'emberwick',
      text: 'Corvane falls asking Cael’s forgiveness, and gives him a paper: the Ninefold Watch’s relief order, countermanded by the Lord Chancellor himself. The King’s Road to the Crown City is open.',
    },
  },
  /* ------------------------------------------------------ Kell's graves */
  {
    id: 'houndsmound',
    name: 'Dug Up',
    giver: 'gravedigger-kell',
    text: 'Kell digs Lantern Hill’s graves, and lately he fills them in again every morning: something digs them up at night. The tracks lead south, past the Ninefold Barrows, to Houndsmound, where the barrow kings buried their hounds. Kell would like to know if they are still buried.',
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
    text: 'They are not still buried. The barrow kings’ hounds are out of Houndsmound and all over the downs, digging, and Kell’s graveyard is their favourite. Put down ten of them, and Kell will fill in his graves one last time.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 10, enemies: ['barrow-hound'], label: 'Put down barrow hounds' },
    after: ['houndsmound'],
    zone: 'ashen-barrows',
    reward: { xp: 800, gold: 220 },
  },
  {
    id: 'hunt-headless-lord',
    name: 'The Headless Lord',
    giver: 'gravedigger-kell',
    text: 'The hounds were digging for their master: the Headless Lord, who rides the Ninefold Barrows every night looking for his head. Kell knows where his helm is. It is in Kell’s shed, with something in it. Put the lord down for good and Kell will give you the helm. Empty.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 1, enemies: ['the-headless-lord'], label: 'Defeat the Headless Lord at the Ninefold Barrows' },
    after: ['hounds-of-the-barrow'],
    zone: 'ashen-barrows',
    level: 25,
    reward: { xp: 1550, gold: 260, item: 'headless-lords-helm', text: 'Kell gives you the helm. He has washed it. Twice.' },
  },
  /* ----------------------------------------------------- Maud's sisters */
  {
    id: 'sisters-of-the-lamp',
    name: 'Sisters of the Lamp',
    giver: 'sister-maud',
    text: 'The banshees wailing over the downs wear the habits of Sister Maud’s order. They were her sisters, buried under the Broken Chapel, and something has woken them. She asks you to quiet six of them. She asks it calmly. Her hands aren’t calm.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 6, enemies: ['banshee'], label: 'Quiet the banshees' },
    after: ['the-lanterns-dim'],
    zone: 'ashen-barrows',
    level: 24,
    reward: { xp: 750, gold: 210 },
  },
  {
    id: 'the-sisters-beads',
    name: 'Forty Beads',
    giver: 'sister-maud',
    text: 'Every sister was buried with her beads, and the banshees still carry them, at the Broken Chapel south-west of the hill and wherever they wail on the downs. Maud wants them back, so she can bury her sisters again with their prayers, the way it should have been done.',
    objective: { kind: 'loot', region: 'ashen-barrows', item: 'Warden’s Beads', from: ['banshee'], chance: 0.5, count: 5, label: 'Recover Warden’s Beads from banshees' },
    after: ['sisters-of-the-lamp'],
    zone: 'ashen-barrows',
    reward: { xp: 850, gold: 230 },
  },
  {
    id: 'hunt-mother-aldith',
    name: 'Mother Aldith',
    giver: 'sister-maud',
    text: 'One voice is louder than the rest: Mother Aldith, the chapel’s abbess, who taught Maud her prayers. She haunts the Broken Chapel, south-west of the hill, and lights its candles for the dead. Maud can’t do it. She asks you to.',
    objective: { kind: 'kill', region: 'ashen-barrows', count: 1, enemies: ['mother-aldith'], label: 'Lay Mother Aldith to rest at the Broken Chapel' },
    after: ['the-sisters-beads'],
    zone: 'ashen-barrows',
    level: 26,
    reward: { xp: 1550, gold: 260, item: 'aldiths-rosary', text: 'Maud strings the abbess’s beads on a cord for you.' },
  },
];

export const ASHEN_BARROWS_NPCS: Record<string, NpcDef> = {
  'lamplighter-ivo': {
    id: 'lamplighter-ivo',
    name: 'Lamplighter Ivo',
    title: 'Lamplighter of Lantern Hill',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-howling-moors', state: 'active' },
        lines: ['Something howls on the moors north of the downs. Every night now, and closer.', 'Grimward’s huntmaster, Orla, will know what. Take the north road past the last of the barrows, and keep a lamp lit.'],
      },
      {
        when: { quest: 'the-lanterns-dim', state: 'active' },
        lines: ['Kragholt sent you? Good. Stand in the light. Always stand in the light, here.', 'The dead won’t cross a warden’s lamp. That’s why Lantern Hill is still standing. And the lamps are going out, one a night.'],
      },
      {
        when: { quest: 'candle-thieves', state: 'active' },
        lines: ['Corpse-candles. Little cold lights out of Candle Fen, east of the hill. They drift in at night and drink my flames.', 'Catch five and bring the flames back. Don’t let them lead you anywhere. That’s what they’re for.'],
      },
      {
        when: { quest: 'the-risen-ranks', state: 'active' },
        lines: ['With the lamps lit I can see the Ninefold Barrows, south-east of the hill. The dead are climbing out in ranks. In step.', 'The barrow dead never marched in step. Somebody is drilling them.'],
      },
      { when: { quest: 'bone-steel-blades', state: 'active' }, lines: ['The knights carry new swords. Pale steel, with a violet sheen. Four of those, please.', 'The thane will want to know where his forge’s work went. I’d rather he heard it from me than from them.'] },
      { when: { quest: 'the-broken-chapel', state: 'active' }, lines: ['A black rose over a broken sigil. Maud has seen it before, in the chapel rolls.', 'The Broken Chapel is south-west of the hill. Mind the sisters. They aren’t sisters any more.'] },
      { when: { quest: 'the-fallen-knight', state: 'active' }, lines: ['Take the rolls to Maud at the Wardens’ Rest. Put the kettle on first.'] },
      {
        when: { quest: 'the-barrow-king', state: 'active' },
        lines: ['King Hrodric. The first of the barrow kings. My grandmother used to frighten me with him.', 'Turns out she was being kind.'],
      },
      {
        when: { quest: 'sir-corvane', state: 'active' },
        lines: ['Corvane. A Sigil-warden, a hero. They say he held the Ninefold Watch for a night and a day, waiting for a relief that never came.', 'Whatever he is now, my lamps can’t reach him. You’ll have to.'],
      },
      { when: { quest: 'orren-the-last-chapel', state: 'active' }, lines: ['Brother Orren keeps the chapel at the top of the hill. His lamp hasn’t gone out once. He says he knows why the others do.', 'He won’t tell a lamplighter. Says I’d try to fix it with oil.'] },
      { when: { quest: 'the-last-lamp', state: 'done' }, lines: ['Look at that. Every lamp on the downs, and the great one at the top. I sat down in the road and cried. Kell sat with me. He says he didn’t cry. He did.'] },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['The downs are dark again. Only the ordinary kind of dark. I’ve never been so glad of it.', 'Cael’s gone with you to the city, then. Make him eat something. And take a lamp.'] },
      { lines: ['Every lamp on the hill: lit at dusk, trimmed at midnight, out at dawn. Forty years and I’ve never missed one.', 'Mind the corpse-candles if you go out. They look like lamps. Lamps don’t follow you home.'] },
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
        when: { quest: 'the-fallen-knight', state: 'active' },
        lines: ['The chapel rolls. You found them. Let me sit down.', 'The black rose is Sir Corvane’s. He was the greatest of us. Ten years ago he commanded the Ninefold Watch, the fort on the northern border, and when the relief didn’t come it fell, and he rode into the Kings’ Mound alone. The rolls say lost. I’d say taken.'],
      },
      {
        when: { quest: 'cael-the-hostel', state: 'active' },
        lines: ['The Watch had a captain under Corvane. Cael Varrow. The kingdom says he ran. He didn’t. He was sent for help, and came back to find it all over.', 'He drinks in the hostel at the foot of the hill and calls himself Wat. Take him the rolls. Be kind. Not too kind; he’ll hate it.'],
      },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound, at the far western end of the downs. Three hundred years he’s been in there. Whatever he went to find, he found it.', 'Go carefully. Kings don’t like visitors, and the dead ones like them least.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['He was a Sigil-warden. He kept the oath I keep. Whatever made him break it, it’s down there with him.', 'End it. For him as much as for us.'] },
      {
        when: { quest: 'sisters-of-the-lamp', state: 'active' },
        lines: ['They wear our habits. They were my sisters once. We buried them under the chapel, and something has woken them.', 'Quiet six of them. Please. They never liked noise.'],
      },
      { when: { quest: 'the-sisters-beads', state: 'active' }, lines: ['Each sister was buried with her beads. I want them back, so I can bury the sisters again, with their prayers this time.', 'Forty beads to a string. I’ll count them. It helps.'] },
      {
        when: { quest: 'hunt-mother-aldith', state: 'active' },
        lines: ['Mother Aldith taught me my prayers, how to set a bone, and how to throw a drunk out of the chapel.', 'She haunts the Broken Chapel and lights its candles for the dead. I can’t. You’ll have to.'],
      },
      { when: { quest: 'hunt-mother-aldith', state: 'done' }, lines: ['Wear her beads. She’d have liked you. She’d have told you to stand up straight.'] },
      { lines: ['The Wardens’ Rest. Potions, a bed and a prayer, in whatever order you need them.', 'I’m the last sister of the chapel, and I run an inn. The Sigil-wardens were always practical.'] },
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
        lines: ['Every morning I fill in a grave. Every night something digs it out again. The tracks go south, past the Ninefold Barrows, to Houndsmound.', 'The kings buried their hounds there. I’d like to know they’re still buried.'],
      },
      { when: { quest: 'hounds-of-the-barrow', state: 'active' }, lines: ['They’re not still buried, are they. No. I can tell from your face.', 'Ten of them. Then I fill my graves one last time and have a lie-down in one.'] },
      {
        when: { quest: 'hunt-headless-lord', state: 'active' },
        lines: ['The hounds were looking for their master: the Headless Lord. He rides the Ninefold Barrows every night, looking for his head.', 'I know where his helm is. It’s in my shed. Don’t ask what’s in it. Put him down and it’s yours. Empty.'],
      },
      { when: { quest: 'hunt-headless-lord', state: 'done' }, lines: ['Fits you better than it fit him. Mind, that isn’t hard.'] },
      { lines: ['Grave goods. Found, not stolen. The previous owners aren’t using them.', 'Mostly not using them.'] },
    ],
  },
  // the companions of Lantern Hill (STORY_BIBLE.md §2)
  'brother-orren': {
    id: 'brother-orren',
    name: 'Brother Orren',
    title: 'Last of the royal chaplains',
    sprite: 'elder',
    talk: [
      {
        when: { quest: 'orren-the-last-chapel', state: 'active' },
        lines: [
          'Come in, come in. Mind the step, it’s older than the kingdom. Tea?',
          'The lamps aren’t being put out. They’re being leaned on. There’s a crown in the north that eats grief and makes soldiers of it, and there has been more grief on these downs this year than in the last three hundred.',
          'The dead must stay dead. That isn’t cruelty. It’s the only kindness that lasts.',
        ],
      },
      { when: { quest: 'the-last-lamp', state: 'active' }, lines: ['The great lamp, at the top of the hill. Bring me the flames you took back, and stand where I can see you.', 'They’ll come. They’ll be people you’d have liked. Don’t listen to them.'] },
      { when: { quest: 'sir-corvane', state: 'done' }, lines: ['Corvane asked to be forgiven. That’s more than most of the living manage. I said a prayer over him. Cael wouldn’t stay for it.', 'I’m going with you to the city. Someone should say the old words over whatever happens there.'] },
      { lines: ['The Lantern order buried the kings of Aster for six hundred years. Now there’s me, a chapel, and a great deal of oil.', 'Every lamp is a promise that the dead will be let go. I keep the promises.'] },
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
          'Wat. The name’s Wat. Buy me a drink or leave me be.',
          '…Where did you get those. Give them here.',
          'Nine days we held the Watch. The relief was three days out. I rode to hurry it and found the road empty. Nobody came. Corvane held it a night and a day after I left, and they say I ran.',
          'Corvane’s rose on the downs. Under the Host’s grey. Then I’m done drinking.',
        ],
      },
      { when: { quest: 'the-kings-mound', state: 'active' }, lines: ['The Kings’ Mound. That’s where he went, after. I always knew. I never went to look.', 'I’m coming. I owe him that, and you’ll need someone who knows how he fights.'] },
      { when: { quest: 'sir-corvane', state: 'active' }, lines: ['He taught me to hold a line. Shields together, weight forward, never step back first. If he’s down there, he’ll hold it against us.', 'Let me speak to him. Before. If there’s anything of him left to speak to.'] },
      { lines: ['Drink? No. I’m done with that. Mostly.', 'A knight is a man who stays. I didn’t. I mean to make up for it.'] },
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
      { who: 'orren', text: 'Light it. There. Now we keep the vigil, and they come to end it.' },
      { who: 'orren', text: 'Lord of the long road, let the dead go home and stay there.' },
    ],
    waves: [
      { enemies: ['corpse-candle', 'corpse-candle', 'barrow-wight', 'barrow-wight'], from: ['lantern-n', 'lantern-w'] },
      { enemies: ['banshee', 'wight-archer', 'barrow-wight', 'corpse-candle'], from: ['lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'That one is calling a name. Don’t answer it.' }] },
      { enemies: ['wight-knight', 'barrow-wight', 'barrow-wight', 'wight-archer', 'banshee'], from: ['lantern-w', 'lantern-e', 'lantern-n'], barks: [{ who: 'orren', text: 'It’s taking. It’s taking! Hold them a little longer!' }] },
    ],
    end: [{ who: 'orren', text: 'There. Look down the hill. Every lamp, one after another. The dead will keep to their mounds tonight.' }],
    retry: [{ who: 'orren', text: 'Out. They put it out. Light it again. We are not done.' }],
  },
};
