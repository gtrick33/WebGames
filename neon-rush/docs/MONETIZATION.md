# Monetization architecture

The first release ships with **no ads and no real-money purchases**. Everything below is in place
so real providers can be added without touching gameplay code.

## Ads (`src/monetization/ads.ts`)

- `AdProvider` interface with `NoAdProvider` (production default) and `MockAdProvider` (dev only).
- `AdManager` enforces the rules on top of any provider:
  - Never during an active run (playing, paused, or crashing). Requests are refused with `blocked`.
  - Rewarded ads are only shown after the player taps "Double coins" on the game-over screen. The reward
    is explained on the button before anything starts.
  - The reward is granted only when the provider calls `onReward`. Duplicate callbacks are ignored, and
    the grant itself is keyed by run id (`grantRewardOnce`), so a run can never pay twice.
  - Failed, cancelled, unavailable, busy, or throwing providers all leave the game running normally.
  - Interstitials only between runs, after game over: not before the 4th completed run, then at most
    every 4 runs, at least 4 minutes apart, and at most 3 per session. A `no_ads` entitlement disables them.
- Production builds cannot construct the mock (it is tree-shaken out). Mock impressions are not revenue.

### Adding a real ad network

1. Pick a provider whose policies allow your distribution channel (web portals often require their own
   SDK; native apps typically use AdMob via a Capacitor plugin).
2. Implement `AdProvider` following that provider's **official** documentation. Do not guess SDK methods.
3. Call `onReward(token)` only from the provider's verified reward callback (server-side verification
   when the network supports it).
4. Select it in `src/monetization/providers.ts`, behind a config flag, and add a consent flow (GDPR/CCPA)
   before loading any ad SDK.
5. Update the privacy text in Settings and the store/privacy disclosures.

## Purchases (`src/monetization/purchases.ts`)

- `PurchaseProvider` with `DisabledPurchaseProvider` (production default) and `MockPurchaseProvider` (dev).
- Catalog: coin packs, a cosmetic bundle and "Remove Ads". Mock prices are labelled as mock.
- `grantPurchase` applies a transaction at most once (transaction id idempotency) and **refuses
  unverified transactions**. Only dev mock transactions (`mock_` prefix) may bypass verification, and
  only in development builds.

### Adding real purchases

- **Web:** use a payment provider such as Stripe Checkout. Create checkout sessions and verify
  webhooks on a server (for example a Supabase Edge Function). Never put secret keys in the client.
- **iOS / Android apps:** digital goods must use Apple In-App Purchase and Google Play Billing (for example
  via a Capacitor IAP plugin). Validate receipts server-side before granting entitlements.
- Grant premium currency and entitlements **server-side**, then sync to the client. The client
  `grantPurchase` path should then only accept `verified: true` results returned by your server.
