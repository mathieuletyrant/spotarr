import { expect, test } from "bun:test";
import { TmdbClient } from "./client";
import { fakeTmdbFetch } from "./fake";

const dune = {
  tmdbId: 693134,
  type: "MOVIE",
  title: "Dune : Deuxième partie",
  originalTitle: "Dune: Part Two",
  year: 2024,
  posterUrl: "https://image.tmdb.org/t/p/w500/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
};

function client() {
  const fake = fakeTmdbFetch();
  return { tmdb: new TmdbClient({ token: "tok", language: "fr-FR", fetch: fake.fetch }), ...fake };
}

test("an IMDb id finds a movie, with the token and the language sent", async () => {
  const { tmdb, requests } = client();
  expect(await tmdb.findByImdbId("tt15239678")).toEqual(dune as never);
  expect(requests[0]?.searchParams.get("external_source")).toBe("imdb_id");
  expect(requests[0]?.searchParams.get("language")).toBe("fr-FR");
});

test("an IMDb id can be a TV show", async () => {
  const { tmdb } = client();
  expect(await tmdb.findByImdbId("tt11280740")).toMatchObject({
    tmdbId: 95396,
    type: "TV",
    year: 2022,
  });
});

test("an IMDb id TMDB does not know gives nothing", async () => {
  const { tmdb } = client();
  expect(await tmdb.findByImdbId("tt0000001")).toBeUndefined();
});

test("details read movies and TV shows, and a 404 gives nothing", async () => {
  const { tmdb } = client();
  expect(await tmdb.details("MOVIE", 693134)).toEqual(dune as never);
  expect(await tmdb.details("TV", 95396)).toMatchObject({
    title: "Severance",
    originalTitle: "Severance",
  });
  expect(await tmdb.details("MOVIE", 1)).toBeUndefined();
});

test("any other error status names TMDB", async () => {
  const tmdb = new TmdbClient({
    token: "bad",
    language: "fr-FR",
    fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch,
  });
  await expect(tmdb.findByImdbId("tt15239678")).rejects.toThrow("TMDB answered 401");
});
