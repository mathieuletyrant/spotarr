import { expect, test } from "bun:test";
import { openDatabase } from "../db";
import { SettingsRepository } from "./repository";

async function repository() {
  return new SettingsRepository(await openDatabase(":memory:"));
}

test("an empty database gives the defaults", async () => {
  const s = await (await repository()).get();
  expect(s.identification.llmApiUrl).toBe("https://openrouter.ai/api/v1");
  expect(s.identification.forceJson).toBe(true);
  expect(s.identification.language).toBe("fr-FR");
  expect(s.seerr).toEqual({ url: "", apiKey: "" });
  expect(s.extraction).toEqual({
    cookiesTxt: "",
    framesPerVideo: 6,
    maxVideoMb: 200,
    concurrency: 2,
  });
});

test("an update changes only the fields given, and types survive storage", async () => {
  const settings = await repository();
  await settings.update({ seerr: { url: "http://seerr:5055" }, extraction: { concurrency: 1 } });
  await settings.update({ identification: { forceJson: false } });

  const s = await settings.get();
  expect(s.seerr).toEqual({ url: "http://seerr:5055", apiKey: "" });
  expect(s.extraction.concurrency).toBe(1);
  expect(s.extraction.framesPerVideo).toBe(6);
  expect(s.identification.forceJson).toBe(false);
});

test("an invalid value is refused and nothing is saved", async () => {
  const settings = await repository();
  const bad = settings.update({ seerr: { url: "not a url" }, extraction: { concurrency: 1 } });
  await expect(bad).rejects.toThrow();
  expect((await settings.get()).extraction.concurrency).toBe(2);
});

test("settings and the API token share the row without overwriting each other", async () => {
  const settings = await repository();
  await settings.setApiToken("tok");
  await settings.update({ seerr: { apiKey: "k" } });

  expect(await settings.apiToken()).toBe("tok");
  expect((await settings.get()).seerr.apiKey).toBe("k");
});
