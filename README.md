# vitrine

Play Store screenshot pipeline CLI. Capture Android app screenshots with
[Maestro](https://maestro.mobile.dev), frame them into store-ready images, and
publish them to a Google Play listing via the Play Developer API — one command,
no design tool, no fastlane.

> **Status:** milestone 1 (`capture`) implemented. `frame` and `publish` land in
> subsequent milestones.

## How it works

```
screenshots.config.ts ──► vitrine capture ──► screenshots/raw/*.png
                          vitrine frame   ──► screenshots/framed/*.png   (soon)
                          vitrine publish ──► Google Play listing        (soon)
```

Each command is independently runnable and shares one config file.

## Requirements

- Node.js 20+
- [`maestro`](https://maestro.mobile.dev/getting-started/installing-maestro) on your PATH
- Android platform-tools (`adb`) on your PATH
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) set if you want vitrine to boot an AVD for you

## Install

Until this is published to npm, install the packed tarball as a dev dependency
in your app repo:

```bash
# in the vitrine repo
npm pack                       # produces vitrine-0.1.0.tgz

# in your app repo
npm install --save-dev ../vitrine/vitrine-0.1.0.tgz
```

## Configure

Create `screenshots.config.ts` at your app repo root (see `example/` here for a
complete sample):

```ts
import { defineConfig } from "vitrine";

export default defineConfig({
  app: {
    packageName: "com.example.myapp",
    // apkPath: "./builds/app-release.apk", // optional; omit if already installed
  },
  device: { avd: "Pixel_7_API_34", locale: "en-US" },
  frame: {
    template: "gradient",
    background: ["#1a1a2e", "#16213e"],
    textColor: "#ffffff",
    font: "Inter",
  },
  publish: {
    serviceAccountKeyPath: "./secrets/play-service-account.json",
    track: "listing",
  },
  screens: [
    { id: "home", flow: "flows/home.yaml", caption: "Track everything in one place" },
    { id: "profile", flow: "flows/profile.yaml", caption: "Your data, your way" },
  ],
});
```

`.ts`, `.js`, `.mjs`, and `.json` config files are all supported.

## Writing flows

vitrine is **not** a Maestro test runner. Each flow's only job is to reach one
screen in a known-good state and call `takeScreenshot` once. Two rules:

1. **The `takeScreenshot` name must equal the screen `id`.** vitrine validates
   this before running and errors clearly on a mismatch.
2. **Seed deterministic state** (`clearState: true`, fixed demo data) so re-runs
   produce visually identical screens — this feeds the golden-image pipeline in
   `frame`.

```yaml
# flows/home.yaml
appId: com.example.myapp
---
- launchApp:
    clearState: true
- assertVisible: "Home"   # readiness gate, not the flow's purpose
- takeScreenshot: home    # name === screen id
```

### Expo Router: deep-link to screens

If your app uses [Expo Router](https://docs.expo.dev/router/introduction/),
every route is a URL. Deep-linking straight to a screen is more deterministic
than tapping through the UI and survives navigation refactors — prefer it.

Set a scheme in `app.json` (`{ "expo": { "scheme": "myapp" } }`); Expo Router
derives link paths from your file routes:

| Route file | Deep link |
|---|---|
| `app/index.tsx` | `myapp://` |
| `app/(tabs)/home.tsx` | `myapp://home`  *(the `(tabs)` group is omitted)* |
| `app/settings/account.tsx` | `myapp://settings/account` |
| `app/user/[id].tsx` | `myapp://user/42` |
| `app/search.tsx` | `myapp://search?q=trees` |

```yaml
# flows/profile.yaml — reach the route directly, then capture
appId: com.example.myapp
---
- launchApp:
    clearState: true
- openLink: myapp://profile
- extendedWaitUntil:        # waits for async screens (vs. failing instantly)
    visible: "Your data, your way"
    timeout: 10000
- takeScreenshot: profile
```

Notes:

- A **dev-client** build registers the custom scheme, so `myapp://…` works
  against the installed build (Expo Go uses `exp://` and is not the target here).
  Sanity-check once with:
  `adb shell am start -a android.intent.action.VIEW -d "myapp://profile" com.example.myapp`
- Pass ids/params through the URL (`myapp://user/42`) to seed stable demo data,
  so re-runs are visually identical — this feeds the golden-image pipeline.
- For screens that aren't directly routable (modals, bottom sheets), fall back to
  `tapOn: { id: "your-testID" }`. Prefer `testID` selectors over visible text.
- Add `waitForAnimationToEnd` before `takeScreenshot` if a screen animates in, so
  captures are pixel-stable.

See `example/flows/` for deep-link (`profile.yaml`), nested-route (`settings.yaml`),
and launch-based (`home.yaml`) variants.

## Capture

```bash
npx vitrine capture                       # capture every configured screen
npx vitrine capture --only home,profile   # capture a subset
npx vitrine capture --serial emulator-5554  # target a specific device
npx vitrine capture --config ./path/to/screenshots.config.ts
```

What it does:

1. Loads and validates the config.
2. Detects a running emulator via `adb devices`; if none, boots the configured
   AVD and waits for boot to complete.
3. Installs `apkPath` (`adb install -r`) if set, otherwise verifies the package
   is already installed.
4. Runs each screen's flow in config order, writing `screenshots/raw/<id>.png`.
5. Prints a summary table and exits non-zero if any screen failed.

Capture works against **any installed build** (Expo dev client or an old APK) —
it never triggers a production build.

## Development

```bash
npm install
npm run lint        # biome (lint + format check)
npm run format      # biome --write (apply fixes)
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsdown → dist/ (ESM + .d.ts + bin)
```

CI (GitHub Actions) runs lint, typecheck, tests, and build on Node 20 and 22
for every push to `main` and every pull request.

## License

MIT
