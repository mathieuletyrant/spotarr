import type { Kysely } from "kysely";
import type { DB } from "../../db";
import { type Delivery, type Webhook, WebhookSchema } from "./types";

// Webhooks live in the webhooks table; events and the last delivery as JSON.
export class WebhookRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async list(): Promise<Webhook[]> {
    const rows = await this.db.selectFrom("webhooks").selectAll().orderBy("created_at").execute();
    return rows.map(toWebhook);
  }

  async get(id: string): Promise<Webhook | undefined> {
    const row = await this.db
      .selectFrom("webhooks")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toWebhook(row) : undefined;
  }

  // Validates the webhook (throws a ZodError) and saves it. An empty id creates
  // a new one. Returns its id.
  async save(id: string, fields: unknown): Promise<string> {
    const { url, events, secret } = WebhookSchema.parse(fields);
    const values = { url, events: JSON.stringify(events), secret };
    if (id) {
      await this.db.updateTable("webhooks").set(values).where("id", "=", id).execute();
      return id;
    }
    const newId = `whk_${Bun.randomUUIDv7()}`;
    await this.db
      .insertInto("webhooks")
      .values({ id: newId, ...values })
      .execute();
    return newId;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom("webhooks").where("id", "=", id).execute();
  }

  async recordDelivery(id: string, delivery: Delivery): Promise<void> {
    await this.db
      .updateTable("webhooks")
      .set({ last_delivery: JSON.stringify(delivery) })
      .where("id", "=", id)
      .execute();
  }
}

type WebhookRow = {
  id: string;
  url: string;
  events: string;
  secret: string;
  last_delivery: string | null;
};

function toWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    url: row.url,
    events: JSON.parse(row.events),
    secret: row.secret,
    lastDelivery: row.last_delivery ? JSON.parse(row.last_delivery) : undefined,
  };
}
