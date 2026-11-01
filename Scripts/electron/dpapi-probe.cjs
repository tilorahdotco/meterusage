// Temporary CI diagnostic for the Windows DPAPI helper. Synthetic bytes only.
const { spawn } = require("node:child_process");
const ps = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
const args = s => ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", s];
const protect = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $d=[Convert]::FromBase64String($env:FIXTURE_KEY); [Console]::Out.Write([Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($d,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)))";
const unprotect = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $d=[Convert]::FromBase64String($env:METERUSAGE_DPAPI_INPUT); $p=[System.Security.Cryptography.ProtectedData]::Unprotect($d,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($p))";
const minimal = () => { const r = {}; for (const k of ["PATH", "PATHEXT", "SystemRoot", "SystemDrive", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"]) { const key = Object.keys(process.env).find(x => x.toUpperCase() === k.toUpperCase()); if (key) r[k] = process.env[key]; } return r; };
function run(name, script, env) {
  return new Promise(resolve => {
    const t0 = Date.now(), events = [], out = [];
    const child = spawn(ps, args(script), { env, stdio: "pipe", shell: false, windowsHide: true, windowsVerbatimArguments: false });
    const mark = e => events.push(`${e}@${Date.now() - t0}`);
    child.on("spawn", () => mark("spawn")); child.stdout.on("data", d => { out.push(d); mark("data"); }); child.stdout.on("end", () => mark("end"));
    child.stderr.on("data", d => mark("stderr:" + String(d).slice(0, 200))); child.on("exit", c => mark("exit:" + c)); child.on("error", e => mark("error:" + e.code));
    child.stdin.end();
    const timer = setTimeout(() => { mark("TIMEOUT"); child.kill(); }, 40000);
    child.on("close", () => { clearTimeout(timer); mark("close"); resolve({ name, events, stdout: Buffer.concat(out).toString().slice(0, 80) }); });
  });
}
(async () => {
  const key = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  const a = await run("protect-full-env", protect, { ...process.env, FIXTURE_KEY: key }); console.log(JSON.stringify(a));
  const wrapped = a.stdout && Buffer.from(a.stdout.length >= 80 ? "" : "", "base64");
  const full = await new Promise(r => { const c = spawn(ps, args(protect), { env: { ...process.env, FIXTURE_KEY: key }, windowsHide: true }); const o = []; c.stdout.on("data", d => o.push(d)); c.on("close", () => r(Buffer.concat(o).toString().trim())); c.stdin.end(); });
  console.log(JSON.stringify(await run("unprotect-minimal-env", unprotect, { ...minimal(), METERUSAGE_DPAPI_INPUT: full })));
  console.log(JSON.stringify(await run("unprotect-full-env", unprotect, { ...process.env, METERUSAGE_DPAPI_INPUT: full })));
})();
