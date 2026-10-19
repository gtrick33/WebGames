# Fussbox

**Pitch:** every day the Fussbox, a small boxy robot, has a secret rule about cards. Feed it cards, see
which it likes and which it hates, work out its taste, then prove it on eight cards you have never seen.

## The cards

81 cards: 1–3 identical symbols, each card with one **shape** (circle, triangle, square), one **colour**
(pink, blue, yellow) and one **fill** (solid, striped, hollow). No words anywhere, so the game plays the
same in every language; only the rule's explanation at the end is translated.

## A round

1. **The lab.** Two cards the Fussbox likes and two it hates are shown. Build any card with four pickers
   (count, shape, colour, fill) and feed it in: a green light and a ding, or a red buzz. Every card you feed
   joins the Likes or Hates tray. Tests are counted; there is no limit, but fewer is better.
2. **The exam.** Whenever you are ready: eight new cards, mark each ✓ (it likes it) or ✗.
3. **The reveal.** Right/wrong per card, the score, and the rule in plain words.

**Score** = 100 per right answer (800) + up to 200 for being quick to crack it: full bonus with 3 tests or
fewer, 20 less for each extra test, scaled by how many answers were right. Max 1000. Stats: `correct` (of 8)
and `tests` (fewer is better).

## Rules and fairness

Rules are small logic trees over the four attributes, harder through the week:

- **Mon–Tue:** one property ("pink", "not circles").
- **Wed–Thu:** two properties together ("striped and not three symbols").
- **Fri–Sat:** either of two ("yellow or squares"), or corners ("at least 6 corners in total").
- **Sun:** three-part or either-but-not-both ("pink or striped, but not both").

The generator only keeps rules the Fussbox likes 9–70 of the 81 cards for (never all or nothing). The
four examples and the eight exam cards are all different cards; the exam always mixes 3–5 liked cards, so
ticking everything scores badly.

## Modes

- **Daily:** same rule, examples and exam for everyone, `#N` from 2026-10-19; one try (it resumes after a
  reload). Share line: `🤖 Fussbox #N · 7/8 · 4 tests` + a 🟩/🟥 line for the exam.
- **Practice:** a random rule at the difficulty you pick.
- **Friends' challenge:** one round (Friday-level rule) from the challenge seed.

## What is original

The inductive "guess the rule" idea is old (Eleusis, Zendo); the experiments-then-exam structure, the
card set, the corner rules, the weekly difficulty curve and the Fussbox itself are GlitchBound's own.
