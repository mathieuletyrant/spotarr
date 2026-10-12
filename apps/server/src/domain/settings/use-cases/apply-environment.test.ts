import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../repository";
import { applyEnvironment } from "./apply-environment";

test("environment variables win over saved settings; empty ones change nothing", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await settings.update({ seerr: { url: "http://old:5055", apiKey: "saved-key" } });

  await applyEnvironment(settings, {
    LLM_API_KEY: "sk-or-env",
    SEERR_URL: "http://jellyseerr_server_1:5055",
    SEERR_API_KEY: "",
  });

  const saved = await settings.get();
  expect(saved.identification.llmApiKey).toBe("sk-or-env");
  expect(saved.identification.tmdbToken).toBe("");
  expect(saved.seerr).toEqual({ url: "http://jellyseerr_server_1:5055", apiKey: "saved-key" });
});

test("an invalid value is refused and nothing is saved", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await expect(
    applyEnvironment(settings, { LLM_API_KEY: "sk", SEERR_URL: "not a url" }),
  ).rejects.toThrow();
  expect((await settings.get()).identification.llmApiKey).toBe("");
});
