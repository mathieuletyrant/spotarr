import SwiftUI
import UIKit
import UniformTypeIdentifiers

// The share sheet's entry point: iOS creates it, it shows the SwiftUI view and
// closes the sheet when the view is done.
final class ShareViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
      .flatMap { $0.attachments ?? [] }
    let view = ShareView(providers: providers) { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil)
    }
    let host = UIHostingController(rootView: view)
    addChild(host)
    host.view.frame = self.view.bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    self.view.addSubview(host.view)
    host.didMove(toParent: self)
  }
}
