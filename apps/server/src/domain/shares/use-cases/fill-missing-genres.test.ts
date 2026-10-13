import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { Tmdb } from "../../../integrations/tmdb/client";
import { getMovieDetailsResponseMock } from "../../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { ShareRepository } from "../repository";
import type { Candidate } from "../types";
import { fillMissingGenres } from "./fill-missing-genres";

afterEach(() => mock.restore());

const dueDate: Candidate = {
  tmdbId: 41733,
  type: "MOVIE",
  title: "Date limite",
  libraryState: "ABSENT",
};

// A finished Share whose Candidates are `candidates`.
async function shareWith(candidates: Candidate[]) {
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const id = await shares.create({ text: "x" }, "text");
  await shares.finish(id, { status: "READY", extractors: [], clues: {}, candidates }, 5);
  return { shares, id };
}

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });

test("a Candidate without genres gets them from TMDB's details", async () => {
  const { shares, id } = await shareWith([dueDate]);
  fakeFetch({
    "/3/movie/41733": getMovieDetailsResponseMock({
      id: 41733,
      title: "Date limite",
      genres: [
        { id: 35, name: "Comédie" },
        { id: 18, name: "Drame" },
      ],
    }),
  });

  expect(await fillMissingGenres(shares, tmdb)).toBe(1);
  expect((await shares.get(id))?.candidates[0]?.genres).toEqual(["Comédie", "Drame"]);
});

test("Candidates with genres are not asked again", async () => {
  const { shares } = await shareWith([{ ...dueDate, genres: ["Comédie"] }]);
  const fetch = fakeFetch({});

  expect(await fillMissingGenres(shares, tmdb)).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});

test("when TMDB fails, the Candidate stays without genres, to be tried again", async () => {
  const { shares, id } = await shareWith([dueDate]);
  fakeFetch({ "/3/movie/41733": 500 });

  expect(await fillMissingGenres(shares, tmdb)).toBe(0);
  expect((await shares.get(id))?.candidates[0]?.genres).toBeUndefined();
});
