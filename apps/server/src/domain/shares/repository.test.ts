import { expect, test } from "bun:test";
import { openDatabase } from "../../db";
import { ShareRepository } from "./repository";
import type { Candidate } from "./types";

async function repository() {
  const db = await openDatabase(":memory:");
  return { db, shares: new ShareRepository(db) };
}

const dune: Candidate = {
  tmdbId: 693134,
  type: "MOVIE",
  title: "Dune : Deuxième partie",
  year: 2024,
  confidence: 0.92,
  libraryState: "ABSENT",
};

test("a new Share is queued", async () => {
  const { shares } = await repository();
  const id = await shares.create({ url: "https://www.instagram.com/reel/x" }, "instagram.com");
  const share = await shares.get(id);

  expect(id).toMatch(/^shr_/);
  expect(share?.identification.status).toBe("QUEUED");
  expect(share?.summary).toBe("IN_PROGRESS");
  expect(share?.input).toEqual({
    url: "https://www.instagram.com/reel/x",
    text: undefined,
    hasImage: false,
  });
});

test("finish stores what the Identification found", async () => {
  const { shares } = await repository();
  const id = await shares.create({ text: "x" }, "text");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["text"],
      clues: { caption: "c" },
      reasoning: "r",
      candidates: [dune],
    },
    12,
  );

  const share = await shares.get(id);
  expect(share?.identification).toEqual({
    status: "READY",
    method: "LLM",
    durationMs: 12,
    extractors: ["text"],
    clues: { caption: "c" },
    reasoning: "r",
    error: undefined,
  });
  expect(share?.candidates).toEqual([dune]);
  expect(share?.summary).toBe("TO_CHOOSE");
});

test("a Share reads its Additions, and its Summary follows the latest", async () => {
  const { db, shares } = await repository();
  const id = await shares.create({ text: "x" }, "text");
  await shares.finish(id, { status: "READY", extractors: [], clues: {}, candidates: [dune] }, 10);
  await db
    .insertInto("additions")
    .values({
      id: "add_1",
      share_id: id,
      tmdb_id: dune.tmdbId,
      media_type: "MOVIE",
      target: "SEERR",
      status: "REQUESTED",
    })
    .execute();

  const share = await shares.get(id);
  expect(share?.additions.map((a) => a.status)).toEqual(["REQUESTED"]);
  expect(share?.summary).toBe("REQUESTED");
});

test("all() lists newest first", async () => {
  const { shares } = await repository();
  const first = await shares.create({ text: "1" }, "text");
  const second = await shares.create({ text: "2" }, "text");
  expect((await shares.all()).map((s) => s.id)).toEqual([second, first]);
});

test("requeue clears what the Identification found", async () => {
  const { shares } = await repository();
  const id = await shares.create({ text: "x" }, "text");
  await shares.finish(
    id,
    { status: "READY", method: "LLM", extractors: ["text"], clues: {}, candidates: [dune] },
    10,
  );

  await shares.requeue(id);

  const share = await shares.get(id);
  expect(share?.identification).toMatchObject({ status: "QUEUED", extractors: [], clues: {} });
  expect(share?.candidates).toEqual([]);
});

test("the image is kept for the Identification but never listed", async () => {
  const { shares } = await repository();
  const id = await shares.create({ image: new Uint8Array([1, 2, 3]) }, "image");

  expect((await shares.get(id))?.input.hasImage).toBe(true);
  expect((await shares.input(id)).image).toEqual(new Uint8Array([1, 2, 3]));
});

test("the video's thumbnails are stored, replaced by a new Identification and cleared by a retry", async () => {
  const { shares } = await repository();
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  const result = (thumbnails: number[]) => ({
    status: "NO_MATCH" as const,
    extractors: ["video"],
    clues: {},
    candidates: [],
    frames: thumbnails.map((n, i) => ({ atMs: i * 1000, thumbnail: new Uint8Array([n]) })),
  });

  await shares.finish(id, result([1, 2, 3]), 10);
  expect((await shares.get(id))?.frames).toEqual([
    { position: 0, atMs: 0 },
    { position: 1, atMs: 1000 },
    { position: 2, atMs: 2000 },
  ]);
  expect(await shares.frameThumbnail(id, 1)).toEqual(new Uint8Array([2]));

  await shares.finish(id, result([9]), 10);
  expect((await shares.get(id))?.frames).toHaveLength(1);
  expect(await shares.frameThumbnail(id, 0)).toEqual(new Uint8Array([9]));

  await shares.requeue(id);
  expect((await shares.get(id))?.frames).toEqual([]);
  expect(await shares.frameThumbnail(id, 0)).toBeUndefined();
});

test("the LLM cost adds up the Identifications whose cost is known", async () => {
  const { shares } = await repository();
  const result = { status: "NO_MATCH" as const, extractors: [], clues: {}, candidates: [] };
  const a = await shares.create({ text: "a" }, "text");
  const b = await shares.create({ text: "b" }, "text");
  const c = await shares.create({ text: "c" }, "text");
  await shares.finish(a, { ...result, llmCostUsd: 0.001 }, 10);
  await shares.finish(b, { ...result, llmCostUsd: 0.002 }, 10);
  await shares.finish(c, result, 10);

  const cost = await shares.llmCostLast30Days();
  expect(cost.identifications).toBe(2);
  expect(cost.totalUsd).toBeCloseTo(0.003);

  // A retry clears the cost of the run it replaces.
  await shares.requeue(a);
  expect((await shares.llmCostLast30Days()).identifications).toBe(1);
});

test("stats count Shares and Additions by month, and Shares by source", async () => {
  const { db, shares } = await repository();
  const a = await shares.create({ url: "https://www.tiktok.com/@x/video/1" }, "tiktok.com");
  const b = await shares.create({ url: "https://www.instagram.com/reel/x" }, "instagram.com");
  const c = await shares.create({ url: "https://www.instagram.com/reel/y" }, "instagram.com");
  await shares.finish(
    a,
    { status: "READY", extractors: [], clues: {}, candidates: [dune], llmCostUsd: 0.01 },
    10,
  );
  await shares.finish(b, { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] }, 10);
  await shares.fail(c, "boom", 10);
  const added = { tmdbId: 693134, type: "MOVIE", target: "SEERR" } as const;
  await shares.addAddition(a, { ...added, status: "REQUESTED", automatic: true });
  await shares.addAddition(a, { ...added, status: "FAILED", automatic: false });
  // One Share from the month before.
  await db
    .updateTable("shares")
    .set({ created_at: "2026-09-30T23:00:00.000Z" })
    .where("id", "=", c)
    .execute();

  const { months, sources } = await shares.stats();
  const thisMonth = new Date().toISOString().slice(0, 7);
  expect(months).toEqual([
    {
      month: "2026-09",
      shares: 1,
      identified: 0,
      noMatch: 0,
      failed: 1,
      llmCostUsd: 0,
      additions: 0,
      automaticAdditions: 0,
    },
    {
      month: thisMonth,
      shares: 2,
      identified: 1,
      noMatch: 1,
      failed: 0,
      llmCostUsd: 0.01,
      additions: 1,
      automaticAdditions: 1,
    },
  ]);
  expect(sources).toEqual([
    { source: "instagram.com", shares: 2 },
    { source: "tiktok.com", shares: 1 },
  ]);
});
