# Installer smoke test for the unsigned Windows NSIS build on a CI runner.
# Exercises the installer behavior the in-app updater relies on: silent
# per-user install, `/S --updated --force-run` relaunching the installed app
# after it has been stopped, and silent uninstall. The app is force-stopped and
# the installer started from PowerShell, so this does not exercise the in-app
# download, Electron's detached spawn at quit, a real version change,
# SmartScreen or a user's existing data.
param([string]$Artifacts = "smoke-artifacts")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
$installer = Get-ChildItem release -Filter "MeterUsage-*-win-x64.exe" | Select-Object -First 1
if (-not $installer) { throw "Installer not found" }
$dir = Join-Path $env:LOCALAPPDATA "Programs\MeterUsage"
$exe = Join-Path $dir "MeterUsage.exe"
$uninstaller = Join-Path $dir "Uninstall MeterUsage.exe"
. (Join-Path $PSScriptRoot "windows-smoke-lib.ps1")

function Wait-Until([scriptblock]$Condition, [int]$Seconds, [string]$Message) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while (-not (& $Condition)) { if ((Get-Date) -gt $deadline) { throw $Message }; Start-Sleep -Milliseconds 500 }
}
function Stop-App { Get-Process -Name MeterUsage -ErrorAction SilentlyContinue | ForEach-Object { & taskkill.exe /pid $_.Id /t /f | Out-Null } }

# 1. Silent per-user install.
$p = Start-Process -FilePath $installer.FullName -ArgumentList "/S" -PassThru
$null = $p.Handle
if (-not $p.WaitForExit(120000)) { throw "Installer did not finish" }
if ($p.ExitCode -ne 0) { throw "Installer exited with $($p.ExitCode)" }
if (-not (Test-Path $exe) -or -not (Test-Path $uninstaller)) { throw "Installed files missing under $dir" }
Write-Host "installed to LOCALAPPDATA\Programs\MeterUsage"

# 2. The installed app writes a valid demo report.
$root = Join-Path $env:RUNNER_TEMP "meterusage-install-smoke"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Path $root | Out-Null
$out = Join-Path $Artifacts "installed-json-demo.json"
$p = Start-Process -FilePath $exe -ArgumentList @("json", "--demo", "--candidate-profile", (Join-Path $root "json")) -RedirectStandardOutput $out -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "Installed json exited with $($p.ExitCode)" }
Assert-Report $out 5

# 3. Updater handoff: the running app quits, then the verified installer runs
#    silently with --updated --force-run and must relaunch the installed app.
$running = Start-Process -FilePath $exe -ArgumentList @("--demo", "--candidate-profile", (Join-Path $root "gui")) -PassThru
Start-Sleep -Seconds 10
if ($running.HasExited) { throw "Installed app exited early" }
Stop-App; $running.WaitForExit(10000) | Out-Null
$before = Get-Date
# -Wait would also wait for the relaunched app if it became a descendant; wait for the installer process only.
$p = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "--updated", "--force-run") -PassThru
$null = $p.Handle
if (-not $p.WaitForExit(120000)) { throw "Update installer did not finish" }
if ($p.ExitCode -ne 0) { throw "Update installer exited with $($p.ExitCode)" }
Wait-Until { @(Get-Process -Name MeterUsage -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe -and $_.StartTime -gt $before }).Count -gt 0 } 30 "The update installer did not relaunch MeterUsage"
Write-Host "update installer relaunched the installed app"
Start-Sleep -Seconds 10
Save-Screen (Join-Path $Artifacts "installed-relaunch.png")
Stop-App

# 4. Silent uninstall removes the app.
Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait | Out-Null
Wait-Until { -not (Test-Path $exe) } 60 "Uninstall left MeterUsage.exe behind"
Write-Host "Windows install smoke passed"
