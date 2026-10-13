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
import { endIdentification } from "./end-identification";

afterEach(() => mock.restore());

test("a READY Share: the Webhooks hear about it, then auto add requests its Candidate", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  const webhooks = new WebhookRepository(db);
  const sender = new WebhookSender(webhooks, async () => "");
  await settings.update({
    seerr: { url: "http://seerr.test", apiKey: "key" },
    autoAdd: { enabled: true, minConfidence: 95, onlyOne: true },
  });
  await webhooks.save("", {
    url: "http://ha.local/hook",
    events: ["identification.ready", "media.added"],
    secret: "",
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
  const fetch = fakeFetch({
    "/hook": {},
    "/api/v1/movie/1571766": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
  });

  await endIdentification(id, { shares, settings, sender });

  const events = fetch.mock.calls
    .filter(([url]) => String(url).endsWith("/hook"))
    .map(([, init]) => JSON.parse(String(init?.body)).event);
  expect(events).toEqual(["identification.ready", "media.added"]);
  expect((await shares.get(id))?.additions).toMatchObject([
    { status: "REQUESTED", automatic: true },
  ]);
});
