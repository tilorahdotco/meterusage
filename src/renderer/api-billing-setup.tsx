import { useRef, useState } from "react";
import { apiBillingNames, maxPrepaidUSD, prepaidDay, prepaidPreferenceKeys, validPrepaidAmount, type ApiBillingBalance, type ApiBillingProvider } from "../domain/api-billing";
import type { Request } from "../shared/ipc";

// Windows offers only the one-time key; macOS can explicitly save in Keychain.
export function ApiBillingSetup({ provider, disabled, action, savedKey = true }: { provider: ApiBillingProvider; disabled: boolean; action: (request: Request) => Promise<boolean | void>; savedKey?: boolean }) {
  const input = useRef<HTMLInputElement>(null), pending = useRef(false);
  const remember = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const fetchBilling = async (saved: boolean) => {
    if (disabled || pending.current) return;
    const adminKey = input.current?.value.trim();
    if (input.current) input.current.value = "";
    if (!saved && !adminKey) return;
    pending.current = true; setBusy(true);
    // A pasted key wins over "Use saved key", so the button never discards it.
    try { await action(adminKey ? { action: "apiBillingFetch", provider, adminKey, ...(savedKey && remember.current?.checked ? { remember: true } : {}) } : { action: "apiBillingFetchSaved", provider }); }
    finally { pending.current = false; setBusy(false); }
  };
  return <form className="api-billing-setup" onSubmit={async event => { event.preventDefault(); await fetchBilling(false); }}>
    {savedKey && <><button type="button" disabled={disabled || busy} onClick={() => fetchBilling(true)}>{busy ? "Fetching…" : "Use saved key"}</button><span className="secondary api-or">or</span></>}
    <input ref={input} className="api-key-input" aria-label={`${apiBillingNames[provider]} Admin key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={8192} required disabled={disabled || busy} placeholder="Paste Admin key" />
    <button type="submit" disabled={disabled || busy}>{busy ? "Fetching…" : "Fetch billing"}</button>
    <p className="secondary connection-help">Get one in {provider === "openai" ? "OpenAI Platform → Organization settings → Admin keys" : "Anthropic Console → Settings → Admin keys"}.</p>
    {savedKey && <label className="secondary connection-help api-key-save"><input ref={remember} type="checkbox" defaultChecked disabled={disabled || busy} /> Save key in macOS Keychain</label>}
  </form>;
}

const usd = (x: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
/** Short UTC date, such as "Dec 5". */
export const shortDay = (at: number) => new Date(at).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
const daysLeft = (ms: number) => { const days = Math.ceil(ms / 86400000); return `${days} day${days === 1 ? "" : "s"} left`; };

// Total, used and left come from the same three inputs, so the figures add up.
// One short note says where the numbers come from or what needs attention.
export function ApiBillingBalanceLine({ balance, now }: { balance?: ApiBillingBalance; now: number }) {
  if (!balance) return null;
  const reported = balance.source === "creditGrants";
  const total = reported ? balance.grantedUSD : balance.prepaidUSD, used = reported ? balance.usedUSD : balance.spentSinceUSD;
  const expiresAt = reported ? undefined : balance.expiresAt, expired = expiresAt !== undefined && now >= expiresAt;
  const exhausted = balance.availableUSD < 0;
  const note = expired ? `Expired ${shortDay(expiresAt)}. Fetch billing for the new credit.`
    : exhausted ? "Used more than the credit. Update it in Settings."
    : reported ? "Reported by OpenAI (unofficial)"
    : [`Estimate from ${shortDay(balance.since)}`, expiresAt !== undefined && `expires ${shortDay(expiresAt)} (${daysLeft(expiresAt - now)})`].filter(Boolean).join(" · ");
  return <div className="api-balance">
    <dl className="metrics api-balance-metrics"><div><dt>Total credit</dt><dd>{usd(total)}</dd></div><div><dt>Used</dt><dd>{usd(used)}</dd></div><div><dt>Left</dt><dd className={exhausted || expired ? "stale" : undefined}>{expired ? "Expired" : exhausted ? usd(0) : `${reported ? "" : "~"}${usd(balance.availableUSD)}`}</dd></div></dl>
    <p className={expired || exhausted ? "stale api-note" : "secondary api-note"}>{note}</p>
  </div>;
}

export function PrepaidCreditSetup({ provider, values, disabled, action }: { provider: ApiBillingProvider; values: Record<string, boolean | number | string | undefined>; disabled: boolean; action: (request: Request) => Promise<boolean | void> }) {
  const amount = useRef<HTMLInputElement>(null), since = useRef<HTMLInputElement>(null), monthly = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const keys = prepaidPreferenceKeys[provider], name = apiBillingNames[provider];
  const stored = values[keys.amount], storedSince = values[keys.since];
  const save = async (clear: boolean) => {
    const value = clear ? 0 : Number(amount.current?.value), day = clear ? "" : since.current?.value ?? "";
    if (!clear && (!validPrepaidAmount(value) || value <= 0 || prepaidDay(day) === undefined)) return;
    setBusy(true);
    try {
      // Zero the amount first so a failed later write leaves the fallback off, never a mismatched amount/date pair.
      const steps: Request[] = [{ action: "setPreference", key: keys.amount, value: 0 }, { action: "setPreference", key: keys.since, value: day }, { action: "setPreference", key: keys.monthly, value: !clear && monthly.current?.checked === true }];
      if (!clear) steps.push({ action: "setPreference", key: keys.amount, value });
      for (const step of steps) if (await action(step) === false) return;
      if (clear) { if (amount.current) amount.current.value = ""; if (since.current) since.current.value = ""; if (monthly.current) monthly.current.checked = false; }
    } finally { setBusy(false); }
  };
  return <form className="api-billing-setup api-prepaid" onSubmit={async event => { event.preventDefault(); await save(false); }}>
    <p className="secondary connection-help">{provider === "openai" ? "If OpenAI reports no balance, enter your credit to estimate what's left." : "Anthropic reports no balance. Enter your credit to estimate what's left."}</p>
    <label className="api-key-field"><span className="secondary">Credit (USD)</span><input ref={amount} aria-label={`${name} prepaid credit in USD`} type="number" min="0.01" max={maxPrepaidUSD} step="0.01" required disabled={disabled || busy} defaultValue={typeof stored === "number" && stored > 0 ? stored : undefined} placeholder="e.g. 50" /></label>
    <label className="api-key-field"><span className="secondary">Added on (UTC)</span><input ref={since} aria-label={`${name} prepaid credit date`} type="date" required disabled={disabled || busy} defaultValue={typeof storedSince === "string" ? storedSince : undefined} /></label>
    <label className="secondary connection-help api-key-save"><input ref={monthly} type="checkbox" disabled={disabled || busy} defaultChecked={values[keys.monthly] === true} /> Renews monthly on this day</label>
    <button type="submit" disabled={disabled || busy}>Save credit</button>
    {typeof stored === "number" && stored > 0 && <button type="button" disabled={disabled || busy} onClick={() => save(true)}>Clear</button>}
  </form>;
}
