# Belot: design notes

The partnership trick-taking classic, played the way it is played at club tables: 32 cards, four players in two
teams (partners sit opposite), play runs counter-clockwise, first team to 151 wins the match. A cartoon card table in
the arcade's bold style, with original card art (the court cards are drawn characters, no real deck's designs).

## A deal

1. **Deal**: 3 + 2 cards each, counter-clockwise from the dealer's right.
2. **Bidding** (from the dealer's right): Clubs < Diamonds < Hearts < Spades < No trumps < All trumps, each bid higher
   than the last. **Contra** (double) an opponent's bid, **recontra** (redouble) a contra on your team's bid; a higher
   bid wipes both. Three passes after a bid end it; four passes throw the cards in and the next player deals.
3. **The rest**: 3 more cards each; the dealer's right leads.
4. **Play**: follow suit. In a suit contract a trump lead must be beaten if you can; void in the led suit, you must
   trump when an opponent holds the trick, and over-trump an opponent's trump if you can (a partner holding the trick
   frees you). No trumps: follow suit, nothing else. All trumps: follow suit and beat the best card so far if you can.
5. **Ranks and points**: trump J 20, 9 14, A 11, 10 10, K 4, Q 3, 8 and 7 nothing; other suits A 11, 10 10, K 4, Q 3,
   J 2. Last trick +10. Totals 162 (suit), 258 (all trumps), 130 doubled to 260 (no trumps).
6. **Declarations** with your first card: tierce 20, quarte 50, quint 100 (5+ in a row, 7-8-9-10-J-Q-K-A order),
   carré of jacks 200, nines 150, aces, tens, kings or queens 100 (sevens and eights do not count). A card serves one
   declaration (the engine picks the best split). Only the team with the best sequence scores its sequences (equal
   best: nobody); only the team with the best carré scores its carrés; sequences and carrés are compared separately.
   **Belote** (K and Q of trumps; any suit in all trumps) is called with the first of the two and always counts.
   No declarations in no trumps.
7. **Scoring**: valat (all eight tricks) +90. The contract team must beat the other: **outside** each team keeps its
   points; **inside** the other team takes everything; **hanging** (a tie) the other team keeps its share and the
   contract team's share waits for the winner of the next deal. Contra: the team with more points takes everything,
   doubled (recontra ×4). Points are divided by ten with the club rounding (suit: 6 rounds toward the team behind;
   all trumps: 4 does; no trumps: 5 and up). A match cannot be won on a valat: one more deal is played.

## Modes

- **Today's deals**: the same four deals for everyone (seeded from the date), against Hard players. Score = your
  team's game points over the four. Shareable as one emoji per deal.
- **Match**: to 151 against computer players at Easy, Medium, Hard or Expert.
- **Live room**: four seats, friends on their own phones; the host fills empty seats with computer players.
- **Friends' challenge**: the same four deals on the challenge's seed.

## The computer players

All four levels play only legal cards and know only what a player at the table would know (their own hand, the
cards played, the calls, declared combinations, voids shown by not following suit).

- **Easy**: mostly random among legal cards, bids on obvious hands only.
- **Medium**: plays sensible cards (win cheaply, give points to a partner's trick, throw low) without counting.
- **Hard**: counts every card: knows which cards are the masters, who is void and who is out of trumps, draws trumps
  as the contract team, smears points on a partner's winning trick, saves masters, bids by hand strength with the
  partner's calls in mind, doubles strong defences.
- **Expert**: the Hard player's knowledge plus simulation: for every legal card (and every bid) it deals out
  dozens of possible hands for the others, consistent with everything seen so far, plays each deal to the end and
  picks the choice that scores best on average.
