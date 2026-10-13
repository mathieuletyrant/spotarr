import { afterEach, expect, mock, test } from "bun:test";
import pkg from "../package.json";
import { WebhookSender } from "./api/webhooks/sender";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { SettingsRepository } from "./domain/settings/repository";
import { ShareRepository } from "./domain/shares/repository";
import { WebhookRepository } from "./domain/webhooks/repository";
import {
  getGetMovieMovieIdResponseMock,
  getPostRequestResponseMock,
} from "./integrations/seerr/gen/seerr.faker";
import { fakeFetch } from "./testing/fake-fetch";

afterEach(() => mock.restore());

const db = await openDatabase(":memory:");
const settings = new SettingsRepository(db);
await settings.setApiToken("secret-token");
const shares = new ShareRepository(db);
const webhooks = new WebhookRepository(db);
const sender = new WebhookSender(webhooks, async () => "");
const app = createApp({
  apiToken: () => "secret-token",
  settings,
  shares,
  webhooks,
  sender,
});
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
  expect(await res.json()).toEqual({ version: pkg.version });
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

test("Login checks the token without needing it, then sets an HttpOnly cookie", async () => {
  const refused = await call("Login", { token: "nope" });
  expect(refused.status).toBe(401);
  expect((await refused.json()).code).toBe("unauthenticated");

  const accepted = await call("Login", { token: "secret-token" });
  expect(accepted.status).toBe(200);
  const cookie = accepted.headers.get("Set-Cookie") ?? "";
  expect(cookie).toContain("spotarr_token=secret-token");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Strict");
  expect(cookie).not.toContain("Secure");
});

test("Logout expires the cookie", async () => {
  const res = await authed("Logout");
  expect(res.status).toBe(200);
  const cookie = res.headers.get("Set-Cookie") ?? "";
  expect(cookie).toContain("spotarr_token=;");
  expect(cookie).toContain("Max-Age=0");
});

test("behind https the cookie is Secure", async () => {
  const accepted = await call("Login", { token: "secret-token" }, { "X-Forwarded-Proto": "https" });
  expect(accepted.headers.get("Set-Cookie")).toContain("Secure");
});

test("a video thumbnail is served as JPEG, and only with the token", async () => {
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "NO_MATCH",
      extractors: ["video"],
      clues: {},
      candidates: [],
      frames: [{ atMs: 0, thumbnail: new Uint8Array([0xff, 0xd8]) }],
    },
    10,
  );

  expect((await app.request(`/frames/${id}/0.jpg`)).status).toBe(401);

  const res = await app.request(`/frames/${id}/0.jpg`, {
    headers: { Cookie: "spotarr_token=secret-token" },
  });
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8]));

  expect(
    (
      await app.request(`/frames/${id}/7.jpg`, {
        headers: { Cookie: "spotarr_token=secret-token" },
      })
    ).status,
  ).toBe(404);
});

test("Add requests a Candidate through Seerr and answers with the Share", async () => {
  await settings.update({ seerr: { url: "http://seerr.test", apiKey: "key" } });
  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      extractors: ["video"],
      clues: {},
      candidates: [{ tmdbId: 41733, type: "MOVIE", title: "Date limite", libraryState: "ABSENT" }],
    },
    10,
  );
  fakeFetch({
    "/api/v1/movie/41733": getGetMovieMovieIdResponseMock({ mediaInfo: undefined }),
    "/api/v1/request": getPostRequestResponseMock(),
  });

  const res = await authed("Add", { shareId: id, tmdbId: 41733, type: "MEDIA_TYPE_MOVIE" });

  expect(res.status).toBe(200);
  const { share } = await res.json();
  expect(share.candidates[0].status).toBe("CANDIDATE_STATUS_REQUESTED");
  expect(share.summary).toBe("SUMMARY_REQUESTED");
});
