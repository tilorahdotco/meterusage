#!/usr/bin/env bash
# Smoke test for the packaged, unsigned Linux build (ADR 0050).
# Uses synthetic demo profiles only. Proves the packaged app starts, writes a
# valid JSON report and keeps a demo GUI process running with visible windows
# on a virtual X display. It does not prove real provider accounts, tray hosts,
# desktop environments, Wayland, AppImage integration, updates or user input.
# Needs Xvfb and xdotool; ImageMagick or ffmpeg add screenshots.
set -euo pipefail

exe="$(realpath "${1:-release/linux-unpacked/meterusage}")"
artifacts="$(mkdir -p "${2:-smoke-artifacts}" && realpath "${2:-smoke-artifacts}")"
root="$(mktemp -d "${TMPDIR:-/tmp}/meterusage-smoke.XXXXXX")"
display=":${SMOKE_DISPLAY:-97}"
xvfb=""
cleanup() { [ -n "$xvfb" ] && kill "$xvfb" 2>/dev/null; rm -rf "$root"; }
trap cleanup EXIT

assert_report() {
  node -e "const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); if (r.schema !== 1 || !Array.isArray(r.providers) || !r.providers.length) throw new Error('bad report'); const ok = r.providers.filter(p => p.status === 'ok').length; if (ok < Number(process.argv[2])) throw new Error('expected ' + process.argv[2] + ' ok providers, got ' + ok); console.log('report ok: ' + r.providers.length + ' providers, ' + ok + ' ok');" "$1" "$2"
}

json() {
  local name="$1" minimum="$2"; shift 2
  if ! "$exe" "$@" > "$artifacts/$name.json" 2> "$artifacts/$name.stderr.txt"; then cat "$artifacts/$name.stderr.txt"; echo "$name failed" >&2; exit 1; fi
  assert_report "$artifacts/$name.json" "$minimum"
}

screenshot() {
  if command -v import > /dev/null; then DISPLAY="$display" import -window root "$1" || true
  elif command -v ffmpeg > /dev/null; then ffmpeg -loglevel error -y -f x11grab -i "$display" -frames:v 1 "$1" || true
  else echo "no screenshot tool; skipped $1"; fi
}

gui() {
  local name="$1" profile="$2" minimum="$3"
  DISPLAY="$display" "$exe" --demo --candidate-profile "$profile" 2> "$artifacts/$name.stderr.txt" &
  local pid=$!
  sleep 20
  if ! kill -0 "$pid" 2>/dev/null; then cat "$artifacts/$name.stderr.txt"; echo "$name exited early" >&2; exit 1; fi
  # Every window adopts the document title "MeterUsage" once loaded.
  local count; count="$(DISPLAY="$display" xdotool search --onlyvisible --name '^MeterUsage$' 2>/dev/null | wc -l)"
  echo "$name visible MeterUsage windows: $count"
  screenshot "$artifacts/$name.png"
  if [ "$count" -lt "$minimum" ]; then kill "$pid"; echo "$name shows $count MeterUsage windows; expected at least $minimum" >&2; exit 1; fi
  sleep 5
  if ! kill -0 "$pid" 2>/dev/null; then echo "$name exited after its windows appeared" >&2; exit 1; fi
  kill "$pid"; wait "$pid" 2>/dev/null || true
}

# 0. Electron's bundled Node provides node:sqlite, which the provider readers use.
echo 'const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE t(x)"); console.log("packaged node:sqlite ok");' > "$root/sqlite-probe.cjs"
ELECTRON_RUN_AS_NODE=1 "$exe" "$root/sqlite-probe.cjs" | tee "$artifacts/sqlite-probe.txt" | grep -q "packaged node:sqlite ok"

# 1. Headless JSON with no display: synthetic demo data, then the real (empty) runner profile.
#    Chromium picks its display platform before app code runs, so headless use passes the switch.
#    SMOKE_LIVE=0 skips the real profile on a developer machine.
unset DISPLAY WAYLAND_DISPLAY
json json-demo 5 json --demo --candidate-profile "$root/json-demo" --ozone-platform=headless
if [ "${SMOKE_LIVE:-1}" = 1 ]; then json json-live 0 json --ozone-platform=headless; fi

# 2. First demo launch: onboarding is not complete, so Settings opens.
Xvfb "$display" -screen 0 1440x900x24 -nolisten tcp > /dev/null 2>&1 &
xvfb=$!
sleep 2
gui gui-first-launch "$root/gui-demo" 1
[ -f "$root/gui-demo/.meterusage-candidate" ] || { echo "Candidate marker missing" >&2; exit 1; }

# 3. Relaunch the same profile with onboarding complete and the side notch on:
#    the usage flyout and the side notch strip both open.
node -e "const p = { onboardingCompleted: true, sideNotchPanelEnabled: true }; for (const n of ['Codex', 'Claude', 'OpenRouter', 'OpenCodeGo', 'Grok', 'Antigravity', 'Muse']) p['showProvider' + n] = true; require('fs').writeFileSync(process.argv[1], JSON.stringify(p));" "$root/gui-demo/preferences.json"
gui gui-relaunch "$root/gui-demo" 2
echo "Linux smoke passed"
