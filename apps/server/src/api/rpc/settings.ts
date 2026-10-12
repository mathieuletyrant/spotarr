import type { SettingsRepository } from "../../domain/settings/repository";
import type { Rpcs } from "./types";

export function settingsRpcs(settings: SettingsRepository): Rpcs<"getSettings" | "updateSettings"> {
  return {
    getSettings: async () => ({ settings: await settings.get() }),

    // An invalid value throws a ZodError, turned into invalid_argument by rpc/errors.ts.
    updateSettings: async (req) => ({ settings: await settings.update(req.settings ?? {}) }),
  };
}
