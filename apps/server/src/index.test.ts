import { expect, test } from "bun:test";
import { appName } from "./index";

test("the toolchain runs a test", () => {
  expect(appName).toBe("spotarr");
});
