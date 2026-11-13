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
    {savedKey && <><button type="button" disabled={disabled || busy} onClick={() => fetchBilling(true)}>{busy ? "Fetching…" : "Use saved key"}</button>
    <p className="secondary connection-help">Reuse this provider's Admin key saved in macOS Keychain. Approve macOS Keychain access if asked.</p></>}
    <p className="secondary connection-help">{provider === "openai" ? "OpenAI Platform → Organization settings → Admin keys." : "Anthropic Console → Settings → Admin keys."}</p>
    <label className="api-key-field"><span className="secondary">Or paste an Admin key</span><input ref={input} aria-label={`${apiBillingNames[provider]} Admin key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={8192} required disabled={disabled || busy} placeholder="Paste Admin key" /></label>
    <button type="submit" disabled={disabled || busy}>{busy ? "Fetching…" : "Fetch billing"}</button>
    {savedKey && <label className="secondary connection-help api-key-save"><input ref={remember} type="checkbox" defaultChecked disabled={disabled || busy} /> Save key in macOS Keychain after a successful fetch</label>}
  </form>;
}

const usd = (x: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const isoDay = (at: number) => new Date(at).toISOString().slice(0, 10);

// Total, used and left always come from the same three inputs, so the figures add up.
export function ApiBillingBalanceLine({ balance }: { balance?: ApiBillingBalance }) {
  if (!balance) return null;
  const reported = balance.source === "creditGrants";
  const total = reported ? balance.grantedUSD : balance.prepaidUSD, used = reported ? balance.usedUSD : balance.spentSinceUSD;
  const exhausted = balance.availableUSD < 0, mark = reported ? "" : "~";
  return <div className="api-balance">
    <dl className="metrics api-balance-metrics"><div><dt>Total credit</dt><dd>{usd(total)}</dd></div><div><dt>Used</dt><dd>{usd(used)}</dd></div><div><dt>Left</dt><dd className={exhausted ? "stale" : undefined}>{exhausted ? usd(0) : `${mark}${usd(balance.availableUSD)}`}</dd></div></dl>
    {reported ? <p className="secondary">OpenAI credit grants (unofficial)</p>
      : exhausted ? <p className="stale">Estimated balance exhausted · {usd(used)} spent since {isoDay(balance.since)} exceeds the {usd(total)} prepaid. Update prepaid credit in Settings.</p>
      : <p className="secondary">Estimate: {usd(total)} {balance.monthly ? "monthly credit renewed" : "prepaid on"} {isoDay(balance.since)} minus {usd(used)} spent since</p>}
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
    <p className="secondary connection-help">{provider === "openai" ? "Balance fallback: if OpenAI does not report a balance, MeterUsage estimates it" : "Anthropic does not report a credit balance to Admin keys. MeterUsage estimates it"} from your credit total and top-up date minus spend since that day. For a monthly credit, select Renews monthly. Fetch billing again after saving.</p>
    <label className="api-key-field"><span className="secondary">Prepaid credit (USD)</span><input ref={amount} aria-label={`${name} prepaid credit in USD`} type="number" min="0.01" max={maxPrepaidUSD} step="0.01" required disabled={disabled || busy} defaultValue={typeof stored === "number" && stored > 0 ? stored : undefined} placeholder="e.g. 50" /></label>
    <label className="api-key-field"><span className="secondary">Added on (UTC date)</span><input ref={since} aria-label={`${name} prepaid credit date`} type="date" required disabled={disabled || busy} defaultValue={typeof storedSince === "string" ? storedSince : undefined} /></label>
    <label className="secondary connection-help api-key-save"><input ref={monthly} type="checkbox" disabled={disabled || busy} defaultChecked={values[keys.monthly] === true} /> Renews monthly: the credit resets on this day each month</label>
    <button type="submit" disabled={disabled || busy}>Save prepaid credit</button>
    {typeof stored === "number" && stored > 0 && <button type="button" disabled={disabled || busy} onClick={() => save(true)}>Clear</button>}
  </form>;
}
