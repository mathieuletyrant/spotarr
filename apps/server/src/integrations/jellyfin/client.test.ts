import { afterEach, expect, mock, test } from "bun:test";
import { fakeFetch } from "../../testing/fake-fetch";
import { Jellyfin } from "./client";
import {
  getCreateCollectionResponseMock,
  getGetSystemInfoResponseMock,
  getGetUsersResponseMock,
} from "./gen/jellyfin.faker";

afterEach(() => mock.restore());

// A trailing slash, as people type it in Settings.
const jellyfin = new Jellyfin({ url: "http://umbrel.local:8096/", apiKey: "key" });

test("the API key goes in the Authorization header Jellyfin documents", async () => {
  const fetch = fakeFetch({ "/System/Info": getGetSystemInfoResponseMock({ Version: "12.2.0" }) });
  expect(await jellyfin.version()).toBe("12.2.0");
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(String(url)).toBe("http://umbrel.local:8096/System/Info");
  expect(new Headers(init?.headers).get("Authorization")).toBe('MediaBrowser Token="key"');
});

test("a user is found by name, whatever its case", async () => {
  fakeFetch({
    "/Users": [
      { ...getGetUsersResponseMock()[0], Name: "Léa", Id: "u1" },
      { ...getGetUsersResponseMock()[0], Name: "Mathieu", Id: "u2" },
    ],
  });
  expect(await jellyfin.userId("mathieu")).toBe("u2");
  await expect(jellyfin.userId("Paul")).rejects.toMatchObject({
    code: "not_configured",
    message: 'Jellyfin has no user named "Paul"',
  });
});

test("the library lists movies and series by TMDB id, with what the user watched", async () => {
  const fetch = fakeFetch({
    "/Items": {
      Items: [
        { Id: "m1", Type: "Movie", ProviderIds: { Tmdb: "550" }, UserData: { Played: true } },
        { Id: "s1", Type: "Series", ProviderIds: { Tmdb: "95396" }, UserData: { Played: false } },
        // No TMDB id: it cannot be matched to a Candidate.
        { Id: "m2", Type: "Movie", ProviderIds: { Imdb: "tt0137523" } },
      ],
    },
  });
  expect(await jellyfin.library("u2")).toEqual([
    { id: "m1", type: "MOVIE", tmdbId: 550, played: true },
    { id: "s1", type: "TV", tmdbId: 95396, played: false },
  ]);
  const url = new URL(String(fetch.mock.calls[0]?.[0]));
  expect(url.searchParams.get("userId")).toBe("u2");
  expect(url.searchParams.getAll("includeItemTypes")).toEqual(["Movie", "Series"]);
  expect(url.searchParams.getAll("fields")).toEqual(["ProviderIds"]);
});

test("a collection is found by its exact name, with what it holds", async () => {
  fakeFetch({
    "/Items": (url) => {
      if (url.searchParams.get("parentId") === "c2") return { Items: [{ Id: "m1" }, { Id: "s1" }] };
      return {
        Items: [
          { Id: "c1", Name: "spotted" },
          { Id: "c2", Name: "Spotted" },
        ],
      };
    },
  });
  expect(await jellyfin.collection("Spotted", "u2")).toEqual({ id: "c2", itemIds: ["m1", "s1"] });
  expect(await jellyfin.collection("Watch later", "u2")).toBeUndefined();
});

test("a collection is created, filled and emptied", async () => {
  const fetch = fakeFetch({
    "/Collections": getCreateCollectionResponseMock({ Id: "c3" }),
    "/Collections/c3/Items": 204,
  });
  expect(await jellyfin.createCollection("Spotted")).toBe("c3");
  await jellyfin.addToCollection("c3", ["m1", "s1"]);
  await jellyfin.removeFromCollection("c3", ["m2"]);
  // Nothing to add: no call.
  await jellyfin.addToCollection("c3", []);

  const calls = fetch.mock.calls.map(([url, init]) => `${init?.method} ${url}`);
  expect(calls).toEqual([
    "POST http://umbrel.local:8096/Collections?name=Spotted",
    "POST http://umbrel.local:8096/Collections/c3/Items?ids=m1&ids=s1",
    "DELETE http://umbrel.local:8096/Collections/c3/Items?ids=m2",
  ]);
});

test("errors carry a code", async () => {
  fakeFetch({ "/System/Info": 401 });
  await expect(jellyfin.version()).rejects.toMatchObject({
    code: "unavailable",
    message: "Jellyfin refused the API key (401)",
  });
  await expect(new Jellyfin({ url: "", apiKey: "" }).version()).rejects.toMatchObject({
    code: "not_configured",
  });
});
