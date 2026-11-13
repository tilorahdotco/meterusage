# ADR 0048: Save pasted API Admin keys by default

- Status: Accepted source implementation; release and live billing acceptance pending
- Date: 2026-11-12
- Supersedes: ADR 0047's unchecked default

ADR 0047's unchecked **Save key in macOS Keychain** option lost keys in
practice. The maintainer pasted an Anthropic Admin key, did not notice the box,
and later found no saved key. **Use saved key** also cleared a pasted key and
then read the empty Keychain item.

On macOS the save option now starts selected. Clearing it before a fetch keeps
one-time entry. **Use saved key** fetches with the pasted key when the field is
not empty, applying the save option. With an empty field it reads the selected
provider's saved Keychain item, as before. A successful fetch with saving
selected may replace that provider's saved key. Windows still offers one-time
entry only.

All other ADR 0047 boundaries are unchanged: save only after a successful fetch,
stdin-only transfer to the fixed helper, the fixed `com.meterusage.api-keys`
items, the legacy file-based Keychain and its stated limits, and no credentials
in preferences, snapshots, diagnostics or the renderer.

Synthetic renderer tests cover the default and the pasted-key path. A synthetic
save and read with the installed beta.21 helper in the macOS GUI session
succeeded. Real billing with a saved key is not yet confirmed.
