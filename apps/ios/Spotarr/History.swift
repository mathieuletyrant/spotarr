import Foundation
import Observation
import SpotarrKit

/// What the history shows: one Summary (all when nil), the Shares of any of
/// some genres (all when empty), and a text to match.
struct HistoryFilter: Equatable {
  var summary: Summary?
  var genres: [String] = []
  var query = ""
}

// The history as the list shows it: the pages loaded so far, the counts of the
// filter menu, and why the last call failed.
@MainActor @Observable
final class History {
  private(set) var shares: [Share] = []
  private(set) var total = 0
  private(set) var counts: [Summary: Int] = [:]
  /// Every genre of the history with its count, for the genre filter.
  private(set) var genres: [GenreCount] = []
  private(set) var nextCursor: String?
  private(set) var error: String?
  private(set) var notConfigured = false
  /// True once the first page arrived, or failed to.
  private(set) var loaded = false

  // What the shares were loaded with: another filter or new settings load them again.
  private var loadedFilter: HistoryFilter?
  private var loadedSettings: SpotarrKit.Settings?
  private var loadingMore = false

  var hasInProgress: Bool { shares.contains { $0.isInProgress } }

  /// The first page. Skipped when neither the filter nor the settings changed
  /// since the last load, unless forced (pull to refresh).
  func load(_ filter: HistoryFilter, force: Bool = false) async {
    let settings = SettingsStore.load()
    if !force && filter == loadedFilter && settings == loadedSettings { return }
    guard let client = SpotarrClient(settings: settings) else {
      notConfigured = true
      shares = []
      loadedFilter = nil
      loadedSettings = nil
      return
    }
    notConfigured = false
    do {
      let page = try await client.listShares(
        summary: filter.summary, genres: filter.genres, query: filter.query, cursor: nil)
      // A newer filter took over while this page was on its way.
      if Task.isCancelled { return }
      shares = page.shares
      nextCursor = page.hasNextCursor ? page.nextCursor : nil
      total = Int(page.total)
      counts = [:]
      for count in page.counts { counts[count.summary] = Int(count.count) }
      genres = page.genres
      loadedFilter = filter
      loadedSettings = settings
      error = nil
    } catch {
      if Task.isCancelled { return }
      self.error = error.message
    }
    loaded = true
  }

  /// The next page, when the list reaches its last row.
  func loadMore() async {
    guard let cursor = nextCursor, let filter = loadedFilter, !loadingMore,
      let client = SpotarrClient(settings: SettingsStore.load())
    else { return }
    loadingMore = true
    defer { loadingMore = false }
    do {
      let page = try await client.listShares(
        summary: filter.summary, genres: filter.genres, query: filter.query, cursor: cursor)
      shares += page.shares
      nextCursor = page.hasNextCursor ? page.nextCursor : nil
    } catch {
      self.error = error.message
    }
  }

  /// Asks again for the Shares being identified, and puts each one back in place.
  func refreshInProgress() async {
    guard let client = SpotarrClient(settings: SettingsStore.load()) else { return }
    for share in shares where share.isInProgress {
      if let fresh = try? await client.getShare(id: share.id) { replace(fresh) }
    }
  }

  /// Deletes a Share in Spotarr, then takes its row and its count out.
  func delete(_ share: Share) async {
    guard let client = SpotarrClient(settings: SettingsStore.load()) else { return }
    do {
      try await client.deleteShare(id: share.id)
      shares.removeAll { $0.id == share.id }
      total -= 1
      if let count = counts[share.summary] { counts[share.summary] = count - 1 }
      error = nil
    } catch {
      self.error = error.message
    }
  }

  /// A Share changed on its page (added, retried): the row follows.
  func replace(_ share: Share) {
    if let index = shares.firstIndex(where: { $0.id == share.id }) {
      shares[index] = share
    }
  }
}
