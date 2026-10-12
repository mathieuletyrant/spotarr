import { z } from "zod";

// The glossary's Events, as sent in a body's "event" field.
const EVENTS = [
  "identification.ready",
  "identification.no_match",
  "identification.failed",
  "media.added",
] as const;
export type EventName = (typeof EVENTS)[number] | "test";

// What SaveWebhook accepts.
export const WebhookSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  events: z.array(z.enum(EVENTS)).min(1, "choose at least one event"),
  secret: z.string(),
});

export type Delivery = { at: string; event: EventName; ok: boolean; detail: string };

export type Webhook = z.infer<typeof WebhookSchema> & { id: string; lastDelivery?: Delivery };
