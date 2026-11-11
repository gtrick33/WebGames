import type { NpcDef, QuestDef } from '../types';

/**
 * Cinderhold's people and the quests of Emberdeep Caldera, on the Dead Kingdom's eastern rim (STORY_BIBLE.md
 * §3, Act V: the second of the three great dungeons). The dwarves of Cinderhold have kept the fire-ward on the
 * caldera's southern rim for a thousand years, and their old pact with Ashkar, lord of its fire, with it. Now
 * the Host has him chained on his own throne beneath the lake of fire, forging the Pale Crown: a crown of
 * ash-iron with seven empty points, the setting the seven Crown Sigils would be set in to relight the Ash
 * Crown as a Crown of Ash and Starlight. Freed, Ashkar breaks it and forges the halves into a band of
 * starlight that lets Elyra hold all seven without being burned away. The main chain runs from the Slave
 * Forges and the flamecallers through Dvalin's reading of the Host's runes and the Old Fire-Ward's ward-stone to the Throne's Gate, and down into the
 * Molten Throne for the Magma Warden and Ashkar himself. Brewer Asgerd wants her heat back from the magma
 * hounds, Runesmith Dvalin wants living embers from the fire-folk, and Ash-warden Ketla wants her brother
 * down off the Drake Roost, and Pyrebrand dead. Main chain first.
 */
export const EMBERDEEP_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-pale-crown',
    name: 'The Pale Crown',
    giver: 'candlewife-hesper',
    text: 'Halvard’s last words were for Hollowmere, but his sword had something else to say. Under the Weeping Tree, Hesper found a forge-order pinned to its blade, taken off a Host courier Halvard cut down on the road east: wagons of pale ore bound for Emberdeep Caldera, in the Herald’s grey hand. “Seven points. Leave them empty. They will be filled.” A crown for the seven sigils: the setting the Ash Crown needs to be relit as a Crown of Ash and Starlight. Emberdeep is a ring of black mountains round a lake of fire, and the dwarves of Cinderhold have watched it from the southern rim for a thousand years. Take the east road out of the wood to Cinderhold and find Thane Hroki.',
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
    text: 'For a month Hroki’s watchmen have counted the Host’s columns coming over the north rim, and every column drags chains. Now smoke rises from the old smelters on the west rim, north-west of Cinderhold, where the dwarves once worked the caldera’s iron and haven’t in a century. Hroki would like to know who is working them, and with what.',
    objective: { kind: 'explore', spot: 'slave-forges', label: 'Find who is working the old smelters north-west of Cinderhold' },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    reward: { xp: 1800, gold: 600 },
  },
  {
    id: 'break-the-chains',
    name: 'Break the Chains',
    auto: true,
    giver: 'thane-hroki',
    text: 'The Slave Forges are worked by the dead: forge-slaves chained at the ankle, hauling buckets of slag from the lava flows to the anvils and back, without rest, because the dead don’t need any. Some of them wear Cinderhold’s colors under the soot. Hroki wants them laid down, all of them, and he will settle for twelve. At the Slave Forges north-west of town, and along the flows. Step back when they fall: the buckets spill.',
    objective: { kind: 'kill', region: 'emberdeep', count: 6, enemies: ['legion-forgeslave'], label: 'Free the dead made to work the forges' },
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
    text: 'Hroki can read a ledger, a map and a man’s face, but not Hollow runes. Runesmith Dvalin can read anything cut into stone, and will tell you so before you ask. Take the obsidian to his forge on the square in Cinderhold.',
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
    text: 'Dvalin has set the ward-stone into the head of a hammer and sung over it all night. “Strike his chains with it,” he says, “and they’ll remember they were only iron.” The way down to Ashkar’s throne is the Throne’s Gate, in the north of the caldera at the edge of the lake of fire, and the Host guards it with everything it has left. Go north and find it.',
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
    text: 'Below the Throne’s Gate the Host has set a keeper on Ashkar’s forges: the Magma Warden, a construct of bone-steel and molten stone that feeds the fires and keeps the slaves at the anvils. As long as it stands, nobody reaches the throne. Go down through the Throne’s Gate into the Molten Throne and break it.',
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
    text: 'At the bottom of the Molten Throne, over a lake of fire, Ashkar sits chained to his own throne, hammering the Pale Crown on an anvil of his own flame and screaming as he works. He will not know you. He will not know anyone. Free him the only way he can be freed now: beat him down, strike his chains with Dvalin’s hammer, and break the Pale Crown on its anvil before the Herald can fill its seven points.',
    objective: { kind: 'boss', boss: 'ashkar-the-bound', label: 'Free Ashkar the Bound and break the Pale Crown' },
    after: ['the-magma-warden'],
    zone: 'emberdeep',
    level: 53,
    reward: {
      xp: 7800,
      gold: 2200,
      item: 'the-unbound-flame',
      text: 'Dvalin’s hammer rings on the chains, and the chains remember they were iron. Ashkar falls to one knee, and the Pale Crown cracks in two on his anvil. “Thank you,” the fire lord says, in a voice like a forge cooling. He takes the two halves in his bare hands and folds them together, hammering with his fist, until what lies on the anvil is a thin band of white metal that hums. “For the one who carries the star’s light,” he says. “It will hold the seven so they do not hold her. It will not give back what they have taken.” He gives you a coal from his own heart before the fire takes him home.',
    },
  },
  /* -------------------------------------------------------- Asgerd's heat */
  {
    id: 'hounds-in-the-runs',
    name: 'Hounds in the Runs',
    giver: 'brewer-asgerd',
    text: 'Asgerd brews with the caldera’s own heat: clay pipes her grandmother laid run from the Magma Runs, the lava channels north of Cinderhold in the middle of the caldera, to her mash-tuns. Since Ashkar went mad, magma hounds have denned in the Runs, and they chew pipe. Her mash has gone cold twice this week, and she takes that personally. Ten fewer hounds, please.',
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
    text: 'The pipes are past mending until the fire calms down, and Asgerd has a brewing to finish. A magma hound carries an ember-gland in its throat that burns for a month in a cold hearth, and five would see her through. Bring them from the hounds in the Magma Runs, north of Cinderhold. She will pay in gold and in the first flask.',
    objective: { kind: 'loot', region: 'emberdeep', item: 'Ember-Gland', from: ['magma-hound'], chance: 0.4, count: 5, label: 'Take Ember-Glands from magma hounds' },
    after: ['hounds-in-the-runs'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1000, gold: 950, item: 'asgerds-warming-flask', text: 'Asgerd’s mash-tuns bubble again over five glowing glands, and the first flask of fire-ale off the new brew is yours. “Sip it,” she says. “Sip.”' },
  },
  /* --------------------------------------------------------- Dvalin's quench */
  /* --------------------------------------------------------- Ketla's drakes */
  {
    id: 'the-drake-roost',
    name: 'The Drake Roost',
    giver: 'ashwarden-ketla',
    text: 'Ash-warden Ketla counts the drakes over the caldera from Cinderhold’s tower, and lately the count is wrong: twice as many ash drakes as last spring, all of them coming from the Drake Roost on the far east rim. Her brother Ulf went to look a week ago and hasn’t come back, which she says is typical of him. Go east to the Drake Roost and see.',
    objective: { kind: 'explore', spot: 'drake-roost', label: 'Look for Ulf at the Drake Roost on the far east rim' },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 850, gold: 640 },
  },
  {
    id: 'ash-on-the-wind',
    name: 'Ash on the Wind',
    giver: 'ashwarden-ketla',
    text: 'Ulf is alive, up a chimney of rock above the Roost with a broken leg and a great many opinions, and the drakes have him pinned there. Every time he puts his head out, something swoops. Thin out the ash drakes round the Drake Roost on the far east rim, so he can climb down before he runs out of opinions.',
    objective: { kind: 'kill', region: 'emberdeep', count: 8, enemies: ['ash-drake'], label: 'Thin out the ash drakes round the Roost' },
    after: ['the-drake-roost'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 900, gold: 660 },
  },
  {
    id: 'pyrebrand',
    name: 'Pyrebrand',
    giver: 'ashwarden-ketla',
    text: 'The drakes have a mother. Pyrebrand, the great drake of the Roost, red as a forge’s heart, woke when Ashkar began to scream and has been laying ever since. Ulf says she breathes fire that sticks, rains burning stone, calls her brood down out of the smoke and takes to the air the moment you get close. Ketla says Ulf exaggerates. Kill Pyrebrand at the Drake Roost on the far east rim, and find out which of them is right.',
    objective: { kind: 'kill', region: 'emberdeep', count: 1, enemies: ['pyrebrand'], label: 'Kill Pyrebrand at the Drake Roost' },
    after: ['ash-on-the-wind'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 1250, gold: 1000, item: 'pyrebrand-scale', text: 'Ulf, it turns out, was right. He riveted the great drake’s scales onto a mail shirt with his leg in a splint and complains that you never thanked him for it. Ketla says that is the most he has ever said about anyone.' },
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
        lines: ['Hesper sent you? Then Halvard is at rest. Good. Nothing in my caldera is.', 'Hroki. Cinderhold has kept the fire-ward on this rim for a thousand years, and kept faith with the lord of the fire for as long. Now listen to him.', 'That screaming, under the lake. That is Ashkar. A month, now.'],
      },
      {
        when: { quest: 'forges-on-the-rim', state: 'active' },
        lines: ['The old smelters on the west rim, north-west of here. We left them a hundred years ago. There’s smoke over them now.', 'Every column the Host brought over the north rim was dragging chains. Go and see what’s on the end of them.'],
      },
      {
        when: { quest: 'break-the-chains', state: 'active' },
        lines: ['The dead, hauling slag. Some in our colors. Some of those I knew.', 'Lay them down. Twelve, to begin with. And stand back when they fall: those buckets were full when they picked them up.'],
      },
      { when: { quest: 'dvalins-reading', state: 'active' }, lines: ['I can read a ledger and a liar, but not that. Dvalin can read anything cut in stone. Take it to his forge.', 'He’ll tell you he can read it before you’ve shown it him. Let him.'] },
      {
        when: { quest: 'the-throne-gate', state: 'active' },
        lines: ['Dvalin’s hammer. He sang over it all night; nobody in town slept, but it’s done.', 'The Throne’s Gate is north, at the edge of the lake. The Host will be standing in it. Find it, and count them for me.'],
      },
      {
        when: { quest: 'the-magma-warden', state: 'active' },
        lines: ['Below the gate the Host has set a keeper on the forges. Bone-steel and molten stone, my scouts say. They said it from a long way off.', 'Break it, and the road to the throne is open.'],
      },
      {
        when: { quest: 'ashkar-the-bound', state: 'active' },
        lines: ['He won’t know you. He won’t know me. He’s been in pain too long to know anything.', 'Beat him down, strike the chains with Dvalin’s hammer, and smash that crown on its anvil. Then he can go home. It’s all any of us want.'],
      },
      {
        when: { quest: 'ashkar-the-bound', state: 'done' },
        lines: ['Listen. Nothing. For the first time in a month, the lake is only a lake.', 'Vaelor will have to hold his dead without a crown. Cinderhold owes you a debt, and dwarves pay their debts, slowly, with interest.'],
      },
      { lines: ['Cinderhold. A wall, a tower, a hundred dwarves and a fire we’ve watched for a thousand years.', 'Mind the lava. It doesn’t care who you are.'] },
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
        lines: ['My grandmother laid pipes from the Magma Runs, north of town, to my mash-tuns. Best heat in the north. Free, too.', 'Now there are hounds in the Runs, and they chew pipe. My mash went cold twice this week. Twice! Ten fewer hounds, please.'],
      },
      {
        when: { quest: 'ember-glands', state: 'active' },
        lines: ['The pipes are done for till the fire calms. But a hound’s ember-gland burns a month in a cold hearth.', 'Five would see my brewing through. Don’t squeeze them. They squirt.'],
      },
      { when: { quest: 'ember-glands', state: 'done' }, lines: ['Hear that? Bubbling. Best sound in the world, after the till.', 'The flask is yours. Sip it. I said sip.'] },
      { when: { quest: 'ashkar-the-bound', state: 'done' }, lines: ['The lake’s gone quiet, and my pipes run warm again. I’ve named a brew after you. It’s very strong and slightly confused.'] },
      { lines: ['The Hot Cask. Beds by the warm wall, potions on the shelf, and fire-ale for the brave.', 'Don’t drink the fire-ale near a candle. I’m only telling you once.'] },
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
          'I can read that. I can read anything cut in stone. Give it here.',
          'Hollow runes. Not for the golems: these are the runes on Ashkar’s chains. Bone-steel from the Deepforge, cut so his pain never closes. Pain that never closes burns hot enough to forge a crown for the dead.',
          'Chains like that, you don’t cut. You make them forget. For that I need the old ward-stone, from the Fire-Ward on the east rim. Tell Hroki.',
        ],
      },
      { when: { quest: 'the-throne-gate', state: 'active' }, lines: ['The hammer’s done. Strike his chains with it and they’ll remember they were only iron.', 'Don’t hit anything else with it. It’s a key, not a club. Mostly.'] },
      { lines: ['Dvalin’s Runeforge. Blades, staves, bows and shields, and a rune on every one, whether you want it or not.', 'If it hums, that’s the rune. If it sings, bring it back.'] },
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
        lines: ['I count drakes. Every morning, from the tower. The count is wrong: twice what it was in spring, all from the Drake Roost on the far east rim.', 'My brother Ulf went to look a week ago. He hasn’t come back. That’s typical of him. Go and see.'],
      },
      {
        when: { quest: 'ash-on-the-wind', state: 'active' },
        lines: ['Alive? Up a chimney with a broken leg? Talking? That’s Ulf.', 'The drakes have him pinned. Thin them out round the Roost so he can climb down. Before he talks himself hoarse.'],
      },
      {
        when: { quest: 'pyrebrand', state: 'active' },
        lines: ['Pyrebrand. Ulf says she breathes fire that sticks, rains stone, calls her brood and flies off when you get close.', 'Ulf exaggerates. Probably. Take a potion or two in case he doesn’t.'],
      },
      { when: { quest: 'pyrebrand', state: 'done' }, lines: ['He was right. He’ll never let me hear the end of it. The count’s coming down, though. I like a count that comes down.'] },
      { when: { quest: 'the-throne-gate', state: 'active' }, lines: ['The Throne’s Gate is north, at the edge of the lake. From the tower I can see the Host’s torches round it. Lots of torches.'] },
      { lines: ['Ash-warden Ketla. I watch the sky, the slopes and the lake, and I count what moves.', 'Something always moves.'] },
    ],
  },
};
