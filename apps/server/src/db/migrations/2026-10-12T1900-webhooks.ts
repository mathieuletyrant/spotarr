import { type Kysely, sql } from "kysely";

// The URLs Spotarr calls when something happens to a Share. `events` is a JSON
// list of event names; `last_delivery` the JSON of the last call, or NULL.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("webhooks")
    .addColumn("id", "text", (c) => c.primaryKey().notNull())
    .addColumn("created_at", "text", (c) =>
      c.notNull().defaultTo(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    )
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("events", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("secret", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("last_delivery", "text")
    .execute();
}
