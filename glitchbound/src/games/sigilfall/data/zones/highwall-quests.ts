import type { NpcDef, QuestDef } from '../types';

/**
 * The relief camp's people and the quests of Highwall March (see WORLD.md). General Morvain's Hollow
 * Legion has Highwall under siege, and Lord-Commander Varn holds the camp outside its walls with what
 * is left of the field army. The main chain runs from burned Ashby through the Bone Batteries and the
 * Legion's trenches to the Breach, and through it into the besieged city (the Siege of Highwall),
 * where the Siege-Breaker batters the inner ward and Morvain commands. Quartermaster Bess wants bolts
 * and grain; Chaplain Ottis wants the names of the dead, and the knights in the chapel graves laid
 * back down. Main chain first.
 */
export const HIGHWALL_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-wall-burns',
    name: 'The Wall Burns',
    giver: 'regent-elowen',
    text: 'The Regent’s rider found you on the road out of Sablewind with a letter in black wax. Highwall, the great fortress that guards the road north into the Hollow King’s lands, has been under siege for a season, and Quartermaster Vane’s wagons were what kept the besiegers fed. General Morvain’s Legion is camped around its walls. Lord-Commander Varn holds the relief camp in Highwall March with what is left of the field army. Take the west road out of Sablewind Canyon and report to him.',
    objective: { kind: 'talk', npc: 'lord-commander-varn', label: 'Report to Lord-Commander Varn in the relief camp' },
    after: ['the-quartermasters-end'],
    level: 40,
    reward: { xp: 1500, gold: 450 },
  },
  /* ------------------------------------------------------- the siege */
  {
    id: 'ashes-of-ashby',
    name: 'Ashes of Ashby',
    giver: 'lord-commander-varn',
    text: 'Ashby, the village south-west of the camp, burned last night. Varn’s pickets saw shapes walking in the smoke afterwards, and nobody walking out of it. He can’t spare a patrol. He can spare you. Go and see if anyone in Ashby is left alive.',
    objective: { kind: 'explore', spot: 'burned-village', label: 'Search Burned Ashby' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    reward: { xp: 1700, gold: 460 },
  },
  {
    id: 'the-ashby-ghouls',
    name: 'The Ashby Ghouls',
    giver: 'lord-commander-varn',
    text: 'Nobody alive. Ashby’s dead got up hungry, and the Legion lets them wander: every night a few more come scratching at the camp’s stakes. Varn would like the camp to get some sleep before the next assault. Put down the Ashby ghouls wherever they roam, from the ruins south-west of camp to the river.',
    objective: { kind: 'kill', region: 'highwall', count: 14, enemies: ['ghoul-swarm'], label: 'Put down Ashby ghouls' },
    after: ['ashes-of-ashby'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 2000, gold: 480 },
  },
  {
    id: 'stones-against-the-wall',
    name: 'Stones Against the Wall',
    giver: 'lord-commander-varn',
    text: 'Day and night the bone catapults throw stones at Highwall’s walls, and some nights they throw worse than stones. The engines squat at the Bone Batteries west of camp and along the Legion lines beyond, and nobody crews them, which is the most unsettling thing about them. Break five. Varn says they burn well, and he would know.',
    objective: { kind: 'kill', region: 'highwall', count: 5, enemies: ['bone-catapult'], label: 'Break bone catapults' },
    after: ['the-ashby-ghouls'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 2100, gold: 490 },
  },
  {
    id: 'the-generals-hand',
    name: 'The General’s Hand',
    giver: 'lord-commander-varn',
    text: 'Morvain never shows himself outside the walls. His orders go down the lines in the hands of his death knights, sealed with the empty crown. Varn wants to read the general’s mind, and the only copy is in their belts. Take three sealed orders from the death knight initiates, wherever they walk the March: around the Knights’ Chapel north-east of camp, on the roads, and at the Breach.',
    objective: { kind: 'loot', region: 'highwall', item: 'Sealed Orders', from: ['death-knight-initiate'], chance: 0.35, count: 3, label: 'Take Sealed Orders from death knight initiates' },
    after: ['stones-against-the-wall'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2200, gold: 520 },
  },
  {
    id: 'captain-hollowbane',
    name: 'Captain Hollowbane',
    giver: 'lord-commander-varn',
    text: 'The orders are short: “When the Siege-Breaker has opened the inner ward, the Legion goes in. Hollowbane holds the trench.” Captain Hollowbane commands the Legion lines in the far west of the March, with crossbowmen at his call and a halberd he swings like a scythe. As long as he holds the trench, nobody from the camp reaches the Breach. Take the trench.',
    objective: { kind: 'kill', region: 'highwall', count: 1, enemies: ['captain-hollowbane'], label: 'Defeat Captain Hollowbane at the Legion Lines' },
    after: ['the-generals-hand'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3000, gold: 700, item: { rarity: 'rare' } },
  },
  {
    id: 'the-breach',
    name: 'The Breach',
    giver: 'lord-commander-varn',
    text: 'With Hollowbane down the trench is in disorder, and for the first time in a season there is a way to the walls. The Breach is the hole the Legion smashed in Highwall’s outer wall, north-west of the camp, and through it the Legion pours into the city. Varn means to go in by the same door. Find it, and find out what is guarding it.',
    objective: { kind: 'explore', spot: 'the-breach', label: 'Find the Breach in Highwall’s walls' },
    after: ['captain-hollowbane'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 1900, gold: 520 },
  },
  {
    id: 'the-siege-breaker',
    name: 'The Siege-Breaker',
    giver: 'lord-commander-varn',
    text: 'Behind the Breach, the thing that made it: the Siege-Breaker, a ram and an engine and a giant of bone all at once, battering at the gates of the inner ward where the last of Highwall’s garrison is holding out. When those gates go, the city goes. Go in through the Breach and break the Siege-Breaker.',
    objective: { kind: 'boss', boss: 'the-siege-breaker', label: 'Defeat the Siege-Breaker in besieged Highwall' },
    after: ['the-breach'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 3400, gold: 800, item: { rarity: 'rare' } },
  },
  {
    id: 'general-morvain',
    name: 'General Morvain',
    giver: 'lord-commander-varn',
    text: 'The inner ward holds, and its garrison has seen a friendly face for the first time in a season. General Morvain, the Hollow King’s lieutenant, who has commanded this siege from the start, has come down from the walls himself to finish it. Find him in the ruins of Highwall and end the siege. Varn will be right behind you, with every soldier who can still stand.',
    objective: { kind: 'boss', boss: 'general-morvain', label: 'Defeat General Morvain in besieged Highwall' },
    after: ['the-siege-breaker'],
    zone: 'highwall',
    level: 43,
    reward: {
      xp: 6600,
      gold: 1600,
      item: 'highwall-greathelm',
      text: 'Morvain falls in the rubble of the inner ward. The garrison sallies out to meet Varn’s column at the Breach, and the Legion outside the walls breaks and runs north. Varn takes off his old greathelm and gives it to you. “The walls are yours,” he says. “I’ll want it back when you’re done with them.”',
    },
  },
  /* -------------------------------------------- Quartermaster Bess's stores */
  {
    id: 'bolts-for-the-wall',
    name: 'Bolts for the Wall',
    giver: 'quartermaster-bess',
    text: 'The camp’s crossbows are down to their last bolts and the next wagon from the south is a rumour. Quartermaster Bess has found a supplier: the Legion’s crossbowmen carry bolts of the same gauge, which she has checked, twice, with a ruler. Six bundles from the Legion crossbowmen on the March, please.',
    objective: { kind: 'loot', region: 'highwall', item: 'Bundle of Bolts', from: ['legion-crossbowman'], chance: 0.4, count: 6, label: 'Take Bundles of Bolts from Legion crossbowmen' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 2000, gold: 480 },
  },
  {
    id: 'the-trampled-fields',
    name: 'The Trampled Fields',
    giver: 'quartermaster-bess',
    text: 'Bolts are half the battle. The other half is bread. The camp ate from the farms north-west of here, the Trampled Fields, until the Legion trampled them. Bess wants to know whether the old granary there still stands, and whether there is anything in it besides rats. Go and look.',
    objective: { kind: 'explore', spot: 'trampled-fields', label: 'Look over the Trampled Fields' },
    after: ['bolts-for-the-wall'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1600, gold: 460 },
  },
  {
    id: 'fields-of-fire',
    name: 'Fields of Fire',
    giver: 'quartermaster-bess',
    text: 'The granary stands, the grain is dry, and the Legion has put crossbowmen in the furrows to shoot anyone who comes for it. Bess would like her wagons to come back with grain in them instead of bolts. Clear the Legion out of the Trampled Fields and the country around: crossbowmen and soldiers both.',
    objective: { kind: 'kill', region: 'highwall', count: 10, enemies: ['legion-crossbowman', 'legion-soldier'], label: 'Defeat Legion crossbowmen and soldiers' },
    after: ['the-trampled-fields'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2600, gold: 620, item: 'quartermasters-brigandine', text: 'The wagons come back full. Bess signs a brigandine out of her last crate to you, in triplicate.' },
  },
  /* -------------------------------------------------- Chaplain Ottis's dead */
  {
    id: 'names-of-the-fallen',
    name: 'Names of the Fallen',
    giver: 'chaplain-ottis',
    text: 'Under the rot, the Legion’s soldiers wear Highwall’s own tabards: they are the garrison’s dead, raised to besiege their own city. Every soldier of Highwall carried a tin tag with their name on it. Chaplain Ottis wants the tags back, so the families can stop waiting. Six, from the Legion soldiers anywhere on the March.',
    objective: { kind: 'loot', region: 'highwall', item: 'Garrison Tag', from: ['legion-soldier'], chance: 0.35, count: 6, label: 'Recover Garrison Tags from Legion soldiers' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1800, gold: 470 },
  },
  {
    id: 'the-knights-chapel',
    name: 'The Knights’ Chapel',
    giver: 'chaplain-ottis',
    text: 'One of the tags you brought belongs to Sir Aldo, who was buried with honours at the Knights’ Chapel, north-east of camp, in the first month of the siege. Ottis buried him himself. The chapel bell has not rung since. Go and see what has happened to the knights’ graves.',
    objective: { kind: 'explore', spot: 'knights-chapel', label: 'Visit the Knights’ Chapel' },
    after: ['names-of-the-fallen'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1400, gold: 440 },
  },
  {
    id: 'last-rites',
    name: 'Last Rites',
    giver: 'chaplain-ottis',
    text: 'The graves are open and empty. Highwall’s knights got up in black plate with violet runes on it and went to serve the general they died fighting. Ottis can’t read the rites over a knight who won’t lie still. Lay five death knight initiates back down, around the chapel north-east of camp or wherever they ride on the March, and he will do the rest.',
    objective: { kind: 'kill', region: 'highwall', count: 5, enemies: ['death-knight-initiate'], label: 'Lay death knight initiates to rest' },
    after: ['the-knights-chapel'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2400, gold: 600, item: 'ottis-prayer-beads', text: 'Ottis reads the rites at the chapel, and rings the bell himself. He gives you the beads he has been counting the dead on.' },
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
        lines: ['The Regent sent you? Good. I asked her for a thousand lances and she sent one hero. She knows something I don’t, I hope.', 'I’m Varn. Highwall is behind that smoke, and I mean to get back in it. Sit. We’ll talk about how.'],
      },
      {
        when: { quest: 'ashes-of-ashby', state: 'active' },
        lines: ['Ashby burned last night, south-west of here. My pickets saw shapes in the smoke afterwards. Nobody came out.', 'Go and see. If there’s anyone alive, bring them in. If there isn’t, tell me what’s walking around instead.'],
      },
      {
        when: { quest: 'the-ashby-ghouls', state: 'active' },
        lines: ['Ghouls. Of course. The Legion burns a village and gets a regiment for free.', 'They come scratching at the stakes every night. Put them down. My lads haven’t slept in a week, and I’d like them to be awake for the next assault.'],
      },
      {
        when: { quest: 'stones-against-the-wall', state: 'active' },
        lines: ['Hear that thump? Every few minutes, all day, all night. Bone catapults, at the Bone Batteries west of here and along the lines beyond.', 'Nobody crews them. They just throw. Break five, and the wall gets a rest. They burn well. Trust me.'],
      },
      {
        when: { quest: 'the-generals-hand', state: 'active' },
        lines: ['Morvain never comes out from behind his lines. His death knights carry his orders, sealed with that crown.', 'Three sealed orders and I’ll know what he’s thinking. I’ve been guessing for a season. I’d like to stop guessing.'],
      },
      {
        when: { quest: 'captain-hollowbane', state: 'active' },
        lines: ['“When the Siege-Breaker has opened the inner ward, the Legion goes in. Hollowbane holds the trench.” Short. Soldierly. I almost like him.', 'Hollowbane holds the Legion lines in the far west. As long as he does, we don’t reach the Breach. Take the trench.'],
      },
      {
        when: { quest: 'the-breach', state: 'active' },
        lines: ['The trench is in pieces. First time in a season there’s a road to the walls.', 'The Breach is north-west of here: the hole they smashed in our wall. They go in through it. So will we. Find it.'],
      },
      {
        when: { quest: 'the-siege-breaker', state: 'active' },
        lines: ['The thing that made the Breach is inside, battering the inner ward. The Siege-Breaker. A ram with legs, they say. A gatehouse that walks.', 'The last of my garrison is behind those gates. Go through the Breach and break it before the gates go.'],
      },
      {
        when: { quest: 'general-morvain', state: 'active' },
        lines: ['The inner ward holds. The garrison saw you. They cheered. I haven’t heard that sound in a season.', 'Morvain has come down off the walls to finish it himself. Find him in the ruins and finish him first. I’ll be right behind you with everyone who can still stand.'],
      },
      {
        when: { quest: 'the-long-night-ends', state: 'active' },
        lines: ['Morvain is dead in the rubble of my inner ward, and his army is running north into the snow. I watched it from the gate. I may have shouted.', 'The Regent should hear it from you, not from a rider. Go home to Emberwick. Tell her Highwall holds.'],
      },
      {
        when: { quest: 'the-long-night-ends', state: 'done' },
        lines: ['Highwall holds, and the road north is open. Beyond it are the King’s own lands. I’ve never seen them. I don’t much want to.', 'When you go north, go through my gate. I’d like to see you off properly. With a band. We have a drum left.'],
      },
      {
        when: { quest: 'the-wall-burns', state: 'done' },
        lines: ['The relief camp: what’s left of the field army, a field hospital, Bess’s wagons and a great deal of mud.', 'Highwall is behind that smoke. Thirty thousand souls, and every one of them looking at this camp, waiting for us.'],
      },
      { lines: ['This is a war camp, not a market. If you can hold a sword, find Bess. If you can’t, find Ottis.', 'The road north to the King’s lands runs through Highwall. As long as the walls stand, it stays shut.'] },
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
      {
        when: { quest: 'bolts-for-the-wall', state: 'active' },
        lines: ['We’re down to the last bolts, and the next wagon from the south is a rumour with a wheel off.', 'The Legion’s crossbowmen carry the same gauge. I’ve checked. Twice. With a ruler. Six bundles, please, and don’t bend them.'],
      },
      {
        when: { quest: 'the-trampled-fields', state: 'active' },
        lines: ['Bolts are half a war. The other half is bread.', 'We ate from the farms north-west of here, the Trampled Fields, until the Legion trampled them. See if the old granary’s still standing, and if anything’s in it but rats.'],
      },
      {
        when: { quest: 'fields-of-fire', state: 'active' },
        lines: ['Dry grain and a roof on it! And crossbowmen in the furrows, shooting at anyone who comes for it. Of course.', 'Clear them off the fields and I’ll send the wagons. Crossbowmen first. Soldiers too, if they’re in your way. They usually are.'],
      },
      { when: { quest: 'fields-of-fire', state: 'done' }, lines: ['Bread tonight. Real bread. The camp’s cooks wept. One of them may have been me.', 'Wear the brigandine. I’ve signed it out to you, and I’ll want the paperwork back even if I don’t get the armor.'] },
      { lines: ['The Relief Armory. Blades, bows, staves and shields, all of it signed for.', 'Sign here. And here. And there. No, that’s my lunch.'] },
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
        lines: ['Have you looked at them, the Legion’s soldiers? Under the rot they wear our tabards. They’re Highwall’s dead, raised to besiege their own homes.', 'Every soldier of the garrison wore a tin tag with their name on it. Bring me the tags, and the families can stop waiting. Six, to start.'],
      },
      {
        when: { quest: 'the-knights-chapel', state: 'active' },
        lines: ['Sir Aldo. I buried him myself, at the Knights’ Chapel north-east of camp, in the first month of the siege. And here is his tag, in your hand.', 'The chapel bell hasn’t rung since. Go and see what has happened to the graves. I don’t want to be right.'],
      },
      {
        when: { quest: 'last-rites', state: 'active' },
        lines: ['Empty graves. And the knights out on the March in black plate, serving the general they died fighting.', 'I can’t read the rites over a knight who won’t lie still. Lay five of them down, and I’ll do the rest. Gently, if you can. Quickly, if you can’t.'],
      },
      { when: { quest: 'general-morvain', state: 'done' }, lines: ['The siege is over. The beds are full of people who will live. I had forgotten that kind of tired.'] },
      { when: { quest: 'last-rites', state: 'done' }, lines: ['I rang the chapel bell myself. They heard it in the camp. Some of them took off their helmets.'] },
      { lines: ['The Field Hospital. Beds, bandages, potions, and prayers, in that order.', 'Potions are on the table by the door. Take what you need. Pay what you can. Come back on your feet.'] },
    ],
  },
};
