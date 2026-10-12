import type { SettingsRepository } from "../settings/repository";
import type { Settings } from "../settings/schema";
import type { Rpcs } from "./types";

export function settingsRpcs(
  settings: SettingsRepository,
  apiToken: () => string,
): Rpcs<"getSettings" | "updateSettings"> {
  // The API token is not an editable setting, but the UI shows it under Access.
  const withToken = (s: Settings) => ({ ...s, access: { ...s.access, apiToken: apiToken() } });

  return {
    getSettings: async () => ({ settings: withToken(await settings.get()) }),

    // An invalid value throws a ZodError, turned into invalid_argument by rpc/errors.ts.
    updateSettings: async (req) => ({
      settings: withToken(await settings.update(req.settings ?? {})),
    }),
  };
}
