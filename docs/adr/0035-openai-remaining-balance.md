# ADR 0035: Show OpenAI remaining balance with an estimate fallback

- Status: Source implementation; real-account acceptance pending
- Date: 2026-10-31
- Amends: [ADR 0029](0029-api-billing-snapshots.md) (documented endpoints only)

## Context

The OpenAI API card reports month-to-date spend from the documented
`/v1/organization/costs` report. Users also want the dollars left on a prepaid
account. OpenAI documents no balance endpoint. The undocumented
`/v1/dashboard/billing/credit_grants` report returns granted, used and
available totals and is used by other usage tools, but it may reject Admin keys
or change without notice.

## Decision

During an explicit OpenAI billing fetch, after the costs report succeeds:

1. Request `credit_grants` once with the same one-time key. Keep only
   `total_granted`, `total_used` and `total_available`. This request has its own
   8-second limit inside the shared 30-second deadline. Any failure, including
   401/403, or a report with zero credit granted only omits the balance; it never
   fails the spend fetch.
2. If that fails and Settings holds a prepaid amount and UTC top-up date, request
   documented costs from that date and store an estimate: prepaid minus spend
   since that date. Readers recompute the remaining amount from its inputs.
   A failed estimate request also only omits the balance.

The snapshot stays schema 1 with an optional OpenAI-only `balance` field. The
card labels the source as unofficial or an estimate. The prepaid amount and date
are non-secret preferences. Anthropic is unchanged. The environment helper
tries only `credit_grants`; it does not read preferences.

## Consequences

- The remaining balance may disappear if OpenAI changes or restricts the
  undocumented report; spend continues to work.
- The estimate does not see later top-ups, refunds, expiring grants or invoice
  adjustments until the user updates the prepaid amount and date.
- A live dev-build fetch on 2026-10-31 with an organization Admin key stored
  spend but no credit grants balance, so Admin-key users may need the estimate.
  Why the report returned no balance was not captured.
