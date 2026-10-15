import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../repository";
import { ensureSeerrToken } from "./ensure-seerr-token";
import { regenerateSeerrToken } from "./regenerate-seerr-token";

test("the Seerr token is created once, apart from the other tokens", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));

  await ensureSeerrToken(settings);
  const first = (await settings.get()).access.seerrToken;
  await ensureSeerrToken(settings);

  expect(first).toMatch(/^[\w-]{43}$/);
  expect((await settings.get()).access).toMatchObject({
    seerrToken: first,
    apiToken: "",
    mcpToken: "",
  });
});

test("regenerating gives a new Seerr token, saved; UpdateSettings cannot change it", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await ensureSeerrToken(settings);
  const old = (await settings.get()).access.seerrToken;

  const fresh = await regenerateSeerrToken(settings);
  await settings.update({ access: { seerrToken: "mine" } });

  expect(fresh).not.toBe(old);
  expect((await settings.get()).access.seerrToken).toBe(fresh);
});
