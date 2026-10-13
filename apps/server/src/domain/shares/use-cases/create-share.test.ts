import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../../settings/repository";
import { ShareRepository } from "../repository";
import { createShare } from "./create-share";

test("a new Share keeps the effort of the settings, so its page can say how long", async () => {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const settings = new SettingsRepository(db);
  await settings.update({ identification: { effort: "medium" } });

  const id = await createShare({ text: "Dune" }, shares, settings);

  expect((await shares.get(id))?.identification.effort).toBe("medium");
});
