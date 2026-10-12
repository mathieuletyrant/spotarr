import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../db";
import { SettingsRepository } from "../../domain/settings/repository";
import { fakeFetch } from "../../testing/fake-fetch";
import { Tmdb } from "./client";
import {
  getFindByIdResponseMock,
  getMovieDetailsResponseMock,
  getTvSeriesDetailsResponseMock,
} from "./gen/tmdb.faker";

afterEach(() => mock.restore());

async function tmdb(token = "tok") {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await settings.update({ identification: { tmdbToken: token } });
  return new Tmdb(settings);
}

// Generated from TMDB's spec: every other field gets a random value.
const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  original_title: "Dune: Part Two",
  release_date: "2024-02-27",
  poster_path: "/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
});

test("an IMDb id finds a movie, sending the token and the language", async () => {
  const fetch = fakeFetch({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune], tv_results: [] }),
  });

  expect(await (await tmdb()).findByImdbId("tt15239678")).toEqual({
    tmdbId: 693134,
    type: "MOVIE",
    title: "Dune : Deuxième partie",
    originalTitle: "Dune: Part Two",
    year: 2024,
    posterUrl: "https://image.tmdb.org/t/p/w500/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
  });

  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(new URL(String(url)).searchParams.get("language")).toBe("fr-FR");
  expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
});

test("an IMDb id of a TV show is completed with the show's details", async () => {
  fakeFetch({
    "/3/find/tt11280740": getFindByIdResponseMock({
      movie_results: [],
      tv_results: [{ id: 95396 }],
    }),
    "/3/tv/95396": getTvSeriesDetailsResponseMock({
      id: 95396,
      name: "Severance",
      first_air_date: "2022-02-17",
    }),
  });

  expect(await (await tmdb()).findByImdbId("tt11280740")).toMatchObject({
    tmdbId: 95396,
    type: "TV",
    title: "Severance",
    year: 2022,
  });
});

test("an id TMDB does not know gives nothing", async () => {
  fakeFetch({
    "/3/find/tt0000001": getFindByIdResponseMock({ movie_results: [], tv_results: [] }),
    "/3/movie/1": 404,
  });
  const client = await tmdb();
  expect(await client.findByImdbId("tt0000001")).toBeUndefined();
  expect(await client.movie(1)).toBeUndefined();
});

test("a refused token names TMDB", async () => {
  fakeFetch({ "/3/find/tt15239678": 401 });
  await expect((await tmdb()).findByImdbId("tt15239678")).rejects.toThrow("TMDB answered 401");
});

test("no token configured says where to set it", async () => {
  await expect((await tmdb("")).findByImdbId("tt15239678")).rejects.toThrow(
    "Settings → Identification",
  );
});
