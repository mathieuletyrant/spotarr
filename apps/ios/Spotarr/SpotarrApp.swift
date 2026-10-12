import SwiftUI

// The host app: only the settings the share extension needs. Shares are
// followed and chosen in Spotarr's web UI.
@main
struct SpotarrApp: App {
  var body: some Scene {
    WindowGroup {
      NavigationStack { SettingsView() }
    }
  }
}
