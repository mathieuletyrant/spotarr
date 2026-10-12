import type { Kysely } from "kysely";
import type { DB } from "../db";
import { type Settings, type SettingsPatch, SettingsSchema } from "./schema";

// Settings live in a single row (id = 1): the API token, and the editable
// settings as one JSON document. Everything going in or out is a `Settings`,
// validated by zod: the rest of the code never sees JSON or column names.
export class SettingsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async get(): Promise<Settings> {
    return this.read(this.db);
  }

  // Applies the fields present in `patch` over the current settings, validates
  // the result as a whole and saves it. Throws a ZodError, saving nothing,
  // when a value is invalid.
  async update(patch: SettingsPatch): Promise<Settings> {
    return this.db.transaction().execute(async (trx) => {
      const current = await this.read(trx);
      const next = SettingsSchema.parse({
        identification: { ...current.identification, ...present(patch.identification) },
        seerr: { ...current.seerr, ...present(patch.seerr) },
        extraction: { ...current.extraction, ...present(patch.extraction) },
        access: { ...current.access, ...present(patch.access) },
      });
      await trx
        .updateTable("settings")
        .set({ data: JSON.stringify(next) })
        .where("id", "=", 1)
        .execute();
      return next;
    });
  }

  async apiToken(): Promise<string | null> {
    const row = await this.db
      .selectFrom("settings")
      .select("api_token")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    return row.api_token;
  }

  async setApiToken(token: string): Promise<void> {
    await this.db.updateTable("settings").set({ api_token: token }).where("id", "=", 1).execute();
  }

  private async read(db: Kysely<DB>): Promise<Settings> {
    const row = await db
      .selectFrom("settings")
      .select("data")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    return SettingsSchema.parse(JSON.parse(row.data));
  }
}

// Drops the fields a client did not send, so they keep their current value.
function present<T extends object>(fields: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
