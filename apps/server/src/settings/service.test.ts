import { expect, test } from "bun:test";
import { openDatabase } from "../db";
import { SettingsRepository } from "./repository";
import { SettingsService } from "./service";

async function service() {
  const db = await openDatabase(":memory:");
  return new SettingsService(new SettingsRepository(db));
}

test("an empty database gives the defaults", async () => {
  const s = await (await service()).get();
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
  const settings = await service();
  await settings.update({ seerr: { url: "http://seerr:5055" }, extraction: { concurrency: 1 } });
  await settings.update({ identification: { forceJson: false } });

  const s = await settings.get();
  expect(s.seerr).toEqual({ url: "http://seerr:5055", apiKey: "" });
  expect(s.extraction.concurrency).toBe(1);
  expect(s.extraction.framesPerVideo).toBe(6);
  expect(s.identification.forceJson).toBe(false);
});

test("an invalid value is refused and nothing is saved", async () => {
  const settings = await service();
  const bad = settings.update({ seerr: { url: "not a url" }, extraction: { concurrency: 1 } });
  await expect(bad).rejects.toThrow();
  expect((await settings.get()).extraction.concurrency).toBe(2);
});
