# Backgammon: design notes

Classic backgammon on a cartoon board: 24 points, 15 checkers each, two dice. Everyone knows it by one of its many
names; the rules here are the standard international ones, without the doubling cube (the way most people play at
home and in cafés).

## A game

- Start: two on your 24-point, five on the 13, three on the 8, five on the 6 (the opponent mirrored). You move from
  24 down to 1, the opponent the other way.
- Opening: each side rolls one die; the higher one moves first with both numbers (a tie rolls again).
- A turn: roll two dice and move a checker by each number; doubles play four times. You must use both numbers when
  you can; when only one can be used, the larger one if possible. You may land on an empty point, your own, or an
  opponent's single checker (a blot: it is hit and goes to the bar). Points with two or more opposing checkers are
  closed.
- The bar: a hit checker must come back in, into the opponent's home board, before anything else moves.
- Bearing off: once all fifteen are home, take them off with exact numbers, or with a higher number from the highest
  point you hold.
- Winning: the first to bear off all fifteen. 1 point; a gammon (the loser has not borne any off) 2; a backgammon
  (and still has a checker on the bar or in the winner's home board) 3. Matches to 3, 5 or 7 points.

## Modes

- **Today's game**: one game against the Hard player with the same dice for everyone (the rolls come from the date).
  Score: 100 per point won (×2 gammon, ×3 backgammon) plus the opponent's pips left; a loss scores 4 per checker you
  bore off.
- **Match**: to 3, 5 or 7 against the computer at Easy, Medium, Hard or Expert.
- **Live table**: two phones, a match to 3, 5 or 7; the host can seat a computer player instead of a friend.
- **Friends' challenge**: today's game on the challenge's seed.

## The computer players

All levels choose among the legal plays of the roll (whole moves, not single steps), from what anyone at the board sees.

- **Easy**: mostly random plays, a nudge toward hitting.
- **Medium**: a simple count: pips, made points, blots left alone.
- **Hard**: a full position judgement: the race, blots weighted by how many of the 36 rolls hit them and how far a
  hit sends them back, home-board points and the 5-point above all, anchors, primes, stacked points, checkers on the
  bar against a strong home board, and the bear-off.
- **Expert**: looks a roll ahead: for the best few plays it tries all 21 replies the opponent could roll, assumes
  the opponent's best answer to each, and keeps the play that leaves it best off on average.
