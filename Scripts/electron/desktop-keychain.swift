import Foundation
import LocalAuthentication
import Security

// Only fixed provider items may be accessed. Background polling cannot open an auth dialog.
let modes = CommandLine.arguments.dropFirst().filter { $0 != "--allow-ui" && $0 != "--save" }
guard modes.count <= 1, modes.allSatisfy({ ["--grok-bot", "--api-openai", "--api-anthropic"].contains($0) }),
      CommandLine.arguments.dropFirst().filter({ $0 == "--allow-ui" }).count <= 1 else { exit(1) }
let save = CommandLine.arguments.contains("--save")
guard CommandLine.arguments.dropFirst().filter({ $0 == "--save" }).count <= 1,
      !save || (modes.first?.hasPrefix("--api-") == true && CommandLine.arguments.contains("--allow-ui")) else { exit(1) }
let context = LAContext()
context.interactionNotAllowed = !CommandLine.arguments.contains("--allow-ui")
SecKeychainSetUserInteractionAllowed(!context.interactionNotAllowed)
let grok = CommandLine.arguments.contains("--grok-bot")
let api = modes.first?.hasPrefix("--api-") == true
var query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: api ? "com.meterusage.api-keys" : grok ? "Grok Bot Safe Storage" : "Claude Safe Storage",
    kSecAttrAccount as String: api ? modes.first == "--api-openai" ? "openAI" : "anthropic" : grok ? "Grok Bot Key" : "Claude Key",
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecUseAuthenticationContext as String: context
]
if api { query[kSecAttrSynchronizable as String] = false }
if save {
    let password = FileHandle.standardInput.readData(ofLength: 8193)
    guard !password.isEmpty, password.count <= 8192,
          let key = String(data: password, encoding: .utf8),
          !key.unicodeScalars.contains(where: { CharacterSet.whitespacesAndNewlines.contains($0) || CharacterSet.controlCharacters.contains($0) }) else { exit(1) }
    query.removeValue(forKey: kSecReturnData as String)
    query.removeValue(forKey: kSecMatchLimit as String)
    let attributes: [String: Any] = [kSecValueData as String: password]
    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
        query[kSecValueData as String] = password
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { exit(1) }
    } else if status != errSecSuccess { exit(1) }
    exit(0)
}
var result: CFTypeRef?
let status = SecItemCopyMatching(query as CFDictionary, &result)
if api && status == errSecItemNotFound { exit(0) }
// Distinct exit for a background read that would need an access prompt ("Allow" was chosen, not "Always Allow").
if context.interactionNotAllowed && status == errSecInteractionNotAllowed { exit(2) }
guard status == errSecSuccess,
      let password = result as? Data, !password.isEmpty else { exit(1) }
// Only the owning main process receives stdout. Never run this helper for QA.
FileHandle.standardOutput.write(password)
