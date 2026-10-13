import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { openDatabase } from "../../db";
import { fakeFetch } from "../../testing/fake-fetch";
import { SettingsRepository } from "../settings/repository";
import { WebhookRepository } from "../webhooks/repository";
import { WebhookSender } from "../webhooks/sender";
import { type Identify, ShareQueue } from "./queue";
import { ShareRepository } from "./repository";
import { deferred, until } from "./test-helpers";
import type { IdentificationResult } from "./types";

afterEach(() => mock.restore());

const noMatch: IdentificationResult = {
  status: "NO_MATCH",
  extractors: [],
  clues: {},
  candidates: [],
};

// A queue on a fresh database, with the default Settings (concurrency 2).
async function setUp(identify: Identify) {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  const webhooks = new WebhookRepository(db);
  const sender = new WebhookSender(webhooks, async () => "");
  const queue = new ShareQueue({ shares, settings, sender, identify });
  return { shares, settings, webhooks, queue };
}

test("at most `concurrency` Identifications run at once, and all of them finish", async () => {
  const gate = deferred<void>();
  let running = 0;
  let peak = 0;
  const { shares, queue } = await setUp(async () => {
    running++;
    peak = Math.max(peak, running);
    await gate.promise;
    running--;
    return noMatch;
  });

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    ids.push(await shares.create({ text: `share ${i}` }, "text"));
    queue.wake();
  }
  await until(async () => running === 2);
  const statuses = async () =>
    Promise.all(ids.map(async (id) => (await shares.get(id))?.identification.status));
  expect(await statuses()).toEqual(["PROCESSING", "PROCESSING", "QUEUED"]);

  gate.resolve();
  await until(async () => (await statuses()).every((s) => s === "NO_MATCH"));
  expect(peak).toBe(2);
});

test("an Identification that throws ends FAILED with its error", async () => {
  const { shares, queue } = await setUp(async () => {
    throw new Error("TMDB unreachable");
  });
  const id = await shares.create({ text: "x" }, "text");
  queue.wake();

  await until(async () => (await shares.get(id))?.identification.status === "FAILED");
  expect((await shares.get(id))?.identification.error).toBe("TMDB unreachable");
});

test("start() resumes an Identification interrupted by a restart", async () => {
  const { shares, queue } = await setUp(async () => noMatch);
  const id = await shares.create({ text: "x" }, "text");
  await shares.claimNext(); // the previous process took it, then died
  expect((await shares.get(id))?.identification.status).toBe("PROCESSING");

  await queue.start();

  await until(async () => (await shares.get(id))?.identification.status === "NO_MATCH");
});

test("an ended Identification reaches the Webhooks, failed ones included", async () => {
  const { shares, webhooks, queue } = await setUp(async () => {
    throw new Error("yt-dlp failed");
  });
  await webhooks.save("", {
    url: "http://ha.local/hook",
    events: ["identification.failed"],
    secret: "",
  });
  const fetch = fakeFetch({ "/hook": {} });
  const id = await shares.create({ text: "x" }, "text");
  queue.wake();

  await until(async () => fetch.mock.calls.length === 1);
  const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
  expect(body).toMatchObject({ event: "identification.failed", shareId: id });
});

test("a database error while claiming gives the slot back", async () => {
  const { shares, settings, queue } = await setUp(async () => noMatch);
  await settings.update({ extraction: { concurrency: 1 } });
  const claim = spyOn(shares, "claimNext").mockRejectedValueOnce(new Error("database is locked"));

  queue.wake(); // fails, and must not keep the only slot
  await until(async () => claim.mock.calls.length === 1);
  const id = await shares.create({ text: "x" }, "text");
  queue.wake();

  await until(async () => (await shares.get(id))?.identification.status === "NO_MATCH");
});
