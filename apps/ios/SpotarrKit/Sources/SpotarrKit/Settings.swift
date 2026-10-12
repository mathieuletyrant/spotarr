import Foundation
import Security

/// Where Spotarr answers and how to get in, as typed in the app.
public struct Settings: Codable, Equatable, Sendable {
  /// e.g. "http://umbrel.local:3838", or "https://spotarr.example.com" through Cloudflare.
  public var address = ""
  public var apiToken = ""
  /// Sent with every call, e.g. a proxy's credentials: Cloudflare Access wants
  /// CF-Access-Client-Id and CF-Access-Client-Secret.
  public var customHeaders: [CustomHeader] = []

  public init() {}

  public var isComplete: Bool {
    baseURL != nil && !apiToken.trimmingCharacters(in: .whitespaces).isEmpty
  }

  /// The address as a URL: "umbrel.local:3838" gets http://, and no trailing slash.
  public var baseURL: URL? {
    var text = address.trimmingCharacters(in: .whitespaces)
    while text.hasSuffix("/") { text.removeLast() }
    if text.isEmpty { return nil }
    if !text.contains("://") { text = "http://" + text }
    guard let url = URL(string: text), url.host() != nil else { return nil }
    return url
  }
}

/// One header added to every call. `id` only tells rows apart in the list.
public struct CustomHeader: Codable, Equatable, Identifiable, Sendable {
  public var id = UUID()
  public var name = ""
  public var value = ""

  public init(name: String = "", value: String = "") {
    self.name = name
    self.value = value
  }
}

/// The settings, saved as one keychain item. The app and its share extension
/// list the same keychain group first in their entitlements: new items go to
/// that group, so both see them.
public enum SettingsStore {
  /// Which keychain item: built at each call (a shared [String: Any] is not Sendable).
  private static var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "com.mathieuletyrant.spotarr",
      kSecAttrAccount as String: "settings",
    ]
  }

  /// The saved settings, or empty ones before the first save.
  public static func load() -> Settings {
    var search = query
    search[kSecReturnData as String] = true
    var found: AnyObject?
    guard SecItemCopyMatching(search as CFDictionary, &found) == errSecSuccess,
      let data = found as? Data,
      let settings = try? JSONDecoder().decode(Settings.self, from: data)
    else { return Settings() }
    return settings
  }

  public static func save(_ settings: Settings) {
    let data = (try? JSONEncoder().encode(settings)) ?? Data()
    let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if updated == errSecItemNotFound {
      var item = query
      item[kSecValueData as String] = data
      // Readable by the extension once the iPhone has been unlocked after a restart.
      item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      SecItemAdd(item as CFDictionary, nil)
    }
  }
}
