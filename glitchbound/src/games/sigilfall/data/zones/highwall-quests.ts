import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The relief camp's people and the quests of Highwall March (see WORLD.md). General Morvain's half of the
 * Ashen Host has Highwall under siege, and Lord-Commander Varn holds the camp outside its walls with what
 * is left of the field army. The main chain runs from burned Ashby through the Bone Batteries and the
 * Host's trenches to the Breach, and through it into the besieged city (the Siege of Highwall),
 * where the Siege-Breaker batters the inner ward and Morvain commands. Nyx walks back into the camp
 * with the Herald's map (Elyra is in the Gloam Gate's cells; the map is his trap, and she says so), and
 * Mara decides Highwall comes first. Chaplain Ottis wants the names of the dead, and the knights in the
 * chapel graves laid back down. Main chain first. Written to DIALOGUE_STYLE.md: the opening quest and
 * Varn's first scene say plainly what the Three Gates are and why Highwall matters now. v4: what is
 * looked for is found (Ashby's drawing, the prison map, Morvain's orders, Vessant's hymn), and the hunt
 * for Hollowbane starts at Ashby and pays at his trench, so the march runs west without a walk back.
 */
export const HIGHWALL_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-wall-burns',
    name: 'The Wall Burns',
    giver: 'warden-hollis',
    auto: true,
    text: 'At the Tear the Pale Herald took Elyra and her five sigils. With the Stone, the Host now holds six of the seven, and nobody knows where the last one is. Elyra is alive, because the sigils answer only to the one who bonded them. To reach her you must break the siege of Highwall, then take the Gloam Gate, where she is kept. Ride ahead of Mara’s army to Highwall March, east of the Shattered Vale, and report to Lord-Commander Varn.',
    objective: { kind: 'talk', npc: 'lord-commander-varn', label: 'Report to Lord-Commander Varn at the relief camp' },
    after: ['fern-retaken'],
    level: 40,
    reward: { xp: 1500, gold: 450, text: 'Varn has held this camp all summer with what is left of Highwall’s field army, and he can’t break the siege alone. He has read the Regent’s order. He has never met Mara Venn, but he will serve under her.' },
  },
  {
    id: 'mara-commands',
    name: 'The Captain of the Relief',
    giver: 'lord-commander-varn',
    auto: true,
    text: 'Mara reached the relief camp an hour after you, with every banner the Vale could send. By the Regent’s order she commands the whole relief now, Varn’s soldiers too. She has already moved half the tents out of range of the Host’s catapults. Go and hear her plan to break the siege.',
    objective: { kind: 'talk', npc: 'captain-mara', label: 'Report to Mara Venn at the relief camp' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1400, gold: 320, text: 'Mara’s plan has three steps. Break the Host’s trench at the Host Lines in the west. Send Cael and the riders out through the gap. Then take the army into Highwall through the Breach. Cael asks to lead the riders, and Mara says yes.' },
  },

  /* ------------------------------------------- after the first Gate: Nyx comes back */
  {
    id: 'gate-nyx-returns',
    name: 'Under a White Rag',
    giver: 'captain-mara',
    auto: true,
    text: 'Mara has sent a rider after you. Someone is walking up the road to the relief camp alone, under a white rag, and asking for you by name. Go back to the camp and see who it is.',
    objective: { kind: 'event', event: 'nyx-returns', label: 'Meet the stranger at the relief camp' },
    after: ['cael-the-sortie'],
    zone: 'highwall',
    level: 44,
    reward: { xp: 900, gold: 200, text: 'The stranger is Nyx, who sold your road to the Herald at the Tear. She came back alone, with a split lip and a rolled-up map under her arm. Mara has her held in a tent under guard.' },
  },
  {
    id: 'gate-the-prison-map',
    name: 'The Herald’s Map',
    giver: 'captain-mara',
    auto: true,
    text: 'Nyx is in a tent under guard. She says her map shows where the Herald keeps Elyra, and she wants to explain it to you. Mara is too angry to listen to her. Go to Nyx’s tent at the relief camp and talk to her.',
    objective: { kind: 'talk', npc: 'nyx-returned', label: 'Talk to Nyx in the relief camp' },
    after: ['gate-nyx-returns'],
    zone: 'highwall',
    level: 44,
    find: {
      name: 'The Herald’s Prison Map',
      kind: 'map',
      about: 'The Pale Herald’s own map of the Gloam Gate, drawn in grey ink. Nyx carried it into Mara’s camp under a white rag. It shows where Elyra is kept, and when the guards change.',
      body: [
        'THE GLOAM GATE. North from Shardwatch, over the glass, past the lamps of Lastlight.',
        'The gateway: my Gatewarden. Behind him, the vault.',
        'Under the gatehouse: one stair, nine cells.',
        'The guard changes at dusk, and again at the second bell of night.',
        'Cell four: KEPT.',
        'Cell five: The thief’s brother. Promised.',
      ],
    },
    reward: {
      xp: 1800,
      gold: 400,
      text: 'You take the map to Mara, and she reads it with Varn. Varn knows the Herald’s grey ink from orders found on the Host’s dead, and he says the map is real. Mara decides Highwall comes first, because the city will fall if the army leaves now. When the siege is broken, you go north for Elyra, with Nyx and her map.',
    },
  },

  /* ------------------------------------------------------- the siege */
  {
    id: 'ashes-of-ashby',
    name: 'Ashes of Ashby',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'Ashby, a farming village south-west of the camp, burned last night. Varn’s lookouts saw people walking into the smoke, and nobody came out. Go to Burned Ashby and search it for survivors.',
    objective: { kind: 'explore', spot: 'burned-village', label: 'Search Burned Ashby' },
    after: ['mara-commands'],
    zone: 'highwall',
    find: {
      name: 'A Child’s Drawing',
      kind: 'page',
      about: 'Found pinned inside the door of an empty root cellar in Burned Ashby. A child hid down there and drew what she saw through the slats. Whoever drew it is gone too.',
      body: [
        '(Charcoal, on the back of a flour sack. The houses of Ashby, with fire drawn on every roof.)',
        '(A long line of grey people walking out of the village into the smoke, holding hands. Their eyes are two violet dots.)',
        '(Over one of the grey people, in big careful letters:) MAMA',
        '(Under the line, smaller:) they did not look back',
      ],
    },
    reward: { xp: 1700, gold: 460, text: 'There is nobody alive in Ashby, and there are no bodies either. The Host raised the villagers where they fell, and their footprints in the ash lead west, to its trench. Every village it burns makes its army bigger.' },
  },
  {
    id: 'captain-hollowbane',
    name: 'Captain Hollowbane',
    giver: 'lord-commander-varn',
    // (starts at Ashby and pays out at the trench: Ashby's tracks lead straight west to it, and back at the camp there
    // was nothing to hear but the order again)
    auto: true,
    text: 'Ashby’s footprints lead west to the Host Lines, the trench Captain Hollowbane holds in the far west of the March. His crossbows cover every road to the Breach. While he holds the trench, the relief army can’t reach Highwall’s wall. Follow the tracks west from Ashby and defeat him.',
    objective: { kind: 'kill', region: 'highwall', count: 1, enemies: ['captain-hollowbane'], label: 'Defeat Captain Hollowbane at the Host Lines' },
    after: ['ashes-of-ashby'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3000, gold: 700, item: { rarity: 'rare' }, text: 'Hollowbane falls in his trench, and the Host Lines break. Some of the dead who held it still wear Ashby’s aprons and boots. Brother Orren lights a lamp for each of them before you leave.' },
  },
  {
    id: 'cael-the-sortie',
    name: 'The Sortie',
    giver: 'captain-mara',
    auto: true,
    text: 'Hollowbane is dead and his trench is broken. Mara won’t give the Host a night to dig a new one. Cael is leading the riders out at the Host’s lines in front of the Breach, north-west of the camp, with Hearthstead’s riders and Fernstead’s rangers. Ride at his side and open the way to Highwall’s wall.',
    objective: { kind: 'event', event: 'highwall-sortie', label: 'Ride out with Cael and break the lines before the Breach' },
    // (after Hollowbane: its text and the next quest's begin with his trench broken)
    after: ['captain-hollowbane'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2800, gold: 600, item: { rarity: 'rare' }, text: 'The Host’s lines before the Breach break and run. Ten years ago Cael stood on the Ninefold Watch’s wall and waited for a relief that never came. Tonight he led one.' },
  },

  {
    id: 'the-breach',
    name: 'The Breach',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'Cael’s riders broke the Host’s lines, so the way to Highwall’s wall is open. The Breach is the hole the Siege-Breaker smashed in the outer wall, north-west of the camp. It is the only way into the city. Go up to it and see what waits on the other side.',
    objective: { kind: 'explore', spot: 'the-breach', label: 'Go to the Breach, north-west of the camp' },
    after: ['gate-the-prison-map'],
    zone: 'highwall',
    level: 42,
    find: {
      name: 'General Morvain’s Siege Orders',
      kind: 'orders',
      about: 'Found on a dead Host captain at the foot of the Breach, sealed with a grey thumbprint. They are General Morvain’s orders for the last days of the siege. They say why the Host wants Highwall so badly.',
      body: [
        'To the captains before Highwall.',
        'The Herald writes that the warden-girl is taken, and her sigils go north to the Gloam Gate. Six of the seven are the King’s. One more, and Duskspire opens.',
        'When it opens, the King’s road into Aster runs through Highwall. Break the inner gate before the snow.',
        'Leave no one alive to bury the dead. Every soul in that city is a soldier we have not raised yet.',
      ],
      sign: 'Morvain, General of the Host, by the Hallow King’s word',
    },
    reward: { xp: 1900, gold: 520, text: 'The Breach is a ramp of broken stone into the burning city. From somewhere inside comes a slow, heavy booming, like a giant knocking at a door. Varn’s soldiers form up behind you to go in.' },
  },
  {
    id: 'the-siege-breaker',
    name: 'The Siege-Breaker',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'The booming is the Siege-Breaker, the ram of bone and iron that made the Breach. Now it is battering the gate of Highwall’s inner ward, where the last of the garrison is holding out. Go in through the Breach and destroy it before that gate falls.',
    objective: { kind: 'boss', boss: 'the-siege-breaker', label: 'Go through the Breach and defeat the Siege-Breaker' },
    after: ['the-breach'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3400, gold: 800, item: { rarity: 'rare' }, text: 'The Siege-Breaker comes apart on the Muster Field, and the inner ward’s gate holds. On the walls above, the garrison sees the relief inside the city for the first time this summer. They start to bang their shields.' },
  },
  {
    id: 'general-morvain',
    name: 'General Morvain',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'General Morvain has led the siege for the Hallow King since midsummer. Now he has come down from the walls to finish it himself. He waits under his banner in the Inner Ward, past the Chapel of the Wardens. Defeat him. Varn is following with every soldier who can still hold a sword.',
    objective: { kind: 'boss', boss: 'general-morvain', label: 'Defeat General Morvain in the Inner Ward' },
    after: ['the-siege-breaker'],
    zone: 'highwall',
    level: 43,
    reward: {
      xp: 6600,
      gold: 1600,
      item: 'highwall-greathelm',
      text: 'Morvain falls in the Inner Ward. Highwall’s garrison charges out to meet Varn’s soldiers at the Breach, and the Host outside the walls flees north. Varn gives you the greathelm he wore on these walls for twenty years.',
    },
  },
  /* -------------------------------------------- Quartermaster Bess's stores */
  /* -------------------------------------------------- Chaplain Ottis's dead */
  {
    id: 'names-of-the-fallen',
    name: 'Names of the Fallen',
    giver: 'chaplain-ottis',
    text: 'The Host’s soldiers on the March wear Highwall’s tabards. They are the garrison’s own dead, raised to attack their city. Every Highwall soldier wore a tin tag with their name on it. Chaplain Ottis wants six tags back, so their families can stop waiting for news.',
    objective: { kind: 'loot', region: 'highwall', item: 'Garrison Tag', from: ['legion-soldier'], chance: 0.35, count: 6, label: 'Recover Garrison Tags from Ashen soldiers' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1800, gold: 470, text: 'Ottis reads each name aloud and writes it in his book. Tonight six families will stop waiting at the window.' },
  },
  {
    id: 'the-knights-chapel',
    name: 'The Knights’ Chapel',
    giver: 'chaplain-ottis',
    text: 'One of the tags belongs to Sir Aldo. Ottis buried him at the Knights’ Chapel, north-east of the camp, early in the siege, and the chapel bell hasn’t rung since. Go and check the knights’ graves.',
    objective: { kind: 'explore', spot: 'knights-chapel', label: 'Visit the Knights’ Chapel north-east of the camp' },
    after: ['names-of-the-fallen'],
    zone: 'highwall',
    level: 41,
    // (paid at the chapel: the knights who climbed out of these graves are fought right here, and Ottis hears of both
    // when they are laid down)
    turnIn: false,
    find: {
      name: 'The Burial Hymn, Changed',
      kind: 'page',
      about: 'Left on the altar of the Knights’ Chapel, beside the open graves. It is Highwall’s old burial hymn in Prior Vessant’s hand, with one word changed in every verse. Vessant was the city’s prior before the siege.',
      body: [
        'Lay down your shield, the wall is held. Your watch is done. (“Rest” is crossed out.) Rise.',
        'Your name is said, your debt is paid. Lie still and (“rest” is crossed out) rise.',
        '(In the margin, in the same hand:) He promised me my brother back.',
      ],
    },
    reward: { xp: 1400, gold: 440, text: 'Every knight’s grave in the chapel yard is open and empty, Sir Aldo’s too. Prior Vessant sang them up out of the ground to fight for General Morvain. Some of them still walk the chapel yard, as if they were keeping watch.' },
  },
  {
    id: 'last-rites',
    name: 'Last Rites',
    giver: 'chaplain-ottis',
    text: 'Highwall’s dead knights walk the March now, as death knights of the Host. Ottis can’t bury a knight who won’t stay down. Defeat five death knight initiates around the Knights’ Chapel or anywhere on the March, then go back to Ottis at the relief camp so he can read the true rites.',
    objective: { kind: 'kill', region: 'highwall', count: 5, enemies: ['death-knight-initiate'], label: 'Defeat death knight initiates' },
    after: ['the-knights-chapel'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2400, gold: 600, item: 'ottis-prayer-beads', text: 'Ottis reads the rites at the chapel and rings the bell. He gives you the prayer beads he used to count the dead.' },
  },
];

export const HIGHWALL_NPCS: Record<string, NpcDef> = {
  'lord-commander-varn': {
    id: 'lord-commander-varn',
    name: 'Lord-Commander Varn',
    title: 'Lord-Commander of Highwall',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-wall-burns', state: 'active' },
        lines: ['You rode ahead of Mara Venn’s army? Good. I’m Varn, Lord-Commander of Highwall.', 'Highwall is behind that smoke. Thirty thousand people are inside it, and the Host has kept them there all summer.'],
      },
      {
        when: { quest: 'ashes-of-ashby', state: 'active' },
        lines: ['Ashby burned last night, south-west of here. My lookouts saw people walking into the smoke, slowly, like a funeral.', 'Go and look. If anyone is still alive, bring them here.'],
      },
      {
        when: { quest: 'captain-hollowbane', state: 'active' },
        lines: ['Captain Hollowbane holds the Host’s trench at the Host Lines, in the far west.', 'His crossbows cover every road to the Breach. Kill him, and we can reach the walls.'],
      },
      {
        when: { quest: 'the-breach', state: 'active' },
        lines: ['The trench is broken. For the first time this summer, we can reach the walls.', 'The Breach is north-west of here. The Host goes into the city through it, and so will we.'],
      },
      {
        when: { quest: 'the-siege-breaker', state: 'active' },
        lines: ['The Siege-Breaker is inside the walls, battering the gate of the inner ward. It’s a ram the size of a gatehouse.', 'The last of my garrison is behind that gate. Destroy the thing before the gate breaks.'],
      },
      {
        when: { quest: 'general-morvain', state: 'active' },
        lines: ['The inner ward held. My soldiers on the walls cheered when they saw you. I heard it from here.', 'Morvain has come down from the walls to finish this himself. Find him and stop him. I’ll be right behind you.'],
      },
      {
        when: { quest: 'the-long-night-ends', state: 'active' },
        lines: ['Morvain is dead, and his army is running north. I watched them go from the gate.', 'Mara commanded the relief. She should hear it from you. Go and tell her Highwall holds.'],
      },
      {
        when: { quest: 'the-long-night-ends', state: 'done' },
        lines: ['Highwall holds, thanks to you and Mara. My soldiers are already rebuilding the wall.', 'When you come back from the north, come through Highwall. We’ll welcome you properly.'],
      },
      { when: { quest: 'the-long-night-ends', state: 'offered' }, lines: ['Morvain is dead and his army is running north. Mara commanded the relief. Go and tell her.'] },
      {
        when: { quest: 'the-wall-burns', state: 'done' },
        lines: ['This camp is what’s left of Highwall’s field army, with a field hospital and Bess’s supply wagons.', 'Thirty thousand people are trapped in Highwall. They’re waiting for us to break the siege.'],
      },
      { lines: ['If you need weapons, see Quartermaster Bess. If you need healing, see Chaplain Ottis.', 'Highwall guards the road from Vaelmoor into Aster. While its walls stand, the Host can’t march south.'] },
    ],
  },
  'quartermaster-bess': {
    id: 'quartermaster-bess',
    name: 'Quartermaster Bess',
    title: 'Quartermaster',
    sprite: 'villager',
    shop: 'weapons',
    shopName: 'The Relief Armory',
    talk: [
      { lines: ['This is the Relief Armory. I have blades, bows, staves and shields.', 'Everything here is for the relief army. Take what you need to break the siege.'] },
    ],
  },
  'chaplain-ottis': {
    id: 'chaplain-ottis',
    name: 'Chaplain Ottis',
    title: 'Chaplain',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Field Hospital',
    talk: [
      {
        when: { quest: 'names-of-the-fallen', state: 'active' },
        lines: ['Have you looked at the Host’s soldiers? Under the rot, they wear our tabards. They’re Highwall’s own dead.', 'Every soldier here wore a tin tag with their name on it. Bring me six, and I can tell their families.'],
      },
      {
        when: { quest: 'the-knights-chapel', state: 'active' },
        lines: ['This is Sir Aldo’s tag. I buried him myself, at the Knights’ Chapel north-east of the camp.', 'The chapel bell hasn’t rung since. Please go and check the graves.'],
      },
      {
        when: { quest: 'last-rites', state: 'active' },
        lines: ['Empty graves, and Vessant’s hymn on the altar? He was Highwall’s prior before the siege. He buried those knights himself.', 'I can’t read the rites over a knight who won’t stay down. Defeat five of them, and I’ll do the rest.'],
      },
      { when: { quest: 'general-morvain', state: 'done' }, lines: ['The siege is over. Everyone in these beds is going to live.'] },
      { when: { quest: 'last-rites', state: 'done' }, lines: ['I rang the chapel bell. The soldiers in the camp heard it and took off their helmets.'] },
      { lines: ['This is the field hospital. We have beds, bandages and potions.', 'Take the potions you need, and come back alive.'] },
    ],
  },
  // Nyx after Highwall: come back to Mara's camp with the Herald's map, to make it right (STORY_BIBLE.md §2)
  'nyx-returned': {
    id: 'nyx-returned',
    name: 'Nyx',
    title: 'Under guard',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'gate-the-prison-map', state: 'active' },
        lines: [
          'That’s the Herald’s own map of the Gloam Gate. Elyra is in a cell under the gatehouse. He wrote “KEPT” on her door.',
          'He gave it to me himself and let me go. He wants me to lead you up to the Gate’s front, where his Gatewarden waits.',
          'If I do, he says he’ll free my brother Wren. He said that at the Tear too.',
          'So the map is bait. It’s also true. Every cell and every guard change on it is right, and I know another way in.',
        ],
      },
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['The road on the map starts north of the Shattered Vale. I’ll meet you at Lastlight.'] },
      { lines: ['Mara’s guards watch me even while I eat. I understand why. When Highwall is safe, I’ll take you to the Gloam Gate.'] },
    ],
  },
  // Mara Venn, battlefield captain of the coalition (STORY_BIBLE.md §2), commanding the relief
  'captain-mara': {
    id: 'captain-mara',
    name: 'Mara Venn',
    title: 'Captain of the relief',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'mara-commands', state: 'active' },
        lines: [
          'I didn’t ask for this. The Regent wanted someone who comes when she’s called, and I came.',
          'Varn’s army has waited outside these walls all summer. We break the siege, and then we go north for Elyra.',
        ],
      },
      { when: { quest: 'gate-nyx-returns', state: 'active' }, lines: ['Someone is walking up the road under a white rag, asking for you by name.', 'My guards are holding them at the edge of the camp. Go and see who it is.'] },
      { when: { quest: 'gate-the-prison-map', state: 'active' }, lines: ['Nyx sold Elyra to the Herald. Now she walks back into my camp with a map.', 'I’m too angry to listen to her. You talk to her, and then tell me if we can trust it.'] },
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['Take the north road out of the Shattered Vale. It crosses the Riftscar Wastes to Lastlight, and then to the Gloam Gate.', 'Cael and Orren will join you there. Bring Elyra home. Bring Nyx back too. I don’t trust her, but I don’t want her dead.'] },
      { when: { quest: 'cael-the-sortie', state: 'active' }, lines: ['Cael leads the riders out. You ride at his side.', 'Break the Host’s lines in front of the Breach. I’ll be watching from the ridge.'] },
      { when: { quest: 'the-long-night-ends', state: 'active' }, lines: ['You came back. Say it. Does Highwall hold?', 'Sit with me a moment. I haven’t sat down since Fernstead.'] },
      { when: { quest: 'general-morvain', state: 'done' }, lines: ['Highwall holds. Half the army is in the field hospital, but it holds.', 'Elyra is behind the next gate. Go and bring her home.'] },
      { lines: ['Shields together, and never step back first. Cael taught me that.', 'We break this siege first. Then we find Elyra and bring her home.'] },
    ],
  },
};

/** Cael's sortie before the Breach (Act IV, the first Gate). */
export const HIGHWALL_EVENTS: Record<string, StoryEventDef> = {
  'highwall-sortie': {
    id: 'highwall-sortie',
    region: 'highwall',
    kind: 'raid',
    at: 'sortie-ground',
    radius: 12,
    level: 43,
    allies: ['cael', 'hearth-rider', 'hearth-rider', 'fern-ranger', 'fern-ranger'],
    banner: 'The Sortie!',
    start: [
      { who: 'cael', text: 'For the Ninefold Watch, and for Corvane! Riders, with me!' },
      { who: 'hearth-rider', text: 'Hearthstead rides! Go, go, go!' },
    ],
    waves: [
      { enemies: ['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], from: ['sortie-n', 'sortie-w'] },
      { enemies: ['death-knight-initiate', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'bone-catapult'], from: ['sortie-w', 'sortie-e'], barks: [{ who: 'cael', text: 'The catapult! Ride it down before it finds its range!' }] },
      { enemies: ['legion-ensign', 'death-knight-initiate', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], from: ['sortie-n', 'sortie-e', 'sortie-w'], barks: [{ who: 'fern-ranger', text: 'Their standard-bearer! Cut it down, or their dead keep getting up!' }] },
    ],
    end: [{ who: 'cael', text: 'Their line is broken! The way to the Breach is open!' }],
    retry: [{ who: 'cael', text: 'Rally! Rally on me! We go again!' }],
  },
  'nyx-returns': {
    id: 'nyx-returns',
    region: 'highwall',
    kind: 'arrival',
    at: 'relief-camp',
    radius: 16,
    arrive: { pets: ['nyx', 'highwall-soldier', 'highwall-soldier'], from: 'relief-road', to: 'relief-tents' },
    banner: 'Under a white rag',
    // (what is said as they come in is said in the shot of it, data/scenes.ts)
    start: [],
    waves: [],
    end: [],
  },
};
