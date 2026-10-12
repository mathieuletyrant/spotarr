import { expect, test } from "bun:test";
import { createApp } from "./app";

const app = createApp({ apiToken: () => "secret-token" });
const getStatus = (headers: Record<string, string> = {}) =>
  app.request("/api/spotarr.v1.SpotarrService/GetStatus", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });

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
