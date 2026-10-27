import { EVENTS } from './events';
import { balanceQuestXp } from './progression';
import { REGIONS } from './regions';
import { STORY_QUESTS } from './story';
import type { NpcDef, QuestDef, RegionId } from './types';
import { ZONES } from './zones';

/**
 * The quest chain. A quest opens once the ones in `after` are done: the first quest of a giver's chain is
 * offered ("!" over their head) and starts when the hero talks to them, the next steps carry on by
 * themselves (progress/character.ts, needsAccept). It pays out the moment its objective is met. NPCs
 * comment on where you are in it.
 */
export const QUESTS: QuestDef[] = [
  /* The Prologue's first beats (STORY_BIBLE.md §3): the rest of it lives with Briarhollow. Ids are kept from
     the old opening so saves keep their progress. */
  {
    id: 'first-steps',
    name: 'Mara’s Yard',
    giver: 'mara-venn',
    auto: true,
    text: 'Mara Venn won’t let a stranger through her gate after dusk until she has seen them fight. The guard yard is just inside the palisade: show her your arm, your trick and your feet, then go back to her.',
    objective: { kind: 'tutorial', step: 'attack', count: 5, label: 'Hit a training dummy' },
    then: [
      { kind: 'tutorial', step: 'skill', count: 2, label: 'Use your skill on a dummy' },
      { kind: 'tutorial', step: 'dodge', count: 1, label: 'Dodge through a stone' },
    ],
    turnIn: 'mara-venn',
    thanks: ['Fine arm, a trick worth carrying, and you can get out of the way of things. That’s more than most who come through here.', 'Take this. And the north road is yours, for what it’s worth now.'],
    after: ['briar-dusk'],
    reward: { xp: 70, gold: 25, item: { rarity: 'uncommon' }, unlock: 'whisperwood', text: 'The north road into the Whisperwood is open.' },
  },
  {
    id: 'into-the-wood',
    name: 'Before the Light Goes',
    giver: 'maren',
    auto: true,
    text: 'Whatever shot the king’s courier came out of the Whisperwood, and so do the things that take Briarhollow’s people after dark. Go north before the light goes and thin them out on the trails.',
    objective: { kind: 'kill', region: 'whisperwood', count: 15, label: 'Defeat creatures in the Whisperwood' },
    after: ['briar-the-seal'],
    reward: { xp: 140, gold: 40 },
  },
  {
    id: 'rift-shards',
    name: 'Shards of Grieflight',
    giver: 'smith-hollin',
    text: 'Hollin the smith has seen the shards the glowing beasts of the wood drop: grey glass that hums. Bring him three and he will forge something worth carrying.',
    objective: { kind: 'collect', item: 'shard', count: 3, label: 'Collect shards from glowing elites' },
    after: ['first-steps'],
    reward: { xp: 160, gold: 30, item: 'class-epic', text: 'Hollin forges you a weapon that changes how your skill works.' },
  },
  {
    id: 'hidden-grove',
    name: 'The Hidden Grove',
    giver: 'herbwife-thessa',
    text: 'Herbwife Thessa says an old grove hides in the north-west of the Whisperwood, behind a hedge that isn’t really there. Her grandmother picked starwort in it.',
    objective: { kind: 'explore', spot: 'hidden-grove', label: 'Find the Hidden Grove' },
    after: ['first-steps'],
    reward: { xp: 120, gold: 25, item: { rarity: 'rare' } },
  },
  {
    id: 'alpha',
    name: 'The Alpha',
    giver: 'maren',
    auto: true,
    text: 'The beasts of the wood follow one great boar with grey light in its eyes: Grimtusk. It dens at the east end of the Whisperwood. Kill it before nightfall and there is one less thing at Briarhollow’s door.',
    objective: { kind: 'boss', boss: 'grimtusk', label: 'Defeat Grimtusk' },
    after: ['into-the-wood'],
    reward: { xp: 260, gold: 60, text: 'The sun is going down behind you. Briarhollow is a long way back.' },
  },
  {
    id: 'the-warden',
    name: 'The Crypt Warden',
    giver: 'maren',
    auto: true,
    text: 'The raiders went down the crypt stair under the chapel. The crypt is older than the village, and its warden still keeps it three hundred years dead. Get past him.',
    objective: { kind: 'boss', boss: 'ossric', label: 'Defeat the crypt warden, Ossric' },
    after: ['briar-below'],
    reward: { xp: 380, gold: 90 },
  },
  {
    id: 'close-the-rift',
    name: 'The Reliquary',
    giver: 'maren',
    auto: true,
    text: 'Past the warden lies the reliquary, and in it, the Elder says, a piece of the Starlight Crown. Morgrave, the Ash-scholar who leads the raiders, has reached it first.',
    objective: { kind: 'boss', boss: 'morgrave', label: 'Stop Morgrave at the reliquary' },
    after: ['the-warden'],
    reward: {
      xp: 700,
      gold: 200,
      tier: 1,
      perk: 'sigil-embers',
      text: 'In the reliquary: a sliver of star-iron, warm as a hearth. When Elyra touches it, it bonds to her. On the wall, freshly painted, the mark of the Ashen Host: a crown made of grey hands. (Heroic difficulty is open.)',
    },
  },
  {
    id: 'heroic',
    name: 'Heroic Deeds',
    giver: 'maren',
    text: 'The crypt under the chapel stirs again, colder and stronger. Clear the Chapel Crypt on Heroic difficulty.',
    objective: { kind: 'clear', region: 'crypt', tier: 1, label: 'Clear the Chapel Crypt on Heroic' },
    after: ['close-the-rift'],
    level: 12,
    reward: { xp: 1500, gold: 400, item: 'amulet-of-echoes', tier: 2, text: 'Mythic difficulty is open.' },
  },
  {
    id: 'mythic',
    name: 'Beneath the Bell',
    giver: 'maren',
    text: 'At Mythic, the crypt shows what the Ash Crown makes of grief. Clear the Chapel Crypt there.',
    objective: { kind: 'clear', region: 'crypt', tier: 2, label: 'Clear the Chapel Crypt on Mythic' },
    after: ['heroic'],
    level: 17,
    reward: { xp: 4000, gold: 1000, item: 'glitch-shard' },
  },
];
QUESTS.push(...STORY_QUESTS, ...ZONES.flatMap((z) => z.quests));

export const QUEST_DEFS: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// the rebalance (PROGRESSION_BALANCE.md Part 2, A): main-story rewards by region, side quests less, and
// each quest's level for the out-levelled falloff (QUESTS and QUEST_DEFS hold the same objects)
const NPC_REGION: Record<string, RegionId> = Object.fromEntries(ZONES.flatMap((z) => Object.keys(z.npcs).map((id) => [id, z.region.id] as const)));
balanceQuestXp(QUEST_DEFS, REGIONS, NPC_REGION, EVENTS);

export const NPCS: Record<string, NpcDef> = {
  brannoc: {
    id: 'brannoc',
    name: 'Brannoc',
    title: 'Smith',
    sprite: 'smith',
    service: 'smith',
    shop: 'weapons',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['The Chancellor’s men bought swords off me, last spring. Good ones. I keep thinking about who they were for.'] },
      { lines: ['The Crown City’s forge. Weapons for your hands, made to your level. Gear you don’t want, I’ll buy.', 'Each piece of gear changes something. Read the gold text: that’s where the magic is.'] },
    ],
  },
  ysolde: {
    id: 'ysolde',
    name: 'Ysolde',
    title: 'Mystic',
    sprite: 'mystic',
    service: 'respec',
    talk: [
      { when: { quest: 'heroic', state: 'active' }, lines: ['The crypt under Briarhollow remembers you. It has grown teeth.', 'Heroic difficulty waits on the waystone. Choose it when you travel to the crypt.'] },
      { when: { quest: 'mythic', state: 'active' }, lines: ['Mythic. The grieflight at its worst. I would not, but you will.'] },
      { lines: ['Talents are choices, not chains. I can unbind them for a little gold.', 'Open your talents and choose Reset to try another path.'] },
    ],
  },
  tamsin: {
    id: 'tamsin',
    name: 'Tamsin',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    pal: { y: '#c9473b', Y: '#8a2a20', b: '#a85a3a', B: '#7a3a20' },
    talk: [{ lines: ['Welcome to the Ember Hearth. Potions on the shelf, fire in the grate.', 'Out there, catch your breath between fights: you heal quickly once nothing is hitting you. Potions are for when something is.'] }],
  },
  odo: {
    id: 'odo',
    name: 'Odo',
    title: 'Armorer',
    sprite: 'smith',
    shop: 'armor',
    pal: { h: '#3a3a4a', H: '#5a5a6a', a: '#5a6078', A: '#3a4058', c: '#d8dce6' },
    talk: [{ lines: ['Helms, coats, gloves, boots. Fitted to you, more or less.', 'New stock every time you come home in one piece.'] }],
  },
  wren: {
    id: 'wren',
    name: 'Imelda',
    title: 'Curio dealer',
    sprite: 'mystic',
    shop: 'curios',
    pal: { t: '#c9479b', T: '#8a2a6a', p: '#3a8a6a', P: '#24604a', o: '#ffe066', O: '#ffaa22' },
    talk: [
      { when: { quest: 'nyx-joins', state: 'done' }, lines: ['Your friend in the dark coat has been through my stock twice and bought nothing. I count it every time she leaves. It’s always all there. That’s what worries me.'] },
      { lines: ['Rings that hum, amulets that remember. Have a look.', 'Some of these change how a spell behaves. Read the gold lines.'] },
    ],
  },
  hale: {
    id: 'hale',
    name: 'Captain Hale',
    title: 'Quartermaster of the Crown',
    sprite: 'elder',
    shop: 'quartermaster',
    pal: { g: '#6b4bd6', G: '#3b2a8a', w: '#3a3a4a', W: '#24242e' },
    talk: [
      { when: { quest: 'the-wall-burns', state: 'started' }, lines: ['The market’s a muster ground now. Every sword in the city goes north, and I sign for every one.', 'Sigil Marks still buy the best of it. Heroic and Mythic bosses pay more.'] },
      { lines: ['Every boss that falls drops Sigil Marks. Bring them here.', 'I keep the best gear the Crown has, for heroes at the top of their game. Heroic and Mythic bosses pay more marks.'] },
    ],
  },
  pell: {
    id: 'pell',
    name: 'Pell',
    title: 'Farmer',
    sprite: 'villager',
    talk: [{ lines: ['Have you seen my chickens? No? Good. They’re plotting something.', 'Stay off the brambles in the wood. They bite.'] }],
  },
  'regent-elowen': {
    id: 'regent-elowen',
    name: 'Regent Elowen',
    title: 'Regent of Aster',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['My uncle the King died in his sleep the week the bell rang. Peacefully, they tell me. I believe them. I want to believe one thing they tell me.', 'I am to be crowned in the spring, with the old crown and no sigils in it. It will be the first time in three hundred years the Crown of Aster is only a hat. I find I am looking forward to it.'] },
      { when: { quest: 'the-third-gate', state: 'active' }, lines: ['Mara Venn. And you. Standing in my muster ground with the soot of the Muster Hall still on you.', 'Tell me. All three. Tell me slowly; I want to remember exactly how it sounded.'] },
      { when: { quest: 'into-vaelmoor', state: 'active' }, lines: ['Past the Gates is his country. Nobody living has walked it in three hundred years. Orren went first, alone, of course.', 'Two sigils are still out there, and him. Go and get them before he does.'] },
      { when: { quest: 'gate-nyx-returns', state: 'active' }, lines: ['A letter from Mara: someone walked into her camp under a white rag. She has not killed them yet, she writes, underlined twice.', 'Go back to Highwall. I would like to know who can make Mara Venn hesitate.'] },
      { when: { quest: 'the-long-night-ends', state: 'active' }, lines: ['Highwall holds? Then the Hallow King has lost his first real battle, and he lost it to you.', 'One gate of three. Mara Venn says the other two will be harder. I believe her. I have started believing Mara Venn about everything.'] },
      { when: { quest: 'the-wall-burns', state: 'active' }, lines: ['Highwall is under siege: the first of the Three Gates. If it falls, the Host is on the road to every city in the south.', 'Lord-Commander Varn holds the March outside its walls. Go to him, and take whatever he needs to you, from me. Mara Venn will command the relief.'] },
      { when: { quest: 'the-frozen-road', state: 'active' }, lines: ['The Sigil of Frost sleeps in a vault under the Rimeheld ice, in the far north-west, and the jarls are at each other’s throats over it.', 'Jarl Sigrun of Frostgate keeps the way. She owes the Crown nothing, so be polite. We need her huscarls more than she needs us.'] },
      { when: { quest: 'the-sun-kings-tomb', state: 'active' }, lines: ['The sun houses want the Sun Sigil left in its tomb forever. I understand them. I need it anyway.', 'Find Oasis-keeper Sefu at the Oasis of Ras, east of Ironpeak. Persuade the houses, if you can. Get there before the Host, whatever happens.'] },
      { when: { quest: 'festival-the-champion', state: 'active' }, lines: ['You stood in front of me with your back to a knife. Nobody has done that for me since I was nine.', 'Kneel. No, get up, I hate that. Champion of Aster. It comes with a terrible coat and the right to tell my generals they are wrong.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Crane is in the catacombs, and the catacombs are older than the city. Let him rot there for now. We have a war.', 'The realm will not march together on my say-so. Each of them wants something. Go and find out what.'] },
      { when: { quest: 'kesh-the-truth', state: 'active' }, lines: ['Vinehold’s barges. Carrying the plague that killed Duskfen, for grey coin, the winter they were starving.', 'I could hang every warden in the marsh. Then who rows my army up the river? Send for Kesh. Not for a hangman. Not yet.'] },
      { when: { quest: 'festival-the-lanterns', state: 'active' }, lines: ['The ledgers say it plainly. Crane will be arrested when the festival is over, quietly, at dawn. Tonight the whole city is in the streets and I will not frighten it.', 'Walk the parade. Watch the crowd. Stay close.'] },
      { when: { quest: 'city-the-treasury', state: 'active' }, lines: ['I can’t arrest my oldest counsellor on one paper, however it is signed. Follow the money. The Watch’s pay came out of the treasury ten years ago.', 'Clerk Amsel has kept the treasury ledgers since before I could read. Ask him where it went.'] },
      { when: { quest: 'the-kings-design', state: 'active' }, lines: ['A relief order for the Ninefold Watch, ten years old. Countermanded. In Maelis’s hand.', 'He taught me my letters. He sat with me when my mother died. Give me a moment.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['Stay for the festival. I want you near me. I want someone near me who has never been paid by the treasury.'] },
      { lines: ['Welcome to the Crown City. These walls have stood since the Sigil-wardens built them.', 'My uncle the King is resting. I rule in his name, and I am told I rule well. I am told a great many things.'] },
    ],
  },
  gorran: {
    id: 'gorran',
    name: 'Gorran',
    title: 'Keeper of the Drunken Wyvern',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Drunken Wyvern',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['The knives in the square were city men. I served two of them, the week before. Quiet lads. Paid in grey coin. I threw it in the river.'] },
      { lines: ['Folk say the dead are walking in the north. Folk say a lot of things after the third ale.', 'But a man came down from the Pale Reach last week, white as milk, and he wouldn’t drink. That’s the part that worries me.'] },
      { lines: ['Pull up a stool. Ale, stew, and the best rumors in the city, all on the house if you saved my cousin’s farm.', 'I keep potions behind the bar too. Don’t tell Tamsin.'] },
    ],
  },
  'guard-gate': {
    id: 'guard-gate',
    name: 'Sergeant Brask',
    title: 'East gate',
    sprite: 'villager',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['City’s locked down. Nobody in or out without a pass. Except you. You have a face now.'] },
      { lines: ['East gate. The King’s Road runs to Lantern Hill and the downs, and it isn’t a stroll any more.', 'South gate goes down to the refugee road. West gate to the mountains. Don’t go before you’re ready.'] },
    ],
  },
};
for (const z of ZONES) Object.assign(NPCS, z.npcs);
