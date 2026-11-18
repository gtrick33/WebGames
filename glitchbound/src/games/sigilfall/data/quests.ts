import { MAX_LEVEL } from './classes';
import { EVENTS } from './events';
import { storyLive } from './retired';
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
     the old opening so saves keep their progress. The night opens it: the first fight is at the gate, and it
     teaches the controls as it goes (each wave shows the one it asks for). */
  {
    id: 'first-steps',
    name: 'Ash at the Gate',
    giver: 'mara-venn',
    auto: true,
    quiet: true,
    text: 'Grey soldiers are coming down the north road behind you, with no torches and no sound. Mara Venn is the only guard left at the gate. Fight beside her. Attack, use your skill, and dodge their arrows.',
    objective: { kind: 'event', event: 'briar-gate', label: 'Hold the north gate with Mara' },
    after: ['briar-dusk'],
    reward: { xp: 70, gold: 25, item: { rarity: 'uncommon' } },
  },
  {
    id: 'into-the-wood',
    name: 'Into the Whisperwood',
    giver: 'maren',
    auto: true,
    text: 'Before Briarhollow can gather the Vale, its own north road must be safe. The Host came down it through the Whisperwood, and every beast it passed has gone mad, with grieflight burning in its eyes. Go up the north road and thin them out on the trails.',
    // (eighteen, where it was six: two camps did it, and nothing asked a hero to see the rest of the wood before the
    // den. The owner: "i dont have an intentive of clearing more than 2 camps". Five or six camps now, paid as more work)
    objective: { kind: 'kill', region: 'whisperwood', count: 18, label: 'Defeat maddened beasts in the Whisperwood' },
    after: ['the-empty-tomb'],
    reward: { xp: 220, gold: 60, text: 'The trails are full of beasts that died snarling at nothing. Each one had the same violet light in its eyes, and the light went out when it fell. Every trail you followed led east, toward one great den.' },
  },
  {
    id: 'rift-shards',
    name: 'Shards of Grieflight',
    giver: 'smith-hollin',
    text: 'The strongest beasts in the Whisperwood glow with grieflight, the violet light the Host leaves in everything it touches. They drop shards of it. Bring three shards to Hollin the smith, and he will forge you a better weapon.',
    objective: { kind: 'collect', item: 'shard', count: 3, label: 'Collect shards from glowing beasts' },
    after: ['the-empty-tomb'],
    reward: { xp: 160, gold: 30, item: 'class-epic', text: 'Hollin works the violet glass into the steel by night and won’t let anyone else touch it. The weapon he hands you in the morning changes how your skill works.' },
  },
  {
    id: 'hidden-grove',
    name: 'The Hidden Grove',
    giver: 'herbwife-thessa',
    text: 'Herbwife Thessa’s grandmother picked starwort in a hidden grove in the north-west of the Whisperwood. An old hedge with a spell in it hides the way in. Thessa needs starwort for the camp’s burns. Find the grove.',
    offer: ['My kitchen is full of burns, and starwort is the only thing that takes the fire out of them.', 'My gran picked it in a hidden grove in the north-west of the Whisperwood. Her hedge hides the way in.', 'I haven’t been there since I was a girl. Will you find it for me?'],
    objective: { kind: 'explore', spot: 'hidden-grove', label: 'Find the Hidden Grove in the north-west Whisperwood' },
    after: ['the-empty-tomb'],
    find: {
      name: 'A Note in the Old Oak',
      kind: 'note',
      about: 'An oilcloth packet tucked into a hollow of the old oak in the Hidden Grove. Thessa’s grandmother hid it there for her long ago. Its last line is the verse cut over the reliquary under Briarhollow’s chapel. She knew what lay there, and kept the secret all her life.',
      body: ['Thessa, my love. If you are reading this, my hedge has let you through, so you are grown.', 'Pick the starwort at dawn, never at dusk. My own gran told me the warm thing under our chapel keeps this grove green in every season.', 'Keep the fire low, and keep it lit.'],
      sign: 'Gran',
    },
    reward: { xp: 120, gold: 25, item: { rarity: 'rare' }, text: 'The hedge lets you through on the second try. Beyond it the grove is green, in a season when nothing else in the wood is, and starwort grows thick around an oak older than Briarhollow.' },
  },
  {
    id: 'alpha',
    name: 'The Alpha',
    giver: 'maren',
    auto: true,
    text: 'Every maddened beast in the Whisperwood follows one huge boar, the one the woodcutters call Grimtusk. The grieflight burns brightest in it. Its den is at the east end of the wood. Kill it, and the wood will calm.',
    objective: { kind: 'boss', boss: 'grimtusk', label: 'Defeat Grimtusk in the east of the Whisperwood' },
    after: ['into-the-wood'],
    reward: { xp: 260, gold: 60, text: 'Grimtusk dies with a scream the whole wood hears, and then the Whisperwood goes still. The violet fades from the eyes of every beast still alive in it. Briarhollow’s north road is safe, and the camp can look to the rest of the Vale.' },
  },
  {
    id: 'the-warden',
    name: 'The Crypt Warden',
    giver: 'maren',
    auto: true,
    text: 'The raiders have gone down into the Chapel Crypt. Its guardian, Warden Ossric, died three hundred years ago and still guards its gate. The raiders woke him, and he attacks anyone who comes near. Get past him.',
    objective: { kind: 'boss', boss: 'ossric', label: 'Defeat Warden Ossric in the Chapel Crypt' },
    after: ['briar-below'],
    reward: { xp: 380, gold: 90, text: 'Warden Ossric lies down in his own grave dust, and his gate swings open. Below it, the last stair goes down to the reliquary. Violet light shines up it, and you can hear the raiders’ picks.' },
  },
  {
    id: 'close-the-rift',
    name: 'The Reliquary',
    giver: 'maren',
    auto: true,
    text: 'Past Ossric is the reliquary. Elder Maren says a piece of the Starlight Crown has been hidden there for three hundred years. Morgrave, the scholar who leads the raiders, has reached it first. Stop him before he carries it away.',
    objective: { kind: 'boss', boss: 'morgrave', label: 'Stop Morgrave at the reliquary' },
    after: ['the-warden'],
    find: {
      name: 'Morgrave’s Journal',
      kind: 'page',
      about: 'A page from the journal on Morgrave’s body, found at the reliquary under Briarhollow’s chapel. Morgrave was a scholar of the Crown City, thrown out of its college. This page names who paid him, and what for.',
      body: [
        'The Herald came again tonight. A man in white with no face, only smooth skin where a face should be. He paid me in coin that weighs nothing and is always cold.',
        'He calls himself the Pale Herald. He serves the Hallow King, sealed in Duskspire for three hundred years.',
        'The wardens broke the Starlight Crown into seven sigils and hid them. One lies under Briarhollow’s chapel. I am to bring it to him.',
        'When all seven reach Duskspire, the King will open his gate, and the dead will come home.',
      ],
      sign: 'Morgrave',
    },
    reward: {
      xp: 700,
      gold: 200,
      tier: 1,
      perk: 'sigil-embers',
      text: 'Morgrave is dead, and the sigil he came for is safe. When Elyra touched it, it sank into her hand, and it burns in her now like a coal. Elyra holds one sigil of seven, and the Host holds none. Morgrave’s journal names who sent the raiders. It was the Pale Herald, who serves the Hallow King. (Heroic difficulty is open.)',
    },
  },
  {
    id: 'heroic',
    name: 'Heroic Deeds',
    giver: 'maren',
    text: 'The dead in the Chapel Crypt have risen again, stronger than before. Clear the crypt on Heroic difficulty.',
    objective: { kind: 'clear', region: 'crypt', tier: 1, label: 'Clear the Chapel Crypt on Heroic' },
    after: ['close-the-rift'],
    level: 12,
    reward: { xp: 1500, gold: 400, item: 'amulet-of-echoes', tier: 2, text: 'You cleared the crypt on Heroic. Mythic difficulty opens for you at level 60.' },
  },
  {
    id: 'mythic',
    name: 'Beneath the Bell',
    giver: 'maren',
    text: 'Mythic is the hardest difficulty there is. Clear the Chapel Crypt on Mythic.',
    objective: { kind: 'clear', region: 'crypt', tier: 2, label: 'Clear the Chapel Crypt on Mythic' },
    after: ['heroic'],
    // (Mythic is for heroes at the top level: the owner, "mythic and riftstones should be solely for max level
    // characters"; it was offered at 17)
    level: MAX_LEVEL,
    reward: { xp: 4000, gold: 1000, item: 'glitch-shard' },
  },
];
QUESTS.push(...STORY_QUESTS, ...ZONES.filter((z) => storyLive(z.region.id)).flatMap((z) => z.quests));

export const QUEST_DEFS: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// (a story event no quest plays any more, its quest gone with a retired land, is gone with it)
const PLAYED = new Set(QUESTS.flatMap((q) => [q.objective, ...(q.then ?? [])].flatMap((o) => (o.kind === 'event' ? [o.event] : []))));
for (const id of Object.keys(EVENTS)) if (!PLAYED.has(id)) delete EVENTS[id];

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
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['The Chancellor’s men bought a dozen good swords from me last spring. Now I know who they were for.'] },
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
      { when: { quest: 'heroic', state: 'active' }, lines: ['The dead in the crypt under Briarhollow have grown stronger since you cleared it.', 'Choose Heroic difficulty at the waystone when you travel to the Chapel Crypt.'] },
      { when: { quest: 'mythic', state: 'active' }, lines: ['Mythic is the hardest difficulty. Choose it at the waystone when you travel to the Chapel Crypt.'] },
      { lines: ['I can reset your talents for a little gold.', 'Open your talents and choose Reset to try another path.'] },
    ],
  },
  tamsin: {
    id: 'tamsin',
    name: 'Tamsin',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    pal: { y: '#c9473b', Y: '#8a2a20', b: '#a85a3a', B: '#7a3a20' },
    talk: [{ lines: ['Welcome to the Ember Hearth. I sell healing potions.', 'You heal quickly once nothing is hitting you. Save your potions for the middle of a fight.'] }],
  },
  odo: {
    id: 'odo',
    name: 'Odo',
    title: 'Armorer',
    sprite: 'smith',
    shop: 'armor',
    pal: { h: '#3a3a4a', H: '#5a5a6a', a: '#5a6078', A: '#3a4058', c: '#d8dce6' },
    talk: [{ lines: ['I sell helms, armor, gloves and boots, made for your level.', 'My stock changes every time you come back to the city.'] }],
  },
  wren: {
    id: 'wren',
    name: 'Imelda',
    title: 'Curio dealer',
    sprite: 'mystic',
    shop: 'curios',
    pal: { t: '#c9479b', T: '#8a2a6a', p: '#3a8a6a', P: '#24604a', o: '#ffe066', O: '#ffaa22' },
    talk: [
      { lines: ['I sell rings and amulets. Have a look.', 'Some of them change how a spell works. The gold lines on a piece say how.'] },
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
      { when: { quest: 'the-wall-burns', state: 'started' }, lines: ['The market is a muster ground now. Every sword in the city is going north to Highwall.', 'I still sell the Crown’s best gear for Sigil Marks and gold. Heroic and Mythic bosses drop more marks.'] },
      { lines: ['Every boss you defeat drops Sigil Marks. Bring them here.', 'I sell the Crown’s best gear for Sigil Marks and gold. Heroic and Mythic bosses drop more marks.'] },
    ],
  },
  pell: {
    id: 'pell',
    name: 'Pell',
    title: 'Farmer',
    sprite: 'villager',
    talk: [{ lines: ['My chickens got out again. If you see any, send them home.', 'Keep away from the brambles in the wood. The thorns are sharp.'] }],
  },
  'regent-elowen': {
    id: 'regent-elowen',
    name: 'Regent Elowen',
    title: 'Regent of Aster',
    sprite: 'elder',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['My uncle the King died in his sleep the week the bell rang. It was peaceful.', 'I will be crowned in the spring, with a plain crown. The sigils are spent. The dead are at rest, and Aster is safe because of you.'] },
      { when: { quest: 'into-vaelmoor', state: 'active' }, lines: ['Past the Gloam Gate lies Vaelmoor, the Hallow King’s dead kingdom. Nobody from Aster has been there in three hundred years.', 'Elyra has five sigils. Vosk carried the Stone north to the Hallow King. The last, the Sigil of Tides, is somewhere in Vaelmoor.', 'Find Brother Orren at Candlewick, and find that sigil before the Host does.'] },
      { when: { quest: 'gate-nyx-returns', state: 'active' }, lines: ['Mara sent word. Someone is walking to her camp under a white rag, asking for you by name.', 'Go back to the relief camp at Highwall and see who it is.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['Elyra is free, and five sigils are back in her hands. I read Brin’s letter three times.', 'Two gates are ours. The last stands at Duskspire, and the road to it runs through the dead kingdom. Go carefully.'] },
      { when: { quest: 'the-long-night-ends', state: 'done' }, lines: ['Highwall holds. It is the Hallow King’s first real defeat, and you won it.', 'That is one gate of three. Elyra is still a prisoner behind the next one, the Gloam Gate. Bring her home.'] },
      { when: { quest: 'the-wall-burns', state: 'active' }, lines: ['The Pale Herald took Elyra and her sigils at the Tear. We will get her back, but Highwall comes first.', 'Highwall is the first of the Three Gates. If it falls, the Host marches into Aster. Mara commands the relief. Go to Lord-Commander Varn at Highwall March.'] },
      { when: { quest: 'the-frozen-road', state: 'active' }, lines: ['The next place on the wardens’ map is the Vault of Rime, under the ice of Rimeheld in the far north-west. The Sigil of Frost is there.', 'Jarl Sigrun of Frostgate rules the roads to it. She owes the Crown nothing. Ask her for help, politely.'] },
      { when: { quest: 'the-sun-kings-tomb', state: 'active' }, lines: ['The Host has the wardens’ map too. The first place on it is the Sun King’s tomb in the Sunscorch, where the Sigil of the Sun lies.', 'Take the west road from my gate to the Oasis of Ras and find Oasis-keeper Sefu. Reach the tomb before the Host does.'] },
      { when: { quest: 'festival-the-champion', state: 'active' }, lines: ['Last night you stood between me and Maelis’s knives. Kneel. I name you Champion of Aster.', 'You speak with my voice now, anywhere in the kingdom. Every gate in Aster opens for you.', 'Take the wardens’ map, and the fastest horses in my stables. Maelis sold every place on it. Get there before the Host.'] },
      { when: { quest: 'festival-the-champion', state: 'done' }, lines: ['Maelis is hiding somewhere in the catacombs under the city. Finding him can wait.', 'The Host is already digging at the places on that map. Go west from my gate to the Sunscorch first.'] },
      { when: { quest: 'festival-the-catacombs', state: 'active' }, lines: ['Maelis ran to his house and down a stair under it. Find out where it goes.'] },
      { when: { quest: 'festival-the-lanterns', state: 'active' }, lines: ['Hesk brought me the ledgers, and the letters. My guards take Maelis at dawn, when the festival is over.', 'Tonight I light the star-lantern in the square, as I do every year. If I stayed away, he would know.', 'Walk the parade and watch the crowd.'] },
      { when: { quest: 'city-the-cellar', state: 'active' }, lines: ['Maelis dines with me tonight. I will keep him at my table as long as I can.', 'Whatever you find in his house, bring it to Hesk. He can read those books. I can’t.'] },
      { when: { quest: 'city-the-roads-office', state: 'active' }, lines: ['Amsel says the money went to the roads office, under Maelis’s seal. Go and see Roadwarden Hesk, quietly.'] },
      { when: { quest: 'city-the-treasury', state: 'active' }, lines: ['Maelis says the order is forged. I need proof before I can arrest my own Lord Chancellor.', 'The treasury paid for the Watch’s relief ten years ago. Ask Clerk Amsel at the Treasury where the money went.'] },
      { when: { quest: 'the-kings-design', state: 'active' }, lines: ['An order calling off the relief of the Ninefold Watch, ten years ago. In Maelis Crane’s handwriting.', 'Maelis taught me my letters. He sat with me when my mother died. Give me a moment.'] },
      { when: { quest: 'the-kings-design', state: 'done' }, lines: ['Follow the money, quietly. Maelis must not learn what you’re looking for.', 'Bring me proof, and I will act.'] },
      { lines: ['Welcome to Emberwick, the Crown City.', 'My uncle the King is ill, so I rule Aster in his name.'] },
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
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['Two of the knives from the square drank here the week before. They paid in grey coin. I threw it in the river.'] },
      { lines: ['People say the dead are walking in the north. I didn’t believe it.', 'Then a man came down from the north last week, white as milk, and he wouldn’t say what he saw.'] },
      { lines: ['Pull up a stool. Ale, stew and the best rumors in the city.', 'I keep potions behind the bar too.'] },
    ],
  },
  'guard-gate': {
    id: 'guard-gate',
    name: 'Sergeant Brask',
    title: 'East gate',
    sprite: 'villager',
    talk: [
      { when: { quest: 'festival-the-knives', state: 'done' }, lines: ['The city is locked down. Nobody goes in or out without a pass.', 'You don’t need one. Every guard knows your face now.'] },
      { lines: ['This is the east gate. The King’s Road runs east to Lantern Hill and the Ashen Barrows.', 'The south gate leads to the refugee road and the Amberfield. The west gate opens on the long road to the Sunscorch.'] },
    ],
  },
};
for (const z of ZONES) Object.assign(NPCS, z.npcs);
