import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { addToSnug } from "./add-to-snug";

afterEach(() => mock.restore());

async function settingsWithSnug(watchlistUrl: string) {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await settings.update({ snug: { watchlistUrl } });
  return settings;
}

test("a TV show goes on Snug's Watchlist, with its TMDB id", async () => {
  const settings = await settingsWithSnug("http://snug.test/api/watchlist/token");
  const fetch = fakeFetch({ "/api/watchlist/token": { status: "watchlist", added: true } });

  await addToSnug("share", { tmdbId: 95396, type: "TV" }, settings);

  expect(fetch).toHaveBeenCalledTimes(1);
  const [, init] = fetch.mock.calls[0] ?? [];
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ tmdbId: 95396 });
});

test("a movie, or Snug left empty, calls nothing", async () => {
  const fetch = fakeFetch({});

  await addToSnug(
    "share",
    { tmdbId: 41733, type: "MOVIE" },
    await settingsWithSnug("http://snug.test/api/watchlist/token"),
  );
  await addToSnug("share", { tmdbId: 95396, type: "TV" }, await settingsWithSnug(""));

  expect(fetch).not.toHaveBeenCalled();
});

test("Snug failing or refusing the URL never throws", async () => {
  const settings = await settingsWithSnug("http://snug.test/api/watchlist/token");
  for (const answer of [500, 404]) {
    fakeFetch({ "/api/watchlist/token": answer });
    await expect(
      addToSnug("share", { tmdbId: 95396, type: "TV" }, settings),
    ).resolves.toBeUndefined();
    mock.restore();
  }
});
