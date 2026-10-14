import type { Event } from "../../domain/shares/events";
import type { Share } from "../../domain/shares/types";
import type { WebhookRepository } from "../../domain/webhooks/repository";
import type { EventName, Webhook } from "../../domain/webhooks/types";
import { postWebhook } from "../../integrations/webhook/post";
import { log } from "../../log";
import { eventBody } from "./event-body";

// Listens to the domain's Events and sends each one to the Webhooks that chose
// it, one try each, recording how each delivery went. A Webhook failing never
// fails anything else.
export class WebhookSender {
  constructor(
    private readonly webhooks: WebhookRepository,
    // Read at each Event, so a change in the settings applies at once.
    private readonly webUiUrl: () => Promise<string>,
  ) {}

  // The domain's Emit: index.ts hands `(event) => sender.emit(event)` to it.
  async emit(event: Event): Promise<void> {
    const added = event.name === "media.added" ? event.added : undefined;
    const body = eventBody(event.name, event.share, await this.webUiUrl(), added);
    for (const webhook of await this.webhooks.list()) {
      if (webhook.events.some((chosen) => chosen === event.name)) {
        await this.deliver(webhook, event.name, body);
      }
    }
  }

  // Sends a sample "test" event to one Webhook, whatever events it chose.
  async test(webhook: Webhook): Promise<void> {
    await this.deliver(webhook, "test", eventBody("test", SAMPLE, await this.webUiUrl()));
  }

  private async deliver(webhook: Webhook, event: EventName, body: string): Promise<void> {
    const { ok, detail } = await postWebhook(webhook.url, body, webhook.secret);
    await this.webhooks.recordDelivery(webhook.id, {
      at: new Date().toISOString(),
      event,
      ok,
      detail,
    });
    // The URL is not logged: many webhook URLs carry a secret and work as a password.
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
