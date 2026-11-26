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
    text: 'The Pale Herald’s order on Halvard’s sword-belt sends ore and slaves to Emberdeep, east of the wood, to forge a crown with seven empty settings, one for each sigil. Whatever the Host means to do with the sigils, it will do it with that crown, and the crown must not be finished. Take the east road out of the Weeping Woods and find Thane Hroki at Cinderhold, the dwarf fort on Emberdeep’s southern rim.',
    // (it was a walk and a talk. Cinderhold is under an ash-fall that is not the mountain's: the hero helps put out what
    // it lights, and hears where it comes from)
    objective: {
      kind: 'use', region: 'emberdeep', at: 'thane-hroki', count: 3, thing: 'barrel', verb: 'Douse', label: 'Help Cinderhold douse the ash-fall fires', secs: 1, spread: 8, ambush: ['cinder-imp', 'cinder-imp'],
      notes: ['Ash from the north rim. It was never this thick.', '“That’s not the mountain. That’s smelters.”', 'A watchman points north-west. Smoke, where none was.'],
    },
    then: [{ kind: 'talk', npc: 'thane-hroki', label: 'Talk to Thane Hroki in Cinderhold' }],
    after: ['the-weeping-lord'],
    // the hand-off that sends the hero to emberdeep: it starts when the last chapter ends, not on arrival
    level: 51,
    reward: { xp: 1750, gold: 600, text: 'Hroki has watched the caldera for forty years, and his fathers watched it for a thousand. His dwarves have kept faith with Ashkar all that time, and alone they can do nothing for him. Hroki puts Cinderhold’s forge, its tower and its watchmen at your service.' },
  },
  /* ------------------------------------------------------ the Pale Crown */
  {
    id: 'forges-on-the-rim',
    name: 'Forges on the Rim',
    auto: true,
    giver: 'thane-hroki',
    text: 'For a month, Hroki’s watchmen have seen Host columns come over the north rim with chained dead behind them. The old smelters north-west of Cinderhold have been cold for a hundred years. Now smoke rises over them. Search them and find out what the Host is making there.',
    objective: { kind: 'explore', spot: 'slave-forges', label: 'Find the Slave Forges, north-west of Cinderhold' },
    // (it was a walk to the smelters. What the Host makes there is found at its anvils)
    then: [
      {
        kind: 'use', region: 'emberdeep', at: 'slave-forges', count: 3, thing: 'anvil', verb: 'Search', label: 'Search the relit smelters', secs: 1, spread: 6, guards: ['legion-flamecaller'],
        notes: ['The smelters are hot. They were relit this month.', 'Chains, bolted to every anvil.', 'A casting mold, still warm: a crown with seven settings.'],
      },
    ],
    find: {
      step: 1,
      name: 'A Mold of the Pale Crown',
      kind: 'relic',
      about: 'A casting mold of black obsidian, left on the Slave Forges’ anvil. It is shaped for a crown with seven settings, and in the middle a hollow shaped like a heart. Vaelmoor runes are cut around its rim. Nobody in Cinderhold reads them except Runesmith Dvalin.',
    },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    reward: { xp: 1800, gold: 600, text: 'The Host has made the smelters into slave forges, worked by its own dead in chains. The crown the Herald ordered is cast here, and taken down into the caldera to be finished. The crown’s mold was left on the anvil. The runes on it say what the crown is for, and only Dvalin can read them.' },
  },
  {
    id: 'break-the-chains',
    name: 'Break the Chains',
    auto: true,
    giver: 'thane-hroki',
    text: 'The Host’s dead haul ore in chains between the Slave Forges and the Throne’s Gate, and some of them wear Cinderhold’s colors. Hroki asks you to lay four of them to rest on your way north, and to break the chain-posts they are worked from along the caldera road. You’ll find them at the Slave Forges and on the roads across the caldera. Step back when one falls, because its bucket of slag spills.',
    objective: { kind: 'kill', region: 'emberdeep', count: 4, enemies: ['legion-forgeslave'], label: 'Lay forge-slaves to rest at the Slave Forges or on the roads north' },
    // (it was six kills. The quest is named for chains: the posts the haulers are chained to along the road are broken)
    then: [{ kind: 'use', region: 'emberdeep', at: 'obsidian-steps', count: 3, thing: 'anvil', verb: 'Break the chain', label: 'Break the haulers’ chain-posts on the caldera road', secs: 1.2, spread: 7, guards: ['legion-forgeslave'] }],
    after: ['dvalins-reading'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1850, gold: 620, text: 'Six of the chained dead lie still at last. Hroki’s people will carry the ones in Cinderhold’s colors home and bury them on the rim. Every chain they wore leads the same way, north, down through the Throne’s Gate to Ashkar.' },
  },
  {
    id: 'dvalins-reading',
    name: 'Dvalin’s Reading',
    auto: true,
    giver: 'thane-hroki',
    text: 'The mold’s runes say what the crown is for, and only Runesmith Dvalin can read Vaelmoor runes. Ashkar’s chains will need breaking too, and only Dvalin can make the hammer for that. Take the mold back to his forge in Cinderhold.',
    objective: { kind: 'talk', npc: 'runesmith-dvalin', label: 'Bring the mold to Runesmith Dvalin in Cinderhold' },
    // (the hammer was made between two lines of talk. It is made of the caldera's own obsidian, which walks, and the hero
    // strikes for him at the forge)
    then: [
      { kind: 'kill', region: 'emberdeep', count: 2, enemies: ['obsidian-golem'], label: 'Break obsidian golems for the hammer’s head' },
      {
        kind: 'use', region: 'emberdeep', at: 'runesmith-dvalin', count: 3, thing: 'anvil', verb: 'Strike', label: 'Strike for Dvalin while he forges the hammer', secs: 1.2, spread: 3,
        notes: ['“Again. Harder. It has to ring.”', 'The runes take. The hammer-head goes white.', '“Done. It will break a god’s chain. Once.”'],
      },
    ],
    after: ['forges-on-the-rim'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1850, gold: 640, text: 'Dvalin works all night with Hroki’s old ward-stone. At dawn he puts a hammer in your hands, the stone set in its head. It is made to break Ashkar’s chains, and nothing else.' },
  },
  {
    id: 'the-throne-gate',
    name: 'The Throne’s Gate',
    auto: true,
    giver: 'thane-hroki',
    text: 'The way down to Ashkar is the Throne’s Gate, at the north edge of the lake of fire. Ash-warden Ketla has counted the Host’s torches around it from Cinderhold’s tower, and there are many. Go north, find the Gate, and take Dvalin’s hammer down.',
    // (it was a walk north with the hammer in the pack. It is carried in the hands, and the Host's torches round the
    // Gate are not all standing still)
    objective: { kind: 'carry', region: 'emberdeep', from: 'runesmith-dvalin', to: 'throne-gate', thing: 'anvil', verb: 'Take the hammer', label: 'Carry Dvalin’s hammer north to the Throne’s Gate', ambush: [['legion-soldier', 'legion-flamecaller'], ['obsidian-golem']] },
    then: [{ kind: 'use', region: 'emberdeep', at: 'throne-gate', count: 1, thing: 'crate', verb: 'Search', label: 'Search the overseer’s post at the Gate', secs: 1.2, spread: 3, notes: ['An overseer’s tally: ore in, crowns out. One crown.'] }],
    find: {
      step: 1,
      name: 'The Overseer’s Tally',
      kind: 'note',
      about: 'A slate nailed up by the Throne’s Gate, where the Host’s overseer kept count of the work below. The last lines are from three days ago.',
      body: ['Day 31.', 'Crown cast. Seven settings cut. The hollow at the heart cut and polished.', 'The fire lord fails. He forgets what he is making. Two more chains on him.', 'The Herald comes at midwinter to take it north to the King.'],
      sign: 'Overseer of the Throne’s Gate',
    },
    after: ['break-the-chains'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 1900, gold: 650, item: { rarity: 'rare', name: 'Throne-Stair Ember' }, text: 'The Throne’s Gate is a stair cut down into the black rock, with heat pouring up it. Ashkar’s screaming comes from the bottom. The crown is nearly done, and once the Herald carries it north to Duskspire, nobody will reach it.' },
  },
  {
    id: 'the-magma-warden',
    name: 'The Magma Warden',
    auto: true,
    giver: 'thane-hroki',
    text: 'Below the Throne’s Gate, the Host has set a guardian on Ashkar’s forges: the Magma Warden, a giant of bone-steel and molten rock. Nobody gets past it to the throne. Go down through the Throne’s Gate into the Molten Throne and destroy it.',
    // (the old dwarves cut what they knew of the deep into the Fire Ward above it: it says how such a thing fights)
    objective: {
      kind: 'use', region: 'emberdeep', at: 'fire-ward', count: 3, thing: 'runestone', verb: 'Read', label: 'Read the dwarves’ runes at the Fire Ward', secs: 1.1, spread: 5, guards: ['fire-elemental'],
      notes: ['“It is slow. The floor is not.”', '“Where it strikes, the rock stays lit.”', '“Cool rock is dark. Stand on the dark.”'],
    },
    then: [{ kind: 'boss', boss: 'magma-warden', label: 'Destroy the Magma Warden in the Molten Throne' }],
    after: ['the-throne-gate'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 3200, gold: 1100, item: { rarity: 'rare', name: 'Crucible Heart' }, text: 'The Magma Warden cracks apart, and its molten heart runs out across the crucible floor. The forges beyond it start to cool. Deeper down, past the Host’s foundry, Ashkar is still screaming.' },
  },
  {
    id: 'ashkar-the-bound',
    name: 'Ashkar the Bound',
    auto: true,
    giver: 'thane-hroki',
    text: 'At the bottom of the Molten Throne, Ashkar sits chained to his own throne, forging the Pale Crown that is meant to hold Elyra and the sigils. He is mad with pain and won’t know you. Beat him down, break his chains with Dvalin’s hammer, and smash the crown.',
    // (the Host knows what the hammer is for and comes up behind it: the Gate is held before the hero goes down)
    objective: { kind: 'hold', region: 'emberdeep', at: 'throne-gate', secs: 25, waves: [['legion-soldier', 'legion-soldier'], ['legion-flamecaller', 'legion-forgeslave'], ['obsidian-golem']], label: 'Hold the Throne’s Gate against the Host’s overseers' },
    then: [{ kind: 'boss', boss: 'ashkar-the-bound', label: 'Free Ashkar and break the Pale Crown' }],
    after: ['the-magma-warden'],
    zone: 'emberdeep',
    level: 53,
    reward: {
      xp: 7800,
      gold: 2200,
      item: 'the-unbound-flame',
      text: 'Dvalin’s hammer breaks the last chain, and the Pale Crown lies cracked in two. Ashkar’s mind clears. He thanks you, gives you a coal from his own heart and sinks back into the lake of fire, free.',
    },
  },
  /* -------------------------------------------------------- Asgerd's heat */
  {
    id: 'hounds-in-the-runs',
    name: 'Hounds in the Runs',
    giver: 'brewer-asgerd',
    text: 'Brewer Asgerd heats her brewery with clay pipes that run from the Magma Runs, north of Cinderhold. Magma hounds have moved into the Runs, and they chew through her pipes. Kill six of them in the Magma Runs, and mend the pipes they chewed.',
    objective: { kind: 'kill', region: 'emberdeep', count: 6, enemies: ['magma-hound'], label: 'Kill magma hounds in the Magma Runs' },
    // (it was ten kills. What they chewed through is mended, with more of them coming to the smell of the clay)
    then: [{ kind: 'use', region: 'emberdeep', at: 'magma-runs', count: 3, thing: 'barrel', verb: 'Mend the pipe', label: 'Mend Asgerd’s chewed pipes in the Magma Runs', secs: 1.2, spread: 6, ambush: ['magma-hound'] }],
    // (pays out in the Runs: the ember-glands are cut from the same hounds, with no walk back to Asgerd between)
    turnIn: false,
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 850, gold: 620, text: 'The hounds are thinned out, but every pipe in the Runs is chewed through. They can’t be fixed until the caldera calms down.' },
  },
  {
    id: 'ember-glands',
    name: 'Ember-Glands',
    giver: 'brewer-asgerd',
    text: 'Asgerd’s pipes can’t be fixed yet. Until they can, she can heat her vats with ember-glands, which burn for a month. Take three from the magma hounds here in the Magma Runs. They are already burning: carry them to her at the Hot Cask in a fire-pot.',
    objective: { kind: 'loot', region: 'emberdeep', item: 'Ember-Gland', from: ['magma-hound'], chance: 0.4, count: 3, label: 'Take Ember-Glands from magma hounds' },
    // (it was five glands in a pocket. They burn for a month, starting now: they go to the brewery in a fire-pot)
    then: [{ kind: 'carry', region: 'emberdeep', from: 'magma-runs', to: 'brewer-asgerd', thing: 'brazier', verb: 'Take the fire-pot', label: 'Carry the burning glands to the Hot Cask', ambush: [['magma-hound', 'cinder-imp']] }],
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
    // (it was a walk east. Ulf counts in chalk, as his sister does, and left his count along the way)
    objective: {
      kind: 'trail', region: 'emberdeep', from: 'ashwarden-ketla', to: 'drake-roost', marks: 3, label: 'Follow Ulf’s chalk marks east',
      notes: ['Chalk on the rock: a count of drakes. Ulf’s hand.', 'The count doubles here. He underlined it twice.', 'A slate, dropped. Above it, a ledge, and a voice.'],
    },
    then: [{ kind: 'explore', spot: 'drake-roost', label: 'Find the Drake Roost' }],
    // (pays out at the Roost, where Ulf is: the rest of Ketla's chain is played there, with no walk back between)
    turnIn: false,
    find: {
      name: 'Ulf’s Slate',
      kind: 'note',
      about: 'A counting slate, dropped from a ledge above the Drake Roost. Ulf is up there with a broken leg, and he scratched this for whoever came looking.',
      body: ['Ketla.', 'Forty-one drakes. One mother, very big.', 'Leg’s broken. I’m on the ledge above the nests.', 'Don’t come yourself.'],
      sign: 'Ulf',
    },
    after: ['the-pale-crown'],
    zone: 'emberdeep',
    level: 52,
    reward: { xp: 850, gold: 640, text: 'Ulf is alive, on a ledge above the nests with his leg in a splint he made from a spear. The drakes dive at him whenever he moves. He waves the moment he sees you.' },
  },
  {
    id: 'ash-on-the-wind',
    name: 'Ash on the Wind',
    giver: 'ashwarden-ketla',
    text: 'Ulf is stuck on a ledge above the Drake Roost with a broken leg, and the drakes dive at him whenever he moves. Kill five ash drakes around the Roost, and stand under his ledge while he climbs down.',
    objective: { kind: 'kill', region: 'emberdeep', count: 5, enemies: ['ash-drake'], label: 'Kill ash drakes around the Drake Roost' },
    // (it was eight kills, so that he could climb down. He climbs while the hero stands under the ledge)
    then: [{ kind: 'hold', region: 'emberdeep', at: 'drake-roost', secs: 25, waves: [['ash-drake'], ['ash-drake', 'cinder-imp'], ['ash-drake', 'ash-drake']], label: 'Keep the drakes off Ulf while he climbs down' }],
    // (pays out at the Roost: Pyrebrand is next, in the same place)
    turnIn: false,
    after: ['the-drake-roost'],
    zone: 'emberdeep',
    level: 53,
    reward: { xp: 900, gold: 660, text: 'Ulf climbs down on his good leg and sits in the ash, breathing hard. He says the drakes will keep coming as long as their mother lives.' },
  },
  {
    id: 'pyrebrand',
    name: 'Pyrebrand',
    giver: 'ashwarden-ketla',
    text: 'The drakes have a mother: Pyrebrand, the great red drake of the Roost. Ulf says she breathes fire that sticks, rains burning stone, calls her young, and flies off when you get close. Kill her at the Drake Roost, then bring Ulf home to Ketla.',
    // (she flies off when anyone gets close. Her landing-places are pulled down first, so that she has to stand and fight)
    objective: { kind: 'use', region: 'emberdeep', at: 'drake-roost', count: 3, thing: 'nest', verb: 'Pull it down', label: 'Pull down Pyrebrand’s roosting ledges', secs: 1.2, spread: 6, guards: ['ash-drake'] },
    then: [{ kind: 'kill', region: 'emberdeep', count: 1, enemies: ['pyrebrand'], label: 'Kill Pyrebrand at the Drake Roost', lair: { at: 'drake-roost', enemies: ['pyrebrand'] } }],
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
          'Hesper sent word you were coming. So Halvard is at rest. Good.',
          'I’m Hroki, Thane of Cinderhold. We’ve watched this caldera for a thousand years. Its fire lord, Ashkar, has always kept faith with us.',
          'Hear that screaming under the lake? That’s Ashkar. The Host chained him a month ago and set him to forging their crown.',
        ],
      },
      {
        when: { quest: 'forges-on-the-rim', state: 'active' },
        lines: ['The old smelters north-west of here have been cold for a hundred years. There’s smoke over them now.', 'The Host’s columns came over the north rim dragging chained dead. Find out what they’re making at the smelters.'],
      },
      {
        when: { quest: 'break-the-chains', state: 'active' },
        lines: ['The dead haul ore in chains between the forges and the Throne’s Gate. Some wear our colors. I knew some of them.', 'Lay four of them to rest on your way north, and break the chain-posts on the road, by the Obsidian Steps. Stand back when the dead fall. Their buckets are full of slag.'],
      },
      { when: { quest: 'dvalins-reading', state: 'active' }, lines: ['I can’t read those runes. Dvalin can read anything carved in stone.', 'Take the mold to his forge here in Cinderhold.'] },
      {
        when: { quest: 'the-throne-gate', state: 'active' },
        lines: ['You have the hammer, then. Dvalin didn’t sleep.', 'The Throne’s Gate is at the north edge of the lake of fire. The Host will be guarding it.'],
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
        when: { quest: 'the-dead-lake', state: 'active' },
        lines: ['Listen. The screaming has stopped. For the first time in a month, the lake is quiet.', 'If the King makes another crown, Ashkar won’t be the one to forge it. Go west to Hollowmere. The Ferryman keeps a landing on its south shore.'],
      },
      {
        when: { quest: 'ashkar-the-bound', state: 'done' },
        lines: ['The lake is quiet. Ashkar sleeps in his fire again.', 'Cinderhold owes you a debt. When you march on the Hallow King, our axes march with you.'],
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
        lines: ['My grandmother laid pipes from the Magma Runs, north of town, to heat the brewery.', 'Now magma hounds live in the Runs, and they chew the pipes. My brew has gone cold twice this week. Kill six of them, please, and mend what they chewed. I’ll give you the clay.'],
      },
      {
        when: { quest: 'ember-glands', state: 'active' },
        lines: ['The pipes can’t be fixed until the caldera calms down. But a hound’s ember-gland burns for a month.', 'Bring me three. They’ll be burning when you cut them out, so carry them in this fire-pot, and don’t stop to talk.'],
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
          'The runes say the crown holds the seven sigils, and at its heart a living heart that remembers them.',
          'The sigils answer only to the one who bonded them. From what Hroki tells me, that’s your friend Elyra. They mean to set her in it.',
          'Ashkar is forging it, chained to his throne under the lake. Those chains are bone-steel, and no blade will cut them.',
          'Hroki’s old ward-stone will break them, set in a hammer. Give me tonight.',
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
