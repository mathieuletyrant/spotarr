import Connect
import Foundation
import Testing

@testable import SpotarrKit

@Test func theAddressGetsAScheme() {
  var settings = Settings()
  settings.address = " umbrel.local:3838/ "
  #expect(settings.baseURL?.absoluteString == "http://umbrel.local:3838")
  settings.address = "https://spotarr.example.com"
  #expect(settings.baseURL?.absoluteString == "https://spotarr.example.com")
  settings.address = ""
  #expect(settings.baseURL == nil)
}

@Test func settingsNeedAnAddressAndAToken() {
  var settings = Settings()
  settings.address = "umbrel.local:3838"
  #expect(!settings.isComplete)
  settings.apiToken = "token"
  #expect(settings.isComplete)
}

@Test func customHeadersGoWithTheToken() {
  var settings = Settings()
  settings.apiToken = " token "
  settings.customHeaders = [
    CustomHeader(name: "CF-Access-Client-Id", value: " id.access "),
    CustomHeader(name: "CF-Access-Client-Secret", value: "secret"),
    CustomHeader(name: "  ", value: "a row left empty is skipped"),
    CustomHeader(name: "Authorization", value: "cannot replace the token"),
  ]
  #expect(
    SpotarrClient.headers(for: settings) == [
      "Authorization": ["Bearer token"],
      "CF-Access-Client-Id": ["id.access"],
      "CF-Access-Client-Secret": ["secret"],
    ])
}

@Test func theLinkIsFoundInAText() {
  #expect(
    firstLink(in: "Regarde ça 🎬 https://www.instagram.com/reel/DeM363OouRS/?igsh=x")?.host()
      == "www.instagram.com")
  #expect(firstLink(in: "pas de lien") == nil)
}

@Test func errorsAreSaidForAPerson() {
  #expect(SendError(ConnectError(code: .unauthenticated, message: nil)) == .tokenRefused)
  #expect(SendError(ConnectError(code: .permissionDenied, message: nil)) == .accessRefused)
  // No answer at all: the network or the address.
  #expect(SendError(ConnectError(code: .unavailable, message: nil)) == .unreachable)
  // Spotarr answered: a service behind it failed, and the message says which.
  let answered = ConnectError(
    code: .unavailable, message: "TMDB answered 401", metadata: ["content-type": ["application/json"]])
  #expect(SendError(answered) == .spotarr("TMDB answered 401"))
  #expect(
    SendError(ConnectError(code: .invalidArgument, message: "url: only http and https links"))
      == .spotarr("url: only http and https links"))
}

// Against a real Spotarr, only when asked:
//   SPOTARR_TEST_URL=http://localhost:3100 SPOTARR_TEST_TOKEN=… swift test
@Test(.enabled(if: ProcessInfo.processInfo.environment["SPOTARR_TEST_URL"] != nil))
func talksToARealSpotarr() async throws {
  let environment = ProcessInfo.processInfo.environment
  var settings = Settings()
  settings.address = environment["SPOTARR_TEST_URL"] ?? ""
  settings.apiToken = environment["SPOTARR_TEST_TOKEN"] ?? ""
  let client = try #require(SpotarrClient(settings: settings))

  #expect(try await client.version().isEmpty == false)
  try await client.share(link: URL(string: "https://www.instagram.com/reel/DeM363OouRS/")!)

  settings.apiToken = "wrong"
  await #expect(throws: SendError.tokenRefused) {
    try await SpotarrClient(settings: settings)?.version()
  }
}
