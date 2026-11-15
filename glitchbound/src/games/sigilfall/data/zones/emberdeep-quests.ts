import type { NpcDef, QuestDef } from '../types';

/**
 * Cinderhold's people and the quests of Emberdeep Caldera, on the Dead Kingdom's eastern rim (STORY_BIBLE.md
 * §3, Act V). The dwarves of Cinderhold have watched the caldera from its southern rim for a thousand years,
 * and kept faith with Ashkar, lord of its fire. Now the Host has him chained on his own throne beneath the lake
 * of fire, forging the Pale Crown: a crown with seven settings, one for each Crown Sigil, and a place at its
 * center for the living person who carries them (Elyra). The main chain runs from the Slave Forges through
 * Dvalin's reading of the Host's mold (and the hammer he makes with Hroki's ward-stone) to the Throne's Gate,
 * and down into the Molten Throne for the Magma Warden and Ashkar himself, who is freed and breaks the crown.
 * Brewer Asgerd wants her heat back from the magma hounds, and Ash-warden Ketla wants her brother down off the
 * Drake Roost, and Pyrebrand dead. Main chain first. Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const EMBERDEEP_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-pale-crown',
    name: 'The Pale Crown',
    giver: 'candlewife-hesper',
    text: 'Hesper found a Host order pinned to Halvard’s sword, written by the Pale Herald. It sends ore to Emberdeep, east of the wood, to forge a crown with seven empty settings, one for each sigil. Stop that crown before it is finished, then go to Hollowmere. Find Thane Hroki at Cinderhold, the dwarf fort on Emberdeep’s rim.',
    objective: { kind: 'talk', npc: 'thane-hroki', label: 'Talk to Thane Hroki in Cinderhold' },
    after: ['the-weeping-lord'],
    // the hand-off that sends the hero to emberdeep: it starts when the last chapter ends, not on arrival
    level: 51,
    reward: { xp: 1750, gold: 600 },
  },
  /* ------------------------------------------------------ the Pale Crown */
  {
    id: 'forges-on-the-rim',
    name: 'Forges on the Rim',
    auto: true,
    giver: 'thane-hroki',
    text: 'For a month, Hroki’s watchmen have seen Host columns come over the north rim with chained dead behind them. The old smelters north-west of Cinderhold have been cold for a hundred years. Now smoke rises over them. Find out who is working them.',
    objective: { kind: 'explore', spot: 'slave-forges', label: 'Search the Slave Forges north-west of Cinderhold' },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    reward: { xp: 1800, gold: 600, text: 'The Host has turned the smelters into slave forges, worked by its dead in chains. On the anvil you find a block of obsidian carved with Vaelmoor runes. Hroki can’t read them.' },
  },
  {
    id: 'break-the-chains',
    name: 'Break the Chains',
    auto: true,
    giver: 'thane-hroki',
    text: 'The Host’s dead still work the Slave Forges in chains, and some of them wear Cinderhold’s colors. Hroki wants them laid to rest while Dvalin makes his hammer. Free six of them at the Slave Forges, north-west of town. Step back when one falls, because its bucket of slag spills.',
    objective: { kind: 'kill', region: 'emberdeep', count: 6, enemies: ['legion-forgeslave'], label: 'Free forge-slaves at the Slave Forges' },
    after: ['dvalins-reading'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1850, gold: 620 },
  },
  {
    id: 'dvalins-reading',
    name: 'Dvalin’s Reading',
    auto: true,
    giver: 'thane-hroki',
    text: 'Hroki can’t read Vaelmoor runes. Runesmith Dvalin can read anything carved in stone. Take the obsidian to his forge in Cinderhold.',
    objective: { kind: 'talk', npc: 'runesmith-dvalin', label: 'Bring the obsidian to Runesmith Dvalin' },
    after: ['forges-on-the-rim'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1850, gold: 640 },
  },
  {
    id: 'the-throne-gate',
    name: 'The Throne’s Gate',
    auto: true,
    giver: 'thane-hroki',
    text: 'Dvalin set Hroki’s ward-stone into a hammer and worked on it all night. Strike Ashkar’s chains with it, and they will break. The way down to Ashkar is the Throne’s Gate, at the north edge of the caldera, and the Host guards it. Go north and find it.',
    objective: { kind: 'explore', spot: 'throne-gate', label: 'Find the Throne’s Gate in the north of the caldera' },
    after: ['break-the-chains'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1900, gold: 650, item: { rarity: 'rare' } },
  },
  {
    id: 'the-magma-warden',
    name: 'The Magma Warden',
    auto: true,
    giver: 'thane-hroki',
    text: 'Below the Throne’s Gate, the Host has set a guardian on Ashkar’s forges: the Magma Warden, a giant of bone-steel and molten rock. Nobody gets past it to the throne. Go down through the Throne’s Gate into the Molten Throne and destroy it.',
    objective: { kind: 'boss', boss: 'magma-warden', label: 'Defeat the Magma Warden in the Molten Throne' },
    after: ['the-throne-gate'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 3200, gold: 1100, item: { rarity: 'rare' } },
  },
  {
    id: 'ashkar-the-bound',
    name: 'Ashkar the Bound',
    auto: true,
    giver: 'thane-hroki',
    text: 'At the bottom of the Molten Throne, Ashkar sits chained to his own throne, forging the Pale Crown. He is mad with pain and won’t know you. Beat him down, break his chains with Dvalin’s hammer, and smash the crown on its anvil.',
    objective: { kind: 'boss', boss: 'ashkar-the-bound', label: 'Free Ashkar and break the Pale Crown' },
    after: ['the-magma-warden'],
    zone: 'emberdeep',
    level: 53,
    reward: {
      xp: 7800,
      gold: 2200,
      item: 'the-unbound-flame',
      text: 'Dvalin’s hammer breaks the chains, and the Pale Crown cracks in two on the anvil. Ashkar’s mind clears, and he thanks you. He gives you an ember from his own heart. Then he sinks back into the lake of fire, free.',
    },
  },
  /* -------------------------------------------------------- Asgerd's heat */
  {
    id: 'hounds-in-the-runs',
    name: 'Hounds in the Runs',
    giver: 'brewer-asgerd',
    text: 'Brewer Asgerd heats her brewery with clay pipes that run from the Magma Runs, north of Cinderhold. Magma hounds have moved into the Runs, and they chew through her pipes. Kill ten of them.',
    objective: { kind: 'kill', region: 'emberdeep', count: 10, enemies: ['magma-hound'], label: 'Kill magma hounds in the Magma Runs' },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 850, gold: 620 },
  },
  {
    id: 'ember-glands',
    name: 'Ember-Glands',
    giver: 'brewer-asgerd',
    text: 'Asgerd’s pipes can’t be fixed until the caldera calms down. Until then, she can heat her vats with ember-glands, which burn for a month. Bring her five from the magma hounds in the Magma Runs.',
    objective: { kind: 'loot', region: 'emberdeep', item: 'Ember-Gland', from: ['magma-hound'], chance: 0.4, count: 5, label: 'Take Ember-Glands from magma hounds' },
    after: ['hounds-in-the-runs'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1000, gold: 950, item: 'asgerds-warming-flask', text: 'Asgerd’s vats bubble again, and she gives you the first flask of fire-ale from the new brew.' },
  },
  /* --------------------------------------------------------- Dvalin's quench */
  /* --------------------------------------------------------- Ketla's drakes */
  {
    id: 'the-drake-roost',
    name: 'The Drake Roost',
    giver: 'ashwarden-ketla',
    text: 'Ash-warden Ketla counts the drakes over the caldera from Cinderhold’s tower. There are twice as many as last spring, and they all come from the Drake Roost on the far east rim. Her brother Ulf went to look a week ago and hasn’t come back. Go east to the Roost and find him.',
    objective: { kind: 'explore', spot: 'drake-roost', label: 'Look for Ulf at the Drake Roost in the east' },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 850, gold: 640 },
  },
  {
    id: 'ash-on-the-wind',
    name: 'Ash on the Wind',
    giver: 'ashwarden-ketla',
    text: 'Ulf is alive, stuck on a ledge above the Roost with a broken leg. The drakes dive at him whenever he moves. Kill eight ash drakes around the Drake Roost so he can climb down.',
    objective: { kind: 'kill', region: 'emberdeep', count: 8, enemies: ['ash-drake'], label: 'Kill ash drakes around the Drake Roost' },
    after: ['the-drake-roost'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 900, gold: 660 },
  },
  {
    id: 'pyrebrand',
    name: 'Pyrebrand',
    giver: 'ashwarden-ketla',
    text: 'The drakes have a mother: Pyrebrand, the great red drake of the Roost. Ulf says she breathes fire that sticks, rains burning stone, calls her young, and flies off when you get close. Kill her at the Drake Roost on the far east rim.',
    objective: { kind: 'kill', region: 'emberdeep', count: 1, enemies: ['pyrebrand'], label: 'Kill Pyrebrand at the Drake Roost' },
    after: ['ash-on-the-wind'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 1250, gold: 1000, item: 'pyrebrand-scale', text: 'Ulf was right about everything. With his leg still in a splint, he rivets Pyrebrand’s scales onto a mail shirt for you.' },
  },
];

export const EMBERDEEP_NPCS: Record<string, NpcDef> = {
  'thane-hroki': {
    id: 'thane-hroki',
    name: 'Thane Hroki',
    title: 'Thane of Cinderhold',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-pale-crown', state: 'active' },
        lines: [
          'Hesper sent you? Then Halvard is at rest. Good.',
          'I’m Hroki. Cinderhold has watched this caldera for a thousand years. Its fire lord, Ashkar, has always been our friend.',
          'Hear that screaming under the lake? That’s Ashkar. The Host chained him a month ago.',
        ],
      },
      {
        when: { quest: 'forges-on-the-rim', state: 'active' },
        lines: ['The old smelters north-west of here have been cold for a hundred years. There’s smoke over them now.', 'The Host’s columns came over the north rim dragging chained dead. Find out what they’re doing at the smelters.'],
      },
      {
        when: { quest: 'break-the-chains', state: 'active' },
        lines: ['The dead are hauling slag in chains. Some wear our colors. I knew some of them.', 'Lay six of them to rest. Stand back when they fall. Their buckets are full of slag.'],
      },
      { when: { quest: 'dvalins-reading', state: 'active' }, lines: ['I can’t read those runes. Dvalin can read anything carved in stone.', 'Take it to his forge here in Cinderhold.'] },
      {
        when: { quest: 'the-throne-gate', state: 'active' },
        lines: ['Dvalin finished the hammer. He worked on it all night.', 'The Throne’s Gate is at the north edge of the lake of fire. The Host will be guarding it.'],
      },
      {
        when: { quest: 'the-magma-warden', state: 'active' },
        lines: ['Below the gate, the Host has a guardian on the forges. My scouts say it’s made of bone-steel and molten rock.', 'Destroy it, and the way to Ashkar is open.'],
      },
      {
        when: { quest: 'ashkar-the-bound', state: 'active' },
        lines: ['He won’t know you. He’s been in pain too long to know anyone.', 'Beat him down, break his chains with Dvalin’s hammer, and smash that crown. Then he can rest.'],
      },
      {
        when: { quest: 'ashkar-the-bound', state: 'done' },
        lines: ['Listen. The screaming has stopped. For the first time in a month, the lake is quiet.', 'Cinderhold owes you a debt. When you march on the Hallow King, our axes march with you.'],
      },
      { lines: ['This is Cinderhold. A wall, a tower, a hundred dwarves, and a fire we’ve watched for a thousand years.', 'Watch your step on the lava paths.'] },
    ],
  },
  'brewer-asgerd': {
    id: 'brewer-asgerd',
    name: 'Brewer Asgerd',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Hot Cask',
    talk: [
      {
        when: { quest: 'hounds-in-the-runs', state: 'active' },
        lines: ['My grandmother laid pipes from the Magma Runs, north of town, to heat my brewery.', 'Now magma hounds live in the Runs, and they chew the pipes. My brew has gone cold twice this week. Kill ten of them, please.'],
      },
      {
        when: { quest: 'ember-glands', state: 'active' },
        lines: ['The pipes can’t be fixed until the caldera calms down. But a hound’s ember-gland burns for a month.', 'Bring me five, and my brewing can go on.'],
      },
      { when: { quest: 'ember-glands', state: 'done' }, lines: ['Hear that bubbling? The brew is going again. The flask is yours.'] },
      { when: { quest: 'ashkar-the-bound', state: 'done' }, lines: ['The lake is quiet, and my pipes run warm again. Thank you.'] },
      { lines: ['This is the Hot Cask. Beds by the warm wall, potions on the shelf, and fire-ale for the brave.', 'Don’t drink the fire-ale near an open flame.'] },
    ],
  },
  'runesmith-dvalin': {
    id: 'runesmith-dvalin',
    name: 'Runesmith Dvalin',
    title: 'Runesmith',
    sprite: 'villager',
    shop: 'weapons',
    shopName: 'Dvalin’s Runeforge',
    talk: [
      {
        when: { quest: 'dvalins-reading', state: 'active' },
        lines: [
          'Give it here. I can read anything carved in stone.',
          'This is a mold for a crown. It has seven settings, one for each sigil.',
          'There’s a place in the middle for the living person who carries the sigils. From what Hroki tells me, that’s your friend Elyra.',
          'The Host has Ashkar chained under the lake, forging it. His chains can’t be cut. With Hroki’s old ward-stone, I can make a hammer that breaks them.',
        ],
      },
      { when: { quest: 'the-throne-gate', state: 'active' }, lines: ['The hammer is done. Strike his chains with it, and they’ll break.', 'Don’t waste it on anything else. It’s made for those chains.'] },
      { lines: ['This is Dvalin’s Runeforge. Blades, staves, bows and shields, every one with a rune on it.', 'If a blade hums, that’s the rune working.'] },
    ],
  },
  'ashwarden-ketla': {
    id: 'ashwarden-ketla',
    name: 'Ash-warden Ketla',
    title: 'Ash-warden of Cinderhold',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-drake-roost', state: 'active' },
        lines: ['I count the drakes from the tower every morning. There are twice as many as in spring, and they all come from the Drake Roost on the far east rim.', 'My brother Ulf went to look a week ago and hasn’t come back. Please find him.'],
      },
      {
        when: { quest: 'ash-on-the-wind', state: 'active' },
        lines: ['Ulf is alive? On a ledge with a broken leg? Thank goodness.', 'The drakes have him trapped. Kill enough of them around the Roost that he can climb down.'],
      },
      {
        when: { quest: 'pyrebrand', state: 'active' },
        lines: ['Ulf says Pyrebrand breathes fire that sticks, rains stone, calls her young, and flies off when you get close.', 'He may be exaggerating. Take extra potions anyway.'],
      },
      { when: { quest: 'pyrebrand', state: 'done' }, lines: ['Ulf was right. The drake count is going down. Thank you for bringing him home.'] },
      { when: { quest: 'the-throne-gate', state: 'active' }, lines: ['From the tower I can see the Host’s torches around the Throne’s Gate. There are a lot of them.'] },
      { lines: ['I’m Ketla, the ash-warden. I watch the sky, the slopes and the lake, and I count everything that moves.', 'If you see drakes gathering, tell me.'] },
    ],
  },
};
