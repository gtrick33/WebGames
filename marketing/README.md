# GlitchBound marketing kit

Everything for TikTok, Instagram, YouTube (and X, Facebook, Discord, Reddit): 103 vertical shorts,
23 YouTube videos, feed posts, stories, logos, banners, an original soundtrack and a day-by-day posting
calendar (Oct 21 - Dec 31) with captions. All gameplay is real: every game was played on the real site
(the same build as `pre-release`) by scripted bots that play like people, and screen-recorded at
1080x1920.

**Start here:** [`calendar/CONTENT_CALENDAR.md`](calendar/CONTENT_CALENDAR.md) (what to post each day)
and [`calendar/captions.md`](calendar/captions.md) (copy-paste captions). `calendar/calendar.csv`
imports into Buffer, Later, Metricool, a spreadsheet or the site's auto-poster. **All calendar times are
US Eastern (America/New_York).**

`calendar.csv` columns: `date, time, platform, type, asset, title, caption, tags, thumbnail, needs_touch,
timezone`. Carousels list their slides in order, separated by `|` (10 or fewer each, Instagram's
limit). Feed posts and stories point at `.jpg` copies (the Instagram API takes JPEG only; each PNG has a
`.jpg` twin). `needs_touch` is `yes` only for poll stories, whose caption spells out the poll question
and options to add by hand; every other story shows glitchboundstudio.com in the image.

## What's inside

| Folder | What | Count |
|---|---|---|
| `videos/shorts/01-game-spotlights` | One per game: hook, real gameplay, captions, end card | 19 |
| `videos/shorts/02-beat-my-score` | "Score to beat" meme-format challenges | 13 |
| `videos/shorts/03-spot-the-glitch` | Countdown puzzles with the game's own pictures, answers circled | 16 |
| `videos/shorts/04-wheres-the-ball` | Find-the-ball countdowns with the zoom reveal | 12 |
| `videos/shorts/05-wait-what-trivia` | Quizbelief: 3 hand-picked questions from the game's bank per video | 14 |
| `videos/shorts/06-higher-or-lower` | Gut Check pairs with the number reveal | 7 |
| `videos/shorts/07-trailers` | Vertical trailer, 15 s teaser, puzzle-lovers cut | 3 |
| `videos/shorts/08-pov-and-memes` | Relatable caption-bar memes over gameplay | 8 |
| `videos/shorts/09-seasonal` | Halloween, Diwali, winter looks; spooky Crosswire and trivia | 5 |
| `videos/shorts/10-party-mode` | Impostor on one phone, three hooks | 3 |
| `videos/shorts/11-compilations` | Lobby tour, oddly satisfying, today's dailies | 3 |
| `videos/youtube` | Official trailer (16:9), all-games tour, party how-to, desktop tour | 4 |
| `videos/youtube/gameplay` | One 16:9 gameplay video per game | 19 |
| `videos/screen-recordings` | The raw bot-played recordings (two takes per game, a Halloween Crosswire, site tours, party) for your own edits | 45 |
| `music` | 10 original tracks + sonic logo + 17 SFX, -14 LUFS (see `music/README.md`) | 28 |
| `logos` | Mark, lockups, wordmark, profile pictures, watermark | 19 |
| `banners` | YouTube, X, Facebook, Discord, LinkedIn, Reddit, Twitch, email, OG, wallpapers | 12 |
| `posts` | Game cards, "19 free games" (3 parts) and Party Mode (2 parts) carousels, trivia / Spot / Ball puzzle carousels, quotes, game drops, holidays (PNG + JPG) | 135 |
| `stories` | Daily reminders, polls, beat-my-score, announcements, 8 highlight covers (PNG + JPG) | 44 |
| `thumbnails/youtube` | A thumbnail for every YouTube video | 23 |
| `post-templates/blank` | Branded blank backgrounds for quick edits in Canva or CapCut | 5 |

Brand rules (colors, type, logo use, voice, safe zones) are in [`BRAND.md`](BRAND.md).

## Formats and specs

- **Shorts / Reels / TikTok:** 1080x1920, 30 fps, H.264 + AAC, -14 LUFS, 13-42 s. Upload the same
  file to all three. Text stays out of the platforms' UI zones.
- **YouTube:** 1920x1080, 30 fps. Titles, descriptions and tags are in `captions.md`.
- **Feed posts:** 1080x1350 (4:5). Carousels are numbered in posting order.
- **Stories:** 1080x1920; dashed boxes mark where to place Instagram's link or poll sticker (remove
  nothing, the sticker covers it).
- **Profile setup:** avatar `logos/profile-pictures/avatar-blue.png`, YouTube banner
  `banners/youtube-channel-art-2560x1440.png`, X header `banners/x-twitter-header-1500x500.png`,
  Instagram highlight covers in `stories/highlight-covers/`. Link in bio: `https://glitchboundstudio.com`.

## Good to know

- **Played like a person:** the bots hesitate, hover between options, make mistakes, fix typos, undo
  moves and miss now and then, so the footage looks like a real player (and makes the challenges feel
  beatable). Scores and results shown are those real runs; no invented stats.
- **Emoji:** games that draw emoji (To Scale's objects, party avatars, holiday decorations) were
  recorded with Google's open-licensed Noto Color Emoji (SIL OFL) instead of Apple's emoji artwork.
  Trivia questions, Gut Check numbers, Spot the Glitch pictures and ball photos come straight from the
  games' own content.
- **Photos** in the Where's the Ball pieces are CC0 / public domain from Wikimedia Commons (credit is
  shown anyway). **Fonts** are SIL OFL. **Music** is original, synthesized in code: no licences needed.
- **No emoji in artwork** (as for the game tiles): captions use emoji, the visuals don't.
- **Crass Act (18+)** is left out of everything.
- **Seasonal footage** shows the site's real holiday looks (Halloween, Diwali, winter); everything else
  was recorded with the holiday look off so it stays evergreen.
- Footage was recorded from the build of `pre-release` at 3ecbf8c (Oct 19, 2026). Quizbelief (renamed from
  Wait, What?) and the lobby tours were re-recorded at b09ea08 (Oct 20, 2026), after the rename. If a game
  changes a lot, re-record it (below) so the videos match what players will see.
- **Trivia picks:** the Quizbelief shorts and carousels use questions picked by hand by id (`video/plan.mjs`,
  `stills/jobs.mjs`), each with a real twist; no capitals, chemical symbols or "who painted X".

## Making more

The studio that made all of this is in [`_studio/`](_studio/) (Node + Playwright + ffmpeg). From
`marketing/_studio/` (Node 20+, `npm install`, `npx playwright install chromium`, `brew install ffmpeg`):

```bash
node lib/site-up.mjs
```

keeps the servers running (a frozen copy of the site at git HEAD in `.cache/site`). Then:

| Command | Does |
|---|---|
| `node capture/record.mjs wing-it --take c` | Records a new bot-played take of a game (bots in `capture/bots/`) |
| `capture/retake.sh [slug ...]` | Re-records every take (2 at a time), retrying any that miss the moments the edits need |
| `node content/extract.mjs` | Re-extracts trivia, puzzles, photos and the catalogue from the game code |
| `node music/render.mjs [id]` | Renders the soundtrack (`music/tracks.js`) |
| `node stills/render.mjs [filter]` | Renders logos, banners, posts, stories, thumbnails (`stills/jobs.mjs`) |
| `node video/render.mjs [id] [--force] [--preview 0.5]` | Renders videos (`video/plan.mjs`, copy in `video/copy.mjs`) |
| `node calendar/build.mjs` | Rebuilds the calendar and captions |

To add a video, add a spec in `video/plan.mjs` (formats: `reel`, `montage`, `spot`, `ball`, `trivia`,
`higherlower`, `yt`) and render it by id. Edits are cut on the moments the bots mark in each take (`video/marks.mjs`), so re-recorded takes
stay in sync; after re-recording, delete `.cache/frames`. Delete `.cache/site` to pick up a newer
site build.
