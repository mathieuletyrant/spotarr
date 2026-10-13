import SpotarrKit
import SwiftUI
import UIKit

extension Spotarr_V1_Summary {
  /// The badge's color, close to the web UI's status tokens.
  var color: Color {
    switch self {
    case .inProgress, .toChoose: .orange
    case .added: .blue
    case .requested: .purple
    case .alreadyPresent, .noMatch: .gray
    case .failed: .red
    case .unspecified, .UNRECOGNIZED: .secondary
    }
  }
}

// A colored pill with the Summary's name, e.g. "Requested 1/3".
struct StatusBadge: View {
  let summary: Summary
  var detail: String? = nil

  var body: some View {
    HStack(spacing: 4) {
      if summary == .inProgress {
        ProgressView().controlSize(.mini)
      }
      Text(summary.label)
      if let detail {
        Text(detail).opacity(0.75)
      }
    }
    .font(.caption.weight(.medium))
    .foregroundStyle(summary.color)
    .padding(.horizontal, 8)
    .padding(.vertical, 3)
    .background(summary.color.opacity(0.12), in: .capsule)
  }
}

// A TMDB poster, 2:3; a dashed frame when there is none yet.
struct Poster: View {
  let candidate: Candidate?
  var width: CGFloat = 56

  var body: some View {
    Group {
      if let candidate, candidate.hasPosterURL {
        AsyncImage(url: URL(string: candidate.posterURL)) { image in
          image.resizable().scaledToFill()
        } placeholder: {
          Rectangle().fill(.quaternary)
        }
      } else {
        RoundedRectangle(cornerRadius: 6)
          .strokeBorder(.tertiary, style: StrokeStyle(lineWidth: 1, dash: [4]))
      }
    }
    .frame(width: width, height: width * 1.5)
    .clipShape(.rect(cornerRadius: 6))
    .accessibilityHidden(true)
  }
}

// "TMDB 7.8 · 1,234 votes"; nothing when nobody rated the title.
struct TmdbRating: View {
  let candidate: Candidate
  var compact = false

  var body: some View {
    if candidate.hasTmdbRating {
      HStack(spacing: 4) {
        Text("TMDB").font(.caption2.weight(.bold)).foregroundStyle(.teal)
        Text(Double(candidate.tmdbRating), format: .number.precision(.fractionLength(1)))
          .fontWeight(.medium)
        if !compact && candidate.hasTmdbVotes {
          Text("· \(candidate.tmdbVotes.formatted()) votes").foregroundStyle(.secondary)
        }
      }
      .font(.subheadline)
    }
  }
}

// A thumbnail of the shared video and its time. Loaded with the token, which
// AsyncImage cannot send.
struct FrameImage: View {
  let frame: Frame
  @State private var image: UIImage?

  var body: some View {
    ZStack(alignment: .bottomLeading) {
      if let image {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        Rectangle().fill(.quaternary)
      }
      Text(videoTime(frame.atSeconds))
        .font(.caption2.monospacedDigit())
        .padding(.horizontal, 4)
        .background(.ultraThinMaterial, in: .rect(cornerRadius: 4))
        .padding(4)
    }
    .frame(width: 90, height: 160)
    .clipShape(.rect(cornerRadius: 8))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Frame at \(videoTime(frame.atSeconds))")
    .task { await load() }
  }

  private func load() async {
    guard image == nil, let client = SpotarrClient(settings: SettingsStore.load()) else { return }
    if let data = try? await client.frameImage(frame) {
      image = UIImage(data: data)
    }
  }
}

// "Today 14:40", "Yesterday 09:12" or "Oct 10 14:40", as in the web UI.
func shareDate(_ share: Share) -> String {
  let date = share.createdAt.date
  let time = date.formatted(date: .omitted, time: .shortened)
  if Calendar.current.isDateInToday(date) { return "Today \(time)" }
  if Calendar.current.isDateInYesterday(date) { return "Yesterday \(time)" }
  return "\(date.formatted(.dateTime.month(.abbreviated).day())) \(time)"
}

// 65.4 s → "1:05", the way a video player shows a time.
func videoTime(_ seconds: Float) -> String {
  let total = Int(seconds)
  return "\(total / 60):\(String(format: "%02d", total % 60))"
}

// 14 479 ms → "14 s".
func duration(_ milliseconds: Int32) -> String {
  "\(max(1, Int((Double(milliseconds) / 1000).rounded()))) s"
}
