import { type Kysely, sql } from "kysely";

// Migrations see the database as it was when they were written, hence Kysely<any>.
// Once applied, a migration is frozen: changes go in a new dated file.
// biome-ignore lint/suspicious/noExplicitAny: see above
export async function up(db: Kysely<any>): Promise<void> {
  // SQLite lets a TEXT primary key hold NULL unless told otherwise, hence notNull().
  const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

  await db.schema
    .createTable("shares")
    .addColumn("id", "text", (c) => c.primaryKey().notNull())
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    // Input: any combination of the three. The image is kept so that a queued
    // Share survives a restart and RetryIdentification can run again.
    .addColumn("input_url", "text")
    .addColumn("input_text", "text")
    .addColumn("input_image", "blob")
    .addColumn("source", "text")
    // Identification: QUEUED, PROCESSING, READY, NO_MATCH, FAILED.
    .addColumn("status", "text", (c) => c.notNull().defaultTo("QUEUED"))
    .addColumn("method", "text")
    .addColumn("duration_ms", "integer")
    .addColumn("extractors", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("clues", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("reasoning", "text")
    .addColumn("candidates", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("error", "text")
    .execute();
  await db.schema.createIndex("shares_status").on("shares").column("status").execute();
  await db.schema.createIndex("shares_created_at").on("shares").column("created_at").execute();

  await db.schema
    .createTable("additions")
    .addColumn("id", "text", (c) => c.primaryKey().notNull())
    .addColumn("share_id", "text", (c) => c.notNull().references("shares.id").onDelete("cascade"))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("tmdb_id", "integer", (c) => c.notNull())
    .addColumn("media_type", "text", (c) => c.notNull())
    .addColumn("target", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("error", "text")
    .execute();
  await db.schema.createIndex("additions_share_id").on("additions").column("share_id").execute();

  await db.schema
    .createTable("settings")
    .addColumn("key", "text", (c) => c.primaryKey().notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();
}
