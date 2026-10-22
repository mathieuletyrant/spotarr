import { expect, test } from "bun:test";
import { create } from "@bufbuild/protobuf";
import { MediaType, RuleAction, SettingsSchema } from "@spotarr/contract";
import { shareActions } from "./actions";

const both = {
  seerr: { url: "http://seerr:5055", apiKey: "k" },
  snug: { watchlistUrl: "http://snug/api/watchlist/t" },
};

test("a Share offers the Actions set up for its type, Snug only for TV shows", () => {
  const settings = create(SettingsSchema, both);
  expect(shareActions(settings, MediaType.MOVIE)).toEqual([
    RuleAction.SEERR_REQUEST,
    RuleAction.SEERR_WATCHLIST,
  ]);
  expect(shareActions(settings, MediaType.TV)).toEqual([
    RuleAction.SEERR_REQUEST,
    RuleAction.SEERR_WATCHLIST,
    RuleAction.SNUG_WATCHLIST,
  ]);
  expect(shareActions(undefined, MediaType.TV)).toEqual([]);
});

test("the main Action chosen for a type comes first, the others keep their order", () => {
  const settings = create(SettingsSchema, {
    ...both,
    shareActions: { movie: "SEERR_WATCHLIST", tv: "SNUG_WATCHLIST" },
  });
  expect(shareActions(settings, MediaType.MOVIE)).toEqual([
    RuleAction.SEERR_WATCHLIST,
    RuleAction.SEERR_REQUEST,
  ]);
  expect(shareActions(settings, MediaType.TV)).toEqual([
    RuleAction.SNUG_WATCHLIST,
    RuleAction.SEERR_REQUEST,
    RuleAction.SEERR_WATCHLIST,
  ]);
});

test("a main Action no longer set up is skipped", () => {
  const settings = create(SettingsSchema, {
    seerr: both.seerr,
    shareActions: { tv: "SNUG_WATCHLIST" },
  });
  expect(shareActions(settings, MediaType.TV)[0]).toBe(RuleAction.SEERR_REQUEST);
});
