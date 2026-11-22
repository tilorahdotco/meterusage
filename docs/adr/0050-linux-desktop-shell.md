# ADR 0050: Add the Linux desktop shell with CI as the test machine

- Status: Stage 1 implemented; first Linux pre-release published (0.3.0-beta.28); updater, desktop connections and real-desktop acceptance pending
- Date: 2026-11-21
- Amends: [ADR 0038](0038-windows-ci-test-machine.md) ("Linux remains
  unsupported for the desktop shell")

## Context

The Electron app refused to start on Linux with "MeterUsage desktop candidates
currently support macOS and Windows only." Headless `json` worked. Users on
Linux run the same CLIs (Codex, Claude Code, Antigravity, OpenCode, Grok) and
want the tray app. There is no physical Linux desktop for acceptance. The
GitHub Actions `ubuntu-latest` runner and Xvfb are the test machine, as the
Windows runner is for ADR 0038.

## Decision

Add Linux in stages, like Windows:

1. Platform foundation, desktop shell, unsigned AppImage and tar.gz x64
   packages, and a CI job that packages the app and smoke-tests it on a
   virtual display. This ADR implements stage 1.
2. A Linux updater, with its own asset and the same GitHub SHA-256 digest
   check. A separate ADR records it.
3. Linux desktop account connections (Claude Desktop, Grok Bot Desktop,
   Antigravity Desktop) through the Secret Service and Linux paths, with
   synthetic fixtures. A separate ADR records it.
4. A published Linux pre-release and user docs, only after the CI smoke run
   passes.

Stage 1 sets these platform rules:

- **Data location.** App data lives in `$XDG_CONFIG_HOME/MeterUsage`.
  MeterUsage uses `$XDG_CONFIG_HOME` only when it is an absolute path under the
  home folder, and otherwise uses `~/.config`. This matches Electron's own
  Linux `userData` folder and keeps isolated test homes away from the real
  profile. `localRoot` is the same folder on Linux.
- **Preferences.** Linux has no `defaults` domain. Installed Linux apps keep
  known keys in `preferences.json` through the validated, atomic writer that
  Windows and isolated profiles use. A damaged file is renamed to
  `preferences.json.damaged-<time>`.
- **File trust.** Linux keeps the POSIX owner, mode, symlink, link count and
  size checks.
- **CLI discovery and spawning.** Linux uses the existing POSIX search
  (`/opt/homebrew/bin`, `/usr/local/bin`, `~/.cargo/bin`, `~/.bun/bin` for
  OpenCode, `~/.local/bin`, then `PATH`) and spawns binaries directly.
- **Desktop connections.** The Claude Desktop, Grok Bot Desktop and
  Antigravity Desktop readers use macOS Keychain and `ps`/`lsof` helpers, so
  Linux shows them as unsupported and refuses to connect. The Settings help
  text says so. The Codex connection is offered. It uses the Codex CLI on the
  usual paths, and its child environment adds `DBUS_SESSION_BUS_ADDRESS` and
  `XDG_RUNTIME_DIR` so the Codex keyring can reach the Secret Service. API
  billing hides **Use saved key**, a macOS Keychain item.
- **Shell.** Linux shows the colored app icon in the system tray, with usage in
  its tooltip; the wide text tray image is macOS only. The tray uses a fixed
  context menu (Open MeterUsage, Settings…, Quit MeterUsage), because Linux
  status notifier hosts may not report clicks. Linux trays report no icon
  position, so the flyout opens at the pointer. **Copy card image** puts the
  card on the clipboard. Settings has no default Electron menu bar. The side
  notch is a normal always-on-top window (no macOS panel type). SIGTERM and
  SIGINT quit through the normal cleanup, so logout ends the app.
- **Launch at login.** Electron's login item API does not support Linux. The
  toggle writes or removes the XDG autostart entry
  `$XDG_CONFIG_HOME/autostart/dev.meterusage.app.desktop`. `Exec` starts the
  AppImage file when `APPIMAGE` names an existing absolute file, and otherwise
  the executable. A path with `"`, `` ` ``, `$`, `\`, `%`, `=` or a control
  character is refused, so it never needs desktop-entry escaping.
- **Headless JSON.** Chromium picks its display platform before app code runs,
  so `meterusage json` needs an X or Wayland display. On a server or over SSH,
  pass `--ozone-platform=headless`.
- **Updates.** Linux builds make no release check and offer no installation.
  Settings hides the update toggles and points to the GitHub release page. The
  tray menu has no Check for Updates.
- **Packages.** `pnpm package:linux` builds unsigned
  `MeterUsage-<version>-linux-x64.AppImage` and `.tar.gz`. The executable is
  `meterusage`.

## Chromium sandbox

Renderer windows use `sandbox: true`. Ubuntu 24.04 and later restrict the
unprivileged user namespaces that Chromium's sandbox uses. There the unpacked
build or tar.gz needs `chrome-sandbox` owned by root with mode 4755, as a system
package sets it. An AppImage cannot carry a setuid helper, so on those systems it
needs an AppArmor profile that allows user namespaces. MeterUsage does not ship
or recommend `--no-sandbox`. The CI job sets the setuid helper so the smoke run
keeps the sandbox on.

## What CI proves and what it does not

The `linux` CI job builds, packages the AppImage and tar.gz, and runs
`Scripts/electron/linux-smoke.sh` on the unpacked build:

- packaged `node:sqlite` works under `ELECTRON_RUN_AS_NODE`;
- headless `json --ozone-platform=headless`, with no display, exits cleanly and
  prints a valid schema-1 report for a synthetic demo profile and the runner's
  real (empty) profile;
- on Xvfb, a demo first launch shows Settings, and a relaunch of the same
  profile with onboarding complete shows the usage flyout and the side notch;
- screenshots are uploaded as workflow artifacts when ImageMagick or ffmpeg is
  present.

CI does **not** prove: real provider accounts or CLIs; the Codex connection
against a real Secret Service; tray icons, menus or tooltips in GNOME, KDE,
Xfce or other status notifier hosts; Wayland; flyout placement beside a real
panel; AppImage desktop integration or the AppArmor case; autostart at a real
login; notifications; multi-monitor or high-DPI behavior; keyboard or
screen-reader use; sleep and resume; or ARM64. Linux support claims stay
limited to what the CI job records until someone tests a real Linux desktop.

## Consequences

- macOS and Windows behavior is unchanged.
- Test files whose fixtures model the macOS shell call `modelMacOSHost()` from
  `tests/macos-host.ts`. On a Linux host they would otherwise take the Linux
  branches. `tests/linux.test.ts` covers the Linux branches on every host.
- No Linux build is published until stage 4.

## Amendment (2026-11-21): first Linux pre-release

The owner chose to publish Linux before stages 2 and 3, under stage 4's
condition that the CI smoke run passes. 0.3.0-beta.28, build 99, ships an
unsigned `MeterUsage-<version>-linux-x64.AppImage` and `.tar.gz` in the same
release and `SHA256SUMS` as macOS and Windows. The packages were built from the
release commit on an x64 Linux host with the release version and build, passed
`Scripts/electron/linux-smoke.sh` on Xvfb with the sandbox on, and the AppImage
produced a demo JSON report. Linux still has no updater: macOS and Windows
updaters match only their own asset names, so the Linux files do not affect
them. Release notes and the README state the missing updater, the unsupported
Desktop connections, the FUSE 2 and sandbox requirements, and that no real
Linux desktop has tested the build.
