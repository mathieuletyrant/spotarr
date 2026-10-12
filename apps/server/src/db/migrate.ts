import type { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { migrations } from "./migrations";

// biome-ignore lint/suspicious/noExplicitAny: runs before the schema types apply
export async function migrate(db: Kysely<any>): Promise<void> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
