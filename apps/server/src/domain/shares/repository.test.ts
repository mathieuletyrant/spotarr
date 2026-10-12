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
