# The Vigil after the owner played it on his phone (2026-11-26)

All taken in headless Chromium with this Mac's GPU, on the dev server. "Before" is `pre-release` at `e31ccdc9` (#375 and
#377 merged), drawn by the same scripts.

| Folder | What it shows | Made by |
| --- | --- | --- |
| `after/<class>.jpg`, `before/<class>.jpg` | Every spell of the class, a row each, with its evolution beside it when it has one, at a phone's size on its side (844×390, cropped round the hero) | `node scripts/sigilfall-vigil-spellsheet.mjs --out … [--root <checkout>] --gpu` |
| `phone-after/`, `phone-before/` | An iPhone's size on its side (932×430, touch): the lobby as in the owner's picture (the Mage, Fireball shown, Greyfen Marsh chosen), the week's watch chosen, a night, and (after only) each new event and a chest out of sight and in sight; `check.json` has what the script measured | `node scripts/sigilfall-vigil-phonecheck.mjs --out … [--root <checkout>] --gpu` |

How the spell sheets were made: the spell alone, at its top level, in a quiet night with a ring of the Host walking in
slowly; a dash spell set off with a dash, a pulse with the hero hurt, a ward broken by a blow; the picture taken a set
time after (by kind) so the spell has gone off. Each is one moment, so a spell that is mostly its impact (a bolt) shows
mostly its impact.

What to look at:

- **The ranger** (the owner's example). Before, Multishot was a green orb, Rain of Arrows green orbs falling, and Blast
  Arrow the mage's falling star in orange. After: arrows in flight, a volley of arrows falling, and Blast Arrow a volley
  coming down on its mark.
- **What flies is smaller.** The mage's Arcane Bolts and Ball Lightning, and the ranger's hawks, are about half the size
  they were. What lands (novas, strikes, bursts) is drawn a little past its reach.
- **Evolutions** look different from their spell: other colors, another particle, and a halo, light from above and motes
  about it. Some differ a lot (Absolute Zero, Phoenix Bolt, Ruin Unbound, Quarry's End), some less (an evolved companion
  is the same beast with a halo; an evolved lance is a wider beam with light along it).

What the phone check did and did not show:

- **The lobby's overlap** (the spell's words running into "Codex: 0 of 4" under them) did not happen in either picture
  at 932×430: on this device there is no campaign hero, so the Wardrobe picker that pushed the column down in the
  owner's picture is not there. The fix is in the layout (the column starts at its top and scrolls, and the words are
  one short line plus the evolution's name), but it was **not seen fixed in a picture with a Wardrobe hero**.
- **The long press.** The game already asked for no text selection in its styles, before as after (the check found
  `user-select: none` on the clock and the lobby's words in both), and the owner still got Safari's "Copy Link with
  Highlight". So the page now also cancels any selection that would begin in the Vigil, drops one that forms, and keeps
  the press menu shut (`ui/noSelect.ts`, with a unit test). Chromium can't do an iPhone's long press, so this was
  **not checked on an iPhone**.
