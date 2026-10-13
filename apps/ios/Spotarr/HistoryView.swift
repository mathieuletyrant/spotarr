import SpotarrKit
import SwiftUI

// The history, newest first: a filter by status in the toolbar, pull to
// refresh, swipe to delete, the next page at the bottom. The search tab shows the same list
// for its text.
struct HistoryView: View {
  /// Nil in the History tab; the search tab's text otherwise.
  let query: String?
  let openSettings: @MainActor () -> Void

  @State private var history = History()
  @State private var summary: Summary?
  @State private var genre: String?
  /// The Share whose deletion waits for a confirmation.
  @State private var toDelete: Share?
  @Environment(\.scenePhase) private var scenePhase

  private var filter: HistoryFilter {
    HistoryFilter(summary: summary, genre: genre, query: query ?? "")
  }

  var body: some View {
    content
      .navigationTitle(query == nil ? "History" : "Search")
      .navigationDestination(for: Share.self) { share in
        ShareDetailView(shareID: share.id) { history.replace($0) }
      }
      .toolbar {
        if query == nil {
          ToolbarItem(placement: .topBarTrailing) { filterMenu }
        }
      }
      .refreshable { await history.load(filter, force: true) }
      .task(id: filter) {
        // Wait for the typing to pause before searching.
        if !filter.query.isEmpty {
          try? await Task.sleep(for: .milliseconds(300))
          if Task.isCancelled { return }
        }
        await history.load(filter)
      }
      // While a Share is identified, its row follows on its own.
      .task(id: history.hasInProgress) {
        while history.hasInProgress && !Task.isCancelled {
          try? await Task.sleep(for: .seconds(3))
          await history.refreshInProgress()
        }
      }
      // Back from Instagram after a share: the new one shows up.
      .onChange(of: scenePhase) {
        if scenePhase == .active {
          Task { await history.load(filter, force: true) }
        }
      }
  }

  @ViewBuilder private var content: some View {
    if history.notConfigured {
      ContentUnavailableView {
        Label("Connect Spotarr", systemImage: "link")
      } description: {
        Text("Set Spotarr's address and API token to see the history.")
      } actions: {
        Button("Open Settings", action: openSettings).buttonStyle(.glassProminent)
      }
    } else if query?.isEmpty == true {
      ContentUnavailableView(
        "Search the history", systemImage: "magnifyingglass",
        description: Text("By title, source or link."))
    } else if !history.loaded {
      ProgressView()
    } else if history.shares.isEmpty, let error = history.error {
      ContentUnavailableView {
        Label("Can't load the history", systemImage: "exclamationmark.triangle")
      } description: {
        Text(error)
      } actions: {
        Button("Try again") { Task { await history.load(filter, force: true) } }
          .buttonStyle(.glass)
      }
    } else if history.shares.isEmpty {
      emptyHistory
    } else {
      list
    }
  }

  private var list: some View {
    List {
      ForEach(history.shares) { share in
        NavigationLink(value: share) { HistoryRow(share: share) }
          // Spotarr refuses while the Identification runs.
          .swipeActions {
            if share.identification.status != .processing {
              Button("Delete", systemImage: "trash") { toDelete = share }.tint(.red)
            }
          }
          .onAppear {
            if share.id == history.shares.last?.id {
              Task { await history.loadMore() }
            }
          }
      }
      if history.nextCursor != nil {
        ProgressView().frame(maxWidth: .infinity)
      }
      if let error = history.error {
        Text(error).font(.footnote).foregroundStyle(.red)
      }
    }
    .listStyle(.plain)
    .confirmationDialog(
      "Delete this Share?",
      isPresented: Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } }),
      titleVisibility: .visible,
      presenting: toDelete
    ) { share in
      Button("Delete", role: .destructive) { Task { await history.delete(share) } }
    } message: { _ in
      Text("It leaves Spotarr's history and stats. What was already requested in Seerr stays there.")
    }
  }

  @ViewBuilder private var emptyHistory: some View {
    if query != nil {
      ContentUnavailableView.search(text: filter.query)
    } else if summary != nil || genre != nil {
      ContentUnavailableView(
        "Nothing here", systemImage: "line.3.horizontal.decrease",
        description: Text("No Share matches these filters."))
    } else {
      ContentUnavailableView(
        "No shares yet", systemImage: "square.and.arrow.up",
        description: Text("Share a reel to Spotarr from Instagram, TikTok or YouTube."))
    }
  }

  // The statuses with their counts (one with no Share is hidden unless chosen),
  // then the genres of the history.
  private var filterMenu: some View {
    Menu {
      Picker("Status", selection: $summary) {
        Text("All (\(history.total))").tag(Summary?.none)
        ForEach(shownFilters, id: \.self) { summary in
          Text("\(summary.label) (\(history.counts[summary] ?? 0))").tag(Summary?.some(summary))
        }
      }
      if !history.genres.isEmpty {
        Picker("Genre", selection: $genre) {
          Text("All genres").tag(String?.none)
          ForEach(history.genres, id: \.self) { genre in
            Text(genre).tag(String?.some(genre))
          }
        }
        .pickerStyle(.menu)
      }
    } label: {
      Label(
        "Filter",
        systemImage: summary == nil && genre == nil
          ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
    }
  }

  private var shownFilters: [Summary] {
    Summary.filters.filter { (history.counts[$0] ?? 0) > 0 || $0 == summary }
  }
}
