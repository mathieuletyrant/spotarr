import type { Kysely } from "kysely";

// The thumbnails of the frames taken from a shared video, shown on the Share's
// page. 240 px wide, about 10 KB each. The video itself is never kept.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("frames")
    .addColumn("share_id", "text", (c) => c.notNull().references("shares.id").onDelete("cascade"))
    .addColumn("position", "integer", (c) => c.notNull())
    .addColumn("at_ms", "integer", (c) => c.notNull())
    .addColumn("thumbnail", "blob", (c) => c.notNull())
    .addPrimaryKeyConstraint("frames_pk", ["share_id", "position"])
    .execute();
}
