# ADR 0036: Fall back to Grok Bot's cached usage when its allowance request fails

- Status: Source implementation; live acceptance pending
- Date: 2026-11-01
- Amends: [ADR 0028](0028-grok-bot-desktop-reader.md)

## Context

On 2026-11-01, `GetSandUsageStatus` returned HTTP 500 `internal` for a unified
Grok account, or did not answer within 60 seconds when sent with Grok Bot's
client headers. The account's other Dashboard endpoints answered normally with
the same token, and the token, Keychain item and account binding were valid.
Changing JSON to binary protobuf, or adding Grok Bot's client headers or a
machine checksum, did not help. MeterUsage showed "Couldn't read Grok usage".
Grok Bot keeps its own last successful reading in
`sand-client-persistence/<base32 key>.blob`, keyed by
`sand.client.slice.account.<encodeURIComponent(sub)>.weekly-usage.cache`.

## Decision

When a refresh's allowance request fails with a network or server error
(`offline` or `failed`), read Grok Bot's cache for the verified account. Connect
never does this.

- Derive the file name from the token subject that already matched the active
  account hash. Do not list or read other accounts' files.
- Open it without following symlinks. Require a regular file owned by the user,
  with one link and at most 64 KiB, and reject duplicate JSON keys.
- Decode only schema version, kind, selected team, read time, percent used,
  next reset and trial, paid and team-seat flags. Plan labels, on-demand
  spend and other fields are skipped.
- Reject on team mismatch, team seats, trials (the cache has no trial expiry),
  no paid limit, a read time older than 7 days or in the future, a percent
  outside 0–100, or a reset already passed.
- Use the cache's read time as the quota's capture time, and mark the reading so
  the card says "Observed <time> · Grok Bot's cached reading".
- In the coordinator, a cached reading older than the last reading becomes a
  failure, so history and alerts never move backwards. Cached readings skip
  quota-burn observation (ADR 0031) and count as failures for request backoff.

Connect still requires a live allowance response. Auth failures (401/403) and
unsupported replies never use the cache. The store re-verification after a
failed request still runs first and still overrides the fallback.

## Consequences

- Grok cards keep showing the last reading Grok Bot obtained, with its true age,
  while Cursor's usage endpoint fails.
- The cache format is private to Grok Bot and may change; any mismatch only
  hides the fallback.
- MeterUsage still sends no machine identity and does not impersonate the client.
