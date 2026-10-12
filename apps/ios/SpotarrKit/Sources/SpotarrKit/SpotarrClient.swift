import Connect
import Foundation

/// Calls Spotarr's API with the settings: its token, and the custom headers.
public struct SpotarrClient: Sendable {
  private let client: Spotarr_V1_SpotarrServiceClient
  private let headers: Headers

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
    case .unavailable, .deadlineExceeded, .canceled: self = .unreachable
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
