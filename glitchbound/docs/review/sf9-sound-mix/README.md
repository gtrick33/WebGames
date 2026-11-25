# Sound: the mix, measured (piece 5 of NINE_PLAN.md, the mix only)

`node scripts/sigilfall-loudness.mjs` (new; needs ffmpeg, changes nothing) measures every recording the game ships:
each piece of music over its whole length (EBU R128), each effect's peak and mean, and each sound of
`audio/samples.ts` as it is played, with its gain laid over. `before.txt` and `after.txt` are its two runs;
`loudness.json` is the last one.

## What the numbers said

**Music was already one mix.** All 20 land and place pieces sit at -23.4 or -23.5 LUFS; the boss piece, the siege
piece and the Ring's three sit 2 louder (-21.4 to -21.6), which is on purpose. True peaks run from -11.7 to -1.7 dB
and nothing clips. The music already steps back under a scene, a conversation and a shout (`audio/mix.ts`,
`audio/sound.ts`): that was checked in the code, and nothing there needed changing.

**Two things in the effects were out of line, and were changed:**

| What | Before | After | Why |
| --- | --- | --- | --- |
| A woman hero's efforts (`voF1*`, and the companions' `voF2Attack`, `voF3Attack`, `voF3Shout`) | 4 to 6 dB under the man's for the same thing (mean -29.1 to -35.0 against -26.4 to -29.8) | level with his: mean -26.4 to -30.1 | the same blow was quieter for one of the two bodies. None raised by more than 5 dB; her peaks are still under his |
| The casts a mage, a ranger and a warlock make most (`fireball`, `arrow`, `rift`, `meteorCall`, `beamCharge`, `drain`) | peaks -17 to -30 dB, means -35 to -45: 8 to 20 dB under a sword's swing (-9.4 peak) | raised 4.5 to 5.3 dB each: peaks -12 to -25 | a caster's own attack was the quietest thing in their fight. A careful step, not all the way to the sword: these were set without hearing them |

Left as they are, on purpose: the loud moments (a bell tolling, a meteor landing, a legendary dropping, a boss's
roar, all peaking -4 to -5 dB), and the quiet layers that are meant to sit under something (what a blow meets,
footsteps, a wind-up).

## Not done in this piece, and why

- **New music** (a theme for each act and each boss). Nothing on this machine is music, and the brief says to stop
  before anything is downloaded from a source the owner has not approved. Nothing was downloaded.
- **New voices and each boss's own sounds.** No recordings to make them from, and no synthetic voices.
- **These changes were made by measurement, not by ear.** Nobody listened. If the casts now sound too forward, the
  six gains are one line each in `audio/samples.ts`.

## For a composer and voice actors: what is still stock

| What | What the game has now | What it would want |
| --- | --- | --- |
| Music | 25 pieces, all Kevin MacLeod (incompetech.com, CC BY 4.0, credited in Settings). Lands that belong together share one. One boss piece and one siege piece for every boss and every battle | a theme for each act; a piece for each act's last boss, or at least for Morgrave, Harlan Blackglove, Vaelor |
| The hero's voice, a man | one voice: 6 attacks, 4 big efforts, 5 hurts, 2 deaths, 2 jumps, 2 victories | the same again for each class, or two or three voices to share out |
| The hero's voice, a woman | one voice: 3 attacks, 3 hurts, 3 jumps. Her big effort is two of the attacks slowed, her death is a hurt slowed, and she has no victory | a full set to match his |
| Companions | Mara has a voice of her own (3 attacks) and Elyra another (3 attacks); Nyx is Elyra's pitched up; Cael and Orren are the man's pitched down | a voice each for Mara, Nyx, Elyra, Cael and Orren |
| Bosses | a phase changing and a boss's roar are the same giant's roar (5 takes) for every boss, and every boss dies with the same growl (2 takes) | an entrance, a phase and a death for each boss, the first seven first |
| Spoken lines | none: the story is read | the owner's call (2026-11-19: recordings of their own, never synthetic) |
