import type { NpcDef, QuestDef } from '../types';

/**
 * Gullport's people and the Saltmarsh's quests. Captain Saltbeard's smugglers run Rift-touched powder
 * through Smugglers' Cove (the same powder Varric Blackhand was buying), the mirefin fishfolk have
 * come up out of the shoals, and something under the grotto's water is calling them: a priestess who
 * drowned with her chapel. Ines, Marla and Dorran have errands of their own. The story opens once the
 * hero is halfway through Thornvale's and has been to the coast.
 */
export const SALTMARSH_QUESTS: QuestDef[] = [
  /* -------------------------------------------------- the singing water */
  {
    id: 'chapel-on-the-road',
    name: 'The Drowned Chapel',
    giver: 'harbormaster-quill',
    text: 'Harbormaster Quill has a problem: the mirefin fishfolk have left their shoals and taken the Drowned Chapel on the coast road, west of Gullport. They have never come this far inland. Go and see what they’re doing there.',
    objective: { kind: 'explore', spot: 'drowned-chapel', label: 'Find the Drowned Chapel' },
    after: ['thieves-cant'],
    zone: 'saltmarsh',
    reward: { xp: 290, gold: 110 },
  },
  {
    id: 'fish-out-of-water',
    name: 'Fish Out of Water',
    giver: 'harbormaster-quill',
    text: 'The mirefins at the chapel were praying. To what, nobody knows, but it’s making them bold. Quill wants them back in the sea before they reach her docks. Thin them out.',
    objective: { kind: 'kill', region: 'saltmarsh', count: 12, enemies: ['mirefin-skirmisher', 'mirefin-spearthrower', 'mirefin-oracle'], label: 'Defeat mirefins' },
    after: ['chapel-on-the-road'],
    zone: 'saltmarsh',
    reward: { xp: 470, gold: 120 },
  },
  {
    id: 'rift-powder',
    name: 'Rift Powder',
    giver: 'harbormaster-quill',
    text: 'The smugglers’ bombers throw kegs that burn purple. That is Rift-touched powder, the same powder Varric Blackhand was buying. Quill wants five kegs as evidence, preferably not on fire.',
    objective: { kind: 'loot', region: 'saltmarsh', item: 'Powder Keg', from: ['smuggler-bomber'], chance: 0.4, count: 5, label: 'Take Powder Kegs from smuggler bombers' },
    after: ['fish-out-of-water'],
    zone: 'saltmarsh',
    reward: { xp: 360, gold: 128 },
  },
  {
    id: 'old-songs',
    name: 'Old Songs',
    giver: 'harbormaster-quill',
    text: 'The kegs are packed with ground glass that glows like the Rift. Quill has never seen the like, but Dorran has sailed this coast for fifty years and seen most things twice. Ask him. Bring patience.',
    objective: { kind: 'talk', npc: 'dorran', label: 'Ask Dorran about the glass' },
    after: ['rift-powder'],
    zone: 'saltmarsh',
    reward: { xp: 350, gold: 128 },
  },
  {
    id: 'tide-stones',
    name: 'The Singing Water',
    giver: 'dorran',
    text: 'Dorran’s granny sang of a priestess who drowned with her chapel and sings under the cove at low tide. The fishfolk hear her, and their oracles carry tide-stones that hum along. Bring three, and Dorran will show Quill he isn’t mad.',
    objective: { kind: 'loot', region: 'saltmarsh', item: 'Tide-Stone', from: ['mirefin-oracle'], chance: 0.5, count: 3, label: 'Take Tide-Stones from mirefin oracles' },
    after: ['old-songs'],
    zone: 'saltmarsh',
    reward: { xp: 400, gold: 136 },
  },
  {
    id: 'the-drowned-priestess',
    name: 'The Drowned Priestess',
    giver: 'harbormaster-quill',
    text: 'Every tide-stone hums toward Smugglers’ Cove, south-east of Gullport, and the grotto under it. Saltbeard’s smugglers dig Rift-glass out of the priestess’s water, and she is calling the fishfolk to take it back. Go down and silence her.',
    objective: { kind: 'boss', boss: 'the-drowned', label: 'Defeat the Drowned Priestess' },
    after: ['tide-stones'],
    zone: 'saltmarsh',
    level: 18,
    reward: { xp: 750, gold: 160, item: { rarity: 'rare' } },
  },
  {
    id: 'captain-saltbeard',
    name: 'Captain Saltbeard',
    giver: 'harbormaster-quill',
    text: 'With the priestess quiet, only Captain Saltbeard stands between Gullport and a coast full of Rift powder. He is at the back of the grotto, sitting on his kegs. End him, and Quill will give you the fastest legs in Gullport.',
    objective: { kind: 'boss', boss: 'saltbeard', label: 'Defeat Captain Saltbeard' },
    after: ['the-drowned-priestess'],
    zone: 'saltmarsh',
    reward: { xp: 1550, gold: 500, item: 'saltbeard-tricorn', perk: 'mount', text: 'Quill gives you a Gullport Strider, and you keep the captain’s hat.' },
  },
  /* ------------------------------------------------------ Ines's timber */
  {
    id: 'keel-timber',
    name: 'Good Oak',
    giver: 'ines',
    text: 'The Broken Keel ran aground on the north shore with a hull of seasoned oak. Ines wants it before the smugglers burn it for firewood. Find the wreck and mark it as hers. She has given you a pot of paint.',
    objective: { kind: 'explore', spot: 'broken-keel', label: 'Find the Broken Keel' },
    after: ['chapel-on-the-road'],
    zone: 'saltmarsh',
    level: 16,
    reward: { xp: 360, gold: 128 },
  },
  {
    id: 'crab-shells',
    name: 'Shell Game',
    giver: 'ines',
    text: 'Boiled and pressed, shore crab shell patches a hull better than pitch. Ines needs six pieces. The crabs on the south strand disagree.',
    objective: { kind: 'loot', region: 'saltmarsh', item: 'Crab Shell', from: ['shore-crab'], chance: 0.5, count: 6, label: 'Collect Crab Shells from shore crabs' },
    after: ['keel-timber'],
    zone: 'saltmarsh',
    reward: { xp: 390, gold: 136 },
  },
  {
    id: 'hunt-old-snapjaw',
    name: 'Old Snapjaw',
    giver: 'ines',
    text: 'Old Snapjaw is older than the harbor, and it has cracked two of Ines’s hulls. She wants its claws: one for a vise, one for you. Find it on Crabclaw Strand and take them the hard way. There isn’t an easy way.',
    objective: { kind: 'kill', region: 'saltmarsh', count: 1, enemies: ['old-snapjaw'], label: 'Defeat Old Snapjaw on Crabclaw Strand' },
    after: ['crab-shells'],
    zone: 'saltmarsh',
    level: 18,
    reward: { xp: 650, gold: 150, item: 'snapjaw-gauntlets', text: 'Ines works the claw into a pair of gauntlets.' },
  },
  /* ---------------------------------------------------- Marla's pillows */
  {
    id: 'harpy-feathers',
    name: 'Featherbeds',
    giver: 'marla',
    text: 'The pillows at Marla’s inn are as flat as flounders, and the guests have noticed. The harpies of Gull Cliffs, up the coast to the north-west, have feathers to spare. Eight should do.',
    objective: { kind: 'loot', region: 'saltmarsh', item: 'Harpy Feather', from: ['cliff-harpy'], chance: 0.6, count: 8, label: 'Pluck Harpy Feathers from cliff harpies' },
    after: ['chapel-on-the-road'],
    zone: 'saltmarsh',
    level: 15,
    reward: { xp: 330, gold: 120 },
  },
  {
    id: 'hunt-gullwing',
    name: 'Gullwing',
    giver: 'marla',
    text: 'While you were plucking her daughters, Gullwing came down and took the brass bell off Marla’s roof. Marla wants the bell back, and Gullwing to stop. Permanently.',
    objective: { kind: 'kill', region: 'saltmarsh', count: 1, enemies: ['gullwing'], label: 'Defeat Gullwing at the Gull Cliffs' },
    after: ['harpy-feathers'],
    zone: 'saltmarsh',
    level: 16,
    reward: { xp: 530, gold: 140, item: 'gullwing-plume', text: 'Marla threads the matriarch’s crest feather on a cord for you.' },
  },
  /* ------------------------------------------------------------ errands */
  {
    id: 'dorrans-apology',
    name: 'An Old Man’s Apology',
    giver: 'dorran',
    text: 'Dorran and his daughter Marla haven’t spoken since he told her the inn smells of fish. It does. That isn’t the point. He has written her an apology. Take it to her before he thinks better of it.',
    objective: { kind: 'talk', npc: 'marla', label: 'Bring Dorran’s apology to Marla' },
    after: ['chapel-on-the-road'],
    zone: 'saltmarsh',
    reward: { xp: 300, gold: 60 },
  },
  {
    id: 'mirefin-pearls',
    name: 'Pearls for the Patience',
    giver: 'dorran',
    text: 'Ines is building a little boat, and Dorran means to buy it and call it the Patience. Marla says over her dead body. Dorran says pearls. The mirefins string them on their spears.',
    objective: { kind: 'loot', region: 'saltmarsh', item: 'Mirefin Pearl', from: ['mirefin-skirmisher', 'mirefin-spearthrower'], chance: 0.3, count: 6, label: 'Collect Mirefin Pearls' },
    after: ['fish-out-of-water'],
    zone: 'saltmarsh',
    reward: { xp: 380, gold: 140 },
  },
  {
    id: 'saltreed-spiders',
    name: 'Stowaways',
    giver: 'harbormaster-quill',
    text: 'Thornback spiders rode the Thornvale carts down the coast road and nested in the Saltreed Marsh, south-west of the chapel. The reed-cutters won’t go out. Quill would like eight fewer spiders.',
    objective: { kind: 'kill', region: 'saltmarsh', count: 8, enemies: ['thornback-spider'], label: 'Defeat thornback spiders in the Saltreed' },
    after: ['chapel-on-the-road'],
    zone: 'saltmarsh',
    level: 15,
    reward: { xp: 340, gold: 120 },
  },
];

export const SALTMARSH_NPCS: Record<string, NpcDef> = {
  'harbormaster-quill': {
    id: 'harbormaster-quill',
    name: 'Harbormaster Quill',
    title: 'Harbormaster',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'east-to-gullport', state: 'active' },
        lines: ['Millbrook’s reeve sent you? About powder? Sit down. No, stand. You’ll be going out again.', 'Varric Blackhand was buying it. Captain Saltbeard is selling it. And I have a coast full of fishfolk who’ve forgotten to be afraid of us.'],
      },
      {
        when: { quest: 'chapel-on-the-road', state: 'active' },
        lines: ['The mirefins took the old chapel on the coast road, west of here. Fishfolk don’t come inland. Fishfolk don’t go to church.', 'See what they’re doing. Then come back and tell me it’s nothing.'],
      },
      {
        when: { quest: 'fish-out-of-water', state: 'active' },
        lines: ['Praying? The fish were praying? Wonderful. Faith makes them brave, and brave makes them hungry.', 'Thin them out before they reach my docks.'],
      },
      {
        when: { quest: 'rift-powder', state: 'active' },
        lines: ['The bombers’ kegs burn purple. Honest powder doesn’t burn purple.', 'Five kegs, for evidence. Unexploded if you can manage it. Exploded kegs make poor evidence.'],
      },
      {
        when: { quest: 'old-songs', state: 'active' },
        lines: ['Ground glass that glows like the Rift. I’ve never seen it. Dorran has seen everything twice, and will tell you about it three times.', 'He’s on the pier. Bring patience.'],
      },
      {
        when: { quest: 'the-drowned-priestess', state: 'active' },
        lines: ['A drowned priestess singing under my cove. Ten years ago I’d have laughed. Then I saw the glass.', 'The grotto is under Smugglers’ Cove, south-east of town. Silence her.'],
      },
      {
        when: { quest: 'captain-saltbeard', state: 'active' },
        lines: ['Saltbeard is at the back of the grotto, sitting on his kegs like a hen on eggs.', 'Bring him down and the coast is ours again. There’s a strider in my stable with your name on it. Gullport’s fastest legs.'],
      },
      {
        when: { quest: 'saltreed-spiders', state: 'active' },
        lines: ['Spiders. From Thornvale. On the carts. Nobody checks the carts.', 'The Saltreed is south-west of the chapel. Eight fewer spiders would be eight better.'],
      },
      { when: { quest: 'captain-saltbeard', state: 'done' }, lines: ['The cove is quiet and the shoals are just shoals again. I have nothing to complain about. It’s unsettling.'] },
      { lines: ['Gullport. Ships in, ships out, and a toll on both.', 'If you’ve come about the powder, you’re late. If you’ve come about the fishfolk, you’re very late.'] },
    ],
  },
  marla: {
    id: 'marla',
    name: 'Marla',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Salt Lantern',
    talk: [
      {
        when: { quest: 'dorrans-apology', state: 'active' },
        lines: ['A letter? From my father? He can’t spell “sorry”. …He spelled it three ways. One of them’s right.', 'Tell him the inn still smells of fish. And tell him supper is at six.'],
      },
      {
        when: { quest: 'hunt-gullwing', state: 'active' },
        lines: ['Gullwing took the bell off my roof! The brass one! I ring it for supper!', 'She nests on the Gull Cliffs and dives twice as often as her daughters. So duck twice as often.'],
      },
      { when: { quest: 'harpy-feathers', state: 'active' }, lines: ['My pillows are flat as flounders and twice as damp. The harpies on the Gull Cliffs have feathers to spare.', 'Eight should do. Don’t bring the harpy.'] },
      { when: { quest: 'hunt-gullwing', state: 'done' }, lines: ['The bell is back on the roof. The guests hate it. I love it.'] },
      { lines: ['The Lantern. Potions, a warm bed, and soup that is mostly fish.', 'Rest before you go out. The coast doesn’t forgive.'] },
    ],
  },
  dorran: {
    id: 'dorran',
    name: 'Dorran',
    title: 'Old sailor',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'old-songs', state: 'active' },
        lines: [
          'Glass that glows? Aye. My granny sang of it.',
          'A chapel by the sea, a priestess in it, and the sea took both. She sings under the cove at low tide, and the fishfolk hear her.',
          'I believed Granny. Then I grew up. Now I’m old, and I believe her again.',
        ],
      },
      { when: { quest: 'tide-stones', state: 'active' }, lines: ['The oracles carry tide-stones. They hum when she sings. Bring me three and I’ll show Quill I’m not mad.', 'I am a little mad. But not about this.'] },
      {
        when: { quest: 'dorrans-apology', state: 'active' },
        lines: ['I told Marla her inn smells of fish. It does. That’s not the point, she says.', 'Take her this. I’ve spelled “sorry” three ways. One of them must be right.'],
      },
      {
        when: { quest: 'mirefin-pearls', state: 'active' },
        lines: ['Ines is building a little boat. I’ll call her the Patience. Marla says over her dead body.', 'I say pearls. The fishfolk string them on their spears. Six should do it.'],
      },
      { when: { quest: 'the-drowned-priestess', state: 'done' }, lines: ['She’s quiet, then. I’ll miss the singing. Don’t tell Quill.'] },
      { lines: ['Fifty years on this coast. Seen everything twice.', 'Want a song? No? Most don’t.'] },
    ],
  },
  ines: {
    id: 'ines',
    name: 'Ines',
    title: 'Shipwright',
    sprite: 'villager',
    shop: 'weapons',
    shopName: 'Keel & Cutlass',
    talk: [
      {
        when: { quest: 'keel-timber', state: 'active' },
        lines: ['The Broken Keel ran aground on the north shore. Her hull is seasoned oak, and the smugglers are burning it to keep warm.', 'Find her and paint my mark on her. Don’t paint yourself.'],
      },
      {
        when: { quest: 'crab-shells', state: 'active' },
        lines: ['Shore crab shell, boiled and pressed, patches a hull better than pitch. I need six pieces.', 'The crabs on the south strand will argue. Argue back.'],
      },
      {
        when: { quest: 'hunt-old-snapjaw', state: 'active' },
        lines: ['Old Snapjaw cracked two of my hulls. Two! I want its claws.', 'Crabclaw Strand, south of town. Crack its shell with heavy hits, or cook it.'],
      },
      { when: { quest: 'hunt-old-snapjaw', state: 'done' }, lines: ['That claw makes the best vise on the coast. I squeeze it sometimes, just to remember.'] },
      { lines: ['I build ships. Since the smugglers came, I sharpen things too. Have a look.'] },
    ],
  },
};
