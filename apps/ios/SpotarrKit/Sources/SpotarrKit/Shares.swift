import Foundation

// Shorter names for the contract's messages the app shows.
public typealias Share = Spotarr_V1_Share
public typealias Candidate = Spotarr_V1_Candidate
public typealias Frame = Spotarr_V1_Frame
public typealias Summary = Spotarr_V1_Summary
public typealias HistoryPage = Spotarr_V1_ListSharesResponse

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

  /// As the history shows it, e.g. "Already present".
  public var label: String {
    switch self {
    case .inProgress: "In progress"
    case .toChoose: "To choose"
    case .added: "Added"
    case .requested: "Requested"
    case .alreadyPresent: "Already present"
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

extension Spotarr_V1_Share {
  public var isInProgress: Bool { summary == .inProgress }

  /// The last Addition of the Candidate decides first, then its Library state,
  /// as in the web UI.
  public func state(of candidate: Candidate) -> CandidateState {
    let addition = additions.last { $0.tmdbID == candidate.tmdbID && $0.type == candidate.type }
    if let addition, addition.status == .requested {
      return .requested(automatic: addition.automatic)
    }
    if addition?.status == .added { return .added }
    if addition?.status == .alreadyPresent { return .alreadyPresent }
    if candidate.libraryState == .available || candidate.libraryState == .partial {
      return .alreadyPresent
    }
    if candidate.libraryState == .requested { return .requested(automatic: false) }
    if let addition, addition.status == .failed, addition.hasError {
      return .canAdd(failure: addition.error)
    }
    return .canAdd(failure: nil)
  }

  /// Why a failed Share failed: its last Addition's error, else the Identification's.
  public var failureReason: String? {
    if summary != .failed { return nil }
    if let addition = additions.last, addition.hasError { return addition.error }
    if identification.hasError { return identification.error }
    return nil
  }

  /// "2/3" when several Candidates were found and some were added: how many
  /// are in the library or on their way.
  public var additionProgress: String? {
    if candidates.count < 2 || additions.isEmpty { return nil }
    let succeeded = additions.filter {
      [.added, .requested, .alreadyPresent].contains($0.status)
    }.count
    return "\(succeeded)/\(candidates.count)"
  }
}
