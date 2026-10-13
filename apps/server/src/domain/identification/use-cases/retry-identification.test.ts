import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../../shares/repository";
import { retryIdentification } from "./retry-identification";

// A Share whose Identification ended without a match; the settings at medium.
async function endedShare() {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({ identification: { effort: "medium" } });
  const id = await shares.create({ text: "Dune" }, "text");
  await shares.finish(id, { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] }, 5);
  return { id, shares, settings };
}

test("a Retry without an effort keeps the settings' one with the Share", async () => {
  const { id, shares, settings } = await endedShare();

  await retryIdentification(id, {}, shares, settings);

  expect(await shares.retryRequest(id)).toEqual({ effort: "medium", hint: undefined });
});

test("a Retry's effort and hint replace the settings' for that Identification", async () => {
  const { id, shares, settings } = await endedShare();

  await retryIdentification(id, { effort: "high", hint: " the Korean show " }, shares, settings);

  expect(await shares.retryRequest(id)).toEqual({ effort: "high", hint: "the Korean show" });
});
