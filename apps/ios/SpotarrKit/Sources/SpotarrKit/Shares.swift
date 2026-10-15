import Foundation

// Shorter names for the contract's messages the app shows.
public typealias Share = Spotarr_V1_Share
public typealias Candidate = Spotarr_V1_Candidate
public typealias Frame = Spotarr_V1_Frame
public typealias Summary = Spotarr_V1_Summary
public typealias HistoryPage = Spotarr_V1_ListSharesResponse
public typealias GenreCount = Spotarr_V1_GenreCount

extension Spotarr_V1_Share: Identifiable {}

extension Spotarr_V1_Candidate: Identifiable {
  /// A TMDB id names a movie and a TV show alike: the type tells them apart.
  public var id: String { "\(type.rawValue)-\(tmdbID)" }
}

extension Spotarr_V1_Frame: Identifiable {
  public var id: String { url }
}

extension Spotarr_V1_Summary {
  /// The history's filters, in the web UI's order.
  public static let filters: [Summary] = [
    .inProgress, .added, .requested, .alreadyPresent, .toChoose, .noMatch, .failed,
  ]

  /// As the history shows it, e.g. "Available".
  public var label: String {
    switch self {
    case .inProgress: "In progress"
    case .toChoose: "To choose"
    case .added: "Added"
    case .requested: "Requested"
    case .alreadyPresent: "Available"
    case .noMatch: "No match"
    case .failed: "Failed"
    case .unspecified, .UNRECOGNIZED: ""
    }
  }
}

/// What can be done with a Candidate: add it, or nothing, since it is on its way or there.
public enum CandidateState: Equatable, Sendable {
  /// `failure` is why the last attempt failed, if one did.
  case canAdd(failure: String?)
  case requested(automatic: Bool)
  case added
  case alreadyPresent
}

extension Spotarr_V1_Candidate {
  /// Where the Candidate stands, as the server derived it.
  public var state: CandidateState {
    switch status {
    case .requested: .requested(automatic: automatic)
    case .added: .added
    case .alreadyPresent: .alreadyPresent
    default: .canAdd(failure: hasFailure ? failure : nil)
    }
  }
}

extension Spotarr_V1_Share {
  public var isInProgress: Bool { summary == .inProgress }

  /// "2/3" when several Candidates were found and some were added: how many
  /// are in the library or on their way.
  public var additionProgress: String? {
    if candidates.count < 2 || additions.isEmpty { return nil }
    return "\(addedCount)/\(candidates.count)"
  }
}
