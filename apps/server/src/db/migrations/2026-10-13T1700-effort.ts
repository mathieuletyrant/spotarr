import type { Kysely } from "kysely";

// The LLM's effort for a Share's Identification: the one Retry asked for while
// QUEUED (NULL: the setting's), the one used once it ends (NULL: no LLM called).
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("shares").addColumn("effort", "text").execute();
}
