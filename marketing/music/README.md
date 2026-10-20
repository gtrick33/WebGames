# GlitchBound soundtrack

Ten original tracks, a three-second sonic logo and 17 sound effects. Every note was composed for
GlitchBound and synthesized from scratch in code (`_studio/music/`), with no samples, loops or
third-party audio, so they are yours to use anywhere: TikTok, Reels, Shorts, YouTube, ads, the site
itself. Masters are loudness-normalized to -14 LUFS (the level TikTok, Instagram and YouTube play
at), with a -1.2 dBTP ceiling.

`.wav` is the 48 kHz master for editing; `.m4a` (AAC 256k) is for uploading or quick previews.

| Track | BPM | Length | Use it for |
|---|---|---|---|
| `small-games` | 116 | 1:11 | Bright, bouncy synth-pop. The brand theme: trailers, launches, lobby tours. |
| `big-obsessions` | 128 | 1:18 | High-energy EDM drop (the drop lands at 0:22.5). Fast-cut compilations, hype edits. |
| `brain-snack` | 104 | 1:18 | Quirky pizzicato and marimba. Puzzles, "how to play", satisfying solves. |
| `lofi-lobby` | 80 | 1:15 | Warm lo-fi hip-hop with vinyl crackle. Chill puzzles, late-night posts. |
| `pixel-dash` | 150 | 1:06 | Fast chiptune. Wing It, Gloop, Square Deal, speedruns. |
| `neon-nights` | 100 | 1:22 | Synthwave drive. NEON RUSH, Mini Racer, night edits. |
| `tick-tock` | 120 | 1:06 | Quiz-show tension bed with a ticking clock. Countdowns, trivia, "can you find it?". |
| `spooky-glitch` | 112 | 1:14 | Playful Halloween: creepy organ, theremin, bells. |
| `snow-day` | 112 | 1:14 | Cozy winter bells and sleigh shakers (an original tune). December posts. |
| `party-mode` | 122 | 1:05 | Funky house groove. Party games, game-night edits. |
| `logo-sting` | 120 | 0:05 | Glitchy stutter snapping into a bright chord. Intros and end cards. |

**SFX** (`sfx/`): whoosh, swoosh-down, pop, ding, buzz, tick, tock, beep, beep-go, impact, sparkle,
riser, glitch, coin, drumroll, tada, notify.

## Tips

- **Upload as an original sound.** On TikTok and Reels the first upload of a video with this music
  creates a "GlitchBound - original sound" others can reuse, which links back to the account.
- **Trending audio:** trending sounds get extra reach. If you want one, add it inside the app at low
  volume on top of the finished video (that keeps the platform's music licence on their side) rather
  than editing copyrighted songs into the file.
- To make a variation, change a track's `seed`, tempo or melody in `_studio/music/tracks.js` and run
  `node music/render.mjs <track-id>` from `_studio/`.
