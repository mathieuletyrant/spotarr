import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../repository";
import { ensureApiToken } from "./ensure-api-token";

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
