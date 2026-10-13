import { afterEach, expect, mock, test } from "bun:test";
import { openDatabase } from "../../../db";
import {
  getGetMovieMovieIdResponseMock,
  getPostRequestResponseMock,
} from "../../../integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "../../../testing/fake-fetch";
import { SettingsRepository } from "../../settings/repository";
import type { Event } from "../events";
import { ShareRepository } from "../repository";
import { endIdentification } from "./end-identification";

afterEach(() => mock.restore());

test("a READY Share emits identification.ready, then auto add requests its Candidate", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  const emitted: Event["name"][] = [];
  const emit = async (event: Event) => {
    emitted.push(event.name);
  };
  await settings.update({
    seerr: { url: "http://seerr.test", apiKey: "key" },
    autoAdd: { enabled: true, minConfidence: 95, onlyOne: true },
  });
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

  await endIdentification(id, { shares, settings, emit });

  expect(emitted).toEqual(["identification.ready", "media.added"]);
  expect((await shares.get(id))?.additions).toMatchObject([
    { status: "REQUESTED", automatic: true },
  ]);
});
