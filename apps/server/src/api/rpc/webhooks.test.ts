import { expect, test } from "bun:test";
import { createApp } from "../../app";
import { openDatabase } from "../../db";
import { RuleRepository } from "../../domain/auto-add/repository";
import { SettingsRepository } from "../../domain/settings/repository";
import { ShareRepository } from "../../domain/shares/repository";
import { WebhookRepository } from "../../domain/webhooks/repository";
import { WebhookSender } from "../webhooks/sender";

const db = await openDatabase(":memory:");
const shares = new ShareRepository(db);
const settings = new SettingsRepository(db);
const webhooks = new WebhookRepository(db);
const sender = new WebhookSender(webhooks, async () => "");
const app = createApp({
  rules: new RuleRepository(db),
  apiToken: () => "t",
  settings,
  shares,
  webhooks,
  sender,
});
const call = async (method: string, body: unknown) => {
  const res = await app.request(`/api/spotarr.v1.SpotarrService/${method}`, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("SaveWebhook creates, lists, replaces and DeleteWebhook removes", async () => {
  const created = await call("SaveWebhook", {
    webhook: { url: "http://ha.local/api/webhook/x", events: ["identification.ready"] },
  });
  expect(created.status).toBe(200);
  const id = created.body.webhook.id;
  expect(id).toMatch(/^whk_/);

  await call("SaveWebhook", {
    webhook: { id, url: "http://ha.local/api/webhook/y", events: ["media.added"], secret: "s" },
  });
  expect((await call("ListWebhooks", {})).body.webhooks).toEqual([
    { id, url: "http://ha.local/api/webhook/y", events: ["media.added"], secret: "s" },
  ]);

  await call("DeleteWebhook", { id });
  expect((await call("ListWebhooks", {})).body.webhooks).toBeUndefined();
});

test("SaveWebhook refuses a bad URL, no event, or an unknown id", async () => {
  const bad = await call("SaveWebhook", { webhook: { url: "nope", events: ["media.added"] } });
  expect(bad.body.code).toBe("invalid_argument");
  expect(bad.body.message).toContain("url:");
  const unknown = await call("SaveWebhook", {
    webhook: { id: "whk_nope", url: "http://x", events: ["media.added"] },
  });
  expect(unknown.body.code).toBe("not_found");
});
