import { describe, expect, test } from "bun:test";
import type { Rule } from "../../auto-add/types";
import type { Candidate } from "../types";
import { candidatesToAutoAdd } from "./candidates-to-auto-add";

// Today's auto add, as the migration turns it into a Rule.
const sure: Rule = {
  id: "rul_1",
  name: "Sure",
  enabled: true,
  action: "SEERR_REQUEST",
  onlyOne: true,
  unreleasedSkipsRating: false,
  minConfidence: 95,
};

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

const today = "2026-10-14";

const added = (candidates: Candidate[], rules: Rule[]) =>
  candidatesToAutoAdd(candidates, rules, today).map(
    (a) => `${a.candidate.title} by ${a.rule.name}`,
  );

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
      action: "SEERR_REQUEST",
      onlyOne: false,
      unreleasedSkipsRating: false,
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
      action: "SEERR_REQUEST",
      onlyOne: false,
      unreleasedSkipsRating: false,
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

  test("a title not out yet skips the rating when the Rule says so, not the other conditions", () => {
    const rated: Rule = {
      id: "rul_6",
      name: "Rated",
      enabled: true,
      action: "SEERR_REQUEST",
      onlyOne: false,
      minConfidence: 90,
      minRating: 7,
      minVotes: 100,
      unreleasedSkipsRating: true,
    };
    const upcoming = { releaseDate: "2026-12-18", year: 2026 };
    expect(added([candidate("Upcoming", upcoming)], [rated])).toEqual(["Upcoming by Rated"]);
    expect(added([candidate("No date yet")], [rated])).toEqual(["No date yet by Rated"]);
    expect(added([candidate("Unsure", { ...upcoming, confidence: 0.8 })], [rated])).toEqual([]);
    expect(
      added([candidate("Upcoming", upcoming)], [{ ...rated, unreleasedSkipsRating: false }]),
    ).toEqual([]);

    // Out today or before: judged on its rating.
    const out = { releaseDate: today, year: 2026, tmdbRating: 6, tmdbVotes: 10 };
    expect(added([candidate("Out", out)], [rated])).toEqual([]);
    // Identified before release dates were kept: the year tells.
    expect(added([candidate("Old", { year: 2025 })], [rated])).toEqual([]);
    expect(added([candidate("Next year", { year: 2027 })], [rated])).toEqual([
      "Next year by Rated",
    ]);
  });

  test("several Rules: a Candidate is added once, credited to the first Rule that holds", () => {
    const movies: Rule = {
      id: "rul_2",
      name: "Movies",
      enabled: true,
      action: "SEERR_REQUEST",
      onlyOne: false,
      unreleasedSkipsRating: false,
      type: "MOVIE",
    };
    const shows: Rule = {
      id: "rul_4",
      name: "Shows",
      enabled: true,
      action: "SEERR_REQUEST",
      onlyOne: false,
      type: "TV",
      unreleasedSkipsRating: false,
    };
    const anything: Rule = {
      id: "rul_5",
      name: "Anything",
      enabled: true,
      action: "SEERR_REQUEST",
      onlyOne: false,
      unreleasedSkipsRating: false,
    };
    const reel = [candidate("Alien"), candidate("Severance", { type: "TV" })];
    expect(added(reel, [movies, shows, anything])).toEqual([
      "Alien by Movies",
      "Severance by Shows",
    ]);
  });

  test("a Rule that requests wins over one that puts in the watchlist, whatever their order", () => {
    const spotted: Rule = {
      ...sure,
      id: "rul_6",
      name: "Spotted",
      onlyOne: false,
      minConfidence: undefined,
      action: "SEERR_WATCHLIST",
    };
    const reel = [candidate("Kraken"), candidate("Alien", { confidence: 0.5 })];
    expect(added(reel, [spotted, { ...sure, onlyOne: false }])).toEqual([
      "Kraken by Sure",
      "Alien by Spotted",
    ]);
  });
});
