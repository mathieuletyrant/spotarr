import { expect, test } from "bun:test";
import { openDatabase } from "../../db";
import { ShareQueue } from "./queue";
import { ShareRepository } from "./repository";
import { deferred, until } from "./test-helpers";
import type { IdentificationResult } from "./types";

const noMatch: IdentificationResult = {
  status: "NO_MATCH",
  extractors: [],
  clues: {},
  candidates: [],
};

test("at most `concurrency` Identifications run at once, and all of them finish", async () => {
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const gate = deferred<void>();
  let running = 0;
  let peak = 0;
  const queue = new ShareQueue(
    shares,
    async () => {
      running++;
      peak = Math.max(peak, running);
      await gate.promise;
      running--;
      return noMatch;
    },
    async () => 2,
  );

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
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const queue = new ShareQueue(
    shares,
    async () => {
      throw new Error("TMDB unreachable");
    },
    async () => 2,
  );
  const id = await shares.create({ text: "x" }, "text");
  queue.wake();

  await until(async () => (await shares.get(id))?.identification.status === "FAILED");
  expect((await shares.get(id))?.identification.error).toBe("TMDB unreachable");
});

test("start() resumes an Identification interrupted by a restart", async () => {
  const shares = new ShareRepository(await openDatabase(":memory:"));
  const id = await shares.create({ text: "x" }, "text");
  await shares.claimNext(); // the previous process took it, then died
  expect((await shares.get(id))?.identification.status).toBe("PROCESSING");

  await new ShareQueue(
    shares,
    async () => noMatch,
    async () => 2,
  ).start();

  await until(async () => (await shares.get(id))?.identification.status === "NO_MATCH");
});
