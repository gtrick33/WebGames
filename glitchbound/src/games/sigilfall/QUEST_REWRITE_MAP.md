# Sigilfall — Quest Rewrite Map

Every existing quest id (296), its place in *The Crown of Ash and Starlight* (STORY_BIBLE.md) and what happens
to it. **No id is renamed or removed**: saves keep their quest states. Status: **KEEP (retold)** — objective and
rewards stay, all text rewritten in the new story; **REWRITE** — new purpose and text, objective may change
kind (a save that finished it keeps it finished); **REPURPOSE** — same mechanic moved to a new place or giver.

Retired quests: none. Zoneless quests given by Elder Maren move with her to Briarhollow.

## New quests the story adds

| Id (new) | Act | Kind | What |
| --- | --- | --- | --- |
| `briar-dusk` | Prologue | talk | Arrive at Briarhollow at dusk; Mara at the gate; Oskar Fell and the broken royal seal |
| `briar-the-seal` | Prologue | talk | Show the seal to Elder Maren (quest item) |
| `briar-nightfall` | Prologue | event: raid | Nightfall: defeat the raiders in the lanes (village in raid state) |
| `briar-the-inn` | Prologue | event: rescue | Reach the burning inn; three children follow you to the chapel; meet Elyra |
| `briar-hold-the-door` | Prologue | event: defend | Hold the chapel door with Mara and Elyra (waves) |
| `briar-below` | Prologue | explore | The raiders dig under the chapel: the crypt stair (leads into the old Hollow Crypt chain) |
| `briar-the-reliquary` | Prologue | talk | After Morgrave: the fragment bonds to Elyra; the mark of the Ashen Host |
| `briar-dawn` | Prologue | talk | Aftermath; Briarhollow becomes the camp (village in aftermath state) |
| `camp-scouts`, `camp-grain`, `camp-healers`, `camp-smiths`, `camp-riders` | Act I | event: arrival | Each saved village’s people walk into the camp and stay (built) |
| `mill-the-bridge` | Act I · Millbrook | event: raid | Break the gang’s blockade at the mill with Sefa and the militia; before `hollow-gold` (built) |
| `reed-bring-them-home` | Act I · Reedwater | event: rescue | Lead the three abducted home from Mire’s cage (built) |
| `gull-the-slip` | Act I · Gullport | event: defend | The drowned come up the beach for the Patience; before `the-drowned-fleet` (built) |
| `hearth-the-riders-come` | Act I finale | event: raid | Vosk’s riders in Hearthstead’s square (built) |
| `hearth-hold-the-wall` | Act I finale | event: defend | Mara on the wall, Fernstead rangers and Dunmore’s riders, three waves at the gate (built) |
| `hearth-the-ram` | Act I finale | event: defend + siege enemy | The ashen ram at the gate; Elyra breaks it (built) |
| `hearth-the-shrine` | Act I finale | explore | Vosk is gone with the second fragment; `orders-from-the-north` is now Gaius reading his dropped orders (built) |
| `nyx-*` | Act II | talk / infiltrate | Nyx joins at Stilt Hollow; the smugglers’ path; the Deepforge infiltration |
| `orren-*`, `cael-*` | Act II | talk / defend | Lantern Hill: meet Orren and Cael; Cael’s shame; the Ninefold Watch |
| `city-*` | Act II | investigate | The countermanded order through the treasury, roads office and the Chancellor’s cellar |
| `festival-*` | Act II finale | event: defend / chase | The Starfall Festival and the assassination attempt |
| `fall-of-fernstead` | Act III | event: raid | The low point: Fernstead burns; its people arrive at the camp |
| `gate-*` | Act IV | siege | The Gloam Gate (Elyra’s rescue, Nyx’s return) and the Muster Hall (future) |

## Every existing quest

| Act / place | Id | Name now | Giver | Status | New role |
| --- | --- | --- | --- | --- | --- |
| Prologue | `first-steps` | First Steps | maren | REPURPOSE | Prologue: Mara tests the hero on Briarhollow’s guard dummies |
| Prologue | `first-spell` | Tricks of the Trade | maren | REPURPOSE | Prologue: Mara, the skill on a dummy |
| Prologue | `first-dodge` | Out of Harm’s Way | maren | REPURPOSE | Prologue: Elyra’s slow bolts; unlocks the Whisperwood road |
| Prologue | `into-the-wood` | Into the Whisperwood | maren | REWRITE | Prologue: thin the Ashen scouts in the Whisperwood before nightfall |
| Prologue | `rift-shards` | Shards of the Rift | brannoc | REWRITE | Prologue side: grieflight shards for Briarhollow’s smith |
| Prologue | `hidden-grove` | The Hidden Grove | ysolde | KEEP | Prologue side: the hidden grove (Elyra’s herb patch) |
| Prologue | `alpha` | The Alpha | maren | REWRITE | Prologue: Grimtusk, the grieflight-maddened boar driving beasts at the village |
| Prologue | `the-warden` | The Warden | maren | REWRITE | Prologue: the Chapel Crypt’s warden, Ossric |
| Prologue | `close-the-rift` | Close the Rift | maren | REWRITE | Prologue climax: stop Morgrave at the reliquary (the first fragment) |
| Prologue | `heroic` | Heroic Deeds | ysolde | KEEP | Postgame gate: Heroic remixes (Chapel Crypt on Heroic) |
| Prologue | `mythic` | Beyond the Rift | ysolde | KEEP | Postgame gate: Mythic remixes |
| Prologue | `the-empty-tomb` | The Empty Tomb | maren | REWRITE | Prologue aftermath: dawn in Briarhollow; Maren founds the camp |
| Prologue | `the-regents-council` | The Regent’s Council | maren | REWRITE | Act I end: Maren reads the broken royal seal; letters hidden in the Crown City (Sigil of Embers perk moves to the Prologue reliquary, id kept) |
| Prologue | `the-kings-design` | The King’s Design | regent-elowen | REWRITE | Act II: Corvane’s proof (the countermanded relief order) to the Regent |
| Act I · Millbrook | `south-road` | The South Road | maren | REWRITE | Act I: Maren sends the hero to Millbrook |
| Act I · Fernstead | `west-road` | The West Road | maren | REWRITE | Act I: Maren sends the hero to Fernstead |
| Act I · Reedwater | `the-digging-dead` | The Digging Dead | maren | REWRITE | Act I: Maren sends the hero to Reedwater |
| Act I finale · Hearthstead | `refugees-on-the-road` | Refugees on the Road | regent-elowen | REWRITE | Act I finale opener: the Regent’s silence; Dunmore asks for help |
| Act II · Escort | `the-sick-villages` | The Sick Villages | marshwarden-tilde | REWRITE | Act II: escort the Hearthstead refugees into Duskfen; meet Nyx |
| Act II · The pass | `the-dwarves-plea` | The Dwarves’ Plea | marshal-dunmore | REWRITE | Act II: the pass north is an occupied toll fortress |
| Act II · Lantern Hill | `the-lanterns-dim` | The Lanterns Dim | thane-borrik | REWRITE | Act II: Lantern Hill; meet Brother Orren and Cael Varrow |
| Act II · The lighthouse | `the-lighthouse-calls` | The Lighthouse Calls | harbormaster-quill | REWRITE | Act II side arc: the drowned fleet strikes |
| Act III · The moors | `the-howling-moors` | The Howling Moors | lamplighter-ivo | REWRITE | Act III: the grieflight curse on the moors |
| Act III · Sun houses | `the-sun-kings-tomb` | The Sun King’s Tomb | regent-elowen | REWRITE | Act III: the Regent sends the hero to the sun houses |
| Act III · Forest clans | `the-fading-lights` | The Fading Lights | maren | REWRITE | Act III: the forest clans |
| Act III · Mountain houses | `the-frozen-road` | The Frozen Road | regent-elowen | REWRITE | Act III: the mountain houses |
| Act III · Low point | `where-the-rift-bleeds` | Where the Rift Bleeds | huntmaster-orla | REWRITE | Act III: toward the Tear |
| Act III · Sun houses | `the-supply-road` | The Supply Road | oasis-keeper-sefu | REWRITE | Act III: the Host’s siege train |
| Act III · Marsh settlements | `the-serpent-temples` | The Serpent Temples | keeper-ansel | REWRITE | Act III: the marsh settlements |
| Act IV · First Gate | `the-wall-burns` | The Wall Burns | regent-elowen | REWRITE | Act IV: the first Gate |
| Act I · Fernstead | `lights-on-the-ridge` | Lights on the Ridge | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `snuff-the-candles` | Snuff the Candles | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `barrow-gold` | Barrow Gold | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `king-snagtooth` | King Snagtooth | warden-hollis | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Fernstead | `the-old-barrows` | The Old Barrows | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `restless-dead` | The Restless Dead | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `the-widows-song` | The Widow’s Song | warden-hollis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `lay-the-grey-lady` | Lay the Grey Lady | warden-hollis | REWRITE | Act I: Fernstead chain end; scouts join the camp |
| Act I · Fernstead | `russet-hides` | Russet Hides | pip-tanner | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `tusker-gully` | Tusker Gully | pip-tanner | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `old-rustback` | Old Rustback | pip-tanner | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Fernstead | `appleby-apples` | Cider Apples | mother-alsa | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `stolen-light` | Stolen Light | mother-alsa | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Fernstead | `the-harvest-stones` | The Harvest Stones | mother-alsa | REWRITE (built) | Act I WORLD EVENT: hold the fouled stones while the candles take (event `fern-stones`) |
| Act I · Millbrook | `hollow-gold` | Hollow Gold | reeve-aldous | REWRITE | Act I: the gang was paid in ash-gold; report to Maren at the camp |
| Act I · Millbrook | `kettle-farm` | Ashes at Kettle Farm | reeve-aldous | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `redcap-camp` | Red Caps | sefa | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `blackhand-orders` | Orders in Black | sefa | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `thieves-cant` | Thieves’ Cant | reeve-aldous | REWRITE | Act I: Pim’s friend Nyx reads the cant (cameo) |
| Act I · Millbrook | `hunt-black-bess` | Black Bess | sefa | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Millbrook | `the-hangman` | The Hangman | sefa | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Millbrook | `the-bandit-king` | The Bandit King | reeve-aldous | REWRITE | Act I: Millbrook chain end; the bridge is free; grain to the camp |
| Act I · Millbrook | `east-to-gullport` | Powder from the Coast | reeve-aldous | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `tobins-fields` | Tobin’s Farm | tobin | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `wolf-pelts` | Pelts for Winter | tobin | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `hunt-old-greymane` | Old Greymane | tobin | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Millbrook | `silk-strainers` | Silk for the Still | hanna | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `pond-water` | Still Waters | hanna | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `witch-herbs` | Hedge Magic | hanna | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `tobins-letter` | A Letter for Hanna | tobin | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Millbrook | `wanted-posters` | Wanted | sefa | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `the-old-churchyard` | Opened from Below | marshwarden-tilde | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `the-hungry-dead` | The Hungry Dead | marshwarden-tilde | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `bone-charms` | Bone Charms | marshwarden-tilde | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `ferris-remembers` | The Midwife’s Mark | marshwarden-tilde | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `the-sunken-hamlet` | The Sunken Hamlet | old-ferris | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `the-drowned-folk` | The Drowned Folk | marshwarden-tilde | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `the-ghoul-mother` | The Ghoul Mother | marshwarden-tilde | REWRITE | Act I: Reedwater chain end; the abducted come home; healers to the camp |
| Act I · Reedwater | `strider-pools` | Bent Traps | nella | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `eel-thieves` | Eel Thieves | nella | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `longshanks` | Longshanks | nella | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Reedwater | `nellas-eels` | Smoked Eel | nella | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `heron-isle` | The Dark Lamp | old-ferris | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `lights-that-lie` | Lights That Lie | old-ferris | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Reedwater | `hags-hollow` | Hag’s Hollow | old-ferris | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `the-drowned-fleet` | The Drowned Fleet | harbormaster-quill | REWRITE | Act I: Gullport’s forge joins the camp; the drowned fleet warning |
| Act I · Gullport | `chapel-on-the-road` | The Drowned Chapel | harbormaster-quill | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `fish-out-of-water` | Fish Out of Water | harbormaster-quill | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `rift-powder` | Rift Powder | harbormaster-quill | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `old-songs` | Old Songs | harbormaster-quill | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `tide-stones` | The Singing Water | dorran | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `the-drowned-priestess` | The Drowned Priestess | harbormaster-quill | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Gullport | `captain-saltbeard` | Captain Saltbeard | harbormaster-quill | REWRITE | Act I: Gullport chain end; smiths and ships to the camp |
| Act I · Gullport | `keel-timber` | Good Oak | ines | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `crab-shells` | Shell Game | ines | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `hunt-old-snapjaw` | Old Snapjaw | ines | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Gullport | `harpy-feathers` | Featherbeds | marla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `hunt-gullwing` | Gullwing | marla | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I · Gullport | `dorrans-apology` | An Old Man’s Apology | dorran | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `mirefin-pearls` | Pearls for the Patience | dorran | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I · Gullport | `saltreed-spiders` | Stowaways | harbormaster-quill | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `the-broken-caravan` | The Broken Caravan | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `riders-in-the-grass` | Riders in the Grass | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `dead-letters` | Dead Letters | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `the-old-script` | The Old Script | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `the-clan-stones` | The Clan Stones | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `stormhoof` | Stormhoof | marshal-dunmore | REWRITE | Act I finale: the clans join the defense |
| Act I finale · Hearthstead | `the-legion-picket` | The Legion Picket | marshal-dunmore | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `orders-from-the-north` | Orders from the North | marshal-dunmore | REWRITE | Act I finale: Vosk escapes with the second fragment (after the Defense of Hearthstead) |
| Act I finale · Hearthstead | `ashby-farm` | Ashby Farm | tess-hearthkeeper | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `the-pride` | The Pride | tess-hearthkeeper | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `hunt-goldmane` | Goldmane | tess-hearthkeeper | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act I finale · Hearthstead | `lancers-rest` | Lancers’ Rest | old-gaius | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `the-amber-lancers` | The Amber Lancers | old-gaius | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `a-lancers-farewell` | A Lancer’s Farewell | old-gaius | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `borrowed-arrows` | Borrowed Arrows | wynn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act I finale · Hearthstead | `a-steppe-bow` | A Steppe Bow | wynn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `low-wick` | Low Wick | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `the-turned` | The Turned | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `bad-blood` | Bad Blood | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `brewed-not-born` | Brewed, Not Born | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `the-green-sisters` | The Green Sisters | mags | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `the-cistern-mouth` | The Cistern Mouth | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `brother-pustule` | Brother Pustule | healer-osk | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Escort | `the-rot-mother` | The Rot-Mother | healer-osk | REWRITE | Act II: grief brewed into plague; Low Wick cured |
| Act II · Escort | `the-rotting-chapel` | The Rotting Chapel | brother-wendel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `prayer-beads` | Prayer Beads | brother-wendel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `hunt-gutrot` | Gutrot | brother-wendel | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Escort | `crow-pickings` | Crow Pickings | mags | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `thick-skin` | Thick Skin | mags | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Escort | `hunt-bogmaw` | Bogmaw | mags | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Escort | `clean-water` | Clean Water | healer-osk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-hollow-quarry` | The Hollow Quarry | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-dead-shift` | The Dead Shift | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `bone-steel` | Bone-Steel | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-makers-mark` | The Maker’s Mark | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-ancestors-hall` | The Hall of Ancestors | brenna | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-deepforge-gate` | The Deepforge Gate | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `the-slag-colossus` | The Slag Colossus | thane-borrik | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · The pass | `forgemaster-grold` | Forgemaster Grold | brenna | REWRITE | Act II: the pass opens (Sigil of Stone) |
| Act II · The pass | `the-old-watch` | The Old Watch | thane-borrik | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `rams-in-the-barley` | Rams in the Barley | hilda-stoutbrew | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `horn-tankards` | Horn and Ale | hilda-stoutbrew | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `hunt-old-horn` | Old Horn | hilda-stoutbrew | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · The pass | `the-prospectors` | The Prospectors | gemcutter-oz | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `griffon-hoard` | Swallowed Whole | gemcutter-oz | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The pass | `hunt-stormwing` | Stormwing | gemcutter-oz | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Lantern Hill | `candle-thieves` | Candle Thieves | lamplighter-ivo | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-risen-ranks` | The Risen Ranks | lamplighter-ivo | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `bone-steel-blades` | New Swords for Old Bones | lamplighter-ivo | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-broken-chapel` | The Broken Chapel | lamplighter-ivo | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-fallen-knight` | The Fallen Knight | lamplighter-ivo | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-kings-mound` | The Kings’ Mound | sister-maud | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-barrow-king` | The Barrow King | lamplighter-ivo | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Lantern Hill | `sir-corvane` | Sir Corvane the Fallen | sister-maud | REWRITE | Act II: Cael’s mentor falls; the countermanded order |
| Act II · Lantern Hill | `houndsmound` | Dug Up | gravedigger-kell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `hounds-of-the-barrow` | Hounds of the Barrow | gravedigger-kell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `hunt-headless-lord` | The Headless Lord | gravedigger-kell | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · Lantern Hill | `sisters-of-the-lamp` | Sisters of the Lamp | sister-maud | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `the-sisters-beads` | Forty Beads | sister-maud | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · Lantern Hill | `hunt-mother-aldith` | Mother Aldith | sister-maud | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · The lighthouse | `black-sails` | Black Sails | keeper-ansel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `hold-the-shore` | Hold the Shore | captain-morra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `sealed-in-tar` | Sealed in Tar | captain-morra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `signal-flags` | Signal Flags | keeper-ansel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `eye-of-the-storm` | Eye of the Storm | keeper-ansel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `the-stolen-prisms` | The Stolen Prisms | keeper-ansel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `the-black-camp` | The Choir on the Shore | captain-morra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `the-last-light` | The Last Light | keeper-ansel | REWRITE | Act II: the Stormwatch Light |
| Act II · The lighthouse | `the-gloam-rises` | The Gloam Rises | bosun-pike | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `pikes-whistles` | The Bosun’s Whistles | bosun-pike | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `the-captains-bell` | The Captain’s Bell | bosun-pike | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · The lighthouse | `the-old-beacon` | The Old Beacon | captain-morra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `clear-the-cliffs` | Clear the Cliffs | captain-morra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `the-galemother` | The Galemother | captain-morra | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act II · The lighthouse | `stormglass` | Stormglass | odile | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act II · The lighthouse | `a-heart-of-lightning` | A Heart of Lightning | odile | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `wolves-at-the-ditch` | Wolves at the Ditch | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `grey-riders` | Grey Hunters | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `the-hollow-hunt` | The Hollow Hunt | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `horns-of-the-hunt` | Horns of the Hunt | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `a-tinkers-ear` | A Tinker’s Ear | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `silence-the-howlers` | Silence the Howlers | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `the-howling-stones` | The Howling Stones | huntmaster-orla | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `the-wolf-king` | The Wolf King | huntmaster-orla | REWRITE | Act III: Moonfang |
| Act III · The moors | `no-bread-since-tuesday` | No Bread Since Tuesday | innkeep-bram | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `flour-and-fur` | Flour and Fur | innkeep-bram | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `hob-the-miller` | Hob | innkeep-bram | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · The moors | `hanged-mens-silver` | Hanged Men’s Silver | tinker-vey | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `silver-bites` | Silver Bites | tinker-vey | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `gallowmaw` | Gallowmaw | tinker-vey | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · The moors | `lost-post` | Lost Post | carter-joss | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `the-black-dog` | The Black Dog | carter-joss | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · The moors | `the-barghest` | The Barghest | carter-joss | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Sun houses | `hollow-coin` | Hollow Coin | oasis-keeper-sefu | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-sandscribe` | The Sandscribe | oasis-keeper-sefu | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-fallen-obelisk` | The Fallen Obelisk | sandscribe-ibbi | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-hollow-dig` | The Hollow Dig | oasis-keeper-sefu | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-waking-dead` | The Waking Court | sandscribe-ibbi | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `khamsin` | Khamsin | oasis-keeper-sefu | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Sun houses | `the-sunken-gate` | The Sunken Gate | oasis-keeper-sefu | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-sand-warden` | The Sand Warden | sandscribe-ibbi | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Sun houses | `the-sun-king` | The Sun King | oasis-keeper-sefu | REWRITE | Act III: Sun Sigil |
| Act III · Sun houses | `scorpions-in-the-well` | Scorpions in the Well | old-kasim | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `venom-for-the-still` | Venom for the Still | old-kasim | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-dune-tyrant` | The Dune Tyrant | old-kasim | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Sun houses | `the-sand-ship` | The Sand-Ship | merchant-zahra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `swallowed-silk` | Swallowed Silk | merchant-zahra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-wurm-road` | The Wurm Road | merchant-zahra | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `scarab-seals` | Scarab Seals | sandscribe-ibbi | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-necropolis-of-ras` | The Necropolis of Ras | sandscribe-ibbi | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-old-lookout` | The Old Lookout | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `break-the-teams` | Break the Teams | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-manifests` | The Manifests | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `a-scouts-eye` | A Scout’s Eye | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-broken-wagons` | The Broken Wagons | scout-ilya | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-sappers-cut` | The Sappers’ Cut | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-supply-depot` | The Supply Depot | scout-ilya | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-quartermasters-end` | The Quartermaster’s End | foreman-garrick | REWRITE | Act III: Vane |
| Act III · Sun houses | `raptor-run` | Raptor Run | scout-ilya | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `pack-hunters` | Pack Hunters | scout-ilya | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-red-matriarch` | The Red Matriarch | scout-ilya | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Sun houses | `the-missing-mules` | The Missing Mules | dustcrown-dora | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `mules-on-the-wing` | Mules on the Wing | dustcrown-dora | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `roc-plumes` | Roc Plumes | dustcrown-dora | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `the-lost-shift` | The Lost Shift | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Sun houses | `tags-of-the-lost` | Tags of the Lost | foreman-garrick | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-withered-ring` | The Withered Ring | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `songs-into-thorns` | Songs into Thorns | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `heartwood-and-blight` | Heartwood and Blight | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `old-roots-reading` | Old Root’s Reading | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-pale-pavilion` | The Pale Pavilion | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `knights-of-the-thorn` | Knights of the Thorn | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-thorn-seals` | The Thorn Seals | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-thorn-court` | The Thorn Court | lady-silvaine | REWRITE | Act III dilemma: kill or save Thistlemourn (two endings, same next quest) |
| Act III · Forest clans | `the-moonwell` | The Moonwell | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `moonwater` | Moonwater | lady-silvaine | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-moth-glade` | The Moth Glade | pip-thistledown | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `glimmerdust` | Glimmerdust | pip-thistledown | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-mother-of-moths` | The Mother of Moths | pip-thistledown | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Forest clans | `bloomrot` | Bloomrot | old-root | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `the-harts-trail` | The Hart’s Trail | old-root | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Forest clans | `rest-for-the-hart` | Rest for the Hart | old-root | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Mountain houses | `the-last-sledges` | The Last Sledges | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `bones-on-the-ice` | Bones on the Ice | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `the-giants-hearth` | The Giants’ Hearth | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `hollow-gold-torcs` | Torcs of Grey Gold | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `the-runes-on-the-torcs` | The Runes on the Torcs | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `the-vault-door` | The Vault Door | jarl-sigrun | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `the-traitor-jarl` | The Traitor Jarl | jarl-sigrun | REWRITE | Act III dilemma: Sigrun’s choice |
| Act III · Mountain houses | `the-vault-of-rime` | The Vault of Rime | jarl-sigrun | REWRITE | Act III: Frost Sigil |
| Act III · Mountain houses | `the-mead-thieves` | The Mead Thieves | brewer-olav | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `the-stolen-casks` | The Stolen Casks | brewer-olav | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `enough-is-enough` | Enough Is Enough | brewer-olav | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Mountain houses | `the-white-wolves` | The White Wolves | huntress-ylva | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `whitefangs-den` | Whitefang’s Den | huntress-ylva | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `whitefangs-pelt` | Whitefang’s Pelt | huntress-ylva | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Mountain houses | `the-frozen-shrine` | The Frozen Shrine | runecarver-hild | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Mountain houses | `rime-runes` | Rime-Runes | runecarver-hild | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `bad-readings` | Bad Readings | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `glass-mites` | Glass Mites | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-breach-camp` | The Breach Camp | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-voidcallers` | The Voidcallers | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `hollow-pay` | Hollow Pay | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-heralds-cipher` | The Herald’s Cipher | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `heartglass` | Heartglass | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-tear` | The Tear | magister-quell | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-heart-of-the-tear` | The Heart of the Tear | magister-quell | REWRITE | Act III LOW POINT: the Pale Herald; Nyx’s betrayal; Elyra taken; Fernstead falls |
| Act III · Low point | `living-glass` | Living Glass | scholar-ennis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `a-matter-of-anatomy` | A Matter of Anatomy | scholar-ennis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-glass-matron` | The Glass Matron | scholar-ennis | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Low point | `the-big-one` | The Big One | shardwife-hesk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `wyrms-in-the-spires` | Wyrms in the Spires | shardwife-hesk | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `old-coil` | Old Coil | shardwife-hesk | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Low point | `stalkers-in-the-dark` | Stalkers in the Dark | sergeant-dace | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-vale-watch` | The Old Watch | sergeant-dace | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Low point | `the-flicker` | The Flicker | sergeant-dace | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Marsh settlements | `the-lost-loggers` | The Lost Loggers | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `snakes-in-the-timber` | Snakes in the Timber | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `venom-for-a-king` | Venom for a King | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `the-queens-bargain` | The Queen’s Bargain | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `strangler-hearts` | Strangler Hearts | shaman-tuoko | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `the-serpent-steps` | The Serpent Steps | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `the-scaled-guard` | The Scaled Guard | warden-kesh | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `the-coiled-queen` | The Coiled Queen | warden-kesh | REWRITE | Act III dilemma: hide the venom trade or tell the Regent |
| Act III · Marsh settlements | `mabels-mules` | Mabel’s Mules | trader-mabel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `spotted-pelts` | Spotted Pelts | trader-mabel | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `nightpelt` | Nightpelt | trader-mabel | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act III · Marsh settlements | `the-mire-pools` | The Mire Pools | shaman-tuoko | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `the-red-fever` | The Red Fever | shaman-tuoko | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act III · Marsh settlements | `a-drop-of-venom` | A Drop of Venom | shaman-tuoko | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-long-night-ends` | The Long Night Ends | lord-commander-varn | REWRITE | Act IV: Highwall holds — the first Gate is ours |
| Act IV · First Gate | `ashes-of-ashby` | Ashes of Ashby | lord-commander-varn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-ashby-ghouls` | The Ashby Ghouls | lord-commander-varn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `stones-against-the-wall` | Stones Against the Wall | lord-commander-varn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-generals-hand` | The General’s Hand | lord-commander-varn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `captain-hollowbane` | Captain Hollowbane | lord-commander-varn | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act IV · First Gate | `the-breach` | The Breach | lord-commander-varn | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-siege-breaker` | The Siege-Breaker | lord-commander-varn | KEEP (retold) | Local threat kept; text retold in the new tone, ash-gold/grieflight replaces Hollow/Rift |
| Act IV · First Gate | `general-morvain` | General Morvain | lord-commander-varn | REWRITE | Act IV: Highwall’s commander falls |
| Act IV · First Gate | `bolts-for-the-wall` | Bolts for the Wall | quartermaster-bess | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-trampled-fields` | The Trampled Fields | quartermaster-bess | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `fields-of-fire` | Fields of Fire | quartermaster-bess | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `names-of-the-fallen` | Names of the Fallen | chaplain-ottis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `the-knights-chapel` | The Knights’ Chapel | chaplain-ottis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |
| Act IV · First Gate | `last-rites` | Last Rites | chaplain-ottis | KEEP (retold) | Village life quest kept; its giver reappears at the camp after the chain |

## Acts IV–V (built from the old Act IV data)

The zones of the frozen `sigilfall-4b-wip` branch, retold in the new story and registered. Their quest ids were
never in a shipped build, so no save holds them; three were renamed before shipping to avoid clashes
(`hounds-of-the-barrow` → `hounds-of-the-wolf-barrow`, `lyras-reading` → `sabines-reading`, and the Spire's boss
`the-pale-herald` → `herald-in-the-spire`, the story foe keeping the old id). No save migration is needed: the new
chains open from quests the shipped game already has.

| Act / place | Chain (in order) | Kind of beats | Ends with |
| --- | --- | --- | --- |
| Act IV · after Highwall | `gate-nyx-returns` (event: arrival), `gate-the-prison-map` | Nyx walks into Mara's camp under a white rag with the Herald's map | the road north from the Vale |
| Act IV · the Gloam Gate (Gloamhollow) | `gloam-the-lamp-road`, `gloam-the-unlit-mile`, `gloam-the-reavers-ford`, `gloam-border-reavers`, `gloam-sir-morrow`, `gloam-nyx-confesses`, `gloam-the-gate`, `gloam-the-cells` (event: defend Nyx at the lock), `gloam-out-of-the-cells` (event: rescue Elyra and Wren), `the-gatewarden`, `the-gloam-gate` | setup, roster twist (Wren in the next cell), confession, infiltration, rescue, boss, aftermath by Lastlight's fire | the second Gate; Elyra back |
| Act IV · side (Gloamhollow) | `the-black-pool`, `gloam-lurkers`, `the-drowned-mother`; `peat-and-pitch`, `bog-wights`, `mire-horrors` | Marrow's son; Gale's pitch (oil and lamps sent to the Gate and Highwall) | |
| Act IV · the Muster Hall (Bonefields) | `into-the-bonefields`, `haldrens-farm` … `break-the-giants`, `muster-the-field` (event: field battle), `the-bone-colossus`, `the-third-gate` | the dead dug up, the wardens' bones, the coalition's battle, the Colossus | the Three Gates taken; Vaelmoor open |
| Act V · the Weeping Woods | `into-vaelmoor`, `the-candle-road` … `the-wardens-rest`, `the-frozen-hamlet`, `wood-the-children` (event: rescue the queen's children, Ysane's first echo), `the-kings-call` … `the-weeping-lord` | Candlewick alive behind the Gates; Edric's oath | Edric points to Hollowmere |
| Act V · the Sunken Reaches | `the-drowned-harbor`, `the-drowned-light`, `the-queens-quay` (Ysane's second echo: the plague ship let in on the King's order) … `the-tide-lord`, `the-fireships` (event: defend) | | the drowned fleet burned |
| Act V · Hollowmere | `the-dead-lake` … `the-lichs-seal`, `orren-on-the-shore` (event: defend Orren; his brother Davin), `across-the-mere`, `the-necropolis`, `ysanes-last-echo` | | Ysane asks to be let go |
| Act V · the Blightwood | `the-withering` … `the-withered-queen` (Blightheart; Sigil of Thorns) | | |
| Act V · Emberdeep | `the-pale-crown` … `ashkar-the-bound` (the Molten Throne; the Pale Crown broken and forged into the band that holds the sigils) | | |
| Act V · the Riftscar | `the-veil-torn` … `the-pale-herald` (the Spire of the Tear; Sigil of the Veil; the Herald's voice survives for Act VI) | | |
| Act V · end | `the-seventh-sigil` | Elyra at Lastlight takes the last two and cannot find the hero's name | Act VI |

Still unregistered: the Pale Reach, Duskspire (Act VI and the finale) and Frostfang.

## The five-beat audit (blueprint Prompt 8)

Run over every chain (a quest nothing comes after, walked back to its root), counting its beats by kind and
checking what in the world remembers each quest (region states, story markers, people's lines):

- **Main story**: every chain opens with a setup beat (a talk or a place found), escalates through fights
  and things carried home, and closes on a boss or a story event, then a talk; every main quest is named by at
  least one state, marker or line that changes when it is done. The Vale (Act I), the camp's arrivals, the road
  (Act II), the Tear and Fernstead (Act III), Highwall and the Gates (Act IV) and the Dead Kingdom (Act V) all
  have playable story events at their turns.
- **Weakest main chain**: Rimeheld (Act III, Sigrun). It is talk, search, fights, the vault's two bosses; its
  turn (Sigrun sparing Hrimfang) is told, not played. Backlog: a story event at the sledge camp (lead the
  survivors to Frostgate) and Frostgate's state after the vault.
- **Side quests**: every one pays an item, a perk or a way on, or is remembered by someone; the hunts (a named
  beast at the end of a short chain) are the plainest, and are kept short on purpose.
