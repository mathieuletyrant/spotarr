import { afterEach, expect, mock, test } from "bun:test";
import { Tmdb } from "../../integrations/tmdb/client";
import { getSearchTvResponseMock } from "../../integrations/tmdb/gen/tmdb.faker";
import { fakeFetch } from "../../testing/fake-fetch";
import { confirmOnTmdb } from "./confirm-on-tmdb";
import type { Guesses } from "./guess-titles";

afterEach(() => mock.restore());

const tmdb = new Tmdb({ token: "tok", language: "fr-FR" });

// Real TMDB answers recorded on 2026-10-12, keyed "query|year".
const recorded: Record<string, object> = await Bun.file(
  new URL("fixtures/tmdb-searches.json", import.meta.url),
).json();

function fakeTmdbSearch() {
  fakeFetch({
    "/3/search/movie": (url) => {
      const key = `${url.searchParams.get("query")}|${url.searchParams.get("primary_release_year") ?? ""}`;
      return recorded[key] ?? { page: 1, results: [] };
    },
  });
}

function guess(fields: Partial<Guesses["candidates"][number]>): Guesses["candidates"][number] {
  return {
    title: "",
    originalTitle: null,
    year: null,
    originalLanguage: null,
    type: "movie",
    confidence: 0.9,
    reason: "",
    ...fields,
  };
}

test("Kraken with a wrong year: the French film of the same name, not a namesake of that year", async () => {
  fakeTmdbSearch();
  // What the LLM answered for Mathieu's reel: the right title, the wrong year.
  const candidates = await confirmOnTmdb(
    [guess({ title: "Kraken", originalTitle: "Kraken", year: 2024, originalLanguage: "fr" })],
    tmdb,
  );
  // TMDB's first answer for "Kraken" 2024 is "Kraken Mare" (1558576).
  expect(candidates.map((c) => [c.tmdbId, c.title, c.year])).toEqual([[1571766, "Kraken", 2026]]);
});

test("L'Invitation with an invented original title: the French title still finds it", async () => {
  fakeTmdbSearch();
  // What the LLM answered after hearing the reel: the French title, a made-up original title.
  const candidates = await confirmOnTmdb(
    [
      guess({
        title: "L'invitation",
        originalTitle: "The Goode Family",
        year: 2024,
        originalLanguage: "en",
      }),
    ],
    tmdb,
  );
  expect(candidates.map((c) => [c.tmdbId, c.originalTitle])).toEqual([[950028, "The Invite"]]);
});

test("The Invite dated 2024 by the LLM: the 2026 film, far more popular than its 2024 namesake", async () => {
  fakeTmdbSearch();
  // What the LLM answered once told today's date: right titles, year still 2024.
  const candidates = await confirmOnTmdb(
    [
      guess({
        title: "L'Invitation",
        originalTitle: "The Invite",
        year: 2024,
        originalLanguage: "en",
      }),
    ],
    tmdb,
  );
  // An exact-year "The Invite" (2024, popularity 1.6) exists; the film is 950028 (2026, 39.2).
  expect(candidates.map((c) => [c.tmdbId, c.year])).toEqual([[950028, 2026]]);
});

test("between namesakes of the same era, the original language decides", async () => {
  fakeTmdbSearch();
  const norwegian = await confirmOnTmdb(
    [guess({ title: "Kraken", year: 2026, originalLanguage: "no" })],
    tmdb,
  );
  const french = await confirmOnTmdb(
    [guess({ title: "Kraken", year: 2026, originalLanguage: "fr" })],
    tmdb,
  );
  expect(norwegian[0]?.tmdbId).toBe(1110034);
  expect(french[0]?.tmdbId).toBe(1571766);
});

test("TV shows are searched as TV shows", async () => {
  fakeFetch({
    "/3/search/tv": getSearchTvResponseMock({
      results: [
        { id: 95396, name: "Severance", original_name: "Severance", first_air_date: "2022-02-17" },
      ],
    }),
  });
  const candidates = await confirmOnTmdb([guess({ title: "Severance", type: "tv" })], tmdb);
  expect(candidates).toMatchObject([{ tmdbId: 95396, type: "TV", year: 2022 }]);
});

test("unknown titles are dropped, duplicates merged, best first", async () => {
  fakeTmdbSearch();
  const candidates = await confirmOnTmdb(
    [
      guess({ title: "The Invite", year: 2026, confidence: 0.6 }),
      guess({ title: "Not a film at all", confidence: 0.99 }),
      guess({ title: "Kraken", year: 2026, originalLanguage: "fr", confidence: 0.8 }),
      guess({ title: "L'invitation", year: 2026, confidence: 0.9 }),
    ],
    tmdb,
  );
  expect(candidates.map((c) => [c.tmdbId, c.confidence])).toEqual([
    [950028, 0.9],
    [1571766, 0.8],
  ]);
});
