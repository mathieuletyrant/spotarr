import type { SettingsRepository } from "../../domain/settings/repository";
import { regenerateMcpToken } from "../../domain/settings/use-cases/regenerate-mcp-token";
import { regenerateSeerrToken } from "../../domain/settings/use-cases/regenerate-seerr-token";
import type { Rpcs } from "./types";

export function settingsRpcs(
  settings: SettingsRepository,
): Rpcs<"getSettings" | "updateSettings" | "regenerateMcpToken" | "regenerateSeerrToken"> {
  return {
    getSettings: async () => ({ settings: await settings.get() }),

    // An invalid value throws a ZodError: rpc/errors.ts answers invalid_argument.
    updateSettings: async (req) => ({ settings: await settings.update(req.settings ?? {}) }),

    regenerateMcpToken: async () => ({ mcpToken: await regenerateMcpToken(settings) }),

    regenerateSeerrToken: async () => ({ seerrToken: await regenerateSeerrToken(settings) }),
  };
}
