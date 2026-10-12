import XCTest

// Taps the settings' fields like a person would, and checks the keyboard opens.
final class SettingsUITests: XCTestCase {
  func testTheFieldsOpenTheKeyboard() {
    let app = XCUIApplication()
    app.launch()

    let address = app.textFields["http://umbrel.local:3838"]
    XCTAssertTrue(address.waitForExistence(timeout: 5))
    address.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3), "no keyboard for the address")
    address.typeText("umbrel.local:3838")

    let token = app.secureTextFields["API token"]
    token.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3), "no keyboard for the token")
  }
}
