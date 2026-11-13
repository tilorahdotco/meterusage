# ADR 0049: Show credit total, used and left for both API billing cards

- Status: Accepted source implementation; real-account acceptance pending
- Date: 2026-11-13
- Amends: [ADR 0035](0035-openai-remaining-balance.md) (prepaid estimate was OpenAI only)

## Context

The Anthropic API card showed only month-to-date spend. Users want the credit
total, the amount used and the amount left, as the OpenAI card shows. Some
credits renew each month, so a single top-up date goes out of date after one
month. Anthropic documents no endpoint that returns a credit balance to an
Admin key; the Console shows it only to a signed-in user.

## Decision

1. Both cards show a **Total credit**, **Used** and **Left** row. All three come
   from one balance: OpenAI `credit_grants` totals, or the prepaid estimate.
   An estimated **Left** has a `~` prefix. When spend exceeds the total, **Left**
   shows $0.00 and the card asks for an update. The card heading shows spend as
   **$X this month**, so it is not confused with **Used**.
2. Anthropic API gets the same prepaid estimate as OpenAI: credit amount and UTC
   date in Settings, minus documented `cost_report` spend since that date.
   Preferences are per provider: `anthropicPrepaidCreditUSD` and
   `anthropicPrepaidSince`. Anthropic makes no balance request.
3. **Renews monthly** (`openAIPrepaidMonthly`, `anthropicPrepaidMonthly`) treats
   the date as a renewal day. Each fetch counts spend from the latest renewal
   on or before now; a month without that day uses its last day. The snapshot
   stores the renewal date used and `monthly: true`.

Snapshots stay schema 1. The balance stays optional and never fails the spend
fetch. The environment helper reads no preferences, so it stores no estimate.

## Consequences

- The estimate assumes `cost_report` includes usage paid by credits. This is
  not verified against a real account with granted credits.
- The estimate does not see unused credit that rolls over, expiry, refunds or
  invoice adjustments. Users update the amount when the credit changes.
