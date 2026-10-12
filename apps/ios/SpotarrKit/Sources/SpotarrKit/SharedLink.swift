import Foundation

/// The first web link in a text: some apps share "Look at this! https://…".
public func firstLink(in text: String) -> URL? {
  guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
  else { return nil }
  let range = NSRange(text.startIndex..., in: text)
  return detector.matches(in: text, range: range)
    .compactMap(\.url)
    .first { $0.scheme == "http" || $0.scheme == "https" }
}
