import SpotarrKit
import SwiftUI
import UniformTypeIdentifiers

// What the share sheet shows: sending, then "Sent to Spotarr" (closing on its
// own), or why it failed with Retry.
struct ShareView: View {
  let providers: [NSItemProvider]
  let close: () -> Void

  @State private var state: SendState = .sending

  enum SendState: Equatable {
    case sending
    case sent(String)
    case failed(String)
  }

  var body: some View {
    VStack(spacing: 16) {
      switch state {
      case .sending:
        ProgressView().controlSize(.large)
        Text("Sending to Spotarr…").font(.headline)
      case .sent(let host):
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 48))
          .foregroundStyle(.green)
        Text("Sent to Spotarr").font(.headline)
        Text(host).font(.subheadline).foregroundStyle(.secondary)
      case .failed(let message):
        Image(systemName: "exclamationmark.triangle.fill")
          .font(.system(size: 44))
          .foregroundStyle(.orange)
        Text("Not sent").font(.headline)
        Text(message)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
        HStack {
          Button("Close", action: close).buttonStyle(.bordered)
          Button("Retry") { Task { await send() } }.buttonStyle(.borderedProminent)
        }
      }
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .task { await send() }
  }

  private func send() async {
    state = .sending
    guard let client = SpotarrClient(settings: SettingsStore.load()) else {
      state = .failed("Open the Spotarr app first, to set its address and token.")
      return
    }
    guard let link = await sharedLink() else {
      state = .failed("There is no link in what was shared.")
      return
    }
    do {
      try await client.share(link: link)
      state = .sent(link.host() ?? link.absoluteString)
      try? await Task.sleep(for: .seconds(1.2))
      close()
    } catch {
      state = .failed(error.message)
    }
  }

  // Instagram shares a URL; some apps share a text holding one.
  private func sharedLink() async -> URL? {
    for provider in providers {
      if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
        let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
        url.scheme?.hasPrefix("http") == true
      {
        return url
      }
      if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
        let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier)
          as? String,
        let url = firstLink(in: text)
      {
        return url
      }
    }
    return nil
  }
}
