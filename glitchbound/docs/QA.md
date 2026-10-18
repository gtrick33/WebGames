# QA testers

Besides admins (`ADMIN_EMAILS` in `wrangler.toml`) GlitchBound has a second staff role: **QA**.

| | Admin | QA tester | Player |
| --- | --- | --- | --- |
| Admin › Dashboard, Games | ✅ | | |
| Admin › QA (player tools, testing tools) | ✅ | ✅ (the only tab they see) | |
| Admin › QA team (invite, block, remove, audit trail) | ✅ | | |
| Play hidden and paused games | ✅ | ✅ | |
| Written to the QA audit trail | no | **everything** | no |
| On public leaderboards and the Hall of Fame | yes | no (they see their own row) | yes |

## Adding a tester

Admin › **QA team** › type their email › **Invite to QA**. They get an email from `MAIL_FROM` with a
one-time link (`/admin?join=…`, valid 7 days). It only works for an account signed in with the
invited address. **Block** takes access away at once (they stay listed, and their requests are still
recorded); **Unblock** gives it back; **Remove** deletes them from the team (the audit trail stays).
Without a Resend key nothing is emailed; in local development (`DEV_LOGIN=1`) the link is shown instead.

## What testers can do (Admin › QA)

- **Players**: find by email, nickname or id; see bests, latest rounds, coin gifts and emails.
- **Give coins** for games with a wallet (`wallet: true` in the registry: Mini Racer, NEON RUSH).
  Gifts wait in `coin_grants` and land in the game's wallet the next time the player opens it signed
  in (Mini Racer claims them itself; NEON RUSH gets them over the host bridge, `coins` command).
- **Ban / unban** with a reason: a banned player is signed out everywhere, can't sign in and is left
  off the leaderboards. QA can't ban admins or other QA accounts (admins can ban QA accounts).
- **Email a player** from `hello@glitchboundstudio.com` (30 an hour per tester). A copy is kept on the
  player's record (`player_emails`).
- **Testing tools**: open hidden or paused games, reset their *own* account progress (one game, today,
  or everything), clear one game or everything saved in this browser, copy debug info for bug reports.
  Testers' analytics events are not stored, and their scores never reach the public boards.

## The audit trail (legal record)

Table `qa_audit`, append-only (SQLite triggers refuse updates and deletes). For QA accounts only:

- `request`: every API call they make (method, path, query and body with codes/tokens blanked, HTTP status),
  written by `functions/api/_middleware.ts`;
- `action`: every QA tool used, with the player concerned and the full details (e.g. the email text);
- `auth`: their sign-ins and joining the team.

Each row has the time, the tester's email, IP address (`cf-connecting-ip`) and browser. Admins read it in
Admin › QA team (filters, **Export CSV**). Admins' own actions are deliberately not recorded there.
