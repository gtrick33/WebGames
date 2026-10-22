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

## The board

- Always the right way round, laid out for landscape: on a phone on its side (or a wide window) the board takes the
  whole height and the players, the score and the buttons stand in a column beside it; on an upright phone it fits
  the width, with a note that turning the phone gives a bigger board.
- Moves are the player's choice: a tap picks a checker up (nothing moves by itself) and every place it can reach
  lights up with its count, each number on its own and both together (a double's two, three and four steps), from
  `routesFrom` in logic.ts; a tap on one goes there. Only when a single checker can move (one on the bar, say) is it
  picked up for the player.
- A move is made once it is chosen: no Undo, no Done. When nothing is left to play the turn passes by itself, a beat
  after the last checker lands.
- Checkers never teleport: every step bounces point by point along its way (a quick hop and a soft tap on each point
  it passes, a clack where it lands; in from the bar is one leap), and a checker it hits flies to the bar once it
  lands. This is the same for everyone (you, the computer, a friend on their phone): the board replays the steps
  between the position it shows and the game's (`stepsBetween` in logic.ts), one after another, so a whole turn
  arriving at once from the live table plays out the same way. Nothing can be picked up while a checker is moving,
  and the computer's steps are paced to the bounces.
- A tapped point gets no focus box; the keyboard's focus shows as a cyan outline on the triangle.
- The dice shake for a moment, faces flicking, before they land with a little bounce; nothing moves until then.

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
