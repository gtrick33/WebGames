# GlitchBound and Sigilfall — Legal Review before public release and monetization

First pass 2026-10-27, fixes the same day. A working record of licenses, names and borrowed material, for the
owner (and a lawyer, if one is asked). It is **not legal advice** and not a trademark clearance.

## The Rift's seasons (2026-11-23)

The owner asked for seasons "similar to diablo": a month each, ten mechanics in turn, for the endgame only. The research
behind them looked at Diablo III and IV, Path of Exile, Last Epoch and WoW's Mythic+, and what is taken is **rules
only**: a season-long power that works in the endgame and sleeps afterwards (Diablo III's themes), a power socketed or
chosen that grows as the player climbs (Diablo IV's seasonal powers), a journey of goals that gives a whole set and a
title (Diablo III's season journey), a ladder that starts again each season (Mythic+), shrines that empower a run, a
set bonus from fewer pieces, a legendary's power without wearing it, boons chosen after bosses, offerings at an altar,
kill streaks, an invading hunter, and echoed casts. Every season's name, its words (Keeper Isolde says them at the
Riftgate; each season had a keeper of its own at first, folded into her on 2026-11-24), the four hearts, the titles (Heartsworn,
Shrinewalker, Kinbound, Legendbearer, Boonblessed, Altarsworn, Bloodbound, Twin-pathed, Huntbreaker, Twice-spoken) and
the Heartfire Drake are Sigilfall's own (`data/seasons.ts`). The third season was proposed as "Grandeur", the name of a
Diablo III season, and is called the Season of Kinship instead.

Seasons 2 to 10, built the same day, keep to that. The four shrines (Might, Haste, the Ward, Thunder), the twelve boons,
the ten blessings of the altar and the Hunter are named and worded here. Two names first written were the genre's own,
each with the same effect behind it, and were changed: a "Shrine of the Conduit" whose lightning leaps into foes nearby
(Diablo III's Conduit Pylon) is the Shrine of Thunder, and an "Iron Skin" boon of less damage taken (a Diablo II
Barbarian skill) is Bulwark. Their colors are each power's own (a red for might, a green for haste, a blue for a ward, a
violet for lightning), not any game's pylon colors.

## The Rift's sets and legendaries (2026-11-22)

The owner asked for sets "like diablo 3": one per specialization and one per class, with bonuses at two, four and six
pieces, and "interactive combos ... auto shooting a spell". What is taken is **rules only**, the genre's: a set's bonus
grows at 2/4/6 worn, the sixth multiplies one skill several times over, and an "echo" casts one of the hero's own
skills by itself (on a timer, a hit, a kill or a blow taken). Every set's and piece's name, every word of every bonus,
and which skill each set builds on are Sigilfall's own (`data/riftgear.ts`); no Diablo III set, item, power or text is
reproduced. Colors: a legendary is the game's long-standing orange; a set piece is a teal-green (`#36e0a8`), chosen
apart from the pure green Diablo III gives its sets, as the owner asked for "set could be green". The set names
(Redmaw, the Unbroken Line, the Last Duelist, the Ninefold Pyre, Thunderwake, the Long Winter, the Far Sight,
Snareweave, Pack Law, the Morning Choir, the Oathwall, the Last Sentence, the Unbroken Vigil, Noonfire, the Hollow
Saint, Blightscript, the Pit Covenant, the Ruinous Choir, Nightpool, the Lynxmother's Due, Heartwood, the Creditor's
Due, Graveweight, the Shepherd's Toll) were made for the game; a web search before release is still worth doing.

## Sounds added for the small-AAA pass (2026-11-19)

Footsteps from Kenney's **Impact Sounds** (CC0, kenney.nl, downloaded from the pack's own page). CC0 asks nothing, and
the files ship only inside the game, as built MP3s; the pack stays in the ignored `assets/sigilfall/cc0/`.

Voices from two OpenGameArt packs, each marked CC0 on its page (checked 2026-11-19): **RPG Male Adventurer** voice clips
by wolfwoot, and the **RPG Voice Starter Pack** by Cici Fyre (cicifyre.itch.io). Wordless sounds only: efforts, cries,
gasps, a victory shout; none of their spoken words (spell names) are used. Recorded people's voices: CC0 leaves no
condition, but the voices are the performers' own, so they are used only as what they are (a hero's grunt), never to
speak lines they didn't record. No synthetic voice is used anywhere (the owner, 2026-11-19).

## Icons changed (2026-11-03)

The owner replaced the game-icons.net silhouettes with **Nasha's Lumenfall: Skill & Spell Icons Vol. 1**, bought on
itch.io. Its license allows use inside a game, including a sold one, and forbids resharing the files as assets or
using them to train AI models, so the pack stays in the ignored `assets/sigilfall/lumenfall/`. **The store page
discloses AI-assisted graphics.** That was a concern for the Certainity packs too (below): it doesn't break this
license, but AI output may have weak copyright protection, and some storefronts ask about it.

## Items sold in the site's shop (2026-11-05)

Five mounts and three armor sets (a helmet and an armor piece each) are sold as cosmetics: `src/catalog/sigilItems.ts`
and `src/catalog/shop.ts`. What they're made of:

- **Mounts:** only the drake (Quaternius's T-Rex), hart (stag) and boar (bull) bodies, never a horse, since the horse
  pack's terms don't clearly cover selling changed horses. The admins' item builder can't make a horse either. What's on
  them (plates, horns, crystals, flames, runes, wing veins) is built in code (`render3d/mountExtras.ts`, `mountKit.ts`).
  Quaternius's license page shows QAL v1.0 (use inside a game, no handing out the files), and the models ship only
  inside the game: a lawyer should still confirm selling a cosmetic built on them (docs/LEGAL-READINESS.md).
- **Armor:** KayKit parts (CC0), recolored, with pieces built in code (`render3d/armorKit.ts`, the shop's sets).
- **Names:** Crownforged, Galecrest, Runetusk, Cinderhorn, Moonglass, Celestine and Gloamquill were searched on the web
  on 2026-11-05 and found on no other game's items. "Nightplume", the first name for the feather set, turned out to be
  a livery in another game, and was dropped. The runes on the mounts are made-up signs, not letters of any alphabet.

## Riding horses (2026-11-04)

Sigilfall's horses come from Amir's Low-Poly Horses Pack on itch.io (https://ahmedamirdev.itch.io/amir-low-poly-horses-pack),
Plus tier. Identified from the page after the files turned up with no license and no author's name: its tiers (4 and 17
horses), clips (Idle, Walk, Run) and date (released Nov 23, 2025; the files are dated Nov 22) all match.

- **The terms are one line on the store page:** "Free & Plus tiers: Use in personal and commercial projects. Credit is
  appreciated but not required." The page tags it "No generative AI was used". It has no fuller license, and says
  nothing about resale, AI training or NFTs.
- **To confirm:** the owner's receipt for the Plus tier ($4.99). All nine horses that ship are Plus files.
- **A small gap:** the game repaints the horses and adds saddles and barding. The Plus line doesn't mention changing them; the
  Source tier's does ($5.99: "Full rights to modify and redistribute your modified versions"). Buying Source removes the question.
- **What ships:** only built files in the game's own format (`public/games/sigilfall/3d/k/m_horse_*.pack`), inside the
  game. The raw `.glb` and `.fbx` files stay on the owner's machine and are not in the repository.
- Keep the receipt and a dated copy of the page: terms on a store page can change.

## The Gloamknight (2026-11-05)

The eighth class. The owner asked for a "dark knight", which is a Final Fantasy XIV job name, and chose **Gloamknight**
instead. Its skills, talents, specializations (Bloodsworn, Ruinblade, Dreadbinder), resource (Umbra), Ring and Vigil
abilities and warden set are named for this game: none is a Final Fantasy XIV Dark Knight action or a World of Warcraft
death knight ability, and its signature colors (smoke-dark plate, dusk violet and rose) are its own. The ultimate is
Duskfall, not "Nightfall" (a World of Warcraft warlock talent).

In the Ring (2026-11-13) he raises the dead, as the owner asked ("similar to death knights in wow"): **Call the
Ashbound**, two of the ashbound dead, not "Raise Dead", "Army of the Dead" or a ghoul. The rule (a timed summon that
fights for its master) is copied, the names and the barrow skeletons they are drawn as are the game's own. Dusk Rend's
combo, which had been called Nightfall, is **Gloomfall**.

In the Ring (2026-11-14), after a friend of the owner's ("typical dk and a shadow rogue, leave summons for a necro
warlock spec"), he is two setups: the **Bloodsworn**, a death knight with **Grave Chain** (the rule of a pull to its user,
not "Death Grip"), and the **Nightblade**, who hides and strikes from behind as the classic arena's rogue does. Only the
rules are copied: stealth that the other side can't target, broken by striking or being struck; an in-fight vanish whose
first moments damage doesn't break; an opener only usable hidden; a blade that hits harder from behind; a step to the
target's back. The names are the game's own: **Shroud of Dusk**, not "Stealth" or "Vanish"; **Dusk Ambush**, not
"Ambush" or "Cheap Shot"; **Nightknife**, not "Backstab"; **Shade Walk**, not "Shadowstep"; the talent **Night's
Embrace**, not "Subterfuge" or "Master of Subtlety"; the combos **Unseen Edge** and **Out of Nowhere**. The ashbound
dead went to the warlock's new **Gravecaller** setup, with **Grave Hunger** (the rule of a frenzy on one's summons), not
"Dark Transformation" or "Unholy Frenzy".

The Ring's second supers (2026-11-14), one per ready-made setup, are named for this game: Run Them Down, Winter's
Grasp, Thicket of Snares, Voidburst, Dawn's Covenant, Grave Legion, Heart of the Grove and Night's Ruin; none is a World
of Warcraft ability ("Bladestorm", "Ice Block", "Void Eruption", "Army of the Dead", "Tranquility" and the like are
avoided). The PvP trinket rule is copied as the **Unbinding Charm**, not "Gladiator's Medallion" or "Every Man for
Himself".

The Ring's super talents (2026-11-14), which work on either super, are named Warpath, Spellscar, Doomed Prey, Bright
Wings, Blinding Dawn, Doom's Herald, Grove's Bloom and Eclipse Hunger. "Marked for Death" (a World of Warcraft rogue
talent) and "Wild Growth" (a World of Warcraft druid spell) were the first drafts and were renamed before release.

## The Ring's fixed playstyles, points and procs (2026-11-16)

The owner asked for the Ring to play "very similar to wow mechanics" in places, and gave examples: a frost mage whose
orb empowers the bolt and whose instant spell spends a proc ("similar ... to fingers of frost"), shards stacked per
bolt and fired by the instant spell, a rogue who builds "combo points" and spends them on a finisher, and a super like
"death from above". **Only the rules are copied**, as before: a resource built by one ability and spent by another for
more the more there is; a chance on a hit to make the next cast of another ability instant or stronger, shown at the
edges of the screen; a ground effect that drifts and ticks; a finisher that takes its user out of reach for a moment
and lands on the target. Rules of play aren't protected; names, text, art and signature looks are, and none is taken:

- **Abilities:** Frostfang (the game's own word: the Frostfang zone and its theme), Rimeglobe, Closing Cut, Night's Ruin,
  Hammerfall, Dawnstride, Duskwalk, Gnawing Word, Blight Dart, Hex Bloom, Stinging Petals. Not "Ice Lance", "Frozen
  Orb", "Eviscerate", "Death from Above", "Divine Steed", "Insect Swarm" or the like.
- **Points:** Nicks (the Nightblade's own), and from talents Notches, Ire, Embers, Rimeshards, Tension, Quills,
  Prayers, Verses, Oaths, Ardor, Rot, Tithes, Buds. Not "Combo Points", "Icicles", "Holy Power" or "Soul Shards".
- **Procs ("boons"):** Red Mist, Blood Up, Cinderheart, Hoarfrost, Still Breath, Baited, Answered Prayer (already the
  name of a talent in the game's own priest and paladin trees), Dire Portent, Kept Oath, Dawnfire, Gathering Dark, Grave
  Chill, Verdant Surge, Falling Star, Hungering Edge, Second Dusk. Not "Fingers of Frost", "Hot Streak", "Brain
  Freeze", "Nightfall", "Shooting Stars" or "Sudden Death". First drafts that turned out to be another game's names
  were renamed before release: "Icicles" (Rimeshards), "Nightfall" (Gathering Dark), "Deadeye" (Still Breath),
  "Conviction" (Ardor), "Dark Omen" (Dire Portent, since Warhammer: Dark Omen is a game's title), "Bleeding Edge"
  (Bloodied Edge, also a game's title) and "Black Harvest" (Last Harvest).
- **The look of a proc:** shapes drawn in code for this game (`ui/RingBoons.tsx`), one manner per class (a slash, a
  flame, a shard of ice, a feather, a halo, a void, a sun, a hex mark, a skull, a leaf, a moon, a fang) in the class's
  own colors, outlined in black and standing either side of the player's own hero (not at the edges of the screen,
  where they were first put). Showing a sign while a proc is up is a rule of interface; World of Warcraft's spell-alert
  textures were not looked at or traced.
- **Icons:** only ones already in the built atlas (Nasha's Lumenfall pack, above); no new file was added, and the atlas
  was re-packed from itself with the icons the Ring no longer uses left out.

- **Descriptions:** the owner asked for the abilities and talents to read like "wow's description of the spells". What
  is taken is the manner (what it does and by how much, in a sentence or two; a line for how it is cast and how soon
  again), and the layout of a name over a description in a framed box, which is how game tooltips in general are
  made. Every sentence was written for this game from its own numbers; none is another game's tooltip, and the frame
  and colors are the Ring's own gold on its own dark violet.

The trinket, the Gloam and the choosing of abilities one by one are gone, so "Unbinding Trinket" no longer appears in
the Ring.

## Fixed

### Names taken from World of Warcraft and other games (was HIGH and MEDIUM)

Renamed in Sigilfall's data, text, tests and docs. Ids are unchanged, so saves keep working. The full old → new
table is RENAMES.md; highlights:

- **Trademark and Blizzard's coined names:**
  - Hearthstone → Homestone.
  - Light of the Naaru → Light of the Choir; Fury of Elune → Fury of the Moon; Guardian of Ursoc →
    Guardian of the Great Bear.
  - Moonkin Hide → Moonbeast Hide; Owlkin Frenzy → Owl-Spirit Frenzy.
  - Felguard → Pit Knight; the Fel talents → Brimstone Armor, Iron Binding, Pitfire, …; Lord of the
    Legion → Master of the Host.
  - Shadow Word: Pain → Creeping Pain; Power Word: Shield → Ward of Grace.
  - Holy Power → Zeal.
- **Spec names:**
  - Paladin: Dawnkeeper / Shieldbearer / Zealot.
  - Priest: Aegis / Lumen / Umbral.
  - Warlock: Hexer / Binder / Doomcaller.
  - Druid: Starseer / Wildclaw / Bearward.
- **About 230 ability and talent names**, for example:
  - Templar's Verdict → Twin Edict; Judgment → Sunbrand; Consecration → Blessed Circle.
  - Chaos Bolt → Ruin Bolt; Ironfur → Ironpelt; Cat/Bear Form → Lynx/Bear Shape.
  - Titan's Grip → Giant's Grip; Icy Veins → Frost-Blooded.
- **Kept:** ordinary words every RPG uses (Fireball, Blink, Charge, Cleave, Smite, Renew, Execute,
  Whirlwind, Starfall, …).
- **The endgame:** "Mythic+" → **Riftstone +N**. The affixes Fortified, Tyrannical, Bolstering, Sanguine,
  Raging and Bursting → **Hardened, Crowned, Grieving, Festering, Cornered and Splintering**. Volatile and
  Hasted are ordinary words.
- **Other studios' names:** Varric Blackhand (Dragon Age + Warcraft) → **Harlan Blackglove**; Thornmail
  (League of Legends) → Bramble Hauberk; Dawnbreaker (Skyrim) → Daybringer; Death Knight enemies → Grave
  Knights.
- **Launch Control:**
  - Car names that used real makers' model badges were renamed:
    - Plaid (Tesla) → Elektra Volt; Redeye (Dodge) → Hellion Inferno; GT-R (Nissan) → Vortex Storm.
    - Phantom (Rolls-Royce) → Monarch Sovereign; GTi (VW) → Vossberg Sprint; Turbo S (Porsche) →
      Falkon Turbo.
    - "Stallone 812" (Ferrari) → Corsaro 800; "Toro Aventura" (Lamborghini) → Tempesta; Peregrine 720
      → Peregrine GT.
    - Sakura Type-S → Sakura Sport; Ironhide Z (Transformers) → Bulwark Z; Interceptor (Ford) →
      Pursuer.
  - The "Side Swoosh" livery (Nike) → Side Sweep.
  - The five Cosmo car bodies whose files were named after real cars (italia, lamb, ghini, kamaro,
    fenyr) were renamed to sprinter, wedge, raptor, brawler and arrow, in files, node names and code.
    They are plain low-poly shapes without badges or grilles.

### Credits

- CREDITS_AND_LICENSES.md now lists every art pack Sigilfall ships.
- The game's Settings panel has "Art credits".
- **game-icons.net (2026-10-29):** the skill and talent icons are CC BY 3.0. Unlike the paid packs, credit is a
  condition here. The Settings panel names every artist whose icons are used and the license; ICON_CREDITS.md
  lists each icon with its author. The set itself stays in `assets/sigilfall/game-icons/` (untracked); only the
  built atlas ships. CC BY also allows sharing the files, so a public repository would be fine for this one.

## Open, by risk

1. **HIGH — the licensed art packs are public.** This was listed under Fixed from 2026-10-27, but on 2026-11-19
   the repository was public and still tracked the packs.
   - `gtrick33/WebGames` is **public**: GitHub's API said so on 2026-11-19 (no forks, no stars). This review
     had recorded it as made private on 2026-10-27.
   - The raw packs (13 packs, 13,467 files, 448 MB) were committed to `glitchbound/assets/sigilfall/` in
     `82c38567` (2026-10-26). Every license there forbids sharing the files. `7d69a154` only added the folder
     to `.gitignore`, which leaves tracked files tracked, so every commit kept them until they were
     untracked on 2026-11-19.
   - The packs stay on the owner's machine, where the art scripts read them. But every commit from
     `82c38567` to the untracking still holds them, and a public repository serves them to anyone.
   - Ending it is the owner's call, one of:
     - make the repository **private** again (GitHub › Settings › General › Danger Zone). GitHub's free plan
       gives 2,000 Actions minutes a month, and recent weeks ran over 100 CI runs. Watch the usage (GitHub ›
       Settings › Billing). If it runs out, CI pauses until the next month unless minutes are bought;
     - or purge `assets/sigilfall/` from the history: git filter-repo, then a force-push of every branch.
       Old pull requests still point at the old commits after that; removing those takes GitHub Support.
2. **MEDIUM — Certainity's five packs.** Greenvale Meadows, Gloomvault Crypt, Mirefen Bog, Sylvanreach Grove
   and Blossom Shrine ($1 each; the seller lists about 40 packs). There is no statement about AI and their
   look reads as AI-made.
   - The license grants commercial use. But nobody can own a copyright in AI-made pieces, a copied
     source would expose us, and some stores ask for AI disclosure.
   - Keep the receipts. Replacing them over time with verified packs or art drawn in code removes it.
3. **LOW — the game's structure still echoes WoW's classes.** Game rules and mechanics aren't protected,
   and every distinctive name is gone.
   - Normal / Heroic / Mythic and Paragon are ordinary words used by many games. They were kept.
4. **LOW — the Launch Control supercar bodies** still resemble supercars in general. Without names,
   badges or grilles the risk is low. Swapping them for RG Poly's generic bodies would end it.
5. **Brand names** (Sigilfall, GlitchBound, Riftstone, Quizbelief, Fussbox, Whatsit, Launch Control):
   - Web searches found no game or live trademark using them. The only Whatsit mark, from 1989, was
     abandoned in 1990.
   - Crosswire has a pending US application (98622801) by someone else; watch it.
   - Before spending on the brand, run a real search (USPTO, EUIPO, WIPO; classes 9 and 41) and
     consider registering GlitchBound.
6. **Monetization:**
   - **Ads:** before switching AdSense on, turn on Google's certified consent message for EU, UK and
     Swiss visitors (the privacy page already promises it).
   - **Selling anything** needs terms of sale, the EU withdrawal right for digital content, VAT (EU OSS)
     and a refund policy.
   - **Age:** Crass Act is 18+. Children playing tightens ad and data rules (COPPA, GDPR-K).
   - **Discord:** Discord's developer terms apply to anything sold in the Activity.

## Checked and clear

- **Code libraries:** react, react-dom, three, @discord/embedded-app-sdk and their dependencies are MIT or
  Unlicense. The fonts are OFL 1.1.
- **Photos:** Where's the Ball? uses 144 photos, CC0 or public domain from Wikimedia Commons, credited in
  the game.
- **Launch Control's car models:** CC0 (RG Poly, Cosmo free pack), credited in its CREDITS.md.
- **Quizbelief's "name that tune":** every melody is public domain (classical or traditional, plus Happy
  Birthday, whose copyright was ruled invalid in the US in 2015 and expired in the EU in 2016).
- **Music and sound** across the site and the marketing kit are synthesized in code, except Sigilfall's recorded
  sound effects and soundtrack (since 2026-11-11: music by Kevin MacLeod, CC BY 4.0, and the Fantasy Sound Effects
  Library by Little Robot Sound Factory, CC BY 3.0, both of which must be and are credited in the game's Settings;
  the rest CC0: see CREDITS_AND_LICENSES.md); the marketing emoji are Noto (OFL).
- **Trivia** that names brands, films or people does so as facts, which is fine.
- **Sigilfall's original art:** heroes, monsters, bosses, icons and interface are drawn in code.
- **Verified sellers:** Royal Keep (bubbabba) and Magic Spells VFX (Willosuna) store pages exist and say
  "No generative AI was used". CraftPix's license allows sold games.
- **Sigilfall's 3D models (2026-11-03):** KayKit and Kenney (CC0), Quaternius (see CREDITS_AND_LICENSES.md, used inside the
  game only). The look is a lower camera and cartoon shading in the general style of top-down brawlers; no other game's
  names, characters, art or maps are used.
