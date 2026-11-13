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
   shows $0.00 and the card asks for an update. The card heading names the
   snapshot's UTC month, such as **$3.42 in Nov**, so it is not confused
   with **Used** and an old snapshot is not labelled as the current month.
2. Anthropic API gets the same prepaid estimate as OpenAI: credit amount and UTC
   date in Settings, minus documented `cost_report` spend since that date.
   Preferences are per provider: `anthropicPrepaidCreditUSD` and
   `anthropicPrepaidSince`. Anthropic makes no balance request.
3. **Renews monthly** (`openAIPrepaidMonthly`, `anthropicPrepaidMonthly`) treats
   the date as a renewal day. Each fetch counts spend from the latest renewal
   on or before now; a month without that day uses its last day. The snapshot
   stores the renewal date used and `monthly: true`.
4. A monthly credit expires at its next renewal, as Anthropic's Max, Ultra and
   Team plan API credits expire at the end of each billing cycle without
   rollover. The snapshot stores that date as `expiresAt`. The card shows
   **Estimate from Nov 13 · expires Dec 4 (21 days left)**. When the clock
   passes that date before the next fetch, **Left** shows **Expired** and the
   card asks for a fetch.
5. Keep the card short: the three figures, one note line (source, expiry or
   the problem) and one line with the UTC period and fetch time, such as
   `Nov 1–13 · fetched 07:12 UTC` (`Stale ·` first when old). The full capture
   time is in the line's tooltip. A card without a balance says to add the
   credit in Settings. Settings groups **Admin key** and **Credit**, each with
   one help line; the Priority Tier exclusion stays as one Settings line.

Snapshots stay schema 1. The balance stays optional and never fails the spend
fetch. The environment helper reads no preferences, so it stores no estimate.

## Consequences

- The estimate assumes `cost_report` includes usage paid by credits. This is
  not verified against a real account with granted credits.
- The estimate does not see unused credit that rolls over, expiry, refunds or
  invoice adjustments. Users update the amount when the credit changes.
