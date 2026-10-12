import { expect, test } from "bun:test";
import { summaryOf } from "./summary";
import type { Addition, Candidate } from "./types";

const candidate = (libraryState: Candidate["libraryState"]): Candidate => ({
  tmdbId: 1,
  type: "MOVIE",
  title: "Dune",
  libraryState,
});
const addition = (status: Addition["status"]): Addition => ({
  id: "add_1",
  createdAt: "2026-10-12T10:00:00.000Z",
  tmdbId: 1,
  type: "MOVIE",
  target: "SEERR",
  status,
});

test("queued or processing: in progress, whatever else", () => {
  expect(summaryOf("QUEUED", [], [])).toBe("IN_PROGRESS");
  expect(summaryOf("PROCESSING", [], [addition("REQUESTED")])).toBe("IN_PROGRESS");
});

test("the latest Addition wins", () => {
  expect(
    summaryOf("READY", [candidate("ABSENT")], [addition("FAILED"), addition("REQUESTED")]),
  ).toBe("REQUESTED");
});

test("without Addition: failed, no match, already present or to choose", () => {
  expect(summaryOf("FAILED", [], [])).toBe("FAILED");
  expect(summaryOf("NO_MATCH", [], [])).toBe("NO_MATCH");
  expect(summaryOf("READY", [candidate("PARTIAL")], [])).toBe("ALREADY_PRESENT");
  expect(summaryOf("READY", [candidate("AVAILABLE")], [])).toBe("ALREADY_PRESENT");
  expect(summaryOf("READY", [candidate("ABSENT")], [])).toBe("TO_CHOOSE");
});
