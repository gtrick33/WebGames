import { CityPlan } from '../citygen';
import type { EnemyDef, NpcDef, QuestDef, RegionDef, StoryCond, StoryEventDef } from '../types';

/**
 * Briarhollow, the Prologue (STORY_BIBLE.md §3, "The Night the Bells Stopped"): a border village of
 * thatch, orchards and a chapel whose bell has not rung in three weeks. The hero arrives at dusk; a king's
 * courier dies at the gate; at nightfall the Ashen Host burns the lanes, the hero pulls children out of the
 * burning inn and holds the chapel door with Mara and Elyra; the raiders dig under the chapel, and the
 * crypt below (the old Hollow Crypt) holds the first fragment of the Starlight Crown. At dawn the village
 * becomes the resistance camp, and every village saved later sends its people here.
 *
 * The map is drawn with the city builder; people, fires and the camp come and go with the story
 * (each marker's `when`), and the region's states set night, flames and smoke.
 */

const is = (quest: string, state: 'offered' | 'active' | 'done' | 'started' | 'locked'): StoryCond => ({ quest, is: state });
const not = (c: StoryCond): StoryCond => ({ not: c });
const any = (...c: StoryCond[]): StoryCond => ({ any: c });
const all = (...c: StoryCond[]): StoryCond => ({ all: c });

/** The night of the raid, from nightfall to the door holding. */
const RAID = any(is('briar-nightfall', 'active'), is('briar-the-inn', 'active'), is('briar-hold-the-door', 'active'));
/** After the door held, until dawn: the raiders are below, the village is dark and smoking. */
const NIGHT = any(is('briar-below', 'active'), is('the-warden', 'active'), is('close-the-rift', 'active'), is('the-empty-tomb', 'active'));
/** Dawn: the camp. */
const CAMP = is('the-empty-tomb', 'done');
/** Village life (people out in the lanes): before the raid, and again after dawn. */
const CALM = not(any(RAID, NIGHT));

function plan(): CityPlan {
  const c = new CityPlan(64, 54, 4417);
  c.woods(3, 6);
  // the roads: north to the Whisperwood, west to Fernstead, south to Millbrook
  c.fill(31, 0, 33, 19, 'path');
  c.fill(0, 26, 25, 27, 'path');
  c.fill(31, 31, 32, 53, 'path');
  c.fill(39, 26, 52, 27, 'path');
  c.marker(32, 0, { kind: 'exit', to: 'whisperwood', label: 'North road: the Whisperwood' });
  c.marker(0, 26, { kind: 'exit', to: 'brackenridge', label: 'West road: Fernstead and the Brackenridge Hills', minLevel: 5 }, is('the-empty-tomb', 'done'));
  c.marker(31, 53, { kind: 'exit', to: 'thornvale', label: 'South road: Millbrook and Thornvale', minLevel: 7 }, is('the-empty-tomb', 'done'));

  // the palisade along the north, with its gate where Mara keeps watch
  for (let x = 9; x <= 55; x++) if (x < 30 || x > 34) c.set(x, 12, 'fence');
  c.marker(29, 13, { kind: 'prop', prop: 'lamp', solid: true });
  c.marker(35, 13, { kind: 'prop', prop: 'lamp', solid: true });

  // the square: the waystone, the well, the market
  c.fill(25, 20, 39, 31, 'cobble');
  c.marker(32, 22, { kind: 'waystone' });
  c.marker(32, 29, { kind: 'prop', prop: 'well', solid: true });
  for (const [x, y] of [
    [26, 21],
    [38, 21],
    [26, 30],
    [38, 30],
  ] as const)
    c.prop('lamp', x, y);
  for (const [x, y, p] of [
    [27, 24, 'crate'],
    [27, 25, 'barrel'],
    [37, 24, 'barrel'],
    [37, 25, 'crate'],
  ] as const)
    c.prop(p, x, y);

  // the guard yard by the gate: Mara's dummies
  c.fill(18, 14, 26, 18, 'cobble');
  c.marker(20, 15, { kind: 'dummy' });
  c.marker(23, 15, { kind: 'dummy' });
  c.marker(25, 17, { kind: 'dummy', shooter: true });

  // the chapel and its silent bell, north-east; the crypt stair opens beside it
  c.building('temple', 44, 13, 4, 4, { name: 'Chapel of the Bell', art: 'rk:chapel' });
  c.fill(44, 17, 48, 19, 'cobble');
  c.fill(40, 19, 44, 21, 'cobble');
  c.marker(49, 18, { kind: 'exit', to: 'crypt', label: 'The crypt stair, under the chapel' }, is('briar-below', 'started'));
  c.marker(48, 20, { kind: 'spot', id: 'briar-crypt-stair', name: 'The Crypt Stair', r: 2 }, is('briar-below', 'started'));

  // the Bramble & Barrel, west of the square
  c.building('inn', 13, 20, 6, 4, { name: 'The Bramble & Barrel', art: 'rk:inn' });
  c.fill(13, 24, 24, 25, 'cobble');
  // the smithy and the trader east of the square
  c.building('smithy', 42, 21, 4, 3, { name: 'Hollin’s Forge' });
  c.prop('anvil', 46, 24);
  c.building('shop', 48, 21, 4, 3, { name: 'Ilse’s Stall' });
  // the elder's hall and the herbwife's cottage south of the square
  c.building('hall', 34, 33, 5, 3, { name: 'The Elder’s Hall' });
  c.building('house', 20, 34, 4, 3, { name: 'Thessa’s Cottage', art: 'gv:cosy_cottage' });
  // houses
  for (const [x, y] of [
    [8, 30],
    [8, 37],
    [45, 31],
    [52, 31],
    [45, 38],
    [53, 14],
    [13, 14],
  ] as const)
    c.building('house', x, y, 4, 3);
  // the orchard, the fields and the pond
  c.plant(42, 42, 58, 49, 0.18, 0.12);
  for (let x = 22; x <= 29; x++) {
    c.set(x, 41, 'fence');
    c.set(x, 48, 'fence');
  }
  for (let y = 41; y <= 48; y++) {
    c.set(22, y, 'fence');
    c.set(29, y, 'fence');
  }
  c.fill(23, 42, 28, 47, 'deco');
  c.set(29, 44, 'floor');
  c.pond(13, 45, 4, 2);
  c.plant(6, 13, 58, 50, 0.025, 0.12);

  // where the story happens (silent places)
  for (const [id, x, y] of [
    ['briar-gate', 32, 14],
    ['briar-square', 32, 25],
    ['briar-inn', 16, 25],
    ['briar-chapel', 46, 19],
    ['briar-north', 32, 8],
    ['briar-east', 56, 26],
    ['briar-west', 5, 26],
    ['briar-south', 31, 49],
    // where the Vale's people settle as they come (Act I)
    ['briar-watchfire', 39, 15],
    ['briar-granary', 10, 18],
    ['briar-infirmary', 16, 29],
    ['briar-forge', 56, 27],
    ['briar-riders', 42, 29],
  ] as const)
    c.marker(x, y, { kind: 'place', id });

  // fires on the roofs while the village burns
  for (const [x, y, s] of [
    [15, 20, 3],
    [17, 21, 2],
    [10, 30, 2],
    [46, 31, 3],
    [54, 31, 2],
    [9, 37, 2],
    [47, 38, 2],
    [43, 21, 2],
  ] as const)
    c.marker(x, y, { kind: 'fire', size: s });

  // the people: who stands where depends on the night
  c.npc('mara-venn', 31, 14, CALM);
  c.npc('oskar-fell', 33, 15, is('briar-the-seal', 'active'));
  c.npc('maren', 36, 37, CALM);
  c.npc('maren', 45, 20, NIGHT);
  c.npc('old-haldor', 43, 18, CALM);
  c.npc('herbwife-thessa', 22, 37, CALM);
  c.npc('smith-hollin', 44, 24, CALM);
  c.npc('trader-ilse', 50, 24, CALM);
  c.npc('goodwife-bramble', 18, 25, CALM);
  c.npc('elyra', 28, 32, CAMP);
  c.npc('mara-venn', 47, 20, NIGHT);
  c.npc('elyra', 43, 20, NIGHT);
  c.npc('briar-tam', 30, 27, CALM);
  c.npc('briar-oda', 24, 44, CALM);
  // the camp at dawn: tents and a cookfire in the square, the burned inn's guests under canvas
  c.prop('tent', 27, 28, true, CAMP);
  c.prop('tent', 36, 28, true, CAMP);
  c.prop('campfire', 30, 30, true, CAMP);
  c.prop('tent', 24, 30, true, CAMP);

  // the camp grows (Act I): every village the hero saves sends its people, and they stay
  // Fernstead's rangers keep a watchfire by the gate
  c.prop('campfire', 40, 15, true, is('camp-scouts', 'done'));
  c.prop('tent', 37, 17, true, is('camp-scouts', 'done'));
  c.npc('ranger-cole', 39, 16, all(is('camp-scouts', 'done'), CALM));
  // Millbrook's grain carts by the west road, and Tobin's hens (the sheep would not come)
  c.prop('cart', 8, 17, true, is('camp-grain', 'done'));
  c.prop('cart', 10, 19, true, is('camp-grain', 'done'));
  c.prop('hay', 7, 19, true, is('camp-grain', 'done'));
  c.prop('hay', 12, 16, true, is('camp-grain', 'done'));
  c.prop('chickens', 9, 21, false, is('camp-grain', 'done'));
  c.npc('carter-wenna', 11, 18, all(is('camp-grain', 'done'), CALM));
  // Reedwater's healers under canvas by Thessa's cottage
  c.prop('tent', 14, 29, true, is('camp-healers', 'done'));
  c.prop('tent', 18, 29, true, is('camp-healers', 'done'));
  c.prop('clay-pot', 16, 28, true, is('camp-healers', 'done'));
  c.npc('healer-brisa', 16, 30, all(is('camp-healers', 'done'), CALM));
  // Gullport's forge and a cart of powder kegs, east of Hollin's
  c.prop('anvil', 57, 27, true, is('camp-smiths', 'done'));
  c.prop('barrel', 55, 29, true, is('camp-smiths', 'done'));
  c.prop('barrel', 56, 29, true, is('camp-smiths', 'done'));
  c.prop('cart', 55, 25, true, is('camp-smiths', 'done'));
  c.npc('forgewife-runa', 56, 27, all(is('camp-smiths', 'done'), CALM));
  // Hearthstead's riders and their banners south-east of the square
  c.prop('flag', 41, 28, true, is('camp-riders', 'done'));
  c.prop('blue-banner', 44, 28, true, is('camp-riders', 'done'));
  c.npc('rider-alder', 42, 29, all(is('camp-riders', 'done'), CALM));
  c.marker(32, 12, { kind: 'start' });
  return c;
}

const built = plan().build();

export const BRIARHOLLOW: RegionDef = {
  id: 'briarhollow',
  name: 'Briarhollow',
  subtitle: 'A border village where the bell has stopped',
  theme: 'farm',
  kind: 'town',
  level: 4,
  levels: [1, 6],
  at: [56, 70],
  dark: false,
  safe: true,
  music: 'village',
  map: built.map,
  markers: {},
  placed: built.placed,
  holds: {
    exits: ['whisperwood', 'brackenridge', 'thornvale', 'crypt'],
    npcs: ['mara-venn', 'maren', 'old-haldor', 'herbwife-thessa', 'smith-hollin', 'trader-ilse', 'goodwife-bramble', 'elyra', 'oskar-fell', 'ranger-cole', 'carter-wenna', 'healer-brisa', 'forgewife-runa', 'rider-alder'],
    spots: ['briar-crypt-stair'],
  },
  encounters: [],
  states: [
    { id: 'raid', when: RAID, night: true, burning: true, music: 'crypt' },
    { id: 'night', when: NIGHT, night: true, smoke: true },
    { id: 'camp', when: CAMP },
    // the day the hero arrives: late light until nightfall
    { id: 'dusk', when: not(is('briar-nightfall', 'started')), dusk: true },
  ],
  blurb: 'Thatch, orchards and a silent chapel bell on the edge of the Vale. People vanish after dark.',
};

/* ------------------------------------------------------------------ foes */

/** The Ashen Host's raiders: memories with weapons, grey and soft-edged, smelling of cold hearths. */
export const BRIARHOLLOW_FOES: Record<string, EnemyDef> = {
  'ash-raider': {
    id: 'ash-raider',
    name: 'Ashen Raider',
    sprite: 'legion-scout',
    ai: 'melee',
    hp: 34,
    dmg: 9,
    speed: 54,
    radius: 6,
    mass: 1,
    xp: 8,
    gold: [1, 4],
    aggro: 200,
    reach: 18,
    windup: 0.45,
    recover: 0.5,
    attackCd: 1.3,
    flank: true,
    blurb: 'A soldier made of someone’s memory of one. It swings wide and slow; step inside the swing.',
  },
  'ash-archer': {
    id: 'ash-archer',
    name: 'Ashen Bowman',
    sprite: 'hollow-hunter',
    ai: 'ranged',
    hp: 26,
    dmg: 8,
    speed: 46,
    radius: 6,
    mass: 0.9,
    xp: 9,
    gold: [1, 4],
    aggro: 210,
    reach: 140,
    windup: 0.65,
    recover: 0.4,
    attackCd: 1.9,
    keep: 100,
    shot: { speed: 145, radius: 2.5, count: 1, spread: 0, color: '#c8a8ff' },
    blurb: 'Keeps its distance and looses grey arrows. Close in, or step aside when it draws.',
  },
  'ash-hound': {
    id: 'ash-hound',
    name: 'Ashen Hound',
    sprite: 'grave-hound',
    ai: 'charger',
    hp: 30,
    dmg: 9,
    speed: 66,
    radius: 6,
    mass: 1,
    xp: 8,
    gold: [1, 3],
    aggro: 220,
    reach: 110,
    windup: 0.55,
    recover: 0.7,
    attackCd: 2.2,
    rush: { speed: 230, dist: 110 },
    blurb: 'Lowers its head and rushes in a line. Dodge to the side and it skids past.',
  },
};

/* ----------------------------------------------------------------- people */

export const BRIARHOLLOW_NPCS: Record<string, NpcDef> = {
  'mara-venn': {
    id: 'mara-venn',
    name: 'Mara Venn',
    title: 'Village guard of Briarhollow',
    sprite: 'villager',
    talk: [
      { when: { quest: 'briar-dusk', state: 'active' }, lines: ['Stop there. Nobody comes through after the lamps are lit. Nobody goes out, either.', 'You’re not one of them, at least. They don’t talk.', 'Mara Venn. I keep the gate, since there’s nobody else left to keep it. If you’re staying, you’d better be able to swing that.'] },
      { when: { quest: 'first-steps', state: 'active' }, lines: ['The dummies in the yard. Hit one. Three times, properly.'] },
      { when: { quest: 'first-spell', state: 'active' }, lines: ['Fine arm. You have some trick of your own, I can see it on you. Show me on the dummy.'] },
      { when: { quest: 'first-dodge', state: 'active' }, lines: ['The one at the back throws stones. Get out of the way of one. If you can’t dodge a stone, you won’t dodge what comes out of those woods.'] },
      { when: { quest: 'briar-the-seal', state: 'active' }, lines: ['Hold. Rider on the north road.', 'That’s a king’s courier. That’s a king’s courier with an arrow in his back. Take him to the Elder. Go!'] },
      { when: { quest: 'briar-below', state: 'active' }, lines: ['They stopped fighting us. Did you see? They just stopped, and started digging.', 'Whatever is under that chapel, they want it more than they want us dead. I don’t like that.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Half the roofs gone, but nobody we pulled out of that inn died. I keep counting. Still nobody.', 'Maren says we gather the Vale. Fine. I’ll keep the gate while you find us people worth gathering.'] },
      { lines: ['The gate stays shut after dark. That isn’t going to change.', 'I don’t trust magic. I trust walls and people who show up.'] },
    ],
  },
  elyra: {
    id: 'elyra',
    name: 'Elyra',
    title: 'Hedge-mage, Thessa’s apprentice',
    sprite: 'villager',
    talk: [
      { when: { quest: 'briar-below', state: 'active' }, lines: ['I can feel it. Down there, under the chapel. Something warm, like a hearth in a cold house.', 'Thessa says I mustn’t say things like that out loud. I’m saying it anyway.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['It’s in me now. The fragment. When I touched it, it — went in. Like light through a window.', 'I can see better in the dark. I can hear the bell that isn’t ringing. Tell Maren. Please. Before I lose my nerve.'] },
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['Every time I use it, I forget something small. This morning it was the name of Thessa’s cat.', 'I’ll come when you need me. Just — tell me the cat’s name if I ask, will you? It’s Burr.'] },
      { lines: ['I was only ever good at small wards. Keeping milk from souring. Keeping wasps off the plums.', 'Last night I held a burning roof up over three children. I don’t know how.'] },
    ],
  },
  'oskar-fell': {
    id: 'oskar-fell',
    name: 'Oskar Fell',
    title: 'King’s courier, wounded',
    sprite: 'villager',
    talk: [{ lines: ['Take it. The seal. Broken, I know, they broke it. But the letter is still… inside.', 'They’re hunting the crown. The old one. The pieces of it. The Crown City must know. Someone there has been… losing our letters.', 'Tell them Oskar Fell rode the whole way. Tell them I didn’t stop.'] }],
  },
  maren: {
    id: 'maren',
    name: 'Elder Maren',
    title: 'Elder of Briarhollow',
    sprite: 'elder',
    talk: [
      { when: { quest: 'briar-the-seal', state: 'active' }, lines: ['A royal seal. Broken. And the man who carried it…', 'He died on my floor with the letter in his fist. The Crown City must know, he said. As if the Crown City ever listened to a border village.'] },
      { when: { quest: 'into-the-wood', state: 'active' }, lines: ['Whatever shot that courier came out of the Whisperwood. So do the ones who take our people after dark.', 'Go north before the light goes. Thin them out on the trails. Find out what they are.'] },
      { when: { quest: 'alpha', state: 'active' }, lines: ['The beasts of the wood have gone mad together, following one great boar with grey light in its eyes. Grimtusk, the woodcutters called it, before they stopped coming back.', 'It dens at the east end of the wood. Kill it and the wood calms, and we have one less thing at the door tonight.'] },
      { when: { quest: 'the-warden', state: 'active' }, lines: ['The crypt under the chapel is older than the village. Older than the chapel. The old warden still keeps it, they say, though he’s been dead three hundred years.', 'If the raiders went down there, they went for something. Bring it back before they do.'] },
      { when: { quest: 'close-the-rift', state: 'active' }, lines: ['Past the warden is the reliquary. I was told, as a girl, what it holds, and told never to say. I’ll say it now: a piece of the Starlight Crown.', 'Whoever leads those raiders is down there with it. Stop them.'] },
      { when: { quest: 'the-empty-tomb', state: 'active' }, lines: ['A fragment of the Starlight Crown, bonded to a hedge-witch’s apprentice. And the mark of the Ashen Host painted fresh on a crypt wall.', 'Three hundred years ago the Sigil-wardens broke that crown so no king could use it again. Someone is putting it back together.', 'Then we don’t run. We gather the Vale: Fernstead, Millbrook, Reedwater, Gullport. Every village that holds is one more wall.'] },
      { when: { quest: 'west-road', state: 'active' }, lines: ['West, in the Brackenridge Hills: Fernstead. Their shrine at the Harvest Stones has gone grey, and the barrow dead walk.', 'Find Warden Hollis. If her scouts join us, we’ll see the Host coming.'] },
      { when: { quest: 'south-road', state: 'active' }, lines: ['South, Millbrook: a gang holds the mill bridge and taxes every cart. Paid in grey coin, the carters say.', 'Find Reeve Aldous. Free that bridge and Millbrook’s grain comes to us instead of to them.'] },
      { when: { quest: 'the-digging-dead', state: 'active' }, lines: ['Reedwater, out in the Greyfen marsh: their graves emptied from below, villagers taken into the reeds, the wells gone foul.', 'Find Marshwarden Tilde. Reedwater has the best healers in the Vale. We’ll need them.'] },
      { when: { quest: 'hollow-gold', state: 'active' }, lines: ['Ash-gold. It weighs nothing and it’s always cold. The Host pays its traitors with it.', 'Millbrook’s grain carts are already on the road to us. You did that. Look at the square tomorrow and you’ll see what it means.'] },
      { when: { quest: 'the-regents-council', state: 'active' }, lines: ['Sit. I’ve read Oskar Fell’s letter at last: I had to dry it by the fire first.', 'The king’s couriers have been warning the Crown City for months that the crown is being hunted. Every letter, lost. Someone in the city has been burying them.', 'We will have to go there ourselves, in the end. Not yet. First the Vale must hold.'] },
      { lines: ['Every village that holds is one more wall.', 'The square fills up a little more every week. That’s your doing.'] },
    ],
  },
  'old-haldor': {
    id: 'old-haldor',
    name: 'Old Haldor',
    title: 'Bell-ringer',
    sprite: 'elder',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The rope’s still there. I go up every morning and hold it.', 'My grandson Pip went out after the lamps were lit, three weeks gone. The bell won’t ring for me until he’s home. Or until it’s all over.'] },
      { lines: ['Three weeks I haven’t rung it. Not since Pip went out after dark.', 'A bell calls people home. I won’t call them home to this.'] },
    ],
  },
  'herbwife-thessa': {
    id: 'herbwife-thessa',
    name: 'Herbwife Thessa',
    title: 'Healer, Elyra’s teacher',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The infirmary is my kitchen now. Burns, mostly. Burns and grief.', 'Elyra won’t tell me what it costs her. I can see it anyway. Bring her back to me in one piece.'] },
      { lines: ['There’s an old grove in the north-west of the wood, behind a hedge that isn’t there. My grandmother picked starwort in it.', 'If you find it, I’ll make it worth your while.'] },
    ],
  },
  'smith-hollin': {
    id: 'smith-hollin',
    name: 'Hollin',
    title: 'Blacksmith',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'Hollin’s Forge',
    talk: [{ lines: ['Blades, bows, staves. Not much, but honest.', 'The glowing ones out in the wood drop shards of something. Bring me three and I’ll make you something worth carrying.'] }],
  },
  'trader-ilse': {
    id: 'trader-ilse',
    name: 'Ilse',
    title: 'Trader',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Ilse’s Stall',
    talk: [{ lines: ['Coats, boots, a hat or two. Everything’s second-hand now. Everything.'] }],
  },
  'goodwife-bramble': {
    id: 'goodwife-bramble',
    name: 'Goodwife Bramble',
    title: 'Keeper of the Bramble & Barrel',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bramble & Barrel',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['The roof’s gone and the cellar’s full of ash, but the kettle works. Potions are where they always were.', 'Those three children are mine to feed now. I don’t mind. I mind a little.'] },
      { lines: ['Potions, a bed, a bowl of something. We close the shutters at sunset.'] },
    ],
  },
  'briar-tam': {
    id: 'briar-tam',
    name: 'Tam',
    title: 'A boy of the village',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-empty-tomb', state: 'done' }, lines: ['You carried Wenna out over your shoulder! I saw! Do it again!'] },
      { lines: ['Mum says don’t go past the fence. Pip went past the fence.'] },
    ],
  },
  'briar-oda': {
    id: 'briar-oda',
    name: 'Oda',
    title: 'Farmer',
    sprite: 'villager',
    talk: [
      { when: { quest: 'camp-grain', state: 'done' }, lines: ['Grain from Millbrook! Twelve carts! I haven’t seen twelve of anything since spring.', 'And Tobin’s hens. Nobody asked for Tobin’s hens.'] },
      { lines: ['The field’s ready and nobody will stay out late enough to sow it.'] },
    ],
  },
  /* the camp's newcomers (Act I): one for each village that sent its people */
  'ranger-cole': {
    id: 'ranger-cole',
    name: 'Cole Brannagh',
    title: 'Ranger of Fernstead, at the watchfire',
    sprite: 'villager',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['Two of ours were on Hearthstead’s towers. Both came back. Hollis will pretend she never doubted it.', 'The riders went north with something. We followed the tracks a day. They don’t stop to sleep.'] },
      { when: { quest: 'the-regents-council', state: 'done' }, lines: ['Grey riders on the Amberfield, a lot of them. More every night. Something is coming down from the north and it isn’t in a hurry.'] },
      { lines: ['Six of us, from Fernstead. Hollis sent her best and kept the rest. We watch the north road in turns.', 'Your Grey Lady is quiet. The barrow dogs sleep. We owed you a watch, so here we are.'] },
    ],
  },
  'carter-wenna': {
    id: 'carter-wenna',
    name: 'Wenna Holt',
    title: 'Carter, from Millbrook',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-drowned-fleet', state: 'done' }, lines: ['A smith from Gullport tried to buy my second cart for powder kegs. I said it carries bread. She said bread doesn’t explode. I said that’s the point.'] },
      { lines: ['Twelve carts of Millbrook grain, and Tobin’s hens, which nobody asked for.', 'The mill turns again. You burned that barricade so high we saw it from the road. Aldous wants the smoke back, he says. Joking. Mostly.'] },
    ],
  },
  'healer-brisa': {
    id: 'healer-brisa',
    name: 'Brisa Reed',
    title: 'Healer, from Reedwater',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Infirmary Tent',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['Burns from Hearthstead, coming in on every cart. I know these burns. They’re cold, not hot.', 'Thessa and I sit up with them. Elyra comes at night and puts her hand on them, and it helps, and she won’t say what it costs her.'] },
      { lines: ['Reedwater sent its herb-boats and me. Tilde says you brought Agna home. Agna says you carried her over the deep part.', 'Potions on the table. Thessa makes them stronger than I do. Don’t tell her I said so.'] },
    ],
  },
  'forgewife-runa': {
    id: 'forgewife-runa',
    name: 'Runa Saltforge',
    title: 'Smith, from Gullport',
    sprite: 'smith',
    shop: 'weapons',
    shopName: 'The Gullport Forge',
    talk: [
      { when: { quest: 'hearth-the-ram', state: 'done' }, lines: ['An ashen ram, they say. Bones and a beam. Next time, bring me a piece. I want to know what it’s lashed with.'] },
      { lines: ['Gullport’s forge, two apprentices and a cart of powder kegs. Hollin and I have agreed not to touch each other’s anvils.', 'Quill says the drowned have ships now. Then they’ll need fighting at sea, and that takes iron. Buy something.'] },
    ],
  },
  'rider-alder': {
    id: 'rider-alder',
    name: 'Alder Fenn',
    title: 'Rider of Hearthstead',
    sprite: 'villager',
    talk: [{ lines: ['Twenty riders from Hearthstead, for Elder Maren. We held the wall with you. We’ll ride wherever she points.', 'The Marshal says we eat too much. The Marshal is right.'] }],
  },
};

/* ----------------------------------------------------------------- events */

export const BRIARHOLLOW_EVENTS: Record<string, StoryEventDef> = {
  'briar-raid': {
    id: 'briar-raid',
    region: 'briarhollow',
    kind: 'raid',
    at: 'briar-square',
    radius: 16,
    level: 4,
    allies: ['mara'],
    start: [
      { who: 'mara', text: 'They’re in the lanes! With me!' },
      { who: 'mara', text: 'Fire on the roofs! Keep them off the square!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-raider'], from: ['briar-north', 'briar-east'] },
      { enemies: ['ash-raider', 'ash-archer', 'ash-raider', 'ash-hound'], from: ['briar-west', 'briar-north'], barks: [{ who: 'mara', text: 'More from the west road! Keep them off the square!' }] },
      { enemies: ['ash-hound', 'ash-hound', 'ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-east', 'briar-south'], barks: [{ who: 'mara', text: 'Hounds! Don’t let them get behind you!' }] },
    ],
    retry: [{ who: 'mara', text: 'Get up! Back to the square, we go again!' }],
    end: [
      { who: 'mara', text: 'That’s the lanes. Wait — the inn. Elyra went in for the Bramble children.' },
      { who: 'mara', text: 'The Bramble & Barrel, west of the square. Go! I’ll hold here.' },
    ],
  },
  'briar-inn': {
    id: 'briar-inn',
    region: 'briarhollow',
    kind: 'rescue',
    at: 'briar-inn',
    radius: 7,
    level: 4,
    allies: ['elyra'],
    rescue: { pets: ['briar-child', 'briar-child', 'briar-child'], at: 'briar-inn', to: 'briar-chapel' },
    start: [
      { who: 'elyra', text: 'I can’t hold the roof much longer! Take them!' },
      { who: 'elyra', text: 'The chapel — it’s stone, it won’t burn. Go, go!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-hound'], from: ['briar-west'] },
      { enemies: ['ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-south', 'briar-north'], barks: [{ who: 'elyra', text: 'More of them! Keep the children behind you!' }] },
    ],
    retry: [{ who: 'elyra', text: 'Up! The children are hiding, we try again!' }],
    end: [
      { who: 'elyra', text: 'All three. All three!' },
      { who: 'elyra', text: 'Into the chapel, all of you. Bar the door. They’re coming back, and more of them.' },
    ],
  },
  'briar-door': {
    id: 'briar-door',
    region: 'briarhollow',
    kind: 'defend',
    at: 'briar-chapel',
    radius: 9,
    level: 5,
    allies: ['mara', 'elyra'],
    ward: { pet: 'chapel-door', at: 'briar-chapel', name: 'the chapel door' },
    start: [
      { who: 'mara', text: 'They want the door. They’re not getting it.' },
      { who: 'elyra', text: 'I’ll ward it as long as I can. Keep them off me!' },
    ],
    waves: [
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-raider'], from: ['briar-north', 'briar-east'] },
      { enemies: ['ash-hound', 'ash-hound', 'ash-raider', 'ash-raider'], from: ['briar-square', 'briar-east'], barks: [{ who: 'mara', text: 'Hold the line! The door!' }] },
      { enemies: ['ash-raider', 'ash-raider', 'ash-archer', 'ash-archer', 'ash-hound', 'ash-raider'], from: ['briar-north', 'briar-square', 'briar-east'], barks: [{ who: 'elyra', text: 'The ward’s cracking — I can feel every blow!' }] },
    ],
    retry: [
      { who: 'mara', text: 'The door’s down! Fall back, rebuild it — once more!' },
      { who: 'elyra', text: 'I can ward it again. Just once more.' },
    ],
    end: [
      { who: 'mara', text: 'They’ve stopped. Why have they stopped?' },
      { who: 'elyra', text: 'They’re not running. They’re going around the back. Down. They’re digging under the chapel.' },
    ],
  },
};

/* ---------------------------------------------------------------- quests */

export const BRIARHOLLOW_QUESTS: QuestDef[] = [
  {
    id: 'briar-dusk',
    name: 'The Night the Bells Stopped',
    giver: 'mara-venn',
    auto: true,
    text: 'Briarhollow at dusk: half the shutters nailed shut, an empty market, a chapel bell that hasn’t rung in three weeks. Someone is waiting at the gate with a spear.',
    objective: { kind: 'talk', npc: 'mara-venn', label: 'Speak to the guard at the gate' },
    reward: { xp: 20, gold: 5 },
  },
  {
    id: 'briar-the-seal',
    name: 'The Broken Seal',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'A king’s courier rode in on the north road with a grey arrow in his back and a broken royal seal in his fist. Get him to the Elder.',
    objective: { kind: 'talk', npc: 'maren', label: 'Bring the courier’s seal to Elder Maren' },
    after: ['first-dodge'],
    reward: { xp: 60, gold: 15, text: 'Oskar Fell dies on the Elder’s floor. The letter is soaked through; Maren sets it by the fire to dry.' },
  },
  {
    id: 'briar-nightfall',
    name: 'Nightfall',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'The sun went down while you were in the wood. Briarhollow is burning, and things made of grey light are in the lanes.',
    objective: { kind: 'event', event: 'briar-raid', label: 'Drive the raiders out of the lanes' },
    after: ['alpha'],
    reward: { xp: 220, gold: 40 },
  },
  {
    id: 'briar-the-inn',
    name: 'The Burning Inn',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The Bramble & Barrel is on fire with three children inside, and the hedge-mage Elyra holding the roof up over them with a ward she shouldn’t be able to cast.',
    objective: { kind: 'event', event: 'briar-inn', label: 'Lead the children from the inn to the chapel' },
    after: ['briar-nightfall'],
    reward: { xp: 240, gold: 40 },
  },
  {
    id: 'briar-hold-the-door',
    name: 'Hold the Chapel Door',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The village is in the chapel, and the raiders are coming for the door. Mara holds the step, Elyra wards the wood. Keep them standing.',
    objective: { kind: 'event', event: 'briar-door', label: 'Hold the chapel door with Mara and Elyra' },
    after: ['briar-the-inn'],
    reward: { xp: 300, gold: 60, item: { rarity: 'uncommon' } },
  },
  {
    id: 'briar-below',
    name: 'What Lies Beneath',
    giver: 'mara-venn',
    auto: true,
    zone: 'briarhollow',
    text: 'The raiders stopped fighting and went to ground behind the chapel. They are digging. The old crypt stair is open beside the chapel wall.',
    objective: { kind: 'explore', spot: 'briar-crypt-stair', label: 'Find the crypt stair behind the chapel' },
    after: ['briar-hold-the-door'],
    reward: { xp: 120, gold: 20, unlock: 'crypt', text: 'The crypt under the chapel is open.' },
  },
];
