# Letter Pinch — design notes

Issue #3 asks for an original daily word puzzle: understood in seconds, real deduction, satisfying
feedback after every attempt, a reason to come back daily, and **not** a Wordle clone. Three candidate
mechanics were considered.

## 1. Letter Pinch (chosen)

Find a secret five-letter word in six guesses. Every guess must be a real word. Each tile answers only
one question: **is the secret letter in this column earlier or later in the alphabet?** (▲ later, ▼
earlier, ● exact). Above the board, each column has an alphabet "window" that squeezes shut as clues
arrive, A–Z → D–K → G–H → G.

- **Originality: high.** Wordle-likes say *which letters are in the word*. Here no letter is ever
  confirmed "present"; you are narrowing five alphabetical ranges at once, and the real-word rule makes
  the ranges fight each other. (You cannot binary-search each column on its own, because the word you
  need to probe with usually does not exist.)
- **Seconds to understand: about 5.** "Up means later in the alphabet, down means earlier." The
  windows show the state, so nothing has to be remembered.
- **Deduction: strong.** Each guess is a trade-off between splitting the widest windows and staying
  a real word. Late guesses become word-finding inside tight ranges ("first letter G–H, second A–E,
  ends in -Y..."), which is where the "aha" moments come from.
- **Daily replayability: high.** Short (2–4 minutes), same word for everyone, a spoiler-free arrow
  grid (🔼🔽🟩) that is interesting to compare because different openers give different shapes.
- **Build complexity: low.** Feedback is one comparison per tile; the windows are a min/max fold. All
  of it is pure and unit-tested.

## 2. Swap Lock

The daily word is shown scrambled. Each move swaps two tiles, and the lock reports only *how many*
tiles are now in place (no per-tile colours). Solve in as few swaps as possible.

- Originality: medium (swap puzzles such as Waffle exist; count-only feedback makes it a permutation
  Mastermind).
- Seconds to understand: about 10.
- Deduction: strong but abstract; players can solve it without reading the word at all, which makes
  it feel less like a *word* game.
- Daily replayability: medium; the letters are given, so solutions spoil quickly once someone spots
  the anagram.
- Build complexity: low.

## 3. Overlap

Guess any word; you are told only how many letters it shares with the secret word (a number, no
positions). Deduce the word in eight guesses.

- Originality: low (this is the 1950s game Jotto).
- Seconds to understand: about 5, but minutes to see a strategy; the first few guesses feel random.
- Deduction: very deep, but the feedback is a single number, which is not very satisfying per guess.
- Daily replayability: medium; the share grid would be a row of digits.
- Build complexity: low.

## Decision

**Letter Pinch.** It is the only one of the three whose per-guess feedback is both instantly readable
and visibly *progressing* (the windows squeeze every turn), it stays a word game to the last guess, and
it produces the best share grid. Swap Lock is a reasonable future variant; Overlap is not original.

## Rules and tuning

- 6 guesses. Guesses must be in the accepted list (about 13k words). Secrets come from a hand-picked
  list of 662 common, family-friendly words.
- Daily: the secret for a date is a fixed, seeded shuffle of the answer list indexed by days since
  the game's epoch (2026-10-18), so every player gets the same word on the same local date and words
  do not repeat for 662 days.
- Practice: unlimited random secrets (never today's daily word).
- Score: 200 for solving + 100 per unused guess + up to 100 speed bonus (−1 per 3 seconds). A miss
  scores 0.
- Daily streak: consecutive days with the daily solved. A miss or a skipped day resets it.
- Fairness check (tests): a simple solver that only ever guesses words consistent with the windows
  solves every daily in the next two years within six guesses.
