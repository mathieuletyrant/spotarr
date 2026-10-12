import { postWebhook } from "../../integrations/webhook/post";
import { log } from "../../log";
import type { Candidate, Share } from "../shares/types";
import { eventBody } from "./event-body";
import type { WebhookRepository } from "./repository";
import type { EventName, Webhook } from "./types";

// Sends Events to the Webhooks that chose them, one try each, and records how
// each delivery went. A Webhook failing never fails anything else.
export class WebhookSender {
  constructor(
    private readonly webhooks: WebhookRepository,
    // Read at each Event, so a change in the settings applies at once.
    private readonly webUiUrl: () => Promise<string>,
  ) {}

  // An Identification ended: READY, NO_MATCH or FAILED.
  async identificationEnded(share: Share): Promise<void> {
    const status = share.identification.status;
    if (status === "READY") await this.send("identification.ready", share);
    if (status === "NO_MATCH") await this.send("identification.no_match", share);
    if (status === "FAILED") await this.send("identification.failed", share);
  }

  async mediaAdded(share: Share, added: Candidate): Promise<void> {
    await this.send("media.added", share, added);
  }

  // Sends a sample "test" event to one Webhook, whatever events it chose.
  async test(webhook: Webhook): Promise<void> {
    await this.deliver(webhook, "test", eventBody("test", SAMPLE, await this.webUiUrl()));
  }

  private async send(event: EventName, share: Share, added?: Candidate): Promise<void> {
    const body = eventBody(event, share, await this.webUiUrl(), added);
    for (const webhook of await this.webhooks.list()) {
      if (webhook.events.some((chosen) => chosen === event)) {
        await this.deliver(webhook, event, body);
      }
    }
  }

  private async deliver(webhook: Webhook, event: EventName, body: string): Promise<void> {
    const { ok, detail } = await postWebhook(webhook.url, body, webhook.secret);
    await this.webhooks.recordDelivery(webhook.id, {
      at: new Date().toISOString(),
      event,
      ok,
      detail,
    });
    // The URL is not logged: a Home Assistant webhook URL works as a password.
    log({ step: "webhook", webhookId: webhook.id, event, ok, detail });
  }
}

// What a "test" event carries: a made-up Share with one Candidate.
const SAMPLE: Share = {
  id: "shr_test",
  createdAt: new Date().toISOString(),
  input: { url: "https://www.instagram.com/reel/test/", hasImage: false },
  source: "instagram.com",
  identification: { status: "READY", method: "LLM", extractors: ["video"], clues: {} },
  candidates: [
    {
      tmdbId: 693134,
      type: "MOVIE",
      title: "Dune : Deuxième partie",
      year: 2024,
      posterUrl: "https://image.tmdb.org/t/p/w342/qVsp8RqhsF9xPfOP6sMLrv8VdaB.jpg",
      confidence: 0.92,
      libraryState: "ABSENT",
    },
  ],
  additions: [],
  frames: [],
  summary: "TO_CHOOSE",
};
