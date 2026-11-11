# Releases and repository facts

Part of [project knowledge](../KB.md). Product summary, version pins, published betas and CI scope.

- meterusage is a macOS menu-bar app that displays AI coding-assistant quota and usage signals. `README.md` describes provider clusters, quota cards, heatmaps, sparklines, alerts, diagnostics, and a scriptable JSON CLI.

- `README.md` and `Scripts/make-app.sh` select the prebuilt Electron 0.3.0-beta.20 Apple silicon ZIP for macOS 13+. Installation needs no Node, pnpm, Swift, Xcode or Git. The script verifies SHA-256 and downloaded/staged signatures before replacing generated output, preserving the published signature and existing output on copy/verification failures. It rejects unsupported platforms and never compiles; `--build-from-source` exits with a pointer to `legacy/swift/Scripts/make-app.sh`, which builds legacy Swift for recovery/reference. Historical Swift 0.2.41 remains retrievable, ad-hoc signed and not notarized. GitHub source archives contain source and scripts, not an app bundle. See ADRs 0009 and 0034.

- `legacy/swift/Resources/Info.plist` and `CHANGELOG.md` record version 0.2.41, build 46, dated 2026-10-05. This release collects fresh quota observations after an accepted manual Codex reset, derives pacing and ETA from later usage growth, and removes the redeemed reset credit from archived quota data. The previous release was 0.2.40, which added accent colour themes, Codex cost estimates, and refreshed model prices. Repository version and release-note entries do not prove that a GitHub Release or its downloadable asset has been published.

- `CONTRIBUTING.md` requires focused changes, synthetic fixtures and affected-path checks: Electron typecheck/tests/build, plus legacy Swift build/tests only for changes inside `legacy/swift/`. `tests/scripts/make-app-tests.sh` (run in CI) checks the exact default beta pin, signature preservation, the moved `--build-from-source` option, that Swift never runs, and staged/download/verification/argument/platform failures without network or compiler access.

- GitHub Actions runs Electron typecheck, synthetic tests, production bundling and the installer script tests on Linux, plus the Windows package and smoke job, for pushes to `main` and pull requests. It no longer builds Swift (ADR 0045). This repository fact does not prove that a workflow run has passed.

- ADR 0010 selects macOS TypeScript/Electron/React with pnpm, Vite+, Tailwind, Vitest and electron-builder. Main owns provider files/keys, native actions and persistence; a separate sandbox-compatible preload exposes sender-validated IPC to React. The candidate keeps JSON/history/archive and known preference formats. Swift remains the oracle and rollback path. No server or remote control layer is added.

- Windows 0.3.0-beta.13, build 83, was published on 2026-11-01 as an unsigned pre-release (`--latest=false`) from `176b409` (includes the tilorahdotco release lookup, #99). Workflow run 41380556038; installer SHA-256 `35d49481…c2493f`, zip `6e777e77…3a44e5`. It is Windows-only: macOS updaters skip it.

- 0.3.0-beta.16, build 86, was published on 2026-11-02 for macOS and Windows in one release from `73ce30b` (Windows workflow run 41474197722; macOS built, signed and notarized on the Mac). One LF `SHA256SUMS` lists the macOS ZIP (`44d34e6c…87fe51`), the unsigned Windows installer (`07f5937b…5b1c8a`) and the portable zip (`197be91b…30b903`). Later releases follow this combined pattern.

- 0.3.0-beta.20, build 90, was published on 2026-11-07 for macOS and Windows from `f25f7c8` (easier-to-read reset times #121, Check for Updates in the tray menu #117, updater trusts only `tilorahdotco` #115; Windows workflow run 42341011274). `SHA256SUMS`: macOS ZIP `f1ee03d4…27a07c`, Windows installer `573d028a…897ab1`, portable zip `5574dfeb…d17d1`.

- 0.3.0-beta.19, build 89, was published on 2026-11-04 for macOS and Windows from `5cf9afc` (Claude per-model weekly limits such as Fable #114, Sponsor link #113; Windows workflow run 41768216629). `SHA256SUMS`: macOS ZIP `99e328ee…adb73f`, Windows installer `6201efd5…130bd4`, portable zip `e711068a…cb1beb`.

- 0.3.0-beta.18, build 88, was published on 2026-11-03 for macOS and Windows from `68ff0c8` (Claude free resets #107, CLI allowance reasons #109 and #111; Windows workflow run 41742128516). `SHA256SUMS`: macOS ZIP `030ca872…e700e3`, Windows installer `782d6609…35a60c`, portable zip `6c0b6bcd…cbdcb1`.

- 0.3.0-beta.17, build 87, was published on 2026-11-03 for macOS and Windows from `206384b` (wide Settings, #105; Windows workflow run 41577638081). `SHA256SUMS`: macOS ZIP `23a4f8d5…766f00`, Windows installer `1f285245…6b27aa3`, portable zip `58200a6d…35d517`.
