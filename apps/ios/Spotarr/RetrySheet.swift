import SwiftUI

/// What "Retry identification" opens: the effort (the settings' by default) and
/// a hint for the LLM if wanted, both for this retry only.
struct RetrySheet: View {
  /// Called on Retry with the effort (nil: the settings') and the hint (empty: none).
  let retry: @MainActor (String?, String) -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var effort: String?
  @State private var hint = ""

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker("Effort", selection: $effort) {
            Text("Default (Settings)").tag(String?.none)
            ForEach(["low", "medium", "high"], id: \.self) { effort in
              Text(effort.capitalized).tag(String?.some(effort))
            }
          }
        } footer: {
          Text("Higher thinks longer: slower and dearer.")
        }
        Section {
          TextField("The Korean show, not the movie", text: $hint, axis: .vertical)
            .lineLimit(2...4)
        } header: {
          Text("Hint for the LLM (optional)")
        } footer: {
          Text("What the identification got wrong, in one sentence.")
        }
      }
      // Spotarr refuses a hint over 500 characters.
      .onChange(of: hint) {
        if hint.count > 500 { hint = String(hint.prefix(500)) }
      }
      .navigationTitle("Retry")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Retry") {
            retry(effort, hint)
            dismiss()
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
  }
}
