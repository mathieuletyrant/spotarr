/// The LLM's efforts, as Spotarr takes them, and how long each may take:
/// Spotarr gives up after 60 s, 3 min and 5 min.
enum Effort {
  static let all: [(value: String, label: String)] = [
    ("low", "Low · a few seconds"),
    ("medium", "Medium · up to 3 min"),
    ("high", "High · up to 5 min"),
  ]
}

extension Effort {
  /// What a Share's page says while it waits, by the effort its Identification gets.
  static func waiting(_ effort: String) -> String {
    switch effort {
    case "medium": "This can take up to 3 minutes at medium effort"
    case "high": "This can take up to 5 minutes at high effort"
    default: "This takes 10 to 30 seconds"
    }
  }
}
