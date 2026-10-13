import SpotarrKit
import SwiftUI

/// The history's genres as capsules, most Shares first, each with its count.
/// Several can be chosen: the history then shows the Shares of any of them.
/// The chosen ones come first, so they never hide off screen.
struct GenreChips: View {
  let genres: [GenreCount]
  @Binding var selected: [String]

  var body: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 8) {
        if !selected.isEmpty {
          Button("Clear the genres", systemImage: "xmark") { selected = [] }
            .labelStyle(.iconOnly)
            .buttonStyle(.bordered)
            .buttonBorderShape(.circle)
        }
        ForEach(chosenFirst, id: \.genre) { item in
          chip(item)
        }
      }
      .controlSize(.small)
      .padding(.horizontal)
      .padding(.vertical, 8)
    }
    .scrollIndicators(.hidden)
  }

  private var chosenFirst: [GenreCount] {
    genres.filter { selected.contains($0.genre) } + genres.filter { !selected.contains($0.genre) }
  }

  private func chip(_ item: GenreCount) -> some View {
    let chosen = selected.contains(item.genre)
    return Button {
      toggle(item.genre)
    } label: {
      HStack(spacing: 4) {
        if chosen { Image(systemName: "checkmark") }
        Text(item.genre)
        Text(String(item.count)).foregroundStyle(.secondary)
      }
    }
    .buttonStyle(.bordered)
    .buttonBorderShape(.capsule)
    .tint(chosen ? .accentColor : .secondary)
    .accessibilityAddTraits(chosen ? .isSelected : [])
  }

  private func toggle(_ genre: String) {
    if let index = selected.firstIndex(of: genre) {
      selected.remove(at: index)
    } else {
      selected.append(genre)
    }
  }
}
