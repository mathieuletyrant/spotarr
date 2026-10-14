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

test("numbers are sent as numbers", () => {
  const saved = { "extraction.framesPerVideo": "6", "extraction.concurrency": "2" };
  const values = { ...saved, "extraction.framesPerVideo": "8" };
  expect(changes(values, saved)).toEqual({ extraction: { framesPerVideo: 8 } });
  expect(errorsByField("extraction.framesPerVideo: Too big")).toEqual({
    "extraction.framesPerVideo": "Too big",
  });
});
