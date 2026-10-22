# Sigilfall: the world and the Hollow King

The story bible for Sigilfall's world: the villain, the four acts of the main story, every zone and
dungeon with its levels, look, town and part in the story. Zones, quests, enemies and dungeons are
built from this; when something here changes, change it here first.

## The Hollow King

Long ago **Vaelor** was king of these lands. Afraid of dying, he bargained with the Rift for a life
that would not end, and it hollowed him out: a king with no heart, who wanted nothing but to rule the
living as he rules the dead. The Sigil-wardens of the old kingdoms broke his armies, sealed the Rift
with their seven sigils, and shut Vaelor in a crypt beneath the Whisperwood, his heart torn out and
locked away so he could never wake.

The sigils have fallen (the game's first line). Morgrave, a scholar who went looking for the King's
secret, opened the Hollow Crypt's heart, and though the hero stops him there, the sarcophagus at its
center is empty: the Hollow King has already gone north. In the Pale Reach, at his old citadel of
**Duskspire**, he is raising the **Hollow Legion**: the dead of every battlefield, drowned sailors,
plague-turned villagers, barrow kings, death knights who were heroes once. His voice in the world is
the **Pale Herald**, who buys bandits, smugglers and traitors with Hollow gold. His lieutenants each
hold a front of the war. To win he needs the seven fallen sigils: with them he can tear the Rift open
for good and pull the whole world into his hollow kingdom.

The hero follows his trail across the world, gathers the sigils before he can, breaks his lieutenants
one by one, and climbs Duskspire to end him.

### His lieutenants (dungeon bosses along the main story)

| Lieutenant | Front | Dungeon |
| --- | --- | --- |
| The Pale Herald | his voice: gold, lies and traitors (Acts I-IV) | Spire of the Rift (finally) |
| The Drowned Priestess | the drowned fleet | Smugglers’ Grotto |
| The Rot-Mother | the plague that turns villages into ghouls | Rotmother’s Cistern |
| Forgemaster Grold | bone-steel for the Legion's weapons | Deepforge Halls |
| Sir Corvane the Fallen | the first death knight; raises the barrow kings | Barrow of Kings |
| General Morvain | the siege of Highwall | Siege of Highwall |
| The Withered Queen | the blight that kills the land | Blightheart |
| Ashkar the Bound | a fire lord chained to forge the Pale Crown | Molten Throne |
| Vaelor, the Hollow King | everything | Duskspire |

### The seven sigils (main story rewards)

The Sigil of Embers (Emberwick, Act I), of Tides (Saltmarsh), of Stone (Ironpeak), of the Sun
(Sunscorch), of Frost (Rimeheld), of Thorns (Blightwood) and of the Veil (Riftscar). Each one the
hero wins is a chain-end reward that matters: the sigils are what let the hero stand in Duskspire at
all (the last door opens only for someone carrying all seven).

## The four acts

The main story runs through the main chain of every zone below, from level 1 to 60 (about 20 hours
with side quests and dungeons). Each zone's main chain ends by pointing to the next.

1. **Act I, The King Stirs (levels 1-16).** Emberwick, the Whisperwood, the Hollow Crypt (the empty
   sarcophagus), Brackenridge, Thornvale and Gallows Keep (Varric was paid in Hollow gold; letters
   signed by the Pale Herald), Greyfen (the first ghouls). Ends with the Regent of Emberwick naming
   the enemy.
2. **Act II, The Tide of Bones (14-32).** The Saltmarsh and the drowned fleet, the Amberfield Steppes
   (refugees), Duskfen's plague, Ironpeak's stolen forge, the Ashen Barrows and Sir Corvane,
   Stormwatch Cliffs (the fleet strikes). Ends with Corvane's fall and the first proof that the King
   is after the sigils.
3. **Act III, The Long Night (29-47).** The race for the sigils: Sunscorch and the Sun King's tomb,
   the Glimmerwood's fey courts, the cursed Grimward Moors, Rimeheld's frozen vault, the Shattered
   Vale where the Rift bleeds, Sablewind Canyon, Vinecoil Jungle, and the great siege of Highwall.
4. **Act IV, The Pale Crown (42-60).** Into the King's own lands: the Blightwood, Frostfang Peaks, the
   Sunken Reaches, the Bonefields where the Legion musters, the Weeping Woods, Emberdeep, the
   Riftscar Wastes, Gloamhollow, Hollowmere and the Pale Reach, to Duskspire and Vaelor.

## The main story, Acts I and II, quest by quest

Each zone's main chain starts with the quest named here (with that `after`, giver and level) and ends
with the one named here; the story quests in `data/story.ts` join them. The ids are fixed: other zones
and the story depend on them.

| Zone | First quest of its chain | Last quest of its chain |
| --- | --- | --- |
| Brackenridge | `west-road`: after `alpha`, from Maren, level 5 (talk to Warden Hollis in Fernstead) | `lay-the-grey-lady`: kill the Grey Lady, a Sigil-warden's widow who woke when the King did; her last words: he calls all the dead |
| Thornvale | `south-road`: after `alpha`, from Maren | `the-bandit-king` (Varric) → story `hollow-gold` |
| Greyfen | `the-digging-dead`: after `the-empty-tomb`, from Maren, level 11 (talk to Marshwarden Tilde in Reedwater) | `the-ghoul-mother`: kill Mother Mire; the ghouls were made by a sickness brewed in Duskfen |
| **Act I ends** | `the-regents-council` (story): after `hollow-gold` and `the-ghoul-mother`, the Regent names the enemy | the Sigil of Embers |
| Saltmarsh | `east-to-gullport`: after `hunt-black-bess` | `captain-saltbeard` → story `the-drowned-fleet` (the Sigil of Tides) |
| Amberfield | `refugees-on-the-road`: after `the-regents-council`, from the Regent, level 16 (talk to Marshal Dunmore in Hearthstead) | `orders-from-the-north`: the Legion's orders: bone-steel from the stolen Deepforge at Ironpeak |
| Duskfen | `the-sick-villages`: after `the-ghoul-mother`, from Marshwarden Tilde, level 18 (talk to Healer Osk in Stilt Hollow) | `the-rot-mother`: defeat the Rot-Mother in her cistern |
| Ironpeak | `the-dwarves-plea`: after `orders-from-the-north`, from Marshal Dunmore, level 20 (talk to Thane Borrik in Kragholt) | `forgemaster-grold`: defeat Grold in the Deepforge Halls (the Sigil of Stone) |
| Ashen Barrows | `the-lanterns-dim`: after `the-dwarves-plea`, from Thane Borrik, level 23 (talk to Lamplighter Ivo on Lantern Hill) | `sir-corvane`: defeat Sir Corvane in the Barrow of Kings |
| Stormwatch | `the-lighthouse-calls`: after `the-drowned-fleet`, from Harbormaster Quill, level 26 (talk to Keeper Ansel) | `the-last-light`: the drowned fleet broken against the lighthouse |
| **Act II ends** | `the-kings-design` (story): after `sir-corvane`; Corvane carried a map of where the seven sigils rest | Act III: the race for the sigils |

The new dungeons and their bosses (ids fixed; the zone chains above fight them):

| Dungeon (id) | Levels | Way in | Bosses |
| --- | --- | --- | --- |
| The Rotmother's Cistern (`rotmother-cistern`) | 22-25 | Duskfen, the Cistern Mouth (level 21) | Brother Pustule (`brother-pustule`), the Rot-Mother (`the-rot-mother`) |
| The Deepforge Halls (`deepforge-halls`) | 25-28 | Ironpeak, the Deepforge Gate (level 24) | the Slag Colossus (`slag-colossus`), Forgemaster Grold (`forgemaster-grold`) |
| The Barrow of Kings (`barrow-of-kings`) | 28-31 | the Ashen Barrows, the Kings' Mound (level 27) | King Hrodric (`king-hrodric`), Sir Corvane the Fallen (`sir-corvane`) |

## The main story, Act III, quest by quest

After Corvane's map, the Regent knows where the sigils rest. The Sun and Frost sigils still lie in their old
vaults, and the hero races the Legion to them; the Withered Queen (the Blightwood) and the Pale Herald (the
Riftscar) hold the last two, which wait for Act IV. Meanwhile the Legion marches on Highwall, the great fortress
that guards the road north to the King's own lands. Ids are fixed, as above.

| Zone | First quest of its chain | Last quest of its chain |
| --- | --- | --- |
| Grimward Moors | `the-howling-moors`: after `the-kings-mound`, from Lamplighter Ivo, level 29 (talk to Huntmaster Orla in Grimward) | `the-wolf-king`: kill Moonfang, first of the King's cursed; the curse rose from a shard of the Rift in the Shattered Vale |
| Sunscorch Expanse | `the-sun-kings-tomb`: after `the-kings-design`, from the Regent, level 30 (talk to Oasis-keeper Sefu at the Oasis of Ras) | `the-sun-king`: defeat the Sun King in his tomb (the Sigil of the Sun) |
| Glimmerwood | `the-fading-lights`: after `the-kings-design`, from Maren, level 31 (talk to Lady Silvaine in Lumen Glade) | `the-thorn-court`: kill Prince Thistlemourn; the fey were turned by the Withered Queen's blight from the Blightwood, where she keeps the Sigil of Thorns |
| Rimeheld Tundra | `the-frozen-road`: after `the-kings-design`, from the Regent, level 33 (talk to Jarl Sigrun in Frostgate) | `the-vault-of-rime`: defeat the Rime Wyrm in the Rimeheld Vault (the Sigil of Frost) |
| Shattered Vale | `where-the-rift-bleeds`: after `the-wolf-king`, from Huntmaster Orla, level 35 (talk to Magister Quell in Shardwatch) | `the-heart-of-the-tear`: kill the Tearborn; the Pale Herald is feeding the Rift from the Riftscar |
| Sablewind Canyon | `the-supply-road`: after `the-sun-king`, from Oasis-keeper Sefu, level 37 (talk to Foreman Garrick in Dustcrown) | `the-quartermasters-end`: kill Quartermaster Vane; the Legion's wagons feed the siege of Highwall |
| Vinecoil Jungle | `the-serpent-temples`: after `the-sun-king`, from Keeper Ansel (Stormwatch), level 39 (talk to Warden Kesh in Vinehold) | `the-coiled-queen`: kill the Coiled Queen, who sold the King the venoms for his plague |
| Highwall March | `the-wall-burns`: after `the-quartermasters-end`, from the Regent, level 40 (talk to Lord-Commander Varn) | `general-morvain`: defeat General Morvain in the Siege of Highwall |
| **Act III ends** | `the-long-night-ends` (story): after `general-morvain`: Highwall holds, and the road north into the King's lands is open | Act IV |

The Act III dungeons and their bosses:

| Dungeon (id) | Levels | Way in | Bosses |
| --- | --- | --- | --- |
| The Tomb of the Sun King (`tomb-of-the-sun-king`) | 34-37 | the Sunscorch, the Sunken Gate (level 33) | the Sand Warden (`the-sand-warden`), the Sun King (`the-sun-king`) |
| The Rimeheld Vault (`rimeheld-vault`) | 38-41 | Rimeheld, the Vault Door (level 37) | Jarl Hrimfang (`jarl-hrimfang`), the Rime Wyrm (`the-rime-wyrm`) |
| The Siege of Highwall (`siege-of-highwall`) | 43-46 | Highwall March, the Breach (level 42) | the Siege-Breaker (`the-siege-breaker`), General Morvain (`general-morvain`) |

## The main story, Act IV, quest by quest

Highwall holds, and the road north is open. Act IV goes into the Hollow King's own lands: the Withered Queen
holds the Sigil of Thorns in the Blightwood, the Pale Herald the Sigil of the Veil in the Riftscar, and at
Emberdeep the fire lord Ashkar is chained to forge the Pale Crown, which would make the King's hold on the dead
unbreakable. With all seven sigils the hero crosses the Pale Reach to Duskspire. Ids are fixed, as above.

| Zone | First quest of its chain | Last quest of its chain |
| --- | --- | --- |
| The Blightwood | `the-withering`: after `the-thorn-court`, from Lady Silvaine, level 42 (talk to Elder Thessaly in Last Leaf) | `the-withered-queen`: defeat the Withered Queen in Blightheart (the Sigil of Thorns) |
| Frostfang Peaks | `the-high-passes`: after `the-vault-of-rime`, from Jarl Sigrun, level 44 (talk to Eagle-warden Brynn at Eagle's Rest) | `the-eagle-throne`: kill Skyrend, the great frost roc whose eyrie guards the passes; the Legion's road north runs below it |
| The Sunken Reaches | `the-drowned-harbor`: after `the-long-night-ends`, from Keeper Ansel, level 46 (talk to Captain Isolde in Driftwood) | `the-tide-lord`: kill the Tide Lord, the drowned fleet's master, and sink its harbor |
| The Bonefields | `into-the-bonefields`: after `the-long-night-ends`, from Lord-Commander Varn, level 48 (talk to Marshal Ardent at the Forward Camp) | `the-bone-colossus`: kill the Bone Colossus at the heart of the Legion's muster |
| The Weeping Woods | `the-candle-road`: after `the-bone-colossus`, from Marshal Ardent, level 50 (talk to Candlewife Hesper in Candlewick) | `the-weeping-lord`: kill the Weeping Lord, a Sigil-warden of the old war who never left the wood |
| Emberdeep Caldera | `the-pale-crown`: after `the-bone-colossus`, from Marshal Ardent, level 51 (talk to Thane Hroki in Cinderhold) | `ashkar-the-bound`: free (defeat) Ashkar in the Molten Throne and break the Pale Crown |
| The Riftscar Wastes | `the-veil-torn`: after `the-heart-of-the-tear`, from Magister Quell, level 53 (talk to Archmage Orrin in Veilwatch) | `the-pale-herald`: defeat the Pale Herald in the Spire of the Rift (the Sigil of the Veil) |
| Gloamhollow | `the-kings-border`: after `the-weeping-lord`, from Candlewife Hesper, level 54 (talk to Lamp-keeper Ada in Lastlight) | `the-gloam-gate`: kill the Gatewarden who keeps the King's border |
| Hollowmere | `the-dead-lake`: after `the-gloam-gate`, from Lamp-keeper Ada, level 56 (talk to the Ferryman) | `the-necropolis`: kill the Lich of Hollowmere in the necropolis on the water |
| The Pale Reach | `the-last-road`: after `the-necropolis`, from the Ferryman, level 57 (talk to Commander Aldric at Dawn's Rest) | `the-hollow-king`: defeat Vaelor in Duskspire (its last door opens only for all seven sigils) |
| **The end** | `the-dawn` (story): after `the-hollow-king`: the Regent, the city, the sigils | the epilogue |

The Act IV dungeons:

| Dungeon (id) | Levels | Way in | Bosses |
| --- | --- | --- | --- |
| Blightheart (`blightheart`) | 47-50 | the Blightwood, the Heartroot (level 46) | the Rotwood Colossus (`rotwood-colossus`), the Withered Queen (`the-withered-queen`) |
| The Molten Throne (`molten-throne`) | 54-57 | Emberdeep, the Throne's Gate (level 53) | the Magma Warden (`magma-warden`), Ashkar the Bound (`ashkar-the-bound`) |
| The Spire of the Rift (`spire-of-the-rift`) | 56-59 | the Riftscar, the Spire's foot (level 55) | the Veil Sentinel (`veil-sentinel`), the Pale Herald (`the-pale-herald`) |
| Duskspire (`duskspire`) | 60 | the Pale Reach, the Duskspire Gate (level 58, all seven sigils) | the Hollow Guard (`hollow-guard`), Vaelor, the Hollow King (`vaelor`) |

### What Acts I and II hold (built)

- **Brackenridge** (Fernstead: Warden Hollis, Mother Alsa's inn, Pip's hides): kobolds who dug into the barrows,
  the first undead, King Snagtooth, Old Rustback and the Grey Lady.
- **Greyfen** (Reedwater: Marshwarden Tilde, Old Ferris's inn, Nella's oddments): ghouls, drowned villagers, bog
  hags, Longshanks and Mother Mire.
- **The Amberfield** (Hearthstead: Marshal Dunmore, Tess's inn, Gaius's cart, Wynn the fletcher): centaur clans and
  their war-chief Stormhoof, Goldmane, the Legion's riders and hounds under Captain Vosk.
- **Duskfen** (Stilt Hollow: Healer Osk, Brother Wendel's hostel, Mags): plague ghouls, bloated corpses, rot-sisters,
  trolls, Gutrot and Bogmaw; the Rotmother's Cistern.
- **Ironpeak** (Kragholt: Thane Borrik, Hilda's Frostmalt, Oz's facets, Brenna the smith, Grold's daughter): Legion
  miners, bonecallers and slagthrowers, bone golems, griffons, Stormwing and Old Horn; the Deepforge Halls.
- **The Ashen Barrows** (Lantern Hill: Lamplighter Ivo, Sister Maud's rest, Kell's grave goods): wights, wight
  knights and archers, banshees, corpse-candles, the Headless Lord and Mother Aldith; the Barrow of Kings.
- **Stormwatch** (the lighthouse town: Keeper Ansel, Captain Morra, Bosun Pike's Drowned Man, Odile the glasswright):
  the drowned fleet's sailors, gunners and chanters, barnacle brutes, storm harpies, elementals and wisps, Captain
  Gloam, the Galemother, and Admiral Blackwake at the Stormwatch Light.

### What Act III holds (built)

- **The Grimward Moors** (Grimward: Huntmaster Orla, Bram's Wolf's Head, Vey's silverworks, Carter Joss): moor
  wolves, werewolves and their howlers, the Legion's hollow hunters, gibbet crows; Hob the miller, Gallowmaw, the
  Barghest and Moonfang, the wolf king.
- **The Sunscorch Expanse** (the Oasis of Ras: Oasis-keeper Sefu, Kasim's Last Well, Zahra's bazaar, Ibbi the
  sandscribe): scorpions, sand wurms, dune raiders and javelineers, tomb scarabs and sun mummies, the Legion's
  diggers; Khamsin, the Dune Tyrant; the Tomb of the Sun King.
- **The Glimmerwood** (Lumen Glade: Lady Silvaine, Old Root's Dew & Honey, Pip's Pocketful): thornlings, blighted
  dryads, fey knights, thorn archers, glimmer moths, blight blooms and stags; the Mother of Moths, the Pale Hart and
  Prince Thistlemourn.
- **Rimeheld Tundra** (Frostgate: Jarl Sigrun, Olav's Mead-Hall, Hild's runed steel, Huntress Ylva): Legion
  huscarls and spearmen, frost giants, rime wraiths, ice wolves and yetis; Old Whitefang and Grumbleback; the
  Rimeheld Vault.
- **The Shattered Vale** (Shardwatch: Magister Quell, Hesk's Bent Spire, Ennis's cabinet, Sergeant Dace): rift
  shardlings, shard golems, rift stalkers and wyrms, the Herald's voidcallers; the Glass Matron, Old Coil, the
  Flicker and the Tearborn.
- **Sablewind Canyon** (Dustcrown: Foreman Garrick, Dora's Dust-Up, Ilya the scout): the Legion's teamsters, bone
  haulers, sappers and wagon guards, canyon raptors and cliff rocs; the Red Matriarch and Quartermaster Vane.
- **Vinecoil Jungle** (Vinehold: Warden Kesh, Tuoko's Smoking Gourd, Mabel's hides): panthers, blood mosquitoes,
  vine stranglers, serpent cultists, naga and temple vipers; Nightpelt and the Coiled Queen.
- **Highwall March** (the relief camp: Lord-Commander Varn, Chaplain Ottis's field hospital, Quartermaster Bess):
  the Legion's soldiers, crossbowmen, ensigns, bone catapults and death-knight initiates, the Ashby ghouls; Captain
  Hollowbane; the Siege of Highwall.
- **The Tomb of the Sun King**: ushabti guardians, embalmer priests and their wrapped dead, scarab swarms and sand
  wraiths; the Sand Warden (quicksand, a rolling wall of sand, and a heap of sand that reforms unless its wraiths
  die) and the Sun King (a sun disc whose light only the pillars' shadows escape, sweeping beams, rings of fire).
- **The Rimeheld Vault**: Hrimfang's giant huscarls and hurlers, rime hounds, icebound wardens and rime elementals;
  Jarl Hrimfang (stomps of ice spikes, thrown boulders, a war cry that calls his huscarls) and the Rime Wyrm (ice
  that freezes whoever stands on it too long, a sweeping breath the columns stop, gusts, and flights out of reach).
- **The Siege of Highwall**: shieldbearers, arbalesters, standard-bearers, carrion ghouls and death-knight squires;
  the Siege-Breaker (rams that bring the walls down, pitch and torches) and General Morvain (his banner wards his
  troops, squads march in through the gates, and in his last volley only the ground round his colors is safe).

## The capital

**Emberwick**, the Ember City, is where every hero starts and where the story keeps coming back: a
walled city with gates to the roads, a market square, taverns and inns, the forge and the armory,
trainers, the temple of the Sigil-wardens, the training grounds, and the Regent's keep. The Regent,
Elowen, and Elder Maren give the main story's turning points.

## Zones

Levels overlap, as in the old games: there is usually more than one zone for any level.

| Zone (id) | Levels | Look | Town | Part in the story | Dungeon |
| --- | --- | --- | --- | --- | --- |
| Emberwick (`emberwick`) | 1 | the capital | Emberwick | the start; the Regent | |
| The Whisperwood (`whisperwood`) | 2-6 | forest | Emberwick | the Rift-maddened alpha | The Hollow Crypt 6-9 |
| Brackenridge Hills (`brackenridge`) | 5-10 | autumn hills | Fernstead | barrow ghosts walk; the first undead | |
| Thornvale (`thornvale`) | 8-14 | farmland | Millbrook | the Gallows Gang, paid in Hollow gold | Gallows Keep 13-16 |
| Greyfen Marsh (`greyfen`) | 11-17 | marsh | Reedwater | drowned villages, the first ghouls | |
| The Saltmarsh Coast (`saltmarsh`) | 14-20 | coast | Gullport | the drowned fleet; the Sigil of Tides | Smugglers’ Grotto 19-22 |
| Amberfield Steppes (`amberfield`) | 16-22 | plains | Hearthstead | refugees; centaur clans; Legion scouts | |
| Duskfen (`duskfen`) | 18-24 | plague swamp | Stilt Hollow | the Rot-Mother's plague | Rotmother’s Cistern 22-25 |
| Ironpeak Highlands (`ironpeak`) | 20-26 | mountains | Kragholt | the dwarves' forge seized; the Sigil of Stone | Deepforge Halls 25-28 |
| The Ashen Barrows (`ashen-barrows`) | 23-29 | barrow downs | Lantern Hill | Sir Corvane raises the barrow kings | Barrow of Kings 28-31 |
| Stormwatch Cliffs (`stormwatch`) | 26-32 | stormy coast | Stormwatch | the drowned fleet strikes the lighthouse | |
| Grimward Moors (`grimward`) | 29-35 | moor | Grimward | the King's curse: werewolves | |
| The Sunscorch Expanse (`sunscorch`) | 30-36 | desert | Oasis of Ras | the Sun King's tomb; the Sigil of the Sun | Tomb of the Sun King 34-37 |
| The Glimmerwood (`glimmerwood`) | 31-37 | fey forest | Lumen Glade | the fey courts turned | |
| Rimeheld Tundra (`rimeheld`) | 33-39 | snow | Frostgate | frost giants; the Sigil of Frost | Rimeheld Vault 38-41 |
| The Shattered Vale (`shattered-vale`) | 35-41 | rift-scarred | Shardwatch | where the Rift bleeds | |
| Sablewind Canyon (`sablewind`) | 37-43 | canyon | Dustcrown | Legion supply roads | |
| Vinecoil Jungle (`vinecoil`) | 39-45 | jungle | Vinehold | the old serpent temples | |
| Highwall March (`highwall`) | 40-46 | war-torn | Highwall | the siege of Highwall | Siege of Highwall 43-46 |
| The Blightwood (`blightwood`) | 42-47 | blight | Last Leaf | the Withered Queen; the Sigil of Thorns | Blightheart 47-50 |
| Frostfang Peaks (`frostfang`) | 44-49 | snowy peaks | Eagle’s Rest | the high passes north | |
| The Sunken Reaches (`sunken-reaches`) | 46-51 | drowned ruins | Driftwood | the drowned fleet's harbor | |
| The Bonefields (`bonefields`) | 48-53 | Legion camps | Forward Camp | where the Legion musters | |
| The Weeping Woods (`weeping-woods`) | 50-55 | haunted forest | Candlewick | the restless dead of the old war | |
| Emberdeep Caldera (`emberdeep`) | 51-56 | volcanic | Cinderhold | Ashkar forges the Pale Crown | Molten Throne 54-57 |
| The Riftscar Wastes (`riftscar`) | 53-58 | rift | Veilwatch | the Pale Herald; the Sigil of the Veil | Spire of the Rift 56-59 |
| Gloamhollow (`gloamhollow`) | 54-59 | dark fen | Lastlight | the King's border | |
| Hollowmere (`hollowmere`) | 56-60 | dead lake | the Ferry | the necropolis on the water | |
| The Pale Reach (`pale-reach`) | 57-60 | frozen dead lands | Dawn’s Rest | the road to Duskspire | Duskspire 60 |

## Duskspire and the Hollow King

The last dungeon: the citadel's gate, the Hall of Kneeling Dead, the King's guard, and the throne.
Vaelor is the hardest fight in the game, made to be won by a level-60 hero in their best gear who has
learned it:

1. **The King on the Throne.** Sweeping blade waves across the hall, chains of souls that tether the
   hero to a pillar until broken, the Hollow Guard at his call.
2. **Hollowbrand.** He takes up his sword: the floor rots in spreading pools that never go away,
   ghouls pour from the walls, and his strikes leave lines that burst a moment later.
3. **The Throne Breaks.** The edges of the hall fall away, homing souls hunt the hero, a freezing
   ring closes in with spikes rising inside it.
4. **The Last King.** Below a tenth of his life: everything at once and faster, and a doom that ends
   the fight if he isn't down in time.
