import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { listWatchLinks } from "./list-watch-links";

afterEach(() => mock.restore());

const TMDB_PAGE = "https://www.themoviedb.org/tv/123/watch?locale=FR";
const JELLYFIN = "http://jellyfin.local/web/index.html#!/details?id=abc";

async function settingsWith(platformIds: number[], country = "") {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await settings.update({
    identification: { tmdbToken: "tmdb" },
    seerr: { url: "http://seerr.test", apiKey: "key" },
    streaming: { platformIds, country },
  });
  return settings;
}

const offers = {
  "/3/tv/123/watch/providers": {
    id: 123,
    results: {
      FR: {
        link: TMDB_PAGE,
        flatrate: [
          { provider_id: 8, provider_name: "Netflix" },
          { provider_id: 283, provider_name: "Crunchyroll", logo_path: "/c.jpg" },
        ],
      },
    },
  },
};

test("only the chosen Platforms that stream the title, after the library", async () => {
  fakeFetch({ ...offers, "/api/v1/tv/123": { mediaInfo: { status: 5, mediaUrl: JELLYFIN } } });

  expect(await listWatchLinks(await settingsWith([283, 337]), "TV", 123)).toEqual([
    { name: "Jellyfin", url: JELLYFIN },
    {
      name: "Crunchyroll",
      url: TMDB_PAGE,
      logoUrl: "https://image.tmdb.org/t/p/w92/c.jpg",
    },
  ]);
});

test("no Platform chosen asks TMDB nothing, and a failing Seerr costs only its link", async () => {
  fakeFetch({ "/api/v1/tv/123": 500 });
  expect(await listWatchLinks(await settingsWith([]), "TV", 123)).toEqual([]);
});

test("a chosen country replaces the TMDB language's", async () => {
  fakeFetch({ ...offers, "/api/v1/tv/123": { mediaInfo: { status: 1 } } });
  expect(await listWatchLinks(await settingsWith([283], "JP"), "TV", 123)).toEqual([]);
});
