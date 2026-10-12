import { expect, test } from "bun:test";
import { openDatabase } from "../db";
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

test("a new Share is queued and its Summary is IN_PROGRESS", async () => {
  const { shares } = await repository();
  const share = await shares.create({ url: "https://www.instagram.com/reel/x" }, "instagram.com");

  expect(share.id).toMatch(/^shr_/);
  expect(share.identification.status).toBe("QUEUED");
  expect(share.summary).toBe("IN_PROGRESS");
  expect(share.input).toEqual({
    url: "https://www.instagram.com/reel/x",
    text: undefined,
    hasImage: false,
  });
});

test("the Summary follows the glossary's rules", async () => {
  const { db, shares } = await repository();
  const make = async () => (await shares.create({ text: "x" }, "text")).id;
  const ready = (state: Candidate["libraryState"]) => ({
    status: "READY" as const,
    method: "LLM" as const,
    extractors: ["text"],
    clues: {},
    candidates: [{ ...dune, libraryState: state }],
  });

  const toChoose = await make();
  await shares.finish(toChoose, ready("ABSENT"), 10);
  const present = await make();
  await shares.finish(present, ready("PARTIAL"), 10);
  const failed = await make();
  await shares.fail(failed, "Seerr unreachable", 10);
  const requested = await make();
  await shares.finish(requested, ready("ABSENT"), 10);
  await db
    .insertInto("additions")
    .values({
      id: "add_1",
      share_id: requested,
      tmdb_id: dune.tmdbId,
      media_type: "MOVIE",
      target: "SEERR",
      status: "REQUESTED",
    })
    .execute();

  const summaryOf = async (id: string) => (await shares.get(id))?.summary;
  expect(await summaryOf(toChoose)).toBe("TO_CHOOSE");
  expect(await summaryOf(present)).toBe("ALREADY_PRESENT");
  expect(await summaryOf(failed)).toBe("FAILED");
  expect(await summaryOf(requested)).toBe("REQUESTED");
  expect((await shares.get(requested))?.additions.map((a) => a.status)).toEqual(["REQUESTED"]);
});

test("list pages newest first and filters by Summary and text", async () => {
  const { shares } = await repository();
  const a = await shares.create({ url: "https://letterboxd.com/film/dune" }, "letterboxd.com");
  const b = await shares.create({ text: "the film with Cillian Murphy" }, "text");
  const c = await shares.create({ url: "https://youtube.com/watch?v=1" }, "youtube.com");
  await shares.finish(c.id, { status: "READY", extractors: [], clues: {}, candidates: [dune] }, 10);

  const first = await shares.list({ limit: 2, summaries: [] });
  expect(first.map((s) => s.id)).toEqual([c.id, b.id]);
  const second = await shares.list({ limit: 2, after: b.id, summaries: [] });
  expect(second.map((s) => s.id)).toEqual([a.id]);

  expect((await shares.list({ limit: 10, summaries: ["TO_CHOOSE"] })).map((s) => s.id)).toEqual([
    c.id,
  ]);
  expect(
    (await shares.list({ limit: 10, summaries: [], query: "cillian" })).map((s) => s.id),
  ).toEqual([b.id]);
  expect(
    (await shares.list({ limit: 10, summaries: [], query: "Deuxième" })).map((s) => s.id),
  ).toEqual([c.id]);
});

test("requeue clears what the Identification found and refuses a busy Share", async () => {
  const { shares } = await repository();
  const { id } = await shares.create({ text: "x" }, "text");
  expect(await shares.requeue(id)).toBe("busy");

  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      reasoning: "r",
      extractors: ["text"],
      clues: { caption: "c" },
      candidates: [dune],
    },
    10,
  );
  expect(await shares.requeue(id)).toBe("queued");

  const share = await shares.get(id);
  expect(share?.identification).toEqual({ status: "QUEUED", extractors: [], clues: {} });
  expect(share?.candidates).toEqual([]);
  expect(await shares.requeue("shr_missing")).toBe("missing");
});

test("the image is kept for the Identification but never listed", async () => {
  const { shares } = await repository();
  const { id } = await shares.create({ image: new Uint8Array([1, 2, 3]) }, "image");

  expect((await shares.get(id))?.input.hasImage).toBe(true);
  expect((await shares.input(id)).image).toEqual(new Uint8Array([1, 2, 3]));
});
