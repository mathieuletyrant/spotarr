import type { Kysely } from "kysely";

// What a Rule does with the Candidates it holds for: SEERR_REQUEST, as every
// Rule did until now, or SEERR_WATCHLIST. An Action names its connection:
// Radarr and Sonarr will bring their own.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("auto_add_rules")
    .addColumn("action", "text", (c) => c.notNull().defaultTo("SEERR_REQUEST"))
    .execute();
}
