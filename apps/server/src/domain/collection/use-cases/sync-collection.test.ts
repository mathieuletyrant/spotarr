import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../../shares/repository";
import { syncCollection } from "./sync-collection";

afterEach(() => mock.restore());

// A Share whose Candidate Date limite (41733) was requested, and Jellyfin set
// in the Settings for the user Mathieu.
async function spottedDueDate() {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({
    jellyfin: { url: "http://jellyfin.test", apiKey: "key", user: "mathieu" },
  });
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.addAddition(id, {
    tmdbId: 41733,
    type: "MOVIE",
    target: "SEERR",
    status: "REQUESTED",
    automatic: false,
  });
  return { shares, settings };
}

// Jellyfin with Date limite (m1, watched or not), a film nobody spotted (m9),
// and the Collection when `collection` lists what it holds.
function fakeJellyfin({ played, collection }: { played: boolean; collection?: string[] }) {
  return fakeFetch({
    "/Users": [{ Name: "Mathieu", Id: "u1" }],
    "/Items": (url) => {
      const types = url.searchParams.getAll("includeItemTypes");
      if (types.includes("BoxSet")) {
        return { Items: collection ? [{ Id: "c1", Name: "Spotted" }] : [] };
      }
      if (url.searchParams.get("parentId") === "c1") {
        return { Items: (collection ?? []).map((id) => ({ Id: id })) };
      }
      return {
        Items: [
          { Id: "m1", Type: "Movie", ProviderIds: { Tmdb: "41733" }, UserData: { Played: played } },
          { Id: "m9", Type: "Movie", ProviderIds: { Tmdb: "550" }, UserData: { Played: false } },
        ],
      };
    },
    "/Collections": { Id: "c1" },
    "/Collections/c1/Items": 204,
  });
}

// The calls that change something in Jellyfin.
const writes = (fetch: { mock: { calls: [unknown, RequestInit?][] } }) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method !== "GET")
    .map(
      ([url, init]) =>
        `${init?.method} ${new URL(String(url)).pathname}${new URL(String(url)).search}`,
    );

test("the first sync creates the Collection and puts the spotted title in it", async () => {
  const deps = await spottedDueDate();
  const fetch = fakeJellyfin({ played: false });
  expect(await syncCollection(deps)).toEqual({
    collection: "Spotted",
    titles: 1,
    added: 1,
    removed: 0,
    watched: 0,
    notInJellyfin: 0,
  });
  expect(writes(fetch)).toEqual([
    "POST /Collections?name=Spotted",
    "POST /Collections/c1/Items?ids=m1",
  ]);
});

test("once watched, the title leaves the Collection", async () => {
  const deps = await spottedDueDate();
  const fetch = fakeJellyfin({ played: true, collection: ["m1"] });
  const result = await syncCollection(deps);
  expect(result).toMatchObject({ titles: 0, removed: 1, watched: 1 });
  expect(writes(fetch)).toEqual(["DELETE /Collections/c1/Items?ids=m1"]);
});

test("already in line: nothing is written", async () => {
  const deps = await spottedDueDate();
  const fetch = fakeJellyfin({ played: false, collection: ["m1"] });
  expect(await syncCollection(deps)).toMatchObject({ titles: 1, added: 0, removed: 0 });
  expect(writes(fetch)).toEqual([]);
});

test("two syncs at once make one, so the Collection is never created twice", async () => {
  const deps = await spottedDueDate();
  const fetch = fakeJellyfin({ played: false });
  await Promise.all([syncCollection(deps), syncCollection(deps)]);
  expect(writes(fetch).filter((call) => call.startsWith("POST /Collections?"))).toHaveLength(1);
});

test("without a user, the sync says what is missing", async () => {
  const deps = await spottedDueDate();
  await deps.settings.update({ jellyfin: { user: "" } });
  await expect(syncCollection(deps)).rejects.toMatchObject({ code: "not_configured" });
});
