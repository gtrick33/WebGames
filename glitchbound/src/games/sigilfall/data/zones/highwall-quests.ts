import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The relief camp's people and the quests of Highwall March (see WORLD.md). General Morvain's half of the
 * Ashen Host has Highwall under siege, and Lord-Commander Varn holds the camp outside its walls with what
 * is left of the field army. The main chain runs from burned Ashby through the Bone Batteries and the
 * Host's trenches to the Breach, and through it into the besieged city (the Siege of Highwall),
 * where the Siege-Breaker batters the inner ward and Morvain commands. Quartermaster Bess wants bolts
 * and grain; Chaplain Ottis wants the names of the dead, and the knights in the chapel graves laid
 * back down. Main chain first.
 */
export const HIGHWALL_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-wall-burns',
    name: 'The Wall Burns',
    giver: 'warden-hollis',
    auto: true,
    text: 'Fernstead is yours again, and Mara has not even unsaddled. Elyra is gone, and the sigils with her: the Herald has carried them north, and between him and Duskspire stand the Three Gates the wardens built. The first of them, Highwall, has been under siege all summer, and the Regent has sent everything she has to relieve it. Mara rides tonight. Go ahead of her, east of Shardwatch where the smoke goes up night and day, and report to Lord-Commander Varn in the relief camp.',
    objective: { kind: 'talk', npc: 'lord-commander-varn', label: 'Report to Lord-Commander Varn in the relief camp' },
    after: ['fern-retaken'],
    level: 40,
    reward: { xp: 1500, gold: 450 },
  },
  {
    id: 'mara-commands',
    name: 'The Captain of the Relief',
    giver: 'lord-commander-varn',
    auto: true,
    text: 'The Regent has sent the relief its commander: not a lord, not a general, but the village guard of Briarhollow. Mara Venn arrived at the camp an hour after you, looked at Varn’s maps for a long time, and moved every tent. Varn is furious and agrees with all of it. Go and see her.',
    objective: { kind: 'talk', npc: 'captain-mara', label: 'Report to Mara Venn at the relief camp' },
    after: ['the-wall-burns'],
    zone: 'highwall',
    level: 41,
    reward: { xp: 1400, gold: 320, text: 'Mara has a plan, and it has you in the middle of it. It also has Cael Varrow in front, leading the riders, which Cael says is the first sensible thing anyone has asked of him in ten years.' },
  },

  /* ------------------------------------------- after the first Gate: Nyx comes back */
  {
    id: 'gate-nyx-returns',
    name: 'Under a White Rag',
    giver: 'captain-mara',
    auto: true,
    text: 'A rider from Highwall, with a letter in Mara’s square hand: “Someone walked into my camp at dawn under a white rag, and asked for you by name. I have not killed her yet. Come quickly.” Go back to the relief camp in Highwall March.',
    objective: { kind: 'event', event: 'nyx-returns', label: 'Go back to the relief camp at Highwall' },
    after: ['cael-the-sortie'],
    zone: 'highwall',
    level: 44,
    reward: { xp: 900, gold: 200, text: 'Nyx, thinner, with a split lip and a rolled map under her arm, between two of Varn’s soldiers. She doesn’t look at Mara. She looks at you.' },
  },
  {
    id: 'gate-the-prison-map',
    name: 'The Herald’s Map',
    giver: 'captain-mara',
    auto: true,
    text: 'Mara has given Nyx a tent, two guards and a bowl of soup she hasn’t touched. Nyx says she has something the hero must see before anyone decides anything about her. Mara says she has already decided. Go and hear Nyx out.',
    objective: { kind: 'talk', npc: 'nyx-returned', label: 'Hear Nyx out in the relief camp' },
    after: ['gate-nyx-returns'],
    zone: 'highwall',
    level: 44,
    reward: {
      xp: 1800,
      gold: 400,
      text: 'The map is the Pale Herald’s own: north from the Shattered Vale, across the Riftscar’s glass, to the Gloam Gate, the second of the Three Gates. A gatehouse marked KEPT. “That’s where she is,” Nyx says. “Elyra. I know because he told me, and he told me because he wants you to go.” Mara: “Then we go. And if this is another sale, I will finish what the Herald started.”',
    },
  },

  /* ------------------------------------------------------- the siege */
  {
    id: 'ashes-of-ashby',
    name: 'Ashes of Ashby',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'Ashby, the village south-west of the camp, burned last night. Varn’s pickets saw shapes walking in the smoke afterwards, and nobody walking out of it. He can’t spare a patrol. He can spare you. Go and see if anyone in Ashby is left alive.',
    objective: { kind: 'explore', spot: 'burned-village', label: 'Search Burned Ashby' },
    after: ['mara-commands'],
    zone: 'highwall',
    reward: { xp: 1700, gold: 460 },
  },
  {
    id: 'captain-hollowbane',
    name: 'Captain Hollowbane',
    giver: 'lord-commander-varn',
    text: 'The orders are short: “When the Siege-Breaker has opened the inner ward, the Host goes in. Hollowbane holds the trench.” Captain Hollowbane commands the Host lines in the far west of the March, with crossbowmen at his call and a halberd he swings like a scythe. As long as he holds the trench, nobody from the camp reaches the Breach. Take the trench.',
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
    text: 'Hollowbane’s trench is broken, and Mara will not give the Host a night to mend it. Cael leads the riders out of the camp and straight at the Host lines before the Breach; Hearthstead’s riders and Fernstead’s rangers go with him; you go in at his side. Open the way to the wall.',
    objective: { kind: 'event', event: 'highwall-sortie', label: 'Ride out with Cael and break the lines before the Breach' },
    after: ['ashes-of-ashby'],
    zone: 'highwall',
    level: 42,
    reward: { xp: 2800, gold: 600, item: { rarity: 'rare' }, text: 'The Host’s lines fold like wet paper. Cael rides back through the camp with his visor up, and the old soldiers of the field army stand and bang their shields as he goes by. He doesn’t know what to do with his face.' },
  },

  {
    id: 'the-breach',
    name: 'The Breach',
    auto: true,
    giver: 'lord-commander-varn',
    text: 'With Hollowbane down and the lines broken by Cael’s riders, for the first time in a season there is a way to the walls. The Breach is the hole the Host smashed in Highwall’s outer wall, north-west of the camp, and through it the Host pours into the city. Varn means to go in by the same door. Find it, and find out what is guarding it.',
    objective: { kind: 'explore', spot: 'the-breach', label: 'Find the Breach in Highwall’s walls' },
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
    auto: true,
    giver: 'lord-commander-varn',
    text: 'The inner ward holds, and its garrison has seen a friendly face for the first time in a season. General Morvain, the Hallow King’s lieutenant, who has commanded this siege from the start, has come down from the walls himself to finish it. Find him in the ruins of Highwall and end the siege. Varn will be right behind you, with every soldier who can still stand.',
    objective: { kind: 'boss', boss: 'general-morvain', label: 'Defeat General Morvain in besieged Highwall' },
    after: ['the-siege-breaker'],
    zone: 'highwall',
    level: 43,
    reward: {
      xp: 6600,
      gold: 1600,
      item: 'highwall-greathelm',
      text: 'Morvain falls in the rubble of the inner ward. The garrison sallies out to meet Varn’s column at the Breach, and the Host outside the walls breaks and runs north. Varn takes off his old greathelm and gives it to you. “The walls are yours,” he says. “I’ll want it back when you’re done with them.”',
    },
  },
  /* -------------------------------------------- Quartermaster Bess's stores */
  /* -------------------------------------------------- Chaplain Ottis's dead */
  {
    id: 'names-of-the-fallen',
    name: 'Names of the Fallen',
    giver: 'chaplain-ottis',
    text: 'Under the rot, the Host’s soldiers wear Highwall’s own tabards: they are the garrison’s dead, raised to besiege their own city. Every soldier of Highwall carried a tin tag with their name on it. Chaplain Ottis wants the tags back, so the families can stop waiting. Six, from the Host soldiers anywhere on the March.',
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
        when: { quest: 'captain-hollowbane', state: 'active' },
        lines: ['“When the Siege-Breaker has opened the inner ward, the Host goes in. Hollowbane holds the trench.” Short. Soldierly. I almost like him.', 'Hollowbane holds the Host lines in the far west. As long as he does, we don’t reach the Breach. Take the trench.'],
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
        lines: ['Have you looked at them, the Host’s soldiers? Under the rot they wear our tabards. They’re Highwall’s dead, raised to besiege their own homes.', 'Every soldier of the garrison wore a tin tag with their name on it. Bring me the tags, and the families can stop waiting. Six, to start.'],
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
          'Hello. Don’t. Mara’s already said it, and she said it better, and she had a spear.',
          'I sold your road to the Herald for my brother. He took Elyra, and he kept Wren, and then he came back and offered me the same deal again.',
          'This is his map. Where he keeps her. I want you to look at it before you decide anything about me.',
        ],
      },
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['North from the Vale, over the glass. There’s a village of people who light lamps. They’re going to hate me. Everybody does that eventually; it saves time if it’s early.'] },
      { lines: ['Mara says I can have a tent and a guard and soup. I said I’d take the soup. I haven’t taken the soup.'] },
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
          'Don’t look at me like that. I didn’t ask for it. The Regent said she wanted someone who shows up. I show up.',
          'Varn’s army has been sitting in the mud for a season waiting for the wall to fall. It won’t. We’re going to go and get it.',
        ],
      },
      { when: { quest: 'gate-nyx-returns', state: 'active' }, lines: ['She walked in at dawn with her hands up and a white rag on a stick. My sentries nearly shot her. I nearly let them.'] },
      { when: { quest: 'gate-the-prison-map', state: 'active' }, lines: ['She sold us to him. She sold Elyra to him. And she walked back in here knowing exactly what I’d want to do.', 'That’s either very brave or very clever, and I can’t tell which, so you go and listen to her. I can’t. I’ll put my spear through the table.'] },
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['North from the Vale, then. The Gloam Gate. Cael and Orren will follow you up the causeway when you need them.', 'Bring her back. Bring both of them back, if you must. I don’t have to like it to want it.'] },
      { when: { quest: 'cael-the-sortie', state: 'active' }, lines: ['Cael leads. You go in at his side. I’ll be on the ridge watching the whole thing go wrong in a slightly different way to how I planned.', 'Open me a way to the Breach. That’s all I need.'] },
      { when: { quest: 'general-morvain', state: 'done' }, lines: ['One gate. One gate of three, and half the field army in the infirmary. The other two will be worse.', 'I keep thinking about Briarhollow’s gate. It was so small. I thought it was the whole world.'] },
      { lines: ['Shields together. Weight forward. Never step back first. Cael taught me that. Don’t tell him.', 'The wall stands because people keep standing on it. That’s all a wall is.'] },
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
      { who: 'cael', text: 'Ninefold! For the Ninefold Watch, and for Corvane! With me!' },
      { who: 'hearth-rider', text: 'Hearthstead rides! Go, go, go!' },
    ],
    waves: [
      { enemies: ['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], from: ['sortie-n', 'sortie-w'] },
      { enemies: ['death-knight-initiate', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'bone-catapult'], from: ['sortie-w', 'sortie-e'], barks: [{ who: 'cael', text: 'The catapult! Ride it down before it finds its range!' }] },
      { enemies: ['legion-ensign', 'death-knight-initiate', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], from: ['sortie-n', 'sortie-e', 'sortie-w'], barks: [{ who: 'fern-ranger', text: 'Their standard! Their standard’s going down!' }] },
    ],
    end: [{ who: 'cael', text: 'The way to the wall is open. Tell Mara. Tell her she was right, and then tell her I said it twice.' }],
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
