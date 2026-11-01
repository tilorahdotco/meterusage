# Smoke test for the packaged, unsigned Windows build on a CI runner.
# Uses synthetic demo profiles only. Proves the packaged app starts, writes a
# valid JSON report and keeps a demo GUI process running with visible windows.
# It does not prove real provider accounts, installers, updates or user input.
param(
  [string]$Exe = "release\win-unpacked\MeterUsage.exe",
  [string]$Artifacts = "smoke-artifacts"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
$root = Join-Path $env:RUNNER_TEMP "meterusage-smoke"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Path $root | Out-Null
$root = (Resolve-Path $root).Path
. (Join-Path $PSScriptRoot "windows-smoke-lib.ps1")

function Invoke-Json([string]$Name, [string[]]$Arguments, [int]$MinimumOk) {
  $out = Join-Path $Artifacts "$Name.json"
  $err = Join-Path $Artifacts "$Name.stderr.txt"
  $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { Get-Content $err | Write-Host; throw "$Name exited with $($p.ExitCode)" }
  Assert-Report $out $MinimumOk
}

function Invoke-Gui([string]$Name, [string]$ProfileDir, [int]$MinimumWindows) {
  $err = Join-Path $Artifacts "$Name.stderr.txt"
  $p = Start-Process -FilePath $Exe -ArgumentList @("--demo", "--candidate-profile", $ProfileDir) -RedirectStandardError $err -PassThru
  try {
    Start-Sleep -Seconds 20
    if ($p.HasExited) { Get-Content $err -ErrorAction SilentlyContinue | Write-Host; throw "$Name exited early with $($p.ExitCode)" }
    $titles = @(Get-AppWindows)
    Write-Host "$Name visible windows: $($titles -join ' | ')"
    Save-Screen (Join-Path $Artifacts "$Name.png")
    # Every window adopts the document title "MeterUsage" once loaded.
    $app = @($titles | Where-Object { $_ -eq "MeterUsage" })
    if ($app.Count -lt $MinimumWindows) { throw "$Name shows $($app.Count) MeterUsage windows; expected at least $MinimumWindows" }
    Start-Sleep -Seconds 5
    if ($p.HasExited) { throw "$Name exited after its windows appeared" }
  } finally {
    & taskkill.exe /pid $p.Id /t /f | Out-Null
    $p.WaitForExit(10000) | Out-Null
  }
}

# 1. Headless JSON: synthetic demo data, then the real (empty) runner profile.
Invoke-Json "json-demo" @("json", "--demo", "--candidate-profile", (Join-Path $root "json-demo")) 5
Invoke-Json "json-live" @("json") 0

# 2. First demo launch: onboarding is not complete, so Settings opens.
$gui = Join-Path $root "gui-demo"
Invoke-Gui "gui-first-launch" $gui 1
if (-not (Test-Path (Join-Path $gui ".meterusage-candidate"))) { throw "Candidate marker missing" }

# 3. Relaunch the same profile with onboarding complete and the side notch on:
#    the usage flyout and the side notch strip both open.
$prefs = @{ onboardingCompleted = $true; sideNotchPanelEnabled = $true }
foreach ($provider in "Codex", "Claude", "OpenRouter", "OpenCodeGo", "Grok", "Antigravity", "Muse") { $prefs["showProvider$provider"] = $true }
$prefs | ConvertTo-Json | Set-Content -Encoding utf8NoBOM (Join-Path $gui "preferences.json")
Invoke-Gui "gui-relaunch" $gui 2
Write-Host "Windows smoke passed"
