import { expect, test } from "bun:test";
import { createApp } from "../../app";
import { openDatabase } from "../../db";
import { RuleRepository } from "../../domain/auto-add/repository";
import { SettingsRepository } from "../../domain/settings/repository";
import { ShareRepository } from "../../domain/shares/repository";

const db = await openDatabase(":memory:");
const app = createApp({
  apiToken: () => "t",
  settings: new SettingsRepository(db),
  shares: new ShareRepository(db),
  rules: new RuleRepository(db),
});
const call = async (method: string, body: unknown) => {
  const res = await app.request(`/api/spotarr.v1.SpotarrService/${method}`, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("the chosen Platforms are saved, kept when absent, and cleared by an empty list", async () => {
  await call("UpdateSettings", { settings: { streaming: { platformIds: [283, 8] } } });
  await call("UpdateSettings", { settings: { seerr: { url: "http://seerr.test" } } });
  const kept = await call("GetSettings", {});
  expect(kept.body.settings.streaming).toEqual({ platformIds: [283, 8], country: "" });

  await call("UpdateSettings", { settings: { streaming: {} } });
  const cleared = await call("GetSettings", {});
  expect(cleared.body.settings.streaming).toEqual({ country: "" });
});

test("ListWatchLinks refuses a request without a type", async () => {
  const { body } = await call("ListWatchLinks", { tmdbId: 1 });
  expect(body.code).toBe("invalid_argument");
});
