import type { Migration } from "kysely/migration";
import * as initial from "./2026-10-12-initial";
import * as settingsDocument from "./2026-10-12-settings-document";
import * as frames from "./2026-10-12T1400-frames";
import * as llmCost from "./2026-10-12T1800-llm-cost";
import * as webhooks from "./2026-10-12T1900-webhooks";
import * as autoAdd from "./2026-10-12T2000-auto-add";

// Listed by hand rather than read from disk: the list survives bundling.
// Kysely applies them in the alphabetical order of their names, so a name is
// the date and time it was written: YYYY-MM-DDTHHMM-what (the first two predate
// the rule and sort first anyway).
export const migrations: Record<string, Migration> = {
  "2026-10-12-initial": initial,
  "2026-10-12-settings-document": settingsDocument,
  "2026-10-12T1400-frames": frames,
  "2026-10-12T1800-llm-cost": llmCost,
  "2026-10-12T1900-webhooks": webhooks,
  "2026-10-12T2000-auto-add": autoAdd,
};
