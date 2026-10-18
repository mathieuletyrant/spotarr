import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../../shares/repository";
import { watchCandidate } from "./watch-candidate";

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
      candidates: [{ tmdbId: 41733, type: "MOVIE", title: "Date limite", libraryState: "ABSENT" }],
    },
    10,
  );
  return { id, deps: { shares, settings } };
}

test("a Candidate goes to Seerr's watchlist, nothing requested", async () => {
  const { id, deps } = await shareWithDueDate();
  const fetch = fakeFetch({ "/api/v1/watchlist": 201 });
  await watchCandidate(id, 41733, "MOVIE", deps);
  const paths = fetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
  expect(paths).toEqual(["/api/v1/watchlist"]);
});

test("Seerr failing fails the click; an unknown Candidate is not_found", async () => {
  const { id, deps } = await shareWithDueDate();
  fakeFetch({ "/api/v1/watchlist": 500 });
  await expect(watchCandidate(id, 41733, "MOVIE", deps)).rejects.toMatchObject({
    code: "unavailable",
  });
  await expect(watchCandidate(id, 1, "MOVIE", deps)).rejects.toMatchObject({ code: "not_found" });
});
