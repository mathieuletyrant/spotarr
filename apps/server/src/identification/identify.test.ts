import { expect, test } from "bun:test";
import { TmdbClient } from "../tmdb/client";
import { fakeTmdbFetch } from "../tmdb/fake";
import { createIdentify } from "./identify";

function identify() {
  const fake = fakeTmdbFetch();
  const tmdb = new TmdbClient({ token: "tok", language: "fr-FR", fetch: fake.fetch });
  return { identify: createIdentify(async () => tmdb), requests: fake.requests };
}

test("an IMDb link gives a certain Candidate, without LLM", async () => {
  const result = await identify().identify({ url: "https://www.imdb.com/title/tt15239678/" });
  expect(result).toMatchObject({ status: "READY", method: "DIRECT_ID", extractors: ["id-link"] });
  expect(result.candidates).toEqual([
    {
      tmdbId: 693134,
      type: "MOVIE",
      title: "Dune : Deuxième partie",
      originalTitle: "Dune: Part Two",
      year: 2024,
      posterUrl: "https://image.tmdb.org/t/p/w500/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
      libraryState: "ABSENT",
    },
  ]);
});

test("a TMDB link in a text is followed too", async () => {
  const result = await identify().identify({
    text: "à voir : https://www.themoviedb.org/tv/95396",
  });
  expect(result.candidates.map((c) => c.title)).toEqual(["Severance"]);
});

test("IMDb and TMDB links to the same title give one Candidate", async () => {
  const text = "imdb.com/title/tt15239678 themoviedb.org/movie/693134";
  expect((await identify().identify({ text })).candidates).toHaveLength(1);
});

test("no link: no match, and TMDB is not called", async () => {
  const { identify: run, requests } = identify();
  expect((await run({ url: "https://www.instagram.com/reel/abc" })).status).toBe("NO_MATCH");
  expect(requests).toHaveLength(0);
});

test("a link TMDB does not know: no match", async () => {
  expect((await identify().identify({ url: "https://imdb.com/title/tt0000001" })).status).toBe(
    "NO_MATCH",
  );
});
