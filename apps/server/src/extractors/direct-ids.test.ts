import { expect, test } from "bun:test";
import { findDirectIds } from "./direct-ids";

test.each([
  ["https://www.imdb.com/title/tt15239678/", [{ source: "imdb", id: "tt15239678" }]],
  [
    "https://m.imdb.com/fr/title/tt15239678/?ref_=nv_sr_srsg_0",
    [{ source: "imdb", id: "tt15239678" }],
  ],
  [
    "https://www.themoviedb.org/movie/693134-dune-part-two",
    [{ source: "tmdb", type: "MOVIE", id: 693134 }],
  ],
  [
    "https://www.themoviedb.org/tv/95396-severance?language=fr",
    [{ source: "tmdb", type: "TV", id: 95396 }],
  ],
  [
    "regarde ça https://imdb.com/title/tt0816692 c'est génial",
    [{ source: "imdb", id: "tt0816692" }],
  ],
  ["https://www.instagram.com/reel/abc", []],
  ["https://www.imdb.com/name/nm0614165/", []],
])("%s", (text, expected) => {
  expect(findDirectIds(text)).toEqual(expected as never);
});

test("the same title linked twice counts once", () => {
  const text = "imdb.com/title/tt0816692 and IMDB.com/title/TT0816692";
  expect(findDirectIds(text)).toEqual([{ source: "imdb", id: "tt0816692" }]);
});

test("a page linking many titles keeps the first 4", () => {
  const text = [1, 2, 3, 4, 5].map((n) => `themoviedb.org/movie/${n}`).join(" ");
  expect(findDirectIds(text).map((d) => d.source === "tmdb" && d.id)).toEqual([1, 2, 3, 4]);
});
