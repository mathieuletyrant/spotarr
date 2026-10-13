import Connect
import Foundation

/// Calls Spotarr's API with the settings: its token, and the custom headers.
public struct SpotarrClient: Sendable {
  private let client: Spotarr_V1_SpotarrServiceClient
  private let headers: Headers
  private let base: URL

  /// Nil while the settings miss the address or the token.
  public init?(settings: Settings) {
    guard settings.isComplete, let base = settings.baseURL else { return nil }
    // Spotarr serves Connect under /api.
    let protocolClient = ProtocolClient(
      httpClient: URLSessionHTTPClient(),
      config: ProtocolClientConfig(
        host: base.appending(path: "api").absoluteString,
        networkProtocol: .connect,
        codec: JSONCodec(),
        timeout: 20
      )
    )
    client = Spotarr_V1_SpotarrServiceClient(client: protocolClient)
    headers = Self.headers(for: settings)
    self.base = base
  }

  /// The token, then every custom header that has a name. The token's
  /// Authorization cannot be replaced by a custom header.
  static func headers(for settings: Settings) -> Headers {
    var headers: Headers = [:]
    for header in settings.customHeaders {
      let name = header.name.trimmingCharacters(in: .whitespaces)
      if !name.isEmpty { headers[name] = [header.value.trimmingCharacters(in: .whitespaces)] }
    }
    headers["Authorization"] = ["Bearer \(settings.apiToken.trimmingCharacters(in: .whitespaces))"]
    return headers
  }

  /// Sends a shared link; Spotarr identifies it in the background.
  public func share(link: URL) async throws(SendError) {
    var request = Spotarr_V1_CreateShareRequest()
    request.url = link.absoluteString
    let response = await client.createShare(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
  }

  /// Spotarr's version: proves the address, the token and Cloudflare are right.
  public func version() async throws(SendError) -> String {
    let response = await client.getStatus(request: .init(), headers: headers)
    if let error = response.error { throw SendError(error) }
    return response.message?.version ?? ""
  }

  /// One page of the history, newest first: only `summary` when given, and only
  /// the Shares matching `query` when it is not empty. `cursor` is the previous
  /// page's `nextCursor`.
  public func listShares(summary: Summary?, query: String, cursor: String?)
    async throws(SendError) -> HistoryPage
  {
    var request = Spotarr_V1_ListSharesRequest()
    request.pageSize = 30
    if let summary { request.summaries = [summary] }
    let query = query.trimmingCharacters(in: .whitespaces)
    if !query.isEmpty { request.query = query }
    if let cursor { request.cursor = cursor }
    let response = await client.listShares(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
    return response.message ?? HistoryPage()
  }

  public func getShare(id: String) async throws(SendError) -> Share {
    var request = Spotarr_V1_GetShareRequest()
    request.id = id
    let response = await client.getShare(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
    return response.message?.share ?? Share()
  }

  /// Queues the Identification again; the Share comes back in progress.
  public func retryIdentification(id: String) async throws(SendError) -> Share {
    var request = Spotarr_V1_RetryIdentificationRequest()
    request.id = id
    let response = await client.retryIdentification(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
    return response.message?.share ?? Share()
  }

  /// Asks Seerr for the Candidate. The Share comes back with the new Addition,
  /// which may have failed: its status and error say so.
  public func add(_ candidate: Candidate, from shareID: String) async throws(SendError) -> Share {
    var request = Spotarr_V1_AddRequest()
    request.shareID = shareID
    request.tmdbID = candidate.tmdbID
    request.type = candidate.type
    let response = await client.add(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
    return response.message?.share ?? Share()
  }

  /// Deletes the Share from Spotarr; what was requested in Seerr stays there.
  /// Spotarr refuses while its Identification runs.
  public func deleteShare(id: String) async throws(SendError) {
    var request = Spotarr_V1_DeleteShareRequest()
    request.id = id
    let response = await client.deleteShare(request: request, headers: headers)
    if let error = response.error { throw SendError(error) }
  }

  /// A thumbnail of the shared video, as JPEG. Not an RPC: a plain GET on
  /// Spotarr's /frames, behind the token like the API.
  public func frameImage(_ frame: Frame) async throws(SendError) -> Data {
    // frame.url is a path on Spotarr's origin: "/frames/<share id>/<n>.jpg".
    let path = String(frame.url.drop { $0 == "/" })
    var request = URLRequest(url: base.appending(path: path), timeoutInterval: 20)
    for (name, values) in headers {
      request.setValue(values.joined(separator: ","), forHTTPHeaderField: name)
    }
    let data: Data
    let answer: URLResponse
    do {
      (data, answer) = try await URLSession.shared.data(for: request)
    } catch {
      throw SendError.unreachable
    }
    let status = (answer as? HTTPURLResponse)?.statusCode ?? 0
    if status == 401 { throw SendError.tokenRefused }
    if status == 403 { throw SendError.accessRefused }
    if status != 200 { throw SendError.spotarr("Spotarr answered \(status) for a frame.") }
    return data
  }
}

/// Why a call failed, said for a person.
public enum SendError: Error, Equatable {
  case unreachable
  case tokenRefused
  case accessRefused
  case spotarr(String)

  init(_ error: ConnectError) {
    switch error.code {
    case .unauthenticated: self = .tokenRefused
    // A proxy in front (Cloudflare Access…) answers 403 when its headers are missing or wrong.
    case .permissionDenied: self = .accessRefused
    case .unavailable, .deadlineExceeded, .canceled:
      // No answer at all (no headers): the address or the network is wrong. Spotarr
      // itself answers these codes when TMDB, the LLM or Seerr fail, and says which.
      if error.metadata.isEmpty {
        self = .unreachable
      } else {
        self = .spotarr(error.message ?? "Spotarr answered an error (\(error.code)).")
      }
    default: self = .spotarr(error.message ?? "Spotarr answered an error (\(error.code)).")
    }
  }

  public var message: String {
    switch self {
    case .unreachable: "Spotarr can't be reached. Check the address, and that you are on the right network."
    case .tokenRefused: "Spotarr refused the API token. Copy it again from Spotarr's Settings → Access."
    case .accessRefused: "The call was refused before reaching Spotarr (403). Check the custom headers."
    case .spotarr(let message): message
    }
  }
}
