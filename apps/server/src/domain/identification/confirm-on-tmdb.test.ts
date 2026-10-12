import { afterEach, expect, mock, test } from "bun:test";
import { Tmdb } from "../../integrations/tmdb/client";
import {
  getSearchMovieResponseMock,
  getSearchTvResponseMock,
} from "../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../testing/fake-fetch";
import { confirmOnTmdb } from "./confirm-on-tmdb";

afterEach(() => mock.restore());

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });
const noResults = getSearchMovieResponseMock({ results: [] });
const found = (id: number, title: string, release_date: string) =>
  getSearchMovieResponseMock({ results: [{ id, title, release_date }] });

test("the original title and year are tried first", async () => {
  const fetch = fakeFetch({
    "/3/search/movie": found(398818, "Call Me by Your Name", "2017-10-27"),
  });

  const candidates = await confirmOnTmdb(
    [
      {
        title: "Appelle-moi par ton nom",
        originalTitle: "Call Me by Your Name",
        year: 2017,
        type: "movie",
        confidence: 0.8,
        reason: "",
      },
    ],
    tmdb,
  );

  expect(candidates).toMatchObject([{ tmdbId: 398818, confidence: 0.8, libraryState: "ABSENT" }]);
  const url = new URL(String(fetch.mock.calls[0]?.[0]));
  expect(url.searchParams.get("query")).toBe("Call Me by Your Name");
  expect(url.searchParams.get("primary_release_year")).toBe("2017");
});

test("then the title with the year, then the title alone", async () => {
  const queries: string[] = [];
  fakeFetch({
    "/3/search/movie": (url) => {
      queries.push(
        `${url.searchParams.get("query")} ${url.searchParams.get("primary_release_year") ?? "-"}`,
      );
      return url.searchParams.has("primary_release_year")
        ? noResults
        : found(1, "Date limite", "2010-11-03");
    },
  });

  const candidates = await confirmOnTmdb(
    [
      {
        title: "Date limite",
        originalTitle: "Due Date",
        year: 2009,
        type: "movie",
        confidence: 0.9,
        reason: "",
      },
    ],
    tmdb,
  );

  expect(queries).toEqual(["Due Date 2009", "Date limite 2009", "Date limite -"]);
  expect(candidates.map((c) => c.title)).toEqual(["Date limite"]);
});

test("TV shows are searched as TV shows", async () => {
  fakeFetch({
    "/3/search/tv": getSearchTvResponseMock({
      results: [{ id: 95396, name: "Severance", first_air_date: "2022-02-17" }],
    }),
  });
  const candidates = await confirmOnTmdb(
    [
      {
        title: "Severance",
        originalTitle: null,
        year: null,
        type: "tv",
        confidence: 0.7,
        reason: "",
      },
    ],
    tmdb,
  );
  expect(candidates).toMatchObject([{ tmdbId: 95396, type: "TV", year: 2022 }]);
});

test("unknown titles are dropped, duplicates merged, best first", async () => {
  fakeFetch({
    "/3/search/movie": (url) => {
      const query = url.searchParams.get("query");
      if (query === "Marriage Story") return found(492188, "Marriage Story", "2019-11-06");
      if (query === "Due Date") return found(41733, "Date limite", "2010-11-03");
      return noResults;
    },
  });
  const guess = (title: string, confidence: number) => ({
    title,
    originalTitle: null,
    year: null,
    type: "movie" as const,
    confidence,
    reason: "",
  });

  const candidates = await confirmOnTmdb(
    [
      guess("Due Date", 0.6),
      guess("Not a film", 0.99),
      guess("Marriage Story", 0.8),
      guess("Due Date", 0.9),
    ],
    tmdb,
  );

  expect(candidates.map((c) => [c.title, c.confidence])).toEqual([
    ["Date limite", 0.9],
    ["Marriage Story", 0.8],
  ]);
});
