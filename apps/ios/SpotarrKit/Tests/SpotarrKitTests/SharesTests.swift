import Testing

@testable import SpotarrKit

private func candidate(_ tmdbID: Int32, _ state: Spotarr_V1_LibraryState = .absent) -> Candidate {
  var candidate = Candidate()
  candidate.tmdbID = tmdbID
  candidate.type = .movie
  candidate.libraryState = state
  return candidate
}

private func addition(_ tmdbID: Int32, _ status: Spotarr_V1_AdditionStatus, error: String? = nil)
  -> Spotarr_V1_Addition
{
  var addition = Spotarr_V1_Addition()
  addition.tmdbID = tmdbID
  addition.type = .movie
  addition.status = status
  if let error { addition.error = error }
  return addition
}

@Test func aCandidateCanBeAddedUntilItIsOnItsWay() {
  var share = Share()
  share.candidates = [candidate(1), candidate(2, .available), candidate(3, .requested)]
  #expect(share.state(of: share.candidates[0]) == .canAdd(failure: nil))
  #expect(share.state(of: share.candidates[1]) == .alreadyPresent)
  #expect(share.state(of: share.candidates[2]) == .requested(automatic: false))

  share.additions = [addition(1, .failed, error: "Seerr answered 500")]
  #expect(share.state(of: share.candidates[0]) == .canAdd(failure: "Seerr answered 500"))
  share.additions.append(addition(1, .requested))
  #expect(share.state(of: share.candidates[0]) == .requested(automatic: false))
}

@Test func aTvShowIsNotTheMovieWithTheSameTmdbID() {
  var share = Share()
  var show = candidate(1)
  show.type = .tv
  share.candidates = [candidate(1), show]
  share.additions = [addition(1, .requested)]
  #expect(share.state(of: show) == .canAdd(failure: nil))
  #expect(share.candidates[0].id != show.id)
}

@Test func severalCandidatesCountTheirAdditions() {
  var share = Share()
  share.candidates = [candidate(1), candidate(2), candidate(3)]
  #expect(share.additionProgress == nil)
  share.additions = [addition(1, .requested), addition(2, .failed)]
  #expect(share.additionProgress == "1/3")
}

@Test func aFailedShareSaysWhy() {
  var share = Share()
  share.summary = .failed
  share.identification.error = "Instagram sent an empty media response"
  #expect(share.failureReason == "Instagram sent an empty media response")
  share.additions = [addition(1, .failed, error: "Seerr answered 500")]
  #expect(share.failureReason == "Seerr answered 500")
  share.summary = .toChoose
  #expect(share.failureReason == nil)
}
