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
 * Varn's first scene say plainly what the Three Gates are and why Highwall matters now.
 */
export const HIGHWALL_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-wall-burns',
    name: 'The Wall Burns',
    giver: 'warden-hollis',
    auto: true,
    text: 'At the Tear, the Pale Herald took Elyra and the five sigils she carried. With the Stone that Vosk stole, the Host now holds six of the seven sigils it needs to free the Hallow King. It is also besieging Highwall, the first of the Three Gates that keep the King’s army out of Aster. The Regent has put Mara in command of the army sent to save it. Ride ahead of her to Highwall March, east of the Shattered Vale, and report to Lord-Commander Varn at the relief camp.',
    objective: { kind: 'talk', npc: 'lord-commander-varn', label: 'Report to Lord-Commander Varn at the relief camp' },
    after: ['fern-retaken'],
    level: 40,
    reward: { xp: 1500, gold: 450 },
  },
  {
    id: 'mara-commands',
    name: 'The Captain of the Relief',
    giver: 'lord-commander-varn',
    auto: true,
    text: 'Mara reached the relief camp an hour after you. She commands the whole relief army now, Varn’s soldiers included. She has already moved every tent out of range of the Host’s catapults. Go and hear her plan to break the siege.',
    objective: { kind: 'talk', npc: 'captain-mara', label: 'Report to Mara Venn at the relief camp' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1400, gold: 320, text: 'Mara’s plan has three steps. Break the Host’s trench in the west. Send Cael and the riders through the gap. Then take the army into Highwall through the Breach. Cael asks to lead the riders, and Mara says yes.' },
  },

  /* ------------------------------------------- after the first Gate: Nyx comes back */
  {
    id: 'gate-nyx-returns',
    name: 'Under a White Rag',
    giver: 'captain-mara',
    auto: true,
    text: 'Mara has sent a rider with news. Someone is walking up the road to the relief camp under a white rag, asking for you by name. Go back to the relief camp and see who it is.',
    objective: { kind: 'event', event: 'nyx-returns', label: 'Meet the stranger at the relief camp' },
    after: ['cael-the-sortie'],
    zone: 'highwall',
    level: 44,
    reward: { xp: 900, gold: 200, text: 'It’s Nyx, who sold your road to the Herald at the Tear. She has a split lip and a rolled-up map under her arm. Two of Varn’s soldiers hold her by the arms.' },
  },
  {
    id: 'gate-the-prison-map',
    name: 'The Herald’s Map',
    giver: 'captain-mara',
    auto: true,
    text: 'Nyx is in a tent under guard. She says the map she brought shows where Elyra is, and she wants to explain it to you. Mara is too angry to listen to her. Go to Nyx’s tent and talk to her.',
    objective: { kind: 'talk', npc: 'nyx-returned', label: 'Talk to Nyx in the relief camp' },
    after: ['gate-nyx-returns'],
    zone: 'highwall',
    level: 44,
    reward: {
      xp: 1800,
      gold: 400,
      text: 'The map is the Pale Herald’s own. It shows a road north from the Shattered Vale to the Gloam Gate, and a cell under the gatehouse marked “KEPT.” That is where Elyra is. Mara decides to break the siege first, because Highwall will fall if the army leaves now. Then you go for Elyra.',
    },
  },

  /* ------------------------------------------------------- the siege */
  {
    id: 'ashes-of-ashby',
    name: 'Ashes of Ashby',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'Ashby, a village south-west of the camp, burned last night. Varn’s lookouts saw figures walking into the smoke, and nobody came out. Go to Burned Ashby and look for survivors.',
    objective: { kind: 'explore', spot: 'burned-village', label: 'Search Burned Ashby' },
    after: ['mara-commands'],
    zone: 'highwall',
    reward: { xp: 1700, gold: 460 },
  },
  {
    id: 'captain-hollowbane',
    name: 'Captain Hollowbane',
    giver: 'lord-commander-varn',
    text: 'Ashby’s dead were marched west to the Host Lines, where Captain Hollowbane holds the Host’s trench. While he holds it, the relief army can’t reach the Breach in Highwall’s wall. Defeat Hollowbane at the Host Lines, in the far west of the March.',
    objective: { kind: 'kill', region: 'highwall', count: 1, enemies: ['captain-hollowbane'], label: 'Defeat Captain Hollowbane at the Host Lines' },
    after: ['ashes-of-ashby'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3000, gold: 700, item: { rarity: 'rare' } },
  },
  {
    id: 'cael-the-sortie',
    name: 'The Sortie',
    giver: 'captain-mara',
    auto: true,
    text: 'Hollowbane is dead and his trench is broken. Mara won’t give the Host a night to repair it. Cael is leading the riders out against the Host’s lines in front of the Breach, with Hearthstead’s riders and Fernstead’s rangers. Ride at his side and open the way to the wall.',
    objective: { kind: 'event', event: 'highwall-sortie', label: 'Ride out with Cael and break the lines before the Breach' },
    // (after Hollowbane: its text and the next quest's begin with his trench broken)
    after: ['captain-hollowbane'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2800, gold: 600, item: { rarity: 'rare' }, text: 'The Host’s lines break. Cael rides back through the camp, and the old soldiers bang their shields for him. Ten years ago he was blamed for the fall of the Ninefold Watch. Tonight they cheer him.' },
  },

  {
    id: 'the-breach',
    name: 'The Breach',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'Mara has decided to break the siege first, and then go for Elyra. With Hollowbane dead and the Host’s lines broken, there is finally a way to the walls. The Breach is the hole the Host smashed in Highwall’s outer wall, north-west of the camp. Go there and see what guards it.',
    objective: { kind: 'explore', spot: 'the-breach', label: 'Go to the Breach, north-west of the camp' },
    after: ['gate-the-prison-map'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 1900, gold: 520 },
  },
  {
    id: 'the-siege-breaker',
    name: 'The Siege-Breaker',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'The Siege-Breaker made the Breach. It is a giant ram of bone and iron, and it is battering the gate of Highwall’s inner ward. The last of the garrison is holding out behind that gate. Go in through the Breach and destroy the Siege-Breaker before the gate falls.',
    objective: { kind: 'boss', boss: 'the-siege-breaker', label: 'Go through the Breach and defeat the Siege-Breaker' },
    after: ['the-breach'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3400, gold: 800, item: { rarity: 'rare' } },
  },
  {
    id: 'general-morvain',
    name: 'General Morvain',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'The inner ward’s gate held, and its soldiers have seen help arrive for the first time this summer. General Morvain, who has led the siege for the Hallow King, has come down from the walls to finish it himself. Find him in the Inner Ward and defeat him. Varn is following with every soldier who can still fight.',
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
    reward: { xp: 1800, gold: 470 },
  },
  {
    id: 'the-knights-chapel',
    name: 'The Knights’ Chapel',
    giver: 'chaplain-ottis',
    text: 'One of the tags belongs to Sir Aldo. Ottis buried him at the Knights’ Chapel, north-east of the camp, early in the siege. The chapel bell hasn’t rung since. Go and check the knights’ graves.',
    objective: { kind: 'explore', spot: 'knights-chapel', label: 'Visit the Knights’ Chapel north-east of the camp' },
    after: ['names-of-the-fallen'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1400, gold: 440 },
  },
  {
    id: 'last-rites',
    name: 'Last Rites',
    giver: 'chaplain-ottis',
    text: 'The knights’ graves are open and empty. The Host raised Highwall’s dead knights, and now they fight for General Morvain. Ottis can’t bury a knight who won’t stay down. Defeat five death knight initiates near the Knights’ Chapel or anywhere on the March, and he will read the rites.',
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
        lines: ['You came ahead of Mara Venn’s army? Good. I’m Varn, Lord-Commander of Highwall.', 'Highwall is behind that smoke. The Host has had it under siege all summer, and my soldiers can’t break through.'],
      },
      {
        when: { quest: 'ashes-of-ashby', state: 'active' },
        lines: ['Ashby burned last night, south-west of here. My lookouts saw figures walking into the smoke.', 'Go and look. If anyone is still alive, bring them here.'],
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
        lines: ['The inner ward held. My soldiers saw you and cheered. I haven’t heard that in months.', 'Morvain has come down from the walls to finish this himself. Find him and stop him. I’ll be right behind you.'],
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
        lines: ['The graves are empty. The Host raised our knights, and now they fight for Morvain.', 'I can’t read the rites over a knight who won’t stay down. Defeat five of them, and I’ll do the rest.'],
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
          'This is the Herald’s own map. It shows where he keeps Elyra, in the cells under the Gloam Gate.',
          'He gave it to me himself. He wants me to lead you to the front of that Gate, where his Gatewarden waits.',
          'If I do, he says he’ll free my brother Wren.',
          'It’s a trap, and now you know it. The map is still real, and I can still get you in.',
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
          'Varn’s army has waited outside the walls all summer. We’re going to break the siege instead.',
        ],
      },
      { when: { quest: 'gate-nyx-returns', state: 'active' }, lines: ['Someone is walking up the road under a white rag, asking for you by name.', 'My guards are holding them at the edge of the camp. Go and see who it is.'] },
      { when: { quest: 'gate-the-prison-map', state: 'active' }, lines: ['Nyx sold Elyra to the Herald. Now she walks back into my camp with a map.', 'I’m too angry to listen to her. You talk to her, and then tell me if we can trust it.'] },
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['Take the north road out of the Shattered Vale. It crosses the Riftscar Wastes to Lastlight, and then to the Gloam Gate.', 'Cael and Orren will join you there. Bring Elyra home. Bring Nyx back too. I don’t trust her, but I don’t want her dead.'] },
      { when: { quest: 'cael-the-sortie', state: 'active' }, lines: ['Cael leads the riders out. You ride at his side.', 'Break the Host’s lines in front of the Breach. I’ll be watching from the ridge.'] },
      { when: { quest: 'general-morvain', state: 'done' }, lines: ['Highwall holds. Half the army is in the field hospital, but we held.', 'Elyra is in the Gloam Gate. Go and bring her home.'] },
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
    end: [{ who: 'cael', text: 'The way to the Breach is open. Tell Mara her plan worked.' }],
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
