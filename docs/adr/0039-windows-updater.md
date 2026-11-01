# ADR 0039: Windows updater without a code signature

- Status: Source implementation; CI exercises the installer handoff; real-machine acceptance pending
- Date: 2026-11-01
- Amends: [ADR 0038](0038-windows-ci-test-machine.md) ("Windows builds make no
  release check and offer no installation")
- Related: [ADR 0037](0037-opt-in-automatic-updates.md) (automatic install deferral)

## Context

Windows builds ship as an unsigned NSIS installer on GitHub pre-releases
(ADR 0038). The macOS updater checks GitHub's SHA-256 asset digest, then the
staged bundle's identity, version and code signature. A Windows build has no
Authenticode signature to check, and its installer replaces files that the
running app holds open.

## Decision

- **Assets.** Windows builds accept only `MeterUsage-<version>-win-x64.exe`,
  published under `tilorahdotco` or `pekth` (the existing `releaseOwners`
  list). macOS builds never select it, and Windows builds never select macOS
  ZIPs. A release without an asset for the platform is skipped, so Windows-only
  and macOS-only releases can be listed side by side. Beta builds read the
  release list and stable builds read `/releases/latest`, as on macOS.
- **Verification.** The download uses the existing host allowlist, redirect
  limit and size cap. The bytes must match the GitHub-reported `sha256:` digest
  exactly. A structure check then requires a PE executable (i386 or x64)
  carrying an NSIS payload. That check catches a wrong or damaged asset; it is
  not a signature.
- **Trust boundary.** Without a signature, the update is as trustworthy as
  GitHub's TLS-protected release API and the repository's release permissions.
  Anyone who can publish a release in the repository can ship code to Windows
  users who install updates. Release notes must say the build is unsigned.
- **Install location.** In-app installation runs only from an NSIS install
  folder, which holds `Uninstall MeterUsage.exe` next to `MeterUsage.exe`. Zip
  or portable copies show the offer but cannot install it, and must be replaced
  by hand.
- **Handoff.** The installer is staged in a new temporary folder with an
  exclusive write. It is not started until MeterUsage has completed its normal
  quit: settings saved, connections stopped and windows closed. It then starts
  detached and hidden with `/S --updated --force-run`. That is a silent
  per-user install which keeps app data and relaunches the app, as
  electron-builder's installer defines. No shell, script or elevation is used.
  The staged installer remains in the temporary folder; Windows cleans that up.
- **Automatic installs.** ADR 0037 applies unchanged. "Not in use" is checked
  before the download, after it, and after staging, just before control passes
  to quit. If MeterUsage comes into use, the install returns to idle with
  nothing staged for launch.

## Proof

Synthetic tests cover:

- asset selection by platform and owner;
- digest and structure rejection;
- refusing portable copies;
- launching only at quit, only once, with the fixed arguments;
- automatic-install deferral.

The CI install smoke run installs the packaged NSIS build silently, runs the
installed app, stops it, runs the same installer with `/S --updated --force-run`,
confirms the installed app relaunches, and uninstalls silently.

CI does not prove:

- an in-app download from a real release;
- an upgrade between two different versions;
- SmartScreen behavior;
- that user data is preserved across a real upgrade;
- recovery when the installer fails after MeterUsage has quit. In that case
  MeterUsage is not reopened, as on macOS.

## Consequences

- Windows users with **Check for updates** on are offered newer Windows
  pre-releases, and **Install updates automatically** works on Windows.
- A code-signing certificate would add a signature check here; this ADR would
  then be amended.
