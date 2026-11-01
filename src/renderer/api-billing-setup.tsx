import { useRef, useState } from "react";
import { apiBillingNames, maxPrepaidUSD, prepaidDay, prepaidPreferenceKeys, validPrepaidAmount, type ApiBillingBalance, type ApiBillingProvider } from "../domain/api-billing";
import type { Request } from "../shared/ipc";

// The saved key is a legacy macOS Keychain item; Windows offers only the one-time key.
export function ApiBillingSetup({ provider, disabled, action, savedKey = true }: { provider: ApiBillingProvider; disabled: boolean; action: (request: Request) => Promise<boolean | void>; savedKey?: boolean }) {
  const input = useRef<HTMLInputElement>(null), pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const fetchBilling = async (saved: boolean) => {
    if (disabled || pending.current) return;
    const adminKey = input.current?.value.trim();
    if (input.current) input.current.value = "";
    if (!saved && !adminKey) return;
    pending.current = true; setBusy(true);
    try { await action(saved ? { action: "apiBillingFetchSaved", provider } : { action: "apiBillingFetch", provider, adminKey: adminKey! }); }
    finally { pending.current = false; setBusy(false); }
  };
  return <form className="api-billing-setup" onSubmit={async event => { event.preventDefault(); await fetchBilling(false); }}>
    {savedKey && <><button type="button" disabled={disabled || busy} onClick={() => fetchBilling(true)}>{busy ? "Fetching…" : "Use saved key"}</button>
    <p className="secondary connection-help">Reuse this provider's Admin key saved by the previous MeterUsage. Approve macOS Keychain access if asked.</p></>}
    <p className="secondary connection-help">{provider === "openai" ? "OpenAI Platform → Organization settings → Admin keys." : "Anthropic Console → Settings → Admin keys."}</p>
    <label className="api-key-field"><span className="secondary">Or use a one-time Admin key</span><input ref={input} aria-label={`${apiBillingNames[provider]} Admin key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={8192} required disabled={disabled || busy} placeholder="Paste Admin key" /></label>
    <button type="submit" disabled={disabled || busy}>{busy ? "Fetching…" : "Fetch billing"}</button>
  </form>;
}

const usd = (x: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const isoDay = (at: number) => new Date(at).toISOString().slice(0, 10);

export function ApiBillingBalanceLine({ balance }: { balance?: ApiBillingBalance }) {
  if (!balance) return null;
  if (balance.source === "creditGrants") return <p className="secondary api-balance"><strong>{usd(balance.availableUSD)} left</strong> · {usd(balance.usedUSD)} used of {usd(balance.grantedUSD)} credit granted · OpenAI credit grants (unofficial)</p>;
  if (balance.availableUSD < 0) return <p className="stale api-balance"><strong>Estimated balance exhausted</strong> · {usd(balance.spentSinceUSD)} spent since {isoDay(balance.since)} exceeds the {usd(balance.prepaidUSD)} prepaid. Update prepaid credit in Settings.</p>;
  return <p className="secondary api-balance"><strong>~{usd(balance.availableUSD)} left</strong> · estimate: {usd(balance.prepaidUSD)} prepaid on {isoDay(balance.since)} minus {usd(balance.spentSinceUSD)} spent since</p>;
}

export function PrepaidCreditSetup({ values, disabled, action }: { values: Record<string, boolean | number | string | undefined>; disabled: boolean; action: (request: Request) => Promise<boolean | void> }) {
  const amount = useRef<HTMLInputElement>(null), since = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stored = values[prepaidPreferenceKeys.amount], storedSince = values[prepaidPreferenceKeys.since];
  const save = async (clear: boolean) => {
    const value = clear ? 0 : Number(amount.current?.value), day = clear ? "" : since.current?.value ?? "";
    if (!clear && (!validPrepaidAmount(value) || value <= 0 || prepaidDay(day) === undefined)) return;
    setBusy(true);
    try {
      // Zero the amount first so a failed later write leaves the fallback off, never a mismatched amount/date pair.
      const steps: Request[] = [{ action: "setPreference", key: prepaidPreferenceKeys.amount, value: 0 }, { action: "setPreference", key: prepaidPreferenceKeys.since, value: day }];
      if (!clear) steps.push({ action: "setPreference", key: prepaidPreferenceKeys.amount, value });
      for (const step of steps) if (await action(step) === false) return;
      if (clear) { if (amount.current) amount.current.value = ""; if (since.current) since.current.value = ""; }
    } finally { setBusy(false); }
  };
  return <form className="api-billing-setup api-prepaid" onSubmit={async event => { event.preventDefault(); await save(false); }}>
    <p className="secondary connection-help">Balance fallback: if OpenAI does not report a balance, MeterUsage estimates it from your last top-up minus spend since that day. Fetch billing again after saving.</p>
    <label className="api-key-field"><span className="secondary">Prepaid credit (USD)</span><input ref={amount} aria-label="OpenAI prepaid credit in USD" type="number" min="0.01" max={maxPrepaidUSD} step="0.01" required disabled={disabled || busy} defaultValue={typeof stored === "number" && stored > 0 ? stored : undefined} placeholder="e.g. 50" /></label>
    <label className="api-key-field"><span className="secondary">Added on (UTC date)</span><input ref={since} aria-label="OpenAI prepaid credit date" type="date" required disabled={disabled || busy} defaultValue={typeof storedSince === "string" ? storedSince : undefined} /></label>
    <button type="submit" disabled={disabled || busy}>Save prepaid credit</button>
    {typeof stored === "number" && stored > 0 && <button type="button" disabled={disabled || busy} onClick={() => save(true)}>Clear</button>}
  </form>;
}
