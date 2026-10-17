import { expect, test } from "bun:test";
import { openDatabase } from "../../db";
import { up } from "../../db/migrations/2026-10-14T0900-auto-add-rules";
import { RuleRepository } from "./repository";

test("Rules come back oldest first, conditions included", async () => {
  const rules = new RuleRepository(await openDatabase(":memory:"));
  await rules.save("", {
    name: "Movies",
    enabled: true,
    type: "MOVIE",
    minRating: 7,
    minVotes: 100,
  });
  await rules.save("", { name: "Anything sure", enabled: false, onlyOne: true, minConfidence: 95 });
  await rules.save("", { name: "Spotted", enabled: true, action: "SEERR_WATCHLIST" });

  expect(await rules.list()).toMatchObject([
    { name: "Movies", enabled: true, type: "MOVIE", onlyOne: false, minRating: 7, minVotes: 100 },
    {
      name: "Anything sure",
      enabled: false,
      onlyOne: true,
      minConfidence: 95,
      action: "SEERR_REQUEST",
    },
    { name: "Spotted", enabled: true, action: "SEERR_WATCHLIST" },
  ]);
});

// The migration runs again on a database put back as it was before it.
async function beforeRules(settings: unknown) {
  const db = await openDatabase(":memory:");
  await db.schema.dropTable("auto_add_rules").execute();
  await db.schema.alterTable("additions").dropColumn("rule").execute();
  await db
    .updateTable("settings")
    .set({ data: JSON.stringify(settings) })
    .execute();
  return db;
}

test("the old auto add settings become the first Rule when auto add was on", async () => {
  const db = await beforeRules({ autoAdd: { enabled: true, minConfidence: 90, onlyOne: false } });
  await up(db);
  expect(await new RuleRepository(db).list()).toMatchObject([
    { name: "Auto add", enabled: true, onlyOne: false, minConfidence: 90 },
  ]);
});

test("auto add off, or never set, leaves no Rule", async () => {
  const off = await beforeRules({ autoAdd: { enabled: false, minConfidence: 90 } });
  await up(off);
  expect(await new RuleRepository(off).list()).toEqual([]);

  const never = await beforeRules({});
  await up(never);
  expect(await new RuleRepository(never).list()).toEqual([]);
});
