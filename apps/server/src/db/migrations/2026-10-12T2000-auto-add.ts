import type { Kysely } from "kysely";

// 1 for an Addition made by auto add, without a click.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("additions")
    .addColumn("automatic", "integer", (c) => c.notNull().defaultTo(0))
    .execute();
}
