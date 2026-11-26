# The Vigil's classes, evened (2026-11-26)

The owner: "run balance check for every class and keep them in the 48-52% win rate zone ... deviation up to 5% is ok".

**What a win is here.** The Vigil has no win as the Ring has, so the measure is its own mark: a night is won when it
is held five minutes, which is what opens the next land and is each class's deed.

**Who plays.** One bot, the same for every class, in the first land (Whisperwood): it runs from what is near, dashes
when three of the Host are on it, and takes a level-up card at random, so no build is favored. It is not a person, and
a person's nights will differ.

**What was turned.** One number a class, its edge (`CLASS_EDGE` in `vigil/kit.ts`): the class's spells hit that many
times as hard, and its health is the square root of it as much. Nothing else about a class or a spell was changed.

| Class | Edge | Health as a night begins (was) | Nights | Held five minutes | Median night (s) | Before any edge (30 nights) |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 0.98 | 168 (170) | 600 | 50.7% | 300 | 37% |
| Mage | 2.12 | 189 (130) | 600 | 51.2% | 300 | 17% |
| Ranger | 2.41 | 174 (112) | 600 | 51.0% | 300 | 10% |
| Paladin | 1.32 | 184 (160) | 600 | 52.2% | 300 | 40% |
| Priest | 0.80 | 112 (125) | 600 | 48.5% | 285 | 67% |
| Warlock | 1.86 | 175 (128) | 600 | 51.8% | 300 | 7% |
| Druid | 1.52 | 160 (130) | 600 | 53.0% | 300 | 20% |
| Gloamknight | 0.80 | 148 (165) | 600 | 50.0% | 300 | 57% |

Every class is between 48.5% and 53.0%: inside the 45% to 55% the owner allowed, and six of the eight inside 48% to
52%. With 600 nights a figure is good to about two points either way, so the druid and the paladin may truly sit a
point or two outside the narrow zone.

How the numbers were got, so nobody takes them for more than they are:

1. **Found** by halving: for each class, 120 nights at each of eight edges, keeping the edge nearest half won
   (`VIGIL_TUNE=<class> npx vitest run --no-fsModuleCache tests/sigilfall-vigil-balance`).
2. **Checked on nights the edges were not found on**, 300 a class, twice. The first check had every class between 47%
   and 55%. The second, on other nights, had the priest at 42.3% and the druid at 58.0%: 300 nights scatter that much.
   The Gloamknight, paladin, priest and druid were each moved a little after one of these.
3. **The table above** is 600 nights a class that no edge was found or moved on: the first six rows from one set, and
   the priest and paladin, moved once more after that set had them at 45.2% and 46.7%, from another 600.
   (`VIGIL_BALANCE=<file> VIGIL_N=600 VIGIL_FIRST=<seed> npx vitest run …`.)

What this does not show:

- **A person's nights.** The bot neither aims its dash-spells nor seeks glades, lanterns or vents, and it leans on
  healing more than a person does. The classes it found weak (ranger, mage, warlock) are the ones with the least
  healing, and they now hit more than twice as hard; a person who dodges well may find them the strong ones.
- **Other lands, a party, the week's watch.** Only the first land was measured, alone.
- **Spells against each other.** This evens classes, not spells within a class.
- The edges are large for three classes. They are one line each in `vigil/kit.ts` if the owner wants them drawn in.
