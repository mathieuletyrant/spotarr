import { type Kysely, sql } from "kysely";

// Auto add's Rules: a name, a switch, and the conditions as JSON. The old
// settings (one confidence, "only one") become the first Rule when auto add
// was on. Each Addition keeps the name of the Rule that made it.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("auto_add_rules")
    .addColumn("id", "text", (c) => c.primaryKey().notNull())
    .addColumn("created_at", "text", (c) =>
      c.notNull().defaultTo(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    )
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("enabled", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("conditions", "text", (c) => c.notNull().defaultTo("{}"))
    .execute();
  await db.schema.alterTable("additions").addColumn("rule", "text").execute();

  const row = await db.selectFrom("settings").select("data").where("id", "=", 1).executeTakeFirst();
  const autoAdd = row ? JSON.parse(row.data).autoAdd : undefined;
  if (!autoAdd?.enabled) return;
  await db
    .insertInto("auto_add_rules")
    .values({
      id: `rul_${Bun.randomUUIDv7()}`,
      name: "Auto add",
      enabled: 1,
      conditions: JSON.stringify({
        onlyOne: autoAdd.onlyOne ?? true,
        minConfidence: autoAdd.minConfidence ?? 95,
      }),
    })
    .execute();
}
