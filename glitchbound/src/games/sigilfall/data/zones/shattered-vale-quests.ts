import type { EnemyDef, NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Shardwatch's people and the quests of the Shattered Vale (see WORLD.md). The Tear at the top of the
 * Vale bleeds grieflight, and things come through it. Magister Quell's scholars measure it and the
 * Regent's soldiers watch it; neither expected the voidcallers, living men paid in the Pale Herald's
 * ash-gold to sing it wider. The main chain runs from the Breach Camp and the Herald's letter (Nyx reads
 * it first, and lies about it) to the Tear, where the Herald takes Elyra and her five sigils, then the
 * Tearborn, and Fernstead's fall. Ennis wants specimens, Hesk wants her husband's pick back from the
 * wyrms, and Sergeant Dace wants his sentries. Main chain first. Written to DIALOGUE_STYLE.md.
 */
export const SHATTERED_VALE_QUESTS: QuestDef[] = [
  /* --------------------------------------------- postgame: what was under the Tear */
  {
    id: 'thread-under-the-tear',
    name: 'What Was Under the Tear',
    giver: 'magister-quell',
    zone: 'shattered-vale',
    text: 'With the Ash Crown unmade, the Tear is finally closing. As it closes, it has let go of something it held at the very bottom: a man in a harbor-master’s blue coat, kneeling, with his face in his hands. Quell’s brass rods all point at him, and the grieflight around him is growing. Go to the Tear and face him before it closes over him.',
    // (it was a walk to a fight. The grieflight round him is hemmed in with Lastlight's lamps first, so that it is him the
    // hero faces and not the whole Tear)
    objective: {
      kind: 'use', region: 'shattered-vale', at: 'the-tear', count: 3, thing: 'candle', verb: 'Set a lamp', label: 'Ring the kneeling man with Lastlight lamps', secs: 1.2, spread: 5,
      notes: ['The grieflight leans away from the flame.', 'He is saying a name, over and over.', 'The last lamp. The light has nowhere left to go.'],
    },
    then: [{ kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-heralds-first-face'], label: 'Face the man at the bottom of the Tear', lair: { at: 'the-tear', enemies: ['the-heralds-first-face'] } }],
    // postgame (Act VI's thread): what Aurel wore under the Herald's white for three hundred years
    find: {
      name: 'Aurel’s Harbor Badge',
      kind: 'relic',
      about: 'A harbor-master’s badge of tarnished brass, found where the man in white knelt at the bottom of the Tear. Aurel wore it under the Pale Herald’s coat for three hundred years. It is cold, like ash-gold, and weighs almost nothing.',
      body: ['AUREL OF VAELMOOR, MASTER OF THE HARBOR', 'No ship passes the chain without his word.'],
    },
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 8000, gold: 3000, item: { rarity: 'legendary' }, text: 'The man was what was left of Aurel at the Tear. His grief was too heavy to go home with the rest when the Crown was unmade. When you break it, he lifts his face at last, and it is only the face of a tired young harbor-master. Quell lets the Tear close over him gently and writes his name in Shardwatch’s book.' },
  },
  /* ---------------------------------------------------------- the way in */
  {
    id: 'where-the-rift-bleeds',
    name: 'Shardwatch',
    giver: 'jarl-sigrun',
    text: 'Elyra now carries four sigils, and the Host still has one. The last place on the wardens’ map is the Tear, a rip in the sky over the Shattered Vale, south of Rimeheld. The Sigil of the Veil has held it shut for three hundred years. Take the south road out of Rimeheld and find Magister Quell at Shardwatch.',
    offer: ['The last place on your map is the Tear, in the Shattered Vale, south of here.', 'Magister Quell watches the Tear from Shardwatch. Go to him.', 'One more thing. A letter in grey ink came to my gate for Nyx. She read it and burned it. Keep an eye on her.'],
    // (it was a walk and a talk. Quell's brass rods stand all round Shardwatch, and what they read is the land's trouble
    // before the Magister says a word)
    objective: {
      kind: 'use', region: 'shattered-vale', at: 'magister-quell', count: 3, thing: 'rod', verb: 'Read the rod', label: 'Read Quell’s brass rods round Shardwatch', secs: 1, spread: 9, guards: ['rift-shardling'],
      notes: ['The needle points north, and up.', 'It trembles. What it reads is getting wider.', 'This one is bent double. It read something too big.'],
    },
    then: [{ kind: 'talk', npc: 'magister-quell', label: 'Talk to Magister Quell in Shardwatch' }],
    after: ['the-vault-of-rime'],
    level: 35,
    reward: { xp: 1000, gold: 280, text: 'Quell has watched the Tear for eleven years, and it has never been this wide. Things have started climbing out of it. At night, men in violet robes stand east of camp and sing to it.' },
  },
  /* ------------------------------------------------------------- the Tear */
  {
    id: 'the-breach-camp',
    name: 'The Breach Camp',
    auto: true,
    giver: 'magister-quell',
    text: 'Sergeant Dace’s sentries have seen torches at night east of Shardwatch, around a crack in the ground that hums. Men in violet robes stand around it and sing. Nobody knows who they are. Go east to the Breach Camp and find out.',
    objective: { kind: 'explore', spot: 'breach-camp', label: 'Find the Breach Camp, east of Shardwatch' },
    // (it was a walk to the camp. The singers sing to three poles set round the crack: they are pulled down)
    then: [
      {
        kind: 'use', region: 'shattered-vale', at: 'breach-camp', count: 3, thing: 'totem', verb: 'Pull it down', label: 'Pull down the singers’ three tuning-poles', secs: 1.2, spread: 6, guards: ['voidcaller'],
        notes: ['The pole hums in your hands until it falls.', 'The crack in the ground goes quieter by a third.', 'A hymn-sheet is nailed to this one.'],
      },
    ],
    find: {
      step: 1,
      name: 'The Singers’ Hymn',
      kind: 'page',
      about: 'Pinned to a pole at the Breach Camp, where the singers could read it by torchlight. It is written in plain Aster, in grey ink. Every singer here has learned it by heart.',
      body: ['Sing at dusk, and sing at dawn.', 'Sing the door wide, and wider still.', 'When it is wide enough, he will come through to you.', 'Sing, and you will be paid in full.'],
    },
    after: ['where-the-rift-bleeds'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1100, gold: 300, text: 'The singers are living men, not the Host’s dead, and every one of them carries ash-gold. Their song is pulling the Tear wider for someone on the other side. They have seen you, and they won’t stop singing.' },
  },
  {
    id: 'the-heralds-cipher',
    name: 'The Herald’s Cipher',
    auto: true,
    giver: 'magister-quell',
    text: 'The singers at the Breach Camp are voidcallers: living men the Pale Herald pays in ash-gold to sing the Tear open. Silence them before the Tear is wide enough for someone to come through. Nyx has hardly said a word since Frostgate.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 3, enemies: ['voidcaller'], label: 'Silence the voidcallers at the Breach Camp' },
    // (it was four kills. They are living men, paid: the last one is taken with his letters on him)
    then: [{ kind: 'subdue', region: 'shattered-vale', enemies: ['voidcaller'], count: 1, verb: 'Take his letters', label: 'Take the last voidcaller alive, with his letters', lair: { at: 'breach-camp', enemies: ['voidcaller'] } }],
    find: {
      name: 'The Voidcallers’ Cipher',
      kind: 'letter',
      about: 'Taken from the last voidcaller at the Breach Camp. It is written in grey ink, in a cipher nobody else can read, and sealed with the empty crown. Nyx snatched it out of your hand, read it, and went white.',
      // (the letter Nyx writes out in pencil at Lastlight, data/zones/gloamhollow-quests.ts, in its cipher)
      body: ['Yvggyr guvrs.', 'Lbhe oebgure Jera vf nyvir. Ur nfxf sbe lbh ng avtug.', 'Gur jneqra-tvey jvyy pbzr gb gur Grne sbe gur Irvy. Oevat ure ol gur abegu cngu, nsgre qnex, naq gryy ab bar.', 'Qb guvf, naq Jera jnyxf serr gur fnzr avtug. Snvy zr, naq ur jnyxf va zl xvat’f Ubfg.'],
      sign: '(sealed with an empty crown)',
    },
    after: ['the-breach-camp'],
    zone: 'shattered-vale',
    level: 38,
    reward: { xp: 1150, gold: 320, text: 'The voidcallers are dead, and their song has stopped. The Tear is still wide open above the Vale, and the Sigil of the Veil is barely holding it. Whoever the singers were waiting for is close.' },
  },
  {
    id: 'the-tear',
    name: 'The Tear',
    auto: true,
    giver: 'magister-quell',
    text: 'The Tear is at the top of the Shattered Vale, north of Shardwatch. The Sigil of the Veil is set in the glass at its edge, holding it shut. Go up with Elyra and take the sigil before the Herald does. Nyx has hardly said a word since she read the voidcallers’ letter.',
    objective: { kind: 'explore', spot: 'the-tear', label: 'Go up to the Tear, north of Shardwatch' },
    // (it was a walk, and the sigil came out in a line of talk. It is drawn out of the glass with the hero's hands beside
    // Elyra's, and the sky answers)
    then: [{ kind: 'use', region: 'shattered-vale', at: 'tear-top', count: 1, thing: 'runestone', verb: 'Draw the sigil', label: 'Help Elyra draw the Sigil of the Veil out of the glass', secs: 2.4, spread: 2, notes: ['It comes free. Above you, the sky tears.'] }],
    after: ['the-heralds-cipher'],
    zone: 'shattered-vale',
    level: 39,
    // (no page of its own: the fight at the Tear begins the moment the hero reaches it, and its opening shot
    // shows Elyra pulling the sigil out of the glass; data/scenes.ts tear-the-light-is-wrong)
    reward: { xp: 1300, gold: 340, item: { rarity: 'rare', name: 'Tearborne' } },
  },
  {
    id: 'the-heralds-ambush',
    name: 'The Pale Herald',
    giver: 'magister-quell',
    auto: true,
    text: 'Elyra pulled the Sigil of the Veil out of the glass, and the Tear tore wide open. The Pale Herald’s shades are pouring out of it, and someone told him exactly when you would be here. Protect Elyra.',
    objective: { kind: 'event', event: 'herald-ambush', label: 'Protect Elyra from the Pale Herald at the Tear' },
    after: ['the-tear'],
    zone: 'shattered-vale',
    level: 40,
    reward: { xp: 3000, gold: 600, text: 'You lost. The Pale Herald took Elyra back through the Tear, and all five sigils with her. Nyx sold him your road to save her brother, Wren, and the Herald kept Wren anyway. Then Nyx ran, and nobody saw where.' },
  },
  {
    id: 'fall-of-fernstead',
    name: 'The Night Fernstead Fell',
    giver: 'maren',
    auto: true,
    text: 'Maren’s letter brought the worst news. On the night the Herald took Elyra, the Host came over the Brackenridge Hills and burned Fernstead, the first village you helped. Its people are walking to Briarhollow with what they could carry. Go home and meet them.',
    // (they walked in, and that was all. A camp that takes in a village makes room first: their tents are raised)
    objective: { kind: 'use', region: 'briarhollow', at: 'briar-fern-camp', count: 3, thing: 'shelter', verb: 'Raise the tent', label: 'Raise tents for Fernstead’s people at the camp’s edge', secs: 1.2, spread: 6 },
    then: [{ kind: 'event', event: 'fern-refugees', label: 'Meet Fernstead’s people at Briarhollow' }],
    after: ['the-heart-of-the-tear'],
    zone: 'briarhollow',
    level: 40,
    reward: { xp: 1200, gold: 300, text: 'Warden Hollis counts her people in at Briarhollow’s gate. Every one who got out of Fernstead made it here. Then she sits down on the steps of the Elder’s hall and stays there a long time.' },
  },
  {
    id: 'the-heart-of-the-tear',
    name: 'The Heart of the Tear',
    giver: 'magister-quell',
    // (it starts at the Tear the moment the Herald is gone, and pays out there: no walk back to Shardwatch and up again)
    auto: true,
    turnIn: false,
    text: 'The Herald is gone, and without the Sigil of the Veil the Tear is wide open. A huge creature stands in the opening and holds it wide: the Tearborn, made of everything that ever came through. Kill it at the Tear so the Tear can start to close. Then you can go after Elyra.',
    // (it was one kill. The Tear is pinned at its edge with Quell's rods first, so that when the thing holding it open
    // falls, it has something to close against)
    objective: { kind: 'use', region: 'shattered-vale', at: 'the-tear', count: 3, thing: 'rod', verb: 'Drive in the rod', label: 'Pin the Tear’s edge with Quell’s rods', secs: 1.3, spread: 6, ambush: ['rift-shardling', 'rift-shardling'] },
    then: [{ kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-tearborn'], label: 'Kill the Tearborn at the Tear', lair: { at: 'the-tear', enemies: ['the-tearborn'] } }],
    find: {
      name: 'Maren’s Letter',
      kind: 'letter',
      about: 'Elder Maren wrote it the night Fernstead burned. A runner from Shardwatch brought it up to the Tear as the Tearborn fell.',
      body: ['To the hero, and to Elyra,', 'The Host came over the Brackenridge Hills tonight and set Fernstead on fire. We can see the glow from the chapel tower.', 'Hollis got her people out on foot. They are walking here now, and I have sent every cart we have to meet them.', 'Come home if you can. Thessa is asking for Elyra.'],
      sign: 'Maren, for the camp at Briarhollow',
    },
    after: ['the-heralds-ambush'],
    zone: 'shattered-vale',
    level: 40,
    reward: {
      xp: 5400,
      gold: 1200,
      item: 'tearborn-heart',
      text: 'The Tearborn shatters, and the Tear shrinks to a crack. Cold air still pulls through it toward the north. Something on the far side is holding it open, wherever the Herald has taken Elyra. You keep the Tearborn’s heart, still humming.',
    },
  },
  /* ------------------------------------------------------ Ennis's cabinet */
  {
    id: 'living-glass',
    name: 'Living Glass',
    giver: 'scholar-ennis',
    text: 'Scholar Ennis studies grief shardlings, small creatures of living glass that crawl out of the Tear. The shard at a shardling’s heart keeps singing for a day after it dies. Ennis wants four of these singing shards. Shardlings are thickest in the Crystal Fields, west of Shardwatch.',
    objective: { kind: 'loot', region: 'shattered-vale', item: 'Singing Shard', from: ['rift-shardling'], chance: 0.4, count: 4, label: 'Take Singing Shards from shardlings' },
    // (it was six shards handed over. What they do together is heard: they are set on his frame, one by one)
    then: [
      {
        kind: 'use', region: 'shattered-vale', at: 'scholar-ennis', count: 3, thing: 'altar', verb: 'Set the shard', label: 'Set the shards on Ennis’s tuning frame', secs: 1, spread: 4,
        notes: ['It sings. One note, thin and steady.', 'The second takes up the same note.', 'All of them, one note. Ennis has stopped writing.'],
      },
    ],
    after: ['where-the-rift-bleeds'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1150, gold: 300 },
  },
  {
    id: 'a-matter-of-anatomy',
    name: 'A Matter of Anatomy',
    giver: 'scholar-ennis',
    text: 'Every singing shard sings the same note as the shard golems. Ennis thinks shardlings are seeds, and shard golems are what they grow into. To prove it, he needs golems broken open, and the fallen ones in the Crystal Fields cracked and looked into. They roam all over the Shattered Vale.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 4, enemies: ['shard-golem'], label: 'Break shard golems' },
    // (it was six kills, and the proof was taken on trust. The fallen ones in the Crystal Fields are cracked open and
    // looked into)
    then: [
      {
        kind: 'use', region: 'shattered-vale', at: 'crystal-fields', count: 3, thing: 'ore', verb: 'Crack it open', label: 'Crack open fallen golems in the Crystal Fields', secs: 1.2, spread: 7,
        notes: ['Inside, glass in rings, like a tree’s.', 'At the heart: a shardling’s shard, grown over.', 'This one has two hearts. It was about to split.'],
      },
    ],
    after: ['living-glass'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1200, gold: 310 },
  },
  {
    id: 'the-glass-matron',
    name: 'The Glass Matron',
    giver: 'scholar-ennis',
    text: 'Ennis was right, and shardlings are seeds. They are laid by the Glass Matron, the biggest golem of all, in the middle of the Crystal Fields west of Shardwatch. Stop her, and bring Ennis a piece of her.',
    // (it was one kill. What she has laid is broken first, and she comes to it)
    objective: { kind: 'use', region: 'shattered-vale', at: 'crystal-fields', count: 3, thing: 'ore', verb: 'Smash the clutch', label: 'Smash the Matron’s clutches in the Crystal Fields', secs: 1.1, spread: 6, guards: ['rift-shardling'] },
    then: [{ kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-glass-matron'], label: 'Break the Glass Matron', lair: { at: 'crystal-fields', enemies: ['the-glass-matron'] } }],
    after: ['a-matter-of-anatomy'],
    zone: 'shattered-vale',
    level: 37,
    // (the side story's turn: what Ennis has been cataloguing is not an animal)
    find: {
      name: 'A Shard That Hums a Cradle Song',
      kind: 'relic',
      about: 'Broken from the heart of the Glass Matron in the Crystal Fields. The shardlings’ shards all sing one note, and Ennis took it for the note of their kind. The Matron’s heart sings the whole tune that note belongs to: three slow lines, the cradle song every child in the Vale is sung. The glass did not make it up. It heard it here, before the Tear, and has been growing it ever since.',
    },
    reward: { xp: 2300, gold: 500, item: 'matrons-heartglass', text: 'Ennis listens to the Matron’s heart with his pen in his hand and writes nothing down. He has six drawers of singing shards labelled as seeds. They are one note each of a song somebody sang to a child here. He keeps most of the Matron for his cabinet all the same, and hangs a sliver of her heart on a chain for you.' },
  },
  /* -------------------------------------------------------- Hesk's husband */
  {
    id: 'the-big-one',
    name: 'The Big One',
    giver: 'shardwife-hesk',
    text: 'Hesk’s husband, Davin, gathered shards for the scholars for twenty years. Every spring he swore he would find the biggest shard of all at the Wyrm Spires, in the far north-east of the Shattered Vale. Last spring he went, and he never came back. Go to the Wyrm Spires and find out what happened to him.',
    // (it was a walk to the spires. Davin's own way up is followed by what he left on it)
    objective: {
      kind: 'trail', region: 'shattered-vale', from: 'shardwife-hesk', to: 'wyrm-spires', marks: 3, label: 'Follow Davin’s way to the Wyrm Spires',
      notes: ['A cairn of shards, Davin’s mark scratched on top.', 'His second camp. The fire was laid and never lit.', 'A scrap of his coat, high on the first spire.'],
    },
    then: [
      { kind: 'explore', spot: 'wyrm-spires', label: 'Find the Wyrm Spires' },
      { kind: 'use', region: 'shattered-vale', at: 'wyrm-spires', count: 1, thing: 'books', verb: 'Read', label: 'Read what Davin left in the rock', secs: 1.3, spread: 3, notes: ['A tally-book, wedged in a crack, every page full.'] },
    ],
    find: {
      step: 2,
      name: 'Davin’s Last Tally',
      kind: 'note',
      about: 'Found in a wyrm’s nest at the Wyrm Spires, wrapped around the handle of Davin’s pick. Davin wrote down every shard he ever found, for Hesk to count. This is the last page, and the last entry is from the night he went up.',
      body: ['Spring. First day at the Spires. Three shards, all small.', 'Fourth day. Saw the big one at last, as big as a cart, under the tallest spire. Something sleeps coiled around it.', 'Fifth day. Going up tonight while it sleeps. Then home to Hesk, and I’ll never go out again.'],
      sign: 'Davin',
    },
    after: ['where-the-rift-bleeds'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1150, gold: 300 },
  },
  {
    id: 'wyrms-in-the-spires',
    name: 'Wyrms in the Spires',
    giver: 'shardwife-hesk',
    text: 'Davin’s pick lies in a wyrm’s nest at the Wyrm Spires. Tear wyrms carry off anything that glitters, and Davin wore every shard he ever found. Defeat five Tear wyrms, and go through their nests for his pick.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 5, enemies: ['rift-wyrm'], label: 'Defeat Tear wyrms' },
    // (it was eight kills, so that Hesk could go up for the pick herself. The hero goes through the nests for it)
    then: [
      {
        kind: 'use', region: 'shattered-vale', at: 'wyrm-spires', count: 3, thing: 'nest', verb: 'Search the nest', label: 'Search the wyrms’ nests for Davin’s pick', secs: 1.1, spread: 7, ambush: ['rift-wyrm'],
        notes: ['Buckles, spoons, a child’s mirror. No pick.', 'A shard-gatherer’s lamp, crushed flat.', 'Davin’s pick. His name is burnt into the haft.'],
      },
    ],
    after: ['the-big-one'],
    zone: 'shattered-vale',
    level: 37,
    reward: { xp: 1250, gold: 320 },
  },
  {
    id: 'old-coil',
    name: 'Old Coil',
    giver: 'shardwife-hesk',
    text: 'Under the tallest spire sleeps Old Coil, the oldest wyrm of all, coiled around a hoard of crystal. Hesk is sure it ate Davin. Kill Old Coil at the Wyrm Spires and bring Hesk the biggest crystal from its hoard, the one Davin went up for.',
    // (it was one kill. It sleeps under the tallest spire and is woken by striking it; and the crystal Davin went up for
    // is carried down to her)
    objective: { kind: 'use', region: 'shattered-vale', at: 'wyrm-spires', count: 1, thing: 'ore', verb: 'Strike the spire', label: 'Strike the tallest spire until Old Coil wakes', secs: 1.6, spread: 3, notes: ['The spire rings like a bell. The ground uncoils.'] },
    then: [
      { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['old-coil'], label: 'Kill Old Coil', lair: { at: 'wyrm-spires', enemies: ['old-coil'] } },
      { kind: 'carry', region: 'shattered-vale', from: 'wyrm-spires', to: 'shardwife-hesk', thing: 'ore', verb: 'Take the great crystal', label: 'Carry the crystal Davin went up for down to Hesk', ambush: [['rift-wyrm'], ['rift-stalker', 'rift-stalker']] },
    ],
    after: ['wyrms-in-the-spires'],
    zone: 'shattered-vale',
    level: 38,
    reward: { xp: 2400, gold: 520, item: 'davins-lucky-pick', text: 'Hesk puts the biggest crystal from Old Coil’s hoard on her mantelpiece, for Davin. She gives you his pick.' },
  },
  /* -------------------------------------------------------- Dace's sentries */
  {
    id: 'stalkers-in-the-dark',
    name: 'Stalkers in the Dark',
    giver: 'sergeant-dace',
    text: 'Sergeant Dace has lost four sentries this month, with no trace of any of them. He blames the Tear stalkers: creatures of glass and shadow that blink from place to place and attack from behind. Kill six of them anywhere in the Shattered Vale, and stand one night’s watch at Shardwatch’s gate.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 6, enemies: ['rift-stalker'], label: 'Kill Tear stalkers' },
    // (it was ten kills. Dace loses his sentries at night, on watch: the hero stands one)
    then: [{ kind: 'hold', region: 'shattered-vale', at: 'sergeant-dace', secs: 25, waves: [['rift-stalker'], ['rift-stalker', 'rift-shardling'], ['rift-stalker', 'rift-stalker']], label: 'Stand a night watch at Shardwatch’s gate' }],
    after: ['where-the-rift-bleeds'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1150, gold: 300 },
  },
  {
    id: 'the-vale-watch',
    name: 'The Old Watch',
    giver: 'sergeant-dace',
    text: 'Before Shardwatch, the Regent’s soldiers kept the Old Watch, a tower in the south-west of the Shattered Vale. They held it for a hundred years, then abandoned it in a single night. Dace’s missing sentries were last seen walking toward it. Go and search the Old Watch.',
    // (it was a walk to the tower. The sentries walked there, and how they walked is in their tracks)
    objective: {
      kind: 'trail', region: 'shattered-vale', from: 'sergeant-dace', to: 'vale-old-watch', marks: 3, label: 'Follow the missing sentries’ tracks',
      notes: ['Four sets of boots. Walking, not running.', 'A sentry’s lamp, set down neatly on a rock.', 'They went in at the tower door, one by one.'],
    },
    then: [
      { kind: 'explore', spot: 'vale-old-watch', label: 'Find the Old Watch' },
      { kind: 'use', region: 'shattered-vale', at: 'vale-old-watch', count: 1, thing: 'books', verb: 'Read', label: 'Read what is pinned to the tower door', secs: 1.3, spread: 3, notes: ['A note, in a sentry’s hand, pinned with his own knife.'] },
    ],
    find: {
      step: 2,
      name: 'A Sentry’s Last Note',
      kind: 'note',
      about: 'Found inside the door of the Old Watch, under four Shardwatch badges hung on nails. One of Dace’s missing sentries wrote it on the back of a duty roster.',
      body: ['Sergeant,', 'We followed a light out here. It moved like a man carrying a lamp.', 'It isn’t a man. It is in two places at once, and it hunts at night.', 'Corin and Bel are gone. Tam and I are holding the door. If you find this, don’t send anyone else.'],
      sign: 'Ash, sentry of Shardwatch',
    },
    after: ['stalkers-in-the-dark'],
    zone: 'shattered-vale',
    level: 37,
    reward: { xp: 1200, gold: 310 },
  },
  {
    id: 'the-flicker',
    name: 'The Flicker',
    giver: 'sergeant-dace',
    text: 'The oldest Tear stalker of all, the Flicker, has made the Old Watch its lair. It moves so fast it seems to be in two places at once. It took all four of Dace’s sentries, and their badges hang inside the tower door. Kill the Flicker at the Old Watch, in the south-west.',
    // (it was one kill. It steps out of the dark: the tower's lamps are lit so that it has none; and the badges are
    // taken down for Dace)
    objective: { kind: 'use', region: 'shattered-vale', at: 'vale-old-watch', count: 3, thing: 'lantern', verb: 'Light', label: 'Light the Old Watch’s lamps, so it has no dark to step from', secs: 1.1, spread: 5, ambush: ['rift-stalker'] },
    then: [
      { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-flicker'], label: 'Kill the Flicker', lair: { at: 'vale-old-watch', enemies: ['the-flicker'] } },
      { kind: 'use', region: 'shattered-vale', at: 'vale-old-watch', count: 1, thing: 'bones', verb: 'Take them down', label: 'Take the sentries’ badges down from the door', secs: 1.3, spread: 2, notes: ['Four badges. Dace will want every one.'] },
    ],
    after: ['the-vale-watch'],
    zone: 'shattered-vale',
    level: 38,
    reward: { xp: 2350, gold: 510, item: 'sentrys-oath', text: 'Dace fixes the four sentries’ badges to a watch helm and gives it to you, so that someone still wears them.' },
  },
];

export const SHATTERED_VALE_NPCS: Record<string, NpcDef> = {
  'magister-quell': {
    id: 'magister-quell',
    name: 'Magister Quell',
    title: 'Magister of Shardwatch',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'where-the-rift-bleeds', state: 'active' },
        lines: ['Sigrun sent you? Good. I have written to the Crown every month this year, and nobody answered.', 'The Tear is wider than I have ever seen it, and things are climbing out of it.'],
      },
      { when: { quest: 'the-breach-camp', state: 'active' }, lines: ['My sentries see torches east of camp at night, around a crack in the ground that hums.', 'Men in violet robes stand there and sing. Go to the Breach Camp and find out who they are.'] },
      { when: { quest: 'the-heralds-cipher', state: 'active' }, lines: ['The singers are voidcallers, living men who sing the Tear wider for the Herald’s ash-gold.', 'Silence them at the Breach Camp, east of here, before the Tear opens any further.'] },
      {
        when: { quest: 'the-tear', state: 'active' },
        lines: ['The Tear is north of camp, at the top of the Shattered Vale. The Veil sigil is in the glass at its edge.', 'When Elyra takes it, the Tear will open wider. Be ready for whatever comes through.'],
      },
      {
        when: { quest: 'the-heart-of-the-tear', state: 'active' },
        lines: ['I saw the grey light from here. I’m sorry. I should have sent soldiers up with you.', 'The Tearborn is holding the Tear open, and it blinks away when you get close. Kill it at the Tear, and the Tear can start to close.'],
      },
      {
        when: { quest: 'the-heart-of-the-tear', state: 'done' },
        lines: ['The Tear is only a crack now. Shardwatch is safe for the moment.', 'My rods say the far end of it is somewhere in the north. Whatever holds it open is there, and so is Elyra.'],
      },
      { lines: ['This is Shardwatch. Twelve scholars and thirty soldiers watch the Tear from here.', 'Don’t touch the glowing shards. They cut deep.'] },
    ],
  },
  'scholar-ennis': {
    id: 'scholar-ennis',
    name: 'Scholar Ennis',
    title: 'Scholar of the Tear',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Ennis’s Cabinet',
    talk: [
      {
        when: { quest: 'the-heralds-cipher', state: 'active' },
        lines: ['Voidcallers. Living men who sing to the Tear for ash-gold. I can hear them from here at night.', 'Every night they sing, my shards ring louder. The Tear is opening. Quell wants them silenced at the Breach Camp.'],
      },
      {
        when: { quest: 'living-glass', state: 'active' },
        lines: ['Quell won’t let me keep a live shardling, so I study dead ones.', 'The shard in a shardling’s heart keeps singing for a day after it dies. Bring me four, quickly, and set them on my frame yourself. My hands shake.'],
      },
      {
        when: { quest: 'a-matter-of-anatomy', state: 'active' },
        lines: ['Every shard sings the same note as the golems. I think shardlings are seeds, and golems are what they grow into.', 'Break four, and crack open the fallen ones out in the Crystal Fields. Tell me what is inside.'],
      },
      {
        when: { quest: 'the-glass-matron', state: 'active' },
        lines: ['I was right. Shardlings are seeds, and the Glass Matron lays them.', 'She sits in the middle of the Crystal Fields, west of camp. Stop her, and save me a piece.'],
      },
      { when: { quest: 'the-glass-matron', state: 'done' }, lines: ['The Matron fills eleven drawers of my cabinet. Thank you.', 'I have taken the word “seeds” off the labels. I don’t yet know what to write instead.', 'Wear that sliver of her heart. It hums when it’s cold.'] },
      { lines: ['Welcome to Ennis’s Cabinet. Charms, rings and curios, most of them from the Tear.', 'I’ve studied everything here. It’s all safe to wear.'] },
    ],
  },
  'shardwife-hesk': {
    id: 'shardwife-hesk',
    name: 'Shardwife Hesk',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bent Spire',
    talk: [
      {
        when: { quest: 'the-big-one', state: 'active' },
        lines: ['My husband, Davin, gathered shards, and I counted them. We did that for twenty years.', 'Last spring he went to the Wyrm Spires, far north-east, to find the biggest shard of all. He never came back.', 'I still warm his supper every night. Please find out what happened to him.'],
      },
      { when: { quest: 'wyrms-in-the-spires', state: 'active' }, lines: ['That’s his hand. “Then home to Hesk.” He always wrote that.', 'His pick is still in that nest. Wyrms take anything that glitters. Thin them out so I can bring it home.'] },
      {
        when: { quest: 'old-coil', state: 'active' },
        lines: ['Old Coil is the biggest wyrm in the Spires. It ate Davin. I’m sure of it.', 'He always said he’d come home with the biggest shard of all. Bring it home for him.'],
      },
      { when: { quest: 'old-coil', state: 'done' }, lines: ['The big crystal is on my mantelpiece. Davin would have loved it.', 'I’ve stopped warming his supper. It’s time.'] },
      { lines: ['Welcome to the Bent Spire. We have beds, potions and hot soup.', 'Stay off the glass when you can. It cuts through boots.'] },
    ],
  },
  'sergeant-dace': {
    id: 'sergeant-dace',
    name: 'Sergeant Dace',
    title: 'Sergeant of the Watch',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-heralds-cipher', state: 'active' },
        lines: ['Those singers at the Breach Camp are the voidcallers. My sentries have watched them for weeks.', 'I can’t spare a soldier from the wall. Silence them for me.'],
      },
      {
        when: { quest: 'stalkers-in-the-dark', state: 'active' },
        lines: ['I’ve lost four sentries this month. No bodies, no blood, nothing.', 'Tear stalkers did it. They blink from place to place and hit you from behind. Kill six of them, and stand a night watch at my gate. I’d like to see what comes for you.'],
      },
      {
        when: { quest: 'the-vale-watch', state: 'active' },
        lines: ['The Old Watch is in the south-west. Our soldiers held it for a hundred years, then left it in one night. Nobody knows why.', 'My missing sentries were seen walking that way. Go and look.'],
      },
      {
        when: { quest: 'the-flicker', state: 'active' },
        lines: ['Ash wrote that. Corin, Bel, Tam and Ash. All four of them, and their badges hanging on nails.', 'The Flicker looks like it’s in two places at once, but only one of them is real. Hit that one.'],
      },
      { when: { quest: 'the-flicker', state: 'done' }, lines: ['I wrote to their families and told them the Flicker is dead.', 'Their badges are on your helm now. Wear it well.'] },
      { lines: ['I’m Sergeant Dace. I command the Regent’s thirty soldiers here at Shardwatch.', 'Stay where my sentries can see you.'] },
    ],
  },
};

/** The low point of Act III: the Pale Herald at the Tear (a fight that is not won), and Fernstead's people reaching the camp. */
export const SHATTERED_VALE_EVENTS: Record<string, StoryEventDef> = {
  'herald-ambush': {
    id: 'herald-ambush',
    region: 'shattered-vale',
    kind: 'raid',
    at: 'tear-top',
    radius: 10,
    level: 41,
    allies: ['elyra', 'cael', 'orren', 'nyx'],
    ends: 55,
    taken: ['elyra'],
    banner: 'The Pale Herald',
    start: [
      { who: 'orren', text: 'Those are the Herald’s shades! He knew we were coming!' },
      { who: 'cael', text: 'Shields up! Keep Elyra in the middle!' },
    ],
    waves: [
      { enemies: ['ashen-assassin', 'ashen-assassin', 'rift-stalker', 'voidcaller'], from: ['tear-n', 'tear-w'], barks: [{ who: 'nyx', text: 'He promised me Wren! He said he’d free my brother if I told him our road!' }, { who: 'cael', text: 'Nyx, what did you do? Fight now. Talk after!' }] },
      { enemies: ['rift-stalker', 'rift-stalker', 'voidcaller', 'ashen-assassin', 'ashen-assassin'], from: ['tear-e', 'tear-n'], leave: ['nyx'], barks: [{ who: 'cael', text: 'Nyx? Where’s Nyx?' }, { who: 'elyra', text: 'She ran into the grey light! She told him where we’d be!' }] },
      { enemies: ['the-pale-herald', 'ashen-assassin', 'rift-stalker', 'voidcaller', 'voidcaller'], from: ['tear-n', 'tear-w', 'tear-e'], barks: [{ who: 'the-pale-herald', text: 'Stand aside. It is only the girl I want.' }, { who: 'orren', text: 'Don’t let him near Elyra!' }, { who: 'cael', text: 'Hold the line! Keep him off her!' }] },
    ],
    end: [
      { who: 'cael', text: 'Elyra! ELYRA!' },
      { who: 'orren', text: 'He took her into the Tear. She’s gone, and the five sigils with her.' },
      { who: 'cael', text: 'The Tear is still opening! More of them are coming through!' },
    ],
    retry: [{ who: 'cael', text: 'Get up. Get up! He hasn’t taken her yet!' }],
  },
  'fern-refugees': {
    id: 'fern-refugees',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-square',
    radius: 18,
    arrive: { pets: ['refugee', 'refugee', 'fern-ranger', 'refugee', 'refugee'], from: 'briar-west', to: 'briar-fern-camp' },
    banner: 'Fernstead’s people',
    start: [{ who: 'fern-ranger', text: 'These are the last of us from Fernstead. Where do we go?' }],
    waves: [],
    end: [{ who: 'mara-venn', text: 'You stay here, with us. Briarhollow takes in everyone who needs it.' }],
  },
};

/** Vaelor's voice in the living world: he holds the Tear until his work there is done. */
export const SHATTERED_VALE_STORY_FOES: Record<string, EnemyDef> = {
  'the-pale-herald': {
    id: 'the-pale-herald',
    name: 'The Pale Herald',
    sprite: 'voidcaller',
    pal: { p: '#f2eefa', P: '#c8c2d8', v: '#ffffff', V: '#e8e4f0' },
    ai: 'caster',
    hp: 4000,
    dmg: 26,
    speed: 40,
    radius: 8,
    mass: 20,
    xp: 0,
    gold: [0, 0],
    aggro: 400,
    reach: 200,
    windup: 0.9,
    recover: 0.8,
    attackCd: 1.6,
    shot: { speed: 80, radius: 5, count: 3, spread: 0.5, color: '#e8e4ff', homing: 1.1 },
    keep: 90,
    named: true,
    scale: 1.4,
    blurb: 'He speaks for King Vaelor in the living world. He is a tall man in white with no face, and he pays traitors in ash-gold. You cannot beat him here.',
  },
};
