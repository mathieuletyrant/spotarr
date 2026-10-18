import type { Kysely } from "kysely";

// The outgoing Webhooks are gone: nobody listened to them.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("webhooks").ifExists().execute();
}
