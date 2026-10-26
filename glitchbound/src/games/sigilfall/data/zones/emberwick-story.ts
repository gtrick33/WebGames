import type { EnemyDef, NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The Crown City's part of Act II (STORY_BIBLE.md §3, "The traitor" and "The Starfall Festival"). The
 * countermanded order Corvane gave Cael is in the Lord Chancellor's hand, but one paper will not bring down
 * the Regent's oldest counsellor. The trail runs through the treasury (the Watch's pay, drawn ten years
 * ago), the roads office (which spent it on repairs nobody made, and closed the King's Road to refugees
 * this spring) and down into Crane's own cellar, where his hired knives are waiting for whoever comes. The
 * ledgers prove it; the Regent means to arrest him quietly when the Starfall Festival is over. At the
 * height of it, Crane's knives and the Host's assassins strike at the Regent in the square. She lives,
 * Crane runs into the catacombs under his house, and the Regent names the hero her champion. Act III
 * opens from her.
 */
export const EMBERWICK_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------------ the traitor */
  {
    id: 'city-the-treasury',
    name: 'Follow the Money',
    giver: 'regent-elowen',
    text: 'The Regent cannot arrest her oldest counsellor on one paper, however it is signed. Ten years ago the Ninefold Watch’s relief was paid for out of the treasury, and never marched. Clerk Amsel has kept the treasury ledgers since before the Regent could read. Ask him where the money went.',
    objective: { kind: 'talk', npc: 'clerk-amsel', label: 'Ask Clerk Amsel at the Treasury where the Watch’s pay went' },
    after: ['the-kings-design'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'The Watch’s pay was drawn in full, and signed over the same week to the roads office “for repairs on the King’s Road”.' },
  },
  {
    id: 'city-the-roads-office',
    name: 'Repairs Nobody Made',
    giver: 'clerk-amsel',
    text: 'The roads office spent the relief company’s pay on “repairs on the King’s Road”, and Amsel has walked the King’s Road, and there were no repairs. It is the same office that closed the road to refugees this spring. Roadwarden Hesk keeps it, in the tavern quarter. Ask him for the old ledgers.',
    objective: { kind: 'talk', npc: 'roadwarden-hesk', label: 'Ask Roadwarden Hesk at the Roads Office for the old ledgers' },
    after: ['city-the-treasury'],
    zone: 'emberwick',
    level: 28,
    reward: { xp: 1200, gold: 260, text: 'Hesk is shaking. The ledgers were taken from his office the night Corvane’s order reached the city. By the Chancellor’s men. To the Chancellor’s house.' },
  },
  {
    id: 'city-the-cellar',
    name: 'The Chancellor’s Cellar',
    giver: 'roadwarden-hesk',
    text: 'The ledgers are in Lord Chancellor Crane’s cellar, under his house west of the avenue, and Crane is at the keep with the Regent. Cael and Nyx will go with you. Nyx says the cellar door will open. Cael says someone will be waiting behind it. They are both right.',
    objective: { kind: 'event', event: 'city-cellar', label: 'Get the ledgers out of the Chancellor’s cellar' },
    after: ['city-the-roads-office'],
    zone: 'emberwick',
    level: 29,
    reward: { xp: 1800, gold: 380, item: { rarity: 'rare' }, text: 'Ten years of ledgers, and in the last of them, in Crane’s own hand, payments in a coin that weighs nothing. The Host bought the Ninefold Watch’s fall, and the roads, and the lost letters.' },
  },
  /* ---------------------------------------------------- the Starfall Festival */
  {
    id: 'festival-the-lanterns',
    name: 'The Starfall Festival',
    giver: 'regent-elowen',
    auto: true,
    text: 'The ledgers say it plainly, and the Regent will have Crane arrested at dawn, quietly, when the festival is over. Tonight Emberwick celebrates the star that fell three hundred years ago: lanterns in the square, music, the parade down the south avenue. The whole city is in the streets. Walk the parade and watch the crowd.',
    objective: { kind: 'explore', spot: 'festival-parade', label: 'Watch the Starfall Parade on the south avenue' },
    after: ['city-the-cellar'],
    zone: 'emberwick',
    level: 29,
    reward: { xp: 700, gold: 160, text: 'Drums, a paper star on poles, children on their fathers’ shoulders. Then the Regent comes down into the square to light the star-lantern, and a lot of men in festival masks start moving toward her at once.' },
  },
  {
    id: 'festival-the-knives',
    name: 'The Night of Knives',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane’s hired knives in festival masks, and among them grey shapes that move like smoke: the Host’s assassins. They are going for the Regent at the star-lantern in the middle of the square, and the stalls are burning. Cael is holding the keep stair; Nyx and Orren are with you. Keep her alive.',
    objective: { kind: 'event', event: 'festival-knives', label: 'Keep the Regent alive in the burning square' },
    after: ['festival-the-lanterns'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2400, gold: 500, item: { rarity: 'rare' }, text: 'The last of the masks goes down. The Regent is bleeding from the arm and furious. Crane is not at the keep. Someone saw him running for his house.' },
  },
  {
    id: 'festival-the-catacombs',
    name: 'Down Among the Dead',
    giver: 'regent-elowen',
    auto: true,
    text: 'Crane ran for his house. His cellar has a stair nobody knew about, down into the catacombs under the old city, and the door at the bottom is barred from the other side. Go and see.',
    objective: { kind: 'explore', spot: 'crane-catacombs', label: 'Find where Crane went' },
    after: ['festival-the-knives'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 800, gold: 200, text: 'A stair, a barred door older than the city, and a smell of cold hearths coming under it. Crane is down there with the dead, and whatever he made his bargain with.' },
  },
  {
    id: 'festival-the-champion',
    name: 'Champion of Aster',
    giver: 'regent-elowen',
    auto: true,
    text: 'The city is locked down, Crane’s house is sealed, and the Regent wants to see you in her courtyard. She has not slept. She says she has decided something.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Go to the Regent in her courtyard' },
    after: ['festival-the-catacombs'],
    zone: 'emberwick',
    level: 30,
    reward: { xp: 2600, gold: 600, item: { rarity: 'epic' }, text: 'Champion of Aster. The Regent needs an army, and the realm’s factions will not march together on her say-so. Each of them has an old grudge and a real choice to make. She is sending you to them.' },
  },
];

export const EMBERWICK_NPCS: Record<string, NpcDef> = {
  'chancellor-crane': {
    id: 'chancellor-crane',
    name: 'Lord Chancellor Crane',
    title: 'Keeper of the treasury and the roads',
    sprite: 'elder',
    talk: [
      { when: { quest: 'city-the-treasury', state: 'active' }, lines: ['The treasury? Dusty rooms, dustier men. Amsel will bore you to tears. Give him my regards.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['You look tired, champion. You should rest. The city has so many quiet places to rest in.'] },
      { when: { quest: 'city-the-cellar', state: 'done' }, lines: ['The festival tonight. You will stand near the Regent, I hope? She is fond of you. I am fond of her. We all have our ways of showing it.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['A paper from a dead man, carried by a disgraced one. I would not trouble the Regent with it, if I were you.', 'But I am not you. Welcome to the Crown City.'] },
      { lines: ['Maelis Crane. I keep the treasury and the roads, which is to say I keep the kingdom from falling over.', 'The Regent is tired. Bring her good news, if you have any. Bring it to me first, if you have the other kind.'] },
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
          'The Ninefold Watch’s relief? Ten years ago, spring. Third shelf, green ledger. I remember because the sum was so large.',
          'Drawn in full. And signed over, that same week, to the roads office. “For repairs on the King’s Road.”',
          'I walked the King’s Road that summer, to my sister’s. There were no repairs. I thought it odd. I thought it odd for ten years, and I never said.',
        ],
      },
      { when: { quest: 'city-the-roads-office', state: 'active' }, lines: ['Hesk keeps the roads office, in the tavern quarter. Be gentle with him. He’s the kind of man who signs what he’s given.'] },
      { lines: ['Ledgers. Forty years of ledgers. Every coin the Crown spent, and where it went, mostly.', 'Mostly is the word that keeps me up at night.'] },
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
          'The old ledgers? Gone. Gone! The Chancellor’s men came for them the night some knight’s letter reached the keep. Took ten years of books out in a handcart.',
          'And the order closing the King’s Road to refugees, this spring, that came from him too. I signed it. I sign what I’m given.',
          'They went to his house. His cellar. Please don’t tell him I told you.',
        ],
      },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['His house is west of the avenue, the tall one. His men go in and out of the cellar at night. I don’t look. I want you to know I don’t look.'] },
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['I’ve opened the King’s Road again. To everyone. I signed it myself. Nobody gave it to me.'] },
      { lines: ['The roads office. Tolls, repairs, permits. Mostly permits.', 'If you want a road closed, it’s a form. If you want it open, it’s a longer form.'] },
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
      { who: 'nyx', text: 'Lock’s open. That was too easy. I hate it when it’s too easy.' },
      { who: 'cael', text: 'Behind me. They’ve been waiting.' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife'], from: ['crane-door', 'crane-s'] },
      { enemies: ['hired-knife', 'hired-knife', 'ashen-assassin'], from: ['crane-w', 'crane-e'], barks: [{ who: 'cael', text: 'That grey one isn’t a city man. Watch it — it doesn’t bleed!' }] },
    ],
    end: [{ who: 'nyx', text: 'Ledgers. Ten years of them. And this one’s full of coin that weighs nothing. Somebody has been very stupid and very rich.' }],
    retry: [{ who: 'cael', text: 'Up. On your feet. The ledgers are still down there.' }],
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
      { who: 'orren', text: 'Masks! Every one of those masks is moving toward her!' },
      { who: 'nyx', text: 'I know those boots. Gallows Gang boots. Somebody hired the whole gang.' },
    ],
    waves: [
      { enemies: ['hired-knife', 'hired-knife', 'hired-knife', 'bandit-archer'], from: ['ember-w', 'ember-e'] },
      { enemies: ['ashen-assassin', 'hired-knife', 'hired-knife', 'ashen-assassin'], from: ['ember-n', 'ember-s'], barks: [{ who: 'orren', text: 'The grey ones are the Host’s. They don’t want her dead. They want her grief.' }] },
      { enemies: ['ashen-assassin', 'ashen-assassin', 'hired-knife', 'hired-knife', 'bandit-archer', 'hired-knife'], from: ['ember-w', 'ember-e', 'ember-n'], barks: [{ who: 'nyx', text: 'Last of them — keep her behind you, keep her behind you!' }] },
    ],
    end: [{ who: 'orren', text: 'She lives. Lord of the long road, she lives. Where is the Chancellor?' }],
    retry: [{ who: 'orren', text: 'No — no. Again. We hold her again, and this time she lives.' }],
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
