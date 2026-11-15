import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Hearthstead's people and the Amberfield's quests: the end of Act I (STORY_BIBLE.md §3). Whole
 * villages are fleeing the east ahead of the Ashen Host and gathering at Hearthstead under Marshal
 * Dunmore, an old Amber Lancer. The Host's outriders raid the wagons wearing stolen clan feathers, so the
 * refugees blame the centaurs and the centaurs blame the refugees; the hero reads the dead riders'
 * letters, beats the clans' war-chief in his own circle, and finds the Host's picket on the north road
 * empty: its riders have gone to take Hearthstead. The Defense of Hearthstead follows (the raid, the
 * wall, the ram), and in the smoke Rider-Captain Vosk escapes north with the second Crown fragment.
 * Tess, Gaius and Wynn have chains of their own. The main chain comes first, so it is the quest the hero
 * follows by default. Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const AMBERFIELD_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------------ the way in */
  {
    id: 'refugees-on-the-road',
    name: 'Refugees on the Road',
    giver: 'maren',
    text: 'Villages in the east are emptying. Their people are fleeing the Ashen Host and gathering at Hearthstead, a walled town on the Amberfield Steppes. Marshal Dunmore runs the town, and he has written to Briarhollow for help. Take the east road out of Thornvale and find him.',
    objective: { kind: 'talk', npc: 'marshal-dunmore', label: 'Talk to Marshal Dunmore in Hearthstead' },
    after: ['the-regents-council'],
    level: 16,
    reward: { xp: 340, gold: 120 },
  },
  /* ------------------------------------------------- the riders in the grass */
  {
    id: 'the-broken-caravan',
    name: 'The Broken Caravan',
    auto: true,
    giver: 'marshal-dunmore',
    text: 'A wagon train from the east was due in Hearthstead three days ago. Dunmore’s riders saw smoke on the road south-east of town and turned back. Go and find out what happened, and whether anyone survived.',
    objective: { kind: 'explore', spot: 'broken-caravan', label: 'Find the Broken Caravan' },
    after: ['refugees-on-the-road'],
    zone: 'amberfield',
    reward: { xp: 400, gold: 140, text: 'One wagon is still standing. Hiding under it are Ada Corrin, the sister of Hearthstead’s wheelwright Hale, and her eight-year-old daughter, Marit. They walk back to town with you.' },
  },
  {
    id: 'riders-in-the-grass',
    name: 'Riders in the Grass',
    auto: true,
    giver: 'marshal-dunmore',
    text: 'The Ashen Host’s outriders are on the Amberfield roads: dead riders on dead horses, with grave hounds running ahead of them. Their captain has been seen on the ridges, watching the town. Dunmore wants the roads clear before the next wagons arrive.',
    objective: { kind: 'kill', region: 'amberfield', count: 6, enemies: ['legion-scout', 'grave-hound'], label: 'Break up the outriders on the Hearthstead roads' },
    after: ['the-broken-caravan'],
    zone: 'amberfield',
    reward: { xp: 540, gold: 150 },
  },
  {
    id: 'the-clan-stones',
    name: 'The Clan Stones',
    auto: true,
    giver: 'marshal-dunmore',
    text: 'When the outriders raid the wagons, they wear feathers stolen from the centaur clans. Now the refugees blame the clans, and the clans blame the refugees. Someone has to tell the clans the truth. They meet at the Clan Stones, east of Hearthstead. Go there, and go in peace.',
    objective: { kind: 'explore', spot: 'clan-stones', label: 'Go to the Clan Stones' },
    after: ['riders-in-the-grass'],
    zone: 'amberfield',
    level: 18,
    reward: { xp: 520, gold: 160, text: 'At the Clan Stones, the oldest stone shows a memory of a star falling in two pieces. Elyra turns toward Hearthstead and says she can feel something warm under the town. The clans’ war-chief, Stormhoof, refuses to hear you out.' },
  },
  {
    id: 'stormhoof',
    name: 'Stormhoof',
    giver: 'marshal-dunmore',
    text: 'Stormhoof, the clans’ war-chief, only listens to someone who beats him in his own fighting circle. Dunmore says to do it. Defeat Stormhoof at the Clan Stones, and the clans will hear the truth about the stolen feathers.',
    objective: { kind: 'kill', region: 'amberfield', count: 1, enemies: ['stormhoof'], label: 'Defeat Stormhoof at the Clan Stones' },
    after: ['the-clan-stones'],
    zone: 'amberfield',
    level: 19,
    reward: { xp: 780, gold: 200, item: { rarity: 'rare' }, text: 'Stormhoof gets back up and looks at the stolen feathers for a long time. He promises the clans will stop blaming the refugees, and will hunt the riders who wear their feathers.' },
  },
  /* ------------------------------------------------- the Defense of Hearthstead */
  {
    id: 'hearth-the-riders-come',
    name: 'The Riders Come',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'Rider-Captain Vosk has sent everything he has against Hearthstead, and his riders are already in the streets. Mara Venn arrived from Briarhollow an hour ago with a message, and she stayed to fight. Get back to the town square.',
    objective: { kind: 'event', event: 'hearth-riders', label: 'Drive the riders out of Hearthstead’s square' },
    after: ['the-clan-stones'],
    zone: 'amberfield',
    level: 20,
    reward: { xp: 900, gold: 220, text: 'The square is clear. Outside the wall, the Host is gathering again.' },
  },
  {
    id: 'hearth-hold-the-wall',
    name: 'Hold the Wall',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'Vosk’s riders have pulled back to the north road to attack the gate together. Mara is on the wall, Dunmore’s riders guard the inside of the gate, and Warden Hollis’s rangers from Briarhollow’s camp hold the towers. Hold the gate.',
    objective: { kind: 'event', event: 'hearth-wall', label: 'Hold Hearthstead’s north gate' },
    after: ['hearth-the-riders-come'],
    zone: 'amberfield',
    level: 21,
    reward: { xp: 1100, gold: 260, text: 'The gate held through three attacks. Then something big starts down the north road, and the riders cheer.' },
  },
  {
    id: 'hearth-the-ram',
    name: 'The Ram',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'An ashen ram is coming: a battering beam carried by a beast made of old bones. Blades barely scratch it. Elyra says she can destroy it if it stands still long enough. Keep it away from the gate until she can.',
    objective: { kind: 'event', event: 'hearth-ram', label: 'Keep the ashen ram off the gate' },
    after: ['hearth-hold-the-wall'],
    zone: 'amberfield',
    level: 21,
    reward: { xp: 1500, gold: 320, item: { rarity: 'rare' }, text: 'Elyra’s light turns the ram to ash, and the riders run. Then someone screams near the well, inside the town.' },
  },
  {
    id: 'hearth-the-shrine',
    name: 'The Empty Shrine',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'While everyone defended the gate, a few riders climbed over the south wall. Vosk led them. They went straight to the old shrine by the well, where Hearthstead has always kept its hearthstone. Go and look.',
    objective: { kind: 'explore', spot: 'hearth-shrine', label: 'Look at the shrine by the well' },
    after: ['hearth-the-ram'],
    zone: 'amberfield',
    level: 21,
    reward: { xp: 600, gold: 160, text: 'The altar is split and the hearthstone is gone. Elyra touches the empty spot and turns pale. The hearthstone was a sigil, a piece of the broken Crown, and now Vosk has it.' },
  },
  {
    id: 'orders-from-the-north',
    name: 'Orders from the North',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'Vosk escaped north with the sigil. In the shrine he left behind a greave and a bone case of written orders. Old Gaius can read the old kingdom’s script. Take the orders to him.',
    objective: { kind: 'talk', npc: 'old-gaius', label: 'Bring Vosk’s dropped orders to Old Gaius' },
    after: ['hearth-the-shrine'],
    zone: 'amberfield',
    level: 20,
    reward: {
      xp: 1850,
      gold: 600,
      item: 'vosk-greaves',
      text: 'Gaius reads them twice. “Carry the stone north by the King’s Road to the Hallow King. The knight of the barrows will see you safely through the downs.” Below that, in a clerk’s neat handwriting: “The roads are paid for. Nobody will stop you.” Someone in the Crown City is paying the Host’s way. Dunmore gives you the greave Vosk left behind.',
    },
  },
  {
    id: 'camp-riders',
    name: 'Riders for Briarhollow',
    giver: 'marshal-dunmore',
    auto: true,
    text: 'Hearthstead held, and Dunmore keeps his promises. Twenty of his riders are on their way to Briarhollow to serve as the camp’s cavalry. Meet them in Briarhollow’s square.',
    objective: { kind: 'event', event: 'camp-riders', label: 'Meet Dunmore’s riders in Briarhollow' },
    after: ['orders-from-the-north'],
    zone: 'briarhollow',
    level: 20,
    reward: { xp: 500, gold: 150, text: 'Briarhollow has horses now, and riders who have beaten the Host. Mara is pleased, though she won’t say so.' },
  },
  /* ------------------------------------------------------ Tess's brother */
  {
    id: 'ashby-farm',
    name: 'Ashby Farm',
    giver: 'tess-hearthkeeper',
    text: 'Tess’s brother Wil refused to leave his farm when everyone else came to Hearthstead. Nobody has heard from him in a week. Ashby Farm is south-west of town. Tess would go herself, but she has four hundred people to feed.',
    objective: { kind: 'explore', spot: 'ashby-farm', label: 'Look for Wil at Ashby Farm' },
    after: ['refugees-on-the-road'],
    zone: 'amberfield',
    level: 17,
    reward: { xp: 420, gold: 150 },
  },
  {
    id: 'the-pride',
    name: 'The Pride',
    giver: 'tess-hearthkeeper',
    text: 'The farm was empty. The gate was open, there were lion tracks, and Wil had left a note on the door: GON TO GET THE GOTES BAK. Lions have been taking the camp’s herds too. Tess wants fewer lions between her brother and home.',
    objective: { kind: 'kill', region: 'amberfield', count: 8, enemies: ['plains-lion'], label: 'Defeat plains lions' },
    after: ['ashby-farm'],
    zone: 'amberfield',
    reward: { xp: 480, gold: 160 },
  },
  {
    id: 'hunt-goldmane',
    name: 'Goldmane',
    giver: 'tess-hearthkeeper',
    text: 'Wil came back this morning with three goats and no boots. He says the lions are led by a huge lion with a golden mane that lives at Lion Rocks, in the west. Defeat Goldmane.',
    objective: { kind: 'kill', region: 'amberfield', count: 1, enemies: ['goldmane'], label: 'Defeat Goldmane at Lion Rocks' },
    after: ['the-pride'],
    zone: 'amberfield',
    level: 19,
    reward: { xp: 720, gold: 200, item: 'goldmane-hood', text: 'Tess has the mane cured and sewn into a hood for you.' },
  },
  /* ---------------------------------------------------- the Amber Lancers */
  /* --------------------------------------------------------- Wynn's bow */
  {
    id: 'borrowed-arrows',
    name: 'Borrowed Arrows',
    giver: 'wynn',
    text: 'Wynn makes the arrows for Hearthstead’s wall. The clans make better ones, and she wants to learn how. She needs eight clan arrows to study. The centaur outriders carry full quivers.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Clan Arrow', from: ['centaur-outrider'], chance: 0.6, count: 8, label: 'Take Clan Arrows from centaur outriders' },
    after: ['refugees-on-the-road'],
    zone: 'amberfield',
    level: 17,
    reward: { xp: 460, gold: 160 },
  },
  {
    id: 'a-steppe-bow',
    name: 'A Steppe Bow',
    giver: 'wynn',
    text: 'Wynn has worked out how the clans fletch their arrows. To make a proper steppe bow, she needs horn, and the centaur warbringers wear horn on their helmets. Bring her four. Warbringers charge in straight lines, so step aside when one lowers its head.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Warbringer Horn', from: ['centaur-warbringer'], chance: 0.5, count: 4, label: 'Take Warbringer Horns from centaur warbringers' },
    after: ['borrowed-arrows'],
    zone: 'amberfield',
    level: 18,
    reward: { xp: 560, gold: 200, item: { rarity: 'rare' }, text: 'Wynn keeps the bow for herself and pays you from the town’s armory.' },
  },
];

export const AMBERFIELD_NPCS: Record<string, NpcDef> = {
  'marshal-dunmore': {
    id: 'marshal-dunmore',
    name: 'Marshal Dunmore',
    title: 'Marshal of Hearthstead',
    sprite: 'villager',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['Hearthstead’s wall is repaired, and people travel the refugee road in both directions now.', 'Most of my riders came home. We put up stones by the road for the ones who didn’t.'] },
      {
        when: { quest: 'refugees-on-the-road', state: 'active' },
        lines: [
          'You’re from Briarhollow? Good. At least Maren reads my letters, even if the Regent doesn’t.',
          'There are four hundred people in this town, and more arrive every day. They all say the same thing: the dead came over the hills.',
        ],
      },
      {
        when: { quest: 'the-broken-caravan', state: 'active' },
        lines: ['A wagon train from the east is three days late. My riders saw smoke on the road and turned back.', 'It’s south-east of town. Find out what happened.'],
      },
      {
        when: { quest: 'riders-in-the-grass', state: 'active' },
        lines: ['Dead riders on dead horses, and hounds that don’t bleed. That’s the Ashen Host’s vanguard, and it’s on my roads.', 'Thin them out before the next wagons arrive.'],
      },
      {
        when: { quest: 'the-clan-stones', state: 'active' },
        lines: ['The Host’s riders wear clan feathers when they attack. Now the clans and the refugees blame each other.', 'The clans meet at the Clan Stones, east of here. Tell them the truth, and keep your weapons down.'],
      },
      {
        when: { quest: 'stormhoof', state: 'active' },
        lines: ['Stormhoof won’t listen to talk. He listens to whoever beats him in his circle.', 'Beat him in front of his clan, and the whole steppe will hear what you have to say.'],
      },
      { when: { quest: 'hearth-the-shrine', state: 'active' }, lines: ['The gate held. But while we were holding it, Vosk wasn’t trying to take the town at all.', 'Go and look at the shrine. I can’t.'] },
      {
        when: { quest: 'orders-from-the-north', state: 'active' },
        lines: ['My family kept that stone by the well for generations. My mother told me to keep it warm. I thought she meant the fire.', 'Take Vosk’s orders to Gaius. I want to know what the Host plans to do with it.'],
      },
      { when: { quest: 'camp-riders', state: 'active' }, lines: ['I’m sending twenty riders to Briarhollow. They’re the best I have left. Tell Maren they’ll need feeding.'] },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['The wagons arrive safely now. We’re repairing the wall with what was left of the ram.', 'Tell Briarhollow that Hearthstead remembers who came when we called.'] },
      { lines: ['Hearthstead used to be a crossroads with a well. Now it’s a refugee camp, and I’m its marshal.', 'If you’re here to help, there’s plenty of work.'] },
    ],
  },
  'tess-hearthkeeper': {
    id: 'tess-hearthkeeper',
    name: 'Tess Hearthkeeper',
    title: 'Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Open Hearth',
    talk: [
      {
        when: { quest: 'ashby-farm', state: 'active' },
        lines: ['My brother Wil wouldn’t leave his farm. He said the steppe never scared him.', 'Ashby Farm is south-west of here. Please find out if he’s all right.'],
      },
      {
        when: { quest: 'the-pride', state: 'active' },
        lines: ['That note is from Wil. He’s gone after his goats.', 'The lions are taking the camp’s herds too. Please thin them out. Eight would help.'],
      },
      {
        when: { quest: 'hunt-goldmane', state: 'active' },
        lines: ['Wil came back with three goats, no boots, and a story about a lion with a golden mane.', 'It lives at Lion Rocks, out west. Wil says it leaps farther than the other lions.'],
      },
      { when: { quest: 'hunt-goldmane', state: 'done' }, lines: ['Wil wants you to teach him to fight. Thank you for bringing him home.'] },
      { lines: ['This is the Open Hearth. We have soup for everyone, and potions for anyone who needs them.', 'Rest by the fire before you go out. Lions hide in the tall grass.'] },
    ],
  },
  'old-gaius': {
    id: 'old-gaius',
    name: 'Old Gaius',
    title: 'Old soldier',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Gaius’s Cart',
    talk: [
      { when: { quest: 'the-clan-stones', state: 'active' }, lines: ['Going to see the clans? Take a shield. They shoot first and talk after.'] },
      {
        when: { quest: 'orders-from-the-north', state: 'active' },
        lines: [
          'These are Vosk’s orders: “Carry the stone north by the King’s Road to the Hallow King. The knight of the barrows will see you safely through the downs.”',
          'The barrows are the Ashen Barrows, north of the steppe. Whoever holds the King’s Road holds the way to the Crown City.',
        ],
      },
      { lines: ['I’m Gaius. I served thirty years in the Amber Lancers. Now I sell armor.', 'Everything on this cart has been to war.'] },
    ],
  },
  wynn: {
    id: 'wynn',
    name: 'Wynn',
    title: 'Fletcher',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'borrowed-arrows', state: 'active' },
        lines: ['The clans make the best arrows on the steppe, and they shoot them at our wall. I want to study a few.', 'Bring me eight. The outriders carry them. Let them come to you instead of chasing them.'],
      },
      {
        when: { quest: 'a-steppe-bow', state: 'active' },
        lines: ['I’ve worked out how they fletch. Now I need horn for a bow, and the warbringers wear it on their helmets.', 'Bring me four. When one lowers its head to charge, step aside.'],
      },
      { when: { quest: 'a-steppe-bow', state: 'done' }, lines: ['That’s the best bow I’ve ever made. I’m keeping it.'] },
      { lines: ['I make the arrows for the wall. We use a hundred a day.', 'Bring me any good feathers you find.'] },
    ],
  },
  // two of the refugees camped by the west road (the people the hero is saving, by name)
  'refugee-hale': {
    id: 'refugee-hale',
    name: 'Hale Corrin',
    title: 'Wheelwright, from the east',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-broken-caravan', state: 'active' }, lines: ['My sister Ada and her girl Marit were on that caravan. Ada wears a red scarf. Please find them.'] },
      { when: { quest: 'the-broken-caravan', state: 'done' }, lines: ['You found Ada and Marit. Thank you. They’re resting in the wagon shed.'] },
      { lines: ['I made wheels in Ashford until the Host came over the hills.', 'Now I fix the camp’s carts, so people can leave if they have to.'] },
    ],
  },
  'refugee-marit': {
    id: 'refugee-marit',
    name: 'Marit',
    title: 'Hale’s niece, eight years old',
    sprite: 'villager',
    talk: [
      { when: { quest: 'hunt-goldmane', state: 'done' }, lines: ['You killed the lion with the golden mane! Wil says he helped. Did he?'] },
      { lines: ['Are you a soldier? Mama says you found us under the wagon.', 'Uncle Hale is fixing our cart. Mama says we’re staying here now.'] },
    ],
  },
};

/** The Defense of Hearthstead (STORY_BIBLE.md §3, Act I finale) and Dunmore's riders reaching the camp. */
export const AMBERFIELD_EVENTS: Record<string, StoryEventDef> = {
  'hearth-riders': {
    id: 'hearth-riders',
    region: 'amberfield',
    kind: 'raid',
    at: 'hearth-square',
    radius: 13,
    level: 20,
    allies: ['mara', 'hearth-rider', 'hearth-rider'],
    start: [
      { who: 'mara', text: 'I brought a letter from Maren. It can wait. Behind you!' },
      { who: 'hearth-rider', text: 'They’re in the streets! Keep them away from the well!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'legion-scout', 'ash-raider'], from: ['hearth-north', 'hearth-east'] },
      { enemies: ['legion-scout', 'grave-hound', 'grave-hound', 'ash-archer'], from: ['hearth-west', 'hearth-northwest'], barks: [{ who: 'mara', text: 'Hounds on the west road! Don’t let them get behind you!' }] },
      { enemies: ['ash-raider', 'ash-raider', 'legion-scout', 'legion-scout', 'grave-hound'], from: ['hearth-north', 'hearth-east', 'hearth-west'], barks: [{ who: 'hearth-rider', text: 'I think that’s all of the ones that got in!' }] },
    ],
    end: [{ who: 'mara', text: 'They’re falling back to the road. They’ll attack the gate next. Get up on the wall!' }],
    retry: [{ who: 'mara', text: 'Get up! They’re still in the square!' }],
  },
  'hearth-wall': {
    id: 'hearth-wall',
    region: 'amberfield',
    kind: 'defend',
    at: 'hearth-gate',
    radius: 12,
    level: 21,
    allies: ['mara', 'fern-ranger', 'fern-ranger', 'hearth-rider'],
    ward: { pet: 'hearth-gate', at: 'hearth-gate', name: 'Hearthstead’s gate' },
    start: [
      { who: 'mara', text: 'This is the only gate. If it falls, they’re inside, and there are four hundred people in this town.' },
      { who: 'fern-ranger', text: 'Fernstead’s rangers are on the towers!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-raider', 'ash-archer'], from: ['hearth-north', 'hearth-northwest'] },
      { enemies: ['legion-scout', 'legion-scout', 'grave-hound', 'grave-hound', 'ash-archer'], from: ['hearth-north', 'hearth-northeast'], barks: [{ who: 'mara', text: 'Riders! Shields together! Hold!' }] },
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-archer', 'legion-scout', 'grave-hound'], from: ['hearth-north', 'hearth-northwest', 'hearth-northeast'], barks: [{ who: 'fern-ranger', text: 'That’s the last of them on the road, but something big is coming behind them!' }] },
    ],
    end: [{ who: 'mara', text: 'It held. What is that coming down the road?' }],
    retry: [{ who: 'mara', text: 'The gate is down! Fall back to the square! We go again!' }],
  },
  'hearth-ram': {
    id: 'hearth-ram',
    region: 'amberfield',
    kind: 'defend',
    at: 'hearth-gate',
    radius: 12,
    level: 21,
    allies: ['elyra', 'mara'],
    ward: { pet: 'hearth-gate', at: 'hearth-gate', name: 'Hearthstead’s gate' },
    start: [
      { who: 'elyra', text: 'I can break it, but I need it to stand still.' },
      { who: 'mara', text: 'Then we’ll hold it still. Everyone on the ram!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer'], from: ['hearth-north', 'hearth-northeast'] },
      { enemies: ['ashen-ram', 'ash-raider', 'ash-raider'], from: ['hearth-north'], barks: [{ who: 'mara', text: 'The ram! Get it away from the gate!' }] },
      { enemies: ['legion-scout', 'legion-scout', 'grave-hound', 'ash-archer'], from: ['hearth-northwest', 'hearth-northeast'], barks: [{ who: 'elyra', text: 'It’s cracking! Keep them off me!' }] },
    ],
    end: [
      { who: 'elyra', text: 'There. It’s only ash now.' },
      { who: 'mara', text: 'Smoke by the well. Someone got inside the wall. Go!' },
    ],
    retry: [{ who: 'elyra', text: 'I lost it. I’m sorry. Let’s try again!' }],
  },
  'camp-riders': {
    id: 'camp-riders',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-square',
    radius: 16,
    arrive: { pets: ['hearth-horseman', 'hearth-horseman', 'hearth-horseman', 'hearth-horseman'], from: 'briar-north', to: 'briar-riders' },
    banner: 'Riders!',
    // (their call is said in the shot of them coming in, data/scenes.ts: said after it, they were gone)
    start: [],
    waves: [],
    end: [{ who: 'mara-venn', text: 'Put them behind the guard yard. And you clean up after your own horses.' }],
  },
};
