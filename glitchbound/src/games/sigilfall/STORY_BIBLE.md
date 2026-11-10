# Sigilfall — Story Bible: *The Crown of Ash and Starlight* (v3)

This is the one canon. It replaces the old "Hollow King and the Rift" telling (WORLD.md now only keeps the geography)
and the v2 outline. v3 tells the story through **fifteen lands** instead of twenty-seven, and stages **every step of
the main story by hand**, the way the opening night is staged.

- The fifteen lands, in story order: the Whisperwood, Brackenridge Hills, Thornvale, the Amberfield, the Ashen
  Barrows, the Sunscorch, the Glimmerwood, Rimeheld, the Shattered Vale, Highwall March, Gloamhollow, the Weeping
  Woods, Emberdeep, Hollowmere and the Pale Reach. With them: Briarhollow (the camp), Emberwick (the Crown City), the
  dungeons the story goes through, Duskspire and Vaelmoor Remembered.
- **Retired** (built, kept in the code, but off the map and out of the story — `data/retired.ts`): Greyfen,
  the Saltmarsh, Duskfen, Ironpeak, Stormwatch, the Grimward Moors, Sablewind, Vinecoil, the Bonefields, the
  Blightwood, the Sunken Reaches and the Riftscar. Their dungeons stay open as Riftstone runs.
- Quest ids stay where a save depends on them; a hero part-way through the old story is moved onto the new one
  (`progress/storyMigration.ts`). Everything a player reads is new or rewritten.

Principles:

- Stakes grow from one village to two kingdoms. The player always knows **whom** they are saving and **why the
  enemy wants what it wants**.
- Every land is a short story of its own: a **cold open**, a **set piece** played with allies on screen, a **turn**
  (something learned that changes what the hero thought), a **climax** with a named foe, and an **aftermath** the
  world shows.
- Every main quest opens with a staged scene and every chain closes with one. Nothing in the main story is a bare
  "kill fifteen" or "bring back six".
- The past is told by **visions**: when a sigil wakes it shows Elyra (and the player) what it saw. Seven sigils,
  seven visions, and together they are the whole history.
- Companions are few and they matter: they arrive, argue, fail, come back.

---

## 1. The canon

### The star

Three hundred years ago a star fell on the border of two sister kingdoms: **Aster** of the river valleys, and
**Vaelmoor** of the northern lakes. It broke in two as it fell. Each kingdom forged its half into a crown.

- Aster's became the **Starlight Crown**, seven points of star-iron. While it was whole and worn, *the dead stayed
  dead and grief stayed grief*: the star-iron keeps what is lost, lost.
- Vaelmoor's became the **Moon Crown** of its kings: the same star-iron, the same promise, kept by the same kind of
  oath.

### The plague winter

Forty years ago **King Vaelor** of Vaelmoor lost his queen **Ysane** and their two children, **Lark** and **Edda**,
in one winter of plague. The plague came in on a ship his brother **Aurel**, Master of the Harbor, let into port
against the quarantine, for gold and because the ship's captain was his friend.

Vaelor broke the Moon Crown and drank its light to call his family back. He did: for one night. Then the light
went out, the crown turned to ash, and the **Ash Crown** was born: a crown that **feeds on grief and makes
memories into soldiers**. Vaelmoor died in that night, and its people woke as the **Ashen Host**: grey, soft-edged,
smelling of cold hearths, asking each other if it is supper yet.

### The wardens

Aster's queen of the time knew what the Ash Crown would want next: the other half of the star. She sent eight
**Sigil-wardens** to the border. Seven of them broke the Starlight Crown into seven **Crown Sigils** and rode away
to hide one each in a holy place. The eighth, **Ser Edmar**, held the Gloam Gate against the Host at dusk while
the seven rode, and died there. The songs count seven wardens; Edmar was left out of them because his part was
done in the dark. A **Gloamknight** hero who finishes the story takes up his watch (*Warden of the Gloam*,
`data/wardens.ts`).

The wardens sealed Vaelor in **Duskspire**, his citadel, and built the **Three Gates** (Highwall, the Gloam Gate,
the Muster Hall) on the road to it. For forty years the seal held because nobody in Aster knew where the sigils
were.

### Now

**Aurel** has spent those forty years as **the Pale Herald**, Vaelor's voice in the living world. He believes, as
Vaelor does, that the Ash Crown relit with all seven sigils (the **Crown of Ash and Starlight**) can make the
resurrection last: Vaelmoor whole again, the plague undone, his own guilt erased. The price is Aster: a kingdom's
grief is what the Ash Crown would build Vaelmoor out of.

The Herald found a buyer for the secret of where the sigils are: **Lord Chancellor Maelis Crane** of Aster, who
keeps the treasury and the roads, and who sold the wardens' old map for ash-gold and a promise. The Host has begun
to dig.

**Vaelor, the Hallow King**, is not a dark lord. He wants his wife and children back, exactly as they were. He
hallows the dead and calls it mercy.

### Words players learn

| Word | Meaning |
| --- | --- |
| Ashen Host | Vaelor's army: memories given shape (data ids `legion-*` stay) |
| Ash-gold | the Herald's grey coin: it weighs nothing and is always cold |
| Crown Sigil | one of the seven star-iron points of the Starlight Crown (perk ids `sigil-*`) |
| Grieflight | the violet glow the Ash Crown leaves in what it touches |
| The Pale Herald | Aurel, Vaelor's brother and voice |
| The Gloam | the dusk-land between Aster and Vaelmoor; the fen where Edmar held the gate |

---

## 2. The seven sigils

Each sigil was hidden by one warden in one holy place. When the hero wins one, **Elyra bonds it**: she can feel
them, and each makes her light stronger. Each also **takes a memory** from her, and shows her a **vision** of what
it saw (the player sees it with her: `vision` scenes).

| Sigil | Where (land) | Its warden | The vision it shows | What Elyra forgets |
| --- | --- | --- | --- | --- |
| **Embers** | under Briarhollow's chapel (Prologue) | Brother Hale, who became Briarhollow's first priest | the star falling and breaking over two kingdoms | the words of her mother's lullaby (she still hums it) |
| **Stone** | the shrine under Hearthstead's hall (Amberfield) | Marshal Teodric | two crowns forged; two kings who shared a sky | — (Vosk takes it before she can touch it; won back at the Pale Reach) |
| **Sun** | the Tomb of the Sun King (Sunscorch) | Queen Ammuret, who had herself buried with it | the plague ship coming into Vaelmoor's harbor, and the man who let it in | the color of Briarhollow's orchard in spring |
| **Thorns** | the Thorn Court (Glimmerwood) | the first Thistlemourn | Vaelor at his children's bedside, the night he broke his crown | Thessa's face (she knows the name) |
| **Frost** | the Vault of Rime (Rimeheld) | Jarl Ingrith the Unthawed, frozen in the vault with it | the eight wardens at the border; seven ride away and one stays | her own birthday |
| **Veil** | the Tear (the Shattered Vale) | Magister Orla, who sealed the Tear with it | Ser Edmar holding the Gloam Gate alone at dusk | — (taken with her by the Herald; won back at the Gloam Gate) |
| **Tides** | the drowned altar of Hollowmere | Queen Ysane's own maid, Bettany, who stayed | Ysane, dying, asking Vaelor to let her go | the hero's name |

At the Duskspire Gate the hero carries all seven (`the-seventh-sigil`): the last door opens only for seven.

---

## 3. The cast

| Who | First met | Arc |
| --- | --- | --- |
| **Mara Venn**, Briarhollow's guard | Prologue, at the gate | Holds the gate alone at the start; learns to lead; commands the relief of Highwall and the Last March. Distrusts magic, trusts Elyra. |
| **Elyra**, hedge-mage, Thessa's apprentice | Prologue, the burning inn | Bonds the sigils; gains light, loses memories; taken by the Herald at the Tear; rescued at the Gloam Gate; in the finale she holds all seven and the choice. |
| **Cael Varrow**, disgraced knight of the Ninefold Watch | Act II, Lantern Hill ("a man called Wat") | Blamed for the Watch's fall ten years ago (the relief never came: Crane countermanded it). Redeemed through Corvane, his mentor; leads the sortie at Highwall. |
| **Nyx**, scout and thief | Act I cameo (Thornvale), joins in the Sunscorch | Funny, quick, loyal to one person: her brother **Wren**, held by the Host. Sells the party's road to the Herald for him at the Tear; comes back with the Herald's prison map. |
| **Brother Orren**, last of the Lantern priests | Act II, Lantern Hill | Knows what the Ash Crown is; argues every time it matters that the dead must stay dead; meets his own dead at Hollowmere and holds. |

Story figures: **Elder Maren** (the camp's voice), **Herbwife Thessa**, **Old Haldor** the bell-ringer, **Regent
Elowen** of Aster, **Chancellor Crane** (the traitor), **Rider-Captain Vosk** (the Host's cavalry; takes the Sigil of
Stone), **Sir Corvane** (the Host's first knight, Cael's mentor), **the Pale Herald / Aurel**, **Queen Ysane** (her
echoes), **Lark and Edda** (the children's echoes), **Vaelor**. The townspeople of each land are the people the hero
saves, and they come back to the camp.

---

## 4. The campaign

Levels follow PROGRESSION_BALANCE.md (the main story alone takes a hero from 1 to 60). Each land below lists its
main quests in order: **id** (kept from the old story where it says the same thing), name, what is played, and the
scene that stages it. *Bold lines are spoken in the scenes.*

### Prologue — The Night the Bells Stopped · Briarhollow, the Chapel Crypt, the Whisperwood · 1–6

As built (sixteen scenes; the standard every other land is measured against): the gate with Mara, the bell that
rings itself, the courier and the broken royal seal, the burning inn and Elyra, the chapel door, the crypt, Morgrave.

New:
- **The reliquary** (`briar-the-reliquary`): Elyra touches the warm iron and the first **vision** plays: the star
  falling and breaking in two over two kingdoms. **"Half of it fell on us. I felt it land."**
- **Into the Whisperwood** (`into-the-wood`): no longer a count of kills: Mara and the hero track the beasts the
  grieflight maddened to their alpha, Grimtusk, and kill it (`alpha`). Scene: the wood at dawn, the trail of
  violet-eyed wolves, Grimtusk's roar from the east.

### Act I — The Villages of the Vale · 5–22

The Host is testing the border. Every village saved sends something to Briarhollow.

**Brackenridge Hills: Fernstead** (5–10) — a hill village of russet orchards, where the barrow dead have started to
sing.

1. `fern-candles` **Fernstead's Candles** — Warden Hollis meets the hero at dusk; every window has a candle in it
   for someone the barrows took. *Scene: the hill road at sunset, the candles coming on one by one.* **"We light them
   so they can find the way home. Lately they've been finding it."**
2. `fern-the-dead-walk` **The Restless Dead** — *defend*: the barrow dead walk into the lanes at night; Hollis's
   rangers and Mara hold the well.
3. `fern-the-widows-song` **The Widow's Song** — follow the singing to the old barrows. The **Grey Lady** is a
   widow, Wenna Ashe, who sang at her husband's barrow every night for a year: the Ash Crown has been feeding on her.
   *Scene: grieflight rising out of the mound like smoke.* Orren isn't here yet; Elyra explains what Thessa taught
   her: **"Grief's the strongest thing in the world. Somebody's learned to spend it."**
4. `lay-the-grey-lady` **Lay the Grey Lady** — *boss*. Elyra's ember-light breaks the grieflight; the Lady sings
   her husband's name once more and is gone.
5. `the-harvest-stones` **The Harvest Stones** — cleanse the shrine; Hollis's rangers march to Briarhollow
   (`camp-scouts`: *arrival* at the camp's watchfire).

**Thornvale: Millbrook** (8–14) — farms, the mill bridge, and a gang paid in coin that weighs nothing.

1. `mill-the-bridge` **The Mill Road** — the bridge is barricaded by the Gallows Gang; Reeve Aldous's grain can't
   cross. *Scene: the barricade, the gang's banner, a cart turned back.*
2. `kettle-farm` **Ashes at Kettle Farm** — Tobin's farm burned by Red Caps; *rescue* Tobin's family from the barn.
3. `thieves-cant` **Thieves' Cant** — the gang's orders are in a cant nobody can read; Pim knows someone who can:
   **Nyx**. *Scene: Nyx on the inn's roof, reading by moonlight.* **"'Hunt the bell-chapels. Bring me the warm
   iron.' Signed with no name. Grey ink. You lot are in trouble."** First sign that the Host hunts the sigils.
4. `the-bandit-king` **The Bandit King** — *boss*: Varric at Gallows Hill. **"Gold that weighs nothing. You don't
   know what you're for till someone pays you in it."**
5. `camp-grain` **Grain for Briarhollow** — *escort*: the carts cross the free bridge to the camp.

**The Amberfield: Hearthstead** (16–22) — the steppe, the centaur clans, and the walled village the Host wants.

1. `the-broken-caravan` **Refugees on the Road** — a caravan burned in the grass; eight-year-old Marit and her
   wheelwright uncle Hale. *escort* them to Hearthstead.
2. `riders-in-the-grass` **Riders in the Grass** — *ambush*: Ashen riders out of the grass; **Rider-Captain Vosk**
   watches from a ridge and rides away. **"Count their walls, not their swords."**
3. `the-clan-stones` **The Clan Stones** — the centaur clans' standing stones remember the star's fall; Marshal
   Dunmore admits Hearthstead's hall was built over a shrine **"older than the town."** The sigil under it wakes:
   Elyra feels it from a mile off.
4. `hearth-hold-the-wall` **The Defense of Hearthstead** — *defend*, three waves on the wall with Mara commanding,
   Dunmore's riders on screen; then `hearth-the-ram` **The Ram**: Elyra's light breaks it.
5. `hearth-the-shrine` **The Empty Shrine** — in the smoke Vosk took the **Sigil of Stone** from under the hall.
   *Scene: the empty niche, a vision fragment (two crowns forged) cut off as the sigil leaves.* Then
   `orders-from-the-north` **Orders from the North**: Maren reads the courier's soaked letter aloud: the King's
   courier was riding to warn the Crown City the sigils were being hunted, **and someone in the city has been hiding
   the letters.**

### Act II — The Crown City · 22–30

**The Ashen Barrows: Lantern Hill** (23–29) — the downs of the old kings' barrows, where the lamps go out one a night.

1. `candle-thieves` **The Lamps Go Out** — Lamplighter Ivo; **Brother Orren** keeps the last chapel lit. *Scene:
   lamps going out across the downs, one by one, toward the chapel.* **"The dead don't fear the dark. They fear being
   seen. Keep the lamps lit."**
2. `cael-the-hostel` **A Man Called Wat** — a drunk knight in the hostel who knows too much about the barrows:
   Cael Varrow, Captain of the Ninefold Watch that died here ten years ago waiting for relief that never came.
3. `the-kings-mound` **The Kings' Mound** — *defend* the chapel as the barrow kings' dead march, Orren's lanterns
   holding them, Cael fighting beside the hero.
4. `sir-corvane` **Sir Corvane the Fallen** — *boss* in the Barrow of Kings. Corvane was Cael's mentor and is the
   Host's first knight now. Dying, he gives Cael the relief order for the Ninefold Watch, **countermanded in the
   Chancellor's hand.** **"I waited for you to hate me, boy. Hate him instead. It's quicker."**
5. `the-kings-design` **The Countermanded Order** — Cael and Orren come with the hero to the Crown City.

**Emberwick: the Crown City** — the Regent's keep, the market, the festival.

1. `city-the-treasury` **Follow the Money** — the order leads through the treasury, the roads office and the
   Chancellor's cellar (three steps, `then`): road money spent on nothing, and a cellar full of ash-gold.
2. `festival-the-lanterns` **The Starfall Festival** — the city celebrates the star. *Scene: a puppet play in the
   square tells the star's fall (the player's first full telling of the legend), lanterns going up.*
3. `festival-the-knives` **The Night of Knives** — *raid*: the Chancellor's hired knives and Ashen assassins strike
   the Regent's balcony; Cael holds the keep stair.
4. `festival-the-catacombs` **Down Among the Dead** — Crane flees into the catacombs; his strongroom holds the
   wardens' old map — **with four of the seven holy places marked in grey ink.** Sun, Thorns, Frost, Veil.
5. `festival-the-champion` **Champion of Aster** — the Regent names the hero her champion and gives them the
   map. **"Four places. He has a head start on all of them. Go."**

### Act III — The Race for the Sigils · 30–41

**The Sunscorch: the Oasis of Ras** (30–36) — sand to the horizon, and a dig the Host has been at for a month.

1. `hollow-coin` **The Oasis of Ras** — ash-coin in the oasis wells; **Nyx** is here, smuggling, and joins:
   **"Your map's my map now. I know every road the Host pays for."**
2. `the-sandscribe` **The Sandscribe** — Ibbi reads the fallen obelisk: a warden queen, Ammuret, had herself buried
   alive with something warm.
3. `the-hollow-dig` **The Ashen Dig** — *raid* on the Host's dig site before it breaks through.
4. `the-sun-king` **The Sun Queen** — *boss* in the tomb: Ammuret's echo, who tests rather than hates. She gives
   up the **Sigil of the Sun**. **Vision:** the plague ship in Vaelmoor's harbor, and a young man in harbor-master's
   blue waving it in. Elyra forgets the color of the orchard.

**The Glimmerwood: Lumen Glade** (31–37) — a fey wood gone sour, thorns where the songs were.

1. `the-withered-ring` **The Withered Ring** — Lady Silvaine; the court's prince Thistlemourn has sworn to the Host.
2. `the-pale-pavilion` **The Pale Pavilion** — the Herald's bargain, found in the prince's tent: his court's blight
   lifted in exchange for the Sigil of Thorns. *Scene: the pavilion's grey silk, a letter in grey ink.*
3. `the-thorn-court` **The Thorn Court** — *raid* through the thorn knights to the court.
4. `silvaines-song` **Silvaine's Song** — the prince, and a choice (`choice`): end him, or let Silvaine sing him
   back. Either way the **Sigil of Thorns**. **Vision:** Vaelor at his children's bedside, the night he broke his
   crown. **"He just wanted them to wake up."** Elyra forgets Thessa's face.

**Rimeheld: Frostgate** (33–39) — snow, giants, and a jarl who sold his kin.

1. `rime-frostgate` **The Last Sledges** — Jarl Sigrun's sledges come in under giant raids; *escort*.
2. `rime-the-traitor-jarl` **The Traitor Jarl** — Jarl Hrimfang sold the vault's runes for ash-gold. Sigrun must
   choose between his life and a civil war; the hero brings him in.
3. `rime-the-vault-door` **The Vault Door** — the runes, and the frozen warden behind the door.
4. `the-vault-of-rime` **The Vault of Rime** — the dungeon; Jarl Ingrith the Unthawed hands over the **Sigil of
   Frost** and is allowed to thaw. **Vision:** the eight wardens on the border; seven ride away; one stays.
   Elyra forgets her birthday.

**The Shattered Vale: Shardwatch** (35–41) — the low point.

1. `vale-shardwatch` **Shardwatch** — Magister Quell's watchtowers around the **Tear**, a wound in the sky the
   Sigil of the Veil has kept shut for forty years.
2. `vale-the-cipher` **The Herald's Cipher** — Nyx goes quiet; a grey-ink letter about **Wren**.
3. `the-heralds-ambush` **The Tear** — the hero takes the **Sigil of the Veil** from the Tear, and the **Pale
   Herald** is waiting: Nyx sold him the road for her brother. A fight that cannot be won (`ends`); **Elyra is
   taken**, and the sigils with her. **"Forty years I have carried my brother's grief. Tonight I set it down."**
   The Herald keeps neither promise: Wren stays a prisoner. Nyx is gone.
4. `the-heart-of-the-tear` **The Heart of the Tear** — aftermath: Quell seals the Tear with what's left; the same
   night **Fernstead falls**; at the camp Thessa finds Elyra's satchel packed for three days.

### Act IV — The Gates · 40–48

**Highwall March** (40–46) — the first of the Three Gates, under siege.

1. `the-long-night-ends` **The First Gate** — Mara commands the relief; Lord-Commander Varn. *Scene: the wall
   from the trenches, the bone batteries firing.*
2. `cael-the-sortie` **The Sortie** — *raid*: Cael leads the riders out of the sally port.
3. `gate-nyx-returns` **Under a White Rag** — Nyx comes in with a white rag on a stick and the Herald's prison
   map. **"Hit me after. Elyra's in the Gloam Gate's cells. I can get you in."**
4. `the-siege-breaker` **The Breach** — *boss*: the Siege-Breaker in the breach.
5. `general-morvain` **General Morvain** — *boss*; the first gate is ours.

**Gloamhollow: Lastlight** (44–48) — the black fen, the lamps of Lastlight, the Gloam Gate.

1. `gloam-the-unlit-mile` **The Unlit Mile** — Lastlight's lamp-keepers; the road dark for a mile.
2. `gloam-the-eighth-warden` **The Eighth Warden** — at a cairn by the gate, Elyra's absence is a hole the
   **vision** comes through anyway, from the Veil sigil kept in the gate: **Ser Edmar holding the gate alone at
   dusk**. **"Till the last light. Then a little after."**
3. `gloam-the-cells` **The Cells** — *rescue*: Nyx's map, the cells, Elyra. She knows the hero's face; she can't
   find Thessa's.
4. `the-gatewarden` **The Gatewarden** — *boss*; the sigils (all five Elyra carried) are taken back from the gate's
   vault.
5. `the-gloam-gate` **The Second Gate** — the road into Vaelmoor opens; Wren is found among the prisoners.

### Act V — The Dead Kingdom · 48–56

**The Weeping Woods: Candlewick** (48–51) — a grey wood where the plague winter never ended.

1. `the-candle-road` **The Candle Road** — Candlewick, every window a candle for the dead; Orren goes quiet.
2. `the-frozen-hamlet` **Lark's Hollow** — a village frozen in the hour it died.
3. `wood-the-children` **Two Names in the Snow** — *event*: the echoes of **Lark and Edda** playing in the snow;
   the Host comes for them because Vaelor calls them. **"Papa says we're going home soon."**
4. `the-weeping-lord` **The Weeping Lord** — *boss*: the grief of the wood given a body.

**Emberdeep Caldera: Cinderhold** (51–55) — a ring of black mountains round a lake of fire.

1. `forges-on-the-rim` **Forges on the Rim** — Thane Hroki's dwarves; the Host forging something in the caldera.
2. `dvalins-reading` **Dvalin's Reading** — the runesmith reads the Host's moulds: the **Pale Crown**, made to
   hold seven sigils **and a living heart that remembers them** — Elyra.
3. `break-the-chains` **Break the Chains** — *rescue* the chained fire-spirits who are made to work the forges.
4. `ashkar-the-bound` **Ashkar the Bound** — *boss*: the fire lord chained to the crown's anvil; the Pale Crown
   breaks. The Herald's voice out of the fire: **"He will make another."**

**Hollowmere** (53–56) — the black lake at the heart of Vaelmoor.

1. `the-restless-shore` **The Restless Shore** — the Ferryman wants a penny for every passenger.
2. `orren-on-the-shore` **The Answering Water** — *event*: Orren's own dead come out of the water asking him to
   come in. He holds. **"I loved you. That is why I won't."**
3. `across-the-mere` **Across the Mere** — the necropolis on the island.
4. `ysanes-last-echo` **Let Me Go** — Queen Ysane's last echo gives the **Sigil of Tides** and begs the hero to let
   her husband go. **Vision:** Ysane dying, asking Vaelor to let her go. Elyra forgets the hero's name. (`the-
   seventh-sigil` then waits on the Sigil of Stone.)

### The Last March · Pale Reach, Duskspire, Vaelmoor Remembered · 56–60

1. `the-last-road` **Every Banner** — every faction the hero helped arrives with its troops: Hollis's rangers,
   Dunmore's riders, the forest clans (as chosen), Sigrun's huscarls, Ras's lancers, Lastlight's lamp-keepers.
2. `march-vosk` **The Rider at the Head of the Host** — Vosk, hollowed, and the **Sigil of Stone**. **Vision:**
   two crowns forged; two kings shaking hands under one sky. Seven of seven (`the-seventh-sigil`).
3. `march-the-breach` **The Breach** — *raid* on Duskspire's outer wall with the siege mages.
4. `march-the-voice` **The Voice in the Gate** — the Pale Herald, at last: Aurel. **"I let the ship in. Everything
   since has been me trying to let it out."**
5. `the-hollow-king` **Crownfall: The Throne** — Vaelor. Then Vaelmoor Remembered: **One Hour** or **Break It Now**
   (the choice), and **The Ash Crown**.

Epilogue: **The Camp Goes Home**, and **The Bell**: Old Haldor rings it, and Elyra, who has forgotten so much,
remembers the lullaby's words.

---

## 5. Staging (the tools: `sim/scene.ts`)

- **look / at / follow / move / say / emote / sfx / shake / title / wait** (as before).
- **bars**: letterbox bars slide in for the scene (every main-story scene has them).
- **fade**: to and from black (a time-skip, a vision's start and end).
- **vision**: the screen goes to a tinted memory: a caption, figures (people and the Host) placed in the world as
  ghosts, lines spoken by them, then back. Each sigil's vision is one.
- **fx**: a spell or blast at a place (a sigil waking, a wall breaking, the Tear opening).
- **music**: a track change for the scene.

Every main quest has a scene that opens it (`when: during(id)`), boss quests also open on their boss, and every
land's last quest has an aftermath scene.

---

## 6. World events

| Place | States |
| --- | --- |
| Briarhollow | dusk → raid → aftermath → the camp, growing with each village saved → Fernstead's refugees (after the Tear) → rebuilt; the bell rings (epilogue) |
| Fernstead | haunted → shrine cleansed → fallen (the Tear) → retaken (Highwall) |
| Millbrook | bridge barricaded → bridge free |
| Hearthstead | refugee roads → siege → wall repaired |
| Lantern Hill | lamps dark → lamps lit |
| Emberwick | before the festival → festival → locked down → war footing |
| Highwall March | besieged → relieved |

---

## 7. Tone and writing

- Short lines. A beat is two to four lines, then play.
- Warm before dark: every land gets a line of ordinary life before its trouble.
- The Host is sad, not cackling. Its soldiers say what they remember ("Is it supper yet?").
- Humor from people (Tobin, Nyx, Brewer Olav), never from the threat.
- The hero has no lines; companions react to what the hero did.
- American spelling for player-facing text; typographic apostrophes in text.
- Our names only (LEGAL_REVIEW.md): the villain is the **Hallow King**, never anything like another game's knight.
