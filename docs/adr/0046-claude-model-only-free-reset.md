# ADR 0046: Title Claude free resets that clear only a model's limit

- Status: Accepted; synthetic tests only
- Date: 2026-11-10
- Amends: [ADR 0044](0044-claude-free-reset-display.md) (grant selection and credit titles)

## Context

Claude now gives free resets that clear one model's limit, such as Fable's,
and not the weekly limit. Each grant in the `cedar_ember` block has a `clears`
list that names the usage windows it resets. Claude Code 2.1.322 reads this
list and classifies `five_hour` as session, `seven_day` as weekly, and
`seven_day_opus`, `seven_day_sonnet` and `seven_day_overage_included` as
model. Under ADR 0044, MeterUsage titled every grant "Free reset", which
implies a full reset.

## Decision

- MeterUsage also selects `clears` from each grant.
- If `clears` names only per-model limits, the credit is titled by model:
  "Free reset · Opus only", "Free reset · Sonnet, Opus only".
  `seven_day_overage_included` takes the model name of the single per-model
  weekly limit in `limits[]`, such as "Free reset · Fable only". If there is
  not exactly one such limit, the title is "Free reset · model limit only".
- If `clears` is absent, empty, not a list, or names any other window, the
  title stays "Free reset".
- If any `clears` entry is not a string, the grant is dropped. A second
  shape-only pass keeps object and array entries as empty containers so they
  are rejected without reading their contents. The usage windows and other
  grants are not affected.
- Redemption, confirmation and outcomes are unchanged from ADR 0044.

## Evidence and limits

Synthetic tests cover each title, the name fallback and malformed lists. A
model-only grant from a real account has not been seen. After any redeemed
reset, pacing restarts for every window, as under
[ADR 0008](0008-reset-aware-quota-pacing.md). That includes windows that a
model-only reset did not clear.
