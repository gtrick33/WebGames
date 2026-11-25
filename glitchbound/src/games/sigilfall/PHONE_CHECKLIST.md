# Sigilfall on a real phone: the owner's checklist

Piece 7 of `NINE_PLAN.md`. Everything here was measured in a desktop browser pretending to be a phone, with a
software graphics card: bytes, file counts, draw calls and memory counts carry over to a real phone; seconds and
frames a second do not. This list is the part only a real phone can answer. About twenty minutes, on the live site.

Use the phone on its side. Do it once on mobile data (not Wi-Fi) if you can.

## 1. The first visit (5 minutes)

Open a private tab, so nothing is cached, and go to the site's Sigilfall page. Press Play.

- [ ] A loading screen with the game's name and a bar that fills. Never a plain black box for more than a second or
      two. Does the line under the bar say how many MB have come ("2.1 of 4.5 MB")? yes / no
- [ ] Time from Play to the title screen: ______ s on Wi-Fi, ______ s on mobile data. (A first visit loads about
      7 MB before the title: on a slow line that is 35 to 45 seconds, on a good one a few.)
- [ ] The page never reloads by itself while loading.
- [ ] New hero, Begin: the first fight starts without a long freeze. Sounds play; music comes in (it may come late
      on a slow line, and that is fine).

## 2. How it runs (10 minutes)

Add `?perf` to the address (`/sigilfall?play=1&perf`) for the meter: frames a second, draw calls, and the share of
the full picture being drawn ("% px").

- [ ] The first fight at the village gate: ______ frames a second, ______ % px.
- [ ] Settings › Graphics is on Auto. If the frames are under about 50, "% px" should step down by itself within a
      few seconds and the frames come back up. It should never look blurry beside a sharp HUD.
- [ ] Graphics: Light, then Sharp: each takes at once, and Auto can be chosen again.
- [ ] Battery saver on: 30 frames a second, the phone cooler; off again: back to full.
- [ ] A heavy fight, if you have a hero that far (the night raid on Hearthstead, or any dungeon's boss): ______
      frames a second. No hitch when a boss enters or a big spell lands.
- [ ] The Ring, one match against the computer: smooth, and the buttons answer at once.
- [ ] A night of the Vigil to its tenth minute: the frames at the end ______ against the start ______.

## 3. Touch (5 minutes)

- [ ] The stick follows the thumb and lets go when the thumb lifts, every time.
- [ ] Every skill button answers a quick tap. Holding and dragging the attack aims it.
- [ ] Nothing important is under the notch or the home bar, either way round.
- [ ] Turn the phone upright and back: the game asks to be turned, and comes back as it was.
- [ ] Switch to another app for a minute and come back: the game is paused, not lost, and the sound returns.
- [ ] Lock the phone for a minute and unlock: the same.

## 4. A long sitting

- [ ] Play 30 minutes across at least three lands. The frames at the end ______ against the start ______. The
      browser never reloads the tab (that is the phone running out of memory).
- [ ] The phone is warm, not hot. If hot: Battery saver, and tell me which phone.

## What to send back

The phone and browser, the numbers in the blanks, and anything ticked "no". With those, the picture's floor, the
quality steps and what loads before the title can be tuned for real devices instead of guessed.
