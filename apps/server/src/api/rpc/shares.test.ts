import { expect, test } from "bun:test";
import { createApp } from "../../app";
import { openDatabase } from "../../db";
import { SettingsRepository } from "../../domain/settings/repository";
import { ShareQueue } from "../../domain/shares/queue";
import { ShareRepository } from "../../domain/shares/repository";
import { identifyNothing, until } from "../../domain/shares/test-helpers";

const db = await openDatabase(":memory:");
const shares = new ShareRepository(db);
const queue = new ShareQueue(shares, identifyNothing, async () => 2);
const app = createApp({
  apiToken: () => "t",
  settings: new SettingsRepository(db),
  shares,
  queue,
});
const call = async (method: string, body: unknown) => {
  const res = await app.request(`/api/spotarr.v1.SpotarrService/${method}`, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("CreateShare answers QUEUED at once, then the Identification runs in the background", async () => {
  const created = await call("CreateShare", { url: "https://www.instagram.com/reel/abc" });
  expect(created.status).toBe(200);
  expect(created.body.share.source).toBe("instagram.com");
  expect(created.body.share.identification.status).toBe("IDENTIFICATION_STATUS_QUEUED");
  expect(created.body.share.summary).toBe("SUMMARY_IN_PROGRESS");

  const id = created.body.share.id;
  await until(async () => {
    const { body } = await call("GetShare", { id });
    return body.share.identification.status === "IDENTIFICATION_STATUS_NO_MATCH";
  });
});

test("CreateShare refuses an empty input or a non-http URL", async () => {
  const empty = await call("CreateShare", {});
  expect(empty.status).toBe(400);
  expect(empty.body.message).toContain("send a url, a text or an image");
  expect((await call("CreateShare", { url: "ftp://x" })).body.code).toBe("invalid_argument");
});

test("GetShare on an unknown id is not_found", async () => {
  expect((await call("GetShare", { id: "shr_nope" })).body.code).toBe("not_found");
});

test("ListShares paginates with next_cursor and filters by summary", async () => {
  for (let i = 0; i < 3; i++) await call("CreateShare", { text: `share ${i}` });
  await until(
    async () => (await shares.list({ limit: 50, summaries: ["IN_PROGRESS"] })).length === 0,
  );

  const first = await call("ListShares", { pageSize: 2 });
  expect(first.body.shares).toHaveLength(2);
  const second = await call("ListShares", { pageSize: 2, cursor: first.body.nextCursor });
  expect(second.body.shares.length).toBeGreaterThan(0);
  expect(second.body.shares[0].id < first.body.shares[1].id).toBe(true);

  const noMatch = await call("ListShares", { summaries: ["SUMMARY_NO_MATCH"] });
  expect(
    noMatch.body.shares.every((s: { summary: string }) => s.summary === "SUMMARY_NO_MATCH"),
  ).toBe(true);
  expect((await call("ListShares", { summaries: ["SUMMARY_ADDED"] })).body.shares).toBeUndefined();
});

test("RetryIdentification queues a finished Share again", async () => {
  const { body } = await call("CreateShare", { text: "retry me" });
  const id = body.share.id;
  await until(async () => (await shares.get(id))?.summary === "NO_MATCH");

  const retried = await call("RetryIdentification", { id });
  expect(retried.status).toBe(200);
  expect([
    "IDENTIFICATION_STATUS_QUEUED",
    "IDENTIFICATION_STATUS_PROCESSING",
    "IDENTIFICATION_STATUS_NO_MATCH",
  ]).toContain(retried.body.share.identification.status);
  expect((await call("RetryIdentification", { id: "shr_nope" })).body.code).toBe("not_found");
});
