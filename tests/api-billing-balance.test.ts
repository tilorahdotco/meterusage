import { describe, expect, it, vi } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prepaidDay, prepaidFrom, type ApiBillingSnapshot } from "../src/domain/api-billing";
import { collectApiBilling, parseApiBillingSnapshot } from "../src/main/providers/api-billing";
import { parseRequest } from "../src/main/ipc";
import { ApiBillingBalanceLine } from "../src/renderer/api-billing-setup";

const now = Date.parse("2026-10-16T12:00:00Z"), start = Date.UTC(2026, 9, 1), day = 86400000;
const bucket = (at: number, value: number) => ({ start_time: at / 1000, end_time: (at + day) / 1000, results: [{ amount: { value, currency: "usd" }, project_id: "PRIVATE_PROJECT" }] });
const costs = (...data: unknown[]) => Response.json({ data, has_more: false, next_page: null });
const grants = { object: "credit_summary", total_granted: 100, total_used: 37.5, total_available: 62.5, grants: { data: [{ id: "PRIVATE_GRANT" }] } };
const route = (handlers: { grants?: () => Response; costs: (url: URL) => Response }) => vi.fn<typeof fetch>(async input => {
  const url = new URL(String(input));
  return url.pathname.endsWith("/credit_grants") ? (handlers.grants?.() ?? new Response("PRIVATE", { status: 403 })) : handlers.costs(url);
});
const base = (balance?: unknown): ApiBillingSnapshot => ({ schema: 1, provider: "openai", capturedAt: now, monthStart: start, periodEnd: now, currency: "USD", daily: [], ...(balance ? { balance } : {}) } as ApiBillingSnapshot);

describe("OpenAI remaining balance", () => {
  it("prefers the reported credit_grants balance and drops grant identifiers", async () => {
    const fetcher = route({ grants: () => Response.json(grants), costs: () => costs(bucket(start, 2)) });
    const value = await collectApiBilling("openai", "synthetic-key", now, fetcher, { amountUSD: 10, since: start });
    expect(value.balance).toEqual({ source: "creditGrants", availableUSD: 62.5, grantedUSD: 100, usedUSD: 37.5 });
    expect(JSON.stringify(value)).not.toContain("PRIVATE");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer synthetic-key");
  });

  it.each([
    ["403", () => new Response("PRIVATE", { status: 403 })],
    ["malformed", () => Response.json({ total_available: "lots" })],
    ["transport", () => { throw new Error("PRIVATE_TRANSPORT"); }],
  ] as const)("keeps spend when credit_grants fails (%s) and no prepaid fallback is set", async (_name, grantsResponse) => {
    const value = await collectApiBilling("openai", "synthetic-key", now, route({ grants: grantsResponse, costs: () => costs(bucket(start, 2)) }));
    expect(value.balance).toBeUndefined();
    expect(value.daily).toEqual([{ start, end: start + day, amountUSD: 2 }]);
  });

  it("treats a zero-grant report as no balance so the prepaid estimate runs", async () => {
    const fetcher = route({ grants: () => Response.json({ total_granted: 0, total_used: 0, total_available: 0 }), costs: () => costs(bucket(start, 2)) });
    const value = await collectApiBilling("openai", "synthetic-key", now, fetcher, { amountUSD: 10, since: start });
    expect(value.balance).toEqual({ source: "manual", availableUSD: 8, prepaidUSD: 10, since: start, spentSinceUSD: 2 });
  });

  it("estimates from a top-up within the month without an extra costs request", async () => {
    const since = start + 5 * day, fetcher = route({ costs: () => costs(bucket(start, 4), bucket(since, 1.5), bucket(since + day, 2)) });
    const value = await collectApiBilling("openai", "synthetic-key", now, fetcher, { amountUSD: 20, since });
    expect(value.balance).toEqual({ source: "manual", availableUSD: 16.5, prepaidUSD: 20, since, spentSinceUSD: 3.5 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fetches spend since an earlier-month top-up up to the month start", async () => {
    const since = Date.UTC(2026, 8, 20), requested: URL[] = [];
    const fetcher = route({ costs: url => { requested.push(url); return url.searchParams.get("start_time") === String(since / 1000) ? costs(bucket(since, 5), bucket(since + day, 1)) : costs(bucket(start, 2)); } });
    const value = await collectApiBilling("openai", "synthetic-key", now, fetcher, { amountUSD: 50, since });
    expect(value.balance).toEqual({ source: "manual", availableUSD: 42, prepaidUSD: 50, since, spentSinceUSD: 8 });
    expect(requested.map(u => [u.searchParams.get("start_time"), u.searchParams.get("end_time")])).toEqual([[String(start / 1000), String(Math.floor(now / 1000))], [String(since / 1000), String(start / 1000)]]);
    expect(value.daily).toEqual([{ start, end: start + day, amountUSD: 2 }]);
  });

  it("keeps spend and omits the estimate when the earlier-month request fails", async () => {
    const since = Date.UTC(2026, 8, 20);
    const fetcher = route({ costs: url => url.searchParams.get("start_time") === String(since / 1000) ? new Response("", { status: 500 }) : costs(bucket(start, 2)) });
    const value = await collectApiBilling("openai", "synthetic-key", now, fetcher, { amountUSD: 50, since });
    expect(value.balance).toBeUndefined(); expect(value.daily).toHaveLength(1);
  });

  it("ignores a future top-up date", async () => {
    const value = await collectApiBilling("openai", "synthetic-key", now, route({ costs: () => costs() }), { amountUSD: 50, since: start + 30 * day });
    expect(value.balance).toBeUndefined();
  });

  it("never requests a balance for Anthropic", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: [], has_more: false }));
    const value = await collectApiBilling("anthropic", "synthetic-key", now, fetcher, { amountUSD: 50, since: start });
    expect(value.balance).toBeUndefined(); expect(fetcher).toHaveBeenCalledOnce();
  });

  it("validates stored balances and recomputes the manual remaining amount", () => {
    const manual = { source: "manual", availableUSD: 999, prepaidUSD: 10, since: start, spentSinceUSD: 12 };
    expect(parseApiBillingSnapshot(JSON.stringify(base(manual)), "openai", now).balance).toEqual({ ...manual, availableUSD: -2 });
    for (const balance of [
      { source: "other", availableUSD: 1 }, { source: "creditGrants", availableUSD: -1, grantedUSD: 1, usedUSD: 1 }, { source: "creditGrants", availableUSD: 1, grantedUSD: 1 },
      { ...manual, since: start + 1 }, { ...manual, since: now + day }, { ...manual, prepaidUSD: -1 }, { ...manual, availableUSD: "1" },
    ]) expect(() => parseApiBillingSnapshot(JSON.stringify(base(balance)), "openai", now), JSON.stringify(balance)).toThrow();
    expect(() => parseApiBillingSnapshot(JSON.stringify({ ...base({ source: "creditGrants", availableUSD: 1, grantedUSD: 1, usedUSD: 0 }), provider: "anthropic" }), "anthropic", now)).toThrow();
  });
});

describe("prepaid credit preferences", () => {
  it("accepts only bounded amounts and real UTC dates", () => {
    for (const [key, value] of [["openAIPrepaidCreditUSD", 0], ["openAIPrepaidCreditUSD", 25.5], ["openAIPrepaidSince", ""], ["openAIPrepaidSince", "2026-02-28"]] as const)
      expect(parseRequest({ action: "setPreference", key, value })).toEqual({ action: "setPreference", key, value });
    for (const [key, value] of [["openAIPrepaidCreditUSD", -1], ["openAIPrepaidCreditUSD", 1e8], ["openAIPrepaidCreditUSD", "5"], ["openAIPrepaidSince", "2026-02-30"], ["openAIPrepaidSince", "2026-2-1"], ["openAIPrepaidSince", 5]] as const)
      expect(() => parseRequest({ action: "setPreference", key, value })).toThrow("Invalid request");
  });
  it("enables the fallback only when both amount and date are set", () => {
    expect(prepaidDay("2026-10-05")).toBe(Date.UTC(2026, 9, 5));
    expect(prepaidFrom({ openAIPrepaidCreditUSD: 25, openAIPrepaidSince: "2026-10-05" })).toEqual({ amountUSD: 25, since: Date.UTC(2026, 9, 5) });
    expect(prepaidFrom({ openAIPrepaidCreditUSD: 0, openAIPrepaidSince: "2026-10-05" })).toBeUndefined();
    expect(prepaidFrom({ openAIPrepaidCreditUSD: 25, openAIPrepaidSince: "" })).toBeUndefined();
  });
});

describe("balance line", () => {
  const html = (balance: ApiBillingSnapshot["balance"]) => renderToStaticMarkup(createElement(ApiBillingBalanceLine, { balance }));
  it("labels reported, estimated and exhausted balances", () => {
    expect(html(undefined)).toBe("");
    expect(html({ source: "creditGrants", availableUSD: 62.5, grantedUSD: 100, usedUSD: 37.5 })).toMatch(/\$62\.50 left.*\$37\.50 used of \$100\.00.*unofficial/);
    expect(html({ source: "manual", availableUSD: 16.5, prepaidUSD: 20, since: Date.UTC(2026, 9, 6), spentSinceUSD: 3.5 })).toMatch(/~\$16\.50 left.*estimate.*\$20\.00 prepaid on 2026-10-06/);
    expect(html({ source: "manual", availableUSD: -2, prepaidUSD: 10, since: Date.UTC(2026, 9, 6), spentSinceUSD: 12 })).toMatch(/exhausted/);
  });
});
