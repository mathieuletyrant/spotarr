import { describe, expect, test } from "bun:test";
import type { Rule } from "../../auto-add/types";
import type { Candidate } from "../types";
import { candidatesToAutoAdd } from "./candidates-to-auto-add";

// Today's auto add, as the migration turns it into a Rule.
const sure: Rule = { id: "rul_1", name: "Sure", enabled: true, onlyOne: true, minConfidence: 95 };

function candidate(title: string, fields: Partial<Candidate> = {}): Candidate {
  return {
    tmdbId: title.length,
    type: "MOVIE",
    title,
    confidence: 1,
    libraryState: "ABSENT",
    ...fields,
  };
}

const added = (candidates: Candidate[], rules: Rule[]) =>
  candidatesToAutoAdd(candidates, rules).map((a) => `${a.candidate.title} by ${a.rule.name}`);

describe("which Candidates auto add requests, and by which Rule", () => {
  test("nothing without an enabled Rule", () => {
    expect(added([candidate("Kraken")], [])).toEqual([]);
    expect(added([candidate("Kraken")], [{ ...sure, enabled: false }])).toEqual([]);
  });

  test("confidence: at the threshold or above; a direct link counts as 100 %", () => {
    expect(added([candidate("Kraken", { confidence: 0.95 })], [sure])).toEqual(["Kraken by Sure"]);
    expect(added([candidate("Kraken", { confidence: 0.94 })], [sure])).toEqual([]);
    expect(added([candidate("Kraken", { confidence: undefined })], [sure])).toEqual([
      "Kraken by Sure",
    ]);
  });

  test("only one: two Candidates is a doubt, however sure the first one is", () => {
    const reel = [candidate("Kraken", { confidence: 0.98 }), candidate("Kraken Mare")];
    expect(added(reel, [sure])).toEqual([]);
    expect(added(reel, [{ ...sure, onlyOne: false }])).toEqual([
      "Kraken by Sure",
      "Kraken Mare by Sure",
    ]);
  });

  test("never a Candidate already in the library", () => {
    const reel = [candidate("Awake", { libraryState: "AVAILABLE" })];
    expect(added(reel, [{ ...sure, onlyOne: false }])).toEqual([]);
  });

  test("type: a movie Rule leaves TV shows alone", () => {
    const movies: Rule = {
      id: "rul_2",
      name: "Movies",
      enabled: true,
      onlyOne: false,
      type: "MOVIE",
    };
    expect(added([candidate("Severance", { type: "TV" })], [movies])).toEqual([]);
    expect(added([candidate("Alien")], [movies])).toEqual(["Alien by Movies"]);
  });

  test("TMDB rating: at the minimum or above, with enough votes; no rating fails it", () => {
    const rated: Rule = {
      id: "rul_3",
      name: "Rated",
      enabled: true,
      onlyOne: false,
      minRating: 7,
      minVotes: 100,
    };
    expect(added([candidate("Good", { tmdbRating: 7, tmdbVotes: 100 })], [rated])).toEqual([
      "Good by Rated",
    ]);
    expect(added([candidate("Meh", { tmdbRating: 6.9, tmdbVotes: 5000 })], [rated])).toEqual([]);
    expect(added([candidate("New", { tmdbRating: 9, tmdbVotes: 3 })], [rated])).toEqual([]);
    expect(added([candidate("Unrated")], [rated])).toEqual([]);
  });

  test("several Rules: a Candidate is added once, credited to the first Rule that holds", () => {
    const movies: Rule = {
      id: "rul_2",
      name: "Movies",
      enabled: true,
      onlyOne: false,
      type: "MOVIE",
    };
    const shows: Rule = { id: "rul_4", name: "Shows", enabled: true, onlyOne: false, type: "TV" };
    const anything: Rule = { id: "rul_5", name: "Anything", enabled: true, onlyOne: false };
    const reel = [candidate("Alien"), candidate("Severance", { type: "TV" })];
    expect(added(reel, [movies, shows, anything])).toEqual([
      "Alien by Movies",
      "Severance by Shows",
    ]);
  });
});
