import type { Kysely } from "kysely";

// What the LLM cost for an Identification, in US dollars, as its provider
// reports it (OpenRouter does). NULL when unknown or when no LLM was called.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("shares").addColumn("llm_cost_usd", "real").execute();
}
