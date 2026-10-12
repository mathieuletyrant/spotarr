import { type Kysely, sql } from "kysely";

// Settings become one typed document instead of loose key/value rows: a single
// row (id = 1) holding the settings as JSON, validated by zod on every read and
// write, plus the API token, which is not an editable setting.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("settings").execute();
  await db.schema
    .createTable("settings")
    .addColumn("id", "integer", (c) => c.primaryKey().notNull().check(sql`id = 1`))
    .addColumn("api_token", "text")
    .addColumn("data", "text", (c) => c.notNull().defaultTo("{}"))
    .execute();
  await db.insertInto("settings").values({ id: 1 }).execute();
}
