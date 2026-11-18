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
    text: 'With the Ash Crown unmade, the Tear is finally closing. As it closes, it has let go of something it held at the very bottom: a man in a white coat, kneeling, with his face in his hands. Quell’s brass rods all point at him, and the grieflight around him is growing. Go to the Tear and face him before it closes over him.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-heralds-first-face'], label: 'Face the man at the bottom of the Tear' },
    // postgame (Act VI's thread): what Aurel wore under the Herald's white for three hundred years
    find: {
      name: 'Aurel’s Harbor Badge',
      kind: 'relic',
      about: 'A harbor-master’s badge of tarnished brass, found in the snow where the man in white knelt at the bottom of the Tear. Aurel wore it under the Pale Herald’s coat for three hundred years. It is cold, like ash-gold, and weighs almost nothing.',
      body: ['AUREL OF VAELMOOR, MASTER OF THE HARBOR', 'No ship passes the chain without his word.'],
    },
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 8000, gold: 3000, item: { rarity: 'legendary' }, text: 'The man was what was left of Aurel at the Tear: his grief, too heavy to go home with the rest when the Crown was unmade. When it breaks, he lifts his face at last, and it is only a tired young harbor-master’s. Quell lets the Tear close over him gently and writes his name in Shardwatch’s book.' },
  },
  /* ---------------------------------------------------------- the way in */
  {
    id: 'where-the-rift-bleeds',
    name: 'Shardwatch',
    giver: 'jarl-sigrun',
    text: 'Elyra now carries four sigils, and the Host still has one. The last place on the wardens’ map is the Tear, a rip in the sky over the Shattered Vale, south of Rimeheld. The Sigil of the Veil has held it shut for three hundred years. Take the south road out of Rimeheld and find Magister Quell at Shardwatch.',
    offer: ['The last place on your map is the Tear, in the Shattered Vale, south of here.', 'Magister Quell watches the Tear from Shardwatch. Go to him.', 'One more thing. A letter in grey ink came to my gate for Nyx. She read it and burned it. Keep an eye on her.'],
    objective: { kind: 'talk', npc: 'magister-quell', label: 'Talk to Magister Quell in Shardwatch' },
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
    objective: { kind: 'explore', spot: 'breach-camp', label: 'Go to the Breach Camp, east of Shardwatch' },
    find: {
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
    objective: { kind: 'kill', region: 'shattered-vale', count: 4, enemies: ['voidcaller'], label: 'Silence the voidcallers at the Breach Camp' },
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
    objective: { kind: 'explore', spot: 'the-tear', label: 'Go to the Tear, north of Shardwatch' },
    after: ['the-heralds-cipher'],
    zone: 'shattered-vale',
    level: 39,
    // (no page of its own: the fight at the Tear begins the moment the hero reaches it, and its opening shot
    // shows Elyra pulling the sigil out of the glass; data/scenes.ts tear-the-light-is-wrong)
    reward: { xp: 1300, gold: 340, item: { rarity: 'rare' } },
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
    objective: { kind: 'event', event: 'fern-refugees', label: 'Meet Fernstead’s people at Briarhollow' },
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
    text: 'The Herald is gone, and without the Veil sigil the Tear is wide open. A huge creature stands in the opening and holds it wide: the Tearborn, made of everything that ever came through. Kill it at the Tear so the Tear can start to close. Then you can go after Elyra.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-tearborn'], label: 'Kill the Tearborn at the Tear' },
    find: {
      name: 'Maren’s Letter',
      kind: 'letter',
      about: 'A runner from Shardwatch brought it up to the Tear as the Tearborn fell. Elder Maren wrote it the night Fernstead burned. It was the same night the Herald took Elyra.',
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
    text: 'Scholar Ennis studies grief shardlings, small creatures of living glass that crawl out of the Tear. The shard at a shardling’s heart keeps singing for a day after it dies. Ennis wants six of these singing shards. Shardlings are thickest in the Crystal Fields, west of Shardwatch.',
    objective: { kind: 'loot', region: 'shattered-vale', item: 'Singing Shard', from: ['rift-shardling'], chance: 0.4, count: 6, label: 'Take Singing Shards from shardlings' },
    after: ['where-the-rift-bleeds'],
    zone: 'shattered-vale',
    level: 36,
    reward: { xp: 1150, gold: 300 },
  },
  {
    id: 'a-matter-of-anatomy',
    name: 'A Matter of Anatomy',
    giver: 'scholar-ennis',
    text: 'Every singing shard sings the same note. Ennis thinks shardlings are seeds, and shard golems are what they grow into. To prove it, he needs six golems broken open. They roam all over the Shattered Vale.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 6, enemies: ['shard-golem'], label: 'Break open shard golems' },
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
    objective: { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-glass-matron'], label: 'Break the Glass Matron in the Crystal Fields' },
    after: ['a-matter-of-anatomy'],
    zone: 'shattered-vale',
    level: 37,
    reward: { xp: 2300, gold: 500, item: 'matrons-heartglass', text: 'Ennis keeps most of the Matron for his cabinet. He hangs a sliver of her heart on a chain for you.' },
  },
  /* -------------------------------------------------------- Hesk's husband */
  {
    id: 'the-big-one',
    name: 'The Big One',
    giver: 'shardwife-hesk',
    text: 'Hesk’s husband, Davin, gathered shards for the scholars for twenty years. Every spring he swore he would find the biggest shard of all at the Wyrm Spires, in the far north-east of the Shattered Vale. Last spring he went, and he never came back. Go to the Wyrm Spires and find out what happened to him.',
    objective: { kind: 'explore', spot: 'wyrm-spires', label: 'Look for Davin at the Wyrm Spires' },
    find: {
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
    text: 'Davin’s pick lies in a wyrm’s nest at the Wyrm Spires. Tear wyrms carry off anything that glitters, and Davin wore every shard he ever found. Defeat eight Tear wyrms so Hesk can bring his pick home.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 8, enemies: ['rift-wyrm'], label: 'Defeat Tear wyrms' },
    after: ['the-big-one'],
    zone: 'shattered-vale',
    level: 37,
    reward: { xp: 1250, gold: 320 },
  },
  {
    id: 'old-coil',
    name: 'Old Coil',
    giver: 'shardwife-hesk',
    text: 'Under the tallest spire sleeps the oldest wyrm of all, coiled around a hoard of crystal: Old Coil. Hesk is sure it ate Davin. He always swore he would come home with the biggest shard of all. Kill Old Coil at the Wyrm Spires and bring Hesk the biggest crystal from its hoard.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['old-coil'], label: 'Kill Old Coil at the Wyrm Spires' },
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
    text: 'Sergeant Dace has lost four sentries this month, with no trace of any of them. He blames the Tear stalkers: creatures of glass and shadow that blink from place to place and attack from behind. Kill ten of them anywhere in the Shattered Vale.',
    objective: { kind: 'kill', region: 'shattered-vale', count: 10, enemies: ['rift-stalker'], label: 'Kill Tear stalkers' },
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
    objective: { kind: 'explore', spot: 'vale-old-watch', label: 'Search the Old Watch in the south-west' },
    find: {
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
    objective: { kind: 'kill', region: 'shattered-vale', count: 1, enemies: ['the-flicker'], label: 'Kill the Flicker at the Old Watch' },
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
        lines: ['Sigrun sent you? Good. I wrote to the Crown eleven times this year, and nobody answered.', 'The Tear is wider than I have ever seen it, and things are climbing out of it.'],
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
        lines: ['Quell won’t let me keep a live shardling, so I study dead ones.', 'The shard in a shardling’s heart keeps singing for a day after it dies. Bring me six, quickly.'],
      },
      {
        when: { quest: 'a-matter-of-anatomy', state: 'active' },
        lines: ['Every shard sings the same note. I think shardlings are seeds, and golems are what they grow into.', 'Break six golems open, and I can prove it.'],
      },
      {
        when: { quest: 'the-glass-matron', state: 'active' },
        lines: ['I was right. Shardlings are seeds, and the Glass Matron lays them.', 'She sits in the middle of the Crystal Fields, west of camp. Stop her, and save me a piece.'],
      },
      { when: { quest: 'the-glass-matron', state: 'done' }, lines: ['The Matron fills eleven drawers of my cabinet. Thank you.', 'Wear that sliver of her heart. It hums when it’s cold.'] },
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
        lines: ['I’ve lost four sentries this month. No bodies, no blood, nothing.', 'Tear stalkers did it. They blink from place to place and hit you from behind. Kill ten of them.'],
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
      { enemies: ['the-pale-herald', 'ashen-assassin', 'rift-stalker', 'voidcaller', 'voidcaller'], from: ['tear-n', 'tear-w', 'tear-e'], barks: [{ who: 'the-pale-herald', text: 'You carry five of my king’s sigils, girl. You will carry them to him.' }, { who: 'orren', text: 'Don’t let him near Elyra!' }, { who: 'cael', text: 'Hold the line! Keep him off her!' }] },
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
    start: [{ who: 'fern-ranger', text: 'This is everyone who got out of Fernstead. Where do we go?' }],
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
