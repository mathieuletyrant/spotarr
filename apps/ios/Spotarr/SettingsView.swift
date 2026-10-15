import SpotarrKit
import SwiftUI

// Spotarr's address and token, and headers to add to every call (a proxy's
// credentials, e.g. Cloudflare Access). Saved in the keychain at each change.
struct SettingsView: View {
  @State private var settings = SettingsStore.load()
  @State private var showToken = false
  @State private var check: Check = .idle

  // The usual names, picked from the menu next to a header's name; any other can be typed.
  static let knownHeaders = [
    "CF-Access-Client-Id",
    "CF-Access-Client-Secret",
    "X-Api-Key",
    "Proxy-Authorization",
  ]

  enum Check: Equatable {
    case idle, checking, ok(String), failed(String)
  }

  var body: some View {
    Form {
      Section {
        TextField("http://umbrel.local:3838", text: $settings.address)
          .keyboardType(.URL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        HStack {
          Group {
            if showToken {
              TextField("API token", text: $settings.apiToken)
            } else {
              SecureField("API token", text: $settings.apiToken)
            }
          }
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .font(.body.monospaced())
          Button(showToken ? "Hide" : "Show", systemImage: showToken ? "eye.slash" : "eye") {
            showToken.toggle()
          }
          .labelStyle(.iconOnly)
          .foregroundStyle(.secondary)
        }
      } header: {
        Text("Spotarr")
      } footer: {
        Text("The token is in Spotarr's Settings → Access. On Umbrel, it is the app's default password.")
      }

      Section {
        ForEach($settings.customHeaders) { $header in
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              TextField("Name", text: $header.name)
                .font(.body.monospaced())
              Menu {
                ForEach(Self.knownHeaders, id: \.self) { name in
                  Button(name) { header.name = name }
                }
              } label: {
                Image(systemName: "chevron.up.chevron.down")
              }
              .accessibilityLabel("Choose a header name")
            }
            SecureField("Value", text: $header.value)
          }
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        }
        .onDelete { settings.customHeaders.remove(atOffsets: $0) }
        Button("Add a header", systemImage: "plus") {
          settings.customHeaders.append(CustomHeader())
        }
      } header: {
        Text("Custom headers")
      } footer: {
        Text("Sent with every call, for a proxy in front of Spotarr. Through Cloudflare Access: CF-Access-Client-Id and CF-Access-Client-Secret, from a service token. Swipe left to remove one.")
      }

      Section {
        Button {
          Task { await testConnection() }
        } label: {
          HStack {
            Text("Test the connection")
            Spacer()
            CheckResult(check: check)
          }
        }
        .disabled(!settings.isComplete || check == .checking)
        if case .failed(let message) = check {
          Text(message).font(.footnote).foregroundStyle(.red)
        }
      }

      Section("How to share") {
        Label("In any app (Instagram, TikTok, Safari…), tap Share on a link.", systemImage: "square.and.arrow.up")
        Label("Choose Spotarr in the list (More… the first time).", systemImage: "scope")
        Label("Follow it in History, and add the film from its page.", systemImage: "film")
      }
    }
    .navigationTitle("Settings")
    .onChange(of: settings) {
      SettingsStore.save(settings)
      check = .idle
    }
  }

  private func testConnection() async {
    guard let client = SpotarrClient(settings: settings) else { return }
    check = .checking
    do {
      check = .ok(try await client.version())
    } catch {
      check = .failed(error.message)
    }
  }
}

private struct CheckResult: View {
  let check: SettingsView.Check

  var body: some View {
    switch check {
    case .idle: EmptyView()
    case .checking: ProgressView()
    case .ok(let version):
      Label("Spotarr \(version)", systemImage: "checkmark.circle.fill")
        .foregroundStyle(.green)
        .font(.footnote)
    case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
    }
  }
}
