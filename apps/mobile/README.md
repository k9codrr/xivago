# Xivago mobile (Android + iOS)

Native Capacitor shell that loads the live site, `https://app.xivago.com`
(`server.url` in `capacitor.config.json`). Web changes ship by deploying
`apps/web`. Rebuild the app only when native config or plugins change.

## Screenshot blocking

`@capacitor-community/privacy-screen` is installed but starts **off**
(`plugins.PrivacyScreen.enable: false`). `apps/web/src/components/screenshot-guard.tsx`
turns it on while a demand's full view is open and turns it off again afterwards:

- **Android:** `FLAG_SECURE`. Screenshots and screen recordings come out black.
- **iOS:** `preventScreenshots: true`. Screenshots and recordings of the app come out blank.

## Requirements

- Node **22+** for the `cap` CLI. With Node 20, prefix commands with
  `npx -y -p node@22`, e.g. `npx -y -p node@22 node node_modules/@capacitor/cli/bin/capacitor sync`.
- Android: Android Studio (bundled JDK 21) and a Google Play developer account.
- iOS: a Mac with Xcode 26+ and an Apple Developer account. Swift Package Manager is used, so no CocoaPods is needed.

## Commands (run in `apps/mobile`)

```sh
pnpm install
pnpm sync       # after changing capacitor.config.json or adding plugins
pnpm android    # opens Android Studio -> Run, or Build > Generate Signed Bundle (.aab) for Play Store
pnpm ios        # opens Xcode (Mac only) -> set Team/Signing -> Run, or Product > Archive for App Store
```

App id: `com.xivago.app`. Change it in `capacitor.config.json`, `android/app/build.gradle`
and the Xcode project **before** the first store upload. It can't change afterwards.

App icons and splash screens are still the Capacitor defaults. Generate them with
`npx @capacitor/assets generate` using a 1024x1024 `assets/icon.png`.
