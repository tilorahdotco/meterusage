// Temporary CI diagnostic for the Windows DPAPI helper. Synthetic bytes only.
const { spawnSync } = require("node:child_process");
const ps = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
const scripts = {
  load: "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::Out.Write('loaded')",
  protect: "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::Out.Write([Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect([byte[]](1,2,3),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)))",
};
for (const [name, script] of Object.entries(scripts)) for (const stdin of ["pipe", "ignore"]) {
  const started = Date.now();
  const r = spawnSync(ps, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, timeout: 45000, encoding: "utf8", stdio: [stdin, "pipe", "pipe"], input: stdin === "pipe" ? "" : undefined });
  console.log(JSON.stringify({ name, stdin, ms: Date.now() - started, status: r.status, signal: r.signal, error: r.error?.code, stdout: r.stdout?.slice(0, 200), stderr: r.stderr?.slice(0, 500) }));
}
