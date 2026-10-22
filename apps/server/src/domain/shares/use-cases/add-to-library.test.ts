import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import {
  getGetMovieMovieIdResponseMock,
  getGetTvTvIdResponseMock,
  getPostRequestResponseMock,
} from "../../../integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../repository";
import { addToLibrary } from "./add-to-library";

afterEach(() => mock.restore());

// A finished Share with one Candidate, Due Date; Seerr set in the Settings.
async function shareWithDueDate() {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({ seerr: { url: "http://seerr.test", apiKey: "key" } });
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [
        {
          tmdbId: 41733,
          type: "MOVIE",
          title: "Date limite",
          confidence: 0.9,
          libraryState: "ABSENT",
        },
      ],
    },
    10,
  );
  return { shares, id, deps: { shares, settings } };
}
const dueDate = { tmdbId: 41733, type: "MOVIE" as const };

// The paths fetched from Seerr, in order.
const paths = (fetch: { mock: { calls: unknown[][] } }) =>
  fetch.mock.calls.map(([url]) => new URL(String(url)).pathname);

test("an absent Candidate is requested from Seerr", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  const fetch = fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
  });

  await addToLibrary(id, dueDate, deps);

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([
    { tmdbId: 41733, target: "SEERR", status: "REQUESTED", automatic: false },
  ]);
  expect(share?.candidates[0]?.libraryState).toBe("REQUESTED"); // without waiting for Seerr
  expect(share?.summary).toBe("REQUESTED");
  expect(paths(fetch)).toEqual(["/api/v1/movie/41733", "/api/v1/request"]);
});

test("a Candidate already in the library is not requested again", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  const fetch = fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: { status: 5 } }),
  });

  await addToLibrary(id, dueDate, deps);

  const share = await shares.get(id);
  expect(share?.additions.map((a) => a.status)).toEqual(["ALREADY_PRESENT"]);
  expect(share?.candidates[0]?.libraryState).toBe("AVAILABLE");
  expect(share?.summary).toBe("ALREADY_PRESENT");
  expect(paths(fetch)).toEqual(["/api/v1/movie/41733"]); // no request
});

test("Seerr failing is recorded as a failed Addition, with the reason", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  fakeFetch({ "/api/v1/movie/41733": 503 });

  await addToLibrary(id, dueDate, deps);

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([{ status: "FAILED", error: "Seerr answered 503" }]);
  expect(share?.summary).toBe("FAILED");
});

test("only a Candidate of the Share can be added", async () => {
  const { id, deps } = await shareWithDueDate();
  await expect(addToLibrary(id, { tmdbId: 1, type: "MOVIE" }, deps)).rejects.toMatchObject({
    code: "not_found",
  });
  await expect(addToLibrary("shr_x", dueDate, deps)).rejects.toMatchObject({
    code: "not_found",
  });
});

test("Radarr or Sonarr directly, or no type, is refused before anything is written", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  await expect(addToLibrary(id, { ...dueDate, target: "ARR" }, deps)).rejects.toMatchObject({
    code: "invalid_input",
  });
  await expect(addToLibrary(id, { tmdbId: 41733 }, deps)).rejects.toMatchObject({
    code: "invalid_input",
  });
  expect((await shares.get(id))?.additions).toEqual([]);
});

test("a TV show requested from Seerr also goes on Snug's Watchlist", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({
    seerr: { url: "http://seerr.test", apiKey: "key" },
    snug: { watchlistUrl: "http://snug.test/api/watchlist/token" },
  });
  const id = await shares.create({ url: "https://www.instagram.com/reel/y/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [
        { tmdbId: 95396, type: "TV", title: "Severance", confidence: 0.9, libraryState: "ABSENT" },
      ],
    },
    10,
  );
  const fetch = fakeFetch({
    "/api/v1/tv/95396": getGetTvTvIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
    "/api/watchlist/token": { status: "watchlist", added: true },
  });

  await addToLibrary(id, { tmdbId: 95396, type: "TV" }, { shares, settings });

  expect(paths(fetch)).toEqual(["/api/v1/tv/95396", "/api/v1/request", "/api/watchlist/token"]);
  expect((await shares.get(id))?.additions.map((a) => a.status)).toEqual(["REQUESTED"]);
});
