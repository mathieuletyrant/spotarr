import { expect, test } from "bun:test";
import { findDirectIds } from "./direct-ids";

test("IMDb links, with or without language and query string", () => {
  expect(findDirectIds("https://www.imdb.com/title/tt15239678/")).toEqual([
    { source: "imdb", id: "tt15239678" },
  ]);
  expect(findDirectIds("https://m.imdb.com/fr/title/tt15239678/?ref_=nv_sr_1")).toEqual([
    { source: "imdb", id: "tt15239678" },
  ]);
});

test("TMDB links to a movie or a TV show", () => {
  expect(findDirectIds("https://www.themoviedb.org/movie/693134-dune-part-two")).toEqual([
    { source: "tmdb", type: "MOVIE", id: 693134 },
  ]);
  expect(findDirectIds("https://www.themoviedb.org/tv/95396-severance")).toEqual([
    { source: "tmdb", type: "TV", id: 95396 },
  ]);
});

test("a link inside a text", () => {
  expect(findDirectIds("regarde https://imdb.com/title/tt0816692 c'est génial")).toEqual([
    { source: "imdb", id: "tt0816692" },
  ]);
});

test("anything else gives nothing", () => {
  expect(findDirectIds("https://www.instagram.com/reel/abc")).toEqual([]);
  expect(findDirectIds("https://www.imdb.com/name/nm0614165/")).toEqual([]);
});

test("a page linking many titles keeps the first 4", () => {
  const text =
    "themoviedb.org/movie/1 themoviedb.org/movie/2 themoviedb.org/movie/3 themoviedb.org/movie/4 themoviedb.org/movie/5";
  expect(findDirectIds(text)).toHaveLength(4);
});

test("the same link twice is one title", () => {
  const text = "https://www.imdb.com/title/tt0816692/\nregarde https://imdb.com/title/tt0816692";
  expect(findDirectIds(text)).toEqual([{ source: "imdb", id: "tt0816692" }]);
});
