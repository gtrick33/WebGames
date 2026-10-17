# Monetization architecture

GlitchBound launches with **no ads, no purchases and no paid services**. What exists is a switched-off,
policy-friendly integration point for display ads, built the same way as NEON RUSH's (a publisher id that only
writes `ads.txt`, and a separate explicit switch that actually shows ads).

## Two different kinds of ads

| Where | Ad product | Status |
| --- | --- | --- |
| **Inside NEON RUSH** (rewarded "double coins", between-run interstitials) | Google **H5 Games Ads** (Ad Placement API), implemented in `neon-rush/src/monetization/adsense.ts` | Built, off. Controlled by NEON RUSH's own env vars. |
| **On GlitchBound pages** (homepage, game page side column) | Regular Google **AdSense display ad units** | Built, off. `src/components/AdSlot.tsx` |

They are configured separately, so you can turn on one without the other.

## Display ads on GlitchBound (`src/components/AdSlot.tsx`)

`<AdSlot placement="home" />` sits between the marquee and the arcade on the homepage; `<AdSlot placement="game" />`
sits at the bottom of the game page's side column. An ad renders **only** when all three are true at build time:

1. `VITE_ADSENSE_CLIENT` is a valid publisher id (`ca-pub-` + digits),
2. `VITE_ADS_ENABLED=on`,
3. a slot id is set for that placement (`VITE_ADSENSE_SLOT_HOME` / `VITE_ADSENSE_SLOT_GAME`).

Otherwise the component renders nothing: no script is loaded, no empty box is shown, no fake ad is drawn.

Rules the code follows:

- Never inside, over or around the game viewport. The game page ad is below the player's stats and controls.
- Always labelled "Advertisement".
- Space is reserved (min-height) so the page does not jump when an ad loads.
- The AdSense script is loaded once, lazily, only when an enabled slot is on screen.
- A failing ad never affects the page (errors are swallowed).
- `/privacy` automatically switches its "Advertising" section to describe Google ads when ads are on.

### Consent (EU, UK, Switzerland)

Use Google's own certified CMP: AdSense > **Privacy & messaging** > **European regulations** > create a message for
the site. Google's script shows it automatically, so no code change is needed. Do this before switching ads on.

## Adding another ad network

1. Check the network's policy allows a games portal and iframed games.
2. Implement it next to `AdSlot` following the network's **official** docs (don't guess SDK methods).
3. Put it behind its own env switch, default off, and load its script lazily.
4. Add it to the consent flow and to the text on `/privacy`.

## Not built (on purpose)

- **Purchases, subscriptions, "remove ads".** GlitchBound has no accounts, so there is nothing to attach a purchase
  to. NEON RUSH has its own purchase architecture (see `neon-rush/docs/MONETIZATION.md`); real money there needs app
  store billing or Stripe plus a server.
- **Sponsorships or "promoted" games.** If ever added, label them clearly in the registry and the UI.
- **Fake ads or placeholder ad boxes.** None are shown anywhere.
