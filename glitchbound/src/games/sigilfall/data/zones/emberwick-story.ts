import type { EnemyDef, NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The Crown City's part of Act II (STORY_BIBLE.md §4, "Emberwick: the Crown City"). The order Corvane gave Cael,
 * calling off the Ninefold Watch's relief, is in Lord Chancellor Crane's hand; Crane calls it a forgery, and one old
 * paper will not bring down the Regent's oldest counsellor. The trail runs through the treasury (the relief's money,
 * paid out ten years ago), the roads office (which spent it on repairs nobody made, and closed the King's Road to
 * refugees this spring) and down into Crane's own cellar, where his hired knives wait. The ledgers there show ten
 * years of the Pale Herald's ash-gold, and the royal couriers' lost letters are with them. The Regent means to arrest
 * him at dawn, when the Starfall Festival is over; Crane strikes first, and his knives and the Host's assassins go
 * for her in the square. She lives, Crane runs into the catacombs under his house and leaves the wardens' map
 * behind, and the Regent names the hero her champion. Act III opens from her. Written to DIALOGUE_STYLE.md.
 */
export const EMBERWICK_QUESTS: QuestDef[] = [
  /* --------------------------------------------- postgame: the Chancellor in the catacombs */
  {
    id: 'thread-the-chancellor',
    name: 'Under His House',
    giver: 'regent-elowen',
    zone: 'emberwick',
    text: 'The war is over, and Maelis Crane is still hiding somewhere under the city. The Regent has opened the stair under his house and the barred door at the bottom. She wants to know what he found down there that was worth betraying Aster. Go down the catacomb stair under his house.',
    objective: { kind: 'boss', boss: 'maelis-crane', label: 'Find Maelis Crane in the catacombs' },
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 9000, gold: 4000, item: { rarity: 'legendary' }, text: 'Crane falls among his ash-gold, and the coins make no sound. “Every one of these was made from someone’s grief,” he says. “I knew that, and I took them anyway.” The Regent has the stair bricked up behind you. That night, for the first time in nine years, she sleeps until morning.' },
  },
  /* ------------------------------------------------------------ the traitor */
  {
    id: 'city-the-treasury',
    name: 'Follow the Money',
    giver: 'regent-elowen',
    text: 'Crane says Corvane’s order is a forgery, and the Regent needs more proof before she can arrest him. Ten years ago the treasury paid for the Ninefold Watch’s relief, but the relief never marched. Ask Clerk Amsel at the Treasury, in the north-east of the city, where the money went.',
    objective: { kind: 'talk', npc: 'clerk-amsel', label: 'Ask Clerk Amsel at the Treasury where the money went' },
    after: ['the-kings-design'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'The relief money was paid out in full. The same week, it was signed over to the roads office, for repairs on the King’s Road that were never made.' },
  },
  {
    id: 'city-the-roads-office',
    name: 'Repairs Nobody Made',
    giver: 'clerk-amsel',
    text: 'The roads office took the relief money and spent it on nothing. It is also the office that closed the King’s Road to refugees this spring. Roadwarden Hesk runs it, in the tavern quarter in the south-west of the city. Ask him for the old ledgers.',
    objective: { kind: 'talk', npc: 'roadwarden-hesk', label: 'Ask Roadwarden Hesk at the Roads Office for the ledgers' },
    after: ['city-the-treasury'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'Hesk is terrified. The Chancellor’s men took the old ledgers from his office the night you brought Corvane’s order to the Regent. They carried them to Crane’s house.' },
  },
  {
    id: 'city-the-cellar',
    name: 'The Chancellor’s Cellar',
    giver: 'roadwarden-hesk',
    text: 'The ledgers are in Crane’s cellar, under his house just west of the main avenue. Crane is at the keep with the Regent tonight. Nyx can open the cellar door, and Cael expects a trap. Get the ledgers out.',
    objective: { kind: 'event', event: 'city-cellar', label: 'Get the ledgers out of the Chancellor’s cellar' },
    after: ['city-the-roads-office'],
    zone: 'emberwick',
    level: 29,
    reward: { xp: 1800, gold: 380, item: { rarity: 'rare' }, text: 'The ledgers show ten years of payments to Crane in ash-gold, the Pale Herald’s coin. Beside them is a sack of royal couriers’ letters that were never delivered. Crane let the Ninefold Watch die, kept the roads open for the Host, and hid every warning.' },
  },
  /* ---------------------------------------------------- the Starfall Festival */
  {
    id: 'festival-the-lanterns',
    name: 'The Starfall Festival',
    giver: 'regent-elowen',
    auto: true,
    text: 'The ledgers are proof enough. The Regent will have Crane arrested at dawn, when the festival is over and the streets are empty. Tonight Emberwick celebrates the Starfall, the night the star fell a thousand years ago, and the whole city is out. Walk the parade on the south avenue and keep your eyes open.',
    objective: { kind: 'explore', spot: 'festival-parade', label: 'Watch the Starfall Parade on the south avenue' },
    after: ['city-the-cellar'],
    zone: 'emberwick',
    level: 29,
    reward: { xp: 700, gold: 160, text: 'There are drums, a paper star on poles, and children on their parents’ shoulders. Then the Regent comes down to the market square to light the star-lantern, and a dozen men in festival masks start pushing toward her.' },
  },
  {
    id: 'festival-the-knives',
    name: 'The Night of Knives',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane has struck first. His hired knives, in festival masks, and the Host’s grey assassins are going for the Regent at the star-lantern in the market square. Nyx and Orren are with you, and Cael is holding the keep stair. Keep the Regent alive.',
    objective: { kind: 'event', event: 'festival-knives', label: 'Keep the Regent alive in the market square' },
    after: ['festival-the-lanterns'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2400, gold: 500, item: { rarity: 'rare' }, text: 'The last attacker falls. The Regent has a cut on her arm, and she is furious. Crane is not at the keep. A guard saw him running to his house.' },
  },
  {
    id: 'festival-the-catacombs',
    name: 'Down Among the Dead',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane ran to his house. Under his cellar is a hidden stair down into the catacombs beneath the old city. Go down and find out where he went.',
    objective: { kind: 'explore', spot: 'crane-catacombs', label: 'Search the stair under Crane’s house' },
    after: ['festival-the-knives'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 800, gold: 200, text: 'Crane is gone behind a door at the bottom, barred from the other side. On his desk at the top of the stair, left in his hurry, is the Sigil-wardens’ map of where they hid the seven sigils. Four of the places are marked in fresh grey ink.' },
  },
  {
    id: 'festival-the-champion',
    name: 'Champion of Aster',
    giver: 'regent-elowen',
    auto: true,
    text: 'The city is locked down and Crane’s house is sealed. The wardens’ map is on the Regent’s table, with four places marked in grey ink where the Host will dig next. Go to the Regent at the Ember Keep.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Talk to Regent Elowen at the Ember Keep' },
    after: ['festival-the-catacombs'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2600, gold: 600, item: { rarity: 'epic' }, text: 'The Regent names you Champion of Aster and gives you the map. The four marked places are the Sun King’s tomb in the Sunscorch, the Thorn Court in the Glimmerwood, the Vault of Rime in Rimeheld, and the Tear in the Shattered Vale. The Sunscorch comes first, down the long road from the city’s west gate.' },
  },
];

export const EMBERWICK_NPCS: Record<string, NpcDef> = {
  'chancellor-crane': {
    id: 'chancellor-crane',
    name: 'Lord Chancellor Crane',
    title: 'Keeper of the treasury and the roads',
    sprite: 'elder',
    talk: [
      { when: { quest: 'city-the-treasury', state: 'active' }, lines: ['You’re going to the treasury? Clerk Amsel is old and forgets things. I wouldn’t trust his books.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['You’ve been asking questions all over the city. Be careful. The streets aren’t safe at night.'] },
      { when: { quest: 'city-the-cellar', state: 'done' }, lines: ['The festival is tonight. Stay close to the Regent. I will be close to her too.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['That order is a forgery. A dead traitor wrote it, and a drunk who ran from his post carried it here.', 'The Regent will see that, in time.'] },
      { lines: ['I am Maelis Crane, Lord Chancellor of Aster. I keep the kingdom’s treasury and its roads.', 'The Regent is tired. If you have bad news, bring it to me first.'] },
    ],
  },
  'clerk-amsel': {
    id: 'clerk-amsel',
    name: 'Clerk Amsel',
    title: 'Keeper of the treasury ledgers',
    sprite: 'elder',
    talk: [
      {
        when: { quest: 'city-the-treasury', state: 'active' },
        lines: [
          'Here it is. The relief for the Ninefold Watch, ten years ago, in the spring. It was paid in full.',
          'That same week, the money was signed over to the roads office, for repairs on the King’s Road.',
          'I walked the King’s Road that summer. Nothing had been repaired.',
          'I thought it was strange, and I never said anything. I’m sorry.',
        ],
      },
      { when: { quest: 'city-the-roads-office', state: 'active' }, lines: ['Roadwarden Hesk runs the roads office, in the tavern quarter. Be gentle with him. He signs whatever he’s given.'] },
      { lines: ['I keep the treasury ledgers, forty years of them. Every coin the Crown spends is written down here.'] },
    ],
  },
  'roadwarden-hesk': {
    id: 'roadwarden-hesk',
    name: 'Roadwarden Hesk',
    title: 'Keeper of the roads office',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'city-the-roads-office', state: 'active' },
        lines: [
          'The old ledgers are gone. The Chancellor’s men came for them the night you brought that order to the Regent.',
          'They carried ten years of books out in a handcart, to his house. They’re in his cellar.',
          'Please don’t tell him I told you.',
        ],
      },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['Crane’s house is the tall one west of the main avenue, below the keep. His men use the cellar at night.', 'I never looked. I didn’t want to know.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['I’ve opened the King’s Road to the refugees again. I wrote the order myself this time.'] },
      { lines: ['This is the roads office. Tolls, repairs and travel permits.', 'The King’s Road is closed to refugees, by order of the Lord Chancellor.'] },
    ],
  },
};

/** The Chancellor's cellar, and the Night of Knives in the festival square. */
export const EMBERWICK_EVENTS: Record<string, StoryEventDef> = {
  'city-cellar': {
    id: 'city-cellar',
    region: 'emberwick',
    kind: 'raid',
    at: 'crane-door',
    radius: 6,
    level: 29,
    allies: ['cael', 'nyx'],
    banner: 'Ambush!',
    start: [
      { who: 'nyx', text: 'The lock’s open. That was too easy.' },
      { who: 'cael', text: 'Get behind me! They were waiting for us!' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife'], from: ['crane-door', 'crane-s'] },
      { enemies: ['hired-knife', 'hired-knife', 'ashen-assassin'], from: ['crane-w', 'crane-e'], barks: [{ who: 'cael', text: 'That grey one is from the Host! It doesn’t bleed. Watch your back!' }] },
    ],
    end: [{ who: 'nyx', text: 'Here are the ledgers. And this chest is full of ash-gold. Crane has been taking the Host’s money for years.' }],
    retry: [{ who: 'cael', text: 'Get up. The ledgers are still down there.' }],
  },
  'festival-knives': {
    id: 'festival-knives',
    region: 'emberwick',
    kind: 'defend',
    at: 'ember-dais',
    radius: 12,
    level: 30,
    allies: ['nyx', 'orren'],
    ward: { pet: 'regent', at: 'ember-dais', name: 'Regent Elowen' },
    banner: 'Assassins!',
    start: [
      { who: 'orren', text: 'Those masked men are all heading for the Regent!' },
      { who: 'nyx', text: 'Those are Gallows Gang boots. Crane hired what’s left of the gang!' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife', 'bandit-archer'], from: ['ember-w', 'ember-e'] },
      { enemies: ['ashen-assassin', 'hired-knife', 'hired-knife', 'ashen-assassin'], from: ['ember-n', 'ember-s'], barks: [{ who: 'orren', text: 'The grey ones are the Host’s assassins! They vanish when you close in. Watch your back!' }] },
      { enemies: ['ashen-assassin', 'ashen-assassin', 'hired-knife', 'hired-knife', 'bandit-archer', 'hired-knife'], from: ['ember-w', 'ember-e', 'ember-n'], barks: [{ who: 'nyx', text: 'That’s the last of them! Keep her behind you!' }] },
    ],
    end: [{ who: 'orren', text: 'She’s alive. But where is Crane?' }],
    retry: [{ who: 'orren', text: 'They reached her. Get up! Again, and keep them off her this time!' }],
  },
};

/** Crane's hired knives and the Host's assassins at the festival. */
export const EMBERWICK_FOES: Record<string, EnemyDef> = {
  'hired-knife': {
    id: 'hired-knife',
    name: 'Hired Knife',
    sprite: 'cutthroat',
    pal: { r: '#3a3a4a', R: '#24242e' },
    ai: 'melee',
    hp: 46,
    dmg: 12,
    speed: 74,
    radius: 6,
    mass: 1,
    xp: 12,
    gold: [6, 12],
    aggro: 160,
    reach: 16,
    windup: 0.28,
    recover: 0.36,
    attackCd: 0.9,
    flank: true,
    blurb: 'A city cutthroat in a festival mask, paid in grey coin by the Lord Chancellor. Quick, and he comes at you from the side.',
  },
  'ashen-assassin': {
    id: 'ashen-assassin',
    name: 'Ashen Assassin',
    sprite: 'rift-stalker',
    ai: 'melee',
    hp: 60,
    dmg: 16,
    speed: 82,
    radius: 6,
    mass: 1,
    xp: 18,
    gold: [8, 14],
    aggro: 180,
    reach: 18,
    windup: 0.34,
    recover: 0.4,
    attackCd: 1,
    flank: true,
    blink: 70,
    blurb: 'A grey shape that moves like smoke, sent by the Pale Herald. It slips away when you close on it, and it does not bleed.',
  },
};
