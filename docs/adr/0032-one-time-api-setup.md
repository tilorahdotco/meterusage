# ADR 0032: Set up API billing with a one-time key

- Status: Accepted implementation direction; live billing acceptance pending
- Date: 2026-10-17
- Amended: 2026-11-12, explicit opt-in macOS Keychain saving

Place API billing setup in **Settings → API connections**, separate from app
account connections and onboarding. OpenAI API and Anthropic API each have a
masked organization Admin key field and an explicit **Fetch billing** action.
**Use saved key** reuses the same provider's Admin key from the previous app.
Project keys and consumer subscription sign-in do not grant billing access.

This narrowly amends ADR 0029's environment-only, no-app-input boundary. The
registered Settings document may send a validated one-time key to the main
process. The existing collector requests only the selected provider's fixed
cost endpoint and writes the same projected owner-only snapshot. No key is
saved to preferences or snapshot files, included in diagnostics/state
publication, or returned in an error. The UI clears input on submit or leaving
the page. The advanced environment helper remains available.

On explicit saved-key use, the main process reads only the legacy generic
password service `com.meterusage.api-keys`, account `openAI` or `anthropic`,
through the existing native helper. It may request macOS access. Reads never
change or delete the item or return the key to the renderer, and never fall
back to another source. The unchecked **Save key in macOS Keychain** option
permits adding or updating only this fixed provider item after a successful
fetch. The helper receives the key through stdin, never process arguments. New
items disable synchronization and request device-local, unlocked-only
accessibility; enforcement follows macOS Keychain controls. A failed save retains the
fetched snapshot and reports a fixed save error. Missing and denied reads fail with fixed errors.
No startup or background Keychain access is added.

Permit one fetch per provider at a time, refuse demo/candidate/isolated profiles,
and cancel pending requests on quit. Failed collection preserves the previous
snapshot. Successful collection updates the displayed snapshot automatically.
Ordinary Refresh continues to read saved snapshots without API access. No
other credential store or background billing scheduler is added. Windows
continues to offer one-time keys only.

Synthetic tests and demo layout checks do not establish real organization
permissions, report completeness or invoice accuracy. Keep those acceptance
checks separate from source and installed-app verification.
