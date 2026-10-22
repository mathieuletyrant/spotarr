import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../../shares/repository";
import { addToSnug } from "./add-to-snug";

afterEach(() => mock.restore());

// A finished Share with one TV show and one movie; Snug set unless told otherwise.
async function share(watchlistUrl = "http://snug.test/api/watchlist/token") {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({ snug: { watchlistUrl } });
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
        {
          tmdbId: 41733,
          type: "MOVIE",
          title: "Date limite",
          confidence: 0.5,
          libraryState: "ABSENT",
        },
      ],
    },
    10,
  );
  return { id, deps: { shares, settings } };
}

test("a TV show goes on Snug's Watchlist, with its TMDB id", async () => {
  const { id, deps } = await share();
  const fetch = fakeFetch({ "/api/watchlist/token": { status: "watchlist", added: true } });

  await addToSnug(id, { tmdbId: 95396, type: "TV" }, deps);

  const [, init] = fetch.mock.calls[0] ?? [];
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ tmdbId: 95396 });
});

test("a movie, a title not in the Share, or Snug not set is refused before calling Snug", async () => {
  const fetch = fakeFetch({});
  const { id, deps } = await share();
  await expect(addToSnug(id, { tmdbId: 41733, type: "MOVIE" }, deps)).rejects.toThrow("TV shows");
  await expect(addToSnug(id, { tmdbId: 1, type: "TV" }, deps)).rejects.toThrow("no candidate");
  const off = await share("");
  await expect(addToSnug(off.id, { tmdbId: 95396, type: "TV" }, off.deps)).rejects.toThrow(
    "not set",
  );
  expect(fetch).not.toHaveBeenCalled();
});

test("Snug refusing the URL says to copy it again", async () => {
  const { id, deps } = await share();
  fakeFetch({ "/api/watchlist/token": 404 });
  await expect(addToSnug(id, { tmdbId: 95396, type: "TV" }, deps)).rejects.toThrow("copy it again");
});
