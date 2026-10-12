import type { Migration } from "kysely/migration";
import * as initial from "./2026-10-12-initial";

// Listed by hand rather than read from disk: the order is explicit and the
// list survives bundling. Keys sort by date, which is the order Kysely applies.
export const migrations: Record<string, Migration> = {
  "2026-10-12-initial": initial,
};
