# Optional backend (future)

v1 is fully local: `LocalOnlyBackend` in `src/backend/backend.ts` returns "not configured" for everything,
and all gameplay, progression and cosmetics work offline.

## Suggested Supabase design

| Feature | Supabase piece |
| --- | --- |
| Anonymous accounts | `auth.signInAnonymously()`, upgradeable to email/OAuth later |
| Cloud save / cross-device | `profiles` table (one row per user, JSON save plus `updated_at`), RLS `user_id = auth.uid()` |
| Leaderboards | `scores` table written **only** by an Edge Function that validates runs (rate limits, plausibility: max speed, time vs distance) |
| Daily challenge data | `daily_challenges` table or keep the deterministic client generator |
| Purchase verification | Edge Function receiving Stripe webhooks / App Store / Play receipts, writing `entitlements` |

Rules:
- Only the **anon/public** key may ship in the client (`VITE_SUPABASE_ANON_KEY`). Service-role keys stay in
  Edge Function secrets.
- Never trust the client for premium currency, purchase grants or competitive scores.
- Conflict resolution for cloud saves: keep the profile with the higher `gamesPlayed`/`updated_at`,
  and merge monotonic fields (best scores, owned skins, unlocked achievements) by union or max.

To wire it in: add `@supabase/supabase-js`, implement `BackendService`, and return it from `createBackend()`
when the env vars are present. Load the client lazily so it does not affect startup size.
