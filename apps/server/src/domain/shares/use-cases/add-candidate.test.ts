import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import {
  getGetMovieMovieIdResponseMock,
  getPostRequestResponseMock,
} from "../../../integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import { WebhookRepository } from "../../webhooks/repository";
import { WebhookSender } from "../../webhooks/sender";
import { ShareRepository } from "../repository";
import { addCandidate } from "./add-candidate";

afterEach(() => mock.restore());

// A finished Share with one Candidate, Due Date; Seerr set in the Settings and
// a Webhook listening to media.added.
async function shareWithDueDate() {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({ seerr: { url: "http://seerr.test", apiKey: "key" } });
  const webhooks = new WebhookRepository(db);
  await webhooks.save("", { url: "http://ha.local/hook", events: ["media.added"], secret: "" });
  const sender = new WebhookSender(webhooks, async () => "");
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
  return { shares, id, deps: { shares, settings, sender } };
}
const dueDate = { tmdbId: 41733, type: "MOVIE" as const };

// The paths fetched, in order: Seerr's and the Webhook's.
const paths = (fetch: { mock: { calls: unknown[][] } }) =>
  fetch.mock.calls.map(([url]) => new URL(String(url)).pathname);

test("an absent Candidate is requested from Seerr", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  const fetch = fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
    "/hook": {},
  });

  await addCandidate(id, dueDate, deps);

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([
    { tmdbId: 41733, target: "SEERR", status: "REQUESTED", automatic: false },
  ]);
  expect(share?.summary).toBe("REQUESTED");
  // Seerr is asked, then the Webhook hears media.added.
  expect(paths(fetch)).toEqual(["/api/v1/movie/41733", "/api/v1/request", "/hook"]);
});

test("a Candidate already in the library is not requested again", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  const fetch = fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: { status: 5 } }),
  });

  await addCandidate(id, dueDate, deps);

  expect((await shares.get(id))?.additions.map((a) => a.status)).toEqual(["ALREADY_PRESENT"]);
  expect(paths(fetch)).toEqual(["/api/v1/movie/41733"]); // no request, no media.added
});

test("Seerr failing is recorded as a failed Addition, with the reason", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  fakeFetch({ "/api/v1/movie/41733": 503 });

  await addCandidate(id, dueDate, deps);

  const share = await shares.get(id);
  expect(share?.additions).toMatchObject([{ status: "FAILED", error: "Seerr answered 503" }]);
  expect(share?.summary).toBe("FAILED");
});

test("only a Candidate of the Share can be added", async () => {
  const { id, deps } = await shareWithDueDate();
  await expect(addCandidate(id, { tmdbId: 1, type: "MOVIE" }, deps)).rejects.toMatchObject({
    code: "not_found",
  });
  await expect(addCandidate("shr_x", dueDate, deps)).rejects.toMatchObject({
    code: "not_found",
  });
});

test("Radarr or Sonarr directly, or no type, is refused before anything is written", async () => {
  const { shares, id, deps } = await shareWithDueDate();
  await expect(addCandidate(id, { ...dueDate, target: "ARR" }, deps)).rejects.toMatchObject({
    code: "invalid_input",
  });
  await expect(addCandidate(id, { tmdbId: 41733 }, deps)).rejects.toMatchObject({
    code: "invalid_input",
  });
  expect((await shares.get(id))?.additions).toEqual([]);
});
