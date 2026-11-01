# Shared helpers for the Windows CI smoke scripts.

function Assert-Report([string]$Path, [int]$MinimumOk) {
  node -e "const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); if (r.schema !== 1 || !Array.isArray(r.providers) || !r.providers.length) throw new Error('bad report'); const ok = r.providers.filter(p => p.status === 'ok').length; if (ok < Number(process.argv[2])) throw new Error('expected ' + process.argv[2] + ' ok providers, got ' + ok); console.log('report ok: ' + r.providers.length + ' providers, ' + ok + ' ok');" $Path $MinimumOk
  if ($LASTEXITCODE -ne 0) { throw "Invalid JSON report: $Path" }
}

function Save-Screen([string]$Path) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

function Get-AppWindows {
  # Top-level windows owned by any MeterUsage process (Electron's browser process owns them).
  Add-Type -TypeDefinition @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class TopWindows {
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static List<string> Visible(int[] pids) {
    var found = new List<string>(); var set = new HashSet<int>(pids);
    EnumWindows((h, p) => { int pid; GetWindowThreadProcessId(h, out pid); if (set.Contains(pid) && IsWindowVisible(h)) { var s = new StringBuilder(256); GetWindowText(h, s, 256); found.Add(s.ToString()); } return true; }, IntPtr.Zero);
    return found;
  }
}
"@ -ErrorAction SilentlyContinue
  $ids = @(Get-Process -Name MeterUsage -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  if (-not $ids.Count) { return @() }
  return [TopWindows]::Visible([int[]]$ids)
}

