import SpotarrKit
import SwiftUI

// One Share of the history: the first Candidate's poster, what was found,
// where and when it came from, and the status.
struct HistoryRow: View {
  let share: Share

  var body: some View {
    HStack(spacing: 12) {
      Poster(candidate: share.candidates.first)
      VStack(alignment: .leading, spacing: 4) {
        title.lineLimit(1)
        Text("\(share.source) · \(shareDate(share))")
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(1)
        HStack(spacing: 8) {
          StatusBadge(summary: share.summary, detail: share.additionProgress)
          if share.candidates.count == 1 {
            TmdbRating(candidate: share.candidates[0], compact: true)
          }
        }
        if let reason = share.failureReason {
          Text(reason).font(.caption).foregroundStyle(.red).lineLimit(2)
        }
      }
    }
    .padding(.vertical, 2)
  }

  @ViewBuilder private var title: some View {
    if share.isInProgress {
      Text("Identifying…").foregroundStyle(.secondary)
    } else if let first = share.candidates.first {
      if share.candidates.count > 1 {
        Text("\(Text(first.title).fontWeight(.semibold)) \(Text("+\(share.candidates.count - 1) more").foregroundStyle(.secondary))")
      } else {
        Text("\(Text(first.title).fontWeight(.semibold)) \(Text(first.hasYear ? String(first.year) : "").foregroundStyle(.secondary))")
      }
    } else {
      Text("No candidates").foregroundStyle(.secondary)
    }
  }
}
