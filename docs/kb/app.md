# Electron app behavior

Part of [project knowledge](../KB.md). Settings, onboarding, cards, heatmaps, side notch, history and lifecycle in the Electron app.

- Heatmap hover/focus readouts use compact token and session totals, including
  local, account, session-only, daily, weekly and cumulative grids. Exact grouped
  counts remain in tooltips and accessible labels. Summary counts compact from
  1,000. This follow-up is separate from the published build 54 artifact.

- Onboarding and Settings offer provider-specific source choices: Codex browser
  sign-in or CLI, Claude Desktop or Claude Code CLI, Antigravity Desktop or
  Antigravity CLI, and Grok CLI or opt-in Grok Bot Desktop Beta. Choosing
  an option does not change collection until its action is used. Use CLI waits
  for MeterUsage-owned connection cleanup before selecting existing local
  collection. Ordinary Disconnect still prevents automatic local fallback.
  CLI data covers this Mac; Claude CLI allowance needs a companion usage file.
  With no companion file the Claude card says allowance is unavailable for
  Claude Code CLI and links to [COMPANION.md](../COMPANION.md); Windows has no
  bundled companion.
  Done follows the source choices and remains optional. Demo and isolated live
  test profiles cannot switch to local collection. See
  [ADR 0023](../adr/0023-onboarding-source-choice.md).

- Candidate Settings uses category navigation for Connections, API connections, Appearance,
  General, Providers, Side notch, Usage details and Diagnostics. Connection
  summaries show the current source, collection state and reading availability;
  Configure reveals the existing setup actions. Category changes preserve pending
  source selection, and choosing a method still requires its explicit action.
  Existing preferences and additional-account controls remain. Demo account
  restrictions appear before disabled connection actions. Provider column
  headings replace repeated visual labels on wide windows; at 450 pixels or
  narrower, each provider has two labelled control columns below its name.
  Input accessible names and full label hit areas remain. Settings action
  errors retain their alert role, message and dismissal in a sticky banner.
  Advanced account rows wrap without changing their save/remove behavior.

- Settings displays the running Electron bundle version supplied by the main
  process. Source previews without bundle metadata omit the version instead
  of showing the legacy Swift version.

- Candidate Usage keeps Service status first and visible, before provider usage.
  Provider/account tabs show one usage card at a time in saved provider order.
  Arrow keys and Home/End switch tabs; removing a selected slot falls back to
  the first available slot. Local summary metrics and measured burn remain in
  the All-provider activity breakdown disclosure. Summary metrics use three
  equal columns, with two columns at 360 pixels or narrower. Recorded
  activity labels distinguish telemetry counters from account/local totals
  without changing values or adding a time scope. Archived quota retains its
  timestamp and failure reason in a warning well. Long labels and metadata
  wrap; percentages and reset actions stay together. This is resilience
  polish, not a reproduced overflow fix.

- Live menu and side-notch cards show the first two available recorded metrics,
  with the remainder under More activity. Usage by period and active-window burn
  also use closed disclosures. Quota, eligible reset actions and heatmaps stay
  visible. Spacing and sparkline height are reduced without changing font-size
  choices or source values. Static exports retain all recorded metrics and full
  period/burn data without those disclosures.

- Static shared cards omit footer actions, reset buttons and the heatmap
  selector. Credit details and the 26 weeks label remain. Export heatmaps omit
  the unused hover readout space. Live readouts also use only their text height. Full-height capture,
  frozen account selection and the 250-pixel export width remain unchanged.
  Dark secondary text uses `#b0b0b8`; light text and semantic colors retain their
  existing rules. Usage, Settings and notch detail buttons use 120 ms background
  feedback only for enabled fine-pointer hover with reduced motion off. Press
  and keyboard focus remain immediate. Renderer fixture and build proof does
  not establish rendered layout, sticky alerts, motion or native export proof.

- Electron heatmaps show compact counts and readable dates for daily,
  weekly or cumulative scope on hover and keyboard focus. Tooltips and accessible
  labels retain exact grouped counts. Each live heatmap has one Tab entry; arrow keys move between days and
  Home/End reach the first/last available cell. Tab leaves the heatmap. Shared
  images have no focusable cells. Account, local-token and session-only
  providers share the same heading, caption, cells and intensity legend.
  Hover and keyboard focus replace the legend with the compact dated readout
  in a natural-height row. Long readouts can grow the card; the top and rail stay anchored. Unreported account days have subtle solid
  outlines; reported zeroes have filled neutral cells. Each source retains its
  own time range and units. Count-only providers report token totals unavailable.
  Reset buttons use the compact control size. An open notch
  interaction checks the native cursor to recover a missed pointer exit, then
  closes details through the existing delay and temporary action guards.
  The strip always shows usage rings and percentages, with no design selector
  or dots option. Disable/hide clears expanded state before re-enabling.
  Legacy pin data has no effect and pin controls are removed.
  Notch sizes use integer pixel text and spacing instead of CSS zoom.
  [ADR 0019](../adr/0019-single-design-notch.md) records this candidate correction.
  Source fixtures do not prove native pointer events, keyboard access in the
  non-activating panel or rendered anchors. [Side notch](../SIDE-NOTCH.md) records
  the behavior and native checks.

- Candidate onboarding lives in Settings and reuses its account connections.
  Incomplete setup opens Settings on launch or app activation. Done persists
  `onboardingCompleted` before returning to usage; a failed write leaves setup
  open. Sign-in is optional. The main panel has no setup card. Existing completed
  profiles retain their preference. [ADR 0014](../adr/0014-settings-onboarding.md)
  records this placement; native acceptance is separate from source validation.

- Demo mode uses synthetic data. `README.md` and `docs/DEMO.md` describe it as the path for screenshots and local UI inspection without provider accounts.

- The side notch panel is anchored by the strip's top-right corner and uses whole-point frames, so switching providers never moves the strip. `docs/SIDE-NOTCH.md` describes the states, geometry invariants, and required evidence. ADR 0004 records the decision.

- The app preserves unreadable durable history and suspends history writes until relaunch after the file is repaired. Sanitized history load and save failures are visible in Copy diagnostics.

- Candidate checks use synthetic fixtures. Demo/candidate selection isolates preferences, history, caches and Electron state before composition. Live provider/key discovery, updater installation and login-item changes are disabled in demo. `pnpm package:mac` creates a separate candidate with publication disabled, using existing macOS tools.

- The browser-demo notch uses viewport height when no native work-area height is supplied. The card and strip scroll independently; the 36-pixel charcoal strip has 22-pixel rings containing provider marks, percentages below. Settings is available in each expanded card footer, with no strip button or reserved slot. The 220-pixel detail card plus strip use 256 pixels total. Synthetic browser checks cover scrolling, two card heights and both CSS card sides, but do not verify native window placement or display changes.

- Candidate state publication returns before touching a destroyed tray. A synthetic Electron entrypoint regression emits display and theme events after tray destruction; native shutdown/display behavior remains an acceptance check.

- Candidate window cleanup uses the document ID captured while the window is alive. Closing a destroyed window cannot read its web contents or remove a replacement window for the same surface. The synthetic lifecycle regression exercises this path; native shutdown remains an acceptance check.

- Candidate Quit removes the display subscription before stopping collection and waiting for authentication cleanup. A late collection publication cannot recreate the notch or restart update checks. Lifecycle regressions cover flyout and tray Quit, repeated Quit during cleanup, and notch enabled or disabled. These tests do not establish native process termination.

- Candidate macOS GUI startup validates Electron's three direct singleton links as one coherent metadata set before requesting the native lock. Other profile symlinks remain rejected, and JSON entrypoints retain strict validation. A second instance exits before collection starts and asks the primary instance to reveal its panel. Startup failures emit a fixed error; activation during Quit cannot reopen windows. [ADR 0013](../adr/0013-candidate-single-instance-startup.md) records the bounded exception and native acceptance requirements.

- Candidate Appearance includes a saved Small, Medium or Large panel size, defaulting to Medium. Main-panel widths are 378, 420 and 483 points before display clamping (scales 0.9, 1 and 1.15). Small is a compact panel: it hides the service status row, activity charts and the all-provider breakdown, leaving quota meters, credits and resets. Main-panel and Settings content use the same scale. Side-notch detail content uses explicit integer pixel sizes without CSS zoom. The notch card is 220 pixels wide beside the fixed 36-pixel strip; its height follows the size-specific content within the work area. Settings measures the scaled content height and fits its active category and expanded controls within the display work area, accounting for native title-bar height. Width and top position remain when on screen. Tray and 250-pixel shared-card capture remain unchanged. Ctrl/Cmd plus or minus selects the next size; Ctrl/Cmd 0 restores Medium. These shortcuts use the same saved preference and main-panel resizing as Settings. Window loads normalize retained Chromium zoom to avoid applying a second scale. The main panel measures natural content height, shrinks when content gets shorter, and never exceeds 70% of the display work area; beyond that, content scrolls in a Base UI ScrollArea between the pinned header and footer, with an overlay scrollbar. The quota heatmap starts at the first week with recorded quota history (at least 12 weeks, at most 26) and labels Mon, Wed and Fri rows; the side-notch card omits the weekday labels. Synthetic tests cover persistence, invalid values, write failure, rapid keys and display clamping; actual native sizing acceptance is separate.

- Appearance offers a saved interface Style (`interfaceStyle`, default `classic`): Classic, Flight Deck, Orbit, Ledger, Terminal, Blueprint, Departures and Arcade ([ADR 0042](../adr/0042-interface-styles.md)). Each style picks a meter, notch gauge and activity chart from `src/shared/styles.ts`. Classic follows Theme and Accent, Ledger follows Theme as paper or ink, and the rest use fixed dark palettes, so Accent shows only for Classic. Non-Classic charts collapse seven or more leading quiet days into one label. Service status and the 36 px strip and 220 px card are unchanged in every style. Native captures remain pending.

- Candidate Settings gives Appearance, General, Providers, Side notch, Usage details and Diagnostics direct category access beside Connections. Related options use grouped rows. Panel size uses a compact row of visible Small, Medium and Large choices; accent color uses six labelled radio swatches. Aligned provider controls distinguish collection from menu-bar and side-notch display; stopping primary collection preserves the saved display preference. The display control stays available when an additional account has an active source slot. Advanced local accounts remain available. The main panel and Settings scroll in a Base UI ScrollArea that shows an overlay scrollbar only while content overflows; native scrollbar indicators stay hidden, with scrolling and keyboard access retained. These renderer contracts do not establish native UI parity.

- Durable daily-history reads and writes project the known record fields and five token counters before coordinator merge or renderer publication. Unknown JSON fields are discarded; larger historic totals and account keys remain intact.

- The side-notch reset preference controls the detail card and context menu; flyout reset redemption remains available for a reported-available, unexpired credit. Main still requires explicit confirmation and rechecks the credit.

- Rolling usage bars show each window's share of `last 30d`, using estimated cost when reference cost is positive, otherwise measured tokens. Missing or zero reference produces zero share. The caption states the reference and pricing snapshot. These renderer contracts have fixture proof; native acceptance remains open.

- Archive reads validate optional plan, group, credit and reset metadata, retain Swift date/null compatibility and project only known fields. Reset preparation, confirmation and UI actions share the same reported-available and unexpired rule; absent status is unavailable.

- Usage cards show current-day session/message counts and capture age without inventing token totals. Tray tooltips include non-operational status, reset countdown, stale capture age and last refresh. Claude, Antigravity, OpenCode Go, OpenRouter and Grok keep the Swift light/dark identity pairs, with semantic status overrides. These display contracts have synthetic/static-markup proof; native acceptance remains open.

- Flyout service health uses reported statuses independently of usage visibility. Failed refreshes retain the last successful status as last known, with its age and refresh failure shown in the status panel, notch card and tray tooltip. Copied diagnostics marks the reading stale with its successful-check age and a fixed service-status error; successful retry clears the marker. Public-feed failures use service-status wording while keeping their failure code for retry behavior. Status buttons ask main to open only the existing fixed public provider pages. The compact notch rail shows only provider marks and percentages; pacing and reset timing remain in details. Native rendering and page opening remain unverified.

- Shared-card sizing uses the full measured height, separate from visible-window bounds. The candidate rejects capture heights above 8,192 pixels, or 4,096 CSS pixels at 2x, with `Card too tall to share`. Native image completeness remains unverified.

- Electron notch secondary labels use a scoped `#b0b0b8`; semantic provider and quota colors retain their existing rules. Telemetry adds a border and size-specific top padding. Enabled detail buttons use 120 ms background feedback for fine-pointer hover with reduced motion off. Press and keyboard focus stay immediate; reduced motion disables transitions. Card/window/ring geometry and the 450 ms close delay retain their source behavior. Rendered feedback, scrolling and native anchors still need target proof. See [SIDE-NOTCH.md](../SIDE-NOTCH.md).

- Electron Settings persists provider group order through validated IPC. Drag handles, arrow keys and move buttons use the same saved order for usage cards, service health, menu bar and side notch. Stored lists retain known providers once and append missing providers in default order. Additional accounts remain grouped, with independent Collect and Show settings. Failed saves and canceled drags retain the saved order. Synthetic proof does not establish rendered or native drag, focus, VoiceOver or notch-anchor behavior. See [ADR 0021](../adr/0021-provider-group-order.md).

- The macOS preferences reader accepts complete legacy hex data and reads
  complete NSData through Foundation when `defaults` prints an abbreviated
  description. Provider order and managed accounts retain their saved format.
  Relaunches and app updates reuse the saved order; newly added providers append
  after the retained entries.

- Every provider card with a quota reading shows a "Quota activity" heatmap
  (`src/main/quota-activity.ts`) unless it already shows Codex account token
  history. Each slot records the rise in its own tracking window (weekly
  all-models when present, else the longest window) per local day, so usage
  from desktop apps and other devices appears. The first reading spreads
  the current window's usage evenly over its elapsed days, marked estimated;
  earlier windows are never backfilled. Connection changes retire the previous
  series under an opaque generated key, so replacement accounts never inherit
  its days or baseline. Retired observations remain on disk outside active
  heatmaps; normal relaunch and Muse collection Stop/Start retain the active
  series.
  Quota activity stays in percentage points: providers report no account
  token totals for desktop or web use, so tokens are never inferred. When
  Claude Code (or Codex) ran on this Mac that day, the tooltip adds the
  measured local tokens, labelled "on this Mac". A rise seen after the
  Mac was offline lands on the next reading's day. A reset-time change over
  one hour, or a drop, counts the new window from zero. Demo mode is excluded.
