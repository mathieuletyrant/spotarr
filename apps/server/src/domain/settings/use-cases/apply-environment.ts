import type { SettingsRepository } from "../repository";

// Settings given as environment variables (on Umbrel, the app's settings in
// umbrelOS) win over the saved ones at each start. An empty variable changes
// nothing. Throws a ZodError for an invalid value, saving nothing.
export async function applyEnvironment(
  settings: SettingsRepository,
  env: Record<string, string | undefined>,
): Promise<void> {
  await settings.update({
    identification: {
      llmApiKey: env.LLM_API_KEY || undefined,
      tmdbToken: env.TMDB_TOKEN || undefined,
    },
    seerr: {
      url: env.SEERR_URL || undefined,
      apiKey: env.SEERR_API_KEY || undefined,
    },
  });
}
