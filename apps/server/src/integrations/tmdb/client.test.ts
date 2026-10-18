import { afterEach, expect, mock, test } from "bun:test";
import { fakeFetch } from "../../testing/fake-fetch";
import { Tmdb } from "./client";
import {
  getFindByIdResponseMock,
  getGenreMovieListResponseMock,
  getMovieDetailsResponseMock,
  getSearchMovieResponseMock,
  getTvSeriesDetailsResponseMock,
} from "./gen/tmdb.faker";

afterEach(() => mock.restore());

function tmdb(token = "tok") {
  return new Tmdb({ token, language: "fr-FR" });
}

// Generated from TMDB's spec: every other field gets a random value.
const dune = getMovieDetailsResponseMock({
  id: 693134,
  title: "Dune : Deuxième partie",
  original_title: "Dune: Part Two",
  release_date: "2024-02-27",
  poster_path: "/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
  vote_average: 8.1,
  vote_count: 7012,
});

test("an IMDb id finds a movie, sending the token and the language", async () => {
  const fetch = fakeFetch({
    "/3/find/tt15239678": getFindByIdResponseMock({ movie_results: [dune], tv_results: [] }),
  });

  expect(await tmdb().findByImdbId("tt15239678")).toMatchObject({
    tmdbId: 693134,
    type: "MOVIE",
    title: "Dune : Deuxième partie",
    originalTitle: "Dune: Part Two",
    year: 2024,
    releaseDate: "2024-02-27",
    posterUrl: "https://image.tmdb.org/t/p/w500/qpyaW4xUPeIiYA5ckg5zAZFHvsb.jpg",
    tmdbRating: 8.1,
    tmdbVotes: 7012,
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

  expect(await tmdb().findByImdbId("tt11280740")).toMatchObject({
    tmdbId: 95396,
    type: "TV",
    title: "Severance",
    year: 2022,
  });
});

test("a title nobody rated has no rating, not a zero", async () => {
  fakeFetch({
    "/3/movie/1": getMovieDetailsResponseMock({
      id: 1,
      title: "Unknown",
      vote_average: 0,
      vote_count: 0,
    }),
  });
  const title = await tmdb().movie(1);
  expect(title?.tmdbRating).toBeUndefined();
  expect(title?.tmdbVotes).toBeUndefined();
});

test("an id TMDB does not know gives nothing", async () => {
  fakeFetch({
    "/3/find/tt0000001": getFindByIdResponseMock({ movie_results: [], tv_results: [] }),
    "/3/movie/1": 404,
  });
  const client = tmdb();
  expect(await client.findByImdbId("tt0000001")).toBeUndefined();
  expect(await client.movie(1)).toBeUndefined();
});

test("a refused token is unavailable, naming TMDB", async () => {
  fakeFetch({ "/3/find/tt15239678": 401 });
  await expect(tmdb().findByImdbId("tt15239678")).rejects.toMatchObject({
    code: "unavailable",
    message: "TMDB refused the token (401)",
  });
});

test("a network failure is unavailable too", async () => {
  fakeFetch({});
  await expect(tmdb().findByImdbId("tt15239678")).rejects.toMatchObject({ code: "unavailable" });
});

test("no token configured says where to set it", async () => {
  await expect(tmdb("").findByImdbId("tt15239678")).rejects.toMatchObject({
    code: "not_configured",
    message: "TMDB token not configured (Settings → Identification)",
  });
});

test("a search names its results' genres from TMDB's list, read once", async () => {
  const fetch = fakeFetch({
    "/3/search/movie": getSearchMovieResponseMock({
      results: [{ id: 1, title: "Alien", genre_ids: [27, 878] }],
    }),
    "/3/genre/movie/list": getGenreMovieListResponseMock({
      genres: [
        { id: 27, name: "Horreur" },
        { id: 878, name: "Science-Fiction" },
      ],
    }),
  });
  const client = tmdb();

  expect((await client.searchMovies("Alien"))[0]?.genres).toEqual(["Horreur", "Science-Fiction"]);
  await client.searchMovies("Alien");
  const lists = fetch.mock.calls.filter(([url]) => String(url).includes("/genre/movie/list"));
  expect(lists).toHaveLength(1);
  expect(new URL(String(lists[0]?.[0])).searchParams.get("language")).toBe("fr-FR");
});

test("a title's details name their genres themselves", async () => {
  fakeFetch({
    "/3/movie/693134": { ...dune, genres: [{ id: 878, name: "Science-Fiction" }] },
  });
  expect((await tmdb().movie(693134))?.genres).toEqual(["Science-Fiction"]);
});

test("without TMDB's genre list, a search's genres are unknown, not empty", async () => {
  fakeFetch({
    "/3/search/movie": getSearchMovieResponseMock({
      results: [{ id: 1, title: "Alien", genre_ids: [27] }],
    }),
    "/3/genre/movie/list": 500,
  });
  const [alien] = await tmdb().searchMovies("Alien");
  expect(alien?.title).toBe("Alien");
  expect(alien?.genres).toBeUndefined();
});

test("a title keeps TMDB's overview; an empty one is no overview", async () => {
  fakeFetch({
    "/3/movie/693134": { ...dune, overview: "Paul Atréides s'unit à Chani et aux Fremen." },
    "/3/movie/1": getMovieDetailsResponseMock({ id: 1, title: "Unknown", overview: "" }),
  });
  const client = tmdb();
  expect((await client.movie(693134))?.overview).toBe(
    "Paul Atréides s'unit à Chani et aux Fremen.",
  );
  expect((await client.movie(1))?.overview).toBeUndefined();
});

test("platforms are the country's, movies and TV shows together, in TMDB's order", async () => {
  const fetch = fakeFetch({
    "/3/watch/providers/movie": {
      results: [
        { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priority: 1 },
        { provider_id: 337, provider_name: "Disney Plus", display_priority: 3 },
      ],
    },
    "/3/watch/providers/tv": {
      results: [
        { provider_id: 283, provider_name: "Crunchyroll", display_priority: 2 },
        { provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priority: 1 },
      ],
    },
  });

  expect(await tmdb().platforms()).toEqual([
    { id: 8, name: "Netflix", logoUrl: "https://image.tmdb.org/t/p/w92/n.jpg" },
    { id: 283, name: "Crunchyroll", logoUrl: undefined },
    { id: 337, name: "Disney Plus", logoUrl: undefined },
  ]);
  const [url] = fetch.mock.calls[0] ?? [];
  expect(new URL(String(url)).searchParams.get("watch_region")).toBe("FR");
});

test("a title's watch offers are its country's streams, without rent or buy", async () => {
  fakeFetch({
    "/3/tv/123/watch/providers": {
      id: 123,
      results: {
        FR: {
          link: "https://www.themoviedb.org/tv/123/watch?locale=FR",
          flatrate: [{ provider_id: 283, provider_name: "Crunchyroll" }],
          ads: [{ provider_id: 300, provider_name: "Pluto TV" }],
          buy: [{ provider_id: 2, provider_name: "Apple TV" }],
        },
        US: { flatrate: [{ provider_id: 8, provider_name: "Netflix" }] },
      },
    },
    "/3/movie/1/watch/providers": { id: 1, results: { US: {} } },
    "/3/movie/2/watch/providers": 404,
  });

  expect(await tmdb().watchOffers("TV", 123)).toEqual({
    link: "https://www.themoviedb.org/tv/123/watch?locale=FR",
    platforms: [
      { id: 283, name: "Crunchyroll", logoUrl: undefined },
      { id: 300, name: "Pluto TV", logoUrl: undefined },
    ],
  });
  expect(await tmdb().watchOffers("MOVIE", 1)).toEqual({ platforms: [] });
  expect(await tmdb().watchOffers("MOVIE", 2)).toEqual({ platforms: [] });
});
