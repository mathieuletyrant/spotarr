import type { Kysely } from "kysely";

// The LLM's effort for a Share's Identification: while it waits, the one it will
// get (the setting's when the Share was created, or Retry's choice); once it
// ends, the one the LLM got (NULL: no LLM called).
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("shares").addColumn("effort", "text").execute();
}
