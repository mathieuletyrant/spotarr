import SpotarrKit
import SwiftUI

// One Candidate: poster, titles, TMDB rating, genres, confidence, and Add, or where
// the title stands. Touch and hold to open it on TMDB.
struct CandidateRow: View {
  let candidate: Candidate
  let state: CandidateState
  /// Nil when it worked, else why it failed.
  let add: @MainActor () async -> String?

  @State private var adding = false
  @State private var failure: String?

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Poster(candidate: candidate, width: 64)
      VStack(alignment: .leading, spacing: 4) {
        Text(candidate.title).font(.headline)
        HStack(spacing: 6) {
          if candidate.hasYear {
            Text(String(candidate.year))
          }
          Text(candidate.type == .tv ? "TV show" : "Movie")
            .font(.caption)
            .padding(.horizontal, 5)
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(.tertiary))
        }
        .foregroundStyle(.secondary)
        if candidate.hasOriginalTitle && candidate.originalTitle != candidate.title {
          Text(candidate.originalTitle).font(.subheadline).foregroundStyle(.secondary)
        }
        TmdbRating(candidate: candidate)
        if !candidate.genres.isEmpty {
          Text(candidate.genres.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
        }
        confidence
        action.padding(.top, 4)
      }
    }
    .padding(.vertical, 4)
    .contextMenu {
      Link(destination: tmdbURL) {
        Label("Open on TMDB", systemImage: "safari")
      }
    }
  }

  // A bar and a percentage; a direct IMDb or TMDB link is certain.
  @ViewBuilder private var confidence: some View {
    if candidate.hasConfidence {
      let percent = Int((candidate.confidence * 100).rounded())
      HStack(spacing: 8) {
        ProgressView(value: Double(candidate.confidence)).frame(width: 80)
        Text("Confidence \(percent) %")
      }
      .font(.subheadline)
    } else {
      Text("Certain: direct link").font(.subheadline).foregroundStyle(.secondary)
    }
  }

  @ViewBuilder private var action: some View {
    switch state {
    case .canAdd(let lastFailure):
      let message = failure ?? lastFailure
      Button {
        Task {
          adding = true
          failure = await add()
          adding = false
        }
      } label: {
        if adding {
          ProgressView()
        } else {
          Label(message == nil ? "Add" : "Try again", systemImage: "plus")
        }
      }
      .buttonStyle(.glassProminent)
      .disabled(adding)
      if let message {
        Text(message).font(.caption).foregroundStyle(.red)
      }
    case .requested(let automatic):
      HStack(spacing: 6) {
        StatusBadge(summary: .requested)
        if automatic {
          Text("automatically").font(.caption).foregroundStyle(.secondary)
        }
      }
    case .added:
      StatusBadge(summary: .added)
    case .alreadyPresent:
      StatusBadge(summary: .alreadyPresent)
    }
  }

  // The Candidate's page on TMDB.
  private var tmdbURL: URL {
    let kind = candidate.type == .tv ? "tv" : "movie"
    return URL(string: "https://www.themoviedb.org/\(kind)/\(candidate.tmdbID)")!
  }
}
