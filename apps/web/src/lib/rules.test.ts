import { expect, test } from "bun:test";
import { create } from "@bufbuild/protobuf";
import { MediaType, RuleSchema } from "@spotarr/contract";
import { conditionsOf } from "./rules";

test("a Rule's conditions read in the form's order", () => {
  const rule = create(RuleSchema, {
    type: MediaType.MOVIE,
    onlyOne: true,
    minConfidence: 90,
    minRating: 6.5,
    minVotes: 100,
  });
  expect(conditionsOf(rule)).toEqual([
    "Movies",
    "a single candidate",
    "confidence ≥ 90 %",
    "TMDB ≥ 6.5 (100+ votes)",
  ]);
});

test("a Rule without conditions has none: it adds every candidate", () => {
  expect(conditionsOf(create(RuleSchema, {}))).toEqual([]);
});
