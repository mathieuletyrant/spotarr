/// The LLM's efforts, as Spotarr takes them, and how long each may take:
/// Spotarr gives up after 60 s, 3 min and 5 min.
enum Effort {
  static let all: [(value: String, label: String)] = [
    ("low", "Low · a few seconds"),
    ("medium", "Medium · up to 3 min"),
    ("high", "High · up to 5 min"),
  ]
}
