import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Frostgate's people and the quests of Rimeheld Tundra (see WORLD.md). The Sigil of Frost sleeps in the
 * Rimeheld Vault under the ice, and the Host has come for it: its dead northmen walk the sledge
 * roads, and Jarl Hrimfang of the frost giants, paid in ash-gold, has broken the Vault Door open and
 * woken the Rime Wyrm below. The main chain runs from the Sledge Camp through the Giants' Hearth to the
 * Vault Door and down into the vault, where Jarl Ingrith, the warden who hid the sigil, gives it up.
 * Brewer Olav wants his mead back from the yetis. Main chain first. Written to DIALOGUE_STYLE.md (plain,
 * direct, no punchlines).
 */
export const RIMEHELD_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-frozen-road',
    name: 'The Frozen Road',
    giver: 'lady-silvaine',
    auto: true,
    text: 'Elyra carries three sigils now, and the Host still has one. Two places are left on the wardens’ map. The next is the Rimeheld Vault, under the ice of Rimeheld, where a warden hid the Sigil of Frost. Take the west road out of the Glimmerwood and ask Jarl Sigrun of Frostgate for help.',
    objective: { kind: 'talk', npc: 'jarl-sigrun', label: 'Talk to Jarl Sigrun in Frostgate' },
    after: ['the-clans-decide'],
    level: 33,
    reward: { xp: 800, gold: 280 },
  },
  /* -------------------------------------------------------- the Sigil of Frost */
  {
    id: 'the-last-sledges',
    name: 'The Last Sledges',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'Three of Frostgate’s sledge trains went out to the farms last week, and none came back. The last fire anyone saw was at the Sledge Camp, north-east of Frostgate. Some drivers may still be alive there, hiding from the Host’s dead. Bring them home.',
    objective: { kind: 'event', event: 'rime-sledges', label: 'Bring the sledge drivers home to Frostgate' },
    after: ['the-frozen-road'],
    zone: 'rimeheld',
    reward: { xp: 1000, gold: 290, text: 'Three sledge trains went out, and three drivers came home alive. They all say the dead were waiting for them at the Sledge Camp. Someone told the Host where the sledges stop for the night.' },
  },
  {
    id: 'the-giants-hearth',
    name: 'The Giants’ Hearth',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'Sigrun’s scouts have seen frost giants walking with the Host’s dead. For two hundred years, Jarl Hrimfang of the frost giants has kept a treaty with Frostgate. Go to his hall, the Giants’ Hearth, north-west of Frostgate, and find out if he has broken it.',
    objective: { kind: 'explore', spot: 'giants-hearth', label: 'Search the Giants’ Hearth, north-west of Frostgate' },
    find: {
      name: 'A Rune-Stone from the Vault Door',
      kind: 'relic',
      about: 'Found by the fire in Hrimfang’s hall. It was hacked out of the Vault Door with a giant’s axe. The wardens’ runes on it frost over when Elyra touches them.',
      body: ['Hold still, and hold on.'],
    },
    after: ['the-last-sledges'],
    zone: 'rimeheld',
    level: 34,
    reward: { xp: 1100, gold: 310, text: 'Hrimfang isn’t there, but his giants are, and they wear neck rings of ash-gold, the Herald’s grey coin. Hrimfang has broken a treaty two hundred years old. The rune-stone by his fire shows what he sold the Host: the way into the wardens’ vault.' },
  },
  {
    id: 'the-vault-door',
    name: 'The Vault Door',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'Hrimfang has sold the wardens’ vault to the Host. The way down is the Vault Door, in the ice in the far west of the tundra. Nobody has opened it in three hundred years, but the rune-stone at the Hearth was cut from it this week. Go and see if it is open.',
    objective: { kind: 'explore', spot: 'vault-door', label: 'Find the Vault Door in the far west' },
    find: {
      name: 'Hrimfang’s Tally',
      kind: 'note',
      about: 'A board of tally marks nailed up inside the opened Vault Door, in a giant’s heavy hand. Hrimfang kept count of what the Herald paid him. He sold Frostgate’s sledge drivers as well as the vault.',
      body: ['For the sledge roads, where they stop and when: forty grey coins.', 'For the Vault Door: three hundred grey coins.', 'For my huscarls to dig: one grey coin a day, each.', 'For the warden in the ice, when we reach her: the rest.'],
      sign: 'Hrimfang, Jarl of the Frost Giants',
    },
    after: ['the-giants-hearth'],
    zone: 'rimeheld',
    level: 36,
    reward: { xp: 1200, gold: 350, text: 'The Vault Door stands open. Picks ring somewhere far below, and cold air pours up the stair. Hrimfang has gone down to dig out the Sigil of Frost himself.' },
  },
  {
    id: 'the-traitor-jarl',
    name: 'The Traitor Jarl',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'The Vault Door is open. Hrimfang has gone down into the Rimeheld Vault with his giants and the Host’s dead to dig out the Sigil of Frost. Go into the vault through the Vault Door and stop him before he reaches it.',
    objective: { kind: 'boss', boss: 'jarl-hrimfang', label: 'Defeat Jarl Hrimfang in the Rimeheld Vault' },
    after: ['the-vault-door'],
    zone: 'rimeheld',
    level: 36,
    reward: { xp: 3000, gold: 600, item: { rarity: 'rare' }, text: 'Hrimfang falls to his knees and gives up, and ash-gold spills out of his coat. Sigrun will spare his life and banish him from the north. But deeper in the vault, something huge has woken up, and the ice is groaning.' },
  },
  {
    id: 'the-vault-of-rime',
    name: 'The Vault of Rime',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'Hrimfang’s digging woke the Rime Wyrm, the beast the wardens left to guard the Sigil of Frost. It is breaking the ice from below. If it keeps going, the frozen lakes under Frostgate will crack. Go down to the bottom of the Rimeheld Vault and kill it.',
    objective: { kind: 'boss', boss: 'the-rime-wyrm', label: 'Defeat the Rime Wyrm at the bottom of the Rimeheld Vault' },
    after: ['the-traitor-jarl'],
    zone: 'rimeheld',
    level: 37,
    reward: {
      xp: 5200,
      gold: 1150,
      item: 'rimehelm-of-the-jarls',
      perk: 'sigil-frost',
      text: 'Behind the dead wyrm, Jarl Ingrith stood frozen in the ice with the Sigil of Frost in her hands. She hid it here three hundred years ago and never let go. When Elyra took it, the ice let Ingrith go at last, and she died in peace. Elyra carries four sigils now. Sigrun gives you the Rimehelm her mother wore and pledges Frostgate’s huscarls to the Regent.',
    },
  },
  /* ------------------------------------------------------- Olav's mead */
  {
    id: 'the-mead-thieves',
    name: 'The Mead Thieves',
    giver: 'brewer-olav',
    text: 'Brewer Olav makes his mead from snow-honey. This winter, yetis came down from Yeti Hollow, south-east of Frostgate, and broke into his cellar twice. Olav wants them driven off. Defeat six yetis.',
    objective: { kind: 'kill', region: 'rimeheld', count: 6, enemies: ['yeti'], label: 'Defeat yetis near Frostgate' },
    after: ['the-frozen-road'],
    zone: 'rimeheld',
    level: 34,
    reward: { xp: 1200, gold: 300 },
  },
  {
    id: 'the-stolen-casks',
    name: 'The Stolen Casks',
    giver: 'brewer-olav',
    text: 'The yetis didn’t drink Olav’s mead in the cellar. They carried the casks off toward Yeti Hollow, south-east of Frostgate. Olav wants them back before the yetis work out how to open them. Take four casks from the yetis that carry them.',
    objective: { kind: 'loot', region: 'rimeheld', item: 'Stolen Mead Cask', from: ['yeti', 'grumbleback'], chance: 0.4, count: 4, label: 'Take back Olav’s mead casks from yetis' },
    after: ['the-mead-thieves'],
    zone: 'rimeheld',
    level: 35,
    reward: { xp: 1300, gold: 320 },
  },
  {
    id: 'enough-is-enough',
    name: 'Enough Is Enough',
    giver: 'brewer-olav',
    text: 'All four casks came back empty, with their stoppers bitten off. Olav knows which yeti did it: Grumbleback, the great old yeti who has raided Frostgate’s honey since Olav’s father ran the Mead-Hall. Defeat Grumbleback in Yeti Hollow, south-east of Frostgate.',
    objective: { kind: 'kill', region: 'rimeheld', count: 1, enemies: ['grumbleback'], label: 'Defeat Grumbleback in Yeti Hollow' },
    after: ['the-stolen-casks'],
    zone: 'rimeheld',
    level: 36,
    reward: { xp: 2200, gold: 520, item: 'olavs-bottomless-horn', text: 'Olav gives you his grandfather’s drinking horn, the pride of the Mead-Hall. He says it has never once been empty.' },
  },
  /* ---------------------------------------------------- Ylva's white wolf */
  /* ------------------------------------------------------- Hild's runes */
];

export const RIMEHELD_NPCS: Record<string, NpcDef> = {
  'jarl-sigrun': {
    id: 'jarl-sigrun',
    name: 'Jarl Sigrun',
    title: 'Jarl of Frostgate',
    sprite: 'villager',
    // (the latest step of her chain comes first: talk takes the first line that matches)
    talk: [
      {
        when: { quest: 'where-the-rift-bleeds', state: 'active' },
        lines: ['The last place on your map is the Tear, in the Shattered Vale, south of here. Magister Quell watches it from Shardwatch.', 'One more thing. A letter in grey ink came to my gate for Nyx. She read it by the fire and burned it. Keep an eye on her.'],
      },
      {
        when: { quest: 'the-vault-of-rime', state: 'done' },
        lines: ['The ice is quiet again, and Frostgate is safe. Thank you.', 'When the Regent marches north, my huscarls will march with her.'],
      },
      {
        when: { quest: 'the-vault-of-rime', state: 'active' },
        lines: ['Hrimfang is beaten. But the ice under the lakes is cracking from below.', 'His digging woke the Rime Wyrm, the beast the wardens left to guard the sigil. Kill it, or the lakes will break under Frostgate.'],
      },
      {
        when: { quest: 'the-traitor-jarl', state: 'active' },
        lines: ['So the Vault Door is open, and Hrimfang is down there now.', 'Go into the vault and stop him before he digs out the sigil. Tell him Sigrun sent you.'],
      },
      {
        when: { quest: 'the-vault-door', state: 'active' },
        lines: ['Hrimfang sold the wardens’ vault for ash-gold, after two hundred years of peace between us.', 'The Vault Door is in the ice, in the far west. That rune-stone was cut from it. Go and see if it’s open.'],
      },
      {
        when: { quest: 'the-giants-hearth', state: 'active' },
        lines: ['The drivers say the dead knew where the sledges stop for the night. Someone told them.', 'My scouts have seen frost giants walking with the dead. Jarl Hrimfang keeps his hall at the Giants’ Hearth, north-west of here. Find out if he has broken our treaty.'],
      },
      {
        when: { quest: 'the-last-sledges', state: 'done' },
        lines: ['Three drivers came home alive. They all say the dead were waiting for them at the camp.'],
      },
      {
        when: { quest: 'the-last-sledges', state: 'active' },
        lines: ['Three sledge trains went out last week, and none came back. Only the dogs came home.', 'The trains stop for the night at the Sledge Camp, north-east of here. If anyone is still alive out there, bring them home.'],
      },
      {
        when: { quest: 'the-frozen-road', state: 'active' },
        lines: ['I’m Sigrun, Jarl of Frostgate. I keep the roads across the tundra, and the way to the Rimeheld Vault.', 'Help me clear the Host off my roads first. Then I’ll help you reach the vault.'],
      },
      { lines: ['This is Frostgate. We keep the roads open across the tundra, even in winter.', 'If you’re cold, Olav’s Mead-Hall has a fire.'] },
    ],
  },
  'brewer-olav': {
    id: 'brewer-olav',
    name: 'Brewer Olav',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Mead-Hall',
    talk: [
      {
        when: { quest: 'the-mead-thieves', state: 'active' },
        lines: ['Yetis broke into my cellar twice this winter! They scared my brother half to death.', 'They come down from Yeti Hollow, south-east of town. Drive them off. Six should do it.'],
      },
      {
        when: { quest: 'the-stolen-casks', state: 'active' },
        lines: ['They didn’t drink my mead. They carried the casks off to Yeti Hollow.', 'Bring my casks back before the yetis work out how to open them.'],
      },
      {
        when: { quest: 'enough-is-enough', state: 'active' },
        lines: ['All four casks are empty. The stoppers are bitten clean off.', 'Only Grumbleback has jaws like that. He raided my father’s cellar before he ever raided mine.', 'He lives in Yeti Hollow, south-east of town. Stop him for good.'],
      },
      { when: { quest: 'enough-is-enough', state: 'done' }, lines: ['My cellar is full, and nothing is scratching at the door. Your drinks are free today.'] },
      { when: { quest: 'the-vault-of-rime', state: 'done' }, lines: ['You killed the Rime Wyrm! You drink free in the Mead-Hall, any time you like.'] },
      { lines: ['Welcome to the Mead-Hall! Mead for the cold, potions for the road, and a fire for everyone.', 'I make my mead from snow-honey. It warms you better than any coat.'] },
    ],
  },
  'runecarver-hild': {
    id: 'runecarver-hild',
    name: 'Runecarver Hild',
    title: 'Runecarver',
    sprite: 'villager',
    shop: 'weapons',
    shopName: 'Hild’s Runed Steel',
    talk: [
      { lines: ['Welcome to Hild’s Runed Steel. Every blade here has a rune cut into it.', 'The runes keep the edge sharp in the cold.'] },
    ],
  },
  'huntress-ylva': {
    id: 'huntress-ylva',
    name: 'Huntress Ylva',
    title: 'Huntress',
    sprite: 'villager',
    talk: [
      { lines: ['Stay on the roads after dark. The wolves hunt everywhere else.', 'Old Whitefang’s pack lives at Whitefang’s Den, south-west of town. Don’t go there unless you’re ready for a fight.'] },
    ],
  },
};

/** The sledge drivers led home through the snow, the Host's dead northmen after them. */
export const RIMEHELD_EVENTS: Record<string, StoryEventDef> = {
  'rime-sledges': {
    id: 'rime-sledges',
    region: 'rimeheld',
    kind: 'rescue',
    at: 'sledge-fire',
    radius: 9,
    level: 34,
    rescue: { pets: ['sledge-driver', 'sledge-driver', 'sledge-driver'], at: 'sledge-fire', to: 'frostgate-square' },
    banner: 'The sledge road',
    start: [
      { who: 'sledge-driver', text: 'Someone living! Get us out of here before the dead come back!' },
      { who: 'sledge-driver', text: 'They knew where we stop for the night. They were waiting for us at the fire.' },
    ],
    waves: [
      { enemies: ['legion-huscarl', 'legion-spearman', 'legion-spearman'], from: ['sledge-ne', 'sledge-w'] },
      { enemies: ['legion-huscarl', 'legion-huscarl', 'ice-wolf', 'ice-wolf'], from: ['sledge-w', 'sledge-ne'], barks: [{ who: 'sledge-driver', text: 'More of them from the west! Keep them off us!' }] },
    ],
    end: [{ who: 'sledge-driver', text: 'That’s Frostgate’s gate. We’re home.' }],
    retry: [{ who: 'sledge-driver', text: 'Get up! They’re coming back for us!' }],
  },
};
