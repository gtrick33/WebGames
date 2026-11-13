# Sigilfall trailers: production report

13 November 2026. Game build: `origin/pre-release` at 09a19bb1.

## What was made

| File (in `marketing/videos/sigilfall/`) | Length | Size | For |
|---|---|---|---|
| `Sigilfall-Official-Story-Trailer.mp4` | 1:03.8 | 1920 x 1080, 60 fps | People who want a world and a story: "The Crown of Ash" |
| `Sigilfall-Official-Launch-Trailer.mp4` | 0:48.8 | 1920 x 1080, 60 fps | Anyone who has never heard of the game: "Choose Your Calling" |
| `Sigilfall-Official-Gameplay-Trailer.mp4` | 1:27.8 | 1920 x 1080, 60 fps | People asking "what do I actually do in it?" |
| the same three with `-Vertical` | same | 1080 x 1920, 60 fps | Shorts, Reels, TikTok |
| `thumbnails/*.jpg` | | 1920 x 1080 | One per trailer, from the game's own frames |
| `review/*-contact-sheet.jpg` | | | Forty frames of each trailer on one sheet |
| `SHOT-MANIFEST.md` | | | Every clip: where it sits, which take, what is on screen |

All six films: H.264 High, yuv420p, BT.709, AAC 320 kb/s at 48 kHz, fast-start. Measured: -14.0 to -14.2 LUFS
integrated, true peak -1.7 dB or lower, no black frames except one deliberate five-frame dip in the gameplay trailer
(where the game loads the world after hero creation), no frozen stretches outside menus.

## How it was made

The studio is `marketing/_studio/sigilfall/` (its README has the commands). In short: the game itself runs in a
headless browser at 1080p; a clock the recorder holds gives exactly 1/60 s of game time per filmed frame; a pilot
plays the hero with real key and mouse events; the game's own sound calls are logged and rebuilt from its own
sample files; each trailer is an edit script that is cut, titled, mixed and encoded by `render.mjs`. Nothing is
upscaled from the old trailers, nothing is interpolated, and no clip is slowed down or sped up.

38 takes were filmed, about 17 minutes of footage (2.3 GB, kept in `.cache/footage` for revisions).

## What was checked in the game first

- **Callings:** eight exist. Seven are free. The Gloamknight comes with a paid pack, so it is in no trailer: all
  three end on "Play free in your browser".
- **Acts:** the game's title screen and store text say "five acts"; its own review presets are labelled up to
  Act VI, plus Crownfall. The trailers' tagline avoids the number: "Seven sigils. One Crown." (seven sigils is
  consistent everywhere in the story data). **The game's own text should be made consistent one way or the other.**
- **Story lines on screen** are the game's own, shortened: the star that fell a thousand years ago and the two
  crowns (the game's first vision scene), the bell that stopped (the prologue's title), the dead walking (the Ashen
  Host), the fallen sigils (the game's design notes), the Hallow King (Vaelor's own caption).
- **Modes:** the Vigil, the Ring and Riftstone runs are all playable and all filmed. Co-op and matches between
  people exist in the code but need a second live player; they are not shown and not claimed.
- **Address:** `glitchboundstudio.com/sigilfall` answers. "No download required" is true of a browser game.

## Honest assessment

I cannot hear. Music was chosen by measured loudness shape and tempo, effects sit where the game's log says they
played, and levels are measured, but nobody has listened to these films. **Please listen to all three before
publishing.** The audio scores below are guesses for that reason.

| | Story | Launch | Gameplay |
|---|---|---|---|
| Opening hook | 88 | 90 | 84 |
| Visual presentation | 86 | 88 | 84 |
| Pacing | 84 | 90 | 82 |
| Gameplay clarity | 80 | 88 | 92 |
| Variety | 90 | 92 | 88 |
| Emotional impact | 80 | 82 | 74 |
| Audio design (unheard) | 75 | 78 | 78 |
| Marketing effectiveness | 84 | 90 | 84 |
| Authenticity | 95 | 95 | 97 |
| **Overall** | **85** | **88** | **85** |

They are a clear step up from the old pair on the points the brief named (variety, hooks, progression shown, world
shown, modes shown, a direct call to action), but they are not 95s. What holds them back:

- **The camera.** The game is seen from above with small figures. Even at the nearest camera setting and with
  gentle push-ins, a boss fight reads less dramatically than in a game with a low camera.
- **Cuts are on the bar by measurement, not by ear.** "Five Armies" has clear bar lines and the launch trailer is
  cut to them; "Heroic Age" is softer, and the story trailer's cuts follow its loudness shape only.
- **Story scenes are small on screen.** The throne-room shot of Vaelor is a talk between small figures; it carries
  the line but not much menace. The Pale Herald fight did not produce a visible Herald and was left out.
- **The pilot plays competently, not brilliantly.** Dodges happen, but there is no hand-played flourish.
- **Vertical versions** crop the middle of the picture and move it where the action is, clip by clip. A wide in-game
  banner ("The Matron wakes her children!") is cut at its edges there, and menus are shown whole but small.

## Left out on purpose

- The Gloamknight (paid pack).
- Co-op Riftstones, questing with friends, and Ring matches against people (not filmable alone; not claimed).
- The Ring footage is a ladder match against the game's own computer fighters, labelled "Arena duels".
- Warden Ossric (the take failed: the hero never left the door), the Elyra scene (static), the Pale Herald.
- Emberwick city and the Great Hall (the walks filmed there showed a hero standing still).
- Mounts, the wardrobe and the shop: not filmed.
- No voice-over: no licensed voice was available and a synthetic one was not wanted.

## Limits

- Filming runs at about 16 frames a second, so a retake of one minute costs about ten minutes.
- This machine's ffmpeg has no text filter; all type is rendered in the browser.
- Type is Georgia (the game's own serif) and Avenir Next; no fonts were downloaded.
- The drawn mouse pointer in menu shots stands in for the real one, which a headless browser does not show.

## Licences and credits

- Music: Kevin MacLeod (incompetech.com), "Heroic Age", "Five Armies", "Lord of the Land", Creative Commons
  Attribution 4.0. The credit is on each end card; **repeat it in each video's description.**
- Sound effects: the game's own library (see `glitchbound/src/games/sigilfall/CREDITS_AND_LICENSES.md`): CC0
  packs, and the Fantasy Sound Effects Library by Little Robot Sound Factory (CC BY 3.0), which **also needs a line
  in the description.**
- Picture: the game itself. No stock art, no generated art.

## Where to use which

- **Sigilfall page and the site's home banner:** the launch trailer. It is the shortest, says what the game is
  in the first three seconds and ends on the address.
- **YouTube:** all three. Launch trailer as the channel's featured video; story trailer as "Official Story
  Trailer"; gameplay trailer last, linked from the other two's end screens.
- **Shorts, Reels, TikTok:** the vertical launch trailer first. The vertical story trailer second. The vertical
  gameplay trailer is the weakest fit for a feed (it is long and has menus); cut it into its sections if used.
- **Store pages, press, Discord:** the gameplay trailer, because it shows the interface as it is.
