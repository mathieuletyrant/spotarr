import SpotarrKit
import SwiftUI

// A Share's page: its Candidates to add, the frames and clues they were found
// from, and the LLM's reasoning. Retry and the source are in the toolbar.
struct ShareDetailView: View {
  let shareID: String
  /// Tells the history a Share changed here, so its row follows.
  let onChange: @MainActor (Share) -> Void

  @State private var share: Share?
  @State private var error: String?
  @State private var retrying = false
  /// The retry sheet is open: effort and hint.
  @State private var choosingRetry = false

  private static let extractors = [
    "video": "Video",
    "instagram-photo": "Instagram photo",
    "id-link": "IMDb or TMDB link",
    "web": "Web page",
  ]

  var body: some View {
    Group {
      if let share {
        details(share)
      } else if let error {
        ContentUnavailableView(
          "Can't load the Share", systemImage: "exclamationmark.triangle",
          description: Text(error))
      } else {
        ProgressView()
      }
    }
    .navigationTitle(share.map(shareDate) ?? "Share")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if let share {
        ToolbarItemGroup(placement: .topBarTrailing) {
          if share.input.hasURL, let source = URL(string: share.input.url) {
            Link(destination: source) {
              Label("Open the source", systemImage: "safari")
            }
          }
          Button("Retry identification", systemImage: "arrow.clockwise") {
            choosingRetry = true
          }
          .disabled(retrying || share.isInProgress)
        }
      }
    }
    .sheet(isPresented: $choosingRetry) {
      RetrySheet { effort, hint in
        Task { await retry(effort: effort, hint: hint) }
      }
    }
    .refreshable { await load() }
    .task { await load() }
    // While it is identified, the page follows on its own.
    .task(id: share?.isInProgress == true) {
      while share?.isInProgress == true && !Task.isCancelled {
        try? await Task.sleep(for: .seconds(2))
        await load()
      }
    }
  }

  private func details(_ share: Share) -> some View {
    List {
      Section {
        LabeledContent("Source", value: share.source)
        if share.input.hasURL {
          Text(share.input.url)
            .font(.footnote.monospaced())
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .textSelection(.enabled)
        }
        if share.input.hasText {
          Text("“\(share.input.text)”").foregroundStyle(.secondary)
        }
        LabeledContent("Status") {
          StatusBadge(summary: share.summary, detail: share.additionProgress)
        }
        if share.hasFailureReason {
          Text(share.failureReason).font(.footnote).foregroundStyle(.red)
        }
        if let error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
      }

      Section("Candidates") {
        if share.isInProgress {
          Label(
            "Identifying… \(Effort.waiting(share.identification.effort)); the page follows on its own.",
            systemImage: "hourglass")
          .foregroundStyle(.secondary)
        } else if share.candidates.isEmpty {
          Text("No candidates. Retry the identification, or open the source.")
            .foregroundStyle(.secondary)
        } else {
          ForEach(share.candidates) { candidate in
            CandidateRow(candidate: candidate, state: candidate.state) {
              await add(candidate)
            }
          }
        }
      }

      if !share.frames.isEmpty {
        Section("\(share.frames.count) frames taken from the video") {
          ScrollView(.horizontal) {
            LazyHStack(spacing: 8) {
              ForEach(share.frames) { frame in FrameImage(frame: frame) }
            }
          }
          .scrollIndicators(.hidden)
          .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
        }
      }

      if !share.isInProgress {
        Section("Clues") {
          LabeledContent("Sources", value: sources(of: share) ?? "None")
          LabeledContent("Caption", value: clue(share.identification.clues.caption))
          LabeledContent("Author", value: clue(share.identification.clues.author))
          LabeledContent("Method", value: method(of: share) ?? "None")
          if share.identification.hasHint {
            LabeledContent("Your hint", value: share.identification.hint)
          }
        }
      }

      if share.identification.hasReasoning {
        Section("LLM reasoning") {
          Text(share.identification.reasoning)
        }
      }
    }
  }

  private func load() async {
    guard let client = SpotarrClient(settings: SettingsStore.load()) else {
      error = "Set Spotarr's address and API token in Settings."
      return
    }
    do {
      let fresh = try await client.getShare(id: shareID)
      show(fresh)
      error = nil
    } catch {
      self.error = error.message
    }
  }

  /// `effort` and `hint` are for this Identification only; nil effort: the
  /// settings', empty hint: none.
  private func retry(effort: String?, hint: String) async {
    guard let client = SpotarrClient(settings: SettingsStore.load()) else { return }
    retrying = true
    defer { retrying = false }
    do {
      let fresh = try await client.retryIdentification(id: shareID, effort: effort, hint: hint)
      show(fresh)
      error = nil
    } catch {
      self.error = error.message
    }
  }

  /// Nil when Spotarr took it, else why not. Seerr's own refusal comes back
  /// in the Share, as a failed Addition.
  private func add(_ candidate: Candidate) async -> String? {
    guard let client = SpotarrClient(settings: SettingsStore.load()) else {
      return "Set Spotarr's address and API token in Settings."
    }
    do {
      let fresh = try await client.add(candidate, from: shareID)
      show(fresh)
      return nil
    } catch {
      return error.message
    }
  }

  private func show(_ fresh: Share) {
    share = fresh
    onChange(fresh)
  }

  private func clue(_ value: String) -> String {
    value.isEmpty ? "None" : value
  }

  private func sources(of share: Share) -> String? {
    let names = share.identification.extractors.map { Self.extractors[$0] ?? $0 }
    return names.isEmpty ? nil : names.joined(separator: ", ")
  }

  // "LLM, high effort · 14 s" or "Direct link · 2 s"; only the duration when it
  // failed before choosing a method.
  private func method(of share: Share) -> String? {
    let identification = share.identification
    if !identification.hasDurationMs { return nil }
    let time = duration(identification.durationMs)
    switch identification.method {
    case .directID: return "Direct link · \(time)"
    case .llm where identification.hasEffort:
      return "LLM, \(identification.effort) effort · \(time)"
    case .llm: return "LLM · \(time)"
    default: return time
    }
  }
}
