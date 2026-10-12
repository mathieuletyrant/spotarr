import type { Kysely } from "kysely";
import type { DB } from "../../db";
import { type Settings, type SettingsPatch, SettingsSchema } from "./schema";

// Settings live in a single row (id = 1) as one JSON document. Everything going
// in or out is a `Settings`, validated by zod: the rest of the code never sees
// JSON or column names.
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
        webhooks: { ...current.webhooks, ...present(patch.webhooks) },
        access: {
          ...current.access,
          ...present(patch.access),
          apiToken: current.access.apiToken, // read-only: only setApiToken changes it
        },
      });
      await this.write(trx, next);
      return next;
    });
  }

  async setApiToken(apiToken: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const current = await this.read(trx);
      await this.write(trx, { ...current, access: { ...current.access, apiToken } });
    });
  }

  private async read(db: Kysely<DB>): Promise<Settings> {
    const row = await db
      .selectFrom("settings")
      .select("data")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    return SettingsSchema.parse(JSON.parse(row.data));
  }

  private async write(db: Kysely<DB>, settings: Settings): Promise<void> {
    await db
      .updateTable("settings")
      .set({ data: JSON.stringify(settings) })
      .where("id", "=", 1)
      .execute();
  }
}

// Drops the fields a client did not send, so they keep their current value.
function present<T extends object>(fields: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
