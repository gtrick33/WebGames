# GlitchBound and Sigilfall — Legal Review before public release and monetization

First pass 2026-10-27, fixes the same day. A working record of licenses, names and borrowed material, for the
owner (and a lawyer, if one is asked). It is **not legal advice** and not a trademark clearance.

## Fixed

### The licensed art packs and the public repository (was HIGH)

- `gtrick33/WebGames` was public, with the raw packs in `glitchbound/assets/sigilfall/` since `82c38567`
  (2026-10-26). Every license there forbids sharing the files.
- It had no forks or stars when it was made **private** (2026-10-27).
- The packs are **no longer tracked** (`7d69a154`, `.gitignore`). They stay on the owner's machine, where the
  art scripts read them. Older commits still hold them, inside a private repository, which is not
  redistribution.
- If the repository is ever made public again, purge `assets/sigilfall/` from its history first. That
  takes a force-push.
- Cost of a private repository: GitHub's free plan gives 2,000 Actions minutes a month, and recent weeks
  ran over 100 CI runs. Watch the usage (GitHub › Settings › Billing). If it runs out, CI pauses until the
  next month unless minutes are bought.

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

## Open, by risk

1. **MEDIUM — Certainity's five packs.** Greenvale Meadows, Gloomvault Crypt, Mirefen Bog, Sylvanreach Grove
   and Blossom Shrine ($1 each; the seller lists about 40 packs). There is no statement about AI and their
   look reads as AI-made.
   - The license grants commercial use. But nobody can own a copyright in AI-made pieces, a copied
     source would expose us, and some stores ask for AI disclosure.
   - Keep the receipts. Replacing them over time with verified packs or art drawn in code removes it.
2. **LOW — the game's structure still echoes WoW's classes.** Game rules and mechanics aren't protected,
   and every distinctive name is gone.
   - Normal / Heroic / Mythic and Paragon are ordinary words used by many games. They were kept.
3. **LOW — the Launch Control supercar bodies** still resemble supercars in general. Without names,
   badges or grilles the risk is low. Swapping them for RG Poly's generic bodies would end it.
4. **Brand names** (Sigilfall, GlitchBound, Riftstone, Quizbelief, Fussbox, Whatsit, Launch Control):
   - Web searches found no game or live trademark using them. The only Whatsit mark, from 1989, was
     abandoned in 1990.
   - Crosswire has a pending US application (98622801) by someone else; watch it.
   - Before spending on the brand, run a real search (USPTO, EUIPO, WIPO; classes 9 and 41) and
     consider registering GlitchBound.
5. **Monetization:**
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
- **Music and sound** across the site and the marketing kit are synthesized in code; the marketing emoji are
  Noto (OFL).
- **Trivia** that names brands, films or people does so as facts, which is fine.
- **Sigilfall's original art:** heroes, monsters, bosses, icons and interface are drawn in code.
- **Verified sellers:** Royal Keep (bubbabba) and Magic Spells VFX (Willosuna) store pages exist and say
  "No generative AI was used". CraftPix's license allows sold games.
