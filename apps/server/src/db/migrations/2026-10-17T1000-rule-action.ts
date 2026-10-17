import type { Kysely } from "kysely";

// What a Rule does with the Candidates it holds for: REQUEST them through
// Seerr, as every Rule did until now, or put them in Seerr's WATCHLIST.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("auto_add_rules")
    .addColumn("action", "text", (c) => c.notNull().defaultTo("REQUEST"))
    .execute();
}
