import { countryFrom, tmdbFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";

// The countries to choose from, and every Platform TMDB knows in the one that
// counts now.
export async function listPlatforms(settings: SettingsRepository) {
  const current = await settings.get();
  const tmdb = tmdbFrom(current);
  const country = countryFrom(current);
  const [platforms, countries] = await Promise.all([tmdb.platforms(country), tmdb.countries()]);
  return { platforms, region: country, countries };
}
