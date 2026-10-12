import { expect, test } from "bun:test";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { SettingsRepository } from "./settings/repository";

const settings = new SettingsRepository(await openDatabase(":memory:"));
await settings.setApiToken("secret-token");
const app = createApp({ apiToken: () => "secret-token", settings });
const call = (method: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  app.request(`/api/spotarr.v1.SpotarrService/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const authed = (method: string, body: unknown = {}) =>
  call(method, body, { Authorization: "Bearer secret-token" });
const getStatus = (headers: Record<string, string> = {}) => call("GetStatus", {}, headers);

test("/health answers without a token", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
});

test("an RPC without a token gets a Connect unauthenticated error", async () => {
  const res = await getStatus();
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({
    code: "unauthenticated",
    message: "missing or invalid API token",
  });
});

test("a wrong token is refused", async () => {
  expect((await getStatus({ Authorization: "Bearer nope" })).status).toBe(401);
});

test("GetStatus answers JSON with a bearer token", async () => {
  const res = await getStatus({ Authorization: "Bearer secret-token" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ version: "0.0.0" });
});

test("the web UI cookie is accepted too", async () => {
  expect((await getStatus({ Cookie: "spotarr_token=secret-token" })).status).toBe(200);
});

test("an unknown RPC is a 404", async () => {
  const res = await app.request("/api/spotarr.v1.SpotarrService/Nope", {
    method: "POST",
    headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" },
    body: "{}",
  });
  expect(res.status).toBe(404);
});

test("UpdateSettings then GetSettings round-trips, with the API token shown read-only", async () => {
  const update = await authed("UpdateSettings", {
    settings: { seerr: { url: "http://seerr:5055", apiKey: "k" }, access: { apiToken: "hijack" } },
  });
  expect(update.status).toBe(200);

  const { settings } = await (await authed("GetSettings")).json();
  expect(settings.seerr).toEqual({ url: "http://seerr:5055", apiKey: "k" });
  expect(settings.access.apiToken).toBe("secret-token");
  expect(settings.extraction.framesPerVideo).toBe(6);
});

test("an invalid setting is a Connect invalid_argument naming the field", async () => {
  const res = await authed("UpdateSettings", { settings: { extraction: { concurrency: 9 } } });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.code).toBe("invalid_argument");
  expect(body.message).toContain("extraction.concurrency");
});
