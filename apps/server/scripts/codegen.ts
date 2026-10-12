// Writes src/db/gen/types.ts from the migrated schema. kysely-codegen's CLI can
// only reach bun:sqlite through kysely-bun-sqlite, the broken dialect of ADR 0002,
// so we call its API with our own Kysely instance instead.
import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { generate, SqliteDialect } from "kysely-codegen";
import { bunSqliteDialect } from "../src/db/dialect";
import { migrate } from "../src/db/migrate";

// biome-ignore lint/suspicious/noExplicitAny: introspection needs no schema type
const db = new Kysely<any>({ dialect: bunSqliteDialect(new Database(":memory:")) });
await migrate(db);
await generate({
  db,
  dialect: new SqliteDialect(),
  outFile: new URL("../src/db/gen/types.ts", import.meta.url).pathname,
  excludePattern: "kysely_*",
  // bun:sqlite returns blobs as Uint8Array, not Node's Buffer.
  typeMapping: { blob: "Uint8Array" },
});
await db.destroy();
