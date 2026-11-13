# Project knowledge

Release documentation refresh: 2026-11-07 for build 90.

## Contributor checks

- The pre-commit credential and personal-path checks consume complete staged
  input so large diffs cannot hide matches through SIGPIPE under `pipefail`.
  `python3 .githooks/test-pre-commit.py` exercises the hook in disposable repos
  with synthetic data.

## Renderer provider marks

- Side-notch rings center an 18-pixel inner disc and 14-pixel provider mark
  inside the 22-pixel meter. Even frame sizes avoid half-pixel icon origins;
  Grok retains its existing optical correction for asymmetric artwork.

- The OpenRouter, Cursor, Copilot and Gemini masks are checked-in PNG exports
  of the existing SF Symbol stand-ins. Renderer builds copy `Resources/`
  without requiring a fresh macOS symbol export.
- `Resources/muse-code-logo.svg` contains Meta's official infinity mark used
  on the [Muse Code site](https://dev.meta.ai/products/muse-code), from
  [Meta's logo asset](https://dev.meta.ai/logo/meta-logo-with-text.svg).
  The Meta text paths were removed and the viewBox narrowed to the unchanged
  infinity paths. It is a Meta mark, not a separate Muse product logo.
  The renderer applies the existing provider and service-status tint.

## Distribution and recovery

- [ADR 0034](adr/0034-electron-beta-default.md) makes Electron beta the sole
  offered app and default installer target. [ADR 0024](adr/0024-electron-primary-swift-retirement.md)
  keeps Electron as the sole feature target. [ADR 0045](adr/0045-swift-moved-to-legacy.md)
  moves the frozen Swift package, sources, tests and build scripts under
  `legacy/swift/` and removes them from CI. Historical Swift releases remain
  recovery/reference material. Deletion is still pending. Required Swift
  helpers (`Scripts/electron/*.swift`) and shared `Resources/` assets stay.
- `Scripts/make-app.sh` pins [Electron 0.3.0-beta.20, build 90](BETA.md), its
  `-mac-arm64.zip` filename and SHA-256. It verifies the download and staged
  signature before replacement, preserves the published signature, and never
  falls back to a compiler. Preparing output does not install the app.
- This remains a beta, signed/notarized for Apple silicon. Stable/native
  acceptance is incomplete. Source manifests retain 0.2.41; packaging sets the
  beta version and Settings shows the running bundle version.
- Both implementations remain in their current source trees. Shared app name,
  bundle ID and default data/preferences prevent safe normal-profile coexistence.
  Use only documented isolated QA profiles. Default distribution changes do not
  alter data, identity, workflows, releases or stable acceptance requirements.
- The repository was transferred from `pekth` to `tilorahdotco` on 2026-11-01
  (same repository ID). Since the `pekth` name became free to register,
  the updater accepts release assets only under
  `github.com/tilorahdotco/meterusage` (`releaseOwners` in
  `src/main/updater.ts`); a `pekth` URL is rejected. Current source looks up
  releases at `tilorahdotco`. Builds released before PR #99 (beta 12 and Swift)
  still call the `pekth` API endpoints and accept `pekth` assets; code cannot
  change that.
  Electron betas 1–11 accept only `pekth` assets. Builds that updated to beta 12
  before the transfer (as an installed beta 11 did automatically on 2026-11-01)
  keep updating; a build still on an earlier beta needs beta 12 or later
  installed manually. Swift checks no owner. Never create or fork `meterusage`
  under `pekth`, because that ends the redirect.
- Swift and stable Electron updaters use GitHub's latest-release endpoint.
  Electron beta builds (version `-beta.N`) read the release list and accept
  `-mac-arm64` assets, so beta 5 onward offers newer betas or a newer stable
  release. Checks run hourly when enabled, with a notification and installation
  confirmation. See [update channels](VERSIONS.md#update-channels).
- Current source shares an inline-icon update notice between Usage and Settings
  > General using `state.update` and existing Install/Retry/Dismiss actions.
  Pending requests/downloads/installs disable both actions; failed offers retain
  retry. Existing projection hides absent/dismissed/disabled/demo offers. Beta.8 ships
  this notice.
- Beta.11 resolves the temporary root before validating staged bundle links,
  so macOS aliases do not reject internal framework links. Its distribution ZIP
  omits `__MACOSX` entries, which the updater rejects. The final ZIP must pass
  native staging, signature and stapled-ticket checks. Older beta installers
  may need one manual install to receive the temporary-root fix.
- Beta.11 adds **Install updates
  automatically** (`updateAutoInstall`, off by default). It installs an offered,
  undismissed, newer release without the confirmation dialog through the
  verified install path. It requires a packaged app and no failed install this
  session. It also requires that MeterUsage isn't in use: usage panel, Settings
  and share windows hidden, side notch collapsed, no share, reset or update
  confirmation, sign-in or API billing fetch running. This is rechecked after
  download and before the installer starts; if it fails, the install returns to
  idle and retries later. On 2026-11-01 an installed beta 11 with the setting on
  replaced itself with beta 12 and relaunched; broader native install acceptance
  is pending. See
  [ADR 0037](adr/0037-opt-in-automatic-updates.md).
- Installed beta 5 recorded discovery of beta 6 on 2026-10-22. Automated
  installation and relaunch were not completed; native UI control was unavailable.
- Swift-to-Electron native upgrade and rollback remain blocked pending a
  separate macOS test user or VM. Swift 0.2.41 requires the unsuffixed
  `MeterUsage-<version>.zip` release asset and a GitHub SHA-256 digest. Its
  install script re-signs the replacement ad hoc, so the installed signature
  and native helper behavior need explicit acceptance. Both editions share
  the preferences domain, durable history and quota archive without a bulk
  migration. Neither updater retains a persistent rollback copy. See the
  [stable cutover checklist](VERSIONS.md#stable-cutover-checklist).
- Candidate gaps include Settings account overview, seven-day sparkline, reset
  timing display, detailed update progress/release notes and tray refresh.
  Smaller display omissions remain distinct. Current source adds AG Desktop/OpenCode setup, restores Bun
  discovery and matches activity grid geometry. See the candidate guide.
- Earlier edition documentation was reconciled against revision
  build source `6ce695324e54bb09bf6e5ab36fd4733875c94427`.
- Current product screenshots use build 61's renderer and synthetic demo data.
  Old product captures are removed; see [capture provenance](SCREENSHOTS.md).

## Repository state

- Default branch: `main`. The Electron integration merged through PR #76 as
  `0d514dd`, with 855 TypeScript tests, typecheck/build, Swift build and 410
  tests, passing hosted CI and independent source review. Beta.7 includes the
  account-history fixes and PR #78 provider-icon repair.
  The latter passed 860 TypeScript tests, typecheck/build, Swift build and 410
  hosted Swift tests, plus independent source review. These checks do not prove
  native updater installation or the isolated Swift cutover.
- Swift baseline revision: `4b913db3a3a8eb2602296489872af2ecaa5d0530`. The Electron candidate is the accompanying migration change; native acceptance remains open.
- This index is public-safe repository documentation. It does not prove current local provider state, runtime behavior, release availability, or external service state.

## Product and source facts

These facts are split by topic so each file stays small:

- [Provider sources and accounts](kb/providers.md): Provider readers, desktop connections, account slots and live test profiles.
- [Electron app behavior](kb/app.md): Settings, onboarding, cards, heatmaps, side notch, history and lifecycle in the Electron app.
- [Windows](kb/windows.md): Windows paths, file trust, CLI discovery, packaging, tests, updater and CI.
- [Releases and repository facts](kb/releases.md): Product summary, version pins, published betas and CI scope.
- [Legacy Swift and migration evidence](kb/legacy-swift.md): Facts about the frozen Swift app and the Swift-to-Electron migration proof.

## Verification gaps

- Claude Desktop GUI connections and subsequent allowance polling share one HTTP
  transport. Only the fixed bootstrap and UUID-bound usage routes use a unique
  nonpersistent Electron session with caching disabled and ambient credentials
  omitted. Demo, JSON and Codex test paths do not use this native session. Source
  and synthetic checks do not establish native cookie handling or provider acceptance.

- The Electron candidate still needs native GUI launch/relaunch, preferences/account/offline journeys, tray/focus/accessibility, notification/login/share/updater paths, drag/display persistence and two different-height notch captures. Verified packaging and headless JSON cannot close migration or cutover.
- Repository files do not prove current provider authentication, quota freshness, network responses, local machine state, app installation, signed-bundle state, GitHub Release state, or runtime UI behavior.
- Treat cost figures as estimates. `README.md` identifies provider dashboards as the billing source of record.

## Public disclosure boundary

- This KB contains only public repository facts. Do not add private paths, account identifiers, tokens, prompts, source transcripts, internal agent instructions, private repository references, or personal data.

## Repository references

- [`README.md`](../README.md): product behavior, setup, provider boundaries, and public claims.
- [`docs/PRIVACY.md`](PRIVACY.md): data-handling boundaries and enforcement claims.
- [`docs/DEMO.md`](DEMO.md): synthetic demo mode.
- [`docs/SIDE-NOTCH.md`](SIDE-NOTCH.md): side notch states, anchor and geometry invariants, interaction, and verification.
- [`docs/adr/0006-managed-account-list.md`](adr/0006-managed-account-list.md): current managed-account decision.
- [`docs/adr/0010-macos-typescript-electron.md`](adr/0010-macos-typescript-electron.md): macOS migration and Windows hold, amended by ADR 0038.
- [`docs/adr/0038-windows-ci-test-machine.md`](adr/0038-windows-ci-test-machine.md): Windows resumed with CI as the test machine; what CI does and does not prove.
- [`docs/mockups/README.md`](mockups/README.md): Wave 1–3 concept mockups; provider marks stay.
- [`docs/plans/feature-and-windows-pipeline.md`](plans/feature-and-windows-pipeline.md): superseded platform plan, current macOS direction and Windows stages on CI.
- [`legacy/swift/Package.swift`](../legacy/swift/Package.swift): frozen legacy Swift package targets and platform requirement.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): contribution and validation commands.
- [`CHANGELOG.md`](../CHANGELOG.md): repository release-note history.
- [`AGENTS.md`](../AGENTS.md): public-safe repository operating and knowledge-maintenance rules.
- [`docs/adr/README.md`](adr/README.md): decision index.

## CI workflow maintenance

- [ci.yml](../.github/workflows/ci.yml) uses full-SHA v7 pins for `actions/checkout`. Application language versions and explicit cache settings are preserved.
- Obsolete runs for the same pull request or branch are cancelled. Existing timeout caps are preserved.

Reviewed Swift base: `4b913db3a3a8eb2602296489872af2ecaa5d0530`. Source checks do not prove runtime, deployment or device behavior.

- Electron Diagnostics restores explicit **Send report** through the existing private support relay. Main generates the same allowlisted status summary used by Copy diagnostics with the running app version; renderer IPC accepts intent only. In-flight clicks are deduplicated, uncertain retries reuse the report UUID/snapshot, and a matching HTTP201 receipt supplies the support reference. No raw logs, account labels/IDs, paths, credentials or transcripts are uploaded. See [REPORTING.md](REPORTING.md). Transport fixtures do not prove live Linear delivery.

- Grok is labeled **Beta** in Electron usage cards, setup and provider settings. Official-source desktop research found X Subscription per-seat shared Grok/Cursor usage, unified local Antigravity authentication and API-key-based OpenCode Go setup. Those research findings alone do not establish connections. The source-only Bot Desktop Beta implementation is documented in [ADR 0028](adr/0028-grok-bot-desktop-reader.md), with saved Cursor compatibility in ADR 0027; universal shared-pool coverage remains unverified. See [desktop login research](DESKTOP-LOGIN-RESEARCH.md).

- Diagnostic report attempts have a 10-minute main-process cooldown persisted as a private native preference before HTTP. Relaunch and failed sends retain the limit. Storage failure prevents transmission; Copy diagnostics remains available. Only the timestamp persists, with no report content, account identifier or receipt. See [REPORTING.md](REPORTING.md).

- OpenCode Go has an explicit local setup action. Local Go session history needs
  no key; allowance uses the existing Go key. CLI fallback includes executable
  `~/.bun/bin/opencode`. Coverage remains Go-only.
- Activity heatmaps use one 26-column, seven-row layout. Thirty-day telemetry
  leaves older dates unavailable. Local-day and OpenRouter UTC scope are retained.

Completed-onboarding launches preload the usage window hidden before connection
recovery and provider collection. The first tray click reuses that renderer;
fresh provider data still depends on its source. Incomplete onboarding continues
to open Settings. No window is shown or focused by preload.

## API billing and Grok compatibility follow-up

- OpenAI API and Anthropic API are independent billing snapshots, not quota
  provider slots. Settings → API connections accepts a one-time masked Admin
  key and fetches billing without Terminal. The field clears on submit or
  leaving the page. On macOS, the **Save key in macOS Keychain** option starts
  selected and saves the key after a successful fetch. A failed save preserves the
  new snapshot and reports a fixed error. With a key in the field, **Use saved key**
  fetches with that key (and saves it when selected, which may replace the
  saved key). With an empty field it reads only the selected provider's
  `com.meterusage.api-keys` Keychain entry without returning the key to the
  renderer ([ADR 0048](adr/0048-save-api-keys-by-default.md)). It runs only on request. A bundled environment-only helper
  remains available. Both paths use fixed cost endpoints and projected
  owner-only USD files. Cards retain the
  reported UTC period, exact capture time and explicit stale state. Empty
  reports do not become zero usage. Real organization billing remains unverified.
- The OpenAI API card also shows the remaining balance. It comes from the
  undocumented `credit_grants` report, labelled unofficial. If that fails, it
  falls back to an estimate: the prepaid amount and UTC date entered in Settings,
  minus documented spend since that date. Balance failures never fail the spend
  fetch. A live dev-build fetch on 2026-10-31 with an organization Admin key
  stored spend but no credit grants balance; why it returned none was not
  captured. See [ADR 0035](adr/0035-openai-remaining-balance.md).
- Both API cards show **Total credit**, **Used** and **Left** from one balance.
  The heading names the snapshot's UTC month, such as **$3.42 in November**. Anthropic has no balance
  endpoint, so its card uses the same prepaid estimate from per-provider
  Settings values. **Renews monthly** counts spend from the latest renewal day.
  Whether `cost_report` includes credit-paid usage is unverified. See
  [ADR 0049](adr/0049-api-credit-total-used-left.md).
  See [API billing](API_USAGE_BETA.md) and [ADR 0029](adr/0029-api-billing-snapshots.md).
- The Grok Bot encrypted reader accepts canonical v10 legacy values with the
  same full-subject active-account binding as scoped envelopes. Its fixed
  Keychain pair is Grok Bot Safe Storage / Grok Bot Key. Native metadata confirms
  these shapes; access and live allowance remain separate gates. See
  [ADR 0030](adr/0030-grok-bot-encrypted-compatibility.md).

- On 2026-11-01, Cursor's `GetSandUsageStatus` returned HTTP 500 `internal`
  for a unified (`isUnified: true`) Grok account. With Grok Bot's client headers
  it did not answer within 60 seconds. Other Dashboard endpoints answered with
  the same valid token. Binary protobuf, client headers and a machine checksum
  did not change the result. Refreshes now fall back to Grok Bot's
  cached reading for the verified account, labelled with its read time. See
  [ADR 0036](adr/0036-grok-bot-usage-cache-fallback.md).
- Grok Bot Desktop quota burn uses live same-account observations spanning at
  least one minute and no more than five minutes. It reports percentage points
  per hour and can estimate run-out without assuming a quota-cycle duration.
  Missing/stale reads, reconnects, source changes and resets clear measurement.
  Archives retain quota but discard these observation baselines. No token or
  dollar rate is derived. See [ADR 0031](adr/0031-grok-quota-burn.md).
- API setup has its own Settings category, separate from account connections
  and onboarding. Fetch billing updates the snapshot automatically; ordinary
  Refresh only rereads it. The advanced helper retains key-free macOS zsh
  commands and a hidden prompt. See [ADR 0032](adr/0032-one-time-api-setup.md)
  and its storage amendment, [ADR 0047](adr/0047-opt-in-api-key-saving.md).
  Real organization billing remains unverified.

## Retained Swift reporting source

Main's Swift reporting client, native-consent bug draft CLI and their tests
remain in the retained Swift tree. Their diagnostic payload and user flow
differ from Electron. See [the Swift reporting contract](../legacy/swift/REPORTING.md)
and its activation evidence; this does not add them to Swift 0.2.41.

## Instabox Actions runners

Ubuntu jobs in `.github/workflows` use `instabox-medium` instead of GitHub-hosted runners. Job steps, triggers, permissions and timeouts are unchanged. No macOS job remains; the Swift CI job was removed by ADR 0045. Source configuration alone does not prove execution on Instabox.
