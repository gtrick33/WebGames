# Sigilfall: the playtest guide

For the first players from outside. The first half is for the testers (send it to them as it is, or in your own
words); the second half is for the owner. Piece 9 of `NINE_PLAN.md`.

## For testers

Thank you for playing. The game is free, runs in the browser, and saves on your device. Play on whatever you have:
a phone on its side, a tablet or a computer. Nothing you do can break anything.

### What to play, in this order

1. **A new hero, through the Prologue's first boss** (about 30 minutes). Pick any class; say yes to the hints. The
   boss is the Coffin Matron, in the Chapel Crypt. If you stop before her, that is useful too: tell us where, and
   why.
2. **The Ring** (10 minutes). From the title screen, "The Ring": pick a class and ask for a 1v1 match. If nobody else
   is there, the game finds you an opponent of its own after a few seconds. Play two or three.
3. **On into Act I**, for as long as you want to. This is the question we most want answered: do you *want* to keep
   going?
4. If you have time: **The Vigil** from the title screen (one night, about 10 minutes), and the same hero on a second
   device.

### How to tell us about a problem

Choose **Report a bug**: it is in the game's menu (the three dots at the top of the game), and on a computer also
beside the game. The form already knows
which game, which build, the land and quest you were in, your hero's level and class, and your screen size. It shows
you all of that before you send. It does not send your hero's name or your save. You only need to write what
happened and what you expected. No account is needed.

One problem per report. A picture or a short video helps: add a link in the text.

### What we would like to hear afterwards

Short answers are fine. Use the same form with "Idea", or write to whoever sent you this.

1. **Does fighting feel good?** When you press the attack, does your hero hit as fast as you want them to? Did the
   plain attack ever feel slow, or like waiting?
2. Did you understand what your skills do, and when to use which?
3. Was there a moment you didn't know where to go or what to do next? Where?
4. Where did you fall, and did it feel fair?
5. What was the best moment? What was the dullest stretch?
6. The Ring: was a match fun? Would you play another?
7. Did anything look broken, cut off, or too small to read or tap?
8. Would you come back tomorrow? What for?

## For the owner

### Before you send it

- Every pull request of the pass merged and deployed, and the release bar (piece 10) read.
- One run on your own phone: a new hero through the first fight, a Ring match, a bug report sent and found in
  Admin › Reports.
- Testers who are QA staff are left out of the numbers on purpose (their play is test traffic). Ordinary members and
  guests are counted.

### What to watch for

- **The first ten minutes.** Stops with `minutes` under 10 on `first-steps` or `briar-dusk` (the Prologue's first
  two quests) mean the opening lost them early.
- **The Coffin Matron.** Many falls with few players is one person stuck; many falls across many players is a boss
  that is too hard for a first boss.
- **Combat feel** (question 1). If most testers call the plain attack slow, its pace is two numbers in
  `progress/build.ts`: `BASIC_SLOW` (every basic attack is this many times slower than its skill says; 1.3 today) and
  `BASIC_MIN` (never more often than this many seconds; 0.75 today). Nothing else needs to change with them, but the
  bot tests must be run again: they measure how long fights take.
- **The open lands** (after the Prologue). A pack out there has 1.8 times a dungeon's health and pays half the
  experience (`WILD` in `sim/world.ts`). If testers say the road between dungeons drags, one of the two goes: you
  choose which, after reading what they say (`NINE_PLAN.md`, 11b).
- **The Ring.** Whether testers open it at all, and how long they stay: `game_stop` with `mode` `ring`.
- **Phones.** Reports in the "Looks wrong" and "Slow or laggy" categories carry the screen size: sort by it.

### Where to read the numbers

Bug reports: Admin › Reports, and the GitHub issues they are mirrored to. Each carries a line like
`In the game: Sigilfall build 1a2b3c4 · story · land crypt · quest the-warden · level 6 · warrior`.

Falls and stops: the D1 console (Cloudflare › Workers & Pages › D1 › glitchbound › Console), with the queries in
`docs/ANALYTICS.md` under "Sigilfall's playtest numbers": where heroes fall, where players stop for the day and
after how long, and how many players opened the Ring and the Vigil. The admin dashboard does not draw these yet.

What the numbers can't tell you:

- **Who.** A fall or a stop carries no account and no name. Players are counted by a key that changes every day, so
  the same person on two days is two players.
- **Why.** A stop says where and after how long. Only the tester's answers say why.
- **A stop is a hidden page**, too: someone who answers a message and comes back has stopped once and will stop
  again. The query reads each player's last stop of the day.
- **The Ring and the Vigil** send a stop with the minutes spent there, and no falls or results.

### Not checked

The numbers were followed from the game to a local copy of the site's database, and a bug report's line was seen on
the form, in a desktop browser. They were not checked on the live site or on a real phone: do the one run above
before testers start.
