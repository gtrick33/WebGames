# Sigilfall — Story Bible: *The Crown of Ash and Starlight*

Blueprint V2.9, Section 4. This replaces the old "Hollow King and the seven sigils" telling (WORLD.md keeps the
geography). Structure is fixed by the blueprint: **intimate opening → gathering allies → regional liberation →
kingdom-scale war → supernatural endgame.** Quest ids stay where saves depend on them (QUEST_REWRITE_MAP.md);
everything a player reads is new.

Principles (blueprint §2.2, §4.2):

- Stakes grow from one village to the realm. The player always knows **whom** they are saving.
- Every major chain has a **cold open, a complication, a midpoint turn, a climax and an aftermath** — and the
  aftermath is visible in the world (WORLD EVENTS below), not only in a reward window.
- Companions travel, argue, fail, recover and fight. They speak at curated beats, never constantly.
- Saved people come back. Repaired places stay repaired. Occupied places look occupied until freed.

---

## 1. The world

### The Kingdom of Aster

A small, warm kingdom of river valleys, hill farms and walled towns, ruled from **Emberwick, the Crown City**
(the Ember City of the old map). Its crown is the **Starlight Crown**: seven points of star-iron from a star that
fell three hundred years ago. While the crown is whole and worn, the dead stay dead and grief stays grief.

- **King Aldric III** — old, ill, rarely seen. The court says he is "resting".
- **Regent Elowen** — his niece, thirty, sharp, tired; rules in his name from the Ember Keep.
- **Lord Chancellor Maelis Crane** — the Regent's oldest counsellor, keeper of the treasury and the roads. Charming,
  patient, and the traitor of Act II.

### The Dead Kingdom of Vaelmoor

North of Aster, beyond the Pale Reach, lay its sister kingdom, **Vaelmoor**, which shared the fallen star. Its king,
**Vaelor**, lost his queen Ysane and their two children in a single winter of plague. He broke his half of the star
and drank its light to call them back. The light burned out, the crown turned to ash, and the **Ash Crown** was
born: a crown that **feeds on grief and turns memory into soldiers**. Vaelmoor died in a night, and its people woke
as the **Ashen Host** — memories with weapons, grey and soft-edged, smelling of cold hearths.

The **Sigil-wardens** of Aster broke the Starlight Crown into seven **Crown Sigils** so no one could ever use it to
do the same, and hid them in seven holy places. They sealed Vaelor in the **Duskspire**, his citadel, and buried the
road to it under three great fortresses: **the Three Gates** (Highwall, the Gloam Gate and the Muster Hall).

The songs count seven wardens. There was an eighth, who carried no sigil: a knight who held the Gloam Gate at dusk
while the seven rode away to hide theirs, and was left out of every song for it. A **Gloamknight** hero who finishes
the story takes up that watch (the title *Warden of the Gloam*, the armor and the drake, `data/wardens.ts`). There are
still seven sigils, and Duskspire still asks for all seven.

### What the Ash Crown wants

Vaelor is not a dark lord who wants the world for its own sake. He wants **Vaelmoor back**: his queen, his children,
his people, exactly as they were. The Ash Crown can rebuild them, but only out of the grief of the living — a
village's sorrow becomes a street of Vaelmoor, a kingdom's sorrow becomes the whole realm. With the seven Crown
Sigils he could relight the Ash Crown as a **Crown of Ash and Starlight** and make the resurrection permanent:
Vaelmoor would live again, and Aster would become the ash it is built from.

He is the **Hallow King**: he hallows the dead and calls it mercy.

### Words players learn

| Word | Meaning |
| --- | --- |
| Ashen Host | Vaelor's army: memories given shape (the old data calls them the Hollow Legion; ids `legion-*` stay) |
| Ash-gold | grey coin the Host pays traitors with; it weighs nothing and is always cold (old "Hollow gold") |
| Crown Sigil | one of the seven star-iron points of the Starlight Crown (perk ids `sigil-*` stay) |
| Crown fragment | a sliver of a sigil; Elyra can feel them and pays for it |
| The Pale Herald | Vaelor's voice in the living world; buys traitors, carries orders, takes Elyra |
| Grieflight | the violet glow the Ash Crown leaves in things it has touched (the old "Rift" glow) |

---

## 2. The cast

### The hero

A traveller who arrives at Briarhollow on the evening the story begins (any of the eight classes). The hero is the
one person in the story the Ash Crown cannot read: they carry no grief it can use — yet. The finale tests that.

### Recurring companions (blueprint §4.1)

| Companion | Role | First met | Arc | In combat |
| --- | --- | --- | --- | --- |
| **Mara Venn** | Briarhollow's village guard; grounded, brave, distrusts magic | Prologue, at the gate | Holds the village alone at the start; learns to lead; **battlefield captain** of the coalition by Act IV; refuses to let Briarhollow become a camp forever | Shield-and-spear; holds a line, taunts nearby foes off the hero; leads allied squads |
| **Elyra** | Young hedge-mage, apprentice to Briarhollow's herbwife | Prologue, in the burning inn | The first fragment bonds to her in the chapel crypt; each sigil gives her power and **takes a memory** (she forgets small things first: a song, a name). Captured by the Pale Herald (Act III low point), rescued at the Gloam Gate (Act IV). In the finale she is the "rescue/choice" | Ranged spells of light; shields the hero; at story beats channels sigil-light that breaks Ashen shields |
| **Cael Varrow** | Disgraced royal knight, Captain of the Ninefold Watch | Act II, Lantern Hill (Ashen Barrows) | Blamed for the fall of the Ninefold Watch ten years ago (relief never came: the Chancellor diverted it). Redemption through Corvane (his old mentor, now the Host's first knight) and the Three Gates | Heavy knight; charges, breaks shields; leads cavalry in the Last March |
| **Nyx** | Scout, thief, ex-member of the Gallows Gang | Act I cameo (Thornvale), joins in Act II (Duskfen) | Funny, opportunistic. Her brother **Wren** is held by the Host; in Act III she sells the party's route to the Pale Herald to buy him back (**betrayal**), then turns the trade into the rescue of Elyra (**redemption**) | Fast blades, traps, opens locked doors and secret paths during infiltration quests |
| **Brother Orren** | Death-priest of the Lantern order, last of the old royal chaplains | Act II, Lantern Hill | Knows what the Ash Crown is and argues, every time it matters, that the dead must stay dead. His faith breaks when he meets his own dead in Act V and holds anyway | Wards: cleanses grieflight, blesses allies, holds the dead back with lanterns |

Companions are **light**: they appear at scripted beats (travel conversations, rescues, defences, sieges, bosses),
never as permanent followers. Each has a portrait, a figure that no townsperson shares, and 3–8 curated barks per
act.

### Story figures (non-companion)

| Figure | Where | Purpose |
| --- | --- | --- |
| **Old Haldor** | Briarhollow | The bell-ringer. The bell stopped when his grandson vanished; he rings it again at the very end |
| **Herbwife Thessa** | Briarhollow | Elyra's teacher; runs the camp's infirmary once the refugees come |
| **Ranger Oskar Fell** | Briarhollow gate | Collapses at the gate in the Prologue with the **broken royal seal**; a king's courier who rode from the north; dies telling the hero "the Crown City must know" |
| **Elder Maren** | Briarhollow (moved from Emberwick) | Briarhollow's elder; becomes the voice of the resistance camp |
| **Regent Elowen** | Emberwick | The kingdom's ruler; target of the festival assassination |
| **Lord Chancellor Maelis Crane** | Emberwick | The traitor: diverted the relief that would have saved the Ninefold Watch, sold the roads to the Host, plans the festival murder |
| **The Pale Herald** | everywhere, briefly | Vaelor's voice; speaks through grieflight in Act I–II, appears in person in Act III |
| **Rider-Captain Vosk** | Amberfield | The Host commander who leads the attack on Hearthstead and **escapes with the second fragment** (Act I finale) |
| **Sir Corvane** | Barrow of Kings | The Host's first knight; Cael's mentor; dies asking Cael's forgiveness |
| **Queen Ysane** | Act V echoes | Vaelor's dead queen; the player meets her memory, who begs them to let her go |

The townspeople of the old quests stay (Warden Hollis, Reeve Aldous, Tobin, Hanna, Sefa, Marshwarden Tilde,
Harbormaster Quill, Marshal Dunmore, Healer Osk, Thane Borrik, Lamplighter Ivo, Sister Maud…): they are the
people the hero saves, and they come back.

---

## 3. The campaign

Levels follow PROGRESSION_BALANCE.md. **Built** = playable today; **future** = mapped but not yet built (the old
Act IV zones on the `sigilfall-4b-wip` branch).

### Prologue — The Night the Bells Stopped (levels 1–6) · built in the vertical slice

Briarhollow is a border village of thatch, orchards and a chapel with a bell that has not rung in three weeks.
People vanish after sunset. The hero arrives as the lamps are lit, with the Host on the road behind them: the story
opens on the night, and the quiet beats (the Whisperwood, the courier's letter) come after it.

| Beat | What happens | World event |
| --- | --- | --- |
| Cold open | The north gate as the lamps are lit; half the shutters nailed closed. **Mara Venn** stops the hero there, then sees grey shapes on the road behind them: "Turn around. Here they come." | Village in **dusk** state: evening, lamps lit |
| First fight | The hero holds the gate beside Mara. The fight teaches the controls as it goes: each wave lights the key it asks for on the action bar (strike, the skill, the dodge), with a line over it | **Raid** event at the gate; the village switches to **gate** state: night, nothing burning yet |
| The bell | The gate holds, and the chapel bell nobody has rung in three weeks tolls by itself. The roofs catch, the chapel's side first, then the east wall's: "Nobody has touched that rope in three weeks." | A staged scene: the camera on the chapel, then the east roofs; the village switches to **raid** state, its roofs catching one by one |
| Escalation | They came over the east wall while the gate held. Fire in the thatch, raiders in the lanes | Raid at the square: they come out of the smoke at the edge of sight, Mara fighting beside the hero |
| The courier | Hooves on the north road, then none. **Ranger Oskar Fell** walks the last of it out of the dark, carrying his light, with an arrow of grey glass in his back, and dies in the gateway, pressing a **broken royal seal** into the hero's hand: "The Crown City must know" | An arrival, watched from the gate: the camera looks up the road as he comes |
| Rescue | Help villagers to the chapel; break into the burning **Bramble & Barrel inn**: three children trapped upstairs. Elyra is already inside, holding a ward over them with shaking hands | Timed **rescue** objective; children follow the hero to the chapel |
| Defend | Hold the chapel door with Mara and Elyra while the raiders try to break in | **Defend** objective with two allies on screen |
| Complication | The raiders stop attacking and start **digging** under the chapel: they want what is below | Raiders retreat into the crypt stair |
| Climax | Down into **the Chapel Crypt** (the old Hollow Crypt): the crypt warden (Ossric) and the Ash-scholar **Morgrave**, who opens the reliquary | Dungeon |
| Reveal | In the reliquary: a **fragment of an ancient crown**, star-iron, warm. When Elyra touches it, it bonds to her. On the wall, painted fresh: **the mark of the Ashen Host** — a crown made of grey hands | Elyra gains her light |
| Aftermath | Dawn. Half the village burned. Mara counts the missing. Maren takes the seal and dries the soaked letter by the fire, and decides: Briarhollow will not run, it will **gather the Vale**. The north road opens: the hero first clears the Whisperwood the Host came out of (Grimtusk, Hollin's shards), then is sent to warn the villages. | Village switches to **aftermath** state (burned roofs, a refugee tent, the crater at the chapel); it becomes **the resistance camp** |

### Act I — The Villages of the Vale (levels 5–20) · built zones, story rewritten

The Ashen Host is testing the border. Every village has its own crisis, and every village that is saved **sends
something to Briarhollow**. The player sees those people arrive in the camp.

| Settlement (zone) | Crisis | Contribution to the camp | World event on success |
| --- | --- | --- | --- |
| **Fernstead** (Brackenridge Hills) | The barrow dead walk; the Harvest Stones shrine is **corrupted by grieflight**; the Grey Lady sings the dead awake | **Scouts**: Warden Hollis's rangers | The Harvest Stones are cleansed (shrine lit); Hollis's rangers appear at Briarhollow's watchfire |
| **Millbrook** (Thornvale) | The **mill bridge is held by mercenaries** (the Gallows Gang, paid in ash-gold); a farmstead besieged by wolves (Tobin) | **Food**: Reeve Aldous's grain carts | Bridge barricade burns, the gang's banner comes down; grain carts and Tobin's sheep pen in the camp |
| **Reedwater** (Greyfen Marsh) | **Villagers abducted** into the drowned hamlet by Mother Mire; wells poisoned with marsh-rot | **Healers**: Marshwarden Tilde and the Reedwater herb-boats | Wells clean (water glints again); a healers' tent at the camp |
| **Gullport** (the Saltmarsh) | Smugglers selling grieflight powder; the drowned chapel | **Smiths and ships**: Ines the shipwright, Gullport's forge | Smugglers' cove abandoned; a forge and a cart of powder kegs at the camp |
| **Hearthstead** (the Amberfield) | Refugees on every road; Host riders burning caravans | **Troops**: Marshal Dunmore's riders | Hearthstead's wall repaired |

**Nyx cameo.** In Millbrook the thieves'-cant orders lead to Pim, whose "friend who reads everything" is Nyx. She
reads the gang's orders for a fee, winks, and is gone.

**Act I finale — The Defense of Hearthstead.** Vosk's Ashen riders strike the fortified village with everything:
three waves, then a battering ram at the gate. **Mara commands the wall**, Dunmore's riders fight on screen, the
Fernstead scouts shoot from the towers, and Elyra's light breaks the ram. Hearthstead holds — but in the smoke
**Vosk takes the second Crown fragment** from the shrine under the hall and rides north. The Act ends with Maren
reading the broken royal seal aloud: the King's courier was riding to warn the Crown City that the sigils are
being hunted. Someone in the city has been hiding the letters.

### Act II — Road to the Crown City (levels 18–30) · built zones, story rewritten

The Vale is safe for now; the road north is not. Refugees stream toward Emberwick and the party goes with them.

| Chapter (zone) | Beats | New companion | World event |
| --- | --- | --- | --- |
| **Escort the refugees** (the Amberfield → Duskfen) | The caravan out of Hearthstead; the plague villages of Duskfen; the Rot-Mother brewing grief into sickness | **Nyx** joins at Stilt Hollow: she knows the smugglers' paths around the plague | Refugee caravan visible on the road; Low Wick burns its plague houses after the cure |
| **The mountain pass** (Ironpeak) | The dwarves' Deepforge has been seized and turned into the Host's **occupied toll fortress** on the only pass north. Infiltrate with Nyx, open the gate from inside, defeat Grold | — | The pass gate opens; dwarven banners return to Kragholt; Brenna forges for the camp |
| **Lantern Hill** (the Ashen Barrows) | The lamps go out one a night. Brother Orren keeps the last chapel. Cael Varrow drinks in the hostel under a false name | **Brother Orren**, **Cael Varrow** | Lamps relit across the downs; the Ninefold Watch flag raised again |
| **The first knight** (Barrow of Kings) | Cael's mentor, Sir Corvane, leads the barrow dead. Corvane dies asking forgiveness and gives Cael the proof: the relief order for the Ninefold Watch, **countermanded in the Chancellor's hand** | — | Corvane's banner laid on the King's Mound |
| **The lighthouse** (Stormwatch) | Optional in the Act's order: the drowned fleet strikes the coast; the Stormwatch Light | — | The Light burns again |
| **The traitor** (Emberwick) | In the city: follow the countermanded order through the treasury, the roads office and the Chancellor's cellar. Every clue is a short quest in a different district | — | Districts open one by one |
| **Act II finale — The Starfall Festival** | Emberwick celebrates the star that fell three hundred years ago: lanterns, music, a parade. At the height of it the Chancellor's hired knives and Ashen assassins strike the Regent's balcony. Running battle through the festival streets; Cael holds the keep stair; the Chancellor flees into the catacombs; **the Regent survives** and names the hero her champion | — | Festival lanterns, then **smoke and broken stalls**; the city locks down; Crane's house sealed |

### Act III — The Broken Alliance (levels 29–42) · built zones, story rewritten

The Regent needs an army. The realm's factions will not march together: each has an old grudge and a real dilemma.

| Faction (zone) | Dilemma | Signature dungeon | What they send later (Act VI) |
| --- | --- | --- | --- |
| **The forest clans** (the Glimmerwood) | Their prince, Thistlemourn, has sworn to the Host to save his court from the blight. Kill him, or let Lady Silvaine try to bring him back (both paths reach the same next quest; the choice changes who rides in the Last March) | (the Thorn Court boss) | Thorn archers and dryads |
| **The mountain houses** (Rimeheld; Ironpeak's dwarves) | Jarl Hrimfang sold the vault of the Frost Sigil for ash-gold; Jarl Sigrun must choose between a civil war and letting him live | **The Rimeheld Vault** | Huscarls and giants |
| **The sun houses** (the Sunscorch; Sablewind) | The oasis lords want the Sun Sigil kept in its tomb forever | **The Tomb of the Sun King** | Desert lancers |
| **The marsh settlements** (Vinecoil, Greyfen) | Vinehold sold the Coiled Queen's venom to the Host to survive; Warden Kesh asks the hero to hide it from the Regent | (the Coiled Temple) | Marsh-folk skirmishers and herb-boats |

Running through the Act: the Host begins **raising fallen soldiers** — Highwall's own buried knights march against
it (the old Highwall chain). The moors' curse (Grimward) and the Shattered Vale's tear are the grieflight spreading.

**The low point (the Shattered Vale).** At the Tear, the **Pale Herald** appears in person. Nyx has sold him the
party's road in exchange for her brother — and the Herald keeps neither promise. The party is beaten for the first
time; **Elyra is taken**, and in the same night **Fernstead falls** (the first village the hero saved). The camp at
Briarhollow fills with Fernstead's people. Nyx disappears.

### Act IV — War of the Three Gates (levels 40–50) · built

The hero stops reacting and starts leading. Three fortresses guard the road to Vaelmoor.

| Gate | State | Chain |
| --- | --- | --- |
| **Highwall** (Highwall March, Siege of Highwall) | built | Scouting, the bone batteries, the Breach, the Siege-Breaker, General Morvain. Mara commands the relief; Cael leads the sortie |
| **The Gloam Gate** (Gloamhollow) | built | Nyx returns with the Herald's prison map: **rescue Elyra** from the gate's cells (her redemption) |
| **The Muster Hall** (the Bonefields) | built | The field battle: allied squads, artillery, the Bone Colossus |

Between sieges **Emberwick visibly changes**: the market becomes a muster ground, smiths work through the night,
the festival lanterns are replaced by war banners, refugees are housed in the outer district.

### Act V — The Dead Kingdom (levels 48–57) · built

Beyond the gates lies Vaelmoor, warped: **villages frozen in the moment of their destruction** (the Weeping Woods,
the Sunken Reaches, Hollowmere's drowned town). The party learns Vaelor's story from echoes: Queen Ysane, the two
children, the winter of plague. Major dungeons each hold a Crown Sigil (Blightheart, the Molten Throne, the Spire
of the Rift). Brother Orren meets his own dead and holds. Elyra, with most sigils bonded to her, starts forgetting
the hero's name.

### Act VI — The Last March (levels 56–59) · built

With enough sigils the coalition marches. Every faction the hero helped **arrives with its own troops**: Hollis's
scouts, Dunmore's riders, the dwarves, the forest clans (as chosen), the jarls, the desert lancers, the marsh
boats. The battlefield of the Pale Reach: protect the siege mages, break the outer wall, descend into Duskspire,
face corrupted champions met earlier (Vosk, the Pale Herald). Companion lines change with completed side arcs.

### Finale — Crownfall (level 60) · built

1. **The throne room duel** with Vaelor.
2. **The shattered realm**: the Ash Crown pulls the battle into a memory of Vaelmoor whole and beautiful.
3. **The rescue and the choice**: Elyra, holding the relit sigils, can give Vaelor his family back for one hour
   before the end, or break the crown at once. Both end the Ash Crown; the first changes what the epilogue shows.
4. **The final form**: the Ash Crown itself.

**As built.** Stage 1 is Duskspire's throne room; stage 2 is a second arena, *Vaelmoor Remembered*, reached through a
tear over Duskspire once Vaelor falls; stage 3 is the `crownfall` choice (go to Vaelor to give him the hour, or tell
Elyra to break it: the hour costs Elyra the last of her memory of the hero, breaking it at once keeps her name for
him); stage 4 is the Ash Crown in the memory's palace garden. Act VI's corrupted champions are Vosk (hollowed, at the
head of the Host) and the Herald's voice in the Duskspire Gate; the Herald was Vaelor's brother Aurel, who carried the
order to open the harbor (told in Act VI, met in the postgame).

**Epilogue.** Concrete consequences across the saved villages and allies; the camp packs up; the hero walks back
into **rebuilt Briarhollow**, and Old Haldor **rings the bell**. Postgame: Heroic and Mythic remixes and the
unresolved threads (Wren's fate, the Chancellor in the catacombs, what was under the Tear).

---

## 4. World events — the world reacts to the story

Every major quest changes something the player can **see**. Implemented as a world-state layer (EXECUTION_PLAN.md,
Phase W): each region can have **states** chosen by quest progress, and each state swaps props, NPCs, ambient
effects, music and spawns. Scripted **events** (raids, ambushes, defences, rescues, arrivals) run when a quest
step starts and are recoverable after a reload.

| Place | States (quest that switches it) |
| --- | --- |
| Briarhollow | dusk (start) → raid (`briar-nightfall`) → aftermath (`briar-the-reliquary` done) → camp, growing with each village saved (Act I) → Fernstead's refugees (Act III low point) → rebuilt and the bell rings (epilogue) |
| Fernstead | haunted (start) → shrine cleansed (`the-harvest-stones`) → fallen (Act III low point) → retaken (Act IV) |
| Millbrook / Thornvale | bridge blockade (start) → bridge free (`the-bandit-king`) |
| Reedwater / Greyfen | poisoned wells → clean wells (`the-ghoul-mother`) |
| Hearthstead / Amberfield | refugee roads → siege (Act I finale) → wall repaired |
| Low Wick / Duskfen | plague → burned and cured (`the-rot-mother`) |
| Kragholt / Ironpeak | the pass held by the Host → pass open (`forgemaster-grold`) |
| Lantern Hill | lamps dark → lamps lit (`candle-thieves`, `sir-corvane`) |
| Emberwick | locked to the player until Act II → festival → after the festival (locked down) → war footing (Act IV) |
| Highwall March | besieged → relieved (`general-morvain`) |

**Event kinds** (built on the existing simulation, no fake cutscenes): `raid` (waves from map edges into a
village), `defend` (hold a point or a gate against waves, allies on screen), `rescue` (reach people in time; they
follow the hero to safety), `escort` (a cart or a group walks a road; ambushes on the way), `ambush` (packs appear
when the hero reaches a spot), `arrival` (people walk into the camp), `bark` (a companion line at a moment).

---

## 5. Tone and writing rules

- Short lines. A beat is two to four lines of dialogue, then play.
- Warm before dark: every village gets one line of ordinary life before its crisis.
- The Host is sad, not cackling. Its soldiers say what they remember ("Is it supper yet?").
- Humour from people (Tobin, Nyx, Brewer Olav), never from the threat.
- The hero has no voice lines of their own; companions react to what the hero did.
- American spelling in player-facing text (project rule); straight apostrophes in ids, typographic in text.
