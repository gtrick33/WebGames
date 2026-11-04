# Sigilfall's game masters

Admin › Sigilfall › Players. Admins only (`requireAdmin`); everything done here goes in the change log.

## What it sees

Every signed-in player with a save on the server: the list comes from `game_saves` (`glitchbound.sigilfall`), read with
`json_extract` so the Worker never has to parse thousands of saves. A player's page reads their whole save with the game's
own `validateCharacter`, so what it shows is what the game would load: level, experience, Paragon, gold, shards, marks,
potions, difficulty, Riftstone, time played, gear, bag, talents, skills, quests, dungeon clears, bosses, lands, mounts,
gifts and looks. The Ring's standings and the Vigil's nights sync now too (`syncKeys.ts`), so they show here and follow the
player between devices.

**Guests can't be seen.** Their heroes stay on their device, as the Privacy page promises. They appear once they sign in.

## How it acts

The admin files an **order** (`sigilfall_orders`). The server's copy of the save is not edited: a device that was playing
at the time would merge its own copy back over the change. Instead the player's own game collects waiting orders when it
opens and every 90 seconds while it's open (`engine.ts checkGm`), carries them out with the game's rules
(`progress/gm.ts`), saves, and reports back. So an order takes effect within about a minute and a half for someone playing,
and at their next visit otherwise. A waiting order can be called back. A hero remembers the ids of orders done on them
(`Character.gm`), so a lost report can't apply one twice.

To add a kind of order: a case in `checkOrder` (`server/sigilfallGm.ts`, the shape and the log line), a case in
`applyToHero` (`progress/gm.ts`, the effect, checking its input again), a line in `orderToast` if the player should be told,
and a control in `pages/admin/SigilfallPlayers.tsx`.

## Deleted heroes

When a save reaches the server without a hero the stored copy had, that hero's last copy goes into `sigilfall_graves` for
120 days (heroes under level 2 aren't kept). "Bring back" files a `restore` order, which needs a free slot on the player's
side; if there's none, the order comes back saying so.

## What it can't do

- Nothing happens instantly: there's no live connection to a player's game, so there's no teleporting or kicking.
- A player can't be reached in co-op or the Ring beyond the same next check.
- It doesn't stop a determined cheater: the game runs on the player's device, and the save is theirs to change.
