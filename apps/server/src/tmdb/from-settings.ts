import type { SettingsRepository } from "../settings/repository";
import { TmdbClient } from "./client";

// Built for each Identification, so a token changed in Settings applies at once.
export function tmdbFromSettings(settings: SettingsRepository) {
  return async (): Promise<TmdbClient> => {
    const { tmdbToken, language } = (await settings.get()).identification;
    if (!tmdbToken) throw new Error("TMDB token not configured (Settings → Identification)");
    return new TmdbClient({ token: tmdbToken, language });
  };
}
