import { expect, test } from "bun:test";
import { create } from "@bufbuild/protobuf";
import { MediaType, RuleAction, RuleSchema, SettingsSchema } from "@spotarr/contract";
import { actionsSetUp, conditionsOf } from "./rules";

test("a Rule's conditions read in the form's order", () => {
  const rule = create(RuleSchema, {
    type: MediaType.MOVIE,
    onlyOne: true,
    minConfidence: 90,
    minRating: 6.5,
    minVotes: 100,
  });
  expect(conditionsOf(rule)).toEqual([
    "a movie",
    "a single candidate",
    "confidence ≥ 90%",
    "TMDB ≥ 6.5 (100+ votes)",
  ]);
});

test("a Rule without conditions has none: it adds every candidate", () => {
  expect(conditionsOf(create(RuleSchema, {}))).toEqual([]);
});

test("a title not out yet skipping the rating joins the rating's chip, and only it", () => {
  const rated = create(RuleSchema, { minRating: 7.5, unreleasedSkipsRating: true });
  expect(conditionsOf(rated)).toEqual(["TMDB ≥ 7.5 or not out yet"]);
  const unrated = create(RuleSchema, { minConfidence: 90, unreleasedSkipsRating: true });
  expect(conditionsOf(unrated)).toEqual(["confidence ≥ 90%"]);
});

test("a Rule offers Seerr's Actions only once Seerr is set up", () => {
  expect(actionsSetUp(undefined)).toEqual([]);
  const urlOnly = create(SettingsSchema, { seerr: { url: "http://seerr:5055" } });
  expect(actionsSetUp(urlOnly)).toEqual([]);
  const seerr = create(SettingsSchema, { seerr: { url: "http://seerr:5055", apiKey: "k" } });
  expect(actionsSetUp(seerr)).toEqual([RuleAction.SEERR_REQUEST, RuleAction.SEERR_WATCHLIST]);
});
