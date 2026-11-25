# Analytics and crash reports

GlitchBound measures itself with **first-party, cookieless analytics** stored in its own D1 database. The admin
dashboard (`/admin`) reads it. Nothing is sent to third parties unless you also switch on Umami.

## How it works

- `src/platform/analytics.ts`: `track(event, props)` queues events and sends them in batches to `POST /api/events`
  (every few seconds, and with `sendBeacon` when the page is hidden).
- `functions/api/events.ts` keeps only known event names and simple props, and stores them with a **visitor key** that
  is `sha256(UTC day + IP + user agent)`, cut to 16 characters. The IP is never stored, the key changes every day, so
  visitors cannot be followed across days. For retention, the first `page_view` of a tab session carries
  `visit: 'new' | 'returning'` and `gap_days` (days since the last visit), worked out in the browser from a
  `glitchbound.lastVisit` date in local storage (src/platform/visit.ts); no identifier leaves the device. Signed-in members' events also carry their user id.
- Events older than 180 days are deleted automatically.
- Crash reports: uncaught errors, unhandled promise rejections and games that fail to load go to `POST /api/errors`
  (max 8 per page view; third-party "Script error." noise is ignored). Kept 90 days.

## Events

| Event | When | Props |
| --- | --- | --- |
| `page_view` | Route change | `path` (route name) |
| `game_view` | A game page is opened | `game` |
| `game_start` / `game_end` | The game reports a round started / ended | `game`, `score` |
| `replay_click` | Restart pressed | `game` |
| `share_click` | Any share button | `game` or `day`, `what` |
| `daily_complete` | Today's challenge cleared | `game`, `day` |
| `search` | Search settles | `q` (lowercased, max 40 chars), `results`, `where` |
| `category_select` | Category filter chosen | `category` |
| `favorite` | Heart toggled | `game`, `on` |
| `sign_in`, `subscribe` | Account / email list | `method` / `via` |
| `game_error` | A game did not load | `game` |
| `web_vitals` | The page is hidden after a load | `page` (route name), `device`, `lcp` and `inp` (ms), `cls` |
| `game_fall` | A game's hero falls (Sigilfall) | `game`, `mode`, `key`, `region`, `quest`, `level`, `boss` |
| `game_stop` | A player stops playing a game: the page is hidden or left, or the game or one of its modes closed (Sigilfall) | `game`, `mode`, `key`, `region`, `quest`, `level`, `minutes` |

The last 100 events are also visible in the browser console as `__glitchbound.events`.

## Sigilfall's playtest numbers

`game_fall` and `game_stop` say where heroes fall and where players stop (src/games/sigilfall/progress/telemetry.ts).
Their props are the game's own content only: the mode (`story`, `rift` with the stone's number in `key`, `ring`,
`vigil`), the land, the quest being followed, the hero's level, the boss if one was up, the minutes played. No name,
hero or save, and **no account**: `/api/events` leaves a signed-in member's id off these two events
(`functions/api/events.ts`), so players are counted by the visitor key, which changes every day. A review hero (a
preset, a scene preview) and a Rift Trial send nothing.

A stop is sent when the page is hidden as well as when it is left, because a phone's player swipes the browser away
and never leaves the page. Someone who comes back and plays on stops again later, so read each player's last stop of
the day. The Ring and the Vigil send a stop when they are left, with the minutes spent in them and no hero's details.

To read them, in the D1 console:

```sql
-- where heroes fall most (the last 14 days)
SELECT json_extract(props, '$.mode') AS mode, json_extract(props, '$.quest') AS quest,
       json_extract(props, '$.boss') AS boss, COUNT(*) AS falls, COUNT(DISTINCT visitor) AS players
FROM events WHERE name = 'game_fall' AND game = 'sigilfall' AND ts > (strftime('%s', 'now') - 14 * 86400) * 1000
GROUP BY mode, quest, boss ORDER BY falls DESC LIMIT 25;

-- where players stop for the day in the story, and after how long (each player's last stop of each day)
SELECT json_extract(props, '$.quest') AS quest, COUNT(*) AS players,
       ROUND(AVG(json_extract(props, '$.minutes')), 1) AS avg_minutes
FROM events e WHERE name = 'game_stop' AND game = 'sigilfall' AND json_extract(props, '$.mode') = 'story'
  AND ts > (strftime('%s', 'now') - 14 * 86400) * 1000
  AND ts = (SELECT MAX(ts) FROM events l WHERE l.name = 'game_stop' AND l.game = 'sigilfall' AND l.visitor = e.visitor
            AND l.day = e.day AND json_extract(l.props, '$.mode') = 'story')
GROUP BY quest ORDER BY players DESC LIMIT 25;

-- how many players opened each mode, and how long they stayed in it altogether
SELECT json_extract(props, '$.mode') AS mode, COUNT(DISTINCT visitor || day) AS players, COUNT(*) AS visits,
       SUM(json_extract(props, '$.minutes')) AS minutes
FROM events WHERE name = 'game_stop' AND game = 'sigilfall' AND ts > (strftime('%s', 'now') - 14 * 86400) * 1000
GROUP BY mode ORDER BY players DESC;
```

## Bug reports from inside a game

A game may leave one short line on the device saying where its player is (`src/platform/bugContext.ts`); the Report a
bug page shows it to the player and sends it at the end of the description, as `In the game: …`. It is kept 30
minutes and only used for a report about that game. Sigilfall leaves its build, mode, land, quest, level and class
(`bugLine` in its `progress/telemetry.ts`): never the hero's name or the save.

## The admin dashboard shows

Members (total, new, active), email list (confirmed, pending, unsubscribed), per game: views, rounds started and
finished, distinct players, member rounds, average and top score, load errors; unique visitors, returning visitors, daily finishers and rounds per day
(14 days); top searches including ones with no results (ideas for new games); the latest crash reports with browser
family; newest members; past announcements.

## Optional: Umami as well

Set `VITE_ANALYTICS=umami` and `VITE_UMAMI_WEBSITE_ID` in `.env.production` to also send events to Umami
(https://umami.is, cookieless). Cloudflare Web Analytics (Workers & Pages > glitchbound > Metrics) can also be enabled
with one click for page views.
