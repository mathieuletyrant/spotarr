import { expect, test } from "bun:test";
import { createApp } from "../../app";
import { openDatabase } from "../../db";
import { RuleRepository } from "../../domain/auto-add/repository";
import { SettingsRepository } from "../../domain/settings/repository";
import { ShareRepository } from "../../domain/shares/repository";

const db = await openDatabase(":memory:");
const shares = new ShareRepository(db);
const app = createApp({
  apiToken: () => "t",
  settings: new SettingsRepository(db),
  shares,
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

test("SaveRule creates, lists, replaces, and DeleteRule removes", async () => {
  const created = await call("SaveRule", {
    rule: { name: "Safe movies", enabled: true, type: "MEDIA_TYPE_MOVIE", minConfidence: 90 },
  });
  expect(created.status).toBe(200);
  const id = created.body.rule.id;
  expect(id).toMatch(/^rul_/);

  await call("SaveRule", {
    rule: { id, name: "Safe movies", enabled: false, minRating: 6.5, unreleasedSkipsRating: true },
  });
  const { body } = await call("ListRules", {});
  expect(body.rules).toEqual([
    {
      id,
      name: "Safe movies",
      minRating: 6.5,
      unreleasedSkipsRating: true,
      // Not sent by the client: a Rule requests unless told otherwise.
      action: "RULE_ACTION_SEERR_REQUEST",
    },
  ]);

  await call("DeleteRule", { id });
  expect((await call("ListRules", {})).body.rules).toBeUndefined();
});

test("SaveRule refuses a Rule without a name or with a confidence out of range", async () => {
  expect((await call("SaveRule", { rule: { name: " ", enabled: true } })).body.code).toBe(
    "invalid_argument",
  );
  const tooSure = await call("SaveRule", {
    rule: { name: "x", enabled: true, minConfidence: 150 },
  });
  expect(tooSure.body.code).toBe("invalid_argument");
  expect((await call("SaveRule", { rule: { id: "rul_nope", name: "x" } })).body.code).toBe(
    "not_found",
  );
});

test("PreviewRules says what unsaved Rules would have added, adding nothing", async () => {
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [
        {
          tmdbId: 1,
          type: "MOVIE",
          title: "Alien",
          year: 1979,
          confidence: 0.9,
          libraryState: "ABSENT",
          tmdbRating: 8.2,
          tmdbVotes: 900,
        },
        { tmdbId: 2, type: "TV", title: "Severance", confidence: 0.9, libraryState: "ABSENT" },
      ],
    },
    10,
  );

  const { body } = await call("PreviewRules", {
    rules: [{ name: "Good movies", enabled: true, type: "MEDIA_TYPE_MOVIE", minRating: 7 }],
  });
  expect(body.shares).toBe(1);
  expect(body.additions).toEqual([
    {
      shareId: id,
      title: "Alien",
      year: 1979,
      type: "MEDIA_TYPE_MOVIE",
      rule: "Good movies",
      action: "RULE_ACTION_SEERR_REQUEST",
    },
  ]);
  expect((await shares.get(id))?.additions).toEqual([]);
});
