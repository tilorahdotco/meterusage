# ADR 0040: Windows desktop account connections

- Status: Source implementation with synthetic and CI proof; unverified against real Windows installs and accounts
- Date: 2026-11-01
- Amends: [ADR 0038](0038-windows-ci-test-machine.md) (Windows marks Claude,
  Grok and Antigravity Desktop connections unsupported)
- Related: [ADR 0011](0011-desktop-account-connections.md),
  [ADR 0026](0026-antigravity-desktop-local-quota.md),
  [ADR 0028](0028-grok-bot-desktop-reader.md)

## Context

On macOS, Claude Desktop and Grok Bot Desktop secrets come from fixed Keychain
items read by a bundled Swift helper. Claude's cookie store is read with
`/usr/bin/sqlite3` under `/usr/bin/sandbox-exec`. Antigravity Desktop is found
with `ps` and `lsof`. None of these exist on Windows.

On Windows, Chromium and Electron apps store a random AES-256 key in their
`Local State` file (`os_crypt.encrypted_key`). That key is base64, prefixed
`DPAPI`, and wrapped with the user's DPAPI key. Values encrypted with it are
`v10`, a 12-byte nonce, AES-256-GCM ciphertext, then a 16-byte tag. Chrome's
app-bound `v20` values need Chrome's elevation service and do not apply to
Electron apps.

## Decision

The same opt-in flows, consent dialogs, account binding, request bounds and
before/after verification apply on Windows. Only the platform readers change:

- **Key unwrap.** A fixed PowerShell script calls
  `ProtectedData.Unprotect(..., CurrentUser)` through the fixed
  `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`. The wrapped,
  still DPAPI-protected key is passed in that child's environment only, because
  `powershell.exe -Command` does not reliably give the script redirected stdin.
  Only the same Windows user can unwrap it, and they can already read it from
  `Local State`. The key comes back on stdout. Neither appears in the
  arguments. The key must be 32 bytes. It stays in main-process memory for one
  attempt and is zeroed afterwards; copies in strings are subject to garbage
  collection. Windows shows no prompt: DPAPI unlocks only for the signed-in
  user.
- **App data folders.** Each app's folder is `%APPDATA%\<name>`. If that folder
  is missing, MeterUsage accepts exactly one MSIX package folder,
  `%LOCALAPPDATA%\Packages\<family>_<publisher id>\LocalCache\Roaming\<name>`,
  whose family name ends in the app name. PowerShell gets the app's
  environment with `PSModulePath` limited to the system module folder, so user
  module paths cannot replace the fixed cmdlets. A stripped environment made
  PowerShell 5.1 start about 25 seconds slower on the CI runner.
- **Claude Desktop.** The reader uses `%APPDATA%\Claude`: `config.json` for
  `lastKnownAccountUuid`, and `Cookies` or `Network\Cookies` for the same two
  fixed cookies. Electron's `node:sqlite` opens each store read-only with
  `immutable=1&mode=ro`, so it takes no locks and writes no journal, WAL or
  shared-memory file. The same schema-24 host-digest, expiry and
  deduplication rules apply. If Claude Desktop holds the store so it cannot be
  opened, Connect reports a fixed "quit Claude Desktop, then try again"
  message.
- **Grok Bot Desktop.** The reader uses `%APPDATA%\Grok Bot\sand-secrets.json`,
  with the same bounded, link-rejecting, stability-checked read. The Local State
  key replaces the Keychain password. Scoped and legacy `v10` envelopes,
  JWT-subject binding and team handling are unchanged. Saved legacy
  Grok-via-Cursor connections are not supported on Windows; new connections
  use Bot Desktop.
- **Antigravity Desktop.** A fixed PowerShell CIM query runs inside PowerShell.
  It keeps only `language_server*.exe` processes under an `Antigravity` or
  `Antigravity IDE` folder that belong to the current user's SID, and returns
  only those processes' command lines and `127.0.0.1` listeners
  (`Get-NetTCPConnection`). Node then applies the existing checks: exactly one
  server, the executable pattern, a command line that starts with that
  executable, a CSRF token, and 1–8 loopback ports. Each discovery starts
  PowerShell, so collection has a 60-second bound on Windows instead of 15.
- **Codex.** Connected Codex uses the Codex CLI with a minimal Windows
  environment, and the keyring store maps to Windows Credential Manager. An npm
  `.cmd` shim is resolved to its `node.exe` and script and run directly, so the
  quoted keyring configuration arguments never reach `cmd.exe`. Only
  unrecognized shims fall back to `cmd.exe`, with ADR 0038's argument rules.
- **API billing.** **Use saved key** stays hidden on Windows: it reads a legacy
  macOS Keychain item that never existed on Windows. The one-time Admin key
  works.

## Proof

Synthetic tests on every platform cover:

- the AES-GCM decryptor, including tampered, `v20` and wrong-key values;
- `DPAPI` prefix and key-length checks;
- the PowerShell call shape, with the wrapped blob in the child environment and never in arguments;
- the Claude reader on a real SQLite file, including the wrong key, conflicting
  sessions and an unreadable store;
- the Grok reader with Local State and its failure stages;
- the Antigravity discovery parser and its refusals.

On the Windows CI runner, tests also cover:

- a real DPAPI round trip through the production PowerShell helper;
- an npm-format shim passing quoted and `%` arguments unchanged;
- a full Claude Desktop Connect and allowance read from roaming AppData, with a
  synthetic key and synthetic server responses.
- the real Antigravity discovery script (it must run and find no server);
- refusal of an npm-style shim whose script leaves `node_modules`.

The packaged smoke run checks that the packaged Electron's Node provides
`node:sqlite`.

Not proven: real Claude Desktop, Grok Bot Desktop or Antigravity installs on
Windows, including their actual folder names and Local State format;
whether Claude Desktop locks its cookie store while running; the Antigravity
executable location and its CIM visibility; and live server acceptance.
Release notes and docs must call these connections unverified on Windows.
