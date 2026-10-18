import { tmdbFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";

// Every Platform TMDB knows in the settings' country, to choose from.
export async function listPlatforms(settings: SettingsRepository) {
  const current = await settings.get();
  const platforms = await tmdbFrom(current).platforms();
  return { platforms, region: current.identification.language.slice(3) };
}
