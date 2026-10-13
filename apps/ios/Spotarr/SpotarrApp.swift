import SpotarrKit
import SwiftUI

// The host app: the history and each Share's page, where Candidates are added,
// and the settings the share extension needs. The tab bar and the search
// button are iOS 26's Liquid Glass.
@main
struct SpotarrApp: App {
  var body: some Scene {
    WindowGroup { RootView() }
  }
}

enum AppTab: Hashable {
  case history, settings, search
}

struct RootView: View {
  // Settings first until Spotarr's address and token are set.
  @State private var tab: AppTab = SettingsStore.load().isComplete ? .history : .settings
  @State private var query = ""

  var body: some View {
    TabView(selection: $tab) {
      Tab("History", systemImage: "clock.arrow.circlepath", value: AppTab.history) {
        NavigationStack {
          HistoryView(query: nil) { tab = .settings }
        }
      }
      Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
        NavigationStack { SettingsView() }
      }
      Tab(value: AppTab.search, role: .search) {
        NavigationStack {
          HistoryView(query: query) { tab = .settings }
        }
      }
    }
    .searchable(text: $query, prompt: "Title or source")
    .tabBarMinimizeBehavior(.onScrollDown)
  }
}
