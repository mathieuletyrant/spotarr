import type { Kysely } from "kysely";
import type { DB } from "../db";

// Settings are plain key/value rows; values are stored as JSON text.
export class SettingsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async get(key: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom("settings")
      .select("value")
      .where("key", "=", key)
      .executeTakeFirst();
    return row?.value;
  }

  async all(): Promise<Map<string, string>> {
    const rows = await this.db.selectFrom("settings").select(["key", "value"]).execute();
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.setMany(new Map([[key, value]]));
  }

  // One transaction: a save either lands whole or not at all.
  async setMany(entries: Map<string, string>): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const [key, value] of entries) {
        await trx
          .insertInto("settings")
          .values({ key, value })
          .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
          .execute();
      }
    });
  }
}
