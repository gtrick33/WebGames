# Sigilfall — Credits and Licenses

Art that ships in the game: the atlases in `public/games/sigilfall/art/`, built by `scripts/sigilfall-art.mjs` and
`scripts/sigilfall-art-world.mjs` from the source packs in `assets/sigilfall/`. Checked against the atlases on
2026-10-28, when the outdoor world became Royal Keep's alone (ASSET_AUDIT.md). Credit is optional under every
license below except game-icons.net's (CC BY 3.0, where it is a condition); it is given anyway, here and in the
game's Settings panel ("Art credits").

## 3D models (2026-11-03)

The land, heroes, gear, mounts and creatures are low-poly models, built by `scripts/sigilfall-3d-assets.mjs` from the
packs below into the game's own files in `public/games/sigilfall/3d/` (the packs stay out of the repository).

| Models | Author | Terms | What we use |
| --- | --- | --- | --- |
| KayKit: Adventurers 2.0, Skeletons, Mystery Monthly Series 4–6, Character Animations, Forest Nature, Medieval Hexagon, Dungeon, Halloween, Furniture, Fantasy Weapons, RPG Tools | Kay Lousberg, https://www.kaylousberg.com | CC0 | Heroes and every piece of the Wardrobe, people, undead, animations, trees, houses, furniture, weapons |
| Nature Kit, Graveyard Kit, Castle Kit | Kenney, https://kenney.nl | CC0 | Palms, pines, cacti, mushrooms, flowers, fences, gravestones, the siege ram, castle walls and gates |
| Ultimate Animated Animals, Farm Animals, Animated Dinosaurs | Quaternius, https://quaternius.com | The pack pages say CC0; the license page shows QAL v1.0, which allows use inside a game and forbids redistributing the files alone. We ship them only as part of the game. | The real beasts of the world: wolves, boars, bears, deer, horses, sheep, pigs, raptors. Monsters come from one family instead (KayKit, and shapes built in the asset script). The mounts' harts and boars are built on the stag and the bull, and the drakes on the T-Rex, with their wings, horns and saddles made in `render3d/mountKit.ts`. |
| Low-poly horses (`PLUS` and `FREE` downloads, 9 of the 17 ship) | Not stated in the files. Their palette is named "ImphenziaPixel" | **No license came with the files: the owner is to confirm the terms before this ships** | The riding horses, repainted and dressed in `render3d/mountKit.ts` |

## Sound (2026-11-04)

| Sounds | Author | Terms | What we use |
| --- | --- | --- | --- |
| RPG Sound Pack | artisticdude, https://opengameart.org/content/rpg-sound-pack | CC0 | Sword swings and clashes, spell whooshes, creature voices (giants, ogres, beasts, shades, slimes, beetles), coins, bottles, armor, doors, menu sounds. `scripts/sigilfall-sounds.mjs` builds them into `public/games/sigilfall/audio/`; the pack stays out of the repository. |
| Orchestral and World Music Pack | Ragnar Random, https://opengameart.org/content/orchestral-and-world-music-pack | CC0 | The soundtrack: 12 pieces (`audio/tracks.ts` says which land plays which), built into `public/games/sigilfall/music/`. |

The rest of the effects are synthesized in code (`audio/`), and so is the procedural score that stands in if a piece can't be loaded.

## 2D art

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

Everything else in Sigilfall (heroes, monsters, bosses, item icons, UI, sound and music) is made in code for the game.
The skill and talent icons were painted in code too until 2026-10-29; those glyphs remain as the fallback while the
icon atlas loads.
Fonts are the site's (OFL 1.1: Bricolage Grotesque, Space Mono).

This file records the terms as shipped with the packs; it is not legal advice. LEGAL_REVIEW.md has the open risks.
