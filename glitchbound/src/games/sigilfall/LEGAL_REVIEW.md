# Sigilfall — Legal Review before public release and monetization (2026-10-27)

A working review of licenses, names and borrowed material, so that the owner (and a lawyer, if one is asked) can
act on it. It is **not legal advice**. Findings are ranked by how likely they are to cause trouble once the game
is public and earns money.

## 1. HIGH — the paid art packs sit in a public GitHub repository

- `gtrick33/WebGames` is **public**. Since commit `82c38567` (2026-10-26) it has tracked the raw source packs in
  `glitchbound/assets/sigilfall/` (about 13,000 files: Royal Keep, Magic Spells VFX, the five Certainity packs,
  three CraftPix packs, the castle interior tileset), and the built atlases in `public/games/sigilfall/art/`.
- **Every one of these licenses forbids redistributing the files as assets** (CREDITS_AND_LICENSES.md). Shipping
  them inside the game is allowed; a public repository anyone can download them from is not.
- No forks and no stars yet, so the exposure is still small.
- **Fix:**
  - Make the repository private (GitHub › Settings › Danger Zone › Change visibility). This is the quickest
    fix, and Cloudflare Pages keeps deploying from a private repository. GitHub Actions on a private
    repository has a monthly minutes allowance.
  - Then, or instead, take the packs out of the repository: untrack `assets/sigilfall/`, keep the files
    locally (the art scripts read them from disk), and purge them from the history. The purge needs a
    force-push.

## 2. HIGH — names taken from World of Warcraft

Names and short phrases are generally not protected by copyright. Three things here go further than that:

- **Trademarks and Blizzard's own coined names:**
  - The perk **Hearthstone** (Blizzard's registered trademark).
  - **Light of the Naaru**, **Fury of Elune**, **Guardian of Ursoc**, **Moonkin Hide**, **Owlkin Frenzy**.
  - **Summon Felguard** and "Felguard" pets.
  - **Fel** talents (Fel Armor, Fel Domination, …) and **Lord of the Legion**.
  - **Shadow Word: Pain** and **Power Word: Shield**.
- **Whole class kits copied in selection and arrangement**, which is what makes a cease-and-desist plausible:
  - The Paladin, Priest, Warlock and Druid use WoW's spec names (Holy / Protection / Retribution,
    Discipline / Holy / Shadow, Affliction / Demonology / Destruction, Balance / Feral / Guardian).
  - The **Holy Power** resource.
  - Dozens of WoW ability names: Templar's Verdict, Word of Glory, Shield of the Righteous, Avenger's
    Shield, Divine Storm, Crusader Strike, Avenging Wrath, Chaos Bolt, Unstable Affliction, Starsurge,
    Ironfur, Moonfire, Rejuvenation, …
  - A few hundred WoW talent names: Titan's Grip, Icy Veins, Hot Streak, Brain Freeze, Lock and Load, Beacon
    of Light, Pain Suppression, Ardent Defender, Seed of Corruption, Savage Roar, …
- **The endgame's vocabulary:**
  - "Mythic+". No registration by Blizzard was found, but it is WoW's feature name.
  - WoW's own affix set, word for word: Fortified, Tyrannical, Bolstering, Sanguine, Raging, Bursting,
    Volatile.
- **Fix:** rename them to original names. Only the names change: ids stay the same, so saves keep working.
  Common words that every RPG uses (Fireball, Blink, Charge, Cleave, Smite, Renew, Execute, Whirlwind) can stay.
  Pick an original name for the endgame mode and for the affixes.

## 3. MEDIUM — names from other games

- **Varric Blackhand** (boss, quests, an item): Varric is a Dragon Age character (BioWare/EA) and Blackhand a
  Warcraft character. Rename.
- **Thornmail** (an item): a League of Legends item (Riot). Rename.
- Low risk, worth a look while renaming:
  - The **Death Knight** enemies (a WoW class name; also an old fantasy term).
  - **Dawnbreaker** (a Skyrim artifact; also an ordinary word).
  - **Starfall** (a WoW druid spell).

## 4. MEDIUM — the Certainity packs (likely AI-made, provenance unstated)

- What the packs are:
  - Greenvale Meadows, Gloomvault Crypt, Mirefen Bog, Sylvanreach Grove and Blossom Shrine, by
    certainity.itch.io, at $1 each.
  - The seller lists about 40 packs plus unrelated apps.
  - The store makes no statement about AI. The painted rendering reads as AI-assisted.
- The license allows commercial use. The risks:
  - Nobody can own a copyright in AI-generated pieces, so anyone could copy those parts of the game.
  - If the seller's art were copied from someone else, a takedown could reach the game.
  - Some stores (Steam) ask for AI disclosure.
- **Fix:** keep the receipts. Replacing these pieces over time with art from the other, verified sellers or
  with art drawn in code would remove the risk.

## 5. LOW — credits

- CREDITS_AND_LICENSES.md was out of date: it said the CraftPix and Certainity packs did not ship, but they do.
- The game showed no credits anywhere.
- **Fixed:** the file now lists every shipped pack, and the Settings panel has an "Art credits" section.
  Credit is optional under every license.

## 6. Names of the game and the site

- **Sigilfall:** quick web searches found no game of that name. The nearest are *Sigils of Nightfall*
  (Steam) and *Wandfall*.
- **GlitchBound:** no clash found. The nearest marks are GLITCHBIT (US reg. 4439122, game software) and the
  game *Glitchbuster*.
- These were web searches, **not a trademark clearance**. Before spending on the brand, search the USPTO,
  EUIPO and WIPO Global Brand Database in classes 9 and 41, and consider registering GlitchBound.
- **Riftbound** (Riot's card game) was renamed earlier, and the old story's "Rift" is kept out of player text
  by a test (`sigilfall-words`).

## 7. Monetization basics (site-wide)

- **Ads:**
  - AdSense is off right now (`VITE_ADS_ENABLED`).
  - The privacy page promises that EU, UK and Swiss visitors are asked for consent first. Before switching
    ads on, turn on Google's certified consent message (AdSense › Privacy & messaging) for those regions.
- **Selling anything** (items, premium, a paid tier) needs:
  - terms of sale;
  - the EU right of withdrawal for digital content (and the waiver flow);
  - VAT (EU OSS);
  - a payment provider's rules;
  - a refund policy.
- **Age:** Crass Act is marked 18+. If children may play, ads and data rules get stricter (COPPA, GDPR-K).
- **Discord Activity:** Discord's developer terms apply to anything sold inside it.

## 8. Checked and clear

- **Code libraries:** react, react-dom, three and @discord/embedded-app-sdk with their dependencies are MIT
  or Unlicense. The fonts (Bricolage Grotesque, Space Mono) are OFL 1.1. All allow commercial use.
- **Where's the Ball? photos:** all 144 are CC0 (128) or public domain (16) from Wikimedia Commons, with the
  source and author credited in the game.
- **Made in code for the game:** Sigilfall's heroes, monsters, bosses, icons, interface, sound and music.
- **The other verified sellers:** Royal Keep (bubbabba) and Magic Spells VFX (Willosuna). Their store pages
  exist, allow commercial use and say "No generative AI was used".
- **The castle interior pack** is reference only; none of its files ship.
