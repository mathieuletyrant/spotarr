/// <reference types="bun" />
import { expect, test } from "bun:test";
import { changes, errorsByField } from "./settings-form";

test("only the changed fields are sent, numbers as numbers", () => {
  const saved = {
    "seerr.apiKey": "old",
    "seerr.url": "http://seerr",
    "extraction.concurrency": "2",
  };
  const values = { ...saved, "seerr.apiKey": "new", "extraction.concurrency": "3" };
  expect(changes(values, saved)).toEqual({
    seerr: { apiKey: "new" },
    extraction: { concurrency: 3 },
  });
});

test("the server's validation message is split by field", () => {
  expect(
    errorsByField(
      "identification.language: expected a language tag like fr-FR; seerr.url: Invalid URL",
    ),
  ).toEqual({
    "identification.language": "expected a language tag like fr-FR",
    "seerr.url": "Invalid URL",
  });
  expect(errorsByField("Seerr answered 500")).toEqual({ "": "Seerr answered 500" });
});

test("auto add's switches are sent as booleans, its threshold as a number", () => {
  const saved = {
    "autoAdd.enabled": "false",
    "autoAdd.onlyOne": "true",
    "autoAdd.minConfidence": "95",
  };
  const values = { ...saved, "autoAdd.enabled": "true", "autoAdd.minConfidence": "90" };
  expect(changes(values, saved)).toEqual({ autoAdd: { enabled: true, minConfidence: 90 } });
  expect(errorsByField("autoAdd.minConfidence: Too small")).toEqual({
    "autoAdd.minConfidence": "Too small",
  });
});
