import type { EnemyDef, NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The Crown City's part of Act II (STORY_BIBLE.md §4, "Emberwick: the Crown City"). The order Corvane gave Cael,
 * calling off the Ninefold Watch's relief, is in Lord Chancellor Crane's hand; Crane calls it a forgery, and one old
 * paper will not bring down the Regent's oldest counsellor. The trail runs through the treasury (the relief's money,
 * paid out ten years ago), the roads office (which spent it on repairs nobody made, and closed the King's Road to
 * refugees this spring) and down into Crane's own cellar, where his hired knives wait. The ledgers there show ten
 * years of the Pale Herald's ash-gold, and the royal couriers' lost letters are with them (Oskar Fell's among them:
 * the Prologue's courier); Hesk carries it all to the keep. The Regent means to arrest him at dawn, when the Starfall
 * Festival is over; Crane strikes first, and his knives and the Host's assassins go for her in the square. She lives,
 * Crane runs into the catacombs under his house and leaves the wardens' map behind (four places ringed in his grey
 * ink, two crossed out, the seventh burned off its corner), and the Regent names the hero her champion. Act III opens
 * from her. Written to DIALOGUE_STYLE.md.
 */
export const EMBERWICK_QUESTS: QuestDef[] = [
  /* --------------------------------------------- postgame: the Chancellor in the catacombs */
  {
    id: 'thread-the-chancellor',
    name: 'Under His House',
    giver: 'regent-elowen',
    zone: 'emberwick',
    text: 'The war is over, and Maelis Crane is still hiding somewhere under the city. The Regent has opened the stair under his house and the barred door at the bottom. She wants to know what he found down there that was worth betraying Aster. Go down the stair, find Crane, and end it.',
    // (the stair was opened for the hero. His sealed house is gone through first, and says he has been back)
    objective: {
      kind: 'use', region: 'emberwick', at: 'crane-door', count: 3, thing: 'crate', verb: 'Search', label: 'Search the Chancellor’s sealed house', secs: 1.1, spread: 5,
      notes: ['Ledgers, burnt in the grate. Not all of them.', 'A second set of seals. The Regent’s, forged.', 'The stair. It has been used since the house was sealed.'],
    },
    then: [{ kind: 'boss', boss: 'maelis-crane', label: 'Find Maelis Crane under his house' }],
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 9000, gold: 4000, item: { rarity: 'legendary' }, text: 'Crane falls among his ash-gold, and the coins make no sound. “Every one of these was made from someone’s grief,” he says. “I knew that, and I took them anyway.” The Regent has the stair bricked up behind you. That night, for the first time since the Night of Knives, she sleeps until morning.' },
  },
  /* ------------------------------------------------------------ the traitor */
  {
    id: 'city-the-treasury',
    name: 'Follow the Money',
    giver: 'regent-elowen',
    text: 'Crane calls Corvane’s order a forgery, and the Regent needs proof before she can arrest him. Ten years ago her treasury paid for the Watch’s relief, and the relief never marched. Clerk Amsel keeps the treasury ledgers at the Treasury, in the north-east of the city, east of the Sigil-wardens’ temple. Ask him where the money went.',
    offer: [
      'Maelis says the order is forged, and half my council will believe him. He has kept Aster’s books for thirty years.',
      'Ten years ago my treasury paid for the Watch’s relief. That money went somewhere.',
      'Clerk Amsel keeps the treasury ledgers, in the north-east of the city. Ask him quietly where it went.',
    ],
    // (it was one talk. The proof is in the ledgers, and the hero goes through them with him, entry by entry)
    objective: {
      kind: 'use', region: 'emberwick', at: 'clerk-amsel', count: 3, thing: 'books', verb: 'Read the ledger', label: 'Go through the treasury ledgers with Clerk Amsel', secs: 1.2, spread: 4,
      notes: ['Ten years back: four thousand crowns, “relief”.', 'Paid out the same week. Not to any captain.', '“To the Roads Office. By the Chancellor’s seal.”'],
    },
    then: [{ kind: 'talk', npc: 'clerk-amsel', label: 'Ask Clerk Amsel where the money went' }],
    after: ['the-kings-design'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'The money for the Watch’s relief left the treasury in full, and the same week it went to the roads office under the Lord Chancellor’s seal. Nothing on the King’s Road was ever mended with it. The trail runs to the man who keeps the roads office.' },
  },
  {
    id: 'city-the-roads-office',
    name: 'Repairs Nobody Made',
    giver: 'clerk-amsel',
    text: 'The Watch’s relief money went to the roads office, for repairs nobody made. The same office closed the King’s Road to refugees this spring, on the Lord Chancellor’s seal. Roadwarden Hesk keeps it, in the Roads Office at the south end of the tavern quarter, in the south-west of the city. Ask him for his ledgers from that winter.',
    // (it was one talk. What the office did is nailed to its own wall)
    objective: {
      kind: 'use', region: 'emberwick', at: 'roadwarden-hesk', count: 3, thing: 'notice', verb: 'Read', label: 'Read the notices posted at the Roads Office', secs: 1, spread: 5,
      notes: ['“King’s Road closed for repairs.” No repairs.', '“Closed to refugees.” The seal is the Chancellor’s.', 'The same clerk’s hand as the last line of Vosk’s orders.'],
    },
    then: [{ kind: 'talk', npc: 'roadwarden-hesk', label: 'Ask Roadwarden Hesk who gave the orders' }],
    after: ['city-the-treasury'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'Crane is covering his tracks. The night you brought Corvane’s order to the keep, his men emptied Hesk’s shelves into a handcart and wheeled ten years of ledgers to the Chancellor’s House. If those books still exist, they are in his cellar.' },
  },
  {
    id: 'city-the-cellar',
    name: 'The Chancellor’s Cellar',
    giver: 'roadwarden-hesk',
    text: 'The ledgers are in the cellar of the Chancellor’s House, the tall slate house just west of the main avenue, below the Ember Keep. Crane dines at the keep with the Regent tonight, so his house is dark. Nyx can open the cellar door, and Cael expects a trap. Get the ledgers out and bring them back to Hesk, who knows his own office’s books.',
    offer: [
      'Crane dines at the keep with the Regent tonight. His house will be dark.',
      'It’s the tall slate house west of the main avenue, below the keep. If the ledgers are anywhere, they’re in the cellar.',
      'Bring them to me. I know my own stamp. I can show the Regent every repair that was never made.',
    ],
    find: {
      name: 'Crane’s Ledger',
      kind: 'page',
      about: 'A page of Crane’s own ledger, found in his cellar beside Hesk’s stolen books, a chest of ash-gold and a sack of royal couriers’ letters that were never opened. Eight of the letters are from Oskar Fell, the courier who died in Briarhollow’s gateway. He carried his ninth letter to Briarhollow himself.',
      body: [
        'Received from the Herald’s rider, at the Barrow Ford: three hundred, in ash.',
        'Received by way of the roads office: the relief of the Ninefold Watch. Kept.',
        'Paid to the wardens of the King’s Road, to look away when the grey riders pass. In ash.',
        'Held back from the keep: the couriers’ letters from the north, forty-one. Burn them when the Herald says.',
      ],
      sign: 'M. C.',
    },
    objective: { kind: 'event', event: 'city-cellar', label: 'Get the ledgers out of the Chancellor’s cellar' },
    after: ['city-the-roads-office'],
    zone: 'emberwick',
    level: 29,
    thanks: [
      'That’s my stamp, on every page. Ninefold Bridge, the Barrow Ford, the Watch-house roof. None of it was ever built.',
      'And these letters still have the couriers’ seals on them. Somebody stopped them at the gate. Ten years of warnings.',
      'I’ll carry all of it up to the Regent myself, tonight. I should have done it ten years ago.',
    ],
    reward: { xp: 1800, gold: 380, item: { rarity: 'rare', name: 'Cellar-Ledger Seal' }, text: 'Hesk climbs to the keep with the ledgers and the letters under his arm, and an hour later a guard brings back the Regent’s word. Crane will be arrested at dawn, when the Starfall Festival is over and the streets are empty. Until then he must not guess that anything has changed.' },
  },
  /* ---------------------------------------------------- the Starfall Festival */
  {
    id: 'festival-the-lanterns',
    name: 'The Starfall Festival',
    giver: 'regent-elowen',
    auto: true,
    text: 'Tonight Emberwick keeps the Starfall, a thousand years since the star fell, and the whole city is in the streets. At midnight the Regent will light the star-lantern in the market square, as she does every year. If she stayed away, Crane would guess. Walk the Starfall Parade on the south avenue, near the south gate, and watch the crowd.',
    find: {
      name: 'A Paper Star',
      kind: 'token',
      about: 'A star folded out of paper, pushed into your hand by a small girl on her father’s shoulders at the Starfall Parade. Every child in the city writes a wish on one tonight, for the Regent to hang on the star-lantern.',
      body: ['I wish Papa’s cough gets better, and our dog comes home, and nobody has to go north anymore.'],
      sign: 'Lissa, seven',
    },
    objective: { kind: 'explore', spot: 'festival-parade', label: 'Join the Starfall Festival on the main avenue' },
    // (it was a walk into the crowd. The festival is kept the way the city keeps it: the hero lights lanterns, and by
    // the third sees what the crowd does not)
    then: [
      {
        kind: 'use', region: 'emberwick', at: 'festival-parade', count: 3, thing: 'lantern', verb: 'Light a lantern', label: 'Light three festival lanterns along the avenue', secs: 0.9, spread: 7,
        notes: ['A child hands you the taper. “For the star.”', 'The whole avenue is lit. Nobody watches the roofs.', 'A masked man steps back out of your light.'],
      },
    ],
    after: ['city-the-cellar'],
    zone: 'emberwick',
    level: 29,
    reward: { xp: 700, gold: 160, text: 'Drums, a great paper star carried on poles, children on their fathers’ shoulders. At midnight the Regent comes down to the market square to light the star-lantern. The masks Cael saw by the stalls start pushing through the crowd toward her, and one of them has a knife out.' },
  },
  {
    id: 'festival-the-knives',
    name: 'The Night of Knives',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane has struck first. His hired knives in festival masks, and the Host’s grey assassins with them, are going for the Regent at the star-lantern in the middle of the market square. Cael is holding the keep stair behind her, and Nyx and Orren are with you. Run north up the avenue to the square and keep her alive.',
    objective: { kind: 'event', event: 'festival-knives', label: 'Keep the Regent alive in the market square' },
    after: ['festival-the-lanterns'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2400, gold: 500, item: { rarity: 'rare', name: 'Night of Knives' }, text: 'The last of them falls among the burning stalls. The Regent is cut across the arm, and alive. Crane never came down to the square. A guard saw him running for his own house before the first knife was drawn.' },
  },
  {
    id: 'festival-the-catacombs',
    name: 'Down Among the Dead',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane ran from the square to the Chancellor’s House, west of the main avenue below the keep. In his cellar, behind a shelf, a stair nobody knew about goes down into the catacombs under the old city. Go down after him and find out where he went.',
    find: {
      name: 'The Wardens’ Map',
      kind: 'map',
      about: 'The Sigil-wardens’ own map of where they hid the seven sigils, left on Crane’s desk at the top of the catacomb stair. Crane marked each place in grey ink as he sold it to the Pale Herald. The bottom corner, where the seventh place was, was burned away long ago.',
      body: [
        'Seven holy places in a ring around Aster, in the wardens’ old hand, each with a warden’s name beside it.',
        'Briarhollow, the crypt under the chapel. Hearthstead, the hearthstone by the well. Both are crossed out in grey ink.',
        'The Sun King’s tomb, in the Sunscorch. The Thorn Court, in the Glimmerwood. The Rimeheld Vault, under the ice of Rimeheld. The Tear, in the Shattered Vale. All four are ringed in fresh grey ink.',
        'The seventh name was written in the bottom corner. Only the black edge of the burn is left.',
      ],
    },
    // (he ran, and bled as he ran: the way to his house is followed from the square)
    objective: {
      kind: 'trail', region: 'emberwick', from: 'ember-dais', to: 'crane-door', marks: 3, label: 'Follow Crane from the square',
      notes: ['Blood on the cobbles. He was cut getting away.', 'A festival mask, thrown down in a doorway.', 'His cellar door, open. A shelf stands out from the wall.'],
    },
    then: [{ kind: 'explore', spot: 'crane-catacombs', label: 'Go down the hidden stair after him' }],
    after: ['festival-the-knives'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 800, gold: 200, text: 'The stair ends at an iron door, barred from the far side, and the guards cannot break it. Crane is gone into the catacombs under the old city. He ran for his life and left the wardens’ map behind on his desk. The guards carry it up to the Regent.' },
  },
  {
    id: 'festival-the-champion',
    name: 'Champion of Aster',
    giver: 'regent-elowen',
    auto: true,
    text: 'The city is locked down and the Chancellor’s House is sealed. The Regent has the wardens’ map spread on a table in the Ember Keep’s forecourt, at the head of the main avenue. Every place on it is one the Host already knows. Go to her.',
    // (the map was looked at. The hero marks on it the four places the wardens hid a sigil, and so knows the road ahead)
    objective: {
      kind: 'use', region: 'emberwick', at: 'regent-elowen', count: 4, thing: 'books', verb: 'Mark the place', label: 'Mark the wardens’ four hiding places on the Regent’s map', secs: 1, spread: 4,
      notes: ['The Sun King’s tomb, in the Sunscorch.', 'The Thorn Court, in the Glimmerwood.', 'The Rimeheld Vault, under the ice.', 'The Tear, over the Shattered Vale.'],
    },
    then: [{ kind: 'talk', npc: 'regent-elowen', label: 'Talk to the Regent at the map table' }],
    after: ['festival-the-catacombs'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2600, gold: 600, item: { rarity: 'epic' }, text: 'The Regent names you Champion of Aster before her guards, with Crane’s empty chair behind her, and puts the wardens’ map in your hands. The Host has a head start on all four places. Every sigil you reach first is one the Hallow King will never hold. The first is the Sun King’s tomb in the Sunscorch, down the long road from the city’s west gate.' },
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
      { when: { quest: 'city-the-roads-office', state: 'active' }, lines: ['The roads office? Hesk stamps whatever is put in front of him. A clerk’s mistake is not treason.'] },
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
          'The relief money went to the roads office, under the Lord Chancellor’s seal. Every order in that office does.',
          'Roadwarden Hesk keeps it. If anyone knows where the money went after that, it’s in his ledgers.',
          'I should have said something ten years ago. I was afraid for my post. I’m sorry.',
        ],
      },
      { when: { quest: 'city-the-cellar', state: 'done' }, lines: ['Hesk walked past my window tonight with an armful of ledgers, heading for the keep. He looked ten years younger.'] },
      { when: { quest: 'city-the-roads-office', state: 'active' }, lines: ['Roadwarden Hesk runs the roads office, at the south end of the tavern quarter. Be gentle with him. He signs whatever he’s given.'] },
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
          'The ledgers from that winter? They’re gone, all of them. The Chancellor’s men came for them the night you brought that order to the keep.',
          'They wheeled ten years of my books out in a handcart, to his house. They’ll be in his cellar.',
          'Please don’t tell him I told you.',
        ],
      },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['I’ve opened the King’s Road to the refugees again. I wrote the order myself this time.'] },
      { when: { quest: 'city-the-cellar', state: 'done' }, lines: ['The Regent read every page while I stood there. Then she thanked me. Ten years, and she thanked me.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['Crane’s house is the tall slate one west of the main avenue, below the keep. His men use the cellar at night.', 'I never looked. I didn’t want to know.'] },
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
      { who: 'nyx', text: 'The cellar door isn’t even locked. Nobody leaves a door like that open by mistake.' },
      { who: 'cael', text: 'Get behind me! They were waiting for us!' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife'], from: ['crane-door', 'crane-s'] },
      { enemies: ['hired-knife', 'hired-knife', 'ashen-assassin'], from: ['crane-w', 'crane-e'], barks: [{ who: 'cael', text: 'That grey one is from the Host! It doesn’t bleed. Watch your back!' }] },
    ],
    end: [
      { who: 'nyx', text: 'Hesk’s ledgers, a chest of ash-gold, and a sack of letters with the King’s couriers’ seals. Nobody ever opened them.' },
      { who: 'cael', text: 'Take it all to Hesk. He can show which repairs were never made.' },
    ],
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
      { who: 'nyx', text: 'Gallows Gang boots under those masks! Crane hired what’s left of the gang, and he isn’t waiting for dawn!' },
      { who: 'orren', text: 'Get between them and her! Keep them off the star-lantern!' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife', 'bandit-archer'], from: ['ember-w', 'ember-e'] },
      { enemies: ['ashen-assassin', 'hired-knife', 'hired-knife', 'ashen-assassin'], from: ['ember-n', 'ember-s'], barks: [{ who: 'orren', text: 'The grey ones are the Host’s assassins! They vanish when you close in. Watch your back!' }] },
      { enemies: ['ashen-assassin', 'ashen-assassin', 'hired-knife', 'hired-knife', 'bandit-archer', 'hired-knife'], from: ['ember-w', 'ember-e', 'ember-n'], barks: [{ who: 'nyx', text: 'That’s the last of them! Keep her behind you!' }] },
    ],
    end: [{ who: 'nyx', text: 'She’s alive. And Crane isn’t here. He was meant to be at her side tonight.' }],
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
