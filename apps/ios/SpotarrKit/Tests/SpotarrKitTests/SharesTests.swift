import Testing

@testable import SpotarrKit

private func candidate(
  _ tmdbID: Int32, _ status: Spotarr_V1_CandidateStatus = .canAdd
) -> Candidate {
  var candidate = Candidate()
  candidate.tmdbID = tmdbID
  candidate.type = .movie
  candidate.status = status
  return candidate
}

@Test func aCandidateShowsTheStatusTheServerDerived() {
  var auto = candidate(3, .requested)
  auto.automatic = true
  var failed = candidate(4)
  failed.failure = "Seerr answered 500"
  #expect(candidate(1).state == .canAdd(failure: nil))
  #expect(candidate(2, .alreadyPresent).state == .alreadyPresent)
  #expect(candidate(3, .added).state == .added)
  #expect(auto.state == .requested(automatic: true))
  #expect(failed.state == .canAdd(failure: "Seerr answered 500"))
}

@Test func aTvShowIsNotTheMovieWithTheSameTmdbID() {
  var show = candidate(1)
  show.type = .tv
  #expect(candidate(1).id != show.id)
}

@Test func severalCandidatesCountTheirAdditions() {
  var share = Share()
  share.candidates = [candidate(1), candidate(2), candidate(3)]
  #expect(share.additionProgress == nil)
  share.additions = [Spotarr_V1_Addition(), Spotarr_V1_Addition()]
  share.addedCount = 1
  #expect(share.additionProgress == "1/3")
}
