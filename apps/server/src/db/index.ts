import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { bunSqliteDialect } from "./dialect";
import type { DB } from "./gen/types";
import { migrate } from "./migrate";

export type { DB };

// Opens (or creates) the database, then brings its schema up to date.
// Pass ":memory:" in tests for a throwaway database.
export async function openDatabase(path: string): Promise<Kysely<DB>> {
  const sqlite = new Database(path, { create: true });
  // WAL lets the background queue write while the UI reads.
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = new Kysely<DB>({ dialect: bunSqliteDialect(sqlite) });
  await migrate(db);
  return db;
}
