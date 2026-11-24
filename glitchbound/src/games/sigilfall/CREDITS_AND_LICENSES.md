# Sigilfall — Credits and Licenses

Art that ships in the game: the 3D models in `public/games/sigilfall/3d/` and the skill and talent icons in
`public/games/sigilfall/icons/` (below). The 2D atlases in `public/games/sigilfall/art/`, built by
`scripts/sigilfall-art.mjs` and `scripts/sigilfall-art-world.mjs`, shipped until 2026-11-19, when the 2D world
renderer they drew for was removed with them; the 3D world had already replaced it. They were last checked against
the packs on 2026-10-28, when the outdoor world became Royal Keep's alone (ASSET_AUDIT.md). Credit is optional under every
license below except game-icons.net's (CC BY 3.0, where it is a condition); it is given anyway, here and in the
game's Settings panel ("Art credits").

## 3D models (2026-11-03)

The land, heroes, gear, mounts and creatures are low-poly models, built by `scripts/sigilfall-3d-assets.mjs` from the
packs below into the game's own files in `public/games/sigilfall/3d/` (the packs stay out of the repository).

| Models | Author | Terms | What we use |
| --- | --- | --- | --- |
| KayKit: Adventurers 2.0, Skeletons, Mystery Monthly Series 4–6, Character Animations, Forest Nature, Medieval Hexagon, Dungeon, Halloween, Furniture, Fantasy Weapons, RPG Tools | Kay Lousberg, https://www.kaylousberg.com | CC0 | Heroes and every piece of the Wardrobe, people, undead, animations, trees, houses, furniture, weapons; and the bosses that have a figure of their own, each put together from several of these packs' characters and things (the Coffin Matron: the Witch of Mystery Monthly, the Skeleton Mage's arms, the Halloween Bits' coffin and the RPG Tools Bits' shovel; Warden Ossric: the Knight's armor and cape, the Skeleton Warrior's skull, the Fantasy Weapons Bits' halberd and the Skeletons' great shield; Morgrave: the Lorekeeper's head, spectacles and pack on the Necromancer's robes, the Adventurers' open spellbook and a Fantasy Weapons staff) |
| Nature Kit, Graveyard Kit, Castle Kit | Kenney, https://kenney.nl | CC0 | Palms, pines, cacti, mushrooms, flowers, fences, gravestones, the siege ram, castle walls and gates |
| Ultimate Animated Animals, Farm Animals, Animated Dinosaurs | Quaternius, https://quaternius.com | The pack pages say CC0; the license page shows QAL v1.0, which allows use inside a game and forbids redistributing the files alone. We ship them only as part of the game. | The real beasts of the world: wolves, boars, bears, deer, horses, sheep, pigs, raptors, and Grimtusk, the great boar of the Whisperwood, built on the bull as the boar mounts are. Monsters come from one family instead (KayKit, and shapes built in the asset script). The mounts' harts and boars are built on the stag and the bull, and the drakes on the T-Rex, with their wings, horns and saddles made in `render3d/mountKit.ts`. |
| Low-Poly Horses Pack, Plus tier ($4.99; 9 of its 17 horses ship) | Amir, https://ahmedamirdev.itch.io/amir-low-poly-horses-pack | The store page: "Free & Plus tiers: Use in personal and commercial projects. Credit is appreciated but not required." No license file comes with the download. The page says more about changing the models only for its Source tier ($5.99): "Full rights to modify and redistribute your modified versions." See LEGAL_REVIEW.md. | The riding horses, repainted and dressed in `render3d/mountKit.ts` |

## Sound and music (2026-11-11)

`scripts/sigilfall-sounds.mjs` builds every file from the packs below into `public/games/sigilfall/audio/` and
`public/games/sigilfall/music/` (cut, made mono or shortened, and leveled); the packs themselves stay out of the
repository. `audio/samples.ts` says which game sound plays which file, `audio/tracks.ts` which land plays which piece.

**Two of these must be credited where players can see it** (they are, in Settings › Music and sound credits): the
music and the Little Robot Sound Factory library. Both are Creative Commons Attribution: name the author, link the
source and the license, and say the work was changed.

| Sounds | Author | Terms | What we use |
| --- | --- | --- | --- |
| The soundtrack: 25 pieces | Kevin MacLeod, https://incompetech.com | **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/ . Credit required. Changed: each piece is cut to at most 150 seconds with a fade and leveled. | "Ascending the Vale" (title), "Suonatore di Liuto" (villages), "Lord of the Land" (courts), "Minstrel Guild" (taverns), "Agnus Dei X" (chapels), "Enchanted Valley" (woods), "Teller of the Tales" (roads), "Skye Cuillin" (heights), "Moorland" (coasts), "Ibn Al-Noor" (deserts), "Curse of the Scarab" (the tomb), "Tabuk" (jungle), "The Hive" (forges), "Ossuary 6 - Air" (the barrows), "Dark Times" (Highwall), "The Dread" (dark woods), "Frozen Star" (snow), "Echoes of Time v2" (the Riftscar), "Ossuary 5 - Rest" (crypts), "Crypto" (caves), "Five Armies" (bosses), "Heroic Age" (sieges), and the Ring's arenas: "Desert City" (the Proving Sands), "Ice Flow" (the Frozen Mere), "Volatile Reaction" (the Cinder Forge) |
| Fantasy Sound Effects Library | Little Robot Sound Factory, https://www.littlerobotsoundfactory.com (from https://opengameart.org/content/fantasy-sound-effects-library) | **CC BY 3.0**, https://creativecommons.org/licenses/by/3.0/ . Credit required: "Attribute Little Robot Sound Factory, and provide this link where possible: www.littlerobotsoundfactory.com". Changed: cut and leveled. | Spell chimes, conjuring, the rift's call, a dark bolt, a trap, a bag, two growls, the level, quest, victory and defeat jingles, the cave's air (14 files) |
| RPG Sound Pack; Freeze Spell | artisticdude, https://opengameart.org/content/rpg-sound-pack | CC0 | Sword swings and clashes, creature voices (giants, ogres, beasts, shades, slimes, beetles), coins, bottles, armor, cloth, doors; the frost spell |
| 75 CC0 breaking / falling / hit sfx; 100 CC0 SFX; 100 CC0 SFX #2; 80 CC0 RPG SFX | rubberduck, https://opengameart.org/users/rubberduck | CC0 | Blows landing, thuds, metal hits, rocks, shatters; slams, a boom, a bell, a gong; thunder, the water's air; stones, fire, arcs, gems |
| Fantasy Sound Effects (Tinysized SFX); Fantasy Weapons and Apparel SFX Library | Vehicle, https://opengameart.org/users/vehicle | CC0 | Steel on steel, lightning, whooshes; arrows |
| 10 Impact / Shield Blocks | StarNinjas, https://opengameart.org/users/starninjas | CC0 | A shield taking a blow |
| Interface Sounds | Kenney, https://kenney.nl | CC0 | The menus: clicks, panels opening and closing, a choice made, a refusal |
| Voice Clip Pack: RPG Male Adventurer (2026-11-19) | wolfwoot, https://opengameart.org/content/voice-clip-pack-male-adventurer-rpg | CC0 | A man's voice for a hero: efforts, cries, a fall, dodges, a victory; and, pitched lower, the shouts of the companions who are men (`vo-m-*`, src/games/sigilfall/audio/voice.ts) |
| RPG Voice Starter Pack (2026-11-19) | Cici Fyre, https://opengameart.org/content/female-rpg-voice-starter-pack | CC0 | A woman's voice for a hero (Type 1: efforts, cries, dodges), and two more for the companions who are women (Types 2 and 3: their shouts) (`vo-f*`) |
| Impact Sounds (2026-11-19) | Kenney, https://kenney.nl/assets/impact-sounds | CC0 | Footsteps on grass, stone, planks and snow (sand is the snow's, pitched up): `step-*`, built from `assets/sigilfall/cc0/` by `scripts/sigilfall-sounds.mjs --only step-` |
| The Ring's sound effects (`ring-*`) | GlitchBound, made for the game by scripts/sigilfall-ring-sounds.mjs | The game's own | Every effect in a Ring match: blows, spells, falls, the win and the loss, a new rank |
| A sigil won (`sigil-won`, 2026-11-20) | GlitchBound, made for the game by scripts/sigilfall-ring-sounds.mjs | The game's own | The Sigil Rite: a sigil of the Starlight Crown won |
| Cure Magic | Someoneman, https://opengameart.org/users/someoneman | CC0 | Healing |
| Teleport Spell | Ogrebane, https://opengameart.org/users/ogrebane | CC0 | A blink |
| Ghost breath | qubodup, https://opengameart.org/users/qubodup | CC0 | A drain of life |
| Forest Ambience | TinyWorlds, https://opengameart.org/users/tinyworlds | CC0 | The air of the woods |
| AMB Morning Sounds | Kresiek The Furry, https://opengameart.org | CC0 | The air of villages and fields |
| Wind whoosh loop | SketchMan3, https://opengameart.org/users/sketchman3 | CC0 | The air of the heights and the dead lands |

Two sounds have no recording and are synthesized in code (`audio/sound.ts`): a war horn and a scene's two low notes.
So is the procedural score that stands in if a piece of music can't be loaded (`audio/songs.ts`).

The soundtrack before 2026-11-11 (Orchestral and World Music Pack by Ragnar Random, CC0) no longer ships.

## 2D art

Royal Keep, Royal Keep Seasons and Gloomvault Crypt no longer ship (since 2026-11-19, above): their rows stay as the
record of what shipped, and Settings still credits them, as the game was made with them. game-icons.net's icons ship.

| Art (atlases) | Author / source | Paid or free | Commercial use | Attribution | Terms that bind us |
| --- | --- | --- | --- | --- | --- |
| Royal Keep — 32×32 Top-Down RPG Castle/Town Tileset v1.1 (`rk-*`) | bubbabba — https://bubbabba.itch.io/royal-keep-tileset | Paid | Yes | Appreciated, not required | No resale or redistribution of the assets, edited or not, as assets; no AI/ML training; no NFTs. Store page: "No generative AI was used" |
| Royal Keep — Seasons v1.1 (`rk-*-autumn`, `rk-*-winter`) | bubbabba | Paid | Yes | Appreciated | Same as Royal Keep |
| Magic Spells VFX v2.0 (`vfx`) | Willosuna — https://willosuna.itch.io/magic-spells-vfx | Paid | Yes, royalty free | Not required | No resale, redistribution or giving away of the image files as a pack. "No generative AI was used" |
| Magic Circles VFX Lite (`circles`) | Willosuna — https://willosuna.itch.io/magic-circles-vfx-lite | Free | Yes, royalty free | Not required | Same as Magic Spells VFX |
| Gloomvault Crypt (`props-gc`: seven story pieces, skulls, bones, a coffin, a cage, a skull banner, an altar, crystals) | Certainity — https://certainity.itch.io | Paid ($1) | Yes | Appreciated, not required | No resale, sharing, uploading or giving away of the assets, edited or not; no NFTs; no AI training; don't claim the originals. "Projects that include the assets inside a finished product … are fine, even if a player could technically extract the files" |
| game-icons.net (`public/games/sigilfall/icons/`: the 305 skill and talent icons, built by `scripts/sigilfall-icons.mjs`) | Lorc, Delapouite, Skoll and other artists — https://game-icons.net, https://github.com/game-icons/icons; each icon's author in ICON_CREDITS.md | Free | Yes | **Required** (CC BY 3.0; one icon, by Zeromancer, is CC0) | Credit the authors and link the license; say the work was changed (they are laid on colored tiles, lit and outlined) |

On disk but **not shipped**: Pixel Castle Interior Tileset v1 (reodesuxz; reference for the interiors only, its
pieces are redrawn in code); the CraftPix Simple Summer, Poison Swamp and Guard & Magic Towers packs, and
Certainity's Greenvale Meadows, Mirefen Bog, Sylvanreach Grove and Blossom Shrine (shipped until 2026-10-28; the
owner asked for one art language, and Royal Keep covers the whole outdoor world).

Gloomvault states no provenance; its painted look reads as AI-assisted (ASSET_AUDIT.md). The license still grants
its use; what it means is that nobody may own a copyright in those pieces, ours included.

Everything else in Sigilfall (item icons, UI) is made in code for the game; its sound and music are credited above.
The skill and talent icons were painted in code too until 2026-10-29; those glyphs remain as the fallback while the
icon atlas loads.
Fonts are the site's (OFL 1.1: Bricolage Grotesque, Space Mono).

This file records the terms as shipped with the packs; it is not legal advice. LEGAL_REVIEW.md has the open risks.
