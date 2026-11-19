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
| `game_fall` | A game's hero falls (Sigilfall) | `game`, `region`, `quest`, `level`, `boss` |
| `game_stop` | A player leaves a game mid-play: the page is left or the game closed (Sigilfall, once a sitting) | `game`, `region`, `quest`, `level`, `minutes` |

The last 100 events are also visible in the browser console as `__glitchbound.events`.

## Sigilfall's playtest numbers

`game_fall` and `game_stop` say where heroes fall and where players stop (src/games/sigilfall/progress/telemetry.ts).
Their props are the game's own content only: the land, the quest being followed, the hero's level, the boss if one was
up, the minutes played. No name, hero or save. A review hero (a preset, a scene preview) and a Rift Trial send nothing.
To read them, in the D1 console:

```sql
-- where heroes fall most (the last 14 days)
SELECT json_extract(props, '$.quest') AS quest, json_extract(props, '$.boss') AS boss, COUNT(*) AS falls,
       COUNT(DISTINCT visitor) AS players
FROM events WHERE name = 'game_fall' AND game = 'sigilfall' AND ts > (strftime('%s', 'now') - 14 * 86400) * 1000
GROUP BY quest, boss ORDER BY falls DESC LIMIT 25;

-- where players stop, and after how long
SELECT json_extract(props, '$.quest') AS quest, COUNT(*) AS stops,
       ROUND(AVG(json_extract(props, '$.minutes')), 1) AS avg_minutes
FROM events WHERE name = 'game_stop' AND game = 'sigilfall' AND ts > (strftime('%s', 'now') - 14 * 86400) * 1000
GROUP BY quest ORDER BY stops DESC LIMIT 25;
```

## The admin dashboard shows

Members (total, new, active), email list (confirmed, pending, unsubscribed), per game: views, rounds started and
finished, distinct players, member rounds, average and top score, load errors; unique visitors, returning visitors, daily finishers and rounds per day
(14 days); top searches including ones with no results (ideas for new games); the latest crash reports with browser
family; newest members; past announcements.

## Optional: Umami as well

Set `VITE_ANALYTICS=umami` and `VITE_UMAMI_WEBSITE_ID` in `.env.production` to also send events to Umami
(https://umami.is, cookieless). Cloudflare Web Analytics (Workers & Pages > glitchbound > Metrics) can also be enabled
with one click for page views.
