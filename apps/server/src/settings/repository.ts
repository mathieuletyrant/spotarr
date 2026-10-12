import type { Kysely } from "kysely";
import type { DB } from "../db";

// Settings are plain key/value rows. Issue #10 adds the typed settings on top.
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

  async set(key: string, value: string): Promise<void> {
    await this.db
      .insertInto("settings")
      .values({ key, value })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
      .execute();
  }
}
