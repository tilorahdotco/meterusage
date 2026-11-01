import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromiumKey, decryptChromiumWindows, dpapiUnprotect, powershell, unprotectInput, unprotectScript, type Unprotect } from "../src/main/providers/windows-dpapi";
import { claudeIdentity, readDesktopCredential } from "../src/main/providers/claude-desktop";
import { readGrokBotCredential, GrokBotFailure } from "../src/main/providers/grok-bot-desktop";
import { discoverAntigravity, windowsDiscoveryScript } from "../src/main/providers/antigravity-desktop";
import type { Command } from "../src/main/providers/transport";

// Every value here is synthetic. The fake DPAPI only maps one invented wrapped blob to one invented key.
const roots: string[] = [];
const temp = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), "meterusage-winconn-fixture-"))); roots.push(root); return root; };
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = createHash("sha256").update("synthetic local state key").digest(), wrapped = Buffer.from("synthetic-dpapi-blob");
const fakeUnprotect: Unprotect = async data => { if (!data.equals(wrapped)) throw new Error("fake DPAPI refuses other blobs"); return Buffer.from(key); };
const localState = (blob = Buffer.concat([Buffer.from("DPAPI"), wrapped])) => JSON.stringify({ browser: { private: "OMIT" }, os_crypt: { encrypted_key: blob.toString("base64"), audit_enabled: true } });
function seal(plain: Buffer | string, with_ = key, prefix = "v10") {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", with_, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from(prefix), nonce, body, cipher.getAuthTag()]);
}

describe("Windows Chromium secrets", () => {
  it("decrypts v10 AES-256-GCM values and refuses tampered, app-bound or short values", () => {
    expect(decryptChromiumWindows(seal("synthetic value"), key).toString()).toBe("synthetic value");
    const tampered = seal("synthetic value"); tampered[tampered.length - 1] ^= 1;
    for (const bytes of [tampered, seal("synthetic value", key, "v20"), seal("synthetic value", randomBytes(32)), Buffer.from("v10short")]) expect(() => decryptChromiumWindows(bytes, key)).toThrow("Windows protected data unavailable");
  });
  it("unwraps only a DPAPI-prefixed 32-byte Local State key", async () => {
    const root = temp(), path = join(root, "Local State");
    writeFileSync(path, localState()); expect((await chromiumKey(path, fakeUnprotect)).equals(key)).toBe(true);
    for (const raw of [localState(Buffer.concat([Buffer.from("APPB"), wrapped])), JSON.stringify({ os_crypt: {} }), "{damaged"]) { writeFileSync(path, raw); await expect(chromiumKey(path, fakeUnprotect)).rejects.toThrow(); }
    writeFileSync(path, localState()); await expect(chromiumKey(path, async () => Buffer.alloc(16))).rejects.toThrow("Windows protected data unavailable");
  });
  it("runs the fixed PowerShell DPAPI script with the wrapped blob in its environment, never in arguments", async () => {
    const command = vi.fn<Command>(async () => Buffer.from(key).toString("base64") + "\r\n");
    expect((await dpapiUnprotect(command, { SystemRoot: "C:\\Windows" })(wrapped)).equals(key)).toBe(true);
    const [binary, args, options] = command.mock.calls[0];
    expect(binary).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"); expect(powershell({})).toBe(binary);
    expect(args).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", unprotectScript]);
    expect(options?.env?.[unprotectInput]).toBe(wrapped.toString("base64")); expect(options?.env?.SystemRoot).toBe("C:\\Windows"); expect(options?.env?.PSModulePath).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules"); expect(args.join(" ")).not.toContain(wrapped.toString("base64"));
    await expect(dpapiUnprotect(async () => "not base64!")(wrapped)).rejects.toThrow();
  });
});

const account = "11111111-1111-1111-1111-111111111111", org = "22222222-2222-2222-2222-222222222222", now = Date.parse("2026-10-20T12:00:00Z");
function cookieRow(name: string, value: string, host = ".claude.ai") {
  return { host_key: host, name, path: "/", is_secure: 1, is_httponly: name === "sessionKey" ? 1 : 0, expires_utc: String((BigInt(now) + 11644473600000n) * 1000n + 3600000000n), encrypted_value: seal(Buffer.concat([createHash("sha256").update(host).digest(), Buffer.from(value)])) };
}
function claudeRoot(rows = [cookieRow("sessionKey", "synthetic-session"), cookieRow("lastActiveOrg", org)]) {
  const root = join(temp(), "Claude"); mkdirSync(join(root, "Network"), { recursive: true });
  writeFileSync(join(root, "config.json"), JSON.stringify({ lastKnownAccountUuid: account, "oauth:tokenCacheV2": "OMIT_UNRELATED_OAUTH" }));
  const db = new DatabaseSync(join(root, "Network", "Cookies"));
  db.exec("CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR); INSERT INTO meta VALUES('version','24'); CREATE TABLE cookies(host_key TEXT, name TEXT, value TEXT, path TEXT, is_secure INTEGER, is_httponly INTEGER, expires_utc INTEGER, encrypted_value BLOB)");
  const insert = db.prepare("INSERT INTO cookies(host_key, name, value, path, is_secure, is_httponly, expires_utc, encrypted_value) VALUES (?, ?, '', ?, ?, ?, ?, ?)");
  for (const r of rows) insert.run(r.host_key, r.name, r.path, r.is_secure, r.is_httponly, BigInt(r.expires_utc), r.encrypted_value);
  db.close();
  return root;
}

describe("Windows Claude Desktop reader", () => {
  it("reads the two fixed cookies read-only and binds the account and organization", async () => {
    const root = claudeRoot(), decrypt = (bytes: Uint8Array) => decryptChromiumWindows(bytes, key);
    const credential = await readDesktopCredential("/unused-home", decrypt, now, undefined, async () => { throw new Error("no subprocess on Windows"); }, undefined, { root });
    expect(credential).toEqual({ account, organization: org, cookie: "sessionKey=synthetic-session", identity: claudeIdentity(account, org) });
  });
  it("fails closed with the wrong key, conflicting sessions or an unreadable store", async () => {
    const stages: string[] = [];
    await expect(readDesktopCredential("/unused", bytes => decryptChromiumWindows(bytes, randomBytes(32)), now, stage => stages.push(stage), undefined, undefined, { root: claudeRoot() })).rejects.toThrow();
    expect(stages).toContain("decryption");
    await expect(readDesktopCredential("/unused", bytes => decryptChromiumWindows(bytes, key), now, undefined, undefined, undefined, { root: claudeRoot([cookieRow("sessionKey", "a"), cookieRow("sessionKey", "b"), cookieRow("lastActiveOrg", org)]) })).rejects.toThrow();
    const broken = claudeRoot(); writeFileSync(join(broken, "Network", "Cookies"), "not a database"); stages.length = 0;
    await expect(readDesktopCredential("/unused", bytes => decryptChromiumWindows(bytes, key), now, stage => stages.push(stage), undefined, undefined, { root: broken })).rejects.toThrow();
    expect(stages.at(-1)).toBe("locked");
  });
});

describe("Windows Grok Bot Desktop reader", () => {
  const subject = "auth0|fixture-bot-account", scope = createHash("sha256").update(subject).digest("hex");
  const jwt = `${Buffer.from('{"alg":"fixture"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: subject, exp: now / 1000 + 3600 })).toString("base64url")}.synthetic`;
  function botRoot(sealKey = key) {
    const root = join(temp(), "Grok Bot"); mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "Local State"), localState());
    const envelope = (value: string) => `scoped:v1:${scope}:${seal(value, sealKey).toString("base64")}`;
    writeFileSync(join(root, "sand-secrets.json"), JSON.stringify({ version: 1, "cursor-accounts": JSON.stringify({ active: scope, accounts: { [scope]: { "cursor-access-token": envelope(jwt), "cursor-selected-team-id": envelope("42"), "cursor-refresh-token": "SKIP-REFRESH" } } }) }));
    return root;
  }
  it("unlocks the Local State key instead of the Keychain helper and selects the active token and team", async () => {
    const command = vi.fn<Command>(async () => { throw new Error("no helper on Windows"); });
    const credential = await readGrokBotCredential("/unused", "/fixture/helper", command, now, true, new AbortController().signal, () => {}, { root: botRoot(), unprotect: fakeUnprotect });
    expect(credential).toMatchObject({ token: jwt, team: "42" }); expect(command).not.toHaveBeenCalled();
  });
  it("reports key and decryption failures at their own stages", async () => {
    const read = (root: string, unprotect: Unprotect) => readGrokBotCredential("/unused", "/fixture/helper", vi.fn(), now, true, new AbortController().signal, () => {}, { root, unprotect });
    await expect(read(botRoot(), async () => { throw new Error("denied"); })).rejects.toMatchObject({ stage: "keychain" });
    await expect(read(botRoot(randomBytes(32)), fakeUnprotect)).rejects.toSatisfy(error => error instanceof GrokBotFailure && error.stage === "decryption");
  });
});

describe("Windows Antigravity Desktop discovery", () => {
  const exe = "C:\\Users\\testuser\\AppData\\Local\\Programs\\Antigravity\\resources\\app\\extensions\\antigravity\\bin\\language_server_windows_x64.exe";
  const answer = (items: unknown[]) => vi.fn<Command>(async () => JSON.stringify(items));
  it("uses one fixed PowerShell query and reads the CSRF token and loopback listeners", async () => {
    const command = answer([{ pid: 4242, executable: exe, commandLine: `"${exe}" --csrf_token synthetic-csrf --extension_server_port 52100 --random_port`, ports: [52100, 52101] }]);
    expect(await discoverAntigravity(command, undefined, "win32", { SystemRoot: "C:\\Windows" })).toEqual({ pid: 4242, executable: exe, csrf: "synthetic-csrf", extensionPort: 52100, extensionCSRF: undefined, ports: [52100, 52101] });
    expect(command.mock.calls[0][0]).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"); expect(command.mock.calls[0][1].at(-1)).toBe(windowsDiscoveryScript);
    expect(windowsDiscoveryScript).not.toContain('"');
  });
  it.each([
    ["no server", []],
    ["two servers", [{ pid: 1, executable: exe, commandLine: `"${exe}" --csrf_token a`, ports: [1] }, { pid: 2, executable: exe, commandLine: `"${exe}" --csrf_token b`, ports: [2] }]],
    ["another program", [{ pid: 1, executable: "C:\\Tools\\language_server.exe", commandLine: "C:\\Tools\\language_server.exe --csrf_token a", ports: [1] }]],
    ["a command line for another executable", [{ pid: 1, executable: exe, commandLine: "C:\\Other\\x.exe --csrf_token a", ports: [1] }]],
    ["a missing token", [{ pid: 1, executable: exe, commandLine: `"${exe}" --other`, ports: [1] }]],
    ["no listener", [{ pid: 1, executable: exe, commandLine: `"${exe}" --csrf_token a`, ports: [] }]],
  ])("refuses %s", async (_name, items) => {
    await expect(discoverAntigravity(answer(items), undefined, "win32")).rejects.toThrow();
  });
});
