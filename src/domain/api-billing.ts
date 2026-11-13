export const apiBillingProviders = ["openai", "anthropic"] as const;
export type ApiBillingProvider = typeof apiBillingProviders[number];
export const apiBillingNames = { openai: "OpenAI API", anthropic: "Anthropic API" } as const;
// Neither provider documents a balance endpoint for Admin keys. "creditGrants"
// (OpenAI only) comes from the undocumented credit_grants report; "manual" is an
// estimate from a user-entered prepaid credit total minus documented cost-report
// spend since that top-up.
export type ApiBillingBalance =
  | { source: "creditGrants"; availableUSD: number; grantedUSD: number; usedUSD: number }
  | { source: "manual"; availableUSD: number; prepaidUSD: number; since: number; spentSinceUSD: number; monthly?: true };
export interface ApiBillingSnapshot {
  schema: 1; provider: ApiBillingProvider; capturedAt: number; monthStart: number; periodEnd: number; currency: "USD";
  daily: { start: number; end: number; amountUSD: number }[];
  balance?: ApiBillingBalance;
}
export type ApiBillingReading = { status: "value"; value: ApiBillingSnapshot; stale: boolean } | { status: "missing"; code: "notConfigured" | "unavailable" };

export interface ApiBillingPrepaid { amountUSD: number; since: number; monthly?: true }
export const prepaidPreferenceKeys = {
  openai: { amount: "openAIPrepaidCreditUSD", since: "openAIPrepaidSince", monthly: "openAIPrepaidMonthly" },
  anthropic: { amount: "anthropicPrepaidCreditUSD", since: "anthropicPrepaidSince", monthly: "anthropicPrepaidMonthly" },
} as const satisfies Record<ApiBillingProvider, { amount: string; since: string; monthly: string }>;
export const prepaidAmountKeys: readonly string[] = apiBillingProviders.map(p => prepaidPreferenceKeys[p].amount);
export const prepaidSinceKeys: readonly string[] = apiBillingProviders.map(p => prepaidPreferenceKeys[p].since);
export const prepaidMonthlyKeys: readonly string[] = apiBillingProviders.map(p => prepaidPreferenceKeys[p].monthly);
export const maxPrepaidUSD = 10_000_000;
export const validPrepaidAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= maxPrepaidUSD;
/** UTC day start for a `YYYY-MM-DD` string, or undefined when malformed. */
export function prepaidDay(v: unknown): number | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const at = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === v ? at : undefined;
}
export const validPrepaidSince = (v: unknown) => v === "" || prepaidDay(v) !== undefined;
/** Latest UTC renewal on or before `now` for a credit that renews on `anchor`'s day of month; short months use their last day. */
export function latestRenewal(anchor: number, now: number): number {
  if (anchor > now) return anchor;
  const day = new Date(anchor).getUTCDate(), at = new Date(now);
  const inMonth = (year: number, month: number) => Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()));
  const current = inMonth(at.getUTCFullYear(), at.getUTCMonth());
  return current <= now ? current : inMonth(at.getUTCFullYear(), at.getUTCMonth() - 1);
}
/** Manual estimate configuration, present only when both amount and date are set. A monthly credit counts from its latest renewal. */
export function prepaidFrom(values: Record<string, unknown>, provider: ApiBillingProvider, now = Date.now()): ApiBillingPrepaid | undefined {
  const keys = prepaidPreferenceKeys[provider], amountUSD = values[keys.amount], since = prepaidDay(values[keys.since]);
  if (!validPrepaidAmount(amountUSD) || amountUSD <= 0 || since === undefined) return undefined;
  return values[keys.monthly] === true ? { amountUSD, since: latestRenewal(since, now), monthly: true } : { amountUSD, since };
}
