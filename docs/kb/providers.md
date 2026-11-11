# Provider sources and accounts

Part of [project knowledge](../KB.md). Provider readers, desktop connections, account slots and live test profiles.

- Claude Connect recognizes HTTP 403 responses with an explicit
  `cf-mitigated: challenge` header as provider browser verification blocking
  automation. It reports a fixed message and preserves the current source.
  The failed Desktop method offers a manual usage-page action in normal
  Settings. Opening that page does not connect MeterUsage or report quota.
  Synthetic checks do not establish native or live-provider acceptance.

- Claude free resets ([ADR 0044](../adr/0044-claude-free-reset-display.md)):
  the Desktop usage request adds `cedar_ember=1` and retries once without it
  if rejected. Live grants become "Free reset" credits on the Claude card. A
  grant whose `clears` names only per-model limits is titled as a model
  reset, such as "Free reset · Fable only" ([ADR 0046](../adr/0046-claude-model-only-free-reset.md),
  synthetic tests only). A
  confirmed **Use reset** POSTs to `claude.ai/api/organizations/{org}/reset_rate_limits`
  inside the verified Desktop session, and Claude's outcome is shown. Grant IDs
  stay in memory and are not archived. Both endpoints are undocumented. A
  signed local build showed a real personal account's reset on 2026-11-03;
  redemption has not run against a real account yet, and Team and Enterprise
  are not covered.

- Claude per-model weekly plan limits: the Desktop usage response lists them
  in `limits[]` as `kind: "weekly_scoped"` entries with `percent`, `resets_at`
  and `scope.model.display_name`. MeterUsage shows each one as
  `Weekly · <model>` after **Weekly · All models**, for example Fable's weekly
  limit on Max. A malformed entry is skipped, and a model that a legacy
  `seven_day_*` key already shows is not repeated. Claude Desktop's own bundle
  reads the same shape. Not yet confirmed in a signed build against a real
  account.

- Electron Claude plan labels recognize known organization, seat and user tiers
  in that order. An unknown higher-priority value permits a known fallback;
  unknown-only metadata stays unavailable instead of exposing internal labels.
  Claude Desktop now uses consent-tagged web-session cookies instead of OAuth
  cache selection. Nested bootstrap identity and unique intended membership
  gate UUID-bound usage. Identical cookies deduplicate; conflicting sessions
  fail closed. Failed Connect preserves CLI selection. Synthetic checks do
  not establish native compatibility or live allowance.

- Unreleased Electron source adds opt-in Muse Code allowance with `muse serve`
  and the official experimental MSP `usage/read` method. The source starts
  disabled, reads no credential files and sends no model turn. It preserves
  observation age and percentages, including provider values above 100, while
  rejecting absent, expired or malformed observations. Settings, demo cards,
  menu-bar/notch provider ordering and JSON quota reporting use the separate
  `muse` provider. Saved opt-in also gates headless collection; stopping cancels
  active reads and invalidates allowance. JSON includes `observed_at`, and
  allowance stays in memory, outside the shared archive, to preserve rollback
  compatibility. Muse.ai native session import remains unimplemented; no
  verified native store path or schema is available. Native/live validation
  remains separate. See [ADR 0033](../adr/0033-muse-code-subscription-allowance.md).

- Unreleased Antigravity Desktop setup reuses the existing connection controls,
  preferences, IPC and account-bound source. It requires one running same-user
  desktop language server with a CSRF token and PID-owned IPv4 loopback port.
  Fixed quota/status RPCs use request-scoped TLS handling, redirect rejection,
  1 MiB response limits and bounded time. Account fingerprints are opaque;
  credentials stay in main-process memory. Empty modern quota and missing
  fractions remain unavailable. Local CLI usage stays detached. Synthetic
  fixtures cover account switches, closure, transport failures and connection
  races. Native/live-provider proof and release inclusion remain pending.
  See [ADR 0026](../adr/0026-antigravity-desktop-local-quota.md).

- Connected Codex menu cards expose **Use reset** for available, unexpired
  credits. The existing validated IPC and native confirmation use the captured
  connection profile. Confirmation rereads allowance before one helper consume;
  disconnect, stopped connections and profile changes reject the action.
  Coordinator source replacement, including Clear local scan cache, and stop
  abort active resets through the existing consumer signal. Cancellation during
  fresh eligibility prevents consume dispatch; a request already sent cannot be
  undone. The late-result guard still prevents an obsolete reset from changing
  pacing or refreshing its replacement. These cancellation checks use synthetic
  fixtures, with native and live account proof pending.
  Success collects fresh quota under the reset-pacing rules. This also applies
  in `--codex-test-profile`; other collection and system-effect restrictions
  remain. [ADR 0017](../adr/0017-connected-codex-menu-reset.md) narrowly supersedes
  ADR 0012's reset prohibition. Synthetic proof is separate from native display,
  native confirmation and user-owned live redemption.

- The Electron candidate implements opt-in desktop account setup in `src/main/connections.ts`, `src/main/providers/claude-desktop.ts` and the renderer. Codex discovers an existing app helper and uses a separate generated keyring-only profile with browser login. Claude uses a fixed native Keychain helper, bounded sandboxed read-only schema-24 cookie selection, nested bootstrap verification and UUID-bound web usage after new session-cookie consent. Old untagged identities require reconnecting and authorize no private reads. No OAuth cache fallback remains. New Grok Bot Desktop connections select the active account-bound encrypted access token and optional team through a fixed Keychain item and bounded Connect allowance request. Saved Cursor connections retain their immutable SQLite reader and fixed identity-before-allowance requests. Both use opaque account binding. Nonempty WAL/journal files, ambiguous evidence and observed races fail closed. These are source and synthetic-fixture facts, not native or live-provider proof. [Desktop connections](../DESKTOP-CONNECTIONS.md), ADR 0011, [ADR 0027](../adr/0027-grok-cursor-closed-reader.md) and [ADR 0028](../adr/0028-grok-bot-desktop-reader.md) define setup, data coverage, privacy and acceptance gaps. Connected-account cards omit local CLI activity, clear old quota on account changes and do not restore quota archives across launches.

- Each Claude Desktop allowance attempt obtains the Keychain password once
  and reuses it only in attempt-local memory. Local account and session stores
  are still read before and after requests. This avoids a second Keychain
  authorization during one Connect without weakening identity checks.
  Synthetic regression coverage does not prove live connection acceptance.

- Antigravity Desktop quota uses compact model headings and limit labels.
  It preserves provider-reported bucket values and resets; duration metadata
  is added only for explicit Weekly or 5-hour labels. Missing allowance under
  a saved account remains unavailable. This presentation does not establish
  that Desktop and the CLI use the same account. The Cursor process guard
  excludes only Apple's `CursorUIViewService` under `/System/Library/`, while
  retaining active-editor and database guards.

- Antigravity CLI quota and usage share a bounded Docker/Podman runtime resolver. It prefers a healthy runtime and can start only an already-existing `podman-machine-default` after an inspect check; it never creates a machine or pulls an image. Concurrent recovery calls are serialized; failed starts have a 60-second cooldown. Internet or authentication failures are not repaired by restarting a healthy runtime. Without a runtime, the `antigravity-cli:local` image or its volumes, quota reports `containerMissing` ("Allowance unavailable for Antigravity CLI. Set up the agy container or connect Antigravity Desktop") because native conversation usage can still be present. An inspect that times out or cannot start reports `failed` instead.

- `status.openai.com` runs on incident.io, which serves a Statuspage-compatible `components.json` but uses `full_outage` where Atlassian pages use `major_outage`. `StatusPageSource.severity(for:)` maps both to `.majorOutage`; an unmapped status degrades to `.unknown`, never to a false all-clear. Verified against the live feed on 2026-09-25 during an active Codex outage.

- ADR 0006 replaces fixed alternate cases with a managed account list for Codex and Claude. Generated app IDs, provider, user label, directory and enabled state persist as JSON in UserDefaults Data. Primary keys retain their old form; additional history/archive keys use provider plus generated ID, and schema-1 reports add `account` labels. Rename preserves identity; remove stops metering without deleting provider files. No provider account identity is read for labels.

- Claude activity splits each transcript path relative to `projects/` on the platform separator. Splitting on `/` skipped every Windows transcript; the first Windows CI run found this.

- Candidate account visibility rechecks directory presence. Sharing freezes the displayed account key. Pacing-off hides forecasts; notch details reuse window-scoped burn metrics and have a bounded scroller. These contracts have synthetic/static-markup proof; native UI acceptance remains open.

- Codex login, allowance and own-profile logout select `app-server --listen stdio://`. Connection subprocesses keep interpreter search paths while excluding inherited credential variables. Connection tests restrict app-helper discovery to generated fixture roots. These are source contracts, not proof of a live helper or cloud account.

- Claude skips unreadable or disappearing sessions while keeping readable siblings. Codex retains the Swift metadata, modification-time and token-ledger fallbacks per session; a dated session without a readable ledger contributes no measured burn. Both readers propagate cancellation.

- Invalid Claude cache bucket costs or unsupported bucket/session dates discard only that cache entry and trigger a transcript rescan. Shared provider parsing rejects dates outside JavaScript's representable range before history or report serialization. Malformed optional dates are omitted; required dates retain provider-specific failure handling.

- Primary Claude quota discovery prioritizes the app-support `claude-usage.json`, then `.claude/claudewatch-usage.json`, then `.claude/meterusage-usage.json`. Additional accounts read only their configured directory. Without `updated_at`, capture time comes from the selected file's modification time. Optional OpenRouter credits have a five-second deadline starting with the required quota request. Malformed optional Codex additional limits never discard valid base windows.

- Replacing an account source invalidates its live quota, activity, usage, plan and pending reset confirmation. Late reads and reset completion from that source cannot update its replacement. Dated slot archives and durable history remain available; reset requires a current source reading.

- The `--codex-test-profile` candidate mode runs the existing Codex connection UI with isolated preferences, app data and Electron state. It excludes synthetic readings, other provider sources, local activity and Claude status. It reads the public OpenAI status feed without credentials; updates, login-item changes and notifications are blocked. [ADR 0012](../adr/0012-codex-live-test-profile.md) amends the demo-only candidate restriction; [ADR 0015](../adr/0015-codex-test-public-status.md) permits this public status request. Native and provider acceptance remain separate.

- The separate `--claude-test-profile` candidate mode starts without consent and runs only the existing Claude Desktop allowance flow. It uses isolated JSON preferences and Electron state, blocks Codex access and cleanup, and retains the candidate system-effect guards. A Claude connection call without a consent callback denies access. Synthetic fixtures cover consent, relaunch, disconnect and profile isolation; native Keychain, Desktop format and live-provider acceptance remain open. See [ADR 0016](../adr/0016-claude-live-test-profile.md).

- Connected Codex account history uses `account/usage/read` without `threadId`
  through the existing managed ChatGPT helper and effective keyring guard. It
  publishes only valid unique calendar labels, safe nonnegative token counts
  and capture time in separate in-memory state. Main, notch and shared cards
  show "Account token activity" under existing heatmap preferences. Null or
  absent history and unreported days remain unavailable; reported zero stays
  zero. Profile replacement, disconnect and failed reads clear the reading;
  late results cannot update a replacement source. Account history is excluded
  from local rollups, durable history and schema-1 quota JSON. Source and
  synthetic proof do not establish live availability or universal cloud,
  device or product coverage. See [ADR 0022](../adr/0022-codex-account-token-history.md).
