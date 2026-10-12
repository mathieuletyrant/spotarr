import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../db";
import { Tmdb } from "../../integrations/tmdb/client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
} from "../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../testing/fake-fetch";
import { SettingsRepository } from "../settings/repository";
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
  fakeFetch({ "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }) });

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
  fakeFetch({ "/3/movie/693134": dune });
  const result = await identify({ text: "à voir : https://www.themoviedb.org/movie/693134" }, tmdb);
  expect(result.candidates.map((c) => c.title)).toEqual(["Dune : Deuxième partie"]);
});

test("an IMDb and a TMDB link to the same title give one Candidate", async () => {
  fakeFetch({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune] }),
    "/3/movie/693134": dune,
  });
  const text = "imdb.com/title/tt15239678 themoviedb.org/movie/693134";
  expect((await identify({ text }, tmdb)).candidates).toHaveLength(1);
});

test("a text without link: no match, and nothing is fetched", async () => {
  const fetch = fakeFetch({});
  const result = await identify({ text: "le film avec Cillian Murphy dans un sous-marin" }, tmdb);
  expect(result).toMatchObject({ status: "NO_MATCH", extractors: [] });
  expect(fetch).not.toHaveBeenCalled();
});

test("a Letterboxd page names its title: a certain Candidate, with the page's clues", async () => {
  const letterboxd = await Bun.file(
    new URL("extractors/fixtures/letterboxd-dune-part-two.html", import.meta.url),
  ).text();
  fakeFetch({ "/film/dune-part-two/": letterboxd, "/3/movie/693134": dune });

  const result = await identify({ url: "https://letterboxd.com/film/dune-part-two/" }, tmdb);

  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["web"] });
  expect(result.clues.title).toBe("Dune: Part Two (2024)");
  expect(result.candidates.map((c) => c.tmdbId)).toEqual([693134]);
});

test("a page without any id: no match yet, but its clues are kept", async () => {
  fakeFetch({
    "/blog/review": "<html><head><title>My review</title></head><body>Great film</body></html>",
  });
  const result = await identify({ url: "https://example.com/blog/review" }, tmdb);
  expect(result).toMatchObject({
    status: "NO_MATCH",
    extractors: ["web"],
    clues: { title: "My review" },
  });
});

test("a page that cannot be read does not fail the Identification", async () => {
  fakeFetch({ "/reel/abc": 403 });
  const result = await identify({ url: "https://www.instagram.com/reel/abc" }, tmdb);
  expect(result).toMatchObject({ status: "NO_MATCH", extractors: [] });
});
