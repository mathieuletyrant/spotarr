// swift-tools-version: 6.2
import PackageDescription

// The code the app and its share extension share: the Connect client generated
// from the contract (Sources/SpotarrKit/gen, by `pnpm generate`), the settings
// kept in the keychain, and sending a share. `swift test` runs its tests on a Mac.
let package = Package(
  name: "SpotarrKit",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [.library(name: "SpotarrKit", targets: ["SpotarrKit"])],
  dependencies: [
    // Same versions as the code generators in packages/contract/buf.gen.yaml.
    .package(url: "https://github.com/connectrpc/connect-swift", exact: "1.2.3"),
    .package(url: "https://github.com/apple/swift-protobuf", exact: "1.38.1"),
  ],
  targets: [
    .target(
      name: "SpotarrKit",
      dependencies: [
        .product(name: "Connect", package: "connect-swift"),
        .product(name: "SwiftProtobuf", package: "swift-protobuf"),
      ]
    ),
    .testTarget(name: "SpotarrKitTests", dependencies: ["SpotarrKit"]),
  ]
)
