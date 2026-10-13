import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createHmac } from "node:crypto";
import { openDatabase } from "../../db";
import { ShareRepository } from "../../domain/shares/repository";
import { WebhookRepository } from "../../domain/webhooks/repository";
import { WebhookSender } from "./sender";

afterEach(() => mock.restore());

async function setUp() {
  const db = await openDatabase(":memory:");
  const shares = new ShareRepository(db);
  const webhooks = new WebhookRepository(db);
  const sender = new WebhookSender(webhooks, async () => "https://spotarr.example.com/");

  const id = await shares.create({ url: "https://www.instagram.com/reel/x/" }, "instagram.com");
  await shares.finish(
    id,
    {
      status: "READY",
      method: "LLM",
      extractors: ["video"],
      clues: {},
      candidates: [
        { tmdbId: 1571766, type: "MOVIE", title: "Kraken", year: 2026, libraryState: "ABSENT" },
      ],
    },
    10,
  );
  const share = await shares.get(id);
  if (!share) throw new Error("no share");
  return { webhooks, sender, share };
}

// Answers every POST with `status` and keeps what was sent.
function fakeReceiver(status = 200) {
  return spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response(null, { status })) as unknown as typeof fetch,
  );
}

test("an Identification ready goes to the Webhooks that chose it, signed", async () => {
  const { webhooks, sender, share } = await setUp();
  const chosen = await webhooks.save("", {
    url: "http://ha.local/api/webhook/spotarr",
    events: ["identification.ready"],
    secret: "s3cret",
  });
  await webhooks.save("", { url: "http://other.local", events: ["media.added"], secret: "" });
  const fetch = fakeReceiver();

  await sender.emit({ name: "identification.ready", share });

  expect(fetch.mock.calls).toHaveLength(1);
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(url).toBe("http://ha.local/api/webhook/spotarr");
  const body = String(init?.body);
  expect(JSON.parse(body)).toMatchObject({
    event: "identification.ready",
    shareId: share.id,
    shareUrl: `https://spotarr.example.com/shares/${share.id}`,
    source: "instagram.com",
    sharedUrl: "https://www.instagram.com/reel/x/",
    // The API's Candidate, Candidate status included.
    candidates: [
      {
        tmdbId: 1571766,
        title: "Kraken",
        type: "MEDIA_TYPE_MOVIE",
        status: "CANDIDATE_STATUS_CAN_ADD",
      },
    ],
  });
  const headers = init?.headers as Record<string, string>;
  expect(headers["X-Spotarr-Signature"]).toBe(
    createHmac("sha256", "s3cret").update(body).digest("hex"),
  );
  expect((await webhooks.get(chosen))?.lastDelivery).toMatchObject({
    event: "identification.ready",
    ok: true,
    detail: "HTTP 200",
  });
});

test("a Webhook that fails is recorded, without throwing", async () => {
  const { webhooks, sender, share } = await setUp();
  const id = await webhooks.save("", {
    url: "http://ha.local/x",
    events: ["identification.ready"],
    secret: "",
  });
  spyOn(globalThis, "fetch").mockImplementation((async () => {
    throw new TypeError("connection refused");
  }) as unknown as typeof fetch);

  await sender.emit({ name: "identification.ready", share });

  expect((await webhooks.get(id))?.lastDelivery).toMatchObject({
    ok: false,
    detail: "could not be reached: connection refused",
  });
});

test("Test sends a sample event to one Webhook, whatever its events", async () => {
  const { webhooks, sender } = await setUp();
  const id = await webhooks.save("", {
    url: "http://ha.local/x",
    events: ["media.added"],
    secret: "",
  });
  const fetch = fakeReceiver(404);

  const webhook = await webhooks.get(id);
  if (webhook) await sender.test(webhook);

  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).event).toBe("test");
  expect((await webhooks.get(id))?.lastDelivery).toMatchObject({ ok: false, detail: "HTTP 404" });
});

test("a Webhook needs an http URL and at least one event", async () => {
  const { webhooks } = await setUp();
  await expect(
    webhooks.save("", { url: "ftp://x", events: ["media.added"], secret: "" }),
  ).rejects.toThrow();
  await expect(webhooks.save("", { url: "http://x", events: [], secret: "" })).rejects.toThrow(
    "choose at least one event",
  );
});
