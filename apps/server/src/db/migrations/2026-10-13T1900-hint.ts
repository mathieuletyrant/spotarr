import type { Kysely } from "kysely";

// The hint a Retry gave the LLM for that Identification. NULL: none.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("shares").addColumn("hint", "text").execute();
}
