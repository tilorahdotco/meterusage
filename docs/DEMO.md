# Demo mode

Demo mode uses the real app views with invented data. Use it for screenshots
and UI inspection without exposing real accounts. The [current beta gallery](SCREENSHOTS.md)
shows Electron build 61. Old product captures have been removed.

## Electron browser preview

From the beta source checkout, after installing its declared dependencies:

```sh
node_modules/.bin/vp dev --mode demo --host 127.0.0.1
```

Open the printed address with `?surface=flyout`, `?surface=settings` or
`?surface=notch`. This dedicated demo mode uses the actual renderer and an
in-memory preview bridge. It has no native IPC, provider access or live network
transport. Native-only actions return an error. It does not validate Keychain,
window positioning, login items, sharing or other macOS behavior.

Provider marks exported during macOS packaging are needed for every icon to
render. Use those matching generated resources when capturing on Linux. Do not
substitute unrelated marks. Browser fonts and framing can differ from macOS.

## Electron candidate

After `pnpm build`, synthetic headless inspection uses:

```sh
meterusage_demo_root="$(node -p 'require("node:fs").realpathSync(require("node:os").tmpdir())')"
node dist/main/cli.cjs json --demo --candidate-profile "$meterusage_demo_root/meterusage-cli-demo"
```

For a packaged app on macOS, execute its binary directly:

```sh
./release/mac-arm64/MeterUsage.app/Contents/MacOS/meterusage --demo --candidate-profile /private/tmp/meterusage-native-demo
```

The profile must be empty on first use and use a canonical path. Symlink aliases,
including macOS `/tmp` and `/var`, are rejected. Reuse the same marked profile
for relaunch checks. Preferences, caches, history and Electron state stay there.
Live provider discovery, login-item changes and update installation are disabled.
Demo reset confirmation consumes only synthetic fixture credits.

### Native captures from an SSH session

`screencapture` cannot read the display from an SSH session. Start the
unpackaged app through Launch Services and capture each window's content over
Chromium DevTools instead. Use this only with a demo profile, because the
DevTools port exposes the renderer to local processes while the app runs:

```sh
open -n -a "$PWD/node_modules/electron/dist/Electron.app" --args "$PWD" \
  --demo --candidate-profile "$PWD/.demo-profile" --remote-debugging-port=9333
```

`http://127.0.0.1:9333/json/list` lists one page per surface (`?surface=settings`,
`flyout`, `notch`). `Page.captureScreenshot` returns its content without window
chrome. Finish onboarding in Settings to open the usage panel. The side notch
folds about 0.5 s after `notchSelect` when the pointer is elsewhere, so capture
right after selecting a provider. If `node_modules/electron/dist` is missing
after installation, run `node node_modules/electron/install.js`.

## Swift legacy demo

From the legacy Swift source in `legacy/swift/` on macOS, run from the repository root:

```sh
METERUSAGE_DEMO=1 swift run --package-path legacy/swift meterusage
```

The environment value must be exactly `1`. Swift demo mode swaps provider
sources at composition; it does not establish current Electron appearance.
Quit and relaunch normally to return to real data. Do not run legacy and beta
normal profiles together.

## Data and proof

Demo sources supply example allowances, reset windows, account balances and
local token/session activity. Local history and account allowance are separate
measurements in the real app. A Claude demo heatmap does not imply access to
Claude Desktop chat history. Missing provider-reported values stay unknown.

Public captures must use synthetic data and identify it as demo data. Browser
captures prove renderer output only. Native anchoring acceptance still needs
Mac captures for two providers with different card heights, as defined in
[ADR 0004](adr/0004-side-notch-anchor-invariant.md).
