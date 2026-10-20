# GlitchBound as a Discord Activity

Quizbelief and Crass Act can be played as a **Discord Activity**: someone in a voice channel (or a DM / group-DM
call) opens the App Launcher, picks GlitchBound, and everyone in the call plays together without leaving Discord.

- **Quizbelief** becomes a friends' challenge for the whole call: the same round for everyone, one try each,
  live scoreboard, "Next round" for a rematch (the normal challenge, `src/platform/challenges.ts`).
- **Crass Act** becomes one live room for the call (the rooms worker in `rooms/`), so nobody types a room code.

The code is in the repo and **stays off until the Discord application exists and its client ID is set** (steps
below). Nothing here needs a GlitchBound account: players are recognised by their Discord account.

## How it works

```
Discord client ──iframe──▶ https://<CLIENT_ID>.discordsays.com/?frame_id=…&instance_id=…&platform=…
                                   │  Discord's proxy (URL mapping "/" → glitchboundstudio.com)
                                   ▼
                            glitchboundstudio.com  (same site, same /api, same rooms worker)
```

1. **Launch.** Discord loads the root URL mapping (`/`) with `frame_id`, `instance_id`, `platform` (and
   `guild_id`, `channel_id` when in a server) in the query string. `src/main.tsx` sees those and switches to
   `/discord` (keeping the query) before the first render. `/discord` without them shows a short "open this from
   Discord" page, and when `VITE_DISCORD_CLIENT_ID` is empty it is a plain 404.
2. **Handshake.** `src/discord/session.ts` loads `@discord/embedded-app-sdk` (its own chunk, only on this page),
   creates `new DiscordSDK(clientId)` and waits for `ready()`.
3. **Sign in with Discord.** `commands.authorize({ client_id, response_type: 'code', state: '', prompt: 'none',
   scope: ['identify'] })` returns a one-time `code` (Discord shows a consent prompt the first time). The page posts
   it to `POST /api/discord/token`, which exchanges it with Discord (`POST https://discord.com/api/oauth2/token`,
   form-encoded `client_id`, `client_secret`, `grant_type=authorization_code`, `code`), reads the user from
   `GET https://discord.com/api/v10/users/@me`, and answers with:
   - `access_token`: handed straight to `commands.authenticate({ access_token })` (the SDK needs it),
   - `user`: Discord id and display name (`global_name`, else `username`),
   - `key`: the player's challenge/room key, `HMAC-SHA256(DISCORD_CLIENT_SECRET, "glitchbound-player:" + discordId)`.
     The same Discord account gets the same key on every device, nobody can compute it without the secret,
     and it is a normal guest key (`g:<key>`), so challenges and rooms need no changes.
   The page then uses that key and the Discord name for this visit (`setPlayerKey`, `setSessionName`).
4. **Who's here.** `commands.getInstanceConnectedParticipants()` plus the
   `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE` event show who has the Activity open (no extra OAuth scope).
5. **One game per call.** `discordSdk.instanceId` is the same for everyone in the call. Picking a game posts
   `POST /api/discord/play { instanceId, game, name, key }`:
   - `wait-what`: the first player starts a fresh challenge (they host it); everyone after joins that one. If it
     has ended (the host ended it, or it closed by itself) the next pick starts a new one.
   - `crass-act`: the first player opens a room; everyone after gets the same code. A room that has closed is
     replaced the same way.
   The pairs live in D1 (`discord_instances`, migration `0009`), claimed in one transaction so two people
   tapping at the same moment still end up together. `GET /api/discord/play?instanceId=…` tells the page what is
   already running in the call ("Quizbelief · 3 playing"), polled every few seconds while the picker is open.
   Rows untouched for two days are deleted.
6. **Play.** The page navigates (client-side) to `/games/wait-what?challenge=<id>` or
   `/games/crass-act?room=<code>`. Inside the Activity the arcade header and footer are replaced by a slim bar
   with "All games", the challenge "Invite" button opens Discord's own invite dialog
   (`commands.openInviteDialog()`), and Crass Act goes straight into the call's room after the 18+ check.

### Proxy and browser rules this relies on

- **Everything goes through Discord's proxy.** Discord's CSP only allows requests to
  `https://<CLIENT_ID>.discordsays.com`. Our app only makes same-origin requests (`/api/…`, `/assets/…`,
  `wss://…/api/rooms/<code>/ws`), which the root mapping forwards, so no extra mappings and no
  `patchUrlMappings` are needed. (Older guides prefix requests with `/.proxy/`; Discord's current networking docs
  build URLs from the mapping alone, so we don't.) External things are blocked inside Discord and are left off
  there: Google sign-in, AdSense, Umami. Links that leave the app should use `commands.openExternalLink`.
- **WebSockets** are supported by the proxy (WebRTC and WebTransport are not). Crass Act rooms already use them.
- **Origin.** Through the proxy, browser requests carry `Origin: https://<CLIENT_ID>.discordsays.com` while our
  Functions see their own host, so the CSRF check (`sameOrigin`) and the rooms WebSocket check would refuse
  them. `functions/api/_middleware.ts` treats exactly that one origin (our own client ID, nothing else on
  discordsays.com) as our own.
- **Cookies are not used.** Inside Discord we are a third-party iframe; Discord's docs say cookies need
  `SameSite=None; Partitioned` on the `discordsays.com` domain. Instead of changing the session cookie, the
  Activity identifies players with the HMAC key above (kept in memory, and in the iframe's own storage).
- **Framing.** The site sends `X-Frame-Options: SAMEORIGIN`, which would stop Discord from showing it. `/` and
  `/discord` (the only pages Discord loads directly) send `Content-Security-Policy: frame-ancestors 'self'
  https://discord.com https://*.discord.com https://*.discordsays.com` instead (`public/_headers`). Every other
  page keeps `SAMEORIGIN`; the Activity reaches the games by client-side navigation, so they are never loaded
  as a new document inside Discord.
- **Untrusted input.** Discord's docs ask to treat data from the client as untrusted. The server reads the
  player's identity from Discord itself (step 3); names are cleaned like any challenge name and rendered as
  text. Instance IDs only pick which challenge/room you land in, and those are joinable by link anyway.

## Configuration

| Where | Name | What |
| --- | --- | --- |
| `.env.production` (public, in the browser bundle) | `VITE_DISCORD_CLIENT_ID` | The application's client ID. Empty = feature off. |
| `wrangler.toml` `[vars]` (public) | `DISCORD_CLIENT_ID` | The same client ID, for the token exchange and the origin check. |
| Pages secret (never in git) | `DISCORD_CLIENT_SECRET` | OAuth2 client secret. Also the HMAC key for player keys: rotating it gives every Discord player a new identity (their open challenges stay, but they can't play them as the same seat). |

Without `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, `/api/discord/*` answers `503 discord_not_configured`.

## Setup steps (need you, in the Discord Developer Portal)

1. **Turn on Developer Mode** in Discord: User Settings › Advanced › Developer Mode.
2. **Create the application:** <https://discord.com/developers/applications> › New Application › name it
   "GlitchBound" › pick your team (or personal) › Create. Add the icon (`public/icon-512.png`) and a short
   description on General Information.
3. **Installation contexts:** Installation › tick both **User Install** and **Guild Install** (so it works in DMs
   and in servers) › Save.
4. **OAuth2 redirect placeholder:** OAuth2 › Redirects › add `https://127.0.0.1` › Save. (The SDK handles the
   redirect; Discord just needs one listed.)
5. **Copy the Client ID** (OAuth2 page) and put it in two places (it is public):
   - `glitchbound/.env.production`: `VITE_DISCORD_CLIENT_ID=<client id>`
   - `glitchbound/wrangler.toml` under `[vars]`: `DISCORD_CLIENT_ID = "<client id>"`
6. **Store the Client Secret** (OAuth2 › Reset Secret, copy it once) as a Pages secret, from `glitchbound/`:
   ```bash
   npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=glitchbound
   ```
   Paste it when asked. Never commit it or put it in a `VITE_*` variable.
7. **URL mapping:** Activities › URL Mappings › Root mapping: prefix `/`, target `glitchboundstudio.com`
   (no `https://`). To try pre-release builds first you can point it at `glitchbound-d8m.pages.dev` instead. No
   other mappings are needed.
8. **Enable Activities:** Activities › Settings › tick **Enable Activities** › Save. Optionally set the supported
   platforms (web, desktop, iOS, Android) and the default orientation (portrait lock is fine for both games on
   phones).
9. **Deploy:** commit the two client-ID edits and push to `pre-release`. CI applies migration `0009` and deploys.
10. **Try it:** in a test server (or a DM call), join a voice channel › the rocket (App Launcher) button › your
    app › Launch. Discord asks once to authorize "identify". Check: your Discord name shows, a second account
    in the call sees the same game after picking it, a Quizbelief round reaches the shared scoreboard, and an
    Crass Act room fills with everyone in the call.
11. **Before inviting the public:** during development only you and your team can launch it. Check the
    portal's current rules for making an Activity available to everyone and for the App Directory (app
    verification, Terms of Service and Privacy Policy URLs on General Information; the privacy page is
    `https://glitchboundstudio.com/privacy`). Crass Act is 18+: keep its in-game age check, and say so in the
    description.

### Local testing (optional)

Discord can only load a public HTTPS URL. To test unreleased changes: run `npm run build && npm run dev:api`
(port 8788), expose it with `cloudflared tunnel --url http://localhost:8788`, point the root URL mapping at the
tunnel's host, and put `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` in `glitchbound/.dev.vars` (git-ignored)
and `VITE_DISCORD_CLIENT_ID` in `.env.local` before building. Switch the mapping back afterwards.

## What to watch on the first real launch

- The browser console of the Activity (Discord desktop: Ctrl/Cmd+Shift+I once Developer Mode is on) for
  `blocked:csp` errors: anything that shows up there is an external request to remove or map.
- If the frame stays blank, check the response headers of `/` through the proxy: `X-Frame-Options` must be
  gone and `frame-ancestors` present.
- If `/api/…` calls fail with 403 `forbidden`, Discord's proxy is sending an `Origin` other than
  `https://<CLIENT_ID>.discordsays.com`; adjust `functions/api/_middleware.ts`.

## Limits and follow-ups

- A challenge has at most 6 seats; the 7th person in a call gets "This challenge already has 6 players"
  (Crass Act rooms have their own limit).
- The Discord page's texts are English-only for now (they fall back to English in every language).
- Not yet: Discord names in the main arcade (a "Sign in with Discord" for members), rich presence
  (`setActivity` with the current game), a server-verified participant list (needs a bot token and
  `GET /applications/<id>/activity-instances/<instance_id>`), and the other challenge games inside the Activity
  (they work the same way; only the picker limits it to two).

Sources: Discord developer docs, "Building an Activity" and "Networking"
(<https://docs.discord.com/developers/activities/building-an-activity>,
<https://docs.discord.com/developers/activities/development-guides/networking>), the Embedded App SDK reference
(<https://docs.discord.com/developers/developer-tools/embedded-app-sdk>), `@discord/embedded-app-sdk` 2.5.0,
and Cloudflare Pages `_headers` (<https://developers.cloudflare.com/pages/configuration/headers/>).
