# Act I quests against the Prologue's standard (piece 4 of NINE_PLAN.md)

Act I is Brackenridge, Thornvale and the Amberfield: 36 quests in these three lands' files, 15 of them with no step
but walking somewhere or talking to someone (the plan's count of 13 left out two that have a keepsake). Each of the
15 was decided. No quest was removed or merged, so no save needed a migration: quest ids, items and save fields are
as they were, and the save table only grew by three keepsakes.

## The fifteen

| Quest | What it was | Decision | Why |
| --- | --- | --- | --- |
| `west-road` Fernstead's Candles | talk to Hollis | kept | the road into a new land: the walk is the land's first fights |
| `the-widows-song` | ask Mother Alsa | kept | thirty seconds in the village between two fights at the barrows; it carries the song the Grey Lady's fight turns on |
| `tusker-gully` | find the gully | kept | the middle of a three-part hunt (hides, the gully, the boar): it finds Grandad Tanner's arrow, and the boar is the next step |
| `appleby-apples` Cider Apples | walk to the orchard | **given something to do** | kobolds stood in the orchard and nothing asked the hero to deal with them. Now: pick the apples (the Applebys' note is found here), then clear three kobolds out so the family can come home. A line of ending added |
| `south-road` | talk to Reeve Aldous | kept | the road into a new land |
| `kettle-farm` The Burnt Farm | walk to the farm | **given something to do** | two Red Caps stood at the farm. Now they have come back for what their dead man carries: reach the farm, drive them off, and the gang's orders are won from them, not picked up |
| `thieves-cant` | have Nyx read the orders | kept | the act's hinge: who is paying the gang. A walk across the village, and it is where Nyx joins the story |
| `tobins-fields` | look at Tobin's farm | kept | the opening of Tobin's story (pelts, then Old Greymane), which now turns: see below |
| `tobins-letter` | carry a letter to Hanna | kept | a village errand, by design the one quest in Millbrook with no blood in it |
| `refugees-on-the-road` | talk to Marshal Dunmore | kept | the road into a new land |
| `the-broken-caravan` | find the caravan | kept | the next quest is the fight it sets up (the outriders on the roads) |
| `the-clan-stones` | go to the stones in peace | kept | going unarmed is the point; the memory in the oldest stone is the land's turn |
| `hearth-the-shrine` | look at the shrine | kept | the quiet beat after three battles in a row: the sigil is gone |
| `orders-from-the-north` | bring the orders to Old Gaius | kept | a walk across the town; it could be folded into the shrine, but that removes a quest id for a few seconds saved. Left for the owner to say |
| `ashby-farm` | look for Garrick | kept | the opening of Tess's story (the pride, then Goldmane), which now turns: see below |

## A side story with a turn in each land

All three were a hunt in three parts that ended with the beast dead and a reward. Each now ends with something found
on the beast that changes what the hunt was. Each is a keepsake in the Journal, a new ending, and a new line from
the giver afterwards. Nothing new stands in the world: each turn is about what already happened.

- **Thornvale, Tobin's wolves** (`hunt-old-greymane`). Found in the den: *A Bone Whistle on a Red Cord*, a drover's
  whistle on the cord the Gallows Gang's men wear, among butcher's scraps no wolf killed. The wolves were fed and
  called down onto the farms that would not pay the rope tax. The Kettles got fire; Tobin got wolves. He takes it to
  the Reeve.
- **Brackenridge, Pip Tanner's boar** (`old-rustback`). Found in the hide: *Barrow-Bronze Arrowheads*. One arrow in
  Old Rustback was Grandad Tanner's; the other ten are the bronze the barrows' dead are buried with, in fresh wounds.
  The gully lies between the barrows and Fernstead, and the old boar had been meeting the dead every night. Pip sews
  the bronze into the jerkin's collar.
- **The Amberfield, Tess's lion** (`hunt-goldmane`). Found under the mane: *A Gilt Collar* with Hearthstead's
  hearth-mark. The gate guard raised him from a cub, and when the refugees came and there was no meat, somebody let
  him out of the gate. He went no further than the herds he could smell. Tess buries the collar by the gate.

Names made here (checked against LEGAL_REVIEW.md's rules: plain descriptions, none from another game): "A Bone
Whistle on a Red Cord", "Barrow-Bronze Arrowheads", "A Gilt Collar".

## What was checked, and what was not

See the pull request.
