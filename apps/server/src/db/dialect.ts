// Plugs bun:sqlite into Kysely's built-in SQLite dialect. See docs/adr/0002.
import type { Database, SQLQueryBindings } from "bun:sqlite";
import { SqliteDialect } from "kysely";

export function bunSqliteDialect(sqlite: Database): SqliteDialect {
  return new SqliteDialect({
    database: {
      close: () => sqlite.close(),
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        const bind = (params: ReadonlyArray<unknown>) => params as SQLQueryBindings[];
        return {
          // Kysely only reads rows back when `reader` is true. bun:sqlite has no such
          // flag: without this line every SELECT returns an empty array, silently.
          reader: statement.columnNames.length > 0,
          all: (params) => statement.all(...bind(params)),
          run: (params) => statement.run(...bind(params)),
          iterate: (params) => statement.iterate(...bind(params)),
        };
      },
    },
  });
}
