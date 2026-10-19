import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { Tmdb } from "../../../integrations/tmdb/client";
import {
  getMovieDetailsResponseMock,
  getMovieKeywordsResponseMock,
} from "../../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { ShareRepository } from "../repository";
import type { Candidate } from "../types";
import { fillMissingDetails } from "./fill-missing-details";

afterEach(() => mock.restore());

const today = "2026-10-14";

// Identified before genres, ratings, release dates and keywords were kept.
const dueDate: Candidate = {
  tmdbId: 41733,
  type: "MOVIE",
  title: "Date limite",
  libraryState: "ABSENT",
};

const dueDateDetails = getMovieDetailsResponseMock({
  id: 41733,
  title: "Date limite",
  release_date: "2010-11-03",
  vote_average: 6.4,
  vote_count: 5321,
  overview: "Un futur papa traverse le pays avec un inconnu.",
  genres: [
    { id: 35, name: "Comédie" },
    { id: 18, name: "Drame" },
  ],
});

// A finished Share whose Candidates are `candidates`.
async function shareWith(candidates: Candidate[]) {
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const id = await shares.create({ text: "x" }, "text");
  await shares.finish(id, { status: "READY", extractors: [], clues: {}, candidates }, 5);
  return { shares, id };
}

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });

test("an old Candidate gets its genres, rating, votes, release date and overview from TMDB", async () => {
  const { shares, id } = await shareWith([dueDate]);
  fakeFetch({ "/3/movie/41733": dueDateDetails });

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(1);
  expect((await shares.get(id))?.candidates[0]).toMatchObject({
    genres: ["Comédie", "Drame"],
    tmdbRating: 6.4,
    tmdbVotes: 5321,
    releaseDate: "2010-11-03",
    overview: "Un futur papa traverse le pays avec un inconnu.",
  });
});

test("an old Candidate gets its keywords from TMDB", async () => {
  const { shares, id } = await shareWith([dueDate]);
  fakeFetch({
    "/3/movie/41733": dueDateDetails,
    "/3/movie/41733/keywords": getMovieKeywordsResponseMock({
      keywords: [{ id: 7312, name: "road trip" }],
    }),
  });

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(1);
  expect((await shares.get(id))?.candidates[0]?.keywords).toEqual(["road trip"]);
});

test("a Candidate with no keywords on TMDB keeps an empty list, not asked again", async () => {
  const known = {
    ...dueDate,
    genres: ["Comédie"],
    releaseDate: "2010-11-03",
    tmdbRating: 6.4,
    overview: "Un futur papa traverse le pays avec un inconnu.",
  };
  const { shares, id } = await shareWith([known]);
  fakeFetch({ "/3/movie/41733/keywords": getMovieKeywordsResponseMock({ keywords: [] }) });

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(1);
  expect((await shares.get(id))?.candidates[0]?.keywords).toEqual([]);
  mock.restore();
  const fetch = fakeFetch({});
  expect(await fillMissingDetails(shares, tmdb, today)).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});

test("a Candidate that has them all, rated and out, is not asked again", async () => {
  const { shares } = await shareWith([
    {
      ...dueDate,
      genres: ["Comédie"],
      releaseDate: "2010-11-03",
      tmdbRating: 6.4,
      overview: "Un futur papa traverse le pays avec un inconnu.",
      keywords: ["road trip"],
    },
  ]);
  const fetch = fakeFetch({});

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});

test("a title not out yet is asked again, and gets its rating once out", async () => {
  const upcoming = { ...dueDate, genres: ["Comédie"], releaseDate: "2026-11-03" };
  const { shares, id } = await shareWith([upcoming]);
  fakeFetch({ "/3/movie/41733": { ...dueDateDetails, release_date: "2026-11-03" } });

  expect(await fillMissingDetails(shares, tmdb, "2026-12-01")).toBe(1);
  expect((await shares.get(id))?.candidates[0]?.tmdbRating).toBe(6.4);
});

test("nothing new from TMDB: the Share is not written again", async () => {
  const noDate = {
    ...dueDate,
    genres: ["Comédie", "Drame"],
    tmdbRating: 6.4,
    tmdbVotes: 5321,
    overview: "Un futur papa traverse le pays avec un inconnu.",
  };
  const { shares } = await shareWith([noDate]);
  fakeFetch({ "/3/movie/41733": { ...dueDateDetails, release_date: "" } });
  const write = mock(() => Promise.resolve());
  shares.setCandidates = write;

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(0);
  expect(write).not.toHaveBeenCalled();
});

test("when TMDB fails, the Candidate stays as it was, to be tried again", async () => {
  const { shares, id } = await shareWith([dueDate]);
  fakeFetch({ "/3/movie/41733": 500 });

  expect(await fillMissingDetails(shares, tmdb, today)).toBe(0);
  expect((await shares.get(id))?.candidates[0]).toEqual(dueDate);
});
