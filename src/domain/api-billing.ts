export const apiBillingProviders = ["openai", "anthropic"] as const;
export type ApiBillingProvider = typeof apiBillingProviders[number];
export const apiBillingNames = { openai: "OpenAI API", anthropic: "Anthropic API" } as const;
// OpenAI has no documented balance endpoint. "creditGrants" comes from the
// undocumented credit_grants report; "manual" is an estimate from a user-entered
// prepaid top-up minus documented Costs API spend since that top-up.
export type ApiBillingBalance =
  | { source: "creditGrants"; availableUSD: number; grantedUSD: number; usedUSD: number }
  | { source: "manual"; availableUSD: number; prepaidUSD: number; since: number; spentSinceUSD: number };
export interface ApiBillingSnapshot {
  schema: 1; provider: ApiBillingProvider; capturedAt: number; monthStart: number; periodEnd: number; currency: "USD";
  daily: { start: number; end: number; amountUSD: number }[];
  balance?: ApiBillingBalance;
}
export type ApiBillingReading = { status: "value"; value: ApiBillingSnapshot; stale: boolean } | { status: "missing"; code: "notConfigured" | "unavailable" };

export interface ApiBillingPrepaid { amountUSD: number; since: number }
export const prepaidPreferenceKeys = { amount: "openAIPrepaidCreditUSD", since: "openAIPrepaidSince" } as const;
export const maxPrepaidUSD = 10_000_000;
export const validPrepaidAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= maxPrepaidUSD;
/** UTC day start for a `YYYY-MM-DD` string, or undefined when malformed. */
export function prepaidDay(v: unknown): number | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const at = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === v ? at : undefined;
}
export const validPrepaidSince = (v: unknown) => v === "" || prepaidDay(v) !== undefined;
/** Manual fallback configuration, present only when both values are set. */
export function prepaidFrom(values: Record<string, unknown>): ApiBillingPrepaid | undefined {
  const amountUSD = values[prepaidPreferenceKeys.amount], since = prepaidDay(values[prepaidPreferenceKeys.since]);
  return validPrepaidAmount(amountUSD) && amountUSD > 0 && since !== undefined ? { amountUSD, since } : undefined;
}
