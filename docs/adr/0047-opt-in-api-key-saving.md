# ADR 0047: Save API Admin keys with explicit consent

- Status: Accepted source implementation; unchecked default superseded by ADR 0048
- Date: 2026-11-12
- Supersedes: ADR 0032's prohibition on saving newly entered Admin keys

Settings offers an unchecked **Save key in macOS Keychain after a successful
fetch** option for OpenAI API and Anthropic API. One-time entry remains the
default. Windows continues to offer one-time entry only.

Save only after successful billing collection, snapshot persistence and refresh.
The fixed native helper receives the key through stdin, never process arguments,
and adds or updates only service `com.meterusage.api-keys`, account `openAI` or
`anthropic`. A save may replace that provider's existing key. A save failure
retains the fetched snapshot and returns a fixed error without credential data.

Use the existing legacy file-based macOS Keychain for compatibility with saved
keys from the previous app. Synchronization is disabled. Access follows that
Keychain's lock state and item access controls. The helper's requested
`kSecAttrAccessibleWhenUnlockedThisDeviceOnly` attribute does not enforce
accessibility in this store: Apple's [attribute documentation](https://developer.apple.com/documentation/security/ksecattraccessible)
requires the data protection Keychain or synchronization on macOS. Screen lock
does not guarantee that the login Keychain locks. Do not promise screen-lock
protection or backup exclusion for these items. This change does not migrate
credentials to the data protection Keychain.

Keep ADR 0032's remaining boundaries: trusted Settings IPC, fixed provider
endpoints, no credentials in preferences, snapshots or diagnostics, no renderer
readback, no startup or polling Keychain access, and isolated-profile refusal.
Explicit saved-key reads do not modify items or fall back to another source.

Synthetic billing tests and a disposable-Keychain create/update/read check prove
bounded source behavior. They do not establish installed GUI operation, existing
item prompts, real provider billing or release availability.
