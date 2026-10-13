import { describe, expect, test } from "bun:test";
import { addedCountOf, candidateStatusOf, summaryOf } from "./summary";
import type { Addition, Candidate } from "./types";

const candidate = (libraryState: Candidate["libraryState"]): Candidate => ({
  tmdbId: 1,
  type: "MOVIE",
  title: "Dune",
  libraryState,
});
const addition = (status: Addition["status"]): Addition => ({
  id: "add_1",
  automatic: false,
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

describe("a Candidate's status", () => {
  test("its latest Addition decides first", () => {
    const additions = [addition("FAILED"), { ...addition("REQUESTED"), automatic: true }];
    expect(candidateStatusOf(candidate("ABSENT"), additions)).toEqual({
      status: "REQUESTED",
      automatic: true,
    });
    expect(candidateStatusOf(candidate("ABSENT"), [addition("ADDED")]).status).toBe("ADDED");
  });

  test("an Addition of another Candidate does not count", () => {
    const other = { ...addition("ADDED"), tmdbId: 2 };
    expect(candidateStatusOf(candidate("ABSENT"), [other]).status).toBe("CAN_ADD");
  });

  test("without an Addition, its Library state", () => {
    expect(candidateStatusOf(candidate("AVAILABLE"), []).status).toBe("ALREADY_PRESENT");
    expect(candidateStatusOf(candidate("PARTIAL"), []).status).toBe("ALREADY_PRESENT");
    expect(candidateStatusOf(candidate("REQUESTED"), []).status).toBe("REQUESTED");
    expect(candidateStatusOf(candidate("ABSENT"), [])).toEqual({
      status: "CAN_ADD",
      automatic: false,
    });
  });

  test("in the library already beats a failed Addition", () => {
    expect(candidateStatusOf(candidate("AVAILABLE"), [addition("FAILED")]).status).toBe(
      "ALREADY_PRESENT",
    );
  });

  test("a failed Addition leaves it to add again, with the error", () => {
    const failed = { ...addition("FAILED"), error: "Seerr answered 500" };
    expect(candidateStatusOf(candidate("ABSENT"), [failed])).toEqual({
      status: "CAN_ADD",
      automatic: false,
      failure: "Seerr answered 500",
    });
  });
});

test("the added count leaves failed Additions out", () => {
  const additions = [addition("FAILED"), addition("REQUESTED"), addition("ALREADY_PRESENT")];
  expect(addedCountOf(additions)).toBe(2);
});
