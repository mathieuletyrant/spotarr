import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { WebhookRepository } from "../../domain/webhooks/repository";
import type { WebhookSender } from "../../domain/webhooks/sender";
import type { Webhook } from "../../domain/webhooks/types";
import { SpotarrError } from "../../errors";
import type { Rpcs } from "./types";

export function webhookRpcs(
  webhooks: WebhookRepository,
  sender: WebhookSender,
): Rpcs<"listWebhooks" | "saveWebhook" | "deleteWebhook" | "testWebhook"> {
  async function webhookMessage(id: string) {
    const webhook = await webhooks.get(id);
    if (!webhook) throw new SpotarrError("not_found", `no webhook ${id}`);
    return { webhook: toMessage(webhook) };
  }

  return {
    async listWebhooks() {
      return { webhooks: (await webhooks.list()).map(toMessage) };
    },

    // An invalid URL or no event throws a ZodError: rpc/errors.ts answers invalid_argument.
    async saveWebhook(req) {
      const { id = "", ...fields } = req.webhook ?? {};
      if (id && !(await webhooks.get(id))) throw new SpotarrError("not_found", `no webhook ${id}`);
      return webhookMessage(await webhooks.save(id, fields));
    },

    async deleteWebhook(req) {
      await webhooks.delete(req.id);
      return {};
    },

    async testWebhook(req) {
      const webhook = await webhooks.get(req.id);
      if (!webhook) throw new SpotarrError("not_found", `no webhook ${req.id}`);
      await sender.test(webhook);
      return webhookMessage(req.id);
    },
  };
}

function toMessage(webhook: Webhook) {
  return {
    ...webhook,
    lastDelivery: webhook.lastDelivery && {
      ...webhook.lastDelivery,
      at: timestampFromDate(new Date(webhook.lastDelivery.at)),
    },
  };
}
