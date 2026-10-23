import type { NpcDef, QuestDef } from '../types';

/**
 * Dawn's Rest's people and the quests of the Pale Reach (see WORLD.md). After Highwall the Regent sent
 * Commander Aldric north with a vanguard to find the road to Duskspire, and he holds a ruined waystation
 * at the southern edge of the Hollow King's own land with what the cold has left him. The main chain
 * gathers the army's last strength and opens the way: the King's kennels, the drake graves, the Host
 * standing in its ranks and the Pale Standard over it, a look at the Duskspire Gate, and then, for one
 * who carries all seven sigils, the citadel itself: the Hollow Guard and Vaelor on his throne. (The
 * story's last word, the Regent's, is `the-dawn` in data/story.ts.) Brother Cael wants a cure for the
 * Hollowing from old Wintersend, Quartermaster Holt wants the pale knights' plate, and Outrider Maeve
 * wants her hound back. Main chain first.
 */
export const PALE_REACH_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-last-road',
    name: 'The Last Road',
    giver: 'the-ferryman',
    text: 'The Lich made his soldiers for the Pale Reach, the Hollow King’s own land north of the mere, and sent them up the north road by the hundred. Somebody is still fighting them up there: all month the Ferryman has rowed the vanguard’s dead home across the lake, in good Highwall mail. Commander Aldric, whom the Regent sent north after Highwall, holds a ruined waystation called Dawn’s Rest at the southern edge of the Reach. Take the north road out of Hollowmere and report to him.',
    objective: { kind: 'talk', npc: 'commander-aldric', label: 'Report to Commander Aldric at Dawn’s Rest' },
    after: ['the-necropolis'],
    level: 57,
    reward: { xp: 1100, gold: 750 },
  },
  /* ------------------------------------------------- the army's last strength */
  {
    id: 'the-kings-kennels',
    name: 'The King’s Kennels',
    giver: 'commander-aldric',
    text: 'Aldric’s vanguard came north to find the road to Duskspire and has spent a month finding out how cold it is. The Hollow King keeps hounds: pale, hairless things that hunt by the warmth of you and run down anyone who strays from the fires. They come out of the King’s Kennels, east of Dawn’s Rest, and Aldric has lost four foragers to them this week. Kill ten pale hounds, around the Kennels or wherever they run.',
    objective: { kind: 'kill', region: 'pale-reach', count: 10, enemies: ['pale-hound'], label: 'Kill pale hounds' },
    after: ['the-last-road'],
    zone: 'pale-reach',
    level: 57,
    reward: { xp: 1000, gold: 760 },
  },
  {
    id: 'the-drake-graves',
    name: 'The Drake Graves',
    giver: 'commander-aldric',
    text: 'At dusk the drakes fly over Dawn’s Rest: dead drakes, nothing left of them but bone and the memory of wings, and they stoop on the sentries like hawks on mice. Aldric’s scouts followed them home to the Drake Graves north-east of camp, where the King’s grandfather buried his war-drakes and the King dug them up again. Ground five bone drakes, at the Graves or anywhere in the sky over the Reach.',
    objective: { kind: 'kill', region: 'pale-reach', count: 5, enemies: ['bone-drake'], label: 'Ground bone drakes' },
    after: ['the-kings-kennels'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1100, gold: 780 },
  },
  {
    id: 'the-kings-host',
    name: 'The King’s Host',
    giver: 'commander-aldric',
    text: 'North-west of Dawn’s Rest the King’s Host stands in the snow: rank on rank of the dead in blackened plate, not moving, not breathing, waiting for their master’s word. When it comes they march south, and Dawn’s Rest becomes a story nobody tells. Aldric doesn’t mean to wait for it. Thin the Host: bring down ten of its legionnaires and pale knights, at the King’s Host or on the roads around it.',
    objective: { kind: 'kill', region: 'pale-reach', count: 10, enemies: ['hollow-legionnaire', 'pale-knight'], label: 'Thin the King’s Host' },
    after: ['the-drake-graves'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1100, gold: 780 },
  },
  {
    id: 'the-pale-standard',
    name: 'The Pale Standard',
    giver: 'commander-aldric',
    text: 'The ranks you broke had closed again by morning, and Aldric knows why: in the middle of the Host stands its standard, the King’s colors on a pole of black iron, carried by a dead giant of the old guard. While the Pale Standard flies, the Host mends itself and keeps coming. Bring it down at the King’s Host, north-west of Dawn’s Rest.',
    objective: { kind: 'kill', region: 'pale-reach', count: 1, enemies: ['the-pale-standard'], label: 'Bring down the Pale Standard at the King’s Host' },
    after: ['the-kings-host'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1700, gold: 1100, item: { rarity: 'rare' }, text: 'The Pale Standard falls into the snow, and all down the ranks of the Host the violet light gutters. The dead stay standing, but they don’t close ranks again. At Dawn’s Rest the vanguard cheers, briefly, because it is too cold to cheer for long.' },
  },
  /* ------------------------------------------------------- the citadel */
  {
    id: 'the-duskspire-gate',
    name: 'The Duskspire Gate',
    giver: 'commander-aldric',
    text: 'With the Standard down the Host is leaderless, and for the first time the road north is open to the foot of Duskspire, the Hollow King’s citadel. Aldric wants eyes on its gate before he sends anyone through it: what guards it, and whether the stories about its locks are true. Go north along the road to the Duskspire Gate and see.',
    objective: { kind: 'explore', spot: 'duskspire-gate', label: 'Scout the Duskspire Gate in the north' },
    after: ['the-pale-standard'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 900, gold: 780 },
  },
  {
    id: 'the-hollow-guard',
    name: 'The Hollow Guard',
    giver: 'commander-aldric',
    text: 'The stories are true: seven locks bar the Duskspire Gate, one for each sigil, and the citadel opens only for someone who carries all seven. You do. Beyond the gate, over the Bone Bridge and through the Hall of Kneeling Dead, the King’s own guard holds its court under Ser Maltheus, who kept this gate against the Sigil-wardens for nine days three hundred years ago and has not stood down since. Go into Duskspire and break the Hollow Guard.',
    objective: { kind: 'boss', boss: 'hollow-guard', label: 'Defeat Ser Maltheus of the Hollow Guard in Duskspire' },
    after: ['the-duskspire-gate', 'the-withered-queen', 'the-pale-herald'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1900, gold: 1200 },
  },
  {
    id: 'the-hollow-king',
    name: 'The Hollow King',
    giver: 'commander-aldric',
    text: 'Beyond the Hollow Guard’s court the Stair of Ash climbs to the throne of Duskspire, and on it, between six pillars, Vaelor waits: the Hollow King, who bargained with the Rift for a life without end and has had three hundred years in the dark to grow patient. Everything since the empty tomb in the Whisperwood has come to this. Climb the Stair, and end him.',
    objective: { kind: 'boss', boss: 'vaelor', label: 'Defeat Vaelor, the Hollow King, in Duskspire' },
    after: ['the-hollow-guard', 'the-withered-queen', 'the-pale-herald'],
    zone: 'pale-reach',
    reward: {
      xp: 21000,
      gold: 4000,
      item: 'signet-of-the-vanguard',
      text: 'Vaelor falls on the steps of his own throne, and for the first time in three hundred years Duskspire is only a building. All over the Pale Reach the dead lie down where they stand, rank on rank, and at Dawn’s Rest the sentries watch the violet go out of the sky. Aldric gives you the vanguard’s signet off his own hand. “The Regent should hear it from you,” he says. “Go home.”',
    },
  },
  /* ---------------------------------------------------- Brother Cael's cure */
  {
    id: 'the-hollowing',
    name: 'The Hollowing',
    giver: 'brother-cael',
    text: 'Brother Cael has a tent full of soldiers he can’t heal. The soul-reavers that drift over the Reach throw something that isn’t quite cold and isn’t quite shadow, and afterwards no salve or prayer takes hold for a while. The vanguard calls it the Hollowing. Cael wants to know what it is made of: bring him four of the violet shards the reavers carry where their hearts should be, from anywhere they drift on the Reach.',
    objective: { kind: 'loot', region: 'pale-reach', item: 'Reaver’s Shard', from: ['soul-reaver'], chance: 0.35, count: 4, label: 'Take Reaver’s Shards from soul-reavers' },
    after: ['the-last-road'],
    zone: 'pale-reach',
    level: 57,
    reward: { xp: 750, gold: 700 },
  },
  {
    id: 'old-wintersend',
    name: 'Old Wintersend',
    giver: 'brother-cael',
    text: 'The shards are splinters of the Rift, Cael says, and he has read of only one cure: the temple at Wintersend, a village of the old kingdom south-west of Dawn’s Rest, kept a reliquary against the Hollowing when the King first rose. The King’s winter took Wintersend three hundred years ago and nobody has been back since. Go and see whether its hall still stands.',
    objective: { kind: 'explore', spot: 'frozen-village', label: 'Find Old Wintersend south-west of Dawn’s Rest' },
    after: ['the-hollowing'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 750, gold: 720 },
  },
  {
    id: 'the-watchers-of-wintersend',
    name: 'The Watchers of Wintersend',
    giver: 'brother-cael',
    text: 'The hall stands, and the people of Wintersend are still in it: frost wraiths now, keeping a cold watch over a reliquary they no longer remember the use of. Cael would rather not take it from them while they are watching. Lay eight frost wraiths to rest, at Old Wintersend south-west of Dawn’s Rest or wherever they drift.',
    objective: { kind: 'kill', region: 'pale-reach', count: 8, enemies: ['frost-wraith'], label: 'Lay frost wraiths to rest' },
    after: ['old-wintersend'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1100, gold: 900, item: 'wintersend-reliquary', text: 'The reliquary is a small silver box with a warm stone in it, and when Cael holds it to a hollowed soldier the man’s hands stop shaking. Cael breaks the stone in two and gives you half. “The other half is for everyone else,” he says.' },
  },
  /* ------------------------------------------------- Quartermaster Holt's plate */
  {
    id: 'cold-iron',
    name: 'Cold Iron',
    giver: 'quartermaster-holt',
    text: 'Quartermaster Holt’s mail was made for Highwall’s winters, and the Reach eats Highwall’s winters for breakfast. The pale knights wear plate blackened in the King’s forges, good steel under the rot, and Holt can rivet it over a soldier’s coat if somebody brings it to him. Four plates, from pale knights anywhere on the Reach. The previous owners won’t miss them.',
    objective: { kind: 'loot', region: 'pale-reach', item: 'Blackened Plate', from: ['pale-knight'], chance: 0.35, count: 4, label: 'Take Blackened Plate from pale knights' },
    after: ['the-last-road'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 750, gold: 720 },
  },
  {
    id: 'riveted-coats',
    name: 'Riveted Coats',
    giver: 'quartermaster-holt',
    text: 'The riveted coats work: the first soldier to wear one took a reaver’s bolt in the chest and walked back to camp complaining about the draught. Holt wants one for every soldier before the vanguard marches north, and the pale knights are still wearing the rest. Bring down six, at the King’s Host north-west of Dawn’s Rest or on the roads, and Holt’s lads will do the unbuckling.',
    objective: { kind: 'kill', region: 'pale-reach', count: 6, enemies: ['pale-knight'], label: 'Bring down pale knights' },
    after: ['cold-iron'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1100, gold: 900, item: 'holts-riveted-greaves', text: 'By nightfall half the vanguard clanks. Holt saves the best plates for a pair of greaves, riveted to fit you, and charges you nothing, which he says is a first and will be a last.' },
  },
  /* ------------------------------------------------------ Outrider Maeve's hound */
  {
    id: 'a-hound-named-bran',
    name: 'A Hound Named Bran',
    giver: 'outrider-maeve',
    text: 'Outrider Maeve came north with the vanguard’s scouts and her hound Bran, who has never once come when called and has always come back. Three days ago he ran off after the King’s hounds toward the Kennels, east of Dawn’s Rest, and he hasn’t. Maeve can’t leave her post. Go to the King’s Kennels and look for him.',
    objective: { kind: 'explore', spot: 'hound-kennels', label: 'Look for Bran at the King’s Kennels' },
    after: ['the-last-road'],
    zone: 'pale-reach',
    level: 57,
    reward: { xp: 650, gold: 680 },
  },
  {
    id: 'gravejaw',
    name: 'Gravejaw',
    giver: 'outrider-maeve',
    text: 'Bran’s collar was lying in the Kennels, chewed through, beside tracks as wide as a plate. The King’s hounds have a mother, the old kennel-bitch the King’s huntsmen called Gravejaw, and she is bigger than anything with four legs ought to be. Maeve would like a word with her, and since Maeve can’t leave her post, the word is yours. Kill Gravejaw at the King’s Kennels, east of Dawn’s Rest.',
    objective: { kind: 'kill', region: 'pale-reach', count: 1, enemies: ['gravejaw'], label: 'Kill Gravejaw at the King’s Kennels' },
    after: ['a-hound-named-bran'],
    zone: 'pale-reach',
    level: 58,
    reward: { xp: 1100, gold: 900, item: 'outriders-boots', text: 'That evening Bran limps into Dawn’s Rest on his own, thinner and very pleased with himself, and Maeve pretends she wasn’t worried. She gives you her spare boots. “They’ve walked the Reach twice,” she says. “They know the way.”' },
  },
];

export const PALE_REACH_NPCS: Record<string, NpcDef> = {
  'commander-aldric': {
    id: 'commander-aldric',
    name: 'Commander Aldric',
    title: 'Commander of the Vanguard',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-last-road', state: 'active' },
        lines: ['You came up the north road from the lake? Then you’re the one who killed the Lich. The Ferryman sends his regards. He sends them with my dead, mostly.', 'I’m Aldric. The Regent sent me north after Highwall to find the road to Duskspire. I found it. It’s cold, and there’s an army standing on it.'],
      },
      {
        when: { quest: 'the-kings-kennels', state: 'active' },
        lines: ['The King keeps hounds. Hairless, grey, and they hunt by the warmth of you. Stray from the fires and they find you.', 'Four foragers this week. The Kennels are east of here. Kill ten, and my lads can go for firewood without saying goodbye first.'],
      },
      {
        when: { quest: 'the-drake-graves', state: 'active' },
        lines: ['Every dusk the drakes come over. Bone and wings and nothing in between, and they stoop on the sentries.', 'My scouts followed them north-east, to the Drake Graves. The King dug up his grandfather’s war-drakes. Family is important to him, apparently. Ground five.'],
      },
      {
        when: { quest: 'the-kings-host', state: 'active' },
        lines: ['North-west of here the King’s Host stands in the snow, rank on rank, waiting for his word.', 'When it comes, they march, and we’re in the way. I don’t mean to wait. Thin the ranks: ten of them, legionnaires or knights.'],
      },
      {
        when: { quest: 'the-pale-standard', state: 'active' },
        lines: ['The ranks closed again by morning. There’s a standard in the middle of the Host, the King’s colors on black iron, and while it flies the dead knit together.', 'A giant carries it. One of his old guard. Bring it down.'],
      },
      {
        when: { quest: 'the-duskspire-gate', state: 'active' },
        lines: ['The Host has no colors to close ranks on, and the road north is open. First time anyone’s seen the foot of Duskspire in three hundred years and lived.', 'Go and look at the gate. They say it has seven locks. I’d like to know before I send anyone up there.'],
      },
      {
        when: { quest: 'the-hollow-guard', state: 'active' },
        lines: ['Seven locks, one for each sigil. And you carry all seven. The Regent knew something after all.', 'The King’s guard holds the court inside, under a Ser Maltheus who held that gate against the Sigil-wardens for nine days. Nine days. Break him in one.'],
      },
      {
        when: { quest: 'the-hollow-king', state: 'active' },
        lines: ['The Hollow Guard is broken. Above the court, the Stair of Ash, and at the top of it, him.', 'Everything since the empty tomb has come to this. I’d go with you, but the door only opens for seven sigils, and I have none. Go. End it.'],
      },
      {
        when: { quest: 'the-hollow-king', state: 'done' },
        lines: ['The dead lay down all over the Reach. Rank on rank, at once. The sky went grey, then pink. I’d forgotten pink.', 'Go home. Tell the Regent. Then sleep for a week. I intend to.'],
      },
      {
        when: { quest: 'the-hollow-guard', state: 'locked' },
        lines: ['Seven locks bar the Duskspire Gate, one for each sigil. Whoever goes through carries all seven, or doesn’t go through.', 'Until then we hold Dawn’s Rest and do what we can on this side of the gate.'],
      },
      { lines: ['Dawn’s Rest. It was a waystation once, for pilgrims going north. Nobody has gone north in three hundred years.', 'Keep to the fires. Mind the hounds. Don’t look at the Host too long: it looks back.'] },
    ],
  },
  'brother-cael': {
    id: 'brother-cael',
    name: 'Brother Cael',
    title: 'Healer of the Vanguard',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Vanguard’s Infirmary',
    talk: [
      {
        when: { quest: 'the-hollowing', state: 'active' },
        lines: ['They throw something, the reavers. Not cold, not shadow. Afterwards nothing takes: not salve, not prayer, not potion.', 'The soldiers call it the Hollowing. Bring me the shards they carry where their hearts should be, and I’ll find out what it is.'],
      },
      {
        when: { quest: 'old-wintersend', state: 'active' },
        lines: ['Splinters of the Rift. I was afraid of that. There’s one cure in all the books, and it’s three hundred years old.', 'The temple at Wintersend, south-west of here, kept a reliquary against the Hollowing. The winter took the village. See if the hall still stands.'],
      },
      {
        when: { quest: 'the-watchers-of-wintersend', state: 'active' },
        lines: ['They’re still there? Keeping watch, after three hundred years? That’s faith. Or frost. Hard to tell, this far north.', 'Lay them to rest, gently, and bring me the reliquary. I think they’d want it used.'],
      },
      { when: { quest: 'the-watchers-of-wintersend', state: 'done' }, lines: ['Twelve soldiers back on their feet this morning, and the stone’s still warm. Keep your half close.', 'I read the rites over Wintersend’s watchers, too. It seemed only fair.'] },
      { lines: ['The Vanguard’s Infirmary. Beds, blankets, potions and a brazier, and the brazier is the most popular.', 'Take what potions you need. The vanguard paid for them in Highwall; you’re the vanguard now.'] },
    ],
  },
  'quartermaster-holt': {
    id: 'quartermaster-holt',
    name: 'Quartermaster Holt',
    title: 'Quartermaster of the Vanguard',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'The Vanguard’s Stores',
    talk: [
      {
        when: { quest: 'cold-iron', state: 'active' },
        lines: ['Highwall mail. Made for Highwall winters. The Reach eats Highwall winters for breakfast and asks for seconds.', 'The pale knights wear good steel under the rot. Bring me four plates and I’ll rivet them over a coat. The previous owners won’t miss them.'],
      },
      {
        when: { quest: 'riveted-coats', state: 'active' },
        lines: ['First lad in a riveted coat took a reaver’s bolt in the chest and walked back complaining about the draught. Complaining! I nearly wept.', 'I want one for every soldier. The knights still have the rest. Six more, please. My lads will do the unbuckling.'],
      },
      { when: { quest: 'riveted-coats', state: 'done' }, lines: ['Half the vanguard clanks now. You can hear us coming a mile off. So can the dead, but they could anyway.', 'Wear the greaves. No charge. Don’t tell anyone; I have a reputation.'] },
      { lines: ['The Vanguard’s Stores. Armor for every class of hero and every degree of cold.', 'Everything is signed out, signed for and signed again. If you lose it, you buy it. If you die in it, we’ll call it even.'] },
    ],
  },
  'outrider-maeve': {
    id: 'outrider-maeve',
    name: 'Outrider Maeve',
    title: 'Scout of the Vanguard',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'a-hound-named-bran', state: 'active' },
        lines: ['Bran has never once come when called. He’s always come back, though. Always.', 'Three days ago he went after the King’s hounds, east toward the Kennels. I can’t leave my post. Will you look?'],
      },
      {
        when: { quest: 'gravejaw', state: 'active' },
        lines: ['His collar. Chewed through. And those tracks, as wide as a plate. That’ll be Gravejaw, the old kennel-bitch.', 'I’d like a word with her. I can’t leave my post, so it’s your word. Make it a short one.'],
      },
      { when: { quest: 'gravejaw', state: 'done' }, lines: ['He walked in at dusk like he’d been out for a stroll. Thinner. Smug. I wasn’t worried.', 'I was a bit worried. Keep the boots.'] },
      { lines: ['I scout the road north for the vanguard. It goes north. It’s cold. There, that’s the report.', 'Bran? He’s around. He’s always around, except when he isn’t.'] },
    ],
  },
};
