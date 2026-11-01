# ADR 0037: Opt-in automatic update installation

- Status: Source implementation; native install acceptance pending
- Date: 2026-11-01
- Amends: [ADR 0034](0034-electron-beta-default.md) ("Keep … explicit installation
  confirmation" and "Add no … configuration"): confirmation stays the default;
  this adds one opt-in setting

## Context

The Electron updater checks GitHub hourly and offers **Install update**, which
asks for confirmation before it downloads, verifies and replaces the app. Users
who want fixes without clicking had to notice the offer and confirm it.

## Decision

Add one boolean preference, **Install updates automatically**
(`updateAutoInstall`), off by default and available only while **Check for
updates** is on.

When it is on, an offered release installs without the confirmation dialog only
when all of these hold:

- the app is packaged and not a demo or candidate profile;
- the release is newer, offered by the existing check and not dismissed;
- no install is running or has failed in this session;
- the usage panel, Settings and share windows are hidden, the side notch is
  collapsed and not being dragged, and no share or reset confirmation is open.

It uses the existing install path unchanged: the same GitHub SHA-256 digest,
bundle identity and signature checks, staged replacement and relaunch. A failed
automatic install sets the existing failed state and is not retried until the
next launch; the manual **Install update** path stays available. The update
notification says the version will install when MeterUsage is not in use.

No new update channel, endpoint, dependency or telemetry is added.

## Consequences

- With the setting on, MeterUsage may quit and relaunch itself between uses.
- Turning off **Check for updates** also stops automatic installation.
- Installation through the in-app updater, manual or automatic, still needs
  native acceptance on a packaged build.
