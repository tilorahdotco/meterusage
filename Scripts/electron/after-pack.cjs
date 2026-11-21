const { renameSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

// executableName also changes electron-builder's bundle filename. Keep the
// product bundle name, then rename only its main executable before signing.
function renameExecutable(bundle, command = execFileSync) {
  renameSync(join(bundle, "Contents/MacOS/MeterUsage"), join(bundle, "Contents/MacOS/meterusage"));
  command("/usr/libexec/PlistBuddy", ["-c", "Set :CFBundleExecutable meterusage", join(bundle, "Contents/Info.plist")]);
}
module.exports = async context => {
  // Windows keeps MeterUsage.exe and Linux sets executableName itself; only the macOS bundle renames its executable.
  if (context.electronPlatformName === "win32" || context.electronPlatformName === "linux") return;
  if (context.electronPlatformName !== "darwin") throw new Error("Only macOS, Windows and Linux packaging are enabled");
  renameExecutable(join(context.appOutDir, "MeterUsage.app"));
};
module.exports.renameExecutable = renameExecutable;
