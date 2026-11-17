/**
 * The Ring in 2v2 and 3v3, after the owner's notes of 2026-11-13: "can we go over every single class for balancing,
 * currently it feels like some classes are stronger than others in 1v1, 2v2 and 3v3 ... increase the healing a tad bit
 * more for the healers in the 2v2/3v3 and probably increase the dmg of the dot warlock spec ... keep in mind that when
 * players play, they line of sight behind pillars, sometimes they hide".
 *
 * How it was done: the computer played every ready-made setup (sixteen, two a class) against every other in 1v1, and
 * 6,000 random teams in each of 2v2 and 3v3 (no class twice on a side; most teams bring a healer), with sharp players
 * hiding behind stone when hurt by a caster (arena/bot.ts, pillar play). Each setup's own abilities were then scaled
 * until its wins over the three formats together came to about half (a healer's: about 55% in 2v2 and 3v3, since a
 * person heals less well than the computer does). What changed and what it measured afterwards, in % of matches won
 * (1v1 / 2v2 / 3v3):
 *
 *   Hexer (the curse warlock)  32 / 35 / 36  ->  60 / 45 / 42   curses 40% stronger, Dread Gaze 2 s -> 1.5 s
 *   Doomcaller                 68 / 62 / 58  ->  50 / 52 / 53   Gloom Bolt and Ruin 20% weaker
 *   Trapper                    47 / 34 / 34  ->  67 / 41 / 40   Serpent Volley almost twice as strong, trap combo x3 -> x1.8
 *   Longbow                    65 / 58 / 58  ->  53 / 46 / 50
 *   Hound                      47 / 37 / 38  ->  61 / 44 / 44   Rending Cut and Hock Cut almost twice as strong
 *   Reaper                     51 / 60 / 70  ->  41 / 48 / 60   Festering Gash cuts healing 35% (was half), x1.25 on the stunned
 *   Bloodsworn                 67 / 45 / 46  ->  60 / 42 / 45   drinks far less of its blows, deals 0.9 (was 0.84)
 *   healing in 2v2 / 3v3       +20% / +35%   ->  +30% / +45%     (the priest's Knit Wounds 12% less: it led by far)
 *
 * The computer is not a person, so this guards against a change that tips a class far over, no more. (Healers in 1v1,
 * where they have nobody to heal, win a quarter of their matches: a healer's setup is for team fights.)
 *
 * When the talents became each class's own (2026-11-13, "please make them very unique"), every talent was measured
 * against the other two in its row, in 1v1 and in 2v2 (a healer's on its healer's build), on the same seeds, and tuned
 * until each row's three came within a few points of each other where they are meant to be used (a team talent, an
 * aura or Skypiercer, shows little in 1v1). Two changes outside the talents: the mage deals 0.72 of its numbers (was
 * 0.74; its new talents carry it further in a duel than in a team), and the priest's Knit Wounds heals 86 (was 95; its
 * healing build won 68% of 2v2s, against 60% for the paladin's). Classes, in % won (1v1 by
 * tests/sigilfall-ring-aim.test.ts, then 2v2 / 3v3 here), before -> after:
 *
 *   warrior 42/46/54 -> 46/49/54   mage    50/45/45 -> 60/46/44   ranger  50/42/45 -> 43/45/47   paladin     50/57/49 -> 53/57/52
 *   priest  49/61/61 -> 42/57/54   warlock 52/45/48 -> 49/44/47   druid   49/54/52 -> 49/53/51   gloamknight 58/44/44 -> 57/44/50
 *
 * Then each ready-made setup on its own, with the new talents: every one of the sixteen played every other in 1v1 and in
 * random 2v2 and 3v3 teams, and each setup's own abilities (never one it shares with its class's other setup) were
 * scaled until its wins over the three came to about half, a healer's about 55% in teams (a healer in 1v1, with
 * nobody to heal, still loses most). The Reaper's Festering Gash and Hurled Maul 15% weaker; the Lifegiver's Knit
 * Wounds, Dawnlight and Ward of Faith 7-15% weaker, the Oathkeeper's Dawn's Touch 10%; the Hound's bleed and Hock
 * Cut, the Rime's spear and shards, the Trapper's Hobbling Shot and Serpent Volley, the Zealot's Oath Blow and Wave
 * of Dawn, the Doomcaller's bolt and Ruin and the Bloodsworn's blows 6-18% stronger, the Curse-speaker's 6% weaker.
 * Each setup's 1v1 / 2v2 / 3v3, and the mean of the three, after:
 *
 *   Reaper      46/53/61 54   Hound     52/49/47 49   Pyre         63/48/47 53   Rime        66/42/45 51
 *   Longbow     57/41/47 48   Trapper   60/47/49 52   Oathkeeper   24/60/53 46   Zealot      57/46/48 50
 *   Lifegiver   17/59/54 43   Curse-sp. 45/55/51 50   Hexer        67/44/43 51   Doomcaller  49/47/50 49
 *   Grovekeeper 25/55/57 45   Starseer  62/48/42 51   Bloodsworn   59/45/44 49   Dreadbinder 53/44/55 51
 *
 * Then the Gloamknight became a death knight or a blade in the dark, and the ashbound dead the warlock's (2026-11-14, a
 * friend of the owner's: "typical dk and a shadow rogue, leave summons for a necro warlock spec"): the Dreadbinder gave
 * way to the Nightblade, who hides, and the Doomcaller to the Gravecaller, who raises the dead. Their numbers were set
 * the same way, over 12 seeds of every 1v1 and 900 random teams of each size. Each new setup, and the one beside it:
 *
 *   Nightblade  44/50/60 51   Gravecaller 71/46/44 54   Bloodsworn   69/43/42 51   Hexer       67/43/44 51
 *
 * The owner then asked for the Gravecaller to win fewer duels. What carried it there was the slow on its dead's claws
 * (without it: 37/40/38); at 10%, not 20%, it came to 61/52/47 53.
 *
 * Then holds stopped breaking on hurt (a daze still does), the mage's Frost Snare and Hoar Grip stopped wearing off with
 * use, Shatter hit 15% harder, the Hexer's curses 5% harder, the Nightblade slipped back into the shroud by itself and
 * its Nightknife hit 15% harder, and the Gravecaller's dead were softened (claws 9, Grave Hunger 45%), all as the owner
 * asked. The same measure, after:
 *
 *   Rime        65/48/55 56   Hexer       67/48/42 52   Gravecaller 62/48/48 53   Nightblade  60/55/65 60
 *   Bloodsworn  64/38/36 46   (the Bloodsworn, who fights at arm's length, lost most to fears and roots that hold)
 *
 * Then every ready-made setup got a super of its own, a class's second (abilities.ts SUPERS2) going to the setup the
 * first didn't fit: Run Them Down (Hound), Winter's Grasp (Rime), Thicket of Snares (Trapper), Voidburst
 * (Curse-speaker), Dawn's Covenant (Oathkeeper), Grave Legion (Gravecaller), Heart of the Grove (Grovekeeper) and
 * Night's Ruin (Nightblade). The first measure had the Hound at 77/58/54 and the Grovekeeper at 27/74/75 (a whole side
 * healed and guarded at once); both were brought down, and the Curse-speaker, who had leaned on Dawnward to live
 * through a duel, was given the void's wrap. After:
 *
 *   Reaper      50/52/59 54   Hound     66/48/52 55   Pyre         56/44/43 48   Rime        56/43/48 49
 *   Longbow     51/42/49 47   Trapper   55/45/43 48   Oathkeeper   18/59/61 46   Zealot      53/51/48 51
 *   Lifegiver   15/61/48 41   Curse-sp. 48/50/51 50   Hexer        74/48/42 55   Gravecaller 63/42/44 50
 *   Grovekeeper 23/58/57 46   Starseer  53/39/44 45   Bloodsworn   63/39/39 47   Nightblade  57/55/63 58
 *
 * Then each class's super talent came to work on whichever super its hero carries (they had only touched the first),
 * and the talents that work through the Swift Step came to work through the Unbinding Charm too. The Rime and the
 * Starseer, whose ready-made talents had done nothing for their own supers, gained most; the Starseer's Grove's Bloom
 * was cut, and the Pyre's and the Curse-speaker's own abilities given about 8%. After (1v1 / 2v2 / 3v3):
 *
 *   Pyre 56/46/44   Rime 58/44/47   Curse-speaker 53/49/51   Starseer 55/42/40   Gravecaller 60/38/39
 *
 * Then every bar took a fifth ability, mana came back at 5 a second where it had been 1.5, and Mana Skin was paid at 1
 * mana for every 2 it takes where it had been 1 for every 6 (2026-11-15, the owner: "one more spell slot for each class
 * and spec", "mana seems to be running out a bit too fast for certain casters like mages and healers", "test balancing
 * changes and balance classes based on the new change"). At 1.5 the computer's Rime was out of mana a fifth of every
 * fight and under a quarter of it for half, the Lifegiver dry an eighth, the Pyre, the Gravecaller and the Grovekeeper
 * near a tenth; at 5 none of them is ever dry (the Gravecaller's Hollow Pact still empties it on purpose). With mana to
 * spare, Mana Skin was worth far more than the rest of its row (a Pyre given it won 59%, 45% with its own Rewind; the
 * Rime 56% with it, 50% with Rewind): at 1 for 2 it is back within three points of them. Brimming Power and Hollow Pact
 * stayed within three of theirs.
 *
 * Each setup's fifth was measured against the class's other choices. A warlock's Spell Seal lifts whichever setup carries
 * it about twelve points (it kicks the other side's healer); on the Hexer it took the class to 64% of its duels, on the
 * Gravecaller it left them where they were, so the Gravecaller carries it and the Hexer drinks souls. Deep Mending on
 * the Curse-speaker made it a healer to the team-making above and it lost most of its team fights; its duels, which the
 * new kicks on every side had cut (the Starseer's Thornsnap: 71% of theirs won, then 21%), came back with a quicker
 * Bright Rebuke instead. Then each setup's own numbers were tuned as before, over 24 seeds of every 1v1 and 3,000 random
 * teams of each size, the same seeds before and after. Each setup, 1v1 / 2v2 / 3v3 and the mean, before -> after:
 *
 *   Reaper      48/50/61 53 -> 49/53/56 53   Festering Gash 6% weaker
 *   Hound       69/52/48 56 -> 65/47/43 52   Rending Cut 13%, Hock Cut 12% weaker
 *   Pyre        57/44/42 48 -> 55/47/45 49   Ember Lash's Kindling 25%, Flashburn 15%, Great Pyre 9% stronger (not
 *                                            Ember Lash's own hit: a mage casting all the time stays under a sixth again)
 *   Rime        58/45/46 50 -> 56/49/45 50
 *   Longbow     55/45/46 49 -> 53/44/50 49   Long Draw and Adder's Kiss 4% stronger
 *   Trapper     58/42/43 48 -> 57/45/41 48   Hobbling Shot 29%, Serpent Volley 37% stronger
 *   Oathkeeper  15/61/62 46 -> 16/58/57 44
 *   Zealot      64/44/47 52 -> 64/46/43 51   Oath Blow 3% weaker
 *   Lifegiver   18/59/48 42 -> 28/59/53 47
 *   Curse-sp.   49/47/56 51 -> 50/53/60 54   Word of Decay 14% stronger, Bright Rebuke cast 1 s -> 0.85 s
 *   Hexer       65/44/40 50 -> 60/41/38 46   Wither and Barbed Curse 12%, Soul Drink 15% stronger
 *   Gravecaller 63/43/40 49 -> 61/49/54 55   Gloom Bolt 26% weaker, Grave Hunger 45% -> 40%
 *   Grovekeeper 14/58/56 43 -> 20/56/56 44   its heals 3% stronger
 *   Starseer    54/41/43 46 -> 53/47/51 50   Starlash 5% weaker
 *   Bloodsworn  64/42/42 49 -> 65/44/41 50   Gloam Cleave and Night Reaping 3-4% stronger
 *   Nightblade  50/57/68 58 -> 48/44/60 51   Nightknife 11% weaker
 *
 * Classes, the same way (1v1 by tests/sigilfall-ring-aim.test.ts, healers' setups left out, then 2v2 / 3v3 here):
 *
 *   warrior 50/51/54 -> 53/50/50   mage    55/44/44 -> 46/48/45   ranger  48/44/45 -> 49/44/46   paladin     60/55/57 -> 61/54/52
 *   priest  38/55/51 -> 39/57/55   warlock 57/43/40 -> 56/45/46   druid   41/53/52 -> 43/53/54   gloamknight 50/50/55 -> 53/44/50
 *
 * Then the mana went altogether (2026-11-15, the owner: "remove the mana completely"): nothing costs anything, and an
 * ability waits only on its cooldown. At 5 a second nobody had been running dry, so little changed. The three talents
 * that ran on it run on health: Brimming Power (spells 12% harder over 80% health), Arcane Skin in Mana Skin's place
 * (20% less damage taken over half health) and Hollow Pact (a quarter of one's health back under 35%). Each is within
 * three points of the rest of its row (Rime 52 with Arcane Skin, 49 and 50 with the others; Pyre 47 with Brimming
 * Power, 48 and 49; Gravecaller 54 with Hollow Pact, 53 and 54). Over the same 24 seeds and 3,000 teams, no setup's
 * mean moved more than two points (Trapper 48 -> 47, Gravecaller 55 -> 54, Rime 50 -> 51, Curse-speaker 54 -> 55,
 * Nightblade 51 -> 50, Hexer, Reaper and Oathkeeper unchanged), so no number was tuned for it.
 *
 * Then the Swift Step went (2026-11-15, the owner: "remove swift step from all classes and add the same spell to all
 * classes as well - trinket ... with 45s cooldown", "add them in the spells list, dont replace the swift step", and "no
 * need to run balancing script as this affects all classes"). The Unbinding Trinket is in every class's list, and no
 * ready-made setup carries it. Without the step, the druid's duels (healers' left out) fell to 33% in
 * tests/sigilfall-ring-aim.test.ts, under its floor of 35%, so Starlash is 6% stronger (79 -> 84) and nothing else
 * changed. Measured once over the usual seeds, without it: Hound 73% and Trapper 72% of their duels, the Longbow 46 on
 * the mean; worth a look once people have played it.
 *
 * Then the red circles became avoidable by anyone already walking (2026-11-16, the owner: "shrink them so they are
 * avoidable" for "0.0s reaction time", and "if the radius change is bigger than 25% just slow down the projectile"),
 * and Momentum went ("i dont like the momentum idea"). What leaned on circles landing lost ground (Trapper 55 -> 43,
 * Curse-speaker 54 -> 47, Pyre 52 -> 46 on the mean) and what chased them gained (Hound 56 -> 62); the priest's and
 * the druid's duels fell to 32% and 33%. Over 24 seeds of every 1v1 and 3,000 teams of each size: Cinder Comet 240 ->
 * 260, Great Pyre 310 -> 345, Flashburn 115 -> 121; Thornstorm 130 -> 165, Starlash 84 -> 97; Voidburst 150 -> 176
 * (its healing cut 50% -> 40%: it carried the Curse-speaker's team fights), Bright Rebuke 58 -> 71, Word of Decay
 * 151 -> 157; Thicket of Snares and Serpent Volley about 10-15% stronger; Wither and Barbed Curse 5% stronger; the
 * Hound's Rending Cut 174 -> 146 and Hock Cut 22 -> 20; the Zealot's Oath Blow 32 -> 28 and Wave of Dawn 59 -> 62;
 * Gloam Cleave 35 -> 34. Each setup, 1v1 / 2v2 / 3v3 and the mean, after:
 *
 *   Reaper      56/52/55 54   Hound     72/50/45 56   Pyre         51/48/45 48   Rime        54/45/45 48
 *   Longbow     54/42/47 48   Trapper   58/45/46 50   Oathkeeper   16/57/61 45   Zealot      53/41/37 44
 *   Lifegiver   25/58/49 44   Curse-sp. 51/60/62 58   Hexer        66/40/38 48   Gravecaller 57/51/54 54
 *   Grovekeeper 23/56/56 45   Starseer  47/52/54 51   Bloodsworn   68/45/41 52   Nightblade  45/42/56 47
 *
 * Classes (1v1 healers' setups left out, then 2v2 / 3v3): warrior 61/51/50, mage 43/46/45, ranger 51/43/46, paladin
 * 52/52/53, priest 41/59/54, warlock 58/46/46, druid 39/55/55, gloamknight 55/43/48. Worth a look once people have
 * played it: the Curse-speaker in team fights, and the Zealot in 3v3.
 *
 * Then the Ring was made over (2026-11-16, the owner: "fixed spells per playstyle, only talents need to be changed",
 * "combos to be done with your basic spell or even ur ult", "remove the gloam and leave the damp only", "make the game
 * balanced, and also keep the same pace"): each playstyle is four abilities of its own and a super, with points to
 * build and spend and boons that light an ability up (arena/abilities.ts, arena/talents.ts). Before it, on the same
 * measure (12 seeds of every 1v1, 1,000 teams of each size), a match took 54 s in 1v1 and 71 s in 2v2 and in 3v3.
 *
 * The new kits were first far apart (the Pyre won 75% over the three formats, the Curse-speaker 72%, the Zealot 31%,
 * the Bloodsworn 36%), so each playstyle's own numbers were scaled round after round until its mean came to about
 * half: the Pyre's to 0.58 of the first draft, the Curse-speaker's 0.65, the Hexer's 0.73, the Starseer's 0.70, the
 * Trapper's 0.75, the Longbow's 0.79, the Reaper's 0.85, the Rime's 0.94, the Hound's 0.87, the Zealot's 1.18, the
 * Bloodsworn's and the Nightblade's 1.06, and the three healers' heals 0.60 to 0.66. Then, since those rounds had left
 * team fights a tenth shorter than before, every ability's damage came down 8%.
 *
 * With the Gloam gone a healer's duel never ended: shields and the healing spheres didn't fade as healing does, so a
 * warded priest stood for the whole 150 seconds and a fighter walked from sphere to sphere. Now every shield, every
 * sphere and the sigil's healing fade with the rest (the sigil's might and speed don't), and healing is gone 115
 * seconds in (it stopped at three quarters while the Gloam was there to end a match). A healer alone also had too
 * little to hurt with (they won 4-17% of their duels, 13-36% before the makeover): Bright Rebuke is half again as strong, the
 * Grovekeeper has a blow of its own (Stinging Petals, half again as hard on the rooted) in place of the Starseer's
 * Moonburn, and the computer's healer stops healing as healing fades and brings them down instead (arena/bot.ts).
 *
 * Each playstyle after, 1v1 / 2v2 / 3v3 and the mean; a match takes 56 s in 1v1, 69 s in 2v2 and 64 s in 3v3:
 *
 *   Reaper      39/41/58 46   Hound     66/48/43 53   Pyre         47/48/49 48   Rime        51/46/51 49
 *   Longbow     47/48/51 48   Trapper   56/40/41 45   Oathkeeper   26/65/61 51   Zealot      49/45/40 45
 *   Lifegiver   27/62/52 47   Curse-sp. 63/44/46 51   Hexer        57/43/47 49   Gravecaller 64/48/47 53
 *   Grovekeeper 23/60/55 46   Starseer  69/43/42 51   Bloodsworn   61/42/47 50   Nightblade  55/49/56 53
 *
 * Worth a look once people have played it: who a playstyle meets still decides a duel between computers more than
 * it should (the Rime wins nearly every duel with a blade and one in five with a caster, as it did before the
 * makeover: 97% and 14% then), and the Oathkeeper in 2v2.
 *
 * Then the owner played it (2026-11-17, a priest and a mage against a priest and a warlock): "warlocks seem insanely
 * op, mages suck ... fire mage deals shit dmg now imo and it feels weak compared to warlock", "rime mage also feels
 * weak, the orb should follow the closest target and keep hitting them otherwise its always a miss, increase the radius
 * by 20%". Between computers the two mages had lost most duels with the three shadow casters (the Pyre won 17-33% of
 * them, the Rime 17-25%) while holding their own in teams. What changed:
 *
 *   Rimeglobe       goes after the nearest enemy at 0.9 of a walk (it drifted 14 a second the way it was thrown), reaches
 *                   41 (34), and lands 17 a second before the mage's share (19): it now lands every second it is out
 *   Pyre            Ember Lash 42 and 28 over 6 s (41, 27), Flashburn 60 (58), Flashover +70% (+60%), Cinder Comet 146 (138)
 *   Dread Gaze      every 10 s (8): both warlocks carry it
 *   Soul Drink      gives back 28 a half second (30)
 *   Gloomfire       +50% (+60%)
 *
 * The same measure after (12 seeds of every 1v1, 1,000 teams of each size); a match takes 56 s, 69 s and 62 s:
 *
 *   Reaper      39/45/57 47   Hound     68/49/43 53   Pyre         61/47/53 53   Rime        67/53/49 56
 *   Longbow     43/50/52 49   Trapper   57/43/42 47   Oathkeeper   25/64/61 50   Zealot      50/44/36 43
 *   Lifegiver   27/60/55 47   Curse-sp. 61/41/51 51   Hexer        53/37/45 45   Gravecaller 53/46/43 47
 *   Grovekeeper 18/62/53 44   Starseer  63/41/43 49   Bloodsworn   59/42/48 50   Nightblade  55/48/57 53
 *
 * And the owner's own fight, a damage playstyle with a healer beside it against each of the other twelve with the same
 * healer (a Lifegiver, then a Grovekeeper; ten seeds each), in % won and damage a second: the Pyre 69% and 55, the
 * Rime 48% and 54, the Hexer 38% and 49, the Gravecaller 42% and 54. Before the change, on six seeds with a Lifegiver:
 * the Pyre 58% and 48, the Rime 50% and 52, the Hexer 43% and 48, the Gravecaller 64% and 59. A Pyre given 12% in
 * place of these 5 won 73% of those and led every table, so it was given no more. The duels: the Pyre now wins 33%, 67%
 * and 42% against the Curse-speaker, the Hexer and the Gravecaller, the Rime 17%, 50% and 33%.
 *
 * Worth a look once people have played this: the spread is wider than it was (43-56, 45-53 before), with both mages in
 * the upper half and the Hexer low in 2v2 (37%); the Zealot and the teammate tables (arena/teammates.ts) were not
 * touched or measured again.
 *
 * The same day the owner asked for four more things: "1v1 if 2 rogue gloamknights fight theyre always invisible", "in
 * 1v1 healers shouldnt be allowed", "in 2v2 if both dps die, the healers take ages to kill each other", and "in 2v2 i
 * feel like healers are way too strong, if i go as double dps i still need to have slight chance". What they are is in
 * tests/sigilfall-ring-fair.test.ts; what they measured, over 400 random 2v2s of each kind between computers:
 *
 *                                                    before              after
 *   two damage dealers against a healer's side       win 17.5%           win 34%     (healing in 2v2: 1.3 -> 1 of what is written)
 *   two healers left alone, until one falls          32 s (longest 63)   10 s (longest 14)   (sudden death)
 *   a healer's side against a healer's side          104 s               93 s
 *   two damage dealers against two                   37 s                37 s
 *
 * At 1.1 of what is written two damage dealers won 27%, at 0.95 they won 39%. And every playstyle again (12 seeds of
 * every 1v1, 1,000 teams of each size, 60% of the 2v2 teams with a healer); a match takes 53 s, 66 s and 62 s:
 *
 *   Reaper      39/47/57 48   Hound     68/47/43 53   Pyre         61/57/53 57   Rime        67/59/49 58
 *   Longbow     43/49/52 48   Trapper   57/44/42 48   Oathkeeper    -/59/61      Zealot      50/48/36 45
 *   Lifegiver    -/52/55      Curse-sp. 61/40/51 51   Hexer        53/42/45 46   Gravecaller 53/48/43 48
 *   Grovekeeper  -/49/53      Starseer  63/52/43 53   Bloodsworn   59/46/48 51   Nightblade  55/53/57 55
 *
 * (The healers' 2v2 before: 64, 60 and 62.) No healer fights a 1v1 any more, and the 1v1 column above still counts
 * every damage playstyle's duels with the three of them, which they nearly always won. Among themselves the thirteen
 * win: Reaper 31, Hound 60, Pyre 56, Rime 66, Longbow 36, Trapper 57, Zealot 51, Curse-speaker 52, Hexer 42,
 * Gravecaller 46, Starseer 57, Bloodsworn 51, Nightblade 46.
 *
 * Worth a look: with less healing in 2v2 the two mages lead it between computers (57% and 59%; nobody else is over
 * 53%), on top of what they were given earlier in the day, and a duel without healers shows the Reaper (31%) and the
 * Longbow (36%) behind and the Rime (66%) ahead by more than the old column did. None of that was tuned here. The
 * pairs table Random reads was measured again (arena/teammates.ts); the threes were not.
 *
 * Then the Nightblade's stun, which had never held (2026-11-17, the owner: "rogues still dont stun, the target keeps
 * moving ... increase atun from 1.5s to 2s make sure it actually stuns"). With its ready-made talents Dusk Ambush also
 * silences, and the silence took the stun's place as both landed (tests/sigilfall-ring-held.test.ts): against every
 * playstyle its stuns had lasted 0.03 to 0.16 of their 1.5 seconds. Both now stay on, and the stun is 2 seconds. That
 * alone took the Nightblade from 55/53/57 to 59/59/59, so its own blows came down about 4% (Nightknife 28 for 29,
 * Closing Cut 22 for 23, Dusk Ambush 38 for 40, Night's Ruin 102 for 107): 54/54/56 after, on the same measure. At 6%
 * less it was 56/52/54. Nobody else moved by more than two points.
 *
 * Then (2026-11-17, the owner): "for the rime mage, you can replace the frost snare with a ranged stun for 1.5s or a
 * kick and make the orb follow the target with 50% less speed", "fire mage and nightblade gloamknight seem weak still".
 * Frostclasp, a stun of 1.5 s from range, took the Frost Snare's place, and the globe goes at 0.45 of a walk (0.9). An
 * instant Frostclasp took the Rime to 85/74/62: every Frostfang in a stun is a Shatter, and a caster can be stunned
 * from across the ground. It was given a cast of 0.6 s and 18 s between uses, and the Rime's own blows came down by a
 * quarter (Rime Spear 41 for 54, Frostfang 29 for 38, the globe 13 a second for 17, Winter's Grasp 66 for 86). The Pyre
 * and the Nightblade were each first given 7%; the Pyre then won 64% of its 2v2s, and keeps about 3% (Ember Lash 43
 * and 29, Flashburn 62, Cinder Comet 150). The Nightblade keeps its 7% (Nightknife 30, Closing Cut 24, Dusk Ambush 40,
 * Night's Ruin 110). After, on the same measure; a match takes 54 s, 66 s and 64 s:
 *
 *   Pyre 60/58/53 57   Rime 59/48/51 53   Nightblade 63/59/59 60
 *
 * The owner finds the Pyre and the Nightblade weak where the computer finds them the strongest two: they were given
 * what the measure would bear and no more. The Rime wins 87% of its duels with a blade and 37% with a caster.
 *
 * Then the core talents (2026-11-17, the owner: "the chosen ones for every class are the best, the other 2 should be
 * just as good for every playstyle"). Each playstyle was played with each of its three core talents in turn, the rest
 * its ready-made ones: every duel with another damage playstyle (8 seeds) and 160 random 2v2s, a healer's in the 2v2s
 * alone. The mean of the two, in % won, before -> after (* the ready-made one):
 *
 *   Reaper        Red Mist* 44 -> 42   Butcher’s Tally 40 -> 43   Headsman 32 -> 38
 *   Longbow       Still Breath* 40 -> 42   Full Draw 24 -> 41   Long Shot 19 -> 43
 *   Lifegiver     Answered Prayer* 49 -> 53   Counted Prayers 69 -> 53   Brimming Grace 48 -> 53
 *   Grovekeeper   Bud and Bloom* 44 -> 48   Verdant Surge 32 -> 46   Sun and Moon 31 -> 45
 *   Hound         Mounting Ire* 54 -> 53   Blood Up 37 -> 56   Grudge 30 -> 52
 *   Trapper       Baited* 57 -> 58   Quiver of Quills 75 -> 60   Quarry 66 -> 60
 *   Curse-speaker Dire Portent* 43 -> 41   Litany 40 -> 38   Feast of Shadows 35 -> 43
 *   Starseer      Falling Star* 58 -> 58   Fourth Star 52 -> 57   Wandering Light 50 -> 58
 *   Pyre          Cinderheart* 63 -> 64   Banked Embers 50 -> 60   Wildfire 28 -> 60
 *   Oathkeeper    Oathsworn* 48 -> 46   Shared Dawn 26 -> 46   Aura of Wrath 28 -> 47
 *   Hexer         Ripening* 45 -> 45   Gathering Dark 33 -> 45   Pit Imp 27 -> 48
 *   Bloodsworn    Blood Tithe* 49 -> 47   Hungering Edge 68 -> 52   Blood Price 38 -> 47
 *   Rime          Hoarfrost* 56 -> 55   Rimeshards 67 -> 59   Deep Winter 71 -> 54
 *   Zealot        Mounting Ardor* 46 -> 48   Dawnfire 54 -> 52   Verdict of Light 37 -> 52
 *   Gravecaller   Grave Chill* 49 -> 48   Third Grave 26 -> 50   Ashburst 45 -> 44
 *   Nightblade    Second Dusk 48 -> 53   Bloodied Edge* 58 -> 54   Night’s Embrace 44 -> 51
 *
 * The other two were brought to the ready-made one, up or down, by their own numbers (arena/talents.ts has them). Four
 * needed more than a number: Wildfire also makes 15% more hits critical, Aura of Wrath reaches the whole side wherever
 * it stands (a healer stands well back, and it did nothing), Third Grave's dead hit twice as hard and come sooner, and
 * Deep Winter no longer keeps the globe longer. Two ready-made ones moved: Oathsworn 30% a point (40%), Mounting Ardor
 * 30% (25%). Every playstyle after, on the usual measure: nobody moved by more than three points but the Oathkeeper in
 * 2v2 (52%, 60% before).
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
type Spec = { cls: ClassId; p: number; heal: boolean };
const heals = (bar: string[]): boolean => bar.some((id) => ABILITIES[id]?.role === 'heal' && ABILITIES[id]?.aim === 'friend');
const SPECS: Spec[] = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((pr, p) => ({ cls, p, heal: heals(pr.bar) })));

function shares(size: 2 | 3, games: number): Record<string, number> {
  let s = 777 + size;
  const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  const team = (): Spec[] => {
    const out: Spec[] = [];
    if (rand() < (size === 3 ? 0.8 : 0.6)) {
      const hs = SPECS.filter((x) => x.heal);
      out.push(hs[Math.floor(rand() * hs.length)]!);
    }
    while (out.length < size) {
      const pool = SPECS.filter((x) => !x.heal && !out.some((o) => o.cls === x.cls));
      out.push(pool[Math.floor(rand() * pool.length)]!);
    }
    return out;
  };
  const won: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (let g = 1; g <= games; g++) {
    const sides = [team(), team()];
    const fighters: FighterSetup[] = sides.flatMap((list, t) => list.map((x, i) => ({ team: t as 0 | 1, cls: x.cls, name: `${x.cls}${t}${i}`, bar: PRESETS[x.cls][x.p]!.bar, talents: PRESETS[x.cls][x.p]!.talents })));
    const m = new Match({ seed: g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
    const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
    const skill = [0.6, 0.9, 0.75][g % 3]!;
    for (let i = 0; i < 30 * 400 && m.phase !== 'over'; i++) {
      const moves: Record<number, MoveInput> = {};
      for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, skill, STEP);
      m.step(STEP, moves);
      m.events.length = 0;
    }
    sides.forEach((list, t) => {
      for (const c of new Set(list.map((x) => x.cls))) {
        played[c] = (played[c] ?? 0) + 1;
        won[c] = (won[c] ?? 0) + (m.winner === null ? 0.5 : m.winner === t ? 1 : 0);
      }
    });
  }
  return Object.fromEntries(Object.keys(played).map((c) => [c, won[c]! / played[c]!]));
}

describe('The Ring: no class far above or below the rest in team fights', () => {
  for (const size of [2, 3] as const) {
    it(`${size}v${size}: each class wins between 38% and 64% when the computer plays random teams`, () => {
      const got = shares(size, 900);
      // (the warrior is set by players' word over this measure, the owner, 2026-11-17: "i dont think ur balancing test
      // is very relevant here as this is player feedback". At 0.82 and 1240 health he comes out at 27% in 2v2 here.)
      for (const c of CLASS_IDS) {
        if (c === 'warrior') continue;
        expect(got[c], `${c} ${Math.round(got[c]! * 100)}%`).toBeGreaterThan(0.38);
        expect(got[c], `${c} ${Math.round(got[c]! * 100)}%`).toBeLessThan(0.64);
      }
    }, 120_000);
  }
});
