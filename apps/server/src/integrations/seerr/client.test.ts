import { afterEach, expect, mock, test } from "bun:test";
import { fakeFetch } from "../../testing/fake-fetch";
import { Seerr } from "./client";
import {
  getGetMovieMovieIdResponseMock,
  getGetTvTvIdResponseMock,
  getPostRequestResponseMock,
} from "./gen/seerr.faker";

afterEach(() => mock.restore());

// A trailing slash, as people type it in Settings.
const seerr = new Seerr({ url: "http://umbrel.local:5056/", apiKey: "key" });
const movie = (status?: number) =>
  getGetMovieMovieIdResponseMock({ mediaInfo: status ? { status } : undefined });

test("Seerr's statuses become library states", async () => {
  fakeFetch({
    "/api/v1/movie/1": movie(),
    "/api/v1/movie/2": movie(2),
    "/api/v1/movie/3": movie(3),
    "/api/v1/movie/5": movie(5),
    "/api/v1/tv/4": getGetTvTvIdResponseMock({ mediaInfo: { status: 4 } }),
  });
  expect(await seerr.libraryState("MOVIE", 1)).toBe("ABSENT");
  expect(await seerr.libraryState("MOVIE", 2)).toBe("REQUESTED");
  expect(await seerr.libraryState("MOVIE", 3)).toBe("REQUESTED");
  expect(await seerr.libraryState("TV", 4)).toBe("PARTIAL");
  expect(await seerr.libraryState("MOVIE", 5)).toBe("AVAILABLE");
});

test("the API key is sent, and the trailing slash of the URL is dropped", async () => {
  const fetch = fakeFetch({ "/api/v1/movie/1": movie() });
  await seerr.libraryState("MOVIE", 1);
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(String(url)).toBe("http://umbrel.local:5056/api/v1/movie/1");
  expect(new Headers(init?.headers).get("X-Api-Key")).toBe("key");
});

test("a movie is requested whole, a TV show for its first season only", async () => {
  const bodies: unknown[] = [];
  const fetch = fakeFetch({ "/api/v1/request": getPostRequestResponseMock() });
  await seerr.request("MOVIE", 41733);
  await seerr.request("TV", 95396);
  for (const [, init] of fetch.mock.calls) bodies.push(JSON.parse(String(init?.body)));
  expect(bodies).toEqual([
    { mediaType: "movie", mediaId: 41733 },
    { mediaType: "tv", mediaId: 95396, seasons: [1] },
  ]);
  expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST");
});

test("errors carry a code", async () => {
  fakeFetch({ "/api/v1/movie/9": 500 });
  await expect(seerr.libraryState("MOVIE", 9)).rejects.toMatchObject({
    code: "unavailable",
    message: "Seerr answered 500",
  });
  await expect(new Seerr({ url: "", apiKey: "" }).libraryState("MOVIE", 1)).rejects.toMatchObject({
    code: "not_configured",
  });
});

test("a title goes in and out of the watchlist, already there or not there being fine", async () => {
  const fetch = fakeFetch({
    "/api/v1/watchlist": 409, // already in it
    "/api/v1/watchlist/95396": 404, // not in it
    "/api/v1/watchlist/41733": 204,
  });
  await seerr.addToWatchlist("MOVIE", 41733);
  await seerr.removeFromWatchlist("TV", 95396);
  await seerr.removeFromWatchlist("MOVIE", 41733);

  const [, added] = fetch.mock.calls[0] ?? [];
  expect(added?.method).toBe("POST");
  // Seerr's server reads mediaType, whatever its spec says.
  expect(JSON.parse(String(added?.body))).toEqual({ tmdbId: 41733, mediaType: "movie" });
  const removed = fetch.mock.calls.slice(1).map(([url, init]) => `${init?.method} ${url}`);
  expect(removed).toEqual([
    "DELETE http://umbrel.local:5056/api/v1/watchlist/95396?mediaType=tv",
    "DELETE http://umbrel.local:5056/api/v1/watchlist/41733?mediaType=movie",
  ]);
});

test("a watchlist error other than already there fails", async () => {
  fakeFetch({ "/api/v1/watchlist": 500 });
  await expect(seerr.addToWatchlist("MOVIE", 1)).rejects.toMatchObject({ code: "unavailable" });
});
