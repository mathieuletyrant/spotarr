import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../db";
import { SettingsRepository } from "../settings/repository";
import { Tmdb } from "../tmdb/client";
import { fakeTmdb } from "../tmdb/fake-fetch";
import { getFindByIdResponseMock, getMovieDetailsResponseMock } from "../tmdb/gen/tmdb.faker";
import { identify } from "./identify";

afterEach(() => mock.restore());

const settings = new SettingsRepository(await openDatabase(":memory:"));
await settings.update({ identification: { tmdbToken: "tok" } });
const tmdb = new Tmdb(settings);

const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  release_date: "2024-02-27",
});

test("an IMDb link gives a certain Candidate, without LLM", async () => {
  fakeTmdb({ "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }) });

  const result = await identify({ url: "https://www.imdb.com/title/tt15239678/" }, tmdb);

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toMatchObject([
    {
      tmdbId: 693134,
      type: "MOVIE",
      title: "Dune : Deuxième partie",
      year: 2024,
      libraryState: "ABSENT",
    },
  ]);
  expect(result.candidates[0]?.confidence).toBeUndefined();
});

test("a TMDB link in a text is followed too", async () => {
  fakeTmdb({ "/3/movie/693134": dune });
  const result = await identify({ text: "à voir : https://www.themoviedb.org/movie/693134" }, tmdb);
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("an IMDb and a TMDB link to the same title give one Candidate", async () => {
  fakeTmdb({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }),
    "/3/movie/693134": dune,
  });
  const text = "imdb.com/title/tt15239678 themoviedb.org/movie/693134";
  expect((await identify({ text }, tmdb)).candidates).toHaveLength(1);
});

test("no link: no match, and TMDB is never called", async () => {
  const fetch = fakeTmdb({});
  const result = await identify({ url: "https://www.instagram.com/reel/abc" }, tmdb);
  expect(result.status).toBe("NO_MATCH");
  expect(fetch).not.toHaveBeenCalled();
});
