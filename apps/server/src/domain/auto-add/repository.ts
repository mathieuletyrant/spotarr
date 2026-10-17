import type { Kysely } from "kysely";
import type { DB } from "../../db";
import { ConditionsSchema, type Rule, RuleSchema } from "./types";

// Rules live in the auto_add_rules table, their conditions as JSON. Oldest
// first: when several Rules hold, the first one is credited.
export class RuleRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async list(): Promise<Rule[]> {
    const rows = await this.db
      .selectFrom("auto_add_rules")
      .selectAll()
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    return rows.map(toRule);
  }

  async get(id: string): Promise<Rule | undefined> {
    const row = await this.db
      .selectFrom("auto_add_rules")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toRule(row) : undefined;
  }

  // Validates the Rule (throws a ZodError) and saves it. An empty id creates a
  // new one. Returns its id.
  async save(id: string, fields: unknown): Promise<string> {
    const { name, enabled, action, ...conditions } = RuleSchema.parse(fields);
    const values = {
      name,
      enabled: enabled ? 1 : 0,
      action,
      conditions: JSON.stringify(conditions),
    };
    if (id) {
      await this.db.updateTable("auto_add_rules").set(values).where("id", "=", id).execute();
      return id;
    }
    const newId = `rul_${Bun.randomUUIDv7()}`;
    await this.db
      .insertInto("auto_add_rules")
      .values({ id: newId, ...values })
      .execute();
    return newId;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom("auto_add_rules").where("id", "=", id).execute();
  }
}

type RuleRow = { id: string; name: string; enabled: number; action: string; conditions: string };

function toRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    action: row.action === "WATCHLIST" ? "WATCHLIST" : "REQUEST",
    ...ConditionsSchema.parse(JSON.parse(row.conditions)),
  };
}
