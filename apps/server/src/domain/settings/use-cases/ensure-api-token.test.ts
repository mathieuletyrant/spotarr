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

test("API_TOKEN, when set, is the token", async () => {
  const db = await openDatabase(":memory:");
  const settings = new SettingsRepository(db);
  await ensureApiToken(settings);

  expect(await ensureApiToken(settings, "umbrel-password")).toEqual({
    token: "umbrel-password",
    created: false,
  });
  expect((await settings.get()).access.apiToken).toBe("umbrel-password");
  await db.destroy();
});
