# Mobile apps (future)

The web build is a responsive PWA (installable, offline-capable). **It is not an App Store or Google Play
release.** To ship native apps, wrap it with Capacitor:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "NEON RUSH" com.yourstudio.neonrush --web-dir=dist
npm run build
npx cap add ios && npx cap add android
npx cap sync
```

## iOS
- Requires a Mac with Xcode and an Apple Developer account ($99/year).
- `npx cap open ios`, set signing team and bundle id, test on simulators and real devices.
- Lock orientation to portrait, check safe areas (the CSS already uses `env(safe-area-inset-*)`).
- Ship via TestFlight, then App Store review.

## Android
- Android Studio + JDK. `npx cap open android`, create a signed release bundle (`.aab`).
- Test on a low-end device for performance (enable "Battery saver" in game settings if needed).
- Google Play Console account (one-time $25). Internal testing, then closed testing, then production.

## Native ads and purchases
- Ads: AdMob through a maintained Capacitor plugin. Implement `AdProvider` with it, and add an
  ATT prompt (iOS) and a UMP consent form (EU) before requesting ads.
- In-app purchases: Apple IAP / Google Play Billing (for example via a Capacitor IAP plugin). Verify receipts
  server-side (see BACKEND.md) and implement `PurchaseProvider`. Stores require their billing for digital goods.

## Store listing checklist
- Icons: generate all sizes from `public/icon.svg` (for example with `@capacitor/assets`). Make a 1024x1024 App Store icon.
- Screenshots for each required device size. Short and long descriptions. Age rating questionnaire.
- Privacy policy URL, App Store privacy "nutrition label" and Play Data safety form. These must reflect
  any ad, analytics or backend SDKs you add (v1 collects nothing).
- Content: original art and audio, Orbitron font (OFL), no third-party brands.
