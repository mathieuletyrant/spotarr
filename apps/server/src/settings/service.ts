import type { SettingsRepository } from "./repository";
import { type Settings, type SettingsPatch, SettingsSchema } from "./schema";

// Rows are keyed "section.field" ("seerr.url"), values JSON-encoded so numbers
// and booleans come back as such. Rows without a dot (api_token) are not settings.
export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async get(): Promise<Settings> {
    const nested: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of await this.repo.all()) {
      const [section, field] = key.split(".");
      if (!section || !field) continue;
      nested[section] ??= {};
      nested[section][field] = JSON.parse(value);
    }
    return SettingsSchema.parse(nested);
  }

  // Applies the fields present in `patch`, validates the result as a whole,
  // and saves it. Throws a ZodError, and saves nothing, when a value is invalid.
  async update(patch: SettingsPatch): Promise<Settings> {
    const current = await this.get();
    const merged: Record<string, Record<string, unknown>> = structuredClone(current);
    for (const [section, fields] of Object.entries(patch)) {
      for (const [field, value] of Object.entries(fields ?? {})) {
        if (value !== undefined && merged[section]) merged[section][field] = value;
      }
    }
    const next = SettingsSchema.parse(merged);

    const rows = new Map<string, string>();
    for (const [section, fields] of Object.entries(next)) {
      for (const [field, value] of Object.entries(fields)) {
        rows.set(`${section}.${field}`, JSON.stringify(value));
      }
    }
    await this.repo.setMany(rows);
    return next;
  }
}
