import { expect, test } from "bun:test";
import type { JellyfinItem } from "../../../integrations/jellyfin/client";
import type { Addition, Share } from "../../shares/types";
import { collectionChanges, spottedTitles } from "./collection-changes";

const addition = (
  tmdbId: number,
  createdAt: string,
  status: Addition["status"] = "REQUESTED",
): Addition => ({
  id: `add_${tmdbId}_${createdAt}`,
  createdAt,
  tmdbId,
  type: "MOVIE",
  target: "SEERR",
  status,
  automatic: false,
});
const share = (additions: Addition[]) => ({ additions }) as Share;
const movie = (tmdbId: number) => ({ type: "MOVIE" as const, tmdbId });
const item = (id: string, tmdbId: number, played = false): JellyfinItem => ({
  id,
  type: "MOVIE",
  tmdbId,
  played,
});

test("spotted titles: every Addition that did not fail, newest first, each title once", () => {
  const shares = [
    share([addition(1, "2026-10-01"), addition(2, "2026-10-03", "FAILED")]),
    share([addition(3, "2026-10-02", "ALREADY_PRESENT"), addition(1, "2026-10-04")]),
  ];
  expect(spottedTitles(shares)).toEqual([movie(1), movie(3)]);
});

test("a movie and a show with the same TMDB id are two titles", () => {
  const show = { ...addition(1, "2026-10-02"), type: "TV" as const };
  expect(spottedTitles([share([addition(1, "2026-10-01"), show])])).toEqual([
    { type: "TV", tmdbId: 1 },
    movie(1),
  ]);
});

test("the Collection holds what Jellyfin has and the user has not watched", () => {
  const library = [item("a", 1), item("b", 2, true), item("x", 9)];
  expect(collectionChanges([movie(1), movie(2), movie(3)], library, [])).toEqual({
    add: ["a"],
    remove: [],
    titles: 1,
    watched: 1,
    notInJellyfin: 1,
  });
});

test("what is there already stays; what was watched or put by hand goes", () => {
  const library = [item("a", 1), item("b", 2, true), item("x", 9)];
  const changes = collectionChanges([movie(1), movie(2)], library, ["a", "b", "x"]);
  expect(changes.add).toEqual([]);
  expect(changes.remove).toEqual(["b", "x"]);
});

test("a title in two libraries: both copies, until one is watched", () => {
  const twice = [item("hd", 1), item("4k", 1)];
  expect(collectionChanges([movie(1)], twice, []).add).toEqual(["hd", "4k"]);
  const watchedOnce = [item("hd", 1, true), item("4k", 1)];
  expect(collectionChanges([movie(1)], watchedOnce, ["hd", "4k"]).remove).toEqual(["hd", "4k"]);
});

test("a series is not the movie with the same TMDB id", () => {
  const series: JellyfinItem = { id: "s", type: "TV", tmdbId: 1, played: false };
  expect(collectionChanges([movie(1)], [series], []).notInJellyfin).toBe(1);
});
