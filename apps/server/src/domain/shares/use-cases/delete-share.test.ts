import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { ShareRepository } from "../repository";
import { deleteShare } from "./delete-share";

async function repository() {
  const db = await openDatabase(":memory:");
  return { db, shares: new ShareRepository(db) };
}

test("a finished Share goes with its frames and Additions", async () => {
  const { db, shares } = await repository();
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [{ tmdbId: 41733, type: "MOVIE", title: "Date limite", libraryState: "ABSENT" }],
      frames: [{ atMs: 0, thumbnail: new Uint8Array([1]) }],
    },
    10,
  );
  await shares.addAddition(id, {
    tmdbId: 41733,
    type: "MOVIE",
    target: "SEERR",
    status: "REQUESTED",
    automatic: false,
  });

  await deleteShare(id, shares);

  expect(await shares.get(id)).toBeUndefined();
  expect(await db.selectFrom("frames").selectAll().execute()).toEqual([]);
  expect(await db.selectFrom("additions").selectAll().execute()).toEqual([]);
});

test("a queued Share can be deleted", async () => {
  const { shares } = await repository();
  const id = await shares.create({ text: "Dune" }, "text");

  await deleteShare(id, shares);

  expect(await shares.get(id)).toBeUndefined();
  expect(await shares.claimNext()).toBeUndefined();
});

test("a Share being identified is refused, and kept", async () => {
  const { shares } = await repository();
  const id = await shares.create({ text: "Dune" }, "text");
  await shares.claimNext();

  await expect(deleteShare(id, shares)).rejects.toMatchObject({ code: "busy" });
  expect(await shares.get(id)).toBeDefined();
});

test("an unknown Share is not found", async () => {
  const { shares } = await repository();

  await expect(deleteShare("shr_unknown", shares)).rejects.toMatchObject({ code: "not_found" });
});

test("the other Shares stay", async () => {
  const { shares } = await repository();
  const kept = await shares.create({ text: "Dune" }, "text");
  const deleted = await shares.create({ text: "Alien" }, "text");

  await deleteShare(deleted, shares);

  expect((await shares.all()).map((s) => s.id)).toEqual([kept]);
});
