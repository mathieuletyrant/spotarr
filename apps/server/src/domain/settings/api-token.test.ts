import { expect, test } from "bun:test";
import { openDatabase } from "../../db";
import { ensureApiToken } from "./api-token";
import { SettingsRepository } from "./repository";

test("the API token is created once, then reused", async () => {
  const db = await openDatabase(":memory:");
  const settings = new SettingsRepository(db);

  const first = await ensureApiToken(settings);
  const second = await ensureApiToken(settings);

  expect(first.created).toBe(true);
  expect(first.token).toMatch(/^[\w-]{43}$/);
  expect(second).toEqual({ token: first.token, created: false });
  await db.destroy();
});
