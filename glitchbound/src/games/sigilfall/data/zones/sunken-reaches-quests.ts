import type { NpcDef, QuestDef } from '../types';

/**
 * Driftwood's people and the quests of the Sunken Reaches (see WORLD.md). What was left of Admiral
 * Blackwake's fleet after the Last Light fled north to the Sunken Reaches, where Lowhaven slid into
 * the sea in the first war, and Captain Isolde of the Stormwatch followed it until her cutter found
 * the reef. The main chain climbs the Drowned Light, holds the raft-town against the tide, finds out
 * at the Sunken Chapel and from the marines' writs that the Tide Lord is Lowhaven's last Harbor-Lord
 * refitting the fleet to carry the Legion south by sea, gathers powder for fireships from the reef
 * and the gunners, silences the chanters who sing the sunk ships back up, and ends at the Drowned
 * Harbor. Mother Kelp wants her kelpers' knives and her kelp beds back, Salvager Finn wants silver and
 * a bell, and Diver Mabry wants the sirens quiet. Main chain first.
 */
export const SUNKEN_REACHES_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-drowned-harbor',
    name: 'The Drowned Harbor',
    giver: 'keeper-ansel',
    text: 'A gull flew into Stormwatch with a note from Captain Isolde of the Watch tied to its leg, and Keeper Ansel sent it on to you. After the Last Light, what was left of Blackwake’s fleet fled north up the coast, and Isolde went after it in the cutter Gannet with nine sailors and no orders. The fleet led her to the Sunken Reaches, where a whole city slid into the sea, and the Gannet is now on a reef. Isolde is alive, and in Driftwood, a raft-town of salvagers lashed to the old sea wall. Take the north road out of Sablewind Canyon and find her.',
    objective: { kind: 'talk', npc: 'captain-isolde', label: 'Find Captain Isolde in Driftwood' },
    after: ['the-long-night-ends'],
    level: 46,
    reward: { xp: 1500, gold: 520 },
  },
  /* -------------------------------------------------------- the drowned fleet */
  {
    id: 'the-drowned-light',
    name: 'The Drowned Light',
    giver: 'captain-isolde',
    text: 'Isolde lost her glass with the Gannet, and she wants to see what the fleet is doing. The Drowned Light, Lowhaven’s old lighthouse, still stands on the Old Sea Wall just east of Driftwood, and from its gallery you can see across the whole drowned city. Climb it and look. Mind the stairs: the sea has had three hundred years to work on them.',
    objective: { kind: 'explore', spot: 'old-sea-wall', label: 'Climb the Drowned Light on the Old Sea Wall' },
    after: ['the-drowned-harbor'],
    zone: 'sunken-reaches',
    reward: { xp: 1550, gold: 530, text: 'From the gallery you can see it all: drowned streets under green water, a chapel roof in the middle of them, and far off in the north-east the masts of the drowned fleet standing out of the sea like a burned forest. There are lights on them.' },
  },
  {
    id: 'high-water',
    name: 'High Water',
    giver: 'captain-isolde',
    text: 'Every high tide the drowned walk up out of the sea to Driftwood, cutlasses and pikes first, looking for anything warm. The salvagers fight them off the rafts with boathooks, and Isolde’s last four sailors with what they saved from the Gannet. She would like everyone to sleep one night through. Cut down the drowned sailors and marines along the shore around Driftwood and the Old Sea Wall.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 12, enemies: ['drowned-sailor', 'drowned-marine'], label: 'Defeat drowned sailors and marines' },
    after: ['the-drowned-light'],
    zone: 'sunken-reaches',
    level: 46,
    reward: { xp: 1650, gold: 550 },
  },
  {
    id: 'the-sunken-chapel',
    name: 'The Sunken Chapel',
    giver: 'captain-isolde',
    text: 'At low water a bell rings in the middle of the drowned city, from the Sunken Chapel north-east of Driftwood, and the salvagers swear nobody has rung it in three hundred years. Isolde wants to know who is ringing it, and whether it is a signal to the fleet. Wade out to the chapel and find out.',
    objective: { kind: 'explore', spot: 'sunken-chapel', label: 'Find out who rings the Sunken Chapel’s bell' },
    after: ['high-water'],
    zone: 'sunken-reaches',
    level: 47,
    reward: { xp: 1600, gold: 540, text: 'A hermit crab the size of a cottage rings it, wearing the bell for a shell. But in the crypt under the chapel floor one tomb of the Harbor-Lords has been opened from the inside: CORIN MERROW, LAST HARBOR-LORD OF LOWHAVEN, WHO WOULD NOT LET THE SEA HAVE HIS CITY.' },
  },
  {
    id: 'harbor-writs',
    name: 'Harbor Writs',
    giver: 'captain-isolde',
    text: 'Blackwake is dead, and still the fleet keeps its stations like a navy. Someone gives it orders. The Tide Lord’s marines carry writs in oilskin wherever they patrol, in the drowned streets and around the chapel: take five from the drowned marines and bring them to Isolde, who reads a sealed order the way other people read a face.',
    objective: { kind: 'loot', region: 'sunken-reaches', item: 'Harbor Writ', from: ['drowned-marine'], chance: 0.35, count: 5, label: 'Take Harbor Writs from drowned marines' },
    after: ['the-sunken-chapel'],
    zone: 'sunken-reaches',
    level: 47,
    reward: { xp: 1700, gold: 560, text: 'Every writ is sealed in green wax by the Harbor-Lord of Lowhaven. The Tide Lord is Corin Merrow, three hundred years drowned, and he is refitting the fleet at the Drowned Harbor to carry the Legion south by sea, round Highwall and its walls.' },
  },
  {
    id: 'powder-on-the-reef',
    name: 'Powder on the Reef',
    giver: 'captain-isolde',
    text: 'Isolde has a plan, and the plan is fire. You can’t sink a fleet that gets up again, but you can burn it at anchor. Fireships need powder. The old navy’s ships went down on Shipwreck Reef, east of Driftwood, with their magazines full. Go and see what the sea has left of them.',
    objective: { kind: 'explore', spot: 'shipwreck-reef', label: 'Search the wrecks on Shipwreck Reef' },
    after: ['harbor-writs'],
    zone: 'sunken-reaches',
    level: 48,
    reward: { xp: 1650, gold: 550, text: 'The magazines are flooded and the powder is mud. The drowned gunners have been at the wrecks before you, though, and whatever was dry is in their kegs now.' },
  },
  {
    id: 'dry-powder',
    name: 'Dry Powder',
    giver: 'captain-isolde',
    text: 'The drowned gunners carry their powder in tarred kegs, and tar keeps the sea out: it’s why their guns still fire. Isolde needs five kegs for her fireships. The gunners walk at the back of the crews, around Shipwreck Reef and all along the coast to the harbor. Take the kegs, and try not to stand near one when the gunner goes down.',
    objective: { kind: 'loot', region: 'sunken-reaches', item: 'Tarred Powder Keg', from: ['drowned-gunner'], chance: 0.4, count: 5, label: 'Take Tarred Powder Kegs from drowned gunners' },
    after: ['powder-on-the-reef'],
    zone: 'sunken-reaches',
    level: 48,
    reward: { xp: 1750, gold: 570 },
  },
  {
    id: 'the-drowned-choir',
    name: 'The Drowned Choir',
    giver: 'captain-isolde',
    text: 'Fire won’t be enough on its own. As long as the drowned chanters sing, the fleet’s hulls rise off the bottom as fast as they go down: Isolde watched it happen at Stormwatch, and she isn’t going to watch it twice. Silence the chanters, around the Sunken Chapel and up the coast to the Drowned Harbor, before the fireships go in.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 6, enemies: ['drowned-chanter'], label: 'Silence drowned chanters' },
    after: ['dry-powder'],
    zone: 'sunken-reaches',
    level: 49,
    reward: { xp: 1800, gold: 580 },
  },
  {
    id: 'the-tide-lord',
    name: 'The Tide Lord',
    giver: 'captain-isolde',
    text: 'The fireships are ready: two salvage barges packed with powder, with Isolde at one tiller and Finn, under protest, at the other. One thing stands between them and the Drowned Harbor: its master. Go to the harbor in the far north-east of the Reaches and kill the Tide Lord, Corin Merrow, last Harbor-Lord of Lowhaven. Isolde will do the rest.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 1, enemies: ['the-tide-lord'], label: 'Kill the Tide Lord at the Drowned Harbor' },
    after: ['the-drowned-choir'],
    zone: 'sunken-reaches',
    level: 50,
    reward: {
      xp: 6800,
      gold: 1700,
      item: 'harbor-lords-signet',
      text: 'The Tide Lord falls on his own quay, and whatever held the fleet up goes with him: the hulls settle, one by one, into the harbor mud. Isolde’s fireships go in anyway, because she spent a week on them. The Drowned Harbor burns all night, and in the morning there is nothing on the water but smoke and gulls. The Legion won’t be going south by sea.',
    },
  },
  /* -------------------------------------------------- Mother Kelp's kelpers */
  {
    id: 'kelp-for-the-pot',
    name: 'Kelp for the Pot',
    giver: 'mother-kelp',
    text: 'Mother Kelp feeds all of Driftwood from one pot, and the pot runs on kelp. Her three kelpers rowed out to the Kelp Forest, north of Driftwood, three days ago and haven’t come back. She would like to know whether to set three fewer bowls.',
    objective: { kind: 'explore', spot: 'kelp-forest', label: 'Look for the kelpers in the Kelp Forest' },
    after: ['the-drowned-harbor'],
    zone: 'sunken-reaches',
    level: 47,
    reward: { xp: 1700, gold: 550, text: 'The kelpers’ boat is in the shallows, empty, and something long and grey is coiled in the weed beside it, looking pleased with itself.' },
  },
  {
    id: 'kelpers-knives',
    name: 'Kelpers’ Knives',
    giver: 'mother-kelp',
    text: 'The tide lurkers took the kelpers. Mother Kelp takes it the way a woman who has outlived three husbands and a raft takes most things: she sits down, and then she gets up. The families should have something to bury, and the lurkers swallow a kelper knife and all. Cut five knives out of the tide lurkers, around the Kelp Forest and anywhere else they slide.',
    objective: { kind: 'loot', region: 'sunken-reaches', item: 'Kelper’s Knife', from: ['tide-lurker'], chance: 0.35, count: 5, label: 'Cut Kelpers’ Knives out of tide lurkers' },
    after: ['kelp-for-the-pot'],
    zone: 'sunken-reaches',
    level: 47,
    reward: { xp: 1800, gold: 560 },
  },
  {
    id: 'spawn-in-the-beds',
    name: 'Spawn in the Beds',
    giver: 'mother-kelp',
    text: 'With the lurkers thinned out, the kelp beds are crawling with kraken spawn instead: hopping, grabbing, and eating the kelp, which Mother Kelp takes personally. She wants the beds cleared, in the Kelp Forest and wherever else the spawn hop. She does not want to know what spawned them. Neither, on the whole, do you.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 10, enemies: ['kraken-spawn'], label: 'Clear kraken spawn out of the kelp beds' },
    after: ['kelpers-knives'],
    zone: 'sunken-reaches',
    level: 48,
    reward: { xp: 2500, gold: 700, item: 'mother-kelps-ladle', text: 'Kelp stew again in Driftwood. Mother Kelp gives you her old ladle, which she says is lucky, and a bowl, which she says is good.' },
  },
  /* ----------------------------------------------------- Salvager Finn's bell */
  {
    id: 'lowhaven-silver',
    name: 'Lowhaven Silver',
    giver: 'salvager-finn',
    text: 'Finn dives the drowned city for a living, and the living has been thin since the coral got up and walked. The coral grew over Lowhaven’s market square, the market’s silver is inside the coral, and the coral golems are, more or less, the market. Crack five of them open wherever they lumber, in the old streets and around the chapel, and bring Finn the silver. He’ll split it with you. He says.',
    objective: { kind: 'loot', region: 'sunken-reaches', item: 'Lowhaven Silver', from: ['coral-golem'], chance: 0.4, count: 5, label: 'Crack Lowhaven Silver out of coral golems' },
    after: ['the-drowned-harbor'],
    zone: 'sunken-reaches',
    level: 47,
    reward: { xp: 1800, gold: 560 },
  },
  {
    id: 'the-bell-of-lowhaven',
    name: 'The Bell of Lowhaven',
    giver: 'salvager-finn',
    text: 'Finn has a buyer for bronze in Dustcrown, and the biggest piece of bronze in the Reaches is the Sunken Chapel’s bell, which Old Barnacle is currently wearing. Finn would like the bell. Old Barnacle would like to keep it. Settle it at the chapel, north-east of Driftwood, and mind its rush: let the chapel’s pillars stop it for you.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 1, enemies: ['old-barnacle'], label: 'Kill Old Barnacle at the Sunken Chapel' },
    after: ['lowhaven-silver', 'the-sunken-chapel'],
    zone: 'sunken-reaches',
    level: 48,
    reward: { xp: 2700, gold: 760, item: 'barnacle-plate', text: 'The bell is cracked, so Finn’s buyer will pay half. Finn cuts a breastplate out of the shell instead and gives it to you, and only mentions the other half twice.' },
  },
  /* ------------------------------------------------- Diver Mabry's brother */
  {
    id: 'the-siren-rocks',
    name: 'The Siren Rocks',
    giver: 'diver-mabry',
    text: 'Mabry and her brother Jory dived as a pair for twenty years. Last week he went down off the Siren Rocks, the island out in the bay east of the Reaches, came up singing, and walked back into the sea. Mabry wants to know what is out there. She’d go herself, but she can hear it from here. Cross over to the Siren Rocks and look.',
    objective: { kind: 'explore', spot: 'siren-rocks', label: 'Go out to the Siren Rocks' },
    after: ['the-drowned-light'],
    zone: 'sunken-reaches',
    level: 48,
    reward: { xp: 1900, gold: 570, text: 'Sirens on every rock, singing, and Jory’s diving bell on its side in the shallows with nobody in it.' },
  },
  {
    id: 'siren-song',
    name: 'Siren Song',
    giver: 'diver-mabry',
    text: 'Mabry has stuffed her ears with wax and her mouth with curses. She wants the sirens gone: every one that sings, on the Siren Rocks, in the drowned streets and at the harbor. Their song drags at your legs, so keep moving, and don’t chase one into the water.',
    objective: { kind: 'kill', region: 'sunken-reaches', count: 8, enemies: ['deep-siren'], label: 'Silence deep sirens' },
    after: ['the-siren-rocks'],
    zone: 'sunken-reaches',
    level: 49,
    reward: { xp: 2600, gold: 740, item: 'sirens-hush', text: 'Quiet on the bay for the first time in a year. Mabry strings a siren’s pearl on a diver’s lead line for you, and wears the other one.' },
  },
];

export const SUNKEN_REACHES_NPCS: Record<string, NpcDef> = {
  'captain-isolde': {
    id: 'captain-isolde',
    name: 'Captain Isolde',
    title: 'Captain of the Stormwatch',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-drowned-harbor', state: 'active' },
        lines: ['Ansel got my gull? Then he read the part about the reef, and the part about the nine sailors. There are four now.', 'I’m Isolde, captain of the Stormwatch, of a cutter that is presently a reef. I followed Blackwake’s fleet north. I found where it lives. Sit down and I’ll tell you how we’re going to burn it.'],
      },
      {
        when: { quest: 'the-drowned-light', state: 'active' },
        lines: ['I lost my glass with the Gannet, and a captain who can’t see is a passenger.', 'The Drowned Light still stands on the old sea wall, just east of town. Climb it. Tell me what the fleet is doing.'],
      },
      {
        when: { quest: 'high-water', state: 'active' },
        lines: ['Masts like a burned forest, and lights on them. That’s a fleet at anchor, refitting. They’re not running any more. They’re getting ready.', 'And every high tide their crews walk up the shore to us. Cut them down, sailors and marines both. I want one night’s sleep before I start a war.'],
      },
      {
        when: { quest: 'the-sunken-chapel', state: 'active' },
        lines: ['Hear that? Low water, and the bell in the old chapel. The salvagers say nobody’s rung it in three hundred years.', 'A bell at sea is a signal. Wade out to the chapel, north-east of here, and find out who’s pulling the rope.'],
      },
      {
        when: { quest: 'harbor-writs', state: 'active' },
        lines: ['A crab. Wearing the bell. I’ve seen stranger, but not sober.', 'The tomb is the part I don’t like. Blackwake’s dead and the fleet still keeps its stations, so someone’s giving it orders. The marines carry writs. Bring me five.'],
      },
      {
        when: { quest: 'powder-on-the-reef', state: 'active' },
        lines: ['Corin Merrow. The last Harbor-Lord of Lowhaven, three hundred years drowned, and he’s fitting out a fleet to carry the Legion south round Highwall. By sea. Where nobody is looking.', 'So we burn it at anchor. Fireships need powder. The old navy went down on Shipwreck Reef, east of here, with full magazines. Go and look.'],
      },
      {
        when: { quest: 'dry-powder', state: 'active' },
        lines: ['Mud. Of course it’s mud. Three hundred years underwater; I don’t know what I expected.', 'The gunners keep theirs in tarred kegs, and tar keeps the sea out. Five kegs. Don’t stand near one when its gunner goes down.'],
      },
      {
        when: { quest: 'the-drowned-choir', state: 'active' },
        lines: ['I watched it at Stormwatch: we sank a hull, the chanters sang, and up it came again, dripping.', 'Silence the chanters before the fireships go in. I don’t want to burn the same ship twice. I haven’t got the powder.'],
      },
      {
        when: { quest: 'the-tide-lord', state: 'active' },
        lines: ['Two barges, five kegs, one captain and one salvager who says he is too old for this. He isn’t. He’s exactly old enough.', 'Kill Merrow at the harbor, in the far north-east, and the fleet loses its master. Then we light the fuses. Go.'],
      },
      {
        when: { quest: 'the-tide-lord', state: 'done' },
        lines: ['Nothing on the water but smoke and gulls. I’ll write to Ansel. I’ll make it sound harder than it was. No, I won’t. It was hard enough.', 'The fleet was meant to carry the Legion, and the Legion musters in the Bonefields, west of here. Varn will want to hear that from you.'],
      },
      {
        when: { quest: 'the-drowned-harbor', state: 'done' },
        lines: ['Driftwood: forty rafts, one sea wall, and more rope than sense. They took me in when the Gannet went down. I owe them a quiet sea.', 'Mother Kelp keeps the pot, Finn sells what he dives up, and Mabry dives with him when her brother isn’t. Help them. They’ve helped me.'],
      },
      { lines: ['Stand back from the edge. The rafts move. So does the sea.', 'Captain Isolde, of the Stormwatch. Of the Watch’s cutter Gannet, until last month. Of a raft, currently.'] },
    ],
  },
  'mother-kelp': {
    id: 'mother-kelp',
    name: 'Mother Kelp',
    title: 'Keeper of the Upturned Hull',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Upturned Hull',
    talk: [
      {
        when: { quest: 'kelp-for-the-pot', state: 'active' },
        lines: ['My kelpers rowed out to the Kelp Forest north of here three days ago. Three of them. Good lads. Hungry lads.', 'Go and see, would you? I’d like to know whether I’m setting three fewer bowls tonight.'],
      },
      {
        when: { quest: 'kelpers-knives', state: 'active' },
        lines: ['Lurkers. Well. I’ve buried three husbands and a raft. I can bury three kelpers.', 'The families ought to have something to put in the ground, and the lurkers swallow a kelper knife and all. Cut them out. Five knives.'],
      },
      {
        when: { quest: 'spawn-in-the-beds', state: 'active' },
        lines: ['Now it’s spawn in the beds. Hopping. Grabbing. Eating my kelp.', 'Clear them out. Ten, to start. And don’t tell me what spawned them; I like being able to sleep on the water.'],
      },
      { when: { quest: 'spawn-in-the-beds', state: 'done' }, lines: ['Stew tonight, kelp in it and everything. Keep the ladle. It’s lucky. The stew is good. One of those is true.'] },
      { lines: ['The Upturned Hull: a ship’s bottom, a roof, and a pot. Sit where it’s dry. If you can find it.', 'Potions on the shelf, stew in the pot. The potions taste better. Don’t tell the stew.'] },
    ],
  },
  'salvager-finn': {
    id: 'salvager-finn',
    name: 'Salvager Finn',
    title: 'Salvager',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Finn’s Salvage',
    talk: [
      {
        when: { quest: 'lowhaven-silver', state: 'active' },
        lines: ['Lowhaven had a market square, the market had silver, the coral grew over the lot, and then the coral got up and walked off with it.', 'Crack the coral golems open and bring me the silver. Five pieces. We’ll split it. Fairly. Ish.'],
      },
      {
        when: { quest: 'the-bell-of-lowhaven', state: 'active' },
        lines: ['There’s a man in Dustcrown who pays for bronze by the pound, and the chapel bell is a great many pounds.', 'The crab’s wearing it. Ask the crab. Ask it hard. Its charge stops dead at a pillar, so stand in front of one.'],
      },
      { when: { quest: 'the-bell-of-lowhaven', state: 'done' }, lines: ['Cracked. Half price. I made you a breastplate out of the shell instead, which I’m told is generous. I’m telling you.'] },
      { when: { quest: 'the-tide-lord', state: 'done' }, lines: ['I steered a fireship. Me. At my age. If anyone asks, I was brave the whole time.'] },
      { lines: ['Finn’s Salvage: everything Lowhaven lost, at prices it would weep at.', 'Rings, charms, relics. All dived up by hand. Mostly mine.'] },
    ],
  },
  'diver-mabry': {
    id: 'diver-mabry',
    name: 'Diver Mabry',
    title: 'Salvage Diver',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-siren-rocks', state: 'active' },
        lines: ['My brother Jory went down off the Siren Rocks last week. He came up singing. Then he walked back into the sea.', 'The rocks are out in the bay, east of the old city. I’d go myself. But I can hear it from here.'],
      },
      {
        when: { quest: 'siren-song', state: 'active' },
        lines: ['His bell, on its side, empty. Right.', 'I’ve got wax in my ears and a knife in my belt and nowhere to put either. You do it. Every one that sings: eight, to start. Keep moving; their song drags at your legs.'],
      },
      { when: { quest: 'siren-song', state: 'done' }, lines: ['Quiet. I’d forgotten what the bay sounds like. It sounds like water.', 'Wear the pearl. I wear the other one. Jory would have laughed at both of us.'] },
      { lines: ['Twenty years under the tide, and I still hold my breath on land.', 'If you go into the water, go in with a rope. The city is still down there, and it has corners.'] },
    ],
  },
};
