import type { SettingsRepository } from "../../domain/settings/repository";
import type { Rpcs } from "./types";

export function settingsRpcs(settings: SettingsRepository): Rpcs<"getSettings" | "updateSettings"> {
  return {
    getSettings: async () => ({ settings: await settings.get() }),

    // An invalid value throws a ZodError: rpc/errors.ts answers invalid_argument.
    updateSettings: async (req) => ({ settings: await settings.update(req.settings ?? {}) }),
  };
}
