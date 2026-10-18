import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import {
  getGetMovieMovieIdResponseMock,
  getPostRequestResponseMock,
} from "../../../integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { RuleRepository } from "../../auto-add/repository";
import { SettingsRepository } from "../../settings/repository";
import type { Event } from "../../shares/events";
import { ShareRepository } from "../../shares/repository";
import { endIdentification } from "./end-identification";

afterEach(() => mock.restore());

test("a READY Share emits identification.ready, then a Rule requests its Candidate", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  const rules = new RuleRepository(db);
  const emitted: Event["name"][] = [];
  const emit = async (event: Event) => {
    emitted.push(event.name);
  };
  await settings.update({ seerr: { url: "http://seerr.test", apiKey: "key" } });
  await rules.save("", { name: "Sure", enabled: true, onlyOne: true, minConfidence: 95 });
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
          tmdbId: 1571766,
          type: "MOVIE",
          title: "Kraken",
          confidence: 0.98,
          libraryState: "ABSENT",
        },
      ],
    },
    10,
  );
  fakeFetch({
    "/api/v1/movie/1571766": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
  });

  await endIdentification(id, { shares, settings, rules, emit });

  expect(emitted).toEqual(["identification.ready", "media.added"]);
  expect((await shares.get(id))?.additions).toMatchObject([
    { status: "REQUESTED", automatic: true, rule: "Sure" },
  ]);
});

test("a Rule with the watchlist action puts its Candidates in Seerr's watchlist, requesting nothing", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  const rules = new RuleRepository(db);
  const emitted: Event["name"][] = [];
  const emit = async (event: Event) => {
    emitted.push(event.name);
  };
  await settings.update({ seerr: { url: "http://seerr.test", apiKey: "key" } });
  await rules.save("", { name: "Spotted", enabled: true, action: "SEERR_WATCHLIST" });
  await rules.save("", { name: "Sure", enabled: true, minConfidence: 95 });
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  const movie = (tmdbId: number, confidence: number) => ({
    tmdbId,
    type: "MOVIE" as const,
    title: String(tmdbId),
    confidence,
    libraryState: "ABSENT" as const,
  });
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [movie(1571766, 0.98), movie(438631, 0.6)],
    },
    10,
  );
  const fetch = fakeFetch({
    "/api/v1/movie/1571766": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
    "/api/v1/watchlist": {},
  });

  await endIdentification(id, { shares, settings, rules, emit });

  // The sure one is requested, even though the watchlist Rule is older.
  expect((await shares.get(id))?.additions).toMatchObject([{ tmdbId: 1571766, rule: "Sure" }]);
  const watched = fetch.mock.calls
    .filter(([url]) => String(url).endsWith("/watchlist"))
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(watched).toEqual([{ tmdbId: 438631, mediaType: "movie" }]);
  expect(emitted).toEqual(["identification.ready", "media.added"]);
});
