# Sigilfall — how the story is written

The owner (2026-11-14): "it seems ai written i want clear story clear dialogue straight forward story".

Every line a player reads (quest text, rewards, what people say, barks in fights, scene lines, vision captions)
follows these rules.

## The rules

1. **Say what happened and what to do.** A quest's text answers: who asks, what is wrong, what the hero does,
   and where. Two to four short sentences.
2. **One idea per sentence.** Short sentences. No sentence carries a second thought after a colon or a dash.
3. **No punchlines.** Nobody ends a line on a joke, a twist or a wry aside ("I hate clever.", "They're very
   consistent.", "One of those I'll believe."). People can be warm, tired, scared or angry; they say so plainly.
4. **No aphorisms.** No "X, not Y" turns ("He counts our walls, not our swords."), no rule-of-three lists
   for effect, no lines that sound like a motto.
5. **No riddles.** If a character knows something, they say it. A mystery is something nobody in the scene
   knows yet, not something the writing hides.
6. **Name things the same way every time.** A sigil is a sigil (a piece of the broken Crown). A place is called
   by its map name. A person by the name the HUD shows.
7. **The story agrees with itself.** A reward never contradicts the next quest's text, and what someone says
   after a quest matches what the quest showed.
8. **Fight barks are orders or warnings.** "Hounds on the west road!", "Get it away from the gate!".
9. **American English**, typographic apostrophes and quotes (’ “ ”), as the rest of the game.

## Before and after

| Before | After |
| --- | --- |
| He counts our walls, not our swords. That’s a man planning a siege. | He’s counting our walls. He’s planning a siege. |
| The Host rides under clan feathers, and the clans think it’s us. Of course they do. It’s clever. I hate clever. | The Host’s riders wear clan feathers when they attack. Now the clans and the refugees blame each other. |
| Tell me what happened. Then tell me it won’t happen again. One of those I’ll believe. | It’s south-east of town. Find out what happened. |

## Every land knows why the hero is there

The owner again (2026-11-15): "dialogue is confusing as heck, i have no clue most of the time what they are saying,
what the story is, whats the purpose ... i cant relate to the heroes mostly hecause i have no clue whats happening".
So on top of the rules:

10. **Every pop-up stands alone.** A player who skims one line on a phone knows who is talking, what they want, what
    just happened and where to go next. Nothing leans on something said three hours ago.
11. **Every land and act opens with the stakes.** The first quest or scene says, in a sentence or two, how many
    sigils each side holds, what the Host wants with them and why this place matters.
12. **Companions say what they feel and want.** Elyra, Mara, Nyx, Cael and Orren are people the player should care
    about: they say plainly when they are scared, angry, guilty or glad, and why.
13. **Short.** A scene line is at most about 120 letters; quest text two to four short sentences.

## Voices: the same plain rules, each person their own

The rules above keep every line clear. Inside them, the people should not all sound alike: a player who covers the
name should still guess who is talking. A voice comes from **what a person notices and cares about** and from a
habit or two of speech, never from jokes, mottos or riddles (rules 3 to 5 still hold).

| Who | What they notice | How they talk | A line in their voice |
| --- | --- | --- | --- |
| **Mara Venn** | walls, gates, numbers, who is where | orders and facts; short; says "we" for the guard and "you" for the hero; admits fear only after the fight | “Two at the gate, the rest to the square. Move.” |
| **Elder Maren** | the people, all of them, by name | speaks for the camp; plans a step ahead; counts heads | “Everyone is out of the inn. I counted twice.” |
| **Elyra** | how things feel, small homely magic, what she has lost | says what she feels and why; concrete, domestic pictures | “My wards kept wasps off the plums. Last night they held up a roof.” |
| **Old Haldor** | the bell, the old days, signs | slow; starts from what he has seen for years | “Forty years I’ve rung that bell. It never rang by itself.” |
| **Cael Varrow** | duty, the Watch, what he got wrong | formal; owns his mistakes in plain words | “The relief never came. I was the one who waited for it.” |
| **Nyx** | exits, prices, her brother | quick and practical; her humor is about people, never the threat | “There’s a back door, and the guard on it is asleep. We go now.” |
| **Brother Orren** | the dead, the lamps, rules that hold | gentle; argues from what the Lantern priests kept | “We lit the dead home. We never woke them.” |

When a scene has three people speak, each line should be one only that person would say.

## Where it stands

- Every land of the story rewritten to these rules (2026-11-15): the Prologue and Act I (Briarhollow, the
  Whisperwood, Brackenridge, Thornvale, the Amberfield), Act II (the Ashen Barrows, Emberwick), Act III (the
  Sunscorch, the Glimmerwood, Rimeheld, the Shattered Vale), Act IV (Highwall March, the Gloam story in the Riftscar),
  Act V (the Weeping Woods, Emberdeep, Hollowmere), the Last March, Crownfall and the epilogue: quest text and
  rewards, everyone's talk, fight barks, scenes, vision captions and the bosses' introductions.
- Voices (the table above), 2026-11-16: every line of the recurring cast was read against it (about 340 scene and
  talk lines). Most already sounded like their speaker. The changes went where a line could have been anyone's:
  Nyx most of all (she spoke only in plain exposition; now she copies maps, pockets letters and watches the exits),
  Orren speaking from his order's ways, Maren planning and counting heads, Mara wary of magic, and Elyra's dawn and
  the Grey Lady's grief. Haldor and Cael were left as they were.
- Not rewritten: the retired lands (`data/retired.ts`), and item and enemy lore (flavor on a card, not dialogue).

## v4: one tale, told darker (2026-11-18)

The owner again: "sometimes i didnt understand what exactly the dialogue was ... quests are not really clear whats
happening ... make the whole game as one unified experience where you know what the story is, what you're doing and
how ... make sure the story is flowy, dark and similar to the wow/lotr one". Everything above still holds. On top of it:

14. **The tale is always in view.** A player can name, at any moment, the enemy (the Hallow King, and the Pale Herald
    who speaks for him), what he wants (the seven sigils, to open Duskspire and remake his dead kingdom out of Aster's
    grief), how many sigils each side holds, and why the hero is where they are. The narrator's pages between the acts
    (`data/chronicle.ts` TALES) and the Journal carry the big picture; quest text and scenes carry the step.
15. **Every ending is seen.** A quest's `reward.text` is shown as a page when the quest pays out in the world (engine.ts
    StoryPage `deed`), or after the giver's words when it is handed in. It says what happened and what it means, in two
    to four sentences. It never repeats the next quest's text, and never repeats a keepsake's words.
16. **Looking for something finds something.** A quest that sends the hero to look, search, scout or find out has a
    `find` (data/types.ts Keepsake): the letter, order, page or relic found there, with its real words. The hero reads
    what the characters read. When it must go to someone else (a code only Nyx can read), the find says so.
17. **No ping-pong.** The next step is where the last one left the hero whenever the story allows. When the hero must
    go back, the find or the ending says exactly who to go back to and why.
18. **Dark, with weight.** This is a tale of grief and what it costs. The dead are sad, not monstrous. Victories cost
    something; the camp counts its dead. Atmosphere comes from concrete things seen (cold hearths, a child's shoe in the
    snow, candles in every window), never from adjectives piled up. Still short sentences, still plain words.
19. **Scenes take their time.** A scene opens on the place, lets a big moment (a sigil waking, a gate breaking) breathe
    with a `wait`, and puts the turn of the story on screen, never only in a fight's shout or a reward's line.
20. **A sigil won is the Sigil Rite.** Its page (ui/StoryPages.tsx, from `SIGIL_LORE`) tells where it lay, what it
    gives and what it took from Elyra. Lines around it agree with SIGIL_LORE.
