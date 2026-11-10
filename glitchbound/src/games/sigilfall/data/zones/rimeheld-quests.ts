import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Frostgate's people and the quests of Rimeheld Tundra (see WORLD.md). The Sigil of Frost sleeps in the
 * Rimeheld Vault under the ice, and the Host has come for it: its dead northmen walk the sledge
 * roads, and Jarl Hrimfang of the frost giants, paid in ash-gold, has broken the Vault Door open and
 * woken the Rime Wyrm below. The main chain runs from the Sledge Camp through the Giants' Hearth and
 * Hild's reading of the giants' torcs to the Vault Door and down into the vault. Brewer Olav wants his
 * mead back from the yetis, Huntress Ylva wants Old Whitefang's pelt, and Runecarver Hild wants to know
 * who is rewriting the Frozen Shrine. Main chain first.
 */
export const RIMEHELD_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-frozen-road',
    name: 'The Frozen Road',
    giver: 'lady-silvaine',
    auto: true,
    text: 'The third place on the wardens’ map is the Vault of Rime, far in the frozen north beyond the Glimmerwood, where a warden-jarl had herself frozen into the ice with the Sigil of Frost three hundred years ago. Jarl Sigrun of Frostgate keeps the tundra. Take the cold road west out of the Glimmerwood and find her before the Host finds the vault.',
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
    text: 'Frostgate lives on what its sledges bring in from the outlying steads. Three sledge-trains went out last week; none came back, and the dogs that did would not say why. The last fire anyone saw was at the Sledge Camp, north-east of Frostgate, where the trains stop for the night. Someone is still alive out there, under the overturned sledges, and the dead northmen who put the fire out are waiting for them to move.',
    objective: { kind: 'event', event: 'rime-sledges', label: 'Bring the sledge drivers home to Frostgate' },
    after: ['the-frozen-road'],
    zone: 'rimeheld',
    reward: { xp: 1000, gold: 290 },
  },
  {
    id: 'the-giants-hearth',
    name: 'The Giants’ Hearth',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'The dead do not march alone. Sigrun’s scouts have seen frost giants walking with them, and frost giants walk with nobody. Jarl Hrimfang of the giants keeps his fire at the Giants’ Hearth, north-west of Frostgate, and has kept a treaty with Frostgate for two hundred years. Go and see whether he still remembers it.',
    objective: { kind: 'explore', spot: 'giants-hearth', label: 'Look over the Giants’ Hearth' },
    after: ['the-last-sledges'],
    zone: 'rimeheld',
    level: 34,
    reward: { xp: 1100, gold: 310, text: 'Hrimfang isn’t at his fire. His giants are, wearing torcs of grey gold that weigh nothing, and at the fire’s edge a rune-stone from the vault door, cut out and carried here. He has sold the vault.' },
  },
  {
    id: 'the-vault-door',
    name: 'The Vault Door',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'So Hrimfang has sold the Sigil-wardens’ vault for a sack of grey coin. The way down is the Vault Door, in the ice of the far west of the tundra, and nobody has opened it in three hundred years. Sigrun fears somebody opened it this week. Go and see, and count how many of them are still standing outside.',
    objective: { kind: 'explore', spot: 'vault-door', label: 'Find the Vault Door' },
    after: ['the-giants-hearth'],
    zone: 'rimeheld',
    level: 36,
    reward: { xp: 1200, gold: 350 },
  },
  {
    id: 'the-traitor-jarl',
    name: 'The Traitor Jarl',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'The Door stands open and the cold pours out of it. Hrimfang has gone down with his giants and the Host’s dead to dig out the Sigil of Frost, and he has woken something down there doing it. Go into the Rimeheld Vault through the Vault Door, in the far west, and settle the treaty with Jarl Hrimfang. Sigrun says to tell him who sent you. She says to tell him twice.',
    objective: { kind: 'boss', boss: 'jarl-hrimfang', label: 'Defeat Jarl Hrimfang in the Rimeheld Vault' },
    after: ['the-vault-door'],
    zone: 'rimeheld',
    level: 37,
    reward: { xp: 3000, gold: 600, item: { rarity: 'rare' }, text: 'Hrimfang yields on his knees in the ice with the ash-gold spilling out of his coat. Sigrun could hang him and split the jarls in two, or let him live and swallow it. She lets him live. Exiled, unarmed, walking south with nothing. She does not watch him go.' },
  },
  {
    id: 'the-vault-of-rime',
    name: 'The Vault of Rime',
    auto: true,
    giver: 'jarl-sigrun',
    text: 'Below Hrimfang’s dig, at the bottom of the vault, the Sigil-wardens left a guardian for the Sigil of Frost: the Rime Wyrm, asleep on its hoard for three hundred years. Hrimfang’s picks woke it and it woke mad, and now it breaks the ice from beneath. If it is not stopped, the lakes of Rimeheld will go out from under Frostgate. Go down to the bottom of the Rimeheld Vault and end the Rime Wyrm.',
    objective: { kind: 'boss', boss: 'the-rime-wyrm', label: 'Defeat the Rime Wyrm in the Rimeheld Vault' },
    after: ['the-traitor-jarl'],
    zone: 'rimeheld',
    level: 38,
    reward: {
      xp: 5200,
      gold: 1150,
      item: 'rimehelm-of-the-jarls',
      perk: 'sigil-frost',
      text: 'In the wyrm’s hoard, frozen into the ice with it, the warden-jarl Ingrith the Unthawed still holds the Sigil of Frost against her heart. The ice lets go of her when Elyra takes it. It showed her eight riders at a border, she says, and seven of them riding away. Afterwards she can’t remember her own birthday. Sigrun gives you the Rimehelm her mother wore: Frostgate’s huscarls will march when the Regent does.',
    },
  },
  /* ------------------------------------------------------- Olav's mead */
  {
    id: 'the-mead-thieves',
    name: 'The Mead Thieves',
    giver: 'brewer-olav',
    text: 'Brewer Olav makes the best mead north of anywhere, out of snow-honey and patience. This winter the yetis came down from Yeti Hollow, south-east of Frostgate, smelled it, and stayed. They have broken into his cellar twice and his brother once. Olav would like them discouraged. Six should make the point.',
    objective: { kind: 'kill', region: 'rimeheld', count: 6, enemies: ['yeti'], label: 'Discourage the yetis' },
    after: ['the-frozen-road'],
    zone: 'rimeheld',
    level: 34,
    reward: { xp: 1200, gold: 300 },
  },
  {
    id: 'the-stolen-casks',
    name: 'The Stolen Casks',
    giver: 'brewer-olav',
    text: 'The yetis did not drink the mead in the cellar. They carried it off, a cask under each arm, back toward Yeti Hollow south-east of town. Olav wants his casks back. The yetis cannot work the bungs yet, and he would like to get there before they learn. Take the stolen casks from the yetis that have them.',
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
    text: 'Four casks back, every one of them empty and every bung bitten off. Only one yeti on the tundra has jaws like that: Grumbleback, the great old yeti of Yeti Hollow, south-east of Frostgate, who has raided the town’s honey since Olav’s father was the brewer. Olav has decided enough is enough. He decided it loudly, and he would like you to go and decide it too.',
    objective: { kind: 'kill', region: 'rimeheld', count: 1, enemies: ['grumbleback'], label: 'Defeat Grumbleback in Yeti Hollow' },
    after: ['the-stolen-casks'],
    zone: 'rimeheld',
    level: 36,
    reward: { xp: 2200, gold: 520, item: 'olavs-bottomless-horn', text: 'Olav fills his grandfather’s drinking horn for you and swears it has never once been empty. You check. It isn’t.' },
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
    talk: [
      {
        when: { quest: 'the-frozen-road', state: 'active' },
        lines: ['Emberwick sends one hero for the Sigil of Frost. Generous of them.', 'I am Sigrun. Frostgate is mine, and so is the road to the vault, and so is the cold. You will want a better coat.'],
      },
      {
        when: { quest: 'the-last-sledges', state: 'active' },
        lines: ['Three sledge-trains out, none back. The dogs came home. Dogs do not lie, but they do not talk either.', 'The trains stop for the night at the Sledge Camp, north-east of here. If anyone is alive under those sledges, bring them home. All of them.'],
      },
      {
        when: { quest: 'the-last-sledges', state: 'done' },
        lines: ['Eleven drivers home, and every one of them says the same thing: the dead knew the sledge roads. They knew where the trains stop.', 'Somebody in Frostgate told them. Somebody who wears a torc.'],
      },
      {
        when: { quest: 'the-giants-hearth', state: 'active' },
        lines: ['Giants walking with the dead. Giants do not walk with anybody. They barely walk with each other.', 'Hrimfang keeps his fire at the Giants’ Hearth, north-west of here. Two hundred years of treaty. Ask him if he remembers.'],
      },
      {
        when: { quest: 'the-vault-door', state: 'active' },
        lines: ['Sold. The wardens’ vault, for a sack of grey coin. I knew Hrimfang was greedy. I did not know he was cheap.', 'The Vault Door is in the ice, far west. Nobody has opened it in three hundred years. Go and see who opened it this week.'],
      },
      {
        when: { quest: 'the-traitor-jarl', state: 'active' },
        lines: ['Open. Of course it is open.', 'Go down. Find Hrimfang. Tell him who sent you. Tell him twice. Giants are slow.'],
      },
      {
        when: { quest: 'the-vault-of-rime', state: 'active' },
        lines: ['Hrimfang is done. Good. But the ice is groaning under the lakes, and it groans from below.', 'The wardens left a guardian on the sigil: the Rime Wyrm. Hrimfang woke it. Put it back to sleep, the long way.'],
      },
      {
        when: { quest: 'the-vault-of-rime', state: 'done' },
        lines: ['The ice is quiet. The lakes are where I left them. You did that.', 'Frostgate owes Emberwick a hero now. When you need one, send word. We will come slowly, through the snow, and we will come.'],
      },
      { lines: ['Frostgate. We keep the road, the cold keeps us. It is a fair trade most winters.', 'If you are cold, drink something. If you are still cold, drink something else. Olav will advise you.'] },
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
        lines: ['Yetis! In my cellar! Twice! And my brother once, but he was asking for it.', 'They come down from Yeti Hollow, south-east of town. Discourage six. Discourage them hard.'],
      },
      {
        when: { quest: 'the-stolen-casks', state: 'active' },
        lines: ['They did not drink it. They took it. A cask under each arm, home to the Hollow, like it was theirs.', 'Get my casks back before they work out the bungs. Yetis are slow to learn, but they are very motivated.'],
      },
      {
        when: { quest: 'enough-is-enough', state: 'active' },
        lines: ['Empty. All four. Bungs bitten clean off.', 'That is Grumbleback. He raided my father’s cellar, and my grandfather’s, and now mine. Yeti Hollow, south-east. Enough is enough!', 'I said it loudly. Now you go and say it louder.'],
      },
      { when: { quest: 'enough-is-enough', state: 'done' }, lines: ['The cellar is full and the door is shut and nothing is scratching at it. First round is on the house. Every round is on the house. For you. Today.'] },
      { when: { quest: 'the-vault-of-rime', state: 'done' }, lines: ['A hero who killed a wyrm drinks free in the Mead-Hall. Forever. Within reason. Mostly within reason.'] },
      { lines: ['The Mead-Hall! Mead for the cold, potions for the brave, a fire for everybody.', 'Snow-honey, patience and a secret. The secret is more honey.'] },
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
      { lines: ['Hild’s Runed Steel. Every blade with a rune on it. Most of the runes mean “sharp”. One means “mine”.', 'Do not touch the grindstone. It bites.'] },
    ],
  },
  'huntress-ylva': {
    id: 'huntress-ylva',
    name: 'Huntress Ylva',
    title: 'Huntress',
    sprite: 'villager',
    talk: [
      { lines: ['Keep to the roads after dark. Wolves keep to everything else.', 'Snow tells you everything, if you can read it. Mostly it says “wolves”.'] },
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
      { who: 'sledge-driver', text: 'Is that a living voice? Gods. Gods, it is. Get us out of here before they come back.' },
      { who: 'sledge-driver', text: 'They knew where we would stop. They were waiting at the fire.' },
    ],
    waves: [
      { enemies: ['legion-huscarl', 'legion-spearman', 'legion-spearman'], from: ['sledge-ne', 'sledge-w'] },
      { enemies: ['legion-huscarl', 'legion-huscarl', 'ice-wolf', 'ice-wolf'], from: ['sledge-w', 'sledge-ne'], barks: [{ who: 'sledge-driver', text: 'That one drove the Hollin train. He waved at me last winter. Don’t let him wave.' }] },
    ],
    end: [{ who: 'sledge-driver', text: 'The gate. Frostgate’s gate. I never thought I’d be glad of that ugly old gate.' }],
    retry: [{ who: 'sledge-driver', text: 'They took Arne. They took Arne and you were right there —' }],
  },
};
