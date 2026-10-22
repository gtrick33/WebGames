import type { NpcDef, QuestDef } from '../types';

/**
 * Hearthstead's people and the Amberfield's quests. Whole villages are fleeing the east ahead of the
 * Hollow Legion and gathering at Hearthstead under Marshal Dunmore, an old Amber Lancer. The Legion's
 * scouts raid the wagons wearing stolen clan feathers, so the refugees blame the centaurs and the
 * centaurs blame the refugees; the hero reads the Legion's letters, beats the clans' war-chief in his
 * own circle, and takes the orders off the officer at the Legion's picket: bone-steel, from the
 * dwarves' stolen forge at Ironpeak. Tess, Gaius and Wynn have chains of their own. The chain opens
 * after the Regent's council; the main chain comes first, so it is the quest the hero follows by default.
 */
export const AMBERFIELD_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------------ the way in */
  {
    id: 'refugees-on-the-road',
    name: 'Refugees on the Road',
    giver: 'regent-elowen',
    text: 'Since the council, the roads north of the Saltmarsh have filled with carts going the wrong way: whole villages fleeing the east with their grandmothers and their goats. They gather at Hearthstead, a camp town on the Amberfield Steppes. The Regent wants to know what they are running from. Take the north road out of the Saltmarsh and find Marshal Dunmore.',
    objective: { kind: 'talk', npc: 'marshal-dunmore', label: 'Talk to Marshal Dunmore in Hearthstead' },
    after: ['the-regents-council'],
    level: 16,
    reward: { xp: 340, gold: 120 },
  },
  /* ------------------------------------------------- the riders in the grass */
  {
    id: 'the-broken-caravan',
    name: 'The Broken Caravan',
    giver: 'marshal-dunmore',
    text: 'A wagon train out of the east was due in Hearthstead three days ago. Dunmore’s riders saw its smoke south-east of the camp and turned back. He doesn’t blame them, much. Go and find out what stopped it.',
    objective: { kind: 'explore', spot: 'broken-caravan', label: 'Find the Broken Caravan' },
    after: ['refugees-on-the-road'],
    zone: 'amberfield',
    reward: { xp: 400, gold: 140 },
  },
  {
    id: 'riders-in-the-grass',
    name: 'Riders in the Grass',
    giver: 'marshal-dunmore',
    text: 'Hoofprints no living horse made, and bites no living dog made. The Hollow Legion’s scouts ride the Amberfield now, with grave hounds running ahead of them. Dunmore wants the roads clear before the next wagons come in. Thin the riders out, wherever you find them.',
    objective: { kind: 'kill', region: 'amberfield', count: 10, enemies: ['legion-scout', 'grave-hound'], label: 'Defeat Legion scouts and grave hounds' },
    after: ['the-broken-caravan'],
    zone: 'amberfield',
    reward: { xp: 540, gold: 150 },
  },
  {
    id: 'dead-letters',
    name: 'Dead Letters',
    giver: 'marshal-dunmore',
    text: 'The riders carry dispatch cases made of bone, sealed with grey wax. Dunmore would like to know what the dead write to each other. Bring him four of their dispatches.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Legion Dispatch', from: ['legion-scout'], chance: 0.4, count: 4, label: 'Take Legion Dispatches from Legion scouts' },
    after: ['riders-in-the-grass'],
    zone: 'amberfield',
    reward: { xp: 500, gold: 150 },
  },
  {
    id: 'the-old-script',
    name: 'The Old Script',
    giver: 'marshal-dunmore',
    text: 'The dispatches are written in grave-script, the old kingdom’s writing, and nobody in the camp can read it. Except, Dunmore thinks, Old Gaius, who stood guard over half the barrows in the east and has never once stopped mentioning it. Take the letters to his cart in Hearthstead.',
    objective: { kind: 'talk', npc: 'old-gaius', label: 'Bring the dispatches to Old Gaius' },
    after: ['dead-letters'],
    zone: 'amberfield',
    reward: { xp: 440, gold: 140 },
  },
  {
    id: 'the-clan-stones',
    name: 'The Clan Stones',
    giver: 'marshal-dunmore',
    text: 'Gaius read it: the Legion’s riders wear stolen clan feathers when they raid the wagons, so the refugees blame the centaurs and the centaurs blame the refugees, and the Legion counts the bodies. Somebody has to tell the clans. They meet at the Clan Stones, east of Hearthstead. Dunmore says to go with your hands where they can see them. Gaius says to go with a shield.',
    objective: { kind: 'explore', spot: 'clan-stones', label: 'Go to the Clan Stones' },
    after: ['the-old-script'],
    zone: 'amberfield',
    level: 18,
    reward: { xp: 480, gold: 160 },
  },
  {
    id: 'stormhoof',
    name: 'Stormhoof',
    giver: 'marshal-dunmore',
    text: 'The clans didn’t let you get a word out. Their war-chief, Stormhoof, holds that the grass listens only to whoever is left standing on it. Fine, says Dunmore: then be left standing. Beat Stormhoof in his own circle at the Clan Stones, and the clans will hear what has been done in their name.',
    objective: { kind: 'kill', region: 'amberfield', count: 1, enemies: ['stormhoof'], label: 'Defeat Stormhoof at the Clan Stones' },
    after: ['the-clan-stones'],
    zone: 'amberfield',
    level: 19,
    reward: { xp: 780, gold: 200, item: { rarity: 'rare' } },
  },
  {
    id: 'the-legion-picket',
    name: 'The Legion Picket',
    giver: 'marshal-dunmore',
    text: 'Beaten, Stormhoof listened, spat, and told you where the dead riders come from: a picket of the Legion on the north road, where it starts to climb toward Ironpeak. His outriders won’t go near it, and they are not easily scared. Find it.',
    objective: { kind: 'explore', spot: 'legion-picket', label: 'Find the Legion Picket on the north road' },
    after: ['stormhoof'],
    zone: 'amberfield',
    level: 20,
    reward: { xp: 540, gold: 170 },
  },
  {
    id: 'orders-from-the-north',
    name: 'Orders from the North',
    giver: 'marshal-dunmore',
    text: 'The picket answers to Rider-Captain Vosk, a dead officer in a grey cloak who carries the Legion’s orders down from the north. Take them off him. Dunmore wants to know where the Legion is going, and he would like to know before it gets there.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Legion Orders', from: ['captain-vosk'], chance: 1, count: 1, label: 'Take the Legion’s orders from Rider-Captain Vosk' },
    after: ['the-legion-picket'],
    zone: 'amberfield',
    level: 20,
    reward: {
      xp: 1850,
      gold: 600,
      item: 'vosk-greaves',
      text: 'Gaius reads the orders: bone-steel for the Legion’s blades, from the Deepforge, the dwarves’ great forge under Ironpeak, which the Legion has taken. Dunmore lets you keep the captain’s greaves.',
    },
  },
  /* ------------------------------------------------------ Tess's brother */
  {
    id: 'ashby-farm',
    name: 'Ashby Farm',
    giver: 'tess-hearthkeeper',
    text: 'Tess’s brother Wil wouldn’t leave his farm when everyone else came to the camp. He said the steppe had never scared him. Nobody has heard from him in a week. Ashby Farm is south-west of Hearthstead. Tess would go herself, but somebody has to feed four hundred people.',
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
    text: 'The farm was empty: an open gate, lion tracks, and a note on the door in Wil’s best spelling: GON TO GET THE GOTES BAK. The lions have been taking the camp’s herds as well as Wil’s. Tess would like fewer lions between her brother and home.',
    objective: { kind: 'kill', region: 'amberfield', count: 8, enemies: ['plains-lion'], label: 'Defeat plains lions' },
    after: ['ashby-farm'],
    zone: 'amberfield',
    reward: { xp: 480, gold: 160 },
  },
  {
    id: 'hunt-goldmane',
    name: 'Goldmane',
    giver: 'tess-hearthkeeper',
    text: 'Wil limped into the camp this morning with three goats and no boots. The pride, he says, is led by a lion with a mane like a wheatfield on fire, which lairs at Lion Rocks in the west. It looked at him, he says, and decided he wasn’t worth eating. He has taken this very personally.',
    objective: { kind: 'kill', region: 'amberfield', count: 1, enemies: ['goldmane'], label: 'Defeat Goldmane at Lion Rocks' },
    after: ['the-pride'],
    zone: 'amberfield',
    level: 19,
    reward: { xp: 720, gold: 200, item: 'goldmane-hood', text: 'Tess has the mane cured and stitched into a hood. Wil says it suits you better than it suited the lion.' },
  },
  /* ---------------------------------------------------- the Amber Lancers */
  {
    id: 'lancers-rest',
    name: 'Lancers’ Rest',
    giver: 'old-gaius',
    text: 'Some of the Legion’s riders wear amber under the grey. Gaius saw it from the camp wall and hasn’t slept since. His old company, the Amber Lancers, were buried at Lancers’ Rest, on a rise north of Hearthstead, under stones he helped cut. Go and see if the stones are still where he left them.',
    objective: { kind: 'explore', spot: 'lancers-rest', label: 'Go to Lancers’ Rest' },
    after: ['the-old-script'],
    zone: 'amberfield',
    level: 19,
    reward: { xp: 500, gold: 160 },
  },
  {
    id: 'the-amber-lancers',
    name: 'The Amber Lancers',
    giver: 'old-gaius',
    text: 'The graves at Lancers’ Rest were dug open from below. Gaius’s friends ride with the Legion now. He asks you to bring back their badges, five of them, and not to ask him what he will do with them.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Lancer Badge', from: ['legion-scout'], chance: 0.35, count: 5, label: 'Take Lancer Badges from Legion scouts' },
    after: ['lancers-rest'],
    zone: 'amberfield',
    reward: { xp: 520, gold: 170 },
  },
  {
    id: 'a-lancers-farewell',
    name: 'A Lancer’s Farewell',
    giver: 'old-gaius',
    text: 'Gaius wraps the badges in a cloth and gives them back to you. They aren’t for him, he says. Take them to Marshal Dunmore, who was the youngest Lancer in the company. He’s the last one now, besides Gaius, and he will pretend he’s fine.',
    objective: { kind: 'talk', npc: 'marshal-dunmore', label: 'Bring the badges to Marshal Dunmore' },
    after: ['the-amber-lancers'],
    zone: 'amberfield',
    reward: { xp: 640, gold: 220, item: 'amber-lancer-coat', text: 'Dunmore keeps the badges. Gaius gives you the last Lancer’s coat on his cart. It has been waiting forty years for someone to ride out in it.' },
  },
  /* --------------------------------------------------------- Wynn's bow */
  {
    id: 'borrowed-arrows',
    name: 'Borrowed Arrows',
    giver: 'wynn',
    text: 'Wynn fletches the arrows for Hearthstead’s wall, and the clans fletch better ones. She knows, because they keep shooting them at the wall. She wants eight to take apart. The centaur outriders carry full quivers.',
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
    text: 'Horn-glue, three feathers and a twist in the fletching: Wynn has the trick of it now. For a proper steppe bow she needs horn, and the centaur warbringers wear it on their helms. Four horns. Warbringers charge in straight lines, she says, so don’t be on the line.',
    objective: { kind: 'loot', region: 'amberfield', item: 'Warbringer Horn', from: ['centaur-warbringer'], chance: 0.5, count: 4, label: 'Take Warbringer Horns from centaur warbringers' },
    after: ['borrowed-arrows'],
    zone: 'amberfield',
    level: 18,
    reward: { xp: 560, gold: 200, item: { rarity: 'rare' }, text: 'Wynn keeps the bow, and pays you out of the camp’s armory instead.' },
  },
];

export const AMBERFIELD_NPCS: Record<string, NpcDef> = {
  'marshal-dunmore': {
    id: 'marshal-dunmore',
    name: 'Marshal Dunmore',
    title: 'Marshal of Hearthstead',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'refugees-on-the-road', state: 'active' },
        lines: [
          'From Emberwick? Good. So the Regent does read her letters. Sit. No, don’t, we’re out of chairs. We’re out of most things.',
          'Four hundred people in this camp, more every day. They come from the east with their carts and their grandmothers, and they all say the same thing: the dead came over the hills.',
        ],
      },
      {
        when: { quest: 'a-lancers-farewell', state: 'active' },
        lines: [
          'Gaius sent you? With… those.',
          'Amber badges. I wore one. I was nineteen. Gaius carried me off the field at Redgrass with an arrow in my leg, and the rest of the company stayed there.',
          'Leave them with me. I’ll bury them properly this time, somewhere nobody will dig. Thank you. Now go away for a bit.',
        ],
      },
      {
        when: { quest: 'the-broken-caravan', state: 'active' },
        lines: ['A wagon train from the east was due three days ago. My riders found smoke on the road and turned back. I don’t blame them. I’d like to.', 'South-east of the camp. Tell me what happened. Then tell me it won’t happen again. One of those I’ll believe.'],
      },
      {
        when: { quest: 'riders-in-the-grass', state: 'active' },
        lines: ['Riders on dead horses, and hounds that don’t bleed. That’s the Hollow Legion’s vanguard, and it’s on my roads.', 'Thin them out. They don’t sleep, so do it before they start not sleeping near us.'],
      },
      { when: { quest: 'dead-letters', state: 'active' }, lines: ['The riders carry bone cases with grey seals. Dead men writing letters. I’d laugh, if I could read them.', 'Bring me four.'] },
      { when: { quest: 'the-old-script', state: 'active' }, lines: ['None of my clerks can read this. Old Gaius can. He’ll tell you so himself, at length.', 'His cart’s by the fire. Bring the letters, and patience.'] },
      {
        when: { quest: 'the-clan-stones', state: 'active' },
        lines: ['The Legion rides under clan feathers, and the clans think it’s us. Of course they do. It’s clever. I hate clever.', 'The clans meet at the Clan Stones, east of here. Go and tell them. Keep your hands where they can see them.'],
      },
      {
        when: { quest: 'stormhoof', state: 'active' },
        lines: ['They won’t talk? Then they’ll fight, and then they’ll talk. I’ve known centaurs forty years. They’re very consistent.', 'Stormhoof is their war-chief. Beat him in front of his clan and the steppe will listen.'],
      },
      { when: { quest: 'the-legion-picket', state: 'active' }, lines: ['A picket on the north road. So that’s where they come from: down the pass from Ironpeak.', 'Find it. Count them. Don’t let them count you.'] },
      {
        when: { quest: 'orders-from-the-north', state: 'active' },
        lines: ['Rider-Captain Vosk. A dead officer with live orders. I want them.', 'He keeps the picket on the north road. He calls his hounds when he’s pressed, so press him fast.'],
      },
      {
        when: { quest: 'the-dwarves-plea', state: 'active' },
        lines: [
          'Bone-steel, out of the dwarves’ own forge. The Legion is arming itself out of a mountain I once helped hold.',
          'Thane Borrik has written for help. I can’t spare a single rider. I can spare you.',
          'His father and I held the Kragholt road one winter, him with an axe and me with a lance and both of us with frostbite. Take the north road, and give Borrik my regards.',
        ],
      },
      { when: { quest: 'orders-from-the-north', state: 'done' }, lines: ['The wagons come in whole now. Not many of them, but whole.', 'If you see the dwarves, tell them Hearthstead remembers the Kragholt road.'] },
      { lines: ['Hearthstead. It was a crossroads with a well. Now it’s a camp with a marshal. I’m the marshal.', 'If you’re here to help, there’s work. If you’re here to eat, there’s a queue.'] },
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
        lines: ['My brother Wil wouldn’t leave his farm. Said the steppe never scared him. The steppe doesn’t scare anyone until it eats them.', 'Ashby Farm, south-west of here. If he’s fine, tell him I’m furious. If he isn’t… tell me first.'],
      },
      {
        when: { quest: 'the-pride', state: 'active' },
        lines: ['GON TO GET THE GOTES BAK. That’s my brother. That’s our whole family’s spelling, to be fair.', 'The lions are taking the camp’s herds too. Fewer lions, please. Eight would be a start.'],
      },
      {
        when: { quest: 'hunt-goldmane', state: 'active' },
        lines: ['Wil’s back. Three goats, no boots, and a story about a lion with a mane like a wheatfield on fire.', 'It lairs at Lion Rocks, out west. It pounces farther than the others, he says. He knows because it pounced on him and missed.'],
      },
      { when: { quest: 'hunt-goldmane', state: 'done' }, lines: ['Wil wants you to teach him to fight. I told him you fight lions. He’s thinking about what that means.'] },
      { lines: ['The Open Hearth: one pot, four hundred bowls, and potions for whoever needs them more than soup.', 'Rest by the fire before you go out. The grass hides things.'] },
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
      {
        when: { quest: 'the-old-script', state: 'active' },
        lines: [
          'Letters? Give them here. Grave-script. The old kingdom carved it on every barrow in the east, and I stood guard over a lot of barrows.',
          '“Count the wagons. Count the horse-folk. Ride under their feathers when you strike, so the living blame the clans and the clans blame the living.” Clever, for a corpse.',
        ],
      },
      { when: { quest: 'the-clan-stones', state: 'active' }, lines: ['Going to see the horse-folk? Take a shield. They’re polite people, but they shoot first and are polite after.'] },
      {
        when: { quest: 'lancers-rest', state: 'active' },
        lines: ['Amber under the grey. I saw it from the wall. That’s my company, the Amber Lancers.', 'We buried them at Lancers’ Rest, north of the camp, forty years ago. Go and look at the stones. My knees can’t, and the rest of me doesn’t want to.'],
      },
      { when: { quest: 'the-amber-lancers', state: 'active' }, lines: ['Dug up from below. Of course they were.', 'Bring me their badges. Five. I’ll know them by the dents.'] },
      { when: { quest: 'a-lancers-farewell', state: 'active' }, lines: ['Take them to Dunmore. Don’t look at me like that. He was a Lancer too, the youngest. I carried him off the field at Redgrass.', 'He’ll pretend he’s fine. Let him.'] },
      { when: { quest: 'a-lancers-farewell', state: 'done' }, lines: ['He told you, then. Good. He’s a better marshal than he ever was a lancer. He was a terrible lancer.'] },
      { lines: ['Gaius. Thirty years in the Amber Lancers, ten more selling what’s left of them. Helmets, mail, boots that only leak a little.', 'Everything on this cart has been to a war. Most of it came back.'] },
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
        lines: ['The clans fletch the best arrows on the steppe and shoot them at our wall every week. I’d like to study a few. Ones that missed, ideally.', 'Eight. The outriders are quick. Don’t chase them; let them come back to you. They always do.'],
      },
      {
        when: { quest: 'a-steppe-bow', state: 'active' },
        lines: ['Horn-glue. Three feathers, a twist in the fletching. I’ve worked it out. Now I need horn, and the warbringers wear it on their helms.', 'Four horns. When one lowers its head, step sideways. Let it meet a rock instead.'],
      },
      { when: { quest: 'a-steppe-bow', state: 'done' }, lines: ['Best bow I’ve ever made. I’m keeping it. You’re welcome to look at it.'] },
      { lines: ['Arrows for the wall. Hearthstead goes through a hundred a day.', 'If you see feathers on the ground, bring them. If you see feathers on a centaur, duck.'] },
    ],
  },
};
