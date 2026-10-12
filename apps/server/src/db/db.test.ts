import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "kysely";
import { openDatabase } from "./index";

test("a SELECT returns rows through the bun:sqlite dialect", async () => {
  const db = await openDatabase(":memory:");
  await db.insertInto("shares").values({ id: "shr_1", input_url: "https://x.test/a" }).execute();

  const rows = await db.selectFrom("shares").select(["id", "status", "candidates"]).execute();

  expect(rows).toEqual([{ id: "shr_1", status: "QUEUED", candidates: "[]" }]);
  await db.destroy();
});

test("INSERT … RETURNING reads the inserted row back", async () => {
  const db = await openDatabase(":memory:");
  const row = await db
    .insertInto("shares")
    .values({ id: "shr_2", input_image: new Uint8Array([1, 2, 3]) })
    .returning(["id", "input_image", "created_at"])
    .executeTakeFirstOrThrow();

  expect(row.id).toBe("shr_2");
  expect(row.input_image).toEqual(new Uint8Array([1, 2, 3]));
  expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  await db.destroy();
});

test("deleting a Share deletes its Additions", async () => {
  const db = await openDatabase(":memory:");
  await db.insertInto("shares").values({ id: "shr_3" }).execute();
  await db
    .insertInto("additions")
    .values({
      id: "add_1",
      share_id: "shr_3",
      tmdb_id: 693134,
      media_type: "MOVIE",
      target: "SEERR",
      status: "REQUESTED",
    })
    .execute();

  await db.deleteFrom("shares").where("id", "=", "shr_3").execute();

  expect(await db.selectFrom("additions").selectAll().execute()).toEqual([]);
  await db.destroy();
});

test("a file database runs in WAL mode and migrates only once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spotarr-"));
  try {
    const path = join(dir, "spotarr.db");
    await (await openDatabase(path)).destroy();
    const db = await openDatabase(path);

    const { rows } = await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(db);
    expect(rows[0]?.journal_mode).toBe("wal");
    const applied = await sql<{ name: string }>`SELECT name FROM kysely_migration`.execute(db);
    expect(applied.rows.map((r) => r.name)).toEqual([
      "2026-10-12-initial",
      "2026-10-12-settings-document",
    ]);
    await db.destroy();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
