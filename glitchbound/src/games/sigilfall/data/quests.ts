import { STORY_QUESTS } from './story';
import type { NpcDef, QuestDef } from './types';
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
    text: 'Mara Venn won’t let a stranger through her gate after dusk until she has seen them fight. The guard yard is just inside the palisade.',
    objective: { kind: 'tutorial', step: 'attack', count: 3, label: 'Hit a training dummy' },
    after: ['briar-dusk'],
    reward: { xp: 25, gold: 10 },
  },
  {
    id: 'first-spell',
    name: 'Tricks of the Trade',
    giver: 'mara-venn',
    auto: true,
    text: 'Mara wants to see the trick you carry: use your skill on a dummy.',
    objective: { kind: 'tutorial', step: 'skill', count: 1, label: 'Use your skill on a dummy' },
    after: ['first-steps'],
    reward: { xp: 15, gold: 5 },
  },
  {
    id: 'first-dodge',
    name: 'Out of Harm’s Way',
    giver: 'mara-venn',
    auto: true,
    text: 'The old dummy at the back of the yard throws stones. Get out of the way of one: while you dodge, nothing can touch you.',
    objective: { kind: 'tutorial', step: 'dodge', count: 1, label: 'Dodge through a stone' },
    after: ['first-spell'],
    reward: { xp: 30, gold: 10, item: { rarity: 'uncommon' }, unlock: 'whisperwood', text: 'The north road into the Whisperwood is open.' },
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
    after: ['first-dodge'],
    reward: { xp: 160, gold: 30, item: 'class-epic', text: 'Hollin forges you a weapon that changes how your skill works.' },
  },
  {
    id: 'hidden-grove',
    name: 'The Hidden Grove',
    giver: 'herbwife-thessa',
    text: 'Herbwife Thessa says an old grove hides in the north-west of the Whisperwood, behind a hedge that isn’t really there. Her grandmother picked starwort in it.',
    objective: { kind: 'explore', spot: 'hidden-grove', label: 'Find the Hidden Grove' },
    after: ['first-dodge'],
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

export const NPCS: Record<string, NpcDef> = {
  brannoc: {
    id: 'brannoc',
    name: 'Brannoc',
    title: 'Smith',
    sprite: 'smith',
    service: 'smith',
    shop: 'weapons',
    talk: [
      { when: { quest: 'rift-shards', state: 'active' }, lines: ['Those elites in the wood, the ones that glow? They carry Rift Shards.', 'Bring me three and I’ll forge you something that changes how you fight. Not just sharper. Different.'] },
      { when: { quest: 'rift-shards', state: 'locked' }, lines: ['Busy. Come back when Maren is done with you.'] },
      { lines: ['Weapons for your hands, forged to your level. Gear you don’t want, I’ll buy.', 'Each piece of gear changes something. Read the gold text: that’s where the magic is.'] },
    ],
  },
  ysolde: {
    id: 'ysolde',
    name: 'Ysolde',
    title: 'Mystic',
    sprite: 'mystic',
    service: 'respec',
    talk: [
      { when: { quest: 'hidden-grove', state: 'active' }, lines: ['There is a grove in the north-west of the wood that the trees keep to themselves.', 'Look for a hedge that shimmers. Walk straight through it.'] },
      { when: { quest: 'heroic', state: 'active' }, lines: ['The Rift remembers you. It has grown teeth.', 'Heroic difficulty waits on the waystone. Choose it when you travel to the crypt.'] },
      { when: { quest: 'mythic', state: 'active' }, lines: ['Mythic. The Rift at its worst. I would not, but you will.'] },
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
    name: 'Wren',
    title: 'Curio dealer',
    sprite: 'mystic',
    shop: 'curios',
    pal: { t: '#c9479b', T: '#8a2a6a', p: '#3a8a6a', P: '#24604a', o: '#ffe066', O: '#ffaa22' },
    talk: [{ lines: ['Rings that hum, amulets that remember. Have a look.', 'Some of these change how a spell behaves. Read the gold lines.'] }],
  },
  hale: {
    id: 'hale',
    name: 'Captain Hale',
    title: 'Sigil Quartermaster',
    sprite: 'elder',
    shop: 'quartermaster',
    pal: { g: '#6b4bd6', G: '#3b2a8a', w: '#3a3a4a', W: '#24242e' },
    talk: [
      { lines: ['Every boss that falls drops Sigil Marks. Bring them here.', 'I keep the best gear there is, made for heroes at the top of their game. Heroic and Mythic bosses pay more marks.'] },
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
    title: 'Regent of Emberwick',
    sprite: 'elder',
    talk: [
      { when: { quest: 'the-long-night-ends', state: 'active' }, lines: ['Highwall holds? Then the King has lost his first real battle, and he lost it to you.', 'The road north is open. So is his road south, if we falter now.'] },
      { when: { quest: 'the-wall-burns', state: 'active' }, lines: ['Highwall is under siege. If it falls, nothing stands between the Legion and every city of the south.', 'Lord-Commander Varn holds the March outside its walls. Go to him, and take whatever he needs to you, from me.'] },
      { when: { quest: 'the-frozen-road', state: 'active' }, lines: ['The Sigil of Frost sleeps in a vault under the Rimeheld ice, in the far north-west. The Legion knows it too.', 'Jarl Sigrun of Frostgate keeps the way. She owes Emberwick nothing, so be polite.'] },
      { when: { quest: 'the-sun-kings-tomb', state: 'active' }, lines: ['The Sun King was buried with his sigil, out in the Sunscorch, east of Ironpeak. His tomb is sealed. That will not stop the Legion.', 'Find Oasis-keeper Sefu at the Oasis of Ras. Nobody knows those sands better.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['Seven marks on a dead knight’s map, and the Legion marching on every one.', 'We cannot hold all seven roads. So you will not hold them: you will get there first.'] },
      { when: { quest: 'the-kings-design', state: 'active' }, lines: ['Corvane carried this? Show me. Three hundred years old, and every mark a sigil.', 'He is not only raising an army. He is hunting the very things that bound him.'] },
      { when: { quest: 'refugees-on-the-road', state: 'active' }, lines: ['Refugees are pouring onto the Amberfield Steppes from the east, and Marshal Dunmore holds their camp at Hearthstead with a handful of lancers.', 'Take the coast road through the Saltmarsh and north from there. Help him keep them alive, and find out what they are running from.'] },
      { when: { quest: 'the-regents-council', state: 'active' }, lines: ['So you are the one Maren keeps sending into the dark. Sit. Tell my council what you told her.', 'Hollow gold. Ghouls brewed in a marsh. An empty tomb. Vaelor, the Hollow King, is raising a Legion of the dead to take back his kingdom.', 'The Sigil-wardens left us one weapon against him. Take it.'] },
      { when: { quest: 'the-drowned-fleet', state: 'done' }, lines: ['A fleet of the drowned, a Legion of the dead, and a king who will not stay in his grave.', 'Emberwick will hold. Our walls are old but they are not tired. Go where Maren sends you; you carry this city’s hope now.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Maren told me. Vaelor. I had hoped that name was only for frightening children.', 'I have sent riders to every town. They will need help before they ask for it. Be that help.'] },
      { lines: ['Welcome to Emberwick. These walls have stood since the Sigil-wardens built them.', 'The sigils have fallen and the roads are no longer safe. If Elder Maren says you are ready, the city is glad of you.'] },
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
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Folk say the dead are walking in the north. Folk say a lot of things after the third ale.', 'But a man came down from the Pale Reach last week, white as milk, and he wouldn’t drink. That’s the part that worries me.'] },
      { lines: ['Pull up a stool. Ale, stew, and the best rumors in the city, all on the house if you saved my cousin’s farm.', 'I keep potions behind the bar too. Don’t tell Tamsin.'] },
    ],
  },
  'guard-gate': {
    id: 'guard-gate',
    name: 'Sergeant Brask',
    title: 'East gate',
    sprite: 'villager',
    talk: [
      { lines: ['East gate. The road runs to the Whisperwood, and it isn’t a stroll any more.', 'South gate goes down to Thornvale. Wolves and worse on that road. Don’t go before you’re ready.'] },
    ],
  },
};
for (const z of ZONES) Object.assign(NPCS, z.npcs);
