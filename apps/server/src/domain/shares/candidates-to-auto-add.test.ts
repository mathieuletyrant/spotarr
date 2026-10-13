import { describe, expect, test } from "bun:test";
import { candidatesToAutoAdd } from "./candidates-to-auto-add";
import type { Candidate } from "./types";

const rule = { enabled: true, minConfidence: 95, onlyOne: true };

function candidate(title: string, confidence: number | undefined, absent = true): Candidate {
  return {
    tmdbId: title.length,
    type: "MOVIE",
    title,
    confidence,
    libraryState: absent ? "ABSENT" : "AVAILABLE",
  };
}

const titles = (candidates: Candidate[]) => candidates.map((c) => c.title);

describe("which Candidates auto add requests", () => {
  test("nothing while it is off", () => {
    expect(candidatesToAutoAdd([candidate("Kraken", 1)], { ...rule, enabled: false })).toEqual([]);
  });

  test("only one: a single Candidate, at the threshold or above", () => {
    expect(titles(candidatesToAutoAdd([candidate("Kraken", 0.95)], rule))).toEqual(["Kraken"]);
    expect(candidatesToAutoAdd([candidate("Kraken", 0.94)], rule)).toEqual([]);
  });

  test("only one: two Candidates is a doubt, however sure the first one is", () => {
    const kraken = candidate("Kraken", 0.98);
    const krakenMare = candidate("Kraken Mare", 0.4);
    expect(candidatesToAutoAdd([kraken, krakenMare], rule)).toEqual([]);
  });

  test("every one: all confident Candidates not in the library yet", () => {
    const reel = [
      candidate("Awake", 1),
      candidate("Due Date", 0.97),
      candidate("Marriage Story", 1, false),
    ];
    expect(titles(candidatesToAutoAdd(reel, { ...rule, onlyOne: false }))).toEqual([
      "Awake",
      "Due Date",
    ]);
  });

  test("a direct IMDb or TMDB link has no confidence: it counts as 100 %", () => {
    expect(titles(candidatesToAutoAdd([candidate("Dune", undefined)], rule))).toEqual(["Dune"]);
  });

  test("a single confident Candidate already in the library is not requested again", () => {
    expect(candidatesToAutoAdd([candidate("Dune", 1, false)], rule)).toEqual([]);
  });
});
